/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The drawing canvas of the Pixel avatars tab: a grid of pixels — the
 * avatar's 100 × 100, or a drawn hat's own — zoomed, and the tools that draw
 * on it. It only shows rows and reports strokes; what a stroke does to the
 * avatar is shared/pixel-edit.js's.
 *
 * A stroke shows as it is drawn and is handed over whole when the pointer
 * lifts, so one stroke is one step to undo, however many pixels it crossed.
 *
 * Another picture can be shown faintly under the grid or over it, at its own
 * place and scale — the avatar under a hat being drawn, the hat over the
 * hair it hides — to draw against without drawing on it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { floodCells, lineCells, boxCells, mirroredCells } from '../../../shared/pixel-edit.js';

export type PixelTool = 'pencil' | 'eraser' | 'restore' | 'fill' | 'picker' | 'line' | 'rect' | 'region' | 'select';

/** Pixels picked up and floating over the grid, not yet put down: rows ('.' nothing, '_' a pixel cleared), top-left at (x, y). */
export interface PixelFloating { rows: string[]; x: number; y: number }
type Cell = [number, number, string];

/** A picture shown with the grid: its rows and colours, its top-left at (x0, y0) in this grid's cells, `scale` of them to one of its pixels. */
export interface PixelLayer {
  rows: string[];
  parts: { char: string; color: string; opacity?: number }[];
  x0: number;
  y0: number;
  scale: number;
  alpha: number;
}

/** A reference picture shown with the grid: loaded, its top-left at (x, y) in this grid's cells, w cells wide, and how see-through. */
export interface PixelReference {
  image: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  opacity: number;
  /** In front of the drawing rather than behind it. */
  over: boolean;
}

interface Props {
  /** What is shown, a string a row, a character a pixel. */
  rows: string[];
  parts: { char: string; color: string; opacity?: number }[];
  tool: PixelTool;
  /** The part being drawn with. */
  char: string;
  zoom: number;
  grid?: boolean;
  mirror?: boolean;
  /** Patch outlines, [x0, y0, x1, y1] inclusive. */
  boxes?: number[][];
  /** The last row of the head, drawn as a line under it. */
  headLastRow?: number | null;
  /** Restore ("back to what is under it") is only for patches and outfits. */
  canRestore?: boolean;
  under?: PixelLayer | null;
  /** Faint over the drawing: one picture, or several (the frames before and after). */
  over?: PixelLayer | PixelLayer[] | null;
  reference?: PixelReference | null;
  /** The box selected, [x0, y0, x1, y1], and whatever is picked up from it and floating. */
  selection?: number[] | null;
  floating?: PixelFloating | null;
  /** Where the mirror line is: a column, or between two. Left out, the middle. */
  mirrorAxis?: number | null;
  /** A box chosen with the select tool, or none (a click on nothing). */
  onSelect?: (box: number[] | null) => void;
  /** The selection dragged by whole cells: picked up first if it was not. */
  onMoveSelection?: (dx: number, dy: number) => void;
  /** A click away from what is floating: put it down. */
  onPutDown?: () => void;
  /** Dragging moves the reference picture instead of drawing: by how many cells. */
  movingReference?: boolean;
  onMoveReference?: (dx: number, dy: number) => void;
  onStroke: (cells: Cell[]) => void;
  onPick: (char: string) => void;
  onRegion?: (box: [number, number, number, number]) => void;
  onHover?: (cell: [number, number] | null) => void;
}

const DARK = '#0c0c0e';
const LIGHT = '#141418';

function drawLayer(ctx: CanvasRenderingContext2D, layer: PixelLayer, zoom: number) {
  const byChar = Object.fromEntries(layer.parts.map((p) => [p.char, p]));
  const cell = layer.scale * zoom;
  ctx.globalAlpha = layer.alpha;
  layer.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i += 1) {
      const p = byChar[row[i]];
      if (!p) continue;
      ctx.fillStyle = p.color;
      // A hair over, so neighbouring pixels at a fractional scale meet without a seam.
      ctx.fillRect((layer.x0 + i * layer.scale) * zoom, (layer.y0 + j * layer.scale) * zoom, cell + 0.5, cell + 0.5);
    }
  });
  ctx.globalAlpha = 1;
}

function drawReference(ctx: CanvasRenderingContext2D, ref: PixelReference, zoom: number) {
  const { naturalWidth: nw, naturalHeight: nh } = ref.image;
  if (!nw || !nh) return;
  ctx.globalAlpha = ref.opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(ref.image, ref.x * zoom, ref.y * zoom, ref.w * zoom, ref.w * (nh / nw) * zoom);
  ctx.globalAlpha = 1;
}

export const PixelCanvas = ({ rows, parts, tool, char, zoom, grid = true, mirror = false, boxes = [], headLastRow = null, canRestore = false, under = null, over = null, reference = null, movingReference = false, onMoveReference, selection = null, floating = null, mirrorAxis = null, onSelect, onMoveSelection, onPutDown, onStroke, onPick, onRegion, onHover }: Props) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const byChar = useMemo(() => Object.fromEntries(parts.map((p) => [p.char, p])), [parts]);
  // The stroke being drawn, shown over the rows until it is handed over.
  const [pending, setPending] = useState<Cell[]>([]);
  const [hover, setHover] = useState<[number, number] | null>(null);
  // The stroke under way, read by every pointer event as it happens rather than as last drawn: a quick hand outruns a redraw.
  const drag = useRef<{ from: [number, number]; last: [number, number]; cells: Map<number, Cell>; shape: boolean } | null>(null);
  const [shape, setShape] = useState<{ from: [number, number]; to: [number, number] } | null>(null);

  const W = rows[0]?.length || 1;
  const H = rows.length || 1;
  const value = tool === 'eraser' ? '_' : tool === 'restore' ? '.' : char;
  const width = W * zoom;
  const height = H * zoom;

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A checkerboard of fours, so empty reads as empty at any zoom.
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
      ctx.fillStyle = ((x + y) / 4) % 2 ? LIGHT : DARK;
      ctx.fillRect(x * zoom, y * zoom, 4 * zoom, 4 * zoom);
    }
    if (reference && !reference.over) drawReference(ctx, reference, zoom);
    if (under) drawLayer(ctx, under, zoom);
    const shown = rows.map((r) => r.split(''));
    for (const [x, y, v] of pending) if (shown[y]) shown[y][x] = v === '_' ? '.' : v === '.' ? '\u0000' : v;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const c0 = shown[y]?.[x];
        if (!c0 || c0 === '.') continue;
        if (c0 === '\u0000') {
          // Going back to what is under it: shown as a hatch until the stroke lands.
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
          continue;
        }
        const part = byChar[c0];
        ctx.globalAlpha = part?.opacity ?? 1;
        ctx.fillStyle = part?.color || '#ff00ff';
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        ctx.globalAlpha = 1;
      }
    }
    for (const layer of ([] as PixelLayer[]).concat(over || [])) drawLayer(ctx, layer, zoom);
    // What is picked up, over everything drawn: its pixels, and the ones it clears as the empty board.
    if (floating) {
      floating.rows.forEach((row, j) => [...row].forEach((c, i) => {
        if (c === '.') return;
        const x = floating.x + i; const y = floating.y + j;
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        const part = byChar[c];
        ctx.globalAlpha = c === '_' ? 1 : part?.opacity ?? 1;
        ctx.fillStyle = c === '_' ? DARK : part?.color || '#ff00ff';
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        ctx.globalAlpha = 1;
      }));
    }
    if (reference?.over) drawReference(ctx, reference, zoom);
    if (grid && zoom >= 5) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= W; i += 1) { ctx.moveTo(i * zoom + 0.5, 0); ctx.lineTo(i * zoom + 0.5, height); }
      for (let i = 0; i <= H; i += 1) { ctx.moveTo(0, i * zoom + 0.5); ctx.lineTo(width, i * zoom + 0.5); }
      ctx.stroke();
      // Every tenth line a little stronger, to count by.
      ctx.strokeStyle = 'rgba(255,255,255,0.11)';
      ctx.beginPath();
      for (let i = 0; i <= W; i += 10) { ctx.moveTo(i * zoom + 0.5, 0); ctx.lineTo(i * zoom + 0.5, height); }
      for (let i = 0; i <= H; i += 10) { ctx.moveTo(0, i * zoom + 0.5); ctx.lineTo(width, i * zoom + 0.5); }
      ctx.stroke();
    }
    if (headLastRow != null && headLastRow >= 0 && headLastRow < H - 1) {
      ctx.strokeStyle = 'rgba(56,189,248,0.55)';
      ctx.setLineDash([zoom, zoom]);
      ctx.beginPath();
      ctx.moveTo(0, (headLastRow + 1) * zoom + 0.5); ctx.lineTo(width, (headLastRow + 1) * zoom + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (mirror) {
      const axis = mirrorAxis ?? (W - 1) / 2;
      ctx.strokeStyle = 'rgba(244,63,94,0.6)';
      ctx.beginPath();
      ctx.moveTo((axis + 0.5) * zoom + 0.5, 0); ctx.lineTo((axis + 0.5) * zoom + 0.5, height);
      ctx.stroke();
    }
    // The selection: a box in black and white dashes, readable on any colour.
    const sel = floating ? [floating.x, floating.y, floating.x + (floating.rows[0]?.length || 1) - 1, floating.y + floating.rows.length - 1] : selection;
    if (sel) {
      const [sx0, sy0, sx1, sy1] = sel;
      for (const [colour, offset] of [['rgba(0,0,0,0.9)', 0], ['rgba(255,255,255,0.95)', 4]] as const) {
        ctx.strokeStyle = colour;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = offset;
        ctx.strokeRect(sx0 * zoom + 0.5, sy0 * zoom + 0.5, (sx1 - sx0 + 1) * zoom - 1, (sy1 - sy0 + 1) * zoom - 1);
      }
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    ctx.strokeStyle = 'rgba(250,204,21,0.7)';
    ctx.setLineDash([3, 3]);
    for (const [x0, y0, x1, y1] of boxes) ctx.strokeRect(x0 * zoom + 0.5, y0 * zoom + 0.5, (x1 - x0 + 1) * zoom - 1, (y1 - y0 + 1) * zoom - 1);
    ctx.setLineDash([]);
    if (shape) {
      const [ax, ay] = shape.from; const [bx, by] = shape.to;
      ctx.strokeStyle = tool === 'region' ? 'rgba(250,204,21,1)' : 'rgba(255,255,255,0.8)';
      ctx.setLineDash(tool === 'region' ? [4, 2] : []);
      if (tool === 'line') {
        for (const [x, y] of lineCells(ax, ay, bx, by)) ctx.strokeRect(x * zoom + 0.5, y * zoom + 0.5, zoom - 1, zoom - 1);
      } else {
        ctx.strokeRect(Math.min(ax, bx) * zoom + 0.5, Math.min(ay, by) * zoom + 0.5, (Math.abs(bx - ax) + 1) * zoom - 1, (Math.abs(by - ay) + 1) * zoom - 1);
      }
      ctx.setLineDash([]);
    }
    if (hover) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeRect(hover[0] * zoom + 0.5, hover[1] * zoom + 0.5, zoom - 1, zoom - 1);
    }
  }, [rows, pending, byChar, zoom, width, height, W, H, grid, boxes, headLastRow, mirror, mirrorAxis, shape, hover, tool, under, over, reference, selection, floating]);

  // Moving the selection: by whole cells, from the cell the drag is over now.
  const shifting = useRef<[number, number] | null>(null);

  // Moving the reference picture: a drag, by whole and fractional cells, never a stroke.
  const slide = useRef<{ x: number; y: number } | null>(null);

  const cellAt = (e: React.PointerEvent): [number, number] | null => {
    const r = canvas.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * H);
    return x >= 0 && y >= 0 && x < W && y < H ? [x, y] : null;
  };
  const withMirror = (cells: Cell[]) => (mirror ? mirroredCells(cells, W, mirrorAxis ?? (W - 1) / 2) as Cell[] : cells);
  const shownNow = () => {
    const shown = rows.map((r) => r.split(''));
    for (const [x, y, v] of pending) shown[y][x] = v === '_' ? '.' : v;
    return shown.map((r) => r.join(''));
  };

  const down = (e: React.PointerEvent) => {
    if (movingReference && e.button === 0) {
      try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* moved without capture */ }
      slide.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const at = cellAt(e);
    if (!at || e.button !== 0) return;
    if (tool === 'restore' && !canRestore) return;
    // Kept drawing when the pointer wanders off the canvas mid-stroke; a pointer the browser does not know cannot be held.
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* drawn without capture */ }
    if (tool === 'select') {
      // Inside the selection, it moves; anywhere else, what floats is put down and a new box is drawn.
      const box = floating ? [floating.x, floating.y, floating.x + (floating.rows[0]?.length || 1) - 1, floating.y + floating.rows.length - 1] : selection;
      if (box && at[0] >= box[0] && at[0] <= box[2] && at[1] >= box[1] && at[1] <= box[3]) {
        shifting.current = at;
        return;
      }
      if (floating) onPutDown?.();
      setShape({ from: at, to: at });
      drag.current = { from: at, last: at, cells: new Map(), shape: true };
      return;
    }
    if (tool === 'picker') {
      const c = rows[at[1]][at[0]];
      if (c !== '.') onPick(c);
      return;
    }
    if (tool === 'fill') {
      const cells = (floodCells(shownNow(), at[0], at[1]) as [number, number][]).map(([x, y]) => [x, y, value] as Cell);
      onStroke(withMirror(cells));
      return;
    }
    if (tool === 'line' || tool === 'rect' || tool === 'region') {
      setShape({ from: at, to: at });
      drag.current = { from: at, last: at, cells: new Map(), shape: true };
      return;
    }
    const cells = new Map<number, Cell>();
    for (const c of withMirror([[at[0], at[1], value]])) cells.set(c[1] * W + c[0], c);
    drag.current = { from: at, last: at, cells, shape: false };
    setPending([...cells.values()]);
  };

  const move = (e: React.PointerEvent) => {
    if (slide.current) {
      const r = canvas.current!.getBoundingClientRect();
      const dx = ((e.clientX - slide.current.x) / r.width) * W;
      const dy = ((e.clientY - slide.current.y) / r.height) * H;
      slide.current = { x: e.clientX, y: e.clientY };
      if (dx || dy) onMoveReference?.(dx, dy);
      return;
    }
    const at = cellAt(e);
    setHover(at);
    onHover?.(at);
    if (shifting.current && at) {
      const dx = at[0] - shifting.current[0]; const dy = at[1] - shifting.current[1];
      if (dx || dy) { shifting.current = at; onMoveSelection?.(dx, dy); }
      return;
    }
    const d = drag.current;
    if (!d || !at) return;
    if (d.shape) { d.last = at; setShape({ from: d.from, to: at }); return; }
    if (at[0] === d.last[0] && at[1] === d.last[1]) return;
    for (const [x, y] of lineCells(d.last[0], d.last[1], at[0], at[1]) as [number, number][]) {
      for (const c of withMirror([[x, y, value]])) d.cells.set(c[1] * W + c[0], c);
    }
    d.last = at;
    setPending([...d.cells.values()]);
  };

  const up = () => {
    if (slide.current) { slide.current = null; return; }
    if (shifting.current) { shifting.current = null; return; }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.shape) {
      const [ax, ay] = d.from; const [bx, by] = d.last;
      setShape(null);
      if (tool === 'select') {
        // A click with no drag selects nothing; a drag selects its box.
        onSelect?.(ax === bx && ay === by ? null : [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]);
        return;
      }
      if (tool === 'region') { onRegion?.([ax, ay, bx, by]); return; }
      const cells = (tool === 'line' ? lineCells(ax, ay, bx, by) : boxCells(ax, ay, bx, by)) as [number, number][];
      onStroke(withMirror(cells.map(([x, y]) => [x, y, value] as Cell)));
      return;
    }
    const cells = [...d.cells.values()];
    setPending([]);
    if (cells.length) onStroke(cells);
  };

  return (
    <canvas
      ref={canvas}
      style={{ width, height, imageRendering: 'pixelated', touchAction: 'none', cursor: movingReference ? 'move' : tool === 'picker' ? 'copy' : tool === 'select' && (floating || selection) ? 'move' : 'crosshair' }}
      className="block rounded-lg border border-zinc-800"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onPointerLeave={() => { setHover(null); onHover?.(null); }}
      data-pixel-canvas
    />
  );
};
