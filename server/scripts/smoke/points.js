/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: points (server/engine/points.js) — a currency apart from XP,
 * earned for talking, coming to streams and giving, and spent in the shop on
 * rewards that run one of the streamer's actions: from any chat by number or
 * name, with words when a reward wants them, or from the shop's buttons in
 * Discord (a box asks for the words). Each reason a reward cannot be had,
 * points coming back when its action fails, a moderator giving points, and
 * two people's points adding up when they are linked.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After history-and-streams.js.
 */

import { assert, bus, engine, EVENTS, normaliseChat, normaliseEvent, said, test } from './harness.js';

const points = await import('../../engine/points.js');
const sessions = await import('../../engine/stream-sessions.js');
const leveling = await import('../../leveling/index.js');
const { config } = await import('../../config.js');
points.initPoints({ engine });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const chat = (over) => bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'AnaP', userId: 'p-ana', msg: 'hola', ...over }));
const uidOf = (key) => leveling.getAccounts()[key];
const redeemed = [];
bus.on(EVENTS.EVENT, (e) => { if (e?.type === 'points_redeem') redeemed.push(e); });

engine.store.saveAction({
  id: 'act-points', name: 'Recompensa', enabled: true,
  trigger: { id: 'tr-p', category: 'system', type: 'points_redeem', config: {} },
  actions: [{ id: 's1', type: 'twitch_chat', config: { message: '{user} canjeó: {message}', sendTo: 'twitch' } }],
});
engine.store.saveAction({ id: 'act-off', name: 'Apagada', enabled: false, trigger: { id: 'tr-o', category: 'system', type: 'points_redeem', config: {} }, actions: [] });
points.setPoints({
  shop: [
    { id: 'tts', name: 'TTS', cost: 100, actionId: 'act-points', input: 'required' },
    { id: 'sound', name: 'Sonido fuerte', cost: 50, actionId: 'act-points', cooldownSec: 60 },
    { id: 'broken', name: 'Roto', cost: 10, actionId: 'act-off' },
    { id: 'once', name: 'Una vez', cost: 1, actionId: 'act-points', perStream: 1 },
  ],
});

// ---------------------------------------------------------------- earning

bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_started' }));
chat({});
chat({ msg: 'otra vez' });
const afterTalking = points.balanceOf(uidOf('twitch:p-ana'));
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'twitch_cheer', platform: 'twitch', user: 'AnaP', data: { bits: 250, userId: 'p-ana' } }));
const afterBits = points.balanceOf(uidOf('twitch:p-ana'));
const gifted = points.pointsFor({ type: 'twitch_sub', data: { giftedBy: 'x' } });
const bulk = points.pointsFor({ type: 'twitch_sub_gift_bulk', data: { count: 3 } });
const diamonds = points.pointsFor({ type: 'tiktok_gift', data: { diamonds: 10, count: 2 } });

test('points are earned apart from XP: talking (not every message), coming to the stream, and giving', () => {
  assert.equal(afterTalking, 55, 'talking twice in a minute paid twice, or coming to the stream paid nothing');
  assert.equal(afterBits, 180);
  assert.equal(gifted, 0, 'the one given a sub earned for it');
  assert.equal(bulk, 900);
  assert.equal(diamonds, 20);
});

// ---------------------------------------------------------------- spending from chat

const said0 = said.length;
chat({ msg: '!canjear TTS hola chat' });
await wait(80);
const afterTts = points.balanceOf(uidOf('twitch:p-ana'));
chat({ msg: '!canjear 2' });
await wait(80);
const afterSound = points.balanceOf(uidOf('twitch:p-ana'));
const cooldown = await points.redeem(uidOf('twitch:p-ana'), 'sound', { name: 'AnaP' });
const noWords = await points.redeem(uidOf('twitch:p-ana'), 'tts', { name: 'AnaP' });
const broke = await points.redeem(uidOf('twitch:p-ana'), 'tts', { name: 'AnaP', input: 'hola' });
const failed = await points.redeem(uidOf('twitch:p-ana'), 'broken', { name: 'AnaP' });
const afterFailed = points.balanceOf(uidOf('twitch:p-ana'));
const once = await points.redeem(uidOf('twitch:p-ana'), 'once', { name: 'AnaP' });
const twice = await points.redeem(uidOf('twitch:p-ana'), 'once', { name: 'AnaP' });
const saidNow = said.slice(said0);
const which = points.itemSaid(points.getPoints(), ['Sonido', 'fuerte', 'ya']);

// A moderator gives; somebody else cannot.
chat({ user: 'Modi', userId: 'p-mod', isMod: true, msg: '!darpuntos AnaP 500' });
chat({ user: 'Nadie', userId: 'p-nobody', msg: '!darpuntos AnaP 500' });
await wait(20);
const afterGift = points.balanceOf(uidOf('twitch:p-ana'));

test('rewards are bought from chat by name or number, with their words, and run their action', () => {
  assert.equal(afterTts, 80);
  assert.ok(saidNow.includes('AnaP canjeó: hola chat'), JSON.stringify(saidNow));
  assert.equal(afterSound, 30);
  assert.deepEqual(redeemed.map((e) => [e.data.item, e.data.cost, e.data.input]).slice(0, 2), [['TTS', 100, 'hola chat'], ['Sonido fuerte', 50, '']]);
  assert.deepEqual([which.item?.id, which.used], ['sound', 2], 'a name of two words was not read whole');
});

test('each reason a reward cannot be had is said, and a reward that cannot run gives the points back', () => {
  assert.equal(cooldown.why, 'cooldown');
  assert.ok(cooldown.seconds > 50);
  assert.equal(noWords.why, 'input');
  assert.equal(broke.why, 'broke');
  assert.equal(failed.why, 'failed');
  assert.equal(afterFailed, 30, 'the points for a reward that did not run were kept');
  assert.equal(once.ok, true);
  assert.equal(twice.why, 'limit');
  assert.equal(afterGift, 529, 'a moderator could not give, or somebody else could');
});

// ---------------------------------------------------------------- Discord: the shop's buttons

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('discord.com')) return realFetch(url, init);
  calls.push({ route: String(url).replace(/^.*\/api\/v10/, ''), body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
  return new Response(null, { status: 204 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';
const member = { user: { id: '770000000000000001', username: 'cami', global_name: 'Cami' } };
points.add(leveling.personFor('discord', '770000000000000001', 'Cami'), 300, 'test', { now: true });
await points._test.onInteraction({ id: 'i1', token: 'tk', type: 3, member, data: { custom_id: 'shop:balance' } });
await points._test.onInteraction({ id: 'i2', token: 'tk', type: 3, member, data: { custom_id: 'shop:buy:tts' } });
await points._test.onInteraction({ id: 'i3', token: 'tk', type: 5, member, data: { custom_id: 'shop:input:tts', components: [{ type: 1, components: [{ type: 4, custom_id: 'words', value: 'desde discord' }] }] } });
const cami = points.balanceOf(uidOf('discord:770000000000000001'));
const shop = points.shopMessage();
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

test('the shop in Discord: a button for each reward, a box for words, answers only the presser sees', () => {
  assert.equal(calls[0].body.data.content, 'Tienes 300 🪙 puntos.');
  assert.equal(calls[0].body.data.flags, 64);
  assert.equal(calls[1].body.type, 9, 'a reward wanting words did not ask for them');
  assert.equal(calls[1].body.data.custom_id, 'shop:input:tts');
  assert.match(calls[2].body.data.content, /^✅ TTS/);
  assert.equal(cami, 200);
  assert.deepEqual(shop.components.flatMap((r) => r.components).map((b) => b.custom_id), ['shop:buy:tts', 'shop:buy:sound', 'shop:buy:broken', 'shop:buy:once', 'shop:balance', 'profile:me']);
});

// ---------------------------------------------------------------- linked people, offline

chat({ platform: 'youtube', user: 'AnaYT', userId: 'UCp-ana', msg: 'hola' });
const youtubeAlone = points.balanceOf(uidOf('youtube:UCp-ana'));
leveling.link({ platform: 'twitch', id: 'p-ana', username: 'AnaP' }, { platform: 'youtube', id: 'UCp-ana' });
const together = points.balanceOf(uidOf('twitch:p-ana'));
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_stopped' }));
await sessions._test.finish();
const offline = await points.redeem(uidOf('twitch:p-ana'), 'sound', { name: 'AnaP' }, Date.now() + 120_000);
engine.store.deleteAction('act-points');
engine.store.deleteAction('act-off');
points.setPoints({ shop: [] });

test('linking two people adds their points; a reward for the stream waits for one', () => {
  assert.ok(youtubeAlone > 0);
  assert.equal(together, 529 + youtubeAlone);
  assert.equal(offline.why, 'offline');
});
