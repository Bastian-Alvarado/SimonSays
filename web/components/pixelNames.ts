/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What a pixel avatar's faces, extras, outfits and actions are called on
 * screen: the label it was given in the Pixel avatars tab; failing that, the
 * built-in avatar's name for one of the same name, in either language (which
 * is how the examples, converted from it, read just as it does); failing
 * that, the name itself.
 */
import { avatarFaceNames, avatarCostumeNames, avatarHatNames, avatarActionNames } from './AvatarLayerPanel';
import type { PixelAvatarDef } from '../types';

/** Faces the built-in avatar has but never offers by name, and the face drawn half-way into a blink. */
const moreFaceNames = (t: any): Record<string, string> => ({
  'talking-soft': t.avatarFaceTalkingSoft || 'Talking softly',
  'talking-loud': t.avatarFaceTalkingLoud || 'Talking loudly',
  'blink-half': t.avatarFaceBlinkHalf || 'Eyes half shut',
});

const extraNames = (t: any): Record<string, string> => ({
  blush: t.avatarBlush || 'Blush',
  sweat: t.avatarSweat || 'Sweat drop',
  mic: t.avatarMic || 'Headset mic',
  ...avatarHatNames(t),
});

export function pixelFaceName(kit: PixelAvatarDef | null | undefined, name: string, t: any): string {
  const own = kit?.faces.find((f) => f.name === name)?.label;
  return own || avatarFaceNames(t)[name] || moreFaceNames(t)[name] || name;
}

export function pixelExtraName(kit: PixelAvatarDef | null | undefined, name: string, t: any): string {
  return kit?.extras.find((e) => e.name === name)?.label || extraNames(t)[name] || name;
}

/** '' is the outfit it was drawn in: for the built-in avatar's example, named as the built-in avatar names it. */
export function pixelOutfitName(kit: PixelAvatarDef | null | undefined, name: string, t: any): string {
  if (!name) return kit?.baseLabel || (kit?.example === 'simonsays' ? avatarCostumeNames(t)[''] : (t.pixelAsDrawn || 'As drawn'));
  return kit?.outfits.find((o) => o.name === name)?.label || avatarCostumeNames(t)[name] || name;
}

export function pixelActionLabel(kit: PixelAvatarDef | null | undefined, name: string, t: any): string {
  return kit?.actions.find((a) => a.name === name)?.label || avatarActionNames(t)[name] || name;
}

/** The faces offered to choose from: the drawing itself, then its own, without the in-between ones the living avatar uses by itself. */
export function pixelFaceChoices(kit: PixelAvatarDef): string[] {
  return ['neutral', ...kit.faces.map((f) => f.name).filter((n) => !['blink-half', 'talking-soft', 'talking-loud'].includes(n))];
}

/**
 * The part of the drawing a face thumbnail shows, as a viewBox: the built-in
 * avatar's own face crop for the SimonSays example, and for any other, the
 * head as drawn — everything above where the head ends — widened to the
 * thumbnail's shape around its middle.
 */
export function pixelFaceCrop(kit: PixelAvatarDef): string {
  if (kit.example === 'simonsays') return '22 34 48 44';
  const last = Math.min(99, Math.max(0, kit.split?.headLastRow ?? 99));
  let x0 = 100; let y0 = 100; let x1 = -1; let y1 = -1;
  kit.base.forEach((row, y) => {
    if (y > last) return;
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === '.') continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  });
  if (x1 < 0) return '0 0 100 100';
  let w = x1 - x0 + 3; let h = y1 - y0 + 3;
  // The thumbnail is 48 wide to 44 tall.
  if (w / h < 48 / 44) w = (h * 48) / 44; else h = (w * 44) / 48;
  const cx = (x0 + x1 + 1) / 2; const cy = (y0 + y1 + 1) / 2;
  return `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;
}
