/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: game requests (server/engine/game-requests.js) — a post in
 * the requests channel is a request with 👍 under it, votes are counted, one
 * goes into the plan, and when its step starts the one who asked is told in
 * Discord and given points; the channel's older requests are read in with
 * their votes, and the ranking says who leads.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After discord-questions.js.
 */

import { assert, bus, normaliseChat, test } from './harness.js';

const requests = await import('../../engine/game-requests.js');
const plan = await import('../../engine/plan.js');
const points = await import('../../engine/points.js');
const leveling = await import('../../leveling/index.js');
const { config } = await import('../../config.js');
requests.initGameRequests();

const CH = '700000000000008001';
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('discord.com')) return realFetch(url, init);
  const route = String(url).replace(/^.*\/api\/v10/, '');
  const method = init.method || 'GET';
  calls.push({ method, route, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
  if (method === 'GET' && route.startsWith(`/channels/${CH}/messages?`)) {
    return new Response(JSON.stringify([
      { id: '810000000000000002', type: 0, content: 'Hollow Knight', author: { id: '770000000000000202', username: 'beto' }, reactions: [{ emoji: { name: '👍' }, count: 4, me: true }] },
      { id: '810000000000000003', type: 0, content: 'hola', author: { id: '1', username: 'bot', bot: true } },
    ]), { status: 200 });
  }
  return new Response(JSON.stringify({ id: '1' }), { status: 200 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';

requests.control({ op: 'settings', settings: { channelId: CH, playedPoints: 150, tell: true } });
const post = (over) => bus.emit('discord:message_elsewhere', normaliseChat({ platform: 'discord', user: 'Ana', userId: '770000000000000201', msg: 'Silksong', ...over }));
post({ raw: { channelId: CH, messageId: '810000000000000001' } });
post({ msg: '!top', raw: { channelId: CH, messageId: '810000000000000009' } });
post({ msg: 'otra cosa', raw: { channelId: '700000000000008002', messageId: '810000000000000008' } });
await new Promise((r) => setTimeout(r, 300));
const voteButton = calls.find((c) => c.method === 'PUT' && c.route.startsWith(`/channels/${CH}/messages/810000000000000001/reactions/`));
for (const who of ['a', 'b']) bus.emit('discord:reaction_add', { message_id: '810000000000000001', emoji: { name: '👍' }, user_id: who });
bus.emit('discord:reaction_add', { message_id: '810000000000000001', emoji: { name: '🔥' }, user_id: 'c' });
bus.emit('discord:reaction_remove', { message_id: '810000000000000001', emoji: { name: '👍' }, user_id: 'b' });
const afterVotes = requests.board().find((r) => r.id === '810000000000000001');

const read = await requests.readChannel();
const hollow = requests.board().find((r) => r.id === '810000000000000002');
const ranking = requests.rankingMessage();

// Into the plan, as the next thing; then the plan gets to it.
const planBefore = plan.getPlan();
await requests.control({ op: 'plan', id: '810000000000000001', where: 'next' });
const planned = requests.board().find((r) => r.id === '810000000000000001');
const stepAdded = plan.getPlan().items.find((i) => i.id === planned.planItemId);
plan.goto(planned.planItemId);
await new Promise((r) => setTimeout(r, 300));
const playedOne = requests.board().find((r) => r.id === '810000000000000001');
const told = calls.find((c) => c.method === 'POST' && c.route === `/channels/${CH}/messages` && /se está jugando/.test(c.body?.content || ''));
const anaPoints = points.balanceOf(leveling.getAccounts()['discord:770000000000000201']);

plan.setPlan(planBefore);
requests.control({ op: 'settings', settings: { channelId: '' } });
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

test('a post in the requests channel is a request with a vote button; votes are counted, other reactions are not', () => {
  assert.ok(voteButton, 'no 👍 under the request');
  assert.equal(afterVotes.votes, 1);
  assert.equal(afterVotes.user, 'Ana');
  assert.ok(!requests.board().some((r) => r.text === '!top' || r.text === 'otra cosa'));
});

test('older requests are read in with their votes (the bot\'s own 👍 aside), and the ranking leads with the most voted', () => {
  assert.equal(read.read, 1, 'a bot\'s message was read as a request');
  assert.equal(hollow.votes, 3);
  assert.match(ranking.description.split('\n')[0], /Hollow Knight — 👍 3/);
});

test('a request goes into the plan, and when its step starts the one who asked is told and given points', () => {
  assert.equal(planned.status, 'planned');
  assert.equal(stepAdded?.text, 'Silksong');
  assert.equal(stepAdded?.note, 'Pedido por Ana');
  assert.equal(playedOne.status, 'played');
  assert.ok(told, 'they were not told');
  assert.deepEqual(told.body.allowed_mentions, { users: ['770000000000000201'] });
  assert.equal(told.body.message_reference.message_id, '810000000000000001');
  assert.ok(anaPoints >= 150, `no points for the request: ${anaPoints}`);
});
