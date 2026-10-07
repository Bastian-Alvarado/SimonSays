/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A colour that may instead follow the canvas.
 *
 * A canvas-wide accent is only worth having if a layer's own colour can be
 * given back. An ordinary colour input cannot express "none" — it always
 * holds a colour — so once one had been set there would be no way to return
 * the layer to the canvas, and the accent would look broken on exactly the
 * layers somebody had touched.
 *
 * Unset reads as the accent it is currently following, with the dot outlined
 * rather than filled, so "following" and "happens to be that colour" do not
 * look the same.
 */
import React from 'react';
import { X } from 'lucide-react';

interface Props {
  label: string;
  value: string | undefined;
  /** What the layer draws with while this is unset. */
  fallback: string;
  onChange: (colour: string) => void;
  onClear: () => void;
  t?: any;
  /** What unset means here, where a look also has a say (the goal's bar: the look's fill, or the accent). */
  unsetTitle?: string;
}

export const AccentSwatch = ({ label, value, fallback, onChange, onClear, t, unsetTitle }: Props) => {
  const set = Boolean(value);

  return (
    <div className="flex items-center gap-1" title={set ? label : (unsetTitle || t?.followsCanvas || 'Follows the canvas accent')}>
      <span
        className={`w-5 h-5 rounded-full overflow-hidden relative shrink-0 border ${
          set ? 'border-zinc-700' : 'border-dashed border-zinc-600'
        }`}
        style={set ? undefined : { background: 'transparent' }}
      >
        <input
          type="color"
          value={(value || fallback).slice(0, 7)}
          onChange={(e) => onChange(e.target.value)}
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer"
          style={set ? undefined : { opacity: 0.35 }}
        />
      </span>
      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
      {set && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          title={t?.followCanvas || 'Follow the canvas accent'}
          className="p-0.5 text-zinc-600 hover:text-current-accent"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
};
