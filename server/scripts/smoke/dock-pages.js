/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: pages of dock buttons — each a grid of the same shape, so the
 * dock is not capped at what one grid holds.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';

const {
  MAX_DOCK_PAGES, pageCount, cleanPageNames, pageOf, buttonsOnPage, firstFreeSlot, moveToPage, removePage,
} = await import('../../../shared/dock-pages.js');
const { DOCK_BUILTINS } = await import('../../../shared/dock-builtins.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

const B = (id, page, slot) => ({ id, page, slot });
const DECK = [B('a', 0, 0), B('b', 0, 2), B('c', 1, 0), B('d', 2, 1)];
const ids = (list) => list.map((b) => b.id).join(' ');

test('a dock has one page until it is given more, and never more than the most', () => {
  assert.equal(pageCount({}), 1);
  assert.equal(pageCount({ pages: 3 }), 3);
  assert.equal(pageCount({ pages: 0 }), 1);
  assert.equal(pageCount({ pages: 99 }), MAX_DOCK_PAGES);
  assert.deepEqual(cleanPageNames(['  Scenes  ', 'Sounds and   more'], 3), ['Scenes', 'Sounds and more', '']);
  assert.equal(cleanPageNames(['x'.repeat(50)], 1)[0].length, 20, 'a page name is not capped');
});

test('a button shows on its own page, and one on a page that is gone shows on the last', () => {
  assert.equal(ids(buttonsOnPage(DECK, 0, 3)), 'a b');
  assert.equal(ids(buttonsOnPage(DECK, 1, 3)), 'c');
  // With two pages, d (page 2) is still somewhere: on the last page.
  assert.equal(ids(buttonsOnPage(DECK, 1, 2)), 'c d');
  assert.equal(pageOf({ page: -4 }, 3), 0);
  assert.equal(pageOf({}, 3), 0, 'a button from before pages is not on the first');
});

test('a new button takes the first free cell of the page showing', () => {
  assert.equal(firstFreeSlot(DECK, 0, 3), 1, 'page 1 has a gap at cell 1');
  assert.equal(firstFreeSlot(DECK, 1, 3), 1);
  assert.equal(firstFreeSlot(DECK, 2, 3), 0);
});

test('a button sent to another page lands in that page\'s first free cell', () => {
  const moved = moveToPage(DECK, 'a', 1, 3);
  assert.deepEqual(moved.find((b) => b.id === 'a'), { id: 'a', page: 1, slot: 1 });
  assert.equal(moveToPage(DECK, 'a', 0, 3), DECK, 'a button sent to its own page was moved');
});

test('a page taken away takes its buttons with it, and the pages after it move up', () => {
  const left = removePage(DECK, 1, 3);
  assert.equal(ids(left), 'a b d');
  assert.equal(left.find((b) => b.id === 'd').page, 1, 'the page after did not move up');
  assert.equal(left.find((b) => b.id === 'a'), DECK[0], 'a button on an earlier page was rebuilt');
});

test('the server keeps the pages, their names, and each button\'s page', () => {
  const before = engine.store.getDockGrid();
  const grid = engine.store.setDockGrid({ pages: 3, pageNames: ['Scenes', '  Sounds ', 'x'.repeat(40), 'extra'] });
  assert.equal(grid.pages, 3);
  assert.deepEqual(grid.pageNames, ['Scenes', 'Sounds', 'x'.repeat(20)]);
  // Columns and rows alone leave the pages be.
  assert.equal(engine.store.setDockGrid({ columns: 4 }).pages, 3);
  assert.equal(engine.store.setDockGrid({ pages: 50 }).pages, MAX_DOCK_PAGES);
  engine.store.setDockGrid(before);
  assert.equal(engine.store.getDockGrid().pages, pageCount(before));
  // A built-in button needs no action set up, so the page is all that is being tested.
  const kept = engine.store.getDockButtons();
  const builtin = DOCK_BUILTINS[0].id;
  const saved = engine.store.setDockButtons([
    { id: 'p', builtin, page: 2, slot: 0 },
    { id: 'q', builtin, page: -1, slot: 1 },
    { id: 'r', builtin, page: 99, slot: 2 },
  ]);
  assert.equal(saved.find((b) => b.id === 'p').page, 2);
  assert.equal(saved.find((b) => b.id === 'q').page, 0);
  assert.equal(saved.find((b) => b.id === 'r').page, MAX_DOCK_PAGES - 1);
  engine.store.setDockButtons(kept);
});

test('the deck turns pages by its bar or a swipe, and each screen remembers its own', () => {
  const deck = read('../../web/components/DockDeck.tsx');
  assert.ok(deck.includes('<DockActionsGrid {...gridProps} page={page} pages={pages} />'), 'the deck does not draw one page');
  assert.ok(deck.includes('data-dock-pager') && deck.includes('{pages > 1 && ('), 'there is no page bar, or one with a single page');
  assert.ok(deck.includes("touchAction: 'pan-y'") && deck.includes('go(page + (dx < 0 ? 1 : -1))'), 'a swipe does not turn the page');
  assert.ok(deck.includes('onClickCapture={onClickCapture}'), 'a swipe also presses the button it started on');
  assert.ok(deck.includes('localStorage.setItem(remember, String(next))'), 'the page is forgotten');
  const app = read('../../web/App.tsx');
  assert.ok(app.includes('remember="dock_page_deck"') && app.includes('remember="dock_page_tab"'), 'the deck and the dock tab share a page');
  const grid = read('../../web/components/DockActionsGrid.tsx');
  assert.ok(grid.includes('const buttons = buttonsOnPage(everyButton, page, pages) as DockButton[];'), 'the grid draws every page at once');
  assert.ok(grid.includes('if (everyButton.length === 0) {'), 'an empty page says the whole dock is empty');
});

test('the dock screen adds to the page showing, and moves a button by its page\'s tab', () => {
  const view = read('../../web/components/views/DockActionsView.tsx');
  assert.ok(view.includes("label: '', page, slot: firstFree()"), 'a new button goes to the first page whatever is showing');
  assert.ok(view.includes('setDockButtons(moveToPage(dockButtons, id, toPage, pages) as DockButton[]);'), 'a button dropped on a tab stays where it was');
  assert.ok(view.includes('pageOf(b, pages) === page);'), 'a button trades places with one on another page');
  assert.ok(view.includes('data-dock-page={i}') && view.includes('dragOverPage(i)'), 'a tab is not somewhere to drop');
  assert.ok(view.includes('setDockButtons(removePage(dockButtons, page, pages) as DockButton[]);'), 'removing a page leaves its buttons stranded');
});
