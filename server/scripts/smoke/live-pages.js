/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: live Discord pages — {names} filled in from the stream as the
 * overlays see it and the page's own (live or not, since when, the next
 * stream in each reader's time), a line whose names are all empty left out,
 * and a page set to stay up to date edited in place when what it shows
 * changes — only then, and not too often.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After moments.js.
 */

import { assert, bus, EVENTS, normaliseEvent, test } from './harness.js';

const pages = await import('../../engine/discord-pages.js');
const shared = await import('../../../shared/discord-pages.js');
const sessions = await import('../../engine/stream-sessions.js');
const { config } = await import('../../config.js');

const words = shared.fillWords('Viendo: {viewers}\n👀 {viewersAll} viendo\n{nope}\n🎵 {nowPlaying}', { stats: { twitchViewers: 12 } }, { viewersAll: '' });

test('a page\'s {names} are filled in, a line with only empty ones goes, an unknown one stays to be seen', () => {
  assert.equal(words, 'Viendo: 12\n{nope}');
  assert.equal(shared.PAGE_VAR_NAMES.has('live') && shared.PAGE_VAR_NAMES.has('nowPlaying'), true);
});

// ---------------------------------------------------------------- a live status page

const calls = [];
const realFetch = globalThis.fetch;
let n = 500;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('discord.com')) return realFetch(url, init);
  const route = String(url).replace(/^.*\/api\/v10/, '');
  const method = init.method || 'GET';
  calls.push({ method, route, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
  return new Response(JSON.stringify({ id: String(n += 1) }), { status: 200 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';

const status = pages.savePage({
  name: 'Estado', channelId: '700000000000000300', style: 'classic', live: true,
  blocks: [{ ...shared.LIVE_STATUS_CARD, id: 'b-status' }, { id: 'b-text', type: 'text', text: 'Bienvenidos' }],
});
const quiet = pages.savePage({ name: 'Quieta', channelId: '700000000000000301', blocks: [{ id: 'b-q', type: 'text', text: '{live}' }] });
await pages.postPage(status.id);
await pages.postPage(quiet.id);
const offline = calls.filter((c) => c.method === 'POST')[0].body.embeds[0];

let t0 = Date.now() + 60_000;
const nothing = await pages.refreshLive(t0);
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_started' }));
bus.emit(EVENTS.CHANNEL, { title: 'Jugando', categoryName: 'Among Us' });
const before = calls.length;
const wentLive = await pages.refreshLive(t0 += 60_000);
const liveEdit = calls.slice(before).filter((c) => c.method === 'PATCH');
const tooSoon = await pages.refreshLive(t0 + 5_000);
bus.emit(EVENTS.CHANNEL, { title: 'Jugando', categoryName: 'Minecraft' });
const newGame = await pages.refreshLive(t0 += 60_000);
const gameEdit = calls.filter((c) => c.method === 'PATCH').at(-1);
const unchanged = await pages.refreshLive(t0 += 60_000);
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_stopped' }));
await sessions._test.finish();
for (const p of [status, quiet]) pages.removePage(p.id);
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

test('a live status page is posted filled in, and kept up to date in place — only what changed, not too often', () => {
  assert.equal(offline.title, '⚫ Fuera de directo');
  assert.ok(!/viendo|\{/.test(offline.description || ''), `offline lines stayed: ${offline.description}`);
  assert.equal(nothing, 0, 'a page was edited with nothing changed');
  assert.equal(wentLive, 1, 'going live did not bring it up to date, or the quiet page was touched');
  assert.equal(liveEdit.length, 1);
  assert.equal(liveEdit[0].route.startsWith('/channels/700000000000000300/messages/'), true);
  assert.equal(liveEdit[0].body.embeds[0].title, '🔴 **En directo**');
  assert.match(liveEdit[0].body.embeds[0].description, /<t:\d+:R>/);
  assert.equal(tooSoon, 0, 'edited again within half a minute');
  assert.equal(newGame, 1);
  assert.match(gameEdit.body.embeds[0].description, /Minecraft/);
  assert.equal(unchanged, 0);
});
