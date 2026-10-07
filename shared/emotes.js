/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A Twitch message cut into its words and its emotes.
 *
 * Twitch gives each emote as a start-end range counted in whole characters,
 * the way a person counts them. A JavaScript string counts UTF-16 units
 * instead, where an emoji is two, so cutting the string at Twitch's numbers
 * slipped by one for every emoji ahead of an emote: "😀 Kappa" came out as
 * "😀", the emote, and a stray "a". Counted in whole characters, the numbers
 * line up again.
 *
 * Plain JavaScript, with no React in it, so the smoke tests can check the cut
 * itself rather than the markup built from it.
 */

/**
 * @param {string} msg
 * @param {Record<string, string[]>|undefined} emotes  Twitch's emote tag: id → ["start-end", …]
 * @returns {Array<{text: string} | {emote: string, name: string}>}  In order; an emote carries its id and the word it replaced.
 */
export function splitEmotes(msg, emotes) {
  const text = String(msg ?? '');
  if (!emotes || typeof emotes !== 'object' || Object.keys(emotes).length === 0) return [{ text }];

  const chars = Array.from(text);
  const spots = [];
  for (const [id, ranges] of Object.entries(emotes)) {
    if (!Array.isArray(ranges)) continue;
    for (const range of ranges) {
      if (typeof range !== 'string') continue;
      const [start, end] = range.split('-').map((n) => parseInt(n, 10));
      // A range that runs off the message is one this message does not have.
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= chars.length) continue;
      spots.push({ id, start, end });
    }
  }
  spots.sort((a, b) => a.start - b.start);

  const parts = [];
  let at = 0;
  for (const s of spots) {
    if (s.start < at) continue; // overlapping ranges: the first one wins
    if (s.start > at) parts.push({ text: chars.slice(at, s.start).join('') });
    parts.push({ emote: s.id, name: chars.slice(s.start, s.end + 1).join('') });
    at = s.end + 1;
  }
  if (at < chars.length) parts.push({ text: chars.slice(at).join('') });
  return parts;
}

/**
 * A Twitch emote's picture, big enough for the size it is drawn at.
 *
 * Twitch keeps three: 28, 56 and 112 pixels tall. The smallest was used
 * everywhere, so an emote drawn at 37 pixels on stream was stretched and soft.
 * This takes the smallest one at least as tall as it is drawn — taller still
 * on a screen that packs more pixels into each one.
 */
export function emoteImageUrl(id, size = 28, density = 1) {
  const need = (Number(size) || 28) * (Number(density) || 1);
  const scale = need <= 28 ? '1.0' : need <= 56 ? '2.0' : '3.0';
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/${scale}`;
}
