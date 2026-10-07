/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Twitch extras — the Hype Train on stream, shoutouts for
 * raiders, clips and stream markers, and "next stream" from the schedule.
 * Twitch itself is a stand-in here, so nothing leaves this machine.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, bus, EVENTS, engine, settle, test } from './harness.js';
import { LAYER_TYPES, normaliseLayouts } from './backup-and-layouts.js';

const x = await import('../../engine/twitch-extras.js');
const { fillNext } = await import('../../engine/announce.js');
const { runSteps } = await import('../../engine/steps.js');
const { fillTemplate } = await import('../../../shared/overlay-vars.js');
const { AVATAR_REACTIONS, AVATAR_REACTION_DEFAULTS } = await import('../../../shared/avatar.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

// ---------------------------------------------------------------- a stand-in Twitch

const calls = [];
let live = true;
const fake = {
  getUser: async (login) => (login === 'nadie' ? null : { id: `id-${login}`, login, display_name: login === 'raider' ? 'Raider' : 'Amiga', profile_image_url: 'https://x.test/pic.png' }),
  channelOf: async (id) => ({ game_name: id === 'id-amiga' ? '' : 'Among Us', title: 'Jugando' }),
  sendShoutout: async (id) => { calls.push(['shoutout', id]); if (!live) throw new Error('Twitch Helix 400: The broadcaster is not streaming live'); },
  say: async (text) => { calls.push(['say', text]); },
  createClip: async () => { if (!live) throw new Error('Twitch Helix 404: Clipping is not possible for an offline channel.'); return { id: 'Clip1', url: 'https://clips.twitch.tv/Clip1' }; },
  createMarker: async (d) => { if (!live) throw new Error('Twitch Helix 404: stream is offline'); return { id: 'm1', at: 125, description: d }; },
  fetchSchedule: async () => [],
  tokenScopes: async () => ['chat:read', 'clips:edit'],
};
x.useTwitchForTests(fake);
x.resetForTests();

const cards = [];
const trains = [];
const onConfig = (c) => { if (c.key === 'shoutoutCard' && c.value) cards.push(c.value); if (c.key === 'hypeTrain') trains.push(c.value); };
bus.on(EVENTS.CONFIG, onConfig);

// ---------------------------------------------------------------- settings and words

test('the Twitch extras keep sensible settings, and a login out of whatever was typed', () => {
  const wild = x.cleanExtras({ shoutout: { minViewers: -3, cardSeconds: 999, onRaid: 'no', message: 'hola' }, clip: { chat: false } });
  assert.equal(wild.shoutout.minViewers, 0);
  assert.equal(wild.shoutout.cardSeconds, 60);
  assert.equal(wild.shoutout.onRaid, true, 'only false turns it off');
  assert.equal(wild.clip.chat, false);
  assert.equal(x.loginOf('@Amiga_99 gracias'), 'amiga_99');
  assert.equal(x.loginOf('https://twitch.tv/Foo_Bar'), 'foo_bar');
  assert.equal(x.loginOf('   '), '');
  // It travels in a backup, and the dashboard reaches it.
  assert.ok(read('../engine/backup.js').includes("{ name: 'twitch_extras' }"));
  assert.ok(read('../api/ws.js').includes('engine.store.twitchExtras(payload)'));
});

// ---------------------------------------------------------------- the Hype Train

x.onHypeTrain({ phase: 'begin', level: 1, progress: 100, goal: 1000, total: 100, expiresAt: 5000 }, 1000);
x.onHypeTrain({ phase: 'progress', level: 1, progress: 600, goal: 1000, total: 600, expiresAt: 6000 }, 2000);
x.onHypeTrain({ phase: 'progress', level: 2, progress: 50, goal: 1200, total: 1050, expiresAt: 7000 }, 3000);
x.onHypeTrain({ phase: 'end', level: 2, progress: 50, goal: 1200, total: 1050 }, 9000);

test('the Hype Train is followed as it runs: when it began, each level up, and when it ended', () => {
  const [begin, progress, up, end] = trains;
  assert.equal(begin.active, true);
  assert.equal(begin.levelUpAt, null);
  assert.equal(progress.levelUpAt, null, 'progress within a level is not a level up');
  assert.equal(up.levelUpAt, 3000);
  assert.equal(up.startedAt, 1000, 'a level up restarted the train');
  assert.equal(end.active, false);
  assert.equal(end.endedAt, 9000);
  const tw = read('../platforms/twitch.js');
  assert.ok(tw.includes("['channel.hype_train.begin', ['2', '1'], null, (e) => hypeTrain('begin', e)]"), 'the train is not subscribed to');
  assert.ok(tw.includes("'channel:read:hype_train'") || read('../../web/hooks/useStreamSystem.ts').includes("'channel:read:hype_train'"), 'the login does not ask to see the train');
  // The avatar cheers it on.
  assert.ok(AVATAR_REACTIONS.includes('hype'));
  assert.equal(AVATAR_REACTION_DEFAULTS.hype, 'star-eyes');
  const layer = read('../../web/components/AvatarLayer.tsx');
  assert.ok(layer.includes('const cheer = useHypeCheer(') && layer.includes('reacted.face || hypeFace || loudFace'), 'the avatar ignores the train');
});

// ---------------------------------------------------------------- shoutouts

calls.length = 0;
const manual = await x.shoutout('@Amiga');
const nobody = await x.shoutout('nadie');
const saidManual = calls.filter(([k]) => k === 'say').map(([, t]) => t);
calls.length = 0;
bus.emit(EVENTS.EVENT, { type: 'twitch_raid', platform: 'twitch', user: 'Raider', data: { viewers: 12, login: 'raider' } });
bus.emit(EVENTS.EVENT, { type: 'twitch_raid', platform: 'twitch', user: 'raider', data: { viewers: 12, login: 'raider' } });
await settle();
await new Promise((r) => setTimeout(r, 50));
const raidCalls = [...calls];
live = false;
const offline = await x.shoutout('amiga');

test('a raider is shouted out once, with Twitch\'s shoutout, a line in chat and the card on stream', () => {
  assert.equal(manual.ok, true);
  assert.equal(nobody.ok, false);
  // No game to name: the part of the line naming it is left out.
  assert.equal(saidManual[0], '¡Gracias por la raid, Amiga! Vayan a seguirle en twitch.tv/amiga.');
  // The raid arrives twice (chat and EventSub); one shoutout.
  assert.deepEqual(raidCalls.filter(([k]) => k === 'shoutout'), [['shoutout', 'id-raider']]);
  assert.ok(raidCalls.some(([k, t]) => k === 'say' && t.includes('Raider') && t.includes('estaba jugando Among Us')));
  const card = cards[cards.length - 2];
  assert.deepEqual([card.name, card.login, card.game, card.viewers, card.avatar], ['Raider', 'raider', 'Among Us', 12, 'https://x.test/pic.png']);
  // Twitch refusing (not live) still says it in chat and shows the card.
  assert.equal(offline.ok, true);
  assert.ok(offline.errors.some((e) => /not streaming live/.test(e)));
  // And which part failed, and why, so Who's on does not say "Shoutout sent" regardless.
  assert.deepEqual(offline.failures.map((f) => [f.part, f.code]), [['native', 'not_live']]);
  assert.deepEqual(manual.failures, []);
});

// ---------------------------------------------------------------- clips and markers

calls.length = 0;
const clipOffline = await x.clip({ post: true });
live = true;
const clipDock = await x.clip({ post: true });
const clipQuiet = await x.clip();
const markerMade = await x.marker('buen momento');
const ctx = { input: '' };
await runSteps([{ id: 's1', type: 'twitch_clip', config: {} }], ctx, { twitchExtras: { clip: () => x.clip() } });
const dockPress = await engine.runDockBuiltin('twitch_marker');

test('a clip or a marker from the dock or an action, and a plain answer when the stream is not live', () => {
  assert.deepEqual(clipOffline, { ok: false, code: 'not_live', error: 'the stream is not live' });
  assert.equal(clipDock.url, 'https://clips.twitch.tv/Clip1');
  // From the dock the link goes to chat; from an action it does not.
  assert.deepEqual(calls.filter(([k]) => k === 'say').map(([, t]) => t), ['🎬 Nuevo clip: https://clips.twitch.tv/Clip1']);
  assert.equal(clipQuiet.ok, true);
  assert.deepEqual([markerMade.ok, markerMade.at, markerMade.description], [true, 125, 'buen momento']);
  // An action's clip is {clip.url} for the steps after it.
  assert.equal(ctx.clip.url, 'https://clips.twitch.tv/Clip1');
  assert.equal(dockPress.ok, true);
});

// ---------------------------------------------------------------- the next stream

const hour = 3600000;
const now = Date.parse('2026-10-01T12:00:00Z');
const segments = [
  { start: new Date(now - hour).toISOString(), title: 'Ya empezó', category: 'Among Us' },
  { start: new Date(now + hour / 4).toISOString(), title: 'Por empezar', category: 'Among Us' },
  { start: new Date(now + 50 * hour).toISOString(), title: 'Viernes de impostores', category: 'Among Us' },
];
const next = x.nextStream(now, segments);

test('the next stream is the next one on the schedule, not the one about to start', () => {
  assert.equal(next.title, 'Viernes de impostores');
  assert.equal(x.nextStream(now, []), null);
  // In Discord, a timestamp everybody reads in their own time zone.
  const unix = Math.floor(Date.parse(next.start) / 1000);
  assert.equal(fillNext('Próximo: {next} — {nextTitle}', next), `Próximo: <t:${unix}:F> (<t:${unix}:R>) — Viernes de impostores`);
  // With nothing scheduled, the sentence naming it goes, and a line left empty with it.
  assert.equal(fillNext('¡Gracias por ver! Próximo: {next}', null), '¡Gracias por ver!');
  assert.equal(fillNext('Se acabó.\nPróximo stream: {next}\nChao', null), 'Se acabó.\nChao');
  // On a text layer.
  assert.equal(fillTemplate('{nextStreamTitle} · {nextStreamGame}', { twitchSchedule: { next } }), 'Viernes de impostores · Among Us');
  assert.equal(fillTemplate('Próximo: {nextStream}', { twitchSchedule: { next: null } }), 'Próximo: —');
  assert.ok(fillTemplate('{nextStreamDay}', { twitchSchedule: { next } }).length > 3);
});

// ---------------------------------------------------------------- the layers and the screen

const [layout] = normaliseLayouts([{ id: 'tw', layers: [
  { type: 'hypetrain', config: { title: '  Tren  ', doneSeconds: 99 } },
  { type: 'shoutout', config: { showViewers: false, preview: true } },
] }]);

test('a Hype Train layer and a shoutout layer, on the canvas, in the editor and on their own screen, in both languages', () => {
  assert.ok(LAYER_TYPES.includes('hypetrain') && LAYER_TYPES.includes('shoutout'));
  const [hype, so] = layout.layers;
  assert.deepEqual(hype.config, { title: 'Tren', levelWord: '', doneText: '', doneSeconds: 30, showTop: true });
  assert.equal(so.config.showViewers, false);
  assert.equal(so.config.preview, undefined, 'a Library preview flag was saved on a real layer');
  const canvas = read('../../web/components/CanvasStage.tsx');
  assert.ok(canvas.includes("case 'hypetrain':") && canvas.includes("case 'shoutout':") && canvas.includes('hypeTrain={(system.data as any).hypeTrain}'));
  assert.ok(read('../../web/components/views/LayoutsView.tsx').includes('<HypeTrainLayerPanel'));
  assert.ok(read('../../web/App.tsx').includes('<TwitchView'));
  const strings = read('../../web/constants.ts');
  const files = ['views/TwitchView.tsx', 'TwitchLayerPanels.tsx', 'views/ActionsView.tsx', 'AvatarLayerPanel.tsx'];
  const keys = new Set(files.flatMap((f) => [...read(`../../web/components/${f}`).matchAll(/t\.((?:twitch|hype|shoutout|avatarOn)\w+)/g)].map((m) => m[1])));
  for (const key of keys) assert.equal(strings.split(`    ${key}:`).length - 1, 2, `${key} is not in both languages`);
  // New permissions are asked for, and missing ones are said out loud.
  const hook = read('../../web/hooks/useStreamSystem.ts');
  for (const scope of ['channel:read:hype_train', 'moderator:manage:shoutouts', 'clips:edit']) assert.ok(hook.includes(`'${scope}'`), `${scope} is not asked for`);
  assert.ok(read('../../web/components/views/TwitchView.tsx').includes('data-twitch-missing'));
});

bus.off?.(EVENTS.CONFIG, onConfig);
x.useTwitchForTests(null);
x.resetForTests();
