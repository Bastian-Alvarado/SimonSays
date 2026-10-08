/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: YouTube accounts linked to Discord — by hand from the Role
 * Management screen, or by the viewer from both sides — and the roles their
 * membership, moderation and Super Chats earn; Twitch followers listed in
 * the link window to pick from; and the per-command switch that keeps a
 * command out of Discord.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After discord.js, which
 * set role sync up.
 */

import { SCRIPT_URL, assert, bus, collection, discordSent, engine, EVENTS, fs, normaliseChat, normaliseEvent, said, test } from './harness.js';

const roleSync = await import('../../engine/role-sync.js');
const roles = await import('../../engine/discord-roles.js');
const { config } = await import('../../config.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- linking YouTube

const GUILD = '900000000000000003';
const discordSettings = collection('discord_settings', {});
const settingsBefore = discordSettings.get();
discordSettings.set({ ...settingsBefore, guildId: GUILD });
const mappingsBefore = roles.getRoleMappings();
roles.store.setRoleMappings({ youtubeMember: 'r-ytm', youtubeModerator: 'r-ytmod', youtubeSuperChat: 'r-ytsc' });

// Every call to Discord is caught; the member holds nothing to begin with.
const calls = [];
let held = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.includes('discord.com')) return realFetch(url, init);
  const method = init.method || 'GET';
  calls.push(`${method} ${u.replace(/^.*\/api\/v10/, '')}`);
  const role = /\/roles\/([\w-]+)$/.exec(u)?.[1];
  if (method === 'PUT' && role) held = [...new Set([...held, role])];
  if (method === 'DELETE' && role) held = held.filter((r) => r !== role);
  if (method === 'GET' && /\/members\/\d+$/.test(u)) return new Response(JSON.stringify({ roles: held, nick: null, user: { username: 'ponchoyt', global_name: 'PonchoYT' } }), { status: 200 });
  return new Response(null, { status: 204 });
};
const realToken = config.discord.botToken;
config.discord.botToken = 'test-token';

const CHANNEL = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const ytChat = (over) => bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'youtube', user: 'Yutubero', userId: CHANNEL, msg: 'hola', ...over }));

// They have chatted on YouTube before anybody links them: a member.
ytChat({ isSub: true });
await wait(50);
const found = await roleSync.findYoutube('yutu');
const byNothing = await roleSync.findYoutube('nadie-se-llama-asi');
await roleSync.link({ platform: 'youtube', platformId: CHANNEL, platformName: 'Yutubero', discordId: '444444444444', discordName: 'YutuD' });
const afterLink = [...held];
const listed = roleSync.linkedUsers()[`youtube:${CHANNEL}`];
// The membership lapses; then a Super Chat.
ytChat({ isSub: false });
await wait(700);
const afterLapse = [...held];
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'youtube_cheer', platform: 'youtube', user: 'Yutubero', data: { amount: 'MX$100.00', userId: CHANNEL } }));
await wait(700);
const afterSuperChat = [...held];
roleSync.unlink(`youtube:${CHANNEL}`);

// A viewer linking themselves: asked from YouTube chat, confirmed from any Discord channel.
const SELF = 'UCbbbbbbbbbbbbbbbbbbbbbb';
held = [];
ytChat({ user: 'PonchoYT', userId: SELF, msg: '!linkdiscord PonchoYT' });
await wait(20);
const pendingAfterAsk = Object.values(roleSync.snapshot().pendingLinks);
bus.emit('discord:message_elsewhere', normaliseChat({ platform: 'discord', user: 'PonchoYT', userId: '555555555555', msg: '!linkyoutube', raw: { channelId: '700000000000000777' } }));
await wait(900);
const selfLinked = roleSync.linkedUsers()[`youtube:${SELF}`];
roleSync.unlink(`youtube:${SELF}`);

globalThis.fetch = realFetch;
config.discord.botToken = realToken;
roles.store.setRoleMappings(mappingsBefore);
discordSettings.set(settingsBefore);

test('a YouTube viewer is found by the name they chat under, and linked by their channel id', () => {
  assert.ok(found.seen.some((p) => p.id === CHANNEL && p.name === 'Yutubero'), JSON.stringify(found));
  assert.equal(found.found, null, 'a plain name was looked up on YouTube');
  assert.deepEqual(byNothing.seen, []);
  assert.equal(listed?.username, 'YutuD');
  assert.equal(listed?.platformName, 'Yutubero');
});

test('membership gives its role and its end takes it away; a Super Chat gives its own', () => {
  assert.deepEqual(afterLink, ['r-ytm'], 'linking a member did not give the member role');
  assert.deepEqual(afterLapse, [], 'a lapsed membership kept its role');
  assert.deepEqual(afterSuperChat, ['r-ytsc']);
});

test('a viewer links YouTube themselves: !linkdiscord in its chat, !linkyoutube in any Discord channel', () => {
  assert.deepEqual(pendingAfterAsk.map((p) => [p.platform, p.discordName]), [['youtube', 'PonchoYT']]);
  assert.equal(selfLinked?.id, '555555555555', 'the confirmation from another channel did not link them');
  const superChat = read('../platforms/youtube.js');
  assert.ok(superChat.includes("amount: details.amountDisplayString || '',") && superChat.includes("userId: common.userId || '',"), 'a Super Chat does not say who sent it');
  const view = read('../../web/components/views/RoleManagementView.tsx');
  assert.ok(view.includes("['discord', 'twitch', 'tiktok', 'youtube'] : ['twitch', 'tiktok', 'youtube']) as PickPlatform[])") && view.includes("'youtubeMember'"), 'the screen does not offer YouTube');
  assert.ok(view.includes('data-link-discord-member={m.id}') && view.includes('listServerMembers()'), 'the link window does not list the server');
});

// ---------------------------------------------------------------- picking a Twitch follower

{
  const twitch = await import('../../platforms/twitch.js');
  twitch.initTwitch();
  const twitchCreds = collection('twitch_credentials', {});
  const credsBefore = twitchCreds.get();
  twitchCreds.set({ ...credsBefore, userId: '8001', accessToken: 'tok', clientId: 'cid' });

  // 103 followers over two pages, newest first; pictures asked for by id.
  const asked = [];
  let withScope = true;
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    if (u.hostname !== 'api.twitch.tv') return fetchBefore(url, init);
    asked.push(u.pathname + (u.searchParams.get('after') ? `?after=${u.searchParams.get('after')}` : ''));
    const json = (body) => new Response(JSON.stringify(body), { status: 200 });
    if (u.pathname.endsWith('/channels/followers')) {
      if (!withScope) return json({ data: [], total: 50, pagination: {} });
      const page = u.searchParams.get('after') ? 1 : 0;
      const ids = page === 0 ? Array.from({ length: 100 }, (_, i) => i) : [100, 101, 102];
      return json({
        total: 103,
        data: ids.map((i) => ({ user_id: `f${i}`, user_login: `fan_${i}`, user_name: i === 0 ? 'Fan_0' : `Fan ${i}`, followed_at: new Date(Date.UTC(2026, 9, 3) - i * 86400000).toISOString() })),
        pagination: page === 0 ? { cursor: 'next' } : {},
      });
    }
    if (u.pathname.endsWith('/users')) return json({ data: u.searchParams.getAll('id').map((id) => ({ id, profile_image_url: `https://pic/${id}.png` })) });
    return json({ data: [] });
  };

  const listed = await twitch.listFollowers();
  const requestsFirst = asked.length;
  const again = await twitch.listFollowers();
  const requestsAgain = asked.length - requestsFirst;
  twitchCreds.set({ ...twitchCreds.get(), userId: '8002' });
  withScope = false;
  let noScope = null;
  try { await twitch.listFollowers(); } catch (err) { noScope = err.message; }

  globalThis.fetch = fetchBefore;
  twitchCreds.set(credsBefore);

  test('the link window lists every Twitch follower, newest first, with their pictures', () => {
    assert.equal(listed.followers.length, 103);
    assert.equal(listed.total, 103);
    assert.equal(listed.complete, true);
    assert.deepEqual(listed.followers[0], { id: 'f0', login: 'fan_0', name: 'Fan_0', followedAt: Date.UTC(2026, 9, 3), avatar: 'https://pic/f0.png' });
    assert.equal(listed.followers[102].avatar, 'https://pic/f102.png', 'the second hundred has no pictures');
    assert.deepEqual(asked.slice(0, requestsFirst), ['/helix/channels/followers', '/helix/channels/followers?after=next', '/helix/users', '/helix/users']);
    assert.equal(requestsAgain, 0, 'opening the window again paged through the list again');
    assert.equal(again, listed);
    assert.match(noScope || '', /moderator:read:followers/, 'a token without the scope looked like a channel nobody follows');
  });

  test('followers are picked from the list, filtered as you type, and Enter still finds anybody', () => {
    const view = read('../../web/components/views/RoleManagementView.tsx');
    assert.ok(view.includes('data-link-twitch-follower={f.id}') && view.includes('listTwitchFollowers()'), 'the link window does not list the followers');
    assert.ok(view.includes("f.name.toLowerCase().includes(followerQuery) || f.login.toLowerCase().includes(followerQuery)"), 'the list is not filtered by what is typed');
    assert.ok(view.includes('const data = await getTwitchUser(manualLinkTwitchUser);'), 'a name that does not follow can no longer be looked up');
    assert.ok(read('../api/ws.js').includes("if (op === 'twitch_followers') return reply(await twitch.listFollowers());"));
  });
}

// ---------------------------------------------------------------- a command kept out of Discord

const saved = engine.store.saveCommand({ id: 'cmd-twitch-only', name: 'Solo Twitch', triggers: ['!solotwitch'], enabled: true, permissions: { anyone: true }, globalCooldown: 0, userCooldown: 0, discord: false });
engine.store.saveCommand({ id: 'cmd-everywhere-2', name: 'Todos', triggers: ['!todos'], enabled: true, permissions: { anyone: true }, globalCooldown: 0, userCooldown: 0 });
const byDefault = engine.snapshot().commands.find((c) => c.id === 'cmd-everywhere-2');
engine.store.saveAction({
  id: 'act-twitch-only', name: 'Solo Twitch', enabled: true,
  trigger: { id: 'tr-to', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-twitch-only' } },
  actions: [{ id: 's1', type: 'twitch_chat', config: { message: 'Solo para {user}', sendTo: 'origin' } }],
});
const sentBefore = discordSent.length;
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'discord', user: 'EnDiscord', userId: 'd1', msg: '!solotwitch', raw: { channelId: '700000000000000888' } }));
bus.emit('discord:message_elsewhere', normaliseChat({ platform: 'discord', user: 'EnOtroCanal', userId: 'd2', msg: '!solotwitch', raw: { channelId: '700000000000000889' } }));
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'EnTwitch', userId: 't1', msg: '!solotwitch' }));
await wait(60);
const fromDiscord = discordSent.slice(sentBefore).length;
engine.store.deleteAction('act-twitch-only');
engine.store.deleteCommand('cmd-twitch-only');
engine.store.deleteCommand('cmd-everywhere-2');

test('a command turned off for Discord does not run there, in any channel, and still runs on Twitch', () => {
  assert.equal(saved.find((c) => c.id === 'cmd-twitch-only')?.discord, false, 'the switch was not kept');
  assert.equal(byDefault?.discord, true, 'a command is not for Discord by default');
  assert.equal(fromDiscord, 0, 'it ran from Discord');
  assert.ok(!said.some((s) => s === 'Solo para EnDiscord' || s === 'Solo para EnOtroCanal'));
  assert.ok(said.includes('Solo para EnTwitch'));
  assert.ok(read('../../web/components/CommandEditorModal.tsx').includes('data-command-discord'));
});
