/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Discord bot's own jobs — welcoming and seeing off members,
 * and signing in with Discord from the dashboard.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. The Discord module was
 * set up by the voice tests before this file.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const roles = await import('../../engine/discord-roles.js');
const discord = await import('../../platforms/discord.js');

// ---------------------------------------------------------------- welcome and goodbye

const rowan = { id: '306050655881793586', username: 'i_am_streamer', global_name: 'I_Am_Streamer', avatar: 'abc123' };

// How the phone's welcome is actually set up: a card, no text line.
const cardOnly = {
  enabled: true, channelId: '1', messages: [], message: '',
  sendCard: true, cardTitle: '', cardDescription: 'Saluditos {user} Bienvenido!', cardFooter: 'Hola {user}',
  cardColor: '#409642', cardThumbnail: true,
};
const welcomeCard = roles.greetingFor(cardOnly, rowan, true);
const goodbyeCard = roles.greetingFor({ ...cardOnly, cardDescription: 'Chales, se nos fue {user}' }, rowan, false);
const lineOnly = roles.greetingFor({ enabled: true, messages: ['Welcome {user} ({username})!'], sendCard: false }, rowan, true);
const nothing = roles.greetingFor({ enabled: true, messages: [], sendCard: false }, rowan, true);
const emptyCard = roles.greetingFor({ enabled: true, messages: [], sendCard: true, cardDescription: '' }, rowan, true);
const nasty = roles.greetingFor({ messages: ['hi {username}'] }, { id: '1', global_name: '@everyone **bold**' }, true);

test('a welcome set up as a card, with no text line, is posted', () => {
  assert.ok(welcomeCard, 'a card-only welcome posted nothing');
  assert.equal(welcomeCard.content, '');
  // A mention in the description, where Discord draws one; the name in the footer, where it would be raw markup.
  assert.equal(welcomeCard.embed.description, `Saluditos <@${rowan.id}> Bienvenido!`);
  assert.equal(welcomeCard.embed.footer, 'Hola I\\_Am\\_Streamer');
  assert.equal(welcomeCard.embed.thumbnail, `https://cdn.discordapp.com/avatars/${rowan.id}/abc123.png`);
});

test('a goodbye card is sent too, naming rather than mentioning somebody who has left', () => {
  assert.ok(goodbyeCard?.embed, 'the goodbye card was dropped');
  assert.equal(goodbyeCard.embed.description, 'Chales, se nos fue I\\_Am\\_Streamer');
});

test('a text line still works alone, and nothing to say posts nothing', () => {
  assert.equal(lineOnly.content, `Welcome <@${rowan.id}> (I\\_Am\\_Streamer)!`);
  assert.equal(lineOnly.embed, undefined);
  assert.equal(nothing, null);
  assert.equal(emptyCard, null, 'an empty card was posted');
  // A display name cannot ping everyone or format the message.
  assert.ok(!nasty.content.includes('@everyone') && nasty.content.includes('\\*\\*'), nasty.content);
});

// ---------------------------------------------------------------- signing in with Discord

/*
  The token exchange is caught before it leaves: what matters is what would
  have been sent. It used to send the two getter functions themselves, so
  Discord was given source code as the id and secret and every sign-in failed.
*/
discord.setSettings({ clientId: '1199000000000000001', clientSecret: 'test-secret' });
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url: String(url), body: init.body ? String(init.body) : '' });
  const json = String(url).endsWith('/oauth2/token') ? { access_token: 'tok' } : String(url).endsWith('/guilds') ? [] : { id: '9', username: 'someone' };
  return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
let signedIn = null;
let signInError = null;
try {
  signedIn = await discord.exchangeCode('the-code', 'http://localhost/callback');
} catch (err) {
  signInError = err;
} finally {
  globalThis.fetch = realFetch;
}
discord.setSettings({ clientId: '', clientSecret: null });

test('signing in with Discord sends the real client id and secret', () => {
  assert.equal(signInError, null, signInError?.message);
  const exchange = sent.find((r) => r.url.endsWith('/oauth2/token'));
  const form = new URLSearchParams(exchange.body);
  assert.equal(form.get('client_id'), '1199000000000000001');
  assert.equal(form.get('client_secret'), 'test-secret');
  assert.equal(form.get('code'), 'the-code');
  assert.equal(signedIn.user.username, 'someone');
});

// ---------------------------------------------------------------- roles that follow stream status

const { config } = await import('../../config.js');
const { bus, EVENTS, normaliseChat } = await import('../../core/bus.js');
const leveling = await import('../../leveling/index.js');
const roleSync = await import('../../engine/role-sync.js');

leveling.initLeveling();
roles.initDiscordRoles();
roleSync.initRoleSync();
roles.store.setRoleMappings({ subscriberTier1: 'r-t1', subscriberTier3: 'r-t3', vip: 'r-vip', follower: 'r-fol', bits1k: 'r-1k' });

const badgeTier = (v) => roleSync.readBadges({ raw: { badges: { subscriber: v } } }).tier;
const tiers = [badgeTier('0'), badgeTier('12'), badgeTier('2006'), badgeTier('3024')];
const founder = roleSync.readBadges({ isSub: true, raw: { badges: { founder: '0' } } });

// Every call to Discord is caught: the member holds VIP and tier 1 to begin with.
const calls = [];
let held = ['r-vip', 'r-t1'];
const realFetch2 = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const method = init.method || 'GET';
  calls.push(`${method} ${u.replace(/^.*\/api\/v10/, '')}`);
  const role = /\/roles\/([\w-]+)$/.exec(u)?.[1];
  if (method === 'PUT' && role) held = [...new Set([...held, role])];
  if (method === 'DELETE' && role) held = held.filter((r) => r !== role);
  if (method === 'GET' && /\/members\/\d+$/.test(u)) return new Response(JSON.stringify({ roles: held }), { status: 200 });
  return new Response(null, { status: 204 });
};
const realToken = config.discord.botToken;
config.discord.botToken = 'test-token';

const twitchChat = (badges) => bus.emit(EVENTS.CHAT, normaliseChat({
  platform: 'twitch', user: 'Viewer', userId: '555', msg: 'hi', isSub: 'subscriber' in badges, isVip: 'vip' in badges, raw: { badges },
}));

// A tier 3 subscriber, not a VIP, chats before anybody has linked them: nothing to do yet.
twitchChat({ subscriber: '3006' });
const beforeLink = calls.length;
const linked = await roleSync.link({ platform: 'twitch', platformId: '555', platformName: 'Viewer', discordId: '123456789012', discordName: 'ViewerD' });
const afterLink = [...held];
const listed = roleSync.linkedUsers();

// Now they turn up with a VIP badge.
twitchChat({ subscriber: '3006', vip: '1' });
await new Promise((r) => setTimeout(r, 900));
const afterVip = [...held];
// And chatting again with nothing new costs Discord nothing.
const callsBeforeRepeat = calls.length;
twitchChat({ subscriber: '3006', vip: '1' });
await new Promise((r) => setTimeout(r, 200));
const callsAfterRepeat = calls.length;

// A cheer from them over chat adds up towards the bits roles.
bus.emit(EVENTS.EVENT, { type: 'twitch_cheer', user: 'Viewer', data: { bits: 600, userId: '555' } });
bus.emit(EVENTS.EVENT, { type: 'twitch_cheer', user: 'Viewer', data: { bits: 500, userId: '555' } });
await new Promise((r) => setTimeout(r, 900));
const afterBits = [...held];

roleSync.unlink('twitch:555');
const afterUnlink = roleSync.linkedUsers();
config.discord.botToken = realToken;
globalThis.fetch = realFetch2;

test('a Twitch badge says which tier somebody subscribes at, and founders are subscribers', () => {
  assert.deepEqual(tiers, [1, 1, 2, 3]);
  assert.equal(founder.sub, true);
  assert.equal(founder.founder, true);
  assert.equal(founder.tier, undefined, 'a founder badge was read as a tier');
});

test('linking somebody gives them the roles their status earns and takes away the ones it rules out', () => {
  assert.equal(beforeLink, 0, 'Discord was asked about somebody not linked');
  assert.ok(linked.changed >= 3, JSON.stringify(linked));
  // Tier 3 given; tier 1 and VIP taken, since their badges say neither.
  assert.deepEqual(afterLink.sort(), ['r-t3']);
  assert.equal(listed['twitch:555'].username, 'ViewerD');
  assert.equal(listed['twitch:555'].platformName, 'Viewer');
});

test('a new badge in chat brings the role with it, and the same badges again cost nothing', () => {
  assert.deepEqual(afterVip.sort(), ['r-t3', 'r-vip']);
  assert.equal(callsAfterRepeat, callsBeforeRepeat, 'an unchanged chatter was re-checked with Discord');
});

test('bits add up across cheers, and a role that only ever gives is never taken away', () => {
  assert.ok(afterBits.includes('r-1k'), `bits role missing after 1100 bits: ${afterBits}`);
  // Nobody has seen them follow, and not seeing it is not the same as them not following.
  assert.ok(!calls.some((c) => c.includes('DELETE') && c.includes('r-fol')), 'a follower role was taken away without cause');
});

test('unlinking takes them off the list, and the screen is in both languages', () => {
  assert.equal(afterUnlink['twitch:555'], undefined);
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  assert.equal(strings.split('roleSyncNow:').length - 1, 2);
  const screen = fs.readFileSync(new URL('../../web/components/views/RoleManagementView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(screen.includes('await linkDiscord({') && !screen.includes('manualLinkUser('), 'the screen still links the old way');
});

// ---------------------------------------------------------------- button role menus reach Discord

const rows = roles.buttonRows([
  ...Array.from({ length: 7 }, (_, i) => ({ label: `R${i}`, roleId: `role${i}`, style: String((i % 4) + 1) })),
  { label: 'Again', roleId: 'role0', style: '1' },
  { label: 'Custom', roleId: 'rc', style: '9', emoji: '<a:party:112233445566>' },
  { label: '', roleId: 'rx', emoji: '🎮' },
]);

const menuCalls = [];
let messageGone = false;
const realFetch3 = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const method = init.method || 'GET';
  menuCalls.push({ method, path: String(url).replace(/^.*\/api\/v10/, ''), body: init.body ? JSON.parse(init.body) : null });
  if (method === 'PATCH' && messageGone) return new Response(JSON.stringify({ message: 'Unknown Message', code: 10008 }), { status: 404 });
  if (method === 'POST') return new Response(JSON.stringify({ id: `msg${menuCalls.length}` }), { status: 200 });
  return new Response(JSON.stringify({ id: 'same' }), { status: 200 });
};
config.discord.botToken = 'test-token';
roles.store.setButtonMenus([{ id: 'm1', name: 'Pronouns', channelId: '42', messageId: '', content: 'Pick yours', buttons: [{ label: 'he/him', roleId: '777', style: '3' }] }]);
const firstPost = await roles.publishButtonMenu('m1');
const savedId = roles.snapshot().discordButtonConfigs[0].messageId;
const secondPost = await roles.publishButtonMenu('m1');
messageGone = true;
const afterDeleted = await roles.publishButtonMenu('m1');
messageGone = false;
let noButtons = null;
roles.store.setButtonMenus([...roles.snapshot().discordButtonConfigs, { id: 'm2', name: 'Empty', channelId: '42', buttons: [{ label: 'x', roleId: '' }] }]);
try { await roles.publishButtonMenu('m2'); } catch (err) { noButtons = err.message; }
await roles.unpublishButtonMenu('m1');
config.discord.botToken = realToken;
globalThis.fetch = realFetch3;
roles.store.setButtonMenus([]);

test('a button menu becomes rows of five buttons, one per role, as Discord wants them', () => {
  assert.deepEqual(rows.map((r) => r.components.length), [5, 4]);
  const all = rows.flatMap((r) => r.components);
  assert.equal(all.filter((b) => b.custom_id === 'role:role0').length, 1, 'two buttons shared a role, which Discord refuses');
  const custom = all.find((b) => b.custom_id === 'role:rc');
  assert.deepEqual(custom.emoji, { id: '112233445566', name: 'party', animated: true });
  assert.equal(custom.style, 1, 'a style Discord does not have was kept');
  const unicode = all.find((b) => b.custom_id === 'role:rx');
  assert.deepEqual(unicode.emoji, { name: '🎮' });
  assert.equal(unicode.label, undefined);
});

test('a saved menu is posted with its buttons, then edited in place, and posted again if deleted in Discord', () => {
  const post = menuCalls.find((c) => c.method === 'POST');
  assert.equal(post.path, '/channels/42/messages');
  assert.equal(post.body.components[0].components[0].custom_id, 'role:777');
  assert.equal(savedId, firstPost.messageId, 'the posted message was not remembered, so presses could never be matched to it');
  assert.equal(secondPost.messageId, firstPost.messageId);
  assert.ok(menuCalls.some((c) => c.method === 'PATCH' && c.path === `/channels/42/messages/${firstPost.messageId}`), 'the second publish did not edit the message');
  assert.notEqual(afterDeleted.messageId, firstPost.messageId, 'a menu deleted in Discord was not posted again');
  assert.match(noButtons || '', /at least one button/);
  assert.ok(menuCalls.some((c) => c.method === 'DELETE' && c.path.startsWith('/channels/42/messages/')), 'deleting the menu left its message in Discord');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['buttonMenuPosted', 'buttonMenuNotPosted', 'buttonMenuPost', 'buttonMenuUpdate']) assert.equal(strings.split(key + ':').length - 1, 2, key);
});

// ---------------------------------------------------------------- viewers linking themselves

const linkCalls = [];
const realFetch4 = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const method = init.method || 'GET';
  const path = String(url).replace(/^.*\/api\/v10/, '');
  linkCalls.push({ method, path, body: init.body ? JSON.parse(init.body) : null });
  if (method === 'GET' && /\/members\/222222222222$/.test(path)) return new Response(JSON.stringify({ roles: [], nick: null, user: { username: 'poncho_real', global_name: 'PonchoD' } }), { status: 200 });
  if (method === 'GET' && /\/members\/\d+$/.test(path)) return new Response(JSON.stringify({ roles: [], user: { username: 'someone_else' } }), { status: 200 });
  return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
};
config.discord.botToken = 'test-token';

bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'Poncho', userId: '888', msg: '!linkdiscord @PonchoD', raw: { badges: {} } }));
const askedFor = roleSync.snapshot().pendingLinks;
// Somebody else confirms: nothing is linked to them.
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'discord', user: 'Mallory', userId: '333333333333', msg: '!linktwitch', raw: { channelId: 'c1' } }));
await new Promise((r) => setTimeout(r, 400));
const afterStranger = roleSync.linkedUsers()['twitch:888'];
// The account that was named confirms.
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'discord', user: 'PonchoD', userId: '222222222222', msg: '!linktwitch', raw: { channelId: 'c1' } }));
await new Promise((r) => setTimeout(r, 900));
const afterConfirm = roleSync.linkedUsers()['twitch:888'];
const stillPending = roleSync.snapshot().pendingLinks;
roleSync.unlink('twitch:888');
config.discord.botToken = realToken;
globalThis.fetch = realFetch4;

test('a viewer links themselves: asked from Twitch, confirmed in Discord by the account named, and nobody else', () => {
  assert.equal(Object.values(askedFor).find((p) => p.discordName === 'PonchoD' && p.want === 'discord')?.twitchUser, 'Poncho', JSON.stringify(askedFor));
  assert.equal(afterStranger, undefined, 'a Discord account that was not named confirmed the link');
  assert.equal(afterConfirm?.id, '222222222222');
  assert.equal(afterConfirm?.platformName, 'Poncho');
  assert.deepEqual(stillPending, {}, 'the request stayed pending after it was confirmed');
  const replies = linkCalls.filter((c) => c.method === 'POST' && c.path === '/channels/c1/messages').map((c) => c.body.content);
  assert.ok(replies.some((r) => r.startsWith('✅ <@222222222222>')), `no confirmation: ${JSON.stringify(replies)}`);
  assert.ok(replies.some((r) => r.startsWith('<@333333333333> ❔')), 'the stranger was not told what to do');
});

// ---------------------------------------------------------------- the activity log says who, by name

const logCalls = [];
const realFetch5 = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const path = String(url).replace(/^.*\/api\/v10/, '');
  logCalls.push(`${init.method || 'GET'} ${path}`);
  if (/\/members\/6666666666$/.test(path)) return new Response(JSON.stringify({ user: { username: 'azul', global_name: 'Azulado' } }), { status: 200 });
  return new Response(null, { status: 204 });
};
config.discord.botToken = 'test-token';
roles.store.clearActivityLog();
roles.store.setReactionRoles([{ messageId: 'rm1', guildId: 'g1', name: 'Colores', mode: 'normal', mappings: [{ emoji: '🔴', roleId: 'r-red', roleName: 'Red' }] }]);
bus.emit('discord:reaction_add', { message_id: 'rm1', guild_id: 'g1', user_id: '5555555555', emoji: { name: '🔴' }, member: { nick: 'Rojito', user: { username: 'rojo' } } });
await new Promise((r) => setTimeout(r, 700));
// Taking a reaction off comes without the member: remembered from before, or asked for once.
bus.emit('discord:reaction_remove', { message_id: 'rm1', guild_id: 'g1', user_id: '5555555555', emoji: { name: '🔴' } });
bus.emit('discord:reaction_remove', { message_id: 'rm1', guild_id: 'g1', user_id: '6666666666', emoji: { name: '🔴' } });
await new Promise((r) => setTimeout(r, 1200));
const namedLog = roles.snapshot().roleActivityLog.map((e) => [e.user, e.userId, e.action]);
config.discord.botToken = realToken;
globalThis.fetch = realFetch5;
roles.store.setReactionRoles([]);

test('the role activity log names people rather than showing their Discord id', () => {
  assert.deepEqual(namedLog.slice().reverse(), [
    ['Rojito', '5555555555', 'added'],
    ['Rojito', '5555555555', 'removed'],
    ['Azulado', '6666666666', 'removed'],
  ]);
  // Rojito was named by the reaction itself: nobody asked Discord who they were.
  assert.ok(!logCalls.some((c) => c.startsWith('GET') && c.endsWith('/members/5555555555')), 'a known name was looked up again');
});

// ---------------------------------------------------------------- the streamer is not a top chatter

{
  const { collection } = await import('../../core/store.js');
  // As the server always has it by now: the Twitch connection's own accounts known (nothing connects).
  (await import('../../platforms/twitch.js')).initTwitch();
  const twitchCreds = collection('twitch_credentials', {});
  const before = twitchCreds.get();
  twitchCreds.set({ ...before, userId: '9001', login: 'mistreamer', botLogin: 'mibot' });
  const say = (over) => bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', msg: 'hola', ...over }));
  say({ user: 'MiStreamer', userId: '9001' });
  say({ user: 'MiBot', userId: '9002', isBot: true });
  say({ user: 'Owner', userId: 'UCowner', platform: 'youtube', isBroadcaster: true });
  say({ user: 'Fan', userId: '7777' });
  await new Promise((r) => setTimeout(r, 50));
  const board = leveling.leaderboard().map((u) => u.username);
  const everyone = Object.values(leveling.getUsers()).map((u) => u.username);
  twitchCreds.set(before);

  test('the streamer and their bot keep their XP, but are not ranked among the chatters', () => {
    assert.ok(board.includes('Fan'), 'a viewer is missing from the board');
    for (const own of ['MiStreamer', 'MiBot', 'Owner']) {
      assert.ok(!board.includes(own), `${own} is ranked as a chatter`);
      assert.ok(everyone.includes(own), `${own} lost their XP`);
    }
    assert.equal(normaliseChat({ platform: 'twitch', user: 'x', isBot: true }).isBot, true, 'a chat message forgets it came from the bot');
    const twitchSrc = fs.readFileSync(new URL('../platforms/twitch.js', SCRIPT_URL), 'utf8');
    assert.ok(twitchSrc.includes('const byBot = Boolean(c.botLogin) &&') && twitchSrc.includes('isBot: byBot,'), 'Twitch does not say which messages are the bot\'s');
  });
}
