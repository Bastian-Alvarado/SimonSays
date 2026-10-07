/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Moderation across the accounts somebody has. When a moderator bans or times
 * somebody out on one platform, the mod log — a private Discord channel —
 * says so, with every other account linked to that person, and buttons to do
 * the same there: ban or time out on Discord, Twitch or YouTube. Nothing is
 * done on its own; a moderator presses, and only a moderator's press counts.
 * The same is on the Role Management screen, for anybody linked.
 *
 * Seen: bans and timeouts on Twitch (its chat says so), bans and timeouts in
 * the Discord server, and somebody removed from TikTok's chat. Done: bans and
 * timeouts on Discord (the bot), Twitch (the channel's login, which needs
 * moderator:manage:banned_users) and YouTube (while live, from the day's
 * allowance). TikTok cannot be moderated from outside its app.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import * as youtube from '../platforms/youtube.js';
import * as leveling from '../leveling/index.js';
import * as roleSync from './role-sync.js';

const log = createLogger('moderation');

export const DEFAULT_MODERATION = { logChannelId: '', logTwitch: true, logDiscord: true, logTikTok: true };
const NAMES = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', discord: 'Discord', kick: 'Kick' };
/** What each platform can be made to do, and for how long a timeout is. */
export const CAN = {
  discord: { ban: true, timeoutSec: 3600 },
  twitch: { ban: true, timeoutSec: 600 },
  youtube: { ban: true, timeoutSec: 300 },
};
const LOG_LIMIT = 200;

let store = null;
const lastTimeout = new Map();
/** What this did itself, a moment ago: Discord tells of it again, and once in the log is enough. */
const ownActs = new Map();

export function cleanModeration(c = {}) {
  return {
    logChannelId: /^\d{5,25}$/.test(String(c.logChannelId || '')) ? String(c.logChannelId) : '',
    logTwitch: c.logTwitch !== false,
    logDiscord: c.logDiscord !== false,
    logTikTok: c.logTikTok !== false,
  };
}
export const getModeration = () => cleanModeration({ ...DEFAULT_MODERATION, ...(store?.get().settings || {}) });

/** Somebody by one of their accounts: their person, and every account they have. */
function personOf(platform, id) {
  const uid = leveling.getAccounts()[`${platform}:${id}`];
  const keys = uid ? leveling.accountsOf(uid) : [`${platform}:${id}`];
  return {
    uid: uid || '',
    accounts: keys.map((key) => {
      const [p, ...rest] = key.split(':');
      return { key, platform: p, id: rest.join(':'), name: roleSync.nameOfAccount(key) || rest.join(':') };
    }),
  };
}

const span = (sec) => (sec >= 86_400 ? `${Math.round(sec / 86_400)} d` : sec >= 3600 ? `${Math.round(sec / 3600)} h` : sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec} s`);

/** The mod log's entry: what happened where, every account of theirs, and buttons for the others. */
export function logEntry({ platform, kind, user, seconds = 0, reason = '' }, person) {
  const what = kind === 'ban' ? '🔨 Ban' : kind === 'timeout' ? `⏳ Timeout (${span(seconds)})` : '🧹 Fuera del chat';
  const lines = person.accounts.map((a) => `${a.platform === platform ? '▸' : '•'} **${NAMES[a.platform] || a.platform}** ${discord.sanitise(a.name, 60)}${a.platform === 'discord' ? ` (<@${a.id}>)` : ''}`);
  const others = person.uid ? person.accounts.filter((a) => a.platform !== platform && CAN[a.platform]) : [];
  const buttons = others.flatMap((a) => [
    { type: 2, style: 4, label: `Ban en ${NAMES[a.platform]}`, custom_id: `mod:ban:${a.platform}:${person.uid}` },
    { type: 2, style: 2, label: `Timeout en ${NAMES[a.platform]}`, custom_id: `mod:timeout:${a.platform}:${person.uid}` },
  ]).slice(0, 10);
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push({ type: 1, components: buttons.slice(i, i + 5) });
  return {
    embed: {
      title: `${what} en ${NAMES[platform] || platform}`,
      description: [`**${discord.sanitise(user || person.accounts[0]?.name || '?', 60)}**`, reason ? `> ${discord.sanitise(reason, 200)}` : '', person.accounts.length > 1 ? `\n${lines.join('\n')}` : ''].filter(Boolean).join('\n'),
      color: kind === 'ban' ? '#ed4245' : '#faa61a',
      footer: person.accounts.length > 1 ? 'Sus otras cuentas: un moderador puede hacer lo mismo allí' : 'Sin otras cuentas vinculadas',
    },
    components: rows.length ? rows : undefined,
  };
}

function remember(entry) {
  store.update((v) => ({ ...v, log: [{ at: Date.now(), ...entry }, ...(v.log || [])].slice(0, LOG_LIMIT) }));
  bus.emit(EVENTS.CONFIG, { key: 'moderationLog', value: store.get().log });
}

/** Something a moderator did somewhere: into the mod log, with every account of theirs. */
async function onAction(a) {
  const cfg = getModeration();
  if (!a?.platform || !a.userId) return;
  if (Date.now() - (ownActs.get(`${a.platform}:${a.userId}`) || 0) < 15_000) return;
  const want = { twitch: cfg.logTwitch, discord: cfg.logDiscord, tiktok: cfg.logTikTok }[a.platform];
  const person = personOf(a.platform, a.userId);
  remember({ platform: a.platform, kind: a.kind, user: a.user || person.accounts[0]?.name || a.userId, seconds: a.seconds || 0, reason: a.reason || '', uid: person.uid });
  if (!cfg.logChannelId || want === false) return;
  const { embed, components } = logEntry(a, person);
  await discord.sendMessage(cfg.logChannelId, '', embed, components, undefined, { allowed_mentions: { parse: [] } })
    .catch((err) => log.warn(`could not write the mod log: ${err.message}`));
}

/** Ban or time somebody out on one platform, by their person. Says what was done. */
export async function act(uid, platform, action, { by = '', key = '' } = {}) {
  // One account when it is named (somebody can have two Discord accounts), or every one they have there.
  const theirs = leveling.accountsOf(uid).filter((k) => k.startsWith(`${platform}:`));
  const targets = key ? theirs.filter((k) => k === key) : theirs;
  if (!targets.length) throw refusal('moderation_no_account', `they have no ${NAMES[platform] || platform} account`, { platform: NAMES[platform] || platform });
  if (!CAN[platform]) throw refusal('moderation_cannot', `${NAMES[platform] || platform} cannot be moderated from here`, { platform: NAMES[platform] || platform });
  const seconds = action === 'timeout' ? CAN[platform]?.timeoutSec || 600 : 0;
  for (const account of targets) await actOn(account, platform, action, seconds, { by, uid });
  return { ok: true, platform, action, seconds, accounts: targets.length };
}

async function actOn(account, platform, action, seconds, { by, uid }) {
  const id = account.slice(platform.length + 1);
  if (platform === 'discord') {
    const guild = discord.getSettings().guildId;
    if (!guild) throw refusal('moderation_no_server', 'no Discord server is chosen');
    if (action === 'ban') await discord.request('PUT', `/guilds/${guild}/bans/${id}`, { body: { delete_message_seconds: 0 } });
    else await discord.request('PATCH', `/guilds/${guild}/members/${id}`, { body: { communication_disabled_until: new Date(Date.now() + seconds * 1000).toISOString() } });
  } else if (platform === 'twitch') {
    await twitch.banUser(id, { seconds, reason: by ? `por ${by}` : '' });
  } else if (platform === 'youtube') {
    await youtube.ban(id, { seconds });
  } else {
    throw refusal('moderation_cannot', `${NAMES[platform] || platform} cannot be moderated from here`, { platform: NAMES[platform] || platform });
  }
  ownActs.set(account, Date.now());
  log.info(`${action} on ${platform} for ${roleSync.nameOfAccount(account) || id}${by ? ` by ${by}` : ''}`);
  remember({ platform, kind: action, user: roleSync.nameOfAccount(account) || id, seconds, reason: by ? `desde la app/Discord por ${by}` : '', uid, done: true });
}

const reply = (i, content) => discord.request('POST', `/interactions/${i.id}/${i.token}/callback`, { body: { type: 4, data: { content, flags: 64 } } });

/** A button in the mod log: only a moderator's press does anything. */
async function onInteraction(i) {
  const id = i?.data?.custom_id || '';
  if (!id.startsWith('mod:')) return;
  const [, action, platform, uid] = id.split(':');
  const guild = i.guild_id || discord.getSettings().guildId;
  const presser = i.member?.user?.id;
  if (!presser || !discord.isModerator(guild, presser, i.member)) {
    await reply(i, '🚫 Solo un moderador puede hacer eso.');
    return;
  }
  try {
    const r = await act(uid, platform, action, { by: i.member?.nick || i.member?.user?.global_name || i.member?.user?.username || '' });
    await reply(i, `✅ ${action === 'ban' ? 'Ban' : `Timeout (${span(r.seconds)})`} en ${NAMES[platform]}.`);
  } catch (err) {
    await reply(i, `⚠️ ${err.message}`);
  }
}

/** Discord: a ban, and a timeout that has just been put on somebody. */
function onDiscordBan(d) {
  if (!d?.user?.id) return;
  onAction({ platform: 'discord', kind: 'ban', userId: String(d.user.id), user: d.user.global_name || d.user.username }).catch(() => {});
}
function onDiscordMember(d) {
  const id = d?.user?.id;
  const until = d?.communication_disabled_until ? Date.parse(d.communication_disabled_until) : 0;
  if (!id) return;
  const was = lastTimeout.get(id) || 0;
  lastTimeout.set(id, until);
  if (until > Date.now() && until !== was) {
    onAction({ platform: 'discord', kind: 'timeout', userId: String(id), user: d.nick || d.user.global_name || d.user.username, seconds: Math.round((until - Date.now()) / 1000) }).catch(() => {});
  }
}
/** TikTok: somebody taken out of the chat. */
function onDelete(e) {
  if (e?.platform !== 'tiktok') return;
  for (const userId of e.userIds || []) onAction({ platform: 'tiktok', kind: 'removed', userId: String(userId) }).catch(() => {});
}

/** From the Role Management screen. */
export async function control(payload = {}) {
  if (payload.op === 'act') return act(String(payload.uid || ''), String(payload.platform || ''), payload.action === 'ban' ? 'ban' : 'timeout', { by: 'el panel', key: String(payload.key || '') });
  if (payload.op === 'log') return store.get().log || [];
  const next = cleanModeration({ ...getModeration(), ...(payload.settings || {}) });
  store.update((v) => ({ ...v, settings: next }));
  bus.emit(EVENTS.CONFIG, { key: 'moderation', value: next });
  return next;
}

export const snapshot = () => ({ moderation: getModeration(), moderationLog: (store?.get().log || []).slice(0, 50) });

export function initModeration() {
  store = collection('moderation', { settings: DEFAULT_MODERATION, log: [] });
  bus.on('mod:action', (a) => { onAction(a).catch((err) => log.warn(err.message)); });
  bus.on('discord:member_ban', onDiscordBan);
  bus.on('discord:member_update', onDiscordMember);
  bus.on(EVENTS.CHAT_DELETE, onDelete);
  bus.on('discord:interaction', (i) => { onInteraction(i).catch((err) => log.warn(`mod button: ${err.message}`)); });
}

export const _test = { onAction, onInteraction, onDiscordMember };
