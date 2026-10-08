/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Pixel avatars tab: pixel avatars drawn in the app, beside the
 * built-in one rather than instead of it.
 *
 * The list holds every avatar kept on the server — the examples
 * (shared/pixel-avatar-examples.js) and any made here.
 * The one chosen is shown alive, as it is on stream, with everything it can
 * wear, every face and everything it does laid out to try. An avatar layer
 * draws one of them when it is chosen as "Drawn as" on the Overlays screen.
 *
 * The built-in avatar is not in the list and nothing here changes it: an
 * example is a copy, and "Put back" makes it the copy it started as.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Plus, Copy, Trash2, RotateCcw, Play, Square, AlertTriangle, History, Download, FileUp, Film, Image as ImageIcon, Grid2x2, ChevronDown } from 'lucide-react';
import { avatarFile, avatarFromFile, avatarPicture, facesSheet, actionGif, download, fileName } from '../pixel/pixelExport';
import { LivingAvatar } from '../AvatarLayer';
import { PixelKitAvatar } from '../PixelKitAvatar';
import { AvatarColourSelect, AvatarColourExtras } from '../AvatarLayerPanel';
import { pixelColours, pixelHats, pixelOutfit, pixelActionMs, PIXEL_SPECIAL_FACES } from '../../../shared/pixel-avatars.js';
import { pixelFaceChoices, pixelFaceName, pixelOutfitName, pixelExtraName, pixelActionLabel, pixelFaceCrop } from '../pixelNames';
import { refusalWords, fill } from '../../words';
import { PixelEditor } from '../pixel/PixelEditor';
import { HOUSE_CHARACTER } from '../../../shared/house-avatar.js';
import type { PixelAvatarDef } from '../../types';

interface Props {
  avatars: PixelAvatarDef[];
  /** The server's Pixel avatars control: answers, or refuses. */
  request: (payload: any) => Promise<any>;
  /** The uploads, for a reference picture to draw from. */
  listAssets?: () => Promise<any[]>;
  uploadAsset?: (file: File) => Promise<any>;
  t: any;
}

const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const box = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent';
const button = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40';
const STORE_KEY = 'pixelAvatars.selected';
const MODE_KEY = 'pixelAvatars.mode';

const remembered = () => { try { return localStorage.getItem(STORE_KEY) || ''; } catch { return ''; } };
const remember = (id: string) => { try { localStorage.setItem(STORE_KEY, id); } catch { /* a private window keeps nothing */ } };

/** A thumbnail tile: the avatar, or part of it, over the dark of the stage. */
const Tile = ({ active, onClick, title, children, testId }: { active?: boolean; onClick?: () => void; title: string; children: React.ReactNode; testId?: string }) => (
  <button
    onClick={onClick} title={title} data-pixel-tile={testId}
    className={`rounded-lg border overflow-hidden bg-zinc-950/70 text-left ${active ? 'border-current-accent' : 'border-zinc-800 hover:border-zinc-600'}`}
  >
    {children}
    <span className="block px-1 py-0.5 text-[8px] text-zinc-400 truncate">{title}</span>
  </button>
);

/** One avatar as a row: its picture, its name, and whether it is an example. */
const AvatarRow = ({ a, t }: { a: PixelAvatarDef; t: any }) => (
  <>
    <div className="w-10 h-10 shrink-0 rounded-lg bg-zinc-950/70 overflow-hidden"><PixelKitAvatar kit={a} /></div>
    <div className="min-w-0 text-left">
      <span className="block text-[11px] font-bold text-zinc-200 truncate">{a.name}</span>
      {a.example && <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">{t.pixelExampleTag || 'example'}</span>}
    </div>
  </>
);

/*
  Which avatar is open, as a dropdown at the top of the editor rather than a
  list beside it, so the editor has the room: the one open with its picture
  and an arrow, and opened, the rest in a scrolling list, each with its
  picture — with making a new one, bringing one in from a file and bringing
  back the examples at its foot. A click elsewhere or Escape closes it.
*/
const AvatarPicker = ({ avatars, kit, onPick, children, t }: {
  avatars: PixelAvatarDef[]; kit: PixelAvatarDef | null; onPick: (id: string) => void; children: (close: () => void) => React.ReactNode; t: any;
}) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', escape); };
  }, [open]);
  const others = avatars.filter((a) => a.id !== kit?.id);
  return (
    <div ref={box} className="relative w-full sm:w-72 shrink-0" data-pixel-picker>
      <button
        onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} data-pixel-picker-open
        className={`w-full flex items-center gap-2 p-1.5 pr-3 rounded-xl border bg-zinc-950/40 ${open ? 'border-current-accent' : 'border-zinc-800 hover:border-zinc-600'}`}
      >
        {kit ? <AvatarRow a={kit} t={t} /> : <span className="px-1.5 py-2.5 text-[11px] text-zinc-500">{t.pixelNone || 'No pixel avatars yet.'}</span>}
        <ChevronDown size={14} className={`ml-auto shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl p-2 space-y-2" data-pixel-list>
          <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-0.5" role="listbox">
            {others.map((a) => (
              <button key={a.id} role="option" aria-selected={false} onClick={() => { setOpen(false); onPick(a.id); }} data-pixel-avatar={a.id}
                className="w-full flex items-center gap-2 p-1.5 rounded-xl border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/60">
                <AvatarRow a={a} t={t} />
              </button>
            ))}
            {!others.length && <p className="px-1 py-2 text-[10px] text-zinc-600">{t.pixelNoOthers || 'No other pixel avatars yet.'}</p>}
          </div>
          <div className="border-t border-zinc-800 pt-2 space-y-1.5">{children(() => setOpen(false))}</div>
        </div>
      )}
    </div>
  );
};

export const PixelAvatarsView = ({ avatars, request, listAssets, uploadAsset, t }: Props) => {
  const [selectedId, setSelected] = useState<string>(() => remembered());
  // Looking at it, or drawing it.
  const [mode, setModeNow] = useState<'look' | 'draw'>(() => { try { return localStorage.getItem(MODE_KEY) === 'draw' ? 'draw' : 'look'; } catch { return 'look'; } });
  // Changes drawn and not saved: leaving them asks first.
  const unsaved = useRef(false);
  // Bumped when the avatar is put back from outside the editor, so the editor starts over from it.
  const [editorRound, setEditorRound] = useState(0);
  const leaving = () => !unsaved.current || window.confirm(t.pixelLeaveConfirm || 'There are changes not saved yet. Leave them?');
  const setSelectedId = (id: string) => { if (id === selectedId || leaving()) { unsaved.current = id === selectedId && unsaved.current; setSelected(id); } };
  const setMode = (m: 'look' | 'draw') => { if (m === mode || !leaving()) return; unsaved.current = false; setModeNow(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* kept for this visit only */ } };
  const kit = avatars.find((a) => a.id === selectedId) || avatars[0] || null;
  useEffect(() => { if (kit) remember(kit.id); }, [kit?.id]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (payload: any) => {
    setError('');
    setBusy(true);
    try {
      const answer = await request(payload);
      if (answer?.id) { unsaved.current = false; setSelected(answer.id); }
      return answer;
    } catch (err: any) {
      setError(refusalWords(t, err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  // The name is typed into its own copy and kept when the field is left.
  const [name, setName] = useState(kit?.name || '');
  useEffect(() => { setName(kit?.name || ''); }, [kit?.id, kit?.name]);
  const [newName, setNewName] = useState('');

  // ------------------------------------------------------------ the preview
  const [face, setFace] = useState('neutral');
  const [outfit, setOutfit] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [colouring, setColouring] = useState({ colouring: 'original', ownColour: '#a56cae' });
  const [talking, setTalking] = useState<'' | 'soft' | 'normal' | 'loud'>('');
  const [acting, setActing] = useState<{ name: string; key: string } | null>(null);
  // What goes behind a picture, sheet or GIF taken out: see-through, or a colour.
  const [exportBg, setExportBg] = useState<string | null>(null);
  const [exporting, setExporting] = useState('');
  // Its earlier versions, fetched when asked for: kept on the server, not handed to every screen.
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionList, setVersionList] = useState<{ at: number; avatar: PixelAvatarDef }[] | null>(null);
  useEffect(() => { setVersionsOpen(false); setVersionList(null); }, [kit?.id]);
  const loadVersions = async () => { if (!kit) return; try { const a = await request({ op: 'versions', id: kit.id }); setVersionList(a?.versions || []); } catch (err: any) { setError(refusalWords(t, err)); } };
  // Fetched again whenever the avatar changes while the list is open: a save is a new version.
  useEffect(() => { if (versionsOpen) loadVersions(); }, [versionsOpen, kit]);
  const take = async (what: string, make: () => Promise<Blob>, file: string) => {
    setError(''); setExporting(what);
    try { download(await make(), file); } catch (err: any) { setError(String(err?.message || err)); } finally { setExporting(''); }
  };
  // A different avatar starts the preview over: what the last one wore it may not have.
  useEffect(() => { setFace('neutral'); setOutfit(''); setExtras([]); setActing(null); }, [kit?.id]);

  const hats = useMemo(() => (kit ? pixelHats(kit) as string[] : []), [kit]);
  const colours = useMemo(() => (kit ? pixelColours(kit, colouring.colouring, { own: colouring.ownColour }) : {}), [kit, colouring]);
  const hat = extras.find((e) => hats.includes(e)) || '';
  const headwear = kit ? Boolean(pixelOutfit(kit, outfit)?.headwear) : false;
  const toggleExtra = (id: string) => setExtras((now) => (now.includes(id) ? now.filter((e) => e !== id) : [...now, id]));
  const wearHat = (id: string) => setExtras((now) => [...now.filter((e) => !hats.includes(e)), ...(id ? [id] : [])]);
  const play = (actionName: string) => setActing({ name: actionName, key: `${actionName}:${Date.now()}` });

  /** What deleting one does to the layers drawing it: back to the built-in avatar, or to the house avatar, or — the house avatar itself — to nothing. */
  const deleteWords = (id: string) => {
    if (!HOUSE_CHARACTER) return t.pixelDeleteConfirm || 'Delete “{name}”? A layer drawing it goes back to the built-in avatar.';
    if (id === HOUSE_CHARACTER) return t.pixelDeleteTheHouse || 'Delete “{name}”? Pixel avatar layers that draw it show nothing until “Bring back the examples” puts it back.';
    return t.pixelDeleteConfirmHouse || 'Delete “{name}”? A layer drawing it goes back to the example.';
  };
  // An edition with a house avatar has it as its example; otherwise the built-in avatar's copy stands for them all.
  const missingExamples = !avatars.some((a) => (HOUSE_CHARACTER ? a.id === HOUSE_CHARACTER : a.example === 'simonsays'));

  // The avatar open, as a dropdown at the top of the editor: the rest each with its picture, and a new one made at its foot.
  const picker = (
    <AvatarPicker avatars={avatars} kit={kit} onPick={setSelectedId} t={t}>
      {(close: () => void) => (
        <>
          <div className="flex gap-1.5">
            <input
              value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60}
              placeholder={t.pixelNewName || 'New avatar’s name'} className={box} data-pixel-new-name
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { run({ op: 'create', name: newName }); setNewName(''); close(); } }}
            />
            <button
              onClick={() => { run({ op: 'create', name: newName }); setNewName(''); close(); }} disabled={busy}
              title={t.pixelNew || 'New, empty'} className={button} data-pixel-create
            >
              <Plus size={12} />
            </button>
          </div>
          <label className={`${button} w-full justify-center cursor-pointer`} title={t.pixelFromFileHint || 'A pixel avatar saved as a file, from here or another SimonSays'}>
            <FileUp size={12} /> {t.pixelFromFile || 'Add from a file'}
            <input
              type="file" accept=".json,application/json" className="hidden" data-pixel-from-file
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = '';
                if (!file) return;
                try {
                  const avatar = avatarFromFile(await file.text(), `pa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
                  if (leaving()) { run({ op: 'save', avatar }); close(); }
                } catch {
                  setError(t.pixelNotAFile || 'That file is not a pixel avatar.');
                }
              }}
            />
          </label>
          {missingExamples && (
            <button onClick={() => { run({ op: 'restore-examples' }); close(); }} disabled={busy} className={`${button} w-full justify-center`} data-pixel-restore>
              <RotateCcw size={12} /> {t.pixelRestoreExamples || 'Bring back the examples'}
            </button>
          )}
        </>
      )}
    </AvatarPicker>
  );

  return (
    <div className="animate-fade-in space-y-6 pb-20" data-pixel-avatars>
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.pixelAvatarsNav || 'Pixel avatars'}</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {HOUSE_CHARACTER
            ? (t.pixelAvatarsHintHouse || 'Pixel avatars drawn here. The example is one to start from, and what a Pixel avatar layer draws until it is given another — so changing the example changes those layers too. Put one on stream by choosing it as “Drawn as” on a Pixel avatar layer in Overlays.')
            : (t.pixelAvatarsHint || 'Pixel avatars drawn here, beside the built-in one. The examples are copies to start from — changing one never changes the built-in avatar. Put one on stream by choosing it as “Drawn as” on a Pixel avatar layer in Overlays.')}
        </p>
        {error && <p className="flex items-center gap-2 text-[11px] text-amber-400" data-pixel-error><AlertTriangle size={13} /> {error}</p>}
      </div>

      {/* ------------------------------------------------- the one open, and the dropdown to choose another */}
      <div className="space-y-6" data-pixel-selected={kit?.id || ''}>
        {!kit && <div className="glass-panel rounded-3xl border border-zinc-800 p-6 relative z-20">{picker}</div>}
        {kit && (
          <>
            {/* Above the panels after it: the dropdown opens over them. */}
            <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5 relative z-20">
              <div className="flex flex-wrap items-end gap-2">
                {picker}
                <label className="flex-1 min-w-[12rem] space-y-1 block">
                  <span className={tag}>{t.pixelName || 'Name'}</span>
                  <input
                    value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={box} data-pixel-name
                    onBlur={() => { if (name.trim() && name.trim() !== kit.name) run({ op: 'rename', id: kit.id, name }); }}
                  />
                </label>
                <button onClick={() => { if (leaving()) run({ op: 'duplicate', id: kit.id }); }} disabled={busy} className={button} data-pixel-duplicate>
                  <Copy size={12} /> {t.pixelDuplicate || 'Copy'}
                </button>
                <button onClick={() => setVersionsOpen((v) => !v)} className={`${button} ${versionsOpen ? 'border-current-accent text-current-accent' : ''}`} data-pixel-versions-open>
                  <History size={12} /> {t.pixelVersions || 'Versions'}
                </button>
                <button onClick={() => download(avatarFile(kit), `${fileName(kit.name)}.pixel-avatar.json`)} className={button} title={t.pixelDownloadHint || 'The avatar as a file, to keep or to bring into another SimonSays'} data-pixel-download>
                  <Download size={12} /> {t.pixelDownload || 'Download'}
                </button>
                {kit.example && (
                  <button
                    onClick={async () => { if (window.confirm(t.pixelResetConfirm || 'Put this example back as the built-in drawing is? Every change made to it goes.')) { unsaved.current = false; await run({ op: 'reset', id: kit.id }); setEditorRound((n) => n + 1); } }}
                    disabled={busy} className={button} data-pixel-reset
                  >
                    <RotateCcw size={12} /> {t.pixelReset || 'Put back'}
                  </button>
                )}
                <button
                  onClick={() => { if (window.confirm(fill(deleteWords(kit.id), { name: kit.name }))) run({ op: 'delete', id: kit.id }); }}
                  disabled={busy} className={`${button} hover:text-rose-400 hover:border-rose-900`} data-pixel-delete
                >
                  <Trash2 size={12} /> {t.delete || 'Delete'}
                </button>
              </div>

              {versionsOpen && (
                <div className="space-y-2 rounded-xl border border-zinc-800 p-3" data-pixel-versions>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{t.pixelVersionsHint || 'Each time it is saved, what it was before is kept here — the last twelve. Bringing one back keeps what it is now as a version too, so nothing is lost.'}</p>
                  {versionList === null ? (
                    <p className="text-[10px] text-zinc-600">…</p>
                  ) : versionList.length === 0 ? (
                    <p className="text-[10px] text-zinc-600" data-pixel-versions-none>{t.pixelVersionsNone || 'No earlier versions yet: they start with the next save.'}</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {versionList.map((v) => (
                        <div key={v.at} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5 space-y-1" data-pixel-version={v.at}>
                          <div className="aspect-square"><PixelKitAvatar kit={v.avatar} /></div>
                          <span className="block text-[9px] text-zinc-400 truncate" title={new Date(v.at).toLocaleString()}>{new Date(v.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <button
                            onClick={async () => {
                              if (!window.confirm(t.pixelVersionRestoreConfirm || 'Bring this version back? What it is now is kept as a version.') || !leaving()) return;
                              await run({ op: 'restore', id: kit.id, at: v.at });
                              unsaved.current = false;
                              setEditorRound((n) => n + 1);
                            }}
                            disabled={busy} className={`${button} w-full justify-center`} data-pixel-version-restore
                          >
                            <RotateCcw size={10} /> {t.pixelVersionRestore || 'Bring back'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-1" data-pixel-modes>
                {(['look', 'draw'] as const).map((m) => (
                  <button
                    key={m} onClick={() => setMode(m)} data-pixel-mode={m}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${mode === m ? 'border-current-accent text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-500 hover:text-zinc-200'}`}
                  >
                    {m === 'look' ? (t.pixelModeLook || 'Look') : (t.pixelModeDraw || 'Draw')}
                  </button>
                ))}
              </div>

              {mode === 'look' && (
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,18rem)_1fr] gap-6 items-start">
                <div className="space-y-3">
                  <div className="aspect-square rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden p-3" data-pixel-preview>
                    <LivingAvatar
                      kit={kit} expression={face} extras={headwear ? extras.filter((e) => !hats.includes(e)) : extras} colours={colours} costume={outfit}
                      speaking={Boolean(talking)} loud={talking === 'loud'} soft={talking === 'soft'}
                      glance={Boolean(kit.eyes || kit.turn)} twinkle={Boolean(kit.eyes)} action={acting}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(['', 'soft', 'normal', 'loud'] as const).map((v) => (
                      <button
                        key={v || 'quiet'} onClick={() => setTalking(v)} data-pixel-talk={v || 'quiet'}
                        className={`px-2 py-1 rounded-md border text-[9px] font-bold ${talking === v ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {v === '' ? (t.pngtuberQuiet || 'Quiet') : v === 'soft' ? (t.pngtuberSoftNow || 'Talking softly') : v === 'loud' ? (t.pngtuberLoud || 'Loud') : (t.pngtuberTalkingNow || 'Talking')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {kit.outfits.length > 0 && (
                      <label className="space-y-1 block">
                        <span className={tag}>{t.avatarCostume || 'Outfit'}</span>
                        <select value={outfit} onChange={(e) => setOutfit(e.target.value)} className={box} data-pixel-outfit>
                          {['', ...kit.outfits.map((o) => o.name)].map((o) => <option key={o} value={o}>{pixelOutfitName(kit, o, t)}</option>)}
                        </select>
                      </label>
                    )}
                    {hats.length > 0 && (
                      <label className="space-y-1 block">
                        <span className={tag}>{t.avatarHat || 'Hat'}</span>
                        <select value={hat} onChange={(e) => wearHat(e.target.value)} className={box} disabled={headwear} data-pixel-hat>
                          <option value="">{t.avatarHatNone || 'None'}</option>
                          {hats.map((h) => <option key={h} value={h}>{pixelExtraName(kit, h, t)}</option>)}
                        </select>
                      </label>
                    )}
                    <AvatarColourSelect colouring={colouring.colouring} set={(next) => setColouring((c) => ({ ...c, ...next }))} t={t} />
                  </div>
                  <AvatarColourExtras colouring={colouring.colouring} ownColour={colouring.ownColour} set={(next) => setColouring((c) => ({ ...c, ...next }))} t={t} />
                  {!kit.colouring && colouring.colouring !== 'original' && colouring.colouring !== 'night-vision' && (
                    <p className="text-[10px] text-zinc-600">{t.pixelNoColouring || 'This one keeps its own colours: nothing in it is set to take another.'}</p>
                  )}
                  {kit.extras.some((e) => !e.hat) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {kit.extras.filter((e) => !e.hat).map((e) => (
                        <label key={e.name} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={extras.includes(e.name)} onChange={() => toggleExtra(e.name)} className="accent-current-accent" />
                          <span className="text-[10px] text-zinc-400">{pixelExtraName(kit, e.name, t)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {kit.actions.length > 0 && (
                    <div className="space-y-1.5">
                      <span className={tag}>{t.pixelActions || 'Things it does'}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {kit.actions.map((a) => {
                          const ms = pixelActionMs(kit, a.name, outfit) as number;
                          return (
                            <span key={a.name} className="flex">
                              <button onClick={() => play(a.name)} disabled={!ms} className={`${button} rounded-r-none`} data-pixel-play={a.name} title={ms ? '' : (t.pixelActionNotInOutfit || 'Not drawn in this outfit')}>
                                {ms ? <Play size={11} /> : <Square size={11} />} {pixelActionLabel(kit, a.name, t)}{ms ? ` · ${(ms / 1000).toFixed(1)} s` : ''}
                              </button>
                              <button
                                onClick={() => take(`gif:${a.name}`, () => actionGif(kit, a.name, { outfit, extras: headwear ? extras.filter((e) => !hats.includes(e)) : extras, colours, background: exportBg }), `${fileName(kit.name)}-${a.name}.gif`)}
                                disabled={!ms || Boolean(exporting)} className={`${button} rounded-l-none border-l-0`} title={t.pixelGifHint || 'Download it as an animated GIF'} data-pixel-gif={a.name}
                              ><Film size={11} /></button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5" data-pixel-export>
                    <span className={tag}>{t.pixelTakeOutAs || 'Download as'}</span>
                    <button onClick={() => take('picture', () => avatarPicture(kit, { faces: [face], outfit, extras: headwear ? extras.filter((e) => !hats.includes(e)) : extras, colours, background: exportBg }), `${fileName(kit.name)}.png`)} disabled={Boolean(exporting)} className={button} data-pixel-export-picture><ImageIcon size={11} /> {t.pixelPicture || 'Picture'}</button>
                    <button onClick={() => take('sheet', () => facesSheet(kit, { outfit, extras: headwear ? extras.filter((e) => !hats.includes(e)) : extras, colours, background: exportBg }, t), `${fileName(kit.name)}-faces.png`)} disabled={Boolean(exporting)} className={button} data-pixel-export-sheet><Grid2x2 size={11} /> {t.pixelFacesSheet || 'Sheet of its faces'}</button>
                    <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <input type="checkbox" checked={!exportBg} onChange={(e) => setExportBg(e.target.checked ? null : '#18181b')} className="accent-current-accent" data-pixel-export-clear /> {t.pixelSeeThrough || 'See-through'}
                    </label>
                    {exportBg && <input type="color" value={exportBg} onChange={(e) => setExportBg(e.target.value)} className="w-6 h-6 bg-transparent border border-zinc-800 rounded cursor-pointer" data-pixel-export-bg />}
                    {exporting && <span className="text-[10px] text-zinc-500">{t.pixelExporting || 'Drawing it…'}</span>}
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-relaxed" data-pixel-counts>
                    {fill(t.pixelCounts || '{parts} colours · {faces} faces · {outfits} outfits · {hats} hats · {actions} things it does', {
                      parts: kit.parts.length, faces: kit.faces.length, outfits: kit.outfits.length + 1, hats: hats.length, actions: kit.actions.length,
                    })}
                  </p>
                  {(() => {
                    // What the living avatar reaches for by name and this one has not got: it just does not do those.
                    const lacking = PIXEL_SPECIAL_FACES.filter((f: string) => !['blink-half', 'talking-soft', 'talking-loud'].includes(f) && !kit.faces.some((x) => x.name === f));
                    return lacking.length > 0 && (
                      <p className="text-[10px] text-zinc-600 leading-relaxed" data-pixel-lacking>
                        {t.pixelLacking || 'Without a face for it, it does not:'} {lacking.map((f: string) => pixelFaceName(kit, f, t)).join(', ')}
                      </p>
                    );
                  })()}
                </div>
              </div>
              )}
            </div>

            {mode === 'draw' && (
              <PixelEditor key={`${kit.id}:${editorRound}`} kit={kit} request={request} onDirty={(d) => { unsaved.current = d; }} listAssets={listAssets} uploadAsset={uploadAsset} t={t} />
            )}

            {/* ------------------------------------------------------- galleries */}
            {mode === 'look' && (
            <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5">
              <div className="space-y-2">
                <span className={tag}>{t.avatarFace || 'Face'}</span>
                <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-1.5" data-pixel-faces>
                  {[...pixelFaceChoices(kit), ...kit.faces.map((f) => f.name).filter((n) => ['blink-half', 'talking-soft', 'talking-loud'].includes(n))].map((f) => (
                    <Tile key={f} active={face === f} onClick={() => setFace(f)} title={pixelFaceName(kit, f, t)} testId={`face:${f}`}>
                      <div className="aspect-[48/44]"><PixelKitAvatar kit={kit} faces={f} extras={extras} colours={colours} crop={pixelFaceCrop(kit)} outfit={outfit} /></div>
                    </Tile>
                  ))}
                </div>
              </div>
              {kit.outfits.length > 0 && (
                <div className="space-y-2">
                  <span className={tag}>{t.avatarCostume || 'Outfit'}</span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-8 gap-1.5" data-pixel-outfits>
                    {['', ...kit.outfits.map((o) => o.name)].map((o) => (
                      <Tile key={o || 'base'} active={outfit === o} onClick={() => setOutfit(o)} title={pixelOutfitName(kit, o, t)} testId={`outfit:${o}`}>
                        <div className="aspect-square p-1"><PixelKitAvatar kit={kit} faces={face} extras={extras} colours={colours} outfit={o} /></div>
                      </Tile>
                    ))}
                  </div>
                </div>
              )}
              {hats.length > 0 && (
                <div className="space-y-2">
                  <span className={tag}>{t.avatarHat || 'Hat'}</span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-8 gap-1.5" data-pixel-hats>
                    {hats.map((h) => (
                      <Tile key={h} active={hat === h} onClick={() => wearHat(hat === h ? '' : h)} title={pixelExtraName(kit, h, t)} testId={`hat:${h}`}>
                        <div className="aspect-square p-1"><PixelKitAvatar kit={kit} faces={face} extras={[h]} colours={colours} /></div>
                      </Tile>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
