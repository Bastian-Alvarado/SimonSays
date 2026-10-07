/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The welcome card's layout without CSS: where the avatar sits, how the words
 * line up, the avatar's shape and size, the font — and what comes from the
 * person themselves: the name in their top role's colour, their profile
 * banner or colour behind them.
 *
 * Every choice has an empty state, the look's own, and that is where each
 * starts. Set, a choice wins over the look; the server applies them after the
 * stylesheet (server/engine/welcome-card.js).
 */
import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useCustomFonts } from '../hooks/useCustomFonts';
import type { WelcomeCard } from './WelcomeCardEditor';

/** The faces bundled with the server, as the card renderer names them. */
export const CARD_FACES = ['Montserrat', 'Baloo 2', 'Chakra Petch', 'VT323', 'Special Elite'];

const label = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';

const Chips = ({ title, value, options, set }: {
  title: string; value: string; options: { value: string; label: string }[]; set: (v: string) => void;
}) => (
  <div className="space-y-1.5">
    <span className={label}>{title}</span>
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value || 'look'} onClick={() => set(o.value)}
          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${value === o.value ? 'border-current-accent text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
          data-card-choice={o.value || 'look'}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

export const WelcomeCardChoices = ({ card, set, notes = [], t }: {
  card: WelcomeCard; set: (patch: Partial<WelcomeCard>) => void; notes?: string[]; t: any;
}) => {
  const uploaded = useCustomFonts().filter((f) => !CARD_FACES.includes(f));
  const look = t.cardLooks || "Look's";

  return (
    <div className="space-y-4" data-card-choices>
      <div className="grid gap-4 sm:grid-cols-2">
        <Chips
          title={t.cardLayout || 'Avatar'} value={card.layout || ''}
          // Stacked needs the height: a banner-shaped card grows to fit it.
          set={(v) => set({ layout: v as any, ...(v === 'top' && card.height < 420 ? { height: 450 } : {}) })}
          options={[
            { value: '', label: look },
            { value: 'left', label: t.cardLayoutLeft || 'Left' },
            { value: 'right', label: t.cardLayoutRight || 'Right' },
            { value: 'top', label: t.cardLayoutTop || 'On top' },
          ]}
        />
        <Chips
          title={t.cardAlign || 'Words'} value={card.align || ''} set={(v) => set({ align: v as any })}
          options={[
            { value: '', label: look },
            { value: 'start', label: t.cardAlignStart || 'Left' },
            { value: 'center', label: t.cardAlignCenter || 'Centred' },
            { value: 'end', label: t.cardAlignEnd || 'Right' },
          ]}
        />
        <Chips
          title={t.cardAvatarShape || 'Avatar shape'} value={card.avatarShape || ''} set={(v) => set({ avatarShape: v as any })}
          options={[
            { value: '', label: look },
            { value: 'circle', label: t.cardShapeCircle || 'Circle' },
            { value: 'rounded', label: t.cardShapeRounded || 'Rounded' },
            { value: 'square', label: t.cardShapeSquare || 'Square' },
          ]}
        />
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className={label}>{t.cardAvatarSize || 'Avatar size'}</span>
            <span className="flex items-center gap-2 text-[10px] font-mono text-current-accent">
              {card.avatarSize ? `${card.avatarSize}px` : <span className="text-zinc-600 font-sans font-bold uppercase text-[9px]">{look}</span>}
              {Boolean(card.avatarSize) && (
                <button onClick={() => set({ avatarSize: 0 })} className="text-zinc-500 hover:text-white" title={look}><RotateCcw size={10} /></button>
              )}
            </span>
          </div>
          <input
            type="range" min={40} max={480} step={4} value={card.avatarSize || 180}
            onChange={(e) => set({ avatarSize: Number(e.target.value) })}
            className={`w-full accent-current-accent ${card.avatarSize ? '' : 'opacity-40'}`}
          />
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className={label}>{t.cardFont || 'Font'}</span>
        <select value={card.font || ''} onChange={(e) => set({ font: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-current-accent" data-card-font>
          <option value="">{look}</option>
          <optgroup label={t.cardFontsBundled || 'Built in'}>
            {CARD_FACES.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
          {uploaded.length > 0 && (
            <optgroup label={t.cardFontsUploaded || 'Uploaded by you'}>
              {uploaded.map((f) => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          )}
        </select>
        {notes.includes('font-woff2') && (
          <span className="block text-[10px] text-amber-400">{t.cardFontWoff2 || 'That font was uploaded as WOFF2, which a picture cannot use — upload it as TTF or OTF. The look\'s font is drawn meanwhile.'}</span>
        )}
        {notes.includes('font-missing') && (
          <span className="block text-[10px] text-amber-400">{t.cardFontMissing || 'That font is not among the uploads any more, so the look\'s font is drawn.'}</span>
        )}
      </label>

      {/* What comes from the person: their role, their profile. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5" data-card-name-colour>
          <span className={label}>{t.cardNameColour || 'Name colour'}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[{ value: '', label: look }, { value: 'role', label: t.cardNameRole || 'Their top role\'s colour' }].map((o) => (
              <button
                key={o.value || 'look'} onClick={() => set({ nameColour: o.value as any })}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${(card.nameColour || '') === o.value ? 'border-current-accent text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
                data-card-choice={o.value || 'look'}
              >
                {o.label}
              </button>
            ))}
            {/*
              Your own, as a swatch that is always there: picking a colour is
              choosing it. Hidden behind a choice first, it was not found.
            */}
            <label
              className={`flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer ${card.nameColour === 'own' ? 'border-current-accent text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
              data-card-choice="own"
            >
              <input
                type="color" value={(card.nameColourValue || '#ffffff').slice(0, 7)}
                onChange={(e) => set({ nameColour: 'own', nameColourValue: e.target.value })}
                className="w-6 h-6 rounded border-none bg-transparent cursor-pointer" data-card-name-colour-pick
              />
              {t.cardNameOwn || 'Your own'}
            </label>
            {card.nameColour === 'own' && (
              <input type="text" value={card.nameColourValue || ''} onChange={(e) => set({ nameColourValue: e.target.value })} maxLength={9} className="w-20 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-[11px] font-mono text-zinc-300 outline-none focus:border-current-accent" />
            )}
          </div>
        </div>
        <Chips
          title={t.cardBackdrop || 'Behind them'} value={card.backdrop || ''} set={(v) => set({ backdrop: v as any })}
          options={[
            { value: '', label: t.cardBackdropCard || 'The card\'s own' },
            { value: 'banner', label: t.cardBackdropBanner || 'Their profile banner' },
            { value: 'accent', label: t.cardBackdropAccent || 'Their profile colour' },
          ]}
        />
      </div>
      <p className="text-[10px] text-zinc-600 leading-relaxed">
        {t.cardFromThemHint || 'Somebody without a coloured role, a banner (that needs Nitro) or a profile colour gets the card\'s own. The preview uses a stand-in role colour and profile colour. In CSS, var(--their-colour) and var(--their-accent) are theirs.'}
      </p>
    </div>
  );
};
