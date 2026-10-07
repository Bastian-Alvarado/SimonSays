/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A reference picture for drawing a pixel avatar from: a sketch, a photo,
 * a character sheet — shown with the canvas, faint behind the drawing to
 * trace or in front of it to check against, never part of the avatar and
 * never on stream.
 *
 * The picture is kept with the other uploads, so it is there next time and
 * can be chosen again. Where it sits, how see-through it is and whether it
 * shows are remembered for each avatar in this browser: they are the
 * drawing table's, not the avatar's, and changing them is no change to
 * save.
 */
import React, { useEffect, useState } from 'react';
import { Upload, Images, Move, Maximize, Trash2, X } from 'lucide-react';
import { fitReference } from '../../../shared/pixel-edit.js';
import { httpBase } from '../../hooks/useBackend';
import { refusalWords } from '../../words';
import { StillImg } from '../StillPicture';

export interface ReferenceSettings {
  src: string;
  x: number;
  y: number;
  w: number;
  opacity: number;
  over: boolean;
  shown: boolean;
}

const KEY = (id: string) => `pixelAvatars.reference.${id}`;
const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const box = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-current-accent';
const small = 'flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40';

/** An upload's address as the browser reaches it: the server's own, wherever the screen itself came from. */
export const referenceUrl = (src: string) => (src.startsWith('/') ? `${httpBase()}${src}` : src);

/** An avatar's reference picture and where it sits, remembered in this browser; nothing remembered, or a private window, is none. */
export function useReference(avatarId: string): [ReferenceSettings | null, (next: ReferenceSettings | null | ((r: ReferenceSettings | null) => ReferenceSettings | null)) => void] {
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY(avatarId)) || 'null'); } catch { return null; } };
  const [ref, setRef] = useState<ReferenceSettings | null>(read);
  useEffect(() => { setRef(read()); }, [avatarId]);
  const set = (next: ReferenceSettings | null | ((r: ReferenceSettings | null) => ReferenceSettings | null)) => {
    setRef((now) => {
      const value = typeof next === 'function' ? next(now) : next;
      try { if (value) localStorage.setItem(KEY(avatarId), JSON.stringify(value)); else localStorage.removeItem(KEY(avatarId)); } catch { /* kept for this visit only */ }
      return value;
    });
  };
  return [ref, set];
}

/** The picture itself, loaded, or null until it has (or when it cannot be). */
export function useReferenceImage(src?: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImage(null);
    if (!src) return undefined;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.src = referenceUrl(src);
    return () => { img.onload = null; };
  }, [src]);
  return image;
}

interface Props {
  reference: ReferenceSettings | null;
  setReference: ReturnType<typeof useReference>[1];
  image: HTMLImageElement | null;
  moving: boolean;
  setMoving: (on: boolean) => void;
  listAssets?: () => Promise<any[]>;
  uploadAsset?: (file: File) => Promise<any>;
  onClose: () => void;
  t: any;
}

export const PixelReferencePanel = ({ reference, setReference, image, moving, setMoving, listAssets, uploadAsset, onClose, t }: Props) => {
  const [busy, setBusy] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [uploads, setUploads] = useState<{ url: string; name?: string }[]>([]);
  // A picture newly chosen is fitted inside the drawing once its shape is known.
  const [fitting, setFitting] = useState(false);
  useEffect(() => {
    if (!fitting || !image) return;
    setFitting(false);
    setReference((r) => (r ? { ...r, ...fitReference(image.naturalWidth, image.naturalHeight) } : r));
  }, [fitting, image]);
  useEffect(() => {
    if (!choosing || !listAssets) return;
    listAssets().then((all) => setUploads((all || []).filter((a: any) => a.kind === 'image'))).catch(() => setUploads([]));
  }, [choosing]);

  const use = (src: string) => {
    setReference((r) => ({ src, x: 0, y: 0, w: 100, opacity: r?.opacity ?? 0.45, over: r?.over ?? false, shown: true }));
    setFitting(true);
    setChoosing(false);
  };
  const upload = async (file?: File | null) => {
    if (!file || !uploadAsset) return;
    setBusy(t.uploading || 'Uploading…');
    try {
      const saved = await uploadAsset(file);
      if (saved?.url) use(saved.url);
      setBusy('');
    } catch (err: any) {
      setBusy(refusalWords(t, err) || String(err));
    }
  };
  const set = (changes: Partial<ReferenceSettings>) => setReference((r) => (r ? { ...r, ...changes } : r));
  const number = (v: string) => Math.round((Number(v) || 0) * 10) / 10;

  return (
    <div className="space-y-2.5 rounded-xl border border-sky-500/40 bg-zinc-950/70 p-3" data-pixel-reference>
      <div className="flex items-center gap-2">
        <span className={`${tag} flex-1`}>{t.pixelReference || 'Reference picture'}</span>
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={13} /></button>
      </div>
      <p className="text-[10px] text-zinc-500 leading-relaxed">{t.pixelReferenceHint || 'A picture to draw from — shown with the canvas, behind the drawing to trace or in front of it to check against. It is never part of the avatar, and never on stream.'}</p>
      <div className="flex flex-wrap gap-1.5">
        {uploadAsset && (
          <label className={`${small} cursor-pointer`}>
            <Upload size={11} /> {t.pixelImportChoose || 'Choose a picture'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.currentTarget.value = ''; }} data-pixel-reference-file />
          </label>
        )}
        {listAssets && (
          <button onClick={() => setChoosing((c) => !c)} className={small} data-pixel-reference-uploads><Images size={11} /> {t.pixelReferenceUploads || 'From earlier uploads'}</button>
        )}
        {busy && <span className="text-[10px] text-zinc-500 self-center">{busy}</span>}
      </div>
      {choosing && (
        <div className="grid grid-cols-5 gap-1 max-h-40 overflow-y-auto" data-pixel-reference-choose>
          {uploads.map((a) => (
            <button key={a.url} onClick={() => use(a.url)} title={a.name} className="aspect-square rounded border border-zinc-800 hover:border-zinc-500 overflow-hidden bg-zinc-900">
              <StillImg src={referenceUrl(a.url)} width={72} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
          {!uploads.length && <p className="col-span-5 text-[10px] text-zinc-600">{t.voicePicNoUploads || 'Nothing uploaded yet. Use the upload button.'}</p>}
        </div>
      )}
      {reference && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={reference.shown} onChange={(e) => set({ shown: e.target.checked })} className="accent-current-accent" data-pixel-reference-shown /> {t.pixelReferenceShow || 'Show it'}</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={!reference.over} onChange={() => set({ over: false })} className="accent-current-accent" data-pixel-reference-behind /> {t.pixelReferenceBehind || 'Behind the drawing'}</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={reference.over} onChange={() => set({ over: true })} className="accent-current-accent" data-pixel-reference-over /> {t.pixelReferenceOver || 'In front of it'}</label>
          </div>
          <label className="block space-y-1">
            <span className={tag}>{`${t.pixelPartOpacity || 'How see-through'}: ${Math.round(reference.opacity * 100)}%`}</span>
            <input type="range" min={0.05} max={1} step={0.05} value={reference.opacity} onChange={(e) => set({ opacity: Number(e.target.value) })} className="w-full accent-current-accent" data-pixel-reference-opacity />
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['x', 'y', 'w'] as const).map((k) => (
              <label key={k} className="flex items-center gap-1 text-[10px] text-zinc-500">{k === 'w' ? (t.pixelReferenceWidth || 'width') : k}
                <input type="number" step={0.5} value={reference[k]} onChange={(e) => set({ [k]: k === 'w' ? Math.max(1, number(e.target.value)) : number(e.target.value) })} className={box} data-pixel-reference-at={k} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setMoving(!moving)} className={`${small} ${moving ? 'border-sky-400 text-sky-300' : ''}`} data-pixel-reference-move><Move size={11} /> {moving ? (t.pixelReferenceMoving || 'Dragging moves it — click to draw again') : (t.pixelReferenceMove || 'Drag to move it')}</button>
            <button onClick={() => { if (image) set(fitReference(image.naturalWidth, image.naturalHeight)); }} disabled={!image} className={small} data-pixel-reference-fit><Maximize size={11} /> {t.pixelReferenceFit || 'Fit to the drawing'}</button>
            <button onClick={() => { setReference(null); setMoving(false); }} className={`${small} hover:text-rose-400`} data-pixel-reference-remove><Trash2 size={11} /> {t.pixelReferenceRemove || 'Take it away'}</button>
          </div>
        </>
      )}
    </div>
  );
};
