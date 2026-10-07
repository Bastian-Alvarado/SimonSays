/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Events dock. Only viewers' events, and every kind of them;
 * one row for a gifted bundle; Twitch's twice-told events counted once; this
 * stream's totals; an event's alert again; a thank-you in chat; and the dock
 * tab that puts it in OBS.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, collection, engine, EVENTS, fs, normaliseEvent, said, settle, test } from './harness.js';
import { EXCLUDED, MANIFEST } from './backup-and-layouts.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const ve = await import('../../../shared/viewer-events.js');
const { createPairer, PAIRED_TYPES } = await import('../../platforms/twitch.js');

// ------------------------------------------------------------ Twitch tells some things twice

test('a sub, cheer or raid told by both Twitch connections counts once; two real ones count twice', () => {
  const isNews = createPairer(15000);
  const raid = { type: 'twitch_raid', user: 'Gorrito_B', data: { amount: 5 } };
  assert.equal(isNews('irc', raid, 1000), true);
  assert.equal(isNews('eventsub', { ...raid, user: 'gorrito_b' }, 1062), false, 'the live raid that was counted twice');
  // Two cheers of the same size over the same connection are two cheers.
  const cheer = { type: 'twitch_cheer', user: 'Ana', data: { amount: 100 } };
  assert.equal(isNews('irc', cheer, 2000), true);
  assert.equal(isNews('irc', cheer, 2500), true);
  assert.equal(isNews('eventsub', cheer, 2600), false);
  assert.equal(isNews('eventsub', cheer, 2700), false);
  // A different amount, or long after, is another event.
  assert.equal(isNews('eventsub', { ...cheer, data: { amount: 500 } }, 2800), true);
  assert.equal(isNews('eventsub', raid, 60000), true);
  assert.deepEqual(PAIRED_TYPES, ['twitch_sub', 'twitch_cheer', 'twitch_raid']);

  const twitch = read('../platforms/twitch.js');
  assert.ok(twitch.includes("emitTwitchEvent('irc', {\n      type: 'twitch_raid'") || twitch.includes("emitTwitchEvent('irc', {\r\n      type: 'twitch_raid'"), 'chat\'s raid is not paired');
  assert.ok(twitch.includes("emitTwitchEvent('eventsub', { ...mapped, platform: 'twitch' });"), 'EventSub\'s events are not paired');
  // A gifted sub is chat's to tell, with who gave it and its bundle.
  assert.ok(twitch.includes("(e) => (e.is_gift ? null : { type: 'twitch_sub'"));
  // Whichever copy of a cheer is kept carries the viewer's id, for their bits towards a Discord role.
  assert.ok(twitch.includes("userId: (!e.is_anonymous && e.user_id) || undefined"));
});

// ------------------------------------------------------------ only viewers, every kind

test('the list is viewers only — no Spotify or OBS — with YouTube and gifted bundles, and a bundle is one row', () => {
  const ev = (type, data = {}, id = type) => ({ id, type, platform: type.split('_')[0], user: 'X', timestamp: 1, data });
  assert.equal(ve.isViewerEvent(ev('spotify_track_change')), false);
  assert.equal(ve.isViewerEvent(ev('obs_stream_started')), false);
  for (const type of ['youtube_cheer', 'youtube_sub', 'youtube_sub_gift_bulk', 'twitch_sub_gift_bulk']) assert.equal(ve.isViewerEvent(ev(type)), true, type);
  assert.equal(ve.isViewerEvent(ev('twitch_sub', { fromBulk: true, giftedBy: 'Y' })), false, 'one sub of a bundle got its own row');
  assert.equal(ve.isViewerEvent(ev('twitch_sub', { giftedBy: 'Y' })), true, 'a single gifted sub was dropped');
  let list = [];
  for (let i = 0; i < ve.VIEWER_EVENT_LIMIT + 20; i += 1) list = ve.withViewerEvent(list, ev('twitch_follow', {}, `f${i}`));
  assert.equal(list.length, ve.VIEWER_EVENT_LIMIT);
  assert.equal(list[0].id, `f${ve.VIEWER_EVENT_LIMIT + 19}`, 'the newest is not first');
  assert.equal(ve.withViewerEvent(list, list[0]).length, list.length, 'the same event went in twice');
  assert.ok(ve.VIEWER_EVENT_LIMIT >= 100);
});

// Through the engine, as they arrive.
collection('viewer_events', []).set([]);
const emit = (type, user, data = {}, platform = type.split('_')[0]) => bus.emit(EVENTS.EVENT, normaliseEvent({ type, platform, user, data }));
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'obs_stream_started', platform: 'obs', user: 'OBS', data: {} }));
emit('spotify_track_change', 'Spotify', { title: 'Song' }, 'spotify');
emit('twitch_follow', 'Ana');
emit('youtube_cheer', 'Pepe', { amount: 'MX$100.00', message: '¡Saludos!' });
emit('youtube_cheer', 'Lu', { amount: 'MX$50.00' });
emit('youtube_sub', 'Memo', { tier: 'Fan' });
emit('twitch_sub_gift_bulk', 'Generoso', { count: 5, amount: 5, tier: 1, giftedBy: 'Generoso' });
emit('twitch_sub', 'Suertudo', { giftedBy: 'Generoso', fromBulk: true, tier: 1 });
emit('twitch_cheer', 'Bits', { bits: 250, amount: 250 });
await settle();
const listNow = engine.snapshot().viewerEvents.map((e) => e.type);
const totalsNow = engine.snapshot().eventTotals;

test('the engine keeps the list and this stream\'s totals, from when the stream started', () => {
  assert.deepEqual(listNow, ['twitch_cheer', 'twitch_sub_gift_bulk', 'youtube_sub', 'youtube_cheer', 'youtube_cheer', 'twitch_follow']);
  assert.deepEqual(
    [totalsNow.follows, totalsNow.gifted, totalsNow.members, totalsNow.bits, totalsNow.subs],
    [1, 5, 1, 250, 0],
  );
  assert.deepEqual(totalsNow.superChat, { MX$: 150 });
  assert.ok(totalsNow.startedAt > 0);
  // Each screen adds a new one itself, by the same rules, rather than the list being sent again.
  assert.ok(read('../../web/hooks/useBackend.ts').includes('viewerEvents: withViewerEvent(prev.viewerEvents, p),'));
});

test('Super Chat amounts are added per currency, however they are written', () => {
  assert.deepEqual(ve.readMoney('MX$100.00'), { currency: 'MX$', value: 100 });
  assert.deepEqual(ve.readMoney('$5.00'), { currency: '$', value: 5 });
  assert.deepEqual(ve.readMoney('€2,50'), { currency: '€', value: 2.5 });
  assert.deepEqual(ve.readMoney('1.234,56 €'), { currency: '€', value: 1234.56 });
  assert.deepEqual(ve.readMoney('1,234.56 US$'), { currency: 'US$', value: 1234.56 });
  assert.equal(ve.readMoney('gracias'), null);
});

// ------------------------------------------------------------ replay, thank, start over

const alertsStore = collection('alerts', []);
const alertsBefore = alertsStore.get();
engine.store.saveAlert({ id: 'a-events-raid', type: 'twitch_raid', enabled: true, name: 'Raid' });
alertsStore.set(alertsStore.get().filter((a) => a.id === 'a-events-raid'));
const raidEvent = { id: 'ev-raid', type: 'twitch_raid', platform: 'twitch', user: 'Gorrito_B', timestamp: Date.now(), data: { viewers: 5, amount: 5, login: 'gorrito_b' } };
const shareEvent = { id: 'ev-share', type: 'tiktok_share', platform: 'tiktok', user: 'Kiko', timestamp: Date.now(), data: {} };
collection('viewer_events', []).set([raidEvent, shareEvent]);

const fired = [];
const hear = (a) => fired.push(a.config?.id);
bus.on(EVENTS.ALERT, hear);
const replayed = await engine.store.events({ op: 'replay', id: 'ev-raid' });
bus.off(EVENTS.ALERT, hear);
let noAlert = null;
try { await engine.store.events({ op: 'replay', id: 'ev-share' }); } catch (err) { noAlert = err; }
let gone = null;
try { await engine.store.events({ op: 'replay', id: 'ev-nope' }); } catch (err) { gone = err; }

said.length = 0;
const thanked = await engine.store.events({ op: 'thank', id: 'ev-raid' });
let notTwitch = null;
try { await engine.store.events({ op: 'thank', id: 'ev-share' }); } catch (err) { notTwitch = err; }
await engine.store.events({ op: 'settings', settings: { thanks: 'Gracias {user} por {what}' } });
await engine.store.events({ op: 'thank', id: 'ev-raid' });
const saidThanks = [...said];
await engine.store.events({ op: 'settings', settings: { thanks: '' } });
const thanksBack = engine.snapshot().eventsDockSettings.thanks;
await engine.store.events({ op: 'reset_totals' });
const totalsAfterReset = engine.snapshot().eventTotals;
alertsStore.set(alertsBefore);
collection('viewer_events', []).set([]);

test('an event\'s alert plays again, and says so when there is none for it', () => {
  assert.deepEqual(replayed, { ok: true });
  assert.deepEqual(fired, ['a-events-raid']);
  assert.equal(noAlert?.code, 'no_alert_for_event');
  assert.equal(gone?.code, 'event_gone');
});

test('"Thank" says it in Twitch chat, in the stream\'s words or the streamer\'s own', () => {
  assert.equal(thanked.said, '¡Gracias, @Gorrito_B, por la raid! 💜');
  assert.deepEqual(saidThanks, ['¡Gracias, @Gorrito_B, por la raid! 💜', 'Gracias Gorrito_B por la raid']);
  assert.equal(notTwitch?.code, 'cannot_thank');
  assert.equal(thanksBack, ve.DEFAULT_THANKS, 'an empty line was kept instead of going back to the default');
  const t = (type, data, user = 'X') => ve.thanksFor({ type, user, data });
  assert.deepEqual(t('twitch_sub', { giftedBy: 'Generoso' }, 'Suertudo'), { user: 'Generoso', what: 'regalarle una sub a Suertudo' });
  assert.equal(t('twitch_sub', { months: 12 }).what, 'los 12 meses de sub');
  assert.equal(t('twitch_cheer', { bits: 100 }).what, 'los 100 bits');
  assert.equal(t('twitch_sub_gift_bulk', { count: 5 }).what, 'las 5 subs de regalo');
});

test('the totals can start over by hand', () => {
  assert.deepEqual([totalsAfterReset.follows, totalsAfterReset.bits, totalsAfterReset.gifted], [0, 0, 0]);
});

// ------------------------------------------------------------ the screens

test('the list has words for every kind of viewer event, and the omnibar\'s Recent slot names them too', () => {
  const feed = read('../../web/components/EventFeed.tsx');
  for (const type of ve.VIEWER_EVENT_TYPES) assert.ok(feed.includes(`case '${type}':`), `${type} has no words in the list`);
  const omnibar = read('../../web/components/Omnibar.tsx');
  for (const type of ['twitch_sub_gift_bulk', 'youtube_sub', 'youtube_cheer', 'youtube_sub_gift_bulk']) assert.ok(omnibar.includes(`case '${type}':`), `the omnibar skips ${type}`);
  // Filters for every platform with events, and by kind.
  assert.ok(feed.includes("const PLATFORM_FILTERS = ['twitch', 'youtube', 'tiktok'] as const;"));
  assert.ok(feed.includes('EVENT_KINDS.map((k) =>'));
  // Yesterday's events say which day they were.
  assert.ok(feed.includes("d.toDateString() === today ? time :"));
});

test('the Events dock is in OBS as a tab of the chat dock, and the screen asks before emptying', () => {
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("{ id: 'events', label: t.dockTabEvents || 'Events', icon: List },"));
  assert.ok(app.includes("panel === 'events' && (") && app.includes('<EventFeed\n            compact') || app.includes('<EventFeed\r\n            compact'));
  const screen = read('../../web/components/views/EventsDockView.tsx');
  assert.ok(screen.includes('window.confirm(t.eventsClearConfirm'));
  assert.ok(screen.includes('<EventFeed'));
});

test('the Events dock speaks both languages, and the omnibar\'s event words keep their accents', () => {
  const constants = read('../../web/constants.ts');
  const keys = new Set();
  for (const f of ['EventFeed.tsx', 'views/EventsDockView.tsx']) {
    for (const m of read(`../../web/components/${f}`).matchAll(/\bt\??\.((event|dockTab|refuse|noRecent|noEvents|waiting|adjust)[A-Za-z]*)/g)) keys.add(m[1]);
  }
  for (const k of ve.EVENT_KINDS) keys.add(`eventKind${k.charAt(0).toUpperCase()}${k.slice(1)}`);
  assert.ok(keys.size >= 40, `only ${keys.size} strings found`);
  for (const key of keys) assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  for (const word of ["'te siguió'", "'se suscribió'", "'donó'", "'canjeó'", "'envió'"]) assert.ok(constants.includes(word), word);
});

test('what "Thank" says travels in a backup; tonight\'s totals do not', () => {
  assert.ok(MANIFEST.some((m) => m.name === 'events_dock_settings'));
  assert.ok(EXCLUDED.includes('event_totals') && EXCLUDED.includes('viewer_events'));
});
