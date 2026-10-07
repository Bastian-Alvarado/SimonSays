/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Spotify: OAuth exchange, token refresh, Now Playing polling and playback
 * control.
 *
 * Polling runs on the server, so "current track" overlays and
 * `spotify_track_change` triggers keep working with no tab open. Tokens are
 * refreshed proactively (60s before expiry) rather than reactively on a 401.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import { config } from '../config.js';

const log = createLogger('spotify');

const AUTH = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

let tokens = null;
let settings = null;
let pollTimer = null;
let status = 'disconnected';
let track = null;
let upNext = null;

/** How stale an up-next answer may get while the same song keeps playing. */
const UPNEXT_REFRESH_MS = 30_000;
let lastUpNextAt = 0;

/**
 * Client id/secret may come from the environment or from the Connections
 * screen. Stored values win so the app is configurable from any device
 * without editing .env on the machine running the server.
 */
const clientId = () => settings?.get().clientId || config.spotify.clientId;
const clientSecret = () => settings?.get().clientSecret || config.spotify.clientSecret;

export const getSettings = () => ({ clientId: clientId(), hasSecret: Boolean(clientSecret()) });
export const setSettings = (patch) => settings.set({ ...settings.get(), ...patch });

/*
  What we last asked the player for, and when.

  Volume, shuffle and repeat are read-modify-write: each has to know where it
  is starting from. Reading the device every time is both slow and wrong —
  slow because it is a second round trip before anything happens, and wrong
  because four quick presses of volume-up all read the same number and all
  compute the same answer. Measured: four presses moved the volume by ten.

  So each one remembers what it asked for and the next press starts from that,
  falling back to the device once the memory is older than a gesture.

  Remembered only once the player has agreed. A press that failed changed
  nothing, and recording what it wanted would make the press after it step from
  somewhere the volume never was.
*/
const WANTED_FRESH_MS = 5000;
let wanted = { volume: null, shuffle: null, repeat: null, playing: null, at: 0 };
const remember = (fields) => { wanted = { ...wanted, ...fields, at: Date.now() }; };
const stillFresh = () => Date.now() - wanted.at < WANTED_FRESH_MS;
/** Forgotten whenever something else might have moved it. */
const forgetWanted = () => { wanted = { volume: null, shuffle: null, repeat: null, playing: null, at: 0 }; };

/*
  One at a time. Read-modify-write means a second press that starts before the
  first has written lands on the same answer, so they queue — which costs the
  second press nothing it was not already waiting for.
*/
let pending = Promise.resolve();
const queued = (fn) => {
  const run = pending.then(fn, fn);
  pending = run.then(() => {}, () => {});
  return run;
};

/** Which operations change what a viewer can see, and so are worth a re-poll. */
const CHANGES_THE_VIEW = ['play', 'pause', 'next', 'previous', 'toggle'];

let prevTrackId = null;
let prevIsPlaying = null;

/**
 * Consecutive Now Playing failures. These used to be swallowed at debug level
 * while `status` stayed 'connected', so a revoked authorisation left the UI
 * reporting a healthy Spotify indefinitely, with a track that never changed.
 */
let consecutivePollFailures = 0;
const POLL_FAILURE_LIMIT = 5;

/** Mark an error as unrecoverable, so polling stops rather than retrying forever. */
function fatal(err) {
  err.fatal = true;
  return err;
}

export function initSpotify() {
  tokens = collection('spotify_tokens', { accessToken: '', refreshToken: '', expiresAt: 0 });
  settings = collection('spotify_settings', { clientId: '', clientSecret: '' });
  if (config.autoStart && tokens.get().refreshToken) {
    start().catch((err) => log.warn('auto-start failed:', err.message));
  }
}

function setStatus(next) {
  status = next;
  bus.emit(EVENTS.STATUS, { platform: 'spotify', status });
}

export const getStatus = () => ({ status, track, upNext });

function basicAuth() {
  return `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`;
}

/** Exchange an authorization code for tokens. Called by the UI's OAuth callback. */
export async function exchangeCode(code, redirectUri) {
  if (!clientId() || !clientSecret()) {
    throw new Error('Spotify: client id/secret are not set — add them on the Connections screen or as SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET');
  }

  const res = await fetch(AUTH, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`Spotify auth failed: ${json.error_description || json.error}`);

  tokens.set({
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });

  log.info('authorised');
  await start();
  return true;
}

async function refresh() {
  const t = tokens.get();
  if (!t.refreshToken) throw fatal(new Error('Spotify: no refresh token'));

  const res = await fetch(AUTH, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken }),
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(`Spotify refresh failed: ${json.error_description || json.error}`);
    err.code = json.error;
    // A revoked or mismatched grant never recovers; anything else (a 5xx, a
    // network blip) might. Tag it here rather than pattern-matching the
    // message later: the message prefers `error_description`, so a revoked
    // token reads "Refresh token revoked" and never mentions invalid_grant.
    if (json.error === 'invalid_grant' || json.error === 'invalid_client') fatal(err);
    throw err;
  }

  tokens.set({
    accessToken: json.access_token,
    // Spotify only returns a new refresh token sometimes; keep the old one otherwise.
    refreshToken: json.refresh_token || t.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  log.debug('token refreshed');
}

async function accessToken() {
  const t = tokens.get();
  if (!t.accessToken) throw fatal(new Error('Spotify: not authenticated'));
  if (Date.now() > t.expiresAt - 60_000) await refresh();
  return tokens.get().accessToken;
}

async function api(endpoint, { method = 'GET', body } = {}) {
  const token = await accessToken();
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* a player command can answer 200 with no JSON */ }
  if (!res.ok) {
    const err = new Error(`Spotify ${res.status}: ${json?.error?.message || text}`);
    // Spotify says why as well as what — NO_ACTIVE_DEVICE, PREMIUM_REQUIRED — and the why is what decides what to do next.
    err.status = res.status;
    err.reason = json?.error?.reason || '';
    throw err;
  }
  return json;
}

/*
  The player Spotify has let go of.

  Every player command goes to whichever device Spotify counts as active, and
  a device that has sat paused for a while — a few minutes — stops counting.
  From then on every press answers 404 NO_ACTIVE_DEVICE, and the only thing
  that used to bring it back was pressing play in Spotify itself.

  The device is still there, though: Spotify keeps listing it for as long as
  the app is open. So a press that finds nobody active asks for that list,
  picks the device the music was last on, hands playback back to it, and then
  does what was pressed.
*/

/** The device the music was last on, as the poll last saw it. */
let lastDeviceId = null;

const noActiveDevice = (err) => err?.reason === 'NO_ACTIVE_DEVICE'
  || (err?.status === 404 && /no active device/i.test(err?.message || ''));

/**
 * Which listed device to bring back.
 *
 * One Spotify can still drive (a restricted one cannot be), preferring one
 * that is somehow still active, then the one the music was last on, then a
 * computer — where a streamer's music usually is — then whatever is there.
 */
export function pickDevice(devices, lastId) {
  const usable = (devices || []).filter((d) => d?.id && !d.is_restricted);
  return usable.find((d) => d.is_active)
    || usable.find((d) => d.id === lastId)
    || usable.find((d) => d.type === 'Computer')
    || usable[0]
    || null;
}

/** Hand playback back to a device, playing or not. Refused, in words a screen can say, when there is none. */
async function wake(play) {
  const listed = await api('/me/player/devices');
  const device = pickDevice(listed?.devices, lastDeviceId);
  if (!device) {
    throw refusal('spotify_no_device', 'Spotify is not open on any device. Open it and the buttons work again.');
  }
  await api('/me/player', { method: 'PUT', body: { device_ids: [device.id], play } });
  lastDeviceId = device.id;
  log.info(`brought playback back to ${device.name || device.type || 'a device'}${play ? ', playing' : ''}`);
  return device;
}

/** The same command, aimed at one device rather than whichever is active. */
const onDevice = (endpoint, id) => `${endpoint}${endpoint.includes('?') ? '&' : '?'}device_id=${encodeURIComponent(id)}`;

/**
 * A player command that brings Spotify back first if it has let go.
 *
 * `resumes` is for play: handing playback back with play on is the press
 * itself, so there is nothing left to send. `idleIsDone` is for pause: with
 * no active device nothing is playing, which is what was asked for.
 */
async function command(endpoint, method, { resumes = false, idleIsDone = false } = {}) {
  try {
    return await api(endpoint, { method });
  } catch (err) {
    if (!noActiveDevice(err)) throw err;
    if (idleIsDone) return null;
    const device = await wake(resumes);
    if (resumes) return null;
    return api(onDevice(endpoint, device.id), { method });
  }
}

export async function start() {
  stop();
  await accessToken();
  consecutivePollFailures = 0;
  setStatus('connected');
  await poll();
  pollTimer = setInterval(() => poll().catch(onPollFailure), config.spotify.pollIntervalMs);
  log.info(`polling every ${config.spotify.pollIntervalMs}ms`);
}

/**
 * Separates "Spotify is briefly unreachable" from "this authorisation is dead".
 * The first recovers on its own and should not tear down a working connection;
 * the second never recovers, and polling on regardless — while the UI reports
 * everything is fine — is exactly how the failure stayed invisible.
 */
function onPollFailure(err) {
  const msg = err?.message ?? String(err);
  consecutivePollFailures += 1;

  if (err?.fatal) {
    log.error(`authorisation is no longer valid (${msg}) — reconnect Spotify from the Connections screen`);
    stop();
    return;
  }

  if (consecutivePollFailures === POLL_FAILURE_LIMIT) {
    // Keep polling, since a network blip heals by itself — but stop telling the
    // UI the connection is healthy, and say so once instead of every few seconds.
    log.warn(`Now Playing has failed ${POLL_FAILURE_LIMIT} times running (${msg}) — reporting Spotify offline until it recovers`);
    setStatus('disconnected');
  } else {
    log.debug('poll failed:', msg);
  }
}

export function stop() {
  clearInterval(pollTimer);
  cancelRefresh();
  // Nothing we were steering toward survives the connection going away.
  forgetWanted();
  pollTimer = null;
  consecutivePollFailures = 0;
  setStatus('disconnected');
}

async function poll() {
  /*
    The whole player rather than currently-playing: the same track, progress
    and play state, for the same one request, plus which device it is on —
    which is what a press needs to bring the music back once Spotify lets go.
  */
  const data = await api('/me/player');
  if (data?.device?.id) lastDeviceId = data.device.id;

  // Spotify answered, so clear any failure streak and undo the offline
  // downgrade that streak may have applied.
  if (consecutivePollFailures > 0) {
    log.info('Now Playing recovered');
    consecutivePollFailures = 0;
  }
  if (status !== 'connected') setStatus('connected');

  if (!data || !data.item) {
    if (track !== null) {
      track = null;
      bus.emit(EVENTS.STATUS, { platform: 'spotify', status, track: null, upNext });
    }
    return;
  }

  const next = {
    id: data.item.id,
    name: data.item.name,
    artist: (data.item.artists || []).map((a) => a.name).join(', '),
    album: data.item.album?.name ?? '',
    coverUrl: data.item.album?.images?.[0]?.url ?? '',
    duration: data.item.duration_ms,
    progress: data.progress_ms,
    isPlaying: data.is_playing,
  };

  const changed = next.id !== prevTrackId;
  const playStateChanged = prevIsPlaying !== null && next.isPlaying !== prevIsPlaying;

  track = next;
  bus.emit(EVENTS.STATUS, { platform: 'spotify', status, track: next, upNext });

  if (changed && prevTrackId !== null) {
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'spotify_track_change', platform: 'spotify', user: next.artist,
      data: { title: next.name, artist: next.artist, album: next.album, coverUrl: next.coverUrl },
    }));
  }

  if (playStateChanged) {
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: next.isPlaying ? 'spotify_played' : 'spotify_paused',
      platform: 'spotify', user: next.artist,
      data: { title: next.name, artist: next.artist },
    }));
  }

  // Refreshed on a track change, and otherwise on a slow timer.
  //
  // The timer matters: someone adding to the queue — a viewer through a song
  // request, or you in the Spotify app — changes what is up next WITHOUT
  // changing the track, so refreshing only on a change left the omnibar
  // showing the old answer until the current song ended. Still far short of
  // once per poll: about two extra calls a minute against the twenty the Now
  // Playing poll already makes.
  const dueForRefresh = Date.now() - lastUpNextAt > UPNEXT_REFRESH_MS;
  if (changed || dueForRefresh) {
    lastUpNextAt = Date.now();
    refreshUpNext().catch(() => {});
  }

  prevTrackId = next.id;
  prevIsPlaying = next.isPlaying;
}

/**
 * What Spotify says is coming after the current track.
 *
 * Read from /me/player/queue, which is Spotify's own answer rather than
 * anything computed here — so it already accounts for shuffle, for a playlist
 * or album playing through, and for autoplay/radio once a context runs out.
 * That also means it is honest about the one case with no answer: a single
 * track playing with nothing queued and autoplay off returns an empty queue,
 * and this stays null rather than inventing something.
 */
/**
 * Choose the next track out of a /me/player/queue response.
 *
 * Pure, and exported, because the two things that go wrong here are both
 * shape problems rather than network problems.
 *
 * Spotify does NOT document whether `queue` excludes what is playing — the
 * reference lists `currently_playing` and `queue` as separate fields and says
 * nothing about the relationship. In practice the current track does turn up
 * at the head of `queue`, and a read taken just after a skip returns the
 * pre-skip queue, whose head is the track that has just become current.
 * Either way the naive `queue[0]` answers with the song already playing,
 * which is exactly the "up next never changes" symptom.
 *
 * So: skip any leading entries that are the current track, and take the first
 * one that is genuinely different.
 */
export function pickUpNext(data, currentId) {
  const skipIds = new Set([currentId, data?.currently_playing?.id].filter(Boolean));
  const first = (data?.queue || []).find((item) => item?.id && !skipIds.has(item.id));
  if (!first) return null;
  return {
    id: first.id,
    name: first.name,
    artist: (first.artists || []).map((a) => a.name).join(', '),
    album: first.album?.name ?? '',
    coverUrl: first.album?.images?.[0]?.url ?? '',
    url: first.external_urls?.spotify ?? '',
  };
}

/**
 * Only the most recently issued queue read may publish its answer.
 *
 * A skip fires two of these — one from the track change inside poll(), one
 * from settleAfterSkip — and without a guard whichever RESOLVES last wins
 * rather than whichever was ASKED last. The older, pre-skip answer landing
 * second is another way up-next gets stuck on a stale song.
 */
let upNextSeq = 0;

async function refreshUpNext() {
  const ticket = ++upNextSeq;
  let next = null;
  try {
    next = pickUpNext(await api('/me/player/queue'), track?.id);
  } catch (err) {
    // A queue read failing must not take Now Playing down with it: the
    // endpoint needs an active device and 404s when there is none.
    log.debug('up-next read failed:', err?.message || err);
    next = null;
  }

  if (ticket !== upNextSeq) {
    log.debug('discarding a queue read that a newer one has already superseded');
    return upNext;
  }

  upNext = next;
  bus.emit(EVENTS.STATUS, { platform: 'spotify', status, track, upNext });
  return upNext;
}

/** What is playing next, for `{spotify.nextTrack}` and the omnibar slot. */
export const getUpNext = () => upNext;

/**
 * Re-read Now Playing straight after telling Spotify to do something.
 *
 * The poll interval is fine for watching a track play out, but it is the wrong
 * thing to wait on after a deliberate action: pressing skip and then watching
 * the old song sit there for up to three seconds reads as a broken button.
 *
 * Asked more than once because the change is not instant on Spotify's side —
 * the command goes to their servers, which relay it to whichever device is
 * actually playing, and "currently playing" can still answer with the previous
 * track for a moment afterwards. The first answer that differs from what we
 * had cancels the rest, so the usual case costs a single extra request.
 */
const CONTROL_REFRESH_MS = [200, 800, 1800];
let refreshTimers = [];

function cancelRefresh() {
  for (const timer of refreshTimers) clearTimeout(timer);
  refreshTimers = [];
}

function refreshAfterControl() {
  // Nothing to refresh into when the poller is not running.
  if (!pollTimer) return;

  cancelRefresh();
  const wasTrack = prevTrackId;
  const wasPlaying = prevIsPlaying;

  refreshTimers = CONTROL_REFRESH_MS.map((ms) => setTimeout(async () => {
    try {
      await poll();
      if (prevTrackId !== wasTrack || prevIsPlaying !== wasPlaying) cancelRefresh();
    } catch (err) {
      onPollFailure(err);
    }
  }, ms));
}

/** Re-read Now Playing now, for an explicit "refresh" from a surface. */
export async function refreshNow() {
  if (status !== 'connected') return null;
  await poll();
  return track;
}

/**
 * The whole player, for the operations that have to know where they are
 * starting from — how loud it is now, whether shuffle is already on.
 *
 * The poll reads currently-playing, which carries the track and nothing about
 * the device, so this is fetched when one of those is pressed rather than kept
 * up to date three times a minute for the once an hour it is wanted.
 */
async function player() {
  const state = await api('/me/player');
  if (state) {
    if (state.device?.id) lastDeviceId = state.device.id;
    return state;
  }
  // Let go of: bring it back without starting the music, and read it again.
  const device = await wake(false);
  return (await api('/me/player')) || { device, is_playing: false };
}

/** How much a press moves the volume. A tenth: ten presses, silence to full. */
const VOLUME_STEP = 10;

export async function control(operation) {
  const result = await (async () => {
    switch (operation) {
      case 'play': return command('/me/player/play', 'PUT', { resumes: true });
      case 'pause': return command('/me/player/pause', 'PUT', { idleIsDone: true });
      case 'next': return command('/me/player/next', 'POST');
      case 'previous': return command('/me/player/previous', 'POST');

      /*
        One button for both, because on a dock it is one button: the thing you
        press to stop the music is the thing you press to start it again, and
        two buttons where one would do costs a cell and makes you read them.

        What it is doing now comes from the poll where that is current, and from
        the player itself where it is not — pressing pause on something already
        paused is a press that appeared to do nothing.
      */
      case 'toggle': return queued(async () => {
        // Nobody active is nothing playing: the press is a play, and brings it back.
        const playing = stillFresh() && wanted.playing !== null
          ? wanted.playing
          : (track ? track.isPlaying : Boolean((await api('/me/player'))?.is_playing));
        const answer = playing
          ? await command('/me/player/pause', 'PUT', { idleIsDone: true })
          : await command('/me/player/play', 'PUT', { resumes: true });
        remember({ playing: !playing });
        return answer;
      });

      case 'volume_up':
      case 'volume_down': return queued(async () => {
        const from = stillFresh() && wanted.volume !== null
          ? wanted.volume
          : (await player()).device?.volume_percent;
        if (typeof from !== 'number') throw new Error('Spotify: this device has no volume to set');
        const step = operation === 'volume_up' ? VOLUME_STEP : -VOLUME_STEP;
        const next = Math.max(0, Math.min(100, from + step));
        const answer = await command(`/me/player/volume?volume_percent=${next}`, 'PUT');
        remember({ volume: next });
        return answer;
      });

      case 'shuffle': return queued(async () => {
        const on = stillFresh() && wanted.shuffle !== null
          ? wanted.shuffle
          : Boolean((await player()).shuffle_state);
        const answer = await command(`/me/player/shuffle?state=${on ? 'false' : 'true'}`, 'PUT');
        remember({ shuffle: !on });
        return answer;
      });

      /*
        Off, then the whole context, then the one track, then off again — the
        order the Spotify clients themselves cycle, so the button agrees with
        whatever else somebody has open.
      */
      case 'repeat': return queued(async () => {
        const state = stillFresh() && wanted.repeat !== null
          ? wanted.repeat
          : (await player()).repeat_state;
        const next = state === 'off' ? 'context' : state === 'context' ? 'track' : 'off';
        const answer = await command(`/me/player/repeat?state=${next}`, 'PUT');
        remember({ repeat: next });
        return answer;
      });

      default: throw new Error(`Spotify: unknown operation "${operation}"`);
    }
  })();

  /*
    Only what a viewer can see is worth chasing. Each of these schedules three
    extra polls, and volume, shuffle and repeat change nothing on any overlay —
    so pressing volume four times used to cost twelve polls to show the same
    picture, on top of the one already running every three seconds.
  */
  if (CHANGES_THE_VIEW.includes(operation)) refreshAfterControl();
  return result;
}

/** What is playing right now, for `{spotify.track}` and friends. */
export const getNowPlaying = () => track;

/** The track id inside a Spotify URI or an open.spotify.com link. */
function trackIdFrom(text) {
  const uri = /^spotify:track:([A-Za-z0-9]+)/.exec(text);
  if (uri) return uri[1];
  const url = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/.exec(text);
  return url ? url[1] : null;
}

/**
 * Add a track to the queue, and say what it was.
 *
 * Takes a link, a `spotify:track:` URI, or just a song name: a viewer typing
 * "!sr bohemian rhapsody" is the normal case, and passing that straight to the
 * queue endpoint as a URI simply fails. Anything that is not a link is looked
 * up first and the best match is queued.
 *
 * Returns the track so an action can announce it — which is what V2's
 * `{spotify.queuedTrack}` and `{spotify.queuedArtist}` were for.
 */
export async function queue(input) {
  const text = String(input ?? '').trim();
  if (!text) return null;

  const id = trackIdFrom(text);
  let found;

  if (id) {
    found = await api(`/tracks/${id}`);
  } else {
    const results = await api(`/search?q=${encodeURIComponent(text)}&type=track&limit=1`);
    found = results?.tracks?.items?.[0] ?? null;
  }

  if (!found?.uri) throw new Error(`Spotify: nothing found for "${text}"`);

  // A song request while Spotify has let go would fail the same way a press does.
  await command(`/me/player/queue?uri=${encodeURIComponent(found.uri)}`, 'POST');

  const queued = {
    id: found.id,
    name: found.name,
    artist: (found.artists || []).map((a) => a.name).join(', '),
    album: found.album?.name ?? '',
    url: found.external_urls?.spotify ?? '',
    uri: found.uri,
  };
  log.info(`queued "${queued.name}" by ${queued.artist}`);
  return queued;
}

/**
 * Wait for Now Playing to catch up after a skip, then report it.
 *
 * A reply that says "now playing X" runs immediately after the skip command,
 * and Spotify has not switched tracks yet at that point — so without this the
 * announcement names the song that was just skipped.
 */
export async function settleAfterSkip(timeoutMs = 1500) {
  const before = prevTrackId;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      await poll();
    } catch { /* the regular poller reports failures */ }
    if (prevTrackId !== before) break;
  }
  // The skip consumed the head of the queue; what is next has moved on too.
  await refreshUpNext().catch(() => {});
  return track;
}

export function logout() {
  stop();
  tokens.set({ accessToken: '', refreshToken: '', expiresAt: 0 });
  track = null;
  upNext = null;
  lastUpNextAt = 0;
  prevTrackId = null;
  prevIsPlaying = null;
}

/**
 * What the engine is handed as `services.spotify`.
 *
 * getNowPlaying belongs here: the engine calls it on every command and event
 * to fill {spotify.track} and friends. It was exported from this module but
 * left out of this object, so the call returned undefined and every template
 * rendered an empty string with no error anywhere.
 */
export const service = { control, queue, getNowPlaying, settleAfterSkip, getUpNext };
