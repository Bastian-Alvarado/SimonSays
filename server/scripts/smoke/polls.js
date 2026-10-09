/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: around the poll. The next poll set up without touching the
 * result on screen; what the bot says as one opens and closes; a result that
 * clears itself for everything at once; past results; votes left out of the
 * chat on stream; "Poll opened" for actions; "!encuesta" for mods; and the
 * stream's words in Spanish whatever the screen showing them is set to.
 *
 * The basics — votes from every chat, the clock, the layer — are in
 * players-and-polls.js. Runs in order with the other feature files, on the
 * one engine the harness boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, chat, collection, engine, EVENTS, fs, said, settle, test } from './harness.js';
import { mod } from './chat-steps.js';
import { EXCLUDED, MANIFEST } from './backup-and-layouts.js';
import { conditionMet } from './layers.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const polls = await import('../../engine/polls.js');
const { wasVote, withoutVotes, DEFAULT_POLL_SETTINGS, MAX_POLL_HISTORY } = await import('../../../shared/polls.js');
const poll = (op, value) => engine.store.poll(op, value);
const now = () => engine.snapshot().poll;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

poll('reset');
poll('history_clear');
poll('settings', DEFAULT_POLL_SETTINGS);

// ------------------------------------------------------------ the next poll, apart from the one on screen

poll('open', { question: '¿Quién es el impostor?', options: ['Rojo', 'Azul', 'Lima'], durationMs: 0 });
chat('2', { user: 'Ana', userId: 'a1' });
chat('2', { user: 'Bo', userId: 'b1' });
chat('rojo', { user: 'Cy', userId: 'c1' });
await wait(300);
poll('close');
const closedResult = now();
poll('setDraft', { question: '¿Qué jugamos?', options: ['Celeste', 'Hades'] });
const whileClosed = now();

test('setting up the next poll leaves the result on screen as it was', () => {
  assert.equal(whileClosed.mode, 'closed');
  assert.equal(whileClosed.question, '¿Quién es el impostor?', 'the result on stream took the next poll\'s question');
  assert.deepEqual(whileClosed.options, ['Rojo', 'Azul', 'Lima'], 'the result on stream took the next poll\'s answers');
  assert.deepEqual(whileClosed.counts, closedResult.counts);
  assert.deepEqual(whileClosed.draft, { question: '¿Qué jugamos?', options: ['Celeste', 'Hades'] });
});

poll('open');
const openedFromDraft = now();
poll('setDraft', { options: ['Uno', 'Dos'] });
const whileOpen = now();
poll('close');

test('opening runs the draft, and editing it mid-poll leaves the running poll alone', () => {
  assert.equal(openedFromDraft.question, '¿Qué jugamos?');
  assert.deepEqual(openedFromDraft.options, ['Celeste', 'Hades']);
  assert.deepEqual(whileOpen.options, ['Celeste', 'Hades'], 'the answers being voted on changed mid-poll');
  assert.deepEqual(whileOpen.draft.options, ['Uno', 'Dos']);
});

// ------------------------------------------------------------ what the bot says

said.length = 0;
poll('settings', { announceOpen: true, announceClose: true });
poll('open', { question: '¿Quién es el impostor?', options: ['Moxie', 'Benji'], durationMs: 60000 });
chat('benji', { user: 'Ana', userId: 'a1' });
chat('2', { user: 'Bo', userId: 'b1' });
chat('1', { user: 'Cy', userId: 'c1' });
await wait(300);
poll('close');
await settle();
const saidAroundPoll = [...said];
said.length = 0;
poll('settings', { announceOpen: false, announceClose: false });
poll('open', { question: 'Callado', options: ['A', 'B'], durationMs: 0 });
poll('close');
await settle();
const saidWhileOff = [...said];
poll('settings', { announceOpen: true, announceClose: true });

test('the bot says the question and how to vote as a poll opens, and who won as it closes', () => {
  assert.deepEqual(saidAroundPoll, [
    '📊 ¿Quién es el impostor? — 1) Moxie · 2) Benji — Vota con el número o la respuesta, tienes 1 min.',
    '📊 ¿Quién es el impostor? — Ganó Benji con 2 de 3 votos (67%).',
  ]);
  assert.deepEqual(saidWhileOff, [], 'it spoke with both switched off');
});

test('the words fit the poll: a tie, no votes, the rules, and a list too long for one message', () => {
  const base = { question: '¿Quién?', options: ['Benji', 'Moxie', 'Pancho'] };
  assert.equal(polls.closeLine({ ...base, counts: [2, 2, 2], total: 6, leaders: [0, 1, 2] }), '📊 ¿Quién? — Empate entre Benji, Moxie y Pancho, con 2 votos cada una.');
  assert.equal(polls.closeLine({ ...base, counts: [0, 0, 0], total: 0, leaders: [] }), '📊 «¿Quién?» cerró sin votos.');
  assert.equal(polls.closeLine({ ...base, counts: [1, 0, 0], total: 1, leaders: [0] }), '📊 ¿Quién? — Ganó Benji con 1 de 1 voto (100%).');
  assert.ok(polls.openLine({ ...base, rules: { numbers: true, words: false }, durationMs: 90000 }).endsWith('— Vota con el número, tienes 1 min 30 s.'));
  assert.ok(polls.openLine({ ...base, rules: { numbers: false, words: false }, durationMs: 0 }).endsWith('— Vota con !voto y el número.'));
  const long = polls.openLine({ question: 'Q'.repeat(120), options: Array.from({ length: 15 }, (_, i) => `Respuesta larga número ${i + 1} ${'x'.repeat(30)}`), durationMs: 0 });
  assert.ok(long.length <= 500, `${long.length} characters is more than one chat message`);
  assert.ok(long.includes(' …') && long.endsWith('— Vota con el número o la respuesta.'), 'a list too long was cut without saying so');
});

// ------------------------------------------------------------ a result that clears itself

poll('settings', { resultSeconds: 0 });
poll('open', { question: 'Se va sola', options: ['A', 'B'], durationMs: 0 });
chat('a', { user: 'Ana', userId: 'a1' });
poll('close');
const upBefore = conditionMet('poll', false, { poll: now() });
// Set after it closed: applies to the result already up.
poll('settings', { resultSeconds: 1 });
await wait(1200);
const afterClear = now();
poll('settings', { resultSeconds: 0 });

test('a result can clear itself, for every surface at once — layers making room let go too', () => {
  assert.equal(upBefore, true);
  assert.equal(afterClear.mode, 'idle', 'the result stayed up past its time');
  assert.equal(conditionMet('poll', false, { poll: afterClear }), false, 'something making room for the poll still would be');
  // The layer no longer keeps a clock of its own for this.
  assert.ok(!read('../../web/components/PollLayer.tsx').includes('resultSeconds'));
  assert.ok(!read('../../web/components/PollLayerPanel.tsx').includes('resultSeconds'));
  assert.ok(read('../../web/components/views/PollsView.tsx').includes("setSettings({ resultSeconds: Number(e.target.value) })"));
});

// ------------------------------------------------------------ past polls

const history = engine.snapshot().pollHistory;
const past = history.find((h) => h.question === '¿Quién es el impostor?' && h.total === 3);
poll('history_use', past?.id);
const draftFromPast = now().draft;
for (let i = 0; i < MAX_POLL_HISTORY + 3; i += 1) { poll('open', { question: `Relleno ${i}`, options: ['A', 'B'], durationMs: 0 }); poll('close'); }
const fullHistory = engine.snapshot().pollHistory;
poll('history_delete', fullHistory[0].id);
const afterDelete = engine.snapshot().pollHistory;
poll('history_clear');
const afterForget = engine.snapshot().pollHistory;

test('past results are kept, newest first, to look back at and run again', () => {
  assert.ok(past, 'a closed poll was not kept');
  assert.deepEqual([past.options, past.counts, past.leaders], [['Moxie', 'Benji'], [1, 2], [1]]);
  assert.equal(history[0].question, 'Se va sola', 'the newest is not first');
  assert.deepEqual(draftFromPast, { question: '¿Quién es el impostor?', options: ['Moxie', 'Benji'] }, 'Use again did not bring it back');
  assert.equal(fullHistory.length, MAX_POLL_HISTORY);
  assert.equal(fullHistory[0].question, `Relleno ${MAX_POLL_HISTORY + 2}`);
  assert.equal(afterDelete.length, MAX_POLL_HISTORY - 1);
  assert.equal(afterDelete[0].question, `Relleno ${MAX_POLL_HISTORY + 1}`);
  assert.deepEqual(afterForget, []);
  assert.ok(!('voters' in (past || {})), 'who voted for what was kept');
});

// ------------------------------------------------------------ votes out of the chat on stream

poll('open', { question: 'Colores', options: ['Rojo', 'Azul'], durationMs: 0 });
const during = now();
const msg = (text, at) => ({ id: text + at, msg: text, at });
const messages = [
  msg('1', during.openedAt - 5000),
  msg('1', during.openedAt + 10),
  msg('azul', during.openedAt + 20),
  msg('!voto 2', during.openedAt + 30),
  msg('qué buena pregunta', during.openedAt + 40),
  { ...msg('', during.openedAt + 50), isEvent: true },
];
const shownWhileOpen = withoutVotes(messages, during, DEFAULT_POLL_SETTINGS).map((m) => m.msg);
const shownWhenOff = withoutVotes(messages, during, { ...DEFAULT_POLL_SETTINGS, hideVotes: false }).length;
// Cleared while open: its votes stay votes, and what is said afterwards is chat again.
// Long enough that every message above was said before it was cleared.
await wait(80);
poll('reset');
const cleared = now();
const afterReset = withoutVotes([...messages, msg('2', Date.now() + 1000)], cleared, DEFAULT_POLL_SETTINGS).map((m) => m.msg);

test('votes are left out of the chat on stream, and only votes, and only from that poll', () => {
  assert.deepEqual(shownWhileOpen, ['1', 'qué buena pregunta', ''], 'a vote showed, or chat that was not a vote went missing');
  assert.equal(shownWhenOff, messages.length);
  assert.equal(cleared.closedAt >= during.openedAt, true, 'clearing an open poll left its window open for ever');
  assert.deepEqual(afterReset, ['1', 'qué buena pregunta', '', '2'], 'a number said after the poll was cleared was hidden as a vote');
  assert.equal(wasVote(msg('1', during.openedAt + 10), { ...during, openedAt: null }), false);
  // The chat on stream is filtered where it is drawn — a chat layer, the only chat on stream; the dock keeps every message.
  assert.ok(read('../../web/components/CanvasStage.tsx').includes('messages={withoutVotes(system.data.chatMessages, (system.data as any).poll, (system.data as any).pollSettings)}'));
  assert.ok(!read('../../web/App.tsx').includes('withoutVotes('), 'the dock hides votes from whoever is reading it');
});

// ------------------------------------------------------------ "Poll opened", for actions

const openedEvents = [];
const stopOpened = bus.on(EVENTS.EVENT, (e) => { if (e.type === 'poll_opened') openedEvents.push(e); });
poll('open', { question: '¿Seguimos?', options: ['Sí', 'No'], durationMs: 45000 });
poll('reset');
stopOpened();

test('an action can start with a poll opening, and knows what it asks', () => {
  assert.equal(openedEvents.length, 1);
  assert.equal(openedEvents[0].user, '¿Seguimos?');
  assert.deepEqual([openedEvents[0].data.answers, openedEvents[0].data.count, openedEvents[0].data.seconds], ['Sí / No', 2, 45]);
  const actions = read('../../web/components/views/ActionsView.tsx');
  assert.ok(actions.includes("{ value: 'poll_opened', label: t.triggerPollOpened || 'Poll opened'"));
  assert.ok(read('../../web/components/VariablePicker.tsx').includes('  poll_opened: ['));
});

// ------------------------------------------------------------ "!encuesta"

said.length = 0;
chat('!encuesta ¿Qué jugamos? | Celeste | Hades', { user: 'Random', userId: 'r1' });
await settle();
const fromViewer = now().mode;
chat('!encuesta ¿Qué jugamos? | Celeste | Hades', mod);
await settle();
const fromMod = now();
chat('!encuesta cerrar', mod);
await settle();
const afterCerrar = now().mode;
chat('!encuesta cerrar', mod);
chat('!encuesta ¿Solo pregunta?', mod);
await settle();
const saidToMods = said.slice(-2);
// A command of the streamer's own on the same word answers instead.
const commandsStore = collection('commands', []);
const commandsBefore = commandsStore.get();
commandsStore.set([...(commandsBefore || []), { id: 'own-encuesta', enabled: true, triggers: ['!encuesta'] }]);
// One that runs: an action linked to it. A command left without one does not take the word (commands.ownCommandAnswers).
const ownActions = collection('actions', []);
const ownActionsBefore = ownActions.get();
ownActions.set([...(ownActionsBefore || []), { id: 'act-own-encuesta', name: 'Own', enabled: true, trigger: { type: 'command_trigger', category: 'command', config: { commandId: 'own-encuesta' } }, actions: [] }]);
poll('reset');
chat('!encuesta Otra | A | B', mod);
await settle();
const overOwn = now().mode;
commandsStore.set(commandsBefore);
ownActions.set(ownActionsBefore);
poll('settings', { command: { enabled: false } });
chat('!encuesta Otra | A | B', mod);
await settle();
const whileOff = now().mode;
poll('settings', { command: { enabled: true, trigger: 'poll' } });
chat('!poll Otra | A | B', mod);
await settle();
const onNewWord = now();
poll('reset');
poll('settings', DEFAULT_POLL_SETTINGS);

test('mods open and close a poll from chat with "!encuesta", and hear why when it is written wrong', () => {
  assert.equal(fromViewer, 'idle', 'a viewer opened a poll');
  assert.equal(fromMod.mode, 'open');
  assert.deepEqual([fromMod.question, fromMod.options], ['¿Qué jugamos?', ['Celeste', 'Hades']]);
  assert.equal(afterCerrar, 'closed');
  assert.deepEqual(saidToMods, ['No hay ninguna encuesta abierta.', 'Escríbela así: !encuesta Pregunta | respuesta | respuesta']);
  assert.equal(overOwn, 'idle', 'the built-in answered a word the streamer had given a command of their own');
  assert.equal(whileOff, 'idle', 'it opened a poll while turned off');
  // Typed without the "!", the word gets one.
  assert.deepEqual([onNewWord.mode, onNewWord.question], ['open', 'Otra']);
});

// ------------------------------------------------------------ the stream's words

test('what is on stream speaks Spanish, whatever the screen showing it is set to', () => {
  const stage = read('../../web/components/CanvasStage.tsx');
  assert.ok(stage.includes('const STREAM_WORDS = TRANSLATIONS.es;'));
  assert.ok(stage.includes('{renderLayer(layer, system, STREAM_WORDS, layout.accent, layout.layers)}'), 'the layers still use the device\'s language');
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("searchParams.get('timer'))} t={streamT} />"), 'the countdown page');
  assert.ok(app.includes('t: streamT,'), 'the omnibar page');
  assert.ok(app.includes('status={system.status}\n          t={streamT}') || app.includes('status={system.status}\r\n          t={streamT}'), 'the viewer count page');
});

// ------------------------------------------------------------ the screen

test('the Polls screen: the draft, platforms by name, the next answer focused, settings and past polls, in both languages', () => {
  const view = read('../../web/components/views/PollsView.tsx');
  const constants = read('../../web/constants.ts');
  assert.ok(view.includes('const draft = poll?.draft ||'), 'the screen still edits the poll on screen');
  assert.ok(view.includes('(PLATFORMS as any)[platform]'), 'platforms are shown by their ids');
  assert.ok(view.includes('setFocusAnswer(options.length)') && view.includes('answerRefs.current[focusAnswer]?.focus()'), 'Enter leaves the cursor behind');
  for (const op of ["control('history_use', h.id)", "control('history_delete', h.id)", "control('history_clear')"]) assert.ok(view.includes(op), op);
  const keys = new Set();
  for (const f of ['views/PollsView.tsx', 'PollLayerPanel.tsx', 'PollLayer.tsx']) {
    for (const m of read(`../../web/components/${f}`).matchAll(/\bt\??\.((poll|trigger)[A-Za-z]+)/g)) keys.add(m[1]);
  }
  keys.add('triggerPollOpened');
  assert.ok(keys.size >= 40, `only ${keys.size} strings found`);
  for (const key of keys) assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
});

test('how polls behave travels in a backup; the votes and past results do not', () => {
  assert.ok(MANIFEST.some((m) => m.name === 'poll_settings'));
  assert.ok(EXCLUDED.includes('poll') && EXCLUDED.includes('poll_history'));
  assert.equal(engine.snapshot().pollSettings.command.trigger, '!encuesta');
});
