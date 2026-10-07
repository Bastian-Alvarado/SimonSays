/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Which omnibar the Omnibar screen is editing.
 *
 * Main is the bar every omnibar layer shows unless it names another, and the
 * one every slot made before there were other bars lives on, so it can be
 * neither renamed nor deleted. The others are whatever a scene needs that
 * Main does not say — each with its own slots — and a layer picks one on the
 * Overlays screen.
 *
 * New starts empty in Main's colours, since a second bar is usually the same
 * bar saying different things. Duplicate copies the one being edited, slots
 * and all, with every slot given a fresh id: an omnibar step keeps only a
 * slot's id, and two bars sharing one would leave "!bar" writing to whichever
 * the server happened to find first.
 */
import React from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { OmnibarBar, OmnibarConfig } from '../types';
import { CommittedInput } from './CommittedInput';

interface Props {
  main: OmnibarConfig | undefined;
  bars: OmnibarBar[];
  /** 'main', or the id of the bar being edited. */
  selected: string;
  onSelect: (id: string) => void;
  setOmnibars: (bars: OmnibarBar[]) => void;
  /** How many layers show each bar, so deleting one says what it would change. */
  usedBy: Record<string, number>;
  t: any;
}

export const MAX_OMNIBARS = 8;

const newBarId = () => `bar-${Math.random().toString(36).slice(2, 8)}`;
const newSlotId = () => `omni-${Math.random().toString(36).slice(2, 10)}`;

export const OmnibarBarPicker = ({ main, bars, selected, onSelect, setOmnibars, usedBy, t }: Props) => {
  const current = selected === 'main' ? null : bars.find((b) => b.id === selected) || null;
  const full = bars.length >= MAX_OMNIBARS;

  /*
    A tall bar starts at the height its cards are drawn for — two rows need
    room a one-line bar never did, and at the omnibar's 64px the detail row
    would be squeezed under the headline. Everything else, colours and logo
    included, comes from Main like any new bar.
  */
  const create = (kind: 'classic' | 'tall') => {
    const id = newBarId();
    setOmnibars([...bars, {
      ...(main as OmnibarConfig),
      id,
      kind,
      name: kind === 'tall'
        ? `${t.tallbarDefaultName || 'Tall bar'} ${bars.filter((b) => b.kind === 'tall').length + 1}`
        : `${t.omnibarBarDefaultName || 'Bar'} ${bars.length + 2}`,
      items: [],
      ...(kind === 'tall' ? { style: { ...(main?.style as any), height: 100 } } : {}),
    }]);
    onSelect(id);
  };

  const duplicate = () => {
    const source = current || main;
    if (!source) return;
    const id = newBarId();
    setOmnibars([...bars, {
      ...(source as OmnibarConfig),
      id,
      name: `${current?.name || t.omnibarBarMain || 'Main'} ${t.omnibarBarCopy || 'copy'}`.slice(0, 40),
      items: (source.items || []).map((item) => ({ ...item, id: newSlotId() })),
    }]);
    onSelect(id);
  };

  const rename = (name: string) => {
    if (!current) return;
    setOmnibars(bars.map((b) => (b.id === current.id ? { ...b, name } : b)));
  };

  const remove = () => {
    if (!current) return;
    const layers = usedBy[current.id] || 0;
    const message = layers
      ? (t.omnibarBarDeleteUsed || 'Delete "{name}"? {n} layer(s) show it, and will show Main instead.')
        .replace('{name}', current.name).replace('{n}', String(layers))
      : (t.omnibarBarDelete || 'Delete "{name}" and its slots?').replace('{name}', current.name);
    if (!window.confirm(message)) return;
    setOmnibars(bars.filter((b) => b.id !== current.id));
    onSelect('main');
  };

  const tab = (id: string, name: string, tall = false) => (
    <button
      key={id}
      onClick={() => onSelect(id)}
      data-omnibar-bar={id}
      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
        selected === id ? 'bg-current-accent text-white border-transparent shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
      }`}
    >
      {name}
      {/* The two kinds look alike as names, and draw nothing alike. */}
      {tall && <span className="px-1.5 py-0.5 rounded text-[7px] bg-black/30 border border-current/30" data-omnibar-bar-tall>{t.tallbarTag || 'Tall'}</span>}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4" data-omnibar-bars>
      {tab('main', t.omnibarBarMain || 'Main')}
      {bars.map((b) => tab(b.id, b.name, b.kind === 'tall'))}
      <button
        onClick={() => create('classic')}
        disabled={full}
        title={full ? (t.omnibarBarFull || 'That is as many bars as there can be') : undefined}
        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1.5"
      >
        <Plus size={12} /> {t.omnibarBarNew || 'New bar'}
      </button>
      <button
        onClick={() => create('tall')}
        disabled={full}
        title={full ? (t.omnibarBarFull || 'That is as many bars as there can be') : (t.tallbarNewHint || 'Each slot as a two-row card, like the bar along the bottom of a marathon')}
        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1.5"
        data-omnibar-new-tall
      >
        <Plus size={12} /> {t.tallbarNew || 'New tall bar'}
      </button>
      <button
        onClick={duplicate}
        disabled={full}
        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1.5"
      >
        <Copy size={12} /> {t.omnibarBarDuplicate || 'Duplicate'}
      </button>
      {current && (
        <div className="flex items-center gap-2 ml-auto">
          {/* Kept here until you leave the box: the server trims names, and
              saving each keystroke would strip the space before the next word. */}
          <CommittedInput
            key={current.id}
            value={current.name}
            onCommit={(next: string) => rename(next)}
            maxLength={40}
            aria-label={t.omnibarBarName || 'Bar name'}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-[11px] font-bold text-white outline-none focus:border-current-accent w-44"
          />
          <button
            onClick={remove}
            title={t.omnibarBarDeleteTitle || 'Delete this bar'}
            className="p-2 rounded-xl border border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500/40"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
