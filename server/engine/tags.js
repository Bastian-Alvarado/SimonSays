/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Stream tags — "latest follower", "top donation", and friends.
 *
 * Because these now live server-side they survive browser restarts, and they
 * are additionally mirrored to plain `.txt` files under `data/tags/` so an OBS
 * "Text (GDI+) -> Read from file" source can display them with no browser
 * source at all.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('tags');

const EMPTY = {
  latestFollower: null,
  latestSubscriber: null,
  latestDonation: null,
  topDonation: null,
  latestRaid: null,
};

let tags = null;
let outputs = null;
/** OBS service, injected by the engine so this module stays platform-agnostic. */
let obsService = null;

const tagsDir = () => path.join(config.dataDir, 'tags');

export function initTags(obs = null) {
  obsService = obs;
  tags = collection('tags', EMPTY);
  outputs = collection('tag_outputs', {});
  if (!fs.existsSync(tagsDir())) fs.mkdirSync(tagsDir(), { recursive: true });
  writeFiles();

  // Back-fill from platform APIs. Kept off the event path on purpose: these
  // describe things that already happened, so they must not trigger alerts.
  bus.on(EVENTS.STAT, ({ key, value }) => setStat(key, value));

  bus.on(EVENTS.TAG_SEED, ({ key, entry }) => {
    if (!key || !entry || !(key in tags.get())) return;
    seedTag(key, entry);
  });
}

/**
 * Set a tag directly, without alert or action side effects.
 * Existing values are not overwritten by older data.
 */
export function seedTag(key, entry) {
  const current = tags.get()[key];
  if (current && (current.timestamp ?? 0) >= (entry.timestamp ?? 0)) return false;

  tags.set({ ...tags.get(), [key]: entry });
  writeFiles();
  bus.emit(EVENTS.TAGS, tags.get());
  log.debug(`seeded ${key} = ${entry.user}`);
  return true;
}

export const getTags = () => tags.get();
export const getOutputs = () => outputs.get();

export function setOutputs(next) {
  outputs.set(next || {});
  writeFiles();
  bus.emit(EVENTS.TAGS, tags.get());
}

/** Amount in a comparable unit, used to decide whether a donation is a new top. */
function amountOf(entry) {
  return Number(entry?.amount ?? 0);
}

/**
 * Fold a stream event into the tag state.
 * Returns true if anything changed.
 */
export function applyEvent(event) {
  const entry = {
    user: event.user,
    platform: event.platform,
    amount: event.data?.amount ?? event.data?.bits ?? event.data?.diamonds ?? undefined,
    currency: event.data?.currency
      ?? (event.type === 'twitch_cheer' ? 'BITS'
        : event.type === 'tiktok_gift' ? 'DIAMONDS'
          : event.type === 'twitch_raid' ? 'VIEWERS' : undefined),
    timestamp: event.timestamp,
    avatar: event.avatar,
  };

  let changed = false;
  const next = { ...tags.get() };

  switch (event.type) {
    case 'twitch_follow':
    case 'tiktok_follow':
      next.latestFollower = entry;
      changed = true;
      break;

    case 'twitch_sub':
    case 'tiktok_sub':
      next.latestSubscriber = entry;
      changed = true;
      break;

    case 'twitch_cheer':
    case 'tiktok_gift':
      next.latestDonation = entry;
      changed = true;
      if (amountOf(entry) > amountOf(next.topDonation)) next.topDonation = entry;
      break;

    case 'twitch_raid':
      next.latestRaid = entry;
      changed = true;
      break;

    default:
      return false;
  }

  if (changed) {
    tags.set(next);
    writeFiles();
    bus.emit(EVENTS.TAGS, next);
  }
  return changed;
}

/** "Name" for a plain tag, "Name 500 BITS" for one carrying an amount. */
function formatTag(entry) {
  if (!entry) return '';
  return entry.amount
    ? `${entry.user} ${entry.amount} ${entry.currency || ''}`.trim()
    : entry.user;
}

/**
 * Publish every tag to its destinations.
 *
 * Two independent outputs:
 *   - `data/tags/<key>.txt`, always written, for an OBS "Text -> Read from
 *     file" source or anything else that wants to read them
 *   - the OBS text source chosen on the Tag Manager screen, if any
 *
 * `tagOutputs[key]` is an OBS *input name* selected from a dropdown, not a
 * template. Treating it as a template wrote the source's own name into the
 * file and never touched OBS at all.
 *
 * Returns a summary so the Tag Manager's Sync button can say what it did.
 * `configured` counts tags with an OBS source chosen, `sources` counts those
 * OBS actually accepted — the two differ when OBS is disconnected or a source
 * has since been renamed.
 */
export async function publishAll() {
  const current = tags.get();
  const sources = outputs.get();
  // `configured` counts tags with an OBS source chosen; `attempted` counts
  // those that also had a value to send. A tag with a source but no value yet
  // — no raid so far, say — is skipped rather than blanking the source, so it
  // must not drag down the success ratio either.
  const result = { files: 0, sources: 0, attempted: 0, configured: 0, failed: [] };
  const pending = [];

  for (const key of Object.keys(EMPTY)) {
    const text = formatTag(current[key]);

    // Written synchronously, before any await, so a caller that writes and
    // then reads still sees fresh files — as it did before this returned a
    // summary.
    const file = path.join(tagsDir(), `${key}.txt`);
    try {
      fs.writeFileSync(file, text, 'utf8');
      result.files += 1;
    } catch (err) {
      log.warn(`could not write tag file ${key}.txt:`, err.message);
      result.failed.push(`${key}.txt`);
    }

    const inputName = sources[key];
    if (!inputName) continue;
    result.configured += 1;

    if (obsService && text) {
      result.attempted += 1;
      pending.push(
        obsService.setText(inputName, text).then(
          () => { result.sources += 1; },
          (err) => {
            log.debug(`could not update OBS source "${inputName}": ${err.message}`);
            result.failed.push(inputName);
          },
        ),
      );
    }
  }

  await Promise.all(pending);
  return result;
}

/**
 * Fire-and-forget wrapper for the automatic paths. An arriving event must not
 * wait on an OBS round trip before the next one can be handled, so these
 * callers kick the work off and move on — exactly as they did before.
 */
function writeFiles() {
  publishAll().catch((err) => log.warn('publishing tags failed:', err.message));
}

export function resetTags() {
  tags.set(structuredClone(EMPTY));
  writeFiles();
  bus.emit(EVENTS.TAGS, tags.get());
}

// ------------------------------------------------------------------- stats

/**
 * Live counters (TikTok viewers, likes, ...) published as text files.
 *
 * Deliberately separate from tags: `StreamTags` has a fixed set of keys in the
 * UI's type, whereas these are open-ended and need no UI wiring at all — point
 * an OBS "Text -> Read from file" source at `data/tags/<key>.txt`.
 *
 * Writes are throttled because likes arrive many times per second and would
 * otherwise hammer the disk.
 */
const stats = new Map();
const statTimers = new Map();
const STAT_WRITE_MS = 1000;

export const getStats = () => Object.fromEntries(stats);

function writeStat(key) {
  const file = path.join(tagsDir(), `${key}.txt`);
  try {
    fs.writeFileSync(file, String(stats.get(key) ?? ''), 'utf8');
  } catch (err) {
    log.warn(`could not write stat file ${key}.txt:`, err.message);
  }
}

export function setStat(key, value) {
  if (!key) return;
  if (stats.get(key) === value) return;
  stats.set(key, value);

  // Leading-edge write, then at most one per interval.
  if (statTimers.has(key)) return;
  writeStat(key);
  statTimers.set(key, setTimeout(() => {
    statTimers.delete(key);
    writeStat(key);
  }, STAT_WRITE_MS));
}
