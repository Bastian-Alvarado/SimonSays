/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Things placed on the welcome card by hand: a picture (a logo, a sticker),
 * the server's icon, an emoji, a plain shape — each with where it sits, how
 * big, turned how far, how see-through, and in front of or behind the avatar
 * and the words. At most MAX_CARD_LAYERS; listed bottom to top.
 *
 * Positions are in the card's own pixels, so a layer stays where it was put
 * whatever size the preview is drawn at; the corner buttons do the sums.
 */
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Upload, Images, ArrowUp, ArrowDown, Image as ImageIcon, Server, Smile, Square } from 'lucide-react';
import { MAX_CARD_LAYERS } from '../../shared/card-css.js';
import type { WelcomeCard, WelcomeCardLayer } from './WelcomeCardEditor';
import { EmojiField } from './EmojiField';
import { StillImg } from './StillPicture';

const label = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const num = 'w-full bg-zinc-950 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-300 outline-none focus:border-current-accent';
const MARGIN = 24;

export const WelcomeCardLayers = ({ card, set, listAssets, uploadAsset, customEmojis = [], t }: {
  card: WelcomeCard; set: (patch: Partial<WelcomeCard>) => void;
  listAssets: () => Promise<any[]>; uploadAsset: (file: File) => Promise<any>;
  /** The server's own emojis, for an emoji layer. */
  customEmojis?: any[]; t: any;
}) => {
  const layers: WelcomeCardLayer[] = card.layers || [];
  const [picking, setPicking] = useState<number | null>(null);
  const [assets, setAssets] = useState<{ url: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (picking !== null) listAssets().then((all) => setAssets((all || []).filter((a: any) => a.kind === 'image'))).catch(() => setAssets([]));
  }, [picking]);

  const save = (next: WelcomeCardLayer[]) => set({ layers: next });
  const patch = (i: number, p: Partial<WelcomeCardLayer>) => save(layers.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= layers.length) return;
    const next = [...layers];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const add = (kind: WelcomeCardLayer['kind']) => {
    const fresh: Record<string, WelcomeCardLayer> = {
      picture: { kind, src: '', x: card.width - 160 - MARGIN, y: MARGIN, width: 160, height: 160, rotate: 0, opacity: 1, front: true },
      server: { kind, x: card.width - 112 - MARGIN, y: MARGIN, width: 112, height: 112, rotate: 0, opacity: 1, front: true },
      emoji: { kind, emoji: '⭐', x: card.width - 96 - MARGIN, y: card.height - 96 - MARGIN, width: 96, height: 96, rotate: 0, opacity: 1, front: true },
      // A bar along the bottom: the shape most cards want.
      shape: { kind, shape: 'box', colour: '#ffffff', x: 0, y: card.height - 10, width: card.width, height: 10, rotate: 0, opacity: 1, front: false },
    };
    save([...layers, fresh[kind]]);
  };
  // Into a corner or the middle, a margin in from the edge.
  const place = (i: number, where: 'tl' | 'tr' | 'bl' | 'br' | 'c') => {
    const l = layers[i];
    const right = card.width - l.width - MARGIN;
    const bottom = card.height - l.height - MARGIN;
    const spot = {
      tl: { x: MARGIN, y: MARGIN }, tr: { x: right, y: MARGIN },
      bl: { x: MARGIN, y: bottom }, br: { x: right, y: bottom },
      c: { x: Math.round((card.width - l.width) / 2), y: Math.round((card.height - l.height) / 2) },
    }[where];
    patch(i, spot);
  };
  const upload = async (i: number, file?: File | null) => {
    if (!file) return;
    try {
      const saved = await uploadAsset(file);
      if (saved?.url) patch(i, { src: saved.url });
      setError('');
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const kinds: { kind: WelcomeCardLayer['kind']; icon: React.ReactNode; name: string }[] = [
    { kind: 'picture', icon: <ImageIcon size={11} />, name: t.cardLayerPicture || 'Picture' },
    { kind: 'server', icon: <Server size={11} />, name: t.cardLayerServer || 'Server icon' },
    { kind: 'emoji', icon: <Smile size={11} />, name: t.cardLayerEmoji || 'Emoji' },
    { kind: 'shape', icon: <Square size={11} />, name: t.cardLayerShape || 'Shape' },
  ];
  const nameOf = (k: string) => kinds.find((x) => x.kind === k)?.name || k;

  return (
    <div className="space-y-3" data-card-layers>
      <div className="flex flex-wrap items-center gap-2">
        <span className={label}>{t.cardLayers || 'Placed on the card'}</span>
        {layers.length < MAX_CARD_LAYERS && kinds.map((k) => (
          <button key={k.kind} onClick={() => add(k.kind)} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white" data-card-layer-add={k.kind}>
            <Plus size={10} /> {k.icon} {k.name}
          </button>
        ))}
      </div>
      {error && <p className="text-[10px] text-rose-400">{error}</p>}

      {layers.map((l, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 space-y-2.5" data-card-layer={l.kind}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">{nameOf(l.kind)}</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-400">
              <input type="checkbox" checked={l.front} onChange={(e) => patch(i, { front: e.target.checked })} className="accent-current-accent" />
              {t.cardLayerFront || 'In front of the avatar and words'}
            </label>
            <span className="ml-auto flex items-center gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30" title={t.cardLayerBack || 'Further back'}><ArrowUp size={11} /></button>
              <button onClick={() => move(i, 1)} disabled={i === layers.length - 1} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30" title={t.cardLayerForward || 'Further forward'}><ArrowDown size={11} /></button>
              <button onClick={() => save(layers.filter((_, j) => j !== i))} className="p-1 text-zinc-500 hover:text-rose-400" title={t.cardLayerRemove || 'Remove'}><Trash2 size={11} /></button>
            </span>
          </div>

          {l.kind === 'picture' && (
            <div className="flex items-center gap-2">
              {l.src ? <StillImg src={l.src} width={48} alt="" className="h-8 w-12 object-contain rounded border border-zinc-800" /> : <span className="text-[10px] text-zinc-600">{t.cardLayerNoPicture || 'No picture yet'}</span>}
              <label className="p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer" title={t.voicePicUpload || 'Upload'}>
                <Upload size={12} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(i, e.target.files?.[0]); e.currentTarget.value = ''; }} />
              </label>
              <button onClick={() => setPicking(picking === i ? null : i)} className="p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white" title={t.voicePicChoose || 'Choose an upload'}><Images size={12} /></button>
            </div>
          )}
          {picking === i && (
            <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto">
              {assets.length === 0 && <span className="col-span-6 text-[10px] text-zinc-600">{t.voicePicNoUploads || 'Nothing uploaded yet. Use the upload button.'}</span>}
              {assets.map((a) => (
                <button key={a.url} onClick={() => { patch(i, { src: a.url }); setPicking(null); }} className="aspect-square rounded border border-zinc-800 hover:border-current-accent overflow-hidden">
                  <StillImg src={a.url} width={64} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
          {l.kind === 'emoji' && (
            <EmojiField value={l.emoji || ''} onChange={(emoji) => patch(i, { emoji })} customEmojis={customEmojis} clearable={false} t={t} />
          )}
          {l.kind === 'shape' && (
            <div className="flex flex-wrap items-center gap-2">
              {(['box', 'circle'] as const).map((s) => (
                <button key={s} onClick={() => patch(i, { shape: s })} className={`px-2 py-1 rounded-md border text-[10px] font-bold ${(l.shape || 'box') === s ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-400'}`}>
                  {s === 'box' ? (t.cardShapeBox || 'Box') : (t.cardShapeCircle || 'Circle')}
                </button>
              ))}
              <input type="color" value={(l.colour || '#ffffff').slice(0, 7)} onChange={(e) => patch(i, { colour: e.target.value })} className="w-8 h-7 rounded border-none bg-transparent cursor-pointer" />
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            {(['x', 'y', 'width', 'height'] as const).map((f) => (
              <label key={f} className="block">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{{ x: 'X', y: 'Y', width: t.cardLayerWidth || 'W', height: t.cardLayerHeight || 'H' }[f]}</span>
                <input type="number" value={l[f]} onChange={(e) => patch(i, { [f]: Number(e.target.value) || 0 } as any)} className={num} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={label}>{t.cardLayerPlace || 'Put it'}</span>
            {([['tl', '↖'], ['tr', '↗'], ['c', '•'], ['bl', '↙'], ['br', '↘']] as const).map(([w, glyph]) => (
              <button key={w} onClick={() => place(i, w)} className="w-7 h-6 rounded-md border border-zinc-800 text-xs text-zinc-400 hover:text-white" data-card-layer-place={w}>{glyph}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>{t.cardLayerRotate || 'Turn'} — {l.rotate}°</span>
              <input type="range" min={-180} max={180} value={l.rotate} onChange={(e) => patch(i, { rotate: Number(e.target.value) })} className="w-full accent-current-accent" />
            </label>
            <label className="block">
              <span className={label}>{t.cardLayerOpacity || 'Opacity'} — {Math.round(l.opacity * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} value={l.opacity} onChange={(e) => patch(i, { opacity: Number(e.target.value) })} className="w-full accent-current-accent" />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
};
