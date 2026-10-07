/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Bringing a drawn picture into the Pixel avatars tab: a sheet drawn
 * elsewhere — a photo or a JPEG is fine — read back into pixels and placed
 * on whatever is being drawn, as one stroke to undo.
 *
 * The picture never leaves the browser. Choose the part of it to bring in
 * by dragging over it, say how many of the drawing's pixels that part is
 * across, nudge the grid until its lines fall between the picture's own
 * pixels, and pick the background (see-through is always background). Its
 * colours are matched to the ones the avatar has, or added as new ones.
 * shared/pixel-import.js does the reading.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Pipette, X } from 'lucide-react';
import { sampleCells, cellsToRows, pictureColours, placeRows } from '../../../shared/pixel-import.js';
import { paint, paintHat, addPart, addHatColour, hatPicture, composed } from '../../../shared/pixel-edit.js';
import { fill } from '../../words';
import type { PixelAvatarDef } from '../../types';

interface Props {
  draft: PixelAvatarDef;
  /** What is being drawn: the picture lands on it. */
  target: any;
  /** The avatar with the picture placed on it. */
  onApply: (next: PixelAvatarDef) => void;
  onClose: () => void;
  t: any;
}

type Img = { width: number; height: number; data: Uint8ClampedArray };
const VIEW = 520;
const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const box = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent';
const small = 'flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40';
const hex = (d: ArrayLike<number>, k: number) => `#${[d[k], d[k + 1], d[k + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export const PixelImport = ({ draft, target, onApply, onClose, t }: Props) => {
  const [img, setImg] = useState<Img | null>(null);
  const [src, setSrc] = useState('');
  const [region, setRegion] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [across, setAcross] = useState(20);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const [background, setBackground] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(14);
  const [own, setOwn] = useState(false);
  const [at, setAt] = useState({ x: 0, y: 0 });
  const [clear, setClear] = useState(false);
  const [picking, setPicking] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const hat = target?.kind === 'hat' ? hatPicture(draft, target.name) as { rows: string[]; parts: { char: string; color: string }[] } | null : null;
  const allParts = hat ? hat.parts : draft.parts;
  /*
    Only the colours already in what is being drawn, by default when it has
    some: a JPEG blurs colour more than light, and two near shades — an
    eyebrow and an outline — are told apart far better when a third that
    is not used here is not a choice. Measured on the drawing itself as a
    JPEG: from 17 pixels wrong to none at quality 0.92, 111 to 34 at 0.75.
  */
  const usedHere = useMemo(() => new Set((hat ? hat.rows : composed(draft, target) as string[]).join('').split('.').join('')), [draft, target]);
  const [onlyUsed, setOnlyUsed] = useState(true);
  const narrowed = allParts.filter((p) => usedHere.has(p.char));
  const parts = onlyUsed && narrowed.length >= 2 ? narrowed : allParts;

  const load = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const c = document.createElement('canvas');
      c.width = image.naturalWidth; c.height = image.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      setImg({ width: c.width, height: c.height, data: data.data });
      setSrc(url);
      setRegion({ x: 0, y: 0, w: c.width, h: c.height });
      // The corner is most often the page: background, to start with.
      setBackground(data.data[3] < 128 ? null : hex(data.data, 0));
      setAcross(Math.max(1, Math.min(100, Math.round(c.width / 10))));
    };
    image.src = url;
  };
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const scale = img ? Math.min(VIEW / img.width, 600 / img.height, 8) : 1;
  const cells = useMemo(() => (img ? sampleCells(img, region, across, shift) as ([number, number, number, number] | null)[][] : []), [img, region, across, shift]);
  const cols = cells[0]?.length || 0;
  const rowsN = cells.length;
  // Its own colours: as many as there is room for, found in the picture.
  const ownColours = useMemo(() => (img && own ? pictureColours(cells, { most: 16, background, tolerance }) as string[] : []), [cells, own, background, tolerance]);
  const usedParts = useMemo(() => (own ? ownColours.map((color, i) => ({ id: `new-${i}`, char: String.fromCharCode(0xe000 + i), color, name: color })) : parts), [own, ownColours, parts]);
  const rows = useMemo(() => (img ? cellsToRows(cells, usedParts, { background, tolerance }) as string[] : []), [cells, usedParts, background, tolerance]);

  // The picture, the part chosen and the grid over it.
  useEffect(() => {
    const c = view.current;
    if (!c || !img || !src) return;
    const image = new Image();
    image.onload = () => {
      const ctx = c.getContext('2d')!;
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(image, region.x, region.y, region.w, region.h, region.x * scale, region.y * scale, region.w * scale, region.h * scale);
      const cell = (region.w / Math.max(1, cols)) * scale;
      if (cell >= 4) {
        ctx.strokeStyle = 'rgba(250,204,21,0.45)';
        ctx.beginPath();
        for (let i = 0; i <= cols; i += 1) { const x = (region.x + (i + shift.x) * (region.w / cols)) * scale; ctx.moveTo(x, region.y * scale); ctx.lineTo(x, (region.y + region.h) * scale); }
        for (let j = 0; j <= rowsN; j += 1) { const y = (region.y + (j + shift.y) * (region.w / cols)) * scale; ctx.moveTo(region.x * scale, y); ctx.lineTo((region.x + region.w) * scale, y); }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(250,204,21,1)';
      ctx.strokeRect(region.x * scale + 0.5, region.y * scale + 0.5, region.w * scale, region.h * scale);
    };
    image.src = src;
  }, [img, src, region, cols, rowsN, shift, scale]);

  const where = (e: React.PointerEvent) => {
    const r = view.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(img!.width, (e.clientX - r.left) / scale)), y: Math.max(0, Math.min(img!.height, (e.clientY - r.top) / scale)) };
  };
  const down = (e: React.PointerEvent) => {
    if (!img) return;
    const p = where(e);
    if (picking) {
      const k = (Math.floor(p.y) * img.width + Math.floor(p.x)) * 4;
      setBackground(hex(img.data, k));
      setPicking(false);
      return;
    }
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* without capture */ }
    drag.current = p;
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !img) return;
    const p = where(e);
    const a = drag.current;
    const w = Math.abs(p.x - a.x); const h = Math.abs(p.y - a.y);
    if (w >= 2 && h >= 2) setRegion({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w, h });
  };
  const up = () => { drag.current = null; };

  // The preview: the pixels it will place.
  const preview = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = preview.current;
    if (!c) return;
    const z = Math.max(2, Math.min(8, Math.floor(260 / Math.max(cols, rowsN, 1))));
    c.width = cols * z; c.height = rowsN * z;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const byChar = Object.fromEntries(usedParts.map((p) => [p.char, p.color]));
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (byChar[ch]) { ctx.fillStyle = byChar[ch]; ctx.fillRect(i * z, j * z, z, z); } }));
  }, [rows, usedParts, cols, rowsN]);

  const apply = () => {
    let next = draft;
    let placed = rows;
    if (own && ownColours.length) {
      // Each colour of its own becomes a colour of the avatar's (or the hat's), and the rows are written in theirs.
      const map: Record<string, string> = {};
      ownColours.forEach((color, i) => {
        const before = hat ? (hatPicture(next, target.name) as any).parts.length : next.parts.length;
        next = hat ? addHatColour(next, target.name, color) : addPart(next, { name: fill(t.pixelImportedColour || 'Picture colour {n}', { n: i + 1 }), color });
        const nowParts = hat ? (hatPicture(next, target.name) as any).parts : next.parts;
        if (nowParts.length > before) map[String.fromCharCode(0xe000 + i)] = nowParts[nowParts.length - 1].char;
      });
      placed = rows.map((r) => [...r].map((c) => (c === '.' ? '.' : map[c] || '.')).join(''));
    }
    const stroke = placeRows(placed, at.x, at.y, { clear }) as [number, number, string][];
    next = hat ? paintHat(next, target.name, stroke) : paint(next, target, stroke);
    onApply(next);
  };

  const noRoom = own && ownColours.length > 0 && !hat && draft.parts.length + ownColours.length > 92;
  return (
    <div className="space-y-3 rounded-xl border border-current-accent/50 bg-zinc-950/70 p-3" data-pixel-import>
      <div className="flex items-center gap-2">
        <span className={`${tag} flex-1`}>{t.pixelImport || 'Bring in a drawn picture'}</span>
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={13} /></button>
      </div>
      <label className={`${small} w-fit cursor-pointer`}>
        <Upload size={11} /> {t.pixelImportChoose || 'Choose a picture'}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { load(e.target.files?.[0]); e.currentTarget.value = ''; }} data-pixel-import-file />
      </label>
      {img && (
        <>
          <p className="text-[10px] text-zinc-500 leading-relaxed">{t.pixelImportHint || 'Drag over the part to bring in. Say how many pixels it is across, and nudge the grid until its lines fall between the picture’s pixels.'}</p>
          <div className="overflow-auto max-h-[60vh] rounded-lg border border-zinc-800">
            <canvas ref={view} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ cursor: picking ? 'copy' : 'crosshair', touchAction: 'none', imageRendering: 'pixelated' }} data-pixel-import-view />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="block space-y-1">
              <span className={tag}>{t.pixelImportAcross || 'Pixels across'}</span>
              <input type="number" min={1} max={120} value={across} onChange={(e) => setAcross(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} className={box} data-pixel-import-across />
            </label>
            <label className="block space-y-1">
              <span className={tag}>{fill(t.pixelImportNudge || 'Nudge ← → {n}', { n: shift.x.toFixed(2) })}</span>
              <input type="range" min={-0.5} max={0.5} step={0.05} value={shift.x} onChange={(e) => setShift({ ...shift, x: Number(e.target.value) })} className="w-full accent-current-accent" />
            </label>
            <label className="block space-y-1">
              <span className={tag}>{fill(t.pixelImportNudgeUp || 'Nudge ↑ ↓ {n}', { n: shift.y.toFixed(2) })}</span>
              <input type="range" min={-0.5} max={0.5} step={0.05} value={shift.y} onChange={(e) => setShift({ ...shift, y: Number(e.target.value) })} className="w-full accent-current-accent" />
            </label>
            <div className="space-y-1">
              <span className={tag}>{t.pixelImportBackground || 'Background'}</span>
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 rounded border border-zinc-700" style={{ background: background || 'transparent' }} title={background || ''} />
                <button onClick={() => setPicking(true)} className={`${small} ${picking ? 'border-current-accent text-current-accent' : ''}`} title={t.pixelImportPickBackground || 'Click the picture’s background'} data-pixel-import-pick><Pipette size={11} /></button>
                <input type="range" min={0} max={40} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full accent-current-accent" title={t.pixelImportTolerance || 'How near the background a colour must be to count as it'} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-start">
            <div className="space-y-1">
              <span className={tag}>{fill(t.pixelImportResult || 'It comes in {w} × {h}', { w: cols, h: rowsN })}</span>
              <canvas ref={preview} className="block rounded border border-zinc-800 bg-[#0c0c0e]" style={{ imageRendering: 'pixelated' }} data-pixel-import-preview />
            </div>
            <div className="space-y-2 min-w-[12rem] flex-1">
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-400"><input type="radio" checked={!own} onChange={() => setOwn(false)} className="accent-current-accent" /> {hat ? (t.pixelImportMatchHat || 'In the hat’s colours') : (t.pixelImportMatch || 'In the avatar’s colours')}</label>
              {!own && narrowed.length >= 2 && (
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 pl-4"><input type="checkbox" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} className="accent-current-accent" data-pixel-import-only-used /> {fill(t.pixelImportOnlyUsed || 'Only the {n} already in it — near shades come out right', { n: narrowed.length })}</label>
              )}
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-400"><input type="radio" checked={own} onChange={() => setOwn(true)} className="accent-current-accent" data-pixel-import-own /> {fill(t.pixelImportOwn || 'In its own colours ({n} new)', { n: ownColours.length })}</label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex items-center gap-1 text-[10px] text-zinc-500">x <input type="number" value={at.x} onChange={(e) => setAt({ ...at, x: Math.round(Number(e.target.value) || 0) })} className={box} data-pixel-import-x /></label>
                <label className="flex items-center gap-1 text-[10px] text-zinc-500">y <input type="number" value={at.y} onChange={(e) => setAt({ ...at, y: Math.round(Number(e.target.value) || 0) })} className={box} data-pixel-import-y /></label>
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-400"><input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} className="accent-current-accent" /> {t.pixelImportClear || 'Its empty pixels clear what is there'}</label>
              {noRoom && <p className="text-[10px] text-amber-400">{t.pixelImportNoRoom || 'The avatar has no room for that many more colours: match them to its own instead.'}</p>}
              <button onClick={apply} disabled={!cols || noRoom} className={`${small} border-current-accent text-current-accent w-full`} data-pixel-import-place>{t.pixelImportPlace || 'Place it'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
