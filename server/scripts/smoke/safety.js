/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Keeping the install safe: what a backup holds, who counts as this machine, emoji keys, secrets.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { assert, collection, emojiKey, engine, isSameMachine, test } from './harness.js';

// ------------------------------------------------- configuration backup

// Platform modules are not started in the smoke harness, so stand up the one
// collection whose secret handling is worth asserting.
const fakeTwitch = collection('twitch_credentials', {});
fakeTwitch.set({ channel: 'somechannel', login: 'somechannel', clientId: 'public-id', accessToken: 'SECRET-token', botToken: 'SECRET-bot' });

const bundle = engine.exportConfig();

test('a backup carries the configuration, not just preferences', () => {
  assert.ok(Array.isArray(bundle.collections.commands), 'commands missing from the backup');
  assert.ok(Array.isArray(bundle.collections.actions), 'actions missing from the backup');
  assert.ok(bundle.collections.commands.length > 0, 'the backup claims there are no commands');
});

test('secrets are left out of a backup', () => {
  const twitch = bundle.collections.twitch_credentials;
  assert.equal(twitch.channel, 'somechannel', 'the non-secret part should travel');
  assert.ok(!('accessToken' in twitch), 'an access token was written into the backup');
  assert.ok(!('botToken' in twitch), 'a bot token was written into the backup');
  assert.ok(!JSON.stringify(bundle).includes('SECRET-'), 'a secret survived somewhere in the file');
  assert.ok(bundle.meta.stripped.includes('twitch_credentials.accessToken'), 'the file does not say what it dropped');
});

test('chat history and caches are not part of a backup', () => {
  for (const name of ['event_history', 'recent_chat', 'discord_cache', 'spotify_tokens']) {
    assert.ok(!(name in bundle.collections), `${name} should not be backed up`);
  }
});

test('importing restores what the file holds', () => {
  const edited = structuredClone(bundle);
  edited.collections.commands = [{ id: 'imported-1', name: 'Imported', triggers: ['!imported'] }];
  const summary = engine.importConfig(edited);
  assert.ok(summary.restored.includes('commands'));
  const now = engine.snapshot().commands;
  assert.equal(now.length, 1);
  assert.equal(now[0].id, 'imported-1');
  // Healed on the way in, the same as on boot.
  assert.ok(now[0].permissions, 'an imported command was not normalised');
});

test('importing does not sign this machine out', () => {
  assert.equal(fakeTwitch.get().accessToken, 'SECRET-token', 'an import wiped a stored sign-in');
  assert.equal(fakeTwitch.get().channel, 'somechannel');
});

test('a file from another application is refused', () => {
  assert.throws(() => engine.importConfig({ meta: { app: 'SomethingElse' }, collections: {} }), /not a SimonSays/i);
});

test('an old settings-only export says so rather than silently doing nothing', () => {
  assert.throws(
    () => engine.importConfig({ meta: { app: 'SimonSays', version: 1 }, data: { app_theme: 'light' } }),
    /settings-only/i,
  );
});

// ------------------------------------------------ who counts as this machine

// A fixed interface list, so the result does not depend on the network the
// test happens to run on.
const IFACES = {
  Ethernet: [{ address: '192.168.1.215', family: 'IPv4', internal: false }],
  Loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  WiFi: [{ address: 'fe80::1a2b:3c4d:5e6f:7a8b', family: 'IPv6', internal: false }],
};

test('loopback is this machine', () => {
  assert.ok(isSameMachine('127.0.0.1', IFACES));
  assert.ok(isSameMachine('::1', IFACES));
  assert.ok(isSameMachine('::ffff:127.0.0.1', IFACES));
});

test('this machine reached by its own LAN address is still this machine', () => {
  // The dashboard is normally opened at this URL, not at localhost.
  assert.ok(isSameMachine('192.168.1.215', IFACES), 'the host was treated as a remote device');
  assert.ok(isSameMachine('::ffff:192.168.1.215', IFACES), 'the IPv6-mapped form was not recognised');
});

test('an IPv6 address with a zone index is matched', () => {
  assert.ok(isSameMachine('fe80::1a2b:3c4d:5e6f:7a8b%eth0', IFACES));
});

test('another device on the same network is not this machine', () => {
  assert.ok(!isSameMachine('192.168.1.50', IFACES), 'a phone on the LAN would have been allowed to import');
  assert.ok(!isSameMachine('192.168.1.2', IFACES));
  assert.ok(!isSameMachine('10.0.0.5', IFACES));
  assert.ok(!isSameMachine('8.8.8.8', IFACES));
});

test('a near-miss address is not this machine', () => {
  // Guards against a prefix or substring comparison creeping in.
  assert.ok(!isSameMachine('192.168.1.2150', IFACES));
  assert.ok(!isSameMachine('1192.168.1.215', IFACES));
  assert.ok(!isSameMachine('', IFACES));
  assert.ok(!isSameMachine(undefined, IFACES));
});

// -------------------------------------------------- reaction role emoji keys

// How the gateway describes a reaction, versus how a stored mapping spells it.
const gatewayUnicode = { name: '❤️' };
const gatewayCustom = { name: 'thinking', id: '1199000000000000007' };
const gatewayAnimated = { name: 'Minecraft', id: '1199000000000000004' };

test('a unicode emoji matches the way it is stored', () => {
  assert.equal(emojiKey('❤️'), emojiKey(gatewayUnicode));
});

test('a custom emoji written as markup matches what Discord sends', () => {
  // This is the form V2 stored, and the reason those menus did nothing.
  assert.equal(emojiKey('<:thinking:1199000000000000007>'), emojiKey(gatewayCustom));
  assert.equal(emojiKey('<a:Minecraft:1199000000000000004>'), emojiKey(gatewayAnimated));
});

test('the older name:id spelling still matches', () => {
  assert.equal(emojiKey('thinking:1199000000000000007'), emojiKey(gatewayCustom));
});

test('a renamed custom emoji still matches', () => {
  // Keyed on the id, so renaming it in Discord does not break the menu.
  assert.equal(emojiKey('<:was_called_something_else:1199000000000000007>'), emojiKey(gatewayCustom));
});

test('different custom emoji do not collide', () => {
  assert.notEqual(emojiKey(gatewayCustom), emojiKey(gatewayAnimated));
  // Same name, different emoji: must not be treated as the same one.
  assert.notEqual(emojiKey({ name: 'thinking', id: '111' }), emojiKey({ name: 'thinking', id: '222' }));
});

test('a custom emoji is never confused with a unicode one of the same name', () => {
  assert.notEqual(emojiKey({ name: 'thinking', id: '111' }), emojiKey('thinking'));
});

// ------------------------------------------------- secrets stay on the server

// The collections that gained secrets so a first-run setup needs no .env file.
collection('discord_settings', {}).set({ guildId: 'g1', channelId: 'c1', clientId: 'public', clientSecret: 'SECRET-dc', botToken: 'SECRET-bot' });
collection('tiktok_credentials', {}).set({ username: 'someone', signApiKey: 'SECRET-euler' });
collection('ai_settings', {}).set({ geminiApiKey: 'SECRET-gemini' });

const withSecrets = engine.exportConfig();

test('secrets never travel in a backup', () => {
  const raw = JSON.stringify(withSecrets);
  for (const needle of ['SECRET-dc', 'SECRET-bot', 'SECRET-euler', 'SECRET-gemini']) {
    assert.ok(!raw.includes(needle), `${needle} was written into the backup`);
  }
});

test('the non-secret settings beside them still travel', () => {
  assert.equal(withSecrets.collections.discord_settings.guildId, 'g1');
  assert.equal(withSecrets.collections.discord_settings.clientId, 'public');
  assert.equal(withSecrets.collections.tiktok_credentials.username, 'someone');
});

test('a backup says which secrets it dropped', () => {
  for (const field of ['discord_settings.botToken', 'discord_settings.clientSecret', 'tiktok_credentials.signApiKey']) {
    assert.ok(withSecrets.meta.stripped.includes(field), `${field} is not named in meta.stripped`);
  }
});

