/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Command cooldown tracking (global + per-user), with role-based bypass.
 *
 * State is deliberately in-memory: cooldowns are ephemeral by nature and
 * should reset when the server restarts.
 */

const state = new Map(); // commandId -> { global: number, users: Map<string, number> }

function entryFor(commandId) {
  if (!state.has(commandId)) state.set(commandId, { global: 0, users: new Map() });
  return state.get(commandId);
}

/** Does this user's role let them skip cooldowns for this command? */
function bypasses(command, user) {
  const ignore = command.ignoreCooldowns;
  if (!ignore) return false;
  if (ignore.broadcaster && user.isBroadcaster) return true;
  if (ignore.moderators && user.isMod) return true;
  if (ignore.vips && user.isVip) return true;
  if (ignore.subscribers && user.isSub) return true;
  return false;
}

/**
 * @returns {{ ok: true } | { ok: false, reason: 'global'|'user', remainingMs: number }}
 */
export function check(command, user, now = Date.now()) {
  if (bypasses(command, user)) return { ok: true };

  const entry = entryFor(command.id);

  const globalMs = (command.globalCooldown ?? 0) * 1000;
  if (globalMs > 0 && now < entry.global + globalMs) {
    return { ok: false, reason: 'global', remainingMs: entry.global + globalMs - now };
  }

  const userMs = (command.userCooldown ?? 0) * 1000;
  if (userMs > 0) {
    const key = (user.name || '').toLowerCase();
    const last = entry.users.get(key) ?? 0;
    if (now < last + userMs) {
      return { ok: false, reason: 'user', remainingMs: last + userMs - now };
    }
  }

  return { ok: true };
}

/** Record a successful invocation. Call only after the command actually ran. */
export function mark(command, user, now = Date.now()) {
  const entry = entryFor(command.id);
  entry.global = now;
  const key = (user.name || '').toLowerCase();
  entry.users.set(key, now);

  // Bound per-command user maps so a long stream can't grow them without limit.
  if (entry.users.size > 5000) {
    const cutoff = now - 60 * 60 * 1000;
    for (const [k, ts] of entry.users) if (ts < cutoff) entry.users.delete(k);
  }
}

export function reset(commandId) {
  if (commandId) state.delete(commandId);
  else state.clear();
}
