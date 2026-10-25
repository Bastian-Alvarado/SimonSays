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
import { tidyGroups, GROUP_ID, MAX_GROUPS, cleanGroupName } from './layer-groups.js';

/*
  The vertical side's own groups, and its own order of layers. Until the
  groups or the order are changed on the vertical side it follows the
  horizontal one's; once they are, it keeps them — in `layout.vertical`
  as `groups` (its folders), `group` (each layer's, by uid) and `order`
  (the layers' uids, back to front) — and the horizontal side's are left
  alone. Groups need their layers side by side in the stack, so groups of
  their own mean an order of their own: the vertical overlay draws its
  layers in it. A layer the vertical side has not placed in its order yet
  (added on the horizontal side since) goes to the front.
*/
const hasOwnGrouping = (v) => Boolean(v && (Array.isArray(v.groups) || Array.isArray(v.order)));

/** The layers in the vertical side's order, with its groups: what the vertical view and overlay go by. */
function verticalGrouping(layout) {
  const v = layout?.vertical;
  const layers = layout?.layers || [];
  if (!hasOwnGrouping(v)) return { layers, groups: layout?.groups || [] };
  const byUid = new Map(layers.map((l) => [l.uid, l]));
  const order = Array.isArray(v.order) ? v.order.filter((u) => byUid.has(u)) : layers.map((l) => l.uid);
  const placed = new Set(order);
  const ordered = [...order.map((u) => byUid.get(u)), ...layers.filter((l) => !placed.has(l.uid))];
  // An order of its own with the horizontal side's groups: those groups' layers gathered side by side in it, as any groups' are.
  if (!Array.isArray(v.groups)) return tidyGroups(ordered, layout?.groups || []);
  const own = v.group && typeof v.group === 'object' ? v.group : {};
  const regrouped = ordered.map((l) => {
    const { group: _horizontal, ...rest } = l;
    return own[l.uid] ? { ...rest, group: own[l.uid] } : rest;
  });
  return tidyGroups(regrouped, v.groups);
}

/** The layout following its horizontal side's groups and order again: the vertical side's own left out. */
export function sharedGrouping(layout) {
  if (!hasOwnGrouping(layout?.vertical)) return layout;
  const { groups: _g, group: _m, order: _o, ...v } = layout.vertical;
  const { vertical: _v, ...rest } = layout;
  return Object.keys(v).length ? { ...rest, vertical: v } : rest;
}

/** Whether a layout's vertical side keeps groups or an order of its own. */
export const ownVerticalGrouping = (layout) => hasOwnGrouping(layout?.vertical);

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
  const grouped = verticalGrouping(layout);
  return {
    ...rest,
    _view: 'vertical',
    width: canvas.width,
    height: canvas.height,
    groups: grouped.groups,
    layers: grouped.layers.map((l) => ({ ...l, ...verticalBox(l, layout, canvas) })),
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
  const storedOf = new Map((base.layers || []).map((l) => [l.uid, l]));
  const converted = (view.layers || []).map((vl) => {
    const sl = storedOf.get(vl.uid);
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
    // Its horizontal group is the horizontal side's: kept as stored (none for a layer new here).
    const { group: _vertical, ...shared } = layer;
    return sl?.group ? { ...shared, group: sl.group } : shared;
  });
  // The horizontal side's order stays as stored; a layer new on the vertical side goes to the front of it.
  const byUid = new Map(converted.map((l) => [l.uid, l]));
  const layers = [
    ...(base.layers || []).filter((l) => byUid.has(l.uid)).map((l) => byUid.get(l.uid)),
    ...converted.filter((l) => !storedOf.has(l.uid)),
  ];
  // The vertical side's groups and order, as the view left them: kept only where they are not the horizontal side's.
  const viewOrder = (view.layers || []).map((l) => l.uid);
  const sameOrder = viewOrder.length === layers.length && viewOrder.every((u, i) => layers[i].uid === u);
  const viewGroups = (Array.isArray(view.groups) ? view.groups : []).map((g) => ({ id: g.id, name: g.name }));
  const baseGroups = (Array.isArray(base.groups) ? base.groups : []).map((g) => ({ id: g.id, name: g.name }));
  const memberOf = Object.fromEntries((view.layers || []).filter((l) => l.group).map((l) => [l.uid, l.group]));
  const sameGroups = layers.every((l) => (memberOf[l.uid] || '') === (l.group || ''))
    && JSON.stringify([...viewGroups].sort((a, b) => a.id.localeCompare(b.id))) === JSON.stringify([...baseGroups].sort((a, b) => a.id.localeCompare(b.id)));
  const { _view, width, height, layers: _l, groups: _g, ...shared } = view;
  const vertical = {
    ...(canvas.width !== VERTICAL_CANVAS.width || canvas.height !== VERTICAL_CANVAS.height ? { width: canvas.width, height: canvas.height } : {}),
    ...(Object.keys(boxes).length ? { boxes } : {}),
    ...(sameGroups ? {} : { groups: viewGroups, group: memberOf }),
    ...(sameOrder && sameGroups ? {} : { order: viewOrder }),
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
  // Its own order and groups, when it has them: layers the layout has, groups that hold something, each group's layers side by side.
  if (Array.isArray(incoming.order) || Array.isArray(incoming.groups)) {
    const order = [...new Set((Array.isArray(incoming.order) ? incoming.order : [...uids]).map(String).filter((u) => uids.has(u)))];
    if (Array.isArray(incoming.groups)) {
      const member = incoming.group && typeof incoming.group === 'object' ? incoming.group : {};
      const groups = incoming.groups
        .filter((g) => g && GROUP_ID.test(String(g.id)))
        .slice(0, MAX_GROUPS)
        .map((g) => ({ id: String(g.id), name: cleanGroupName(g.name) }));
      const tidy = tidyGroups(order.map((uid) => (member[uid] ? { uid, group: String(member[uid]) } : { uid })), groups);
      out.order = tidy.layers.map((l) => l.uid);
      out.groups = tidy.groups;
      out.group = Object.fromEntries(tidy.layers.filter((l) => l.group).map((l) => [l.uid, l.group]));
    } else {
      out.order = order;
    }
  }
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
