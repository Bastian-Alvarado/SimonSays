/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The countdown from actions and the deck, and a "Countdown
 * finished" trigger for one saved timer.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, chat, collection, engine, fs, said, settle, test } from './harness.js';
import { mod, runCommand } from './chat-steps.js';

const { parseAmount, formatLeft } = await import('../../engine/countdown.js');
const cd = (op, value) => engine.store.countdown(op, value);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('an amount reads the way people say it: m:ss, 30s, a plain number of minutes, a minus to take off', () => {
  assert.equal(parseAmount('1:30'), 90000);
  assert.equal(parseAmount('1:02:03'), 3723000);
  assert.equal(parseAmount('30s'), 30000);
  assert.equal(parseAmount('30seg'), 30000);
  assert.equal(parseAmount('2'), 120000);
  assert.equal(parseAmount('+2m'), 120000);
  assert.equal(parseAmount('-1:00'), -60000);
  assert.equal(parseAmount(' - 45 s '), -45000);
  for (const bad of ['', 'nada', '1:75', '1::2', 'm']) assert.equal(parseAmount(bad), null, `"${bad}" was read as time`);
  assert.equal(formatLeft(298000), '4:58');
  assert.equal(formatLeft(3723000), '1:02:03');
  assert.equal(formatLeft(0), '0:00');
});

/*
  Three saved timers to work with. The countdown holds twelve at most and the
  earlier files leave some behind, so it starts from none here and gets back
  exactly what it had at the end.
*/
const stored = collection('countdown');
const kept = structuredClone(stored.get());
stored.set({ ...kept, presets: [], activeId: '' });
const save = (name, ms) => { cd('setDuration', ms); cd('setLabel', name); return cd('savePreset', name).activeId; };
const longId = save('Prueba larga', 300000);
const aId = save('Prueba A', 120);
const bId = save('Prueba B', 120);
cd('reset');
test('the three saved timers these tests use were made', () => {
  assert.equal(new Set([longId, aId, bId]).size, 3, 'saving a timer did nothing');
});

// Started by name from chat, with the time said after it.
runCommand('cdlargo', [
  { type: 'countdown_control', config: { countdownOp: 'start', timer: longId } },
  { type: 'twitch_chat', config: { message: 'Volvemos en {countdown.time} ({countdown.label})' } },
]);
runCommand('cdmas', [
  { type: 'countdown_control', config: { countdownOp: 'add', value: '{input}' } },
  { type: 'twitch_chat', config: { message: 'Ahora {countdown.time}' } },
]);
for (const op of ['pause', 'resume', 'toggle', 'reset']) runCommand(`cd${op}`, [{ type: 'countdown_control', config: { countdownOp: op } }]);

said.length = 0;
chat('!cdlargo', mod);
await settle();
const started = cd('add', 0);
const saidStart = [...said];
chat('!cdmas 2', mod);
await settle();
const added = cd('add', 0);
const saidAdd = [...said];
chat('!cdmas nada', mod);
await settle();
const ignored = cd('add', 0);
test('a Countdown step starts the saved timer it names from the top, and a chat step after it can say what is left', () => {
  assert.equal(started.activeId, longId);
  assert.equal(started.mode, 'running');
  assert.equal(started.label, 'Prueba larga');
  assert.ok(Math.abs((started.endsAt - started.serverNow) - 300000) < 500, `${started.endsAt - started.serverNow}ms left`);
  assert.ok(saidStart.some((l) => /Volvemos en 5:00 \(Prueba larga\)/.test(l)), JSON.stringify(saidStart));
});
test('and "add" takes what was typed after the command, and nothing it cannot read', () => {
  assert.ok(Math.abs((added.endsAt - started.endsAt) - 120000) < 50, `moved ${added.endsAt - started.endsAt}ms`);
  assert.ok(saidAdd.some((l) => /Ahora 7:00/.test(l)), JSON.stringify(saidAdd));
  assert.equal(ignored.endsAt, added.endsAt, '"nada" changed the countdown');
});

const modes = [];
for (const op of ['pause', 'resume', 'toggle', 'toggle', 'reset']) { chat(`!cd${op}`, mod); await settle(); modes.push(cd('add', 0).mode); }
chat('!cdresume', mod);
await settle();
test('pause, carry on, start-or-pause and reset do what they say, and carrying on only carries on a pause', () => {
  assert.deepEqual(modes, ['paused', 'running', 'paused', 'running', 'idle']);
  assert.equal(cd('add', 0).mode, 'idle', 'carrying on started an idle countdown');
  assert.equal(cd('add', 0).remainingMs, 300000, 'reset did not go back to the full time');
});

// The deck: a minute at a time, and a press that changes nothing says so.
const deck = [];
for (let i = 0; i < 5; i += 1) { await engine.runDockBuiltin('countdown_less'); deck.push(cd('add', 0).remainingMs); }
let refused = null;
try { await engine.runDockBuiltin('countdown_less'); } catch (err) { refused = err.message; }
await engine.runDockBuiltin('countdown_more');
const afterMore = cd('add', 0).remainingMs;
await engine.runDockBuiltin('countdown_reset');
await engine.runDockBuiltin('countdown_toggle');
const toggled = cd('add', 0).mode;
await engine.runDockBuiltin('countdown_toggle');
const toggledBack = cd('add', 0).mode;
await engine.runDockBuiltin('countdown_reset');
test('the deck takes a minute off at a time, refuses to go below nothing, and starts and pauses on one button', () => {
  assert.deepEqual(deck, [240000, 180000, 120000, 60000, 0]);
  assert.equal(refused, 'the countdown did not change');
  assert.equal(afterMore, 60000);
  assert.deepEqual([toggled, toggledBack], ['running', 'paused']);
});

// A "Countdown finished" action for one saved timer, one for the other, one for any.
const onFinish = (id, timerId, message) => engine.store.saveAction({
  id, name: id, enabled: true,
  trigger: { id: `t-${id}`, category: 'system', type: 'countdown_finished', config: timerId ? { timerId } : {} },
  actions: [{ id: `s-${id}`, type: 'twitch_chat', config: { message } }],
});
onFinish('act-cd-a', aId, 'A terminó');
onFinish('act-cd-b', bId, 'B terminó');
onFinish('act-cd-any', '', 'Terminó {event.name}');
runCommand('cda', [{ type: 'countdown_control', config: { countdownOp: 'start', timer: aId } }]);
said.length = 0;
chat('!cda', mod);
await wait(450);
const saidOnFinish = [...said];
test('a Countdown finished trigger can be for one saved timer: A reaching zero runs A\'s action and not B\'s', () => {
  assert.ok(saidOnFinish.includes('A terminó'), JSON.stringify(saidOnFinish));
  assert.ok(!saidOnFinish.includes('B terminó'), 'B\'s action ran for A');
  assert.ok(saidOnFinish.includes('Terminó Prueba A'), 'an action for any timer did not run, or did not know which');
});

// The Countdown page, as the audit found it: what is on screen is what starts.
cd('setDuration', 600000);
cd('reset');
cd('add', 30000);
const shownBeforeStart = cd('add', 0).remainingMs;
const startedAt = cd('start');
const ranWith = startedAt.endsAt - startedAt.serverNow;
cd('reset');
cd('start', 60);
await wait(250);
const finishedMode = cd('add', 0).mode;
const afterNewLength = cd('setDuration', 180000);
cd('start', 60);
await wait(250);
const givenMore = cd('add', 60000);
cd('reset');
test('time added before starting is the time it starts with, and zero added is nothing at all', () => {
  assert.equal(shownBeforeStart, 630000);
  assert.ok(Math.abs(ranWith - 630000) < 300, `showed 10:30, ran ${ranWith}ms`);
  assert.equal(finishedMode, 'finished', 'reading the clock with add 0 changed it');
});
test('after it finishes, a new length or more time makes it ready again rather than a finished clock with a number on it', () => {
  assert.deepEqual([afterNewLength.mode, afterNewLength.remainingMs], ['idle', 180000]);
  assert.deepEqual([givenMore.mode, givenMore.remainingMs], ['idle', 60000]);
});
test('the page rounds the clock up, sends minutes and the label when they are done, and asks before deleting a saved timer', () => {
  const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
  assert.ok(read('../../web/components/Countdown.tsx').includes('Math.ceil(ms / 1000)'), 'the clock shows 0:00 while there is time left');
  const view = read('../../web/components/views/CountdownView.tsx');
  assert.ok(view.includes('onBlur={commitMinutes}') && !view.includes("onChange={(e) => control('setDuration'"), 'the minutes are sent on every keystroke');
  assert.ok(/if \(e\.key === 'Enter'\) \(e\.target as HTMLInputElement\)\.blur\(\)/.test(view), 'Enter does not send what was typed');
  assert.ok(read('../../web/components/SavedTimers.tsx').includes('window.confirm(fill(t.timerDeleteConfirm'), 'a saved timer is deleted without asking');
});

// Put everything back as it was.
for (const id of ['act-cd-a', 'act-cd-b', 'act-cd-any']) engine.store.deleteAction(id);
cd('reset');
stored.set(kept);
