/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: scene types — what a layout is for, named by the streamer, so
 * a command that goes live with "BRB" works in every overlay profile.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, EVENTS, chat, engine, fs, said, settle, test } from './harness.js';
import { mod, runCommand } from './chat-steps.js';

const st = await import('../../engine/scene-types.js');
const omni = await import('../../engine/omnilayer.js');
const profiles = await import('../../engine/profiles.js');
const { normaliseLayouts } = await import('../../engine/layouts.js');
const { collection } = await import('../../core/store.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const store = engine.store;
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

// ------------------------------------------------------------ the pieces

test('the list keeps a name once, an id each, and nothing nameless', () => {
  const list = st.cleanSceneTypes([{ name: '  BRB ' }, { name: 'brb' }, { id: 'st-x', name: 'Juego' }, { id: 'st-x', name: 'Otro' }, { name: '' }, { id: 'bad id!', name: 'Inicio' }]);
  assert.deepEqual(list.map((t) => t.name), ['BRB', 'Juego', 'Otro', 'Inicio']);
  assert.equal(new Set(list.map((t) => t.id)).size, 4, 'two types share an id');
  assert.ok(list.every((t) => st.cleanTypeId(t.id) === t.id), JSON.stringify(list));
  assert.equal(list.find((t) => t.name === 'Juego').id, 'st-x', 'a good id was not kept');
  assert.equal(st.newTypeId('Conversación'), 'st-conversacion');
  assert.equal(st.cleanSceneTypes(Array.from({ length: 40 }, (_, i) => ({ name: `T${i}` }))).length, st.MAX_SCENE_TYPES);
});

test('a layout fills one type, and a type is filled by one layout', () => {
  const clean = normaliseLayouts([
    { id: 'a', name: 'A', layers: [], sceneType: 'st-brb' },
    { id: 'b', name: 'B', layers: [], sceneType: 'st-brb' },
    { id: 'c', name: 'C', layers: [], sceneType: 'not ok!' },
    { id: 'd', name: 'D', layers: [] },
  ]);
  assert.deepEqual(clean.map((l) => l.sceneType), ['st-brb', undefined, undefined, undefined], 'the first claim should win');
  assert.ok(!('sceneType' in clean[3]), 'a layout with no type carries an empty one');
});

test('types come from the scene bindings, and each layout gets the type of its scene', () => {
  const a = [{ id: 'a1', scenes: ['Starting'] }, { id: 'a2', scenes: ['BRB', 'Pausa'] }, { id: 'a3', scenes: [] }];
  const b = [{ id: 'b1', scenes: ['BRB'] }, { id: 'b2', scenes: ['brb'] }, { id: 'b3', scenes: ['Starting'], sceneType: 'st-mine' }];
  const types = st.typesFromBindings([{ id: 'st-mine', name: 'Mine' }], [a, b]);
  assert.deepEqual(types.map((t) => t.name), ['Mine', 'Starting', 'BRB', 'Pausa'], 'the same name in another case made a second type');
  const tagged = st.tagByBindings(b, types);
  assert.deepEqual(tagged.layouts.map((l) => l.sceneType), ['st-brb', undefined, 'st-mine'], 'one type went to two layouts, or a chosen type was replaced');
  assert.equal(tagged.tagged, 1);
  assert.equal(st.tagByBindings(a, types).layouts[1].sceneType, 'st-brb', 'a layout bound to two scenes did not take its first');
  assert.deepEqual(st.untagGone(tagged.layouts, types.filter((t) => t.id !== 'st-brb')).map((l) => l.sceneType), [undefined, undefined, 'st-mine']);
});

test('a step or trigger naming a layout with a type is turned to name the type, branches too', () => {
  const actions = [{
    id: 'x', trigger: { type: 'layout_changed', config: { layoutId: 'L1' } },
    actions: [
      { id: 's1', type: 'layout_switch', config: { layoutId: 'L1', transition: 'cut' } },
      { id: 's2', type: 'condition', thenActions: [{ id: 's3', type: 'layout_switch', config: { layoutId: 'L2' } }], elseActions: [{ id: 's4', type: 'layout_switch', config: { layoutId: 'nope' } }] },
    ],
  }];
  const typeOf = (id) => ({ L1: 'st-brb', L2: 'st-juego' }[id] || '');
  const { actions: next, converted } = st.stepsByType(actions, typeOf);
  assert.equal(converted, 3);
  assert.equal(next[0].trigger.config.sceneType, 'st-brb');
  assert.deepEqual(next[0].actions[0].config, { layoutId: 'L1', transition: 'cut', sceneType: 'st-brb' }, 'the layout or the transition was lost');
  assert.equal(next[0].actions[1].thenActions[0].config.sceneType, 'st-juego');
  assert.equal(next[0].actions[1].elseActions[0].config.sceneType, undefined, 'a layout with no type was given one');
  assert.equal(st.stepsByType(next, typeOf).converted, 0, 'converting twice changed something');
});

// ------------------------------------------------------------ in the engine

const layoutsBefore = collection('layouts', []).get();
const lay = (id, name, scenes, sceneType) => ({ id, name, width: 1920, height: 1080, scenes, layers: [], ...(sceneType ? { sceneType } : {}) });

await store.omnilayer({ op: 'set', settings: { enabled: true, scene: 'Omnilayer', transition: 'cut', types: [] } });
store.setLayouts([lay('pa-start', 'Inicio A', ['Starting']), lay('pa-game', 'Juego A', ['Gameplay']), lay('pa-brb', 'Pausa A', ['BRB'])]);
// A second overlay profile, saved and not on: the types have to reach its layouts too.
store.profileDuplicate('overlays', 'Tipos B');
const dupId = profiles.summary().find((g) => g.id === 'overlays').profiles.find((p) => p.name === 'Tipos B').id;
const dirtyBefore = profiles.summary().find((g) => g.id === 'overlays').dirty;

const made = await store.omnilayer({ op: 'types_from_bindings' });
const typeId = (name) => made.types.find((t) => t.name === name)?.id;
const liveTagged = collection('layouts', []).get().map((l) => l.sceneType);
const savedTagged = profiles.savedData('overlays', 'layouts').map((list) => (list || []).filter((l) => l.id === 'pa-brb').map((l) => l.sceneType)).flat();
const dirtyAfter = profiles.summary().find((g) => g.id === 'overlays').dirty;

// A command naming the type, and a trigger on it, in this profile and then in another.
const brbChanges = [];
bus.on(EVENTS.EVENT, (e) => { if (e.type === 'layout_changed') brbChanges.push([e.data.name, e.data.sceneType]); });
store.saveAction({
  id: 'act-st-brb', name: 'on BRB type', enabled: true,
  trigger: { id: 't-st', category: 'system', type: 'layout_changed', config: { sceneType: typeId('BRB') } },
  actions: [{ id: 's-st', type: 'twitch_chat', config: { message: 'tipo pausa: {event.name}' } }],
});
said.length = 0;
runCommand('stpausa', [{ type: 'layout_switch', config: { sceneType: typeId('BRB'), transition: 'cut' } }]);
chat('!stpausa', mod);
await wait(250);
const liveA = omni.getOmnilayer().live;
// The other profile's layouts: different ids, the same types.
await store.omnilayer({ op: 'go', layoutId: 'pa-game', transition: 'cut' });
await wait(150);
store.setLayouts([lay('pb-game', 'Juego B', [], typeId('Gameplay')), lay('pb-brb', 'Pausa B', [], typeId('BRB'))]);
await wait(150);
chat('!stpausa', mod);
await wait(250);
const liveB = omni.getOmnilayer().live;
await settle();
const saidOnType = [...said];

// A type this profile has nothing for: nothing changes, and the card says why.
store.setLayouts([lay('pc-game', 'Juego C', [], typeId('Gameplay'))]);
await wait(150);
chat('!stpausa', mod);
await wait(250);
const liveC = omni.getOmnilayer().live;
const problemC = omni.getOmnilayer().problems.find((p) => p.code === 'no_type_layout');

test('a step naming a type puts that type’s layout live in whichever profile is on', () => {
  assert.equal(liveA, 'pa-brb');
  assert.equal(liveB, 'pb-brb', 'in the other profile the same command did not find its BRB');
  assert.equal(liveC, 'pc-game', 'a profile with nothing of that type still had its layout changed');
  assert.equal(problemC?.type, 'BRB', 'nothing says the type had no layout here');
});
test('a trigger on a type fires for that type’s layout in every profile, and the event says the type', () => {
  assert.ok(saidOnType.includes('tipo pausa: Pausa A') && saidOnType.includes('tipo pausa: Pausa B'), JSON.stringify(saidOnType));
  assert.ok(brbChanges.some(([name, type]) => name === 'Pausa B' && type === typeId('BRB')), JSON.stringify(brbChanges));
  assert.ok(!saidOnType.some((s) => s.includes('Juego')), 'the trigger fired for another type');
});
test('types made from the bindings reach the layouts on and the ones saved in other profiles, changing no profile’s unsaved state', () => {
  assert.deepEqual(['Starting', 'Gameplay', 'BRB'].every((n) => typeId(n)), true, JSON.stringify(made.types));
  assert.deepEqual(liveTagged, [typeId('Starting'), typeId('Gameplay'), typeId('BRB')]);
  assert.ok(savedTagged.length >= 1 && savedTagged.every((t) => t === typeId('BRB')), `a saved profile kept its layouts untyped: ${JSON.stringify(savedTagged)}`);
  assert.equal(dirtyAfter, dirtyBefore, 'tagging the layouts gave the profile unsaved changes');
  assert.ok(made.made && made.made.profiles >= 1, JSON.stringify(made.made));
});

// Turning existing commands to name types, and a type deleted.
store.setLayouts([lay('pa-start', 'Inicio A', ['Starting'], typeId('Starting')), lay('pa-brb', 'Pausa A', ['BRB'], typeId('BRB'))]);
store.saveAction({
  id: 'act-st-old', name: 'old switch', enabled: true,
  trigger: { id: 't-st-old', category: 'system', type: 'layout_changed', config: { layoutId: 'pa-start' } },
  actions: [{ id: 's-st-old', type: 'layout_switch', config: { layoutId: 'pa-brb' } }],
});
const converted = await store.omnilayer({ op: 'convert_steps' });
const oldAction = collection('actions', []).get().find((a) => a.id === 'act-st-old');
const kept = made.types.filter((t) => t.name !== 'BRB');
await store.omnilayer({ op: 'types', types: kept });
const afterDelete = collection('layouts', []).get().map((l) => l.sceneType);
const savedAfterDelete = profiles.savedData('overlays', 'layouts').flat().filter((l) => l?.sceneType === typeId('BRB')).length;

test('“use types in my commands” turns steps and triggers that name a layout with a type', () => {
  assert.ok(converted.converted.live >= 2, JSON.stringify(converted.converted));
  assert.equal(oldAction.actions[0].config.sceneType, typeId('BRB'));
  assert.equal(oldAction.trigger.config.sceneType, typeId('Starting'));
});
test('deleting a type takes it off the layouts of every profile', () => {
  assert.deepEqual(afterDelete, [typeId('Starting'), undefined]);
  assert.equal(savedAfterDelete, 0, 'a saved profile still has layouts of a deleted type');
});

// A step turned to a type that was then deleted still goes where it went before.
await store.omnilayer({ op: 'go', layoutId: 'pa-start', transition: 'cut' });
runCommand('stold', [{ type: 'layout_switch', config: { sceneType: typeId('BRB'), layoutId: 'pa-brb', transition: 'cut' } }]);
chat('!stold', mod);
await wait(250);
const fellBack = omni.getOmnilayer().live;
test('a step whose type was deleted goes to the layout it named before', () => {
  assert.equal(fellBack, 'pa-brb');
});

test('the screens: a picker on the layout, the list in the Omnilayer card, and steps and triggers that can name a type', () => {
  const layoutsView = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(layoutsView.includes('<SceneTypePicker') && layoutsView.includes('onPick={setSceneType}'), 'the layout has no type picker');
  const panel = read('../../web/components/OmnilayerPanel.tsx');
  assert.ok(panel.includes('<SceneTypesManager'), 'the Omnilayer card has no list of types');
  assert.ok(panel.includes("p.code === 'no_type_layout'"), 'the card does not say when a type had no layout');
  const types = read('../../web/components/SceneTypes.tsx');
  for (const op of ["op: 'types'", "op: 'types_from_bindings'", "op: 'convert_steps'"]) assert.ok(types.includes(op), `${op} is never sent`);
  const actions = read('../../web/components/views/ActionsView.tsx');
  assert.equal(actions.split('<LayoutTarget').length - 1, 2, 'the step and the trigger should both offer a type');
  assert.ok(read('../../web/App.tsx').includes('sceneTypes={(system.data as any).omnilayer?.types || []}'), 'the Actions screen is not given the types');
  // The list is kept with Omnilayer's settings, which no profile switches.
  const groups = read('../engine/profiles.js');
  assert.ok(!/collections: \[[^\]]*'omnilayer'/.test(groups), 'the types would change with a profile');
});

// Put everything back.
for (const id of ['act-st-brb', 'act-st-old']) store.deleteAction(id);
store.profileDelete('overlays', dupId);
await store.omnilayer({ op: 'set', settings: { enabled: false, live: '', scene: '', transition: 'cover', coverMs: 450, holdMs: 250, types: [] } });
store.setLayouts(layoutsBefore);
await wait(200);
