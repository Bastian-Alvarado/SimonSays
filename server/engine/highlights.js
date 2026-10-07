/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Highlights: the moments chat goes wild. Every platform's chat counted
 * together — Twitch, YouTube, TikTok, Kick and the Discord channel the stream
 * reads — and when a minute runs at several times the stream's usual pace,
 * that is a moment: a Twitch marker goes in the VOD, a clip is made, and
 * (if a channel is chosen) Discord gets a post with what chat was saying,
 * the song playing, the plan's step and a link to the moment in the VOD.
 * The moment is kept with the stream, for its chapters.
 *
 * Only something that runs on all of them can tell: one platform's chat
 * alone may be quiet while the others are not.
 *
 * Off until it is turned on, since it posts in Discord and makes clips.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import * as spotify from '../platforms/spotify.js';
import * as sessions from './stream-sessions.js';
import * as extras from './twitch-extras.js';
import { getPlan } from './plan.js';
import { getGreetings } from './welcome.js';

const log = createLogger('highlights');

export const DEFAULT_HIGHLIGHTS = {
  enabled: false,
  /** How many times the stream's usual pace a minute has to run at. */
  factor: 3,
  /** And at least this many messages in it, so a quiet stream's one busy minute is not a moment. */
  minMessages: 15,
  /** Minutes between two moments. */
  cooldownMin: 5,
  marker: true,
  clip: true,
  /** Where the moment is posted in Discord; empty is nowhere. */
  channelId: '',
  /** How many of chat's messages the post quotes. */
  quotes: 4,
};
const CHECK_EVERY_MS = 15_000;
const KEEP_MS = 3 * 60_000;
const STREAM_CHATS = new Set(['twitch', 'youtube', 'tiktok', 'kick', 'discord']);
const PLATFORM_NAMES = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', kick: 'Kick', discord: 'Discord' };

let store = null;
let timer = null;
let lastAt = 0;
let vodFor = { id: '', vod: null };
/** The last few minutes of chat, every platform: for counting and for quoting. Memory only. */
let recent = [];

export function cleanHighlights(c = {}, before = DEFAULT_HIGHLIGHTS) {
  const x = { ...before, ...(c && typeof c === 'object' ? c : {}) };
  const num = (v, min, max, d) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : d);
  return {
    enabled: x.enabled === true,
    factor: num(x.factor, 1.5, 10, DEFAULT_HIGHLIGHTS.factor),
    minMessages: Math.round(num(x.minMessages, 3, 1000, DEFAULT_HIGHLIGHTS.minMessages)),
    cooldownMin: Math.round(num(x.cooldownMin, 1, 120, DEFAULT_HIGHLIGHTS.cooldownMin)),
    marker: x.marker !== false,
    clip: x.clip !== false,
    channelId: /^\d{5,25}$/.test(String(x.channelId || '')) ? String(x.channelId) : '',
    quotes: Math.round(num(x.quotes, 0, 8, DEFAULT_HIGHLIGHTS.quotes)),
  };
}
export const getHighlights = () => cleanHighlights(store?.get() || {});

export function setHighlights(patch) {
  const next = cleanHighlights({ ...getHighlights(), ...(patch || {}) });
  store.set(next);
  bus.emit(EVENTS.CONFIG, { key: 'highlights', value: next });
  return next;
}

function onChat(chat, now = Date.now()) {
  if (!STREAM_CHATS.has(chat?.platform) || chat.isBot || !chat.msg) return;
  // A command is somebody asking for something, not chat reacting.
  if (/^[!?]/.test(String(chat.msg).trim())) return;
  recent.push({ at: now, platform: chat.platform, user: chat.user, msg: String(chat.msg).slice(0, 200) });
  if (recent.length > 2000) recent = recent.slice(-1000);
}

/**
 * Is this minute a moment? The messages of the last minute against the
 * stream's usual pace — the minutes before it, up to ten — as many times over
 * as set, and never fewer than the minimum.
 */
export function judge(count, previousMinutes, cfg = getHighlights()) {
  const before = previousMinutes.slice(-10);
  const usual = before.length >= 3 ? before.reduce((a, b) => a + b, 0) / before.length : 0;
  const needed = Math.max(cfg.minMessages, Math.ceil(usual * cfg.factor));
  return { moment: count >= needed, usual, needed, ratio: usual ? Math.round((count / usual) * 10) / 10 : null };
}

/** What chat was saying: the last few messages, one per person, newest last. */
export function quotesFrom(list, n) {
  const seen = new Set();
  const out = [];
  for (const m of [...list].reverse()) {
    const key = `${m.platform}:${m.user}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= n) break;
  }
  return out.reverse();
}

/** The current step of tonight's plan, if one is on. */
const stepNow = () => (getPlan()?.items || []).find((i) => typeof i.startedAt === 'number' && !i.done)?.text || '';

/** This stream's VOD, asked of Twitch once a stream. */
async function vodOf(s) {
  if (vodFor.id === s.id && vodFor.vod) return vodFor.vod;
  try {
    const vod = await twitch.latestVod();
    if (vod?.createdAt && Date.parse(vod.createdAt) >= s.startedAt - 10 * 60_000) vodFor = { id: s.id, vod };
  } catch { /* none yet */ }
  return vodFor.id === s.id ? vodFor.vod : null;
}

/** The Discord post for a moment. */
export function momentPost({ count, ratio, quotes, song, step, clipUrl, vodUrl }, sanitise = discord.sanitise) {
  const lines = quotes.map((q) => `> **${sanitise(q.user, 40)}** · ${PLATFORM_NAMES[q.platform] || q.platform}\n> ${sanitise(q.msg, 150)}`);
  const fields = [{ name: 'Chat', value: `${count} mensajes en un minuto${ratio ? ` (x${ratio})` : ''}`, inline: true }];
  if (song) fields.push({ name: 'Sonando', value: sanitise(song, 100), inline: true });
  if (step) fields.push({ name: 'En el plan', value: sanitise(step, 100), inline: true });
  const buttons = [
    clipUrl && { type: 2, style: 5, label: 'Ver el clip', url: clipUrl },
    vodUrl && { type: 2, style: 5, label: 'Ver en el VOD', url: vodUrl },
  ].filter(Boolean);
  return {
    embed: { title: '🔥 Momento del directo', ...(clipUrl ? { url: clipUrl } : {}), description: lines.join('\n') || undefined, color: '#f97316', fields },
    components: buttons.length ? [{ type: 1, components: buttons }] : undefined,
  };
}

/** A moment: kept with the stream, a marker, a clip, a post — each as set. */
async function moment(s, verdict, now = Date.now()) {
  const cfg = getHighlights();
  lastAt = now;
  const lastMinute = recent.filter((m) => now - m.at <= 60_000);
  const count = lastMinute.length;
  log.info(`a moment: ${count} messages in a minute (usual ${verdict.usual.toFixed(1)})`);
  // When it began, near enough: chat reacts after the thing it reacts to.
  bus.emit('stream:moment', { kind: 'highlight', at: now - 45_000, text: `${count} msgs/min` });
  bus.emit(EVENTS.TRIGGER, normaliseEvent({ type: 'chat_highlight', platform: 'system', user: '', data: { count, ratio: verdict.ratio ?? '', usual: Math.round(verdict.usual) } }));
  if (cfg.marker) await extras.marker(`Momento: ${count} msgs/min`).catch(() => {});
  let clipUrl = '';
  if (cfg.clip) {
    const made = await extras.clip({ post: false }).catch(() => null);
    if (made?.ok) clipUrl = made.url;
  }
  if (!cfg.channelId) return;
  const vod = await vodOf(s);
  const playing = spotify.getNowPlaying?.();
  const post = momentPost({
    count, ratio: verdict.ratio, quotes: quotesFrom(lastMinute, cfg.quotes),
    song: playing?.name ? `${playing.name}${playing.artist ? ` — ${playing.artist}` : ''}` : '',
    step: stepNow(), clipUrl, vodUrl: sessions.vodLink({ ...s, vod }, now - 60_000),
  });
  await discord.sendMessage(cfg.channelId, '', post.embed, post.components, undefined, { allowed_mentions: { parse: [] } })
    .catch((err) => log.warn(`could not post the moment: ${err.message}`));
}

/** Every few seconds while live: is chat going wild? */
export async function check(now = Date.now()) {
  const cfg = getHighlights();
  recent = recent.filter((m) => now - m.at <= KEEP_MS);
  const s = sessions.current();
  if (!cfg.enabled || !s) return null;
  if (now - lastAt < cfg.cooldownMin * 60_000) return null;
  const count = recent.filter((m) => now - m.at <= 60_000).length;
  // The minutes before this one, from the stream's own count.
  const minutes = sessions.perMinute(s).slice(0, Math.max(0, sessions.minuteOf(s, now) - 1));
  const verdict = judge(count, minutes, cfg);
  if (!verdict.moment) return verdict;
  await moment(s, verdict, now);
  return verdict;
}

/** From the Go live screen: the settings, or a made-up moment posted to the test channel. */
export async function control(payload = {}) {
  if (payload.op === 'test') {
    const channelId = getGreetings().testChannelId;
    if (!channelId) throw refusal('highlights_no_test_channel', 'choose a test channel on the Welcome & Goodbye screen first');
    const post = momentPost({
      count: 42, ratio: 3.5,
      quotes: [{ user: 'Ana', platform: 'twitch', msg: 'JAJAJAJA' }, { user: 'Beto', platform: 'tiktok', msg: 'noooo 😂' }, { user: 'Caro', platform: 'youtube', msg: '¿qué pasó?' }].slice(0, Math.max(1, getHighlights().quotes)),
      song: 'Una canción — Un artista', step: stepNow() || 'Among Us',
      clipUrl: 'https://clips.twitch.tv/', vodUrl: '',
    });
    await discord.sendMessage(channelId, '', post.embed, post.components, undefined, { allowed_mentions: { parse: [] } });
    return { ok: true, channelId };
  }
  return setHighlights(payload.settings);
}

export const snapshot = () => ({ highlights: getHighlights() });

export function initHighlights() {
  store = collection('highlights', DEFAULT_HIGHLIGHTS);
  bus.on(EVENTS.CHAT, (c) => onChat(c));
  bus.on('stream:started', () => { recent = []; lastAt = 0; });
  clearInterval(timer);
  timer = setInterval(() => { check().catch((err) => log.warn(`highlight check failed: ${err.message}`)); }, CHECK_EVERY_MS);
  timer.unref?.();
}

export const _test = { onChat, reset: () => { recent = []; lastAt = 0; vodFor = { id: '', vod: null }; } };
