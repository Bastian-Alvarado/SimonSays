/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Commands and chat: permissions, cooldowns, branches, random lines, dock buttons, the chat tail.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, assert, bus, chat, engine, normaliseChat, normaliseEvent, posted, said, scenes, settle, spoken, test } from './harness.js';

// ------------------------------------------------------------------- runs

console.log('\nheadless engine smoke test\n');

said.length = 0;
chat('!hello world');
await settle();
test('command fires and interpolates variables', () => {
  assert.ok(said.includes('Hi Viewer! You said: world'), `got ${JSON.stringify(said)}`);
});
test('condition takes the else branch for a plain viewer', () => {
  assert.ok(said.includes('viewer-branch'), `got ${JSON.stringify(said)}`);
});
test('{message} excludes the trigger word', () => {
  assert.ok(said.includes('Viewer dice world'), `expected "Viewer dice world", got ${JSON.stringify(said)}`);
  assert.ok(!said.some((s) => s.includes('!hello')), `trigger leaked into output: ${JSON.stringify(said)}`);
});

said.length = 0;
chat('!hello', { user: 'Modzilla', isMod: true });
await settle();
test('condition takes the then branch for a mod', () => {
  assert.ok(said.includes('mod-branch'), `got ${JSON.stringify(said)}`);
});

said.length = 0;
chat('!subonly');
await settle();
test('permissions block a non-subscriber', () => {
  assert.equal(said.length, 0, `expected silence, got ${JSON.stringify(said)}`);
});

said.length = 0;
chat('!subonly', { user: 'Subby', isSub: true });
await settle();
test('permissions allow a subscriber', () => {
  assert.deepEqual(said, ['secret']);
});

said.length = 0;
chat('!cool');
await settle();
chat('!cool');
await settle();
test('global cooldown suppresses the second call', () => {
  assert.equal(said.length, 1, `expected 1 call, got ${said.length}`);
});

said.length = 0;
chat('!nosuchcommand');
await settle();
test('unknown trigger does nothing', () => {
  assert.equal(said.length, 0);
});

scenes.length = 0;
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'twitch_raid', platform: 'twitch', user: 'Raider', data: { viewers: 20, amount: 20 } }));
await settle();
test('event triggers an OBS scene change', () => {
  assert.deepEqual(scenes, ['RaidScene']);
});
test('raid updates the latest-raid tag', () => {
  assert.equal(engine.snapshot().streamTags.latestRaid?.user, 'Raider');
});
test('event is recorded in history', () => {
  assert.equal(engine.snapshot().eventHistory[0]?.type, 'twitch_raid');
});

said.length = 0;
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'twitch_cheer', platform: 'twitch', user: 'Cheap', data: { bits: 50, amount: 50 } }));
await settle();
test('minBits filter rejects a small cheer', () => {
  assert.equal(said.length, 0, `got ${JSON.stringify(said)}`);
});

said.length = 0;
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'twitch_cheer', platform: 'twitch', user: 'Whale', data: { bits: 500, amount: 500 } }));
await settle();
test('minBits filter accepts a large cheer', () => {
  assert.deepEqual(said, ['big cheer']);
});
test('top donation tracks the largest cheer', () => {
  assert.equal(engine.snapshot().streamTags.topDonation?.amount, 500);
});

test('self-referential action does not recurse forever', () => {
  // If the cycle guard were missing this would throw RangeError.
  assert.doesNotReject(() => engine.testAction('act-loop'));
});

// ------------------------------------------------------- random message line

engine.store.saveCommand({
  id: 'cmd-random',
  name: 'Random',
  triggers: ['!random'],
  enabled: true,
  permissions: { anyone: true },
  globalCooldown: 0,
  userCooldown: 0,
});

const RANDOM_LINES = ['first option', 'second option', 'third option'];
engine.store.saveAction({
  id: 'act-random',
  name: 'Random reply',
  enabled: true,
  trigger: { id: 't-rand', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-random' } },
  actions: [{ id: 's-rand', type: 'twitch_chat', config: { message: RANDOM_LINES.join('\n') } }],
});

said.length = 0;
for (let i = 0; i < 30; i += 1) {
  chat('!random');
  await settle();
}

test('a multi-line message sends one line, never the whole box', () => {
  assert.equal(said.length, 30, `expected 30 sends, got ${said.length}`);
  for (const line of said) {
    assert.ok(RANDOM_LINES.includes(line), `sent something that was not one of the options: ${JSON.stringify(line)}`);
  }
});

test('the line actually varies between runs', () => {
  // Three options over thirty runs: all-identical has probability 3 * (1/3)^30,
  // which is about 1e-14. A failure here means the pick is not random.
  assert.ok(new Set(said).size > 1, `every run picked the same line: ${said[0]}`);
});

said.length = 0;
engine.store.saveAction({
  id: 'act-random',
  name: 'Random reply',
  enabled: true,
  trigger: { id: 't-rand', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-random' } },
  actions: [{ id: 's-rand', type: 'twitch_chat', config: { message: 'only one line, {user}' } }],
});
chat('!random');
await settle();
test('a single-line message is untouched', () => {
  assert.deepEqual(said, ['only one line, Viewer']);
});

// The same treatment applies to every step whose editor is a textarea, so the
// behaviour cannot be true of Twitch chat but quietly false of the other two.
const TTS_LINES = ['read this one', 'or read this one'];
said.length = 0;
spoken.length = 0;
engine.store.saveAction({
  id: 'act-random',
  name: 'Random TTS',
  enabled: true,
  trigger: { id: 't-rand', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-random' } },
  actions: [{ id: 's-rand', type: 'browser_tts', config: { ttsText: TTS_LINES.join('\n') } }],
});
for (let i = 0; i < 20; i += 1) {
  chat('!random');
  await settle();
}
test('TTS picks one line, never the whole box', () => {
  assert.equal(spoken.length, 20, `expected 20 utterances, got ${spoken.length}`);
  for (const line of spoken) assert.ok(TTS_LINES.includes(line), `spoke something unexpected: ${JSON.stringify(line)}`);
  assert.ok(new Set(spoken).size > 1, 'every TTS run picked the same line');
});

const HOOK_LINES = ['webhook one', 'webhook two'];
posted.length = 0;
engine.store.saveAction({
  id: 'act-random',
  name: 'Random webhook',
  enabled: true,
  trigger: { id: 't-rand', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-random' } },
  actions: [{
    id: 's-rand',
    type: 'discord_webhook',
    config: { webhookUrl: 'https://discord.com/api/webhooks/1/x', message: HOOK_LINES.join('\n') },
  }],
});
for (let i = 0; i < 20; i += 1) {
  chat('!random');
  await settle();
}
test('the Discord webhook picks one line, never the whole box', () => {
  assert.equal(posted.length, 20, `expected 20 posts, got ${posted.length}`);
  for (const line of posted) assert.ok(HOOK_LINES.includes(line), `posted something unexpected: ${JSON.stringify(line)}`);
  assert.ok(new Set(posted).size > 1, 'every webhook run picked the same line');
});

// ------------------------------------------------------------- dock actions

engine.store.saveAction({
  id: 'act-dock',
  name: 'Dock target',
  enabled: true,
  trigger: { id: 't-dock', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [{ id: 's-dock', type: 'twitch_chat', config: { message: '{user} pressed it' } }],
});

said.length = 0;
await engine.runDockAction('act-dock');
test('a button press runs as "Dock Actions", not TestUser', () => {
  assert.deepEqual(said, ['Dock Actions pressed it']);
});

said.length = 0;
await engine.testAction('act-dock');
test('the Test button still runs as TestUser', () => {
  assert.deepEqual(said, ['TestUser pressed it']);
});

// The rejection is captured before asserting on it: `test` is synchronous, so
// handing it an async function would mark the case passed before the promise
// settled and turn a real failure into an unhandled rejection.
let missingErr = null;
try { await engine.runDockAction('act-nope'); } catch (err) { missingErr = err; }
test('pressing a button for a missing action reports it', () => {
  assert.match(missingErr?.message ?? '(did not throw)', /no action with id/);
});

engine.store.saveAction({
  id: 'act-dock-off',
  name: 'Disabled target',
  enabled: false,
  trigger: { id: 't-off', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [{ id: 's-off', type: 'twitch_chat', config: { message: 'should not fire' } }],
});
said.length = 0;
let disabledErr = null;
try { await engine.runDockAction('act-dock-off'); } catch (err) { disabledErr = err; }
test('a disabled action refuses rather than silently doing nothing', () => {
  assert.match(disabledErr?.message ?? '(did not throw)', /disabled/);
  assert.deepEqual(said, []);
});

engine.store.setDockButtons([
  { actionId: 'act-dock', label: 'Press me' },
  { actionId: 'act-ghost', label: 'Points nowhere' },
]);
test('buttons pointing at a missing action are dropped on save', () => {
  const saved = engine.store.getDockButtons();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].actionId, 'act-dock');
  assert.ok(saved[0].id, 'button was not given an id');
});

// Button styling is interpolated into inline styles and img sources on every
// surface, so what survives a save matters.
engine.store.setDockButtons([{
  actionId: 'act-dock',
  label: 'Styled',
  color: '#1DB954',
  icon: '🎬',
  image: '/media/bg.png',
}]);
test('valid styling is kept', () => {
  const b = engine.store.getDockButtons()[0];
  assert.equal(b.color, '#1DB954');
  assert.equal(b.icon, '🎬');
  assert.equal(b.image, '/media/bg.png');
});

engine.store.setDockButtons([{
  actionId: 'act-dock',
  color: 'red; background: url(javascript:alert(1))',
  icon: 'a'.repeat(500),
  image: 'javascript:alert(1)',
}]);
test('styling that is not a plain hex colour, a short icon or a real image path is dropped', () => {
  const b = engine.store.getDockButtons()[0];
  assert.equal(b.color, '', 'a non-hex colour reached an inline style');
  assert.equal(b.icon.length, 4, `icon was not bounded: ${b.icon.length} chars`);
  assert.equal(b.image, '', 'a javascript: URL survived as an image source');
});

engine.store.setDockButtons([{ actionId: 'act-dock', image: 'https://example.com/a.png' }]);
test('a remote https image is allowed', () => {
  assert.equal(engine.store.getDockButtons()[0].image, 'https://example.com/a.png');
});

engine.store.deleteAction('act-dock');
test('deleting an action removes its button too', () => {
  assert.deepEqual(engine.store.getDockButtons(), []);
});

// ------------------------------------------------- recent chat (seed tail)

for (let i = 1; i <= 25; i += 1) {
  bus.emit(EVENTS.CHAT, normaliseChat({
    platform: 'twitch', user: `Seed${i}`, userId: `seed-${i}`, msg: `line ${i}`,
    raw: { 'a-large-tag-blob': 'x'.repeat(200) },
  }));
}
await settle();

test('the saved chat tail is capped and newest first', () => {
  const tail = engine.snapshot().recentChat;
  assert.equal(tail.length, 20, `tail held ${tail.length} messages`);
  assert.equal(tail[0].user, 'Seed25');
  assert.equal(tail.at(-1).user, 'Seed6');
});

test('the platform tag blob is not written to disk with it', () => {
  assert.ok(!('raw' in engine.snapshot().recentChat[0]), '`raw` was persisted');
});

const doomed = engine.snapshot().recentChat[0].id;
bus.emit(EVENTS.CHAT_DELETE, { platform: 'twitch', msgIds: [doomed], userIds: [] });
await settle();
test('a deleted message drops out of the tail', () => {
  const tail = engine.snapshot().recentChat;
  assert.ok(!tail.some((m) => m.id === doomed), 'a deleted message would come back on restart');
});

bus.emit(EVENTS.CHAT_DELETE, { platform: 'twitch', msgIds: [], userIds: ['seed-24'] });
await settle();
test('a banned user drops out of the tail', () => {
  const tail = engine.snapshot().recentChat;
  assert.ok(!tail.some((m) => m.userId === 'seed-24'), 'a banned viewer would come back on restart');
});

