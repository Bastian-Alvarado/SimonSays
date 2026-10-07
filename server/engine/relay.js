/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Chat copied between the platforms, when the streamer has switched it on
 * (Connections → Chat relay).
 *
 * Into Discord: Twitch, TikTok, Kick and YouTube chat, into the channel the
 * app reads — a few lines to a post rather than a post to a line. One post
 * per message ran into Discord's limit of five posts in five seconds as soon
 * as chat got busy, and the rest queued up behind it for minutes.
 *
 * Out of Discord: what is said in that channel, to Twitch (as the bot
 * account, else the streamer's) and to YouTube. A YouTube message costs 50 of
 * the day's 10,000 units, so that one has a switch of its own and stops for
 * the day while there is still some left for the streamer's own messages.
 *
 * Nothing comes round again: Twitch's report of the bot's copy is recognised
 * and dropped (twitch.sayRelayed), YouTube's is never shown, and the bot's
 * own posts in Discord are ignored on the way in.
 */

import { bus, EVENTS } from '../core/bus.js';
import { collection } from '../core/store.js';
import { createLogger } from '../core/logger.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import * as youtube from '../platforms/youtube.js';

const log = createLogger('relay');

export const DEFAULT_RELAY = {
  twitchToDiscord: false,
  tiktokToDiscord: false,
  kickToDiscord: false,
  youtubeToDiscord: false,
  discordToTwitch: false,
  discordToYoutube: false,
};

/** Which switch lets each platform's chat into Discord. */
const INTO_DISCORD = { twitch: 'twitchToDiscord', tiktok: 'tiktokToDiscord', kick: 'kickToDiscord', youtube: 'youtubeToDiscord' };

/** How long lines gather before they go to Discord as one post. */
export const BATCH_MS = 1500;
/** Discord's 2,000 characters, with room to spare. */
const POST_MAX = 1900;
/** Twitch drops a line longer than this. */
const TWITCH_MAX = 500;
/** Gap between relayed lines on Twitch, inside its 20-in-30-seconds limit for a non-moderator. */
const TWITCH_GAP_MS = 1600;
/** Discord lines waiting for Twitch beyond this are dropped rather than arriving minutes late. */
const TWITCH_BACKLOG = 10;
/** Units of YouTube's day kept back from the relay: twenty of the streamer's own messages. */
export const YOUTUBE_RESERVE = 1000;

let relay = null;
let services = null;
let pending = [];
let timer = null;
let twitchLine = Promise.resolve();
let twitchWaiting = 0;

export function initRelay(overrides = {}) {
  relay = collection('relay_config', DEFAULT_RELAY);
  services = {
    channel: () => discord.getSettings().channelId,
    post: (channelId, text) => discord.sendMessage(channelId, text, null, null, null, { allowed_mentions: { parse: [] } }),
    sayTwitch: (text) => twitch.sayRelayed(text),
    sayYoutube: (text) => youtube.say(text, { cut: true, quiet: true }),
    youtubeLeft: () => youtube.usageToday().left,
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    ...overrides,
  };
  bus.on(EVENTS.CHAT, onChat);
}

export function stopRelay() {
  bus.off(EVENTS.CHAT, onChat);
  if (timer) clearTimeout(timer);
  timer = null;
  pending = [];
}

export const getRelay = () => ({ ...DEFAULT_RELAY, ...(relay?.get() || {}) });

function onChat(chat) {
  const cfg = getRelay();
  if (chat.platform === 'discord') { outOfDiscord(chat, cfg); return; }
  const key = INTO_DISCORD[chat.platform];
  if (!key || !cfg[key] || !chat.msg) return;
  const channelId = services.channel();
  if (!channelId) return;
  // Both the name and the message are untrusted — escape both.
  queueLine(channelId, `**[${chat.platform}] ${discord.sanitise(chat.user)}:** ${discord.sanitise(chat.msg, TWITCH_MAX)}`);
}

function queueLine(channelId, line) {
  pending.push({ channelId, line });
  if (!timer) timer = setTimeout(flush, BATCH_MS);
}

/** Everything gathered, as few posts as fit: one per channel, split only past Discord's length. */
export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  const lines = pending;
  pending = [];
  const byChannel = new Map();
  for (const { channelId, line } of lines) byChannel.set(channelId, [...(byChannel.get(channelId) || []), line]);
  for (const [channelId, all] of byChannel) {
    let post = '';
    for (const line of all) {
      if (post && post.length + 1 + line.length > POST_MAX) { send(channelId, post); post = ''; }
      post = post ? `${post}\n${line}` : line;
    }
    if (post) send(channelId, post);
  }
}

function send(channelId, text) {
  Promise.resolve(services.post(channelId, text)).catch((err) => log.warn('relay to Discord failed:', err.message));
}

function outOfDiscord(chat, cfg) {
  if (!cfg.discordToTwitch && !cfg.discordToYoutube) return;
  const words = String(chat.raw?.plain ?? chat.msg ?? '').replace(/\s+/g, ' ').trim();
  if (!words) return;
  const line = `[Discord] ${chat.user}: ${words}`;

  if (cfg.discordToTwitch) toTwitch(Array.from(line).slice(0, TWITCH_MAX).join(''));
  if (cfg.discordToYoutube) {
    if (services.youtubeLeft() < YOUTUBE_RESERVE) {
      log.debug('Discord → YouTube held back: today\'s allowance is nearly spent');
      return;
    }
    Promise.resolve(services.sayYoutube(line)).catch((err) => log.debug(`Discord → YouTube skipped: ${err.message}`));
  }
}

/** One at a time, a breath apart, so a burst in Discord does not trip Twitch's limit. */
function toTwitch(line) {
  if (twitchWaiting >= TWITCH_BACKLOG) { log.debug('Discord → Twitch backlog full; line dropped'); return; }
  twitchWaiting += 1;
  twitchLine = twitchLine
    .then(() => services.sayTwitch(line))
    .catch((err) => log.debug(`Discord → Twitch skipped: ${err.message}`))
    .then(() => services.wait(TWITCH_GAP_MS))
    .finally(() => { twitchWaiting -= 1; });
}
