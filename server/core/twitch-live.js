/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Whether the Twitch stream is live — what TikTok and YouTube wait on
 * before they spend anything looking for a stream of their own.
 *
 * Twitch is the stream; TikTok and YouTube are where it is also sent. So
 * while Twitch is not live there is nothing to find on them, and every
 * look is a request spent from a rate limit (TikTok's signing service) or
 * a daily allowance (YouTube's) for nothing.
 *
 * Followed through what the Twitch module already says on the bus: its
 * live check every minute (the twitchLive stat), and Twitch's own stream
 * online / offline notices, the moment they happen. Three states:
 *
 *   known, live       Twitch is streaming: look
 *   known, not live   Twitch is not streaming: do not look
 *   not known         Twitch is not connected, so nobody can say: TikTok and
 *                     YouTube go on as they did before, rather than never
 *                     finding a stream because Twitch's login lapsed
 *
 * Twitch reconnecting for a moment is not "not known": only Twitch being
 * disconnected is.
 */

import { bus, EVENTS } from './bus.js';

let state = { known: false, live: false, since: 0 };
const listeners = new Set();

function set(known, live, now = Date.now()) {
  if (known === state.known && live === state.live) return;
  const wentLive = live && !state.live;
  state = { known, live, since: live ? (wentLive ? now : state.since) : 0 };
  for (const fn of listeners) {
    try { fn(state, { wentLive }); } catch { /* one listener's trouble is not the others' */ }
  }
}

bus.on(EVENTS.STAT, (s) => {
  if (s?.key === 'twitchLive') set(true, Boolean(s.value));
});
bus.on(EVENTS.STATUS, (s) => {
  // Chat dropping for a moment says disconnected too; only everything disconnected is Twitch gone.
  const d = s?.detail || {};
  if (s?.platform === 'twitch' && s.status === 'disconnected' && d.bot === 'disconnected' && d.eventsub === 'disconnected') set(false, false);
});

/** { known, live, since }: since is when it went live, 0 while it is not. */
export const twitchLive = () => state;

/** Told of every change, with whether it just went live. Returns how to stop being told. */
export function onTwitchLive(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
