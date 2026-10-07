/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What may be uploaded, and how big each kind may be — one list for the
 * server, which enforces it, and the screen, which says so before sending a
 * file that would only be turned away.
 *
 * Was images only, which quietly broke two things an alert needs: a sound to
 * play, and a transparent webm, which is what an alert people actually notice
 * is usually made of. The caps differ by kind because a 25MB png is a mistake
 * while a 25MB video clip is ordinary.
 */
export const ASSET_KINDS = {
  /*
    Half what Discord takes from a bot, on purpose: a picture is shown far
    smaller than a big file is drawn, and a banner with words on it is drawn
    again at 1100 pixels across at most anyway.
  */
  image: { exts: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'], max: 5 * 1024 * 1024 },
  audio: { exts: ['.mp3', '.ogg', '.wav', '.m4a'], max: 10 * 1024 * 1024 },
  video: { exts: ['.webm', '.mp4'], max: 25 * 1024 * 1024 },
  /*
    A typeface is what makes an overlay look like somebody's rather than like
    this app's. Small on purpose: a woff2 of a display face is tens of
    kilobytes, and anything approaching this cap is a whole family in one
    file, which an overlay does not need.
  */
  font: { exts: ['.woff2', '.woff', '.ttf', '.otf'], max: 2 * 1024 * 1024 },
};

/** Which kind a file name's extension belongs to, or null if it is not accepted. */
export function assetKindOf(name) {
  const m = /\.[^.]+$/.exec(String(name || '').toLowerCase());
  if (!m) return null;
  for (const [kind, spec] of Object.entries(ASSET_KINDS)) if (spec.exts.includes(m[0])) return kind;
  return null;
}
