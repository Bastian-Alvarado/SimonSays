/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * "!rank" and "!top" in chat: where somebody stands, and who leads.
 *
 * Answered where it was asked — Twitch (as the bot), YouTube, or the Discord
 * channel it was typed in, any channel of the server — and nowhere for a
 * platform the app cannot write to (TikTok). YouTube can be left out: an
 * answer there costs 50 of its 10,000 units a day.
 *
 * "!rank Ana" asks about somebody else. A command of the streamer's own on
 * the same word answers instead, as with "!plan". Each person is answered at
 * most every half minute per word, and each chat at most every two seconds,
 * so a chat that all asks at once does not bury itself in answers.
 */

import { bus, EVENTS } from '../core/bus.js';
import { collection } from '../core/store.js';
import { createLogger } from '../core/logger.js';
import * as commands from '../engine/commands.js';
import * as leveling from './index.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import * as youtube from '../platforms/youtube.js';

const log = createLogger('level-chat');

export const PERSON_EVERY_MS = 30_000;
export const CHAT_EVERY_MS = 2_000;

let services = null;
const asked = new Map();
const answered = new Map();

export function initLevelChat(overrides = {}) {
  services = {
    twitch: (text) => twitch.say(text, { useBot: true }),
    youtube: (text) => youtube.say(text, { cut: true }),
    discord: (text, chat) => discord.sendMessage(chat.raw?.channelId, text, null, null, null, {
      allowed_mentions: { parse: [] },
      ...(chat.raw?.messageId ? { message_reference: { message_id: chat.raw.messageId, fail_if_not_exists: false } } : {}),
    }),
    now: () => Date.now(),
    ...overrides,
  };
  bus.on(EVENTS.CHAT, onChat);
  bus.on('discord:message_elsewhere', onChat);
}

export function stopLevelChat() {
  bus.off(EVENTS.CHAT, onChat);
  bus.off('discord:message_elsewhere', onChat);
  asked.clear();
  answered.clear();
}

/** Somebody's name as the chat it goes to shows it: Discord would read markdown in it. */
const nameFor = (platform, name) => (platform === 'discord' ? discord.sanitise(name) : String(name ?? ''));

/**
 * The answer to "!rank": the words set for it, filled in. For somebody who
 * is not ranked — the channel's own accounts — the parts naming a place are
 * left out, the way "!plan" leaves out a step there is not.
 */
export function rankAnswer(person, platform, words = leveling.getConfig().chat) {
  const name = nameFor(platform, person.username);
  const place = leveling.rankOf(person.id);
  const next = leveling.xpForLevel((person.level || 0) + 1) - (person.xp || 0);
  const vars = {
    user: name,
    level: String(person.level || 0),
    xp: (person.xp || 0).toLocaleString('es-MX'),
    rank: place ? String(place.rank) : '',
    total: place ? String(place.total) : '',
    next: Math.max(0, next).toLocaleString('es-MX'),
  };
  return words.rankText
    .split(/\s*·\s*/)
    .filter((part) => place || !/\{(rank|total)\}/.test(part))
    .map((part) => part.replace(/\{(user|level|xp|rank|total|next)\}/g, (_, key) => vars[key]))
    .join(' · ')
    .trim();
}

/** The answer to "!top": the first few by XP, one after another. */
export function topAnswer(platform, words = leveling.getConfig().chat) {
  const board = leveling.leaderboard(words.topCount);
  if (!board.length) return 'Todavía nadie tiene XP.';
  const top = board.map((u, i) => `${i + 1}. ${nameFor(platform, u.username)} (nv ${u.level || 0})`).join(' · ');
  return words.topText.replace(/\{count\}/g, String(board.length)).replace(/\{top\}/g, top);
}

function onChat(chat) {
  const words = leveling.getConfig().chat;
  if (!words?.enabled || !chat || chat.isBot) return;
  const said = String(chat.msg ?? '').trim();
  const first = said.split(/\s+/)[0].toLowerCase();
  const which = first === words.rankWord.toLowerCase() ? 'rank' : first === words.topWord.toLowerCase() ? 'top' : null;
  if (!which) return;
  const answer = services[chat.platform];
  if (!answer || (chat.platform === 'youtube' && !words.youtube)) return;
  // A command of the streamer's own on the same word answers instead.
  if (commands.ownCommandAnswers(collection('commands', []).get(), collection('actions', []).get(), said, chat.platform)) return;

  const now = services.now();
  const who = `${chat.platform}:${chat.userId || chat.user}:${which}`;
  if (now - (asked.get(who) || 0) < PERSON_EVERY_MS) return;
  if (now - (answered.get(chat.platform) || 0) < CHAT_EVERY_MS) return;
  asked.set(who, now);
  answered.set(chat.platform, now);
  if (asked.size > 500) for (const [key, at] of asked) if (now - at > PERSON_EVERY_MS) asked.delete(key);

  let text;
  if (which === 'top') {
    text = topAnswer(chat.platform, words);
  } else {
    const named = said.split(/\s+/).slice(1).join(' ');
    const person = named ? leveling.findByName(named) : leveling.findUser(chat.platform, chat.userId || chat.user);
    text = person
      ? rankAnswer(person, chat.platform, words)
      : `${nameFor(chat.platform, named.replace(/^@/, '') || chat.user)} todavía no tiene XP.`;
  }
  Promise.resolve(answer(text, chat)).catch((err) => log.debug(`could not answer ${first} on ${chat.platform}: ${err.message}`));
}
