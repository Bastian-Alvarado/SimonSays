/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: A layer's own stylesheet, the parts it may name, and the library of looks.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { ALERT_OVERLAY, CHAT_ROW, LAYER_STYLE, SCOPED, SCRIPT_URL, assert, fs, test } from './harness.js';
import { LAYER_TYPES, normaliseLayouts } from './backup-and-layouts.js';
import { MAX_SCOPED_CSS } from './images-and-alerts.js';
import { OVERLAY_VARS, fillTemplate } from './layers.js';

// -------------------------------------------- a stylesheet that belongs to one layer

test('a layer can carry a stylesheet of its own', () => {
  const [l] = normaliseLayouts([{
    id: 'a', layers: [{ type: 'shape', css: ':scope { clip-path: circle(40%) }' }],
  }]);
  assert.equal(l.layers[0].css, ':scope { clip-path: circle(40%) }');
});

test('and it travels with a copy of that layer', () => {
  /*
    The whole reason this exists beside the canvas stylesheet. That one reaches
    a layer by id, and duplicating mints a new id — so a rule written there
    goes on styling the original and leaves the copy plain.
  */
  const src = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const fn = src.slice(src.indexOf('const duplicateLayer'), src.indexOf('const removeLayer'));
  assert.ok(fn.includes('JSON.parse(JSON.stringify'), 'a copy no longer takes the whole layer');
  assert.ok(!fn.includes("css: ''"), 'the copy is stripped of its stylesheet');
});

test('a scoped stylesheet needs no selector naming what it styles', () => {
  /*
    A <style> inside an element, holding @scope with nothing in front of it,
    scopes to that element. That is what lets the rules survive being copied:
    there is no id in them to go stale.

    One implementation for the three things that have a box — a layer, an
    alert and the chat — because three copies is three places for this to be
    got wrong independently.
  */
  assert.ok(SCOPED.includes('@scope {'), 'a scoped stylesheet is no longer scoped by position');
  assert.ok(!SCOPED.includes('data-layer-id'), 'the stylesheet writes an id into the rules');
  for (const [what, src] of [['the layer', LAYER_STYLE], ['the alert', ALERT_OVERLAY], ['the chat', CHAT_ROW]]) {
    assert.ok(src.includes('<ScopedStyle'), `${what} keeps a copy of its own`);
  }
});

test('a scoped stylesheet is not applied at all without @scope', () => {
  /*
    Unlike the canvas one, these cannot fall back to applying unscoped: every
    rule is written expecting :scope to be the thing it was typed into, so
    unscoped it would either do nothing or style the whole page. Nothing is
    the safer of the two.
  */
  assert.ok(SCOPED.includes('if (!canScopeStyles) return null;'), 'an unscoped fallback crept in');
});

test('a layer stylesheet cannot stop being one', () => {
  const [l] = normaliseLayouts([{
    id: 'a', layers: [{ type: 'shape', css: `:scope{} ${'<' + '/StYlE'}><img src=x>` }],
  }]);
  assert.ok(!l.layers[0].css.toLowerCase().includes('</style'), l.layers[0].css);
});

test('a layer stylesheet is capped tighter than the canvas one', () => {
  // A canvas holds one stylesheet and forty layers, and all of it travels in
  // the config every client receives on connect.
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'shape', css: 'a'.repeat(99999) }] }]);
  assert.ok(l.layers[0].css.length <= MAX_SCOPED_CSS, String(l.layers[0].css.length));
  const [big] = normaliseLayouts([{ id: 'a', css: 'b'.repeat(99999), layers: [] }]);
  assert.ok(big.css.length > l.layers[0].css.length, 'the two caps are the same');
});

test('every layer may carry one, not only the kinds that draw shapes', () => {
  // It is the same code for any layer, and the rules about how a layer is
  // drawn already belong to the layer rather than to its type.
  for (const type of ['shape', 'text', 'chat', 'runcard']) {
    const [l] = normaliseLayouts([{ id: 'a', layers: [{ type, css: ':scope { opacity: 1 }' }] }]);
    assert.equal(l.layers[0].css, ':scope { opacity: 1 }', type);
  }
});

// ------------------------------------ parts of a layer a stylesheet may name

export const PARTS_PANEL = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
const PARTS_LIST = PARTS_PANEL.slice(PARTS_PANEL.indexOf('LAYER_PARTS'), PARTS_PANEL.indexOf('export const LayerCssPanel'));
export const OFFERED = PARTS_LIST.split(String.fromCharCode(10)).map((l) => l.trim()).filter((l) => l.startsWith(String.fromCharCode(39) + '[data-')).map((l) => l.slice(1, l.indexOf(String.fromCharCode(39), 1)));
export const COMPONENTS = fs.readdirSync(new URL('../../web/components/', SCRIPT_URL))
  // The panel holds the list being checked, so scanning it would let every
  // selector prove its own existence.
  .filter((f) => f.endsWith('.tsx') && f !== 'LayerCssPanel.tsx')
  .map((f) => fs.readFileSync(new URL('../../web/components/' + f, SCRIPT_URL), 'utf8'))
  .join(String.fromCharCode(10));

test('the editor offers parts that actually exist', () => {
  /*
    A layer names its parts so a stylesheet can reach them. Everything else
    inside a layer is markup rewritten whenever its component is touched, so
    a rule naming that breaks on an update for a reason nobody can see. What
    the editor lists is the promise, and this is what keeps it one.
  */
  assert.ok(OFFERED.length >= 4, `the editor offers only: ${OFFERED.join(', ')}`);
  for (const selector of OFFERED) {
    const attr = selector.slice(1, -1).replace('=', '=');
    assert.ok(COMPONENTS.includes(attr), `the editor offers ${selector}, which no component has`);
  }
});

test('and every part it offers is reachable from the right layer', () => {
  // The omnibar and the run card each name their own, and the editor shows
  // a layer only the ones belonging to its kind.
  for (const [type, attr] of [['omnibar', 'data-omnibar'], ['runcard', 'data-runcard']]) {
    const listed = OFFERED.filter((s) => s.includes(attr));
    assert.ok(listed.length >= 4, `${type} names only ${listed.length} parts`);
    const block = PARTS_LIST.slice(PARTS_LIST.indexOf(type));
    assert.ok(block.includes(attr), `${type} is listed with somebody else's parts`);
  }
});

test('a part is an attribute rather than text on the page', () => {
  /*
    Caught by looking, not by reading: a hook appended after a one-line
    opening tag became a child, and the words data-omnibar appeared in the
    bar's own text where a viewer could read them. An attribute alone on a
    line and a stray child are the same text, so every hook has to sit on a
    line that is visibly part of a tag.
  */
  for (const file of ['Omnibar.tsx', 'RunCard.tsx', 'ShapeLayer.tsx', 'Nameplate.tsx', 'ViewerCount.tsx', 'Countdown.tsx', 'TextLayer.tsx', 'GoalBar.tsx', 'SpotifyNowPlaying.tsx', 'PlanOverlay.tsx', 'QuestionOverlay.tsx']) {
    const src = fs.readFileSync(new URL('../../web/components/' + file, SCRIPT_URL), 'utf8');
    for (const line of src.split(String.fromCharCode(10))) {
      if (!/data-(omnibar|runcard|shape|nameplate|viewers|countdown|text|goal|spotify|plan|question|alert|chat)(-[a-z]+)?=/.test(line)) continue;
      assert.ok(line.includes('className') || line.includes('<'),
        `${file}: this is not inside a tag, so it reaches the page as text: ${line.trim()}`);
    }
  }
});


test('a hidden category does not hand its name to the estimate', () => {
  /*
    The details list drops whatever is switched off, so with the category
    hidden the estimate slides into first place. Anything reading position
    would then call the estimate the category — and a stylesheet written
    against that would paint the wrong one.
  */
  const src = fs.readFileSync(new URL('../../web/components/RunCard.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!src.includes("i === 0 ? 'category'"), 'the part is decided by position again');
  assert.ok(src.includes("part: 'category'"), 'a detail no longer says which one it is');
  assert.ok(src.includes('data-runcard="category"') && src.includes('data-runcard="estimate"'),
    'the two parts are not named in the source, so nothing can check them');
});

test('a shape names the element it actually draws', () => {
  /*
    :scope is the layer around a shape, and the shape sits inside it with its
    fill written inline. A stylesheet aiming at :scope paints behind the shape
    and is never seen — which is exactly what happened the first time a
    starting-soon panel was written against it and came out the fill colour.
  */
  const src = fs.readFileSync(new URL('../../web/components/ShapeLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('data-shape="box"'), 'the drawn box has no name');
  assert.ok(src.includes('data-shape="rule"'), 'the rule inside a line has no name');
});

// ------------------------------------------------ the library of looks

export const { CSS_LOOKS, ALL_PRESETS, PRESET_LAYER_TYPES, canApplyInBulk } = await import('../../../shared/css-presets.js');

/** Every [data-…="…"] a stylesheet names, without a regex to get wrong. */
const selectorsIn = (css) => {
  const found = [];
  let at = css.indexOf('[data-');
  while (at >= 0) {
    const end = css.indexOf(']', at);
    if (end < 0) break;
    found.push(css.slice(at + 1, end));
    at = css.indexOf('[data-', end);
  }
  return found;
};

/**
 * Is this selector one some component really draws?
 *
 * Most are written out whole. A few name an attribute whose value the
 * component works out — the rank a chatter holds — so the pair never appears
 * in the source as one string. Those are checked as two halves: the attribute
 * is written somewhere, and the value is one the component can produce.
 */
export const componentsDraw = (selector) => {
  if (COMPONENTS.includes(selector)) return true;
  const at = selector.indexOf('=');
  if (at < 0) return false;
  const attr = selector.slice(0, at);
  const value = selector.slice(at + 1).split(String.fromCharCode(34)).join("");
  return COMPONENTS.includes(attr + '=') && COMPONENTS.includes(String.fromCharCode(39) + value + String.fromCharCode(39));
};

test('every preset names only parts the app promises to keep', () => {
  /*
    The whole risk of shipping a library: a preset that names markup a
    component generates looks fine today and quietly stops working the next
    time that component is rewritten, leaving whoever used it no way to know
    why.
  */
  for (const preset of ALL_PRESETS) {
    for (const selector of selectorsIn(preset.css)) {
      assert.ok(componentsDraw(selector),
        `preset "${preset.id}" names ${selector}, which no component has`);
    }
  }
});

test('and names them on the layer it is offered for', () => {
  // A shape preset shown as a nameplate would insert rules matching nothing,
  // which reads as the library being broken rather than as a mistake in it.
  // An omnibar layer draws a classic bar or a tall one, so either's parts belong to it.
  const attrFor = { shape: ['data-shape'], omnibar: ['data-omnibar', 'data-tallbar'], runcard: ['data-runcard'], nameplate: ['data-nameplate'], viewers: ['data-viewers'], countdown: ['data-countdown'], text: ['data-text'], goal: ['data-goal'], spotify: ['data-spotify'], plan: ['data-plan'], question: ['data-question'], roster: ['data-roster'], stopwatch: ['data-stopwatch'], images: ['data-images'], players: ['data-players'] };
  for (const preset of ALL_PRESETS) {
    const expected = attrFor[preset.layerType];
    if (!expected) continue;
    for (const selector of selectorsIn(preset.css)) {
      assert.ok(expected.some((prefix) => selector.startsWith(prefix)),
        `preset "${preset.id}" is offered as a ${preset.layerType} but names ${selector}`);
    }
  }
});

test('a preset that names nothing uses :scope, which always exists', () => {
  for (const preset of ALL_PRESETS) {
    if (selectorsIn(preset.css).length) continue;
    assert.ok(preset.css.includes(':scope'),
      `preset "${preset.id}" names neither a part nor :scope, so it targets nothing`);
  }
});

test('every preset is something a person can tell from the others', () => {
  const seen = new Set();
  for (const preset of ALL_PRESETS) {
    assert.ok(preset.name && preset.name.length <= 24, `bad name: ${preset.id}`);
    assert.ok(preset.hint && preset.hint.length > 10, `${preset.id} has no hint worth reading`);
    assert.ok(!seen.has(preset.id), `two presets share the id ${preset.id}`);
    seen.add(preset.id);
  }
});

test('the library is grouped by look, and every look has something in it', () => {
  assert.ok(CSS_LOOKS.length >= 2, `only ${CSS_LOOKS.length} look(s)`);
  for (const look of CSS_LOOKS) {
    assert.ok(look.name && look.hint, `look ${look.id} is unlabelled`);
    assert.ok(look.objects.length >= 1, `look ${look.id} is empty`);
  }
});

/*
  And layers no theme ever will: an OBS source's slot draws nothing on stream
  — the source shows through it — so there is nothing to put a look on.
*/
const NEVER_DRESSED = ['source'];

/*
  Layers the themes have not dressed yet, drawn in their plain default look for
  now. There were nine — the players list, the poll, the call, the avatar, the
  PNGtuber and the Twitch pieces arrived before their looks did — and every
  theme has caught up. A new kind of layer that arrives before its looks goes
  here, and taking it off holds every theme to covering it again.
*/
const NOT_YET_DRESSED = [...NEVER_DRESSED];

test('every theme has a look for every kind of layer, and one for a tall bar', () => {
  /*
    A theme is only a theme if every piece of a layout can wear it. The two
    groups that are pieces to build with rather than whole looks — a starting
    screen's wall and the building blocks — are not held to it.
  */
  const PIECE_SETS = ['starting', 'blocks'];
  const themes = CSS_LOOKS.filter((l) => !PIECE_SETS.includes(l.id));
  assert.ok(themes.length >= 2, `only ${themes.length} themes`);
  for (const theme of themes) {
    const kinds = new Set(theme.objects.map((o) => (o.layerType === 'alert' ? 'alerts' : o.layerType)));
    for (const type of LAYER_TYPES.filter((t) => !NOT_YET_DRESSED.includes(t))) assert.ok(kinds.has(type), `${theme.name} has nothing for a ${type} layer`);
    assert.ok(theme.objects.some((o) => o.previewTall && o.css.includes('[data-tallbar="bar"]')), `${theme.name} has no look for a tall bar`);
  }
  // Each players list and poll reads the colours chosen on the layer before its own.
  for (const p of ALL_PRESETS.filter((o) => o.layerType === 'players')) {
    for (const v of ['--players-background', '--players-text']) assert.ok(p.css.includes(`var(${v},`), `${p.id} ignores ${v}`);
  }
  for (const p of ALL_PRESETS.filter((o) => o.layerType === 'poll')) {
    for (const v of ['--poll-background', '--poll-text']) assert.ok(p.css.includes(`var(${v},`), `${p.id} ignores ${v}`);
  }
});




test('SimonSays Default has a look for every kind of layer, in one colour', () => {
  const theme = CSS_LOOKS.find((l) => l.id === 'simonsays');
  assert.equal(theme.name, 'SimonSays Default');
  const kinds = new Set(theme.objects.map((o) => (o.layerType === 'alert' ? 'alerts' : o.layerType)));
  for (const type of LAYER_TYPES.filter((t) => !NOT_YET_DRESSED.includes(t))) assert.ok(kinds.has(type), `SimonSays Default has nothing for a ${type} layer`);
  assert.ok(theme.objects.some((o) => o.previewTall && o.css.includes('[data-tallbar="bar"]')), 'there is no SimonSays Default look for a tall bar');
  for (const look of theme.objects) {
    // No spectrum: the only colour is the one somebody chose.
    assert.ok(!/#ff2d95|#ffe600|#00ff88|#00d5ff/i.test(look.css), `${look.id} still draws the spectrum`);
    // And where it has a colour, it follows the layout accent and is white without one.
    if (look.css.includes('--color:')) {
      assert.ok(look.css.includes('--color: var(--overlay-accent, #ffffff);'), `${look.id} does not follow the layout accent`);
    }
  }
});

test('Cyberpunky has a look for every kind of layer, white by default and every colour a field', () => {
  const theme = CSS_LOOKS.find((l) => l.id === 'cyberpunky');
  assert.equal(theme.name, 'Cyberpunky');
  const kinds = new Set(theme.objects.map((o) => (o.layerType === 'alert' ? 'alerts' : o.layerType)));
  for (const type of LAYER_TYPES.filter((t) => !NOT_YET_DRESSED.includes(t))) assert.ok(kinds.has(type), `Cyberpunky has nothing for a ${type} layer`);
  assert.ok(theme.objects.some((o) => o.previewTall && o.css.includes('[data-tallbar="bar"]')), 'there is no Cyberpunky look for a tall bar');
  // Looks, not motions: a motion has no colours of its own to declare.
  for (const look of theme.objects.filter((o) => o.kind !== 'motion')) {
    // The main colour is white out of the box, and a field somebody can change.
    assert.ok(look.css.includes('--neon: #ffffff; /* Main colour */'), `${look.id} has no Main colour field, or it is not white`);
    // Its own colourway, not the layout's: SimonSays Default is the one that follows.
    assert.ok(!look.css.includes('--overlay-accent'), `${look.id} follows the layout accent`);
  }
  const styles = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  assert.ok(styles.includes("@fontsource/chakra-petch/700.css"), 'the squared face the theme is set in is not bundled');
  /*
    The hatching moves. Every hatch is offset by --hatch, which only animates
    because it is registered as a length; the loop is one stripe long, and its
    speed is a field. A hatch written without the offset would sit still
    beside ones that move.
  */
  for (const look of theme.objects.filter((o) => o.css.includes('repeating-linear-gradient'))) {
    assert.ok(!/repeating-linear-gradient\(-45deg, [^,]+ 0 /.test(look.css), `${look.id} has a hatch that does not move`);
    assert.ok(look.css.includes('@property --hatch { syntax: "<length>"'), `${look.id} animates a length it never registered`);
    assert.ok(/animation: cyberHatch\w* var\(--speed\) linear infinite/.test(look.css), `${look.id} never sets its hatch moving`);
    assert.ok(look.css.includes('--speed: 0.6s; /* Seconds per stripe | 0.1-4 */'), `${look.id} has no speed field`);
  }
});

test('every Cyberpunky layer that can replay a motion draws itself in the same way', () => {
  const theme = CSS_LOOKS.find((l) => l.id === 'cyberpunky');
  const motions = theme.objects.filter((o) => o.kind === 'motion');
  for (const type of ['omnibar', 'runcard', 'nameplate', 'alert', 'chat', 'question']) {
    const m = motions.find((o) => o.layerType === type);
    assert.ok(m, `there is no Cyberpunky motion for a ${type}`);
    assert.ok(/cyber(Header|DrawBox)/.test(m.css), `${m.id} does not draw up from a sliver`);
    // Each previews over the look it was drawn for, or there is nothing filled to see drawn.
    assert.ok(theme.objects.some((o) => o.id === m.previewWith && o.layerType === type), `${m.id} previews over nothing of its own`);
  }
  // Chat and alerts are styled elsewhere, so their motions have to say so or they reach nothing.
  for (const type of ['alert', 'chat']) {
    assert.equal(motions.find((o) => o.layerType === type).applies, type, `the ${type} motion does not say where it applies`);
  }
  // The alert's own animation is its way out; a motion that set it would leave the alert on screen.
  const alert = motions.find((o) => o.layerType === 'alert');
  assert.ok(!/(^|\n):scope \{[^}]*animation/.test(alert.css), 'the alert motion takes over the alert itself and its exit with it');
  // Both chips are cut to the corner the chip draw starts from.
  for (const id of ['cyber-runcard', 'cyber-question']) {
    assert.ok(theme.objects.find((o) => o.id === id).css.includes('clip-path: polygon(.5em 0, 100% 0, 100% 100%, 0 100%, 0 .5em)'), `${id} is cut to another corner`);
  }
});

test('Cyberpunky\'s bars draw their header up from a sliver as wide as the cut corner', () => {
  const theme = CSS_LOOKS.find((l) => l.id === 'cyberpunky');
  const motion = theme.objects.find((o) => o.id === 'cyber-header-draw');
  assert.ok(motion && motion.kind === 'motion' && motion.layerType === 'omnibar', 'there is no header motion for the bars');
  assert.ok(motion.css.includes('[data-omnibar="label"], [data-tallbar="context"]'), 'it does not reach both bars\' headers');
  // The corner is one field, read by the look and the motion alike, so the sliver is always as wide as it.
  for (const id of ['cyber-omnibar', 'cyber-tallbar']) {
    const look = theme.objects.find((o) => o.id === id);
    assert.ok(/--notch: [\d.]+em; \/\* Cut corner/.test(look.css), `${id} has no Cut corner field`);
    assert.ok(look.css.includes('clip-path: polygon(var(--notch) 0, 100% 0, 100% 100%, 0 100%, 0 var(--notch))'), `${id} cuts its corner some other way`);
  }
  // Three shapes with the same five points, so each can become the next; the last is the look's own.
  const frames = [...motion.css.matchAll(/^\s*\d+% \{ clip-path: polygon\((.*)\); \}$/gm)];
  assert.equal(frames.length, 3, 'the header is not drawn in three steps');
  for (const [, points] of frames) {
    // The corner reads as one token, so its own comma is not counted as a point.
    assert.equal(points.split('var(--notch, .7em)').join('N').split(',').length, 5, 'a step has a different number of points and cannot be tweened');
  }
  assert.ok(motion.css.includes('100% { clip-path: polygon(var(--notch, .7em) 0, 100% 0, 100% 100%, 0 100%, 0 var(--notch, .7em)); }'),
    'the draw does not end on the shape the look gives the header');
  // Naming its own wipe would stop the look's hatch on the same element; the motion keeps it going.
  assert.ok(motion.css.includes('cyberHatch var(--speed, .6s) linear infinite'), 'the hatch stops while the motion is on');
  // A loop is never a way out, or the moving hatch would hold every outgoing slot.
  const bar = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(bar.includes("a.effect?.getTiming().iterations === Infinity"), 'an endless animation still counts as a slot leaving');
});


test('a text layer can say how many players are in, and the lobby has what it needs', () => {
  const state = { players: { items: [{ state: 'in' }, { state: 'in' }, { state: 'out' }] } };
  assert.equal(fillTemplate('{playersIn}/{playersTotal} crewmates', state), '2/3 crewmates');
  assert.ok(OVERLAY_VARS.some((v) => v.name === 'playersIn') && OVERLAY_VARS.some((v) => v.name === 'playersTotal'));
  // The canvas hands the text layer the list, or the counts could never be filled.
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes('players: (system.data as any).players,'), 'a text layer is not given the players list');
});

test('the filter offers only kinds the library has something for', () => {
  // A filter with nothing behind it is a dead end somebody has to try.
  for (const kind of PRESET_LAYER_TYPES) {
    assert.ok(ALL_PRESETS.some((p) => p.layerType === kind), `nothing is a ${kind}`);
  }
});



test('a whole look is never dropped across every shape at once', () => {
  /*
    A layout holds many shapes and each is a different piece of the build — a
    wall, a frame, a divider. One stylesheet written across all of them would
    destroy the rest, so shapes are copy-only.
  */
  assert.equal(canApplyInBulk('shape'), false);
  for (const kind of ['omnibar', 'runcard', 'nameplate', 'countdown', 'viewers']) {
    assert.equal(canApplyInBulk(kind), true, kind);
  }
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('!canApplyInBulk(object.layerType)'),
    'the library can apply a stylesheet across every shape in a layout');
});

test('the library draws each preset with the component that will draw it', () => {
  /*
    A picture of a preset is a second thing to keep in step with the preset.
    Rendering the real component through the real canvas cannot drift, because
    it is the preset.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  const preview = view.slice(view.indexOf('const Preview ='), view.indexOf('export const LibraryView'));
  assert.ok(preview.includes('<CanvasStage'), 'the previews are no longer the real thing');
  assert.ok(preview.includes('object.css') && preview.includes('motionCss:'),
    'the preview layer is drawn without the preset, or ignores its motion');
});

test('the layer panel no longer carries its own copy of the library', () => {
  // Two places offering presets is two places to keep in step, and the one in
  // the panel could only ever show names.
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!panel.includes('css-presets'), 'the panel still lists presets of its own');
});



test('the two lists of repeatable kinds agree in both directions', () => {
  /*
    The old check only walked from the server to the editor, so a kind the
    editor offered repeats of while the server dropped them passed. That is
    what happened to the run card: a second one could be placed and vanished
    on save, with nothing said.
  */
  const src = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const server = fs.readFileSync(new URL('../engine/layouts.js', SCRIPT_URL), 'utf8');
  const line = server.split(String.fromCharCode(10)).find((l) => l.startsWith('const REPEATABLE'));
  const allowed = line.split(String.fromCharCode(39)).filter((_, i) => i % 2 === 1);

  for (const kind of src.split(String.fromCharCode(10))) {
    if (!kind.includes('repeatable: true')) continue;
    const name = kind.split(String.fromCharCode(39))[1];
    assert.ok(allowed.includes(name),
      `the editor offers repeats of ${name}, but the server drops them on save`);
  }
});

test('every preset closes what it opens, so nothing in it leaves its layer', () => {
  /*
    A stylesheet is written inside the layer's @scope. One closing brace too
    many ends that @scope early: whatever follows — the rest of the preset,
    and the values its fields are set to, which are written after it — lands
    outside the layer and never reaches it. The Games Done Quick "Power on"
    motion had exactly that, and its timing fields did nothing.
  */
  for (const preset of ALL_PRESETS) {
    const css = preset.css.replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    for (const c of css) {
      if (c === '{') depth += 1;
      if (c === '}') {
        depth -= 1;
        assert.ok(depth >= 0, `${preset.id} closes a brace it never opened, ending its layer's @scope early`);
      }
    }
    assert.equal(depth, 0, `${preset.id} leaves a brace open`);
  }
});

test('the one-weight fonts are declared for every weight, so no look gets a faked bold', () => {
  /*
    VT323 and Special Elite come in one weight. Declared at 400 alone, any
    bold asked of them — and components' headings ask — was a bold the browser
    made up by smearing the letters, which on the pixel font breaks its steps.
    Measured in the Library: about twenty Cyberpunky and Found Footage looks.
  */
  const styles = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  const fonts = fs.readFileSync(new URL('../../web/one-weight-fonts.css', SCRIPT_URL), 'utf8');
  assert.ok(styles.includes("@import './one-weight-fonts.css';"), 'the fonts declared for every weight are not loaded');
  for (const pkg of ['vt323', 'special-elite']) {
    assert.ok(!styles.includes(`@fontsource/${pkg}/400.css`), `${pkg} is still declared at 400 alone, beside the declaration for every weight`);
    // Every character range the package has, each with its files, declared for the whole range of weights.
    const packaged = fs.readFileSync(new URL(`../../web/node_modules/@fontsource/${pkg}/400.css`, SCRIPT_URL), 'utf8');
    const ranges = [...packaged.matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => m[1]);
    assert.ok(ranges.length >= 2, `${pkg}: its package declares ${ranges.length} ranges`);
    for (const range of ranges) assert.ok(fonts.includes(`unicode-range: ${range};`), `${pkg}: the range ${range.slice(0, 30)}… is missing, so those characters would fall back to another font`);
    for (const file of [...fonts.matchAll(new RegExp(`url\\(\\./(node_modules/@fontsource/${pkg}/files/[^)]+)\\)`, 'g'))].map((m) => m[1])) {
      assert.ok(fs.existsSync(new URL(`../../web/${file}`, SCRIPT_URL)), `${file} does not exist`);
    }
  }
  const faces = fonts.split('@font-face').slice(1);
  assert.equal(faces.length, 5, 'VT323 has three ranges and Special Elite two');
  for (const face of faces) assert.ok(face.includes('font-weight: 100 900;'), 'a face is declared for fewer than every weight');
});

// ------------------------------------------------------ applying, safely, a theme at a time

const apply = await import('../../../shared/theme-apply.js');
const presetById = (id) => ALL_PRESETS.find((p) => p.id === id);
const themeById = (id) => CSS_LOOKS.find((l) => l.id === id);
const sampleLayout = () => ({ id: 'main', name: 'Main', layers: [
  { uid: 'o1', type: 'omnibar', config: {} },
  { uid: 'o2', type: 'omnibar', config: { bar: 'tall1' } },
  { uid: 's1', type: 'shape', css: ':scope { background: red; }' },
  { uid: 's2', type: 'shape' },
  { uid: 'c1', type: 'chat' },
  { uid: 'a1', type: 'alerts' },
  { uid: 't1', type: 'text', css: ':scope { color: red; }' },
  { uid: 'n1', type: 'nameplate', motionCss: presetById('cyber-row-draw').css },
  { uid: 'n2', type: 'nameplate', motionCss: ':scope { animation: mine 1s; }' },
  { uid: 'p1', type: 'poll' },
] });
const TALL = [{ id: 'tall1', kind: 'tall' }];

test('a whole theme dresses every layer it has a look for, and never a shape', () => {
  for (const theme of CSS_LOOKS) {
    const { changes, left } = apply.themePlan(theme, sampleLayout(), { omnibars: TALL });
    assert.ok(!changes.some((c) => c.uid === 's1' || c.uid === 's2'), `${theme.id} writes on a shape`);
    assert.deepEqual(left.find((l) => l.why === 'shape'), { kind: 'shape', why: 'shape', count: 2 }, `${theme.id} does not say it left the shapes`);
    // The alerts layer plays what every layout shares: never written on from a layout.
    assert.ok(!changes.some((c) => c.uid === 'a1'), `${theme.id} writes on the alerts layer`);
    // The chat is a layer like the rest: a theme with a chat look dresses it, and turns it to the theme that reads one.
    const chatLook = ALL_PRESETS.find((p) => p.lookId === theme.id && p.layerType === 'chat' && p.kind !== 'motion');
    const onChat = changes.filter((c) => c.uid === 'c1');
    if (chatLook) {
      assert.equal(onChat.find((c) => c.field === 'css')?.to, chatLook.css, `${theme.id} leaves the chat undressed`);
      assert.equal(onChat.find((c) => c.field === 'chatTheme')?.to, 'custom', `${theme.id} dresses the chat in a theme that ignores it`);
    } else {
      assert.ok(!onChat.some((c) => c.field !== 'motionCss'), `${theme.id} has no chat look but writes one`);
    }
    for (const c of changes) {
      if (c.to === '' || c.field === 'chatTheme') continue;
      const piece = ALL_PRESETS.find((p) => p.css === c.to);
      assert.ok(piece && piece.lookId === theme.id, `${theme.id} puts ${piece?.id || 'something'} on ${c.uid}, which is not its own`);
    }
  }
});





const { liveLayout } = await import('../../../shared/live-layout.js');

test('the Library aims at the layout on stream, by the same rule the canvas draws it by', () => {
  const a = { id: 'a', scenes: [] }, b = { id: 'b', scenes: ['Just chatting'] }, c = { id: 'c', scenes: ['Gameplay'] };
  // The one bound to the live scene.
  assert.equal(liveLayout([a, b, c], 'Gameplay'), c);
  // A scene nobody bound, once anybody binds: nothing is on stream.
  assert.equal(liveLayout([a, b, c], 'BRB'), null);
  // Nobody binds at all: the first, as a source set up before binding keeps showing.
  assert.equal(liveLayout([{ id: 'x' }, { id: 'y' }], 'Anything').id, 'x');
  assert.equal(liveLayout([{ id: 'x' }, { id: 'y' }], '').id, 'x');
  assert.equal(liveLayout([], 'Gameplay'), null);
  assert.equal(liveLayout(undefined, ''), null);

  // One rule, used by both: the canvas, and the Library's "Apply to".
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(app.includes(': liveLayout(layouts, currentScene, omni);'), 'the canvas picks its layout by a rule of its own');
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("const live = liveLayout(layouts, system?.connections?.obsData?.currentScene || '', (system?.data as any)?.omnilayer);"));
  // Following what is on stream until somebody chooses, and saying which that is.
  assert.ok(view.includes("const [target, setTarget] = useState<string>('');"), 'the Library still starts on the first layout');
  assert.ok(view.includes('const layout = layouts.find((l) => l.id === target) || live || layouts[0];'));
  assert.ok(view.includes("{l.name}{live && l.id === live.id ? ` · ${t.libraryLiveNow || 'on stream now'}` : ''}"), 'the layout on stream is not marked');
});

test('a piece with nowhere to go says why beside its button, not only when hovered', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('{bulk && !count && (') && view.includes('data-library="apply-why">{whyNot(object)}</span>'), 'a greyed-out Apply does not say why');
  // Said precisely: no layer of the kind, or bars there but all of the other shape, or nothing to apply to at all.
  for (const said of ["'No {kind} layer in {layout}'", "'No omnibar in {layout} shows a tall bar'", "'Every omnibar in {layout} shows a tall bar'", "'Make a layout first, on the Overlays screen'"]) {
    assert.ok(view.includes(said), `the reason ${said} is never given`);
  }
  // The tooltip and the words beside the button are the same reason.
  assert.ok(view.includes(': whyNot(object)}'), 'the tooltip gives a different reason');
});

test('the alert list beside "Apply to" is named, and each list is its label\'s', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  const alertList = view.slice(view.indexOf("{t.libraryAlertTo || 'Alert pieces go on'}") - 400, view.indexOf('data-library="alert-to"'));
  assert.ok(alertList.includes('<label className="flex items-center gap-2">'), 'the alert list has no label of its own');
  const layoutList = view.slice(view.indexOf("{t.libraryApplyTo || 'Apply to'}") - 400, view.indexOf('data-library="apply-to"'));
  assert.ok(layoutList.includes('<label className="flex items-center gap-2">'), 'the layout list is not inside its label');
});

