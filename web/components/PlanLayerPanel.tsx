/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How much of the plan a layer puts on screen.
 *
 * The plan had no controls of its own until now: the modes existed, the server
 * validated them, and nothing could choose one — so every plan on every canvas
 * was whatever the default happened to be. These are those choices, and the
 * cap beside them, because how far the list looks ahead and how many lines it
 * is allowed are one decision made twice.
 */
import React from 'react';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}

const MODES = [
  { value: 'recap', label: 'Just finished + next', hint: 'The line you crossed off last, then what is left.' },
  { value: 'upcoming', label: 'What is left', hint: 'From the line you are on, looking forward only.' },
  { value: 'all', label: 'The whole list', hint: 'Everything, with finished lines kept or hidden on the plan screen.' },
  { value: 'current', label: 'Only now', hint: 'One line: what is happening.' },
] as const;

export const PlanLayerPanel = ({ config, patch, t }: Props) => {
  const mode = config.mode || 'recap';
  const limit = config.limit ?? 4;
  const chosen = MODES.find((m) => m.value === mode);

  return (
    <div className="space-y-2 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1.5">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {t.planShows || 'Shows'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => patch({ mode: m.value })}
              className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${
                mode === m.value
                  ? 'bg-current-accent/10 border-current-accent text-current-accent'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {chosen && <p className="text-[9px] text-zinc-600 leading-relaxed">{chosen.hint}</p>}
      </div>

      {/*
        Notes are written on the plan screen and drawn nowhere until this is
        on. Off by default, because a note is usually for the person running
        the stream rather than for the people watching it.
      */}
      <button
        onClick={() => patch({ showNotes: !config.showNotes })}
        className={`w-full px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${
          config.showNotes
            ? 'bg-current-accent/10 border-current-accent text-current-accent'
            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
        }`}
      >
        {t.planShowNotes || 'Show the notes'}
      </button>

      {/*
        Only worth offering once the notes are on: it is a choice about how a
        note is drawn, and there is nothing to draw until then.
      */}
      {config.showNotes && (
        <button
          onClick={() => patch({ notesOwnLine: !config.notesOwnLine })}
          className={`w-full px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${
            config.notesOwnLine
              ? 'bg-current-accent/10 border-current-accent text-current-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
          }`}
        >
          {t.planNotesOwnLine || 'Notes on their own line'}
        </button>
      )}

      {/*
        The cap counts every line drawn, the crossed-off one included, so the
        box stays the height it was told to be whether or not there is history
        to show. Meaningless for the two modes that already know their length.
      */}
      {(mode === 'recap' || mode === 'upcoming') && (
        <label className="block space-y-1" onClick={(e) => e.stopPropagation()}>
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {t.planLimit || 'Lines at most'} — {limit}
          </span>
          <input
            type="range" min={1} max={12} value={limit}
            onChange={(e) => patch({ limit: Number(e.target.value) })}
            className="w-full accent-current-accent"
          />
        </label>
      )}
    </div>
  );
};
