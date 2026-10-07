/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How the run card looks.
 *
 * Only how it looks. What it says is on the Game screen, because it is one
 * record for the whole app — the point of that record is that changing the
 * game changes every layout at once, and a copy of the title per card would
 * undo it.
 */
import React from 'react';
import { AccentSwatch } from './AccentSwatch';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  /** The canvas accent, so an unset accent previews what it is following. */
  accent?: string;
  t: any;
}

const Toggle = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
      on ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
    }`}
  >
    {label}
  </button>
);

export const RunCardPanel = ({ config, patch, accent, t }: Props) => (
  <div className="space-y-2 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
    <p className="text-[9px] text-zinc-600 leading-relaxed">
      {t.runCardHint || 'The title, platform, category and estimate come from the Game screen.'}
    </p>

    <div className="grid grid-cols-3 gap-1.5">
      {(['left', 'center', 'right'] as const).map((a) => (
        <button
          key={a}
          onClick={() => patch({ align: a })}
          className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
            (config.align || 'center') === a
              ? 'bg-current-accent/10 border-current-accent text-current-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}
        >
          {a}
        </button>
      ))}
    </div>

    <div className="grid grid-cols-2 gap-1.5">
      {([['titleSize', t.titleSize || 'Title', 34], ['detailSize', t.detailSize || 'Details', 16]] as const).map(
        ([field, label, def]) => (
          <label key={field} className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
            <input
              type="number"
              value={config[field] ?? def}
              onChange={(e) => patch({ [field]: Number(e.target.value) || def })}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-300 outline-none focus:border-current-accent"
            />
          </label>
        ),
      )}
    </div>

    <div className="flex items-center gap-2 flex-wrap">
      <AccentSwatch
        label={t.accent || 'Accent'}
        value={config.accentColor}
        fallback={accent || '#f43f5e'}
        onChange={(v: string) => patch({ accentColor: v })}
        onClear={() => patch({ accentColor: '' })}
        t={t}
        unsetTitle={t.runcardAccentFollows || 'Automatic — the look\'s accent, or the canvas accent without one'}
      />
      {/* The edge is the thing that makes it read as a marathon card. */}
      <Toggle on={config.showEdge !== false} label={t.edge || 'Edge'} onClick={() => patch({ showEdge: config.showEdge === false })} />
      <Toggle
        on={config.showCategory !== false}
        label={t.category || 'Category'}
        onClick={() => patch({ showCategory: config.showCategory === false })}
      />
      <Toggle
        on={config.showEstimate !== false}
        label={t.estimate || 'Estimate'}
        onClick={() => patch({ showEstimate: config.showEstimate === false })}
      />
    </div>

    {config.showEstimate !== false && (
      <label className="block">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {t.estimateLabel || 'Estimate label'}
        </span>
        <input
          type="text"
          value={config.estimateLabel ?? 'EST'}
          placeholder="EST"
          onChange={(e) => patch({ estimateLabel: e.target.value })}
          className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
        />
      </label>
    )}
  </div>
);
