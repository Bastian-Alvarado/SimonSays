/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Omnilayer: the whole stream in one OBS scene.
 *
 * The usual way is a scene per screen, each with its own copy of the game,
 * the camera and the overlay, positioned by hand — and every change made
 * again in each. Here there is one scene, set up once: the overlay's browser
 * source on top, and underneath it whatever it frames (the game capture, a
 * second one for co-op, the camera). The app decides which layout is live,
 * and each layout says where those sources go with a "source" layer: a slot
 * that draws nothing on stream and tells OBS where to put one source, at what
 * size. Going live with a layout moves them there and hides the ones it has
 * no slot for.
 *
 * Because the app is doing the switching, it can also do the transition. A
 * cut moves everything at once. A cover draws a wipe across the overlay
 * first; with the screen covered, the layout changes and the sources jump to
 * their new places, and only once both have had time to land is it
 * uncovered — so nothing is ever seen half-moved, however long the overlay
 * and OBS each take to catch up.
 *
 * The existing way keeps working: while this is off, layouts follow the OBS
 * scenes they are bound to, as before; and while it is on, a scene other
 * than this one still shows what is bound to it.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import { cleanSceneTypes, layoutOfType } from './scene-types.js';
import { ON_SCREEN_SOURCE } from '../../shared/remote-players.js';

const log = createLogger('omnilayer');

/** How a layout can arrive: all at once, or behind a wipe. */
export const OMNI_TRANSITIONS = ['cut', 'cover'];
/** How a game fits its slot: whole inside it, or stretched to it. */
export const SOURCE_FITS = ['fit', 'stretch'];

const DEFAULT = {
  enabled: false,
  /** The OBS scene it all lives in. Empty is whichever scene OBS has on. */
  scene: '',
  transition: 'cover',
  /** How long the wipe takes to cover the screen, and again to uncover it. */
  coverMs: 450,
  /** How long it stays covered while everything lands. */
  holdMs: 250,
  /** The layout on stream now. */
  live: '',
  /**
   * The scene types the streamer has named (scene-types.js). Here, with the
   * mode's other settings, because these are outside every profile: the
   * same list whichever overlay profile is on.
   */
  types: [],
};

/*
  How long a switch waits on things it does not control.

  `settleMs` is a beat after the wipe has covered the screen before anything
  moves: the overlay heard about the wipe a moment after the server said so,
  and moving the game while the wipe is still arriving would show it jump.

  `placeDeadlineMs` is how long the covered screen waits for OBS. Placing
  takes a few round trips per source, tens of milliseconds over a LAN, so
  this is only ever reached when OBS has stopped answering — a half-open
  connection after a Wi-Fi drop answers nothing and reports no error. The
  wipe uncovers then regardless: a game seen in its old place for a moment
  is a far smaller thing than a stream that has gone black and stays black.

  `spareMs` is what the overlay allows on top of all that before it lifts the
  cover by itself, for the case the server cannot help with: the connection
  between them dropping mid-wipe, so the "uncover" never arrives.

  An object rather than constants so the smoke test can shorten them.
*/
export const TIMING = { settleMs: 80, placeDeadlineMs: 2000, spareMs: 2000 };

let db = null;
let obs = null;
let layoutsNow = () => [];
/** What the wipe is doing, if anything: { phase: 'cover' | 'reveal', to, from, coverMs }. */
let transition = null;
/** What went wrong placing the sources last time, for the screen to say. */
let problems = [];
/** Each switch takes a number; a later one makes an earlier one stop where it is. */
let seq = 0;
let placeTimer = null;
/*
  Sources no layout has a box for any more, to hide once more on the way out.
  Managed is "some layout has a box for it", so deleting the last box for one
  — or the only layout that had one — would otherwise leave it showing,
  wherever that layout last put it, with nothing left that would ever hide it.
*/
const released = new Set();
/*
  What a slot's source really is in OBS. A remote player's seat
  (remote-players.js) can be the streamer's own: while it is, the slot that
  names the seat's browser source places the streamer's capture instead.
*/
let sourceFor = (name) => name;
/*
  Every source a slot's name may stand for: "Player on screen" stands for
  whichever seat is on screen, so all four are this mode's to hide — the one
  on screen a moment ago too, which no other slot may have a box for.
*/
let everySourceFor = (name) => [sourceFor(name)];
/** Names that are not OBS sources of their own, only stand-ins for one: never hidden or looked for as themselves. */
const STAND_INS = new Set([ON_SCREEN_SOURCE]);

/** Who decides what a slot's source is in OBS, and every one it may be; the slots are placed again with it. */
export function setSourceAlias(fn, every) {
  sourceFor = typeof fn === 'function' ? fn : (name) => name;
  everySourceFor = typeof every === 'function' ? every : (name) => [sourceFor(name)];
}

/**
 * The live layout's sources placed again, as after an edit — for a change OBS
 * should follow that is not one. `gone` are sources that stood in for a slot
 * and no longer do: hidden on the way, unless the layout places them.
 */
export function refresh(gone = []) {
  for (const name of gone) if (name) released.add(name);
  if (db?.get().enabled) schedulePlace(0);
}

const bounded = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

/** The settings as stored, filled in and held to what they can be. */
export function cleanOmnilayer(incoming, prev = DEFAULT) {
  const from = incoming && typeof incoming === 'object' ? incoming : {};
  const has = (k) => Object.prototype.hasOwnProperty.call(from, k);
  return {
    enabled: has('enabled') ? from.enabled === true : prev.enabled === true,
    scene: has('scene') ? String(from.scene ?? '').trim().slice(0, 256) : String(prev.scene ?? ''),
    transition: OMNI_TRANSITIONS.includes(has('transition') ? from.transition : prev.transition) ? (has('transition') ? from.transition : prev.transition) : DEFAULT.transition,
    coverMs: bounded(has('coverMs') ? from.coverMs : prev.coverMs, 150, 3000, DEFAULT.coverMs),
    holdMs: bounded(has('holdMs') ? from.holdMs : prev.holdMs, 0, 3000, DEFAULT.holdMs),
    live: String((has('live') ? from.live : prev.live) ?? '').slice(0, 64),
    types: cleanSceneTypes(has('types') ? from.types : prev.types),
  };
}

/**
 * A source slot's own settings: which OBS source, how it fits, and how much
 * of its edges to cut off first — the black bars of a 4:3 game captured in a
 * 16:9 window, say. The crop is in the source's own pixels.
 */
export function normaliseSourceLayer(c) {
  const crop = (v) => bounded(v, 0, 4000, 0);
  return {
    source: String(c?.source ?? '').trim().slice(0, 256),
    fit: SOURCE_FITS.includes(c?.fit) ? c.fit : 'fit',
    cropTop: crop(c?.cropTop),
    cropRight: crop(c?.cropRight),
    cropBottom: crop(c?.cropBottom),
    cropLeft: crop(c?.cropLeft),
  };
}

/*
  What the screens get: the settings — `transition` is how a switch happens,
  cut or cover — and `moving`, the wipe in progress if there is one, which
  the overlay draws. Kept apart by name so the one can never be read as the
  other.
*/
export function getOmnilayer() {
  return { ...(db?.get() ?? DEFAULT), moving: transition, problems };
}

/**
 * The layout this mode has on stream, or null: off, or OBS on another scene
 * (one of the old bound ones, a BRB scene of its own) — then what is on
 * stream is not this mode's to change from an action that was not asked to.
 */
export function onAir() {
  const s = db?.get();
  if (!s?.enabled || !s.live) return null;
  const now = obs?.currentScene?.() || '';
  if (s.scene && now && now !== s.scene) return null;
  return layoutsNow().find((l) => l.id === s.live) || null;
}

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'omnilayer', value: getOmnilayer() });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** True when `promise` settles within `ms`, false when the time ran out first. Its timer never outlives it. */
function within(promise, ms) {
  let timer;
  return Promise.race([
    promise.then(() => true, () => true),
    new Promise((r) => { timer = setTimeout(() => r(false), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/*
  The wipe as the overlay is told it. `id` tells one switch from the next, so
  an overlay that gave up on one cover still draws the next; `maxMs` is the
  longest this one can keep the screen covered, after which the overlay lifts
  it whether or not the server has said so.
*/
function wipe(phase, id, layoutId, from, s) {
  const maxMs = s.coverMs + TIMING.settleMs + TIMING.placeDeadlineMs + s.holdMs + TIMING.spareMs;
  return { phase, id, to: layoutId, from, coverMs: s.coverMs, maxMs };
}

export function initOmnilayer({ obsService, layouts }) {
  obs = obsService || null;
  layoutsNow = layouts || (() => []);
  db = collection('omnilayer', DEFAULT);
  db.set(cleanOmnilayer(db.get()));

  // OBS coming back — started late, restarted — gets the live layout's places again.
  bus.on(EVENTS.STATUS, (s) => {
    if (s?.platform === 'obs' && s.status === 'connected' && !s.scenes && db.get().enabled) schedulePlace(400);
  });
}

/**
 * Change the settings. Turning it on with nothing live yet makes the first
 * layout live.
 *
 * Turning it on, or naming another scene, gets that scene's sources into
 * place but leaves OBS showing whatever it is showing: this is set up from
 * the Layouts screen, possibly mid-stream, and "Go live" is the moment the
 * stream changes — not the flick of a setting.
 */
export function configure(patch) {
  const prev = db.get();
  const next = cleanOmnilayer(patch, prev);
  if (next.enabled && !next.live) next.live = layoutsNow()[0]?.id || '';
  db.set(next);
  publish();
  if (next.enabled && (!prev.enabled || next.scene !== prev.scene)) schedulePlace(0);
  return getOmnilayer();
}

/**
 * Put a layout on stream.
 *
 * `transition` overrides the setting for this one switch ('cut' or 'cover').
 * Going live with the layout already live puts its sources back where they
 * belong, with no wipe: nothing is changing on screen to cover.
 *
 * This is the one thing that switches OBS to the Omnilayer scene. Every other
 * placing — after an edit, after OBS reconnects — arranges that scene and
 * leaves OBS on whichever scene the streamer is on, which may be one of their
 * old, bound ones.
 */
export async function goLive(layoutId, { transition: how } = {}) {
  const s = db.get();
  if (!s.enabled) throw refusal('omnilayer_off', 'Omnilayer is off');
  const layout = layoutsNow().find((l) => l.id === layoutId);
  if (!layout) throw refusal('no_layout', 'there is no layout like that');

  seq += 1;
  const mine = seq;
  const style = OMNI_TRANSITIONS.includes(how) ? how : s.transition;
  if (style === 'cut' || (s.live === layout.id && !transition)) {
    transition = null;
    await apply(layout, s.live, { takeScene: true });
    publish();
    return getOmnilayer();
  }

  /*
    From here the screen is covered, so every way out of this function
    except a newer switch taking over must uncover it. Nothing below waits on
    OBS without a deadline, and nothing that fails stops the reveal.
  */
  const from = s.live;
  transition = wipe('cover', mine, layout.id, from, s);
  publish();
  await wait(s.coverMs + TIMING.settleMs);
  if (mine !== seq) return getOmnilayer();

  // Deleted, or swapped out by a profile, while the wipe was arriving: there is nothing to put live.
  if (layoutsNow().some((l) => l.id === layout.id)) {
    const placing = apply(layout, from, { takeScene: true })
      .catch((err) => log.warn(`going live with ${layout.name}: ${err.message}`));
    if (!(await within(placing, TIMING.placeDeadlineMs))) {
      problems = [...problems.filter((p) => p.code !== 'obs_slow'), { code: 'obs_slow' }];
      log.warn(`OBS took longer than ${TIMING.placeDeadlineMs} ms to place ${layout.name}; uncovering anyway`);
    }
  }
  await wait(s.holdMs);
  if (mine !== seq) return getOmnilayer();

  transition = wipe('reveal', mine, layout.id, from, s);
  publish();
  await wait(s.coverMs);
  if (mine !== seq) return getOmnilayer();

  transition = null;
  publish();
  return getOmnilayer();
}

/** Stored as live and announced to the screens and to actions — the part of going live that cannot wait on OBS. */
function makeLive(layout, from) {
  const changed = db.get().live !== layout.id;
  db.set({ ...db.get(), live: layout.id });
  publish();
  if (changed) announce(layout, layoutsNow().find((l) => l.id === from) || null, from);
}

/** The layout_changed trigger, with which layout it was and which it replaced. */
function announce(layout, previous, fromId = previous?.id) {
  bus.emit(EVENTS.EVENT, normaliseEvent({
    type: 'layout_changed',
    platform: 'system',
    user: layout.name,
    // Its type too, so an action set off by "BRB went live" works in every profile.
    data: { layoutId: layout.id, name: layout.name, from: previous?.name || '', fromId: fromId || '', sceneType: layout.sceneType || '' },
  }));
  log.info(`live: ${layout.name}`);
}

/** The layout goes live: stored, announced, and its sources placed. */
async function apply(layout, from, { takeScene = false } = {}) {
  makeLive(layout, from);
  await place(layout, { takeScene });
}

/**
 * Every source some layout has a slot for: the ones this mode looks after —
 * by the name in the slot and by the source it stands for now, so the one
 * not being placed is hidden either way.
 */
export function managedSources(layouts, alias = (name) => name, every = (name) => [alias(name)]) {
  const names = new Set();
  for (const l of layouts || []) for (const y of l.layers || []) {
    if (y.type === 'source' && y.config?.source) {
      if (!STAND_INS.has(y.config.source)) names.add(y.config.source);
      names.add(alias(y.config.source));
      for (const name of every(y.config.source)) names.add(name);
    }
  }
  return [...names].filter((name) => name && !STAND_INS.has(name));
}

/**
 * Where each source goes for a layout, in OBS's own pixels: the slot's box
 * scaled from the layout's canvas to OBS's. Sources with no visible slot are
 * listed to be hidden.
 */
export function placements(layout, layouts, video, alias = (name) => name, every = (name) => [alias(name)]) {
  const kx = (video?.width || layout.width) / layout.width;
  const ky = (video?.height || layout.height) / layout.height;
  const slots = (layout.layers || []).filter((y) => y.type === 'source' && y.visible !== false && y.config?.source);
  const shown = new Set();
  const place = [];
  for (const y of slots) {
    const source = alias(y.config.source);
    // One place per source: a second slot for the same one would fight the first.
    if (shown.has(source)) continue;
    shown.add(source);
    place.push({
      source,
      x: Math.round(y.x * kx), y: Math.round(y.y * ky),
      width: Math.max(1, Math.round(y.width * kx)), height: Math.max(1, Math.round(y.height * ky)),
      fit: y.config.fit || 'fit',
      crop: { top: y.config.cropTop || 0, right: y.config.cropRight || 0, bottom: y.config.cropBottom || 0, left: y.config.cropLeft || 0 },
    });
  }
  const hide = managedSources(layouts, alias, every).filter((name) => !shown.has(name));
  return { place, hide };
}

/**
 * Move OBS's sources to where the layout wants them. What cannot be done is
 * kept to say. `takeScene` also puts OBS on the Omnilayer scene — for going
 * live only (see goLive).
 */
async function place(layout, { takeScene = false } = {}) {
  if (!obs?.placeSource) return;
  const s = db.get();
  const found = [];
  if (obs.isConnected && !obs.isConnected()) {
    problems = [{ code: 'obs_offline' }];
    publish();
    return;
  }
  const scene = s.scene || obs.currentScene?.() || '';
  if (!scene) {
    problems = [{ code: 'no_scene' }];
    publish();
    return;
  }
  // Going live means this scene is what is on stream.
  if (takeScene) {
    try {
      if (obs.currentScene && obs.currentScene() && obs.currentScene() !== scene) await obs.setScene(scene);
    } catch (err) {
      found.push({ code: 'scene_missing', scene, message: err.message });
    }
  }
  let video = null;
  try { video = await obs.videoSize?.(); } catch { /* the layout's own size, then */ }
  const { place: go, hide: stillManaged } = placements(layout, layoutsNow(), video, sourceFor, everySourceFor);
  const leaving = [...released].filter((name) => !go.some((p) => p.source === name));
  const hide = [...stillManaged, ...leaving];
  for (const p of go) {
    try {
      await obs.placeSource(scene, p.source, p);
    } catch (err) {
      found.push({ code: 'source_missing', source: p.source, scene, message: err.message });
    }
  }
  for (const name of hide) {
    try {
      await obs.setSourceVisible(scene, name, false);
      released.delete(name);
    } catch (err) {
      // One that is not in the scene any more has nothing left to hide, and is not worth a warning.
      if (released.delete(name)) continue;
      found.push({ code: 'source_missing', source: name, scene, message: err.message });
    }
  }
  problems = found;
  if (found.length) log.warn(`placing ${layout.name}: ${found.map((f) => f.source || f.scene).join(', ')} could not be placed`);
  publish();
}

/**
 * Place the live layout's sources again, shortly — after an edit or OBS
 * coming back. Never the scene: see goLive. A wipe in progress is placing
 * already, so this waits for it to finish rather than moving things under it.
 */
function schedulePlace(ms) {
  clearTimeout(placeTimer);
  placeTimer = setTimeout(() => {
    if (transition) return schedulePlace(200);
    const s = db.get();
    const layout = s.enabled && layoutsNow().find((l) => l.id === s.live);
    if (layout) place(layout).catch((err) => log.debug(`could not place: ${err.message}`));
  }, ms);
}

/**
 * What goes live when the live layout is gone — deleted in the editor, or
 * swapped out with the rest of its overlay profile.
 *
 * Its scene type says what a layout is for, so switching profile on the BRB
 * layout lands on the new profile's BRB. Without one, the OBS scene names
 * the profiles each bind their own layouts to ("Gameplay", "BRB"…) say
 * much the same. Then a layout of the same name, then the first.
 */
export function successor(gone, layouts) {
  const list = Array.isArray(layouts) ? layouts : [];
  const scenes = Array.isArray(gone?.scenes) ? gone.scenes : [];
  return (gone?.sceneType ? layoutOfType(list, gone.sceneType) : null)
    || list.find((l) => Array.isArray(l.scenes) && l.scenes.some((sc) => scenes.includes(sc)))
    || (gone?.name ? list.find((l) => l.name === gone.name) : null)
    || list[0]
    || null;
}

/**
 * The layouts were saved. If the live one's slots moved — somebody dragging
 * the game's box in the editor — OBS follows, so the editor is also where
 * the scene is arranged.
 *
 * If the live one is gone, its successor takes over at once, with no wipe:
 * the new layouts are already on every screen, so there is no moment left to
 * cover. The new live id is stored before this returns, so whatever the
 * caller sends next carries it alongside the layouts it belongs to (the
 * editor's save sends both in one patch, a profile switch a whole snapshot);
 * no screen ever holds the new list with the old id and draws the wrong
 * layout for a frame. Telling everyone else waits until that has gone out.
 */
export function layoutsSaved(before, after) {
  const s = db?.get();
  if (!s?.enabled) return;
  const managedNow = managedSources(after, sourceFor);
  for (const name of managedSources(before, sourceFor)) if (!managedNow.includes(name)) released.add(name);
  for (const name of managedNow) released.delete(name);
  if (s.live && !(after || []).some((l) => l.id === s.live)) {
    const gone = (before || []).find((l) => l.id === s.live) || null;
    const next = successor(gone, after);
    db.set({ ...s, live: next?.id || '' });
    setImmediate(() => {
      publish();
      if (next) announce(next, gone, s.live);
    });
    if (next) schedulePlace(150);
    return;
  }
  const slots = (list) => JSON.stringify((list || []).map((l) => [l.id, (l.layers || []).filter((y) => y.type === 'source').map((y) => [y.x, y.y, y.width, y.height, y.visible, y.config])]));
  if (released.size || slots(before) !== slots(after)) schedulePlace(150);
}

/**
 * Put on stream whichever layout fills a scene type in the overlay profile
 * that is on — what a command naming a type does, so it means the same in
 * every profile. A profile with no layout of that type changes nothing on
 * stream, and says so where the switching problems are shown.
 */
export async function goLiveType(typeId, opts = {}) {
  const s = db.get();
  if (!s.enabled) throw refusal('omnilayer_off', 'Omnilayer is off');
  const layout = layoutOfType(layoutsNow(), typeId);
  if (!layout) {
    const name = s.types.find((t) => t.id === typeId)?.name || typeId;
    problems = [...problems.filter((p) => p.code !== 'no_type_layout'), { code: 'no_type_layout', type: name }];
    publish();
    throw refusal('no_type_layout', `no layout in this profile is a "${name}"`);
  }
  return goLive(layout.id, opts);
}

/** Ask OBS what the scene holds, top first, for the screen's setup check. */
export async function inspect() {
  const s = db.get();
  const scene = s.scene || obs?.currentScene?.() || '';
  if (!obs?.sceneSources || !scene) return { scene, items: [] };
  try {
    return { scene, items: await obs.sceneSources(scene) };
  } catch (err) {
    return { scene, items: [], error: err.message };
  }
}

/** Every way the screens and steps change it. */
export async function control(payload) {
  const op = payload?.op;
  if (op === 'set') return configure(payload.settings);
  if (op === 'go') {
    return payload?.sceneType
      ? goLiveType(String(payload.sceneType), { transition: payload.transition })
      : goLive(payload.layoutId, { transition: payload.transition });
  }
  if (op === 'inspect') return inspect();
  throw refusal('bad_request', `omnilayer: unknown operation "${op}"`);
}

export function stopOmnilayer() {
  clearTimeout(placeTimer);
}
