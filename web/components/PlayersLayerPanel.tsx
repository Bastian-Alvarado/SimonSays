/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How a players layer shows the list: how many to a page, in how many
 * columns, how long each page stays, and whether the players already out are
 * shown. The names themselves are on the Players screen.
 */
import React from 'react';
import { CommittedInput } from './CommittedInput';
import { AutoSwatch } from './AutoSwatch';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';

export const PlayersLayerPanel = ({ config, patch, t }: Props) => (
  <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
    <div className="grid grid-cols-3 gap-2">
      <label className="block">
        <span className={label}>{t.playersPerPage || 'Per page'}</span>
        <input
          type="number" min={1} max={24} value={config.perPage ?? 24}
          onChange={(e) => patch({ perPage: Number(e.target.value) })}
          className={field}
        />
      </label>
      <label className="block">
        <span className={label}>{t.playersColumns || 'Across'}</span>
        {/* 0 is automatic: the columns follow how many are on the page. */}
        <select value={config.columns ?? 0} onChange={(e) => patch({ columns: Number(e.target.value) })} className={field}>
          <option value={0}>{t.playersColumnsAuto || 'Auto'}</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="block">
        <span className={label}>{t.playersSeconds || 'Seconds a page'}</span>
        <input
          type="number" min={3} max={60} value={config.seconds ?? 8}
          onChange={(e) => patch({ seconds: Number(e.target.value) })}
          className={field}
        />
      </label>
    </div>
    <p className="text-[9px] text-zinc-600 leading-relaxed">
      {t.playersPagesHint || 'The list holds up to 50. When there are more than fit on a page, the pages take turns.'}
    </p>

    <label className="block">
      <span className={label}>{t.playersTitle || 'Title'}</span>
      <CommittedInput
        value={config.title || ''}
        placeholder={t.playersTitlePlaceholder || 'Optional — "Lobby", "Crew"'}
        onCommit={(v: string) => patch({ title: v })}
        className={field}
      />
    </label>

    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={config.onlyIn === true} onChange={(e) => patch({ onlyIn: e.target.checked })} className="accent-current-accent" />
      <span className="text-[9px] text-zinc-400">{t.playersOnlyIn || 'Only show players still in'}</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={config.showState !== false} onChange={(e) => patch({ showState: e.target.checked })} className="accent-current-accent" />
      <span className="text-[9px] text-zinc-400">{t.playersShowState || 'Say why a player is out (Out, Ejected, Dead)'}</span>
    </label>

    {/*
      Automatic when empty: the look's, or white on see-through black. A
      background picked here keeps the see-through, the same as it always has.
    */}
    <div className="flex flex-wrap items-center gap-3">
      {(['textColor', 'background'] as const).map((key) => (
        <AutoSwatch
          key={key}
          name={key}
          label={key === 'textColor' ? (t.playersText || 'Text') : (t.playersBackground || 'Background')}
          value={config[key]}
          fallback={key === 'textColor' ? '#ffffff' : '#09090b'}
          onChange={(v) => patch({ [key]: key === 'background' ? `${v}cc` : v })}
          onClear={() => patch({ [key]: '' })}
          t={t}
        />
      ))}
    </div>
  </div>
);
