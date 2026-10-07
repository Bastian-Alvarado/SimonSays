/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Command trigger matching and permission checks.
 */

/**
 * Does `user` satisfy `command.permissions`?
 *
 * `anyone: true` is an explicit allow-all. Otherwise the user must hold at
 * least one of the enabled roles. The broadcaster is never locked out of
 * their own command by an unchecked box — that is always an authoring
 * mistake rather than an intent.
 */
export function isPermitted(command, user) {
  const p = command.permissions || {};
  if (p.anyone) return true;
  if (user.isBroadcaster) return true;
  if (p.broadcaster && user.isBroadcaster) return true;
  if (p.moderators && user.isMod) return true;
  if (p.vips && user.isVip) return true;
  if (p.subscribers && user.isSub) return true;
  return false;
}

/**
 * Find the command whose trigger starts this message.
 *
 * Triggers match on the first whitespace-delimited word, case-insensitively.
 * Longer triggers win, so `!top10` is not shadowed by `!top`.
 *
 * @returns {{ command, trigger, args } | null}
 */
export function match(commands, message) {
  const text = String(message || '').trim();
  if (!text) return null;

  const firstWord = text.split(/\s+/)[0].toLowerCase();

  let best = null;
  for (const command of commands) {
    if (!command.enabled) continue;
    for (const trigger of command.triggers || []) {
      const t = String(trigger).trim().toLowerCase();
      if (!t) continue;
      if (firstWord !== t) continue;
      if (!best || t.length > best.trigger.length) {
        best = { command, trigger: t, args: text.slice(text.indexOf(' ') + 1) };
      }
    }
  }

  if (best && !text.includes(' ')) best.args = '';
  return best;
}
