/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Discord call setting actions off — somebody joining or
 * leaving, the call reaching a number of people, somebody starting to talk
 * after a pause — and reactions sent in the call shown over their tile.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After the voice tests
 * (discord-voice.js, voice-call.js), which set the call module up.
 */

import { SCRIPT_URL, assert, bus, collection, engine, EVENTS, fs, said, test } from './harness.js';

const voice = await import('../../platforms/discord-voice.js');
const { normaliseLayout } = await import('../../engine/layouts.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The call being shown: the voice tests chose a guild and channel; use our own.
const discordSettings = collection('discord_settings', {});
const settingsBefore = discordSettings.get();
discordSettings.set({ ...settingsBefore, guildId: '900000000000000001' });
const GUILD = '900000000000000001';
const CALL = '910000000000000001';
const before = voice.getState();
voice.setVoice({ channelId: CALL, follow: null });

const triggers = [];
const onTrigger = (e) => triggers.push(e);
bus.on(EVENTS.TRIGGER, onTrigger);
const events = [];
const onEvent = (e) => { if (String(e.type).startsWith('discord_call_')) events.push(e); };
bus.on(EVENTS.EVENT, onEvent);

const member = (id, name) => ({ user: { id, username: name.toLowerCase(), global_name: name } });
const enter = (id, name, channel = CALL) => bus.emit('discord:voice_state', { guild_id: GUILD, user_id: id, channel_id: channel, member: member(id, name) });
const leave = (id) => bus.emit('discord:voice_state', { guild_id: GUILD, user_id: id, channel_id: null });

// An action for each: a line in chat saying who and how many.
const save = (id, type, config, message) => engine.store.saveAction({
  id, name: id, enabled: true,
  trigger: { id: `tr-${id}`, category: 'discord', type, config },
  actions: [{ id: `s-${id}`, type: 'twitch_chat', config: { message } }],
});
save('call-join', 'discord_call_join', {}, 'Entró {user} ({event.count})');
save('call-count', 'discord_call_count', { people: 3 }, 'Ya somos {event.count}');
save('call-leave-ana', 'discord_call_leave', { discordId: '920000000000000001' }, 'Se fue Ana');

// Connecting reads everybody already in calls: nobody is "joining" then.
bus.emit('discord:guild_create', { id: GUILD, members: [member('920000000000000009', 'Ya')], voice_states: [{ user_id: '920000000000000009', channel_id: CALL }] });
const onConnect = triggers.length;
enter('920000000000000001', 'Ana');
enter('920000000000000002', 'Bea');
enter('920000000000000003', 'Caro', '910000000000000099'); // another channel: not this call
leave('920000000000000002');
leave('920000000000000001');
await wait(40);

test('somebody joining or leaving the call, and the count changing, set actions off — and never become alerts', () => {
  assert.equal(onConnect, 0, 'connecting announced the people already in the call as joining');
  const kinds = triggers.slice(onConnect).map((e) => `${e.type}:${e.user}:${e.data.count}`);
  assert.deepEqual(kinds, [
    'discord_call_join:Ana:2', 'discord_call_count:Ana:2',
    'discord_call_join:Bea:3', 'discord_call_count:Bea:3',
    'discord_call_leave:Bea:2', 'discord_call_count:Bea:2',
    'discord_call_leave:Ana:1', 'discord_call_count:Ana:1',
  ]);
  assert.equal(events.length, 0, 'a call trigger went out as a stream event');
  assert.ok(said.includes('Entró Ana (2)') && said.includes('Entró Bea (3)'));
  assert.equal(said.filter((s) => s === 'Ya somos 3').length, 1, 'reaching three was announced more or less than once');
  assert.ok(!said.includes('Ya somos 2'), 'the count fired below the number set');
  assert.equal(said.filter((s) => s === 'Se fue Ana').length, 1, 'the one person\'s trigger fired for somebody else, or not at all');
});

// ---------------------------------------------------------------- reactions

enter('920000000000000001', 'Ana');
const unicode = voice.onVoiceEffect({ guild_id: GUILD, channel_id: CALL, user_id: '920000000000000001', emoji: { name: '🔥' }, animation_type: 1, animation_id: 3 });
const shownWith = voice.getState().members.find((m) => m.id === '920000000000000001')?.reaction;
const custom = voice.onVoiceEffect({ guild_id: GUILD, channel_id: CALL, user_id: '920000000000000001', emoji: { id: '555', name: 'Wow', animated: true } });
const sound = voice.onVoiceEffect({ guild_id: GUILD, channel_id: CALL, user_id: '920000000000000001', sound_id: '777', sound_volume: 1 });
const elsewhere = voice.onVoiceEffect({ guild_id: GUILD, channel_id: '910000000000000099', user_id: '920000000000000003', emoji: { name: '😂' } });

test('a reaction or a sound sent in the call shows over whoever sent it, for a few seconds', () => {
  assert.deepEqual({ text: unicode.text, url: unicode.url }, { text: '🔥', url: undefined });
  assert.equal(shownWith?.id, unicode.id, 'the call state does not carry the reaction');
  assert.equal(custom.url, 'https://cdn.discordapp.com/emojis/555.gif');
  assert.deepEqual({ text: sound.text, sound: sound.sound }, { text: '🔊', sound: true });
  assert.equal(elsewhere, null, 'a reaction in another call was shown');
  assert.equal(voice.REACTION_MS, 5000);
  assert.ok(read('../platforms/discord.js').includes("case 'VOICE_CHANNEL_EFFECT_SEND':"));
  const layer = read('../../web/components/VoiceLayer.tsx');
  assert.ok(layer.includes('data-voice="reaction"') && layer.includes("data-voice-reacting={reaction ? 'true' : 'false'}"));
  const layout = normaliseLayout({ id: 'v', name: 'v', layers: [{ type: 'voice', config: { showReactions: false } }] });
  assert.equal(layout.layers[0].config.showReactions, false, 'turning reactions off was not kept');
});

// ---------------------------------------------------------------- talking, through the engine's filter

save('talk-any', 'discord_call_talking', { quietSeconds: 60 }, 'Habla {user} tras una pausa larga');
save('talk-bea', 'discord_call_talking', { discordId: '920000000000000002' }, 'Habla Bea');
const talk = (id, quietFor) => bus.emit(EVENTS.TRIGGER, { id: `t${Math.random()}`, type: 'discord_call_talking', platform: 'discord', user: id === '920000000000000002' ? 'Bea' : 'Ana', data: { userId: id, quietFor } });
talk('920000000000000001', 20_000);
talk('920000000000000001', 90_000);
talk('920000000000000002', 35_000);
talk('920000000000000002', 12_000);
await wait(40);

test('"started talking" waits for the pause the action asks for, and for the person it names', () => {
  assert.equal(said.filter((s) => s === 'Habla Ana tras una pausa larga').length, 1, 'a 20-second pause passed for a 60-second one');
  assert.ok(!said.includes('Habla Bea tras una pausa larga'), 'Bea\'s 35 seconds passed for 60');
  // 30 seconds by default.
  assert.equal(said.filter((s) => s === 'Habla Bea').length, 1);
  const src = read('../platforms/discord-voice.js');
  assert.ok(src.includes('if (!speaking.has(userId)) startedTalking(userId);') && src.includes('lastQuiet.set(userId, Date.now());'));
  const view = read('../../web/components/views/ActionsView.tsx');
  for (const type of ['discord_call_join', 'discord_call_leave', 'discord_call_count', 'discord_call_talking']) assert.ok(view.includes(`{ value: '${type}'`), type);
});

for (const id of ['call-join', 'call-count', 'call-leave-ana', 'talk-any', 'talk-bea']) engine.store.deleteAction(id);
bus.off(EVENTS.TRIGGER, onTrigger);
bus.off(EVENTS.EVENT, onEvent);
leave('920000000000000001');
leave('920000000000000009');
voice.setVoice({ channelId: before.chosenChannelId, follow: before.follow });
discordSettings.set(settingsBefore);
