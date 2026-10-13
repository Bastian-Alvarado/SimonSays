/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who has been talking lately, for {random.user}: "{user} hugs
 * {random.user}", a quick "!pick" among whoever is around.
 *
 * Somebody who said something on the stream's chats in the last half hour —
 * Twitch, YouTube, TikTok, Kick — and is neither the channel's bot nor the
 * streamer. Kept in memory: a restart forgets who was around, and the next
 * few messages bring them back.
 *
 * One pick per run of an action, so a message naming {random.user} twice, or
 * two steps naming it, name the same person. The person who set the action
 * off is left out of it — hugging yourself is not the joke — unless they are
 * the only one around, when it is them rather than nobody.
 */

import { bus, EVENTS } from '../core/bus.js';

/** How long somebody counts as around after they last spoke. */
export const RECENT_MS = 30 * 60_000;
const MAX = 500;
const STREAM_CHATS = new Set(['twitch', 'youtube', 'tiktok', 'kick']);

/** name, lower-cased → { name, platform, at } */
const recent = new Map();
let deps = { now: () => Date.now(), random: Math.random };

export function noteChat(chat) {
  if (!chat?.user || chat.isBot || chat.isBroadcaster || !STREAM_CHATS.has(chat.platform)) return;
  const key = String(chat.user).toLowerCase();
  recent.delete(key);
  recent.set(key, { name: chat.user, platform: chat.platform, at: deps.now() });
  // Oldest first in a Map, so the first ones out are the longest quiet.
  while (recent.size > MAX) recent.delete(recent.keys().next().value);
}

/** Everybody around now, longest quiet first. */
export function around(now = deps.now()) {
  for (const [key, c] of recent) if (now - c.at > RECENT_MS) recent.delete(key);
  return [...recent.values()];
}

/** Somebody around, not `exclude` unless nobody else is; '' when nobody at all is. */
export function pick(exclude = '') {
  const all = around();
  const others = all.filter((c) => c.name.toLowerCase() !== String(exclude).toLowerCase());
  const from = others.length ? others : all;
  if (!from.length) return exclude ? String(exclude) : '';
  return from[Math.floor(deps.random() * from.length)].name;
}

export function initChatters(d = {}) {
  deps = { ...deps, ...d };
  bus.on(EVENTS.CHAT, noteChat);
}

/** For tests: forget everybody. */
export const _test = { clear: () => recent.clear() };
