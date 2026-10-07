/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the house avatar (shared/house-avatar.js) — what draws
 * wherever "the avatar" is wanted and none was named. In this app it is the
 * built-in one; an edition without the built-in character's art names a
 * pixel avatar instead, and then that one stands in everywhere.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const house = await import('../../../shared/house-avatar.js');
const { pixelAvatarExamples } = await import('../../../shared/pixel-avatar-examples.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const kits = [{ id: 'pa-one', name: 'One' }, { id: 'example-house', name: 'House' }];

// The module both ways, from copies with the setting changed: none, and one (tests cannot await).
const SETTING = /export const HOUSE_CHARACTER = '[^']*';/;
const source = read('../../shared/house-avatar.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-house-'));
const as = async (value, file) => {
  fs.writeFileSync(path.join(dir, file), source.replace(SETTING, `export const HOUSE_CHARACTER = '${value}';`));
  return import(pathToFileURL(path.join(dir, file)).href);
};
let none;
let one;
try {
  none = await as('', 'none.mjs');
  one = await as('example-house', 'one.mjs');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('the house avatar is one line an edition can change, and names one of its examples', () => {
  assert.ok(SETTING.test(source), 'the setting is one line an edition can change');
  if (house.HOUSE_CHARACTER) {
    assert.ok(pixelAvatarExamples().some((e) => e.id === house.HOUSE_CHARACTER), `${house.HOUSE_CHARACTER} is no example of this edition`);
  }
});

test('with no house avatar, an unnamed or missing one is the built-in one, as it always was', () => {
  assert.equal(none.kitFor('pa-one', kits).id, 'pa-one');
  assert.equal(none.kitFor('', kits), null);
  assert.equal(none.kitFor(undefined, kits), null);
  assert.equal(none.kitFor('pa-gone', kits), null);
  assert.equal(none.kitFor('pa-one', null), null, 'no list yet is nobody');
});

test('with a house avatar, it draws wherever none is named or the named one is gone', () => {
  assert.equal(one.kitFor('', kits).id, 'example-house');
  assert.equal(one.kitFor('pa-gone', kits).id, 'example-house');
  assert.equal(one.kitFor('pa-one', kits).id, 'pa-one', 'one that is named and there is still that one');
  assert.equal(one.kitFor('', [{ id: 'pa-one' }]), null, 'the house avatar deleted from the tab: nothing to stand in');
});

test('everything that draws an unnamed avatar asks for it the same way', () => {
  const uses = {
    'web/components/CanvasStage.tsx': 'kitFor(cfg.character,',
    'web/components/AvatarLayerPanel.tsx': 'kitFor(config.character, pixelAvatars)',
    'web/components/VoiceLayer.tsx': 'kitFor(look?.kit, pixelAvatars)',
    'web/components/VoicePicturesEditor.tsx': 'kitFor(look.kit, pixelAvatars)',
    'web/components/views/PngtuberView.tsx': "kitFor('', pixelAvatars)",
  };
  for (const [file, call] of Object.entries(uses)) assert.ok(read(`../../${file}`).includes(call), `${file} looks the avatar up some other way`);
  // No lookup of its own left in them: each one would ignore the house avatar.
  for (const file of Object.keys(uses)) {
    assert.ok(!/\? *(?:\(\(system\.data as any\)\.pixelAvatars \|\| \[\]\)|pixelAvatars)\.find\(\(p(?:: any)?\) => p\.id === /.test(read(`../../${file}`)), `${file} still finds the avatar itself`);
  }
  // The server keeps a layer's names by the house avatar's rules when it names none, and plays what it does from the dock.
  assert.ok(read('../engine/layouts.js').includes('const own = Boolean(character || HOUSE_CHARACTER);'));
  assert.ok(read('../engine/index.js').includes('if (HOUSE_CHARACTER && pngtuber.playAvatarAction(builtin.op)) return { ok: true };'));
  // Offered as a choice only when there is no house avatar to stand in for it.
  assert.ok(read('../../web/components/AvatarLayerPanel.tsx').includes('{!HOUSE_CHARACTER && <option value="">'));
  const constants = read('../../web/constants.ts');
  for (const key of ['pixelGoneHouse', 'pixelAvatarsHintHouse', 'pixelDeleteConfirmHouse', 'pixelDeleteTheHouse']) {
    assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
  }
});

test('the screens that tell of the built-in avatar tell of the house avatar instead, when there is one', () => {
  const tab = read('../../web/components/views/PixelAvatarsView.tsx');
  assert.ok(tab.includes('HOUSE_CHARACTER\n            ? (t.pixelAvatarsHintHouse'), 'the tab still says it sits beside a built-in avatar');
  assert.ok(tab.includes('if (id === HOUSE_CHARACTER) return t.pixelDeleteTheHouse'), 'deleting the house avatar does not say layers go blank');
  assert.ok(tab.includes("HOUSE_CHARACTER ? a.id === HOUSE_CHARACTER : a.example === 'simonsays'"), 'the examples are missed by the built-in one’s copy alone');
  // The PNGtuber screen dresses it in the house avatar's own outfits and hats, the one it was drawn in asked for by its own word.
  const png = read('../../web/components/views/PngtuberView.tsx');
  assert.ok(png.includes('[o, o || houseKit.baseWords[0], pixelOutfitName(houseKit, o, t)]'), 'the PNGtuber screen offers the built-in avatar’s outfits');
  assert.ok(png.includes('(pixelHats(houseKit) as string[]).map((h) => [h, pixelExtraName(houseKit, h, t)])'), 'the PNGtuber screen offers the built-in avatar’s hats');
});
