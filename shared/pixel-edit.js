/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Editing a pixel avatar (shared/pixel-avatars.js) a stroke at a time: what
 * the Pixel avatars tab's drawing canvas shows for whatever is being drawn,
 * and what each stroke does to the avatar.
 *
 * Something drawn is either a whole drawing — the avatar as drawn, an
 * outfit — or patches over one: a face, an extra, a frame of something it
 * does. A whole drawing is changed pixel for pixel. Patches are changed
 * where the stroke lands and nowhere else:
 *
 *   - a pixel inside one of its patches is changed in that patch (the last
 *     one over it, which is the one that shows);
 *   - pixels outside every patch become a new patch, just big enough to hold
 *     them, every other pixel in it '.' — so it paints only what was drawn;
 *   - "back to what is under it" puts '.' in every patch over the pixel.
 *
 * So a face drawn once keeps every pixel it had and gains only what was
 * drawn: the examples, converted from the built-in avatar, stay exactly as
 * they were wherever nobody drew. A region — a box the whole of which a
 * face replaces, the way the built-in faces each replace a whole eye or
 * mouth so one laid over another takes its place — is made on purpose,
 * with regionPatch.
 *
 * Every function takes an avatar and hands back a new one; nothing is
 * changed in place, so the tab can keep the old one to undo to.
 */

import { pixelGrid, PIXEL_SIZE, pixelCharOk, PIXEL_NAME } from './pixel-avatars.js';
import { hexToHsl, hslToHex } from './avatar.js';

const copy = (v) => JSON.parse(JSON.stringify(v));
const blankRows = () => Array.from({ length: PIXEL_SIZE }, () => '.'.repeat(PIXEL_SIZE));
const inGrid = (x, y) => x >= 0 && y >= 0 && x < PIXEL_SIZE && y < PIXEL_SIZE;

/**
 * What can be drawn, as a target:
 *   { kind: 'base' }                        the avatar as drawn
 *   { kind: 'outfit', name }                an outfit, whole
 *   { kind: 'face', name }                  patches over the drawing
 *   { kind: 'extra', name }                 patches over the drawing
 *   { kind: 'frame', action, outfit, index } a frame of something it does, over that outfit at rest
 *   { kind: 'front' }                       the front view of one that turns, whole
 *   { kind: 'front-face', name }            patches over the front view
 *   { kind: 'front-outfit', name }          an outfit from the front, whole
 *   { kind: 'front-extra', name }           an extra from the front, patches over the front view
 */
export const isWhole = (target) => ['base', 'outfit', 'front', 'front-outfit'].includes(target?.kind);

/** The list a target's patches live in, or null for a whole drawing or one that is not there. */
function patchesOf(pa, target) {
  if (target.kind === 'face') return pa.faces.find((f) => f.name === target.name)?.patches ?? null;
  if (target.kind === 'extra') return pa.extras.find((e) => e.name === target.name)?.patches ?? null;
  if (target.kind === 'front-face') return pa.turn?.front?.faces.find((f) => f.name === target.name)?.patches ?? null;
  if (target.kind === 'front-extra') return pa.turn?.front?.extras?.find((e) => e.name === target.name)?.patches ?? null;
  if (target.kind === 'frame') return pa.actions.find((a) => a.name === target.action)?.outfits?.[target.outfit || '']?.[target.index]?.patches ?? null;
  const own = pa.outfits.find((o) => o.name === target.outfit)?.ownFace;
  if (target.kind === 'own-glasses') return own ? own.glasses : null;
  if (target.kind === 'own-face') return own ? own.faces[target.name] || [] : null;
  return null;
}

/** The same avatar with a target's patches replaced. */
function withPatches(pa, target, patches) {
  const next = copy(pa);
  if (target.kind === 'face') next.faces.find((f) => f.name === target.name).patches = patches;
  if (target.kind === 'extra') next.extras.find((e) => e.name === target.name).patches = patches;
  if (target.kind === 'front-face') next.turn.front.faces.find((f) => f.name === target.name).patches = patches;
  if (target.kind === 'front-extra') next.turn.front.extras.find((e) => e.name === target.name).patches = patches;
  if (target.kind === 'frame') next.actions.find((a) => a.name === target.action).outfits[target.outfit || ''][target.index].patches = patches;
  const own = next.outfits.find((o) => o.name === target.outfit)?.ownFace;
  if (own && target.kind === 'own-glasses') own.glasses = patches;
  if (own && target.kind === 'own-face') { if (patches.length) own.faces[target.name] = patches; else delete own.faces[target.name]; }
  return next;
}

function wholeRows(pa, target) {
  if (target.kind === 'base') return pa.base;
  if (target.kind === 'outfit') return pa.outfits.find((o) => o.name === target.name)?.rows ?? null;
  if (target.kind === 'front') return pa.turn?.front?.base ?? null;
  if (target.kind === 'front-outfit') return pa.turn?.front?.outfits?.find((o) => o.name === target.name)?.rows ?? null;
  return null;
}

function withRows(pa, target, rows) {
  const next = copy(pa);
  if (target.kind === 'base') next.base = rows;
  if (target.kind === 'outfit') next.outfits.find((o) => o.name === target.name).rows = rows;
  if (target.kind === 'front') next.turn.front.base = rows;
  if (target.kind === 'front-outfit') next.turn.front.outfits.find((o) => o.name === target.name).rows = rows;
  return next;
}

/**
 * What a target is drawn over: nothing, for a whole drawing; the drawing as
 * drawn, for a face or an extra; the front view, for a face of it; and the
 * outfit at rest — its eyes shut if the frame shuts them — for a frame.
 */
export function beneath(pa, target) {
  if (isWhole(target)) return blankRows();
  if (target.kind === 'front-face' || target.kind === 'front-extra') return copy(pa.turn?.front?.base || blankRows());
  // An extra can be drawn over one of the outfits, to see it as it is worn there: the hair a hat hides in it.
  if (target.kind === 'extra' && target.outfit) return pixelGrid(pa, { faces: ['neutral'], outfit: target.outfit });
  if (target.kind === 'frame') {
    const frame = pa.actions.find((a) => a.name === target.action)?.outfits?.[target.outfit || '']?.[target.index];
    return pixelGrid(pa, { faces: frame?.eyes === 'shut' ? ['neutral', 'blink'] : ['neutral'], outfit: target.outfit || '' });
  }
  /*
    An outfit's own face: what the face looks like on the outfit without
    it — the face as drawn, kept out of its own face's box — and its own
    glasses, laid over everything last, left off to draw under.
  */
  if (target.kind === 'own-glasses' || target.kind === 'own-face') {
    const bare = copy(pa);
    const own = bare.outfits.find((o) => o.name === target.outfit)?.ownFace;
    if (!own) return copy(pa.base);
    own.glasses = [];
    if (target.kind === 'own-face') own.faces[target.name] = [];
    return pixelGrid(bare, { faces: target.kind === 'own-face' ? [target.name] : ['neutral'], outfit: target.outfit });
  }
  return copy(pa.base);
}

/** Patches laid over rows, as the drawing lays them: '.' keeps, '_' clears. */
export function layPatches(rows, patches) {
  const grid = rows.map((r) => r.split(''));
  for (const { at: [x0, y0], rows: prow } of patches || []) {
    prow.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx += 1) {
        const c = row[dx];
        const x = x0 + dx; const y = y0 + dy;
        if (c === '.' || !inGrid(x, y)) continue;
        grid[y][x] = c === '_' ? '.' : c;
      }
    });
  }
  return grid.map((r) => r.join(''));
}

/** What the canvas shows for a target: the whole drawing, or its patches laid over what they go over. */
export function composed(pa, target) {
  const whole = wholeRows(pa, target);
  if (whole) return copy(whole);
  return layPatches(beneath(pa, target), patchesOf(pa, target) || []);
}

/** The boxes of a target's patches, to outline on the canvas: [x0, y0, x1, y1], inclusive. */
export function patchBoxes(pa, target) {
  return (patchesOf(pa, target) || []).map(({ at: [x, y], rows }) => [x, y, x + Math.max(0, ...rows.map((r) => r.length)) - 1, y + rows.length - 1]);
}

/**
 * A stroke, applied: `cells` is a list of [x, y, value], value a part's char,
 * '_' for nothing there, or '.' for back to what is under it (on a whole
 * drawing: nothing; on an outfit: the drawing as drawn).
 */
export function paint(pa, target, cells) {
  const whole = wholeRows(pa, target);
  if (whole) {
    const grid = whole.map((r) => r.split(''));
    for (const [x, y, v] of cells) {
      if (!inGrid(x, y)) continue;
      // Back to what is under it: on an outfit, the drawing as drawn — from the front, the front view.
      grid[y][x] = v === '_' ? '.' : v === '.' ? (target.kind === 'outfit' ? pa.base[y][x] : target.kind === 'front-outfit' ? pa.turn.front.base[y][x] : '.') : v;
    }
    return withRows(pa, target, grid.map((r) => r.join('')));
  }
  const patches = patchesOf(pa, target);
  if (!patches) return pa;
  const out = patches.map((p) => ({ at: [...p.at], rows: p.rows.map((r) => r.split('')) }));
  const under = beneath(pa, target);
  const covering = (x, y) => out.filter((p) => y >= p.at[1] && y < p.at[1] + p.rows.length && x >= p.at[0] && x < p.at[0] + (p.rows[y - p.at[1]]?.length ?? 0));
  const loose = [];
  for (const [x, y, v] of cells) {
    if (!inGrid(x, y)) continue;
    const over = covering(x, y);
    if (v === '.') {
      for (const p of over) p.rows[y - p.at[1]][x - p.at[0]] = '.';
      continue;
    }
    if (over.length) {
      const p = over[over.length - 1];
      p.rows[y - p.at[1]][x - p.at[0]] = v;
      continue;
    }
    // Outside every patch, painting what is there already changes nothing: no patch for it.
    const shown = under[y][x];
    if ((v === '_' && shown === '.') || v === shown) continue;
    loose.push([x, y, v]);
  }
  if (loose.length) {
    const xs = loose.map(([x]) => x); const ys = loose.map(([, y]) => y);
    const x0 = Math.min(...xs); const y0 = Math.min(...ys);
    const rows = Array.from({ length: Math.max(...ys) - y0 + 1 }, () => Array(Math.max(...xs) - x0 + 1).fill('.'));
    for (const [x, y, v] of loose) rows[y - y0][x - x0] = v;
    out.push({ at: [x0, y0], rows });
  }
  const kept = out
    .map((p) => ({ at: p.at, rows: p.rows.map((r) => r.join('')) }))
    // A patch left with nothing in it paints nothing: gone.
    .filter((p) => p.rows.some((r) => /[^.]/.test(r)));
  return withPatches(pa, target, kept);
}

/**
 * A region: a box the whole of which this face replaces, as it is drawn now
 * — what shows in it painted, what is empty cleared — so laid over another
 * face it takes that face's place in the box.
 */
export function regionPatch(pa, target, [x0, y0, x1, y1]) {
  if (isWhole(target) || !patchesOf(pa, target)) return pa;
  const shown = composed(pa, target);
  const [ax, bx] = [Math.max(0, Math.min(x0, x1)), Math.min(PIXEL_SIZE - 1, Math.max(x0, x1))];
  const [ay, by] = [Math.max(0, Math.min(y0, y1)), Math.min(PIXEL_SIZE - 1, Math.max(y0, y1))];
  const rows = [];
  for (let y = ay; y <= by; y += 1) {
    let row = '';
    for (let x = ax; x <= bx; x += 1) row += shown[y][x] === '.' ? '_' : shown[y][x];
    rows.push(row);
  }
  return withPatches(pa, target, [...patchesOf(pa, target), { at: [ax, ay], rows }]);
}

/** Every cell joined to (x, y) through cells showing the same thing, side to side: what a fill fills. Any size of grid. */
export function floodCells(rows, x, y) {
  const H = rows.length; const W = rows[0]?.length || 0;
  const inside = (cx, cy) => cx >= 0 && cy >= 0 && cx < W && cy < H;
  if (!inside(x, y)) return [];
  const want = rows[y][x];
  const seen = new Set();
  const out = [];
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const k = cy * W + cx;
    if (!inside(cx, cy) || seen.has(k) || rows[cy][cx] !== want) continue;
    seen.add(k);
    out.push([cx, cy]);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return out;
}

/** The cells of a straight line from one cell to another, every step touching the last (Bresenham's). */
export function lineCells(x0, y0, x1, y1) {
  const out = [];
  const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy; let x = x0; let y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

/** The outline, or the whole, of a box between two cells. */
export function boxCells(x0, y0, x1, y1, filled = false) {
  const out = [];
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  for (let y = ay; y <= by; y += 1) for (let x = ax; x <= bx; x += 1) if (filled || y === ay || y === by || x === ax || x === bx) out.push([x, y]);
  return out;
}

/**
 * The same cells mirrored too, across a line at `axis` — a column, or
 * between two (49.5, the drawing's middle, by default for a grid `width`
 * wide). A drawing is seldom drawn exactly in the middle, so the line moves.
 */
export const mirroredCells = (cells, width = PIXEL_SIZE, axis = (width - 1) / 2) => [...cells, ...cells.map(([x, y, v]) => [Math.round(2 * axis - x), y, v])];

/** The middle of what is drawn, side to side, as a mirror line: halfway between its leftmost and rightmost pixels. */
export function drawnMiddle(rows) {
  let lo = Infinity; let hi = -Infinity;
  for (const row of rows) for (let x = 0; x < row.length; x += 1) if (row[x] !== '.') { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return lo === Infinity ? ((rows[0]?.length || PIXEL_SIZE) - 1) / 2 : (lo + hi) / 2;
}

// -------------------------------------------------------------- the parts

/** Characters for new parts, in the order they are handed out. */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#@*%=+!$&?:;<>^~|{}[]()/\\\'"`,-';

/** A part's id from its name: lower case, dashes, never one it already has. */
export function partId(pa, name) {
  const base = String(name || 'colour').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'colour';
  const taken = new Set(pa.parts.map((p) => p.id));
  let id = /^[a-z0-9]/.test(base) ? base : `c-${base}`;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

/** A new colour to draw with, or the avatar unchanged when every character is in use. */
export function addPart(pa, { name, color }) {
  const used = new Set(pa.parts.map((p) => p.char));
  const char = [...CHARS].find((c) => pixelCharOk(c) && !used.has(c));
  if (!char) return pa;
  return { ...copy(pa), parts: [...copy(pa.parts), { id: partId(pa, name), char, color: String(color || '#ffffff').toLowerCase(), name: String(name || 'Colour').slice(0, 40) }] };
}

/** Every grid and patch of an avatar, as strings, to count or check what is drawn in it. */
function everyRow(pa) {
  const rows = [...pa.base, ...pa.outfits.flatMap((o) => o.rows), ...(pa.turn?.front?.base || []), ...(pa.turn?.front?.outfits || []).flatMap((o) => o.rows)];
  const patchRows = (ps) => (ps || []).flatMap((p) => p.rows);
  for (const f of pa.faces) rows.push(...patchRows(f.patches));
  for (const e of pa.extras) rows.push(...patchRows(e.patches));
  for (const o of pa.outfits) { rows.push(...patchRows(o.ownFace?.glasses)); for (const ps of Object.values(o.ownFace?.faces || {})) rows.push(...patchRows(ps)); }
  for (const a of pa.actions) for (const frames of Object.values(a.outfits || {})) for (const f of frames) rows.push(...patchRows(f.patches));
  for (const f of pa.turn?.front?.faces || []) rows.push(...patchRows(f.patches));
  for (const e of pa.turn?.front?.extras || []) rows.push(...patchRows(e.patches));
  rows.push(...patchRows(pa.bubble));
  return rows;
}

/** How many pixels of a part are drawn anywhere in the avatar. */
export function partUse(pa, char) {
  let n = 0;
  for (const row of everyRow(pa)) for (const c of row) if (c === char) n += 1;
  return n;
}

/**
 * A part taken out, with every reference to it: only one drawn nowhere — a
 * colour still used would leave holes, so it is the avatar unchanged.
 */
export function removePart(pa, id) {
  const part = pa.parts.find((p) => p.id === id);
  if (!part || pa.parts.length <= 1 || partUse(pa, part.char)) return pa;
  const next = copy(pa);
  next.parts = next.parts.filter((p) => p.id !== id);
  next.split.carried = next.split.carried.filter((p) => p !== id);
  next.overHat = next.overHat.filter((p) => p !== id);
  if (next.colouring) {
    if (next.colouring.main === id) next.colouring = null;
    else {
      next.colouring.coloured = next.colouring.coloured.filter((p) => p !== id);
      next.colouring.eyes = next.colouring.eyes.filter((p) => p !== id);
      if (next.colouring.suit && (next.colouring.suit.armour === id)) next.colouring.suit = null;
      else if (next.colouring.suit) next.colouring.suit.body = next.colouring.suit.body.filter((p) => p !== id);
    }
  }
  if (next.eyes && [next.eyes.shine, next.eyes.line, next.eyes.lid, next.eyes.lidLine, ...next.eyes.fill, ...next.eyes.irisFill].includes(part.char)) next.eyes = null;
  return next;
}

// -------------------------------------------------------- faces, extras, outfits

/** A name for something new, from what it is called: lower case and dashes, and one not taken in that list. */
export function freshName(list, label, fallback = 'new') {
  const base = String(label || fallback).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 34) || fallback;
  const taken = new Set([...(list || []).map((x) => x.name), 'neutral']);
  let name = PIXEL_NAME.test(base) ? base : `${fallback}-${base}`.slice(0, 34);
  for (let n = 2; taken.has(name); n += 1) name = `${base}-${n}`;
  return name;
}

/** A new face, drawn over the drawing: empty until something is drawn in it. Special names keep their meaning (blink, talking…). */
export function addFace(pa, { name, label = '' }) {
  const n = PIXEL_NAME.test(String(name || '')) && !pa.faces.some((f) => f.name === name) && name !== 'neutral' ? name : freshName(pa.faces, label || name, 'face');
  // The open mouth is still the resting eyes: they glance while it talks. Eyes shut cannot blink.
  const face = { name: n, label: String(label || '').slice(0, 40), patches: [], glances: /^talking/.test(n), blinks: !['blink', 'blink-half', 'deep-sleep', 'dizzy'].includes(n) };
  return { avatar: { ...copy(pa), faces: [...copy(pa.faces), face] }, name: n };
}

export function addExtra(pa, { label = '', hat = false }) {
  const n = freshName(pa.extras, label, hat ? 'hat' : 'extra');
  return { avatar: { ...copy(pa), extras: [...copy(pa.extras), { name: n, label: String(label || '').slice(0, 40), patches: [], hat: Boolean(hat), words: [] }] }, name: n };
}

/** A new outfit, starting as a copy of the drawing — or of another outfit — to draw over. */
export function addOutfit(pa, { label = '', from = '' }) {
  const n = freshName(pa.outfits, label, 'outfit');
  const rows = copy(from ? pa.outfits.find((o) => o.name === from)?.rows || pa.base : pa.base);
  return { avatar: { ...copy(pa), outfits: [...copy(pa.outfits), { name: n, label: String(label || '').slice(0, 40), rows, headwear: false, words: [] }] }, name: n };
}

/** A face, extra or outfit taken out, with every action frame drawn for that outfit, and its front version. */
export function removeItem(pa, kind, name) {
  const next = copy(pa);
  const front = next.turn?.front;
  if (kind === 'face') next.faces = next.faces.filter((f) => f.name !== name);
  if (kind === 'extra') {
    next.extras = next.extras.filter((e) => e.name !== name);
    if (front) front.extras = (front.extras || []).filter((e) => e.name !== name);
  }
  if (kind === 'outfit') {
    next.outfits = next.outfits.filter((o) => o.name !== name);
    for (const a of next.actions) delete a.outfits[name];
    if (front) front.outfits = (front.outfits || []).filter((o) => o.name !== name);
  }
  if (kind === 'action') next.actions = next.actions.filter((a) => a.name !== name);
  return next;
}

/** Changes to a face's, extra's or outfit's own settings: its label, words, and what it is. */
export function setItem(pa, kind, name, changes) {
  const next = copy(pa);
  const list = kind === 'face' ? next.faces : kind === 'extra' ? next.extras : kind === 'outfit' ? next.outfits : kind === 'action' ? next.actions : [];
  const item = list.find((x) => x.name === name);
  if (!item) return pa;
  for (const [k, v] of Object.entries(changes || {})) {
    if (k === 'label') item.label = String(v ?? '').slice(0, 40);
    else if (k === 'words') item.words = (Array.isArray(v) ? v : String(v ?? '').split(',')).map((w) => String(w).trim().toLowerCase()).filter(Boolean).slice(0, 30);
    else if (['glances', 'blinks', 'hat', 'headwear'].includes(k)) item[k] = Boolean(v);
  }
  return next;
}

/** What has changed between two versions of an avatar, as the number of differing pixels in a target — for "unsaved" and tests. */
export function differingPixels(a, b, target) {
  const x = composed(a, target); const y = composed(b, target);
  let n = 0;
  for (let r = 0; r < PIXEL_SIZE; r += 1) for (let c = 0; c < PIXEL_SIZE; c += 1) if (x[r][c] !== y[r][c]) n += 1;
  return n;
}

// ------------------------------------------------------------------ drawn hats

/*
  A drawn hat is a picture of its own (extras[].art): rows of letters, a for
  its first colour and so on, '.' for none, placed with its top-left corner
  at x, y on the avatar's grid, each of its pixels `size` of the avatar's.
  Its patches, as an extra's, are what it hides of the head under it — the
  hair that would stick up through its top — drawn with '_'.
*/

const hatOf = (pa, name) => pa.extras.find((e) => e.name === name && e.art) || null;
const letter = (i) => String.fromCharCode(97 + i);

function withHat(pa, name, change) {
  const next = copy(pa);
  const hat = next.extras.find((e) => e.name === name && e.art);
  if (!hat) return pa;
  change(hat.art, hat);
  return next;
}

/** A new drawn hat: an empty picture over the top of the head, at about the size the built-in ones are drawn. */
export function addDrawnHat(pa, { label = '' }) {
  const n = freshName(pa.extras, label, 'hat');
  const art = { x: 25, y: -2, size: 1.5, palette: ['#3a2a4a', '#6b4f8a'], rows: Array.from({ length: 24 }, () => '.'.repeat(34)) };
  return { avatar: { ...copy(pa), extras: [...copy(pa.extras), { name: n, label: String(label || '').slice(0, 40), patches: [], hat: true, art, words: [] }] }, name: n };
}

/** A stroke on a hat's own picture: [x, y, value], value one of its letters, '_' or '.' for nothing there. */
export function paintHat(pa, name, cells) {
  return withHat(pa, name, (art) => {
    const grid = art.rows.map((r) => r.split(''));
    for (const [x, y, v] of cells) {
      if (y < 0 || y >= grid.length || x < 0 || x >= (grid[y]?.length || 0)) continue;
      grid[y][x] = v === '_' || v === '.' ? '.' : v;
    }
    art.rows = grid.map((r) => r.join(''));
  });
}

/**
 * Where a hat sits and how big its pixels are, held to what the server keeps.
 *
 * @param {{ x?: number, y?: number, size?: number }} place
 */
export function placeHat(pa, name, { x, y, size } = {}) {
  const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v * 1000) / 1000));
  return withHat(pa, name, (art) => {
    if (Number.isFinite(x)) art.x = clampTo(x, -100, 200);
    if (Number.isFinite(y)) art.y = clampTo(y, -100, 200);
    if (Number.isFinite(size)) art.size = clampTo(size, 0.1, 10);
  });
}

/**
 * A hat's picture made bigger or smaller, a column or row at a time on one
 * of its sides. Growing or shrinking on the left or top moves its corner
 * too, so what is drawn stays exactly where it was on the head.
 */
export function resizeHat(pa, name, side, by) {
  return withHat(pa, name, (art) => {
    const w = art.rows[0]?.length || 0; const h = art.rows.length;
    if (side === 'right' || side === 'left') {
      const next = Math.max(1, Math.min(120, w + by));
      const d = next - w;
      if (!d) return;
      art.rows = art.rows.map((r) => (side === 'right' ? (d > 0 ? r + '.'.repeat(d) : r.slice(0, next)) : (d > 0 ? '.'.repeat(d) + r : r.slice(-d))));
      if (side === 'left') art.x = Math.round((art.x - d * art.size) * 1000) / 1000;
    } else {
      const next = Math.max(1, Math.min(120, h + by));
      const d = next - h;
      if (!d) return;
      const blank = '.'.repeat(w);
      if (side === 'bottom') art.rows = d > 0 ? [...art.rows, ...Array(d).fill(blank)] : art.rows.slice(0, next);
      else {
        art.rows = d > 0 ? [...Array(d).fill(blank), ...art.rows] : art.rows.slice(-d);
        art.y = Math.round((art.y - d * art.size) * 1000) / 1000;
      }
    }
  });
}

/** A colour added to a hat's own, or the hat unchanged when it has all 26. */
export function addHatColour(pa, name, color) {
  const hat = hatOf(pa, name);
  if (!hat || hat.art.palette.length >= 26) return pa;
  return withHat(pa, name, (art) => { art.palette.push(String(color || '#ffffff').toLowerCase()); });
}

export function setHatColour(pa, name, index, color) {
  return withHat(pa, name, (art) => { if (art.palette[index]) art.palette[index] = String(color).toLowerCase(); });
}

/** How many of a hat's pixels are its colour at `index`. */
export function hatColourUse(pa, name, index) {
  const hat = hatOf(pa, name);
  if (!hat) return 0;
  const c = letter(index);
  return hat.art.rows.reduce((n, r) => n + [...r].filter((x) => x === c).length, 0);
}

/** A hat colour taken out — only one drawn nowhere — and the letters after it moved down one, so every pixel keeps its colour. */
export function removeHatColour(pa, name, index) {
  const hat = hatOf(pa, name);
  if (!hat || hat.art.palette.length <= 1 || hatColourUse(pa, name, index)) return pa;
  return withHat(pa, name, (art) => {
    art.palette.splice(index, 1);
    art.rows = art.rows.map((r) => [...r].map((c) => (c !== '.' && c.charCodeAt(0) - 97 > index ? letter(c.charCodeAt(0) - 98) : c)).join(''));
  });
}

/**
 * A hat's picture as the canvas draws it: its rows, and its colours as
 * parts — a letter each — so the one canvas draws both.
 */
export function hatPicture(pa, name) {
  const hat = hatOf(pa, name);
  if (!hat) return null;
  return { rows: hat.art.rows, parts: hat.art.palette.map((color, i) => ({ id: `hat-${i}`, char: letter(i), color, name: color })), art: hat.art };
}

// ------------------------------------------------------------ things it does

/*
  Something it does is frames, drawn for each outfit it does it in ('' the
  one it was drawn in): each a set of patches over that outfit at rest, how
  long it stays up, and whether the eyes are shut through it. An outfit
  with no frames does not do it.
*/

/** Something new to do: one empty frame, in the outfit it was drawn in, to start drawing. */
export function addAction(pa, { label = '' }) {
  const n = freshName(pa.actions, label, 'action');
  return { avatar: { ...copy(pa), actions: [...copy(pa.actions), { name: n, label: String(label || '').slice(0, 40), words: [], outfits: { '': [{ ms: 300, patches: [] }] } }] }, name: n };
}

export function framesOf(pa, action, outfit = '') {
  return pa.actions.find((a) => a.name === action)?.outfits?.[outfit || ''] || null;
}

function withFrames(pa, action, outfit, change) {
  const next = copy(pa);
  const a = next.actions.find((x) => x.name === action);
  if (!a) return pa;
  const key = outfit || '';
  a.outfits[key] = a.outfits[key] || [];
  change(a.outfits[key]);
  if (!a.outfits[key].length) delete a.outfits[key];
  return next;
}

const FRAME_LIMIT = 240;

/** A frame put in at `at`: a copy of frame `copyOf`, or an empty one as long as the frame before it. */
export function addFrame(pa, action, outfit, at, copyOf = null) {
  return withFrames(pa, action, outfit, (frames) => {
    if (frames.length >= FRAME_LIMIT) return;
    const like = copyOf != null ? frames[copyOf] : null;
    const frame = like ? copy(like) : { ms: frames[Math.max(0, at - 1)]?.ms || 300, patches: [] };
    frames.splice(Math.max(0, Math.min(frames.length, at)), 0, frame);
  });
}

export function removeFrame(pa, action, outfit, index) {
  return withFrames(pa, action, outfit, (frames) => { frames.splice(index, 1); });
}

/** A frame moved `by` places along, no further than either end. */
export function moveFrame(pa, action, outfit, index, by) {
  return withFrames(pa, action, outfit, (frames) => {
    const to = Math.max(0, Math.min(frames.length - 1, index + by));
    if (to === index || !frames[index]) return;
    const [f] = frames.splice(index, 1);
    frames.splice(to, 0, f);
  });
}

/** How long a frame stays up (16 ms to 20 s) and whether the eyes are shut through it. */
export function setFrame(pa, action, outfit, index, { ms, eyes } = {}) {
  return withFrames(pa, action, outfit, (frames) => {
    const f = frames[index];
    if (!f) return;
    if (ms !== undefined && Number.isFinite(Number(ms))) f.ms = Math.max(16, Math.min(20000, Math.round(Number(ms))));
    if (eyes !== undefined) { if (eyes === 'shut') f.eyes = 'shut'; else delete f.eyes; }
  });
}

/**
 * An outfit started doing it: its frames copied from another outfit's —
 * the same hand and glass, to redraw in this outfit's cloth — or one empty
 * frame.
 */
export function startOutfitFrames(pa, action, outfit, from = null) {
  const source = from !== null ? framesOf(pa, action, from) : null;
  return withFrames(pa, action, outfit, (frames) => {
    if (frames.length) return;
    frames.push(...(source ? copy(source) : [{ ms: 300, patches: [] }]));
  });
}

/** Every pixel a frame's patches paint, on an empty grid: the frame before, shown faintly to draw the next against. */
export function framePixels(pa, action, outfit, index) {
  const f = framesOf(pa, action, outfit)?.[index];
  if (!f) return null;
  return layPatches(blankRows(), f.patches.map((p) => ({ at: p.at, rows: p.rows.map((r) => r.replace(/_/g, '.')) })));
}

// ------------------------------------------------------------------- turning

/*
  A drawing that turns: drawn facing one way, mirrored
  to face the other, and a front view between the two, with faces of its
  own — its mouth open, its eyes shut and half shut — and where its head
  ends. Writing on it (a name on a shirt) is kept the right way round when
  it is mirrored: those boxes are copied back unmirrored.
*/

/** It turns, starting from a front view that is the drawing as it is; or it no longer turns, and its front view goes. */
export function setTurns(pa, on) {
  const next = copy(pa);
  next.turn = on ? (pa.turn || { front: { base: copy(pa.base), faces: [], headLastRow: pa.split?.headLastRow ?? 99, outfits: [], extras: [] }, mirrorKeep: [] }) : null;
  return next;
}

/*
  An outfit or an extra seen from the front. Without one, it does not show
  while the avatar faces the front — and one that turns faces the front
  most of the time — so every outfit and extra wants one. An outfit's
  starts as the front view to redraw; an extra's, empty, to draw over it.
*/
export function addFrontOutfit(pa, name) {
  if (!pa.turn || !pa.outfits.some((o) => o.name === name) || (pa.turn.front.outfits || []).some((o) => o.name === name)) return pa;
  const next = copy(pa);
  next.turn.front.outfits = [...(next.turn.front.outfits || []), { name, rows: copy(pa.turn.front.base) }];
  return next;
}

export function addFrontExtra(pa, name) {
  if (!pa.turn || !pa.extras.some((e) => e.name === name) || (pa.turn.front.extras || []).some((e) => e.name === name)) return pa;
  const next = copy(pa);
  next.turn.front.extras = [...(next.turn.front.extras || []), { name, patches: [] }];
  return next;
}

/** An outfit's or extra's front version taken out: from the front it is not shown again. */
export function removeFrontVersion(pa, kind, name) {
  if (!pa.turn) return pa;
  const next = copy(pa);
  if (kind === 'outfit') next.turn.front.outfits = (next.turn.front.outfits || []).filter((o) => o.name !== name);
  if (kind === 'extra') next.turn.front.extras = (next.turn.front.extras || []).filter((e) => e.name !== name);
  return next;
}

/** Which outfits and extras have no front version yet: what is missing while it faces the front. */
export function frontMissing(pa) {
  if (!pa?.turn) return { outfits: [], extras: [] };
  const has = (list, name) => (list || []).some((x) => x.name === name);
  return {
    outfits: pa.outfits.filter((o) => !has(pa.turn.front.outfits, o.name)).map((o) => o.name),
    extras: pa.extras.filter((e) => !has(pa.turn.front.extras, e.name)).map((e) => e.name),
  };
}

/**
 * A face of the front view: any face it has from the side, or talking,
 * blink or blink-half — the ones it uses by itself. It blinks as the side's
 * face of that name does; from the front the eyes never glance.
 */
export function addFrontFace(pa, name) {
  const side = pa.faces.find((f) => f.name === name);
  if (!pa.turn || !(side || ['talking', 'blink', 'blink-half'].includes(name)) || pa.turn.front.faces.some((f) => f.name === name)) return pa;
  const next = copy(pa);
  next.turn.front.faces.push({ name, label: '', patches: [], glances: false, blinks: side ? side.blinks : name === 'talking' });
  return next;
}

export function removeFrontFace(pa, name) {
  if (!pa.turn) return pa;
  const next = copy(pa);
  next.turn.front.faces = next.turn.front.faces.filter((f) => f.name !== name);
  return next;
}

/** Which way it faces as drawn, its front view's head line, and the boxes kept unmirrored ([x0, y0, x1, y1], at most 8). */
export function setTurn(pa, { drawnFacing, frontHeadLastRow, mirrorKeep } = {}) {
  const next = copy(pa);
  if (drawnFacing === 'left' || drawnFacing === 'right') next.drawnFacing = drawnFacing;
  if (next.turn && Number.isInteger(frontHeadLastRow)) next.turn.front.headLastRow = Math.max(-1, Math.min(99, frontHeadLastRow));
  if (next.turn && Array.isArray(mirrorKeep)) {
    next.turn.mirrorKeep = mirrorKeep.slice(0, 8).map((b) => {
      const [x0, y0, x1, y1] = b.map((v) => Math.max(0, Math.min(99, Math.round(Number(v) || 0))));
      return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
    });
  }
  return next;
}

// ------------------------------------------------------------------- outfits

/*
  An outfit with a face of its own — round glasses, say — has a box
  on the head that the faces drawn on the drawing keep out of, its own
  version of whichever faces need one inside that box, and glasses laid
  over the eyes last, whatever the face. Its lashes go with a half-shut lid
  down to `lashesTo`.
*/

/** A face of its own for an outfit, in a box of the head ([x0, y0, x1, y1]); or none, and its own faces and glasses go. */
export function setOwnFace(pa, outfit, on, region = [23, 38, 67, 66]) {
  const next = copy(pa);
  const o = next.outfits.find((x) => x.name === outfit);
  if (!o) return pa;
  if (on) {
    if (!o.ownFace) o.ownFace = { region: [...region], glasses: [], faces: {} };
  } else {
    delete o.ownFace;
    delete o.lashesTo;
  }
  return next;
}

/** The box an outfit's own face is in, and how far its lashes go with a half-shut lid (null: as the drawing's do). */
export function setOwnFaceBox(pa, outfit, { region, lashesTo } = {}) {
  const next = copy(pa);
  const o = next.outfits.find((x) => x.name === outfit);
  if (!o?.ownFace) return pa;
  if (Array.isArray(region) && region.length === 4) {
    const [x0, y0, x1, y1] = region.map((v) => Math.max(0, Math.min(99, Math.round(Number(v) || 0))));
    o.ownFace.region = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
  }
  if (lashesTo === null) delete o.lashesTo;
  else if (Number.isInteger(lashesTo)) o.lashesTo = Math.max(0, Math.min(99, lashesTo));
  return next;
}

/**
 * What an outfit has and has not got: for each thing it does, how many
 * frames are drawn in it; whether it wears hats; with a face of its own,
 * which faces have their own version in it; and, for one that turns,
 * whether it is drawn from the front (null when it does not turn).
 */
export function outfitChecklist(pa, outfit) {
  const o = pa.outfits.find((x) => x.name === outfit);
  return {
    actions: pa.actions.map((a) => ({ name: a.name, frames: (a.outfits?.[outfit || ''] || []).length })),
    hats: o?.headwear ? null : pa.extras.filter((e) => e.hat).map((e) => e.name),
    faces: pa.faces.map((f) => f.name),
    ownFaces: o?.ownFace ? pa.faces.map((f) => ({ name: f.name, drawn: Boolean(o.ownFace.faces[f.name]?.length) })) : null,
    front: pa.turn ? (pa.turn.front.outfits || []).some((x) => x.name === outfit) : null,
  };
}

// --------------------------------------------------------------- setting up

/** How a part behaves: carried with the body, drawn over a hat, its effect and how see-through it is. */
export function setPart(pa, id, { carried, overHat, effect, opacity } = {}) {
  if (!pa.parts.some((p) => p.id === id)) return pa;
  const next = copy(pa);
  const p = next.parts.find((x) => x.id === id);
  if (carried !== undefined) next.split.carried = carried ? [...new Set([...next.split.carried, id])] : next.split.carried.filter((x) => x !== id);
  if (overHat !== undefined) next.overHat = overHat ? [...new Set([...next.overHat, id])] : next.overHat.filter((x) => x !== id);
  if (effect !== undefined) { if (effect === 'float' || effect === 'pop') p.effect = effect; else delete p.effect; }
  if (opacity !== undefined) { const o = Number(opacity); if (Number.isFinite(o) && o < 1) p.opacity = Math.max(0.05, Math.round(o * 100) / 100); else delete p.opacity; }
  return next;
}

/** What the outfit it was drawn in is called, and the words viewers use for it. */
export function setBaseOutfit(pa, { label, words } = {}) {
  const next = copy(pa);
  if (label !== undefined) next.baseLabel = String(label ?? '').trim().slice(0, 40);
  if (words !== undefined) next.baseWords = (Array.isArray(words) ? words : String(words ?? '').split(',')).map((w) => String(w).trim().toLowerCase()).filter(Boolean).slice(0, 30);
  return next;
}

/**
 * Which parts take a colour (see pixelInColour): null for none, or
 * { main, coloured, eyes, suit }. Parts it does not have are let go, the
 * main part always takes it, and a suit needs its armour.
 */
export function setColouring(pa, colouring) {
  const next = copy(pa);
  const ids = new Set(pa.parts.map((p) => p.id));
  if (!colouring?.main || !ids.has(colouring.main)) { next.colouring = null; return next; }
  const keep = (list) => [...new Set((list || []).filter((id) => ids.has(id)))];
  const coloured = keep([colouring.main, ...(colouring.coloured || [])]);
  next.colouring = {
    main: colouring.main,
    coloured,
    eyes: keep(colouring.eyes).filter((id) => coloured.includes(id)),
    suit: colouring.suit?.armour && ids.has(colouring.suit.armour) ? { armour: colouring.suit.armour, body: keep(colouring.suit.body) } : null,
  };
  return next;
}

const luminance = (hex) => { const n = Number.parseInt(String(hex).slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const vividness = (hex) => { const n = Number.parseInt(String(hex).slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; return (Math.max(...c) - Math.min(...c)) / 255; };

/**
 * A first guess at where a new avatar's eyes are and what each of their
 * colours is, to correct in the tab: the darkest colour the eyes' edge and
 * lashes, the lightest their white and sparkle, the most vivid their iris,
 * a part called skin (or the commonest colour of the face) the lid — and
 * the eyes themselves as two boxes across the middle of the head.
 */
export function guessEyes(pa) {
  const used = pa.parts.filter((p) => partUse(pa, p.char) > 0);
  const pool = used.length >= 3 ? used : pa.parts;
  const byLight = [...pool].sort((a, b) => luminance(a.color) - luminance(b.color));
  const dark = byLight[0]; const light = byLight[byLight.length - 1];
  const iris = [...pool].filter((p) => p !== dark && p !== light).sort((a, b) => vividness(b.color) - vividness(a.color))[0] || dark;
  const skin = pool.find((p) => /skin|piel/i.test(`${p.id} ${p.name}`)) || pool.find((p) => p !== dark && p !== light && p !== iris) || light;
  const last = Math.max(20, Math.min(99, pa.split?.headLastRow ?? 76));
  const mid = Math.round(last * 0.75);
  return {
    boxes: [[30, 40], [56, 66]],
    rows: [mid - 4, mid + 4],
    opening: [...new Set([dark.char, light.char, iris.char])].join(''),
    white: light.char,
    iris: [...new Set([dark.char, iris.char])].join(''),
    shine: light.char,
    line: dark.char,
    split: mid,
    fill: [light.char, light.char],
    irisFill: [iris.char, iris.char],
    lid: skin.char,
    lidLine: dark.char,
    lidRow: mid + 1,
    lashes: [mid - 7, mid - 4],
    lashChars: dark.char,
  };
}

/** Its eyes, set up to move by themselves — or null, and they stay as drawn. */
export function setEyes(pa, eyes) {
  const next = copy(pa);
  next.eyes = eyes ? copy(eyes) : null;
  if (!eyes) for (const f of next.faces) f.glances = false;
  return next;
}

// -------------------------------------------------------- reference pictures

/*
  A picture to draw a new character from — traced, or copied by eye — shown
  with the canvas, behind the drawing or in front of it, and never part of
  the avatar. Its place is in the drawing's own pixels: its top-left corner
  at (x, y), w pixels wide, as tall as its shape makes it.
*/

const two = (v) => Math.round(v * 100) / 100;

/** A picture of `width` × `height` fitted inside the drawing, keeping its shape, in the middle. */
export function fitReference(width, height, size = PIXEL_SIZE) {
  if (!(width > 0 && height > 0)) return { x: 0, y: 0, w: size };
  const w = width >= height ? size : size * (width / height);
  const h = w * (height / width);
  return { x: two((size - w) / 2), y: two((size - h) / 2), w: two(w) };
}

/** Where a reference placed on the drawing falls on a drawn hat's own grid, whose pixels are `size` of the drawing's. */
export function referenceOnHat(ref, art) {
  return { ...ref, x: (ref.x - art.x) / art.size, y: (ref.y - art.y) / art.size, w: ref.w / art.size };
}

// --------------------------------------------------------------- selections

/*
  A box of pixels picked up, moved, flipped, copied and put down again. What
  is picked up is what the thing being drawn is made of there: on a whole
  drawing, its pixels; on a face, an extra or a frame, only what it changes
  ('_' where it clears one) — so a mouth copied from one face and pasted on
  another brings the mouth, not the head round it; on a drawn hat, its own
  picture. Where it was picked up from is left empty — on a face, back to
  what is under it. Picked-up pixels are rows, '.' where nothing is.
*/

const isHatTarget = (target) => target?.kind === 'hat';

/** What a face, extra or frame itself paints, pixel by pixel: '.' nothing, '_' a pixel it clears, or a part's char. */
export function ownPixels(pa, target) {
  const grid = blankRows().map((r) => r.split(''));
  for (const { at: [x0, y0], rows } of patchesOf(pa, target) || []) {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx += 1) {
        const c = row[dx]; const x = x0 + dx; const y = y0 + dy;
        if (c !== '.' && inGrid(x, y)) grid[y][x] = c;
      }
    });
  }
  return grid.map((r) => r.join(''));
}

/** The rows a selection is picked up from: the thing's own, as above. */
function sourceRows(pa, target) {
  if (isHatTarget(target)) return hatPicture(pa, target.name)?.rows || [];
  return isWhole(target) || target.kind === 'setup' ? composed(pa, target.kind === 'setup' ? { kind: 'base' } : target) : ownPixels(pa, target);
}

/** A box [x0, y0, x1, y1] put in order and kept inside a grid `w` × `h`. */
export function clampBox([x0, y0, x1, y1], w = PIXEL_SIZE, h = PIXEL_SIZE) {
  const ax = Math.max(0, Math.min(x0, x1)); const bx = Math.min(w - 1, Math.max(x0, x1));
  const ay = Math.max(0, Math.min(y0, y1)); const by = Math.min(h - 1, Math.max(y0, y1));
  return [ax, ay, bx, by];
}

/** What is in a box, picked up: { rows, x, y }. */
export function liftBox(pa, target, box) {
  const src = sourceRows(pa, target);
  const [x0, y0, x1, y1] = clampBox(box, src[0]?.length || PIXEL_SIZE, src.length || PIXEL_SIZE);
  const rows = [];
  for (let y = y0; y <= y1; y += 1) rows.push(src[y].slice(x0, x1 + 1));
  return { rows, x: x0, y: y0 };
}

/** A box emptied: on a whole drawing and a hat, nothing there; on a face, extra or frame, back to what is under it. */
export function vacateBox(pa, target, box) {
  const src = sourceRows(pa, target);
  const [x0, y0, x1, y1] = clampBox(box, src[0]?.length || PIXEL_SIZE, src.length || PIXEL_SIZE);
  const cells = [];
  const value = isWhole(target) || target.kind === 'setup' ? '_' : '.';
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) cells.push([x, y, value]);
  return drawCells(pa, target, cells);
}

/** Picked-up pixels put down with their top-left at (x, y): '.' leaves what is there. Off the grid, they are lost. */
export function stampRows(pa, target, { rows, x, y }) {
  const cells = [];
  rows.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') cells.push([x + i, y + j, c]); }));
  return drawCells(pa, target, cells);
}

/** A stroke on whatever is being drawn — the drawing's own grid, or a drawn hat's. */
export function drawCells(pa, target, cells) {
  if (isHatTarget(target)) return paintHat(pa, target.name, cells);
  return paint(pa, target.kind === 'setup' ? { kind: 'base' } : target, cells);
}

/** Picked-up pixels flipped, side to side ('h') or top to bottom ('v'). */
export function flipRows(rows, way) {
  return way === 'v' ? [...rows].reverse() : rows.map((r) => [...r].reverse().join(''));
}

/**
 * Pixels copied from one set of colours, written in another's: each the
 * part with the same character and colour, or failing that the same
 * colour, or failing that the nearest-looking one. So a mouth copied from
 * one avatar pastes into another in the colours that one has.
 *
 *   colours   the copied pixels' colours by their characters
 *   parts     the colours being pasted into
 */
export function remapRows(rows, colours, parts, nearest) {
  const byChar = Object.fromEntries(parts.map((p) => [p.char, p]));
  const map = {};
  for (const [char, colour] of Object.entries(colours || {})) {
    const same = byChar[char];
    if (same && same.color.toLowerCase() === String(colour).toLowerCase()) { map[char] = char; continue; }
    const exact = parts.find((p) => p.color.toLowerCase() === String(colour).toLowerCase());
    const n = Number.parseInt(String(colour).slice(1), 16);
    map[char] = exact ? exact.char : nearest([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], parts)?.char || '.';
  }
  return rows.map((r) => [...r].map((c) => (c === '.' || c === '_' ? c : map[c] ?? (byChar[c] ? c : '.'))).join(''));
}

/** The colours of the characters in some rows, from a set of parts, for remapRows on the other side. */
export function coloursOf(rows, parts) {
  const byChar = Object.fromEntries(parts.map((p) => [p.char, p.color]));
  const out = {};
  for (const r of rows) for (const c of r) if (byChar[c]) out[c] = byChar[c];
  return out;
}

// ------------------------------------------------------------------- shades

/**
 * A colour's shadow and highlight, added beside it: the same hue, a step
 * darker and richer, and a step lighter and softer — the way clothes are
 * shaded. Named after it; the avatar unchanged when there is no room for
 * two more.
 */
export function addShades(pa, id) {
  const part = pa.parts.find((p) => p.id === id);
  if (!part) return pa;
  const [h, s, l] = hexToHsl(part.color);
  const clampTo = (v) => Math.max(0, Math.min(1, v));
  const shadow = hslToHex([h, clampTo(s + 0.08), clampTo(l - 0.16)]);
  const light = hslToHex([h, clampTo(s - 0.05), clampTo(l + 0.14)]);
  const once = addPart(pa, { name: `${part.name} shadow`.slice(0, 40), color: shadow });
  if (once === pa) return pa;
  const twice = addPart(once, { name: `${part.name} highlight`.slice(0, 40), color: light });
  return twice === once ? pa : twice;
}

// ---------------------------------------------------------------- warnings

/*
  Things worth a look before saving — none of them stops it being saved:

    face-below-head    a face paints below where the head ends, so that part
                       moves with the body, not the head, as it breathes
    hat-hair-pokes     hair shows above a drawn hat, through its top: rub it
                       out in the hair the hat hides
    empty              a face, extra or frame with nothing drawn in it
    unused-colours     colours drawn nowhere
*/

/** Where a drawn hat's pixels fall on the avatar's grid, as the topmost row it covers in each column. */
function hatTops(art) {
  const tops = new Map();
  art.rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === '.') return;
    const x0 = Math.floor(art.x + i * art.size); const x1 = Math.ceil(art.x + (i + 1) * art.size) - 1;
    const y = Math.floor(art.y + j * art.size);
    for (let x = x0; x <= x1; x += 1) if (!tops.has(x) || tops.get(x) > y) tops.set(x, y);
  }));
  return tops;
}

export function pixelWarnings(pa) {
  const out = [];
  const last = pa.split?.headLastRow ?? 99;
  const paints = (p, below) => p.rows.some((r, dy) => p.at[1] + dy > below && /[^._]/.test(r));
  for (const f of pa.faces) {
    if (!f.patches.length) out.push({ code: 'empty', kind: 'face', name: f.name });
    else if (f.patches.some((p) => paints(p, last))) out.push({ code: 'face-below-head', name: f.name });
  }
  for (const e of pa.extras) {
    if (!e.art && !e.patches.length) out.push({ code: 'empty', kind: 'extra', name: e.name });
    if (!e.art) continue;
    // The head with this hat's hidden hair taken away, in every outfit without headwear of its own.
    for (const o of ['', ...pa.outfits.filter((x) => !x.headwear).map((x) => x.name)]) {
      const head = pixelGrid(pa, { extras: [e.name], outfit: o });
      const tops = hatTops(e.art);
      let pokes = 0;
      // Two whole rows clear of the hat's top, and three pixels of it: a pixel of outline at a brim's edge is how a hat is drawn, not hair poking through.
      for (const [x, top] of tops) for (let y = 0; y < Math.min(top - 1, last + 1); y += 1) if (x >= 0 && x < PIXEL_SIZE && head[y][x] !== '.') pokes += 1;
      if (pokes >= 3) { out.push({ code: 'hat-hair-pokes', name: e.name, outfit: o, pixels: pokes }); break; }
    }
  }
  for (const a of pa.actions) {
    for (const [o, frames] of Object.entries(a.outfits || {})) {
      frames.forEach((f, i) => { if (!f.patches.length) out.push({ code: 'empty', kind: 'frame', name: a.name, outfit: o, index: i }); });
    }
  }
  // One that turns faces the front most of the time: an outfit or extra with no front version is missing then.
  const missing = frontMissing(pa);
  for (const name of missing.outfits) out.push({ code: 'front-missing', kind: 'outfit', name });
  for (const name of missing.extras) out.push({ code: 'front-missing', kind: 'extra', name });
  const unused = pa.parts.filter((p) => !partUse(pa, p.char)).map((p) => p.id);
  if (unused.length) out.push({ code: 'unused-colours', parts: unused });
  return out;
}
