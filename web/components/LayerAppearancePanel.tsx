/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How a layer is drawn, as opposed to what it draws.
 *
 * One panel for every layer type, because rotating a nameplate and rotating a
 * logo are the same operation. Folded away by default: these are the controls
 * somebody reaches for occasionally, and eight of them permanently open would
 * bury the ones that decide what the layer actually is.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';

interface Props {
  layer: Record<string, any>;
  /** Change the layer and save. */
  patch: (next: Record<string, any>) => void;
  t: any;
}

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
];

/** A slider whose default is a no-op, shown with the value beside it. */
const Slider = ({ label, value, def, min, max, step = 1, suffix = '', onChange }: {
  label: string; value: number | undefined; def: number; min: number; max: number;
  step?: number; suffix?: string; onChange: (n: number) => void;
}) => {
  const v = value ?? def;
  return (
    <label className="block">
      <div className="flex justify-between items-center">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
        {/* Only worth showing when it is doing something. */}
        {v !== def && <span className="text-[9px] font-mono text-current-accent">{v}{suffix}</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(def)}
        title="Double-click to reset"
        className={`w-full accent-current-accent ${v === def ? 'opacity-50' : ''}`}
      />
    </label>
  );
};

export const LayerAppearancePanel = ({ layer, patch, t }: Props) => {
  const [open, setOpen] = useState(false);

  /* Whether anything here is doing something, so a folded panel still says so. */
  const touched = Boolean(
    layer.rotation || layer.flipH || layer.flipV || layer.blur || layer.hueRotate
    || layer.shadowBlur || layer.shadowX || layer.shadowY
    || (layer.blendMode && layer.blendMode !== 'normal')
    || (layer.brightness !== undefined && layer.brightness !== 100)
    || (layer.contrast !== undefined && layer.contrast !== 100)
    || (layer.saturate !== undefined && layer.saturate !== 100),
  );

  return (
    <div className="pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {t.layerAppearance || 'Look'}
        {touched && !open && <span className="w-1.5 h-1.5 rounded-full bg-current-accent" />}
      </button>

      {open && (
        <div className="space-y-2 mt-2">
          <Slider label={t.rotation || 'Rotate'} value={layer.rotation} def={0} min={-180} max={180} suffix="°"
            onChange={(n) => patch({ rotation: n })} />

          <div className="grid grid-cols-2 gap-1.5">
            {([['flipH', FlipHorizontal, 'Flip across'], ['flipV', FlipVertical, 'Flip down']] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => patch({ [key]: !layer[key] })}
                className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border flex items-center justify-center gap-1.5 ${
                  layer[key]
                    ? 'bg-current-accent/10 border-current-accent text-current-accent'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                }`}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>

          <Slider label={t.brightness || 'Brightness'} value={layer.brightness} def={100} min={0} max={300} suffix="%"
            onChange={(n) => patch({ brightness: n })} />
          <Slider label={t.contrast || 'Contrast'} value={layer.contrast} def={100} min={0} max={300} suffix="%"
            onChange={(n) => patch({ contrast: n })} />
          <Slider label={t.saturate || 'Saturation'} value={layer.saturate} def={100} min={0} max={300} suffix="%"
            onChange={(n) => patch({ saturate: n })} />
          <Slider label={t.hueRotate || 'Hue'} value={layer.hueRotate} def={0} min={-180} max={180} suffix="°"
            onChange={(n) => patch({ hueRotate: n })} />
          <Slider label={t.blur || 'Blur'} value={layer.blur} def={0} min={0} max={40} suffix="px"
            onChange={(n) => patch({ blur: n })} />

          {/* A shadow that follows the alpha, so a logo casts the logo's shape. */}
          <div className="grid grid-cols-3 gap-1.5">
            <Slider label={t.shadow || 'Shadow'} value={layer.shadowBlur} def={0} min={0} max={80}
              onChange={(n) => patch({ shadowBlur: n })} />
            <Slider label="X" value={layer.shadowX} def={0} min={-80} max={80}
              onChange={(n) => patch({ shadowX: n })} />
            <Slider label="Y" value={layer.shadowY} def={0} min={-80} max={80}
              onChange={(n) => patch({ shadowY: n })} />
          </div>
          {Boolean(layer.shadowBlur || layer.shadowX || layer.shadowY) && (
            <label className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border border-zinc-700 overflow-hidden relative shrink-0">
                <input
                  type="color"
                  value={(layer.shadowColor || '#000000').slice(0, 7)}
                  onChange={(e) => patch({ shadowColor: e.target.value })}
                  className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer"
                />
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
                {t.shadowColour || 'Shadow colour'}
              </span>
            </label>
          )}

          <label className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.blendMode || 'Blend with what is under it'}
            </span>
            <select
              value={layer.blendMode || 'normal'}
              onChange={(e) => patch({ blendMode: e.target.value })}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
            >
              {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>

          {Boolean(layer.rotation) && (
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              {t.rotationNote
                || 'Dragging a rotated layer still moves it, but the handles stay square to the canvas rather than turning with it.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
