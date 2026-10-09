/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Questions from viewers, waiting to be read out.
 *
 * Games Done Quick gather interview questions ahead of time and a producer
 * picks from them; the same shape works for a Q&A segment on any stream.
 * Nothing reaches the screen without being picked, which is the entire point —
 * an unmoderated question box on stream is a dare.
 *
 * Around the queue:
 *   - "!pregunta" is answered out of the box — each person once a minute, with
 *     a word back in chat — unless a command of the streamer's own answers to
 *     the same word;
 *   - the same person asking the same thing again while it is still waiting is
 *     the one question;
 *   - a question can be edited before it goes up, and added by hand;
 *   - "Next question" marks the one up as answered and puts up the next;
 *   - a waiting question goes when a moderator deletes the message it came in,
 *     or times out the person who asked it;
 *   - and what is left when the stream ends can be kept, or cleared.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as commands from './commands.js';
import { refusal } from '../core/refusal.js';

const log = createLogger('questions');

export const DEFAULT_QUESTIONS = { items: [], showingId: '' };

/**
 * How many are kept.
 *
 * Generous, because a queue that silently stops accepting during the one
 * segment it exists for is worse than one that forgets the oldest unanswered
 * question. Dropping starts from the oldest still waiting, never from one that
 * has been approved.
 */
export const MAX_QUESTIONS = 200;
export const QUESTION_STATUSES = ['pending', 'approved', 'done', 'rejected'];

/** The built-in "!pregunta": in the stream's language, since the word back is in chat. */
export const DEFAULT_ASK = {
  enabled: true,
  trigger: '!pregunta',
  /** Per person: a queue one viewer can fill alone is not a queue. */
  cooldownSeconds: 60,
  reply: true,
  replyText: '¡Pregunta recibida, @{user}!',
};

/** keep | finished | all — what becomes of the queue when the stream ends. */
export const AT_STREAM_END = ['keep', 'finished', 'all'];

export const DEFAULT_QUESTION_SETTINGS = { ask: DEFAULT_ASK, atStreamEnd: 'keep' };

let store = null;
let settingsStore = null;
let deps = {};
/** When each person last asked through "!pregunta". */
const lastAsked = new Map();

const clip = (v, max) => String(v ?? '').trim().slice(0, max);
const newId = () => Math.random().toString(36).slice(2, 11);
/** A question as a person would compare two: case and spacing aside. */
const tidy = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const fill = (text, vars) => Object.entries(vars).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v ?? '')), String(text));

export function getQuestions() {
  const q = store?.get() || DEFAULT_QUESTIONS;
  return { items: Array.isArray(q.items) ? q.items : [], showingId: q.showingId || '' };
}

function write(next) {
  store.set(next);
  bus.emit(EVENTS.CONFIG, { key: 'questions', value: next });
  return next;
}

// ------------------------------------------------------------ settings

/**
 * One word starting with "!". Typed without it, it is added; anything that
 * still is not one word keeps the word it had.
 */
const cleanTrigger = (v, before) => {
  const t = String(v ?? '').trim().toLowerCase().replace(/^!*/, '!');
  if (/^![^\s!]{1,29}$/.test(t)) return t;
  return before ? cleanTrigger(before) : DEFAULT_ASK.trigger;
};

export function cleanSettings(incoming, before = DEFAULT_QUESTION_SETTINGS) {
  const ask = { ...DEFAULT_ASK, ...(before?.ask || {}), ...(incoming?.ask && typeof incoming.ask === 'object' ? incoming.ask : {}) };
  const seconds = Math.round(Number(ask.cooldownSeconds));
  const atStreamEnd = incoming?.atStreamEnd ?? before?.atStreamEnd;
  return {
    ask: {
      enabled: ask.enabled !== false,
      trigger: cleanTrigger(ask.trigger, before?.ask?.trigger),
      cooldownSeconds: Number.isFinite(seconds) ? Math.min(3600, Math.max(0, seconds)) : DEFAULT_ASK.cooldownSeconds,
      reply: ask.reply !== false,
      replyText: clip(ask.replyText, 200),
    },
    atStreamEnd: AT_STREAM_END.includes(atStreamEnd) ? atStreamEnd : 'keep',
  };
}

export const getSettings = () => cleanSettings(settingsStore?.get(), DEFAULT_QUESTION_SETTINGS);

export function setSettings(patch) {
  const next = cleanSettings(patch, getSettings());
  settingsStore.set(next);
  bus.emit(EVENTS.CONFIG, { key: 'questionSettings', value: next });
  return next;
}

// ------------------------------------------------------------ the queue

/**
 * A question into the queue, and whether it went in.
 *
 * The person it came from, and the chat message it came in, are kept when
 * known — so a moderator deleting the message, or timing out who sent it,
 * takes the question with it while it is still waiting.
 */
/** A Discord question's mentions by name, kept small: names only, a few of each. */
function cleanNames(names) {
  if (!names || typeof names !== 'object') return null;
  const some = (o, fn) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([id]) => /^\d{5,25}$/.test(id)).slice(0, 10).map(([id, v]) => [id, fn(v)]));
  const out = {
    users: some(names.users, (v) => String(v || '').slice(0, 64)),
    roles: some(names.roles, (v) => ({ name: String(v?.name || '').slice(0, 64), color: Number(v?.color) || 0 })),
    channels: some(names.channels, (v) => String(v || '').slice(0, 64)),
  };
  return Object.keys(out.users).length || Object.keys(out.roles).length || Object.keys(out.channels).length ? out : null;
}

export function addQuestion({ user, userId, msgId, platform, text, discord, names } = {}) {
  const clean = String(text ?? '').trim().slice(0, 280);
  const current = getQuestions();
  if (!clean) return { added: false, state: current };
  const same = current.items.find((q) => (q.status === 'pending' || q.status === 'approved')
    && tidy(q.user) === tidy(user) && tidy(q.text) === tidy(clean));
  if (same) return { added: false, state: current };

  const items = [...current.items, {
    id: newId(),
    user: clip(user, 60),
    ...(userId ? { userId: String(userId).slice(0, 64) } : {}),
    ...(msgId ? { msgId: String(msgId).slice(0, 64) } : {}),
    platform: clip(platform, 20),
    // Asked in a Discord channel: where, so the answer can go back there (discord-questions.js).
    ...(discord?.channelId && discord?.messageId ? { discord: { channelId: String(discord.channelId), messageId: String(discord.messageId) } } : {}),
    text: clean,
    // What its Discord mentions are called, for the screen; the words keep the codes.
    ...(cleanNames(names) ? { names: cleanNames(names) } : {}),
    at: Date.now(),
    status: 'pending',
  }];
  // Full: forget the oldest that is still waiting, never an approved one.
  while (items.length > MAX_QUESTIONS) {
    const oldest = items.findIndex((q) => q.status === 'pending');
    items.splice(oldest >= 0 ? oldest : 0, 1);
  }
  return { added: true, state: write({ ...current, items }) };
}

/** The same, for what only wants the queue back. */
export const add = (q) => addQuestion(q).state;

/** Approve, reject, or mark one as read out. */
export function setStatus(id, status) {
  const current = getQuestions();
  if (!QUESTION_STATUSES.includes(status)) return current;
  return write({
    ...current,
    items: current.items.map((q) => (q.id === id ? { ...q, status } : q)),
    // Something taken off the approved pile cannot still be the one on screen.
    showingId: current.showingId === id && status !== 'approved' ? '' : current.showingId,
  });
}

/** Put one on screen, or take whatever is there off it. */
export function show(id) {
  const current = getQuestions();
  const found = current.items.find((q) => q.id === id);
  // Only an approved question may go up: that is what approving is for.
  return write({ ...current, showingId: found && found.status === 'approved' ? id : '' });
}

/** Empty the queue, or just the part of it that is finished with. */
export function clear(which) {
  const current = getQuestions();
  const items = which === 'handled'
    ? current.items.filter((q) => q.status === 'pending' || q.status === 'approved')
    : [];
  return write({ items, showingId: items.some((q) => q.id === current.showingId) ? current.showingId : '' });
}

/** Change what a question says before it goes up. One already answered or turned down stays as it was. */
export function edit(id, text) {
  const clean = String(text ?? '').trim().slice(0, 280);
  const current = getQuestions();
  if (!clean) return current;
  return write({
    ...current,
    items: current.items.map((q) => (q.id === id && (q.status === 'pending' || q.status === 'approved') ? { ...q, text: clean } : q)),
  });
}

/**
 * The one up is answered; the next approved goes up — the oldest, since the
 * approved pile is read in the order it was asked. With nothing up, it puts
 * up the first. Says so when there is nothing to put up.
 */
export function next() {
  const current = getQuestions();
  const items = current.showingId
    ? current.items.map((q) => (q.id === current.showingId ? { ...q, status: 'done' } : q))
    : current.items;
  const upNext = items.find((q) => q.status === 'approved');
  if (!upNext && !current.showingId) throw refusal('no_approved_question', 'there is no approved question to put up');
  return write({ items, showingId: upNext?.id || '' });
}

// ------------------------------------------------------------ chat

/**
 * A moderator deleted a message, or timed out or banned somebody: their
 * question goes too while it is still waiting. One already approved was
 * chosen by the streamer, and stays for them to decide.
 */
function onDelete({ platform, msgIds = [], userIds = [] } = {}) {
  const msgs = new Set(msgIds.map(String));
  const users = new Set(userIds.map(String));
  if (!msgs.size && !users.size) return;
  const current = getQuestions();
  const gone = (q) => q.status === 'pending'
    && (!platform || !q.platform || q.platform === platform)
    && ((q.msgId && msgs.has(q.msgId)) || (q.userId && users.has(q.userId)));
  const items = current.items.filter((q) => !gone(q));
  if (items.length === current.items.length) return;
  log.info(`${current.items.length - items.length} waiting question(s) went with a deleted message or a timeout`);
  write({ ...current, items });
}

function onChat(chat) {
  const { ask } = getSettings();
  if (!ask.enabled || chat?.isBot) return;
  const said = String(chat?.msg ?? '').trim();
  const word = said.split(/\s+/)[0].toLowerCase();
  if (word !== ask.trigger) return;
  // A command of the streamer's own on the same word answers instead.
  if (commands.ownCommandAnswers(collection('commands', []).get(), collection('actions', []).get(), said, chat.platform)) return;
  const text = said.slice(said.split(/\s+/)[0].length).trim();
  if (!text) return;
  const who = `${chat.platform}:${chat.userId || chat.user}`.toLowerCase();
  const now = Date.now();
  if (now - (lastAsked.get(who) || 0) < ask.cooldownSeconds * 1000) return;
  lastAsked.set(who, now);
  const { added } = addQuestion({ user: chat.user, userId: chat.userId, msgId: chat.id, platform: chat.platform, text });
  if (added) log.info(`question from ${chat.user} (${ask.trigger})`);
  if (added && ask.reply && ask.replyText) answer(chat, ask);
}

/**
 * "¡Pregunta recibida!": in Discord, a reply to the message it was asked in,
 * in that channel; from anywhere else, in Twitch chat, as it always was.
 */
function answer(chat, ask) {
  const discordChat = chat.platform === 'discord' && chat.raw?.channelId;
  const name = discordChat && deps.discord?.sanitise ? deps.discord.sanitise(chat.user) : chat.user;
  const text = fill(ask.replyText, { user: name });
  const sent = discordChat
    ? deps.discord?.sendMessage?.(chat.raw.channelId, text, null, null, undefined, {
      allowed_mentions: { parse: [] },
      ...(chat.raw.messageId ? { message_reference: { message_id: chat.raw.messageId, fail_if_not_exists: false } } : {}),
    })
    : deps.twitch?.say?.(text, { useBot: true });
  Promise.resolve(sent).catch((err) => log.warn(`could not answer ${ask.trigger}: ${err.message}`));
}

/** The stream is over: keep the queue, or clear what the setting says to. */
export function streamEnded() {
  const { atStreamEnd } = getSettings();
  if (atStreamEnd === 'finished') clear('handled');
  else if (atStreamEnd === 'all') clear();
  if (atStreamEnd !== 'keep') log.info(`the stream ended — ${atStreamEnd === 'all' ? 'the queue was cleared' : 'finished questions were cleared'}`);
}

function onEvent(event) {
  if (event?.type === 'obs_stream_stopped') streamEnded();
}

// ------------------------------------------------------------ requests

/** The Questions screen's and the dock's requests beyond approving and showing. */
export function control(payload = {}) {
  switch (payload.op) {
    case 'add': {
      const { added } = addQuestion({ user: payload.user, platform: '', text: payload.text });
      if (added) return { ok: true };
      throw String(payload.text ?? '').trim()
        ? refusal('question_duplicate', 'that question is already in the queue')
        : refusal('question_empty', 'nothing to add');
      return { ok: true };
    }
    case 'edit': edit(payload.id, payload.text); return { ok: true };
    case 'next': next(); return { ok: true };
    case 'settings': return { ok: true, settings: setSettings(payload.settings) };
    default: throw refusal('unknown_request', `unknown request "${payload.op}"`);
  }
}

// ------------------------------------------------------------------ wiring

/**
 * `d.twitch.say` and `d.discord.sendMessage` answer "!pregunta". Passed in, so
 * the tests can listen.
 */
export function initQuestions(d = {}) {
  store = collection('questions', DEFAULT_QUESTIONS);
  settingsStore = collection('questions_settings', DEFAULT_QUESTION_SETTINGS);
  deps = d;
  bus.on(EVENTS.CHAT, onChat);
  /*
    And any other channel of the Discord server, as commands are (unless
    that is turned off on Connections). Only the stream's chat channel used
    to count, so "!pregunta" in #general did nothing at all. A questions
    channel takes what is posted there without the word (discord-questions.js),
    and passes over anything starting with "!" — so one asked there is not
    added twice.
  */
  bus.on('discord:message_elsewhere', (chat) => {
    if (deps.discord?.commandsEverywhere?.() === false) return;
    onChat(chat);
  });
  bus.on(EVENTS.CHAT_DELETE, onDelete);
  bus.on(EVENTS.EVENT, onEvent);
}

/** For the tests: ask again straight away. */
export function resetCooldownsForTests() {
  lastAsked.clear();
}
