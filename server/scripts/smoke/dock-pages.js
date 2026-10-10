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
  sidewaysMode, foldCells, bestFold, squareSide,
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
  assert.ok(deck.includes('data-dock-pager') && deck.includes('const pager = pages > 1 && ('), 'there is no page bar, or one with a single page');
  // A page at a time, or two at a time when two show side by side.
  assert.ok(deck.includes("touchAction: 'pan-y'") && deck.includes('go((paired ? page - (page % 2) : page) + (dx < 0 ? step : -step));'), 'a swipe does not turn the page');
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

test('the deck editor scrolls on a phone instead of squeezing the preview to nothing', () => {
  /*
    It fills the window's height on a wide screen. On a phone the two panels
    stack, and squeezing both into one screen left the preview 0px tall with
    the deck inside it needing 302 — so below lg the page scrolls and each
    part keeps the room it needs.
  */
  const view = read('../../web/components/views/DockActionsView.tsx');
  assert.ok(view.includes('className="animate-fade-in lg:h-full flex flex-col gap-6 lg:min-h-0 pb-20 lg:pb-0"'), 'the editor squeezes itself into one screen on a phone');
  assert.ok(view.includes('className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:flex-1 lg:min-h-0"'), 'the panels share one screen on a phone');
  assert.ok(view.includes('className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto flex"'), 'the preview scrolls inside a box with no height on a phone');
  assert.ok(view.includes('className="pt-4 border-t border-zinc-800/50 lg:flex-1 min-h-[9rem] flex flex-col" data-dock-preview'), 'the preview takes no room of its own on a phone');
  // Columns, rows and Open ran 290px past a phone's edge.
  assert.ok(view.includes('className="flex flex-wrap items-center gap-3" data-dock-grid-controls'), 'the grid controls run off a phone');
});

test('the page buttons go over the grid or under it, as the editor says, and are 40px', () => {
  const before = engine.store.getDockGrid ? engine.store.getDockGrid() : null;
  // Under, as always, until somebody says otherwise; anything else stored reads as under.
  assert.equal(engine.store.setDockGrid({ pages: 2 }).pagerAt, 'bottom');
  assert.equal(engine.store.setDockGrid({ pagerAt: 'top' }).pagerAt, 'top');
  assert.equal(engine.store.setDockGrid({ columns: 4 }).pagerAt, 'top', 'changing the columns moved the page buttons back');
  assert.equal(engine.store.setDockGrid({ pagerAt: 'sideways' }).pagerAt, 'bottom');
  engine.store.setDockGrid({ pagerAt: 'bottom', pages: before?.pages ?? 1, pageNames: before?.pageNames ?? [''], columns: before?.columns ?? 3 });
  const deck = read('../../web/components/DockDeck.tsx');
  assert.ok(deck.includes('{onTop && pager}') && deck.includes('{!onTop && pager}'), 'the page buttons cannot go over the grid');
  assert.ok(deck.includes("const pageBox = 'max-w-[2.5rem] h-10 text-xs';"), 'the page buttons are not 40px');
  const view = read('../../web/components/views/DockActionsView.tsx');
  assert.ok(view.includes('data-dock-pager-place') && view.includes('onClick={() => setDockGrid({ pagerAt: place })}'), 'the editor has no say in where they go');
});

// ---------------------------------------------------------------- a phone held sideways

test('sideways, a page folds its rows side by side, each row whole and in order', () => {
  const page = Array.from({ length: 24 }, (_, i) => i);
  // A 4×6 page folded twice is 8×3: rows 1 and 2 make the new first row.
  const folded = foldCells(page, 4, 2);
  assert.deepEqual(folded.slice(0, 8), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(folded.slice(16, 24), [16, 17, 18, 19, 20, 21, 22, 23]);
  assert.deepEqual(foldCells(page, 4, 1), page, 'not folding changed the page');
  // An odd number of rows leaves the end of the last folded row empty, not another row's buttons.
  assert.deepEqual(foldCells([0, 1, 2, 3, 4, 5], 2, 2), [0, 1, 2, 3, 4, 5, null, null]);
  // Folded as far as makes the buttons biggest: a phone's 780×350 takes 8×3, ~91px buttons rather than ~52.
  assert.equal(bestFold(4, 6, 780, 350, 8), 2);
  assert.ok(squareSide(8, 3, 780, 350, 8) > squareSide(4, 6, 780, 350, 8) * 1.6);
  // Upright, or a page of one row, nothing is gained, so nothing folds.
  assert.equal(bestFold(4, 6, 390, 700, 8), 1);
  assert.equal(bestFold(4, 1, 780, 350, 8), 1);
});

test('sideways it folds unless the Dock Actions screen asks for two pages at once', () => {
  const before = engine.store.getDockGrid();
  assert.equal(sidewaysMode({}), 'fold');
  assert.equal(engine.store.setDockGrid({ sideways: 'pages' }).sideways, 'pages');
  assert.equal(engine.store.setDockGrid({ columns: 4 }).sideways, 'pages', 'changing the columns forgot the choice');
  assert.equal(engine.store.setDockGrid({ sideways: 'upside-down' }).sideways, 'fold');
  engine.store.setDockGrid({ ...before, sideways: before?.sideways ?? 'fold' });
  const view = read('../../web/components/views/DockActionsView.tsx');
  assert.ok(view.includes('onClick={() => setDockGrid({ sideways: how })}') && view.includes('data-dock-sideways-place'), 'there is nowhere to choose');
});

test('on a phone held sideways the tabs and page buttons stand at the sides, and the grid fills the rest', () => {
  const hook = read('../../web/hooks/useSideways.ts');
  // A touch screen, wider than tall, and short: not a tablet, not a wide OBS dock with a mouse.
  assert.ok(hook.includes("'(orientation: landscape) and (max-height: 600px) and (hover: none) and (pointer: coarse)'"));
  const deck = read('../../web/components/DockDeck.tsx');
  assert.ok(deck.includes('const sideways = useSideways();') && deck.includes('data-dock-pager-at="side"'), 'the page buttons stay over or under the grid sideways');
  assert.ok(deck.includes('<DockActionsGrid {...gridProps} page={page} pages={pages} fit={boxSize} />'), 'the grid is not given the box to fill');
  assert.ok(deck.includes("const paired = sideways && sidewaysMode(grid) === 'pages' && pages > 1;"));
  const grid = read('../../web/components/DockActionsGrid.tsx');
  // Never folded while it is being arranged: the arrangement is the upright one.
  assert.ok(grid.includes('const fitting = Boolean(fit && fit.width > 0 && fit.height > 0 && !preview && !arrange);'));
  const tabs = read('../../web/components/DockTabs.tsx');
  assert.ok(tabs.includes('data-dock-tabs-side'), 'the dock tabs have no column');
  const app = read('../../web/App.tsx');
  assert.ok(app.includes('vertical={dockSideways} footer={dockSideways ? <ScreenControls t={t} /> : null}'), 'the dock does not stand its tabs at the side');
  assert.ok(app.includes('railExtras={<ScreenControls t={t} />}'), 'the deck page has no full-screen or keep-awake buttons');
  assert.equal(app.split('<HoldAwake />').length - 1, 2, 'keeping the screen on is not held on both deck pages');
});

test('full screen and keep the screen on are only offered where the browser can do them', () => {
  const controls = read('../../web/components/ScreenControls.tsx');
  assert.ok(controls.includes('document.fullscreenEnabled && document.documentElement.requestFullscreen'));
  // Keeping the screen on needs a secure page: never offered on plain http on the home network.
  assert.ok(controls.includes('window.isSecureContext && (navigator as any).wakeLock?.request'));
  // Asked for again when the page comes back: the browser lets go of it whenever it is hidden.
  assert.ok(controls.includes("document.addEventListener('visibilitychange', take);"));
  const constants = read('../../web/constants.ts');
  for (const key of ['dockSidewaysPlace', 'dockSidewaysFold', 'dockSidewaysPages', 'dockSidewaysFoldHint', 'dockSidewaysPagesHint', 'screenFullscreenOn', 'screenFullscreenOff', 'screenAwakeOn', 'screenAwakeOff']) {
    assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
});
