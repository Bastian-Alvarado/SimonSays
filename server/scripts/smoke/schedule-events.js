/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Twitch schedule as Discord events — made, followed when a
 * stream moves or is cancelled, left alone once deleted by hand, and started
 * and ended with the stream so Discord tells whoever is interested.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, collection, fs, test } from './harness.js';

const se = await import('../../engine/schedule-events.js');
const { config } = await import('../../config.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

const GUILD = '900000000000000001';
const discordSettings = collection('discord_settings', {});
const settingsBefore = discordSettings.get();
discordSettings.set({ ...settingsBefore, guildId: GUILD });

const calls = [];
let nextId = 950000000000000000n;
let deletedByHand = new Set();
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.includes('discord.com')) return realFetch(url, init);
  const path = u.replace(/^.*\/api\/v10/, '');
  const method = init.method || 'GET';
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  calls.push({ method, path, body });
  const id = path.split('/').pop();
  if (method !== 'POST' && deletedByHand.has(id)) return new Response(JSON.stringify({ message: 'Unknown Guild Scheduled Event' }), { status: 404 });
  if (method === 'POST') { nextId += 1n; return new Response(JSON.stringify({ id: String(nextId) }), { status: 200 }); }
  if (method === 'DELETE') return new Response(null, { status: 204 });
  return new Response('{}', { status: 200 });
};
const realToken = config.discord.botToken;
config.discord.botToken = 'test-token';
se.initScheduleEvents();

const now = Date.parse('2026-10-03T12:00:00Z');
const day = 86_400_000;
const seg = (id, at, extra = {}) => ({ id, start: new Date(at).toISOString(), end: null, title: `Directo ${id}`, category: 'Among Us', ...extra });
const s1 = seg('s1', now + day);
const s2 = seg('s2', now + 2 * day, { end: new Date(now + 2 * day + 2 * 3_600_000).toISOString() });
const s3 = seg('s3', now + 3 * day);
const of = (method) => calls.filter((c) => c.method === method);

const whileOff = await se.syncScheduleEvents({ segments: [s1, s2], now });
const offCalls = calls.length;

se.setScheduleEvents({ enabled: true, count: 2, description: '{game}\n¡En {link}!' });
await new Promise((r) => setTimeout(r, 20));
calls.length = 0;
const first = await se.syncScheduleEvents({ segments: [s1, s2, s3], now });
const made = of('POST').map((c) => c.body);
calls.length = 0;
const again = await se.syncScheduleEvents({ segments: [s1, s2, s3], now });
const againCalls = calls.length;

// Retitled on Twitch: the event is renamed.
calls.length = 0;
await se.syncScheduleEvents({ segments: [{ ...s1, title: 'Noche de terror' }, s2, s3], now });
const renamed = of('PATCH');

// s2 cancelled: its event goes, and s3 comes into the next two.
calls.length = 0;
await se.syncScheduleEvents({ segments: [{ ...s1, title: 'Noche de terror' }, s3], now });
const afterCancel = calls.map((c) => c.method).sort();
const s2Event = made[1] && se.getScheduleEvents().made.s2;

// s3's event deleted by hand in Discord: when s3 changes, it is not made again.
const s3Event = se.getScheduleEvents().made.s3?.eventId;
deletedByHand = new Set([s3Event]);
calls.length = 0;
await se.syncScheduleEvents({ segments: [{ ...s1, title: 'Noche de terror' }, { ...s3, title: 'Otro' }], now });
await se.syncScheduleEvents({ segments: [{ ...s1, title: 'Noche de terror' }, { ...s3, title: 'Otro' }], now });
const afterHandDelete = of('POST').length;
const gone = se.getScheduleEvents().gone;

// The day comes: s1's time passes before going live — kept, started with the stream, ended with it.
const s1At = Date.parse(s1.start);
calls.length = 0;
await se.syncScheduleEvents({ segments: [{ ...s1, title: 'Noche de terror' }, { ...s3, title: 'Otro' }], now: s1At + 20 * 60_000 });
const keptLate = Boolean(se.getScheduleEvents().made.s1);
const deletedLate = of('DELETE').length;
const started = await se.onStream('started', s1At + 25 * 60_000);
const startPatch = calls.find((c) => c.method === 'PATCH' && c.body?.status === 2);
await se.syncScheduleEvents({ segments: [{ ...s3, title: 'Otro' }], now: s1At + 30 * 60_000 });
const keptWhileLive = Boolean(se.getScheduleEvents().made.s1);
const ended = await se.onStream('stopped', s1At + 4 * 3_600_000);
const endPatch = calls.find((c) => c.method === 'PATCH' && c.body?.status === 3);
const forgotten = !se.getScheduleEvents().made.s1;

se.setScheduleEvents({ enabled: false });
const shown = await se.control({ settings: { count: 2 } });
let offRefusal = null;
try { await se.control({ op: 'sync' }); } catch (err) { offRefusal = err; }

globalThis.fetch = realFetch;
config.discord.botToken = realToken;
discordSettings.set(settingsBefore);

test('the next streams on the schedule become Discord events, and nothing happens while it is off', () => {
  assert.equal(whileOff.skipped, true);
  assert.equal(offCalls, 0);
  assert.equal(first.created, 2, 'the number set was not kept to');
  assert.equal(made[0].name, 'Directo s1');
  assert.equal(made[0].entity_type, 3);
  assert.equal(made[0].privacy_level, 2);
  assert.equal(made[0].scheduled_start_time, s1.start);
  assert.equal(Date.parse(made[0].scheduled_end_time) - Date.parse(s1.start), se.DEFAULT_LENGTH_MS, 'a stream with no end was given none');
  assert.equal(made[1].scheduled_end_time, new Date(Date.parse(s2.end)).toISOString());
  assert.match(made[0].description, /^Among Us\n¡En .*!$/);
  assert.equal(againCalls, 0, 'an unchanged schedule changed Discord');
  assert.equal(again.created + again.updated + again.removed, 0);
});

test('a stream retitled, moved or cancelled on Twitch follows in Discord; one deleted by hand stays deleted', () => {
  assert.equal(renamed.length, 1);
  assert.equal(renamed[0].body.name, 'Noche de terror');
  assert.deepEqual(afterCancel, ['DELETE', 'POST'], 'the cancelled stream\'s event stayed, or the next one was not made');
  assert.equal(s2Event, undefined);
  assert.equal(afterHandDelete, 0, 'an event deleted by hand was made again');
  assert.ok(gone.includes('s3'));
});

test('going live starts the event for this stream — Discord tells whoever is interested — and stopping ends it', () => {
  assert.ok(keptLate, 'the event was forgotten while its stream was still about to start');
  assert.equal(deletedLate, 0, 'the event for the stream about to start was deleted');
  assert.ok(started && startPatch, 'going live did not start the event');
  assert.ok(keptWhileLive, 'the event was forgotten while the stream was on');
  assert.equal(ended, started);
  assert.ok(endPatch?.path.endsWith(`/scheduled-events/${started}`));
  assert.ok(forgotten);
  assert.equal(offRefusal?.code, 'schedule_events_off');
});

test('the Go live screen sets it up, and the schedule keeps Twitch\'s ids', () => {
  const view = read('../../web/components/views/GoLiveView.tsx');
  assert.ok(view.includes('data-schedule-events-toggle') && view.includes('data-schedule-events-sync'));
  assert.ok(read('../platforms/twitch.js').includes(".map((s) => ({ id: s.id || '', start: s.start_time,"));
  assert.ok(read('../index.js').includes('initScheduleEvents();'));
  assert.ok(read('../api/ws.js').includes('return reply(await scheduleEvents.control(payload));'));
  assert.deepEqual(se.cleanScheduleEvents({ count: 9, description: 'x'.repeat(2000) }).count, 5);
  // With no Twitch login there is no link: the line asking people there goes, not half of it.
  const linkless = se.eventFor(s1, { description: '{game}\n¡Te espero en {link}!\nSin variables' }, '');
  assert.equal(linkless.description, 'Among Us\nSin variables');
  assert.equal(linkless.entity_metadata.location, 'Twitch');
});

test('saving the settings answers with what the screen shows, not the ids kept behind it', () => {
  assert.equal(shown.count, 2);
  assert.ok(!('made' in shown) && !('gone' in shown), 'the ids kept behind the events went to the screen');
  assert.equal(typeof shown.events, 'number');
});
