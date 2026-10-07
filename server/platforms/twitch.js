/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Twitch: IRC chat (main + bot accounts), Helix REST, and EventSub over
 * WebSocket.
 *
 * In V2 all of this ran inside the browser tab via tmi.js, which is exactly
 * why closing the tab killed the bot. It now runs in the server process.
 *
 * EventSub-over-WebSocket is used for follow/sub/cheer/raid/redemption because
 * it needs no public callback URL — it is the right transport for a service
 * running on a streamer's own machine.
 */

import tmi from 'tmi.js';
import WebSocket from 'ws';
import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseChat, normaliseEvent } from '../core/bus.js';
import { defaultNameColour } from '../../shared/platforms.js';
import { createLogger } from '../core/logger.js';
import { config } from '../config.js';

const log = createLogger('twitch');

const HELIX = 'https://api.twitch.tv/helix';
const EVENTSUB_WS = 'wss://eventsub.wss.twitch.tv/ws';

let creds = null;      // { channel, accessToken, userId, login, botToken, botLogin }
let mainClient = null;
let botClient = null;
let eventSub = null;
let eventSubKeepalive = null;
let status = { main: 'disconnected', bot: 'disconnected', eventsub: 'disconnected' };

// Full Helix user records for the connected accounts. The Connections screen
// renders `profile_image_url` and `display_name` from these, so a bare
// login/id pair leaves it showing "Connected" with no avatar or name.
let profile = null;
let botProfile = null;

/**
 * Profile pictures, keyed by Twitch user id.
 *
 * Twitch IRC carries no avatar — unlike TikTok, which embeds one in every
 * chat payload — so they have to be fetched from Helix. Previously only the
 * main and bot accounts were ever looked up, which is why every other
 * chatter rendered without a picture.
 *
 * Lookups are batched (Helix resolves up to 100 users per request) and
 * debounced, then broadcast so already-rendered messages can be filled in
 * retroactively. Keyed by id rather than name because display names vary in
 * case and can contain non-ASCII forms of the login.
 */
const avatarCache = new Map();
const pendingAvatarIds = new Set();
let avatarTimer = null;

/**
 * How often to ask Twitch how many people are watching.
 *
 * Twitch's own viewer count is not real-time — it settles over tens of
 * seconds — so polling faster would spend requests to redraw the same number.
 */
const VIEWER_POLL_MS = 60_000;
let viewerTimer = null;

const AVATAR_BATCH = 100;
const AVATAR_DEBOUNCE_MS = 800;

function scheduleAvatarLookup(userId) {
  if (!userId || avatarCache.has(userId) || pendingAvatarIds.has(userId)) return;
  pendingAvatarIds.add(userId);
  if (!avatarTimer) avatarTimer = setTimeout(flushAvatarLookups, AVATAR_DEBOUNCE_MS);
}

async function flushAvatarLookups() {
  avatarTimer = null;

  const ids = [...pendingAvatarIds].slice(0, AVATAR_BATCH);
  for (const id of ids) pendingAvatarIds.delete(id);
  if (ids.length === 0) return;

  try {
    const data = await helix('/users', { query: { id: ids } });
    const resolved = {};

    for (const u of data?.data ?? []) {
      if (!u.profile_image_url) continue;
      avatarCache.set(u.id, u.profile_image_url);
      resolved[u.id] = u.profile_image_url;
    }

    // Bound the cache so a long stream cannot grow it without limit.
    if (avatarCache.size > 5000) {
      for (const key of avatarCache.keys()) {
        avatarCache.delete(key);
        if (avatarCache.size <= 2500) break;
      }
    }

    if (Object.keys(resolved).length > 0) {
      bus.emit(EVENTS.AVATARS, { platform: 'twitch', avatars: resolved });
      log.debug(`resolved ${Object.keys(resolved).length} avatar(s)`);
    }
  } catch (err) {
    // Not worth surfacing: chat still works, it just has no picture.
    log.debug(`avatar lookup failed: ${err.message}`);
  }

  // More chatters arrived while that request was in flight.
  if (pendingAvatarIds.size > 0 && !avatarTimer) {
    avatarTimer = setTimeout(flushAvatarLookups, AVATAR_DEBOUNCE_MS);
  }
}

/**
 * The client id may come from the environment or from the Connections screen.
 * A value entered in the UI wins, because that is the one the user just
 * authorised against — an env value left over from another app would produce
 * confusing 401s.
 */
function clientId() {
  return creds.get().clientId || config.twitch.clientId;
}

export function initTwitch() {
  creds = collection('twitch_credentials', {
    channel: '', accessToken: '', userId: '', login: '',
    botToken: '', botLogin: '', clientId: '',
  });
  if (config.autoStart && creds.get().channel) {
    connect().catch((err) => log.error('auto-connect failed:', err));
  }
}

function setStatus(patch) {
  status = { ...status, ...patch };
  bus.emit(EVENTS.STATUS, { platform: 'twitch', status: status.main, detail: status });
}

export const getStatus = () => status;
export const getCredentials = () => {
  const c = creds.get();
  // Never hand tokens back to clients.
  // Fall back to a login-only record so the UI still shows who is connected
  // if the profile lookup failed (bad scope, transient Helix error).
  const stub = (login, id) => (login ? { login, display_name: login, id } : null);

  return {
    channel: c.channel,
    login: c.login,
    userId: c.userId,
    botLogin: c.botLogin,
    clientId: clientId(),
    user: profile ?? stub(c.login, c.userId),
    botUser: botProfile ?? stub(c.botLogin),
    hasToken: Boolean(c.accessToken),
    hasBotToken: Boolean(c.botToken),
  };
};

export function setCredentials(patch) {
  creds.set({ ...creds.get(), ...patch });
}

// ------------------------------------------------------------------- Helix

async function helix(endpoint, { method = 'GET', token, body, query } = {}) {
  const c = creds.get();
  const accessToken = token ?? c.accessToken;
  // Coded, so a screen can say Twitch is not connected in its own words.
  if (!accessToken) throw refusal('twitch_offline', 'Twitch: not authenticated');
  const id = clientId();
  if (!id) throw refusal('twitch_offline', 'Twitch: no client id — set it on the Connections screen or as TWITCH_CLIENT_ID');

  const url = new URL(`${HELIX}${endpoint}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null) continue;
    // Helix takes repeated keys for batch lookups (?id=1&id=2&...), which is
    // what lets one request resolve up to 100 users at once.
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': id,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = new Error(`Twitch Helix ${res.status}: ${json?.message || text}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function getUser(login) {
  const data = await helix('/users', { query: { login } });
  const user = data?.data?.[0];
  if (user?.profile_image_url) {
    avatarCache.set(user.id, user.profile_image_url);
    // Publish it too: a message may already be on screen without a picture,
    // and this is the only path that resolves the main and bot accounts.
    bus.emit(EVENTS.AVATARS, { platform: 'twitch', avatars: { [user.id]: user.profile_image_url } });
  }
  return user ?? null;
}

export async function fetchRewards() {
  const c = creds.get();
  const data = await helix('/channel_points/custom_rewards', { query: { broadcaster_id: c.userId } });
  const rewards = data?.data ?? [];
  /*
    Published as well as returned.

    The editor used to be the only thing that ever asked, and it threw the
    answer away on reload — so a redemption alert filtered to a reward showed
    an id where its name should be until somebody pressed Refresh. The engine
    keeps what comes through here, which is why this emits even when it was
    the editor that asked.
  */
  bus.emit(EVENTS.REWARD_LIST, rewards);
  return rewards;
}

/**
 * Back-fill the stream tags that Twitch can tell us about after the fact.
 *
 * Tags are otherwise only populated by live events, so a freshly started
 * server showed "---" for everything until someone followed or subscribed.
 * Seeded through TAG_SEED rather than the event pipeline, so back-filling
 * last week's follower does not fire an alert for them.
 *
 * Only follows and subs are retrievable — Twitch exposes no history for
 * cheers or raids, so those stay empty until they happen live.
 */
export async function fetchTags() {
  const c = creds.get();
  if (!c.userId) throw new Error('Twitch: not authenticated');

  const seeded = [];

  // Documented newest-first.
  try {
    const followers = await helix('/channels/followers', { query: { broadcaster_id: c.userId, first: 1 } });
    const f = followers?.data?.[0];
    if (f) {
      bus.emit(EVENTS.TAG_SEED, {
        key: 'latestFollower',
        entry: {
          user: f.user_name,
          platform: 'twitch',
          timestamp: f.followed_at ? Date.parse(f.followed_at) : Date.now(),
        },
      });
      seeded.push(`follower=${f.user_name}`);
    }
  } catch (err) {
    log.warn(`could not fetch latest follower: ${err.message}`);
  }

  try {
    const all = await refreshSubscribers();
    seeded.push(`subscribers=${all.length}`);
  } catch (err) {
    log.warn(`could not fetch the subscriber list: ${err.message}`);
  }

  // Note: Twitch does not document this as newest-first, so it is a best
  // effort — the same one V2 made.
  try {
    const subs = await helix('/subscriptions', { query: { broadcaster_id: c.userId, first: 1 } });
    const s = subs?.data?.[0];
    if (s) {
      bus.emit(EVENTS.TAG_SEED, {
        key: 'latestSubscriber',
        entry: { user: s.user_name, platform: 'twitch', timestamp: Date.now() },
      });
      seeded.push(`subscriber=${s.user_name}`);
    }
  } catch (err) {
    // Missing channel:read:subscriptions, or an affiliate-only endpoint.
    log.warn(`could not fetch latest subscriber: ${err.message}`);
  }

  log.info(seeded.length ? `tags refreshed — ${seeded.join(', ')}` : 'tags refreshed — nothing available');
  return seeded;
}

/**
 * The full membership list, for the subscriber ledger and for Discord roles
 * that follow a subscription. Paginated because a channel can easily have
 * more subscribers than one page holds; the list says whether it is
 * complete, because a truncated one would mark everybody past its end as
 * lapsed. Needs channel:read:subscriptions on the channel's token.
 */
export async function refreshSubscribers() {
  const c = creds.get();
  if (!c.userId) throw new Error('Twitch is not connected');
  const all = [];
  let cursor;
  let complete = false;
  // Bounded rather than "until the cursor runs out": a pagination bug on
  // either side should cost a few requests, not spin forever.
  for (let page = 0; page < 20; page += 1) {
    const query = { broadcaster_id: c.userId, first: 100 };
    if (cursor) query.after = cursor;
    const res = await helix('/subscriptions', { query });
    all.push(...(res?.data ?? []));
    cursor = res?.pagination?.cursor;
    if (!cursor || !res?.data?.length) { complete = true; break; }
  }
  all.complete = complete;
  bus.emit(EVENTS.SUBSCRIBER_LIST, all);
  return all;
}

/**
 * Everybody following the channel, newest first, so the link window can
 * offer them to pick rather than asking for a name spelled right. Paged and
 * bounded like the subscriber list, and kept a minute so opening the window
 * twice does not page through it twice. Pictures come from the avatar cache;
 * the ones it lacks are asked for a hundred at a time, for the newest
 * FOLLOWER_PICTURES only — the rest are listed without one.
 *
 * Needs moderator:read:followers. Without it Twitch still answers, with the
 * count and nobody in it, which is said as such rather than shown as an
 * empty channel.
 */
const FOLLOWERS_TTL_MS = 60 * 1000;
const FOLLOWER_PAGES = 50;
const FOLLOWER_PICTURES = 1000;
let followersCache = null;

export async function listFollowers() {
  const c = creds.get();
  if (!c.userId) throw refusal('twitch_offline', 'Twitch is not connected');
  if (followersCache?.userId === c.userId && Date.now() - followersCache.at < FOLLOWERS_TTL_MS) return followersCache.result;

  const raw = [];
  let total = 0;
  let cursor;
  let complete = false;
  for (let page = 0; page < FOLLOWER_PAGES; page += 1) {
    const query = { broadcaster_id: c.userId, first: 100 };
    if (cursor) query.after = cursor;
    const res = await helix('/channels/followers', { query });
    if (Number.isFinite(Number(res?.total))) total = Number(res.total);
    raw.push(...(res?.data ?? []));
    cursor = res?.pagination?.cursor;
    if (!cursor || !res?.data?.length) { complete = true; break; }
  }
  if (!raw.length && total > 0) throw new Error('Twitch gave the follower count but not the followers: reconnect Twitch so it can read them (moderator:read:followers)');

  const missing = raw.slice(0, FOLLOWER_PICTURES).map((f) => f.user_id).filter((id) => id && !avatarCache.has(id));
  for (let i = 0; i < missing.length; i += AVATAR_BATCH) {
    try {
      const data = await helix('/users', { query: { id: missing.slice(i, i + AVATAR_BATCH) } });
      for (const u of data?.data ?? []) if (u.profile_image_url) avatarCache.set(u.id, u.profile_image_url);
    } catch (err) {
      // The list is worth more than its pictures.
      log.debug(`follower pictures unavailable: ${err.message}`);
      break;
    }
  }

  const followers = raw.filter((f) => f?.user_id).map((f) => ({
    id: f.user_id,
    login: f.user_login || '',
    name: f.user_name || f.user_login || f.user_id,
    followedAt: f.followed_at ? Date.parse(f.followed_at) : 0,
    avatar: avatarCache.get(f.user_id) || '',
  }));
  const result = { followers, total: Math.max(total, followers.length), complete };
  followersCache = { userId: c.userId, at: Date.now(), result };
  return result;
}

/**
 * The stream as it is right now, for a go-live announcement: live or not,
 * its title and game, the thumbnail Twitch shows, and where to watch it.
 * Null when Twitch is not connected.
 */
export async function getLiveInfo() {
  const c = creds.get();
  if (!c.userId || !c.accessToken) return null;
  const login = profile?.login || c.login || c.channel;
  const base = { login, name: profile?.display_name || login, url: login ? `https://twitch.tv/${login}` : '' };
  const stream = (await helix('/streams', { query: { user_id: c.userId } }))?.data?.[0];
  if (stream) {
    return {
      ...base,
      live: true,
      title: stream.title || '',
      game: stream.game_name || '',
      // The preview Twitch serves for a live channel, sized, and new each time so Discord does not show a stale one.
      thumbnail: String(stream.thumbnail_url || '').replace('{width}', '1280').replace('{height}', '720') + `?t=${Date.now()}`,
      startedAt: stream.started_at,
    };
  }
  const channel = (await helix('/channels', { query: { broadcaster_id: c.userId } }))?.data?.[0];
  return { ...base, live: false, title: channel?.title || '', game: channel?.game_name || '', thumbnail: '' };
}

/**
 * Clips made of the channel since a moment, by anybody — the dock's, an
 * action's, a viewer's — most watched first. Twitch lists a clip a little
 * after it is made.
 */
export async function clipsSince(startedAt, { max = 5 } = {}) {
  const c = creds.get();
  if (!c.userId || !c.accessToken || !startedAt) return [];
  const res = await helix('/clips', { query: { broadcaster_id: c.userId, started_at: new Date(startedAt).toISOString(), first: 20 } });
  return (res?.data || [])
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, max)
    .map((x) => ({ title: x.title || '', url: x.url, by: x.creator_name || '', views: x.view_count || 0 }));
}

/** The channel's latest past broadcast — tonight's, just after it ends — if Twitch keeps them. */
export async function latestVod() {
  const c = creds.get();
  if (!c.userId || !c.accessToken) return null;
  const v = (await helix('/videos', { query: { user_id: c.userId, type: 'archive', first: 1 } }))?.data?.[0];
  return v ? { url: v.url, title: v.title || '', createdAt: v.created_at } : null;
}

export async function searchCategories(q) {
  const data = await helix('/search/categories', { query: { query: q, first: 20 } });
  return data?.data ?? [];
}

export async function setTitle(title) {
  const c = creds.get();
  if (!title) return;
  await helix('/channels', { method: 'PATCH', query: { broadcaster_id: c.userId }, body: { title } });
  log.info(`title set to "${title}"`);
}

export async function setCategory(gameId, gameName) {
  const c = creds.get();
  let id = gameId;
  if (!id && gameName) {
    const results = await searchCategories(gameName);
    id = results[0]?.id;
  }
  if (!id) throw new Error('Twitch: no category id resolved');
  await helix('/channels', { method: 'PATCH', query: { broadcaster_id: c.userId }, body: { game_id: id } });
  log.info(`category set to ${gameName || id}`);
}

// --------------------------------------------------------------------- IRC

function buildClient(username, token, channel) {
  return new tmi.Client({
    options: { debug: false, skipUpdatingEmotesets: true },
    connection: { reconnect: true, secure: true },
    identity: username && token ? { username, password: `oauth:${token.replace(/^oauth:/, '')}` } : undefined,
    channels: [channel],
  });
}

export async function connect() {
  const c = creds.get();
  if (!c.channel) throw new Error('Twitch: no channel configured');

  await disconnect();

  mainClient = buildClient(c.login, c.accessToken, c.channel);
  wireChatEvents(mainClient);

  mainClient.on('connected', () => { setStatus({ main: 'connected' }); log.info(`joined #${c.channel}`); });
  mainClient.on('disconnected', (reason) => { setStatus({ main: 'disconnected' }); log.warn(`disconnected: ${reason}`); });

  await mainClient.connect();

  // Resolve the account profile so the UI can show the avatar and display
  // name rather than a bare "Connected". Non-fatal: chat works without it.
  try {
    profile = await getUser(c.login);
    setStatus({}); // re-broadcast so clients pick up the profile
  } catch (err) {
    log.warn(`could not load Twitch profile for ${c.login}: ${err.message}`);
  }

  if (c.botToken && c.botLogin) {
    try {
      botClient = buildClient(c.botLogin, c.botToken, c.channel);
      await botClient.connect();
      try {
        botProfile = await getUser(c.botLogin);
      } catch (err) {
        log.warn(`could not load Twitch profile for bot ${c.botLogin}: ${err.message}`);
      }
      setStatus({ bot: 'connected' });
      log.info(`bot account ${c.botLogin} connected`);
    } catch (err) {
      setStatus({ bot: 'error' });
      log.error('bot account failed to connect:', err.message);
    }
  }

  if (c.accessToken && c.userId) {
    startViewerPoll();
    connectEventSub().catch((e) => log.error('EventSub failed:', e.message));
    // Populate the tag cards straight away, as V2 did on connect.
    fetchTags().catch((e) => log.debug('tag back-fill failed:', e.message));
    // And the reward names, so the alert editor can name one without asking.
    fetchRewards().catch((e) => log.debug('reward list failed:', e.message));
  }
}

/**
 * Viewer count, and whether the channel is live at all.
 *
 * /helix/streams answers with an empty array when the channel is offline,
 * which is the only way to tell the difference between "nobody is watching"
 * and "there is nothing to watch" — zero viewers on a live stream is a real
 * state, and an overlay should be able to say so rather than vanishing.
 */
async function pollViewers() {
  const c = creds.get();
  if (!c.userId) return;
  try {
    const res = await helix('/streams', { query: { user_id: c.userId } });
    const live = res?.data?.[0] ?? null;
    bus.emit(EVENTS.STAT, { key: 'twitchLive', value: Boolean(live) });
    bus.emit(EVENTS.STAT, { key: 'twitchViewers', value: Number(live?.viewer_count) || 0 });
  } catch (err) {
    log.debug('viewer count unavailable:', err.message);
  }
  pollTotals();
}

/**
 * How many followers and subscribers the channel has.
 *
 * Both are a `total` beside a first page we do not want, so each asks for one
 * item and reads the count off the envelope rather than paging through
 * thousands of names to length an array.
 *
 * Failures are quiet and separate. Each needs its own scope, and a channel
 * that never granted one should still get the other rather than losing both to
 * one 401 — these feed a goal bar, and a goal that silently reads zero is
 * worse than one that admits it has no number.
 */
async function pollTotals() {
  const c = creds.get();
  if (!c.userId) return;

  try {
    const res = await helix('/channels/followers', { query: { broadcaster_id: c.userId, first: 1 } });
    if (Number.isFinite(Number(res?.total))) {
      bus.emit(EVENTS.STAT, { key: 'twitchFollowers', value: Number(res.total) });
    }
  } catch (err) {
    log.debug('follower total unavailable:', err.message);
  }

  try {
    const res = await helix('/subscriptions', { query: { broadcaster_id: c.userId, first: 1 } });
    if (Number.isFinite(Number(res?.total))) {
      bus.emit(EVENTS.STAT, { key: 'twitchSubs', value: Number(res.total) });
    }
  } catch (err) {
    log.debug('subscriber total unavailable:', err.message);
  }
}

function startViewerPoll() {
  stopViewerPoll();
  pollViewers();
  viewerTimer = setInterval(pollViewers, VIEWER_POLL_MS);
}

function stopViewerPoll() {
  clearInterval(viewerTimer);
  viewerTimer = null;
}

export async function disconnect() {
  for (const [name, client] of [['main', mainClient], ['bot', botClient]]) {
    if (!client) continue;
    try { await client.disconnect(); } catch { /* already down */ }
    log.debug(`${name} client closed`);
  }
  stopViewerPoll();
  // Nobody is watching a channel this app is no longer connected to; leaving
  // the last number on screen would be a lie that never corrects itself.
  bus.emit(EVENTS.STAT, { key: 'twitchViewers', value: 0 });
  bus.emit(EVENTS.STAT, { key: 'twitchLive', value: false });
  mainClient = null;
  botClient = null;
  profile = null;
  botProfile = null;
  closeEventSub();
  setStatus({ main: 'disconnected', bot: 'disconnected', eventsub: 'disconnected' });
}

// Guards against rendering the same message twice when Twitch echoes a
// message tmi.js already surfaced locally. Keyed by Twitch's message id.
const seenMessageIds = new Set();

function wireChatEvents(client) {
  client.on('message', (channel, tags, message, self) => {
    // `self` is true for anything from the connected account, including what
    // the streamer types in Twitch's own web chat. Dropping those (the usual
    // bot-echo guard) left a solo streamer's dock permanently empty.
    //
    // Twitch does NOT echo your own messages back over IRC, so tmi.js's local
    // synthetic copy is the only one that exists for an app-sent message —
    // filtering it removed the message entirely. Keep everything; the id-based
    // check below only guards against a genuine repeat.
    const id = tags.id;
    if (id) {
      if (seenMessageIds.has(id)) return;
      seenMessageIds.add(id);
      // Bound the set so a long stream cannot grow it without limit.
      if (seenMessageIds.size > 2000) {
        for (const old of seenMessageIds) {
          seenMessageIds.delete(old);
          if (seenMessageIds.size <= 1000) break;
        }
      }
    }

    const c = creds.get();
    const username = tags['display-name'] || tags.username || c.login;
    const byBot = Boolean(c.botLogin) && String(tags.username || '').toLowerCase() === String(c.botLogin).toLowerCase();
    if (isRelayEcho(message, self || byBot)) return;

    // tmi.js emits a synthetic local copy of anything we send ourselves, and
    // that copy carries almost no tags — including no `user-id`. Since avatars
    // are keyed by id, our own messages resolved to nothing and rendered
    // blank while everyone else's worked. We know who we are, so fill it in.
    const userId = tags['user-id'] || (self ? c.userId : null);

    // Fill in on a later message (and retroactively via the broadcast) rather
    // than delaying this one behind an HTTP round trip.
    scheduleAvatarLookup(userId);

    // A reward configured to ask the viewer for text arrives twice: once here
    // as a normal PRIVMSG carrying `custom-reward-id`, and once over EventSub
    // as a redemption. Tag it so a surface showing the event can drop this
    // copy rather than printing the same sentence twice.
    //
    // Deliberately still emitted: the engine matches commands against it, and
    // a surface with events turned off wants this as its only representation.
    // Read under both spellings because tmi.js normalises the tags it knows
    // about and passes the rest through as-is.
    const rewardId = tags['custom-reward-id'] || tags.customRewardId || null;

    bus.emit(EVENTS.CHAT, normaliseChat({
      platform: 'twitch',
      // Twitch's own id, so a moderator deleting the message can be matched to it.
      id: id || null,
      user: username,
      userId,
      msg: message,
      rewardId,
      // Their own colour, or the one Twitch's chat gives somebody who never chose.
      color: tags.color || defaultNameColour(username),
      // Our own profile is already resolved at connect; prefer it directly so
      // a self-echo never has to wait on a lookup.
      avatar: avatarCache.get(userId) || (self ? profile?.profile_image_url : undefined),
      isMod: Boolean(tags.mod),
      isSub: Boolean(tags.subscriber),
      isVip: Boolean(tags.vip),
      isBroadcaster: tags.badges?.broadcaster === '1' || Boolean(self),
      // The channel's own bot account, logged in on the Connections screen.
      isBot: byBot,
      emotes: tags.emotes || undefined,
      // "Highlight My Message" is a BUILT-IN reward, so it never fires
      // channel.channel_points_custom_reward_redemption (that event is for
      // custom rewards only). Twitch flags it on the IRC message instead.
      highlighted: tags['msg-id'] === 'highlighted-message',
      raw: tags,
    }));
  });

  /*
    A moderator deleted a message, or timed out or banned somebody. Twitch's
    own chat takes their words off screen, so the dock, the overlay and a
    question still waiting take them off too. These arrive over IRC, so no
    EventSub scope is needed; a whole-chat /clear is left alone, as it only
    tidies Twitch's own window.
  */
  client.on('messagedeleted', (channel, username, deleted, tags) => {
    const msgId = tags?.['target-msg-id'];
    if (msgId) bus.emit(EVENTS.CHAT_DELETE, { platform: 'twitch', msgIds: [String(msgId)], userIds: [] });
  });
  const removeChatter = (tags) => {
    const userId = tags?.['target-user-id'];
    if (userId) bus.emit(EVENTS.CHAT_DELETE, { platform: 'twitch', msgIds: [], userIds: [String(userId)] });
  };
  client.on('timeout', (channel, username, reason, duration, tags) => {
    removeChatter(tags);
    // For the mod log (moderation.js): who, and for how long.
    bus.emit('mod:action', { platform: 'twitch', kind: 'timeout', userId: String(tags?.['target-user-id'] || ''), user: username, seconds: Number(duration) || 0, reason: reason || '' });
  });
  client.on('ban', (channel, username, reason, tags) => {
    removeChatter(tags);
    bus.emit('mod:action', { platform: 'twitch', kind: 'ban', userId: String(tags?.['target-user-id'] || ''), user: username, reason: reason || '' });
  });

  // Cheers arrive on IRC, so they work even without EventSub scopes.
  client.on('cheer', (channel, tags, message) => {
    emitTwitchEvent('irc', {
      type: 'twitch_cheer',
      platform: 'twitch',
      // Twitch's stand-in for somebody cheering anonymously is an account
      // called AnAnonymousCheerer; the stream says it in its own words.
      user: String(tags.username || '').toLowerCase() === 'ananonymouscheerer' ? ANONYMOUS : (tags['display-name'] || tags.username),
      // The viewer's id, so their bits can be added up for a Discord role.
      // EventSub's copy carries it too; only one of the two is ever emitted.
      data: { bits: Number(tags.bits || 0), amount: Number(tags.bits || 0), currency: 'BITS', message, userId: tags['user-id'] || undefined },
    });
  });

  client.on('raided', (channel, username, viewers) => {
    emitTwitchEvent('irc', {
      type: 'twitch_raid',
      platform: 'twitch',
      user: username,
      data: { amount: Number(viewers || 0), viewers: Number(viewers || 0), currency: 'VIEWERS', login: String(username || '').toLowerCase() },
    });
  });

  const sub = (username, extra = {}) => emitTwitchEvent('irc', {
    type: 'twitch_sub', platform: 'twitch', user: username, data: extra,
  });

  // msg is what they wrote with it, if anything: an alert can show it or read it out.
  client.on('subscription', (ch, username, methods, msg, tags) => sub(username, { tier: tierNumber(methods?.plan), prime: String(methods?.plan).toLowerCase() === 'prime', message: msg || undefined, userId: tags?.['user-id'] || undefined }));
  client.on('resub', (ch, username, months, msg, tags, methods) => sub(username, { tier: tierNumber(methods?.plan), prime: String(methods?.plan).toLowerCase() === 'prime', months, message: msg || undefined, userId: tags?.['user-id'] || undefined }));
  /**
   * Somebody gifting a pile of subs at once.
   *
   * tmi.js announces the bundle, then sends a separate subgift for every
   * recipient — so a fifty-sub bomb arrived as fifty events and, before this,
   * fifty alerts back to back. Each recipient is still emitted, because the
   * event history, levels and tags should all count every sub. They are just
   * marked as part of a bundle so the alert engine can collapse them into the
   * one announcement.
   */
  client.on('submysterygift', (ch, username, count, methods) => {
    const total = Number(count) || 0;
    // Keyed by gifter and given an expiry: if the individual events never
    // arrive, the entry must not sit there marking the next unrelated gift.
    bulkGifts.set(String(username).toLowerCase(), { remaining: total, expires: Date.now() + BULK_GIFT_WINDOW_MS });
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'twitch_sub_gift_bulk', platform: 'twitch', user: username,
      data: { count: total, amount: total, tier: tierNumber(methods?.plan), giftedBy: username },
    }));
  });

  client.on('subgift', (ch, username, months, recipient, methods) => {
    const key = String(username).toLowerCase();
    const bulk = bulkGifts.get(key);
    const fromBulk = Boolean(bulk && bulk.expires > Date.now() && bulk.remaining > 0);
    if (fromBulk) {
      bulk.remaining -= 1;
      if (bulk.remaining <= 0) bulkGifts.delete(key);
    }
    sub(recipient, { giftedBy: username, tier: tierNumber(methods?.plan), fromBulk });
  });
}

/**
 * Send a chat message.
 * @param {string} text
 * @param {{useBot?:boolean, fallbackToMain?:boolean}} opts
 */
export async function say(text, { useBot = false, fallbackToMain = true } = {}) {
  const c = creds.get();
  const client = useBot ? (botClient ?? (fallbackToMain ? mainClient : null)) : mainClient;

  if (!client) {
    log.warn(`cannot send "${text.slice(0, 40)}" — no ${useBot ? 'bot' : 'main'} client connected`);
    return;
  }
  await client.say(c.channel, text);
}

/*
  Lines the chat relay copied over from Discord, until Twitch reports them
  back: that report is dropped, or the line would show twice on the overlay
  and be relayed back into Discord. Keyed by the words, which is all the
  local copy of a sent message carries.
*/
const relayedLines = new Map();
const RELAYED_FOR_MS = 30_000;

/** A line from the Discord relay (engine/relay.js): as the bot when there is one, never seen again. */
export async function sayRelayed(text) {
  const line = String(text ?? '').trim();
  if (!line) return;
  const now = Date.now();
  for (const [words, until] of relayedLines) if (until < now) relayedLines.delete(words);
  relayedLines.set(line, now + RELAYED_FOR_MS);
  await say(line, { useBot: true });
}

/** The relay's own line coming back, said by us: forget it and say so. */
export function isRelayEcho(message, fromUs) {
  const until = relayedLines.get(message);
  if (!until || !fromUs) return false;
  relayedLines.delete(message);
  return until >= Date.now();
}

/**
 * A line typed into the chat dock, sent as whoever the dock says.
 *
 * Apart from say(), which the app's own actions call: a timer firing while
 * Twitch reconnects should shrug and carry on, but a person who typed
 * something needs to hear that it did not go. The dock used to clear the box
 * and lose the message, with nothing but a line in the server log. This
 * refuses out loud instead, with a code the dock turns into words.
 */
export async function sayFromDock(text, { useBot = false } = {}) {
  const line = String(text ?? '').trim();
  if (!line) return;

  // Twitch stopped acting on /commands sent over chat in 2023: /ban, /timeout
  // and the rest now vanish without a word. /me is the only one it still takes.
  if (/^[/\\]/.test(line) && !/^\/me\s/.test(line)) throw refusal('twitch_command', 'Twitch no longer runs /commands sent from chat apps');
  // Longer than this, Twitch drops it without saying so.
  if (Array.from(line).length > 500) throw refusal('too_long', 'Twitch takes 500 characters at most');

  // No quiet fallback from the bot to the main account: that would post as
  // somebody the dock did not say.
  const client = useBot ? botClient : mainClient;
  const up = useBot ? status.bot === 'connected' : status.main === 'connected';
  if (!client || !up) throw refusal(useBot ? 'bot_offline' : 'twitch_offline', `${useBot ? 'the bot' : 'Twitch'} is not connected`);

  await client.say(creds.get().channel, line);
}

function refusal(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Twitch reports a subscription tier as "1000", "2000", "3000" — or "Prime",
 * which is a tier 1 that someone did not pay for.
 *
 * That wire format should stop here rather than reaching a message template,
 * where it rendered as "subscribed at tier 2000", or a variation condition,
 * where "tier is at least 2" would never match anything.
 */
/**
 * Gifters currently mid-bundle, so their individual subgifts can be recognised.
 *
 * The window is generous: the individual events follow the announcement
 * immediately, and an entry that outlives them is harmless because it only
 * ever marks events as belonging to a bundle.
 */
const bulkGifts = new Map();

/**
 * Who an anonymous cheer is from, as the stream says it. Twitch names nobody,
 * so the name is ours — in Spanish, since it goes on stream in an alert and a
 * chat line.
 */
const ANONYMOUS = 'Anónimo';
const BULK_GIFT_WINDOW_MS = 30_000;

/**
 * Twitch tells us some things twice: a sub, a cheer and a raid each arrive over
 * chat (IRC) and over EventSub, a moment apart. Emitted both times, every raid
 * fired two alerts, sat twice in the Events dock, and counted double in the
 * stream's totals and a viewer's bits for a Discord role.
 *
 * So the second telling is dropped — but only when it comes from the other
 * connection. Two cheers of the same size from the same viewer over chat are
 * two cheers; one over chat and one over EventSub, seconds apart, are one.
 */
export const PAIRED_TYPES = ['twitch_sub', 'twitch_cheer', 'twitch_raid'];
const PAIR_WINDOW_MS = 15_000;

export function createPairer(windowMs = PAIR_WINDOW_MS) {
  const waiting = [];
  const keyOf = (e) => `${e.type}:${String(e.user || '').toLowerCase()}:${e.data?.amount ?? e.data?.tier ?? ''}`;
  /** Whether this telling is news, as opposed to the other connection's copy of one already told. */
  return (source, event, now = Date.now()) => {
    while (waiting.length && now - waiting[0].at > windowMs) waiting.shift();
    const key = keyOf(event);
    const twin = waiting.findIndex((w) => w.key === key && w.source !== source);
    if (twin >= 0) {
      waiting.splice(twin, 1);
      return false;
    }
    waiting.push({ key, source, at: now });
    return true;
  };
}
const isNews = createPairer();

/** An event, once — if it is one Twitch tells twice, whichever connection tells it first. */
function emitTwitchEvent(source, event) {
  if (PAIRED_TYPES.includes(event.type) && !isNews(source, event)) {
    log.debug(`${event.type} for ${event.user} also came over ${source} — counted once`);
    return;
  }
  bus.emit(EVENTS.EVENT, normaliseEvent(event));
}

function tierNumber(plan) {
  const raw = String(plan ?? '').toLowerCase();
  if (!raw) return 1;
  if (raw === 'prime') return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n >= 1000 ? Math.round(n / 1000) : Math.round(n);
}

// ---------------------------------------------------------------- EventSub

const EVENTSUB_TOPICS = [
  ['channel.follow', '2', (e) => ({ type: 'twitch_follow', user: e.user_name, data: { userId: e.user_id } })],
  /*
    A gifted sub is told by chat with who gave it and which bundle it belongs
    to. EventSub's copy of it has neither, so it went out as an ordinary new
    sub: a fifty-sub bomb became fifty "new sub" alerts beside the one for the
    bundle. Chat's copy is the one kept.
  */
  ['channel.subscribe', '1', (e) => (e.is_gift ? null : { type: 'twitch_sub', user: e.user_name, data: { tier: tierNumber(e.tier), prime: false, userId: e.user_id } })],
  ['channel.cheer', '1', (e) => ({ type: 'twitch_cheer', user: (!e.is_anonymous && e.user_name) || ANONYMOUS, data: { bits: e.bits, amount: e.bits, currency: 'BITS', message: e.message || undefined, userId: (!e.is_anonymous && e.user_id) || undefined } })],
  ['channel.raid', '1', (e) => ({ type: 'twitch_raid', user: e.from_broadcaster_user_name, data: { amount: e.viewers, viewers: e.viewers, currency: 'VIEWERS', login: e.from_broadcaster_user_login, userId: e.from_broadcaster_user_id } })],
  ['channel.channel_points_custom_reward_redemption.add', '1', (e) => ({
    type: 'twitch_redemption',
    user: e.user_name,
    data: {
      rewardId: e.reward?.id,
      // The Events dock reads `data.reward`; actions and alert templates may
      // reference `{event.rewardName}`. Emit both rather than renaming one and
      // silently breaking the other.
      reward: e.reward?.title,
      rewardName: e.reward?.title,
      cost: e.reward?.cost,
      input: e.user_input,
    },
  })],
  /*
    Not an event anybody watches happen — nothing is alerted and nothing lands
    in the history — so it maps to null and travels as CHANNEL instead. It
    fires for a title edit as much as a category change; telling those apart
    is left to whoever listens, since only they know which one they care about.
    Version 2 asks for no scope, so connecting it needs nobody to log in again.
  */
  ['channel.update', '2', () => null],
  /*
    The Hype Train: not something that happens once, but a state that runs
    for a few minutes, so it is not an event in the history. It travels on
    its own, as twitch:hypetrain, for the layer that draws it and the avatar
    that cheers it on. Version 2 first; version 1 wherever Twitch still has it.
  */
  ['channel.hype_train.begin', ['2', '1'], null, (e) => hypeTrain('begin', e)],
  ['channel.hype_train.progress', ['2', '1'], null, (e) => hypeTrain('progress', e)],
  ['channel.hype_train.end', ['2', '1'], null, (e) => hypeTrain('end', e)],
  /*
    The stream starting and ending, the moment it does, rather than at the
    next minute's live check: TikTok and YouTube only look for a stream of
    their own while this one is live (server/core/twitch-live.js). Neither
    asks for a scope.
  */
  ['stream.online', '1', null, () => bus.emit(EVENTS.STAT, { key: 'twitchLive', value: true })],
  ['stream.offline', '1', null, () => bus.emit(EVENTS.STAT, { key: 'twitchLive', value: false })],
];

/** One Hype Train update, in the fields either version of the event carries. */
function hypeTrain(phase, e) {
  bus.emit('twitch:hypetrain', {
    phase,
    level: Number(e?.level) || 1,
    total: Number(e?.total) || 0,
    progress: Number(e?.progress) || 0,
    goal: Number(e?.goal) || 0,
    expiresAt: e?.expires_at ? Date.parse(e.expires_at) : null,
    endedAt: e?.ended_at ? Date.parse(e.ended_at) : null,
    golden: e?.type === 'golden_kappa' || e?.is_golden_kappa_train === true,
    top: (Array.isArray(e?.top_contributions) ? e.top_contributions : []).slice(0, 3)
      .map((c) => ({ user: c.user_name || c.user_login || '', type: c.type || '', total: Number(c.total) || 0 })),
  });
}

/** The channel as a CHANNEL payload, from Helix's or EventSub's field names. */
const channelPayload = (e, initial) => ({
  categoryId: String(e.category_id ?? e.game_id ?? ''),
  categoryName: String(e.category_name ?? e.game_name ?? ''),
  title: String(e.title ?? ''),
  initial,
});

/**
 * Read what the channel is set to right now.
 *
 * Taken on every EventSub connect, because a change made while this was not
 * listening — the server was off, the phone was asleep — is never announced
 * again. The listener compares it with what it last saw.
 */
async function announceChannel(broadcasterId) {
  try {
    const res = await helix('/channels', { query: { broadcaster_id: broadcasterId } });
    const info = res?.data?.[0];
    if (info) bus.emit(EVENTS.CHANNEL, channelPayload(info, true));
  } catch (err) {
    log.warn(`could not read the channel's category: ${err.message}`);
  }
}

async function connectEventSub() {
  closeEventSub();
  const c = creds.get();

  eventSub = new WebSocket(EVENTSUB_WS);

  eventSub.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      log.warn('EventSub sent unparseable frame:', err.message);
      return;
    }

    const type = msg.metadata?.message_type;

    if (type === 'session_welcome') {
      const sessionId = msg.payload.session.id;
      setStatus({ eventsub: 'connected' });
      log.info('EventSub session established');
      await subscribeTopics(sessionId, c.userId);
      await announceChannel(c.userId);
      return;
    }

    if (type === 'session_keepalive') return;

    if (type === 'session_reconnect') {
      const url = msg.payload.session.reconnect_url;
      log.info('EventSub requested reconnect');
      closeEventSub();
      eventSub = new WebSocket(url);
      return;
    }

    if (type === 'notification') {
      const subType = msg.payload.subscription.type;
      const entry = EVENTSUB_TOPICS.find(([t]) => t === subType);
      if (!entry) return;
      // A topic with a handler of its own is not an event: it goes where the handler sends it.
      if (entry[3]) {
        entry[3](msg.payload.event);
        return;
      }
      if (subType === 'channel.update') {
        bus.emit(EVENTS.CHANNEL, channelPayload(msg.payload.event, false));
        return;
      }
      const mapped = entry[2](msg.payload.event);
      if (!mapped) return;
      emitTwitchEvent('eventsub', { ...mapped, platform: 'twitch' });
    }

    if (type === 'revocation') {
      log.warn(`EventSub subscription revoked: ${msg.payload.subscription?.type}`);
    }
  });

  eventSub.on('close', () => {
    setStatus({ eventsub: 'disconnected' });
    clearTimeout(eventSubKeepalive);
    // Only auto-retry while the main client is still meant to be up.
    if (mainClient) {
      eventSubKeepalive = setTimeout(() => connectEventSub().catch(() => {}), 10_000);
    }
  });

  eventSub.on('error', (err) => log.error('EventSub socket error:', err.message));
}

/** Page through every EventSub subscription registered against this client id. */
async function listSubscriptions() {
  const all = [];
  let cursor;

  do {
    const query = { first: 100 };
    if (cursor) query.after = cursor;
    const page = await helix('/eventsub/subscriptions', { query });
    all.push(...(page?.data ?? []));
    cursor = page?.pagination?.cursor;
  } while (cursor);

  return all;
}

/**
 * Delete subscriptions that can never deliver to us again.
 *
 * Twitch caps how many subscriptions may exist per type+condition, and counts
 * dead ones against that cap until it reaps them. Because a WebSocket
 * subscription is bound to the session that created it, every restart of this
 * server used to strand five more — so after a dozen restarts the cap was full
 * and no events arrived at all ("maximum subscriptions with type and condition
 * exceeded").
 *
 * Two kinds are safe to remove:
 *   - anything not `enabled` (Twitch already marked it dead, e.g.
 *     `websocket_disconnected` after a previous run exited)
 *   - any WebSocket subscription bound to a session that is not ours — those
 *     belong to a prior run that Twitch has not noticed is gone yet, and
 *     nothing can ever be delivered through them to us
 */
async function pruneSubscriptions(sessionId) {
  let subs;
  try {
    subs = await listSubscriptions();
  } catch (err) {
    // Not fatal: we can still try to subscribe, we just cannot tidy up first.
    log.warn(`could not list EventSub subscriptions: ${err.message}`);
    return;
  }

  const stale = subs.filter((s) => s.status !== 'enabled'
    || (s.transport?.method === 'websocket' && s.transport?.session_id !== sessionId));

  if (stale.length === 0) {
    log.debug(`EventSub: ${subs.length} subscription(s) registered, none stale`);
    return;
  }

  let removed = 0;
  for (const s of stale) {
    try {
      await helix('/eventsub/subscriptions', { method: 'DELETE', query: { id: s.id } });
      removed += 1;
    } catch (err) {
      log.debug(`could not delete subscription ${s.id} (${s.type}): ${err.message}`);
    }
  }

  log.info(`EventSub: released ${removed} stale subscription(s) from previous sessions`);
}

async function subscribeTopics(sessionId, broadcasterId) {
  // Reclaim slots held by earlier runs before asking for new ones.
  await pruneSubscriptions(sessionId);

  let created = 0;

  for (const [type, versions] of EVENTSUB_TOPICS) {
    const condition = type === 'channel.raid'
      ? { to_broadcaster_user_id: broadcasterId }
      : { broadcaster_user_id: broadcasterId };

    // channel.follow v2 additionally requires a moderator id.
    if (type === 'channel.follow') condition.moderator_user_id = broadcasterId;

    try {
      // Newest version first; an older one only if Twitch refuses the version itself.
      const tries = [].concat(versions);
      for (let i = 0; i < tries.length; i += 1) {
        try {
          await helix('/eventsub/subscriptions', {
            method: 'POST',
            body: { type, version: tries[i], condition, transport: { method: 'websocket', session_id: sessionId } },
          });
          break;
        } catch (err) {
          if (i === tries.length - 1 || !/version|invalid|unsupported|400/i.test(err.message)) throw err;
        }
      }
      created += 1;
      log.debug(`subscribed to ${type}`);
    } catch (err) {
      // A missing scope should degrade that one topic, not the whole connection.
      if (/maximum subscriptions/i.test(err.message)) {
        log.warn(`could not subscribe to ${type}: Twitch still reports the per-type limit as full. `
          + 'Subscriptions from an earlier run may not be released yet; they normally clear within a few minutes.');
      } else if (/missing scope|unauthorized|401/i.test(err.message)) {
        log.warn(`could not subscribe to ${type}: the Twitch token is missing a required scope. `
          + 'Log out and back in on the Connections screen to re-authorise.');
      } else {
        log.warn(`could not subscribe to ${type}: ${err.message}`);
      }
    }
  }

  if (created === EVENTSUB_TOPICS.length) {
    log.info(`EventSub: subscribed to all ${created} event types`);
  } else {
    log.warn(`EventSub: subscribed to ${created}/${EVENTSUB_TOPICS.length} event types — `
      + 'the rest will not trigger alerts or actions');
  }
}

function closeEventSub() {
  clearTimeout(eventSubKeepalive);
  if (!eventSub) return;

  const sock = eventSub;
  eventSub = null;

  sock.removeAllListeners();
  // Closing a socket that is still CONNECTING makes `ws` emit an async error.
  // With every listener just removed there would be nothing to receive it, and
  // an unhandled 'error' event throws — which is exactly how a normal
  // reconnect was surfacing as "WebSocket was closed before the connection was
  // established" in the log. Absorb it deliberately.
  sock.on('error', () => {});
  try { sock.close(); } catch { /* already closed */ }
}

// ------------------------------------------------------------- extras

/** A channel's title and category, by its broadcaster id. */
export async function channelOf(broadcasterId) {
  const res = await helix('/channels', { query: { broadcaster_id: broadcasterId } });
  return res?.data?.[0] ?? null;
}

/**
 * Twitch's own shoutout, from this channel to another — the card on Twitch
 * with their follow button. Needs moderator:manage:shoutouts, and the stream
 * live; Twitch allows one every two minutes, and the same channel once an hour.
 */
export async function sendShoutout(toBroadcasterId) {
  const c = creds.get();
  await helix('/chat/shoutouts', {
    method: 'POST',
    query: { from_broadcaster_id: c.userId, to_broadcaster_id: toBroadcasterId, moderator_id: c.userId },
  });
}

/** A marker at this moment of the live stream, to find it again in the VOD. Needs channel:manage:broadcast. */
/**
 * Ban somebody from the channel's chat, or time them out for `seconds`.
 * The channel's own login acts as moderator, so it needs
 * moderator:manage:banned_users — a login from before it was asked for has to
 * connect again.
 */
export async function banUser(userId, { seconds = 0, reason = '' } = {}) {
  const c = creds.get();
  if (!c.userId) throw refusal('twitch_offline', 'Twitch: not authenticated');
  try {
    await helix('/moderation/bans', {
      method: 'POST',
      query: { broadcaster_id: c.userId, moderator_id: c.userId },
      body: { data: { user_id: String(userId), ...(seconds ? { duration: Math.min(1_209_600, Math.max(1, Math.round(seconds))) } : {}), ...(reason ? { reason: String(reason).slice(0, 500) } : {}) } },
    });
  } catch (err) {
    if (err.status === 401 || err.status === 403) throw refusal('twitch_ban_scope', 'Twitch: connect again on the Connections screen to allow banning (moderator:manage:banned_users)');
    throw err;
  }
  return { ok: true };
}

export async function createMarker(description = '') {
  const c = creds.get();
  const text = String(description ?? '').trim().slice(0, 140);
  const res = await helix('/streams/markers', { method: 'POST', body: { user_id: c.userId, ...(text ? { description: text } : {}) } });
  const m = res?.data?.[0];
  return m ? { id: m.id, at: m.position_seconds ?? null, description: m.description || text } : null;
}

/** A clip of the last half minute of the live stream. Needs clips:edit. */
export async function createClip() {
  const c = creds.get();
  const res = await helix('/clips', { method: 'POST', query: { broadcaster_id: c.userId } });
  const clip = res?.data?.[0];
  return clip ? { id: clip.id, url: `https://clips.twitch.tv/${clip.id}`, editUrl: clip.edit_url || '' } : null;
}

/**
 * The channel's stream schedule: the next few streams on it, soonest first,
 * cancelled ones left out. A channel with no schedule has none, not an error.
 */
export async function fetchSchedule(first = 5) {
  const c = creds.get();
  let res;
  try {
    res = await helix('/schedule', { query: { broadcaster_id: c.userId, first } });
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
  return (res?.data?.segments ?? [])
    .filter((s) => !s.canceled_until)
    // The id names this one stream on the schedule, so a Discord event made for it can follow it.
    .map((s) => ({ id: s.id || '', start: s.start_time, end: s.end_time || null, title: s.title || '', category: s.category?.name || '' }));
}

/** The permissions the channel's Twitch login was given, or null when it cannot tell. */
export async function tokenScopes() {
  const c = creds.get();
  if (!c.accessToken) return null;
  const res = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${c.accessToken}` } });
  if (!res.ok) return null;
  const json = await res.json();
  return Array.isArray(json?.scopes) ? json.scopes : [];
}

export const service = { say, getStatus, setTitle, setCategory, getUser, fetchRewards, searchCategories, channelOf, sendShoutout, createMarker, createClip, fetchSchedule, tokenScopes };
