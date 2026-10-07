/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Twitch schedule, as Discord events: each of the next few streams on it
 * an event in the server, with the Twitch link as where it happens.
 *
 * What it is for is Discord's own reminder: somebody who presses
 * "Interested" is told by Discord when the event starts. So when OBS starts
 * streaming, the event for this stream is started, and when it stops, ended
 * — the reminder goes at the moment the stream does.
 *
 * Followed every time the schedule is read (every quarter of an hour, and on
 * a change from the Twitch screen): a stream moved or retitled on Twitch moves
 * or renames its event; one cancelled there is taken off. An event somebody
 * deletes by hand in Discord stays deleted. Off until it is turned on, since
 * events are seen by the whole server.
 *
 * Each event has a cover across its top: the channel's Twitch offline image
 * (already wide), a picture of your own, or none. It is sent when an event is
 * made and when the cover changes, not again with every look at the schedule.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import { pictureData } from './welcome-card.js';

const log = createLogger('schedule-events');

export const DEFAULT_SCHEDULE_EVENTS = {
  enabled: false,
  /** How many of the next streams are events, 1 to 5. */
  count: 3,
  /** What the event says under its name. {title}, {game}, {link}. */
  description: '{game}\n¡Te espero en {link}!',
  /** The picture across the top: none, the Twitch offline image, or a picture (an upload or a link). */
  cover: 'twitch',
  coverPicture: '',
  /** Schedule id → { eventId, start, sent } for each event made; ids deleted by hand in Discord. */
  made: {},
  gone: [],
  lastSync: null,
};

/** A stream with no end on the schedule is given this long, since Discord wants one. */
export const DEFAULT_LENGTH_MS = 3 * 3_600_000;
/** Discord takes no event that starts in the past; one this close is left until next time. */
const SOON_MS = 5 * 60_000;
/** A stream going live this close to an event's time is that event. */
const SAME_STREAM_MS = 2 * 3_600_000;
const EXTERNAL = 3;
const GUILD_ONLY = 2;
const ACTIVE = 2;
const COMPLETED = 3;

let store = null;
let schedule = [];
let syncing = null;

export const getScheduleEvents = () => ({ ...DEFAULT_SCHEDULE_EVENTS, ...(store?.get() || {}) });

function publish() {
  const { made: _m, gone: _g, ...shown } = getScheduleEvents();
  bus.emit(EVENTS.CONFIG, { key: 'scheduleEvents', value: { ...shown, events: Object.keys(getScheduleEvents().made).length } });
}

/** The settings as kept: a count of 1 to 5 and words of a sane length. What was made is the module's own. */
export function cleanScheduleEvents(incoming, before = DEFAULT_SCHEDULE_EVENTS) {
  const c = { ...before, ...(incoming && typeof incoming === 'object' ? incoming : {}) };
  const n = Number(c.count);
  return {
    enabled: c.enabled === true,
    count: Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : DEFAULT_SCHEDULE_EVENTS.count,
    description: String(c.description ?? '').slice(0, 900),
    cover: ['none', 'twitch', 'picture'].includes(c.cover) ? c.cover : DEFAULT_SCHEDULE_EVENTS.cover,
    coverPicture: /^\/media\/[\w.-]+$/.test(String(c.coverPicture ?? '')) || /^https?:\/\/\S+$/.test(String(c.coverPicture ?? '')) ? String(c.coverPicture).slice(0, 500) : '',
    made: before.made || {},
    gone: before.gone || [],
    lastSync: before.lastSync ?? null,
  };
}

const twitchLink = () => {
  const login = twitch.getCredentials?.()?.login || twitch.getCredentials?.()?.channel || '';
  return login ? `https://twitch.tv/${login}` : '';
};

/** What Discord is sent for one stream on the schedule. */
export function eventFor(segment, cfg, link = twitchLink()) {
  const start = Date.parse(segment.start);
  const end = segment.end ? Date.parse(segment.end) : start + DEFAULT_LENGTH_MS;
  const vars = { title: segment.title || '', game: segment.category || '', link };
  // A line whose every blank is empty goes whole — "¡Te espero en {link}!" with no link says nothing.
  const fill = (text) => String(text ?? '').split('\n')
    .filter((line) => {
      const named = [...line.matchAll(/\{(title|game|link)\}/g)].map((m) => m[1]);
      return !named.length || named.some((k) => vars[k]);
    })
    .map((line) => line.replace(/\{(title|game|link)\}/g, (_, k) => vars[k]).trim())
    .filter(Boolean)
    .join('\n');
  return {
    name: (segment.title || segment.category || 'Directo').slice(0, 100),
    description: fill(cfg.description).slice(0, 1000),
    scheduled_start_time: new Date(start).toISOString(),
    scheduled_end_time: new Date(Math.max(end, start + 15 * 60_000)).toISOString(),
    entity_type: EXTERNAL,
    privacy_level: GUILD_ONLY,
    entity_metadata: { location: (link || 'Twitch').slice(0, 100) },
  };
}

/** Where the cover comes from, as set: a link or an upload, or nothing. */
export function coverSource(cfg) {
  if (cfg.cover === 'twitch') return twitch.getCredentials?.()?.user?.offline_image_url || '';
  if (cfg.cover === 'picture') return cfg.coverPicture || '';
  return '';
}

/** The cover as Discord takes it — PNG, JPEG, GIF or WebP as data — or null. */
async function coverData(src) {
  if (!src) return null;
  const data = await pictureData(src);
  return data && /^data:image\/(png|jpe?g|gif|webp);/.test(data) ? data : null;
}

/** A schedule entry's key: its Twitch id, or its start for one without. */
const keyOf = (s) => s.id || `at:${s.start}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Make Discord's events match the next streams on the schedule. Returns
 * what changed. Nothing happens while it is off, or without a server.
 */
export async function syncScheduleEvents({ segments = schedule, now = Date.now() } = {}) {
  const cfg = getScheduleEvents();
  const guildId = discord.getSettings().guildId;
  if (!cfg.enabled || !guildId) return { ok: false, skipped: true };
  if (syncing) return syncing;
  syncing = (async () => {
    const made = { ...cfg.made };
    const gone = new Set(cfg.gone);
    const did = { created: 0, updated: 0, removed: 0 };
    const wanted = (segments || [])
      .filter((s) => Date.parse(s.start) > now + SOON_MS)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, cfg.count);
    const wantedKeys = new Set(wanted.map(keyOf));
    const coverFrom = coverSource(cfg);
    const cover = wanted.length ? await coverData(coverFrom) : null;
    // What the events should carry: the source, when it could be read.
    const coverKey = cover ? coverFrom : '';

    for (const s of wanted) {
      const key = keyOf(s);
      if (gone.has(key)) continue;
      const body = eventFor(s, cfg);
      const had = made[key];
      try {
        if (!had) {
          const ev = await discord.request('POST', `/guilds/${guildId}/scheduled-events`, { body: cover ? { ...body, image: cover } : body });
          made[key] = { eventId: ev.id, start: s.start, sent: body, cover: coverKey };
          did.created += 1;
        } else if (!same(had.sent, body) || (had.cover || '') !== coverKey) {
          // The picture goes only when it changed: taken off with null, or the new one.
          const newCover = (had.cover || '') !== coverKey;
          await discord.request('PATCH', `/guilds/${guildId}/scheduled-events/${had.eventId}`, { body: newCover ? { ...body, image: cover } : body });
          made[key] = { ...had, start: s.start, sent: body, cover: coverKey };
          did.updated += 1;
        }
      } catch (err) {
        // Deleted by hand in Discord: it stays deleted.
        if (err.status === 404 && had) { delete made[key]; gone.add(key); continue; }
        log.warn(`could not ${had ? 'update' : 'make'} the event for ${s.start}: ${err.message}`);
      }
    }

    /*
      Cancelled, or moved past the ones shown: taken off while still to come.
      One whose time is about now is kept — the stream it is for may go live
      a little late, and going live is what starts it — and so is one going.
    */
    for (const [key, m] of Object.entries(made)) {
      if (wantedKeys.has(key) || m.active) continue;
      const start = Date.parse(m.start);
      if (start <= now && now - start < SAME_STREAM_MS) continue;
      if (start > now) {
        try {
          await discord.request('DELETE', `/guilds/${guildId}/scheduled-events/${m.eventId}`);
          did.removed += 1;
        } catch (err) {
          if (err.status !== 404) { log.warn(`could not take the event off: ${err.message}`); continue; }
        }
      }
      delete made[key];
    }

    store.set({ ...getScheduleEvents(), made, gone: [...gone].slice(-50), lastSync: { at: now, ...did } });
    publish();
    if (did.created || did.updated || did.removed) log.info(`Discord events: ${did.created} made, ${did.updated} changed, ${did.removed} taken off`);
    return { ok: true, ...did };
  })();
  try {
    return await syncing;
  } finally {
    syncing = null;
  }
}

/**
 * The stream starting or stopping: the event for it is started — which is
 * when Discord tells everybody interested — or ended.
 */
export async function onStream(type, now = Date.now()) {
  const cfg = getScheduleEvents();
  const guildId = discord.getSettings().guildId;
  if (!cfg.enabled || !guildId) return null;
  const entries = Object.entries(cfg.made);
  const match = entries
    .map(([key, m]) => ({ key, m, off: Math.abs(Date.parse(m.start) - now) }))
    .filter((x) => (type === 'started' ? x.off < SAME_STREAM_MS && !x.m.active : x.m.active))
    .sort((a, b) => a.off - b.off)[0];
  if (!match) return null;
  try {
    await discord.request('PATCH', `/guilds/${guildId}/scheduled-events/${match.m.eventId}`, { body: { status: type === 'started' ? ACTIVE : COMPLETED } });
  } catch (err) {
    log.warn(`could not ${type === 'started' ? 'start' : 'end'} the Discord event: ${err.message}`);
    return null;
  }
  const made = { ...getScheduleEvents().made };
  if (type === 'started') made[match.key] = { ...match.m, active: true };
  else delete made[match.key];
  store.set({ ...getScheduleEvents(), made });
  publish();
  log.info(`Discord event ${type === 'started' ? 'started' : 'ended'} with the stream`);
  return match.m.eventId;
}

export function setScheduleEvents(patch) {
  const before = getScheduleEvents();
  const next = cleanScheduleEvents(patch, before);
  store.set(next);
  publish();
  // Turned on, or told how many: follow the schedule now rather than in a quarter of an hour.
  if (next.enabled && (!before.enabled || next.count !== before.count || next.description !== before.description || next.cover !== before.cover || next.coverPicture !== before.coverPicture)) {
    syncScheduleEvents().catch((err) => log.warn(`could not follow the schedule: ${err.message}`));
  }
  return next;
}

/** From the Go live screen: the settings, or follow the schedule now. */
export async function control(payload = {}) {
  if (payload.op === 'sync') {
    if (!getScheduleEvents().enabled) throw refusal('schedule_events_off', 'turn Discord events on first');
    return syncScheduleEvents();
  }
  setScheduleEvents(payload.settings);
  return snapshot().scheduleEvents;
}

export function initScheduleEvents() {
  store = collection('discord_events', DEFAULT_SCHEDULE_EVENTS);
  // The schedule as the Twitch extras read it (twitch-extras.js publishes it each time).
  bus.on(EVENTS.CONFIG, (c) => {
    if (c?.key !== 'twitchSchedule' || !Array.isArray(c.value?.segments)) return;
    schedule = c.value.segments;
    syncScheduleEvents().catch((err) => log.warn(`could not follow the schedule: ${err.message}`));
  });
  bus.on(EVENTS.EVENT, (e) => {
    if (e?.type === 'obs_stream_started') onStream('started').catch(() => {});
    if (e?.type === 'obs_stream_stopped') onStream('stopped').catch(() => {});
  });
}

export const snapshot = () => {
  const { made, gone: _g, ...shown } = getScheduleEvents();
  return { scheduleEvents: { ...shown, events: Object.keys(made || {}).length } };
};
