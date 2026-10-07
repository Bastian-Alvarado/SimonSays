/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: posting in YouTube chat — from the dock's box and from an
 * action's chat step — and the day's allowance it is spent from.
 *
 * A message costs 50 units of YouTube's 10,000 a day, ten reads of chat, so
 * what is spent is counted and shown, and a message the day cannot cover is
 * refused before it is sent. YouTube is played by a stand-in that answers the
 * way it does; nothing leaves the machine.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After
 * youtube-and-tiktok.js, which set the YouTube module up.
 */

import { SCRIPT_URL, assert, bus, collection, EVENTS, fs, test } from './harness.js';

const yt = await import('../../platforms/youtube.js');
const { chatDestination } = await import('../../engine/steps.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

const tokens = collection('youtube_tokens', {});
const usage = collection('youtube_usage', { day: '', units: 0 });
const FORCE_SSL = 'https://www.googleapis.com/auth/youtube.force-ssl';

const posts = [];
const realFetch = globalThis.fetch;
const reply = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (init.method === 'POST' && u.includes('/liveChat/messages')) {
    const body = JSON.parse(init.body);
    posts.push(body);
    return reply({ id: `sent${posts.length}`, snippet: body.snippet });
  }
  if (u.includes('/channels?')) return reply({ items: [{ snippet: { title: 'I_Am_Streamer', thumbnails: { default: { url: 'https://x/a.png' } } } }] });
  if (u.includes('/liveBroadcasts?') && u.includes('broadcastStatus=active')) return reply({ items: [{ id: 'vid1', snippet: { liveChatId: 'chat1' } }] });
  if (u.includes('/liveChat/messages?')) return reply({ items: [], nextPageToken: 'p1', pollingIntervalMillis: 60_000 });
  if (u.includes('/videos?')) return reply({ items: [{ snippet: { categoryId: '20' }, liveStreamingDetails: { concurrentViewers: '3' } }] });
  return reply({ items: [] });
};

const chats = [];
const listen = (c) => { if (c.platform === 'youtube') chats.push(c); };
bus.on(EVENTS.CHAT, listen);
const refused = async (fn) => { try { await fn(); return null; } catch (err) { return err; } };

yt.stop();
tokens.set({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3_600_000, scope: FORCE_SSL });
usage.set({ day: yt.youtubeDay(), units: 0 });
const notLiveYet = await refused(() => yt.say('hola'));
await yt.start();
const liveSettings = yt.getSettings();
const usedBefore = yt.usageToday().used;

await yt.say('  hola   chat  ');
const echo = chats.at(-1);
const echoes = chats.length;
// The same message coming back on the next read of chat, and somebody else's.
yt.handleMessage({ id: 'sent1', snippet: { type: 'textMessageEvent', displayMessage: 'hola chat' }, authorDetails: { displayName: 'I_Am_Streamer', isChatOwner: true } });
const afterOwnCopy = chats.length;
yt.handleMessage({ id: 'viewer1', snippet: { type: 'textMessageEvent', displayMessage: 'hola!' }, authorDetails: { displayName: 'Ana' } });
const afterViewer = chats.length;
const usedAfterOne = yt.usageToday().used;

const tooLong = await refused(() => yt.say('x'.repeat(250)));
await yt.say('y'.repeat(250), { cut: true });
await yt.say('to both', { sentToBoth: true });
const bothEcho = chats.at(-1);
// The relay's copy of a Discord message: posted, but not shown — the Discord message already is.
const shownBeforeQuiet = chats.length;
const postedBeforeQuiet = posts.length;
await yt.say('[Discord] Ana: hola', { quiet: true });
const quietShown = chats.length - shownBeforeQuiet;
const quietPosted = posts.length - postedBeforeQuiet;

// The day nearly spent: refused before anything is sent.
usage.set({ day: yt.youtubeDay(), units: 9_980 });
const postsBeforeQuota = posts.length;
const outOfAllowance = await refused(() => yt.say('one more'));
const postsAfterQuota = posts.length;
const left = yt.usageToday();

// A sign-in that can only read.
tokens.set({ ...tokens.get(), scope: 'https://www.googleapis.com/auth/youtube.readonly' });
usage.set({ day: yt.youtubeDay(), units: 0 });
const readOnly = await refused(() => yt.say('hola'));
tokens.set({ ...tokens.get(), scope: FORCE_SSL });

yt.stop();
const afterStop = await refused(() => yt.say('hola'));
bus.off(EVENTS.CHAT, listen);
globalThis.fetch = realFetch;
tokens.set({ accessToken: '', refreshToken: '', expiresAt: 0 });
usage.set({ day: '', units: 0 });

test('a message goes to the live chat being read, and shows at once', () => {
  assert.equal(liveSettings.live, true, 'the screens are not told there is a chat to post in');
  assert.deepEqual(posts[0], { snippet: { liveChatId: 'chat1', type: 'textMessageEvent', textMessageDetails: { messageText: 'hola chat' } } });
  assert.equal(echo?.msg, 'hola chat');
  assert.equal(echo.isBroadcaster, true);
  // The channel's name as the module read it (once, by the file before this one).
  assert.equal(echo.user, liveSettings.channel?.title, 'not as the channel');
  assert.equal(echo.id, 'sent1');
  assert.equal(afterOwnCopy, echoes, 'the copy that came back on the next read was shown again');
  assert.equal(afterViewer, echoes + 1, 'a viewer\'s message after it was lost');
});

test('what a message costs is counted, and one the day cannot cover is refused before it goes', () => {
  assert.equal(yt.unitsFor('POST', '/liveChat/messages?part=snippet'), 50);
  assert.equal(yt.unitsFor('GET', '/liveChat/messages?liveChatId=x'), 5);
  assert.equal(yt.unitsFor('PUT', '/videos?part=snippet'), 50);
  assert.equal(yt.unitsFor('GET', '/videos?part=snippet'), 1);
  assert.equal(usedAfterOne - usedBefore, 50, 'a message was not counted as 50');
  assert.equal(outOfAllowance?.code, 'youtube_quota', outOfAllowance?.message);
  assert.equal(postsAfterQuota, postsBeforeQuota, 'a message the day could not cover was sent anyway');
  assert.equal(left.messagesLeft, 0);
  assert.match(yt.youtubeDay(Date.parse('2026-10-03T06:00:00Z')), /^2026-10-02$/, 'not California\'s day');
});

test('too long is refused from the dock and trimmed for an action; not live and read-only say why', () => {
  assert.equal(tooLong?.code, 'youtube_too_long');
  const cut = posts.find((p) => p.snippet.textMessageDetails.messageText.startsWith('yyy')).snippet.textMessageDetails.messageText;
  assert.equal(Array.from(cut).length, 200, 'trimmed past YouTube\'s limit, or not at all');
  assert.ok(cut.endsWith('…'));
  assert.equal(notLiveYet?.code, 'youtube_not_live');
  assert.equal(afterStop?.code, 'youtube_not_live');
  assert.equal(readOnly?.code, 'youtube_sign_in_again', 'a sign-in that cannot write was not told to sign in again');
  assert.equal(bothEcho?.raw?.sentToBoth, true, 'a message sent to both does not say so, and its command would run twice');
  assert.equal(quietPosted, 1, 'the relay\'s message was not posted');
  assert.equal(quietShown, 0, 'the relay\'s message was shown twice');
});

test('a chat step goes where it is told — and, asked, where what set it off came from', () => {
  assert.equal(chatDestination(undefined, {}), 'twitch', 'a step saved before the choice no longer goes to Twitch');
  assert.equal(chatDestination('youtube', {}), 'youtube');
  assert.equal(chatDestination('both', {}), 'both');
  assert.equal(chatDestination('origin', { user: { platform: 'youtube' } }), 'youtube');
  assert.equal(chatDestination('origin', { user: { platform: 'twitch' } }), 'twitch');
  assert.equal(chatDestination('origin', {}), 'twitch', 'an event with no chat behind it is answered nowhere');
  const steps = read('../engine/steps.js');
  assert.ok(steps.includes('await youtube.say(text, { cut: true });'), 'an action\'s message to YouTube is not trimmed to fit');
  const engine = read('../engine/index.js');
  assert.ok(engine.includes('if (chat.raw?.sentToBoth) return;'), 'a command sent to both runs twice');
});

test('the dock can send to YouTube or both, and an action can answer a YouTube viewer on YouTube', () => {
  const ws = read('../api/ws.js');
  assert.ok(ws.includes("if (to === 'youtube') { await youtube.say(payload.text); return reply({ ok: true }); }"));
  assert.ok(ws.includes("youtube.say(payload.text, { sentToBoth: true })"), 'both does not go to YouTube');
  const app = read('../../web/App.tsx');
  assert.equal(app.split('<SendToPicker').length - 1, 2, 'both send boxes should offer where to send');
  assert.ok(app.includes('if (res?.failed)'), 'one of the two failing goes unsaid');
  const dockView = read('../../web/components/views/ChatDockView.tsx');
  assert.ok(dockView.includes('{sendToPicker}'));
  const actions = read('../../web/components/views/ActionsView.tsx');
  assert.ok(actions.includes('data-chat-step-to') && actions.includes("['origin', t.chatStepOrigin || 'Where it came from']"));
  const strings = read('../../web/constants.ts');
  for (const key of ['sendTo', 'sendToBoth', 'sendToYoutubeLeft', 'sendToYoutubeNotLive', 'sendPartly', 'chatStepSendTo', 'chatStepOrigin', 'chatStepYoutubeHint']) {
    assert.equal(strings.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
});
