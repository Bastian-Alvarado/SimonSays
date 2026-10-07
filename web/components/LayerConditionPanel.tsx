/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * When a layer is allowed to draw itself.
 *
 * Not folded away with the look controls, because this decides whether the
 * layer is on screen at all — which is a different order of thing from how
 * rounded its corners are.
 *
 * The list comes from shared/layer-conditions.js so that what the editor
 * offers and what the canvas can actually test are the same list.
 */
import React from 'react';
import { LAYER_CONDITIONS } from '../../shared/layer-conditions.js';

interface Props {
  layer: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}

export const LayerConditionPanel = ({ layer, patch, t }: Props) => {
  const current = layer.showWhen || 'always';
  const entry = LAYER_CONDITIONS.find((c) => c.id === current) || LAYER_CONDITIONS[0];
  const conditional = current !== 'always';

  return (
    <div className="pt-2 border-t border-zinc-800/60 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
        {t.showWhen || 'On screen when'}
      </span>

      <div className="flex items-center gap-1.5">
        <select
          value={current}
          onChange={(e) => patch({ showWhen: e.target.value })}
          className="flex-1 min-w-0 bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
        >
          {LAYER_CONDITIONS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        {/*
          The inverse is half of what this is for: "hide the chat while an
          alert is playing" is the same condition read the other way round,
          and making somebody build a second layer for it would be silly.
        */}
        {conditional && (
          <button
            onClick={() => patch({ showWhenNot: !layer.showWhenNot })}
            title={t.invertHint || 'Show it the rest of the time instead'}
            className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border shrink-0 ${
              layer.showWhenNot
                ? 'bg-current-accent/10 border-current-accent text-current-accent'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            {t.invert || 'Not'}
          </button>
        )}
      </div>

      {conditional && (
        <p className="text-[9px] text-zinc-600 leading-relaxed">
          {layer.showWhenNot
            ? (t.conditionInverted || 'Hidden while this is true, on screen the rest of the time.')
            : entry.hint}
        </p>
      )}
    </div>
  );
};
