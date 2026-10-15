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


// ------------------- YouTube waits on Twitch being live; TikTok on it without OBS

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

// TikTok: with OBS connected, OBS decides; without OBS, Twitch being live does.
tiktokAttempts = 0;
tiktokMod.useConnectionFactory(() => ({
  connect: async () => { tiktokAttempts += 1; throw new Error('The requested user is not live (offline)'); },
  disconnect() {},
  on() {},
}));
obsSays(false, false);
twitchSays(false);
await tiktokMod.connect();
await settleTiktok();
const tkTwitchIdle = { ...tiktokMod.getStatus().watch, status: tiktokMod.getStatus().status, attempts: tiktokAttempts };
twitchSays(true);
await settleTiktok();
const tkTwitchLive = { ...tiktokMod.getStatus().watch, status: tiktokMod.getStatus().status, attempts: tiktokAttempts };
twitchSays(true);
await settleTiktok();
const tkStillLive = { attempts: tiktokAttempts };
obsSays(true, false);
await settleTiktok();
const tkObsIdleTwitchLive = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
twitchSays(false);
twitchSays(true);
await settleTiktok();
const tkTwitchAgainObsIdle = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
obsSays(true, true);
await settleTiktok();
const tkObsLive = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
twitchSays(false);
await settleTiktok();
const tkObsLiveTwitchNot = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
obsSays(false, false);
await settleTiktok();
const tkObsGone = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
twitchGone();
await settleTiktok();
const tkTwitchGone = { ...tiktokMod.getStatus().watch, attempts: tiktokAttempts };
await tiktokMod.disconnect();
tiktokMod.useConnectionFactory(null);

test('without OBS, Twitch decides: not live, TikTok is not looked for and says it is waiting, not polling', () => {
  assert.equal(tkTwitchIdle.mode, 'twitch-idle');
  assert.equal(tkTwitchIdle.status, 'waiting');
  assert.equal(tkTwitchIdle.nextTryAt, 0, 'a look is still scheduled');
  assert.equal(tkTwitchIdle.attempts, 0, 'Connect looked although Twitch is not live');
});

test('without OBS, Twitch goes live: TikTok is looked for at once, then every thirty seconds; saying so again changes nothing', () => {
  assert.equal(tkTwitchLive.attempts, 1, 'it did not look the moment Twitch went live');
  assert.equal(tkTwitchLive.mode, 'twitch-live');
  assert.equal(tkTwitchLive.status, 'polling', 'looking is polling');
  const wait = tkTwitchLive.nextTryAt - Date.now();
  assert.ok(wait > 25_000 && wait <= 30_000, `the next look is ${wait}ms away`);
  assert.equal(tkStillLive.attempts, 1, 'the minute\'s live check made it look again');
});

test('OBS connected decides over Twitch: not streaming, no looking even with Twitch live; streaming, looking even with Twitch not', () => {
  assert.equal(tkObsIdleTwitchLive.mode, 'obs-idle', 'Twitch live kept it looking with OBS not streaming');
  assert.equal(tkObsIdleTwitchLive.nextTryAt, 0);
  assert.equal(tkTwitchAgainObsIdle.attempts, tkObsIdleTwitchLive.attempts, 'Twitch going live made it look with OBS not streaming');
  assert.equal(tkObsLive.mode, 'obs-live');
  assert.equal(tkObsLive.attempts, tkObsIdleTwitchLive.attempts + 1, 'it did not look the moment OBS went live');
  assert.equal(tkObsLiveTwitchNot.mode, 'obs-live', 'Twitch stopping stopped the looking while OBS streams');
  assert.equal(tkObsGone.mode, 'twitch-idle', 'with OBS gone, Twitch should decide again');
  assert.equal(tkTwitchGone.mode, 'no-obs', 'with neither, the slow looking');
});

// TikTok: one connection at a time, and only the one kept speaks.
const tkChats = [];
const tkOnChat = (c) => { if (c.platform === 'tiktok') tkChats.push(c.msg); };
bus.on(EVENTS.CHAT, tkOnChat);
const tkMade = [];
let tkDelay = 40;
tiktokMod.useConnectionFactory(() => {
  const handlers = {};
  const conn = {
    closed: false,
    connect: () => new Promise((r) => setTimeout(() => r({ roomId: 'r1' }), tkDelay)),
    disconnect: async () => { conn.closed = true; },
    on: (event, fn) => { (handlers[event] ||= []).push(fn); },
    say: (event, d) => { for (const fn of handlers[event] || []) fn(d); },
  };
  tkMade.push(conn);
  return conn;
});
const tkChat = (conn, id, text) => conn.say('chat', { common: { msgId: id }, user: { uniqueId: 'tk-ana', nickname: 'AnaTk' }, content: text });
obsSays(true, true);
await settleTiktok();
// Connect pressed twice, while OBS going live also looks: one attempt, one connection.
await Promise.all([tiktokMod.connect(), tiktokMod.connect()]);
await new Promise((r) => setTimeout(r, 80));
const tkKept = tkMade.filter((c) => !c.closed);
const tkStatusAfterTwo = tiktokMod.getStatus().status;
tkKept.forEach((c) => tkChat(c, 'm1', 'hola tiktok'));
tkKept.forEach((c) => tkChat(c, 'm1', 'hola tiktok'));
tkKept.forEach((c) => tkChat(c, 'm2', 'segundo'));
const tkHeardOnce = tkChats.slice();
// Connect again: the new connection is kept, and the one it replaced, heard until now, says nothing more.
await tiktokMod.connect();
await new Promise((r) => setTimeout(r, 80));
const tkReplaced = tkKept[0];
if (tkReplaced) tkChat(tkReplaced, 'm3', 'fantasma');
const tkGhostHeard = tkChats.includes('fantasma');
const tkWas = tkMade.filter((c) => !c.closed)[0];
if (tkWas) tkChat(tkWas, 'm3b', 'el nuevo');
const tkNewHeard = tkChats.includes('el nuevo');
// Disconnect: the connection kept says nothing more, and stays let go.
await tiktokMod.disconnect();
if (tkWas) tkChat(tkWas, 'm4', 'despues de desconectar');
const tkAfterDisconnectHeard = tkChats.includes('despues de desconectar');
// Disconnect while an attempt is under way: it is not kept when it arrives.
tkDelay = 60;
const tkMadeBefore = tkMade.length;
const tkInFlight = tiktokMod.connect();
await new Promise((r) => setTimeout(r, 10));
await tiktokMod.disconnect();
await tkInFlight;
await new Promise((r) => setTimeout(r, 80));
const tkLateOne = tkMade[tkMadeBefore];
const tkLateStatus = tiktokMod.getStatus().status;
if (tkLateOne) tkChat(tkLateOne, 'm5', 'llego tarde');
const tkLateHeard = tkChats.includes('llego tarde');
// Connect while an earlier attempt is still under way after a Disconnect: the new one counts.
tkDelay = 40;
const tkMadeBefore2 = tkMade.length;
const tkOld = tiktokMod.connect();
await new Promise((r) => setTimeout(r, 5));
await tiktokMod.disconnect();
await tiktokMod.connect();
await tkOld;
await new Promise((r) => setTimeout(r, 80));
const tkReconnected = { status: tiktokMod.getStatus().status, made: tkMade.length - tkMadeBefore2, open: tkMade.slice(tkMadeBefore2).filter((c) => !c.closed).length };
await tiktokMod.disconnect();
obsSays(false, false);
bus.off?.(EVENTS.CHAT, tkOnChat);
tiktokMod.useConnectionFactory(null);

test('TikTok keeps one connection: Connect twice makes one, and each message is heard once', () => {
  assert.equal(tkKept.length, 1, `${tkKept.length} connections were kept`);
  assert.equal(tkStatusAfterTwo, 'connected');
  assert.deepEqual(tkHeardOnce, ['hola tiktok', 'segundo'], 'a message was heard twice, or not at all');
  assert.equal(tkReplaced?.closed, true, 'the replaced connection was not closed');
  assert.equal(tkGhostHeard, false, 'a connection replaced by Connect was still heard');
  assert.equal(tkNewHeard, true, 'the new connection was not heard');
});

test('Disconnect is the end of it: the old connection is not heard, and one arriving late is not kept', () => {
  assert.equal(tkAfterDisconnectHeard, false, 'TikTok chat still came in after Disconnect');
  assert.ok(tkLateOne, 'no attempt was made');
  assert.equal(tkLateOne.closed, true, 'an attempt that arrived after Disconnect was kept');
  assert.equal(tkLateStatus, 'disconnected');
  assert.equal(tkLateHeard, false, 'an attempt that arrived after Disconnect was heard');
});

test('Connect after a Disconnect is not held up by an attempt from before it', () => {
  assert.equal(tkReconnected.status, 'connected', 'the earlier attempt kept Connect from connecting');
  assert.equal(tkReconnected.made, 2);
  assert.equal(tkReconnected.open, 1, 'not exactly one connection is open');
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
const chatStreamsBefore = asked3.filter((u) => u.includes('/liveChat/messages/stream?')).length;
twitchSays(true);
await Promise.all([yt.start(), yt.start()]);
const chatReadsTwice = asked3.filter((u) => u.includes('/liveChat/messages?')).length - chatReadsBefore;
const chatStreamsTwice = asked3.filter((u) => u.includes('/liveChat/messages/stream?')).length - chatStreamsBefore;
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
  assert.equal(chatStreamsTwice, 1, `${chatStreamsTwice} streams were opened`);
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

// ------------------------------------- YouTube chat as it is sent, not looked at every seven seconds

const ytStream = await import('../../platforms/youtube-stream.js');

// The array arrives in pieces, cut anywhere: inside a string, after an escape, between elements.
const streamedItems = [];
const feedIt = ytStream.streamedArray((v) => streamedItems.push(v));
const whole = '[{"items":[{"snippet":{"displayMessage":"a \\"quoted\\" {brace} ]"}}],"nextPageToken":"t1"}\r\n,{"items":[],"nextPageToken":"t2"}\r\n';
for (let i = 0; i < whole.length; i += 7) feedIt(whole.slice(i, i + 7));
let notAStream = null;
try { ytStream.streamedArray(() => {})('{"items":[]}'); } catch (err) { notAStream = err.reason; }
let refusedInStream = null;
try {
  await ytStream.readChatStream({
    url: 'x', token: 't', onResponse: () => {},
    fetchImpl: async () => ({ ok: true, status: 200, body: (async function* () { yield '[{"error":{"code":403,"message":"quota","errors":[{"reason":"quotaExceeded"}]}}]'; })() }),
  });
} catch (err) { refusedInStream = err.reason; }

test('a streamed chat is read element by element, however it is cut, and what is not a stream or a refusal is said', () => {
  assert.equal(streamedItems.length, 2, `${streamedItems.length} elements came out`);
  assert.equal(streamedItems[0].items[0].snippet.displayMessage, 'a "quoted" {brace} ]');
  assert.equal(streamedItems[1].nextPageToken, 't2');
  assert.equal(notAStream, 'notAStream');
  assert.equal(refusedInStream, 'quotaExceeded');
  // Typed as the proto names them, read as the list names them.
  assert.equal(ytStream.asListed({ snippet: { type: 'TEXT_MESSAGE_EVENT' } }).snippet.type, 'textMessageEvent');
  assert.equal(ytStream.asListed({ snippet: { type: 'superChatEvent' } }).snippet.type, 'superChatEvent');
});

// Driven through the real module: a live broadcast, its chat streamed. Its waits made short for the test.
yt.setStreamTimingForTests({ backoffMs: 20, settleMs: 0, idleMs: 250 });
const ytStreamAsked = [];
const ytHeard = [];
const ytOnChat = (c) => { if (c.platform === 'youtube') ytHeard.push(c.msg); };
bus.on(EVENTS.CHAT, ytOnChat);
let ytStreamMode = 'stream';
let ytConnections = 0;
const textItem = (id, text, at) => ({ id, snippet: { type: 'TEXT_MESSAGE_EVENT', displayMessage: text, publishedAt: new Date(at).toISOString(), textMessageDetails: { messageText: text } }, authorDetails: { channelId: `UC-${id}`, displayName: `Viewer ${id}` } });
const until = async (ok, ms = 3000) => { const end = Date.now() + ms; while (!ok() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); return ok(); };
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  ytStreamAsked.push(u);
  const reply = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });
  if (u.includes('/channels?')) return reply(200, { items: [{ snippet: { title: 'Rowan', thumbnails: { default: { url: 'x' } } } }] });
  if (u.includes('/liveBroadcasts?')) return reply(200, { items: [{ id: 'v9', snippet: { liveChatId: 'c9' } }] });
  if (u.includes('/liveChat/messages/stream?')) {
    ytConnections += 1;
    const n = ytConnections;
    if (ytStreamMode === 'missing') return reply(404, { error: { code: 404, message: 'Not Found', errors: [{ reason: 'notFound' }] } });
    // The network failing once: a moment's trouble, not a reason to stop streaming.
    if (ytStreamMode === 'hiccup' && n === 1) throw new TypeError('fetch failed');
    const now = Date.now();
    const first = n === 1 || (ytStreamMode === 'hiccup' && n === 2);
    const items = first ? [textItem('old', 'said before', now - 60_000), textItem('n1', 'hola youtube', now)] : [textItem('n1', 'hola youtube', now), textItem(`n${n}`, `again ${n}`, now)];
    return {
      ok: true,
      status: 200,
      body: (async function* () {
        yield `[${JSON.stringify({ items, nextPageToken: `p${n}` })}`;
        // Quiet: open, saying nothing more, until it is closed for being quiet.
        if (ytStreamMode === 'quiet') await new Promise((resolve, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
      })(),
    };
  }
  if (u.includes('/liveChat/messages?')) return reply(200, { items: [], pollingIntervalMillis: 7000, nextPageToken: 'poll' });
  return reply(200, { items: [] });
};
const streamUrls = () => ytStreamAsked.filter((u) => u.includes('/liveChat/messages/stream?'));
const looks = () => ytStreamAsked.filter((u) => u.includes('/liveChat/messages?')).length;
twitchSays(true);
yt.stop();
await yt.start();
await until(() => streamUrls().length >= 2);
const ytStreamHealth = yt.getSettings().health;
const ytStreamUrls = streamUrls();
// YouTube closing it within moments, time after time: back to looking.
await until(() => yt.getSettings().health.streaming === false);
const ytAfterQuickEnds = { health: yt.getSettings().health, looked: looks(), connections: ytConnections };
// What this one broadcast's stream was heard to say (the runs after are broadcasts of their own).
const ytHeardFirst = ytHeard.slice();
yt.stop();
// A stream refused outright: looking at once.
const runMode = async (mode, settle) => {
  ytStreamMode = mode; ytConnections = 0; ytStreamAsked.length = 0;
  await yt.start();
  await settle();
  const out = { health: yt.getSettings().health, looked: looks(), connections: ytConnections, urls: streamUrls() };
  yt.stop();
  return out;
};
const ytRefusedStream = await runMode('missing', () => until(() => looks() >= 1));
// The network failing once: opened again, still streaming.
const ytHiccup = await runMode('hiccup', () => until(() => ytConnections >= 2).then(() => new Promise((r) => setTimeout(r, 30))));
// Quiet for too long: closed and opened again from where it was, not counted as trouble.
const ytQuiet = await runMode('quiet', () => until(() => ytConnections >= 4, 5000));
bus.off?.(EVENTS.CHAT, ytOnChat);
globalThis.fetch = realFetch3;
yt.setStreamTimingForTests({ backoffMs: 2000, settleMs: 1500, idleMs: 120_000 });
twitchSays(false);

test('YouTube chat is streamed: new messages heard once, what came before skipped, picked up again where it left off', () => {
  assert.ok(ytStreamUrls.length >= 2, `${ytStreamUrls.length} connections`);
  assert.ok(ytHeard.includes('hola youtube'), `heard ${JSON.stringify(ytHeard)}`);
  assert.ok(!ytHeard.includes('said before'), 'what was said before the stream started came through as new');
  // Sent again on the next connection: still heard once.
  assert.equal(ytHeardFirst.filter((m) => m === 'hola youtube').length, 1, `a message was heard twice: ${JSON.stringify(ytHeardFirst)}`);
  assert.ok(ytStreamUrls[1].includes('pageToken=p1'), 'the second connection did not carry on from the first');
  assert.equal(ytStreamHealth.streaming, true);
});

test('closed within moments again and again, or refused, it goes back to looking; a hiccup or a quiet chat does not', () => {
  assert.equal(ytAfterQuickEnds.health.streaming, false, JSON.stringify(ytAfterQuickEnds));
  assert.ok(ytAfterQuickEnds.looked >= 1, 'it did not look at the chat after giving up on the stream');
  assert.ok(ytAfterQuickEnds.connections <= 4, `it kept reconnecting: ${ytAfterQuickEnds.connections} connections`);
  assert.equal(ytRefusedStream.health.streaming, false);
  assert.ok(ytRefusedStream.looked >= 1, 'a refused stream did not fall back to looking');
  assert.equal(ytHiccup.health.streaming, true, `one network failure gave up on streaming: ${JSON.stringify(ytHiccup.health)}`);
  assert.equal(ytHiccup.looked, 0, 'one network failure made it look instead');
  assert.equal(ytQuiet.health.streaming, true, 'a quiet chat gave up on streaming');
  assert.equal(ytQuiet.looked, 0, 'a quiet chat made it look instead');
  assert.ok(ytQuiet.urls[1]?.includes('pageToken=p1'), 'a quiet connection was not opened again from where it was');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  assert.equal(strings.split('    youtubeAsSent: ').length - 1, 2, 'youtubeAsSent is not in both languages');
});
