/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * An animated GIF, written: for a pixel avatar doing something, to post.
 *
 * Pixel art has few colours, so every frame shares one table of them and
 * nothing is dithered or blurred: each pixel is exactly its colour. Pixels
 * more see-through than not are left see-through. Should a picture ever
 * have more than 255 colours, the rest take the nearest of the 255 most
 * used.
 *
 *   encodeGif({ width, height, frames: [{ rgba, ms }], loop })
 *
 * rgba is a frame's pixels as a canvas's getImageData gives them. Returns
 * the file's bytes.
 */

/** GIF's own compression: LZW, codes growing from min+1 bits to 12, the table cleared when full (as omggif writes it). */
export function lzw(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let next = eoi + 1;
  let size = minCodeSize + 1;
  let table = new Map();
  const out = [];
  let cur = 0; let bits = 0;
  const emit = (code) => {
    cur |= code << bits; bits += size;
    while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i += 1) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = table.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      next = eoi + 1; size = minCodeSize + 1; table = new Map();
    } else {
      if (next >= (1 << size)) size += 1;
      table.set(key, next); next += 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) out.push(cur & 255);
  return out;
}

const word = (n) => [n & 255, (n >> 8) & 255];

export function encodeGif({ width, height, frames, loop = true }) {
  // Every colour used, by how often, and whether anything is see-through.
  const counts = new Map();
  let clear = false;
  for (const { rgba } of frames) {
    for (let p = 0; p < rgba.length; p += 4) {
      if (rgba[p + 3] < 128) { clear = true; continue; }
      const c = (rgba[p] << 16) | (rgba[p + 1] << 8) | rgba[p + 2];
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  const room = clear ? 255 : 256;
  const colours = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, room).map(([c]) => c);
  if (!colours.length) colours.push(0);
  const index = new Map(colours.map((c, i) => [c, i]));
  const nearest = (c) => {
    let best = 0; let bestD = Infinity;
    const r = c >> 16; const g = (c >> 8) & 255; const b = c & 255;
    colours.forEach((k, i) => { const d = ((k >> 16) - r) ** 2 + (((k >> 8) & 255) - g) ** 2 + ((k & 255) - b) ** 2; if (d < bestD) { bestD = d; best = i; } });
    index.set(c, best);
    return best;
  };
  const transparent = clear ? colours.length : -1;
  let bitsPerColour = 1;
  while ((1 << bitsPerColour) < colours.length + (clear ? 1 : 0)) bitsPerColour += 1;
  const tableSize = 1 << bitsPerColour;

  const bytes = [];
  const push = (...b) => { for (const x of b) bytes.push(x); };
  push(...'GIF89a'.split('').map((ch) => ch.charCodeAt(0)));
  push(...word(width), ...word(height), 0x80 | 0x70 | (bitsPerColour - 1), 0, 0);
  for (let i = 0; i < tableSize; i += 1) {
    const c = colours[i] ?? 0;
    push((c >> 16) & 255, (c >> 8) & 255, c & 255);
  }
  if (loop) push(0x21, 0xff, 0x0b, ...'NETSCAPE2.0'.split('').map((ch) => ch.charCodeAt(0)), 0x03, 0x01, 0, 0, 0);
  const minCodeSize = Math.max(2, bitsPerColour);
  for (const { rgba, ms } of frames) {
    const delay = Math.max(2, Math.round((ms || 100) / 10));
    // Each frame cleared to see-through before the next is drawn, so nothing of the last shows through its gaps.
    push(0x21, 0xf9, 0x04, ((clear ? 2 : 1) << 2) | (clear ? 1 : 0), ...word(delay), clear ? transparent : 0, 0);
    push(0x2c, 0, 0, 0, 0, ...word(width), ...word(height), 0);
    const indices = new Array(width * height);
    for (let p = 0, i = 0; p < rgba.length; p += 4, i += 1) {
      if (rgba[p + 3] < 128) { indices[i] = transparent; continue; }
      const c = (rgba[p] << 16) | (rgba[p + 1] << 8) | rgba[p + 2];
      indices[i] = index.has(c) ? index.get(c) : nearest(c);
    }
    push(minCodeSize);
    const data = lzw(indices, minCodeSize);
    for (let at = 0; at < data.length; at += 255) {
      const block = data.slice(at, at + 255);
      push(block.length, ...block);
    }
    push(0);
  }
  push(0x3b);
  return new Uint8Array(bytes);
}
