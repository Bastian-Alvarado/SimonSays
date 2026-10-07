/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * OBS Studio via obs-websocket v5.
 *
 * Moving this out of the browser fixes a real V2 bug as a side effect: a page
 * served over HTTPS cannot open a `ws://localhost` socket, which is why V2 had
 * a whole "insecure context" modal explaining the failure. The server has no
 * such restriction.
 *
 * Scene-item lookups are cached per (scene, source) because obs-websocket
 * requires resolving a numeric `sceneItemId` before most item operations, and
 * doing that on every step would double the round-trips.
 */

import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';
import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { config } from '../config.js';

const log = createLogger('obs');

let obs = null;
let creds = null;
let status = 'disconnected';
let lastError = null;
let reconnectTimer = null;
let connectFailures = 0;

/*
  Whether anyone still wants a connection.

  disconnect() clears the retry timer, but it cannot cancel a connect that is
  already in flight, and a connect that is timing out rather than being refused
  can hang for a long time. When it finally failed, its own failure path
  scheduled a fresh retry — so pressing stop on a connection to an address that
  swallows packets put the status back to "connecting" a moment later, and
  there was no way out of it at all.

  Every retry now asks this first, so stopping means stopped.
*/
let wanted = false;

/*
  Every input's level, twenty times a second, for the PNGtuber microphone
  (engine/pngtuber.js). A high-volume event OBS only sends when asked, so it
  is asked for only while a microphone is chosen.
*/
let metersWanted = false;
const subscriptions = () => EventSubscription.All | (metersWanted ? EventSubscription.InputVolumeMeters : 0);

export function setMetersWanted(on) {
  if (metersWanted === Boolean(on)) return;
  metersWanted = Boolean(on);
  if (obs && status === 'connected') {
    obs.reidentify({ eventSubscriptions: subscriptions() }).catch((err) => log.debug(`could not change subscriptions: ${err.message}`));
  }
}

/**
 * Mirrors the shape the UI reads: `obsData.scenes[].sceneName`,
 * `obsData.sources[].inputName/.inputKind`, `obsData.currentScene`,
 * `obsData.obsVersion`, `obsData.streamStatus.active`,
 * `obsData.recordingStatus.active`.
 *
 * These are raw obs-websocket shapes on purpose — flattening scenes to plain
 * strings previously produced empty dropdowns, and omitting streamStatus /
 * recordingStatus crashed the Connections screen outright.
 */
const emptyState = () => ({
  scenes: [],
  sources: [],
  currentScene: '',
  obsVersion: '',
  streamStatus: { active: false },
  recordingStatus: { active: false },
});

let obsState = emptyState();

const itemIdCache = new Map(); // `${scene}\u0000${source}` -> number

export function initObs() {
  creds = collection('obs_credentials', {
    host: config.obs.host,
    port: config.obs.port,
    password: config.obs.password,
  });
  if (config.autoStart && config.obs.autoConnect) {
    connect().catch(() => { /* reported via status */ });
  }
}

function setStatus(next, error = null) {
  status = next;
  lastError = error;
  bus.emit(EVENTS.STATUS, { platform: 'obs', status, error: error?.message ?? null });
}

export const getStatus = () => ({ status, error: lastError?.message ?? null, ...obsState });
export const getCredentials = () => {
  const c = creds.get();
  return { host: c.host, port: c.port, hasPassword: Boolean(c.password) };
};
export const setCredentials = (patch) => creds.set({ ...creds.get(), ...patch });

export async function connect() {
  await disconnect();
  // disconnect() clears this; asking to connect is what sets it again.
  wanted = true;
  const c = creds.get();

  obs = new OBSWebSocket();
  setStatus('connecting');

  try {
    await obs.connect(`ws://${c.host}:${c.port}`, c.password || undefined, { eventSubscriptions: subscriptions() });
    // Stopped while this was in flight: nobody wants what just arrived.
    if (!wanted) { await disconnect(); return; }
    setStatus('connected');
    connectFailures = 0;
    log.info(`connected to ${c.host}:${c.port}`);

    wireEvents();
    await refreshState();
  } catch (err) {
    /*
      Stopped while this was in flight.

      A connect that is timing out fails long after the person gave up on it,
      and letting that failure set the status would report an error for
      something they cancelled on purpose — over the top of the disconnected
      status they asked for.
    */
    if (!wanted) throw err;
    setStatus('error', err);

    // obs-websocket often throws with an empty `message`, which produced the
    // useless "connect failed: " line in V3's first cut. Fall back to the
    // error code so the log actually says something.
    const why = err.message || err.code || 'OBS is not reachable (is it running with the WebSocket server enabled?)';

    // OBS simply not being open is the normal case, not an emergency. Say it
    // once, then drop to debug so the log isn't a wall of red every 15s.
    if (connectFailures === 0) log.warn(`not connected — ${why}. Will keep retrying quietly.`);
    else log.debug(`reconnect attempt ${connectFailures} failed: ${why}`);
    connectFailures += 1;

    scheduleReconnect();
    throw err;
  }
}

export async function disconnect() {
  wanted = false;
  clearTimeout(reconnectTimer);
  itemIdCache.clear();
  videoCache = null;
  obsState = emptyState();
  if (obs) {
    obs.removeAllListeners();
    try { await obs.disconnect(); } catch { /* already down */ }
    obs = null;
  }
  setStatus('disconnected');
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  // Asked to stop, by someone who could not cancel the attempt in flight.
  if (!wanted) return;
  // Back off from 15s toward 2min so a machine without OBS installed isn't
  // reconnecting forever at full rate.
  const delay = Math.min(15_000 * Math.max(1, connectFailures), 120_000);
  reconnectTimer = setTimeout(() => connect().catch(() => {}), delay);
}

function wireEvents() {
  obs.on('InputVolumeMeters', ({ inputs }) => bus.emit('obs:meters', inputs));

  obs.on('ConnectionClosed', () => {
    log.warn('connection closed');
    setStatus('disconnected');
    itemIdCache.clear();
    videoCache = null;
    scheduleReconnect();
  });

  obs.on('CurrentProgramSceneChanged', ({ sceneName }) => {
    obsState.currentScene = sceneName;
    bus.emit(EVENTS.STATUS, { platform: 'obs', status, error: null, ...obsState });
    // V2 convention: the scene name travels in the `user` field.
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: 'obs_scene_changed', platform: 'obs', user: sceneName, data: { sceneName },
    }));
  });

  obs.on('StreamStateChanged', ({ outputActive }) => {
    obsState.streamStatus = { active: Boolean(outputActive) };
    bus.emit(EVENTS.STATUS, { platform: 'obs', status, error: null, ...obsState });
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: outputActive ? 'obs_stream_started' : 'obs_stream_stopped',
      platform: 'obs', user: 'OBS', data: {},
    }));
  });

  obs.on('RecordStateChanged', ({ outputActive }) => {
    obsState.recordingStatus = { active: Boolean(outputActive) };
    bus.emit(EVENTS.STATUS, { platform: 'obs', status, error: null, ...obsState });
    bus.emit(EVENTS.EVENT, normaliseEvent({
      type: outputActive ? 'obs_recording_started' : 'obs_recording_stopped',
      platform: 'obs', user: 'OBS', data: {},
    }));
  });

  obs.on('SceneItemCreated', () => itemIdCache.clear());
  obs.on('SceneItemRemoved', () => itemIdCache.clear());
  obs.on('SceneListChanged', () => { itemIdCache.clear(); refreshState().catch(() => {}); });
  obs.on('InputCreated', () => refreshState().catch(() => {}));
  obs.on('InputRemoved', () => refreshState().catch(() => {}));
}

/** Pull everything the UI renders. Each call is independent so one failure
 *  (e.g. no replay buffer configured) does not blank the rest. */
async function refreshState() {
  const next = emptyState();

  const results = await Promise.allSettled([
    obs.call('GetSceneList'),
    obs.call('GetInputList'),
    obs.call('GetVersion'),
    obs.call('GetStreamStatus'),
    obs.call('GetRecordStatus'),
  ]);

  const [scenes, inputs, version, stream, record] = results;

  if (scenes.status === 'fulfilled') {
    next.scenes = scenes.value.scenes ?? [];
    next.currentScene = scenes.value.currentProgramSceneName ?? '';
  }
  if (inputs.status === 'fulfilled') next.sources = inputs.value.inputs ?? [];
  if (version.status === 'fulfilled') next.obsVersion = version.value.obsVersion ?? '';
  if (stream.status === 'fulfilled') next.streamStatus = { active: Boolean(stream.value.outputActive) };
  if (record.status === 'fulfilled') next.recordingStatus = { active: Boolean(record.value.outputActive) };

  for (const r of results) {
    if (r.status === 'rejected') log.debug('OBS state query failed:', r.reason?.message);
  }

  obsState = next;
  bus.emit(EVENTS.STATUS, { platform: 'obs', status, error: null, ...obsState });
}

function ensure() {
  if (!obs || status !== 'connected') throw new Error('OBS is not connected');
  return obs;
}

async function itemId(sceneName, sourceName) {
  const key = `${sceneName}\u0000${sourceName}`;
  if (itemIdCache.has(key)) return itemIdCache.get(key);

  const { sceneItemId } = await ensure().call('GetSceneItemId', { sceneName, sourceName });
  itemIdCache.set(key, sceneItemId);
  return sceneItemId;
}

// ------------------------------------------------------------------ actions

export async function setScene(sceneName) {
  await ensure().call('SetCurrentProgramScene', { sceneName });
}

/*
  The scene a step names, or the one on air when it names none. A Show/Hide
  step's editor never had a scene to pick, so every one was saved without
  one and OBS refused to find the source; and with Omnilayer the scene on air
  is the one there is.
*/
async function sceneOrOnAir(sceneName) {
  if (sceneName) return sceneName;
  if (obsState.currentScene) return obsState.currentScene;
  const { currentProgramSceneName } = await ensure().call('GetCurrentProgramScene');
  return currentProgramSceneName;
}

export async function setSourceVisible(sceneName, sourceName, visible) {
  const scene = await sceneOrOnAir(sceneName);
  const id = await itemId(scene, sourceName);
  await ensure().call('SetSceneItemEnabled', { sceneName: scene, sceneItemId: id, sceneItemEnabled: visible });
}

/*
  The toggles: one press turns it on, the next turns it off — a !blur that
  blurs and unblurs, instead of a command for each. Each asks OBS where it is
  now rather than remembering, because a scene change, another action or a
  click in OBS may have moved it since. Each answers what it is now.
*/
export async function toggleSourceVisible(sceneName, sourceName) {
  const scene = await sceneOrOnAir(sceneName);
  const id = await itemId(scene, sourceName);
  const o = ensure();
  const { sceneItemEnabled } = await o.call('GetSceneItemEnabled', { sceneName: scene, sceneItemId: id });
  await o.call('SetSceneItemEnabled', { sceneName: scene, sceneItemId: id, sceneItemEnabled: !sceneItemEnabled });
  return !sceneItemEnabled;
}

export async function toggleFilter(sourceName, filterName) {
  const o = ensure();
  const { filterEnabled } = await o.call('GetSourceFilter', { sourceName, filterName });
  await o.call('SetSourceFilterEnabled', { sourceName, filterName, filterEnabled: !filterEnabled });
  return !filterEnabled;
}

/** OBS has a toggle of its own for this one, which answers what it is now. */
export async function toggleMuted(inputName) {
  const { inputMuted } = await ensure().call('ToggleInputMute', { inputName });
  return inputMuted;
}

export async function setText(inputName, text) {
  await ensure().call('SetInputSettings', { inputName, inputSettings: { text: String(text ?? '') } });
}

export async function setFilterEnabled(sourceName, filterName, filterEnabled) {
  await ensure().call('SetSourceFilterEnabled', { sourceName, filterName, filterEnabled });
}

export async function setVolumeDb(inputName, inputVolumeDb) {
  await ensure().call('SetInputVolume', { inputName, inputVolumeDb });
}

export async function setMuted(inputName, inputMuted) {
  await ensure().call('SetInputMute', { inputName, inputMuted });
}

export async function saveReplayBuffer() {
  await ensure().call('SaveReplayBuffer');
}

/**
 * End the stream, if one is going. Answers whether it stopped one.
 *
 * Asked of OBS rather than read from the state kept here, which is only as
 * fresh as the last event OBS sent. And nothing to stop is not a failure: a
 * "goodnight" command said twice, or after the stream already ended, should
 * simply do nothing — OBS itself would refuse it with an error.
 */
export async function stopStream() {
  const o = ensure();
  const { outputActive } = await o.call('GetStreamStatus');
  if (!outputActive) return false;
  await o.call('StopStream');
  return true;
}

export async function setBrowserUrl(inputName, url) {
  await ensure().call('SetInputSettings', { inputName, inputSettings: { url } });
}

export async function setTransform(sceneName, sourceName, { positionX, positionY, scale, rotation }) {
  const id = await itemId(sceneName, sourceName);
  const sceneItemTransform = {};
  if (positionX !== undefined) sceneItemTransform.positionX = Number(positionX);
  if (positionY !== undefined) sceneItemTransform.positionY = Number(positionY);
  if (rotation !== undefined) sceneItemTransform.rotation = Number(rotation);
  if (scale !== undefined) {
    sceneItemTransform.scaleX = Number(scale);
    sceneItemTransform.scaleY = Number(scale);
  }
  if (Object.keys(sceneItemTransform).length === 0) return;
  await ensure().call('SetSceneItemTransform', { sceneName, sceneItemId: id, sceneItemTransform });
}

// ------------------------------------------------------------------ omnilayer

/*
  OBS's own canvas, which a layout's pixels are scaled to: a layout is drawn
  at 1920x1080 and OBS may be running at 1280x720. Asked once a connection.
*/
let videoCache = null;

export async function videoSize() {
  if (videoCache) return videoCache;
  const v = await ensure().call('GetVideoSettings');
  videoCache = { width: v.baseWidth, height: v.baseHeight };
  return videoCache;
}

/*
  OBS's alignment flags: left 1, right 2, top 4, bottom 8, none for centre.
  A slot is a box from its top left; the picture sits in its middle.
*/
const TOP_LEFT = 5;
const CENTRE = 0;

/**
 * Put a source in a box and show it: at the box's top left, scaled to fit
 * inside it (or stretched to it), with its edges cropped first. Bounds
 * rather than a scale, so the size is the box's whatever the source's own
 * resolution is — a game capture that changes resolution mid-stream still
 * fills the same box.
 */
export async function placeSource(sceneName, sourceName, { x, y, width, height, fit = 'fit', crop = {} }) {
  const id = await itemId(sceneName, sourceName);
  await ensure().call('SetSceneItemTransform', {
    sceneName,
    sceneItemId: id,
    sceneItemTransform: {
      positionX: Number(x) || 0,
      positionY: Number(y) || 0,
      rotation: 0,
      alignment: TOP_LEFT,
      boundsType: fit === 'stretch' ? 'OBS_BOUNDS_STRETCH' : 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: CENTRE,
      boundsWidth: Math.max(1, Number(width) || 1),
      boundsHeight: Math.max(1, Number(height) || 1),
      cropTop: Number(crop.top) || 0,
      cropRight: Number(crop.right) || 0,
      cropBottom: Number(crop.bottom) || 0,
      cropLeft: Number(crop.left) || 0,
    },
  });
  await ensure().call('SetSceneItemEnabled', { sceneName, sceneItemId: id, sceneItemEnabled: true });
}

// ------------------------------------------------------------------ remote players

const BROWSER = 'browser_source';
const NOT_FOUND = 600;

/*
  A browser source's page and size. Its sound goes through OBS, so it can be
  muted there, and it keeps running while hidden, so a remote player stays
  connected while their layout is not the one on stream.
*/
const browserSettings = ({ url, width, height }) => ({
  url: String(url),
  width: Math.max(1, Math.round(Number(width) || 1280)),
  height: Math.max(1, Math.round(Number(height) || 720)),
  reroute_audio: true,
  shutdown: false,
  restart_when_active: false,
});

/** A browser source pointed at a page, at a size. */
export async function setBrowserSettings(inputName, settings) {
  await ensure().call('SetInputSettings', { inputName, inputSettings: browserSettings(settings) });
}

/**
 * A browser source in a scene, made if it is not there; one already there is
 * pointed at the page. A new one goes to the bottom of the scene, under the
 * overlay, hidden until a layout places it.
 *
 * A source by that name that is something else is left alone: 'other_kind'.
 */
export async function ensureBrowserSource(sceneName, inputName, settings) {
  const o = ensure();
  const inputSettings = browserSettings(settings);
  let kind = null;
  try {
    ({ inputKind: kind } = await o.call('GetInputSettings', { inputName }));
  } catch (err) {
    if (err?.code !== NOT_FOUND) throw err;
  }
  if (kind && kind !== BROWSER) return { done: 'other_kind', kind };

  if (!kind) {
    const { sceneItemId } = await o.call('CreateInput', { sceneName, inputName, inputKind: BROWSER, inputSettings, sceneItemEnabled: false });
    await o.call('SetSceneItemIndex', { sceneName, sceneItemId, sceneItemIndex: 0 });
    return { done: 'created' };
  }
  await o.call('SetInputSettings', { inputName, inputSettings });
  try {
    await itemId(sceneName, inputName);
    return { done: 'updated' };
  } catch (err) {
    if (err?.code !== NOT_FOUND) throw err;
  }
  // In OBS, but not in this scene.
  const { sceneItemId } = await o.call('CreateSceneItem', { sceneName, sourceName: inputName, sceneItemEnabled: false });
  await o.call('SetSceneItemIndex', { sceneName, sceneItemId, sceneItemIndex: 0 });
  return { done: 'added' };
}

/** Whether an input is muted in OBS. */
export async function inputMuted(inputName) {
  const { inputMuted: on } = await ensure().call('GetInputMute', { inputName });
  return Boolean(on);
}

/** A browser source's page loaded again, as its "Refresh cache of current page" button does. */
export async function reloadBrowser(inputName) {
  await ensure().call('PressInputPropertiesButton', { inputName, propertyName: 'refreshnocache' });
}

/** What a scene holds, top of the stack first, for the setup check. */
export async function sceneSources(sceneName) {
  const { sceneItems } = await ensure().call('GetSceneItemList', { sceneName });
  return (sceneItems || [])
    .slice()
    .sort((a, b) => b.sceneItemIndex - a.sceneItemIndex)
    .map((i) => ({ name: i.sourceName, kind: i.inputKind || '', enabled: Boolean(i.sceneItemEnabled) }));
}

export const currentScene = () => obsState.currentScene || '';
export const isConnected = () => status === 'connected';

export const service = {
  setScene, setSourceVisible, setText, setFilterEnabled,
  toggleSourceVisible, toggleFilter, toggleMuted,
  setVolumeDb, setMuted, saveReplayBuffer, stopStream, setBrowserUrl, setTransform, setMetersWanted,
  placeSource, videoSize, sceneSources, currentScene, isConnected,
  setBrowserSettings, ensureBrowserSource, inputMuted, reloadBrowser,
  // Whether OBS is sending the stream: what a repeating action waits for when Twitch cannot say.
  isStreaming: () => Boolean(obsState.streamStatus?.active),
};
