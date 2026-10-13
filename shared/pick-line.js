/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * One line at random from a box holding several alternatives: write one per
 * line, and each time one of them is used. "Welcome {user}!" on one line and
 * "Look who's here, {user}!" on the next, so a shoutout or a welcome does not
 * read the same every time.
 *
 * Used wherever a text is one sentence the app sends or shows — chat steps,
 * alert captions and speech, the shoutout and clip lines, the welcome card's
 * words — and deliberately not where a line break is part of the text: a
 * go-live post, a Discord page, an embed's description, a text layer.
 *
 * A box with one line (or none) comes back untouched, whitespace and all, so
 * every text written before this behaves exactly as it did.
 */
export function pickLine(raw, random = Math.random) {
  if (typeof raw !== 'string' || !raw.includes('\n')) return raw;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return lines[0] ?? raw;
  return lines[Math.floor(random() * lines.length)];
}
