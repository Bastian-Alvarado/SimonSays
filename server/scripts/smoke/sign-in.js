/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Sign-in (2.0.0, server/api/auth.js): who is on the other end of the HTTP
 * API and the live connection, and what each may ask.
 *
 * A real server on a free port and real sockets; only Twitch is a stand-in,
 * answering for a streamer, a moderator, a viewer and a token made for
 * another app.
 */

import { WebSocket } from 'ws';
import { SCRIPT_URL, assert, collection, engine, fs, test } from './harness.js';

const auth = await import('../../api/auth.js');
const twitch = await import('../../platforms/twitch.js');
const { createHttpServer } = await import('../../api/http.js');
const { initWebSocket, closeWebSocket, mayAsk } = await import('../../api/ws.js');
const { C2S, S2C } = await import('../../../shared/protocol.js');
const { EXCLUDED } = await import('../../engine/backup.js');
const { config } = await import('../../config.js');
const twitchMod = await import('../../engine/twitch-mod.js');
const modActivity = await import('../../engine/mod-activity.js');
const read = (rel) => fs.readFileSync(new URL(rel, SCRIPT_URL), 'utf8');

// What the snapshot a connection is sent reads from, with nothing connecting (AUTO_START is off).
for (const name of ['obs', 'tiktok', 'spotify', 'youtube', 'tts', 'droidcam']) {
  const mod = await import(`../../platforms/${name}.js`);
  ({ obs: mod.initObs, tiktok: mod.initTikTok, spotify: mod.initSpotify, youtube: mod.initYouTube, tts: mod.initTts, droidcam: mod.initDroidcam })[name]();
}
twitch.initTwitch();
// The Twitch account as earlier files left it, put back at the end.
const twitchBefore = structuredClone(collection('twitch_credentials').get());
twitch.setCredentials({ clientId: 'app-1', userId: '100', login: 'streamer', channel: 'streamer' });
auth.initAuth();

// ------------------------------------------------------------ Twitch, stood in

const TOKENS = {
  'tok-owner': { client_id: 'app-1', user_id: '100', login: 'streamer', scopes: [] },
  'tok-mod': { client_id: 'app-1', user_id: '200', login: 'modone', scopes: [...auth.SIGN_IN_SCOPES] },
  'tok-viewer': { client_id: 'app-1', user_id: '300', login: 'viewer', scopes: ['user:read:moderated_channels'] },
  'tok-noscope': { client_id: 'app-1', user_id: '200', login: 'modone', scopes: [] },
  'tok-other': { client_id: 'some-other-app', user_id: '100', login: 'streamer', scopes: [] },
};
const moderated = { 200: [{ broadcaster_id: '100' }], 300: [{ broadcaster_id: '999' }] };
const answer = (status, body) => ({ ok: status < 300, status, json: async () => body });
async function twitchStandIn(url, init = {}) {
  const u = new URL(String(url));
  const token = String(init.headers?.Authorization || '').replace(/^(OAuth|Bearer)\s+/, '');
  if (u.pathname === '/oauth2/validate') return TOKENS[token] ? answer(200, TOKENS[token]) : answer(401, {});
  if (u.pathname === '/helix/moderation/channels') return answer(200, { data: moderated[u.searchParams.get('user_id')] || [], pagination: {} });
  return answer(404, {});
}
auth._test.setFetch(twitchStandIn);

// ------------------------------------------------------------- a real server

const server = createHttpServer({});
initWebSocket(server);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const http = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})), cookie: res.headers.get('set-cookie') || '' };
};
const cookieOf = (setCookie) => setCookie.split(';')[0];

/** A live connection: what it was told, how it closed, and a way to ask. */
function connect({ headers = {}, query = '' } = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/${query}`, { headers });
    const got = { ws, me: null, closed: null, replies: {} };
    let n = 0;
    got.ask = (type, payload) => new Promise((done) => {
      const id = `t${++n}`;
      got.replies[id] = done;
      ws.send(JSON.stringify({ type, payload, id }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === S2C.ME) { got.me = msg.payload; resolve(got); }
      if (msg.id && got.replies[msg.id]) got.replies[msg.id](msg);
    });
    ws.on('close', (code) => { got.closed = code; resolve(got); });
    ws.on('error', () => {});
  });
}
const closeAll = (...conns) => conns.forEach((c) => { try { c.ws.close(); } catch { /* gone */ } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------- while it is off

const offSnapshot = await http('/api/snapshot');
const offConn = await connect();
const offEnable = await offConn.ask(C2S.AUTH, { op: 'enable', on: true });
const offConfig = await http('/auth/config');

// Signing in works while off: it is how the streamer gets a sign-in to switch it on with.
const ownerIn = await http('/auth/twitch', { method: 'POST', body: { token: 'tok-owner' } });
const ownerCookie = cookieOf(ownerIn.cookie);
const ownerConn = await connect({ headers: { Cookie: ownerCookie } });
const ownerGet = await ownerConn.ask(C2S.AUTH, { op: 'get' });

const refusedOther = await http('/auth/twitch', { method: 'POST', body: { token: 'tok-other' } });
const refusedViewer = await http('/auth/twitch', { method: 'POST', body: { token: 'tok-viewer' } });
const refusedScope = await http('/auth/twitch', { method: 'POST', body: { token: 'tok-noscope' } });
const refusedBad = await http('/auth/twitch', { method: 'POST', body: { token: 'nonsense' } });
const refusedKey = await http('/auth/owner-key', { method: 'POST', body: { key: 'not-it' } });

// While it is off, everybody is the owner: so nobody "open" is shown the owner key, or gets to change the keys.
const openGet = await offConn.ask(C2S.AUTH, { op: 'get' });
const openNewKey = await offConn.ask(C2S.AUTH, { op: 'new-key', which: 'ownerKey' });
// Somebody who signed in while it was off — claimed the owner, or used the key they could have read: let go when it is switched on.
const claimed = await http('/auth/claim', { method: 'POST', body: {} });
const claimedCookie = cookieOf(claimed.cookie);
const claimedConn = await connect({ headers: { Cookie: claimedCookie } });
const keyBefore = auth.authState({ role: 'owner', via: 'session' }).ownerKey;
const keyWhileOff = await http('/auth/owner-key', { method: 'POST', body: { key: keyBefore } });
// A cookie some other page set badly is no reason to fail.
const badCookieOff = await connect({ headers: { Cookie: 'x=%; y=%E0%A4%A' } });

test('sign-in starts off: everyone is the owner as before, and nobody can switch it on just because it is off', () => {
  assert.equal(offSnapshot.status, 200);
  assert.deepEqual([offConn.me.role, offConn.me.via, offConn.me.signIn], ['owner', 'open', false]);
  assert.equal(offEnable.payload.code, 'signin_first');
  assert.equal(auth.isEnabled(), false);
  assert.deepEqual([offConfig.body.enabled, offConfig.body.clientId, offConfig.body.channel], [false, 'app-1', 'streamer']);
  assert.deepEqual(offConfig.body.scopes, auth.SIGN_IN_SCOPES);
});

test('the streamer signs in with Twitch even while it is off, and gets a cookie scripts and other sites cannot read', () => {
  assert.equal(ownerIn.status, 200);
  assert.equal(ownerIn.body.role, 'owner');
  assert.match(ownerIn.cookie, /^ss_session=[\w-]{20,}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
  assert.deepEqual([ownerConn.me.role, ownerConn.me.via], ['owner', 'session']);
  assert.equal(ownerGet.payload.enabled, false);
  assert.ok(ownerGet.payload.ownerKey && ownerGet.payload.pageKey && ownerGet.payload.ownerKey !== ownerGet.payload.pageKey);
});

test('Twitch sign-ins that are not for us, not a moderator, not allowed to say so, or not real are refused, each with its reason', () => {
  assert.deepEqual([refusedOther.status, refusedOther.body.code], [400, 'signin_other_app']);
  assert.deepEqual([refusedViewer.body.code, refusedViewer.body.vars], ['signin_not_mod', { channel: 'streamer' }]);
  assert.equal(refusedScope.body.code, 'signin_scope');
  assert.equal(refusedBad.body.code, 'signin_token_bad');
  assert.equal(refusedKey.body.code, 'signin_key_wrong');
  assert.ok(!refusedViewer.cookie && !refusedKey.cookie, 'no cookie for a refused sign-in');
});

test('while it is off, nobody "open" sees the owner key or changes a key; this browser can sign in as the owner, as anybody can then', () => {
  assert.equal(openGet.payload.ownerKey, '');
  assert.ok(openGet.payload.pageKey, 'the page key, for the links');
  assert.equal(openNewKey.payload.code, 'signin_owner_only');
  assert.deepEqual([claimed.status, claimed.body.role], [200, 'owner']);
  assert.deepEqual([claimedConn.me.role, claimedConn.me.via], ['owner', 'session']);
  assert.equal(keyWhileOff.body.role, 'owner');
  assert.equal(badCookieOff.me?.role, 'owner', 'a bad cookie is skipped, and the connection goes on');
});

// ------------------------------------------------------------- switched on

const onEnable = await ownerConn.ask(C2S.AUTH, { op: 'enable', on: true });
await wait(400);
const offConnAfter = offConn.closed;
const { ownerKey, pageKey } = auth.authState({ role: 'owner', via: 'session' });
const claimedAfter = await http('/api/snapshot', { headers: { Cookie: claimedCookie } });
const keySessionAfter = await http('/api/snapshot', { headers: { Cookie: cookieOf(keyWhileOff.cookie) } });
const oldKey = await http('/api/snapshot', { headers: { Authorization: `Bearer ${keyBefore}` } });
const claimWhileOn = await http('/auth/claim', { method: 'POST', body: {} });
const crossSite = await http('/auth/owner-key', { method: 'POST', body: { key: ownerKey }, headers: { Origin: 'https://evil.example' } });
const badCookieOn = await connect({ headers: { Cookie: 'x=%' } });

test('switching on ends every sign-in made while it was off but the streamer\'s own, at once, and changes the owner key', () => {
  assert.equal(onEnable.payload.ownerKey, ownerKey, 'the streamer is shown the new key');
  assert.notEqual(ownerKey, keyBefore);
  assert.equal(claimedConn.closed, 4401, 'its open connection let go');
  assert.equal(claimedAfter.status, 401);
  assert.equal(keySessionAfter.status, 401);
  assert.equal(oldKey.status, 401, 'the old key opens nothing');
  assert.equal(claimWhileOn.body.code, 'signin_owner_only');
  assert.equal(ownerConn.closed, null, 'the streamer stays');
});

test('with it on, signing in from a page on another website is refused, and a bad cookie is turned away rather than left hanging', () => {
  assert.deepEqual([crossSite.status, crossSite.body.code], [403, 'signin_origin']);
  assert.equal(crossSite.cookie, '');
  assert.equal(badCookieOn.closed, 4401);
});

const anon = await http('/api/snapshot');
const health = await http('/api/health');
const withCookie = await http('/api/snapshot', { headers: { Cookie: ownerCookie } });
const withBearer = await http('/api/snapshot', { headers: { Authorization: `Bearer ${ownerKey}` } });
const ownerKeyInUrl = await http(`/api/snapshot?key=${encodeURIComponent(ownerKey)}`);
const pageSnapshot = await http(`/api/snapshot?key=${encodeURIComponent(pageKey)}`);
const pageAssets = await http(`/api/assets?key=${encodeURIComponent(pageKey)}`);
const meAnon = await http('/auth/me');
// The details for a bug report (Settings → About, server/engine/diagnostics.js): the streamer's alone, and
// without the streamer's login where a warning names it (twitch.js says "could not load Twitch profile for <login>").
(await import('../../core/logger.js')).createLogger('twitch').warn('could not load Twitch profile for streamer: Twitch Helix 401');
const ownerDiagnostics = await http('/api/diagnostics', { headers: { Cookie: ownerCookie } });
const anonDiagnostics = await http('/api/diagnostics');
const pageDiagnostics = await http(`/api/diagnostics?key=${encodeURIComponent(pageKey)}`);

const anonConn = await connect();
const evilConn = await connect({ headers: { Origin: 'https://evil.example', Cookie: ownerCookie } });
const devConn = await connect({ headers: { Origin: 'http://localhost:5173', Cookie: ownerCookie } });
const pageConn = await connect({ query: `?key=${encodeURIComponent(pageKey)}` });
const pageHello = await pageConn.ask(C2S.HELLO, { mode: 'canvas' });
const pageWrite = await pageConn.ask(C2S.SAVE_COMMAND, { trigger: '!sneaky', response: 'hi' });

test('switched on by the signed-in streamer; every other page is let go, to be asked again who it is', () => {
  assert.equal(onEnable.payload.enabled, true);
  assert.equal(auth.isEnabled(), true);
  assert.equal(offConnAfter, 4001);
});

test('with it on, the API wants a sign-in or the owner key as a header — never the owner key in an address — and the health check stays open', () => {
  assert.deepEqual([anon.status, anon.body.code], [401, 'signin_needed']);
  assert.equal(health.status, 200);
  assert.equal(withCookie.status, 200);
  assert.equal(withBearer.status, 200);
  assert.equal(ownerKeyInUrl.status, 401);
  assert.equal(meAnon.body.role, null);
});

test('the page key opens the pages OBS shows and nothing more: no configuration, no changes, only drawing the stream', () => {
  assert.equal(pageSnapshot.status, 403);
  assert.equal(pageAssets.status, 200);
  assert.equal(pageConn.me.role, 'page');
  assert.equal(pageHello.type, S2C.REPLY);
  assert.equal(pageWrite.payload.code, 'signin_not_allowed');
  assert.ok(!engine.snapshot().commands.some((c) => c.trigger === '!sneaky'), 'nothing saved');
  // What it is sent is what it draws: the layouts, not the actions' steps, the relays or the Discord settings.
  assert.ok(Array.isArray(pageHello.payload.layouts));
  for (const k of ['streamActions', 'relayConfig', 'dockButtons', 'welcomeGoodbyeConfig', 'moderationLog', 'automodHeld']) assert.ok(!(k in pageHello.payload), k);
  assert.ok('streamActions' in withCookie.body, 'the streamer still gets them');
});

test('a connection from nobody is closed with 4401; from another website, even with the cookie, 4403; the development page is fine', () => {
  assert.equal(anonConn.closed, 4401);
  assert.equal(evilConn.closed, 4403);
  assert.deepEqual([devConn.me?.role, devConn.closed], ['owner', null]);
});

// ------------------------------------------------------------- a moderator

const modIn = await http('/auth/twitch', { method: 'POST', body: { token: 'tok-mod' } });
const modCookie = cookieOf(modIn.cookie);
const modConn = await connect({ headers: { Cookie: modCookie } });
const modCreds = await modConn.ask(C2S.SET_CREDENTIALS, { platform: 'twitch', channel: 'elsewhere' });
const modImport = await modConn.ask(C2S.CONFIG_IMPORT, { bundle: {} });
const modAuth = await modConn.ask(C2S.AUTH, { op: 'get' });
const modOff = await modConn.ask(C2S.AUTH, { op: 'enable', on: false });
const modSnapshot = await modConn.ask(C2S.GET_SNAPSHOT, {});
const modApi = await http('/api/snapshot', { headers: { Cookie: modCookie } });
const modAssets = await http('/api/assets', { headers: { Cookie: modCookie } });
const modMe = await http('/auth/me', { headers: { Cookie: modCookie } });
const modDiagnostics = await http('/api/diagnostics', { headers: { Cookie: modCookie } });

test('the details for a bug report go to the streamer only: not to a moderator, an OBS page or nobody', () => {
  assert.equal(ownerDiagnostics.status, 200);
  assert.ok(ownerDiagnostics.body.text.includes('Sign-in: on'));
  assert.ok(ownerDiagnostics.body.text.includes('could not load Twitch profile for [account]: Twitch Helix 401'), 'the login the app knows, taken out');
  assert.deepEqual([anonDiagnostics.status, anonDiagnostics.body.code], [401, 'signin_needed']);
  assert.deepEqual([pageDiagnostics.status, pageDiagnostics.body.code], [403, 'signin_not_allowed']);
  assert.deepEqual([modDiagnostics.status, modDiagnostics.body.code], [403, 'signin_not_allowed']);
});

test('a moderator of the channel signs in with their own Twitch, for a week, and their token is kept for asking Twitch again', () => {
  assert.equal(modIn.body.role, 'mod');
  assert.match(modIn.cookie, /Max-Age=604800/);
  assert.deepEqual([modConn.me.role, modConn.me.login], ['mod', 'modone']);
  assert.deepEqual([modMe.body.role, modMe.body.login], ['mod', 'modone']);
  assert.equal(auth._test.tokens()['200'].token, 'tok-mod');
});

test('a moderator gets the app but not what is the streamer\'s: accounts, restoring a backup, sign-in, the raw API', () => {
  assert.equal(modCreds.payload.code, 'signin_not_allowed');
  assert.equal(twitch.getCredentials().channel, 'streamer');
  assert.equal(modImport.payload.code, 'signin_not_allowed');
  assert.equal(modAuth.payload.code, 'signin_owner_only');
  assert.equal(modOff.payload.code, 'signin_owner_only');
  assert.equal(auth.isEnabled(), true);
  assert.equal(modSnapshot.type, S2C.REPLY);
  assert.equal(modApi.status, 403);
  assert.equal(modAssets.status, 200);
  for (const type of [C2S.SAVE_ACTION, C2S.SAVE_ALERT, C2S.SEND_CHAT, C2S.RUN_ACTION]) assert.ok(mayAsk({ role: 'mod' }, type), type);
  for (const type of [C2S.UPDATES, C2S.PIXEL_AVATARS, C2S.CONFIG_EXPORT, C2S.PLATFORM_CONNECT, C2S.DROIDCAM_SETTINGS]) assert.ok(!mayAsk({ role: 'mod' }, type), type);
  assert.ok(!mayAsk({ role: 'mod' }, C2S.DISCORD, { op: 'exchange_code' }), 'signing the app in to Discord is the streamer\'s');
  assert.ok(mayAsk({ role: 'mod' }, C2S.DISCORD, { op: 'get_roles' }));
  assert.ok(read('../api/ws.js').includes('ok && !ws.revoked && ws.readyState === WebSocket.OPEN && handleMessage(ws, raw)'), 'a connection let go is not heard');
});

// ------------------------------------------- what a moderator may change (step 2)

const layoutsBefore = JSON.stringify(collection('layouts').get());
const modLayouts = await modConn.ask(C2S.SET_LAYOUTS, []);
const modThemes = await modConn.ask(C2S.USER_THEMES, { op: 'create', name: 'Mine now' });
const modAvatars = await modConn.ask(C2S.AVATAR_SOURCES, { op: 'create', name: 'Mine now' });
const modOmniSet = await modConn.ask(C2S.OMNILAYER, { op: 'set', settings: { enabled: false } });
const modMicSet = await modConn.ask(C2S.MIC, { settings: { threshold: 1 } });
const modSwitch = await modConn.ask(C2S.PROFILE_SWITCH, { group: 'overlays', id: 'whatever' });
const modSave = await modConn.ask(C2S.PROFILE_CAPTURE, { group: 'overlays' });
const layoutsAfter = JSON.stringify(collection('layouts').get());

// Another overlay profile, made by the streamer, for the moderator to look at.
await ownerConn.ask(C2S.PROFILE_DUPLICATE, { group: 'overlays', name: 'Peek test' });
const overlaysGroup = () => engine.store.profileSummary().find((g) => g.id === 'overlays');
const liveBefore = overlaysGroup().active;
const other = overlaysGroup().profiles.find((p) => p.name === 'Peek test');
const peekOther = await modConn.ask(C2S.PROFILE_PEEK, { group: 'overlays', id: other.id });
const peekLive = await modConn.ask(C2S.PROFILE_PEEK, { group: 'overlays', id: liveBefore });
const liveAfter = overlaysGroup().active;
await ownerConn.ask(C2S.PROFILE_DELETE, { group: 'overlays', id: other.id });

// Chatting on Twitch: as themselves through Twitch's chat API, or as the bot — never the streamer's connection.
const realFetch = globalThis.fetch;
const chatCalls = [];
let chatAnswer = { data: [{ message_id: 'm1', is_sent: true }] };
globalThis.fetch = async (url, init = {}) => {
  chatCalls.push({ url: String(url), auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : null });
  return { ok: true, status: 200, text: async () => JSON.stringify(chatAnswer) };
};
const modSays = await modConn.ask(C2S.SEND_CHAT, { text: 'hola chat', to: 'twitch' });
chatAnswer = { data: [{ is_sent: false, drop_reason: { code: 'automod', message: 'held by AutoMod' } }] };
const modDropped = await modConn.ask(C2S.SEND_CHAT, { text: 'something AutoMod holds', to: 'twitch' });
const modAsBot = await modConn.ask(C2S.SEND_CHAT, { text: 'as the bot', to: 'twitch', useBot: true });
globalThis.fetch = realFetch;

twitchMod.initTwitchMod({ tokenFor: auth.modActingToken });
// Somebody the server saw in chat: the record names them as the chat did, whatever name the page sent.
collection('recent_chat').update((prev) => [{ id: 'm-real', platform: 'twitch', userId: '555', user: 'RealName', msg: 'hi' }, ...(prev || [])]);
const modCalls = [];
globalThis.fetch = async (url, init = {}) => {
  modCalls.push({ url: String(url), auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : null });
  return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{}] }) };
};
const modTimesOut = await modConn.ask(C2S.TWITCH_MOD, { op: 'timeout', userId: '555', login: 'somebody_else', seconds: 60 });
globalThis.fetch = realFetch;
const modRecordNow = modActivity.list({ userId: '200' });
const noWriteScope = auth.modChatToken({ role: 'mod', userId: '999' });
const ownerChatToken = auth.modChatToken({ role: 'owner', userId: '100' });

test('a moderator changes no overlay, look, named avatar, Omnilayer or PNGtuber setting, nor any profile', () => {
  for (const [name, r] of Object.entries({ modLayouts, modThemes, modAvatars, modOmniSet, modMicSet, modSwitch, modSave })) {
    assert.equal(r.payload.code, 'signin_not_allowed', name);
  }
  assert.equal(layoutsAfter, layoutsBefore);
});

test('but runs the stream: a layout put live, a PNGtuber face, a look at what OBS holds', () => {
  const mod = { role: 'mod' };
  assert.ok(mayAsk(mod, C2S.OMNILAYER, { op: 'go' }));
  assert.ok(mayAsk(mod, C2S.OMNILAYER, { op: 'inspect' }));
  assert.ok(!mayAsk(mod, C2S.OMNILAYER, { op: 'types' }));
  for (const op of ['meter', 'face', 'dress', 'undress', 'action']) assert.ok(mayAsk(mod, C2S.MIC, { op }), op);
  assert.ok(!mayAsk(mod, C2S.MIC, { settings: {} }));
  for (const type of [C2S.SAVE_ALERT, C2S.TEST_ALERT, C2S.SET_OMNIBAR, C2S.COUNTDOWN, C2S.PROFILE_PEEK]) assert.ok(mayAsk(mod, type), type);
});

test('a moderator looks at another overlay profile without switching anything: its layouts come back, the live one stays live', () => {
  assert.equal(peekOther.type, S2C.REPLY);
  assert.deepEqual([peekOther.payload.live, peekOther.payload.name], [false, 'Peek test']);
  assert.ok(Array.isArray(peekOther.payload.data.layouts), 'keyed as the snapshot keys it');
  assert.ok(!('avatar_sources' in peekOther.payload.data));
  assert.deepEqual([peekLive.payload.live, peekLive.payload.data], [true, {}]);
  assert.equal(liveAfter, liveBefore);
});

test('a moderator moderates through the socket with their own sign-in, and the record names who it was done to as the chat did', () => {
  assert.equal(modTimesOut.type, S2C.REPLY, JSON.stringify(modTimesOut.payload));
  assert.equal(modCalls[0].auth, 'Bearer tok-mod', 'the real modActingToken chose the moderator\'s own sign-in');
  assert.ok(modCalls[0].url.includes('moderator_id=200'));
  const line = modRecordNow.find((e) => e.type === C2S.TWITCH_MOD);
  assert.deepEqual([line?.op, line?.what], ['timeout', 'RealName'], 'not the name the page sent');
});

test('a moderator chats on Twitch as themselves, with their own sign-in, or as the bot, and never as the streamer', () => {
  assert.equal(modSays.type, S2C.REPLY);
  assert.equal(chatCalls.length, 2, 'two lines through the chat API, the bot\'s line not among them');
  assert.ok(chatCalls[0].url.endsWith('/helix/chat/messages'));
  assert.equal(chatCalls[0].auth, 'Bearer tok-mod');
  assert.deepEqual(chatCalls[0].body, { broadcaster_id: '100', sender_id: '200', message: 'hola chat' });
  assert.deepEqual([modDropped.payload.code, modDropped.payload.vars], ['chat_dropped', { reason: 'held by AutoMod' }]);
  assert.equal(modAsBot.payload.code, 'bot_offline', 'the bot, and no quiet fallback to the streamer');
  assert.deepEqual(noWriteScope, { userId: '999' });
  assert.deepEqual(ownerChatToken, {});
});

test('the dashboard: a moderator\'s menu, profile bar, Overlays and Looks', () => {
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("const MOD_HIDDEN_VIEWS = new Set<AppView>(['gallery', 'guides', 'pngtuber', 'pixel-avatars', 'moderators']);"));
  assert.ok(app.includes("useEffect(() => { if (system.auth.isMod && MOD_HIDDEN_VIEWS.has(view)) setView('dashboard'); }, [system.auth.isMod, view]);"));
  assert.ok(app.includes("looking={system.auth.isMod ? (PROFILE_GROUP_FOR_VIEW[view] === 'overlays' ? 'browse' : 'fixed') : undefined}"));
  assert.equal(app.split('readOnly={system.auth.isMod}').length - 1, 2, 'Overlays and Looks');
  const stream = read('../../web/hooks/useStreamSystem.ts');
  assert.ok(stream.includes("profileSwitch: (group: string, id: string) => (isMod ? (group === 'overlays' ? peekProfile(group, id).catch(() => {}) : undefined) : send(C2S.PROFILE_SWITCH, { group, id })),"));
  assert.ok(stream.includes("layouts: peeked('layouts', (snapshot as any).layouts ?? []),"));
  const layouts = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(layouts.includes('.filter((l) => !readOnly && l.visible && !l.locked && shownIn(l, format))'), 'no handles to drag');
  assert.ok(layouts.includes('<Locked on={readOnly}>{layerEditor(chosen)}</Locked>'));
  assert.ok(layouts.indexOf('const Locked = ') > 0 && layouts.indexOf('const Locked = ') < layouts.indexOf('export const LayoutsView'), 'one component type, outside the editor, so nothing remounts');
  const library = read('../../web/components/views/LibraryView.tsx');
  assert.ok(library.includes("    // A moderator's look at a layout is only a look.\n    if (readOnly) return;") || library.includes("    // A moderator's look at a layout is only a look.\r\n    if (readOnly) return;"));
});

// ------------------------------------------- a moderator's own dock (step 3)

const streamerDeck = JSON.stringify(engine.store.getDockButtons());
const streamerGrid = JSON.stringify(engine.store.getDockGrid());
const streamerChat = engine.store.getChatDockSettings();
const modSeesFirst = (await modConn.ask(C2S.GET_SNAPSHOT, {})).payload;
await ownerConn.ask(C2S.SAVE_ACTION, { id: 'mod-deck-test', name: 'Deck test', steps: [], triggers: [] });
const modSetDeck = await modConn.ask(C2S.SET_DOCK_BUTTONS, [
  { id: 'b1', builtin: 'question_next', label: 'Next one', slot: 0 },
  { id: 'b2', actionId: 'mod-deck-test', label: 'Mine', slot: 1 },
]);
const modSetGrid = await modConn.ask(C2S.SET_DOCK_GRID, { columns: streamerGridColumns() === 3 ? 5 : 3 });
const modSetChat = await modConn.ask(C2S.SET_CHAT_DOCK_SETTINGS, { ...streamerChat, messageGap: streamerChat.messageGap === 17 ? 18 : 17 });
const modSeesThen = (await modConn.ask(C2S.GET_SNAPSHOT, {})).payload;
const ownerSeesThen = (await ownerConn.ask(C2S.GET_SNAPSHOT, {})).payload;
// The streamer deletes the action on the moderator's deck: its button goes from their deck too.
await ownerConn.ask(C2S.DELETE_ACTION, { id: 'mod-deck-test' });
const modSeesAfterDelete = (await modConn.ask(C2S.GET_SNAPSHOT, {})).payload;
function streamerGridColumns() { return engine.store.getDockGrid().columns; }

test('a moderator starts with the streamer\'s dock, and once they change it it is theirs: the streamer\'s does not move', () => {
  assert.equal(JSON.stringify(modSeesFirst.dockButtons), streamerDeck, 'their deck starts as the streamer\'s');
  for (const r of [modSetDeck, modSetGrid, modSetChat]) assert.equal(r.type, S2C.REPLY, JSON.stringify(r.payload));
  assert.deepEqual(modSeesThen.dockButtons.map((b) => b.label), ['Next one', 'Mine']);
  assert.notEqual(modSeesThen.dockGrid.columns, engine.store.getDockGrid().columns);
  assert.notEqual(modSeesThen.chatDockSettings.messageGap, streamerChat.messageGap);
  assert.equal(JSON.stringify(engine.store.getDockButtons()), streamerDeck, 'the streamer\'s deck untouched');
  assert.equal(JSON.stringify(engine.store.getDockGrid()), streamerGrid);
  assert.equal(engine.store.getChatDockSettings().messageGap, streamerChat.messageGap);
  assert.equal(JSON.stringify(ownerSeesThen.dockButtons), streamerDeck, 'and that is what the streamer is sent');
  assert.ok(Array.isArray(ownerSeesThen.automodHeld), 'what AutoMod holds is in the streamer\'s snapshot');
});

test('a moderator\'s deck loses a button when its action is deleted, as the streamer\'s does', () => {
  assert.deepEqual(modSeesAfterDelete.dockButtons.map((b) => b.label), ['Next one']);
});

// ------------------------------------------- the Moderators screen (step 4)

const modsList = (await ownerConn.ask(C2S.MODERATORS, { op: 'list' })).payload;
const modsActivity = (await ownerConn.ask(C2S.MODERATORS, { op: 'activity', userId: '200' })).payload.entries;
const modAsksMods = await modConn.ask(C2S.MODERATORS, { op: 'list' });
const resetDock = (await ownerConn.ask(C2S.MODERATORS, { op: 'reset-dock', userId: '200' })).payload;
const modAfterReset = (await modConn.ask(C2S.GET_SNAPSHOT, {})).payload;

test('the Moderators screen lists who signed in, whether they are here now and whether the dock is their own — the streamer\'s only', () => {
  const one = modsList.moderators.find((m) => m.userId === '200');
  assert.ok(one, 'the moderator is listed');
  assert.equal(one.login, 'modone');
  assert.ok(one.online >= 1, 'here now');
  assert.equal(one.ownDock, true);
  assert.equal(modsList.enabled, true);
  assert.equal(modAsksMods.payload.code, 'signin_not_allowed');
});

test('what a moderator did is on the record — what they carried out, not what they looked at or were refused', () => {
  const types = modsActivity.map((e) => e.type);
  assert.ok(types.includes(C2S.SEND_CHAT) && types.includes(C2S.SET_DOCK_BUTTONS), types.join(','));
  assert.ok(modsActivity.some((e) => e.type === C2S.SEND_CHAT && e.what === 'hola chat'));
  for (const quiet of [C2S.GET_SNAPSHOT, C2S.PROFILE_PEEK, C2S.HELLO]) assert.ok(!types.includes(quiet), quiet);
  for (const refused of [C2S.SET_LAYOUTS, C2S.SET_CREDENTIALS, C2S.CONFIG_IMPORT]) assert.ok(!types.includes(refused), refused);
  assert.ok(modsActivity.every((e) => e.login === 'modone' && e.at > 0));
});

test('the streamer puts a moderator\'s dock back to theirs, and the moderator sees it at once', () => {
  assert.equal(resetDock.moderators.find((m) => m.userId === '200').ownDock, false);
  assert.equal(JSON.stringify(modAfterReset.dockGrid), JSON.stringify(engine.store.getDockGrid()));
});

// No longer a moderator: asked again once their sign-in is old enough, and let go.
const modSessionId = modCookie.split('=')[1];
const modWho = { ...auth.identify({ headers: { cookie: modCookie } }) };
// Uploads: new ones, never replacing the streamer's, and no deleting them.
fs.mkdirSync(config.assetsDir, { recursive: true });
fs.writeFileSync(`${config.assetsDir}/signin-streamers.png`, 'png');
fs.writeFileSync(`${config.assetsDir}/signin_logo.png`, 'png');
const modReplaceSly = await http('/api/assets/signin%20logo.png', { method: 'POST', headers: { Cookie: modCookie } });
const modReplace = await http('/api/assets/signin-streamers.png', { method: 'POST', headers: { Cookie: modCookie } });
const modDelete = await http('/api/assets/signin-streamers.png', { method: 'DELETE', headers: { Cookie: modCookie } });
// An upload opened on its own runs nothing: an SVG can carry a script.
fs.writeFileSync(`${config.assetsDir}/signin-test.svg`, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const svgRes = await fetch(`${base}/media/signin-test.svg`);
const svgHeaders = { csp: svgRes.headers.get('content-security-policy') || '', sniff: svgRes.headers.get('x-content-type-options') || '' };
await svgRes.text();
// Twitch not answering is no reason to let a moderator go; Twitch saying they are not one is.
moderated[200] = [];
const keptFresh = await auth.recheckMod(modWho);
auth._test.age(modSessionId, auth.MOD_RECHECK_MS + 1);
auth._test.setFetch(async () => { throw new Error('Twitch is down'); });
const keptWhenDown = await auth.recheckMod(modWho);
auth._test.setFetch(twitchStandIn);
const keptStale = await auth.recheckMod(modWho);
const modGone = !auth._test.sessions()[modSessionId];
await wait(50);
const modConnLetGo = modConn.closed;
const modApiAfter = await http('/api/assets', { headers: { Cookie: modCookie } });
moderated[200] = [{ broadcaster_id: '100' }];

// Turned away: signed out at once, kept out, let back in.
const modBack = await http('/auth/twitch', { method: 'POST', body: { token: 'tok-mod' } });
const modBackConn = await connect({ headers: { Cookie: cookieOf(modBack.cookie) } });
const blockedNow = (await ownerConn.ask(C2S.MODERATORS, { op: 'block', userId: '200', login: 'modone' })).payload;
await wait(50);
const blockedConnClosed = modBackConn.closed;
const blockedSignIn = await http('/auth/twitch', { method: 'POST', body: { token: 'tok-mod' } });
const unblocked = (await ownerConn.ask(C2S.MODERATORS, { op: 'unblock', userId: '200' })).payload;
const backAgain = await http('/auth/twitch', { method: 'POST', body: { token: 'tok-mod' } });
const signedOutAll = (await ownerConn.ask(C2S.MODERATORS, { op: 'signout', userId: '200' })).payload;

test('a moderator turned away is signed out at once and cannot sign in until let back in; signing one out ends every sign-in they have', () => {
  assert.deepEqual(blockedNow.blocked.map((b) => b.login), ['modone']);
  assert.ok(!blockedNow.moderators.some((m) => m.userId === '200'));
  assert.equal(blockedConnClosed, 4401);
  assert.deepEqual([blockedSignIn.status, blockedSignIn.body.code, blockedSignIn.body.vars], [400, 'signin_blocked', { channel: 'streamer' }]);
  assert.deepEqual(unblocked.blocked, []);
  assert.equal(backAgain.body.role, 'mod');
  assert.ok(!signedOutAll.moderators.some((m) => m.userId === '200'));
});

// The page key changed: the pages on the old one are let go, and the old key no longer opens anything.
const newPage = await ownerConn.ask(C2S.AUTH, { op: 'new-key', which: 'pageKey' });
await wait(100);
const oldPageClosed = pageConn.closed;
const oldPageAssets = await http(`/api/assets?key=${encodeURIComponent(pageKey)}`);

// Signing out, and the owner key as the way back in.
const keyIn = await http('/auth/owner-key', { method: 'POST', body: { key: ownerKey } });
const keyCookie = cookieOf(keyIn.cookie);
const keyConn = await connect({ headers: { Cookie: keyCookie } });
const meRenewed = await http('/auth/me', { headers: { Cookie: keyCookie } });
const out = await http('/auth/signout', { method: 'POST', headers: { Cookie: keyCookie } });
const afterOut = await http('/api/snapshot', { headers: { Cookie: keyCookie } });
await wait(50);
const keyConnAfterOut = keyConn.closed;
// A new owner key ends the sign-ins made with the old one, but not the streamer's Twitch one asking for it.
const keyIn2 = await http('/auth/owner-key', { method: 'POST', body: { key: ownerKey } });
// A connection opened with the old key as a header: no sign-in of its own to end, so let go by the key changing.
const headerConn = await connect({ headers: { Authorization: `Bearer ${ownerKey}` } });
const headerSaw = headerConn.me?.role || '';
const rotated = await ownerConn.ask(C2S.AUTH, { op: 'new-key', which: 'ownerKey' });
await wait(50);
const headerConnAfterRotate = headerConn.closed;
const askerAfterRotate = ownerConn.closed;
const afterRotate = await http('/api/snapshot', { headers: { Cookie: cookieOf(keyIn2.cookie) } });
const ownerAfterRotate = await http('/api/snapshot', { headers: { Cookie: ownerCookie } });

test('a moderator uploads new files but replaces or deletes none of the streamer\'s', () => {
  assert.deepEqual([modReplace.status, modReplace.body.code], [403, 'signin_not_allowed']);
  assert.equal(modReplaceSly.status, 403, '"signin logo.png" would be saved as the streamer\'s signin_logo.png');
  assert.equal(fs.readFileSync(`${config.assetsDir}/signin_logo.png`, 'utf8'), 'png');
  assert.equal(modDelete.status, 403);
  assert.ok(fs.existsSync(`${config.assetsDir}/signin-streamers.png`));
});

test('an upload opened on its own is sandboxed: no script runs with the streamer\'s sign-in', () => {
  assert.match(svgHeaders.csp, /sandbox/);
  assert.match(svgHeaders.csp, /default-src 'none'/);
  assert.equal(svgHeaders.sniff, 'nosniff');
});

test('somebody no longer a moderator is let go when next asked about — not before, and not because Twitch did not answer — and their connection goes with them', () => {
  assert.equal(keptWhenDown, true, 'Twitch down: asked again later');
  assert.equal(keptFresh, true, 'asked about recently: not asked again');
  assert.equal(keptStale, false);
  assert.ok(modGone);
  assert.equal(modConnLetGo, 4401, 'the open connection let go at once');
  assert.equal(modApiAfter.status, 401);
  assert.ok(!auth._test.tokens()['200'], 'their Twitch token not kept any longer');
});

test('a new page key lets the pages on the old one go; the owner key signs in; signing out ends that sign-in', () => {
  assert.ok(newPage.payload.pageKey && newPage.payload.pageKey !== pageKey);
  assert.equal(oldPageClosed, 4401);
  assert.equal(oldPageAssets.status, 401);
  assert.equal(keyIn.body.role, 'owner');
  assert.match(meRenewed.cookie, /^ss_session=[\w-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/, 'the cookie renewed with the sign-in');
  assert.equal(out.status, 200);
  assert.match(out.cookie, /Max-Age=0/);
  assert.equal(afterOut.status, 401);
  assert.equal(keyConnAfterOut, 4401, 'signing out over HTTP lets its open connection go too');
});

test('a new owner key ends every sign-in made with the old one, and not the streamer\'s own', () => {
  assert.ok(rotated.payload.ownerKey && rotated.payload.ownerKey !== ownerKey);
  assert.equal(afterRotate.status, 401);
  assert.equal(ownerAfterRotate.status, 200);
  assert.equal(headerSaw, 'owner', 'the connection on the owner key was not the owner to begin with');
  assert.equal(headerConnAfterRotate, 4401, 'a connection opened with the old owner key stayed open, still the owner');
  assert.ok(!askerAfterRotate, 'the connection that asked for the new key was let go');
});

// Off again, for whatever runs after.
const offAgain = await ownerConn.ask(C2S.AUTH, { op: 'enable', on: false });
closeAll(ownerConn, devConn, modConn);
await wait(50);
closeWebSocket();
server.closeAllConnections();
await new Promise((r) => server.close(r));
collection('twitch_credentials').set(twitchBefore);

test('switched off again by the streamer, everyone is the owner once more', () => {
  assert.equal(offAgain.payload.enabled, false);
  assert.equal(auth.identify({ headers: {} }).via, 'open');
});

test('the sign-in is never in a backup, and the keys never leave in an address the app writes, except the page key', () => {
  for (const name of ['auth_settings', 'auth_secrets', 'auth_sessions', 'auth_tokens']) assert.ok(EXCLUDED.includes(name), name);
  const backend = read('../../web/hooks/useBackend.ts');
  assert.ok(backend.includes("credentials: 'include'"));
  assert.ok(read('../../web/page-link.ts').includes("const SIGNS_IN = new Set(['dock', 'dock-actions', 'dashboard']);"));
});

test('the dashboard: a token from Twitch for signing in is the sign-in page\'s, never mistaken for connecting Twitch', () => {
  assert.ok(read('../../web/hooks/useStreamSystem.ts').includes("if ((hash.get('state') || '').startsWith('signin')) return;"));
  const page = read('../../web/components/SignInPage.tsx');
  assert.ok(page.includes("url.searchParams.set('force_verify', 'true');"));
  assert.ok(page.includes('if (!expected || state !== expected)'));
});

test('sign-in is said in both languages, and so is every refusal it gives', () => {
  const words = read('../../web/constants.ts');
  const codes = ['signin_no_twitch', 'signin_token_bad', 'signin_other_app', 'signin_scope', 'signin_mod_check', 'signin_not_mod', 'signin_key_wrong', 'signin_owner_only', 'signin_first', 'signin_not_allowed', 'signin_needed', 'signin_origin', 'signin_blocked'];
  for (const code of codes) {
    const key = `refuse${code.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`;
    assert.equal(words.split(`    ${key}: `).length - 1, 2, key);
  }
  for (const key of ['signInSection', 'signInTwitch', 'signInEnableConfirm', 'signInPageKeyHint']) assert.equal(words.split(`    ${key}: `).length - 1, 2, key);
});

test('a backup is restored from any device by the owner signed in; with sign-in off, only on the machine the app runs on', () => {
  const ws = fs.readFileSync(new URL('../api/ws.js', SCRIPT_URL), 'utf8');
  assert.ok(ws.includes("if (!ws.isLocal && !(auth.isEnabled() && ws.who?.role === 'owner')) throw refusal('import_local_only'"), 'restoring a backup is not limited the way it should be');
  // Moderators and the pages OBS shows never restore one, wherever they are.
  assert.equal(mayAsk({ role: 'mod' }, C2S.CONFIG_IMPORT, {}), false);
  assert.equal(mayAsk({ role: 'page' }, C2S.CONFIG_IMPORT, {}), false);
  assert.equal(mayAsk({ role: 'owner' }, C2S.CONFIG_IMPORT, {}), true);
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  assert.equal(strings.split('    refuseImportLocalOnly: ').length - 1, 2);
  assert.ok(strings.includes('Switch sign-in on in Settings → Sign-in to restore one from any device'), 'the refusal does not say how to restore from another device');
});
