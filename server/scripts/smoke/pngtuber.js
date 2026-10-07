/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the PNGtuber — talking heard through the microphone in OBS,
 * faces pulled by actions, and the layer of your own pictures.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, bus, EVENTS, engine, chat, settle, test } from './harness.js';
import { LAYER_TYPES, normaliseLayouts } from './backup-and-layouts.js';

const png = await import('../../engine/pngtuber.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

// OBS's InputVolumeMeters entry for one input: [magnitude, peak, input peak] per channel.
const meters = (name, mul) => [{ inputName: 'Desktop Audio', inputLevelsMul: [[0.9, 0.9, 0.9]] }, { inputName: name, inputLevelsMul: [[mul / 2, mul, mul], [mul / 3, mul / 2, mul / 2]] }];

const talkChanges = [];
bus.on(EVENTS.CONFIG, (c) => { if (c.key === 'micTalk') talkChanges.push({ ...c.value }); });

const cleaned = png.cleanMic({ inputName: '  Mic/Aux  ', threshold: -500, loud: 'x', holdMs: 99999 });
png.setMic({ inputName: 'Mic/Aux', threshold: -30, loud: -10, holdMs: 200 });
png.resetForTests();
talkChanges.length = 0;
const seen = [];
const at = (ms, mul) => { png.onMeters(meters('Mic/Aux', mul), ms); seen.push(png.snapshot().micTalk.talking); };
at(1000, 0.001); // -60 dB: quiet
at(1050, 0.1); //   -20 dB: talking
at(1100, 0.1); //   still talking: nothing new to say
at(1200, 0.001); // quiet, but within the hold
at(1350, 0.001); // past the hold: quiet
const afterQuiet = [...talkChanges];
at(1400, 0.5); //   -6 dB: loud
const loud = png.snapshot().micTalk;
png.onMeters(meters('Some other mic', 1), 1450);
const ignoringOthers = png.snapshot().micTalk;
at(2000, 0.001);

test('the microphone\'s level in OBS says when you talk, holding the mouth open between words', () => {
  assert.equal(Math.round(png.levelDb({ inputLevelsMul: [[1, 1, 1]] })), 0);
  assert.equal(Math.round(png.levelDb({ inputLevelsMul: [[0.05, 0.1, 0.1]] })), -20);
  assert.equal(png.levelDb({ inputLevelsMul: [] }), -100);
  assert.deepEqual(seen.slice(0, 5), [false, true, true, true, false]);
  // Only changes go out: talking, then quiet — not twenty messages a second.
  assert.deepEqual(afterQuiet, [{ talking: true, loud: false, soft: false }, { talking: false, loud: false, soft: false }]);
  assert.deepEqual(loud, { talking: true, loud: true, soft: false });
  assert.deepEqual(ignoringOthers, loud, 'another input changed the answer');
});

test('microphone settings are cleaned on the way in', () => {
  assert.deepEqual(cleaned, { inputName: 'Mic/Aux', threshold: -80, loud: -12, holdMs: 2000 });
  const obs = read('../platforms/obs.js');
  assert.ok(obs.includes('EventSubscription.InputVolumeMeters') && obs.includes("bus.emit('obs:meters'"), 'OBS is not asked for its levels');
  assert.ok(obs.includes('reidentify'), 'turning the microphone on needs a reconnect');
  assert.ok(read('../engine/backup.js').includes("name: 'pngtuber_mic'"), 'the microphone settings are not backed up');
});

// ---------------------------------------------------------------- faces

const faces = [];
bus.on(EVENTS.CONFIG, (c) => { if (c.key === 'avatarFace') faces.push(c.value); });
engine.store.saveCommand({
  id: 'cmd-face', name: 'Face', triggers: ['!face'], enabled: true,
  permissions: { anyone: true, vips: true, subscribers: true, moderators: true, broadcaster: true }, globalCooldown: 0, userCooldown: 0,
});
engine.store.saveAction({
  id: 'act-face', name: 'Face', enabled: true,
  trigger: { id: 't-face', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-face' } },
  actions: [{ id: 's-face', type: 'avatar_face', config: { face: '{input}', seconds: 1 } }],
});
chat('!face Wink');
await settle();
const fromChat = faces[faces.length - 1];
await new Promise((r) => setTimeout(r, 1100));
const afterTime = faces[faces.length - 1];
png.showFace('happy', 30);
png.showFace('none');
const putBack = faces[faces.length - 1];

test('an action shows a face on every avatar for as long as it says, then puts them back', () => {
  assert.deepEqual(fromChat, { name: 'wink', seconds: 1 });
  assert.equal(afterTime, null, 'the face stayed after its time');
  assert.equal(putBack, null);
  assert.equal(png.snapshot().avatarFace, null);
});

// ---------------------------------------------------------------- the layers

const [layout] = normaliseLayouts([{
  id: 'png', layers: [
    { type: 'pngtuber', uid: 'p1', config: {
      frames: { idle: '/media/me.png', talking: 'https://x.test/talk.png', blink: 'javascript:alert(1)' },
      expressions: [{ name: 'Happy ', idle: '/media/happy.png' }, { name: 'empty' }], hop: false,
    } },
    { type: 'pngtuber', uid: 'p2', config: {} },
    { type: 'avatar', uid: 'a1', config: { talkWith: { id: 'mic', name: 'whatever' } } },
  ],
}]);
const [p1, p2, a1] = layout.layers;

test('a PNGtuber layer keeps only real pictures, and talks with the microphone unless told otherwise', () => {
  assert.ok(LAYER_TYPES.includes('pngtuber'));
  assert.deepEqual(p1.config.frames, { idle: '/media/me.png', talking: 'https://x.test/talk.png' });
  assert.deepEqual(p1.config.expressions, [{ name: 'happy', idle: '/media/happy.png', talking: '' }]);
  assert.equal(p1.config.hop, false);
  assert.deepEqual(p2.config.talkWith, { id: 'mic', name: 'mic' });
  assert.equal(p2.config.blinks, true);
  assert.deepEqual(a1.config.talkWith, { id: 'mic', name: 'mic' });
  assert.equal(a1.config.shake, true);
});

test('the PNGtuber is on the canvas, in the editor, in the actions and on its own screen, in both languages', () => {
  const canvas = read('../../web/components/CanvasStage.tsx');
  assert.ok(canvas.includes("case 'pngtuber':") && canvas.includes('mic={(system.data as any).micTalk}'));
  assert.ok(read('../../web/components/views/LayoutsView.tsx').includes('<PngtuberLayerPanel'));
  assert.ok(read('../../web/components/views/ActionsView.tsx').includes("type: 'avatar_face'"));
  assert.ok(read('../../web/App.tsx').includes('<PngtuberView'));
  const strings = read('../../web/constants.ts');
  const files = ['views/PngtuberView.tsx', 'PngtuberLayerPanel.tsx', 'AvatarLayerPanel.tsx', 'views/ActionsView.tsx'];
  const keys = new Set(files.flatMap((f) => [...read(`../../web/components/${f}`).matchAll(/t\.((?:pngtuber|avatar)\w+)/g)].map((m) => m[1])));
  for (const key of keys) assert.equal(strings.split(`    ${key}:`).length - 1, 2, `${key} is not in both languages`);
});

const viaDashboard = engine.store.mic({ settings: { holdMs: 300 } });
const meterAsked = engine.store.mic({ op: 'meter' });

test('the dashboard reaches the microphone settings, the meter and the faces through the socket', () => {
  assert.ok(read('../api/ws.js').includes('engine.store.mic(payload)'), 'the socket calls something that is not there');
  assert.equal(viaDashboard.holdMs, 300);
  assert.deepEqual(meterAsked, { ok: true });
});

const [loudLayout] = normaliseLayouts([{ id: 'loud', layers: [
  { type: 'avatar', config: { talkWith: { id: 'mic' }, loudFace: 'angry' } },
  { type: 'avatar', config: { loudFace: 'dance' } },
  { type: 'pngtuber', config: { loudFace: ' Shout ' } },
] }]);

test('a face for when you are loud is kept, on the pixel avatar and on a PNGtuber', () => {
  const avatarLayer = read('../../web/components/AvatarLayer.tsx');
  assert.ok(avatarLayer.includes('reacted.face || hypeFace || loudFace'), 'an action, an alert or the Hype Train no longer wins over being loud');
  assert.ok(read('../../web/components/PngtuberLayer.tsx').includes('loud && has(config.loudFace)'));
});

const dockFaces = [];
const onDockFace = (c) => { if (c.key === 'avatarFace') dockFaces.push(c.value); };
bus.on(EVENTS.CONFIG, onDockFace);
await engine.runDockBuiltin('avatar_heart_eyes');
await engine.runDockBuiltin('avatar_normal');
bus.off?.(EVENTS.CONFIG, onDockFace);

test('the dock has a button for each of the avatar\'s faces, and one to put it back', () => {
  assert.deepEqual(dockFaces, [{ name: 'heart-eyes', seconds: 5 }, null]);
});

// Soft: talking, but not once up to halfway between talking (-30) and loud (-10), for the hold (300 ms by now).
png.resetForTests();
const softly = [];
const hear = (ms, mul) => { png.onMeters(meters('Mic/Aux', mul), ms); softly.push(png.snapshot().micTalk.soft); };
hear(5000, 0.05); //  -26 dB: talking, softly
hear(5100, 0.05);
hear(5150, 0.15); //  -16.5 dB: past halfway, normal
hear(5250, 0.05); //  soft again, but within the hold
hear(5500, 0.05); //  past the hold: soft
hear(5550, 0.5); //   loud is never soft

test('the microphone also says when the voice is soft, so the mouth can open only a little', () => {
  assert.equal(png.midDb({ threshold: -30, loud: -10 }), -20);
  assert.deepEqual(softly, [true, true, false, false, true, false]);
  const layer = read('../../web/components/AvatarLayer.tsx');
  assert.ok(layer.includes("voice: loud ? 'loud' : soft ? 'soft' : 'normal'"), 'the mouth ignores how loud the voice is');
  assert.ok(read('../../web/components/views/PngtuberView.tsx').includes('data-mic-soft-mark'), 'the meter does not show where soft ends');
});

// ---------------------------------------------------------------- dressed up by viewers


const [dressLayout] = normaliseLayouts([{ id: 'dress', layers: [{ type: 'avatar', config: {} }, { type: 'avatar', config: { dressable: false } }] }]);

test('a layer wears what viewers put on it unless it says no, their hat in place of its own', () => {
  assert.deepEqual(dressLayout.layers.map((l) => l.config.dressable), [true, false]);
  const layer = read('../../web/components/AvatarLayer.tsx');
  assert.ok(layer.includes("if (config.dressable === false || !dress || (dress.outfit == null && dress.hat == null)) return own;"), 'a layer cannot say no');
  assert.ok(layer.includes("dress.hat === 'none' ? [] : [dress.hat]"), 'a viewer hat does not replace the layer hat');
  assert.ok(layer.includes('extras={worn.extras}') && layer.includes('costume={worn.costume}'), 'what it wears is not what viewers put on');
});

// ---------------------------------------------------------------- something it does: a glass of water

const acts = [];
const onAct = (c) => { if (c.key === 'avatarAction') acts.push(c.value); };
bus.on(EVENTS.CONFIG, onAct);
engine.store.saveCommand({
  id: 'cmd-drink', name: 'Drink', triggers: ['!tomar'], enabled: true,
  permissions: { anyone: true, vips: true, subscribers: true, moderators: true, broadcaster: true }, globalCooldown: 0, userCooldown: 0,
});
engine.store.saveAction({
  id: 'act-drink', name: 'Drink', enabled: true,
  trigger: { id: 't-drink', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-drink' } },
  actions: [{ id: 's-drink', type: 'avatar_action', config: { action: '{input}' } }],
});
chat('!tomar Agua');
await settle();
const drankByChat = acts[acts.length - 1];
chat('!tomar un baile');
await settle();
const afterNonsense = acts.length;
await engine.runDockBuiltin('avatar_drink');
const drankByDock = acts[acts.length - 1];
const heldNow = png.snapshot().avatarAction;
bus.off?.(EVENTS.CONFIG, onAct);

test('a chat command, a dock button or the Avatar screen has every avatar drink a glass of water, once each time', () => {
  assert.equal(drankByChat?.name, 'drink', 'a loose Spanish word did not name it');
  assert.equal(afterNonsense, acts.indexOf(drankByChat) + 1, 'words that name nothing did something');
  assert.equal(drankByDock?.name, 'drink');
  assert.notEqual(drankByDock.key, drankByChat.key, 'asking again would not do it again');
  // Kept a while for the snapshot, then let go, so a page opened later does not drink late.
  assert.deepEqual(heldNow, drankByDock);
  assert.ok(png.AVATAR_ACTION_HOLD_MS >= 5000 && png.AVATAR_ACTION_HOLD_MS <= 30000);
  assert.equal(png.playAvatarAction('bailar'), null);
  assert.ok(read('../engine/index.js').includes("if (payload?.op === 'action') return pngtuber.playAvatarAction(payload.name)"), 'the Avatar screen cannot try it');
  assert.ok(read('../../web/components/CanvasStage.tsx').includes('acted={(system.data as any).avatarAction}'), 'the canvas does not hear about it');
  assert.ok(read('../../web/hooks/useStreamSystem.ts').includes('avatarAction: (snapshot as any).avatarAction ?? null'), 'a page does not keep it');
  assert.ok(read('../../web/components/views/ActionsView.tsx').includes("type: 'avatar_action'"), 'there is no step for it');
  assert.ok(read('../../web/components/views/PngtuberView.tsx').includes('onClick={() => act(a)}'), 'the Avatar screen has no button for it');
});
