/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Questions from Discord: what people post in a channel chosen for it — an
 * ideas or suggestions channel, a Q&A one — goes into the Questions dock with
 * everything asked in chat, marked 📝 so they know it is in. When it is
 * answered on stream, the bot replies to it in Discord: answered live, with a
 * link to the very moment in the VOD.
 *
 * The streamer still chooses what goes up, as with any question; nothing is
 * answered in Discord that was not answered on stream.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import * as questions from './questions.js';
import * as sessions from './stream-sessions.js';

const log = createLogger('discord-questions');

export const DEFAULT_DISCORD_QUESTIONS = { channelIds: [], answer: true, mark: true };

let store = null;
/** id → status last seen, and id → when it went up on screen. */
let known = new Map();
const shownAt = new Map();

export function cleanDiscordQuestions(c = {}) {
  return {
    channelIds: [...new Set((Array.isArray(c.channelIds) ? c.channelIds : []).map(String).filter((id) => /^\d{5,25}$/.test(id)))].slice(0, 10),
    answer: c.answer !== false,
    mark: c.mark !== false,
  };
}
export const getDiscordQuestions = () => cleanDiscordQuestions({ ...DEFAULT_DISCORD_QUESTIONS, ...(store?.get().settings || {}) });

export function setDiscordQuestions(patch) {
  const next = cleanDiscordQuestions({ ...getDiscordQuestions(), ...(patch || {}) });
  store.update((v) => ({ ...v, settings: next }));
  bus.emit(EVENTS.CONFIG, { key: 'discordQuestions', value: next });
  return next;
}

/** A message in one of the chosen channels: a question, unless it is a command, a bot's, or empty. */
function onMessage(chat) {
  const cfg = getDiscordQuestions();
  const channelId = chat?.raw?.channelId;
  if (!cfg.channelIds.includes(String(channelId)) || chat.isBot || !chat.userId) return;
  const text = String(chat.msg || '').trim();
  if (!text || /^[!?]/.test(text)) return;
  const messageId = chat.raw?.messageId || chat.id;
  const { added } = questions.addQuestion({ user: chat.user, userId: chat.userId, msgId: messageId, platform: 'discord', text, discord: { channelId, messageId }, names: chat.names });
  if (!added) return;
  log.info(`question from ${chat.user} in Discord`);
  if (cfg.mark && messageId) discord.addReaction(channelId, messageId, '📝').catch(() => {});
}

/** Where on the VOD a moment is, for the reply: the stream on now (its VOD asked of Twitch), or none. */
async function momentLink(at) {
  const s = sessions.current() || sessions.latest();
  if (!s) return '';
  if (s.vod) return sessions.vodLink(s, at);
  try {
    const vod = await twitch.latestVod?.();
    if (vod?.createdAt && Date.parse(vod.createdAt) >= s.startedAt - 10 * 60_000) return sessions.vodLink({ ...s, vod }, at);
  } catch { /* none */ }
  return '';
}

/** The reply in Discord: answered live, and where in the VOD. */
export function answerText(link, at) {
  const when = `<t:${Math.floor(at / 1000)}:f>`;
  return link ? `✅ Respondida en directo — [verlo en el VOD](${link})` : `✅ Respondida en directo (${when})`;
}

/** The queue changed: one from Discord that went up is noted; one answered is replied to, once. */
async function onQueue(state) {
  const cfg = getDiscordQuestions();
  const items = state?.items || [];
  const now = Date.now();
  for (const q of items) {
    if (!q.discord) continue;
    if (state.showingId === q.id && !shownAt.has(q.id)) shownAt.set(q.id, now);
    const was = known.get(q.id);
    known.set(q.id, q.status);
    if (q.status !== 'done' || was === 'done' || !cfg.answer) continue;
    const replied = store.get().replied || [];
    if (replied.includes(q.id)) continue;
    store.update((v) => ({ ...v, replied: [...(v.replied || []), q.id].slice(-500) }));
    // The moment it went up, or (answered without going up) a minute before it was marked.
    const at = shownAt.get(q.id) || now - 60_000;
    const link = await momentLink(at);
    discord.sendMessage(q.discord.channelId, answerText(link, at), null, null, undefined, {
      allowed_mentions: { parse: [] },
      message_reference: { message_id: q.discord.messageId, fail_if_not_exists: false },
    }).catch((err) => log.warn(`could not answer in Discord: ${err.message}`));
  }
  if (known.size > 1000) known = new Map([...known].slice(-500));
}

export const snapshot = () => ({ discordQuestions: getDiscordQuestions() });

export function initDiscordQuestions() {
  store = collection('discord_questions', { settings: DEFAULT_DISCORD_QUESTIONS, replied: [] });
  // What is in the queue already is not news.
  for (const q of questions.getQuestions().items) known.set(q.id, q.status);
  bus.on('discord:message_elsewhere', onMessage);
  bus.on(EVENTS.CHAT, (c) => { if (c?.platform === 'discord') onMessage(c); });
  bus.on(EVENTS.CONFIG, (c) => { if (c?.key === 'questions') onQueue(c.value).catch((err) => log.warn(err.message)); });
}

export const _test = { onMessage, onQueue };
