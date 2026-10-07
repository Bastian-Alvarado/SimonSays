/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The players list, polls, and the app's own moments as triggers.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, SCRIPT_URL, assert, bus, chat, engine, fs, said, settle, test } from './harness.js';
import { mod, runCommand } from './chat-steps.js';
import { EXCLUDED, LAYER_TYPES, MANIFEST, normaliseLayout } from './backup-and-layouts.js';
import { CONDITION_IDS, fillTemplate } from './layers.js';
import { CSS_LOOKS } from './stylesheets.js';

// ------------------------------------------- the players list

const playersShared = await import('../../../shared/players.js');

test('a players list is held to fifty, named, coloured, in a known state, and nobody twice', () => {
  const { cleanPlayers, MAX_PLAYERS, colourFor, PLAYER_COLOURS } = playersShared;
  assert.equal(MAX_PLAYERS, 50);
  const many = cleanPlayers({ items: Array.from({ length: 70 }, (_, i) => ({ name: `P${i}` })) });
  assert.equal(many.items.length, 50, 'more than fifty were kept');
  const one = cleanPlayers({ items: [
    { name: '  Rowan  ', colour: 'red', state: 'dead' },
    { name: '@rowan', colour: 'blue' },
    { name: '', colour: 'lime' },
    { name: 'Nolan', colour: 'not a colour', state: 'flying' },
  ] }).items;
  assert.equal(one.length, 2, 'a blank name or the same name twice was kept');
  assert.deepEqual([one[0].name, one[0].colour, one[0].state], ['Rowan', PLAYER_COLOURS.red, 'dead']);
  // No colour, or a bad one: one from the name, the same every time.
  assert.equal(one[1].colour, colourFor('Nolan'));
  assert.equal(colourFor('Nolan'), colourFor('Nolan'));
  assert.equal(one[1].state, 'in', 'an unknown state was kept');
});

engine.store.setPlayers({ items: [] });
runCommand('join', [{ type: 'players_join', config: { name: '{user}', colour: '{input}' } }]);
runCommand('eject', [{ type: 'players_state', config: { name: '{input}', playerState: 'ejected' } }]);
runCommand('kick', [{ type: 'players_remove', config: { name: '{input}' } }]);
runCommand('round', [{ type: 'players_reset', config: {} }]);
runCommand('empty', [{ type: 'players_clear', config: {} }]);
const playersNow = () => engine.snapshot().players.items;
const playersChanged = [];
const stopPlayers = bus.on(EVENTS.CONFIG, ({ key, value }) => { if (key === 'players') playersChanged.push(value.items.length); });

chat('!join red', mod);
await settle();
chat('!join cyan', mod);
await settle();
const joinedTwice = playersNow().map((p) => ({ ...p }));
engine.store.setPlayers({ items: [...playersNow(), { name: 'Nolan' }, { name: 'Ninja' }] });
chat('!eject nolan', mod);
await settle();
const afterEject = playersNow().map((p) => [p.name, p.state]);
chat('!eject Nobody', mod);
await settle();
chat('!round', mod);
await settle();
const afterRound = playersNow().map((p) => p.state);
chat('!kick Ninja', mod);
await settle();
const afterKick = playersNow().map((p) => p.name);
chat('!empty', mod);
await settle();
const afterEmpty = playersNow().length;
stopPlayers();

test('a viewer joins as themselves in the colour they name, and joining again is not a second copy', () => {
  assert.equal(joinedTwice.length, 1, 'joining twice made two of them');
  assert.equal(joinedTwice[0].name, mod.user);
  assert.equal(joinedTwice[0].colour, playersShared.PLAYER_COLOURS.cyan, 'joining again did not take the new colour');
  assert.equal(joinedTwice[0].state, 'in');
});

test('a command puts somebody out by name, however it is typed, and a new round brings everyone back', () => {
  assert.deepEqual(afterEject.find(([n]) => n === 'Nolan'), ['Nolan', 'ejected']);
  assert.ok(afterRound.every((st) => st === 'in'), `after a new round: ${afterRound}`);
});

test('a player can be taken off the list, and the list emptied', () => {
  assert.ok(!afterKick.includes('Ninja'), 'the player was not taken off');
  assert.equal(afterKick.length, 2);
  assert.equal(afterEmpty, 0);
  // Every change reaches the screens, a command's as much as the dashboard's.
  assert.ok(playersChanged.length >= 6, `only ${playersChanged.length} changes were announced`);
});

test('a full list refuses the fifty-first player rather than dropping somebody', () => {
  engine.store.setPlayers({ items: Array.from({ length: 50 }, (_, i) => ({ name: `P${i}` })) });
  const svc = engine.store; // the list as the dashboard sets it
  assert.equal(engine.snapshot().players.items.length, 50);
  engine.store.setPlayers({ items: [...engine.snapshot().players.items, { name: 'Late' }] });
  assert.ok(!engine.snapshot().players.items.some((p) => p.name === 'Late'), 'a fifty-first player was kept');
  assert.equal(engine.snapshot().players.items[0].name, 'P0', 'somebody already on the list was dropped');
  engine.store.setPlayers({ items: [] });
  void svc;
});

test('a players layer shows up to 24 a page, and how many is the layer\'s to choose', () => {
  assert.ok(LAYER_TYPES.includes('players'), 'there is no players layer');
  const layer = (config) => normaliseLayout({ id: 'p', layers: [{ type: 'players', uid: 'pl', config }] }).layers[0].config;
  assert.equal(layer({}).perPage, 24, 'a page does not default to 24');
  assert.equal(layer({ perPage: 10 }).perPage, 10, 'a smaller page was not kept');
  assert.equal(layer({ perPage: 60 }).perPage, 24, 'a page was allowed more than 24');
  assert.equal(layer({}).columns, 0, 'the columns do not default to automatic');
  assert.equal(layer({ onlyIn: true }).onlyIn, true);
  const view = fs.readFileSync(new URL('../../web/components/PlayersLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('pagesOf(shown, perPage)'), 'the layer does not cut the list into pages');
  // Rows are sized by the page, so one player is not one enormous row filling the box.
  assert.ok(view.includes('const capacity = perPage;'), 'rows are sized by how many players there are');
  assert.ok(view.includes("config.onlyIn ? all.filter((p) => p.state === 'in') : all"), 'the layer cannot show only those still in');
  assert.ok(view.includes('data-players-state={p.state}'), 'a row does not say where its player stands, for a theme to style');
});

test('the players list travels in a backup, and the editor offers every step in both languages', () => {
  assert.ok(MANIFEST.some((e) => e.name === 'players'), 'the players list is left out of a backup');
  const actionsView = fs.readFileSync(new URL('../../web/components/views/ActionsView.tsx', SCRIPT_URL), 'utf8');
  for (const type of ['players_join', 'players_state', 'players_remove', 'players_reset', 'players_clear']) {
    assert.ok(actionsView.includes(`type: '${type}'`), `${type} is not in the Overlay menu`);
  }
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['playersNav', 'playersStepJoin', 'playersStepState', 'playersPerPage', 'playersOnlyIn', 'playersStateEjected']) {
    assert.equal(strings.split(key + ':').length - 1, 2, key);
  }
});

// ------------------------------------------- polls

const pollsShared = await import('../../../shared/polls.js');

test('a vote is a number, an answer or !vote — and chatter is not a vote', () => {
  const { readVote, DEFAULT_RULES } = pollsShared;
  const opts = ['Rojo', 'Azul', 'Nadie, skip'];
  assert.equal(readVote('2', opts), 1);
  assert.equal(readVote(' #3 ', opts), 2);
  assert.equal(readVote('¡ROJO!', opts), 0, 'an answer typed loudly is still that answer');
  assert.equal(readVote('!vote 1', opts), 0);
  assert.equal(readVote('!voto azul', opts), 1);
  assert.equal(readVote('4', opts), -1, 'a number past the last answer counted');
  assert.equal(readVote('0', opts), -1);
  assert.equal(readVote('rojo es el impostor', opts), -1, 'a sentence that mentions an answer counted');
  assert.equal(readVote('!join red', opts), -1, 'another command counted as a vote');
  // Bare votes switched off: only the command counts.
  const strict = { ...DEFAULT_RULES, numbers: false, words: false };
  assert.equal(readVote('2', opts, strict), -1);
  assert.equal(readVote('rojo', opts, strict), -1);
  assert.equal(readVote('!vote 2', opts, strict), 1);
});

test('a poll is cleaned: a line each, none twice, no more than fifteen', () => {
  const { cleanOptions, parsePollLine, MAX_OPTIONS } = pollsShared;
  assert.equal(MAX_OPTIONS, 15);
  assert.deepEqual(cleanOptions(['  Red ', 'red', '', 'Blue']), ['Red', 'Blue']);
  assert.equal(cleanOptions(Array.from({ length: 20 }, (_, i) => `O${i}`)).length, 15);
  assert.deepEqual(parsePollLine('Who? | Red | Blue |'), { question: 'Who?', options: ['Red', 'Blue'] });
});

// A poll run the way a stream runs one: set up on the screen, voted on from every chat.
const pollEvents = [];
const stopPollEvents = bus.on(EVENTS.EVENT, (e) => { if (e.type === 'poll_closed') pollEvents.push(e); });
const pollAnnounced = [];
const stopPollConfig = bus.on(EVENTS.CONFIG, ({ key, value }) => { if (key === 'poll') pollAnnounced.push(value); });

engine.store.poll('reset');
engine.store.poll('setDraft', { question: 'Who is the impostor?', options: ['Red', 'Blue', 'Lime'], durationMs: 0 });
chat('1', { user: 'Early' });
const beforeOpen = engine.snapshot().poll.total;
engine.store.poll('open');
chat('1', { platform: 'twitch', user: 'Ana', userId: 't1' });
chat('blue', { platform: 'youtube', user: 'Ana', userId: 'y1' });
chat('!vote 3', { platform: 'tiktok', user: 'Kiko', userId: 'k1' });
chat('lime', { platform: 'discord', user: 'Dee', userId: 'd1' });
chat('2', { platform: 'twitch', user: 'Ana', userId: 't1' });
chat('rojo no creo', { platform: 'twitch', user: 'Bo', userId: 't2' });
const midPoll = engine.snapshot().poll;
engine.store.poll('setDraft', { options: ['Changed', 'Mid', 'Poll'] });
const optionsAfterMidEdit = engine.snapshot().poll.options;
engine.store.poll('setDraft', { rules: { change: false } });
chat('1', { platform: 'discord', user: 'Dee', userId: 'd1' });
const noChange = engine.snapshot().poll.counts;
await new Promise((r) => setTimeout(r, 320));
engine.store.poll('close');
chat('1', { platform: 'twitch', user: 'Late', userId: 't9' });
const closedPoll = engine.snapshot().poll;
await settle();

// On its own clock, and from a chat command.
runCommand('poll', [{ type: 'poll_open', config: { text: '{input}' } }]);
runCommand('endpoll', [{ type: 'poll_close', config: {} }]);
runCommand('nopoll', [{ type: 'poll_reset', config: {} }]);
chat('!poll ¿Quién gana? | Uno | Dos', mod);
await settle();
const fromChat = engine.snapshot().poll;
chat('!nopoll', mod);
await settle();
const afterReset = engine.snapshot().poll;
engine.store.poll('open', { question: 'Quick', options: ['A', 'B'], durationMs: 120 });
chat('b', { platform: 'youtube', user: 'Zed', userId: 'y2' });
await new Promise((r) => setTimeout(r, 260));
const timedOut = engine.snapshot().poll;
engine.store.poll('reset');
engine.store.poll('setDraft', { durationMs: 60000, rules: { change: true } });
stopPollEvents();
stopPollConfig();

test('chat votes from every platform, one vote each per platform, changed by voting again', () => {
  assert.equal(beforeOpen, 0, 'a vote counted before the poll opened');
  // Ana on Twitch changed 1 → 2; Ana on YouTube is a different viewer. Bo's sentence is not a vote.
  assert.deepEqual(midPoll.counts, [0, 2, 2]);
  assert.equal(midPoll.total, 4);
  assert.deepEqual(midPoll.byPlatform, { twitch: 1, youtube: 1, tiktok: 1, discord: 1 });
  assert.deepEqual(midPoll.leaders, [1, 2], 'a tie does not name both answers');
  assert.ok(!('voters' in midPoll), 'who voted for what was sent to the screens');
});

test('what is being voted on cannot change mid-poll, but the rules can', () => {
  assert.deepEqual(optionsAfterMidEdit, ['Red', 'Blue', 'Lime']);
  assert.deepEqual(noChange, [0, 2, 2], 'a changed vote counted with changing switched off');
});

test('a closed poll keeps its result, takes no more votes, and says who won', () => {
  assert.equal(closedPoll.mode, 'closed');
  assert.equal(closedPoll.total, 4, 'a vote after closing counted');
  assert.equal(pollEvents[0]?.data?.winner, 'Blue / Lime');
  assert.equal(pollEvents[0]?.data?.tie, true);
  // Votes are told to the screens a few times a second, not once a message. The
  // rest are real changes — opening, closing, the draft edited mid-poll — and
  // telling the votes one a message would add seven more.
  assert.ok(pollAnnounced.length < 13, `the poll was announced ${pollAnnounced.length} times`);
});

test('a mod opens a poll from chat, and it runs out on its own clock', () => {
  assert.equal(fromChat.mode, 'open');
  assert.equal(fromChat.question, '¿Quién gana?');
  assert.deepEqual(fromChat.options, ['Uno', 'Dos']);
  assert.equal(afterReset.mode, 'idle');
  assert.equal(afterReset.question, '¿Quién gana?', 'clearing the screen threw the poll away');
  assert.equal(timedOut.mode, 'closed', 'the poll did not close when its time ran out');
  assert.deepEqual(timedOut.counts, [0, 1]);
  assert.equal(pollEvents.length, 2);
});

test('a poll layer, a condition and text values for it, and a poll is not backed up', () => {
  assert.ok(LAYER_TYPES.includes('poll'), 'there is no poll layer');
  const layer = (config) => normaliseLayout({ id: 'p', layers: [{ type: 'poll', uid: 'po', config }] }).layers[0].config;
  assert.equal(layer({}).columns, 0);
  assert.equal(layer({ columns: 9 }).columns, 3);
  assert.equal(layer({}).showPercent, true);
  // How long a result stays is the poll's to say now, not each layer's.
  assert.equal(layer({ resultSeconds: 5000 }).resultSeconds, undefined);
  assert.ok(CONDITION_IDS.includes('poll'));
  const state = { poll: { mode: 'open', question: 'Q', options: ['A', 'B'], total: 3, leaders: [1] } };
  assert.equal(fillTemplate('{pollQuestion}: {pollLeader} ({pollVotes})', state), 'Q: B (3)');
  assert.ok(EXCLUDED.includes('poll'), 'who voted for what would travel in a backup');
  const view = fs.readFileSync(new URL('../../web/components/PollLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("if (!poll || poll.mode === 'idle' || !poll.options?.length) return null;"), 'the layer draws an empty poll');
  for (const part of ['data-poll="question"', 'data-poll="fill"', 'data-poll-winner=', 'data-poll="timer"']) assert.ok(view.includes(part), `${part} is not named for a theme`);
});

test('the Polls screen, its steps and its layer are offered in both languages', () => {
  const actionsView = fs.readFileSync(new URL('../../web/components/views/ActionsView.tsx', SCRIPT_URL), 'utf8');
  for (const type of ['poll_open', 'poll_close', 'poll_reset']) assert.ok(actionsView.includes(`type: '${type}'`), `${type} is not in the Overlay menu`);
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['pollsNav', 'pollHintWords', 'pollVotes', 'pollStepOpen', 'pollStepOpenHint', 'pollClosedLabel', 'pollRuleWords']) {
    assert.equal(strings.split(key + ':').length - 1, 2, key);
  }
});

// ------------------------------------------- the app's own moments as triggers

engine.store.saveAction({
  id: 'act-on-countdown', name: 'on countdown', enabled: true,
  trigger: { id: 't-cd', category: 'system', type: 'countdown_finished', config: {} },
  actions: [{ id: 's-cd', type: 'twitch_chat', config: { message: 'Time is up: {event.label}' } }],
});
engine.store.saveAction({
  id: 'act-on-poll', name: 'on poll', enabled: true,
  trigger: { id: 't-po', category: 'system', type: 'poll_closed', config: {} },
  actions: [{ id: 's-po', type: 'twitch_chat', config: { message: '{event.question} -> {user} ({event.votes})' } }],
});
said.length = 0;
engine.store.countdown('setLabel', 'Party');
engine.store.countdown('start', 80);
await new Promise((r) => setTimeout(r, 200));
engine.store.poll('open', { question: 'Who?', options: ['Rojo', 'Azul'], durationMs: 0 });
chat('rojo', { platform: 'youtube', user: 'Pia', userId: 'y-pia' });
engine.store.poll('close');
await settle();
const saidOnMoments = [...said];
engine.store.poll('reset');
engine.store.countdown('reset');
engine.store.deleteAction?.('act-on-countdown');
engine.store.deleteAction?.('act-on-poll');

test('an action can run when the countdown finishes and when a poll closes', () => {
  assert.ok(saidOnMoments.includes('Time is up: Party'), `said: ${JSON.stringify(saidOnMoments)}`);
  assert.ok(saidOnMoments.includes('Who? -> Rojo (1)'), `said: ${JSON.stringify(saidOnMoments)}`);
  const actionsView = fs.readFileSync(new URL('../../web/components/views/ActionsView.tsx', SCRIPT_URL), 'utf8');
  for (const type of ['countdown_finished', 'poll_closed']) assert.ok(actionsView.includes(`value: '${type}'`), `${type} cannot be picked as a trigger`);
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['triggerSystem', 'triggerCountdownFinished', 'triggerPollClosed']) assert.equal(strings.split(key + ':').length - 1, 2, key);
});


{
  const { normaliseLayouts } = await import('../../engine/layouts.js');
  // One poll to a layout, so three layouts.
  const slotsOf = normaliseLayouts([{ slots: 15 }, { slots: 99 }, {}].map((config, i) => ({ id: 'ps' + i, layers: [{ type: 'poll', config }] }))).map((l) => l.layers[0].config.slots);
  const view = fs.readFileSync(new URL('../../web/components/PollLayer.tsx', SCRIPT_URL), 'utf8');
  test('a poll can keep room for a set number of answers, the way the players list keeps its slots', () => {
    assert.deepEqual(slotsOf, [15, 15, 0]);
    assert.ok(view.includes('const capacity = config.slots ? Math.max(config.slots, options.length) : options.length;'));
    assert.ok(view.includes('autoColumns(capacity)'), 'the columns do not follow the players list with room set');
  });
}
