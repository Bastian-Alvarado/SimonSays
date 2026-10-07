/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Looks and motions, style fields, previews, the editor canvas and furniture, backgrounds.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCOPED, SCRIPT_URL, assert, fs, test } from './harness.js';
import { normaliseLayouts } from './backup-and-layouts.js';
import { MAX_SCOPED_CSS } from './images-and-alerts.js';
import { resolvePerson } from './now-playing-and-clock.js';
import { ALL_PRESETS, CSS_LOOKS } from './stylesheets.js';

// --------------------------------- a layer's look and its motion, kept apart

export const { presetKind, presetField, presetApplies } = await import('../../../shared/css-presets.js');

test('a layer holds its look and its motion in different boxes', () => {
  /*
    One box meant the two could not coexist: dropping a look onto a layer
    replaced everything, so whatever animation was there went with it. They are
    different decisions, and a change to one should not cost the other.
  */
  const [l] = normaliseLayouts([{
    id: 'a', layers: [{ type: 'omnibar', css: '.look {}', motionCss: '.motion {}' }],
  }]);
  assert.equal(l.layers[0].css, '.look {}');
  assert.equal(l.layers[0].motionCss, '.motion {}');
});

test('and checks the motion the same way it checks the look', () => {
  const [l] = normaliseLayouts([{
    id: 'a', layers: [{ type: 'omnibar', motionCss: `.x{} ${'<' + '/StYlE'}><img src=x>` }],
  }]);
  assert.ok(!l.layers[0].motionCss.toLowerCase().includes('<' + '/style'), l.layers[0].motionCss);
  const [big] = normaliseLayouts([{ id: 'a', layers: [{ type: 'omnibar', motionCss: 'a'.repeat(9999) }] }]);
  assert.ok(big.layers[0].motionCss.length <= MAX_SCOPED_CSS, String(big.layers[0].motionCss.length));
});

test('the motion is written after the look, so it wins a tie', () => {
  // They style the same element. Where both speak about one property, the one
  // you would expect to win is the motion.
  const line = SCOPED.split(String.fromCharCode(10)).find((l) => l.includes('export const scopedText'));
  assert.ok(line, 'the two are no longer combined in one place');
  const body = SCOPED.slice(SCOPED.indexOf('export const scopedText'));
  assert.ok(body.indexOf('css ||') < body.indexOf('motionCss ||'), `motion is written first: ${body.slice(0, 120)}`);
});

test('both reach the page inside the one scope', () => {
  // Two style elements would be two scopes, and a keyframe declared in one
  // would not be visible to the other.
  assert.equal(SCOPED.split('<style>{').length - 1, 1, 'more than one stylesheet is rendered');
});

test('a preset knows which box it belongs in', () => {
  assert.equal(presetKind({ kind: 'motion' }), 'motion');
  assert.equal(presetField({ kind: 'motion' }), 'motionCss');
  // Everything written before this existed is a look, which is what it was.
  assert.equal(presetKind({}), 'look');
  assert.equal(presetField({}), 'css');
});

test('the library has a motion for every layer whose motion can replay', () => {
  /*
    An entrance only plays when an element mounts. Offering one for a layer
    that never remounts would be offering an animation that runs once on load
    and then never — a silent nothing.
  */
  const motions = ALL_PRESETS.filter((p) => presetKind(p) === 'motion');
  assert.ok(motions.length >= 3, `only ${motions.length} motion preset(s)`);
  for (const m of motions) {
    // An alert is the clearest case of all: it mounts when it fires and is
    // gone when it retires, so an entrance on one plays every single time.
    assert.ok(['omnibar', 'runcard', 'nameplate', 'alert', 'chat', 'question'].includes(m.layerType),
      `${m.id} is a motion for a ${m.layerType}, which does not remount`);
  }

  /*
    The reason an alert remounts, pinned so it stays true: the queue clears
    the current alert before the next one is taken off it, so there is a
    render with nothing on screen between any two of them.
  */
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  assert.ok(hook.includes('setCurrentAlert(null)'),
    'nothing clears the current alert, so two alerts in a row would not remount');
});

test('the run card and the nameplate remount when what they show changes', () => {
  /*
    They take new props and never remount, so an entrance written for them
    would play once on load and never again. Keyed on what they actually show,
    they re-announce themselves when it changes and stay put when it does not.
  */
  const canvas = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(canvas.includes('key={`card-'), 'the run card never remounts, so its motion plays once');
  assert.ok(canvas.includes('key={`plate-'), 'the nameplate never remounts, so its motion plays once');
  assert.ok(canvas.includes('key={`question-'), 'the question card never remounts, so its motion plays for the first question only');
  // The countdown is deliberately not keyed: its text changes every second.
  assert.ok(!canvas.includes('key={`clock-'), 'the countdown remounts every tick');
});

test('a library preview is drawn with the app\'s own strings', () => {
  /*
    Given an empty set, every label the app supplies rather than one somebody
    typed came out blank — a "Top chatters" slot drew with no header at all,
    which looked like the look had lost it.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!view.includes('t={{}}'), 'a preview is still handed no strings');
  assert.ok(view.includes('<CanvasStage layout={layout} system={system} t={t} />'), 'the stage is not given the strings');
});

test('applying a preset writes into its own box and leaves the other alone', () => {
  // The whole point of two boxes: a new look must not take the motion with it.
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('const field = presetField(object);') && view.includes('[field]: object.css'),
    'the library still writes every preset into the same field');
  // And on a layer, through the plan, each change into the field its piece belongs in.
  const planner = fs.readFileSync(new URL('../../shared/theme-apply.js', SCRIPT_URL), 'utf8');
  assert.ok(planner.includes('const field = presetField(piece);') && planner.includes("withField(next, c.field, direction === 'to' ? c.to : c.from)"),
    'a layer is not written in the box its piece belongs in');
});

test('the panel offers both boxes', () => {
  // One panel now, shared by the layer editor and the alert editor, so what
  // :scope means and which box wins cannot come to differ between them.
  const panel = fs.readFileSync(new URL('../../web/components/StylesheetPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes('patch({ css: next })'), 'the look can no longer be edited');
  assert.ok(panel.includes('patch({ motionCss: next })'), 'the motion can no longer be edited');
});

test('motion lives in the theme it belongs to, and is kept apart inside it', () => {
  /*
    Motion used to be a shelf of its own behind a toggle, which put a group
    called Motion beside Marathon as though it were one more theme. It is not:
    a drawn-in ticker and a flickering alert belong to Marathon, and a theme is
    how its parts look *and* how they arrive.

    The distinction is still real, though — one goes in the look box on a layer
    and the other in the motion box — so inside a theme they are two labelled
    sections rather than one mixed grid.
  */
  assert.ok(!CSS_LOOKS.some((look) => presetKind(look) === 'motion'),
    'Motion is a group of its own again, sitting beside the themes as though it were one');
  const withMotion = CSS_LOOKS.find((l) => l.id === 'cyberpunky');
  assert.ok(withMotion.objects.some((o) => presetKind(o) === 'motion'),
    'the theme that has the motion presets no longer holds them');
  /* And every motion preset is in some theme, not stranded outside one. */
  for (const m of ALL_PRESETS.filter((p) => presetKind(p) === 'motion')) {
    assert.ok(CSS_LOOKS.some((look) => look.objects.some((o) => o.id === m.id)), `${m.id} is in no theme`);
  }

  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!view.includes("useState<'look' | 'motion'>"),
    'the Looks/Motion toggle is back, which is the thing that read as a fourth theme');
  assert.ok(view.includes('data-library="motion-section"'),
    'motion is mixed in with the looks rather than given its own section');
  assert.ok(view.includes('const split = motion.length > 0 && still.length > 0;'),
    'a theme with no motion still gets a Looks heading answering nothing');

  // And the filter offers only the kinds of layer the library has something for.
  assert.ok(view.includes('kindsHere'), 'the filter offers kinds nothing is behind');
});

// ------------------------------- the knobs a stylesheet already has

const { readFields, cleanVars, varsRule, cleanValue } = await import('../../../shared/css-fields.js');

test('a colour that follows the accent keeps white when white is chosen on purpose', () => {
  /*
    var(--overlay-accent, #ffffff) is white only on a layout with no accent.
    Picking white over a pink layout is a choice, and throwing it away as
    "the default" would leave the piece pink with the picker saying white.
  */
  const look = ALL_PRESETS.find((p) => p.id === 'simonsays-omnibar');
  const fields = readFields(look.css);
  const colour = fields.find((f) => f.name === '--color');
  assert.ok(colour && colour.kind === 'colour' && colour.value === '#ffffff' && colour.viaVar, 'the colour is not a field that follows the accent');
  assert.equal(colour.label, 'Colour');
  assert.deepEqual(cleanVars({ '--color': '#ffffff' }, fields), { '--color': '#ffffff' });
  assert.ok(varsRule(fields, { '--color': '#ffffff' }).includes('--color: #ffffff;'));
  // A plain default is still forgotten, as before.
  assert.deepEqual(cleanVars({ '--ground': '#0a0a0b' }, fields), {});
});



test('and only what a control could actually set', () => {
  /*
    Three things are left out. A property holding a gradient or a calc is
    plumbing — the Rank plate keeps its whole cell pattern in --cells, and a
    text box containing a repeating-linear-gradient is noise on a panel.
  */

  /* The app's own channels, which are fed in and set elsewhere. */
  /*
    Read by nearly every preset and set by the canvas, so never a field. The
    omnibar was the example of a sheet with nothing to offer until it was
    given names of its own; what matters was never that it offered nothing,
    only that it never offers this.
  */
  const omnibar = ALL_PRESETS.find((p) => p.id === 'simonsays-omnibar');
  assert.ok(omnibar.css.includes('--overlay-accent'), 'the omnibar no longer reads the accent');
  assert.ok(!readFields(omnibar.css, '').some((f) => f.name === '--overlay-accent'),
    'the canvas accent is offered as a field on every preset that reads it');

  /*
    But a knob whose default is written as a fallback is still a knob. The
    couch keeps its seat colour as var(--overlay-accent, #2ec4b6), which reads
    as text and would have gone out with the gradients.
  */
});

test('no look offers a knob for what a layer sets on it itself', () => {
  /*
    A colour chosen in a layer's panel reaches its look as --goal-bar,
    --countdown-text and the like, and the goal says how full it is as
    --goal-pct. A look reading one with a plain colour behind it, the way it
    reads a knob of its own, had it offered as a control beside the panel's:
    a second text colour on the Rack timer, and a "Goal pct" slider on the
    EMF meter that moved nothing.
  */
  const dir = new URL('../../web/components/', SCRIPT_URL);
  const fed = new Set();
  for (const file of fs.readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
    for (const m of fs.readFileSync(new URL(file, dir), 'utf8').matchAll(/\['(--[a-z][a-z0-9-]*)' as any\]/g)) fed.add(m[1]);
  }
  assert.ok(fed.has('--goal-pct') && fed.has('--countdown-text') && fed.has('--voice-glow'), `only found ${[...fed].join(', ')}`);
  const offered = ALL_PRESETS.flatMap((p) => readFields(p.css, p.motionCss || '').filter((f) => fed.has(f.name)).map((f) => `${p.id}: ${f.name}`));
  assert.deepEqual(offered, []);
});

test('what a control sets is checked, which raw CSS never can be', () => {
  const fields = readFields('[data-shape="box"] { --plate: #0a0e16; --line: 1px; }', '');

  /* A colour has to be one. */
  assert.equal(cleanValue('#00ff88', fields[0]), '#00ff88');
  assert.equal(cleanValue('red; } body { display: none', fields[0]), '');

  /*
    And a length goes back in its own unit. A slider that wrote 2 where the
    sheet said 2px would break every calc() reading it, silently, because a
    length without a unit is not a length.
  */
  assert.equal(cleanValue('3', fields[1]), '3px');
  assert.equal(cleanValue('3px', fields[1]), '3px');
  assert.equal(cleanValue('nonsense', fields[1]), '');

  /* Only fields this sheet has, and nothing left at its default. */
  const kept = cleanVars({ '--plate': '#00ff88', '--line': '1px', '--nothing': '4px' }, fields);
  assert.deepEqual(kept, { '--plate': '#00ff88' },
    'a value is stored for a property nothing reads, or for one never changed');
});

test('and is written after the stylesheet, on the selector that declared it', () => {
  /*
    Later, and equally specific, so it wins on order alone. Not !important: a
    sheet that really means a value should still be able to say so, and a
    control nobody could overrule would be a poor kind of control.
  */
  const fields = readFields('[data-shape="box"] { --plate: #0a0e16; }', '');
  const rule = varsRule(fields, { '--plate': '#00ff88' });
  assert.ok(rule.includes('[data-shape="box"] {'), rule);
  assert.ok(rule.includes('--plate: #00ff88;'), rule);
  assert.ok(!rule.includes('!important'), 'the control cannot be overruled by the sheet it edits');

  const scoped = fs.readFileSync(new URL('../../web/components/ScopedStyle.tsx', SCRIPT_URL), 'utf8');
  const order = scoped.indexOf('[written, set]');
  assert.ok(order > 0, 'the values are no longer written after the stylesheet');

  /* And the layer keeps them, beside the text rather than inside it. */
  const [kept] = normaliseLayouts([{ id: 'v', layers: [{
    type: 'shape',
    css: '[data-shape="box"] { --plate: #0a0e16; }',
    cssVars: { '--plate': '#00ff88', '--wrong': '2px' },
  }] }]);
  assert.deepEqual(kept.layers[0].cssVars, { '--plate': '#00ff88' });
  assert.ok(kept.layers[0].css.includes('--plate: #0a0e16'),
    'the stylesheet was rewritten, so putting a value back cannot be forgetting a key');
});

test('a motion that needs a look to animate names one, and it exists', () => {
  /*
    A motion preview is drawn with an empty look box. That is right for one
    that animates the layer itself — a wipe reads fine on a plain plate — and
    wrong for one that animates something a look drew. Power on masks a row of
    cells only the Rank plate puts there, so without its look underneath its
    card is a picture of nothing, which is the drift the library exists to
    stop. A name that no longer matches a preset would be the same picture,
    silently, so it is held here rather than noticed on the screen.
  */
  const byId = new Map(ALL_PRESETS.map((p) => [p.id, p]));
  for (const preset of ALL_PRESETS) {
    if (!preset.previewWith) continue;
    assert.equal(presetKind(preset), 'motion',
      `${preset.id} names a look to preview with, but it is not a motion`);
    const under = byId.get(preset.previewWith);
    assert.ok(under, `${preset.id} previews with ${preset.previewWith}, which is not a preset`);
    assert.equal(under.layerType, preset.layerType,
      `${preset.id} previews with a ${under.layerType}, but it is a ${preset.layerType}`);
    assert.equal(presetKind(under), 'look', `${preset.id} previews with another motion`);
  }

  /* And the library really puts it underneath rather than dropping it. */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('const lookFor = (object: any) =>') && view.includes('object.previewWith'),
    'the library ignores previewWith, so those cards show nothing');
  assert.ok(!view.includes("presetKind(object) === 'motion' ? '' : object.css"),
    'a preview still empties the look box regardless of previewWith');
});

test('a theme card shows what the theme looks like, not just what it is called', () => {
  /*
    A name and a list of kinds is the same guessing game the library exists to
    stop, one level up. Each card draws a few of its own pieces, through the
    same component and the same stylesheet as the cards inside it, so a theme
    cannot come to advertise something it is not.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('data-library="theme-preview"'), 'a theme card draws nothing');
  assert.ok(view.includes('const signature = (look: any) => look.objects'),
    'a theme card picks no pieces to draw');

  /*
    Nothing in that strip may take the click. The whole card is the way into
    the theme, and a preview swallowing the press would read as a theme that
    refused to open.
  */
  const at = view.indexOf('data-library="theme-preview"');
  const strip = view.slice(at - 200, at + 40);
  assert.ok(strip.includes('pointer-events-none'), 'the theme preview eats the click that opens the theme');

  /*
    Every theme has something to draw. A card whose signature came back empty
    would be a blank strip, which reads as broken rather than as a theme made
    only of chat and motion.
  */
  for (const look of CSS_LOOKS) {
    const drawable = look.objects.filter((o) => presetKind(o) !== 'motion'
      && presetApplies(o) !== 'chat' && presetApplies(o) !== 'alert');
    assert.ok(drawable.length >= 1, `${look.id} has nothing its card can draw`);
  }
});
// ------------------------------------- a preview with something in it to see

export const { previewSystem, previewRun, previewOmnibar, previewCountdown, previewPlan, previewQuestions } =
  await import('../../../shared/preview-sample.js');
// resolvePerson is already imported by the run tests above.

/* What a run actually looks like most of the time: a game typed in, and the
   rest of it left for later. This is the run that was on the phone. */
const HALF_RUN = {
  game: 'Amnesia The Dark Descent',
  platform: 'PC',
  year: '2010',
  category: '',
  estimate: '',
  runner: { name: '', subtitle: '' },
  host: { name: '', subtitle: '' },
  commentators: [],
};

test('a nameplate preview has somebody to be about', () => {
  /*
    The bug this is here for: the library filled its gaps a whole record at a
    time, so a run with a game in it was taken as filled and its empty runner
    went through untouched. The plate draws nothing without a name, so every
    nameplate in the library previewed as a blank box, and the one thing the
    library exists to do — show you the stylesheet — it did not do.
  */
  const person = resolvePerson('runner', previewRun(HALF_RUN));
  assert.ok(person && person.name.trim(), 'a nameplate preview draws nothing');
  assert.ok(person.subtitle.trim(), 'the second line is empty, so a preset that styles it shows nothing');
});

test('and a run card preview has every chip it can draw', () => {
  // Same gap, other component: a card with no category is a card with the
  // chip a preset styles missing from the picture of it.
  const run = previewRun(HALF_RUN);
  for (const field of ['game', 'platform', 'year', 'category', 'estimate']) {
    assert.ok(String(run[field]).trim(), `a run card preview has no ${field}`);
  }
});

test('but a preview shows what is really set, field by field', () => {
  /*
    Filling the gaps must not mean replacing the run. Half the point of
    drawing these with the real components is that the preview looks like
    your overlay and not like a brochure.
  */
  const run = previewRun({ ...HALF_RUN, category: 'Any% NG+', runner: { name: 'Rowan', subtitle: '' } });
  assert.equal(run.game, 'Amnesia The Dark Descent');
  assert.equal(run.platform, 'PC');
  assert.equal(run.category, 'Any% NG+');
  assert.equal(run.runner.name, 'Rowan');
  // One empty line beside a filled one is still a gap, and still gets filled.
  assert.ok(run.runner.subtitle.trim(), 'a plate with a name and no second line previews half-drawn');
});

test('a clock previews at the time it starts from, not at the end of itself', () => {
  /*
    A timer is finished nearly all of the time, and a finished one dims its
    digits on purpose to say so. In a catalogue that reads as the stylesheet
    having washed the numbers out.
  */
  const clock = previewCountdown({ mode: 'finished', endsAt: null, remainingMs: 0, durationMs: 300000, label: 'Starting soon' });
  assert.notEqual(clock.mode, 'finished');
  assert.equal(clock.remainingMs, 300000);
  // Everything about how it looks is still yours.
  assert.equal(clock.label, 'Starting soon');
  const styled = previewCountdown({ durationMs: 60000, style: { fontSize: 42, color: '#00ff88' } });
  assert.equal(styled.style.fontSize, 42);
  assert.equal(styled.remainingMs, 60000);
});

test('a bar with every slot switched off still previews a bar', () => {
  // Switched off means not drawn, which is right on stream and useless here.
  const off = previewOmnibar({ items: [{ id: 'a', type: 'text', enabled: false, text: 'hi' }] });
  assert.ok(off.items.some((i) => i.enabled !== false), 'an omnibar preset previews an empty bar');
  // A bar with something live in it is left exactly as it is.
  const live = { items: [{ id: 'a', type: 'text', enabled: true, text: 'hi' }] };
  assert.equal(previewOmnibar(live), live);
});

test('the library builds its previews from the one place that fills gaps', () => {
  /*
    It used to build them inline, which is how the gaps came to be filled a
    record at a time without anything noticing. Kept apart, the rule is one
    thing that can be tested.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("from '../../../shared/preview-sample.js'"),
    'the library fills its own gaps again');
  assert.ok(!view.includes('function previewSystem'), 'there are two preview builders to keep in step');
});

test('every preview the library offers is fed', () => {
  /*
    A layer type offered in the library with nothing behind it previews blank,
    which is the whole failure again in a new place.
  */
  const fed = previewSystem({ data: { run: HALF_RUN, countdown: null, omnibar: { items: [] } } });
  assert.ok(fed.data.run.game.trim(), 'the run card has nothing to draw');
  assert.ok(resolvePerson('runner', fed.data.run).name.trim(), 'the nameplate has nobody to draw');
  assert.ok(fed.data.countdown && fed.data.countdown.remainingMs > 0, 'the countdown has no time to draw');
  assert.ok(fed.data.omnibar.items.some((i) => i.enabled !== false), 'the omnibar has no slot to draw');
  // A shape draws itself, and needs nothing fed to it.
});

// ---------------------------------------- the editor canvas is a rectangle

test('the editor draws the canvas with the corners it really has', () => {
  /*
    The stage clips whatever leaves it, so a rounded stage clipped the corners
    of any layer pushed into one — and the corners are the part of an overlay
    people place by eye. Worse, with the edge curving away there was no line to
    measure against, so checking a layer sat flush meant opening OBS.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const stage = view.split(String.fromCharCode(10)).find((l) => l.includes('relative w-full mx-auto'));
  assert.ok(stage, 'the editor canvas element has moved, so this no longer checks anything');
  assert.ok(!stage.includes('rounded'), `the editor canvas is rounded: ${stage.trim()}`);
  assert.ok(stage.includes('overflow-hidden'), 'the canvas no longer clips, so a layer can be drawn outside the frame');
});

test('and the panel around it stays a panel', () => {
  // Only the measured thing is square. The furniture is still furniture.
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('glass-panel rounded-3xl border border-zinc-800 p-4'),
    'the panel holding the canvas lost its rounded corners too');
});

// ------------------------------------------- a look for the viewer counter

const { previewViewers, previewStats } = await import('../../../shared/preview-sample.js');

test('the counter names its parts in both of the shapes it draws', () => {
  /*
    It has two: one total with an eye, or a line per platform. A look written
    against one that meant nothing against the other would break the moment
    somebody switched the layer over, with no hint as to why.
  */
  const src = fs.readFileSync(new URL('../../web/components/ViewerCount.tsx', SCRIPT_URL), 'utf8');
  const total = src.slice(src.lastIndexOf('return ('));
  const perPlatform = src.slice(src.indexOf("config?.mode === 'platforms'"), src.lastIndexOf('return ('));
  for (const [name, block] of [['the total', total], ['the per-platform list', perPlatform]]) {
    for (const part of ['box', 'icon', 'count']) {
      assert.ok(block.includes(`data-viewers="${part}"`), `${name} does not name its ${part}`);
    }
  }
  // A row only exists where there are several, so it is named there only.
  assert.ok(perPlatform.includes('data-viewers="row"'), 'a platform row has no name');
});

test('the mark is an element in both, not a bare icon in one of them', () => {
  /*
    The eye was rendered directly and the platform marks were wrapped, so a
    rule giving the mark a background found something to paint in one shape
    and nothing in the other.
  */
  const src = fs.readFileSync(new URL('../../web/components/ViewerCount.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!src.includes('<Eye size={size * 0.9} style='),
    'the eye carries its own styling again, so it is not the wrapped mark');
  assert.ok(src.includes('<Eye size={size * 0.9} />'), 'the eye is no longer drawn inside the mark');
});

test('the editor offers the counter parts, and only to a counter', () => {
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  const list = panel.slice(panel.indexOf('LAYER_PARTS'), panel.indexOf('export const LayerCssPanel'));
  const block = list.slice(list.indexOf('viewers: ['), list.indexOf('],', list.indexOf('viewers: [')));
  for (const part of ['box', 'row', 'icon', 'count']) {
    assert.ok(block.includes(`data-viewers="${part}"`), `the editor does not offer the ${part}`);
  }
});

test('a counter preview has a number on it', () => {
  /*
    The counter draws the offline word and nothing else when no platform is
    live, which is how it sits almost every time somebody opens the library.
    Showing the offline platforms fills it without deciding for you which
    platforms you count.
  */
  const viewers = previewViewers({ mode: 'total', platforms: { twitch: true, tiktok: false } });
  assert.equal(viewers.showOffline, true, 'an offline counter previews as the offline word');
  // What you count is still what you count.
  assert.equal(viewers.platforms.tiktok, false, 'the preview turned a platform back on');
  assert.equal(viewers.mode, 'total', 'the preview changed which shape it draws');

  const stats = previewStats({ twitchViewers: 0, tiktokViewers: 0 });
  assert.ok(stats.twitchViewers > 0 && stats.tiktokViewers > 0, 'a preview counts nobody');
  // And a real count is a real count.
  assert.equal(previewStats({ twitchViewers: 7 }).twitchViewers, 7);
});

test('the library shows the counter at a size a counter is', () => {
  // Without one it falls back to the shape box, which is square and far too
  // tall for a thing that is one line of digits.
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  const sizes = view.slice(view.indexOf('PREVIEW_SIZE'), view.indexOf('const LABELS'));
  assert.ok(sizes.includes('viewers:'), 'the counter previews at the shape size');
  assert.ok(view.slice(view.indexOf('const LABELS')).includes("viewers: 'Viewers'"),
    'the counter has no label, so its filter button would be blank');
});


// ------------------------------------------ the editor furniture, and locks

const LAYOUTS_VIEW = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');

test('a layer remembers that it was locked', () => {
  const [l] = normaliseLayouts([{
    id: 'a', layers: [{ type: 'shape', locked: true }, { type: 'chat' }, { type: 'text', locked: 'yes' }],
  }]);
  assert.equal(l.layers[0].locked, true);
  // Off unless it is really on: everything saved before locks existed, and
  // anything sending a truthy something, stays draggable.
  assert.equal(l.layers[1].locked, false);
  assert.equal(l.layers[2].locked, false);
});

test('a locked layer is not offered to the pointer at all', () => {
  /*
    Not merely ignored on the way down: the handle is a box the size of the
    layer sitting over the canvas, so leaving it there would keep catching
    drags meant for whatever is on top of it.
  */
  assert.ok(LAYOUTS_VIEW.includes('.filter((l) => l.visible && !l.locked)'),
    'a locked layer still has a handle over it');
});

test('and the arrow keys do not move it either', () => {
  // A lock that only holds against the mouse is not a lock.
  assert.ok(LAYOUTS_VIEW.includes('if (!layer || layer.locked) return;'),
    'a locked layer can be nudged with the keyboard');
});

test('locking changes nothing about what goes on stream', () => {
  /*
    It is a fact about editing, not about the overlay. If the canvas ever read
    it, a layer somebody locked to stop nudging it would vanish from the
    broadcast — and it would look like the lock had deleted it.
  */
  const canvas = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const mentions = canvas.split('locked').length - 1;
  assert.equal(mentions, 1, `the canvas reads "locked" ${mentions} times, so the overlay draws it differently`);
  assert.ok(canvas.includes('locked?: boolean;'), 'the one mention is not the type any more');
});

test('the two switches govern the chrome of the layers you are not on', () => {
  /*
    The selected layer keeps its outline and its handle whatever the switches
    say. Dragging a box you cannot see is not a cleaner view of the overlay,
    it is a blind one — and the switches are about the dashed borders and the
    names, which belong to everything else.
  */
  assert.ok(LAYOUTS_VIEW.includes("? '3px solid #f43f5e'"), 'the selected layer lost its own outline');
  assert.ok(LAYOUTS_VIEW.includes(": (showOutlines ? '2px dashed rgba(255,255,255,0.28)' : 'none')"),
    'the borders switch does not reach the dashed outlines');
  assert.ok(LAYOUTS_VIEW.includes('{(showLabels || active) && ('),
    'the names switch does not reach the labels');
});

test('both switches start on, and are remembered', () => {
  /*
    On is what the editor has always looked like, so somebody who never finds
    these sees no change. Remembered in the browser because it is how one
    person is looking at the canvas, not a fact about the layout that belongs
    on the server and on everybody else editing it.
  */
  assert.ok(LAYOUTS_VIEW.includes("localStorage.getItem('layout_outlines') !== 'off'"),
    'the borders switch is not remembered, or does not default to on');
  assert.ok(LAYOUTS_VIEW.includes("localStorage.getItem('layout_labels') !== 'off'"),
    'the names switch is not remembered, or does not default to on');
  // Private mode throws rather than returning nothing, so both sides catch.
  const reads = LAYOUTS_VIEW.split('catch { return true; }').length - 1;
  assert.equal(reads, 2, 'a blocked localStorage would break the editor');
  assert.ok(LAYOUTS_VIEW.includes('catch { /* private mode */ }'), 'writing the switch is unguarded');
});

test('the lock lives in the layer list, where a locked layer can still be reached', () => {
  // On the canvas it would be unreachable the moment it worked.
  assert.ok(LAYOUTS_VIEW.includes('patchLayerAndSave(layer.uid, { locked: !layer.locked })'),
    'nothing toggles the lock');
  const row = LAYOUTS_VIEW.slice(LAYOUTS_VIEW.indexOf('{ locked: !layer.locked }'));
  assert.ok(row.slice(0, 800).includes('{ visible: !layer.visible }'),
    'the lock is not beside the eye in the layer list');
});

test('a copy of a locked layer arrives unlocked', () => {
  // Otherwise the duplicate lands invisible and immovable, and looks like the
  // copy simply did not happen.
  const dup = LAYOUTS_VIEW.slice(LAYOUTS_VIEW.indexOf('const duplicateLayer'));
  assert.ok(dup.slice(0, 700).includes('locked: false'), 'a duplicate inherits the lock');
});

// ------------------------------------------------ stacked backgrounds, and palette

test('a preset stacking backgrounds says !important on every longhand', () => {
  /*
    The shape writes `background` inline. That shorthand resets size, position
    and repeat, so a stacked background that does not mark all three comes out
    as one gradient filling the whole box — which is how the first corner
    brackets shipped: a solid rectangle where four corners were meant to be.
  */
  for (const preset of ALL_PRESETS) {
    const css = preset.css;
    const at = css.indexOf('background-image:');
    if (at < 0) continue;
    const decl = css.slice(at, css.indexOf(';', at));
    // One layer needs nothing; several are the case that breaks.
    if (decl.split('linear-gradient').length - 1 < 2) continue;
    for (const longhand of ['background-image', 'background-size', 'background-position', 'background-repeat']) {
      const where = css.indexOf(longhand + ':');
      assert.ok(where >= 0, `preset "${preset.id}" stacks backgrounds but never sets ${longhand}`);
      const line = css.slice(where, css.indexOf(';', where));
      assert.ok(line.includes('!important'),
        `preset "${preset.id}" leaves ${longhand} without !important, so it comes out solid`);
    }
  }
});



test('a preset drawing an edge with a gradient avoids the border shorthand', () => {
  /*
    Found by looking at the rendered frame, not by reading it. The border
    shorthand resets border-image, and where the shorthand is !important that
    reset is important too — so a border-image written underneath it loses and
    the edge comes out a plain line in the border colour. The longhands do not
    reset anything, so they are the only safe way to say it.

    Checked one rule at a time: a preset may perfectly well put a gradient on
    one part and a plain border on another.
  */
  for (const preset of ALL_PRESETS) {
    for (const rule of preset.css.split('}')) {
      if (!rule.includes('border-image:')) continue;
      for (const line of rule.split(String.fromCharCode(10))) {
        const decl = line.trim();
        assert.ok(!decl.startsWith('border:'),
          `preset "${preset.id}" sets border and border-image in one rule, so the gradient is thrown away: ${decl}`);
      }
    }
  }
});

test('no two presets are called the same thing', () => {
  /*
    They are picked by looking, and the name under the picture is what tells
    two of them apart. Two cards called Frame on one screen, under different
    headings, is a guess rather than a choice.
  */
  const seen = new Map();
  for (const preset of ALL_PRESETS) {
    const other = seen.get(preset.name);
    assert.ok(!other, `"${preset.name}" is the name of both ${other} and ${preset.id}`);
    seen.set(preset.name, preset.id);
  }
});

// --------------------------------------- the layers whose look is set elsewhere

test('the alerts layer is offered no stylesheet of its own', () => {
  /*
    A layout holds one alerts layer and every alert on the channel plays
    through it, so a stylesheet written against it would be one rule for a
    follow, a raid, a donation and a redeem alike. Styling belongs per alert
    type; offering the box here would be offering the wrong granularity and
    letting somebody find that out after writing the stylesheet.
  */
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes("STYLED_ELSEWHERE = ['alerts']"), 'the alerts layer is not excluded, or something else is');
  assert.ok(panel.includes('if (STYLED_ELSEWHERE.includes(layer.type)) return null;'),
    'the exclusion is declared but never acted on');
  // Before anything is read off the layer, so nothing can be shown by accident.
  const guard = panel.indexOf('STYLED_ELSEWHERE.includes(layer.type)');
  assert.ok(guard < panel.indexOf('LAYER_PARTS[layer.type]'), 'the panel does work before deciding not to draw');
});

test('and the library cannot write one onto it either', () => {
  // The other way a stylesheet reaches a layer is the Apply button, which
  // routes by layer type. A preset for alerts would walk straight past this.
  for (const preset of ALL_PRESETS) {
    assert.notEqual(preset.layerType, 'alerts', `preset "${preset.id}" would style every alert at once`);
  }
});

