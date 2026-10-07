/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Looks for text, goals, Spotify, the plan and the question.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';
import { ALL_PRESETS } from './stylesheets.js';
import { previewPlan, previewQuestions } from './looks.js';

// ------------------------------------------------- words on the canvas

test('the text layer names the two things it draws', () => {
  /*
    The box that decides where the words sit, and the words. Two is all there
    is, and naming them is what lets a heading be given a rule under it or a
    chip around it without touching the controls.
  */
  const src = fs.readFileSync(new URL('../../web/components/TextLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('data-text="box"'), 'the alignment box has no name');
  assert.ok(src.includes('data-text="words"'), 'the words have no name');
});

test('and the editor offers exactly those', () => {
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  const list = panel.slice(panel.indexOf('LAYER_PARTS'), panel.indexOf('export const LayerCssPanel'));
  const block = list.slice(list.indexOf('text: ['), list.indexOf('],', list.indexOf('text: [')));
  for (const part of ['box', 'words']) {
    assert.ok(block.includes(`data-text="${part}"`), `the editor does not offer the ${part}`);
  }
});

test('a text preset previews with words in it', () => {
  /*
    A text layer with nothing typed into it draws nothing at all, so a card for
    one would be an empty box — which is the hole the nameplate fell into, and
    the whole point of the library is that you can see what you are getting.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("object.layerType === 'text' ? { text:"), 'a text preview has nothing to draw');
  const sizes = view.slice(view.indexOf('PREVIEW_SIZE'), view.indexOf('const LABELS'));
  assert.ok(sizes.includes('text:'), 'the text previews at the shape size');
});



// ------------------------------------------------------- counting towards one

test('the goal bar names its head and its bar', () => {
  /*
    A label, the numbers, the target inside them, the percentage, the track and
    the fill. Everything a look would want to treat differently — and the fill
    especially, which is the one part of the layer that means anything.
  */
  const src = fs.readFileSync(new URL('../../web/components/GoalBar.tsx', SCRIPT_URL), 'utf8');
  for (const part of ['head', 'label', 'numbers', 'target', 'percent', 'track', 'fill']) {
    assert.ok(src.includes(`data-goal="${part}"`), `the goal bar does not name its ${part}`);
  }
});

test('and the numbers are told apart from the percentage', () => {
  /*
    They are the same markup with the same classes, so naming them by class
    would have named one of them twice and left the other unreachable.
  */
  const src = fs.readFileSync(new URL('../../web/components/GoalBar.tsx', SCRIPT_URL), 'utf8');
  const numbers = src.indexOf('data-goal="numbers"');
  const percent = src.indexOf('data-goal="percent"');
  assert.ok(numbers > 0 && percent > numbers, 'the two are not both named, in that order');
  assert.ok(src.slice(numbers, percent).includes('showPercent'), 'the percentage hook is on the numbers');
});

test('the editor offers exactly those', () => {
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  const list = panel.slice(panel.indexOf('LAYER_PARTS'), panel.indexOf('export const LayerCssPanel'));
  const block = list.slice(list.indexOf('goal: ['), list.indexOf('],', list.indexOf('goal: [')));
  for (const part of ['head', 'label', 'numbers', 'target', 'percent', 'track', 'fill']) {
    assert.ok(block.includes(`data-goal="${part}"`), `the editor does not offer the ${part}`);
  }
});

test('a goal previews part way along rather than empty or full', () => {
  /*
    An empty bar and a full one both hide what the fill is doing, and a goal
    with no target reads as a dash — none of the three tells you anything about
    a stylesheet for it.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  const cfg = view.slice(view.indexOf("object.layerType === 'goal' ?"));
  const line = cfg.slice(0, cfg.indexOf(String.fromCharCode(10)));
  assert.ok(line.includes('manualValue:'), 'a goal preview counts nothing');
  assert.ok(line.includes('target:'), 'a goal preview counts towards nothing');
  const value = Number(line.slice(line.indexOf('manualValue:') + 12, line.indexOf(',', line.indexOf('manualValue:'))));
  const target = Number(line.slice(line.indexOf('target:') + 7, line.indexOf(',', line.indexOf('target:'))));
  assert.ok(value > 0 && value < target, `a goal preview draws ${value} of ${target}`);
});


// ----------------------------------- what is playing, as a thing you can reshape

const NOW_PLAYING = fs.readFileSync(new URL('../../web/components/SpotifyNowPlaying.tsx', SCRIPT_URL), 'utf8');
const STYLES = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');

test('nothing wraps anything, which is the whole design', () => {
  /*
    Nesting is what stops a layer being reshaped. Art wrapped together with the
    title in one row means CSS can only ever move rows about — pulling the
    title out to sit beside the progress would need the component rewritten.
    Every part a sibling, and a stylesheet can put them anywhere.

    The one exception is the fill, which has to sit inside something to be
    clipped by it.
  */
  /*
    Read off the indentation, which is what sibling means in a file laid out
    like this one. A reformat that re-wrapped one of these would fail here
    without anything really being wrong — but the alternative is trusting that
    nobody nests them again, and that is the one thing this whole component is.
    file: every part sits at the same depth, and only the fill is deeper.
  */
  const depth = {};
  for (const line of NOW_PLAYING.split(String.fromCharCode(10))) {
    const mark = line.indexOf('data-spotify=');
    if (mark < 0) continue;
    const name = line.slice(mark + 14, line.indexOf(String.fromCharCode(34), mark + 14));
    if (name === 'player' || !name) continue;
    depth[name] = line.length - line.trimStart().length;
  }
  const parts = Object.keys(depth).filter((k) => k !== 'fill');
  assert.ok(parts.length >= 7, `only ${parts.length} part(s) found, so this proves little`);
  const flat = new Set(parts.map((k) => depth[k]));
  assert.equal(flat.size, 1, `the parts sit at ${flat.size} different depths, so something is wrapped in something`);
  assert.ok(depth.fill > depth.progress, 'the fill is not inside the progress');
});

test('with nothing playing it is the same player, empty, rather than a hole in the layout', () => {
  /*
    A layer that vanished between songs left an empty space in whatever was
    designed around it. It keeps every part instead, saying so where the song
    would be, and names the state so a look can dim it. Hiding it between
    songs is the layer's "A song is playing" condition.
  */
  const idle = NOW_PLAYING.slice(NOW_PLAYING.indexOf('if (!track) {'), NOW_PLAYING.indexOf('const pct ='));
  assert.ok(idle.includes('data-spotify-state="idle"'), 'nothing playing is not told apart from paused');
  for (const part of ['player', 'art', 'label', 'title', 'artist', 'album', 'elapsed', 'duration', 'progress', 'fill']) {
    assert.ok(idle.includes(`data-spotify="${part}"`), `with nothing playing the player has no ${part}, so the layout moves`);
  }
  assert.ok(!NOW_PLAYING.includes('if (!track) return null;'), 'nothing playing draws nothing again');
  assert.ok(idle.includes('t?.spotifyIdleTitle ||'), 'the words for nothing playing are English only');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  assert.equal(strings.split("    spotifyIdleTitle: '").length - 1, 2, 'the words for nothing playing are not in both languages');
});

test('every part it draws has a name', () => {
  for (const part of ['player', 'art', 'label', 'title', 'artist', 'album', 'elapsed', 'duration', 'progress', 'fill']) {
    assert.ok(NOW_PLAYING.includes(`data-spotify="${part}"`), `the player does not name its ${part}`);
  }
});

test('and the numbers behind it reach the stylesheet too', () => {
  /*
    A layout is not the only thing somebody wants to drive. How far through the
    track is arrives as a property, so a rule can use it on something that is
    not the fill at all — a gradient stop, a mask, a width somewhere else. And
    the state arrives as an attribute, so a rule can answer it without anything
    being told to add a class.
  */
  assert.ok(NOW_PLAYING.includes("['--spotify-progress' as any]"), 'how far through never reaches CSS');
  assert.ok(NOW_PLAYING.includes('data-spotify-state={'), 'playing and paused are not told apart');
  assert.ok(STYLES.includes('var(--spotify-progress'), 'the fill does not use the property either');
});

test('the default layout is a stylesheet, not an inline style', () => {
  /*
    Written inline it would beat every rule, and the layer would be
    reshapeable in theory only. As ordinary classes it is a default that a
    preset can replace with one declaration.
  */
  assert.ok(STYLES.includes('.spotify-now-playing {'), 'the default layout has no stylesheet');
  assert.ok(STYLES.includes('grid-template-areas:'), 'the default layout is not a grid of named areas');
  const inline = NOW_PLAYING.slice(NOW_PLAYING.indexOf('style={{'), NOW_PLAYING.indexOf('>', NOW_PLAYING.indexOf('style={{')));
  assert.ok(!inline.includes('grid'), 'the layout is written inline, where no rule can reach it');
});


test('the dashboard keeps the player with the buttons on it', () => {
  /*
    Two jobs, two components. The dashboard one can be clicked; a browser
    source cannot, and arranging a layout around controls nobody can press is
    what made the old one a card in the first place.
  */
  const dash = fs.readFileSync(new URL('../../web/components/views/DashboardView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(dash.includes('<SpotifyPlayer'), 'the dashboard lost its player');
  const canvas = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(canvas.includes('<SpotifyNowPlaying'), 'the canvas still draws the card with the buttons');
  assert.ok(!NOW_PLAYING.includes('onClick'), 'the overlay one has controls a browser source cannot press');
});

// ------------------------------------------------ what the stream is working through

const PLAN = fs.readFileSync(new URL('../../web/components/PlanOverlay.tsx', SCRIPT_URL), 'utf8');

test('the plan names its parts', () => {
  for (const part of ['list', 'title', 'item', 'mark', 'text', 'note']) {
    assert.ok(PLAN.includes(`data-plan="${part}"`), `the plan does not name its ${part}`);
  }
});

test('and says which line each one is', () => {
  /*
    Whether the current line is bold and the finished ones struck through is a
    decision a look should be able to make, and it cannot make it if the only
    thing on the page is the result of the component having made it. The same
    reason a chat row says which rank its chatter holds.
  */
  assert.ok(PLAN.includes('data-plan-state='), 'nothing says which line is which');
  for (const state of ['now', 'done', 'todo']) {
    assert.ok(PLAN.includes(`'${state}'`), `a line is never ${state}`);
  }
});

test('the editor offers exactly the parts it draws', () => {
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  const list = panel.slice(panel.indexOf('LAYER_PARTS'), panel.indexOf('export const LayerCssPanel'));
  const block = list.slice(list.indexOf('plan: ['), list.indexOf('],', list.indexOf('plan: [')));
  for (const part of ['list', 'title', 'item', 'mark', 'text', 'note']) {
    assert.ok(block.includes(`data-plan="${part}"`), `the editor does not offer the ${part}`);
  }
});

test('a plan previews with a line done, one current and one to come', () => {
  /*
    A plan with nothing in it draws nothing at all, and an all-to-come list
    says nothing about how a finished line reads — which is half of what a
    look for this decides.
  */
  const plan = previewPlan({ items: [] });
  assert.ok(plan.items.length >= 3, `a plan preview has ${plan.items.length} line(s)`);
  assert.ok(plan.items.some((i) => i.done), 'no line is behind you');
  assert.ok(plan.items.some((i) => i.id === plan.currentId), 'no line is the one you are on');
  assert.ok(plan.items.some((i) => !i.done && i.id !== plan.currentId), 'no line is still to come');
  /*
    And a real plan is left alone only when it shows all three states, which
    is a higher bar than the other previews set. A run card with a real game
    and a borrowed category is still a run card; a plan where nothing is
    behind you hides half of what a look for it decides.
  */
  const whole = { items: [{ id: 'a', text: 'one', done: true }, { id: 'b', text: 'two' }, { id: 'c', text: 'three' }], currentId: 'b' };
  assert.equal(previewPlan(whole), whole);
  const partial = { items: [{ id: 'a', text: 'one' }, { id: 'b', text: 'two' }], currentId: 'a' };
  assert.notEqual(previewPlan(partial), partial);
  assert.ok(previewPlan(partial).items.some((i) => i.done), 'a plan with nothing behind you previews with nothing behind you');
});


// ------------------------------------------------- the question being read out

const QUESTION = fs.readFileSync(new URL('../../web/components/QuestionOverlay.tsx', SCRIPT_URL), 'utf8');

test('the question names its parts', () => {
  for (const part of ['card', 'head', 'label', 'asker', 'text']) {
    assert.ok(QUESTION.includes(`data-question="${part}"`), `the question does not name its ${part}`);
  }
});

test('and the editor offers exactly those', () => {
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  const list = panel.slice(panel.indexOf('LAYER_PARTS'), panel.indexOf('export const LayerCssPanel'));
  const block = list.slice(list.indexOf('question: ['), list.indexOf('],', list.indexOf('question: [')));
  for (const part of ['card', 'head', 'label', 'asker', 'text']) {
    assert.ok(block.includes(`data-question="${part}"`), `the editor does not offer the ${part}`);
  }
});

test('a question previews with one being asked', () => {
  /*
    The overlay draws nothing at all unless one is up, which is right on stream
    — it sits in a layout all year and appears for the segment it is for — and
    an empty card in a catalogue.
  */
  const fed = previewQuestions({ items: [], showingId: '' });
  const showing = fed.items.find((q) => q.id === fed.showingId);
  assert.ok(showing, 'a question preview has nothing being asked');
  assert.ok(showing.text && showing.user, 'the stand-in has no question or nobody asking it');
  // And one really being asked is left alone.
  const mine = { items: [{ id: 'x', user: 'someone', text: 'a real one' }], showingId: 'x' };
  assert.equal(previewQuestions(mine), mine);
});


