/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The stream plan: what the stream is working through, and where it has got to.
 *
 * A list with a mark against the thing happening now. Moving the mark ticks
 * off everything above it, because moving on always means the last thing
 * finished. Deliberately not a timetable: nothing here tells viewers when,
 * because saying "at 9" and then not doing it at 9 is worse than not saying.
 *
 * Moving the mark is also the moment the rest of the stream can follow:
 *   - a step may name a Twitch category, a stream title and a YouTube
 *     category, and the channel switches to them as the step starts — and
 *     say what the run card reads while it is on;
 *   - a stream marker named after the step goes into the VOD, so the video
 *     has chapters without anybody pressing anything;
 *   - each step keeps when it started and when it finished, so the streamer
 *     can see how long things took. Only the streamer: the first paragraph
 *     still holds on stream. When the stream ends a recap is kept, and posted
 *     to Discord if asked.
 *   - how long a step took is counted only while the stream is live:
 *     nothing happens on it otherwise. A step the stream ends on keeps its
 *     time, and carries on from it when the next stream starts on it — one
 *     game played over several nights is one step, and one total.
 *
 * It answers "!plan" in chat with what is on now and what comes next, unless
 * a command of the streamer's own already answers to that word. And a plan for
 * a night that repeats can be saved whole and loaded again.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { isYoutubeCategory } from '../../shared/youtube-categories.js';
import { formatLength, liveLength } from '../../shared/plan-format.js';
import { sameGame } from '../../shared/run.js';
import * as commands from './commands.js';
import { refusal } from '../core/refusal.js';

const log = createLogger('plan');

/** What "!plan" answers, in the stream's language: chat is on stream. */
export const DEFAULT_ANSWER = { enabled: true, trigger: '!plan', text: 'Ahora: {plan.current} · Después: {plan.next}' };

export const DEFAULT_PLAN = {
  items: [],
  currentId: '',
  showDone: true,
  /** A stream marker, named after the step, each time a step starts. */
  markers: true,
  /** What "!plan" in chat says. */
  answer: DEFAULT_ANSWER,
  /** Whether the recap is posted in the Go live channel when the stream ends. */
  recapToDiscord: false,
  /** The last stream's steps and how long each took. Written by the server only. */
  recap: null,
};

/** Past this nobody reads to the bottom, on stream least of all. */
export const MAX_PLAN_ITEMS = 30;

/** Saved plans: one per kind of night, which is not many. */
export const MAX_SAVED_PLANS = 20;

/** How often "!plan" is answered at most, so a chat that all asks at once gets one answer. */
const ANSWER_EVERY_MS = 15000;

let store = null;
let saved = null;
let deps = {};
let lastAnswer = 0;

const clip = (v, max) => String(v ?? '').trim().slice(0, max);
const newId = () => Math.random().toString(36).slice(2, 11);
const goodId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

// ------------------------------------------------------------------- shape

function cleanGame(game) {
  if (!game || typeof game !== 'object') return null;
  const name = clip(game.name, 100);
  const id = /^\d{1,20}$/.test(String(game.id ?? '')) ? String(game.id) : '';
  return name || id ? { id, name } : null;
}

/**
 * What the run card reads while a step is on, held to the run card's own
 * limits — a year is four digits or nothing, as on the Game screen. A card
 * with nothing in it is no card: the step leaves the run card to the Twitch
 * category, as a step without one always has.
 */
function cleanCard(card) {
  if (!card || typeof card !== 'object') return null;
  const year = String(card.year ?? '').trim();
  const out = {
    title: clip(card.title, 80),
    platform: clip(card.platform, 30),
    year: /^[0-9]{4}$/.test(year) ? year : '',
    category: clip(card.category, 40),
    estimate: clip(card.estimate, 12),
  };
  return Object.values(out).some(Boolean) ? out : null;
}

/**
 * The run card a step puts up: its own title, or the Twitch category it
 * names, and every detail as the step has it — an empty one clears, since the
 * card is the step's. A step naming no game and no title leaves the title
 * where it is.
 */
export function cardOf(item) {
  if (!item?.card) return null;
  const title = item.card.title || item.game?.name || '';
  return {
    ...(title ? { game: title } : {}),
    platform: item.card.platform || '',
    year: item.card.year || '',
    category: item.card.category || '',
    estimate: item.card.estimate || '',
  };
}

/**
 * The card for a Twitch category that has just changed, when the step on now
 * is the one that asked for it.
 *
 * Twitch reports a category change a moment after it happens, and a change of
 * game clears the card's details — so without this, a step's card went up and
 * was wiped a second later, and a card titled "Mega Man 2" under the category
 * "Mega Man Legacy Collection" lost its title to the category's name.
 */
export function cardForCategory(categoryId, categoryName, plan = getPlan()) {
  const item = (plan.items || []).find((i) => i.id === plan.currentId);
  if (!item?.card || !item.game) return null;
  const asked = (item.game.id && String(item.game.id) === String(categoryId)) || sameGame(item.game.name, categoryName);
  return asked ? cardOf(item) : null;
}

/** What a step asks of the channel when it starts. Only what was set is kept. */
function cleanAsks(item) {
  const out = {};
  const card = cleanCard(item?.card);
  if (card) out.card = card;
  const game = cleanGame(item?.game);
  if (game) out.game = game;
  const title = clip(item?.title, 140).replace(/\s+/g, ' ');
  if (title) out.title = title;
  if (isYoutubeCategory(String(item?.youtubeCategory ?? ''))) out.youtubeCategory = String(item.youtubeCategory);
  return out;
}

/** A chat command word: "!" and a word, lower case. Anything else is the default. */
const cleanTrigger = (v) => {
  const t = String(v ?? '').trim().toLowerCase();
  return /^![^\s!]{1,29}$/.test(t) ? t : DEFAULT_ANSWER.trigger;
};

/** A stored plan with every setting present, however old the file it came from. */
export function withDefaults(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    ...DEFAULT_PLAN,
    ...p,
    items: Array.isArray(p.items) ? p.items : [],
    answer: { ...DEFAULT_ANSWER, ...(p.answer && typeof p.answer === 'object' ? p.answer : {}) },
  };
}

export const getPlan = () => withDefaults(store?.get());

/**
 * A plan as it may be stored.
 *
 * Settings a caller does not mention stay as they were; the times and the
 * recap are the server's and are never taken from a caller at all — a screen
 * sending the list back is never newer than what the stream wrote into it.
 */
export function cleanPlan(incoming, before = DEFAULT_PLAN) {
  const seen = new Set();
  const items = (Array.isArray(incoming?.items) ? incoming.items : [])
    .map((i) => ({
      id: goodId(i?.id) ? i.id : newId(),
      // Trimmed for storage; the editor holds what you type until you leave
      // the field, so this cannot fight a space being typed.
      text: clip(i?.text, 120),
      note: clip(i?.note, 200),
      done: i?.done === true,
      ...cleanAsks(i),
    }))
    .filter((i) => i.text && !seen.has(i.id) && seen.add(i.id))
    .slice(0, MAX_PLAN_ITEMS);
  /*
    A pointer at something that is no longer in the list is the same as no
    pointer, and leaving it set would mean an overlay highlighting nothing.
  */
  const currentId = items.some((i) => i.id === incoming?.currentId) ? incoming.currentId : '';
  const answer = {
    ...withDefaults(before).answer,
    ...(incoming?.answer && typeof incoming.answer === 'object' ? incoming.answer : {}),
  };
  return {
    items,
    currentId,
    showDone: incoming?.showDone !== false,
    markers: (incoming?.markers ?? before.markers) !== false,
    answer: {
      enabled: answer.enabled !== false,
      trigger: cleanTrigger(answer.trigger),
      text: clip(answer.text, 300) || DEFAULT_ANSWER.text,
    },
    recapToDiscord: (incoming?.recapToDiscord ?? before.recapToDiscord) === true,
    recap: before.recap ?? null,
  };
}

// ------------------------------------------------------------------- times

/**
 * Whether the stream is live, as OBS says (obs_stream_started / _stopped) —
 * read from the stream kept as running when the server starts mid-stream.
 */
let streaming = false;
/** When OBS last stopped: back within a few minutes is the same stream, as stream-sessions.js counts it. */
let lastStopAt = 0;
const SAME_STREAM_MS = 5 * 60_000;

const TIME_KEYS = ['startedAt', 'doneAt', 'liveMs', 'liveFrom', 'liveBase'];

/**
 * Each step's times, carried from the stored plan and moved with the mark.
 *
 * A step becoming current starts now — unless the mark came back to one that
 * was already done, which picks up where it began. A step being ticked off
 * finishes now. A step still to come has no times at all, so going back past
 * one, or starting the plan again, forgets them.
 *
 * Beside when it started and finished (what chapters and markers go by), how
 * long it has been on while live: `liveMs` kept, and `liveFrom` while it is
 * counting now. `liveBase` is what it had when this stream began counting it,
 * for this stream's recap.
 */
export function stampPlan(before, next, now = Date.now(), live = streaming) {
  const old = new Map((before?.items || []).map((i) => [i.id, i]));
  const items = next.items.map((item) => {
    const was = old.get(item.id);
    const isNow = item.id === next.currentId;
    const wasNow = Boolean(was) && item.id === before.currentId;
    let startedAt = was?.startedAt;
    let doneAt = was?.doneAt;
    let liveMs = was?.liveMs;
    let liveFrom = was?.liveFrom;
    let liveBase = was?.liveBase;
    // Leaving the mark: the time it was on while live is kept.
    if (wasNow && !isNow && typeof liveFrom === 'number') {
      liveMs = (Number(liveMs) || 0) + Math.max(0, now - liveFrom);
      liveFrom = undefined;
    }
    if (isNow && !wasNow) {
      const resumes = Boolean(was?.done && startedAt);
      startedAt = resumes ? startedAt : now;
      doneAt = undefined;
      liveMs = resumes ? Number(liveMs) || 0 : 0;
      liveFrom = live ? now : undefined;
      // Counted in this stream from here, unless it was already earlier in it.
      if (live && !(resumes && typeof liveBase === 'number')) liveBase = liveMs;
      if (!resumes && !live) liveBase = undefined;
    }
    if (item.done && !was?.done) doneAt = now;
    if (!item.done) doneAt = undefined;
    if (!item.done && !isNow) {
      startedAt = undefined;
      liveMs = undefined;
      liveFrom = undefined;
      liveBase = undefined;
    }
    const out = { ...item };
    for (const key of TIME_KEYS) delete out[key];
    if (typeof startedAt === 'number') out.startedAt = startedAt;
    if (typeof doneAt === 'number') out.doneAt = doneAt;
    if (typeof liveMs === 'number') out.liveMs = liveMs;
    if (typeof liveFrom === 'number') out.liveFrom = liveFrom;
    if (typeof liveBase === 'number') out.liveBase = liveBase;
    return out;
  });
  return { ...next, items };
}

/** The stream stopped: the step on keeps the time it was on, and stops counting. */
export function pauseLive(now = Date.now()) {
  streaming = false;
  lastStopAt = now;
  const plan = getPlan();
  if (!plan.items.some((i) => typeof i.liveFrom === 'number')) return plan;
  const items = plan.items.map((i) => {
    if (typeof i.liveFrom !== 'number') return i;
    const { liveFrom, ...rest } = i;
    return { ...rest, liveMs: (Number(i.liveMs) || 0) + Math.max(0, now - liveFrom) };
  });
  store.set({ ...plan, items });
  return publish(getPlan());
}

/**
 * The stream started: the step on carries on counting from what it has. A
 * new stream (not one back within a few minutes) begins its own recap: only
 * what is counted from here is in it.
 */
export function resumeLive(now = Date.now()) {
  const fresh = !lastStopAt || now - lastStopAt > SAME_STREAM_MS;
  const plan = getPlan();
  const current = plan.items.find((i) => i.id === plan.currentId && !i.done);
  if (streaming && (!current || typeof current.liveFrom === 'number')) return plan;
  streaming = true;
  const items = plan.items.map((i) => {
    let next = i;
    if (fresh && typeof i.liveBase === 'number') {
      const { liveBase, ...rest } = i;
      next = rest;
    }
    if (current && i.id === current.id) {
      const liveMs = Number(i.liveMs) || 0;
      next = { ...next, liveMs, liveFrom: now, ...(typeof next.liveBase === 'number' ? {} : { liveBase: liveMs }) };
    }
    return next;
  });
  store.set({ ...plan, items });
  return publish(getPlan());
}

// --------------------------------------------------------------- the mark

/**
 * Where the plan is, as one number.
 *
 * The index of the current activity; -1 before anything has started, and the
 * length of the list once everything is done. Stepping through that range is
 * what makes "done" and "back" exact opposites: finishing the last activity
 * moves to the end rather than nowhere, so going back from there brings the
 * last one back instead of the first.
 */
export function planPosition(plan) {
  const items = plan.items || [];
  const at = items.findIndex((i) => i.id === plan.currentId);
  if (at >= 0) return at;
  return items.length > 0 && items.every((i) => i.done) ? items.length : -1;
}

/** The plan with its pointer at `pos`, and everything before it done. */
export function planAt(plan, pos) {
  const items = plan.items || [];
  const to = Math.max(-1, Math.min(items.length, pos));
  return {
    ...plan,
    currentId: items[to]?.id || '',
    items: items.map((i, n) => ({ ...i, done: n < to })),
  };
}

/** Tell every surface. */
function publish(plan) {
  bus.emit(EVENTS.CONFIG, { key: 'plan', value: plan });
  return plan;
}

/**
 * Store a plan, keeping each step's times, and start whatever a step that has
 * just become current asks for. Only a change of step starts anything: editing
 * the words of the current one must not switch the category again.
 */
function write(clean) {
  const before = getPlan();
  const next = stampPlan(before, clean);
  store.set(next);
  if (next.currentId && next.currentId !== before.currentId) {
    const item = next.items.find((i) => i.id === next.currentId);
    stepStarted(item, next).catch((err) => log.warn(`plan: ${err.message}`));
    // For whatever waits on a step: a game request is played when its step starts (game-requests.js).
    bus.emit('plan:step_started', item);
  }
  return next;
}

/** A whole plan from a screen. The caller tells the surfaces. */
export const setPlan = (incoming) => write(cleanPlan(incoming, getPlan()));

/**
 * Move the pointer, marking everything before it done.
 *
 * Moving on is the common action and marking the last thing finished is
 * always what it means, so the two are one step rather than two — and going
 * back un-does the ones after, so a mis-click is one click to undo.
 */
export function goto(id) {
  const current = getPlan();
  const to = current.items.findIndex((i) => i.id === id);
  if (to < 0) return current;
  return write({ ...current, currentId: id, items: current.items.map((i, n) => ({ ...i, done: n < to })) });
}

/**
 * What an action can say about the plan: `{plan.current}` and the rest.
 * Read fresh each time, so a message after a step that moved it says where
 * it moved to.
 */
export function planVars(plan = getPlan()) {
  const items = plan.items || [];
  const pos = planPosition(plan);
  return {
    current: items[pos]?.text || '',
    next: items[pos + 1]?.text || '',
    previous: items[pos - 1]?.text || '',
    done: String(items.filter((i) => i.done).length),
    total: String(items.length),
  };
}

/** The plan as actions and the deck move it. Each move tells every surface. */
export const service = {
  /**
   * Add an activity, at the end or straight after the current one.
   *
   * "Next" before anything has started is the top of the list, and after
   * everything is done it is the end — in both cases, the next thing that
   * will happen. A full plan refuses rather than dropping something off it.
   */
  add(text, note, where) {
    const plan = getPlan();
    const items = plan.items;
    const clean = String(text ?? '').trim();
    if (!clean) return null;
    if (items.length >= MAX_PLAN_ITEMS) {
      log.warn(`plan: it already holds ${MAX_PLAN_ITEMS} activities — "${clean}" was not added`);
      return null;
    }
    const item = { id: newId(), text: clean, note: String(note ?? '').trim(), done: false };
    const at = where === 'next' ? planPosition(plan) + 1 : items.length;
    log.info(`plan: added "${clean}"${where === 'next' ? ' as the next activity' : ''}`);
    return publish(setPlan({ ...plan, items: [...items.slice(0, at), item, ...items.slice(at)] }));
  },
  /** Move by `delta` activities: +1 finishes the current one, -1 takes it back. */
  step(delta) {
    const plan = getPlan();
    if (!plan.items.length) return null;
    const from = planPosition(plan);
    const next = planAt(plan, from + delta);
    if (planPosition(next) === from) return null;
    log.info(`plan: ${delta > 0 ? 'moved on' : 'went back'} to "${(next.items.find((i) => i.id === next.currentId) || {}).text || (delta > 0 ? 'the end' : 'the start')}"`);
    return publish(setPlan(next));
  },
  vars: planVars,
};

// ------------------------------------------------- what a step asks for

/**
 * What a step that has just started asks of the channel, done in turn.
 *
 * Each part stands alone: a YouTube that is not connected must not stop the
 * Twitch category, and a stream that is not live simply gets no marker —
 * that is not worth a warning, since the plan is often moved before going live.
 * Resolves to what was done, for the log and the tests.
 */
export async function stepStarted(item, plan, d = deps) {
  if (!item) return [];
  const did = [];
  const attempt = async (what, run) => {
    try {
      await run();
      did.push(what);
    } catch (err) {
      const quiet = /not connected|no live or scheduled/i.test(err.message);
      log[quiet ? 'debug' : 'warn'](`plan: no ${what} for "${item.text}": ${err.message}`);
    }
  };
  if (item.game && d.twitch?.setCategory) await attempt('category', () => d.twitch.setCategory(item.game.id, item.game.name));
  if (item.title && d.twitch?.setTitle) await attempt('title', () => d.twitch.setTitle(item.title));
  if (item.title && d.youtube?.setTitle) await attempt('YouTube title', () => d.youtube.setTitle(item.title));
  if (item.youtubeCategory && d.youtube?.toggleCategory) {
    await attempt('YouTube category', () => d.youtube.toggleCategory(item.youtubeCategory, ''));
  }
  if (item.card && d.setCard) await attempt('run card', () => d.setCard(cardOf(item)));
  if (plan?.markers !== false && d.marker) {
    const made = await Promise.resolve(d.marker(item.text)).catch(() => null);
    if (made?.ok) did.push('marker');
  }
  if (did.length) log.info(`plan: "${item.text}" started — ${did.join(', ')}`);
  return did;
}

// ------------------------------------------------------------ !plan

/**
 * The answer to "!plan": the words set for it, with the parts that name
 * nothing left out — "Después: {plan.next}" goes when there is no next — and
 * a sentence of its own for a plan that is empty or finished.
 */
export function answerFor(plan = getPlan()) {
  if (!plan.items?.length) return 'Todavía no hay un plan para hoy.';
  const vars = planVars(plan);
  if (!vars.current && !vars.next) return '¡Ya terminamos todo lo del plan de hoy!';
  const text = withDefaults(plan).answer.text;
  const parts = text.split(/\s*[·|]\s*/).filter((part) => {
    const named = part.match(/\{plan\.(current|next|previous)\}/g) || [];
    return !named.length || named.some((n) => vars[n.slice(6, -1)]);
  });
  return parts
    .map((part) => part.replace(/\{plan\.(current|next|previous|done|total)\}/g, (_, key) => vars[key] ?? ''))
    .join(' · ')
    .trim();
}

function onChat(chat) {
  const plan = getPlan();
  if (!plan.answer.enabled || chat?.isBot) return;
  const said = String(chat?.msg ?? '').trim().toLowerCase();
  const trigger = plan.answer.trigger;
  if (said !== trigger && !said.startsWith(`${trigger} `)) return;
  // A command of the streamer's own on the same word answers instead.
  if (commands.ownCommandAnswers(collection('commands', []).get(), collection('actions', []).get(), chat.msg, chat.platform)) return;
  const now = Date.now();
  if (now - lastAnswer < ANSWER_EVERY_MS) return;
  lastAnswer = now;
  Promise.resolve(deps.twitch?.say?.(answerFor(plan), { useBot: true }))
    .catch((err) => log.warn(`plan: could not answer ${trigger}: ${err.message}`));
}

// ------------------------------------------------------------ the recap

/**
 * Each step on during this stream, and how long it was on while live — a
 * step carried over from an earlier stream with only what this one added.
 * A step from before time was counted live goes by when it started and
 * finished, as it did.
 */
export function recapOf(plan, now = Date.now()) {
  const items = (plan.items || [])
    .filter((i) => typeof i.liveBase === 'number' || (typeof i.startedAt === 'number' && typeof i.liveMs !== 'number'))
    .map((i) => ({
      text: i.text,
      ms: typeof i.liveBase === 'number' ? Math.max(0, liveLength(i, now) - i.liveBase) : Math.max(0, (i.doneAt || now) - i.startedAt),
    }));
  return items.length ? { at: now, items } : null;
}

/** The recap as a Discord post, in the stream's language. */
export function recapPost(recap, sanitise = (s) => s) {
  return ['**Resumen del directo**', ...recap.items.map((i) => `• ${sanitise(i.text)} — ${formatLength(i.ms)}`)].join('\n');
}

/** The stream stopped: keep the recap, and post it if asked. */
export async function streamEnded(d = deps, now = Date.now()) {
  // What the step on was counting stops here, before it is told.
  if (streaming) pauseLive(now);
  const plan = getPlan();
  const recap = recapOf(plan, now);
  if (!recap) return null;
  store.set({ ...plan, recap });
  publish(getPlan());
  log.info(`plan: recap kept — ${recap.items.length} step(s)`);
  if (plan.recapToDiscord && d.recapHasPlan?.()) {
    log.info('plan: the stream recap carries the plan, so it is not posted on its own');
  } else if (plan.recapToDiscord) {
    const channelId = d.announceChannel?.();
    if (!channelId) {
      log.warn('plan: the recap was not posted — choose a channel on the Go live screen');
    } else {
      await Promise.resolve(d.discord?.sendMessage?.(channelId, recapPost(recap, d.discord?.sanitise), undefined, undefined, undefined, { allowed_mentions: { parse: [] } }))
        .catch((err) => log.warn(`plan: could not post the recap: ${err.message}`));
    }
  }
  return recap;
}

// ------------------------------------------------------------ saved plans

export const getSaved = () => (saved?.get()?.items || []);

function publishSaved() {
  bus.emit(EVENTS.CONFIG, { key: 'planSaved', value: getSaved() });
}

/** The parts of a step worth saving: what it is, not where tonight got to with it. */
const keepable = (i) => ({ text: i.text, note: i.note || '', ...cleanAsks(i) });

/**
 * Save the plan under a name, load one, or forget one.
 *
 * Saving under a name that is already there replaces it, since that is what
 * saving "Among Us night" again means. Loading replaces the list and starts it
 * from the top — a saved plan is a night that has not happened yet.
 */
export function savedControl(payload = {}) {
  const list = getSaved();
  switch (payload.op) {
    case 'save': {
      const name = clip(payload.name, 60);
      if (!name) throw refusal('plan_name', 'give the plan a name');
      const plan = getPlan();
      if (!plan.items.length) throw refusal('plan_empty', 'the plan is empty');
      const existing = list.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (!existing && list.length >= MAX_SAVED_PLANS) throw refusal('plans_full', `there are already ${MAX_SAVED_PLANS} saved plans`, { n: MAX_SAVED_PLANS });
      const entry = { id: existing?.id || newId(), name, items: plan.items.map(keepable), savedAt: Date.now() };
      saved.set({ items: existing ? list.map((s) => (s.id === existing.id ? entry : s)) : [...list, entry] });
      publishSaved();
      log.info(`plan: saved "${name}" (${entry.items.length} steps)`);
      return { ok: true };
    }
    case 'load': {
      const entry = list.find((s) => s.id === payload.id);
      if (!entry) throw refusal('plan_gone', 'that saved plan is gone');
      const plan = getPlan();
      publish(setPlan({ ...plan, currentId: '', items: entry.items.map((i) => ({ ...i, id: newId(), done: false })) }));
      log.info(`plan: loaded "${entry.name}"`);
      return { ok: true };
    }
    case 'delete': {
      saved.set({ items: list.filter((s) => s.id !== payload.id) });
      publishSaved();
      return { ok: true };
    }
    default:
      throw refusal('unknown_request', `unknown saved-plan request "${payload.op}"`);
  }
}

// ------------------------------------------------------------------ wiring

function onEvent(event) {
  if (event?.type === 'obs_stream_started') resumeLive();
  if (event?.type === 'obs_stream_stopped') streamEnded().catch((err) => log.warn(`plan: ${err.message}`));
}

/**
 * OBS found already live when it connects — the stream started while the
 * server could not hear it — counts from then. Only that way: a status saying
 * not live may be one sent before OBS was asked, so stopping waits for OBS to
 * say it stopped.
 */
function onStatus(s) {
  if (s?.platform === 'obs' && s.status === 'connected' && s.streamStatus?.active && !streaming) resumeLive();
}

/**
 * On starting: live or not as the stream kept as running says, and the plan's
 * counting put right to match — a step carried over from before time was
 * counted live starts from nothing; one left counting through a stream that
 * ended while the server was off stops where that stream ended.
 */
function settleLive(now = Date.now()) {
  const session = collection('stream_live', { session: null }).get()?.session;
  streaming = Boolean(session?.startedAt && !session.endedAt);
  const plan = getPlan();
  const lastEnded = session?.endedAt || (collection('stream_sessions', { list: [] }).get()?.list || []).at(-1)?.endedAt || now;
  let changed = false;
  const items = plan.items.map((i) => {
    const isNow = i.id === plan.currentId && !i.done;
    if (isNow && typeof i.liveMs !== 'number') {
      changed = true;
      const from = streaming ? Math.max(Number(i.startedAt) || now, session.startedAt) : undefined;
      return { ...i, liveMs: 0, ...(from ? { liveFrom: from, liveBase: 0 } : {}) };
    }
    if (typeof i.liveFrom === 'number' && (!streaming || !isNow)) {
      changed = true;
      const { liveFrom, ...rest } = i;
      return { ...rest, liveMs: (Number(i.liveMs) || 0) + Math.max(0, Math.min(now, lastEnded) - liveFrom) };
    }
    return i;
  });
  if (changed) store.set({ ...plan, items });
}

/**
 * `d` is what a step starting reaches for — twitch and youtube services, a
 * marker maker, discord and the Go live channel — passed in rather than
 * imported, so the tests can hand in their own.
 */
export function initPlan(d = {}) {
  store = collection('plan', DEFAULT_PLAN);
  saved = collection('plan_saved', { items: [] });
  deps = d;
  settleLive();
  bus.on(EVENTS.CHAT, onChat);
  bus.on(EVENTS.EVENT, onEvent);
  bus.on(EVENTS.STATUS, onStatus);
}

/** For the tests: what a step starting reaches for, swapped for theirs. Returns what it replaced. */
export function useDepsForTests(d) {
  const before = deps;
  deps = d;
  return before;
}

/** For the tests: answer "!plan" again straight away. */
export function resetAnswerForTests() {
  lastAnswer = 0;
}
