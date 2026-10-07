/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Discord as a chat — which messages are the stream's and which
 * only count for levels, who is a moderator there, how its markup reads on
 * other platforms, its emoji in small print, one-role menus moving the
 * reaction with the role, and the chat relay both ways.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After discord.js, which
 * set leveling and the role menus up.
 */

import { SCRIPT_URL, assert, bus, collection, EVENTS, fs, normaliseChat, test } from './harness.js';

const discord = await import('../../platforms/discord.js');
const roles = await import('../../engine/discord-roles.js');
const leveling = await import('../../leveling/index.js');
const relay = await import('../../engine/relay.js');
const twitch = await import('../../platforms/twitch.js');
const { config } = await import('../../config.js');

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- which channel, who is a mod

const cache = collection('discord_cache', {});
const cacheBefore = cache.get();
const MOD = String(1n << 40n); // Timeout members
cache.set({
  ...cacheBefore,
  roles: [{ id: 'g1', name: '@everyone', permissions: '1024' }, { id: '333', name: 'Mods', permissions: MOD }, { id: 'r-fan', name: 'Fans', permissions: '1024' }],
  channels: [{ id: '111', name: 'general' }],
});
const cfg = { guildId: 'g1', channelId: 'c-stream' };
const author = { id: '42', username: 'ana', global_name: 'Ana' };
const msg = (over) => ({ id: 'm1', guild_id: 'g1', channel_id: 'c-stream', author, member: { roles: ['r-fan'] }, content: 'hola', ...over });

const inStream = discord.messageFromGateway(msg({}), cfg);
const inGeneral = discord.messageFromGateway(msg({ channel_id: 'c-general' }), cfg);
const otherServer = discord.messageFromGateway(msg({ guild_id: 'g2', channel_id: 'c-x' }), cfg);
const fromABot = discord.messageFromGateway(msg({ author: { ...author, bot: true } }), cfg);
const fromAMod = discord.messageFromGateway(msg({ member: { roles: ['333'] } }), cfg);
const marked = discord.messageFromGateway(msg({
  content: '<@7> mira <#111> <:Wow:999>  <@&333>\n¡hola!',
  mentions: [{ id: '7', username: 'bob', global_name: 'Bob' }],
}), cfg);
cache.set(cacheBefore);

test('the channel the app reads is the stream\'s chat; the rest of the server only counts for levels', () => {
  assert.equal(inStream.where, 'stream');
  assert.equal(inStream.chat.platform, 'discord');
  assert.equal(inStream.chat.user, 'Ana');
  assert.equal(inGeneral.where, 'elsewhere');
  assert.equal(inGeneral.chat.raw.channelId, 'c-general');
  assert.equal(otherServer, null, 'another server\'s message was counted');
  assert.equal(fromABot, null, 'a bot was counted');
  assert.ok(read('../platforms/discord.js').includes("bus.emit(message.where === 'stream' ? EVENTS.CHAT : 'discord:message_elsewhere', message.chat);"));
});

test('somebody whose role can moderate the server is a mod for commands', () => {
  assert.equal(fromAMod.chat.isMod, true);
  assert.equal(inStream.chat.isMod, false);
  const all = [{ id: 'g1', permissions: '0' }, { id: 'r-admin', permissions: '8' }, { id: 'r-msgs', permissions: String(1 << 13) }];
  assert.equal(discord.isModerator('g1', '1', { roles: ['r-admin'] }, all), true, 'an administrator is not a mod');
  assert.equal(discord.isModerator('g1', '1', { roles: ['r-msgs'] }, all), true, 'Manage Messages is not a mod');
  assert.equal(discord.isModerator('g1', '1', { roles: [] }, all), false);
  // A permission everyone has makes everyone a mod.
  assert.equal(discord.isModerator('g1', '1', { roles: [] }, [{ id: 'g1', permissions: '8' }]), true);
  assert.equal(discord.isModerator('g1', '1', null, all), false);
  // The owner, learned when the server comes in; roles kept current as they change.
  const src = read('../platforms/discord.js');
  assert.ok(src.includes('guildOwners.set(d.id, d.owner_id)') && src.includes("case 'GUILD_ROLE_UPDATE':"));
});

test('Discord\'s markup reads as names on other platforms', () => {
  assert.equal(marked.chat.raw.plain, '@Bob mira #general :Wow: @Mods ¡hola!');
  assert.equal(marked.chat.msg.startsWith('<@7>'), true, 'the Discord copy itself was changed');
});

// ---------------------------------------------------------------- small print

test('a server emoji in a footer or author line becomes its picture instead of showing as code', () => {
  assert.deepEqual(discord.smallPrint('<:Wow:123> Bienvenido', 'text', 2048), { text: 'Bienvenido', icon_url: 'https://cdn.discordapp.com/emojis/123.png' });
  assert.deepEqual(discord.smallPrint('Hola <a:Dance:55> amigos', 'text', 2048), { text: 'Hola amigos', icon_url: 'https://cdn.discordapp.com/emojis/55.gif' });
  assert.deepEqual(discord.smallPrint('<:Wow:1>', 'name', 256), { name: '​', icon_url: 'https://cdn.discordapp.com/emojis/1.png' });
  assert.deepEqual(discord.smallPrint('Hola 👋', 'text', 2048), { text: 'Hola 👋' });
});

test('a relayed chat line keeps up to Twitch\'s 500 characters; a name stays short', () => {
  assert.equal(discord.sanitise('a'.repeat(450), 500).length, 450);
  assert.equal(discord.sanitise('b'.repeat(300)).length, 200);
  // Cut before escaping, so a line never ends on half an escape.
  assert.ok(!discord.sanitise(`${'c'.repeat(199)}*`).endsWith('\\'));
});

// ---------------------------------------------------------------- one-role menus

const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  calls.push(`${init.method || 'GET'} ${String(url).replace(/^.*\/api\/v10/, '')}`);
  return new Response(null, { status: 204 });
};
const realToken = config.discord.botToken;
config.discord.botToken = 'test-token';
roles.store.setReactionRoles([{
  messageId: 'rm2', channelId: 'ch1', guildId: 'g1', name: 'Equipo', mode: 'unique',
  mappings: [{ emoji: '🔴', roleId: 'r-red' }, { emoji: '🔵', roleId: 'r-blue' }, { emoji: '<:Wow:999>', roleId: 'r-wow' }],
}]);
bus.emit('discord:reaction_add', { message_id: 'rm2', channel_id: 'ch1', guild_id: 'g1', user_id: '5151', emoji: { name: '🔵' }, member: { nick: 'Azul' } });
await wait(900);
roles.store.setReactionRoles([]);
config.discord.botToken = realToken;
globalThis.fetch = realFetch;

test('a menu that allows one role moves the member\'s reaction along with the role', () => {
  assert.ok(calls.includes('DELETE /guilds/g1/members/5151/roles/r-red'));
  assert.ok(calls.includes(`DELETE /channels/ch1/messages/rm2/reactions/${encodeURIComponent('🔴')}/5151`), 'the old reaction was left on');
  assert.ok(calls.includes(`DELETE /channels/ch1/messages/rm2/reactions/${encodeURIComponent('Wow:999')}/5151`), 'a server emoji reaction was left on');
  assert.ok(!calls.some((c) => c.includes(encodeURIComponent('🔵'))), 'the new choice\'s reaction was taken off');
  assert.ok(calls.includes('PUT /guilds/g1/members/5151/roles/r-blue'));
});

// ---------------------------------------------------------------- levels from the whole server

const levelCfg = leveling.getConfig();
leveling.setConfig({ enabled: true, ignoredChannelIds: ['111222'] });
const elsewhere = (id, channelId) => bus.emit('discord:message_elsewhere', normaliseChat({
  platform: 'discord', user: `Talker${id}`, userId: `talker${id}`, msg: 'hey', raw: { guildId: 'g1', channelId },
}));
elsewhere('1', 'c-general');
elsewhere('2', '111222');
await wait(50);
const talkers = Object.values(leveling.getUsers()).filter((u) => /^Talker/.test(u.username)).map((u) => [u.username, u.xp > 0]);
leveling.setConfig(levelCfg);

test('talking anywhere in the server earns XP, except in the channels set to be left out', () => {
  assert.deepEqual(talkers, [['Talker1', true]]);
  assert.ok(read('../leveling/index.js').includes("bus.on('discord:message_elsewhere', onMessage);"));
});

// ---------------------------------------------------------------- the relay

const relayCfg = collection('relay_config', {});
const relayBefore = relayCfg.get();
const posts = [];
const toTwitch = [];
const toYoutube = [];
let youtubeLeft = 5000;
relay.initRelay({
  channel: () => 'c-stream',
  post: async (channelId, text) => { posts.push([channelId, text]); },
  sayTwitch: async (text) => { toTwitch.push(text); },
  sayYoutube: async (text) => { toYoutube.push(text); },
  youtubeLeft: () => youtubeLeft,
  wait: async () => {},
});
const chat = (platform, user, text, extra = {}) => bus.emit(EVENTS.CHAT, normaliseChat({ platform, user, msg: text, ...extra }));

// Everything off: nothing goes anywhere.
relayCfg.set({});
chat('twitch', 'Viewer', 'hola');
chat('discord', 'Ana', 'hola');
relay.flush();
await wait(20);
const whileOff = posts.length + toTwitch.length + toYoutube.length;

relayCfg.set({ twitchToDiscord: true, youtubeToDiscord: true, tiktokToDiscord: false, discordToTwitch: true, discordToYoutube: true });
chat('twitch', 'Viewer', 'uno');
chat('twitch', 'Viewer', 'dos *negrita*');
chat('youtube', 'Fan', 'tres');
chat('tiktok', 'Tok', 'not relayed');
chat('discord', 'Ana', '<@7> hola', { raw: { plain: '@Bob hola' } });
relay.flush();
const batched = posts.slice();
posts.length = 0;
for (let i = 0; i < 30; i += 1) chat('twitch', `Viewer${i}`, 'x'.repeat(100));
relay.flush();
const split = posts.slice();
youtubeLeft = 900;
chat('discord', 'Ana', 'otra vez');
await wait(50);
relay.stopRelay();
relayCfg.set(relayBefore);

test('chat goes into Discord a few lines to a post, not a post a line', () => {
  assert.equal(whileOff, 0, 'something was relayed with every switch off');
  assert.equal(batched.length, 1);
  assert.equal(batched[0][1], '**[twitch] Viewer:** uno\n**[twitch] Viewer:** dos \\*negrita\\*\n**[youtube] Fan:** tres');
  assert.ok(split.length >= 2 && split.every(([, text]) => text.length <= 1900), 'a post went past Discord\'s length');
  assert.equal(split.map(([, text]) => text.split('\n').length).reduce((a, b) => a + b, 0), 30, 'lines were lost between posts');
});

test('Discord chat goes out to Twitch and YouTube as plain words, and YouTube stops before the day runs out', () => {
  assert.deepEqual(toTwitch, ['[Discord] Ana: @Bob hola', '[Discord] Ana: otra vez']);
  assert.deepEqual(toYoutube, ['[Discord] Ana: @Bob hola'], 'YouTube was sent a message with under 1,000 units left');
  assert.ok(!posts.some(([, text]) => text.includes('[discord]')), 'Discord was relayed into itself');
});

// The bot's copy on Twitch, coming back: dropped once, and only when it is ours.
await twitch.sayRelayed('[Discord] Ana: eco');
const echoFromViewer = twitch.isRelayEcho('[Discord] Ana: eco', false);
const echoFromUs = twitch.isRelayEcho('[Discord] Ana: eco', true);
const echoAgain = twitch.isRelayEcho('[Discord] Ana: eco', true);

test('the relay\'s own line on Twitch is not shown again or sent back to Discord', () => {
  assert.equal(echoFromViewer, false, 'a viewer typing the same words was dropped');
  assert.equal(echoFromUs, true);
  assert.equal(echoAgain, false, 'the same words from us were dropped twice');
  assert.ok(read('../platforms/twitch.js').includes('if (isRelayEcho(message, self || byBot)) return;'));
  assert.ok(read('../platforms/youtube.js').includes('if (quiet) return sent;'));
  assert.ok(read('../index.js').includes('initRelay();') && !read('../index.js').includes('function initRelays'));
});

test('the Connections screen has the new relay switches', () => {
  const view = read('../../web/components/views/ConnectionsView.tsx');
  for (const key of ['youtubeToDiscord', 'discordToTwitch', 'discordToYoutube']) assert.ok(view.includes(`data-relay="${key}"`), key);
  const strings = read('../../web/constants.ts');
  for (const key of ['relayDiscordToTwitchHint', 'relayDiscordToYoutubeHint']) assert.equal(strings.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
});
