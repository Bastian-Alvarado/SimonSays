/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Pages of dock buttons.
 *
 * Each page is a grid of its own, the same shape as the rest, so a dock is
 * not capped at what one grid holds: scenes on one page, sounds on the next.
 * A button says which page it is on; the grid says how many pages there are
 * and what each is called. A button on a page that is no longer there shows
 * on the last one, so nothing disappears when pages are taken away.
 */

export const MAX_DOCK_PAGES = 10;
const MAX_PAGE_NAME = 20;

/** How many pages, from whatever was stored: 1 to MAX_DOCK_PAGES. */
export function pageCount(grid) {
  const n = Math.round(Number(grid?.pages));
  return Number.isFinite(n) ? Math.min(MAX_DOCK_PAGES, Math.max(1, n)) : 1;
}

/**
 * Where the deck draws its numbered page buttons: under the grid, as it
 * always has, or over it. Anything else stored reads as under.
 */
export const pagerPlace = (grid) => (grid?.pagerAt === 'top' ? 'top' : 'bottom');

/** One name per page, '' where none was given. */
export function cleanPageNames(names, pages) {
  const list = Array.isArray(names) ? names : [];
  return Array.from({ length: pages }, (_, i) => String(list[i] ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PAGE_NAME));
}

/** The page a button is shown on. */
export function pageOf(button, pages) {
  const p = Number.isInteger(button?.page) && button.page > 0 ? button.page : 0;
  return Math.min(p, Math.max(1, pages) - 1);
}

export function buttonsOnPage(buttons, page, pages) {
  return (buttons || []).filter((b) => pageOf(b, pages) === page);
}

/** The first cell on a page that nothing is in, so a new button lands in a gap you can see. */
export function firstFreeSlot(buttons, page, pages) {
  const taken = new Set(buttonsOnPage(buttons, page, pages).map((b) => b.slot));
  let n = 0;
  while (taken.has(n)) n += 1;
  return n;
}

/** A button sent to another page, into its first free cell. */
export function moveToPage(buttons, id, page, pages) {
  const held = (buttons || []).find((b) => b.id === id);
  if (!held || pageOf(held, pages) === page) return buttons;
  const slot = firstFreeSlot(buttons.filter((b) => b.id !== id), page, pages);
  return buttons.map((b) => (b.id === id ? { ...b, page, slot } : b));
}

/**
 * A page taken away, with what was on it: the buttons on it come off the
 * dock, and every page after it moves up one.
 */
export function removePage(buttons, page, pages) {
  return (buttons || [])
    .filter((b) => pageOf(b, pages) !== page)
    .map((b) => {
      const p = pageOf(b, pages);
      return p > page ? { ...b, page: p - 1 } : (b.page === p ? b : { ...b, page: p });
    });
}
