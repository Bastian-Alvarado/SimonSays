/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The smoke test's harness: the engine booted once, with stub platform
 * services, and the helpers every feature file shares.
 *
 * Boots the engine with stub platform services, pushes synthetic chat and
 * events onto the bus, and asserts the pipeline reacts. No browser, no
 * network, no OBS — which is exactly the property V3 exists to provide.
 *
 *   Run through scripts/smoke.js, never on its own.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/*
  Paths in the tests were written from server/scripts/smoke.js, and are still
  read from there, so a test moved into a feature file did not have to change.
*/
export const SCRIPT_URL = new URL('../smoke.js', import.meta.url).href;

// Point the store at a throwaway directory before anything imports config.
// The shared stylesheet and its callers, read once: tests the length of this
// file look at them.
export const SCOPED = fs.readFileSync(new URL('../../web/components/ScopedStyle.tsx', SCRIPT_URL), 'utf8');
export const LAYER_STYLE = fs.readFileSync(new URL('../../web/components/LayerStyle.tsx', SCRIPT_URL), 'utf8');
export const ALERT_OVERLAY = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
export const CHAT_ROW = fs.readFileSync(new URL('../../web/components/ChatMessageRow.tsx', SCRIPT_URL), 'utf8');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-smoke-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.ASSETS_DIR = path.join(tmp, 'assets');
process.env.AUTO_START = 'false';
process.env.LOG_LEVEL = 'warn';

export const { initStore, flushAll, collection } = await import('../../core/store.js');
export const { isSameMachine } = await import('../../core/net.js');
export const { emojiKey } = await import('../../engine/discord-roles.js');
const { mentionsFrom } = await import('../../platforms/discord.js');
export const { bus, EVENTS, normaliseChat, normaliseEvent } = await import('../../core/bus.js');
export const engine = await import('../../engine/index.js');

// ---------------------------------------------------------------- harness

export const said = [];
export const scenes = [];
export const posted = [];
/** Every message the bot was asked to send: [channelId, content, embed, components, files, extra]. */
export const discordSent = [];
// TTS leaves the engine as a DEVICE event for a browser to perform, rather
// than through a platform service, so it is captured off the bus below.
export const spoken = [];
let passed = 0;
let failed = 0;

export function test(name, fn) {
  try {
    /*
      Nothing here is awaited, so a test body that returns a promise is a test
      whose assertions run after the summary has already been printed — it can
      only pass, however wrong it is. Work that has to be awaited belongs above
      the test, with the result asserted here.
    */
    const returned = fn();
    if (returned && typeof returned.then === 'function') {
      throw new Error('this test is async, and an async test can only ever pass: await above it instead');
    }
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

export const settle = () => new Promise((r) => setTimeout(r, 60));

bus.on(EVENTS.DEVICE, (d) => { if (d.kind === 'play_tts') spoken.push(d.text); });
// Gemini speech arrives as audio for a surface to play, not as text.
export const played = [];
bus.on(EVENTS.DEVICE, (d) => { if (d.kind === 'play_audio') played.push(d.audioBase64); });
/*
  What the stub services answer, set by the tests that need them to answer
  differently. One object rather than three variables, because a test in
  another file can change a field but can never reassign an import.
*/
export const doubles = {
  /** null models a failed speech synthesis, a string a working one. */
  ttsAudio: null,
  /** Flipped by the spotify double when a skip is requested. */
  spotifySkipped: false,
  /** The category the YouTube double is in. */
  youtubeCategoryNow: '24',
};
/** Every camera control the engine asked for. */
export const droidcamCalls = [];
/* What Omnilayer asked OBS for: ['place', scene, source, box] and ['visible', scene, source, on]. */
export const obsCalls = [];

initStore();

/* Every operation the player was asked for, so a button can be followed. */
export const spotifyOps = [];
/* What the YouTube steps asked for. */
export const youtubeCalls = [];

engine.initEngine({
  youtube: {
    setTitle: async (title) => { youtubeCalls.push(['title', title]); },
    setDescription: async (description) => { youtubeCalls.push(['description', description]); },
    toggleCategory: async (first, second) => {
      youtubeCalls.push(['category', first, second]);
      doubles.youtubeCategoryNow = second && doubles.youtubeCategoryNow === first ? second : first;
      return doubles.youtubeCategoryNow;
    },
  },
  twitch: {
    say: async (text) => { said.push(text); },
    setTitle: async () => {},
    setCategory: async () => {},
  },
  obs: {
    setScene: async (name) => { scenes.push(name); doubles.obsScene = name; },
    setSourceVisible: async (scene, source, visible) => { obsCalls.push(['visible', scene, source, visible]); },
    // Omnilayer: where each source was put, OBS's canvas, a source OBS does not have when asked to fail,
    // and an OBS that has stopped answering (a half-open connection), which never settles at all.
    placeSource: async (scene, source, box) => {
      obsCalls.push(['place', scene, source, box]);
      if (doubles.obsHang) return new Promise(() => {});
      if ((doubles.obsMissing || []).includes(source)) throw new Error(`No source was found by the name of ${source}`);
    },
    videoSize: async () => doubles.obsVideo || { width: 1920, height: 1080 },
    sceneSources: async () => doubles.obsItems || [],
    currentScene: () => doubles.obsScene ?? '',
    isConnected: () => doubles.obsConnected !== false,
    // Sending the stream: what a repeating action waits for when Twitch cannot say (doubles.obsStreaming).
    isStreaming: () => doubles.obsStreaming === true,
    setText: async () => {},
    setFilterEnabled: async (source, filter, on) => { obsCalls.push(['filter', source, filter, on]); },
    // The toggles, asked of OBS at the time: recorded as such, and answering "now on".
    toggleFilter: async (source, filter) => { obsCalls.push(['filter', source, filter, 'toggle']); return true; },
    toggleSourceVisible: async (scene, source) => { obsCalls.push(['visible', scene, source, 'toggle']); return true; },
    toggleMuted: async (source) => { obsCalls.push(['mute', source, 'toggle']); return true; },
    setVolumeDb: async () => {},
    setMuted: async (source, muted) => { obsCalls.push(['mute', source, muted]); },
    saveReplayBuffer: async () => {},
    // Stopping the stream: counted, and answering whether one was going (doubles.obsStreaming).
    stopStream: async () => {
      doubles.streamStops = (doubles.streamStops || 0) + 1;
      const was = doubles.obsStreaming === true;
      doubles.obsStreaming = false;
      return was;
    },
    setBrowserUrl: async () => {},
    setTransform: async () => {},
  },
  discord: {
    postWebhook: async (_url, content) => { posted.push(content); },
    sendMessage: async (...args) => { discordSent.push(args); return { id: '1' }; },
    // Commands in the rest of the server, as Connections sets them: on unless a test says otherwise.
    commandsEverywhere: () => doubles.discordCommandsEverywhere !== false,
    mentionsFrom,
  },
  spotify: {
    control: async (op) => { spotifyOps.push(op); if (op === 'next' || op === 'previous') doubles.spotifySkipped = true; },
    queue: async (input) => (input
      ? { name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', url: 'https://open.spotify.com/track/x' }
      : null),
    // Spotify only switches tracks a beat AFTER the skip request returns, which
    // is the whole reason settleAfterSkip exists. So getNowPlaying deliberately
    // keeps reporting the old song here — a double that switched instantly
    // could never catch the off-by-one this is guarding.
    getNowPlaying: () => ({ name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', isPlaying: true }),
    getUpNext: () => (doubles.spotifySkipped
      ? { name: 'Fuck Your Trends', artist: 'Chetta', album: '', coverUrl: '', url: '' }
      : { name: 'Burn This City', artist: 'Chetta', album: '', coverUrl: '', url: '' }),
    settleAfterSkip: async () => (doubles.spotifySkipped
      ? { name: 'Burn This City', artist: 'Chetta', album: 'Burn This City', isPlaying: true }
      : null),
  },
  tts: { synthesise: async () => doubles.ttsAudio },
  droidcam: {
    control: async (op, value) => {
      droidcamCalls.push({ op, value });
      if (op === 'explode') throw new Error('phone asleep');
      return { ok: true };
    },
  },
});

// ------------------------------------------------------------------ seeds

engine.store.saveCommand({
  id: 'cmd-hello',
  name: 'Hello',
  triggers: ['!hello'],
  enabled: true,
  permissions: { anyone: true, vips: true, subscribers: true, moderators: true, broadcaster: true },
  globalCooldown: 0,
  userCooldown: 0,
});

engine.store.saveCommand({
  id: 'cmd-subonly',
  name: 'Sub Only',
  triggers: ['!subonly'],
  enabled: true,
  permissions: { anyone: false, subscribers: true, vips: false, moderators: false, broadcaster: false },
});

engine.store.saveCommand({
  id: 'cmd-cooldown',
  name: 'Cooled',
  triggers: ['!cool'],
  enabled: true,
  permissions: { anyone: true },
  globalCooldown: 60,
});

engine.store.saveAction({
  id: 'act-hello',
  name: 'Say hello',
  enabled: true,
  trigger: { id: 't1', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-hello' } },
  actions: [{ id: 's1', type: 'twitch_chat', config: { message: 'Hi {user}! You said: {message.args}' } }],
});

// Mirrors a real TTS action: the trigger word must not be read aloud.
engine.store.saveAction({
  id: 'act-tts-text',
  name: 'TTS phrasing',
  enabled: true,
  trigger: { id: 't-tts', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-hello' } },
  actions: [{ id: 's-tts', type: 'twitch_chat', config: { message: '{user} dice {message}' } }],
});

engine.store.saveAction({
  id: 'act-subonly',
  name: 'Sub only reply',
  enabled: true,
  trigger: { id: 't2', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-subonly' } },
  actions: [{ id: 's2', type: 'twitch_chat', config: { message: 'secret' } }],
});

engine.store.saveAction({
  id: 'act-cool',
  name: 'Cooled reply',
  enabled: true,
  trigger: { id: 't3', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-cooldown' } },
  actions: [{ id: 's3', type: 'twitch_chat', config: { message: 'cooled' } }],
});

engine.store.saveAction({
  id: 'act-condition',
  name: 'Mod branch',
  enabled: true,
  trigger: { id: 't4', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-hello' } },
  actions: [{
    id: 's4',
    type: 'condition',
    config: { logic: { matchType: 'AND', conditions: [{ id: 'c1', variable: 'user.isMod', operator: 'isTrue', value: '' }] } },
    thenActions: [{ id: 's4a', type: 'twitch_chat', config: { message: 'mod-branch' } }],
    elseActions: [{ id: 's4b', type: 'twitch_chat', config: { message: 'viewer-branch' } }],
  }],
});

engine.store.saveAction({
  id: 'act-raid',
  name: 'Raid scene',
  enabled: true,
  trigger: { id: 't5', category: 'twitch', type: 'twitch_raid', config: {} },
  actions: [{ id: 's5', type: 'obs_scene', config: { sceneName: 'RaidScene' } }],
});

engine.store.saveAction({
  id: 'act-bigcheer',
  name: 'Big cheer only',
  enabled: true,
  trigger: { id: 't6', category: 'twitch', type: 'twitch_cheer', config: { minBits: 100 } },
  actions: [{ id: 's6', type: 'twitch_chat', config: { message: 'big cheer' } }],
});

// Self-referential action: must not blow the stack.
engine.store.saveAction({
  id: 'act-loop',
  name: 'Loop',
  enabled: true,
  trigger: { id: 't7', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [{ id: 's7', type: 'trigger_action', config: { actionId: 'act-loop' } }],
});

export const chat = (msg, over = {}) => bus.emit(EVENTS.CHAT, normaliseChat({
  platform: 'twitch', user: 'Viewer', msg, ...over,
}));


export { assert, fs };

/** How many passed and failed, for the runner's summary. */
export const results = () => ({ passed, failed });

/** The throwaway data directory, for the runner to remove. */
export { tmp };
