/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Drawing a pixel avatar: the Pixel avatars tab's Draw mode.
 *
 * Everything is drawn on a copy, kept here until "Save" sends the whole
 * avatar to the server — which keeps it only if it can draw it — so a
 * half-finished face is never on stream, and "Discard" goes back to what is
 * kept. Every stroke is a step to undo.
 *
 * On the left, what to draw: the drawing itself, its outfits (each whole),
 * its faces and its extras (each patches over the drawing). In the middle,
 * the canvas. On the right, the colours, what the thing being drawn is
 * called and does, and the avatar alive with it on, as it will be on stream.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap, landedAt } from '../../../shared/list-order.js';
import { Pencil, Eraser, Undo2, Redo2, PaintBucket, Pipette, Minus, Square, BoxSelect, RotateCcw, ZoomIn, ZoomOut, Grid3x3, FlipHorizontal, Save, Plus, Trash2, AlertTriangle, Play, Copy, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { PixelKitAvatar } from '../PixelKitAvatar';
import { PixelImport } from './PixelImport';
import { PixelSetup } from './PixelSetup';
import { PixelReferencePanel, useReference, useReferenceImage } from './PixelReference';
import { referenceOnHat } from '../../../shared/pixel-edit.js';
import { Image as ImageIcon } from 'lucide-react';
import { setPart } from '../../../shared/pixel-edit.js';
import { ImagePlus } from 'lucide-react';
import { PixelCanvas, type PixelTool, type PixelFloating } from './PixelCanvas';
import { liftBox, vacateBox, stampRows, flipRows, remapRows, coloursOf, drawnMiddle, addShades, pixelWarnings } from '../../../shared/pixel-edit.js';
import { X } from 'lucide-react';
import { nearestPart } from '../../../shared/pixel-import.js';
import { SquareDashedMousePointer, FlipVertical2, FlipHorizontal2, Scissors, ClipboardPaste, Check } from 'lucide-react';
import { LivingAvatar } from '../AvatarLayer';
import { composed, patchBoxes, paint, regionPatch, isWhole, addPart, removePart, partUse, addFace, addExtra, addOutfit, removeItem, setItem, addDrawnHat, paintHat, placeHat, resizeHat, addHatColour, setHatColour, removeHatColour, hatColourUse, hatPicture } from '../../../shared/pixel-edit.js';
import type { PixelLayer } from './PixelCanvas';
import { PIXEL_SPECIAL_FACES } from '../../../shared/pixel-avatars.js';
import { pixelFaceName, pixelOutfitName, pixelExtraName, pixelActionLabel } from '../pixelNames';
import { addAction, framesOf, addFrame, removeFrame, moveFrame, setFrame, startOutfitFrames, framePixels, setTurns, addFrontFace, removeFrontFace, setTurn, setOwnFace, setOwnFaceBox, outfitChecklist, layPatches } from '../../../shared/pixel-edit.js';
import { addFrontOutfit, addFrontExtra, removeFrontVersion } from '../../../shared/pixel-edit.js';
import { pixelFaceCrop } from '../pixelNames';
import { refusalWords, fill } from '../../words';
import type { PixelAvatarDef } from '../../types';

export type PixelTarget =
  | { kind: 'base' }
  | { kind: 'outfit'; name: string }
  | { kind: 'face'; name: string }
  | { kind: 'extra'; name: string; outfit?: string }
  /** A drawn hat's own picture; its extra target is the hair it hides. */
  | { kind: 'hat'; name: string }
  /** A frame of something it does, in one outfit ('' the one it was drawn in). */
  | { kind: 'frame'; action: string; outfit: string; index: number }
  /** The front view of a drawing that turns, a face of it, and an outfit and an extra as they look from the front. */
  | { kind: 'front' }
  | { kind: 'front-face'; name: string }
  | { kind: 'front-outfit'; name: string }
  | { kind: 'front-extra'; name: string }
  /** Setting it up: what takes a colour, where its eyes are. The canvas draws the drawing meanwhile. */
  | { kind: 'setup' }
  /** An outfit's own glasses, and its own version of a face. */
  | { kind: 'own-glasses'; outfit: string }
  | { kind: 'own-face'; outfit: string; name: string };

interface Props {
  kit: PixelAvatarDef;
  request: (payload: any) => Promise<any>;
  /** Told whenever there are changes not yet saved, so leaving can ask first. */
  onDirty?: (dirty: boolean) => void;
  /** The uploads, for a reference picture to draw from. */
  listAssets?: () => Promise<any[]>;
  uploadAsset?: (file: File) => Promise<any>;
  t: any;
}

const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const box = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent';
const item = (on: boolean) => `w-full text-left px-2 py-1 rounded-md text-[11px] truncate border ${on ? 'border-current-accent text-current-accent bg-current-accent/5' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`;
const small = 'flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40';
const SPECIAL = PIXEL_SPECIAL_FACES as string[];

/*
  What was copied, kept while the tab is open — across faces, frames,
  outfits and avatars — with the colours it was in, so it pastes into
  another avatar in that avatar's nearest colours.
*/
let clipboard: { rows: string[]; x: number; y: number; colours: Record<string, string> } | null = null;

type Floating = PixelFloating & { target: any };
const floatBox = (f: PixelFloating) => [f.x, f.y, f.x + (f.rows[0]?.length || 1) - 1, f.y + f.rows.length - 1];

export const PixelEditor = ({ kit, request, onDirty, listAssets, uploadAsset, t }: Props) => {
  const [draft, setDraft] = useState<PixelAvatarDef>(kit);
  const [dirty, setDirtyState] = useState(false);
  const [past, setPast] = useState<PixelAvatarDef[]>([]);
  const [future, setFuture] = useState<PixelAvatarDef[]>([]);
  const [target, setTarget] = useState<PixelTarget>({ kind: 'base' });
  const [tool, setTool] = useState<PixelTool>('pencil');
  const [char, setChar] = useState(kit.parts[0]?.char || '');
  const [zoom, setZoom] = useState(6);
  // Opened at whatever size fits the room there is for it: a pixel of the drawing as many screen pixels as fit, across and down (the canvas shows three quarters of the screen's height).
  const canvasColumn = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = canvasColumn.current?.clientWidth || 0;
    const h = typeof window !== 'undefined' ? window.innerHeight * 0.75 : 0;
    if (w) setZoom(Math.max(3, Math.min(12, Math.floor(w / 100), h ? Math.floor(h / 100) : 12)));
  }, []);
  const [grid, setGrid] = useState(true);
  const [mirror, setMirror] = useState(false);
  // Where the mirror line is, for this avatar, remembered in this browser; null is the middle of the grid.
  const mirrorKey = `pixelAvatars.mirror.${kit.id}`;
  const [mirrorAxis, setMirrorAxisNow] = useState<number | null>(() => { try { const v = localStorage.getItem(mirrorKey); return v === null ? null : Number(v); } catch { return null; } });
  const setMirrorAxis = (v: number | null) => {
    setMirrorAxisNow(v);
    try { if (v === null) localStorage.removeItem(mirrorKey); else localStorage.setItem(mirrorKey, String(v)); } catch { /* kept for this visit only */ }
  };
  // A box selected, and what is picked up from it and floating — read through a ref as well, so quick moves never lift it twice.
  const [selection, setSelection] = useState<number[] | null>(null);
  const [floating, setFloating] = useState<Floating | null>(null);
  const floatRef = useRef<Floating | null>(null);
  const setFloat = (f: Floating | null) => { floatRef.current = f; setFloating(f); };
  const [, setClipRound] = useState(0);
  const selOps = useRef<Record<string, (...a: any[]) => any>>({});
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [names, setNames] = useState({ face: '', extra: '', outfit: '', part: '', hat: '' });
  // A drawn hat is drawn with its own colours, a letter each, and at its own zoom: its pixels are fewer and bigger.
  const [hatChar, setHatChar] = useState('a');
  const [hatZoom, setHatZoom] = useState(10);
  // The frame before, faint under the one being drawn; and a play of it on the preview, by a key that changes each time.
  const [onion, setOnion] = useState(true);
  // The frame after, faint too; and the frames played on the canvas itself, at a speed.
  const [onionNext, setOnionNext] = useState(false);
  const [canvasPlay, setCanvasPlay] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  // Things worth a look before saving: shown when Save is pressed with any not yet seen.
  const [showWarnings, setShowWarnings] = useState(false);
  const [warningsSeen, setWarningsSeen] = useState(-1);
  const [playing, setPlaying] = useState<{ name: string; key: string } | null>(null);
  const [actionName, setActionName] = useState('');
  // Which way the preview faces, for one that turns: left to itself, or held one way to look at it.
  const [facing, setFacing] = useState<'left' | 'front' | 'right' | null>(null);
  const [keepBox, setKeepBox] = useState('');
  // Bringing in a drawn picture, onto whatever is being drawn.
  const [importing, setImporting] = useState(false);
  // A reference picture to draw from, remembered for this avatar in this browser; and dragging it about rather than drawing.
  const [reference, setReference] = useReference(kit.id);
  const referenceImage = useReferenceImage(reference?.src);
  const [referencing, setReferencing] = useState(false);
  const [movingReference, setMovingReference] = useState(false);
  const [hatNew, setHatNew] = useState(false);

  const setDirty = (v: boolean) => { setDirtyState(v); onDirty?.(v); };
  // What is kept changed elsewhere, and nothing here is unsaved: start from it.
  useEffect(() => { if (!dirty) { setDraft(kit); } }, [kit]);
  useEffect(() => () => onDirty?.(false), []);
  // A target that is gone (its face deleted, an undo past its making) falls back to the drawing.
  const exists = (tg: PixelTarget) => tg.kind === 'base' || tg.kind === 'setup'
    || (tg.kind === 'face' && draft.faces.some((f) => f.name === tg.name))
    || (tg.kind === 'extra' && draft.extras.some((e) => e.name === tg.name))
    || (tg.kind === 'hat' && draft.extras.some((e) => e.name === tg.name && e.art))
    || (tg.kind === 'frame' && draft.actions.some((a) => a.name === tg.action) && (!tg.outfit || draft.outfits.some((o) => o.name === tg.outfit)))
    || ((tg.kind === 'own-glasses' || tg.kind === 'own-face') && Boolean(draft.outfits.find((o) => o.name === tg.outfit)?.ownFace) && (tg.kind === 'own-glasses' || draft.faces.some((f) => f.name === tg.name)))
    || (tg.kind === 'front' && Boolean(draft.turn))
    || (tg.kind === 'front-face' && Boolean(draft.turn?.front.faces.some((f) => f.name === tg.name)))
    || (tg.kind === 'front-outfit' && Boolean(draft.turn?.front.outfits?.some((o) => o.name === tg.name)))
    || (tg.kind === 'front-extra' && Boolean(draft.turn?.front.extras?.some((e) => e.name === tg.name)))
    || (tg.kind === 'outfit' && draft.outfits.some((o) => o.name === tg.name));
  const tgt: PixelTarget = exists(target) ? target : { kind: 'base' };
  useEffect(() => { if (!draft.parts.some((p) => p.char === char)) setChar(draft.parts[0]?.char || ''); }, [draft.parts, char]);

  const commit = (next: PixelAvatarDef) => {
    if (next === draft) return;
    setPast((p) => [...p.slice(-80), draft]);
    setFuture([]);
    setDraft(next);
    setDirty(true);
  };
  const undo = () => {
    // Undoing while something floats takes back its picking up: it goes back where it was.
    if (floatRef.current) setFloat(null);
    if (!past.length) return;
    setFuture((f) => [draft, ...f]);
    setDraft(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setDirty(true);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, draft]);
    setDraft(future[0]);
    setFuture((f) => f.slice(1));
    setDirty(true);
  };
  const save = async (anyway = false) => {
    // Things worth a look, not seen yet: shown first; saved on the next press, or with "Save anyway".
    const count = pixelWarnings(draft).length;
    if (!anyway && count > warningsSeen && count > 0) { setShowWarnings(true); setWarningsSeen(count); return; }
    setError('');
    setSaving(true);
    try {
      // Whatever floats is put down first: it is part of what is saved.
      const f = floatRef.current;
      const toSave = f ? stampRows(draft, f.target, f) as PixelAvatarDef : draft;
      if (f) { commit(toSave); setFloat(null); setSelection(f ? floatBox(f) : null); }
      // Its name is the tab's to change, above: whatever it is called now, it keeps.
      await request({ op: 'save', avatar: { ...toSave, name: kit.name } });
      setDirty(false);
    } catch (err: any) {
      setError(refusalWords(t, err));
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    if (!window.confirm(t.pixelDiscardConfirm || 'Throw away every change since it was last saved?')) return;
    setDraft(kit); setPast([]); setFuture([]); setDirty(false); setFloat(null); setSelection(null);
  };

  // Shortcuts, while nothing is being typed into.
  const keys = useRef({ undo, redo, save, setTool });
  keys.current = { undo, redo, save, setTool };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]');
      if (typing) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) keys.current.redo(); else keys.current.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); keys.current.redo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); keys.current.save(); return; }
      const sel = selOps.current;
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a'].includes(k)) {
        if (k === 'v' || k === 'a' || sel.active?.()) { e.preventDefault(); ({ c: sel.copy, x: sel.cut, v: sel.paste, a: sel.selectAll } as any)[k]?.(); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (sel.active?.()) {
        const step = e.shiftKey ? 5 : 1;
        const arrows: Record<string, [number, number]> = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] };
        if (arrows[k]) { e.preventDefault(); sel.nudge(...arrows[k]); return; }
        if (k === 'delete' || k === 'backspace') { e.preventDefault(); sel.remove(); return; }
        if (k === 'enter' || k === 'escape') { e.preventDefault(); sel.done(); return; }
      }
      const tools: Record<string, PixelTool> = { b: 'pencil', p: 'pencil', e: 'eraser', r: 'restore', g: 'fill', i: 'picker', l: 'line', u: 'rect', x: 'region', m: 'select' };
      if (tools[k]) keys.current.setTool(tools[k]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Leaving the page with changes not saved asks first.
  useEffect(() => {
    if (!dirty) return undefined;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  /*
    A drawn hat's picture is drawn on a grid of its own, with the avatar
    faint beneath it where the hat sits; the hair it hides is drawn on the
    avatar's grid with the hat faint over it.
  */
  const hatPic = tgt.kind === 'hat' ? hatPicture(draft, tgt.name) as { rows: string[]; parts: { id: string; char: string; color: string; name: string }[]; art: { x: number; y: number; size: number; palette: string[]; rows: string[] } } | null : null;
  const drawnHat = (tgt.kind === 'hat' || tgt.kind === 'extra') ? draft.extras.find((e) => e.name === (tgt as any).name && e.art) || null : null;
  useEffect(() => {
    if (tgt.kind !== 'hat' || !hatPic) return;
    const w = canvasColumn.current?.clientWidth || 0;
    if (w) setHatZoom(Math.max(4, Math.min(18, Math.floor(w / (hatPic.rows[0]?.length || 1)))));
    if (hatChar.charCodeAt(0) - 97 >= hatPic.art.palette.length) setHatChar('a');
  }, [tgt.kind, (tgt as any).name]);
  const where = `${tgt.kind}|${(tgt as any).name ?? ''}|${(tgt as any).action ?? ''}|${(tgt as any).outfit ?? ''}|${(tgt as any).index ?? ''}`;
  const rows = useMemo(() => (hatPic ? hatPic.rows : composed(draft, tgt) as string[]), [draft, where]);
  const boxes = useMemo(() => (isWhole(tgt) || tgt.kind === 'hat' ? [] : patchBoxes(draft, tgt) as number[][]), [draft, where]);

  /*
    The selection. Picking up empties where it was (one step to undo);
    moving, nudging and flipping what floats are not steps; putting it down
    is. Changing what is being drawn, or the tool, puts it down where it
    was picked up from.
  */
  const drawTarget: any = hatPic ? { kind: 'hat', name: (tgt as any).name } : tgt;
  const targetParts = hatPic ? hatPic.parts : draft.parts;
  const liftNow = (): Floating | null => {
    if (floatRef.current) return floatRef.current;
    if (!selection) return null;
    const f = { ...(liftBox(draft, drawTarget, selection) as PixelFloating), target: drawTarget };
    commit(vacateBox(draft, drawTarget, selection) as PixelAvatarDef);
    setFloat(f);
    return f;
  };
  const putDown = () => {
    const f = floatRef.current;
    if (!f) return;
    commit(stampRows(draft, f.target, f) as PixelAvatarDef);
    setSelection(floatBox(f));
    setFloat(null);
  };
  const copySel = () => {
    const f = floatRef.current;
    const got = f ? { rows: f.rows, x: f.x, y: f.y } : selection ? liftBox(draft, drawTarget, selection) as PixelFloating : null;
    if (!got) return;
    clipboard = { ...got, colours: coloursOf(got.rows, targetParts) as Record<string, string> };
    setClipRound((n) => n + 1);
  };
  const removeSel = () => {
    if (floatRef.current) { setFloat(null); setSelection(null); return; }
    if (selection) { commit(vacateBox(draft, drawTarget, selection) as PixelAvatarDef); setSelection(null); }
  };
  selOps.current = {
    active: () => Boolean(floatRef.current || selection),
    putDown,
    nudge: (dx: number, dy: number) => { const f = liftNow(); if (f) setFloat({ ...f, x: f.x + dx, y: f.y + dy }); },
    flip: (way: 'h' | 'v') => { const f = liftNow(); if (f) setFloat({ ...f, rows: flipRows(f.rows, way) as string[] }); },
    copy: copySel,
    cut: () => { copySel(); removeSel(); },
    remove: removeSel,
    paste: () => {
      if (!clipboard) return;
      putDown();
      const pasted = remapRows(clipboard.rows, clipboard.colours, targetParts, nearestPart) as string[];
      setSelection(null);
      setFloat({ rows: pasted, x: clipboard.x, y: clipboard.y, target: drawTarget });
      setTool('select');
    },
    selectAll: () => { putDown(); setTool('select'); setSelection([0, 0, (rows[0]?.length || 100) - 1, rows.length - 1]); },
    done: () => { putDown(); setSelection(null); },
  };
  // Something new being drawn, or another tool: what floats goes down where it came from, and the box goes.
  useEffect(() => {
    const f = floatRef.current;
    if (f) { commit(stampRows(draft, f.target, f) as PixelAvatarDef); setFloat(null); }
    setSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [where]);
  useEffect(() => {
    if (tool === 'select') return;
    const f = floatRef.current;
    if (f) { commit(stampRows(draft, f.target, f) as PixelAvatarDef); setFloat(null); }
    setSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);
  const selBox = floating ? floatBox(floating) : selection;
  const under: PixelLayer | null = useMemo(() => (hatPic ? {
    rows: draft.base, parts: draft.parts, x0: -hatPic.art.x / hatPic.art.size, y0: -hatPic.art.y / hatPic.art.size, scale: 1 / hatPic.art.size, alpha: 0.35,
  } : null), [draft, tgt.kind, (tgt as any).name]);
  const frames = tgt.kind === 'frame' ? (framesOf(draft, tgt.action, tgt.outfit) as any[] | null) : null;
  const over: PixelLayer | PixelLayer[] | null = useMemo(() => {
    if (tgt.kind === 'extra' && drawnHat?.art) {
      return { rows: drawnHat.art.rows, parts: drawnHat.art.palette.map((color, i) => ({ char: String.fromCharCode(97 + i), color })), x0: drawnHat.art.x, y0: drawnHat.art.y, scale: drawnHat.art.size, alpha: 0.4 };
    }
    // An outfit's own face is drawn under its glasses: they show faintly over it.
    if (tgt.kind === 'own-face') {
      const glasses = draft.outfits.find((o) => o.name === tgt.outfit)?.ownFace?.glasses || [];
      return { rows: layPatches(Array.from({ length: 100 }, () => '.'.repeat(100)), glasses) as string[], parts: draft.parts, x0: 0, y0: 0, scale: 1, alpha: 0.45 };
    }
    if (tgt.kind === 'frame') {
      const layers: PixelLayer[] = [];
      const before = onion && tgt.index > 0 ? framePixels(draft, tgt.action, tgt.outfit, tgt.index - 1) as string[] | null : null;
      const after = onionNext ? framePixels(draft, tgt.action, tgt.outfit, tgt.index + 1) as string[] | null : null;
      if (before) layers.push({ rows: before, parts: draft.parts, x0: 0, y0: 0, scale: 1, alpha: 0.3 });
      if (after) layers.push({ rows: after, parts: draft.parts, x0: 0, y0: 0, scale: 1, alpha: 0.18 });
      return layers.length ? layers : null;
    }
    return null;
  }, [draft, tgt.kind, (tgt as any).name, (tgt as any).action, (tgt as any).outfit, (tgt as any).index, onion, onionNext]);

  // Played on the canvas: each frame up as long as it stays up, at the speed chosen, round and round.
  useEffect(() => {
    if (!canvasPlay || tgt.kind !== 'frame' || !frames?.length) return undefined;
    const i = Math.min(tgt.index, frames.length - 1);
    const timer = setTimeout(() => goFrame(tgt.action, tgt.outfit, (i + 1) % frames.length), Math.max(16, frames[i].ms / playSpeed));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasPlay, where, playSpeed, frames?.length]);
  useEffect(() => { if (tgt.kind !== 'frame') setCanvasPlay(false); }, [tgt.kind]);

  const warnings = useMemo(() => pixelWarnings(draft) as any[], [draft]);
  const part = draft.parts.find((p) => p.char === char) || null;
  const hoverPart = hover && !hatPic ? draft.parts.find((p) => p.char === rows[hover[1]]?.[hover[0]]) : null;
  const canRestore = tgt.kind !== 'base' && tgt.kind !== 'hat';
  const toolList: [PixelTool, React.ReactNode, string][] = [
    ['pencil', <Pencil size={13} />, `${t.pixelToolPencil || 'Pencil'} (B)`],
    ['eraser', <Eraser size={13} />, `${t.pixelToolEraser || 'Eraser: leaves it empty'} (E)`],
    ...(canRestore ? [['restore', <RotateCcw size={13} />, `${t.pixelToolRestore || 'Back to what is under it'} (R)`] as [PixelTool, React.ReactNode, string]] : []),
    ['fill', <PaintBucket size={13} />, `${t.pixelToolFill || 'Fill'} (G)`],
    ['picker', <Pipette size={13} />, `${t.pixelToolPicker || 'Pick a colour from the drawing'} (I)`],
    ['line', <Minus size={13} />, `${t.pixelToolLine || 'Line'} (L)`],
    ['rect', <Square size={13} />, `${t.pixelToolRect || 'Box'} (U)`],
    ['select', <SquareDashedMousePointer size={13} />, `${t.pixelToolSelect || 'Select: move, copy, flip'} (M)`],
    ...((tgt.kind === 'face' || tgt.kind === 'extra' || tgt.kind === 'own-face') ? [['region', <BoxSelect size={13} />, `${t.pixelToolRegion || 'Region: this face replaces the whole box'} (X)`] as [PixelTool, React.ReactNode, string]] : []),
  ];
  useEffect(() => { if ((tool === 'restore' && !canRestore) || (tool === 'region' && !(tgt.kind === 'face' || tgt.kind === 'extra' || tgt.kind === 'own-face'))) setTool('pencil'); }, [tgt.kind]);

  // The avatar alive, wearing whatever is being drawn.
  const previewFace = tgt.kind === 'face' || tgt.kind === 'own-face' ? tgt.name : 'neutral';
  const previewOutfit = tgt.kind === 'outfit' || tgt.kind === 'front-outfit' ? tgt.name : tgt.kind === 'frame' || tgt.kind === 'own-face' || tgt.kind === 'own-glasses' ? tgt.outfit : '';
  // What the open outfit has and has not got.
  const checklist = tgt.kind === 'outfit' ? outfitChecklist(draft, tgt.name) as { actions: { name: string; frames: number }[]; hats: string[] | null; faces: string[]; ownFaces: { name: string; drawn: boolean }[] | null; front: boolean | null } : null;
  const openOutfit = tgt.kind === 'outfit' ? draft.outfits.find((o) => o.name === tgt.name) || null : null;
  const [ownBox, setOwnBox] = useState('');
  useEffect(() => { setOwnBox(openOutfit?.ownFace ? openOutfit.ownFace.region.join(', ') : ''); }, [tgt.kind, (tgt as any).name, openOutfit?.ownFace?.region.join(',')]);
  const goFrame = (action: string, outfit: string, index: number) => setTarget({ kind: 'frame', action, outfit, index });
  // A frame dragged along the strip; the frame being drawn stays the one being drawn, wherever it went.
  const frameOrder = useDragOrder(({ from, gap }) => {
    if (tgt.kind !== 'frame' || !frames) return;
    const order = moveToGap(frames.map((_: any, i: number) => i), from, gap);
    commit(moveFrame(draft, tgt.action, tgt.outfit, from, landedAt(from, gap) - from));
    goFrame(tgt.action, tgt.outfit, Math.max(0, order.indexOf(tgt.index)));
  }, { axis: 'x' });
  const play = () => { if (tgt.kind === 'frame') setPlaying({ name: tgt.action, key: `${tgt.action}:${Date.now()}` }); };
  const newAction = () => {
    const made = addAction(draft, { label: actionName.trim() });
    commit(made.avatar);
    goFrame(made.name, '', 0);
    setActionName('');
  };
  // Which of a face's, extra's, outfit's or action's own settings are being changed.
  const itemKind = tgt.kind === 'hat' ? 'extra' : tgt.kind === 'frame' ? 'action' : tgt.kind;
  const previewExtras = tgt.kind === 'extra' || tgt.kind === 'hat' || tgt.kind === 'front-extra' ? [tgt.name] : [];
  /*
    One list for both views of an avatar that turns, and Side | Front over
    the canvas: whatever is picked is drawn in the view chosen. The drawing,
    a face, an outfit and an extra each have a front version; what it does,
    an outfit's own face and the set-up are the side's alone.
  */
  const FRONT_KINDS = ['front', 'front-face', 'front-outfit', 'front-extra'];
  const onFront = FRONT_KINDS.includes(tgt.kind);
  const frontOf = (tg: PixelTarget): PixelTarget | null => {
    if (!draft.turn) return null;
    if (tg.kind === 'base') return { kind: 'front' };
    if (tg.kind === 'face') return { kind: 'front-face', name: tg.name };
    if (tg.kind === 'outfit') return { kind: 'front-outfit', name: tg.name };
    if (tg.kind === 'extra' || tg.kind === 'hat') return { kind: 'front-extra', name: tg.name };
    return null;
  };
  const sideOf = (tg: PixelTarget): PixelTarget => {
    if (tg.kind === 'front') return { kind: 'base' };
    if (tg.kind === 'front-face') return { kind: 'face', name: tg.name };
    if (tg.kind === 'front-outfit') return { kind: 'outfit', name: tg.name };
    if (tg.kind === 'front-extra') return draft.extras.find((e) => e.name === tg.name)?.art ? { kind: 'hat', name: tg.name } : { kind: 'extra', name: tg.name };
    return tg;
  };
  // The view chosen stays chosen: on Front, picking something else opens its front version, where it has one.
  const [stayFront, setStayFront] = useState(false);
  const pick = (tg: PixelTarget) => {
    const front = frontOf(tg);
    if (front && exists(front) && (stayFront || !exists(tg))) { setTarget(front); return; }
    setTarget(tg);
  };
  // What the switch stands on: the thing picked, from the side and from the front.
  const sideTarget = onFront ? sideOf(tgt) : tgt;
  const frontTarget = onFront ? tgt : frontOf(tgt);
  const hasSide = exists(sideTarget);
  const hasFront = Boolean(frontTarget && exists(frontTarget));
  const isOpen = (kind: string, name?: string) => sideTarget.kind === kind && (name === undefined || (sideTarget as any).name === name);
  // Started from the front: a face empty, an outfit as the front view is, an extra empty.
  const startFront = (tg: PixelTarget) => {
    const next = tg.kind === 'front-face' ? addFrontFace(draft, tg.name) : tg.kind === 'front-outfit' ? addFrontOutfit(draft, tg.name) : tg.kind === 'front-extra' ? addFrontExtra(draft, tg.name) : draft;
    commit(next as PixelAvatarDef);
    setTarget(tg);
  };
  const showFront = () => {
    if (!frontTarget) return;
    setStayFront(true);
    if (hasFront) setTarget(frontTarget); else startFront(frontTarget);
  };
  const showSide = () => {
    setStayFront(false);
    if (hasSide) { setTarget(sideTarget); return; }
    // A face drawn only from the front, started from the side.
    if (sideTarget.kind === 'face') { const made = addFace(draft, { name: sideTarget.name }); commit(made.avatar); setTarget({ kind: 'face', name: made.name }); }
  };
  // An outfit or extra not drawn from the front yet: marked in the list, since from the front it does not show.
  const lacksFront = (kind: 'outfit' | 'extra', name: string) => Boolean(draft.turn) && !(kind === 'outfit' ? draft.turn!.front.outfits : draft.turn!.front.extras)?.some((x) => x.name === name);
  const frontDot = (kind: 'outfit' | 'extra', name: string) => (lacksFront(kind, name)
    ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 ml-1.5 align-middle" title={t.pixelFrontMissingHint || 'Not drawn from the front yet: it does not show while the avatar faces the front'} data-pixel-lacks-front />
    : null);
  /*
    The preview faces the way of what is opened to draw: the front for the
    front view, the side it was drawn facing for the rest — rather than
    turning by itself, which faces the front most of the time. It can
    still be set to turn by itself, or held either way, under it.
  */
  useEffect(() => {
    if (!draft.turn) return;
    setFacing(FRONT_KINDS.includes(tgt.kind) ? 'front' : (draft.drawnFacing || 'left'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [where]);
  // An outfit or extra from the front, as a warning or the checklist asks: opened, or started.
  const drawFront = (kind: 'outfit' | 'extra', name: string) => {
    const tg = { kind: kind === 'outfit' ? 'front-outfit' : 'front-extra', name } as PixelTarget;
    setStayFront(true);
    if (exists(tg)) setTarget(tg); else startFront(tg);
  };

  const addOne = (kind: 'face' | 'extra' | 'outfit', special?: string) => {
    const label = special ? '' : names[kind].trim();
    const made = kind === 'face' ? addFace(draft, { name: special, label })
      : kind === 'extra' ? addExtra(draft, { label, hat: hatNew })
        : addOutfit(draft, { label, from: tgt.kind === 'outfit' ? tgt.name : '' });
    commit(made.avatar);
    setTarget({ kind, name: made.name } as PixelTarget);
    setNames((n) => ({ ...n, [kind]: '' }));
  };
  const addHat = () => {
    const made = addDrawnHat(draft, { label: names.hat.trim() });
    commit(made.avatar);
    setTarget({ kind: 'hat', name: made.name });
    setNames((n) => ({ ...n, hat: '' }));
  };
  const missingSpecial = SPECIAL.filter((f) => !draft.faces.some((x) => x.name === f));
  const current = tgt.kind === 'face' ? draft.faces.find((f) => f.name === tgt.name)
    : tgt.kind === 'extra' || tgt.kind === 'hat' ? draft.extras.find((e) => e.name === tgt.name)
      : tgt.kind === 'outfit' ? draft.outfits.find((o) => o.name === tgt.name)
        : tgt.kind === 'frame' ? draft.actions.find((a) => a.name === tgt.action) : null;
  const usedHere = part ? partUse(draft, part.char) : 0;

  return (
    <div className="glass-panel rounded-3xl border border-zinc-800 p-4 md:p-6 space-y-4" data-pixel-editor>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" data-pixel-tools>
          {toolList.map(([id, icon, title]) => (
            <button key={id} onClick={() => setTool(id)} title={title} data-pixel-tool={id}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border ${tool === id ? 'border-current-accent text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>
              {icon}
            </button>
          ))}
        </div>
        <span className="w-px h-6 bg-zinc-800" />
        <button onClick={undo} disabled={!past.length} title={`${t.pixelUndo || 'Undo'} (Ctrl+Z)`} className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30" data-pixel-undo><Undo2 size={13} /></button>
        <button onClick={redo} disabled={!future.length} title={`${t.pixelRedo || 'Redo'} (Ctrl+Y)`} className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30" data-pixel-redo><Redo2 size={13} /></button>
        <span className="w-px h-6 bg-zinc-800" />
        <button onClick={() => (hatPic ? setHatZoom((z) => Math.max(3, z - 1)) : setZoom((z) => Math.max(3, z - 1)))} title={t.pixelZoomOut || 'Smaller'} className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white"><ZoomOut size={13} /></button>
        <button onClick={() => (hatPic ? setHatZoom((z) => Math.min(24, z + 1)) : setZoom((z) => Math.min(14, z + 1)))} title={t.pixelZoomIn || 'Bigger'} className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white"><ZoomIn size={13} /></button>
        <button onClick={() => setGrid((g) => !g)} title={t.pixelGrid || 'Grid'} className={`w-8 h-8 flex items-center justify-center rounded-lg border ${grid ? 'border-zinc-600 text-zinc-200' : 'border-zinc-800 text-zinc-500'}`}><Grid3x3 size={13} /></button>
        <button onClick={() => setReferencing((v) => !v)} title={t.pixelReference || 'Reference picture'} className={`w-8 h-8 flex items-center justify-center rounded-lg border ${referencing || reference?.shown ? 'border-sky-400 text-sky-300' : 'border-zinc-800 text-zinc-500 hover:text-white'}`} data-pixel-reference-open><ImageIcon size={13} /></button>
        <button onClick={() => setImporting((v) => !v)} title={t.pixelImport || 'Bring in a drawn picture'} className={`w-8 h-8 flex items-center justify-center rounded-lg border ${importing ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500 hover:text-white'}`} data-pixel-import-open><ImagePlus size={13} /></button>
        <button onClick={() => setMirror((m) => !m)} title={t.pixelMirror || 'Draw both sides at once, mirrored across the middle'} className={`w-8 h-8 flex items-center justify-center rounded-lg border ${mirror ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500'}`} data-pixel-mirror><FlipHorizontal size={13} /></button>
        {mirror && !hatPic && (
          <span className="flex items-center gap-1" data-pixel-mirror-line>
            <input type="number" step={0.5} min={0} max={99} value={mirrorAxis ?? 49.5} onChange={(e) => setMirrorAxis(Math.max(0, Math.min(99, Math.round(Number(e.target.value) * 2) / 2)))} title={t.pixelMirrorLine || 'Where the mirror line is: a column, or between two (49.5 is the middle)'} className="w-16 bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none" data-pixel-mirror-axis />
            <button onClick={() => setMirrorAxis(drawnMiddle(draft.base) as number)} className={small} title={t.pixelMirrorMiddleHint || 'Put the line down the middle of what is drawn'} data-pixel-mirror-middle>{t.pixelMirrorMiddle || 'Middle of the drawing'}</button>
          </span>
        )}
        <button onClick={() => selOps.current.paste?.()} disabled={!clipboard} title={`${t.pixelPaste || 'Paste'} (Ctrl+V)`} className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30" data-pixel-paste><ClipboardPaste size={13} /></button>
        <span className="text-[10px] text-zinc-600 font-mono min-w-[7rem]" data-pixel-hover>{hover ? `${hover[0]}, ${hover[1]}${hoverPart ? ` · ${hoverPart.name}` : ''}` : ''}</span>
        <div className="flex-1" />
        {warnings.length > 0 && (
          <button onClick={() => setShowWarnings((v) => !v)} className={`${small} ${showWarnings ? 'border-amber-500 text-amber-300' : 'text-amber-400'}`} title={t.pixelWarnings || 'Worth a look'} data-pixel-warnings-open><AlertTriangle size={11} /> {warnings.length}</button>
        )}
        {dirty && <span className="text-[10px] text-amber-400" data-pixel-dirty>{t.pixelUnsaved || 'Not saved yet'}</span>}
        <button onClick={discard} disabled={!dirty || saving} className={small} data-pixel-discard>{t.pixelDiscard || 'Discard'}</button>
        <button onClick={() => save()} disabled={!dirty || saving} className={`${small} border-current-accent text-current-accent`} data-pixel-save><Save size={12} /> {t.save || 'Save'}</button>
      </div>
      {showWarnings && warnings.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-amber-700/50 bg-amber-950/10 p-3" data-pixel-warnings>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-amber-400">{fill(t.pixelWarningsCount || '{n} worth a look — none stops it being saved', { n: warnings.length })}</span>
            {dirty && <button onClick={() => { setShowWarnings(false); save(true); }} className={`${small} border-current-accent text-current-accent`} data-pixel-save-anyway>{t.pixelSaveAnyway || 'Save anyway'}</button>}
            <button onClick={() => setShowWarnings(false)} className="p-1 text-zinc-500 hover:text-white"><X size={12} /></button>
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px] text-zinc-300" data-pixel-warning={w.code}>
              <span className="flex-1 leading-relaxed">
                {w.code === 'face-below-head' ? fill(t.pixelWarnFaceBelow || 'The face “{name}” draws below where the head ends: that part moves with the body as it breathes.', { name: pixelFaceName(draft, w.name, t) })
                  : w.code === 'hat-hair-pokes' ? fill(t.pixelWarnHair || 'Hair shows above the hat “{name}” in {outfit} ({n} pixels): rub it out in the hair it hides.', { name: pixelExtraName(draft, w.name, t), outfit: pixelOutfitName(draft, w.outfit, t), n: w.pixels })
                    : w.code === 'unused-colours' ? fill(t.pixelWarnUnused || '{n} colours are drawn nowhere.', { n: w.parts.length })
                    : w.code === 'front-missing' ? fill(t.pixelWarnFrontMissing || '“{name}” is not drawn from the front: it does not show while the avatar faces the front, which is most of the time.', { name: w.kind === 'outfit' ? pixelOutfitName(draft, w.name, t) : pixelExtraName(draft, w.name, t) })
                      : w.kind === 'frame' ? fill(t.pixelWarnEmptyFrame || 'Frame {n} of “{name}” in {outfit} has nothing drawn in it.', { n: w.index + 1, name: pixelActionLabel(draft, w.name, t), outfit: pixelOutfitName(draft, w.outfit, t) })
                        : fill(t.pixelWarnEmpty || '“{name}” has nothing drawn in it yet.', { name: w.kind === 'face' ? pixelFaceName(draft, w.name, t) : pixelExtraName(draft, w.name, t) })}
              </span>
              {w.code === 'unused-colours' ? (
                <button onClick={() => { let next = draft; for (const id of w.parts) next = removePart(next, id) as PixelAvatarDef; commit(next); }} className={small} data-pixel-warning-fix>{t.pixelTakeOut || 'Take them out'}</button>
              ) : w.code === 'front-missing' ? (
                <button onClick={() => { setShowWarnings(false); drawFront(w.kind, w.name); }} className={small} data-pixel-warning-draw-front>{t.pixelDrawFromFront || 'Draw it from the front'}</button>
              ) : (
                <button
                  onClick={() => setTarget(w.code === 'hat-hair-pokes' ? { kind: 'extra', name: w.name, outfit: w.outfit } : w.kind === 'frame' ? { kind: 'frame', action: w.name, outfit: w.outfit, index: w.index } : w.kind === 'extra' ? { kind: 'extra', name: w.name } : { kind: 'face', name: w.name })}
                  className={small} data-pixel-warning-show
                >{t.pixelShowMe || 'Show me'}</button>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="flex items-center gap-2 text-[11px] text-amber-400" data-pixel-editor-error><AlertTriangle size={13} /> {error}</p>}

      {/* With the whole width of the screen, the colours and what goes with them sit beside the canvas from a laptop up. */}
      <div className="grid grid-cols-1 md:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[11rem_minmax(0,1fr)_15rem] gap-4 items-start">
        {/* ------------------------------------------------- what is being drawn */}
        <div className="space-y-3 text-[11px]" data-pixel-targets>
          {/* One list for both views: Side | Front over the canvas says which one each is drawn in. */}
          <button onClick={() => pick({ kind: 'base' })} className={item(isOpen('base'))} data-pixel-target="base">{t.pixelTheDrawing || 'The drawing'}</button>
          <button onClick={() => setTarget({ kind: 'setup' })} className={item(tgt.kind === 'setup')} data-pixel-target="setup">{t.pixelSetUp || 'Set up: colour and eyes'}</button>
          <div className="space-y-1">
            <span className={tag}>{t.avatarCostume || 'Outfits'}</span>
            {draft.outfits.map((o) => (
              <button key={o.name} onClick={() => pick({ kind: 'outfit', name: o.name })} className={item(isOpen('outfit', o.name))} data-pixel-target={`outfit:${o.name}`}>{pixelOutfitName(draft, o.name, t)}{frontDot('outfit', o.name)}</button>
            ))}
            <div className="flex gap-1">
              <input value={names.outfit} onChange={(e) => setNames({ ...names, outfit: e.target.value })} placeholder={t.pixelNewOutfit || 'New outfit'} className={box} maxLength={40} data-pixel-new-outfit
                onKeyDown={(e) => { if (e.key === 'Enter') addOne('outfit'); }} />
              <button onClick={() => addOne('outfit')} className={small} title={t.pixelNewOutfitHint || 'A copy of the drawing (or of the outfit open now) to draw over'} data-pixel-add-outfit><Plus size={11} /></button>
            </div>
          </div>
          <div className="space-y-1">
            <span className={tag}>{t.avatarFace || 'Faces'}</span>
            <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
              {/* Its faces, and any drawn only from the front. */}
              {[...draft.faces.map((f) => f.name), ...(draft.turn?.front.faces || []).map((f) => f.name).filter((n) => !draft.faces.some((f) => f.name === n))].map((name) => (
                <button key={name} onClick={() => pick({ kind: 'face', name })} className={item(isOpen('face', name))} data-pixel-target={`face:${name}`}>{pixelFaceName(draft, name, t)}</button>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={names.face} onChange={(e) => setNames({ ...names, face: e.target.value })} placeholder={t.pixelNewFace || 'New face'} className={box} maxLength={40} data-pixel-new-face
                onKeyDown={(e) => { if (e.key === 'Enter') addOne('face'); }} />
              <button onClick={() => addOne('face')} className={small} data-pixel-add-face><Plus size={11} /></button>
            </div>
            {missingSpecial.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1" data-pixel-special>
                {missingSpecial.map((f) => (
                  <button key={f} onClick={() => addOne('face', f)} className="px-1.5 py-0.5 rounded border border-dashed border-zinc-700 text-[9px] text-zinc-500 hover:text-zinc-200" title={t.pixelSpecialHint || 'A face the avatar uses by itself'} data-pixel-add-special={f}>
                    + {pixelFaceName(draft, f, t)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <span className={tag}>{t.pixelExtras || 'Extras'}</span>
            {draft.extras.filter((e) => !e.art && !e.hat).map((e) => (
              <button key={e.name} onClick={() => pick({ kind: 'extra', name: e.name })} className={item(isOpen('extra', e.name))} data-pixel-target={`extra:${e.name}`}>{pixelExtraName(draft, e.name, t)}{frontDot('extra', e.name)}</button>
            ))}
            <div className="flex gap-1">
              <input value={names.extra} onChange={(e) => setNames({ ...names, extra: e.target.value })} placeholder={t.pixelNewExtra || 'New extra'} className={box} maxLength={40} data-pixel-new-extra
                onKeyDown={(e) => { if (e.key === 'Enter') addOne('extra'); }} />
              <button onClick={() => addOne('extra')} className={small} data-pixel-add-extra><Plus size={11} /></button>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-500"><input type="checkbox" checked={hatNew} onChange={(e) => setHatNew(e.target.checked)} className="accent-current-accent" /> {t.pixelIsHat || 'It is a hat (one at a time)'}</label>
          </div>
          <div className="space-y-1">
            {/* Every hat, whichever kind: drawn on the avatar's own grid (an extra worn one at a time), or a picture of its own. */}
            <span className={tag}>{t.pixelHatsList || 'Hats'}</span>
            {draft.extras.filter((e) => e.hat || e.art).map((e) => (e.art ? (
              <button key={e.name} onClick={() => pick({ kind: 'hat', name: e.name })} className={item(isOpen('hat', e.name) || isOpen('extra', e.name))} data-pixel-target={`hat:${e.name}`}>{pixelExtraName(draft, e.name, t)}{frontDot('extra', e.name)}</button>
            ) : (
              <button key={e.name} onClick={() => pick({ kind: 'extra', name: e.name })} className={item(isOpen('extra', e.name))} data-pixel-target={`extra:${e.name}`}>{pixelExtraName(draft, e.name, t)}{frontDot('extra', e.name)}</button>
            )))}
            <div className="flex gap-1">
              <input value={names.hat} onChange={(e) => setNames({ ...names, hat: e.target.value })} placeholder={t.pixelNewHat || 'New drawn hat'} className={box} maxLength={40} data-pixel-new-hat
                onKeyDown={(e) => { if (e.key === 'Enter') addHat(); }} />
              <button onClick={addHat} className={small} title={t.pixelNewHatHint || 'A picture of its own, with its own colours and pixel size, worn over the head'} data-pixel-add-hat><Plus size={11} /></button>
            </div>
          </div>
          <div className="space-y-1">
            <span className={tag}>{t.pixelActions || 'Things it does'}</span>
            {draft.actions.map((a) => (
              <button key={a.name} onClick={() => goFrame(a.name, a.outfits[''] ? '' : Object.keys(a.outfits)[0] ?? '', 0)} className={item(tgt.kind === 'frame' && tgt.action === a.name)} data-pixel-target={`action:${a.name}`}>{pixelActionLabel(draft, a.name, t)}</button>
            ))}
            <div className="flex gap-1">
              <input value={actionName} onChange={(e) => setActionName(e.target.value)} placeholder={t.pixelNewAction || 'Something new to do'} className={box} maxLength={40} data-pixel-new-action
                onKeyDown={(e) => { if (e.key === 'Enter') newAction(); }} />
              <button onClick={newAction} className={small} data-pixel-add-action><Plus size={11} /></button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- the canvas */}
        <div className="space-y-2 min-w-0" ref={canvasColumn}>
          {/* Side | Front, for one that turns: the thing picked, drawn in either view — "+" where that view is not drawn yet, to start it. */}
          {draft.turn && (
            <div className="flex flex-wrap items-center gap-2" data-pixel-views>
              <div className="inline-flex rounded-lg border border-zinc-800 overflow-hidden">
                <button onClick={showSide} data-pixel-view="side" title={t.pixelViewSideHint || 'The side view. The other side is this one, mirrored.'}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest ${!onFront ? 'bg-current-accent/15 text-current-accent' : !hasSide ? 'text-amber-400' : 'text-zinc-400 hover:text-white'}`}>
                  {onFront && !hasSide ? '+ ' : ''}{t.pixelViewSide || 'Side'}
                </button>
                <button onClick={showFront} disabled={!frontTarget} data-pixel-view="front" title={t.pixelViewFrontHint || 'From the front: one that turns faces the front most of the time.'}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border-l border-zinc-800 disabled:opacity-30 ${onFront ? 'bg-current-accent/15 text-current-accent' : frontTarget && !hasFront ? 'text-amber-400' : 'text-zinc-400 hover:text-white'}`}>
                  {frontTarget && !hasFront ? '+ ' : ''}{t.pixelViewFront || 'Front'}
                </button>
              </div>
              <span className="text-[10px] text-zinc-500" data-pixel-view-note>
                {!frontTarget
                  ? (tgt.kind === 'setup' ? (t.pixelViewBoth || 'The same from the side and the front.')
                    : tgt.kind === 'frame' ? (t.pixelViewActionsSide || 'Drawn from the side only: it turns to its side to do it.')
                      : (t.pixelViewSideOnly || 'Drawn from the side only.'))
                  : onFront ? (hasSide ? (t.pixelViewFrontNote || 'From the front.') : (t.pixelViewFrontOnly || 'Drawn from the front only: “+ Side” starts it from the side.'))
                    : !hasFront ? (t.pixelFrontMissingHint || 'Not drawn from the front yet: it does not show while the avatar faces the front')
                      : (t.pixelSideMirrorHint || 'The other side is this one, mirrored.')}
              </span>
            </div>
          )}
          {referencing && (
            <PixelReferencePanel
              reference={reference} setReference={setReference} image={referenceImage} moving={movingReference} setMoving={setMovingReference}
              listAssets={listAssets} uploadAsset={uploadAsset} onClose={() => { setReferencing(false); setMovingReference(false); }} t={t}
            />
          )}
          {importing && <PixelImport draft={draft} target={tgt} onApply={commit} onClose={() => setImporting(false)} t={t} />}
          {selBox && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5" data-pixel-selection-bar>
              <span className="text-[10px] text-zinc-400 font-mono" data-pixel-selection-size>{selBox[2] - selBox[0] + 1} × {selBox[3] - selBox[1] + 1}{floating ? ` · ${t.pixelFloating || 'picked up'}` : ''}</span>
              <span className="flex-1" />
              <button onClick={() => selOps.current.copy()} className={small} title="Ctrl+C" data-pixel-sel-copy><Copy size={11} /> {t.pixelCopy || 'Copy'}</button>
              <button onClick={() => selOps.current.cut()} className={small} title="Ctrl+X" data-pixel-sel-cut><Scissors size={11} /> {t.pixelCut || 'Cut'}</button>
              <button onClick={() => selOps.current.flip('h')} className={small} title={t.pixelFlipH || 'Flip side to side'} data-pixel-sel-flip-h><FlipHorizontal2 size={11} /></button>
              <button onClick={() => selOps.current.flip('v')} className={small} title={t.pixelFlipV || 'Flip top to bottom'} data-pixel-sel-flip-v><FlipVertical2 size={11} /></button>
              <button onClick={() => selOps.current.remove()} className={`${small} hover:text-rose-400`} title={t.delete || 'Delete'} data-pixel-sel-delete><Trash2 size={11} /></button>
              <button onClick={() => selOps.current.done()} className={`${small} border-current-accent text-current-accent`} title="Enter" data-pixel-sel-done><Check size={11} /> {t.pixelPutDown || 'Put down'}</button>
            </div>
          )}
          {tool === 'select' && !selBox && (
            <p className="text-[10px] text-zinc-500">{t.pixelSelectHint || 'Drag a box to select. Drag inside it to move it, arrows nudge it (Shift: 5), Ctrl+C / Ctrl+X / Ctrl+V copy, cut and paste — into another face, frame or avatar too.'}</p>
          )}
          <div className="overflow-auto max-h-[75vh] rounded-lg">
            <PixelCanvas
              rows={rows} parts={hatPic ? hatPic.parts : draft.parts} tool={tool} char={hatPic ? hatChar : char} zoom={hatPic ? hatZoom : zoom} grid={grid} mirror={mirror} boxes={boxes}
              headLastRow={hatPic ? null : (tgt.kind === 'front' || tgt.kind === 'front-face' || tgt.kind === 'front-outfit' || tgt.kind === 'front-extra') ? draft.turn?.front.headLastRow ?? null : draft.split?.headLastRow ?? null} canRestore={canRestore} under={under} over={over}
              // The reference sits on the drawing; on a drawn hat's own grid it is where the hat sits over it.
              reference={reference?.shown && referenceImage ? {
                image: referenceImage, opacity: reference.opacity, over: reference.over,
                ...(hatPic ? referenceOnHat({ x: reference.x, y: reference.y, w: reference.w }, hatPic.art) : { x: reference.x, y: reference.y, w: reference.w }),
              } : null}
              movingReference={movingReference && Boolean(reference?.shown)}
              onMoveReference={(dx, dy) => {
                const k = hatPic ? hatPic.art.size : 1;
                setReference((r) => (r ? { ...r, x: Math.round((r.x + dx * k) * 100) / 100, y: Math.round((r.y + dy * k) * 100) / 100 } : r));
              }}
              onStroke={(cells) => commit(hatPic ? paintHat(draft, (tgt as any).name, cells) : paint(draft, tgt.kind === 'setup' ? { kind: 'base' } : tgt, cells))}
              onRegion={(b) => commit(regionPatch(draft, tgt, b))}
              onPick={(c) => { if (hatPic) setHatChar(c); else setChar(c); setTool('pencil'); }}
              mirrorAxis={hatPic ? null : mirrorAxis}
              selection={selection} floating={floating}
              onSelect={(box) => { selOps.current.putDown?.(); setSelection(box); }}
              onMoveSelection={(dx, dy) => selOps.current.nudge?.(dx, dy)}
              onPutDown={() => selOps.current.putDown?.()}
              onHover={setHover}
            />
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            {tgt.kind === 'setup' ? (t.pixelSetupCanvasHint || 'The drawing, to point at while setting it up: the numbers at the top say which pixel is under the pointer.')
              : tgt.kind === 'own-glasses' ? (t.pixelDrawOwnGlassesHint || 'This outfit’s own glasses: laid over the eyes last, whatever the face.')
              : tgt.kind === 'own-face' ? (t.pixelDrawOwnFaceHint || 'This face as it is in this outfit, inside its own face’s box — where the face drawn on the drawing keeps out. Its glasses show faintly over it.')
              : tgt.kind === 'front' ? (t.pixelDrawFrontHint || 'The front view: shown between facing one way and the other, as it turns, and while nobody is talking.')
              : tgt.kind === 'front-face' ? (t.pixelDrawFrontFaceHint || 'A face of the front view, drawn over it: the mouth open while they talk, the eyes shut and half shut as it blinks.')
              : tgt.kind === 'front-outfit' ? (t.pixelDrawFrontOutfitHint || 'This outfit as it looks from the front: the front view, redrawn whole. Faces still go over it, as they do over the outfit from the side.')
              : tgt.kind === 'front-extra' ? (t.pixelDrawFrontExtraHint || 'This extra as it looks from the front, drawn over the front view. What you draw is all it changes; yellow boxes are its patches.')
              : tgt.kind === 'frame' ? (t.pixelDrawFrameHint || 'A frame of it, drawn over this outfit at rest — with its eyes shut, when the frame shuts them. What you draw is all it changes; the frame before shows faintly under it.')
              : tgt.kind === 'hat' ? (t.pixelDrawHatHint || 'The hat’s own picture, with its own colours, over the avatar where it sits. Move it, size its pixels and give it room on the right; then draw the hair it hides.')
              : tgt.kind === 'extra' && drawnHat ? (t.pixelDrawHidesHint || 'The hair this hat hides: rub out what would stick up through it. The hat shows faintly over it.')
              : tgt.kind === 'base' ? (t.pixelDrawBaseHint || 'The drawing itself, as it stands at rest. The dashed blue line is where the head ends: above it moves as a head when it breathes and turns.')
              : tgt.kind === 'outfit' ? (t.pixelDrawOutfitHint || 'An outfit is the whole drawing, redrawn. Faces still go over it: where a face changes the drawing as drawn, it shows; where it does not, the outfit stays.')
                : (t.pixelDrawPatchHint || 'Drawn over the drawing as drawn. What you draw is all it changes; yellow boxes are its patches. With the region tool, the face replaces the whole of a box, so laid over another face it takes its place there.')}
          </p>

          {tgt.kind === 'setup' && <PixelSetup draft={draft} commit={commit} t={t} />}
          {checklist && openOutfit && (
            <div className="space-y-3 rounded-xl border border-zinc-800 p-3" data-pixel-checklist>
              <span className={tag}>{fill(t.pixelInOutfit || 'In {outfit}', { outfit: pixelOutfitName(draft, openOutfit.name, t) })}</span>
              {checklist.front !== null && (
                <button onClick={() => drawFront('outfit', openOutfit.name)} data-pixel-checklist-front={checklist.front ? 'drawn' : 'missing'}
                  className={`px-2 py-1 rounded-md border text-[9px] ${checklist.front ? 'border-zinc-700 text-zinc-300' : 'border-dashed border-amber-700/60 text-amber-400'}`}>
                  {t.pixelFrontView || 'Front view'} · {checklist.front ? (t.pixelDrawn || 'drawn') : (t.pixelNotDrawn || 'not drawn yet')}
                </button>
              )}
              {checklist.actions.length > 0 && (
                <div className="space-y-1">
                  <span className="block text-[10px] text-zinc-500">{t.pixelActions || 'Things it does'}</span>
                  <div className="flex flex-wrap gap-1" data-pixel-checklist-actions>
                    {checklist.actions.map((a) => (
                      <button key={a.name} onClick={() => goFrame(a.name, openOutfit.name, 0)} data-pixel-checklist-action={a.name}
                        className={`px-2 py-1 rounded-md border text-[9px] ${a.frames ? 'border-zinc-700 text-zinc-300' : 'border-dashed border-amber-700/60 text-amber-400'}`}>
                        {pixelActionLabel(draft, a.name, t)} · {a.frames ? fill(t.pixelFrames || '{n} frames', { n: a.frames }) : (t.pixelNotDrawn || 'not drawn yet')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <span className="block text-[10px] text-zinc-500">{t.pixelFacesOnIt || 'Every face on it — check none clashes'}</span>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1" data-pixel-checklist-faces>
                  {['neutral', ...checklist.faces].map((f) => (
                    <button key={f} title={pixelFaceName(draft, f, t)} onClick={() => (f === 'neutral' ? null : setTarget(openOutfit.ownFace ? { kind: 'own-face', outfit: openOutfit.name, name: f } : { kind: 'face', name: f }))}
                      className="rounded border border-zinc-800 hover:border-zinc-600 bg-zinc-950/70 overflow-hidden">
                      <div className="aspect-[48/44]"><PixelKitAvatar kit={draft} faces={f} outfit={openOutfit.name} crop={pixelFaceCrop(draft)} /></div>
                    </button>
                  ))}
                </div>
              </div>
              {checklist.hats === null ? (
                <p className="text-[10px] text-zinc-500">{t.avatarCostumeHasHat || 'This outfit has its own headwear'}</p>
              ) : checklist.hats.length > 0 && (
                <div className="space-y-1">
                  <span className="block text-[10px] text-zinc-500">{t.pixelHatsOnIt || 'Every hat on it'}</span>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1" data-pixel-checklist-hats>
                    {checklist.hats.map((h) => (
                      <div key={h} title={pixelExtraName(draft, h, t)} className="rounded border border-zinc-800 bg-zinc-950/70 aspect-square p-0.5"><PixelKitAvatar kit={draft} extras={[h]} outfit={openOutfit.name} /></div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5" data-pixel-own-face>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <input type="checkbox" checked={Boolean(openOutfit.ownFace)} onChange={(e) => { if (e.target.checked || window.confirm(t.pixelOwnFaceOffConfirm || 'Take its own face out? Its own glasses and faces go.')) commit(setOwnFace(draft, openOutfit.name, e.target.checked)); }} className="accent-current-accent" data-pixel-own-face-on />
                  {t.pixelOwnFace || 'It has a face of its own (its own glasses, say)'}
                </label>
                {openOutfit.ownFace && checklist.ownFaces && (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500">{t.pixelOwnFaceBox || 'Its box'}</span>
                      <input value={ownBox} onChange={(e) => setOwnBox(e.target.value)} onBlur={() => { const n = ownBox.split(/[^\d]+/).filter(Boolean).map(Number); if (n.length === 4) commit(setOwnFaceBox(draft, openOutfit.name, { region: n })); }} className={`${box} w-32`} placeholder="x0, y0, x1, y1" data-pixel-own-face-box />
                      <span className="text-[10px] text-zinc-500">{t.pixelLashesTo || 'Lashes to row'}</span>
                      <input type="number" min={0} max={99} value={openOutfit.lashesTo ?? ''} placeholder={String(draft.eyes?.lashes?.[1] ?? '')} onChange={(e) => commit(setOwnFaceBox(draft, openOutfit.name, { lashesTo: e.target.value === '' ? null : Number(e.target.value) }))} className={`${box} w-16`} data-pixel-own-face-lashes />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => setTarget({ kind: 'own-glasses', outfit: openOutfit.name })} className={small} data-pixel-own-glasses>{t.pixelOwnGlasses || 'Its glasses'}</button>
                      {checklist.ownFaces.map((f) => (
                        <button key={f.name} onClick={() => setTarget({ kind: 'own-face', outfit: openOutfit.name, name: f.name })} data-pixel-own-face-face={f.name}
                          className={`px-1.5 py-0.5 rounded border text-[9px] ${f.drawn ? 'border-zinc-700 text-zinc-300' : 'border-dashed border-zinc-800 text-zinc-600'}`}>
                          {pixelFaceName(draft, f.name, t)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {(tgt.kind === 'own-face' || tgt.kind === 'own-glasses') && (
            <button onClick={() => setTarget({ kind: 'outfit', name: tgt.outfit })} className={`${small}`} data-pixel-back-to-outfit>← {pixelOutfitName(draft, tgt.outfit, t)}</button>
          )}

          {tgt.kind === 'frame' && (
            <div className="space-y-2 rounded-xl border border-zinc-800 p-3" data-pixel-timeline>
              <div className="flex flex-wrap gap-1" data-pixel-frame-outfits>
                {['', ...draft.outfits.map((o) => o.name)].map((o) => {
                  const n = (framesOf(draft, tgt.action, o) as any[] | null)?.length || 0;
                  return (
                    <button key={o || 'base'} onClick={() => goFrame(tgt.action, o, 0)} data-pixel-frame-outfit={o}
                      className={`px-2 py-1 rounded-md border text-[9px] font-bold ${tgt.outfit === o ? 'border-current-accent text-current-accent' : n ? 'border-zinc-700 text-zinc-300' : 'border-dashed border-zinc-800 text-zinc-600'}`}>
                      {pixelOutfitName(draft, o, t)} · {n}
                    </button>
                  );
                })}
              </div>
              {frames && frames.length ? (
                <>
                  <div ref={frameOrder.listRef} className={`relative flex gap-1.5 overflow-x-auto pb-1 ${frameOrder.held ? 'select-none' : ''}`} data-pixel-frames>
                    {frameOrder.line}
                    {frames.map((f: any, i: number) => (
                      <button key={i} onClick={() => goFrame(tgt.action, tgt.outfit, i)} data-pixel-frame={i} {...frameOrder.row(String(i))}
                        className={`relative shrink-0 w-16 rounded-lg border overflow-hidden bg-zinc-950/70 ${tgt.index === i ? 'border-current-accent' : 'border-zinc-800 hover:border-zinc-600'} ${frameOrder.held === String(i) ? 'opacity-40' : ''}`}>
                        {frames.length > 1 && <DragGrip grip={frameOrder.grip(String(i))} title={t.pixelFrameDrag || 'Drag to change when this frame plays'} size={10} className="absolute top-0 left-0 z-10 rounded-br-md bg-zinc-950/80" />}
                        <div className="aspect-square p-0.5"><PixelKitAvatar kit={draft} faces={f.eyes === 'shut' ? ['neutral', 'blink'] : ['neutral']} outfit={tgt.outfit} action={{ name: tgt.action, frame: i }} /></div>
                        <span className="block text-[8px] text-zinc-500 py-0.5">{i + 1} · {f.ms} ms</span>
                      </button>
                    ))}
                  </div>
                  {frames[tgt.index] && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="flex items-center gap-1 text-[10px] text-zinc-500">ms
                        <input type="number" min={16} max={20000} step={10} value={frames[tgt.index].ms} onChange={(e) => commit(setFrame(draft, tgt.action, tgt.outfit, tgt.index, { ms: Number(e.target.value) }))} className={`${box} w-20`} data-pixel-frame-ms />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-zinc-400"><input type="checkbox" checked={frames[tgt.index].eyes === 'shut'} onChange={(e) => commit(setFrame(draft, tgt.action, tgt.outfit, tgt.index, { eyes: e.target.checked ? 'shut' : '' }))} className="accent-current-accent" data-pixel-frame-eyes /> {t.pixelFrameEyesShut || 'Eyes shut'}</label>
                      <span className="flex-1" />
                      <button onClick={() => { commit(moveFrame(draft, tgt.action, tgt.outfit, tgt.index, -1)); goFrame(tgt.action, tgt.outfit, Math.max(0, tgt.index - 1)); }} disabled={tgt.index === 0} className={small} title={t.pixelFrameEarlier || 'Earlier'} data-pixel-frame-left><ChevronLeft size={11} /></button>
                      <button onClick={() => { commit(moveFrame(draft, tgt.action, tgt.outfit, tgt.index, 1)); goFrame(tgt.action, tgt.outfit, Math.min(frames.length - 1, tgt.index + 1)); }} disabled={tgt.index >= frames.length - 1} className={small} title={t.pixelFrameLater || 'Later'} data-pixel-frame-right><ChevronRight size={11} /></button>
                      <button onClick={() => { commit(addFrame(draft, tgt.action, tgt.outfit, tgt.index + 1, tgt.index)); goFrame(tgt.action, tgt.outfit, tgt.index + 1); }} className={small} title={t.pixelFrameCopy || 'A copy of this frame, after it'} data-pixel-frame-copy><Copy size={11} /></button>
                      <button onClick={() => { commit(addFrame(draft, tgt.action, tgt.outfit, tgt.index + 1)); goFrame(tgt.action, tgt.outfit, tgt.index + 1); }} className={small} title={t.pixelFrameNew || 'An empty frame, after this one'} data-pixel-frame-add><Plus size={11} /></button>
                      <button onClick={() => { commit(removeFrame(draft, tgt.action, tgt.outfit, tgt.index)); goFrame(tgt.action, tgt.outfit, Math.max(0, tgt.index - 1)); }} className={`${small} hover:text-rose-400`} title={t.pixelFrameRemove || 'Take this frame out'} data-pixel-frame-remove><Trash2 size={11} /></button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={play} className={`${small} border-current-accent text-current-accent`} data-pixel-play-frames><Play size={11} /> {fill(t.pixelPlay || 'Play · {s} s', { s: (frames.reduce((s: number, f: any) => s + f.ms, 0) / 1000).toFixed(1) })}</button>
                    <label className="flex items-center gap-1 text-[10px] text-zinc-500"><input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} className="accent-current-accent" /> <Layers size={11} /> {t.pixelOnion || 'Show the frame before'}</label>
                    <label className="flex items-center gap-1 text-[10px] text-zinc-500"><input type="checkbox" checked={onionNext} onChange={(e) => setOnionNext(e.target.checked)} className="accent-current-accent" data-pixel-onion-next /> {t.pixelOnionNext || 'and the one after'}</label>
                    <span className="flex-1" />
                    <button onClick={() => setCanvasPlay((p) => !p)} className={`${small} ${canvasPlay ? 'border-current-accent text-current-accent' : ''}`} data-pixel-play-canvas>{canvasPlay ? <Square size={11} /> : <Play size={11} />} {canvasPlay ? (t.pixelStopCanvas || 'Stop') : (t.pixelPlayCanvas || 'Play on the canvas')}</button>
                    <select value={playSpeed} onChange={(e) => setPlaySpeed(Number(e.target.value))} className="bg-zinc-950/60 border border-zinc-800 rounded-md px-1 py-0.5 text-[10px] text-zinc-300" title={t.pixelSpeed || 'Speed'} data-pixel-play-speed>
                      {[0.25, 0.5, 1, 2].map((s) => <option key={s} value={s}>{s === 0.25 ? '¼×' : s === 0.5 ? '½×' : `${s}×`}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5" data-pixel-frames-empty>
                  <p className="text-[10px] text-zinc-500">{t.pixelNotInOutfit || 'It does not do this in this outfit yet. Start it:'}</p>
                  <div className="flex flex-wrap gap-1">
                    {['', ...draft.outfits.map((o) => o.name)].filter((o) => o !== tgt.outfit && (framesOf(draft, tgt.action, o) as any[] | null)?.length).map((o) => (
                      <button key={o || 'base'} onClick={() => commit(startOutfitFrames(draft, tgt.action, tgt.outfit, o))} className={small} data-pixel-frames-from={o}>{fill(t.pixelFramesFrom || 'From {outfit}’s frames', { outfit: pixelOutfitName(draft, o, t) })}</button>
                    ))}
                    <button onClick={() => commit(startOutfitFrames(draft, tgt.action, tgt.outfit, null))} className={small} data-pixel-frames-empty-start>{t.pixelFramesEmpty || 'With one empty frame'}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---------------------------------------- colours, settings, preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:col-span-2 2xl:col-span-1 2xl:grid-cols-1 gap-4 items-start">
          {hatPic && (
            <div className="space-y-2" data-pixel-hat-palette>
              <span className={tag}>{t.pixelHatColours || 'The hat’s colours'}</span>
              <div className="flex flex-wrap gap-1">
                {hatPic.art.palette.map((c, i) => (
                  <button key={i} onClick={() => { setHatChar(String.fromCharCode(97 + i)); if (tool === 'picker' || tool === 'eraser') setTool('pencil'); }} title={c} data-pixel-hat-colour={i}
                    className={`w-6 h-6 rounded border ${hatChar === String.fromCharCode(97 + i) ? 'border-white ring-1 ring-white' : 'border-zinc-800'}`} style={{ background: c }} />
                ))}
                <button onClick={() => { const next = addHatColour(draft, (tgt as any).name, hatPic.art.palette[hatChar.charCodeAt(0) - 97] || '#ffffff'); commit(next); setHatChar(String.fromCharCode(97 + hatPic.art.palette.length)); }} disabled={hatPic.art.palette.length >= 26} className={`${small} w-6 h-6 p-0`} title={t.pixelNewColourHint || 'A new colour, starting as the one chosen: change it with the swatch'} data-pixel-add-hat-colour><Plus size={11} /></button>
              </div>
              {(() => {
                const i = hatChar.charCodeAt(0) - 97;
                const used = hatColourUse(draft, (tgt as any).name, i) as number;
                return hatPic.art.palette[i] ? (
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={hatPic.art.palette[i]} onChange={(e) => commit(setHatColour(draft, (tgt as any).name, i, e.target.value))} className="w-7 h-7 bg-transparent border border-zinc-800 rounded cursor-pointer" data-pixel-hat-colour-value />
                    <span className="flex-1 text-[9px] text-zinc-600">{fill(t.pixelPartUse || '{n} pixels', { n: used })}</span>
                    <button onClick={() => commit(removeHatColour(draft, (tgt as any).name, i))} disabled={used > 0 || hatPic.art.palette.length <= 1} className={small} title={used ? (t.pixelPartInUse || 'Still drawn somewhere: draw over it first') : ''}><Trash2 size={11} /></button>
                  </div>
                ) : null;
              })()}
              <span className="block text-[9px] text-zinc-600">{t.pixelHatFromAvatar || 'Take one of the avatar’s colours:'}</span>
              <div className="flex flex-wrap gap-0.5">
                {draft.parts.map((p) => (
                  <button key={p.id} onClick={() => { const next = addHatColour(draft, (tgt as any).name, p.color); if (next !== draft) { commit(next); setHatChar(String.fromCharCode(97 + hatPic.art.palette.length)); } }} title={p.name} className="w-3.5 h-3.5 rounded-sm border border-zinc-800" style={{ background: p.color }} />
                ))}
              </div>
            </div>
          )}
          {!hatPic && (
          <div className="space-y-2" data-pixel-palette>
            <span className={tag}>{t.pixelColours || 'Colours'}</span>
            <div className="flex flex-wrap gap-1">
              {draft.parts.map((p) => (
                <button key={p.id} onClick={() => { setChar(p.char); if (tool === 'picker' || tool === 'eraser' || tool === 'restore') setTool('pencil'); }} title={p.name} data-pixel-part={p.id}
                  className={`w-6 h-6 rounded border ${char === p.char ? 'border-white ring-1 ring-white' : 'border-zinc-800'}`}
                  style={{ background: p.color, opacity: p.opacity ?? 1 }} />
              ))}
            </div>
            {part && (
              <div className="space-y-1.5 rounded-lg border border-zinc-800 p-2" data-pixel-part-settings>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={part.color} onChange={(e) => commit({ ...draft, parts: draft.parts.map((p) => (p.id === part.id ? { ...p, color: e.target.value } : p)) })} className="w-7 h-7 bg-transparent border border-zinc-800 rounded cursor-pointer" data-pixel-part-colour />
                  <input value={part.name} maxLength={40} onChange={(e) => setDraft({ ...draft, parts: draft.parts.map((p) => (p.id === part.id ? { ...p, name: e.target.value } : p)) })} onBlur={() => setDirty(true)} className={box} data-pixel-part-name />
                </div>
                <label className="flex items-center gap-1.5 text-[9px] text-zinc-400" title={t.pixelPartCarriedHint || 'Always with the body, even where it reaches past the head, and in front of the head — as a sword on the back'}>
                  <input type="checkbox" checked={draft.split.carried.includes(part.id)} onChange={(e) => commit(setPart(draft, part.id, { carried: e.target.checked }))} className="accent-current-accent" data-pixel-part-carried /> {t.pixelPartCarried || 'Carried, not worn'}
                </label>
                <label className="flex items-center gap-1.5 text-[9px] text-zinc-400" title={t.pixelPartOverHatHint || 'Marks that float by the head — z’s, tears, a "!" — that a tall hat would hide'}>
                  <input type="checkbox" checked={draft.overHat.includes(part.id)} onChange={(e) => commit(setPart(draft, part.id, { overHat: e.target.checked }))} className="accent-current-accent" data-pixel-part-over-hat /> {t.pixelPartOverHat || 'Drawn over a hat'}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select value={part.effect || ''} onChange={(e) => commit(setPart(draft, part.id, { effect: e.target.value }))} className={box} data-pixel-part-effect>
                    <option value="">{t.pixelEffectNone || 'Still'}</option>
                    <option value="float">{t.pixelEffectFloat || 'Drifts, as sleep z’s'}</option>
                    <option value="pop">{t.pixelEffectPop || 'Pops up, as a startle'}</option>
                  </select>
                  <input type="range" min={0.1} max={1} step={0.05} value={part.opacity ?? 1} onChange={(e) => commit(setPart(draft, part.id, { opacity: Number(e.target.value) }))} title={t.pixelPartOpacity || 'How see-through'} className="w-full accent-current-accent" data-pixel-part-opacity />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-zinc-600">{fill(t.pixelPartUse || '{n} pixels', { n: usedHere })}</span>
                  <button onClick={() => { const next = addShades(draft, part.id) as PixelAvatarDef; commit(next); }} disabled={draft.parts.length > 90} title={t.pixelShadesHint || 'Two more colours beside it: its shadow and its highlight, the same hue'} className={small} data-pixel-part-shades>{t.pixelShades || '+ shades'}</button>
                  <button onClick={() => commit(removePart(draft, part.id))} disabled={usedHere > 0 || draft.parts.length <= 1} title={usedHere ? (t.pixelPartInUse || 'Still drawn somewhere: draw over it first') : ''} className={small} data-pixel-part-remove><Trash2 size={11} /></button>
                </div>
              </div>
            )}
            <div className="flex gap-1">
              <input value={names.part} onChange={(e) => setNames({ ...names, part: e.target.value })} placeholder={t.pixelNewColour || 'New colour’s name'} className={box} maxLength={40} data-pixel-new-part
                onKeyDown={(e) => { if (e.key === 'Enter') { const next = addPart(draft, { name: names.part || 'Colour', color: part?.color || '#ffffff' }); commit(next); setChar(next.parts[next.parts.length - 1].char); setNames({ ...names, part: '' }); } }} />
              <button
                onClick={() => { const next = addPart(draft, { name: names.part || 'Colour', color: part?.color || '#ffffff' }); commit(next); setChar(next.parts[next.parts.length - 1].char); setNames({ ...names, part: '' }); }}
                className={small} title={t.pixelNewColourHint || 'A new colour, starting as the one chosen: change it with the swatch'} data-pixel-add-part
              ><Plus size={11} /></button>
            </div>
          </div>
          )}

          {hatPic && (
            <div className="space-y-2 rounded-xl border border-zinc-800 p-3" data-pixel-hat-place>
              <span className={tag}>{t.pixelHatPlace || 'Where it sits'}</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['x', 'y'] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1 text-[10px] text-zinc-500">{k}
                    <input type="number" step={0.1} value={hatPic.art[k]} onChange={(e) => commit(placeHat(draft, (tgt as any).name, { [k]: Number(e.target.value) }))} className={box} data-pixel-hat-at={k} />
                  </label>
                ))}
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] text-zinc-500">{fill(t.pixelHatSize || 'Each of its pixels: {n} of the avatar’s', { n: hatPic.art.size })}</span>
                <input type="range" min={0.5} max={3} step={0.01} value={hatPic.art.size} onChange={(e) => commit(placeHat(draft, (tgt as any).name, { size: Number(e.target.value) }))} className="w-full accent-current-accent" data-pixel-hat-size />
              </label>
              <span className="block text-[10px] text-zinc-500">{fill(t.pixelHatGrid || '{w} × {h} pixels — more or less room on a side:', { w: hatPic.rows[0]?.length || 0, h: hatPic.rows.length })}</span>
              <div className="grid grid-cols-4 gap-1">
                {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
                  <div key={side} className="flex flex-col gap-0.5">
                    <button onClick={() => commit(resizeHat(draft, (tgt as any).name, side, 1))} className={small} data-pixel-hat-grow={side}>+ {t[`pixelSide${side[0].toUpperCase()}${side.slice(1)}`] || side}</button>
                    <button onClick={() => commit(resizeHat(draft, (tgt as any).name, side, -1))} className={small} data-pixel-hat-shrink={side}>−</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setTarget({ kind: 'extra', name: (tgt as any).name })} className={`${small} w-full`} data-pixel-hat-hides>{t.pixelHatHides || 'Draw the hair it hides'}</button>
            </div>
          )}
          {tgt.kind === 'extra' && drawnHat && (
            <button onClick={() => setTarget({ kind: 'hat', name: drawnHat.name })} className={`${small} w-full`} data-pixel-hat-back>{t.pixelHatPicture || 'Back to drawing the hat'}</button>
          )}

          {current && (
            <div className="space-y-2 rounded-xl border border-zinc-800 p-3" data-pixel-item-settings>
              <label className="block space-y-1">
                <span className={tag}>{t.pixelLabel || 'Called'}</span>
                <input value={(current as any).label || ''} placeholder={tgt.kind === 'face' ? pixelFaceName(draft, (current as any).name, t) : tgt.kind === 'outfit' ? pixelOutfitName(draft, (current as any).name, t) : tgt.kind === 'frame' ? pixelActionLabel(draft, (current as any).name, t) : pixelExtraName(draft, (current as any).name, t)}
                  maxLength={40} onChange={(e) => setDraft(setItem(draft, itemKind as any, (current as any).name, { label: e.target.value }))} onBlur={() => setDirty(true)} className={box} data-pixel-item-label />
              </label>
              <span className="block text-[9px] text-zinc-600 font-mono">{(current as any).name}{SPECIAL.includes((current as any).name) ? ` · ${t.pixelSpecialHint || 'A face the avatar uses by itself'}` : ''}</span>
              {tgt.kind === 'face' && (
                <>
                  {draft.eyes && (
                    <label className="flex items-center gap-1.5 text-[10px] text-zinc-400"><input type="checkbox" checked={(current as any).glances} onChange={(e) => commit(setItem(draft, 'face', (current as any).name, { glances: e.target.checked }))} className="accent-current-accent" /> {t.pixelFaceGlances || 'Its eyes still glance about'}</label>
                  )}
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-400"><input type="checkbox" checked={(current as any).blinks} onChange={(e) => commit(setItem(draft, 'face', (current as any).name, { blinks: e.target.checked }))} className="accent-current-accent" /> {t.pixelFaceBlinks || 'It still blinks'}</label>
                </>
              )}
              {tgt.kind === 'extra' && draft.outfits.length > 0 && (
                <label className="block space-y-1">
                  <span className={tag}>{t.pixelShownOn || 'Drawn over'}</span>
                  <select value={tgt.outfit || ''} onChange={(e) => setTarget({ kind: 'extra', name: tgt.name, outfit: e.target.value || undefined })} className={box} data-pixel-extra-on>
                    {['', ...draft.outfits.map((o) => o.name)].map((o) => <option key={o} value={o}>{pixelOutfitName(draft, o, t)}</option>)}
                  </select>
                </label>
              )}
              {tgt.kind === 'extra' && !drawnHat && (
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400"><input type="checkbox" checked={(current as any).hat} onChange={(e) => commit(setItem(draft, 'extra', (current as any).name, { hat: e.target.checked }))} className="accent-current-accent" /> {t.pixelIsHat || 'It is a hat (one at a time)'}</label>
              )}
              {tgt.kind === 'outfit' && (
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400"><input type="checkbox" checked={(current as any).headwear} onChange={(e) => commit(setItem(draft, 'outfit', (current as any).name, { headwear: e.target.checked }))} className="accent-current-accent" /> {t.pixelHeadwear || 'It has its own headwear: no hats over it'}</label>
              )}
              {(tgt.kind === 'outfit' || tgt.kind === 'frame' || ((tgt.kind === 'extra' || tgt.kind === 'hat') && (current as any).hat)) && (
                <label className="block space-y-1">
                  <span className={tag}>{t.pixelWords || 'Words viewers can use for it'}</span>
                  <input defaultValue={((current as any).words || []).join(', ')} key={`${tgt.kind}:${(current as any).name}`} onBlur={(e) => commit(setItem(draft, itemKind as any, (current as any).name, { words: e.target.value }))} placeholder="pyjamas, pijama" className={box} data-pixel-item-words />
                </label>
              )}
              <button
                onClick={() => { if (window.confirm(t.pixelRemoveItemConfirm || 'Take this out of the avatar?')) { commit(removeItem(draft, itemKind as any, (current as any).name)); setTarget({ kind: 'base' }); } }}
                className={`${small} w-full hover:text-rose-400 hover:border-rose-900`} data-pixel-item-remove
              ><Trash2 size={11} /> {t.delete || 'Delete'}</button>
            </div>
          )}
          {tgt.kind === 'base' && (
            <div className="space-y-2 rounded-xl border border-zinc-800 p-3">
              <label className="block space-y-1">
                <span className={tag}>{fill(t.pixelHeadEnds || 'The head ends at row {n}', { n: draft.split?.headLastRow ?? 99 })}</span>
                <input type="range" min={10} max={99} value={draft.split?.headLastRow ?? 99}
                  onChange={(e) => commit({ ...draft, split: { ...draft.split, headLastRow: Number(e.target.value) } })} className="w-full accent-current-accent" data-pixel-head-row />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <input type="checkbox" checked={Boolean(draft.turn)} onChange={(e) => { if (e.target.checked || window.confirm(t.pixelTurnOffConfirm || 'Stop it turning? Its front view goes.')) commit(setTurns(draft, e.target.checked)); }} className="accent-current-accent" data-pixel-turns />
                {t.pixelTurns || 'It turns to face whoever talks in the call (needs a front view)'}
              </label>
              {draft.turn && (
                <>
                  <label className="block space-y-1">
                    <span className={tag}>{t.pixelDrawnFacing || 'As drawn, it faces'}</span>
                    <select value={draft.drawnFacing || 'left'} onChange={(e) => commit(setTurn(draft, { drawnFacing: e.target.value as any }))} className={box} data-pixel-drawn-facing>
                      <option value="left">{t.pixelFacingLeft || 'Your left'}</option>
                      <option value="right">{t.pixelFacingRight || 'Your right'}</option>
                    </select>
                  </label>
                  <div className="space-y-1" data-pixel-mirror-keep>
                    <span className={tag}>{t.pixelMirrorKeep || 'Kept the right way round when mirrored (writing)'}</span>
                    {draft.turn.mirrorKeep.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                        <span className="flex-1">{b[0]},{b[1]} → {b[2]},{b[3]}</span>
                        <button onClick={() => commit(setTurn(draft, { mirrorKeep: draft.turn!.mirrorKeep.filter((_, j) => j !== i) }))} className={small}><Trash2 size={10} /></button>
                      </div>
                    ))}
                    <div className="flex gap-1">
                      <input value={keepBox} onChange={(e) => setKeepBox(e.target.value)} placeholder="x0, y0, x1, y1" className={box} data-pixel-mirror-keep-new />
                      <button
                        onClick={() => { const n = keepBox.split(/[^\d]+/).filter(Boolean).map(Number); if (n.length === 4) { commit(setTurn(draft, { mirrorKeep: [...draft.turn!.mirrorKeep, n] })); setKeepBox(''); } }}
                        className={small} data-pixel-mirror-keep-add
                      ><Plus size={11} /></button>
                    </div>
                    <span className="block text-[9px] text-zinc-600">{t.pixelMirrorKeepHint || 'The pixel numbers show at the top of the canvas as you point.'}</span>
                  </div>
                </>
              )}
            </div>
          )}
          {tgt.kind === 'front' && draft.turn && (
            <label className="block space-y-1 rounded-xl border border-zinc-800 p-3">
              <span className={tag}>{fill(t.pixelHeadEnds || 'The head ends at row {n}', { n: draft.turn.front.headLastRow })}</span>
              <input type="range" min={10} max={99} value={draft.turn.front.headLastRow} onChange={(e) => commit(setTurn(draft, { frontHeadLastRow: Number(e.target.value) }))} className="w-full accent-current-accent" data-pixel-front-head-row />
            </label>
          )}
          {tgt.kind === 'front-face' && (
            <button onClick={() => { if (window.confirm(t.pixelRemoveItemConfirm || 'Take this out of the avatar?')) { commit(removeFrontFace(draft, tgt.name)); setTarget({ kind: 'front' }); } }} className={`${small} w-full hover:text-rose-400 hover:border-rose-900`} data-pixel-front-face-remove><Trash2 size={11} /> {t.delete || 'Delete'}</button>
          )}
          {(tgt.kind === 'front-outfit' || tgt.kind === 'front-extra') && (
            <button onClick={() => { if (window.confirm(t.pixelRemoveFrontConfirm || 'Take out how this looks from the front? It will not show while the avatar faces the front.')) { commit(removeFrontVersion(draft, tgt.kind === 'front-outfit' ? 'outfit' : 'extra', tgt.name) as PixelAvatarDef); setTarget({ kind: 'front' }); } }} className={`${small} w-full hover:text-rose-400 hover:border-rose-900`} data-pixel-front-version-remove><Trash2 size={11} /> {t.delete || 'Delete'}</button>
          )}

          <div className="space-y-1.5">
            <span className={tag}>{t.pixelAlive || 'Alive, as on stream'}</span>
            <div className="aspect-square max-w-[15rem] rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden p-2" data-pixel-editor-preview>
              <LivingAvatar kit={draft} expression={previewFace} costume={previewOutfit} extras={previewExtras} glance={Boolean(draft.eyes || draft.turn)} twinkle={Boolean(draft.eyes)} action={playing} facing={draft.turn ? facing : null}
                speaking={tgt.kind === 'front-face' && tgt.name === 'talking'} />
            </div>
            {draft.turn && (
              <div className="flex gap-1" data-pixel-preview-facing>
                {([null, 'left', 'front', 'right'] as const).map((f) => (
                  <button key={f || 'auto'} onClick={() => setFacing(f)} data-pixel-facing={f || 'auto'}
                    className={`px-1.5 py-0.5 rounded border text-[9px] ${facing === f ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500'}`}>
                    {f === null ? (t.pixelFacingAuto || 'By itself') : f === 'left' ? (t.pixelFacingLeft || 'Your left') : f === 'right' ? (t.pixelFacingRight || 'Your right') : (t.pixelFrontView || 'Front view')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
