/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: going live, told privately (server/engine/live-dms.js) —
 * signing up with a button choosing where one watches, the direct message
 * with that link and a way to stop, one message a stream, and somebody whose
 * messages cannot be delivered three times running taken off the list.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After live-pages.js.
 */

import { assert, bus, collection, EVENTS, normaliseEvent, test } from './harness.js';

const dms = await import('../../engine/live-dms.js');
const sessions = await import('../../engine/stream-sessions.js');
const { config } = await import('../../config.js');
dms.initLiveDms();

const announce = collection('discord_announce', {});
const announceBefore = announce.get();
announce.set({ ...announceBefore, youtubeUrl: 'https://youtube.com/@yo/live', tiktokUrl: 'https://tiktok.com/@yo/live' });

const calls = [];
const closed = new Set(['600000000000000002']);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('discord.com')) return realFetch(url, init);
  const route = String(url).replace(/^.*\/api\/v10/, '');
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  calls.push({ route, body });
  if (route === '/users/@me/channels') {
    if (closed.has(body.recipient_id)) return new Response(JSON.stringify({ message: 'Cannot send messages to this user', code: 50007 }), { status: 403 });
    return new Response(JSON.stringify({ id: `dm-${body.recipient_id}` }), { status: 200 });
  }
  return new Response(JSON.stringify({ id: '1' }), { status: 200 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';

const press = (userId, customId) => dms._test.onInteraction({ id: `i${userId}`, token: 't', type: 3, member: { user: { id: userId, username: `u${userId}` } }, data: { custom_id: customId } });
await press('600000000000000001', 'livedm:on:youtube');
const answer = calls.at(-1).body.data;
await press('600000000000000002', 'livedm:on:twitch');
const signedUp = { ...dms._test.people() };
const post = dms.signUpPost();
const dm = dms.dmFor('youtube', { name: 'Rowan', title: 'Among Us', game: 'Among Us' }, { ...dms.getLiveDms(), message: '🔴 {streamer} en directo: {title} ({platform})' });

// Going live: after its wait, everybody on the list — once.
dms.control({ settings: { enabled: true, delaySec: 0 } });
const before = calls.length;
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_started' }));
// One message a second: two people take two.
await new Promise((r) => setTimeout(r, 2600));
const firstRound = calls.slice(before);
bus.emit('stream:started', sessions.current());
await new Promise((r) => setTimeout(r, 300));
const sentAgain = calls.length - before - firstRound.length;
// Two more streams the closed one cannot be reached on: taken off the list.
await dms.sendAll({}, { wait: 0 });
await dms.sendAll({}, { wait: 0 });
const afterThree = { ...dms._test.people() };
await press('600000000000000001', 'livedm:stop');
const afterStop = { ...dms._test.people() };
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_stopped' }));
await sessions._test.finish();
dms.control({ settings: { enabled: false } });
announce.set(announceBefore);
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

test('viewers sign up with a button, choosing where they watch, and are told so privately', () => {
  assert.deepEqual(Object.entries(signedUp).map(([id, p]) => [id, p.platform]), [['600000000000000001', 'youtube'], ['600000000000000002', 'twitch']]);
  assert.equal(answer.flags, 64);
  assert.match(answer.content, /YouTube/);
  assert.deepEqual(post.components[0].components.map((b) => b.custom_id), ['livedm:on:twitch', 'livedm:on:youtube', 'livedm:on:tiktok', 'livedm:stop'], 'a platform with a link was not offered');
  // Without a link a platform is not offered: TikTok gone, its button goes.
  announce.set({ ...announce.get(), tiktokUrl: '' });
  assert.ok(!dms.signUpPost().components[0].components.some((b) => b.custom_id === 'livedm:on:tiktok'));
  announce.set(announceBefore);
});

test('going live sends each a direct message with their link and a way to stop — once a stream', () => {
  assert.equal(dm.content, '🔴 Rowan en directo: Among Us (YouTube)');
  assert.deepEqual(dm.components[0].components.map((b) => b.url || b.custom_id), ['https://youtube.com/@yo/live', 'livedm:stop']);
  const sent = firstRound.filter((c) => c.route === '/channels/dm-600000000000000001/messages');
  assert.equal(sent.length, 1, 'the open one was not told');
  assert.equal(sent[0].body.components[0].components[0].url, 'https://youtube.com/@yo/live');
  assert.equal(sentAgain, 0, 'told twice for one stream');
});

test('somebody who cannot be reached three times running is taken off; anybody can stop', () => {
  assert.equal(afterThree['600000000000000002'], undefined);
  assert.ok(afterThree['600000000000000001']);
  assert.equal(afterStop['600000000000000001'], undefined);
});
