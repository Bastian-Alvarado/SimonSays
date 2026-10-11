/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A layout's two shapes: the horizontal one it has always had, and a
 * vertical one, for streaming both at once — Twitch's dual format, TikTok —
 * from OBS's vertical canvas.
 *
 * One layout, not two. What a layer is — the chat's look, the goal's
 * target, which source a slot shows — is the same in both, set once. Only
 * where each layer sits is the format's own: a layer placed on the vertical
 * canvas keeps that box in `layout.vertical.boxes`, by its uid; one never
 * placed there sits where autoVerticalBox puts it, worked out from its
 * horizontal box, and follows that box when it moves. And a layer can be
 * kept to one of the two (`layer.only`): a wide chat on the horizontal one,
 * say, while the phone apps show their own chat on the vertical one.
 *
 * Both shapes are the same layout going live: whatever decides which layout
 * is on stream decides it for both, so they can never show different ones.
 *
 * Read by the overlay page (formatLayout), the editor (viewOf and
 * fromVerticalView), the server's cleaning of a saved layout
 * (cleanVertical) and the Omnilayer, which moves OBS's sources on the
 * vertical canvas too.
 */

import { aspectRatio, fitAspect } from './aspect.js';

export const FORMATS = ['horizontal', 'vertical'];

/** The vertical canvas a layout gets until it is given another: 1080×1920, a phone's screen. */
export const VERTICAL_CANVAS = Object.freeze({ width: 1080, height: 1920 });

/** The fields that are a layer's box: the format's own. Everything else about a layer is shared. */
export const BOX = ['x', 'y', 'width', 'height'];

const LIMITS = { min: 160, max: 7680 };
const num = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

/** Whether a layer is drawn in a format: everywhere, unless it is kept to the other one. */
export const shownIn = (layer, format) => !layer?.only || layer.only === format;

/** The vertical canvas's size: the layout's own, or 1080×1920. */
export function verticalCanvas(layout) {
  const v = layout?.vertical || {};
  return {
    width: num(v.width, LIMITS.min, LIMITS.max, VERTICAL_CANVAS.width),
    height: num(v.height, LIMITS.min, LIMITS.max, VERTICAL_CANVAS.height),
  };
}

/*
  Within two pixels of the canvas's edges counts as filling it: the alerts,
  a game captured edge to edge.
*/
const fills = (b, w, h) => b.x <= 2 && b.y <= 2 && b.x + b.width >= w - 2 && b.y + b.height >= h - 2;
const fillsWidth = (b, w) => b.x <= 2 && b.x + b.width >= w - 2;

/**
 * A box carried from one canvas to another of a different shape, as a first
 * placement to adjust rather than a finished one.
 *
 * One that filled the old canvas fills the new one, and one as wide as it is
 * is as wide as the new one at its own height (an omnibar). Anything else
 * keeps its own size, so its words stay the size they were made at — larger
 * on a phone, where a vertical stream is watched, not smaller — and is only
 * shrunk, keeping its shape, when it would not fit the new canvas. One
 * against an edge stays against it — a bar along the bottom, a camera in a
 * corner; otherwise its middle stays at the same share of the way across and
 * down, so what was top right is top right.
 */
export function carryBox(box, from, to) {
  const b = { x: Number(box?.x) || 0, y: Number(box?.y) || 0, width: Number(box?.width) || 20, height: Number(box?.height) || 20 };
  if (fills(b, from.width, from.height)) return { x: 0, y: 0, width: to.width, height: to.height };
  const k = Math.min(1, to.width / b.width, to.height / b.height);
  // Along one side: against the start of it, against the end, or its middle carried across.
  const along = (at, size, fromSize, toSize, newSize) => {
    if (at <= 2) return 0;
    if (at + size >= fromSize - 2) return toSize - newSize;
    const middle = ((at + size / 2) / fromSize) * toSize;
    return Math.round(Math.min(toSize - newSize, Math.max(0, middle - newSize / 2)));
  };
  if (fillsWidth(b, from.width)) {
    const barHeight = Math.min(to.height, b.height);
    return { x: 0, y: along(b.y, b.height, from.height, to.height, barHeight), width: to.width, height: barHeight };
  }
  const height = Math.max(20, Math.round(b.height * k));
  const y = along(b.y, b.height, from.height, to.height, height);
  const width = Math.max(20, Math.round(b.width * k));
  return { x: along(b.x, b.width, from.width, to.width, width), y, width, height };
}

/**
 * Where a layer sits on the vertical canvas while it has never been placed
 * there. One kept to a shape (an OBS source's 16:9) keeps it, inside the box
 * it was carried to: a game that filled the horizontal canvas goes across
 * the vertical one, not stretched down all of it.
 */
export function autoVerticalBox(layer, layout, canvas = verticalCanvas(layout)) {
  const box = carryBox(layer, { width: layout.width, height: layout.height }, canvas);
  const ratio = aspectRatio(layer?.aspect);
  return ratio ? fitAspect(box, ratio) : box;
}

/** A layer's box on the vertical canvas: the one it was given there, or the automatic one. */
export function verticalBox(layer, layout, canvas = verticalCanvas(layout)) {
  const placed = layout?.vertical?.boxes?.[layer.uid];
  return placed ? { x: placed.x, y: placed.y, width: placed.width, height: placed.height } : autoVerticalBox(layer, layout, canvas);
}

/**
 * The layout as one format sees it, every layer included: the vertical
 * canvas's size and each layer's vertical box. What the editor edits on the
 * vertical side; marked `_view`, so a save knows to take it apart again
 * (fromVerticalView) rather than store it as it is.
 */
export function viewOf(layout, format) {
  if (!layout || format !== 'vertical') return layout;
  const canvas = verticalCanvas(layout);
  const { vertical, ...rest } = layout;
  return {
    ...rest,
    _view: 'vertical',
    width: canvas.width,
    height: canvas.height,
    layers: (layout.layers || []).map((l) => ({ ...l, ...verticalBox(l, layout, canvas) })),
  };
}

/** The layout as an overlay of that format draws it: its view, without the layers kept to the other format. */
export function formatLayout(layout, format = 'horizontal') {
  if (!layout) return layout;
  const view = format === 'vertical' ? viewOf(layout, 'vertical') : layout;
  const { _view, ...drawn } = view;
  return { ...drawn, layers: (view.layers || []).filter((l) => shownIn(l, format)) };
}

const sameBox = (a, b) => BOX.every((k) => Math.round(Number(a[k])) === Math.round(Number(b[k])));

/**
 * The vertical view, edited, back into the layout it was made from.
 *
 * What is shared about each layer comes from the view, since that is what
 * was edited; its horizontal box stays as stored. Its box in the view is
 * kept as its vertical box only when it is not where it would be anyway: a
 * layer never moved on the vertical side keeps following its horizontal box.
 * A layer added on the vertical side, with no horizontal box yet, gets one
 * carried back from its vertical box, or none, for the server to give it its
 * kind's first place. The view's canvas size is the vertical canvas's.
 */
export function fromVerticalView(stored, view) {
  if (!view || view._view !== 'vertical') return view;
  const base = stored || { ...view, layers: [] };
  const canvas = { width: num(view.width, LIMITS.min, LIMITS.max, VERTICAL_CANVAS.width), height: num(view.height, LIMITS.min, LIMITS.max, VERTICAL_CANVAS.height) };
  const horizontal = { width: base.width, height: base.height };
  const boxes = {};
  const layers = (view.layers || []).map((vl) => {
    const sl = (base.layers || []).find((l) => l.uid === vl.uid);
    const placed = BOX.every((k) => Number.isFinite(Number(vl[k])) && vl[k] !== undefined);
    let layer;
    if (sl) {
      layer = { ...vl, x: sl.x, y: sl.y, width: sl.width, height: sl.height };
    } else if (placed) {
      layer = { ...vl, ...carryBox(vl, canvas, horizontal) };
    } else {
      const { x, y, width, height, ...rest } = vl;
      layer = rest;
    }
    if (placed && BOX.every((k) => layer[k] !== undefined)) {
      const box = { x: Math.round(vl.x), y: Math.round(vl.y), width: Math.round(vl.width), height: Math.round(vl.height) };
      if (!sameBox(box, autoVerticalBox(layer, horizontal, canvas))) boxes[vl.uid] = box;
    }
    return layer;
  });
  const { _view, width, height, layers: _l, ...shared } = view;
  const vertical = {
    ...(canvas.width !== VERTICAL_CANVAS.width || canvas.height !== VERTICAL_CANVAS.height ? { width: canvas.width, height: canvas.height } : {}),
    ...(Object.keys(boxes).length ? { boxes } : {}),
  };
  const { vertical: _old, ...rest } = { ...base, ...shared, width: base.width, height: base.height, layers };
  return Object.keys(vertical).length ? { ...rest, vertical } : rest;
}

/**
 * A saved layout's vertical side, held to its shape: a canvas size within
 * bounds, and boxes only for layers the layout has. Nothing at all when
 * there is nothing to keep — a layout never touched on the vertical side is
 * saved exactly as before.
 */
export function cleanVertical(incoming, layerUids) {
  if (!incoming || typeof incoming !== 'object') return null;
  const out = {};
  const w = num(incoming.width, LIMITS.min, LIMITS.max, VERTICAL_CANVAS.width);
  const h = num(incoming.height, LIMITS.min, LIMITS.max, VERTICAL_CANVAS.height);
  if (w !== VERTICAL_CANVAS.width || h !== VERTICAL_CANVAS.height) { out.width = w; out.height = h; }
  const uids = new Set(layerUids || []);
  const boxes = {};
  for (const [uid, b] of Object.entries(incoming.boxes && typeof incoming.boxes === 'object' ? incoming.boxes : {})) {
    if (!uids.has(uid) || !b || typeof b !== 'object') continue;
    boxes[uid] = {
      x: num(b.x, -LIMITS.max, LIMITS.max, 0),
      y: num(b.y, -LIMITS.max, LIMITS.max, 0),
      width: num(b.width, 20, LIMITS.max, 200),
      height: num(b.height, 20, LIMITS.max, 200),
    };
  }
  if (Object.keys(boxes).length) out.boxes = boxes;
  return Object.keys(out).length ? out : null;
}

/** Which format a layer is kept to, or '' for both. */
export const cleanOnly = (v) => (v === 'horizontal' || v === 'vertical' ? v : '');

/**
 * Where the phone apps draw over a vertical stream — the name and follow
 * button at the top, the comments, gifts and description along the bottom,
 * the like, share and gift buttons down the right — as a share of the
 * canvas. Approximate, and the apps change it: a guide in the editor for
 * where not to put anything that has to be read, never a rule.
 */
export const PHONE_SAFE_ZONES = Object.freeze([
  { id: 'top', x: 0, y: 0, width: 1, height: 0.08 },
  { id: 'bottom', x: 0, y: 0.75, width: 1, height: 0.25 },
  { id: 'right', x: 0.86, y: 0.3, width: 0.14, height: 0.45 },
]);
