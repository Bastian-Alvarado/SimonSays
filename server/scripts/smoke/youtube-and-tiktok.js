/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: YouTube title, description and health, and TikTok following OBS.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, SCRIPT_URL, assert, bus, chat, collection, doubles, engine, fs, said, settle, test, youtubeCalls } from './harness.js';
import { mod, runCommand } from './chat-steps.js';

// ------------------------------------------- YouTube title and description

runCommand('ytitle', [{ type: 'youtube_set_title', config: { title: '{input}' } }]);
runCommand('ydesc', [{ type: 'youtube_set_description', config: { description: 'Playing {input}\nSecond line' } }]);
youtubeCalls.length = 0;
chat('!ytitle Any% attempts   tonight', mod);
chat('!ytitle', mod);
chat('!ydesc Hollow Knight', mod);
await settle();
runCommand('ycat', [
  { type: 'youtube_toggle_category', config: { categoryA: '20', categoryB: '22' } },
  { type: 'twitch_chat', config: { message: 'now in {youtube.category}' } },
]);
said.length = 0;
chat('!ycat', mod);
await settle();
chat('!ycat', mod);
await settle();
chat('!ycat', mod);
await settle();
doubles.youtubeCategoryNow = '24';
const youtubeDeckPresses = [];
for (let i = 0; i < 3; i += 1) youtubeDeckPresses.push((await engine.runDockBuiltin('youtube_category_toggle')).category);
test('the YouTube dock button flips between Gaming and People & Blogs, and says which', () => {
  assert.deepEqual(youtubeDeckPresses, ["Gaming", "People & Blogs", "Gaming"]);
  const view = fs.readFileSync(new URL('../../web/components/views/DockActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("youtube: { name: 'YouTube' }"), 'the YouTube group has no heading');
  const grid = fs.readFileSync(new URL('../../web/components/DockActionsGrid.tsx', SCRIPT_URL), 'utf8');
  assert.ok(grid.includes("category === 'youtube'"), 'the button is not tinted YouTube red');
});

test('one step flips the YouTube category between two, from anything else to the first', () => {
  // Entertainment is neither, so the first press lands on Gaming.
  assert.deepEqual(said.filter((l) => l.startsWith('now in')), ['now in Gaming', 'now in People & Blogs', 'now in Gaming']);
});

test('an action sets the YouTube title from what follows the command, and nothing when nothing does', () => {
  assert.deepEqual(youtubeCalls.filter((c) => c[0] === 'title'), [['title', 'Any% attempts tonight']]);
});
test('and the description keeps its line breaks', () => {
  assert.deepEqual(youtubeCalls.filter((c) => c[0] === 'description'), [['description', 'Playing Hollow Knight\nSecond line']]);
});

/*
  The module itself, against a stand-in for Google. What matters is that a
  snippet is replaced whole, so a title change that sent only a title would
  wipe the description and the tags — the current one has to be read first.
*/
const realFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const reply = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
  if (init.method === 'PUT') { sent.push(JSON.parse(init.body)); return reply({}); }
  if (u.includes('broadcastStatus=active')) return reply({ items: [] });
  if (u.includes('broadcastStatus=upcoming')) {
    return reply({ items: [
      { id: 'later', snippet: { scheduledStartTime: '2026-10-02T20:00:00Z' } },
      { id: 'sooner', snippet: { scheduledStartTime: '2026-10-01T20:00:00Z' } },
    ] });
  }
  if (u.includes('/videos?part=snippet&id=')) {
    return reply({ items: [{ snippet: { title: 'Old title', description: 'Old description', categoryId: '20', tags: ['speedrun'], defaultLanguage: 'en', channelTitle: 'dropped' } }] });
  }
  return reply({ items: [] });
};
const youtube = await import('../../platforms/youtube.js');
const ytTokens = collection('youtube_tokens', {});
ytTokens.set({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3_600_000, scope: 'https://www.googleapis.com/auth/youtube.readonly' });
youtube.initYouTube();
youtube.stop();
let readOnlyRefused = '';
try { await youtube.setDetails({ title: 'Nope' }); } catch (err) { readOnlyRefused = err.message; }
const readOnlySettings = youtube.getSettings();

ytTokens.set({ ...ytTokens.get(), scope: 'https://www.googleapis.com/auth/youtube.force-ssl' });
await youtube.setDetails({ title: '  New <b>title</b>  ' });
await youtube.setDetails({ description: 'x'.repeat(4999) + 'é' });
const announced = [];
const stopListening = bus.on(EVENTS.STAT, ({ key, value }) => { if (key.startsWith('youtubeCategory')) announced.push([key, value]); });
const fromOther = await youtube.service.toggleCategory('22', '20');
const flipped = await youtube.service.toggleCategory('20', '22');
const single = await youtube.service.toggleCategory('24', '');
let badCategory = '';
try { await youtube.service.toggleCategory('999', '20'); } catch (err) { badCategory = err.message; }
stopListening();
const editSettings = youtube.getSettings();
youtube.stop();
globalThis.fetch = realFetch;

test('an account linked for reading is refused, and told to sign in again', () => {
  assert.equal(readOnlySettings.canEdit, false);
  assert.match(readOnlyRefused, /sign in again/i);
  assert.equal(editSettings.canEdit, true);
});

test('a title change keeps the description, tags and category it did not touch', () => {
  const [first] = sent;
  assert.equal(first.id, 'sooner', 'not live, so the next scheduled broadcast is the one changed');
  assert.equal(first.snippet.title, 'New btitle/b', 'angle brackets and spare spaces reached YouTube');
  assert.equal(first.snippet.description, 'Old description');
  assert.deepEqual(first.snippet.tags, ['speedrun']);
  assert.equal(first.snippet.categoryId, '20');
  assert.equal(first.snippet.defaultLanguage, 'en');
  assert.ok(!('channelTitle' in first.snippet), 'read-only fields were sent back');
});

test('the category toggles against what YouTube says it is in, and keeps the rest', () => {
  assert.equal(fromOther, '22', 'on Gaming, which is not the first, it should go to the first');
  assert.equal(flipped, '22', 'on Gaming, the first, it should move to the second');
  assert.equal(single, '24', 'with only one category it is simply set');
  assert.match(badCategory, /not a category/);
  const last = sent.at(-1).snippet;
  assert.equal(last.title, 'Old title');
  assert.equal(last.description, 'Old description');
});

test('each change says which category the stream is in, by id and by name', () => {
  // The first toggle landed on People & Blogs (22).
  assert.deepEqual(announced.slice(0, 2), [['youtubeCategoryId', '22'], ['youtubeCategory', 'People & Blogs']]);
});

test('the YouTube dock button keeps a picture per category, and only for its own two', () => {
  const saved = engine.store.setDockButtons([
    { builtin: 'youtube_category_toggle', label: '', stateImages: { 20: '/media/gaming.png', 22: 'https://example.com/chat.png', 24: '/media/other.png' } },
    { builtin: 'spotify_play_pause', label: '', stateImages: { 20: '/media/gaming.png' } },
    { builtin: 'youtube_category_toggle', label: '', stateImages: { 20: 'javascript:alert(1)' } },
  ]);
  assert.deepEqual(saved[0].stateImages, { 20: '/media/gaming.png', 22: 'https://example.com/chat.png' });
  assert.deepEqual(saved[1].stateImages, {}, 'a button with no states kept pictures for them');
  assert.deepEqual(saved[2].stateImages, {}, 'a picture the plain image would refuse was kept');
  engine.store.setDockButtons([]);
});

test('the button shows the category and its picture, and every grid is told it', () => {
  const grid = fs.readFileSync(new URL('../../web/components/DockActionsGrid.tsx', SCRIPT_URL), 'utf8');
  assert.ok(grid.includes('stateName || button.label'), 'the button does not say the category');
  assert.ok(grid.includes('button.stateImages?.[nowState]'), 'the picture does not follow the category');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  // Both grids — the dock page and the dock panel — and the screen that arranges them.
  // Each drawn through the deck, which pages it.
  const grids = app.split('<DockDeck').slice(1).map((chunk) => chunk.slice(0, chunk.indexOf('/>')));
  assert.equal(grids.length, 2);
  for (const chunk of grids) assert.ok(chunk.includes('stats={(system.data as any).stats}'), 'a dock grid is not given the numbers');
  const screen = app.slice(app.indexOf('<DockActionsView'));
  assert.ok(screen.slice(0, screen.indexOf('/>')).includes('stats={(system.data as any).stats}'), 'the dock screen is not given the numbers');
  const view = fs.readFileSync(new URL('../../web/components/views/DockActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('stats={stats}'), 'the preview does not show the state');
  assert.ok(view.includes('builtin?.categories'), 'there is no picture per category to choose');
});

test('a description is held to 5000 bytes without splitting a character', () => {
  const { description, title } = sent[1].snippet;
  assert.equal(title, 'Old title', 'a description change touched the title');
  assert.ok(Buffer.byteLength(description) <= 5000);
  assert.ok(!description.includes('\uFFFD'));
});

test('the sign-in asks for the scope that can write, and the screen can ask again', () => {
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  assert.ok(hook.includes("'scope', 'https://www.googleapis.com/auth/youtube.force-ssl'"));
  assert.equal(youtube.SCOPES, 'https://www.googleapis.com/auth/youtube.force-ssl');
  const screen = fs.readFileSync(new URL('../../web/components/views/ConnectionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/youtubeAuthorised && !youtubeCanEdit/.test(screen), 'nothing asks an old sign-in to sign in again');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['youtubeStepTitle', 'youtubeStepDescription', 'youtubeNeedsEdit', 'youtubeSignInAgain', 'youtubeTitleHint', 'youtubeDescriptionHint', 'youtubeStepCategory', 'youtubeMenuCategory', 'youtubeCategoryA', 'youtubeCategoryB', 'youtubeCategoryNone', 'youtubeCategoryHint']) {
    assert.equal(strings.split(key + ':').length - 1, 2, key);
  }
});

// ------------------------------------------- YouTube says what it is doing

/*
  Driven against a stand-in for Google again. Two days: one where the daily
  allowance is spent, one where nobody is live.
*/
const realFetch2 = globalThis.fetch;
const asked = [];
let spent = true;
globalThis.fetch = async (url) => {
  const u = String(url);
  asked.push(u);
  const reply = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });
  if (spent) {
    return reply(403, { error: { message: 'The request cannot be completed because you have exceeded your quota.', errors: [{ reason: 'quotaExceeded' }] } });
  }
  if (u.includes('/channels?')) return reply(200, { items: [{ snippet: { title: 'Rowan', thumbnails: { default: { url: 'x' } } } }] });
  return reply(200, { items: [] });
};
const yt = await import('../../platforms/youtube.js');
const ytTok = collection('youtube_tokens', {});
ytTok.set({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3_600_000, scope: 'https://www.googleapis.com/auth/youtube.force-ssl' });

yt.logout();
ytTok.set({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3_600_000, scope: 'https://www.googleapis.com/auth/youtube.force-ssl' });
yt.initYouTube();
await new Promise((r) => setTimeout(r, 50));
const spentHealth = yt.getSettings().health;
const askedWhileSpent = asked.length;
yt.stop();

spent = false;
asked.length = 0;
yt.initYouTube();
await new Promise((r) => setTimeout(r, 50));
const waitingHealth = yt.getSettings().health;
yt.stop();
await yt.start();
yt.stop();
const channelReads = asked.filter((u) => u.includes('/channels?')).length;
globalThis.fetch = realFetch2;

test('a spent allowance is said plainly and waited out, not knocked on every minute', () => {
  assert.equal(spentHealth.state, 'quota', `health was ${JSON.stringify(spentHealth)}`);
  // Back after midnight in California, and not before the next minute.
  assert.ok(spentHealth.resetsAt > Date.now() + 60_000, 'it will try again before the allowance comes back');
  assert.ok(spentHealth.resetsAt - Date.now() <= 25 * 3_600_000, 'it waits longer than a day');
  assert.ok(askedWhileSpent <= 2, `it asked ${askedWhileSpent} times on a spent allowance`);
});

test('not live, it says so, looks again in three minutes, and reads the channel name once', () => {
  assert.equal(waitingHealth.state, 'waiting');
  const wait = waitingHealth.nextCheckAt - Date.now();
  assert.ok(wait > 170_000 && wait <= 180_000, `the next look is ${wait}ms away`);
  assert.equal(channelReads, 1, `the channel name was read ${channelReads} times`);
});

test('the allowance comes back at midnight in California, summer and winter', () => {
  // Summer time is seven hours behind UTC, winter eight; a minute's grace after each.
  assert.equal(new Date(yt.nextQuotaReset(Date.parse('2026-09-25T05:12:00Z'))).toISOString(), '2026-09-25T07:01:00.000Z');
  assert.equal(new Date(yt.nextQuotaReset(Date.parse('2026-12-25T05:12:00Z'))).toISOString(), '2026-12-25T08:01:00.000Z');
  // Just after the reset, the next one is a day away, not a minute.
  assert.equal(new Date(yt.nextQuotaReset(Date.parse('2026-09-25T07:30:00Z'))).toISOString(), '2026-09-26T07:01:00.000Z');
});

test('chat is read no faster than every seven seconds, and the screen says what is happening', () => {
  const src = fs.readFileSync(new URL('../platforms/youtube.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('const MIN_POLL_MS = 7000;'), 'chat is read faster than the allowance can pay for');
  assert.ok(src.includes('const WAIT_MS = 180_000;'), 'it looks for a broadcast more often than every three minutes');
  const screen = fs.readFileSync(new URL('../../web/components/views/ConnectionsView.tsx', SCRIPT_URL), 'utf8');
  for (const state of ["'reading'", "'waiting'", "'quota'"]) assert.ok(screen.includes(`health.state === ${state}`), `the screen has nothing to say for ${state}`);
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['youtubeReading', 'youtubeWaiting', 'youtubeQuota', 'youtubeQuotaBack', 'youtubeTrouble', 'youtubeLastMessage']) {
    assert.equal(strings.split(key + ':').length - 1, 2, key);
  }
});

// ------------------------------------------- TikTok looks only when OBS is live

/*
  Driven through the real module with a connection that never reaches
  TikTok: every attempt is counted and told the creator is offline.
*/
const tiktokMod = await import('../../platforms/tiktok.js');
let tiktokAttempts = 0;
tiktokMod.useConnectionFactory(() => ({
  connect: async () => { tiktokAttempts += 1; throw new Error('The requested user is not live (offline)'); },
  disconnect() {},
  on() {},
}));
const obsSays = (connected, streaming) => bus.emit(EVENTS.STATUS, {
  platform: 'obs', status: connected ? 'connected' : 'disconnected', error: null, streamStatus: { active: streaming },
});
const settleTiktok = () => new Promise((r) => setTimeout(r, 30));

// Auto-start is off here, so this only loads its settings and starts following OBS.
tiktokMod.initTikTok();
tiktokMod.setCredentials({ username: 'tester' });
await tiktokMod.connect();
await settleTiktok();
const tkNoObs = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };

obsSays(true, false);
await settleTiktok();
const tkIdle = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };

obsSays(true, true);
await settleTiktok();
const tkLive = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };

obsSays(true, false);
await settleTiktok();
const tkStopped = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };

await tiktokMod.disconnect();
obsSays(true, true);
await settleTiktok();
const tkAfterDisconnect = { status: tiktokMod.getStatus().status, attempts: tiktokAttempts };
obsSays(true, false);
await settleTiktok();
await tiktokMod.connect();
await settleTiktok();
const tkConnectObsIdle = { ...tiktokMod.getStatus().watch, status: tiktokMod.getStatus().status, attempts: tiktokAttempts };
obsSays(false, false);
await tiktokMod.disconnect();
tiktokMod.useConnectionFactory(null);

test('without OBS, TikTok is looked for on the slow timetable, as before', () => {
  assert.equal(tkNoObs.attempts, 1, 'Connect looked once, straight away');
  assert.equal(tkNoObs.mode, 'no-obs');
  const wait = tkNoObs.nextTryAt - Date.now();
  assert.ok(wait > 60_000, `the next look is only ${wait}ms away`);
});

test('OBS up and not streaming: TikTok is not looked for at all', () => {
  assert.equal(tkIdle.mode, 'obs-idle');
  assert.equal(tkIdle.nextTryAt, 0, 'a look is still scheduled');
  assert.equal(tkIdle.attempts, 1);
});

test('OBS goes live: TikTok is looked for at once, then every thirty seconds', () => {
  assert.equal(tkLive.attempts, 2, 'it did not look the moment OBS went live');
  assert.equal(tkLive.mode, 'obs-live');
  const wait = tkLive.nextTryAt - Date.now();
  assert.ok(wait > 25_000 && wait <= 30_000, `the next look is ${wait}ms away`);
});

test('OBS stops: the looking stops with it', () => {
  assert.equal(tkStopped.mode, 'obs-idle');
  assert.equal(tkStopped.attempts, 2);
});

test('and Disconnect stays disconnected, whatever OBS does next', () => {
  assert.equal(tkAfterDisconnect.attempts, 2, 'OBS going live undid Disconnect');
  assert.equal(tkAfterDisconnect.status, 'disconnected');
});

test('Connect with OBS up and not streaming: switched on and waiting, without a single look', () => {
  assert.equal(tkConnectObsIdle.attempts, 2, 'Connect looked although OBS is not streaming');
  assert.equal(tkConnectObsIdle.mode, 'obs-idle');
  assert.equal(tkConnectObsIdle.status, 'waiting');
  assert.equal(tkConnectObsIdle.nextTryAt, 0, 'a look is scheduled');
});

test('the TikTok card says what it is waiting on, in both languages', () => {
  const screen = fs.readFileSync(new URL('../../web/components/views/ConnectionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(screen.includes('<TiktokWatchLine watch={tiktokWatch} t={t} />'), 'the card does not say how TikTok is being looked for');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['tiktokObsIdle', 'tiktokObsIdleHint', 'tiktokObsLive', 'tiktokNoObs', 'tiktokNextLook']) {
    assert.equal(strings.split(key + ':').length - 1, 2, key);
  }
});


// ------------------------------------- TikTok and YouTube wait on Twitch being live

const twitchSays = (live) => bus.emit(EVENTS.STAT, { key: 'twitchLive', value: live });
const twitchGone = () => bus.emit(EVENTS.STATUS, { platform: 'twitch', status: 'disconnected', detail: { main: 'disconnected', bot: 'disconnected', eventsub: 'disconnected' } });

// YouTube: with Twitch not live it asks Google nothing at all; live, it looks at once and every minute.
const realFetch3 = globalThis.fetch;
const asked3 = [];
let ytLive = false;
globalThis.fetch = async (url) => {
  const u = String(url);
  asked3.push(u);
  const reply = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });
  if (u.includes('/channels?')) return reply(200, { items: [{ snippet: { title: 'Rowan', thumbnails: { default: { url: 'x' } } } }] });
  if (u.includes('/liveBroadcasts?')) return reply(200, { items: ytLive ? [{ id: 'v1', snippet: { liveChatId: 'c1' } }] : [] });
  if (u.includes('/liveChat/messages?')) return reply(200, { items: [], pollingIntervalMillis: 7000 });
  return reply(200, { items: [] });
};
yt.stop();

// TikTok: with Twitch known, Twitch decides; OBS no longer does.
tiktokAttempts = 0;
tiktokMod.useConnectionFactory(() => ({
  connect: async () => { tiktokAttempts += 1; throw new Error('The requested user is not live (offline)'); },
  disconnect() {},
  on() {},
}));
twitchSays(false);
await tiktokMod.connect();
await settleTiktok();
const tkTwitchIdle = { ...tiktokMod.getStatus().watch, status: tiktokMod.getStatus().status, attempts: tiktokAttempts };
obsSays(true, true);
await settleTiktok();
const tkObsLiveTwitchNot = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
twitchSays(true);
await settleTiktok();
const tkTwitchLive = { ...tiktokMod.getStatus().watch, status: tiktokMod.getStatus().status, attempts: tiktokAttempts };
twitchSays(true);
await settleTiktok();
const tkStillLive = { attempts: tiktokAttempts };
twitchSays(false);
await settleTiktok();
const tkTwitchStopped = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
twitchGone();
await settleTiktok();
const tkTwitchGone = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
obsSays(false, false);
await tiktokMod.disconnect();
tiktokMod.useConnectionFactory(null);

test('Twitch not live: TikTok is not looked for, even with OBS streaming, and says it is waiting, not polling', () => {
  assert.equal(tkTwitchIdle.mode, 'twitch-idle');
  assert.equal(tkTwitchIdle.status, 'waiting');
  assert.equal(tkTwitchIdle.nextTryAt, 0, 'a look is still scheduled');
  assert.equal(tkObsLiveTwitchNot.mode, 'twitch-idle', 'OBS going live started the looking');
  assert.equal(tkTwitchIdle.attempts, 0, 'Connect looked although Twitch is not live');
  assert.equal(tkObsLiveTwitchNot.attempts, 0, 'OBS going live made it look');
});

test('Twitch goes live: TikTok is looked for at once, then every thirty seconds; saying so again changes nothing', () => {
  assert.equal(tkTwitchLive.attempts, 1, 'it did not look the moment Twitch went live');
  assert.equal(tkTwitchLive.mode, 'twitch-live');
  assert.equal(tkTwitchLive.status, 'polling', 'looking is polling');
  const wait = tkTwitchLive.nextTryAt - Date.now();
  assert.ok(wait > 25_000 && wait <= 30_000, `the next look is ${wait}ms away`);
  assert.equal(tkStillLive.attempts, 1, 'the minute\'s live check made it look again');
});

test('Twitch stops: TikTok stops looking; Twitch disconnected: OBS decides again, as before', () => {
  assert.equal(tkTwitchStopped.mode, 'twitch-idle');
  assert.equal(tkTwitchStopped.nextTryAt, 0);
  assert.equal(tkTwitchGone.mode, 'obs-live', 'with Twitch gone, OBS streaming should have it looking');
});

twitchSays(false);
yt.stop();
asked3.length = 0;
yt.initYouTube();
await new Promise((r) => setTimeout(r, 50));
const ytPaused = { health: yt.getSettings().health, asked: asked3.length };
twitchSays(true);
await new Promise((r) => setTimeout(r, 80));
const ytLooking = { health: yt.getSettings().health, broadcastLooks: asked3.filter((u) => u.includes('/liveBroadcasts?')).length };
// The broadcast starts; then Twitch stops — the chat is read on through the grace.
ytLive = true;
yt.stop();
await yt.start();
twitchSays(false);
await new Promise((r) => setTimeout(r, 50));
const ytReadingAfterTwitchStops = yt.getSettings().health.state;
yt.stop();
const chatReadsBefore = asked3.filter((u) => u.includes('/liveChat/messages?')).length;
twitchSays(true);
await Promise.all([yt.start(), yt.start()]);
const chatReadsTwice = asked3.filter((u) => u.includes('/liveChat/messages?')).length - chatReadsBefore;
yt.stop();
// Waiting on Twitch, and then Twitch is gone altogether.
ytLive = false;
twitchSays(false);
await new Promise((r) => setTimeout(r, 50));
twitchGone();
await new Promise((r) => setTimeout(r, 80));
const ytTwitchGone = yt.getSettings().health;
yt.stop();
// A sign-in Google has taken back, with Twitch not live: the trouble is said, not covered by "waiting".
const revoked = async (url) => (String(url).includes('oauth2') ? { ok: false, status: 400, json: async () => ({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }) } : realFetch3(url));
globalThis.fetch = revoked;
ytTok.set({ accessToken: 'a', refreshToken: 'r', expiresAt: 0, scope: 'https://www.googleapis.com/auth/youtube.force-ssl' });
await yt.start().catch(() => {});
twitchSays(false);
await new Promise((r) => setTimeout(r, 50));
const ytRevoked = { health: yt.getSettings().health, status: yt.getStatus() };
yt.stop();
twitchGone();
await new Promise((r) => setTimeout(r, 50));
yt.stop();
ytTok.set({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3_600_000, scope: 'https://www.googleapis.com/auth/youtube.force-ssl' });
globalThis.fetch = realFetch3;

test('Twitch not live: YouTube looks for nothing and spends no allowance, and says it is waiting on Twitch', () => {
  assert.equal(ytPaused.health.state, 'paused');
  assert.equal(ytPaused.asked, 0, `it asked Google ${ytPaused.asked} times`);
});

test('Twitch goes live: YouTube looks at once, then every minute while the stream is young', () => {
  assert.ok(ytLooking.broadcastLooks >= 1, 'it did not look when Twitch went live');
  assert.equal(ytLooking.health.state, 'waiting', JSON.stringify(ytLooking.health));
  const wait = ytLooking.health.nextCheckAt - Date.now();
  assert.ok(wait > 50_000 && wait <= 60_000, `the next look is ${wait}ms away`);
});

test('reading chat when Twitch stops, it reads on for the grace; Twitch disconnected, it looks as before', () => {
  assert.equal(ytReadingAfterTwitchStops, 'reading', 'Twitch stopping cut the chat off at once');
  const src = fs.readFileSync(new URL('../platforms/youtube.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('const TWITCH_GRACE_MS = 5 * 60_000;'));
  assert.equal(ytTwitchGone.state, 'waiting', `health was ${JSON.stringify(ytTwitchGone)}`);
  const wait = ytTwitchGone.nextCheckAt - Date.now();
  assert.ok(wait > 170_000 && wait <= 180_000, `the next look is ${wait}ms away`);
});

test('a sign-in Google took back stays said while waiting on Twitch, rather than looking connected', () => {
  assert.equal(ytRevoked.health.state, 'error', JSON.stringify(ytRevoked));
  assert.match(ytRevoked.health.message, /expired or revoked/);
  assert.equal(ytRevoked.status, 'disconnected');
});

test('two starts at once — Twitch going live while a look is under way — read the chat once, not twice', () => {
  assert.equal(chatReadsTwice, 1, `the chat was read ${chatReadsTwice} times`);
});

test('the Twitch stream starting and ending are heard the moment they happen, and the screen says what TikTok and YouTube wait on', () => {
  const twitch = fs.readFileSync(new URL('../platforms/twitch.js', SCRIPT_URL), 'utf8');
  assert.ok(twitch.includes("['stream.online', '1'") && twitch.includes("['stream.offline', '1'"));
  const screen = fs.readFileSync(new URL('../../web/components/views/ConnectionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(screen.includes("watch.mode === 'twitch-idle'") && screen.includes("health.state === 'paused'"));
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['youtubePaused', 'youtubePausedHint', 'tiktokTwitchIdle', 'tiktokTwitchIdleHint', 'tiktokTwitchLive']) {
    assert.equal(strings.split(key + ':').length - 1, 2, key);
  }
});
