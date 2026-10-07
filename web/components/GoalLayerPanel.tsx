/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Setting up a goal bar.
 *
 * The one choice that matters is where the number comes from, so it is first
 * and everything else follows it — the figure to type in only appears when the
 * goal is one you keep yourself, because for the others the server already
 * knows and typing one would be a number that quietly disagrees.
 */
import React from 'react';
import { AccentSwatch } from './AccentSwatch';
import { AutoSwatch } from './AutoSwatch';
import { CommittedInput } from './CommittedInput';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  /** The counts the server holds, to say what a source currently reads. */
  stats?: Record<string, any>;
  /** The canvas accent, so an unset bar previews what it is following. */
  accent?: string;
  t: any;
}

// Shared with the omnibars' Goal slot, so a goal is offered the same way everywhere.
export const SOURCES = [
  { value: 'manual', label: 'A number I keep', stat: null },
  { value: 'followers', label: 'Followers', stat: 'twitchFollowers' },
  { value: 'subs', label: 'Subscribers', stat: 'twitchSubs' },
  { value: 'viewers', label: 'Viewers now', stat: 'twitchViewers' },
  { value: 'tiktokLikes', label: 'TikTok likes', stat: 'tiktokLikes' },
] as const;

export const GoalLayerPanel = ({ config, patch, stats, accent, t }: Props) => {
  const source = config.source || 'manual';
  const chosen = SOURCES.find((s) => s.value === source);
  const reading = chosen?.stat ? stats?.[chosen.stat] : undefined;

  return (
    <div className="space-y-2 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1.5">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {t.goalSource || 'Counting'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              onClick={() => patch({ source: s.value })}
              className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${
                source === s.value
                  ? 'bg-current-accent/10 border-current-accent text-current-accent'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/*
          What that source reads right now, so a bar that will sit empty says
          so here rather than on stream. A count the server has never been able
          to fetch — a scope never granted — reads as nothing, not as zero.
        */}
        {chosen?.stat && (
          <p className="text-[9px] text-zinc-600">
            {Number.isFinite(Number(reading))
              ? `${t.goalNow || 'Currently'} ${Number(reading).toLocaleString()}`
              : (t.goalNoNumber || 'No number yet — it arrives once Twitch is connected.')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="block">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {t.goalTarget || 'Target'}
          </span>
          <input
            type="number"
            value={config.target ?? 100}
            onChange={(e) => patch({ target: Number(e.target.value) || 1 })}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-300 outline-none focus:border-current-accent"
          />
        </label>
        {source === 'manual' && (
          <label className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.goalCurrent || 'Now at'}
            </span>
            <input
              type="number"
              value={config.manualValue ?? 0}
              onChange={(e) => patch({ manualValue: Number(e.target.value) || 0 })}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-300 outline-none focus:border-current-accent"
            />
          </label>
        )}
      </div>

      <label className="block">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {t.goalLabel || 'Label'}
        </span>
        <CommittedInput
          type="text"
          value={config.label || ''}
          placeholder={t.goalLabelHint || 'Follower goal'}
          onCommit={(next) => patch({ label: next })}
          className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
        />
      </label>

      {/*
        Each colour beats a look on the layer once chosen, and leaves the look
        to decide while it is not. The bar is the accent-shaped one: unset, it
        follows the canvas accent where there is no look. The track and the
        text are automatic, with the goal's own grey and white behind them.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <AccentSwatch
          label={t.barColour || 'Bar'}
          value={config.barColor}
          fallback={accent || '#f43f5e'}
          onChange={(v) => patch({ barColor: v })}
          onClear={() => patch({ barColor: '' })}
          t={t}
          unsetTitle={t.goalBarFollows || 'Automatic — the look\'s fill, or the canvas accent without one'}
        />
        <AutoSwatch
          name="trackColor"
          label={t.goalTrackColour || 'Track'}
          value={config.trackColor}
          fallback="#27272a"
          onChange={(v) => patch({ trackColor: v })}
          onClear={() => patch({ trackColor: '' })}
          t={t}
        />
        <AutoSwatch
          name="textColor"
          label={t.goalTextColour || 'Text'}
          value={config.textColor}
          fallback="#ffffff"
          onChange={(v) => patch({ textColor: v })}
          onClear={() => patch({ textColor: '' })}
          t={t}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => patch({ showNumbers: config.showNumbers === false })}
          className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
            config.showNumbers !== false
              ? 'bg-current-accent/10 border-current-accent text-current-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}
        >
          {t.goalShowNumbers || 'Numbers'}
        </button>
        <button
          onClick={() => patch({ showPercent: !config.showPercent })}
          className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
            config.showPercent
              ? 'bg-current-accent/10 border-current-accent text-current-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}
        >
          {t.goalShowPercent || 'Percent'}
        </button>
      </div>
    </div>
  );
};
