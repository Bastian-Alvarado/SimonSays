/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The poll: one question at a time, voted on from every chat the app reads.
 *
 * Kept on the server for the countdown's reasons. An overlay that reloads
 * mid-poll must come back with the same votes, and the dashboard, the dock
 * and OBS must all agree on who is winning. The clock is an absolute end
 * time, measured by each surface against `serverNow`, as the countdown's is.
 *
 * Who voted for what stays here. Surfaces get the counts: a name beside each
 * vote is nobody else's business, and a busy poll's list of voters would be
 * sent to every screen on every vote.
 *
 * Two polls, in a sense. The one on screen — open, or closed with its result
 * up — and the draft, which is what the Polls screen is setting up next.
 * They were one and the same, so typing the next poll's answers while the
 * last result was still up rewrote that result on stream: new answers, the
 * old counts attached by position. Opening a poll copies the draft into the
 * one on screen; nothing else crosses over.
 *
 * Around the poll, set on the Polls screen (see DEFAULT_POLL_SETTINGS):
 *   - the bot says in chat when one opens and who won when it closes;
 *   - the result clears itself after a while, for every surface at once;
 *   - mods can open one from chat with "!encuesta Pregunta | a | b";
 *   - the last few results are kept, to look back at and run again.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as commands from './commands.js';
import {
  cleanOptions, cleanQuestion, cleanDuration, cleanRules, parsePollLine,
  readVote, tally, leadersOf, percentOf, cleanPollSettings,
  DEFAULT_RULES, MIN_OPTIONS, DEFAULT_POLL_SETTINGS, MAX_POLL_HISTORY,
} from '../../shared/polls.js';

const log = createLogger('poll');

const DEFAULT = {
  /** idle | open | closed. Closed keeps the result on screen until reset. */
  mode: 'idle',
  /** What is on screen, or was last. */
  question: '',
  options: [],
  /** What the Polls screen is setting up next. Null until it is first edited. */
  draft: null,
  /** How long a poll runs once opened. 0 is until somebody closes it. */
  durationMs: 60 * 1000,
  endsAt: null,
  /**
   * When the last poll opened and closed. Kept after it is cleared, so a
   * message can still be known as a vote in it — see wasVote.
   */
  openedAt: null,
  closedAt: null,
  rules: DEFAULT_RULES,
  /** platform:who → { option, platform }. Never leaves the server. */
  voters: {},
};

/**
 * How often a busy poll tells the screens. A vote a message would be a
 * frame per message to every client; a few a second is live enough to
 * watch the bars move.
 */
const PUBLISH_EVERY_MS = 250;

/** Twitch's longest chat message. */
const CHAT_LIMIT = 500;

let state = null;
let settingsStore = null;
let historyStore = null;
let deps = {};
let closeTimer = null;
let publishTimer = null;
let resultTimer = null;

const draftOf = (s) => (s.draft && typeof s.draft === 'object'
  ? { question: s.draft.question || '', options: Array.isArray(s.draft.options) ? s.draft.options : [] }
  : { question: s.question || '', options: s.options || [] });

/** What a surface is sent: the counts, never who voted for what. */
export function getState() {
  const s = state?.get() ?? DEFAULT;
  const { voters, ...rest } = s;
  const counts = tally(voters, s.options.length);
  const byPlatform = {};
  for (const v of Object.values(voters || {})) {
    if (v?.platform) byPlatform[v.platform] = (byPlatform[v.platform] || 0) + 1;
  }
  return {
    ...rest,
    draft: draftOf(s),
    counts,
    total: counts.reduce((a, b) => a + b, 0),
    leaders: leadersOf(counts),
    byPlatform,
    serverNow: Date.now(),
  };
}

export const getSettings = () => cleanPollSettings(settingsStore?.get(), DEFAULT_POLL_SETTINGS);
export const getHistory = () => {
  const h = historyStore?.get();
  return Array.isArray(h?.items) ? h.items : [];
};

function announce() {
  if (publishTimer) { clearTimeout(publishTimer); publishTimer = null; }
  bus.emit(EVENTS.CONFIG, { key: 'poll', value: getState() });
}

/** A change somebody made: saved and told at once. */
function publish(next) {
  state.set(next);
  state.flush();
  announce();
  return getState();
}

/** A vote: saved, and told with the next few, a few times a second. */
function publishSoon(next) {
  state.set(next);
  if (!publishTimer) publishTimer = setTimeout(announce, PUBLISH_EVERY_MS);
}

function setHistory(items) {
  historyStore.set({ items });
  bus.emit(EVENTS.CONFIG, { key: 'pollHistory', value: items });
}

// ------------------------------------------------------------ what chat is told

/** Said by the bot, when it can. Never allowed to stop the poll itself. */
function say(text) {
  if (!text || !deps.twitch?.say) return;
  Promise.resolve(deps.twitch.say(text.slice(0, CHAT_LIMIT), { useBot: true }))
    .catch((err) => log.warn(`could not say it in chat: ${err.message}`));
}

/** "1 min", "30 s", "1 min 30 s". */
function spokenLength(ms) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (!m) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** "Benji", "Benji y Moxie", "Benji, Moxie y Pancho". */
const listed = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`);

const votes = (n) => `${n} ${n === 1 ? 'voto' : 'votos'}`;

/**
 * What the bot says as a poll opens: the question, the answers numbered, and
 * how to vote — in the stream's language. As many answers as fit in one chat
 * message; a list that does not fit ends in "…" rather than being cut mid-word.
 */
export function openLine(poll) {
  const rules = { ...DEFAULT_RULES, ...(poll.rules || {}) };
  const how = rules.numbers && rules.words ? 'Vota con el número o la respuesta'
    : rules.numbers ? 'Vota con el número'
      : rules.words ? 'Vota escribiendo la respuesta'
        : 'Vota con !voto y el número';
  const head = `📊 ${poll.question} — `;
  const tail = ` — ${how}${poll.durationMs ? `, tienes ${spokenLength(poll.durationMs)}` : ''}.`;
  let list = '';
  for (let i = 0; i < poll.options.length; i += 1) {
    const next = `${list ? `${list} · ` : ''}${i + 1}) ${poll.options[i]}`;
    if ((head + next + tail).length > CHAT_LIMIT - 2) { list += ' …'; break; }
    list = next;
  }
  return head + list + tail;
}

/** What the bot says as a poll closes: who won, by how much — or the tie, or that nobody voted. */
export function closeLine(result) {
  const { question, options = [], counts = [], total = 0, leaders = [] } = result;
  if (!total) return `📊 «${question}» cerró sin votos.`;
  const top = counts[leaders[0]] || 0;
  if (leaders.length === 1) {
    return `📊 ${question} — Ganó ${options[leaders[0]]} con ${top} de ${votes(total)} (${percentOf(top, total)}%).`;
  }
  return `📊 ${question} — Empate entre ${listed(leaders.map((i) => options[i]))}, con ${votes(top)} cada una.`;
}

// ------------------------------------------------------------ the clocks

function scheduleClose(s) {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  if (s.mode !== 'open' || !s.endsAt) return;
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (state.get().mode === 'open') close('time');
  }, Math.max(0, s.endsAt - Date.now()));
}

/**
 * A closed result that clears itself. On the server, so everything that
 * shows the poll — or moves aside for it — lets go at the same moment; a
 * layer that only hid itself left the rest waiting for somebody to clear it.
 */
function scheduleResultClear() {
  if (resultTimer) { clearTimeout(resultTimer); resultTimer = null; }
  const s = state.get();
  const { resultSeconds } = getSettings();
  if (s.mode !== 'closed' || !resultSeconds || !s.closedAt) return;
  const closedAt = s.closedAt;
  resultTimer = setTimeout(() => {
    resultTimer = null;
    const now = state.get();
    if (now.mode === 'closed' && now.closedAt === closedAt) control('reset');
  }, Math.max(0, closedAt + resultSeconds * 1000 - Date.now()));
}

function close(why) {
  const s = state.get();
  if (s.mode !== 'open') return getState();
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  const result = publish({ ...s, mode: 'closed', endsAt: null, closedAt: Date.now() });
  const winners = result.leaders.map((i) => s.options[i]);
  log.info(`poll closed (${why}): ${result.total} votes, ${winners.length ? `won by ${winners.join(' / ')}` : 'no votes'}`);

  // Kept to look back at, and to run again.
  setHistory([{
    id: Math.random().toString(36).slice(2, 11),
    question: s.question,
    options: s.options,
    counts: result.counts,
    total: result.total,
    leaders: result.leaders,
    byPlatform: result.byPlatform,
    openedAt: s.openedAt,
    closedAt: result.closedAt,
  }, ...getHistory()].slice(0, MAX_POLL_HISTORY));

  if (getSettings().announceClose) say(closeLine(result));
  scheduleResultClear();

  /*
    As a stream event, so an action can react — read the winner out, switch
    a scene. {user} is the winning answer, since that is what an action most
    wants to say; a tie names every answer that tied.
  */
  bus.emit(EVENTS.EVENT, normaliseEvent({
    type: 'poll_closed',
    platform: 'system',
    user: winners.join(' / ') || '—',
    data: { question: s.question, winner: winners.join(' / '), votes: result.total, tie: winners.length > 1 },
  }));
  return result;
}

// ------------------------------------------------------------ chat

/**
 * "!encuesta Pregunta | a | b" opens that poll; "!encuesta" alone opens the one
 * set up on the Polls screen; "!encuesta cerrar" closes it. Mods and the
 * streamer only — a poll anyone could open would be opened by anyone. A
 * command of the streamer's own on the same word answers instead. Returns
 * whether the message was this command, so it is not read as a vote.
 */
function onCommand(chat) {
  const { command } = getSettings();
  if (!command.enabled || chat?.isBot) return false;
  const said = String(chat?.msg ?? '').trim();
  const word = said.split(/\s+/)[0];
  if (word.toLowerCase() !== command.trigger) return false;
  if (!(chat.isMod || chat.isBroadcaster)) return true;
  if (commands.match(collection('commands', []).get() || [], said)) return true;

  const rest = said.slice(word.length).trim();
  const usage = `Escríbela así: ${command.trigger} Pregunta | respuesta | respuesta`;
  if (/^(cerrar|close)$/i.test(rest)) {
    if (state.get().mode === 'open') close(`closed from chat by ${chat.user}`);
    else say('No hay ninguna encuesta abierta.');
    return true;
  }
  const wanted = rest ? parsePollLine(rest) : draftOf(state.get());
  if (!wanted.question || cleanOptions(wanted.options).length < MIN_OPTIONS) {
    say(usage);
    return true;
  }
  log.info(`poll opened from chat by ${chat.user}`);
  control('open', rest ? wanted : undefined);
  return true;
}

/**
 * Count a chat message as a vote, if it is one. Every platform's chat comes
 * through here, which is the whole point of not using Twitch's polls.
 */
function onChat(chat) {
  if (onCommand(chat)) return;
  const s = state.get();
  if (s.mode !== 'open' || !chat?.msg) return;
  // A poll past its time does not take votes while its timer catches up.
  if (s.endsAt && Date.now() >= s.endsAt) return;
  const option = readVote(chat.msg, s.options, s.rules);
  if (option < 0) return;
  const platform = chat.platform || 'chat';
  const who = `${platform}:${chat.userId || String(chat.user || '').toLowerCase()}`;
  if (who.endsWith(':')) return;
  const before = s.voters[who];
  if (before && (!s.rules.change || before.option === option)) return;
  publishSoon({ ...s, voters: { ...s.voters, [who]: { option, platform } } });
}

/** `d.twitch.say` tells chat about the poll. Passed in, so the tests can listen. */
export function initPolls(d = {}) {
  deps = d;
  state = collection('poll', DEFAULT);
  settingsStore = collection('poll_settings', DEFAULT_POLL_SETTINGS);
  historyStore = collection('poll_history', { items: [] });
  // A restart mid-poll keeps it; one whose time ran out while down is closed.
  const s = state.get();
  if (s.mode === 'open' && s.endsAt) {
    if (s.endsAt <= Date.now()) close('time ran out while the server was down');
    else scheduleClose(s);
  }
  // And a result due to clear while it was down clears now.
  scheduleResultClear();
  bus.on(EVENTS.CHAT, onChat);
}

// ------------------------------------------------------------ requests

/**
 * The draft, from either end. The rules and the length apply to the poll on
 * screen too — the rules may change mid-poll; what is being voted on may not,
 * which is why the question and answers only ever reach the draft.
 */
function withDraft(s, value) {
  if (!value || typeof value !== 'object') return s;
  const draft = draftOf(s);
  return {
    ...s,
    draft: {
      question: value.question !== undefined ? cleanQuestion(value.question) : draft.question,
      options: value.options !== undefined ? cleanOptions(value.options) : draft.options,
    },
    durationMs: value.durationMs !== undefined ? cleanDuration(value.durationMs) : s.durationMs,
    rules: value.rules !== undefined ? cleanRules({ ...s.rules, ...value.rules }) : s.rules,
  };
}

/** Every way the poll can change. */
export function control(op, value) {
  if (!state) return null;
  const s = state.get();

  switch (op) {
    case 'setDraft':
      return publish(withDraft(s, value));

    /*
      Open a poll: the one set up, or one given here. Opening starts from no
      votes — a poll reopened is a new poll, not the last one continued.
    */
    case 'open': {
      const next = withDraft(s, value);
      const { question, options } = draftOf(next);
      if (!question || options.length < MIN_OPTIONS) {
        log.warn('poll: a question and at least two answers are needed to open one');
        return getState();
      }
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      if (resultTimer) { clearTimeout(resultTimer); resultTimer = null; }
      const now = Date.now();
      const opened = {
        ...next, question, options, draft: { question, options }, mode: 'open', voters: {}, openedAt: now, closedAt: null,
        endsAt: next.durationMs ? now + next.durationMs : null,
      };
      publish(opened);
      scheduleClose(opened);
      log.info(`poll opened: "${question}" — ${options.length} answers${opened.durationMs ? `, ${Math.round(opened.durationMs / 1000)}s` : ''}`);
      if (getSettings().announceOpen) say(openLine(opened));
      // As a stream event too, so an action can start something with it.
      bus.emit(EVENTS.EVENT, normaliseEvent({
        type: 'poll_opened',
        platform: 'system',
        user: question,
        data: { question, answers: options.join(' / '), count: options.length, seconds: Math.round(opened.durationMs / 1000) },
      }));
      return getState();
    }

    case 'close':
      return close('closed');

    /** Back to nothing on screen. The question and answers stay, ready to run again. */
    case 'reset': {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      if (resultTimer) { clearTimeout(resultTimer); resultTimer = null; }
      // A poll cleared while open ends here, so its votes stop being votes from now.
      return publish({ ...s, mode: 'idle', voters: {}, endsAt: null, closedAt: s.closedAt || (s.mode === 'open' ? Date.now() : null) });
    }

    /** More time, or less. A poll with no clock gets one from now. */
    case 'add': {
      if (s.mode !== 'open') return getState();
      const delta = Number(value) || 0;
      const endsAt = Math.max(Date.now() + 1000, (s.endsAt || Date.now()) + delta);
      const next = { ...s, endsAt };
      publish(next);
      scheduleClose(next);
      return getState();
    }

    /** What happens around the poll. A new result time applies to a result already up. */
    case 'settings': {
      const next = cleanPollSettings(value, getSettings());
      settingsStore.set(next);
      bus.emit(EVENTS.CONFIG, { key: 'pollSettings', value: next });
      scheduleResultClear();
      return next;
    }

    /** A past poll's question and answers, back in the draft to run again. */
    case 'history_use': {
      const past = getHistory().find((h) => h.id === value);
      if (!past) return getState();
      return publish(withDraft(s, { question: past.question, options: past.options }));
    }

    case 'history_delete':
      setHistory(getHistory().filter((h) => h.id !== value));
      return getState();

    case 'history_clear':
      setHistory([]);
      return getState();

    default:
      throw new Error(`poll: unknown operation "${op}"`);
  }
}

/** A poll from one line of chat: "Question | answer | answer". */
export function openFromLine(line) {
  const parsed = parsePollLine(line);
  // Nothing usable typed: open whatever is set up on the Polls screen.
  if (!parsed.question && !parsed.options.length) return control('open');
  if (parsed.options.length < MIN_OPTIONS) {
    log.warn(`poll: "${line}" has fewer than two answers — write it as "Question | answer | answer"`);
    return getState();
  }
  return control('open', parsed);
}

/** Stop the timers, for a clean shutdown and for tests. */
export function stopPolls() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  if (publishTimer) { clearTimeout(publishTimer); publishTimer = null; }
  if (resultTimer) { clearTimeout(resultTimer); resultTimer = null; }
}
