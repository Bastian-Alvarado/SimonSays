/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: groups of overlay layers — folders in the editor's list whose
 * layers move and resize together on the canvas.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const {
  tidyGroups, displayUnits, dropInGroup, groupBox, fitGroup, groupLayers, ungroupLayers, groupKey, MAX_GROUPS,
} = await import('../../../shared/layer-groups.js');
const { dropLayer } = await import('../../../shared/layer-order.js');
const { normaliseLayout } = await import('../../engine/layouts.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

// Back first, as a layout keeps them.
const L = (uid, group, box = {}) => ({ uid, type: 'text', x: 0, y: 0, width: 100, height: 100, ...(group ? { group } : {}), ...box });
const uids = (layers) => layers.map((l) => l.uid).join(' ');
const G = [{ id: 'cam', name: 'Webcam' }];

// ------------------------------------------------- what a group is kept as

test('a layout without groups is kept exactly as it was', () => {
  const layers = [L('a'), L('b'), L('c')];
  const tidy = tidyGroups(layers, undefined);
  assert.equal(uids(tidy.layers), 'a b c');
  assert.deepEqual(tidy.groups, []);
  const saved = normaliseLayout({ id: 'x', layers });
  assert.ok(!('groups' in saved), 'a layout with no groups gained a groups field');
  assert.ok(saved.layers.every((l) => !('group' in l)), 'a layer in no group gained a group field');
});

test('a group\'s layers are kept side by side, where the frontmost of them was', () => {
  // b and d are in the group; d is in front, so the group sits where d was, b just behind it.
  const tidy = tidyGroups([L('a'), L('b', 'cam'), L('c'), L('d', 'cam'), L('e')], G);
  assert.equal(uids(tidy.layers), 'a c b d e');
});

test('a layer naming a group that is gone is in none, and a group with nothing in it goes', () => {
  const tidy = tidyGroups([L('a', 'nope'), L('b', 'cam')], [...G, { id: 'empty', name: 'Empty' }, { id: 'bad id!', name: 'Bad' }, { id: 'cam', name: 'Twice' }]);
  assert.ok(!('group' in tidy.layers[0]), 'a layer kept a group that is not there');
  assert.deepEqual(tidy.groups, [{ id: 'cam', name: 'Webcam' }], 'an empty, a malformed or a repeated group survived');
  const many = Array.from({ length: MAX_GROUPS + 5 }, (_, i) => ({ id: `g${i}`, name: `G${i}` }));
  assert.equal(tidyGroups(many.map((g, i) => L(`l${i}`, g.id)), many).groups.length, MAX_GROUPS);
  assert.equal(tidyGroups([L('a', 'cam')], [{ id: 'cam', name: '   ' }]).groups[0].name, 'Group', 'a group was kept with no name');
});

test('the server keeps a layout\'s groups, and only ones that hold something', () => {
  const saved = normaliseLayout({
    id: 'x',
    groups: [{ id: 'cam', name: '  Webcam   frame ' }, { id: 'ghost', name: 'Ghost' }],
    layers: [L('a', 'cam'), L('b'), L('c', 'cam'), L('d', 'ghost!')],
  });
  assert.deepEqual(saved.groups, [{ id: 'cam', name: 'Webcam frame' }]);
  assert.equal(saved.layers.map((l) => `${l.uid}:${l.group || '-'}`).join(' '), 'b:- a:cam c:cam d:-');
  assert.deepEqual(normaliseLayout(saved), saved, 'saving it again changes it');
});

// ------------------------------------------------- the list

const STACK = [L('a'), L('b', 'cam'), L('c', 'cam'), L('d')];

test('the list shows a group as one row holding its layers, front first', () => {
  const units = displayUnits(STACK);
  assert.deepEqual(units.map((u) => u.id), ['d', groupKey('cam'), 'a']);
  assert.equal(uids(units[1].layers), 'c b');
});

test('a group dragged in the list takes all of its layers, and nothing lands inside it', () => {
  assert.equal(uids(dropLayer(STACK, groupKey('cam'), 0)), 'a d b c', 'the group did not come to the front whole');
  assert.equal(uids(dropLayer(STACK, groupKey('cam'), 3)), 'b c a d', 'the group did not go to the back whole');
  // d dropped below the group's row goes behind the whole group, not between its layers.
  assert.equal(uids(dropLayer(STACK, 'd', 2)), 'a d b c');
  assert.equal(uids(dropLayer([L('a'), L('b'), L('c')], 'c', 3)), 'c a b', 'a layout with no groups drags as it did');
});

test('a layer in a group is dragged among the group\'s layers only', () => {
  const three = [L('a'), L('x', 'cam'), L('y', 'cam'), L('z', 'cam'), L('d')];
  // Shown z y x: x dragged to the top of the group.
  assert.equal(uids(dropInGroup(three, 'cam', 'x', 0)), 'a y z x d');
  assert.equal(uids(dropInGroup(three, 'cam', 'z', 3)), 'a z x y d');
  assert.equal(dropInGroup(three, 'cam', 'y', 1), three, 'a drop where it already was changed something');
});

test('layers go into a group and come out of one, the group closing up behind them', () => {
  const made = groupLayers([L('a'), L('b'), L('c'), L('d')], [], ['a', 'c'], { id: 'g', name: 'Pair' });
  assert.equal(made.layers.map((l) => `${l.uid}:${l.group || '-'}`).join(' '), 'b:- a:g c:g d:-');
  assert.deepEqual(made.groups, [{ id: 'g', name: 'Pair' }]);
  const added = groupLayers(made.layers, made.groups, ['d'], made.groups[0]);
  assert.equal(added.groups.length, 1, 'adding to a group made another');
  assert.equal(added.layers.filter((l) => l.group === 'g').length, 3);
  const left = ungroupLayers(added.layers, added.groups, { uid: 'a' });
  assert.ok(!('group' in left.layers.find((l) => l.uid === 'a')), 'the layer is still in the group');
  const gone = ungroupLayers(added.layers, added.groups, { group: 'g' });
  assert.deepEqual(gone.groups, [], 'an ungrouped group is still there');
  assert.ok(gone.layers.every((l) => !('group' in l)));
});

// ------------------------------------------------- the canvas

const BOXES = [L('a', 'cam', { x: 100, y: 100, width: 200, height: 100 }), L('b', 'cam', { x: 300, y: 150, width: 100, height: 150 })];

test('a group\'s box is what its layers fill between them', () => {
  assert.deepEqual(groupBox(BOXES), { x: 100, y: 100, width: 300, height: 200 });
  assert.equal(groupBox([]), null);
});

test('a group moved moves every layer by the same amount', () => {
  const from = groupBox(BOXES);
  const fit = fitGroup(BOXES, from, { ...from, x: 150, y: 80 });
  assert.deepEqual(fit.a, { x: 150, y: 80, width: 200, height: 100 });
  assert.deepEqual(fit.b, { x: 350, y: 130, width: 100, height: 150 });
});

test('a group stretched keeps every layer in its place in the box, stretched the same', () => {
  const from = groupBox(BOXES);
  // Twice as wide, half as tall, pulled from the top left.
  const fit = fitGroup(BOXES, from, { x: 0, y: 200, width: 600, height: 100 });
  assert.deepEqual(fit.a, { x: 0, y: 200, width: 400, height: 50 });
  assert.deepEqual(fit.b, { x: 400, y: 225, width: 200, height: 75 });
  const tiny = fitGroup(BOXES, from, { x: 0, y: 0, width: 30, height: 20 });
  assert.ok(Object.values(tiny).every((p) => p.width >= 20 && p.height >= 20), 'a layer was shrunk out of existence');
});

// ------------------------------------------------- the editor

test('on the canvas a group moves and resizes as one, and a locked layer holds it', () => {
  const src = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(src.includes("layer.group && !active ? startGroupDrag(e, layer.group, 'move') : startDrag(e, layer, 'move')"), 'pressing a grouped layer does not take its group');
  assert.ok(src.includes('patchMany(fitGroup(start, box0, box));'), 'a group\'s layers are moved some other way');
  assert.ok(src.includes('if (!box0 || start.some((l) => l.locked)) return;'), 'a locked layer gives way when its group is dragged');
  assert.ok(src.includes("onPointerDown={(e) => startGroupDrag(e, chosenGroup.id, grip)}"), 'the group has no handles');
  assert.ok(src.includes('onDoubleClick={(e) => pickInGroup(e, chosenGroup.id, chosenBox)}'), 'there is no way through a group to one of its layers');
  assert.ok(src.includes('if (selectedGroup && !selectedLayer) {'), 'the arrow keys do not move a group');
  // The resize a group gets is the one a layer gets.
  assert.ok(src.includes('patchLayer(start.uid, holdAspect(start, pullEdges(start, mode, dx, dy, layout, ev.shiftKey), mode, aspectRatio(start.aspect)));'), 'a layer is resized some other way than a group');
});

test('the list makes groups, folds them, and keeps everything a layer row had', () => {
  const src = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(src.includes('data-layer-group-start') && src.includes('onClick={makeGroup}'), 'there is no way to make a group');
  assert.ok(src.includes('renderMember={layerRow}'), 'a group\'s layers are drawn differently from the rest');
  assert.ok(src.includes('data-layer-leave') && src.includes('leaveGroup(layer.uid)'), 'a layer cannot be taken out of its group');
  assert.ok(src.includes('saveGroups(tidy.layers as CanvasLayer[], tidy.groups);'), 'groups are saved without being tidied');
  const folder = read('../../web/components/LayerGroupFolder.tsx');
  assert.ok(folder.includes('onLock(!allLocked)') && folder.includes('onShow(!anyShown)'), 'a group cannot be locked or hidden whole');
  assert.ok(folder.includes('data-layer-ungroup'), 'a group cannot be undone from its row');
});

test('groups start folded, and open for a layer chosen in them and for one just made', () => {
  const src = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(src.includes('const [opened, setOpened] = useState<string[]>([]);'), 'groups do not start folded');
  assert.ok(src.includes('open={Boolean(picking) || opened.includes(unit.group)}'));
  // A layer chosen on the canvas inside a folded group: its row and settings would be hidden.
  assert.ok(src.includes('const gid = selectedLayer ? workingRef.current?.layers.find((l) => l.uid === selectedLayer)?.group : null;') && src.includes('if (gid) openGroup(gid);'), 'a layer chosen in a folded group stays hidden');
  assert.ok(src.slice(src.indexOf('const makeGroup = () => {'), src.indexOf('const ungroup = ')).includes('openGroup(group.id);'), 'a group just made opens folded');
});
