/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The button grid with its pages, as the deck draws it: on its own
 * (?mode=dock-actions) and in the chat dock's tab.
 *
 * One page at a time. With more than one there is a bar under the grid —
 * back, a dot for each page, forward, and the page's name — and on a touch
 * screen a sideways swipe turns the page. Which page is showing belongs to
 * the screen it is on, not to the dock, so a phone and OBS can each be on
 * their own; each remembers where it was.
 */
import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DockActionsGrid } from './DockActionsGrid';
import { cleanPageNames, pageCount } from '../../shared/dock-pages.js';
import { fill } from '../words';

type GridProps = React.ComponentProps<typeof DockActionsGrid>;

type Props = Omit<GridProps, 'page' | 'pages' | 'preview' | 'arrange'> & {
  /** The grid's settings: how many pages, and what each is called. */
  grid: { pages?: number; pageNames?: string[] };
  /** Where this screen keeps the page it was on. */
  remember: string;
};

const SWIPE = 50;

export const DockDeck = ({ grid, remember, ...gridProps }: Props) => {
  const { t, compact } = gridProps;
  const pages = pageCount(grid);
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
      go(page + (dx < 0 ? 1 : -1));
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swiped.current) return;
    swiped.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const label = names[page] || fill(t.dockPageNumber || 'Page {n}', { n: String(page + 1) });
  const arrow = `rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors ${compact ? 'p-1' : 'p-1.5'}`;

  return (
    <div className="w-full h-full min-h-0 flex flex-col" data-dock-deck data-dock-deck-page={page}>
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
      {pages > 1 && (
        <div className={`flex-shrink-0 flex items-center justify-center gap-2 ${compact ? 'pt-2' : 'pt-3'}`} data-dock-pager>
          <button onClick={() => go(page - 1)} title={t.dockPagePrev || 'Previous page'} className={arrow} data-dock-page-prev>
            <ChevronLeft size={compact ? 14 : 18} />
          </button>
          <div className="flex flex-col items-center gap-1 min-w-0">
            <span className={`font-black uppercase tracking-widest text-zinc-300 truncate max-w-[12rem] ${compact ? 'text-[8px]' : 'text-[10px]'}`}>{label}</span>
            <div className="flex items-center gap-1.5">
              {names.map((name, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  title={name || fill(t.dockPageNumber || 'Page {n}', { n: String(i + 1) })}
                  className={`rounded-full transition-all ${i === page ? 'w-4 h-1.5 bg-current-accent' : 'w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500'}`}
                  data-dock-page-dot={i}
                />
              ))}
            </div>
          </div>
          <button onClick={() => go(page + 1)} title={t.dockPageNext || 'Next page'} className={arrow} data-dock-page-next>
            <ChevronRight size={compact ? 14 : 18} />
          </button>
        </div>
      )}
    </div>
  );
};
