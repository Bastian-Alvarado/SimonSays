/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who is on the other end: the sign-in for the dashboard (2.0.0, "The
 * moderators update").
 *
 * Until now anybody who could reach the server had all of it, and the server
 * is reached from the internet too, through the Cloudflare address. So every
 * request — the live connection and the HTTP API — is asked who it comes
 * from, and gets one of these:
 *
 *   owner   the streamer: signed in with the Twitch account the app streams
 *           from, or with the owner key
 *   mod     a moderator of the streamer's Twitch channel, signed in with
 *           their own Twitch account
 *   page    a page OBS shows that only draws the stream — the canvas, the
 *           alerts, the countdown — which cannot sign in, so its link
 *           carries the page key instead
 *
 * Or nothing, and is turned away. What each may do is decided where each
 * request is handled; this decides only who it is.
 *
 * Off until the streamer turns it on (Settings → Sign-in), from a sign-in of
 * their own, so turning it on can never lock them out: the switch refuses
 * anybody who is only "owner" because sign-in is off. While off, everyone is
 * the owner, exactly as before.
 *
 * Signing in with Twitch is the browser-side flow the Connections screen
 * already uses — the page gets a token back from Twitch and hands it here.
 * Here it is asked of Twitch whose it is and which app it was given to: a
 * token issued to some other app is refused, or anybody holding one for a
 * streamer's account from anywhere could sign in as them. A moderator is
 * one Twitch lists as moderating the channel, asked with their own token;
 * that is checked again when they come back after a while, so somebody no
 * longer a moderator is no longer let in.
 *
 * Never "local" as a reason. The Cloudflare tunnel runs on the same machine
 * as the server, so every visitor from the internet arrives from here.
 */

import crypto from 'node:crypto';
import { collection } from '../core/store.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as twitch from '../platforms/twitch.js';

const log = createLogger('auth');

export const COOKIE = 'ss_session';
/** How long a sign-in lasts without being used: the streamer's a month, a moderator's a week. */
export const SESSION_DAYS = { owner: 30, mod: 7 };
/** How long a moderator is taken at their word before Twitch is asked again. */
export const MOD_RECHECK_MS = 6 * 3_600_000;
/**
 * What a sign-in asks of Twitch: which channels they moderate, chatting as
 * themselves, and moderating as themselves — banning and timing out,
 * deleting messages, the chat's modes, AutoMod's held messages — so Twitch's
 * own mod log names the moderator rather than the channel.
 */
export const SIGN_IN_SCOPES = [
  'user:read:moderated_channels', 'user:write:chat',
  'moderator:manage:banned_users', 'moderator:manage:chat_messages', 'moderator:manage:chat_settings', 'moderator:manage:automod',
];

let settings = null;
let secrets = null;
let sessions = null;
let tokens = null;
let fetchImpl = (...a) => fetch(...a);

const newKey = () => crypto.randomBytes(24).toString('base64url');

export function initAuth() {
  settings = collection('auth_settings', { enabled: false });
  // Keys and sessions are secrets: never in a backup, never in a profile (backup.js EXCLUDED).
  secrets = collection('auth_secrets', {});
  sessions = collection('auth_sessions', {});
  tokens = collection('auth_tokens', {});
  const s = secrets.get();
  if (!s.ownerKey || !s.pageKey) {
    secrets.set({ ownerKey: s.ownerKey || newKey(), pageKey: s.pageKey || newKey() });
    secrets.flush();
  }
  prune();
  log.info(isEnabled() ? 'sign-in is on' : 'sign-in is off: everyone who reaches the server is the owner');
}

export const isEnabled = () => settings?.get().enabled === true;

/**
 * The settings screen's view of it: whether it is on, and the two keys. The
 * owner key only to somebody signed in as the owner — never to an "open"
 * visitor, who is the owner only because sign-in is off, and could otherwise
 * keep a way in for after it is switched on.
 */
export const authState = (identity) => ({
  enabled: isEnabled(),
  ownerKey: identity && identity.role === 'owner' && identity.via !== 'open' ? secrets.get().ownerKey : '',
  pageKey: secrets.get().pageKey,
});

/*
  Whoever wants to know when a sign-in ends (api/ws.js), to let its open
  connections go at once rather than whenever they next reconnect.
*/
const endedListeners = new Set();
export const onSessionsEnded = (fn) => { endedListeners.add(fn); return () => endedListeners.delete(fn); };
/** Told when the owner key changes, with who changed it: a connection opened with the old key has no sign-in to end, so it is let go by this instead. */
const keyListeners = new Set();
export const onOwnerKeyChanged = (fn) => { keyListeners.add(fn); return () => keyListeners.delete(fn); };

/** End every sign-in `drop` picks, and say which. */
function dropSessions(drop) {
  const all = sessions.get();
  const gone = Object.keys(all).filter((id) => drop(all[id], id));
  if (!gone.length) return [];
  sessions.set(Object.fromEntries(Object.entries(all).filter(([id]) => !gone.includes(id))));
  sessions.flush();
  // A moderator with no sign-in left has no use for their kept Twitch token.
  const still = new Set(Object.values(sessions.get()).map((s) => s.userId).filter(Boolean));
  const leftovers = Object.keys(tokens.get()).filter((uid) => !still.has(uid));
  if (leftovers.length) { tokens.set(Object.fromEntries(Object.entries(tokens.get()).filter(([uid]) => still.has(uid)))); tokens.flush(); }
  for (const fn of endedListeners) { try { fn(gone); } catch (err) { log.warn('a sign-in listener failed:', err.message); } }
  return gone;
}

/** Equal without saying, by how long it took, how much of it was right. */
function same(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const at = part.indexOf('=');
    if (at <= 0) continue;
    // A cookie somebody else's page set badly is no reason to drop the connection: it is just not ours.
    try { out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim()); } catch { /* skipped */ }
  }
  return out;
}

/** Whether the browser reached us over HTTPS: directly, or through Cloudflare, which says so in a header. */
const isHttps = (req) => Boolean(req?.socket?.encrypted) || String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

export function sessionCookie(req, id, days) {
  return `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86_400}${isHttps(req) ? '; Secure' : ''}`;
}
export const clearCookie = (req) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps(req) ? '; Secure' : ''}`;

function prune(now = Date.now()) {
  const all = sessions.get();
  const kept = Object.fromEntries(Object.entries(all).filter(([, s]) => s && s.expiresAt > now));
  if (Object.keys(kept).length !== Object.keys(all).length) sessions.set(kept);
}

function startSession(user, role, now = Date.now()) {
  const id = newKey();
  const days = SESSION_DAYS[role] || 7;
  sessions.update((all) => ({ ...all, [id]: { ...user, role, createdAt: now, seenAt: now, checkedAt: now, expiresAt: now + days * 86_400_000 } }));
  sessions.flush();
  return { id, days };
}

const who = (s, via) => ({ role: s.role, userId: s.userId || '', login: s.login || '', name: s.name || s.login || '', via });

/**
 * Who a request comes from, or null for nobody the server will talk to: a
 * sign-in's cookie, the owner key as a script's Authorization header, or the
 * page key in a link OBS shows.
 */
export function identify(req, { now = Date.now() } = {}) {
  const open = { role: 'owner', userId: '', login: '', name: '', via: 'open' };
  const cookie = parseCookies(req?.headers?.cookie)[COOKIE];
  if (cookie) {
    const s = sessions.get()[cookie];
    // With sign-in off, a streamer's own sign-in is still theirs (it is how they turn it on); anybody else is the owner as before.
    if (s && s.expiresAt > now && (isEnabled() || s.role === 'owner')) {
      // Used, so it lasts: a sign-in in use every day never runs out.
      const days = SESSION_DAYS[s.role] || 7;
      if (now - (s.seenAt || 0) > 3_600_000) sessions.update((all) => ({ ...all, [cookie]: { ...s, seenAt: now, expiresAt: now + days * 86_400_000 } }));
      return { ...who(s, 'session'), sessionId: cookie, checkedAt: s.checkedAt || 0 };
    }
  }
  // The owner key only as a header, from a script: never in an address, where history and logs keep it.
  const header = bearer(req);
  if (header && same(header, secrets.get().ownerKey)) return { role: 'owner', userId: '', login: '', name: '', via: 'owner-key' };
  if (!isEnabled()) return open;
  const pageKey = safeUrl(req)?.searchParams.get('key');
  if (pageKey && same(pageKey, secrets.get().pageKey)) return { role: 'page', userId: '', login: '', name: '', via: 'page-key' };
  return null;
}

function safeUrl(req) {
  try { return new URL(req?.url || '/', 'http://x'); } catch { return null; }
}
function bearer(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(String(req?.headers?.authorization || ''));
  return m ? m[1] : '';
}

/*
  Where the live connection may be opened from: a page on this same address,
  or the development page beside it. Without this any website a signed-in
  streamer visited could open a connection with their cookie and drive the
  whole app.
*/
export function originAllowed(req) {
  const origin = req?.headers?.origin;
  if (!origin) return true;
  // With sign-in off there is nothing a borrowed sign-in would add, and a page pointed elsewhere with ?server= must still connect.
  if (!isEnabled()) return true;
  let o;
  try { o = new URL(origin); } catch { return false; }
  const host = String(req.headers.host || '').toLowerCase();
  if (o.host.toLowerCase() === host) return true;
  // The UI on Vite's port while developing, against a server on this machine.
  return (o.hostname === 'localhost' || o.hostname === '127.0.0.1') && /^(localhost|127\.0\.0\.1):\d+$/.test(host);
}

/** Ask Twitch whose a token is and what it may do. */
async function validate(token) {
  const res = await fetchImpl('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
  if (!res.ok) throw refusal('signin_token_bad', 'Twitch did not accept that sign-in; try again');
  return res.json();
}

/** Whether a Twitch account moderates the streamer's channel, asked with that account's own token. */
async function moderates(userId, token, channelId) {
  let cursor = '';
  for (let page = 0; page < 20; page++) {
    const url = new URL('https://api.twitch.tv/helix/moderation/channels');
    url.searchParams.set('user_id', userId);
    url.searchParams.set('first', '100');
    if (cursor) url.searchParams.set('after', cursor);
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, 'Client-Id': twitch.getCredentials().clientId } });
    if (!res.ok) throw refusal('signin_mod_check', 'Twitch would not say which channels you moderate; try again');
    const body = await res.json();
    if ((body.data || []).some((c) => String(c.broadcaster_id) === String(channelId))) return true;
    cursor = body.pagination?.cursor || '';
    if (!cursor) return false;
  }
  return false;
}

/**
 * Sign in with a token the Twitch sign-in page handed back. Answers the new
 * session, or refuses with a code the page says in its own words.
 */
export async function signInWithTwitch(token) {
  const creds = twitch.getCredentials();
  if (!creds.clientId || !creds.userId) throw refusal('signin_no_twitch', 'the streamer\'s Twitch account is not connected yet');
  const v = await validate(String(token || '').trim());
  if (String(v.client_id) !== String(creds.clientId)) throw refusal('signin_other_app', 'that sign-in was made for another app');
  const user = { userId: String(v.user_id), login: String(v.login || ''), name: String(v.login || '') };
  if (user.userId === String(creds.userId)) {
    log.info(`${user.login} signed in as the owner`);
    return { ...startSession(user, 'owner'), role: 'owner', login: user.login };
  }
  // Turned away by the streamer (the Moderators screen): a moderator of the channel, but not let in here.
  if (isBlocked(user.userId)) throw refusal('signin_blocked', 'the streamer has turned this account away from the dashboard', { channel: creds.login });
  if (!(v.scopes || []).includes('user:read:moderated_channels')) throw refusal('signin_scope', 'that sign-in did not allow reading which channels you moderate');
  if (!(await moderates(user.userId, token, creds.userId))) throw refusal('signin_not_mod', 'only moderators of this channel can sign in', { channel: creds.login });
  // Kept for asking again later, and for chatting as themselves (2.0.0).
  tokens.update((all) => ({ ...all, [user.userId]: { token, scopes: v.scopes || [], login: user.login, savedAt: Date.now() } }));
  tokens.flush();
  log.info(`${user.login} signed in as a moderator`);
  return { ...startSession(user, 'mod'), role: 'mod', login: user.login };
}

/** Sign in with the owner key: the way back in when Twitch cannot be. */
export function signInWithOwnerKey(key) {
  if (!same(key, secrets.get().ownerKey)) throw refusal('signin_key_wrong', 'that is not the owner key');
  log.info('signed in with the owner key');
  return { ...startSession({ userId: '', login: '', name: '' }, 'owner'), role: 'owner', login: '' };
}

/** Sign this browser out here and on every connection it has open. */
export function signOut(sessionId) {
  if (!sessionId || !sessions.get()[sessionId]) return false;
  return dropSessions((_s, id) => id === sessionId).length > 0;
}

/**
 * This browser signed in as the owner, while sign-in is off — which is what
 * anybody reaching the app is anyway. It is how a streamer with no Twitch
 * connected yet gets a sign-in to switch it on with; switching on then ends
 * every other sign-in (setEnabled), so one taken meanwhile does not last.
 */
export function claimOwner(identity) {
  if (isEnabled() || identity?.via !== 'open') throw refusal('signin_owner_only', 'only the streamer can change sign-in');
  log.info('signed in as the owner while sign-in is off');
  return { ...startSession({ userId: '', login: '', name: '' }, 'owner'), role: 'owner', login: '' };
}

/**
 * A moderator coming back after a while is asked about again: somebody no
 * longer a moderator, or whose Twitch sign-in has run out, is signed out.
 * Answers whether they may stay.
 */
export async function recheckMod(identity, { now = Date.now() } = {}) {
  if (identity?.role !== 'mod') return true;
  // When it was last asked is the sign-in's, not this connection's copy: a connection open for days is asked again too.
  const session = sessions.get()[identity.sessionId];
  if (!session) return false;
  // Turned away by the streamer: not let back in by a sign-in from before.
  if (isBlocked(identity.userId)) { signOut(identity.sessionId); return false; }
  if (now - (session.checkedAt || 0) < MOD_RECHECK_MS) return true;
  const saved = tokens.get()[identity.userId];
  /*
    Let go only on Twitch's word: the token refused (401 — run out, or taken
    back) or the channel no longer among theirs. Twitch not answering is not
    a reason to sign a moderator out mid-stream; they are asked again later.
  */
  let verdict = 'out';
  if (saved?.token) {
    try {
      const res = await fetchImpl('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${saved.token}` } });
      if (res.status === 401) verdict = 'out';
      else if (!res.ok) verdict = 'later';
      else if (String((await res.json()).user_id) !== String(identity.userId)) verdict = 'out';
      else verdict = (await moderates(identity.userId, saved.token, twitch.getCredentials().userId)) ? 'in' : 'out';
    } catch { verdict = 'later'; }
  }
  if (verdict === 'later') return true;
  if (verdict === 'out') {
    signOut(identity.sessionId);
    log.info(`${identity.login} is no longer let in: not a moderator any more, or their Twitch sign-in ran out`);
    return false;
  }
  sessions.update((all) => (all[identity.sessionId] ? { ...all, [identity.sessionId]: { ...all[identity.sessionId], checkedAt: now } } : all));
  return true;
}

// ------------------------------------------------------------ the moderators

/** Moderators the streamer has turned away: [{ userId, login, at }]. A moderator of the channel all the same, just not let in here. */
const blockedList = () => settings.get().blocked || [];
export const isBlocked = (userId) => blockedList().some((b) => b.userId === String(userId));

/** Every moderator who has signed in, by their Twitch account: how many sign-ins, since when, last seen. */
export function moderators() {
  const byUser = new Map();
  for (const s of Object.values(sessions.get())) {
    if (s?.role !== 'mod' || !s.userId) continue;
    const m = byUser.get(s.userId) || { userId: s.userId, login: s.login || '', name: s.name || s.login || '', sessions: 0, since: Infinity, seenAt: 0 };
    m.sessions += 1;
    m.since = Math.min(m.since, s.createdAt || Infinity);
    m.seenAt = Math.max(m.seenAt, s.seenAt || 0);
    byUser.set(s.userId, m);
  }
  return {
    signedIn: [...byUser.values()].map((m) => ({ ...m, since: Number.isFinite(m.since) ? m.since : 0 })).sort((a, b) => b.seenAt - a.seenAt),
    blocked: blockedList(),
  };
}

/** Sign a moderator out everywhere: every browser they are signed in on. */
export function signOutUser(userId, identity) {
  if (identity?.role !== 'owner') throw refusal('signin_owner_only', 'only the streamer can change sign-in');
  return dropSessions((s) => s.userId === String(userId)).length;
}

/** Turn a moderator away from the dashboard, or let them back in. Turned away, they are signed out at once. */
export function setBlocked(userId, blocked, identity, login = '') {
  if (identity?.role !== 'owner') throw refusal('signin_owner_only', 'only the streamer can change sign-in');
  const id = String(userId || '');
  if (!id) throw refusal('unknown_request', 'no moderator named');
  const rest = blockedList().filter((b) => b.userId !== id);
  settings.set({ ...settings.get(), blocked: blocked ? [...rest, { userId: id, login: String(login || '').slice(0, 40), at: Date.now() }] : rest });
  settings.flush();
  if (blocked) dropSessions((s) => s.userId === id);
  log.info(`${login || id} ${blocked ? 'turned away from' : 'let back into'} the dashboard`);
  return moderators();
}

/**
 * What a moderator chats on Twitch with: their own sign-in's token, if it
 * may write to chat. Nothing for anybody else — the streamer chats through
 * the app's own connection.
 */
export function modChatToken(identity) {
  if (identity?.role !== 'mod' || !identity.userId) return {};
  const saved = tokens.get()[identity.userId];
  if (!saved?.token || !(saved.scopes || []).includes('user:write:chat')) return { userId: identity.userId };
  return { token: saved.token, userId: identity.userId };
}

/**
 * What a moderator moderates with (engine/twitch-mod.js): their own sign-in's
 * token when it allows `scope`, or null — a sign-in from before moderating
 * was asked for — for the channel's login to act instead.
 */
export function modActingToken(identity, scope) {
  if (identity?.role !== 'mod' || !identity.userId) return null;
  const saved = tokens.get()[identity.userId];
  return saved?.token && (saved.scopes || []).includes(scope) ? { token: saved.token, userId: identity.userId } : null;
}

/**
 * Turn sign-in on or off. Only somebody who would still be the owner with
 * it on may: from a sign-in of their own, or the owner key — never merely
 * because it is off, or turning it on would lock out the one who did it.
 */
export function setEnabled(enabled, identity) {
  if (identity?.role !== 'owner') throw refusal('signin_owner_only', 'only the streamer can change sign-in');
  if (enabled && identity.via === 'open') throw refusal('signin_first', 'sign in first, so turning this on cannot lock you out');
  if (enabled && !isEnabled()) {
    /*
      While it was off, anybody who reached the app was the owner, and could
      have signed in as one or read the owner key. Switching on is where that
      ends: a new owner key, and every sign-in but the one switching it on
      let go. Moderators and the streamer sign in again; the page key stays,
      so the links in OBS keep working.
    */
    secrets.set({ ...secrets.get(), ownerKey: newKey() });
    secrets.flush();
    dropSessions((_s, id) => id !== identity.sessionId);
  }
  settings.set({ ...settings.get(), enabled: Boolean(enabled) });
  settings.flush();
  log.info(`sign-in turned ${enabled ? 'on' : 'off'}`);
  return authState(identity);
}

/** A new page key (every OBS link changes) or owner key (the old one stops working, and so does every sign-in made with it). */
export function newSecret(which, identity) {
  if (identity?.role !== 'owner' || identity.via === 'open') throw refusal('signin_owner_only', 'only the streamer can change sign-in');
  if (which !== 'pageKey' && which !== 'ownerKey') throw refusal('unknown_request', `no key called ${which}`);
  secrets.set({ ...secrets.get(), [which]: newKey() });
  secrets.flush();
  // A sign-in made with the owner key has no Twitch account to it; with a new key, those end — but not the one asking.
  if (which === 'ownerKey') {
    dropSessions((s, id) => s.role === 'owner' && !s.userId && id !== identity.sessionId);
    for (const fn of keyListeners) { try { fn(identity); } catch (err) { log.warn('a sign-in listener failed:', err.message); } }
  }
  return authState(identity);
}

/** For tests: a Twitch that answers what the test says. */
export const _test = {
  setFetch: (fn) => { fetchImpl = fn; },
  sessions: () => sessions.get(),
  tokens: () => tokens.get(),
  /** Make a sign-in look as if it was last asked about long ago. */
  age: (sessionId, ms) => sessions.update((all) => (all[sessionId] ? { ...all, [sessionId]: { ...all[sessionId], checkedAt: all[sessionId].checkedAt - ms } } : all)),
};
