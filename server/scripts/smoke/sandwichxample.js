/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Sandwichxample (shared/sandwichxample.js), the pixel avatar
 * that is an example of everything the format holds — kept whole, kept
 * valid, and drawn differently for every face, extra, outfit and frame.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { assert, test } from './harness.js';

const { SANDWICHXAMPLE } = await import('../../../shared/sandwichxample.js');
const pa = await import('../../../shared/pixel-avatars.js');
const { AVATAR_EXPRESSIONS_LIST } = await import('../../../shared/avatar.js');
const examples = await import('../../../shared/pixel-avatar-examples.js');

const S = SANDWICHXAMPLE;
const grid = (opts) => pa.pixelGrid(S, opts).join('\n');
const FACES = [...AVATAR_EXPRESSIONS_LIST.filter((f) => f !== 'neutral'), 'blink-half', 'talking-soft', 'talking-loud'];

test('Sandwichxample is a pixel avatar the app keeps exactly as it is', () => {
  const clean = pa.cleanPixelAvatar(S);
  const { example, ...rest } = S;
  for (const key of Object.keys(rest)) assert.deepEqual(clean[key], rest[key], `cleaning it changed ${key}`);
  assert.equal(example, 'sandwichxample');
  assert.ok(JSON.stringify(S).length < pa.PIXEL_LIMITS.bytes, 'it is too big to keep');
});

test('it has every face the app asks for, side and front, and each one changes it', () => {
  const side = new Set(S.faces.map((f) => f.name));
  const front = new Set(S.turn.front.faces.map((f) => f.name));
  for (const face of FACES) {
    assert.ok(side.has(face), `no ${face} face`);
    assert.ok(front.has(face), `no ${face} face from the front`);
    assert.notEqual(grid({ faces: [face] }), grid({ faces: ['neutral'] }), `${face} looks like no face at all`);
    assert.notEqual(grid({ faces: [face], facing: 'front' }), grid({ faces: ['neutral'], facing: 'front' }), `${face} looks like no face from the front`);
  }
  // Every face its own: no two drawn alike.
  const drawn = FACES.filter((f) => !f.startsWith('talking-')).map((f) => grid({ faces: [f] }));
  assert.equal(new Set(drawn).size, drawn.length, 'two faces are drawn alike');
});

test('its extras, hats, outfits and things it does are all there, and all drawn', () => {
  const extras = S.extras.map((e) => e.name);
  assert.deepEqual(extras, ['blush', 'sweat', 'mic', 'party-hat', 'chef-hat', 'crown']);
  assert.deepEqual(pa.pixelHats(S), ['party-hat', 'chef-hat', 'crown']);
  for (const e of extras) assert.notEqual(grid({ extras: [e] }), grid({}), `${e} draws nothing`);
  // One hat at a time: the last one asked for.
  assert.equal(grid({ extras: ['party-hat', 'crown'] }), grid({ extras: ['crown'] }));
  const outfits = S.outfits.map((o) => o.name);
  assert.deepEqual(outfits, ['toasted', 'sesame', 'club']);
  for (const o of outfits) assert.notEqual(grid({ outfit: o }), grid({}), `${o} looks like the classic one`);
  assert.ok(pa.pixelOutfit(S, 'club').headwear, 'the club\'s pick is headwear');
  assert.equal(grid({ outfit: 'club', extras: ['crown'] }), grid({ outfit: 'club' }), 'a hat went on over the pick');
  for (const action of ['drink', 'wave']) {
    for (const outfit of ['', ...outfits]) {
      const frames = pa.pixelActionFrames(S, action, outfit);
      assert.ok(frames?.length >= 3, `${action} has too few frames in ${outfit || 'the classic one'}`);
      frames.forEach((_, frame) => assert.notEqual(grid({ outfit, action: { name: action, frame } }), grid({ outfit }), `${action} frame ${frame + 1} draws nothing`));
    }
  }
  assert.ok(pa.pixelActionFrames(S, 'drink', '').some((f) => f.eyes === 'shut'), 'it never shuts its eyes to sip');
});

test('from the front it wears everything too: every outfit and extra has a front version, and each shows', () => {
  const front = (opts) => grid({ ...opts, facing: 'front' });
  assert.deepEqual(S.turn.front.outfits.map((o) => o.name), S.outfits.map((o) => o.name), 'an outfit has no front version');
  assert.deepEqual(S.turn.front.extras.map((e) => e.name), S.extras.map((e) => e.name), 'an extra has no front version');
  for (const o of S.outfits) assert.notEqual(front({ outfit: o.name }), front({}), `${o.name} looks like the classic one from the front`);
  for (const e of S.extras) assert.notEqual(front({ extras: [e.name] }), front({}), `${e.name} draws nothing from the front`);
  // The same rules as from the side: one hat at a time, none over the club's pick, and faces over the outfit.
  assert.equal(front({ extras: ['party-hat', 'crown'] }), front({ extras: ['crown'] }));
  assert.equal(front({ outfit: 'club', extras: ['crown'] }), front({ outfit: 'club' }), 'a hat went on over the pick from the front');
  for (const face of ['happy', 'angry', 'talking']) {
    assert.notEqual(front({ outfit: 'toasted', faces: [face] }), front({ outfit: 'toasted' }), `${face} does not show on the toast from the front`);
  }
  // Hats sit on top of the bun: above the front view's first row, every one of them.
  const top = S.turn.front.base.findIndex((r) => /[^.]/.test(r));
  for (const hat of pa.pixelHats(S)) {
    const rows = pa.pixelGrid(S, { extras: [hat], facing: 'front' });
    assert.ok(rows.slice(0, top).some((r) => /[^.]/.test(r)), `${hat} is not on top of the bun from the front`);
  }
});

test('viewers can name every outfit, hat and action of it, in English or Spanish', () => {
  assert.equal(pa.pixelDressName(S, 'outfit', 'tostado'), 'toasted');
  assert.equal(pa.pixelDressName(S, 'outfit', 'ajonjoli'), 'sesame');
  assert.equal(pa.pixelDressName(S, 'hat', 'corona'), 'crown');
  assert.equal(pa.pixelDressName(S, 'hat', 'cocinero'), 'chef-hat');
  assert.equal(pa.pixelActionName(S, 'tomar agua'), 'drink');
  assert.equal(pa.pixelActionName(S, 'saludar'), 'wave');
});

test('in a colour, only the club\'s flag changes: the sandwich stays as it was drawn', () => {
  const original = pa.pixelColours(S, 'original');
  const red = pa.pixelColours(S, 'layout', { accent: '#2266ff' });
  const changed = S.parts.filter((p) => (red[p.id] || p.color) !== (original[p.id] || p.color)).map((p) => p.id);
  assert.deepEqual(changed.sort(), ['flag', 'flag-shade']);
});

test('it is an example of the tab, and can always be put back', () => {
  const listed = examples.pixelAvatarExamples().find((e) => e.example === 'sandwichxample');
  assert.ok(listed, 'not among the examples');
  assert.equal(listed.id, 'example-sandwichxample');
  assert.deepEqual(examples.pixelAvatarExample('sandwichxample'), listed);
  listed.name = 'changed';
  assert.equal(SANDWICHXAMPLE.name, 'Sandwichxample', 'an example handed out is a copy');
});
