/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: sharing layouts as a file (shared/layout-share.js) — one
 * layout or a profile's, without what is only the sharer's unless asked, and
 * back again as new layouts or a new overlay profile, never over what is there.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';

const S = await import('../../../shared/layout-share.js');
const { normaliseLayouts } = await import('../../engine/layouts.js');

const mine = {
  id: 'mine-1', name: 'My gameplay', width: 1920, height: 1080, accent: '#ff0000',
  scenes: ['Gameplay'], sceneType: 'gameplay',
  vertical: { boxes: { t1: { x: 0, y: 0, w: 500, h: 100 } } },
  layers: [
    { uid: 't1', type: 'text', x: 0, y: 0, w: 400, h: 80, config: { text: 'HELLO CHAT' } },
    { uid: 'a1', type: 'avatar', x: 0, y: 0, w: 300, h: 300, config: { character: 'pixel:abc', source: 'player1', costume: 'party', size: 2 } },
    { uid: 's1', type: 'source', x: 0, y: 0, w: 640, h: 360, config: { source: 'Camera' } },
    { uid: 'c1', type: 'countdown', x: 0, y: 0, w: 200, h: 80, config: { timer: 'timer-7' } },
    { uid: 'o1', type: 'omnibar', x: 0, y: 0, w: 1920, h: 60, config: { bar: 'bar-2' } },
    { uid: 'i1', type: 'images', x: 0, y: 0, w: 200, h: 200, config: { sources: ['/media/me.png', 'https://example.com/logo.png', 'media/other.gif'] } },
  ],
};
const layer = (l, uid) => l.layers.find((x) => x.uid === uid);

test('a shared layout leaves out what is the sharer\'s: scenes, scene type, avatar, sources, timers, which omnibar, uploaded pictures', () => {
  const { file, pictures } = S.shareFile([mine]);
  assert.equal(file.kind, 'simonsays-layouts');
  assert.equal(file.version, 1);
  const out = file.layouts[0];
  assert.ok(!('scenes' in out) && !('sceneType' in out));
  assert.deepEqual(layer(out, 'a1').config, { character: '', size: 2 });
  assert.equal(layer(out, 's1').config.source, '');
  assert.equal(layer(out, 'c1').config.timer, '');
  assert.ok(!('bar' in layer(out, 'o1').config));
  assert.deepEqual(layer(out, 'i1').config.sources, ['https://example.com/logo.png']);
  assert.equal(pictures, 2);
  // What a layout is made of goes as it is.
  assert.equal(layer(out, 't1').config.text, 'HELLO CHAT');
  assert.deepEqual(out.vertical, mine.vertical);
  assert.equal(out.accent, '#ff0000');
  // And the layout it came from is not changed.
  assert.equal(layer(mine, 'a1').config.character, 'pixel:abc');
  assert.deepEqual(mine.scenes, ['Gameplay']);
});

test('asked to, a shared layout keeps everything', () => {
  const { file, pictures } = S.shareFile([mine], { leaveMine: false });
  assert.deepEqual(file.layouts[0], mine);
  assert.equal(pictures, 0);
});

test('a layouts file read back gets ids of its own each time, and a file that is not one is refused with a code the screen can say', () => {
  const text = JSON.stringify(S.shareFile([mine, { ...mine, id: 'mine-2', name: 'x'.repeat(90) }]).file);
  const a = S.readShareFile(text);
  const b = S.readShareFile(text);
  assert.equal(a.length, 2);
  assert.ok(!a.some((l) => l.id.startsWith('mine-')), 'a layout kept the id it had where it was made');
  assert.notEqual(a[0].id, b[0].id);
  assert.equal(a[1].name.length, 60);
  assert.equal(normaliseLayouts(a).length, 2, 'the server would drop a shared layout');
  for (const bad of ['', 'not json', '{"kind":"other","layouts":[{}]}', '{"kind":"simonsays-layouts","layouts":[]}', '[]']) {
    let code = null;
    try { S.readShareFile(bad); } catch (err) { code = err.code; }
    assert.equal(code, 'layout_share_not_a_file', bad);
  }
});

test('a layouts file is named for the layout or profile, safe for any file system', () => {
  assert.equal(S.shareFileName('My gameplay'), 'My-gameplay.simonsays-layouts.json');
  assert.equal(S.shareFileName('a/b:c*?'), 'abc.simonsays-layouts.json');
  assert.equal(S.shareFileName(''), 'layouts.simonsays-layouts.json');
});

const before = engine.store.profileSummary().find((g) => g.id === 'overlays');
const layoutsBefore = JSON.stringify(engine.store.getLayouts());
const shared = S.readShareFile(JSON.stringify(S.shareFile([mine]).file));
engine.store.profileCreate('overlays', 'From a friend', { layouts: shared, lang: 'en' });
const made = engine.store.profileSummary().find((g) => g.id === 'overlays').profiles.find((p) => !before.profiles.some((b) => b.id === p.id));
const peeked = made ? engine.store.profilePeek('overlays', made.id) : null;

test('a layouts file can be a new overlay profile: its layouts, the starter omnibar, and nothing on screen now touched', () => {
  assert.ok(made, 'no profile was made');
  assert.equal(made.name, 'From a friend');
  assert.equal(engine.store.profileSummary().find((g) => g.id === 'overlays').active, before.active, 'making it switched to it');
  assert.equal(JSON.stringify(engine.store.getLayouts()), layoutsBefore, 'the layouts on screen changed');
  assert.equal(peeked.data.layouts.length, 1);
  assert.equal(peeked.data.layouts[0].name, 'My gameplay');
  assert.equal(peeked.data.omnibar.items[0].text, 'Go to the omnibar tab to modify what appears here!');
  // Only overlay profiles, and only from a list of layouts.
  const ws = fs.readFileSync(new URL('../api/ws.js', SCRIPT_URL), 'utf8');
  assert.ok(ws.includes("if (payload?.layouts !== undefined && (payload?.group !== 'overlays' || !Array.isArray(payload.layouts) || !payload.layouts.length)) throw refusal('layout_share_not_a_file'"));
});

test('the editor shares and adds layouts from a file, and the profile menu makes one from a file, in both languages', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('<LayoutShare layouts={layouts} working={working ? toStored(working) : null}'), 'the editor has no share');
  const share = fs.readFileSync(new URL('../../web/components/LayoutShare.tsx', SCRIPT_URL), 'utf8');
  assert.ok(share.includes('shareFile(list, { leaveMine })') && share.includes('onAdd(incoming.slice(0, room))'), 'sharing or adding lost its rules');
  const menu = fs.readFileSync(new URL('../../web/components/ProfileSwitcher.tsx', SCRIPT_URL), 'utf8');
  assert.ok(menu.includes("actions.profileCreate(group, name.trim(), { layouts, lang:"), 'the profile menu makes no profile from a file');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['layoutShare', 'layoutShareAdd', 'layoutShareAddHint', 'layoutShareTitle', 'layoutShareOne', 'layoutShareAll', 'layoutShareLeaveMine', 'layoutShareLeaveMineHint',
    'layoutShareDone', 'layoutShareLeftPictures', 'layoutShareNoRoom', 'layoutShareSomeAdded', 'layoutShareAdded', 'refuseLayoutShareNotAFile', 'profileFromFile', 'profileFromFileHint', 'profileFilePrompt']) {
    assert.equal(strings.split(`    ${key}: `).length - 1, 2, key);
  }
});
