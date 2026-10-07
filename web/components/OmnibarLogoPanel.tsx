/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The picture at the left end of the omnibar.
 *
 * Games Done Quick's bar opens with the marathon's logo and keeps it there
 * whatever is rotating past it — the one part of the bar that tells somebody
 * tuning in whose stream this is before they have read a word. A pinned slot
 * does the same job with text; this is the job done with a picture.
 *
 * The same two routes as the image layer: pick from what is already on the
 * server, or paste a link to something hosted elsewhere. Uploading from here
 * puts the file in the same place as every other upload, so it can be picked
 * again anywhere else a picture is asked for.
 */
import React, { useEffect, useState } from 'react';
import { Trash2, Upload, ImageIcon } from 'lucide-react';
import { refusalWords } from '../words';
import { StillImg } from './StillPicture';

interface Asset { name: string; url: string; size: number; kind: string }

interface Props {
  logo: string;
  size: number;
  /** Save a change to the bar's look. */
  patchStyle: (next: { logo?: string; logoSize?: number }) => void;
  listAssets?: () => Promise<Asset[]>;
  uploadAsset?: (file: File) => Promise<any>;
  t: any;
}

export const OmnibarLogoPanel = ({ logo, size, patchStyle, listAssets, uploadAsset, t }: Props) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState('');
  const [typed, setTyped] = useState('');

  const refresh = () => (listAssets ? listAssets() : Promise.resolve([]))
    .then((all) => setAssets((all || []).filter((a) => a.kind === 'image')))
    .catch(() => setAssets([]));

  useEffect(() => { if (picking) refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [picking]);

  const choose = (url: string) => {
    if (!url) return;
    patchStyle({ logo: url });
    setPicking(false);
  };

  const onUpload = async (file?: File | null) => {
    if (!file || !uploadAsset) return;
    setBusy(t.uploading || 'Uploading…');
    try {
      const saved = await uploadAsset(file);
      // The server decides the stored name, so the address comes back rather
      // than being guessed from the file that was picked.
      if (saved?.url) choose(saved.url);
      await refresh();
      setBusy('');
    } catch (err: any) {
      setBusy(refusalWords(t, err) || String(err));
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">{t.omnibarLogo}</label>

      {logo ? (
        <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl p-2">
          <StillImg src={logo} width={56} alt="" className="h-8 w-14 object-contain shrink-0 bg-black/40 rounded" />
          <span className="flex-1 min-w-0 truncate text-[9px] font-mono text-zinc-400">{decodeURIComponent(logo.replace('/media/', ''))}</span>
          <button onClick={() => patchStyle({ logo: '' })} title={t.omnibarLogoRemove} className="p-1 text-zinc-600 hover:text-rose-500">
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <p className="text-[9px] text-zinc-600 leading-snug">{t.omnibarLogoHint}</p>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={() => setPicking((v) => !v)}
          className="flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-current-accent hover:border-current-accent transition-all flex items-center justify-center gap-1.5"
        >
          <ImageIcon size={12} /> {logo ? t.omnibarLogoChange : t.omnibarLogoChoose}
        </button>
        {uploadAsset && (
          <label
            title={t.omnibarLogoUpload}
            className="px-3 py-2 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-current-accent hover:border-current-accent transition-all flex items-center cursor-pointer"
          >
            <Upload size={12} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { onUpload(e.target.files?.[0]); e.currentTarget.value = ''; }}
            />
          </label>
        )}
      </div>
      {busy && <p className="text-[9px] text-zinc-500">{busy}</p>}

      {picking && (
        <div className="space-y-2 bg-zinc-950/60 border border-zinc-800 rounded-xl p-2">
          {assets.length === 0 ? (
            <p className="text-[9px] text-zinc-600">{t.imagesNoUploads || 'Nothing uploaded yet. Use the upload button, or paste a URL below.'}</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
              {assets.map((a) => (
                <button
                  key={a.url}
                  title={a.name}
                  onClick={() => choose(a.url)}
                  className="aspect-square bg-black/40 rounded border border-zinc-800 hover:border-current-accent p-1"
                >
                  <StillImg src={a.url} width={96} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
          {/* Anything hosted elsewhere. The server keeps http(s) and /media/ only. */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={typed}
              placeholder="https://…"
              onChange={(e) => setTyped(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[9px] font-mono text-zinc-300 outline-none focus:border-current-accent"
            />
            <button
              onClick={() => { choose(typed.trim()); setTyped(''); }}
              className="px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-current-accent"
            >
              {t.omnibarLogoUse}
            </button>
          </div>
        </div>
      )}

      {logo && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarLogoSize}</label>
            <span className="text-[10px] font-mono text-current-accent">{size}%</span>
          </div>
          <input
            type="range"
            min={30}
            max={100}
            value={size}
            onChange={(e) => patchStyle({ logoSize: Number(e.target.value) })}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent"
          />
        </div>
      )}
    </div>
  );
};
