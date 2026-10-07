/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A pixel avatar taken out of the app: as a file to keep or share (and
 * brought back in from one), as a picture, as a sheet of all its faces,
 * and as an animated GIF of something it does — at whole pixels of the
 * drawing, so it stays sharp.
 *
 * Pictures are drawn from the same SVG the tab draws (pixelSvg), turned
 * into pixels by the browser; the GIF is written by shared/gif.js.
 */
import { pixelSvg, pixelActionFrames, pixelColours } from '../../../shared/pixel-avatars.js';
import { encodeGif } from '../../../shared/gif.js';
import { pixelFaceName } from '../pixelNames';
import type { PixelAvatarDef } from '../../types';

export interface Look {
  faces?: string[];
  extras?: string[];
  outfit?: string;
  colours?: Record<string, string>;
  /** Screen pixels to one of the drawing's. */
  scale?: number;
  /** A colour behind it; left out, see-through. */
  background?: string | null;
}

/** A file saved to the computer, by the browser's own download. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** A name fit for a file: letters, digits and dashes. */
export const fileName = (name: string) => String(name || 'avatar').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'avatar';

/** The avatar as a file: everything it is, to keep or to bring into another SimonSays. */
export function avatarFile(kit: PixelAvatarDef): Blob {
  const { example, ...rest } = kit as any;
  return new Blob([JSON.stringify({ format: 'simonsays-pixel-avatar', version: 1, avatar: rest }, null, 1)], { type: 'application/json' });
}

/** An avatar from such a file — or a bare avatar — given a new id of its own, or an Error saying why not. */
export function avatarFromFile(text: string, id: string): any {
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('not a pixel avatar file'); }
  const avatar = data?.format === 'simonsays-pixel-avatar' ? data.avatar : data;
  if (!avatar || typeof avatar !== 'object' || !Array.isArray(avatar.parts) || !Array.isArray(avatar.base)) throw new Error('not a pixel avatar file');
  const { example, ...rest } = avatar;
  return { ...rest, id };
}

/** The avatar drawn onto a canvas, as it looks. */
async function canvasOf(kit: PixelAvatarDef, look: Look, action: { name: string; frame: number } | null = null): Promise<HTMLCanvasElement> {
  const scale = Math.max(1, Math.round(look.scale || 8));
  const svg = pixelSvg(kit, { faces: look.faces || ['neutral'], extras: look.extras || [], outfit: look.outfit || '', colours: look.colours || {}, size: 100 * scale, action }) as string;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('the picture could not be drawn'));
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    if (look.background) { ctx.fillStyle = look.background; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const pngOf = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/png'));

/** The avatar as a picture, as it looks. */
export async function avatarPicture(kit: PixelAvatarDef, look: Look): Promise<Blob> {
  return pngOf(await canvasOf(kit, look));
}

/** Every face it has, side by side, each named under it — on a background, so the names can be read. */
export async function facesSheet(kit: PixelAvatarDef, look: Look, t: any): Promise<Blob> {
  const faces = ['neutral', ...kit.faces.map((f) => f.name)];
  const scale = Math.max(1, Math.round(look.scale || 4));
  const cells = await Promise.all(faces.map((f) => canvasOf(kit, { ...look, faces: [f], scale, background: null })));
  const w = cells[0].width; const h = cells[0].height;
  const label = Math.round(scale * 6);
  const cols = Math.min(6, faces.length);
  const rows = Math.ceil(faces.length / cols);
  const pad = scale * 4;
  const sheet = document.createElement('canvas');
  sheet.width = cols * (w + pad) + pad; sheet.height = rows * (h + label + pad) + pad;
  const ctx = sheet.getContext('2d')!;
  ctx.fillStyle = look.background || '#18181b';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.imageSmoothingEnabled = false;
  ctx.font = `bold ${Math.round(label * 0.7)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e4e4e7';
  cells.forEach((c, i) => {
    const x = pad + (i % cols) * (w + pad); const y = pad + Math.floor(i / cols) * (h + label + pad);
    ctx.drawImage(c, x, y);
    ctx.fillText(pixelFaceName(kit, faces[i], t), x + w / 2, y + h + label * 0.8, w);
  });
  return pngOf(sheet);
}

/** Something it does, as an animated GIF that loops: each frame up as long as it stays up, in the outfit chosen. */
export async function actionGif(kit: PixelAvatarDef, name: string, look: Look): Promise<Blob> {
  const frames = (pixelActionFrames(kit, name, look.outfit || '') || []) as { ms: number; eyes?: string }[];
  if (!frames.length) throw new Error('it does not do that in this outfit');
  const scale = Math.max(1, Math.round(look.scale || 4));
  const drawn = await Promise.all(frames.map((f, i) => canvasOf(kit, { ...look, scale, faces: f.eyes === 'shut' ? ['neutral', 'blink'] : ['neutral'] }, { name, frame: i })));
  const { width, height } = drawn[0];
  const bytes = encodeGif({
    width, height,
    frames: drawn.map((c, i) => ({ rgba: c.getContext('2d')!.getImageData(0, 0, width, height).data, ms: frames[i].ms })),
  });
  return new Blob([bytes], { type: 'image/gif' });
}

/** Its colours for a colouring, as the Look mode shows them. */
export const lookColours = (kit: PixelAvatarDef, colouring: string, own?: string) => pixelColours(kit, colouring, { own }) as Record<string, string>;
