/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A person's profile, across every platform they are on: their level and how
 * far to the next, their place among the chatters, their points, the streams
 * they came to and their streak, the accounts linked to them, what they gave
 * and the giveaways they won.
 *
 * "!perfil" (or another word) in any chat answers it. In Discord it is a
 * picture, drawn by the same renderer as the welcome card; Twitch, YouTube and
 * TikTok cannot show one, so there it is a line. The shop's message in
 * Discord carries a "Mi perfil" button that answers privately.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as leveling from '../leveling/index.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import * as youtube from '../platforms/youtube.js';
import * as commands from './commands.js';
import * as history from './viewer-history.js';
import * as points from './points.js';
import * as roleSync from './role-sync.js';
import { cardFonts, emojiAsset, pictureData } from './welcome-card.js';

const log = createLogger('profile');

export const DEFAULT_PROFILE = { enabled: true, word: '!perfil', accent: '#9146ff', youtube: true };
const PLATFORM_COLOURS = { twitch: '#9146ff', youtube: '#ff0000', tiktok: '#ff0050', discord: '#5865f2', kick: '#53fc18' };
const PLATFORM_NAMES = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', discord: 'Discord', kick: 'Kick' };
const PERSON_EVERY_MS = 30_000;
const CHAT_EVERY_MS = 3_000;

let store = null;
const asked = new Map();
const answered = new Map();

export function cleanProfile(c = {}) {
  const word = String(c.word ?? '').trim().split(/\s+/)[0] || '';
  return {
    enabled: c.enabled !== false,
    word: /^[!?.]?[\p{L}\p{N}_-]{1,24}$/u.test(word) ? word : DEFAULT_PROFILE.word,
    accent: /^#[0-9a-f]{6}$/i.test(String(c.accent || '')) ? c.accent.toLowerCase() : DEFAULT_PROFILE.accent,
    youtube: c.youtube !== false,
  };
}
export const getProfile = () => cleanProfile({ ...DEFAULT_PROFILE, ...(store?.get() || {}) });

export function setProfile(patch) {
  const next = cleanProfile({ ...getProfile(), ...(patch || {}) });
  store.set(next);
  bus.emit(EVENTS.CONFIG, { key: 'profileCard', value: next });
  return next;
}

// ------------------------------------------------------------ what a profile says

/** Everything a profile shows, for one person. Null for nobody known. */
export function profileOf(uid) {
  const user = leveling.getUsers()[uid];
  if (!user) return null;
  const keys = leveling.accountsOf(uid);
  const accounts = keys.map((key) => {
    const [platform, ...rest] = key.split(':');
    return { platform, name: roleSync.nameOfAccount(key) || (keys.length === 1 ? user.username : rest.join(':')) || rest.join(':') };
  });
  const h = history.historyOf(uid) || { streams: 0, streak: 0, bestStreak: 0, messages: 0, support: {}, wins: 0, first: 0 };
  const level = user.level || 0;
  const from = leveling.xpForLevel(level);
  const to = leveling.xpForLevel(level + 1);
  const discordKey = keys.find((k) => k.startsWith('discord:'));
  const cfg = points.getPoints();
  return {
    uid,
    name: (discordKey && roleSync.nameOfAccount(discordKey)) || user.username || accounts[0]?.name || '?',
    avatar: user.avatar || (discordKey ? roleSync.avatarOfAccount(discordKey) : '') || '',
    level,
    xp: user.xp || 0,
    progress: to > from ? Math.min(1, Math.max(0, ((user.xp || 0) - from) / (to - from))) : 0,
    nextXp: to,
    rank: leveling.rankOf(uid),
    points: points.balanceOf(uid),
    pointsName: cfg.name,
    pointsEmoji: cfg.emoji,
    streams: h.streams || 0,
    streak: h.streak || 0,
    bestStreak: h.bestStreak || 0,
    messages: h.messages || 0,
    since: h.first || user.createdAt || 0,
    support: h.support || {},
    wins: h.wins || 0,
    accounts,
  };
}

const fmt = (n) => Number(n || 0).toLocaleString('es-MX');
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;

/** What they gave, only what there is: "1,200 bits · 2 subs · 5 regalos de TikTok". */
export function supportLine(s = {}) {
  const money = Object.entries(s.superChat || {}).map(([cur, v]) => `${cur}${fmt(v)}`).join(' + ');
  return [
    s.bits && `${fmt(s.bits)} bits`,
    s.subs && plural(s.subs, 'sub', 'subs'),
    s.gifted && plural(s.gifted, 'sub regalada', 'subs regaladas'),
    s.members && plural(s.members, 'membresía', 'membresías'),
    money && `Super Chats ${money}`,
    s.tiktokGifts && plural(s.tiktokGifts, 'regalo de TikTok', 'regalos de TikTok'),
  ].filter(Boolean).join(' · ');
}

/** The profile as one line, for a chat that cannot show a picture. */
export function profileLine(p) {
  const unit = `${p.pointsEmoji ? `${p.pointsEmoji} ` : ''}${p.pointsName}`;
  return [
    `${p.name}: nivel ${p.level}${p.rank ? ` (#${p.rank.rank})` : ''}`,
    `${fmt(p.points)} ${unit}`,
    plural(p.streams, 'directo', 'directos'),
    p.streak > 1 ? `racha de ${p.streak}` : '',
    p.wins ? plural(p.wins, 'sorteo ganado', 'sorteos ganados') : '',
    p.accounts.length > 1 ? p.accounts.map((a) => PLATFORM_NAMES[a.platform] || a.platform).join('+') : '',
  ].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------ the picture

const el = (type, style, children, props = {}) => ({ type, props: { ...props, style, children } });
const text = (style, s) => el('div', { display: 'flex', ...style }, s);

function stat(label, value, accent) {
  return el('div', { display: 'flex', flexDirection: 'column', padding: '10px 16px', borderRadius: 14, backgroundColor: '#1c1c24', minWidth: 120 }, [
    text({ fontSize: 13, color: '#a1a1aa', fontWeight: 600, letterSpacing: 1 }, label.toUpperCase()),
    text({ fontSize: 26, color: accent || '#ffffff', fontWeight: 800 }, value),
  ]);
}

/** The profile as a picture, 900 × 360. */
export async function renderProfile(p, cfg = getProfile()) {
  const accent = cfg.accent;
  const avatar = p.avatar ? await pictureData(p.avatar) : null;
  // A server emoji cannot be drawn as words: the name stands in for it.
  const unit = p.pointsEmoji && !/^<a?:/.test(p.pointsEmoji) ? p.pointsEmoji : p.pointsName;
  const since = p.since ? new Date(p.since).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const extra = [supportLine(p.support), p.wins ? plural(p.wins, 'sorteo ganado', 'sorteos ganados') : '', since ? `desde el ${since}` : ''].filter(Boolean).join(' · ');
  const tree = el('div', {
    width: 900, height: 360, display: 'flex', padding: 32, gap: 32, alignItems: 'center', fontFamily: 'Montserrat',
    backgroundColor: '#0f0f14', backgroundImage: `linear-gradient(135deg, ${accent}55 0%, #0f0f14 45%, #0f0f14 100%)`, color: '#ffffff',
  }, [
    avatar
      ? el('img', { width: 180, height: 180, borderRadius: 9999, border: `6px solid ${accent}`, objectFit: 'cover' }, undefined, { src: avatar })
      : el('div', { width: 180, height: 180, borderRadius: 9999, border: `6px solid ${accent}`, backgroundColor: '#27272a', display: 'flex' }),
    // Bounded: the card is 900 wide, less its padding, the picture and the gap — without it, long lines ran off the edge.
    el('div', { display: 'flex', flexDirection: 'column', width: 900 - 64 - 192 - 32, gap: 12 }, [
      el('div', { display: 'flex', alignItems: 'baseline', gap: 14 }, [
        text({ fontSize: 40, fontWeight: 900, maxWidth: 480, overflow: 'hidden' }, p.name),
        p.rank ? text({ fontSize: 20, fontWeight: 700, color: '#a1a1aa' }, `#${p.rank.rank} de ${fmt(p.rank.total)}`) : null,
      ].filter(Boolean)),
      el('div', { display: 'flex', flexDirection: 'column', gap: 6 }, [
        el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#d4d4d8', fontWeight: 600 }, [
          text({}, `Nivel ${p.level}`),
          text({ color: '#a1a1aa' }, `${fmt(p.xp)} / ${fmt(p.nextXp)} XP`),
        ]),
        el('div', { display: 'flex', height: 14, borderRadius: 9999, backgroundColor: '#27272a', width: '100%' }, [
          el('div', { display: 'flex', width: `${Math.round(p.progress * 100)}%`, height: 14, borderRadius: 9999, backgroundColor: accent }),
        ]),
      ]),
      el('div', { display: 'flex', gap: 10 }, [
        stat(p.pointsName, `${fmt(p.points)} ${unit && unit !== p.pointsName ? unit : ''}`.trim(), '#fbbf24'),
        stat('Directos', fmt(p.streams)),
        stat('Racha', p.bestStreak > p.streak ? `${p.streak} (máx. ${p.bestStreak})` : fmt(p.streak)),
        stat('Mensajes', fmt(p.messages)),
      ]),
      el('div', { display: 'flex', gap: 8, flexWrap: 'wrap' }, p.accounts.slice(0, 6).map((a) => el('div', {
        display: 'flex', padding: '4px 12px', borderRadius: 9999, fontSize: 15, fontWeight: 700,
        backgroundColor: `${PLATFORM_COLOURS[a.platform] || '#52525b'}33`, border: `2px solid ${PLATFORM_COLOURS[a.platform] || '#52525b'}`,
      }, `${PLATFORM_NAMES[a.platform] || a.platform} · ${String(a.name).slice(0, 24)}`))),
      extra ? text({ fontSize: 14, color: '#a1a1aa' }, extra) : null,
    ].filter(Boolean)),
  ]);
  const svg = await satori(tree, { width: 900, height: 360, fonts: cardFonts(), loadAdditionalAsset: emojiAsset });
  return new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
}

// ------------------------------------------------------------ answering

const say = {
  twitch: (t) => twitch.say(t, { useBot: true }),
  youtube: (t) => youtube.say(t, { cut: true }),
};

/** A Discord message with the picture, replying to the one that asked. */
function sendPicture(chat, png, p) {
  return discord.sendMessage(chat.raw?.channelId, '', { title: p.name, image: 'attachment://perfil.png', color: getProfile().accent }, null, [{ name: 'perfil.png', data: png, type: 'image/png' }], {
    allowed_mentions: { parse: [] },
    ...(chat.raw?.messageId ? { message_reference: { message_id: chat.raw.messageId, fail_if_not_exists: false } } : {}),
  });
}

async function onChat(chat) {
  const cfg = getProfile();
  if (!cfg.enabled || !chat?.userId || chat.isBot) return;
  const said = String(chat.msg ?? '').trim();
  const [first, ...rest] = said.split(/\s+/);
  if ((first || '').toLowerCase() !== cfg.word.toLowerCase()) return;
  if (commands.ownCommandAnswers(collection('commands', []).get(), collection('actions', []).get(), said, chat.platform)) return;
  const now = Date.now();
  const me = `${chat.platform}:${chat.userId}`;
  if (now - (asked.get(me) || 0) < PERSON_EVERY_MS) return;
  if (now - (answered.get(chat.platform) || 0) < CHAT_EVERY_MS) return;
  asked.set(me, now);
  answered.set(chat.platform, now);
  if (asked.size > 1000) asked.clear();

  const named = rest.join(' ');
  const uid = named ? leveling.findByName(named)?.id : leveling.getAccounts()[me];
  const p = uid ? profileOf(uid) : null;
  if (chat.platform === 'discord') {
    if (!p) {
      await discord.sendMessage(chat.raw?.channelId, `${discord.sanitise(named || chat.user)} todavía no tiene perfil.`, null, null, null, { allowed_mentions: { parse: [] } });
      return;
    }
    await sendPicture(chat, await renderProfile(p, cfg), p);
    return;
  }
  const send = say[chat.platform];
  if (!send || (chat.platform === 'youtube' && !cfg.youtube)) return;
  await send(p ? profileLine(p) : `${named || chat.user} todavía no tiene perfil.`);
}

/** The shop's "Mi perfil" button: their profile, as a picture only they see. */
async function onInteraction(i) {
  if (i?.data?.custom_id !== 'profile:me') return;
  const member = i.member?.user || i.user;
  if (!member?.id) return;
  const uid = leveling.personFor('discord', member.id, i.member?.nick || member.global_name || member.username);
  const p = profileOf(uid);
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ type: 4, data: { flags: 64, attachments: [{ id: 0, filename: 'perfil.png' }] } }));
  form.append('files[0]', new Blob([await renderProfile(p)], { type: 'image/png' }), 'perfil.png');
  await discord.request('POST', `/interactions/${i.id}/${i.token}/callback`, { body: form, isMultipart: true });
}

/** The Levels & XP screen: the settings, or a preview for the person at the top of the board. */
export async function control(payload = {}) {
  if (payload.op === 'settings') return setProfile(payload.settings);
  const uid = payload.uid || leveling.leaderboard(1)[0]?.id;
  const p = uid ? profileOf(uid) : null;
  if (!p) return { image: '', name: '' };
  const png = await renderProfile(p, cleanProfile({ ...getProfile(), ...(payload.settings || {}) }));
  return { image: `data:image/png;base64,${png.toString('base64')}`, name: p.name, line: profileLine(p) };
}

export const snapshot = () => ({ profileCard: getProfile() });

export function initProfileCard() {
  store = collection('profile_card', DEFAULT_PROFILE);
  const answer = (c) => { onChat(c).catch((err) => log.debug(`profile answer failed: ${err.message}`)); };
  bus.on(EVENTS.CHAT, answer);
  bus.on('discord:message_elsewhere', answer);
  bus.on('discord:interaction', (i) => { onInteraction(i).catch((err) => log.warn(`profile button: ${err.message}`)); });
}

export const _test = { onChat, onInteraction };
