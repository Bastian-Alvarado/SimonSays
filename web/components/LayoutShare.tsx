/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Sharing layouts as a file, beside New layout in the overlay editor: this
 * layout or every layout of the profile, downloaded — without what is only
 * this setup's unless asked (shared/layout-share.js) — and a file somebody
 * gave you, added to the profile as new layouts, never over the ones here.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Share2, Upload, Download, X } from 'lucide-react';
import { shareFile, shareFileName, readShareFile } from '../../shared/layout-share.js';
import { download } from './pixel/pixelExport';
import { fill } from '../words';

const small = 'flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-40';
const KEEP_KEY = 'layout_share_leave_mine';

interface Props {
  layouts: any[];
  working: any | null;
  /** The overlay profile's name, for the file of all its layouts. */
  profileName: string;
  /** How many layouts a profile can hold, and so how many can come in. */
  max: number;
  /** Add the file's layouts; the first is opened. */
  onAdd: (layouts: any[]) => void;
  t: any;
}

export const LayoutShare = ({ layouts, working, profileName, max, onAdd, t }: Props) => {
  const [open, setOpen] = useState(false);
  const [leaveMine, setLeaveMineNow] = useState(() => { try { return localStorage.getItem(KEEP_KEY) !== 'off'; } catch { return true; } });
  const setLeaveMine = (on: boolean) => { setLeaveMineNow(on); try { localStorage.setItem(KEEP_KEY, on ? 'on' : 'off'); } catch { /* private mode */ } };
  const [said, setSaid] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const save = (list: any[], name: string) => {
    const { file, pictures } = shareFile(list, { leaveMine });
    download(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), shareFileName(name));
    setSaid(pictures ? fill(t.layoutShareLeftPictures || 'Downloaded. Uploaded pictures left out: {n}. They are this app’s, not in the file.', { n: pictures }) : (t.layoutShareDone || 'Downloaded.'));
  };

  const bringIn = async (file: File | undefined) => {
    if (!file) return;
    setSaid('');
    try {
      const incoming = readShareFile(await file.text());
      const room = max - layouts.length;
      if (room <= 0) { setSaid(fill(t.layoutShareNoRoom || 'This profile already has {max} layouts, the most it can hold.', { max })); return; }
      onAdd(incoming.slice(0, room));
      setSaid(incoming.length > room
        ? fill(t.layoutShareSomeAdded || '{n} of {total} layouts added: the profile is full.', { n: room, total: incoming.length })
        : fill(t.layoutShareAdded || 'Layouts added: {n}.', { n: incoming.length }));
    } catch (err: any) {
      setSaid(err?.code === 'layout_share_not_a_file' ? (t.refuseLayoutShareNotAFile || 'That file is not a SimonSays layouts file.') : String(err?.message || err));
    }
  };

  return (
    <div ref={box} className="relative flex items-center gap-2" data-layout-share>
      <button onClick={() => { setOpen((o) => !o); setSaid(''); }} disabled={!layouts.length} className={small} aria-expanded={open} data-layout-share-open>
        <Share2 size={13} /> {t.layoutShare || 'Share'}
      </button>
      <label className={`${small} cursor-pointer`} title={t.layoutShareAddHint || 'Layouts somebody shared as a file, added to this profile as new ones'} data-layout-share-add>
        <Upload size={13} /> {t.layoutShareAdd || 'Add from a file'}
        <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; bringIn(f); }} data-layout-share-file />
      </label>
      {said && !open && <span className="text-[10px] text-zinc-400 max-w-xs" data-layout-share-said>{said}</span>}
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl p-3 space-y-3" data-layout-share-menu>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutShareTitle || 'Share as a file'}</span>
            <button onClick={() => setOpen(false)} className="p-1 text-zinc-500 hover:text-white"><X size={12} /></button>
          </div>
          <button onClick={() => working && save([working], working.name)} disabled={!working} className={`${small} w-full justify-start`} data-layout-share-one>
            <Download size={12} /> {fill(t.layoutShareOne || 'This layout: {name}', { name: working?.name || '' })}
          </button>
          <button onClick={() => save(layouts, profileName)} className={`${small} w-full justify-start`} data-layout-share-all>
            <Download size={12} /> {fill(t.layoutShareAll || 'Every layout of “{name}” ({n})', { name: profileName, n: layouts.length })}
          </button>
          <label className="flex items-start gap-2 text-[10px] text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={leaveMine} onChange={(e) => setLeaveMine(e.target.checked)} className="accent-current-accent mt-0.5" data-layout-share-leave-mine />
            <span>
              <span className="font-bold text-zinc-200">{t.layoutShareLeaveMine || 'Leave out what is mine'}</span>
              <span className="block text-zinc-500">{t.layoutShareLeaveMineHint || 'The OBS sources, timers and scenes you picked, which avatar it draws, and pictures you uploaded. Text on the layouts goes as it is.'}</span>
            </span>
          </label>
          {said && <p className="text-[10px] text-zinc-400" data-layout-share-said>{said}</p>}
        </div>
      )}
    </div>
  );
};
