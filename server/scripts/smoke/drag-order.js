/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: putting lists in order by dragging a grip — where a dropped row
 * lands, steps moved inside their own branch, and every list that can be
 * reordered wired the same way.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const { moveToGap, landedAt, moveInTree } = await import('../../../shared/list-order.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

// ------------------------------------------------- where a row lands

const ABCD = ['a', 'b', 'c', 'd'];

test('a row dropped in a gap lands in that gap, from above or below', () => {
  assert.deepEqual(moveToGap(ABCD, 0, 4), ['b', 'c', 'd', 'a'], 'the first row did not go to the end');
  assert.deepEqual(moveToGap(ABCD, 3, 0), ['d', 'a', 'b', 'c'], 'the last row did not go to the start');
  assert.deepEqual(moveToGap(ABCD, 0, 2), ['b', 'a', 'c', 'd'], 'dropped between b and c, it is not there');
  assert.deepEqual(moveToGap(ABCD, 3, 1), ['a', 'd', 'b', 'c'], 'dropped between a and b, it is not there');
});

test('a drop either side of the row itself, or of a row that is not there, changes nothing', () => {
  assert.equal(moveToGap(ABCD, 1, 1), ABCD);
  assert.equal(moveToGap(ABCD, 1, 2), ABCD);
  assert.equal(moveToGap(ABCD, -1, 0), ABCD);
  assert.equal(moveToGap(ABCD, 9, 0), ABCD);
  assert.deepEqual(moveToGap(ABCD, 0, 99), ['b', 'c', 'd', 'a'], 'a gap past the end is not the end');
  assert.deepEqual(ABCD, ['a', 'b', 'c', 'd'], 'the list given was changed in place');
});

test('where a dropped row ends up is where it is, so it can stay selected', () => {
  for (let from = 0; from < ABCD.length; from += 1) {
    for (let gap = 0; gap <= ABCD.length; gap += 1) {
      const moved = moveToGap(ABCD, from, gap);
      assert.equal(moved.indexOf(ABCD[from]), landedAt(from, gap), `from ${from} to gap ${gap}`);
    }
  }
});

// ------------------------------------------------- action steps

const step = (id, then, otherwise) => ({ id, type: then ? 'condition' : 'twitch_chat', config: {}, ...(then ? { thenActions: then, elseActions: otherwise || [] } : {}) });
const TREE = [step('one'), step('if', [step('t1'), step('t2'), step('t3')], [step('e1'), step('e2')]), step('two')];
const ids = (list) => list.map((s) => s.id).join(' ');

test('an action step is moved among the steps of its own list', () => {
  assert.equal(ids(moveInTree(TREE, 'two', 0)), 'two one if', 'a top-level step did not move');
  const inThen = moveInTree(TREE, 't3', 0);
  assert.equal(ids(inThen[1].thenActions), 't3 t1 t2', 'a step inside "then" did not move');
  assert.equal(inThen[1].elseActions, TREE[1].elseActions, 'the other branch was rebuilt for nothing');
  assert.equal(inThen[0], TREE[0], 'a step nobody touched was rebuilt');
  const inElse = moveInTree(TREE, 'e1', 2);
  assert.equal(ids(inElse[1].elseActions), 'e2 e1', 'a step inside "else" did not move');
});

test('a step never leaves its branch, and a drop that moves nothing changes nothing', () => {
  // Gap 3 in "else" is past its end: the step goes last in "else", not into "then" or the top.
  const moved = moveInTree(TREE, 'e1', 3);
  assert.equal(ids(moved[1].elseActions), 'e2 e1');
  assert.equal(ids(moved[1].thenActions), 't1 t2 t3');
  assert.equal(ids(moved), 'one if two');
  assert.equal(moveInTree(TREE, 't1', 1), TREE, 'a drop where it already was rebuilt the action');
  assert.equal(moveInTree(TREE, 'nobody', 0), TREE);
});

// ------------------------------------------------- the grip, everywhere

test('the grip drags with a finger as well as a mouse, and only ever moves rows of its own list', () => {
  const hook = read('../../web/hooks/useDragOrder.tsx');
  assert.ok(hook.includes('touch-none'), 'a finger on the grip scrolls the page instead of dragging');
  assert.ok(hook.includes('setPointerCapture'), 'the drag is lost as soon as the pointer leaves the grip');
  assert.ok(hook.includes("e.key === 'Escape'"), 'a held row cannot be put back');
  assert.ok(hook.includes('requestAnimationFrame'), 'a long list cannot be crossed in one drag');
  assert.ok(hook.includes("window.addEventListener('pointerup', onUp);"), 'letting go away from the grip leaves the row held');
  assert.ok(hook.includes('[data-drag-list="${key}"]'), 'a list inside a row of another would measure both');
  assert.ok(hook.includes('now.gap !== now.from && now.gap !== now.from + 1'), 'a drop where it already was still saves');
  assert.ok(!hook.includes('draggable'), 'the browser drag and drop is back, which a finger cannot do');
});

test('every list that can be put in order has the grip', () => {
  const lists = [
    // A layer's row is drawn once for the list and for a group's folder, so it is handed the list it is in.
    ['../../web/components/views/LayoutsView.tsx', 'layerOrder', 'overlay layers', 'order'],
    // A step draws itself, so its grip and row come from the list it is handed.
    ['../../web/components/views/ActionsView.tsx', 'stepOrder', 'action steps', 'order'],
    ['../../web/components/views/ActionsView.tsx', 'thenOrder', 'steps under "then"', 'order'],
    ['../../web/components/views/ActionsView.tsx', 'elseOrder', 'steps under "else"', 'order'],
    ['../../web/components/views/AlertsView.tsx', 'variationOrder', 'alert variations'],
    ['../../web/components/views/OmnibarView.tsx', 'itemOrder', 'omnibar slots'],
    ['../../web/components/views/VoiceView.tsx', 'pinOrder', 'pinned voice people'],
    ['../../web/components/ImageLayerPanel.tsx', 'sourceOrder', 'an image layer\'s pictures'],
    ['../../web/components/views/PlayersView.tsx', 'playerOrder', 'players'],
    ['../../web/components/views/DiscordButtonsView.tsx', 'buttonOrder', 'Discord buttons'],
    ['../../web/components/views/ReactionRolesView.tsx', 'mappingOrder', 'reaction roles'],
    ['../../web/components/views/PlanView.tsx', 'stepOrder', 'the stream plan'],
    ['../../web/components/pixel/PixelEditor.tsx', 'frameOrder', 'pixel avatar frames'],
  ];
  for (const [path, name, what, via = name] of lists) {
    const src = read(path);
    assert.ok(src.includes(`const ${name} = useDragOrder(`), `${what}: no drag order`);
    assert.ok(src.includes(`${via}.grip(`), `${what}: no grip`);
    assert.ok(src.includes(`${via}.row(`) || src.includes(`${via}?.row(`), `${what}: the rows are not marked, so no gap can be measured`);
    assert.ok(src.includes(`ref={${name}.listRef}`), `${what}: the line has nowhere to be drawn`);
    assert.ok(src.includes(`{${name}.line}`), `${what}: nothing shows where the row would land`);
  }
  assert.ok(read('../../web/components/pixel/PixelEditor.tsx').includes("}, { axis: 'x' });"), 'the frame strip is measured top to bottom, but it runs left to right');
  const folder = read('../../web/components/LayerGroupFolder.tsx');
  assert.ok(folder.includes('const memberOrder = useDragOrder(') && folder.includes('renderMember(layer, memberOrder)'), 'the layers in a group cannot be put in order');
  assert.ok(folder.includes('ref={memberOrder.listRef}') && folder.includes('{memberOrder.line}'), 'a group\'s layers show nowhere to land');
});

test('a dragged action step is moved by the editor, through the same state as adding and removing', () => {
  const app = read('../../web/App.tsx');
  assert.ok(app.includes('moveInTree(prev.actions, stepId, gap)'), 'the step is moved some other way');
  assert.ok(app.includes('moveActionStep={moveActionStep}'), 'the editor is never handed the move');
  const view = read('../../web/components/views/ActionsView.tsx');
  assert.ok(view.includes('order={thenOrder} moveActionStep={moveActionStep}'), 'steps under "then" cannot be dragged');
  assert.ok(view.includes('order={elseOrder} moveActionStep={moveActionStep}'), 'steps under "else" cannot be dragged');
});

test('the omnibar grip is a grip now, not a picture of one', () => {
  const view = read('../../web/components/views/OmnibarView.tsx');
  assert.ok(!view.includes('<GripVertical size={14} className="text-zinc-700 shrink-0" />'), 'the old grip that did nothing is still there');
});

test('a dock button can be arranged with a finger too, and a mouse keeps the drag it had', () => {
  const grid = read('../../web/components/DockActionsGrid.tsx');
  assert.equal(grid.split('data-dock-cell={cell}').length - 1, 2, 'filled and empty cells are not both drop targets');
  assert.ok(grid.includes("closest<HTMLElement>('[data-dock-cell], [data-dock-page]')"), 'the cell under the finger is not looked for');
  assert.ok(grid.includes('{...touchArrange(button.id)}'), 'the buttons take no touch');
  assert.ok(grid.includes("if (e.pointerType === 'mouse') return;"), 'a mouse would be dragged twice');
  assert.ok(grid.includes('draggable={Boolean(arrange)}'), 'the mouse drag is gone');
});
