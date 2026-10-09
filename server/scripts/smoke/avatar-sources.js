/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: named pixel avatars — one avatar layer's settings under a
 * name, worn by avatar layers on any layout, the same everywhere.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const { cleanAvatarSources, normaliseLayout, MAX_AVATAR_SOURCES } = await import('../../engine/layouts.js');

const before = engine.store.avatarSources ? (engine.snapshot().avatarSources || []) : [];

test('an avatar can be named, its settings saved and renamed, and the name taken away', () => {
  const made = engine.store.avatarSources({ op: 'create', name: '  Rowan  ', config: { overwhelmCount: 4, sleepAfter: 0, label: 'Rowan', source: 'as-sneaky1' } });
  assert.match(made.id, /^as-[a-z0-9]+$/);
  const rowan = made.list.find((s) => s.id === made.id);
  assert.equal(rowan.name, 'Rowan');
  assert.deepEqual([rowan.config.overwhelmCount, rowan.config.sleepAfter, rowan.config.label], [4, 0, 'Rowan']);
  assert.equal(rowan.config.source, undefined, 'a named avatar names another');
  // Checked as an avatar layer is: past the most it takes, it takes the most.
  assert.equal(engine.store.avatarSources({ op: 'save', id: made.id, config: { overwhelmCount: 99 } }).list.find((s) => s.id === made.id).config.overwhelmCount, 6);
  assert.equal(engine.store.avatarSources({ op: 'rename', id: made.id, name: 'Rowan casual' }).list.find((s) => s.id === made.id).name, 'Rowan casual');
  // Names are unique, ignoring case; empty and missing ones are refused, in words the screen can say.
  assert.throws(() => engine.store.avatarSources({ op: 'create', name: 'ROWAN CASUAL' }), (err) => err.code === 'avatar_source_name_taken' && err.vars?.name === 'ROWAN CASUAL');
  assert.throws(() => engine.store.avatarSources({ op: 'create', name: '   ' }), (err) => err.code === 'avatar_source_name_empty');
  assert.throws(() => engine.store.avatarSources({ op: 'save', id: 'as-gone1234' }), (err) => err.code === 'avatar_source_gone');
  assert.equal(engine.store.avatarSources({ op: 'delete', id: made.id }).list.some((s) => s.id === made.id), false);
});

test('a profile keeps at most twelve, and anything malformed is dropped', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `as-many${i}x`, name: `A${i}`, config: {} }));
  assert.equal(cleanAvatarSources(many).length, MAX_AVATAR_SOURCES);
  const odd = cleanAvatarSources([{ id: 'bad id', name: 'x' }, { id: 'as-okok1', name: '' }, { id: 'as-okok2', name: 'Uno' }, { id: 'as-okok3', name: 'uno' }, { id: 'as-okok2', name: 'Dos' }]);
  assert.deepEqual(odd.map((s) => s.name), ['Uno'], 'a bad id, an empty name, a name twice or an id twice got in');
});

test('an avatar layer keeps the named avatar it wears, and only a well-formed one', () => {
  const layout = (source) => normaliseLayout({ id: 'l1', name: 'L', layers: [{ uid: 'a1', type: 'avatar', config: { label: 'Mia', source } }] });
  assert.equal(layout('as-simon1').layers[0].config.source, 'as-simon1');
  assert.equal(layout('../etc').layers[0].config.source, undefined);
  assert.equal(layout(undefined).layers[0].config.source, undefined, 'a layer wearing nothing is written differently than before');
  assert.equal(layout('as-simon1').layers[0].config.label, 'Mia', 'its own settings went when it took a name');
});

test('named avatars travel with the overlay profile, the snapshot and a backup', () => {
  assert.ok(read('../engine/profiles.js').includes("collections: ['layouts', 'omnibar', 'omnibars', 'viewers', 'avatar_sources'],"), 'switching an overlay profile keeps the other profile\'s avatars');
  assert.ok(read('../engine/index.js').includes('avatar_sources: (v) => db.avatarSources.set(cleanAvatarSources(v)),'), 'a profile\'s avatars go live unchecked');
  assert.ok(Array.isArray(engine.snapshot().avatarSources), 'the pages are not sent them');
  assert.ok(read('../engine/backup.js').includes("{ name: 'avatar_sources' }"), 'a backup leaves them out');
  const ws = read('../api/ws.js');
  assert.ok(ws.includes("'viewers', 'avatarSources',"), 'changing one does not mark the profile as changed');
  assert.ok(ws.includes('case C2S.AVATAR_SOURCES: {') && ws.includes('broadcast(S2C.CONFIG_PATCH, { avatarSources: list });'), 'a change reaches no page');
});

test('a layer wearing a named avatar draws with its settings, and the editor changes those for every layer', () => {
  const stage = read('../../web/components/CanvasStage.tsx');
  assert.ok(stage.includes("const named = cfg.source ? ((system.data as any).avatarSources || []).find((s: any) => s.id === cfg.source) : null;"), 'the stream page draws a named avatar\'s layers with their own settings');
  assert.ok(stage.includes('config={avatarCfg}') && stage.includes('kit={kitFor(avatarCfg.character,'), 'only some of the named settings are used');
  const panel = read('../../web/components/AvatarLayerPanel.tsx');
  assert.ok(panel.includes("ask({ op: 'save', id: shared.id, config: merged });"), 'a change made while wearing a name goes to this layer only');
  assert.ok(panel.includes("const answer = await ask({ op: 'create', name: naming, config: own });") && panel.includes('patchLayer({ source: answer.id });'), 'naming an avatar does not put this layer in it');
  assert.ok(panel.includes('setLayer({ ...shared.config });') && panel.includes("if (othersWearing(shared.id) === 0) ask({ op: 'delete', id: shared.id });"), 'making a layer its own loses the look, or leaves a name nobody wears');
  const view = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(view.includes('<AvatarLayerSection') && view.includes("request={(payload) => (system as any).actions.avatarSources(payload)}"), 'the editor has no say in named avatars');
  const words = read('../../web/constants.ts');
  for (const key of ['avatarSource', 'avatarSourceNone', 'avatarSourceLayerOne', 'avatarSourceLayers', 'avatarSourceAlone', 'avatarSourceSharedOne', 'avatarSourceShared', 'avatarSourceUnlink', 'avatarSourceNamePlaceholder', 'avatarSourceCreate']) {
    assert.equal(words.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
});

// Back as it was.
if (engine.store.avatarSources) for (const s of engine.snapshot().avatarSources || []) if (!before.some((b) => b.id === s.id)) engine.store.avatarSources({ op: 'delete', id: s.id });
