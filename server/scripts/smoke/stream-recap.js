/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the stream recap — what is kept while the stream runs, the
 * card it makes, and the go-live post turning into it (or a post of its own,
 * or a test in the test channel) when the stream ends.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After discord-posts.js,
 * which set the go-live announcements up.
 */

import { SCRIPT_URL, assert, bus, collection, engine, EVENTS, fs, normaliseChat, normaliseEvent, test } from './harness.js';

const announcer = await import('../../engine/announce.js');
const recap = await import('../../engine/recap.js');
const streamPlan = await import('../../engine/plan.js');
const welcome = await import('../../engine/welcome.js');
const { config } = await import('../../config.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const announceBefore = announcer.getAnnounce();
announcer.setAnnounce({ enabled: false, recap: { enabled: false } });
const event = (type, data = {}, user = 'Viewer') => bus.emit(EVENTS.EVENT, normaliseEvent({ type, platform: type.split('_')[0], user, data }));
const chat = (over) => bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', msg: 'hola', ...over }));
const stat = (key, value) => bus.emit(EVENTS.STAT, { key, value });

// ---------------------------------------------------------------- what the stream keeps

event('obs_stream_started');
for (let i = 0; i < 5; i += 1) chat({ user: 'Ana', userId: 'a1' });
for (let i = 0; i < 3; i += 1) chat({ user: 'Bob', userId: 'b1' });
chat({ user: 'Caro', userId: 'c1', platform: 'youtube' });
chat({ user: 'MiBot', userId: 'bot', isBot: true });
chat({ user: 'Yo', userId: 'me', isBroadcaster: true });
chat({ user: 'Disc', userId: 'd1', platform: 'discord' });
stat('twitchViewers', 10); stat('twitchViewers', 25); stat('twitchViewers', 12); stat('youtubeViewers', 4);
event('twitch_follow'); event('twitch_follow', {}, 'Otro');
event('twitch_cheer', { bits: 100 });
event('twitch_raid', { viewers: 30 });
event('spotify_track_change', {}, 'Song');
event('obs_stream_stopped');
await wait(20);
const kept = recap.getTally();

// Back within five minutes: the same stream. Later than that: a new one.
event('obs_stream_started');
chat({ user: 'Ana', userId: 'a1' });
const resumed = recap.getTally();
event('obs_stream_stopped');
const tallyStore = collection('stream_tally', {});
tallyStore.set({ ...recap.getTally(), endedAt: Date.now() - recap.SAME_STREAM_MS - 1000 });
const keptForLater = recap.getTally();
event('obs_stream_started');
const fresh = recap.getTally();
tallyStore.set({ ...keptForLater });

test('while the stream runs, the recap keeps its length, peaks, what viewers did and who talked', () => {
  assert.ok(kept.startedAt > 0 && kept.endedAt >= kept.startedAt);
  assert.deepEqual(kept.peak, { twitch: 25, youtube: 4 });
  assert.equal(kept.totals.follows, 2);
  assert.equal(kept.totals.bits, 100);
  assert.deepEqual([kept.totals.raids, kept.totals.raiders], [1, 30]);
  const talkers = Object.values(kept.chatters).map((c) => `${c.name}:${c.count}`).sort();
  assert.deepEqual(talkers, ['Ana:5', 'Bob:3', 'Caro:1'], 'the bot, the streamer or Discord was counted, or somebody was missed');
  assert.equal(resumed.endedAt, 0, 'coming straight back started a new stream');
  assert.equal(resumed.chatters['twitch:a1'].count, 6, 'coming back lost what was kept');
  assert.equal(Object.keys(fresh.chatters).length, 0, 'a stream an hour later carried the last one on');
});

// ---------------------------------------------------------------- the card

const card = recap.recapCard(recap.DEFAULT_RECAP, { ...kept, startedAt: 1_000_000, endedAt: 1_000_000 + 3 * 3_600_000 + 12 * 60_000 }, {
  streamer: 'I_Am_Streamer', title: 'Among Us con amigos', game: 'Among Us',
  clips: [{ title: 'Qué jugada', url: 'https://clips.twitch.tv/x', by: 'Ana' }],
  plan: { items: [{ text: 'Among Us', ms: 80 * 60_000 }, { text: 'Preguntas', ms: 20 * 60_000 }] },
  next: { start: '2026-10-05T01:00:00Z', title: 'Noche de terror' },
  image: 'https://thumb', color: '#9146ff',
});
const field = (name) => card.fields.find((f) => f.name === name)?.value;
const allOff = recap.recapCard({ ...recap.DEFAULT_RECAP, parts: Object.fromEntries(recap.RECAP_PARTS.map((k) => [k, false])) }, kept, {});

test('the recap card says how it went, only what happened, in the stream\'s language', () => {
  assert.equal(card.author, 'I_Am_Streamer · Resumen del directo');
  assert.equal(card.description, '**Among Us con amigos**\nAmong Us');
  assert.equal(field('Duración'), '3 h 12 min');
  assert.equal(field('Más viendo a la vez'), 'Twitch 25 · YouTube 4');
  assert.equal(field('Lo que pasó'), '2 follows · 100 bits · 1 raid (30)');
  assert.equal(field('Más activos en el chat'), '1. Ana (5) · 2. Bob (3) · 3. Caro (1)');
  assert.equal(field('Clips'), '[Qué jugada](https://clips.twitch.tv/x) — Ana');
  assert.equal(field('El plan'), '• Among Us — 1 h 20 min\n• Preguntas — 20 min');
  assert.match(field('Próximo directo'), /^<t:\d+:F> \(<t:\d+:R>\)\nNoche de terror$/);
  assert.equal(card.image, 'https://thumb');
  assert.deepEqual(allOff.fields, [{ name: 'Gracias por ver', value: '💜' }], 'a recap with every part off said something, or nothing at all');
  assert.equal(recap.lengthOf(45 * 60_000), '45 min');
  assert.equal(recap.eventsLine({ subs: 1, gifted: 5, superChat: { MX$: 100 } }), '1 sub · 5 subs regaladas · Super Chats MX$100');
});

// ---------------------------------------------------------------- the stream ending

const calls = [];
const realFetch = globalThis.fetch;
let nextId = 900000000000000000n;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  // Twitch, if a test left it signed in, is not asked: no clips, no VOD.
  if (u.includes('api.twitch.tv')) return new Response('{}', { status: 401 });
  if (!u.includes('discord.com')) return realFetch(url, init);
  const path = u.replace(/^.*\/api\/v10/, '');
  const method = init.method || 'GET';
  calls.push({ method, path, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : null });
  if (method === 'POST') { nextId += 1n; return new Response(JSON.stringify({ id: String(nextId) }), { status: 200 }); }
  if (method === 'GET') return new Response(JSON.stringify({ embeds: [{ title: 'Among Us', image: { url: 'https://live-thumb' } }] }), { status: 200 });
  if (method === 'PATCH') return new Response('{}', { status: 200 });
  return new Response(null, { status: 204 });
};
const realToken = config.discord.botToken;
config.discord.botToken = 'test-token';
const greetingsBefore = welcome.getGreetings();
welcome.setGreetings({ ...greetingsBefore, testChannelId: '700000000000000099' });

// Turned into the recap: the go-live post is edited.
announcer.setAnnounce({ channelId: '700000000000000002', overMessage: 'Se acabó', recap: { enabled: true, where: 'edit' } });
collection('discord_announce', {}).set({ ...announcer.getAnnounce(), last: { channelId: '700000000000000002', messageId: '700000000000000500', at: Date.now() } });
const edited = await announcer.postRecap();
const patch = calls.find((c) => c.method === 'PATCH');
const afterEdit = announcer.getAnnounce().last;

// A post of its own: the go-live one is marked over the usual way, and the recap goes beside it.
calls.length = 0;
announcer.setAnnounce({ whenOver: 'delete', recap: { enabled: true, where: 'new' } });
collection('discord_announce', {}).set({ ...announcer.getAnnounce(), last: { channelId: '700000000000000002', messageId: '700000000000000501', at: Date.now() } });
const own = await announcer.postRecap();
const ownCalls = calls.map((c) => `${c.method} ${c.path}`);

// A test: the test channel, and the go-live post left alone.
calls.length = 0;
collection('discord_announce', {}).set({ ...announcer.getAnnounce(), last: { channelId: '700000000000000002', messageId: '700000000000000502', at: Date.now() } });
const tested = await announcer.postRecap({ test: true });
const testCalls = calls.map((c) => `${c.method} ${c.path}`);
const lastAfterTest = announcer.getAnnounce().last;

// With the recap on, the stream ending waits for it rather than marking the post over at once.
calls.length = 0;
announcer.setAnnounce({ whenOver: 'edit', recap: { enabled: true, where: 'edit' } });
await announcer.streamOver();
const atOnce = calls.length;
announcer.stopAnnounce();

globalThis.fetch = realFetch;
config.discord.botToken = realToken;
welcome.setGreetings(greetingsBefore);

test('when the stream ends, the go-live post turns into the recap — or one is posted beside it, or a test in the test channel', () => {
  assert.equal(edited.edited, true);
  assert.equal(patch?.path, '/channels/700000000000000002/messages/700000000000000500');
  assert.equal(patch.body.content, 'Se acabó');
  const embed = patch.body.embeds[0];
  assert.equal(embed.author.name, 'Resumen del directo');
  assert.equal(embed.image.url, 'https://live-thumb', 'the stream\'s picture was lost from the card');
  assert.ok(embed.fields.some((f) => f.name === 'Más activos en el chat'));
  assert.deepEqual(patch.body.components, [], 'the watch buttons stayed on a stream that is over');
  assert.deepEqual(patch.body.allowed_mentions, { parse: [] }, 'the recap could ping');
  assert.equal(afterEdit, null);
  assert.equal(own.edited, false);
  assert.ok(ownCalls.includes('DELETE /channels/700000000000000002/messages/700000000000000501'), 'the go-live post was not taken down as set');
  assert.ok(ownCalls.includes('POST /channels/700000000000000002/messages'), 'the recap was not posted');
  assert.equal(tested.channelId, '700000000000000099');
  assert.deepEqual(testCalls, ['POST /channels/700000000000000099/messages'], 'the test touched the go-live post');
  assert.equal(lastAfterTest?.messageId, '700000000000000502');
  assert.equal(atOnce, 0, 'the recap did not wait for the last clips');
  assert.equal(announcer.RECAP_DELAY_MS, 60_000);
});

// ---------------------------------------------------------------- the plan says it once

const planBefore = streamPlan.getPlan();
engine.store.setPlan({ ...planBefore, items: [{ id: 'p1', text: 'Among Us', startedAt: Date.now() - 60_000 }], currentId: 'p1', recapToDiscord: true });
const planPosts = [];
const deps = (has) => ({ announceChannel: () => '700000000000000002', recapHasPlan: () => has, discord: { sendMessage: async (...a) => { planPosts.push(a); }, sanitise: (s) => s } });
await streamPlan.streamEnded(deps(true));
const withRecap = planPosts.length;
await streamPlan.streamEnded(deps(false));
const withoutRecap = planPosts.length - withRecap;
engine.store.setPlan(planBefore);
announcer.setAnnounce({ ...announceBefore, recap: announceBefore.recap || recap.DEFAULT_RECAP });
collection('discord_announce', {}).set({ ...announcer.getAnnounce(), last: announceBefore.last ?? null });

test('the recap\'s plan is tonight\'s steps, not ones started on another night', () => {
  const start = Date.parse('2026-10-03T01:00:00Z');
  const plan = { items: [
    { id: 'a', text: 'Ayer', startedAt: start - 86_400_000, doneAt: start - 80_000_000 },
    { id: 'b', text: 'Justo antes', startedAt: start - 30_000, doneAt: start + 600_000 },
    { id: 'c', text: 'Hoy', startedAt: start + 600_000 },
    { id: 'd', text: 'Sin empezar' },
  ] };
  assert.deepEqual(announcer.tonightsPlan(plan, start).items.map((i) => i.id), ['b', 'c']);
  assert.equal(announcer.tonightsPlan(plan, 0), plan, 'a test with no stream kept lost the plan');
  assert.ok(read('../engine/announce.js').includes('plan: recapOf(tonightsPlan(getPlan(), t.startedAt), t.endedAt || now),'));
});

test('with the plan in the recap, the Stream plan screen does not post it a second time', () => {
  assert.equal(withRecap, 0, 'the plan posted its own recap beside the stream recap');
  assert.equal(withoutRecap, 1);
  assert.ok(read('../engine/index.js').includes("recapHasPlan: () => Boolean(getAnnounce().recap?.enabled && getAnnounce().recap?.parts?.plan !== false),"));
});

test('the Go live screen sets the recap up and tests it; the tally stays out of backups', () => {
  const view = read('../../web/components/views/GoLiveView.tsx');
  for (const key of recap.RECAP_PARTS) assert.ok(view.includes(`['${key}', t.recapPart`), key);
  assert.ok(view.includes('data-recap-toggle') && view.includes('data-recap-test'));
  assert.ok(read('../api/ws.js').includes("if (payload?.op === 'test_recap') return reply(await announcer.postRecap({ test: true }));"));
  assert.ok(/EXCLUDED = \[[^\]]*'stream_tally'/.test(read('../engine/backup.js')));
  assert.deepEqual(announcer.cleanAnnounce({ recap: { where: 'sideways', chatters: 40, parts: { clips: false } } }).recap, {
    enabled: false, where: 'edit', title: 'Resumen del directo', chatters: 10,
    parts: { length: true, peak: true, events: true, chatters: true, clips: false, plan: true, chapters: true, next: true },
  });
});
