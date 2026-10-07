/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Polls: one question, a few answers, and chat votes from every platform.
 *
 * Not Twitch's own polls, on purpose. Those only count Twitch, and a stream
 * that goes out to YouTube, TikTok and a Discord at once would be asking a
 * quarter of its audience. Here a vote is a chat message, so anyone who can
 * type in any chat the app reads can vote.
 *
 * Shared, because both ends have to agree: the server cleans a poll and reads
 * votes with these rules, and the Polls screen offers what the server keeps.
 */

/**
 * As many answers as a poll holds. Fifteen is a full Among Us lobby, so
 * "who is the impostor?" can list everybody still in. Past that it is a
 * list, not a poll.
 */
export const MAX_OPTIONS = 15;
export const MIN_OPTIONS = 2;
export const MAX_QUESTION = 120;
export const MAX_OPTION = 60;

/** Longest a poll can run on its own clock: an hour. 0 is "until closed". */
export const MAX_POLL_MS = 60 * 60 * 1000;

/** The words that mark a vote as a vote in any language the stream speaks. */
export const VOTE_WORDS = ['vote', 'voto', 'votar', 'votes', 'votos'];

const oneLine = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * An answer as it is compared, not shown: no case, no accents, no
 * punctuation at the ends. "¡Rojo!" and "rojo" are the same vote.
 */
export function plain(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^[\s!¡?¿.,:;"'()]+|[\s!¡?¿.,:;"'()]+$/g, '')
    .replace(/\s+/g, ' ');
}

/** How votes are read. Each is a switch on the Polls screen. */
export const DEFAULT_RULES = {
  /** A message that is only a number — "2" — is a vote. */
  numbers: true,
  /** A message that is only an answer's text — "rojo" — is a vote. */
  words: true,
  /** A second vote replaces the first, rather than being ignored. */
  change: true,
};

export function cleanRules(r) {
  const from = r && typeof r === 'object' ? r : {};
  return {
    numbers: from.numbers !== false,
    words: from.words !== false,
    change: from.change !== false,
  };
}

/**
 * The answers, cleaned: one line each, none empty, none twice. Twice would
 * make "rojo" a vote for whichever came first and the other unreachable.
 */
export function cleanOptions(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const text = oneLine(typeof raw === 'object' && raw ? raw.text : raw, MAX_OPTION);
    const key = plain(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

export const cleanQuestion = (v) => oneLine(v, MAX_QUESTION);

export function cleanDuration(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_POLL_MS, Math.round(n));
}

/**
 * "Who is the impostor? | Rojo | Azul" — a poll in one line, for a chat
 * command. The first part is the question and the rest are the answers.
 */
export function parsePollLine(line) {
  const parts = String(line ?? '').split('|').map((p) => p.trim()).filter(Boolean);
  return { question: cleanQuestion(parts[0] || ''), options: cleanOptions(parts.slice(1)) };
}

/**
 * Which answer a chat message votes for, counted from 0, or -1 for none.
 *
 * "!vote 2" and "!voto rojo" always count. A bare "2" or a bare "rojo" count
 * when the rules say so — on by default, because that is how chat votes
 * anyway, and off for a stream where "1" is something people type for other
 * reasons.
 */
export function readVote(msg, options, rules = DEFAULT_RULES) {
  const count = Array.isArray(options) ? options.length : 0;
  if (!count) return -1;
  let text = String(msg ?? '').trim();
  if (!text || text.length > MAX_OPTION + 12) return -1;

  const command = text.match(/^!(\S+)\s+(.+)$/);
  const asked = Boolean(command && VOTE_WORDS.includes(command[1].toLowerCase()));
  if (asked) text = command[2].trim();
  else if (text.startsWith('!')) return -1;

  if ((asked || rules.numbers) && /^#?\d{1,2}$/.test(text)) {
    const n = Number(text.replace('#', ''));
    return n >= 1 && n <= count ? n - 1 : -1;
  }
  if (asked || rules.words) {
    const want = plain(text);
    if (!want) return -1;
    return options.findIndex((o) => plain(o) === want);
  }
  return -1;
}

/** How many votes each answer has, from who voted for what. */
export function tally(voters, count) {
  const counts = Array.from({ length: count }, () => 0);
  for (const v of Object.values(voters || {})) {
    const i = typeof v === 'object' && v ? v.option : v;
    if (Number.isInteger(i) && i >= 0 && i < count) counts[i] += 1;
  }
  return counts;
}

/** The answers in the lead — more than one on a tie, none before a vote. */
export function leadersOf(counts) {
  const top = Math.max(0, ...(counts || []));
  if (top === 0) return [];
  return counts.reduce((acc, n, i) => (n === top ? [...acc, i] : acc), []);
}

/** A whole number out of 100, so the bars on screen add up to something sane. */
export const percentOf = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

// ------------------------------------------------------------ around the poll

/** How many finished polls the Polls screen keeps, newest first. */
export const MAX_POLL_HISTORY = 10;

/** How long a result stays up once a poll closes, in seconds. 0 is until it is cleared. */
export const RESULT_SECONDS = [0, 10, 15, 30, 60, 120];

/**
 * What happens around a poll, as opposed to the poll itself. Kept apart from
 * the poll because it is configuration: it travels in a backup, and who voted
 * for what does not.
 */
export const DEFAULT_POLL_SETTINGS = {
  /** Clear the result this many seconds after closing, for every surface at once. */
  resultSeconds: 0,
  /** The bot says the question and how to vote when a poll opens… */
  announceOpen: true,
  /** …and who won when it closes. */
  announceClose: true,
  /** Leave votes out of the chat on stream, so "3", "3", "3" does not bury it. */
  hideVotes: true,
  /** "!encuesta Pregunta | a | b" opens one from chat, for mods. */
  command: { enabled: true, trigger: '!encuesta' },
};

const cleanTrigger = (v, before) => {
  const t = String(v ?? '').trim().toLowerCase().replace(/^!*/, '!');
  if (/^![^\s!|]{1,29}$/.test(t)) return t;
  return before ? cleanTrigger(before) : DEFAULT_POLL_SETTINGS.command.trigger;
};

export function cleanPollSettings(incoming, before = DEFAULT_POLL_SETTINGS) {
  const from = incoming && typeof incoming === 'object' ? incoming : {};
  const was = { ...DEFAULT_POLL_SETTINGS, ...(before && typeof before === 'object' ? before : {}) };
  const pick = (key) => (from[key] !== undefined ? from[key] : was[key]);
  const seconds = Math.round(Number(pick('resultSeconds')));
  const command = { ...DEFAULT_POLL_SETTINGS.command, ...(was.command || {}), ...(from.command && typeof from.command === 'object' ? from.command : {}) };
  return {
    resultSeconds: Number.isFinite(seconds) ? Math.min(600, Math.max(0, seconds)) : 0,
    announceOpen: pick('announceOpen') !== false,
    announceClose: pick('announceClose') !== false,
    hideVotes: pick('hideVotes') !== false,
    command: {
      enabled: command.enabled !== false,
      trigger: cleanTrigger(command.trigger, was.command?.trigger),
    },
  };
}

/**
 * Whether a chat message was a vote in this poll: said while it was open, and
 * read as a vote by its rules. Worked out from the message's own time, so a
 * vote stays a vote after the poll closes, and an overlay that reloads knows
 * which of the messages it is replayed were votes.
 */
export function wasVote(message, poll) {
  if (!poll?.openedAt || !Array.isArray(poll.options) || !poll.options.length) return false;
  const at = Number(message?.at);
  if (!Number.isFinite(at) || at < poll.openedAt) return false;
  if (poll.closedAt && at > poll.closedAt) return false;
  if (message?.isEvent) return false;
  return readVote(message?.msg, poll.options, poll.rules || DEFAULT_RULES) >= 0;
}

/** The chat as the stream shows it: without the votes, when the poll screen says so. */
export const withoutVotes = (messages, poll, settings) => (
  settings?.hideVotes === false || !poll?.openedAt
    ? messages
    : (messages || []).filter((m) => !wasVote(m, poll))
);
