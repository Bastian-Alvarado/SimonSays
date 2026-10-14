/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: every stream kept (server/engine/stream-sessions.js) and what
 * each person has done across them (server/engine/viewer-history.js) — chat
 * speed by minute and platform, who took part, songs, clips, the channel's
 * changes, a stream that drops and comes back being one stream, VOD links;
 * messages, attendance and streaks, support, giveaway wins, two people's
 * histories adding up when they are linked; and forgetting people who have
 * been away, only when chosen and only those with nothing to keep them.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import path from 'node:path';
import { assert, bus, collection, EVENTS, fs, normaliseChat, normaliseEvent, test } from './harness.js';

const sessions = await import('../../engine/stream-sessions.js');
const history = await import('../../engine/viewer-history.js');
const leveling = await import('../../leveling/index.js');
const { config } = await import('../../config.js');
sessions.initStreamSessions();
history.initViewerHistory();

const historyFile = path.join(config.dataDir, 'viewer_history.json');
const say = (over) => bus.emit(EVENTS.CHAT, normaliseChat({ msg: 'hola', ...over }));
const event = (type, over = {}) => bus.emit(EVENTS.EVENT, normaliseEvent({ type, ...over }));
const uidOf = (key) => leveling.getAccounts()[key];

// ---------------------------------------------------------------- stream 1

event('obs_stream_started');
say({ platform: 'twitch', user: 'AnaH', userId: 'h-ana', isSub: true });
say({ platform: 'twitch', user: 'AnaH', userId: 'h-ana' });
say({ platform: 'tiktok', user: 'BetoH', userId: 'h-beto' });
say({ platform: 'youtube', user: 'Yuyu', userId: 'UCh-yuyu' });
say({ platform: 'twitch', user: 'Elbot', userId: 'h-bot', isBot: true });
say({ platform: 'twitch', user: 'Streamer', userId: 'h-me', isBroadcaster: true });
event('spotify_track_change', { platform: 'spotify', user: 'Artista', data: { title: 'Canción', artist: 'Artista' } });
bus.emit(EVENTS.CHANNEL, { title: 'Jugando cosas', categoryName: 'Among Us' });
bus.emit('stream:moment', { kind: 'clip', url: 'https://clips.twitch.tv/x' });
event('twitch_cheer', { platform: 'twitch', user: 'AnaH', data: { bits: 100, userId: 'h-ana' } });
event('twitch_sub', { platform: 'twitch', user: 'BetoGift', data: { userId: 'h-gifted', giftedBy: 'AnaH' } });
event('giveaway_winner', { platform: 'twitch', user: 'AnaH', data: { userId: 'h-ana', prize: 'x' } });
// Talking elsewhere in the Discord server is being seen, not taking part.
bus.emit('discord:message_elsewhere', normaliseChat({ platform: 'discord', user: 'AnaD', userId: '990000000000000001', msg: 'hola', raw: { channelId: 'c9' } }));
const onNow = sessions.current();
const savedBeforeFlush = fs.existsSync(historyFile);
event('obs_stream_stopped');
await sessions._test.finish();

// ---------------------------------------------------------------- stream 2, which drops and comes back

event('obs_stream_started');
say({ platform: 'twitch', user: 'AnaH', userId: 'h-ana' });
event('obs_stream_stopped');
event('obs_stream_started');
const afterDrop = sessions.current();
say({ platform: 'youtube', user: 'Yuyu', userId: 'UCh-yuyu' });
event('obs_stream_stopped');
await sessions._test.finish();
const streams = sessions.finished();
const first = streams.at(-2);
const second = streams.at(-1);

const ana = history.historyOf(uidOf('twitch:h-ana'));
const beto = history.historyOf(uidOf('tiktok:h-beto'));
const gifted = history.historyOf(uidOf('twitch:h-gifted'));
const discordOnly = history.historyOf(uidOf('discord:990000000000000001'));
history._test.flush();
const savedAfterFlush = fs.existsSync(historyFile);

test('a stream is kept: chat speed by minute and platform, who took part, songs, the channel, clips', () => {
  assert.equal(onNow.n, first.n);
  assert.ok(first.startedAt && first.endedAt);
  // [all, twitch, youtube, tiktok, discord, kick]: the bot is not counted, the streamer is.
  assert.deepEqual(first.minutes[0], [5, 3, 1, 1, 0, 0]);
  const people = Object.values(first.attendees);
  assert.equal(people.length, 3, JSON.stringify(first.attendees));
  assert.deepEqual(first.attendees[uidOf('twitch:h-ana')], { m: 2, p: ['twitch'] });
  assert.equal(first.songs[0].title, 'Canción');
  assert.equal(first.game, 'Among Us');
  assert.equal(first.channel[0].title, 'Jugando cosas');
  assert.deepEqual(first.moments.map((m) => m.kind), ['clip']);
  assert.deepEqual(sessions.summary(first).people, 3);
});

test('a stream that drops and is back within minutes is the same stream; the next one is numbered after it', () => {
  assert.equal(second.n, first.n + 1);
  assert.equal(afterDrop.id, second.id, 'a drop started a new stream');
  assert.equal(Object.keys(second.attendees).length, 2);
  const s = { ...first, vod: { url: 'https://www.twitch.tv/videos/1', createdAt: new Date(first.startedAt).toISOString() } };
  assert.equal(sessions.vodLink(s, first.startedAt + 3_723_000), 'https://www.twitch.tv/videos/1?t=1h02m03s');
  assert.equal(sessions.vodLink(first, first.startedAt), '', 'a link was made without a VOD');
});

test('each person has a history: messages per platform, streams and streaks, support, giveaway wins', () => {
  assert.equal(ana.msgs.twitch, 3);
  assert.equal(ana.streams, 2);
  assert.equal(ana.streak, 2);
  assert.equal(ana.bestStreak, 2);
  assert.equal(ana.support.bits, 100);
  assert.equal(ana.wins, 1);
  assert.equal(beto.streams, 1);
  assert.equal(beto.streak, 0, 'a streak carried past a stream they missed');
  assert.equal(gifted?.support?.subs || 0, 0, 'a gifted sub counted as one bought');
  assert.equal(discordOnly.msgs.discord, 1);
  assert.equal(discordOnly.streams, 0, 'talking elsewhere in Discord counted as taking part in the stream');
  assert.equal(savedBeforeFlush, false, 'history was written with every message');
  assert.equal(savedAfterFlush, true);
});

// ---------------------------------------------------------------- two people become one

leveling.link({ platform: 'twitch', id: 'h-ana', username: 'AnaH' }, { platform: 'youtube', id: 'UCh-yuyu' });
const merged = history.historyOf(uidOf('twitch:h-ana'));

test('linking two people adds their histories together', () => {
  assert.equal(merged.msgs.twitch, 3);
  assert.equal(merged.msgs.youtube, 2);
  assert.equal(merged.streams, 2, 'a stream both attended was counted twice');
  assert.equal(merged.support.bits, 100);
  assert.deepEqual(merged.platforms.sort(), ['twitch', 'youtube']);
});

// ---------------------------------------------------------------- forgetting, only when chosen

const users = collection('users', {});
const old = Date.now() - 400 * 24 * 3_600_000;
const oldOne = leveling.personFor('tiktok', 'h-old', 'Viejo');
const oldKept = leveling.personFor('tiktok', 'h-old-points', 'Puntos');
users.update((prev) => {
  for (const uid of [oldOne, oldKept, uidOf('twitch:h-ana')]) prev[uid] = { ...prev[uid], createdAt: old, lastXpTime: old };
  return prev;
});
const neverForgets = history.prune();
history.keepWhen((uid) => uid === oldKept);
let badMonths = null;
try { history.setHistorySettings({ forgetAfterMonths: 5 }); } catch (err) { badMonths = err.code; }
history.setHistorySettings({ forgetAfterMonths: 6 });
const stats = history.historyStats();
const pruned = history.prune();
history.setHistorySettings({ forgetAfterMonths: 0 });

test('people away too long are forgotten only when chosen, and only those with nothing to keep them', () => {
  assert.deepEqual(neverForgets, { people: 0, accounts: 0 }, 'somebody was forgotten while the setting was "never"');
  assert.equal(badMonths, 'history_bad_months');
  assert.ok(stats.wouldForget[6] >= 1);
  assert.ok(pruned.people >= 1);
  assert.equal(uidOf('tiktok:h-old'), undefined, 'the one away a year was kept');
  assert.ok(uidOf('tiktok:h-old-points'), 'somebody with points to spend was forgotten');
  assert.ok(uidOf('twitch:h-ana'), 'a linked person was forgotten');
  assert.equal(history.getHistorySettings().forgetAfterMonths, 0);
});

// ---------------------------------------------------------------- a stream whose end was missed

const HOUR = 3_600_000;
const asks = (onObs, info) => ({ obs: async () => onObs, twitch: async () => info });
const endOf = async () => { const s = sessions.latest(); await sessions._test.finish(); return s; };
const offline = { live: false };

// OBS can be asked, and is not streaming.
event('obs_stream_started');
const obsStillOn = await (async () => { await sessions._test.checkStillLive(Date.now(), asks(true, { live: true })); return sessions.current(); })();
const seenOnTwitch = Boolean(obsStillOn?.onTwitch);
const obsAt = Date.now();
await sessions._test.checkStillLive(obsAt, asks(false, null));
const obsOver = await endOf();

// OBS found not streaming hours after anything was known of the stream: it ended then, not now.
const lateStart = Date.now() - 4 * 3_600_000;
sessions._test.onEvent({ type: 'obs_stream_started' }, lateStart);
sessions._test.onChat(normaliseChat({ platform: 'twitch', user: 'AnaH', userId: 'h-ana', msg: 'hola' }), lateStart + 30_000);
const lastKnown = sessions.lastSign(sessions.current());
await sessions._test.checkStillLive(Date.now(), asks(false, null));
const lateOver = sessions.latest();
await new Promise((r) => setTimeout(r, 30));
const lateKeptAlone = sessions.finished().some((x) => x.id === lateOver.id);

// Quiet for hours, but OBS said it was streaming a check ago: one check nobody can answer does not end it.
event('obs_stream_started');
const quietButOn = Date.now() + 7 * 3_600_000;
await sessions._test.checkStillLive(quietButOn, asks(true, null));
await sessions._test.checkStillLive(quietButOn + 3 * 60_000, asks(null, null));
const confirmedQuietStillOn = sessions.isRunning();
// Told it started again while on: the same stream, not a new one over it.
const onBefore = sessions.current().id;
event('obs_stream_started');
const sameAfterTwice = sessions.current()?.id === onBefore;
await sessions._test.checkStillLive(quietButOn + 6 * 60_000, asks(false, null));
await endOf();

// OBS cannot be asked: Twitch, offline twice in a row, ends one seen on Twitch from the first time.
event('obs_stream_started');
await sessions._test.checkStillLive(Date.now(), asks(null, { live: true }));
const firstOffline = Date.now() + 3 * 60_000;
await sessions._test.checkStillLive(firstOffline, asks(null, offline));
const afterOneOffline = sessions.isRunning();
await sessions._test.checkStillLive(firstOffline + 3 * 60_000, asks(null, offline));
const twitchOver = await endOf();

// Never seen on Twitch (sent elsewhere): Twitch being offline says nothing; hours of nothing do.
event('obs_stream_started');
say({ platform: 'youtube', user: 'Yuyu', userId: 'UCh-yuyu' });
const quietFrom = sessions.lastSign(sessions.current());
await sessions._test.checkStillLive(Date.now() + 10 * 60_000, asks(null, offline));
await sessions._test.checkStillLive(Date.now() + 20 * 60_000, asks(null, offline));
const elsewhereStillOn = sessions.isRunning();
await sessions._test.checkStillLive(Date.now() + 5 * HOUR, asks(null, null));
const fiveHoursQuiet = sessions.isRunning();
await sessions._test.checkStillLive(Date.now() + 7 * HOUR, asks(null, null));
const quietOver = await endOf();

// OBS connects while already streaming, with no stream counted: one starts.
const noneBefore = sessions.isRunning();
await sessions._test.onObsBack(asks(true, null));
const counted = sessions.current();
await sessions._test.onObsBack(asks(false, null));
const countedOver = await endOf();

// Through OBS's own status: connected again, and streaming, starts one; stopped, ends it.
sessions._test.useAskers(asks(true, null));
bus.emit(EVENTS.STATUS, { platform: 'obs', status: 'disconnected' });
bus.emit(EVENTS.STATUS, { platform: 'obs', status: 'connected' });
await new Promise((r) => setTimeout(r, 20));
const startedByStatus = sessions.isRunning();
sessions._test.useAskers(asks(false, null));
bus.emit(EVENTS.STATUS, { platform: 'obs', status: 'connected', currentScene: 'x' });
await new Promise((r) => setTimeout(r, 20));
const notAskedAgainWhileConnected = sessions.isRunning();
bus.emit(EVENTS.STATUS, { platform: 'obs', status: 'disconnected' });
bus.emit(EVENTS.STATUS, { platform: 'obs', status: 'connected' });
await new Promise((r) => setTimeout(r, 20));
const endedByStatus = !sessions.isRunning();
sessions._test.useAskers(null);
await sessions._test.finish();

test('a stream whose end was missed is ended: by OBS, by Twitch twice, or by hours of nothing', () => {
  assert.ok(seenOnTwitch, 'a stream Twitch said was live was not marked as on Twitch');
  assert.equal(obsOver.endedAt, obsAt, 'OBS not streaming did not end the stream then');
  assert.equal(lateOver.endedAt, lastKnown, 'a stream found over hours later was kept as ending when it was found');
  assert.ok(lateKeptAlone, 'a stream found over long after was not kept straight away');
  assert.equal(confirmedQuietStillOn, true, 'a quiet stream OBS had just said was on was ended by one unanswered check');
  assert.equal(sameAfterTwice, true, 'a second "started" replaced the stream on');
  assert.equal(afterOneOffline, true, 'one offline answer from Twitch ended the stream');
  assert.equal(twitchOver.endedAt, firstOffline, 'the stream did not end from the first offline answer');
  assert.equal(elsewhereStillOn, true, 'a stream never on Twitch was ended because Twitch was offline');
  assert.equal(fiveHoursQuiet, true, 'a stream was ended after five quiet hours');
  assert.equal(quietOver.endedAt, quietFrom, 'a quiet stream did not end at its last sign of life');
  assert.ok(sessions.finished().some((s) => s.id === quietOver.id), 'a stream ended late was not kept');
  assert.equal(sessions.isRunning(), false);
});

test('OBS found already streaming starts a stream, and found stopped ends it', () => {
  assert.equal(noneBefore, false);
  assert.ok(counted?.startedAt, 'OBS streaming at connect did not start a stream');
  assert.ok(countedOver.endedAt, 'OBS stopped at connect did not end the stream');
  assert.equal(startedByStatus, true, 'OBS connecting while streaming did not start a stream');
  assert.equal(notAskedAgainWhileConnected, true, 'every OBS status while connected asked again');
  assert.equal(endedByStatus, true, 'OBS connecting again, not streaming, did not end the stream');
  assert.equal(sessions.streamNow(), null);
});
