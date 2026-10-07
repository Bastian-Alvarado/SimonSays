/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord pages: a channel's standing posts — a welcome, the rules, the
 * links — built from blocks and posted by the bot, which can change them
 * later in place. Two ways to post one, chosen per page: a message per block
 * like MEE6, or the whole page as one message in Discord's newer layout.
 * A page can start from what a channel already has.
 *
 * The page being edited is a draft here, saved a moment after each change;
 * where it was posted, tested and read from come from the server.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Newspaper, Plus, Trash2, Image as ImageIcon, Square, Type, MoveVertical, Link2, Send, FlaskConical, Download, Loader2,
  ChevronDown, ChevronRight, Smile, Copy, AlertTriangle, CheckCircle2, Undo2, Radio, Braces, Play, Pause,
} from 'lucide-react';
import { BannerCaption, BannerInset, DiscordPage, DiscordPageBlock } from '../../types';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap } from '../../../shared/list-order.js';
import {
  cleanPage, singleMessage, classicMessages, countComponents, componentText, pageProblems, bannerDrawn, PAGE_LIMITS, PAGE_VARS, LIVE_STATUS_CARD,
  CAPTION_DEFAULTS, CAPTION_LIMITS, INSET_DEFAULTS, INSET_LIMITS,
} from '../../../shared/discord-pages.js';
import { OVERLAY_VARS } from '../../../shared/overlay-vars.js';
import { textChannels } from '../DiscordPicks';
import { refusalWords, fill } from '../../words';
import { EmojiPicker } from '../EmojiPicker';
import { EmojiField } from '../EmojiField';
import { DiscordPagePreview, BannerArt, pictureSrc } from '../DiscordPagePreview';
import { PicturePick } from '../PicturePick';
import { usePreviewStill } from '../StillPicture';
import { CARD_FACES } from '../WelcomeCardChoices';
import { useCustomFonts } from '../../hooks/useCustomFonts';
import { withDiscordText } from '../../discordEmoji';

interface Props {
  pages: DiscordPage[];
  control: (op: string, payload?: Record<string, any>) => Promise<any>;
  channels: { id: string; name: string; type: number }[];
  roles: { id: string; name: string; color?: number; managed?: boolean }[];
  emojis: any[];
  testChannelId?: string;
  listAssets: () => Promise<any[]>;
  uploadAsset: (file: File) => Promise<any>;
  botConnected: boolean;
  botName?: string;
  botAvatar?: string;
  t: any;
}

const box = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent';
const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const smallButton = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-40';
const newBlockId = () => `b-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const BLOCK_ICONS: Record<DiscordPageBlock['type'], React.ReactNode> = {
  banner: <ImageIcon size={13} />, card: <Square size={13} />, text: <Type size={13} />, gap: <MoveVertical size={13} />, links: <Link2 size={13} />,
};

function newBlock(type: DiscordPageBlock['type']): DiscordPageBlock {
  const id = newBlockId();
  if (type === 'banner') return { id, type, image: '' };
  if (type === 'card') return { id, type, author: '', title: '', url: '', description: '', color: '', fields: [], image: '', thumbnail: '', footer: '', reactions: [] };
  if (type === 'text') return { id, type, text: '', reactions: [] };
  if (type === 'gap') return { id, type, size: 'small', line: true };
  return { id, type, buttons: [{ label: '', url: '', emoji: '' }] };
}

/** Words with Discord's markdown, and buttons to put an emoji, a channel or a role where the cursor is. */
const RichText = ({ value, onChange, rows = 4, max, placeholder, emojis, channels, roles, t }: {
  value: string; onChange: (v: string) => void; rows?: number; max: number; placeholder?: string;
  emojis: any[]; channels: Props['channels']; roles: Props['roles']; t: any;
}) => {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const insert = (piece: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${piece}${value.slice(end)}`.slice(0, max);
    onChange(next);
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = start + piece.length; } });
  };
  const openEmoji = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;
    if (top + 400 > window.innerHeight) top = Math.max(8, rect.top - 408);
    if (left + 320 > window.innerWidth) left = window.innerWidth - 340;
    setAt({ top, left });
  };
  return (
    <div className="space-y-1">
      <textarea ref={area} value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} rows={rows} placeholder={placeholder} className={`${box} resize-y leading-relaxed`} />
      <div className="flex items-center gap-1.5 flex-wrap">
        <button type="button" onClick={openEmoji} className={smallButton} title={t.pageInsertEmoji || 'Insert an emoji'}><Smile size={11} /></button>
        <select value="" onChange={(e) => { if (e.target.value) insert(`<#${e.target.value}>`); }} className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-400 max-w-[130px]">
          <option value="">{t.pageInsertChannel || '# channel'}</option>
          {textChannels(channels).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
        </select>
        <select value="" onChange={(e) => { if (e.target.value) insert(e.target.value === 'everyone' ? '@everyone' : `<@&${e.target.value}>`); }} className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-400 max-w-[130px]">
          <option value="">{t.pageInsertRole || '@ role'}</option>
          <option value="everyone">@everyone</option>
          {(roles || []).filter((r) => r.name !== '@everyone').map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
        </select>
        <select value="" onChange={(e) => { if (e.target.value) insert(`{${e.target.value}}`); }} className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-400 max-w-[150px]" title={t.pageVarsHint || 'Filled in when posted, and kept up to date if the page is'} data-page-vars>
          <option value="">{t.pageInsertVar || '{ } live value'}</option>
          <optgroup label={t.pageVarsPage || 'This page'}>
            {PAGE_VARS.map((v: any) => <option key={v.name} value={v.name}>{v.name} — {v.label}</option>)}
          </optgroup>
          <optgroup label={t.pageVarsOverlay || 'Like the overlays'}>
            {OVERLAY_VARS.map((v: any) => <option key={v.name} value={v.name}>{v.name} — {v.label}</option>)}
          </optgroup>
        </select>
        <span className={`ml-auto text-[9px] ${value.length > max * 0.95 ? 'text-amber-400' : 'text-zinc-600'}`}>{value.length} / {max}</span>
      </div>
      {at && createPortal(
        <>
          <div className="fixed inset-0 z-[9990] bg-transparent" onClick={() => setAt(null)} />
          <EmojiPicker style={{ top: at.top, left: at.left }} onSelect={(emoji: string) => { insert(emoji); setAt(null); }} onClose={() => setAt(null)} customEmojis={emojis} />
        </>,
        document.body,
      )}
    </div>
  );
};

/** The emojis the bot reacts with under a message. */
const ReactionsEdit = ({ list, onChange, emojis, t }: { list: string[]; onChange: (v: string[]) => void; emojis: any[]; t: any }) => (
  <div className="flex items-center gap-2 flex-wrap" data-page-reactions>
    <span className={tag}>{t.pageReactions || 'Reactions'}</span>
    {list.map((e, i) => (
      <EmojiField key={`${e}-${i}`} size="sm" value={e} onChange={(next) => onChange(next ? list.map((x, j) => (j === i ? next : x)) : list.filter((_, j) => j !== i))} customEmojis={emojis} t={t} />
    ))}
    {list.length < PAGE_LIMITS.reactions && (
      <EmojiField size="sm" value="" clearable={false} onChange={(next) => { if (next && !list.includes(next)) onChange([...list, next]); }} customEmojis={emojis} title={t.pageAddReaction || 'Add a reaction'} t={{ ...t, greetNoRole: '+' }} />
    )}
  </div>
);

const PagesScreen = ({ pages, control, channels, roles, emojis, testChannelId, listAssets, uploadAsset, botConnected, botName, botAvatar, t }: Props) => {
  const list = pages || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = list.find((p) => p.id === selectedId) || null;
  const [draft, setDraft] = useState<DiscordPage | null>(null);
  const draftRef = useRef<DiscordPage | null>(null);
  const loadedFor = useRef<string | null>(null);
  const saveTimer = useRef<any>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [armed, setArmed] = useState('');
  const [importFrom, setImportFrom] = useState('');

  // A page just made or read is chosen before the server's copy of the list has it; one just removed is not chosen again.
  const waitingFor = useRef<string | null>(null);
  const removing = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId && list.some((p) => p.id === selectedId)) {
      if (waitingFor.current === selectedId) waitingFor.current = null;
      return;
    }
    if (selectedId && waitingFor.current === selectedId) return;
    const next = list.find((p) => p.id !== removing.current)?.id ?? null;
    if (next !== selectedId) setSelectedId(next);
  }, [list, selectedId]);
  // A page is loaded into the draft once, when it is chosen — later copies from the server would undo typing.
  useEffect(() => {
    if (selected && loadedFor.current !== selected.id) {
      loadedFor.current = selected.id;
      draftRef.current = selected;
      setDraft(selected);
      setArmed('');
    }
    if (!selected && !waitingFor.current && loadedFor.current) {
      loadedFor.current = null;
      draftRef.current = null;
      setDraft(null);
    }
  }, [selected]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  /** Choose a page, saving the one being left first if a change to it is still waiting. */
  const choose = (id: string | null, { fresh = false } = {}) => {
    if (saveTimer.current && draftRef.current?.id !== id) control('save', { page: draftRef.current }).catch(() => {});
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (fresh) waitingFor.current = id;
    if (!fresh) setResult(null);
    setSelectedId(id);
  };

  const saveNow = async () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (draftRef.current) await control('save', { page: draftRef.current });
  };
  const change = (patch: Partial<DiscordPage>) => {
    if (!draftRef.current) return;
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveNow().catch(() => {}); }, 700);
  };
  const setBlocks = (blocks: DiscordPageBlock[]) => change({ blocks });
  // From the latest draft, not the one this render saw: two quick changes in a row must both stay.
  const blocksNow = () => draftRef.current?.blocks || [];
  const updateBlock = (id: string, patch: Partial<DiscordPageBlock>) => setBlocks(blocksNow().map((b) => (b.id === id ? { ...b, ...patch } : b)));
  /** Change a block from what it is now: a list inside it changed twice in a row keeps both changes. */
  const editBlock = (id: string, fn: (b: DiscordPageBlock) => Partial<DiscordPageBlock>) => setBlocks(blocksNow().map((b) => (b.id === id ? { ...b, ...fn(b) } : b)));
  const blockOrder = useDragOrder(({ from, gap }) => setBlocks(moveToGap(blocksNow(), from, gap)));

  // The block being edited, kept in sight in the preview — which scrolls in its own box beside the blocks, never moving the page.
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const previewArea = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const area = previewArea.current;
    if (!area || !activeBlock || area.scrollHeight <= area.clientHeight) return;
    const shown = area.querySelector<HTMLElement>(`[data-page-preview-id="${activeBlock}"]`);
    if (!shown) return;
    const top = shown.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    if (top >= area.scrollTop && top + shown.offsetHeight <= area.scrollTop + area.clientHeight) return;
    area.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' });
  }, [activeBlock]);
  useEffect(() => { previewArea.current?.scrollTo({ top: 0 }); }, [draft?.id]);
  /** A block pressed in the preview: opened if it was folded, and brought into view among the blocks. */
  const pickBlock = (id: string) => {
    setActiveBlock(id);
    setCollapsed((s) => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; });
    requestAnimationFrame(() => document.querySelector(`[data-page-block-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  /** A new block goes at the end, or after the one it copies, and is the one being edited. */
  const addBlock = (block: DiscordPageBlock, after?: string) => {
    const next = [...blocksNow()];
    if (next.length >= PAGE_LIMITS.blocks) return;
    const at = after ? next.findIndex((x) => x.id === after) + 1 : next.length;
    next.splice(at > 0 ? at : next.length, 0, block);
    setBlocks(next);
    setActiveBlock(block.id);
  };

  /*
    A banner with words or a picture inside is drawn by the server, as it
    will go up: asked for a moment after it stops changing, and shown in the
    preview once it is of the banner as it is now. Meanwhile the screen lays
    them over it itself.
  */
  const fonts = useCustomFonts().filter((f) => !CARD_FACES.includes(f));
  // Moving pictures in the preview, or their first frames: a page of big moving banners is a lot for a browser to keep playing.
  const [stillPreview, setStillPreview] = usePreviewStill();
  const [drawings, setDrawings] = useState<Record<string, { look: string; src?: string; error?: string }>>({});
  const asked = useRef<Record<string, string>>({});
  const drawTimers = useRef<Record<string, any>>({});
  /*
    Nothing is asked for while something on a banner is being dragged: a
    hand that rests mid-drag would otherwise ask for a drawing of where it
    rested, seconds of work on the phone for a look that is gone. Letting go
    asks for the one it ended on.
  */
  const holding = useRef(false);
  const [letGo, setLetGo] = useState(0);
  const onHold = (now: boolean) => {
    holding.current = now;
    if (now) {
      for (const [id, timer] of Object.entries(drawTimers.current)) { clearTimeout(timer); delete asked.current[id]; }
    } else {
      setLetGo((n) => n + 1);
    }
  };
  const lookOf = (b: DiscordPageBlock) => JSON.stringify({ image: b.image, caption: String(b.caption?.text || '').trim() ? b.caption : null, inset: b.inset?.image ? b.inset : null });
  useEffect(() => {
    if (holding.current) return;
    for (const b of draft?.blocks || []) {
      if (!bannerDrawn(b)) continue;
      const look = lookOf(b);
      if (asked.current[b.id] === look) continue;
      asked.current[b.id] = look;
      clearTimeout(drawTimers.current[b.id]);
      drawTimers.current[b.id] = setTimeout(async () => {
        setDrawings((d) => ({ ...d, [b.id]: { look } }));
        try {
          const r = await control('draw', { block: b });
          setDrawings((d) => (d[b.id]?.look === look ? { ...d, [b.id]: { look, src: r?.src } } : d));
        } catch (err: any) {
          if (err?.code === 'banner_superseded') return;
          setDrawings((d) => (d[b.id]?.look === look ? { ...d, [b.id]: { look, error: refusalWords(t, err) || String(err?.message || err) } } : d));
        }
      }, 1200);
    }
  }, [draft?.blocks, letGo]);
  useEffect(() => () => { for (const timer of Object.values(drawTimers.current)) clearTimeout(timer); }, []);
  /** Each banner's drawing, where it is of the banner as it is now. */
  const drawnNow = useMemo(() => {
    const out: Record<string, string> = {};
    for (const b of draft?.blocks || []) {
      const d = drawings[b.id];
      if (d?.src && bannerDrawn(b) && d.look === lookOf(b)) out[b.id] = pictureSrc(d.src);
    }
    return out;
  }, [draft?.blocks, drawings]);

  // Counted exactly as the post will be.
  const clean = useMemo(() => (draft ? cleanPage(draft, draft) : null), [draft]);
  const counts = useMemo(() => {
    if (!clean) return null;
    if (clean.style === 'single') {
      const { body } = singleMessage(clean);
      return { pieces: countComponents(body.components), text: componentText(body.components), messages: 1 };
    }
    return { pieces: 0, text: 0, messages: classicMessages(clean).length };
  }, [clean]);
  const problems = useMemo(() => (clean ? pageProblems(clean) : []), [clean]);

  // One message or several, in the screen's language.
  const messages = (n: number) => (n === 1 ? (t.pageMessageOne || '1 message') : fill(t.pageMessages || '{count} messages', { count: n }));
  const channelName = (id?: string) => channels.find((c) => c.id === id)?.name || id || '';
  const names = { roles, channels };

  const arm = (key: string, run: () => void) => {
    if (armed === key) { setArmed(''); run(); return; }
    setArmed(key);
    setTimeout(() => setArmed((a) => (a === key ? '' : a)), 4000);
  };

  const act = async (op: string, payload: Record<string, any>, say: (r: any) => string) => {
    setBusy(op);
    setResult(null);
    try {
      if (op !== 'import' && op !== 'remove') await saveNow();
      const r = await control(op, payload);
      setResult({ ok: true, text: say(r) });
      return r;
    } catch (err: any) {
      setResult({ ok: false, text: refusalWords(t, err) || String(err?.message || err) });
      return null;
    } finally {
      setBusy('');
    }
  };

  const createPage = async () => {
    const r = await act('save', {
      page: { name: t.pageNewName || 'New page', style: 'single', color: '#fefefe', blocks: [{ ...newBlock('card'), title: t.pageStarterTitle || 'Welcome!', description: t.pageStarterText || 'Say hello to everybody here.' }] },
    }, () => t.pageCreated || 'Page made — build it below.');
    if (r?.id) choose(r.id, { fresh: true });
  };
  const duplicatePage = async () => {
    if (!draft) return;
    const r = await act('save', { page: { ...draft, id: undefined, name: `${draft.name} (2)`, blocks: draft.blocks.map((b) => ({ ...b, id: newBlockId() })) } }, () => t.pageDuplicated || 'Copied.');
    if (r?.id) choose(r.id, { fresh: true });
  };
  const importPage = async () => {
    const r = await act('import', { channelId: importFrom }, (p) => fill(t.pageImported || 'Read {count} blocks from #{channel}. Nothing in Discord was changed.', { count: p?.blocks?.length ?? 0, channel: channelName(importFrom) }));
    if (r?.id) choose(r.id, { fresh: true });
  };

  // Whether posting again edits what is up, or puts up a new copy.
  const posted = selected?.posted || null;
  const inPlace = !!(draft && posted && posted.channelId === draft.channelId && posted.style === draft.style
    && (draft.style === 'single' || (posted.kinds || []).join() === draft.blocks.map((b) => b.type).join()));

  const blockSummary = (b: DiscordPageBlock) => {
    if (b.type === 'banner') {
      const file = b.image ? decodeURIComponent(b.image.split('/').pop() || '') : (t.pageNoPicture || 'No picture yet');
      const words = String(b.caption?.text || '').trim().split('\n')[0];
      return words ? `“${words}” · ${file}` : file;
    }
    if (b.type === 'card') return b.title || (b.description || '').split('\n')[0] || (t.pageEmptyCard || 'Empty card');
    if (b.type === 'text') return (b.text || '').split('\n')[0] || '…';
    if (b.type === 'gap') return `${b.size === 'large' ? (t.pageGapLarge || 'Large') : (t.pageGapSmall || 'Small')}${b.line ? ` · ${t.pageGapLine || 'with a line'}` : ''}`;
    return fill(t.pageButtonsCount || '{count} buttons', { count: (b.buttons || []).filter((x) => x.url).length });
  };
  const blockName: Record<DiscordPageBlock['type'], string> = {
    banner: t.pageBlockBanner || 'Banner', card: t.pageBlockCard || 'Card', text: t.pageBlockText || 'Text', gap: t.pageBlockGap || 'Gap', links: t.pageBlockLinks || 'Link buttons',
  };

  /** Chips to choose one of a few. */
  const chips = (value: string, options: [string, string][], set: (v: string) => void, data: string) => (
    <div className="flex flex-wrap gap-1" data-banner-chips={data}>
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => set(v)} data-banner-chip={v}
          className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${value === v ? 'border-current-accent text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>
          {label}
        </button>
      ))}
    </div>
  );

  /** A banner: its picture, and the words and the picture inside that the server draws on it. */
  const bannerEditor = (b: DiscordPageBlock) => {
    const caption: BannerCaption = { ...CAPTION_DEFAULTS, ...(b.caption || {}) } as BannerCaption;
    const inset: BannerInset = { ...INSET_DEFAULTS, ...(b.inset || {}) } as BannerInset;
    const setCaption = (patch: Partial<BannerCaption>) => editBlock(b.id, (x) => ({ caption: { ...CAPTION_DEFAULTS, ...(x.caption || {}), ...patch } as BannerCaption }));
    const setInset = (patch: Partial<BannerInset>) => editBlock(b.id, (x) => ({ inset: { ...INSET_DEFAULTS, ...(x.inset || {}), ...patch } as BannerInset }));
    const drawing = drawings[b.id];
    const now = bannerDrawn(b) && drawing?.look === lookOf(b) ? drawing : null;
    const placedByHand = caption.x !== null && caption.x !== undefined && caption.y !== null && caption.y !== undefined;
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <PicturePick wide value={b.image || ''} onChange={(image) => updateBlock(b.id, { image })} listAssets={listAssets} uploadAsset={uploadAsset} t={t} />
          <p className="text-[10px] text-zinc-600">{t.pageBannerHint || 'Shown across the channel, on its own. PNG, JPEG, GIF or WebP, up to 5 MB.'}</p>
        </div>
        {b.image && (
          <div className="space-y-3 pt-3 border-t border-zinc-800/70" data-banner-on>
            <div>
              <span className={tag}>{t.bannerOnIt || 'On the picture'}</span>
              <p className="text-[10px] text-zinc-500 leading-snug mt-0.5">{t.bannerOnItHint || 'Words and a picture, drawn into the banner by your server the way MEE6 writes on one. A moving banner keeps moving.'}</p>
            </div>
            <BannerArt block={b} onInset={b.inset?.image ? setInset : undefined} onCaption={String(b.caption?.text || '').trim() ? setCaption : undefined} onHold={onHold} className="rounded-lg border border-zinc-800 max-w-[520px]" t={t} />
            {bannerDrawn(b) && (
              <p className={`text-[10px] flex items-center gap-1.5 ${now?.error ? 'text-rose-400' : now?.src ? 'text-emerald-400' : 'text-zinc-500'}`} data-banner-status>
                {now?.error ? <AlertTriangle size={11} /> : now?.src ? <CheckCircle2 size={11} /> : <Loader2 size={11} className="animate-spin" />}
                {now?.error || (now?.src ? (t.bannerDrawn || 'Drawn — the preview shows exactly what goes up.') : (t.bannerDrawing || 'Drawing it as Discord will show it… a moving banner takes a few seconds.'))}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 block sm:col-span-2"><span className={tag}>{t.bannerWords || 'Words'}</span>
                <textarea value={caption.text} rows={2} maxLength={CAPTION_LIMITS.text} placeholder={t.bannerWordsPlaceholder || 'Welcome!'}
                  onChange={(e) => setCaption({ text: e.target.value.split('\n').slice(0, CAPTION_LIMITS.lines).join('\n') })}
                  className={`${box} resize-none leading-relaxed`} data-banner-words />
              </label>
              <label className="space-y-1 block"><span className={tag}>{t.cardFont || 'Font'}</span>
                <select value={caption.font} onChange={(e) => setCaption({ font: e.target.value })} className={box} data-banner-font>
                  <optgroup label={t.cardFontsBundled || 'Built in'}>
                    {CARD_FACES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </optgroup>
                  {fonts.length > 0 && (
                    <optgroup label={t.cardFontsUploaded || 'Uploaded by you'}>
                      {fonts.map((f) => <option key={f} value={f}>{f}</option>)}
                    </optgroup>
                  )}
                </select>
              </label>
              <div className="space-y-1"><span className={tag}>{t.bannerWeight || 'Thickness'}</span>
                {chips(String(caption.weight), [['300', t.bannerWeightLight || 'Thin'], ['400', t.bannerWeightRegular || 'Regular'], ['700', t.bannerWeightBold || 'Bold'], ['900', t.bannerWeightBlack || 'Black']], (v) => setCaption({ weight: Number(v) }), 'weight')}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between"><span className={tag}>{t.bannerSize || 'Size'}</span><span className="text-[10px] font-mono text-current-accent">{caption.size}%</span></div>
                <input type="range" min={CAPTION_LIMITS.size[0]} max={CAPTION_LIMITS.size[1]} value={caption.size} onChange={(e) => setCaption({ size: Number(e.target.value) })} className="w-full accent-current-accent" data-banner-size />
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <label className="flex items-center gap-2">
                  <input type="color" value={caption.color} onChange={(e) => setCaption({ color: e.target.value })} className="w-7 h-7 bg-transparent border border-zinc-800 rounded cursor-pointer" data-banner-colour />
                  <span className="text-[10px] text-zinc-500">{t.bannerColour || 'Colour'}</span>
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer"><input type="checkbox" checked={caption.shadow} onChange={(e) => setCaption({ shadow: e.target.checked })} className="accent-current-accent" data-banner-shadow /> {t.bannerShadow || 'Shadow'}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer"><input type="checkbox" checked={caption.outline} onChange={(e) => setCaption({ outline: e.target.checked })} className="accent-current-accent" data-banner-outline /> {t.bannerOutline || 'Outline'}</label>
              </div>
              {/* Placed by hand, no position is lit: pressing one puts the words back in line with the edges. */}
              <div className="space-y-1"><span className={tag}>{t.bannerAt || 'Up or down'}</span>
                {chips(placedByHand ? '' : caption.at, [['top', t.bannerAtTop || 'Top'], ['middle', t.bannerAtMiddle || 'Middle'], ['bottom', t.bannerAtBottom || 'Bottom']], (v) => setCaption({ at: v as BannerCaption['at'], x: null, y: null }), 'at')}
              </div>
              <div className="space-y-1"><span className={tag}>{t.bannerAlign || 'Left or right'}</span>
                {chips(placedByHand ? '' : caption.align, [['left', t.bannerAlignLeft || 'Left'], ['center', t.bannerAlignCenter || 'Centred'], ['right', t.bannerAlignRight || 'Right']], (v) => setCaption({ align: v as BannerCaption['align'], x: null, y: null }), 'align')}
              </div>
              <p className="text-[10px] text-zinc-500 leading-snug sm:col-span-2" data-banner-words-hint>
                {placedByHand
                  ? (t.bannerWordsPlaced || 'Placed by hand. Press a position above to put them back in line.')
                  : (t.bannerWordsDragHint || 'Or drag the words on the banner to put them anywhere, and pull their corner to resize them.')}
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-zinc-800/70" data-banner-inset-edit>
              <span className={tag}>{t.bannerInset || 'A picture inside'}</span>
              <PicturePick value={inset.image} onChange={(image) => setInset({ image })} listAssets={listAssets} uploadAsset={uploadAsset} t={t} />
              {inset.image && (
                <>
                  <div className="flex items-center gap-3">
                    <span className={tag}>{t.bannerSize || 'Size'}</span>
                    <input type="range" min={INSET_LIMITS.size[0]} max={INSET_LIMITS.size[1]} value={inset.size} onChange={(e) => setInset({ size: Number(e.target.value) })} className="flex-1 accent-current-accent" data-banner-inset-slider />
                    <span className="text-[10px] font-mono text-current-accent w-10 text-right">{Math.round(inset.size)}%</span>
                    <button type="button" onClick={() => setInset({ x: 50, y: 50 })} className={smallButton} data-banner-inset-centre>{t.bannerInsetCentre || 'Centre it'}</button>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-snug">{t.bannerInsetHint || 'Drag it on the banner above to move it, and pull its corner to make it bigger or smaller. It goes under the words; a moving picture is drawn still.'}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const blockEditor = (b: DiscordPageBlock) => {
    const single = draft?.style === 'single';
    if (b.type === 'banner') return bannerEditor(b);
    if (b.type === 'text') {
      return (
        <div className="space-y-2">
          <RichText value={b.text || ''} onChange={(text) => updateBlock(b.id, { text })} max={PAGE_LIMITS.content} rows={4} emojis={emojis} channels={channels} roles={roles} t={t} />
          <ReactionsEdit list={b.reactions || []} onChange={(reactions) => updateBlock(b.id, { reactions })} emojis={emojis} t={t} />
        </div>
      );
    }
    if (b.type === 'gap') {
      return (
        <div className="flex items-center gap-4 flex-wrap">
          <select value={b.size} onChange={(e) => updateBlock(b.id, { size: e.target.value as any })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200">
            <option value="small">{t.pageGapSmall || 'Small'}</option>
            <option value="large">{t.pageGapLarge || 'Large'}</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!b.line} onChange={(e) => updateBlock(b.id, { line: e.target.checked })} className="accent-current-accent" />
            <span className="text-[11px] text-zinc-300">{t.pageGapLineLabel || 'Draw a line'}</span>
          </label>
          {!single && b.line && <span className="text-[10px] text-zinc-600">{t.pageGapLineClassic || 'A line shows only when the page is one message.'}</span>}
        </div>
      );
    }
    if (b.type === 'links') {
      const buttons = b.buttons || [];
      type Buttons = NonNullable<DiscordPageBlock['buttons']>;
      const setButtons = (fn: (list: Buttons) => Buttons) => editBlock(b.id, (x) => ({ buttons: fn(x.buttons || []) }));
      return (
        <div className="space-y-2">
          {buttons.map((x, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <EmojiField size="sm" value={x.emoji} onChange={(emoji) => setButtons((list) => list.map((y, j) => (j === i ? { ...y, emoji } : y)))} customEmojis={emojis} t={t} />
              <input value={x.label} onChange={(e) => setButtons((list) => list.map((y, j) => (j === i ? { ...y, label: e.target.value.slice(0, 80) } : y)))} placeholder={t.pageButtonLabel || 'Label'} className={`${box} sm:w-40`} />
              <input value={x.url} onChange={(e) => setButtons((list) => list.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} placeholder="https://…" className={`${box} ${x.url && !/^https?:\/\/\S+$/.test(x.url.trim()) ? 'border-rose-500/60' : ''}`} />
              <button type="button" onClick={() => setButtons((list) => list.filter((_, j) => j !== i))} className="p-1.5 text-zinc-500 hover:text-rose-400"><Trash2 size={12} /></button>
            </div>
          ))}
          {buttons.length < 5 && <button type="button" onClick={() => setButtons((list) => [...list, { label: '', url: '', emoji: '' }])} className={smallButton}><Plus size={11} /> {t.pageAddButton || 'Add a button'}</button>}
        </div>
      );
    }
    // A card.
    const fields = b.fields || [];
    type Fields = NonNullable<DiscordPageBlock['fields']>;
    const setFields = (fn: (list: Fields) => Fields) => editBlock(b.id, (x) => ({ fields: fn(x.fields || []) }));
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="space-y-1 block"><span className={tag}>{t.pageCardTitle || 'Title'}</span>
            <input value={b.title || ''} onChange={(e) => updateBlock(b.id, { title: e.target.value.slice(0, 256) })} className={box} /></label>
          <label className="space-y-1 block"><span className={tag}>{t.pageCardLink || 'Title opens (optional)'}</span>
            <input value={b.url || ''} onChange={(e) => updateBlock(b.id, { url: e.target.value })} placeholder="https://…" className={box} /></label>
        </div>
        <label className="space-y-1 block"><span className={tag}>{t.pageCardAuthor || 'Small print above the title (optional)'}</span>
          <input value={b.author || ''} onChange={(e) => updateBlock(b.id, { author: e.target.value.slice(0, 256) })} className={box} /></label>
        <div className="space-y-1"><span className={tag}>{t.pageCardText || 'Text'}</span>
          <RichText value={b.description || ''} onChange={(description) => updateBlock(b.id, { description })} max={4096} rows={6} emojis={emojis} channels={channels} roles={roles} t={t} /></div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={tag}>{t.pageCardFields || 'Fields'}</span>
            {single && fields.length > 0 && <span className="text-[10px] text-zinc-600">{t.pageFieldsStack || 'In one message, fields stack under each other.'}</span>}
          </div>
          {fields.map((f, i) => (
            <div key={i} className="flex gap-2 items-start bg-zinc-950/50 border border-zinc-800 rounded-xl p-2" data-page-field>
              <div className="flex-1 space-y-1 min-w-0">
                <input value={f.name} onChange={(e) => setFields((list) => list.map((g, j) => (j === i ? { ...g, name: e.target.value.slice(0, 256) } : g)))} placeholder={t.pageFieldName || 'Name'} className={box} />
                <RichText value={f.value} onChange={(value) => setFields((list) => list.map((g, j) => (j === i ? { ...g, value } : g)))} max={1024} rows={2} placeholder={t.pageFieldValue || 'Value'} emojis={emojis} channels={channels} roles={roles} t={t} />
              </div>
              <div className="flex flex-col items-end gap-2">
                <label className="flex items-center gap-1 cursor-pointer" title={t.pageFieldInlineHint || 'Side by side with the next field'}>
                  <input type="checkbox" checked={f.inline} onChange={(e) => setFields((list) => list.map((g, j) => (j === i ? { ...g, inline: e.target.checked } : g)))} className="accent-current-accent" />
                  <span className="text-[10px] text-zinc-400">{t.pageFieldInline || 'Side by side'}</span>
                </label>
                <button type="button" onClick={() => setFields((list) => list.filter((_, j) => j !== i))} className="p-1 text-zinc-500 hover:text-rose-400"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          {fields.length < 25 && <button type="button" onClick={() => setFields((list) => [...list, { name: '', value: '', inline: true }])} className={smallButton}><Plus size={11} /> {t.pageAddField || 'Add a field'}</button>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><span className={tag}>{t.pageCardImage || 'Picture under the text'}</span>
            <PicturePick wide value={b.image || ''} onChange={(image) => updateBlock(b.id, { image })} listAssets={listAssets} uploadAsset={uploadAsset} t={t} /></div>
          <div className="space-y-1"><span className={tag}>{t.pageCardThumbnail || 'Small picture on the right'}</span>
            <PicturePick value={b.thumbnail || ''} onChange={(thumbnail) => updateBlock(b.id, { thumbnail })} listAssets={listAssets} uploadAsset={uploadAsset} t={t} /></div>
        </div>
        <label className="space-y-1 block"><span className={tag}>{t.pageCardFooter || 'Footer (optional)'}</span>
          <input value={b.footer || ''} onChange={(e) => updateBlock(b.id, { footer: e.target.value.slice(0, 2048) })} className={box} /></label>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2">
            <input type="color" value={b.color || draft?.color || '#fefefe'} onChange={(e) => updateBlock(b.id, { color: e.target.value })} className="w-7 h-7 bg-transparent border border-zinc-800 rounded cursor-pointer" />
            <span className="text-[10px] text-zinc-500">{b.color ? (t.pageCardOwnColour || 'Its own colour') : (t.pageCardPageColour || 'The page colour')}</span>
          </label>
          {b.color && <button type="button" onClick={() => updateBlock(b.id, { color: '' })} className={smallButton}><Undo2 size={11} /> {t.pageUsePageColour || 'Use the page colour'}</button>}
        </div>
        <ReactionsEdit list={b.reactions || []} onChange={(reactions) => updateBlock(b.id, { reactions })} emojis={emojis} t={t} />
      </div>
    );
  };

  const resultLine = result && (
    <p className={`text-[11px] flex items-start gap-1.5 ${result.ok ? 'text-emerald-400' : 'text-rose-400'}`} data-page-result>
      {result.ok ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 shrink-0" />} {result.text}
    </p>
  );

  return (
    <div className="animate-fade-in space-y-6 pb-20" data-discord-pages>
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Newspaper size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.discordPagesNav || 'Discord pages'}</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {t.pagesHint || 'A channel\'s standing posts — a welcome, the rules, your links — built from banners, cards, text, gaps and buttons, and posted by your bot. It remembers what it posted, so changing a page later edits it in Discord instead of posting it again.'}
        </p>
        {!botConnected && <p className="text-[11px] text-amber-400">{t.voiceNoBot || 'The Discord bot is not connected. Connect it on the Connections screen first.'}</p>}

        <div className="flex items-center gap-2 flex-wrap" data-page-list>
          {list.map((p) => (
            <button key={p.id} onClick={() => choose(p.id)} data-page-pick={p.id}
              className={`px-3 py-2 rounded-xl border text-left transition-colors ${p.id === selectedId ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'}`}>
              <div className="text-[11px] font-bold text-white truncate max-w-[180px]">{withDiscordText(p.id === draft?.id ? draft.name : p.name, '1.15em')}</div>
              <div className="text-[9px] text-zinc-500">
                {p.style === 'single' ? (t.pageStyleSingleShort || 'One message') : (t.pageStyleClassicShort || 'Separate messages')}
                {p.posted ? ` · ${t.pagePostedShort || 'up'} #${channelName(p.posted.channelId)}` : ''}
              </div>
            </button>
          ))}
          <button onClick={createPage} disabled={!!busy || list.length >= 30} className={smallButton} data-page-new><Plus size={11} /> {t.pageNew || 'New page'}</button>
          <div className="flex items-center gap-1.5 ml-auto">
            <select value={importFrom} onChange={(e) => setImportFrom(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 max-w-[200px]" data-page-import-channel>
              <option value="">{t.pageImportPick || 'Read a page from…'}</option>
              {textChannels(channels).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
            <button onClick={importPage} disabled={!importFrom || !!busy || !botConnected} className={smallButton} data-page-import title={t.pageImportHint || 'Its newest 50 messages become blocks of a new page. Nothing in Discord changes.'}>
              {busy === 'import' ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} {t.pageImport || 'Read'}
            </button>
          </div>
        </div>
        {!draft && resultLine}
      </div>

      {draft && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* The page: where it goes, how it is posted, its blocks. */}
          <div className="space-y-4">
            <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <label className="space-y-1 block"><span className={tag}>{t.pageName || 'Name'}</span>
                  <input value={draft.name} onChange={(e) => change({ name: e.target.value.slice(0, 80) })} className={box} data-page-name /></label>
                <label className="space-y-1 block"><span className={tag}>{t.pageChannel || 'Posted in'}</span>
                  <select value={draft.channelId} onChange={(e) => change({ channelId: e.target.value })} className={box} data-page-channel>
                    <option value="">{t.discordSendPickChannel || 'Choose a channel'}</option>
                    {textChannels(channels).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select></label>
                <label className="flex items-center gap-2 pb-1.5" title={t.pageColourHint || 'The edge of every card that has no colour of its own'}>
                  <input type="color" value={draft.color} onChange={(e) => change({ color: e.target.value })} className="w-8 h-8 bg-transparent border border-zinc-800 rounded cursor-pointer" />
                  <span className="text-[10px] text-zinc-500">{t.pageColour || 'Colour'}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-page-style>
                {(['classic', 'single'] as const).map((style) => (
                  <button key={style} onClick={() => change({ style })} data-page-style-pick={style}
                    className={`text-left p-3 rounded-2xl border transition-colors ${draft.style === style ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'}`}>
                    <div className="text-[11px] font-black text-white">{style === 'classic' ? (t.pageStyleClassic || 'Separate messages') : (t.pageStyleSingle || 'One message')}</div>
                    <div className="text-[10px] text-zinc-500 leading-snug mt-1">
                      {style === 'classic'
                        ? (t.pageStyleClassicHint || 'A message per block, the way MEE6 does it. Fields can sit side by side. Adding, removing or moving blocks later posts the page again.')
                        : (t.pageStyleSingleHint || 'The whole page as one message, in Discord\'s newer layout. Lines between sections; anything can be changed later in place. Up to 40 pieces and 4,000 characters.')}
                    </div>
                  </button>
                ))}
              </div>
              <label className="flex items-start gap-2 cursor-pointer" data-page-live>
                <input type="checkbox" checked={!!draft.live} onChange={(e) => change({ live: e.target.checked })} className="accent-current-accent mt-0.5" />
                <span className="text-[11px] text-zinc-300 leading-snug">
                  <span className="font-bold flex items-center gap-1"><Radio size={11} className="text-rose-400" /> {t.pageLive || 'Keep it up to date'}</span>
                  <span className="block text-[10px] text-zinc-500">{t.pageLiveHint || 'Once posted, it is edited in place when what its { } values show changes — going live, the game, the song, the plan, the viewers. A line whose values are all empty is left out, so one card reads right live and not.'}</span>
                </span>
              </label>
            </div>

            <div ref={blockOrder.listRef} className="relative space-y-3" data-page-blocks>
              {blockOrder.line}
              {draft.blocks.map((b, i) => {
                const closed = collapsed.has(b.id);
                return (
                  <div key={b.id} {...blockOrder.row(b.id)} className={`glass-panel rounded-2xl border border-zinc-800 scroll-mt-4 ${blockOrder.held === b.id ? 'opacity-40' : ''}`} data-page-block={b.type} data-page-block-id={b.id}
                    onFocusCapture={() => setActiveBlock(b.id)} onPointerDownCapture={() => setActiveBlock(b.id)}
                    style={activeBlock === b.id ? { borderColor: 'color-mix(in srgb, var(--current-accent) 55%, transparent)' } : undefined}>
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      {draft.blocks.length > 1 && <DragGrip grip={blockOrder.grip(b.id)} title={t.pageDrag || 'Drag to move the block'} />}
                      <button onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        {closed ? <ChevronRight size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />}
                        <span className="text-current-accent">{BLOCK_ICONS[b.type]}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">{i + 1}. {blockName[b.type]}</span>
                        <span className="text-[10px] text-zinc-500 truncate">{withDiscordText(blockSummary(b), '1.15em')}</span>
                      </button>
                      <button onClick={() => addBlock({ ...(blocksNow().find((x) => x.id === b.id) || b), id: newBlockId() }, b.id)} disabled={draft.blocks.length >= PAGE_LIMITS.blocks} className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-30" title={t.pageCopyBlock || 'Copy the block'}><Copy size={12} /></button>
                      <button onClick={() => setBlocks(blocksNow().filter((x) => x.id !== b.id))} className="p-1.5 text-zinc-500 hover:text-rose-400" title={t.pageRemoveBlock || 'Remove the block'}><Trash2 size={12} /></button>
                    </div>
                    {!closed && <div className="px-4 pb-4">{blockEditor(b)}</div>}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap" data-page-add>
              <span className={tag}>{t.pageAdd || 'Add'}</span>
              <button onClick={() => addBlock({ ...newBlock('card'), ...LIVE_STATUS_CARD, id: newBlockId() } as any)} className={`${smallButton} text-rose-300`} data-page-add-live>
                <Radio size={11} /> {t.pageAddLive || 'Live status'}
              </button>
              {(['banner', 'card', 'text', 'gap', 'links'] as const).map((type) => (
                <button key={type} onClick={() => addBlock(newBlock(type))} disabled={draft.blocks.length >= PAGE_LIMITS.blocks} className={smallButton} data-page-add-block={type}>
                  {BLOCK_ICONS[type]} {blockName[type]}
                </button>
              ))}
            </div>
          </div>

          {/*
            What it will look like, and putting it up.

            Beside the blocks it stays on screen, one screen tall: the preview
            takes what the rest leaves and scrolls on its own, so a block far
            down the page can be seen while it is edited.
          */}
          <div className="space-y-4 xl:space-y-0 xl:flex xl:flex-col xl:gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto" data-page-side>
            <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3 xl:shrink-0">
              <div className="flex items-center gap-3 flex-wrap text-[10px] text-zinc-500" data-page-counts>
                {draft.style === 'single' && counts ? (
                  <>
                    <span className={counts.pieces > PAGE_LIMITS.components ? 'text-rose-400' : ''}>{fill(t.pagePieces || '{count} / {max} pieces', { count: counts.pieces, max: PAGE_LIMITS.components })}</span>
                    <span className={counts.text > PAGE_LIMITS.text ? 'text-rose-400' : ''}>{fill(t.pageCharacters || '{count} / {max} characters', { count: counts.text, max: PAGE_LIMITS.text })}</span>
                  </>
                ) : <span>{messages(counts?.messages ?? 0)}</span>}
              </div>
              {problems.length > 0 && (
                <ul className="space-y-1" data-page-problems>
                  {problems.map((p: any, i: number) => <li key={i} className="text-[11px] text-amber-400 flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {refusalWords(t, p) || p.code}</li>)}
                </ul>
              )}

              <div className="text-[11px] text-zinc-400 leading-relaxed" data-page-status>
                {posted
                  ? (inPlace
                    ? fill(t.pagePostedInPlace || 'Up in #{channel} ({messages}). Posting again edits it in place.', { channel: channelName(posted.channelId), messages: messages(posted.ids.length) })
                    : fill(t.pagePostedAgain || 'Up in #{channel}. Blocks were added, removed or moved, or the channel or the way it is posted changed — posting again puts up a new copy and removes the old one.', { channel: channelName(posted.channelId) }))
                  : (t.pageNotPosted || 'Not posted yet.')}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => act('test', { id: draft.id }, (r) => fill(t.pageTested || 'Test posted in #{channel} ({messages}); the last test there was removed.', { channel: channelName(r?.channelId), messages: messages(r?.messages ?? 0) }))}
                  disabled={!!busy || !botConnected || !testChannelId || problems.length > 0} className={smallButton} data-page-test
                  title={testChannelId ? '' : (t.pageNoTestChannel || 'Choose a test channel on the Welcome & Goodbye screen first.')}>
                  {busy === 'test' ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />} {fill(t.pageTest || 'Test in #{channel}', { channel: channelName(testChannelId) || '…' })}
                </button>
                <button onClick={() => act('post', { id: draft.id }, (r) => (r?.done === 'updated' && r.messages === 1
                  ? (t.pageUpdatedOne || 'Updated in place.')
                  : r?.done === 'updated'
                  ? fill(t.pageUpdated || 'Updated in place: {changed} of {count} messages changed.', { changed: r.changed, count: r.messages })
                  : r?.done === 'reposted'
                    ? fill(t.pageReposted || 'Posted again in #{channel} ({messages}); the old copy was removed.', { channel: channelName(r.channelId), messages: messages(r.messages) })
                    : fill(t.pagePosted || 'Posted in #{channel} ({messages}).', { channel: channelName(r?.channelId), messages: messages(r?.messages ?? 0) })))}
                  disabled={!!busy || !botConnected || !draft.channelId || problems.length > 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-current-accent text-white text-[11px] font-black disabled:opacity-40" data-page-post>
                  {busy === 'post' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {posted ? (t.pageUpdate || 'Update in Discord') : (t.pagePost || 'Post')}
                </button>
                {posted && (
                  <button onClick={() => arm('unpost', () => act('unpost', { id: draft.id }, (r) => fill(t.pageTakenDown || 'Taken down: {messages} removed.', { messages: messages(r?.removed ?? 0) })))} disabled={!!busy} className={smallButton} data-page-unpost>
                    <Trash2 size={11} /> {armed === 'unpost' ? (t.pageSure || 'Press again to be sure') : (t.pageTakeDown || 'Take it down')}
                  </button>
                )}
              </div>
              {resultLine}
            </div>

            {selected?.source && (
              <div className="glass-panel rounded-3xl border border-amber-500/20 p-5 space-y-2 xl:shrink-0" data-page-source>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {fill(t.pageSourceHint || 'Read from {count} messages in #{channel}. They are still there. Once this page is up, they can go.', { count: selected.source.ids.length, channel: channelName(selected.source.channelId) })}
                  {selected.source.cut ? ` ${fill(t.pageSourceCut || '({count} blocks past the 25 were left out.)', { count: selected.source.cut })}` : ''}
                </p>
                <button onClick={() => arm('source', () => act('delete_source', { id: draft.id }, (r) => fill(t.pageSourceDeleted || 'Deleted {removed} of {count} original messages.', { removed: r?.removed ?? 0, count: r?.of ?? 0 })))} disabled={!!busy || !botConnected} className={`${smallButton} text-amber-400`} data-page-delete-source>
                  <Trash2 size={11} /> {armed === 'source' ? (t.pageSure || 'Press again to be sure') : fill(t.pageDeleteSource || 'Delete the {count} originals', { count: selected.source.ids.length })}
                </button>
              </div>
            )}

            <div className="flex items-center justify-end xl:shrink-0" data-page-motion>
              <button type="button" onClick={() => setStillPreview(!stillPreview)} className={smallButton} data-page-motion-toggle
                title={t.previewMotionHint || 'Big moving banners take a lot of work to keep playing; stopped, the preview shows their first frame.'}>
                {stillPreview ? <Play size={11} /> : <Pause size={11} />}
                {stillPreview ? (t.previewPlay || 'Play moving pictures') : (t.previewStill || 'Stop moving pictures')}
              </button>
            </div>
            <div ref={previewArea} className="xl:min-h-[240px] xl:overflow-y-auto xl:overscroll-contain rounded-xl" data-page-preview-area>
              <DiscordPagePreview page={draft} names={names} botName={botName} botAvatar={botAvatar} t={t} active={activeBlock} onPick={pickBlock} drawn={drawnNow} still={stillPreview} />
            </div>

            <div className="flex items-center gap-2 justify-end xl:shrink-0">
              <button onClick={duplicatePage} disabled={!!busy || list.length >= 30} className={smallButton}><Copy size={11} /> {t.pageDuplicate || 'Copy the page'}</button>
              <button onClick={() => arm('remove', () => { removing.current = draft.id; clearTimeout(saveTimer.current); saveTimer.current = null; act('remove', { id: draft.id }, () => (posted ? (t.pageForgotPosted || 'Page removed here; what it posted is still in Discord.') : (t.pageForgot || 'Page removed.'))); })} disabled={!!busy} className={`${smallButton} hover:text-rose-400`} data-page-remove>
                <Trash2 size={11} /> {armed === 'remove' ? (t.pageSure || 'Press again to be sure') : (t.pageRemove || 'Remove the page')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** The same list for what this screen shows of it: by id, name and colour, not by being the same array. */
const sameItems = (a: any[] = [], b: any[] = []) => a === b
  || (a.length === b.length && a.every((x, i) => x?.id === b[i]?.id && x?.name === b[i]?.name && x?.color === b[i]?.color && x?.type === b[i]?.type));

/*
  Drawn again only when something it shows changed. The app hands every
  screen a fresh set of its actions whenever anything on the server changes
  — a chat line, a viewer count — and this screen redrew whole for each one,
  every block and the preview, while somebody typed. The actions it is
  given do the same thing however fresh, so they are not what decides.
*/
export const DiscordPagesView = React.memo(PagesScreen, (a, b) => a.pages === b.pages
  && sameItems(a.channels, b.channels) && sameItems(a.roles, b.roles) && sameItems(a.emojis, b.emojis)
  && a.testChannelId === b.testChannelId && a.botConnected === b.botConnected
  && a.botName === b.botName && a.botAvatar === b.botAvatar && a.t === b.t);
