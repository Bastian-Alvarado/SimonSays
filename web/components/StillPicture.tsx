/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A picture shown still and no bigger than it is shown: its first frame,
 * drawn once at the size it takes on screen (twice that on a sharp screen).
 *
 * Editing a Discord page or a welcome showed the same banner several times
 * at once — the thumbnail, the editor, the preview — each a full-size
 * animated GIF or WebP the browser decoded and painted frame after frame (a
 * 1920-pixel banner of 229 frames, three times over), and an inset picture
 * of 3384 pixels square decoded whole to be shown at 266. The editor lagged
 * with it. Where the picture is only something to place things on, it does
 * not need to move; the preview, which shows what Discord will, still can.
 *
 * Every picture picker uses it the same way — the uploads to choose from
 * and the one chosen are stills, wherever pictures are picked — because
 * each of those grids showed every upload moving at full size at once.
 * What goes on stream, and the previews of it, move as they will.
 *
 * Stills are made once per picture and size and kept for the session. A
 * picture that cannot be drawn this way (another site that does not allow
 * it) is shown as it is.
 */
import React, { useEffect, useState } from 'react';

const made = new Map<string, { promise: Promise<string>; url?: string }>();

/** The still of a picture no wider than `width` CSS pixels, as an address to show. */
export function stillOf(src: string, width: number): Promise<string> {
  const scale = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const max = Math.max(16, Math.round(width * scale));
  const key = `${max}|${src}`;
  const known = made.get(key);
  if (known) return known.promise;
  const entry: { promise: Promise<string>; url?: string } = { promise: Promise.resolve(src) };
  entry.promise = (async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    const shrink = Math.min(1, max / (img.naturalWidth || max));
    const w = Math.max(1, Math.round(img.naturalWidth * shrink));
    const h = Math.max(1, Math.round(img.naturalHeight * shrink));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) return src;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92));
    return blob ? URL.createObjectURL(blob) : src;
  })().catch(() => src);
  entry.promise.then((url) => { entry.url = url; });
  made.set(key, entry);
  return entry.promise;
}

const ready = (src: string, width: number) => {
  const scale = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  return made.get(`${Math.max(16, Math.round(width * scale))}|${src}`)?.url || '';
};

/** An <img> of the still. Nothing is shown until it is made, rather than the moving original meanwhile. */
export const StillImg = ({ src, width, ...rest }: { src: string; width: number } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width'>) => {
  const [url, setUrl] = useState(() => (src ? ready(src, width) : ''));
  useEffect(() => {
    if (!src) { setUrl(''); return undefined; }
    let alive = true;
    setUrl(ready(src, width));
    stillOf(src, width).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src, width]);
  // eslint-disable-next-line jsx-a11y/alt-text
  return url ? <img {...rest} src={url} /> : null;
};

/**
 * Whether the preview's pictures move, chosen on the screen and remembered
 * by this browser. Moving by default: the preview shows what Discord will.
 */
const MOTION_KEY = 'simonsays.preview-still';
export function usePreviewStill(): [boolean, (still: boolean) => void] {
  const [still, setStill] = useState(() => {
    try { return localStorage.getItem(MOTION_KEY) === '1'; } catch { return false; }
  });
  const set = (next: boolean) => {
    setStill(next);
    try { localStorage.setItem(MOTION_KEY, next ? '1' : '0'); } catch { /* kept for this visit only */ }
  };
  return [still, set];
}
