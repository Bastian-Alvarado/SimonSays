/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: a Spotify that has let go of its player.
 *
 * Paused for a few minutes, Spotify stops counting the device as active and
 * every player command answers 404 NO_ACTIVE_DEVICE — until somebody pressed
 * play in Spotify itself. Now a press brings the music back to the device it
 * was on and does what was pressed. Spotify is played here by a stand-in that
 * answers the way the real one does, so nothing leaves the machine.
 *
 * Last in the run: it sets the Spotify module up with a stand-in token, which
 * no other file expects to find.
 */

import { assert, test } from './harness.js';

const spotify = await import('../../platforms/spotify.js');
const { collection } = await import('../../core/store.js');

spotify.initSpotify();
const tokens = collection('spotify_tokens');
tokens.set({ accessToken: 'stand-in', refreshToken: 'stand-in', expiresAt: Date.now() + 3_600_000 });

const NO_DEVICE = { error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } };
const PC = { id: 'pc', name: 'Rowan-PC', type: 'Computer', is_active: false, is_restricted: false, volume_percent: 40 };
const PHONE = { id: 'phone', name: 'Phone', type: 'Smartphone', is_active: false, is_restricted: false, volume_percent: 70 };

/*
  A Spotify with nobody active until something is handed playback. `devices`
  is what it lists; `asleep` is whether it has let go; every request is kept.
*/
let devices = [PHONE, PC];
let asleep = true;
let player = null;
let calls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const path = String(url).replace('https://api.spotify.com/v1', '');
  const method = init.method || 'GET';
  calls.push({ method, path, body: init.body ? JSON.parse(init.body) : null });
  const aimed = path.includes('device_id=');
  if (path === '/me/player/devices') return json({ devices });
  if (method === 'PUT' && path === '/me/player') { asleep = false; return new Response(null, { status: 204 }); }
  if (path === '/me/player' && method === 'GET') return player ? json(player) : new Response(null, { status: 204 });
  if (path.startsWith('/search')) return json({ tracks: { items: [{ id: 't1', uri: 'spotify:track:t1', name: 'Blue Monday', artists: [{ name: 'New Order' }] }] } });
  if (path.startsWith('/me/player/') && asleep && !aimed) return json(NO_DEVICE, 404);
  if (path.startsWith('/me/player/premium')) return json({ error: { status: 403, message: 'Premium required', reason: 'PREMIUM_REQUIRED' } }, 403);
  return new Response(null, { status: 204 });
};

/** One press, from a fresh Spotify that has let go: what it asked, and how it ended. */
const press = async (operation, setup = {}) => {
  calls = [];
  asleep = setup.asleep ?? true;
  devices = setup.devices ?? [PHONE, PC];
  player = setup.player ?? null;
  try {
    await spotify.control(operation);
    return { calls, error: null };
  } catch (err) {
    return { calls, error: err };
  }
};
const said = (r) => r.calls.map((c) => `${c.method} ${c.path}`);

const play = await press('play');
const next = await press('next');
const pause = await press('pause');
const toggle = await press('toggle');
const nowhere = await press('play', { devices: [] });
const restricted = await press('play', { devices: [{ ...PC, is_restricted: true }] });
const awake = await press('next', { asleep: false });
// The volume reads the player, and so learns which device the music is on: the phone, here.
const volume = await press('volume_up', { asleep: false, player: { device: PHONE, is_playing: true } });
const backToPhone = await press('play');

calls = [];
asleep = true;
devices = [PHONE, PC];
let queued = null;
let queueError = null;
try { queued = await spotify.queue('blue monday'); } catch (err) { queueError = err; }
const queueCalls = calls;

globalThis.fetch = realFetch;
tokens.set({ accessToken: '', refreshToken: '', expiresAt: 0 });

test('play on a Spotify that has let go hands the music back to the computer, playing', () => {
  assert.equal(play.error, null, play.error?.message);
  assert.deepEqual(said(play), ['PUT /me/player/play', 'GET /me/player/devices', 'PUT /me/player']);
  assert.deepEqual(play.calls[2].body, { device_ids: ['pc'], play: true }, 'it was handed to the wrong device, or not played');
});

test('any other press brings it back without playing, then is sent to that device', () => {
  assert.equal(next.error, null, next.error?.message);
  assert.deepEqual(next.calls[2].body, { device_ids: ['pc'], play: false });
  assert.equal(said(next)[3], 'POST /me/player/next?device_id=pc', 'the press was not repeated on the device it woke');
});

test('pause with nothing active is already done, and wakes nothing', () => {
  assert.equal(pause.error, null, pause.error?.message);
  assert.deepEqual(said(pause), ['PUT /me/player/pause']);
});

test('the dock\'s play-pause button plays when nothing is active', () => {
  assert.equal(toggle.error, null, toggle.error?.message);
  assert.ok(said(toggle).includes('PUT /me/player/play') && !said(toggle).includes('PUT /me/player/pause'), `it paused: ${said(toggle).join(', ')}`);
  assert.deepEqual(toggle.calls.at(-1).body, { device_ids: ['pc'], play: true });
});

test('with Spotify open nowhere, the press says so in words the dock can show', () => {
  assert.equal(nowhere.error?.code, 'spotify_no_device', nowhere.error?.message);
  assert.equal(restricted.error?.code, 'spotify_no_device', 'a device Spotify will not let anything drive was picked');
});

test('an active Spotify is pressed once, as before', () => {
  assert.equal(awake.error, null, awake.error?.message);
  assert.deepEqual(said(awake), ['POST /me/player/next']);
});

test('it goes back to the device the music was last on, not just any computer', () => {
  assert.equal(volume.error, null, volume.error?.message);
  assert.deepEqual(backToPhone.calls[2].body, { device_ids: ['phone'], play: true });
});

test('a song request while Spotify has let go still lands in the queue', () => {
  assert.equal(queueError, null, queueError?.message);
  assert.equal(queued?.name, 'Blue Monday');
  const to = queueCalls.map((c) => `${c.method} ${c.path}`);
  assert.ok(to.includes('POST /me/player/queue?uri=spotify%3Atrack%3At1&device_id=phone'), `not queued on the device it woke: ${to.join(', ')}`);
});

test('which device to bring back', () => {
  const { pickDevice } = spotify;
  assert.equal(pickDevice([PHONE, { ...PC, is_active: true }], 'phone').id, 'pc', 'one still active is passed over');
  assert.equal(pickDevice([PHONE, PC], 'phone').id, 'phone', 'the last one is passed over');
  assert.equal(pickDevice([PHONE, PC], 'gone').id, 'pc', 'a computer is not preferred when the last one is gone');
  assert.equal(pickDevice([PHONE], null).id, 'phone');
  assert.equal(pickDevice([{ ...PC, is_restricted: true }], null), null, 'a device Spotify will not let anything drive was picked');
  assert.equal(pickDevice(undefined, null), null);
});
