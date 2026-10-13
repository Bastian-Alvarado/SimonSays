/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Moderating Twitch chat from the app (2.0.0, server/engine/twitch-mod.js):
 * from the dock, as whoever pressed, and from an action's steps, as the
 * channel. Twitch is a stand-in that keeps every request it was sent.
 */

import { SCRIPT_URL, assert, collection, fs, test } from './harness.js';

const twitch = await import('../../platforms/twitch.js');
const twitchMod = await import('../../engine/twitch-mod.js');
const activity = await import('../../engine/mod-activity.js');
const auth = await import('../../api/auth.js');
const read = (rel) => fs.readFileSync(new URL(rel, SCRIPT_URL), 'utf8');

twitch.initTwitch();
const credsBefore = structuredClone(collection('twitch_credentials').get());
twitch.setCredentials({ clientId: 'app-1', userId: '100', login: 'streamer', channel: 'streamer', accessToken: 'chan-token' });

// A moderator whose sign-in may moderate, and one from before it was asked for.
const MOD = { role: 'mod', userId: '200', login: 'modone' };
const OLD_MOD = { role: 'mod', userId: '300', login: 'oldmod' };
const tokens = { 200: { token: 'mod-token', scopes: auth.SIGN_IN_SCOPES } };
twitchMod.initTwitchMod({ tokenFor: (who, scope) => (tokens[who.userId]?.scopes.includes(scope) ? { token: tokens[who.userId].token, userId: who.userId } : null) });

const sent = [];
let answer = () => ({ status: 200, body: { data: [{}] } });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const req = { method: init.method || 'GET', path: u.pathname.replace('/helix', ''), query: Object.fromEntries(u.searchParams), auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : null };
  sent.push(req);
  const a = answer(req);
  return { ok: a.status < 300, status: a.status, text: async () => (a.status === 204 ? '' : JSON.stringify(a.body)) };
};
const last = () => sent[sent.length - 1];
const settle = async (p) => { try { return await p; } catch (err) { return { refused: err.code || err.message, vars: err.vars }; } };

const modTimeout = await settle(twitchMod.control(MOD, { op: 'timeout', userId: '555', seconds: 600 }));
const modTimeoutReq = last();
const oldModBan = await settle(twitchMod.control(OLD_MOD, { op: 'ban', userId: '555' }));
const oldModBanReq = last();
const ownerUnban = await settle(twitchMod.control({ role: 'owner', via: 'open' }, { op: 'unban', userId: '555' }));
const ownerUnbanReq = last();
const banStreamer = await settle(twitchMod.control(MOD, { op: 'ban', userId: '100' }));
const longTimeout = await settle(twitchMod.control(MOD, { op: 'timeout', userId: '555', seconds: 99_999_999 }));
const longTimeoutReq = last();
const del = await settle(twitchMod.control(MOD, { op: 'delete', msgId: 'msg-1' }));
const delReq = last();
answer = (req) => ({ status: 200, body: { data: [{ slow_mode: req.body?.slow_mode ?? true, slow_mode_wait_time: req.body?.slow_mode_wait_time ?? 30, emote_mode: false, follower_mode: false, subscriber_mode: false }] } });
const modes = await settle(twitchMod.control(MOD, { op: 'chat-settings', settings: { slow: true, slowSeconds: 500 } }));
const modesReq = last();
answer = () => ({ status: 403, body: { message: 'missing scope' } });
const refused = await settle(twitchMod.control(MOD, { op: 'delete', msgId: 'msg-2' }));
answer = () => ({ status: 204, body: null });

// AutoMod: a message held, then let through from the dock; another decided on Twitch's own screen.
twitchMod._test.reset();
twitchMod._test.automod('hold', { message_id: 'h1', user_id: '777', user_login: 'rude', user_name: 'Rude', message: { text: 'something rude' }, automod: { category: 'swearing', level: 2 } });
twitchMod._test.automod('hold', { message_id: 'h2', user_id: '778', user_login: 'other', user_name: 'Other', message: 'older v1 text', category: 'bullying' });
const heldTwo = twitchMod.heldNow().map((h) => ({ msgId: h.msgId, text: h.text, reason: h.reason }));
const allow = await settle(twitchMod.control(MOD, { op: 'automod', msgId: 'h1', userId: '777', allow: true }));
const allowReq = last();
twitchMod._test.automod('update', { message_id: 'h2', status: 'Denied' });
const heldAfter = twitchMod.heldNow().length;

// The steps: as the channel, the person who set it off known by id, anybody else looked up.
answer = (req) => (req.path === '/users' ? { status: 200, body: { data: [{ id: '999', login: req.query.login }] } } : { status: 204, body: null });
const ctx = { user: { name: 'Pesado', id: '444', platform: 'twitch' }, chatId: 'msg-9' };
sent.length = 0;
await twitchMod.step({ what: 'timeout', targetName: 'Pesado', seconds: 60 }, ctx);
const stepSelf = [...sent];
sent.length = 0;
await twitchMod.step({ what: 'ban', targetName: '@someone_else' }, ctx);
const stepOther = [...sent];
sent.length = 0;
await twitchMod.step({ what: 'delete' }, ctx);
await twitchMod.step({ what: 'chat_mode', mode: 'emote', on: true }, ctx);
await twitchMod.step({ what: 'timeout', targetName: 'streamer' }, { user: { name: 'streamer', id: '100', platform: 'twitch' } });
const stepRest = [...sent];

globalThis.fetch = realFetch;
collection('twitch_credentials').set(credsBefore);

test('a moderator moderates with their own sign-in, so Twitch\'s mod log names them; one from before it was asked for, as the channel', () => {
  assert.deepEqual(modTimeout, { ok: true });
  assert.equal(modTimeoutReq.auth, 'Bearer mod-token');
  assert.deepEqual([modTimeoutReq.method, modTimeoutReq.path, modTimeoutReq.query], ['POST', '/moderation/bans', { broadcaster_id: '100', moderator_id: '200' }]);
  assert.deepEqual(modTimeoutReq.body.data, { user_id: '555', duration: 600, reason: 'por modone' });
  assert.deepEqual(oldModBan, { ok: true });
  assert.equal(oldModBanReq.auth, 'Bearer chan-token');
  assert.equal(oldModBanReq.query.moderator_id, '100');
  assert.ok(!('duration' in oldModBanReq.body.data), 'a ban has no duration');
  assert.deepEqual([ownerUnbanReq.method, ownerUnbanReq.query], ['DELETE', { broadcaster_id: '100', moderator_id: '100', user_id: '555' }]);
  assert.deepEqual(ownerUnban, { ok: true });
});

test('never the streamer; a timeout is at most two weeks; a message deleted by its id; slow mode kept to Twitch\'s range', () => {
  assert.equal(banStreamer.refused, 'mod_not_streamer');
  assert.equal(longTimeoutReq.body.data.duration, 1_209_600);
  assert.deepEqual(longTimeout, { ok: true });
  assert.deepEqual(del, { ok: true });
  assert.deepEqual([delReq.method, delReq.path, delReq.query.message_id, delReq.auth], ['DELETE', '/moderation/chat', 'msg-1', 'Bearer mod-token']);
  assert.deepEqual([modesReq.method, modesReq.path, modesReq.body], ['PATCH', '/chat/settings', { slow_mode: true, slow_mode_wait_time: 120 }]);
  assert.deepEqual([modes.slow, modes.slowSeconds], [true, 120]);
  assert.deepEqual([refused.refused, refused.vars], ['twitch_mod_scope', { scope: 'moderator:manage:chat_messages' }]);
});

test('what AutoMod holds waits in every dock, newest first, with why; let through from the dock, or decided elsewhere, it goes', () => {
  assert.deepEqual(heldTwo, [
    { msgId: 'h2', text: 'older v1 text', reason: 'bullying' },
    { msgId: 'h1', text: 'something rude', reason: 'swearing' },
  ]);
  assert.deepEqual(allow, { ok: true });
  assert.deepEqual([allowReq.path, allowReq.body, allowReq.auth], ['/moderation/automod/message', { user_id: '200', msg_id: 'h1', action: 'ALLOW' }, 'Bearer mod-token']);
  assert.equal(heldAfter, 0);
});

test('the steps moderate as the channel: whoever set it off by id, anybody else looked up, the message deleted, a chat mode — never the streamer', () => {
  assert.equal(stepSelf.length, 1, 'no lookup for whoever set it off');
  assert.deepEqual([stepSelf[0].auth, stepSelf[0].body.data.user_id, stepSelf[0].body.data.duration], ['Bearer chan-token', '444', 60]);
  assert.deepEqual(stepOther.map((r) => r.path), ['/users', '/moderation/bans']);
  assert.equal(stepOther[0].query.login, 'someone_else');
  assert.equal(stepOther[1].body.data.user_id, '999');
  assert.deepEqual(stepRest.map((r) => `${r.method} ${r.path}`), ['DELETE /moderation/chat', 'PATCH /chat/settings']);
  assert.equal(stepRest[0].query.message_id, 'msg-9');
  assert.deepEqual(stepRest[1].body, { emote_mode: true });
});

test('a moderator\'s sign-in asks to moderate as themselves, and the streamer\'s connection asks for the same', () => {
  for (const scope of ['moderator:manage:banned_users', 'moderator:manage:chat_messages', 'moderator:manage:chat_settings', 'moderator:manage:automod']) {
    assert.ok(auth.SIGN_IN_SCOPES.includes(scope), scope);
    assert.ok(read('../../web/hooks/useStreamSystem.ts').includes(`'${scope}'`), scope);
  }
  const tw = read('../platforms/twitch.js');
  assert.ok(tw.includes("['automod.message.hold', ['2', '1'], null, (e) => automodListener?.('hold', e)],"));
  assert.ok(tw.includes("if (type === 'channel.follow' || type.startsWith('automod.')) condition.moderator_user_id = broadcasterId;"));
});

// The record: one moderator's many changes do not push another's off it, and the same change again is counted.
const A = { role: 'mod', userId: 'rec-a', login: 'busy' };
const B = { role: 'mod', userId: 'rec-b', login: 'quiet' };
activity.record(B, 'save_action', { name: 'Only one' });
for (let i = 0; i < activity.KEEP_EACH + 50; i++) activity.record(A, 'save_action', { name: `Action ${i}` });
const aKept = activity.list({ userId: 'rec-a', limit: 1000 }).length;
const bKept = activity.list({ userId: 'rec-b' }).map((e) => e.what);
activity.record(B, 'set_dock_grid', { columns: 4 });
activity.record(B, 'set_dock_grid', { columns: 5 });
const bMerged = activity.list({ userId: 'rec-b' })[0];
// Asked of the page, not taken from it: a name sent with a ban is not the record's.
activity.record(B, 'twitch_mod', { op: 'ban', userId: '1', login: 'not-who-it-was' });
const bBan = activity.list({ userId: 'rec-b' })[0];

test('moderating is on the record; looking — the chat\'s modes, a Discord screen\'s lists — is not', () => {
  assert.ok(activity.isLooking('twitch_mod', { op: 'get-chat-settings' }));
  for (const op of ['get_roles', 'get_channels', 'get_guilds', 'search_members']) assert.ok(activity.isLooking('discord', { op }), op);
  assert.ok(!activity.isLooking('twitch_mod', { op: 'ban' }));
});

test('each moderator keeps their own newest on the record, the same change again is counted, and a name the page sent is never the target', () => {
  assert.equal(aKept, activity.KEEP_EACH);
  assert.deepEqual(bKept, ['Only one'], 'the busy one did not push the quiet one off');
  assert.deepEqual([bMerged.type, bMerged.times], ['set_dock_grid', 2]);
  assert.equal(bBan.what, '', 'without the server naming them, no name at all');
});

test('the dock: a moderation menu on Twitch messages only, never on the streamer\'s own, and the steps in the editor', () => {
  const tools = read('../../web/components/ModTools.tsx');
  assert.ok(tools.includes("if (chat?.platform !== 'twitch' || !chat.userId || chat.isBroadcaster) return null;"));
  const app = read('../../web/App.tsx');
  assert.ok(app.includes('<MessageModMenu chat={chat} ask={system.actions.twitchMod} t={t} />'));
  assert.ok(app.includes('<AutomodQueue held={(system.data as any).automodHeld || []} ask={system.actions.twitchMod} t={t} />'));
  const actions = read('../../web/components/views/ActionsView.tsx');
  assert.ok(actions.includes("onClick: () => addStep('twitch_moderate')") && actions.includes("onClick: () => addStep('twitch_chat_mode')"));
});
