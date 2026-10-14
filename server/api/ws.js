/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * WebSocket hub.
 *
 * Every connected surface — the config UI, the chat dock, the OBS overlay,
 * a second monitor — gets the same stream. Clients are pure subscribers:
 * they never own state, so opening or closing one changes nothing about how
 * the stack behaves.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { isSameMachine } from '../core/net.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as auth from './auth.js';
import * as modDecks from '../engine/mod-decks.js';
import * as modActivity from '../engine/mod-activity.js';
import * as twitchMod from '../engine/twitch-mod.js';
import * as home from '../engine/home.js';
import { getCollection, collection } from '../core/store.js';
import { C2S, S2C } from '../../shared/protocol.js';
import { VERSION } from '../../shared/version.js';
import { liveLayout } from '../../shared/live-layout.js';
import { formatLayout } from '../../shared/layout-formats.js';
import { connectAlertGate, offerAlert, alertGateState, controlAlerts } from '../engine/alert-gate.js';
import * as engine from '../engine/index.js';
import * as tags from '../engine/tags.js';
import * as discordRoles from '../engine/discord-roles.js';
import * as roleSync from '../engine/role-sync.js';
import { previewCard } from '../engine/welcome-card.js';
import { testGreeting, previewFacts } from '../engine/welcome.js';
import * as announcer from '../engine/announce.js';
import * as scheduleEvents from '../engine/schedule-events.js';
import * as discordPages from '../engine/discord-pages.js';
import * as viewerHistory from '../engine/viewer-history.js';
import * as points from '../engine/points.js';
import * as profileCard from '../engine/profile-card.js';
import * as highlights from '../engine/highlights.js';
import * as liveDms from '../engine/live-dms.js';
import * as remotePlayers from '../engine/remote-players.js';
import * as updater from '../engine/updater.js';
import * as discordQuestions from '../engine/discord-questions.js';
import * as gameRequests from '../engine/game-requests.js';
import * as moderation from '../engine/moderation.js';
import * as streamSessions from '../engine/stream-sessions.js';
import * as subscribers from '../engine/subscribers.js';
import * as twitch from '../platforms/twitch.js';
import * as tiktok from '../platforms/tiktok.js';
import * as discord from '../platforms/discord.js';
import * as discordVoice from '../platforms/discord-voice.js';
import * as obs from '../platforms/obs.js';
import * as spotify from '../platforms/spotify.js';
import * as youtube from '../platforms/youtube.js';
import * as tts from '../platforms/tts.js';
import * as droidcam from '../platforms/droidcam.js';
import * as leveling from '../leveling/index.js';

const log = createLogger('ws');

const clients = new Set();
/** How long XP gathers before the leaderboard goes out again. */
export const LEADERBOARD_EVERY_MS = 5_000;
let wss = null;

// Last connections payload actually sent, so a status event that changed
// nothing about them does not rebroadcast the whole thing. See wireBusToClients.
let lastConnectionsJson = '';

/**
 * The pages open now, by kind — the stream page, the chat dock, the alerts
 * page — and how many of each are inside OBS, which a page can tell for
 * itself (OBS's browser gives it `window.obsstudio`). The Guides checklist
 * ticks "the stream page is in OBS" from this instead of asking.
 */
export function countSurfaces(list) {
  const out = { canvas: 0, dock: 0, alerts: 0, canvasInObs: 0, dockInObs: 0, alertsInObs: 0, vertical: 0, verticalInObs: 0 };
  for (const c of list) {
    if (!c || !(c.mode in out)) continue;
    out[c.mode] += 1;
    if (c.inObs) out[`${c.mode}InObs`] += 1;
    // The canvases drawing the vertical side, counted again on their own.
    if (c.mode === 'canvas' && c.format === 'vertical') {
      out.vertical += 1;
      if (c.inObs) out.verticalInObs += 1;
    }
  }
  return out;
}
/*
  When each kind of page was last seen inside OBS, kept on the server: OBS
  is closed between streams, and a setup step that only counted what is open
  now went back to undone every time it was — on every browser that had not
  seen it open itself. Remembered once, here, it stays done for all of them.
*/
let seenDb = null;
const seenStore = () => (seenDb ??= collection('surfaces_seen', {}));
function rememberSeen(counts) {
  const was = seenStore().get();
  const now = Date.now();
  const next = { ...was };
  for (const k of ['canvasInObs', 'dockInObs', 'alertsInObs']) if (counts[k] > 0 && !was[k]) next[k] = now;
  if (Object.keys(next).length !== Object.keys(was).length) seenStore().set(next);
  return next;
}
const surfacesNow = () => {
  const counts = countSurfaces([...clients].filter(isOpen));
  return { ...counts, seen: rememberSeen(counts) };
};
let lastSurfacesJson = '';
/** Tells every page when what is open changed: a page arriving, saying what it is, or going. */
function publishSurfaces() {
  const next = surfacesNow();
  const json = JSON.stringify(next);
  if (json === lastSurfacesJson) return;
  lastSurfacesJson = json;
  broadcast(S2C.CONFIG_PATCH, { surfaces: next });
}

/**
 * The single client that performs audio and speech.
 *
 * Speech is a browser capability, so the server delegates it — but to one
 * surface only, or every open tab reads the same message aloud.
 *
 * Preference, in order:
 *   1. a surface that shows the alerts — the alerts page, or a layout on the
 *      canvas with an alerts layer — so an alert is read
 *      out by the page showing it, in step with it, and TTS lives with the
 *      alerts in OBS rather than needing the dock open; of two that do, the
 *      horizontal overlay before the vertical one, since OBS's main canvas
 *      is the one sure to carry its sound
 *   2. the chat dock — the surface meant to stay open, and its audio is
 *      picked up by a desktop-audio capture so the stream hears it too
 *   3. a client on this machine — a phone opening the dashboard should not
 *      start reading chat aloud in someone's pocket
 *   4. the oldest connection, so the choice is deterministic
 *
 * This is a preference, not a rule: if nothing showing alerts is open, audio
 * falls through to the dock, and then to whatever is connected, rather than
 * going silent. Two alert pages open still resolve to one, because the
 * tiebreaks continue past the first test.
 */
let audioSink = null;

const isOpen = (ws) => ws && ws.readyState === WebSocket.OPEN;

/**
 * The layout a canvas draws: the one its link names, or — naming none, the
 * link the Overlays screen hands out first — whatever is on stream, by the
 * same rule the page itself uses (liveLayout), from the OBS scene and the
 * Omnilayer as they are now.
 */
export function canvasLayout(client, layouts = [], scene = '', omnilayer = null) {
  if (client?.layoutId) return layouts.find((l) => l.id === client.layoutId) || null;
  return liveLayout(layouts, scene, omnilayer);
}

/**
 * Does this surface show the alerts? The alerts page always does; a canvas
 * does when its layout has a visible alerts layer. The chat overlay does not:
 * it is chat only, since beside either of those it showed every alert twice.
 */
export function showsAlerts(client, layouts = [], scene = '', omnilayer = null) {
  if (client?.mode === 'alerts') return true;
  if (client?.mode !== 'canvas') return false;
  // As this canvas draws it: an alerts layer kept to the other shape is not on this one.
  const layout = formatLayout(canvasLayout(client, layouts, scene, omnilayer), client?.format);
  return Boolean(layout?.layers?.some((l) => l.type === 'alerts' && l.visible !== false));
}

/** Is `a` a better audio surface than `b`? `live` is the OBS scene and the Omnilayer, for a canvas that follows them. */
export function preferred(a, b, layouts = [], live = {}) {
  const aAlerts = showsAlerts(a, layouts, live.scene, live.omnilayer);
  const bAlerts = showsAlerts(b, layouts, live.scene, live.omnilayer);
  if (aAlerts !== bAlerts) return aAlerts;
  // Between two that show them, the horizontal overlay: OBS's main canvas is the one sure to carry its sound.
  const aVertical = a.format === 'vertical';
  const bVertical = b.format === 'vertical';
  if (aVertical !== bVertical) return bVertical;
  const aDock = a.mode === 'dock';
  const bDock = b.mode === 'dock';
  if (aDock !== bDock) return aDock;
  if (a.isLocal !== b.isLocal) return a.isLocal;
  return a.connectedAt < b.connectedAt;
}

/** The OBS scene and the Omnilayer as they are now, for a canvas that follows them. */
const liveNow = () => ({ scene: obs.currentScene(), omnilayer: engine.store.omnilayerState?.() || null });

/** One alert out to every page: what to read and the sound only to the one that speaks. */
function deliverAlert(a) {
  const sink = ensureAudioSink();
  const { speak, ...shown } = a;
  for (const ws of clients) if (isOpen(ws)) send(ws, S2C.ALERT, ws === sink ? { ...a, audible: true } : shown);
}

function ensureAudioSink() {
  // Recomputed every time rather than sticking with the incumbent, so a dock
  // opened after the dashboard takes over instead of being ignored. The
  // comparator is total, so equal inputs always yield the same winner.
  let best = null;
  const layouts = engine.store.getLayouts?.() || [];
  // Asked again on every call, so a canvas following the scene speaks for whatever the scene is now.
  const live = liveNow();
  for (const ws of clients) {
    if (!isOpen(ws)) continue;
    if (!best || preferred(ws, best, layouts, live)) best = ws;
  }

  if (best !== audioSink) {
    audioSink = best;
    if (best) {
      log.info(`audio output -> ${best.mode} client (${best.isLocal ? 'local' : best.remoteLabel})`);
    }
  }
  return audioSink;
}

export function initWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  // `ws` forwards the HTTP server's 'error' events onto this emitter. Without
  // a listener here, EventEmitter throws on the re-emit — which happens
  // *before* the http server's own error handler runs, turning a clean
  // "port in use" message into an uncaught exception. Log and let the
  // http server's handler decide whether the error is fatal.
  wss.on('error', (err) => log.error('websocket server error:', err.message));

  wss.on('connection', (ws, req) => {
    // Who it is (api/auth.js), before anything is said: another website's page cannot borrow a sign-in, and nobody is let in unknown.
    let who = null;
    try {
      if (!auth.originAllowed(req)) { ws.close(4403, 'not from this address'); return; }
      who = auth.identify(req);
    } catch (err) {
      // Never left open and unknown: a connection the server could not place is closed.
      log.warn('could not tell who a connection was:', err.message);
      ws.close(1011, 'try again');
      return;
    }
    if (!who) { ws.close(4401, 'sign in first'); return; }
    ws.who = who;
    // A moderator back after a while is asked about again first; until that is answered, what they send waits.
    ws.ready = who.role === 'mod' ? auth.recheckMod(who) : Promise.resolve(true);

    const addr = req.socket.remoteAddress || '';
    // Loopback *or* this machine's own LAN address: the dashboard is normally
    // opened at the latter, since that is the URL the docks and the deck use.
    ws.isLocal = isSameMachine(addr);
    ws.connectedAt = Date.now();
    ws.remoteLabel = addr;
    // Replaced by the real value when HELLO arrives a moment later.
    ws.mode = 'dashboard';

    ws.isAlive = true;

    // Told the stream only once it is known who it is.
    ws.ready.then((ok) => {
      if (!ok) { ws.close(4401, 'sign in again'); return; }
      if (ws.readyState !== WebSocket.OPEN) return;
      clients.add(ws);
      log.info(`client connected (${clients.size} total) from ${addr}${who.via === 'open' ? '' : ` as ${who.login || who.role}`}`);
      send(ws, S2C.ME, meOf(ws));
      send(ws, S2C.SNAPSHOT, buildSnapshot());
    });

    ws.on('pong', () => { ws.isAlive = true; });
    // Nothing more from a connection whose sign-in ended, in the moment before it is gone (ws.revoked, below).
    ws.on('message', (raw) => { ws.ready.then((ok) => ok && !ws.revoked && ws.readyState === WebSocket.OPEN && handleMessage(ws, raw)); });
    ws.on('close', () => {
      clients.delete(ws);
      // Re-elected lazily on the next device action.
      if (audioSink === ws) audioSink = null;
      log.info(`client disconnected (${clients.size} remaining)`);
      publishSurfaces();
    });
    ws.on('error', (err) => log.warn('client socket error:', err.message));
  });

  // Drop half-open connections so `clients` reflects reality.
  const heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (!ws.isAlive) { ws.terminate(); clients.delete(ws); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* terminated below on next sweep */ }
      // A moderator connected for hours is asked about again too, when theirs is due (auth.recheckMod says when).
      if (ws.who?.role === 'mod') auth.recheckMod(ws.who).then((ok) => { if (!ok) letGo(ws, 'sign in again'); }).catch(() => {});
    }
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeat));

  // A sign-in ended — signed out, a moderator let go, the owner key changed, sign-in switched on: its connections go now.
  auth.onSessionsEnded((ids) => {
    for (const c of clients) if (c.who?.sessionId && ids.includes(c.who.sessionId)) letGo(c);
  });

  wireBusToClients();
  log.info('hub ready');
}

// ------------------------------------------------------------- broadcasting

function send(ws, type, payload, meta = {}) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, payload: forViewer(ws, type, payload), ...meta }));
}

/**
 * What one connection is sent of a snapshot or a change: a page OBS shows
 * without what is not for it (forPage), a moderator with their own dock and
 * deck in place of the streamer's (engine/mod-decks.js), anybody else as it is.
 */
function forViewer(ws, type, payload) {
  if (ws.who?.role === 'page') return forPage(type, payload);
  if (ws.who?.role === 'mod') return forMod(ws.who.userId, type, payload);
  return payload;
}
function forMod(userId, type, payload) {
  if (![S2C.SNAPSHOT, S2C.CONFIG_PATCH, S2C.REPLY].includes(type) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  // The deck goes with the actions: a change to them can take a button with it, so the moderator's deck is read again.
  const touches = modDecks.MOD_OWN.some((k) => k in payload) || (type !== S2C.REPLY && 'streamActions' in payload);
  if (!touches) return payload;
  const own = modDecks.dockFor(userId);
  const out = { ...payload };
  for (const k of modDecks.MOD_OWN) if (k in payload || type === S2C.SNAPSHOT || (k === 'dockButtons' && 'streamActions' in payload)) out[k] = own[k];
  return out;
}

/** A Twitch chatter's name by their id, from the chat the server has seen. */
function chatterName(userId) {
  const hit = (getCollection('recent_chat')?.get() || []).find((m) => m?.platform === 'twitch' && String(m.userId) === String(userId));
  return hit ? String(hit.user || '') : '';
}

/** An action's or a command's name, by its id, for the record of what a moderator did. */
function nameOf(id) {
  const all = [...(getCollection('actions')?.get() || []), ...(getCollection('commands')?.get() || [])];
  const hit = all.find((x) => x?.id === id);
  return hit ? String(hit.name || hit.trigger || '') : '';
}

/**
 * The Moderators screen's list: everybody who has signed in as a moderator,
 * whether they are here now (an open connection), whether they made the dock
 * their own, and who is turned away.
 */
function moderatorsNow() {
  const { signedIn, blocked } = auth.moderators();
  const online = new Map();
  for (const c of clients) if (c.who?.role === 'mod' && c.who.userId) online.set(c.who.userId, (online.get(c.who.userId) || 0) + 1);
  return {
    enabled: auth.isEnabled(),
    moderators: signedIn.map((m) => ({ ...m, online: online.get(m.userId) || 0, ownDock: modDecks.hasOwn(m.userId) })),
    blocked,
  };
}

/** A connection whose sign-in has ended: refused from now on (the message handler checks), and closed. */
function letGo(c, reason = 'signed out') {
  c.revoked = true;
  try { c.close(4401, reason); } catch { /* already closing */ }
}

/** Something only one moderator's connections are to hear: a change to their own dock. */
function sendToUser(userId, type, payload) {
  for (const ws of clients) if (ws.who?.userId === userId && ws.who?.role === 'mod') send(ws, type, payload);
}

/*
  What a page OBS shows is not sent: it draws the stream, and its key sits in
  every link pasted into OBS — and from there into a screenshot or a help
  chat. Not the actions' steps (a web request's headers, a webhook's
  address), the dock's buttons, the relays, the Discord settings and logs,
  the moderation log, the private go-live list or the updates.
*/
const PAGE_HIDDEN = [
  'streamActions', 'laterSteps', 'dockButtons', 'dockGrid', 'relayConfig', 'twitchScopes',
  'reactionRoleConfigs', 'discordButtonConfigs', 'welcomeGoodbyeConfig', 'roleMappings', 'roleActivityLog',
  'roleSyncLog', 'pendingLinks', 'liveDms', 'announce', 'updates', 'moderation', 'moderationLog', 'automodHeld',
];
function forPage(type, payload) {
  if (![S2C.SNAPSHOT, S2C.CONFIG_PATCH, S2C.REPLY].includes(type) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (!PAGE_HIDDEN.some((k) => k in payload)) return payload;
  const out = { ...payload };
  for (const k of PAGE_HIDDEN) delete out[k];
  return out;
}

/**
 * Snapshot keys that belong to a profiled collection.
 *
 * A profile's "unsaved changes" marker is derived by comparing the live
 * collections against the saved copy, so it goes stale the moment any of them
 * changes. Recomputing it here rather than in each of the thirty-odd handlers
 * that save something is the only version of this that cannot be forgotten
 * when a thirty-first is added.
 */
const PROFILED_KEYS = new Set([
  'commands', 'streamActions', 'dockButtons', 'alertConfigs', 'layouts', 'omnibar', 'omnibars', 'viewers', 'avatarSources',
]);

export function broadcast(type, payload) {
  let body = payload;
  if (type === S2C.CONFIG_PATCH && payload && typeof payload === 'object'
      && !('profiles' in payload)
      && Object.keys(payload).some((k) => PROFILED_KEYS.has(k))) {
    try { body = { ...payload, profiles: engine.store.profileSummary() }; } catch { /* keep the patch */ }
  }
  const frame = JSON.stringify({ type, payload: body });
  // The pages OBS shows get theirs without what is not for them (forPage), made once for all of them.
  let pageFrame = null;
  // And each moderator theirs, with their own dock (forMod), made once for each of them.
  const modFrames = new Map();
  for (const ws of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (ws.who?.role === 'page') {
      const trimmed = forPage(type, body);
      pageFrame ??= trimmed === body ? frame : JSON.stringify({ type, payload: trimmed });
      ws.send(pageFrame);
    } else if (ws.who?.role === 'mod') {
      const uid = ws.who.userId;
      if (!modFrames.has(uid)) {
        const own = forMod(uid, type, body);
        modFrames.set(uid, own === body ? frame : JSON.stringify({ type, payload: own }));
      }
      ws.send(modFrames.get(uid));
    } else ws.send(frame);
  }
}

/**
 * Every page let go, for a shutdown: an open socket keeps the HTTP server
 * from closing, so without this every stop waited out its timer. The pages
 * reconnect by themselves to whatever starts next.
 */
export function closeWebSocket() {
  for (const ws of clients) { try { ws.terminate(); } catch { /* already gone */ } }
  clients.clear();
  try { wss?.close(); } catch { /* never opened */ }
}

function wireBusToClients() {
  bus.on(EVENTS.CHAT, (m) => broadcast(S2C.CHAT, m));
  bus.on(EVENTS.EVENT, (e) => broadcast(S2C.EVENT, e));
  /*
    An alert goes through the gate (engine/alert-gate.js), which holds it
    while alerts are paused or nothing on stream shows them, and lets it out
    here. Every surface shows it; only the one that speaks is told what to
    read and allowed to play its sound, so an alert is heard once — not once
    per tab, and not twice when the alerts page and a stream page are both in
    OBS.
  */
  connectAlertGate({
    deliver: deliverAlert,
    anyoneShows: () => {
      const layouts = engine.store.getLayouts?.() || [];
      const live = liveNow();
      return [...clients].some((ws) => isOpen(ws) && showsAlerts(ws, layouts, live.scene, live.omnilayer));
    },
    // OBS is open when one of its pages is: a stream page or the alerts page.
    streamOpen: () => [...clients].some((ws) => isOpen(ws) && (ws.mode === 'canvas' || ws.mode === 'alerts')),
    tellPages: (p) => broadcast(S2C.ALERT_CONTROL, p),
  });
  bus.on(EVENTS.ALERT, (a) => offerAlert(a));
  bus.on(EVENTS.TAGS, (t) => broadcast(S2C.TAGS, t));
  bus.on(EVENTS.STATUS, (s) => {
    broadcast(S2C.STATUS, s);

    // Connection metadata travels alongside status: logging in resolves an
    // avatar and display name, and the Connections screen renders those.
    // Without this the UI showed a bare "Connected" until the next reload.
    //
    // But only when it has actually changed. Status is not a rare event —
    // Spotify's poller emits one every 3 seconds to drive the Now Playing
    // progress bar, which has no local timer and so depends on those updates.
    // This payload embeds Discord's entire metadata cache (measured at 129.5KB
    // against real data), so resending it per tick cost roughly 152MB per
    // client per hour and rebuilt the snapshot object on every surface,
    // overlays included, three times a minute.
    //
    // New clients do not depend on this: they receive connections in the
    // snapshot they get on HELLO.
    broadcastConnections();
  });
  bus.on(EVENTS.LEVELUP, (l) => broadcast(S2C.XP_LEVELUP, l));
  /*
    The board, as XP comes in: gathered for a few seconds, so a busy chat
    sends it a few times a minute rather than with every message. The board
    alone — the whole user list goes only to the Levels screen when asked.
  */
  let boardTimer = null;
  bus.on('xp:changed', () => {
    if (boardTimer) return;
    boardTimer = setTimeout(() => {
      boardTimer = null;
      broadcast(S2C.XP_DATA, { leaderboard: leveling.leaderboard() });
    }, LEADERBOARD_EVERY_MS);
    boardTimer.unref?.();
  });
  bus.on(EVENTS.AVATARS, (a) => broadcast(S2C.AVATARS, a));
  bus.on(EVENTS.STAT, () => broadcast(S2C.STATS, tags.getStats()));
  bus.on(EVENTS.CHAT_DELETE, (d) => broadcast(S2C.CHAT_DELETE, d));

  // Config the clients hold a copy of, changed server-side. EVENTS.CONFIG was
  // declared on the bus from the start but never connected to anything, so
  // anything emitting one reached nobody.
  bus.on(EVENTS.CONFIG, ({ key, value }) => broadcast(S2C.CONFIG_PATCH, { [key]: value }));

  // Browser-only side effects (speech synthesis, audio playback).
  //
  // These go to exactly ONE client, never broadcast. Every connected surface
  // — dashboard, chat dock, OBS overlay — would otherwise speak the same
  // message, so TTS was read once per open tab.
  bus.on(EVENTS.DEVICE, (d) => {
    const sink = ensureAudioSink();
    if (!sink) {
      log.warn(`device action "${d.kind}" requested but no client is connected to perform it`);
      return;
    }
    // A Play sound step's file goes the same way: to the one surface that speaks, as alert sounds do.
    send(sink, d.kind === 'play_audio' ? S2C.PLAY_AUDIO : d.kind === 'play_sound' ? S2C.PLAY_SOUND : S2C.PLAY_TTS, d);
  });
}

/**
 * Broadcast the connections blob, but only when it actually differs from what
 * clients were last sent. Every path that publishes connections goes through
 * here so the cache cannot drift: a direct `broadcast` elsewhere would leave
 * `lastConnectionsJson` stale and cost one redundant resend on the next
 * status event.
 */
function broadcastConnections() {
  const next = buildConnections();
  const json = JSON.stringify(next);
  if (json === lastConnectionsJson) return;
  lastConnectionsJson = json;
  broadcast(S2C.CONFIG_PATCH, { connections: next });
}

function buildConnections() {
  return {
    twitch: twitch.getCredentials(),
    tiktok: tiktok.getCredentials(),
    discord: discord.getSettings(),
    obs: obs.getCredentials(),
    spotify: spotify.getSettings(),
    youtube: youtube.getSettings(),
    ai: tts.getSettings(),
    droidcam: droidcam.getSettings(),
  };
}

function buildSnapshot() {
  return {
    ...engine.snapshot(),
    // What AutoMod is holding back, for the docks to decide on.
    automodHeld: twitchMod.heldNow(),
    // The stream on now, for the home screen: since when, called what.
    streamNow: streamSessions.streamNow(),
    // The home screen's layout buttons: the streamer's here, a moderator's own in forMod.
    homeLayouts: home.homeLayouts(),
    // Paused, how many wait, and whether alerts nothing shows are held.
    alertGate: alertGateState(),
    ...discordRoles.snapshot(),
    ...roleSync.snapshot(),
    announce: announcer.getAnnounce(),
    ...scheduleEvents.snapshot(),
    ...discordPages.snapshot(),
    ...viewerHistory.snapshot(),
    ...points.snapshot(),
    ...profileCard.snapshot(),
    ...highlights.snapshot(),
    ...liveDms.snapshot(),
    ...remotePlayers.snapshot(),
    ...updater.snapshot(),
    ...discordQuestions.snapshot(),
    ...gameRequests.snapshot(),
    ...moderation.snapshot(),
    ...subscribers.snapshot(),
    stats: tags.getStats(),
    xpConfig: leveling.getConfig(),
    leaderboard: leveling.leaderboard(),
    status: {
      twitch: twitch.getStatus(),
      tiktok: tiktok.getStatus(),
      discord: discord.getStatus(),
      obs: obs.getStatus(),
      spotify: spotify.getStatus(),
      youtube: youtube.getStatus(),
    },
    connections: buildConnections(),
    voice: discordVoice.getState(),
    surfaces: surfacesNow(),
    // The server's version, so a page loaded before an update can tell it is older.
    serverVersion: VERSION,
  };
}

// ------------------------------------------------------------------ inbound

/** Who this connection is, for its own page: the role it has and whether sign-in is on at all. */
const meOf = (ws) => ({ role: ws.who?.role || 'owner', login: ws.who?.login || '', name: ws.who?.name || '', via: ws.who?.via || 'open', signIn: auth.isEnabled() });

/*
  What each sign-in may send. A page OBS shows only draws the stream, so it
  only says what it is and asks for the state. A moderator may do nearly
  everything (the 2.0.0 plan); these stay the streamer's:
    - their connections and accounts, the sign-in itself, backups and updates;
    - the overlays: a moderator sees every layout and look, and can put a
      layout live, but changes none of them (what runs in them during a
      stream — the omnibar's bars, the viewer counter, the alerts — is
      theirs to run, as the 2.0.0 plan has it) — nor the named pixel avatars
      the layouts wear, the PNGtuber's settings, or Omnilayer's;
    - the profiles: a moderator looks at another one (PROFILE_PEEK) without
      switching, saving, or changing which is live for the streamer.
  Some messages are both: an Omnilayer "go" or a PNGtuber face is running
  the stream, its settings are not. Those are told apart by their op.
*/
const PAGE_MAY = new Set([C2S.HELLO, C2S.GET_SNAPSHOT]);
const OWNER_ONLY = new Set([
  C2S.SET_CREDENTIALS, C2S.PLATFORM_CONNECT, C2S.PLATFORM_DISCONNECT,
  C2S.SPOTIFY_EXCHANGE_CODE, C2S.YOUTUBE_EXCHANGE_CODE, C2S.YOUTUBE_SET_SETTINGS, C2S.YOUTUBE_LOGOUT,
  C2S.CONFIG_EXPORT, C2S.CONFIG_IMPORT, C2S.UPDATES, C2S.PIXEL_AVATARS,
  C2S.SET_LAYOUTS, C2S.USER_THEMES, C2S.AVATAR_SOURCES, C2S.MODERATORS, C2S.DROIDCAM_SETTINGS,
  C2S.PROFILE_SWITCH, C2S.PROFILE_CREATE, C2S.PROFILE_DUPLICATE, C2S.PROFILE_RENAME, C2S.PROFILE_DELETE, C2S.PROFILE_CAPTURE, C2S.PROFILE_REVERT,
]);
/** And the ops a moderator may not send in one that is otherwise theirs: signing the app in to Discord is the streamer's, like the other accounts. */
const MOD_NOT_OPS = {
  [C2S.DISCORD]: ['exchange_code'],
};
/** The ops a moderator may send in a message that is otherwise the streamer's settings. */
const MOD_OPS = {
  [C2S.OMNILAYER]: ['go', 'inspect', 'canvases'],
  [C2S.MIC]: ['meter', 'face', 'dress', 'undress', 'action'],
};
export function mayAsk(who, type, payload) {
  if (!who) return false;
  if (who.role === 'owner') return true;
  if (who.role === 'page') return PAGE_MAY.has(type);
  if (who.role === 'mod') {
    if (MOD_OPS[type]) return MOD_OPS[type].includes(payload?.op);
    if (MOD_NOT_OPS[type]?.includes(payload?.op)) return false;
    return type === C2S.AUTH || !OWNER_ONLY.has(type);
  }
  return false;
}

async function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch (err) {
    log.warn('client sent unparseable frame:', err.message);
    return;
  }

  const { type, payload = {}, id } = msg;
  const reply = (result) => {
    // Carried out: on the record, if it was a moderator's and it changed something (engine/mod-activity.js).
    if (ws.who?.role === 'mod') {
      try {
        // Who it was done to, for moderating: as the chat the server saw names them, by the id acted on.
        const target = type === C2S.TWITCH_MOD && payload?.userId ? (chatterName(payload.userId) || `#${payload.userId}`) : '';
        modActivity.record(ws.who, type, payload, { names: nameOf, target });
      } catch (err) { log.warn('could not keep what a moderator did:', err.message); }
    }
    if (id) send(ws, S2C.REPLY, result, { id });
  };
  const fail = (err) => {
    log.warn(`"${type}" failed: ${err.message}`);
    // A code, where there is one, lets the screen say it in its own language.
    if (id) send(ws, S2C.ERROR, { message: err.message, ...(err.code ? { code: err.code } : {}), ...(err.vars ? { vars: err.vars } : {}) }, { id });
  };

  try {
    if (!mayAsk(ws.who, type, payload)) throw refusal('signin_not_allowed', `"${type}" is not for this sign-in`);
    switch (type) {
      // -------- sign-in (api/auth.js), the streamer's own
      case C2S.AUTH: {
        const op = payload?.op;
        if (op === 'get') {
          // The owner key only to a sign-in of the owner's own (authState): never to somebody who is the owner only because sign-in is off.
          if (ws.who?.role !== 'owner') throw refusal('signin_owner_only', 'only the streamer can change sign-in');
          return reply(auth.authState(ws.who));
        }
        if (op === 'enable') {
          const state = auth.setEnabled(payload.on === true, ws.who);
          reply(state);
          // Everybody asked again who they are: with it on, somebody not signed in is let go; with it off, everyone is the owner again.
          setTimeout(() => { for (const c of clients) if (c !== ws) c.close(4001, 'sign-in changed'); }, 200);
          return;
        }
        if (op === 'new-key') {
          const state = auth.newSecret(payload.which, ws.who);
          reply(state);
          // A new page key: the OBS pages on the old one are let go, and the links have to be pasted again.
          if (payload.which === 'pageKey') for (const c of clients) if (c.who?.role === 'page') letGo(c, 'page key changed');
          return;
        }
        if (op === 'signout') {
          reply({ ok: true });
          // Its connections are let go by the sign-in itself ending (onSessionsEnded, below).
          if (ws.who?.sessionId) auth.signOut(ws.who.sessionId);
          return;
        }
        throw refusal('unknown_request', `no sign-in op "${op}"`);
      }

      // -------- the home screen (engine/home.js)
      case C2S.HOME: {
        if (payload?.op === 'show') return reply(await home.show(String(payload.layoutId || ''), engine.store.getLayouts()));
        if (payload?.op !== 'layouts') throw refusal('unknown_request', `no home op "${payload?.op}"`);
        // Each person picks their own: a moderator's in their copy, told to them only.
        if (ws.who?.role === 'mod') { sendToUser(ws.who.userId, S2C.CONFIG_PATCH, { homeLayouts: modDecks.setFor(ws.who, 'homeLayouts', payload.ids) }); return reply({ ok: true }); }
        broadcast(S2C.CONFIG_PATCH, { homeLayouts: home.setHomeLayouts(payload.ids) });
        return reply({ ok: true });
      }

      // -------- moderating Twitch chat, as whoever pressed (engine/twitch-mod.js)
      case C2S.TWITCH_MOD:
        return reply(await twitchMod.control(ws.who, payload));

      // -------- the Moderators screen, the streamer's own
      case C2S.MODERATORS: {
        const op = payload?.op;
        const userId = String(payload?.userId || '');
        if (op === 'block' || op === 'unblock') auth.setBlocked(userId, op === 'block', ws.who, payload?.login);
        else if (op === 'signout') auth.signOutUser(userId, ws.who);
        else if (op === 'reset-dock') {
          modDecks.resetFor(userId);
          // Their open docks show the streamer's again at once.
          sendToUser(userId, S2C.CONFIG_PATCH, modDecks.dockFor(userId));
        } else if (op === 'activity') return reply({ entries: modActivity.list({ userId, limit: Number(payload?.limit) || 200 }) });
        else if (op !== 'list') throw refusal('unknown_request', `no moderators op "${op}"`);
        return reply(moderatorsNow());
      }

      // -------- sync
      case C2S.HELLO:
        // Which surface this is — decides where audio and speech are sent.
        ws.mode = typeof payload.mode === 'string' ? payload.mode : 'dashboard';
        // And, for a canvas, which layout it shows — whether it shows the alerts.
        ws.layoutId = typeof payload.layout === 'string' ? payload.layout.slice(0, 80) : null;
        // And which of the layout's two shapes it draws (shared/layout-formats.js).
        ws.format = payload.format === 'vertical' ? 'vertical' : 'horizontal';
        // Whether it is a page inside OBS, as it says.
        ws.inObs = payload.obs === true;
        reply(buildSnapshot());
        publishSurfaces();
        return;

      case C2S.GET_SNAPSHOT:
        reply(buildSnapshot());
        return;

      // -------- config CRUD
      case C2S.SAVE_COMMAND:
        broadcast(S2C.CONFIG_PATCH, { commands: engine.store.saveCommand(payload) });
        return reply({ ok: true });

      case C2S.DELETE_COMMAND:
        broadcast(S2C.CONFIG_PATCH, { commands: engine.store.deleteCommand(payload.id) });
        return reply({ ok: true });

      case C2S.SAVE_ACTION:
        broadcast(S2C.CONFIG_PATCH, { streamActions: engine.store.saveAction(payload) });
        return reply({ ok: true });

      case C2S.DELETE_ACTION: {
        // Deleting an action also drops any Dock Actions button pointing at
        // it, so both lists travel together.
        const streamActions = engine.store.deleteAction(payload.id);
        broadcast(S2C.CONFIG_PATCH, { streamActions, dockButtons: engine.store.getDockButtons() });
        return reply({ ok: true });
      }

      case C2S.SAVE_ALERT:
        broadcast(S2C.CONFIG_PATCH, { alertConfigs: engine.store.saveAlert(payload) });
        return reply({ ok: true });

      case C2S.DELETE_ALERT:
        broadcast(S2C.CONFIG_PATCH, { alertConfigs: engine.store.deleteAlert(payload.id) });
        return reply({ ok: true });

      case C2S.SET_TAG_OUTPUTS:
        tags.setOutputs(payload);
        broadcast(S2C.CONFIG_PATCH, { tagOutputs: tags.getOutputs() });
        return reply({ ok: true });

      // Push every current tag value to its text file and OBS source now,
      // rather than waiting for the next event to change one. Awaited, unlike
      // the automatic path, so the reply can say how many sources took it.
      case C2S.SYNC_TAG_OUTPUTS:
        return reply(await tags.publishAll());

      case C2S.SET_DOCK_GRID:
        if (ws.who?.role === 'mod') { sendToUser(ws.who.userId, S2C.CONFIG_PATCH, { dockGrid: modDecks.setFor(ws.who, 'dockGrid', payload) }); return reply({ ok: true }); }
        broadcast(S2C.CONFIG_PATCH, { dockGrid: engine.store.setDockGrid(payload) });
        return reply({ ok: true });

      case C2S.SET_RELAY_CONFIG:
        broadcast(S2C.CONFIG_PATCH, { relayConfig: engine.store.setRelayConfig(payload) });
        return reply({ ok: true });

      case C2S.STOPWATCH:
        // Broadcast from the engine like the countdown, so the page that asked
        // learns of the change the same way every other surface does.
        return reply(engine.store.stopwatch(payload?.op, payload?.value));

      case C2S.COUNTER:
        // Broadcast from the engine too, whoever changed it.
        return reply(engine.store.counter(payload));

      // Which Discord call to show, and whether the bot joins it to hear who talks.
      // Linking stream accounts to Discord members, and the roles that follow them.
      case C2S.ROLE_SYNC: {
        const op = payload?.op;
        if (op === 'link') return reply(await roleSync.link(payload));
        // Another account for somebody already known: { to: one of theirs, platform, platformId, platformName, avatar }.
        if (op === 'add_account') return reply(await roleSync.addAccount(payload));
        // Roles for showing up: [{ kind, atLeast, roleId }].
        if (op === 'loyalty') return reply(roleSync.setLoyalty(payload?.rules));
        if (op === 'unlink') { roleSync.unlink(String(payload?.key || '')); return reply({ ok: true }); }
        if (op === 'sync') return reply(await roleSync.syncNow(String(payload?.key || '')));
        if (op === 'clear_log') { roleSync.clearLog(); return reply({ ok: true }); }
        // Somebody on YouTube, to link by hand: seen in chat, or an @handle / channel id.
        if (op === 'find_youtube') return reply(await roleSync.findYoutube(payload?.query));
        // Everybody following on Twitch, to pick from instead of spelling a name.
        if (op === 'twitch_followers') return reply(await twitch.listFollowers());
        throw new Error(`unknown role sync operation "${op}"`);
      }

      // The welcome card, drawn by the same renderer that draws the one posted.
      // Going live in Discord: its settings, and a test post.
      case C2S.TWITCH_EXTRAS:
        return reply(await engine.store.twitchExtras(payload));

      case C2S.MIC:
        return reply(engine.store.mic(payload));

      case C2S.SCHEDULE_EVENTS:
        return reply(await scheduleEvents.control(payload));

      // A channel's standing posts, built on the Discord pages screen.
      case C2S.DISCORD_PAGES:
        return reply(await discordPages.control(payload));

      // Points: the settings and the shop, posting it in Discord, giving by hand, the richest.
      case C2S.POINTS:
        return reply(await points.control(payload));

      // The profile card's settings, and a preview of it.
      case C2S.PROFILE_CARD:
        return reply(await profileCard.control(payload));

      // The moments chat goes wild: the settings, or a made-up one to the test channel.
      case C2S.HIGHLIGHTS:
        return reply(await highlights.control(payload));

      // Going live, told privately: the settings, the sign-up post, a test.
      case C2S.LIVE_DMS:
        return reply(await liveDms.control(payload));

      // Remote players: who is in each seat, the OBS sources, invites, and the director's buttons.
      case C2S.REMOTE_PLAYERS:
        return reply(await remotePlayers.control(payload));

      // Updates: check for a newer version, or get it ready and restart into it.
      case C2S.UPDATES:
        return reply(await updater.control(payload));

      // Which Discord channels feed the Questions dock, and whether answers go back there.
      case C2S.DISCORD_QUESTIONS:
        return reply(discordQuestions.setDiscordQuestions(payload?.settings));

      // The game requests board.
      case C2S.GAME_REQUESTS:
        return reply(await gameRequests.control(payload));

      // The mod log's settings, and banning or timing out from the screen.
      case C2S.MODERATION:
        return reply(await moderation.control(payload));

      // Every stream kept: the list, or one with its chapters, moments, songs and who came.
      case C2S.STREAMS:
        return reply(payload?.op === 'get' ? streamSessions.details(String(payload.id || '')) : streamSessions.listed());

      // How long people are kept, and how many that would let go.
      case C2S.HISTORY: {
        if (payload?.op === 'settings') return reply(viewerHistory.setHistorySettings(payload.settings));
        if (payload?.op === 'prune') return reply(viewerHistory.prune());
        return reply(viewerHistory.historyStats());
      }

      case C2S.ANNOUNCE:
        if (payload?.op === 'test') return reply(await announcer.announce({ test: true }));
        // The recap, from the stream so far, to the test channel.
        if (payload?.op === 'test_recap') return reply(await announcer.postRecap({ test: true }));
        return reply(announcer.setAnnounce(payload?.settings));

      case C2S.WELCOME_CARD_PREVIEW:
        // With the server's real name and icon, for a card that shows them.
        return reply(await previewCard(payload?.card, { ...(payload?.sample || {}), ...(await previewFacts()) }));

      // A greeting posted now, as a real one would go, to see it in the server.
      case C2S.WELCOME_TEST:
        return reply(await testGreeting(String(payload?.kind || ''), payload?.config, payload?.testChannelId));

      case C2S.SET_VOICE:
        return reply(discordVoice.setVoice(payload));

      case C2S.GIVEAWAY:
        return reply(await engine.store.giveaway(payload?.op, payload?.value));

      case C2S.POLL:
        // Broadcast from the engine, as the countdown is.
        return reply(engine.store.poll(payload?.op, payload?.value));

      case C2S.PIXEL_AVATARS:
        // Broadcast from the engine; the reply says which avatar, or why not.
        return reply(engine.store.pixelAvatars(payload));

      case C2S.USER_THEMES:
        // Broadcast from the engine; the reply says which theme, or why not.
        return reply(engine.store.userThemes(payload));

      case C2S.OMNILAYER:
        // The change is broadcast from the engine; the reply is for whoever asked (a scene check, a refusal).
        return reply(await engine.store.omnilayer(payload));

      case C2S.COUNTDOWN:
        // The change is broadcast from the engine, so every surface — and the
        // one that asked — learns about it the same way.
        return reply(engine.store.countdown(payload?.op, payload?.value));

      case C2S.SET_OMNIBAR:
        broadcast(S2C.CONFIG_PATCH, { omnibar: engine.store.setOmnibar(payload) });
        return reply({ ok: true });

      case C2S.SET_OMNIBARS:
        broadcast(S2C.CONFIG_PATCH, { omnibars: engine.store.setOmnibars(payload) });
        return reply({ ok: true });

      case C2S.DROIDCAM_SETTINGS: {
        const next = droidcam.setSettings(payload);
        broadcastConnections();
        return reply(next);
      }

      // Probing reaches out over the network, so it is a request with a
      // reply rather than a broadcast: the screen that asked is the one
      // waiting, and a failure belongs to it.
      case C2S.DROIDCAM_PROBE: {
        const result = await droidcam.probe();
        broadcastConnections();
        return reply(result);
      }

      case C2S.DROIDCAM_CONTROL:
        return reply(await droidcam.control(payload?.op, payload?.value));

      /*
        Moderating one question at a time, never the whole queue.

        Questions arrive while you are reading them, so a whole-list save would
        drop whatever landed between the read and the write.
      */
      // Each reaches every surface on its own, as a question arriving from chat does.
      case C2S.QUESTION_SET_STATUS:
        engine.store.setQuestionStatus(payload?.id, payload?.status);
        break;

      case C2S.QUESTION_SHOW:
        engine.store.showQuestion(payload?.id);
        break;

      case C2S.QUESTIONS_CLEAR:
        engine.store.clearQuestions(payload?.which);
        break;

      // Add one by hand, edit one, "Next question", the settings. Answered, so the screen can say why not.
      case C2S.QUESTIONS:
        return reply(engine.store.questions(payload));

      // Saved and announced by the store, which every other change to the list goes through too.
      case C2S.SET_PLAYERS:
        engine.store.setPlayers(payload);
        break;

      case C2S.SET_PLAN:
        broadcast(S2C.CONFIG_PATCH, { plan: engine.store.setPlan(payload) });
        break;

      case C2S.SET_RUN:
        broadcast(S2C.CONFIG_PATCH, { run: engine.store.setRun(payload) });
        break;

      /*
        Moving to the next thing is its own message: it happens mid-stream,
        from whatever is to hand, and sending the whole plan back to move a
        pointer would fight anyone editing the list at the same time.
      */
      case C2S.PLAN_GOTO:
        broadcast(S2C.CONFIG_PATCH, { plan: engine.store.planGoto(payload?.id) });
        break;

      // Save the plan under a name, load one, forget one. What changes reaches every surface on its own.
      case C2S.PLAN_SAVED:
        return reply(engine.store.planSaved(payload));

      // The Events dock: replay an alert, thank somebody in chat, the totals, the thank-you line.
      case C2S.EVENTS:
        return reply(await engine.store.events(payload));

      // Regulars, crews and the Discord call. What changes reaches every surface on its own.
      case C2S.PEOPLE:
        return reply(engine.store.people(payload));

      case C2S.SET_VIEWERS:
        broadcast(S2C.CONFIG_PATCH, { viewers: engine.store.setViewers(payload) });
        return reply({ ok: true });

      case C2S.SET_CHAT_DOCK_SETTINGS:
        // A moderator's dock is their own (engine/mod-decks.js): kept for them, told to them.
        if (ws.who?.role === 'mod') { sendToUser(ws.who.userId, S2C.CONFIG_PATCH, { chatDockSettings: modDecks.setFor(ws.who, 'chatDockSettings', payload) }); return reply({ ok: true }); }
        // Not in PROFILED_KEYS: the dock is deliberately outside profiles, so
        // changing it must never mark a profile unsaved.
        broadcast(S2C.CONFIG_PATCH, { chatDockSettings: engine.store.setChatDockSettings(payload) });
        return reply({ ok: true });

      case C2S.SET_LAYOUTS:
        // With Omnilayer's state beside them: deleting the live layout puts another live, and a
        // screen given the new list and the old live id in two messages would draw the wrong one between them.
        broadcast(S2C.CONFIG_PATCH, { layouts: engine.store.setLayouts(payload), omnilayer: engine.store.omnilayerState() });
        return reply({ ok: true });

      /*
        Every profile operation answers with the fresh summary, and the ones
        that change what is live broadcast a whole snapshot rather than a
        patch — switching a profile replaces entire collections at once, so a
        client holding a patch of one key would be showing a mix of two
        configurations.
      */
      case C2S.PROFILE_SWITCH:
        engine.store.profileSwitch(payload?.group, payload?.id);
        broadcast(S2C.SNAPSHOT, buildSnapshot());
        return reply({ ok: true });

      // A saved profile's contents, to look at without switching to it: a moderator browsing the overlays.
      case C2S.PROFILE_PEEK:
        return reply(engine.store.profilePeek(payload?.group, payload?.id));

      case C2S.PROFILE_CREATE:
        broadcast(S2C.CONFIG_PATCH, { profiles: engine.store.profileCreate(payload?.group, payload?.name) });
        return reply({ ok: true });

      case C2S.PROFILE_DUPLICATE:
        broadcast(S2C.CONFIG_PATCH, { profiles: engine.store.profileDuplicate(payload?.group, payload?.name) });
        return reply({ ok: true });

      case C2S.PROFILE_RENAME:
        broadcast(S2C.CONFIG_PATCH, { profiles: engine.store.profileRename(payload?.group, payload?.id, payload?.name) });
        return reply({ ok: true });

      case C2S.PROFILE_DELETE:
        broadcast(S2C.CONFIG_PATCH, { profiles: engine.store.profileDelete(payload?.group, payload?.id) });
        return reply({ ok: true });

      case C2S.PROFILE_REVERT:
        engine.store.profileRevert(payload?.group);
        broadcast(S2C.SNAPSHOT, buildSnapshot());
        return reply({ ok: true });

      case C2S.PROFILE_CAPTURE:
        broadcast(S2C.CONFIG_PATCH, { profiles: engine.store.profileCapture(payload?.group) });
        return reply({ ok: true });

      case C2S.SET_DOCK_BUTTONS:
        // A moderator's deck is theirs: it never moves the streamer's buttons, nor marks their profile unsaved.
        if (ws.who?.role === 'mod') { sendToUser(ws.who.userId, S2C.CONFIG_PATCH, { dockButtons: modDecks.setFor(ws.who, 'dockButtons', payload) }); return reply({ ok: true }); }
        broadcast(S2C.CONFIG_PATCH, { dockButtons: engine.store.setDockButtons(payload) });
        return reply({ ok: true });

      // Awaited and replied to, unlike TEST_ACTION, so the button can show
      // whether it worked. Most actions are silent — an OBS scene switch gives
      // no sign it happened — and a dead button that looks alive is worse than
      // one that reports a failure.
      case C2S.RUN_DOCK_ACTION:
        // A built-in button names itself; everything else names an action.
        return reply(payload.builtin
          ? await engine.runDockBuiltin(payload.builtin)
          : await engine.runDockAction(payload.id));

      case C2S.CLEAR_EVENTS:
        engine.store.clearHistory();
        // Both rings, or the bar keeps announcing activity the log has
        // already forgotten until the next full snapshot happens to arrive.
        broadcast(S2C.CONFIG_PATCH, { eventHistory: [], viewerEvents: [] });
        return reply({ ok: true });

      // -------- discord membership automation
      case C2S.SET_ROLE_MAPPINGS:
        broadcast(S2C.CONFIG_PATCH, { roleMappings: discordRoles.store.setRoleMappings(payload) });
        return reply({ ok: true });

      case C2S.SET_WELCOME_GOODBYE:
        broadcast(S2C.CONFIG_PATCH, { welcomeGoodbyeConfig: discordRoles.store.setWelcomeGoodbye(payload) });
        return reply({ ok: true });

      case C2S.SET_REACTION_ROLES:
        broadcast(S2C.CONFIG_PATCH, { reactionRoleConfigs: discordRoles.store.setReactionRoles(payload) });
        return reply({ ok: true });

      case C2S.SET_BUTTON_MENUS:
        broadcast(S2C.CONFIG_PATCH, { discordButtonConfigs: discordRoles.store.setButtonMenus(payload) });
        return reply({ ok: true });

      case C2S.CLEAR_ROLE_LOG:
        broadcast(S2C.CONFIG_PATCH, { roleActivityLog: discordRoles.store.clearActivityLog() });
        return reply({ ok: true });

      // -------- runtime
      case C2S.TEST_ACTION:
        await engine.testAction(payload.id);
        return reply({ ok: true });

      // The Actions screen's Waiting list: Run now or Cancel. The list itself follows as a config patch.
      case C2S.LATER_STEP:
        return reply(await engine.laterControl(payload?.op, payload?.key));

      case C2S.TEST_ALERT:
        // With a variation's id, that variation, at numbers its conditions hold for.
        engine.testAlert(payload.id, payload.variationId);
        return reply({ ok: true });

      case C2S.AVATAR_SOURCES: {
        // Every layer wearing one draws from the list, so the list goes to every page.
        const { id, list } = engine.store.avatarSources(payload);
        broadcast(S2C.CONFIG_PATCH, { avatarSources: list });
        return reply({ ok: true, ...(id ? { id } : {}) });
      }

      case C2S.ALERT_CONTROL:
        return reply(controlAlerts(payload?.op, payload?.value));

      /*
        From the dock's box, to Twitch, YouTube or both. Both is each tried on
        its own: one refusing does not keep the other from going, and the
        answer says which did not, so the box can say so instead of
        pretending it all went or all failed.
      */
      case C2S.SEND_CHAT: {
        const to = ['youtube', 'both'].includes(payload?.to) ? payload.to : 'twitch';
        // A moderator, on Twitch, as themselves or as the bot — never as the streamer. YouTube has no bot, so there it is the channel.
        const sayOnTwitch = (text) => (ws.who?.role === 'mod' && !payload.useBot
          ? twitch.sayAsUser(text, auth.modChatToken(ws.who))
          : twitch.sayFromDock(text, { useBot: payload.useBot }));
        if (to === 'twitch') { await sayOnTwitch(payload.text); return reply({ ok: true }); }
        if (to === 'youtube') { await youtube.say(payload.text); return reply({ ok: true }); }
        const [tw, yt] = await Promise.allSettled([
          sayOnTwitch(payload.text),
          youtube.say(payload.text, { sentToBoth: true }),
        ]);
        if (tw.status === 'rejected' && yt.status === 'rejected') throw tw.reason;
        const failed = tw.status === 'rejected' ? { platform: 'twitch', error: tw.reason }
          : yt.status === 'rejected' ? { platform: 'youtube', error: yt.reason } : null;
        return reply({
          ok: true,
          ...(failed ? { failed: { platform: failed.platform, code: failed.error?.code || '', vars: failed.error?.vars, message: failed.error?.message || '' } } : {}),
        });
      }

      // -------- credentials & lifecycle
      case C2S.SET_CREDENTIALS: {
        const { platform, ...rest } = payload;

        // Tokens and secrets are set from the machine running the server, not
        // from anything that can reach it. The deck is deliberately open to the
        // LAN so a phone can press buttons; letting that phone write a bot
        // token is a different proposition entirely.
        const SECRET_FIELDS = ['botToken', 'clientSecret', 'signApiKey', 'password', 'geminiApiKey'];
        if (!ws.isLocal && SECRET_FIELDS.some((f) => rest[f])) {
          throw refusal('secrets_local_only', 'secrets can only be set from the machine running the server');
        }
        if (platform === 'twitch') twitch.setCredentials(rest);
        else if (platform === 'tiktok') tiktok.setCredentials(rest);
        else if (platform === 'obs') obs.setCredentials(rest);
        else if (platform === 'discord') discord.setSettings(rest);
        else if (platform === 'spotify') spotify.setSettings(rest);
        else if (platform === 'ai') tts.setSettings(rest);
        else throw new Error(`unknown platform "${platform}"`);
        broadcastConnections();
        return reply({ ok: true });
      }

      // -------- configuration backup

      case C2S.CONFIG_EXPORT:
        return reply(engine.exportConfig());

      case C2S.CONFIG_IMPORT: {
        // Replacing every command, action and alert is not something a device
        // on the network gets to do. The Dock Actions surface is deliberately
        // open to the LAN so a phone can press buttons; this is the other kind
        // of request, and it stays on the machine running the server.
        if (!ws.isLocal) throw refusal('import_local_only', 'configuration can only be imported from this machine');
        const summary = engine.importConfig(payload?.bundle ?? payload);
        // Every surface is a replica, so they all need the new truth at once.
        broadcast(S2C.SNAPSHOT, buildSnapshot());
        broadcastConnections();
        return reply(summary);
      }

      case C2S.PLATFORM_CONNECT:
        await platformOf(payload.platform).connect();
        return reply({ ok: true });

      case C2S.PLATFORM_DISCONNECT:
        await platformOf(payload.platform).disconnect();
        return reply({ ok: true });

      // -------- twitch helpers
      case C2S.TWITCH_FETCH_REWARDS:
        return reply(await twitch.fetchRewards());

      case C2S.TWITCH_FETCH_TAGS:
        return reply(await twitch.fetchTags());

      case C2S.TWITCH_SEARCH_CATEGORIES:
        return reply(await twitch.searchCategories(payload.query));

      case C2S.TWITCH_GET_USER:
        return reply(await twitch.getUser(payload.login));

      // -------- spotify
      case C2S.SPOTIFY_REFRESH:
        return reply({ track: await spotify.refreshNow() });

      case C2S.SPOTIFY_CONTROL:
        await spotify.control(payload.operation);
        return reply({ ok: true });

      case C2S.SPOTIFY_QUEUE:
        await spotify.queue(payload.uri);
        return reply({ ok: true });

      case C2S.YOUTUBE_EXCHANGE_CODE:
        await youtube.exchangeCode(payload.code, payload.redirectUri);
        broadcastConnections();
        return reply({ ok: true });

      case C2S.YOUTUBE_SET_SETTINGS:
        youtube.setSettings(payload || {});
        broadcastConnections();
        return reply({ ok: true });

      case C2S.YOUTUBE_LOGOUT:
        youtube.logout();
        broadcastConnections();
        return reply({ ok: true });

      case C2S.SPOTIFY_EXCHANGE_CODE:
        await spotify.exchangeCode(payload.code, payload.redirectUri);
        broadcastConnections();
        return reply({ ok: true });

      // -------- leveling
      case C2S.GET_XP_DATA:
        return reply({ users: leveling.getUsers(), config: leveling.getConfig(), leaderboard: leveling.leaderboard() });

      case C2S.UPDATE_XP_CONFIG: {
        const next = leveling.setConfig(payload);
        broadcast(S2C.XP_DATA, { users: leveling.getUsers(), config: next, leaderboard: leveling.leaderboard() });
        return reply({ ok: true });
      }

      case C2S.RESET_XP:
        leveling.reset();
        broadcast(S2C.XP_DATA, { users: {}, config: leveling.getConfig(), leaderboard: [] });
        return reply({ ok: true });

      case C2S.LINK_IDENTITIES:
        leveling.link(payload.primary, payload.secondary);
        broadcast(S2C.XP_DATA, { users: leveling.getUsers(), config: leveling.getConfig(), leaderboard: leveling.leaderboard() });
        return reply({ ok: true });

      case C2S.UNLINK_USER:
        leveling.unlink(payload.key);
        broadcast(S2C.XP_DATA, { users: leveling.getUsers(), config: leveling.getConfig(), leaderboard: leveling.leaderboard() });
        return reply({ ok: true });

      // -------- discord passthrough
      case C2S.DISCORD:
        return reply(await discordPassthrough(payload));

      default:
        throw new Error(`unknown message type "${type}"`);
    }
  } catch (err) {
    fail(err);
  }
}

function platformOf(name) {
  // Spotify's disconnect is reached from the UI's "Log out" button, so it has
  // to actually sign out. It mapped to `stop()`, which only cleared the poll
  // timer and left the refresh token on disk — and initSpotify() auto-starts
  // from a stored refresh token, so the next server boot silently reconnected
  // the account the user had just logged out of. `logout()` clears the tokens
  // as well, and was otherwise unreachable.
  const map = { twitch, tiktok, discord, obs, spotify: { connect: spotify.start, disconnect: spotify.logout } };
  const p = map[name];
  if (!p) throw new Error(`unknown platform "${name}"`);
  return p;
}

async function discordPassthrough({ op, ...args }) {
  switch (op) {
    case 'get_roles': return discord.getRoles(args.guildId);
    case 'get_channels': return discord.getChannels(args.guildId);
    case 'get_emojis': return discord.getEmojis(args.guildId);
    case 'search_members': return discord.searchMembers(args.guildId, args.query);
    // Everybody in the voice call's server, to set somebody up before they join a call.
    case 'server_members': return discordVoice.serverMembers();
    case 'get_member_me': return discord.getBotMember(args.guildId);
    case 'get_guilds': return discord.getGuilds();
    case 'send_message': return discord.sendMessage(args.channelId, args.content, args.embed);
    case 'edit_message': return discord.editMessage(args.channelId, args.messageId, args.content, args.embed);
    case 'get_message': return discord.getMessage(args.channelId, args.messageId);
    case 'publish_button_menu': return discordRoles.publishButtonMenu(args.id);
    case 'unpublish_button_menu': return discordRoles.unpublishButtonMenu(args.id);
    case 'add_reaction': return discord.addReaction(args.channelId, args.messageId, args.emoji);
    case 'add_role': return discord.addRole(args.guildId, args.userId, args.roleId);
    case 'remove_role': return discord.removeRole(args.guildId, args.userId, args.roleId);
    case 'exchange_code': return discord.exchangeCode(args.code, args.redirectUri);
    default: throw new Error(`unknown discord op "${op}"`);
  }
}
