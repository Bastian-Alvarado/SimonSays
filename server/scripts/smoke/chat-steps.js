/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Overlay steps from chat: Spotify variables, omnibar slots, the run card, questions, the plan, text layers.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, chat, doubles, engine, fs, said, settle, test } from './harness.js';

// ------------------------------------------------------- spotify variables

engine.store.saveCommand({ id: 'cmd-song', name: 'Song', triggers: ['!song'], enabled: true, permissions: { anyone: true } });
engine.store.saveAction({
  id: 'act-song',
  name: 'Now playing',
  enabled: true,
  trigger: { id: 't-song', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-song' } },
  actions: [{ id: 's-song', type: 'twitch_chat', config: { message: 'Playing {spotify.track} by {spotify.artist}' } }],
});

engine.store.saveCommand({ id: 'cmd-sr', name: 'Request', triggers: ['!sr'], enabled: true, permissions: { anyone: true } });
engine.store.saveAction({
  id: 'act-sr',
  name: 'Song request',
  enabled: true,
  trigger: { id: 't-sr', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-sr' } },
  actions: [
    { id: 's-q', type: 'spotify_control', config: { spotifyOperation: 'queue', spotifyUri: '{input}' } },
    { id: 's-say', type: 'twitch_chat', config: { message: '{user} asked for {spotify.queuedTrack} by {spotify.queuedArtist}' } },
  ],
});

said.length = 0;
chat('!song');
await settle();
test('{spotify.track} and {spotify.artist} resolve', () => {
  assert.ok(said.includes('Playing Smells Like Teen Spirit by Nirvana'), `got ${JSON.stringify(said)}`);
});

said.length = 0;
chat('!sr bohemian rhapsody');
await settle();
test('a queue step feeds {spotify.queuedTrack} to the step after it', () => {
  assert.ok(said.includes('Viewer asked for Bohemian Rhapsody by Queen'), `got ${JSON.stringify(said)}`);
});

engine.store.saveAction({
  id: 'act-sr-fails',
  name: 'Song request that queues nothing',
  enabled: true,
  trigger: { id: 't-srf', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-sr' } },
  actions: [
    // Mirrors a request with no song name, or Spotify being signed out: the
    // queue step contributes nothing and the reply still runs.
    { id: 's-qf', type: 'spotify_control', config: { spotifyOperation: 'queue', spotifyUri: '' } },
    { id: 's-sayf', type: 'twitch_chat', config: { message: 'asked for {spotify.queuedTrack}!' } },
  ],
});

said.length = 0;
chat('!sr');
await settle();
test('a queue that did not happen leaves no placeholder reaches chat', () => {
  const leaked = said.filter((line) => line.includes('{spotify.'));
  assert.equal(leaked.length, 0, `chat showed a raw variable: ${JSON.stringify(leaked)}`);
});

// ------------------------------------------ viewer-settable omnibar slot

engine.store.setOmnibar({
  enabled: true,
  defaultSeconds: 10,
  items: [{ id: 'slot-shout', type: 'text', enabled: true, label: 'Shoutout', text: '', seconds: null }],
  style: {},
});

// Mods only, exactly as the Commands screen would express it.
engine.store.saveCommand({
  id: 'cmd-bar',
  name: 'Bar',
  triggers: ['!bar'],
  enabled: true,
  permissions: { anyone: false, vips: false, subscribers: false, moderators: true, broadcaster: true },
});
engine.store.saveAction({
  id: 'act-bar',
  name: 'Set the omnibar',
  enabled: true,
  trigger: { id: 't-bar', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-bar' } },
  actions: [{ id: 's-bar', type: 'omnibar_set', config: { slotId: 'slot-shout', text: '{user}: {input}' } }],
});

const slotText = () => engine.store.getOmnibar().items.find((i) => i.id === 'slot-shout')?.text;

chat('!bar go follow someone', { user: 'Modzilla', isMod: true });
await settle();
test('a mod can put words on the omnibar', () => {
  assert.equal(slotText(), 'Modzilla: go follow someone');
});

chat('!bar I am not a mod', { user: 'RandomViewer' });
await settle();
test('a viewer without permission cannot', () => {
  assert.equal(slotText(), 'Modzilla: go follow someone', 'the command permissions did not gate the omnibar');
});

chat('!bar ' + 'x'.repeat(400), { user: 'Modzilla', isMod: true });
await settle();
test('an over-long message is bounded before it reaches the stream', () => {
  assert.ok(slotText().length <= 120 + 'Modzilla: '.length, `slot held ${slotText().length} characters`);
});

chat(['!bar   line one', 'line two  '].join(String.fromCharCode(10)), { user: 'Modzilla', isMod: true });
await settle();
test('newlines cannot change the height of the bar', () => {
  assert.ok(!slotText().includes(String.fromCharCode(10)), 'a newline reached the bar');
});

chat('!bar', { user: 'Modzilla', isMod: true });
await settle();
test('running it with no words clears the slot', () => {
  assert.equal(slotText(), 'Modzilla:');
});

// ------------------------------------------------ the run card, from chat

engine.store.setRun({ game: 'Street Fighter 6', platform: 'PC', year: '2023', estimate: '1:00:00' });

// One mods-only command per step, as they would be set up on the Commands screen.
export const runCommand = (word, steps) => {
  engine.store.saveCommand({
    id: `cmd-run-${word}`, name: word, triggers: [`!${word}`], enabled: true,
    permissions: { anyone: false, vips: false, subscribers: false, moderators: true, broadcaster: true },
  });
  engine.store.saveAction({
    id: `act-run-${word}`, name: word, enabled: true,
    trigger: { id: `t-run-${word}`, category: 'command', type: 'command_trigger', config: { commandId: `cmd-run-${word}` } },
    actions: steps.map((s, i) => ({ id: `s-run-${word}-${i}`, ...s })),
  });
};
runCommand('rgame', [{ type: 'run_set_game', config: { value: '{input}' } }]);
runCommand('rplatform', [{ type: 'run_set_platform', config: { value: '{input}' } }]);
runCommand('ryear', [{ type: 'run_set_year', config: { value: '{input}' } }]);
runCommand('rcat', [{ type: 'run_set_category', config: { value: '{input}' } }]);
runCommand('rest', [{ type: 'run_set_estimate', config: { value: '{input}' } }]);
runCommand('rrunner', [{ type: 'run_set_runner', config: { name: '{input}' } }]);
runCommand('rhost', [{ type: 'run_set_host', config: { name: '{input}', subtitle: 'he/him' } }]);
runCommand('rcomm', [{ type: 'run_set_commentator', config: { seat: 3, name: '{input}' } }]);
runCommand('rclear', [{ type: 'run_clear', config: { clearWhat: 'details' } }]);

export const runNow = () => engine.snapshot().run;
export const mod = { user: 'Modzilla', isMod: true };

chat('!rgame  Celeste ', mod);
chat('!rplatform Switch', mod);
chat('!ryear 2018', mod);
chat('!rcat Any%', mod);
chat('!rest 0:40:00', mod);
await settle();
test('a mod can set every detail on the run card from chat', () => {
  const r = runNow();
  assert.deepEqual([r.game, r.platform, r.year, r.category, r.estimate], ['Celeste', 'Switch', '2018', 'Any%', '0:40:00']);
});

chat('!rgame Hollow Knight', { user: 'RandomViewer' });
await settle();
test('and a viewer without permission cannot', () => {
  assert.equal(runNow().game, 'Celeste', 'the command permissions did not gate the run card');
});

chat('!ryear last year', mod);
await settle();
test('a year that is not a year is dropped by the same rule as the Game screen', () => {
  assert.equal(runNow().year, '');
});

chat('!rplatform', mod);
await settle();
test('a detail command with nothing after it takes that detail off the card', () => {
  assert.equal(runNow().platform, '');
  assert.equal(runNow().game, 'Celeste', 'clearing one detail touched another');
});

engine.store.setRun({ ...runNow(), runner: { name: 'Old', subtitle: 'they/them' } });
chat('!rrunner Rowan', mod);
chat('!rhost Pat', mod);
await settle();
test('renaming a person leaves the second line alone unless the step sets one', () => {
  assert.deepEqual(runNow().runner, { name: 'Rowan', subtitle: 'they/them' });
  assert.deepEqual(runNow().host, { name: 'Pat', subtitle: 'he/him' });
});

chat('!rcomm Guest', mod);
await settle();
test('a commentator goes in the seat the step names, counted from one', () => {
  const seats = runNow().commentators;
  assert.equal(seats.length, 3, 'the seats before it were not kept as empty ones');
  assert.equal(seats[2].name, 'Guest');
  assert.equal(seats[0].name, '');
});

chat('!rclear', mod);
await settle();
test('clearing the details leaves the people at the table', () => {
  const r = runNow();
  assert.deepEqual([r.game, r.platform, r.year, r.category, r.estimate], ['', '', '', '', '']);
  assert.equal(r.runner.name, 'Rowan');
  assert.equal(r.commentators[2].name, 'Guest');
});

// ------------------------------------------- the question queue, from chat

engine.store.clearQuestions('all');
runCommand('qask', [{ type: 'question_add', config: { text: '{input}' } }]);
runCommand('qfor', [{ type: 'question_add', config: { text: '{input}', asker: 'Discord' } }]);
const queued = () => engine.snapshot().questions.items;

chat('!qask what got you into speedrunning?', mod);
await settle();
test('an action puts the words after the command in the question queue, waiting', () => {
  const q = queued().at(-1);
  assert.equal(q.text, 'what got you into speedrunning?');
  assert.equal(q.user, mod.user);
  // Waiting, not on screen: approving is still somebody's decision.
  assert.equal(q.status, 'pending');
  assert.equal(engine.snapshot().questions.showingId, '');
});

chat('!qfor any tips for the skip?', mod);
await settle();
test('and a step can credit somebody other than whoever ran it', () => {
  assert.equal(queued().at(-1).user, 'Discord');
});

chat('!qask', mod);
await settle();
test('and a command with nothing after it queues nothing', () => {
  assert.equal(queued().length, 2);
});

test('the editor offers it among the overlay steps, in both languages', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/ActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/type: 'question_add', key: 'questionStepAdd'/.test(view), 'the step is not in the Overlay menu');
  assert.ok(/type === 'question_add'/.test(view), 'the Overlay filter does not count it');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/question_add: \{ text: '\{input\}' \}/.test(app), 'a new step does not start with {input}');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['questionStepAdd', 'questionStepText', 'questionStepAsker', 'questionStepHint']) {
    assert.equal(strings.split(key + ':').length - 1, 2, key);
  }
});

// ------------------------------------------- the stream plan, from chat

engine.store.setPlan({ items: [{ id: 'p1', text: 'Warm up' }, { id: 'p2', text: 'Ranked' }], currentId: '' });
runCommand('padd', [{ type: 'plan_add', config: { text: '{input}', where: 'end' } }]);
runCommand('pnow', [{ type: 'plan_add', config: { text: '{input}', note: 'by {user}', where: 'next' } }]);
runCommand('pnext', [
  { type: 'plan_next', config: {} },
  { type: 'twitch_chat', config: { message: 'now: {plan.current} ({plan.done}/{plan.total})' } },
]);
runCommand('pback', [{ type: 'plan_back', config: {} }]);

const planNow = () => engine.snapshot().plan;
const planTexts = () => planNow().items.map((i) => i.text);
const current = () => (planNow().items.find((i) => i.id === planNow().currentId) || {}).text || '';

chat('!padd Viewer games', mod);
await settle();
test('a mod can add an activity to the end of the plan', () => {
  assert.deepEqual(planTexts(), ['Warm up', 'Ranked', 'Viewer games']);
});

chat('!padd Sneaky', { user: 'RandomViewer' });
await settle();
test('and a viewer without permission cannot', () => {
  assert.equal(planTexts().length, 3);
});

said.length = 0;
chat('!pnext', mod);
await settle();
test('completing before anything has started starts the first activity', () => {
  assert.equal(current(), 'Warm up');
  assert.ok(said.some((l) => l.includes('now: Warm up (0/3)')), `chat said ${JSON.stringify(said)}`);
});

chat('!pnext', mod);
await settle();
test('completing the current one marks it done and moves to the next', () => {
  assert.equal(current(), 'Ranked');
  assert.deepEqual(planNow().items.map((i) => i.done), [true, false, false]);
});

chat('!pnow Raid train', mod);
await settle();
test('an activity added as next goes straight after the current one', () => {
  assert.deepEqual(planTexts(), ['Warm up', 'Ranked', 'Raid train', 'Viewer games']);
  assert.equal(planNow().items[2].note, 'by Modzilla');
  assert.equal(current(), 'Ranked', 'adding one moved the pointer');
});

chat('!pback', mod);
await settle();
test('going back undoes a move made by accident', () => {
  assert.equal(current(), 'Warm up');
  assert.deepEqual(planNow().items.map((i) => i.done), [false, false, false, false]);
});

for (let i = 0; i < 6; i++) chat('!pnext', mod);
await settle();
test('finishing the last activity leaves everything done, and more does nothing', () => {
  assert.equal(planNow().currentId, '');
  assert.ok(planNow().items.every((i) => i.done));
});

chat('!pback', mod);
await settle();
test('and going back from the end brings the last one back, not the first', () => {
  assert.equal(current(), 'Viewer games');
  assert.deepEqual(planNow().items.map((i) => i.done), [true, true, true, false]);
});

// --------------------------------------- a text layer, written from chat

const layoutsBefore = engine.store.getLayouts();
engine.store.setLayouts([{
  id: 'lay-msg', name: 'Message test', width: 1920, height: 1080,
  layers: [
    { uid: 'txt-msg', type: 'text', x: 0, y: 0, w: 400, h: 100, config: { text: 'old words', color: '#ff0000', fontSize: 40 } },
    { uid: 'shape-1', type: 'shape', x: 0, y: 0, w: 10, h: 10, config: {} },
  ],
}]);
runCommand('msg', [{ type: 'text_layer_set', config: { layoutId: 'lay-msg', layerUid: 'txt-msg', text: '{user}: {input} ({followers} followers)' } }]);
runCommand('msggone', [{ type: 'text_layer_set', config: { layoutId: 'lay-msg', layerUid: 'txt-deleted', text: '{input}' } }]);
runCommand('msgshape', [{ type: 'text_layer_set', config: { layoutId: 'lay-msg', layerUid: 'shape-1', text: '{input}' } }]);

const msgLayer = () => engine.store.getLayouts().find((l) => l.id === 'lay-msg').layers.find((l) => l.uid === 'txt-msg');

chat('!msg hello chat', mod);
await settle();
test('a mod can write into a text layer, and the layer keeps its look', () => {
  assert.equal(msgLayer().config.text, 'Modzilla: hello chat ({followers} followers)');
  assert.equal(msgLayer().config.color, '#ff0000', 'writing the words reset how the layer looks');
  assert.equal(msgLayer().config.fontSize, 40);
});

test('a value the overlay fills in is left for it, so it stays live', () => {
  assert.ok(msgLayer().config.text.includes('{followers}'), 'the follower count was frozen into the text');
});

chat('!msg sneaky', { user: 'RandomViewer' });
chat('!msggone nothing here', mod);
chat('!msgshape not text', mod);
await settle();
test('a viewer cannot, and a step pointing at a deleted or non-text layer changes nothing', () => {
  assert.equal(msgLayer().config.text, 'Modzilla: hello chat ({followers} followers)');
  const shape = engine.store.getLayouts().find((l) => l.id === 'lay-msg').layers.find((l) => l.uid === 'shape-1');
  assert.ok(!shape.config?.text, 'a shape layer was given text');
});

chat('!msg ' + 'y'.repeat(900), mod);
await settle();
test('a long message is capped the same way a typed one is', () => {
  assert.ok(msgLayer().config.text.length <= 500, `the layer holds ${msgLayer().config.text.length} characters`);
});
engine.store.setLayouts(layoutsBefore);


// ------------------------------------------------------------ stopping the stream

doubles.obsStreaming = true;
doubles.streamStops = 0;
runCommand('buenasnoches', [{ type: 'obs_stop_stream', config: {} }]);
chat('!buenasnoches', mod);
await settle();
const stoppedWhileLive = { stops: doubles.streamStops, streaming: doubles.obsStreaming };
// Said again with the stream already over: asked, and nothing done — not an error that stops the rest.
chat('!buenasnoches', mod);
await settle();
const askedWhenOff = doubles.streamStops;
// And not for a viewer: the command it sits behind is what decides who may end the stream.
chat('!buenasnoches', { user: 'AnyViewer' });
await settle();
const askedByViewer = doubles.streamStops;

test('an action can stop the stream in OBS, and does nothing when there is none', () => {
  assert.deepEqual(stoppedWhileLive, { stops: 1, streaming: false }, 'the stream was not stopped');
  assert.equal(askedWhenOff, 2, 'a second stop did not reach OBS to be asked');
  assert.equal(askedByViewer, 2, 'a viewer ended the stream through a mod-only command');
  // OBS is asked whether it is streaming, rather than the state kept here, before it is told to stop.
  const obsSrc = fs.readFileSync(new URL('../platforms/obs.js', SCRIPT_URL), 'utf8');
  const fn = obsSrc.slice(obsSrc.indexOf('export async function stopStream'), obsSrc.indexOf('export async function setBrowserUrl'));
  assert.ok(fn.indexOf("call('GetStreamStatus')") > 0 && fn.indexOf("call('GetStreamStatus')") < fn.indexOf("call('StopStream')"), 'OBS is told to stop without being asked if it is streaming');
  assert.ok(obsSrc.includes('saveReplayBuffer, stopStream,'), 'actions cannot reach it');
  // Offered with the other OBS steps, saying what it does, in both languages.
  const view = fs.readFileSync(new URL('../../web/components/views/ActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("addActionStep('obs_stop_stream')"), 'the OBS menu does not offer it');
  assert.ok(view.includes("step.type === 'obs_stop_stream' && ("), 'the step has nothing to say for itself');
  const types = fs.readFileSync(new URL('../../web/types.ts', SCRIPT_URL), 'utf8');
  assert.ok(types.includes("| 'obs_stop_stream'"));
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("step.type === 'obs_stop_stream' ? (t.obsStopStreamTitle"), 'the step is titled with its raw type');
  for (const key of ['obsStopStream', 'obsStopStreamTitle', 'obsStopStreamDoes', 'obsStopStreamHint']) {
    assert.equal(strings.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
});
