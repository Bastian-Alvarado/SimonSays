/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What each platform calls the same things.
 *
 * Every platform has a free relationship and a paid one, and they have swapped
 * the words. On Twitch you follow for nothing and subscribe for money. On
 * YouTube you subscribe for nothing and become a member for money. Showing
 * Twitch's words to somebody streaming to YouTube is showing them the wrong
 * word for a thing they use all day.
 *
 * So the app keeps one idea of what a thing IS, and looks up what to CALL it
 * from whichever platform it came from.
 *
 *   FREE, one click   twitch: seguidor     youtube: suscriptor   tiktok: seguidor
 *   PAYS YOU MONEY    twitch: suscriptor   youtube: miembro      tiktok: suscriptor
 *
 * The words are in Spanish, like everything else said on stream: they are
 * only ever read by captions, chat lines and posts ({words.follower}), never
 * by a screen, which says these things in its own language.
 *
 * The rule that keeps the inside honest, and the one thing in here that must
 * never be got wrong:
 *
 *   `isSub` means THIS PERSON PAYS YOU. Nothing else.
 *
 * A YouTube subscriber has paid nothing and must never set it. YouTube's
 * subscribe is this app's follow, and its membership is this app's sub. Get it
 * backwards and every free subscriber is treated as a paying one at once —
 * by permissions, by cooldowns, by the chat highlight, and by any condition
 * somebody has written against user.isSub — and none of it fails loudly.
 */

/** The free relationship, and the paid one, in each platform's own words. */
export const PLATFORMS = {
  twitch: {
    name: 'Twitch',
    colour: '#9146FF',
    words: {
      follower: 'seguidor',
      followers: 'seguidores',
      followed: 'siguió el canal',
      supporter: 'suscriptor',
      supporters: 'suscriptores',
      gift: 'sub de regalo',
      tip: 'bits',
      vip: 'VIP',
    },
  },
  youtube: {
    name: 'YouTube',
    colour: '#FF0000',
    words: {
      follower: 'suscriptor',
      followers: 'suscriptores',
      followed: 'se suscribió',
      supporter: 'miembro',
      supporters: 'miembros',
      gift: 'membresía de regalo',
      tip: 'Super Chat',
      // YouTube has no VIP. Nothing that reads this may assume there is one.
      vip: null,
    },
  },
  tiktok: {
    name: 'TikTok',
    colour: '#ff0050',
    words: {
      follower: 'seguidor',
      followers: 'seguidores',
      followed: 'siguió el canal',
      supporter: 'suscriptor',
      supporters: 'suscriptores',
      gift: 'regalo',
      tip: 'monedas',
      vip: null,
    },
  },
  discord: {
    name: 'Discord',
    colour: '#5865F2',
    words: {
      follower: 'miembro',
      followers: 'miembros',
      followed: 'se unió',
      supporter: 'booster',
      supporters: 'boosters',
      gift: 'regalo',
      tip: null,
      vip: null,
    },
  },
};

/** Every platform that carries a live chat, in the order screens list them. */
export const CHAT_PLATFORMS = ['twitch', 'youtube', 'tiktok', 'discord'];

/**
 * What `platform` calls `key`, or Twitch's word where it has none of its own.
 *
 * Falling back to Twitch rather than to nothing, because every caller here is
 * drawing a label and a blank one is worse than a near-enough one. Where a
 * platform genuinely lacks the concept the word is null on purpose — read it
 * with `has` instead and draw nothing at all.
 */
export const says = (platform, key) => {
  const words = PLATFORMS[platform]?.words;
  if (!words) return PLATFORMS.twitch.words[key] || '';
  return words[key] === undefined ? (PLATFORMS.twitch.words[key] || '') : (words[key] || '');
};

/**
 * Twitch's own colours for somebody who never chose one — what Twitch's chat
 * paints their name in — and which of them a name gets, the way Twitch picks
 * it: from its first and last letters, so a person keeps the same colour.
 *
 * YouTube and TikTok have no name colours at all, so their chatters get one
 * of these too, and read like anybody else in Twitch chat rather than all in
 * white. Who they are is still said by their rank — a member is a subscriber,
 * a moderator a moderator — the way it is for Twitch.
 */
export const DEFAULT_NAME_COLOURS = ['#FF0000', '#0000FF', '#008000', '#B22222', '#FF7F50', '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E', '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F'];

export function defaultNameColour(name) {
  const n = String(name ?? '').trim();
  if (!n) return DEFAULT_NAME_COLOURS[0];
  return DEFAULT_NAME_COLOURS[(n.charCodeAt(0) + n.charCodeAt(n.length - 1)) % DEFAULT_NAME_COLOURS.length];
}

/** Whether the platform has the concept at all — VIP on YouTube does not. */
export const has = (platform, key) => Boolean(PLATFORMS[platform]?.words?.[key]);

/** The platforms that have it, for a label that has to name them. */
export const platformsWith = (key) => CHAT_PLATFORMS
  .filter((p) => has(p, key))
  .map((p) => PLATFORMS[p].name);
