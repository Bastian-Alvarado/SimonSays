/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Saved setups for the one clock.
 *
 * There is still a single countdown — two running at once would be two numbers
 * each claiming to be how long until the stream starts. What repeats is the
 * configuration: "starting soon" is five minutes with one label and one
 * colour, "intermission" is fifteen with another.
 *
 * Saving is explicit, and so is updating. Writing every edit straight through
 * to whichever row is active sounds friendlier and is not: the second thing
 * anyone does is set up a second timer, which means typing new values over the
 * top of the first one — and that would quietly destroy it. A tweak that was
 * not saved can be made again; a saved timer that is gone cannot.
 *
 * So a row that no longer matches what is set up says so, with the button that
 * fixes it right there.
 */
import React, { useState } from 'react';
import { Check, Plus, Save, Trash2, Timer } from 'lucide-react';
import { CommittedInput } from './CommittedInput';
import { fill } from '../words';

/**
 * As many saved setups as anyone could tell apart at a glance.
 *
 * Mirrors MAX_PRESETS on the server, which is the one that actually refuses.
 * This only decides when to stop offering the button, so that the refusal is
 * never the way somebody finds out.
 */
export const MAX_TIMERS = 12;

export interface TimerPreset {
  id: string;
  name: string;
  durationMs: number;
  label: string;
  style?: Record<string, any>;
}

interface Props {
  presets: TimerPreset[];
  activeId: string;
  /** What is set up right now, to compare a saved row against. */
  live: { durationMs?: number; label?: string; style?: Record<string, any> };
  control: (op: string, value?: any) => void;
  max: number;
  t: any;
}

const minutes = (ms: number) => {
  const total = Math.round((ms || 0) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`;
};

/** Whether the live clock still matches the row it came from. */
const matches = (preset: TimerPreset, live: Props['live']) =>
  preset.durationMs === live.durationMs
  && (preset.label || '') === (live.label || '')
  && JSON.stringify(preset.style || {}) === JSON.stringify(live.style || {});

export const SavedTimers = ({ presets, activeId, live, control, max, t }: Props) => {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const active = presets.find((p) => p.id === activeId);
  const changed = Boolean(active) && !matches(active as TimerPreset, live);

  const save = () => {
    control('savePreset', name.trim() || undefined);
    setName('');
    setNaming(false);
  };

  return (
    <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Timer size={14} className="text-current-accent" />
        <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-zinc-400">
          {t.savedTimers || 'Saved timers'}
        </span>
        {changed && (
          <button
            onClick={() => control('updatePreset')}
            title={t.updateTimerHint || 'Save these settings into the selected timer'}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border bg-current-accent/10 border-current-accent text-current-accent"
          >
            <Save size={10} /> {t.updateTimer || 'Save changes'}
          </button>
        )}
      </div>

      {presets.length === 0 && (
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {t.noTimers || 'Nothing saved yet. Set the clock up below, then save it as a timer you can pick again.'}
        </p>
      )}

      <div className="space-y-1.5">
        {presets.map((p) => {
          const isActive = p.id === activeId;
          return (
            <div
              key={p.id}
              onClick={() => !isActive && control('loadPreset', p.id)}
              className={`rounded-xl border p-2.5 flex items-center gap-2 transition-all ${
                isActive
                  ? 'border-current-accent bg-current-accent/10'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 cursor-pointer'
              }`}
            >
              {isActive
                ? <Check size={13} className="text-current-accent shrink-0" />
                : <span className="w-[13px] shrink-0" />}

              {/*
                The name is editable in place. Renaming is the only thing you do
                to a saved timer that is not loading it, and a separate screen
                for one text field would be a screen nobody opens.

                But only on the one loaded. The name is most of a row, so it is
                where people click to pick a timer — and when every name was a
                text box, that click started renaming it instead of loading it.
              */}
              {isActive ? (
                <CommittedInput
                  value={p.name}
                  onCommit={(next: string) => control('renamePreset', { id: p.id, name: next })}
                  onClick={(e: any) => e.stopPropagation()}
                  title={t.timerRenameHint || 'Rename it'}
                  className="flex-1 min-w-0 bg-transparent border border-transparent hover:border-zinc-800 focus:border-current-accent rounded px-1.5 py-0.5 text-[11px] font-bold text-zinc-200 outline-none"
                />
              ) : (
                <span className="flex-1 min-w-0 truncate px-1.5 py-0.5 border border-transparent text-[11px] font-bold text-zinc-400">{p.name}</span>
              )}

              <span className="text-[10px] font-mono text-zinc-500 shrink-0">{minutes(p.durationMs)}</span>
              {Boolean(p.label) && (
                <span className="text-[9px] text-zinc-600 truncate max-w-[10rem] shrink-0">{p.label}</span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Asked first, as forgetting a regular or a crew is: a saved timer that is gone cannot be picked again.
                  if (window.confirm(fill(t.timerDeleteConfirm || 'Delete the saved timer “{name}”?', { name: p.name }))) control('deletePreset', p.id);
                }}
                title={t.remove || 'Remove'}
                className="p-1 text-zinc-600 hover:text-rose-500 shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {presets.length < max && (
        naming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              placeholder={t.timerName || 'Starting soon'}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setNaming(false); setName(''); } }}
              className="flex-1 min-w-0 bg-zinc-950/60 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent"
            />
            <button
              onClick={save}
              className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-current-accent/10 border-current-accent text-current-accent"
            >
              {t.save || 'Save'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNaming(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700"
          >
            <Plus size={12} /> {t.saveTimer || 'Save this as a timer'}
          </button>
        )
      )}
    </div>
  );
};
