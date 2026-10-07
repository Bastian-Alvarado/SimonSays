/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Setting up a pixel avatar to do what the built-in one does by itself:
 * take a colour — the layout's, your own, a crewmate's — and move its eyes
 * — glance about, half-shut into a blink, twinkle. Both need to know what
 * its colours are for, which only whoever drew it knows; the examples come
 * set up as the built-in avatar is.
 *
 * Every choice shows its result at once, on small copies of the avatar
 * beside it, so it can be judged without leaving the tab.
 */
import React from 'react';
import { PixelKitAvatar } from '../PixelKitAvatar';
import { pixelColours } from '../../../shared/pixel-avatars.js';
import { setColouring, setEyes, guessEyes, setBaseOutfit } from '../../../shared/pixel-edit.js';
import { pixelFaceCrop } from '../pixelNames';
import { fill } from '../../words';
import type { PixelAvatarDef } from '../../types';

interface Props {
  draft: PixelAvatarDef;
  commit: (next: PixelAvatarDef) => void;
  t: any;
}

const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const box = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-current-accent';
const TRIES: [string, string][] = [['layout', '#f43f5e'], ['green', ''], ['yellow', ''], ['blue', ''], ['night-vision', '']];

/** A part to choose, shown as its swatch and name. */
const PartSelect = ({ parts, value, set, data }: { parts: PixelAvatarDef['parts']; value: string; set: (v: string) => void; data?: string }) => (
  <select value={value} onChange={(e) => set(e.target.value)} className={box} data-pixel-setup={data}>
    {parts.map((p) => <option key={p.char} value={p.char}>{p.name} ({p.char})</option>)}
  </select>
);

/** Several parts to choose, as swatches that light up when chosen. */
const PartChips = ({ parts, chosen, toggle, by = 'id', data }: { parts: PixelAvatarDef['parts']; chosen: string[]; toggle: (v: string) => void; by?: 'id' | 'char'; data?: string }) => (
  <div className="flex flex-wrap gap-1" data-pixel-setup={data}>
    {parts.map((p) => {
      const key = by === 'id' ? p.id : p.char;
      const on = chosen.includes(key);
      return (
        <button key={p.id} onClick={() => toggle(key)} title={p.name} data-pixel-chip={key}
          className={`flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded border text-[9px] ${on ? 'border-current-accent text-zinc-200' : 'border-zinc-800 text-zinc-600'}`}>
          <span className="w-3 h-3 rounded-sm" style={{ background: p.color }} />{p.name}
        </button>
      );
    })}
  </div>
);

export const PixelSetup = ({ draft, commit, t }: Props) => {
  const C = draft.colouring;
  const E = draft.eyes as any;
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setC = (changes: Partial<NonNullable<PixelAvatarDef['colouring']>>) => commit(setColouring(draft, { ...(C || { main: draft.parts[0].id, coloured: [], eyes: [], suit: null }), ...changes }));
  const setE = (changes: Record<string, any>) => commit(setEyes(draft, { ...E, ...changes }));
  const num = (v: string, lo = 0, hi = 99) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  const crop = pixelFaceCrop(draft);

  return (
    <div className="space-y-4" data-pixel-setup-panel>
      {/* ------------------------------------------------------------ colour */}
      <div className="space-y-2 rounded-xl border border-zinc-800 p-3">
        <label className="flex items-center gap-1.5 text-[10px] text-zinc-300">
          <input type="checkbox" checked={Boolean(C)} onChange={(e) => commit(setColouring(draft, e.target.checked ? { main: draft.parts.find((p) => /cloth|hoodie|sudadera|shirt/i.test(`${p.id} ${p.name}`))?.id || draft.parts[0].id, coloured: [], eyes: [], suit: null } : null))} className="accent-current-accent" data-pixel-setup="colouring-on" />
          {t.pixelSetupColour || 'It takes a colour — the layout’s, your own, a crewmate’s'}
        </label>
        {C && (
          <>
            <label className="block space-y-1">
              <span className={tag}>{t.pixelSetupMain || 'The part that becomes the colour exactly'}</span>
              <select value={C.main} onChange={(e) => setC({ main: e.target.value })} className={box} data-pixel-setup="main">
                {draft.parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <span className={tag}>{t.pixelSetupFollow || 'Parts that follow it, keeping how much lighter or darker they were drawn'}</span>
            <PartChips parts={draft.parts.filter((p) => p.id !== C.main)} chosen={C.coloured} toggle={(id) => setC({ coloured: toggleIn(C.coloured, id) })} data="coloured" />
            <span className={tag}>{t.pixelSetupEyes || 'Of those, its eyes — they take the hue, but softer'}</span>
            <PartChips parts={draft.parts.filter((p) => C.coloured.includes(p.id) && p.id !== C.main)} chosen={C.eyes} toggle={(id) => setC({ eyes: toggleIn(C.eyes, id) })} data="eye-parts" />
            <div className="flex flex-wrap gap-1.5 pt-1" data-pixel-setup-colour-tries>
              {TRIES.map(([colouring, accent]) => (
                <div key={colouring} className="w-14 aspect-square rounded border border-zinc-800 bg-zinc-950/70 p-0.5" title={colouring}>
                  <PixelKitAvatar kit={draft} colours={pixelColours(draft, colouring, { accent }) as Record<string, string>} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* -------------------------------------------------------------- eyes */}
      <div className="space-y-2 rounded-xl border border-zinc-800 p-3">
        <label className="flex items-center gap-1.5 text-[10px] text-zinc-300">
          <input type="checkbox" checked={Boolean(E)} onChange={(e) => commit(setEyes(draft, e.target.checked ? guessEyes(draft) : null))} className="accent-current-accent" data-pixel-setup="eyes-on" />
          {t.pixelSetupEyesMove || 'Its eyes move by themselves: glance about, half-shut into a blink, twinkle'}
        </label>
        {E && (
          <>
            <p className="text-[10px] text-zinc-600 leading-relaxed">{t.pixelSetupEyesHint || 'Where its eyes are, and what each of their colours is. A first guess is filled in: check it on the copies below, and the pixel numbers at the top of the canvas as you point.'}</p>
            <div className="space-y-1">
              <span className={tag}>{t.pixelSetupEyeColumns || 'Each eye’s columns, and the rows of both'}</span>
              {E.boxes.map((b: number[], i: number) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <input type="number" value={b[0]} onChange={(e) => setE({ boxes: E.boxes.map((x: number[], j: number) => (j === i ? [num(e.target.value), x[1]] : x)) })} className={`${box} w-16`} data-pixel-setup={`eye-${i}-from`} />
                  →
                  <input type="number" value={b[1]} onChange={(e) => setE({ boxes: E.boxes.map((x: number[], j: number) => (j === i ? [x[0], num(e.target.value)] : x)) })} className={`${box} w-16`} data-pixel-setup={`eye-${i}-to`} />
                  {E.boxes.length > 1 && <button onClick={() => setE({ boxes: E.boxes.filter((_: unknown, j: number) => j !== i) })} className="px-1.5 text-zinc-600 hover:text-rose-400">×</button>}
                </div>
              ))}
              {E.boxes.length < 4 && <button onClick={() => setE({ boxes: [...E.boxes, [E.boxes[E.boxes.length - 1][1] + 4, E.boxes[E.boxes.length - 1][1] + 14]] })} className="text-[9px] text-zinc-500 hover:text-white">+ {t.pixelSetupAddEye || 'another eye'}</button>}
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                {t.pixelSetupRows || 'rows'}
                <input type="number" value={E.rows[0]} onChange={(e) => setE({ rows: [num(e.target.value), E.rows[1]] })} className={`${box} w-16`} data-pixel-setup="rows-from" />
                →
                <input type="number" value={E.rows[1]} onChange={(e) => setE({ rows: [E.rows[0], num(e.target.value)] })} className={`${box} w-16`} data-pixel-setup="rows-to" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className={tag}>{t.pixelSetupShine || 'The sparkle'}</span><PartSelect parts={draft.parts} value={E.shine} set={(v) => setE({ shine: v })} data="shine" /></label>
              <label className="block space-y-1"><span className={tag}>{t.pixelSetupLine || 'The eye’s dark edge'}</span><PartSelect parts={draft.parts} value={E.line} set={(v) => setE({ line: v })} data="line" /></label>
              <label className="block space-y-1"><span className={tag}>{t.pixelSetupLid || 'The eyelid (skin)'}</span><PartSelect parts={draft.parts} value={E.lid} set={(v) => setE({ lid: v })} data="lid" /></label>
              <label className="block space-y-1"><span className={tag}>{t.pixelSetupLidLine || 'The lid’s edge'}</span><PartSelect parts={draft.parts} value={E.lidLine} set={(v) => setE({ lidLine: v })} data="lid-line" /></label>
              <label className="block space-y-1"><span className={tag}>{t.pixelSetupFillUpper || 'Where the iris was, above'}</span><PartSelect parts={draft.parts} value={E.fill[0]} set={(v) => setE({ fill: [v, E.fill[1]] })} /></label>
              <label className="block space-y-1"><span className={tag}>{t.pixelSetupFillLower || '…and below'}</span><PartSelect parts={draft.parts} value={E.fill[1]} set={(v) => setE({ fill: [E.fill[0], v] })} /></label>
              <label className="block space-y-1"><span className={tag}>{t.pixelSetupIrisUpper || 'The iris, above'}</span><PartSelect parts={draft.parts} value={E.irisFill[0]} set={(v) => setE({ irisFill: [v, E.irisFill[1]] })} /></label>
              <label className="block space-y-1"><span className={tag}>{t.pixelSetupIrisLower || '…and below'}</span><PartSelect parts={draft.parts} value={E.irisFill[1]} set={(v) => setE({ irisFill: [E.irisFill[0], v] })} /></label>
            </div>
            {([
              ['opening', t.pixelSetupOpening || 'Everything in the eye’s opening'],
              ['white', t.pixelSetupWhite || 'Its white, before the iris starts'],
              ['iris', t.pixelSetupIris || 'The iris and its ring'],
              ['lashChars', t.pixelSetupLashes || 'Lashes that go with the lid'],
            ] as const).map(([key, text]) => (
              <div key={key} className="space-y-1">
                <span className={tag}>{text}</span>
                <PartChips parts={draft.parts} by="char" chosen={[...String(E[key] || '')]} toggle={(c) => { const now = [...String(E[key] || '')]; const next = now.includes(c) ? now.filter((x) => x !== c) : [...now, c]; if (next.length) setE({ [key]: next.join('') }); }} data={key} />
              </div>
            ))}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-zinc-500">
              <label className="space-y-1 block">{t.pixelSetupSplit || 'Middle row'}<input type="number" value={E.split} onChange={(e) => setE({ split: num(e.target.value) })} className={box} /></label>
              <label className="space-y-1 block">{t.pixelSetupLidRow || 'Lid down to row'}<input type="number" value={E.lidRow} onChange={(e) => setE({ lidRow: num(e.target.value) })} className={box} /></label>
              <label className="space-y-1 block">{t.pixelSetupLashesFrom || 'Lashes from row'}<input type="number" value={E.lashes[0]} onChange={(e) => setE({ lashes: [num(e.target.value), E.lashes[1]] })} className={box} /></label>
              <label className="space-y-1 block">{t.pixelSetupLashesTo || '…to row'}<input type="number" value={E.lashes[1]} onChange={(e) => setE({ lashes: [E.lashes[0], num(e.target.value)] })} className={box} /></label>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1" data-pixel-setup-eye-tries>
              {([
                [t.pixelSetupTryRest || 'At rest', {}],
                [t.pixelSetupTryLeft || 'Looking left', { look: 'left' }],
                [t.pixelSetupTryUp || 'Looking up', { look: 'up' }],
                [t.pixelSetupTryHalf || 'Half shut', { half: true }],
                [t.pixelSetupTrySparkle || 'Twinkling', { sparkle: 'big' }],
              ] as [string, Record<string, any>][]).map(([label, eyes]) => (
                <div key={label} className="w-20 space-y-0.5">
                  <div className="aspect-[48/44] rounded border border-zinc-800 bg-zinc-950/70 overflow-hidden"><PixelKitAvatar kit={draft} eyes={eyes} crop={crop} /></div>
                  <span className="block text-[8px] text-zinc-500 text-center">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------- the outfit as drawn */}
      <div className="space-y-2 rounded-xl border border-zinc-800 p-3">
        <span className={tag}>{t.pixelSetupBaseOutfit || 'The outfit it was drawn in'}</span>
        <div className="grid grid-cols-2 gap-2">
          <input defaultValue={draft.baseLabel} key={`label:${draft.id}`} placeholder={t.pixelAsDrawn || 'As drawn'} maxLength={40} onBlur={(e) => commit(setBaseOutfit(draft, { label: e.target.value }))} className={box} data-pixel-setup="base-label" />
          <input defaultValue={draft.baseWords.join(', ')} key={`words:${draft.id}`} placeholder={fill(t.pixelSetupBaseWords || 'words viewers use: {e}', { e: 'classic, clásico' })} onBlur={(e) => commit(setBaseOutfit(draft, { words: e.target.value }))} className={box} data-pixel-setup="base-words" />
        </div>
      </div>
    </div>
  );
};
