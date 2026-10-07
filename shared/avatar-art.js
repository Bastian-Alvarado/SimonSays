/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The built-in avatar's art — none in this edition.
 *
 * Every avatar here is a pixel avatar from the Pixel avatars tab, and
 * Sandwichxample stands in wherever the built-in one would have been drawn
 * (shared/house-avatar.js).
 *
 * Empty, but shaped the way the avatar engine (shared/avatar.js) reads its
 * art, so the engine loads and draws nothing for it. To give this edition
 * a built-in character of its own, draw it here in the same shapes.
 */

/** The drawing: 100 rows of 100 pixels, every one empty. */
export const AVATAR_BASE = Array.from({ length: 100 }, () => '.'.repeat(100));

/** Faces laid over it, by name: none drawn. */
export const AVATAR_EXPRESSIONS = Object.fromEntries([
  'blink', 'blink-half', 'talking', 'talking-soft', 'talking-loud', 'happy', 'surprised', 'startled', 'wink',
  'sad', 'angry', 'star-eyes', 'heart-eyes', 'dizzy', 'sleepy', 'deep-sleep',
].map((name) => [name, []]));

/** Extras over any face, by name: none drawn. */
export const AVATAR_EXTRAS = { blush: [], sweat: [], mic: [], 'party-hat': [] };

/** The fast-asleep face's nose bubble, a patch a size: none. */
export const AVATAR_BUBBLE = [];

/** Outfits other than the one it was drawn in: none. */
export const AVATAR_COSTUMES = {};

/** Every colour in the drawing: none. */
export const AVATAR_PARTS = [];

/** The outfits' names as viewers might say them: none. */
export const AVATAR_OUTFIT_WORDS = { '': [] };

/** The outfits' names as the screens show them: only the one it was drawn in. */
export const AVATAR_OUTFIT_NAMES = { '': { en: 'As drawn', es: 'Como se dibujó' } };

/** What a colour of its own colours, beside the colour picker. */
export const AVATAR_COLOUR_NAME = { en: 'Its colour', es: 'Su color' };

/** The parts that take a colour: none, and no suit. */
export const AVATAR_COLOURING = { main: '', coloured: [], eyes: [], suit: null };
