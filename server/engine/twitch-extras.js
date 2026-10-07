/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Twitch extras: the Hype Train as it runs, shoutouts for whoever raids,
 * clips and stream markers on demand, and the channel's stream schedule.
 *
 * Each of these is something Twitch already knows or already does; this is
 * the part that puts it on stream and on a button. The Hype Train and the
 * shoutout card are states a layer draws (hypeTrain, shoutoutCard); the
 * schedule is a state text layers and the Discord posts read
 * (twitchSchedule); clips and markers are things that happen, and say how
 * they went.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as twitch from '../platforms/twitch.js';

const log = createLogger('twitch-extras');

/** Twitch itself; the smoke tests hand in a stand-in, so nothing reaches Twitch. */
let api = twitch;
export function useTwitchForTests(fake) {
  api = fake || twitch;
}

export const DEFAULT_TWITCH_EXTRAS = {
  shoutout: {
    /** Shout out whoever raids, as the raid lands. */
    onRaid: true,
    /** Only raids of at least this many people. */
    minViewers: 1,
    /** Twitch's own /shoutout — the card on Twitch with their follow button. */
    native: true,
    /** Say it in chat too. */
    chat: true,
    message: '¡Gracias por la raid, {name}! Vayan a seguirle en {link} — estaba jugando {game}.',
    /** How long the shoutout card stays on stream, in seconds. */
    cardSeconds: 12,
  },
  clip: {
    /** Post a clip made from the dock in chat. */
    chat: true,
    message: '🎬 Nuevo clip: {url}',
  },
};

/** What each extra needs the channel's Twitch login to have been given. */
export const EXTRA_SCOPES = {
  hypeTrain: 'channel:read:hype_train',
  shoutout: 'moderator:manage:shoutouts',
  clip: 'clips:edit',
  marker: 'channel:manage:broadcast',
  // Banning and timing out from the mod log and Role Management (moderation.js).
  moderation: 'moderator:manage:banned_users',
};

const SCHEDULE_EVERY_MS = 15 * 60 * 1000;
/** A raid arrives twice, over chat and over EventSub; one shoutout is enough. */
const SAME_RAIDER_MS = 10 * 60 * 1000;
/** A stream starting within this long is the one you are going live for, not the next one. */
const NEXT_AFTER_MS = 30 * 60 * 1000;

let store = null;
let hype = null;
let card = null;
let cardTimer = null;
let schedule = { segments: [], fetchedAt: null, error: null };
let scopes = null;
let scheduleTimer = null;
const shoutedAt = new Map();

const bounded = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

export function cleanExtras(incoming, before = DEFAULT_TWITCH_EXTRAS) {
  const s = { ...before.shoutout, ...(incoming?.shoutout || {}) };
  const c = { ...before.clip, ...(incoming?.clip || {}) };
  return {
    shoutout: {
      onRaid: s.onRaid !== false,
      minViewers: bounded(s.minViewers, 0, 100000, 1),
      native: s.native !== false,
      chat: s.chat !== false,
      message: String(s.message ?? '').slice(0, 450),
      cardSeconds: bounded(s.cardSeconds, 0, 60, 12),
    },
    clip: {
      chat: c.chat !== false,
      message: String(c.message ?? '').slice(0, 300),
    },
  };
}

export const getExtras = () => cleanExtras(store?.get() ?? DEFAULT_TWITCH_EXTRAS);

export function setExtras(patch) {
  const next = cleanExtras(patch, getExtras());
  store.set(next);
  bus.emit(EVENTS.CONFIG, { key: 'twitchExtras', value: next });
  return next;
}

const fill = (text, vars) => String(text ?? '').replace(/\{(\w+)\}/g, (whole, k) => (k in vars ? String(vars[k] ?? '') : whole)).replace(/[ \t]{2,}/g, ' ').trim();

// ------------------------------------------------------------- Hype Train

/**
 * One update of the Hype Train, from Twitch or a test: the level, how far
 * into it, when it runs out, and — once it is over — when it ended. A level
 * higher than the last marks when it went up, for the avatar to cheer.
 */
export function onHypeTrain(update, now = Date.now()) {
  if (!update) return hype;
  const before = hype;
  const active = update.phase !== 'end';
  hype = {
    active,
    phase: update.phase,
    level: update.level,
    progress: update.progress,
    goal: update.goal,
    total: update.total,
    expiresAt: update.expiresAt ?? null,
    endedAt: active ? null : (update.endedAt ?? now),
    golden: Boolean(update.golden),
    top: update.top || [],
    startedAt: update.phase === 'begin' || !before?.active ? now : before.startedAt,
    levelUpAt: before?.active && update.level > before.level ? now : (update.phase === 'begin' ? null : before?.levelUpAt ?? null),
    test: Boolean(update.test),
  };
  bus.emit(EVENTS.CONFIG, { key: 'hypeTrain', value: hype });
  return hype;
}

let testTimers = [];

/**
 * A Hype Train that is not one: level 1, up to 2, then over, in about twenty
 * seconds, so the layer and the avatar can be seen before a real one.
 */
export function testHypeTrain() {
  testTimers.forEach(clearTimeout);
  const t0 = Date.now();
  const expires = (s) => t0 + s * 1000;
  const steps = [
    [0, { phase: 'begin', level: 1, progress: 300, goal: 1600, total: 300, expiresAt: expires(60), top: [{ user: 'Tripulante', type: 'bits', total: 300 }] }],
    [4, { phase: 'progress', level: 1, progress: 1100, goal: 1600, total: 1100, expiresAt: expires(64) }],
    [8, { phase: 'progress', level: 2, progress: 400, goal: 1800, total: 2000, expiresAt: expires(68) }],
    [13, { phase: 'progress', level: 2, progress: 1500, goal: 1800, total: 3100, expiresAt: expires(73) }],
    [18, { phase: 'end', level: 2, progress: 1500, goal: 1800, total: 3100 }],
  ];
  testTimers = steps.map(([s, u]) => setTimeout(() => onHypeTrain({ top: [], ...u, test: true }), s * 1000));
  testTimers.forEach((t) => t.unref?.());
  return { ok: true };
}

// ------------------------------------------------------------- shoutouts

/** A login from whatever was typed: "@Name", "twitch.tv/name", "Name". */
export function loginOf(text) {
  const word = String(text ?? '').trim().split(/\s+/)[0] || '';
  return word.replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

/**
 * Shout somebody out: Twitch's own shoutout, a line in chat, and the card on
 * stream — each as the settings say. Any of them failing (the stream is not
 * live, Twitch's two-minute limit) leaves the others to go ahead.
 */
export async function shoutout(target, { viewers = null, auto = false } = {}) {
  const cfg = getExtras().shoutout;
  const login = loginOf(target);
  if (!login) return { ok: false, code: 'nobody_to_shout', error: 'nobody to shout out' };
  if (auto) {
    const last = shoutedAt.get(login) || 0;
    if (Date.now() - last < SAME_RAIDER_MS) return { ok: true, skipped: 'already shouted out' };
  }
  shoutedAt.set(login, Date.now());

  let user;
  try {
    user = await api.getUser(login);
  } catch (err) {
    return { ok: false, ...(err.code ? { code: err.code } : {}), error: err.message };
  }
  if (!user) return { ok: false, code: 'no_channel', vars: { login }, error: `no Twitch channel called ${login}` };
  let channel = null;
  try {
    channel = await api.channelOf(user.id);
  } catch (err) {
    log.debug(`could not read ${login}'s channel: ${err.message}`);
  }
  const vars = {
    name: user.display_name || user.login,
    login: user.login,
    game: channel?.game_name || '',
    title: channel?.title || '',
    viewers: viewers ?? '',
    link: `twitch.tv/${user.login}`,
  };
  /*
    What did not go out, twice over: as lines for the log and the Twitch
    screen, and as parts with a code, so Who's on can say which part failed —
    and why, in its own language — instead of "Shoutout sent" regardless.
  */
  const errors = [];
  const failures = [];
  if (cfg.native) {
    try {
      await api.sendShoutout(user.id);
    } catch (err) {
      errors.push(`Twitch shoutout: ${err.message}`);
      failures.push({ part: 'native', ...(/not (streaming )?live|offline/i.test(err.message) ? { code: 'not_live' } : err.code ? { code: err.code } : {}), message: err.message });
    }
  }
  if (cfg.chat && cfg.message) {
    try {
      // With no game to name, the part of the line that names it goes: "… — estaba jugando {game}".
      const line = vars.game ? cfg.message : cfg.message.replace(/\s*[—,-]?\s*[^—.!?,]*\{game\}[^—.!?,]*/, '');
      await api.say(fill(line, vars));
    } catch (err) {
      errors.push(`chat: ${err.message}`);
      failures.push({ part: 'chat', message: err.message });
    }
  }
  if (cfg.cardSeconds > 0) showCard({ ...vars, avatar: user.profile_image_url || '', seconds: cfg.cardSeconds });
  if (errors.length) log.warn(`shoutout for ${login}: ${errors.join('; ')}`);
  return { ok: true, name: vars.name, game: vars.game, errors, failures };
}

/** The shoutout card, on every shoutout layer, for its seconds. */
function showCard(info) {
  clearTimeout(cardTimer);
  card = { ...info, at: Date.now() };
  bus.emit(EVENTS.CONFIG, { key: 'shoutoutCard', value: card });
  cardTimer = setTimeout(() => {
    card = null;
    bus.emit(EVENTS.CONFIG, { key: 'shoutoutCard', value: null });
  }, info.seconds * 1000);
  cardTimer.unref?.();
}

function onRaid(event) {
  const cfg = getExtras().shoutout;
  if (!cfg.onRaid) return;
  const viewers = Number(event.data?.viewers ?? event.data?.amount ?? 0);
  if (viewers < cfg.minViewers) return;
  shoutout(event.data?.login || event.user, { viewers, auto: true })
    .catch((err) => log.warn(`raid shoutout failed: ${err.message}`));
}

// ------------------------------------------------------------- clips and markers

/**
 * Clip the last half minute of the stream. From the dock, the link goes to
 * chat as the settings say; from an action, it is {clip.url} for the steps
 * after it to do with as they like.
 */
export async function clip({ post = false } = {}) {
  let made;
  try {
    made = await api.createClip();
  } catch (err) {
    return /not live|offline|404/i.test(err.message) ? { ok: false, code: 'not_live', error: 'the stream is not live' } : { ok: false, ...(err.code ? { code: err.code } : {}), error: err.message };
  }
  if (!made) return { ok: false, code: 'no_clip', error: 'Twitch made no clip' };
  const cfg = getExtras().clip;
  if (post && cfg.chat && cfg.message) {
    try {
      await api.say(fill(cfg.message, { url: made.url }));
    } catch (err) {
      log.warn(`could not post the clip: ${err.message}`);
    }
  }
  log.info(`clip made: ${made.url}`);
  // Kept with the stream, for its chapters and highlights.
  bus.emit('stream:moment', { kind: 'clip', url: made.url });
  return { ok: true, ...made };
}

/** A marker in the stream at this moment, to find it in the VOD later. */
export async function marker(description = '') {
  try {
    const made = await api.createMarker(description);
    log.info(`stream marker at ${made?.at ?? '?'}s${made?.description ? `: ${made.description}` : ''}`);
    bus.emit('stream:moment', { kind: 'marker', text: made?.description || description || '' });
    return { ok: true, ...made };
  } catch (err) {
    return /not live|offline|404/i.test(err.message) ? { ok: false, code: 'not_live', error: 'the stream is not live' } : { ok: false, ...(err.code ? { code: err.code } : {}), error: err.message };
  }
}

// ------------------------------------------------------------- the schedule

/** The next stream on the schedule — not one about to start, which is the one you are going live for. */
export function nextStream(now = Date.now(), segments = schedule.segments) {
  return (segments || []).find((s) => Date.parse(s.start) > now + NEXT_AFTER_MS) || null;
}

function publishSchedule() {
  bus.emit(EVENTS.CONFIG, { key: 'twitchSchedule', value: { ...schedule, next: nextStream() } });
}

/** Ask Twitch again for the schedule, and which permissions the login has. */
export async function refreshSchedule() {
  try {
    schedule = { segments: await api.fetchSchedule(), fetchedAt: Date.now(), error: null };
  } catch (err) {
    schedule = { ...schedule, error: /not authenticated|no client id/i.test(err.message) ? 'Twitch is not connected' : err.message };
  }
  publishSchedule();
  try {
    const have = await api.tokenScopes();
    scopes = have ? { have, missing: [...new Set(Object.values(EXTRA_SCOPES))].filter((s) => !have.includes(s)) } : null;
  } catch {
    scopes = null;
  }
  bus.emit(EVENTS.CONFIG, { key: 'twitchScopes', value: scopes });
  return { ...schedule, next: nextStream(), scopes };
}

// ------------------------------------------------------------- wiring

export const snapshot = () => ({
  twitchExtras: getExtras(),
  hypeTrain: hype,
  shoutoutCard: card,
  twitchSchedule: { ...schedule, next: nextStream() },
  twitchScopes: scopes,
});

/** The dashboard's requests: settings, a shoutout, a clip, a marker, the schedule, a test train. */
export async function control(payload = {}) {
  switch (payload.op) {
    case 'settings': return setExtras(payload.settings);
    case 'shoutout': return shoutout(payload.target);
    case 'clip': return clip({ post: true });
    case 'marker': return marker(payload.description);
    case 'schedule': return refreshSchedule();
    case 'test_hype': return testHypeTrain();
    default: return { ok: false, error: `unknown op ${payload.op}` };
  }
}

export function initTwitchExtras() {
  store = collection('twitch_extras', DEFAULT_TWITCH_EXTRAS);
  bus.on('twitch:hypetrain', (u) => onHypeTrain(u));
  bus.on(EVENTS.EVENT, (e) => { if (e?.type === 'twitch_raid') onRaid(e); });
  // The schedule, again whenever Twitch connects, and every quarter of an hour.
  bus.on(EVENTS.STATUS, (s) => { if (s?.platform === 'twitch' && s.status === 'connected') refreshSchedule(); });
  clearInterval(scheduleTimer);
  scheduleTimer = setInterval(() => refreshSchedule(), SCHEDULE_EVERY_MS);
  scheduleTimer.unref?.();
  setTimeout(() => refreshSchedule(), 5000).unref?.();
}

/** Tests only: forget the train, the card and who was shouted out. */
export function resetForTests() {
  hype = null;
  card = null;
  clearTimeout(cardTimer);
  testTimers.forEach(clearTimeout);
  shoutedAt.clear();
  schedule = { segments: [], fetchedAt: null, error: null };
}
