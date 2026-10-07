/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: remote players (server/engine/remote-players.js) — four seats
 * with a VDO.Ninja link each, the OBS browser sources that show them, the
 * layouts pointed at those, invites by direct message, and the director's
 * buttons. OBS and Discord are stand-ins here, and so is VDO.Ninja's API.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After scene-types.js.
 */

import { SCRIPT_URL, assert, bus, EVENTS, engine, fs, test } from './harness.js';

const rp = await import('../../engine/remote-players.js');
const { resolvePerson, NAMEPLATE_SOURCE_IDS } = await import('../../../shared/run.js');
const { normaliseLayouts } = await import('../../engine/layouts.js');
const profiles = await import('../../engine/profiles.js');
const omni = await import('../../engine/omnilayer.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// What VDO.Ninja's getDetails answered in a real try: the page alone, and with somebody sending to it.
const ALONE = JSON.stringify({ X5hasVEP: { streamID: 'X5hasVEP', localstream: true, localStream: true, videoVisible: false, label: false } });
const sending = (streamId) => JSON.stringify({
  [streamId]: {
    streamID: streamId, label: 'ProbeTester', localStream: false, muted: false, videoMuted: false, videoVisible: true,
    miscellaneous: { label: 'ProbeTester', video_init_width: 1920, video_init_height: 1080, video_init_frameRate: 60, version: '31.1' },
  },
  SnKsL3k: { streamID: 'SnKsL3k', localstream: true, localStream: true, videoVisible: false },
});

// ------------------------------------------------------------ the pieces

test('four seats, each with ids of its own that are kept', () => {
  const v = rp.cleanRemotePlayers({ seats: [{ name: '  Ana  ', discordId: 'nope', quality: 'bad' }] });
  assert.equal(v.seats.length, 4);
  assert.deepEqual(v.seats.map((s) => s.n), [1, 2, 3, 4]);
  assert.equal(v.seats[0].name, 'Ana');
  assert.equal(v.seats[0].discordId, '', 'a Discord id that is not one was kept');
  assert.equal(v.seats[0].quality, rp.DEFAULT_QUALITY);
  const ids = v.seats.flatMap((s) => [s.streamId, s.password, s.apiKey]);
  assert.equal(new Set(ids).size, 12, 'two ids came out the same');
  assert.ok(ids.every((id) => /^[A-Za-z0-9]{12,}$/.test(id)), ids.join(' '));
  assert.deepEqual(rp.cleanRemotePlayers(v), v, 'cleaning again changed the links');
});

test('the invite and the OBS link name the same stream, the password after the #', () => {
  const s = rp.cleanSeat({ name: 'Ana López', streamId: 'abcdEFGH2345', password: 'pw23456789ab', apiKey: 'api234567890abcdefgh', quality: '720p30' }, 2);
  assert.equal(rp.inviteLink(s), 'https://vdo.ninja/?push=abcdEFGH2345&screenshare&quality=1&maxframerate=30&label=Ana%20L%C3%B3pez#p=pw23456789ab');
  assert.equal(rp.viewLink(s), 'https://vdo.ninja/?view=abcdEFGH2345&api=api234567890abcdefgh&cleanoutput&videobitrate=3500#p=pw23456789ab');
  // An empty seat is labelled with its source's name.
  assert.match(rp.inviteLink({ ...s, name: '' }), /&label=Player%202#/);
  assert.match(rp.inviteLink({ ...s, quality: '1080p60' }), /&quality=0&maxframerate=60&/);
});

test('what the page in OBS says is read as off, waiting, connecting or sending', () => {
  assert.deepEqual(rp.readDetails('failed', 'x'), { state: 'off' });
  assert.deepEqual(rp.readDetails('timeout', 'x'), { state: 'off' });
  assert.deepEqual(rp.readDetails(ALONE, 'abc'), { state: 'waiting' });
  assert.deepEqual(rp.readDetails(sending('abc'), 'abc'), { state: 'live', label: 'ProbeTester', width: 1920, height: 1080, fps: 60 });
  const halfway = JSON.parse(sending('abc'));
  halfway.abc.videoVisible = false;
  assert.equal(rp.readDetails(JSON.stringify(halfway), 'abc').state, 'connecting');
});

// ------------------------------------------------------------ the layouts

const slot = (x, y, source = '') => ({ uid: `s${x}${y}`, type: 'source', x, y, width: 736, height: 414, config: { source } });
const plate = (name, source = 'manual') => ({ uid: `p${name}`, type: 'nameplate', x: 0, y: 0, width: 420, height: 48, config: { source, name } });
const FOUR = {
  id: 'four-players-x', name: '4 Players',
  // Out of order on purpose: seats are numbered as read, top row first.
  layers: [slot(784, 516), slot(24, 24), slot(24, 516), slot(784, 24), plate('Player 1'), plate('Player 4'), plate('Rowan')],
};

test('a layout made for remote players is pointed at the seats, as read, plates and all', () => {
  const wired = rp.wireLayout(FOUR);
  const at = (x, y) => wired.layers.find((l) => l.type === 'source' && l.x === x && l.y === y).config.source;
  assert.deepEqual([at(24, 24), at(784, 24), at(24, 516), at(784, 516)], ['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const plates = wired.layers.filter((l) => l.type === 'nameplate').map((l) => l.config.source);
  assert.deepEqual(plates, ['player1', 'player4', 'manual'], 'a plate with somebody’s own name was taken over');
  // Already wired: the same layout back, so nothing is saved for nothing.
  assert.equal(rp.wireLayout(wired), wired);
  assert.equal(rp.wireLayouts([wired]).length, 1);
  const list = [wired];
  assert.equal(rp.wireLayouts(list), list);
});

test('a seat named in a slot stays put, and a slot nudged a few pixels keeps its row', () => {
  const seatsOf = (layout) => rp.wireLayout(layout).layers.map((l) => l.config.source);
  // Slot 2 nudged up two pixels in the editor is still to the right of slot 1, not ahead of it.
  const nudged = { id: 'n', name: 'N', layers: [slot(24, 24), slot(784, 22), slot(24, 516), slot(784, 515)] };
  assert.deepEqual(seatsOf(nudged), ['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  // Seats the streamer has placed are never renumbered; the empty slots take what is left, as read.
  const placed = { id: 'p', name: 'P', layers: [slot(24, 24, 'Player 2'), slot(784, 24, 'Player 1'), slot(24, 516), slot(784, 516)] };
  assert.deepEqual(seatsOf(placed), ['Player 2', 'Player 1', 'Player 3', 'Player 4']);
  const already = { id: 'a', name: 'A', layers: [slot(24, 24, 'Player 1'), slot(784, 22, 'Player 2'), slot(24, 516, 'Player 3'), slot(784, 515, 'Player 4')] };
  assert.equal(rp.wireLayout(already), already, 'set up again renumbered seats that were already right');
  // The same seat twice: the second one takes a free seat rather than showing the same player twice.
  const twice = { id: 't', name: 'T', layers: [slot(24, 24, 'Player 2'), slot(784, 24, 'Player 2')] };
  assert.deepEqual(seatsOf(twice), ['Player 2', 'Player 1']);
});

test('a slot showing something the streamer chose is never taken', () => {
  const coop = { id: 'coop', name: 'Co-op', layers: [slot(0, 0, 'Game Capture'), slot(960, 0)] };
  assert.equal(rp.wireLayout(coop), coop);
  const one = { id: 'one', name: 'Game', layers: [slot(0, 0)] };
  assert.equal(rp.wireLayout(one), one, 'a layout with one slot is not for remote players');
  const five = { id: 'five', name: 'Five', layers: [0, 1, 2, 3, 4].map((i) => slot(i * 10, 0)) };
  assert.equal(rp.wireLayout(five), five);
});

test('a nameplate can follow a seat, and an empty seat draws no name', () => {
  for (const n of [1, 2, 3, 4]) assert.ok(NAMEPLATE_SOURCE_IDS.includes(`player${n}`));
  const kept = normaliseLayouts([{ id: 'l', name: 'L', layers: [plate('Player 3', 'player3')] }])[0].layers[0];
  assert.equal(kept.config.source, 'player3', 'the layouts forgot who the plate follows');
  const remote = { seats: [{ n: 1, name: 'Ana' }, { n: 2, name: '' }] };
  assert.deepEqual(resolvePerson('player1', {}, remote), { name: 'Ana', subtitle: '' });
  assert.equal(resolvePerson('player2', {}, remote).name, '');
  assert.equal(resolvePerson('player3', {}, undefined).name, '');
});

// ------------------------------------------------------------ the screen, with stand-ins

const obsCalls = [];
const fakeObs = {
  connected: true,
  isConnected: () => fakeObs.connected,
  ensureBrowserSource: async (scene, name, settings) => { obsCalls.push(['ensure', scene, name, settings]); return { done: name === 'Player 4' ? 'other_kind' : 'created' }; },
  setBrowserSettings: async (name, settings) => { obsCalls.push(['settings', name, settings]); },
  setMuted: async (name, on) => { obsCalls.push(['mute', name, on]); },
  inputMuted: async (name) => name === 'Player 2',
  reloadBrowser: async (name) => { obsCalls.push(['reload', name]); },
};
const dms = [];
const fakeDiscord = {
  request: async (method, path, opts) => {
    if (opts.body.recipient_id === '700000000000000009') throw new Error('Cannot send messages to this user');
    // Opened nothing: a message to nowhere is not a message sent.
    if (opts.body.recipient_id === '700000000000000007') return {};
    dms.push(['open', opts.body.recipient_id]);
    return { id: `dm-${opts.body.recipient_id}` };
  },
  sendMessage: async (channelId, content, embed, components) => {
    if (channelId === 'dm-700000000000000008') throw new Error('Cannot send messages to this user');
    dms.push(['send', channelId, content, components]);
    return { id: '1' };
  },
};
const rewrites = [];
let refreshes = 0;
const released = [];
const pushed = [];
const onConfig = ({ key, value }) => { if (key === 'remotePlayers') pushed.push(value); };
bus.on(EVENTS.CONFIG, onConfig);

rp.initRemotePlayers({
  obsService: fakeObs,
  discordService: fakeDiscord,
  layouts: { rewrite: (change) => { rewrites.push(change); return { live: ['4 Players'], profiles: 3 }; } },
  scene: () => 'Omnilayer',
  testChannelId: () => '1199000000000000006',
  streamer: () => 'Rowan',
  omnilayer: { refresh: (gone = []) => { refreshes += 1; released.push(...gone); } },
});
const first = rp.getRemotePlayers();
const store = (await import('../../core/store.js')).collection('remote_players', {});
const seatsBefore = JSON.parse(JSON.stringify(store.get().seats));

const setup = await rp.control({ op: 'setup' });
const afterSetup = obsCalls.splice(0);
await rp.control({ op: 'set', n: 1, name: 'Ana', discordId: '700000000000000001', quality: '1080p60' });
const afterQuality = obsCalls.splice(0);
await rp.control({ op: 'set', n: 2, name: 'Bo' });
const nameOnly = obsCalls.splice(0);
await rp.control({ op: 'swap', a: 1, b: 2 });
const afterSwap = obsCalls.splice(0);
const swapped = rp.getRemotePlayers();
const beforeKick = store.get().seats.find((s) => s.n === 3);
await rp.control({ op: 'set', n: 3, name: 'Cata', discordId: '700000000000000003' });
await rp.control({ op: 'kick', n: 3 });
const afterKick = store.get().seats.find((s) => s.n === 3);
const kickCalls = obsCalls.splice(0);
await rp.control({ op: 'mute', n: 1, muted: true });
await rp.control({ op: 'reload', n: 4 });
const directorCalls = obsCalls.splice(0);

let noDiscord = null;
try { await rp.control({ op: 'invite', n: 4 }); } catch (err) { noDiscord = err.code; }
await rp.control({ op: 'invite', n: 2 });
await rp.control({ op: 'invite', n: 4, test: true });
await rp.control({ op: 'set', n: 4, discordId: '700000000000000008' });
let closed = null;
try { await rp.control({ op: 'invite', n: 4 }); } catch (err) { closed = err.code; }
await rp.control({ op: 'set', n: 4, discordId: '700000000000000007' });
let nowhere = null;
try { await rp.control({ op: 'invite', n: 4 }); } catch (err) { nowhere = err.code; }
let unknown = null;
try { await rp.control({ op: 'explode' }); } catch (err) { unknown = err.code; }

// Asking the pages: seat 1 is sending, 2's page is not running, 3's is waiting, VDO.Ninja does not answer for 4.
const realFetch = globalThis.fetch;
const asked = [];
let seatThreeGone = false;
const seatNow = () => store.get().seats;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (!u.startsWith('https://api.vdo.ninja/')) return realFetch(url, init);
  asked.push(u);
  const s = seatNow().find((x) => u.includes(`/${x.apiKey}/`));
  if (s.n === 1) return new Response(sending(s.streamId));
  if (s.n === 2) return new Response('failed');
  if (s.n === 3) return new Response(seatThreeGone ? 'timeout' : ALONE);
  throw new Error('network down');
};
const pushedBefore = pushed.length;
await rp._test.askAll();
const states = rp.getRemotePlayers().seats.map((s) => s.status.state);
const mutedNow = rp.getRemotePlayers().seats.map((s) => s.muted);
const toldOnce = pushed.length - pushedBefore;
await rp._test.askAll();
const toldAgain = pushed.length - pushedBefore - toldOnce;
// Seat 3's page stops answering: once is a page busy connecting somebody, twice is a page gone.
seatThreeGone = true;
await rp._test.askAll();
const afterOneMiss = rp.getRemotePlayers().seats[2].status.state;
await rp._test.askAll();
const afterTwoMisses = rp.getRemotePlayers().seats[2].status.state;
fakeObs.connected = false;
await rp._test.askAll();
const offStates = rp.getRemotePlayers().seats.map((s) => s.status.state);
const askedWhileOff = asked.length;

// The streamer takes seat 3 — empty since the kick — with their capture.
fakeObs.connected = true;
const refreshesBefore = refreshes;
await rp.control({ op: 'me', seat: 3, source: 'Screen Capture' });
const meNow = rp.getRemotePlayers();
const aliasMine = rp.aliasFor('Player 3');
const aliasOther = rp.aliasFor('Player 2');
const aliasNotSeat = rp.aliasFor('Screen Capture');
const refreshedOnTake = refreshes - refreshesBefore;
const askedBeforeMe = asked.length;
await rp._test.askAll();
const askedForMe = asked.slice(askedBeforeMe).filter((u) => u.includes(`/${store.get().seats[2].apiKey}/`)).length;
const myState = rp.getRemotePlayers().seats[2].status.state;
// Swapping seat 3 with seat 1: the streamer goes with it.
await rp.control({ op: 'swap', a: 3, b: 1 });
const meAfterSwap = rp.getRemotePlayers().me.seat;
const aliasAfterSwap = [rp.aliasFor('Player 1'), rp.aliasFor('Player 3')];
// Emptying their seat is the streamer leaving it.
await rp.control({ op: 'kick', n: 1 });
const meAfterKick = rp.getRemotePlayers().me;
const aliasAfterKick = rp.aliasFor('Player 1');
// A seat with no capture chosen stays a remote player's in OBS.
await rp.control({ op: 'me', seat: 2, source: '' });
const aliasNoSource = rp.aliasFor('Player 2');
const releasedBeforeLeaving = released.length;
await rp.control({ op: 'me', seat: 4, source: 'Cam' });
await rp.control({ op: 'me', seat: 0 });
const releasedOnLeave = released.slice(releasedBeforeLeaving);
globalThis.fetch = realFetch;
rp.stopRemotePlayers();
bus.off(EVENTS.CONFIG, onConfig);

test('setting up makes the four sources in the scene and wires the layouts everywhere', () => {
  assert.deepEqual(afterSetup.map((c) => [c[0], c[1], c[2]]), [1, 2, 3, 4].map((n) => ['ensure', 'Omnilayer', `Player ${n}`]));
  const s1 = seatsBefore.find((s) => s.n === 1);
  assert.equal(afterSetup[0][3].url, rp.viewLink(s1), 'the source does not view its seat');
  assert.deepEqual([afterSetup[0][3].width, afterSetup[0][3].height], [1280, 720]);
  assert.deepEqual(setup.sources.map((x) => x.done), ['created', 'created', 'created', 'other_kind']);
  assert.ok(setup.setupAt > 0 && setup.scene === 'Omnilayer');
  assert.deepEqual(setup.layouts, { live: ['4 Players'], profiles: 3 });
  assert.equal(rewrites[0], rp.wireLayouts, 'the layouts were not wired by the rule the tests check');
  assert.equal(first.target, 'Omnilayer');
});

test('the screens get each seat’s invite, and never the OBS side of it', () => {
  const said = JSON.stringify(first);
  for (const s of seatsBefore) {
    assert.ok(!said.includes(s.apiKey), 'the API key went to the screens');
    assert.ok(said.includes(rp.inviteLink(s)));
  }
  assert.equal(first.seats[0].source, 'Player 1');
});

test('a new quality points the seat’s source at it; a new name alone does not touch OBS', () => {
  assert.equal(afterQuality.length, 1);
  assert.equal(afterQuality[0][1], 'Player 1');
  assert.deepEqual([afterQuality[0][2].width, afterQuality[0][2].height], [1920, 1080]);
  assert.match(afterQuality[0][2].url, /&videobitrate=12000#/);
  assert.equal(nameOnly.length, 0);
});

test('swapping moves the people and their links, and each source follows', () => {
  const [one, two] = swapped.seats;
  assert.equal(one.name, 'Bo');
  assert.equal(two.name, 'Ana');
  assert.equal(two.discordId, '700000000000000001');
  assert.equal(two.quality, '1080p60', 'the quality stayed behind');
  assert.equal(one.invite, rp.inviteLink({ ...seatsBefore[1], name: 'Bo' }), 'Bo’s link did not move with Bo');
  assert.deepEqual(afterSwap.map((c) => c[1]).sort(), ['Player 1', 'Player 2']);
  // The pages in OBS stay with their seats.
  const keys = store.get().seats.map((s) => s.apiKey);
  assert.deepEqual(keys, seatsBefore.map((s) => s.apiKey));
});

test('kicking empties the seat and gives it a new link, so the old one stops working', () => {
  assert.equal(afterKick.name, '');
  assert.equal(afterKick.discordId, '');
  assert.notEqual(afterKick.streamId, beforeKick.streamId);
  assert.notEqual(afterKick.password, beforeKick.password);
  assert.equal(afterKick.apiKey, beforeKick.apiKey);
  assert.equal(kickCalls.length, 1);
  assert.equal(kickCalls[0][2].url, rp.viewLink(afterKick));
});

test('the director mutes and reloads a seat in OBS', () => {
  assert.deepEqual(directorCalls, [['mute', 'Player 1', true], ['reload', 'Player 4']]);
});

test('an invite goes by direct message with the link as a button; a test goes to the test channel', () => {
  assert.equal(noDiscord, 'remote_no_discord');
  assert.equal(closed, 'remote_dm_closed');
  assert.equal(nowhere, 'remote_dm_closed', 'a direct message that went nowhere was called sent');
  assert.equal(unknown, 'remote_unknown_op');
  const [open, send, test] = dms;
  assert.deepEqual(open, ['open', '700000000000000001']);
  assert.equal(send[1], 'dm-700000000000000001');
  assert.match(send[2], /Rowan/);
  assert.match(send[2], /Player 2/);
  const button = send[3][0].components[0];
  assert.equal(button.style, 5);
  assert.equal(button.url, swapped.seats[1].invite);
  assert.equal(test[1], '1199000000000000006');
  assert.match(test[2], /prueba/);
});

test('each seat’s page is asked how it is, and the screens told only when that changes', () => {
  assert.deepEqual(states, ['live', 'off', 'waiting', 'unknown']);
  assert.deepEqual(mutedNow, [false, true, false, false]);
  assert.equal(asked.length >= 4, true);
  assert.ok(asked.every((u) => /^https:\/\/api\.vdo\.ninja\/[A-Za-z0-9]+\/getDetails$/.test(u)), asked[0]);
  assert.equal(toldOnce, 1);
  assert.equal(toldAgain, 0, 'the screens were told the same thing again');
  // With OBS gone, the pages are not running anywhere to ask.
  assert.deepEqual(offStates, ['unknown', 'unknown', 'unknown', 'unknown']);
  assert.equal(askedWhileOff, 16);
  assert.equal(afterOneMiss, 'waiting', 'one missed answer turned the seat red');
  assert.equal(afterTwoMisses, 'off');
});

// Through the engine: the live layouts, through the same save the editor uses.
const layoutsDb = (await import('../../core/store.js')).collection('layouts', []);
const liveBefore = layoutsDb.get();
engine.store.setLayouts([...liveBefore.filter((l) => l.id !== FOUR.id), FOUR]);
// A saved overlay profile holding it too, not the one on: the seats have to reach it as well.
engine.store.profileDuplicate('overlays', 'Remotos B');
const overlays = () => profiles.summary().find((g) => g.id === 'overlays');
const dupId = overlays().profiles.find((p) => p.name === 'Remotos B').id;
const dirtyBefore = overlays().dirty;
const rewired = engine.store.rewriteLayouts(rp.wireLayouts);
const dirtyAfter = overlays().dirty;
const savedWired = profiles.savedData('overlays', 'layouts').flat().filter((l) => l?.id === FOUR.id).map((l) => l.layers.filter((y) => y.type === 'source').map((y) => y.config.source).sort().join(','));
const liveWired = layoutsDb.get().find((l) => l.id === FOUR.id);
const rewiredAgain = engine.store.rewriteLayouts(rp.wireLayouts);
engine.store.profileDelete('overlays', dupId);
engine.store.setLayouts(liveBefore);

test('the engine wires the live layouts through their usual save, and only once', () => {
  assert.deepEqual(rewired.live, ['4 Players']);
  assert.equal(typeof rewired.profiles, 'number');
  assert.deepEqual(liveWired.layers.filter((l) => l.type === 'source').map((l) => l.config.source).sort(), ['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  assert.deepEqual(liveWired.layers.filter((l) => l.type === 'nameplate').map((l) => l.config.source), ['player1', 'player4', 'manual']);
  assert.deepEqual(rewiredAgain, { live: [], profiles: 0 }, 'wiring twice changed something');
  assert.ok(rewired.profiles >= 1, 'no saved profile was wired');
  assert.ok(savedWired.length >= 1 && savedWired.every((x) => x === 'Player 1,Player 2,Player 3,Player 4'), JSON.stringify(savedWired));
  assert.equal(dirtyAfter, dirtyBefore, 'wiring the seats gave the profile unsaved changes');
});

test('the streamer’s own seat shows their capture in OBS, wears their name, and moves with them', () => {
  assert.deepEqual(meNow.me, { seat: 3, source: 'Screen Capture' });
  assert.equal(meNow.seats[2].me, true);
  assert.equal(meNow.seats[2].status.state, 'me');
  assert.equal(meNow.seats[2].name, 'Rowan', 'their seat did not take their name');
  assert.equal(aliasMine, 'Screen Capture');
  assert.equal(aliasOther, 'Player 2');
  assert.equal(aliasNotSeat, 'Screen Capture');
  assert.ok(refreshedOnTake >= 1, 'OBS was not told to place the layout again');
  assert.equal(askedForMe, 0, 'VDO.Ninja was asked about the streamer’s own seat');
  assert.equal(myState, 'me');
  assert.equal(meAfterSwap, 1);
  assert.deepEqual(aliasAfterSwap, ['Screen Capture', 'Player 3']);
  assert.deepEqual(meAfterKick, { seat: 0, source: 'Screen Capture' }, 'the capture chosen was forgotten');
  assert.equal(aliasAfterKick, 'Player 1');
  assert.equal(aliasNoSource, 'Player 2');
  // Leaving hands the capture back to be hidden, so it is not left showing where the seat was.
  assert.deepEqual(releasedOnLeave, ['Cam']);
  assert.ok(released.includes('Screen Capture'), 'the kick left the capture where the seat was');
});

test('Omnilayer places the stand-in for a seat and hides what it stands in for', () => {
  const four = { id: 'f', name: 'F', width: 1920, height: 1080, layers: [slot(24, 24, 'Player 1'), slot(784, 24, 'Player 2')] };
  const game = { id: 'g', name: 'G', width: 1920, height: 1080, layers: [{ ...slot(0, 0, 'Screen Capture'), width: 1920, height: 1080 }] };
  const alias = (name) => (name === 'Player 1' ? 'Screen Capture' : name);
  const { place, hide } = omni.placements(four, [four, game], null, alias);
  assert.deepEqual(place.map((x) => x.source), ['Screen Capture', 'Player 2']);
  assert.deepEqual([place[0].x, place[0].y, place[0].width], [24, 24, 736]);
  assert.deepEqual(hide, ['Player 1'], 'the seat’s own browser source was left showing under the capture');
  // Without the stand-in, as before: the capture is hidden on this layout.
  assert.deepEqual(omni.placements(four, [four, game], null).hide, ['Screen Capture']);
  // Back on the game layout, the seat's browser source is hidden either way.
  assert.deepEqual(omni.placements(game, [four, game], null, alias).hide.sort(), ['Player 1', 'Player 2']);
});

// ------------------------------------------------------------ wiring

test('the screen, the menu, the server and the canvas all know about remote players', () => {
  const boot = read('../index.js');
  assert.ok(boot.includes('initRemotePlayers({'), 'the server never starts it');
  assert.ok(boot.includes('engineModule.store.rewriteLayouts(change)'));
  const ws = read('../api/ws.js');
  assert.ok(ws.includes('case C2S.REMOTE_PLAYERS:') && ws.includes('...remotePlayers.snapshot(),'));
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("{ view: 'remote-players'") && app.includes("{view === 'remote-players' && ("));
  const hook = read('../../web/hooks/useStreamSystem.ts');
  assert.ok(hook.includes('remotePlayers: (snapshot as any).remotePlayers,') && hook.includes('request(C2S.REMOTE_PLAYERS'));
  const constants = read('../../web/constants.ts');
  const both = (key) => constants.split(`    ${key}: '`).length - 1 === 2;
  const view = read('../../web/components/views/RemotePlayersView.tsx');
  const keys = [...new Set([...view.matchAll(/\bt\.(remote[A-Za-z0-9]+)/g)].map((m) => m[1]))];
  assert.ok(keys.length > 30, `only ${keys.length} strings`);
  for (const key of [...keys, 'remotePlayersNav', 'remoteNavSending', 'plateSourcePlayer']) assert.ok(both(key), `${key} is not in both languages`);
});

// ------------------------------------------------------------ the player on screen

/*
  "Player on screen": a slot that shows whichever seat is on screen — the
  Gameplay layouts' game, full screen — so one command puts any player's game
  up, the streamer's own included. The streamer is back in seat 1.
*/
const { runSteps } = await import('../../engine/steps.js');
const { buildContext } = await import('../../engine/variables.js');
const { ON_SCREEN_SOURCE } = await import('../../../shared/remote-players.js');
await rp.control({ op: 'me', seat: 1, source: 'Screen Capture' });
await rp.control({ op: 'set', n: 2, name: '𝒫𝒾𝓍ℯ𝓁' });
await rp.control({ op: 'set', n: 3, name: 'BENJI' });
await rp.control({ op: 'set', n: 4, name: 'Rocco1999' });
// (An earlier swap moved who was on screen along with the streamer: seat 1 is put up first.)
const screenPushes = [];
const onScreenConfig = ({ key, value }) => { if (key === 'remotePlayers') screenPushes.push(value.onScreen); };
bus.on(EVENTS.CONFIG, onScreenConfig);
rp.putOnScreen(1);
const startsMine = rp.aliasFor(ON_SCREEN_SOURCE);
const screenRefreshes = refreshes;
const screenReleased = released.length;
rp.putOnScreen(1);
const refreshedForSame = refreshes - screenRefreshes;
const shownByName = rp.putOnScreen('benji');
const aliasBenji = rp.aliasFor(ON_SCREEN_SOURCE);
const goneOnSwitch = released.slice(screenReleased);
const onScreenPushed = screenPushes[screenPushes.length - 1];
bus.off(EVENTS.CONFIG, onScreenConfig);
await rp.control({ op: 'swap', a: 3, b: 4 });
const followsSwap = rp.getRemotePlayers().onScreen;
await rp.control({ op: 'swap', a: 3, b: 4 });
let noSuchSeat = null;
try { await rp.control({ op: 'onscreen', n: 9 }); } catch (err) { noSuchSeat = err.code; }
await rp.control({ op: 'onscreen', n: 2 });
const byScreen = rp.getRemotePlayers().onScreen;

// The step: seat 4 from a deck press while 4 Players is up goes live with Gameplay; a viewer's "!ver benji" from BRB only changes whose game.
const stepCalls = [];
let showingPlayers = true;
const stepServices = {
  remotePlayers: { putOnScreen: (w) => rp.putOnScreen(w), liveShowsPlayers: () => showingPlayers },
  omnilayer: { goLiveType: async (type, opts) => { stepCalls.push([type, opts.transition]); } },
};
const viewerSaid = (input) => buildContext({ user: { name: 'viewer' }, message: `!ver ${input}`, args: input });
await runSteps([{ id: 'p4', type: 'remote_on_screen', config: { player: '4', sceneType: 'st-gameplay' } }], viewerSaid(''), stepServices);
const afterDeck = [rp.getRemotePlayers().onScreen, stepCalls.length];
showingPlayers = false;
await runSteps([{ id: 'pv', type: 'remote_on_screen', config: { player: '{input}', sceneType: 'st-gameplay' } }], viewerSaid('benji'), stepServices);
const afterViewerFromBrb = [rp.getRemotePlayers().onScreen, stepCalls.length];
await runSteps([{ id: 'pa', type: 'remote_on_screen', config: { player: '{input}', sceneType: 'st-gameplay', anyLayout: true } }], viewerSaid('j2'), stepServices);
const afterAnyLayout = [rp.getRemotePlayers().onScreen, stepCalls.length];
await runSteps([{ id: 'px', type: 'remote_on_screen', config: { player: '{input}', sceneType: 'st-gameplay', anyLayout: true } }], viewerSaid('nadie'), stepServices);
const afterNonsense = [rp.getRemotePlayers().onScreen, stepCalls.length];

test('a slot can show whichever seat is on screen, and one command puts any of them there', () => {
  assert.equal(rp.cleanRemotePlayers({}).onScreen, 1);
  assert.equal(rp.cleanRemotePlayers({ onScreen: 9 }).onScreen, 1);
  assert.equal(rp.cleanRemotePlayers({ onScreen: 3 }).onScreen, 3);
  // Seat 1 is the streamer's: on screen, the slot shows their capture.
  assert.equal(startsMine, 'Screen Capture');
  assert.equal(refreshedForSame, 0, 'putting up the seat already up placed everything again');
  assert.equal(shownByName, 3);
  assert.equal(aliasBenji, 'Player 3');
  assert.deepEqual(goneOnSwitch, ['Screen Capture'], 'the game that was up was not let go');
  assert.equal(onScreenPushed, 3, 'the screens were not told');
  assert.equal(followsSwap, 4, 'whoever was on screen did not stay on screen through a swap');
  assert.equal(noSuchSeat, 'remote_no_seat');
  assert.equal(byScreen, 2);
  // Every source the stand-in can be, so the one not shown is hidden; never the stand-in itself.
  assert.deepEqual(rp.everyAliasOf(ON_SCREEN_SOURCE).sort(), ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Screen Capture']);
  assert.deepEqual(rp.everyAliasOf('Player 3'), ['Player 3']);
  assert.ok(rp.isPlayerSource(ON_SCREEN_SOURCE) && rp.isPlayerSource('Player 2') && !rp.isPlayerSource('Screen Capture'));
});

test('what people type for a seat: its number, "yo", or who is in it, fancy letters too', () => {
  for (const [said, n] of [['2', 2], ['j2', 2], ['Player 2', 2], ['player 4', 4], ['#3', 3], ['!p1', 1], ['yo', 1], ['benji', 3], ['BENJI', 3], ['pixel', 2], ['pixe', 2], ['Rocco', 4], ['rocco1999', 4]]) {
    assert.equal(rp.seatFromWords(said), n, `"${said}"`);
  }
  for (const said of ['', '9', 'j0', 'nadie', 'sa', 's']) assert.equal(rp.seatFromWords(said), 0, `"${said}" named a seat`);
});

test('Omnilayer places the seat on screen full screen and hides every other seat, never looking for the stand-in in OBS', () => {
  const ingame = { id: 'ig', width: 1920, height: 1080, layers: [{ type: 'source', x: 0, y: 0, width: 1920, height: 1080, config: { source: ON_SCREEN_SOURCE } }] };
  const four = { id: 'four', width: 1920, height: 1080, layers: [1, 2, 3, 4].map((n) => ({ type: 'source', x: 0, y: 0, width: 960, height: 540, config: { source: `Player ${n}` } })) };
  // Only the Gameplay layout in this profile: the other seats are still hidden.
  const alone = omni.placements(ingame, [ingame], null, rp.aliasFor, rp.everyAliasOf);
  assert.deepEqual(alone.place.map((p) => [p.source, p.width, p.height]), [['Player 2', 1920, 1080]]);
  assert.deepEqual(alone.hide.sort(), ['Player 1', 'Player 3', 'Player 4', 'Screen Capture']);
  assert.ok(!omni.managedSources([ingame, four], rp.aliasFor, rp.everyAliasOf).includes(ON_SCREEN_SOURCE));
  // Seat 1 up: the streamer's capture, and seat 1's own browser source hidden under it.
  rp.putOnScreen(1);
  const mine = omni.placements(ingame, [ingame, four], null, rp.aliasFor, rp.everyAliasOf);
  assert.deepEqual(mine.place.map((p) => p.source), ['Screen Capture']);
  assert.ok(mine.hide.includes('Player 1') && !mine.hide.includes('Screen Capture'));
  rp.putOnScreen(2);
  const boot = read('../index.js');
  assert.ok(boot.includes('omnilayer.setSourceAlias(aliasFor, everyAliasOf);'), 'Omnilayer does not know the stand-in');
});

test('the step: from a layout showing the players it goes live with Gameplay; a viewer from BRB only changes whose game', () => {
  assert.deepEqual(afterDeck, [4, 1]);
  assert.deepEqual(stepCalls[0], ['st-gameplay', ''], 'it did not go live with the type');
  assert.deepEqual(afterViewerFromBrb, [3, 1], 'a viewer took the stream off a layout without the players');
  assert.deepEqual(afterAnyLayout, [2, 2]);
  assert.deepEqual(afterNonsense, [2, 2], 'words that name no seat did something');
  const engineSrc = read('../engine/index.js');
  assert.ok(engineSrc.includes('remotePlayers.isPlayerSource(y.config?.source)') && engineSrc.includes('omnilayer.onAir()'), 'the step cannot tell which layout is on stream');
  assert.ok(read('../engine/omnilayer.js').includes('if (s.scene && now && now !== s.scene) return null;'), 'a layout counts as on stream while OBS is on another scene');
});

test('the step, the slot choice and the seat buttons are on the screens, in both languages', () => {
  const actions = read('../../web/components/views/ActionsView.tsx');
  assert.ok(actions.includes("{ type: 'remote_on_screen', key: 'onScreenStep'") && actions.includes("run?.kind === 'remote-on-screen'"));
  assert.ok(read('../../web/App.tsx').includes("remote_on_screen: { player: '1', sceneType: '' },"));
  assert.ok(read('../../web/types.ts').includes("| 'remote_on_screen'"));
  const slot = read('../../web/components/SourceLayerPanel.tsx');
  assert.ok(slot.includes('<option value={ON_SCREEN_SOURCE}>'), 'a slot cannot be the player on screen');
  const omniPanel = read('../../web/components/OmnilayerPanel.tsx');
  assert.equal(omniPanel.split('y.config.source !== ON_SCREEN_SOURCE').length - 1, 2, 'the Omnilayer card looks for the stand-in in OBS');
  const view = read('../../web/components/views/RemotePlayersView.tsx');
  assert.ok(view.includes("run(key('screen'), 'onscreen', { n: s.n })"));
  const constants = read('../../web/constants.ts');
  for (const key of ['onScreenStep', 'onScreenStepWho', 'onScreenStepInput', 'onScreenStepThen', 'onScreenStepStay', 'onScreenStepAny', 'onScreenStepHint', 'sourceSlotOnScreen', 'sourceSlotOnScreenHint', 'remoteOnScreenHint', 'remoteOnScreenNow', 'remoteOnScreenPut']) {
    assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
});
