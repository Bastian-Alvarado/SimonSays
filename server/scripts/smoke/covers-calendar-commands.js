/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: three follow-ups — a cover on the schedule's Discord events,
 * actions on a calendar ("every Monday at 18:00"), and commands that work in
 * every channel of the Discord server, answering where they were typed.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After
 * schedule-events.js and repeating.js.
 */

import path from 'node:path';
import { SCRIPT_URL, assert, bus, collection, discordSent, engine, EVENTS, fs, normaliseChat, said, test } from './harness.js';

const se = await import('../../engine/schedule-events.js');
const repeat = await import('../../engine/repeat.js');
const discord = await import('../../platforms/discord.js');
const { chatDestination } = await import('../../engine/steps.js');
const { config } = await import('../../config.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- the events' cover

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4630000000049454e44ae426082', 'hex');
fs.mkdirSync(config.assetsDir, { recursive: true });
fs.writeFileSync(path.join(config.assetsDir, 'cover-test.png'), PNG);
fs.writeFileSync(path.join(config.assetsDir, 'cover-test.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');

const GUILD = '900000000000000002';
const discordSettings = collection('discord_settings', {});
const settingsBefore = discordSettings.get();
discordSettings.set({ ...settingsBefore, guildId: GUILD });
const calls = [];
let nextId = 970000000000000000n;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === 'https://img.test/cover.png') return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
  if (!u.includes('discord.com')) return realFetch(url, init);
  const method = init.method || 'GET';
  calls.push({ method, path: u.replace(/^.*\/api\/v10/, ''), body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
  if (method === 'POST') { nextId += 1n; return new Response(JSON.stringify({ id: String(nextId) }), { status: 200 }); }
  if (method === 'DELETE') return new Response(null, { status: 204 });
  return new Response('{}', { status: 200 });
};
const realToken = config.discord.botToken;
config.discord.botToken = 'test-token';

const k1 = { id: 'k1', start: new Date(Date.now() + 86_400_000).toISOString(), end: null, title: 'Con portada', category: 'Among Us' };
const schedule = () => bus.emit(EVENTS.CONFIG, { key: 'twitchSchedule', value: { segments: [k1] } });
const settle = async () => { await wait(20); await se.syncScheduleEvents(); };

se.setScheduleEvents({ enabled: true, count: 1, cover: 'picture', coverPicture: 'https://img.test/cover.png' });
await settle();
calls.length = 0;
schedule();
await settle();
const madeWith = calls.find((c) => c.method === 'POST')?.body;
calls.length = 0;
schedule();
await settle();
const unchanged = calls.length;
se.setScheduleEvents({ coverPicture: '/media/cover-test.png' });
await settle();
const newCover = calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
calls.length = 0;
se.setScheduleEvents({ description: 'Otra cosa' });
await settle();
const wordsOnly = calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
calls.length = 0;
se.setScheduleEvents({ cover: 'none' });
await settle();
const takenOff = calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
calls.length = 0;
se.setScheduleEvents({ cover: 'picture', coverPicture: '/media/cover-test.svg' });
await settle();
const svgCalls = calls.length;
se.setScheduleEvents({ enabled: false, cover: 'twitch', coverPicture: '', description: '{game}\n¡Te espero en {link}!' });

globalThis.fetch = realFetch;
config.discord.botToken = realToken;
discordSettings.set(settingsBefore);

test('an event is made with its cover, and the picture is sent again only when the cover changes', () => {
  assert.ok(madeWith?.image?.startsWith('data:image/png;base64,'), 'the event was made without its cover');
  assert.equal(unchanged, 0, 'the same schedule and cover changed the event');
  assert.equal(newCover.length, 1);
  assert.ok(newCover[0].image?.startsWith('data:image/png;base64,'), 'a new cover was not sent');
  assert.equal(wordsOnly.length, 1);
  assert.ok(!('image' in wordsOnly[0]), 'the picture was sent again with new words');
  assert.equal(takenOff[0]?.image, null, 'turning the cover off did not take it off');
  assert.equal(svgCalls, 0, 'an SVG, which Discord cannot take, was sent');
  assert.deepEqual(se.cleanScheduleEvents({ cover: 'sideways', coverPicture: 'javascript:alert(1)' }).cover, 'twitch');
  assert.equal(se.cleanScheduleEvents({ coverPicture: 'javascript:alert(1)' }).coverPicture, '');
  assert.ok(read('../../web/components/views/GoLiveView.tsx').includes('data-schedule-events-cover-choice={value}'));
});

// ---------------------------------------------------------------- on a calendar

repeat.stopRepeat();
const runs = [];
let live = false;
const actions = [];
repeat.initRepeat({ actions: () => actions, isLive: () => live, run: (a) => { runs.push(a.id); }, autoTick: false });
const cal = (id, configOf) => ({ id, name: id, enabled: true, trigger: { type: 'timer_schedule', config: configOf } });
// Mexico City keeps UTC-6 all year: Monday 18:00 there is Tuesday 00:00 UTC.
actions.push(cal('monday', { days: [1], time: '18:00', tz: 'America/Mexico_City' }));
actions.push(cal('live-only', { days: [1], time: '18:00', tz: 'America/Mexico_City', onlyLive: true }));
const at = (iso) => repeat.tickSchedule(Date.parse(iso));
const results = {
  early: at('2026-10-05T23:59:30Z'),
  onTime: at('2026-10-06T00:00:20Z'),
  sameMinute: at('2026-10-06T00:00:50Z'),
  stillLate: at('2026-10-06T00:03:00Z'),
  tuesday: at('2026-10-07T00:00:20Z'),
  nextMondayLate: at('2026-10-13T00:04:10Z'),
  tooLate: at('2026-10-20T00:06:00Z'),
};
live = true;
const liveRun = at('2026-10-27T00:01:00Z');
repeat.stopRepeat();

test('an action on a calendar runs once at its time on its days, in its own time zone, catching up a missed minute', () => {
  assert.deepEqual(results.early, []);
  assert.deepEqual(results.onTime, ['monday'], 'it did not run on Monday at 18:00 Mexico City time');
  assert.deepEqual(results.sameMinute, [], 'it ran twice in the same minute');
  assert.deepEqual(results.stillLate, [], 'it ran twice on the same day');
  assert.deepEqual(results.tuesday, []);
  assert.deepEqual(results.nextMondayLate, ['monday'], 'a minute missed was not caught up');
  assert.deepEqual(results.tooLate, [], 'it ran six minutes late');
  assert.deepEqual(liveRun.sort(), ['live-only', 'monday']);
  assert.ok(!runs.includes('live-only') || runs.filter((r) => r === 'live-only').length === 1, 'an only-while-live one ran off air');
  assert.deepEqual(repeat.cleanSchedule({ days: [5, 1, 1, 9], time: '7:00', tz: 'Mars/Base' }).days, [1, 5]);
  assert.equal(repeat.cleanSchedule({ time: '25:00' }).time, '18:00');
  assert.equal(repeat.cleanSchedule({ tz: 'Mars/Base' }).tz, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  assert.ok(/EXCLUDED = \[[^\]]*'repeat_fired'/.test(read('../engine/backup.js')));
  const view = read('../../web/components/views/ActionsView.tsx');
  assert.ok(view.includes("{ value: 'timer_schedule', label: t.triggerSchedule") && view.includes('data-schedule-day={d}'));
  assert.ok(read('../../web/App.tsx').includes("type === 'timer_schedule'\n    ? { days: [1], time: '18:00', tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }"), 'a new calendar action is saved without its time zone');
});

// ---------------------------------------------------------------- commands in every channel

engine.store.saveCommand({ id: 'cmd-everywhere', name: 'Donde', triggers: ['!donde'], enabled: true, permissions: { anyone: true }, globalCooldown: 0, userCooldown: 0 });
engine.store.saveAction({
  id: 'act-everywhere', name: 'Donde', enabled: true,
  trigger: { id: 'tr-everywhere', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-everywhere' } },
  actions: [{ id: 's1', type: 'twitch_chat', config: { message: 'Aquí {user}', sendTo: 'origin' } }],
});
const sentBefore = discordSent.length;
bus.emit('discord:message_elsewhere', normaliseChat({ platform: 'discord', user: 'Ana', userId: 'd9', msg: '!donde', raw: { channelId: '700000000000000123' } }));
bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'Bob', userId: 't9', msg: '!donde' }));
await wait(60);
const toDiscord = discordSent.slice(sentBefore).map((a) => [a[0], a[1]]);
engine.store.deleteAction('act-everywhere');
engine.store.deleteCommand('cmd-everywhere');
const everywhereBefore = discordSettings.get();
discordSettings.set({ ...everywhereBefore, commandsEverywhere: false });
const off = discord.commandsEverywhere();
discordSettings.set({ ...everywhereBefore, commandsEverywhere: undefined });
const byDefault = discord.commandsEverywhere();
discordSettings.set(everywhereBefore);

test('a command typed in any Discord channel runs, and "Where it came from" answers in that channel', () => {
  assert.deepEqual(toDiscord, [['700000000000000123', 'Aquí Ana']], 'the Discord command was not answered in its own channel');
  assert.ok(said.includes('Aquí Bob'), 'a Twitch command stopped answering in Twitch');
  assert.equal(chatDestination('origin', { user: { platform: 'discord' }, discordChannelId: '1' }), 'discord');
  assert.equal(chatDestination('origin', { user: { platform: 'discord' } }), 'twitch', 'a Discord event with no channel went nowhere');
  assert.equal(off, false);
  assert.equal(byDefault, true, 'commands everywhere is not on by default');
  assert.ok(read('../engine/index.js').includes("if (services.discord?.commandsEverywhere?.() === false) return;"));
  assert.ok(read('../../web/components/views/ConnectionsView.tsx').includes('data-discord-commands-everywhere'));
});
