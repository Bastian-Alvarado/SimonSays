/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord: gateway (chat, joins/leaves, reactions, button interactions),
 * REST helper with rate-limit handling, and OAuth code exchange.
 *
 * Ported from the V2 relay. The substantive changes are:
 *   - 429 responses now honour `retry_after` instead of a fixed backoff
 *   - the gateway resumes with its session id rather than always re-identifying
 *   - all outbound calls go through a named queue, so a slow role assignment
 *     no longer blocks chat relays behind it
 */

import WebSocket from 'ws';
import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseChat } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { queue } from '../core/queue.js';
import { config } from '../config.js';

const log = createLogger('discord');

const API = 'https://discord.com/api/v10';
const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

/*
  Guilds, members, moderation, voice states, messages, reactions, message
  content. Voice states (1 << 7) are who is in which voice call — not
  privileged, and what the voice overlay reads (see discord-voice.js).
  Moderation (1 << 2) is bans, for a ban post in place of a goodbye; not
  privileged either.
*/
const INTENTS = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 7) | (1 << 9) | (1 << 10) | (1 << 15); // 34439

/*
  Who counts as a moderator for commands only mods may use: whoever owns the
  server, or holds a role with any of Administrator, Manage Server, Manage
  Messages, Kick, Ban or Timeout. Discord sends no "is a mod" flag; this is
  what its own moderators have in common.
*/
const MOD_PERMISSIONS = (1n << 3n) | (1n << 5n) | (1n << 13n) | (1n << 1n) | (1n << 2n) | (1n << 40n);
/** Server id → its owner's id, from GUILD_CREATE. */
const guildOwners = new Map();

/**
 * Gateway close codes that cannot succeed on retry: the same token and the
 * same intent bitfield earn the same rejection every time. Reconnecting on
 * these spins forever at the retry interval while logging nothing useful.
 *
 * 4014 is the one that actually bites. Two of the intents above are
 * privileged, and they are off by default on a new application.
 */
const FATAL_CLOSE_CODES = {
  4004: 'authentication failed — DISCORD_BOT_TOKEN is invalid or has been reset',
  4010: 'invalid shard',
  4011: 'sharding required — this bot is in too many guilds for a single connection',
  4012: 'invalid API version',
  4013: 'invalid intents — the requested intent bitfield was rejected',
  4014: 'disallowed intents — this bot asks for two privileged intents. Enable "Server Members '
    + 'Intent" and "Message Content Intent" under Bot -> Privileged Gateway Intents in the '
    + 'Discord Developer Portal, then reconnect',
};

let settings = null;

/**
 * Server-side cache of the Discord metadata the UI renders: the signed-in
 * user, the guild list, and the channels/roles/emojis of the selected guild.
 *
 * V2 kept all of this in the browser's localStorage, which meant a second
 * device (a phone, another machine) showed Discord as connected but had no
 * guild or channel names to display — and every Discord-dependent screen
 * stayed empty. Caching it here is what makes those screens work anywhere.
 */
let cache = null;

let gateway = null;
let heartbeat = null;
// Set when a heartbeat goes out, cleared by Discord's op 11 acknowledgement.
// Still set on the next tick means the socket is half-open — see the HELLO case.
let awaitingHeartbeatAck = false;
let sequence = null;
let sessionId = null;
let resumeUrl = null;
let status = 'disconnected';
let botUserId = null;
let reconnectTimer = null;

const restQueue = () => queue('discord-rest', 250);
const roleQueue = () => queue('discord-roles', 300);

export function initDiscord() {
  settings = collection('discord_settings', {
    guildId: '', channelId: '', clientId: '', clientSecret: '', botToken: '',
  });
  cache = collection('discord_cache', {
    user: null, guilds: [], channels: [], roles: [], emojis: [], botMember: null,
  });

  if (!botToken()) {
    log.info('Discord bot token not configured — add it on the Connections screen (or set DISCORD_BOT_TOKEN) to enable the bot');
  } else if (config.autoStart) {
    connect().catch((err) => log.error('auto-connect failed:', err.message));
  }
}

function setStatus(next) {
  status = next;
  bus.emit(EVENTS.STATUS, { platform: 'discord', status });
}

/**
 * Credentials may come from the environment or from the Connections screen.
 * Stored values win, so a first-time setup needs no .env file and no shell
 * access to the machine running the server.
 */
const clientId = () => settings?.get().clientId || config.discord.clientId;
const clientSecret = () => settings?.get().clientSecret || config.discord.clientSecret;
const botToken = () => settings?.get().botToken || config.discord.botToken;

/**
 * What clients are told. Deliberately not `...settings.get()`: that would put
 * the bot token on the wire to every connected surface, including a phone on
 * the LAN opening the deck. Whether one is set is all a UI needs to know.
 */
export const getStatus = () => {
  const { guildId, channelId } = settings?.get() ?? {};
  return {
    status,
    botUserId,
    guildId: guildId ?? '',
    channelId: channelId ?? '',
    clientId: clientId(),
    hasClientSecret: Boolean(clientSecret()),
    hasBotToken: Boolean(botToken()),
  };
};
export const getCache = () => cache.get();

/**
 * Settings plus the cached metadata, so any client can render Discord fully.
 *
 * The secrets are replaced with "is one set?" flags. This object is broadcast
 * to every connected surface, and a bot token on that wire would be readable
 * by anything on the network that can open the deck.
 */
export const getSettings = () => {
  const { clientSecret: _s, botToken: _t, ...safe } = settings.get();
  return {
    ...safe,
    ...cache.get(),
    clientId: clientId(),
    hasClientSecret: Boolean(clientSecret()),
    hasBotToken: Boolean(botToken()),
  };
};

export function setSettings(patch) {
  const before = settings.get();

  // A blank secret means "unchanged": the field renders empty on every load
  // because the value is never sent to the client, so treating empty as a
  // deletion would wipe the token the moment anything else on the form is
  // saved. Clearing one is done with an explicit null.
  const clean = { ...patch };
  for (const key of ['clientSecret', 'botToken']) {
    if (clean[key] === '' || clean[key] === undefined) delete clean[key];
    else if (clean[key] === null) clean[key] = '';
  }

  const next = settings.set({ ...before, ...clean });

  // A token that was just supplied should connect now rather than at the next
  // restart, which is the whole point of configuring it from the UI.
  if (clean.botToken && clean.botToken !== before.botToken) {
    log.info('bot token updated — reconnecting');
    try { disconnect(); } catch { /* nothing to tear down */ }
    connect().catch((err) => log.error('connect after token change failed:', err.message));
  }

  // Selecting a different guild invalidates its channels/roles/emojis.
  if (patch.guildId && patch.guildId !== before.guildId) {
    refreshCache().catch((err) => log.warn(`could not refresh Discord metadata: ${err.message}`));
  }
  return next;
}

/**
 * Pull the metadata the UI needs and cache it.
 *
 * Uses the bot token, so it works with no user logged in on this device —
 * which is the point: a phone opening the dashboard gets the guild and channel
 * names without repeating the OAuth flow.
 */
export async function refreshCache() {
  if (!botToken()) return;

  const s = settings.get();
  const next = { ...cache.get() };

  const [guilds] = await Promise.allSettled([getGuilds()]);
  if (guilds.status === 'fulfilled') next.guilds = guilds.value ?? [];

  if (s.guildId) {
    const [channels, roles, emojis, botMember] = await Promise.allSettled([
      getChannels(s.guildId),
      getRoles(s.guildId),
      getEmojis(s.guildId),
      getBotMember(s.guildId),
    ]);
    if (channels.status === 'fulfilled') next.channels = channels.value ?? [];
    if (roles.status === 'fulfilled') next.roles = roles.value ?? [];
    if (emojis.status === 'fulfilled') next.emojis = emojis.value ?? [];
    if (botMember.status === 'fulfilled') next.botMember = botMember.value ?? null;
  }

  cache.set(next);
  // Re-broadcast so connected clients pick the metadata up immediately.
  bus.emit(EVENTS.STATUS, { platform: 'discord', status });
  log.debug(`metadata cached: ${next.guilds.length} guild(s), ${next.channels.length} channel(s), ${next.roles.length} role(s)`);
}

// -------------------------------------------------------------------- REST

/**
 * Discord REST call. Retries on 429 using the server-provided `retry_after`,
 * and on 5xx with a short fixed backoff.
 */
export async function request(method, endpoint, { token, body, isMultipart = false, retries = 3 } = {}) {
  const auth = token ?? (botToken() ? `Bot ${botToken()}` : null);
  if (!auth) throw new Error('Discord: DISCORD_BOT_TOKEN is not set');

  const headers = { Authorization: auth };
  let payload;

  if (isMultipart) {
    payload = body; // FormData; fetch sets the boundary itself
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(`${API}${endpoint}`, { method, headers, body: payload });

    if (res.status === 429) {
      const info = await res.json().catch(() => ({}));
      const waitMs = Math.ceil((info.retry_after ?? 1) * 1000);
      log.warn(`rate limited on ${endpoint}; waiting ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (res.status >= 500 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }

    if (res.status === 204) return null;

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const err = new Error(`Discord ${res.status} on ${method} ${endpoint}: ${json?.message || text}`);
      err.code = json?.code;
      err.status = res.status;
      throw err;
    }
    return json;
  }

  throw new Error(`Discord: gave up on ${method} ${endpoint} after ${retries} retries`);
}

// ----------------------------------------------------------------- Gateway

export async function connect() {
  if (!botToken()) {
    // The Connections screen only collects the Client ID, which is a different
    // credential entirely — it identifies the app for OAuth and cannot run a
    // bot. Say so explicitly, because "no bot token" reads as wrong when there
    // is plainly an id filled in on screen.
    throw new Error(
      'Discord bot token is not set. The Client ID on the Connections screen is a different '
      + 'credential and cannot start a bot. Get the token from the Discord Developer Portal '
      + 'under Bot -> Reset Token, then put it in the .env file at the project root as '
      + 'DISCORD_BOT_TOKEN=... and restart the server.',
    );
  }

  // Idempotent: a redundant connect used to tear down a healthy gateway and
  // immediately resume it, producing an endless "resuming gateway session"
  // cycle in the log.
  if (status === 'connected' && gateway?.readyState === WebSocket.OPEN) {
    log.debug('gateway already connected — ignoring redundant connect');
    return;
  }

  disconnect();
  setStatus('connecting');

  gateway = new WebSocket(resumeUrl ? `${resumeUrl}/?v=10&encoding=json` : GATEWAY);

  gateway.on('open', () => log.debug('gateway socket open'));
  gateway.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      log.warn('gateway sent unparseable frame:', err.message);
      return;
    }
    handleGatewayFrame(msg);
  });

  gateway.on('close', (code) => {
    clearInterval(heartbeat);
    awaitingHeartbeatAck = false;

    const fatal = FATAL_CLOSE_CODES[code];
    if (fatal) {
      // Deliberately no reconnect: this would fail identically every time,
      // and a 5s retry loop buries the one line explaining how to fix it.
      log.error(`gateway closed (${code}): ${fatal}`);
      setStatus('disconnected');
      bus.emit('discord:closed');
      return;
    }

    log.warn(`gateway closed (${code})`);
    setStatus('disconnected');
    bus.emit('discord:closed');
    scheduleReconnect();
  });

  gateway.on('error', (err) => log.error('gateway error:', err.message));
}

export function disconnect() {
  clearTimeout(reconnectTimer);
  clearInterval(heartbeat);
  awaitingHeartbeatAck = false;
  if (gateway) {
    gateway.removeAllListeners();
    try { gateway.close(); } catch { /* already closed */ }
    gateway = null;
  }
  setStatus('disconnected');
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => connect().catch(() => {}), 5000);
}

function send(op, d) {
  if (gateway?.readyState === WebSocket.OPEN) gateway.send(JSON.stringify({ op, d }));
}

/**
 * Send a frame on the gateway for somebody else — the voice library, asking
 * to join or leave a call (op 4). Says whether it went, as the library wants.
 */
export function gatewaySend(op, d) {
  if (gateway?.readyState !== WebSocket.OPEN) return false;
  gateway.send(JSON.stringify({ op, d }));
  return true;
}

function handleGatewayFrame(msg) {
  const { op, d, s, t } = msg;
  if (s !== null && s !== undefined) sequence = s;

  switch (op) {
    case 10: { // HELLO
      clearInterval(heartbeat);
      awaitingHeartbeatAck = false;
      heartbeat = setInterval(() => {
        // Discord acknowledges every heartbeat with op 11. If the previous one
        // was never acknowledged the connection is half-open: TCP still looks
        // alive, so `close` never fires and the bot sits there reporting
        // "connected" while receiving no events at all. Drop the socket and
        // let the close handler reconnect — sessionId survives, so it resumes
        // and replays anything missed rather than re-identifying.
        if (awaitingHeartbeatAck) {
          log.warn('no heartbeat ACK from Discord — dropping a half-open gateway');
          try { gateway?.terminate(); } catch { /* already gone */ }
          return;
        }
        awaitingHeartbeatAck = true;
        send(1, sequence);
      }, d.heartbeat_interval);

      if (sessionId) {
        send(6, { token: botToken(), session_id: sessionId, seq: sequence });
        log.info('resuming gateway session');
      } else {
        send(2, {
          token: botToken(),
          intents: INTENTS,
          properties: { os: process.platform, browser: 'simonsays', device: 'simonsays' },
        });
      }
      return;
    }

    case 7: // RECONNECT
      log.info('gateway asked us to reconnect');
      disconnect();
      connect().catch(() => {});
      return;

    case 9: // INVALID SESSION
      log.warn('session invalidated — re-identifying');
      sessionId = null;
      resumeUrl = null;
      disconnect();
      setTimeout(() => connect().catch(() => {}), 2000);
      return;

    case 0: // DISPATCH
      handleDispatch(t, d);
      return;

    case 1: // Discord asking for an immediate heartbeat, out of band
      awaitingHeartbeatAck = true;
      send(1, sequence);
      return;

    case 11: // HEARTBEAT ACK — the connection is alive
      awaitingHeartbeatAck = false;
      return;

    default:
      // Anything else is informational for the intents we request.
  }
}

function handleDispatch(type, d) {
  switch (type) {
    case 'READY':
      sessionId = d.session_id;
      resumeUrl = d.resume_gateway_url;
      botUserId = d.user?.id;
      setStatus('connected');
      log.info(`connected as ${d.user?.username}`);
      // A new session: a voice call the bot was in went with the old one.
      bus.emit('discord:ready');
      // Warm the metadata cache so any device — including one that never ran
      // the OAuth flow — can render the Discord screens.
      refreshCache().catch((err) => log.warn(`could not cache Discord metadata: ${err.message}`));
      return;

    case 'RESUMED':
      setStatus('connected');
      log.info('gateway session resumed');
      bus.emit('discord:resumed');
      return;

    case 'MESSAGE_CREATE': {
      const message = messageFromGateway(d);
      if (!message) return;
      // The channel the app reads is the stream's chat; anywhere else still counts for levels.
      bus.emit(message.where === 'stream' ? EVENTS.CHAT : 'discord:message_elsewhere', message.chat);
      return;
    }

    case 'GUILD_MEMBER_ADD':
      bus.emit('discord:member_join', d);
      return;

    // Voice: who is in which call, and the bot's own joining. See discord-voice.js.
    case 'GUILD_CREATE':
      if (d.id && d.owner_id) guildOwners.set(d.id, d.owner_id);
      bus.emit('discord:guild_create', d);
      return;

    // A role made, changed or deleted: kept current, so a new mod role counts at once.
    case 'GUILD_ROLE_CREATE':
    case 'GUILD_ROLE_UPDATE':
    case 'GUILD_ROLE_DELETE':
      if (d.guild_id === settings.get().guildId) rolesChanged(d);
      return;

    case 'VOICE_STATE_UPDATE':
      bus.emit('discord:voice_state', d);
      return;

    case 'VOICE_SERVER_UPDATE':
      bus.emit('discord:voice_server', d);
      return;

    // An emoji reaction or a soundboard sound in a call (the voice states intent brings it).
    case 'VOICE_CHANNEL_EFFECT_SEND':
      bus.emit('discord:voice_effect', d);
      return;

    case 'GUILD_MEMBER_REMOVE':
      bus.emit('discord:member_leave', d);
      return;

    // A member changed: a nickname, roles — or a boost, which is how one is seen (welcome.js).
    case 'GUILD_MEMBER_UPDATE':
      bus.emit('discord:member_update', d);
      return;

    case 'GUILD_BAN_ADD':
      bus.emit('discord:member_ban', d);
      return;

    case 'MESSAGE_REACTION_ADD':
      if (d.user_id === botUserId) return;
      bus.emit('discord:reaction_add', d);
      return;

    case 'MESSAGE_REACTION_REMOVE':
      if (d.user_id === botUserId) return;
      bus.emit('discord:reaction_remove', d);
      return;

    case 'INTERACTION_CREATE':
      bus.emit('discord:interaction', d);
      return;

    default:
      // Everything else is uninteresting for our intents.
  }
}

/**
 * A message from the gateway, as chat: `where` is 'stream' for the channel
 * the app reads — the stream's chat, its commands, the overlay, the relay —
 * and 'elsewhere' for any other channel of the same server, which only
 * levels listen to. Null for a bot, another server, or nothing to go on.
 */
export function messageFromGateway(d, cfg = settings?.get() || {}) {
  if (!d?.author || d.author.bot) return null;
  const elsewhere = Boolean(cfg.channelId) && d.channel_id !== cfg.channelId;
  if (elsewhere && (!d.guild_id || (cfg.guildId && d.guild_id !== cfg.guildId))) return null;

  const avatar = d.author.avatar
    ? `https://cdn.discordapp.com/avatars/${d.author.id}/${d.author.avatar}.png`
    : undefined;

  const chat = normaliseChat({
    platform: 'discord',
    user: d.member?.nick || d.author.global_name || d.author.username,
    userId: d.author.id,
    msg: d.content || '',
    color: '#5865F2',
    avatar,
    isMod: isModerator(d.guild_id, d.author.id, d.member),
    // `plain`: the words with Discord's markup turned into names, for chats that cannot read it.
    // Their roles too, for what asks for one (a giveaway's subscribers or role).
    raw: { guildId: d.guild_id, channelId: d.channel_id, messageId: d.id, plain: plainText(d), roles: d.member?.roles || [] },
    // Who and what its mentions are, for a screen to show them by name.
    names: mentionNames(d),
  });
  return { where: elsewhere ? 'elsewhere' : 'stream', chat };
}

/** Owns the server, or holds a role that moderates it (MOD_PERMISSIONS). */
export function isModerator(guildId, userId, member, roles = cache?.get().roles || []) {
  if (!guildId || !userId || !member) return false;
  if (guildOwners.get(guildId) === userId) return true;
  // Everybody holds @everyone, whose id is the server's.
  const held = new Set([guildId, ...(member.roles || [])]);
  let perms = 0n;
  for (const role of roles) {
    if (!held.has(role.id)) continue;
    try { perms |= BigInt(role.permissions || '0'); } catch { /* not a number: grants nothing */ }
  }
  return (perms & MOD_PERMISSIONS) !== 0n;
}

/**
 * The names behind a message's mentions, for a screen to draw them by: the
 * people Discord sent with it, and the roles and channels it names, as this
 * server knows them. Only what the words mention; nothing when they mention
 * nobody. The words themselves keep Discord's codes — anything posted back
 * needs those.
 *   { users: { id: name }, roles: { id: { name, color } }, channels: { id: name } }
 */
export function mentionNames(d, { channels = cache?.get().channels || [], roles = cache?.get().roles || [] } = {}) {
  const text = String(d?.content || '');
  if (!/<(@[!&]?|#)\d+>/.test(text)) return undefined;
  const out = { users: {}, roles: {}, channels: {} };
  for (const u of d?.mentions || []) {
    if (u?.id && text.includes(u.id)) out.users[u.id] = String(u.member?.nick || u.global_name || u.username || '').slice(0, 64);
  }
  for (const [, id] of text.matchAll(/<@&(\d+)>/g)) {
    const role = roles.find((r) => r.id === id);
    if (role) out.roles[id] = { name: String(role.name).slice(0, 64), color: Number(role.color) || 0 };
  }
  for (const [, id] of text.matchAll(/<#(\d+)>/g)) {
    const channel = channels.find((c) => c.id === id);
    if (channel) out.channels[id] = String(channel.name).slice(0, 64);
  }
  return out;
}

/**
 * A message's words as another chat should see them. Discord writes a
 * mention as `<@123>`, a channel as `<#123>` and its own emoji as
 * `<:Wow:123>`; Twitch and YouTube would print those as they are.
 */
export function plainText(d, { channels = cache?.get().channels || [], roles = cache?.get().roles || [] } = {}) {
  const people = new Map((d?.mentions || []).map((u) => [u.id, u.member?.nick || u.global_name || u.username]));
  return String(d?.content || '')
    .replace(/<@!?(\d+)>/g, (m, id) => (people.has(id) ? `@${people.get(id)}` : '@someone'))
    .replace(/<@&(\d+)>/g, (m, id) => `@${roles.find((r) => r.id === id)?.name || 'role'}`)
    .replace(/<#(\d+)>/g, (m, id) => `#${channels.find((c) => c.id === id)?.name || 'channel'}`)
    .replace(/<a?:([\w~]+):\d+>/g, ':$1:')
    .replace(/\s+/g, ' ')
    .trim();
}

function rolesChanged(d) {
  const roles = cache.get().roles || [];
  const next = d.role_id
    ? roles.filter((r) => r.id !== d.role_id)
    : roles.some((r) => r.id === d.role?.id)
      ? roles.map((r) => (r.id === d.role.id ? d.role : r))
      : [...roles, d.role].filter(Boolean);
  cache.set({ ...cache.get(), roles: next });
  bus.emit(EVENTS.STATUS, { platform: 'discord', status });
}

// ------------------------------------------------------------------ Actions

/**
 * Escape Discord markdown and mention syntax in untrusted text, cut to `max`
 * characters: a name is short, a relayed chat line up to Twitch's 500.
 */
export function sanitise(text, max = 200) {
  if (text === undefined || text === null) return '';
  return String(text)
    .slice(0, max)
    .replace(/[\\`*_~|<>[\]()]/g, '\\$&')
    .replace(/@(everyone|here)/gi, '@​$1');
}

export function sendMessage(channelId, content, embed, components, files, extra = {}) {
  if (!channelId) return Promise.resolve(null);
  // extra: anything else the message carries — allowed_mentions, above all.
  const body = { content: content ?? '', ...extra };
  if (embed) body.embeds = [toEmbed(embed)];
  // Rows of buttons, for a button role menu.
  if (components?.length) body.components = components;
  /*
    Files go up as a multipart form: the message as payload_json, each file
    beside it. An embed shows one of them as its picture by naming it
    attachment://<name>.
  */
  if (files?.length) {
    body.attachments = files.map((f, i) => ({ id: i, filename: f.name }));
    const form = new FormData();
    form.append('payload_json', JSON.stringify(body));
    files.forEach((f, i) => form.append(`files[${i}]`, new Blob([f.data], { type: f.type || 'image/png' }), f.name));
    return restQueue().push(() => request('POST', `/channels/${channelId}/messages`, { body: form, isMultipart: true }));
  }
  return restQueue().push(() => request('POST', `/channels/${channelId}/messages`, { body }));
}

/** Replace the content and embed of a message the bot already posted. */
export function editMessage(channelId, messageId, content, embed, components, extra = {}) {
  if (!channelId || !messageId) return Promise.resolve(null);
  const body = { content: content ?? '', ...extra };
  // Explicitly empty rather than omitted: leaving it out keeps the old embed,
  // so a menu that dropped its embed would never lose it.
  body.embeds = embed ? [toEmbed(embed)] : [];
  if (components) body.components = components;
  return restQueue().push(() => request('PATCH', `/channels/${channelId}/messages/${messageId}`, { body }));
}

/**
 * A message built whole — for the Discord pages, whose messages are an
 * embed or the newer layout's components rather than words and a card —
 * posted or edited in the queue with the rest. Files go beside it as a
 * multipart form, each named in `attachments`; on an edit that list is what
 * the message keeps, so an edit without files says so with an empty one.
 */
export function sendBuilt(method, endpoint, body, files = []) {
  if (files.length) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ ...body, attachments: files.map((f, i) => ({ id: i, filename: f.name })) }));
    files.forEach((f, i) => form.append(`files[${i}]`, new Blob([f.data], { type: f.type || 'image/png' }), f.name));
    return restQueue().push(() => request(method, endpoint, { body: form, isMultipart: true }));
  }
  return restQueue().push(() => request(method, endpoint, { body: method === 'PATCH' ? { attachments: [], ...body } : body }));
}

/** A channel's newest messages, newest first as Discord gives them: up to 100. */
export function listMessages(channelId, limit = 50) {
  if (!channelId) return Promise.resolve([]);
  return request('GET', `/channels/${channelId}/messages?limit=${Math.min(100, Math.max(1, Math.round(limit) || 50))}`);
}

/** Take the bot's own reaction off a message. */
export function removeOwnReaction(channelId, messageId, emoji) {
  if (!channelId || !messageId || !emoji) return Promise.resolve(null);
  return restQueue().push(() => request('DELETE', `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(reactionTarget(emoji))}/@me`));
}

export function deleteMessage(channelId, messageId) {
  if (!channelId || !messageId) return Promise.resolve(null);
  return restQueue().push(() => request('DELETE', `/channels/${channelId}/messages/${messageId}`));
}

export function getMessage(channelId, messageId) {
  if (!channelId || !messageId) return Promise.resolve(null);
  return request('GET', `/channels/${channelId}/messages/${messageId}`);
}

/**
 * React to a message as the bot, which is how a reaction-role menu gets the
 * reactions people click.
 *
 * The emoji goes in the path, so it has to be `name:id` for a custom one and
 * the raw character for a unicode one — both percent-encoded. Accepts the
 * markup form (`<a:name:id>`) as well, since that is what a person pastes.
 */
export function addReaction(channelId, messageId, emoji) {
  if (!channelId || !messageId || !emoji) return Promise.resolve(null);
  return restQueue().push(() => request(
    'PUT',
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(reactionTarget(emoji))}/@me`,
  ));
}

/**
 * Take somebody's reaction off a message: a menu that lets a member hold one
 * of its roles moves their reaction along with the role.
 */
export function removeUserReaction(channelId, messageId, emoji, userId) {
  const target = reactionTarget(emoji);
  if (!channelId || !messageId || !target || !userId) return Promise.resolve(null);
  return restQueue().push(() => request(
    'DELETE',
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(target)}/${userId}`,
  ));
}

/** An emoji as a reaction's address: `name:id` for a server's own, the character itself otherwise. */
function reactionTarget(emoji) {
  if (emoji && typeof emoji === 'object') return emoji.id ? `${emoji.name}:${emoji.id}` : String(emoji.name ?? '');
  const raw = String(emoji ?? '').trim();
  const markup = /^<(a?):([^:]+):(\d+)>$/.exec(raw);
  return markup ? `${markup[2]}:${markup[3]}` : raw;
}

export function addRole(guildId, userId, roleId) {
  return roleQueue().push(() => request('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`));
}

export function removeRole(guildId, userId, roleId) {
  return roleQueue().push(() => request('DELETE', `/guilds/${guildId}/members/${userId}/roles/${roleId}`));
}

export function getRoles(guildId) {
  return request('GET', `/guilds/${guildId}/roles`);
}

export function getChannels(guildId) {
  return request('GET', `/guilds/${guildId}/channels`);
}

export function getEmojis(guildId) {
  return request('GET', `/guilds/${guildId}/emojis`);
}

export function searchMembers(guildId, q) {
  return request('GET', `/guilds/${guildId}/members/search?query=${encodeURIComponent(q)}&limit=10`);
}

/**
 * Every page of a list Discord hands out a page at a time: `fetchPage(after)`
 * for the page after the id `after`, until one comes back short. Capped, so a
 * list that never ends cannot keep asking.
 */
export async function allPages(fetchPage, { limit = 1000, maxPages = 10, idOf = (item) => item?.user?.id } = {}) {
  const all = [];
  let after = '0';
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fetchPage(after);
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    if (batch.length < limit) break;
    after = idOf(batch[batch.length - 1]);
    if (!after) break;
  }
  return all;
}

/**
 * Everybody in a server, a thousand at a time — the most Discord gives in one
 * request. Needs the "Server Members" intent, which the bot already asks for
 * (INTENTS above): without it the bot would not connect at all.
 */
export function listMembers(guildId) {
  return allPages((after) => request('GET', `/guilds/${guildId}/members?limit=1000&after=${after}`));
}

/**
 * The bot's own member record in a guild. The UI uses this to work out which
 * roles the bot outranks, so it can grey out ones it cannot assign.
 */
/**
 * The bot's own member record, used to work out which roles it outranks.
 *
 * `/guilds/{id}/members/@me` only works with an OAuth bearer token carrying
 * `guilds.members.read`; with a bot token the member must be addressed by id,
 * which is why this previously came back empty.
 */
export async function getBotMember(guildId) {
  let id = botUserId;
  if (!id) {
    // Gateway may not have reached READY yet.
    const me = await request('GET', '/users/@me');
    id = me?.id;
    botUserId = id ?? botUserId;
  }
  if (!id) throw new Error('Discord: bot user id unknown');
  return request('GET', `/guilds/${guildId}/members/${id}`);
}

export function getGuilds() {
  return request('GET', '/users/@me/guilds');
}

/** Post to an incoming webhook. Used by the `discord_webhook` action step. */
export async function postWebhook(url, content) {
  // Only accept genuine Discord webhook URLs — this value comes from user
  // config and would otherwise be an arbitrary outbound POST.
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Discord webhook: malformed URL');
  }
  if (!/(^|\.)discord(app)?\.com$/.test(parsed.hostname) || !parsed.pathname.startsWith('/api/webhooks/')) {
    throw new Error('Discord webhook: URL is not a Discord webhook endpoint');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: String(content).slice(0, 2000) }),
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status}`);
}

/**
 * A footer or author line. Discord draws a server's own emoji in a
 * description, but in these two lines `<:Wow:123>` shows as exactly that.
 * The first one becomes the line's small picture — at its start, where a
 * footer emoji usually sits — and the markup leaves the words.
 */
export function smallPrint(text, key, max) {
  const raw = String(text ?? '');
  const first = /<(a?):[\w~]+:(\d+)>/.exec(raw);
  if (!first) return { [key]: raw.slice(0, max) };
  // Discord will not take an empty line, so an emoji alone keeps an invisible space.
  const words = raw.replace(/<a?:[\w~]+:\d+>/g, '').replace(/[ \t]{2,}/g, ' ').trim() || '​';
  return { [key]: words.slice(0, max), icon_url: `https://cdn.discordapp.com/emojis/${first[2]}.${first[1] ? 'gif' : 'png'}` };
}

function toEmbed(e) {
  const embed = {};
  if (e.title) embed.title = e.title;
  // The title as a link, and a line of small print at the top.
  if (e.url && /^https?:\/\//.test(e.url)) embed.url = e.url;
  if (e.author) embed.author = smallPrint(e.author, 'name', 256);
  if (e.description) embed.description = e.description;
  if (e.footer) embed.footer = smallPrint(e.footer, 'text', 2048);
  if (e.thumbnail) embed.thumbnail = { url: e.thumbnail };
  if (e.image) embed.image = { url: e.image };
  if (e.fields?.length) embed.fields = e.fields;
  if (e.color) {
    const n = Number.parseInt(String(e.color).replace('#', ''), 16);
    if (!Number.isNaN(n)) embed.color = n;
  }
  return embed;
}

// -------------------------------------------------------------------- OAuth

export async function exchangeCode(code, redirectUri) {
  // The values, not the getters: sending the functions themselves put their
  // source code where the id and secret belong, so every sign-in failed.
  const [appId, appSecret] = [clientId(), clientSecret()];
  if (!appId || !appSecret) throw new Error('Discord: client id/secret are not set');

  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`Discord auth failed: ${json.error_description || json.error}`);

  const user = await request('GET', '/users/@me', { token: `Bearer ${json.access_token}` });
  const guilds = await request('GET', '/users/@me/guilds', { token: `Bearer ${json.access_token}` });

  // Persist so other devices see who is signed in without repeating OAuth.
  cache.set({ ...cache.get(), user, guilds });
  refreshCache().catch(() => { /* best effort */ });

  return { user, guilds };
}

/**
 * Who a message may ping, from what its author wrote rather than what ended
 * up in it. Text that came from chat through a variable can say
 * "@everyone" or "<@&role>" all it likes: only the role pings and the
 * @everyone typed into the template itself are let through.
 */
export function mentionsFrom(template) {
  const t = String(template ?? '');
  const roles = [...new Set([...t.matchAll(/<@&(\d{5,25})>/g)].map((m) => m[1]))].slice(0, 100);
  const parse = ['users'];
  if (/@(everyone|here)\b/.test(t)) parse.push('everyone');
  return { parse, roles };
}

/** Whether commands work in every channel of the server, not only the one the app reads. On unless turned off (Connections). */
export const commandsEverywhere = () => settings?.get().commandsEverywhere !== false;

export const service = { postWebhook, sendMessage, addRole, removeRole, sanitise, mentionsFrom, commandsEverywhere };
