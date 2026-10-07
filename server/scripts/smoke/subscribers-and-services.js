/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The subscriber ledger, the phone camera step, and the real services the steps call.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, SCRIPT_URL, assert, bus, chat, droidcamCalls, engine, fs, normaliseChat, normaliseEvent, obsCalls, said, settle, test } from './harness.js';

// ------------------------------------------------- the subscriber ledger
//
// Twitch answers "who is subscribed" and "for how long" from different places,
// and never both at once: Get Broadcaster Subscriptions is authoritative about
// membership but carries no tenure, while the exact month count only ever rides
// past on a chat message's badge-info tag. So the ledger accumulates.

const subs = await import('../../engine/subscribers.js');
subs.initSubscribers();

/** A chat message the way tmi.js delivers one, badge-info included. */
const subChat = (user, months) => bus.emit(EVENTS.CHAT, normaliseChat({
  platform: 'twitch', user, msg: 'hi', isSub: true,
  raw: { 'badge-info': { subscriber: String(months) } },
}));

bus.emit(EVENTS.SUBSCRIBER_LIST, [
  { user_name: 'Ana', tier: '1000' },
  { user_name: 'Beto', tier: '3000' },
  { user_name: 'Caro', tier: '1000' },
  { user_name: 'Silent', tier: '1000' },
]);
await settle();

test('a subscriber who has never spoken is not ranked', () => {
  const top = subs.topSubscribers();
  assert.deepEqual(top, [], 'ranked someone whose tenure is unknown');
});

subChat('Ana', 12);
subChat('Beto', 40);
subChat('Caro', 3);
await settle();

test('months are learned from the chat badge, longest first', () => {
  assert.deepEqual(subs.topSubscribers().map((s) => s.name + ':' + s.months),
    ['Beto:40', 'Ana:12', 'Caro:3']);
});

test('the silent subscriber is still absent, not listed at zero', () => {
  assert.ok(!subs.topSubscribers().some((s) => s.name === 'Silent'));
});

test('the count limits how many come back', () => {
  assert.equal(subs.topSubscribers(2).length, 2);
  assert.equal(subs.topSubscribers(2)[0].name, 'Beto');
});

// A late or replayed message must not walk a tenure backwards.
subChat('Beto', 2);
await settle();
test('months never decrease', () => {
  assert.equal(subs.topSubscribers().find((s) => s.name === 'Beto').months, 40);
});

// Someone dropping off the authoritative list has lapsed.
bus.emit(EVENTS.SUBSCRIBER_LIST, [
  { user_name: 'Ana', tier: '1000' },
  { user_name: 'Caro', tier: '1000' },
]);
await settle();

test('a lapsed subscriber drops out of the ranking', () => {
  assert.deepEqual(subs.topSubscribers().map((s) => s.name), ['Ana', 'Caro']);
});

// Coming back: the ledger kept the months while they were away.
subChat('Beto', 41);
await settle();
test('resubscribing restores them at their real tenure, not at one', () => {
  const beto = subs.topSubscribers().find((s) => s.name === 'Beto');
  assert.ok(beto, 'did not come back');
  assert.equal(beto.months, 41);
});

test('a non-subscriber chatting is ignored', () => {
  bus.emit(EVENTS.CHAT, normaliseChat({ platform: 'twitch', user: 'Rando', msg: 'hi', isSub: false, raw: { 'badge-info': { subscriber: '99' } } }));
  assert.ok(!subs.topSubscribers().some((s) => s.name === 'Rando'));
});

// The main history ring is shared with everything on the bus, and Spotify
// alone floods it: on the real channel it was 96 of 100 entries, so every
// follow and cheer had already been evicted. Viewer events get their own.
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'twitch_follow', platform: 'twitch', user: 'Ana', data: {} }));
bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'twitch_cheer', platform: 'twitch', user: 'Beto', data: { bits: 500 } }));
for (let i = 0; i < 150; i++) {
  bus.emit(EVENTS.EVENT, normaliseEvent({ type: 'spotify_track_change', platform: 'spotify', user: 'Artist', data: { title: 'Song ' + i } }));
}
await settle();

test('a flood of track changes evicts everything from the main ring', () => {
  const main = engine.snapshot().eventHistory;
  assert.ok(!main.some((e) => e.type === 'twitch_follow'), 'the main ring somehow kept the follow');
});

test('but the viewer ring still has them', () => {
  const viewer = engine.snapshot().viewerEvents;
  // The head of the ring, not the whole thing: earlier tests in this file
  // put their own viewer events in, and they legitimately remain.
  assert.deepEqual(viewer.slice(0, 2).map((e) => e.user), ['Beto', 'Ana'], 'newest first');
});

test('the viewer ring holds only viewer actions', () => {
  const viewer = engine.snapshot().viewerEvents;
  assert.ok(!viewer.some((e) => e.type === 'spotify_track_change'));
});

test('clearing the log empties both rings', () => {
  engine.store.clearHistory();
  assert.deepEqual(engine.snapshot().eventHistory, []);
  assert.deepEqual(engine.snapshot().viewerEvents, []);
});

test('the viewer counter config is validated and stored', () => {
  const saved = engine.store.setViewers({
    mode: 'platforms', showIcon: false, showOffline: true,
    platforms: { twitch: true, tiktok: false },
    style: { fontSize: 40, color: '#00ff00', background: '#112233', transparent: false },
  });
  assert.equal(saved.mode, 'platforms');
  assert.equal(saved.showIcon, false);
  assert.equal(saved.showOffline, true);
  assert.equal(saved.platforms.tiktok, false);
  assert.equal(saved.style.fontSize, 40);
  assert.equal(saved.style.color, '#00ff00');
  assert.equal(saved.style.transparent, false);
});

test('an unknown mode falls back to the total rather than rendering nothing', () => {
  assert.equal(engine.store.setViewers({ mode: 'interpretive dance' }).mode, 'total');
});

test('junk styling is refused, not interpolated onto the stream', () => {
  const saved = engine.store.setViewers({
    style: { fontSize: 'huge', color: 'red; background: url(evil)', background: 'javascript:alert(1)' },
  });
  assert.equal(saved.style.fontSize, 28);
  // What is not a colour is left automatic: the look's, or the counter's own.
  assert.equal(saved.style.color, '');
  assert.equal(saved.style.background, '');
});

test('an out-of-range font size is clamped', () => {
  assert.equal(engine.store.setViewers({ style: { fontSize: 9999 } }).style.fontSize, 120);
  assert.equal(engine.store.setViewers({ style: { fontSize: 1 } }).style.fontSize, 10);
});

test('the omnibar accepts a recentEvents slot', () => {
  const saved = engine.store.setOmnibar({
    enabled: true, defaultSeconds: 10,
    items: [{ id: 'o-e', type: 'recentEvents', enabled: true, name: '', label: '', text: '', seconds: null, topCount: 4 }],
  });
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].type, 'recentEvents');
  assert.equal(saved.items[0].topCount, 4);
});

test('the omnibar accepts a topSubscribers slot', () => {
  const saved = engine.store.setOmnibar({
    enabled: true, defaultSeconds: 10,
    items: [{ id: 'o-s', type: 'topSubscribers', enabled: true, name: '', label: '', text: '', seconds: null, topCount: 5 }],
  });
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].topCount, 5);
});

// ------------------------------------------------ the phone camera step
//
// The value is interpolated like every other step, which is what lets a viewer
// drive it: "!zoom 3.5" reaching a step configured with {input}.

engine.store.saveCommand({
  id: 'cmd-zoom', name: 'Zoom', triggers: ['!zoom'], enabled: true,
  permissions: { anyone: true }, globalCooldown: 0, userCooldown: 0,
});
engine.store.saveAction({
  id: 'act-zoom', name: 'Viewer zoom', enabled: true,
  trigger: { id: 't-z', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-zoom' } },
  actions: [
    { id: 's-z', type: 'droidcam_control', config: { droidcamOperation: 'zoom', droidcamValue: '{input}' } },
    { id: 's-z2', type: 'twitch_chat', config: { message: 'zoomed' } },
  ],
});

droidcamCalls.length = 0;
said.length = 0;
chat('!zoom 3.5');
await settle();

test('a viewer can drive the camera through a command', () => {
  assert.deepEqual(droidcamCalls, [{ op: 'zoom', value: '3.5' }]);
});

test('the fraction survives interpolation', () => {
  assert.equal(droidcamCalls[0].value, '3.5', 'a rounded value would be a different shot');
});

test('the rest of the action still runs after the camera step', () => {
  assert.deepEqual(said, ['zoomed']);
});

// The editor's dropdown shows 'Toggle flash' for an empty config, so a step
// added and left alone stored no operation at all and did nothing.
engine.store.saveAction({
  id: 'act-flash', name: 'Flash', enabled: true,
  trigger: { id: 't-fl', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [{ id: 's-fl', type: 'droidcam_control', config: {} }],
});

test('a camera step saved with no operation is healed to what the editor showed', () => {
  const saved = engine.snapshot().streamActions.find((a) => a.id === 'act-flash');
  assert.equal(saved.actions[0].config.droidcamOperation, 'torch');
});

droidcamCalls.length = 0;
await engine.testAction('act-flash');
test('and it then actually reaches the camera', () => {
  assert.deepEqual(droidcamCalls, [{ op: 'torch', value: '' }]);
});

// A phone asleep or off the network must not abort what follows it.
engine.store.saveAction({
  id: 'act-cam-fail', name: 'Camera then chat', enabled: true,
  trigger: { id: 't-cf', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [
    { id: 's-cf1', type: 'droidcam_control', config: { droidcamOperation: 'explode' } },
    { id: 's-cf2', type: 'twitch_chat', config: { message: 'still ran' } },
  ],
});
said.length = 0;
await engine.testAction('act-cam-fail');

test('an unreachable camera does not abort the rest of the action', () => {
  assert.deepEqual(said, ['still ran']);
});

/*
  The OBS on/off steps the other way round: their editors light Enable, Show
  and Mute for a step that stored no choice, and the step read the missing
  value as false. The phone's "Blur" action — one filter step, left on the
  Enable it showed — turned the filter off every time.
*/
engine.store.saveAction({
  id: 'act-blur', name: 'Blur', enabled: true,
  trigger: { id: 't-blur', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [
    { id: 's-blur', type: 'obs_filter_toggle', config: { sourceName: 'Screen Capture', filterName: 'Blur' } },
    { id: 's-unblur', type: 'obs_filter_toggle', config: { sourceName: 'Screen Capture', filterName: 'Blur', filterEnabled: false } },
    { id: 's-show', type: 'obs_visibility', config: { sceneName: 'Main', sourceName: 'Cam' } },
    { id: 's-mute', type: 'obs_set_mute', config: { sourceName: 'Mic' } },
  ],
});
const healedBlur = engine.snapshot().streamActions.find((a) => a.id === 'act-blur');
obsCalls.length = 0;
await engine.testAction('act-blur');
const blurCalls = obsCalls.filter((c) => ['filter', 'visible', 'mute'].includes(c[0]));

test('an OBS on/off step saved with no choice is healed to what the editor showed', () => {
  const [blur, unblur, show, mute] = healedBlur.actions.map((s) => s.config);
  assert.equal(blur.filterEnabled, true, 'a filter step left on Enable is saved as off');
  assert.equal(unblur.filterEnabled, false, 'a step set to Disable was changed');
  assert.equal(show.visible, true);
  assert.equal(mute.muted, true);
});

test('and it does what the editor showed', () => {
  assert.deepEqual(blurCalls, [
    ['filter', 'Screen Capture', 'Blur', true],
    ['filter', 'Screen Capture', 'Blur', false],
    ['visible', 'Main', 'Cam', true],
    ['mute', 'Mic', true],
  ]);
  // Read the same way where nothing was healed — a step run straight from a payload.
  const steps = fs.readFileSync(new URL('../engine/steps.js', SCRIPT_URL), 'utf8');
  for (const read of ['cfg.filterEnabled !== false', 'cfg.visible !== false', 'cfg.muted !== false']) {
    assert.ok(steps.includes(read), `a step reads a missing choice as off again: ${read}`);
  }
});

/*
  And each can toggle: on if it is off and off if it is on, so one !blur
  blurs and unblurs. Asked of OBS at the time, not remembered here.
*/
engine.store.saveAction({
  id: 'act-blur-toggle', name: 'Blur toggle', enabled: true,
  trigger: { id: 't-bt', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [
    { id: 's-bt', type: 'obs_filter_toggle', config: { sourceName: 'Screen Capture', filterName: 'Blur', filterEnabled: 'toggle' } },
    { id: 's-vt', type: 'obs_visibility', config: { sourceName: 'Cam', visible: 'toggle' } },
    { id: 's-mt', type: 'obs_set_mute', config: { sourceName: 'Mic', muted: 'toggle' } },
  ],
});
const savedToggle = engine.snapshot().streamActions.find((a) => a.id === 'act-blur-toggle');
obsCalls.length = 0;
await engine.testAction('act-blur-toggle');
const toggleCalls = obsCalls.filter((c) => ['filter', 'visible', 'mute'].includes(c[0]));

test('an OBS on/off step can toggle, and saving keeps it a toggle', () => {
  assert.deepEqual(savedToggle.actions.map((s) => s.config.filterEnabled ?? s.config.visible ?? s.config.muted), ['toggle', 'toggle', 'toggle'],
    'a toggle was healed into an Enable');
  // The Show/Hide step with no scene named goes to the scene on air.
  assert.deepEqual(toggleCalls, [
    ['filter', 'Screen Capture', 'Blur', 'toggle'],
    ['visible', undefined, 'Cam', 'toggle'],
    ['mute', 'Mic', 'toggle'],
  ]);
});

test('a toggle asks OBS where it is before flipping it, and a Show/Hide step finds its scene', () => {
  const obs = fs.readFileSync(new URL('../platforms/obs.js', SCRIPT_URL), 'utf8');
  const filter = obs.slice(obs.indexOf('export async function toggleFilter'), obs.indexOf('export async function toggleMuted'));
  assert.ok(filter.indexOf("'GetSourceFilter'") > 0 && filter.indexOf("'GetSourceFilter'") < filter.indexOf("'SetSourceFilterEnabled'") && filter.includes('filterEnabled: !filterEnabled'), 'the filter is flipped without asking what it is');
  const shown = obs.slice(obs.indexOf('export async function toggleSourceVisible'), obs.indexOf('export async function toggleFilter'));
  assert.ok(shown.includes("'GetSceneItemEnabled'") && shown.includes('sceneItemEnabled: !sceneItemEnabled'), 'the source is flipped without asking what it is');
  assert.ok(obs.includes("ensure().call('ToggleInputMute'"), 'the mute is not OBS\'s own toggle');
  assert.ok(obs.includes('async function sceneOrOnAir(sceneName)') && obs.split('await sceneOrOnAir(sceneName)').length - 1 === 2, 'a Show/Hide step with no scene still asks OBS for a scene called nothing');
  // The editor offers the third choice on all three, and the scene the Show/Hide step never had.
  const editor = fs.readFileSync(new URL('../../web/components/views/ActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.equal(editor.split('<OnOffChoice value={step.config.').length - 1, 3, 'not every on/off step can toggle');
  assert.ok(editor.includes('data-obs-step-scene') && editor.includes("t.obsSceneOnAir || 'The scene on air'"), 'the Show/Hide step has no scene to pick');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['obsToggle', 'obsToggleHint', 'obsSceneOnAir', 'obsStepSource', 'obsPickSource', 'obsFilterName', 'obsFilterExample', 'obsEnable', 'obsDisable', 'obsMute', 'obsUnmute']) {
    assert.equal(strings.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
});

// ------------------------------------------------- real service contracts
//
// Everything above this point runs against the stand-ins wired into
// initEngine() at the top of this file. That is what let {spotify.track} ship
// broken: the stand-in had getNowPlaying, the real module's exported `service`
// object did not, so the engine's call returned undefined, nowPlaying fell back
// to null, and every template rendered an empty string. Tests green, feature
// dead, no error anywhere.
//
// So: import what the real app actually passes to initEngine, and check it has
// what the engine actually calls on it.

const realServices = {
  twitch: (await import('../../platforms/twitch.js')).service,
  obs: (await import('../../platforms/obs.js')).service,
  discord: (await import('../../platforms/discord.js')).service,
  spotify: (await import('../../platforms/spotify.js')).service,
  tts: (await import('../../platforms/tts.js')).service,
};

/** Method names the engine calls on each service. Grep-derived, not guessed. */
/**
 * Method names the engine calls on each service, read out of the engine source
 * rather than listed by hand.
 *
 * A hand-written list missed `settleAfterSkip` — the call is written
 * `spotify.settleAfterSkip?.()` and the eye slid past it — so a skip announced
 * the song it had just skipped. Deriving it means adding a call to the engine
 * is enough to make this test demand the method, with nothing to remember.
 *
 * The trailing `(` matters: it keeps property reads such as
 * `ctx.spotify.queuedTrack` out of the list.
 */
const engineSources = ['../engine/index.js', '../engine/steps.js', '../engine/alerts.js']
  .map((rel) => fs.readFileSync(new URL(rel, SCRIPT_URL), 'utf8'))
  .join('\n');

const REQUIRED = {};
for (const m of engineSources.matchAll(/\b(twitch|obs|discord|spotify|tts)\??\.([a-zA-Z]+)(?:\?\.)?\(/g)) {
  (REQUIRED[m[1]] ||= new Set()).add(m[2]);
}
for (const k of Object.keys(REQUIRED)) REQUIRED[k] = [...REQUIRED[k]].sort();

test('the engine-call scan found something to check', () => {
  const total = Object.values(REQUIRED).reduce((n, v) => n + v.length, 0);
  assert.ok(total >= 15, `only found ${total} service calls — the scan pattern is probably broken`);
  assert.ok(REQUIRED.spotify?.includes('settleAfterSkip'), 'scan missed a known optional call');
});

for (const [name, methods] of Object.entries(REQUIRED)) {
  test(`the real ${name} service exposes everything the engine calls`, () => {
    const svc = realServices[name];
    assert.ok(svc, `platforms/${name}.js exports no \`service\``);
    const missing = methods.filter((m) => typeof svc[m] !== 'function');
    assert.deepEqual(missing, [], `services.${name} is missing: ${missing.join(', ')}`);
  });
}

// The symptom, stated as a test: a track fills the template, nothing playing
// leaves it empty. Both go through the same code the engine runs.
const { buildContext, interpolate } = await import('../../engine/variables.js');

test('a playing track fills {spotify.track} and {spotify.artist}', () => {
  const ctx = buildContext({
    nowPlaying: { name: 'Blue Monday', artist: 'New Order', album: 'Power', isPlaying: true },
  });
  assert.equal(interpolate('Ta sonando {spotify.track} de {spotify.artist}', ctx),
    'Ta sonando Blue Monday de New Order');
});

test('nothing playing renders empty, not the placeholder', () => {
  const ctx = buildContext({ nowPlaying: null });
  assert.equal(interpolate('Ta sonando {spotify.track} de {spotify.artist}', ctx),
    'Ta sonando  de ');
});

