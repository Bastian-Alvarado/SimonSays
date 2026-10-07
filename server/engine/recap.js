/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The stream recap: when the stream ends, a card in Discord saying how it
 * went — how long it ran, the most watching at once on each platform, what
 * viewers did, who talked the most, the clips made, tonight's plan as it
 * went, and when the next stream is. The go-live post turns into it, or it
 * is a post of its own (announce.js decides, from the Go live screen).
 *
 * Kept as the stream runs (a tally, saved, so a restart mid-stream does not
 * lose it): from OBS starting to OBS stopping. A stream that drops and comes
 * back within a few minutes is the same stream — the tally carries on.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { emptyTotals, addToTotals } from '../../shared/viewer-events.js';

/** What the recap says, and where it goes. In the stream's language. */
export const DEFAULT_RECAP = {
  enabled: false,
  /** edit: the go-live post becomes the recap; new: a post of its own. */
  where: 'edit',
  title: 'Resumen del directo',
  parts: { length: true, peak: true, events: true, chatters: true, clips: true, plan: true, chapters: true, next: true },
  /** How many of the chattiest to name. */
  chatters: 3,
};
export const RECAP_PARTS = Object.keys(DEFAULT_RECAP.parts);

/** A stream back within this long is the same stream. */
export const SAME_STREAM_MS = 5 * 60_000;
const VIEWER_STATS = { twitchViewers: 'twitch', youtubeViewers: 'youtube', tiktokViewers: 'tiktok' };
const STREAM_CHATS = new Set(['twitch', 'youtube', 'tiktok', 'kick']);

export function cleanRecap(incoming, before = DEFAULT_RECAP) {
  const c = { ...before, ...(incoming && typeof incoming === 'object' ? incoming : {}) };
  const parts = {};
  for (const key of RECAP_PARTS) parts[key] = (c.parts?.[key] ?? before.parts?.[key] ?? true) !== false;
  const n = Number(c.chatters);
  return {
    enabled: c.enabled === true,
    where: c.where === 'new' ? 'new' : 'edit',
    title: String(c.title ?? '').trim().slice(0, 100) || DEFAULT_RECAP.title,
    parts,
    chatters: Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : DEFAULT_RECAP.chatters,
  };
}

let tally = null;
const emptyTally = (startedAt = 0) => ({ startedAt, endedAt: 0, peak: {}, chatters: {}, messages: 0, totals: emptyTotals(startedAt || null) });
const running = (t) => Boolean(t?.startedAt && !t.endedAt);

export function initRecap() {
  tally = collection('stream_tally', emptyTally());
  bus.on(EVENTS.EVENT, onEvent);
  bus.on(EVENTS.CHAT, onChat);
  bus.on(EVENTS.STAT, onStat);
}

export function stopRecap() {
  bus.off(EVENTS.EVENT, onEvent);
  bus.off(EVENTS.CHAT, onChat);
  bus.off(EVENTS.STAT, onStat);
}

export const getTally = () => tally?.get() ?? emptyTally();

function onEvent(e, now = Date.now()) {
  const t = getTally();
  if (e?.type === 'obs_stream_started') {
    // Back within a few minutes: the same stream, carrying on.
    if (t.endedAt && now - t.endedAt < SAME_STREAM_MS) tally.set({ ...t, endedAt: 0 });
    else tally.set(emptyTally(now));
    return;
  }
  if (e?.type === 'obs_stream_stopped') {
    if (running(t)) tally.set({ ...t, endedAt: now });
    return;
  }
  if (!running(t)) return;
  const totals = addToTotals(t.totals, e);
  if (totals !== t.totals) tally.set({ ...t, totals });
}

function onChat(chat) {
  const t = getTally();
  if (!running(t) || !STREAM_CHATS.has(chat?.platform) || chat.isBot || chat.isBroadcaster || !chat.user) return;
  const key = `${chat.platform}:${chat.userId || String(chat.user).toLowerCase()}`;
  const had = t.chatters[key];
  tally.set({
    ...t,
    messages: t.messages + 1,
    chatters: { ...t.chatters, [key]: { name: chat.user, platform: chat.platform, count: (had?.count || 0) + 1 } },
  });
}

function onStat(s) {
  const platform = VIEWER_STATS[s?.key];
  const t = getTally();
  if (!platform || !running(t)) return;
  const n = Number(s.value) || 0;
  if (n > (t.peak[platform] || 0)) tally.set({ ...t, peak: { ...t.peak, [platform]: n } });
}

// ------------------------------------------------------------ the card

/** "3 h 12 min", "45 min", "1 min". */
export function lengthOf(ms) {
  const minutes = Math.max(1, Math.round((Number(ms) || 0) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

const fmt = (n) => Number(n || 0).toLocaleString('es-MX');
const PLATFORM_NAMES = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', kick: 'Kick' };

/** What viewers did, only what happened: "12 follows · 3 subs · 1,200 bits". */
export function eventsLine(totals) {
  const t = { ...emptyTotals(), ...(totals || {}) };
  const money = Object.entries(t.superChat || {}).map(([cur, v]) => `${cur}${fmt(v)}`).join(' + ');
  return [
    t.follows && `${fmt(t.follows)} ${t.follows === 1 ? 'follow' : 'follows'}`,
    t.subs && `${fmt(t.subs)} ${t.subs === 1 ? 'sub' : 'subs'}`,
    t.gifted && `${fmt(t.gifted)} ${t.gifted === 1 ? 'sub regalada' : 'subs regaladas'}`,
    t.bits && `${fmt(t.bits)} bits`,
    t.raids && `${fmt(t.raids)} ${t.raids === 1 ? 'raid' : 'raids'}${t.raiders ? ` (${fmt(t.raiders)})` : ''}`,
    t.members && `${fmt(t.members)} ${t.members === 1 ? 'membresía' : 'membresías'}`,
    money && `Super Chats ${money}`,
    t.tiktokGifts && `${fmt(t.tiktokGifts)} ${t.tiktokGifts === 1 ? 'regalo' : 'regalos'} de TikTok`,
    t.redeems && `${fmt(t.redeems)} ${t.redeems === 1 ? 'canje' : 'canjes'}`,
  ].filter(Boolean).join(' · ');
}

/**
 * The recap as a Discord card. `extra` is what is asked for at the end: the
 * plan's steps, the next stream, the clips, the stream's title and picture,
 * the VOD — each left out when there is none.
 */
export function recapCard(cfg, t, extra = {}, sanitise = (s) => s) {
  const p = cfg.parts || DEFAULT_RECAP.parts;
  const fields = [];
  const ended = t.endedAt || extra.now || Date.now();
  if (p.length && t.startedAt) fields.push({ name: 'Duración', value: lengthOf(ended - t.startedAt), inline: true });
  const peaks = Object.entries(t.peak || {}).filter(([, n]) => n > 0).map(([k, n]) => `${PLATFORM_NAMES[k] || k} ${fmt(n)}`);
  if (p.peak && peaks.length) fields.push({ name: 'Más viendo a la vez', value: peaks.join(' · '), inline: true });
  if (p.events) {
    const line = eventsLine(t.totals);
    if (line) fields.push({ name: 'Lo que pasó', value: line });
  }
  if (p.chatters) {
    const top = Object.values(t.chatters || {}).sort((a, b) => b.count - a.count).slice(0, cfg.chatters || 3);
    if (top.length) fields.push({ name: 'Más activos en el chat', value: top.map((c, i) => `${i + 1}. ${sanitise(c.name)} (${fmt(c.count)})`).join(' · ') });
  }
  if (p.clips && extra.clips?.length) {
    fields.push({ name: 'Clips', value: extra.clips.map((c) => `[${sanitise(c.title || 'Clip').slice(0, 80)}](${c.url})${c.by ? ` — ${sanitise(c.by)}` : ''}`).join('\n').slice(0, 1024) });
  }
  if (p.plan && extra.plan?.items?.length) {
    fields.push({ name: 'El plan', value: extra.plan.items.map((i) => `• ${sanitise(i.text)} — ${lengthOf(i.ms)}`).join('\n').slice(0, 1024) });
  }
  // The stream's chapters, ready to paste into a YouTube description (stream-sessions.js).
  if (p.chapters && extra.chapters && extra.chapters.split('\n').length >= 2) {
    fields.push({ name: 'Capítulos', value: `\`\`\`\n${extra.chapters.slice(0, 1000)}\n\`\`\`` });
  }
  if (p.next && extra.next?.start) {
    const unix = Math.floor(Date.parse(extra.next.start) / 1000);
    fields.push({ name: 'Próximo directo', value: `<t:${unix}:F> (<t:${unix}:R>)${extra.next.title ? `\n${sanitise(extra.next.title)}` : ''}` });
  }
  const about = [extra.title && `**${sanitise(extra.title)}**`, extra.game && sanitise(extra.game)].filter(Boolean).join('\n');
  return {
    author: extra.streamer ? `${extra.streamer} · ${cfg.title}` : cfg.title,
    title: undefined,
    description: about || undefined,
    color: extra.color || '#4f545c',
    image: extra.image || undefined,
    fields: fields.length ? fields : [{ name: 'Gracias por ver', value: '💜' }],
  };
}
