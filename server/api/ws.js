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
import { C2S, S2C } from '../../shared/protocol.js';
import { VERSION } from '../../shared/version.js';
import { liveLayout } from '../../shared/live-layout.js';
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
  const out = { canvas: 0, dock: 0, alerts: 0, canvasInObs: 0, dockInObs: 0, alertsInObs: 0 };
  for (const c of list) {
    if (!c || !(c.mode in out)) continue;
    out[c.mode] += 1;
    if (c.inObs) out[`${c.mode}InObs`] += 1;
  }
  return out;
}
const surfacesNow = () => countSurfaces([...clients].filter(isOpen));
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
 *      alerts in OBS rather than needing the dock open
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
  const layout = canvasLayout(client, layouts, scene, omnilayer);
  return Boolean(layout?.layers?.some((l) => l.type === 'alerts' && l.visible !== false));
}

/** Is `a` a better audio surface than `b`? `live` is the OBS scene and the Omnilayer, for a canvas that follows them. */
export function preferred(a, b, layouts = [], live = {}) {
  const aAlerts = showsAlerts(a, layouts, live.scene, live.omnilayer);
  const bAlerts = showsAlerts(b, layouts, live.scene, live.omnilayer);
  if (aAlerts !== bAlerts) return aAlerts;
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
    const addr = req.socket.remoteAddress || '';
    // Loopback *or* this machine's own LAN address: the dashboard is normally
    // opened at the latter, since that is the URL the docks and the deck use.
    ws.isLocal = isSameMachine(addr);
    ws.connectedAt = Date.now();
    ws.remoteLabel = addr;
    // Replaced by the real value when HELLO arrives a moment later.
    ws.mode = 'dashboard';

    clients.add(ws);
    ws.isAlive = true;
    log.info(`client connected (${clients.size} total) from ${addr}`);

    send(ws, S2C.SNAPSHOT, buildSnapshot());

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => handleMessage(ws, raw));
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
    }
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeat));

  wireBusToClients();
  log.info('hub ready');
}

// ------------------------------------------------------------- broadcasting

function send(ws, type, payload, meta = {}) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, payload, ...meta }));
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
  'commands', 'streamActions', 'dockButtons', 'alertConfigs', 'layouts', 'omnibar', 'omnibars', 'viewers',
]);

export function broadcast(type, payload) {
  let body = payload;
  if (type === S2C.CONFIG_PATCH && payload && typeof payload === 'object'
      && !('profiles' in payload)
      && Object.keys(payload).some((k) => PROFILED_KEYS.has(k))) {
    try { body = { ...payload, profiles: engine.store.profileSummary() }; } catch { /* keep the patch */ }
  }
  const frame = JSON.stringify({ type, payload: body });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(frame);
  }
}

export const clientCount = () => clients.size;

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
    send(sink, d.kind === 'play_audio' ? S2C.PLAY_AUDIO : S2C.PLAY_TTS, d);
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

async function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch (err) {
    log.warn('client sent unparseable frame:', err.message);
    return;
  }

  const { type, payload = {}, id } = msg;
  const reply = (result) => id && send(ws, S2C.REPLY, result, { id });
  const fail = (err) => {
    log.warn(`"${type}" failed: ${err.message}`);
    // A code, where there is one, lets the screen say it in its own language.
    if (id) send(ws, S2C.ERROR, { message: err.message, ...(err.code ? { code: err.code } : {}), ...(err.vars ? { vars: err.vars } : {}) }, { id });
  };

  try {
    switch (type) {
      // -------- sync
      case C2S.HELLO:
        // Which surface this is — decides where audio and speech are sent.
        ws.mode = typeof payload.mode === 'string' ? payload.mode : 'dashboard';
        // And, for a canvas, which layout it shows — whether it shows the alerts.
        ws.layoutId = typeof payload.layout === 'string' ? payload.layout.slice(0, 80) : null;
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

      case C2S.TEST_ALERT:
        // With a variation's id, that variation, at numbers its conditions hold for.
        engine.testAlert(payload.id, payload.variationId);
        return reply({ ok: true });

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
        if (to === 'twitch') { await twitch.sayFromDock(payload.text, { useBot: payload.useBot }); return reply({ ok: true }); }
        if (to === 'youtube') { await youtube.say(payload.text); return reply({ ok: true }); }
        const [tw, yt] = await Promise.allSettled([
          twitch.sayFromDock(payload.text, { useBot: payload.useBot }),
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
          throw new Error('secrets can only be set from the machine running the server');
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
        if (!ws.isLocal) throw new Error('configuration can only be imported from this machine');
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
