/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Serial, rate-limited task queue for outbound API calls.
 *
 * V2 had a single global queue shared by every Discord call. That meant a
 * slow role-assignment blocked chat relays behind it. Queues are now named,
 * so independent workloads drain independently.
 */

import { createLogger } from './logger.js';

const log = createLogger('queue');

class Queue {
  #tasks = [];
  #running = false;

  constructor(name, spacingMs) {
    this.name = name;
    this.spacingMs = spacingMs;
  }

  /** Enqueue a task. Resolves with the task's return value. */
  push(task) {
    return new Promise((resolve, reject) => {
      this.#tasks.push({ task, resolve, reject });
      this.#drain();
    });
  }

  async #drain() {
    if (this.#running) return;
    this.#running = true;

    while (this.#tasks.length > 0) {
      const { task, resolve, reject } = this.#tasks.shift();
      try {
        resolve(await task());
      } catch (err) {
        // 50013 = missing permissions, 10008 = unknown message. Both are
        // routine and expected; anything else is worth surfacing.
        if (err?.code === 50013) {
          log.warn(`[${this.name}] bot lacks permission for a request`);
        } else if (err?.code !== 10008) {
          log.error(`[${this.name}] task failed:`, err);
        }
        reject(err);
      }
      if (this.spacingMs > 0) {
        await new Promise((r) => setTimeout(r, this.spacingMs));
      }
    }

    this.#running = false;
  }

  get depth() {
    return this.#tasks.length;
  }
}

const queues = new Map();

/**
 * Get-or-create a named queue.
 * @param {string} name
 * @param {number} spacingMs delay inserted between tasks
 */
export function queue(name, spacingMs = 250) {
  if (!queues.has(name)) queues.set(name, new Queue(name, spacingMs));
  return queues.get(name);
}

export const queueDepths = () =>
  Object.fromEntries([...queues].map(([k, v]) => [k, v.depth]));
