/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Numbers the stream keeps count of by hand — for now, how many times you
 * have died.
 *
 * Nothing measures a death: no game tells the stream it happened. So it is a
 * number somebody changes — a mod's "!muerte", a button on the deck, the
 * Game screen — held here so that every overlay showing it, and every chat
 * reply quoting it, agrees. Kept between streams: a horror playthrough runs
 * over several nights, and its count is the playthrough's, not the night's.
 *
 * Named counts rather than one field, so a second (jumpscares, say) is a name
 * added to COUNTERS rather than a module copied.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('counters');

/** Every count there is, and where each starts. */
export const COUNTERS = ['deaths'];
const DEFAULT = Object.fromEntries(COUNTERS.map((name) => [name, 0]));
/** Past this it is a typo, not a playthrough. */
const MAX = 999999;
export const COUNTER_OPS = ['auto', 'add', 'subtract', 'set', 'reset'];

let state = null;

export function initCounters() {
  state = collection('counters', DEFAULT);
}

/** Every count, each a whole number. */
export function getCounters() {
  const stored = state?.get() || {};
  return Object.fromEntries(COUNTERS.map((name) => [name, clean(stored[name])]));
}

const clean = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(MAX, Math.max(0, n)) : 0;
};

/**
 * A number out of what was typed: "3", "+2", "-1", "x3". Nothing, or
 * nothing numeric, is null.
 */
const readNumber = (v) => {
  const m = String(v ?? '').replace(/[,\s]/g, '').match(/^([+-]?)(\d+)/);
  return m ? { sign: m[1], n: Number(m[2]) } : null;
};

/**
 * Change one count, and say what it is now.
 *
 * `auto` reads what was typed, the way the goal step does: nothing at all is
 * one more — "!muerte" on its own is the whole point — "+2" adds two, "-1"
 * takes one back, and a bare "5" sets it to five. The others do what they
 * say, with nothing typed meaning one.
 */
export function changeCounter(name, op = 'auto', amount = '') {
  if (!COUNTERS.includes(name)) return null;
  const now = getCounters();
  const before = now[name];
  const typed = readNumber(amount);
  const by = typed ? typed.n : 1;
  let next = before;
  switch (COUNTER_OPS.includes(op) ? op : 'auto') {
    case 'add': next = before + by; break;
    case 'subtract': next = before - by; break;
    case 'set': next = typed ? typed.n : before; break;
    case 'reset': next = 0; break;
    default:
      next = !typed ? before + 1 : typed.sign === '+' ? before + typed.n : typed.sign === '-' ? before - typed.n : typed.n;
  }
  const value = clean(next);
  if (value !== before) {
    const saved = { ...now, [name]: value };
    state.set(saved);
    state.flush();
    bus.emit(EVENTS.CONFIG, { key: 'counters', value: saved });
    log.info(`${name}: ${before} → ${value}`);
  }
  return { name, value, before };
}
