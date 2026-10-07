/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A drawn picture read back into pixels, for the Pixel avatars tab: a sheet
 * of frames or hats drawn elsewhere — often a photo or a JPEG, at a pixel
 * size of its own — turned into rows of the avatar's colours.
 *
 * It is what was done by hand for the built-in hats and the glass of water
 * (see the notes in shared/avatar-hats.js and avatar-actions.js): a part of
 * the picture chosen, a grid laid over it at the drawing's own pixel size,
 * each cell read from its middle — the median of what is there, which the
 * smear a JPEG leaves at a cell's edges does not move — the background left
 * empty, and each colour matched to one the avatar has, or kept as a new
 * one.
 *
 * Images arrive as { width, height, data }, data the RGBA bytes a canvas's
 * getImageData gives, so this runs the same in the browser and in a test.
 */

/**
 * The colour of every cell of a grid laid over part of an image.
 *
 *   region   { x, y, w, h } in image pixels: the part of the picture to read
 *   across   how many of the drawing's pixels that part is wide
 *   shift    { x, y }: the grid nudged by a fraction of a cell, to line it up
 *            with the picture's own pixels
 *
 * Rows come back as arrays of [r, g, b, a], or null for a cell that falls
 * outside the image. Cells are read from their middle 60%, as the median of
 * each channel.
 */
export function sampleCells(image, region, across, shift = { x: 0, y: 0 }) {
  const cols = Math.max(1, Math.round(across));
  const cell = region.w / cols;
  const rows = Math.max(1, Math.round(region.h / cell));
  const out = [];
  for (let j = 0; j < rows; j += 1) {
    const row = [];
    for (let i = 0; i < cols; i += 1) {
      const x0 = region.x + (i + (shift.x || 0)) * cell;
      const y0 = region.y + (j + (shift.y || 0)) * cell;
      // A cell under three image pixels across has no middle to speak of: its centre pixel alone is read.
      const inset = cell * 0.2;
      const xs = []; const ys = [];
      // An image pixel counts when its own middle is inside the cell's: one straddling the edge is the smear.
      if (cell >= 3) {
        for (let y = Math.ceil(y0 + inset - 0.5); y <= Math.floor(y0 + cell - inset - 0.5); y += 1) ys.push(y);
        for (let x = Math.ceil(x0 + inset - 0.5); x <= Math.floor(x0 + cell - inset - 0.5); x += 1) xs.push(x);
      }
      if (!xs.length) xs.push(Math.floor(x0 + cell / 2));
      if (!ys.length) ys.push(Math.floor(y0 + cell / 2));
      const seen = [[], [], [], []];
      for (const y of ys) {
        if (y < 0 || y >= image.height) continue;
        for (const x of xs) {
          if (x < 0 || x >= image.width) continue;
          const k = (y * image.width + x) * 4;
          for (let c = 0; c < 4; c += 1) seen[c].push(image.data[k + c]);
        }
      }
      if (!seen[0].length) { row.push(null); continue; }
      row.push(seen.map((vals) => { vals.sort((a, b) => a - b); return vals[vals.length >> 1]; }));
    }
    out.push(row);
  }
  return out;
}

// --------------------------------------------------------------- colours

const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
export const hexRgb = (hex) => { const n = Number.parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** A colour as CIE Lab, where distance is about how different two colours look. */
function lab([r, g, b]) {
  const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);
  const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const distance = (a, b) => { const p = lab(a); const q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/** Whether a cell is background: see-through, or within `tolerance` (a Lab distance) of the background colour given. */
export function isBackground(rgba, { background = null, tolerance = 12 } = {}) {
  if (!rgba || rgba[3] < 128) return true;
  return Boolean(background) && distance(rgba, hexRgb(background)) <= tolerance;
}

/** The part whose colour looks nearest. */
export function nearestPart(rgba, parts) {
  let best = null; let bestD = Infinity;
  for (const p of parts) {
    const d = distance(rgba, hexRgb(p.color));
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}

/**
 * The colours a picture is drawn in, at most `most` of them: the cells'
 * colours gathered into groups of ones that look alike (within `alike`),
 * the biggest groups first, each as its middle colour. JPEG speckle gathers
 * into the colour it was a speck of.
 */
export function pictureColours(cells, { most = 16, alike = 10, background = null, tolerance = 12 } = {}) {
  const groups = [];
  for (const row of cells) {
    for (const c of row) {
      if (isBackground(c, { background, tolerance })) continue;
      let g = groups.find((x) => distance(x.colour, c) <= alike);
      if (!g) { g = { colour: c, members: [] }; groups.push(g); }
      g.members.push(c);
    }
  }
  for (const g of groups) {
    const mid = [0, 1, 2].map((k) => { const v = g.members.map((m) => m[k]).sort((a, b) => a - b); return v[v.length >> 1]; });
    g.colour = [...mid, 255];
  }
  return groups.sort((a, b) => b.members.length - a.members.length).slice(0, most).map((g) => toHex(g.colour));
}

/**
 * A picture's cells as rows of the avatar's characters: each cell its
 * nearest part, background '.', ready to place on the canvas.
 */
export function cellsToRows(cells, parts, { background = null, tolerance = 12 } = {}) {
  return cells.map((row) => row.map((c) => (isBackground(c, { background, tolerance }) ? '.' : nearestPart(c, parts)?.char || '.')).join(''));
}

/**
 * Rows placed on a grid with their top-left at (x, y), as a stroke: every
 * pixel of the picture painted, and its empty ones — when `clear` — cleared,
 * otherwise left as they were.
 */
export function placeRows(rows, x, y, { clear = false } = {}) {
  const out = [];
  rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === '.' && !clear) return;
    out.push([x + i, y + j, c === '.' ? '_' : c]);
  }));
  return out;
}
