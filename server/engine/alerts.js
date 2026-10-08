/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Alert matching and dispatch.
 *
 * The server decides *which* alerts fire and in what order; the browser
 * overlay is a dumb renderer that plays what it is told. That split is what
 * lets you close the config UI without losing alerts, and lets two overlays
 * (say, a preview and the real OBS source) stay in sync.
 */

import { bus, EVENTS } from '../core/bus.js';
import { interpolate, buildContext } from './variables.js';
import { cleanCss, MAX_ALERT_CSS } from '../../shared/clean-css.js';
import { createLogger } from '../core/logger.js';
import { readSettings, lookColour, SETTINGS_VERSION } from './layouts.js';
import { currentLook } from '../../shared/looks-history.js';
import { sampleEvent } from '../../shared/alert-samples.js';

const log = createLogger('alerts');

/**
 * The events an alert may be bound to.
 *
 * Mirrors the AlertType union in web/types.ts; the smoke suite asserts the two
 * agree, because an alert saved for a type the client cannot offer is one
 * nobody can ever edit again.
 */
/*
  A kind on its own, meaning the same thing wherever it happens.

  Alert types name a platform and a thing: twitch_follow, tiktok_gift. That is
  right when you want a different alert for each, and tiresome the moment you
  stream to two places — the same alert built twice, and again if you add a
  third, with three copies to keep in step.

  So an alert may be a kind instead. "follow" answers to a Twitch follow, a
  YouTube subscribe and a TikTok follow, and the caption can name whichever it
  was. The platform-specific types still work and still win where both exist,
  because sometimes you really do want YouTube to get its own.
*/
export const ALERT_KINDS = ['follow', 'sub', 'sub_gift_bulk', 'cheer', 'raid', 'gift', 'share'];

/** The thing an event is, with the platform taken off the front. */
export const kindOf = (eventType) => {
  const at = String(eventType || '').indexOf('_');
  return at < 0 ? '' : String(eventType).slice(at + 1);
};

export const ALERT_TYPES = [
  ...ALERT_KINDS,
  'twitch_follow', 'twitch_sub', 'twitch_sub_gift_bulk', 'twitch_cheer', 'twitch_raid', 'twitch_redemption',
  /*
    YouTube's own. Its subscribe is this app's follow and its membership is
    this app's sub — see shared/platforms.js, which is also where the words
    for each come from.
  */
  /*
    No youtube_follow. YouTube's live chat API raises no event for somebody
    subscribing for free, and never says whether an author is one — only
    whether they are a member. Subscriber counts are rounded above a thousand,
    so watching the number cannot stand in for it.

    Offering the alert anyway would be a line in a menu that can never fire.
  */
  'youtube_sub', 'youtube_sub_gift_bulk', 'youtube_cheer',
  'tiktok_follow', 'tiktok_sub', 'tiktok_gift', 'tiktok_share',
  'obs_stream_started', 'obs_stream_stopped', 'obs_recording_started', 'obs_recording_stopped',
  'obs_scene_changed',
  'discord_message',
  // Somebody joining the Discord server, or boosting it (engine/welcome.js).
  'discord_join', 'discord_boost',
  'spotify_track_change', 'spotify_played', 'spotify_paused',
  // Somebody reaching a new level, on any platform (leveling/index.js).
  'level_up',
  // A giveaway's winner, once the overlay's reel has stopped (giveaway.js).
  'giveaway_winner',
  // Somebody spending points in the shop (points.js).
  'points_redeem',
];

/**
 * The numbers a variation can test.
 *
 * Only fields that are genuinely numeric across every platform that emits
 * them. A condition on free text would be a filter nobody could reason about,
 * and the interesting question is always "how big was it".
 */
/*
  An alert for a kind ("cheer", "sub") answers on every platform, so it is
  offered every field any of them carries. A condition on a field an event
  does not carry never holds — "bits at least 1000" is a Twitch cheer only —
  which is what makes that safe: a big-tip variation for two platforms is two
  variations, each in its own platform's numbers.
*/
export const CONDITION_FIELDS = [
  { field: 'bits', label: 'Bits', types: ['twitch_cheer', 'cheer'] },
  // A Super Chat's money, as a number: YouTube's own amount is text like "$5.00".
  { field: 'value', label: 'Money', types: ['youtube_cheer', 'cheer'] },
  { field: 'tier', label: 'Tier', types: ['twitch_sub', 'sub'] },
  { field: 'months', label: 'Months subbed', types: ['twitch_sub', 'youtube_sub', 'sub'] },
  { field: 'viewers', label: 'Viewers', types: ['twitch_raid', 'raid'] },
  { field: 'cost', label: 'Point cost', types: ['twitch_redemption', 'points_redeem'] },
  { field: 'count', label: 'Gift count', types: ['tiktok_gift', 'twitch_sub_gift_bulk', 'youtube_sub_gift_bulk', 'sub_gift_bulk', 'gift'] },
  { field: 'diamonds', label: 'Diamonds', types: ['tiktok_gift', 'gift'] },
  { field: 'amount', label: 'Amount', types: ['twitch_cheer', 'twitch_raid'] },
  { field: 'level', label: 'Level', types: ['level_up'] },
];

const CONDITION_FIELD_NAMES = CONDITION_FIELDS.map((f) => f.field);
/** Enough for a few tiers of the same event without becoming a rules engine. */
const MAX_VARIATIONS = 8;

const CONDITION_OPS = ['gte', 'lte', 'eq'];

/** Which of an alert's fields a variation is allowed to override. */
const VARIATION_FIELDS = [
  'imageUrl', 'soundUrl', 'soundVolume', 'layout', 'messageTemplate', 'highlightText',
  'fontFamily', 'fontSize', 'textColor', 'accentColor', 'duration', 'animationIn', 'animationOut',
];

const LAYOUTS = ['image-above', 'image-left', 'image-right', 'image-cover'];
const ANIMATIONS_IN = ['animate-pop-in', 'animate-fade-in', 'animate-zoom-in', 'animate-slide-up', 'animate-slide-down'];
const ANIMATIONS_OUT = ['animate-fade-out', 'animate-pop-out', 'animate-slide-out-up'];

const bounded = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};
const between = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const colour = (v, fallback) => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v || '') ? v : fallback);
const text = (v, max, fallback = '') => {
  const s = typeof v === 'string' ? v : '';
  return s ? s.slice(0, max) : fallback;
};

/** An alert's font, or automatic; before the mark, the old Montserrat default was automatic too. */
const lookFont = (incoming) => {
  const f = text(incoming?.fontFamily, 80).trim();
  return !readSettings(incoming) && (f === '' || f === 'Montserrat') ? '' : f;
};

/**
 * Validate and fill in one alert.
 *
 * Alerts were the one configuration here that was stored exactly as received,
 * which is how three different conventions for the animation field — `fadeIn`,
 * `fadeOut`, `animate-pop-in` — all ended up on disk, none of them naming a
 * style that existed. Anything unrecognised now becomes a working default
 * rather than a silent no-op on stream.
 */
export function normaliseAlert(incoming) {
  const id = String(incoming?.id || '').trim() || Math.random().toString(36).slice(2, 11);
  const type = ALERT_TYPES.includes(incoming?.type) ? incoming.type : 'twitch_follow';
  return {
    id,
    name: text(incoming?.name, 80, `New ${type} alert`),
    type,
    enabled: incoming?.enabled !== false,
    imageUrl: text(incoming?.imageUrl, 2000),
    soundUrl: text(incoming?.soundUrl, 2000),
    soundVolume: Number.isFinite(Number(incoming?.soundVolume))
      ? Math.min(1, Math.max(0, Number(incoming.soundVolume)))
      : 1,
    layout: LAYOUTS.includes(incoming?.layout) ? incoming.layout : 'image-above',
    messageTemplate: text(incoming?.messageTemplate, 300, '{user}'),
    highlightText: incoming?.highlightText !== false,
    /*
      The font and the two colours are automatic when empty: the look on the
      alert decides, and without one the alert's own — Montserrat, white
      words, a pink name. Chosen, each beats the look (the looks read
      --alert-font, --alert-text and --alert-name first). Alerts stored
      before this held those defaults in full; read once as automatic.
    */
    fontFamily: lookFont(incoming),
    fontSize: bounded(incoming?.fontSize, 8, 200, 32),
    textColor: lookColour(incoming, 'textColor', '#ffffff'),
    accentColor: lookColour(incoming, 'accentColor', '#f43f5e'),
    settingsVersion: SETTINGS_VERSION,
    // Under half a second is not long enough to read; over a minute is a
    // stuck overlay rather than an alert.
    duration: bounded(incoming?.duration, 500, 60000, 5000),
    animationIn: ANIMATIONS_IN.includes(incoming?.animationIn) ? incoming.animationIn : 'animate-pop-in',
    animationOut: ANIMATIONS_OUT.includes(incoming?.animationOut) ? incoming.animationOut : 'animate-fade-out',
    redemptionRewardId: text(incoming?.redemptionRewardId, 100),
    // Read aloud as it shows: see normaliseTts.
    tts: normaliseTts(incoming?.tts),

    /*
      This alert's own stylesheet, and its own motion.

      Per alert rather than on the alerts layer, which is the whole point:
      a layout holds one alerts layer and every alert on the channel plays
      through it, so a stylesheet written there would be one rule for a
      follow, a raid, a donation and a redeem alike. Held here, a look
      belongs to the alert it was written for and travels with it.

      Two boxes for the same reason layers have two: what a thing looks
      like and how it arrives are different decisions, and replacing one
      should not cost the other. The motion is written last, so where both
      speak about the same property the motion has the last word.
    */
    // An exact copy of a look from before a change to it is brought up to
    // date (see shared/looks-history.js); anything else is kept as written.
    css: currentLook(cleanCss(incoming?.css, MAX_ALERT_CSS)),
    motionCss: currentLook(cleanCss(incoming?.motionCss, MAX_ALERT_CSS)),
    // Different looks for different sizes of the same event. Order is the
    // rule: the first whose conditions hold is the one that plays.
    variations: (Array.isArray(incoming?.variations) ? incoming.variations : [])
      .slice(0, MAX_VARIATIONS)
      .map(normaliseVariation),
  };
}

/**
 * What an alert says out loud, if anything: off unless turned on.
 *
 * The text is a template like the caption's: {alert} is the caption as it
 * shows, {message} what the viewer wrote with it (bits, a sub's message, a
 * Super Chat, a channel-point reward's text), and every other variable too.
 * Read in a voice of the computer that speaks — see ws.js for which that is
 * — a little after the alert appears, so it does not talk over its sound.
 */
export const DEFAULT_ALERT_TTS_TEXT = '{alert} {message}';

function normaliseTts(t) {
  return {
    enabled: t?.enabled === true,
    text: text(t?.text, 300, DEFAULT_ALERT_TTS_TEXT),
    voice: text(t?.voice, 200),
    rate: between(t?.rate, 0.5, 2, 1),
    pitch: between(t?.pitch, 0, 2, 1),
    volume: between(t?.volume, 0, 1, 1),
    delayMs: bounded(t?.delayMs, 0, 10000, 1000),
  };
}

/**
 * About how long reading `said` takes, in ms, from the alert appearing:
 * the wait, then some thirteen characters a second at normal speed, and a
 * breath after. Only an estimate — a voice is as fast as it is — but enough
 * to keep an alert up while it is read, so the next one does not talk over it.
 */
export function readingMs(said, rate = 1, delayMs = 0) {
  return Math.min(60000, Math.round(delayMs + (String(said).length / 13 / (rate || 1)) * 1000 + 600));
}

/**
 * One variation: a set of conditions and the look to use when they hold.
 *
 * Only fields that are actually set override the base alert, so a variation
 * that changes nothing but the sound inherits every other choice. That is why
 * the undefined ones are dropped rather than filled with defaults — filling
 * them would silently pin a variation to whatever the base looked like on the
 * day it was made.
 */
function normaliseVariation(incoming) {
  const conditions = (Array.isArray(incoming?.conditions) ? incoming.conditions : [])
    .filter((c) => CONDITION_FIELD_NAMES.includes(c?.field) && CONDITION_OPS.includes(c?.op) && Number.isFinite(Number(c?.value)))
    .map((c) => ({ field: c.field, op: c.op, value: Number(c.value) }))
    .slice(0, 4);

  const out = {
    id: String(incoming?.id || '').trim() || Math.random().toString(36).slice(2, 11),
    name: text(incoming?.name, 60, 'Variation'),
    conditions,
  };

  // Run each override through the same validation the base alert gets, then
  // keep only the ones the caller actually supplied. `variations: []` is not
  // decoration: without it a variation carrying its own variations array would
  // recurse back into here, and a hand-edited file could hang the server.
  //
  // Read as current settings: a variation's font or colour is always one somebody chose, so white
  // text or Montserrat stays what it says rather than becoming "automatic", as on an old alert.
  const validated = normaliseAlert({ ...incoming, id: out.id, type: 'twitch_follow', variations: [], settingsVersion: SETTINGS_VERSION });
  for (const field of VARIATION_FIELDS) {
    if (incoming?.[field] !== undefined && incoming[field] !== '') out[field] = validated[field];
  }
  return out;
}

/** Is this one condition true of this event? */
function conditionHolds(condition, event) {
  const raw = event?.data?.[condition.field];
  const actual = Number(raw);
  // A condition on a field this event does not carry cannot hold. Treating a
  // missing value as 0 would make "at least 1 bit" match a follow.
  if (raw === undefined || raw === null || !Number.isFinite(actual)) return false;
  if (condition.op === 'gte') return actual >= condition.value;
  if (condition.op === 'lte') return actual <= condition.value;
  return actual === condition.value;
}

/**
 * The look to use for this event: the first variation whose conditions all
 * hold, merged over the alert, or the alert itself.
 *
 * First match wins, in the order the editor shows them, rather than a "most
 * specific" rule. Specificity sounds cleverer and is impossible to predict
 * from looking at the list — with ordering, what you see is what happens, and
 * moving a row is how you change it.
 *
 * A variation with no conditions always holds, which makes it a deliberate
 * catch-all when placed last.
 */
export function pickVariation(config, event) {
  const variations = Array.isArray(config?.variations) ? config.variations : [];
  const hit = variations.find((v) => (v.conditions || []).every((c) => conditionHolds(c, event)));
  return hit ? withVariation(config, hit) : config;
}

/** The alert with this variation's fields over it — the ones it sets, and no others. */
function withVariation(config, hit) {
  const merged = { ...config };
  for (const field of VARIATION_FIELDS) {
    if (hit[field] !== undefined) merged[field] = hit[field];
  }
  // Useful downstream and in the editor: which variation actually won.
  merged.variationId = hit.id;
  merged.variationName = hit.name;
  return merged;
}

/** Does this alert config apply to this event? */
function matches(alertConfig, event) {
  if (!alertConfig.enabled) return false;
  /* Either the exact thing on the exact platform, or the kind anywhere. */
  const named = alertConfig.type === event.type;
  const anywhere = ALERT_KINDS.includes(alertConfig.type) && alertConfig.type === kindOf(event.type);
  if (!named && !anywhere) return false;

  // Channel-point redemptions are per-reward.
  if (event.type === 'twitch_redemption'
    && alertConfig.redemptionRewardId
    && alertConfig.redemptionRewardId !== event.data?.rewardId) {
    return false;
  }

  return true;
}

/**
 * Fire every alert matching `event`.
 *
 * `opts.manual` marks one somebody asked to see now — a test, a replay — which
 * engine/alert-gate.js never holds. `opts.variationId` plays that variation
 * whatever the numbers say, for "Fire this variation" on the Alerts screen.
 * @returns {number} how many alerts were dispatched
 */
export function dispatch(alertConfigs, event, nowPlaying = null, upNext = null, opts = {}) {
  /*
    A bundle of gifted subs arrives as one announcement followed by one event
    per recipient. Firing an alert for every recipient buries the stream, so
    the individual ones are skipped — but only when there is an enabled bundle
    alert to show instead. Without that check, somebody who never made a
    bundle alert would go from fifty alerts to none.
  */
  if (event?.data?.fromBulk) {
    const platform = String(event.type || '').split('_')[0];
    const hasBundleAlert = alertConfigs.some((c) => c.enabled
      && (c.type === 'sub_gift_bulk' || c.type === `${platform}_sub_gift_bulk`));
    if (hasBundleAlert) return 0;
  }

  const hits = alertConfigs.filter((c) => matches(c, event));
  if (hits.length === 0) return 0;

  const ctx = buildContext({
    user: { name: event.user, avatar: event.avatar, platform: event.platform },
    // What the viewer wrote with it, if they wrote anything: {message}.
    message: event.data?.message ?? event.data?.input ?? '',
    event,
    platform: event.platform,
    // An alert caption may say what is playing, same as a chat step can.
    nowPlaying,
    upNext,
  });

  for (const base of hits) {
    // Resolved here rather than in the overlay: the text is already
    // pre-rendered server-side, and every connected surface must agree on
    // which variation played.
    const chosen = opts.variationId && (base.variations || []).find((v) => v.id === opts.variationId);
    const config = chosen ? withVariation(base, chosen) : pickVariation(base, event);
    // Pre-rendered so every connected overlay shows identical text.
    const shown = interpolate(config.messageTemplate, ctx);
    const alert = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      config,
      user: event.user,
      data: event.data,
      text: shown,
      avatar: event.avatar,
    };
    if (opts.manual) alert.manual = true;
    /*
      Read aloud: what to say, for the one surface that speaks (ws.js hands
      it to that one only), and the alert kept up for as long as reading it
      takes, on every surface alike, so the next one waits its turn.
    */
    const tts = config.tts;
    const said = tts?.enabled ? interpolate(tts.text, { ...ctx, alert: shown }).replace(/\s+/g, ' ').trim() : '';
    if (said) {
      alert.speak = { text: said, voiceURI: tts.voice || undefined, rate: tts.rate, pitch: tts.pitch, volume: tts.volume, delayMs: tts.delayMs };
      alert.config = { ...config, duration: Math.max(config.duration, readingMs(said, tts.rate, tts.delayMs)) };
    }
    bus.emit(EVENTS.ALERT, alert);
  }

  log.debug(`dispatched ${hits.length} alert(s) for ${event.type}`);
  return hits.length;
}

/**
 * Build a synthetic event so the UI's "Test" button exercises the real path.
 *
 * Its fields come from shared/alert-samples.js, which the editor's preview
 * reads too. An alert for a kind ("follow") is tested as that kind on a real
 * platform, so {platform} and {words.*} say what they would on stream.
 */
export function buildTestEvent(alertConfig, variationId = null) {
  const event = sampleEvent(alertConfig.type);
  if (event.type === 'twitch_redemption') event.data.rewardId = alertConfig.redemptionRewardId;
  /*
    Testing a variation: the numbers its conditions ask for, so the caption
    says 10000 bits for "bits at least 10000". Each field takes its lowest
    allowed value, or its highest where only a ceiling is set.
  */
  const variation = variationId && (alertConfig.variations || []).find((v) => v.id === variationId);
  const set = new Set();
  for (const c of variation?.conditions || []) {
    const on = (variation.conditions || []).filter((x) => x.field === c.field);
    const floor = Math.max(...on.filter((x) => x.op !== 'lte').map((x) => x.value));
    const ceiling = Math.min(...on.filter((x) => x.op === 'lte').map((x) => x.value));
    event.data[c.field] = Number.isFinite(floor) ? floor : ceiling;
    set.add(c.field);
  }
  // A real cheer's amount is its bits (a raid's its viewers, a gift's its diamonds): the pair stays one number.
  const twin = AMOUNT_TWIN[event.type];
  if (twin && set.has(twin) && !set.has('amount')) event.data.amount = event.data[twin];
  if (twin && set.has('amount') && !set.has(twin)) event.data[twin] = event.data.amount;
  return { id: 'test', ...event, timestamp: Date.now() };
}

/** The field each event's `amount` repeats, as the platforms send them. */
const AMOUNT_TWIN = { twitch_cheer: 'bits', twitch_raid: 'viewers', tiktok_gift: 'diamonds' };
