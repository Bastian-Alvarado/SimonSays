/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: questions from Discord (server/engine/discord-questions.js) —
 * what people post in a chosen channel goes into the Questions dock, marked
 * 📝 in Discord; other channels and commands do not; and once answered on
 * stream, the bot replies to it there, once.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After live-dms.js.
 */

import { assert, bus, normaliseChat, test } from './harness.js';

const dq = await import('../../engine/discord-questions.js');
const questions = await import('../../engine/questions.js');
const { config } = await import('../../config.js');
dq.initDiscordQuestions();

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('discord.com')) return realFetch(url, init);
  calls.push({ method: init.method || 'GET', route: String(url).replace(/^.*\/api\/v10/, ''), body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
  return new Response(JSON.stringify({ id: '1' }), { status: 200 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';

const IDEAS = '700000000000007001';
dq.setDiscordQuestions({ channelIds: [IDEAS] });
const post = (over) => bus.emit('discord:message_elsewhere', normaliseChat({ platform: 'discord', user: 'Cami', userId: '760000000000000099', msg: '¿Vas a jugar Silksong?', ...over }));
post({ raw: { channelId: IDEAS, messageId: '800000000000007001' } });
post({ msg: 'otra cosa', raw: { channelId: '700000000000007002', messageId: '800000000000007002' } });
post({ msg: '!rank', raw: { channelId: IDEAS, messageId: '800000000000007003' } });
await new Promise((r) => setTimeout(r, 400));
const q = questions.getQuestions().items.find((x) => x.discord?.messageId === '800000000000007001');
const others = questions.getQuestions().items.filter((x) => ['otra cosa', '!rank'].includes(x.text));
const marked = calls.find((c) => c.method === 'PUT' && c.route.startsWith(`/channels/${IDEAS}/messages/800000000000007001/reactions/`));

questions.setStatus(q.id, 'approved');
questions.show(q.id);
questions.next();
await new Promise((r) => setTimeout(r, 400));
questions.setStatus(q.id, 'done');
await new Promise((r) => setTimeout(r, 200));
const replies = calls.filter((c) => c.method === 'POST' && c.route === `/channels/${IDEAS}/messages`);
questions.clear();
dq.setDiscordQuestions({ channelIds: [] });
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

test('a post in a chosen Discord channel is a question in the dock, marked there; other channels and commands are not', () => {
  assert.ok(q, 'the question did not reach the dock');
  assert.equal(q.platform, 'discord');
  assert.equal(q.user, 'Cami');
  assert.deepEqual(others, []);
  assert.ok(marked, 'it was not marked in Discord');
});

test('answered on stream, it is answered in Discord — once, as a reply to the question', () => {
  assert.equal(replies.length, 1);
  assert.equal(replies[0].body.message_reference.message_id, '800000000000007001');
  assert.match(replies[0].body.content, /^✅ Respondida en directo/);
  assert.equal(dq.answerText('https://www.twitch.tv/videos/1?t=0h10m00s', 0), '✅ Respondida en directo — [verlo en el VOD](https://www.twitch.tv/videos/1?t=0h10m00s)');
});
