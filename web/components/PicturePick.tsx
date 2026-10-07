/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A picture: from the uploads, uploaded now, or a link — with a thumbnail of
 * the one chosen and why an upload was turned away. Shared by the Discord
 * pages and the welcome and goodbye posts.
 */
import React, { useEffect, useState } from 'react';
import { Images, Upload, Loader2, Trash2 } from 'lucide-react';
import { refusalWords } from '../words';
import { pictureSrc } from './DiscordPagePreview';
import { StillImg } from './StillPicture';

const smallButton = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-40';
const box = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent';

export const PicturePick = ({ value, onChange, listAssets, uploadAsset, t, wide = false, link = true }: {
  value: string; onChange: (v: string) => void;
  listAssets: () => Promise<any[]>; uploadAsset: (file: File) => Promise<any>;
  t: any; wide?: boolean;
  /** Whether a link can be pasted as well. */
  link?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [uploads, setUploads] = useState<any[]>([]);
  const [linkText, setLinkText] = useState(/^https?:/.test(value) ? value : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLinkText(/^https?:/.test(value) ? value : ''); }, [value]);
  useEffect(() => {
    if (open) listAssets().then((all) => setUploads((all || []).filter((a: any) => a.kind === 'image'))).catch(() => setUploads([]));
  }, [open]);
  const upload = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const saved = await uploadAsset(file);
      if (saved?.url) onChange(saved.url);
    } catch (err: any) {
      setError(refusalWords(t, err) || String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2" data-page-picture>
      <div className="flex items-center gap-2 flex-wrap">
        {value
          ? <StillImg src={pictureSrc(value)} width={wide ? 220 : 56} alt="" className={`${wide ? 'h-14 max-w-[220px]' : 'h-14 w-14'} object-cover rounded-lg border border-zinc-800`} />
          : <span className="text-[10px] text-zinc-600 italic">{t.pageNoPicture || 'No picture yet'}</span>}
        <button type="button" onClick={() => setOpen(!open)} className={smallButton}><Images size={11} /> {t.pageUploads || 'Uploads'}</button>
        <label className={`${smallButton} cursor-pointer`}>
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} {t.pageUpload || 'Upload'}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {value && <button type="button" onClick={() => onChange('')} className="p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-rose-400" title={t.pageRemovePicture || 'No picture'}><Trash2 size={11} /></button>}
      </div>
      {link && (
        <input
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          onBlur={() => { const v = linkText.trim(); if (/^https?:\/\/\S+$/.test(v)) onChange(v); else if (!v && /^https?:/.test(value)) onChange(''); }}
          placeholder={t.pagePictureLink || '…or paste a link to a picture'}
          className={box}
        />
      )}
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
      {open && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl border border-zinc-800 bg-zinc-950/60">
          {uploads.length === 0 && <span className="col-span-full text-[10px] text-zinc-600 italic">{t.pageNoUploads || 'Nothing uploaded yet.'}</span>}
          {uploads.map((a) => (
            <button key={a.url} type="button" onClick={() => { onChange(a.url); setOpen(false); }} className={`aspect-video rounded border overflow-hidden ${a.url === value ? 'border-current-accent' : 'border-zinc-800 hover:border-zinc-500'}`} title={a.name}>
              <StillImg src={pictureSrc(a.url)} width={120} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
