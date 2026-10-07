/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Voice call screen's audit. Somebody kept off stream is in
 * no list the stream reads; a name for the stream in place of a Discord one;
 * the call that follows one person; the bot only in a call with somebody in
 * it; statuses and upload refusals in the screen's language.
 *
 * Builds on the call discord-voice.js set up (server g1, channels vc1 and vc2).
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, fs, test } from './harness.js';
import { fillTemplate } from './layers.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const voice = await import('../../platforms/discord-voice.js');
const { refusalKey } = await import('../../../web/words.ts');
const constants = read('../../web/constants.ts');
const bothLanguages = (key) => constants.split(`    ${key}: '`).length - 1 === 2;

const member = (id, name) => ({ user: { id, username: name.toLowerCase(), global_name: name, avatar: `hash${id}` }, nick: null });
const state = (id, channelId, name) => bus.emit('discord:voice_state', { guild_id: 'g1', user_id: id, channel_id: channelId, member: member(id, name) });

// A call of three on vc1.
voice.setVoice({ channelId: 'vc1', listen: false, follow: null, persons: {} });
state('500001', 'vc1', 'Ana');
state('500002', 'vc1', 'Bo');
state('500003', 'vc1', 'Cy');

// ------------------------------------------------------------ off stream, and names on stream

voice.setVoice({ persons: {
  500002: { name: 'Bo', offStream: true },
  500003: { name: 'Cy', streamName: '  CyTTV  ' },
  500001: { name: 'Ana' },
  nope: { offStream: true },
} });
const withSettings = voice.getState();

test('somebody kept off stream is in no list the stream reads, and the screen still lists them', () => {
  const ids = withSettings.members.map((m) => m.id);
  assert.ok(!ids.includes('500002'), 'somebody who asked not to be shown is on the list overlays draw');
  assert.deepEqual(withSettings.offStream.map((m) => [m.id, m.offStream]), [['500002', true]]);
  // Text values and the layer condition read the same list.
  assert.ok(!fillTemplate('{voiceTalking}', { voice: { ...withSettings, members: withSettings.members.map((m) => ({ ...m, speaking: true })) } }).includes('Bo'));
  assert.equal(fillTemplate('{voiceCount}', { voice: withSettings }), String(withSettings.members.length));
  // Somebody with nothing set is not kept; nor is an id that is not Discord's.
  assert.deepEqual(Object.keys(withSettings.persons).sort(), ['500002', '500003']);
});

test('a name for the stream replaces the Discord one there, and the screen keeps both', () => {
  const cy = withSettings.members.find((m) => m.id === '500003');
  assert.deepEqual([cy.name, cy.discordName], ['CyTTV', 'Cy']);
  const ana = withSettings.members.find((m) => m.id === '500001');
  assert.equal(ana.name, 'Ana');
  // Somebody nobody could name is named in the stream's language.
  assert.ok(read('../platforms/discord-voice.js').includes("name: own.streamName || who.name || 'Alguien',"));
});

// ------------------------------------------------------------ following one person

voice.setVoice({ follow: { id: '500001', name: 'Ana' } });
const followingOnVc1 = voice.getState();
state('500001', 'vc2', 'Ana');
const followedToVc2 = voice.getState();
state('500001', null, 'Ana');
const followedOut = voice.getState();
voice.setVoice({ listen: true });
const waitingForThem = voice.getState();
state('500001', 'vc1', 'Ana');
const backInACall = voice.getState();
voice.setVoice({ listen: false, follow: null });
const backToChannel = voice.getState();

test('following a person shows whichever call they are in, and moves with them', () => {
  assert.equal(followingOnVc1.channelId, 'vc1');
  assert.deepEqual(followingOnVc1.follow, { id: '500001', name: 'Ana' });
  assert.equal(followedToVc2.channelId, 'vc2');
  assert.deepEqual(followedToVc2.members.map((m) => m.id), ['500001'], 'the old channel\'s people came along');
  assert.equal(followedOut.channelId, '');
  assert.deepEqual(followedOut.members, []);
  // Everybody who could be followed, to choose from.
  assert.ok(followingOnVc1.inVoice.some((p) => p.id === '500001' && p.channelId === 'vc1'));
  assert.equal(backToChannel.channelId, 'vc1', 'turning following off did not go back to the channel');
});

// ------------------------------------------------------------ only in a call with somebody in it

voice.setVoice({ channelId: 'vc9', listen: true });
const emptyChannel = voice.getState();
state('500004', 'vc9', 'Dee');
const somebodyCame = voice.getState();
voice.setVoice({ listen: false, channelId: 'vc1' });

test('the bot waits outside an empty call, and goes in when somebody arrives', () => {
  assert.deepEqual([waitingForThem.status, waitingForThem.errorCode], ['waiting', 'voice_waiting_follow']);
  assert.deepEqual([emptyChannel.status, emptyChannel.errorCode], ['waiting', 'voice_waiting_empty']);
  // With no bot connected here, going in means waiting for the bot.
  assert.deepEqual([somebodyCame.status, somebodyCame.errorCode], ['joining', 'voice_waiting_bot']);
  assert.deepEqual([backInACall.status, backInACall.errorCode], ['joining', 'voice_waiting_bot']);
  // Once in, an empty call gets two minutes before the bot leaves it.
  assert.equal(voice.EMPTY_GRACE_MS, 2 * 60 * 1000);
  const src = read('../platforms/discord-voice.js');
  assert.ok(src.includes('if (here > 0) stopEmptyClock();\n  else startEmptyClock();') || src.includes('if (here > 0) stopEmptyClock();\r\n  else startEmptyClock();'));
  assert.ok(src.includes('if (!want || humansIn(want) === 0) {'), 'it leaves without checking the call is still empty');
});

// ------------------------------------------------------------ a dropped gateway

const beforeDrop = voice.getState().members.length;
bus.emit('discord:closed');
const justAfterDrop = voice.getState().members.length;
bus.emit('discord:resumed');

test('a dropped Discord connection stops everybody glowing, and keeps the call for a resume', () => {
  assert.equal(justAfterDrop, beforeDrop, 'the call was thrown away before the session could resume');
  const src = read('../platforms/discord-voice.js');
  assert.ok(src.includes("bus.on('discord:closed', () => {\n    speaking.clear();") || src.includes("bus.on('discord:closed', () => {\r\n    speaking.clear();"));
  assert.ok(src.includes('staleTimer = setTimeout(() => { present.clear(); publish(); }, STALE_MS);'));
  const gateway = read('../platforms/discord.js');
  assert.equal(gateway.split("bus.emit('discord:closed');").length - 1, 2, 'the gateway does not say when it drops');
  assert.ok(gateway.includes("bus.emit('discord:resumed');"));
});

// ------------------------------------------------------------ words

test('the call\'s statuses and every upload refusal have words in both languages', () => {
  const codes = new Set([
    ...read('../platforms/discord-voice.js').matchAll(/'(voice_[a-z_]+)'/g),
    ...read('../api/http.js').matchAll(/\.code = '([a-z_]+)'/g),
  ].map((m) => m[1]));
  assert.ok(codes.size >= 8, `only ${codes.size} codes`);
  for (const code of codes) assert.ok(bothLanguages(refusalKey(code)), `${code} is not in both languages`);
  assert.ok(bothLanguages('uploading'), '"Uploading…" was never translated');
  // The upload's code reaches the screen, and every upload button looks its words up.
  assert.ok(read('../../web/hooks/useStreamSystem.ts').includes('if (body?.code) err.code = body.code;'));
  for (const f of ['VoicePicturesEditor.tsx', 'ImageLayerPanel.tsx', 'OmnibarLogoPanel.tsx', 'PngtuberLayerPanel.tsx', 'FontUploadButton.tsx', 'views/DockActionsView.tsx']) {
    assert.ok(read(`../../web/components/${f}`).includes('refusalWords(t, err)'), `${f} shows an upload refusal in English`);
  }
});

test('the Voice call screen: a channel or a person, off stream, a name, and the avatar shown where there is no picture', () => {
  const view = read('../../web/components/views/VoiceView.tsx');
  assert.ok(view.includes('data-voice-follow') && view.includes('data-voice-off-stream-toggle'));
  assert.ok(view.includes('<VoicePixel look={entry.look} accent={accent} pixelAvatars={pixelAvatars} /></span>'), 'somebody drawn as the pixel avatar shows a broken picture');
  assert.ok(read('../../web/components/VoicePicturesEditor.tsx').includes('data-voice-stream-name'));
  const keys = new Set();
  for (const f of ['views/VoiceView.tsx', 'VoicePicturesEditor.tsx']) {
    for (const m of read(`../../web/components/${f}`).matchAll(/\bt\??\.([a-zA-Z]+)/g)) keys.add(m[1]);
  }
  assert.ok(keys.size >= 35, `only ${keys.size} strings found`);
  for (const key of keys) assert.ok(bothLanguages(key), `${key} is not in both languages`);
});

voice.setVoice({ persons: {}, follow: null, listen: false });

// ------------------------------------------------------------ the server's members

/*
  Everybody in the server, not only whoever is in a call, so a regular can be
  set up before they join one. Discord hands the list out a thousand at a
  time; the paging is awaited here, and what it did asserted below.
*/
const discordPlatform = await import('../../platforms/discord.js');
const pagesAsked = [];
const firstPage = Array.from({ length: 1000 }, (_, i) => ({ user: { id: String(1000 + i) } }));
const paged = await discordPlatform.allPages(async (after) => {
  pagesAsked.push(after);
  return after === '0' ? firstPage : after === '1999' ? [{ user: { id: '3000' } }] : [];
});
let endlessCalls = 0;
await discordPlatform.allPages(async (after) => {
  endlessCalls += 1;
  return Array.from({ length: 1000 }, (_, i) => ({ user: { id: String(Number(after) + i + 1) } }));
});

test('the server\'s members are listed, to set somebody up before they join a call', () => {
  // Page after page, each asked for after the last one's id, until one comes back short.
  assert.equal(paged.length, 1001);
  assert.deepEqual(pagesAsked, ['0', '1999']);
  // A list that never ends is not asked for forever.
  assert.equal(endlessCalls, 10);

  // People only, by the name they go by here, in order however their names are written.
  const listed = voice.serverMemberList([
    { user: { id: '600001', username: 'zed', global_name: 'Zed' }, nick: null },
    { user: { id: '600002', username: 'musicbot', bot: true }, nick: null },
    { user: { id: '600003', username: 'sharky', global_name: 'Sharky', avatar: 'abc' }, nick: 'Delfín' },
    { user: { id: '600004', username: 'ana_22', global_name: null }, nick: null, avatar: 'srv' },
    { nick: 'no user at all' },
  ], 'g1');
  assert.deepEqual(listed.map((p) => p.name), ['ana_22', 'Delfín', 'Zed'], 'bots listed, or not by name');
  assert.deepEqual(listed.find((p) => p.id === '600003'), { id: '600003', name: 'Delfín', username: 'sharky', avatar: 'https://cdn.discordapp.com/avatars/600003/abc.png?size=128' });
  // The picture set for this server wins over the account's.
  assert.equal(listed.find((p) => p.id === '600004').avatar, 'https://cdn.discordapp.com/guilds/g1/users/600004/avatars/srv.png?size=128');

  // Asked for through the Discord passthrough; the bot already asks for the intent it needs.
  assert.ok(read('../../server/api/ws.js').includes("case 'server_members': return discordVoice.serverMembers();"));
  assert.ok(read('../../server/platforms/discord.js').includes('/guilds/${guildId}/members?limit=1000&after=${after}'));
  assert.ok(/const INTENTS = [^;]*\(1 << 1\)/.test(read('../../server/platforms/discord.js')), 'the bot no longer asks for the Server Members intent');

  // On the screen: asked for once as it opens, not at every change of state; searched; and a click opens their settings.
  const view = read('../../web/components/views/VoiceView.tsx');
  assert.ok(view.includes('listServer.current = listServerMembers;') && view.includes('}, [botConnected]);'), 'the list is asked for again at every change of state');
  assert.ok(view.includes('data-voice-server-search') && view.includes('[p.name, p.username].some((s) => fold(s).includes(fold(serverQuery.trim())))'));
  assert.ok(view.includes('onClick={() => setEditing(editing === p.id ? null : p.id)}'));
  assert.ok(view.includes('server?.find((p) => p.id === editing)?.name'), 'somebody from the server\'s list is edited without their name');
  assert.ok(read('../../web/App.tsx').includes('listServerMembers={(system.actions as any).listServerMembers}'));
  for (const key of ['voiceServerTitle', 'voiceServerLoading', 'voiceServerNoBot', 'voiceServerFailed', 'voiceServerSearch', 'voiceServerNone', 'voiceServerMore', 'voiceServerSetUp', 'voiceServerInCall']) {
    assert.ok(bothLanguages(key), `${key} is not in both languages`);
  }
});
