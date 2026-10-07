/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Alert stylesheets, looks and motions, and more of the Marathon language.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { ALERT_OVERLAY, SCRIPT_URL, assert, fs, test } from './harness.js';
import { normaliseLayouts } from './backup-and-layouts.js';
import { MAX_ALERT_CSS, MAX_CHAT_CSS, MAX_SCOPED_CSS, normaliseAlert } from './images-and-alerts.js';
import { ALL_PRESETS, CSS_LOOKS } from './stylesheets.js';
import { presetApplies, presetField, presetKind } from './looks.js';

// ------------------------------------------ a stylesheet that belongs to one alert

const ALERTS_VIEW = fs.readFileSync(new URL('../../web/components/views/AlertsView.tsx', SCRIPT_URL), 'utf8');

test('an alert carries its own look and its own motion', () => {
  const a = normaliseAlert({ type: 'twitch_raid', css: '.look {}', motionCss: '.motion {}' });
  assert.equal(a.css, '.look {}');
  assert.equal(a.motionCss, '.motion {}');
  // And an alert saved before these existed gets empty ones rather than
  // undefined, so the editor has something to put in the box.
  const old = normaliseAlert({ type: 'twitch_follow' });
  assert.equal(old.css, '');
  assert.equal(old.motionCss, '');
});

test('and both are checked the way every other stylesheet is', () => {
  const closer = '<' + '/StYlE';
  const a = normaliseAlert({ css: `.x{} ${closer}><img src=x>`, motionCss: 'a'.repeat(9999) });
  assert.ok(!a.css.toLowerCase().includes('<' + '/style'), a.css);
  assert.ok(a.motionCss.length <= MAX_ALERT_CSS, String(a.motionCss.length));
});

test('the check is one piece of code, not a copy per caller', () => {
  /*
    It is the only thing standing between a text box and the page. A second
    copy is the one that gets forgotten when the rule changes.
  */
  const alerts = fs.readFileSync(new URL('../engine/alerts.js', SCRIPT_URL), 'utf8');
  const layouts = fs.readFileSync(new URL('../engine/layouts.js', SCRIPT_URL), 'utf8');
  for (const [name, src] of [['alerts', alerts], ['layouts', layouts]]) {
    assert.ok(src.includes("from '../../shared/clean-css.js'"), `${name} does not use the shared cleaner`);
    assert.ok(!src.includes('function cleanCss('), `${name} has a copy of the cleaner`);
  }
});

test('an alert stylesheet reaches the page scoped to that alert', () => {
  /*
    Unscoped it would style the whole page — every other overlay on the same
    browser source included.
  */
  assert.ok(ALERT_OVERLAY.includes('<ScopedStyle css={config.css} motionCss={config.motionCss} />'),
    'the alert does not hand its stylesheet to the scoped one');
});

test('and it sits on the alert rather than on the box around it', () => {
  /*
    The outer div is the full canvas the alert is centred in, not the alert.
    A stylesheet scoped there would make :scope mean 1920x1080 of nothing,
    and every rule written against it would miss.
  */
  const outer = ALERT_OVERLAY.indexOf('absolute inset-0 z-50');
  const inner = ALERT_OVERLAY.indexOf('animOut(config.animationOut) : animIn(config.animationIn)');
  const style = ALERT_OVERLAY.indexOf('<ScopedStyle');
  assert.ok(outer > 0 && inner > outer, 'the alert markup has changed shape');
  assert.ok(style > inner, 'the stylesheet is outside the alert, so :scope is the whole canvas');
});

test('the alert hands over its look and its motion in that order', () => {
  // Which way round they are combined is the scoped stylesheet\u2019s business;
  // handing them over the wrong way round here would undo it just as well.
  const call = ALERT_OVERLAY.slice(ALERT_OVERLAY.indexOf('<ScopedStyle'));
  assert.ok(call.indexOf('config.css') < call.indexOf('config.motionCss'), call.slice(0, 90));
});

test('an alert names its parts, and the same names in both arrangements', () => {
  /*
    The caption sits over the picture in one layout and beside it in the
    others. A look written for one that meant nothing in the other would break
    the moment somebody changed the layout, with no hint as to why.
  */
  const cover = ALERT_OVERLAY.slice(ALERT_OVERLAY.indexOf("config.layout === 'image-cover' && image"));
  const both = cover.split('data-alert="body"').length - 1;
  assert.equal(both, 2, `the body is named ${both} time(s), so one arrangement has no name`);
  for (const part of ['media', 'caption', 'name']) {
    assert.ok(ALERT_OVERLAY.includes(`data-alert="${part}"`), `an alert does not name its ${part}`);
  }
});

test('the editor offers exactly the parts the renderer promises', () => {
  const listed = [];
  const from = ALERTS_VIEW.indexOf('const ALERT_PARTS');
  const block = ALERTS_VIEW.slice(from, ALERTS_VIEW.indexOf('];', from));
  let at = block.indexOf('[data-');
  while (at >= 0) { listed.push(block.slice(at + 1, block.indexOf(']', at))); at = block.indexOf('[data-', at + 1); }
  assert.ok(listed.length >= 4, `the editor offers only: ${listed.join(', ')}`);
  for (const selector of listed) {
    assert.ok(ALERT_OVERLAY.includes(selector), `the editor offers ${selector}, which the alert does not draw`);
  }
});

test('an alert part is an attribute rather than text on the page', () => {
  // The same mistake as on the layers: a hook appended after the closing
  // bracket becomes a child, and the words appear on stream.
  for (const line of ALERT_OVERLAY.split(String.fromCharCode(10))) {
    if (!line.includes('data-alert=')) continue;
    assert.ok(line.includes('className') || line.includes('<'),
      `this is not inside a tag, so it reaches the page as text: ${line.trim()}`);
  }
});

test('the alert editor and the layer editor are the same panel', () => {
  /*
    Two copies would be two places for :scope to come to mean different
    things, which is the one thing somebody writing a stylesheet has to be
    able to rely on.
  */
  const layer = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(layer.includes('<StylesheetPanel'), 'the layer panel is its own copy again');
  assert.ok(ALERTS_VIEW.includes('<StylesheetPanel'), 'the alert editor offers no stylesheet box');
  assert.ok(ALERTS_VIEW.includes('css={draft.css}') && ALERTS_VIEW.includes('motionCss={draft.motionCss}'),
    'the alert box is not wired to the alert');
});

test('the preview replays when the stylesheet is edited', () => {
  // An entrance only plays on a mount, so without this a motion typed into
  // the box would appear to do nothing at all.
  const line = ALERTS_VIEW.split(String.fromCharCode(10)).find((l) => l.includes('setPreviewKey((k) => k + 1)') && l.includes('p.animationIn'));
  assert.ok(line, 'the preview is no longer re-keyed on a look change');
  assert.ok(line.includes('p.motionCss !== undefined'), 'a motion edit does not replay the preview');
});

// ------------------------------------------- a look and a motion for an alert

/* presetApplies comes in with the rest of them, further up. */
export const LIBRARY = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');

test('a preset says whether it goes on a layer or on an alert', () => {
  /*
    An alert is not a layer. A layout holds one alerts layer that everything on
    the channel plays through, so an alert preset that were dropped across a
    layout like a layer preset would style every alert at once — which is the
    exact thing the per-alert boxes exist to stop.
  */
  assert.equal(presetApplies({ applies: 'alert' }), 'alert');
  // Everything written before this existed goes on a layer, which is what it did.
  assert.equal(presetApplies({}), 'layer');
});


test('an alert preset only names parts an alert actually has', () => {
  /*
    The generic check reads [data-…] selectors against every component; this
    one is narrower on purpose, because an alert preset naming a layer part
    would sail through that by matching some other component entirely.
  */
  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  for (const preset of ALL_PRESETS.filter((p) => presetApplies(p) === 'alert')) {
    let at = preset.css.indexOf('[data-');
    while (at >= 0) {
      const selector = preset.css.slice(at + 1, preset.css.indexOf(']', at));
      assert.ok(selector.startsWith('data-alert'),
        `alert preset "${preset.id}" names ${selector}, which is not part of an alert`);
      assert.ok(overlay.includes(selector), `alert preset "${preset.id}" names ${selector}, which an alert does not draw`);
      at = preset.css.indexOf('[data-', at + 1);
    }
  }
});



test('the library draws an alert preset with the alert component', () => {
  // Through the canvas it would be a layer, which is the one thing it is not.
  assert.ok(LIBRARY.includes('<AlertOverlay'), 'an alert preset is not previewed by an alert');
  const preview = LIBRARY.slice(LIBRARY.indexOf('const Preview = ('), LIBRARY.indexOf('export const LibraryView'));
  assert.ok(preview.includes("presetApplies(object) === 'alert'"), 'the preview does not tell the two apart');
  // The overlay places itself absolutely, so its box has to be a positioned one.
  assert.ok(preview.includes('className="relative rounded-xl'), 'the alert preview has nowhere to sit');
});

test('applying an alert preset writes to one alert, not across a layout', () => {
  /*
    The whole reason these are not layer presets. Written across a layout it
    would reach the alerts layer, and from there every alert on the channel.
  */
  assert.ok(LIBRARY.includes('system.actions.saveAlertConfig({ ...alertTarget, [field]: object.css })'),
    'an alert preset does not save to the chosen alert');
  const apply = LIBRARY.slice(LIBRARY.indexOf('const commit = (object: any) => {'));
  const guard = apply.indexOf("presetApplies(object) === 'alert'");
  const layers = apply.indexOf('writeLayers(');
  assert.ok(guard > 0 && guard < layers, 'an alert preset falls through into the layer path');
});

test('and it says which alert it is about to change', () => {
  // A button that rewrites something you cannot see named is one nobody should press.
  assert.ok(LIBRARY.includes('setTargetAlert'), 'there is no way to choose the alert');
  assert.ok(LIBRARY.includes('alertsHere && alerts.length > 0'),
    'the alert picker shows even where nothing in the library is for an alert');
  assert.ok(LIBRARY.includes("t.libraryNoAlert || 'There is no alert to apply this to'"),
    'with no alerts the button gives a layer reason for being disabled');
});

// ------------------------------- a preset the server would not keep whole

test('every preset fits in the box it will be stored in', () => {
  /*
    The cap does not refuse what is too long, it cuts the end off — so a preset
    over it reaches the page missing whatever happened to be last in the file,
    and nothing anywhere says so.

    This is not hypothetical. The alert motion grew past 2000 and lost its
    final rule, which was the one that brings the name in: the alert built its
    panel, flickered its letters, dropped away on cue, and simply never played
    the beat in the middle. It looked like a mistake in the choreography.
  */
  for (const preset of ALL_PRESETS) {
    const cap = presetApplies(preset) === 'alert' ? MAX_ALERT_CSS
      : presetApplies(preset) === 'chat' ? MAX_CHAT_CSS
      : MAX_SCOPED_CSS;
    assert.ok(preset.css.length <= cap,
      `preset "${preset.id}" is ${preset.css.length} characters and would be cut to ${cap}`);
  }
});


test('an alert may say more than a layer, and a canvas more than a layer too', () => {
  /*
    A layout can hold forty layers and every one of their stylesheets travels
    in the config each client receives on connect, which is why that one is
    kept tight. An alert carries its own and they do not arrive forty at a
    time, and an alert motion is a timeline rather than a restyle.
  */
  assert.ok(MAX_ALERT_CSS > MAX_SCOPED_CSS, 'an alert is held to the layer budget');
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'shape', css: 'a'.repeat(99999) }] }]);
  const a = normaliseAlert({ type: 'twitch_follow', css: 'a'.repeat(99999) });
  assert.ok(a.css.length > l.layers[0].css.length, 'an alert is cut as short as a layer');
});

// --------------------------------- the two halves of what an alert says

test('an alert names the words you typed apart from the name that changed', () => {
  /*
    A caption is both: the message, which says what happened, and the name,
    which is the part that is different every time. They want different
    treatment — a box around one and not the other — and a stylesheet cannot
    reach a bare text node, so the words have to be an element.
  */
  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(overlay.includes('data-alert="message"'), 'the words are still a bare text node');
  assert.ok(overlay.includes('data-alert="name"'), 'the name has lost its own name');
});

test('and an empty chunk is not rendered as an empty box', () => {
  /*
    A template that begins or ends with the name leaves an empty chunk either
    side of it. As a text node that is nothing; as an element with a filled
    background it is a stray square of colour on the stream.
  */
  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(overlay.includes('if (!p.text) return null;'), 'an empty chunk still renders');
  assert.ok(overlay.includes('{Boolean(words) && <span data-alert="message">'),
    'a chunk of nothing but spaces still renders a box');
});

test('the spaces around the words stay outside the element', () => {
  /*
    "Nuevo follow! {user}" leaves the chunk before the name carrying a trailing
    space. Inside a filled chip that space is a stripe of colour hanging off
    the end of the words; outside it is the gap that separates them from the
    name, which is what it was for.
  */
  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(overlay.includes('const words = p.text.trim();'), 'the words are boxed with their spaces');
  for (const piece of ['{lead}', '{tail}']) {
    assert.ok(overlay.includes(piece), `the ${piece === '{lead}' ? 'leading' : 'trailing'} space is dropped`);
  }
});


test('the editor offers the message alongside the rest', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/AlertsView.tsx', SCRIPT_URL), 'utf8');
  const from = view.indexOf('const ALERT_PARTS');
  const block = view.slice(from, view.indexOf('];', from));
  assert.ok(block.includes('data-alert="message"'), 'the editor does not offer the message');
});

// ------------------------------------------- the ticker is drawn, not slid




// --------------------------------------- more pieces in the marathon language

/** The colours named in the first gradient of a stylesheet. */
const coloursIn = (css) => {
  const at = css.indexOf('linear-gradient');
  if (at < 0) return [];
  const found = [];
  let i = css.indexOf('#', at);
  const end = css.indexOf(')', at);
  while (i >= 0 && i < end) { found.push(css.slice(i, i + 7)); i = css.indexOf('#', i + 1); }
  return found;
};




test('a preset that is not panel-shaped is not drawn as a panel', () => {
  /*
    The library exists so you can see what you are getting. A rule is a few
    pixels tall, and drawn at the height of a panel it is a slab of colour —
    a picture that tells you the opposite of what the preset does.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('object.previewSize || PREVIEW_SIZE[object.layerType]'),
    'a preset can no longer say what shape to show it at');
});

// ------------------------------------------------ a clock in the same language

test('the clock names its parts', () => {
  /*
    A label and a set of digits want different treatment — a chip around one
    and not the other — and until now the only thing a stylesheet could reach
    was the layer around both of them.
  */
  const src = fs.readFileSync(new URL('../../web/components/Countdown.tsx', SCRIPT_URL), 'utf8');
  for (const part of ['clock', 'label', 'digits', 'paused']) {
    assert.ok(src.includes(`data-countdown="${part}"`), `the clock does not name its ${part}`);
  }
});

test('and the editor offers exactly those', () => {
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  const list = panel.slice(panel.indexOf('LAYER_PARTS'), panel.indexOf('export const LayerCssPanel'));
  const block = list.slice(list.indexOf('countdown: ['), list.indexOf('],', list.indexOf('countdown: [')));
  for (const part of ['clock', 'label', 'digits', 'paused']) {
    assert.ok(block.includes(`data-countdown="${part}"`), `the editor does not offer the ${part}`);
  }
});



test('nothing offers the clock a motion, because it never remounts', () => {
  /*
    Its text changes every second and it is deliberately not keyed on that, so
    an entrance written for it would play once when the overlay loaded and
    never again. The library offering one would be offering a silent nothing.
  */
  const motions = ALL_PRESETS.filter((p) => presetKind(p) === 'motion');
  for (const m of motions) {
    assert.notEqual(m.layerType, 'countdown', `"${m.id}" is a motion for a clock that never remounts`);
  }
  const canvas = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!canvas.includes('key={`clock-'), 'the countdown remounts every tick');
});

