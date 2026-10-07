/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Choosing what an image layer shows.
 *
 * The first place in the app that offers the uploaded files as a list to pick
 * from. Everything else that takes a picture — an alert, mainly — asks for a
 * URL and leaves you to remember what you uploaded and how it was spelled.
 *
 * Both routes are here on purpose. Pick from what is on the server, or paste a
 * URL for something hosted elsewhere, which is what a sponsor pack usually is.
 */
import React, { useEffect, useState } from 'react';
import { useDragOrder, DragGrip } from '../hooks/useDragOrder';
import { moveToGap } from '../../shared/list-order.js';
import { Trash2, Upload, Plus } from 'lucide-react';
import { refusalWords } from '../words';
import { StillImg } from './StillPicture';

interface Asset { name: string; url: string; size: number; kind: string }

interface Props {
  config: Record<string, any>;
  /** Merge a change into this layer's settings and save. */
  patch: (next: Record<string, any>) => void;
  /** GET the uploaded files. */
  listAssets: () => Promise<Asset[]>;
  /** POST one up, returning whatever the server stored it as. */
  uploadAsset: (file: File) => Promise<any>;
  t: any;
}

export const ImageLayerPanel = ({ config, patch, listAssets, uploadAsset, t }: Props) => {
  const sources: string[] = Array.isArray(config.sources) ? config.sources : [];
  const [assets, setAssets] = useState<Asset[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState('');
  const [typed, setTyped] = useState('');

  const refresh = () => listAssets()
    .then((all) => setAssets((all || []).filter((a) => a.kind === 'image')))
    .catch(() => setAssets([]));

  useEffect(() => { if (picking) refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [picking]);

  const add = (url: string) => {
    if (!url || sources.includes(url)) return;
    patch({ sources: [...sources, url] });
  };
  const removeAt = (i: number) => patch({ sources: sources.filter((_, n) => n !== i) });
  const moveBy = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= sources.length) return;
    const next = [...sources];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ sources: next });
  };
  const sourceOrder = useDragOrder(({ from, gap }) => patch({ sources: moveToGap(sources, from, gap) }));

  const onUpload = async (file?: File | null) => {
    if (!file) return;
    setBusy(t.uploading || 'Uploading…');
    try {
      const saved = await uploadAsset(file);
      // The server decides the stored name, so the URL comes back rather than
      // being guessed from the file that was picked.
      if (saved?.url) add(saved.url);
      await refresh();
      setBusy('');
    } catch (err: any) {
      setBusy(refusalWords(t, err) || String(err));
    }
  };

  return (
    <div ref={sourceOrder.listRef} className="relative space-y-2 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      {sourceOrder.line}
      {/* What it shows, in the order it shows them. */}
      {sources.length === 0 && (
        <p className="text-[9px] text-zinc-600 leading-snug">
          {t.imagesEmpty || 'Nothing chosen yet, so this layer draws nothing.'}
        </p>
      )}
      {sources.map((src, i) => (
        <div key={src + i} {...sourceOrder.row(String(i))} className={`flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-md p-1.5 ${sourceOrder.held === String(i) ? 'opacity-40' : ''}`}>
          {sources.length > 1 && <DragGrip grip={sourceOrder.grip(String(i))} title={t.imagesDrag || 'Drag to change the order they show in'} size={12} className="-mx-1" />}
          <StillImg src={src} width={32} alt="" className="w-8 h-8 object-contain shrink-0 bg-black/40 rounded" />
          <span className="flex-1 min-w-0 truncate text-[9px] font-mono text-zinc-400">{src.replace('/media/', '')}</span>
          {sources.length > 1 && (
            <>
              <button onClick={() => moveBy(i, -1)} disabled={i === 0} className="px-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 text-[10px]">↑</button>
              <button onClick={() => moveBy(i, 1)} disabled={i === sources.length - 1} className="px-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 text-[10px]">↓</button>
            </>
          )}
          <button onClick={() => removeAt(i)} className="p-1 text-zinc-600 hover:text-rose-500"><Trash2 size={12} /></button>
        </div>
      ))}

      <div className="flex gap-1.5">
        <button
          onClick={() => setPicking((v) => !v)}
          className="flex-1 px-2 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 flex items-center justify-center gap-1.5"
        >
          <Plus size={11} /> {t.imagesAdd || 'Add a picture'}
        </button>
        <label className="px-2 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer">
          <Upload size={11} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { onUpload(e.target.files?.[0]); e.currentTarget.value = ''; }}
          />
        </label>
      </div>
      {busy && <p className="text-[9px] text-zinc-500">{busy}</p>}

      {picking && (
        <div className="space-y-2 bg-zinc-950/60 border border-zinc-800 rounded-md p-2">
          {assets.length === 0 ? (
            <p className="text-[9px] text-zinc-600">{t.imagesNoUploads || 'Nothing uploaded yet. Use the upload button, or paste a URL below.'}</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
              {assets.map((a) => (
                <button
                  key={a.url}
                  title={a.name}
                  onClick={() => { add(a.url); setPicking(false); }}
                  className="aspect-square bg-black/40 rounded border border-zinc-800 hover:border-current-accent p-1"
                >
                  <StillImg src={a.url} width={96} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
          {/* For anything hosted elsewhere. The server accepts http(s) only. */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={typed}
              placeholder="https://…"
              onChange={(e) => setTyped(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[9px] font-mono text-zinc-300 outline-none focus:border-current-accent"
            />
            <button
              onClick={() => { add(typed.trim()); setTyped(''); setPicking(false); }}
              className="px-2 rounded text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            >
              {t.add || 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* How it shows them. Only worth asking once there is more than one. */}
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        {(['contain', 'cover', 'fill'] as const).map((fit) => (
          <button
            key={fit}
            onClick={() => patch({ fit })}
            className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${
              (config.fit || 'contain') === fit
                ? 'bg-current-accent/10 border-current-accent text-current-accent'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            {fit}
          </button>
        ))}
      </div>

      {sources.length > 1 && (
        <>
          <label className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.imagesEvery || 'Change every'} — {config.seconds ?? 8}s
            </span>
            <input
              type="range"
              min={1}
              max={120}
              value={config.seconds ?? 8}
              onChange={(e) => patch({ seconds: Number(e.target.value) })}
              className="w-full accent-current-accent"
            />
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => patch({ transition: config.transition === 'none' ? 'fade' : 'none' })}
              className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                config.transition !== 'none'
                  ? 'bg-current-accent/10 border-current-accent text-current-accent'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              {t.imagesFade || 'Fade'}
            </button>
            <button
              onClick={() => patch({ random: !config.random })}
              className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                config.random
                  ? 'bg-current-accent/10 border-current-accent text-current-accent'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              {t.imagesShuffle || 'Shuffle'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
