/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A short fingerprint of a stylesheet: its length and an FNV-1a hash of its
 * text, trimmed. Enough to recognise an exact copy of a look among a hundred
 * or so, without shipping every old text to every page.
 */
export function cssPrint(css) {
  const s = String(css || '').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${s.length}:${h.toString(16)}`;
}
