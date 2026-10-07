/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How a layer moves.
 *
 * Its own panel rather than another row inside the look controls, because
 * these two questions are asked at different moments: how a layer looks is
 * settled while building it, and how it arrives is decided once the layer is
 * on a condition and actually turns up in the middle of a stream.
 *
 * Folded, like the look controls — most layers never move, and two permanently
 * open selects would push the settings that decide what a layer is off the
 * bottom of the panel.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LAYER_ENTRANCES, LAYER_IDLES } from '../../shared/layer-motion.js';

interface Props {
  layer: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}

export const LayerMotionPanel = ({ layer, patch, t }: Props) => {
  const [open, setOpen] = useState(false);

  const entrance = layer.animateIn && layer.animateIn !== 'none';
  const idle = layer.animateIdle && layer.animateIdle !== 'none';
  const moves = Boolean(entrance || idle);

  return (
    <div className="pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {t.layerMotion || 'Motion'}
        {moves && !open && <span className="w-1.5 h-1.5 rounded-full bg-current-accent" />}
      </button>

      {open && (
        <div className="space-y-2 mt-2">
          <label className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.layerEntrance || 'When it arrives'}
            </span>
            <select
              value={layer.animateIn || 'none'}
              onChange={(e) => patch({ animateIn: e.target.value })}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
            >
              {LAYER_ENTRANCES.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.idle || 'While it is there'}
            </span>
            <select
              value={layer.animateIdle || 'none'}
              onChange={(e) => patch({ animateIdle: e.target.value })}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
            >
              {LAYER_IDLES.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>

          {moves && (
            <label className="block">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.speed || 'Speed'}</span>
                <span className="text-[9px] font-mono text-current-accent">{layer.animateSpeed ?? 100}%</span>
              </div>
              <input
                type="range"
                min={25}
                max={400}
                step={5}
                value={layer.animateSpeed ?? 100}
                onChange={(e) => patch({ animateSpeed: Number(e.target.value) })}
                onDoubleClick={() => patch({ animateSpeed: 100 })}
                title="Double-click to reset"
                className="w-full accent-current-accent"
              />
            </label>
          )}

          {/* The pairing worth knowing about, said once, where it applies. */}
          {Boolean(entrance) && (
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              {t.entranceHint || 'Plays each time the layer appears — including when a condition brings it back.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
