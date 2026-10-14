/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The home screen (2.1.0): the layouts each person picks for it, putting
 * one on screen, the stream on now, and what the screen is built from.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const home = await import('../../engine/home.js');
const modDecks = await import('../../engine/mod-decks.js');
const sessions = await import('../../engine/stream-sessions.js');
const read = (rel) => fs.readFileSync(new URL(rel, SCRIPT_URL), 'utf8');

home.initHome();
const before = home.homeLayouts();
const cleaned = home.cleanHomeLayouts(['a', 'a', 7, '', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
home.setHomeLayouts(['ly-1', 'ly-2']);
const streamers = home.homeLayouts();
const MOD = { role: 'mod', userId: 'home-mod', login: 'homemod' };
const modFirst = modDecks.dockFor(MOD.userId).homeLayouts;
modDecks.setFor(MOD, 'homeLayouts', ['ly-3']);
const modThen = modDecks.dockFor(MOD.userId).homeLayouts;
const streamersThen = home.homeLayouts();
modDecks.resetFor(MOD.userId);
home.setHomeLayouts(before);

const refuse = async (p) => { try { await p; return 'went'; } catch (err) { return err.code || err.message; } };
const noLayout = await refuse(home.show('nope', [{ id: 'ly-1', name: 'One', scenes: [] }]));
const noScene = await refuse(home.show('ly-1', [{ id: 'ly-1', name: 'One', scenes: [] }]));

test('the home screen\'s layout buttons: picked, in order, no repeats, at most eight — the streamer\'s, and a moderator\'s own', () => {
  assert.deepEqual(cleaned, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.deepEqual(streamers, ['ly-1', 'ly-2']);
  assert.deepEqual(modFirst, ['ly-1', 'ly-2'], 'a moderator starts with the streamer\'s');
  assert.deepEqual(modThen, ['ly-3']);
  assert.deepEqual(streamersThen, ['ly-1', 'ly-2'], 'and picking theirs leaves the streamer\'s alone');
  assert.ok(modDecks.MOD_OWN.includes('homeLayouts'));
});

test('putting a layout on screen from home: Omnilayer, or else its OBS scene — and says why not', () => {
  assert.equal(noLayout, 'no_layout');
  assert.equal(noScene, 'home_no_scene');
  const src = read('../engine/home.js');
  assert.ok(src.includes('if (omnilayer.getOmnilayer().enabled) return omnilayer.goLive(layout.id);'));
  assert.ok(src.includes('await obs.setScene(scene);'));
});

test('the stream on now is told to every page when it starts, ends or is renamed', () => {
  assert.ok(sessions.streamNow() === null || typeof sessions.streamNow().startedAt === 'number');
  const src = read('../engine/stream-sessions.js');
  assert.ok(src.split('tellStreamNow();').length - 1 >= 4, 'started, carried on, renamed, ended');
  assert.ok(read('../api/ws.js').includes('streamNow: streamSessions.streamNow(),'));
});

test('the home screen: a welcome while setting up, then the stream, what needs you, the latest and the layouts — no pitch', () => {
  const view = read('../../web/components/views/DashboardView.tsx');
  assert.ok(!view.includes('heroTitle') && !view.includes('FloatingCard'), 'the old headline and its decoration are gone');
  assert.ok(view.includes("const settingUp = !isMod && setup && setup.left > 0;"));
  assert.ok(view.includes('liveLayout(layouts,'), 'what is on screen, worked out as the rest of the app does');
  assert.ok(view.includes('describeEvent(e, t)'), 'events in the Events dock\'s own words');
  assert.ok(view.includes("<ChatModes ask={system.actions.twitchMod} t={t} inline />"), 'a moderator\'s tools');
  const app = read('../../web/App.tsx');
  assert.ok(app.includes('connections: system.connections, auth: system.auth }'), 'the sign-in setup step can tick');
});

test('a time the home screen cannot read says nothing, rather than taking the whole page down', () => {
  const view = read('../../web/components/views/DashboardView.tsx');
  assert.ok(view.includes("if (!Number.isFinite(Number(at)) || !Number(at)) return '';"));
});

const guides = await import('../../../shared/guides.js');
const pageStep = guides.SETUP_CHECKS.find((c) => c.id === 'stream-page');
const dockStep = guides.SETUP_CHECKS.find((c) => c.id === 'dock');

test('the OBS setup steps stay done with OBS closed, on every browser: the server remembers seeing the pages in OBS', () => {
  const closed = { data: { surfaces: { canvasInObs: 0, dockInObs: 0, seen: { canvasInObs: 1760000000000, dockInObs: 1760000000000 } } } };
  assert.equal(pageStep.done(closed), true);
  assert.equal(dockStep.done(closed), true);
  assert.equal(pageStep.done({ data: { surfaces: { canvasInObs: 0, seen: {} } } }), false, 'never seen: not done');
  const ws = read('../api/ws.js');
  assert.ok(ws.includes("collection('surfaces_seen', {})") && ws.includes('return { ...counts, seen: rememberSeen(counts) };'));
  assert.ok(!read('../../web/components/views/DashboardView.tsx').includes('SpotifyPlayer'), 'no Spotify player on the home screen');
});

test('the live view can be previewed while offline, one person\'s choice, and a stream shows it anyway', () => {
  const view = read('../../web/components/views/DashboardView.tsx');
  assert.ok(view.includes('const showLive = Boolean(stream) || preview;'));
  assert.ok(view.includes("localStorage.getItem('home_live_preview') === 'on'"));
  assert.ok(view.includes('{showLive ? ('), 'the numbers follow the preview');
  assert.ok(view.includes('{!stream && ('), 'the switch only while nothing is on');
});
