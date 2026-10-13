/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Steps that wait their turn: the "Later" step.
 *
 * "!bar Happy hour" puts the words on the bar, and five hours later the bar
 * should be itself again. A Wait step holding the action open for five hours
 * would be lost to the first restart — a deploy, Android reclaiming Termux —
 * and the bar would keep the happy hour forever. So a Later step does not wait
 * inside the action: it writes down what is to happen and when, and the
 * action carries on and finishes. This module keeps that list on disk, sets a
 * timer for the next one, and picks the list back up when the server starts.
 *
 *   after      a length of time: seconds to days
 *   streamEnd  when the stream is over for good — the same moment the recap
 *              and the stream history call the end, five minutes after it
 *              stops, so a quick restart of the stream is not an end
 *
 * The same step running again starts its wait over. Two "!bar"s an hour apart
 * mean the second message gets its own five hours; were the first wait kept,
 * it would clear the second message an hour early. The step is the key — the
 * action and the step within it — so two Later steps in one action are two
 * waits, and the same step reached from another action through Trigger Action
 * is the same wait.
 *
 * What runs is the step as it is when its time comes, read from the action,
 * so a typo fixed in the meantime is fixed in what runs. A step deleted in the
 * meantime runs nothing. {user}, {input} and the rest are kept from the moment
 * it was set, since "who asked" is the point; the song playing is read fresh.
 *
 * One that came due while the server was down runs once it is back — after a
 * short grace, so OBS and the chats have connected before it needs them.
 */

import { bus, EVENTS } from '../core/bus.js';
import { collection } from '../core/store.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('later');

export const UNITS = { seconds: 1000, minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
export const MIN_MS = 1000;
/** A week. Past that it is a calendar trigger's job, not a wait's. */
export const MAX_MS = 7 * UNITS.days;
/** How long after a start overdue steps wait, so what they talk to is connected. */
export const BOOT_GRACE_MS = 15_000;
/** setTimeout's own limit (about 24.8 days); a longer wait is re-armed when it is reached. */
const MAX_TIMER_MS = 2 ** 31 - 1;

let deps = null;
let store = null;
let timer = null;
/** Until this moment nothing overdue runs: the boot grace. */
let holdUntil = 0;

/** A Later step's settings as kept: a mode, and a length inside the limits. */
export function cleanLater(cfg) {
  const mode = cfg?.mode === 'streamEnd' ? 'streamEnd' : 'after';
  const unit = UNITS[cfg?.unit] ? cfg.unit : 'minutes';
  const n = Number(cfg?.amount);
  const amount = Number.isFinite(n) && n > 0 ? n : 5;
  return { mode, unit, amount, ms: Math.min(MAX_MS, Math.max(MIN_MS, Math.round(amount * UNITS[unit]))) };
}

/**
 * What a waiting step remembers of the moment it was set: everything the
 * action knew, as plain data. The song and the plan are left out, because
 * they are read again when it runs, and a stale song would be a wrong one.
 */
function keepContext(ctx) {
  const { spotify, plan, ...rest } = ctx || {};
  try { return JSON.parse(JSON.stringify(rest)); } catch { return {}; }
}

/** The waiting steps, soonest first, as the Actions screen lists them. */
export function list() {
  const all = Object.values(store?.get() || {});
  return all
    .map(({ key, actionId, actionName, stepId, mode, dueAt, setAt, user, input }) => ({ key, actionId, actionName, stepId, mode, dueAt, setAt, user, input }))
    .sort((a, b) => (a.mode === b.mode ? (a.dueAt || 0) - (b.dueAt || 0) : a.mode === 'after' ? -1 : 1));
}

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'laterSteps', value: list() });
}

function save(next) {
  store.set(next);
  // A restart is exactly what this list is for, and a hard kill gives no
  // chance to write it on the way out.
  store.flush();
  publish();
  arm();
}

/**
 * Set a Later step going: on its own from now, or — the same step again —
 * starting its wait over.
 */
export function schedule(step, ctx, runState = {}) {
  if (!store) return null;
  const cfg = cleanLater(step?.config);
  const actionId = runState.actionId || '';
  const key = `${actionId}:${step.id}`;
  const now = deps.now();
  const entry = {
    key,
    actionId,
    actionName: deps.actionName?.(actionId) || '',
    stepId: step.id,
    mode: cfg.mode,
    dueAt: cfg.mode === 'after' ? now + cfg.ms : null,
    setAt: now,
    user: ctx?.user?.name || '',
    input: String(ctx?.input ?? ''),
    ctx: keepContext(ctx),
    // A step run outside any action (a test, a direct call) has nowhere to be
    // read back from later, so it carries its own steps.
    ...(actionId ? {} : { steps: step.thenActions || [] }),
  };
  const before = store.get()[key];
  save({ ...store.get(), [key]: entry });
  const when = cfg.mode === 'after' ? `in ${Math.round(cfg.ms / 1000)}s` : 'when the stream ends';
  log.info(`${before ? 'started over' : 'set'}: "${entry.actionName || step.id}" ${when}`);
  return entry;
}

/** Take one off the list and run it. Taken off first, so a slow run is never run twice. */
async function fire(key, why) {
  const entry = store.get()[key];
  if (!entry) return false;
  const { [key]: _gone, ...rest } = store.get();
  save(rest);
  log.info(`${why}: "${entry.actionName || entry.stepId}"`);
  try {
    await deps.run(entry);
  } catch (err) {
    log.warn(`"${entry.actionName || entry.stepId}" failed: ${err.message}`);
  }
  return true;
}

/** Run every step whose time has come. Returns their keys. */
export function fireDue(now = deps.now()) {
  if (now < holdUntil) return [];
  const due = Object.values(store.get()).filter((e) => e.mode === 'after' && e.dueAt <= now).map((e) => e.key);
  for (const key of due) fire(key, 'time is up');
  return due;
}

/** One timer, for the soonest — the moment the server needs to act is known in advance. */
function arm() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (deps?.autoTimer === false) return;
  const times = Object.values(store.get()).filter((e) => e.mode === 'after').map((e) => e.dueAt);
  if (!times.length) return;
  const at = Math.max(Math.min(...times), holdUntil);
  timer = setTimeout(() => { timer = null; fireDue(); arm(); }, Math.min(MAX_TIMER_MS, Math.max(0, at - deps.now())));
  timer.unref?.();
}

/** The stream is over: every step waiting for that runs. */
export function onStreamEnded() {
  const waiting = Object.values(store.get()).filter((e) => e.mode === 'streamEnd').map((e) => e.key);
  for (const key of waiting) fire(key, 'the stream ended');
  return waiting;
}

/** From the Waiting list: run it now rather than when its time comes. */
export const runNow = (key) => fire(key, 'run now');

/** From the Waiting list: never mind. */
export function cancel(key) {
  const entry = store.get()[key];
  if (!entry) return false;
  const { [key]: _gone, ...rest } = store.get();
  save(rest);
  log.info(`cancelled: "${entry.actionName || entry.stepId}"`);
  return true;
}

export function initLater(d) {
  deps = { now: () => Date.now(), ...d };
  store = collection('later_steps', {});
  holdUntil = deps.now() + (deps.bootGraceMs ?? BOOT_GRACE_MS);
  bus.on('stream:ended', onStreamEnded);
  const waiting = Object.keys(store.get()).length;
  if (waiting) log.info(`${waiting} step(s) still waiting from before the restart`);
  arm();
}
