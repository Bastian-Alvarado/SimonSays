/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Tiny levelled logger with a bounded in-memory ring buffer so the config UI
 * can show recent server activity without needing file access.
 */

import { config } from '../config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

const RING_SIZE = 500;
const ring = [];
// Warnings and errors kept apart as well: on a busy stream the 500 above turn over in hours with every
// command and event, and a report of what went wrong (server/engine/diagnostics.js) must not lose them.
const PROBLEMS_SIZE = 50;
const problems = [];

const subscribers = new Set();

function emit(level, scope, args) {
  if (LEVELS[level] < threshold) return;

  const entry = {
    ts: Date.now(),
    level,
    scope,
    message: args
      .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
      .join(' '),
  };

  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  if (level === 'warn' || level === 'error') {
    problems.push(entry);
    if (problems.length > PROBLEMS_SIZE) problems.shift();
  }

  const stamp = new Date(entry.ts).toISOString().slice(11, 19);
  const tag = `[${stamp}] ${level.toUpperCase().padEnd(5)} ${scope}`;
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(tag, entry.message);

  for (const fn of subscribers) {
    try {
      fn(entry);
    } catch {
      /* a broken subscriber must never break logging */
    }
  }
}

function safeStringify(value) {
  if (value instanceof Error) return value.stack || value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function createLogger(scope) {
  return {
    debug: (...a) => emit('debug', scope, a),
    info: (...a) => emit('info', scope, a),
    warn: (...a) => emit('warn', scope, a),
    error: (...a) => emit('error', scope, a),
  };
}

export const getRecentLogs = (limit = 200) => ring.slice(-limit);
/** The latest warnings and errors since the server started, however busy the log has been since. */
export const getRecentProblems = (limit = PROBLEMS_SIZE) => problems.slice(-limit);
export const onLog = (fn) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};
