/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * TikTok Live, via tiktok-live-connector v2.
 *
 * Two things were broken with the V2-era setup:
 *
 *   1. The library was pinned to 1.x, whose request-signing endpoint now
 *      returns 403. The room resolved but the connection could never be
 *      established.
 *   2. Liveness was decided by scraping `tiktok.com/@user/live` for
 *      `"status":2`. TikTok serves non-browser clients a ~1KB stub containing
 *      neither that marker nor `roomId`, so every channel looked offline and no
 *      connection was ever attempted.
 *
 * Now the connection attempt *is* the liveness test — the library raises
 * UserOfflineError when the creator is not streaming — and v2's real event
 * names are used.
 *
 * Every attempt spends a request against the signing service's rate limit,
 * so it only looks while the Twitch stream is live — TikTok is where that
 * stream is also sent (server/core/twitch-live.js):
 *
 *   Twitch not live               ->  no looking at all
 *   Twitch live                   ->  at once, every 30s for ten minutes
 *                                     (TikTok tends to go live a beat after
 *                                     Twitch does), then every two minutes
 *
 * Twitch not connected, nobody can say whether it is live, and OBS decides
 * as it did before:
 *
 *   OBS connected, not streaming  ->  no looking at all
 *   OBS streaming                 ->  the same timetable, from when OBS went live
 *   OBS not reachable             ->  every config.tiktok.pollIntervalMs, so
 *                                     it is never blind
 *
 * A TikTok stream started without either is still found by pressing Connect.
 * Once connected it stays connected until that stream ends, whatever Twitch
 * does: being connected costs nothing.
 */

import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseChat, normaliseEvent } from '../core/bus.js';
import { defaultNameColour } from '../../shared/platforms.js';
import { createLogger } from '../core/logger.js';
import { config } from '../config.js';
import { twitchLive, onTwitchLive } from '../core/twitch-live.js';

const log = createLogger('tiktok');

let creds = null;
let connection = null;
let channel = null;
let status = 'disconnected';
let lastError = null;
let pollTimer = null;
let isLive = false;
/*
  Whether anyone asked for TikTok. Pressing Disconnect means stay away until
  Connect is pressed again — OBS going live must not quietly undo that.
*/
let wanted = false;

/* What OBS last said: reachable, and streaming, and since when. */
let obsLink = { connected: false, streaming: false, since: 0 };
/* How TikTok is being looked for, for the Connections screen. */
let watch = { mode: 'no-obs', nextTryAt: 0 };

const LIVE_FAST_MS = 30_000;
const LIVE_FAST_FOR_MS = 10 * 60_000;
const LIVE_SLOW_MS = 2 * 60_000;

/** Which it is: Twitch's say when Twitch can say, otherwise OBS's, as before. */
const currentMode = () => {
  const tw = twitchLive();
  if (tw.known) return tw.live ? 'twitch-live' : 'twitch-idle';
  return obsLink.connected ? (obsLink.streaming ? 'obs-live' : 'obs-idle') : 'no-obs';
};

/*
  Follows Twitch going live and stopping. Already on TikTok, or nobody to
  look for, or told to stay away: nothing to decide.
*/
function watchTwitch() {
  onTwitchLive((_s, { wentLive }) => {
    if (!channel || connection || !wanted) return;
    schedule(currentMode(), { now: wentLive });
  });
}

/*
  Follows OBS through the status events it already sends — on connecting,
  on every stream start and stop, and on losing the connection. Only a
  change of reachable or streaming moves anything here.
*/
function watchObs() {
  bus.on(EVENTS.STATUS, (s) => {
    if (s?.platform !== 'obs') return;
    const connected = s.status === 'connected';
    const streaming = connected && Boolean(s.streamStatus?.active);
    if (connected === obsLink.connected && streaming === obsLink.streaming) return;
    const wentLive = streaming && !obsLink.streaming;
    obsLink = { connected, streaming, since: wentLive ? Date.now() : obsLink.since };
    // Already on TikTok, or nobody to look for: nothing to decide.
    if (!channel || connection || !wanted) return;
    schedule(currentMode(), { now: wentLive });
  });
}

/**
 * Look for the stream on the timetable the mode asks for — or, with OBS up
 * and not streaming, do not look at all.
 */
function schedule(mode, { now = false } = {}) {
  clearTimeout(pollTimer);
  pollTimer = null;
  if (!channel || connection || !wanted) return;

  const live = mode === 'obs-live' || mode === 'twitch-live';
  if (mode !== watch.mode) {
    const every = live ? LIVE_FAST_MS : config.tiktok.pollIntervalMs;
    log.info(mode === 'twitch-idle' ? `Twitch is not live — not looking for @${channel} until it is`
      : mode === 'twitch-live' ? `Twitch is live — looking for @${channel} every ${every / 1000}s`
        : mode === 'obs-idle' ? `OBS is not streaming — not looking for @${channel} until it is`
          : mode === 'obs-live' ? `OBS is live — looking for @${channel} every ${every / 1000}s`
            : `OBS is not connected — looking for @${channel} every ${every / 1000}s`);
  }

  /*
    Not looking: waiting, and called that — not polling, which it is not
    doing. It was called polling, and with nothing being asked of TikTok the
    screen said "Stop polling", so it was stopped — which switches TikTok
    off for when Twitch does go live too.
  */
  if (mode === 'obs-idle' || mode === 'twitch-idle') {
    watch = { mode, nextTryAt: 0 };
    setStatus('waiting');
    return;
  }

  // Fast at first, from when the stream went live — Twitch's, or OBS's when Twitch cannot say.
  const since = mode === 'twitch-live' ? twitchLive().since : obsLink.since;
  const every = live
    ? (Date.now() - since < LIVE_FAST_FOR_MS ? LIVE_FAST_MS : LIVE_SLOW_MS)
    : config.tiktok.pollIntervalMs;
  const wait = now ? 0 : every;
  watch = { mode, nextTryAt: Date.now() + wait };
  setStatus('polling');
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    await attemptConnect({ fromPolling: true });
    if (!connection) schedule(currentMode());
  }, wait);
}

export function initTikTok() {
  creds = collection('tiktok_credentials', { username: '', signApiKey: '' });
  channel = creds.get().username || null;
  watchObs();
  watchTwitch();
  if (config.autoStart && channel) {
    wanted = true;
    connect().catch((err) => log.warn('auto-connect failed:', err.message));
  }
}

function setStatus(next, error = null) {
  status = next;
  lastError = error;
  bus.emit(EVENTS.STATUS, { platform: 'tiktok', status, error: error?.message ?? null, channel, watch });
}

export const getStatus = () => ({ status, error: lastError?.message ?? null, channel, watch });
export const getCredentials = () => ({
  username: creds.get().username,
  // The key itself stays here; a UI only needs to know one is set.
  hasSignKey: Boolean(creds.get().signApiKey || config.tiktok.signApiKey),
});

export function setCredentials({ username, signApiKey }) {
  const current = creds.get();
  const clean = username === undefined
    ? current.username
    : String(username || '').replace(/^@/, '').trim();

  // A blank key means "left alone", not "erase what is stored" — the field
  // comes back empty on every page load, because the value is never sent out.
  creds.set({
    username: clean,
    signApiKey: signApiKey ? String(signApiKey).trim() : (current.signApiKey || ''),
  });
  channel = clean || null;
}

/** The signing key, stored value first. Never leaves the server. */
const signKey = () => creds?.get().signApiKey || config.tiktok.signApiKey;

/** v2 requires an explicit options object — the constructor dereferences it. */
function buildConnection(name) {
  const options = {
    // Do not replay the room's existing chat backlog on connect.
    //
    // The library defaults this to true, decoding whatever messages the room
    // returns in the initial sign response and emitting them as ordinary chat.
    // They arrive stamped with the current time (messages carry no usable
    // timestamp of their own here), so an hour-old comment looks brand new and
    // shoves genuinely recent Twitch and Discord messages out of the dock.
    // A live dock should start from the moment it connects.
    processInitialData: false,
  };

  // An Euler Stream key raises the signing rate limit. Optional; anonymous
  // access works but is throttled, which is why polling stays infrequent.
  if (signKey()) options.signApiKey = signKey();

  return makeConnection(name, options);
}

/*
  What opens a connection. Replaceable so the looking-for-a-stream timetable
  can be driven without reaching TikTok: the rest of this file needs a live
  creator to say anything, and when to look is the part worth checking.
*/
let makeConnection = (name, options) => new TikTokLiveConnection(name, options);
export function useConnectionFactory(fn) {
  makeConnection = fn || ((name, options) => new TikTokLiveConnection(name, options));
}

/* Not live: go back to looking, on whatever timetable OBS says. */
function startPolling() {
  if (pollTimer || !channel) return;
  schedule(currentMode());
}

function stopPolling() {
  clearTimeout(pollTimer);
  pollTimer = null;
}

async function attemptConnect({ fromPolling = false } = {}) {
  if (connection || !channel) return;

  if (!fromPolling) setStatus('connecting');

  const attempt = buildConnection(channel);

  try {
    const state = await attempt.connect();

    connection = attempt;
    wireEvents();
    stopPolling();

    isLive = true;
    watch = { mode: 'connected', nextTryAt: 0 };
    setStatus('connected');
    log.info(`connected to @${channel} (room ${state.roomId})`);
  } catch (err) {
    try { attempt.disconnect(); } catch { /* never opened */ }

    // Offline is the expected case, not a failure — wait for them to go live.
    const offline = err?.constructor?.name === 'UserOfflineError'
      || /offline|not.*live/i.test(err?.message || '');

    if (fromPolling) {
      log.debug(`@${channel} still not live: ${err.message}`);
    } else if (offline) {
      startPolling();
    } else {
      log.warn(`could not connect to @${channel}: ${err.message}`);
      startPolling();
    }
  }
}

export async function connect() {
  if (!channel) throw new Error('TikTok: no username configured');
  wanted = true;
  stopPolling();
  await disconnect({ keepChannel: true });
  // Not live (Twitch's say, or OBS's without it): nothing to find yet, so not even one look — switched on, and waiting.
  const mode = currentMode();
  if (mode === 'twitch-idle' || mode === 'obs-idle') { schedule(mode); return; }
  await attemptConnect();
}

export async function disconnect({ keepChannel = false } = {}) {
  stopPolling();
  isLive = false;
  if (connection) {
    try { connection.disconnect(); } catch { /* already closed */ }
    connection = null;
  }
  if (!keepChannel) {
    channel = creds.get().username || null;
    wanted = false;
  }
  setStatus('disconnected');
}

// ------------------------------------------------------------------- events

/** v2 nests the author under `user`; v1 had these fields at the top level. */
const nameOf = (d) => d?.user?.nickname || d?.user?.uniqueId || d?.user?.displayId || 'Unknown';
const idOf = (d) => d?.user?.uniqueId || d?.user?.displayId || d?.user?.id || null;
const avatarOf = (d) => d?.user?.avatarThumb?.urlList?.[0]
  || d?.user?.profilePicture?.urlList?.[0]
  || undefined;

function wireEvents() {
  connection.on(WebcastEvent.CHAT, (d) => {
    bus.emit(EVENTS.CHAT, normaliseChat({
      platform: 'tiktok',
      id: d.common?.msgId || undefined,
      user: nameOf(d),
      userId: idOf(d),
      // v2 renamed `comment` to `content`.
      msg: d.content ?? d.comment ?? '',
      avatar: avatarOf(d),
      isMod: Boolean(d.userIdentity?.isModeratorOfAnchor),
      isSub: Boolean(d.userIdentity?.isSubscriberOfAnchor),
      // TikTok has no name colours: the one Twitch gives somebody who never chose, not white.
      color: defaultNameColour(nameOf(d)),
      raw: d,
    }));
  });

  connection.on(WebcastEvent.GIFT, (d) => {
    // Streak gifts fire repeatedly while held; bank once at streak end so a
    // 100x combo does not trigger a hundred alerts.
    const isStreak = d.giftType === 1 || d.gift?.type === 1;
    if (isStreak && !d.repeatEnd) return;

    const count = d.repeatCount || 1;
    const each = d.gift?.diamondCount ?? d.diamondCount ?? 0;
    const diamonds = each * count;
    const giftName = d.gift?.name ?? d.giftName ?? 'Gift';

    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'tiktok_gift',
      platform: 'tiktok',
      user: nameOf(d),
      avatar: avatarOf(d),
      data: { giftName, count, diamonds, amount: diamonds, currency: 'DIAMONDS', userId: idOf(d) || undefined },
    }));
  });

  // v2 has dedicated follow/share events; v1 required parsing SOCIAL labels.
  connection.on(WebcastEvent.FOLLOW, (d) => {
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'tiktok_follow', platform: 'tiktok', user: nameOf(d), avatar: avatarOf(d), data: { userId: idOf(d) || undefined },
    }));
  });

  connection.on(WebcastEvent.SHARE, (d) => {
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'tiktok_share', platform: 'tiktok', user: nameOf(d), avatar: avatarOf(d), data: {},
    }));
  });

  // v2 has no SUBSCRIBE event — `WebcastEvent.SUBSCRIBE` is undefined, so the
  // guarded handler here never bound and `tiktok_sub` could never fire. The
  // real event is SUB_NOTIFY.
  connection.on(WebcastEvent.SUB_NOTIFY, (d) => {
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'tiktok_sub', platform: 'tiktok', user: nameOf(d), avatar: avatarOf(d), data: {},
    }));
  });

  // Live viewer count. Published as a stat file rather than a stream tag,
  // because StreamTags has a fixed set of keys in the UI's type.
  connection.on(WebcastEvent.ROOM_USER, (d) => {
    const viewers = Number(d.total ?? d.viewerCount ?? d.totalUser ?? 0);
    if (Number.isFinite(viewers) && viewers > 0) {
      bus.emit(EVENTS.STAT, { key: 'tiktokViewers', value: viewers });
    }
  });

  // Likes. `total` is cumulative for the stream; `count` is this batch.
  connection.on(WebcastEvent.LIKE, (d) => {
    const total = Number(d.total ?? d.totalLikeCount ?? 0);
    if (Number.isFinite(total) && total > 0) {
      bus.emit(EVENTS.STAT, { key: 'tiktokLikes', value: total });
    }
  });

  // A moderator deleted a message (or banned a user) upstream — drop it from
  // our dock too, rather than leaving removed content on screen.
  connection.on(WebcastEvent.IM_DELETE, (d) => {
    const msgIds = d.deleteMsgIds ?? [];
    const userIds = d.deleteUserIds ?? [];
    if (msgIds.length === 0 && userIds.length === 0) return;
    bus.emit(EVENTS.CHAT_DELETE, { platform: 'tiktok', msgIds, userIds });
    log.debug(`removed ${msgIds.length} message(s) / ${userIds.length} user(s)`);
  });

  connection.on(WebcastEvent.MEMBER, (d) => {
    // Joins are informational — surfaced as chat so the dock can show them
    // without counting as an alertable event.
    bus.emit(EVENTS.CHAT, normaliseChat({
      platform: 'tiktok',
      user: nameOf(d),
      userId: idOf(d),
      msg: '👋 Joined stream',
      avatar: avatarOf(d),
      raw: d,
    }));
  });

  connection.on(WebcastEvent.STREAM_END, () => {
    log.info('stream ended — returning to polling');
    isLive = false;
    connection = null;
    startPolling();
  });

  connection.on(ControlEvent.DISCONNECTED, () => {
    if (!isLive) return;
    log.warn('dropped — reconnecting shortly');
    connection = null;
    isLive = false;
    startPolling();
  });

  connection.on(ControlEvent.ERROR, (err) => {
    log.debug('connection error:', err?.message ?? err);
  });
}
