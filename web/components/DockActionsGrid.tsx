/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Dock Actions button grid.
 *
 * Rendered both as its own surface (?mode=dock-actions, for an OBS custom
 * browser dock or a phone) and as a preview inside the configuration screen,
 * so the thing being configured is the thing you see.
 *
 * Buttons fire through RUN_DOCK_ACTION, which the server awaits and answers.
 * That reply is the whole point of the feedback here: most actions are silent
 * — an OBS scene switch looks identical whether it worked or not — so a button
 * that cannot fail visibly is a button you stop trusting.
 */
import React, { useState } from 'react';
import { DockButton, StreamAction } from '../types';
import { dockBuiltin } from '../../shared/dock-builtins.js';
import { buttonsOnPage } from '../../shared/dock-pages.js';
import { youtubeCategoryName } from '../../shared/youtube-categories.js';
import { builtinName, refusalWords } from '../words';
import { Check, AlertTriangle, Loader2, Zap } from 'lucide-react';

interface DockActionsGridProps {
  buttons: DockButton[];
  streamActions: StreamAction[];
  runDockAction: (ref: string | { id?: string; builtin?: string }) => Promise<any>;
  /** The server's live numbers, for a button that shows a state — the YouTube category. */
  stats?: Record<string, any>;
  columns?: number;
  /**
   * How many rows the grid has, or 0 for as many as it takes.
   *
   * With rows the grid is sized to its box: the buttons are the largest
   * squares that let every row and column fit, which is what lets a tall
   * narrow dock and a wide short strip both be filled without scrolling.
   */
  rows?: number;
  /** Which page to draw, of how many. Each page is a grid of this shape; see shared/dock-pages.js. */
  page?: number;
  pages?: number;
  /** Shrinks the internals for the configuration screen's preview. */
  compact?: boolean;
  /**
   * Draw it without letting it be pressed, and show the cells nobody has
   * filled.
   *
   * The preview on the configuration screen sits under a list you arrange by
   * dragging, and a grid of live buttons there is a row of tripwires: reach for
   * one to move it and you fire the action instead. It is a picture of the
   * grid, so it behaves like one — and being a picture, it is the right place
   * to show the empty cells, which the dock itself should not be littered with.
   */
  preview?: boolean;
  /**
   * Lets the grid be rearranged by dragging a button around inside it.
   *
   * Arranging a grid by dragging a list beside it is arranging one thing by
   * looking at another. The grid is the thing being arranged, so the grid is
   * what you move, and the drop target is the cell you want it in — including
   * the ones nobody has filled yet.
   *
   * Every cell is a place, whether or not anything is in it, so the drop
   * target is a cell index rather than another button. Dropping onto an
   * occupied one trades places with whatever was there.
   */
  arrange?: {
    dragId: string | null;
    /** The cell under the pointer, so it can be shown before anything moves. */
    overCell: number | null;
    start: (id: string) => void;
    over: (cell: number) => void;
    /** Over another page's tab, which takes the button to that page. */
    overPage?: (page: number) => void;
    drop: () => void;
  };
  t: any;
}

type Fired = 'running' | 'ok' | 'failed';

/** Platform tint for the action behind a button, matching the Actions screen. */
const tintFor = (category?: string) => (
  category === 'twitch' ? 'border-[#9146FF]/40 hover:border-[#9146FF] text-[#9146FF]'
    : category === 'tiktok' ? 'border-[#ff0050]/40 hover:border-[#ff0050] text-[#ff0050]'
      : category === 'spotify' ? 'border-[#1DB954]/40 hover:border-[#1DB954] text-[#1DB954]'
      : category === 'youtube' ? 'border-[#FF0000]/40 hover:border-[#FF0000] text-[#FF0000]'
        : category === 'obs' ? 'border-zinc-500/40 hover:border-zinc-400 text-zinc-300'
        : category === 'system' || category === 'countdown' ? 'border-sky-500/40 hover:border-sky-400 text-sky-400'
        : category === 'avatar' ? 'border-[#eb4fef]/40 hover:border-[#eb4fef] text-[#eb4fef]'
        : category === 'deaths' ? 'border-[#ff2b2b]/40 hover:border-[#ff2b2b] text-[#ff5a5a]'
        : category === 'twitch' ? 'border-[#9146ff]/40 hover:border-[#9146ff] text-[#a970ff]'
          : 'border-current-accent/40 hover:border-current-accent text-current-accent'
);

export const DockActionsGrid: React.FC<DockActionsGridProps> = ({
  buttons: everyButton, streamActions, runDockAction, stats, columns = 3, rows = 0,
  page = 0, pages = 1, compact = false, preview = false, arrange, t,
}) => {
  // This page's buttons. The rest of the dock is somebody else's grid.
  const buttons = buttonsOnPage(everyButton, page, pages) as DockButton[];
  const iconSize = compact ? 14 : 18;
  const [fired, setFired] = useState<Record<string, Fired>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const press = async (button: DockButton) => {
    /*
      A press while one is in flight is normally a double-tap rather than a
      second intent, and firing an OBS scene switch twice is messy and easy to
      do on a phone. Some buttons mean the opposite: pressing volume four times
      is four tenths, and they arrive faster than a round trip, so refusing them
      is the button appearing not to work.
    */
    const repeatable = Boolean(dockBuiltin(button.builtin || '')?.repeatable);
    if (!repeatable && fired[button.id] === 'running') return;

    setFired((p) => ({ ...p, [button.id]: 'running' }));
    setErrors((p) => ({ ...p, [button.id]: '' }));
    try {
      await runDockAction(button.builtin ? { builtin: button.builtin } : { id: button.actionId });
      setFired((p) => ({ ...p, [button.id]: 'ok' }));
    } catch (err: any) {
      setFired((p) => ({ ...p, [button.id]: 'failed' }));
      setErrors((p) => ({ ...p, [button.id]: refusalWords(t, err) || t.dockActionsFailed || 'Failed' }));
    } finally {
      setTimeout(() => setFired((p) => ({ ...p, [button.id]: undefined as any })), 1800);
    }
  };

  if (everyButton.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700 mb-4 border border-zinc-800">
          <Zap size={26} />
        </div>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t.dockActionsEmpty}</p>
      </div>
    );
  }

  /*
    How many cells the grid has, so the ones nobody has filled can be drawn.

    With rows it is simply the two multiplied. Without, the grid takes as many
    rows as the buttons need, and the gap is whatever is left over on the last
    one — which is still a gap worth seeing while you are arranging.
  */
  /*
    The grid, cell by cell, with nothing in the ones nobody claimed.

    A button owns a cell rather than a place in a queue, so the gaps are
    wherever they were left. Two things still have to be true: nothing can
    disappear, and the grid has to be big enough to hold what is in it. So a
    button whose cell is off the end of the grid, or whose cell somebody else
    got to first, lands in the first free one instead — and with the rows left
    to the content, the grid takes as many as the arrangement needs.
  */
  const claimed = buttons.filter((b) => Number.isInteger(b.slot) && b.slot >= 0);
  const highest = claimed.reduce((n, b) => Math.max(n, b.slot), -1);
  /*
    Told a number of rows, that is the number of rows — a grid asked for two by
    two is two by two, and a button parked outside it comes back inside rather
    than dragging the whole board out to reach it. The only thing that grows it
    is having more buttons than cells, because nothing may vanish.

    Left on auto there is no such instruction, so it takes as many rows as the
    arrangement needs, which is enough to hold the cell parked furthest out.
  */
  const toHold = Math.max(Math.ceil(buttons.length / columns), 1);
  const toReach = Math.ceil((highest + 1) / columns);
  const cells = columns * (rows > 0 ? Math.max(rows, toHold) : Math.max(toHold, toReach));

  const layout: (typeof buttons[number] | null)[] = Array.from({ length: cells }, () => null);
  const homeless: typeof buttons = [];
  for (const b of buttons) {
    const at = Number.isInteger(b.slot) ? b.slot : -1;
    if (at >= 0 && at < cells && !layout[at]) layout[at] = b;
    else homeless.push(b);
  }
  for (const b of homeless) {
    const free = layout.findIndex((c) => c === null);
    if (free >= 0) layout[free] = b;
  }

  /*
    Every button is square and fills its cell.

    Stretching one to a cell's shape would make a row of one a row of enormous
    letterboxes, and the whole point of a grid of buttons is that they are the
    same size and the same shape wherever they are. So it is the cells that are
    square: sized below from the box when the rows are set, and from the width
    alone when they are left to the content.
  */
  /*
    A preview never fires an action. It only goes dead to the pointer when
    there is nothing else to do with it — being dragged is a use for a pointer,
    and a disabled button receives no drag events at all.
  */
  const inert = preview && !arrange;

  /*
    A finger, which the browser's drag and drop does not carry: the same
    start, over and drop, from pointer events, with the cell under the finger
    found by asking what is there. A mouse keeps the drag and drop.
  */
  const touchArrange = (id: string) => (arrange ? {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the cell is found by position either way */ }
      arrange.start(id);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return;
      const at = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-dock-cell], [data-dock-page]');
      if (at?.dataset.dockPage !== undefined) arrange.overPage?.(Number(at.dataset.dockPage));
      else if (at) arrange.over(Number(at.dataset.dockCell));
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => { if (e.pointerType !== 'mouse') arrange.drop(); },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => { if (e.pointerType !== 'mouse') arrange.drop(); },
  } : {});

  const cellClass = 'min-w-0 min-h-0 flex items-center justify-center';
  const squareStyle = { width: '100%' };

  /*
    With rows set, the cells are squares of one size — the largest that lets
    every column and every row fit — packed at the usual gap, and whatever the
    box has left over goes around the grid rather than between its buttons.

    Before, the columns divided the width and the rows the height, and each
    button took the biggest square its cell allowed. On a window wider than the
    grid's own shape that is a short, wide cell with a small square in the
    middle of it: four columns across a 1300px window were 318px apart for
    buttons 145px wide, and the space between them was most of the deck.

    The size is worked out in the box's own units (cqw/cqh), so the grid still
    grows and shrinks with whatever it is drawn in — the standalone deck, the
    dock tab, the preview — and only its spacing stops changing.
  */
  const gapPx = compact ? 8 : 12;
  // The rows actually drawn, which is more than asked for when the buttons need them.
  const rowCount = cells / columns;
  const side = rows > 0
    ? `min((100cqw - ${(columns - 1) * gapPx}px) / ${columns}, (100cqh - ${(rowCount - 1) * gapPx}px) / ${rowCount})`
    : '';

  const grid = (
    <div
      className={`grid ${rows > 0 ? '' : 'w-full'} ${compact ? 'gap-2' : 'gap-3'}`}
      style={rows > 0 ? {
        gridTemplateColumns: `repeat(${columns}, ${side})`,
        gridTemplateRows: `repeat(${rowCount}, ${side})`,
      } : {
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {layout.map((button, cell) => {
        /*
          A cell nobody claimed still takes its place in the grid: on the dock
          it holds the space so the arrangement keeps its shape, and on the
          screen that arranges it, it is somewhere to put something down.
        */
        if (!button) {
          return (
            <div
              key={`cell-${cell}`} className={cellClass} data-dock-empty="yes" data-dock-cell={cell}
              onDragOver={arrange ? (e) => { e.preventDefault(); arrange.over(cell); } : undefined}
              onDrop={arrange ? (e) => { e.preventDefault(); arrange.drop(); } : undefined}
            >
              {preview && (
                <div
                  className={`aspect-square border-2 border-dashed ${
                    arrange && arrange.overCell === cell ? 'border-current-accent'
                      : arrange && arrange.dragId ? 'border-zinc-600' : 'border-zinc-800'
                  } ${compact ? 'rounded-xl' : 'rounded-2xl'}`}
                  style={squareStyle}
                />
              )}
            </div>
          );
        }
        const builtin = button.builtin ? dockBuiltin(button.builtin) : null;
        const action = streamActions.find((a) => a.id === button.actionId);
        const state = fired[button.id];
        const tint = tintFor(builtin ? builtin.category : action?.trigger?.category);
        // A chosen colour wins over the platform tint, but never over the
        // fired/failed states — knowing whether it worked matters more than
        // decoration for the second it is showing.
        const custom = button.color && !state;
        /*
          A button that shows a state says it instead of what it does: the
          YouTube one reads "Gaming" or "People & Blogs", whichever the stream
          is in, and changes when a press moves it. Until the category is
          known it falls back to its label. Its picture follows the state too.
        */
        const nowState = (builtin as any)?.categories && stats?.youtubeCategoryId ? String(stats.youtubeCategoryId) : '';
        const stateName = nowState ? youtubeCategoryName(nowState, t?.lang === 'es' ? 'es' : 'en') : '';
        const image = (nowState && button.stateImages?.[nowState]) || button.image;
        return (
          <div key={button.id} className={cellClass} data-dock-cell={cell}>
          <button
            {...touchArrange(button.id)}
            onClick={preview ? undefined : () => press(button)}
            disabled={inert}
            tabIndex={inert ? -1 : undefined}
            draggable={Boolean(arrange)}
            onDragStart={arrange ? () => arrange.start(button.id) : undefined}
            onDragOver={arrange ? (e) => { e.preventDefault(); arrange.over(cell); } : undefined}
            onDrop={arrange ? (e) => { e.preventDefault(); arrange.drop(); } : undefined}
            onDragEnd={arrange ? arrange.drop : undefined}
            title={errors[button.id] || builtinName(t, builtin) || action?.name}
            style={{ ...squareStyle, ...(custom ? { borderColor: button.color, color: button.color } : {}) }}
            /*
              Square, in a cell that is square too, so the ratio and the cell
              always agree and nothing is left over inside it.
            */
            className={`relative aspect-square border-2 bg-zinc-900/60 overflow-hidden flex flex-col items-center justify-center ${
              inert ? 'pointer-events-none' : preview ? '' : 'hover:bg-zinc-900 active:scale-95 transition-all'
            } ${
              arrange ? (arrange.dragId === button.id ? 'touch-none opacity-40 cursor-grabbing'
                : arrange.overCell === cell ? 'touch-none cursor-grab ring-2 ring-current-accent' : 'touch-none cursor-grab') : ''
            } ${
              compact ? 'rounded-xl gap-1 p-1' : 'rounded-2xl gap-2 p-2'
            } ${
              state === 'ok' ? 'border-green-500 text-green-400'
                : state === 'failed' ? 'border-red-500 text-red-400'
                  : custom ? '' : tint
            }`}
          >
            {image && (
              <>
                <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                {/* Labels have to stay readable over an arbitrary photo. */}
                <div className="absolute inset-0 bg-black/55 pointer-events-none" />
              </>
            )}
            <div className={`relative flex items-center justify-center ${compact ? 'h-4' : 'h-5'}`}>
              {state === 'running' ? <Loader2 size={iconSize} className="animate-spin" />
                : state === 'ok' ? <Check size={iconSize} />
                  : state === 'failed' ? <AlertTriangle size={iconSize} />
                    : button.icon
                      ? <span style={{ fontSize: iconSize }} className="leading-none">{button.icon}</span>
                      : builtin?.icon
                        ? <span style={{ fontSize: iconSize }} className="leading-none">{builtin.icon}</span>
                        : <Zap size={iconSize} />}
            </div>
            <span className={`relative font-black uppercase tracking-wide text-center leading-tight text-zinc-100 line-clamp-3 break-words ${compact ? 'text-[8px]' : 'text-[10px]'} ${image ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]' : ''}`} data-dock-state={nowState || undefined}>
              {stateName || button.label || builtinName(t, builtin) || action?.name || t.dockActionsMissing}
            </span>
          </button>
          </div>
        );
      })}
    </div>
  );

  // A page with nothing on it, on the deck itself: said, rather than a blank that looks broken.
  if (!buttons.length && !preview) {
    return (
      <div className="h-full flex items-center justify-center text-center p-6" data-dock-page-empty>
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{t.dockPageEmpty || 'Nothing on this page yet'}</p>
      </div>
    );
  }

  // The box the size is measured against, centring the grid in whatever is left.
  return rows > 0 ? (
    <div className="w-full h-full min-h-0 flex items-center justify-center" style={{ containerType: 'size' }}>
      {grid}
    </div>
  ) : grid;
};
