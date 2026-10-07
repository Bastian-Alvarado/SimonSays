/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The run timer and the countdown.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, SCRIPT_URL, assert, bus, chat, engine, fs, said, settle, test } from './harness.js';
import { mod, runCommand } from './chat-steps.js';

// ----------------------------------------------------------- the run timer

const stopwatchMod = await import('../../engine/stopwatch.js');
const timerEvents = [];
bus.on(EVENTS.EVENT, (e) => { if (String(e.type).startsWith('timer_')) timerEvents.push(e.type); });
const sw = (op, v) => engine.store.stopwatch(op, v);
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

sw('reset');
let t0 = sw('start');
await nap(150);
const runningAt = stopwatchMod.elapsedNow();
test('the timer counts up from when it started, not from a ticking number', () => {
  assert.equal(t0.mode, 'running');
  assert.ok(t0.startedAt > 0 && t0.serverNow > 0, 'no start time or server clock to measure against');
  assert.ok(runningAt >= 140 && runningAt < 1000, `it read ${runningAt}ms after 150ms`);
});

sw('pause');
const pausedAt = stopwatchMod.elapsedNow();
await nap(120);
const stillPaused = stopwatchMod.elapsedNow();
sw('start');
await nap(60);
const resumedAt = stopwatchMod.elapsedNow();
test('pausing holds the time, and starting again carries on from it', () => {
  assert.equal(stillPaused, pausedAt, 'the time moved while paused');
  assert.ok(resumedAt >= pausedAt + 50 && resumedAt < pausedAt + 400, `resumed at ${resumedAt} from ${pausedAt}`);
});

const fin = sw('finish');
const finishedAt = fin.elapsedMs;
await nap(120);
const frozen = stopwatchMod.elapsedNow();
sw('undoFinish');
const undone = stopwatchMod.elapsedNow();
test('finishing freezes the time, and undoing it carries on as if it never stopped', () => {
  assert.equal(fin.mode, 'finished');
  assert.equal(frozen, finishedAt, 'a finished time kept moving');
  assert.ok(undone >= finishedAt + 110, `undo came back at ${undone}, not ${finishedAt} plus the time since`);
  assert.ok(timerEvents.includes('timer_started') && timerEvents.includes('timer_finished'),
    `an action could not answer the start or the finish: ${JSON.stringify(timerEvents)}`);
});

sw('pause');
const pauseThenFinish = sw('finish').elapsedMs;
sw('undoFinish');
const fromPausedUndo = stopwatchMod.elapsedNow();
test('a run finished while paused comes back from the time it had', () => {
  assert.ok(fromPausedUndo >= pauseThenFinish && fromPausedUndo < pauseThenFinish + 100, `${fromPausedUndo} vs ${pauseThenFinish}`);
});

sw('set', 3723400);
const setRunning = stopwatchMod.elapsedNow();
sw('add', -5000000);
const floored = stopwatchMod.elapsedNow();
sw('set', 'not a time');
const afterNonsense = stopwatchMod.elapsedNow();
test('the time can be put right, never below zero, and nonsense changes nothing', () => {
  assert.ok(setRunning >= 3723400 && setRunning < 3723400 + 200, `set read ${setRunning}`);
  assert.ok(floored < 200, `a large subtraction left ${floored}ms instead of zero`);
  assert.ok(afterNonsense >= floored && afterNonsense < floored + 200, 'a time that is not a time moved the clock');
});

// A restart mid-run: the state is a start time, so it simply carries on.
sw('set', 60000);
stopwatchMod.initStopwatch();
test('a running timer survives the server restarting', () => {
  const s = stopwatchMod.getState();
  assert.equal(s.mode, 'running');
  assert.ok(stopwatchMod.elapsedNow() >= 60000, 'the time was lost');
});

sw('reset');
let deckRefused = null;
try { await engine.runDockBuiltin('timer_finish'); } catch (err) { deckRefused = err.message; }
await engine.runDockBuiltin('timer_toggle');
const deckStarted = sw('noop').mode;
test('the deck’s timer buttons run it, and one that changes nothing says so', () => {
  assert.equal(deckRefused, 'the timer is not running');
  assert.equal(deckStarted, 'running');
});

runCommand('done', [
  { type: 'timer_control', config: { timerOp: 'finish' } },
  { type: 'twitch_chat', config: { message: 'GG! Finished in {timer.time}' } },
]);
sw('set', 3723456);
said.length = 0;
chat('!done', mod);
await settle();
test('a command can finish the run, and chat is told the time', () => {
  assert.equal(stopwatchMod.getState().mode, 'finished');
  assert.ok(said.some((l) => /GG! Finished in 1:02:03\.[45]/.test(l)), `chat said ${JSON.stringify(said)}`);
});
sw('reset');

const presetsForClock = await import('../../../shared/css-presets.js');

test('a layer resizes from any corner, and stretches one way from any side', () => {
  const editor = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const grips = editor.slice(editor.indexOf('const GRIPS'), editor.indexOf('/** How close an edge'));
  for (const [grip, cursor] of [['nw', 'nwse'], ['ne', 'nesw'], ['sw', 'nesw'], ['se', 'nwse'], ['n', 'ns'], ['s', 'ns'], ['w', 'ew'], ['e', 'ew']]) {
    assert.ok(grips.includes(`grip: '${grip}', cursor: '${cursor}-resize'`), `there is no ${grip} handle, or it shows the wrong cursor`);
  }
  const drag = editor.slice(editor.indexOf('const startDrag'), editor.indexOf('/** Arrow keys'));
  // Pulling the top or left edge moves the layer, so the far edge stays put.
  assert.ok(drag.includes('width = right0 - x;') && drag.includes('height = bottom0 - y;'),
    'pulling the top or left edge moves the far edge too');
  // And a side cannot be pulled past the other one.
  assert.ok(drag.includes('Math.min(right0 - MIN,') && drag.includes('Math.min(bottom0 - MIN,'),
    'a layer can be turned inside out by pulling one side past the other');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  assert.ok(!strings.includes("'Drag to move, corner to resize,"), 'the hint still says only the corner resizes');
});

const { normaliseLayouts: normForCountdown } = await import('../../engine/layouts.js');
test('a countdown layer can show one saved timer, and falls back when it is gone', () => {
  const clock = fs.readFileSync(new URL('../../web/components/Countdown.tsx', SCRIPT_URL), 'utf8');
  const fn = clock.slice(clock.indexOf('export function countdownFor('), clock.indexOf('/** mm:ss'));
  // Live while it is the one loaded; its own full time otherwise; the clock as it is without one.
  assert.ok(fn.includes('state.activeId === timerId) return state'), 'a layer naming the loaded timer does not show it live');
  assert.ok(fn.includes("mode: 'idle'") && fn.includes('remainingMs: preset.durationMs') && fn.includes('label: preset.label'),
    'a layer naming a timer that is not loaded does not show it waiting at its full time');
  assert.ok(fn.includes('if (!preset) return state;'), 'a layer naming a deleted timer shows nothing');
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes('countdownFor(system.data.countdown, layer.config?.timer)'), 'a countdown layer ignores the timer it names');
  assert.ok(app.includes("countdownFor(system.data.countdown, searchParams.get('timer'))"), 'the standalone countdown ignores ?timer=');
  // The layer keeps the choice through a save.
  const [kept] = normForCountdown([{ id: 'cd', layers: [{ type: 'countdown', config: { timer: 'preset-abc' } }] }]);
  assert.equal(kept.layers[0].config.timer, 'preset-abc', 'saving the layout dropped which timer the layer shows');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['layerCountdownWhich', 'layerCountdownLoaded', 'layerCountdownHint', 'layerCountdownGone']) {
    assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
  }
});

test('the timer is a layer, a screen, a source and a step, in both languages', () => {
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  const clock = fs.readFileSync(new URL('../../web/components/Stopwatch.tsx', SCRIPT_URL), 'utf8');
  const backend = fs.readFileSync(new URL('../../web/hooks/useBackend.ts', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes("case 'stopwatch':"), 'the canvas cannot draw the timer');
  assert.ok(app.includes("if (mode === 'timer')") && app.includes("view === 'timer'"), 'there is no timer screen or source');
  assert.ok(clock.includes('state.serverNow - state.clientReceivedAt'), 'the clock does not correct for this device being off');
  assert.ok(backend.includes('p.stopwatch?.serverNow'), 'nothing records when a timer update arrived, so skew cannot be measured');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  const files = ['views/TimerView.tsx', 'views/ActionsView.tsx', 'views/DockActionsView.tsx']
    .map((f) => fs.readFileSync(new URL(`../../web/components/${f}`, SCRIPT_URL), 'utf8')).join('') + app;
  const wanted = [...new Set([...files.matchAll(/t[.]((?:timer|dockCategoryTimer)[A-Za-z]*)/g)].map((m) => m[1]))];
  assert.ok(wanted.length >= 25, `only ${wanted.length} timer strings found`);
  for (const key of wanted) assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
});

// ----------------------------------------------------------- the countdown

const finished = [];
bus.on(EVENTS.EVENT, (e) => { if (e.type === 'countdown_finished') finished.push(e); });

engine.store.countdown('setDuration', 60000);
let cd = engine.store.countdown('start');
test('starting sets an end time rather than a ticking number', () => {
  assert.equal(cd.mode, 'running');
  assert.ok(cd.endsAt > cd.serverNow, 'endsAt should be in the future');
  assert.ok(Math.abs((cd.endsAt - cd.serverNow) - 60000) < 200, `got ${cd.endsAt - cd.serverNow}ms`);
});

test('every payload carries the server clock, so a surface can correct for skew', () => {
  assert.ok(typeof cd.serverNow === 'number' && cd.serverNow > 0);
});

await new Promise((r) => setTimeout(r, 300));
cd = engine.store.countdown('pause');
const heldAt = cd.remainingMs;
test('pausing freezes what is left', () => {
  assert.equal(cd.mode, 'paused');
  assert.equal(cd.endsAt, null);
  assert.ok(heldAt < 60000 && heldAt > 59000, `held ${heldAt}ms`);
});

await new Promise((r) => setTimeout(r, 300));
test('a paused countdown does not keep counting', () => {
  assert.equal(engine.store.countdown('add', 0).remainingMs, heldAt);
});

cd = engine.store.countdown('start');
test('starting from paused continues rather than restarting', () => {
  assert.ok(Math.abs((cd.endsAt - cd.serverNow) - heldAt) < 200, `resumed with ${cd.endsAt - cd.serverNow}ms, expected about ${heldAt}`);
});

cd = engine.store.countdown('add', 30000);
test('time can be added while it runs', () => {
  assert.ok((cd.endsAt - cd.serverNow) > heldAt + 29000, 'the extra time did not land');
});

cd = engine.store.countdown('reset');
test('reset goes back to the configured duration', () => {
  assert.equal(cd.mode, 'idle');
  assert.equal(cd.remainingMs, 60000);
});

test('an invalid operation is refused rather than ignored', () => {
  assert.throws(() => engine.store.countdown('explode'), /unknown operation/i);
});

// Reaching zero is the moment worth reacting to.
engine.store.countdown('setDuration', 150);
engine.store.countdown('start');
await new Promise((r) => setTimeout(r, 500));
test('reaching zero finishes and fires an event an action can use', () => {
  assert.equal(engine.store.countdown('add', 0).mode, 'finished');
  assert.equal(finished.length, 1, `got ${finished.length} countdown_finished events`);
});

