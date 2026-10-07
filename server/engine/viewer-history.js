/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What each person has done, across every platform they are on: when they
 * were first and last seen, how many messages on each platform, which
 * streams they took part in (and so their streak), what they gave — bits,
 * subs, gifts, Super Chats — and the giveaways they won. Kept per person (a
 * person is every account linked together, server/leveling), so a viewer
 * who talks on Twitch and TikTok has one history.
 *
 * Counts, not messages: a person is a few hundred bytes however long they
 * have been around. Kept in memory and saved once a minute and when a stream
 * ends, not with every message.
 *
 * A person takes part in a stream by talking in its chat while it is on —
 * Twitch, YouTube, TikTok, Kick, or the Discord channel the stream reads.
 * Watching without a word is not seen.
 *
 * People can be forgotten after a while away, if the Levels & XP screen says
 * so: only those with a single account (nobody linked them to anything) and
 * no points to spend. Off unless chosen — "forever" is the default.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as leveling from '../leveling/index.js';
import * as sessions from './stream-sessions.js';
import { emptyTotals, addToTotals, isViewerEvent } from '../../shared/viewer-events.js';

const log = createLogger('history');

/** How long somebody may be away before they are forgotten: 0 is never. */
export const FORGET_CHOICES = [0, 3, 6, 12];
export const DEFAULT_HISTORY_SETTINGS = { forgetAfterMonths: 0 };
const SAVE_EVERY_MS = 60_000;
const DAY_MS = 24 * 3_600_000;
const MONTH_MS = 30 * DAY_MS;
/** Chats that are the stream's: talking in one while it is on is taking part. */
const STREAM_CHATS = new Set(['twitch', 'youtube', 'tiktok', 'kick', 'discord']);

let store = null;
let saveTimer = null;
let pruneTimer = null;
/** Something else that keeps people from being forgotten (points to spend): uid → true. */
const keepers = [];

// Nobody yet, before the module has started (a role sync or a profile may ask that early).
const people = () => store?.get().people || {};
const blank = () => ({ first: 0, last: 0, msgs: {}, attended: [], best: 0, support: emptyTotals(null), wins: 0 });

function touch(uid, fn) {
  store.updateQuietly((v) => {
    const rec = v.people[uid] || blank();
    v.people[uid] = fn({ ...rec, msgs: { ...rec.msgs }, attended: rec.attended.slice() }) || rec;
    return v;
  });
}

/** The longest run of streams in a row, and the run that ends at the latest one. */
export function streaks(attended, latest) {
  const list = [...new Set(attended || [])].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = null;
  for (const n of list) {
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  // A streak is current only if they were at the latest stream (or the one before, while one is on).
  const current = prev !== null && latest && prev >= latest - (sessions.current() ? 1 : 0) ? run : 0;
  return { best, current };
}

/** Somebody's history, as anything that wants it reads it. Null for nobody known. */
export function historyOf(uid) {
  const rec = people()[uid];
  if (!rec) return null;
  const latest = sessions.current()?.n || sessions.finished().at(-1)?.n || 0;
  const { best, current } = streaks(rec.attended, latest);
  return {
    ...rec,
    streams: new Set(rec.attended).size,
    streak: current,
    bestStreak: Math.max(best, rec.best || 0),
    messages: Object.values(rec.msgs).reduce((a, b) => a + b, 0),
    platforms: leveling.accountsOf(uid).map((k) => k.split(':')[0]),
  };
}

/** The same, for a platform account: whoever it belongs to. */
export function historyOfAccount(platform, id) {
  const uid = leveling.getAccounts()[`${platform}:${id}`];
  return uid ? historyOf(uid) : null;
}

// ------------------------------------------------------------ what feeds it

function onChat(chat, { stream = true } = {}, now = Date.now()) {
  if (!chat?.userId || chat.isBot || !chat.platform) return;
  const uid = leveling.personFor(chat.platform, chat.userId, chat.user, chat.avatar);
  const live = stream && STREAM_CHATS.has(chat.platform) ? sessions.current() : null;
  touch(uid, (r) => {
    r.first = r.first || now;
    r.last = now;
    r.msgs[chat.platform] = (r.msgs[chat.platform] || 0) + 1;
    if (live && !r.attended.includes(live.n)) {
      r.attended.push(live.n);
      r.best = Math.max(r.best || 0, streaks(r.attended, live.n).best);
    }
    return r;
  });
}

function onEvent(e) {
  if (!isViewerEvent(e) || !e.data?.userId) {
    if (e?.type === 'giveaway_winner' && e.data?.userId && e.platform) {
      const uid = leveling.getAccounts()[`${e.platform}:${e.data.userId}`];
      if (uid) touch(uid, (r) => ({ ...r, wins: (r.wins || 0) + 1 }));
    }
    return;
  }
  // A sub somebody else gave is not one this person bought or gave.
  if (e.type === 'twitch_sub' && e.data.giftedBy) return;
  const uid = leveling.personFor(e.platform, e.data.userId, e.user, e.avatar);
  touch(uid, (r) => ({ ...r, first: r.first || Date.now(), support: addToTotals(r.support, e) }));
}

/** Two people became one: their histories add up. */
function onMerged({ into, from }) {
  const a = people()[into];
  const b = people()[from];
  if (!b) return;
  store.updateQuietly((v) => {
    const sum = (x = {}, y = {}) => {
      const out = { ...x };
      for (const [k, n] of Object.entries(y)) {
        if (typeof n === 'number') out[k] = (out[k] || 0) + n;
        else if (n && typeof n === 'object') out[k] = sum(out[k], n);
      }
      return out;
    };
    const x = a || blank();
    v.people[into] = {
      first: Math.min(x.first || Infinity, b.first || Infinity) === Infinity ? 0 : Math.min(x.first || Infinity, b.first || Infinity),
      last: Math.max(x.last || 0, b.last || 0),
      msgs: sum(x.msgs, b.msgs),
      attended: [...new Set([...x.attended, ...b.attended])].sort((p, q) => p - q),
      best: Math.max(x.best || 0, b.best || 0, streaks([...x.attended, ...b.attended]).best),
      support: { ...sum(x.support, b.support), startedAt: null },
      wins: (x.wins || 0) + (b.wins || 0),
    };
    delete v.people[from];
    return v;
  });
}

function onForgotten({ uids }) {
  store.updateQuietly((v) => {
    for (const uid of uids || []) delete v.people[uid];
    return v;
  });
}

// ------------------------------------------------------------ forgetting

/** Another module's say in who must be kept: a function from uid to true when they must stay. */
export function keepWhen(fn) {
  keepers.push(fn);
}

/**
 * Forget the people away longer than the setting allows. Only a person with
 * one account and nothing to keep them; never the channel's own. Returns how
 * many went.
 */
export function prune(now = Date.now()) {
  const months = getHistorySettings().forgetAfterMonths;
  if (!months) return { people: 0, accounts: 0 };
  const cutoff = now - months * MONTH_MS;
  const users = leveling.getUsers();
  const counts = {};
  for (const uid of Object.values(leveling.getAccounts())) counts[uid] = (counts[uid] || 0) + 1;
  const gone = Object.keys(users).filter((uid) => {
    if ((counts[uid] || 0) > 1 || users[uid]?.own) return false;
    const seen = people()[uid]?.last || users[uid]?.lastXpTime || users[uid]?.createdAt || 0;
    if (!seen || seen >= cutoff) return false;
    return !keepers.some((keep) => keep(uid));
  });
  const done = leveling.forget(gone);
  if (done.people) {
    store.update((v) => ({ ...v, lastPrune: { at: now, ...done } }));
    bus.emit(EVENTS.CONFIG, { key: 'historySettings', value: getHistorySettings() });
  }
  return done;
}

// ------------------------------------------------------------ the screen

export const getHistorySettings = () => ({ ...DEFAULT_HISTORY_SETTINGS, ...(store?.get().settings || {}), lastPrune: store?.get().lastPrune || null });

export function setHistorySettings(patch = {}) {
  const months = Number(patch.forgetAfterMonths);
  if (!FORGET_CHOICES.includes(months)) throw refusal('history_bad_months', 'choose never, 3, 6 or 12 months', { choices: FORGET_CHOICES.join(', ') });
  store.update((v) => ({ ...v, settings: { ...(v.settings || {}), forgetAfterMonths: months } }));
  bus.emit(EVENTS.CONFIG, { key: 'historySettings', value: getHistorySettings() });
  return getHistorySettings();
}

/** How many people there are, how many are kept history for, and how many the setting would forget now. */
export function historyStats(now = Date.now()) {
  const months = getHistorySettings().forgetAfterMonths;
  const users = leveling.getUsers();
  const counts = {};
  for (const uid of Object.values(leveling.getAccounts())) counts[uid] = (counts[uid] || 0) + 1;
  const away = (m) => Object.keys(users).filter((uid) => (counts[uid] || 0) <= 1 && !users[uid]?.own
    && (people()[uid]?.last || users[uid]?.lastXpTime || users[uid]?.createdAt || 0) < now - m * MONTH_MS && !keepers.some((k) => k(uid))).length;
  return { people: Object.keys(users).length, withHistory: Object.keys(people()).length, wouldForget: Object.fromEntries(FORGET_CHOICES.filter(Boolean).map((m) => [m, away(m)])), months };
}

export const snapshot = () => ({ historySettings: getHistorySettings() });

export function initViewerHistory() {
  store = collection('viewer_history', { people: {}, settings: DEFAULT_HISTORY_SETTINGS, lastPrune: null });
  bus.on(EVENTS.CHAT, (c) => onChat(c));
  // Talking elsewhere in the Discord server is being seen, but not taking part in the stream.
  bus.on('discord:message_elsewhere', (c) => onChat(c, { stream: false }));
  bus.on(EVENTS.EVENT, onEvent);
  bus.on('people:merged', onMerged);
  bus.on('people:forgotten', onForgotten);
  // A stream over: its attendance is worth having on disk now.
  bus.on('stream:ended', () => store.flush());
  clearInterval(saveTimer);
  saveTimer = setInterval(() => store.flush(), SAVE_EVERY_MS);
  saveTimer.unref?.();
  clearInterval(pruneTimer);
  pruneTimer = setInterval(() => { try { prune(); } catch (err) { log.warn(`forgetting failed: ${err.message}`); } }, DAY_MS);
  pruneTimer.unref?.();
}

/** For tests. */
export const _test = { onChat, onEvent, flush: () => store.flush() };
