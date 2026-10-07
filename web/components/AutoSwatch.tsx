/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A colour that may be left automatic.
 *
 * A look from the Library styles a layer, and the layer's own colours beat it
 * — but only the ones somebody chose. An ordinary colour input cannot say
 * "not chosen", it always holds a colour, so this is one that can: empty is
 * automatic, drawn striped, and means the look's colour, or the layer's own
 * default without one. Picking a colour makes it yours; the cross hands it
 * back.
 *
 * The same look as the text layer's colour, which came first.
 */
import React from 'react';

interface Props {
  label: string;
  value: string | undefined;
  /** What the picker opens on while this is automatic: the layer's own default. */
  fallback: string;
  onChange: (colour: string) => void;
  onClear: () => void;
  t?: any;
  /** Names the control for a test or a stylesheet: data-auto-swatch. */
  name?: string;
}

/**
 * The same, as a full-width row: the label at the left, the swatch at the
 * right. The shape the omnibar and viewer counter screens lay their colours
 * out in. `muted` dims it without hiding it — a background under Transparent
 * is still there and comes back.
 */
export const AutoColourRow = ({ label, value, fallback, onChange, onClear, t, name, muted }: Props & { muted?: boolean }) => {
  const set = Boolean(value);
  return (
    <div
      className={`flex items-center justify-between gap-3 ${muted ? 'opacity-30 pointer-events-none' : ''}`}
      data-auto-colour={name} data-auto-colour-state={set ? 'set' : 'auto'}
    >
      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</label>
      <div className="flex items-center gap-2">
        {set ? (
          <button
            onClick={() => onClear()}
            title={t?.colourBackToAutomaticLayer || 'Back to automatic — the look\'s colour, or the layer\'s own without one'}
            className="px-1 text-[13px] leading-none text-zinc-500 hover:text-white" data-auto-colour-clear
          >
            ×
          </button>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{t?.colourAutomatic || 'automatic'}</span>
        )}
        <span
          className="relative w-10 h-8 rounded-lg border border-zinc-700 overflow-hidden shrink-0"
          style={set ? undefined : { background: 'repeating-linear-gradient(45deg, #3f3f46 0 3px, #18181b 3px 6px)' }}
        >
          <input
            type="color"
            value={(value || fallback).slice(0, 7)}
            onChange={(e) => onChange(e.target.value)}
            className={`absolute inset-0 w-full h-full bg-transparent border-none cursor-pointer ${set ? '' : 'opacity-0'}`}
          />
        </span>
      </div>
    </div>
  );
};

export const AutoSwatch = ({ label, value, fallback, onChange, onClear, t, name }: Props) => {
  const set = Boolean(value);
  return (
    <div className="flex items-center gap-1.5" data-auto-swatch={name} data-auto-swatch-state={set ? 'set' : 'auto'}>
      <label className="flex items-center gap-1.5">
        <span
          className="w-5 h-5 rounded-full border border-zinc-700 overflow-hidden relative shrink-0"
          style={set ? undefined : { background: 'repeating-linear-gradient(45deg, #3f3f46 0 3px, #18181b 3px 6px)' }}
        >
          <input
            type="color"
            value={(value || fallback).slice(0, 7)}
            onChange={(e) => onChange(e.target.value)}
            className={`absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer ${set ? '' : 'opacity-0'}`}
          />
        </span>
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {label}{set ? '' : ` · ${t?.colourAutomatic || 'automatic'}`}
        </span>
      </label>
      {set && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          title={t?.colourBackToAutomaticLayer || 'Back to automatic — the look\'s colour, or the layer\'s own without one'}
          className="-ml-1 px-1 text-[11px] leading-none text-zinc-500 hover:text-white" data-auto-swatch-clear
        >
          ×
        </button>
      )}
    </div>
  );
};
