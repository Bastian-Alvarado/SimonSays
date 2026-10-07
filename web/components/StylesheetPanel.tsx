/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Two boxes for one thing's stylesheet: what it looks like, and how it moves.
 *
 * Shared by the layer editor and the alert editor rather than written twice.
 * They are the same panel with a different subject, and the one thing that
 * must never drift between them is what :scope means and which of the two
 * boxes wins — the moment those disagree, a stylesheet that works in one place
 * silently does something else in the other.
 *
 * Two boxes because they are two decisions. What a thing looks like and how it
 * arrives change at different times and for different reasons, and with one
 * box a new look took the animation with it.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CommittedInput } from './CommittedInput';
import { canScopeStyles } from './LayoutStyle';

interface Props {
  /** The fold's label: whose stylesheet this is. */
  title: string;
  css?: string;
  motionCss?: string;
  /** What :scope means here, said in the place the choice is made. */
  scopeHint: string;
  /** Why it lives on this thing rather than one level up. Optional. */
  travelsHint?: string;
  /** Parts inside it that a stylesheet may name. */
  parts: string[];
  /** And what it may be doing, for the pieces that are only there a moment. */
  states?: string[];
  patch: (next: Record<string, any>) => void;
  t: any;
  /** Already inside a fold of its own, as on a chat layer's panel: no fold here as well, only the boxes. */
  bare?: boolean;
}

const EXAMPLE = `:scope {
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}`;

const MOTION_EXAMPLE = `:scope { animation: rise .4s ease-out both; }

@keyframes rise {
  from { opacity: 0; transform: translateY(12px) }
}`;

export const StylesheetPanel = ({ title, css, motionCss, scopeHint, travelsHint, parts, states = [], patch, t, bare = false }: Props) => {
  const [unfolded, setOpen] = useState(false);
  const open = bare || unfolded;
  const written = Boolean((css || '').trim() || (motionCss || '').trim());

  return (
    <div className={bare ? '' : 'pt-2 border-t border-zinc-800/60'} onClick={(e) => e.stopPropagation()}>
      {!bare && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {title}
          {written && !open && <span className="w-1.5 h-1.5 rounded-full bg-current-accent" />}
        </button>
      )}

      {open && (
        <div className={bare ? 'space-y-2' : 'space-y-2 mt-2'}>
          <label className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.cssLook || 'Look'}
            </span>
            <CommittedInput
              as="textarea"
              value={css || ''}
              placeholder={EXAMPLE}
              spellCheck={false}
              onCommit={(next: string) => patch({ css: next })}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-2 py-2 text-[10px] font-mono text-zinc-200 outline-none focus:border-current-accent resize-y min-h-[100px] leading-relaxed"
            />
          </label>

          <label className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.cssMotion || 'Motion'}
            </span>
            <CommittedInput
              as="textarea"
              value={motionCss || ''}
              placeholder={MOTION_EXAMPLE}
              spellCheck={false}
              onCommit={(next: string) => patch({ motionCss: next })}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-2 py-2 text-[10px] font-mono text-zinc-200 outline-none focus:border-current-accent resize-y min-h-[80px] leading-relaxed"
            />
          </label>

          <div className="text-[9px] text-zinc-600 leading-relaxed space-y-1">
            <p>
              <span className="font-mono text-zinc-500">:scope</span> {scopeHint}
            </p>
            {Boolean(travelsHint) && <p>{travelsHint}</p>}
            <p>{t.cssMotionLast || 'Motion is written after the look, so it wins where both set the same thing.'}</p>
            {Boolean(parts.length) && (
              <div className="space-y-0.5 pt-1">
                <p>{t.layerParts || 'Parts of this layer you can name:'}</p>
                <ul className="space-y-0.5 font-mono text-zinc-500">
                  {parts.map((part) => <li key={part}>{part}</li>)}
                </ul>
              </div>
            )}
            {Boolean(states.length) && (
              <div className="space-y-0.5 pt-1">
                <p>{t.layerStates || 'And what it may be doing at the time:'}</p>
                <ul className="space-y-0.5 font-mono text-zinc-500">
                  {states.map((state) => <li key={state}>{state}</li>)}
                </ul>
              </div>
            )}
            {!canScopeStyles && (
              <p className="text-amber-500">
                {t.layerCssUnsupported || 'This browser cannot scope a stylesheet, so this is not applied here.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
