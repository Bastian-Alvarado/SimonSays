/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Durable JSON store.
 *
 * Fixes three real defects carried over from V2:
 *   1. A corrupt file crashed boot. Now each collection falls back to its
 *      default independently, and the bad file is preserved as `.corrupt`
 *      rather than silently overwritten.
 *   2. Writes were not atomic — a crash mid-`writeFileSync` truncated the
 *      database. Now we write to a temp file and rename (atomic on both
 *      NTFS and ext4).
 *   3. Every mutation hit the disk synchronously. Writes are now coalesced
 *      on a short debounce, with a synchronous flush on shutdown.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { createLogger } from './logger.js';

const log = createLogger('store');
const WRITE_DEBOUNCE_MS = 250;

class Collection {
  #file;
  #value;
  #timer = null;
  #dirty = false;

  constructor(name, defaultValue) {
    this.name = name;
    this.#file = path.join(config.dataDir, `${name}.json`);
    this.#value = this.#load(defaultValue);
  }

  #load(defaultValue) {
    if (!fs.existsSync(this.#file)) return structuredClone(defaultValue);

    try {
      const parsed = JSON.parse(fs.readFileSync(this.#file, 'utf8'));
      // Merge objects so newly-added default keys appear on old databases.
      if (
        parsed && !Array.isArray(parsed) && typeof parsed === 'object' &&
        defaultValue && !Array.isArray(defaultValue) && typeof defaultValue === 'object'
      ) {
        return { ...structuredClone(defaultValue), ...parsed };
      }
      return parsed;
    } catch (err) {
      const backup = `${this.#file}.corrupt.${Date.now()}`;
      try {
        fs.renameSync(this.#file, backup);
        log.error(`"${this.name}" is corrupt; preserved at ${path.basename(backup)}. Using defaults.`);
      } catch {
        log.error(`"${this.name}" is corrupt and could not be preserved. Using defaults.`, err);
      }
      return structuredClone(defaultValue);
    }
  }

  get() {
    return this.#value;
  }

  set(value) {
    this.#value = value;
    this.#schedule();
    return value;
  }

  /** Mutate in place, then persist. Returns the new value. */
  update(fn) {
    const next = fn(this.#value);
    if (next !== undefined) this.#value = next;
    this.#schedule();
    return this.#value;
  }

  /**
   * Mutate in place without writing now: the change is kept in memory and
   * goes to disk at the next flush — the owner's own timer, or shutdown.
   * For data that changes with every chat message, where a write each time
   * would rewrite the file several times a second during a busy stream.
   */
  updateQuietly(fn) {
    const next = fn(this.#value);
    if (next !== undefined) this.#value = next;
    this.#dirty = true;
    return this.#value;
  }

  #schedule() {
    this.#dirty = true;
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.flush();
    }, WRITE_DEBOUNCE_MS);
  }

  flush() {
    if (!this.#dirty) return;
    const tmp = `${this.#file}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.#value, null, 2), 'utf8');
      fs.renameSync(tmp, this.#file); // atomic
      this.#dirty = false;
    } catch (err) {
      log.error(`failed to persist "${this.name}":`, err);
      try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    }
  }
}

const collections = new Map();

/** Get-or-create a persisted collection. */
export function collection(name, defaultValue) {
  if (!collections.has(name)) {
    collections.set(name, new Collection(name, defaultValue));
  }
  return collections.get(name);
}

/**
 * An already-created collection, or undefined.
 *
 * Unlike `collection()` this never creates one, because the caller — backup —
 * must not conjure an empty `spotify_settings` into existence just by asking
 * whether there is one. A module that has not initialised simply has nothing
 * to contribute.
 */
export function getCollection(name) {
  return collections.get(name);
}

export function initStore() {
  for (const dir of [config.dataDir, config.assetsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log.info(`created ${dir}`);
    }
  }
}

/** Synchronously persist everything. Called on shutdown. */
export function flushAll() {
  for (const c of collections.values()) c.flush();
}
