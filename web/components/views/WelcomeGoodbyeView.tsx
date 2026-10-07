/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Welcome and goodbye posts in Discord: where each goes, its lines, the
 * embed, the picture card drawn for the person, the reaction under it — and
 * a test that posts it for real, with the settings on screen.
 *
 * One panel for every kind of greeting, driven by KINDS, so a kind added on
 * the server is a line here rather than another copy of the panel. The
 * preview fills the placeholders with the same function the server uses
 * (shared/greeting-text.js), so what it shows is what gets posted.
 *
 * Laid out like the Discord pages screen: the settings on the left, and —
 * beside them, staying on screen — the test and the post as Discord will
 * show it, drawn the same way (markdown, mentions, server emojis, the bot's
 * own name and picture). The preview shows the line being edited; the
 * arrows step through the others, one of which is picked each time.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ThemeConfig, WelcomeGoodbyeConfig, GreetingKind } from '../../types';
import { Button } from '../Button';
import {
  DoorOpen, LogOut, Hash, Save, AlertTriangle, Bot, LayoutTemplate, Smile, Plus, Trash2, List, Shield, MessageSquare, Send, Loader2, Gem, Gavel, Mail,
  ChevronLeft, ChevronRight, Play, Pause,
} from 'lucide-react';
import { StillImg, usePreviewStill } from '../StillPicture';
import { EmojiPicker } from '../EmojiPicker';
import { WelcomeCardEditor } from '../WelcomeCardEditor';
import { GreetingButtons } from '../GreetingButtons';
import { EmojiField, EmojiGlyph } from '../EmojiField';
import { PicturePick } from '../PicturePick';
import { discordHtml, pictureSrc } from '../DiscordPagePreview';
import { textChannels } from '../DiscordPicks';
import { fillGreeting, GREETING_PLACEHOLDERS } from '../../../shared/greeting-text.js';
import { smallPrint } from '../../../shared/discord-pages.js';
import { refusalWords, fill } from '../../words';

interface WelcomeGoodbyeViewProps {
  activeTheme: ThemeConfig;
  t: any;
  system: any;
}

type Field = 'message' | 'dm' | 'cardTitle' | 'cardDescription' | 'cardFooter' | 'react';

interface KindInfo {
  id: GreetingKind; icon: React.ReactNode; tone: string; title: string; hint: string; tab: string; placeholders: string[];
  /** Who it is about can be pinged: they are in the server. Not somebody who left or was banned. */
  pings: boolean;
  /** What else it has: buttons under it, a reaction, a direct message. */
  buttons?: boolean; react?: boolean; dm?: boolean;
}

/** Every kind of greeting, in order: what it is called, and which placeholders mean something for it. */
const kindsFor = (t: any): KindInfo[] => [
  {
    id: 'welcome', icon: <DoorOpen size={20} />, tone: 'bg-green-500 shadow-green-500/20',
    title: t.welcomeTitle || 'Welcome Messages', hint: t.welcomeDesc || 'Send a message when a user joins the server.', tab: t.greetTabWelcome || 'Welcome',
    placeholders: GREETING_PLACEHOLDERS.filter((p) => p !== '{boosts}'), pings: true, buttons: true, react: true, dm: true,
  },
  {
    id: 'goodbye', icon: <LogOut size={20} />, tone: 'bg-orange-500 shadow-orange-500/20',
    title: t.goodbyeTitle || 'Goodbye Messages', hint: t.goodbyeDesc || 'Send a message when a user leaves the server.', tab: t.greetTabGoodbye || 'Goodbye',
    placeholders: GREETING_PLACEHOLDERS.filter((p) => p !== '{boosts}'), pings: false, react: true,
  },
  {
    id: 'boost', icon: <Gem size={20} />, tone: 'bg-pink-500 shadow-pink-500/20',
    title: t.greetBoostTitle || 'Boost thank-you', hint: t.greetBoostHint || 'Thank whoever boosts the server, with a card of their own.', tab: t.greetTabBoost || 'Boost',
    placeholders: GREETING_PLACEHOLDERS, pings: true, buttons: true, react: true,
  },
  {
    id: 'ban', icon: <Gavel size={20} />, tone: 'bg-red-600 shadow-red-600/20',
    title: t.greetBanTitle || 'Ban message', hint: t.greetBanHint || 'Say when somebody is banned. While this is on, a ban posts this instead of the goodbye.', tab: t.greetTabBan || 'Ban',
    placeholders: GREETING_PLACEHOLDERS.filter((p) => p !== '{boosts}'), pings: false,
  },
];

const label = 'text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2';
const small = 'text-[9px] font-bold uppercase text-zinc-500';
const pick = 'bg-zinc-800 border border-zinc-700/50 rounded-md px-1.5 py-1 text-[9px] text-zinc-400 max-w-[120px] outline-none';
const Switch = ({ on, set }: { on: boolean; set: (v: boolean) => void }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className={`w-10 h-6 rounded-full p-1 transition-colors shrink-0 ${on ? 'bg-current-accent' : 'bg-zinc-700'}`}>
    <span className={`block w-4 h-4 bg-white rounded-full shadow-md transition-transform ${on ? 'translate-x-4' : ''}`} />
  </button>
);

/** The newcomer of the preview: an id for {user} to mention, and its {created}. */
const SAMPLE_ID = '306050655881793586';

const WelcomeScreen = ({ activeTheme, t, system }: WelcomeGoodbyeViewProps) => {
  const { welcomeGoodbyeConfig, discordRoles } = system.data;
  const { setWelcomeGoodbyeConfig, fetchDiscordChannels, fetchDiscordRoles } = system.actions;
  const { discordChannels, discordGuildId, discordEmojis } = system.connections;
  const { discord: discordStatus } = system.status;
  const KINDS = kindsFor(t);

  const [config, setConfig] = useState<WelcomeGoodbyeConfig>(welcomeGoodbyeConfig);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<GreetingKind>('welcome');
  // Moving pictures in the preview, or their first frames: the same choice as the Discord pages screen's.
  const [stillPreview, setStillPreview] = usePreviewStill();
  // The picture card as the server last drew it, for the Discord-style preview.
  const [cardPreview, setCardPreview] = useState<Partial<Record<GreetingKind, string>>>({});
  // A line being typed, per list: a kind's own ('welcome') or its direct message's ('welcome:dm').
  const [newLine, setNewLine] = useState<Record<string, string>>({});
  // Which line the preview shows, per list: the one last edited, or stepped to.
  const [shownLine, setShownLine] = useState<Record<string, number>>({});
  const [picker, setPicker] = useState<{ kind: GreetingKind; field: Field; top: number; left: number } | null>(null);
  // A test post per kind: under way, posted (as whom), or why not.
  const [tested, setTested] = useState<Partial<Record<GreetingKind, { busy?: boolean; ok?: string; error?: string }>>>({});

  useEffect(() => {
    if (discordStatus === 'connected' && discordGuildId) {
      if (!discordChannels || discordChannels.length === 0) fetchDiscordChannels(discordGuildId);
      if (!discordRoles || discordRoles.length === 0) fetchDiscordRoles(discordGuildId);
    }
  }, [discordStatus, discordGuildId, discordChannels, discordRoles, fetchDiscordChannels, fetchDiscordRoles]);

  /*
    The server's copy, whenever it changes — but not over changes not yet
    saved: a refresh arriving while somebody was setting a card up threw
    their work away. Saving clears the flag, and the saved copy comes back.
  */
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty;
  useEffect(() => { if (!dirtyRef.current) setConfig(welcomeGoodbyeConfig); }, [welcomeGoodbyeConfig]);

  const save = () => { setWelcomeGoodbyeConfig(config); setIsDirty(false); };
  const update = (kind: GreetingKind, key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [kind]: { ...(prev as any)[kind], [key]: value } }));
    setIsDirty(true);
  };
  const entry = (kind: GreetingKind): any => (config as any)?.[kind] || {};

  const dmOf = (kind: GreetingKind) => ({ enabled: false, messages: [], picture: false, links: true, ...(entry(kind).dm || {}) });
  const updateDm = (kind: GreetingKind, patch: Record<string, any>) => update(kind, 'dm', { ...dmOf(kind), ...patch });
  const addLine = (kind: GreetingKind, dm = false) => {
    const key = dm ? `${kind}:dm` : kind;
    const text = (newLine[key] || '').trim();
    if (!text) return;
    const list = dm ? dmOf(kind).messages : (entry(kind).messages || []);
    if (dm) updateDm(kind, { messages: [...list, text] });
    else update(kind, 'messages', [...list, text]);
    setNewLine((p) => ({ ...p, [key]: '' }));
    // The preview shows the line just added.
    setShownLine((p) => ({ ...p, [key]: list.length }));
  };
  const insert = (kind: GreetingKind, field: Field, text: string) => {
    if (field === 'message') setNewLine((p) => ({ ...p, [kind]: (p[kind] || '') + text }));
    else if (field === 'dm') setNewLine((p) => ({ ...p, [`${kind}:dm`]: (p[`${kind}:dm`] || '') + text }));
    // A reaction is one emoji: the picked one replaces it.
    else if (field === 'react') update(kind, 'react', text);
    else update(kind, field, (entry(kind)[field] || '') + text);
  };
  const openPicker = (kind: GreetingKind, field: Field, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;
    if (top + 400 > window.innerHeight) top = rect.top - 408;
    if (left + 320 > window.innerWidth) left = window.innerWidth - 340;
    setPicker({ kind, field, top, left });
  };

  const channelName = (id: string) => discordChannels?.find((c: any) => c.id === id)?.name || '';
  const test = async (kind: GreetingKind) => {
    setTested((p) => ({ ...p, [kind]: { busy: true } }));
    try {
      const res = await system.actions.testWelcome(kind, entry(kind), config.testChannelId || '');
      const where = channelName(config.testChannelId || entry(kind).channelId);
      // And where the direct message went, when there was one.
      const dm = res?.dm === 'channel' ? ` ${t.greetTestDmChannel || 'The direct message is there too.'}`
        : res?.dm === 'sent' ? ` ${t.greetTestDmSent || 'The direct message went to you.'}`
          : res?.dm === 'failed' ? ` ${t.greetTestDmFailed || 'The direct message could not be sent — your DMs from this server may be off.'}` : '';
      setTested((p) => ({
        ...p,
        [kind]: { ok: String(t.greetTestDone || 'Posted in #{channel} as {name}.').split('{channel}').join(where).split('{name}').join(res?.as || '') + dm },
      }));
    } catch (err: any) {
      setTested((p) => ({ ...p, [kind]: { error: refusalWords(t, err) || String(err?.message || err) } }));
    }
  };

  /*
    Sample values for the preview, filled the way the server fills them: an
    account a few years old, so {account_age} reads like a real one, and a
    real mention for {user}, drawn with the sample's name.
  */
  const sampleName = t.welcomeCardSample || 'NewMember';
  const sample = (withMention: boolean) => ({
    name: sampleName,
    mention: withMention ? `<@${SAMPLE_ID}>` : '',
    server: system.connections?.discordGuilds?.find?.((g: any) => g.id === discordGuildId)?.name || t.welcomeCardServer || 'My Server',
    count: 42,
    boosts: 7,
    id: SAMPLE_ID,
  });
  const names = { roles: discordRoles || [], channels: discordChannels || [], users: { [SAMPLE_ID]: sampleName } };
  const botMember: any = system.connections?.botMember;
  const botName = botMember?.nick || botMember?.user?.global_name || botMember?.user?.username || t.greetBotName || 'Your bot';
  const botAvatar = botMember?.user?.avatar ? `https://cdn.discordapp.com/avatars/${botMember.user.id}/${botMember.user.avatar}.png?size=80` : '';
  const html = (text: string) => ({ __html: discordHtml(text, names) });

  /** The line of a list the preview shows, kept within the list. */
  const lineShown = (key: string, list: string[]) => Math.min(Math.max(0, shownLine[key] || 0), Math.max(0, list.length - 1));

  /** Back and forth through a list's lines, above its preview, when there is more than one. */
  const lineStepper = (key: string, list: string[]) => {
    if (list.length < 2) return null;
    const at = lineShown(key, list);
    const go = (by: number) => setShownLine((p) => ({ ...p, [key]: (at + by + list.length) % list.length }));
    return (
      <span className="flex items-center gap-1 ml-auto" data-greet-line-step>
        <button type="button" onClick={() => go(-1)} className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"><ChevronLeft size={12} /></button>
        <span className="text-[10px] text-zinc-400 font-bold tabular-nums">{fill(t.greetLineOf || 'Line {n} of {count}', { n: at + 1, count: list.length })}</span>
        <button type="button" onClick={() => go(1)} className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"><ChevronRight size={12} /></button>
      </span>
    );
  };

  /** A message from the bot as Discord draws it. */
  const message = (children: React.ReactNode) => (
    <div className="bg-[#313338] rounded-xl p-4 border border-[#2B2D31] font-sans text-sm relative shadow-xl">
      <div className="flex items-start gap-3">
        {botAvatar
          ? <img src={botAvatar} alt="" className="w-10 h-10 rounded-full shrink-0" />
          : <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0"><Bot size={20} className="text-white" /></div>}
        <div className="w-full min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] text-white">{botName}</span>
            <span className="bg-[#5865F2] text-white text-[10px] px-1 rounded font-semibold">APP</span>
            <span className="text-[11px] text-[#949ba4]">{t.pagePreviewToday || 'Today'}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  /** The footer as Discord shows one: no markdown, and a server emoji as its little picture rather than as text. */
  const footer = (text: string) => {
    const f: any = smallPrint(text, 'text', 2048);
    return (
      <div className="mt-2 flex items-center gap-2 text-[12px] text-[#dbdee1]" data-greet-preview-footer>
        {f.icon_url && <img src={f.icon_url} alt="" className="w-5 h-5 rounded-full object-contain" />}
        <span className="break-words">{f.text}</span>
      </div>
    );
  };

  const renderPreview = (kind: GreetingKind) => {
    const data = entry(kind);
    const k = KINDS.find((x) => x.id === kind)!;
    const lines: string[] = data.messages || [];
    const msg = fillGreeting(lines[lineShown(kind, lines)] || '', sample(k.pings));
    const picture = data.image?.enabled ? cardPreview[kind] : undefined;
    const embed = data.sendCard ? {
      title: fillGreeting(data.cardTitle || '', sample(false)),
      description: fillGreeting(data.cardDescription || '', sample(k.pings)),
      color: data.cardColor,
      footer: fillGreeting(data.cardFooter || '', sample(false)),
      image: picture || (data.cardImage ? pictureSrc(data.cardImage) : ''),
      thumbnail: data.cardThumbnail,
    } : null;
    const dm = dmOf(kind);
    const dmLines: string[] = dm.messages || [];
    const dmText = fillGreeting(dmLines[lineShown(`${kind}:dm`, dmLines)] || '', sample(false));
    const linkButtons = (data.buttons || []).filter((b: any) => b.kind === 'link');

    const buttons = (list: any[]) => list.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-2" data-greet-preview-buttons>
        {list.map((b: any, i: number) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold text-white" style={{ backgroundColor: b.kind === 'link' ? '#4e5058' : ({ 1: '#5865f2', 2: '#4e5058', 3: '#248046', 4: '#da373c' } as Record<number, string>)[b.style || 2] }}>
            {b.emoji && <EmojiGlyph value={b.emoji} size={16} />}{b.label}{b.kind === 'link' && <span className="opacity-70">↗</span>}
          </span>
        ))}
      </div>
    );

    return (
      <div className="space-y-3" data-greet-preview>
        <div className="flex items-center gap-2">
          <span className={label}><MessageSquare size={12} /> {t.greetPreview || 'Preview'}</span>
          {lineStepper(kind, lines)}
          {embed?.image && (
            <button type="button" onClick={() => setStillPreview(!stillPreview)} data-greet-motion-toggle
              className={`${lines.length < 2 ? 'ml-auto ' : ''}inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white hover:border-zinc-600`}
              title={t.previewMotionHint || 'Big moving banners take a lot of work to keep playing; stopped, the preview shows their first frame.'}>
              {stillPreview ? <Play size={11} /> : <Pause size={11} />}
              {stillPreview ? (t.previewPlay || 'Play moving pictures') : (t.previewStill || 'Stop moving pictures')}
            </button>
          )}
        </div>
        {message(
          <>
            {msg && <div className="text-[15px] leading-[1.375] text-[#DBDEE1] mt-0.5 break-words" dangerouslySetInnerHTML={html(msg)} data-greet-preview-text />}
            {picture && !data.sendCard && <img src={picture} alt="" className="mt-2 block rounded-lg max-w-[min(100%,520px)] max-h-[350px] w-auto h-auto" />}
            {embed && (
              <div className="mt-2 flex max-w-[520px]" data-greet-preview-embed>
                <div className="w-1 rounded-l shrink-0" style={{ backgroundColor: embed.color || '#5865F2' }} />
                <div className="bg-[#2B2D31] rounded-r p-3 pr-4 w-full min-w-0">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {embed.title && <div className="font-semibold text-[15px] text-[#f2f3f5] break-words" dangerouslySetInnerHTML={html(embed.title)} />}
                      {embed.description && <div className="text-[13.5px] leading-[1.375] text-[#DBDEE1] break-words" dangerouslySetInnerHTML={html(embed.description)} />}
                    </div>
                    {embed.thumbnail && <div className="w-20 h-20 rounded shrink-0 bg-zinc-700 grid place-items-center text-[10px] text-zinc-400">{t.greetAvatar || 'Avatar'}</div>}
                  </div>
                  {embed.image && (stillPreview
                    ? <StillImg src={embed.image} width={520} className="mt-3 rounded max-w-full" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <img src={embed.image} className="mt-3 rounded max-w-full" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />)}
                  {embed.footer && footer(embed.footer)}
                </div>
              </div>
            )}
            {/* The buttons, as Discord draws them: links grey with an arrow, roles in their colour. */}
            {buttons(data.buttons || [])}
            {/* The reaction the bot adds, as Discord shows one somebody can click. */}
            {data.react && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-lg bg-[#5865F2]/15 border border-[#5865F2] text-[#DBDEE1] text-xs" data-greet-preview-react>
                <EmojiGlyph value={data.react} size={16} /> <span className="text-[11px] font-bold">1</span>
              </span>
            )}
          </>,
        )}
        <p className="text-[10px] text-zinc-500 text-center">
          {lines.length > 1
            ? (t.greetPreviewLines || 'Each post picks one of the lines at random — the arrows show each.')
            : (t.greetPreviewOne || 'Placeholders are filled with a sample newcomer.')}
        </p>

        {/* The direct message, as they would get it. */}
        {k.dm && dm.enabled && (
          <div className="space-y-2 pt-2" data-greet-preview-dm>
            <div className="flex items-center gap-2">
              <span className={label}><Mail size={12} /> {t.greetPreviewDm || 'Their direct message'}</span>
              {lineStepper(`${kind}:dm`, dmLines)}
            </div>
            {message(
              <>
                {dmText && <div className="text-[15px] leading-[1.375] text-[#DBDEE1] mt-0.5 break-words" dangerouslySetInnerHTML={html(dmText)} />}
                {dm.picture && picture && <img src={picture} alt="" className="mt-2 block rounded-lg max-w-[min(100%,520px)] max-h-[350px] w-auto h-auto" />}
                {dm.links && buttons(linkButtons)}
              </>,
            )}
          </div>
        )}
      </div>
    );
  };

  /** Insert a channel or a role where a line is typed: as Discord writes them, drawn by name in the preview. */
  const mentionPicks = (kind: GreetingKind, field: Field) => (
    <>
      <select value="" onChange={(e) => { if (e.target.value) insert(kind, field, `<#${e.target.value}>`); }} className={pick} data-greet-insert-channel>
        <option value="">{t.pageInsertChannel || '# channel'}</option>
        {textChannels(discordChannels || []).map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
      </select>
      <select value="" onChange={(e) => { if (e.target.value) insert(kind, field, `<@&${e.target.value}>`); }} className={pick} data-greet-insert-role>
        <option value="">{t.pageInsertRole || '@ role'}</option>
        {(discordRoles || []).filter((r: any) => r.name !== '@everyone' && !r.managed).map((r: any) => <option key={r.id} value={r.id}>@{r.name}</option>)}
      </select>
    </>
  );

  /**
   * A list of lines, one picked at random each time: the post's own, or the
   * direct message's. Each can be changed where it is; the one being changed
   * is the one the preview shows.
   */
  const linesEditor = (k: KindInfo, list: string[], setList: (next: string[]) => void, field: 'message' | 'dm') => {
    const key = field === 'dm' ? `${k.id}:dm` : k.id;
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          <span className={label}><List size={12} /> {String(t.greetLines || 'Message lines ({n})').split('{n}').join(String(list.length))}</span>
          <span className="text-[9px] text-zinc-600">{t.greetLinesRandom || 'The bot picks one at random'}</span>
        </div>
        {list.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1" data-greet-lines>
            {list.map((msg, idx) => (
              <div key={idx} className={`flex items-start gap-2 rounded-lg border ${lineShown(key, list) === idx ? 'border-current-accent/60' : 'border-zinc-800'} bg-zinc-900/50`}>
                <textarea
                  value={msg}
                  rows={Math.min(6, Math.max(1, msg.split('\n').length))}
                  onFocus={() => setShownLine((p) => ({ ...p, [key]: idx }))}
                  onChange={(e) => setList(list.map((m, i) => (i === idx ? e.target.value : m)))}
                  // A line emptied out goes: an empty line posts nothing.
                  onBlur={(e) => { if (!e.target.value.trim()) setList(list.filter((_, i) => i !== idx)); }}
                  className="flex-1 bg-transparent px-2 py-1.5 text-xs text-zinc-200 outline-none resize-y leading-relaxed"
                  data-greet-line={idx}
                />
                <button onClick={() => setList(list.filter((_, i) => i !== idx))} title={t.greetRemoveLine || 'Remove'} className="text-zinc-600 hover:text-red-500 p-1.5"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <textarea
            value={newLine[key] || ''}
            onChange={(e) => setNewLine((p) => ({ ...p, [key]: e.target.value }))}
            className="w-full h-20 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pr-9 text-xs font-medium text-white outline-none focus:border-current-accent resize-none"
            placeholder={t.greetNewLine || 'Type a line and press Add…'}
            data-greet-new-line={field}
          />
          <button onClick={(e) => openPicker(k.id, field, e)} className="absolute top-2 right-2 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded"><Smile size={12} /></button>
          <div className="mt-2 flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5" data-greet-placeholders>
              {k.placeholders.filter((v) => k.pings || v !== '{user}').map((v) => (
                <button key={v} onClick={() => insert(k.id, field, v)} className="px-2 py-1 bg-zinc-800 rounded-md text-[9px] font-mono text-zinc-400 hover:text-white">{v}</button>
              ))}
              {mentionPicks(k.id, field)}
            </div>
            <Button size="sm" onClick={() => addLine(k.id, field === 'dm')} disabled={!(newLine[key] || '').trim()} icon={<Plus size={12} />}>{t.greetAdd || 'Add'}</Button>
          </div>
          <p className="text-[9px] text-zinc-600 leading-relaxed mt-1">
            {k.pings
              ? (t.greetPlaceholdersHint || '{user} pings them, {username} is their name, {count} how many are in the server, {account_age} how old their account is, {created} when it was made, {date} today.')
              : (t.greetPlaceholdersHintGone || '{username} is their name — they cannot be pinged any more — {count} how many are in the server, {account_age} how old their account is, {created} when it was made, {date} today.')}
            {k.id === 'boost' && ` ${t.greetBoostsHint || '{boosts} is how many boosts the server has now.'}`}
          </p>
        </div>
      </div>
    );
  };

  const renderPanel = (kind: GreetingKind) => {
    const k = KINDS.find((x) => x.id === kind)!;
    const data = entry(kind);
    const lines: string[] = data.messages || [];
    const state = tested[kind] || {};
    const dm = dmOf(kind);

    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start" data-greet-panel={kind}>
        <div className={`glass-panel p-6 rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} flex flex-col`}>
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-3 rounded-2xl text-white shadow-lg ${k.tone}`}>{k.icon}</div>
              <div className="min-w-0">
                <h3 className="text-lg font-black uppercase tracking-tight">{k.title}</h3>
                <p className="text-[10px] font-bold text-zinc-500">{k.hint}</p>
              </div>
            </div>
            <Switch on={Boolean(data.enabled)} set={(v) => update(kind, 'enabled', v)} />
          </div>

          <div className={`space-y-6 transition-all ${data.enabled ? '' : 'opacity-50'}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className={label}><Hash size={12} /> {t.channel || 'Channel'}</span>
                <select value={data.channelId || ''} onChange={(e) => update(kind, 'channelId', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-current-accent">
                  <option value="">{t.greetPickChannel || 'Choose a channel…'}</option>
                  {discordChannels?.map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </label>
              {kind === 'welcome' && (
                <label className="block space-y-2">
                  <span className={label}><Shield size={12} /> {t.greetAutoRole || 'Role given on joining'}</span>
                  <select value={data.autoRoleId || ''} onChange={(e) => update(kind, 'autoRoleId', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-current-accent">
                    <option value="">{t.greetNoRole || 'None'}</option>
                    {discordRoles?.map((r: any) => (
                      <option key={r.id} value={r.id} style={{ color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined }}>{r.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* The lines, one picked at random each time. */}
            {linesEditor(k, lines, (next) => update(kind, 'messages', next), 'message')}

            {/* The embed. */}
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-bold text-zinc-300"><LayoutTemplate size={16} className="text-current-accent" /> {t.greetEmbed || 'Send as an embed'}</span>
                <Switch on={Boolean(data.sendCard)} set={(v) => update(kind, 'sendCard', v)} />
              </div>
              {data.sendCard && (
                <div className="space-y-4 pt-2">
                  <label className="block space-y-1">
                    <span className={small}>{t.greetEmbedTitle || 'Title'}</span>
                    <div className="relative">
                      <input type="text" value={data.cardTitle || ''} onChange={(e) => update(kind, 'cardTitle', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pr-8 text-xs text-white outline-none focus:border-current-accent" />
                      <button onClick={(e) => openPicker(kind, 'cardTitle', e)} className="absolute top-1/2 -translate-y-1/2 right-2 p-1 text-zinc-400 hover:text-white"><Smile size={12} /></button>
                    </div>
                  </label>
                  <div className="block space-y-1">
                    <span className={small}>{t.greetEmbedDescription || 'Description'}</span>
                    <div className="relative">
                      <textarea value={data.cardDescription || ''} onChange={(e) => update(kind, 'cardDescription', e.target.value)} className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pr-8 text-xs text-white outline-none focus:border-current-accent resize-y" data-greet-description />
                      <button onClick={(e) => openPicker(kind, 'cardDescription', e)} className="absolute top-2 right-2 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded"><Smile size={12} /></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">{mentionPicks(kind, 'cardDescription')}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block space-y-1">
                      <span className={small}>{t.greetEmbedColour || 'Colour'}</span>
                      <div className="flex items-center gap-2">
                        <input type="color" value={data.cardColor || '#5865F2'} onChange={(e) => update(kind, 'cardColor', e.target.value)} className="w-8 h-8 rounded border-none bg-transparent cursor-pointer" />
                        <input type="text" value={data.cardColor || '#5865F2'} onChange={(e) => update(kind, 'cardColor', e.target.value)} className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs font-mono text-zinc-300 outline-none" />
                      </div>
                    </label>
                    <div className="space-y-1">
                      <span className={small}>{t.greetEmbedThumbnail || 'Small picture'}</span>
                      <button onClick={() => update(kind, 'cardThumbnail', !data.cardThumbnail)} className={`w-full py-2 rounded-lg border text-xs font-bold ${data.cardThumbnail ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                        {data.cardThumbnail ? (t.greetTheirAvatar || 'Their avatar') : (t.greetNoRole || 'None')}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1" data-greet-embed-image>
                    <span className={small}>{t.greetEmbedImageAny || 'Large picture'}</span>
                    <PicturePick wide value={data.cardImage || ''} onChange={(v) => update(kind, 'cardImage', v)} listAssets={system.actions.listAssets} uploadAsset={system.actions.uploadAsset} t={t} />
                    <span className="block text-[9px] text-zinc-600">{t.greetEmbedImageHint || 'With the picture card on, the card takes this place.'}</span>
                  </div>
                  <label className="block space-y-1">
                    <span className={small}>{t.greetEmbedFooter || 'Footer'}</span>
                    <div className="relative">
                      <input type="text" value={data.cardFooter || ''} onChange={(e) => update(kind, 'cardFooter', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pr-8 text-xs text-white outline-none focus:border-current-accent" />
                      <button onClick={(e) => openPicker(kind, 'cardFooter', e)} className="absolute top-1/2 -translate-y-1/2 right-2 p-1 text-zinc-400 hover:text-white"><Smile size={12} /></button>
                    </div>
                    <span className="block text-[9px] text-zinc-600">{t.greetFooterIconHint || 'A server emoji here becomes the footer\'s small picture, beside the words — Discord draws no emoji in a footer itself.'}</span>
                  </label>
                </div>
              )}
            </div>

            <WelcomeCardEditor
              kind={kind}
              card={data.image}
              onChange={(next) => update(kind, 'image', next)}
              preview={(card, s) => system.actions.previewWelcomeCard(card, s)}
              onPreview={(image) => setCardPreview((prev) => ({ ...prev, [kind]: image }))}
              listAssets={system.actions.listAssets}
              uploadAsset={system.actions.uploadAsset}
              customEmojis={discordEmojis}
              t={t}
            />

            {/* Links and roles to pick up, under the post. */}
            {k.buttons && (
              <GreetingButtons buttons={data.buttons || []} set={(next) => update(kind, 'buttons', next)} roles={discordRoles || []} customEmojis={discordEmojis} t={t} />
            )}

            {/* The reaction the bot adds under its own post: one click for everybody else to say hi. */}
            {k.react && <div className="flex flex-wrap items-center gap-3" data-greet-react>
              <span className={label}><Smile size={12} /> {t.greetReact || 'React to it with'}</span>
              <EmojiField value={data.react || ''} onChange={(emoji) => update(kind, 'react', emoji)} customEmojis={discordEmojis} t={t} />
              <span className="text-[9px] text-zinc-600 flex-1 min-w-[12rem]">{t.greetReactHint || 'The bot reacts to its own post, so everybody else can add theirs in one click.'}</span>
            </div>}

            {/* A direct message to the newcomer: lines of its own, the card if wanted, the link buttons. */}
            {k.dm && (
              <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4" data-greet-dm>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold text-zinc-300"><Mail size={16} className="text-current-accent" /> {t.greetDm || 'Also send them a direct message'}</span>
                  <Switch on={dm.enabled} set={(v) => updateDm(kind, { enabled: v })} />
                </div>
                {dm.enabled && (
                  <div className="space-y-4">
                    {linesEditor(k, dm.messages, (next) => updateDm(kind, { messages: next }), 'dm')}
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300">
                        <input type="checkbox" checked={dm.picture} onChange={(e) => updateDm(kind, { picture: e.target.checked })} className="accent-current-accent" />
                        {t.greetDmPicture || 'With the picture card'}
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300">
                        <input type="checkbox" checked={dm.links} onChange={(e) => updateDm(kind, { links: e.target.checked })} className="accent-current-accent" />
                        {t.greetDmLinks || 'With the link buttons'}
                      </label>
                    </div>
                    <p className="text-[9px] text-zinc-600 leading-relaxed">{t.greetDmHint || 'Some people turn off messages from servers; for them only the post in the channel goes. Role buttons stay on the post — in a DM there is no server to give a role in.'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/*
          The test and the post as Discord will show it, beside the settings
          and staying on screen while they scroll; the column scrolls on its
          own when the post is taller than the screen.
        */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:overscroll-contain" data-greet-side>
          {/* A test, posted for real with the settings on screen. */}
          <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 p-3" data-greet-test>
            <Button size="sm" onClick={() => test(kind)} disabled={state.busy || discordStatus !== 'connected'} icon={state.busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}>
              {t.greetTest || 'Send a test'}
            </Button>
            <span className="text-[10px] text-zinc-500 flex-1 min-w-[12rem]">
              {state.ok ? <span className="text-emerald-400 font-bold">{state.ok}</span>
                : state.error ? <span className="text-rose-400 font-bold">{state.error}</span>
                  : config.testChannelId
                    ? String(t.greetTestHintChannel || 'Posts it in #{channel} now, as you, with what is on screen — saved or not. Nobody is given a role.').split('{channel}').join(channelName(config.testChannelId))
                    : (t.greetTestHint || 'Posts it in its own channel now, as you, with what is on screen — saved or not. Nobody is given a role.')}
            </span>
          </div>
          {renderPreview(kind)}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-6 relative pb-20">
      {picker && (
        <>
          <div className="fixed inset-0 z-[9990] bg-transparent" onClick={() => setPicker(null)} />
          <EmojiPicker
            style={{ top: picker.top, left: picker.left }}
            onSelect={(emoji: string) => { insert(picker.kind, picker.field, emoji); if (picker.field === 'react') setPicker(null); }}
            onClose={() => setPicker(null)}
            customEmojis={discordEmojis}
          />
        </>
      )}

      {!discordGuildId || discordStatus !== 'connected' ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[32px] p-8 text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500"><AlertTriangle size={32} /></div>
          <h3 className="text-xl font-bold text-amber-500 mb-2">{t.greetNotConnected || 'Discord is not connected'}</h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">{t.connectDiscordFirst || 'Please connect your Discord bot and select a server in the Connections tab to enable this feature.'}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" data-greet-tabs>
            {KINDS.map((k) => (
              <button
                key={k.id} onClick={() => setActiveTab(k.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${activeTab === k.id ? 'bg-zinc-900 border-zinc-700 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${entry(k.id).enabled ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                {k.tab}
              </button>
            ))}
            {/* Where every test goes, whichever kind: a private channel keeps tests out of the real ones. */}
            <label className="ml-auto flex items-center gap-2" data-greet-test-channel>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.greetTestChannel || 'Send tests to'}</span>
              <select
                value={config.testChannelId || ''}
                onChange={(e) => { setConfig((prev) => ({ ...prev, testChannelId: e.target.value })); setIsDirty(true); }}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white outline-none focus:border-current-accent"
              >
                <option value="">{t.greetTestSameChannel || 'Its own channel'}</option>
                {discordChannels?.map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </label>
            {isDirty && (
              <div>
                <Button onClick={save} icon={<Save size={16} />} className="shadow-2xl shadow-current-accent/20">{t.saveConfig || 'Save'}</Button>
              </div>
            )}
          </div>
          {renderPanel(activeTab)}
        </>
      )}
    </div>
  );
};

/** The same list for what this screen shows of it: by id, name and colour, not by being the same array (as the Discord pages screen compares). */
const sameItems = (a: any[] = [], b: any[] = []) => a === b
  || (a.length === b.length && a.every((x, i) => x?.id === b[i]?.id && x?.name === b[i]?.name && x?.color === b[i]?.color && x?.type === b[i]?.type));

/*
  Drawn again only when something it shows changed, as the Discord pages
  screen is. The app hands it the whole system whenever anything on the
  server changes — a chat line, a viewer count — and it redrew whole for
  each one, the card editor and the preview, while somebody typed. Its
  actions do the same however fresh; the one that reads anything (an
  update given as a function reads the welcome settings) is fresh whenever
  those change, since they are compared here.
*/
export const WelcomeGoodbyeView = React.memo(WelcomeScreen, (a, b) => a.t === b.t && a.activeTheme === b.activeTheme
  && a.system.data.welcomeGoodbyeConfig === b.system.data.welcomeGoodbyeConfig
  && sameItems(a.system.data.discordRoles, b.system.data.discordRoles)
  && sameItems(a.system.connections.discordChannels, b.system.connections.discordChannels)
  && sameItems(a.system.connections.discordEmojis, b.system.connections.discordEmojis)
  && sameItems(a.system.connections.discordGuilds, b.system.connections.discordGuilds)
  && a.system.connections.discordGuildId === b.system.connections.discordGuildId
  && JSON.stringify(a.system.connections.botMember ?? null) === JSON.stringify(b.system.connections.botMember ?? null)
  && a.system.status.discord === b.system.status.discord);
