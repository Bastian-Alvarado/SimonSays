/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * YouTube live chat.
 *
 * Shaped like the Spotify module because the flow is the same: a client id and
 * secret from the Connections screen, an authorisation code exchanged once for
 * a refresh token, and a poll from then on.
 *
 * What YouTube gives, and what it does not
 * ----------------------------------------
 * The live chat API carries messages, new members, gifted memberships and
 * Super Chats. It carries NO event for somebody subscribing for free, and the
 * author of a message says whether they are a member (`isChatSponsor`) but
 * never whether they are a subscriber. Subscriber counts are rounded to three
 * significant figures above a thousand, so watching the number is no
 * substitute — you cannot see one arrive.
 *
 * So this app has no YouTube follow event, because there is nothing to raise
 * one from. An alert offered for it would be a line in a menu that can never
 * fire, which is worse than an absence you can see and understand.
 *
 * The mapping, which shared/platforms.js explains and this must obey:
 *
 *   YouTube member (isChatSponsor)  ->  isSub    they pay you
 *   YouTube subscriber (free)       ->  nothing  the API never says
 *
 * Reading chat needs youtube.readonly; changing the broadcast's title and
 * description needs youtube.force-ssl, which covers reading as well and is
 * what is asked for now. An account linked before that has only the first,
 * so what it granted is kept, and the Connections screen asks for one more
 * sign-in rather than letting a title change fail on stream.
 */
import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseChat, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { config } from '../config.js';
import { isYoutubeCategory, youtubeCategoryName } from '../../shared/youtube-categories.js';
import { defaultNameColour } from '../../shared/platforms.js';
import { twitchLive, onTwitchLive } from '../core/twitch-live.js';
import { refusal } from '../core/refusal.js';

const log = createLogger('youtube');

const AUTH = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/youtube/v3';

export const SCOPES = 'https://www.googleapis.com/auth/youtube.force-ssl';

/** Either of these lets the broadcast's details be written. */
const EDIT_SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/youtube'];

/*
  Whether the linked account granted a scope that can write. Tokens saved
  before the scope was recorded have none, which reads as no — correctly,
  since those were only ever asked for youtube.readonly.
*/
const canEdit = () => {
  const granted = String(tokens?.get().scope || '').split(/\s+/);
  return EDIT_SCOPES.some((scope) => granted.includes(scope));
};

let tokens = null;
let settings = null;
let usage = null;

/*
  The day's allowance, as this app spends it. Every call costs units from the
  project's 10,000 a day (YouTube's default), and posting a message costs ten
  reads of chat: 50 against 5. Counted here, by YouTube's price list, so what
  is left can be shown before a message is spent — an estimate, since
  YouTube only says so once it is gone. A day is California's, as YouTube
  counts it.
*/
export const YOUTUBE_DAILY_UNITS = 10_000;
export const YOUTUBE_SEND_UNITS = 50;
const COSTS = [
  ['POST', '/liveChat/messages', YOUTUBE_SEND_UNITS],
  ['GET', '/liveChat/messages', 5],
  ['PUT', '/videos', 50],
  ['POST', '/liveChat/bans', 200],
];
export const unitsFor = (method, endpoint) => COSTS.find(([m, path]) => m === method && endpoint.startsWith(path))?.[2] ?? 1;

/** The day YouTube is counting, as YYYY-MM-DD in California. */
export function youtubeDay(now = Date.now()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Date(now - 8 * 3_600_000).toISOString().slice(0, 10);
  }
}

function spend(units) {
  if (!usage) return;
  const day = youtubeDay();
  const now = usage.get();
  usage.set({ day, units: (now.day === day ? now.units : 0) + units });
}

/** What has been spent today, what is left, and how many messages that would still post. */
export function usageToday() {
  const now = usage?.get() || {};
  const used = now.day === youtubeDay() ? now.units || 0 : 0;
  const left = Math.max(0, YOUTUBE_DAILY_UNITS - used);
  return { used, left, limit: YOUTUBE_DAILY_UNITS, messagesLeft: Math.floor(left / YOUTUBE_SEND_UNITS) };
}

/** Told to every screen as a stat — small, unlike the connection details — when it has moved on. */
let announcedUnits = -1;
function announceUsage(force = false) {
  const { used } = usageToday();
  if (!force && Math.abs(used - announcedUnits) < 100) return;
  announcedUnits = used;
  bus.emit(EVENTS.STAT, { key: 'youtubeUnitsUsed', value: used });
}

/*
  What this app posted, by the id YouTube gave it: shown at once when it is
  sent, so the copy that comes back on the next read of chat is skipped.
*/
const posted = new Set();
let chatTimer = null;
let viewerTimer = null;
let status = 'disconnected';

/** Where we are in the chat, and which chat it is. */
let liveChatId = null;
let videoId = null;
let pageToken = null;

/*
  YouTube says how often to come back, and means it: polling faster spends
  quota for nothing and gets an app throttled. Its number is used, with a floor
  so that a zero cannot turn this into a spin.
*/
/*
  Every read of chat is spent from a daily allowance — 10,000 units by
  default, several of them per read — so how often this asks is how many
  hours of chat a day buys. At YouTube's own pace, every few seconds, the
  allowance ran out inside two hours and chat simply stopped arriving. Seven
  seconds is the floor: messages land a few seconds later, and a normal
  stream's worth of chat fits in a day.
*/
const MIN_POLL_MS = 7000;
const VIEWER_POLL_MS = 30_000;
/*
  Not live: how often to look for a broadcast. It used to be every minute,
  and with the channel name read again each time that alone spent over a
  quarter of the day's allowance with nobody streaming. Three minutes still
  finds a stream moments after it starts.
*/
const WAIT_MS = 180_000;
/* After a failure that is not the allowance — a network blip, a chat that ended. */
const RETRY_MS = 60_000;

/*
  Only while the Twitch stream is live (server/core/twitch-live.js): YouTube
  is where that stream is also sent, so with Twitch not live there is no
  broadcast to find, and every look is allowance spent for nothing. Twitch
  going live is looked at once, then every minute for ten minutes —
  YouTube's broadcast tends to start a beat after — then every three. With
  Twitch not connected, nobody can say, and it looks every three minutes as
  it always did.

  Reading a chat already, Twitch stopping is given five minutes before the
  reading stops with it: a stream that drops and comes straight back is
  not a stream that ended.
*/
const TWITCH_FAST_MS = 60_000;
const TWITCH_FAST_FOR_MS = 10 * 60_000;
const TWITCH_GRACE_MS = 5 * 60_000;
let graceTimer = null;

/** How long until the next look for a broadcast, or null for none until Twitch is live. */
function nextLook(now = Date.now()) {
  const tw = twitchLive();
  if (!tw.known) return WAIT_MS;
  if (!tw.live) return null;
  return now - tw.since < TWITCH_FAST_FOR_MS ? TWITCH_FAST_MS : WAIT_MS;
}

/*
  The sign-in Google refused — expired or taken back — until it works
  again: a problem to show, not to cover with "waiting for Twitch".
*/
let authBroken = null;

/** Not looking: waiting on Twitch to go live, said once — unless the sign-in is what is wrong, which stays said. */
function pause() {
  clearTimeout(chatTimer);
  chatTimer = null;
  if (authBroken) {
    setStatus('disconnected');
    if (health.state !== 'error' || health.message !== authBroken) setHealth({ state: 'error', message: authBroken });
    return;
  }
  setStatus('connected');
  if (health.state !== 'paused') log.info('Twitch is not live — not looking for a YouTube broadcast until it is');
  setHealth({ state: 'paused' });
}

/*
  The first page of a chat is its backlog — everything said before we arrived.
  Replaying it would fire an alert for every member who joined while the app
  was shut, and fill the dock with an hour nobody was watching for.
*/
let seenFirstPage = false;

/*
  Whose account this is, so the screen can say so rather than only that
  something is connected. Read once when the connection is made and kept, since
  it is identity rather than state — and looked up here rather than when asked
  for, because the screen asks on every broadcast.
*/
let channel = null;

const clientId = () => settings?.get().clientId || config.youtube?.clientId || '';
const clientSecret = () => settings?.get().clientSecret || config.youtube?.clientSecret || '';

export const getSettings = () => ({
  clientId: clientId(),
  hasSecret: Boolean(clientSecret()),
  authorised: Boolean(tokens?.get().refreshToken),
  canEdit: Boolean(tokens?.get().refreshToken) && canEdit(),
  channel,
  // Whether there is a chat to post in right now. What is left of the day travels as the youtubeUnitsUsed stat:
  // these details go out whole whenever any platform changes, and are not small.
  live: Boolean(liveChatId),
  health: tokens?.get().refreshToken ? health : { state: 'off' },
});
export const setSettings = (patch) => settings.set({ ...settings.get(), ...patch });
export const getStatus = () => status;
export const isAuthorised = () => Boolean(tokens?.get().refreshToken);

function setStatus(next) {
  if (status === next) return;
  status = next;
  bus.emit(EVENTS.STATUS, { platform: 'youtube', status });
}

/*
  What the connection is actually doing, which "connected" and "disconnected"
  never said: reading chat, waiting for a broadcast, out of allowance until
  the reset, or failing for some other reason. The Connections screen shows
  it, so whether YouTube chat is working is something you can see rather than
  something you find out about after a stream.

  Changed only on a real transition, never per message: it travels with the
  connection details, which are not small.
*/
let health = { state: 'off' };
function setHealth(next) {
  health = { ...next, at: Date.now() };
  // A status event is what carries the connection details to every screen.
  bus.emit(EVENTS.STATUS, { platform: 'youtube', status });
}

/** Whether YouTube refused because the day's allowance is spent. */
const isQuota = (err) => /quota/i.test(`${err?.reason || ''} ${err?.message || ''}`);

/**
 * When the allowance comes back: midnight in California, where YouTube
 * counts its days. A minute's grace after it, so the first knock lands on
 * the new day rather than the last second of the old one.
 */
export function nextQuotaReset(now = Date.now()) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, Number(p.value)]));
    // How far California is from UTC right now, daylight saving included.
    const there = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offset = there - Math.floor(now / 1000) * 1000;
    return Date.UTC(parts.year, parts.month - 1, parts.day + 1) - offset + 60_000;
  } catch {
    // No time zone data: Pacific standard time is close enough to wait on.
    const day = 86_400_000;
    return Math.floor((now - 8 * 3_600_000) / day) * day + day + 8 * 3_600_000 + 60_000;
  }
}

export function initYouTube() {
  tokens = collection('youtube_tokens', { accessToken: '', refreshToken: '', expiresAt: 0 });
  settings = collection('youtube_settings', { clientId: '', clientSecret: '' });
  usage = collection('youtube_usage', { day: '', units: 0 });
  announceUsage(true);
  watchTwitch();
  if (tokens.get().refreshToken) {
    // Twitch already known not to be live: nothing to look for yet.
    if (nextLook() === null) { pause(); return; }
    // Through onFailure, so a start that fails at boot is tried again like any other.
    start().catch(onFailure);
  }
}

/*
  Follows Twitch: live, look at once; not live, stop looking — and stop
  reading a chat after the grace — and not known, look as before. Out of
  allowance, nothing changes: that waits for the reset, whatever Twitch does.
*/
let watchingTwitch = false;
function watchTwitch() {
  if (watchingTwitch) return;
  watchingTwitch = true;
  onTwitchLive((tw, { wentLive }) => {
    if (!tokens?.get().refreshToken || health.state === 'quota') return;
    if (tw.live) {
      clearTimeout(graceTimer);
      graceTimer = null;
      if (wentLive && !liveChatId) start().catch(onFailure);
      return;
    }
    if (tw.known) {
      if (!liveChatId) { pause(); return; }
      clearTimeout(graceTimer);
      graceTimer = setTimeout(() => {
        graceTimer = null;
        if (twitchLive().known && !twitchLive().live) { log.info('Twitch stopped five minutes ago — stopped reading YouTube chat'); stop(); pause(); }
      }, TWITCH_GRACE_MS);
      graceTimer.unref?.();
      return;
    }
    // Twitch gone: nobody can say, so look as before.
    if (health.state === 'paused') start().catch(onFailure);
  });
}

async function accessToken() {
  const t = tokens.get();
  if (!t.refreshToken) throw new Error('YouTube: not authenticated');
  if (Date.now() > t.expiresAt - 60_000) await refresh();
  return tokens.get().accessToken;
}

async function refresh() {
  const t = tokens.get();
  const res = await fetch(AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    authBroken = `YouTube auth failed: ${json.error_description || json.error}`;
    throw new Error(authBroken);
  }
  authBroken = null;
  tokens.set({
    ...t,
    accessToken: json.access_token,
    // A refresh response carries no new refresh token; the stored one stands.
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
  });
}

async function api(endpoint, { method = 'GET', body } = {}) {
  const token = await accessToken();
  // Spent whether or not it works: YouTube charges for a refused call too.
  spend(unitsFor(method, endpoint));
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`YouTube ${res.status}: ${json?.error?.message || text}`);
    // quotaExceeded, liveChatEnded and the like: what to do next depends on it.
    err.reason = json?.error?.errors?.[0]?.reason || '';
    throw err;
  }
  return json;
}

export async function exchangeCode(code, redirectUri) {
  if (!clientId() || !clientSecret()) {
    throw new Error('YouTube: client id and secret are not set — add them on the Connections screen');
  }
  const res = await fetch(AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`YouTube auth failed: ${json.error_description || json.error}`);
  /*
    Google returns a refresh token only on the first consent, and only when
    asked for offline access. Without one this would work until the hour was
    up and then quietly stop, so it is refused here instead.
  */
  if (!json.refresh_token) {
    throw new Error('YouTube returned no refresh token — sign in again and allow offline access');
  }
  // Signed in afresh: whatever was wrong with the old sign-in is behind it.
  authBroken = null;
  tokens.set({
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
    // What was actually granted, which can be less than what was asked for.
    scope: String(json.scope || ''),
  });
  log.info('authorised');
  await start();
  return true;
}

export function logout() {
  authBroken = null;
  stop();
  channel = null;
  health = { state: 'off' };
  tokens.set({ accessToken: '', refreshToken: '', expiresAt: 0 });
}

/** The broadcast that is live now, if there is one. */
async function findLiveChat() {
  const live = await api('/liveBroadcasts?part=snippet,status&broadcastStatus=active&broadcastType=all&maxResults=1');
  const item = (live?.items || [])[0];
  if (!item) return null;
  return { chatId: item.snippet?.liveChatId || null, videoId: item.id || null };
}

/**
 * Say which category the stream is in, for the dock button that shows it and
 * a text source that wants it: the id, which the button picks its picture by,
 * and the name, which is what anybody reading it wants.
 */
function announceCategory(id) {
  if (!id) return;
  bus.emit(EVENTS.STAT, { key: 'youtubeCategoryId', value: String(id) });
  bus.emit(EVENTS.STAT, { key: 'youtubeCategory', value: youtubeCategoryName(id) });
}

/**
 * The video a title change is for: the broadcast on air, or failing that the
 * next one scheduled — so a title can be set before going live, which is
 * when it matters most.
 */
async function targetVideo() {
  if (videoId) return videoId;
  const live = await findLiveChat();
  if (live?.videoId) return live.videoId;
  const upcoming = await api('/liveBroadcasts?part=snippet&broadcastStatus=upcoming&broadcastType=all&maxResults=10');
  const soonest = (upcoming?.items || [])
    .slice()
    .sort((a, b) => String(a.snippet?.scheduledStartTime || '').localeCompare(String(b.snippet?.scheduledStartTime || '')))[0];
  return soonest?.id || null;
}

/*
  YouTube refuses angle brackets in either field, and measures the description
  in bytes. Cut to the byte limit, then drop whatever half a character the cut
  left behind.
*/
const noBrackets = (text) => String(text ?? '').replace(/[<>]/g, '');
const toBytes = (text, max) => Buffer.from(text).subarray(0, max).toString().replace(/\uFFFD+$/, '');

/**
 * Change the title, the description, the category, or several at once.
 *
 * The category is a toggle: given two, it moves to whichever one it is not
 * on, and from anything else to the first — so one dock button can flip a
 * stream between Gaming and People & Blogs. Given one, it simply sets it.
 *
 * A video's snippet is replaced whole, not merged: a request carrying only a
 * title would wipe the description, the tags and the language. So the current
 * one is read first and only the asked-for fields are changed in it.
 */
export async function setDetails({ title, description, toggleCategory } = {}) {
  if (!isAuthorised()) throw new Error('YouTube: not connected');
  if (!canEdit()) {
    throw new Error('YouTube: sign in again on the Connections screen to allow changing the title and description');
  }
  const id = await targetVideo();
  if (!id) throw new Error('YouTube: there is no live or scheduled broadcast to change');

  const found = await api(`/videos?part=snippet&id=${encodeURIComponent(id)}`);
  const snippet = (found?.items || [])[0]?.snippet;
  if (!snippet) throw new Error('YouTube: the broadcast could not be read');

  const next = { title: snippet.title || '', description: snippet.description || '', categoryId: snippet.categoryId };
  for (const key of ['tags', 'defaultLanguage', 'defaultAudioLanguage']) {
    if (snippet[key] !== undefined) next[key] = snippet[key];
  }
  if (title !== undefined) next.title = noBrackets(title).replace(/\s+/g, ' ').trim().slice(0, 100);
  if (description !== undefined) next.description = toBytes(noBrackets(description), 5000);
  if (toggleCategory) {
    const [first, second] = toggleCategory.map((id) => String(id ?? '').trim());
    if (!isYoutubeCategory(first)) throw new Error(`YouTube: "${first}" is not a category`);
    const other = isYoutubeCategory(second) && second !== first ? second : '';
    next.categoryId = other && String(snippet.categoryId) === first ? other : first;
  }
  if (!next.title) throw new Error('YouTube: a title cannot be empty');

  await api('/videos?part=snippet', { method: 'PUT', body: { id, snippet: next } });
  announceCategory(next.categoryId);
  log.info(title !== undefined ? `title set: ${next.title}`
    : description !== undefined ? 'description set'
      : `category set: ${next.categoryId}`);
  return next;
}

/*
  Which start this is. Twitch going live can start YouTube while another
  start is still waiting on Google; each is numbered, and stop() or a newer
  start retires the older — whatever it was waiting for, it stops there —
  so only one ever reads chat, and only once.
*/
let run = 0;

export async function start() {
  stop();
  const mine = run;
  try {
    await startRun(mine);
  } catch (err) {
    // A retired start's failure is nobody's business: the one that retired it carries on.
    if (mine !== run) return;
    throw err;
  }
}

async function startRun(mine) {
  await accessToken();
  if (mine !== run) return;

  /*
    Decoration, so it must never be the reason chat does not start: a channel
    whose name cannot be read is still a channel whose chat can be. Read once,
    not on every look for a broadcast — it is identity, and it was a unit of
    the day's allowance spent every minute to learn nothing new.
  */
  if (!channel) try {
    const me = await api('/channels?part=snippet&mine=true&maxResults=1');
    const item = (me?.items || [])[0];
    if (item) {
      channel = {
        title: item.snippet?.title || '',
        avatar: item.snippet?.thumbnails?.default?.url || '',
      };
    }
  } catch (err) {
    log.warn('could not read the channel name:', err.message);
  }
  if (mine !== run) return;

  const found = await findLiveChat();
  if (mine !== run) return;
  if (!found?.chatId) {
    /*
      Authorised, but not streaming. Connected is the honest word: the account
      is linked, and this looks again in a minute so that starting a broadcast
      is all anybody has to do.
    */
    const wait = nextLook();
    if (wait === null) { pause(); return; }
    setStatus('connected');
    if (health.state !== 'waiting') log.info('authorised — waiting for a live broadcast');
    setHealth({ state: 'waiting', nextCheckAt: Date.now() + wait });
    chatTimer = setTimeout(() => start().catch(onFailure), wait);
    return;
  }

  liveChatId = found.chatId;
  videoId = found.videoId;
  pageToken = null;
  seenFirstPage = false;
  setStatus('connected');
  log.info('live chat found — reading');
  setHealth({ state: 'reading', since: Date.now(), everyMs: MIN_POLL_MS });

  /*
    Which category it went live in, read once, so the dock button says the
    right thing before anybody has pressed it. Decoration again: chat does not
    wait on it and does not fail with it.
  */
  api(`/videos?part=snippet&id=${encodeURIComponent(videoId)}`)
    .then((found) => announceCategory((found?.items || [])[0]?.snippet?.categoryId))
    .catch((err) => log.warn('could not read the category:', err.message));

  await pollChat(mine);
  if (mine !== run) return;
  viewerTimer = setInterval(() => pollViewers().catch(() => {}), VIEWER_POLL_MS);
  await pollViewers().catch(() => {});
}

export function stop() {
  run += 1;
  clearTimeout(chatTimer);
  clearInterval(viewerTimer);
  chatTimer = null;
  viewerTimer = null;
  liveChatId = null;
  videoId = null;
  pageToken = null;
  seenFirstPage = false;
  // Not live any more, and nobody watching: the viewer counter drops YouTube's row.
  bus.emit(EVENTS.STAT, { key: 'youtubeViewers', value: 0 });
  bus.emit(EVENTS.STAT, { key: 'youtubeLive', value: false });
  setStatus('disconnected');
}

function onFailure(err) {
  stop();
  /*
    Out of allowance: nothing will work until the reset, and knocking every
    minute until then only fills the log. Wait for it, say so once, and say
    when it comes back.
  */
  if (isQuota(err)) {
    const resetsAt = nextQuotaReset();
    if (health.state !== 'quota') log.warn(`daily allowance used up — chat resumes after ${new Date(resetsAt).toISOString()}`);
    setHealth({ state: 'quota', resetsAt });
    chatTimer = setTimeout(() => start().catch(onFailure), Math.max(60_000, resetsAt - Date.now()));
    return;
  }
  // Twitch not live: a chat ending is the stream ending, and there is nothing to try again for.
  if (nextLook() === null) { pause(); return; }
  log.warn(err.message);
  setHealth({ state: 'error', message: String(err.message || '').slice(0, 200), nextCheckAt: Date.now() + RETRY_MS });
  // Quietly, and keep trying: a broadcast ending is the ordinary case here.
  chatTimer = setTimeout(() => start().catch(onFailure), RETRY_MS);
}

async function pollChat(mine = run) {
  if (!liveChatId || mine !== run) return;

  let data;
  try {
    data = await api(`/liveChat/messages?liveChatId=${encodeURIComponent(liveChatId)}`
      + '&part=snippet,authorDetails&maxResults=200'
      + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''));
  } catch (err) {
    if (mine === run) onFailure(err);
    return;
  }
  if (mine !== run) return;

  pageToken = data?.nextPageToken || null;
  const wait = Math.max(MIN_POLL_MS, Number(data?.pollingIntervalMillis) || MIN_POLL_MS);
  announceUsage();

  if (seenFirstPage) {
    for (const item of data?.items || []) handleMessage(item);
  }
  seenFirstPage = true;

  chatTimer = setTimeout(() => pollChat(mine).catch((err) => { if (mine === run) onFailure(err); }), wait);
}

/**
 * One live chat item, turned into whatever this app already understands.
 *
 * Exported so it can be driven with recorded shapes: the rest of this file
 * needs a live broadcast to say anything at all, and this is the part where
 * being wrong would be silent.
 */
export function handleMessage(item) {
  // Posted from here and shown when it was sent: this is the same message coming back.
  if (item?.id && posted.delete(item.id)) return;
  const snippet = item?.snippet || {};
  const author = item?.authorDetails || {};
  const user = author.displayName || 'someone';
  const avatar = author.profileImageUrl || '';

  /*
    isChatSponsor is membership — money — so it is this app's isSub. There is
    no field for a free subscriber, which is the whole reason there is no
    YouTube follow event.
  */
  const common = {
    platform: 'youtube',
    id: item?.id || null,
    user,
    userId: author.channelId || null,
    avatar,
    isMod: Boolean(author.isChatModerator),
    isSub: Boolean(author.isChatSponsor),
    isBroadcaster: Boolean(author.isChatOwner),
    // YouTube has no name colours: the one Twitch gives somebody who never chose, not white.
    color: defaultNameColour(user),
    // YouTube has no VIP. Said plainly rather than left out, so nothing
    // downstream has to wonder whether the platform simply forgot to mention.
    isVip: false,
  };

  switch (snippet.type) {
    case 'textMessageEvent':
      bus.emit(EVENTS.CHAT, normaliseChat({ ...common, msg: snippet.displayMessage || '' }));
      return;

    case 'superChatEvent':
    case 'superStickerEvent': {
      const details = snippet.superChatDetails || snippet.superStickerDetails || {};
      const comment = details.userComment || '';
      // The words go in chat as well as raising the event, the way a cheer does.
      if (comment) bus.emit(EVENTS.CHAT, normaliseChat({ ...common, msg: comment, highlighted: true }));
      bus.emit(EVENTS.EVENT, normaliseEvent({
        type: 'youtube_cheer',
        platform: 'youtube',
        user,
        avatar,
        data: { amount: details.amountDisplayString || '', message: comment, userId: common.userId || '' },
      }));
      return;
    }

    case 'newSponsorEvent':
      bus.emit(EVENTS.EVENT, normaliseEvent({
        type: 'youtube_sub',
        platform: 'youtube',
        user,
        avatar,
        data: { tier: snippet.newSponsorDetails?.memberLevelName || '', userId: common.userId || '' },
      }));
      return;

    case 'memberMilestoneChatEvent':
      bus.emit(EVENTS.EVENT, normaliseEvent({
        type: 'youtube_sub',
        platform: 'youtube',
        user,
        avatar,
        data: {
          months: snippet.memberMilestoneChatDetails?.memberMonth || 0,
          tier: snippet.memberMilestoneChatDetails?.memberLevelName || '',
          userId: common.userId || '',
        },
      }));
      return;

    case 'membershipGiftingEvent':
      bus.emit(EVENTS.EVENT, normaliseEvent({
        type: 'youtube_sub_gift_bulk',
        platform: 'youtube',
        user,
        avatar,
        data: {
          count: snippet.membershipGiftingDetails?.giftMembershipsCount || 1,
          tier: snippet.membershipGiftingDetails?.giftMembershipsLevelName || '',
        },
      }));
      return;

    default:
      // Deletions, bans, sponsor-only mode, and whatever YouTube adds next.
  }
}

async function pollViewers() {
  if (!videoId) return;
  const data = await api(`/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}`);
  const details = (data?.items || [])[0]?.liveStreamingDetails;
  if (!details) return;
  // Live until YouTube says the broadcast ended; one key at a time, the way TikTok reports its own.
  const live = !details.actualEndTime;
  bus.emit(EVENTS.STAT, { key: 'youtubeViewers', value: live ? Number(details.concurrentViewers) || 0 : 0 });
  bus.emit(EVENTS.STAT, { key: 'youtubeLive', value: live });
}

/** The longest message YouTube chat takes. */
export const YOUTUBE_CHAT_MAX = 200;

/**
 * Post a message in the live chat being read, as the linked channel.
 *
 * Refused, with a code a screen can say, when there is no chat to post in,
 * when the sign-in cannot write, when it is too long, and when the day's
 * allowance would not cover it — a message costs 50 units, ten reads of
 * chat. Shown in chat at once rather than when the next read brings it
 * back. `sentToBoth` marks one that went to Twitch as well, so a command in
 * it runs once, from Twitch's copy. `cut` is for an action's reply: trimmed
 * to fit rather than refused, since nobody is there to shorten it.
 */
/**
 * A YouTube channel by its id (UC…) or @handle, for linking somebody by hand
 * who has not chatted yet. One unit of the day's allowance. Null when it is
 * neither, YouTube is not signed in, or there is no such channel.
 */
export async function findChannel(query) {
  const q = String(query ?? '').trim();
  const byId = /^UC[\w-]{22}$/.test(q);
  const handle = /^@[\w.-]{3,30}$/.test(q) ? q : '';
  if ((!byId && !handle) || !isAuthorised()) return null;
  const data = await api(`/channels?part=snippet&${byId ? `id=${encodeURIComponent(q)}` : `forHandle=${encodeURIComponent(handle)}`}`);
  const c = data?.items?.[0];
  return c ? { id: c.id, name: c.snippet?.title || c.id, avatar: c.snippet?.thumbnails?.default?.url || '' } : null;
}

/**
 * Ban somebody from the live chat for good, or for `seconds`. Only while there
 * is a live chat, and it costs 200 units of the day's allowance.
 */
export async function ban(channelId, { seconds = 0 } = {}) {
  if (!isAuthorised()) throw refusal('youtube_offline', 'YouTube is not connected');
  if (!canEdit()) throw refusal('youtube_sign_in_again', 'YouTube: sign in again on the Connections screen to allow posting in chat');
  if (!liveChatId) throw refusal('youtube_not_live', 'YouTube: there is no live chat right now');
  if (usageToday().left < 200) throw refusal('youtube_quota', "YouTube: today's allowance is used up");
  try {
    await api('/liveChat/bans?part=snippet', {
      method: 'POST',
      body: { snippet: { liveChatId, type: seconds ? 'temporary' : 'permanent', ...(seconds ? { banDurationSeconds: String(Math.round(seconds)) } : {}), bannedUserDetails: { channelId: String(channelId) } } },
    });
  } finally {
    announceUsage(true);
  }
  return { ok: true };
}

export async function say(text, { sentToBoth = false, cut = false, quiet = false } = {}) {
  let line = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (cut && Array.from(line).length > YOUTUBE_CHAT_MAX) line = `${Array.from(line).slice(0, YOUTUBE_CHAT_MAX - 1).join('')}…`;
  if (!line) return null;
  if (!isAuthorised()) throw refusal('youtube_offline', 'YouTube is not connected');
  if (!canEdit()) throw refusal('youtube_sign_in_again', 'YouTube: sign in again on the Connections screen to allow posting in chat');
  if (!liveChatId) throw refusal('youtube_not_live', 'YouTube: there is no live chat to post in right now');
  if (Array.from(line).length > YOUTUBE_CHAT_MAX) throw refusal('youtube_too_long', `YouTube chat takes ${YOUTUBE_CHAT_MAX} characters at most`, { max: YOUTUBE_CHAT_MAX });
  if (usageToday().left < YOUTUBE_SEND_UNITS) throw refusal('youtube_quota', 'YouTube: today\'s allowance is used up');

  let sent;
  try {
    sent = await api('/liveChat/messages?part=snippet', {
      method: 'POST',
      body: { snippet: { liveChatId, type: 'textMessageEvent', textMessageDetails: { messageText: line } } },
    });
  } catch (err) {
    if (isQuota(err)) throw refusal('youtube_quota', 'YouTube: today\'s allowance is used up');
    throw err;
  } finally {
    announceUsage(true);
  }
  if (sent?.id) {
    posted.add(sent.id);
    if (posted.size > 200) posted.delete(posted.values().next().value);
  }
  // A line the relay copied from Discord: already on screen as the Discord message it came from.
  if (quiet) return sent;
  const name = channel?.title || 'YouTube';
  bus.emit(EVENTS.CHAT, normaliseChat({
    platform: 'youtube',
    id: sent?.id || null,
    user: name,
    avatar: channel?.avatar || '',
    isBroadcaster: true,
    color: defaultNameColour(name),
    msg: line,
    raw: sentToBoth ? { sentToBoth: true } : null,
  }));
  return sent;
}

/** What an action step may do to YouTube. */
export const service = {
  say: (text, opts) => say(text, opts),
  setTitle: (title) => setDetails({ title }),
  setDescription: (description) => setDetails({ description }),
  /** Resolves to the category the stream is in afterwards. */
  toggleCategory: (first, second) => setDetails({ toggleCategory: [first, second] }).then((next) => next.categoryId),
};
