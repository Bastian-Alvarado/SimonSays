/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: levels on stream — somebody levelling up as a stream event
 * an alert or an action can answer, "!rank" and "!top" answered in the chat
 * they were asked in, and the leaderboard as a layer.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After discord-chat.js;
 * leveling was set up by discord.js.
 */

import { SCRIPT_URL, assert, bus, engine, EVENTS, fs, normaliseChat, test } from './harness.js';

const leveling = await import('../../leveling/index.js');
const levelChat = await import('../../leveling/chat.js');
const { ALERT_TYPES, CONDITION_FIELDS } = await import('../../engine/alerts.js');
const { normaliseLayout, LAYER_TYPES } = await import('../../engine/layouts.js');
const { CSS_LOOKS } = await import('../../../shared/css-presets.js');

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const before = leveling.getConfig();
// Every message a level's worth: 100 XP is level 1, 400 level 2.
leveling.setConfig({ enabled: true, cooldown: 0, minXp: 100, maxXp: 100, xpRate: 1, announceChannelId: null });

const events = [];
const onEvent = (e) => { if (e.type === 'level_up') events.push(e); };
bus.on(EVENTS.EVENT, onEvent);
const xpChanges = [];
const onXp = (uid) => xpChanges.push(uid);
bus.on('xp:changed', onXp);
const chat = (over) => bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', msg: 'hola', ...over }));

chat({ user: 'Escalador', userId: 'esc1', avatar: 'https://x/e.png' });
chat({ user: 'MiCanal', userId: 'own1', isBroadcaster: true });
await wait(30);
const firstLevel = events.find((e) => e.user === 'Escalador');
const ownLevel = events.find((e) => e.user === 'MiCanal');

test('levelling up is a stream event an alert or an action can answer — but not for the channel\'s own accounts', () => {
  assert.ok(firstLevel, 'no level_up event');
  assert.equal(firstLevel.platform, 'twitch');
  assert.equal(firstLevel.data.level, 1);
  assert.equal(firstLevel.data.xp, 100);
  assert.ok(Number(firstLevel.data.rank) >= 1, 'no place on the board');
  assert.equal(firstLevel.avatar, 'https://x/e.png');
  assert.equal(ownLevel, undefined, 'the streamer\'s own level set off an alert');
  assert.ok(ALERT_TYPES.includes('level_up'));
  assert.ok(CONDITION_FIELDS.some((f) => f.field === 'level' && f.types.includes('level_up')), 'an alert cannot pick out a level');
  assert.ok(xpChanges.length >= 2, 'the board on stream is not told XP changed');
  const actions = read('../../web/components/views/ActionsView.tsx');
  assert.ok(actions.includes("{ value: 'level_up', label: t.triggerLevelUp"));
  assert.ok(read('../../web/components/views/AlertsView.tsx').includes("{ type: 'level_up', label: 'Levelled up'"));
  assert.ok(read('../../web/components/VariablePicker.tsx').includes("{ token: 'event.level',"));
});

// ---------------------------------------------------------------- !rank and !top

const answers = [];
let clock = Date.now();
levelChat.initLevelChat({
  twitch: async (text) => { answers.push(['twitch', text]); },
  youtube: async (text) => { answers.push(['youtube', text]); },
  discord: async (text, c) => { answers.push(['discord', text, c.raw?.channelId]); },
  now: () => clock,
});
const step = async (ms = levelChat.CHAT_EVERY_MS + 1) => { clock += ms; await wait(5); };

chat({ user: 'Escalador', userId: 'esc1', msg: '!rank' });
await step();
const rankLine = answers.at(-1);
const count = answers.length;
chat({ user: 'Escalador', userId: 'esc1', msg: '!rank' });
await step();
const tooSoon = answers.length - count;
await step(levelChat.PERSON_EVERY_MS);
chat({ user: 'Escalador', userId: 'esc1', msg: '!RANK' });
await step();
const afterWaiting = answers.length - count;

chat({ user: 'Otro', userId: 'o1', msg: '!top' });
await step();
const topLine = answers.at(-1);

chat({ user: 'Curioso', userId: 'c1', msg: '!rank @Escalador' });
await step();
const aboutSomeone = answers.at(-1);
chat({ user: 'Curioso2', userId: 'c2', msg: '!rank Nadie' });
await step();
const nobody = answers.at(-1);

// Discord, in a channel that is not the stream's: answered there.
bus.emit('discord:message_elsewhere', normaliseChat({ platform: 'discord', user: 'Disc_or*d', userId: 'd1', msg: '!rank', raw: { channelId: 'c-general', messageId: 'm1' } }));
await step();
const fromDiscord = answers.at(-1);

// TikTok cannot be written to; YouTube can be left out.
const beforeQuiet = answers.length;
chat({ platform: 'tiktok', user: 'Tok', userId: 't1', msg: '!top' });
leveling.setConfig({ chat: { ...leveling.getConfig().chat, youtube: false } });
chat({ platform: 'youtube', user: 'Tubo', userId: 'y1', msg: '!top' });
await step();
const quiet = answers.length - beforeQuiet;
leveling.setConfig({ chat: { ...leveling.getConfig().chat, youtube: true } });

// A command of the streamer's own on the same word answers instead.
engine.store.saveCommand({ id: 'cmd-own-top', name: 'Own top', triggers: ['!top'], enabled: true, permissions: { anyone: true }, globalCooldown: 0, userCooldown: 0, actionId: '' });
// One that runs: an action linked to it. A command left without one does not take the word (commands.ownCommandAnswers).
engine.store.saveAction({ id: 'act-own-top', name: 'Own top', enabled: true, trigger: { type: 'command_trigger', category: 'command', config: { commandId: 'cmd-own-top' } }, actions: [] });
const beforeOwn = answers.length;
chat({ user: 'Otro2', userId: 'o2', msg: '!top' });
await step();
const ownWins = answers.length - beforeOwn;
engine.store.deleteCommand('cmd-own-top');
engine.store.deleteAction('act-own-top');

levelChat.stopLevelChat();
bus.off(EVENTS.EVENT, onEvent);
bus.off('xp:changed', onXp);

test('"!rank" says where somebody stands, in the chat it was asked in, and no more than every half minute', () => {
  assert.equal(rankLine[0], 'twitch');
  assert.match(rankLine[1], /^Escalador: nivel \d+ · [\d,]+ XP · puesto #\d+ de \d+$/);
  assert.equal(tooSoon, 0, 'the same person was answered twice in a row');
  assert.equal(afterWaiting, 1, 'asking again later was not answered (or the word is case-sensitive)');
  assert.match(aboutSomeone[1], /^Escalador: nivel/, '"!rank @name" did not ask about them');
  assert.equal(nobody[1], 'Nadie todavía no tiene XP.');
  assert.deepEqual([fromDiscord[0], fromDiscord[2]], ['discord', 'c-general'], 'Discord was not answered in its own channel');
  assert.ok(fromDiscord[1].startsWith('Disc\\_or\\*d'), 'a name in Discord was not escaped');
});

test('"!top" names the leaders; TikTok and a YouTube left out get nothing; the streamer\'s own command wins', () => {
  assert.match(topLine[1], /^Top \d: 1\. .+ \(nv \d+\)/);
  assert.equal(quiet, 0, 'TikTok, or YouTube with answers off, was answered');
  assert.equal(ownWins, 0, 'the built-in answer talked over the streamer\'s own !top');
});

test('the streamer\'s own level leaves out a place they do not have', () => {
  const own = leveling.findUser('twitch', 'own1');
  assert.ok(own, 'the streamer earned no XP');
  assert.equal(levelChat.rankAnswer(own, 'twitch'), 'MiCanal: nivel 1 · 100 XP');
});

test('the chat answers are kept sane: one word to ask, a count of 1 to 10', () => {
  const c = leveling.cleanLevelChat({ rankWord: '  !nivel extra ', topWord: '', topCount: 99, rankText: '', youtube: false });
  assert.equal(c.rankWord, '!nivel');
  assert.equal(c.topWord, '!top');
  assert.equal(c.topCount, 10);
  assert.equal(c.rankText, leveling.DEFAULT_LEVEL_CHAT.rankText);
  assert.equal(c.youtube, false);
  assert.deepEqual(leveling.setConfig({ ignoredChannelIds: ['123', 'nope', '123', 4] }).ignoredChannelIds, ['123', '4']);
  assert.ok(read('../index.js').includes('initLevelChat();'));
});

leveling.setConfig(before);

// ---------------------------------------------------------------- the leaderboard layer

const layout = normaliseLayout({ id: 'board-test', name: 'Board', layers: [{ type: 'leaderboard', config: { count: 40, title: 'Los mejores', showXp: true, showBar: false } }] });
const layer = layout.layers[0];

test('the leaderboard is a layer: its settings kept sane, drawn by the canvas, dressed by the default look', () => {
  assert.ok(LAYER_TYPES.includes('leaderboard'));
  assert.equal(layer.type, 'leaderboard');
  assert.deepEqual(layer.config, { title: 'Los mejores', levelWord: '', count: 10, showTitle: true, showAvatars: true, showBar: false, showXp: true });
  assert.ok(read('../../web/components/CanvasStage.tsx').includes("case 'leaderboard':"));
  assert.ok(read('../../web/components/views/LayoutsView.tsx').includes("{layer.type === 'leaderboard' && ("));
  assert.ok(read('../../web/components/LayerCssPanel.tsx').includes(`'[data-board="row"]'`));
  const look = CSS_LOOKS.flatMap((t) => t.objects || []).find((o) => o.id === 'simonsays-leaderboard');
  assert.equal(look?.layerType, 'leaderboard');
  assert.ok(read('../../shared/looks-es.js').includes("'simonsays-leaderboard': { name: 'Tabla de posiciones'"));
  // Sent as XP comes in, a few seconds behind, without the whole user list.
  assert.ok(read('../api/ws.js').includes("broadcast(S2C.XP_DATA, { leaderboard: leveling.leaderboard() });"));
});
