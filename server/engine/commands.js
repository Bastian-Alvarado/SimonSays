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
 * Would one of the streamer's own commands answer this message?
 *
 * The built-in words ("!pregunta", "!puntos", "!nivel" and the rest) step
 * aside for a command of the streamer's own with the same word. Only for one
 * that would do something, though, the way the command handler decides
 * (engine/index.js onChat): it is on, it is allowed where this was said, and
 * an action is linked to it. A command made and left without an action, or
 * kept off Discord, used to take the word and answer nothing — the built-in
 * fell silent behind a command that did not run.
 */
export function ownCommandAnswers(commandList, actionList, message, platform) {
  const hit = match(commandList || [], message);
  if (!hit) return false;
  if (platform === 'discord' && hit.command.discord === false) return false;
  return (actionList || []).some((a) => a.enabled
    && a.trigger?.type === 'command_trigger'
    && a.trigger.config?.commandId === hit.command.id);
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
