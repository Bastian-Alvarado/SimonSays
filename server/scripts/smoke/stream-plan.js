/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the stream plan's second half. What a step asks of the channel
 * when it starts, how long each step took and the recap, "!plan" in chat,
 * saved plans, {plan} in the go-live post, and the screen and the dock tab
 * that show it all.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, collection, EVENTS, engine, fs, normaliseChat, said, settle, test } from './harness.js';
import * as plan from '../../engine/plan.js';
import { fillPlan } from '../../engine/announce.js';
import { MANIFEST } from '../../engine/backup.js';
import { formatLength, liveLength } from '../../../shared/plan-format.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

// ------------------------------------------------------------------ times

{
  const t0 = 1000;
  const base = { currentId: '', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] };
  const started = plan.stampPlan(base, { ...base, currentId: 'a' }, t0);
  const movedOn = plan.stampPlan(started, { ...started, currentId: 'b', items: started.items.map((i) => ({ ...i, done: i.id === 'a' })) }, t0 + 60000);
  const wentBack = plan.stampPlan(movedOn, { ...movedOn, currentId: 'a', items: movedOn.items.map((i) => ({ ...i, done: false })) }, t0 + 120000);
  const reset = plan.stampPlan(wentBack, { ...wentBack, currentId: '', items: wentBack.items.map((i) => ({ ...i, done: false })) }, t0 + 180000);

  test('each step keeps when it started and finished, and forgets what has not happened yet', () => {
    assert.equal(started.items[0].startedAt, t0);
    assert.equal(started.items[1].startedAt, undefined, 'a step still to come has a start');
    assert.equal(movedOn.items[0].doneAt, t0 + 60000);
    assert.equal(movedOn.items[1].startedAt, t0 + 60000);
    // Back to one already done picks up where it began; the one left behind forgets.
    assert.equal(wentBack.items[0].startedAt, t0);
    assert.equal(wentBack.items[0].doneAt, undefined);
    assert.equal(wentBack.items[1].startedAt, undefined);
    assert.ok(reset.items.every((i) => !i.startedAt && !i.doneAt), 'starting over kept the times');
  });

  // The same moves, live: the time each step is on is counted, and kept as the mark moves.
  const liveStart = plan.stampPlan(base, { ...base, currentId: 'a' }, t0, true);
  const liveOn = plan.stampPlan(liveStart, { ...liveStart, currentId: 'b', items: liveStart.items.map((i) => ({ ...i, done: i.id === 'a' })) }, t0 + 60000, true);
  const liveBack = plan.stampPlan(liveOn, { ...liveOn, currentId: 'a', items: liveOn.items.map((i) => ({ ...i, done: false })) }, t0 + 90000, true);
  const offStart = plan.stampPlan(base, { ...base, currentId: 'a' }, t0, false);

  test('a step counts the time it is on only while live, and keeps it as the mark moves', () => {
    assert.deepEqual([liveStart.items[0].liveMs, liveStart.items[0].liveFrom], [0, t0]);
    assert.deepEqual([liveOn.items[0].liveMs, liveOn.items[0].liveFrom], [60000, undefined], 'the step left did not keep its time');
    assert.equal(liveOn.items[1].liveFrom, t0 + 60000);
    assert.deepEqual([liveBack.items[0].liveMs, liveBack.items[0].liveFrom], [60000, t0 + 90000], 'coming back to a step did not carry on from its time');
    assert.equal(liveBack.items[1].liveMs, undefined, 'a step gone back past kept its time');
    assert.deepEqual([offStart.items[0].liveMs, offStart.items[0].liveFrom], [0, undefined], 'a step started while not live is counting');
    assert.equal(liveLength(liveBack.items[0], t0 + 150000), 120000);
    assert.equal(liveLength({ startedAt: 5 }), null, 'a step from before live counting has a live length');
  });
}

// ------------------------------------------------------- what a step asks

const cleaned = plan.cleanPlan({
  items: [
    { id: 'x', text: 'Among Us', game: { id: '510218', name: 'Among Us' }, title: '  Noche   de impostores ', youtubeCategory: '20', startedAt: 5, doneAt: 6 },
    { id: 'y', text: 'Charla', game: { id: 'abc', name: '' }, youtubeCategory: '999' },
  ],
  recap: { at: 1, items: [] },
  answer: { trigger: 'no-bang', text: '' },
}, plan.DEFAULT_PLAN);

test('a step keeps what it asks of the channel, and nothing it cannot', () => {
  assert.deepEqual(cleaned.items[0].game, { id: '510218', name: 'Among Us' });
  assert.equal(cleaned.items[0].title, 'Noche de impostores');
  assert.equal(cleaned.items[0].youtubeCategory, '20');
  assert.equal(cleaned.items[0].startedAt, undefined, 'a screen wrote the times');
  assert.equal(cleaned.items[1].game, undefined);
  assert.equal(cleaned.items[1].youtubeCategory, undefined, 'a category YouTube does not have was kept');
  assert.equal(cleaned.recap, null, 'a screen wrote the recap');
  assert.equal(cleaned.answer.trigger, '!plan');
  assert.equal(cleaned.answer.text, plan.DEFAULT_ANSWER.text);
});

const calls = [];
const fakes = {
  twitch: {
    setCategory: async (id, name) => { calls.push(['category', id, name]); },
    setTitle: async (title) => { calls.push(['title', title]); },
  },
  youtube: {
    setTitle: async () => { throw new Error('YouTube: not connected'); },
    toggleCategory: async (id) => { calls.push(['youtube category', id]); },
  },
  marker: async (text) => { calls.push(['marker', text]); return { ok: false, error: 'the stream is not live' }; },
};
const did = await plan.stepStarted({ id: 's', text: 'Among Us', game: { id: '510218', name: 'Among Us' }, title: 'Impostores', youtubeCategory: '20' }, { markers: true }, fakes);
const didPlain = await plan.stepStarted({ id: 'p', text: 'Charla' }, { markers: false }, fakes);

test('a step that starts switches the channel to what it asks, each part on its own', () => {
  // YouTube not connected costs its title and nothing else; not live costs the marker.
  assert.deepEqual(did, ['category', 'title', 'YouTube category']);
  assert.deepEqual(calls, [['category', '510218', 'Among Us'], ['title', 'Impostores'], ['youtube category', '20'], ['marker', 'Among Us']]);
  assert.deepEqual(didPlain, [], 'a step that asks nothing did something, or a marker was made with markers off');
});

const moved = [];
const realDeps = plan.useDepsForTests({
  twitch: { setCategory: async (id, name) => { moved.push(name); } },
  marker: async () => ({ ok: false }),
});
engine.store.setPlan({ items: [{ id: 'm1', text: 'Among Us', game: { id: '510218', name: 'Among Us' } }, { id: 'm2', text: 'Charla' }], currentId: '' });
engine.store.planGoto('m1');
await settle();
const afterMove = [...moved];
const renamed = engine.store.setPlan({ ...plan.getPlan(), items: plan.getPlan().items.map((i) => (i.id === 'm1' ? { ...i, text: 'Among Us!' } : i)) });
await settle();
plan.useDepsForTests(realDeps);

test('only a change of step starts anything, not an edit to the step already on', () => {
  assert.deepEqual(afterMove, ['Among Us'], 'moving the mark did not switch the category');
  assert.deepEqual(moved, ['Among Us'], 'renaming the current step switched the category again');
  assert.ok(renamed.items[0].startedAt, 'the step moved to has no start');
});

// ------------------------------------------------------------------ !plan

plan.resetAnswerForTests();
engine.store.setPlan({ items: [{ id: 'q1', text: 'Among Us' }, { id: 'q2', text: 'Preguntas' }], currentId: '' });
engine.store.planGoto('q1');
const saidBefore = said.length;
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'fan', msg: '!plan' }));
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'fan2', msg: '!PLAN hoy?' }));
await settle();
const answered = said.slice(saidBefore);

plan.resetAnswerForTests();
const commandsStore = collection('commands', []);
const commandsBefore = commandsStore.get();
commandsStore.set([...(commandsBefore || []), { id: 'own-plan', enabled: true, triggers: ['!plan'] }]);
// One that runs: an action linked to it. A command left without one does not take the word (commands.ownCommandAnswers).
const ownActions = collection('actions', []);
const ownActionsBefore = ownActions.get();
ownActions.set([...(ownActionsBefore || []), { id: 'act-own-plan', name: 'Own', enabled: true, trigger: { type: 'command_trigger', category: 'command', config: { commandId: 'own-plan' } }, actions: [] }]);
const saidMid = said.length;
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'fan', msg: '!plan' }));
await settle();
const answeredOverOwn = said.slice(saidMid);
commandsStore.set(commandsBefore);
ownActions.set(ownActionsBefore);

test('"!plan" in chat is answered with what is on now and next, once, and never over a command of your own', () => {
  assert.deepEqual(answered, ['Ahora: Among Us · Después: Preguntas'], 'the chat asking twice at once was answered twice, or not at all');
  assert.deepEqual(answeredOverOwn, [], 'the built-in answered a word the streamer had given a command of their own');
});

test('the answer leaves out what names nothing, and says so when there is no plan or it is done', () => {
  const p = (items, currentId = '') => ({ ...plan.DEFAULT_PLAN, items, currentId });
  assert.equal(plan.answerFor(p([])), 'Todavía no hay un plan para hoy.');
  assert.equal(plan.answerFor(p([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }])), 'Después: A');
  assert.equal(plan.answerFor(p([{ id: 'a', text: 'A', done: true }, { id: 'b', text: 'B' }], 'b')), 'Ahora: B');
  assert.equal(plan.answerFor(p([{ id: 'a', text: 'A', done: true }])), '¡Ya terminamos todo lo del plan de hoy!');
});

// --------------------------------------------------------------- the recap

const recapped = plan.recapOf({
  items: [
    { text: 'A', startedAt: 0, doneAt: 25 * 60000, done: true },
    { text: 'Skipped', done: true },
    { text: 'B', startedAt: 25 * 60000 },
  ],
}, 105 * 60000);

engine.store.setPlan({ ...plan.getPlan(), recapToDiscord: true, items: [{ id: 'r1', text: 'Among Us' }], currentId: '' });
// Live, as OBS says: what is counted is what the recap is made of.
plan.resumeLive(Date.now());
engine.store.planGoto('r1');
const posts = [];
const postingDeps = { announceChannel: () => '123456789012', discord: { sendMessage: async (...args) => { posts.push(args); }, sanitise: (s) => s } };
const endRecap = await plan.streamEnded(postingDeps, Date.now() + 30 * 60000);
const keptRecap = plan.getPlan().recap;
engine.store.setPlan({ ...plan.getPlan(), recapToDiscord: false });
await plan.streamEnded(postingDeps);

// ------------------------------------------------ one step over two streams

const T = Date.now() + 24 * 3600_000;
engine.store.setPlan({ ...plan.getPlan(), recapToDiscord: false, items: [{ id: 'L1', text: 'Juego largo' }, { id: 'L2', text: 'Otro' }], currentId: '' });
engine.store.planGoto('L1');
const offline = plan.getPlan().items[0];
plan.resumeLive(T);
plan.pauseLive(T + 10 * 60000);
const afterFirst = plan.getPlan().items[0];
plan.resumeLive(T + 3 * 3600_000);
const secondRecap = plan.recapOf(plan.getPlan(), T + 3 * 3600_000 + 20 * 60000);
const runningTotal = liveLength(plan.getPlan().items[0], T + 3 * 3600_000 + 20 * 60000);
plan.pauseLive(T + 3 * 3600_000 + 20 * 60000);
// OBS back within a few minutes: the same stream, its recap carrying on.
plan.resumeLive(T + 3 * 3600_000 + 22 * 60000);
plan.pauseLive(T + 3 * 3600_000 + 32 * 60000);
const carriedRecap = plan.recapOf(plan.getPlan(), T + 3 * 3600_000 + 32 * 60000);
const keptTotal = plan.getPlan().items[0].liveMs;
engine.store.planGoto('L2');
const movedOnOffline = plan.getPlan().items;
// OBS connecting: not live says nothing; live, when nothing heard it start, counts from then.
bus.emit(EVENTS.STATUS, { platform: 'obs', status: 'connected', error: null, streamStatus: { active: false } });
const notLiveStatus = plan.getPlan().items[1].liveFrom;
bus.emit(EVENTS.STATUS, { platform: 'obs', status: 'connected', error: null, streamStatus: { active: true } });
const liveStatus = plan.getPlan().items[1].liveFrom;
plan.pauseLive();

test('a step\'s time is kept when the stream ends and carries on in the next one; each recap has what its stream added', () => {
  assert.deepEqual([offline.liveMs, offline.liveFrom], [0, undefined], 'time counted before going live');
  assert.deepEqual([afterFirst.liveMs, afterFirst.liveFrom], [10 * 60000, undefined], 'the time was not kept when the stream ended');
  assert.equal(runningTotal, 30 * 60000, 'the next stream did not carry on from the time kept');
  assert.deepEqual(secondRecap.items.map((i) => [i.text, i.ms]), [['Juego largo', 20 * 60000]], 'the recap counted the earlier stream too');
  assert.deepEqual(carriedRecap.items.map((i) => [i.text, i.ms]), [['Juego largo', 30 * 60000]], 'OBS coming back within minutes started a new recap');
  assert.equal(keptTotal, 40 * 60000);
  assert.deepEqual([movedOnOffline[0].liveMs, movedOnOffline[1].liveMs, movedOnOffline[1].liveFrom], [40 * 60000, 0, undefined], 'moving on while not live lost a time, or counted one');
  assert.equal(notLiveStatus, undefined, 'OBS saying it is not live started counting');
  assert.equal(typeof liveStatus, 'number', 'OBS found live on connecting did not start counting');
  const sessions = read('../engine/stream-sessions.js');
  assert.ok(sessions.includes("typeof i.liveBase === 'number'") && read('../engine/announce.js').includes("typeof i.liveBase === 'number'"), 'a step carried on from an earlier stream is left out of this one\'s chapters or recap');
});

test('the recap is each step that started and how long it lasted, kept and posted if asked', () => {
  assert.deepEqual(recapped.items.map((i) => [i.text, formatLength(i.ms)]), [['A', '25 min'], ['B', '1 h 20 min']]);
  assert.equal(formatLength(0), '1 min');
  assert.equal(formatLength(60 * 60000), '1 h');
  assert.equal(plan.recapPost(recapped), '**Resumen del directo**\n• A — 25 min\n• B — 1 h 20 min');
  assert.equal(plan.recapOf({ items: [{ text: 'A' }] }), null, 'a stream where nothing started has a recap');
  assert.ok(endRecap && keptRecap && keptRecap.items[0].text === 'Among Us', 'the recap is not kept for the screen');
  assert.equal(posts.length, 1, 'the recap was posted with posting off, or not with it on');
  assert.equal(posts[0][0], '123456789012');
  assert.ok(String(posts[0][1]).startsWith('**Resumen del directo**'));
  assert.deepEqual(posts[0][5], { allowed_mentions: { parse: [] } }, 'a step named "@everyone" could ping everybody');
});

// ------------------------------------------------------------ saved plans

engine.store.setPlan({ items: [{ id: 'n1', text: 'Among Us', game: { id: '510218', name: 'Among Us' } }, { id: 'n2', text: 'Preguntas' }], currentId: '' });
engine.store.planGoto('n2');
const savedOk = engine.store.planSaved({ op: 'save', name: 'Noche de Among Us' });
let noName = '';
try { engine.store.planSaved({ op: 'save', name: '  ' }); } catch (err) { noName = err.message; }
engine.store.setPlan({ items: [{ id: 'z', text: 'Otra cosa' }], currentId: '' });
const entry = plan.getSaved().find((s) => s.name === 'Noche de Among Us');
engine.store.planSaved({ op: 'load', id: entry.id });
const loaded = plan.getPlan();
engine.store.planSaved({ op: 'delete', id: entry.id });

test('a plan can be saved under a name, loaded back from the top, and forgotten', () => {
  assert.ok(savedOk.ok);
  assert.equal(noName, 'give the plan a name');
  assert.deepEqual(entry.items.map((i) => i.text), ['Among Us', 'Preguntas']);
  assert.ok(entry.items.every((i) => !('done' in i) && !('startedAt' in i)), 'tonight’s progress was saved with it');
  assert.deepEqual(entry.items[0].game, { id: '510218', name: 'Among Us' }, 'what a step asks was not saved');
  assert.deepEqual(loaded.items.map((i) => i.text), ['Among Us', 'Preguntas']);
  assert.equal(loaded.currentId, '');
  assert.ok(loaded.items.every((i) => !i.done), 'a loaded plan did not start from the top');
  assert.ok(!plan.getSaved().some((s) => s.id === entry.id), 'a forgotten plan is still saved');
  assert.ok(MANIFEST.some((e) => e.name === 'plan_saved'), 'saved plans are left out of a backup');
  assert.ok(read('../../shared/protocol.js').includes("PLAN_SAVED: 'plan_saved'") && read('../api/ws.js').includes('engine.store.planSaved(payload)'));
});

// ------------------------------------------------------- the go-live post

test('the go-live post can list what is left of the plan, and drops the line when there is none', () => {
  const p = { items: [{ text: 'A', done: true }, { text: 'Among Us' }, { text: 'Preguntas' }] };
  assert.equal(fillPlan('Hoy: {plan}', p), 'Hoy: Among Us → Preguntas');
  assert.equal(fillPlan('¡En vivo!\nHoy: {plan}', { items: [] }), '¡En vivo!');
  assert.equal(read('../../web/constants.ts').split('{plan} ').length - 1, 2, 'the Go live screen does not name {plan}, in both languages');
});

// ------------------------------------------------------------- the screen

test('the Stream plan screen speaks both languages, and its controls reach a phone', () => {
  const view = read('../../web/components/views/PlanView.tsx');
  const constants = read('../../web/constants.ts');
  const keys = [...new Set([...view.matchAll(/t\.(plan[A-Za-z]+)/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 30, `only ${keys.length} strings found`);
  for (const key of keys) assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  assert.ok(view.includes('const started = Boolean(plan?.currentId) || items.some((i) => i.done);'), 'a finished plan has no way back to the start');
  assert.ok(view.includes('[@media(hover:hover)]:opacity-0'), 'reordering and removing still hide behind a hover a phone does not have');
  assert.ok(view.includes('<DragGrip grip={stepOrder.grip(item.id)}'), 'the steps cannot be dragged');
  assert.ok(!view.includes('hidden [@media(hover:hover)]:flex shrink-0 cursor-grab'), 'the grip still hides from a finger');
  assert.ok(view.includes('data-plan-undo'), 'a removed step cannot be brought back');
});

test('the dock has a Plan tab that moves the plan the way the deck does', () => {
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("{ id: 'plan', label: t.dockTabPlan || 'Plan', icon: ListOrdered }"), 'there is no Plan tab');
  assert.ok(app.includes("{mode === 'dock' && panel === 'plan' && ("), 'the Plan tab shows nothing');
  const dock = read('../../web/components/DockPlan.tsx');
  assert.ok(dock.includes('await runDockAction({ builtin });'), 'the dock moves the plan some other way than the deck');
  const constants = read('../../web/constants.ts');
  for (const key of [...new Set([...dock.matchAll(/t\.((?:plan|dockTab)[A-Za-z]+)/g)].map((m) => m[1]))]) {
    assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
});

// ------------------------------------------------- a step's run card

const withCard = plan.cleanPlan({ items: [
  { id: 'k1', text: 'Mega Man 2', game: { id: '4455', name: 'Mega Man Legacy Collection' }, card: { title: 'Mega Man 2', platform: 'NES', year: '1988', category: 'Any%', estimate: '30:00' } },
  { id: 'k2', text: 'Otro', card: { year: "'96", platform: '' } },
  { id: 'k3', text: 'Nada', card: { title: '', platform: '  ' } },
] }, plan.DEFAULT_PLAN);

test('a step keeps the run card it asks for, held to the card’s own rules', () => {
  assert.deepEqual(withCard.items[0].card, { title: 'Mega Man 2', platform: 'NES', year: '1988', category: 'Any%', estimate: '30:00' });
  assert.equal(withCard.items[1].card, undefined, 'a card whose only detail is a year that is not one was kept');
  assert.equal(withCard.items[2].card, undefined, 'an empty card was kept');
  // The title falls back to the Twitch category; an empty detail clears.
  assert.deepEqual(plan.cardOf({ game: { name: 'Celeste' }, card: { estimate: '40:00' } }), { game: 'Celeste', platform: '', year: '', category: '', estimate: '40:00' });
  assert.deepEqual(plan.cardOf({ card: { platform: 'PC' } }), { platform: 'PC', year: '', category: '', estimate: '' }, 'a step naming no game took the title away');
});

let cardSet = null;
const cardDid = await plan.stepStarted(withCard.items[0], { markers: false }, { setCard: async (card) => { cardSet = card; } });

// A category the card has already moved on from, so Twitch's report below is a change.
engine.store.setRun({ game: 'ROBLOX', platform: '', year: '', category: '', estimate: '', twitchCategoryId: '1' });
engine.store.setPlan({ items: withCard.items, currentId: '' });
engine.store.planGoto('k1');
await settle();
const cardUp = { ...engine.snapshot().run };
bus.emit(EVENTS.CHANNEL, { categoryId: '4455', categoryName: 'Mega Man Legacy Collection' });
await settle();
const afterTwitch = { ...engine.snapshot().run };
bus.emit(EVENTS.CHANNEL, { categoryId: '509658', categoryName: 'Just Chatting' });
await settle();
const afterOther = { ...engine.snapshot().run };

test('a step that starts puts its card up, and Twitch catching up does not take it down', () => {
  assert.ok(cardDid.includes('run card'), 'the step did not put its card up');
  assert.deepEqual(cardSet, { game: 'Mega Man 2', platform: 'NES', year: '1988', category: 'Any%', estimate: '30:00' });
  const details = (r) => [r.game, r.platform, r.year, r.category, r.estimate];
  assert.deepEqual(details(cardUp), ['Mega Man 2', 'NES', '1988', 'Any%', '30:00']);
  // Twitch says the category changed, a moment later: the step's card, custom title and all, stays.
  assert.deepEqual(details(afterTwitch), ['Mega Man 2', 'NES', '1988', 'Any%', '30:00'], 'the category arriving wiped the step’s card');
  assert.equal(afterTwitch.twitchCategoryId, '4455');
  // A category the step did not ask for is a new game like any other.
  assert.deepEqual(details(afterOther), ['Just Chatting', '', '', '', '']);
});

test('the step editor and the Game screen offer the card, in both languages', () => {
  const view = read('../../web/components/views/PlanView.tsx');
  assert.ok(view.includes('data-plan-card={item.id}') && view.includes('setCardYear'), 'the step has no run card to fill in');
  const constants = read('../../web/constants.ts');
  for (const key of ['planCard', 'planCardHint', 'gamePlanTip']) assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  assert.ok(read('../../web/components/views/GameView.tsx').includes('data-game-plan-tip'), 'the Game screen does not say a step can fill it');
});
