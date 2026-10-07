/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: a layer kept to a shape — 16:9, 4:3 — while it is resized, so
 * an OBS source's box is where the source really shows.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const { ASPECTS, aspectRatio, fitAspect, holdAspect, sizeWithAspect } = await import('../../../shared/aspect.js');
const { normaliseLayout } = await import('../../engine/layouts.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

const WIDE = 16 / 9;
const shape = (b) => b.width / b.height;

test('free is free, and only the shapes offered are shapes', () => {
  assert.equal(ASPECTS[0], '', 'free is not the first choice');
  for (const a of ['16:9', '4:3', '1:1', '9:16', '21:9']) assert.ok(ASPECTS.includes(a), `${a} is not offered`);
  assert.equal(aspectRatio(''), null);
  assert.equal(aspectRatio('16:9'), WIDE);
  assert.equal(aspectRatio('7:3'), null, 'a shape nobody offered was taken');
  assert.equal(aspectRatio('16:9; color: red'), null);
});

test('picking a shape fits the box inside the one it had, on the same centre', () => {
  const box = { x: 100, y: 100, width: 800, height: 800 };
  const wide = fitAspect(box, WIDE);
  assert.deepEqual(wide, { x: 100, y: 275, width: 800, height: 450 });
  const tall = fitAspect({ x: 0, y: 0, width: 1600, height: 450 }, WIDE);
  assert.equal(tall.height, 450, 'a box too wide for the shape did not keep its height');
  assert.equal(tall.width, 800);
  assert.equal(tall.x, 400, 'the box did not stay on its centre');
  assert.equal(fitAspect(box, null), box);
});

test('a corner pulled keeps the shape, and the opposite corner stays where it was', () => {
  const start = { x: 100, y: 100, width: 640, height: 360 };
  // Dragged from the bottom right, mostly sideways.
  const se = holdAspect(start, { x: 100, y: 100, width: 960, height: 380 }, 'se', WIDE);
  assert.deepEqual(se, { x: 100, y: 100, width: 960, height: 540 });
  // From the top left: the bottom right corner holds.
  const nw = holdAspect(start, { x: 420, y: 90, width: 320, height: 370 }, 'nw', WIDE);
  assert.equal(nw.x + nw.width, 740);
  assert.equal(nw.y + nw.height, 460);
  assert.ok(Math.abs(shape(nw) - WIDE) < 0.02, `the shape is now ${shape(nw)}`);
});

test('a side pulled keeps the shape about the middle of the other way', () => {
  const start = { x: 100, y: 100, width: 640, height: 360 };
  const e = holdAspect(start, { x: 100, y: 100, width: 960, height: 360 }, 'e', WIDE);
  assert.deepEqual(e, { x: 100, y: 10, width: 960, height: 540 });
  const s = holdAspect(start, { x: 100, y: 100, width: 640, height: 180 }, 's', WIDE);
  assert.equal(s.height, 180);
  assert.equal(s.width, 320);
  assert.equal(s.x + s.width / 2, 420, 'the box did not shrink about its middle');
  assert.deepEqual(holdAspect(start, { x: 1, y: 2, width: 3, height: 4 }, 'se', null), { x: 1, y: 2, width: 3, height: 4 }, 'a free box was reshaped');
  const tiny = holdAspect(start, { x: 100, y: 100, width: 5, height: 5 }, 'se', WIDE);
  assert.ok(tiny.width >= 20 && tiny.height >= 20, 'a box was shrunk out of reach');
});

test('typing one side brings the other with it', () => {
  assert.deepEqual(sizeWithAspect('width', 1280, WIDE), { width: 1280, height: 720 });
  assert.deepEqual(sizeWithAspect('height', 1080, WIDE), { height: 1080, width: 1920 });
  assert.deepEqual(sizeWithAspect('width', 300, null), { width: 300 });
});

test('the server keeps a layer\'s shape, and only one that is offered', () => {
  const L = (uid, aspect) => ({ type: 'source', uid, x: 0, y: 0, width: 640, height: 360, ...(aspect !== undefined ? { aspect } : {}) });
  const saved = normaliseLayout({ id: 'x', layers: [L('a', '16:9'), L('b', ''), L('c', 'wide'), L('d')] });
  assert.equal(saved.layers[0].aspect, '16:9');
  assert.ok(saved.layers.slice(1).every((l) => !('aspect' in l)), 'a free or unknown shape was saved as one');
});

test('the editor keeps the shape on the canvas, in the size fields and across a group', () => {
  const src = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(src.includes("{(layer.type === 'source' || layer.type === 'shape') && ("), 'the shape is offered to the wrong layers');
  assert.ok(src.includes('patchLayerAndSave(layer.uid, { aspect: a, ...(a ? fitAspect(layer, aspectRatio(a)) : {}) });'), 'picking a shape does not reshape the box');
  assert.ok(src.includes('sizeWithAspect(field, Number(e.target.value) || 0, aspectRatio(layer.aspect))'), 'typing a width bends the shape');
  assert.ok(src.includes('start.some((l) => aspectRatio(l.aspect)) ? box0.width / box0.height : null'), 'stretching a group bends a layer kept to a shape');
});
