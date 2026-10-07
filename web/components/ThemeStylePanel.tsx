/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A theme of the streamer's own, changed as a whole and without any CSS: the
 * colours and sizes its pieces share (themeKnobs), each set once for all of
 * them, and the fonts it is drawn in, each swapped everywhere it is used.
 *
 * Changes are a draft the Library draws every piece from while this is open,
 * so the whole shelf shows the theme as it would be; nothing is kept until
 * it is saved.
 */
import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { themeKnobs, setThemeKnob, themeFonts, swapThemeFont, THEME_FONTS } from '../../shared/user-themes.js';
import { Knob } from './ThemePieceEditor';
import { FontUploadButton } from './FontUploadButton';
import { useCustomFonts } from '../hooks/useCustomFonts';
import { fill } from '../words';

const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';
const field = 'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent';
const button = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border disabled:opacity-40';

/** How many shared knobs show before "show all": the most shared are the ones that change the most. */
const FIRST_KNOBS = 12;

interface Props {
  draft: any;
  onChange: (next: any) => void;
  /** Something is changed and not saved yet. */
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
  busy?: boolean;
  error?: string;
  t: any;
}

export const ThemeStylePanel = ({ draft, onChange, dirty, onSave, onDiscard, onClose, busy = false, error = '', t }: Props) => {
  const knobs = useMemo(() => themeKnobs(draft), [draft]);
  const fonts = useMemo(() => themeFonts(draft), [draft]);
  const uploaded = useCustomFonts();
  const [all, setAll] = useState(false);
  const choices = [...new Set([...THEME_FONTS, ...uploaded])];
  const shown = all ? knobs : knobs.slice(0, FIRST_KNOBS);

  return (
    <div className="glass-panel rounded-2xl border border-current-accent/50 p-4 space-y-4 max-w-4xl" data-library="theme-style">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200 flex-1">{t.libraryStyleTitle || 'Colours, sizes and fonts'}</span>
        <button onClick={onClose} className={`${button} bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white`} title={t.close || 'Close'} data-library="theme-style-close">
          <X size={11} />
        </button>
      </div>
      <p className="text-[10px] text-zinc-500 leading-relaxed">
        {t.libraryStyleHint || 'What the theme\'s pieces share, set once for all of them. Every piece below shows the change as you make it; nothing is kept until you save.'}
      </p>

      {knobs.length > 0 ? (
        <div className="space-y-2">
          <span className={label}>{t.libraryStyleShared || 'Shared by its pieces'}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3" data-library="theme-knobs">
            {shown.map((k: any) => (
              <div key={`${k.name}|${k.kind}`} className="space-y-0.5" data-library-knob={k.name}>
                <Knob f={k} set={(value) => onChange(setThemeKnob(draft, k, value))} />
                <span className="block text-[8px] text-zinc-600">
                  {fill(t.libraryStyleIn || 'in {count} pieces', { count: String(k.pieces) })}
                  {k.differing > 1 ? ` · ${fill(t.libraryStyleDiffer || '{count} values now: setting it makes them one', { count: String(k.differing) })}` : ''}
                </span>
              </div>
            ))}
          </div>
          {knobs.length > FIRST_KNOBS && (
            <button onClick={() => setAll(!all)} className={`${button} bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white`} data-library="theme-knobs-all">
              {all ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {all ? (t.libraryStyleFewer || 'Fewer') : fill(t.libraryStyleAll || 'All {count}', { count: String(knobs.length) })}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-zinc-600">{t.libraryStyleNoKnobs || 'Its pieces share no colours or sizes yet: change each one with Edit.'}</p>
      )}

      <div className="space-y-2">
        <span className={label}>{t.libraryStyleFonts || 'Fonts'}</span>
        {fonts.length > 0 ? (
          <div className="space-y-2" data-library="theme-fonts">
            {fonts.map(({ family, count }: any) => (
              <div key={family} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 items-center" data-library-font={family}>
                <span className="text-[11px] text-zinc-300 truncate" style={{ fontFamily: `'${family}'` }}>
                  {family} <span className="text-[9px] text-zinc-600" style={{ fontFamily: 'inherit' }}>· {fill(t.libraryStyleIn || 'in {count} pieces', { count: String(count) })}</span>
                </span>
                <select
                  value={family}
                  onChange={(e) => onChange(swapThemeFont(draft, family, e.target.value))}
                  className={field}
                  data-library="theme-font-pick"
                >
                  {[...new Set([family, ...choices])].map((name) => <option key={name} value={name} style={{ fontFamily: `'${name}'` }}>{name}</option>)}
                </select>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600">{t.libraryStyleNoFonts || 'It names no fonts of its own: it is drawn in each layout\'s font.'}</p>
        )}
        <FontUploadButton t={t} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onSave} disabled={!dirty || busy} className={`${button} bg-current-accent/10 border-current-accent text-current-accent`} data-library="theme-style-save">
          <Check size={11} /> {t.save || 'Save'}
        </button>
        <button onClick={onDiscard} disabled={!dirty} className={`${button} bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white`} data-library="theme-style-discard">
          <X size={11} /> {t.libraryStyleDiscard || 'Put it back'}
        </button>
        {dirty && <span className="text-[10px] text-amber-300">{t.libraryStyleUnsaved || 'Not saved yet'}</span>}
      </div>
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
    </div>
  );
};
