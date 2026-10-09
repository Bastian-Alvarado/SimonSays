/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Points: a currency viewers earn and spend, apart from XP. XP is what a
 * level is made of and only goes up; points are earned the same way — and
 * for coming to streams, for streaks, for following, subscribing and giving
 * — and spent in the shop on rewards that run one of the streamer's actions:
 * a sound, a TTS message, an overlay effect, a song.
 *
 * One balance per person, whichever platforms they are on (a person is every
 * account linked together). Spent from any chat — Twitch, YouTube, TikTok,
 * Kick, Discord — or from the shop's buttons in Discord, which ask for words
 * in a box of their own when a reward wants them.
 *
 * Earned in memory and saved once a minute, as viewer history is; spending
 * is saved at once.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as leveling from '../leveling/index.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import * as youtube from '../platforms/youtube.js';
import * as commands from './commands.js';
import * as sessions from './stream-sessions.js';
import * as history from './viewer-history.js';
import { readMoney } from '../../shared/viewer-events.js';

const log = createLogger('points');

export const DEFAULT_POINTS = {
  enabled: true,
  /** What they are called, in the stream's language, and their emoji. */
  name: 'puntos',
  emoji: '🪙',
  earn: {
    /** For talking, at most once every `messageEverySec`. */
    message: 5,
    messageEverySec: 60,
    /** For the first word in a stream, and a little more for each stream in a row after the first. */
    stream: 50,
    streakStep: 10,
    streakMax: 100,
    follow: 50,
    sub: 300,
    /** A YouTube membership. */
    member: 300,
    perHundredBits: 50,
    /** TikTok gifts, by the diamonds they are worth. */
    perDiamond: 1,
    superChat: 200,
  },
  /** The words chat uses, and whether YouTube is answered (each answer spends YouTube's daily allowance). */
  words: { balance: '!puntos', shop: '!tienda', redeem: '!canjear', give: '!darpuntos' },
  youtube: true,
  shop: [],
  /** The shop's message in Discord, with a button for each reward. */
  discord: { channelId: '', messageId: '' },
};

/** A reward: what it costs, the action it runs, and how often it can be had. */
export const DEFAULT_ITEM = { id: '', name: '', emoji: '', cost: 100, actionId: '', input: 'none', cooldownSec: 0, perStream: 0, liveOnly: true, enabled: true, description: '' };
export const MAX_ITEMS = 24;
const LOG_LIMIT = 300;
const SAVE_EVERY_MS = 60_000;
const ANSWER_EVERY_MS = 2_000;
const PERSON_EVERY_MS = 10_000;

let store = null;
let engine = null;
let saveTimer = null;
/** person → when they last earned for talking; person → the stream they last earned for coming to. */
const lastTalk = new Map();
/** Answers a chat was given, so a flood of "!puntos" is not a flood back. */
const answered = new Map();
const asked = new Map();

const num = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const word = (v, fallback) => {
  const w = String(v ?? '').trim().split(/\s+/)[0] || '';
  return /^[!?.]?[\p{L}\p{N}_-]{1,24}$/u.test(w) ? w : fallback;
};

export function cleanItem(it, i = 0) {
  const name = String(it?.name ?? '').trim().slice(0, 40);
  return {
    id: /^[\w-]{1,40}$/.test(String(it?.id || '')) ? it.id : `item-${Date.now().toString(36)}${i}`,
    name: name || `Reward ${i + 1}`,
    emoji: String(it?.emoji ?? '').trim().slice(0, 80),
    cost: num(it?.cost, 1, 10_000_000, DEFAULT_ITEM.cost),
    actionId: String(it?.actionId ?? '').slice(0, 80),
    input: ['none', 'optional', 'required'].includes(it?.input) ? it.input : 'none',
    cooldownSec: num(it?.cooldownSec, 0, 86_400, 0),
    perStream: num(it?.perStream, 0, 1000, 0),
    liveOnly: it?.liveOnly !== false,
    enabled: it?.enabled !== false,
    description: String(it?.description ?? '').slice(0, 200),
  };
}

/** The settings as kept: numbers in range, words that are words, rewards each whole. */
export function cleanPoints(incoming, before = DEFAULT_POINTS) {
  const c = { ...before, ...(incoming && typeof incoming === 'object' ? incoming : {}) };
  const e = { ...DEFAULT_POINTS.earn, ...before.earn, ...(c.earn || {}) };
  const w = { ...DEFAULT_POINTS.words, ...before.words, ...(c.words || {}) };
  return {
    enabled: c.enabled !== false,
    name: String(c.name ?? '').trim().slice(0, 24) || DEFAULT_POINTS.name,
    emoji: String(c.emoji ?? '').trim().slice(0, 80),
    earn: {
      message: num(e.message, 0, 10_000, DEFAULT_POINTS.earn.message),
      messageEverySec: num(e.messageEverySec, 5, 3600, DEFAULT_POINTS.earn.messageEverySec),
      stream: num(e.stream, 0, 100_000, DEFAULT_POINTS.earn.stream),
      streakStep: num(e.streakStep, 0, 10_000, DEFAULT_POINTS.earn.streakStep),
      streakMax: num(e.streakMax, 0, 100_000, DEFAULT_POINTS.earn.streakMax),
      follow: num(e.follow, 0, 100_000, DEFAULT_POINTS.earn.follow),
      sub: num(e.sub, 0, 1_000_000, DEFAULT_POINTS.earn.sub),
      member: num(e.member, 0, 1_000_000, DEFAULT_POINTS.earn.member),
      perHundredBits: num(e.perHundredBits, 0, 100_000, DEFAULT_POINTS.earn.perHundredBits),
      perDiamond: num(e.perDiamond, 0, 10_000, DEFAULT_POINTS.earn.perDiamond),
      superChat: num(e.superChat, 0, 1_000_000, DEFAULT_POINTS.earn.superChat),
    },
    words: {
      balance: word(w.balance, DEFAULT_POINTS.words.balance),
      shop: word(w.shop, DEFAULT_POINTS.words.shop),
      redeem: word(w.redeem, DEFAULT_POINTS.words.redeem),
      give: word(w.give, DEFAULT_POINTS.words.give),
    },
    youtube: c.youtube !== false,
    shop: (Array.isArray(c.shop) ? c.shop : []).slice(0, MAX_ITEMS).map(cleanItem),
    discord: {
      channelId: /^\d{5,25}$/.test(String(c.discord?.channelId || '')) ? String(c.discord.channelId) : '',
      messageId: /^\d{5,25}$/.test(String(c.discord?.messageId || '')) ? String(c.discord.messageId) : '',
    },
  };
}

export const getPoints = () => cleanPoints(store?.get().settings || {}, DEFAULT_POINTS);
const balances = () => store.get().balances;
export const balanceOf = (uid) => balances()[uid] || 0;

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'pointsSettings', value: getPoints() });
}

/** The richest, for the screen and "!puntos top". The channel's own accounts are not among them. */
export function richest(limit = 50) {
  const users = leveling.getUsers();
  return Object.entries(balances())
    .filter(([uid, n]) => n > 0 && users[uid] && !users[uid].own)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([uid, points]) => ({ uid, points, name: users[uid]?.username || uid, avatar: users[uid]?.avatar || '' }));
}

/** Add (or, below zero, take) points; never below nothing. Kept in memory unless `now` says to save at once. */
export function add(uid, delta, why, { now = false, name = '' } = {}) {
  if (!uid || !Number.isFinite(delta) || !delta) return balanceOf(uid);
  const write = now ? 'update' : 'updateQuietly';
  let after = 0;
  store[write]((v) => {
    after = Math.max(0, (v.balances[uid] || 0) + Math.round(delta));
    v.balances[uid] = after;
    if (now || Math.abs(delta) >= 50) {
      v.log = [{ at: Date.now(), uid, name: name || leveling.getUsers()[uid]?.username || '', delta: Math.round(delta), why: String(why || '').slice(0, 60), after }, ...(v.log || [])].slice(0, LOG_LIMIT);
    }
    return v;
  });
  return after;
}

// ------------------------------------------------------------ earning

const STREAM_CHATS = new Set(['twitch', 'youtube', 'tiktok', 'kick', 'discord']);

function onChat(chat, { stream = true } = {}, now = Date.now()) {
  const cfg = getPoints();
  if (!cfg.enabled || !chat?.userId || chat.isBot || !chat.platform) return;
  const uid = leveling.personFor(chat.platform, chat.userId, chat.user, chat.avatar);
  if (leveling.getUsers()[uid]?.own || chat.isBroadcaster) return;
  if (cfg.earn.message && now - (lastTalk.get(uid) || 0) >= cfg.earn.messageEverySec * 1000) {
    lastTalk.set(uid, now);
    add(uid, cfg.earn.message, 'chat');
  }
  // The first word in a stream: points for coming, and more for coming back stream after stream.
  const live = stream && STREAM_CHATS.has(chat.platform) ? sessions.current() : null;
  if (live) {
    const came = store.get().came || {};
    if (came[uid] !== live.id) {
      store.updateQuietly((v) => ({ ...v, came: { ...(v.came || {}), [uid]: live.id } }));
      const streak = history.historyOf(uid)?.streak || 1;
      const bonus = Math.min(cfg.earn.streakMax, cfg.earn.streakStep * Math.max(0, streak - 1));
      if (cfg.earn.stream + bonus) add(uid, cfg.earn.stream + bonus, streak > 1 ? `stream (${streak} in a row)` : 'stream', { name: chat.user });
    }
  }
  answerChat(chat, uid);
}

/** What a viewer did on stream, in points. */
export function pointsFor(e, cfg = getPoints()) {
  const d = e?.data || {};
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  switch (e?.type) {
    case 'twitch_follow': case 'tiktok_follow': return cfg.earn.follow;
    case 'twitch_sub': return d.giftedBy ? 0 : cfg.earn.sub;
    case 'tiktok_sub': return cfg.earn.sub;
    case 'twitch_sub_gift_bulk': case 'youtube_sub_gift_bulk': return cfg.earn.sub * (n(d.count) || 1);
    case 'youtube_sub': return cfg.earn.member;
    case 'twitch_cheer': return Math.floor(n(d.bits ?? d.amount) / 100 * cfg.earn.perHundredBits);
    case 'tiktok_gift': return Math.floor((n(d.diamonds) || n(d.amount)) * (n(d.count) || 1) * cfg.earn.perDiamond);
    case 'youtube_cheer': return readMoney(d.amount) ? cfg.earn.superChat : 0;
    default: return 0;
  }
}

function onEvent(e) {
  const cfg = getPoints();
  if (!cfg.enabled || !e?.data?.userId || e.data.fromBulk) return;
  const pts = pointsFor(e, cfg);
  if (!pts) return;
  const uid = leveling.personFor(e.platform, e.data.userId, e.user, e.avatar);
  add(uid, pts, e.type, { name: e.user });
}

// ------------------------------------------------------------ spending

/**
 * Which reward the words after "!canjear" name, and how many of them it took:
 * a number from the list, a whole name (the longest that fits, so "TTS largo"
 * beats "TTS"), or the start of one.
 */
export function itemSaid(cfg, words) {
  const shown = cfg.shop.filter((it) => it.enabled);
  const first = String(words[0] || '').toLowerCase();
  const n = Number(first);
  if (Number.isInteger(n) && n >= 1 && n <= shown.length) return { item: shown[n - 1], used: 1 };
  for (let k = words.length; k >= 1; k -= 1) {
    const q = words.slice(0, k).join(' ').toLowerCase();
    const hit = shown.find((it) => it.id === q || it.name.toLowerCase() === q);
    if (hit) return { item: hit, used: k };
  }
  const start = first && shown.find((it) => it.name.toLowerCase().startsWith(first));
  return start ? { item: start, used: 1 } : { item: null, used: 0 };
}

/**
 * Spend points on a reward. Answers what happened: ok with the balance left,
 * or why not — off, gone, offline (only while live), input (words wanted),
 * broke, cooldown (and how long), limit (enough for this stream), failed.
 * If the action cannot run, the points come back.
 */
export async function redeem(uid, itemId, { input = '', platform = 'system', name = '', userId = '', avatar = '', isSub = false } = {}, now = Date.now()) {
  const cfg = getPoints();
  const item = cfg.shop.find((it) => it.id === itemId);
  if (!cfg.enabled || !item || !item.enabled) return { ok: false, why: 'gone' };
  const live = sessions.current();
  if (item.liveOnly && !live) return { ok: false, why: 'offline', item };
  const words = String(input || '').trim().slice(0, 300);
  if (item.input === 'required' && !words) return { ok: false, why: 'input', item };
  const used = store.get().used?.[item.id] || {};
  if (item.cooldownSec && now - (used.at || 0) < item.cooldownSec * 1000) {
    return { ok: false, why: 'cooldown', item, seconds: Math.ceil((item.cooldownSec * 1000 - (now - used.at)) / 1000) };
  }
  const thisStream = live && used.stream === live.id ? used.count || 0 : 0;
  if (item.perStream && live && thisStream >= item.perStream) return { ok: false, why: 'limit', item };
  if (balanceOf(uid) < item.cost) return { ok: false, why: 'broke', item, balance: balanceOf(uid) };

  const who = name || leveling.getUsers()[uid]?.username || 'Someone';
  add(uid, -item.cost, `🛒 ${item.name}`, { now: true, name: who });
  store.update((v) => ({ ...v, used: { ...(v.used || {}), [item.id]: { at: now, stream: live?.id || '', count: thisStream + 1 } } }));
  try {
    if (item.actionId) await engine.runActionFor(item.actionId, { name: who, id: userId, avatar, platform, isSub, input: words });
  } catch (err) {
    add(uid, item.cost, `↩ ${item.name}`, { now: true, name: who });
    store.update((v) => ({ ...v, used: { ...(v.used || {}), [item.id]: used } }));
    log.warn(`${item.name} for ${who} did not run: ${err.message}`);
    return { ok: false, why: 'failed', item };
  }
  log.info(`${who} spent ${item.cost} on ${item.name}`);
  // For alerts and actions: {user} bought {event.item}.
  bus.emit(EVENTS.EVENT, normaliseEvent({
    type: 'points_redeem', platform, user: who, avatar: avatar || undefined,
    data: { item: item.name, cost: item.cost, input: words, balance: balanceOf(uid), userId },
  }));
  return { ok: true, item, balance: balanceOf(uid) };
}

// ------------------------------------------------------------ chat

const say = {
  twitch: (text) => twitch.say(text, { useBot: true }),
  youtube: (text) => youtube.say(text, { cut: true }),
  discord: (text, chat) => discord.sendMessage(chat.raw?.channelId, text, null, null, null, {
    allowed_mentions: { parse: [] },
    ...(chat.raw?.messageId ? { message_reference: { message_id: chat.raw.messageId, fail_if_not_exists: false } } : {}),
  }),
};
const fmt = (n) => Number(n || 0).toLocaleString('es-MX');
const nameFor = (platform, name) => (platform === 'discord' ? discord.sanitise(name) : String(name ?? ''));

/** What a reward costs, as chat shows it: "1. TTS (200 🪙)". */
const shopLine = (cfg) => cfg.shop.filter((it) => it.enabled).map((it, i) => `${i + 1}. ${it.name} (${fmt(it.cost)}${cfg.emoji ? ` ${cfg.emoji}` : ''})`).join(' · ');

/** Why a reward could not be had, in the stream's language. */
export function whyNot(r, cfg = getPoints()) {
  const unit = `${cfg.emoji ? `${cfg.emoji} ` : ''}${cfg.name}`;
  switch (r.why) {
    case 'broke': return `cuesta ${fmt(r.item.cost)} ${unit} y tienes ${fmt(r.balance)}.`;
    case 'cooldown': return `${r.item.name} estará otra vez en ${r.seconds} s.`;
    case 'limit': return `${r.item.name} ya no se puede en este directo.`;
    case 'offline': return `${r.item.name} solo va en directo.`;
    case 'input': return `${r.item.name} necesita un texto: ${cfg.words.redeem} ${r.item.name} <texto>.`;
    case 'failed': return `${r.item.name} no funcionó; te devolví los ${cfg.name}.`;
    default: return 'esa recompensa no existe.';
  }
}

function reply(chat, text) {
  const cfg = getPoints();
  const send = say[chat.platform];
  if (!send || (chat.platform === 'youtube' && !cfg.youtube)) return;
  const now = Date.now();
  if (now - (answered.get(chat.platform) || 0) < ANSWER_EVERY_MS) return;
  answered.set(chat.platform, now);
  Promise.resolve(send(text, chat)).catch((err) => log.debug(`could not answer on ${chat.platform}: ${err.message}`));
}

/** "!puntos", "!tienda", "!canjear …", and a moderator's "!darpuntos @name 100". */
function answerChat(chat, uid) {
  const cfg = getPoints();
  const said = String(chat.msg ?? '').trim();
  const [first, ...rest] = said.split(/\s+/);
  const w = (first || '').toLowerCase();
  const which = Object.entries(cfg.words).find(([, x]) => x.toLowerCase() === w)?.[0];
  if (!which) return;
  // A command of the streamer's own on the same word answers instead.
  if (commands.ownCommandAnswers(collection('commands', []).get(), collection('actions', []).get(), said, chat.platform)) return;
  const now = Date.now();
  const key = `${uid}:${which}`;
  if (which !== 'redeem' && now - (asked.get(key) || 0) < PERSON_EVERY_MS) return;
  asked.set(key, now);
  if (asked.size > 1000) asked.clear();
  const me = nameFor(chat.platform, chat.user);
  const unit = `${cfg.emoji ? `${cfg.emoji} ` : ''}${cfg.name}`;

  if (which === 'balance') {
    const named = rest.join(' ');
    const other = named ? leveling.findByName(named) : null;
    if (named && !other) return reply(chat, `${nameFor(chat.platform, named.replace(/^@/, ''))} todavía no tiene ${cfg.name}.`);
    const who = other ? nameFor(chat.platform, other.username) : me;
    return reply(chat, `${who}: ${fmt(balanceOf(other?.id || uid))} ${unit}`);
  }
  if (which === 'shop') {
    const line = shopLine(cfg);
    return reply(chat, line ? `${line} — ${cfg.words.redeem} <número o nombre>` : `La tienda está vacía.`);
  }
  if (which === 'give') {
    if (!chat.isMod && !chat.isBroadcaster) return undefined;
    const amount = Number(rest.at(-1));
    const target = leveling.findByName(rest.slice(0, -1).join(' '));
    if (!target || !Number.isInteger(amount) || !amount) return reply(chat, `${cfg.words.give} @nombre 100 (o -100 para quitar)`);
    const after = add(target.id, amount, `${amount > 0 ? '+' : ''}${amount} by ${chat.user}`, { now: true, name: target.username });
    return reply(chat, `${nameFor(chat.platform, target.username)}: ${fmt(after)} ${unit}`);
  }
  // Redeem: the reward by its number or its whole name (the longest that fits), or the start of one; the rest is their words.
  const { item, used } = itemSaid(cfg, rest);
  if (!item) return reply(chat, `${me}: ${whyNot({ why: 'gone' })} ${shopLine(cfg)}`);
  const input = rest.slice(used).join(' ');
  redeem(uid, item.id, { input, platform: chat.platform, name: chat.user, userId: chat.userId, avatar: chat.avatar, isSub: chat.isSub })
    .then((r) => reply(chat, r.ok ? `${me} ✅ ${r.item.name} (${fmt(r.balance)} ${unit})` : `${me}: ${whyNot(r, cfg)}`))
    .catch((err) => log.warn(`redeem failed: ${err.message}`));
  return undefined;
}

// ------------------------------------------------------------ the shop in Discord

/** The shop's Discord message: what each reward costs, a button for each, and one to see your balance. */
export function shopMessage(cfg = getPoints()) {
  const items = cfg.shop.filter((it) => it.enabled);
  const unit = `${cfg.emoji ? `${cfg.emoji} ` : ''}${cfg.name}`;
  const lines = items.map((it) => `${it.emoji ? `${it.emoji} ` : ''}**${discord.sanitise(it.name, 40)}** — ${fmt(it.cost)} ${unit}${it.description ? `\n-# ${it.description.replace(/\n/g, ' ')}` : ''}`);
  const buttons = items.map((it) => ({
    type: 2, style: 1, label: it.name.slice(0, 80), custom_id: `shop:buy:${it.id}`,
    ...(it.emoji ? { emoji: /^<a?:/.test(it.emoji) ? { id: it.emoji.split(':')[2].replace('>', ''), name: it.emoji.split(':')[1] } : { name: it.emoji } } : {}),
  }));
  buttons.push({ type: 2, style: 2, label: `Mis ${cfg.name}`.slice(0, 80), custom_id: 'shop:balance', emoji: { name: cfg.emoji && !/^<a?:/.test(cfg.emoji) ? cfg.emoji : '🪙' } });
  // Their profile, as a picture only they see (profile-card.js).
  buttons.push({ type: 2, style: 2, label: 'Mi perfil', custom_id: 'profile:me', emoji: { name: '🪪' } });
  const rows = [];
  for (let i = 0; i < buttons.length && rows.length < 5; i += 5) rows.push({ type: 1, components: buttons.slice(i, i + 5) });
  return {
    embed: { title: `Tienda de ${cfg.name}`, description: lines.join('\n') || 'La tienda está vacía.', color: '#f5a623', footer: `${cfg.words.balance} · ${cfg.words.shop} · ${cfg.words.redeem}` },
    components: rows,
  };
}

/** Post the shop in Discord, or bring the post already there up to date. */
export async function postShop(channelId) {
  const cfg = getPoints();
  const where = /^\d{5,25}$/.test(String(channelId || '')) ? String(channelId) : cfg.discord.channelId;
  if (!where) throw refusal('points_no_channel', 'choose a channel for the shop first');
  const { embed, components } = shopMessage(cfg);
  if (where === cfg.discord.channelId && cfg.discord.messageId) {
    try {
      await discord.editMessage(where, cfg.discord.messageId, '', embed, components);
      return { done: 'updated' };
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }
  const sent = await discord.sendMessage(where, '', embed, components);
  store.update((v) => ({ ...v, settings: { ...(v.settings || {}), discord: { channelId: where, messageId: String(sent?.id || '') } } }));
  publish();
  return { done: 'posted' };
}

const respond = (i, data, type = 4) => discord.request('POST', `/interactions/${i.id}/${i.token}/callback`, { body: { type, data } });

async function onInteraction(i) {
  const id = i?.data?.custom_id || '';
  if (!id.startsWith('shop:')) return;
  const cfg = getPoints();
  const member = i.member?.user || i.user;
  if (!member?.id) return;
  const uid = leveling.personFor('discord', member.id, i.member?.nick || member.global_name || member.username);
  const name = i.member?.nick || member.global_name || member.username;
  const unit = `${cfg.emoji ? `${cfg.emoji} ` : ''}${cfg.name}`;
  const quiet = (content) => respond(i, { content, flags: 64 });

  if (id === 'shop:balance') return quiet(`Tienes ${fmt(balanceOf(uid))} ${unit}.`);
  const [, kind, itemId] = id.split(':');
  const item = cfg.shop.find((it) => it.id === itemId);
  if (!item) return quiet(whyNot({ why: 'gone' }, cfg));
  // A reward that wants words asks for them in a box of its own.
  if (kind === 'buy' && i.type === 3 && item.input !== 'none') {
    return respond(i, {
      custom_id: `shop:input:${item.id}`,
      title: item.name.slice(0, 45),
      components: [{ type: 1, components: [{ type: 4, custom_id: 'words', label: (item.description || 'Texto').slice(0, 45), style: 2, min_length: item.input === 'required' ? 1 : 0, max_length: 300, required: item.input === 'required' }] }],
    }, 9);
  }
  const words = i.type === 5 ? (i.data.components?.[0]?.components?.[0]?.value || '') : '';
  const r = await redeem(uid, item.id, { input: words, platform: 'discord', name, userId: member.id, avatar: member.avatar ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png` : '' });
  return quiet(r.ok ? `✅ ${r.item.name} — te quedan ${fmt(r.balance)} ${unit}.` : whyNot(r, cfg));
}

// ------------------------------------------------------------ the screen

export function setPoints(patch) {
  const next = cleanPoints({ ...getPoints(), ...(patch || {}) }, getPoints());
  store.update((v) => ({ ...v, settings: next }));
  publish();
  return next;
}

/** From the Points screen: { op, … }. */
export async function control(payload = {}) {
  switch (payload.op) {
    case 'settings': return setPoints(payload.settings);
    case 'post_shop': return postShop(payload.channelId);
    case 'give': {
      const uid = String(payload.uid || '');
      if (!leveling.getUsers()[uid]) throw refusal('points_nobody', 'that person is not known');
      return { balance: add(uid, Number(payload.amount) || 0, `${Number(payload.amount) > 0 ? '+' : ''}${Number(payload.amount)} by hand`, { now: true }) };
    }
    case 'board': return { richest: richest(Number(payload.limit) || 50), log: (store.get().log || []).slice(0, 100) };
    default: throw new Error(`unknown points operation "${payload.op}"`);
  }
}

export const snapshot = () => ({ pointsSettings: getPoints() });

export function initPoints(deps) {
  engine = deps.engine;
  store = collection('points', { settings: {}, balances: {}, log: [], used: {}, came: {} });
  bus.on(EVENTS.CHAT, (c) => onChat(c));
  bus.on('discord:message_elsewhere', (c) => onChat(c, { stream: false }));
  bus.on(EVENTS.EVENT, onEvent);
  bus.on('discord:interaction', (i) => { onInteraction(i).catch((err) => log.warn(`shop button: ${err.message}`)); });
  bus.on('people:merged', ({ into, from }) => {
    const moved = balances()[from] || 0;
    store.update((v) => {
      v.balances[into] = (v.balances[into] || 0) + moved;
      delete v.balances[from];
      return v;
    });
  });
  bus.on('people:forgotten', ({ uids }) => store.updateQuietly((v) => { for (const uid of uids || []) delete v.balances[uid]; return v; }));
  // Somebody with points to spend is never forgotten.
  history.keepWhen((uid) => balanceOf(uid) > 0);
  clearInterval(saveTimer);
  saveTimer = setInterval(() => store.flush(), SAVE_EVERY_MS);
  saveTimer.unref?.();
}

export const _test = { onChat, onEvent, onInteraction, flush: () => store.flush() };
