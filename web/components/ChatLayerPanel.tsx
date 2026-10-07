/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A chat layer's own settings, on the Overlays screen: every control the
 * chat has, for this layer — and a way to give the chat on every other
 * layout the same, since within one overlay profile the chat usually looks
 * alike everywhere and only sits in a different place.
 *
 * Laid out like the dock's page, in folding sections each holding everything
 * about one thing, and built from the same parts (ChatSettingParts). What a
 * chat layer has that the dock does not sits where it belongs: the look is
 * chosen first, above the sections, because it decides which of them have
 * anything to set — Retro draws no badges, and only Custom places its parts —
 * and a control that would do nothing under the chosen look is not offered.
 * Custom's stylesheet is the first section under Custom, and hiding old
 * messages, which only the stream does, is the last.
 */
import React, { useState } from 'react';
import { Code2, Copy, History } from 'lucide-react';
import { CHAT_DEFAULTS } from '../../shared/chat-style.js';
import { CHAT_THEMES } from '../constants';
import { Note, Slider, Switch, Under, labelClass, useChatSections } from './ChatSettingParts';
import { StylesheetPanel } from './StylesheetPanel';
import { fill } from '../words';

/**
 * Parts inside the chat that a stylesheet may name.
 *
 * Only what every theme draws. A rule written against one theme that meant
 * nothing in another would break the moment somebody switched, with no hint
 * as to why — so the marks are named in all four even where one of them is a
 * coloured dot rather than a row of icons.
 *
 * A row also carries the rank its chatter holds, as data-chat-rank, and the
 * colour chosen for it, as the --chat-rank property. So a rule can treat a
 * moderator differently, or paint something in their colour without knowing
 * what it is: var(--chat-rank, whatever you want for everybody else).
 */
export const CHAT_PARTS = [
  '[data-chat="row"]',
  '[data-chat="user"]',
  '[data-chat="text"]',
  '[data-chat="time"]',
  '[data-chat="avatar"]',
  '[data-chat="marks"]',
  '[data-chat="highlight"]',
];

/** How long a message stays when hiding is first turned on. */
const HIDE_AFTER = 30;

interface Props {
  /** The layer's settings, as the server holds them: a whole set. */
  config: Record<string, any>;
  /** Change one or more of them, on this layer. */
  patch: (next: Record<string, any>) => void;
  /** The chat layers on the other layouts, and how many of those look different from this one. */
  others: { count: number; differ: number };
  /** Give every other layout's chat this one's settings. */
  shareEverywhere: () => void;
  t: any;
}

export const ChatLayerPanel = ({ config, patch, others, shareEverywhere, t }: Props) => {
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);
  const v = { ...CHAT_DEFAULTS, ...(config || {}) };
  const set = (key: string) => (value: any) => patch({ [key]: value });
  const custom = v.chatTheme === 'custom';

  const s = useChatSections({
    values: v,
    patch,
    t,
    draws: { marks: v.chatTheme !== 'retro', slots: custom },
    reset: { word: t.chatThemeReset || 'Theme', hint: t.chatThemeResetHint || 'Back to what the look does by itself' },
    storageKey: 'chat_layer_sections',
  });

  const looks: Record<string, [string, string]> = {
    modern: [t.chatThemeModern || 'Modern', t.chatThemeModernHint || 'The name over the message, in soft rounded rows.'],
    compact: [t.chatThemeCompact || 'Compact', t.chatThemeCompactHint || 'One tight line per message, the time first.'],
    retro: [t.chatThemeRetro || 'Retro console', t.chatThemeRetroHint || 'Each message on a little console screen.'],
    custom: [t.chatThemeCustom || 'Custom', t.chatThemeCustomHint || 'Put each part where you want it, or wear a look from the Library.'],
  };
  const hiding = Boolean(v.autoHideSeconds);
  const written = Boolean(String(v.css || '').trim() || String(v.motionCss || '').trim());

  return (
    <div className="flex flex-col pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()} data-chat-layer-panel>
      <p className="text-[10px] text-zinc-500 leading-relaxed pb-3">
        {t.chatLayerHelp || 'What viewers see, on this layout. Each chat layer keeps its own settings, so they change with the overlay profile.'}
      </p>

      {/*
        Before the settings, because it is the one thing here about more than
        this layout, and asked before it is done: it replaces the chat
        settings on every other layout, which is somebody's work on each.
      */}
      <div className="rounded-xl border border-zinc-800 p-3 space-y-2 mb-4" data-chat-layer-share>
        <p className="text-[9px] text-zinc-500 leading-relaxed">
          {others.count === 0
            ? (t.chatLayerShareNone || 'No other layout has a chat yet.')
            : others.differ === 0
              ? fill(t.chatLayerShareSame || 'The chat on the {count} other layout(s) already looks like this one.', { count: others.count })
              : fill(t.chatLayerShareDiffer || '{differ} of the {count} other layout(s) with a chat look different from this one.', { differ: others.differ, count: others.count })}
        </p>
        {others.differ > 0 && !asking && (
          <button
            onClick={() => { setAsking(true); setDone(false); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-300 hover:text-white"
            data-chat-layer-share-ask
          >
            <Copy size={12} /> {t.chatLayerShare || 'Use this chat on every layout'}
          </button>
        )}
        {asking && (
          <div className="space-y-2">
            <p className="text-[9px] text-amber-200 leading-relaxed">
              {fill(t.chatLayerShareConfirm || 'This replaces the chat settings on {differ} other layout(s) with these. Their places stay where they are.', { differ: others.differ })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { shareEverywhere(); setAsking(false); setDone(true); }}
                className="flex-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-amber-500/10 border-amber-500/60 text-amber-200 hover:bg-amber-500/20"
                data-chat-layer-share-go
              >
                {t.chatLayerShareGo || 'Use it everywhere'}
              </button>
              <button onClick={() => setAsking(false)} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-800 text-zinc-400 hover:text-white">
                {t.cancel || 'Cancel'}
              </button>
            </div>
          </div>
        )}
        {done && others.differ === 0 && (
          <p className="text-[9px] text-current-accent font-black uppercase tracking-widest">{t.chatLayerShareDone || 'Every layout’s chat looks like this one now.'}</p>
        )}
      </div>

      {/*
        The look, first: it decides what the sections under it offer. As many
        to a row as the column has room for — the panel is a narrow column
        beside the canvas on a wide screen and the whole width on a phone.
      */}
      <div className="space-y-2 pb-4" data-chat-look>
        <span className={labelClass}>{t.chatLook || 'Chat look'}</span>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-1.5">
          {CHAT_THEMES.map(({ id }) => {
            const on = v.chatTheme === id;
            const [name, hint] = looks[id] || [id, ''];
            return (
              <button
                key={id}
                onClick={() => patch({ chatTheme: id })}
                aria-pressed={on}
                className={`text-left px-3 py-2 rounded-xl border transition-all ${on ? 'bg-current-accent/10 border-current-accent' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                data-chat-theme={id}
              >
                <span className={`block text-[10px] font-black uppercase tracking-widest ${on ? 'text-current-accent' : 'text-zinc-300'}`}>{name}</span>
                <span className="block text-[9px] text-zinc-500 leading-snug mt-0.5">{hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/*
        The chat's own stylesheet, where it does something: only Custom reads
        one. The other three draw their own markup, and a rule written against
        them is a rule against something the next version may rewrite — so it
        is offered only there, since a control that silently does nothing
        reads as broken. First under Custom, because somebody writing one is
        doing the thing the look is for.
      */}
      {custom && s.fold('sheet', <Code2 size={13} />, t.chatCss || 'Chat CSS', (
        <StylesheetPanel
          bare
          title={t.chatCss || 'Chat CSS'}
          css={v.css}
          motionCss={v.motionCss}
          scopeHint={t.chatScopeHint || 'is the chat column. Pseudo-elements and @keyframes work here too.'}
          travelsHint={t.chatCssTravelsLayer || 'This chat only. “Use this chat on every layout” above gives the others the same.'}
          parts={CHAT_PARTS}
          patch={patch}
          t={t}
        />
      ), written)}

      {s.size}
      {s.shows}
      {s.text}
      {s.box}
      {s.ranks}
      {s.events}
      {s.motion}

      {/*
        The stream's alone: the dock keeps everything, so it can still be read
        back. A switch, with how long and how softly tucked under it, rather
        than a slider whose 0 means off.
      */}
      {s.fold('old', <History size={13} />, t.chatSecOld || 'Old messages', <>
        <Switch label={t.chatHideOld || 'Hide old messages'} on={hiding}
          onChange={(on) => patch({ autoHideSeconds: on ? HIDE_AFTER : 0 })} />
        {hiding && (
          <Under>
            <Slider label={t.hideAfter || 'Hide after'} value={v.autoHideSeconds} min={5} max={300} step={5} suffix="s" onChange={set('autoHideSeconds')} />
            <Slider label={t.fade || 'Fade'} value={v.autoHideFadeMs ?? 600} min={0} max={3000} step={100} suffix="ms" onChange={set('autoHideFadeMs')} />
          </Under>
        )}
        <Note>{t.chatHideOldHint || 'Each message leaves the stream this long after it arrives. The dock keeps them all, so you can still read back.'}</Note>
      </>, hiding)}
    </div>
  );
};
