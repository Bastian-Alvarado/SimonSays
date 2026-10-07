/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The omnibar's exit, and the themes built since.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';
import { ALL_PRESETS, COMPONENTS, OFFERED, PARTS_PANEL } from './stylesheets.js';
import { previewOmnibar } from './looks.js';

// ------------------------------------------------- the bar has an exit now
//
// Two things the bar could not do before. A slot can be kept on the bar
// instead of taking its turn, the way a marathon keeps its total up while
// everything else cycles past; and the slot being replaced is animated away
// rather than simply being gone by the time the next one starts arriving.

test('a pinned slot survives the save', () => {
  const saved = engine.store.setOmnibar({
    enabled: true,
    defaultSeconds: 10,
    items: [
      { id: 'o-pin', type: 'text', enabled: true, pinned: true, name: '', label: '', text: 'Total', seconds: null },
      { id: 'o-spin', type: 'text', enabled: true, name: '', label: '', text: 'Rotates', seconds: null },
      { id: 'o-liar', type: 'text', enabled: true, pinned: 'yes', name: '', label: '', text: 'Nearly', seconds: null },
    ],
  });
  assert.equal(saved.items[0].pinned, true, 'the pin was dropped on save');
  assert.equal(saved.items[1].pinned, false, 'an unpinned slot does not say so, so nothing can tell them apart');
  // Only the boolean. A truthy string arriving from anywhere would otherwise
  // take a slot out of the rotation, which is the harder half to notice.
  assert.equal(saved.items[2].pinned, false, 'anything truthy pins a slot');
});

test('and keeps the seconds it had, so unpinning puts it back', () => {
  const saved = engine.store.setOmnibar({
    enabled: true,
    defaultSeconds: 10,
    items: [{ id: 'o-keep', type: 'text', enabled: true, pinned: true, name: '', label: '', text: 'x', seconds: 30 }],
  });
  assert.equal(saved.items[0].seconds, 30, 'pinning threw away the slot length rather than parking it');
});

test('the slot on its way out is taken out of the flow', () => {
  /*
    An exit that stays in the flow is worse than no exit: the slot arriving is
    shoved sideways by the one it is replacing, for as long as the replacement
    takes. So the leaving copy is positioned, which needs something positioned
    to be measured against — and the stage is the only thing that is the size
    of the rotating region.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const leaving = src.slice(src.indexOf("state === 'leaving' ?"));
  assert.ok(/state === 'leaving' \? `absolute/.test(leaving),
    'the outgoing slot is still in the flow, so it pushes the one arriving');
  const stage = src.slice(src.indexOf('data-omnibar="stage"') - 200, src.indexOf('data-omnibar="stage"'));
  assert.ok(stage.includes('relative'),
    'nothing positioned holds the leaving slot, so it is measured against the page');
});

test('and pinned slots stand outside the part that changes', () => {
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const left = src.indexOf('pinnedLeft.map');
  const stage = src.indexOf('data-omnibar="stage"');
  const right = src.indexOf('pinnedRight.map');
  assert.ok(left > 0 && stage > 0 && right > 0, 'the bar no longer draws pinned slots either side of the rotation');
  assert.ok(left < stage && stage < right,
    'a pinned slot is drawn inside the stage, where the slot leaving would cover it');
});

test('the outgoing slot is kept as long as its exit takes', () => {
  /*
    The component names Tailwind animations and then takes the element away on
    a timer of its own. Two ways for that to be wrong and neither shows up as
    an error: an animation that was never defined — which is how every alert
    in this app went years without animating — and one that runs for longer
    than the element is kept, which is a cut dressed as a fade.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const tw = fs.readFileSync(new URL('../../web/tailwind.config.js', SCRIPT_URL), 'utf8');

  const held = Number(/const EXIT_MS = (\d+)/.exec(src)[1]);
  const named = [...new Set([...src.matchAll(/animate-([a-z-]+)/g)].map((m) => m[1]))];
  assert.ok(named.length >= 4, `the bar names only ${named.length} animations`);

  for (const name of named) {
    const found = new RegExp(`'${name}': '\\S+ ([\\d.]+)s`).exec(tw);
    assert.ok(found, `the bar asks for animate-${name}, which the config does not define`);
    if (!/out/.test(name)) continue;
    const runs = Number(found[1]) * 1000;
    assert.ok(runs <= held, `animate-${name} runs for ${runs}ms and the slot is kept for ${held}ms`);
  }
});

test('a theme that grows its slot stops a pinned one growing too', () => {
  /*
    Both bar themes fill the bar with a cell by growing the slot. A pinned
    slot is a sibling of the whole rotation rather than part of it, so the
    same rule has it claiming an equal share of the bar and squeezing
    everything that rotates into what is left.
  */
  const grows = (css) => {
    if (!css.includes('[data-omnibar="slot"]')) return false;
    const rule = css.slice(css.indexOf('[data-omnibar="slot"]'));
    return /flex:\s*1\s/.test(rule.slice(0, 160));
  };
  const bars = ALL_PRESETS.filter((p) => p.layerType === 'omnibar' && grows(p.css));
  assert.ok(bars.length >= 2, `only ${bars.length} bar themes grow their slot, so this checks nothing`);
  for (const preset of bars) {
    assert.ok(preset.css.includes('[data-omnibar-state="pinned"]'),
      `${preset.id} grows every slot, so a pinned one fights the rotation for the bar`);
  }
  // The reading of "grows" is the fragile half, so it is checked against a
  // sheet that plainly does not.
  assert.ok(!grows('[data-omnibar="slot"] { flex: 0 0 auto; }'), 'anything at all reads as growing');
});


test('a bar told to walk long values past says so on save', () => {
  const saved = engine.store.setOmnibar({ enabled: true, defaultSeconds: 10, items: [], style: { scroll: true } });
  assert.equal(saved.style.scroll, true, 'the setting was dropped on save');
  const off = engine.store.setOmnibar({ enabled: true, defaultSeconds: 10, items: [], style: {} });
  assert.equal(off.style.scroll, false, 'a bar that never asked for it reads as unset rather than off');
  const liar = engine.store.setOmnibar({ enabled: true, defaultSeconds: 10, items: [], style: { scroll: 'sure' } });
  assert.equal(liar.style.scroll, false, 'anything truthy sets a bar moving');
});

test('a value is cut short or walked past, never both', () => {
  /*
    An ellipsis says the rest is not coming. On a value that is about to walk
    past, that is the opposite of what is happening — and `truncate` brings
    one along with the clipping, so the two cannot both be on.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const value = src.slice(src.indexOf('data-omnibar="value"') - 400, src.indexOf('data-omnibar="value"'));
  assert.ok(/drift \?.*:\s*'truncate'/.test(value.replace(/\s+/g, ' ')),
    'the value is truncated whether or not it is moving');
});

test('and a value that fits is not moved at all', () => {
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const words = src.slice(src.indexOf('data-omnibar="words"') - 400, src.indexOf('data-omnibar="words"'));
  assert.ok(words.includes("${over ? 'animate-bar-drift' : ''}"),
    'the drift is not conditional on there being something to drift past');
  // Measured, not guessed from the text: the font, the size and the width of
  // the source all decide whether a value fits, and none of them are known here.
  assert.ok(src.includes('scrollWidth') && src.includes('clientWidth'),
    'whether a value fits is being guessed rather than measured');
  assert.ok(src.includes('ResizeObserver'),
    'a bar resized in OBS keeps whatever answer it got at its old width');
});

test('the drift reads the distance the bar sets on it', () => {
  /*
    The keyframes cannot know how far to walk — that is a measurement, taken
    per slot — so they read a property the element carries. If the two names
    ever stop matching, the animation runs and moves nothing, which looks
    exactly like a value that fits.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const tw = fs.readFileSync(new URL('../../web/tailwind.config.js', SCRIPT_URL), 'utf8');
  const set = /'(--[a-z-]+)' as any\]: `\$\{-over\}px`/.exec(src);
  assert.ok(set, 'the slot no longer tells the animation how far to go');
  assert.ok(tw.includes(`translateX(var(${set[1]}`),
    `the keyframes do not read ${set[1]}, so the drift would move nothing`);
  assert.ok(/'bar-drift': 'barDrift/.test(tw), 'animate-bar-drift is not defined, so nothing moves');
});

test('the slot leaving is picked while rendering, not afterwards', () => {
  /*
    The whole point of keeping it is that it is the same element, still doing
    whatever it was doing. Decided in an effect, it is not: React has already
    committed a bar holding only the slot that arrived, so the outgoing one
    was unmounted in that commit and what comes back a moment later is a new
    element wearing the old words.

    Measured, not assumed — every element on the bar was stamped and watched
    across a swap. Decided afterwards the outgoing slot came back with a new
    stamp and a value mid-walk snapped to its first word; decided here it
    keeps its stamp and its position.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const from = src.indexOf('const [swap, setSwap]');
  assert.ok(from > 0, 'the bar no longer tracks which slot is on its way out');
  const beforeAnyEffect = src.slice(from, src.indexOf('useEffect(', from));
  assert.ok(beforeAnyEffect.includes('setSwap('),
    'the slot leaving is chosen in an effect, so it is a new element by the time it is drawn');
  assert.ok(beforeAnyEffect.includes('swap.on !== shownId'),
    'nothing compares what is showing against what was, so no swap is ever noticed');
});

test('a slot that changes what it says without moving is pointed at', () => {
  /*
    The rotation was the only change the bar had a way of showing. A pinned
    total rewritten by an action, the commands slot moving on to its next four
    triggers, a track ending — all of it was two different pieces of text
    between two frames, which on a bar nobody is staring at is the same as
    nothing happening.

    Watched over the real websocket: rewriting the pinned total marked the
    slot and lifted it, brightness 1.87 decaying to 1.01 over the next six
    hundred milliseconds, and rewriting it again to the same words did not.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const sheet = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('data-omnibar-fresh='), 'nothing on the page says a slot has just changed');
  assert.ok(/@keyframes bar-fresh \{[^}]*brightness/s.test(sheet),
    'the mark is drawn as a colour rather than a brightness, so it fights whatever the theme painted');

  /*
    Named by the moment AND the part, which is the whole reason it shows.

    As a utility class on the value it did nothing at all: both bar themes set
    an animation on that same element, at the same specificity, from a sheet
    injected later — so the theme won every time and the slot was marked to no
    visible effect. Watched on a Marathon bar to be sure of it: the attribute
    was set, the computed animation was the theme's, and the filter never left
    none. Naming the moment as well as the part puts the default one step
    above what a theme says about the value alone, and a theme that does have
    an opinion writes the same pair and takes it back.
  */
  assert.ok(/\[data-omnibar-fresh="yes"\]\s+\[data-omnibar="value"\]\s*\{[^}]*animation:\s*bar-fresh/.test(sheet),
    'the mark is written where any theme touching the value silences it');
  assert.ok(!src.includes('animate-bar-fresh'),
    'the old utility is still on the element, where a theme overrides it');
});

test('but a slot that changes constantly is not', () => {
  /*
    A slot mirroring a running countdown says something different every
    second. Marked each time, the bar flashes once a second for as long as the
    clock runs — which is worse than never marking anything. So a change only
    counts when the slot had been saying the same thing for a while, and three
    real changes a second apart marked only the first.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const quiet = Number(/const FRESH_QUIET_MS = (\d+)/.exec(src)[1]);
  assert.ok(quiet > 1000, `a clock ticks once a second and the bar marks anything steadier than ${quiet}ms`);
  const shown = Number(/const FRESH_MS = (\d+)/.exec(src)[1]);
  assert.ok(shown < quiet, `the mark lasts ${shown}ms and the quiet it needs is ${quiet}ms, so marks can overlap`);
  assert.ok(src.includes("notice={style.transition !== 'none'}"),
    'a bar told not to animate still flashes when a value changes');
});

test('a theme card shows a bar with something kept on it', () => {
  /*
    One cell is no longer what a bar looks like. A card drawing a single slot
    says the bar is a place one thing appears in turn, which stopped being
    true when a slot could be kept — and the kept cell is the half somebody is
    most likely to want and least likely to find on their own.

    Only reaches a bar with nothing in it: a configured one previews itself.
  */
  const sample = previewOmnibar({ items: [] });
  assert.ok(sample.items.some((i) => i.pinned === true), 'no card shows a slot being kept');
  assert.ok(sample.items.some((i) => !i.pinned), 'the sample bar has nothing left to rotate');
  const mine = previewOmnibar({ items: [{ id: 'x', type: 'text', enabled: true, text: 'mine' }] });
  assert.equal(mine.items.length, 1, 'a bar that is already set up was replaced by the sample');
});

test('and both bar themes tell a kept cell from the rotation beside it', () => {
  /*
    Two cells of the same colour with nothing between them read as one long
    panel, which is the opposite of the point: a kept cell is a different
    thing from what is cycling past and has to look like one.
  */
  const bars = ALL_PRESETS.filter((p) => p.layerType === 'omnibar' && p.kind !== 'motion'
    && p.css.includes('[data-omnibar-state="pinned"]'));
  assert.ok(bars.length >= 2, `only ${bars.length} bar themes say anything about a kept cell`);
  // To the end of that rule and no further: a sheet with a box-shadow three
  // rules further down would otherwise answer for a pinned cell that has none.
  const ruleFor = (css, selector) => {
    const at = css.indexOf(selector);
    if (at < 0) return '';
    const open = css.indexOf('{', at);
    return open < 0 ? '' : css.slice(open, css.indexOf('}', open));
  };
  for (const preset of bars) {
    const pinned = ruleFor(preset.css, '[data-omnibar-state="pinned"]');
    const edged = /box-shadow|border-right/.test(pinned)
      || /border-right/.test(ruleFor(preset.css, '[data-omnibar="value"]'));
    assert.ok(edged, `${preset.id} runs its kept cell into the rotation with nothing between them`);
  }
  assert.ok(!/box-shadow/.test(ruleFor('[data-omnibar-state="pinned"] { flex: 0 0 auto; }\nx { box-shadow: 0 0 1px red; }', '[data-omnibar-state="pinned"]')),
    'the reading runs past the end of the rule, so a later one answers for it');
});

test('and the moments it offers are ones a slot actually reaches', () => {
  /*
    A part is always there; a moment is what something is doing right now,
    and it is how a theme reaches a piece of a layer that only exists for
    four hundred milliseconds. Both bar themes lean on them, and until they
    were written down the only way to learn they existed was to read
    somebody else's stylesheet.

    Checked in two halves because a wrong one fails in two ways that look
    alike from the outside: an attribute nothing sets, and an attribute set
    to a value nothing ever gives it.
  */
  const block = PARTS_PANEL.slice(PARTS_PANEL.indexOf('LAYER_STATES'), PARTS_PANEL.indexOf('LAYER_PARTS'));
  const quote = String.fromCharCode(39);
  const listed = block.split(String.fromCharCode(10)).map((l) => l.trim())
    .filter((l) => l.startsWith(quote + '['))
    .map((l) => l.slice(1, l.indexOf(quote, 1)));
  assert.ok(listed.length >= 3, `the editor names only ${listed.length} moments`);

  for (const selector of listed) {
    const found = /^\[([a-z-]+)="([a-z]+)"\]$/.exec(selector);
    assert.ok(found, `${selector} is not an attribute set to a value`);
    const [, attr, value] = found;
    assert.ok(COMPONENTS.includes(attr + '='), `the editor offers ${selector} and no component sets ${attr}`);
    assert.ok(COMPONENTS.includes(quote + value + quote),
      `the editor offers ${selector} and nothing ever sets ${attr} to "${value}"`);
  }

  // And the parts list is not quietly answering for them: these are declared
  // above it precisely so the parts check does not sweep them up.
  for (const selector of listed) {
    assert.ok(!OFFERED.includes(selector), `${selector} is listed as a part as well as a moment`);
  }
});

test('the themes that use a moment are using one the editor names', () => {
  /*
    The other direction. A theme reaching for a state nobody is told about is
    a promise made in private — and one the next person to touch the bar has
    no reason to keep.
  */
  const block = PARTS_PANEL.slice(PARTS_PANEL.indexOf('LAYER_STATES'), PARTS_PANEL.indexOf('LAYER_PARTS'));
  const quote = String.fromCharCode(39);
  const listed = block.split(String.fromCharCode(10)).map((l) => l.trim())
    .filter((l) => l.startsWith(quote + '['))
    .map((l) => l.slice(1, l.indexOf(quote, 1)));

  const used = new Set();
  for (const preset of ALL_PRESETS.filter((p) => p.layerType === 'omnibar')) {
    for (const hit of (preset.css || '').match(/\[data-omnibar-[a-z]+="[a-z]+"\]/g) || []) used.add(hit);
  }
  assert.ok(used.size >= 2, `the bar themes reach for only ${used.size} moments, so this checks little`);
  for (const selector of used) {
    assert.ok(listed.includes(selector), `a theme styles ${selector}, which the editor never mentions`);
  }
});

test('pinning is a control with its name on it, not only an icon', () => {
  /*
    It shipped as a fourteen-pixel glyph in a row of five other fourteen-pixel
    glyphs, grey until it was on, with a tooltip and nothing else. He went
    looking for what had been added and found one of it — the toggle that had
    words next to it — and reported the rest missing. It was not missing; it
    was unreadable, which on a screen is the same thing.

    A row of small glyphs is a set of shortcuts for somebody who already knows
    what is there. It is not an inventory of what a slot can do, and it is not
    where anybody learns.
  */
  const src = fs.readFileSync(new URL('../../web/components/views/OmnibarView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('<span>{t.omnibarPinItem}</span>'),
    'pinning has no control with its name written on it');
  assert.ok(src.includes('t.omnibarPinHint'), 'nothing says what pinning a slot does');

  /*
    And the two that have no switch at all say so where the switch they ride
    on is. An exit and a change mark nobody is told about are features nobody
    has.
  */
  assert.ok(src.includes('t.omnibarTransitionHint'),
    'the slide/fade/none choice does not mention the two things it now also decides');
});

test('and every string the omnibar screen reaches for exists in both languages', () => {
  /*
    A missing key renders as nothing at all — a control with no name, which is
    the failure this pair of tests is about in the first place.
  */
  const src = fs.readFileSync(new URL('../../web/components/views/OmnibarView.tsx', SCRIPT_URL), 'utf8');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  const wanted = [...new Set([...src.matchAll(/\bt\.(omnibar[A-Za-z]+)/g)].map((m) => m[1]))];
  assert.ok(wanted.length >= 20, `the screen names only ${wanted.length} strings`);
  for (const key of wanted) {
    const declared = strings.split(key + ':').length - 1;
    assert.equal(declared, 2, `${key} is declared ${declared} times, and there are two languages`);
  }
});

test('an open slot row does not undo what the other controls just did', () => {
  /*
    The open row keeps a copy of its slot so typing does not go to the server
    on every key, and it writes that copy back when it closes. Every control
    that changed the list from the saved list alone was then quietly undone:

      pinning or switching an open slot off  - undone on close ("the pin turns
                                               itself off when I click away")
      moving an open slot                    - Raised Next Donate Incentive
                                               became Raised Donate Donate
                                               Incentive: one doubled, one gone
      adding a message with a row open       - four slots before, four after
      deleting a row while another is open   - the open one's typing thrown away

    All four reproduced by driving the real screen and reading what the server
    kept, and all four pass that way now. What is held here is the shape of
    the fix: each builds its list from the one with the open copy folded in.
  */
  const src = fs.readFileSync(new URL('../../web/components/views/OmnibarView.tsx', SCRIPT_URL), 'utf8');
  const body = (start) => {
    const at = src.indexOf(start);
    assert.ok(at > 0, `${start} is gone`);
    return src.slice(at, src.indexOf('\n  };', at));
  };
  for (const start of ['const setItem =', 'const move =', 'const addItem =']) {
    const code = body(start);
    assert.ok(code.includes('current()'), `${start} builds its list without the open row's copy`);
    assert.ok(!/cfg\.items\.(map|filter)\(|\[\.\.\.cfg\.items/.test(code),
      `${start} still builds from the saved list alone, which the open row then overwrites`);
  }
  const remove = src.slice(src.indexOf('<Trash2') - 400, src.indexOf('<Trash2'));
  assert.ok(remove.includes('current().filter('), 'deleting a row drops whatever the open one had not saved yet');
});

test('a pinned slot keeps to its own width whatever a layer copy says', () => {
  /*
    A theme is copied into a layer when it is applied and never updated after,
    so fixing a theme does not reach anybody who already applied it. His bar
    carried the Marathon CSS from before pinning existed, which grows every
    slot: a kept slot took 1100 of 1920 pixels for words needing about 280,
    and the rotation was squeezed into the rest and cut off mid-name. Drawn
    from his own layout on the real canvas route: 1100 before this rule, 279
    after, and the rotation went from 820 to 1641.
  */
  const sheet = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  assert.ok(/\[data-omnibar="bar"\]\s*>\s*\[data-omnibar-state="pinned"\]\s*\{[^}]*flex:\s*0 0 auto/.test(sheet),
    'nothing outside the themes stops a pinned slot growing, so an old layer copy still lets it');
});

test('a slot leaving is let go at once when nothing is taking it away', () => {
  /*
    Keeping a slot on its way out assumed there would be a way out. His layer
    has Marathon's drawn ticker from before exits existed, which switches the
    slot's own animation off and offers nothing instead — so the outgoing slot
    sat fully drawn over the one arriving for its whole hold and then vanished.
    Measured on his layout: opacity 1, nothing running, every frame. Now: not
    held at all. And the themes that do have an exit still get to play it.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('getAnimations({ subtree: true })'), 'a leaving slot is kept whether or not anything moves it');
  assert.ok(src.includes('onStill()'), 'nothing lets the bar drop a slot that is not leaving by any animation');

  /*
    The drift and the change mark run on a leaving slot too, and neither is a
    way out: counted, a long value on a theme with no exit would be held over
    the new slot exactly as before. They are excluded by name, so the names
    have to be the ones the animations actually carry.
  */
  const tw = fs.readFileSync(new URL('../../web/tailwind.config.js', SCRIPT_URL), 'utf8');
  const sheet = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  assert.ok(src.includes("name !== 'barDrift'") && /\bbarDrift:\s*\{/.test(tw),
    'the drift is excluded under a name its keyframes do not have');
  assert.ok(src.includes("name !== 'bar-fresh'") && sheet.includes('@keyframes bar-fresh'),
    'the change mark is excluded under a name its keyframes do not have');
});

test('the bar keeps a logo, from our uploads or http(s) and nowhere else', () => {
  /*
    It ends up as an image source on stream, so it gets the same rule as every
    other picture the server stores an address for.
  */
  const save = (logo, logoSize) => engine.store.setOmnibar({ enabled: true, defaultSeconds: 10, items: [], style: { logo, logoSize } });
  assert.equal(save('/media/gdq.png').style.logo, '/media/gdq.png', 'an upload of ours was refused');
  assert.equal(save('https://example.com/logo.svg').style.logo, 'https://example.com/logo.svg', 'a hosted picture was refused');
  for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'logo.png', '//evil.example/x.png']) {
    assert.equal(save(bad).style.logo, '', `${bad} was kept as a logo`);
  }
  assert.equal(save('/media/x.png', 5).style.logoSize, 30, 'a logo can be shrunk to nothing');
  assert.equal(save('/media/x.png', 500).style.logoSize, 100, 'a logo can be taller than its bar');
  assert.equal(save('/media/x.png').style.logoSize, 70, 'a logo with no size set has none');
});

test('a logo that will not load is left out rather than drawn broken', () => {
  /*
    A broken-picture icon on a browser source is on stream, in front of
    everybody, for as long as nobody happens to notice. A deleted upload or a
    link that went dead should simply stop drawing.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const logo = src.slice(src.indexOf('data-omnibar="logo"') - 200, src.indexOf('data-omnibar="logo"') + 500);
  assert.ok(logo.includes('onError='), 'a logo that fails to load is drawn as a broken picture');
  assert.ok(logo.includes('brokenLogo !== style.logo'), 'a logo that failed once is drawn again anyway');
});

test('and the logo can be chosen from a control with its name on it', () => {
  const panel = fs.readFileSync(new URL('../../web/components/OmnibarLogoPanel.tsx', SCRIPT_URL), 'utf8');
  const view = fs.readFileSync(new URL('../../web/components/views/OmnibarView.tsx', SCRIPT_URL), 'utf8');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('<OmnibarLogoPanel'), 'the omnibar screen never shows the logo control');
  assert.ok(view.includes('uploadAsset={uploadAsset}') && view.includes('listAssets={listAssets}'),
    'the logo control cannot reach the uploads, so it can only take a pasted link');
  const wanted = [...new Set([...panel.matchAll(/t[.](omnibar[A-Za-z]+)/g)].map((m) => m[1]))];
  assert.ok(wanted.length >= 6, `the logo control names only ${wanted.length} strings`);
  for (const key of wanted) {
    assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
  }
});

test('an omnibar label centres its capitals, not just its box', () => {
  /*
    Measured on the 1080p canvas: 25px over the label's capitals and 27px
    under, in a 60px cell both themes centre. The padding moves them by half of
    itself in a centred cell, in the label's own em so it follows the bar's
    size. Inline, since both themes reset the label's padding with a shorthand.
  */
  const src = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const start = src.indexOf('data-omnibar="label"');
  const label = src.slice(start, src.indexOf('{slot.content.label}', start));
  assert.ok(/paddingTop: '0\.16em'/.test(label), 'the label no longer corrects where its capitals sit');

  /* And every shipped theme still centres the label as a flex cell, which is what the half assumes. */
  for (const preset of ALL_PRESETS) {
    const rule = (preset.css || '').match(/\[data-omnibar="label"\]\s*\{([^}]*)\}/);
    if (!rule) continue;
    if (!/display:\s*flex/.test(rule[1])) continue;
    assert.ok(/align-items:\s*center/.test(rule[1]), `${preset.id} makes the label a cell but does not centre it`);
    // The first value of the shorthand is always the top, however many follow it.
    const top = (rule[1].match(/padding:\s*([^;\s]*)/) || [, '0'])[1];
    assert.ok(!/padding-top/.test(rule[1]) && parseFloat(top) === 0,
      `${preset.id} sets the label's top padding itself, which the correction would override`);
  }
});

test('a look’s own fields sit with Look and Motion, not under the stylesheet', () => {
  /*
    Under the stylesheet they read as part of that box, which is the one place
    somebody who wants a slider instead of CSS does not open. They belong with
    the other controls for how a layer looks, straight after Motion and in the
    same column, and open to begin with so they are in plain sight.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const motion = view.indexOf('<LayerMotionPanel');
  const fields = view.indexOf('<StyleFieldsPanel');
  const sheet = view.indexOf('<LayerCssPanel');
  assert.ok(motion > 0 && fields > 0 && sheet > 0, 'the layer editor lost one of its panels');
  assert.equal(view.split('<StyleFieldsPanel').length - 1, 1, 'the fields are drawn twice');
  assert.ok(motion < fields && fields < sheet, 'the fields are not straight after Motion');
  const between = view.slice(motion, fields);
  assert.ok(!between.includes('min-w-0">'), 'the fields have moved into the stylesheet column');
  assert.ok(between.includes('layerNoSettings'),
    'the "nothing of its own to set" note sits under the fields, as if denying them');

  const panel = fs.readFileSync(new URL('../../web/components/StyleFieldsPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes('useState(true)'), 'the fields start folded, so they are hidden again');
  assert.ok(panel.includes('{fields.length}'), 'a folded panel no longer says how many fields it holds');
});


// ---------------------------------------- controls win, on the omnibar
//
// A colour chosen for the bar shows over any look on it, in whichever part of
// the look plays that part; one left automatic is the look's, or the bar's own.

const { presetKind: presetKindOf } = await import('../../../shared/css-presets.js');

test('a bar colour can be left automatic, and a bar stored before that was possible is read as automatic once', () => {
  const before = engine.store.getOmnibar();
  const save = (style) => engine.store.setOmnibar({ ...before, style: { ...before.style, settingsVersion: undefined, ...style } }).style;
  // Stored before the mark: the old defaults are what every untouched bar held.
  const old = save({ background: '#0b0b0ecc', textColor: '#FFFFFF', accentColor: '#f43f5e', transparent: true });
  assert.deepEqual([old.background, old.textColor, old.accentColor], ['', '', ''], 'an old default still covers the look');
  assert.equal(old.transparent, true, 'see-through is a choice, and is kept');
  assert.equal(old.settingsVersion, 2);
  const chosen = save({ background: '#000000', textColor: '#fde047', accentColor: '#22c55e' });
  assert.deepEqual([chosen.background, chosen.textColor, chosen.accentColor], ['#000000', '#fde047', '#22c55e'], 'a colour somebody chose is theirs');
  // Marked, so it happens once: the old pink chosen since is kept.
  const again = engine.store.setOmnibar({ ...before, style: { ...old, accentColor: '#f43f5e' } }).style;
  assert.equal(again.accentColor, '#f43f5e', 'a colour picked since the change was turned back into automatic');
  assert.equal(save({ background: 'red; url(x)' }).background, '', 'what is not a colour is left automatic');
  engine.store.setOmnibar(before);

  const engineSrc = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  assert.match(engineSrc, /filter\(\(b\) => b && !readSettings\(b\.style\)\)\.length;\s*if \(barsBehind\) \{\s*store\.setOmnibar\(db\.omnibar\.get\(\)\);\s*store\.setOmnibars\(db\.omnibars\.get\(\)\);/,
    'bars on disk from before the mark are not saved through at startup');
});

test('every omnibar look reads the bar’s chosen background and accent before its own', () => {
  /*
    The bar sets --omnibar-background, --omnibar-text and --omnibar-accent only
    when chosen. A look that paints the bar's ground, or anything in the accent,
    without reading them first is one where the bar's colours do nothing.
  */
  const looks = ALL_PRESETS.filter((p) => p.layerType === 'omnibar' && presetKindOf(p) === 'look');
  assert.ok(looks.length >= 2, String(looks.length));
  for (const p of looks) {
    const bar = p.css.match(/\[data-(?:omnibar|tallbar)="bar"\]\s*\{([^}]*)\}/);
    assert.ok(bar, `${p.id} has no rule for the bar`);
    const ground = bar[1].match(/(?<![\w-])background\s*:([^;]*)/);
    assert.ok(ground && /^\s*var\(--omnibar-background,/.test(ground[1]), `${p.id} paints the bar without reading its chosen background`);
    assert.ok(p.css.includes('var(--omnibar-accent,'), `${p.id} ignores the bar's chosen accent`);
    // Words it colours itself must read the chosen text colour; the rest inherit the bar's.
    const value = p.css.match(/\[data-omnibar="value"\]\s*\{([^}]*)\}/);
    const ownWords = value && /(?<![\w-])color\s*:([^;]*)/.exec(value[1]);
    if (ownWords) assert.ok(/var\(--omnibar-text,/.test(ownWords[1]), `${p.id} colours the words without reading the chosen text colour`);
  }
});

test('the bar hands a look only what was chosen, and draws its own colours without one', () => {
  const bar = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(bar.includes("['--omnibar-accent' as any]: style.accentColor || undefined"), 'an automatic accent is handed to the look as chosen');
  assert.ok(bar.includes("style.transparent ? 'transparent' : (style.background || undefined)"));
  assert.ok(bar.includes('...omnibarChosen(style),'));
  assert.ok(bar.includes('color: style.accentColor || OMNIBAR_OWN.accent'), 'the plain bar lost its accent');
  const tallBar = fs.readFileSync(new URL('../../web/components/TallOmnibar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(tallBar.includes('...omnibarChosen(style),'), 'the tall bar does not hand its colours to a look');
  const view = fs.readFileSync(new URL('../../web/components/views/OmnibarView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('<AutoColourRow'), 'the colours have no automatic state');
  assert.ok(view.includes("onClear={() => patchStyle({ [key]: '' } as any)}"), 'nothing hands a chosen colour back to the look');
  const defaults = view.slice(view.indexOf('const DEFAULTS'), view.indexOf('};', view.indexOf('const DEFAULTS')));
  assert.ok(defaults.includes("background: ''") && !defaults.includes('settingsVersion:'),
    'a new bar starts with its colours chosen, or the screen stamps the mark itself and an old bar\'s defaults are kept as chosen');
});

test('the viewer counter\'s colours can be left automatic, and old defaults are read as automatic once', () => {
  const before = engine.store.getViewers();
  const save = (style) => engine.store.setViewers({ ...before, style: { ...before.style, settingsVersion: undefined, ...style } }).style;
  const old = save({ color: '#FFFFFF', accentColor: '#f43f5e', background: '#0b0b0ecc', transparent: true });
  assert.deepEqual([old.color, old.accentColor, old.background], ['', '', ''], 'an old default still covers the look');
  assert.equal(old.transparent, true);
  assert.equal(old.settingsVersion, 2);
  const chosen = save({ color: '#fde047', accentColor: '#f4434c', background: '#1e3a8a' });
  assert.deepEqual([chosen.color, chosen.accentColor, chosen.background], ['#fde047', '#f4434c', '#1e3a8a'], 'a colour somebody chose is theirs');
  engine.store.setViewers(before);
  const engineSrc = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  assert.match(engineSrc, /if \(!readSettings\(db\.viewers\.get\(\)\?\.style\)\) \{\s*store\.setViewers\(db\.viewers\.get\(\)\);/,
    'a counter on disk from before the mark is not saved through at startup');
});

test('every viewers look reads the counter\'s chosen colours before its own', () => {
  const looks = ALL_PRESETS.filter((p) => p.layerType === 'viewers' && presetKindOf(p) === 'look');
  assert.ok(looks.length >= 2, String(looks.length));
  const ruleOf = (css, part) => (css.match(new RegExp(`\\[data-viewers="${part}"\\]\\s*\\{([^}]*)\\}`)) || [])[1] || '';
  for (const p of looks) {
    assert.match(ruleOf(p.css, 'box'), /background:\s*var\(--viewers-background,/, `${p.id} paints its box without reading the chosen background`);
    assert.ok(p.css.includes('var(--viewers-accent,'), `${p.id} ignores the chosen mark colour`);
    const own = /(?<![\w-])color\s*:([^;]*)/.exec(ruleOf(p.css, 'count'));
    if (own) assert.match(own[1], /var\(--viewers-text,/, `${p.id} colours the number without reading the chosen text colour`);
  }
  const counter = fs.readFileSync(new URL('../../web/components/ViewerCount.tsx', SCRIPT_URL), 'utf8');
  assert.ok(counter.includes("['--viewers-background' as any]: style?.transparent === false ? (style?.background || undefined) : undefined"),
    'a background is handed to the look while Transparent is on, which is on by default: every look would lose its box');
  assert.ok(counter.includes("['--viewers-accent' as any]: style?.accentColor || undefined"));
  const view = fs.readFileSync(new URL('../../web/components/views/ViewersView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('<AutoColourRow') && view.includes("onClear={() => patchStyle({ [key]: '' } as any)}"), 'the counter\'s colours have no automatic state');
});

const { cleanStyle: cleanCountdownStyle, upgradeStyle: upgradeCountdownStyle } = await import('../../engine/countdown.js');

test('the countdown\'s colours can be left automatic, and old setups are read as automatic once', () => {
  const base = { fontSize: 96, color: '#fde047', labelColor: '#22c55e', background: '#00000000', showLabel: true, settingsVersion: 2 };
  // Empty is kept as asked for; junk keeps what was there.
  const cleared = cleanCountdownStyle({ ...base, color: '', labelColor: 'red; url(x)' }, base);
  assert.equal(cleared.color, '', 'the cross cannot hand a colour back to the look');
  assert.equal(cleared.labelColor, '#22c55e');
  assert.equal(cleared.settingsVersion, 2);
  // Stored before the mark: the old defaults are what every untouched setup held.
  const old = upgradeCountdownStyle({ fontSize: 96, color: '#FFFFFF', labelColor: '#f43f5e', background: '#00000000', showLabel: true });
  assert.deepEqual([old.color, old.labelColor, old.settingsVersion], ['', '', 2], 'an old default still covers the look');
  const chosen = upgradeCountdownStyle({ fontSize: 96, color: '#4ade80', labelColor: '#f43f5e', showLabel: true });
  assert.deepEqual([chosen.color, chosen.labelColor], ['#4ade80', ''], 'a colour somebody chose is theirs');
  assert.equal(upgradeCountdownStyle(base), base, 'a marked setup was rewritten a second time');
  const engineSrc = fs.readFileSync(new URL('../engine/countdown.js', SCRIPT_URL), 'utf8');
  assert.ok(engineSrc.includes('presets: (existing.presets || []).map((p) => ({ ...p, style: upgradeStyle(p.style) })),'), 'saved setups are not read as automatic at startup');
});

const { cleanStyle: cleanTimerStyle } = await import('../../engine/stopwatch.js');

test('the run timer\'s colours can be left automatic, and a colour picked on the screen stays picked', () => {
  const base = { fontSize: 96, color: '', pausedColor: '', finishedColor: '', background: '#00000000', showTenths: true, settingsVersion: 2 };
  // Read from disk at startup, from before the mark: the old defaults were never chosen.
  const old = cleanTimerStyle({ fontSize: 96, color: '#FFFFFF', pausedColor: '#a1a1aa', finishedColor: '#22c55e', background: '#00000000', showTenths: true }, base, true);
  assert.deepEqual([old.color, old.pausedColor, old.finishedColor], ['', '', '#22c55e'], 'an old default still covers the look, or a chosen colour was lost');
  assert.equal(old.settingsVersion, 2);
  // The screen sends one colour at a time, unmarked: a white picked there is a choice.
  assert.equal(cleanTimerStyle({ color: '#ffffff' }, base).color, '#ffffff', 'a white picked on the screen was taken for an old default');
  assert.equal(cleanTimerStyle({ color: '' }, { ...base, color: '#ff0000' }).color, '', 'the cross cannot hand the colour back');
  const looks = ALL_PRESETS.filter((p) => p.layerType === 'stopwatch' && presetKindOf(p) === 'look');
  for (const p of looks) {
    for (const r of p.css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/\[data-stopwatch="digits"\]\s*$/.test(r[1].trim())) continue;
      const c = /(?<![\w-])color\s*:([^;]*!important)/.exec(r[2]);
      if (c) assert.match(c[1], /var\(--stopwatch-colour,/, `${p.id} colours the digits without reading the chosen colour`);
    }
  }
  const clock = fs.readFileSync(new URL('../../web/components/Stopwatch.tsx', SCRIPT_URL), 'utf8');
  assert.ok(clock.includes("['--stopwatch-colour' as any]"));
});

test('every countdown look reads the clock\'s chosen colours before its own', () => {
  const looks = ALL_PRESETS.filter((p) => p.layerType === 'countdown' && presetKindOf(p) === 'look');
  assert.ok(looks.length >= 2, String(looks.length));
  const ruleOf = (css, part) => (css.match(new RegExp(`\\[data-countdown="${part}"\\]\\s*\\{([^}]*)\\}`)) || [])[1] || '';
  for (const p of looks) {
    // A look that colours the digits itself must read the chosen colour first.
    const digits = /(?<![\w-])color\s*:([^;]*)/.exec(ruleOf(p.css, 'digits'));
    if (digits) assert.match(digits[1], /var\(--countdown-text,/, `${p.id} colours the digits without reading the chosen colour`);
    const label = ruleOf(p.css, 'label');
    if (/(?<![\w-])color\s*:[^;]*!important/.test(label)) {
      assert.ok(/var\(--countdown-label,/.test(label), `${p.id} colours the label without reading the chosen label colour`);
    }
  }
  const clock = fs.readFileSync(new URL('../../web/components/Countdown.tsx', SCRIPT_URL), 'utf8');
  assert.ok(clock.includes("['--countdown-text' as any]: style.color || undefined") && clock.includes("['--countdown-label' as any]: style.labelColor || undefined"));
  const view = fs.readFileSync(new URL('../../web/components/views/CountdownView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('<AutoColourRow') && view.includes("onClear={() => control('setStyle', { ...state?.style, [key]: '' })}"), 'the clock\'s colours have no automatic state');
});
