/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The song in every run path, skips, up next, speech when the model fails, choosing what plays.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, assert, bus, doubles, engine, normaliseChat, played, said, spoken, test } from './harness.js';

// --------------------------------------- the song reaches every run path
//
// {spotify.track} was empty on a real command because the service object did
// not carry getNowPlaying. Three other paths had a second version of the same
// hole: they built a context without passing nowPlaying at all, so the Test
// button, a Dock Actions press, and alert captions all rendered an empty song
// even once the service was fixed. One test per path.

engine.store.saveAction({
  id: 'act-song-paths',
  name: 'Now playing',
  enabled: true,
  trigger: { id: 't-song-paths', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [{ id: 's-song-paths', type: 'twitch_chat', config: { message: 'Ta sonando {spotify.track} de {spotify.artist}' } }],
});

const NOW = 'Ta sonando Smells Like Teen Spirit de Nirvana';

said.length = 0;
await engine.testAction('act-song-paths');
test('the Test button renders the current song', () => {
  assert.deepEqual(said, [NOW]);
});

said.length = 0;
await engine.runDockAction('act-song-paths');
test('a Dock Actions press renders the current song', () => {
  assert.deepEqual(said, [NOW]);
});

said.length = 0;
bus.emit(EVENTS.CHAT, normaliseChat({
  platform: 'twitch', user: 'Viewer', msg: '!songpaths', badges: {},
}));
engine.store.saveCommand({
  id: 'cmd-songpaths', name: 'SongPaths', triggers: ['!songpaths'], enabled: true,
  permissions: { anyone: true }, globalCooldown: 0, userCooldown: 0,
});
engine.store.saveAction({
  id: 'act-song-chat',
  name: 'Now playing chat',
  enabled: true,
  trigger: { id: 't-song-chat', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-songpaths' } },
  actions: [{ id: 's-song-chat', type: 'twitch_chat', config: { message: 'Ta sonando {spotify.track} de {spotify.artist}' } }],
});
said.length = 0;
bus.emit(EVENTS.CHAT, normaliseChat({
  platform: 'twitch', user: 'Viewer', msg: '!songpaths', badges: {},
}));
await new Promise((r) => setTimeout(r, 250));
test('a real chat command renders the current song', () => {
  assert.deepEqual(said, [NOW], `got ${JSON.stringify(said)}`);
});

// ------------------------------------------- announcing after a skip
//
// The reply to !skip named the song that had just been skipped. The cause was
// the same missing-method bug as getNowPlaying: steps.js calls
// `spotify.settleAfterSkip?.()`, the service object did not carry it, the
// optional call quietly did nothing, and ctx.spotify kept the old track.

engine.store.saveAction({
  id: 'act-skip',
  name: 'Skip and announce',
  enabled: true,
  trigger: { id: 't-skip', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [
    { id: 's-skip', type: 'spotify_control', config: { spotifyOperation: 'next' } },
    { id: 's-skip-say', type: 'twitch_chat', config: { message: 'ahora suena {spotify.track} de {spotify.artist}' } },
  ],
});

doubles.spotifySkipped = false;
said.length = 0;
await engine.testAction('act-skip');
test('after a skip the reply names the NEW song, not the skipped one', () => {
  assert.deepEqual(said, ['ahora suena Burn This City de Chetta'],
    `got ${JSON.stringify(said)}`);
});

test('and it is not the track getNowPlaying still reports', () => {
  assert.ok(!said[0]?.includes('Smells Like Teen Spirit'),
    'announced the pre-skip track - settleAfterSkip did not take effect');
});

// ------------------------------------------------------------- up next
//
// {spotify.next*} reads Spotify's own /me/player/queue, so shuffle and
// playlist order are its problem, not ours. What has to hold here is that the
// value reaches a template at all, that it is a different song from the one
// playing, and that an empty queue renders empty instead of something made up.

engine.store.saveAction({
  id: 'act-upnext',
  name: 'Up next reply',
  enabled: true,
  trigger: { id: 't-upnext', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [{ id: 's-upnext', type: 'twitch_chat', config: { message: 'ahora {spotify.track}, luego {spotify.nextTrack} de {spotify.nextArtist}' } }],
});

doubles.spotifySkipped = false;
said.length = 0;
await engine.testAction('act-upnext');
test('{spotify.nextTrack} reaches a template', () => {
  assert.deepEqual(said, ['ahora Smells Like Teen Spirit, luego Burn This City de Chetta'],
    `got ${JSON.stringify(said)}`);
});

test('up next is a different song from the one playing', () => {
  assert.ok(!/luego Smells Like Teen Spirit/.test(said[0] || ''),
    'up next echoed the current track');
});

// A skip moves the queue along; the next call must see the new head.
said.length = 0;
await engine.testAction('act-skip');
said.length = 0;
await engine.testAction('act-upnext');
test('after a skip, up next has moved on too', () => {
  assert.ok((said[0] || '').includes('luego Fuck Your Trends'),
    `got ${JSON.stringify(said)}`);
});

// Nothing lined up must render empty, not a leftover or a placeholder.
export const { buildContext: bc, interpolate: interp } = await import('../../engine/variables.js');
test('an empty queue renders an empty next song', () => {
  const ctx = bc({
    nowPlaying: { name: 'Blue Monday', artist: 'New Order' },
    upNext: null,
  });
  assert.equal(interp('luego {spotify.nextTrack}', ctx), 'luego ');
});

test('a queued-up song fills every next field', () => {
  const ctx = bc({
    nowPlaying: { name: 'Blue Monday', artist: 'New Order' },
    upNext: { name: 'Temptation', artist: 'New Order', album: 'Power', coverUrl: 'http://c', url: 'http://s' },
  });
  assert.equal(interp('{spotify.nextTrack}|{spotify.nextArtist}|{spotify.nextAlbum}|{spotify.nextUrl}', ctx),
    'Temptation|New Order|Power|http://s');
});

// The omnibar slot type has to survive the save validator, or picking "Up
// next" in the editor would silently drop the slot on the next write.
test('a top-chatters count is stored and bounded', () => {
  const save = (topCount) => engine.store.setOmnibar({
    enabled: true, defaultSeconds: 10,
    items: [{ id: 'o-t', type: 'topChatters', enabled: true, name: '', label: '', text: '', seconds: null, topCount }],
  }).items[0].topCount;

  assert.equal(save(5), 5);
  assert.equal(save(1), 1);
  // An out-of-range number is CLAMPED into range, matching how every other
  // bounded field here behaves (height, font size, seconds). Only a value
  // that is not a number at all falls back to the default.
  assert.equal(save(900), 10);
  assert.equal(save(0), 1);
  assert.equal(save(-4), 1);
  assert.equal(save(4.6), 5, 'fractions round rather than truncate');
  assert.equal(save('lots'), 3);
  assert.equal(save(undefined), 3);
});

test('the variants toggle and transparency survive a save', () => {
  const saved = engine.store.setOmnibar({
    enabled: true, defaultSeconds: 10,
    items: [{ id: 'o-v', type: 'commands', enabled: true, name: '', label: '', text: '', seconds: null, commandsAllTriggers: true }],
    style: { transparent: true, background: '#123456' },
  });
  assert.equal(saved.items[0].commandsAllTriggers, true);
  assert.equal(saved.style.transparent, true);
  // Transparency must not eat the colour: turning it back off restores it.
  assert.equal(saved.style.background, '#123456');
});

test('both default to off rather than undefined', () => {
  const saved = engine.store.setOmnibar({
    enabled: true, defaultSeconds: 10,
    items: [{ id: 'o-v2', type: 'commands', enabled: true, name: '', label: '', text: '', seconds: null }],
  });
  assert.equal(saved.items[0].commandsAllTriggers, false);
  assert.equal(saved.style.transparent, false);
});

test('a junk transparency value is not treated as on', () => {
  const saved = engine.store.setOmnibar({
    enabled: true, defaultSeconds: 10, items: [],
    style: { transparent: 'yes please' },
  });
  assert.equal(saved.style.transparent, false);
});

test('a commands slot keeps its picked command ids', () => {
  const saved = engine.store.setOmnibar({
    enabled: true,
    defaultSeconds: 10,
    items: [{ id: 'o-p', type: 'commands', enabled: true, name: '', label: '', text: '', seconds: null, commandIds: ['a', 'b'] }],
  });
  assert.deepEqual(saved.items[0].commandIds, ['a', 'b']);
});

test('junk in commandIds is dropped rather than stored', () => {
  const saved = engine.store.setOmnibar({
    enabled: true,
    defaultSeconds: 10,
    items: [{ id: 'o-p2', type: 'commands', enabled: true, name: '', label: '', text: '', seconds: null, commandIds: ['ok', 42, null, '', { x: 1 }] }],
  });
  assert.deepEqual(saved.items[0].commandIds, ['ok']);
});

test('a slot with no picks stores an empty list, not undefined', () => {
  const saved = engine.store.setOmnibar({
    enabled: true, defaultSeconds: 10,
    items: [{ id: 'o-p3', type: 'commands', enabled: true, name: '', label: '', text: '', seconds: null }],
  });
  assert.deepEqual(saved.items[0].commandIds, []);
});

test('the omnibar accepts a commands slot', () => {
  const saved = engine.store.setOmnibar({
    enabled: true,
    defaultSeconds: 10,
    items: [{ id: 'o-cmds', type: 'commands', enabled: true, name: 'Cmds', label: '', text: '', seconds: null }],
  });
  assert.equal(saved.items.length, 1, 'the commands slot was dropped on save');
  assert.equal(saved.items[0].type, 'commands');
});

test('the omnibar accepts a countdown slot', () => {
  const saved = engine.store.setOmnibar({
    enabled: true,
    defaultSeconds: 10,
    items: [{ id: 'o-cd', type: 'countdown', enabled: true, name: 'CD', label: '', text: '', seconds: null }],
  });
  assert.equal(saved.items.length, 1, 'the countdown slot was dropped on save');
  assert.equal(saved.items[0].type, 'countdown');
});

test('the omnibar accepts an upNext slot', () => {
  const saved = engine.store.setOmnibar({
    enabled: true,
    defaultSeconds: 10,
    items: [{ id: 'o-next', type: 'upNext', enabled: true, name: 'Next', label: '', text: '', seconds: null }],
  });
  assert.equal(saved.items.length, 1, 'the upNext slot was dropped on save');
  assert.equal(saved.items[0].type, 'upNext');
});

// ------------------------------------------ speech survives a dead model
//
// Every Gemini TTS model is a preview build, so the pinned id will stop
// existing at some point. It used to fail closed: synthesise() returned null
// and the step simply returned, so TTS went silent mid-stream with one line
// in a log nobody is watching. Speaking in a different voice is a much better
// failure than not speaking.

engine.store.saveAction({
  id: 'act-tts-fallback',
  name: 'Gemini speech',
  enabled: true,
  trigger: { id: 't-ttsfb', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [{
    id: 's-ttsfb',
    type: 'browser_tts',
    config: { ttsProvider: 'gemini', ttsVoice: 'Puck', ttsText: 'hola {user}' },
  }],
});

// --- working Gemini: audio goes out, nothing is spoken by the browser
doubles.ttsAudio = 'BASE64AUDIO';
spoken.length = 0; played.length = 0;
await engine.testAction('act-tts-fallback');
test('working Gemini speech is sent as audio', () => {
  assert.deepEqual(played, ['BASE64AUDIO']);
  assert.deepEqual(spoken, [], 'it also fell back, which would speak twice');
});

// --- failed Gemini: nothing to play, so the browser speaks instead
doubles.ttsAudio = null;
spoken.length = 0; played.length = 0;
await engine.testAction('act-tts-fallback');
test('a failed synthesis falls back to the browser voice', () => {
  assert.deepEqual(spoken, ['hola TestUser'], `got ${JSON.stringify(spoken)}`);
});

test('the fallback plays no audio', () => {
  assert.deepEqual(played, []);
});

// A Gemini voice name means nothing to a browser: passing "Puck" through as a
// voiceURI would match nothing and warn on every surface.
const fallbackFrames = [];
const grab = (d) => { if (d.kind === 'play_tts') fallbackFrames.push(d); };
bus.on(EVENTS.DEVICE, grab);
doubles.ttsAudio = null;
await engine.testAction('act-tts-fallback');
bus.off?.(EVENTS.DEVICE, grab);
test('the fallback does not pass the Gemini voice name to the browser', () => {
  assert.equal(fallbackFrames.length, 1, `got ${fallbackFrames.length} frames`);
  assert.equal(fallbackFrames[0].voiceURI, undefined, `leaked voice ${fallbackFrames[0].voiceURI}`);
});

// The browser provider must be untouched by any of this.
engine.store.saveAction({
  id: 'act-tts-browser',
  name: 'Browser speech',
  enabled: true,
  trigger: { id: 't-ttsbr', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [{ id: 's-ttsbr', type: 'browser_tts', config: { ttsProvider: 'browser', ttsVoice: 'Microsoft David', ttsText: 'plain' } }],
});
spoken.length = 0; played.length = 0;
const browserFrames = [];
const grab2 = (d) => { if (d.kind === 'play_tts') browserFrames.push(d); };
bus.on(EVENTS.DEVICE, grab2);
await engine.testAction('act-tts-browser');
bus.off?.(EVENTS.DEVICE, grab2);
test('the browser provider still uses its own chosen voice', () => {
  assert.equal(browserFrames[0]?.voiceURI, 'Microsoft David');
});

// ------------------------------------------- picking what plays next
//
// Up next was getting stuck on the song already playing, and staying stuck
// across several skips. Spotify does not document whether /me/player/queue
// excludes the current track, and a read taken right after a skip returns the
// PRE-skip queue — whose head is the song that has just become current. Both
// make a naive queue[0] answer with what is already playing.

const { pickUpNext } = await import('../../platforms/spotify.js');

const trk = (id) => ({ id, name: id, artists: [{ name: 'Chetta' }], album: { name: id, images: [{ url: 'http://' + id }] }, external_urls: { spotify: 'http://s/' + id } });

test('the ordinary case takes the head of the queue', () => {
  const got = pickUpNext({ currently_playing: trk('a'), queue: [trk('b'), trk('c')] }, 'a');
  assert.equal(got?.id, 'b');
});

test('a queue that repeats the current track skips past it', () => {
  const got = pickUpNext({ currently_playing: trk('a'), queue: [trk('a'), trk('b')] }, 'a');
  assert.equal(got?.id, 'b', 'answered with the song already playing');
});

// The exact skip case: the queue read is stale, so its head is the track that
// just became current. That is the "up next never changes" report.
test('a stale post-skip queue does not answer with the new current track', () => {
  const staleQueue = { currently_playing: trk('old'), queue: [trk('new'), trk('after')] };
  const got = pickUpNext(staleQueue, 'new');
  assert.equal(got?.id, 'after', `stuck on ${got?.id}`);
});

test('several repeats of the current track are all skipped', () => {
  const got = pickUpNext({ currently_playing: trk('a'), queue: [trk('a'), trk('a'), trk('z')] }, 'a');
  assert.equal(got?.id, 'z');
});

test('a queue of nothing but the current track has no answer', () => {
  assert.equal(pickUpNext({ currently_playing: trk('a'), queue: [trk('a')] }, 'a'), null);
});

test('an empty queue is null, not a guess', () => {
  assert.equal(pickUpNext({ currently_playing: trk('a'), queue: [] }, 'a'), null);
  assert.equal(pickUpNext({}, 'a'), null);
  assert.equal(pickUpNext(null, null), null);
});

test('entries with no id are ignored rather than published half-built', () => {
  const got = pickUpNext({ queue: [{ name: 'no id here' }, trk('b')] }, 'a');
  assert.equal(got?.id, 'b');
});

test('the chosen track carries the fields templates and the omnibar read', () => {
  const got = pickUpNext({ currently_playing: trk('a'), queue: [trk('b')] }, 'a');
  assert.equal(got.name, 'b');
  assert.equal(got.artist, 'Chetta');
  assert.equal(got.album, 'b');
  assert.equal(got.coverUrl, 'http://b');
  assert.equal(got.url, 'http://s/b');
});

test('several artists are joined, as the now-playing fields already do', () => {
  const two = { id: 'm', name: 'm', artists: [{ name: 'Maj0rLEX' }, { name: 'cyberia' }], album: { name: 'm', images: [] }, external_urls: {} };
  assert.equal(pickUpNext({ queue: [two] }, 'a').artist, 'Maj0rLEX, cyberia');
});

