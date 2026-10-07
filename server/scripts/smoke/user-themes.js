/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: themes made in the app (shared/user-themes.js and
 * server/engine/user-themes.js) — kept only as the Library can draw them,
 * copies of the shipped themes that lose nothing, a stylesheet's defaults
 * changed in its text, and the Library's screens for making and changing
 * them.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, EVENTS, fs, test } from './harness.js';

const ut = await import('../../../shared/user-themes.js');
const { CSS_LOOKS, ALL_PRESETS } = await import('../../../shared/css-presets.js');
const { readFields } = await import('../../../shared/css-fields.js');
const apply = await import('../../../shared/theme-apply.js');
const { MAX_SCOPED_CSS, MAX_ALERT_CSS, MAX_CHAT_CSS } = await import('../../../shared/clean-css.js');
const server = await import('../../engine/user-themes.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

// ------------------------------------------------------------ the shape of one

test('a theme of the streamer’s own is kept only as the Library can draw it', () => {
  assert.throws(() => ut.cleanUserTheme({ name: 'x' }), /needs an id/);
  assert.throws(() => ut.cleanUserTheme({ id: 'ut-abcd', objects: [{ layerType: 'nope', css: '' }] }), /nothing a theme dresses/);
  assert.throws(() => ut.cleanUserTheme({ id: 'ut-abcd', objects: Array.from({ length: ut.MAX_THEME_PIECES + 1 }, () => ({ layerType: 'text' })) }), /up to/);
  const long = 'a'.repeat(9000);
  const th = ut.cleanUserTheme({
    id: 'ut-abcd', name: '  Neon   nights ', from: 'cyberpunky',
    objects: [
      { id: 'one', layerType: 'text', name: 'Words', css: long },
      { id: 'one', layerType: 'alert', css: long, kind: 'motion', previewWith: 'nowhere' },
      { id: 'chat-1', layerType: 'chat', css: `${long}</style>`, previewTall: true, previewSize: { width: 5000, height: 2 }, previewConfig: { label: 'Live', nested: { no: 1 }, 'bad key': 1 } },
      { id: 'bar', layerType: 'omnibar', css: '', previewTall: true },
    ],
  });
  assert.equal(th.name, 'Neon nights');
  assert.equal(th.from, 'cyberpunky');
  // Each piece held to the room its kind has on a layer, an alert or the chat.
  assert.deepEqual(th.objects.map((o) => o.css.length), [MAX_SCOPED_CSS, MAX_ALERT_CSS, MAX_CHAT_CSS, 0]);
  assert.ok(!th.objects[2].css.includes('</style'));
  // Two pieces with one id are two pieces; a motion over a look that is not there is over nothing.
  assert.equal(new Set(th.objects.map((o) => o.id)).size, 4);
  assert.equal(th.objects[1].previewWith, undefined);
  assert.equal(th.objects[1].kind, 'motion');
  assert.equal(th.objects[1].applies, 'alert');
  assert.equal(th.objects[2].applies, 'chat');
  // A tall-bar look only on a bar; a preview size kept within a canvas; a preview's settings kept flat.
  assert.equal(th.objects[2].previewTall, undefined);
  assert.equal(th.objects[3].previewTall, true);
  assert.deepEqual(th.objects[2].previewSize, { width: 1920, height: 8 });
  assert.deepEqual(th.objects[2].previewConfig, { label: 'Live' });
  assert.deepEqual(ut.cleanUserTheme(th), th, 'cleaning again changed it');
});

test('a copy of every shipped theme loses nothing, and its motions still point at its own looks', () => {
  for (const shipped of CSS_LOOKS) {
    const copy = ut.copyTheme(shipped);
    assert.match(copy.id, /^ut-/);
    assert.equal(copy.from, shipped.id);
    assert.equal(copy.objects.length, shipped.objects.length, shipped.id);
    shipped.objects.forEach((o, i) => {
      const c = copy.objects[i];
      assert.equal(c.css, o.css, `${shipped.id}/${o.id} changed`);
      assert.equal(c.layerType, o.layerType);
      assert.equal(c.kind, o.kind);
      assert.equal(Boolean(c.previewTall), Boolean(o.previewTall));
      assert.deepEqual(c.previewConfig, o.previewConfig);
      if (o.previewWith && shipped.objects.some((x) => x.id === o.previewWith)) {
        const over = copy.objects[shipped.objects.findIndex((x) => x.id === o.previewWith)];
        assert.equal(c.previewWith, over.id, `${shipped.id}/${o.id} lost what it is shown over`);
      }
      assert.ok(!('lookId' in c) && !('lookName' in c));
    });
    // A whole copy applies the way the shipped theme does.
    assert.equal(apply.themesToApply([copy]).length, apply.themesToApply([shipped]).length);
  }
});

test('a knob changed in a piece changes its default in the text, and nothing else', () => {
  const omnibar = ALL_PRESETS.find((p) => p.id === 'simonsays-omnibar');
  const before = readFields(omnibar.css, '');
  const ground = before.find((f) => f.name === '--ground');
  const changed = ut.setFieldDefault(omnibar.css, ground, '#112233');
  const after = readFields(changed, '');
  assert.equal(after.find((f) => f.name === '--ground').value, '#112233');
  assert.deepEqual(after.filter((f) => f.name !== '--ground'), before.filter((f) => f.name !== '--ground'));
  // One kept behind a var(): the var() stays.
  const roster = ALL_PRESETS.find((p) => p.id === 'simonsays-roster');
  const tab = readFields(roster.css, '').find((f) => f.name === '--color');
  assert.ok(tab?.viaVar, 'the roster no longer keeps its colour behind the accent');
  assert.match(ut.setFieldDefault(roster.css, tab, '#abcdef'), /--color:\s*var\(--overlay-accent, #abcdef\)/);
  // One only ever read: changed everywhere it is read.
  const power = ALL_PRESETS.find((p) => p.id === 'cyber-header-draw');
  const strike = readFields(power.css, '').find((f) => f.name === '--speed');
  assert.equal(strike?.declared, false);
  assert.equal(readFields(ut.setFieldDefault(power.css, strike, '1.4s'), '').find((f) => f.name === '--speed').value, '1.4s');
  // Nothing to set, nothing changed.
  assert.equal(ut.setFieldDefault(omnibar.css, ground, ''), omnibar.css);
});

test('a layer wearing the streamer’s own theme reads as a theme’s look, not as one typed by hand', () => {
  const mine = ut.copyTheme(CSS_LOOKS.find((th) => th.id === 'cyberpunky'));
  mine.objects[0].css += '\n/* mine */';
  const known = ut.userThemeCss([mine]);
  const css = mine.objects[0].css;
  assert.equal(apply.isOwnCss(css), true);
  assert.equal(apply.isOwnCss(css, known), false);
  assert.equal(apply.isShippedCss(css, known), true);
  assert.equal(apply.replacesOwn([{ field: 'css', from: css, to: 'x' }], known), 0);
  assert.equal(apply.replacesOwn([{ field: 'css', from: css, to: 'x' }]), 1);
});

// ------------------------------------------------------------ kept on the server

const pushes = [];
const onConfig = ({ key, value }) => { if (key === 'userThemes') pushes.push(value); };
bus.on(EVENTS.CONFIG, onConfig);
server.resetForTests();
const empty = server.control({ op: 'create', name: '' });
const copyOfShipped = server.control({ op: 'create', from: 'cyberpunky' });
const secondCopy = server.control({ op: 'create', from: 'cyberpunky' });
const copyOfMine = server.control({ op: 'create', from: copyOfShipped.id, name: 'Cyberpunky mío' });
let missingFrom = null;
try { server.control({ op: 'create', from: 'no-such-theme' }); } catch (err) { missingFrom = err.code; }
const renamed = server.control({ op: 'rename', id: empty.id, name: 'Neón', hint: 'Para jugar' });
let badSave = null;
try { server.control({ op: 'save', theme: { ...copyOfMine.theme, objects: [{ layerType: 'nope' }] } }); } catch (err) { badSave = err.code; }
const edited = server.control({ op: 'save', theme: { ...copyOfMine.theme, objects: copyOfMine.theme.objects.slice(0, 2) } });
server.control({ op: 'delete', id: secondCopy.id });
let gone = null;
try { server.control({ op: 'rename', id: secondCopy.id, name: 'x' }); } catch (err) { gone = err.code; }
const kept = server.getUserThemes();
// Full: no more than the most there can be.
server.resetForTests();
for (let i = 0; i < ut.MAX_USER_THEMES; i += 1) server.control({ op: 'create' });
let full = null;
try { server.control({ op: 'create' }); } catch (err) { full = { code: err.code, vars: err.vars }; }
server.resetForTests();
bus.off(EVENTS.CONFIG, onConfig);

test('the server keeps them: new, copies of shipped and own, renamed, saved whole, deleted, and no more than it can', () => {
  assert.equal(empty.theme.name, 'My theme');
  assert.equal(empty.theme.objects.length, 0);
  assert.equal(copyOfShipped.theme.name, 'Cyberpunky (copy)');
  assert.equal(secondCopy.theme.name, 'Cyberpunky (copy) 2', 'two copies came out with one name');
  assert.equal(copyOfMine.theme.from, copyOfShipped.id);
  assert.equal(copyOfMine.theme.name, 'Cyberpunky mío');
  assert.equal(missingFrom, 'theme_missing');
  assert.equal(renamed.theme.name, 'Neón');
  assert.equal(renamed.theme.hint, 'Para jugar');
  assert.equal(badSave, 'theme_invalid');
  assert.equal(edited.theme.objects.length, 2);
  assert.ok(edited.theme.updatedAt > 0);
  assert.equal(gone, 'theme_missing');
  assert.deepEqual(kept.map((th) => th.name), ['Neón', 'Cyberpunky (copy)', 'Cyberpunky mío']);
  assert.deepEqual(full, { code: 'theme_full', vars: { max: ut.MAX_USER_THEMES } });
  assert.ok(pushes.length >= 7, 'the screens were not told');
  assert.deepEqual(server.snapshot(), { userThemes: [] });
});

test('every screen hears about them, and they travel in a backup', () => {
  assert.ok(read('../../shared/protocol.js').includes("USER_THEMES: 'user_themes',"));
  assert.ok(read('../api/ws.js').includes('return reply(engine.store.userThemes(payload));'));
  const engine = read('../engine/index.js');
  assert.ok(engine.includes('userThemes.initUserThemes();') && engine.includes('...userThemes.snapshot(),'));
  assert.ok(read('../engine/backup.js').includes("{ name: 'user_themes' },"));
  const hook = read('../../web/hooks/useStreamSystem.ts');
  assert.ok(hook.includes('userThemes: (payload: any) => request(C2S.USER_THEMES, payload),') && hook.includes('userThemes: ((snapshot as any).userThemes ?? []) as any[],'));
});

test('the Library makes, copies, renames, deletes and edits them, with every word in both languages', () => {
  const lib = read('../../web/components/views/LibraryView.tsx');
  assert.ok(lib.includes('const themes = useMemo(() => [...CSS_LOOKS, ...mine], [mine]);'), 'the Library does not list the streamer’s own');
  assert.ok(lib.includes("runTheme({ op: 'create', ...(from ? { from } : {}), name })"));
  assert.ok(lib.includes('themePlan(open, layout, { omnibars, motion: themeOpts.motion, known })'), 'applying one does not know its looks');
  assert.ok(lib.includes('replacesOwn(piecePlan(object, layout, omnibars), known)'));
  assert.ok(lib.includes('<ThemePieceEditor') && lib.includes('data-library="add-piece"'));
  // A shipped theme is copied, never changed: no Edit on its pieces.
  assert.ok(lib.includes('{owner && !editingThis && !styling && ('));
  const editor = read('../../web/components/ThemePieceEditor.tsx');
  assert.ok(editor.includes('setFieldDefault(draft.css, f, value)') && editor.includes('pieceCssMax(draft.layerType)'));
  const constants = read('../../web/constants.ts');
  const src = lib + editor;
  const keys = new Set([...src.matchAll(/\bt\.((?:library|refuse)[A-Za-z0-9_]+)/g)].map((m) => m[1]));
  for (const key of [...keys, 'refuseThemeInvalid', 'refuseThemeFull', 'refuseThemeMissing', 'refuseThemeOp']) {
    assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
  }
});

// ------------------------------------------------------------ a theme from a layout

const layer = (uid, type, extra = {}) => ({ uid, type, x: 0, y: 0, width: 100, height: 50, ...extra });

test('a layout\u2019s looks become a theme: each look once, the first first, motions over their looks, shapes their own', () => {
  const layout = {
    id: 'l1', name: 'Mi diseño',
    layers: [
      layer('t1', 'text', { css: ':scope { --ink: #fff; }' }),
      layer('t2', 'text', { css: ':scope { --ink: #fff; }' }),
      layer('t3', 'text', { css: ':scope { --ink: #0f0; }', motionCss: ':scope { animation: x 1s; }' }),
      layer('c1', 'chat', { config: { chatTheme: 'custom', css: '[data-chat="row"] { color: red; }' } }),
      layer('c2', 'chat', { config: { chatTheme: 'twitch', css: '[data-chat="row"] { color: blue; }' } }),
      layer('b1', 'omnibar', { css: '[data-omnibar="bar"] { color: red; }', config: { bar: 'main' } }),
      layer('b2', 'omnibar', { css: '[data-omnibar="tall"] { color: red; }', config: { bar: 'side' } }),
      layer('s1', 'shape', { css: '[data-shape="box"] { background: red; }' }),
      layer('s2', 'shape', { css: '[data-shape="box"] { background: blue; }' }),
      layer('g1', 'source', { config: { source: 'Game' } }),
      layer('e1', 'viewers'),
    ],
  };
  const omnibars = [{ id: 'main', kind: 'bar' }, { id: 'side', kind: 'tall' }];
  const names = { text: 'Texto', chat: 'Chat', omnibar: 'Barra', shape: 'Forma', alert: 'Alerta' };
  const th = ut.themeFromLayout(layout, { omnibars, nameFor: (k) => names[k] || k, motionWord: 'movimiento' });
  assert.match(th.id, /^ut-/);
  assert.equal(th.name, 'Mi diseño');
  assert.deepEqual(th.objects.map((o) => o.name), ['Texto', 'Texto 2', 'Texto · movimiento', 'Chat', 'Barra', 'Barra 2', 'Forma', 'Forma 2']);
  const [text1, , motion] = th.objects;
  assert.equal(motion.kind, 'motion');
  assert.equal(motion.previewWith, th.objects[1].id, 'the motion is not shown over the look it was on');
  assert.equal(text1.css, ':scope { --ink: #fff; }');
  assert.equal(th.objects.find((o) => o.name === 'Barra 2').previewTall, true, 'a tall bar\u2019s look reads as a bar\u2019s');
  // The alerts only when asked for, each look and motion once.
  const alerts = [{ css: ':scope { color: red; }', motionCss: ':scope { animation: y 1s; }' }, { css: ':scope { color: red; }' }];
  const withAlerts = ut.themeFromLayout(layout, { omnibars, alerts, nameFor: (k) => names[k] || k });
  assert.deepEqual(withAlerts.objects.filter((o) => o.layerType === 'alert').map((o) => [o.name, o.kind || 'look']), [['Alerta', 'look'], ['Alerta · motion', 'motion']]);
  assert.equal(ut.themeFromLayout({ layers: [layer('e', 'viewers')] }).objects.length, 0);
});

test('a layout dressed in a theme gives that theme\u2019s looks back', () => {
  const shipped = CSS_LOOKS.find((t) => t.id === 'cyberpunky');
  const kinds = [...new Set(shipped.objects.map((o) => o.layerType))].filter((k) => !['alert', 'shape', 'omnibar'].includes(k));
  const bare = { id: 'round', name: 'Round trip', layers: kinds.map((k, i) => layer(`r${i}`, k, k === 'chat' ? { config: {} } : {})) };
  const dressed = apply.withChanges(bare, apply.themePlan(shipped, bare, { motion: true }).changes, 'to');
  const back = ut.themeFromLayout(dressed, { nameFor: (k) => k });
  for (const kind of kinds) {
    assert.equal(apply.themeLookFor(back, kind)?.css, apply.themeLookFor(shipped, kind)?.css, `${kind} came back different`);
  }
});

test('a theme is made from a layout in the Library and saved from the Overlays screen, in both languages', () => {
  const lib = read('../../web/components/views/LibraryView.tsx');
  assert.ok(lib.includes("from.startsWith('layout:')") && lib.includes('themeFromLayout(fromLayout, {'), 'the Library cannot start from a layout');
  const layouts = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(layouts.includes('<SaveAsTheme layout={working} system={system} t={t} />'), 'the Overlays screen cannot save a theme');
  assert.ok(layouts.includes("await system.actions.userThemes({ op: 'save', theme });"));
  const constants = read('../../web/constants.ts');
  for (const key of ['libraryStartThemes', 'libraryStartLayouts', 'libraryStartLayout', 'libraryWithAlerts', 'layoutThemeNothing', 'layoutThemeSaved', 'layoutSaveTheme', 'layoutSaveThemeHint']) {
    assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
  }
});

// ------------------------------------------------------------ the whole theme at once

test('a theme\u2019s shared knobs are found once each, and setting one sets it in every piece', () => {
  const th = { id: 'ut-knobs', objects: [
    { id: 'a', layerType: 'text', css: ':scope { --ink: #ffffff; --edge: 4px; }' },
    { id: 'b', layerType: 'text', css: ':scope { --ink: #ffffff; --edge: 2px; --only: 1px; }' },
    { id: 'c', layerType: 'viewers', css: '[data-viewers="box"] { color: var(--ink, #eeeeee); border-width: var(--edge, 0.25em); }' },
  ] };
  const knobs = ut.themeKnobs(th);
  assert.deepEqual(knobs.map((k) => [k.name, k.pieces, k.value, k.differing]), [['--edge', 3, '4px', 3], ['--ink', 3, '#ffffff', 2]]);
  const ink = knobs.find((k) => k.name === '--ink');
  const inked = ut.setThemeKnob(th, ink, '#00ff00');
  assert.deepEqual(inked.objects.map((o) => readFields(o.css, '').find((f) => f.name === '--ink').value), ['#00ff00', '#00ff00', '#00ff00']);
  // Each piece keeps its own unit: a knob in em stays in em.
  const edged = ut.setThemeKnob(th, knobs.find((k) => k.name === '--edge'), '6px');
  assert.deepEqual(edged.objects.map((o) => readFields(o.css, '').find((f) => f.name === '--edge').value), ['6px', '6px', '6em']);
  assert.equal(edged.objects[1].css.includes('--only: 1px'), true, 'a knob of one piece was touched');
  // A shipped theme copied has the knobs its pieces share: Cyberpunky draws in one neon everywhere.
  const shipped = ut.copyTheme(CSS_LOOKS.find((t) => t.id === 'cyberpunky'));
  const neon = ut.themeKnobs(shipped).find((k) => k.name === '--neon');
  assert.ok(neon && neon.pieces >= 10, 'Cyberpunky no longer shares its neon');
  const recoloured = ut.setThemeKnob(shipped, neon, '#00ffcc');
  assert.equal(recoloured.objects.filter((o) => readFields(o.css, '').some((f) => f.name === '--neon' && f.value === '#00ffcc')).length, neon.pieces);
});

test('a theme\u2019s fonts are found and swapped everywhere it uses them, the fallback kept', () => {
  const shipped = ut.copyTheme(CSS_LOOKS.find((t) => t.id === 'cyberpunky'));
  const fonts = ut.themeFonts(shipped);
  assert.equal(fonts[0].family, 'VT323');
  assert.ok(fonts.some((f) => f.family === 'Chakra Petch'));
  assert.ok(!fonts.some((f) => ['monospace', 'serif', 'sans-serif'].includes(f.family)), 'a generic family was taken for a font');
  assert.deepEqual(ut.themeFonts(ut.copyTheme(CSS_LOOKS.find((t) => t.id === 'simonsays'))), [], 'SimonSays Default is drawn in each layout\u2019s font');
  const swapped = ut.swapThemeFont(shipped, 'VT323', 'Creepster');
  assert.ok(!ut.themeFonts(swapped).some((f) => f.family === 'VT323'), 'VT323 is still somewhere');
  assert.equal(ut.themeFonts(swapped).find((f) => f.family === 'Creepster').count, fonts[0].count);
  const one = { id: 'ut-f', objects: [{ id: 'x', layerType: 'alert', css: '[data-alert="name"] { font-family: var(--alert-font, VT323, monospace) !important; } p { font-family: "VT323"; } q { font-family: VT3234; }' }] };
  const out = ut.swapThemeFont(one, 'VT323', "Pixel'y; }").objects[0].css;
  assert.ok(out.includes("font-family: var(--alert-font, 'Pixely', monospace) !important;"), out);
  assert.ok(out.includes("p { font-family: 'Pixely'; }") && out.includes('font-family: VT3234;'), out);
  assert.ok(ut.THEME_FONTS.includes('Pixelify Sans') && ut.THEME_FONTS.includes('VT323'));
});

test('the Library changes a whole theme\u2019s colours, sizes and fonts as a draft every piece is drawn from', () => {
  const lib = read('../../web/components/views/LibraryView.tsx');
  assert.ok(lib.includes('(styling && styling.themeId === look.id ? styling.draft : look).objects.filter(matches)'), 'the pieces are not drawn from the draft');
  assert.ok(lib.includes("runTheme({ op: 'save', theme: styling.draft })"));
  const panel = read('../../web/components/ThemeStylePanel.tsx');
  assert.ok(panel.includes('onChange(setThemeKnob(draft, k, value))') && panel.includes('onChange(swapThemeFont(draft, family, e.target.value))'));
  assert.ok(panel.includes('useCustomFonts()') && panel.includes('<FontUploadButton'), 'uploaded fonts are not offered');
  const constants = read('../../web/constants.ts');
  const keys = new Set([...panel.matchAll(/\bt\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
  for (const key of keys) assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
});

// ------------------------------------------------------------ sharing one as a file

test('a theme goes to a file with its uploaded fonts, and comes back as a new theme of the app\u2019s own', () => {
  const shipped = ut.copyTheme(CSS_LOOKS.find((t) => t.id === 'cyberpunky'));
  const font = { file: 'Mi Letra.woff2', data: Buffer.from('fake font bytes').toString('base64') };
  const file = ut.themeFile(shipped, [font, { file: '../../server/.env', data: 'x' }, { file: 'evil.js', data: 'x' }]);
  assert.equal(file.format, 'simonsays-theme');
  assert.deepEqual(file.fonts.map((f) => f.file), ['Mi Letra.woff2'], 'something that is not a font went into the file');
  const back = ut.readThemeFile(JSON.stringify(file));
  assert.notEqual(back.theme.id, shipped.id, 'it came back as the same theme instead of a new one');
  assert.equal(back.theme.from, undefined);
  assert.deepEqual(back.theme.objects.map((o) => o.css), shipped.objects.map((o) => o.css));
  assert.deepEqual(back.fonts, [font]);
  const refuses = (text, why) => assert.throws(() => ut.readThemeFile(text), why);
  refuses('not json', /not a theme file/);
  refuses(JSON.stringify({ format: 'something-else' }), /not a theme file/);
  refuses(JSON.stringify({ ...file, version: 99 }), /newer version/);
  refuses(JSON.stringify({ ...file, theme: { name: 'x', objects: [] } }), /no pieces/);
  refuses(JSON.stringify({ ...file, fonts: [{ file: 'x.woff2', data: 'not base64!' }] }), /not one/);
  refuses(JSON.stringify({ ...file, fonts: [{ file: 'big.ttf', data: 'A'.repeat(3 * 1024 * 1024) }] }), /bigger than a font can be/);
  refuses(JSON.stringify({ ...file, theme: { name: 'x', objects: [{ layerType: 'nope' }] } }), /nothing a theme dresses/);
});

test('the Library saves any theme as a file and adds one from a file, uploading its fonts first', () => {
  const lib = read('../../web/components/views/LibraryView.tsx');
  assert.ok(lib.includes('data="theme-export"') && lib.includes('data-library="theme-import"'));
  assert.ok(lib.includes('if (!used.has(fontFamilyName(asset.name))) continue;'), 'fonts the theme does not use go into its file');
  assert.ok(lib.includes('if (have.has(f.file)) continue;'), 'a font already here is uploaded again');
  assert.ok(lib.includes('`${httpBase()}/api/assets/${encodeURIComponent(f.file)}`'), 'fonts are not uploaded to the server the page talks to');
  const constants = read('../../web/constants.ts');
  for (const key of ['libraryExport', 'libraryExported', 'libraryImport', 'libraryImported', 'libraryImportedFonts', 'libraryImportFailed']) {
    assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
  }
});
