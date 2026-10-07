/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: pixel avatars made in the app (shared/pixel-avatars.js) —
 * first of all that the examples, the built-in avatar and the regulars
 * converted to its format, are drawn exactly as shared/avatar.js draws the
 * originals: the same pixels for every face, outfit, hat, extra, glance and
 * frame, the same colours, the same breathing split. That is what makes
 * the format able to hold everything the built-in one does.
 *
 * Runs in order with the other feature files, through scripts/smoke.js.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const avatar = await import('../../../shared/avatar.js');
const art = await import('../../../shared/avatar-art.js');
const pixel = await import('../../../shared/pixel-avatars.js');
const examples = await import('../../../shared/pixel-avatar-examples.js');
const { PLAYER_COLOURS } = await import('../../../shared/players.js');

const OUTFITS = avatar.AVATAR_COSTUMES_LIST;
const FACES = ['neutral', ...Object.keys(art.AVATAR_EXPRESSIONS)];
const LOOKS = Object.keys(avatar.AVATAR_LOOKS);

/** Every way the two could differ, gathered, so one failure names them all rather than the first. */
function compare(label, cases, built, made) {
  const wrong = [];
  for (const c of cases) {
    const a = JSON.stringify(built(c));
    const b = JSON.stringify(made(c));
    if (a !== b) wrong.push(JSON.stringify(c));
  }
  assert.equal(wrong.length, 0, `${label}: ${wrong.length} of ${cases.length} differ, e.g. ${wrong.slice(0, 3).join(' | ')}`);
  return cases.length;
}

// ------------------------------------------------- the example is the original












// ------------------------------------------------------------- kept and shared

const { engine, bus, EVENTS } = await import('./harness.js');
const kept = await import('../../engine/pixel-avatars.js');

const announced = [];
const onConfig = ({ key, value }) => { if (key === 'pixelAvatars') announced.push(value); };
bus.on(EVENTS.CONFIG, onConfig);
const ask = (payload) => { try { return engine.store.pixelAvatars(payload); } catch (err) { return { refused: err.code, why: err.message }; } };
const all = () => engine.snapshot().pixelAvatars;

/*
  The examples these tests copy, change, put back and delete: here the
  SimonSays example and a regular's. The public edition has one example,
  Sandwichxample, and does all of it to that one.
*/
let EXAMPLE = 'example-sandwichxample';
let OTHER_EXAMPLE = 'example-sandwichxample';

kept.resetForTests();
const firstIds = all().map((a) => a.id);
const made = ask({ op: 'create', name: '  Doodle  ' });
const doodle = all().find((a) => a.id === made.id);
const copied = ask({ op: 'duplicate', id: EXAMPLE });
const copy = all().find((a) => a.id === copied.id);
const renamed = ask({ op: 'rename', id: made.id, name: 'Doodle Two' });
// The example changed: one pixel of its drawing, then put back as the built-in one draws it.
const changed = structuredClone(all().find((a) => a.id === EXAMPLE));
changed.base[50] = 'O'.repeat(100);
changed.name = 'My SimonSays';
const savedChange = ask({ op: 'save', avatar: changed });
const afterChange = all().find((a) => a.id === EXAMPLE);
const reset = ask({ op: 'reset', id: EXAMPLE });
const afterReset = all().find((a) => a.id === EXAMPLE);
const notExample = ask({ op: 'reset', id: made.id });
const invalid = ask({ op: 'save', avatar: { ...doodle, base: ['nope'] } });
const unknownOp = ask({ op: 'explode', id: made.id });
const missing = ask({ op: 'delete', id: 'pa-nobody' });
const deleted = ask({ op: 'delete', id: OTHER_EXAMPLE });
const afterDelete = all().map((a) => a.id);
// Seeding again, as the next start does: a deleted example stays deleted.
kept.initPixelAvatars();
const afterRestart = all().map((a) => a.id);
const restored = ask({ op: 'restore-examples' });
const afterRestore = all().map((a) => a.id);
bus.off?.(EVENTS.CONFIG, onConfig);


test('a new avatar starts empty, with a few colours, and its name trimmed', () => {
  assert.ok(made.ok && /^pa-/.test(made.id));
  assert.equal(doodle.name, 'Doodle');
  assert.ok(doodle.base.every((row) => row === '.'.repeat(100)));
  assert.ok(doodle.parts.length >= 4);
  assert.equal(renamed.ok, true);
  assert.equal(all().find((a) => a.id === made.id).name, 'Doodle Two');
});




test('what cannot be drawn is refused with why, and nothing else changes', () => {
  assert.equal(invalid.refused, 'pixel_avatar_invalid');
  assert.match(invalid.why, /100 rows/);
  assert.equal(unknownOp.refused, 'pixel_avatar_op');
  assert.equal(missing.refused, 'pixel_avatar_missing');
});

test('a deleted example stays deleted after a restart, and can be put back from the tab', () => {
  assert.equal(deleted.ok, true);
  assert.ok(!afterDelete.includes(OTHER_EXAMPLE));
  assert.ok(!afterRestart.includes(OTHER_EXAMPLE));
  assert.equal(restored.restored, 1);
  assert.ok(afterRestore.includes(OTHER_EXAMPLE));
});

test('every change is announced to the screens, as the whole list', () => {
  // Create, copy, rename, save, reset, delete and restore: seven changes, each announced once.
  assert.equal(announced.length, 7);
  assert.deepEqual(announced.at(-1).map((a) => a.id), afterRestore);
});

// ------------------------------------------------------------- on a layer

const { normaliseLayouts } = await import('./backup-and-layouts.js');

test('an avatar layer keeps which pixel avatar it draws, with that avatar\'s own faces, outfits and hats', () => {
  const [l] = normaliseLayouts([{ id: 'p', layers: [
    { type: 'avatar', uid: 'k', config: { character: 'pa-doodle', expression: 'grumpy', costume: 'space-suit', extras: ['top-hat', 'cape', 'BAD NAME'], loudFace: 'yelling', reactions: { follow: 'grumpy', sub: 'not a face!' } } },
    { type: 'avatar', uid: 'b', config: { character: 'not an id!', expression: 'grumpy', costume: 'space-suit', extras: ['top-hat', 'blush'] } },
  ] }]);
  const [kit, built] = l.layers.map((x) => x.config);
  assert.equal(kit.character, 'pa-doodle');
  assert.equal(kit.expression, 'grumpy');
  assert.equal(kit.costume, 'space-suit');
  assert.deepEqual(kit.extras, ['top-hat', 'cape']);
  assert.equal(kit.loudFace, 'yelling');
  assert.equal(kit.reactions.follow, 'grumpy');
  assert.equal(kit.reactions.sub, avatar.AVATAR_REACTION_DEFAULTS.sub);
});


test('the layer and the tab draw a pixel avatar with the faces and lists of its own, and the built-in one with the built-in\'s', () => {
  const layer = fs.readFileSync(new URL('../../web/components/AvatarLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(layer.includes('kit ? pixelFacesNow(kit,'), 'the faces now are not the pixel avatar\'s');
  assert.ok(layer.includes('kit ? pixelColours(kit, colouring'), 'its colours are not its own');
  assert.ok(layer.includes('<PixelKitAvatar'), 'it is never drawn');
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes('kit={kitFor(cfg.character, (system.data as any).pixelAvatars)}'), 'the stage never hands a layer its pixel avatar');
});

// ------------------------------------------------------------- drawing it

const edit = await import('../../../shared/pixel-edit.js');







test('a fill, a line and a box reach exactly the cells they should', () => {
  const rows = Array.from({ length: 100 }, (_, y) => (y < 10 ? 'A'.repeat(10) + '.'.repeat(90) : '.'.repeat(100)));
  assert.equal(edit.floodCells(rows, 0, 0).length, 100);
  assert.equal(edit.floodCells(rows, 50, 50).length, 100 * 100 - 100);
  assert.deepEqual(edit.lineCells(0, 0, 3, 1), [[0, 0], [1, 0], [2, 1], [3, 1]]);
  assert.equal(edit.boxCells(0, 0, 4, 4).length, 16);
  assert.equal(edit.boxCells(0, 0, 4, 4, true).length, 25);
  assert.deepEqual(edit.mirroredCells([[0, 3, 'A']]), [[0, 3, 'A'], [99, 3, 'A']]);
});

test('a colour is added with a character of its own, and only one drawn nowhere can be taken out', () => {
  const blank = pixel.blankPixelAvatar('pa-t', 'T');
  const more = edit.addPart(blank, { name: 'Gold trim', color: '#FFD700' });
  const gold = more.parts.at(-1);
  assert.equal(gold.id, 'gold-trim');
  assert.equal(gold.color, '#ffd700');
  assert.ok(!blank.parts.some((p) => p.char === gold.char));
  const drawn = edit.paint(more, { kind: 'base' }, [[1, 1, gold.char]]);
  assert.equal(edit.partUse(drawn, gold.char), 1);
  assert.equal(edit.removePart(drawn, 'gold-trim'), drawn, 'a colour still drawn was taken out');
  assert.ok(!edit.removePart(more, 'gold-trim').parts.some((p) => p.id === 'gold-trim'));
  // The colour the avatar takes, taken out, and it takes none.
  assert.equal(edit.removePart(blank, 'clothes').colouring, null);
  assert.doesNotThrow(() => pixel.cleanPixelAvatar(drawn));
});

test('new faces, extras and outfits get names of their own, and drawings made in the tab are ones the server keeps', () => {
  let pa = pixel.blankPixelAvatar('pa-n', 'N');
  ({ avatar: pa } = edit.addFace(pa, { name: 'blink' }));
  ({ avatar: pa } = edit.addFace(pa, { label: 'Blink' }));
  assert.deepEqual(pa.faces.map((f) => f.name), ['blink', 'blink-2']);
  assert.equal(pa.faces[0].blinks, false, 'eyes shut cannot blink');
  ({ avatar: pa } = edit.addFace(pa, { name: 'talking' }));
  assert.equal(pa.faces.find((f) => f.name === 'talking').glances, true);
  ({ avatar: pa } = edit.addExtra(pa, { label: 'Top hat', hat: true }));
  ({ avatar: pa } = edit.addOutfit(pa, { label: 'Pyjamas' }));
  pa = edit.paint(pa, { kind: 'outfit', name: 'pyjamas' }, [[10, 90, 'S']]);
  pa = edit.paint(pa, { kind: 'extra', name: 'top-hat' }, [[40, 10, 'O'], [41, 10, 'O']]);
  pa = edit.setItem(pa, 'extra', 'top-hat', { words: 'top hat, Chistera ,', label: 'Top hat' });
  assert.deepEqual(pa.extras[0].words, ['top hat', 'chistera']);
  const kept = pixel.cleanPixelAvatar(pa);
  assert.deepEqual(kept.extras[0].patches, [{ at: [40, 10], rows: ['OO'] }]);
  assert.equal(pixel.pixelGrid(kept, { extras: ['top-hat'], outfit: 'pyjamas' })[90][10], 'S');
  assert.deepEqual(edit.removeItem(kept, 'outfit', 'pyjamas').outfits, []);
});

// ------------------------------------------------------------------ drawn hats





// ------------------------------------------------------------ things it does

const tuber = await import('../../engine/pngtuber.js');

test('something to do is drawn a frame at a time: added, copied, moved, timed, its eyes shut, taken out', () => {
  let { avatar: pa, name } = edit.addAction(pixel.blankPixelAvatar('pa-w', 'W'), { label: 'Wave' });
  assert.equal(name, 'wave');
  pa = edit.paint(pa, { kind: 'frame', action: 'wave', outfit: '', index: 0 }, [[70, 40, 'P']]);
  pa = edit.addFrame(pa, 'wave', '', 1, 0);
  pa = edit.paint(pa, { kind: 'frame', action: 'wave', outfit: '', index: 1 }, [[71, 38, 'P']]);
  pa = edit.addFrame(pa, 'wave', '', 2);
  pa = edit.setFrame(pa, 'wave', '', 2, { ms: 5, eyes: 'shut' });
  let frames = edit.framesOf(pa, 'wave', '');
  assert.equal(frames.length, 3);
  assert.equal(frames[2].ms, 16, 'no frame is shorter than a screen refresh');
  assert.equal(frames[2].eyes, 'shut');
  assert.deepEqual(frames[1].patches.length, 2, 'the copy kept the first frame\'s pixel and added its own');
  pa = edit.moveFrame(pa, 'wave', '', 2, -5);
  assert.equal(edit.framesOf(pa, 'wave', '')[0].eyes, 'shut');
  assert.equal(edit.framePixels(pa, 'wave', '', 2)[38][71], 'P');
  // Drawn in, the frame is over the drawing at rest — with its eyes shut, when it shuts them.
  assert.equal(edit.composed(pa, { kind: 'frame', action: 'wave', outfit: '', index: 1 })[40][70], 'P');
  pa = edit.removeFrame(edit.removeFrame(edit.removeFrame(pa, 'wave', '', 0), 'wave', '', 0), 'wave', '', 0);
  assert.equal(edit.framesOf(pa, 'wave', ''), null, 'an outfit with no frames left does not do it');
  assert.doesNotThrow(() => pixel.cleanPixelAvatar(pa));
});



// ------------------------------------------------------- in the call, turning

const { cleanPictures } = await import('../../platforms/discord-voice.js');


test('a drawing made to turn gets a front view to draw, its own faces, and keeps its writing unmirrored', () => {
  let pa = edit.paint(pixel.blankPixelAvatar('pa-t', 'T'), { kind: 'base' }, [[10, 50, 'O'], [20, 50, 'S']]);
  pa = edit.setTurns(pa, true);
  assert.deepEqual(pa.turn.front.base, pa.base, 'the front view starts as the drawing');
  pa = edit.addFrontFace(pa, 'talking');
  pa = edit.addFrontFace(pa, 'grumpy');
  assert.deepEqual(pa.turn.front.faces.map((f) => f.name), ['talking']);
  pa = edit.paint(pa, { kind: 'front' }, [[50, 50, 'H']]);
  pa = edit.paint(pa, { kind: 'front-face', name: 'talking' }, [[50, 60, 'P']]);
  pa = edit.setTurn(pa, { drawnFacing: 'right', frontHeadLastRow: 70, mirrorKeep: [[20, 50, 10, 50]] });
  const kept = pixel.cleanPixelAvatar(pa);
  assert.deepEqual(kept.turn.mirrorKeep, [[10, 50, 20, 50]]);
  assert.equal(pixel.pixelTurns(kept), true);
  assert.equal(pixel.pixelGrid(kept, { facing: 'front' })[50][50], 'H');
  assert.equal(pixel.pixelGrid(kept, { facing: 'front', faces: ['neutral', 'talking'] })[60][50], 'P');
  // Drawn facing right: facing left is the mirror — the box (10-20) lands at 79-89 — with what is in it the right way round, not reversed.
  const left = pixel.pixelGrid(kept, { facing: 'left' });
  assert.equal(left[50][79], 'O');
  assert.equal(left[50][89], 'S');
  assert.equal(left[50][10], '.');
  assert.equal(pixel.pixelGrid(kept, { facing: 'right' })[50][10], 'O');
  assert.equal(edit.setTurns(kept, false).turn, null);
});

test('outfits and extras are drawn from the front too, worn from the front by the same rules, and go with what they belong to', () => {
  let pa = edit.paint(pixel.blankPixelAvatar('pa-f', 'F'), { kind: 'base' }, [[40, 40, 'O'], [41, 40, 'O']]);
  const coat = edit.addOutfit(pa, { label: 'Coat' }); pa = coat.avatar;
  const cap = edit.addExtra(pa, { label: 'Cap', hat: true }); pa = cap.avatar;
  const glow = edit.addExtra(pa, { label: 'Glow' }); pa = glow.avatar;
  pa = edit.paint(pa, { kind: 'outfit', name: coat.name }, [[40, 60, 'S']]);
  pa = edit.paint(pa, { kind: 'extra', name: cap.name }, [[40, 20, 'H']]);
  pa = edit.setTurns(pa, true);
  // Nothing from the front yet: said, and from the front the front view as it is.
  assert.deepEqual(edit.frontMissing(pa), { outfits: [coat.name], extras: [cap.name, glow.name] });
  assert.ok(edit.pixelWarnings(pa).some((w) => w.code === 'front-missing' && w.kind === 'outfit' && w.name === coat.name));
  const plain = pixel.pixelGrid(pa, { facing: 'front' });
  assert.deepEqual(pixel.pixelGrid(pa, { facing: 'front', outfit: coat.name, extras: [cap.name] }), plain);
  // An outfit from the front starts as the front view; "back" on it is the front view again.
  pa = edit.addFrontOutfit(pa, coat.name);
  assert.deepEqual(pa.turn.front.outfits[0].rows, pa.turn.front.base);
  pa = edit.paint(pa, { kind: 'front-outfit', name: coat.name }, [[45, 70, 'S'], [40, 40, 'W']]);
  pa = edit.paint(pa, { kind: 'front-outfit', name: coat.name }, [[40, 40, '.']]);
  assert.equal(pa.turn.front.outfits[0].rows[40][40], 'O', 'back on an outfit from the front was not the front view');
  pa = edit.addFrontExtra(pa, cap.name);
  pa = edit.addFrontExtra(pa, glow.name);
  pa = edit.paint(pa, { kind: 'front-extra', name: cap.name }, [[45, 25, 'H']]);
  pa = edit.paint(pa, { kind: 'front-extra', name: glow.name }, [[60, 50, 'W']]);
  assert.deepEqual(edit.frontMissing(pa), { outfits: [], extras: [] });
  assert.equal(edit.outfitChecklist(pa, coat.name).front, true);
  // Kept by the server, worn from the front.
  const kept = pixel.cleanPixelAvatar(pa);
  const front = (opts) => pixel.pixelGrid(kept, { facing: 'front', ...opts });
  assert.equal(front({ outfit: coat.name })[70][45], 'S');
  assert.equal(front({ outfit: coat.name })[60][40], '.', 'the side\'s outfit showed from the front');
  assert.equal(front({ extras: [cap.name, glow.name] })[25][45], 'H');
  assert.equal(front({ extras: [cap.name, glow.name] })[50][60], 'W');
  assert.equal(front({ extras: [cap.name] })[20][40], '.', 'the side\'s hat showed from the front');
  // Headwear from the front too: no hat over it.
  const hooded = edit.setItem(kept, 'outfit', coat.name, { headwear: true });
  assert.equal(pixel.pixelGrid(hooded, { facing: 'front', outfit: coat.name, extras: [cap.name] })[25][45], '.');
  // A face over the outfit keeps the outfit where it paints what the front view has there.
  const withFace = pixel.cleanPixelAvatar({ ...kept, turn: { ...kept.turn, front: { ...kept.turn.front, faces: [{ name: 'talking', label: '', patches: [{ at: [44, 70], rows: ['.._'] }], glances: false, blinks: true }] } } });
  const talking = pixel.pixelGrid(withFace, { facing: 'front', outfit: coat.name, faces: ['talking'] });
  assert.equal(talking[70][45], 'S', 'a face wiped the outfit where it only kept the front view');
  // What it does is drawn from the side only.
  let acting = edit.addAction(kept, { label: 'Hop' }).avatar;
  acting = edit.paint(acting, { kind: 'frame', action: 'hop', outfit: '', index: 0 }, [[70, 70, 'O']]);
  assert.deepEqual(pixel.pixelGrid(acting, { facing: 'front', action: { name: 'hop', frame: 0 } }), pixel.pixelGrid(acting, { facing: 'front' }));
  // A colour drawn only from the front is still a colour in use.
  assert.ok(edit.partUse(kept, 'W') > 0);
  // The server keeps only front versions of outfits and extras it has, once each.
  const odd = pixel.cleanPixelAvatar({ ...kept, turn: { ...kept.turn, front: { ...kept.turn.front, outfits: [...kept.turn.front.outfits, { name: 'nope', rows: kept.turn.front.base }, kept.turn.front.outfits[0]] } } });
  assert.deepEqual(odd.turn.front.outfits.map((o) => o.name), [coat.name]);
  // Taken out with what it belongs to, or on its own.
  assert.deepEqual(edit.removeItem(kept, 'outfit', coat.name).turn.front.outfits, []);
  assert.deepEqual(edit.removeItem(kept, 'extra', glow.name).turn.front.extras.map((e) => e.name), [cap.name]);
  assert.deepEqual(edit.removeFrontVersion(kept, 'extra', cap.name).turn.front.extras.map((e) => e.name), [glow.name]);
  // An avatar from before there were front versions is kept as it was, with none.
  const older = structuredClone(kept);
  delete older.turn.front.outfits; delete older.turn.front.extras;
  assert.deepEqual(pixel.cleanPixelAvatar(older).turn.front.outfits, []);
});

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');

test('one that turns, doing something while it faces the front, turns to the side it was drawn for to do it', () => {
  const layer = read('../../web/components/AvatarLayer.tsx');
  assert.ok(layer.includes("facing={turns ? (acting && facingNow === 'front' ? kit.drawnFacing || 'left' : facingNow) : null}"));
});

// An example seeded before it was drawn from the front catches up on the next start — unless it was changed.
const { collection } = await import('../../core/store.js');
const avatarsKept = collection('pixel_avatars');
const versionsKept = collection('pixel_avatar_versions');
const keptBefore = structuredClone(avatarsKept.get());
const versionsBefore = structuredClone(versionsKept.get());
const SAND = 'example-sandwichxample';
const firstShipped = (a) => { const c = structuredClone(a); delete c.turn.front.outfits; delete c.turn.front.extras; return c; };
const asInstalled = (change = (a) => a) => avatarsKept.set({ ...avatarsKept.get(), items: avatarsKept.get().items.map((i) => (i.id === SAND ? change(firstShipped(i)) : i)), seededAs: {} });
kept.resetForTests();
const shippedSand = structuredClone(all().find((a) => a.id === SAND));
asInstalled((a) => ({ ...a, name: 'Sandy' }));
kept.catchUpForTests(Date.now());
const caughtUp = structuredClone(all().find((a) => a.id === SAND));
const caughtMark = avatarsKept.get().seededAs?.sandwichxample;
const caughtVersions = (versionsKept.get().items[SAND] || []).length;
kept.catchUpForTests(Date.now());
const secondPass = structuredClone(all().find((a) => a.id === SAND));
const secondVersions = (versionsKept.get().items[SAND] || []).length;
asInstalled((a) => ({ ...a, base: ['o'.repeat(100), ...a.base.slice(1)] }));
kept.catchUpForTests(Date.now());
const leftAlone = structuredClone(all().find((a) => a.id === SAND));
avatarsKept.set(keptBefore);
versionsKept.set(versionsBefore);

test('an example nobody changed catches up with the one shipped, keeping its name; one changed is left as it is', () => {
  assert.ok(shippedSand.turn.front.outfits.length > 0, 'the example shipped has no outfits from the front');
  assert.deepEqual(caughtUp.turn.front.outfits, shippedSand.turn.front.outfits, 'the copy from before did not catch up');
  assert.deepEqual(caughtUp.turn.front.extras, shippedSand.turn.front.extras);
  assert.equal(caughtUp.name, 'Sandy', 'catching up took its name');
  assert.equal(caughtVersions, 1, 'what it was is not kept as a version');
  assert.ok(caughtMark, 'what it is now is not remembered');
  assert.deepEqual(secondPass, caughtUp, 'a second start changed it again');
  assert.equal(secondVersions, caughtVersions, 'a second start kept another version');
  assert.equal(leftAlone.base[0], 'o'.repeat(100), 'a changed copy was replaced');
  assert.deepEqual(leftAlone.turn.front.outfits || [], [], 'a changed copy was given the new drawings');
  assert.ok(read('../engine/pixel-avatars.js').includes('markShipped(avatar);'), 'putting one back does not let it catch up again');
});

// ------------------------------------------------------------------- outfits



// ------------------------------------------------------------ drawn sheets

const imp = await import('../../../shared/pixel-import.js');

/** A picture of `rows` drawn at `scale` image pixels a drawing pixel, on a white page, with JPEG-like noise everywhere and smear at every edge. */
function drawnSheet(rows, colours, scale, { at = [7, 5], noise = 6 } = {}) {
  const width = Math.ceil(rows[0].length * scale + at[0] + 9); const height = Math.ceil(rows.length * scale + at[1] + 9);
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = Math.floor((x - at[0]) / scale); const j = Math.floor((y - at[1]) / scale);
      const c = rows[j]?.[i];
      let rgb = c && c !== '.' ? imp.hexRgb(colours[c]) : [255, 255, 255];
      // Smear: a pixel on a cell's edge is half its neighbour's.
      const fx = ((x - at[0]) / scale) % 1; const fy = ((y - at[1]) / scale) % 1;
      if (fx < 0.12 || fy < 0.12) { const n = rows[j]?.[i - 1] || '.'; const other = n !== '.' ? imp.hexRgb(colours[n]) : [255, 255, 255]; rgb = rgb.map((v, k) => (v + other[k]) / 2); }
      const k = (y * width + x) * 4;
      for (let ch = 0; ch < 3; ch += 1) data[k + ch] = Math.max(0, Math.min(255, rgb[ch] + rnd() * noise));
      data[k + 3] = 255;
    }
  }
  return { width, height, data };
}


test('a picture\'s own colours are found, the background left out, and it is placed as one stroke', () => {
  const rows = ['AB.', 'BBA'];
  const sheet = drawnSheet(rows, { A: '#123456', B: '#e0a030' }, 5);
  const cells = imp.sampleCells(sheet, { x: 7, y: 5, w: 15, h: 10 }, 3);
  const found = imp.pictureColours(cells, { background: '#ffffff' });
  assert.equal(found.length, 2);
  // The colour drawn most is first, each within a whisker of what was drawn.
  const near = (a, b) => imp.hexRgb(a).every((v, i) => Math.abs(v - imp.hexRgb(b)[i]) <= 8);
  assert.ok(near(found[0], '#e0a030') && near(found[1], '#123456'), found.join(' '));
  const stroke = imp.placeRows(['AB.', 'BBA'], 10, 20);
  assert.equal(stroke.length, 5, 'its empty pixel is left alone');
  assert.deepEqual(stroke[0], [10, 20, 'A']);
  assert.equal(imp.placeRows(['A.'], 0, 0, { clear: true })[1][2], '_');
  assert.ok(imp.isBackground([0, 0, 0, 0]) && !imp.isBackground([0, 0, 0, 255]));
});

// --------------------------------------------------------------- setting up

test('a new avatar is set up to take a colour: its main part exactly, the parts that follow it, its eyes softer', () => {
  let pa = pixel.blankPixelAvatar('pa-c', 'C');
  pa = edit.setColouring(pa, { main: 'clothes', coloured: ['clothes-shadow', 'eye', 'gone'], eyes: ['eye', 'skin'], suit: { armour: 'nope' } });
  assert.deepEqual(pa.colouring, { main: 'clothes', coloured: ['clothes', 'clothes-shadow', 'eye'], eyes: ['eye'], suit: null });
  const red = pixel.pixelColours(pa, 'red');
  assert.equal(red.clothes, PLAYER_COLOURS.red.toLowerCase(), 'the main part does not take the colour exactly');
  assert.ok(red['clothes-shadow'] && red.eye && !red.skin);
  assert.equal(edit.setColouring(pa, null).colouring, null);
  assert.doesNotThrow(() => pixel.cleanPixelAvatar(pa));
});

test('a new avatar\'s eyes are guessed, kept, and move by themselves; taken away, its faces stop glancing', () => {
  let pa = pixel.blankPixelAvatar('pa-e', 'E');
  // Two eyes: a dark ring, an iris, a white with a sparkle.
  const eye = (x0) => [[x0, 55, 'O'], [x0 + 1, 55, 'O'], [x0 + 2, 55, 'O'], [x0, 56, 'O'], [x0 + 1, 56, 'W'], [x0 + 2, 56, 'I'], [x0 + 3, 56, 'I'], [x0, 57, 'O'], [x0 + 1, 57, 'W'], [x0 + 2, 57, 'I'], [x0 + 3, 57, 'W']];
  pa = edit.paint(pa, { kind: 'base' }, [...eye(32), ...eye(58), [45, 40, 'P'], [46, 40, 'P']]);
  const guess = edit.guessEyes(pa);
  assert.equal(guess.line, 'O');
  assert.equal(guess.shine, 'W');
  assert.equal(guess.lid, 'P');
  pa = edit.setEyes(pa, { ...guess, boxes: [[31, 37], [57, 63]], rows: [55, 57], split: 56, lidRow: 57, lashes: [53, 54] });
  ({ avatar: pa } = edit.addFace(pa, { name: 'talking' }));
  const kept = pixel.cleanPixelAvatar(pa);
  const rest = pixel.pixelGrid(kept, {});
  const looking = pixel.pixelGrid(kept, { eyes: { look: 'left' } });
  const half = pixel.pixelGrid(kept, { eyes: { half: true } });
  assert.notDeepEqual(looking, rest, 'the eyes do not glance');
  assert.notDeepEqual(half, rest, 'the eyes do not half-shut');
  assert.equal(edit.setEyes(kept, null).faces.find((f) => f.name === 'talking').glances, false);
});

test('a part is set to be carried, drawn over a hat, float or pop, and see-through; the outfit it was drawn in named', () => {
  let pa = pixel.blankPixelAvatar('pa-p', 'P');
  pa = edit.setPart(pa, 'white', { carried: true, overHat: true, effect: 'float', opacity: 0.5 });
  assert.deepEqual(pa.split.carried, ['white']);
  assert.deepEqual(pa.overHat, ['white']);
  assert.equal(pa.parts.find((p) => p.id === 'white').effect, 'float');
  assert.equal(pa.parts.find((p) => p.id === 'white').opacity, 0.5);
  pa = edit.setPart(pa, 'white', { carried: false, effect: '', opacity: 1 });
  assert.deepEqual(pa.split.carried, []);
  assert.equal(pa.parts.find((p) => p.id === 'white').effect, undefined);
  assert.equal(pa.parts.find((p) => p.id === 'white').opacity, undefined);
  pa = edit.setBaseOutfit(pa, { label: 'Jumper', words: 'jumper, Sweater' });
  assert.deepEqual([pa.baseLabel, pa.baseWords], ['Jumper', ['jumper', 'sweater']]);
  assert.equal(pixel.pixelDressName(pa, 'outfit', 'put the sweater on'), '');
  assert.doesNotThrow(() => pixel.cleanPixelAvatar(pa));
});

test('a reference picture is fitted inside the drawing keeping its shape, and lands on a drawn hat\'s grid where it is on the head', () => {
  assert.deepEqual(edit.fitReference(400, 200), { x: 0, y: 25, w: 100 });
  assert.deepEqual(edit.fitReference(300, 600), { x: 25, y: 0, w: 50 });
  assert.deepEqual(edit.fitReference(0, 10), { x: 0, y: 0, w: 100 });
  const onHat = edit.referenceOnHat({ x: 10, y: 4, w: 60, opacity: 0.5 }, { x: 4, y: -2, size: 1.5 });
  assert.deepEqual(onHat, { x: 4, y: 4, w: 40, opacity: 0.5 });
});

// ------------------------------------------------------- selecting and copying

test('a box of the drawing is picked up, moved and put down: where it was is empty, where it went has it', () => {
  let pa = edit.paint(pixel.blankPixelAvatar('pa-s', 'S'), { kind: 'base' }, [[10, 10, 'O'], [11, 10, 'S'], [10, 11, 'P']]);
  const lifted = edit.liftBox(pa, { kind: 'base' }, [12, 12, 9, 9]);
  assert.deepEqual(lifted, { x: 9, y: 9, rows: ['....', '.OS.', '.P..', '....'] });
  pa = edit.vacateBox(pa, { kind: 'base' }, [9, 9, 12, 12]);
  pa = edit.stampRows(pa, { kind: 'base' }, { ...lifted, x: 50, y: 60 });
  assert.equal(pa.base[10].slice(9, 13), '....');
  assert.equal(pa.base[61].slice(50, 54), '.OS.');
  assert.equal(pa.base[62][51], 'P');
  assert.deepEqual(edit.flipRows(['ab', 'cd'], 'h'), ['ba', 'dc']);
  assert.deepEqual(edit.flipRows(['ab', 'cd'], 'v'), ['cd', 'ab']);
});



test('mirrored drawing goes across a line that moves, and the middle of a drawing is found', () => {
  assert.deepEqual(edit.mirroredCells([[40, 5, 'A']], 100, 45), [[40, 5, 'A'], [50, 5, 'A']]);
  assert.deepEqual(edit.mirroredCells([[40, 5, 'A']], 100, 45.5), [[40, 5, 'A'], [51, 5, 'A']]);
  assert.deepEqual(edit.mirroredCells([[0, 0, 'A']]), [[0, 0, 'A'], [99, 0, 'A']]);
  const two = Array.from({ length: 100 }, (_, y) => (y === 3 ? `${'.'.repeat(10)}A${'.'.repeat(19)}B${'.'.repeat(69)}` : '.'.repeat(100)));
  assert.equal(edit.drawnMiddle(two), 20);
  assert.equal(edit.drawnMiddle(Array(100).fill('.'.repeat(100))), 49.5, 'nothing drawn: the grid\'s own middle');
});

test('a colour\'s shadow and highlight are added beside it, the same hue, darker and lighter', () => {
  const pa = edit.addShades(pixel.blankPixelAvatar('pa-sh', 'Sh'), 'clothes');
  const [shadow, light] = pa.parts.slice(-2);
  assert.equal(shadow.name, 'Clothes shadow');
  assert.equal(light.name, 'Clothes highlight');
  const [h0, , l0] = avatar.hexToHsl('#a56cae');
  const [h1, , l1] = avatar.hexToHsl(shadow.color);
  const [h2, , l2] = avatar.hexToHsl(light.color);
  assert.ok(Math.abs(h1 - h0) < 2 && Math.abs(h2 - h0) < 2, 'the hue moved');
  assert.ok(l1 < l0 && l2 > l0);
  assert.doesNotThrow(() => pixel.cleanPixelAvatar(pa));
});

// ---------------------------------------------------------------- warnings

test('before saving it says what is worth a look: a face below the head, an empty face or frame, colours drawn nowhere', () => {
  let pa = pixel.blankPixelAvatar('pa-w', 'W');
  pa = edit.paint(pa, { kind: 'base' }, [[50, 50, 'O']]);
  ({ avatar: pa } = edit.addFace(pa, { label: 'Low' }));
  pa = edit.paint(pa, { kind: 'face', name: 'low' }, [[50, 90, 'S']]);
  ({ avatar: pa } = edit.addFace(pa, { label: 'Nothing yet' }));
  ({ avatar: pa } = edit.addAction(pa, { label: 'Wave' }));
  const codes = edit.pixelWarnings(pa).map((w) => `${w.code}:${w.name || w.parts?.length}`);
  assert.ok(codes.includes('face-below-head:low'));
  assert.ok(codes.includes('empty:nothing-yet'));
  assert.ok(codes.includes('empty:wave'), 'the empty frame of something new to do');
  assert.ok(codes.some((c) => c.startsWith('unused-colours:')));
});



// ---------------------------------------------------------------- GIFs

const gif = await import('../../../shared/gif.js');

/** A GIF read back: its size, colours, and each frame's pixels and delay — a decoder written from the format, to hold the encoder to it. */
function readGif(bytes) {
  let p = 6;
  const u16 = () => { const v = bytes[p] | (bytes[p + 1] << 8); p += 2; return v; };
  const width = u16(); const height = u16();
  const packed = bytes[p]; p += 3;
  const size = 1 << ((packed & 7) + 1);
  const table = []; for (let i = 0; i < size; i += 1) { table.push([bytes[p], bytes[p + 1], bytes[p + 2]]); p += 3; }
  const frames = []; let control = { delay: 0, transparent: -1 }; let loops = false;
  while (p < bytes.length) {
    const b = bytes[p]; p += 1;
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = bytes[p]; p += 1;
      if (label === 0xf9) { p += 1; const flags = bytes[p]; p += 1; control = { delay: u16(), transparent: flags & 1 ? bytes[p] : -1 }; p += 2; continue; }
      if (label === 0xff) loops = true;
      while (bytes[p]) p += bytes[p] + 1;
      p += 1;
      continue;
    }
    if (b === 0x2c) {
      p += 8; p += 1;
      const min = bytes[p]; p += 1;
      const data = [];
      while (bytes[p]) { data.push(...bytes.slice(p + 1, p + 1 + bytes[p])); p += bytes[p] + 1; }
      p += 1;
      // LZW, read back.
      const clear = 1 << min; const eoi = clear + 1;
      let codeSize = min + 1; let dict; let prev = null; let cur = 0; let bits = 0; const out = [];
      const reset = () => { dict = Array.from({ length: clear }, (_, i) => [i]); dict.push(null, null); codeSize = min + 1; prev = null; };
      reset();
      outer: for (const byte of data) {
        cur |= byte << bits; bits += 8;
        while (bits >= codeSize) {
          const code = cur & ((1 << codeSize) - 1); cur >>>= codeSize; bits -= codeSize;
          if (code === clear) { reset(); continue; }
          if (code === eoi) break outer;
          const entry = code < dict.length ? dict[code] : [...prev, prev[0]];
          out.push(...entry);
          if (prev) { dict.push([...prev, entry[0]]); if (dict.length === (1 << codeSize) && codeSize < 12) codeSize += 1; }
          prev = entry;
        }
      }
      frames.push({ delay: control.delay, pixels: out.map((i) => (i === control.transparent ? null : table[i])) });
    }
  }
  return { width, height, frames, loops };
}

test('an animated GIF is written that reads back pixel for pixel: colours, see-through, each frame\'s delay, looping', () => {
  const width = 37; const height = 23;
  const frame = (seed) => {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      const v = (i * 7 + seed * 13) % 19;
      if (v === 0) continue; // see-through
      rgba[i * 4] = (v * 40) % 256; rgba[i * 4 + 1] = (v * 90) % 256; rgba[i * 4 + 2] = (v * 17) % 256; rgba[i * 4 + 3] = 255;
    }
    return rgba;
  };
  const frames = [{ rgba: frame(1), ms: 450 }, { rgba: frame(2), ms: 250 }, { rgba: frame(3), ms: 900 }];
  const back = readGif(gif.encodeGif({ width, height, frames }));
  assert.equal(back.width, width); assert.equal(back.height, height);
  assert.ok(back.loops);
  assert.deepEqual(back.frames.map((f) => f.delay), [45, 25, 90]);
  back.frames.forEach((f, n) => {
    const rgba = frames[n].rgba;
    f.pixels.forEach((px, i) => {
      if (rgba[i * 4 + 3] < 128) assert.equal(px, null, `frame ${n} pixel ${i} should be see-through`);
      else assert.deepEqual(px, [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]], `frame ${n} pixel ${i}`);
    });
  });
});

test('a big busy picture, enough to fill the compression table and start it again, reads back exactly', () => {
  const width = 300; const height = 200;
  const rgba = new Uint8ClampedArray(width * height * 4);
  let s = 3;
  for (let i = 0; i < width * height; i += 1) { s = (s * 1103515245 + 12345) & 0x7fffffff; const v = s % 200; rgba[i * 4] = v; rgba[i * 4 + 1] = 255 - v; rgba[i * 4 + 2] = (v * 3) % 256; rgba[i * 4 + 3] = 255; }
  const back = readGif(gif.encodeGif({ width, height, frames: [{ rgba, ms: 100 }], loop: false }));
  assert.equal(back.loops, false);
  let wrong = 0;
  back.frames[0].pixels.forEach((px, i) => { if (!px || px[0] !== rgba[i * 4] || px[1] !== rgba[i * 4 + 1] || px[2] !== rgba[i * 4 + 2]) wrong += 1; });
  assert.equal(wrong, 0);
});

// ---------------------------------------------------------------- versions


// ------------------------------------------------------ alerts and the dock

const docks = await import('../../../shared/dock-builtins.js');

test('an avatar layer keeps what it does at each kind of alert, and a layer that does nothing is written as before', () => {
  const [l] = normaliseLayouts([{ id: 'r', layers: [
    { type: 'avatar', uid: 'a', config: { reactionActions: { raid: 'drink', follow: 'jump!', sub: 'wave' } } },
    { type: 'avatar', uid: 'b', config: { character: 'pa-x', reactionActions: { raid: 'wave', hype: 'BAD' } } },
    { type: 'avatar', uid: 'c', config: {} },
  ] }]);
  const [built, kit, none] = l.layers.map((x) => x.config);
  assert.deepEqual(kit.reactionActions, { raid: 'wave' });
  assert.ok(!('reactionActions' in none));
  const layer = fs.readFileSync(new URL('../../web/components/AvatarLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(layer.includes('config.reactionActions?.[k]') && layer.includes('setDoing({ name, key: `alert:${alert.id}` })'), 'the layer never plays what it does at an alert');
});

test('something a tab avatar does is a dock button of its own, played on every avatar that does it, and refused when none does', () => {
  const b = docks.dockBuiltin(docks.pixelActionBuiltinId('wave-hello'));
  assert.deepEqual([b.category, b.op, b.name, b.pixel], ['avatar', 'wave-hello', 'Wave hello', true]);
  assert.equal(docks.dockBuiltin('avatar_do:NOT OK'), null);
  assert.equal(docks.dockBuiltin('avatar_drink').op, 'drink', 'the built-in ones are as they were');
});

let { avatar: dockPa } = edit.addAction(pixel.blankPixelAvatar('pa-dock', 'Docky'), { label: 'Wave hello' });
engine.store.pixelAvatars({ op: 'save', avatar: dockPa });
const dockPlayed = await engine.runDockBuiltin('avatar_do:wave-hello');
let dockRefused = null;
try { await engine.runDockBuiltin('avatar_do:juggle'); } catch (err) { dockRefused = err.code; }
const dockBefore = engine.snapshot().dockButtons;
const dockKept = engine.store.setDockButtons([{ id: 'd1', builtin: 'avatar_do:wave-hello' }]);
engine.store.setDockButtons(dockBefore);
engine.store.pixelAvatars({ op: 'delete', id: 'pa-dock' });

test('the dock plays it, refuses what no avatar does, and keeps such a button', () => {
  assert.equal(dockPlayed.ok, true);
  assert.equal(dockRefused, 'avatar_cannot_do');
  assert.ok(JSON.stringify(dockKept).includes('avatar_do:wave-hello'), JSON.stringify(dockKept).slice(0, 200));
});
