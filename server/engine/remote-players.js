/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Remote players: four seats for people playing from their own homes.
 *
 * The picture comes through VDO.Ninja, which is free and peer to peer: the
 * player opens a link, shares their game window, and it goes from their
 * browser straight to the streamer's OBS, nothing in between but VDO.Ninja's
 * handshake. This links to the hosted site; none of it runs here.
 *
 * Each seat has a link of its own, made once and kept, so a regular keeps
 * theirs from one game night to the next. In OBS each seat is a browser
 * source — "Player 1" to "Player 4", made here with one click — that views
 * that seat, and the 4 Players layouts place them like any other source.
 * Kicking somebody makes their seat a new one: the old link stops working.
 *
 * The page in OBS can be asked how it is doing, through VDO.Ninja's remote
 * API: whether it is running, and whether somebody is sending to it, at what
 * size. That is each seat's light on the screen. It is only asked while OBS
 * is connected, since that is where the pages run.
 */

import { randomBytes } from 'node:crypto';
import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import { REMOTE_SEATS } from '../../shared/run.js';
import { QUALITIES, DEFAULT_QUALITY, ON_SCREEN_SOURCE } from '../../shared/remote-players.js';

const log = createLogger('remote-players');

export const SEATS = REMOTE_SEATS;
export { QUALITIES, DEFAULT_QUALITY, ON_SCREEN_SOURCE };

/** The OBS source that shows a seat. */
export const sourceName = (n) => `Player ${n}`;
const OUR_SOURCE = /^Player ([1-9])$/;
/** A nameplate still saying what the 4 Players layout typed into it: "Player 2", "Player 2". */
const PLACEHOLDER_PLATE = /^(?:jugador|player)\s*([1-9])$/i;

/** How often the pages in OBS are asked how they are. */
const ASK_EVERY_MS = 8_000;
const ASK_TIMEOUT_MS = 6_000;
const VDO = 'https://vdo.ninja/';
const API = 'https://api.vdo.ninja/';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** A random id VDO.Ninja accepts as a stream ID, a password or an API key. */
export function newId(length = 12) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const idOr = (v, re, make) => (re.test(String(v ?? '')) ? String(v) : make());

/** A seat as stored: who is in it, and its link's ids, each made if it has none. */
export function cleanSeat(s, n) {
  const x = s && typeof s === 'object' ? s : {};
  return {
    n,
    name: String(x.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
    discordId: /^\d{5,25}$/.test(String(x.discordId ?? '')) ? String(x.discordId) : '',
    streamId: idOr(x.streamId, /^[A-Za-z0-9]{8,40}$/, () => newId(12)),
    password: idOr(x.password, /^[A-Za-z0-9]{8,40}$/, () => newId(12)),
    // The seat's page in OBS: it stays with the seat when the people in it change.
    apiKey: idOr(x.apiKey, /^[A-Za-z0-9]{12,60}$/, () => newId(20)),
    quality: Object.prototype.hasOwnProperty.call(QUALITIES, x.quality) ? x.quality : DEFAULT_QUALITY,
  };
}

export function cleanRemotePlayers(v) {
  const x = v && typeof v === 'object' ? v : {};
  const seats = Array.isArray(x.seats) ? x.seats : [];
  return {
    seats: Array.from({ length: SEATS }, (_, i) => cleanSeat(seats[i], i + 1)),
    /** The OBS scene the sources were made in, and when, once they have been. */
    scene: String(x.scene ?? '').slice(0, 256),
    setupAt: Number.isFinite(Number(x.setupAt)) ? Number(x.setupAt) : 0,
    /*
      The streamer's own seat, if they are playing: its slot shows their
      capture — an OBS source of theirs — instead of a remote player. 0 is
      only commenting.
    */
    me: {
      seat: Number.isInteger(Number(x.me?.seat)) && Number(x.me.seat) >= 0 && Number(x.me.seat) <= SEATS ? Number(x.me.seat) : 0,
      source: String(x.me?.source ?? '').trim().slice(0, 256),
    },
    /*
      The seat on screen: the one whose game the "Player on screen" slots
      show (ON_SCREEN_SOURCE) — the Gameplay layouts' game, full screen. Kept,
      so a restart does not change whose game is up.
    */
    onScreen: Number.isInteger(Number(x.onScreen)) && Number(x.onScreen) >= 1 && Number(x.onScreen) <= SEATS ? Number(x.onScreen) : 1,
  };
}

/** The link a player opens: share a window, and it arrives in the seat. */
export function inviteLink(seat) {
  const q = QUALITIES[seat.quality] || QUALITIES[DEFAULT_QUALITY];
  const label = encodeURIComponent(seat.name || sourceName(seat.n));
  return `${VDO}?push=${seat.streamId}&screenshare&quality=${q.quality}&maxframerate=${q.fps}&label=${label}#p=${seat.password}`;
}

/** What the seat's browser source in OBS opens: that one picture, nothing around it, and answering the API. */
export function viewLink(seat) {
  const q = QUALITIES[seat.quality] || QUALITIES[DEFAULT_QUALITY];
  return `${VDO}?view=${seat.streamId}&api=${seat.apiKey}&cleanoutput&videobitrate=${q.kbps}#p=${seat.password}`;
}

/**
 * What VDO.Ninja's getDetails says about a seat's page.
 *
 * "off": no page answered — OBS is closed, or the source was deleted. A
 * running page always lists itself; the player, once they are sending, is
 * the entry under the seat's stream ID, with the size their picture started
 * at.
 */
export function readDetails(text, streamId) {
  let data;
  try { data = JSON.parse(text); } catch { return { state: 'off' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { state: 'off' };
  const local = (d) => d?.localStream === true || d?.localstream === true;
  const them = (data[streamId] && !local(data[streamId])) ? data[streamId] : Object.values(data).find((d) => d && typeof d === 'object' && !local(d));
  if (!them) return { state: 'waiting' };
  const m = them.miscellaneous || {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    state: them.videoVisible === false ? 'connecting' : 'live',
    label: typeof them.label === 'string' ? them.label.slice(0, 60) : '',
    width: num(m.video_init_width),
    height: num(m.video_init_height),
    fps: num(m.video_init_frameRate),
  };
}

// ------------------------------------------------------------------ the layouts

const box = (y) => ({ x: Number(y.x) || 0, y: Number(y.y) || 0, h: Number(y.height) || 0 });

/*
  Reading order, top row first. Two slots are on one row when their tops are
  closer than half the shorter one's height: a slot nudged up two pixels in
  the editor is still on the row it was on, not ahead of its neighbour.
*/
const readingOrder = (a, b) => {
  const A = box(a);
  const B = box(b);
  return Math.abs(A.y - B.y) < Math.min(A.h, B.h) / 2 ? A.x - B.x : A.y - B.y;
};

/**
 * A layout with its source slots pointed at the seats, when it is one made
 * for remote players: two to four slots, each empty or already a seat, so a
 * slot that shows something the streamer chose is never taken. A slot that
 * names a seat keeps it; the empty ones take the seats left, as read, top
 * row first. A nameplate still saying "Player 2" (or "Player 2") follows
 * seat 2's name from then on.
 *
 * Returns the layout unchanged when there is nothing to do.
 */
export function wireLayout(layout) {
  const layers = Array.isArray(layout?.layers) ? layout.layers : [];
  const slots = layers.filter((y) => y?.type === 'source');
  if (slots.length < 2 || slots.length > SEATS) return layout;
  if (!slots.every((y) => !y.config?.source || OUR_SOURCE.test(y.config.source))) return layout;

  // Seats already named stay where the streamer has them; each empty slot gets the lowest one free.
  const seatOf = new Map();
  for (const y of slots) {
    const m = OUR_SOURCE.exec(y.config?.source || '');
    if (m && ![...seatOf.values()].includes(Number(m[1]))) seatOf.set(y, Number(m[1]));
  }
  let free = 1;
  for (const y of [...slots].sort(readingOrder)) {
    if (seatOf.has(y)) continue;
    while ([...seatOf.values()].includes(free)) free += 1;
    seatOf.set(y, free);
  }
  let changed = false;
  const next = layers.map((y) => {
    if (seatOf.has(y)) {
      const source = sourceName(seatOf.get(y));
      if (y.config?.source === source) return y;
      changed = true;
      return { ...y, config: { ...(y.config || {}), source } };
    }
    if (y?.type === 'nameplate' && (!y.config?.source || y.config.source === 'manual')) {
      const m = PLACEHOLDER_PLATE.exec(String(y.config?.name ?? '').trim());
      const n = m ? Number(m[1]) : 0;
      if (n >= 1 && n <= slots.length) {
        changed = true;
        return { ...y, config: { ...(y.config || {}), source: `player${n}` } };
      }
    }
    return y;
  });
  return changed ? { ...layout, layers: next } : layout;
}

export const wireLayouts = (layouts) => {
  const list = Array.isArray(layouts) ? layouts : [];
  const next = list.map(wireLayout);
  return next.some((l, i) => l !== list[i]) ? next : list;
};

// ------------------------------------------------------------------ state

let db = null;
let obs = null;
let discord = null;
let layoutsHelp = null;
let omni = null;
let sceneNow = () => '';
let testChannel = () => '';
let streamerName = () => '';
/** How each seat's page is doing, by seat number. Not stored: it is only ever now. */
let status = {};
/** Whether each seat's source is muted in OBS, as last asked. */
let muted = {};
/*
  How many answers in a row a running page has missed. A page busy
  connecting a player can miss one question; saying "not running" on the
  first miss made a seat flash red every time somebody joined.
*/
let misses = {};
let timer = null;
let asking = false;
/** Stopped: nothing is asked any more, whatever OBS does. */
let stopped = false;

const seats = () => db.get().seats;
const me = () => db.get().me;
/** The streamer is in this seat, with a capture to show there. */
const isMe = (n) => me().seat === n && Boolean(me().source);

/**
 * What a layout slot's source really is in OBS (omnilayer.js asks): the
 * seat on screen's for "Player on screen", then the streamer's capture for
 * their own seat's browser source, everything else as it is named.
 */
export function aliasFor(name) {
  if (!db) return name;
  const seatName = name === ON_SCREEN_SOURCE ? sourceName(db.get().onScreen) : name;
  const m = OUR_SOURCE.exec(String(seatName ?? ''));
  return m && isMe(Number(m[1])) ? me().source : seatName;
}

/**
 * Every OBS source a slot's name can stand for, so whichever is not placed
 * is hidden: for "Player on screen", every seat's — the one on screen a
 * moment ago included, which nothing else may have a box for.
 */
export function everyAliasOf(name) {
  if (name !== ON_SCREEN_SOURCE) return [aliasFor(name)];
  const all = new Set();
  for (let n = 1; n <= SEATS; n += 1) {
    all.add(sourceName(n));
    all.add(aliasFor(sourceName(n)));
  }
  return [...all].filter(Boolean);
}

/** A slot showing a remote player: one seat's, or the seat on screen. */
export const isPlayerSource = (name) => name === ON_SCREEN_SOURCE || OUR_SOURCE.test(String(name ?? ''));

const plain = (v) => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** What people type for the streamer's own seat. */
const MINE = ['yo', 'me', 'mio', 'mine', 'streamer'];

/**
 * The seat somebody means: its number — "2", "j2", "jugador 2", "player 2",
 * "#2" — the streamer's own ("yo"), or the name of who is in it, whole or
 * its start ("benji", and "pixel" for 𝒫𝒾𝓍ℯ𝓁: fancy letters read as
 * plain ones). 0 when it names no seat.
 */
export function seatFromWords(words) {
  const said = plain(words).replace(/^[!#@]+/, '');
  if (!said) return 0;
  const num = /^(?:j|p|jugador|player|seat|asiento)?\s*([1-9])$/.exec(said);
  if (num) return Number(num[1]) <= SEATS ? Number(num[1]) : 0;
  if (MINE.includes(said)) return me().seat || 0;
  const named = seats().filter((s) => s.name);
  const exact = named.find((s) => plain(s.name) === said);
  if (exact) return exact.n;
  const start = said.length >= 3 ? named.filter((s) => plain(s.name).startsWith(said)) : [];
  return start.length === 1 ? start[0].n : 0;
}

/**
 * Put a seat's game on screen: in every "Player on screen" slot, the In
 * Game layouts' game. The game that was there is hidden, unless the live
 * layout has a box of its own for it. Gives the seat, or 0 when the words
 * name none and nothing changed.
 */
export function putOnScreen(words) {
  if (!db) return 0;
  const n = typeof words === 'number' ? (words >= 1 && words <= SEATS ? words : 0) : seatFromWords(words);
  if (!n) return 0;
  if (db.get().onScreen !== n) {
    const before = aliasFor(ON_SCREEN_SOURCE);
    db.set({ ...db.get(), onScreen: n });
    omni?.refresh([before]);
    publish();
    log.info(`on screen: ${sourceName(n)}${isMe(n) ? ` (the streamer, ${me().source})` : ''}`);
  }
  return n;
}
const seat = (n) => {
  const s = seats().find((x) => x.n === Number(n));
  if (!s) throw refusal('remote_no_seat', 'there is no seat like that');
  return s;
};

/** What the screens get: the seats with their invite links and how each is doing. The OBS side of each link stays here. */
export function getRemotePlayers() {
  const v = db?.get() || cleanRemotePlayers({});
  let target = '';
  try { target = sceneNow() || ''; } catch { /* OBS or the engine not up yet */ }
  return {
    scene: v.scene,
    setupAt: v.setupAt,
    /** The scene a setup would put the sources in now. */
    target,
    me: v.me,
    onScreen: v.onScreen,
    seats: v.seats.map((s) => ({
      n: s.n,
      name: s.name,
      discordId: s.discordId,
      quality: s.quality,
      source: sourceName(s.n),
      invite: inviteLink(s),
      me: v.me.seat === s.n,
      status: v.me.seat === s.n ? { state: 'me' } : status[s.n] || { state: 'unknown' },
      muted: muted[s.n] === true,
    })),
  };
}

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'remotePlayers', value: getRemotePlayers() });
}

export const snapshot = () => ({ remotePlayers: getRemotePlayers() });

function saveSeats(change) {
  db.set(cleanRemotePlayers({ ...db.get(), seats: seats().map((s) => change(s) || s) }));
}

// ------------------------------------------------------------------ OBS

/** The seat's browser source pointed at its link now, at its size — if the sources have been made. */
async function pointSource(s) {
  if (!db.get().setupAt || !obs?.isConnected?.()) return false;
  const q = QUALITIES[s.quality];
  try {
    await obs.setBrowserSettings(sourceName(s.n), { url: viewLink(s), width: q.width, height: q.height });
    return true;
  } catch (err) {
    log.warn(`could not point ${sourceName(s.n)} at its seat: ${err.message}`);
    return false;
  }
}

/**
 * Make the four browser sources in the Omnilayer scene (or bring the ones
 * there up to date), then point the layouts' slots at them — the live ones
 * and every saved profile's.
 */
async function setup() {
  if (!obs?.isConnected?.()) throw refusal('obs_offline', 'OBS is not connected');
  const scene = sceneNow();
  if (!scene) throw refusal('remote_no_scene', 'OBS has no scene to put them in');
  const sources = [];
  for (const s of seats()) {
    const q = QUALITIES[s.quality];
    try {
      const r = await obs.ensureBrowserSource(scene, sourceName(s.n), { url: viewLink(s), width: q.width, height: q.height });
      sources.push({ n: s.n, source: sourceName(s.n), done: r.done });
    } catch (err) {
      sources.push({ n: s.n, source: sourceName(s.n), done: 'failed', error: err.message });
    }
  }
  if (sources.some((x) => x.done !== 'failed' && x.done !== 'other_kind')) {
    db.set({ ...db.get(), scene, setupAt: Date.now() });
  }
  const layouts = layoutsHelp ? layoutsHelp.rewrite(wireLayouts) : { live: [], profiles: 0 };
  publish();
  schedule(500);
  log.info(`set up in "${scene}": ${sources.map((x) => `${x.source} ${x.done}`).join(', ')}; layouts wired: ${layouts.live.join(', ') || 'none live'}, ${layouts.profiles} profile(s)`);
  return { ...getRemotePlayers(), sources, layouts };
}

// ------------------------------------------------------------------ asking the pages

async function askPage(s) {
  try {
    const res = await fetch(`${API}${s.apiKey}/getDetails`, { signal: AbortSignal.timeout(ASK_TIMEOUT_MS) });
    return { ...readDetails(await res.text(), s.streamId), at: Date.now() };
  } catch {
    // VDO.Ninja itself could not be reached: not the same as the page being off.
    return { state: 'unknown', at: Date.now() };
  }
}

/** What the screens would be told, less when it was asked: the time alone is not news. */
const signature = () => JSON.stringify([Object.entries(status).map(([n, x]) => [n, { ...x, at: 0 }]), muted]);

async function askAll() {
  if (asking) return;
  asking = true;
  try {
    const before = signature();
    if (!db.get().setupAt || !obs?.isConnected?.()) {
      status = {};
    } else {
      // The streamer's own seat has nobody to ask about.
      const answers = await Promise.all(seats().map((s) => (me().seat === s.n ? { state: 'me' } : askPage(s))));
      const next = {};
      seats().forEach((s, i) => {
        const was = status[s.n]?.state;
        const missed = answers[i].state === 'off' && ['waiting', 'connecting', 'live'].includes(was);
        misses = { ...misses, [s.n]: missed ? (misses[s.n] || 0) + 1 : 0 };
        next[s.n] = missed && misses[s.n] < 2 ? status[s.n] : answers[i];
        if (answers[i].state === 'live' && was !== 'live' && was !== undefined) log.info(`${sourceName(s.n)}: ${s.name || answers[i].label || 'somebody'} is sending`);
      });
      status = next;
      if (obs.inputMuted) {
        const m = await Promise.all(seats().map((s) => obs.inputMuted(sourceName(s.n)).catch(() => null)));
        muted = Object.fromEntries(seats().map((s, i) => [s.n, m[i] === true]));
      }
    }
    if (signature() !== before) publish();
  } finally {
    asking = false;
  }
}

function schedule(ms = ASK_EVERY_MS) {
  clearTimeout(timer);
  if (stopped) return;
  timer = setTimeout(async () => {
    await askAll().catch((err) => log.debug(`asking the seats: ${err.message}`));
    schedule();
  }, ms);
  timer.unref?.();
}

// ------------------------------------------------------------------ Discord

/** The direct message with a seat's link: what to do with it, and the link as a button. */
export function inviteMessage(s, streamer = '') {
  const who = streamer ? `**${streamer}** te invita` : 'Te invitan';
  return {
    content: [
      `🎮 ${who} a jugar en el directo: eres **${sourceName(s.n)}**.`,
      'Abre tu enlace en Chrome o Edge en el ordenador donde juegas, pulsa **Compartir pantalla** y elige la ventana del juego.',
      'El enlace es solo tuyo y vale para las próximas partidas también. No lo compartas.',
    ].join('\n'),
    components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Abrir mi enlace', url: inviteLink(s) }] }],
  };
}

async function invite(n, { test = false } = {}) {
  const s = seat(n);
  const msg = inviteMessage(s, streamerName());
  if (test) {
    const channelId = testChannel();
    if (!channelId) throw refusal('remote_no_test_channel', 'choose a test channel on the Welcome & Goodbye screen first');
    await discord.sendMessage(channelId, `*(prueba)*\n${msg.content}`, null, msg.components, undefined, { allowed_mentions: { parse: [] } });
    return { ok: true, channelId };
  }
  if (!s.discordId) throw refusal('remote_no_discord', 'choose who is in the seat from Discord first');
  try {
    const channel = await discord.request('POST', '/users/@me/channels', { body: { recipient_id: s.discordId } });
    // Nothing to send to is nothing sent: never "sent" over a message that went nowhere.
    if (!channel?.id) throw new Error('Discord opened no conversation');
    const sent = await discord.sendMessage(channel.id, msg.content, null, msg.components, undefined, { allowed_mentions: { parse: [] } });
    if (!sent?.id) throw new Error('Discord took no message');
  } catch (err) {
    log.debug(`could not message ${s.name || s.discordId}: ${err.message}`);
    throw refusal('remote_dm_closed', 'their direct messages are closed: send them the link yourself');
  }
  log.info(`invited ${s.name || s.discordId} to ${sourceName(s.n)}`);
  return { ok: true };
}

// ------------------------------------------------------------------ the screen

/**
 * From the Remote players screen:
 *   set     { n, name?, discordId?, quality? } who is in a seat, and how good a picture it asks for
 *   setup   make the OBS sources and wire the layouts
 *   invite  { n, test? } send the seat's link by direct message, or a sample to the test channel
 *   kick    { n } empty the seat and make it a new one, so its old link stops working
 *   swap    { a, b } two seats change places, people and links both
 *   mute    { n, muted } the seat's sound in OBS
 *   reload  { n } the seat's page in OBS, reloaded — for a picture that froze
 *   me      { seat?, source? } the streamer's own seat (0: only commenting) and the capture it shows
 */
export async function control(payload = {}) {
  const op = payload.op;
  if (op === 'setup') return setup();
  if (op === 'set') {
    const s = seat(payload.n);
    const has = (k) => Object.prototype.hasOwnProperty.call(payload, k);
    saveSeats((x) => (x.n !== s.n ? null : {
      ...x,
      ...(has('name') ? { name: payload.name } : {}),
      ...(has('discordId') ? { discordId: payload.discordId } : {}),
      ...(has('quality') ? { quality: payload.quality } : {}),
    }));
    if (seat(s.n).quality !== s.quality) await pointSource(seat(s.n));
    publish();
    return getRemotePlayers();
  }
  if (op === 'invite') return invite(payload.n, { test: payload.test === true });
  // Whose game the "Player on screen" slots show.
  if (op === 'onscreen') {
    if (!putOnScreen(Number(seat(payload.n).n))) throw refusal('remote_no_seat', 'there is no seat like that');
    return getRemotePlayers();
  }
  if (op === 'me') {
    const has = (k) => Object.prototype.hasOwnProperty.call(payload, k);
    const next = cleanRemotePlayers({ ...db.get(), me: { ...me(), ...(has('seat') ? { seat: payload.seat } : {}), ...(has('source') ? { source: payload.source } : {}) } }).me;
    const before = me();
    db.set({ ...db.get(), me: next });
    // Their seat wears their name unless it already has one.
    const mine = next.seat ? seat(next.seat) : null;
    if (mine && !mine.name && streamerName()) saveSeats((x) => (x.n === mine.n ? { ...x, name: streamerName() } : null));
    if (next.seat) status = { ...status, [next.seat]: { state: 'me' } };
    // A capture that no longer stands in for a seat goes out of sight, rather than staying where the seat was.
    const left = before.seat && before.source && (!next.seat || next.source !== before.source) ? [before.source] : [];
    omni?.refresh(left);
    publish();
    log.info(next.seat ? `the streamer plays in ${sourceName(next.seat)}, shown with ${next.source || '(no capture chosen)'}` : 'the streamer is only commenting');
    return getRemotePlayers();
  }
  if (op === 'kick') {
    const s = seat(payload.n);
    saveSeats((x) => (x.n !== s.n ? null : { n: x.n, apiKey: x.apiKey, quality: x.quality }));
    // Emptying the streamer's own seat is the streamer leaving it.
    if (me().seat === s.n) {
      db.set({ ...db.get(), me: { ...me(), seat: 0 } });
      omni?.refresh([me().source]);
    }
    status = { ...status, [s.n]: { state: 'unknown' } };
    await pointSource(seat(s.n));
    publish();
    log.info(`${sourceName(s.n)} emptied: its old link no longer works`);
    return getRemotePlayers();
  }
  if (op === 'swap') {
    const a = seat(payload.a);
    const b = seat(payload.b);
    if (a.n === b.n) return getRemotePlayers();
    // The people and their links move; each seat's page in OBS stays where it is.
    const moving = ({ name, discordId, streamId, password, quality }) => ({ name, discordId, streamId, password, quality });
    saveSeats((x) => (x.n === a.n ? { ...x, ...moving(b) } : x.n === b.n ? { ...x, ...moving(a) } : null));
    status = { ...status, [a.n]: status[b.n], [b.n]: status[a.n] };
    // The streamer moves with their seat, like everybody else; and whoever is on screen stays on screen.
    const mine = me().seat;
    if (mine === a.n || mine === b.n) {
      db.set({ ...db.get(), me: { ...me(), seat: mine === a.n ? b.n : a.n } });
      omni?.refresh();
    }
    const shown = db.get().onScreen;
    if (shown === a.n || shown === b.n) {
      db.set({ ...db.get(), onScreen: shown === a.n ? b.n : a.n });
      omni?.refresh();
    }
    await Promise.all([pointSource(seat(a.n)), pointSource(seat(b.n))]);
    publish();
    return getRemotePlayers();
  }
  if (op === 'mute') {
    const s = seat(payload.n);
    if (!obs?.isConnected?.()) throw refusal('obs_offline', 'OBS is not connected');
    await obs.setMuted(sourceName(s.n), payload.muted === true);
    muted = { ...muted, [s.n]: payload.muted === true };
    publish();
    return getRemotePlayers();
  }
  if (op === 'reload') {
    const s = seat(payload.n);
    if (!obs?.isConnected?.()) throw refusal('obs_offline', 'OBS is not connected');
    await obs.reloadBrowser(sourceName(s.n));
    return getRemotePlayers();
  }
  throw refusal('remote_unknown_op', 'unknown remote players request');
}

/**
 * `layouts.rewrite(fn)` applies fn to the live layouts and every saved
 * profile's, and says which live layouts changed and in how many profiles.
 * `omnilayer.refresh()` places the live layout again, after the streamer
 * takes or leaves a seat (see aliasFor).
 */
export function initRemotePlayers({ obsService, discordService, layouts, scene, testChannelId, streamer, omnilayer } = {}) {
  omni = omnilayer || null;
  obs = obsService || null;
  discord = discordService || null;
  layoutsHelp = layouts || null;
  sceneNow = scene || (() => '');
  testChannel = testChannelId || (() => '');
  streamerName = streamer || (() => '');
  db = collection('remote_players', cleanRemotePlayers({}));
  db.set(cleanRemotePlayers(db.get()));
  status = {};
  muted = {};
  misses = {};
  stopped = false;
  // OBS coming or going changes what can be known: ask straight away rather than at the next tick.
  bus.on(EVENTS.STATUS, (s) => {
    if (s?.platform === 'obs' && !s.scenes && (s.status === 'connected' || s.status === 'disconnected')) schedule(1500);
  });
  schedule(3000);
}

export function stopRemotePlayers() {
  stopped = true;
  clearTimeout(timer);
  timer = null;
}

export const _test = { askAll, status: () => status };
