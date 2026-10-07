/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A Discord page as Discord will show it, either way it can be posted:
 *
 *   - classic: a message per block under one name — banners bare, cards as
 *     embeds with fields side by side, gaps as empty lines, reactions under
 *     the message they belong to.
 *   - one message: banners bare, cards as boxes with the same coloured edge
 *     and their fields stacked, gaps as space or a line, every reaction under
 *     the one message.
 *
 * Discord's markdown is drawn too — bold, links, headings, small print,
 * server emojis, mentions by name — since a page is mostly words.
 */
import React, { useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import { BannerCaption, BannerInset, DiscordPage, DiscordPageBlock } from '../types';
import { EmojiGlyph } from './EmojiField';
import { StillImg } from './StillPicture';
import { httpBase } from '../hooks/useBackend';

/** An upload is served by the server, which in development is not where the page came from. */
export const pictureSrc = (src?: string) => (src && src.startsWith('/') ? `${httpBase()}${src}` : src || '');

export interface Names {
  roles?: { id: string; name: string; color?: number }[];
  channels?: { id: string; name: string }[];
  /** People a mention may name, by id: a welcome's newcomer, say. */
  users?: Record<string, string>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const roleColour = (n?: number) => (n ? `#${n.toString(16).padStart(6, '0')}` : '#c9cdfb');

/** One line's words: emojis, mentions, links and emphasis. Everything else is shown as typed, escaped. */
function inline(raw: string, names: Names): string {
  const kept: string[] = [];
  const keep = (html: string) => `\u0001${kept.push(html) - 1}\u0002`;
  let s = raw
    .replace(/<(a?):([\w~-]+):(\d+)>/g, (_m, a, n, id) => keep(`<img src="https://cdn.discordapp.com/emojis/${id}.${a ? 'gif' : 'png'}?size=48" alt=":${esc(n)}:" title=":${esc(n)}:" style="display:inline-block;width:1.375em;height:1.375em;vertical-align:-0.3em;object-fit:contain">`))
    .replace(/<@&(\d+)>/g, (_m, id) => {
      const role = names.roles?.find((r) => r.id === id);
      const c = roleColour(role?.color);
      return keep(`<span style="color:${c};background:${c}26;border-radius:3px;padding:0 2px;font-weight:500">@${esc(role?.name || 'role')}</span>`);
    })
    .replace(/<#(\d+)>/g, (_m, id) => keep(`<span style="color:#c9cdfb;background:#5865f24d;border-radius:3px;padding:0 2px;font-weight:500"># ${esc(names.channels?.find((c) => c.id === id)?.name || 'channel')}</span>`))
    .replace(/<@!?(\d+)>/g, (_m, id) => keep(`<span style="color:#c9cdfb;background:#5865f24d;border-radius:3px;padding:0 2px;font-weight:500">@${esc(names.users?.[id] || 'user')}</span>`))
    .replace(/@(everyone|here)\b/g, (m) => keep(`<span style="color:#c9cdfb;background:#5865f24d;border-radius:3px;padding:0 2px;font-weight:500">${m}</span>`))
    .replace(/`([^`\n]+)`/g, (_m, c) => keep(`<code style="background:#2b2d31;border-radius:3px;padding:0 3px;font-size:85%">${esc(c)}</code>`))
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\s*\)/g, (_m, label, url) => keep(`<a href="${esc(url)}" target="_blank" rel="noreferrer" style="color:#00a8fc">${esc(label)}</a>`))
    .replace(/https?:\/\/[^\s<]+/g, (url) => keep(`<a href="${esc(url)}" target="_blank" rel="noreferrer" style="color:#00a8fc">${esc(url)}</a>`));
  s = esc(s)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<u>$1</u>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/\|\|([^|\n]+)\|\|/g, '<span style="background:#1e1f22;color:#1e1f22;border-radius:3px">$1</span>');
  return s.replace(/\u0001(\d+)\u0002/g, (_m, i) => kept[Number(i)]);
}

/** Discord's markdown, a line at a time: headings, small print, quotes and lists, then the words in them. */
export function discordHtml(text: string, names: Names): string {
  return String(text || '').split('\n').map((line) => {
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,3}) (.+)$/.exec(line))) {
      const size = ['', '1.5rem', '1.25rem', '1rem'][m[1].length];
      return `<div style="font-weight:700;font-size:${size};line-height:1.375;margin:4px 0 2px;color:#f2f3f5">${inline(m[2], names)}</div>`;
    }
    if ((m = /^-# (.+)$/.exec(line))) return `<div style="font-size:0.75rem;color:#949ba4">${inline(m[1], names)}</div>`;
    if ((m = /^>>?>? ?(.*)$/.exec(line))) return `<div style="border-left:4px solid #4e5058;padding-left:8px">${inline(m[1], names) || '&nbsp;'}</div>`;
    if ((m = /^\s*[-*] (.+)$/.exec(line))) return `<div style="padding-left:16px;text-indent:-10px">• ${inline(m[1], names)}</div>`;
    return `<div>${inline(line, names) || '&nbsp;'}</div>`;
  }).join('');
}

const Markdown = ({ text, names, className = '' }: { text: string; names: Names; className?: string }) => (
  <div className={`break-words ${className}`} dangerouslySetInnerHTML={{ __html: discordHtml(text, names) }} />
);

/** A picture in a message; `still` shows its first frame, no bigger than `width`, rather than letting it move. */
const Picture = ({ src, className = '', still = false, width = 520 }: { src?: string; className?: string; still?: boolean; width?: number }) => {
  if (!src) return <div className={`${className} bg-[#2b2d31] grid place-items-center text-[10px] text-[#949ba4] min-h-[60px]`}>?</div>;
  const failed = (e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.opacity = '0.2'; };
  return still
    ? <StillImg src={pictureSrc(src)} width={width} alt="" className={className} onError={failed} />
    : <img src={pictureSrc(src)} alt="" className={className} onError={failed} />;
};

/**
 * How big Discord shows a picture in a message: as wide as a card beside it,
 * and no taller than this — a tall one is made narrower to fit, a wide one
 * fills the width. Was capped at 260 pixels tall, which drew a 16:9 banner
 * narrower than the card under it (and than Discord does) once it was drawn.
 */
const SHOWN = { width: 520, height: 350 };
const shownClass = 'block rounded-lg max-w-[min(100%,520px)] max-h-[350px] w-auto h-auto';

const BANNER_AT = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;
const BANNER_ALIGN = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

/**
 * A banner with its words and its picture inside laid over it the way the
 * server draws them (engine/banner-text.js): sizes as shares of the banner's
 * height, places as shares of its width and height — so it reads the same at
 * any width, at once, while the real drawing is made.
 *
 * `onInset` and `onCaption` make the picture inside and the words movable:
 * dragged to move them, a corner pulled to make them bigger or smaller
 * around their middle. Words dragged for the first time start from wherever
 * their position put them. `onHold` is told when a drag starts and ends.
 *
 * Its pictures are stills (StillPicture.tsx) unless `moving`: in the editor
 * they are only something to place things on.
 */
export const BannerArt = ({ block, className = '', onInset, onCaption, onHold, fit = false, moving = false, t }: {
  block: DiscordPageBlock; className?: string; onInset?: (patch: Partial<BannerInset>) => void; onCaption?: (patch: Partial<BannerCaption>) => void;
  onHold?: (holding: boolean) => void;
  /** Sized as Discord shows a picture in a message (the preview), rather than as wide as there is room (the editor). */
  fit?: boolean;
  /** The pictures as they are, moving if they move: the preview's. */
  moving?: boolean;
  t?: any;
}) => {
  const [ratio, setRatio] = useState(0);
  const [insetRatio, setInsetRatio] = useState(1);
  const box = useRef<HTMLDivElement | null>(null);
  const wordsEl = useRef<HTMLDivElement | null>(null);
  const held = useRef<{
    what: 'inset' | 'words'; mode: 'move' | 'size'; x: number; y: number; w: number; h: number; left: number; top: number;
    fromX: number; fromY: number; fromSize: number; cx: number; cy: number; reach: number;
  } | null>(null);
  const caption = block.caption && String(block.caption.text || '').trim() ? block.caption : null;
  const inset = block.inset?.image ? block.inset : null;
  const placed = caption && caption.x !== null && caption.x !== undefined && caption.y !== null && caption.y !== undefined;

  const press = (what: 'inset' | 'words', mode: 'move' | 'size') => (e: React.PointerEvent) => {
    const on = what === 'inset' ? onInset && inset : onCaption && caption;
    if (!on || !box.current) return;
    e.preventDefault();
    e.stopPropagation();
    const r = box.current.getBoundingClientRect();
    let fromX = inset?.x ?? 50;
    let fromY = inset?.y ?? 50;
    let fromSize = inset?.size ?? 60;
    let cx = r.left + (fromX / 100) * r.width;
    let cy = r.top + (fromY / 100) * r.height;
    if (what === 'words' && caption) {
      // Where the words are now, whether placed by hand or by their position.
      const wr = wordsEl.current?.getBoundingClientRect();
      cx = wr ? wr.left + wr.width / 2 : r.left + r.width / 2;
      cy = wr ? wr.top + wr.height / 2 : r.top + r.height / 2;
      fromX = placed ? Number(caption.x) : ((cx - r.left) / r.width) * 100;
      fromY = placed ? Number(caption.y) : ((cy - r.top) / r.height) * 100;
      fromSize = caption.size || 30;
    }
    held.current = {
      what, mode, x: e.clientX, y: e.clientY, w: r.width, h: r.height, left: r.left, top: r.top,
      fromX, fromY, fromSize, cx, cy, reach: Math.max(1, Math.hypot(e.clientX - cx, e.clientY - cy)),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onHold?.(true);
  };
  const drag = (e: React.PointerEvent) => {
    const h = held.current;
    if (!h) return;
    const round = (n: number) => Math.round(n * 10) / 10;
    const at = {
      x: round(Math.min(100, Math.max(0, h.fromX + ((e.clientX - h.x) / h.w) * 100))),
      y: round(Math.min(100, Math.max(0, h.fromY + ((e.clientY - h.y) / h.h) * 100))),
    };
    if (h.what === 'words') {
      if (h.mode === 'move') onCaption?.(at);
      // Bigger or smaller by how much further from their middle the corner is pulled.
      else onCaption?.({ size: Math.round(Math.min(60, Math.max(8, h.fromSize * (Math.hypot(e.clientX - h.cx, e.clientY - h.cy) / h.reach)))) });
      return;
    }
    if (h.mode === 'move') {
      onInset?.(at);
    } else {
      // Around its middle: half its height is how far the corner is, across or down, whichever is more.
      const half = Math.max(Math.abs(e.clientY - h.cy), Math.abs(e.clientX - h.cx) / (insetRatio || 1));
      onInset?.({ size: round(Math.min(200, Math.max(5, ((half * 2) / h.h) * 100))) });
    }
  };
  const let_go = () => {
    if (held.current) onHold?.(false);
    held.current = null;
  };
  const handle = (what: 'inset' | 'words') => (
    <span
      className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm bg-white border border-zinc-900 cursor-nwse-resize touch-none pointer-events-auto"
      onPointerDown={press(what, 'size')} onPointerMove={drag} onPointerUp={let_go} onPointerCancel={let_go}
      data-banner-size-handle={what}
    />
  );
  const wordsStyle: React.CSSProperties | null = caption && {
    fontFamily: caption.font || 'Montserrat',
    fontWeight: caption.weight || 400,
    fontSize: `${(caption.size || 30) * ratio}cqw`,
    lineHeight: 1.15,
    color: caption.color || '#ffffff',
    textAlign: caption.align || 'center',
    whiteSpace: 'pre-wrap',
    ...(caption.shadow !== false ? { textShadow: '0 0.04em 0.18em rgba(0,0,0,0.6)' } : {}),
    ...(caption.outline ? { WebkitTextStroke: '0.06em rgba(0,0,0,0.85)' } : {}),
  };
  const words = caption && wordsStyle && (
    <div ref={wordsEl} style={wordsStyle}
      className={onCaption ? 'relative pointer-events-auto cursor-move touch-none outline outline-1 outline-dashed outline-white/60 hover:outline-white' : ''}
      onPointerDown={press('words', 'move')} onPointerMove={drag} onPointerUp={let_go} onPointerCancel={let_go}
      title={onCaption ? (t?.bannerWordsDrag || 'Drag to move the words; pull their corner to resize them') : undefined}
      data-banner-words-art>
      {caption.text}
      {onCaption && handle('words')}
    </div>
  );

  return (
    <div ref={box} className={`relative overflow-hidden select-none ${className}`} data-banner-art
      style={{
        containerType: 'inline-size',
        ...(fit ? { maxWidth: ratio ? `min(100%, ${SHOWN.width}px, ${Math.floor(SHOWN.height / ratio)}px)` : `min(100%, ${SHOWN.width}px)` } : {}),
      } as React.CSSProperties}>
      {moving
        ? <img src={pictureSrc(block.image)} alt="" draggable={false} className="block w-full"
          onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setRatio(i.naturalHeight / i.naturalWidth); }} />
        : <StillImg src={pictureSrc(block.image)} width={SHOWN.width} alt="" draggable={false} className="block w-full"
          onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setRatio(i.naturalHeight / i.naturalWidth); }} />}
      {inset && (
        <div
          className={`absolute ${onInset ? 'cursor-move touch-none outline outline-1 outline-dashed outline-white/60 hover:outline-white' : ''}`}
          style={{ left: `${inset.x}%`, top: `${inset.y}%`, height: `${inset.size}%`, transform: 'translate(-50%, -50%)' }}
          onPointerDown={press('inset', 'move')} onPointerMove={drag} onPointerUp={let_go} onPointerCancel={let_go}
          title={onInset ? (t?.bannerInsetDrag || 'Drag to move it; pull its corner to resize it') : undefined}
          data-banner-inset
        >
          {moving
            ? <img src={pictureSrc(inset.image)} alt="" draggable={false} className="h-full w-auto max-w-none block"
              onLoad={(e) => { const i = e.currentTarget; if (i.naturalHeight) setInsetRatio(i.naturalWidth / i.naturalHeight); }} />
            : <StillImg src={pictureSrc(inset.image)} width={SHOWN.width} alt="" draggable={false} className="h-full w-auto max-w-none block"
              onLoad={(e) => { const i = e.currentTarget; if (i.naturalHeight) setInsetRatio(i.naturalWidth / i.naturalHeight); }} />}
          {onInset && handle('inset')}
        </div>
      )}
      {caption && ratio > 0 && (placed ? (
        // Placed by hand: their middle on the spot, centred in a box four times the banner's size around it, as the server draws them.
        <div className="absolute flex items-center justify-center pointer-events-none"
          style={{ left: `${Number(caption.x) - 200}%`, top: `${Number(caption.y) - 200}%`, width: '400%', height: '400%' }}>
          {words}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col pointer-events-none"
          style={{ justifyContent: BANNER_AT[caption.at] || 'center', alignItems: BANNER_ALIGN[caption.align] || 'center', padding: `${8 * ratio}% 5%` }}>
          {words}
        </div>
      ))}
    </div>
  );
};

const Reactions = ({ list }: { list?: string[] }) => (list?.length ? (
  <div className="flex flex-wrap gap-1 mt-1">
    {list.map((e) => (
      <span key={e} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[#5865f2]/20 border border-[#5865f2] text-[12px] text-[#dee0fc]">
        <EmojiGlyph value={e} size={16} /> 1
      </span>
    ))}
  </div>
) : null);

const LinkButtons = ({ block }: { block: DiscordPageBlock }) => {
  const shown = (block.buttons || []).filter((b) => b.url && (b.label || b.emoji));
  if (!shown.length) return <div className="text-[11px] text-[#949ba4] italic">—</div>;
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((b, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium text-white bg-[#4e5058]">
          {b.emoji && <EmojiGlyph value={b.emoji} size={16} />}{b.label}<span className="opacity-70 text-[11px]">↗</span>
        </span>
      ))}
    </div>
  );
};

/** A card as an embed: the coloured edge, small print, title, text, fields side by side, pictures, footer. */
const Embed = ({ b, page, names, still = false }: { b: DiscordPageBlock; page: DiscordPage; names: Names; still?: boolean }) => {
  const fields = (b.fields || []).filter((f) => f.name || f.value);
  return (
    <div className="flex max-w-[520px]" data-page-preview-embed>
      <div className="w-1 rounded-l shrink-0" style={{ background: b.color || page.color }} />
      <div className="bg-[#2b2d31] rounded-r p-3 pr-4 min-w-0 flex-1">
        <div className="flex gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            {b.author && <div className="text-[12px] font-semibold text-[#f2f3f5]" dangerouslySetInnerHTML={{ __html: inline(b.author, names) }} />}
            {b.title && <div className={`text-[15px] font-semibold ${b.url ? 'text-[#00a8fc]' : 'text-[#f2f3f5]'}`} dangerouslySetInnerHTML={{ __html: inline(b.title, names) }} />}
            {b.description && <Markdown text={b.description} names={names} className="text-[13.5px] leading-[1.375] text-[#dbdee1]" />}
            {fields.length > 0 && (
              <div className="grid grid-cols-3 gap-x-4 gap-y-2 pt-1">
                {fields.map((f, i) => (
                  <div key={i} className={f.inline ? 'col-span-1' : 'col-span-3'}>
                    {f.name && <div className="text-[13px] font-semibold text-[#f2f3f5]" dangerouslySetInnerHTML={{ __html: inline(f.name, names) }} />}
                    {f.value && <Markdown text={f.value} names={names} className="text-[13.5px] text-[#dbdee1]" />}
                  </div>
                ))}
              </div>
            )}
          </div>
          {b.thumbnail && <Picture src={b.thumbnail} className="w-20 h-20 rounded object-cover shrink-0" still={still} width={80} />}
        </div>
        {b.image && <Picture src={b.image} className="mt-3 rounded max-w-full" still={still} />}
        {b.footer && <div className="mt-2 text-[11px] text-[#949ba4]" dangerouslySetInnerHTML={{ __html: inline(b.footer, names) }} />}
      </div>
    </div>
  );
};

/** A card in the newer layout: a box with the coloured edge, its fields stacked. */
const Container = ({ b, page, names, still = false }: { b: DiscordPageBlock; page: DiscordPage; names: Names; still?: boolean }) => {
  const fields = (b.fields || []).filter((f) => f.name || f.value);
  const head = [b.author && `-# ${b.author}`, b.title && `### ${b.url ? `[${b.title}](${b.url})` : b.title}`, b.description].filter(Boolean).join('\n');
  return (
    <div className="flex max-w-[520px] rounded-lg overflow-hidden border border-[#3f4147]" data-page-preview-container>
      <div className="w-1 shrink-0" style={{ background: b.color || page.color }} />
      <div className="bg-[#393a41] p-3 min-w-0 flex-1 space-y-2">
        {(head || b.thumbnail) && (
          <div className="flex gap-3">
            {head && <Markdown text={head} names={names} className="flex-1 min-w-0 text-[13.5px] leading-[1.375] text-[#dbdee1]" />}
            {b.thumbnail && <Picture src={b.thumbnail} className="w-20 h-20 rounded object-cover shrink-0" still={still} width={80} />}
          </div>
        )}
        {fields.length > 0 && (
          <Markdown text={fields.map((f) => [f.name && `**${f.name}**`, f.value].filter(Boolean).join('\n')).join('\n\n')} names={names} className="text-[13.5px] leading-[1.375] text-[#dbdee1]" />
        )}
        {b.image && <Picture src={b.image} className="rounded-lg max-w-full" still={still} />}
        {b.footer && <Markdown text={`-# ${b.footer}`} names={names} />}
      </div>
    </div>
  );
};

const Header = ({ botName, t }: { botName?: string; t: any }) => (
  <div className="flex items-center gap-2 mb-1">
    <span className="font-semibold text-[15px] text-white">{botName || t.greetBotName || 'Your bot'}</span>
    <span className="bg-[#5865f2] text-white text-[10px] px-1 rounded font-semibold">APP</span>
    <span className="text-[11px] text-[#949ba4]">{t.pagePreviewToday || 'Today'}</span>
  </div>
);

/**
 * `active` is the block being edited, outlined; `onPick` makes a block
 * pressable, to go and edit it. `drawn` is each banner's drawing by the
 * server, by block, when it is of the banner as it is now.
 */
export const DiscordPagePreview = ({ page, names, botName, botAvatar, t, active, onPick, drawn, still = false }: {
  page: DiscordPage; names: Names; botName?: string; botAvatar?: string; t: any; active?: string | null; onPick?: (id: string) => void; drawn?: Record<string, string>;
  /** Pictures shown still rather than moving: chosen on the screen, for a page of big moving banners. */
  still?: boolean;
}) => {
  const single = page.style === 'single';
  const reactionsAll = single ? [...new Set(page.blocks.flatMap((b) => ((b.type === 'card' || b.type === 'text') ? b.reactions || [] : [])))] : [];

  const block = (b: DiscordPageBlock) => {
    if (b.type === 'banner') {
      // Drawn, being drawn, or a plain picture: each the size Discord shows it, so the preview does not jump when the drawing arrives.
      if (drawn?.[b.id]) return <Picture src={drawn[b.id]} className={shownClass} still={still} />;
      if (b.image && (String(b.caption?.text || '').trim() || b.inset?.image)) return <BannerArt block={b} fit moving={!still} className="rounded-lg" t={t} />;
      return <Picture src={b.image} className={shownClass} still={still} />;
    }
    if (b.type === 'card') return single ? <Container b={b} page={page} names={names} still={still} /> : <Embed b={b} page={page} names={names} still={still} />;
    if (b.type === 'text') return b.text?.trim() ? <Markdown text={b.text} names={names} className="text-[14.5px] leading-[1.375] text-[#dbdee1]" /> : <div className="h-5" />;
    if (b.type === 'gap') {
      if (!single) return <div className={b.size === 'large' ? 'h-11' : 'h-[22px]'} />;
      return <div className={b.size === 'large' ? 'py-4' : 'py-1.5'}>{b.line ? <div className="border-t border-[#3f4147] max-w-[520px]" /> : null}</div>;
    }
    return <LinkButtons block={b} />;
  };

  return (
    <div className="bg-[#313338] rounded-xl p-4 border border-[#2b2d31] font-sans text-sm shadow-xl" data-page-preview={page.style}>
      <div className="flex items-start gap-3">
        {botAvatar
          ? <img src={botAvatar} alt="" className="w-10 h-10 rounded-full shrink-0" />
          : <div className="w-10 h-10 rounded-full bg-[#5865f2] grid place-items-center shrink-0"><Bot size={20} className="text-white" /></div>}
        <div className="min-w-0 flex-1">
          <Header botName={botName} t={t} />
          {page.blocks.length === 0 && <div className="text-[12px] text-[#949ba4] italic py-4">{t.pageEmptyPreview || 'Add a block to see the page here.'}</div>}
          <div className={single ? 'space-y-2' : 'space-y-1'}>
            {page.blocks.map((b) => (
              <div key={b.id} data-page-preview-block={b.type} data-page-preview-id={b.id}
                onClick={onPick ? () => onPick(b.id) : undefined}
                title={onPick ? (t.pagePreviewPick || 'Press to edit this block') : undefined}
                className={`rounded-md ${onPick ? 'cursor-pointer' : ''}`}
                style={active === b.id ? { outline: '2px solid var(--current-accent)', outlineOffset: 3 } : undefined}>
                {block(b)}
                {!single && (b.type === 'card' || b.type === 'text') && <Reactions list={b.reactions} />}
              </div>
            ))}
          </div>
          {single && <Reactions list={reactionsAll} />}
        </div>
      </div>
    </div>
  );
};
