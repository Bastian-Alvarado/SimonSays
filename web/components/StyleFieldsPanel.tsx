/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The controls a stylesheet already asked for.
 *
 * Nothing here is configured. The sheet is read for the properties it
 * declares — which pink, how wide a cell, how long a strike takes — and each
 * one gets the control its value implies: a picker for a colour, a slider for
 * a number. A look that declares nothing shows nothing, and every preset that
 * already shipped grew a panel the day this arrived.
 *
 * The point of it is small and specific. These values were always editable;
 * they were editable by opening a box of CSS and changing text in the middle
 * of it, which is a thing you do once and then leave alone. A slider you move
 * while looking at the canvas is a different activity.
 *
 * Kept with Look and Motion rather than under the stylesheet it is read from.
 * Beside the stylesheet it read as part of that box, which is the one place
 * somebody who wants a slider instead of CSS was never going to look. These
 * are how a layer looks, the question Look already answers, so they sit where
 * that question is being asked. Open to begin with, unlike its neighbours:
 * the whole reason to have it is that the values are in plain sight.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { readFields } from '../../shared/css-fields.js';

interface Props {
  css?: string;
  motionCss?: string;
  vars?: Record<string, string>;
  patch: (next: Record<string, string>) => void;
  t: any;
}

export const StyleFieldsPanel = ({ css, motionCss, vars, patch, t }: Props) => {
  const [open, setOpen] = useState(true);
  const fields = readFields(css, motionCss) as any[];
  if (!fields.length) return null;

  const set = (name: string, value: string) => patch({ ...(vars || {}), [name]: value });
  /*
    Putting one back is forgetting it, rather than storing the default again —
    so a preset that later changes its mind about a default is followed by
    everything that never disagreed with it.
  */
  const clear = (name: string) => {
    const next = { ...(vars || {}) };
    delete next[name];
    patch(next);
  };

  const touched = fields.filter((f) => vars && vars[f.name]).length;

  return (
    <div className="pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {t.styleFields || 'Custom fields'}
          {/* How many, so a folded panel still says there is something in it. */}
          <span className="font-mono font-medium normal-case tracking-normal">{fields.length}</span>
          {touched > 0 && !open && <span className="w-1.5 h-1.5 rounded-full bg-current-accent" />}
        </button>
        {open && touched > 0 && (
          <button
            onClick={() => patch({})}
            className="shrink-0 text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:text-white"
          >
            {t.styleFieldsReset || 'Put all back'}
          </button>
        )}
      </div>

      {open && (
      <div className="space-y-2.5 mt-2">
      {fields.map((field) => {
        const value = (vars && vars[field.name]) || field.value;
        const changed = Boolean(vars && vars[field.name]);
        return (
          <div key={field.name} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={`flex-1 min-w-0 truncate text-[8px] font-black uppercase tracking-widest ${
                changed ? 'text-current-accent' : 'text-zinc-600'
              }`}>
                {field.label}
                {field.kind === 'number' && (
                  <span className="ml-1.5 font-mono font-medium normal-case tracking-normal">{value}</span>
                )}
              </span>
              {/* Only where there is something to put back. */}
              {changed && (
                <button
                  onClick={() => clear(field.name)}
                  title={`${t.styleFieldsPut || 'Back to'} ${field.value}`}
                  className="shrink-0 p-0.5 text-zinc-600 hover:text-white"
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </div>

            {field.kind === 'colour' ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={value.slice(0, 7)}
                  onChange={(e) => set(field.name, e.target.value)}
                  className="w-7 h-6 shrink-0 bg-transparent border border-zinc-800 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(field.name, e.target.value)}
                  className="flex-1 min-w-0 bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-300 outline-none focus:border-current-accent"
                />
              </div>
            ) : (
              <input
                type="range"
                min={field.min}
                max={field.max}
                /*
                  A hundred steps across whatever range it has, so a slider is
                  as fine as the thing it is setting needs — a 0 to 10 second
                  strike moves in hundredths and a 0 to 100 percent inset in
                  whole numbers, without either being told about the other.
                */
                step={(field.max - field.min) / 100}
                value={parseFloat(value)}
                onChange={(e) => set(field.name, `${Number(e.target.value)}${field.unit}`)}
                className="w-full accent-current-accent"
              />
            )}
          </div>
        );
      })}
      </div>
      )}
    </div>
  );
};
