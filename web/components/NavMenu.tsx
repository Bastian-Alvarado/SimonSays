/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The left-hand menu and what goes with it.
 *
 * Thirty-eight screens in four groups was a list to read rather than to use:
 * "Main" held the live controls beside the economy, the history and Twitch's
 * settings, "Automation" was mostly overlays, and the badges counted things
 * nobody needed to act on. Here:
 *
 *   - sections by when a screen is used — live, community, on screen,
 *     Discord, automation, setup — each folding away, remembered by this
 *     browser; the one holding the screen being shown opens on its own.
 *   - badges for what wants doing: questions waiting, new game requests, a
 *     poll or giveaway running, a connection that dropped.
 *   - the platforms as one row of marks at the bottom, a press away from
 *     Connections, instead of a box of seven lines.
 *   - a search (Ctrl+K) that goes to any screen by its name.
 *   - on a phone, a bar along the bottom with the screens used mid-stream.
 *
 * The App builds the sections (it has the counts and the words); this draws
 * them.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, CornerDownLeft, Menu as MenuIcon } from 'lucide-react';
import type { AppView } from '../types';

export interface NavItem {
  view: AppView;
  /** Other screens this entry stands for (tabs of one screen): lit when on any of them. */
  also?: AppView[];
  label: string;
  icon: React.ReactNode;
  /** Something waiting, as a number. */
  number?: number;
  /** A mark: something running now, or something wrong. */
  dot?: 'on' | 'alert';
  /** Says what the mark means, on hover. */
  hint?: string;
  /** Other words to find it by. */
  keywords?: string;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export const isOn = (item: NavItem, view: AppView) => item.view === view || Boolean(item.also?.includes(view));

const Dot = ({ kind }: { kind: 'on' | 'alert' }) => (
  <span className={`w-2 h-2 rounded-full shrink-0 ${kind === 'alert' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} data-nav-dot={kind} />
);

export const NavButton = ({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    title={item.hint || undefined}
    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${active ? 'bg-current-accent/10 text-current-accent border-l-2 border-current-accent' : 'text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-200'}`}
    data-nav-item={item.view}
  >
    <span className={`${active ? 'text-current-accent' : 'text-zinc-600 group-hover:text-zinc-400'} transition-colors shrink-0`}>{item.icon}</span>
    <span className="font-semibold text-sm tracking-wide flex-1 text-left truncate">{item.label}</span>
    {item.dot && <Dot kind={item.dot} />}
    {item.number ? (
      <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded min-w-[1.5rem] text-center transition-colors ${active ? 'bg-current-accent text-white' : 'bg-zinc-800 text-zinc-300'}`} data-nav-number>{item.number}</span>
    ) : null}
  </button>
);

/**
 * The sections, each folding away. They start folded — the menu opens as a
 * short list of its sections — all but the one holding the screen being
 * shown, which also opens whenever a screen in it is gone to. Which are open
 * lasts while the page is open, not from one visit to the next.
 */
export const NavSections = ({ sections, view, go }: { sections: NavSection[]; view: AppView; go: (view: AppView) => void }) => {
  const holding = sections.find((s) => s.items.some((i) => isOn(i, view)))?.id;
  const [opened, setOpened] = useState<Set<string>>(() => new Set(holding ? [holding] : []));
  // Gone to a screen in a folded section (from the search, the phone's bar): that section opens.
  useEffect(() => {
    if (holding && !opened.has(holding)) setOpened((was) => new Set([...was, holding]));
  }, [view]);

  return (
    <>
      {sections.map((s, n) => {
        const open = opened.has(s.id);
        // Folded, it still says when something in it wants doing.
        const waiting = !open && s.items.some((i) => i.number || i.dot === 'alert');
        const running = !open && s.items.some((i) => i.dot === 'on');
        return (
          <div key={s.id} className={n ? 'pt-3' : ''} data-nav-section={s.id}>
            <button
              type="button"
              onClick={() => setOpened((was) => { const next = new Set(was); if (open) next.delete(s.id); else next.add(s.id); return next; })}
              aria-expanded={open}
              className="w-full flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
              data-nav-section-toggle={s.id}
            >
              <span className="flex-1 text-left opacity-70">{s.label}</span>
              {waiting && <Dot kind="alert" />}
              {!waiting && running && <Dot kind="on" />}
              <ChevronDown size={12} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
            </button>
            {open && (
              <div className="space-y-0.5 mt-1">
                {s.items.map((item) => <NavButton key={item.view} item={item} active={isOn(item, view)} onClick={() => go(item.view)} />)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export interface StatusMark { id: string; name: string; icon: React.ReactNode; ok: boolean }

/** The platforms as one row of marks, lit when connected; pressed, it opens Connections. */
export const StatusRow = ({ marks, onOpen, label, light = false }: { marks: StatusMark[]; onOpen: () => void; label: string; light?: boolean }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`w-full flex items-center justify-between gap-1 px-3 py-2.5 rounded-xl border transition-colors ${light ? 'bg-zinc-100 border-zinc-200 hover:border-zinc-300' : 'bg-black/20 border-white/5 hover:border-white/10'}`}
    title={`${label}\n${marks.map((m) => `${m.name}: ${m.ok ? 'OK' : 'OFF'}`).join('\n')}`}
    aria-label={`${label}: ${marks.map((m) => `${m.name} ${m.ok ? 'OK' : 'OFF'}`).join(', ')}`}
    data-nav-status
  >
    {marks.map((m) => (
      <span key={m.id} className={`relative grid place-items-center w-6 h-6 ${m.ok ? (light ? 'text-zinc-800' : 'text-zinc-200') : (light ? 'text-zinc-400' : 'text-zinc-600')}`} data-status={m.id} data-ok={m.ok ? 'yes' : 'no'}>
        {m.icon}
        <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${m.ok ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
      </span>
    ))}
  </button>
);

/** Words compared without case or accents: "relojes" finds "Relojes", "camara" finds "En cámara". */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** `onChoose` is for an entry that is more than its screen: a guide, opened on the Guides screen. */
export interface SearchEntry { view: AppView; label: string; section: string; icon: React.ReactNode; keywords?: string; onChoose?: () => void }

/** Go to any screen by its name: Ctrl+K (⌘K), type, Enter. */
export const NavSearch = ({ entries, go, onClose, t }: { entries: SearchEntry[]; go: (view: AppView) => void; onClose: () => void; t: any }) => {
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const list = useRef<HTMLDivElement | null>(null);
  const found = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    if (!words.length) return entries;
    // Each word typed is the start of a word there: "count" finds "Countdown" and "Viewer count", not "accounts".
    const starts = (text: string, w: string) => text.split(/[^a-z0-9]+/).some((part) => part.startsWith(w));
    return entries
      .map((e) => ({ e, label: plain(e.label), all: plain(`${e.label} ${e.section} ${e.keywords || ''}`) }))
      .filter(({ all }) => words.every((w) => starts(all, w)))
      // A name that starts with what was typed first, then a name with a word that does, then the rest.
      .sort((a, b) => Number(!a.label.startsWith(words[0])) - Number(!b.label.startsWith(words[0]))
        || Number(!starts(a.label, words[0])) - Number(!starts(b.label, words[0])))
      .map(({ e }) => e);
  }, [query, entries]);
  useEffect(() => { setAt(0); }, [query]);
  useEffect(() => { list.current?.querySelector(`[data-search-at="${at}"]`)?.scrollIntoView({ block: 'nearest' }); }, [at]);
  const choose = (e?: SearchEntry) => { if (e) { if (e.onChoose) e.onChoose(); else go(e.view); onClose(); } };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4" onMouseDown={onClose} data-nav-search>
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAt((a) => Math.min(found.length - 1, a + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((a) => Math.max(0, a - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); choose(found[at]); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder={t.navSearchPlaceholder || 'Go to a screen — type its name'}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            data-nav-search-input
          />
          <kbd className="text-[10px] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={list} className="max-h-[50vh] overflow-y-auto py-1">
          {found.length === 0 && <p className="px-4 py-6 text-center text-xs text-zinc-500">{t.navSearchNone || 'No screen called that.'}</p>}
          {found.map((e, i) => (
            <button
              key={`${e.view}-${e.label}`}
              type="button"
              onMouseMove={() => setAt(i)}
              onClick={() => choose(e)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === at ? 'bg-current-accent/10 text-white' : 'text-zinc-300'}`}
              data-search-at={i}
              data-search-view={e.view}
            >
              <span className={i === at ? 'text-current-accent' : 'text-zinc-500'}>{e.icon}</span>
              <span className="flex-1 text-sm font-semibold truncate">{e.label}</span>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">{e.section}</span>
              {i === at && <CornerDownLeft size={12} className="text-zinc-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/** The search, as a box at the top of the menu: pressing it opens the search. */
export const SearchButton = ({ onOpen, t, light = false }: { onOpen: () => void; t: any; light?: boolean }) => {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return (
    <button type="button" onClick={onOpen} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${light ? 'border-zinc-200 bg-zinc-100 text-zinc-500 hover:text-zinc-800' : 'border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'}`} data-nav-search-open>
      <Search size={14} />
      <span className="flex-1 text-left">{t.navSearch || 'Search screens'}</span>
      <kbd className="hidden md:inline text-[10px] border border-zinc-800 rounded px-1.5 py-0.5">{mac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
};

/** Two screens that are one thing, as tabs at the top of each. */
export const ScreenTabs = ({ tabs, view, go }: { tabs: { view: AppView; label: string }[]; view: AppView; go: (view: AppView) => void }) => (
  <div className="flex items-center gap-1 mb-6 p-1 rounded-xl border border-zinc-800 bg-zinc-950/60 w-fit" role="tablist" data-screen-tabs>
    {tabs.map((tab) => (
      <button
        key={tab.view}
        type="button"
        role="tab"
        aria-selected={tab.view === view}
        onClick={() => go(tab.view)}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab.view === view ? 'bg-current-accent text-white' : 'text-zinc-400 hover:text-white'}`}
        data-screen-tab={tab.view}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

/** A phone's bar along the bottom: the screens used mid-stream, and the whole menu. */
export const PhoneBar = ({ items, view, go, onMenu, t }: { items: NavItem[]; view: AppView; go: (view: AppView) => void; onMenu: () => void; t: any }) => (
  <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" data-phone-bar>
    <div className="grid grid-cols-5">
      {items.map((item) => {
        const on = isOn(item, view);
        return (
          <button key={item.view} type="button" onClick={() => go(item.view)} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${on ? 'text-current-accent' : 'text-zinc-500'}`} data-phone-bar-item={item.view}>
            {item.icon}
            <span className="truncate max-w-full px-1">{item.label}</span>
            {item.number ? <span className="absolute top-1 right-[calc(50%-1.4rem)] min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-current-accent text-white text-[9px] leading-[1.1rem] text-center">{item.number}</span> : null}
          </button>
        );
      })}
      <button type="button" onClick={onMenu} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold text-zinc-500" data-phone-bar-item="more">
        <MenuIcon size={18} />
        <span>{t.navMore || 'More'}</span>
      </button>
    </div>
  </nav>
);
