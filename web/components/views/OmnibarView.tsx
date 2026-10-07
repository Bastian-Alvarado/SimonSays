/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Omnibar setup: what the bar says, in what order, and how it looks.
 *
 * Its own screen rather than a section of the chat dock, because it is an
 * overlay most people will never switch on — and the ones who do want to sit
 * and arrange it, which is a different job from adjusting a font size.
 *
 * Everything here is server state: the bar in OBS and this editor have to
 * agree, and they are frequently not the same machine.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap } from '../../../shared/list-order.js';
import { OmnibarConfig, OmnibarItem, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { Omnibar, OMNIBAR_OWN } from '../Omnibar';
import { AutoColourRow } from '../AutoSwatch';
import { TallOmnibar } from '../TallOmnibar';
import { SOURCES as GOAL_SOURCES } from '../GoalLayerPanel';
import { OmnibarLogoPanel } from '../OmnibarLogoPanel';
import {
  Check, Copy, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Radio, ExternalLink, Pause, Pin, PinOff,
} from 'lucide-react';
import { copyText } from '../../utils';

interface OmnibarViewProps {
  config: OmnibarConfig | undefined;
  /** Which bar this is, when it is not Main, so its browser source link names it. */
  barId?: string;
  /** The counts the server keeps, so a goal slot previews its real number. */
  stats?: Record<string, any>;
  setOmnibar: (config: OmnibarConfig) => void;
  tags: any;
  leaderboard: any[];
  track: any;
  upNext?: any;
  countdown?: any;
  commands?: any[];
  subscribers?: any[];
  events?: any[];
  /** The uploaded files, for choosing a logo from. */
  listAssets?: () => Promise<any[]>;
  uploadAsset?: (file: File) => Promise<any>;
  activeTheme: ThemeConfig;
  t: any;
}

const DEFAULTS: OmnibarConfig = {
  enabled: false,
  items: [],
  defaultSeconds: 12,
  style: {
    // The colours start automatic: the look's, or the bar's own (OMNIBAR_OWN).
    // No settingsVersion here — the server stamps it, and a default here
    // would mark an old bar's defaults as chosen on its first save.
    position: 'bottom', height: 64, background: '', textColor: '',
    accentColor: '', fontSize: 22, uppercase: true, transition: 'slide',
  },
};

/** The slot types, in the order they are offered. */
const TYPES: { type: OmnibarItem['type']; label: string; hint: string }[] = [
  { type: 'text', label: 'omnibarTypeText', hint: 'omnibarTypeTextHint' },
  { type: 'latestFollower', label: 'omnibarTypeFollower', hint: 'omnibarTypeAutoHint' },
  { type: 'latestSubscriber', label: 'omnibarTypeSubscriber', hint: 'omnibarTypeAutoHint' },
  { type: 'latestDonation', label: 'omnibarTypeDonation', hint: 'omnibarTypeAutoHint' },
  { type: 'topDonation', label: 'omnibarTypeTopDonation', hint: 'omnibarTypeAutoHint' },
  { type: 'latestRaid', label: 'omnibarTypeRaid', hint: 'omnibarTypeAutoHint' },
  { type: 'nowPlaying', label: 'omnibarTypeNowPlaying', hint: 'omnibarTypeSpotifyHint' },
  { type: 'upNext', label: 'omnibarTypeUpNext', hint: 'omnibarTypeUpNextHint' },
  { type: 'countdown', label: 'omnibarTypeCountdown', hint: 'omnibarTypeCountdownHint' },
  { type: 'commands', label: 'omnibarTypeCommands', hint: 'omnibarTypeCommandsHint' },
  { type: 'topChatters', label: 'omnibarTypeTopChatters', hint: 'omnibarTypeAutoHint' },
  { type: 'topSubscribers', label: 'omnibarTypeTopSubs', hint: 'omnibarTypeTopSubsHint' },
  { type: 'recentEvents', label: 'omnibarTypeRecent', hint: 'omnibarTypeRecentHint' },
  { type: 'goal', label: 'omnibarTypeGoal', hint: 'omnibarTypeGoalHint' },
];

export const OmnibarView: React.FC<OmnibarViewProps> = ({
  config, barId, stats, setOmnibar, tags, leaderboard, track, upNext, countdown, commands, subscribers, events, listAssets, uploadAsset, activeTheme, t,
}) => {
  const cfg: OmnibarConfig = { ...DEFAULTS, ...(config || {}), style: { ...DEFAULTS.style, ...(config?.style || {}) } };
  const [editing, setEditing] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Text fields edit a local copy, not the saved value.
   *
   * Everything on this screen is server state, and a field bound straight to it
   * makes every keystroke a round trip: send the whole config, wait for the
   * server to validate and store it, wait for the broadcast to come back, then
   * finally show the character. Measured at ~29ms to the phone over wifi with
   * spikes past 70ms — which is exactly the "it keeps fighting me" feeling — and
   * each of those keystrokes also pushed a config update to every connected
   * surface, the live overlay included.
   *
   * The draft is what the inputs show and what the preview renders; it is sent
   * once typing pauses, and again on the way out so nothing is lost.
   */
  const [draft, setDraft] = useState<{ index: number; item: OmnibarItem } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = (next: Partial<OmnibarConfig>) => setOmnibar({ ...cfg, ...next });
  const patchStyle = (next: Partial<OmnibarConfig['style']>) => patch({ style: { ...cfg.style, ...next } });

  /**
   * The saved list with whatever the open row is holding folded in.
   *
   * Anything that changes the list has to start from this rather than from
   * the saved list alone, because the open row keeps a copy of its slot and
   * writes that copy back when it closes. Three controls started from the
   * saved list and were quietly undone by it:
   *
   * - Pinning, or switching a slot on or off, while its row was open: the
   *   copy predated the change, so closing the row put it back. Reported as
   *   the pin turning itself off the moment you clicked away.
   * - Moving an open row: the copy remembered the position the slot had
   *   left, so closing wrote it back there — over whichever slot had moved
   *   into it. Measured: Raised, Next, Donate, Incentive became Raised,
   *   Donate, Donate, Incentive. One slot doubled, its neighbour gone.
   * - Deleting any row while another was open threw away the open one's
   *   unsaved typing along with the timer that would have saved it.
   */
  const current = () => cfg.items.map((item, i) => (draft && i === draft.index ? draft.item : item));

  /** Save a list, and keep the open row's copy agreeing with what was saved. */
  const saveItems = (items: OmnibarItem[], openAt: number | null) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    patch({ items });
    setDraft(openAt === null || !items[openAt] ? null : { index: openAt, item: { ...items[openAt] } });
  };

  const setItem = (index: number, next: Partial<OmnibarItem>) => {
    const items = current().map((item, i) => (i === index ? { ...item, ...next } : item));
    saveItems(items, draft ? draft.index : null);
  };

  const commitDraft = (d: { index: number; item: OmnibarItem } | null) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (!d) return;
    const items = cfg.items.map((item, i) => (i === d.index ? d.item : item));
    patch({ items });
  };

  /** Open a row for editing, saving whatever the last one had pending. */
  const openEditor = (index: number | null) => {
    if (draft && draft.index !== index) commitDraft(draft);
    setEditing(index);
    setDraft(index === null || !cfg.items[index] ? null : { index, item: { ...cfg.items[index] } });
  };

  const editField = (next: Partial<OmnibarItem>) => {
    const index = editing;
    if (index === null) return;

    setDraft((prev) => {
      // A draft may not exist yet: adding a slot opens its editor in the same
      // render the item is created in, so there was nothing to copy from at
      // that point. Starting one from the saved item here means the first
      // keystroke after adding a slot is not swallowed.
      const base = prev && prev.index === index ? prev.item : cfg.items[index];
      if (!base) return prev;

      const updated = { index, item: { ...base, ...next } };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => commitDraft(updated), 400);
      return updated;
    });
  };

  // A pending edit must not be lost by navigating away mid-sentence.
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const addItem = (type: OmnibarItem['type']) => {
    const item: OmnibarItem = {
      id: `omni-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      type, enabled: true, pinned: false, name: '', label: '', text: '', seconds: null, commandIds: [], commandsAllTriggers: false, topCount: 3,
      ...(type === 'goal' ? { goalSource: 'followers', goalTarget: 100, goalValue: 0, goalShow: 'remaining', goalPrefix: '' } : {}),
    };
    /*
      One save, from the list with the open row folded in. This used to save
      the new slot and then open its editor — and opening an editor saves the
      row that was open before, from a list that did not have the new slot in
      it yet. With any row open, a new message slot was added and removed in
      the same click. Measured: four slots before, four after.
    */
    const items = [...current(), item];
    const setUp = type === 'text' || type === 'goal';
    const opens = setUp ? items.length - 1 : (draft ? draft.index : null);
    saveItems(items, opens);
    if (setUp) setEditing(items.length - 1);
  };

  const move = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= cfg.items.length) return;
    const items = [...current()];
    [items[index], items[target]] = [items[target], items[index]];
    // The open copy follows the slot to where it went, not where it was.
    saveItems(items, target);
    setEditing(target);
  };

  /* Dragged by its grip: the open row stays open, wherever it ends up. */
  const itemOrder = useDragOrder(({ from, gap }) => {
    const list = current();
    const items = moveToGap(list, from, gap);
    if (items === list) return;
    const openId = editing === null ? null : list[editing]?.id;
    const opens = openId ? items.findIndex((item) => item.id === openId) : -1;
    saveItems(items, opens >= 0 ? opens : null);
    setEditing(opens >= 0 ? opens : null);
  });

  // What the preview renders: the saved config with the unsaved edit folded in.
  const previewCfg: OmnibarConfig = draft
    ? { ...cfg, items: cfg.items.map((item, i) => (i === draft.index ? draft.item : item)) }
    : cfg;

  const overlayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?mode=omnibar${barId ? `&bar=${encodeURIComponent(barId)}` : ''}`
    : '';

  const copyUrl = () => {
    copyText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const typeLabel = (type: string) => {
    const found = TYPES.find((x) => x.type === type);
    return found ? (t[found.label] || found.type) : type;
  };

  return (
    <div className="animate-fade-in space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
        
        <button
          onClick={() => patch({ enabled: !cfg.enabled })}
          className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 shrink-0 ${
            cfg.enabled ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}
        >
          <Radio size={14} /> {cfg.enabled ? t.omnibarOn : t.omnibarOff}
        </button>
      </div>

      {/* The preview is the same component the overlay uses, so what is here is
          literally what goes on stream. */}
      <div className={`glass-panel rounded-3xl border ${activeTheme.borderClass} overflow-hidden`}>
        <div
          className="relative flex items-end"
          style={{
            minHeight: 190,
            backgroundImage: 'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            backgroundColor: '#09090b',
          }}
        >
          <div className={`absolute inset-x-0 ${cfg.style.position === 'top' ? 'top-0' : 'bottom-0'}`}>
            {/* Holding on the item being edited, so it does not rotate away mid-edit. */}
            {/* The preview is the bar being edited, drawn the way its kind draws it. */}
            {React.createElement((cfg.kind === 'tall' ? TallOmnibar : Omnibar) as any, { config: previewCfg, stats, tags, leaderboard, track, upNext, countdown, commands, subscribers, events, frozenIndex: editing, t })}
          </div>
          {editing !== null && (
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 flex items-center gap-2">
              <Pause size={10} className="text-current-accent" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">{t.omnibarPaused}</span>
            </div>
          )}
          {!cfg.enabled && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{t.omnibarOffHint}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------------------------------------------------------- items */}
        <div ref={itemOrder.listRef} className={`relative lg:col-span-2 space-y-4 ${itemOrder.held ? 'select-none' : ''}`}>
          {itemOrder.line}
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarItems}</h3>
            <span className="text-[10px] text-zinc-600">{cfg.items.length}</span>
          </div>

          {cfg.items.length === 0 && (
            <p className="text-xs text-zinc-500 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center">
              {t.omnibarEmpty}
            </p>
          )}

          {cfg.items.map((item, index) => (
            <div
              key={item.id}
              {...itemOrder.row(item.id)}
              className={`rounded-2xl border transition-all ${
                editing === index ? 'border-current-accent bg-current-accent/5' : 'border-zinc-800 bg-zinc-900/40'
              } ${itemOrder.held === item.id ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center gap-2 p-3">
                <DragGrip grip={itemOrder.grip(item.id)} title={t.omnibarItemDrag || 'Drag to change its place in the rotation'} className="-m-1" />
                <button onClick={() => openEditor(editing === index ? null : index)} className="flex-1 text-left min-w-0">
                  <div className="text-xs font-black uppercase tracking-tight text-zinc-200 truncate">
                    {item.name || item.label || typeLabel(item.type)}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">
                    {item.type === 'text' ? (item.text || t.omnibarNoText) : typeLabel(item.type)}
                    {' · '}
                    {/* A pinned slot has no turn, so a duration would be a lie. */}
                    {item.pinned ? t.omnibarPinned : (item.seconds ? `${item.seconds}s` : `${cfg.defaultSeconds}s`)}
                  </div>
                </button>
                <button
                  onClick={() => setItem(index, { pinned: !item.pinned })}
                  title={t.omnibarPinItem}
                  className={`p-2 rounded-lg transition-colors ${item.pinned ? 'text-current-accent' : 'text-zinc-600'}`}
                >
                  {item.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                </button>
                <button
                  onClick={() => setItem(index, { enabled: !item.enabled })}
                  title={t.omnibarToggleItem}
                  className={`p-2 rounded-lg transition-colors ${item.enabled ? 'text-current-accent' : 'text-zinc-600'}`}
                >
                  {item.enabled ? <Check size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => move(index, -1)} className="p-2 rounded-lg text-zinc-500 hover:text-white"><ArrowUp size={14} /></button>
                <button onClick={() => move(index, 1)} className="p-2 rounded-lg text-zinc-500 hover:text-white"><ArrowDown size={14} /></button>
                <button
                  onClick={() => { saveItems(current().filter((_, i) => i !== index), null); setEditing(null); }}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {editing === index && (
                <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60 pt-3">
                  {item.type === 'text' && (
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">{t.omnibarText}</label>
                      <input
                        value={(draft && draft.index === index ? draft.item.text : item.text) || ''}
                        onChange={(e) => editField({ text: e.target.value })}
                        placeholder={t.omnibarTextPlaceholder}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent"
                      />
                    </div>
                  )}
                  {cfg.kind === 'tall' && (
                    <div className="grid grid-cols-1 gap-3" data-tallbar-fields>
                      {item.type === 'text' && (
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">{t.tallbarDetail || 'Second line'}</label>
                          <input
                            value={(draft && draft.index === index ? draft.item.detail : item.detail) || ''}
                            onChange={(e) => editField({ detail: e.target.value })}
                            placeholder={t.tallbarDetailPlaceholder || 'Under the message, smaller'}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">{t.tallbarSublabel || 'Under the label'}</label>
                        <input
                          value={(draft && draft.index === index ? draft.item.sublabel : item.sublabel) || ''}
                          onChange={(e) => editField({ sublabel: e.target.value })}
                          placeholder={t.tallbarSublabelPlaceholder || 'Donate now!'}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent"
                        />
                        <p className="text-[9px] text-zinc-600 mt-1">{t.tallbarSublabelHint || 'A small line in the box beside the card. On a pinned slot it is the caption under the big figure.'}</p>
                      </div>
                    </div>
                  )}
                  {item.type === 'goal' && (() => {
                    const g: any = draft && draft.index === index ? draft.item : item;
                    const field = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent";
                    const head = "text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block";
                    return (
                      <div className="space-y-3" data-goal-fields>
                        <div>
                          <label className={head}>{t.omnibarGoalFor || 'What it is for'}</label>
                          <input value={g.text || ''} onChange={(e) => editField({ text: e.target.value })} placeholder={t.omnibarGoalForPlaceholder || 'Upgrade to No Dupes'} className={field} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={head}>{t.omnibarGoalSource || 'Counts'}</label>
                            <select value={g.goalSource || 'followers'} onChange={(e) => editField({ goalSource: e.target.value as any })} className={field}>
                              {GOAL_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={head}>{t.omnibarGoalTarget || 'Target'}</label>
                            <input type="number" min={1} value={g.goalTarget ?? 100} onChange={(e) => editField({ goalTarget: Number(e.target.value) || 1 })} className={field} />
                          </div>
                        </div>
                        {(g.goalSource || 'followers') === 'manual' && (
                          <div>
                            <label className={head}>{t.omnibarGoalValue || 'Where it is now'}</label>
                            <input type="number" min={0} value={g.goalValue ?? 0} onChange={(e) => editField({ goalValue: Number(e.target.value) || 0 })} className={field} />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={head}>{t.omnibarGoalShow || 'Show'}</label>
                            <select value={g.goalShow || 'remaining'} onChange={(e) => editField({ goalShow: e.target.value as any })} className={field}>
                              <option value="remaining">{t.omnibarGoalShowRemaining || 'What is left to go'}</option>
                              <option value="percent">{t.omnibarGoalShowPercent || 'How far along, in %'}</option>
                            </select>
                          </div>
                          <div>
                            <label className={head}>{t.omnibarGoalPrefix || 'Before each number'}</label>
                            <input value={g.goalPrefix || ''} maxLength={4} onChange={(e) => editField({ goalPrefix: e.target.value })} placeholder="$" className={field} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {item.type === 'commands' && (() => {
                    const picked: string[] = (draft && draft.index === index ? draft.item.commandIds : item.commandIds) || [];
                    const toggle = (id: string) => editField({
                      commandIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id],
                    });
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarCommandsPick}</label>
                          {picked.length > 0 && (
                            <button
                              onClick={() => editField({ commandIds: [] })}
                              className="text-[9px] font-bold text-zinc-500 hover:text-current-accent transition-colors"
                            >
                              {t.omnibarCommandsAll}
                            </button>
                          )}
                        </div>

                        <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-900">
                          {(commands || []).length === 0 && (
                            <p className="text-[10px] text-zinc-600 px-3 py-3">{t.omnibarCommandsNone}</p>
                          )}
                          {(commands || []).map((c: any) => {
                            const on = picked.includes(c.id);
                            // Said plainly rather than hidden: a disabled command
                            // cannot run, and a subs-only one will refuse most of
                            // chat. Both are still selectable — it is your bar.
                            const note = c.enabled === false
                              ? t.omnibarCommandsDisabled
                              : (!c.permissions?.anyone ? t.omnibarCommandsRestricted : '');
                            return (
                              <button
                                key={c.id}
                                onClick={() => toggle(c.id)}
                                className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${on ? 'bg-current-accent/10' : 'hover:bg-zinc-900'}`}
                              >
                                <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${on ? 'bg-current-accent border-current-accent' : 'border-zinc-700'}`}>
                                  {on && <Check size={10} className="text-white" />}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-300 truncate">{c.name}</span>
                                <span className="text-[10px] font-mono text-zinc-500 truncate flex-1">{(c.triggers || []).join(' ')}</span>
                                {note && <span className="text-[8px] font-black uppercase tracking-widest text-amber-600/80 shrink-0">{note}</span>}
                              </button>
                            );
                          })}
                        </div>

                        <p className="text-[9px] text-zinc-600 mt-1">
                          {picked.length === 0 ? t.omnibarCommandsAllHint : `${picked.length} ${t.omnibarCommandsPicked}`}
                        </p>

                        {(() => {
                          const allTriggers = Boolean(draft && draft.index === index
                            ? draft.item.commandsAllTriggers
                            : item.commandsAllTriggers);
                          return (
                            <button
                              onClick={() => editField({ commandsAllTriggers: !allTriggers })}
                              className={`w-full mt-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                                allTriggers ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                              }`}
                            >
                              <span>{t.omnibarCommandsVariants}</span>
                              {allTriggers ? <Check size={14} /> : <EyeOff size={14} />}
                            </button>
                          );
                        })()}
                        <p className="text-[9px] text-zinc-600 mt-1">{t.omnibarCommandsVariantsHint}</p>
                      </div>
                    );
                  })()}

                  {(item.type === 'topChatters' || item.type === 'topSubscribers' || item.type === 'recentEvents') && (() => {
                    const count = (draft && draft.index === index ? draft.item.topCount : item.topCount) || 3;
                    return (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{item.type === 'recentEvents' ? t.omnibarEventCount : t.omnibarTopCount}</label>
                          <span className="text-[10px] font-black font-mono text-current-accent">{count}</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={count}
                          onChange={(e) => editField({ topCount: Number(e.target.value) })}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent"
                        />
                        <p className="text-[9px] text-zinc-600 mt-1">{t.omnibarTopCountHint}</p>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">{t.omnibarName}</label>
                    <input
                      value={(draft && draft.index === index ? draft.item.name : item.name) || ''}
                      onChange={(e) => editField({ name: e.target.value })}
                      placeholder={typeLabel(item.type)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent"
                    />
                    <p className="text-[9px] text-zinc-600 mt-1">{t.omnibarNameHint}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">{t.omnibarLabel}</label>
                      <input
                        value={(draft && draft.index === index ? draft.item.label : item.label) || ''}
                        onChange={(e) => editField({ label: e.target.value })}
                        placeholder={typeLabel(item.type)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">{t.omnibarSeconds}</label>
                      <input
                        type="number"
                        min={3}
                        max={120}
                        disabled={item.pinned === true}
                        value={(draft && draft.index === index ? draft.item.seconds : item.seconds) ?? ''}
                        onChange={(e) => editField({ seconds: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder={String(cfg.defaultSeconds)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-current-accent disabled:opacity-40"
                      />
                    </div>
                  </div>
                  {/*
                    Pinning is also an icon up in the row, which is where
                    somebody who already knows about it will reach for it —
                    and nowhere anybody would ever learn about it. A row of
                    small grey glyphs with tooltips is a set of shortcuts, not
                    an inventory of what a slot can do. Said properly here,
                    with the reason the field above it is dead.
                  */}
                  <button
                    onClick={() => setItem(index, { pinned: !item.pinned })}
                    className={`w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                      item.pinned ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <span>{t.omnibarPinItem}</span>
                    {item.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                  </button>
                  <p className="text-[9px] text-zinc-600 -mt-1">
                    {item.pinned ? t.omnibarPinnedHint : t.omnibarPinHint}
                  </p>
                  <p className="text-[9px] text-zinc-600">{t[TYPES.find((x) => x.type === item.type)?.hint || 'omnibarTypeAutoHint']}</p>
                </div>
              )}
            </div>
          ))}

          <div className="pt-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{t.omnibarAdd}</h3>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => addItem(type)}
                  className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-current-accent hover:text-current-accent transition-all flex items-center gap-1.5"
                >
                  <Plus size={12} /> {t[label] || type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------- style */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarStyle}</h3>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex gap-2">
              {(['bottom', 'top'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => patchStyle({ position: pos })}
                  className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    cfg.style.position === pos ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  {pos === 'bottom' ? t.omnibarBottom : t.omnibarTop}
                </button>
              ))}
            </div>

            <OmnibarLogoPanel
              logo={cfg.style.logo || ''}
              size={cfg.style.logoSize ?? 70}
              patchStyle={patchStyle}
              listAssets={listAssets}
              uploadAsset={uploadAsset}
              t={t}
            />

            {([
              ['height', t.omnibarHeight, 32, 200],
              ['fontSize', t.omnibarFontSize, 10, 72],
            ] as const).map(([key, label, min, max]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</label>
                  <span className="text-[10px] font-black font-mono text-current-accent">{(cfg.style as any)[key]}px</span>
                </div>
                <input
                  type="range" min={min} max={max}
                  value={(cfg.style as any)[key]}
                  onChange={(e) => patchStyle({ [key]: Number(e.target.value) } as any)}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent"
                />
              </div>
            ))}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarDefaultSeconds}</label>
                <span className="text-[10px] font-black font-mono text-current-accent">{cfg.defaultSeconds}s</span>
              </div>
              <input
                type="range" min={3} max={60}
                value={cfg.defaultSeconds}
                onChange={(e) => patch({ defaultSeconds: Number(e.target.value) })}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent"
              />
            </div>

            {([
              ['background', t.omnibarBackground, OMNIBAR_OWN.background],
              ['textColor', t.omnibarTextColor, OMNIBAR_OWN.text],
              ['accentColor', t.omnibarAccentColor, OMNIBAR_OWN.accent],
            ] as const).map(([key, label, own]) => (
              /*
                Each colour, or automatic: left empty, a look on the bar
                decides it, and without one the bar's own shows. Picking one
                makes it yours, over any look; the cross hands it back. The
                background is dimmed rather than hidden while the bar is
                transparent, so it is obvious the colour will come back.
              */
              <AutoColourRow
                key={key}
                name={key}
                label={label}
                value={(cfg.style as any)[key]}
                fallback={own}
                onChange={(v) => patchStyle({ [key]: v } as any)}
                onClear={() => patchStyle({ [key]: '' } as any)}
                muted={key === 'background' && cfg.style.transparent}
                t={t}
              />
            ))}

            <button
              onClick={() => patchStyle({ transparent: !cfg.style.transparent })}
              className={`w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                cfg.style.transparent ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span>{t.omnibarTransparent}</span>
              {cfg.style.transparent ? <Check size={14} /> : <EyeOff size={14} />}
            </button>

            <button
              onClick={() => patchStyle({ uppercase: !cfg.style.uppercase })}
              className={`w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                cfg.style.uppercase ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span>{t.omnibarUppercase}</span>
              {cfg.style.uppercase ? <Check size={14} /> : <EyeOff size={14} />}
            </button>

            <button
              onClick={() => patchStyle({ scroll: !cfg.style.scroll })}
              className={`w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                cfg.style.scroll ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span>{t.omnibarScroll}</span>
              {cfg.style.scroll ? <Check size={14} /> : <EyeOff size={14} />}
            </button>
            <p className="text-[9px] text-zinc-600 -mt-1">{t.omnibarScrollHint}</p>

            <div className="flex gap-2">
              {(['slide', 'fade', 'none'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => patchStyle({ transition: mode })}
                  className={`flex-1 px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                    cfg.style.transition === mode ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  {mode === 'slide' ? t.omnibarSlide : mode === 'fade' ? t.omnibarFade : t.omnibarNoAnim}
                </button>
              ))}
            </div>
            {/*
              These three used to decide only how a slot arrived, and now
              decide how the one it replaces goes as well — along with whether
              a slot points at itself when its words change without it moving.
              Neither has a switch of its own, so this is the only place
              anybody would find out either exists.
            */}
            <p className="text-[9px] text-zinc-600 -mt-1">{t.omnibarTransitionHint}</p>
          </div>

          {/* The browser source URL, next to the thing it shows. */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t.omnibarUrl}</label>
            <code className="text-[10px] text-current-accent font-mono break-all block mb-3">{overlayUrl}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" icon={<Copy size={12} />} onClick={copyUrl}>
                {copied ? t.copied : t.copyIt}
              </Button>
              <Button
                size="sm" variant="outline" className="flex-1" icon={<ExternalLink size={12} />}
                onClick={() => window.open(overlayUrl, '_blank', 'width=1280,height=140')}
              >
                {t.popout}
              </Button>
            </div>
            <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed">{t.omnibarUrlHint}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
