/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: What is being played and by whom, and saved timers for the clock.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';
import { MANIFEST, normaliseLayouts } from './backup-and-layouts.js';

// --------------------------------------------- what is being played, and who

export const { NAMEPLATE_SOURCE_IDS, resolvePerson } = await import('../../../shared/run.js');

test('the run holds the few facts a dozen places want', () => {
  const out = engine.store.setRun({
    game: 'Dark Souls', platform: 'PS3', year: '2011', category: 'Any%', estimate: '1:20:00',
    runner: { name: 'Rowan', subtitle: 'he/him' },
    host: { name: 'Nora' },
    commentators: [{ name: 'Ana' }, { name: 'Bo' }],
  });
  assert.equal(out.game, 'Dark Souls');
  assert.equal(out.year, '2011');
  assert.equal(out.runner.name, 'Rowan');
  assert.equal(out.runner.subtitle, 'he/him');
  assert.equal(out.commentators.length, 2);
});

test('every field is optional, because most streams do not fill them all in', () => {
  // A form that refuses to save until every box is filled is a form nobody
  // fills in. A stream with a game and nobody else on it is the normal case.
  const out = engine.store.setRun({ game: 'Tetris' });
  assert.equal(out.game, 'Tetris');
  assert.equal(out.category, '');
  assert.equal(out.runner.name, '');
  assert.deepEqual(out.commentators, []);
});

test('a year is four digits or nothing', () => {
  // It is printed next to the platform, where anything else is a typo.
  assert.equal(engine.store.setRun({ year: '2011' }).year, '2011');
  assert.equal(engine.store.setRun({ year: 'nineteen ninety six' }).year, '');
  assert.equal(engine.store.setRun({ year: '96' }).year, '');
});

test('the layer editor sits under the canvas, not inside the list', () => {
  /*
    The list is a list. It picks a layer and carries the buttons that act on
    one; everything you set about the selected layer is in the space under the
    canvas, which was empty.

    The reason it is in the canvas's own column rather than a third child of
    the grid: the list is the taller of the two the moment a layout has more
    than a handful of layers, and a loose third child would start below the
    bottom of the list instead of below the canvas — which is the gap this
    closed. Measured with ten layers: sixteen pixels under the canvas.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('const layerEditor = (layer: any) =>'),
    'the editor is not one thing, so the list and the panel can draw different controls');
  assert.ok(view.includes('{layerEditor(chosen)}'), 'nothing under the canvas edits the chosen layer');
  assert.ok(view.includes('<div className="min-w-0 space-y-4">'),
    'the canvas and the editor no longer share a column, so a long list pushes the editor down');

  /*
    And the row stops opening once there is somewhere better for it to go.
    Below that breakpoint the page is one column and the row is the only place
    it can be, which is what a phone has always done.
  */
  assert.ok(view.includes('<div className="mt-3 xl:hidden">{layerEditor(layer)}</div>'),
    'the row either never opens on a phone, or opens on a desktop as well as the panel');
  assert.ok(view.includes('hidden xl:block glass-panel'),
    'the panel under the canvas shows on a phone too, where it would be a second copy');
});

test('the editor knows which kinds have nothing of their own to set', () => {
  /*
    JSX cannot be asked whether it rendered anything, so the kinds with a panel
    are written down — and a written-down list is the kind that goes stale the
    first time somebody adds a layer type. This is what stops that: the list
    and the panels mounted beside it have to agree.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const listed = view.slice(view.indexOf('const HAS_OWN = ['), view.indexOf(']', view.indexOf('const HAS_OWN = [')))
    .split(String.fromCharCode(39)).filter((_, i) => i % 2 === 1);
  assert.ok(listed.length >= 6, 'HAS_OWN is not being read: ' + listed.join(', '));

  /* The kinds the editor really mounts a panel for. */
  /*
    To the end of the arrow function, not to the next "return (" — the
    function has one of its own four spaces in, which that matched, and the
    scan then read almost nothing and reported every kind as unmounted.
  */
  const NEWLINE = String.fromCharCode(10);
  const start = view.indexOf('const layerEditor = (layer: any) =>');
  const body = view.slice(start, view.indexOf(NEWLINE + '  };' + NEWLINE, start));
  const mounted = new Set();
  let at = body.indexOf('layer.type === ');
  while (at >= 0) {
    const quote = body.indexOf(String.fromCharCode(39), at);
    mounted.add(body.slice(quote + 1, body.indexOf(String.fromCharCode(39), quote + 1)));
    at = body.indexOf('layer.type === ', at + 1);
  }

  for (const kind of listed) {
    assert.ok(mounted.has(kind), kind + ' is said to have settings of its own, but nothing is mounted for it');
  }
  for (const kind of mounted) {
    assert.ok(listed.includes(kind), kind + ' has a panel, but is told it has nothing of its own to set');
  }
});

test('the couch draws its free seats, which is why it is a layer', () => {
  /*
    Four nameplates would do everything this does but the one thing that
    matters: a plate with nobody in it hides itself, which is right for a
    lower third and wrong for a couch — the gap where the fourth seat was
    reads as something having broken rather than as a seat going spare.
  */
  const roster = fs.readFileSync(new URL('../../web/components/RosterLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(roster.includes('showEmpty'), 'the couch cannot draw a seat nobody is in');
  assert.ok(roster.includes('data-roster-empty'),
    'a free seat is not marked, so a stylesheet cannot tell it from a taken one');

  /*
    And the role marker is worked out from the seat rather than typed into it.
    That is the other half of why this is one layer: nobody has to keep
    "commentator 2" and the second box in step.
  */
  assert.ok(roster.includes("const MARK: Record<string, string> = { runner: 'R', host: 'H', commentator: 'C' };"),
    'the seat marker is no longer derived from the seat');
  const config = roster.slice(roster.indexOf('export interface RosterLayerConfig'), roster.indexOf('interface Person'));
  assert.ok(!/\brole\s*\?:/.test(config), 'the role became something typed in, which is the bookkeeping this avoids');

  /* It is handed the run, so a seat and a plate cannot resolve two people. */
  const canvas = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(canvas.includes('<RosterLayer config={cfg} run={system.data.run} />'),
    'the couch reads people from somewhere other than the run');
});

test('the couch settings are held to something drawable', () => {
  const [ok] = normaliseLayouts([{ id: 'a', layers: [{ type: 'roster', config: {
    include: 'nonsense', seats: 99, columns: 0, emptyText: 'x'.repeat(200),
  } }] }]);
  const c = ok.layers[0].config;
  assert.equal(c.include, 'commentators', 'an unknown set of people was kept');
  assert.ok(c.seats >= 1 && c.seats <= 8, String(c.seats));
  assert.ok(c.columns >= 1 && c.columns <= 4, String(c.columns));
  assert.ok(c.emptyText.length <= 24, String(c.emptyText.length));
  // Empty means the layer's own wording rather than a seat that says nothing.
  assert.equal(normaliseLayouts([{ id: 'b', layers: [{ type: 'roster' }] }])[0].layers[0].config.emptyText, '');
  /* More than one, because each seats a different set of people. */
  const two = normaliseLayouts([{ id: 'c', layers: [{ type: 'roster' }, { type: 'roster' }] }]);
  assert.equal(two[0].layers.length, 2, 'a layout may only hold one couch');
});

test('an empty seat is kept, and nothing is drawn for it', () => {
  /*
    Add commentary adds a seat before anybody is in it, and the editor shows
    only what the store has — so dropping nameless people here meant the row
    came back deleted and the button did nothing. Measured before this was
    changed: the press moved neither the screen nor the stored list.
  */
  const out = engine.store.setRun({ commentators: [{ name: 'Ana' }, { name: '   ' }, { name: 'Cy' }] });
  assert.deepEqual(out.commentators.map((c) => c.name), ['Ana', '', 'Cy']);

  /*
    And nothing reaches stream from one. The plate hides itself only when both
    its lines are empty, which is a different test from this one: a seat that
    has been half filled in has a second line and no name, and would have put
    a plate with only somebody's pronouns on it. So the canvas refuses to draw
    a plate that is following a seat with nobody in it.
  */
  const canvas = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(canvas.includes('if (person && !person.name) return null;'),
    'a plate following an empty seat draws with only a second line on it');

  /* A typed plate is not touched: what was typed is what was asked for. */
  assert.ok(canvas.includes('const shown = person ? { ...cfg, ...person } : cfg;'),
    'a plate with its name typed in no longer draws what was typed');
});

test('the run is capped where a lower third stops fitting', () => {
  const out = engine.store.setRun({
    commentators: Array.from({ length: 12 }, (_, i) => ({ name: 'C' + i })),
    game: 'g'.repeat(500),
  });
  assert.ok(out.commentators.length <= 4, String(out.commentators.length));
  assert.ok(out.game.length <= 80, String(out.game.length));
});

test('a plate can follow the run instead of being retyped', () => {
  /*
    The point of the record existing: four plates that each have to be retyped
    when the guests change are four chances to leave last week's name up.
  */
  const run = {
    runner: { name: 'Rowan', subtitle: 'he/him' },
    host: { name: 'Nora', subtitle: '' },
    commentators: [{ name: 'Ana', subtitle: 'she/her' }, { name: 'Bo', subtitle: '' }],
  };
  assert.equal(resolvePerson('runner', run).name, 'Rowan');
  assert.equal(resolvePerson('host', run).name, 'Nora');
  assert.equal(resolvePerson('commentator2', run).name, 'Bo');
  assert.equal(resolvePerson('commentator1', run).subtitle, 'she/her');
});

test('a plate typed into keeps what was typed', () => {
  // null means "use the layer's own text", which is how a manual plate works.
  assert.equal(resolvePerson('manual', {}), null);
  assert.equal(resolvePerson('', {}), null);
  assert.equal(resolvePerson(undefined, {}), null);
});

test('a plate pointing at somebody who is not there draws nothing', () => {
  /*
    Rather than falling back to whatever was typed into the layer. Falling back
    would put the wrong person's name on screen on the night one commentator
    does not turn up, which is worse than a plate that is simply absent.
  */
  const run = { commentators: [{ name: 'Ana' }] };
  assert.equal(resolvePerson('commentator3', run).name, '');
});

test('the plate source is checked like everything else that reaches a stream', () => {
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'nameplate', config: { source: 'the vibes' } }] }]);
  assert.equal(l.layers[0].config.source, 'manual');
  const [ok] = normaliseLayouts([{ id: 'a', layers: [{ type: 'nameplate', config: { source: 'commentator2' } }] }]);
  assert.equal(ok.layers[0].config.source, 'commentator2');
  assert.ok(NAMEPLATE_SOURCE_IDS.includes('runner'), 'the run cannot be followed at all');
});

test('a plate that follows the run keeps the name typed into it', () => {
  // So switching to the run and back does not lose what was there.
  const [l] = normaliseLayouts([{
    id: 'a', layers: [{ type: 'nameplate', config: { source: 'runner', name: 'Typed' } }],
  }]);
  assert.equal(l.layers[0].config.name, 'Typed');
});

test('the run card is checked like everything else that reaches a stream', () => {
  const [l] = normaliseLayouts([{
    id: 'a', layers: [{ type: 'runcard', config: { align: 'sideways', titleSize: 9999, accentColor: 'red; url(x)' } }],
  }]);
  const c = l.layers[0].config;
  assert.equal(c.align, 'center');
  assert.ok(c.titleSize <= 200, String(c.titleSize));
  assert.equal(c.accentColor, '', 'an unset accent should follow the canvas');
});

test('the run card says nothing until there is a game', () => {
  // A card added and not filled in should be invisible on stream rather than
  // an empty box somebody has to remember to turn off.
  const src = fs.readFileSync(new URL('../../web/components/RunCard.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('if (!game) return null;'), 'an empty run card still draws a box');
});

test('the run reaches the layers that read it', () => {
  const canvas = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(canvas.includes('run: system.data.run'), 'text layers cannot see the run');
  assert.ok(canvas.includes('resolvePerson(cfg.source, system.data.run, (system.data as any).remotePlayers)'), 'nameplates cannot follow the run');
  assert.ok(canvas.includes('const run = system.data.run;') && canvas.includes('run={run}'),
    'the run card has nothing to draw');
});

test('the run travels in a backup, like the plan it sits beside', () => {
  // A blank run card after an import reads as a bug rather than a clean slate.
  assert.ok(MANIFEST.some((e) => e.name === 'run'), 'the run is left behind by a config export');
});

// -------------------------------------------------- saved timers for the clock

// A read that does not also write. `countdown('add', 0)` looks like a no-op
// and is not: it republishes the state, which is enough to mask a regression
// where the nudge itself rewrote the saved timer.
const timers = () => engine.snapshot().countdown;
const byName = (name) => (timers().presets || []).find((p) => p.name === name);

test('a countdown that existed before saved timers did becomes the first one', () => {
  /*
    An empty list beside a configured clock reads as having lost the setup
    rather than as not having saved it yet, and the first thing anybody would
    do is type it back in.
  */
  assert.ok((timers().presets || []).length >= 1, 'nothing was adopted');
});

engine.store.countdown('reset');
engine.store.countdown('setDuration', 5 * 60000);
engine.store.countdown('setLabel', 'Starting soon');
engine.store.countdown('savePreset', 'Starting soon');
engine.store.countdown('setDuration', 15 * 60000);
engine.store.countdown('setLabel', 'Back shortly');
engine.store.countdown('savePreset', 'Intermission');

test('setting up a second timer does not destroy the first', () => {
  /*
    The whole reason saving is explicit. Writing every edit through to whatever
    row is selected sounds friendlier, and it means the act of configuring a
    second timer types over the first one.
  */
  const first = byName('Starting soon');
  assert.equal(first.durationMs, 5 * 60000, 'the first timer was overwritten');
  assert.equal(first.label, 'Starting soon');
});

test('loading a timer brings its settings back', () => {
  engine.store.countdown('loadPreset', byName('Starting soon').id);
  const s = timers();
  assert.equal(s.durationMs, 5 * 60000);
  assert.equal(s.label, 'Starting soon');
});

test('an edit is not saved until it is saved', () => {
  engine.store.countdown('setDuration', 9 * 60000);
  assert.equal(byName('Starting soon').durationMs, 5 * 60000, 'an unsaved edit reached the saved timer');
  engine.store.countdown('updatePreset');
  assert.equal(byName('Starting soon').durationMs, 9 * 60000, 'saving changes did nothing');
});

test('adding a minute mid-stream is not a change to the saved timer', () => {
  // The one-off nudge and the deliberate edit are different actions, and only
  // one of them should be able to rewrite what was saved.
  const before = byName('Starting soon').durationMs;
  engine.store.countdown('add', 60000);
  assert.equal(byName('Starting soon').durationMs, before);
});

test('loading a different timer does not stop a running one', () => {
  /*
    Picking the wrong row mid-countdown should cost a label, not the timer.
    What is on screen while it is not running does follow, because that is the
    number you are about to start.
  */
  engine.store.countdown('reset');
  engine.store.countdown('start');
  const running = timers();
  engine.store.countdown('loadPreset', byName('Intermission').id);
  const after = timers();
  assert.equal(after.mode, 'running');
  assert.equal(after.endsAt, running.endsAt, 'the clock was restarted');
  assert.equal(after.label, 'Back shortly', 'the label did not follow');
  engine.store.countdown('reset');
});

test('deleting a timer leaves the clock exactly as it is', () => {
  // Tidying a list should not change what is on stream.
  const before = timers();
  engine.store.countdown('deletePreset', before.activeId);
  const after = timers();
  assert.equal(after.durationMs, before.durationMs);
  assert.equal(after.label, before.label);
  assert.equal(after.activeId, '', 'the deleted row is still selected');
});

test('a timer can be renamed without touching what it holds', () => {
  const target = byName('Starting soon');
  engine.store.countdown('renamePreset', { id: target.id, name: 'Soon(tm)' });
  const renamed = byName('Soon(tm)');
  assert.ok(renamed, 'the rename did not take');
  assert.equal(renamed.durationMs, target.durationMs);
});

test('a timer cannot be left without a name', () => {
  // An unnamed row cannot be told apart, and so cannot be chosen.
  const target = byName('Soon(tm)');
  engine.store.countdown('renamePreset', { id: target.id, name: '   ' });
  assert.equal((timers().presets || []).find((p) => p.id === target.id).name, 'Soon(tm)');
});

test('saved timers are capped', () => {
  for (let i = 0; i < 30; i += 1) engine.store.countdown('savePreset', 'Extra ' + i);
  assert.ok((timers().presets || []).length <= 12, String((timers().presets || []).length));
});

test('the editor stops offering the button before the server has to refuse', () => {
  // A refusal nobody asked for is a worse way to find out about a limit.
  const src = fs.readFileSync(new URL('../../web/components/SavedTimers.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('presets.length < max'), 'the editor offers to save past the cap');
  const server = fs.readFileSync(new URL('../engine/countdown.js', SCRIPT_URL), 'utf8');
  const capLine = server.split(String.fromCharCode(10)).find((l) => l.startsWith('const MAX_PRESETS'));
  const cap = capLine && capLine.replace(/[^0-9]/g, '');
  assert.ok(cap, 'the server no longer caps saved timers');
  assert.ok(src.includes('MAX_TIMERS = ' + cap), `the editor's cap does not match the server's ${cap}`);
});

test('every surface still reads the countdown the way it always did', () => {
  /*
    The live fields are the active timer, copied out. Had presets replaced them
    the overlay, the layer and the dock would all have needed to learn what a
    preset is, for no gain.
  */
  const s = timers();
  for (const field of ['mode', 'endsAt', 'remainingMs', 'durationMs', 'label', 'style', 'serverNow']) {
    assert.ok(field in s, `the countdown no longer reports ${field}`);
  }
});

