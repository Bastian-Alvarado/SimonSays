/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The giveaway's rules, shared: what the Giveaways screen may set and the
 * server keeps, and how winners are drawn. Here, without the server, so the
 * screen and the tests read the same rules.
 */

export const GIVEAWAY_PLATFORMS = ['twitch', 'youtube', 'tiktok', 'kick', 'discord'];

export const DEFAULT_GIVEAWAY_RULES = {
  /** Only subscribers (Twitch subs, YouTube members, TikTok subs, Discord members with a subscriber role). */
  subsOnly: false,
  /** Only people at this level or above (Levels & XP). 0 is anyone. */
  minLevel: 0,
  /** How many tickets a subscriber gets, 1 to 5. */
  subLuck: 1,
  /** A role a Discord entrant must have, by id. Empty is any. */
  discordRole: '',
  /** Where entries are taken from. */
  platforms: GIVEAWAY_PLATFORMS,
};

/** The most entries one giveaway keeps. */
export const MAX_ENTRANTS = 5000;
export const MAX_WINNERS = 10;
/** The longest a giveaway may run on its own clock; 0 is until it is closed. */
export const MAX_GIVEAWAY_MS = 2 * 3_600_000;

export const cleanPrize = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);

/** One word to type, starting with "!" so it reads as a command: "!sorteo". */
export function cleanKeyword(v, fallback = '!sorteo') {
  const word = String(v ?? '').trim().split(/\s+/)[0].toLowerCase().slice(0, 30);
  if (!word) return fallback;
  return word.startsWith('!') ? word : `!${word}`;
}

export function cleanDuration(v) {
  const n = Math.round(Number(v) || 0);
  if (n <= 0) return 0;
  return Math.min(MAX_GIVEAWAY_MS, Math.max(30_000, n));
}

export const cleanWinners = (v) => Math.min(MAX_WINNERS, Math.max(1, Math.round(Number(v) || 1)));

export function cleanRules(r = {}) {
  const level = Math.round(Number(r.minLevel) || 0);
  const luck = Math.round(Number(r.subLuck) || 1);
  const platforms = Array.isArray(r.platforms) ? r.platforms.filter((p) => GIVEAWAY_PLATFORMS.includes(p)) : GIVEAWAY_PLATFORMS;
  return {
    subsOnly: r.subsOnly === true,
    minLevel: Math.min(500, Math.max(0, level)),
    subLuck: Math.min(5, Math.max(1, luck)),
    discordRole: /^\d{5,25}$/.test(String(r.discordRole ?? '')) ? String(r.discordRole) : '',
    platforms: platforms.length ? [...new Set(platforms)] : GIVEAWAY_PLATFORMS,
  };
}

/**
 * Draw `count` winners from the entrants, each by their tickets, leaving out
 * anybody already drawn. `random` is passed in so a draw can be tested.
 */
export function pickWinners(entrants, count = 1, exclude = [], random = Math.random) {
  const out = new Set(exclude);
  const pool = Object.entries(entrants || {}).filter(([key]) => !out.has(key));
  const picked = [];
  while (picked.length < count && pool.length) {
    const total = pool.reduce((sum, [, e]) => sum + Math.max(1, Number(e.tickets) || 1), 0);
    let roll = random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= Math.max(1, Number(pool[i][1].tickets) || 1);
      if (roll < 0) { index = i; break; }
    }
    const [key, e] = pool.splice(index, 1)[0];
    picked.push({ key, ...e });
  }
  return picked;
}
