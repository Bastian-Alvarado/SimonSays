/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The house avatar: the one drawn wherever the app wants "the avatar" and
 * nobody chose one — an avatar layer that names none, somebody in the voice
 * call with no look of their own, the PNGtuber screen's preview.
 *
 * '' is the built-in one (shared/avatar.js and its art files). Anything else
 * is the id of a pixel avatar in the Pixel avatars tab, which then stands in
 * for the built-in one everywhere it would have been drawn: an edition that
 * ships without the built-in character's art names its example here.
 */
export const HOUSE_CHARACTER = 'example-sandwichxample';

/**
 * The pixel avatar to draw for `id` (a layer's character, a look's kit):
 * that one when it is in `avatars`, else the house one when there is one,
 * else null — the built-in avatar.
 */
export function kitFor(id, avatars = []) {
  const list = Array.isArray(avatars) ? avatars : [];
  const named = id ? list.find((p) => p?.id === id) : null;
  if (named) return named;
  return HOUSE_CHARACTER ? list.find((p) => p?.id === HOUSE_CHARACTER) || null : null;
}
