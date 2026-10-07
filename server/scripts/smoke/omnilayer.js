/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Omnilayer — one OBS scene, layouts that place its sources,
 * and switching between them with a cut or behind a wipe.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, EVENTS, chat, doubles, engine, fs, obsCalls, said, scenes, settle, test } from './harness.js';
import { mod, runCommand } from './chat-steps.js';

const omni = await import('../../engine/omnilayer.js');
const { normaliseLayouts } = await import('../../engine/layouts.js');
const { liveLayout } = await import('../../../shared/live-layout.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const store = engine.store;

// ------------------------------------------------------------ the pieces

test('a source slot keeps which source, how it fits and its crop, and a layout may hold several', () => {
  const [l] = normaliseLayouts([{ id: 'x', layers: [
    { type: 'source', x: 24, y: 24, width: 1296, height: 729, config: { source: ' Game Capture ', fit: 'stretch', cropTop: 12, cropLeft: -5 } },
    { type: 'source', config: { source: 'Camera', fit: 'sideways' } },
  ] }]);
  assert.equal(l.layers.length, 2, 'a second slot was dropped');
  assert.deepEqual(l.layers[0].config, { source: 'Game Capture', fit: 'stretch', cropTop: 12, cropRight: 0, cropBottom: 0, cropLeft: 0 });
  assert.equal(l.layers[1].config.fit, 'fit', 'a fit that is not one was kept');
  assert.deepEqual([l.layers[1].width, l.layers[1].height], [1920, 1080], 'a new slot is not the whole canvas');
});

test('the settings are held to what they can be', () => {
  const c = omni.cleanOmnilayer({ enabled: 'yes', transition: 'dissolve', coverMs: 99999, holdMs: -3, scene: '  Omni  ' });
  assert.deepEqual([c.enabled, c.transition, c.coverMs, c.holdMs, c.scene], [false, 'cover', 3000, 0, 'Omni']);
});

const game = (x, y, w, h, extra = {}) => ({ type: 'source', uid: `g${x}${y}`, x, y, width: w, height: h, visible: true, config: { source: 'Game', fit: 'fit', ...extra } });
const cam = (x, y, w, h, visible = true) => ({ type: 'source', uid: `c${x}${y}`, x, y, width: w, height: h, visible, config: { source: 'Cam' } });
const L169 = { id: 'om-169', name: 'Game 16:9', width: 1920, height: 1080, scenes: [], layers: [game(24, 24, 1296, 729), cam(1344, 24, 552, 310)] };
const LBRB = { id: 'om-brb', name: 'BRB', width: 1920, height: 1080, scenes: [], layers: [{ type: 'text', uid: 't1', x: 0, y: 0, width: 400, height: 100, visible: true, config: { text: 'Vuelvo' } }] };
const LFULL = { id: 'om-full', name: 'Fullscreen', width: 1920, height: 1080, scenes: [], layers: [game(0, 0, 1920, 1080), cam(1500, 700, 380, 214, false)] };

test('where each source goes is its box scaled to OBS’s own canvas, and what has no box is hidden', () => {
  const all = [L169, LBRB, LFULL];
  const at720 = omni.placements(L169, all, { width: 1280, height: 720 });
  assert.deepEqual(at720.place.map((p) => [p.source, p.x, p.y, p.width, p.height]), [['Game', 16, 16, 864, 486], ['Cam', 896, 16, 368, 207]]);
  assert.deepEqual(at720.hide, []);
  assert.deepEqual(omni.placements(LBRB, all, null).hide.sort(), ['Cam', 'Game']);
  assert.deepEqual(omni.placements(LFULL, all, null).hide, ['Cam'], 'a slot switched off should hide its source');
});

// --------------------------------------------------------------- switching

const layoutsBefore = structuredClone(store.getLayouts?.() ?? engine.snapshot().layouts);
store.setLayouts([L169, LBRB, LFULL]);
let refusedOff = null;
try { await store.omnilayer({ op: 'go', layoutId: 'om-169' }); } catch (err) { refusedOff = err.code; }

doubles.obsScene = 'Gameplay';
const scenesBeforeOn = scenes.length;
obsCalls.length = 0;
const turnedOn = await store.omnilayer({ op: 'set', settings: { enabled: true, scene: 'Omnilayer', transition: 'cut' } });
await wait(60);
const readiedOn = obsCalls.filter((c) => c[0] === 'place').map((c) => c[1]);
const sceneAfterOn = [scenes.length - scenesBeforeOn, doubles.obsScene];

const changes = [];
bus.on(EVENTS.EVENT, (e) => { if (e.type === 'layout_changed') changes.push([e.data.from, e.data.name]); });
store.saveAction({
  id: 'act-om-brb', name: 'on BRB', enabled: true,
  trigger: { id: 't-om', category: 'system', type: 'layout_changed', config: { layoutId: 'om-brb' } },
  actions: [{ id: 's-om', type: 'twitch_chat', config: { message: 'Pausa: {event.name} (antes {event.from})' } }],
});
obsCalls.length = 0;
said.length = 0;
await store.omnilayer({ op: 'go', layoutId: 'om-169' });
const tookScene = doubles.obsScene;
const placed169 = obsCalls.filter((c) => c[0] === 'place').map((c) => [c[2], c[3].x, c[3].y, c[3].width, c[3].height, c[3].fit]);
obsCalls.length = 0;
await store.omnilayer({ op: 'go', layoutId: 'om-brb' });
await settle();
const hiddenOnBrb = obsCalls.filter((c) => c[0] === 'visible' && c[3] === false).map((c) => c[2]).sort();
const saidOnBrb = [...said];

test('it does nothing until it is turned on; on, it readies its scene and leaves OBS be, and going live takes OBS there', () => {
  assert.equal(refusedOff, 'omnilayer_off');
  assert.equal(turnedOn.live, 'om-169', 'turning it on left nothing live');
  assert.ok(readiedOn.length && readiedOn.every((sc) => sc === 'Omnilayer'), `turning it on did not get its scene ready: ${readiedOn}`);
  // A setting flicked on mid-stream must not change what the stream shows; "Go live" does that.
  assert.deepEqual(sceneAfterOn, [0, 'Gameplay'], 'turning it on switched OBS to another scene');
  assert.equal(tookScene, 'Omnilayer', 'going live left OBS on the scene it was on');
});
test('going live moves each source to its box and hides the ones the layout has none for', () => {
  assert.deepEqual(placed169, [['Game', 24, 24, 1296, 729, 'fit'], ['Cam', 1344, 24, 552, 310, 'fit']]);
  assert.deepEqual(hiddenOnBrb, ['Cam', 'Game']);
});
test('a layout going live is a trigger, for any layout or one, and says which it was and which it replaced', () => {
  assert.deepEqual(changes, [['Game 16:9', 'BRB']], JSON.stringify(changes));
  assert.ok(saidOnBrb.includes('Pausa: BRB (antes Game 16:9)'), JSON.stringify(saidOnBrb));
});

// The wipe: covered first, then the switch, then uncovered — never the switch while it can be seen.
await store.omnilayer({ op: 'set', settings: { transition: 'cover', coverMs: 150, holdMs: 100 } });
const timeline = [];
const onConfig = ({ key, value }) => { if (key === 'omnilayer') timeline.push(`${value.moving?.phase || 'none'}:${value.live}`); };
bus.on(EVENTS.CONFIG, onConfig);
obsCalls.length = 0;
const placeAt = [];
const origPush = obsCalls.push.bind(obsCalls);
obsCalls.push = (...items) => { placeAt.push(timeline.length); return origPush(...items); };
const going = store.omnilayer({ op: 'go', layoutId: 'om-169' });
await wait(60);
const midCover = timeline[timeline.length - 1];
await going;
obsCalls.push = origPush;
bus.off?.(EVENTS.CONFIG, onConfig);
const phases = timeline.map((s) => s.split(':')[0]).filter((p, i, a) => p !== a[i - 1]);
test('behind a wipe: it covers, switches while covered, then uncovers', () => {
  assert.equal(midCover, 'cover:om-brb', 'the layout changed before the screen was covered');
  assert.deepEqual(phases, ['cover', 'reveal', 'none'], phases.join(' → '));
  const coverAt = timeline.findIndex((s) => s.startsWith('cover:om-169'));
  const revealAt = timeline.findIndex((s) => s.startsWith('reveal'));
  assert.ok(coverAt >= 0 && revealAt > coverAt, timeline.join(' | '));
  assert.ok(placeAt.length && placeAt.every((i) => i > timeline.findIndex((s) => s.startsWith('cover:om-brb')) && i <= revealAt), `sources moved at ${placeAt} of ${timeline.join(' | ')}`);
});

// A source OBS does not have is said, not swallowed.
doubles.obsMissing = ['Cam'];
await store.omnilayer({ op: 'go', layoutId: 'om-169', transition: 'cut' });
const problems = omni.getOmnilayer().problems;
doubles.obsMissing = [];
test('a source that is not in the scene is reported by name', () => {
  assert.deepEqual(problems.map((p) => [p.code, p.source, p.scene]), [['source_missing', 'Cam', 'Omnilayer']]);
});

// Moving the live layout's box in the editor moves OBS's source — while the
// streamer is on one of their old, bound scenes, which it must leave them on.
doubles.obsScene = 'Old BRB';
const scenesBeforeEdit = scenes.length;
obsCalls.length = 0;
store.setLayouts([{ ...L169, layers: [game(40, 40, 1280, 720), cam(1344, 24, 552, 310)] }, LBRB, LFULL]);
await wait(300);
const followed = obsCalls.filter((c) => c[0] === 'place' && c[2] === 'Game').map((c) => [c[1], c[3].x, c[3].y, c[3].width]);
// And OBS reconnecting — a Wi-Fi blip between the phone and the PC — puts the sources back, likewise without the scene.
obsCalls.length = 0;
bus.emit(EVENTS.STATUS, { platform: 'obs', status: 'connected', error: null });
await wait(500);
const replacedOnReconnect = obsCalls.filter((c) => c[0] === 'place').map((c) => c[1]);
const sceneAfterEdits = [scenes.length - scenesBeforeEdit, doubles.obsScene];
doubles.obsScene = 'Omnilayer';
test('moving a box on the live layout moves the source in OBS, in its scene', () => {
  assert.deepEqual(followed, [['Omnilayer', 40, 40, 1280]]);
});
test('OBS coming back gets the sources put back', () => {
  assert.ok(replacedOnReconnect.length && replacedOnReconnect.every((sc) => sc === 'Omnilayer'), `${replacedOnReconnect}`);
});
test('only going live switches OBS’s scene: an edit or a reconnect leaves the streamer on the scene they are on', () => {
  assert.deepEqual(sceneAfterEdits, [0, 'Old BRB'], 'OBS was pulled off the scene it was showing');
});

// A step switches too.
runCommand('omjuego', [{ type: 'layout_switch', config: { layoutId: 'om-full', transition: 'cut' } }]);
chat('!omjuego', mod);
await wait(200);
const afterStep = omni.getOmnilayer().live;
test('the "go live with a layout" step puts it live', () => {
  assert.equal(afterStep, 'om-full');
});

// OBS stops answering mid-switch, behind the wipe. The screen must not stay black waiting for it.
const timingBefore = { ...omni.TIMING };
omni.TIMING.placeDeadlineMs = 150;
doubles.obsHang = true;
const hungTimeline = [];
const onHung = ({ key, value }) => { if (key === 'omnilayer') hungTimeline.push(value.moving?.phase || 'none'); };
bus.on(EVENTS.CONFIG, onHung);
const hungStarted = Date.now();
const hungGo = store.omnilayer({ op: 'go', layoutId: 'om-169', transition: 'cover' });
await wait(30);
const hungCover = omni.getOmnilayer().moving;
const hungDone = await Promise.race([hungGo.then(() => true), wait(3000).then(() => false)]);
const hungTook = Date.now() - hungStarted;
bus.off?.(EVENTS.CONFIG, onHung);
const hungState = omni.getOmnilayer();
doubles.obsHang = false;
Object.assign(omni.TIMING, timingBefore);
test('an OBS that stops answering cannot keep the stream covered: the wipe lifts at its deadline and says why', () => {
  assert.ok(hungDone, 'the switch never finished');
  assert.ok(hungTook < 1500, `it took ${hungTook} ms`);
  const phases = hungTimeline.filter((p, i, a) => p !== a[i - 1]);
  assert.deepEqual(phases.slice(-3), ['cover', 'reveal', 'none'], phases.join(' → '));
  assert.equal(hungState.moving, null);
  assert.equal(hungState.live, 'om-169', 'the overlay should still have changed layout');
  assert.ok(hungState.problems.some((p) => p.code === 'obs_slow'), JSON.stringify(hungState.problems));
});
test('the overlay is told how long a cover can last, so it can lift it alone if the server goes quiet', () => {
  // coverMs 150 and holdMs 100 were set above; the deadline was 150 then.
  assert.equal(typeof hungCover?.id, 'number');
  assert.ok(hungCover.maxMs >= 150 + 150 + 100, `maxMs ${hungCover?.maxMs}`);
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes('setTimeout(() => setGaveUpOn(id), moving.maxMs)'), 'the overlay waits on the server for ever');
  // A transition, so a switch arriving mid-reveal turns the panel round instead of snapping it back.
  assert.ok(stage.includes('transition: ready ? `transform ${ms}ms'), 'the wipe no longer moves by a transition');
});

// The live layout goes away — swapped out by an overlay profile, or deleted — and its counterpart takes over.
const sceneBeforeSwap = (doubles.obsScene = 'Old BRB');
const lay = (id, name, scenesFor, layers = []) => ({ id, name, width: 1920, height: 1080, scenes: scenesFor, layers });
changes.length = 0;
obsCalls.length = 0;
// No layout from here on has a box for the camera.
store.setLayouts([lay('p1-game', 'Juego', ['Gameplay'], [game(0, 0, 1920, 1080)]), lay('p1-brb', 'BRB', ['BRB'])]);
const firstWhenNothingAlike = omni.getOmnilayer().live;
await settle();
await store.omnilayer({ op: 'go', layoutId: 'p1-brb', transition: 'cut' });
await wait(200);
const camHiddenOnItsWayOut = obsCalls.filter((c) => c[0] === 'visible' && c[2] === 'Cam' && c[3] === false).length;
doubles.obsScene = 'Old BRB';
obsCalls.length = 0;
store.setLayouts([lay('p2-game', 'Partida', ['Gameplay'], [game(0, 0, 1920, 1080)]), lay('p2-brb', 'Descanso', ['BRB'])]);
// Before anything else runs: whatever is sent with these layouts must already carry it.
const sameBinding = omni.getOmnilayer().live;
await wait(300);
const placedForSuccessor = obsCalls.filter((c) => c[0] === 'visible' && c[3] === false).map((c) => c[2]);
store.setLayouts([lay('p3-a', 'Otro', []), lay('p3-b', 'Descanso', [])]);
const sameName = omni.getOmnilayer().live;
await wait(300);
const swapChanges = [...changes];
const sceneAfterSwap = doubles.obsScene;
test('when the live layout is gone, the one bound to the same scene goes live, then one of the same name, then the first', () => {
  assert.equal(firstWhenNothingAlike, 'p1-game');
  assert.equal(sameBinding, 'p2-brb', 'a profile switch on BRB should land on the new BRB');
  assert.equal(sameName, 'p3-b');
  assert.deepEqual(placedForSuccessor, ['Game'], 'the new layout’s sources were not placed');
  assert.equal(sceneAfterSwap, sceneBeforeSwap, 'a profile switch pulled OBS onto another scene');
});
test('a source no layout has a box for any more is hidden on its way out, then left alone', () => {
  assert.ok(camHiddenOnItsWayOut >= 1, 'the camera was left showing where the last layout put it');
  assert.ok(!placedForSuccessor.includes('Cam'), 'a source nobody manages any more is still being hidden on every save');
});
test('taking over is a layout going live, for actions like any other', () => {
  assert.deepEqual(swapChanges, [['Game 16:9', 'Juego'], ['Juego', 'BRB'], ['BRB', 'Descanso'], ['Descanso', 'Descanso']], JSON.stringify(swapChanges));
});
test('the editor’s save sends what is live with the layouts, so no screen pairs the new list with the old live id', () => {
  const ws = fs.readFileSync(new URL('../api/ws.js', SCRIPT_URL), 'utf8');
  assert.ok(ws.includes('{ layouts: engine.store.setLayouts(payload), omnilayer: engine.store.omnilayerState() }'));
});
doubles.obsScene = 'Omnilayer';

test('the canvas follows what is live on the Omnilayer scene, and scene bindings everywhere else', () => {
  const layouts = [{ id: 'a', scenes: ['Gameplay'] }, { id: 'b', scenes: [] }];
  const on = { enabled: true, live: 'b', scene: 'Omnilayer' };
  assert.equal(liveLayout(layouts, 'Omnilayer', on).id, 'b');
  assert.equal(liveLayout(layouts, '', on).id, 'b', 'with OBS saying nothing it should still follow');
  assert.equal(liveLayout(layouts, 'Gameplay', on).id, 'a', 'another scene lost its binding');
  assert.equal(liveLayout(layouts, 'Omnilayer', { ...on, enabled: false }), null, 'off, it should be the old rule');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(app.includes(': liveLayout(layouts, currentScene, omni);'), 'the canvas does not ask about Omnilayer');
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes("{layer.type === 'source' && showGuides && <SourceSlot layer={layer} />}"), 'the editor does not draw a source slot');
  const branch = stage.slice(stage.indexOf("case 'source':"), stage.indexOf('default:', stage.indexOf("case 'source':")));
  assert.ok(branch.includes('return null;'), 'a source slot draws something on stream');
  assert.ok(stage.includes('{moving && !showGuides && <OmniCover moving={moving} />}'), 'the wipe is not drawn');
});

// Put everything back.
store.deleteAction('act-om-brb');
await store.omnilayer({ op: 'set', settings: { enabled: false, live: '', scene: '', transition: 'cover', coverMs: 450, holdMs: 250 } });
store.setLayouts(layoutsBefore);
await wait(200);
