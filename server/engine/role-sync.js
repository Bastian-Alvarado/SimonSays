/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord roles that follow what somebody is on stream: a Twitch subscriber
 * of the right tier, a VIP, a moderator, a follower, somebody who has cheered
 * a thousand bits, a TikTok follower. The Role Management screen says which
 * Discord role each of those is; this keeps them true.
 *
 * It only works for people whose stream account is linked to their Discord
 * account — a Twitch name says nothing about who somebody is on Discord.
 * Links live in the leveling identity map (`accounts`), where a Twitch key
 * and a Discord key point at the same person.
 *
 * What somebody is comes from two places:
 *
 *   Chat badges    every Twitch message says whether its author is a
 *                  subscriber (and of which tier, in the badge version), a
 *                  founder, a VIP or a moderator — right now, for certain.
 *                  So these can take a role away as well as give it.
 *   Events         a follow, a sub, a cheer, a TikTok follow. These only ever
 *                  give: nobody unfollows out loud, and bits once cheered
 *                  stay cheered.
 *
 * A role is only ever removed when the thing it stands for is known to be
 * gone. Not having seen somebody chat is not knowing they stopped subscribing.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as discord from '../platforms/discord.js';
import * as leveling from '../leveling/index.js';
import * as twitch from '../platforms/twitch.js';
import * as youtube from '../platforms/youtube.js';
import { getRoleMappings } from './discord-roles.js';
import * as history from './viewer-history.js';

const log = createLogger('role-sync');

/**
 * What each mapping on the Role Management screen stands for, as a verdict
 * on one account: true (give the role), false (known not to hold — may take
 * it away), or undefined (cannot say, leave it alone).
 */
const known = (v) => (v === undefined ? undefined : Boolean(v));
const tier = (n) => (s) => (s.sub === false ? false : s.sub === true && s.tier ? s.tier === n : undefined);
const atLeast = (bits) => (s) => ((s.bits || 0) >= bits ? true : undefined);
const onlyGives = (field) => (s) => (s[field] === true ? true : undefined);

export const GRANTS = {
  follower: onlyGives('follower'),
  founder: onlyGives('founder'),
  subscriber: (s) => known(s.sub),
  subscriberTier1: tier(1),
  subscriberTier2: tier(2),
  subscriberTier3: tier(3),
  vip: (s) => known(s.vip),
  moderator: (s) => known(s.mod),
  bits1k: atLeast(1000),
  bits5k: atLeast(5000),
  bits10k: atLeast(10000),
  bits25k: atLeast(25000),
  tiktokFollower: onlyGives('tiktokFollower'),
  // TikTok chat says whether its author subscribes to you or moderates, as Twitch badges do.
  tiktokSubscriber: (s) => known(s.tiktokSub),
  tiktokModerator: (s) => known(s.tiktokMod),
  tiktokGifter: onlyGives('tiktokGifter'),
  // YouTube chat says whether its author is a member (paying) or moderates; a Super Chat stays given.
  youtubeMember: (s) => known(s.youtubeMember),
  youtubeModerator: (s) => known(s.youtubeMod),
  youtubeSuperChat: onlyGives('youtubeSuperChat'),
};

const LOG_LIMIT = 100;
let store = null;
/** person → the decisions last applied, so a chatty sub is not re-checked every message. */
const applied = new Map();

const statusOf = (key) => store.get().status?.[key] || {};
/** The name an account goes by, as last seen in its chat or given when it was linked. */
export const nameOfAccount = (key) => statusOf(key).name || '';
/** The picture an account has, when one is known (Discord, from its link). */
export const avatarOfAccount = (key) => statusOf(key).avatar || '';
const accountsOf = (uid) => Object.entries(leveling.getAccounts()).filter(([, v]) => v === uid).map(([k]) => k);

function update(key, patch) {
  const before = statusOf(key);
  const next = { ...before, ...patch };
  const changed = JSON.stringify(before) !== JSON.stringify(next);
  if (changed) store.update((prev) => ({ ...prev, status: { ...(prev.status || {}), [key]: next } }));
  return { before, next, changed };
}

function record(entry) {
  const next = store.update((prev) => ({
    ...prev,
    log: [{ id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now(), ...entry }, ...(prev.log || [])].slice(0, LOG_LIMIT),
  }));
  bus.emit(EVENTS.CONFIG, { key: 'roleSyncLog', value: next.log });
}

/** The role verdicts for one person, across every stream account linked to them. */
export function decide(keys, mappings) {
  const grant = new Set();
  const revoke = new Set();
  for (const [kind, roleId] of Object.entries(mappings || {})) {
    if (!roleId || !GRANTS[kind]) continue;
    const verdicts = keys.filter((k) => !k.startsWith('discord:')).map((k) => GRANTS[kind](statusOf(k)));
    if (verdicts.includes(true)) grant.add(roleId);
    else if (verdicts.includes(false)) revoke.add(roleId);
  }
  // Two mappings on one role — "subscriber" and "tier 1" both, say: a reason to hold it wins.
  for (const roleId of grant) revoke.delete(roleId);
  return { grant: [...grant], revoke: [...revoke] };
}

const roleName = (id) => discord.getCache()?.roles?.find((r) => r.id === id)?.name || id;

/**
 * Bring one person's Discord roles in line. Asks Discord what they hold first,
 * so only what differs is changed, and says what it did.
 */
export async function syncPerson(uid, { source = 'Auto', force = false } = {}) {
  const keys = accountsOf(uid);
  const discordIds = keys.filter((k) => k.startsWith('discord:')).map((k) => k.slice('discord:'.length));
  const guildId = discord.getSettings().guildId;
  if (!discordIds.length || !guildId) return { changed: 0, reason: discordIds.length ? 'no server chosen' : 'not linked to Discord' };

  const onStream = decide(keys, getRoleMappings());
  // Roles for showing up, from their history, beside the ones for what they are on stream. A reason to hold a role wins.
  const loyal = loyaltyVerdicts(uid, keys);
  const grant = [...new Set([...onStream.grant, ...loyal.grant])];
  const revoke = [...new Set([...onStream.revoke, ...loyal.revoke])].filter((id) => !grant.includes(id));
  const signature = JSON.stringify([grant, revoke]);
  if (!force && applied.get(uid) === signature) return { changed: 0, reason: 'already up to date' };

  const stream = keys.find((k) => !k.startsWith('discord:'));
  const who = statusOf(stream).name || (stream || '').split(':')[1] || 'someone';
  const platform = stream?.split(':')[0] || 'twitch';
  let changed = 0;

  for (const discordId of discordIds) {
    let member;
    try {
      member = await discord.request('GET', `/guilds/${guildId}/members/${discordId}`);
    } catch (err) {
      log.warn(`${who} is linked to a Discord account that is not in the server (${err.status || err.message})`);
      continue;
    }
    const have = new Set(member?.roles || []);
    for (const roleId of grant) {
      if (have.has(roleId)) continue;
      try {
        await discord.addRole(guildId, discordId, roleId);
        record({ twitchUser: who, platform, roleName: `+ ${roleName(roleId)}`, source });
        changed += 1;
      } catch (err) { log.warn(`could not give ${roleName(roleId)} to ${who}: ${err.message}`); }
    }
    for (const roleId of revoke) {
      if (!have.has(roleId)) continue;
      try {
        await discord.removeRole(guildId, discordId, roleId);
        record({ twitchUser: who, platform, roleName: `− ${roleName(roleId)}`, source });
        changed += 1;
      } catch (err) { log.warn(`could not take ${roleName(roleId)} from ${who}: ${err.message}`); }
    }
  }
  applied.set(uid, signature);
  if (changed) log.info(`${who}: ${changed} role change(s)`);
  return { changed };
}

/** Sync whoever an account belongs to, when it is linked to Discord at all. */
function syncAccount(key) {
  const uid = leveling.getAccounts()[key];
  if (!uid) return;
  if (!accountsOf(uid).some((k) => k.startsWith('discord:'))) return;
  syncPerson(uid).catch((err) => log.warn(`role sync failed: ${err.message}`));
}

/** What a Twitch message's badges say, now. The badge version carries the tier. */
export function readBadges(chat) {
  const badges = chat.raw?.badges || {};
  const subBadge = badges.subscriber !== undefined ? Number(badges.subscriber) : null;
  const founder = badges.founder !== undefined;
  return {
    sub: Boolean(chat.isSub || subBadge !== null || founder),
    // 3000+ is a tier 3 badge, 2000+ tier 2; a founder badge hides the tier.
    ...(subBadge !== null ? { tier: subBadge >= 3000 ? 3 : subBadge >= 2000 ? 2 : 1 } : {}),
    ...(founder ? { founder: true } : {}),
    vip: Boolean(chat.isVip || badges.vip !== undefined),
    mod: Boolean(chat.isMod || badges.moderator !== undefined),
  };
}

// ------------------------------------------------------ viewers linking themselves

/*
  A viewer links any two of their own accounts in two halves, one typed from
  each, so nobody can link an account that is not theirs:

    on one platform     !link<other> <their name there>    — e.g. on Twitch: !linkdiscord Ana
    on the other        !link<first> <their name there>    — e.g. on Discord: !linktwitch AnaTV

  When both halves name each other, the two accounts become one person —
  every account either already had comes along. In Discord the second half
  may leave the name out (!linktwitch), as it always could: it confirms
  whatever asked for that Discord account by name.

  Asking alone does nothing. The worst a stranger can do is ask on someone's
  behalf and wait for a confirmation that never comes.
*/
const PENDING_MS = 15 * 60 * 1000;
/** The stream accounts a Discord member can be linked to, and how chat names them. */
const PLATFORMS = ['twitch', 'tiktok', 'youtube'];
/** Every account a person can have, Discord included. */
const ALL_PLATFORMS = ['discord', ...PLATFORMS];
const PLATFORM_NAMES = { twitch: 'Twitch', tiktok: 'TikTok', youtube: 'YouTube', discord: 'Discord' };
/** `${platform}:${id}>${wanted platform}` → who asked, for which name there, and when */
const pending = new Map();

const plain = (name) => String(name ?? '').trim().replace(/^@/, '').toLowerCase();

function pendingLinks() {
  const now = Date.now();
  const out = {};
  for (const [key, p] of pending) {
    if (now - p.at > PENDING_MS) { pending.delete(key); continue; }
    out[key] = { twitchUser: p.from.name, platform: p.from.platform, want: p.want, discordName: p.name };
  }
  return out;
}

/** Every name an account goes by, plain: the one on the message, and those its platform puts on it. */
function namesOn(chat) {
  const names = new Set([plain(chat.user)]);
  if (chat.platform === 'twitch') for (const n of [chat.raw?.username, chat.raw?.login, chat.raw?.['display-name']]) if (n) names.add(plain(n));
  // A TikTok account is filed under its @handle, which is a name too.
  if (chat.platform === 'tiktok') names.add(plain(chat.userId));
  names.delete('');
  return names;
}

/** A Discord account's names as well: the server nickname, the display name and the username, asked of Discord. */
async function discordNames(chat) {
  const names = namesOn(chat);
  const guildId = discord.getSettings().guildId;
  if (guildId && chat.userId) {
    try {
      const member = await discord.request('GET', `/guilds/${guildId}/members/${chat.userId}`);
      for (const n of [member?.nick, member?.user?.global_name, member?.user?.username]) if (n) names.add(plain(n));
    } catch { /* the message's own name will have to do */ }
  }
  return names;
}

/** Tell the account that finished a link that it worked, where it can be told: in Discord, or by the bot on Twitch. */
function saySameTwo(chat, other) {
  const where = `${PLATFORM_NAMES[other.platform]} **${discord.sanitise(other.name)}**`;
  if (chat.platform === 'discord' && chat.raw?.channelId) {
    discord.sendMessage(chat.raw.channelId, `✅ <@${chat.userId}> ↔ ${where}`).catch((err) => log.warn(`could not confirm the link in Discord: ${err.message}`));
  } else if (chat.platform === 'twitch') {
    twitch.say?.(`✅ @${chat.user} ↔ ${PLATFORM_NAMES[other.platform]} ${other.name}`, { useBot: true }).catch?.(() => {});
  }
}

/**
 * One half of a link, typed by `chat`'s account: "I am <name> on <want>".
 * If the other account already asked for this one by name, they are joined;
 * otherwise it waits for that. A name left out (Discord only) confirms
 * whatever asked for this Discord account.
 */
function claim(chat, want, name) {
  // Only Discord has names to look up; the rest are on the message, so a request is waiting the moment it is typed.
  return chat.platform === 'discord'
    ? discordNames(chat).then((mine) => settle(chat, want, name, mine))
    : settle(chat, want, name, namesOn(chat));
}

async function settle(chat, want, name, mine) {
  pendingLinks(); // drop the stale ones
  const from = { platform: chat.platform, id: String(chat.userId), name: chat.user };
  const wanted = plain(name);
  const match = [...pending.entries()].find(([, p]) => p.from.platform === want && p.want === chat.platform
    && mine.has(p.wanted) && (!wanted || p.names.includes(wanted)));
  if (match) {
    const [key, p] = match;
    pending.delete(key);
    await joinAccounts(p.from, from);
    bus.emit(EVENTS.CONFIG, { key: 'pendingLinks', value: pendingLinks() });
    saySameTwo(chat, p.from);
    return;
  }
  if (!wanted) {
    // Discord's short confirmation, with nothing to confirm: say how it starts.
    if (chat.platform === 'discord' && chat.raw?.channelId) {
      discord.sendMessage(chat.raw.channelId, `<@${chat.userId}> ❔ !linkdiscord ${discord.sanitise(chat.user)} → ${PLATFORM_NAMES[want] || 'Twitch'}`).catch(() => {});
    }
    return;
  }
  pending.set(`${from.platform}:${from.id}>${want}`, { from, want, name: String(name).trim().replace(/^@/, '').slice(0, 40), wanted, names: [...mine], at: Date.now() });
  log.info(`${chat.user} (${chat.platform}) asked to link ${PLATFORM_NAMES[want]} account "${name}"`);
  bus.emit(EVENTS.CONFIG, { key: 'pendingLinks', value: pendingLinks() });
}

function onChat(chat) {
  if (!chat?.userId) return;
  const typed = /^!link(discord|twitch|tiktok|youtube)(?:\s+(.+))?$/i.exec(String(chat.msg || '').trim());
  if (typed && ALL_PLATFORMS.includes(chat.platform)) {
    const want = typed[1].toLowerCase();
    const name = (typed[2] || '').trim();
    // Only Discord may leave the name out; an account cannot be linked to its own platform.
    if (want !== chat.platform && (name || chat.platform === 'discord')) {
      claim(chat, want, name).catch((err) => log.warn(`linking failed: ${err.message}`));
    }
  }
  const key = `${chat.platform}:${chat.userId}`;
  if (chat.platform === 'twitch') {
    const seen = readBadges(chat);
    // Unsubscribed: the tier goes with it, so a resub at another tier starts clean.
    if (!seen.sub) seen.tier = undefined;
    const { changed, before, next } = update(key, { name: chat.user, ...seen });
    const mattered = ['sub', 'tier', 'founder', 'vip', 'mod'].some((f) => before[f] !== next[f]);
    if (changed && mattered) syncAccount(key);
  } else if (chat.platform === 'tiktok') {
    const { changed, before, next } = update(key, { name: chat.user, tiktokSub: Boolean(chat.isSub), tiktokMod: Boolean(chat.isMod) });
    if (changed && (before.tiktokSub !== next.tiktokSub || before.tiktokMod !== next.tiktokMod)) syncAccount(key);
  } else if (chat.platform === 'youtube') {
    const { changed, before, next } = update(key, { name: chat.user, youtubeMember: Boolean(chat.isSub), youtubeMod: Boolean(chat.isMod) });
    if (changed && (before.youtubeMember !== next.youtubeMember || before.youtubeMod !== next.youtubeMod)) syncAccount(key);
  } else if (chat.user && statusOf(key).name !== chat.user) {
    // Names, for the linked-accounts list.
    update(key, { name: chat.user });
  }
}

function onEvent(event) {
  const id = event?.data?.userId;
  if (!id) return;
  switch (event.type) {
    case 'twitch_follow':
      if (update(`twitch:${id}`, { name: event.user, follower: true }).changed) syncAccount(`twitch:${id}`);
      return;
    case 'twitch_sub':
      if (update(`twitch:${id}`, { name: event.user, sub: true, ...(event.data.tier ? { tier: Number(event.data.tier) } : {}) }).changed) syncAccount(`twitch:${id}`);
      return;
    case 'twitch_cheer': {
      const bits = (statusOf(`twitch:${id}`).bits || 0) + (Number(event.data.bits) || 0);
      update(`twitch:${id}`, { name: event.user, bits });
      syncAccount(`twitch:${id}`);
      return;
    }
    case 'tiktok_gift':
      if (update(`tiktok:${id}`, { name: event.user, tiktokGifter: true }).changed) syncAccount(`tiktok:${id}`);
      return;
    case 'tiktok_follow':
      if (update(`tiktok:${id}`, { name: event.user, tiktokFollower: true }).changed) syncAccount(`tiktok:${id}`);
      return;
    case 'youtube_cheer':
      if (update(`youtube:${id}`, { name: event.user, youtubeSuperChat: true }).changed) syncAccount(`youtube:${id}`);
      return;
    case 'youtube_sub':
      if (update(`youtube:${id}`, { name: event.user, youtubeMember: true }).changed) syncAccount(`youtube:${id}`);
      return;
    default:
  }
}

// ------------------------------------------------------ subscriptions that run out

/*
  Chat badges only tell on somebody who chats. A subscriber who lets it lapse
  and never says another word would keep their role for good — so once a day
  the whole subscriber list is asked of Twitch, and every linked Twitch
  account is told the truth: on the list at its tier, or not a subscriber.
  Only a complete list is believed; one cut short says nothing about the
  people past its end.
*/
const DAY_MS = 24 * 60 * 60 * 1000;
let subsTimer = null;

function subsChecked(check) {
  store.update((prev) => ({ ...prev, subsCheck: check }));
  bus.emit(EVENTS.CONFIG, { key: 'roleSyncSubsCheck', value: check });
}

export function onSubscriberList(list) {
  if (!Array.isArray(list) || list.complete === false) return;
  const accounts = leveling.getAccounts();
  const byId = new Map(list.map((s) => [String(s.user_id), s]));
  let changed = 0;
  for (const [key, uid] of Object.entries(accounts)) {
    if (!key.startsWith('twitch:')) continue;
    if (!Object.entries(accounts).some(([k, v]) => v === uid && k.startsWith('discord:'))) continue;
    const s = byId.get(key.slice('twitch:'.length));
    const patch = s ? { sub: true, tier: Math.max(1, Math.min(3, Math.round(Number(s.tier) / 1000) || 1)) } : { sub: false, tier: undefined };
    if (update(key, patch).changed) { changed += 1; syncAccount(key); }
  }
  subsChecked({ at: Date.now(), ok: true, subscribers: list.length, changed });
  if (changed) log.info(`subscriber list: ${changed} linked account(s) changed`);
}

async function checkSubscribers() {
  try {
    await twitch.refreshSubscribers();
  } catch (err) {
    subsChecked({ at: Date.now(), ok: false, error: /scope|401|403/i.test(err.message) ? 'missing permission: channel:read:subscriptions' : err.message.slice(0, 200) });
    log.warn(`could not check the subscriber list: ${err.message}`);
  }
}

// ------------------------------------------------------------ loyalty: roles for showing up

/*
  Roles for coming back: so many streams, a streak of so many in a row, being
  on so many platforms, so many messages. Read from each person's history
  across every account they have. A streak breaks and an account can be
  unlinked, so those roles come and go; streams and messages only add up, so
  those roles, once earned, stay.
*/
export const LOYALTY_KINDS = ['streams', 'streak', 'platforms', 'messages'];
const FOLLOWS = new Set(['streak', 'platforms']);
let loyaltyStore = null;

export function cleanLoyalty(list) {
  return (Array.isArray(list) ? list : []).slice(0, 20).map((r, i) => ({
    id: /^[\w-]{1,40}$/.test(String(r?.id || '')) ? r.id : `loy-${Date.now().toString(36)}${i}`,
    kind: LOYALTY_KINDS.includes(r?.kind) ? r.kind : 'streams',
    atLeast: Math.max(1, Math.min(100_000, Math.round(Number(r?.atLeast) || 1))),
    roleId: /^\d{5,25}$/.test(String(r?.roleId || '')) ? String(r.roleId) : '',
  }));
}
export const getLoyalty = () => cleanLoyalty(loyaltyStore?.get().rules || []);

/** How far somebody has come, by each loyalty measure. Platforms are the stream ones — Discord is where the role goes. */
export function loyaltyOf(uid, keys = accountsOf(uid)) {
  const h = history.historyOf(uid) || {};
  return {
    streams: h.streams || 0,
    streak: h.streak || 0,
    messages: h.messages || 0,
    platforms: new Set(keys.map((k) => k.split(':')[0]).filter((p) => p !== 'discord')).size,
  };
}

/** Which loyalty roles somebody should hold, and which they should not (only for the measures that come and go). */
export function loyaltyVerdicts(uid, keys, rules = getLoyalty()) {
  const have = loyaltyOf(uid, keys);
  const grant = new Set();
  const revoke = new Set();
  for (const r of rules) {
    if (!r.roleId) continue;
    if (have[r.kind] >= r.atLeast) grant.add(r.roleId);
    else if (FOLLOWS.has(r.kind)) revoke.add(r.roleId);
  }
  for (const id of grant) revoke.delete(id);
  return { grant: [...grant], revoke: [...revoke] };
}

/** Bring everybody linked to Discord in line — after a stream, when streaks move. Only what differs is changed. */
export async function syncEveryone(source = 'Auto') {
  const uids = new Set(Object.entries(leveling.getAccounts()).filter(([k]) => k.startsWith('discord:')).map(([, uid]) => uid));
  let changed = 0;
  for (const uid of uids) {
    if (accountsOf(uid).length < 2) continue;
    try { changed += (await syncPerson(uid, { source })).changed || 0; } catch (err) { log.warn(`role sync failed: ${err.message}`); }
  }
  return { people: uids.size, changed };
}

export function setLoyalty(rules) {
  loyaltyStore.set({ rules: cleanLoyalty(rules) });
  bus.emit(EVENTS.CONFIG, { key: 'loyaltyRoles', value: getLoyalty() });
  applied.clear();
  syncEveryone('Manual').catch(() => {});
  return getLoyalty();
}

export function initRoleSync() {
  store = collection('role_sync', { status: {}, links: {}, log: [] });
  loyaltyStore = collection('loyalty_roles', { rules: [] });
  // A stream over: streaks moved, streams added up.
  bus.on('stream:ended', () => { syncEveryone().catch((err) => log.warn(`loyalty sync failed: ${err.message}`)); });
  bus.on(EVENTS.CHAT, onChat);
  // A confirmation typed in any channel of the server counts, as commands do.
  bus.on('discord:message_elsewhere', onChat);
  bus.on(EVENTS.EVENT, onEvent);
  // Twitch fetches the list when it connects; this asks again every day after.
  bus.on(EVENTS.SUBSCRIBER_LIST, onSubscriberList);
  clearInterval(subsTimer);
  subsTimer = setInterval(() => { checkSubscribers(); }, DAY_MS);
  subsTimer.unref?.();
}

// ------------------------------------------------------------- the dashboard

/**
 * Somebody on YouTube, to link by hand: people seen in YouTube chat whose
 * name has the words in it (the key chat files them under is their channel
 * id, which nobody knows by heart), and — for an @handle or a channel id —
 * the channel itself, asked of YouTube.
 */
export async function findYoutube(query) {
  const q = String(query ?? '').trim().toLowerCase();
  const users = leveling.getUsers();
  const seen = Object.entries(leveling.getAccounts())
    .filter(([key]) => key.startsWith('youtube:'))
    .map(([key, uid]) => ({ id: key.slice('youtube:'.length), name: users[uid]?.username || statusOf(key).name || key.slice(8), avatar: users[uid]?.avatar || '' }))
    .filter((p) => !q || p.name.toLowerCase().includes(q.replace(/^@/, '')) || p.id.toLowerCase() === q)
    .slice(0, 25);
  let found = null;
  try { found = await youtube.findChannel(String(query ?? '').trim()); } catch (err) { log.debug(`YouTube lookup failed: ${err.message}`); }
  return { seen, found };
}
/**
 * Link a Twitch, TikTok or YouTube account to a Discord member, from the
 * Role Management screen, and bring their roles in line at once.
 */
export async function link({ platform, platformId, platformName, discordId, discordName, discordAvatar } = {}) {
  if (!PLATFORMS.includes(platform)) throw new Error('only Twitch, TikTok and YouTube accounts can be linked');
  if (!/^\d{5,25}$/.test(String(discordId ?? '').trim())) throw new Error('that is not a Discord member id');
  const stream = accountFrom({ platform, platformId, platformName });
  const member = accountFrom({ platform: 'discord', platformId: discordId, platformName: discordName, avatar: discordAvatar });
  return joinAccounts(stream, member);
}

const ID_RULES = {
  discord: /^\d{5,25}$/,
  twitch: /^\d{1,20}$/,
  youtube: /^[\w-]{1,64}$/,
  tiktok: /^[\w.-]{1,64}$/,
};

/** An account as given: its platform, its id the way chat files it, and a name. Throws when it cannot be one. */
function accountFrom({ platform, platformId, platformName, avatar } = {}) {
  if (!ALL_PLATFORMS.includes(platform)) throw new Error('only Discord, Twitch, TikTok and YouTube accounts can be linked');
  // Chat files a TikTok account under its @handle.
  const id = String(platformId ?? '').trim().replace(platform === 'tiktok' ? /^@/ : /^$/, '');
  if (!ID_RULES[platform].test(id)) throw new Error(`that is not a ${PLATFORM_NAMES[platform]} account`);
  return { platform, id, name: String(platformName || '').trim() || id, avatar: avatar || '' };
}

/**
 * Two accounts become one person — and every account either already had
 * comes along. Their names are remembered for the list, and their Discord
 * roles brought in line if Discord is among them.
 */
async function joinAccounts(a, b) {
  const uid = leveling.link({ platform: a.platform, id: a.id, username: a.name, avatar: a.avatar }, { platform: b.platform, id: b.id });
  for (const x of [a, b]) {
    update(`${x.platform}:${x.id}`, { name: x.name || statusOf(`${x.platform}:${x.id}`).name || x.id, ...(x.avatar ? { avatar: x.avatar } : {}) });
  }
  const now = Date.now();
  store.update((prev) => ({ ...prev, links: { ...(prev.links || {}), [`${a.platform}:${a.id}`]: prev.links?.[`${a.platform}:${a.id}`] || { linkedAt: now }, [`${b.platform}:${b.id}`]: { linkedAt: now } } }));
  applied.delete(uid);
  announce();
  if (accountsOf(uid).some((k) => k.startsWith('discord:'))) return syncPerson(uid, { source: 'Manual', force: true });
  return { changed: 0 };
}

/**
 * Add an account to somebody already known — by any account they have —
 * from the Role Management screen. An account that was somebody else's
 * brings that person along whole.
 */
export async function addAccount({ to, ...account } = {}) {
  const uid = leveling.getAccounts()[String(to || '')];
  if (!uid) throw new Error('that person is not known');
  const [platform, ...rest] = String(to).split(':');
  const first = { platform, id: rest.join(':'), name: statusOf(to).name || leveling.getUsers()[uid]?.username || rest.join(':') };
  return joinAccounts(first, accountFrom(account));
}

/**
 * Take one account off the person it belongs to. Only that one: the person
 * keeps their other accounts, their XP and their roles, and the account
 * starts again as somebody of its own.
 */
export function unlink(key) {
  const uid = leveling.getAccounts()[key];
  if (!uid) return;
  leveling.detach(key, statusOf(key).name);
  store.update((prev) => {
    const links = { ...(prev.links || {}) };
    delete links[key];
    return { ...prev, links };
  });
  applied.delete(uid);
  announce();
}

/** Sync one linked person now, whether or not anything changed. */
export function syncNow(key) {
  const uid = leveling.getAccounts()[key];
  if (!uid) return Promise.resolve({ changed: 0, reason: 'unknown account' });
  return syncPerson(uid, { source: 'Manual', force: true });
}

export function clearLog() {
  store.update((prev) => ({ ...prev, log: [] }));
  bus.emit(EVENTS.CONFIG, { key: 'roleSyncLog', value: [] });
}

/**
 * Everybody linked, as the screen lists them: the stream account, keyed as
 * the identity map keys it, and who they are on Discord.
 */
export function linkedUsers() {
  const accounts = leveling.getAccounts();
  const byUid = new Map();
  for (const [key, uid] of Object.entries(accounts)) {
    if (!byUid.has(uid)) byUid.set(uid, []);
    byUid.get(uid).push(key);
  }
  const out = {};
  for (const keys of byUid.values()) {
    const discordKey = keys.find((k) => k.startsWith('discord:'));
    if (!discordKey) continue;
    const d = statusOf(discordKey);
    for (const key of keys.filter((k) => PLATFORMS.some((p) => k.startsWith(`${p}:`)))) {
      out[key] = {
        id: discordKey.slice('discord:'.length),
        username: d.name || discordKey.slice('discord:'.length),
        avatar: d.avatar,
        platformName: statusOf(key).name || key.split(':')[1],
        linkedAt: store.get().links?.[key]?.linkedAt || 0,
      };
    }
  }
  return out;
}

/**
 * Everybody with more than one account, as people: who they are, their XP,
 * and each account they have — Discord, Twitch, TikTok, YouTube — with the
 * name it goes by. What the Role Management screen lists, and what anything
 * that wants "this viewer, everywhere" reads.
 */
export function people() {
  const users = leveling.getUsers();
  const byUid = new Map();
  for (const [key, uid] of Object.entries(leveling.getAccounts())) {
    if (!byUid.has(uid)) byUid.set(uid, []);
    byUid.get(uid).push(key);
  }
  const order = (k) => ALL_PLATFORMS.indexOf(k.split(':')[0]);
  const out = [];
  for (const [uid, keys] of byUid) {
    if (keys.length < 2) continue;
    const user = users[uid] || {};
    const shown = keys.sort((a, b) => order(a) - order(b)).map((key) => {
      const [platform, ...rest] = key.split(':');
      const s = statusOf(key);
      return { key, platform, id: rest.join(':'), name: s.name || rest.join(':'), ...(s.avatar ? { avatar: s.avatar } : {}), linkedAt: store.get().links?.[key]?.linkedAt || 0 };
    });
    out.push({
      uid,
      name: shown.find((a) => a.platform === 'discord')?.name || user.username || shown[0].name,
      avatar: user.avatar || shown.find((a) => a.avatar)?.avatar || '',
      xp: user.xp || 0,
      level: user.level || 0,
      accounts: shown,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export const snapshot = () => ({ loyaltyRoles: getLoyalty(), linkedUsers: linkedUsers(), linkedPeople: people(), roleSyncLog: store?.get().log || [], pendingLinks: pendingLinks(), roleSyncSubsCheck: store?.get().subsCheck || null });

function announce() {
  bus.emit(EVENTS.CONFIG, { key: 'linkedUsers', value: linkedUsers() });
  bus.emit(EVENTS.CONFIG, { key: 'linkedPeople', value: people() });
}
