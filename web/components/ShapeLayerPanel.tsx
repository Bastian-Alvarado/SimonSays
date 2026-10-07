/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Drawing a shape.
 *
 * Only the controls that belong to the shape itself. Rotation, opacity, blend
 * mode, blur and shadow are on every layer already and live in the appearance
 * panel below this one, so offering them again here would be two sliders for
 * one number.
 */
import React from 'react';
import { AccentSwatch } from './AccentSwatch';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  /** The canvas accent, so an unset fill previews what it is following. */
  accent?: string;
  t: any;
}

const KINDS: { id: string; label: string }[] = [
  { id: 'rect', label: 'Box' },
  { id: 'ellipse', label: 'Circle' },
  { id: 'line', label: 'Line' },
];

const Swatch = ({ value, fallback, onChange, label }: any) => (
  <label className="flex items-center gap-1.5" title={label}>
    <span className="w-5 h-5 rounded-full border border-zinc-700 overflow-hidden relative shrink-0">
      <input
        type="color"
        value={(value || fallback).slice(0, 7)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer"
      />
    </span>
    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
  </label>
);

export const ShapeLayerPanel = ({ config, patch, accent, t }: Props) => {
  const kind = config.kind || 'rect';

  return (
    <div className="space-y-2 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-3 gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => patch({ kind: k.id })}
            className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
              kind === k.id
                ? 'bg-current-accent/10 border-current-accent text-current-accent'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <AccentSwatch
          label={t.fill || 'Fill'}
          value={config.fill}
          fallback={accent || '#f43f5e'}
          onChange={(v) => patch({ fill: v })}
          onClear={() => patch({ fill: '' })}
          t={t}
        />
        <button
          onClick={() => patch({ gradient: !config.gradient })}
          className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
            config.gradient
              ? 'bg-current-accent/10 border-current-accent text-current-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}
        >
          {t.gradient || 'Fade'}
        </button>
        {Boolean(config.gradient) && (
          <Swatch value={config.fillTo} fallback="#09090b" label={t.fadeTo || 'To'} onChange={(v: string) => patch({ fillTo: v })} />
        )}
      </div>

      {Boolean(config.gradient) && (
        <label className="block">
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.angle || 'Direction'}</span>
            <span className="text-[9px] font-mono text-current-accent">{config.angle ?? 90}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={config.angle ?? 90}
            onChange={(e) => patch({ angle: Number(e.target.value) })}
            className="w-full accent-current-accent"
          />
        </label>
      )}

      {kind === 'line' ? (
        <label className="block">
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.thickness || 'Thickness'}</span>
            <span className="text-[9px] font-mono text-current-accent">{config.thickness ?? 4}px</span>
          </div>
          <input
            type="range"
            min={1}
            max={80}
            value={config.thickness ?? 4}
            onChange={(e) => patch({ thickness: Number(e.target.value) })}
            className="w-full accent-current-accent"
          />
        </label>
      ) : (
        <>
          {kind === 'rect' && (
            <label className="block">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.radius || 'Corners'}</span>
                <span className="text-[9px] font-mono text-current-accent">{config.radius ?? 0}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={config.radius ?? 0}
                onChange={(e) => patch({ radius: Number(e.target.value) })}
                className="w-full accent-current-accent"
              />
            </label>
          )}

          <div className="flex items-center gap-3">
            <label className="block flex-1">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.border || 'Outline'}</span>
                <span className="text-[9px] font-mono text-current-accent">{config.borderWidth ?? 0}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={config.borderWidth ?? 0}
                onChange={(e) => patch({ borderWidth: Number(e.target.value) })}
                className="w-full accent-current-accent"
              />
            </label>
            {Boolean(config.borderWidth) && (
              <Swatch
                value={config.borderColor}
                fallback="#ffffff"
                label={t.colour || 'Colour'}
                onChange={(v: string) => patch({ borderColor: v })}
              />
            )}
          </div>
        </>
      )}

      {/* Where a fill with no alpha would otherwise hide what it sits on. */}
      <p className="text-[9px] text-zinc-600 leading-relaxed">
        {t.shapeHint || 'Rotation, transparency and shadow are below, and apply to any layer.'}
      </p>
    </div>
  );
};
