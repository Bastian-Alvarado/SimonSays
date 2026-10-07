/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Discord voice — who is in the chosen call, muted or deafened,
 * from the gateway's voice states. Who is talking needs a real call, so it
 * is checked by hand; what is tested here is everything around it.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, EVENTS, fs, settle, test } from './harness.js';
import { MANIFEST, LAYER_TYPES, normaliseLayout } from './backup-and-layouts.js';
import { fillTemplate } from './layers.js';
import { CSS_LOOKS } from './stylesheets.js';

const { conditionMet } = await import('../../../shared/layer-conditions.js');

const discord = await import('../../platforms/discord.js');
const voice = await import('../../platforms/discord-voice.js');

// No token, and AUTO_START is off: this only sets up the settings it reads.
discord.initDiscord();
discord.setSettings({ guildId: 'g1' });
voice.initDiscordVoice();

const told = [];
const stopTold = bus.on(EVENTS.CONFIG, ({ key, value }) => { if (key === 'voice') told.push(value); });

const member = (id, name, extra = {}) => ({ user: { id, username: name.toLowerCase(), global_name: name, avatar: `hash${id}` }, nick: null, ...extra });

bus.emit('discord:guild_create', {
  id: 'g1',
  members: [member('100', 'Rowan'), member('200', 'Nolan', { nick: 'Nel' }), member('300', 'Music Bot'), member('400', 'Elsewhere')],
  voice_states: [
    { user_id: '100', channel_id: 'vc1', self_mute: false, self_deaf: false },
    { user_id: '200', channel_id: 'vc1', self_mute: true, self_deaf: false },
    { user_id: '400', channel_id: 'vc2', self_mute: false, self_deaf: false },
  ],
});
// Another server's call is none of this one's business.
bus.emit('discord:voice_state', { guild_id: 'other', user_id: '900', channel_id: 'vc1', member: member('900', 'Stranger') });
// A bot in the call is not somebody to light up.
bus.emit('discord:voice_state', { guild_id: 'g1', user_id: '300', channel_id: 'vc1', member: { ...member('300', 'Music Bot'), user: { ...member('300', 'Music Bot').user, bot: true } } });

voice.setVoice({ channelId: 'vc1' });
const firstLook = voice.getState();

bus.emit('discord:voice_state', { guild_id: 'g1', user_id: '100', channel_id: 'vc1', self_mute: false, self_deaf: true, member: member('100', 'Rowan') });
bus.emit('discord:voice_state', { guild_id: 'g1', user_id: '200', channel_id: null, member: member('200', 'Nolan', { nick: 'Nel' }) });
bus.emit('discord:voice_state', { guild_id: 'g1', user_id: '400', channel_id: 'vc1', member: member('400', 'Elsewhere') });
const afterMoves = voice.getState();

// Asked to listen with no bot connected: it waits rather than failing.
voice.setVoice({ listen: true });
const waiting = voice.getState();
voice.setVoice({ listen: false });
const stopped = voice.getState();
await settle();
await settle();
// After a quiet spell, the next change is told at once rather than batched.
const toldBefore = told.length;
bus.emit('discord:voice_state', { guild_id: 'g1', user_id: '100', channel_id: 'vc1', self_deaf: false, member: member('100', 'Rowan') });
const toldAtOnce = told.length - toldBefore;
stopTold();

test('the voice call shows who is in the chosen channel, in the order they came, by the name they go by here', () => {
  assert.deepEqual(firstLook.members.map((m) => m.name), ['Rowan', 'Nel']);
  assert.equal(firstLook.members[0].avatar, 'https://cdn.discordapp.com/avatars/100/hash100.png?size=128');
  assert.equal(firstLook.members[1].muted, true);
  assert.equal(firstLook.members[0].speaking, false, 'somebody is talking before the bot has heard anyone');
});

test('joining, leaving and deafening in the call follow along, and bots and other servers are left out', () => {
  assert.deepEqual(afterMoves.members.map((m) => [m.name, m.deafened]), [['Rowan', true], ['Elsewhere', false]]);
  assert.ok(!afterMoves.members.some((m) => m.name === 'Stranger' || m.name === 'Music Bot'));
  assert.ok(told.length >= 1, 'the screens were not told');
});

test('the first change after a quiet spell reaches the screens at once', () => {
  assert.equal(toldAtOnce, 1, 'the change waited for the next batch');
});

test('listening waits for the bot, and stops cleanly', () => {
  assert.equal(waiting.status, 'joining');
  assert.match(waiting.error, /bot/);
  assert.equal(stopped.status, 'off');
  assert.equal(stopped.listen, false);
});

test('the voice settings travel in a backup, the gateway asks for voice states, and the screen is in both languages', () => {
  assert.ok(MANIFEST.some((e) => e.name === 'discord_voice'));
  const gateway = fs.readFileSync(new URL('../platforms/discord.js', SCRIPT_URL), 'utf8');
  assert.ok(gateway.includes('(1 << 7)'), 'the bot does not ask for voice states');
  const source = fs.readFileSync(new URL('../platforms/discord-voice.js', SCRIPT_URL), 'utf8');
  // Muted, and never deafened — a deafened bot is sent no voice to tell anything from.
  assert.ok(source.includes('selfMute: true') && source.includes('selfDeaf: false'));
  // Who is talking comes from the library's speaking map, never from a subscription to the audio.
  assert.ok(source.includes('receiver.speaking.on(') && !source.includes('receiver.subscribe('), 'the bot subscribes to somebody\'s audio');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['voiceNav', 'voiceListen', 'voiceListenHint', 'voiceListening', 'voiceEmpty']) assert.equal(strings.split(key + ':').length - 1, 2, key);
});

test('a voice layer keeps its tiles sized for the room it has, and leaves out who it is told to', () => {
  assert.ok(LAYER_TYPES.includes('voice'), 'there is no voice layer');
  const layer = (config) => normaliseLayout({ id: 'v', layers: [{ type: 'voice', uid: 'vo', config }] }).layers[0].config;
  assert.equal(layer({}).slots, 6);
  assert.equal(layer({ slots: 99 }).slots, 25);
  assert.equal(layer({ arrange: 'spiral' }).arrange, 'row');
  assert.equal(layer({ show: 'talking' }).show, 'talking');
  assert.deepEqual(layer({ hide: [{ id: '306050655881793586', name: 'Rowan' }, { id: 'not-an-id', name: 'x' }] }).hide, [{ id: '306050655881793586', name: 'Rowan' }]);
  // Two voice layers in one layout: one per person is a common way to lay a call out.
  const two = normaliseLayout({ id: 'v2', layers: [{ type: 'voice', uid: 'a' }, { type: 'voice', uid: 'b' }] }).layers;
  assert.equal(two.filter((l) => l.type === 'voice').length, 2);
  const view = fs.readFileSync(new URL('../../web/components/VoiceLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('Math.max(config.slots ?? 6, shown.length)'), 'tiles are sized by who is there rather than the room');
  for (const part of ['data-voice="avatar"', 'data-voice-speaking=', 'data-voice-muted=', 'data-voice="name"']) assert.ok(view.includes(part), `${part} is not named for a theme`);
});

test('other layers can wait for somebody talking, and text can say who', () => {
  const state = { voice: { channelId: 'vc1', members: [{ name: 'Rowan', speaking: true }, { name: 'Nel', speaking: false }] } };
  assert.equal(conditionMet('voice', false, state), true);
  assert.equal(conditionMet('voice', true, state), false);
  assert.equal(fillTemplate('{voiceCount} in the call, {voiceTalking} talking', state), '2 in the call, Rowan talking');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['voiceArrange', 'voiceSlots', 'voiceShowTalking', 'voiceHide', 'voiceGlow']) assert.equal(strings.split(key + ':').length - 1, 2, key);
});

// Pictures of their own, PNGtuber style: Rowan (100) is in the call; somebody given pictures before is not.
voice.setVoice({ pictures: {
  100100100100: { name: 'Rowan', quiet: '/media/rowan-quiet.png', talking: '/media/rowan-talk.png', muted: 'javascript:alert(1)' },
  200200200200: { name: 'Nel', quiet: 'https://example.com/nel.png' },
  'not-an-id': { quiet: '/media/x.png' },
  300300300300: { name: 'Nobody', quiet: '../../.env' },
} });
bus.emit('discord:voice_state', { guild_id: 'g1', user_id: '100100100100', channel_id: 'vc1', member: member('100100100100', 'Rowan') });
const pictured = voice.getState();

test('somebody\'s own pictures are kept by their id, safe links only, and follow them into the call', () => {
  assert.deepEqual(Object.keys(pictured.pictures).sort(), ['100100100100', '200200200200']);
  assert.deepEqual(pictured.pictures['100100100100'], { name: 'Rowan', quiet: '/media/rowan-quiet.png', talking: '/media/rowan-talk.png' });
  const rowan = pictured.members.find((m) => m.id === '100100100100');
  assert.equal(rowan?.pictures?.talking, '/media/rowan-talk.png', 'the person in the call does not carry their pictures');
  // Nel is not in the call, and keeps hers for when she is.
  assert.equal(pictured.pictures['200200200200'].name, 'Nel');
  assert.ok(MANIFEST.some((e) => e.name === 'discord_voice'), 'the pictures would not travel in a backup');
});

test('a voice layer draws somebody\'s pictures whole, all loaded, and can be told not to', () => {
  const layer = (config) => normaliseLayout({ id: 'v', layers: [{ type: 'voice', uid: 'vo', config }] }).layers[0].config;
  assert.equal(layer({}).usePictures, true);
  assert.equal(layer({ usePictures: false }).usePictures, false);
  assert.equal(layer({}).hop, true);
  const view = fs.readFileSync(new URL('../../web/components/VoiceLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('data-voice="picture"') && view.includes('object-contain'), 'a picture is cropped like an avatar');
  // Every picture they have is on the page, so a swap never waits for one to load.
  assert.ok(view.includes('[...new Set(Object.values(picture.all))].map('), 'only the current picture is loaded');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['voiceUsePictures', 'voicePersonEdit', 'voicePicQuiet', 'voicePicTalking', 'voicePicHint']) assert.equal(strings.split(key + ':').length - 1, 2, key);
});

// In the call, by when they joined: 100, 400, then 100100100100. Pin the last to come first, then 400.
const unpinnedOrder = voice.getState().members.map((m) => m.id);
voice.setVoice({ pinned: [{ id: '100100100100', name: 'Rowan' }, { id: '400', name: 'Elsewhere' }, { id: '999999999', name: 'Away' }, { id: '100100100100', name: 'twice' }, { id: 'nope' }] });
const pinnedState = voice.getState();

test('pinned people come first, in the order they are listed, and everybody else by when they joined', () => {
  assert.deepEqual(unpinnedOrder, ['100', '400', '100100100100']);
  // 400 is not a real-length id, so it is not kept: only the pinned one moves.
  assert.deepEqual(pinnedState.members.map((m) => m.id), ['100100100100', '100', '400']);
  assert.deepEqual(pinnedState.pinned.map((p) => p.id), ['100100100100', '999999999'], 'a pin list kept a bad id or somebody twice');
  assert.equal(pinnedState.members[0].pinned, true);
  // Somebody pinned who is not in the call stays on the list, for when they are.
  assert.equal(pinnedState.pinned[1].name, 'Away');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['voicePin', 'voiceUnpin', 'voicePinnedTitle', 'voicePinnedHint']) assert.equal(strings.split(key + ':').length - 1, 2, key);
});

voice.stopDiscordVoice();
