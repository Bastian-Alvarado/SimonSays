/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: a layout's vertical side, for streaming vertical at the same
 * time (shared/layout-formats.js) — where a layer goes there by itself and
 * when it has a place of its own, the editor's view saved back into the
 * layout, layers kept to one side, the vertical overlay page and its sound,
 * and Omnilayer moving OBS's sources on the vertical canvas.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, doubles, engine, fs, obsCalls, test } from './harness.js';

const F = await import('../../../shared/layout-formats.js');
const { normaliseLayouts } = await import('../../engine/layouts.js');
const omni = await import('../../engine/omnilayer.js');
const { countSurfaces, showsAlerts, preferred } = await import('../../api/ws.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const constants = read('../../web/constants.ts');
const bothLanguages = (key) => constants.split(`    ${key}: '`).length - 1 === 2;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const store = engine.store;
const H = { width: 1920, height: 1080 };
const V = { width: 1080, height: 1920 };
const boxOf = (b) => [b.x, b.y, b.width, b.height];

test('a layer carried to the vertical canvas keeps its size and its place across and down; one filling the canvas fills it', () => {
  assert.deepEqual(boxOf(F.carryBox({ x: 0, y: 0, width: 1920, height: 1080 }, H, V)), [0, 0, 1080, 1920], 'the alerts do not fill the vertical canvas');
  assert.deepEqual(boxOf(F.carryBox({ x: 0, y: 1016, width: 1920, height: 64 }, H, V)), [0, 1856, 1080, 64], 'an omnibar along the bottom is not along the bottom at its height');
  // A chat a third of the way down: its own size, so its words stay the size they were, its middle as far down.
  const chat = F.carryBox({ x: 600, y: 320, width: 380, height: 700 }, H, V);
  assert.deepEqual([chat.width, chat.height], [380, 700], 'a layer that fits was shrunk, and its words with it');
  assert.ok(Math.abs((chat.x + chat.width / 2) / 1080 - (600 + 190) / 1920) < 0.002, 'it moved across');
  assert.ok(Math.abs((chat.y + chat.height / 2) / 1920 - (320 + 350) / 1080) < 0.002, 'it moved down');
  // Wider than the vertical canvas: shrunk to its width, keeping its shape.
  assert.deepEqual(boxOf(F.carryBox({ x: 300, y: 200, width: 1296, height: 729 }, H, V)).slice(2), [1080, 608]);
  // Never off the canvas, however near the edge it was; and one against an edge stays against it.
  const corner = F.carryBox({ x: 1900, y: 1060, width: 300, height: 300 }, H, V);
  assert.ok(corner.x + corner.width <= 1080 && corner.y + corner.height <= 1920 && corner.x >= 0 && corner.y >= 0);
  assert.deepEqual(boxOf(F.carryBox({ x: 1500, y: 700, width: 420, height: 380 }, H, V)), [660, 1540, 420, 380], 'a camera in the bottom right corner left the corner');
  assert.deepEqual(boxOf(F.carryBox({ x: 0, y: 0, width: 400, height: 100 }, H, V)).slice(0, 2), [0, 0], 'a label in the top left corner left the corner');
});

const LAYOUT = {
  id: 'vt', name: 'Vertical test', width: 1920, height: 1080, background: 'transparent', layers: [
    { type: 'chat', uid: 'chat', x: 40, y: 320, width: 380, height: 700, visible: true, only: 'horizontal' },
    { type: 'omnibar', uid: 'bar', x: 0, y: 1016, width: 1920, height: 64, visible: true },
    { type: 'alerts', uid: 'alerts', x: 0, y: 0, width: 1920, height: 1080, visible: true },
    { type: 'source', uid: 'game', x: 0, y: 0, width: 1920, height: 1080, visible: true, aspect: '16:9', config: { source: 'Game', fit: 'fit', verticalFit: 'fill' } },
    { type: 'source', uid: 'cam', x: 1500, y: 700, width: 380, height: 214, visible: true, config: { source: 'Cam' } },
    { type: 'source', uid: 'cam2', x: 0, y: 0, width: 400, height: 400, visible: true, only: 'vertical', config: { source: 'Phone cam' } },
  ],
  vertical: { boxes: { cam: { x: 0, y: 1300, width: 1080, height: 608 }, ghost: { x: 1, y: 1, width: 50, height: 50 } } },
};
const [saved] = normaliseLayouts([LAYOUT]);
const plain = normaliseLayouts([{ ...LAYOUT, id: 'vt2', vertical: undefined }])[0];

test('a saved layout keeps what is kept to one side and its vertical places, and nothing for a layer it does not have', () => {
  assert.equal(saved.layers.find((l) => l.uid === 'chat').only, 'horizontal');
  assert.equal(saved.layers.find((l) => l.uid === 'bar').only, undefined, 'a layer on both says so');
  assert.deepEqual(Object.keys(saved.vertical.boxes), ['cam'], 'a box for a layer that is not there was kept');
  assert.equal(saved.vertical.width, undefined, 'the usual 1080×1920 was written out');
  assert.equal(plain.vertical, undefined, 'a layout never touched on the vertical side gained one');
  assert.equal(normaliseLayouts([{ ...LAYOUT, vertical: { width: 720, height: 1280 } }])[0].vertical.width, 720);
  assert.equal(normaliseLayouts([{ ...LAYOUT, layers: [{ ...LAYOUT.layers[0], only: 'diagonal' }] }])[0].layers[0].only, undefined);
});

const vertical = F.formatLayout(saved, 'vertical');
const horizontal = F.formatLayout(saved, 'horizontal');
test('each overlay draws its own side: the vertical canvas, each layer\'s vertical place, and none kept to the other side', () => {
  assert.deepEqual([vertical.width, vertical.height], [1080, 1920]);
  assert.ok(!vertical.layers.some((l) => l.uid === 'chat'), 'a chat kept to horizontal is on the vertical overlay');
  assert.ok(!horizontal.layers.some((l) => l.uid === 'cam2'), 'a camera kept to vertical is on the horizontal overlay');
  assert.deepEqual(boxOf(vertical.layers.find((l) => l.uid === 'cam')), [0, 1300, 1080, 608], 'a layer placed by hand is not where it was put');
  // A 16:9 game filling the horizontal canvas goes across the vertical one, still 16:9, in the middle.
  assert.deepEqual(boxOf(vertical.layers.find((l) => l.uid === 'game')), [0, 656, 1080, 608]);
  assert.deepEqual(boxOf(horizontal.layers.find((l) => l.uid === 'cam')), [1500, 700, 380, 214], 'the horizontal overlay took the vertical box');
  assert.equal(vertical._view, undefined);
});

// The editor's view, edited and saved back.
const view = F.viewOf(saved, 'vertical');
const untouched = F.fromVerticalView(saved, view);
const edited = F.fromVerticalView(saved, {
  ...view,
  layers: view.layers.map((l) => (l.uid === 'bar' ? { ...l, y: 100, config: { position: 'top' } } : l.uid === 'cam' ? { ...l, ...F.autoVerticalBox(saved.layers.find((y) => y.uid === 'cam'), saved) } : l))
    .concat([{ type: 'text', uid: 'new', x: 100, y: 1500, width: 600, height: 120, visible: true }]),
});
const resized = F.fromVerticalView(saved, { ...view, width: 720, height: 1280 });

test('the editor\'s vertical view saves back into the layout: places where they were moved, shared settings onto the layer', () => {
  assert.equal(view._view, 'vertical');
  assert.equal(view.layers.length, saved.layers.length, 'the view left a layer out, so it could not be edited');
  assert.deepEqual(untouched.vertical, saved.vertical, 'saving without a change changed the vertical side');
  assert.deepEqual(boxOf(untouched.layers.find((l) => l.uid === 'cam')), [1500, 700, 380, 214], 'the horizontal box moved');
  const bar = edited.layers.find((l) => l.uid === 'bar');
  assert.deepEqual(boxOf(bar), [0, 1016, 1920, 64], 'moving it on the vertical side moved it on the horizontal one');
  assert.deepEqual(edited.vertical.boxes.bar, { x: 0, y: 100, width: 1080, height: 64 });
  assert.deepEqual(bar.config, { position: 'top' }, 'a setting changed on the vertical side was lost');
  assert.equal(edited.vertical.boxes.cam, undefined, 'a layer put back where it goes by itself kept a place of its own');
  const added = edited.layers.find((l) => l.uid === 'new');
  assert.ok(added && added.width > 0 && added.x >= 0 && added.x + added.width <= 1920, 'a layer added on the vertical side has no horizontal place');
  assert.equal(edited.width, 1920, 'the vertical canvas size went onto the horizontal one');
  assert.equal(edited._view, undefined, 'the view was saved as it is');
  assert.deepEqual([resized.vertical.width, resized.vertical.height, resized.width], [720, 1280, 1920]);
});

// The overlay pages and their sound.
const layouts = [saved];
const horizontalPage = { mode: 'canvas', layoutId: 'vt', format: 'horizontal', isLocal: true, connectedAt: 2 };
const verticalPage = { mode: 'canvas', layoutId: 'vt', format: 'vertical', isLocal: true, connectedAt: 1 };
const alertsHorizontalOnly = [{ ...saved, layers: saved.layers.map((l) => (l.type === 'alerts' ? { ...l, only: 'horizontal' } : l)) }];

test('the vertical overlay is counted, shows the alerts as its side has them, and leaves the sound to the horizontal one', () => {
  assert.deepEqual(countSurfaces([{ mode: 'canvas', format: 'vertical', inObs: true }, { mode: 'canvas', inObs: true }]).vertical, 1);
  assert.equal(countSurfaces([{ mode: 'canvas', format: 'vertical', inObs: true }]).verticalInObs, 1);
  assert.equal(showsAlerts(verticalPage, layouts), true);
  assert.equal(showsAlerts(verticalPage, alertsHorizontalOnly), false, 'alerts kept to horizontal still count on the vertical overlay');
  // Both show the alerts: the horizontal one plays them, even though the vertical one connected first.
  assert.equal(preferred(horizontalPage, verticalPage, layouts), true);
  assert.equal(preferred(verticalPage, horizontalPage, layouts), false, 'the vertical overlay took the sound');
  const ws = read('../api/ws.js');
  assert.ok(ws.includes("ws.format = payload.format === 'vertical' ? 'vertical' : 'horizontal';"));
  assert.ok(read('../../web/hooks/useBackend.ts').includes("...(query.get('format') === 'vertical' ? { format: 'vertical' } : {})"), 'the vertical page does not say what it is');
  assert.ok(read('../../web/App.tsx').includes("const layout = formatLayout(chosenLayout, searchParams.get('format') === 'vertical' ? 'vertical' : 'horizontal');"), 'the overlay page does not draw the vertical side');
});

test('Omnilayer places each side\'s slots: the vertical boxes scaled to the vertical canvas, with the slot\'s vertical fit', () => {
  const v = omni.placements(vertical, layouts, { width: 720, height: 1280 }, undefined, undefined, 'vertical');
  const game = v.place.find((p) => p.source === 'Game');
  assert.deepEqual([game.x, game.y, game.width, game.height, game.fit], [0, 437, 720, 405, 'fill']);
  assert.ok(v.place.some((p) => p.source === 'Phone cam'), 'a slot kept to vertical is not placed there');
  const h = omni.placements(horizontal, layouts, H);
  assert.equal(h.place.find((p) => p.source === 'Game').fit, 'fit', 'the vertical fit was used on the horizontal canvas');
  assert.ok(h.hide.includes('Phone cam'), 'a slot kept to vertical is shown on the horizontal canvas');
  assert.equal(omni.normaliseSourceLayer({ source: 'G', verticalFit: 'sideways' }).verticalFit, undefined);
  assert.equal(omni.normaliseSourceLayer({ source: 'G', verticalFit: 'fill' }).verticalFit, 'fill');
  assert.ok(!('verticalFit' in omni.normaliseSourceLayer({ source: 'G' })), 'a slot saved before gained a field, so its profile reads as changed');
  assert.ok(omni.SOURCE_FITS.includes('fill'));
});

// Live, through the engine: OBS has a vertical canvas, and Omnilayer works it too.
const layoutsBefore = structuredClone(store.getLayouts?.() ?? engine.snapshot().layouts);
const settingsBefore = omni.getOmnilayer();
store.setLayouts([LAYOUT, { id: 'vt-brb', name: 'BRB', width: 1920, height: 1080, layers: [{ type: 'text', uid: 't', x: 0, y: 0, width: 300, height: 100, config: { text: 'Back soon' } }] }]);
doubles.obsCanvases = [{ uuid: 'vc-1', name: 'SE.Live Vertical', width: 1080, height: 1920 }];
doubles.obsCanvasScenes = { 'vc-1': ['Vertical Omni', 'Vertical BRB'] };
await store.omnilayer({ op: 'set', settings: { enabled: true, scene: 'Omnilayer', transition: 'cut', vertical: { enabled: true, canvas: 'vc-1', canvasName: 'SE.Live Vertical', scene: 'Vertical Omni' } } });
await wait(60);
obsCalls.length = 0;
await store.omnilayer({ op: 'go', layoutId: 'vt' });
const onVertical = obsCalls.filter((c) => c[0] === 'place' && c[4] === 'vc-1').map((c) => [c[1], c[2], c[3].x, c[3].y, c[3].width, c[3].height, c[3].fit]);
const onMain = obsCalls.filter((c) => c[0] === 'place' && !c[4]).map((c) => c[2]);
const hiddenVertical = obsCalls.filter((c) => c[0] === 'visible' && c[4] === 'vc-1' && c[3] === false).map((c) => c[2]);
obsCalls.length = 0;
await store.omnilayer({ op: 'go', layoutId: 'vt-brb' });
const hiddenOnBrb = obsCalls.filter((c) => c[0] === 'visible' && c[4] === 'vc-1' && c[3] === false).map((c) => c[2]).sort();
const listed = await store.omnilayer({ op: 'canvases' });
// The canvas renamed and given a new id since: found again by name. Then gone: said, and the main canvas still done.
doubles.obsCanvases = [{ uuid: 'vc-2', name: 'SE.Live Vertical', width: 1080, height: 1920 }];
obsCalls.length = 0;
await store.omnilayer({ op: 'go', layoutId: 'vt' });
const foundByName = obsCalls.some((c) => c[0] === 'place' && c[4] === 'vc-2');
doubles.obsCanvases = [];
obsCalls.length = 0;
await store.omnilayer({ op: 'go', layoutId: 'vt-brb' });
const goneProblems = omni.getOmnilayer().problems.map((p) => p.code);
const mainStillDone = obsCalls.some((c) => c[0] === 'visible' && !c[4]);
// A source the vertical scene lacks: said, as on the main canvas.
doubles.obsCanvases = [{ uuid: 'vc-1', name: 'SE.Live Vertical', width: 1080, height: 1920 }];
doubles.obsMissingVertical = ['Phone cam'];
await store.omnilayer({ op: 'go', layoutId: 'vt' });
const missingProblem = omni.getOmnilayer().problems.find((p) => p.canvas === 'vertical');
doubles.obsMissingVertical = [];
doubles.obsNoCanvases = true;
const unsupported = await store.omnilayer({ op: 'canvases' });
doubles.obsNoCanvases = false;

test('going live moves the sources on the vertical canvas too, to the layout\'s vertical boxes, and hides what it has no box for', () => {
  const phone = vertical.layers.find((l) => l.uid === 'cam2');
  assert.deepEqual(onVertical, [
    ['Vertical Omni', 'Game', 0, 656, 1080, 608, 'fill'],
    ['Vertical Omni', 'Cam', 0, 1300, 1080, 608, 'fit'],
    ['Vertical Omni', 'Phone cam', phone.x, phone.y, phone.width, phone.height, 'fit'],
  ]);
  assert.ok(!onMain.includes('Phone cam'), 'a slot kept to vertical was placed on the main canvas');
  assert.ok(onMain.includes('Game') && onMain.includes('Cam'));
  // Only this layout's sources: an earlier test's may be hidden on the way, as no layout has them now.
  const ours = (names) => names.filter((n) => ['Game', 'Cam', 'Phone cam'].includes(n));
  assert.deepEqual(ours(hiddenVertical), [], 'the vertical scene hid a source the layout places there');
  assert.deepEqual(ours(hiddenOnBrb), ['Cam', 'Game', 'Phone cam'], 'going to a layout without them left them on the vertical canvas');
});

test('the vertical canvas is found again by name, a missing one or source is said, and the main canvas is done regardless', () => {
  assert.deepEqual(listed.canvases.map((c) => [c.name, c.width, c.height, c.scenes.join('|')]), [['SE.Live Vertical', 1080, 1920, 'Vertical Omni|Vertical BRB']]);
  assert.ok(foundByName, 'a canvas with a new id was not found by its name');
  assert.ok(goneProblems.includes('vertical_canvas_missing'), `a missing vertical canvas was not said: ${goneProblems}`);
  assert.ok(mainStillDone, 'a missing vertical canvas stopped the main one being done');
  assert.equal(missingProblem?.source, 'Phone cam');
  assert.equal(missingProblem?.scene, 'Vertical Omni');
  assert.equal(unsupported.supported, false);
  const cleaned = omni.cleanOmnilayer({ vertical: { enabled: 'yes', canvas: 'x'.repeat(100), scene: '  V  ' } });
  assert.deepEqual([cleaned.vertical.enabled, cleaned.vertical.canvas.length, cleaned.vertical.scene], [false, 64, 'V']);
});

test('OBS is asked inside the vertical canvas by its id, and a filling source is cut to its box', () => {
  const obs = read('../platforms/obs.js');
  assert.ok(obs.includes("const BOUNDS = { fit: 'OBS_BOUNDS_SCALE_INNER', stretch: 'OBS_BOUNDS_STRETCH', fill: 'OBS_BOUNDS_SCALE_OUTER' };"));
  assert.ok(obs.includes("cropToBounds: fit === 'fill',"), 'a filling source is not cut to its box, or a fitted one stays cut');
  assert.ok(obs.includes("const where = { sceneName, sceneItemId: id, ...(canvasUuid ? { canvasUuid } : {}) };"));
  assert.ok(obs.includes("await ensure().call('GetSceneItemId', { sceneName, sourceName, ...(canvasUuid ? { canvasUuid } : {}) });"));
  assert.ok(obs.includes('if (err?.code === 204 || /unknown request/i.test(err?.message || \'\')) return { supported: false, canvases: [] };'), 'an older OBS breaks the list instead of saying it has none');
});

test('the editor: the two sides, every save taken apart, layers kept to one side, the safe zones and the vertical link', () => {
  const v = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(v.includes("const saveLayouts = (list: CanvasLayout[]) => setLayouts(list.map(toStored));"));
  assert.ok(!/[^.]setLayouts\(layouts\.map\(\(l\) => \(l\.id === (next|w)\.id \? (next|w) :/.test(v), 'a save puts the view in the list as it is');
  assert.ok(v.includes('setLayouts(layouts.map((l) => (l.id === layout.id ? toStored(layout) : l)));'), 'committing stores the view');
  assert.ok(v.includes('layout={{ ...working, layers: working.layers.filter((l) => shownIn(l, format)) }}'), 'the canvas draws layers kept to the other side');
  assert.ok(v.includes("const linkUrl = pageLink(shownUrl && format === 'vertical' ? `${shownUrl}&format=vertical` : shownUrl);"));
  assert.ok(v.includes('PHONE_SAFE_ZONES.map((z) => ('));
  assert.ok(read('../../web/components/SourceLayerPanel.tsx').includes('<option value="fill">'));
  for (const key of ['layoutFormatHorizontal', 'layoutFormatVertical', 'layoutFormatVerticalHint', 'layoutShowOn', 'layoutShowBoth', 'layoutShowHorizontal', 'layoutShowVertical', 'layoutVerticalAuto', 'layoutVerticalAutoAll', 'layoutSafeZones', 'layoutSourceVertical', 'layoutSourceVerticalHint', 'omniVertical', 'omniVerticalHint', 'omniVerticalNone', 'omniVerticalUnsupported', 'omniProblemVerticalCanvas', 'omniProblemVerticalSource', 'sourceSlotFill', 'sourceSlotVerticalFit']) {
    assert.ok(bothLanguages(key), `${key} is not in both languages`);
  }
});

test('the vertical canvas can show a mock of TikTok LIVE instead of the shaded areas', () => {
  /*
    One choice of three — shaded areas, the mock, or neither — so the two are
    never drawn over each other. The mock is a guide in the editor: it lets
    every click through to the layers under it and never reaches the stream.
  */
  const v = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(v.includes("useState<'zones' | 'tiktok' | 'off'>"), 'the shaded areas and the mock are two switches again');
  assert.ok(v.includes("format === 'vertical' && phoneGuide === 'zones' && PHONE_SAFE_ZONES.map((z) => ("), 'the shaded areas show beside the mock');
  assert.ok(v.includes("{format === 'vertical' && phoneGuide === 'tiktok' && <TikTokMock width={working.width} height={working.height} t={t} />}"), 'the mock is not drawn on the vertical canvas');
  assert.ok(v.includes("onClick={() => setPhoneGuide(phoneGuide === 'tiktok' ? 'off' : 'tiktok')}"));
  // Whoever had the shaded areas switched off keeps them off.
  assert.ok(v.includes("return localStorage.getItem('layout_safe_zones') === 'off' ? 'off' : 'zones';"));
  const mock = read('../../web/components/TikTokMock.tsx');
  assert.ok(mock.includes('className="absolute inset-0 pointer-events-none overflow-hidden" data-phone-mock="tiktok"'), 'the mock takes clicks meant for the layers');
  assert.ok(mock.includes("transform: `scale(${scale})`") && mock.includes('const scale = width / PHONE_WIDTH;'), 'the mock is not scaled to the canvas');
  // Only the canvas editor draws it, never a stream page.
  assert.ok(!read('../../web/components/CanvasStage.tsx').includes('TikTokMock'));
  const keys = [...mock.matchAll(/\bt\.(tiktokMock[A-Za-z0-9]+)/g)].map((m) => m[1]);
  assert.ok(keys.length >= 10, `only ${keys.length} words in the mock`);
  for (const key of [...keys, 'layoutPhoneMock', 'layoutPhoneMockHint']) assert.ok(bothLanguages(key), `${key} is not in both languages`);
});

// Put everything back.
doubles.obsCanvases = undefined;
doubles.obsCanvasScenes = undefined;
await store.omnilayer({ op: 'set', settings: { enabled: settingsBefore.enabled, live: settingsBefore.live, scene: settingsBefore.scene, transition: settingsBefore.transition, vertical: { enabled: false, canvas: '', canvasName: '', scene: '' } } });
store.setLayouts(layoutsBefore);
await wait(200);

// ------------------------------------- the vertical side's own groups and order

const G = await import('../../../shared/layer-groups.js');
const vgLayer = (uid, group) => ({ uid, type: 'shape', x: 0, y: 0, width: 100, height: 100, ...(group ? { group } : {}) });
const vgLayout = { id: 'vg', name: 'VG', width: 1920, height: 1080, groups: [{ id: 'g1', name: 'Pair' }], layers: [vgLayer('a'), vgLayer('b', 'g1'), vgLayer('c', 'g1'), vgLayer('d')] };
const groupsOf = (layers) => layers.map((l) => `${l.uid}${l.group ? `:${l.group}` : ''}`).join(' ');

test('ungrouping on the vertical side leaves the horizontal side\'s groups as they were', () => {
  // Untouched, the vertical side follows the horizontal one and nothing of its own is kept.
  const untouched = F.fromVerticalView(vgLayout, F.viewOf(vgLayout, 'vertical'));
  assert.equal(F.ownVerticalGrouping(untouched), false);
  assert.equal(untouched.vertical, undefined, 'a vertical side never changed was saved with something of its own');
  const view = F.viewOf(vgLayout, 'vertical');
  const ug = G.ungroupLayers(view.layers, view.groups, { group: 'g1' });
  const saved = F.fromVerticalView(vgLayout, { ...view, layers: ug.layers, groups: ug.groups });
  assert.equal(groupsOf(saved.layers), 'a b:g1 c:g1 d', 'the horizontal side lost its group');
  assert.deepEqual(saved.groups, vgLayout.groups);
  assert.deepEqual(F.viewOf(saved, 'vertical').groups, [], 'the vertical side still shows the group');
  assert.equal(groupsOf(F.viewOf(saved, 'vertical').layers), 'a b c d');
});

test('groups made on the vertical side are its own, drawn in its own order, kept by the server, and let go with one press', () => {
  const view = F.viewOf(vgLayout, 'vertical');
  const ug = G.ungroupLayers(view.layers, view.groups, { group: 'g1' });
  const gr = G.groupLayers(ug.layers, ug.groups, ['a', 'd'], { id: 'v1', name: 'Vert' });
  const saved = F.fromVerticalView(vgLayout, { ...view, layers: gr.layers, groups: gr.groups });
  assert.equal(groupsOf(saved.layers), 'a b:g1 c:g1 d', 'grouping on the vertical side changed the horizontal side');
  assert.deepEqual(saved.vertical.groups, [{ id: 'v1', name: 'Vert' }]);
  assert.deepEqual(saved.vertical.group, { a: 'v1', d: 'v1' });
  // Its layers side by side in the vertical order; the horizontal order as it was.
  assert.deepEqual(F.formatLayout(saved, 'vertical').layers.map((l) => l.uid), ['b', 'c', 'a', 'd']);
  assert.deepEqual(F.formatLayout(saved, 'horizontal').layers.map((l) => l.uid), ['a', 'b', 'c', 'd']);
  // The server keeps it, holding it to its shape.
  const [kept] = normaliseLayouts([saved]);
  assert.deepEqual(kept.vertical.groups, [{ id: 'v1', name: 'Vert' }]);
  assert.deepEqual(kept.vertical.order, ['b', 'c', 'a', 'd']);
  assert.equal(groupsOf(kept.layers), 'a b:g1 c:g1 d');
  // Junk in it is dropped: unknown layers, groups with bad ids, groups holding nothing.
  const junk = F.cleanVertical({ order: ['zz', 'a', 'a', 'b'], groups: [{ id: 'bad id!', name: 'x' }, { id: 'v2', name: 'Empty' }, { id: 'v3', name: 'Real' }], group: { a: 'v3', zz: 'v3' } }, ['a', 'b']);
  assert.deepEqual(junk.order, ['a', 'b']);
  assert.deepEqual(junk.groups, [{ id: 'v3', name: 'Real' }]);
  assert.deepEqual(junk.group, { a: 'v3' });
  // "Use the horizontal groups": the vertical side follows them again.
  const shared = F.sharedGrouping(saved);
  assert.equal(F.ownVerticalGrouping(shared), false);
  assert.equal(groupsOf(F.viewOf(shared, 'vertical').layers), 'a b:g1 c:g1 d');
  // A layer added on the horizontal side since shows on the vertical side too, at the front.
  const added = { ...saved, layers: [...saved.layers, vgLayer('e')] };
  assert.equal(F.viewOf(added, 'vertical').layers.at(-1).uid, 'e');
  const editor = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(editor.includes('data-layout-vertical-shared-groups') && editor.includes('const next = sharedGrouping(stored) as CanvasLayout;'));
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['layoutVerticalSharedGroups', 'layoutVerticalSharedGroupsHint']) assert.equal(strings.split(`    ${key}: `).length - 1, 2, key);
});

test('a vertical order of its own keeps a group made on the horizontal side together', () => {
  const plain = { id: 'vo', name: 'VO', width: 1920, height: 1080, layers: [vgLayer('a'), vgLayer('b'), vgLayer('c'), vgLayer('d')] };
  // Reordered on the vertical side only: an order of its own, the horizontal side's (no) groups.
  const view = F.viewOf(plain, 'vertical');
  const reordered = F.fromVerticalView(plain, { ...view, layers: [view.layers[0], view.layers[3], view.layers[1], view.layers[2]] });
  assert.deepEqual(reordered.vertical.order, ['a', 'd', 'b', 'c']);
  assert.equal(reordered.vertical.groups, undefined);
  // Then A and B grouped on the horizontal side: on the vertical side they stay side by side, not split by D.
  const grouped = { ...reordered, groups: [{ id: 'h1', name: 'AB' }], layers: reordered.layers.map((l) => (l.uid === 'a' || l.uid === 'b' ? { ...l, group: 'h1' } : l)) };
  const shown = F.viewOf(grouped, 'vertical').layers.map((l) => `${l.uid}${l.group ? ':' + l.group : ''}`);
  const at = shown.indexOf('a:h1');
  assert.ok(at >= 0 && (shown[at + 1] === 'b:h1' || shown[at - 1] === 'b:h1'), `the group is split on the vertical side: ${shown.join(' ')}`);
});
