/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Writing a text layer.
 *
 * The picker is the point. A box you can type variables into is only useful if
 * you know what they are called, and a list in documentation is a list nobody
 * reads — so every value is a button that inserts itself, with what it
 * currently says printed next to it. That turns "what can I put here" into
 * something you answer by looking.
 */
import React from 'react';
import { OVERLAY_VARS, fillTemplate } from '../../shared/overlay-vars.js';
import { CHAT_FONTS } from '../../shared/chat-style.js';
import { useCustomFonts } from '../hooks/useCustomFonts';
import { FontUploadButton } from './FontUploadButton';
import { CommittedInput } from './CommittedInput';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  /** The same state the layer resolves against, so the picker can preview it. */
  state: any;
  t: any;
}

/** '' is "whatever the layout already uses". */
const BUILT_IN = ['', ...CHAT_FONTS];

export const TextLayerPanel = ({ config, patch, state, t }: Props) => {
  const FONTS = [...BUILT_IN, ...useCustomFonts()];
  const insert = (name: string) => patch({ text: `${config.text || ''}{${name}}` });

  return (
    <div className="space-y-2 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      <label className="block">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {t.textContent || 'What it says'}
        </span>
        {/*
          A textarea, because newlines are kept, and committed on blur like
          every other text field here — the server tidies what it stores and a
          field that saved per keystroke would fight a space being typed.
        */}
        <CommittedInput
          as="textarea"
          value={config.text || ''}
          placeholder={'{followers} seguidores'}
          onCommit={(next: string) => patch({ text: next })}
          className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent resize-y min-h-[52px]"
        />
      </label>

      {/* What it will actually say, right now. */}
      {Boolean(config.text) && (
        <p className="text-[9px] text-zinc-500 leading-relaxed break-words">
          <span className="text-zinc-600">{t.textNow || 'Right now'}: </span>
          {fillTemplate(config.text, state)}
        </p>
      )}

      <div className="space-y-1">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {t.textVars || 'Drop in a live value'}
        </span>
        <div className="flex flex-wrap gap-1">
          {OVERLAY_VARS.map((v) => {
            const current = fillTemplate(`{${v.name}}`, state);
            return (
              <button
                key={v.name}
                onClick={() => insert(v.name)}
                title={`${v.label} — ${current}`}
                className="px-1.5 py-1 rounded text-[8px] font-mono border bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-current-accent hover:text-current-accent"
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="block">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.fontSize || 'Size'}</span>
          <input
            type="number"
            value={config.fontSize ?? 48}
            onChange={(e) => patch({ fontSize: Number(e.target.value) || 8 })}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-300 outline-none focus:border-current-accent"
          />
        </label>
        <label className="block">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.font || 'Font'}</span>
            <FontUploadButton t={t} />
          </div>
          <select
            value={config.fontFamily || ''}
            onChange={(e) => patch({ fontFamily: e.target.value })}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
          >
            {/* Empty is automatic: the look's font, or the layout's without one. */}
            {FONTS.map((f) => <option key={f || 'default'} value={f}>{f || (t.fontAutomatic || 'Automatic')}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {(['left', 'center', 'right'] as const).map((a) => (
          <button
            key={a}
            onClick={() => patch({ align: a })}
            className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
              (config.align || 'left') === a
                ? 'bg-current-accent/10 border-current-accent text-current-accent'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {(['top', 'middle', 'bottom'] as const).map((v) => (
          <button
            key={v}
            onClick={() => patch({ verticalAlign: v })}
            className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
              (config.verticalAlign || 'middle') === v
                ? 'bg-current-accent/10 border-current-accent text-current-accent'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {/*
          The colour, or automatic: left empty, the look on this layer decides
          it, and without a look it is white. Picking one makes it yours, and
          it shows over any look; the cross hands it back.
        */}
        <label className="flex items-center gap-1.5" data-text-colour={config.color ? 'set' : 'auto'}>
          <span
            className="w-5 h-5 rounded-full border border-zinc-700 overflow-hidden relative shrink-0"
            style={config.color ? undefined : { background: 'repeating-linear-gradient(45deg, #3f3f46 0 3px, #18181b 3px 6px)' }}
          >
            <input
              type="color"
              value={(config.color || '#ffffff').slice(0, 7)}
              onChange={(e) => patch({ color: e.target.value })}
              className={`absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer ${config.color ? '' : 'opacity-0'}`}
            />
          </span>
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {t.colour || 'Colour'}{config.color ? '' : ` · ${t.colourAutomatic || 'automatic'}`}
          </span>
        </label>
        {config.color && (
          <button
            onClick={() => patch({ color: '' })}
            title={t.colourBackToAutomatic || 'Back to automatic — the look\'s colour, or white without one'}
            className="-ml-1 px-1 text-[11px] leading-none text-zinc-500 hover:text-white" data-text-colour-auto
          >
            ×
          </button>
        )}
        <button
          onClick={() => patch({ uppercase: !config.uppercase })}
          className={`flex-1 px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
            config.uppercase
              ? 'bg-current-accent/10 border-current-accent text-current-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}
        >
          {t.uppercase || 'Caps'}
        </button>
        <button
          onClick={() => patch({ italic: !config.italic })}
          className={`flex-1 px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border italic ${
            config.italic
              ? 'bg-current-accent/10 border-current-accent text-current-accent'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}
        >
          {t.italic || 'Italic'}
        </button>
      </div>

      {/* Legibility over gameplay, same as chat. */}
      <label className="block">
        <div className="flex justify-between items-center">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.outline || 'Outline'}</span>
          {Boolean(config.outlineWidth) && <span className="text-[9px] font-mono text-current-accent">{config.outlineWidth}px</span>}
        </div>
        <input
          type="range"
          min={0}
          max={8}
          value={config.outlineWidth ?? 0}
          onChange={(e) => patch({ outlineWidth: Number(e.target.value) })}
          className="w-full accent-current-accent"
        />
      </label>
    </div>
  );
};
