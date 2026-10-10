/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Configure which actions appear on the Dock Actions surface.
 *
 * Left: every action, each with an add/remove toggle. Right: the resulting
 * deck, live, using the same grid component the real surface renders — what
 * you arrange here is literally what OBS shows.
 */
import React, { useState, useEffect, useRef } from 'react';
import { DockButton, StreamAction, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { DockActionsGrid } from '../DockActionsGrid';
import { DOCK_BUILTINS, dockBuiltin, pixelActionBuiltinId } from '../../../shared/dock-builtins.js';
import { AVATAR_ACTIONS_LIST } from '../../../shared/avatar.js';
import { pixelActionLabel } from '../pixelNames';
import type { PixelAvatarDef } from '../../types';
import { youtubeCategoryName } from '../../../shared/youtube-categories.js';
import { Check, Copy, ExternalLink, Plus, Minus, Monitor, Palette, Upload, Trash2 } from 'lucide-react';
import { copyText } from '../../utils';
import { builtinName, refusalWords, fill } from '../../words';
import { CommittedInput } from '../CommittedInput';
import {
  MAX_DOCK_PAGES, pageCount, cleanPageNames, pagerPlace, pageOf, buttonsOnPage, firstFreeSlot, moveToPage, removePage, sidewaysMode,
} from '../../../shared/dock-pages.js';
import { StillImg } from '../StillPicture';

interface DockActionsViewProps {
  /** The pixel avatars from the Pixel avatars tab: what they do can be a button. */
  pixelAvatars?: PixelAvatarDef[];
  dockButtons: DockButton[];
  streamActions: StreamAction[];
  setDockButtons: (buttons: DockButton[]) => void;
  dockGrid: { columns: number; rows: number; pages?: number; pageNames?: string[]; pagerAt?: 'top' | 'bottom'; sideways?: 'fold' | 'pages' };
  setDockGrid: (next: { columns?: number; rows?: number; pages?: number; pageNames?: string[]; pagerAt?: 'top' | 'bottom'; sideways?: 'fold' | 'pages' }) => void;
  runDockAction: (id: string) => Promise<any>;
  /** The server's live numbers, so the preview shows a state button's state. */
  stats?: Record<string, any>;
  listAssets: () => Promise<{ name: string; url: string }[]>;
  uploadAsset: (file: File) => Promise<{ url: string }>;
  activeTheme: ThemeConfig;
  t: any;
}

const newId = () => `dock-${Math.random().toString(36).slice(2, 9)}`;

/**
 * What each group of built-in buttons is headed with. A brand name is the same
 * in every language and has no key; anything else is looked up in the strings
 * and falls back to the English here. A category missing from this is headed
 * with its id rather than left without a heading.
 */
const BUILTIN_CATEGORY_NAMES: Record<string, { name: string; key?: string }> = {
  spotify: { name: 'Spotify' },
  plan: { name: 'Stream plan', key: 'dockCategoryPlan' },
  timer: { name: 'Run timer', key: 'dockCategoryTimer' },
  youtube: { name: 'YouTube' },
  avatar: { name: 'Pixel avatar', key: 'dockCategoryAvatar' },
  twitch: { name: 'Twitch' },
  questions: { name: 'Questions', key: 'questionsNav' },
  deaths: { name: 'Deaths', key: 'gameDeaths' },
  countdown: { name: 'Countdown', key: 'countdown' },
  alerts: { name: 'Alerts', key: 'alerts' },
};
const categoryHeading = (category: string, t: any) => {
  const known = BUILTIN_CATEGORY_NAMES[category];
  return (known?.key && t[known.key]) || known?.name || category;
};

/**
 * Colour choices, taken from the palette already in use across the app rather
 * than a free colour picker — a deck reads best when buttons group by colour,
 * which a limited set encourages and an arbitrary one does not. The empty
 * entry restores the action's own platform tint.
 */
const SWATCHES = ['', '#f43f5e', '#9146FF', '#ff0050', '#1DB954', '#5865F2', '#f59e0b', '#06b6d4', '#22c55e', '#a855f7'];

export const DockActionsView: React.FC<DockActionsViewProps> = ({
  dockButtons, streamActions, setDockButtons, runDockAction, stats, dockGrid, setDockGrid,
  listAssets, uploadAsset, activeTheme, pixelAvatars = [], t,
}) => {
  // What the pixel avatars from the Pixel avatars tab do, each a button of its own; drinking water is already one.
  const pixelActions = pixelAvatars
    .flatMap((p) => p.actions.map((a) => ({ name: a.name, label: pixelActionLabel(p, a.name, t) })))
    .filter((a, i, all) => !(AVATAR_ACTIONS_LIST as string[]).includes(a.name) && all.findIndex((b) => b.name === a.name) === i);
  // Which button has its styling controls open. One at a time: the panel is
  // narrow and several expanded rows would bury the preview.
  const [editing, setEditing] = useState<string | null>(null);
  const [assets, setAssets] = useState<{ name: string; url: string }[]>([]);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  // Only fetched when a styling panel is first opened — the list is useless
  // until then, and the screen is often visited just to reorder.
  useEffect(() => {
    if (!editing) return;
    listAssets().then(setAssets).catch(() => setAssets([]));
  }, [editing, listAssets]);

  const [copied, setCopied] = useState(false);

  /*
    The pages, and which one the board below is showing. New buttons go on
    that page; a button dragged onto another page's tab goes to that page.
  */
  const pages = pageCount(dockGrid);
  const pageNames = cleanPageNames(dockGrid.pageNames, pages);
  const [pageWanted, setPage] = useState(0);
  const page = Math.min(pageWanted, pages - 1);
  const pageLabel = (i: number) => pageNames[i] || fill(t.dockPageNumber || 'Page {n}', { n: String(i + 1) });

  const addPage = () => {
    if (pages >= MAX_DOCK_PAGES) return;
    setDockGrid({ pages: pages + 1, pageNames: [...pageNames, ''] });
    setPage(pages);
  };
  const removeThisPage = () => {
    if (pages < 2) return;
    const on = buttonsOnPage(dockButtons, page, pages).length;
    if (on && !window.confirm(fill(t.dockPageRemoveConfirm || 'Remove {name}? What is on it ({n}) comes off the dock.', { name: pageLabel(page), n: String(on) }))) return;
    setDockButtons(removePage(dockButtons, page, pages) as DockButton[]);
    setDockGrid({ pages: pages - 1, pageNames: pageNames.filter((_, i) => i !== page) });
    setPage(Math.max(0, page - 1));
  };
  const renamePage = (name: string) => setDockGrid({ pageNames: pageNames.map((n, i) => (i === page ? name : n)) });
  const columns = dockGrid.columns;
  const rows = dockGrid.rows;

  /*
    One URL for everybody now. The column count used to be written into it,
    because the shape was a preference of whichever browser copied the link;
    it is on the server instead, so every surface that draws the grid — this
    preview, the standalone source, and the panel in the chat dock — reads the
    same one and the screen that sets it reaches all three.
  */
  const surfaceUrl = (() => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('mode', 'dock-actions');
    return url.toString();
  })();

  /*
    What is being carried, and the cell it is over.

    Nothing moves while a drag is in progress. Crossing a cell used to place
    the button in it there and then, which meant dragging across a full row
    dealt every button in it a new home on the way past — a gesture that had
    not finished yet rewriting the board behind the pointer. The cell under the
    pointer is only noted; the board changes once, on the drop.

    Both live in refs as well as in state. The state is what draws the button
    being carried and the cell it is over; the refs are what the drop reads,
    because a dragover can arrive in the same tick as the dragstart that set it
    and the drop before React has committed the last crossing — reading state,
    the first crossing would count for nothing and the drop would land on the
    cell before the one you are actually over.
  */
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<number | null>(null);
  const dragRef = useRef<string | null>(null);
  const overRef = useRef<number | null>(null);

  // Or the page tab it is over, which takes it to that page instead of a cell on this one.
  const [overPage, setOverPage] = useState<number | null>(null);
  const overPageRef = useRef<number | null>(null);

  const startDrag = (id: string) => { dragRef.current = id; setDragId(id); };
  const dragOverCell = (cell: number) => {
    if (overPageRef.current !== null) { overPageRef.current = null; setOverPage(null); }
    if (!dragRef.current || overRef.current === cell) return;
    overRef.current = cell;
    setOverCell(cell);
  };
  const dragOverPage = (target: number) => {
    if (!dragRef.current || overPageRef.current === target) return;
    overRef.current = null;
    setOverCell(null);
    overPageRef.current = target;
    setOverPage(target);
  };

  const clearDrag = () => {
    dragRef.current = null;
    overRef.current = null;
    overPageRef.current = null;
    setDragId(null);
    setOverCell(null);
    setOverPage(null);
  };

  /*
    The drop. The button takes the cell it was let go over, and if somebody was
    already there that one takes the cell it came from — they trade, which is
    the only answer that moves nothing nobody touched.
  */
  const dropIt = () => {
    const id = dragRef.current;
    const cell = overRef.current;
    const toPage = overPageRef.current;
    clearDrag();
    // Onto another page's tab: to that page, in its first free cell.
    if (id !== null && toPage !== null && toPage !== page) {
      setDockButtons(moveToPage(dockButtons, id, toPage, pages) as DockButton[]);
      return;
    }
    if (id === null || cell === null) return;
    const held = dockButtons.find((b) => b.id === id);
    if (!held || held.slot === cell) return;
    // Only a button on this page sits in this page's cells.
    const sitting = dockButtons.find((b) => b.id !== id && b.slot === cell && pageOf(b, pages) === page);
    setDockButtons(dockButtons.map((b) => (
      b.id === held.id ? { ...b, slot: cell }
        : sitting && b.id === sitting.id ? { ...b, slot: held.slot }
          : b
    )));
  };

  const onDeck = new Set(dockButtons.map((b) => b.actionId));

  /* The first cell nobody is in on the page showing, so a new button lands in the gap you can see. */
  const firstFree = () => firstFreeSlot(dockButtons, page, pages);

  const add = (action: StreamAction) => setDockButtons(
    [...dockButtons, { id: newId(), actionId: action.id, label: '', page, slot: firstFree(), color: '', icon: '', image: '' }],
  );
  const remove = (actionId: string) => setDockButtons(dockButtons.filter((b) => b.actionId !== actionId));

  /*
    The built-in ones, which name themselves rather than an action. Otherwise
    identical: they take a cell, a label, a colour and a picture like the rest.
  */
  const addBuiltin = (id: string) => setDockButtons(
    [...dockButtons, { id: newId(), actionId: '', builtin: id, label: '', page, slot: firstFree(), color: '', icon: '', image: '' }],
  );
  const removeBuiltin = (id: string) => setDockButtons(dockButtons.filter((b) => b.builtin !== id));
  const builtinsOn = new Set(dockButtons.map((b) => b.builtin).filter(Boolean));

  const patch = (id: string, fields: Partial<DockButton>) => setDockButtons(
    dockButtons.map((b) => (b.id === id ? { ...b, ...fields } : b)),
  );
  const relabel = (id: string, label: string) => patch(id, { label });

  /*
    Where a picture goes: the button's one, or the one for a state of it.
    Kept as "id|state" so the single file input can serve either.
  */
  const setPicture = (buttonId: string, state: string, url: string) => {
    const button = dockButtons.find((b) => b.id === buttonId);
    if (!button) return;
    patch(buttonId, state ? { stateImages: { ...(button.stateImages || {}), [state]: url } } : { image: url });
  };

  const chooseFile = (buttonId: string, state = '') => {
    setUploadTarget(`${buttonId}|${state}`);
    setUploadError('');
    fileInput.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset immediately so picking the same file twice still fires a change.
    e.target.value = '';
    if (!file || !uploadTarget) return;
    try {
      const { url } = await uploadAsset(file);
      const [buttonId, state = ''] = uploadTarget.split('|');
      setPicture(buttonId, state, url);
      setAssets(await listAssets());
    } catch (err: any) {
      setUploadError(refusalWords(t, err) || t.uploadFailed || 'Upload failed');
    }
  };

  return (
    // On a wide screen it fills the height the app gives a view, so the lists
    // below can grow into whatever space is actually there rather than
    // scrolling inside a fixed max-height with empty page beneath them. On a
    // phone the two panels sit one above the other, and squeezing both into
    // one screen's height left the preview 0px tall — so there the page
    // scrolls instead, and each part takes the room it needs.
    <div className="animate-fade-in lg:h-full flex flex-col gap-6 lg:min-h-0 pb-20 lg:pb-0" data-dock-editor>
      {/* One input reused by every button's upload control. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        onChange={onFilePicked}
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 flex-shrink-0">
        
        <div className="flex flex-wrap items-center gap-3" data-dock-grid-controls>
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <span className="px-2 text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.dockActionsColumns}
            </span>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setDockGrid({ columns: n })}
                title={`${n} ${t.dockActionsColumns}`}
                className={`w-8 h-8 rounded-lg text-[11px] font-black transition-colors ${columns === n ? 'bg-current-accent/10 text-current-accent' : 'text-zinc-600 hover:text-zinc-300'}`}
              >
                {n}
              </button>
            ))}
          </div>
          {/*
            Rows, with nothing chosen as a real answer rather than a missing
            one: a grid that takes as many rows as it needs and keeps its cells
            square is what this drew before it could be told otherwise, and it
            is still the right answer for a dock nobody has sized.
          */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <span className="px-2 text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.dockActionsRows || 'Rows'}
            </span>
            <button
              onClick={() => setDockGrid({ rows: 0 })}
              title={t.dockActionsRowsAuto || 'As many as it takes'}
              className={`px-2 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors ${rows === 0 ? 'bg-current-accent/10 text-current-accent' : 'text-zinc-600 hover:text-zinc-300'}`}
            >
              {t.dockActionsRowsAutoShort || 'Auto'}
            </button>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setDockGrid({ rows: n })}
                title={`${n} ${t.dockActionsRows || 'Rows'}`}
                className={`w-8 h-8 rounded-lg text-[11px] font-black transition-colors ${rows === n ? 'bg-current-accent/10 text-current-accent' : 'text-zinc-600 hover:text-zinc-300'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            icon={<ExternalLink size={16} />}
            onClick={() => window.open(surfaceUrl, '_blank', 'width=420,height=560')}
          >
            {t.dockActionsOpen}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:flex-1 lg:min-h-0">
        {/* Picker. On a phone its list stops at about half a screen and scrolls, so the deck is not a long way down. */}
        <div className={`glass-panel p-6 rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} flex flex-col lg:min-h-0`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 flex-shrink-0">{t.dockActionsAvailable}</h3>
          <div className="space-y-2 max-h-[50vh] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto pr-1" data-dock-picker-list>
            {/*
              Two sections: the buttons that come with the app, then the ones
              made from actions. Run together, the Spotify controls sat
              unannounced at the top of a list of things somebody built, and
              the list read as one long column of unrelated names. The built-in
              ones are grouped by what they control, so a second kind lands
              under its own name rather than in with Spotify's.
            */}
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pt-1" data-dock-section="builtin">
              {t.dockBuiltinsHeading || 'Built-in buttons'}
            </p>
            {[...new Set(DOCK_BUILTINS.map((b: any) => b.category))].map((category: any) => (
              <div key={category} className="space-y-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 px-1" data-dock-category={category}>
                  {categoryHeading(category, t)}
                </p>
            {DOCK_BUILTINS.filter((b: any) => b.category === category).map((b: any) => {
              const on = builtinsOn.has(b.id);
              return (
                <div key={b.id} className="flex items-center gap-3 bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-2" data-dock-builtin={b.id}>
                  <span className="text-sm leading-none w-4 text-center shrink-0">{b.icon}</span>
                  <span className="flex-1 min-w-0 text-xs font-bold text-zinc-200 truncate">{builtinName(t, b)}</span>
                  <button
                    onClick={() => (on ? removeBuiltin(b.id) : addBuiltin(b.id))}
                    title={on ? t.dockActionsRemove : t.dockActionsAdd}
                    className={`p-2 rounded-lg border transition-colors ${on ? 'border-current-accent/40 text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-500 hover:text-white'}`}
                  >
                    {on ? <Minus size={12} /> : <Plus size={12} />}
                  </button>
                </div>
              );
            })}
              </div>
            ))}
            {pixelActions.length > 0 && (
              <div className="space-y-2" data-dock-pixel-actions>
                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 px-1">{t.dockPixelActions || 'What the pixel avatars do'}</p>
                {pixelActions.map((a) => {
                  const id = pixelActionBuiltinId(a.name);
                  const on = builtinsOn.has(id);
                  return (
                    <div key={id} className="flex items-center gap-3 bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-2" data-dock-builtin={id}>
                      <span className="text-sm leading-none w-4 text-center shrink-0">✨</span>
                      <span className="flex-1 min-w-0 text-xs font-bold text-zinc-200 truncate">{a.label}</span>
                      <button
                        onClick={() => (on ? removeBuiltin(id) : addBuiltin(id))}
                        title={on ? t.dockActionsRemove : t.dockActionsAdd}
                        className={`p-2 rounded-lg border transition-colors ${on ? 'border-current-accent/40 text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-500 hover:text-white'}`}
                      >
                        {on ? <Minus size={12} /> : <Plus size={12} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pt-4" data-dock-section="actions">
              {t.dockActionsFromActions || 'From your actions'}
            </p>
            {streamActions.length === 0 && (
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">{t.noInteractions}</p>
            )}
            {streamActions.map((action) => {
              const added = onDeck.has(action.id);
              return (
                <div key={action.id} className="flex items-center gap-3 bg-zinc-950/50 border border-zinc-800 rounded-xl px-3 py-2">
                  <span className="flex-1 min-w-0 text-xs font-bold text-zinc-200 truncate">{action.name}</span>
                  <button
                    onClick={() => (added ? remove(action.id) : add(action))}
                    title={added ? t.dockActionsRemove : t.dockActionsAdd}
                    className={`p-2 rounded-lg border transition-colors ${added ? 'border-current-accent/40 text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-500 hover:text-white'}`}
                  >
                    {added ? <Minus size={12} /> : <Plus size={12} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Arrangement + live preview */}
        <div className={`glass-panel p-6 rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} flex flex-col gap-4 lg:min-h-0`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex-shrink-0">{t.dockActionsOnDeck}</h3>

          {/* Sized to its contents up to a cap, rather than taking all the
              slack — as a flex-1 box it stretched past five rows and left the
              empty space inside itself, pushing the preview to the bottom
              corner. The slack belongs to the preview below. */}
          <div className="space-y-2 max-h-64 min-h-[5rem] overflow-y-auto pr-1">
            {dockButtons.length === 0 && (
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">{t.dockActionsEmpty}</p>
            )}
            {/* The same two sections as the list of what can be added, so a
                built-in button is looked for in the same place on both sides.
                Within each, the order they were added in, as before. */}
            {[
              { id: 'builtin', title: t.dockBuiltinsHeading || 'Built-in buttons', buttons: dockButtons.filter((b) => b.builtin) },
              { id: 'actions', title: t.dockActionsFromActions || 'From your actions', buttons: dockButtons.filter((b) => !b.builtin) },
            ].filter((section) => section.buttons.length > 0).flatMap((section) => [
              <p key={`section-${section.id}`} className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pt-1" data-deck-section={section.id}>
                {section.title}
              </p>,
              ...section.buttons.map((button) => {
              const action = streamActions.find((a) => a.id === button.actionId);
              const builtin = button.builtin ? (dockBuiltin(button.builtin) as any) : null;
              const open = editing === button.id;
              /*
                A roster of what is on the dock, and nothing about where any of
                it is. Where things are is a question the board answers, and a
                list that also had an opinion would be a second, quieter
                arrangement for the two to disagree about.
              */
              return (
                <div
                  key={button.id}
                  className={`bg-zinc-950/50 border rounded-xl ${
                    dragId === button.id ? 'border-current-accent' : 'border-zinc-800'
                  }`}
                  data-dock-row={button.id}
                >
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <input
                      value={button.label}
                      onChange={(e) => relabel(button.id, e.target.value)}
                      placeholder={builtinName(t, builtin) || action?.name || ''}
                      className="flex-1 min-w-0 bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-zinc-600"
                    />
                    <button
                      // Opening one shows its page on the board, so what you change is in view.
                      onClick={() => { setEditing(open ? null : button.id); if (!open) setPage(pageOf(button, pages)); }}
                      title={t.dockActionsStyle}
                      className={`p-1.5 rounded-lg transition-colors ${open ? 'text-current-accent bg-current-accent/10' : 'text-zinc-600 hover:text-white'}`}
                    >
                      <Palette size={12} />
                    </button>
                    <button
                      onClick={() => (button.builtin ? removeBuiltin(button.builtin) : remove(button.actionId))}
                      className="p-1.5 text-zinc-600 hover:text-red-500"
                    >
                      <Minus size={12} />
                    </button>
                  </div>

                  {open && (
                    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-zinc-800/70">
                      {/* Colour */}
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">{t.dockActionsColor}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {SWATCHES.map((c) => (
                            <button
                              key={c || 'default'}
                              onClick={() => patch(button.id, { color: c })}
                              title={c || t.dockActionsColorDefault}
                              style={c ? { backgroundColor: c } : undefined}
                              className={`w-5 h-5 rounded-md border transition-all ${button.color === c ? 'border-white scale-110' : 'border-zinc-700'} ${c ? '' : 'bg-zinc-800 text-[7px] text-zinc-400 font-black'}`}
                            >
                              {c ? '' : 'A'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Icon */}
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">{t.dockActionsIcon}</p>
                        <div className="flex items-center gap-2">
                          <input
                            value={button.icon}
                            onChange={(e) => patch(button.id, { icon: [...e.target.value].slice(0, 4).join('') })}
                            placeholder="🎬"
                            className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-center text-sm outline-none focus:border-current-accent"
                          />
                          {button.icon && (
                            <button onClick={() => patch(button.id, { icon: '' })} className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-white">
                              {t.dockActionsClear}
                            </button>
                          )}
                        </div>
                      </div>

                      {/*
                        Background image. A button that shows a state has one
                        per state instead — the YouTube one, a picture for each
                        of its two categories — and swaps between them as the
                        category changes.
                      */}
                      {(builtin?.categories
                        ? builtin.categories.map((state: string) => ({
                          state,
                          label: `${t.dockActionsImageWhen || 'Background when'} ${youtubeCategoryName(state, t.lang === 'es' ? 'es' : 'en')}`,
                        }))
                        : [{ state: '', label: t.dockActionsImage }]
                      ).map(({ state, label }: { state: string; label: string }) => {
                        const current = state ? (button.stateImages?.[state] || '') : button.image;
                        return (
                          <div key={state || 'image'} data-dock-image={state || 'image'}>
                            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">{label}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {assets.map((a) => (
                                <button
                                  key={a.url}
                                  onClick={() => setPicture(button.id, state, a.url)}
                                  title={a.name}
                                  className={`w-9 h-9 rounded-md overflow-hidden border transition-all ${current === a.url ? 'border-current-accent scale-110' : 'border-zinc-700 hover:border-zinc-500'}`}
                                >
                                  <StillImg src={a.url} width={36} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                              <button
                                onClick={() => chooseFile(button.id, state)}
                                title={t.dockActionsUpload}
                                className="w-9 h-9 rounded-md border border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 flex items-center justify-center"
                              >
                                <Upload size={12} />
                              </button>
                              {current && (
                                <button onClick={() => setPicture(button.id, state, '')} className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-white ml-1">
                                  {t.dockActionsClear}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {uploadError && <p className="text-[9px] text-red-500">{uploadError}</p>}
                    </div>
                  )}
                </div>
              );
            }),
            ])}
          </div>

          {/* min-h keeps the deck from being squeezed to a sliver on a short
              screen: the list above shrinks and scrolls first, since scrolling
              a list costs less than a preview you cannot see. */}
          <div className="pt-4 border-t border-zinc-800/50 lg:flex-1 min-h-[9rem] flex flex-col" data-dock-preview>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-3 flex-shrink-0">{t.dockActionsPreview}</p>
            {/*
              The pages: one tab each, and one to add another. A tab is also
              where a button being dragged goes to change page.
            */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2 flex-shrink-0" data-dock-pages>
              {pageNames.map((_, i) => (
                <button
                  key={i}
                  data-dock-page={i}
                  onClick={() => setPage(i)}
                  onDragOver={(e) => { if (!dragRef.current) return; e.preventDefault(); dragOverPage(i); }}
                  onDrop={(e) => { e.preventDefault(); dropIt(); }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                    overPage === i ? 'border-current-accent text-white ring-2 ring-current-accent'
                      : i === page ? 'bg-current-accent/10 border-current-accent text-current-accent'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {pageLabel(i)}
                  <span className="ml-1.5 opacity-50">{buttonsOnPage(dockButtons, i, pages).length}</span>
                </button>
              ))}
              {pages < MAX_DOCK_PAGES && (
                <button
                  onClick={addPage}
                  title={t.dockPageAdd || 'Add a page'}
                  className="p-1.5 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500"
                  data-dock-page-add
                >
                  <Plus size={11} />
                </button>
              )}
            </div>
            {pages > 1 && (
              <div className="flex items-center gap-2 mb-1 flex-shrink-0">
                <CommittedInput
                  value={pageNames[page]}
                  onCommit={renamePage}
                  placeholder={fill(t.dockPageNumber || 'Page {n}', { n: String(page + 1) })}
                  maxLength={20}
                  className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white outline-none focus:border-current-accent placeholder:text-zinc-600"
                  data-dock-page-name
                />
                <button onClick={removeThisPage} title={t.dockPageRemove || 'Remove this page'} className="p-1.5 text-zinc-600 hover:text-red-500" data-dock-page-remove>
                  <Trash2 size={12} />
                </button>
              </div>
            )}
            {pages > 1 && (
              <p className="text-[9px] text-zinc-600 mb-2 flex-shrink-0">{t.dockPageDropHint || 'New buttons go on the page showing. Drag a button onto another page\'s tab to move it there.'}</p>
            )}
            {/* Where the deck puts its numbered page buttons: over the grid or under it. */}
            {pages > 1 && (
              <div className="flex items-center gap-2 mb-3 flex-shrink-0" data-dock-pager-place>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 whitespace-nowrap">{t.dockPagerPlace || 'Page buttons'}</span>
                <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                  {(['top', 'bottom'] as const).map((place) => (
                    <button
                      key={place}
                      onClick={() => setDockGrid({ pagerAt: place })}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors ${
                        pagerPlace(dockGrid) === place ? 'bg-current-accent/10 text-current-accent' : 'text-zinc-600 hover:text-zinc-300'
                      }`}
                      data-dock-pager-at={place}
                    >
                      {place === 'top' ? (t.dockPagerTop || 'Above') : (t.dockPagerBottom || 'Below')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* On a phone held sideways: the page folded to fill the width, or two pages at once. */}
            {pages > 1 && (
              <div className="mb-3 flex-shrink-0" data-dock-sideways-place>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 whitespace-nowrap">{t.dockSidewaysPlace || 'Phone sideways'}</span>
                  <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                    {(['fold', 'pages'] as const).map((how) => (
                      <button
                        key={how}
                        onClick={() => setDockGrid({ sideways: how })}
                        className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors ${
                          sidewaysMode(dockGrid) === how ? 'bg-current-accent/10 text-current-accent' : 'text-zinc-600 hover:text-zinc-300'
                        }`}
                        data-dock-sideways={how}
                      >
                        {how === 'fold' ? (t.dockSidewaysFold || 'Folded') : (t.dockSidewaysPages || 'Two pages')}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[9px] text-zinc-600 mt-1">{sidewaysMode(dockGrid) === 'pages'
                  ? (t.dockSidewaysPagesHint || 'Held sideways, the deck shows two pages next to each other, each as it is upright.')
                  : (t.dockSidewaysFoldHint || 'Held sideways, the deck lays its rows side by side so the buttons can grow into the width.')}</p>
              </div>
            )}
            {/* The deck sits centred in whatever room is left, so it reads as a
                thing on a shelf rather than something that fell to the corner.
                Width-capped rather than reshaped: a scaled-down deck still
                shows the real proportions, which is the point of a preview. */}
            {/* `m-auto` rather than `items-center`: auto margins collapse to
                zero when the deck is taller than the space, so it scrolls from
                the top instead of having its first row clipped above the
                scroll origin — which is what centring does on overflow. */}
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto flex">
              {/*
                With rows, the box takes the grid’s own proportions so the rows
                have a height to divide. Without one it collapses: the cells are
                a share of nothing, and the squares inside them come out a few
                pixels across. Left to the content when the rows are.
              */}
              <div
                className="w-full max-w-[15rem] m-auto"
                style={rows > 0 ? { aspectRatio: `${columns} / ${rows}` } : undefined}
              >
                <DockActionsGrid
                  buttons={dockButtons}
                  rows={rows}
                  streamActions={streamActions}
                  runDockAction={runDockAction}
                  stats={stats}
                  columns={columns}
                  page={page}
                  pages={pages}
                  compact
                  preview
                  arrange={{ dragId, overCell, start: startDrag, over: dragOverCell, overPage: dragOverPage, drop: dropIt }}
                  t={t}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1 flex-shrink-0">
            <label className="text-[9px] text-zinc-500 uppercase font-bold flex items-center gap-1">
              <Monitor size={10} /> {t.dockActionsUrl}
            </label>
            <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
              <input readOnly value={surfaceUrl} className="bg-transparent text-[10px] font-mono text-zinc-400 p-2 w-full outline-none" />
              <button
                onClick={() => { copyText(surfaceUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="px-3 hover:bg-zinc-800 text-zinc-500 hover:text-white border-l border-zinc-800 transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
