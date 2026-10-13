/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What the moderators did (2.0.0, "The moderators update"), for the
 * streamer's Moderators screen: a line for each change a moderator made
 * through the dashboard — an action saved, a button pressed, a line sent to
 * chat — with who, when, and what it was.
 *
 * Written by api/ws.js when a moderator's request has been carried out, so a
 * refused one is not on it, and neither is looking: opening a screen, asking
 * for a list, browsing a profile. The newest few hundred are kept; it is a
 * record of the last streams, not an archive.
 *
 * History rather than configuration, so it stays out of backups
 * (engine/backup.js EXCLUDED).
 */

import { collection } from '../core/store.js';

/** Each moderator's newest, kept apart, so one cannot push another's off the record; and all of them together. */
export const KEEP_EACH = 200;
export const KEEP = 1000;
/** The same thing again this soon is one line, counted: a button pressed twice, a deck tidied in a dozen saves. */
const MERGE_MS = 120_000;

let db = null;
const store = () => (db ??= collection('mod_activity', { entries: [] }));

export function initModActivity() {
  store();
}

/** Requests that only look, never on the record. */
const LOOKING_TYPES = new Set([
  'hello', 'get_snapshot', 'profile_peek', 'get_xp_data', 'twitch_fetch_rewards', 'twitch_fetch_tags',
  'twitch_search_categories', 'twitch_get_user', 'droidcam_probe', 'auth', 'welcome_card_preview', 'spotify_refresh',
]);
/** And ops, in any request, that only look or ask. */
const LOOKING_OPS = new Set([
  'get', 'list', 'read', 'log', 'meter', 'inspect', 'canvases', 'search', 'check', 'preview', 'status', 'get-chat-settings',
  // Discord's screens, asking what the server has; the history's numbers; the points board.
  'get_guilds', 'get_channels', 'get_roles', 'get_emojis', 'get_member_me', 'get_message', 'search_members', 'server_members', 'stats', 'board',
]);

export const isLooking = (type, payload) => LOOKING_TYPES.has(type) || LOOKING_OPS.has(payload?.op);

/** A few words saying which thing it was: its name, its trigger, the line sent. */
function whatOf(payload, names) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  // And who it was done to, for moderating (C2S.TWITCH_MOD names them by login).
  const said = payload.name || payload.trigger || payload.title || payload.text || payload.message;
  if (typeof said === 'string' && said.trim()) return said.trim().slice(0, 120);
  if (payload.builtin) return String(payload.builtin);
  // An action or a command by its id: by its name, as it is now.
  const id = payload.id || payload.actionId;
  if (typeof id === 'string' && names?.(id)) return names(id);
  return '';
}

/**
 * Put a moderator's request on the record. `target` is who it was done to,
 * as the server knows them (api/ws.js, from the chat it saw) — never a name
 * the page sent, which could say anybody.
 */
export function record(identity, type, payload, { names, target, now = Date.now() } = {}) {
  if (identity?.role !== 'mod' || isLooking(type, payload)) return;
  const entry = {
    at: now,
    userId: identity.userId || '',
    login: identity.login || '',
    type,
    ...(typeof payload?.op === 'string' ? { op: payload.op.slice(0, 40) } : {}),
    what: target ? String(target).slice(0, 120) : whatOf(payload, names),
  };
  store().update((s) => {
    const all = s.entries || [];
    // The same as their last, a moment ago: counted on that line rather than a new one.
    const prev = all.find((e) => e.userId === entry.userId);
    if (prev && prev.type === entry.type && prev.op === entry.op && prev.what === entry.what && now - prev.at < MERGE_MS) {
      return { entries: all.map((e) => (e === prev ? { ...e, at: now, times: (e.times || 1) + 1 } : e)) };
    }
    // Each moderator's newest KEEP_EACH, and KEEP in all.
    const seen = new Map();
    const kept = [entry, ...all].filter((e) => {
      const n = (seen.get(e.userId) || 0) + 1;
      seen.set(e.userId, n);
      return n <= KEEP_EACH;
    });
    return { entries: kept.slice(0, KEEP) };
  });
}

/** The newest first, for one moderator or all of them. */
export function list({ userId = '', limit = 200 } = {}) {
  const all = store().get().entries || [];
  return (userId ? all.filter((e) => e.userId === userId) : all).slice(0, Math.max(1, Math.min(KEEP, limit)));
}
