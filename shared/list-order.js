/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Where a dragged row lands, for every list that can be put in order by
 * dragging (web/hooks/useDragOrder.tsx).
 */

/**
 * The list with the item at `from` moved to a gap: gap 0 is before the
 * first item, gap n after the last. The same array comes back when nothing
 * would move — the gaps either side of the item itself, or an item that is
 * not there — so a caller can tell a drop that changed nothing.
 */
export function moveToGap(list, from, gap) {
  if (!Array.isArray(list) || from < 0 || from >= list.length) return list;
  const at = Math.max(0, Math.min(list.length, Math.round(Number(gap) || 0)));
  if (at === from || at === from + 1) return list;
  const next = [...list];
  const [moving] = next.splice(from, 1);
  next.splice(at > from ? at - 1 : at, 0, moving);
  return next;
}

/** Where the item from `from` sits after moveToGap — for keeping it selected. */
export function landedAt(from, gap) {
  return gap > from ? gap - 1 : gap;
}

/**
 * A step moved to a gap in whichever list holds it — an action's own steps,
 * or a condition's then or else — and only within that list: a drag moves a
 * step among its neighbours, never into another branch. The same array comes
 * back when nothing moved.
 */
export function moveInTree(list, id, gap, branches = ['thenActions', 'elseActions']) {
  if (!Array.isArray(list)) return list;
  const at = list.findIndex((item) => item && item.id === id);
  if (at >= 0) return moveToGap(list, at, gap);
  let changed = false;
  const next = list.map((item) => {
    if (!item) return item;
    let out = item;
    for (const key of branches) {
      if (!Array.isArray(item[key])) continue;
      const moved = moveInTree(item[key], id, gap, branches);
      if (moved === item[key]) continue;
      if (out === item) out = { ...item };
      out[key] = moved;
      changed = true;
    }
    return out;
  });
  return changed ? next : list;
}
