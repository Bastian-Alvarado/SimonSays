/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Groups of overlay layers: folders in the editor's list whose layers move
 * and resize together on the canvas.
 *
 * A group is a name on the layout and the same `group` id on each of its
 * layers. Nothing on stream reads either — a group is how the layers are
 * arranged in the editor, not something drawn — so the overlay renders
 * exactly as it would without them.
 *
 * Its layers sit side by side in the stack, the way a folder's do, so a group
 * goes in front of or behind other layers as one. tidyGroups keeps that true
 * whatever happens to the list, and drops what no longer means anything: a
 * group with no layers left, a layer naming a group that is gone.
 */

import { moveToGap } from './list-order.js';

export const MAX_GROUPS = 20;
export const GROUP_ID = /^[A-Za-z0-9_-]{1,24}$/;
const MIN_SIZE = 20;

/** A group's row in the list is addressed by this, so it can never be mistaken for a layer's. */
export const groupKey = (id) => `group:${id}`;

export const newGroupId = () => Math.random().toString(36).slice(2, 11);

export function cleanGroupName(name, fallback = 'Group') {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return s || fallback;
}

/**
 * The layers and groups as they are kept: every group named and holding at
 * least one layer, every layer's group one that exists, and each group's
 * layers side by side — gathered where the frontmost of them was, in the
 * order they were in. A layout with no groups comes back in the same order.
 */
export function tidyGroups(layers, groups) {
  const list = Array.isArray(layers) ? layers : [];
  const seen = new Set();
  const named = (Array.isArray(groups) ? groups : [])
    .filter((g) => g && GROUP_ID.test(String(g.id)) && !seen.has(g.id) && seen.add(g.id))
    .slice(0, MAX_GROUPS)
    .map((g) => ({ id: g.id, name: cleanGroupName(g.name) }));
  const known = new Set(named.map((g) => g.id));
  const placed = list.map((l) => {
    if (!l || !Object.prototype.hasOwnProperty.call(l, 'group')) return l;
    if (known.has(l.group)) return l;
    const { group, ...rest } = l;
    return rest;
  });
  const last = new Map();
  placed.forEach((l, i) => { if (l?.group) last.set(l.group, i); });
  const out = [];
  placed.forEach((l, i) => {
    if (!l?.group) { out.push(l); return; }
    if (last.get(l.group) !== i) return;
    for (const m of placed) if (m?.group === l.group) out.push(m);
  });
  return { layers: out, groups: named.filter((g) => last.has(g.id)) };
}

/**
 * The list as the editor shows it, front first: each layer outside a group
 * on its own, and each group as one item holding its layers, front first.
 */
export function displayUnits(layers) {
  const units = [];
  const at = new Map();
  for (const l of [...(layers || [])].reverse()) {
    if (l?.group) {
      if (!at.has(l.group)) {
        at.set(l.group, units.length);
        units.push({ id: groupKey(l.group), group: l.group, layers: [] });
      }
      units[at.get(l.group)].layers.push(l);
    } else {
      units.push({ id: l.uid, layer: l, layers: [l] });
    }
  }
  return units;
}

/**
 * One of a group's layers moved to a gap among the others, as the list shows
 * them (front first). It stays in its group: leaving one is its own button.
 */
export function dropInGroup(layers, groupId, uid, gap) {
  const idx = [];
  layers.forEach((l, i) => { if (l.group === groupId) idx.push(i); });
  const shown = idx.map((i) => layers[i]).reverse();
  const moved = moveToGap(shown, shown.findIndex((l) => l.uid === uid), gap);
  if (moved === shown) return layers;
  const back = [...moved].reverse();
  const next = [...layers];
  idx.forEach((i, n) => { next[i] = back[n]; });
  return next;
}

/** The box a group's layers fill between them, in canvas pixels. */
export function groupBox(members) {
  if (!members?.length) return null;
  const x = Math.min(...members.map((l) => l.x));
  const y = Math.min(...members.map((l) => l.y));
  const right = Math.max(...members.map((l) => l.x + l.width));
  const bottom = Math.max(...members.map((l) => l.y + l.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Where each layer goes when its group's box goes from one place and size to
 * another: every layer keeps its place in the box, stretched as the box was.
 * Worked out from where they started, so a long drag never drifts.
 */
export function fitGroup(members, from, to) {
  const sx = from.width ? to.width / from.width : 1;
  const sy = from.height ? to.height / from.height : 1;
  /** @type {Record<string, { x: number, y: number, width: number, height: number }>} */
  const out = {};
  for (const l of members) {
    out[l.uid] = {
      x: Math.round(to.x + (l.x - from.x) * sx),
      y: Math.round(to.y + (l.y - from.y) * sy),
      width: Math.max(MIN_SIZE, Math.round(l.width * sx)),
      height: Math.max(MIN_SIZE, Math.round(l.height * sy)),
    };
  }
  return out;
}

/** Put these layers in a group — a new one, or one that is already there. */
export function groupLayers(layers, groups, uids, group) {
  const pick = new Set(uids);
  const has = (groups || []).some((g) => g.id === group.id);
  return tidyGroups(
    layers.map((l) => (pick.has(l.uid) ? { ...l, group: group.id } : l)),
    has ? groups : [...(groups || []), group],
  );
}

/** Take one layer out of its group, or every layer out of one. */
export function ungroupLayers(layers, groups, { uid, group } = {}) {
  return tidyGroups(
    layers.map((l) => {
      if (!l.group || (uid ? l.uid !== uid : l.group !== group)) return l;
      const { group: _gone, ...rest } = l;
      return rest;
    }),
    groups,
  );
}
