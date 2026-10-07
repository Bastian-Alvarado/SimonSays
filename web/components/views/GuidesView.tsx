/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Guides: where a streamer new to the app starts, and comes back to.
 *
 *   - Start here: the setup steps, ticking themselves from what the app can
 *     see, each step with why and a way there.
 *   - Guides: one per task, as steps that each go to their screen.
 *   - Reference: what works in chat now, the variables, the pages for OBS —
 *     read from the app as it is set up, not written down beside it.
 *   - Glossary: the app's own words.
 *
 * The words are in shared/guides.js; this draws them.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Check, Circle, ChevronDown, ChevronRight, ArrowRight, Copy, Search, ListChecks, BookMarked, Braces,
  Plug, Monitor, Layers, MonitorPlay, Bell, Terminal, LayoutGrid, Palette, Cast, MessageSquare, Trophy, Smartphone, Save, Copy as CopyIcon,
  KeyRound, Lock, AlertTriangle, ExternalLink, Clock,
} from 'lucide-react';
import type { AppView } from '../../types';
import { GUIDES, GUIDE_GROUPS, GLOSSARY, BUILTIN_WORDS, GUIDE_TOKEN, PLATFORM_SETUPS, guideTexts } from '../../../shared/guides.js';
import { VARIABLE_GROUPS } from '../VariablePicker';
import { copyText } from '../../utils';
import { fill } from '../../words';

export type GuidesTab = 'start' | 'guides' | 'reference' | 'glossary';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  plug: Plug, monitor: Monitor, layers: Layers, 'monitor-play': MonitorPlay, bell: Bell, terminal: Terminal,
  grid: LayoutGrid, palette: Palette, copy: CopyIcon, cast: Cast, discord: MessageSquare, trophy: Trophy, phone: Smartphone, save: Save,
};

/** The address of a page for OBS: this page's own, with its mode. */
export const pageUrl = (mode: string) => `${window.location.origin}${window.location.pathname}?mode=${mode}`;

/**
 * Where to sign in to the platforms, and the addresses each one comes back
 * to. Twitch and Google take a plain http:// address only for the computer
 * itself, and Spotify only as 127.0.0.1 — so the addresses are written for
 * the app opened at localhost, on the computer it runs on, whatever address
 * this page was opened at. The same ones the Connections screen sends from
 * there (utils spotifyRedirectUri: localhost becomes 127.0.0.1).
 */
export const signInPlaces = () => {
  const here = `${window.location.origin}${window.location.pathname}`;
  const page = new URL(here);
  const onLocalhost = page.hostname === 'localhost';
  page.hostname = 'localhost';
  const loopback = new URL(page.toString());
  loopback.hostname = '127.0.0.1';
  return { here, onLocalhost, signInAt: page.toString(), redirects: { page: page.toString(), loopback: loopback.toString() } as Record<string, string> };
};

/** Words compared without case or accents, as the menu's search does. */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CopyChip = ({ text, t }: { text: string; t: any }) => {
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 align-middle max-w-full">
      <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-current-accent break-all select-all" data-guide-url>{text}</code>
      <button
        type="button"
        onClick={() => { if (copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1400); } }}
        title={t.guidesCopy || 'Copy'}
        className="shrink-0 p-1 rounded text-zinc-500 hover:text-white"
      >
        {done ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      </button>
    </span>
  );
};

/**
 * A guide's text with its tokens drawn: a screen as a link to it, a button by
 * its own word, a page for OBS or a sign-in's address as an address to copy.
 * Other braces are left to be read.
 */
export const GuideText = ({ text, t, screens, go }: { text: string; t: any; screens: Record<string, string>; go: (v: AppView) => void }) => {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(GUIDE_TOKEN)) {
    const [whole, kind, name] = m;
    const i = m.index ?? 0;
    if (i > at) parts.push(text.slice(at, i));
    if (kind === 'screen') {
      parts.push(
        <button key={i} type="button" onClick={() => go(name as AppView)} className="font-bold text-current-accent hover:underline" data-guide-screen={name}>
          {screens[name] || name}
        </button>,
      );
    } else if (kind === 't') {
      parts.push(<strong key={i} className="font-bold text-zinc-100">{t[name] || name}</strong>);
    } else if (kind === 'redirect') {
      parts.push(<CopyChip key={i} text={signInPlaces().redirects[name] || name} t={t} />);
    } else {
      parts.push(<CopyChip key={i} text={pageUrl(name)} t={t} />);
    }
    at = i + whole.length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
};

interface GuidesViewProps {
  t: any;
  system: any;
  go: (view: AppView) => void;
  /** Each screen's name in the menu. */
  screens: Record<string, string>;
  /** The setup steps as App works them out (it also counts them for the menu). */
  progress: { items: { check: any; done: boolean }[]; left: number; needed: number };
  /** Ticks for what the app cannot see, by hand. */
  ticked: string[];
  setTicked: (id: string, done: boolean) => void;
  tab: GuidesTab;
  setTab: (tab: GuidesTab) => void;
  /** The guide open now, if any: a screen's "?" and the search open one. */
  openGuide: string | null;
  setOpenGuide: (id: string | null) => void;
}

export const GuidesView: React.FC<GuidesViewProps> = ({ t, system, go, screens, progress, ticked, setTicked, tab, setTab, openGuide, setOpenGuide }) => {
  const lang: 'en' | 'es' = t?.lang === 'es' ? 'es' : 'en';
  const [query, setQuery] = useState('');
  const words = (plain(query).match(/\S+/g) || []) as string[];
  const matches = (...texts: (string | undefined)[]) => {
    if (!words.length) return true;
    const all = plain(texts.filter(Boolean).join(' '));
    return words.every((w) => all.includes(w));
  };

  /*
    An opened guide is scrolled to, from the search or a screen's "?". A frame
    later: coming from another screen, the App puts the page back at its top
    after this has run, which would undo it.
  */
  const opened = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (tab !== 'guides' || !openGuide) return;
    const frame = requestAnimationFrame(() => opened.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [openGuide, tab]);

  const done = progress.needed - progress.left;
  const tabs: { id: GuidesTab; label: string; icon: any; number?: number }[] = [
    { id: 'start', label: t.guidesTabStart || 'Start here', icon: ListChecks, number: progress.left || undefined },
    { id: 'guides', label: t.guidesTabGuides || 'Guides', icon: BookOpen },
    { id: 'reference', label: t.guidesTabReference || 'Reference', icon: Braces },
    { id: 'glossary', label: t.guidesTabGlossary || 'Glossary', icon: BookMarked },
  ];

  const text = (s: string) => <GuideText text={s} t={t} screens={screens} go={go} />;
  const goButton = (view: AppView) => (
    <button type="button" onClick={() => go(view)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white hover:border-zinc-600" data-guide-go={view}>
      {fill(t.guidesGo || 'Go to {screen}', { screen: screens[view] || view })} <ArrowRight size={11} />
    </button>
  );

  // ----------------------------------------------------------- connecting each platform
  /*
    Each platform, click by click, for somebody who has never made a
    developer app: what goes in the app and where each piece is found, the
    steps on the platform's own site with the address to register ready to
    copy, how to know it worked, and what each common error means. Where to
    sign in is said first, since a sign-in from the wrong address fails only
    at the very end.
  */
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);
  const platformAt = useRef<HTMLDivElement | null>(null);
  const [platformAsked, setPlatformAsked] = useState(0);
  // "Show me how" on a setup step: that platform opened, and scrolled to.
  const showPlatform = (id: string) => { setOpenPlatform(id); setPlatformAsked((n) => n + 1); };
  useEffect(() => {
    if (!platformAsked) return;
    const frame = requestAnimationFrame(() => platformAt.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [platformAsked]);
  const places = signInPlaces();
  const stateWords: Record<string, string> = {
    on: t.guidesPlatformOn || 'Connected',
    waiting: t.guidesPlatformWaiting || 'Set up — waiting for your LIVE',
    off: t.guidesPlatformOff || 'Not connected',
  };
  const platformsCard = (
    <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3" data-guides-platforms>
      <div className="space-y-1">
        <div className="flex items-center gap-2"><Plug size={14} className="text-current-accent" /><span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.guidesPlatformsTitle || 'Connect your platforms'}</span></div>
        <p className="text-[12px] text-zinc-400 leading-relaxed">{t.guidesPlatformsIntro || 'Twitch, YouTube, Discord and Spotify each want you to make a free “app” on their developer site before this app may sign in. It sounds technical, but it is a form: a name, an address copied from here, and a code or two to paste back. Open a platform for its steps.'}</p>
      </div>
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 flex gap-2" data-guides-secrets>
        <KeyRound size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-100/80 leading-relaxed">{t.guidesSecretsNote || 'Client secrets, bot tokens and passwords are like your account password. The app keeps them on the server and never shows them again. Never show Connections or a developer site on stream; if one leaks, press Reset on that site and paste the new one in.'}</p>
      </div>
      {places.onLocalhost ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex gap-2" data-guides-sign-in="here">
          <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-300 leading-relaxed">{t.guidesSignInHere || 'Sign in from here: you opened the app on the computer it runs on, which is what Twitch, Google and Spotify want.'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 flex gap-2" data-guides-sign-in="elsewhere">
          <AlertTriangle size={14} className="text-sky-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            {fill(t.guidesSignInElsewhere || 'You opened the app at {here}. Twitch, Google and Spotify only accept a plain http:// address on the computer itself, so do the signing in on the computer the app runs on, with the app opened at {there}. The addresses below are already written for that, and once you are signed in every device uses it.', { here: places.here, there: places.signInAt })}
          </p>
        </div>
      )}
      <div className="space-y-2">
        {PLATFORM_SETUPS.map((p: any) => {
          const w = p[lang];
          const open = openPlatform === p.id;
          let state = 'off';
          try { state = p.state({ status: system?.status, data: system?.data }); } catch { state = 'off'; }
          const site = p.portal ? new URL(p.portal).hostname.replace(/^www\./, '') : '';
          return (
            <div key={p.id} ref={open ? platformAt : undefined} className={`rounded-2xl border scroll-mt-20 md:scroll-mt-6 ${open ? 'border-zinc-600 bg-zinc-950/70' : 'border-zinc-800 bg-zinc-950/40'}`} data-guide-platform={p.id} data-state={state} data-open={open ? 'yes' : 'no'}>
              <button type="button" onClick={() => setOpenPlatform(open ? null : p.id)} className="w-full flex items-center gap-3 p-3.5 text-left" data-guide-platform-toggle={p.id}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-zinc-100">{w.name}</span>
                    {p.optional && <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.guidesOptional || 'Optional'}</span>}
                  </span>
                  {!open && <span className="block text-[11px] text-zinc-500 truncate">{w.for}</span>}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-zinc-600 shrink-0"><Clock size={11} />{fill(t.guidesPlatformMinutes || 'about {count} min', { count: String(p.minutes) })}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${state === 'on' ? 'bg-emerald-500/10 text-emerald-400' : state === 'waiting' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-900 text-zinc-500'}`} data-platform-state={state}>{stateWords[state]}</span>
                {open ? <ChevronDown size={16} className="text-zinc-500 shrink-0" /> : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-[12px] text-zinc-400 leading-relaxed">{w.for}</p>
                  <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-3 space-y-2" data-platform-fields>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.guidesPlatformFields || 'What goes in the app'}</h4>
                    {p.fields.length === 0 ? (
                      <p className="text-[11px] text-zinc-400">{t.guidesPlatformNothingNew || 'Nothing new to paste: it uses the Client ID already put in for Twitch.'}</p>
                    ) : p.fields.map((f: any) => (
                      <div key={f.t} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" data-platform-field={f.t}>
                        <strong className="text-[12px] font-bold text-zinc-100">{t[f.t] || f.t}</strong>
                        {f.secret && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] font-black uppercase tracking-widest text-amber-400"><Lock size={9} />{t.guidesPlatformSecret || 'secret'}</span>}
                        <span className="text-[11px] text-zinc-500 basis-full sm:basis-auto">{f[lang]}</span>
                      </div>
                    ))}
                  </div>
                  {p.localOnly && !places.onLocalhost && (
                    <p className="text-[11px] text-sky-300/90 flex gap-2" data-platform-local-only>
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      {fill(t.guidesPlatformLocalOnly || '{name} only accepts the sign-in from the computer the app runs on: open the app there, at {there}.', { name: w.name, there: places.signInAt })}
                    </p>
                  )}
                  {p.portal && (
                    <a href={p.portal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-[11px] font-bold text-zinc-200 hover:border-zinc-500 hover:text-white" data-platform-portal={p.id}>
                      {fill(t.guidesPlatformOpenSite || 'Open {site}', { site })} <ExternalLink size={11} />
                    </a>
                  )}
                  <ol className="space-y-2">
                    {p.steps.map((s: any, n: number) => (
                      <li key={n} className="flex gap-3 rounded-xl border border-zinc-800/70 bg-black/20 p-3" data-platform-step={n + 1}>
                        <span className="shrink-0 w-6 h-6 rounded-full bg-zinc-900 grid place-items-center text-[11px] font-black text-zinc-400">{n + 1}</span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-[12px] text-zinc-300 leading-relaxed">{text(s[lang])}</p>
                          {s.go && goButton(s.go)}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex gap-2" data-platform-worked>
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-zinc-300 leading-relaxed"><span className="font-bold text-emerald-300">{t.guidesWorked || 'How to know it worked'}: </span>{text(w.worked)}</p>
                  </div>
                  {p.problems.length > 0 && (
                    <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-3 space-y-2" data-platform-problems>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.guidesPlatformProblems || 'If it goes wrong'}</h4>
                      {p.problems.map((x: any, n: number) => (
                        <p key={n} className="text-[11px] text-zinc-400 leading-relaxed flex gap-2"><AlertTriangle size={12} className="text-amber-500/70 shrink-0 mt-0.5" /><span>{text(x[lang])}</span></p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ----------------------------------------------------------- the setup steps
  const startTab = (
    <div className="space-y-4" data-guides-start>
      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.guidesChecklist || 'Setting up'}</span>
          <span className="ml-auto text-[11px] font-bold text-zinc-400" data-guides-progress={`${done}/${progress.needed}`}>
            {fill(t.guidesProgress || '{done} of {needed} done', { done: String(done), needed: String(progress.needed) })}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
          <div className="h-full bg-current-accent transition-all" style={{ width: `${progress.needed ? (done / progress.needed) * 100 : 100}%` }} />
        </div>
        {progress.left === 0 && <p className="text-[11px] text-emerald-400" data-guides-all-done>{t.guidesAllDone || 'All set: everything you need is done. The rest is up to you.'}</p>}
      </div>
      {platformsCard}
      <div className="space-y-2">
        {progress.items.map(({ check, done: ok }) => {
          const w = check[lang];
          const guide = check.guide ? GUIDES.find((g) => g.id === check.guide) : null;
          return (
            <div key={check.id} className={`rounded-2xl border p-4 flex gap-3 ${ok ? 'border-zinc-800/60 bg-zinc-950/30' : 'border-zinc-800 bg-zinc-950/60'}`} data-guide-check={check.id} data-done={ok ? 'yes' : 'no'}>
              <span className="mt-0.5 shrink-0">{ok ? <Check size={16} className="text-emerald-400" /> : <Circle size={16} className="text-zinc-600" />}</span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-bold ${ok ? 'text-zinc-400' : 'text-zinc-100'}`}>{w.title}</span>
                  {check.optional && <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.guidesOptional || 'Optional'}</span>}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{w.why}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {check.go && goButton(check.go)}
                  {/* A step about a platform opens its walkthrough above; the others, their guide. */}
                  {check.setup ? (
                    <button type="button" onClick={() => showPlatform(check.setup)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-white" data-guide-show-platform={check.setup}>
                      <BookOpen size={11} /> {t.guidesShowMe || 'Show me how'}
                    </button>
                  ) : guide && (
                    <button type="button" onClick={() => { setOpenGuide(guide.id); setTab('guides'); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-white" data-guide-open={guide.id}>
                      <BookOpen size={11} /> {t.guidesShowMe || 'Show me how'}
                    </button>
                  )}
                  {check.manual && (
                    <button type="button" onClick={() => setTicked(check.id, !ticked.includes(check.id))} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-white" data-guide-tick={check.id}>
                      {ticked.includes(check.id) ? (t.guidesMarkUndone || 'Not done yet') : (t.guidesMarkDone || 'Mark as done')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ----------------------------------------------------------- the guides
  const shown = GUIDES.filter((g) => matches(...guideTexts(g, lang).map((s) => s.replace(GUIDE_TOKEN, (_m: string, kind: string, name: string) => (kind === 'screen' ? screens[name] || '' : kind === 't' ? t[name] || '' : '')))));
  const guidesTab = (
    <div className="space-y-6" data-guides-list>
      {shown.length === 0 && <p className="text-xs text-zinc-500 text-center py-8">{t.guidesNothing || 'Nothing here matches that.'}</p>}
      {GUIDE_GROUPS.map((group) => {
        const inGroup = shown.filter((g) => g.group === group.id);
        if (!inGroup.length) return null;
        return (
          <div key={group.id} className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">{group[lang]}</h3>
            {inGroup.map((g) => {
              const w = g[lang];
              const Icon = ICONS[g.icon] || BookOpen;
              const open = openGuide === g.id;
              return (
                <div key={g.id} ref={open ? opened : undefined} className={`rounded-2xl border scroll-mt-20 md:scroll-mt-6 ${open ? 'border-current-accent/50 bg-zinc-950/70' : 'border-zinc-800 bg-zinc-950/40'}`} data-guide={g.id} data-open={open ? 'yes' : 'no'}>
                  <button type="button" onClick={() => setOpenGuide(open ? null : g.id)} className="w-full flex items-center gap-3 p-4 text-left" data-guide-toggle={g.id}>
                    <span className={`p-2 rounded-xl shrink-0 ${open ? 'bg-current-accent/15 text-current-accent' : 'bg-zinc-900 text-zinc-400'}`}><Icon size={16} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-zinc-100">{w.title}</span>
                      {!open && <span className="block text-[11px] text-zinc-500 truncate">{w.intro}</span>}
                    </span>
                    <span className="shrink-0 text-[10px] text-zinc-600 hidden sm:inline">{fill(t.guidesStepsCount || '{count} steps', { count: String(g.steps.length) })}</span>
                    {open ? <ChevronDown size={16} className="text-zinc-500 shrink-0" /> : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
                  </button>
                  {open && (
                    <div className="px-4 pb-4 space-y-3">
                      <p className="text-[12px] text-zinc-400 leading-relaxed">{text(w.intro)}</p>
                      <ol className="space-y-2">
                        {g.steps.map((s: any, n: number) => (
                          <li key={n} className="flex gap-3 rounded-xl border border-zinc-800/70 bg-black/20 p-3" data-guide-step={n + 1}>
                            <span className="shrink-0 w-6 h-6 rounded-full bg-zinc-900 grid place-items-center text-[11px] font-black text-zinc-400">{n + 1}</span>
                            <div className="flex-1 min-w-0 space-y-2">
                              <p className="text-[12px] text-zinc-300 leading-relaxed">{text(s[lang])}</p>
                              {s.go && goButton(s.go)}
                            </div>
                          </li>
                        ))}
                      </ol>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex gap-2" data-guide-worked>
                        <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-zinc-300 leading-relaxed">
                          <span className="font-bold text-emerald-300">{t.guidesWorked || 'How to know it worked'}: </span>{text(w.worked)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  // ----------------------------------------------------------- the reference
  const data = system?.data || {};
  const builtIn = BUILTIN_WORDS
    .map((b: any) => ({ b, now: (() => { try { return b.read(data); } catch { return null; } })() }))
    .filter(({ now }: any) => now && now.word);
  const who = (anyone: boolean) => (anyone ? (t.permAnyone || 'Anyone') : (t.permMods || 'Mods'));
  const commandWho = (c: any) => {
    const p = c.permissions || {};
    if (p.anyone) return t.permAnyone || 'Anyone';
    const list = [p.broadcaster && (t.permOwner || 'Owner'), p.moderators && (t.permMods || 'Mods'), p.vips && (t.permVips || 'VIPs'), p.subscribers && (t.permSubs || 'Subs')].filter(Boolean);
    return list.length ? list.join(', ') : (t.permOwner || 'Owner');
  };
  const commands: any[] = (Array.isArray(data.commands) ? data.commands : [])
    .filter((c: any) => matches(c.name, ...(c.triggers || [])))
    .sort((a: any, b: any) => String(a.triggers?.[0] || '').localeCompare(String(b.triggers?.[0] || '')));
  const surfaces = data.surfaces || {};
  const pages = [
    { mode: 'canvas', words: t.guidesRefPageCanvas || 'The stream: every layer of your layouts', inObs: surfaces.canvasInObs },
    { mode: 'dock', words: t.guidesRefPageDock || 'Chat dock: every chat, and your buttons', inObs: surfaces.dockInObs },
    { mode: 'alerts', words: t.guidesRefPageAlerts || 'Alerts only', inObs: surfaces.alertsInObs },
  ];
  const [copiedVar, setCopiedVar] = useState('');
  const variableGroups = VARIABLE_GROUPS
    .map((g) => ({ ...g, vars: g.vars.filter((v) => matches(v.token, v[lang])) }))
    .filter((g) => g.vars.length);
  const shownBuiltIn = builtIn.filter(({ b, now }: any) => matches(now.word, b[lang].does, b[lang].after));
  const card = 'glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3';
  const heading = (icon: React.ReactNode, words: string, hint?: string) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2">{icon}<span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{words}</span></div>
      {hint && <p className="text-[11px] text-zinc-500 leading-relaxed">{hint}</p>}
    </div>
  );
  const referenceTab = (
    <div className="space-y-4" data-guides-reference>
      <div className={card} data-guides-words>
        {heading(<Terminal size={14} className="text-current-accent" />, t.guidesRefWords || 'Chat words', t.guidesRefWordsHint || 'What works in your chat right now: the words built in, then your own commands.')}
        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pt-1">{t.guidesRefBuiltIn || 'Built in'}</h4>
        <div className="space-y-1">
          {shownBuiltIn.map(({ b, now }: any) => (
            <div key={b.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 ${now.on ? '' : 'opacity-50'}`} data-builtin-word={b.id} data-on={now.on ? 'yes' : 'no'}>
              <code className="text-[12px] font-mono font-bold text-current-accent">{now.word}{b[lang].after ? <span className="text-zinc-500 font-normal"> {b[lang].after}</span> : null}</code>
              <span className="text-[11px] text-zinc-400 flex-1 min-w-[10rem]">{b[lang].does}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{now.on ? who(b.who === 'anyone') : (t.guidesRefOff || 'off')}</span>
              <button type="button" onClick={() => go(b.go)} className="text-[10px] font-bold text-zinc-500 hover:text-white" data-guide-go={b.go}>{screens[b.go] || b.go} →</button>
            </div>
          ))}
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pt-2">{t.guidesRefYours || 'Your commands'}</h4>
        {commands.length === 0 ? (
          <p className="text-[11px] text-zinc-600">{t.guidesRefNoCommands || 'No commands of your own yet.'}</p>
        ) : (
          <div className="space-y-1">
            {commands.map((c: any) => (
              <div key={c.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 ${c.enabled ? '' : 'opacity-50'}`} data-own-command={c.id}>
                <code className="text-[12px] font-mono font-bold text-current-accent">{(c.triggers || []).join('  ')}</code>
                <span className="text-[11px] text-zinc-400 flex-1 min-w-[10rem] truncate">{c.name}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{c.enabled ? commandWho(c) : (t.guidesRefOff || 'off')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={card} data-guides-pages>
        {heading(<Monitor size={14} className="text-current-accent" />, t.guidesRefPages || 'Pages for OBS', t.guidesRefPagesHint || 'Browser sources and docks in OBS. The guide “Put the app in OBS” says where each goes.')}
        <div className="space-y-2">
          {pages.map((p) => (
            <div key={p.mode} className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 space-y-1" data-guide-page={p.mode}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-300 flex-1">{p.words}</span>
                {Number(p.inObs) > 0 && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">{fill(t.guidesRefOpenNow || '{count} open in OBS now', { count: String(p.inObs) })}</span>}
              </div>
              <CopyChip text={pageUrl(p.mode)} t={t} />
            </div>
          ))}
        </div>
      </div>
      <div className={card} data-guides-variables>
        {heading(<Braces size={14} className="text-current-accent" />, t.variables || 'Variables', t.guidesRefVariablesHint || 'What you can put in braces in any text an action sends. Press one to copy it.')}
        {variableGroups.map((g) => (
          <div key={g.id} className="space-y-1">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pt-1">{g[lang]}</h4>
            {(lang === 'es' ? g.noteEs : g.noteEn) && <p className="text-[10px] text-zinc-600">{lang === 'es' ? g.noteEs : g.noteEn}</p>}
            {g.vars.map((v) => (
              <button
                key={g.id + v.token}
                type="button"
                onClick={() => { if (copyText(`{${v.token}}`)) { setCopiedVar(g.id + v.token); setTimeout(() => setCopiedVar((c) => (c === g.id + v.token ? '' : c)), 1200); } }}
                className="w-full text-left flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 hover:border-current-accent/50 px-3 py-1.5"
                data-guide-variable={v.token}
              >
                <code className="text-[11px] font-mono font-bold text-current-accent shrink-0">{`{${v.token}}`}</code>
                <span className="text-[10px] text-zinc-500 flex-1 min-w-0 truncate">{v[lang]}</span>
                {copiedVar === g.id + v.token ? <Check size={12} className="text-emerald-400 shrink-0" /> : <Copy size={12} className="text-zinc-700 shrink-0" />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  // ----------------------------------------------------------- the glossary
  const terms = GLOSSARY.filter((g: any) => matches(g[lang].term, g[lang].means));
  const glossaryTab = (
    <div className={card} data-guides-glossary>
      {heading(<BookMarked size={14} className="text-current-accent" />, t.guidesTabGlossary || 'Glossary', t.guidesGlossaryHint || 'The app’s own words, and where each is used.')}
      {terms.length === 0 && <p className="text-xs text-zinc-500 text-center py-6">{t.guidesNothing || 'Nothing here matches that.'}</p>}
      <dl className="divide-y divide-zinc-800/60">
        {terms.map((g: any) => (
          <div key={g.id} className="py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1" data-glossary={g.id}>
            <dt className="text-sm font-bold text-zinc-100 w-44 shrink-0">{g[lang].term}</dt>
            <dd className="text-[12px] text-zinc-400 flex-1 min-w-[12rem] leading-relaxed">{g[lang].means}</dd>
            {g.go && <button type="button" onClick={() => go(g.go)} className="text-[10px] font-bold text-zinc-500 hover:text-white" data-guide-go={g.go}>{screens[g.go] || g.go} →</button>}
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-5 pb-24" data-guides-view>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-current-accent" />
          <h1 className="text-2xl font-black tracking-tight text-zinc-100">{t.guidesTitle || 'Guides'}</h1>
        </div>
        <p className="text-[12px] text-zinc-500 max-w-2xl leading-relaxed">{t.guidesIntro || 'Start here, or come back when you want to do something new. Every button takes you to the screen it talks about.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl border border-zinc-800 bg-zinc-950/60 max-w-full" role="tablist">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${tab === x.id ? 'bg-current-accent text-white' : 'text-zinc-400 hover:text-white'}`}
              data-guides-tab={x.id}
            >
              <x.icon size={13} /> {x.label}
              {x.number ? <span className={`ml-0.5 px-1.5 rounded text-[10px] font-black ${tab === x.id ? 'bg-white/20' : 'bg-zinc-800 text-zinc-300'}`}>{x.number}</span> : null}
            </button>
          ))}
        </div>
        {tab !== 'start' && (
          <div className="relative flex-1 min-w-[12rem] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.guidesSearch || 'Search the guides, words and commands'}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-current-accent"
              data-guides-search
            />
          </div>
        )}
      </div>
      {tab === 'start' && startTab}
      {tab === 'guides' && guidesTab}
      {tab === 'reference' && referenceTab}
      {tab === 'glossary' && glossaryTab}
    </div>
  );
};
