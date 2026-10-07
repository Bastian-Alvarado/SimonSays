/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who is on the couch and how the seats are arranged.
 *
 * The seats themselves are not here: names are typed on the Who's on screen, once,
 * and every layer that shows people reads that record. What is chosen here is
 * which of those people this layer is for, how many seats it keeps, and
 * whether the free ones are drawn.
 */
import React from 'react';
import { CommittedInput } from './CommittedInput';
import { rosterCapacity } from '../../shared/run.js';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}

/* Each with its translation keys; the English is what it falls back to. */
const WHO = [
  { value: 'commentators', label: 'Commentary', hint: 'The commentators, and nobody else.', key: 'rosterWhoCommentators' },
  { value: 'couch', label: 'Host + commentary', hint: 'The host takes the first seat.', key: 'rosterWhoCouch' },
  { value: 'everyone', label: 'The whole room', hint: 'Whoever is playing, then the host, then commentary.', key: 'rosterWhoEveryone' },
] as const;

export const RosterLayerPanel = ({ config, patch, t }: Props) => {
  const include = config.include || 'commentators';
  const most = rosterCapacity(include);
  const seats = Math.min(config.seats ?? 4, most);
  const columns = config.columns ?? 2;
  const chosen = WHO.find((w) => w.value === include);

  return (
    <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1.5">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {t.rosterWho || 'Who it seats'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {WHO.map((w) => (
            <button
              key={w.value}
              onClick={() => patch({ include: w.value })}
              className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${
                include === w.value
                  ? 'bg-current-accent/10 border-current-accent text-current-accent'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              {t[w.key] || w.label}
            </button>
          ))}
        </div>
        {chosen && <p className="text-[9px] text-zinc-600 leading-relaxed">{t[`${chosen.key}Hint`] || chosen.hint}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {t.rosterSeats || 'Seats'}
          </span>
          <input
            type="number" min={1} max={most} value={seats}
            onChange={(e) => patch({ seats: Math.min(most, Number(e.target.value)) })}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
          />
        </label>
        <label className="block">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {t.rosterColumns || 'Across'}
          </span>
          <input
            type="number" min={1} max={4} value={columns}
            onChange={(e) => patch({ columns: Number(e.target.value) })}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
          />
        </label>
      </div>

      {/*
        On by default, and the reason this is a layer rather than four plates:
        a plate with nobody in it hides itself, which leaves a hole where the
        fourth seat was and reads as something having broken.
      */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox" checked={config.showEmpty !== false}
          onChange={(e) => patch({ showEmpty: e.target.checked })}
          className="accent-current-accent"
        />
        <span className="text-[9px] text-zinc-400">
          {t.rosterShowEmpty || 'Draw the seats nobody is in yet'}
        </span>
      </label>

      {config.showEmpty !== false && (
        <label className="block">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {t.rosterEmptyText || 'What a free seat says'}
          </span>
          <CommittedInput
            value={config.emptyText || ''}
            placeholder="Press start"
            onCommit={(v: string) => patch({ emptyText: v })}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
          />
        </label>
      )}

      {/* The letter is worked out from the seat, so this only hides it. */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox" checked={config.showRole !== false}
          onChange={(e) => patch({ showRole: e.target.checked })}
          className="accent-current-accent"
        />
        <span className="text-[9px] text-zinc-400">
          {t.rosterShowRole || 'Mark each seat with its role'}
        </span>
      </label>
    </div>
  );
};
