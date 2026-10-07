/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Actions that repeat: the "Every few minutes" trigger (timer_interval).
 *
 * What chat bots call timers — "follow the socials", "the Discord is in the
 * panels" — and what Discord bots call scheduled messages: an action set off
 * every so many minutes, with whatever steps it has, to whichever chat.
 *
 *   minutes    how often, 1 to 1440
 *   onlyLive   only while the stream is live (the default). The count starts
 *              when it goes live, so the first one comes an interval in.
 *   minChat    only once this many chat messages have been said since the
 *              last time, so a quiet chat is not talked over by the bot
 *
 * Live is Twitch's say when Twitch can say, otherwise OBS streaming — the
 * same rule TikTok follows. One repeating action goes per tick, the longest
 * overdue first, so two set to the same interval take turns instead of
 * arriving together.
 *
 * And actions on a calendar: "On set days, at a set time" (timer_schedule) —
 * "every Monday at 18:00", in the time zone of whoever set it up (sent from
 * their browser, since the phone the server runs on may keep UTC). Once at
 * that time on each day picked; a server that was down at that minute
 * catches up within five, and never runs it twice for the same day.
 */

import { bus, EVENTS } from '../core/bus.js';
import { collection } from '../core/store.js';
import { createLogger } from '../core/logger.js';
import { twitchLive } from '../core/twitch-live.js';

const log = createLogger('repeat');

export const TICK_MS = 15_000;
export const DEFAULT_REPEAT = { minutes: 15, onlyLive: true, minChat: 0 };
/** Chat that counts towards minChat: the stream's, not the Discord channel's. */
const STREAM_CHATS = new Set(['twitch', 'youtube', 'tiktok', 'kick']);

let deps = null;
let timer = null;
/** Action id → the day and time it last ran on its calendar, kept across a restart. */
let fired = null;
let lines = 0;
/** Action id → { at, lines }: when it last went (or started counting), and the chat count then. */
const marks = new Map();

const countLine = (chat) => { if (STREAM_CHATS.has(chat?.platform) && !chat.isBot) lines += 1; };

/** A trigger's settings as kept: sane numbers, live-only unless said otherwise. */
export function cleanRepeat(c) {
  const n = (v, lo, hi, fallback) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : fallback;
  };
  return {
    minutes: n(c?.minutes, 1, 1440, DEFAULT_REPEAT.minutes),
    onlyLive: c?.onlyLive !== false,
    minChat: n(c?.minChat, 0, 500, DEFAULT_REPEAT.minChat),
  };
}

export function initRepeat(d) {
  deps = {
    isLive: () => {
      const tw = twitchLive();
      return tw.known ? tw.live : Boolean(d.obsStreaming?.());
    },
    now: () => Date.now(),
    ...d,
  };
  fired = collection('repeat_fired', {});
  bus.on(EVENTS.CHAT, countLine);
  if (deps.autoTick !== false) {
    timer = setInterval(() => tick(), TICK_MS);
    timer.unref?.();
  }
}

export function stopRepeat() {
  if (timer) clearInterval(timer);
  timer = null;
  bus.off(EVENTS.CHAT, countLine);
  marks.clear();
  lines = 0;
}

// ------------------------------------------------------------ on a calendar

/** Days as JavaScript counts them: 0 is Sunday, 6 Saturday. Monday by default, at 18:00. */
export const DEFAULT_SCHEDULE = { days: [1], time: '18:00', tz: '', onlyLive: false };
/** A minute missed — the server restarting, a slow tick — is caught up within this many. */
export const CATCH_UP_MINUTES = 5;

const validZone = (tz) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
};
const serverZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** A calendar trigger's settings as kept: real days, a real HH:MM, a real time zone. */
export function cleanSchedule(c) {
  const picked = (Array.isArray(c?.days) ? c.days : DEFAULT_SCHEDULE.days)
    .map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const days = [...new Set(picked)].sort((a, b) => a - b);
  return {
    days: days.length ? days : DEFAULT_SCHEDULE.days,
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(c?.time ?? '')) ? c.time : DEFAULT_SCHEDULE.time,
    tz: c?.tz && validZone(c.tz) ? c.tz : serverZone(),
    onlyLive: c?.onlyLive === true,
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A moment in a time zone: its weekday, its minute of the day, and its date. */
export function localMoment(now, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  return {
    day: WEEKDAYS.indexOf(parts.weekday),
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Run every calendar action whose day and time it is. Returns their ids. */
export function tickSchedule(now = deps.now()) {
  const due = deps.actions().filter((a) => a?.enabled && a.trigger?.type === 'timer_schedule');
  if (!due.length) return [];
  const live = due.some((a) => a.trigger.config?.onlyLive) ? deps.isLive() : false;
  const ran = [];
  for (const action of due) {
    const cfg = cleanSchedule(action.trigger.config);
    if (cfg.onlyLive && !live) continue;
    const at = localMoment(now, cfg.tz);
    const [h, m] = cfg.time.split(':').map(Number);
    const late = at.minutes - (h * 60 + m);
    if (!cfg.days.includes(at.day) || late < 0 || late >= CATCH_UP_MINUTES) continue;
    const key = `${at.date} ${cfg.time}`;
    if (fired.get()[action.id] === key) continue;
    fired.update((prev) => ({ ...prev, [action.id]: key }));
    log.info(`${cfg.time} (${cfg.tz}) -> "${action.name}"`);
    Promise.resolve(deps.run(action)).catch((err) => log.warn(`"${action.name}" failed: ${err.message}`));
    ran.push(action.id);
  }
  return ran;
}

/** Run whichever repeating action is due, if any. Returns its id. Calendar actions due now run too. */
export function tick(now = deps.now()) {
  tickSchedule(now);
  const live = deps.isLive();
  const repeating = deps.actions().filter((a) => a?.enabled && a.trigger?.type === 'timer_interval');
  const seen = new Set();
  const due = [];
  for (const action of repeating) {
    seen.add(action.id);
    const cfg = cleanRepeat(action.trigger.config);
    const mark = marks.get(action.id);
    // Newly made, or waiting for the stream: the count starts now.
    if (!mark || (cfg.onlyLive && !live)) { marks.set(action.id, { at: now, lines }); continue; }
    const late = now - mark.at - cfg.minutes * 60_000;
    if (late < 0 || lines - mark.lines < cfg.minChat) continue;
    due.push({ action, late });
  }
  for (const id of [...marks.keys()]) if (!seen.has(id)) marks.delete(id);
  if (!due.length) return null;

  due.sort((a, b) => b.late - a.late);
  const { action } = due[0];
  marks.set(action.id, { at: now, lines });
  log.info(`every ${cleanRepeat(action.trigger.config).minutes} min -> "${action.name}"`);
  Promise.resolve(deps.run(action)).catch((err) => log.warn(`"${action.name}" failed: ${err.message}`));
  return action.id;
}
