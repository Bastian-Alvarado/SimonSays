/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Between an alert firing and the pages that show it.
 *
 * An alert waits here while alerts are paused, or — when "hold" is on —
 * while OBS is open but the scene on stream shows no alerts (a BRB scene, a
 * cutscene layout), and goes out in order once that changes. Before this, an
 * alert fired during such a scene played on no page and was simply gone.
 *
 * The pages keep their own queues and play one alert after another
 * (useStreamSystem); this decides only when an alert reaches them. So pausing
 * holds what fires next, and whatever is already playing finishes — Skip is
 * what ends that one. A test from the Alerts screen or a replay from the
 * Events dock is somebody asking to see it now, so it is never held.
 *
 * Paused is not kept across a restart: a server that comes back up paused
 * would hide every alert until somebody remembered why.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { refusal } from '../core/refusal.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('alerts');

/** How long a held alert stays worth showing; older ones are dropped rather than played late. */
export const HOLD_MAX_MS = 30 * 60 * 1000;
/** How many wait at most; past that the oldest goes, so a long BRB cannot bank a wall of them. */
export const HOLD_MAX = 50;
/** How often a held alert checks whether the scene shows alerts again. */
const CHECK_MS = 1500;

const DEFAULT_SETTINGS = { holdUnseen: true };

let settingsStore = null;
const settings = () => {
  settingsStore ??= collection('alert_settings', DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(settingsStore.get() || {}) };
};

let paused = false;
/** Held alerts, oldest first: { alert, at }. */
let held = [];
/**
 * What the pages are playing, as the server reckons it: each alert's end, in
 * the order they play. Enough to know whether Skip has anything to skip and
 * to keep counting after one is skipped.
 */
let playing = [];
let timer = null;

/*
  What it needs from the socket hub, which alone knows which pages are open
  and what each shows. Set by ws.js; the defaults let it run without one.
*/
let hub = {
  deliver: () => {},
  anyoneShows: () => true,
  streamOpen: () => false,
  tellPages: () => {},
};
export function connectAlertGate(next = {}) {
  hub = { ...hub, ...next };
}

/** As the screens hold it. */
export function alertGateState() {
  const s = settings();
  return { paused, held: held.length, holdUnseen: s.holdUnseen !== false };
}
function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'alertGate', value: alertGateState() });
}

/** Paused, or OBS open with nothing on stream that shows alerts. */
function blocked() {
  if (paused) return true;
  return settings().holdUnseen !== false && hub.streamOpen() && !hub.anyoneShows();
}

function track(alert) {
  const now = Date.now();
  playing = playing.filter((p) => p.end > now);
  const start = Math.max(now, playing.length ? playing[playing.length - 1].end : now);
  playing.push({ id: alert.id, end: start + (Number(alert.config?.duration) || 5000) });
}

function send(alert) {
  hub.deliver(alert);
  track(alert);
}

/** An alert has fired: out to the pages, or held. Says which. */
export function offerAlert(alert) {
  if (alert?.manual) {
    send(alert);
    return 'shown';
  }
  // Anything already waiting goes first, so they stay in order.
  releaseAlerts();
  if (blocked()) {
    held.push({ alert, at: Date.now() });
    if (held.length > HOLD_MAX) held.shift();
    log.info(`alert held (${paused ? 'paused' : 'nothing on stream shows alerts'}); ${held.length} waiting`);
    publish();
    watch();
    return 'held';
  }
  send(alert);
  return 'shown';
}

/** Lets everything waiting out, when nothing holds it any more. Says how many went. */
export function releaseAlerts() {
  if (!held.length) return 0;
  const now = Date.now();
  const fresh = held.filter((h) => now - h.at <= HOLD_MAX_MS);
  if (fresh.length !== held.length) {
    log.info(`${held.length - fresh.length} held alert(s) dropped: waited over ${HOLD_MAX_MS / 60000} minutes`);
    held = fresh;
    publish();
  }
  if (!held.length || blocked()) return 0;
  const going = held;
  held = [];
  stopWatching();
  for (const h of going) send(h.alert);
  log.info(`${going.length} held alert(s) let out`);
  publish();
  return going.length;
}

function watch() {
  if (timer) return;
  timer = setInterval(releaseAlerts, CHECK_MS);
  timer.unref?.();
}
function stopWatching() {
  clearInterval(timer);
  timer = null;
}

/** Ends the alert on screen on every page; the next one in line starts. */
function skip() {
  const now = Date.now();
  playing = playing.filter((p) => p.end > now);
  if (!playing.length) throw refusal('alert_nothing_showing', 'no alert is on screen');
  const [current, ...rest] = playing;
  const saved = current.end - now;
  playing = rest.map((p) => ({ ...p, end: p.end - saved }));
  hub.tellPages({ op: 'skip' });
  return { ok: true };
}

/** Drops everything waiting: here, and in the pages' own queues. The one on screen finishes. */
function clear() {
  const cleared = held.length;
  held = [];
  stopWatching();
  const now = Date.now();
  playing = playing.filter((p) => p.end > now).slice(0, 1);
  hub.tellPages({ op: 'clear' });
  publish();
  return { ok: true, cleared };
}

function setPaused(next) {
  paused = Boolean(next);
  log.info(paused ? 'alerts paused' : 'alerts resumed');
  publish();
  if (!paused) releaseAlerts();
  return { ok: true, paused };
}

/**
 * The Alerts screen's and the deck's requests: skip, pause, resume, toggle,
 * clear, and `hold` (value true or false) for holding alerts nothing shows.
 */
export function controlAlerts(op, value) {
  switch (op) {
    case 'skip': return skip();
    case 'pause': return setPaused(true);
    case 'resume': return setPaused(false);
    case 'toggle': return setPaused(!paused);
    case 'clear': return clear();
    case 'hold': {
      settingsStore ??= collection('alert_settings', DEFAULT_SETTINGS);
      settingsStore.set({ ...settings(), holdUnseen: value !== false });
      publish();
      releaseAlerts();
      return { ok: true, holdUnseen: value !== false };
    }
    default: throw refusal('bad_request', `alerts: unknown operation "${op}"`);
  }
}

/** Back to nothing waiting and nothing playing, unpaused: for the tests. */
export function resetAlertGateForTests() {
  paused = false;
  held = [];
  playing = [];
  stopWatching();
}
/** The hub as connected, so a test that swaps in its own can put the real one back. */
export const alertGateHubForTests = () => hub;
