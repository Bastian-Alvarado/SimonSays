/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: triggers for what the app already heard but could not set an
 * action off with — a bundle of gifted subs, YouTube's Super Chats, members
 * and gifted memberships, the Hype Train, Twitch going live and ending, and
 * somebody's first message this stream and ever.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — after history-and-streams.js, which starts the stream sessions and
 * the viewer history these read — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, engine, EVENTS, fs, normaliseChat, normaliseEvent, said, settle, test } from './harness.js';

const sessions = await import('../../engine/stream-sessions.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const on = (id, type, category, message, config = {}) => engine.store.saveAction({
  id, name: id, enabled: true,
  trigger: { id: `t-${id}`, category, type, config },
  actions: [{ id: `s-${id}`, type: 'twitch_chat', config: { message } }],
});
const event = (type, over = {}) => bus.emit(EVENTS.EVENT, normaliseEvent({ type, ...over }));
const saidAfter = async (from, fn) => { const start = said.length; await fn(); await settle(); return said.slice(start); };

// ------------------------------------------------------------ gift bundles

on('act-bomb', 'twitch_sub_gift_bulk', 'twitch', 'bomb by {user}: {event.count}', { minGifts: 5 });
on('act-yt-gifts', 'youtube_sub_gift_bulk', 'youtube', 'yt gifts by {user}: {event.count}');
const bombs = await saidAfter(0, async () => {
  event('twitch_sub_gift_bulk', { platform: 'twitch', user: 'Small', data: { count: 3, amount: 3, giftedBy: 'Small' } });
  event('twitch_sub_gift_bulk', { platform: 'twitch', user: 'Big', data: { count: 10, amount: 10, giftedBy: 'Big' } });
  event('youtube_sub_gift_bulk', { platform: 'youtube', user: 'Yolanda', data: { count: 2 } });
});

test('a bundle of gifted subs sets an action off once, and only past its minimum', () => {
  assert.ok(bombs.includes('bomb by Big: 10'), bombs.join(' | '));
  assert.ok(!bombs.some((s) => s.startsWith('bomb by Small')), 'a bundle under the minimum set it off');
  assert.ok(bombs.includes('yt gifts by Yolanda: 2'), 'gifted memberships set nothing off');
});

// ------------------------------------------------------------ YouTube

on('act-superchat', 'youtube_cheer', 'youtube', '{user} sent {event.amount}: {message}', { minValue: 10 });
on('act-member', 'youtube_sub', 'youtube', 'member {user} {event.months}');
const youtube = await saidAfter(0, async () => {
  event('youtube_cheer', { platform: 'youtube', user: 'Poca', data: { amount: '$2.00', value: 2, currency: 'USD', message: 'small' } });
  event('youtube_cheer', { platform: 'youtube', user: 'Mucha', data: { amount: '$20.00', value: 20, currency: 'USD', message: 'te quiero' } });
  event('youtube_sub', { platform: 'youtube', user: 'Socia', data: { months: 6, tier: 'Fan' } });
});

test('a Super Chat sets an action off with its words, and only past its minimum', () => {
  assert.ok(youtube.includes('Mucha sent $20.00: te quiero'), youtube.join(' | '));
  assert.ok(!youtube.some((s) => s.startsWith('Poca')), 'a Super Chat under the minimum set it off');
  assert.ok(youtube.includes('member Socia 6'));
});

// ------------------------------------------------------------ the Hype Train

on('act-hype-begin', 'twitch_hype_train_begin', 'twitch', 'train on, level {event.level}');
on('act-hype-level', 'twitch_hype_train_level', 'twitch', 'train level {event.level}, top {user}');
on('act-hype-end', 'twitch_hype_train_end', 'twitch', 'train done at {event.level}');
const train = (phase, level, top = 'Ana') => bus.emit('twitch:hypetrain', { phase, level, total: level * 1000, top: [{ user: top, type: 'bits', total: 500 }] });
const hype = await saidAfter(0, async () => {
  train('begin', 1);
  train('progress', 1);
  train('progress', 2, 'Beto');
  train('progress', 2, 'Beto');
  train('progress', 3, 'Caro');
  train('end', 3);
});

test('the Hype Train sets actions off when it starts, at each new level, and when it ends', () => {
  assert.deepEqual(hype.filter((s) => s.startsWith('train')), ['train on, level 1', 'train level 2, top Beto', 'train level 3, top Caro', 'train done at 3']);
});

// One already running when the server started is joined at its level, not announced as climbing to it.
const joined = await saidAfter(0, async () => { train('progress', 4); train('progress', 4); });
test('a train already running is joined, not announced', () => {
  assert.deepEqual(joined.filter((s) => s.startsWith('train')), []);
});

// ------------------------------------------------------------ Twitch going live and ending

on('act-tw-online', 'twitch_stream_online', 'twitch', 'twitch says live');
on('act-tw-offline', 'twitch_stream_offline', 'twitch', 'twitch says ended');
const stat = (value) => bus.emit(EVENTS.STAT, { key: 'twitchLive', value });
stat(false);
await settle();
const liveCycle = await saidAfter(0, async () => { stat(true); await settle(); stat(true); await settle(); stat(false); await settle(); });

test('Twitch going live and ending set actions off once each', () => {
  assert.deepEqual(liveCycle.filter((s) => s.startsWith('twitch says')), ['twitch says live', 'twitch says ended']);
  const src = read('../engine/index.js');
  assert.ok(src.includes('if (twitchWasLive === null || s.live === twitchWasLive) { twitchWasLive = s.live; return; }'), 'a restart mid-stream would say "went live" again');
});

// ------------------------------------------------------------ first words

on('act-first-stream', 'chat_first_of_stream', 'chat', 'hi {user} ({event.streak} in a row): {message}');
on('act-first-ever', 'chat_first_ever', 'chat', 'welcome for the first time, {user}');
// The condition on the trigger's own viewer: a sub gets a line of their own.
engine.store.saveAction({
  id: 'act-first-sub', name: 'first sub', enabled: true,
  trigger: { id: 't-first-sub', category: 'chat', type: 'chat_first_of_stream', config: {} },
  actions: [{
    id: 'fs1', type: 'condition',
    config: { logic: { matchType: 'AND', conditions: [{ id: 'c', variable: 'user.isSub', operator: 'isTrue', value: '' }] } },
    thenActions: [{ id: 'fs2', type: 'twitch_chat', config: { message: 'a sub arrived: {user}' } }],
    elseActions: [],
  }],
});
const chatLine = (over) => bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', msg: 'hola', ...over }));

// Off stream: nobody has a first message of the stream, but somebody new is still new.
const offStream = await saidAfter(0, async () => { chatLine({ user: 'Newbie', userId: 'fw-newbie', msg: 'first words' }); });

event('obs_stream_started');
await settle();
const during = await saidAfter(0, async () => {
  chatLine({ user: 'Newbie', userId: 'fw-newbie', msg: 'back again' });
  chatLine({ user: 'Newbie', userId: 'fw-newbie', msg: 'and again' });
  chatLine({ user: 'Fresh', userId: 'fw-fresh', msg: 'hello all', isSub: true });
  chatLine({ user: 'TheBot', userId: 'fw-bot', isBot: true });
  chatLine({ user: 'Me', userId: 'fw-me', isBroadcaster: true });
  chatLine({ platform: 'youtube', user: 'Tubo', userId: 'UC-fw-tubo', msg: 'desde YouTube' });
});
event('obs_stream_stopped');
await sessions._test.finish();

test('first message ever, on or off stream; first message this stream, once each and only while one is on', () => {
  assert.deepEqual(offStream.filter((s) => s.startsWith('hi ') || s.startsWith('welcome')), ['welcome for the first time, Newbie']);
  const greetings = during.filter((s) => s.startsWith('hi ') || s.startsWith('welcome'));
  assert.ok(greetings.includes('hi Newbie (1 in a row): back again'), greetings.join(' | '));
  assert.equal(greetings.filter((s) => s.startsWith('hi Newbie')).length, 1, 'greeted twice in one stream');
  assert.ok(!greetings.includes('welcome for the first time, Newbie'), 'somebody seen before was new again');
  assert.ok(greetings.includes('hi Fresh (1 in a row): hello all') && greetings.includes('welcome for the first time, Fresh'), 'a brand-new chatter during a stream sets off both');
  assert.ok(greetings.some((s) => s.startsWith('hi Tubo')), 'a first message on YouTube set nothing off');
  assert.ok(!greetings.some((s) => s.includes('TheBot') || s.includes(' Me ')), 'a bot or the streamer was greeted');
});

test('the trigger knows who said it, so a condition can ask whether they are a sub', () => {
  assert.ok(during.includes('a sub arrived: Fresh'), during.join(' | '));
  assert.ok(!during.includes('a sub arrived: Newbie'));
});

// The files after this one chat as new people; these would greet them all.
for (const id of ['act-bomb', 'act-yt-gifts', 'act-superchat', 'act-member', 'act-hype-begin', 'act-hype-level', 'act-hype-end', 'act-tw-online', 'act-tw-offline', 'act-first-stream', 'act-first-ever', 'act-first-sub']) {
  engine.store.deleteAction(id);
}

// ------------------------------------------------------------ the editor

test('the trigger picker offers the new triggers, under YouTube and Chat too, in both languages', () => {
  const view = read('../../web/components/views/ActionsView.tsx');
  for (const type of ['twitch_sub_gift_bulk', 'twitch_hype_train_begin', 'twitch_hype_train_level', 'twitch_hype_train_end', 'twitch_stream_online', 'twitch_stream_offline', 'youtube_cheer', 'youtube_sub', 'youtube_sub_gift_bulk', 'chat_first_of_stream', 'chat_first_ever']) {
    assert.ok(view.includes(`{ value: '${type}', label:`), `the picker has no ${type}`);
  }
  assert.ok(view.includes("{ value: 'youtube', label: t.triggerYoutube") && view.includes("{ value: 'chat', label: t.triggerChat"));
  assert.ok(view.includes("val === 'youtube' ? 'youtube_cheer' : val === 'chat' ? 'chat_first_of_stream'"), 'picking a new category leaves the trigger on something else');
  const constants = read('../../web/constants.ts');
  for (const key of ['triggerYoutube', 'triggerChat', 'triggerGiftBomb', 'triggerHypeBegin', 'triggerHypeLevel', 'triggerHypeEnd', 'triggerTwitchOnline', 'triggerTwitchOffline', 'triggerSuperChat', 'triggerYoutubeMember', 'triggerYoutubeGifts', 'triggerFirstOfStream', 'triggerFirstEver', 'minGifts', 'giftBombHint', 'minSuperChat', 'superChatHint', 'youtubeMemberHint', 'hypeTrainHint', 'twitchLiveHint', 'firstOfStreamHint', 'firstEverHint']) {
    assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
});

/*
  The trigger pickers were declared inside the screen's render, so every
  render made them a new component: the open list was thrown away and built
  again — the slide-in replayed, the scroll went back to the top — whenever
  anything on the screen changed.
*/
test('the trigger pickers are declared once, outside the screen, so an open list stays open', () => {
  const view = read('../../web/components/views/ActionsView.tsx');
  const screen = view.indexOf('export const ActionsView: React.FC<ActionsViewProps>');
  const picker = view.indexOf('const SelectionDropdown = (');
  assert.ok(picker > 0 && picker < screen, 'the picker is declared inside the screen again');
  assert.equal(view.split('const SelectionDropdown = (').length - 1, 1);
  const uses = view.split('<SelectionDropdown').slice(1).map((u) => u.slice(0, u.indexOf('/>')));
  assert.equal(uses.length, 2);
  for (const use of uses) assert.ok(use.includes('activeDropdown={activeDropdown}') && use.includes('setActiveDropdown={setActiveDropdown}'), 'a picker is not handed which list is open');
});
