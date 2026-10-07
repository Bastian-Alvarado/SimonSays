/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: moderation across somebody's accounts (server/engine/
 * moderation.js) — a ban on Twitch written in the mod log with every other
 * account of theirs and buttons for those; only a moderator's press doing
 * anything; banning and timing out on Discord from a press or from the
 * screen; a Discord timeout seen and logged, and the bot's own not twice.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After game-requests.js.
 */

import { assert, bus, collection, test } from './harness.js';

const moderation = await import('../../engine/moderation.js');
const roleSync = await import('../../engine/role-sync.js');
const leveling = await import('../../leveling/index.js');
const { config } = await import('../../config.js');
moderation.initModeration();

const GUILD = '900000000000000055';
const LOG = '700000000000009001';
const settings = collection('discord_settings', {});
const settingsBefore = settings.get();
settings.set({ ...settingsBefore, guildId: GUILD });
const cache = collection('discord_cache', {});
const cacheBefore = cache.get();
cache.set({ ...cacheBefore, roles: [...(cacheBefore.roles || []), { id: '900000000000000056', name: 'Mods', permissions: String(1n << 13n) }] });

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('discord.com')) return realFetch(url, init);
  const route = String(url).replace(/^.*\/api\/v10/, '');
  calls.push({ method: init.method || 'GET', route, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
  if (/\/members\/\d+$/.test(route) && (init.method || 'GET') === 'GET') return new Response(JSON.stringify({ message: 'Unknown Member' }), { status: 404 });
  return new Response(JSON.stringify({ id: '1' }), { status: 200 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';

await roleSync.link({ platform: 'twitch', platformId: '5501', platformName: 'Trol', discordId: '880000000000005501', discordName: 'TrolD' });
await roleSync.addAccount({ to: 'twitch:5501', platform: 'youtube', platformId: 'UCtrol000000000000000000', platformName: 'Trol YT' });
const uid = leveling.getAccounts()['twitch:5501'];
moderation.control({ settings: { logChannelId: LOG } });

// Banned on Twitch: into the log, with buttons for Discord and YouTube.
const before = calls.length;
bus.emit('mod:action', { platform: 'twitch', kind: 'ban', userId: '5501', user: 'Trol', reason: 'spam' });
await new Promise((r) => setTimeout(r, 300));
const logged = calls.slice(before).find((c) => c.method === 'POST' && c.route === `/channels/${LOG}/messages`);

// Somebody who is not a moderator presses Ban on Discord: nothing.
await moderation._test.onInteraction({ id: 'i1', token: 't', guild_id: GUILD, member: { user: { id: '880000000000000099' }, roles: [] }, data: { custom_id: `mod:ban:discord:${uid}` } });
const refused = calls.at(-1);
const bannedBefore = calls.some((c) => c.method === 'PUT' && c.route === `/guilds/${GUILD}/bans/880000000000005501`);
// A moderator does.
await moderation._test.onInteraction({ id: 'i2', token: 't', guild_id: GUILD, member: { user: { id: '880000000000000098', username: 'moddy' }, roles: ['900000000000000056'] }, data: { custom_id: `mod:ban:discord:${uid}` } });
const banned = calls.find((c) => c.method === 'PUT' && c.route === `/guilds/${GUILD}/bans/880000000000005501`);
const answered = calls.at(-1);
// From the screen: a timeout on Discord; Discord then tells of it, and the log does not say it twice.
const logBefore = calls.filter((c) => c.route === `/channels/${LOG}/messages`).length;
const timedOut = await moderation.control({ op: 'act', uid, platform: 'discord', action: 'timeout' });
const patch = calls.find((c) => c.method === 'PATCH' && c.route === `/guilds/${GUILD}/members/880000000000005501`);
moderation._test.onDiscordMember({ user: { id: '880000000000005501', username: 'trold' }, communication_disabled_until: new Date(Date.now() + 3_600_000).toISOString() });
await new Promise((r) => setTimeout(r, 200));
const logAfter = calls.filter((c) => c.route === `/channels/${LOG}/messages`).length;
// Somebody else timed out in Discord by a moderator by hand: logged.
moderation._test.onDiscordMember({ user: { id: '880000000000005599', username: 'otro' }, communication_disabled_until: new Date(Date.now() + 600_000).toISOString() });
await new Promise((r) => setTimeout(r, 200));
const otherLogged = calls.filter((c) => c.route === `/channels/${LOG}/messages`).length;
await roleSync.addAccount({ to: 'twitch:5501', platform: 'tiktok', platformId: 'trol.tt', platformName: 'Trol TT' });
let noTikTok = null;
try { await moderation.act(uid, 'tiktok', 'ban'); } catch (err) { noTikTok = err.code; }

moderation.control({ settings: { logChannelId: '' } });
for (const k of ['youtube:UCtrol000000000000000000', 'tiktok:trol.tt', 'discord:880000000000005501']) roleSync.unlink(k);
settings.set(settingsBefore);
cache.set(cacheBefore);
globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

test('a ban on one platform is written in the mod log with their other accounts, and buttons for those', () => {
  assert.ok(logged, 'nothing in the mod log');
  assert.equal(logged.body.embeds[0].title, '🔨 Ban en Twitch');
  assert.match(logged.body.embeds[0].description, /spam/);
  assert.match(logged.body.embeds[0].description, /YouTube\*\* Trol YT/);
  assert.deepEqual(logged.body.components.flatMap((r) => r.components.map((b) => b.custom_id)), [
    `mod:ban:discord:${uid}`, `mod:timeout:discord:${uid}`, `mod:ban:youtube:${uid}`, `mod:timeout:youtube:${uid}`,
  ]);
  assert.deepEqual(logged.body.allowed_mentions, { parse: [] });
});

test('only a moderator\'s press does anything; theirs bans on Discord', () => {
  assert.match(refused.body.data.content, /Solo un moderador/);
  assert.equal(bannedBefore, false, 'somebody who is not a moderator banned');
  assert.ok(banned, 'the moderator\'s press did nothing');
  assert.match(answered.body.data.content, /^✅ Ban en Discord/);
});

test('a timeout from the screen; Discord telling of it is not logged twice; a moderator\'s own timeout is', () => {
  assert.deepEqual([timedOut.platform, timedOut.action, timedOut.seconds, timedOut.accounts], ['discord', 'timeout', 3600, 1]);
  assert.ok(patch?.body?.communication_disabled_until);
  assert.equal(logAfter, logBefore, 'the bot\'s own timeout was logged again');
  assert.equal(otherLogged, logAfter + 1);
  assert.equal(noTikTok, 'moderation_cannot');
});
