/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * PNGtuber: whether you are talking, heard through your microphone in OBS,
 * the face an action asked for, and what viewers dressed the avatars in.
 *
 * OBS already hears the microphone the stream hears, and can report every
 * input's level about twenty times a second (the InputVolumeMeters event,
 * asked for only while a microphone is chosen). This turns those levels into
 * answers — talking, loud, and soft (talking, but never halfway up to loud)
 * — with a threshold for each and a short hold, so the mouth does not snap
 * shut between words, or change size every syllable. Only changes are
 * sent on, so an overlay hears about a sentence, not every twentieth of it.
 *
 * The raw level is sent only while somebody is setting the sensitivity (a
 * meter asked for in the last few seconds), and a few times a second.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { avatarDressName, avatarActionName } from '../../shared/avatar.js';
import { pixelActionName, pixelDressName } from '../../shared/pixel-avatars.js';
import { getPixelAvatars } from './pixel-avatars.js';

export const DEFAULT_MIC = {
  /** The OBS input to listen to — the microphone's name in OBS. */
  inputName: '',
  /** Talking from this level up, in dB. */
  threshold: -38,
  /** Loud from this level up, in dB. */
  loud: -12,
  /** How long the mouth stays open after the voice drops, in ms. */
  holdMs: 220,
};

const METER_FOR_MS = 8000;
const METER_EVERY_MS = 120;

let store = null;
let obsService = null;
let state = { talking: false, loud: false, soft: false };
let lastLoudAt = 0;
let lastTalkAt = 0;
let lastMidAt = 0;
let meterUntil = 0;
let lastMeterAt = 0;
let faceTimer = null;
let face = null;
// What viewers put on it: an outfit and a hat, each for its own few minutes.
let dress = { outfit: null, hat: null };
// Something every avatar is doing: its name and a key that is new each time.
let action = null;
let actionTimer = null;
let actionCount = 0;
/** Long enough for any of them to play out, then it is let go, so a page opened later does not play it late. */
export const AVATAR_ACTION_HOLD_MS = 10000;
const dressTimers = {};

const num = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

export function cleanMic(incoming, before = DEFAULT_MIC) {
  const c = { ...before, ...(incoming && typeof incoming === 'object' ? incoming : {}) };
  return {
    inputName: String(c.inputName ?? '').trim().slice(0, 120),
    threshold: num(c.threshold, -80, 0, DEFAULT_MIC.threshold),
    loud: num(c.loud, -80, 0, DEFAULT_MIC.loud),
    holdMs: num(c.holdMs, 0, 2000, DEFAULT_MIC.holdMs),
  };
}

export const getMic = () => store?.get() ?? DEFAULT_MIC;

/** The loudest channel's peak, in dB, from one input's InputVolumeMeters entry. */
export function levelDb(input) {
  const channels = Array.isArray(input?.inputLevelsMul) ? input.inputLevelsMul : [];
  let peak = 0;
  for (const ch of channels) peak = Math.max(peak, Number(ch?.[1]) || 0, Number(ch?.[0]) || 0);
  return peak > 0 ? Math.max(-100, 20 * Math.log10(peak)) : -100;
}

function publish(next) {
  if (next.talking === state.talking && next.loud === state.loud && next.soft === state.soft) return;
  state = next;
  bus.emit(EVENTS.CONFIG, { key: 'micTalk', value: state });
}

/**
 * One batch of levels from OBS. `now` is passed in by the tests; OBS sends
 * a batch every fifty milliseconds or so, which is what the hold counts in.
 */
export function onMeters(inputs, now = Date.now()) {
  const cfg = getMic();
  if (!cfg.inputName) return;
  const input = (inputs || []).find((i) => i?.inputName === cfg.inputName);
  if (!input) return;
  const db = levelDb(input);
  if (db >= cfg.threshold) lastTalkAt = now;
  if (db >= cfg.loud) lastLoudAt = now;
  if (db >= midDb(cfg)) lastMidAt = now;
  const talking = now - lastTalkAt <= cfg.holdMs && lastTalkAt > 0;
  const loud = talking && now - lastLoudAt <= Math.min(cfg.holdMs, 300) && lastLoudAt > 0;
  // Soft until the voice reaches halfway to loud, and soft again only after the hold.
  const soft = talking && !loud && !(now - lastMidAt <= cfg.holdMs && lastMidAt > 0);
  publish({ talking, loud, soft });
  if (now < meterUntil && now - lastMeterAt >= METER_EVERY_MS) {
    lastMeterAt = now;
    bus.emit(EVENTS.CONFIG, { key: 'micLevel', value: { db: Math.round(db * 10) / 10, at: now } });
  }
}

/** Halfway between talking and loud, in dB: under it, the voice is soft. */
export const midDb = (cfg) => (cfg.threshold + cfg.loud) / 2;

/** The setup screen is open: send the level for a few seconds more. */
export function meter() {
  meterUntil = Date.now() + METER_FOR_MS;
  return { ok: true };
}

/** OBS reports levels only while there is a microphone to listen to. */
function wantMeters() {
  obsService?.setMetersWanted?.(Boolean(getMic().inputName));
}

export function setMic(patch) {
  const next = cleanMic(patch, getMic());
  store.set(next);
  bus.emit(EVENTS.CONFIG, { key: 'micSettings', value: next });
  if (!next.inputName) publish({ talking: false, loud: false, soft: false });
  wantMeters();
  return next;
}

/**
 * A face for every avatar on screen, for `seconds`, or until the next one —
 * from an action, so a command, a dock button or an alert can pull one.
 * The name is an expression of the pixel avatar, or the name of a set of
 * pictures on a PNGtuber layer. Nothing, or "none", puts the faces back.
 */
export function showFace(name, seconds = 5) {
  clearTimeout(faceTimer);
  const clean = String(name ?? '').trim().toLowerCase().slice(0, 40);
  face = clean && clean !== 'none' ? { name: clean, seconds: num(seconds, 1, 600, 5) } : null;
  bus.emit(EVENTS.CONFIG, { key: 'avatarFace', value: face });
  if (face) {
    faceTimer = setTimeout(() => {
      face = null;
      bus.emit(EVENTS.CONFIG, { key: 'avatarFace', value: null });
    }, face.seconds * 1000);
    faceTimer.unref?.();
  }
  return face;
}

/**
 * What some words name: the built-in avatar's name for them, or, when it
 * has none, the first pixel avatar from the Pixel avatars tab that knows
 * them. Every avatar on screen is then asked for that name, and one that
 * has nothing by it carries on as it was.
 */
function nameAcross(builtIn, own) {
  const name = builtIn();
  if (name !== null) return name;
  for (const pa of getPixelAvatars()) {
    const theirs = own(pa);
    if (theirs !== null && theirs !== undefined) return theirs;
  }
  return null;
}

/** What every avatar is dressed in now: outfit and hat by name (null is the layer's own), and until when. */
function dressView() {
  return {
    outfit: dress.outfit?.name ?? null,
    hat: dress.hat?.name ?? null,
    outfitUntil: dress.outfit?.until ?? null,
    hatUntil: dress.hat?.until ?? null,
  };
}

/**
 * A viewer dresses every avatar on screen: `what` is 'outfit' or 'hat', and
 * `words` whatever they typed ("!outfit link", or a reward's text) — see
 * avatarDressName. It stays on for `minutes`, one to sixty, then the layer's
 * own comes back. Words that name nothing change nothing, and give null.
 */
export function dressAvatar(what, words, minutes = 5, now = Date.now()) {
  const kind = what === 'hat' ? 'hat' : 'outfit';
  const name = nameAcross(() => avatarDressName(kind, words), (pa) => pixelDressName(pa, kind, words));
  if (name === null) return null;
  const mins = num(minutes, 1, 60, 5);
  clearTimeout(dressTimers[kind]);
  dress = { ...dress, [kind]: { name, until: now + mins * 60000 } };
  dressTimers[kind] = setTimeout(() => {
    dress = { ...dress, [kind]: null };
    bus.emit(EVENTS.CONFIG, { key: 'avatarDress', value: dressView() });
  }, mins * 60000);
  dressTimers[kind].unref?.();
  bus.emit(EVENTS.CONFIG, { key: 'avatarDress', value: dressView() });
  return { [kind]: name, minutes: mins };
}

/**
 * Every avatar on screen does something once — drinks a glass of water —
 * named as the avatar names it or by a loose word ("agua", "tomar"; see
 * avatarActionName). Every call is a new key, so asking again does it
 * again. An avatar in an outfit not drawn doing it does nothing. Words
 * that name nothing do nothing, and give null.
 */
export function playAvatarAction(words, now = Date.now()) {
  const name = nameAcross(() => avatarActionName(words), (pa) => pixelActionName(pa, words));
  if (!name) return null;
  clearTimeout(actionTimer);
  actionCount += 1;
  action = { name, key: `${now}-${actionCount}` };
  bus.emit(EVENTS.CONFIG, { key: 'avatarAction', value: action });
  actionTimer = setTimeout(() => {
    action = null;
    bus.emit(EVENTS.CONFIG, { key: 'avatarAction', value: null });
  }, AVATAR_ACTION_HOLD_MS);
  actionTimer.unref?.();
  return action;
}

/** Everything viewers put on comes off, and every avatar wears its own again. */
export function undressAvatar() {
  clearTimeout(dressTimers.outfit);
  clearTimeout(dressTimers.hat);
  dress = { outfit: null, hat: null };
  bus.emit(EVENTS.CONFIG, { key: 'avatarDress', value: dressView() });
  return { ok: true };
}

export const snapshot = () => ({ micSettings: getMic(), micTalk: state, avatarFace: face, avatarDress: dressView(), avatarAction: action });

export function initPngtuber(obs) {
  store = collection('pngtuber_mic', DEFAULT_MIC);
  obsService = obs;
  bus.on('obs:meters', (inputs) => onMeters(inputs));
  // Asked again whenever OBS comes back, since a new connection starts without it.
  bus.on(EVENTS.STATUS, (s) => { if (s?.platform === 'obs' && s.status === 'connected') wantMeters(); });
  wantMeters();
}

/** Tests only: forget the talking state and the hold. */
export function resetForTests() {
  state = { talking: false, loud: false, soft: false };
  lastLoudAt = 0;
  lastTalkAt = 0;
  lastMidAt = 0;
}
