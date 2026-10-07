/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the profile card (server/engine/profile-card.js) — what a
 * person's profile says across every platform they are on, the line a chat
 * without pictures gets, the picture itself, "!perfil" answered in Discord
 * with it, and the shop's "Mi perfil" button answering privately.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After points.js.
 */

import { assert, bus, EVENTS, normaliseChat, test } from './harness.js';

const profile = await import('../../engine/profile-card.js');
const points = await import('../../engine/points.js');
const roleSync = await import('../../engine/role-sync.js');
const leveling = await import('../../leveling/index.js');
const { config } = await import('../../config.js');
profile.initProfileCard();

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('discord.com')) return realFetch(url, init);
  const route = String(url).replace(/^.*\/api\/v10/, '');
  let body = null;
  if (init.body instanceof FormData) {
    body = JSON.parse(init.body.get('payload_json'));
    body.files = [...init.body.keys()].filter((k) => k.startsWith('files[')).map((k) => init.body.get(k));
  } else if (typeof init.body === 'string') body = JSON.parse(init.body);
  calls.push({ route, body });
  if (/\/members\/\d+$/.test(route)) return new Response(JSON.stringify({ message: 'Unknown Member' }), { status: 404 });
  return new Response(JSON.stringify({ id: '1' }), { status: 200 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';

// Somebody on Twitch and Discord, with some XP, points and a stream behind them.
await roleSync.link({ platform: 'twitch', platformId: '6100', platformName: 'PerfilTV', discordId: '760000000000000001', discordName: 'Perfil' });
const uid = leveling.getAccounts()['twitch:6100'];
points.add(uid, 1234, 'test', { now: true });
const p = profile.profileOf(uid);
const line = profile.profileLine(p);
const png = await profile.renderProfile(p);

const before = calls.length;
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'discord', user: 'Perfil', userId: '760000000000000001', msg: '!perfil', raw: { channelId: '700000000000000600', messageId: '800000000000000001' } }));
await new Promise((r) => setTimeout(r, 2500));
const answered = calls.slice(before).find((c) => c.route === '/channels/700000000000000600/messages');
await profile._test.onInteraction({ id: 'i9', token: 'tk', type: 3, member: { user: { id: '760000000000000001', username: 'perfil' } }, data: { custom_id: 'profile:me' } });
const button = calls.at(-1);
roleSync.unlink('twitch:6100');
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

test('a profile says who somebody is across their platforms: level, points, streams, accounts', () => {
  assert.equal(p.name, 'Perfil', 'the Discord name was not the one shown');
  assert.equal(p.points, 1234);
  assert.deepEqual(p.accounts.map((a) => [a.platform, a.name]), [['twitch', 'PerfilTV'], ['discord', 'Perfil']]);
  assert.ok(p.progress >= 0 && p.progress <= 1);
  assert.match(line, /^Perfil: nivel \d+/);
  assert.ok(line.includes('1,234 🪙 puntos') && line.includes('Twitch+Discord'), line);
  assert.equal(profile.supportLine({ bits: 1200, subs: 1, tiktokGifts: 2 }), '1,200 bits · 1 sub · 2 regalos de TikTok');
});

test('the profile is a picture: drawn, sent in Discord as a reply, and privately from the shop\'s button', () => {
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.ok(png.length > 5000, 'the picture is empty');
  assert.ok(answered, 'Discord was not answered');
  assert.equal(answered.body.embeds[0].image.url, 'attachment://perfil.png');
  assert.equal(answered.body.message_reference.message_id, '800000000000000001');
  assert.equal(answered.body.files.length, 1);
  assert.equal(button.route, '/interactions/i9/tk/callback');
  assert.equal(button.body.data.flags, 64);
  assert.equal(button.body.files.length, 1);
});
