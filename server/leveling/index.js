/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Unified XP / leveling.
 *
 * Identity model (carried over from V2): a `user` record holds the XP, and an
 * `accounts` map points `platform:id` keys at it. Linking two platforms is
 * therefore just repointing a key and merging the records.
 *
 * The important V3 change is the input: V2 awarded XP from a `report_chat`
 * message that the *browser* sent, so XP only accrued while a tab was open.
 * We now subscribe to the bus directly.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';

const log = createLogger('leveling');

const DEFAULT_CONFIG = {
  enabled: true,
  xpRate: 1,
  minXp: 15,
  maxXp: 25,
  cooldown: 60,
  levelUpMessage: '🎉 GG {user}! You just reached **Level {level}**!',
  announceChannelId: null,
  roleRewards: [],
  ignoredChannelIds: [],
};

/*
  "!rank" and "!top" in chat (leveling/chat.js): the words that ask, what is
  answered, and whether YouTube is answered at all — each answer there costs
  50 of its 10,000 units a day. In the stream's language, like "!plan".
*/
export const DEFAULT_LEVEL_CHAT = {
  enabled: true,
  rankWord: '!rank',
  topWord: '!top',
  rankText: '{user}: nivel {level} · {xp} XP · puesto #{rank} de {total}',
  topText: 'Top {count}: {top}',
  topCount: 5,
  youtube: true,
};

/** The chat answers as stored: words of a sane length, a count of 1 to 10. */
export function cleanLevelChat(c) {
  const word = (v, fallback) => {
    const w = String(v ?? '').trim().split(/\s+/)[0].slice(0, 30);
    return w || fallback;
  };
  const text = (v, fallback, max) => String(v ?? '').trim().slice(0, max) || fallback;
  const count = Number(c?.topCount);
  return {
    enabled: c?.enabled !== false,
    rankWord: word(c?.rankWord, DEFAULT_LEVEL_CHAT.rankWord),
    topWord: word(c?.topWord, DEFAULT_LEVEL_CHAT.topWord),
    rankText: text(c?.rankText, DEFAULT_LEVEL_CHAT.rankText, 200),
    topText: text(c?.topText, DEFAULT_LEVEL_CHAT.topText, 200),
    topCount: Number.isFinite(count) ? Math.min(10, Math.max(1, Math.round(count))) : DEFAULT_LEVEL_CHAT.topCount,
    youtube: c?.youtube !== false,
  };
}

let users = null;
let accounts = null;
let cfg = null;

export const getLevel = (xp) => Math.floor(0.1 * Math.sqrt(Math.max(0, xp)));

export function initLeveling() {
  users = collection('users', {});
  accounts = collection('accounts', {});
  cfg = collection('xp_config', DEFAULT_CONFIG);

  migrateLegacy();

  const onMessage = (chat) => {
    if (!cfg.get().enabled) return;
    // Discord channels can be excluded from XP; other platforms have no
    // equivalent concept so the check simply does not apply to them.
    if (chat.platform === 'discord') {
      const ignored = cfg.get().ignoredChannelIds || [];
      if (ignored.includes(chat.raw?.channelId)) return;
    }
    award(chat).catch((err) => log.error('award failed:', err));
  };
  bus.on(EVENTS.CHAT, onMessage);
  // The rest of the Discord server: not the stream's chat, but talking there counts too.
  bus.on('discord:message_elsewhere', onMessage);

  log.info(`ready — ${Object.keys(users.get()).length} users tracked`);
}

/** One-time import of the V2 `xp_data.json` shape. */
function migrateLegacy() {
  const legacy = collection('xp_data', null).get();
  if (!legacy || Object.keys(users.get()).length > 0) return;

  log.info('migrating legacy xp_data into the unified identity store');
  const u = {};
  const a = {};

  for (const [key, profile] of Object.entries(legacy)) {
    const uid = newUid();
    u[uid] = {
      id: uid,
      username: profile.username,
      avatar: profile.avatar,
      xp: profile.xp || 0,
      level: profile.level || 0,
      lastXpTime: profile.lastXpTime || 0,
      createdAt: Date.now(),
    };
    a[key] = uid;
  }

  users.set(u);
  accounts.set(a);
  log.info(`migrated ${Object.keys(u).length} users`);
}

const newUid = () => `u_${Math.random().toString(36).slice(2, 11)}`;

/** Resolve (or create) the unified user for a platform identity. */
function resolveUser(platform, id, username, avatar) {
  const key = `${platform}:${id}`;
  const map = accounts.get();

  let uid = map[key];
  if (!uid || !users.get()[uid]) {
    uid = newUid();
    users.update((prev) => {
      prev[uid] = { id: uid, username, avatar, xp: 0, level: 0, lastXpTime: 0, createdAt: Date.now() };
      return prev;
    });
    accounts.update((prev) => { prev[key] = uid; return prev; });
  }
  return uid;
}

async function award(chat) {
  const c = cfg.get();
  const identityId = chat.userId || chat.user;
  const uid = resolveUser(chat.platform, identityId, chat.user, chat.avatar);

  const user = users.get()[uid];
  const now = Date.now();

  if (now - (user.lastXpTime || 0) < c.cooldown * 1000) return;

  const base = Math.floor(Math.random() * (c.maxXp - c.minXp + 1)) + c.minXp;
  const gain = Math.max(0, Math.round(base * (c.xpRate || 1)));

  const nextXp = user.xp + gain;
  const nextLevel = getLevel(nextXp);
  const levelledUp = nextLevel > user.level;

  users.update((prev) => {
    prev[uid] = {
      ...prev[uid],
      username: chat.user || prev[uid].username,
      avatar: chat.avatar || prev[uid].avatar,
      xp: nextXp,
      level: nextLevel,
      lastXpTime: now,
      // The streamer and their bot: they keep their XP, but are not ranked among the chatters.
      ...(chat.isBroadcaster || chat.isBot ? { own: true } : {}),
    };
    return prev;
  });

  // The board on stream follows, a few seconds behind (api/ws.js gathers these).
  bus.emit('xp:changed', uid);
  if (!levelledUp) return;

  log.info(`${chat.user} reached level ${nextLevel} (via ${chat.platform})`);
  bus.emit(EVENTS.LEVELUP, { user: chat.user, level: nextLevel, platform: chat.platform, uid });
  /*
    As a stream event, so an alert or an action can answer it: {user},
    {event.level}, {event.xp}, {event.rank}. The channel's own accounts keep
    levelling quietly — an alert for the streamer's own level is not one.
  */
  if (!chat.isBroadcaster && !chat.isBot && !ownUids().has(uid)) {
    const place = rankOf(uid);
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'level_up',
      platform: chat.platform,
      user: chat.user,
      avatar: chat.avatar,
      data: { level: nextLevel, xp: nextXp, rank: place?.rank ?? '', userId: chat.userId || '' },
    }));
  }

  await grantRewards(uid, nextLevel, chat);
}

async function grantRewards(uid, level, chat) {
  const c = cfg.get();
  const discordKey = Object.keys(accounts.get()).find(
    (k) => k.startsWith('discord:') && accounts.get()[k] === uid,
  );
  const discordId = discordKey ? discordKey.split(':')[1] : null;
  const guildId = chat.raw?.guildId || discord.getSettings().guildId;

  const reward = (c.roleRewards || []).find((r) => Number(r.level) === level);
  if (reward && discordId && guildId) {
    try {
      await discord.addRole(guildId, discordId, reward.roleId);
      log.info(`granted role ${reward.roleName || reward.roleId} to ${chat.user}`);
    } catch (err) {
      log.warn(`could not grant role: ${err.message}`);
    }
  }

  const channelId = c.announceChannelId || chat.raw?.channelId;
  if (!channelId) return;

  // A Discord mention is safe verbatim; a raw username is not.
  const who = discordId ? `<@${discordId}>` : discord.sanitise(chat.user);
  const text = String(c.levelUpMessage || '')
    .replace(/\{user\}/g, who)
    .replace(/\{level\}/g, String(level));

  try {
    await discord.sendMessage(channelId, text);
  } catch (err) {
    log.warn(`could not announce level-up: ${err.message}`);
  }
}

// ------------------------------------------------------------------- public

export const getUsers = () => users.get();
/** Which person every platform account belongs to — how a Twitch name is linked to a Discord member. */
export const getAccounts = () => accounts.get();
/** The settings, with the chat answers filled in for a config saved before they existed. */
export const getConfig = () => ({ ...cfg.get(), chat: cleanLevelChat(cfg.get().chat || DEFAULT_LEVEL_CHAT) });

export function setConfig(patch) {
  const next = { ...cfg.get(), ...patch };
  if (patch?.chat !== undefined) next.chat = cleanLevelChat(patch.chat);
  if (patch?.ignoredChannelIds !== undefined) {
    next.ignoredChannelIds = [...new Set((Array.isArray(patch.ignoredChannelIds) ? patch.ignoredChannelIds : []).map(String).filter((id) => /^\d{1,25}$/.test(id)))];
  }
  return cfg.set(next);
}

/**
 * The channel's own people — the streamer and their bot — by uid: whoever
 * has chatted as the broadcaster or the bot, and the Twitch main and bot
 * accounts the Connections screen is logged in with, so they are known
 * before either says another word.
 */
function ownUids() {
  const all = Object.values(users.get());
  const own = new Set(all.filter((u) => u.own).map((u) => u.id));
  let c = null;
  try {
    c = twitch.getCredentials();
  } catch {
    c = null;
  }
  const map = accounts.get();
  for (const id of [c?.userId, c?.botUser?.id]) if (id && map[`twitch:${id}`]) own.add(map[`twitch:${id}`]);
  // By name as well, for an account whose id is not known yet.
  const names = [c?.login, c?.botLogin].filter(Boolean).map((n) => String(n).toLowerCase());
  for (const u of all) if (names.includes(String(u.username || '').toLowerCase())) own.add(u.id);
  return own;
}

/**
 * The chatters by XP, most first: what "top chatters" and the Levels screen
 * rank. The streamer and their bot are left out — they are the channel, not
 * its chat — though they keep their XP and their levels.
 */
export function leaderboard(limit = 50) {
  const own = ownUids();
  return Object.values(users.get())
    .filter((u) => !own.has(u.id))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

/** XP a level starts at: the inverse of getLevel. */
export const xpForLevel = (level) => (level <= 0 ? 0 : (level * 10) ** 2);

/** The person behind a platform account, if they have ever earned XP. */
export function findUser(platform, id) {
  const uid = accounts?.get()[`${platform}:${id}`];
  return uid ? users.get()[uid] || null : null;
}

/** Somebody by the name they chat under, whatever the platform. */
export function findByName(name) {
  const wanted = String(name ?? '').replace(/^@/, '').trim().toLowerCase();
  if (!wanted) return null;
  const all = Object.values(users?.get() || {});
  return all.filter((u) => String(u.username || '').toLowerCase() === wanted).sort((a, b) => b.xp - a.xp)[0] || null;
}

/** Where somebody stands: { rank, total }, or null for the channel's own accounts. */
export function rankOf(uid) {
  const board = leaderboard(Infinity);
  const at = board.findIndex((u) => u.id === uid);
  return at < 0 ? null : { rank: at + 1, total: board.length };
}

export function reset() {
  users.set({});
  accounts.set({});
  log.warn('all XP data reset');
}

/**
 * Point a secondary platform identity at the primary's unified user. If it
 * already belonged to somebody, that somebody joins the primary whole — every
 * account they had comes along — and their XP is added: it was earned
 * talking on another platform, so it is theirs as much as the rest.
 */
export function link(primary, secondary) {
  const primaryUid = resolveUser(primary.platform, primary.id, primary.username, primary.avatar);
  const secondaryKey = `${secondary.platform}:${secondary.id}`;
  const secondaryUid = accounts.get()[secondaryKey];

  if (secondaryUid && secondaryUid !== primaryUid && users.get()[secondaryUid]) {
    const a = users.get()[primaryUid];
    const b = users.get()[secondaryUid];
    const mergedXp = (a.xp || 0) + (b.xp || 0);

    users.update((prev) => {
      prev[primaryUid] = {
        ...a,
        avatar: a.avatar || b.avatar,
        xp: mergedXp,
        level: getLevel(mergedXp),
        lastXpTime: Math.max(a.lastXpTime || 0, b.lastXpTime || 0),
        createdAt: Math.min(a.createdAt || Date.now(), b.createdAt || Date.now()),
        ...(a.own || b.own ? { own: true } : {}),
      };
      delete prev[secondaryUid];
      return prev;
    });

    // Repoint every key that referenced the absorbed record.
    accounts.update((prev) => {
      for (const [k, v] of Object.entries(prev)) if (v === secondaryUid) prev[k] = primaryUid;
      return prev;
    });
    // What else is kept per person (their history, their points) follows them into one.
    bus.emit('people:merged', { into: primaryUid, from: secondaryUid });
  }

  accounts.update((prev) => { prev[secondaryKey] = primaryUid; return prev; });
  log.info(`linked ${secondaryKey} -> ${primary.platform}:${primary.id}`);
  return primaryUid;
}

export function unlink(platformKey) {
  accounts.update((prev) => { delete prev[platformKey]; return prev; });
  log.info(`unlinked ${platformKey}`);
}

/** Every account one person has, as `platform:id` keys. */
export function accountsOf(uid) {
  return Object.entries(accounts?.get() || {}).filter(([, v]) => v === uid).map(([k]) => k);
}

/**
 * Take one account away from the person it belongs to. It becomes somebody
 * of its own again, starting from nothing; the person keeps their XP and
 * every other account. An account that is somebody's only one stays as it is.
 */
export function detach(key, username = '') {
  const uid = accounts.get()[key];
  if (!uid) return null;
  if (accountsOf(uid).length < 2) return uid;
  const fresh = newUid();
  users.update((prev) => {
    prev[fresh] = { id: fresh, username: username || key.split(':').slice(1).join(':'), avatar: '', xp: 0, level: 0, lastXpTime: 0, createdAt: Date.now() };
    return prev;
  });
  accounts.update((prev) => { prev[key] = fresh; return prev; });
  log.info(`took ${key} off ${uid}`);
  bus.emit('people:split', { from: uid, to: fresh, key });
  return fresh;
}

/** The person behind a platform account, made if they are new: for something they did before they ever chatted. */
export const personFor = (platform, id, username, avatar) => resolveUser(platform, String(id), username, avatar);

/**
 * Forget people altogether: their XP, and every account of theirs. Whatever
 * else is kept per person hears it and lets them go too.
 */
export function forget(uids) {
  const gone = new Set(uids);
  if (!gone.size) return { people: 0, accounts: 0 };
  const keys = Object.entries(accounts.get()).filter(([, v]) => gone.has(v)).map(([k]) => k);
  users.update((prev) => { for (const uid of gone) delete prev[uid]; return prev; });
  accounts.update((prev) => { for (const k of keys) delete prev[k]; return prev; });
  bus.emit('people:forgotten', { uids: [...gone], keys });
  log.info(`forgot ${gone.size} people (${keys.length} accounts)`);
  return { people: gone.size, accounts: keys.length };
}
