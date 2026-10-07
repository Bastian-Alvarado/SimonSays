/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The welcome card: a picture posted with the welcome (or goodbye), drawn on
 * the server so it goes out whether or not anything is open.
 *
 * Built the way layers are: a few named parts, a stylesheet over them, looks
 * to start from and the stylesheet's own fields to turn. The preview is the
 * server's own drawing of it, asked for as things change, so what is shown
 * here is exactly what Discord gets.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, AlertTriangle, Palette } from 'lucide-react';
import { StyleFieldsPanel } from './StyleFieldsPanel';
import { WelcomeCardChoices } from './WelcomeCardChoices';
import { WelcomeCardLayers } from './WelcomeCardLayers';
import { PicturePick } from './PicturePick';
import { CARD_LOOKS } from '../../shared/card-looks.js';
import { CARD_PARTS, DEFAULT_CARD } from '../../shared/card-css.js';

/** One thing placed on the card by hand. See cleanCardLayer in shared/card-css.js. */
export interface WelcomeCardLayer {
  kind: 'picture' | 'server' | 'emoji' | 'shape';
  src?: string;
  emoji?: string;
  shape?: 'box' | 'circle';
  colour?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  opacity: number;
  front: boolean;
}

export interface WelcomeCard {
  enabled: boolean;
  width: number;
  height: number;
  title: string;
  name: string;
  subtitle: string;
  showAvatar: boolean;
  background: string;
  css: string;
  cssVars: Record<string, string>;
  // Each '' (or 0) is the look's own.
  layout?: '' | 'left' | 'right' | 'top';
  align?: '' | 'start' | 'center' | 'end';
  avatarShape?: '' | 'circle' | 'rounded' | 'square';
  avatarSize?: number;
  font?: string;
  nameColour?: '' | 'role' | 'own';
  nameColourValue?: string;
  backdrop?: '' | 'banner' | 'accent';
  layers?: WelcomeCardLayer[];
}

interface Props {
  kind: 'welcome' | 'goodbye' | 'boost' | 'ban';
  card?: Partial<WelcomeCard>;
  onChange: (next: WelcomeCard) => void;
  preview: (card: WelcomeCard, sample: Record<string, any>) => Promise<{ image?: string; ignored?: string[]; notes?: string[]; error?: string }>;
  onPreview?: (image: string) => void;
  listAssets: () => Promise<any[]>;
  uploadAsset: (file: File) => Promise<any>;
  /** The server's own emojis, for an emoji placed on the card. */
  customEmojis?: any[];
  t: any;
}

const SIZES = [
  { label: 'Banner', width: 1000, height: 320 },
  { label: 'Wide', width: 1100, height: 450 },
  { label: 'Square', width: 700, height: 700 },
];

const field = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-current-accent';
const label = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';

export const WelcomeCardEditor = ({ kind, card: incoming, onChange, preview, onPreview, listAssets, uploadAsset, customEmojis, t }: Props) => {
  // Each kind starts with words that fit it, until it is given its own.
  const starts: Record<string, Partial<WelcomeCard>> = {
    goodbye: { title: 'Goodbye', subtitle: '{count} of us now' },
    boost: { title: 'Thank you for the boost', subtitle: '{boosts} boosts' },
    ban: { title: 'Banned', subtitle: '{server}' },
  };
  const card: WelcomeCard = { ...DEFAULT_CARD, ...(!incoming?.title ? starts[kind] || {} : {}), ...(incoming || {}) } as WelcomeCard;
  const set = (patch: Partial<WelcomeCard>) => onChange({ ...card, ...patch });

  const [image, setImage] = useState('');
  const [ignored, setIgnored] = useState<string[]>([]);
  // What the server had to say about the choices: a font it cannot draw.
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(card.css);
  const asked = useRef(0);

  /*
    The things placed by hand, moved on the card itself: dragged to move,
    the corner pulled to resize (keeping their shape, from their top left).
    The box follows the pointer at once; the server's drawing a moment after
    letting go. Card pixels, like the layer settings below.
  */
  const cardBox = useRef<HTMLDivElement | null>(null);
  const held = useRef<{ i: number; mode: 'move' | 'size'; x: number; y: number; scale: number; from: WelcomeCardLayer } | null>(null);
  const [heldLayer, setHeldLayer] = useState<number | null>(null);
  const layers: WelcomeCardLayer[] = card.layers || [];
  const pressLayer = (i: number, mode: 'move' | 'size') => (e: React.PointerEvent) => {
    if (!cardBox.current) return;
    e.preventDefault();
    e.stopPropagation();
    const r = cardBox.current.getBoundingClientRect();
    held.current = { i, mode, x: e.clientX, y: e.clientY, scale: card.width / (r.width || 1), from: layers[i] };
    setHeldLayer(i);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const dragLayer = (e: React.PointerEvent) => {
    const h = held.current;
    if (!h) return;
    const dx = (e.clientX - h.x) * h.scale;
    const dy = (e.clientY - h.y) * h.scale;
    const next = h.mode === 'move'
      ? { x: Math.round(h.from.x + dx), y: Math.round(h.from.y + dy) }
      : (() => {
        // How far along its own diagonal the corner was pulled: across counts more for a wide thing, down for a tall one.
        const { width: w, height: hh } = h.from;
        const f = Math.max(((w + dx) * w + (hh + dy) * hh) / (w * w + hh * hh), 4 / Math.min(w, hh));
        return { width: Math.min(1600, Math.round(h.from.width * f)), height: Math.min(900, Math.round(h.from.height * f)) };
      })();
    set({ layers: layers.map((l, j) => (j === h.i ? { ...l, ...next } : l)) });
  };
  const letGoLayer = () => { held.current = null; setHeldLayer(null); };

  // The stylesheet box keeps its own text while it is being typed in.
  useEffect(() => { setDraft(card.css); }, [card.css]);

  /*
    Redrawn a moment after the last change, not on every keystroke: the
    server takes about half a second a card, and the newest answer wins.
  */
  // Everything that changes the picture: the whole card but whether it is on.
  const key = JSON.stringify({ ...card, enabled: undefined });
  useEffect(() => {
    if (!card.enabled) return undefined;
    const ticket = ++asked.current;
    setBusy(true);
    const id = setTimeout(async () => {
      try {
        const res = await preview(card, { name: t.welcomeCardSample || 'NewMember', server: t.welcomeCardServer || 'My Server', count: 42 });
        if (ticket !== asked.current) return;
        setError(res?.error || '');
        setIgnored(res?.ignored || []);
        setNotes(res?.notes || []);
        if (res?.image) { setImage(res.image); onPreview?.(res.image); }
      } catch (err: any) {
        if (ticket === asked.current) setError(err?.message || String(err));
      } finally {
        if (ticket === asked.current) setBusy(false);
      }
    }, 450);
    return () => clearTimeout(id);
  }, [key, card.enabled]);


  return (
    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4" data-welcome-card={kind}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-current-accent" />
          <span className="text-xs font-bold text-zinc-300">{t.welcomeCardTitle || 'Picture card'}</span>
        </div>
        <div onClick={() => set({ enabled: !card.enabled })} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${card.enabled ? 'bg-current-accent' : 'bg-zinc-700'}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${card.enabled ? 'translate-x-4' : ''}`} />
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 leading-relaxed">
        {t.welcomeCardHint || 'A picture of them, drawn by the server and posted with the message — as the card\'s big picture when the card is on. Styled like a layer: pick a look, turn its fields, or write your own CSS.'}
      </p>

      {card.enabled && (
        <div className="space-y-4 animate-slide-up">
          {/* The picture itself, as the server draws it. */}
          <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 min-h-[80px] grid place-items-center">
            {image ? (
              <div ref={cardBox} className="relative w-full select-none" data-welcome-card-box>
                <img src={image} alt="" draggable={false} className="w-full h-auto block" data-welcome-card-preview />
                {layers.map((l, i) => (
                  <div
                    key={i}
                    className={`absolute cursor-move touch-none outline outline-1 outline-dashed ${heldLayer === i ? 'outline-white' : 'outline-white/50 hover:outline-white'}`}
                    style={{
                      left: `${(l.x / card.width) * 100}%`, top: `${(l.y / card.height) * 100}%`,
                      width: `${(l.width / card.width) * 100}%`, height: `${(l.height / card.height) * 100}%`,
                      ...(l.rotate ? { transform: `rotate(${l.rotate}deg)` } : {}),
                    }}
                    onPointerDown={pressLayer(i, 'move')} onPointerMove={dragLayer} onPointerUp={letGoLayer} onPointerCancel={letGoLayer}
                    title={t.welcomeCardLayerDrag || 'Drag to move it; pull its corner to resize it'}
                    data-welcome-card-layer={i}
                  >
                    {/* A little more to take hold of all round: a thin stripe is still easy to grab. */}
                    <span className="absolute -inset-1.5" data-welcome-card-layer-grab={i} />
                    <span
                      className="absolute right-0 bottom-0 w-3 h-3 rounded-sm bg-white border border-zinc-900 cursor-nwse-resize touch-none"
                      onPointerDown={pressLayer(i, 'size')} onPointerMove={dragLayer} onPointerUp={letGoLayer} onPointerCancel={letGoLayer}
                      data-welcome-card-layer-size={i}
                    />
                  </div>
                ))}
              </div>
            ) : <span className="text-[10px] text-zinc-600 py-8">{t.welcomeCardDrawing || 'Drawing…'}</span>}
            {busy && <Loader2 size={14} className="absolute top-2 right-2 animate-spin text-zinc-400" />}
          </div>
          {layers.length > 0 && <p className="text-[10px] text-zinc-500">{t.welcomeCardLayersDragHint || 'Things placed by hand can be dragged on the card, and resized by their corner.'}</p>}
          {error && <p className="text-[10px] text-rose-400 flex items-center gap-1"><AlertTriangle size={11} /> {error}</p>}
          {ignored.length > 0 && (
            <p className="text-[10px] text-amber-400">
              {t.welcomeCardIgnored || 'A picture has no pseudo-elements, states or nested parts, so these rules were skipped:'} <code className="font-mono">{ignored.join(', ')}</code>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className={label}>{t.welcomeCardLine1 || 'Top line'}</span>
              <input value={card.title} onChange={(e) => set({ title: e.target.value })} className={field} maxLength={120} />
            </label>
            <label className="space-y-1 block">
              <span className={label}>{t.welcomeCardLine2 || 'Name'}</span>
              <input value={card.name} onChange={(e) => set({ name: e.target.value })} className={field} maxLength={120} />
            </label>
            <label className="space-y-1 block col-span-2">
              <span className={label}>{t.welcomeCardLine3 || 'Bottom line'}</span>
              <input value={card.subtitle} onChange={(e) => set({ subtitle: e.target.value })} className={field} maxLength={160} />
            </label>
          </div>
          <p className="text-[10px] text-zinc-600">{t.welcomeCardVars || '{username} is their name, {server} the server, {count} how many are in it. A line left empty is left off.'}</p>

          <div className="flex flex-wrap items-center gap-2">
            {SIZES.map((s) => (
              <button
                key={s.label} onClick={() => set({ width: s.width, height: s.height })}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${card.width === s.width && card.height === s.height ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {s.label} {s.width}×{s.height}
              </button>
            ))}
            <input type="number" value={card.width} min={300} max={1600} onChange={(e) => set({ width: Number(e.target.value) })} className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200" />
            <span className="text-zinc-600 text-xs">×</span>
            <input type="number" value={card.height} min={150} max={900} onChange={(e) => set({ height: Number(e.target.value) })} className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200" />
            <label className="ml-auto flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={card.showAvatar} onChange={(e) => set({ showAvatar: e.target.checked })} className="accent-current-accent" />
              <span className="text-[10px] text-zinc-400">{t.welcomeCardAvatar || 'Their avatar'}</span>
            </label>
          </div>

          {/* A picture behind everything, as [data-card="background"]. */}
          <div className="space-y-1.5" data-welcome-card-background>
            <span className={label}>{t.welcomeCardBackground || 'Background picture'}</span>
            <PicturePick wide value={card.background || ''} onChange={(background) => set({ background })} listAssets={listAssets} uploadAsset={uploadAsset} t={t} />
          </div>

          {/* The layout, the font, and what comes from the person — without CSS. */}
          <WelcomeCardChoices card={card} set={set} notes={notes} t={t} />

          {/* A picture, the server's icon, an emoji or a shape, placed by hand. */}
          <WelcomeCardLayers card={card} set={set} listAssets={listAssets} uploadAsset={uploadAsset} customEmojis={customEmojis} t={t} />

          {/* Looks to start from: each replaces the stylesheet, and its fields appear below. */}
          <div className="space-y-2">
            <span className={`${label} flex items-center gap-1`}><Palette size={11} /> {t.welcomeCardLooks || 'Looks'}</span>
            <div className="flex flex-wrap gap-2">
              {CARD_LOOKS.map((look) => (
                <button
                  key={look.id} title={look.hint}
                  onClick={() => set({ css: look.css, cssVars: {} })}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${card.css === look.css ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  {look.name}
                </button>
              ))}
            </div>
          </div>

          <StyleFieldsPanel css={card.css} vars={card.cssVars} patch={(vars) => set({ cssVars: vars })} t={t} />

          <label className="block space-y-1">
            <span className={label}>{t.welcomeCardCss || 'Custom CSS'}</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { if (draft !== card.css) set({ css: draft }); }}
              spellCheck={false}
              rows={10}
              placeholder={':scope { background-color: #0f0f12; }\n[data-card="name"] { color: #f43f5e; }'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-200 outline-none focus:border-current-accent"
            />
          </label>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            {t.welcomeCardCssHint || 'Aim rules at :scope (the card) and its parts:'}{' '}
            {CARD_PARTS.filter((p) => p !== 'card').map((p) => <code key={p} className="font-mono text-zinc-400 mr-1.5">[data-card="{p}"]</code>)}
            {' '}{t.welcomeCardCssHint2 || '— custom properties, var() and !important work; a line --x: #fff; /* Label */ becomes a field. Faces: Montserrat, Baloo 2, Chakra Petch, VT323, Special Elite.'}
          </p>
        </div>
      )}
    </div>
  );
};
