/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Logic steps — Wait, Stop here, Repeat, Pick one at
 * random and Later — and the editor that adds them anywhere in an action.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, chat, collection, engine, fs, said, settle, test } from './harness.js';

const later = await import('../../engine/later.js');
const { pickChoice } = await import('../../engine/steps.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const anyone = { anyone: true, vips: true, subscribers: true, moderators: true, broadcaster: true };
const command = (id, word) => engine.store.saveCommand({ id, name: word, triggers: [word], enabled: true, permissions: anyone, globalCooldown: 0, userCooldown: 0 });
const action = (id, commandId, actions) => engine.store.saveAction({
  id, name: id, enabled: true,
  trigger: { id: `t-${id}`, category: 'command', type: 'command_trigger', config: { commandId } },
  actions,
});
const say = (id, message) => ({ id, type: 'twitch_chat', config: { message } });
const saidSince = (from) => said.slice(from);

// ------------------------------------------------------------------ Wait

action('act-wait', 'cmd-none', [say('w1', 'before the wait'), { id: 'w2', type: 'wait', config: { seconds: 0.25 } }, say('w3', 'after the wait')]);
let from = said.length;
let began = Date.now();
await engine.testAction('act-wait');
const waited = Date.now() - began;
const waitSaid = saidSince(from);

test('a Wait holds the action, then the next step runs', () => {
  assert.deepEqual(waitSaid, ['before the wait', 'after the wait']);
  assert.ok(waited >= 230, `the wait took ${waited} ms, not a quarter of a second`);
});

/*
  The dock gives a button fifteen seconds before calling it a failure, so it
  is answered at the first wait, and the rest carries on regardless.
*/
action('act-dock-wait', 'cmd-none', [say('dw1', 'dock before'), { id: 'dw2', type: 'wait', config: { seconds: 0.4 } }, say('dw3', 'dock after')]);
from = said.length;
began = Date.now();
const dockAnswer = await engine.runDockAction('act-dock-wait');
const dockAnsweredIn = Date.now() - began;
const dockSaidAtAnswer = saidSince(from);
await sleep(500);
const dockSaidLater = saidSince(from);

test('the dock is answered when its action first waits, and the rest still runs', () => {
  assert.equal(dockAnswer?.ok, true);
  assert.ok(dockAnsweredIn < 300, `the dock waited ${dockAnsweredIn} ms for an answer`);
  assert.deepEqual(dockSaidAtAnswer, ['dock before']);
  assert.deepEqual(dockSaidLater, ['dock before', 'dock after']);
});

// ------------------------------------------------------------------ Stop here

command('cmd-modsonly', '!modsonly');
action('act-modsonly', 'cmd-modsonly', [
  {
    id: 'ms1', type: 'condition',
    config: { logic: { matchType: 'AND', conditions: [{ id: 'c', variable: 'user.isMod', operator: 'isFalse', value: '' }] } },
    thenActions: [say('ms2', 'mods only, {user}'), { id: 'ms3', type: 'stop', config: {} }],
    elseActions: [],
  },
  say('ms4', 'mod thing done'),
]);
from = said.length;
chat('!modsonly', { user: 'Pepa' });
await settle();
const viewerStop = saidSince(from);
from = said.length;
chat('!modsonly', { user: 'Moda', isMod: true });
await settle();
const modThrough = saidSince(from);

test('Stop here inside a condition ends the whole action', () => {
  assert.deepEqual(viewerStop, ['mods only, Pepa'], 'the step after the condition still ran');
  assert.deepEqual(modThrough, ['mod thing done']);
});

// A Stop in an action reached through Trigger Action ends that one, not the one that called it.
action('act-stops-itself', 'cmd-none', [say('si1', 'inner'), { id: 'si2', type: 'stop', config: {} }, say('si3', 'inner after stop')]);
action('act-calls-it', 'cmd-none', [{ id: 'ci1', type: 'trigger_action', config: { actionId: 'act-stops-itself' } }, say('ci2', 'outer carries on')]);
from = said.length;
await engine.testAction('act-calls-it');
const chained = saidSince(from);

test('a Stop in a triggered action stops only that action', () => {
  assert.deepEqual(chained, ['inner', 'outer carries on']);
});

// ------------------------------------------------------------------ Repeat

action('act-repeat', 'cmd-none', [{ id: 'r1', type: 'repeat', config: { times: 3, waitSeconds: 0 }, thenActions: [say('r2', 'go {repeat.count}/{repeat.times}')] }]);
from = said.length;
await engine.testAction('act-repeat');
const repeated = saidSince(from);

action('act-repeat-many', 'cmd-none', [{ id: 'rm1', type: 'repeat', config: { times: 999 }, thenActions: [say('rm2', 'x')] }]);
from = said.length;
await engine.testAction('act-repeat-many');
const capped = saidSince(from).length;

action('act-repeat-stop', 'cmd-none', [
  { id: 'rs1', type: 'repeat', config: { times: 5 }, thenActions: [say('rs2', 'lap {repeat.count}'), { id: 'rs3', type: 'condition', config: { logic: { conditions: [{ id: 'c', variable: 'repeat.count', operator: 'equals', value: '2' }] } }, thenActions: [{ id: 'rs4', type: 'stop', config: {} }], elseActions: [] }] },
  say('rs5', 'after the laps'),
]);
from = said.length;
await engine.testAction('act-repeat-stop');
const stoppedLaps = saidSince(from);

test('Repeat runs its steps that many times, and {repeat.count} says which', () => {
  assert.deepEqual(repeated, ['go 1/3', 'go 2/3', 'go 3/3']);
  assert.equal(capped, 50, 'a repeat asked for 999 was not held to 50');
});

test('Stop here inside a repeat ends the repeat and the action', () => {
  assert.deepEqual(stoppedLaps, ['lap 1', 'lap 2']);
});

// ------------------------------------------------------------------ Pick one at random

const choice = (id, weight, steps) => ({ id, type: 'random_choice', config: { weight }, thenActions: steps });
action('act-pick', 'cmd-none', [{ id: 'p1', type: 'random_pick', config: {}, thenActions: [choice('pc0', 0, [say('p0', 'never')]), choice('pc1', 1, [say('p2', 'always')])] }]);
from = said.length;
for (let i = 0; i < 5; i++) await engine.testAction('act-pick');
const picked = saidSince(from);

test('Pick one at random runs one choice, and a choice weighing 0 never', () => {
  assert.deepEqual(picked, ['always', 'always', 'always', 'always', 'always']);
});

test('a choice comes up as often as its weight says', () => {
  const choices = [choice('a', 1, []), choice('b', 3, [])];
  assert.equal(pickChoice(choices, 0)?.id, 'a');
  assert.equal(pickChoice(choices, 0.24)?.id, 'a');
  assert.equal(pickChoice(choices, 0.26)?.id, 'b');
  assert.equal(pickChoice(choices, 0.999)?.id, 'b');
  assert.equal(pickChoice([choice('z', 0, [])], 0.5), null, 'a pick with nothing to pick picked something');
  // An empty weight is 0, the same on the server as the editor shows it.
  assert.equal(pickChoice([choice('e', '', []), choice('f', 1, [])], 0)?.id, 'f');
});

// ------------------------------------------------------------------ Later

/*
  The !bar case: the words go up now, and five hours later the bar is itself
  again. Using it again in between starts the five hours over.
*/
command('cmd-barx', '!barx');
action('act-barx', 'cmd-barx', [
  say('bx1', 'bar: {input}'),
  { id: 'bx2', type: 'later', config: { mode: 'after', amount: 5, unit: 'hours' }, thenActions: [say('bx3', 'bar back, was {input} from {user}')] },
  say('bx4', 'bar set'),
]);
const HOURS_5 = 5 * 3_600_000;
from = said.length;
chat('!barx Happy hour', { user: 'Ana' });
await settle();
const firstRun = saidSince(from);
const firstWaiting = later.list();
// Read from the file itself: written at once, since a hard kill gives no chance to write on the way out.
const onDisk = JSON.parse(fs.readFileSync(`${process.env.DATA_DIR}/later_steps.json`, 'utf8'));
await sleep(20);
chat('!barx Two for one', { user: 'Beto' });
await settle();
const secondWaiting = later.list();
from = said.length;
const tooEarly = later.fireDue(secondWaiting[0].dueAt - 60_000);
await settle();
const saidTooEarly = saidSince(from);

test('a Later step lets the action finish now, and waits on the list', () => {
  assert.deepEqual(firstRun, ['bar: Happy hour', 'bar set'], 'the action waited, or the later steps ran at once');
  assert.equal(firstWaiting.length, 1);
  const [w] = firstWaiting;
  assert.equal(w.actionId, 'act-barx');
  assert.equal(w.actionName, 'act-barx');
  assert.equal(w.mode, 'after');
  assert.equal(w.user, 'Ana');
  assert.equal(w.input, 'Happy hour');
  assert.ok(Math.abs(w.dueAt - (w.setAt + HOURS_5)) < 5, 'not five hours from when it was set');
  assert.ok(onDisk['act-barx:bx2'], 'the waiting step was not written down, so a restart would lose it');
});

test('running the same Later step again starts its wait over', () => {
  assert.equal(secondWaiting.length, 1, 'two waits for one step: the first would clear the second message early');
  assert.equal(secondWaiting[0].input, 'Two for one');
  assert.ok(secondWaiting[0].dueAt > firstWaiting[0].dueAt, 'the wait did not start over');
  assert.deepEqual(tooEarly, []);
  assert.deepEqual(saidTooEarly, []);
});

// Fixed in the meantime: what runs is the step as the action holds it now.
action('act-barx', 'cmd-barx', [
  say('bx1', 'bar: {input}'),
  { id: 'bx2', type: 'later', config: { mode: 'after', amount: 5, unit: 'hours' }, thenActions: [say('bx3', 'bar is back (was {input}, from {user})')] },
  say('bx4', 'bar set'),
]);
from = said.length;
const fired = later.fireDue(secondWaiting[0].dueAt + 1000);
await settle();
const saidWhenDue = saidSince(from);

test('when its time comes it runs, as the action holds it now, with who and what from when it was set', () => {
  assert.deepEqual(fired, ['act-barx:bx2']);
  assert.deepEqual(saidWhenDue, ['bar is back (was Two for one, from Beto)']);
  assert.equal(later.list().length, 0, 'it ran and still waits');
  assert.equal(Object.keys(collection('later_steps', {}).get()).length, 0, 'it ran and is still written down');
});

// A Later step deleted while it waits runs nothing.
chat('!barx Gone soon', { user: 'Ana' });
await settle();
action('act-barx', 'cmd-barx', [say('bx1', 'bar: {input}')]);
from = said.length;
later.fireDue(Date.now() + HOURS_5 + 1000);
await settle();

test('a Later step deleted while it waited runs nothing', () => {
  assert.deepEqual(saidSince(from), []);
  assert.equal(later.list().length, 0);
});

// When the stream ends: the moment the stream history calls the end.
action('act-goodnight', 'cmd-none', [{ id: 'gn1', type: 'later', config: { mode: 'streamEnd' }, thenActions: [say('gn2', 'see you next stream')] }]);
await engine.testAction('act-goodnight');
const waitingForEnd = later.list();
from = said.length;
later.fireDue(Date.now() + 30 * 86_400_000);
await settle();
const saidBeforeEnd = saidSince(from);
// The end itself, as the stream history announces it (stream-sessions.js); the other listeners are left out of it.
later.onStreamEnded();
await settle();
const saidAtEnd = saidSince(from);

test('a Later step set for the end of the stream runs then, and not on a clock', () => {
  assert.equal(waitingForEnd.length, 1);
  assert.equal(waitingForEnd[0].mode, 'streamEnd');
  assert.equal(waitingForEnd[0].dueAt, null);
  assert.deepEqual(saidBeforeEnd, [], 'it ran before the stream ended');
  assert.deepEqual(saidAtEnd, ['see you next stream']);
  assert.ok(read('../engine/later.js').includes("bus.on('stream:ended', onStreamEnded)"), 'nothing runs them when the stream ends');
  assert.ok(read('../engine/stream-sessions.js').includes("bus.emit('stream:ended', record)"));
});

// The Waiting list's buttons.
action('act-later-buttons', 'cmd-none', [
  { id: 'lb1', type: 'later', config: { amount: 1, unit: 'days' }, thenActions: [say('lb2', 'ran from the list')] },
  { id: 'lb3', type: 'later', config: { amount: 2, unit: 'days' }, thenActions: [say('lb4', 'never')] },
]);
await engine.testAction('act-later-buttons');
const twoWaiting = later.list().map((e) => e.key);
from = said.length;
await engine.laterControl('run', 'act-later-buttons:lb1');
await settle();
const ranNow = saidSince(from);
await engine.laterControl('cancel', 'act-later-buttons:lb3');
let goneCode = '';
try { await engine.laterControl('run', 'act-later-buttons:lb3'); } catch (err) { goneCode = err.code; }
later.fireDue(Date.now() + 10 * 86_400_000);
await settle();

test('the Waiting list can run a step now or cancel it', () => {
  assert.deepEqual(twoWaiting, ['act-later-buttons:lb1', 'act-later-buttons:lb3'], 'not soonest first');
  assert.deepEqual(ranNow, ['ran from the list']);
  assert.deepEqual(saidSince(from), ['ran from the list'], 'a cancelled step ran anyway');
  assert.equal(later.list().length, 0);
  assert.equal(goneCode, 'later_gone');
});

test('a Later step is held to between a second and a week', () => {
  assert.equal(later.cleanLater({ amount: 30, unit: 'days' }).ms, later.MAX_MS);
  assert.equal(later.cleanLater({ amount: 0.1, unit: 'seconds' }).ms, later.MIN_MS);
  assert.equal(later.cleanLater({ amount: 5, unit: 'hours' }).ms, HOURS_5);
  assert.deepEqual(later.cleanLater({}), { mode: 'after', unit: 'minutes', amount: 5, ms: 5 * 60_000 });
  assert.equal(later.cleanLater({ mode: 'streamEnd' }).mode, 'streamEnd');
});

test('waiting steps are in the snapshot, every change to the list is sent, and a backup leaves them behind', () => {
  assert.ok(/EXCLUDED = \[[^\]]*'later_steps'/.test(read('../engine/backup.js')), 'a backup put back later would run them out of time');
  assert.ok(Array.isArray(engine.snapshot().laterSteps));
  const src = read('../engine/later.js');
  assert.ok(src.includes("bus.emit(EVENTS.CONFIG, { key: 'laterSteps', value: list() })"));
  // A hard kill gives no chance to write on the way out.
  assert.ok(src.slice(src.indexOf('function save('), src.indexOf('export function schedule')).includes('store.flush()'), 'the list is not written straight away');
  // Overdue steps wait for the platforms to connect after a start.
  assert.ok(src.includes('holdUntil = deps.now() + (deps.bootGraceMs ?? BOOT_GRACE_MS)'));
});

// ------------------------------------------------------------------ the editor

test('the Logic menu offers the new steps, and each starts as its editor shows it', () => {
  const view = read('../../web/components/views/ActionsView.tsx');
  for (const type of ['wait', 'stop', 'repeat', 'random_pick', 'later']) {
    assert.ok(view.includes(`onClick: () => addStep('${type}')`), `the Logic menu has no ${type}`);
  }
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("wait: { seconds: 5 }") && app.includes("repeat: { times: 3, waitSeconds: 1 }") && app.includes("later: { mode: 'after', amount: 5, unit: 'minutes' }"), 'a new step starts without what its editor shows');
  assert.ok(app.includes("if (type === 'random_pick') {") && app.includes("[1, 2].map(() => ({ id: stepId(), type: 'random_choice'"), 'a random pick starts with nothing to pick from');
});

/*
  Every menu adds where the editor points it: the action's own steps, or a
  list inside a step that asked with "Add steps here" — so anything can go
  inside a Later or a choice, not only what a condition's three quick
  buttons offered.
*/
test('the step menus add into the list that asked, and fall back to the action itself', () => {
  const view = read('../../web/components/views/ActionsView.tsx');
  assert.ok(!view.includes('onClick: () => addActionStep('), 'a menu entry still adds to the top whatever is picked');
  assert.ok(view.includes('if (addInto && holdsStep(currentAction.actions, addInto.parentId)) addActionStep(type, addInto.parentId, addInto.branch);'), 'a deleted target would swallow the step');
  assert.ok(view.includes('useEffect(() => { setAddInto(null); }, [currentAction?.id, isActionModalOpen]);'), 'another action opens still adding into the last one');
  assert.ok(view.includes('onAddInto(here ? null : { parentId: step.id, branch })'));
  // A pick's own list holds only choices, so it has the choice button and not the general one.
  assert.ok(view.includes("innerList(step.thenActions, thenOrder, 'then', { choiceTotal: total }, false)"));
});

test('the new steps\' words are in both languages', () => {
  const constants = read('../../web/constants.ts');
  const both = (key) => constants.split(`    ${key}: '`).length - 1 === 2;
  for (const key of ['stepWait', 'stepWaitSeconds', 'stepWaitHint', 'stepStop', 'stepStopHint', 'stepRepeat', 'stepRepeatTimes', 'stepRepeatGap', 'stepRepeatHint',
    'stepLater', 'stepLaterAfter', 'stepLaterStreamEnd', 'stepLaterAmount', 'stepLaterUnit', 'stepLaterHint', 'stepLaterStreamEndHint', 'unitSeconds', 'unitMinutes', 'unitHours', 'unitDays',
    'stepRandom', 'stepRandomHint', 'stepRandomAdd', 'stepRandomChoice', 'stepRandomWeight', 'stepRandomChance', 'addStepsHere', 'addingHere', 'addingIntoInner', 'addingBackToTop',
    'laterWaitingTitle', 'laterNoAction', 'laterWhenStreamEnds', 'laterIn', 'laterBy', 'laterRunNow', 'laterCancel']) {
    assert.ok(both(key), `${key} is not in both languages`);
  }
  const picker = read('../../web/components/VariablePicker.tsx');
  assert.ok(picker.includes("token: 'repeat.count'") && picker.includes("token: 'repeat.times'"), '{repeat.count} is not in the variables list');
});
