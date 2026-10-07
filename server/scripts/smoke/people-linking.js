/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: one person, every account they have. Discord, Twitch, TikTok
 * and YouTube accounts joined into one person — by hand, a pair at a time or
 * added to somebody already linked, and by viewers themselves between any
 * two platforms — with their XP added together; and one account taken off
 * without taking the rest with it.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After linking-youtube.js.
 */

import { SCRIPT_URL, assert, bus, collection, EVENTS, fs, normaliseChat, test } from './harness.js';

const roleSync = await import('../../engine/role-sync.js');
const leveling = await import('../../leveling/index.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Discord is never reached: a member lookup finds nobody, so roles are left alone.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => (String(url).includes('discord.com')
  ? new Response(JSON.stringify({ message: 'Unknown Member' }), { status: 404 })
  : realFetch(url, init));

const users = collection('users', {});
const setXp = (key, xp) => {
  const uid = leveling.getAccounts()[key];
  users.update((prev) => { prev[uid] = { ...prev[uid], xp, level: leveling.getLevel(xp) }; return prev; });
};
const personWith = (key) => roleSync.people().find((p) => p.accounts.some((a) => a.key === key));

// ---------------------------------------------------------------- by hand: four accounts, one person

await roleSync.link({ platform: 'twitch', platformId: '7010', platformName: 'AnaTV', discordId: '880000000001', discordName: 'Ana' });
await roleSync.link({ platform: 'youtube', platformId: 'UCana0000000000000000000', platformName: 'Ana YT', discordId: '880000000002', discordName: 'Ana alt' });
setXp('twitch:7010', 100);
setXp('youtube:UCana0000000000000000000', 50);
// The YouTube account is added to the Twitch one's person: whoever it belonged to comes along whole.
await roleSync.addAccount({ to: 'twitch:7010', platform: 'youtube', platformId: 'UCana0000000000000000000', platformName: 'Ana YT' });
await roleSync.addAccount({ to: 'discord:880000000001', platform: 'tiktok', platformId: '@ana.tt', platformName: 'Ana TT' });
const together = personWith('twitch:7010');
const asPairs = roleSync.linkedUsers();

// One account off: only that one.
roleSync.unlink('twitch:7010');
const afterTakingTwitch = personWith('discord:880000000001');
const twitchAlone = leveling.findUser('twitch', '7010');
let badAccount = null;
try { await roleSync.addAccount({ to: 'discord:880000000001', platform: 'kick', platformId: 'x' }); } catch (err) { badAccount = err.message; }
let unknownPerson = null;
try { await roleSync.addAccount({ to: 'twitch:nobody', platform: 'tiktok', platformId: 'x' }); } catch (err) { unknownPerson = err.message; }

test('one person holds every account they have, Discord twice included, with their XP added together', () => {
  assert.deepEqual(together.accounts.map((a) => a.key), [
    'discord:880000000001', 'discord:880000000002', 'twitch:7010', 'tiktok:ana.tt', 'youtube:UCana0000000000000000000',
  ]);
  assert.equal(together.xp, 150, 'linking kept only the larger XP');
  assert.equal(together.name, 'Ana');
  assert.equal(together.accounts.find((a) => a.platform === 'tiktok').name, 'Ana TT');
  assert.equal(asPairs['twitch:7010']?.username, 'Ana', 'the pairs the rest of the app reads lost the link');
  assert.ok(asPairs['tiktok:ana.tt'] && asPairs['youtube:UCana0000000000000000000']);
});

test('taking one account off leaves the person their other accounts and their XP', () => {
  assert.deepEqual(afterTakingTwitch.accounts.map((a) => a.platform), ['discord', 'discord', 'tiktok', 'youtube']);
  assert.equal(afterTakingTwitch.xp, 150);
  assert.equal(twitchAlone?.xp, 0, 'the account taken off kept somebody else\'s XP');
  assert.equal(personWith('twitch:7010'), undefined);
  assert.match(badAccount || '', /Discord, Twitch, TikTok and YouTube/);
  assert.match(unknownPerson || '', /not known/);
});

// ---------------------------------------------------------------- viewers: any two platforms, both halves

const say = (over) => bus.emit(EVENTS.CHAT, normaliseChat({ msg: '', ...over }));
// Twitch and TikTok, no Discord at all.
say({ platform: 'twitch', user: 'BenjiTV', userId: '7020', msg: '!linktiktok beto.tt', raw: { username: 'benjitv' } });
const waiting = Object.values(roleSync.snapshot().pendingLinks);
// Somebody else on TikTok claims to be BenjiTV: they are not the account Beto named.
say({ platform: 'tiktok', user: 'Mallory', userId: 'mallory.tt', msg: '!linktwitch BenjiTV' });
await wait(20);
const afterStranger = personWith('twitch:7020');
say({ platform: 'tiktok', user: 'Beto', userId: 'beto.tt', msg: '!linktwitch benjitv' });
await wait(50);
const beto = personWith('twitch:7020');
const strangerStillWaiting = Object.values(roleSync.snapshot().pendingLinks).some((p) => p.twitchUser === 'Mallory');

// Discord first this time, the YouTube half second.
say({ platform: 'discord', user: 'Caro', userId: '880000000003', msg: '!linkyoutube Caro Vlogs', raw: { channelId: '700000000000000500' } });
await wait(50);
say({ platform: 'youtube', user: 'Caro Vlogs', userId: 'UCcaro000000000000000000', msg: '!linkdiscord Caro' });
await wait(50);
const caro = personWith('discord:880000000003');
// A name typed for one's own platform does nothing.
say({ platform: 'twitch', user: 'Solo', userId: '7030', msg: '!linktwitch Solo' });
const ownPlatform = Object.values(roleSync.snapshot().pendingLinks).some((p) => p.twitchUser === 'Solo');

for (const key of ['tiktok:ana.tt', 'youtube:UCana0000000000000000000', 'discord:880000000002', 'tiktok:beto.tt', 'youtube:UCcaro000000000000000000']) roleSync.unlink(key);
globalThis.fetch = realFetch;

test('viewers link any two of their own accounts, Discord or not, and a stranger cannot step in', () => {
  assert.deepEqual(waiting.map((p) => [p.platform, p.want, p.discordName]), [['twitch', 'tiktok', 'beto.tt']]);
  assert.equal(afterStranger, undefined, 'an account that was not named finished the link');
  assert.deepEqual(beto?.accounts.map((a) => a.key), ['twitch:7020', 'tiktok:beto.tt']);
  assert.ok(strangerStillWaiting, 'the stranger\'s own claim was taken as a confirmation');
  assert.deepEqual(caro?.accounts.map((a) => a.key), ['discord:880000000003', 'youtube:UCcaro000000000000000000']);
  assert.equal(ownPlatform, false);
});

test('the Role Management screen lists people, adds accounts to them, and takes one off at a time', () => {
  const view = read('../../web/components/views/RoleManagementView.tsx');
  assert.ok(view.includes('data-linked-person={person.uid}') && view.includes('openManualLink(person)'), 'the list is not of people');
  assert.ok(view.includes('await addAccount(') && view.includes("linkPlatform === 'discord' ? discordPicker()"), 'an account cannot be added to somebody');
  assert.ok(view.includes('onRemove={() => removeAccount(a.key)}'));
  assert.ok(read('../api/ws.js').includes("if (op === 'add_account') return reply(await roleSync.addAccount(payload));"));
  assert.ok(read('../leveling/index.js').includes('const mergedXp = (a.xp || 0) + (b.xp || 0);'));
});
