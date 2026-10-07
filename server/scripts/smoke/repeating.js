/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: actions that repeat — "Every few minutes" — only while live,
 * only once chat has said enough, and taking turns.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, doubles, engine, EVENTS, fs, normaliseChat, said, test } from './harness.js';

const repeat = await import('../../engine/repeat.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const MIN = 60_000;

// ---------------------------------------------------------------- through the engine

// Twitch not connected, so OBS says whether the stream is live (core/twitch-live.js).
bus.emit(EVENTS.STATUS, { platform: 'twitch', status: 'disconnected', detail: { main: 'disconnected', bot: 'disconnected', eventsub: 'disconnected' } });
const t0 = Date.now();
const streamingBefore = doubles.obsStreaming;
engine.store.saveAction({
  id: 'act-repeat', name: 'Redes', enabled: true,
  trigger: { id: 'tr-repeat', category: 'system', type: 'timer_interval', config: { minutes: 1, onlyLive: true } },
  actions: [{ id: 's1', type: 'twitch_chat', config: { message: 'Síguenos en las redes' } }],
});
doubles.obsStreaming = false;
const offline = [repeat.tick(t0), repeat.tick(t0 + 5 * MIN)];
doubles.obsStreaming = true;
// Ticks come every 15 seconds: the last one off air was just before it went live.
const firstLive = repeat.tick(t0 + 5 * MIN + 15_000);
const tooSoon = repeat.tick(t0 + 5 * MIN + 45_000);
const ran = repeat.tick(t0 + 6 * MIN);
await new Promise((r) => setTimeout(r, 30));
const saidIt = said.includes('Síguenos en las redes');
engine.store.deleteAction('act-repeat');
doubles.obsStreaming = streamingBefore;

test('an action set to repeat waits for the stream, then comes one interval in, through its own steps', () => {
  assert.deepEqual(offline, [null, null], 'it ran while the stream was off');
  assert.equal(firstLive, null, 'it ran the moment the stream went live, not an interval in');
  assert.equal(tooSoon, null);
  assert.equal(ran, 'act-repeat');
  assert.ok(saidIt, 'its chat step did not run');
});

// ---------------------------------------------------------------- the rules, on their own

repeat.stopRepeat();
let live = true;
const actions = [];
const runs = [];
repeat.initRepeat({ actions: () => actions, isLive: () => live, run: (a) => { runs.push(a.id); }, autoTick: false });
const chat = (n, over = {}) => { for (let i = 0; i < n; i += 1) bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'v', msg: 'hola', ...over })); };
const act = (id, config, enabled = true) => ({ id, name: id, enabled, trigger: { type: 'timer_interval', config } });

actions.push(act('a', { minutes: 10 }), act('b', { minutes: 10 }), act('quiet', { minutes: 5, minChat: 3 }), act('off', { minutes: 1 }, false));
const T = Date.now();
repeat.tick(T);
const takeTurns = [repeat.tick(T + 10 * MIN), repeat.tick(T + 10 * MIN + 15_000), repeat.tick(T + 10 * MIN + 30_000)];
chat(1);
chat(5, { isBot: true });
chat(5, { platform: 'discord' });
const notEnoughChat = repeat.tick(T + 11 * MIN);
chat(2);
const enoughChat = repeat.tick(T + 11 * MIN + 15_000);
live = false;
repeat.tick(T + 30 * MIN);
live = true;
const backLive = [repeat.tick(T + 31 * MIN), repeat.tick(T + 40 * MIN), repeat.tick(T + 40 * MIN + 15_000)];
repeat.stopRepeat();

test('two due at once take turns; chat that counts is the stream\'s, from people; a disabled one never runs', () => {
  // "a" and "b" were due together and went a tick apart; "quiet" was due too but chat had said nothing.
  assert.deepEqual(takeTurns.slice(0, 2).sort(), ['a', 'b']);
  assert.equal(takeTurns[2], null, 'the quiet one ran with no chat since');
  assert.equal(notEnoughChat, null, 'bot lines or Discord counted as chat');
  assert.equal(enoughChat, 'quiet');
  assert.ok(!runs.includes('off'), 'a disabled action repeated');
  // Off air and back: the count starts again, so nothing piles up from while the stream was off.
  assert.equal(backLive[0], null);
  assert.deepEqual(backLive.slice(1).sort(), ['a', 'b']);
});

test('the settings are kept sane, and the screens offer them', () => {
  assert.deepEqual(repeat.cleanRepeat({ minutes: 0, minChat: -4, onlyLive: false }), { minutes: 1, onlyLive: false, minChat: 0 });
  assert.deepEqual(repeat.cleanRepeat({ minutes: '99999' }), { minutes: 1440, onlyLive: true, minChat: 0 });
  assert.deepEqual(repeat.cleanRepeat(undefined), repeat.DEFAULT_REPEAT);
  assert.ok(read('../platforms/obs.js').includes('isStreaming: () => Boolean(obsState.streamStatus?.active),'));
  const view = read('../../web/components/views/ActionsView.tsx');
  assert.ok(view.includes("{ value: 'timer_interval', label: t.triggerRepeat"));
  for (const f of ['minutes', 'minChat', 'onlyLive']) assert.ok(view.includes(`data-repeat-field="${f}"`), f);
});
