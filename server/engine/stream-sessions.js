/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Every stream, kept: when it started and ended, what it was called and
 * played, how fast chat went minute by minute on each platform, who took
 * part, the songs that played, the clips and markers made, the plan's steps
 * and the VOD it became. What chapters, highlights, attendance, profiles and
 * "answered at 1:23:45" links are made from.
 *
 * A stream is OBS streaming, as the recap counts it: one that drops and is
 * back within a few minutes is the same stream. The one on now is kept in
 * memory and saved once a minute (and on shutdown), not on every message;
 * a finished one is written once, to the list of streams.
 *
 * Small on purpose: counts per minute rather than messages, and per person
 * a count rather than what they said. A four-hour stream with fifty people
 * talking is a few kilobytes.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as leveling from '../leveling/index.js';
import * as twitch from '../platforms/twitch.js';
import { getPlan } from './plan.js';

const log = createLogger('streams');

/** A stream back within this long is the same stream (as the recap counts it). */
export const SAME_STREAM_MS = 5 * 60_000;
const SAVE_EVERY_MS = 60_000;
/** The platforms a minute is counted on, in the order the counts are kept: [all, …these]. */
export const MINUTE_PLATFORMS = ['twitch', 'youtube', 'tiktok', 'discord', 'kick'];
const STREAM_CHATS = new Set(MINUTE_PLATFORMS);

let live = null;
let past = null;
let saveTimer = null;
let endTimer = null;

const session = () => live?.get().session || null;
export const isRunning = (s = session()) => Boolean(s?.startedAt && !s.endedAt);

/** The stream on now, or null. */
export const current = () => (isRunning() ? session() : null);
/** Every finished stream, oldest first. */
export const finished = () => past?.get().list || [];
/** The number the next stream will have, or the one on now has. */
const nextNumber = () => (finished().at(-1)?.n || 0) + 1;

const fresh = (startedAt, n) => ({
  id: `s${startedAt}`,
  n,
  startedAt,
  endedAt: 0,
  title: '',
  game: '',
  channel: [],
  minutes: [],
  attendees: {},
  songs: [],
  moments: [],
});

function changed(fn) {
  live.updateQuietly((v) => ({ ...v, session: fn(v.session) }));
}

// ------------------------------------------------------------ starting and ending

function start(now) {
  clearTimeout(endTimer);
  endTimer = null;
  const s = session();
  // Back within a few minutes: the same stream, carrying on.
  if (s?.startedAt && s.endedAt && now - s.endedAt < SAME_STREAM_MS) {
    live.set({ session: { ...s, endedAt: 0 } });
    log.info(`stream ${s.n} carries on`);
    return;
  }
  if (s?.startedAt && s.endedAt) finish(s);
  const next = fresh(now, nextNumber());
  live.set({ session: next });
  log.info(`stream ${next.n} started`);
  bus.emit('stream:started', next);
  // What it is called and played, once Twitch says (EVENTS.CHANNEL may not come before).
  twitch.getLiveInfo?.().then((info) => {
    if (!info || !isRunning() || session().id !== next.id) return;
    changed((v) => ({ ...v, title: v.title || info.title || '', game: v.game || info.game || '' }));
  }).catch(() => {});
}

function stop(now) {
  const s = session();
  if (!isRunning(s)) return;
  live.set({ session: { ...s, endedAt: now } });
  live.flush();
  clearTimeout(endTimer);
  // Finished for good only once it is clear it is not coming back.
  endTimer = setTimeout(() => finish(session()), SAME_STREAM_MS);
  endTimer.unref?.();
}

/** A stream over for good: its plan and VOD added, written to the list, and said. */
async function finish(s) {
  if (!s?.startedAt || !s.endedAt) return;
  clearTimeout(endTimer);
  endTimer = null;
  if (finished().some((x) => x.id === s.id)) return;
  const record = { ...s };
  // The plan's steps started during this stream, with when: the chapters of the night.
  // A step carried on from an earlier stream (counted live in this one) is a chapter from where this stream began.
  record.plan = (getPlan()?.items || [])
    .filter((i) => typeof i.startedAt === 'number' && i.startedAt <= s.endedAt && (i.startedAt >= s.startedAt - 60_000 || typeof i.liveBase === 'number'))
    .map((i) => ({ text: String(i.text || ''), startedAt: Math.max(i.startedAt, s.startedAt), ...(i.doneAt ? { doneAt: i.doneAt } : {}) }));
  try {
    const vod = await twitch.latestVod?.();
    // Only the VOD of this stream: made after it started.
    if (vod?.createdAt && Date.parse(vod.createdAt) >= s.startedAt - 10 * 60_000) record.vod = vod;
  } catch (err) {
    log.debug(`no VOD for stream ${s.n}: ${err.message}`);
  }
  past.update((v) => ({ list: [...(v.list || []), record] }));
  if (session()?.id === s.id) live.set({ session: null });
  log.info(`stream ${s.n} kept: ${Math.round((s.endedAt - s.startedAt) / 60_000)} min, ${Object.keys(s.attendees).length} people`);
  bus.emit('stream:ended', record);
}

// ------------------------------------------------------------ while it runs

/** Which minute of the stream a moment falls in. */
export const minuteOf = (s, at) => Math.max(0, Math.floor((at - s.startedAt) / 60_000));

function onChat(chat, now = Date.now()) {
  const s = session();
  if (!isRunning(s) || !STREAM_CHATS.has(chat?.platform) || chat.isBot) return;
  const m = minuteOf(s, now);
  const at = MINUTE_PLATFORMS.indexOf(chat.platform) + 1;
  changed((v) => {
    const minutes = v.minutes.slice();
    const row = (minutes[m] || new Array(MINUTE_PLATFORMS.length + 1).fill(0)).slice();
    row[0] += 1;
    row[at] += 1;
    minutes[m] = row;
    if (chat.isBroadcaster || !chat.userId) return { ...v, minutes };
    const uid = leveling.personFor(chat.platform, chat.userId, chat.user, chat.avatar);
    const was = v.attendees[uid] || { m: 0, p: [] };
    const p = was.p.includes(chat.platform) ? was.p : [...was.p, chat.platform];
    return { ...v, minutes, attendees: { ...v.attendees, [uid]: { m: was.m + 1, p } } };
  });
}

function onEvent(e, now = Date.now()) {
  if (e?.type === 'obs_stream_started') return start(now);
  if (e?.type === 'obs_stream_stopped') return stop(now);
  if (!isRunning()) return undefined;
  if (e?.type === 'spotify_track_change' && e.data?.title) {
    changed((v) => ({ ...v, songs: [...v.songs, { at: now, title: String(e.data.title), artist: String(e.data.artist || e.user || '') }].slice(-400) }));
  }
  return undefined;
}

function onChannel(c, now = Date.now()) {
  if (!isRunning() || !c || c.initial) return;
  changed((v) => ({
    ...v,
    title: c.title || v.title,
    game: c.categoryName || v.game,
    channel: [...v.channel, { at: now, title: c.title || '', game: c.categoryName || '' }].slice(-100),
  }));
}

/** A clip, a marker or a highlight, at this moment of the stream. */
function onMoment(m, now = Date.now()) {
  if (!isRunning() || !m?.kind) return;
  changed((v) => ({ ...v, moments: [...v.moments, { at: m.at || now, kind: m.kind, ...(m.url ? { url: m.url } : {}), ...(m.text ? { text: String(m.text).slice(0, 140) } : {}) }].slice(-200) }));
}

/** People merged into one: their part in the stream on now goes with them. */
function onMerged({ into, from }) {
  const s = session();
  if (!s?.attendees?.[from]) return;
  changed((v) => {
    const a = v.attendees[into] || { m: 0, p: [] };
    const b = v.attendees[from];
    const attendees = { ...v.attendees, [into]: { m: a.m + b.m, p: [...new Set([...a.p, ...b.p])] } };
    delete attendees[from];
    return { ...v, attendees };
  });
}

// ------------------------------------------------------------ reading them

/** Where a moment is in the VOD: "1h02m03s", for a link's ?t=. */
export function vodTime(s, at) {
  const vodStart = s?.vod?.createdAt ? Date.parse(s.vod.createdAt) : s?.startedAt;
  const total = Math.max(0, Math.round((at - vodStart) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}h${String(m).padStart(2, '0')}m${String(sec).padStart(2, '0')}s`;
}

/** A link to a moment of a stream in its VOD, or '' while there is no VOD. */
export function vodLink(s, at) {
  if (!s?.vod?.url) return '';
  return `${s.vod.url}${s.vod.url.includes('?') ? '&' : '?'}t=${vodTime(s, at)}`;
}

/** How many messages a minute, all platforms together, as a plain list (a minute nobody talked is 0). */
export const perMinute = (s) => Array.from({ length: (s?.minutes || []).length }, (_, i) => s.minutes[i]?.[0] || 0);

/** The stream on now or just over (still in its few minutes of grace), or else the last one kept. */
export const latest = () => session() || finished().at(-1) || null;

/** A stream with its plan steps, for one not yet kept (the recap is written before a stream is). */
export function withPlan(s, now = Date.now()) {
  if (!s || s.plan) return s;
  const end = s.endedAt || now;
  return {
    ...s,
    plan: (getPlan()?.items || [])
      .filter((i) => typeof i.startedAt === 'number' && i.startedAt >= s.startedAt - 60_000 && i.startedAt <= end)
      .map((i) => ({ text: String(i.text || ''), startedAt: i.startedAt, ...(i.doneAt ? { doneAt: i.doneAt } : {}) })),
  };
}

/** "1:02:03", or "12:30" under an hour: how YouTube reads a chapter's time. */
export function chapterTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The stream's chapters, the way YouTube takes them in a description: the
 * plan's steps, the games played and the highlights, each at its time in
 * the VOD, the first at 00:00. Two within ten seconds are one; the same
 * title twice in a row is once.
 */
export function chaptersOf(s) {
  if (!s?.startedAt) return [];
  const start = s.vod?.createdAt ? Date.parse(s.vod.createdAt) : s.startedAt;
  const marks = [
    { at: s.startedAt, title: 'Inicio' },
    ...(s.plan || []).map((p) => ({ at: p.startedAt, title: p.text })),
    ...(s.channel || []).filter((c) => c.game).map((c) => ({ at: c.at, title: c.game })),
    ...(s.moments || []).filter((m) => m.kind === 'highlight').map((m) => ({ at: m.at, title: `🔥 ${m.text || 'Momento'}` })),
  ].filter((m) => m.title && m.at >= s.startedAt - 60_000).sort((a, b) => a.at - b.at);
  const out = [];
  for (const m of marks) {
    const last = out.at(-1);
    if (last && (m.at - last.at < 10_000 || m.title === last.title)) continue;
    out.push({ at: m.at, title: String(m.title).replace(/\s+/g, ' ').slice(0, 90) });
  }
  return out.map((c, i) => ({ ...c, time: chapterTime(i === 0 ? 0 : c.at - start) }));
}

/** The chapters as text to paste into a YouTube description. */
export const chaptersText = (s) => chaptersOf(s).map((c) => `${c.time} ${c.title}`).join('\n');

/** Every stream for the Streams screen, newest first, the one on now among them. */
export function listed() {
  const now = session();
  return [...(now && !finished().some((x) => x.id === now.id) ? [{ ...summary(now), live: isRunning(now) }] : []), ...finished().slice().reverse().map(summary)];
}

/** One stream in full, for the Streams screen: its chapters, moments, songs, chat by minute and who came, by name. */
export function details(id) {
  const raw = finished().find((x) => x.id === id) || (session()?.id === id ? session() : null);
  if (!raw) return null;
  const s = withPlan(raw);
  const users = leveling.getUsers();
  const people = Object.entries(s.attendees || {})
    .map(([uid, a]) => ({ uid, name: users[uid]?.username || '?', avatar: users[uid]?.avatar || '', messages: a.m, platforms: a.p }))
    .sort((a, b) => b.messages - a.messages);
  return {
    ...summary(s),
    live: isRunning(s),
    vodUrl: s.vod?.url || '',
    chapters: chaptersOf(s).map((c) => ({ ...c, link: vodLink(s, c.at) })),
    chaptersText: chaptersText(s),
    moments: (s.moments || []).map((m) => ({ ...m, link: vodLink(s, m.at) })),
    songs: s.songs || [],
    channel: s.channel || [],
    plan: s.plan || [],
    perMinute: perMinute(s),
    byPlatform: MINUTE_PLATFORMS.map((p, i) => ({ platform: p, messages: (s.minutes || []).reduce((n, row) => n + (row?.[i + 1] || 0), 0) })).filter((x) => x.messages),
    people: people.slice(0, 100),
  };
}

/** A stream as a screen lists it: without the per-person and per-minute detail. */
export const summary = (s) => ({
  id: s.id, n: s.n, startedAt: s.startedAt, endedAt: s.endedAt, title: s.title, game: s.game,
  people: Object.keys(s.attendees || {}).length,
  messages: perMinute(s).reduce((a, b) => a + b, 0),
  songs: (s.songs || []).length, moments: (s.moments || []).length,
  ...(s.vod ? { vod: s.vod.url } : {}),
});

export function initStreamSessions() {
  live = collection('stream_live', { session: null });
  past = collection('stream_sessions', { list: [] });
  bus.on(EVENTS.EVENT, onEvent);
  bus.on(EVENTS.CHAT, onChat);
  bus.on(EVENTS.CHANNEL, onChannel);
  bus.on('stream:moment', onMoment);
  bus.on('people:merged', onMerged);
  clearInterval(saveTimer);
  saveTimer = setInterval(() => live.flush(), SAVE_EVERY_MS);
  saveTimer.unref?.();
  // A stream that ended while the server was down: finished now, or once its few minutes are up.
  const s = session();
  if (s?.startedAt && s.endedAt) {
    const left = SAME_STREAM_MS - (Date.now() - s.endedAt);
    if (left <= 0) finish(s).catch((err) => log.warn(`could not keep stream ${s.n}: ${err.message}`));
    else { endTimer = setTimeout(() => finish(session()), left); endTimer.unref?.(); }
  }
}

export function stopStreamSessions() {
  bus.off(EVENTS.EVENT, onEvent);
  bus.off(EVENTS.CHAT, onChat);
  bus.off(EVENTS.CHANNEL, onChannel);
  bus.off('stream:moment', onMoment);
  bus.off('people:merged', onMerged);
  clearInterval(saveTimer);
  clearTimeout(endTimer);
}

/** For tests: what a moment in time does, now. */
export const _test = { onChat, onEvent, onChannel, onMoment, finish: () => finish(session()) };
