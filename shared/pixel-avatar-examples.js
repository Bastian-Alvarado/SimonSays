/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The examples in the Pixel avatars tab: in this edition, Sandwichxample
 * alone (shared/sandwichxample.js) — a pixel avatar with every face, extra,
 * hat, outfit and action the format holds, to start a drawing of your own
 * from and to check the format against.
 *
 * Seeded into the tab once, on the first start; edited, it stays edited,
 * and "put it back" brings it back as it is here.
 */

import { SANDWICHXAMPLE } from './sandwichxample.js';

const copy = (v) => JSON.parse(JSON.stringify(v));

/** Sandwichxample, afresh: a copy, so nothing done to it reaches this one. */
export function sandwichxampleExample() {
  return copy(SANDWICHXAMPLE);
}

/** Every example, in the order the tab lists them. */
export function pixelAvatarExamples() {
  return [sandwichxampleExample()];
}

/** One example afresh, by the one it was made from: to put it back as it was. */
export function pixelAvatarExample(example) {
  return example === 'sandwichxample' ? sandwichxampleExample() : null;
}
