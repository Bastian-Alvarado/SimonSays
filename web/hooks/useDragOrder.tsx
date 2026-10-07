/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Putting the rows of a list in a new order by dragging a grip.
 *
 * One way for every list in the app that can be reordered — overlay layers,
 * action steps, alert variations, the plan, and the rest — so a grip does the
 * same thing wherever it is found:
 *
 *   - Pointer events rather than the browser's drag and drop, which a finger
 *     cannot do; the grip takes no touch scrolling of its own, so dragging it
 *     drags the row rather than the page.
 *   - Nothing moves while a row is held. A line shows where it would land and
 *     the list changes once, on letting go — rows shuffling under the pointer
 *     move the very gaps it is aiming at.
 *   - Near the edge of what can be seen, the list scrolls on its own, so a long
 *     one can be crossed in one drag. Escape puts the row back.
 *
 * A gap is where a row would land: 0 before the first row, n after the last.
 * shared/list-order.js turns a row and a gap into the new order.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

export type DragDrop = { id: string; from: number; gap: number };
type Held = DragDrop & { line: React.CSSProperties | null };

const EDGE = 56;

export function useDragOrder(onDrop: (drop: DragDrop) => void, { axis = 'y' }: { axis?: 'y' | 'x' } = {}) {
  const key = useId();
  const [held, setHeldState] = useState<Held | null>(null);
  const heldRef = useRef<Held | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const grabbed = useRef<HTMLElement | null>(null);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  /** The element the rows sit in; the line is drawn in it, so it wants position: relative. */
  const listBox = useRef<HTMLElement | null>(null);
  const listRef = useRef((el: HTMLElement | null) => { listBox.current = el; }).current;

  const setHeld = (next: Held | null) => {
    heldRef.current = next;
    setHeldState(next);
  };

  /* This list's rows only — a list inside a row of another has its own. */
  const rows = () => Array.from(document.querySelectorAll<HTMLElement>(`[data-drag-list="${key}"]`));

  const gapAt = (all: HTMLElement[]) => {
    const p = axis === 'y' ? pointer.current.y : pointer.current.x;
    for (let i = 0; i < all.length; i += 1) {
      const r = all[i].getBoundingClientRect();
      if (p < (axis === 'y' ? r.top + r.height / 2 : r.left + r.width / 2)) return i;
    }
    return all.length;
  };

  /* Where the line goes: halfway between the two rows either side of the gap. */
  const lineFor = (all: HTMLElement[], gap: number, from: number): React.CSSProperties | null => {
    const box = listBox.current;
    if (!box || !all.length || gap === from || gap === from + 1) return null;
    const b = box.getBoundingClientRect();
    const r = all.map((el) => el.getBoundingClientRect());
    const space = r.length > 1 ? (axis === 'y' ? r[1].top - r[0].bottom : r[1].left - r[0].right) : 8;
    const half = Math.max(2, space / 2);
    if (axis === 'y') {
      const y = gap === 0 ? r[0].top - half : gap >= r.length ? r[r.length - 1].bottom + half : (r[gap - 1].bottom + r[gap].top) / 2;
      const row = r[Math.min(gap, r.length - 1)];
      return { top: y - b.top + box.scrollTop - 1, left: row.left - b.left + box.scrollLeft, width: row.width, height: 2 };
    }
    const x = gap === 0 ? r[0].left - half : gap >= r.length ? r[r.length - 1].right + half : (r[gap - 1].right + r[gap].left) / 2;
    const row = r[Math.min(gap, r.length - 1)];
    return { left: x - b.left + box.scrollLeft - 1, top: row.top - b.top + box.scrollTop, height: row.height, width: 2 };
  };

  const follow = () => {
    const now = heldRef.current;
    if (!now) return;
    const all = rows();
    const gap = gapAt(all);
    if (gap !== now.gap) setHeld({ ...now, gap, line: lineFor(all, gap, now.from) });
  };

  const end = (drop: boolean) => {
    const now = heldRef.current;
    setHeld(null);
    grabbed.current = null;
    if (drop && now && now.gap !== now.from && now.gap !== now.from + 1) {
      dropRef.current({ id: now.id, from: now.from, gap: now.gap });
    }
  };

  const heldId = held?.id;
  useEffect(() => {
    if (!heldId) return undefined;
    // The nearest thing that scrolls along the list, or else the page.
    const scrolls = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return axis === 'y'
        ? /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight
        : /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
    };
    let box = grabbed.current?.parentElement || null;
    while (box && !scrolls(box)) box = box.parentElement;
    const scroller = box || (axis === 'y' ? (document.scrollingElement as HTMLElement | null) : null);
    let frame = 0;
    const tick = () => {
      if (scroller) {
        const view = box ? box.getBoundingClientRect() : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
        const p = axis === 'y' ? pointer.current.y : pointer.current.x;
        const lo = axis === 'y' ? view.top : view.left;
        const hi = axis === 'y' ? view.bottom : view.right;
        const over = p < lo + EDGE ? p - (lo + EDGE) : p > hi - EDGE ? p - (hi - EDGE) : 0;
        if (over) {
          const step = Math.max(-14, Math.min(14, Math.round(over / 3)));
          const before = axis === 'y' ? scroller.scrollTop : scroller.scrollLeft;
          if (axis === 'y') scroller.scrollTop += step; else scroller.scrollLeft += step;
          if ((axis === 'y' ? scroller.scrollTop : scroller.scrollLeft) !== before) {
            const now = heldRef.current;
            if (now) {
              const all = rows();
              const gap = gapAt(all);
              setHeld({ ...now, gap, line: lineFor(all, gap, now.from) });
            }
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') end(false); };
    /*
      Followed from the window as well as the grip: a pointer that slips its
      capture still moves the line, and letting go anywhere still lets go,
      rather than leaving a row held with nothing left to drop it.
    */
    const onMove = (e: PointerEvent) => { pointer.current = { x: e.clientX, y: e.clientY }; follow(); };
    const onUp = () => end(true);
    const onCancel = () => end(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldId]);

  return {
    listRef,
    /** The id of the row being carried, to draw it faded. */
    held: heldId ?? null,
    /** Spread on each row, so the gaps can be measured. */
    row: (id: string) => ({ 'data-drag-list': key, 'data-drag-id': id }),
    /** Spread on the row's grip. */
    grip: (id: string) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        // Held even when the capture cannot be had: the window follows the pointer too.
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* followed from the window */ }
        grabbed.current = e.currentTarget;
        pointer.current = { x: e.clientX, y: e.clientY };
        const all = rows();
        const from = all.findIndex((el) => el.dataset.dragId === id);
        if (from < 0) return;
        const gap = gapAt(all);
        setHeld({ id, from, gap, line: lineFor(all, gap, from) });
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        pointer.current = { x: e.clientX, y: e.clientY };
        follow();
      },
      onPointerUp: () => end(true),
      onPointerCancel: () => end(false),
      // Grabbing the grip is not a press of the row it sits in.
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    }),
    /** Drawn anywhere inside listRef: the line where the held row would land. */
    line: held?.line ? (
      <span aria-hidden data-drag-line className="absolute rounded-full bg-current-accent pointer-events-none z-20" style={{ ...held.line, margin: 0 }} />
    ) : null,
  };
}

/** The handle itself, the same in every list. */
export const DragGrip = ({ grip, title, size = 14, className = '' }: {
  grip: ReturnType<ReturnType<typeof useDragOrder>['grip']>;
  title?: string;
  size?: number;
  className?: string;
}) => (
  <span
    {...grip}
    title={title}
    data-drag-grip
    className={`shrink-0 p-1 cursor-grab active:cursor-grabbing touch-none text-zinc-600 hover:text-zinc-300 ${className}`}
  >
    <GripVertical size={size} />
  </span>
);

/** What useDragOrder hands back, for passing one list's order down to the rows it draws. */
export type DragOrder = ReturnType<typeof useDragOrder>;
