/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The countdown: "starting in 4:58", agreed on by every surface showing it.
 *
 * Modelled on the setup timer in Games Done Quick's layouts, and the reason
 * that one lives on the server rather than in the overlay: a browser source
 * that reloads mid-countdown must come back showing the same number, and a
 * second overlay on another machine must not drift from the first.
 *
 * The state here is an **absolute end time**, never a ticking number. The
 * server broadcasts when something changes — started, paused, adjusted — and
 * each surface works out its own remaining time from that. A ticking value
 * would mean a frame per second to every client, and the omnibar has already
 * shown what constant traffic does to a React tree.
 *
 * Clients cannot simply trust `endsAt` against their own clock: a phone can be
 * seconds off. Every payload carries `serverNow`, so a surface can measure the
 * offset once and subtract it.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from './../core/logger.js';
import { readSettings, lookColour, SETTINGS_VERSION } from './layouts.js';

const log = createLogger('countdown');

const MIN_MS = 0;
const MAX_MS = 24 * 60 * 60 * 1000;

const DEFAULT = {
  /** idle | running | paused | finished */
  mode: 'idle',
  /** When it will reach zero, in epoch ms. Only meaningful while running. */
  endsAt: null,
  /** What is left. Authoritative while idle, paused or finished. */
  remainingMs: 5 * 60 * 1000,
  /** What `reset` goes back to. */
  durationMs: 5 * 60 * 1000,
  label: '',
  style: {
    fontSize: 96,
    // Empty is automatic: the look's colour, or the clock's own without one
    // (see OLD_COLOURS).
    color: '',
    labelColor: '',
    background: '#00000000',
    showLabel: true,
    settingsVersion: SETTINGS_VERSION,
  },

  /*
    Saved setups for the one clock.

    There is still a single countdown — two running at once would be two
    numbers each claiming to be how long until the stream starts. What
    repeats is the configuration: "starting soon" is five minutes with one
    label and one colour, "intermission" is fifteen with another, and
    switching between them used to mean typing both in again.

    The live fields above are the active setup, copied out. Every surface
    keeps reading the countdown exactly as it did before this existed, and
    nothing downstream had to learn what a preset is.
  */
  presets: [],
  /** Which saved setup the live fields came from. */
  activeId: '',
};

/** As many saved setups as anyone could tell apart at a glance. */
const MAX_PRESETS = 12;

const colour = (v, fallback) => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v || '') ? v : fallback);

/**
 * The clock's own colours, drawn with no look on the layer — and what every
 * setup stored before a colour could be left automatic held in full, as
 * though somebody had chosen them. Read once as automatic (see upgradeStyle).
 */
const OLD_COLOURS = { color: '#ffffff', labelColor: '#f43f5e' };

/**
 * A colour a look can decide: empty is automatic, and is kept as asked for;
 * anything else that is not a colour keeps what was there.
 */
const lookable = (v, fallback) => (v === '' ? '' : colour(v, fallback ?? ''));

/** One place, so a preset and the live clock cannot be checked differently. */
export function cleanStyle(incoming, base) {
  const from = (incoming && typeof incoming === 'object') ? incoming : {};
  return {
    fontSize: Math.min(400, Math.max(16, Number(from.fontSize) || base.fontSize)),
    // Chosen, each beats a look on the layer: the looks read
    // --countdown-text and --countdown-label before their own.
    color: lookable(from.color, base.color),
    labelColor: lookable(from.labelColor, base.labelColor),
    background: colour(from.background, base.background),
    showLabel: from.showLabel !== false,
    settingsVersion: SETTINGS_VERSION,
  };
}

/** A style from before the mark, with its old defaults read as automatic. */
export function upgradeStyle(style) {
  if (!style || readSettings(style)) return style;
  return {
    ...style,
    color: lookColour(style, 'color', OLD_COLOURS.color),
    labelColor: lookColour(style, 'labelColor', OLD_COLOURS.labelColor),
    settingsVersion: SETTINGS_VERSION,
  };
}

const cleanLabel = (v) => String(v ?? '').replace(/[ ]+/g, ' ').trim().slice(0, 60);

/** A name for a saved setup. Never empty: an unnamed row cannot be chosen. */
const cleanName = (v, fallback) => (cleanLabel(v) || fallback).slice(0, 40);

const newId = () => Math.random().toString(36).slice(2, 11);

let state = null;
let finishTimer = null;

const clampMs = (v, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(n)));
};

/** What a surface needs to render it, including the clock to measure against. */
export function getState() {
  const s = state?.get() ?? DEFAULT;
  return { ...s, serverNow: Date.now() };
}

/** Milliseconds left right now, whatever mode it is in. */
function remainingNow(s) {
  if (s.mode !== 'running' || !s.endsAt) return s.remainingMs;
  return Math.max(0, s.endsAt - Date.now());
}

function publish(next) {
  state.set(next);

  // Written through immediately rather than on the store's usual debounce.
  // This changes a handful of times per stream, and it is the one piece of
  // state where losing the last write is visible: a timer that was stopped
  // coming back running, or one that expired coming back with time on it. A
  // hard kill — Android reclaiming Termux, a forced stop — leaves no chance to
  // flush on the way out.
  state.flush();

  bus.emit(EVENTS.CONFIG, { key: 'countdown', value: { ...next, serverNow: Date.now() } });
  return next;
}

/**
 * Wake up exactly when it reaches zero.
 *
 * One timer rather than a poll: the only moment the server needs to act is the
 * transition, and that moment is known in advance.
 */
function scheduleFinish(s) {
  if (finishTimer) { clearTimeout(finishTimer); finishTimer = null; }
  if (s.mode !== 'running' || !s.endsAt) return;

  const delay = Math.max(0, s.endsAt - Date.now());
  finishTimer = setTimeout(() => {
    finishTimer = null;
    const current = state.get();
    if (current.mode !== 'running') return;

    publish({ ...current, mode: 'finished', endsAt: null, remainingMs: 0 });
    log.info('countdown finished');

    // Surfaced as a normal stream event so an action can react to it — switch
    // scene, send a message, start the music. That is the whole reason to have
    // the timer on the server rather than in one overlay.
    //
    // Which saved setup it was travels with it, so an action can be for one
    // of them: "Starting soon" reaching zero is not "BRB" reaching zero.
    const preset = (current.presets || []).find((p) => p.id === current.activeId);
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'countdown_finished',
      platform: 'system',
      user: current.label || 'Countdown',
      data: { label: current.label, timer: preset?.id || '', name: preset?.name || '' },
    }));
  }, delay);
}

export function initCountdown() {
  state = collection('countdown', DEFAULT);

  /*
    A countdown that existed before saved setups did becomes the first one.

    The alternative is an empty list beside a configured clock, which reads
    as having lost the setup rather than as not having saved it yet — and the
    first thing anyone would do is type it in again.
  */
  {
    const existing = state.get();
    if (!(existing.presets || []).length) {
      const preset = {
        id: newId(),
        name: cleanName(existing.label, 'Countdown'),
        durationMs: existing.durationMs,
        label: existing.label,
        style: { ...existing.style },
      };
      state.set({ ...existing, presets: [preset], activeId: preset.id });
      state.flush();
      log.info(`countdown adopted the existing countdown as "${preset.name}"`);
    }
  }

  /*
    Setups stored before a colour could be left to the look: the live one and
    every saved row, once each, by the mark on each style.
  */
  {
    const existing = state.get();
    const behind = [existing.style, ...(existing.presets || []).map((p) => p.style)].filter((st) => st && !readSettings(st)).length;
    if (behind) {
      state.set({
        ...existing,
        style: upgradeStyle(existing.style),
        presets: (existing.presets || []).map((p) => ({ ...p, style: upgradeStyle(p.style) })),
      });
      state.flush();
      log.info(`countdown: ${behind} setup(s) now leave their look to decide what was left at the default`);
    }
  }

  // A restart mid-countdown must not lose it. If the moment has already passed
  // while the server was down, it finished; otherwise pick the clock back up.
  const s = state.get();
  if (s.mode === 'running' && s.endsAt) {
    if (s.endsAt <= Date.now()) {
      publish({ ...s, mode: 'finished', endsAt: null, remainingMs: 0 });
      log.info('countdown had already finished while the server was down');
    } else {
      scheduleFinish(s);
      log.info(`countdown resumed with ${Math.round((s.endsAt - Date.now()) / 1000)}s left`);
    }
  }
}

/**
 * Every way the countdown can change.
 *
 * `start` from paused continues rather than restarting, which is what a pause
 * button is for; from idle or finished it begins the configured duration.
 */
export function control(op, value) {
  if (!state) return null;
  const s = state.get();

  switch (op) {
    case 'start': {
      /*
        From a pause it carries on. Otherwise it runs what is on screen: the
        time set up, with anything added or taken off before pressing start —
        a clock that shows 10:30 and then runs 10:00 is lying about what it
        is about to do. Once it has finished there is nothing on screen, so
        it runs the time set up.
      */
      const onScreen = s.mode === 'idle' ? s.remainingMs : 0;
      const ms = s.mode === 'paused' ? s.remainingMs
        : value !== undefined && value !== null ? (clampMs(value, s.durationMs) || s.durationMs)
          : (onScreen > 0 ? onScreen : s.durationMs);
      if (ms <= 0) return getState();
      const next = publish({ ...s, mode: 'running', endsAt: Date.now() + ms, remainingMs: ms });
      scheduleFinish(next);
      log.info(`countdown started: ${Math.round(ms / 1000)}s`);
      return getState();
    }

    /*
      Start from the top: the saved setup named (or the one set up now, when
      none is), at its full length, whatever the clock was doing. What an
      action means by "start the BRB countdown" — pressed again it starts
      over rather than pausing, which is what toggle is for.
    */
    case 'begin': {
      const preset = value ? (s.presets || []).find((p) => p.id === value) : null;
      if (value && !preset) return getState();
      const base = preset
        ? { ...s, activeId: preset.id, durationMs: preset.durationMs, label: preset.label, style: { ...preset.style } }
        : s;
      if (!(base.durationMs > 0)) return getState();
      const next = publish({ ...base, mode: 'running', endsAt: Date.now() + base.durationMs, remainingMs: base.durationMs });
      scheduleFinish(next);
      log.info(`countdown started${preset ? ` "${preset.name}"` : ''}: ${Math.round(base.durationMs / 1000)}s`);
      return getState();
    }

    /** Pause it while it runs; otherwise start it, or carry on from a pause. */
    case 'toggle':
      return control(s.mode === 'running' ? 'pause' : 'start');

    case 'pause': {
      if (s.mode !== 'running') return getState();
      const left = remainingNow(s);
      if (finishTimer) { clearTimeout(finishTimer); finishTimer = null; }
      publish({ ...s, mode: 'paused', endsAt: null, remainingMs: left });
      return getState();
    }

    case 'reset': {
      if (finishTimer) { clearTimeout(finishTimer); finishTimer = null; }
      publish({ ...s, mode: 'idle', endsAt: null, remainingMs: s.durationMs });
      return getState();
    }

    /** Add or subtract time, whether it is running or not. */
    case 'add': {
      const delta = Number(value) || 0;
      if (!delta) return getState();
      if (s.mode === 'running' && s.endsAt) {
        const endsAt = Math.max(Date.now(), s.endsAt + delta);
        const next = publish({ ...s, endsAt, remainingMs: Math.max(0, endsAt - Date.now()) });
        scheduleFinish(next);
      } else {
        // Time given to a finished clock is a clock ready to go again, not a finished one showing a number.
        publish({ ...s, mode: s.mode === 'finished' ? 'idle' : s.mode, remainingMs: clampMs(s.remainingMs + delta, s.remainingMs) });
      }
      return getState();
    }

    case 'setDuration': {
      const durationMs = clampMs(value, s.durationMs);
      // Changing the duration while idle is also setting what is on screen —
      // and after it has finished, setting up the next one, so it is ready
      // rather than a finished clock showing a fresh number.
      publish({
        ...s,
        mode: s.mode === 'finished' ? 'idle' : s.mode,
        durationMs,
        remainingMs: s.mode === 'running' ? s.remainingMs : durationMs,
      });
      return getState();
    }

    case 'setLabel':
      publish({ ...s, label: cleanLabel(value) });
      return getState();

    case 'setStyle': {
      publish({ ...s, style: cleanStyle(value, s.style) });
      return getState();
    }

    /*
      Write what is set up now back into the saved row it came from.

      Explicit, rather than saving every edit as it happens. Editing through
      to the active row sounds friendlier and is not: the second thing anyone
      does is set up a second timer, and doing that means typing new values
      over the top of the first one — which would quietly destroy it. A tweak
      that is not saved can be made again; a saved timer that is gone cannot.
    */
    case 'updatePreset': {
      if (!s.activeId) return getState();
      const presets = (s.presets || []).map((p) => (
        p.id === s.activeId
          ? { ...p, durationMs: s.durationMs, label: s.label, style: { ...s.style } }
          : p
      ));
      publish({ ...s, presets });
      return getState();
    }

    /*
      Save what is set up now as a new row.

      A copy rather than a reference: the point of saving is that this setup
      survives the next one being typed over the top of it.
    */
    case 'savePreset': {
      if ((s.presets || []).length >= MAX_PRESETS) return getState();
      const preset = {
        id: newId(),
        name: cleanName(value, s.label || 'Timer'),
        durationMs: s.durationMs,
        label: s.label,
        style: { ...s.style },
      };
      publish({ ...s, presets: [...(s.presets || []), preset], activeId: preset.id });
      log.info(`countdown saved "${preset.name}"`);
      return getState();
    }

    /*
      Make one of the saved setups the live one.

      A running clock keeps running: the mode and the end time are left
      alone, so picking the wrong row mid-countdown is a label change rather
      than a lost timer. What is on screen while it is *not* running does
      follow, because that is the number you are about to start.
    */
    case 'loadPreset': {
      const preset = (s.presets || []).find((p) => p.id === value);
      if (!preset) return getState();
      publish({
        ...s,
        mode: s.mode === 'finished' ? 'idle' : s.mode,
        activeId: preset.id,
        durationMs: preset.durationMs,
        label: preset.label,
        style: { ...preset.style },
        remainingMs: s.mode === 'running' ? s.remainingMs : preset.durationMs,
      });
      log.info(`countdown loaded "${preset.name}"`);
      return getState();
    }

    case 'renamePreset': {
      const { id, name } = (value && typeof value === 'object') ? value : {};
      const presets = (s.presets || []).map((p) => (
        p.id === id ? { ...p, name: cleanName(name, p.name) } : p
      ));
      publish({ ...s, presets });
      return getState();
    }

    /*
      Deleting the active row leaves the live clock exactly as it is, just no
      longer attached to anything. Clearing it instead would change what is
      on screen as a side effect of tidying a list.
    */
    case 'deletePreset': {
      const presets = (s.presets || []).filter((p) => p.id !== value);
      publish({ ...s, presets, activeId: s.activeId === value ? '' : s.activeId });
      return getState();
    }

    default:
      throw new Error(`countdown: unknown operation "${op}"`);
  }
}

/**
 * How much time somebody means, as signed milliseconds.
 *
 * "1:30" is a minute and a half and "1:02:03" an hour and a bit; "30s",
 * "30seg", "2m" and "1h" say their unit; a plain number is minutes, since
 * that is how a countdown is talked about ("dos minutos más"). A minus in
 * front takes time off. Anything else is null — nothing to do, not a guess.
 */
export function parseAmount(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const m = /^([+-]?)(.+)$/.exec(s);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const body = m[2];
  let ms;
  if (/^\d+(:\d{1,2}){1,2}$/.test(body)) {
    const parts = body.split(':').map(Number);
    if (parts.slice(1).some((p) => p > 59)) return null;
    ms = parts.reduce((acc, p) => acc * 60 + p, 0) * 1000;
  } else {
    const u = /^(\d+(?:[.,]\d+)?)(h|m|min|s|sec|seg)?$/.exec(body);
    if (!u) return null;
    const n = Number(u[1].replace(',', '.'));
    const unit = u[2] || 'm';
    ms = n * (unit === 'h' ? 3600000 : unit.startsWith('s') ? 1000 : 60000);
  }
  if (!Number.isFinite(ms)) return null;
  return sign * Math.min(MAX_MS, Math.round(ms));
}

/** What is left, as the clock shows it: 4:58, or 1:02:03 past the hour. */
export function formatLeft(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(total % 60)}` : `${m}:${pad(total % 60)}`;
}

/** The countdown operations an action step or a deck button can ask for. */
export const COUNTDOWN_OPS = ['start', 'toggle', 'pause', 'resume', 'add', 'reset'];

/**
 * What an action step or a deck button asks of the countdown, in its words.
 *
 * start is the saved setup named (`timer`, or the one set up now), from the
 * top; toggle, pause and resume act on the clock as it is; add takes the
 * amount as typed (see parseAmount); reset puts it back, stopped. Returns the
 * clock before and after, so a caller can tell a press that changed nothing,
 * and what is left, for a chat step to say.
 */
export function act(op, { timer = '', amount = '' } = {}) {
  if (!COUNTDOWN_OPS.includes(op)) throw new Error(`countdown: unknown step "${op}"`);
  const before = getState();
  let after = before;
  if (op === 'start') after = control('begin', timer);
  else if (op === 'toggle') after = control('toggle');
  else if (op === 'pause') after = control('pause');
  else if (op === 'resume') after = before.mode === 'paused' ? control('start') : before;
  else if (op === 'reset') after = control('reset');
  else if (op === 'add') {
    const ms = parseAmount(amount);
    after = ms ? control('add', ms) : before;
  }
  return { before, after, time: formatLeft(remainingNow(after)) };
}

/** Stop the scheduled wake-up, for a clean shutdown. */
export function stopCountdown() {
  if (finishTimer) { clearTimeout(finishTimer); finishTimer = null; }
}
