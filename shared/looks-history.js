/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * An applied look is a copy.
 *
 * Applying a look from the Library writes its stylesheet onto the layer (or
 * the alert), so when the look changes, nothing already wearing it follows —
 * and the old copy matches nothing the Library ships any more, so it reads
 * as a stylesheet somebody wrote by hand. Every earlier text a change
 * replaced is fingerprinted in looks-superseded.js; an exact copy of one is
 * the look, out of date, and is brought up to date wherever a layer or an
 * alert is checked. A copy somebody edited, even by a character, matches
 * nothing here and is left exactly as it is.
 */
import { ALL_PRESETS } from './css-presets.js';
import { SUPERSEDED } from './looks-superseded.js';
import { cssPrint } from './looks-print.js';

const NOW = new Map(ALL_PRESETS.map((p) => [p.id, p.css]));

/** Which look an out-of-date copy is, or null for anything else. */
export const supersededLook = (css) => {
  if (!String(css || '').trim()) return null;
  const id = SUPERSEDED[cssPrint(css)];
  return id && NOW.has(id) ? id : null;
};

/** The stylesheet as it should be now: the look's current text for an old copy of it, otherwise as it was. */
export const currentLook = (css) => {
  const id = supersededLook(css);
  return id ? NOW.get(id) : css;
};

const LOOK_KEYS = ['css', 'motionCss'];

/**
 * A layer or an alert with every old copy of a look in it at the look's
 * current text — its own, and a chat layer's, which sits in its settings.
 * Nothing else about it changes, and one with nothing out of date comes
 * back as it was.
 *
 * For a saved profile: the live layers are brought up to date by the same
 * validation that saves them, and a saved copy left behind would read as an
 * unsaved change that nobody made.
 */
export const looksNow = (item) => {
  if (!item || typeof item !== 'object') return item;
  let next = item;
  for (const k of LOOK_KEYS) if (supersededLook(next[k])) next = { ...next, [k]: currentLook(next[k]) };
  const cfg = next.config;
  if (cfg && typeof cfg === 'object' && LOOK_KEYS.some((k) => supersededLook(cfg[k]))) {
    next = { ...next, config: Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, LOOK_KEYS.includes(k) ? currentLook(v) : v])) };
  }
  return next;
};
