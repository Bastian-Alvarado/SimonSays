/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The button grid with its pages, as the deck draws it: on its own
 * (?mode=dock-actions) and in the chat dock's tab.
 *
 * One page at a time. With more than one there is a bar under the grid, or
 * over it if the Dock Actions screen says so — a numbered button for each
 * page, so page 5 is one tap away rather than four, with the page's name over
 * them when it has one — and on a touch screen a sideways swipe turns the page. Which page is showing belongs to the screen
 * it is on, not to the dock, so a phone and OBS can each be on their own;
 * each remembers where it was.
 *
 * On a phone held sideways (useSideways) the height is what is short, so the
 * page buttons stand in a column at the right instead, and the grid fills the
 * rest: folded so its rows sit side by side and the buttons can grow into the
 * width, or — if the Dock Actions screen says so — two pages next to each
 * other at their usual shape.
 */
import React, { useEffect, useRef, useState } from 'react';
import { DockActionsGrid } from './DockActionsGrid';
import { cleanPageNames, pageCount, pagerPlace, sidewaysMode } from '../../shared/dock-pages.js';
import { useSideways } from '../hooks/useSideways';
import { fill } from '../words';

type GridProps = React.ComponentProps<typeof DockActionsGrid>;

type Props = Omit<GridProps, 'page' | 'pages' | 'preview' | 'arrange'> & {
  /** The grid's settings: how many pages, what each is called, and whether their buttons go over the grid or under it. */
  grid: { pages?: number; pageNames?: string[]; pagerAt?: 'top' | 'bottom'; sideways?: 'fold' | 'pages' };
  /** Where this screen keeps the page it was on. */
  remember: string;
  /** Under the page buttons when the phone is sideways: the full-screen and keep-awake buttons, on a deck of its own. */
  railExtras?: React.ReactNode;
};

/** The size of an element, kept up to date: a ref to put on it, and its width and height. */
function useBoxSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!el) return undefined;
    const measure = () => setSize((was) => (was.width === el.clientWidth && was.height === el.clientHeight ? was : { width: el.clientWidth, height: el.clientHeight }));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [el]);
  return [setEl, size] as const;
}

const SWIPE = 50;

export const DockDeck = ({ grid, remember, railExtras, ...gridProps }: Props) => {
  const { t, compact } = gridProps;
  const pages = pageCount(grid);
  const sideways = useSideways();
  // Two pages at a time, sideways, when the Dock Actions screen asks for it and there is a second page to show.
  const paired = sideways && sidewaysMode(grid) === 'pages' && pages > 1;
  const [box, boxSize] = useBoxSize<HTMLDivElement>();
  const names = cleanPageNames(grid?.pageNames, pages);
  const [stored, setStored] = useState(() => {
    try {
      const n = Number(localStorage.getItem(remember));
      return Number.isInteger(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  });
  const page = Math.min(stored, pages - 1);
  const go = (n: number) => {
    const next = ((n % pages) + pages) % pages;
    setStored(next);
    try { localStorage.setItem(remember, String(next)); } catch { /* private mode */ }
  };

  /*
    A swipe is a finger that went further sideways than down. It turns the
    page, and the press it started on a button does not fire as well — the
    click it would end in is swallowed.
  */
  const from = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || pages < 2) return;
    from.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = from.current;
    from.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped.current = true;
      // Two pages at a time turn two at a time.
      const step = paired ? 2 : 1;
      go((paired ? page - (page % 2) : page) + (dx < 0 ? step : -step));
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swiped.current) return;
    swiped.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  // A page's own name, or "Page 3" — for the tooltip; the button itself says 3.
  const nameOf = (i: number) => names[i] || fill(t.dockPageNumber || 'Page {n}', { n: String(i + 1) });
  // 40px, big enough for a thumb, and narrowing on a small phone so all ten stay on one row.
  const pageBox = 'max-w-[2.5rem] h-10 text-xs';
  const onTop = pagerPlace(grid) === 'top';
  // The pair showing, sideways with two pages at a time: an even page and the one after it.
  const firstShown = paired ? page - (page % 2) : page;
  const shownTogether = (i: number) => paired && i !== page && (i === firstShown || i === firstShown + 1);

  const pager = pages > 1 && (
    <div className={`flex-shrink-0 flex flex-col items-center gap-1.5 ${onTop ? (compact ? 'pb-2' : 'pb-3') : (compact ? 'pt-2' : 'pt-3')}`} data-dock-pager data-dock-pager-at={onTop ? 'top' : 'bottom'}>
      {names[page] && (
        <span className={`font-black uppercase tracking-widest text-zinc-300 truncate max-w-full ${compact ? 'text-[8px]' : 'text-[10px]'}`} data-dock-page-name>{names[page]}</span>
      )}
      <div className="w-full flex items-center justify-center gap-1">
        {names.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            title={nameOf(i)}
            aria-label={nameOf(i)}
            aria-current={i === page ? 'page' : undefined}
            className={`${pageBox} flex-1 min-w-0 rounded-lg border font-black tabular-nums transition-colors ${
              i === page
                ? 'bg-current-accent border-transparent text-white'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
            data-dock-page-number={i}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );

  const swipe = {
    style: pages > 1 ? { touchAction: 'pan-y' as const } : undefined,
    onPointerDown,
    onPointerUp,
    onPointerCancel: () => { from.current = null; },
    onClickCapture,
  };

  if (sideways) {
    /*
      The page buttons in a column at the right, the page's name over them,
      shrinking together so ten still fit the height; and the grid in the box
      that is left, measured so the buttons can be as big as it allows.
    */
    const half = Math.max(0, (boxSize.width - 8) / 2);
    return (
      <div className="w-full h-full min-h-0 flex flex-row gap-2" data-dock-deck data-dock-deck-page={page} data-dock-sideways={paired ? 'pages' : 'fold'}>
        <div ref={box} className="flex-1 min-w-0 min-h-0 flex gap-2" {...swipe}>
          {paired ? (
            <>
              <div className="flex-1 min-w-0 min-h-0" data-dock-pair={firstShown}>
                <DockActionsGrid {...gridProps} page={firstShown} pages={pages} fit={{ width: half, height: boxSize.height }} foldable={false} />
              </div>
              {firstShown + 1 < pages && (
                <div className="flex-1 min-w-0 min-h-0" data-dock-pair={firstShown + 1}>
                  <DockActionsGrid {...gridProps} page={firstShown + 1} pages={pages} fit={{ width: half, height: boxSize.height }} foldable={false} />
                </div>
              )}
            </>
          ) : (
            <DockActionsGrid {...gridProps} page={page} pages={pages} fit={boxSize} />
          )}
        </div>
        {(pages > 1 || railExtras) && (
          <div className="w-11 flex-shrink-0 flex flex-col items-center gap-1 min-h-0" data-dock-pager data-dock-pager-at="side">
            {pages > 1 && names[page] && (
              <span className="w-full text-center font-black uppercase tracking-widest text-zinc-300 text-[7px] leading-tight break-words" data-dock-page-name>{names[page]}</span>
            )}
            {pages > 1 && (
              <div className="w-full flex-1 min-h-0 flex flex-col items-stretch justify-center gap-1">
                {names.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => go(i)}
                    title={nameOf(i)}
                    aria-label={nameOf(i)}
                    aria-current={i === page ? 'page' : undefined}
                    className={`flex-1 min-h-0 max-h-10 rounded-lg border font-black tabular-nums text-xs transition-colors ${
                      i === page
                        ? 'bg-current-accent border-transparent text-white'
                        : shownTogether(i)
                          ? 'bg-current-accent/25 border-current-accent/50 text-white'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
                    }`}
                    data-dock-page-number={i}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
            {railExtras && <div className="mt-auto pt-1">{railExtras}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col" data-dock-deck data-dock-deck-page={page}>
      {onTop && pager}
      <div
        className="flex-1 min-h-0"
        style={pages > 1 ? { touchAction: 'pan-y' } : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { from.current = null; }}
        onClickCapture={onClickCapture}
      >
        <DockActionsGrid {...gridProps} page={page} pages={pages} />
      </div>
      {!onTop && pager}
    </div>
  );
};
