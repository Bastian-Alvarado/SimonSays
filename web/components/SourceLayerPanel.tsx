/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * An OBS source slot (Omnilayer): which source goes in this box, whether it
 * fits inside it or is stretched to it, and how much of its edges to cut off
 * first. Where the box is, is the layer's own position and size — drag it on
 * the canvas and, while the layout is live, OBS follows.
 */
import React from 'react';
import { CommittedInput } from './CommittedInput';
import { ON_SCREEN_SOURCE } from '../../shared/remote-players.js';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  /** What OBS has, by name, to choose from. Empty while OBS is not connected. */
  sources: string[];
  t: any;
}

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';

export const SourceLayerPanel = ({ config, patch, sources, t }: Props) => {
  // "Player on screen" is no source in OBS: it stands for whichever remote player is on screen.
  const onScreen = config.source === ON_SCREEN_SOURCE;
  const known = onScreen || sources.includes(config.source);
  return (
    <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()} data-source-panel>
      <label className="block">
        <span className={label}>{t.sourceSlotSource || 'OBS source'}</span>
        {sources.length > 0 ? (
          <select value={known ? config.source : ''} onChange={(e) => patch({ source: e.target.value })} className={field}>
            <option value="">{config.source && !known ? config.source : (t.sourceSlotPick || 'Pick one…')}</option>
            <option value={ON_SCREEN_SOURCE}>{t.sourceSlotOnScreen || 'Player on screen: whichever player is put on screen'}</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <CommittedInput value={config.source || ''} placeholder={t.sourceSlotTyped || 'Its name in OBS, e.g. Game Capture'} onCommit={(v: string) => patch({ source: v })} className={field} />
        )}
      </label>
      {onScreen && (
        <p className="text-[9px] text-current-accent/80 leading-relaxed" data-source-on-screen>
          {t.sourceSlotOnScreenHint || 'Shows the remote player seat that is on screen: pick it on the Remote players screen, or with the "whose game is on screen" action step. Seat 1 shows your own capture while you play in it.'}
        </p>
      )}
      <label className="block">
        <span className={label}>{t.sourceSlotFit || 'In the box'}</span>
        <select value={config.fit || 'fit'} onChange={(e) => patch({ fit: e.target.value })} className={field}>
          <option value="fit">{t.sourceSlotFitInside || 'Whole, inside the box'}</option>
          <option value="stretch">{t.sourceSlotStretch || 'Stretched to the box'}</option>
        </select>
      </label>
      <div>
        <span className={label}>{t.sourceSlotCrop || 'Cut off its edges first (its own pixels)'}</span>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {([['cropTop', t.sourceSlotTop || 'Top'], ['cropRight', t.sourceSlotRight || 'Right'], ['cropBottom', t.sourceSlotBottom || 'Bottom'], ['cropLeft', t.sourceSlotLeft || 'Left']] as const).map(([key, name]) => (
            <label key={key} className="block">
              <span className="text-[8px] text-zinc-600">{name}</span>
              <input type="number" min={0} max={4000} value={config[key] ?? 0} onChange={(e) => patch({ [key]: Math.max(0, Number(e.target.value) || 0) })} className={field} />
            </label>
          ))}
        </div>
      </div>
      <p className="text-[9px] text-zinc-600 leading-relaxed">
        {t.sourceSlotHint || 'Omnilayer: while this layout is live, OBS puts this source here. Nothing is drawn on stream — the source shows through. A source with no box on the live layout is hidden.'}
      </p>
    </div>
  );
};
