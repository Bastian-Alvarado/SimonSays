/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: loyalty roles (server/engine/role-sync.js) — Discord roles for
 * showing up, read from each person's history across every account they
 * have: streams attended and messages (only ever given), a streak and the
 * platforms they are on (given and taken away). Checked for everybody
 * linked when a stream ends.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After profile-card.js.
 */

import { assert, bus, collection, EVENTS, normaliseChat, normaliseEvent, test } from './harness.js';

const roleSync = await import('../../engine/role-sync.js');
const sessions = await import('../../engine/stream-sessions.js');
const leveling = await import('../../leveling/index.js');
const { config } = await import('../../config.js');

// Discord, standing in: the member holds what was given them.
let held = [];
const changes = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.includes('discord.com')) return realFetch(url, init);
  const method = init.method || 'GET';
  const role = /\/roles\/([\w-]+)$/.exec(u)?.[1];
  if (method === 'PUT' && role) { held = [...new Set([...held, role])]; changes.push(`+${role}`); }
  if (method === 'DELETE' && role) { held = held.filter((r) => r !== role); changes.push(`-${role}`); }
  if (method === 'GET' && /\/members\/\d+$/.test(u)) return new Response(JSON.stringify({ roles: held, user: { username: 'leal' } }), { status: 200 });
  return new Response(null, { status: 204 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';
const settings = collection('discord_settings', {});
const settingsBefore = settings.get();
settings.set({ ...settingsBefore, guildId: '900000000000000009' });

const stream = async (talk) => {
  bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_started' }));
  if (talk) bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'Leal', userId: '7777001', msg: 'hola' }));
  bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_stopped' }));
  await sessions._test.finish();
};

roleSync.setLoyalty([
  { kind: 'streams', atLeast: 2, roleId: '111111111111111101' },
  { kind: 'streak', atLeast: 2, roleId: '111111111111111102' },
  { kind: 'platforms', atLeast: 2, roleId: '111111111111111103' },
  { kind: 'messages', atLeast: 1000, roleId: '111111111111111104' },
  { kind: 'streams', atLeast: 3, roleId: '' },
]);
await roleSync.link({ platform: 'twitch', platformId: '7777001', platformName: 'Leal', discordId: '880000000000000077', discordName: 'Leal' });
await stream(true);
await stream(true);
const uid = leveling.getAccounts()['twitch:7777001'];
const afterTwo = roleSync.loyaltyVerdicts(uid, leveling.accountsOf(uid));
await roleSync.syncEveryone();
const heldAfterTwo = [...held].sort();

await roleSync.addAccount({ to: 'twitch:7777001', platform: 'youtube', platformId: 'UCloyal0000000000000000', platformName: 'Leal YT' });
const heldAfterYoutube = [...held].sort();

// A stream they miss: the streak breaks; the streams they came to stay counted.
await stream(false);
await roleSync.syncEveryone();
const heldAfterMissing = [...held].sort();
const measures = roleSync.loyaltyOf(uid);

roleSync.setLoyalty([]);
roleSync.unlink('youtube:UCloyal0000000000000000');
roleSync.unlink('discord:880000000000000077');
settings.set(settingsBefore);
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

test('loyalty roles follow each person\'s history: streams and a streak given, a missing platform not', () => {
  assert.deepEqual(afterTwo.grant.sort(), ['111111111111111101', '111111111111111102']);
  assert.deepEqual(afterTwo.revoke, ['111111111111111103'], 'only the measures that come and go may take a role');
  assert.deepEqual(heldAfterTwo, ['111111111111111101', '111111111111111102']);
  assert.ok(roleSync.getLoyalty().every((r) => r.kind && r.atLeast >= 1));
});

test('linking another platform gives its role; missing a stream breaks the streak but keeps the streams', () => {
  assert.deepEqual(heldAfterYoutube, ['111111111111111101', '111111111111111102', '111111111111111103']);
  assert.deepEqual(heldAfterMissing, ['111111111111111101', '111111111111111103'], 'the streak role stayed, or the streams one went');
  assert.deepEqual(measures, { streams: 2, streak: 0, messages: 2, platforms: 2 });
  assert.ok(changes.includes('-111111111111111102'));
});
