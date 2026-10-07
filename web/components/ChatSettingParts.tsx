/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What the chat dock's page and a chat layer's panel are built from: the same
 * switches, sliders and folding sections, and the sections both of them have.
 *
 * Two menus, because they are about two different things — the dock always
 * wears the Marathon look and has a page behind it; a chat layer chooses its
 * look, may carry a stylesheet, and can hide old messages. But a size is a
 * size and a rank colour is a rank colour on either, so those sections are
 * written once, here, and cannot drift into offering different things.
 *
 * Each section holds everything about one thing: a switch and the options it
 * brings sit together, tucked under it, rather than the switch in one place
 * and its options a long way down. Which sections are open is remembered per
 * browser, per menu — how somebody looks at the page, not a fact about chat.
 */
import React, { useState } from 'react';
import {
  Bell, ChevronDown, ChevronRight, ListChecks, Ruler, RotateCcw, Shield, Sparkles, Square, Type,
} from 'lucide-react';
import { CHAT_EVENT_PLATFORMS, CHAT_RANKS, chatEventsOn } from '../constants';
import {
  CHAT_FONTS, USERNAME_CASES, TIMESTAMP_FORMATS, CHAT_ANIMATIONS,
  CHAT_LAYOUTS, TIMESTAMP_POSITIONS, BADGE_POSITIONS, AVATAR_SHAPES,
} from '../../shared/chat-style.js';
import { useCustomFonts } from '../hooks/useCustomFonts';
import { FontUploadButton } from './FontUploadButton';

const TwitchIcon = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></svg>
);
const TikTokIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
);
const YouTubeIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
);

export const isSet = (v: any) => v !== '' && v !== null && v !== undefined;
export const labelClass = 'text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest';

/**
 * What "not set" is called on this menu, and what putting a value back does:
 * the dock's goes back to the Marathon look, a chat layer's to its theme.
 */
export interface ResetWords { word: string; hint: string }

/* ------------------------------------------------------------ the controls */

/** Back to the look's own value. Only a button when something has been changed. */
export const ResetTo = ({ shown, onClear, reset }: { shown: boolean; onClear: () => void; reset: ResetWords }) => (shown ? (
  <button
    onClick={onClear}
    title={reset.hint}
    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-200 transition-colors"
    data-chat-reset
  >
    <RotateCcw size={10} /> {reset.word}
  </button>
) : <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{reset.word}</span>);

/** A number that always has a value. */
export const Slider = ({ label, value, min, max, step = 1, suffix = 'px', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (n: number) => void;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center gap-2">
      <label className={labelClass}>{label}</label>
      <span className="text-xs font-black font-mono text-current-accent">{value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent" />
  </div>
);

/** A number that can be left to the look: dimmed, at a harmless place, until it is moved. */
export const OptSlider = ({ label, value, min, max, step = 1, suffix = 'px', whenUnset, onChange, onClear, reset }: {
  label: string; value: any; min: number; max: number; step?: number; suffix?: string;
  whenUnset: number; onChange: (n: number) => void; onClear: () => void; reset: ResetWords;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center gap-2">
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-3">
        {isSet(value) && <span className="text-xs font-black font-mono text-current-accent">{value}{suffix}</span>}
        <ResetTo shown={isSet(value)} onClear={onClear} reset={reset} />
      </div>
    </div>
    <input type="range" min={min} max={max} step={step} value={isSet(value) ? value : whenUnset}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent ${isSet(value) ? '' : 'opacity-40'}`} />
  </div>
);

/** A colour, which may also be left to the look. */
export const Colour = ({ label, value, fallback, onChange, onClear, disabled = false, reset }: {
  label: string; value: any; fallback: string; onChange: (c: string) => void; onClear?: () => void; disabled?: boolean; reset?: ResetWords;
}) => (
  <div className={`flex justify-between items-center gap-2 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
    <label className={labelClass}>{label}</label>
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full border border-zinc-700 overflow-hidden relative">
        <input type="color" value={isSet(value) ? value : fallback} onChange={(e) => onChange(e.target.value)}
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer" />
      </div>
      {onClear && reset && <ResetTo shown={isSet(value)} onClear={onClear} reset={reset} />}
    </div>
  </div>
);

/** One of a few. */
export const Choice = ({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) => (
  <div className="space-y-2">
    <label className={labelClass}>{label}</label>
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
            value === o.value ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

/** On or off, the same switch everywhere on the page. */
export const Switch = ({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="w-full flex items-center justify-between gap-3 py-0.5 text-left group">
    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${on ? 'text-zinc-200' : 'text-zinc-500'} group-hover:text-zinc-100`}>{label}</span>
    <span className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${on ? 'bg-current-accent' : 'bg-zinc-700'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  </button>
);

/** What a switch brings with it, tucked under it. */
export const Under = ({ children }: { children: React.ReactNode }) => (
  <div className="ml-1 pl-3 border-l border-zinc-800 space-y-3">{children}</div>
);

/** A quiet line about the controls around it. */
export const Note = ({ children, ...rest }: { children: React.ReactNode; [data: `data-${string}`]: any }) => (
  <p className="text-[9px] text-zinc-600 leading-relaxed" {...rest}>{children}</p>
);

/** One section, folded or open. `marked` puts a dot on a folded one that has something in it. */
export const Fold = ({ id, icon, title, open, onToggle, marked = false, children }: {
  id: string; icon: React.ReactNode; title: string; open: boolean; onToggle: () => void; marked?: boolean; children: React.ReactNode;
}) => (
  <div className="border-t border-zinc-800/60" data-chat-section={id}>
    <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-2 py-3 text-left group">
      <span className={open ? 'text-current-accent' : 'text-zinc-500'}>{icon}</span>
      <span className="flex-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-300 group-hover:text-white">{title}</span>
      {marked && !open && <span className="w-1.5 h-1.5 rounded-full bg-current-accent" />}
      {open ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
    </button>
    {open && <div className="pb-5 space-y-4">{children}</div>}
  </div>
);

/** Which sections are open, remembered in this browser under `key`. Size first, on a first visit. */
export function useOpenSections(key: string) {
  const [open, setOpen] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(saved) ? saved : ['size'];
    } catch {
      return ['size'];
    }
  });
  const toggle = (id: string) => setOpen((now) => {
    const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  return { open, toggle };
}

/* ------------------------------------------------------------ the shared sections */

/**
 * What the look being set draws, so a control that would do nothing under it
 * is not offered — a control that silently does nothing reads as broken.
 */
export interface ChatDraws {
  /** Platform icons and rank badges. Retro marks the platform with a coloured dot instead, and draws no badges. */
  marks: boolean;
  /**
   * Where the badges and the time sit, the avatar's shape and size, and the
   * name run into the message. Only an assembled look reads these — Custom,
   * and the dock's Marathon — because the other three are drawn as they are.
   */
  slots: boolean;
}

interface SectionsOptions {
  /** The whole set of values this chat draws with. */
  values: Record<string, any>;
  /** Change one or more of them. */
  patch: (next: Record<string, any>) => void;
  t: any;
  draws: ChatDraws;
  reset: ResetWords;
  /** Where this browser remembers which sections of this menu are open. */
  storageKey: string;
}

/**
 * The sections both chat menus have, each already in its fold, and `fold` for
 * a menu's own. A menu lays them out in its own order, with its own between.
 */
export function useChatSections({ values, patch, t, draws, reset, storageKey }: SectionsOptions) {
  const v = values || {};
  const set = (key: string) => (value: any) => patch({ [key]: value });
  const clear = (key: string) => () => patch({ [key]: '' });
  const highlightRanks = v.highlightRanks || {};
  const eventPlatforms = v.eventPlatforms || {};

  const { open, toggle } = useOpenSections(storageKey);
  const fold = (id: string, icon: React.ReactNode, title: string, children: React.ReactNode, marked = false) => (
    <Fold id={id} icon={icon} title={title} open={open.includes(id)} onToggle={() => toggle(id)} marked={marked}>{children}</Fold>
  );

  // Every word on a choice goes through the translations; "not set" says whose value it falls back to.
  const uploaded = useCustomFonts();
  const fontOptions = [{ value: '', label: reset.word }, ...[...CHAT_FONTS, ...uploaded].map((f) => ({ value: f, label: f }))];
  const caseWords: Record<string, string> = { theme: reset.word, none: t.chatCaseAsTyped || 'As typed', upper: t.chatCaseUpper || 'UPPER', lower: t.chatCaseLower || 'lower' };
  const clockWords: Record<string, string> = { theme: reset.word, '12h': t.chatClock12 || '12 hour', '24h': t.chatClock24 || '24 hour' };
  const animWords: Record<string, string> = {
    theme: reset.word,
    'animate-pop-in': t.chatAnimPop || 'Pop in',
    'animate-fade-in': t.chatAnimFade || 'Fade in',
    'animate-zoom-in': t.chatAnimZoom || 'Zoom in',
    'animate-slide-up': t.chatAnimSlideUp || 'Slide up',
    'animate-slide-down': t.chatAnimSlideDown || 'Slide down',
  };
  const shapeWords: Record<string, string> = { circle: t.chatShapeCircle || 'Circle', rounded: t.chatShapeRounded || 'Rounded', square: t.chatShapeSquare || 'Square' };
  const timeOn = v.showTimestamp !== false;

  const size = fold('size', <Ruler size={13} />, t.chatSecSize || 'Size & spacing', <>
    <Slider label={t.chatTextSize || 'Text size'} value={v.fontSize} min={12} max={32} onChange={set('fontSize')} />
    <Slider label={t.chatNameSize || 'Name size'} value={v.usernameFontSize} min={10} max={32} onChange={set('usernameFontSize')} />
    <Slider label={t.chatEmoteSize || 'Emote size'} value={v.emoteSize} min={16} max={64} onChange={set('emoteSize')} />
    <Slider label={t.messageGap || 'Space between messages'} value={v.messageGap} min={0} max={32} onChange={set('messageGap')} />
    <OptSlider label={t.chatPadding || 'Space inside a message'} value={v.rowPadding} min={0} max={48} whenUnset={12}
      onChange={set('rowPadding')} onClear={clear('rowPadding')} reset={reset} />
  </>);

  const shows = fold('shows', <ListChecks size={13} />, t.chatSecShows || 'What a message shows', <>
    {draws.marks ? (
      <>
        <Switch label={t.platformIcons || 'Platform icons'} on={Boolean(v.showPlatformIcons)} onChange={set('showPlatformIcons')} />
        <Switch label={t.rankBadges || 'Rank badges'} on={Boolean(v.showRankBadges)} onChange={set('showRankBadges')} />
        {draws.slots && (v.showPlatformIcons || v.showRankBadges) && (
          <Under>
            <Choice label={t.badgePosition || 'Badges go'} value={v.badgePosition || 'before'}
              options={BADGE_POSITIONS.map((p: string) => ({ value: p, label: p === 'before' ? (t.chatBeforeName || 'Before the name') : (t.chatAfterName || 'After the name') }))}
              onChange={set('badgePosition')} />
          </Under>
        )}
      </>
    ) : (
      <Note data-chat-marks-note>{t.chatRetroMarks || 'Retro marks the platform with a coloured dot and draws no rank badges.'}</Note>
    )}
    <Switch label={t.usernameColors || 'Name colours'} on={Boolean(v.colorUsername)} onChange={set('colorUsername')} />
    <Switch label={t.userAvatars || 'Avatars'} on={Boolean(v.showAvatars)} onChange={set('showAvatars')} />
    {draws.slots && v.showAvatars && (
      <Under>
        <Choice label={t.avatarShape || 'Avatar shape'} value={v.avatarShape || 'circle'}
          options={AVATAR_SHAPES.map((a: string) => ({ value: a, label: shapeWords[a] || a }))} onChange={set('avatarShape')} />
        <OptSlider label={t.avatarSize || 'Avatar size'} value={v.avatarSize} min={12} max={96} whenUnset={32}
          onChange={set('avatarSize')} onClear={() => patch({ avatarSize: 32 })} reset={reset} />
      </Under>
    )}
    <Switch label={t.showTimestamp || 'Show the time'} on={timeOn} onChange={set('showTimestamp')} />
    {timeOn && (
      <Under>
        <Choice label={t.clock || 'Clock'} value={v.timestampFormat || 'theme'}
          options={TIMESTAMP_FORMATS.map((f: string) => ({ value: f, label: clockWords[f] || f }))} onChange={set('timestampFormat')} />
        {draws.slots && (
          <Choice label={t.timePosition || 'Time sits'} value={v.timestampPosition || 'right'}
            options={TIMESTAMP_POSITIONS.map((p: string) => ({ value: p, label: p === 'left' ? (t.chatLeft || 'Left') : (t.chatRight || 'Right') }))}
            onChange={set('timestampPosition')} />
        )}
      </Under>
    )}
    {draws.slots ? (
      <>
        <Choice label={t.arrangement || 'Arrangement'} value={v.layout || 'stacked'}
          options={CHAT_LAYOUTS.map((l: string) => ({ value: l, label: l === 'stacked' ? (t.chatNameAbove || 'Name above') : (t.chatOneLine || 'All one line') }))}
          onChange={set('layout')} />
        {v.layout === 'inline' && (
          <Under>
            <div className="space-y-2">
              <label className={labelClass}>{t.chatSeparator || 'Between name and message'}</label>
              <input type="text" maxLength={3} value={v.nameSeparator || ''} placeholder=":" onChange={(e) => patch({ nameSeparator: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 outline-none focus:border-current-accent" />
            </div>
          </Under>
        )}
      </>
    ) : (
      // Said rather than hidden without a word, so nobody hunts for them.
      <Note data-chat-slots-note>{t.chatMoreInCustom || 'With the Custom look you can also choose where the badges and the time sit, the avatar’s shape and size, and run the name into the message.'}</Note>
    )}
  </>);

  const text = fold('text', <Type size={13} />, t.chatSecText || 'Text', <>
    <Choice label={t.font || 'Font'} value={v.fontFamily || ''} options={fontOptions} onChange={set('fontFamily')} />
    <div className="flex justify-end -mt-2"><FontUploadButton t={t} /></div>
    <OptSlider label={t.weight || 'Weight'} value={v.fontWeight} min={100} max={900} step={100} suffix="" whenUnset={400}
      onChange={set('fontWeight')} onClear={clear('fontWeight')} reset={reset} />
    <OptSlider label={t.lineHeight || 'Line height'} value={v.lineHeight} min={0.8} max={3} step={0.05} suffix="" whenUnset={1.5}
      onChange={set('lineHeight')} onClear={clear('lineHeight')} reset={reset} />
    <Colour label={t.textColour || 'Colour'} value={v.textColor} fallback="#d4d4d8" onChange={set('textColor')} onClear={clear('textColor')} reset={reset} />
    {/* The one control here about being seen rather than looking a certain way: chat over bright gameplay is unreadable without it. */}
    <OptSlider label={t.outline || 'Outline'} value={v.outlineWidth || ''} min={0} max={8} whenUnset={0}
      onChange={set('outlineWidth')} onClear={() => patch({ outlineWidth: 0 })} reset={reset} />
    {Boolean(v.outlineWidth) && (
      <Under>
        <Colour label={t.outlineColour || 'Outline colour'} value={v.outlineColor} fallback="#000000"
          onChange={set('outlineColor')} onClear={() => patch({ outlineColor: '#000000' })} reset={reset} />
      </Under>
    )}
    <span className={`${labelClass} block pt-2 text-zinc-400`}>{t.chatNames || 'Names'}</span>
    <OptSlider label={t.weight || 'Weight'} value={v.usernameWeight} min={100} max={900} step={100} suffix="" whenUnset={700}
      onChange={set('usernameWeight')} onClear={clear('usernameWeight')} reset={reset} />
    <Choice label={t.letterCase || 'Case'} value={v.usernameCase || 'theme'}
      options={USERNAME_CASES.map((c: string) => ({ value: c, label: caseWords[c] || c }))} onChange={set('usernameCase')} />
  </>);

  const box = fold('box', <Square size={13} />, t.chatSecBox || 'Message box', <>
    <Colour label={t.background || 'Background'} value={v.rowBackground} fallback="#18181b" onChange={set('rowBackground')} onClear={clear('rowBackground')} reset={reset} />
    <OptSlider label={t.corners || 'Corners'} value={v.rowRadius} min={0} max={48} whenUnset={16}
      onChange={set('rowRadius')} onClear={clear('rowRadius')} reset={reset} />
  </>);

  const ranks = fold('ranks', <Shield size={13} />, t.highlightRanks || 'Highlight by rank', <>
    <Note>{t.highlightRanksHint}</Note>
    {CHAT_RANKS.map(({ key, label, fallback, platforms }) => {
      const on = Boolean(highlightRanks[key]);
      return (
        <div key={key} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <Switch label={t[label]} on={on} onChange={() => patch({ highlightRanks: { ...highlightRanks, [key]: on ? '' : fallback } })} />
            <span className="block text-[8px] text-zinc-600 -mt-0.5">{platforms}</span>
          </div>
          <div className={`w-7 h-7 rounded-lg border border-zinc-700 overflow-hidden relative shrink-0 ${on ? '' : 'opacity-25 pointer-events-none'}`}>
            <input type="color" value={highlightRanks[key] || fallback}
              onChange={(e) => patch({ highlightRanks: { ...highlightRanks, [key]: e.target.value } })}
              className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-none cursor-pointer" />
          </div>
        </div>
      );
    })}
  </>);

  const events = fold('events', <Bell size={13} />, t.chatEventsSection || 'Events in chat', <>
    <Switch label={t.events || 'Events'} on={Boolean(v.showEvents)} onChange={set('showEvents')} />
    {v.showEvents && (
      <Under>
        <div className="grid grid-cols-3 gap-2">
          {CHAT_EVENT_PLATFORMS.map((pf) => (
            <button
              key={pf}
              onClick={() => patch({ eventPlatforms: { ...eventPlatforms, [pf]: !chatEventsOn(eventPlatforms, pf) } })}
              className={`px-2 py-2 rounded-lg text-[9px] font-black border transition-all uppercase tracking-widest flex items-center justify-center gap-1.5 ${chatEventsOn(eventPlatforms, pf) ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}
            >
              {pf === 'twitch' && <TwitchIcon size={10} />} {pf === 'youtube' && <YouTubeIcon size={10} />} {pf === 'tiktok' && <TikTokIcon size={10} />} <span>{pf}</span>
            </button>
          ))}
        </div>
      </Under>
    )}
  </>);

  // Named apart from a layer's own Motion, which sits under the chat's on the Overlays screen and moves the whole box.
  const motion = fold('motion', <Sparkles size={13} />, t.chatSecMotion || 'Message motion', <>
    <Choice label={t.entrance || 'How a message arrives'} value={v.animationIn || 'theme'}
      options={CHAT_ANIMATIONS.map((a: string) => ({ value: a, label: animWords[a] || a }))} onChange={set('animationIn')} />
    <OptSlider label={t.duration || 'Duration'} value={v.animationMs} min={0} max={2000} step={50} suffix="ms" whenUnset={300}
      onChange={set('animationMs')} onClear={clear('animationMs')} reset={reset} />
  </>);

  return { fold, size, shows, text, box, ranks, events, motion };
}
