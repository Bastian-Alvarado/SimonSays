/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord voice: who is in the call, and who is talking right now.
 *
 * For the overlay where each person in a voice call has an avatar that lights
 * up while they speak. Most tools build that on Discord's StreamKit, which
 * reads the local Discord client over an RPC only Discord-approved apps may
 * use — so it cannot run on the phone this server lives on. This does it
 * from the bot instead, in two layers:
 *
 *   Who is in the call  from the gateway's voice states, which the bot hears
 *                       anyway. Names, avatars, muted, deafened, live.
 *   Who is talking      only while the bot has joined the call. Discord sends
 *                       each voice a stream of packets while it talks and
 *                       stops when it goes quiet, and every packet's header
 *                       says whose it is. Watching which headers arrive is
 *                       the whole of it: the audio inside is never decrypted,
 *                       decoded or kept. The bot joins muted.
 *
 * The joining is Discord's own voice library, which also carries Discord's
 * end-to-end voice encryption (DAVE) that a bot must support to join a call
 * at all. It speaks to our gateway through an adapter: it hands us the voice
 * state it wants sent, and we hand it the two replies Discord sends back.
 *
 * Which call: a chosen channel, or wherever one person is — follow yourself,
 * and the overlay goes where you go. The bot only sits in a call with
 * somebody in it: it joins when somebody is there, and leaves once everybody
 * has been gone for two minutes, long enough that a dropped connection or a
 * quick trip to another channel is not taken for the call ending.
 *
 * Per person, beside their pictures and pin: a name to show on stream in
 * place of their Discord one, and whether they appear on stream at all.
 * Somebody who would rather not is left out of `members` — the list every
 * overlay, text value and seat reads — and listed apart, in `offStream`, for
 * the Voice call screen only.
 */

import { joinVoiceChannel, entersState, VoiceConnectionStatus } from '@discordjs/voice';
import { voiceLook } from '../../shared/pixel-avatars.js';
import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as discord from './discord.js';

const log = createLogger('discord-voice');

let settings = null;
/** userId → where they are and how, for everyone in a voice channel of the guild. */
const present = new Map();
/** userId → { name, avatar }, from whatever last told us. */
const people = new Map();
/** Who is talking right now. */
const speaking = new Set();
/** userId → when they last stopped talking, for "started talking after a pause". */
const lastQuiet = new Map();
/** userId → the reaction they just sent in the call, while it shows. */
const reactions = new Map();
let reactionCount = 0;
/** How long a reaction stays over somebody's tile. */
export const REACTION_MS = 5000;
/** Talking again within this long is the same stretch of talking, not a new start (engine MIN_CALL_QUIET_S). */
export const MIN_QUIET_MS = 10_000;
/** While the server's whole call list is read on connecting: nobody is "joining" then. */
let loading = false;

let connection = null;
let adapter = null;
/** The channel the bot has joined, or is joining. */
let joinedChannel = '';
/** off | waiting | joining | listening | error. Waiting: listening is on, but nobody is in the call. */
let status = 'off';
let lastError = '';
/** What the screen looks up to say the status in its own language (see web/words.ts). */
let errorCode = '';
let publishTimer = null;
let retryTimer = null;
let emptyTimer = null;
let staleTimer = null;

/** How long a call stays empty before the bot takes it as over and leaves. */
export const EMPTY_GRACE_MS = 2 * 60 * 1000;
/** How long the gateway may be gone before who was in the call is forgotten. */
const STALE_MS = 60 * 1000;

const DEFAULT_SETTINGS = { channelId: '', listen: false, pictures: {}, pinned: [], follow: null, persons: {} };

const guildId = () => discord.getSettings().guildId || '';

/**
 * A Discord avatar: the one set for this server if there is one, the
 * account's otherwise, and Discord's own default for an account without.
 */
function avatarOf(userId, user, member, guild) {
  if (member?.avatar && guild) return `https://cdn.discordapp.com/guilds/${guild}/users/${userId}/avatars/${member.avatar}.png?size=128`;
  if (user?.avatar) return `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png?size=128`;
  let index = 0;
  try { index = Number((BigInt(userId) >> 22n) % 6n); } catch { /* not a snowflake */ }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function remember(userId, member, guild) {
  const user = member?.user;
  if (!user) return;
  people.set(userId, {
    // On stream if nothing else names them, so in the stream's language.
    name: member.nick || user.global_name || user.username || 'Alguien',
    avatar: avatarOf(userId, user, member, guild),
    bot: Boolean(user.bot),
  });
}

/*
  Everybody in the server, not only whoever is in a call: so a regular can be
  set up — their pictures, their look, their name on stream — before they
  ever join one. Bots left out, by name, each with the name and picture
  they have here. Kept a minute, so opening the list again does not ask
  Discord again.
*/
const SERVER_MEMBERS_TTL_MS = 60 * 1000;
let serverMembersCache = null;

/** Discord's member records as the Voice call screen lists them: people only, by name. */
export function serverMemberList(members, guild) {
  return (Array.isArray(members) ? members : [])
    .filter((m) => m?.user?.id && !m.user.bot)
    .map((m) => ({
      id: m.user.id,
      name: m.nick || m.user.global_name || m.user.username || m.user.id,
      username: m.user.username || '',
      avatar: avatarOf(m.user.id, m.user, m, guild),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function serverMembers() {
  const guild = guildId();
  if (!guild) throw new Error('No Discord server is chosen yet');
  if (serverMembersCache?.guild === guild && Date.now() - serverMembersCache.at < SERVER_MEMBERS_TTL_MS) return serverMembersCache.list;
  const raw = await discord.listMembers(guild);
  // What names a voice state later, while we have it.
  for (const m of raw) if (m?.user?.id) remember(m.user.id, m, guild);
  const list = serverMemberList(raw, guild);
  serverMembersCache = { guild, at: Date.now(), list };
  return list;
}

/** Somebody in a voice state we have no name for yet: ask once. */
const asked = new Set();
function lookUp(userId) {
  const guild = guildId();
  if (people.has(userId) || asked.has(userId) || !guild) return;
  asked.add(userId);
  discord.request('GET', `/guilds/${guild}/members/${userId}`)
    .then((member) => { remember(userId, member, guild); publish(); })
    .catch((err) => log.debug(`could not look up ${userId}: ${err.message}`));
}

/*
  Somebody's own pictures, PNGtuber style: one while they are quiet, one
  while they talk, and one for muted if they want it. They belong to the
  person rather than to a layer — set once, and every voice layer uses them.
  Kept by Discord id with the name they had, so they can be listed and
  changed while that person is not in the call.
*/
const MAX_PICTURED = 50;
const PICTURE_KINDS = ['quiet', 'talking', 'muted'];

/** An uploaded file, or a picture on the web. Nothing else is drawn. */
const pictureUrl = (v) => {
  const url = String(v ?? '').trim();
  if (url.length > 300) return '';
  return /^\/media\/[\w.-]+$/.test(url) || /^https?:\/\/\S+$/.test(url) ? url : '';
};

export function cleanPictures(incoming) {
  const out = {};
  const entries = incoming && typeof incoming === 'object' ? Object.entries(incoming) : [];
  for (const [id, raw] of entries) {
    if (!/^\d{5,25}$/.test(id) || !raw || typeof raw !== 'object') continue;
    const entry = { name: String(raw.name ?? '').trim().slice(0, 40) };
    for (const kind of PICTURE_KINDS) {
      const url = pictureUrl(raw[kind]);
      if (url) entry[kind] = url;
    }
    // Drawn as the pixel avatar (shared/avatar.js), which talks and blinks by itself, in the look chosen for them.
    if (raw.avatar === true) entry.avatar = true;
    // The look is kept with the pictures while the avatar is off, for turning it on again.
    // The built-in avatar's look, or a pixel avatar's from the Pixel avatars tab.
    const look = voiceLook(raw.look);
    if (Object.keys(look).length) entry.look = look;
    // Somebody with no pictures left is not somebody with pictures.
    if (!entry.avatar && !PICTURE_KINDS.some((k) => entry[k])) continue;
    out[id] = entry;
    if (Object.keys(out).length >= MAX_PICTURED) break;
  }
  return out;
}

/*
  People who always come first — co-hosts, the regulars — in the order they
  are listed, ahead of everybody else, who follow in the order they joined.
  Like the pictures, it belongs to the person, so every layer agrees on the
  order; kept with a name so the list reads while they are not in the call.
*/
const MAX_PINNED = 25;

export function cleanPinned(incoming) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const id = String(raw?.id ?? '');
    if (!/^\d{5,25}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: String(raw?.name ?? '').trim().slice(0, 40) });
    if (out.length >= MAX_PINNED) break;
  }
  return out;
}

/** The one person whose call is followed, instead of a fixed channel. */
export function cleanFollow(incoming) {
  const id = String(incoming?.id ?? '');
  return /^\d{5,25}$/.test(id) ? { id, name: String(incoming?.name ?? '').trim().slice(0, 40) } : null;
}

/**
 * Per person: the name to show on stream in place of their Discord one, and
 * whether they appear on stream at all. Kept by Discord id with the name they
 * had, so it holds while they are away and reads in a list.
 */
const MAX_PERSONS = 100;

export function cleanPersons(incoming) {
  const out = {};
  const entries = incoming && typeof incoming === 'object' ? Object.entries(incoming) : [];
  for (const [id, raw] of entries) {
    if (!/^\d{5,25}$/.test(id) || !raw || typeof raw !== 'object') continue;
    const streamName = String(raw.streamName ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const offStream = raw.offStream === true;
    // Somebody with nothing set is not somebody with settings.
    if (!streamName && !offStream) continue;
    out[id] = {
      name: String(raw.name ?? '').trim().slice(0, 40),
      ...(streamName ? { streamName } : {}),
      ...(offStream ? { offStream: true } : {}),
    };
    if (Object.keys(out).length >= MAX_PERSONS) break;
  }
  return out;
}

const botIdNow = () => discord.getStatus().botUserId;
const isHuman = (v) => v.userId !== botIdNow() && !people.get(v.userId)?.bot;

/** The call being shown: wherever the followed person is, or the chosen channel. */
function channelNow() {
  const s = settings?.get() ?? DEFAULT_SETTINGS;
  if (s.follow?.id) return present.get(s.follow.id)?.channelId || '';
  return s.channelId || '';
}

const humansIn = (channelId) => [...present.values()].filter((v) => v.channelId === channelId && isHuman(v)).length;

/**
 * The call as every surface sees it: which channel, and who is in it.
 *
 * `members` is who may be shown on stream, and is all any overlay reads.
 * Whoever asked not to be shown is in `offStream` instead, for the Voice call
 * screen, where they can be let back on.
 */
export function getState() {
  const s = settings?.get() ?? DEFAULT_SETTINGS;
  const pictures = s.pictures || {};
  const pinned = s.pinned || [];
  const persons = s.persons || {};
  const channelId = channelNow();
  const pinRank = new Map(pinned.map((p, i) => [p.id, i]));
  const rank = (id) => (pinRank.has(id) ? pinRank.get(id) : Infinity);
  const everyone = [...present.values()]
    .filter((v) => channelId && v.channelId === channelId && isHuman(v))
    // Pinned first, in their order; then everybody else by when they joined.
    .sort((a, b) => (rank(a.userId) - rank(b.userId)) || (a.since - b.since))
    .map((v) => {
      const who = people.get(v.userId) || {};
      const own = persons[v.userId] || {};
      return {
        id: v.userId,
        // The name for the stream, if one was given; their Discord one otherwise.
        name: own.streamName || who.name || 'Alguien',
        discordName: who.name || '',
        avatar: who.avatar || avatarOf(v.userId),
        speaking: speaking.has(v.userId),
        muted: Boolean(v.selfMute || v.mute),
        deafened: Boolean(v.selfDeaf || v.deaf),
        streaming: Boolean(v.streaming),
        video: Boolean(v.video),
        ...(pictures[v.userId] ? { pictures: pictures[v.userId] } : {}),
        ...(reactions.has(v.userId) ? { reaction: reactions.get(v.userId) } : {}),
        ...(pinRank.has(v.userId) ? { pinned: true } : {}),
        ...(own.offStream ? { offStream: true } : {}),
      };
    });
  // Who is in any call on the server, to choose somebody to follow.
  const inVoice = [...present.values()].filter(isHuman).map((v) => ({
    id: v.userId, name: people.get(v.userId)?.name || v.userId, channelId: v.channelId,
  }));
  return {
    channelId,
    chosenChannelId: s.channelId || '',
    follow: s.follow || null,
    listen: s.listen,
    status,
    error: lastError,
    errorCode,
    members: everyone.filter((m) => !m.offStream),
    offStream: everyone.filter((m) => m.offStream),
    pictures,
    pinned,
    persons,
    inVoice,
  };
}

/*
  Talking starts and stops many times a second in a lively call, so changes
  are told at most every 60ms, far fewer frames than one per packet. The
  first change after a quiet spell goes at once, though: holding it back
  would put the whole 60ms between the first word and the ring lighting,
  which is exactly the moment the delay shows.
*/
const PUBLISH_GAP_MS = 60;
let lastPublished = 0;
function publish() {
  if (publishTimer) return;
  const send = () => {
    publishTimer = null;
    lastPublished = Date.now();
    bus.emit(EVENTS.CONFIG, { key: 'voice', value: getState() });
  };
  const wait = lastPublished + PUBLISH_GAP_MS - Date.now();
  if (wait <= 0) send();
  else publishTimer = setTimeout(send, wait);
}

function setStatus(next, error = '', code = '') {
  status = next;
  lastError = error;
  errorCode = code;
  publish();
}

// ----------------------------------------------------------- who is in a call

// ------------------------------------------------- what the call sets off

/**
 * Who is in the call being shown, by id — humans only, the people its
 * triggers are about.
 */
function callNow() {
  const channelId = channelNow();
  const ids = new Set([...present.values()].filter((v) => channelId && v.channelId === channelId && isHuman(v)).map((v) => v.userId));
  return { channelId, ids };
}

/** Tell the actions (engine EVENTS.TRIGGER): never an alert, never in the history. */
function trigger(type, userId, data = {}) {
  const who = people.get(userId) || {};
  const own = (settings?.get().persons || {})[userId] || {};
  bus.emit(EVENTS.TRIGGER, normaliseEvent({
    type,
    platform: 'discord',
    user: own.streamName || who.name || 'Alguien',
    avatar: who.avatar || (userId ? avatarOf(userId) : undefined),
    data: { userId: userId || '', ...data },
  }));
}

/**
 * Somebody coming into or leaving the call being shown, and the number in it
 * changing. The call itself moving — following somebody to another channel —
 * is not everybody joining: only the count is told then.
 */
function compareCalls(before, after) {
  if (loading) return;
  if (before.channelId === after.channelId && after.channelId) {
    for (const id of after.ids) if (!before.ids.has(id)) trigger('discord_call_join', id, { count: after.ids.size });
    for (const id of before.ids) if (!after.ids.has(id)) trigger('discord_call_leave', id, { count: after.ids.size });
  }
  if (before.ids.size !== after.ids.size && after.channelId) {
    const changed = [...after.ids].find((id) => !before.ids.has(id)) || [...before.ids].find((id) => !after.ids.has(id)) || '';
    trigger('discord_call_count', changed, { count: after.ids.size, previous: before.ids.size });
  }
}

/**
 * Somebody starting to talk. Only a start after a pause is told — talking
 * stops and starts many times a second — with how long the pause was, so an
 * action can ask for a longer one (engine passesFilter).
 */
function startedTalking(userId, now = Date.now()) {
  const was = lastQuiet.get(userId);
  const quietFor = was === undefined ? Infinity : now - was;
  if (quietFor >= MIN_QUIET_MS && callNow().ids.has(userId)) {
    trigger('discord_call_talking', userId, { quietFor: Number.isFinite(quietFor) ? quietFor : 86_400_000 });
  }
}

/**
 * A reaction somebody sent in the call — an emoji, or a soundboard sound —
 * shown over their tile for a few seconds. A server's own emoji is its
 * picture; a sound with no emoji shows as a speaker.
 */
export function onVoiceEffect(d) {
  if (!d?.user_id || d.guild_id !== guildId() || d.channel_id !== channelNow()) return null;
  const e = d.emoji;
  const reaction = {
    id: (reactionCount += 1),
    ...(e?.id ? { url: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'png'}` }
      : e?.name ? { text: e.name } : { text: '🔊' }),
    ...(d.sound_id !== undefined && d.sound_id !== null ? { sound: true } : {}),
  };
  reactions.set(d.user_id, reaction);
  publish();
  setTimeout(() => {
    if (reactions.get(d.user_id)?.id !== reaction.id) return;
    reactions.delete(d.user_id);
    publish();
  }, REACTION_MS).unref?.();
  return reaction;
}

// ----------------------------------------------------------- who is in a call

function applyVoiceState(d) {
  if (!d?.user_id || (d.guild_id && d.guild_id !== guildId())) return;
  const callBefore = callNow();
  if (d.member) remember(d.user_id, d.member, d.guild_id);
  if (!d.channel_id) {
    present.delete(d.user_id);
    speaking.delete(d.user_id);
  } else {
    const before = present.get(d.user_id);
    present.set(d.user_id, {
      userId: d.user_id,
      channelId: d.channel_id,
      mute: d.mute, deaf: d.deaf, selfMute: d.self_mute, selfDeaf: d.self_deaf,
      streaming: d.self_stream, video: d.self_video,
      // Moving channel counts as arriving, so the order is who came in first.
      since: before && before.channelId === d.channel_id ? before.since : Date.now(),
    });
    if (!people.has(d.user_id)) lookUp(d.user_id);
  }
  compareCalls(callBefore, callNow());
  publish();
  checkCall();
}

function onGuildCreate(d) {
  if (d?.id !== guildId()) return;
  for (const m of d.members || []) if (m.user) remember(m.user.id, m, d.id);
  present.clear();
  loading = true;
  try {
    for (const v of d.voice_states || []) applyVoiceState({ ...v, guild_id: d.id });
  } finally {
    loading = false;
  }
  log.info(`${present.size} in voice on the server`);
  checkCall();
}

function onVoiceState(d) {
  applyVoiceState(d);
  // The bot's own voice state is also the library's reply to joining.
  if (d?.user_id === discord.getStatus().botUserId && d.guild_id === guildId()) adapter?.onVoiceStateUpdate(d);
}

function onVoiceServer(d) {
  if (d?.guild_id === guildId()) adapter?.onVoiceServerUpdate(d);
}

// ----------------------------------------------------------- who is talking

/** Out of the call, without saying anything about why. */
function hangUp() {
  if (connection) {
    try { connection.destroy(); } catch { /* already gone */ }
    connection = null;
  }
  joinedChannel = '';
  speaking.clear();
}

function stopEmptyClock() {
  clearTimeout(emptyTimer);
  emptyTimer = null;
}

function leave() {
  clearTimeout(retryTimer);
  retryTimer = null;
  stopEmptyClock();
  hangUp();
  setStatus('off');
}

/** Listening is on, but there is nobody to listen to: out of the call until somebody comes. */
function wait() {
  stopEmptyClock();
  hangUp();
  const following = Boolean(settings.get().follow?.id);
  setStatus('waiting', following ? 'the person being followed is not in a call' : 'nobody is in the call', following ? 'voice_waiting_follow' : 'voice_waiting_empty');
}

/**
 * The call went quiet — everybody left, or the person being followed did.
 * Two minutes, in case it was a dropped connection or a quick trip to another
 * channel, then out.
 */
function startEmptyClock() {
  if (emptyTimer) return;
  emptyTimer = setTimeout(() => {
    emptyTimer = null;
    const want = channelNow();
    if (!want || humansIn(want) === 0) {
      log.info('everybody has left the call — leaving it too');
      wait();
    }
  }, EMPTY_GRACE_MS);
}

/**
 * Whether the bot should be in a call, and which, after anything changed:
 * somebody joining or leaving, the followed person moving, a setting.
 */
function checkCall() {
  if (!settings) return;
  const s = settings.get();
  if (!s.listen) {
    if (connection || status !== 'off') leave();
    return;
  }
  const want = channelNow();
  if (!want) {
    // Nobody to follow into a call, or no channel. A call the bot is in gets its two minutes.
    if (connection) startEmptyClock();
    else if (status !== 'waiting') wait();
    return;
  }
  const here = humansIn(want);
  if (want !== joinedChannel) {
    // A join that failed tries again on its own clock, not on every change in the call.
    if (retryTimer) return;
    if (here > 0) {
      stopEmptyClock();
      join(want);
    } else if (status !== 'waiting' || connection) {
      wait();
    }
    return;
  }
  if (here > 0) stopEmptyClock();
  else startEmptyClock();
}

/**
 * Join a channel to hear who is talking. Muted, and never deaf: a deafened
 * account is sent no voice at all, so it could not tell.
 */
async function join(channelId) {
  const guild = guildId();
  if (!channelId || !guild) return;
  if (discord.getStatus().status !== 'connected') {
    hangUp();
    setStatus('joining', 'waiting for the Discord bot to connect', 'voice_waiting_bot');
    return;
  }

  hangUp();
  joinedChannel = channelId;
  setStatus('joining');

  const conn = joinVoiceChannel({
    channelId,
    guildId: guild,
    selfMute: true,
    selfDeaf: false,
    adapterCreator: (methods) => {
      adapter = methods;
      return {
        sendPayload: (payload) => discord.gatewaySend(payload.op, payload.d),
        destroy: () => { if (adapter === methods) adapter = null; },
      };
    },
  });
  connection = conn;

  conn.receiver.speaking.on('start', (userId) => {
    if (!speaking.has(userId)) startedTalking(userId);
    speaking.add(userId);
    publish();
  });
  conn.receiver.speaking.on('end', (userId) => { speaking.delete(userId); lastQuiet.set(userId, Date.now()); publish(); });

  conn.on('stateChange', (before, after) => {
    if (conn !== connection) return;
    log.debug(`voice ${before.status} → ${after.status}`);
    if (after.status === VoiceConnectionStatus.Ready) {
      setStatus('listening');
      log.info('listening for who is talking');
    }
    if (after.status === VoiceConnectionStatus.Disconnected) {
      /*
        Moved to another channel or a network blip: the library reconnects on
        its own if it can. If it has not within a few seconds, start again.
      */
      Promise.race([
        entersState(conn, VoiceConnectionStatus.Signalling, 5000),
        entersState(conn, VoiceConnectionStatus.Connecting, 5000),
      ]).catch(() => {
        if (conn !== connection) return;
        log.warn('lost the voice call — joining again');
        retrySoon('lost the call', 'voice_lost');
      });
    }
  });
  conn.on('error', (err) => {
    if (conn !== connection) return;
    log.warn(`voice error: ${err.message}`);
    setStatus('error', err.message, 'voice_error');
  });

  try {
    await entersState(conn, VoiceConnectionStatus.Ready, 20000);
  } catch (err) {
    if (conn !== connection) return;
    log.warn(`could not join the voice channel: ${err.message}`);
    retrySoon('could not join the channel — check the bot may see and connect to it', 'voice_cannot_join');
  }
}

function retrySoon(why, code) {
  hangUp();
  setStatus('error', why, code);
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = null; checkCall(); }, 15000);
}

// ----------------------------------------------------------------- settings

export function setVoice(patch) {
  const before = { ...DEFAULT_SETTINGS, ...settings.get() };
  const next = {
    channelId: typeof patch?.channelId === 'string' ? patch.channelId.slice(0, 32) : before.channelId,
    listen: typeof patch?.listen === 'boolean' ? patch.listen : before.listen,
    pictures: patch?.pictures !== undefined ? cleanPictures(patch.pictures) : cleanPictures(before.pictures),
    pinned: patch?.pinned !== undefined ? cleanPinned(patch.pinned) : cleanPinned(before.pinned),
    follow: patch?.follow !== undefined ? cleanFollow(patch.follow) : cleanFollow(before.follow),
    persons: patch?.persons !== undefined ? cleanPersons(patch.persons) : cleanPersons(before.persons),
  };
  settings.set(next);
  // Somebody changing a setting is not waiting on a retry.
  clearTimeout(retryTimer);
  retryTimer = null;
  checkCall();
  publish();
  return getState();
}

export function initDiscordVoice() {
  settings = collection('discord_voice', DEFAULT_SETTINGS);
  bus.on('discord:guild_create', onGuildCreate);
  bus.on('discord:voice_state', onVoiceState);
  bus.on('discord:voice_server', onVoiceServer);
  // Reactions and soundboard sounds in the call, shown over whoever sent them.
  bus.on('discord:voice_effect', onVoiceEffect);
  // A fresh gateway session drops the old call with it: join again once it is up.
  bus.on('discord:ready', () => {
    clearTimeout(staleTimer);
    hangUp();
    setTimeout(checkCall, 1000);
  });
  bus.on('discord:resumed', () => clearTimeout(staleTimer));
  /*
    The gateway dropped. Nobody can be known to be talking, so nobody stays
    lit. Who is in the call is kept, since a resumed session only replays what
    changed; if the bot is still gone after a minute, it is forgotten rather
    than left on stream as a picture of how things were.
  */
  bus.on('discord:closed', () => {
    speaking.clear();
    publish();
    clearTimeout(staleTimer);
    staleTimer = setTimeout(() => { present.clear(); publish(); }, STALE_MS);
  });
}

export function stopDiscordVoice() {
  clearTimeout(publishTimer);
  clearTimeout(emptyTimer);
  clearTimeout(staleTimer);
  clearTimeout(retryTimer);
  if (connection) {
    try { connection.destroy(); } catch { /* already gone */ }
    connection = null;
  }
}
