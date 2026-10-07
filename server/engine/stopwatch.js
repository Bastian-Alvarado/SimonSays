/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The run timer: a stopwatch counting up, the clock beside every run at a
 * Games Done Quick marathon.
 *
 * On the server for the reason the countdown is. A browser source that reloads
 * mid-run has to come back showing the same time, a second overlay on another
 * machine must not drift from the first, and a timer kept in one page would
 * stop the moment that page did.
 *
 * So the state is when it started, never a ticking number. While it runs,
 * `startedAt` is the moment it would have started had it never been paused,
 * and every surface works out the time from that and the server's clock; when
 * it is not running, `elapsedMs` is the time, full stop. The server broadcasts
 * only when something changes, and a restart picks a running timer straight
 * back up, since nothing about it needed ticking to be right.
 *
 * Finishing freezes the time but keeps when it started, which is what lets a
 * finish pressed by accident be undone: it carries on as if it never stopped,
 * the seconds since included, because the run did not stop either.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { readSettings, SETTINGS_VERSION } from './layouts.js';

const log = createLogger('timer');

/** Long enough for any single run; past it a number is a typo. */
const MAX_MS = 100 * 60 * 60 * 1000;

const DEFAULT = {
  /** idle | running | paused | finished */
  mode: 'idle',
  /** Epoch ms it would have started at without its pauses. Kept through a finish. */
  startedAt: null,
  /** The time, whenever it is not running. */
  elapsedMs: 0,
  style: {
    fontSize: 96,
    // Empty is automatic: the look's, or the clock's own (OLD_COLOURS).
    color: '',
    pausedColor: '',
    finishedColor: '',
    background: '#00000000',
    showTenths: true,
    settingsVersion: SETTINGS_VERSION,
  },
};

let state = null;

const clampMs = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(MAX_MS, Math.max(0, Math.round(n))) : fallback;
};

const colour = (v, fallback) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v) ? v : fallback);

/**
 * The clock's own colours, drawn with no look on the layer — and what a timer
 * stored before a colour could be left automatic held in full. Read once as
 * automatic, at startup (see initStopwatch).
 */
const OLD_COLOURS = { color: '#ffffff', pausedColor: '#a1a1aa', finishedColor: '#facc15' };

/**
 * `fromBefore` is for the style read from disk at startup: one stored before
 * the mark has its old defaults read as automatic. Never for a change from
 * the screen, which sends one colour at a time without the mark — a white
 * picked there is a white somebody chose.
 */
export function cleanStyle(incoming, base, fromBefore = false) {
  const s = incoming && typeof incoming === 'object' ? incoming : {};
  const n = Number(s.fontSize);
  const old = fromBefore && !readSettings(s);
  // Empty is automatic: the look's colour, or the clock's own without one.
  // Chosen, each beats a look (the looks read --stopwatch-colour first).
  const pick = (key) => {
    if (s[key] === '') return '';
    const v = colour(s[key], base[key] ?? '');
    return old && String(v).toLowerCase() === OLD_COLOURS[key] ? '' : v;
  };
  return {
    fontSize: Number.isFinite(n) ? Math.min(400, Math.max(12, Math.round(n))) : base.fontSize,
    color: pick('color'),
    pausedColor: pick('pausedColor'),
    finishedColor: pick('finishedColor'),
    background: colour(s.background, base.background),
    showTenths: s.showTenths === undefined ? base.showTenths : s.showTenths !== false,
    settingsVersion: SETTINGS_VERSION,
  };
}

/** The time on the clock right now, whatever mode it is in. */
export function elapsedNow(s = state?.get() ?? DEFAULT) {
  if (s.mode === 'running' && s.startedAt) return Math.min(MAX_MS, Math.max(0, Date.now() - s.startedAt));
  return s.elapsedMs || 0;
}

/** What a surface needs to draw it, with the clock to measure against. */
export function getState() {
  const s = state?.get() ?? DEFAULT;
  return { ...s, serverNow: Date.now() };
}

function publish(next, event) {
  state.set(next);
  // Written through at once: a change here is a handful per stream, and
  // losing the last one — a finished run coming back running — is visible.
  state.flush();
  bus.emit(EVENTS.CONFIG, { key: 'stopwatch', value: { ...next, serverNow: Date.now() } });
  if (event) {
    // As a stream event, so an action can answer it: a finish can switch the
    // scene or thank the runner in chat.
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: event, platform: 'system', user: 'Timer', data: { elapsedMs: next.elapsedMs },
    }));
  }
  return getState();
}

export function initStopwatch() {
  state = collection('stopwatch', DEFAULT);
  const s = state.get();
  // A timer saved before a style field existed gets it, rather than undefined.
  state.set({ ...DEFAULT, ...s, style: cleanStyle(s.style, DEFAULT.style, true) });
  if (s.mode === 'running') log.info(`timer resumed at ${Math.round(elapsedNow() / 1000)}s`);
}

/**
 * Every way the timer can change.
 *
 * `start` starts from zero when idle or finished, and carries on when paused —
 * one button that always does the obvious thing. `toggle` is that and pause
 * in one, for a single button on a deck.
 */
export function control(op, value) {
  if (!state) return null;
  const s = state.get();
  const now = Date.now();

  switch (op) {
    case 'start':
    case 'resume': {
      if (s.mode === 'running') return getState();
      if (s.mode === 'paused') {
        return publish({ ...s, mode: 'running', startedAt: now - (s.elapsedMs || 0) });
      }
      if (op === 'resume') return getState();
      log.info('timer started');
      return publish({ ...s, mode: 'running', startedAt: now, elapsedMs: 0 }, 'timer_started');
    }

    case 'pause': {
      if (s.mode !== 'running') return getState();
      return publish({ ...s, mode: 'paused', elapsedMs: elapsedNow(s), startedAt: null });
    }

    case 'toggle':
      return control(s.mode === 'running' ? 'pause' : 'start');

    case 'finish': {
      if (s.mode !== 'running' && s.mode !== 'paused') return getState();
      const at = elapsedNow(s);
      log.info(`timer finished at ${Math.round(at / 1000)}s`);
      // A paused run finishing has no start to keep; undoing it resumes it.
      return publish({ ...s, mode: 'finished', elapsedMs: at, startedAt: s.mode === 'running' ? s.startedAt : now - at }, 'timer_finished');
    }

    case 'undoFinish': {
      if (s.mode !== 'finished' || !s.startedAt) return getState();
      log.info('timer finish undone');
      return publish({ ...s, mode: 'running' });
    }

    case 'reset':
      return publish({ ...s, mode: 'idle', startedAt: null, elapsedMs: 0 });

    /** Put the clock at a time — for a run that started before the button was pressed. */
    case 'set': {
      const ms = clampMs(value, null);
      if (ms === null) return getState();
      return publish(s.mode === 'running'
        ? { ...s, startedAt: now - ms }
        : { ...s, elapsedMs: ms, startedAt: s.mode === 'finished' ? now - ms : s.startedAt });
    }

    /** Move it by some milliseconds, either way. */
    case 'add': {
      const delta = Number(value);
      if (!Number.isFinite(delta)) return getState();
      return control('set', elapsedNow(s) + delta);
    }

    case 'setStyle':
      return publish({ ...s, style: cleanStyle(value, s.style) });

    default:
      return getState();
  }
}
