/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Changing one piece of a theme of the streamer's own, in the Library.
 *
 * Two ways in, side by side. The knobs the stylesheet already declares —
 * its colours and sizes, read out by css-fields.js — for changing a theme
 * without reading any CSS; and the stylesheet itself, for everything else.
 * A knob changed here changes the default in the text (setFieldDefault), so
 * the two never disagree: what is saved is only ever the stylesheet.
 *
 * The preview beside it is the Library's own, drawing the draft as it is
 * typed, so nothing is saved to find out what it looks like.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Crown, Trash2, X } from 'lucide-react';
import { readFields } from '../../shared/css-fields.js';
import { presetKind } from '../../shared/css-presets.js';
import { setFieldDefault, pieceCssMax } from '../../shared/user-themes.js';

const field = 'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';
const button = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border disabled:opacity-40';

const HEX = /^#[0-9a-fA-F]{3,8}$/;
/** What a colour picker can show: #rrggbb, from #rgb or #rrggbbaa. */
const asPickable = (v: string) => {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7);
  if (/^#[0-9a-fA-F]{3,4}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return '#000000';
};
/** The picker's colour, keeping any see-through the value had. */
const withAlpha = (picked: string, before: string) => (/^#[0-9a-fA-F]{8}$/.test(before) ? `${picked}${before.slice(7)}` : picked);

/** One knob: a colour or a number, set straight into the stylesheet's default. Also the whole theme's knobs (ThemeStylePanel). */
export const Knob = ({ f, set }: { f: any; set: (value: string) => void }) => {
  // Typed text is kept here until it is a value, so a half-typed colour does not unmake the knob.
  const [typed, setTyped] = useState(f.value);
  useEffect(() => setTyped(f.value), [f.value]);
  if (f.kind === 'colour') {
    const commit = () => { if (HEX.test(typed.trim()) && typed.trim() !== f.value) set(typed.trim()); else setTyped(f.value); };
    return (
      <label className="flex items-center gap-2 min-w-0" data-theme-knob={f.name}>
        <input type="color" value={asPickable(f.value)} onChange={(e) => set(withAlpha(e.target.value, f.value))} className="w-7 h-7 shrink-0 rounded border border-zinc-800 bg-transparent cursor-pointer" />
        <span className="flex-1 min-w-0">
          <span className="block text-[9px] text-zinc-400 truncate" title={f.name}>{f.label}</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} className="w-full bg-transparent text-[10px] font-mono text-zinc-500 outline-none" spellCheck={false} />
        </span>
      </label>
    );
  }
  const n = parseFloat(f.value);
  const decimals = (String(f.value).split('.')[1] || '').replace(/[^0-9]/g, '').length;
  const step = decimals ? 10 ** -Math.min(decimals, 2) : (f.unit === 's' ? 0.1 : 1);
  return (
    <label className="block min-w-0" data-theme-knob={f.name}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] text-zinc-400 truncate" title={f.name}>{f.label}</span>
        <span className="text-[10px] font-mono text-zinc-500">{f.value}</span>
      </span>
      <input
        type="range" min={Math.min(f.min, n)} max={Math.max(f.max, n)} step={step} value={Number.isFinite(n) ? n : 0}
        onChange={(e) => set(`${e.target.value}${f.unit}`)}
        className="w-full accent-current-accent"
      />
    </label>
  );
};

interface Props {
  draft: any;
  onChange: (next: any) => void;
  /** The theme it is in, for the looks a motion can be drawn over. */
  theme: any;
  /** What each kind of layer is called on screen. */
  kindName: (kind: string) => string;
  onSave: () => void;
  onCancel: () => void;
  /** Taking it out of the theme; absent for a piece not saved yet. */
  onDelete?: () => void;
  /** Making it the look the whole theme gives its kind; absent when it already is, or for motion. */
  onMakeMain?: () => void;
  busy?: boolean;
  error?: string;
  t: any;
}

export const ThemePieceEditor = ({ draft, onChange, theme, kindName, onSave, onCancel, onDelete, onMakeMain, busy = false, error = '', t }: Props) => {
  const fields = useMemo(() => readFields(draft.css || '', ''), [draft.css]);
  const max = pieceCssMax(draft.layerType);
  const [sure, setSure] = useState(false);
  // A motion is shown over one of the theme's looks for its kind: the one it animates.
  const looks = (theme?.objects || []).filter((o: any) => o.layerType === draft.layerType && presetKind(o) !== 'motion' && o.id !== draft.id);

  return (
    <div className="space-y-3 rounded-xl border border-current-accent/40 bg-zinc-950/40 p-3" data-theme-editor={draft.id}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className={label}>{t.libraryPieceName || 'Name'}</span>
          <input value={draft.name || ''} onChange={(e) => onChange({ ...draft, name: e.target.value })} maxLength={60} className={field} data-theme-piece-name />
        </label>
        <label className="block space-y-1">
          <span className={label}>{t.libraryPieceKind || 'For'}</span>
          <span className={`${field} block text-zinc-400`}>
            {kindName(draft.layerType)} · {presetKind(draft) === 'motion' ? (t.libraryMotion || 'Motion') : (t.libraryLook || 'Look')}
          </span>
        </label>
      </div>
      <label className="block space-y-1">
        <span className={label}>{t.libraryPieceHint || 'A line about it'}</span>
        <input value={draft.hint || ''} onChange={(e) => onChange({ ...draft, hint: e.target.value })} maxLength={300} className={field} data-theme-piece-hint />
      </label>

      {presetKind(draft) === 'motion' && looks.length > 0 && (
        <label className="block space-y-1">
          <span className={label}>{t.libraryPieceOver || 'Shown over'}</span>
          <select value={draft.previewWith || ''} onChange={(e) => onChange({ ...draft, previewWith: e.target.value || undefined })} className={field} data-theme-piece-over>
            <option value="">{t.libraryPieceOverNothing || 'Nothing: it moves the whole layer'}</option>
            {looks.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      )}

      {fields.length > 0 && (
        <div className="space-y-1.5">
          <span className={label}>{t.libraryPieceKnobs || 'Colours and sizes'}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2" data-theme-knobs>
            {fields.map((f: any) => (
              <Knob key={f.name} f={f} set={(value) => onChange({ ...draft, css: setFieldDefault(draft.css, f, value) })} />
            ))}
          </div>
        </div>
      )}

      <label className="block space-y-1">
        <span className={`${label} flex justify-between`}>
          <span>{t.libraryPieceCss || 'Stylesheet'}</span>
          <span className={(draft.css || '').length > max * 0.95 ? 'text-amber-400' : ''}>{(draft.css || '').length} / {max}</span>
        </span>
        <textarea
          value={draft.css || ''}
          onChange={(e) => onChange({ ...draft, css: e.target.value.slice(0, max) })}
          rows={14}
          spellCheck={false}
          className={`${field} font-mono text-[10px] leading-relaxed whitespace-pre`}
          data-theme-piece-css
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onSave} disabled={busy} className={`${button} bg-current-accent/10 border-current-accent text-current-accent`} data-theme-piece-save>
          <Check size={11} /> {t.save || 'Save'}
        </button>
        <button onClick={onCancel} className={`${button} bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white`} data-theme-piece-cancel>
          <X size={11} /> {t.cancel || 'Cancel'}
        </button>
        {onMakeMain && (
          <button onClick={onMakeMain} disabled={busy} title={t.libraryPieceMainHint || 'A theme gives each kind of layer its first look; this makes it this one'} className={`${button} bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white`} data-theme-piece-main>
            <Crown size={11} /> {t.libraryPieceMain || 'Use for the whole theme'}
          </button>
        )}
        {onDelete && (!sure ? (
          <button onClick={() => setSure(true)} className={`${button} ml-auto border-rose-500/50 text-rose-300 hover:bg-rose-500/10`} data-theme-piece-delete>
            <Trash2 size={11} /> {t.libraryPieceDelete || 'Take it out'}
          </button>
        ) : (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-rose-200">{t.libraryPieceDeleteSure || 'Take this piece out of the theme?'}</span>
            <button onClick={onDelete} disabled={busy} className={`${button} border-rose-500/50 text-rose-300 hover:bg-rose-500/10`} data-theme-piece-delete-yes>
              <Trash2 size={11} /> {t.libraryPieceDeleteYes || 'Take it out'}
            </button>
            <button onClick={() => setSure(false)} className={`${button} bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white`}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
    </div>
  );
};
