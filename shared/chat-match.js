/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Chat that sets an action off by what it says, not by a command word: the
 * "Chat message" trigger. "Anyone says gg", "a message with a link in it".
 *
 *   words   any of these words or phrases, comma-separated, as whole words:
 *           "gg" is in "gg wp" and not in "eggs"
 *   starts  the message starts with this
 *   exact   the whole message is this
 *   regex   a pattern, for anything the others cannot say
 *
 * Never case-sensitive. What matched is {match}, and a pattern's groups are
 * {match.1}, {match.2} and so on.
 *
 * Who it listens to: never the channel's bot, and the streamer only if asked
 * — what the app sends from the streamer's account comes back as the
 * streamer's own chat, so an action answering "gg" with "gg" would otherwise
 * set itself off for ever. The cooldowns hold back the rest: a word everybody
 * says at once is one action, not forty.
 */

export const MATCH_MODES = ['words', 'starts', 'exact', 'regex'];
export const CHAT_PLATFORMS = ['any', 'twitch', 'youtube', 'tiktok', 'kick', 'discord'];
export const DEFAULT_CHAT_TRIGGER = { match: 'words', text: '', platform: 'any', streamerToo: false, cooldown: 10, userCooldown: 0 };
/** Past this a pattern is a mistake, and a long one run on every message is a cost. */
const MAX_TEXT = 500;

const clampSeconds = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(86_400, Math.max(0, Math.round(n))) : fallback;
};

/** A Chat message trigger's settings as kept. */
export function cleanChatTrigger(cfg) {
  return {
    match: MATCH_MODES.includes(cfg?.match) ? cfg.match : DEFAULT_CHAT_TRIGGER.match,
    text: String(cfg?.text ?? '').slice(0, MAX_TEXT),
    platform: CHAT_PLATFORMS.includes(cfg?.platform) ? cfg.platform : 'any',
    streamerToo: cfg?.streamerToo === true,
    cooldown: clampSeconds(cfg?.cooldown, DEFAULT_CHAT_TRIGGER.cooldown),
    userCooldown: clampSeconds(cfg?.userCooldown, DEFAULT_CHAT_TRIGGER.userCooldown),
  };
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
  A typed pattern, read the way most people write one: with Unicode on when
  it can be, so \p{L} works, and without it when it cannot — Unicode mode
  refuses escapes like \- that ordinary patterns allow.
*/
function typedPattern(text) {
  try { return new RegExp(text, 'iu'); } catch { return new RegExp(text, 'i'); }
}

/** The pattern a trigger stands for, or null when it has nothing to look for or the pattern is broken. */
const cache = new Map();
export function patternFor(cfg) {
  const { match, text } = cleanChatTrigger(cfg);
  const key = `${match}\u0000${text}`;
  if (cache.has(key)) return cache.get(key);
  let re = null;
  try {
    if (match === 'regex') re = text ? typedPattern(text) : null;
    else if (match === 'exact') re = text.trim() ? new RegExp(`^\\s*${escape(text.trim())}\\s*$`, 'iu') : null;
    else if (match === 'starts') re = text.trim() ? new RegExp(`^\\s*${escape(text.trim())}`, 'iu') : null;
    else {
      const words = text.split(',').map((w) => w.trim()).filter(Boolean);
      // Whole words: not a letter or a digit either side, in any script.
      re = words.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'iu') : null;
    }
  } catch {
    re = null;
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, re);
  return re;
}

/** Whether a pattern typed into the editor is one, for it to say so. */
export function patternError(text) {
  try { typedPattern(String(text ?? '')); return ''; } catch (err) { return err.message; }
}

/**
 * What a message matched: { text, 1: …, 2: … } for {match} and its groups,
 * or null for no match.
 */
export function matchChat(cfg, message) {
  const re = patternFor(cfg);
  if (!re) return null;
  const m = re.exec(String(message ?? ''));
  if (!m) return null;
  const out = { text: m[0].trim() };
  for (let i = 1; i < m.length; i++) out[i] = m[i] ?? '';
  return out;
}

/** Whether this chat line is one the trigger listens to at all. */
export function listensTo(cfg, chat) {
  const c = cleanChatTrigger(cfg);
  if (!chat || chat.isBot) return false;
  if (chat.isBroadcaster && !c.streamerToo) return false;
  return c.platform === 'any' || c.platform === chat.platform;
}
