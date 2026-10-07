/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Writing a layout's own stylesheet.
 *
 * Folded away, because it is the last resort rather than a normal step, and
 * an open code box at the top of the canvas settings would suggest otherwise.
 *
 * The hooks are listed here rather than in documentation. Without something
 * stable to name, the only way to reach a layer from a stylesheet is to guess
 * at markup this app is free to change — so the names are part of the control,
 * next to the box they are typed into.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CommittedInput } from './CommittedInput';
import { canScopeStyles } from './LayoutStyle';

interface Props {
  css: string | undefined;
  setCss: (next: string) => void;
  t: any;
}

const EXAMPLE = `[data-layer-type="chat"] {
  mask-image: linear-gradient(to top, #000 80%, transparent);
}`;

export const LayoutCssPanel = ({ css, setCss, t }: Props) => {
  const [open, setOpen] = useState(false);
  const written = Boolean((css || '').trim());

  return (
    <div className="pt-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {t.layoutCss || 'Custom CSS'}
        {written && !open && <span className="w-1.5 h-1.5 rounded-full bg-current-accent" />}
      </button>

      {open && (
        <div className="space-y-2 mt-2">
          <CommittedInput
            as="textarea"
            value={css || ''}
            placeholder={EXAMPLE}
            spellCheck={false}
            onCommit={setCss}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-2 text-[10px] font-mono text-zinc-200 outline-none focus:border-current-accent resize-y min-h-[120px] leading-relaxed"
          />

          <div className="text-[9px] text-zinc-600 leading-relaxed space-y-1">
            <p>{t.cssHooksIntro || 'Things you can name:'}</p>
            {/*
              :scope rather than .canvas-stage. The stylesheet is scoped to the
              canvas, and inside a scope the root is named by :scope — a bare
              class selector matches its descendants but not the root itself,
              so the obvious-looking .canvas-stage would quietly do nothing.
            */}
            <ul className="space-y-0.5 font-mono text-zinc-500">
              <li>:scope <span className="font-sans text-zinc-600">— the canvas</span></li>
              <li>[data-layer-type="chat"]</li>
              <li>[data-layer-id="…"]</li>
            </ul>
            {/*
              Measured, and surprising enough to be worth saying: a layer's
              position, size, opacity, rotation and filters are written as
              inline style by the placement, and inline style beats a
              stylesheet. Without this line, "why is my opacity rule ignored"
              is a question with no visible answer.
            */}
            <p>
              {t.cssImportant || 'Position, size, opacity, rotation and filters are set per layer — override those with !important.'}
            </p>
            <p>
              {canScopeStyles
                ? (t.cssScoped || 'Applies inside the canvas only, here and on stream.')
                : (t.cssNotPreviewed || 'This browser cannot scope a stylesheet, so it is not shown in the preview here — open the stream output to see it.')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
