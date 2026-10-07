/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A chat message, as every surface draws it.
 *
 * This lived inline in App.tsx, which meant the only way to put chat on screen
 * was to *be* one of App's standalone modes. A composited overlay needs to
 * draw chat as one layer among several, so the renderer had to become
 * something anyone can mount.
 *
 * The markup is byte-identical to what App rendered — it was moved, not
 * rewritten. Two things changed, both forced by the move: it reads a
 * `settings` object handed to it rather than reaching into App's hook, and
 * clicking a name calls `onMention` instead of typing into a message box it
 * can no longer see. App guarded that call with a mode check for the same
 * reason — on an overlay there is nothing to type into.
 */
import React from 'react';
import { Video, Sword, Gem, Star } from 'lucide-react';
import { ChatMessage } from '../types';
import { CHAT_RANKS, TRANSLATIONS } from '../constants';
import { PLATFORMS } from '../../shared/platforms.js';
import { inkFor } from '../../shared/chat-style.js';
import { parseMessageWithEmotes } from '../utils';
import { ScopedStyle } from './ScopedStyle';
// Copied from App rather than shared: eight files in this codebase declare
// their own platform marks, and matching that convention keeps this file
// self-contained. Consolidating all nine is its own change.
const TwitchIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></svg>
);
const TikTokIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
);
const DiscordIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6034.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
  </svg>
);

const YouTubeIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
);

/*
  Whichever platform it came from, drawn in that platform's colour.

  Four themes each carried the same three lines naming Twitch, TikTok and
  Discord one at a time, so a fourth platform meant four more edits and a fifth
  would mean four more again. The mark comes from the table now: a platform the
  table does not know draws nothing rather than drawing the wrong thing.
*/
const MARKS: Record<string, any> = {
  twitch: TwitchIcon, youtube: YouTubeIcon, tiktok: TikTokIcon, discord: DiscordIcon,
};

/** `plain` leaves the platform's own colour off, for a row of marks drawn in one colour (the menu's platforms). */
export const PlatformMark = ({ platform, size, plain = false }: { platform: string; size: number; plain?: boolean }) => {
  const Icon = MARKS[platform];
  if (!Icon) return null;
  if (plain) return <span className="inline-flex shrink-0"><Icon size={size} /></span>;
  /*
    The colour goes on a wrapper rather than on the icon. Each of these takes a
    className and nothing else, so a style prop handed to one is quietly
    dropped and every mark comes out white — which is what it did.
  */
  return (
    <span className="inline-flex shrink-0" style={{ color: (PLATFORMS as any)[platform]?.colour }}>
      <Icon size={size} />
    </span>
  );
};

/** Only the display preferences the renderer actually reads. */
export interface ChatRenderSettings {
  chatTheme: string;
  fontSize: number;
  usernameFontSize: number;
  emoteSize: number;
  showAvatars: boolean;
  showPlatformIcons: boolean;
  showRankBadges: boolean;
  colorUsername: boolean;
  animations: boolean;
  highlightRanks?: Record<string, string>;

  /*
    Style tokens. All optional, and an unset one means the theme decides —
    '' for a value, 'theme' for a choice. They are written as inline styles,
    which beat the Tailwind classes each theme is built from, so leaving one
    unset writes nothing and the theme draws exactly as it always did.
  */
  fontFamily?: string;
  fontWeight?: number | '';
  lineHeight?: number | '';
  textColor?: string;
  outlineWidth?: number;
  outlineColor?: string;
  usernameWeight?: number | '';
  usernameCase?: 'theme' | 'none' | 'upper' | 'lower';
  showTimestamp?: boolean;
  timestampFormat?: 'theme' | '12h' | '24h';
  rowBackground?: string;
  rowRadius?: number | '';
  rowPadding?: number | '';
  animationIn?: string;
  animationMs?: number | '';
  autoHideSeconds?: number;
  autoHideFadeMs?: number;

  /* The slots. Read by the 'custom' theme only — see shared/chat-style.js. */
  layout?: 'stacked' | 'inline';
  timestampPosition?: 'left' | 'right';
  badgePosition?: 'before' | 'after';
  avatarShape?: 'circle' | 'rounded' | 'square';
  avatarSize?: number;
  nameSeparator?: string;
}

/** An unset token contributes nothing, leaving the theme's own class in charge. */
const val = (v: any) => (v === '' || v === null || v === undefined ? undefined : v);
const px = (v: any) => (v === '' || v === null || v === undefined ? undefined : `${v}px`);

/*
  A readable outline, built from eight offset shadows rather than
  -webkit-text-stroke.

  A real stroke is drawn inside the glyph, so it eats a light weight from both
  sides and Montserrat at chat sizes comes out spindly. Shadows sit behind the
  glyph and leave it whole, which is what makes chat legible over bright
  gameplay — the thing this setting exists for.
*/
const outlineShadow = (width: number, colour: string) => {
  if (!width) return undefined;
  const ring = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  return ring.map(([x, y]) => `${x * width}px ${y * width}px 0 ${colour}`).join(', ');
};

/** What every theme uses today, and the floor when no animation is chosen. */
const THEME_ANIMATION = 'animate-slide-up';

export interface ChatMessageRowProps {
  chat: ChatMessage;
  /** Position in the log. The retro theme varies by row. */
  idx: number;
  settings: ChatRenderSettings;
  /** Translation strings. */
  t: any;
  /** Clicking a name. No-op wherever there is nothing to type into. */
  onMention?: (name: string) => void;
  /*
    Whether messages expire on this surface.

    Passed in rather than read from the settings, because it is the surface
    that decides: appearance is one shared server-side setting now, so an
    expiry read straight from it would also empty the dock you are reading in.
    Only a surface that is on stream asks for this.
  */
  autoHide?: boolean;
  /*
    Whether this is what viewers see, or a preview of it.

    Words the chat writes itself — an event line's "Subscriber (Tier 1)" —
    are in Spanish there, whatever language this device's screens are in:
    the stream is in Spanish, and a browser source in OBS has never been told
    a language at all, so it drew them in English.
  */
  onStream?: boolean;
}

export const ChatMessageRow = ({ chat, idx, settings, t, onMention = () => {}, autoHide = false, onStream = false }: ChatMessageRowProps) => {
  /** The words for event lines: Spanish on stream, this device's language elsewhere. */
  const words: any = onStream ? TRANSLATIONS.es : t;
  const fill = (text: string, key: string, value: any) => String(text).split(`{${key}}`).join(String(value));
  /**
   * The rank badges to show beside a name, highest first.
   *
   * Every rank the chatter holds is shown rather than only the winning one:
   * the badges say who somebody is, which is different from the single colour
   * that frames their message. A rank with no colour chosen still gets its
   * badge, in the Twitch default — the badge and the highlight are separate
   * choices, and wanting the icon without the frame is a reasonable thing to
   * want.
   */
  const rankBadgesFor = (chat: ChatMessage) => {
    const held: Record<string, boolean> = {
      broadcaster: Boolean(chat.isBroadcaster),
      moderator: Boolean(chat.isMod),
      vip: Boolean(chat.isVip),
      subscriber: Boolean(chat.isSub),
    };
    const icons: Record<string, any> = {
      broadcaster: Video, moderator: Sword, vip: Gem, subscriber: Star,
    };
    const chosen = settings.highlightRanks || {};
    return CHAT_RANKS
      .filter((r) => held[r.key])
      .map((r) => ({ key: r.key, Icon: icons[r.key], color: chosen[r.key] || r.fallback }));
  };

  /** Those badges as elements, or nothing when the setting is off. */
  const renderRankBadges = (chat: ChatMessage, size: number) => {
    if (!settings.showRankBadges) return null;
    return rankBadgesFor(chat).map(({ key, Icon, color }) => (
      <Icon key={key} size={size} style={{ color }} className="shrink-0" />
    ));
  };

  /*
    The timestamp is formatted on the server, in the server's locale, so
    reformatting it needs the moment the message arrived rather than the
    string. An older message that predates that field keeps its string.
  */
  const timeText = (chat: ChatMessage) => {
    const f = settings.timestampFormat;
    /*
      On stream, always from the moment and always in Spanish. The server's
      string is in the phone's locale and a browser source's own is OBS's —
      both English — so the stream read "11:41 PM". Spanish writes a 12-hour
      clock "11:41 p. m." and, left to itself, keeps 24 hours.
    */
    if (onStream && (chat as any).at) {
      return new Date((chat as any).at).toLocaleTimeString('es', {
        hour: '2-digit', minute: '2-digit', ...(f === '12h' || f === '24h' ? { hour12: f === '12h' } : {}),
      });
    }
    if (!f || f === 'theme' || !(chat as any).at) return chat.time;
    return new Date((chat as any).at)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: f === '12h' });
  };
  const showTime = settings.showTimestamp !== false;

  const outline = outlineShadow(settings.outlineWidth || 0, settings.outlineColor || '#000000');

  /** Entry animation: the chosen one, else the one every theme already used. */
  const animClass = !settings.animations ? ''
    : (settings.animationIn && settings.animationIn !== 'theme' ? settings.animationIn : THEME_ANIMATION);

  /** Applied to whichever element is actually the message box in each theme. */
  const rowStyle: React.CSSProperties = {
    backgroundColor: val(settings.rowBackground),
    borderRadius: px(settings.rowRadius),
    padding: px(settings.rowPadding),
    animationDuration: settings.animations && val(settings.animationMs) !== undefined
      ? `${settings.animationMs}ms` : undefined,
  };

  /**
   * The highest rank a chatter holds, or nothing.
   *
   * Same order as the highlight colour, and for the same reason: these
   * overlap, so a broadcaster is also a moderator and usually a subscriber,
   * and without an order every one of them would come out a subscriber.
   *
   * Named on the row whether or not a colour was chosen for it, because a
   * stylesheet may want to treat moderators differently without lighting
   * them up — those are two decisions and only one of them lives in the
   * rank settings.
   */
  const rankOf = (chat: ChatMessage): string => {
    if (chat.isBroadcaster) return 'broadcaster';
    if (chat.isMod) return 'moderator';
    if (chat.isVip) return 'vip';
    if (chat.isSub) return 'subscriber';
    return '';
  };

  const renderChatMessageBody = (chat: ChatMessage, idx: number) => {
    /*
      The rank, and the colour chosen for it, handed to the stylesheet.

      The colour arrives as a custom property rather than being written into
      anything, so a rule can use the colour somebody picked in the rank
      settings without knowing what it is — var(--chat-rank, …) with a
      fallback for everybody who holds no rank.
    */
    const rank = rankOf(chat);
    const rankColour = highlightColorFor(chat);
    const rankPicked: string = rank ? ((settings.highlightRanks || {}) as Record<string, string>)[rank] || '' : '';
    /*
      The three that used to be written straight onto every message.

      Inline beats a stylesheet, so a chat stylesheet asking for a size or a
      username colour lost to a control nobody had touched — while the
      background and the padding beside it obeyed, because those are only
      written when somebody sets one. Two behaviours for one box, and no way
      to tell from the outside which half you were arguing with.

      They travel as values now, the way --chat-rank already does, and the
      defaults that read them sit in the stylesheet at no specificity at all,
      so anything written about them wins.
    */
    const vars: React.CSSProperties = {
      ['--chat-font-size' as any]: `${settings.fontSize}px`,
      ['--chat-username-size' as any]: `${settings.usernameFontSize}px`,
      // Left unset when username colours are off, so each theme’s own class
      // stays in charge rather than losing to an empty value.
      ...(settings.colorUsername && chat.color ? { ['--chat-user-color' as any]: chat.color } : {}),
      /*
        For a look that draws each rank its own way — the dock's Marathon —
        rather than outlining the line: the colour picked for the rank this
        row names, and only that one. --chat-rank falls through to the next
        rank that has a colour, so a broadcaster who moderates, with no owner
        colour picked, would come out a moderator. With the words to write on
        each colour, and the rank colour as an edge for a look that draws the
        edge as an image. Nothing reads these otherwise.
      */
      ...(settings.colorUsername && inkFor(chat.color) ? { ['--chat-user-ink' as any]: inkFor(chat.color) } : {}),
      ...(rankPicked ? {
        ['--chat-rank-picked' as any]: rankPicked,
        ['--chat-rank-edge' as any]: `linear-gradient(${rankPicked}, ${rankPicked})`,
      } : {}),
      ...(rankPicked && inkFor(rankPicked) ? { ['--chat-rank-ink' as any]: inkFor(rankPicked) } : {}),
      /*
        What was chosen for the row, the words and the name, for a look to
        read before its own. The same values are written inline above, which
        is enough without a look; a look says !important over those, so it
        reads these first, and a setting left unset is not here at all.
      */
      ['--chat-row-bg' as any]: val(settings.rowBackground),
      ['--chat-row-radius' as any]: px(settings.rowRadius),
      ['--chat-row-padding' as any]: px(settings.rowPadding),
      ['--chat-text' as any]: val(settings.textColor),
      ['--chat-user-weight' as any]: val(settings.usernameWeight),
    };
    const rowWithRank: React.CSSProperties = rankColour
      ? { ...rowStyle, ...vars, ['--chat-rank' as any]: rankColour }
      : { ...rowStyle, ...vars };
    const commonStyle: React.CSSProperties = {
      fontFamily: val(settings.fontFamily),
      fontWeight: val(settings.fontWeight),
      lineHeight: val(settings.lineHeight),
      color: val(settings.textColor),
      textShadow: outline,
    };
    const userStyle: React.CSSProperties = {
      fontFamily: val(settings.fontFamily),
      fontWeight: val(settings.usernameWeight),
      textTransform: settings.usernameCase && settings.usernameCase !== 'theme'
        ? ({ none: 'none', upper: 'uppercase', lower: 'lowercase' } as const)[settings.usernameCase]
        : undefined,
      textShadow: outline,
    };

    /*
      The custom theme: the only one assembled rather than drawn.

      The three above keep their hardcoded markup, and that is deliberate —
      bending them to honour an arrangement setting would mean rewriting the
      thing that makes each of them itself, and somebody who wants a different
      arrangement wants their own rather than a modified Retro.

      Unlike the others this has no look to fall back to, so it carries base
      classes for padding and shape. The row tokens are inline styles, which
      beat those, so setting one still wins.
    */
    if (settings.chatTheme === 'custom') {
      const inline = settings.layout === 'inline';
      const timeLeft = settings.timestampPosition === 'left';
      const marksFirst = settings.badgePosition !== 'after';
      const avatarPx = settings.avatarSize ?? 32;
      const avatarShape = ({ circle: 'rounded-full', rounded: 'rounded-lg', square: 'rounded-none' } as const)[
        (settings.avatarShape || 'circle') as 'circle' | 'rounded' | 'square'
      ];

      const avatar = settings.showAvatars && chat.avatar ? (
        <img
          src={chat.avatar}
          alt=""
          className={`${avatarShape} shrink-0 object-cover border border-white/5`} data-chat="avatar"
          style={{ width: avatarPx, height: avatarPx }}
        />
      ) : null;

      // The platform mark and the rank badges move together: they are both
      // "who is this", and splitting them across the name reads as clutter.
      const marks = (
        <span className="flex items-center gap-1 shrink-0 select-none" data-chat="marks">
          {settings.showPlatformIcons && <PlatformMark platform={chat.platform} size={12} />}
          {renderRankBadges(chat, 12)}
        </span>
      );

      const name = (
        <span
          onClick={() => onMention(chat.user)}
          title={t.replyTo}
          className={`cursor-pointer hover:underline font-bold truncate ${settings.colorUsername ? '' : 'text-zinc-100'}`} data-chat="user"
          style={userStyle}
        >
          {chat.user}{inline ? (settings.nameSeparator || '') : ''}
        </span>
      );

      const time = showTime ? (
        // Pushed to the end when it belongs on the right, in either layout.
        <span
          className={`text-[9px] font-mono font-bold text-zinc-600 whitespace-nowrap select-none ${timeLeft ? '' : 'ml-auto'}`} data-chat="time"
          style={{ textShadow: outline }}
        >
          {timeText(chat)}
        </span>
      ) : null;

      const message = parseMessageWithEmotes(chat.msg, chat.emotes, settings.emoteSize, (chat as any).names);

      if (inline) {
        return (
          <div key={chat.id} className={`group flex items-baseline gap-1.5 p-2 rounded-xl hover:bg-white/5 ${animClass}`} data-chat="row" data-chat-kind="custom" data-chat-rank={rank || undefined} style={rowWithRank}>
            {avatar}
            {timeLeft && time}
            {marksFirst && marks}
            {name}
            {!marksFirst && marks}
            <span className="flex-1 min-w-0 break-words text-zinc-300" data-chat="text" style={commonStyle}>{message}</span>
            {!timeLeft && time}
          </div>
        );
      }

      return (
        <div key={chat.id} className={`group flex items-start gap-3 p-3 rounded-2xl hover:bg-white/5 ${animClass}`} data-chat="row" data-chat-kind="custom" data-chat-rank={rank || undefined} style={rowWithRank}>
          {avatar}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {timeLeft && time}
              {marksFirst && marks}
              {name}
              {!marksFirst && marks}
              {!timeLeft && time}
            </div>
            <div className="break-words text-zinc-300" data-chat="text" style={commonStyle}>{message}</div>
          </div>
        </div>
      );
    }

    if (settings.chatTheme === 'compact') { return ( <div key={chat.id} className={`group flex items-baseline gap-2 py-0.5 px-2 hover:bg-white/5 rounded-sm transition-colors ${animClass}`} data-chat="row" data-chat-kind="compact" data-chat-rank={rank || undefined} style={rowWithRank}> {showTime && (<span className="text-[10px] font-mono text-zinc-600 shrink-0 select-none" data-chat="time">{timeText(chat)}</span>)} <div className="flex items-center gap-1 shrink-0 select-none" data-chat="marks"> {settings.showAvatars && chat.avatar && ( <img src={chat.avatar} className="w-4 h-4 rounded-full" data-chat="avatar" alt="" /> )} {settings.showPlatformIcons && <PlatformMark platform={chat.platform} size={10} />} {renderRankBadges(chat, 10)} </div> <div className="flex-1 break-words leading-snug"> <span onClick={() => onMention(chat.user)} title={t.replyTo} className={`cursor-pointer hover:underline font-bold mr-1 ${settings.colorUsername ? '' : 'text-zinc-300'}`} data-chat="user" style={userStyle}> {chat.user}: </span> <span className="text-zinc-300" data-chat="text" style={commonStyle}> {parseMessageWithEmotes(chat.msg, chat.emotes, settings.emoteSize, (chat as any).names)} </span> </div> </div> ); }
    if (settings.chatTheme === 'retro') { return ( <div key={chat.id} className={`mb-4 relative group ${animClass}`} data-chat="row" data-chat-kind="retro" data-chat-rank={rank || undefined} style={{ animationDuration: rowStyle.animationDuration, ...vars, ...(rankColour ? { ['--chat-rank' as any]: rankColour } : {}) }}> <div className="bg-[#e5e7eb] p-1.5 rounded-md border-b-4 border-r-4 border-[#9ca3af]" style={rowStyle}> <div className="flex items-center justify-between px-1 mb-1"> <div className="flex items-center gap-2"> <span className="flex items-center shrink-0 select-none" data-chat="marks"><span className="w-3 h-3 rounded-full border border-black block" style={{ backgroundColor: (PLATFORMS as any)[chat.platform]?.colour || '#ff0050' }}></span></span> <span onClick={() => onMention(chat.user)} title={t.replyTo} className={`cursor-pointer hover:underline font-black font-mono uppercase tracking-tight ${settings.colorUsername ? '' : 'text-zinc-800'}`} data-chat="user" style={userStyle}> {chat.user} </span> </div> {showTime && (<span className="font-mono text-[9px] text-zinc-600 font-bold bg-zinc-200 px-1 rounded" data-chat="time">{timeText(chat)}</span>)} </div> <div className="bg-[#18181b] p-2.5 rounded-sm border-2 border-[#27272a] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"> <div className="flex gap-2"> {settings.showAvatars && chat.avatar && ( <img src={chat.avatar} className="w-8 h-8 rounded-none border border-zinc-600 shrink-0" data-chat="avatar" alt="Pix" style={{imageRendering: 'pixelated'}} /> )} <div className={`font-mono text-zinc-200 leading-snug break-words`} data-chat="text" style={commonStyle}> {parseMessageWithEmotes(chat.msg, chat.emotes, settings.emoteSize, (chat as any).names)} </div> </div> </div> <div className="absolute -bottom-1 left-4 w-8 h-1 bg-[#8b5cf6] rounded-b-md opacity-80"></div> </div> </div> ); }
    // Default 'modern'
    return ( <div key={chat.id} className={`group flex items-start gap-3 p-3 rounded-2xl transition-all duration-200 hover:bg-white/5 ${animClass}`} data-chat="row" data-chat-kind="modern" data-chat-rank={rank || undefined} style={rowWithRank}> {settings.showAvatars && chat.avatar && ( <img src={chat.avatar} className="w-8 h-8 rounded-lg shadow-sm border border-white/5 shrink-0" data-chat="avatar" alt="Avatar" /> )} <div className="flex-1 min-w-0"> <div className="flex items-center gap-2 mb-1"> <span className="flex items-center gap-1 shrink-0 select-none" data-chat="marks">{settings.showPlatformIcons && <PlatformMark platform={chat.platform} size={12} />} {renderRankBadges(chat, 12)}</span> <span onClick={() => onMention(chat.user)} title={t.replyTo} className={`cursor-pointer hover:underline font-black uppercase tracking-tight truncate ${settings.colorUsername ? '' : 'text-zinc-100'}`} data-chat="user" style={userStyle}> {chat.user} </span> {showTime && (<span className="text-[9px] font-mono font-bold text-zinc-600 whitespace-nowrap select-none" data-chat="time">{timeText(chat)}</span>)} </div> <div className={`leading-relaxed text-zinc-300 break-words`} data-chat="text" style={commonStyle}> {parseMessageWithEmotes(chat.msg, chat.emotes, settings.emoteSize, (chat as any).names)} </div> </div> </div> );
  };

  /**
   * Twitch's "Highlight My Message" reward. Wrapping the themed output keeps
   * the treatment consistent across all five chat themes instead of editing
   * each branch, and mirrors Twitch's own purple highlight.
   */
  /**
   * An event split into the part that belongs on the name line and the part
   * that belongs underneath.
   *
   * A redemption carries whatever the viewer typed, which is a message, not a
   * label. Keeping it on the name line meant a tall wrapped block with the
   * username stranded at the top of it and empty space alongside. Split in two,
   * an event reads like a chat line — "NAME Redeemed: Reward:" above, their
   * words below — while keeping its own tinted, bordered styling.
   *
   * Events carrying no text (follows, subs, raids) return no body and stay a
   * single line, which is also what removes the empty space for those.
   *
   * Wording matches the Events dock, so the two views still agree.
   */
  const eventLineParts = (chat: ChatMessage): { headline: string; body: string } => {
    const d: any = chat.eventData || {};
    if (chat.eventType === 'twitch_redemption') {
      const input = typeof d.input === 'string' ? d.input.trim() : '';
      const reward = `${words.labelRedeem}: ${d.reward}`;
      // Trailing colon only when something follows it, so an input-less
      // redemption does not end on a dangling punctuation mark.
      return { headline: input ? `${reward}:` : reward, body: input };
    }
    return { headline: eventLineLabel(chat), body: '' };
  };

  /** Same wording the Events dock uses, so the two views agree. */
  const eventLineLabel = (chat: ChatMessage) => {
    const d: any = chat.eventData || {};
    switch (chat.eventType) {
      case 'twitch_follow':
      case 'tiktok_follow': return words.labelFollower;
      case 'twitch_sub': {
        // Prime is a tier 1 somebody did not pay for; saying so beats "Tier 1".
        const about = [d.prime ? 'Prime' : fill(words.chatEventTier, 'n', d.tier || 1)];
        if (d.giftedBy) about.push(fill(words.chatEventGiftFrom, 'name', d.giftedBy));
        return `${words.labelSub} (${about.join(' · ')})`;
      }
      case 'twitch_sub_gift_bulk': return fill(words.chatEventGiftedSubs, 'n', d.count || 1);
      case 'tiktok_sub': return words.labelSub;
      case 'twitch_cheer': return `${words.labelCheer} (${fill(words.chatEventBits, 'n', d.bits)})`;
      case 'twitch_raid': return `${words.labelRaid} (${fill(words.chatEventViewers, 'n', d.viewers)})`;
      case 'twitch_redemption': {
        const reward = `${words.labelRedeem}: ${d.reward}`;
        const input = typeof d.input === 'string' ? d.input.trim() : '';
        return input ? `${reward} — "${input}"` : reward;
      }
      case 'tiktok_gift': return `${words.labelGift} (${d.giftName} x${d.count})`;
      case 'tiktok_share': return words.labelShare;
      // A Super Sticker arrives as this too. Their words, if any, are already
      // in the chat as a highlighted message, so the line only says what it was.
      case 'youtube_cheer': return d.amount ? `Super Chat (${d.amount})` : 'Super Chat';
      case 'youtube_sub': {
        // A milestone carries the months; a new member does not.
        if (Number(d.months) > 0) return fill(words.chatEventMemberMonths, 'n', d.months);
        return d.tier ? `${words.chatEventNewMember} (${d.tier})` : words.chatEventNewMember;
      }
      case 'youtube_sub_gift_bulk': return fill(words.chatEventGiftedMemberships, 'n', d.count || 1);
      default: return words.chatEventOther;
    }
  };

  /**
   * The colour to highlight a line with, or '' for none.
   *
   * Twitch's paid "Highlight My Message" always wins and keeps its own purple:
   * the viewer spent points on it, and repainting it in a rank colour would
   * hide what they paid for.
   *
   * Otherwise the highest rank the chatter holds decides, because these
   * overlap — a broadcaster is also a moderator and usually a subscriber, so
   * without an order every one of them would come out subscriber-coloured.
   */
  const highlightColorFor = (chat: ChatMessage): string => {
    if (chat.highlighted) return '#9146FF';
    const ranks = settings.highlightRanks || {};
    if (chat.isBroadcaster && ranks.broadcaster) return ranks.broadcaster;
    if (chat.isMod && ranks.moderator) return ranks.moderator;
    if (chat.isVip && ranks.vip) return ranks.vip;
    if (chat.isSub && ranks.subscriber) return ranks.subscriber;
    return '';
  };

  const renderChatMessageHelper = (chat: ChatMessage, idx: number) => {
    // Stream events render as their own compact row, tinted by platform, so
    // they read as events rather than as something somebody typed.
    if (chat.isEvent) {
      const { headline, body } = eventLineParts(chat);
      return (
        // Laid out like a chat line — name row above, message below — rather
        // than one long row that wrapped and left the username stranded beside
        // empty space. The tint, left border and translucent fill stay, so it
        // still reads as an event and not as something somebody typed.
        <div key={chat.id} className={`flex items-start gap-2 px-3 py-2 my-1 rounded-xl border-l-4 bg-white/[0.04] ${animClass}`} data-chat="row" data-chat-kind="event" style={{ borderLeftColor: chat.color }}>
          {settings.showAvatars && chat.avatar && (
            <img src={chat.avatar} className="w-5 h-5 rounded-md shrink-0 mt-0.5" data-chat="avatar" alt="" />
          )}
          <div className="flex-1 min-w-0">
            {/*
              Inline flow rather than a flex row. As flex items the name and the
              label were separate boxes, so a label too wide for the space left
              beside the name wrapped inside its own narrow column — breaking
              "Redeemed:" across lines a few characters at a time in a narrow
              dock. Inline, it wraps to the row's left edge like any sentence.

              The timestamp floats and is written first so it reserves its space
              on the opening line; later lines run the full width under it.
            */}
            <div className="break-words leading-snug">
              {showTime && (<span className="float-right ml-2 text-[8px] font-mono text-zinc-600" data-chat="time">{timeText(chat)}</span>)}
              <span className="font-black uppercase tracking-tight" data-chat="user" style={{ fontSize: `${settings.usernameFontSize}px`, color: chat.color }}>{chat.user}</span>
              {' '}
              <span className="text-zinc-300 font-semibold" data-chat="text" style={{ fontSize: `${Math.max(10, settings.fontSize - 2)}px` }}>{headline}</span>
            </div>
            {body && (
              // `clear-both` so the body always starts on its own line, even if
              // the floated timestamp is taller than a single header line.
              <div className="clear-both text-zinc-300 break-words leading-snug mt-0.5" style={{ fontSize: `${settings.fontSize}px` }}>
                {body}
              </div>
            )}
          </div>
        </div>
      );
    }

    const body = renderChatMessageBody(chat, idx);
    const tint = highlightColorFor(chat);
    if (!tint) return body;

    // The two reasons a line lights up are not the same thing, and they should
    // not look the same.
    //
    // The paid "Highlight My Message" is a one-off somebody spent points on:
    // it keeps the filled bar, which is loud on purpose. A rank applies to
    // every message that person ever sends, so the same treatment turns a
    // chatty moderator into a wall of colour. Twitch solves that with an
    // outline around the line and nothing else, and that reads far better at
    // the rate regulars actually talk.
    //
    // Colours are inline because they are user-chosen, which Tailwind cannot
    // know at build time.
    /*
      The bubble is named so a stylesheet can restyle it, or take it off and
      do something else with the rank — the colour is on the row as a custom
      property either way, so putting it somewhere else costs one rule.
    */
    return chat.highlighted ? (
      <div
        key={chat.id}
        className="rounded-2xl border-l-4" data-chat="highlight" data-chat-highlight="paid"
        style={{ borderLeftColor: tint, backgroundColor: `${tint}1a` }}
      >
        {body}
      </div>
    ) : (
      <div
        key={chat.id}
        className="rounded-2xl border" data-chat="highlight" data-chat-highlight="rank"
        style={{ borderColor: tint }}
      >
        {body}
      </div>
    );
  };


  /*
    Auto-hide, scheduled by the browser rather than by a React timer.

    An animation-delay of however long the message has left costs nothing to
    keep running — no interval ticking on a phone-hosted server, no re-render
    as each one expires. A message already older than its life renders at
    opacity 0 with no animation at all: an overlay that reloads is replayed
    the recent log, and those have to arrive gone rather than appear and then
    visibly fade in front of viewers.

    An expired message keeps its space, which is harmless here. The log is
    bottom-anchored and capped, so expired ones are always the topmost rows
    and the gap they leave sits off the top of an overlay.

    A message from before the server carried a timestamp has no age to judge,
    so it stays: better a stale message than every message vanishing at once
    the first time this is switched on.
  */
  const autoHideStyle = (): React.CSSProperties | undefined => {
    const life = (settings.autoHideSeconds || 0) * 1000;
    const at = (chat as any).at;
    if (!autoHide || !life || !at) return undefined;
    const left = at + life - Date.now();
    if (left <= 0) return { opacity: 0 };
    return { animation: `fadeOut ${settings.autoHideFadeMs ?? 600}ms ease-in ${left}ms forwards` };
  };

  const rendered = renderChatMessageHelper(chat, idx);
  const fading = autoHideStyle();
  // Only wrapped when it actually expires, so nothing else sees an extra node.
  return fading ? <div style={fading}>{rendered}</div> : rendered;
};

interface ChatLogProps extends Omit<ChatMessageRowProps, 'chat' | 'idx'> {
  messages: ChatMessage[];
  /** Vertical space between messages, in pixels. */
  gap?: number;
}

/**
 * The scrolling column of messages.
 *
 * `flex-col-reverse` so the newest message sits at the bottom and the view
 * stays pinned there as messages arrive, with no scroll arithmetic.
 *
 * Unlike the dock, this draws nothing at all when there is nothing to draw.
 * The dock's "connecting" and "no messages yet" placeholders are for someone
 * looking at the app; on stream they would be a caption nobody asked for.
 */
/**
 * The chat stylesheet, scoped to the column it is written in.
 *
 * Prelude-less @scope takes its root from the element the style sits in, so
 * :scope is the chat and nothing written can reach the rest of the page —
 * which matters more here than anywhere else, because on the dock surface
 * the chat shares a document with the whole app.
 *
 * One element, so a keyframe declared in the look is visible to the motion,
 * and the motion written last so it wins where both speak about the same
 * property — including against the built-in entrance, which is a class on
 * every row.
 */
export const ChatStyle = ({ settings }: { settings: any }) => {
  /*
    The custom theme only. The other three draw markup of their own that is
    rewritten whenever they are touched, so a stylesheet aimed at them is a
    rule that breaks on an update for a reason nobody can see — and the
    editor offers the box only there, so applying it elsewhere would be
    styling somebody cannot turn off.

    Handed over as nothing rather than not rendered, because the shared
    stylesheet is the thing that knows what to do with nothing.
  */
  const custom = settings?.chatTheme === 'custom';
  return <ScopedStyle css={custom ? settings?.css : undefined} motionCss={custom ? settings?.motionCss : undefined} />;
};

export const ChatLog = ({ messages, gap = 0, ...rest }: ChatLogProps) => (
  <div className="w-full h-full overflow-hidden flex flex-col-reverse" style={{ gap: `${gap}px` }}>
    <ChatStyle settings={(rest as any).settings} />
    {messages.map((chat, idx) => (
      <ChatMessageRow key={chat.id} chat={chat} idx={idx} {...rest} />
    ))}
  </div>
);
