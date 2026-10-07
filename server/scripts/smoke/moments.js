/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: highlights (server/engine/highlights.js) — chat on every
 * platform counted together, a minute at several times the usual pace being
 * a moment, kept with the stream and posted in Discord with what chat said —
 * and chapters (server/engine/stream-sessions.js): the plan's steps, the
 * games and the moments at their times in the VOD, in the recap and on the
 * Streams screen.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After loyalty-roles.js.
 */

import { assert, bus, collection, EVENTS, fs, normaliseEvent, SCRIPT_URL, test } from './harness.js';

const highlights = await import('../../engine/highlights.js');
const sessions = await import('../../engine/stream-sessions.js');
const recap = await import('../../engine/recap.js');
const { config } = await import('../../config.js');
highlights.initHighlights();
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');

// ---------------------------------------------------------------- is it a moment?

const busy = highlights.judge(40, [10, 10, 10, 10], { minMessages: 15, factor: 3 });
const notBusy = highlights.judge(25, [10, 10, 10, 10], { minMessages: 15, factor: 3 });
const early = highlights.judge(15, [2], { minMessages: 15, factor: 3 });
const quiet = highlights.judge(14, [], { minMessages: 15, factor: 3 });
const quotes = highlights.quotesFrom([
  { user: 'Ana', platform: 'twitch', msg: 'a' }, { user: 'Beto', platform: 'tiktok', msg: 'b' },
  { user: 'Ana', platform: 'twitch', msg: 'c' }, { user: 'Caro', platform: 'youtube', msg: 'd' },
], 2);
const post = highlights.momentPost({ count: 42, ratio: 3.5, quotes, song: 'Canción — Artista', step: 'Among Us', clipUrl: 'https://clips.twitch.tv/x', vodUrl: 'https://www.twitch.tv/videos/1?t=0h10m00s' });

test('a moment is a minute at several times the usual pace, and never fewer than the least', () => {
  assert.deepEqual([busy.moment, busy.needed, busy.ratio], [true, 30, 4]);
  assert.equal(notBusy.moment, false);
  assert.equal(early.moment, true, 'the first minutes of a stream had no way to be a moment');
  assert.equal(quiet.moment, false);
  assert.deepEqual(quotes.map((q) => q.msg), ['c', 'd'], 'quotes are not the latest, one each');
  assert.equal(post.embed.title, '🔥 Momento del directo');
  assert.equal(post.embed.fields[0].value, '42 mensajes en un minuto (x3.5)');
  assert.deepEqual(post.components[0].components.map((b) => b.label), ['Ver el clip', 'Ver en el VOD']);
});

// ---------------------------------------------------------------- a moment, live

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('discord.com')) return realFetch(url, init);
  calls.push({ route: String(url).replace(/^.*\/api\/v10/, ''), body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
  return new Response(JSON.stringify({ id: '1' }), { status: 200 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';
const greetings = collection('welcome_goodbye', {});
const greetingsBefore = greetings.get();
greetings.set({ ...greetingsBefore, testChannelId: '700000000000000999' });
highlights._test.reset();
highlights.setHighlights({ enabled: true, channelId: '700000000000000123', marker: false, clip: false, quotes: 2 });
const triggered = [];
bus.on(EVENTS.TRIGGER, (e) => { if (e?.type === 'chat_highlight') triggered.push(e); });

bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_started' }));
const s = sessions.current();
const at = s.startedAt + 6 * 60_000;
for (let i = 0; i < 20; i += 1) highlights._test.onChat({ platform: i % 2 ? 'twitch' : 'tiktok', user: `P${i % 5}`, msg: 'JAJAJA', userId: `u${i}` }, at - 30_000 + i * 1000);
highlights._test.onChat({ platform: 'twitch', user: 'X', msg: '!canjear tts', userId: 'x' }, at - 1000);
const fired = await highlights.check(at);
const again = await highlights.check(at + 5000);
const posted = calls.find((c) => c.route === '/channels/700000000000000123/messages');
const tested = await highlights.control({ op: 'test' });
const testPost = calls.find((c) => c.route === '/channels/700000000000000999/messages');
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_stopped' }));
await sessions._test.finish();
const kept = sessions.finished().at(-1);
highlights.setHighlights({ enabled: false, channelId: '' });
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;
greetings.set(greetingsBefore);

test('a moment while live is kept with the stream, set off for actions, and posted with what chat said', () => {
  assert.equal(fired?.moment, true);
  assert.equal(again, null, 'a second moment came inside the wait between them');
  assert.ok(posted, 'nothing was posted');
  assert.equal(posted.body.embeds[0].fields[0].value, '20 mensajes en un minuto', 'a command was counted as chat');
  assert.equal(posted.body.embeds[0].description.split('\n').length, 4, 'not two quotes');
  assert.deepEqual(posted.body.allowed_mentions, { parse: [] });
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0].data.count, 20);
  assert.ok(kept.moments.some((m) => m.kind === 'highlight' && m.text === '20 msgs/min'));
  assert.equal(tested.channelId, '700000000000000999');
  assert.ok(testPost, 'the test went somewhere else');
});

// ---------------------------------------------------------------- chapters

const T = Date.UTC(2026, 9, 3, 20, 0, 0);
const night = {
  startedAt: T, endedAt: T + 3 * 3_600_000, vod: { url: 'https://www.twitch.tv/videos/9', createdAt: new Date(T - 30_000).toISOString() },
  plan: [{ text: 'Charla', startedAt: T + 5_000 }, { text: 'Among Us', startedAt: T + 10 * 60_000 }],
  channel: [{ at: T + 10 * 60_000 + 4_000, game: 'Among Us' }, { at: T + 95 * 60_000, game: 'Minecraft' }],
  moments: [{ kind: 'highlight', at: T + 70 * 60_000, text: '42 msgs/min' }, { kind: 'clip', at: T + 71 * 60_000 }],
};
const chapters = sessions.chaptersOf(night);
const card = recap.recapCard({ ...recap.DEFAULT_RECAP }, { startedAt: T, endedAt: T + 3_600_000, peak: {}, chatters: {}, totals: {} }, { chapters: sessions.chaptersText(night) });
const list = sessions.listed();
const one = sessions.details(kept.id);

test('chapters: the plan, the games and the moments at their times in the VOD, first at 00:00', () => {
  assert.deepEqual(chapters.map((c) => `${c.time} ${c.title}`), ['00:00 Inicio', '10:30 Among Us', '1:10:30 🔥 42 msgs/min', '1:35:30 Minecraft']);
  assert.equal(sessions.chapterTime(3_723_000), '1:02:03');
  const field = card.fields.find((f) => f.name === 'Capítulos');
  assert.ok(field?.value.startsWith('```\n00:00 Inicio'), 'the recap has no chapters');
});

test('the Streams screen: every stream listed, one in full with its chapters, moments and who came', () => {
  assert.ok(list.some((x) => x.id === kept.id));
  assert.equal(one.id, kept.id);
  assert.ok(Array.isArray(one.chapters) && one.chapters[0].time === '00:00');
  assert.ok(one.moments.some((m) => m.kind === 'highlight'));
  assert.ok(Array.isArray(one.perMinute) && Array.isArray(one.people));
  assert.ok(read('../../web/App.tsx').includes("view === 'streams'"));
  assert.ok(read('../../web/components/views/GoLiveView.tsx').includes('data-highlights-toggle'));
});
