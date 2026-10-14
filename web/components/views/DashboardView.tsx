
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The home screen (2.1.0): what the app opens on, for whoever opened it.
 *
 *   Somebody still setting up   a welcome card: the setup steps still needed
 *                               (shared/guides.js SETUP_CHECKS), each with a
 *                               way to where it is done.
 *   The streamer                a greeting; while live, the stream's numbers;
 *                               offline, the next stream and getting ready;
 *                               "needs you" — only what does; the latest
 *                               events; what is on screen, and buttons for
 *                               the layouts they picked.
 *   A moderator                 the same numbers and buttons, their own deck,
 *                               the chat's modes and what AutoMod holds — and
 *                               none of the streamer's setup.
 *
 * Every number here is one the app already keeps; nothing is asked of a
 * platform just to draw this screen.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AppView, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { Check, Circle, Radio, ShieldCheck, Pencil, X, ArrowRight, User } from 'lucide-react';
import { fill } from '../../words';
import { describeEvent } from '../EventFeed';
import { DockActionsGrid } from '../DockActionsGrid';
import { ChatModes, AutomodQueue } from '../ModTools';
import { liveLayout } from '../../../shared/live-layout.js';

interface SetupItem { check: { id: string; go?: string; guide?: string; optional?: boolean; en: { title: string; why: string }; es: { title: string; why: string } }; done: boolean }

interface DashboardViewProps {
  activeTheme: ThemeConfig;
  t: any;
  setView: (view: AppView) => void;
  spotify: any;
  /** The setup steps, once the server has said enough to work them out (shared/guides.js setupState). */
  setup?: { left: number; needed: number; items: SetupItem[] } | null;
  /** A moderator (2.0.0): the connections and the Guides are the streamer's, so neither is offered. */
  isMod?: boolean;
  /** Everything else: the stream's numbers, the layouts, the deck, who is signed in (hooks/useStreamSystem.ts). */
  system?: any;
  language?: string;
  /** Open a guide where it is, from a setup step. */
  openGuide?: (id: string) => void;
  /** Platforms that were on earlier this visit and are off now (App.tsx). */
  dropped?: string[];
  /** A newer version out, if any (App.tsx). */
  updateOut?: string;
}

/** "1 h 24 min", from a moment to now. */
function since(at: number, now: number, t: any) {
  const mins = Math.max(0, Math.floor((now - at) / 60_000));
  const h = Math.floor(mins / 60);
  return h ? fill(t.homeHoursMinutes || '{h} h {m} min', { h, m: mins % 60 }) : fill(t.homeMinutes || '{m} min', { m: mins });
}
/** "2 min ago" and on, in the screen's language. */
function ago(at: number, now: number, language: string) {
  // An event or a stream with no time to it says nothing, rather than taking the screen down with it.
  if (!Number.isFinite(Number(at)) || !Number(at)) return '';
  const s = Math.round((Number(at) - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(language === 'es' ? 'es' : 'en', { numeric: 'auto', style: 'short' });
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
/** Whether this page was opened at an address outside the home network: a public name, or https. */
const fromOutside = () => {
  const h = window.location.hostname;
  if (window.location.protocol === 'https:') return true;
  return !(h === 'localhost' || h === '127.0.0.1' || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith('.local'));
};
const nf = (n: any) => (Number(n) || 0).toLocaleString();

const Card = ({ light, className = '', children, ...rest }: { light: boolean; className?: string; children: React.ReactNode; [k: string]: any }) => (
  <div className={`rounded-3xl border p-5 ${light ? 'bg-white border-zinc-200' : 'bg-zinc-900/60 border-zinc-800'} ${className}`} {...rest}>{children}</div>
);
const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{children}</p>
);

/* ------------------------------------------------------------ setting up */

const Welcome = ({ setup, t, language, setView, openGuide, light }: { setup: NonNullable<DashboardViewProps['setup']>; t: any; language: string; setView: (v: AppView) => void; openGuide?: (id: string) => void; light: boolean }) => {
  const needed = setup.items.filter((i) => !i.check.optional);
  const done = needed.filter((i) => i.done).length;
  const firstOpen = needed.find((i) => !i.done)?.check.id;
  return (
    <Card light={light} className="p-6 sm:p-8" data-home="welcome">
      <h1 className={`text-2xl font-black tracking-tight ${light ? 'text-zinc-900' : 'text-white'}`}>{t.homeWelcome || 'Welcome to SimonSays'}</h1>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-2xl">
        {t.homeWelcomeHint || 'Your chat from every platform in one place, your overlays in OBS, and buttons for the stream — all running on this computer. These steps get you to a first stream.'}
      </p>
      <div className="mt-5 h-2 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-current-accent transition-all" style={{ width: `${needed.length ? (done / needed.length) * 100 : 0}%` }} /></div>
      <p className="mt-1.5 text-xs text-zinc-500" data-home-progress>{fill(t.homeStepsDone || '{done} of {all} done', { done, all: needed.length })}</p>
      <ol className="mt-4">
        {needed.map((i, n) => {
          const words = i.check[language === 'es' ? 'es' : 'en'];
          return (
            <li key={i.check.id} className="flex items-center gap-4 py-3.5 border-t border-zinc-800/70" data-home-step={i.check.id} data-done={i.done ? 'yes' : 'no'}>
              <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${i.done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>{i.done ? <Check size={14} /> : n + 1}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${i.done ? 'text-zinc-500 line-through decoration-zinc-600' : light ? 'text-zinc-900' : 'text-white'}`}>{words.title}</p>
                {!i.done && <p className="text-xs text-zinc-500 leading-snug mt-0.5">{words.why}</p>}
              </div>
              {!i.done && (
                <Button size="sm" variant={i.check.id === firstOpen ? 'primary' : 'secondary'}
                  onClick={() => (i.check.go ? setView(i.check.go as AppView) : i.check.guide ? openGuide?.(i.check.guide) : setView('guides'))}>
                  {i.check.go ? (t.homeStepGo || 'Do it') : (t.homeStepHow || 'Show me how')}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={() => setView('guides')} className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white" data-home-guides>
        {t.homeOptionalNext || 'Optional next: alerts, a chat command, sign-in — every step in Guides'} <ArrowRight size={12} />
      </button>
    </Card>
  );
};

/* ------------------------------------------------------------ the layouts */

const LayoutButtons = ({ system, t, light, canPick }: { system: any; t: any; light: boolean; canPick: boolean }) => {
  const layouts: any[] = system?.data?.layouts || [];
  const picked: string[] = system?.data?.homeLayouts || [];
  const [picking, setPicking] = useState(false);
  const [said, setSaid] = useState('');
  const omni = system?.data?.omnilayer;
  // What is on screen, as the rest of the app works it out: Omnilayer's live layout, or the one bound to OBS's scene.
  const live: any = liveLayout(layouts, system?.connections?.obsData?.currentScene || '', omni);
  const liveId = live?.id;
  const shown = picked.map((id) => layouts.find((l) => l.id === id)).filter(Boolean);
  const plan = system?.data?.plan;
  const items = plan?.items || [];
  const at = items.findIndex((i: any) => i.id === plan?.currentId);
  const nextUp = at >= 0 ? items[at + 1] : items.find((i: any) => !i.doneAt);

  const show = async (id: string) => {
    setSaid('');
    try { await system.actions.home({ op: 'show', layoutId: id }); } catch (err: any) { setSaid(String(err?.message || err)); }
  };
  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id].slice(0, 8);
    system.actions.home({ op: 'layouts', ids: next }).catch(() => {});
  };

  return (
    <Card light={light} data-home="on-screen">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[12rem]">
          <Label>{t.homeOnScreen || 'On screen'}</Label>
          <p className={`text-lg font-black ${light ? 'text-zinc-900' : 'text-white'}`} data-home-live-layout>{live?.name || (t.homeNoLayoutLive || 'No layout on screen')}</p>
          {nextUp && <p className="text-xs text-zinc-500 mt-0.5">{fill(t.homeUpNext || 'Up next on the plan: {item}', { item: nextUp.text })}</p>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {shown.map((l: any) => (
            <Button key={l.id} size="sm" variant={l.id === liveId ? 'primary' : 'secondary'} onClick={() => show(l.id)} data-home-layout={l.id}>{l.name}</Button>
          ))}
          {canPick && (
            <button type="button" onClick={() => setPicking((v) => !v)} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5" title={t.homePickLayouts || 'Pick the layouts shown here'} data-home-pick>
              {picking ? <X size={14} /> : <Pencil size={14} />}
            </button>
          )}
        </div>
      </div>
      {!shown.length && !picking && <p className="mt-3 text-xs text-zinc-500">{t.homePickHint || 'Pick the layouts you switch to most, for a button each here.'}</p>}
      {picking && (
        <div className="mt-4 flex flex-wrap gap-2" data-home-picker>
          {layouts.map((l) => (
            <button key={l.id} type="button" onClick={() => toggle(l.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${picked.includes(l.id) ? 'border-current-accent text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>
              {picked.includes(l.id) ? <Check size={11} className="inline mr-1" /> : null}{l.name}
            </button>
          ))}
        </div>
      )}
      {said && <p className="mt-3 text-xs text-red-400">{said}</p>}
    </Card>
  );
};

/* ------------------------------------------------------------ the home */

export const DashboardView: React.FC<DashboardViewProps> = ({ activeTheme, t, setView, spotify, setup, isMod = false, system, language = 'en', openGuide, dropped = [], updateOut = '' }) => {
  const light = activeTheme.id === 'light';
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  // How many moderators are here now, for the streamer's "needs you" (the Moderators screen's list).
  const me = system?.auth?.me;
  const [modsHere, setModsHere] = useState(0);
  useEffect(() => {
    if (isMod || !me?.signIn || !system?.auth?.moderators) return undefined;
    let gone = false;
    const look = () => system.auth.moderators({ op: 'list' }).then((r: any) => { if (!gone) setModsHere((r?.moderators || []).filter((m: any) => m.online).length); }).catch(() => {});
    look();
    const timer = setInterval(look, 30_000);
    return () => { gone = true; clearInterval(timer); };
  }, [isMod, me?.signIn]);

  const settingUp = !isMod && setup && setup.left > 0;
  const data = system?.data || {};
  const stats = data.stats || {};
  const totals = data.eventTotals || {};
  const stream = data.streamNow;
  /*
    The live view while offline, to set it up — the layout buttons, the deck
    — without going live first. This browser's choice (one person's), and
    only while nothing is on: a stream shows the live view anyway.
  */
  const [preview, setPreview] = useState(() => { try { return localStorage.getItem('home_live_preview') === 'on'; } catch { return false; } });
  const flipPreview = () => setPreview((on) => {
    try { localStorage.setItem('home_live_preview', on ? 'off' : 'on'); } catch { /* a browser may refuse */ }
    return !on;
  });
  const showLive = Boolean(stream) || preview;
  const twitchUser = system?.connections?.twitchUser;
  const channel = twitchUser?.display_name || twitchUser?.login || '';
  const name = (isMod ? (me?.name || me?.login) : (me?.via === 'session' && me?.name) || channel) || '';
  const hour = new Date(now).getHours();
  const hello = isMod
    ? fill(t.homeHelloMod || 'Hi, {name}', { name })
    : fill(hour < 12 ? (t.homeMorning || 'Good morning, {name}') : hour < 19 ? (t.homeAfternoon || 'Good afternoon, {name}') : (t.homeEvening || 'Good evening, {name}'), { name });
  const viewers = { twitch: Number(stats.twitchViewers) || 0, youtube: stats.youtubeLive ? Number(stats.youtubeViewers) || 0 : 0, tiktok: Number(stats.tiktokViewers) || 0 };
  const watching = viewers.twitch + viewers.youtube + viewers.tiktok;
  const next = data.twitchSchedule?.next;

  // What needs the streamer, and only that.
  const needs = useMemo(() => {
    if (isMod) return [];
    const list: { id: string; text: string; go?: AppView; button: string; tone: 'warn' | 'ok' }[] = [];
    const missing = data.twitchScopes?.missing || [];
    if (missing.length) list.push({ id: 'scopes', tone: 'warn', go: 'gallery', button: t.connections || 'Connections', text: fill(t.homeNeedScopes || 'Twitch wants connecting again for {n} new permissions', { n: missing.length }) });
    if (dropped.length) list.push({ id: 'dropped', tone: 'warn', go: 'gallery', button: t.connections || 'Connections', text: fill(t.homeNeedDropped || '{names} dropped since it was on', { names: dropped.join(', ') }) });
    if ((data.automodHeld || []).length) list.push({ id: 'automod', tone: 'warn', go: 'assets', button: t.homeReview || 'Review', text: fill((data.automodHeld || []).length === 1 ? (t.automodOne || 'AutoMod is holding 1 message') : (t.automodMany || 'AutoMod is holding {n} messages'), { n: (data.automodHeld || []).length }) });
    if (updateOut) list.push({ id: 'update', tone: 'ok', go: 'settings', button: t.settings || 'Settings', text: fill(t.homeNeedUpdate || 'Version {version} is out', { version: updateOut }) });
    if (me && !me.signIn && fromOutside()) list.push({ id: 'signin', tone: 'warn', go: 'settings', button: t.settings || 'Settings', text: t.homeNeedSignIn || 'Sign-in is off, and this address reaches the app from outside your home' });
    if (modsHere > 0) list.push({ id: 'mods', tone: 'ok', go: 'moderators', button: t.moderatorsNav || 'Moderators', text: fill(modsHere === 1 ? (t.homeModsOne || '1 moderator here now') : (t.homeModsMany || '{n} moderators here now'), { n: modsHere }) });
    return list;
  }, [isMod, data.twitchScopes, dropped.join(','), data.automodHeld, updateOut, me?.signIn, modsHere, t]);

  const events: any[] = (data.viewerEvents || []).slice(0, 5);

  return (
    <div className="animate-fade-in space-y-4 pb-16 max-w-6xl mx-auto" data-home={settingUp ? 'setting-up' : isMod ? 'moderator' : 'streamer'}>
      {settingUp ? (
        <Welcome setup={setup!} t={t} language={language} setView={setView} openGuide={openGuide} light={light} />
      ) : (
        <>
          {/* who this is, and the stream */}
          <Card light={light} className="flex items-center gap-4" data-home="greeting">
            {!isMod && twitchUser?.profile_image_url
              ? <img src={twitchUser.profile_image_url} alt="" className="w-12 h-12 rounded-2xl shrink-0" />
              : <span className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-xl font-black ${isMod ? 'bg-emerald-500/15 text-emerald-400' : 'bg-current-accent/15 text-current-accent'}`}>{name ? name.slice(0, 1).toUpperCase() : <User size={20} />}</span>}
            <div className="flex-1 min-w-0">
              <h1 className={`text-2xl font-black tracking-tight truncate ${light ? 'text-zinc-900' : 'text-white'}`} data-home-hello>{name ? hello : (t.homeHelloNobody || 'Welcome back')}</h1>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                {isMod && channel ? `${fill(t.homeModeratingFor || 'Moderating for {channel}', { channel })} · ` : ''}
                {stream
                  ? [stream.game, stream.title && `“${stream.title}”`, fill(t.homeLiveFor || 'live for {time}', { time: since(stream.startedAt, now, t) })].filter(Boolean).join(' · ')
                  : next ? fill(t.homeNextStream || 'Next stream {when}', { when: ago(Date.parse(next.start), now, language) }) : (t.homeOffline || 'Offline')}
              </p>
            </div>
            {stream
              ? <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/15 text-rose-400" data-home-live><Radio size={11} /> {t.homeLive || 'Live'}</span>
              : preview
                ? <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-300" data-home-preview><Radio size={11} /> {t.homeLivePreview || 'Live preview'}</span>
                : isMod ? null : <span className="shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-zinc-800 text-zinc-400">{t.homeOffline || 'Offline'}</span>}
            {/* Offline only: the live view, to set it up before a stream. */}
            {!stream && (
              <button type="button" onClick={flipPreview} className="shrink-0 flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white" title={t.homeLiveViewHint || 'Show the live view while offline, to set it up'} data-home-preview-toggle={preview ? 'on' : 'off'}>
                <span>{t.homeLiveView || 'Live view'}</span>
                <span className={`w-8 h-4 rounded-full relative transition-colors ${preview ? 'bg-current-accent' : 'bg-zinc-700'}`}><span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${preview ? 'left-4' : 'left-0.5'}`} /></span>
              </button>
            )}
            {isMod && <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400"><ShieldCheck size={11} /> {t.homeModerator || 'Moderator'}</span>}
          </Card>

          {/* the numbers: live (or its preview), or getting ready */}
          {showLive ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-home="numbers">
              <Card light={light}><Label>{t.homeWatching || 'Watching'}</Label><p className="text-3xl font-black">{nf(watching)}</p><p className="text-[11px] text-zinc-500 mt-1">{[viewers.twitch && `Twitch ${nf(viewers.twitch)}`, viewers.youtube && `YouTube ${nf(viewers.youtube)}`, viewers.tiktok && `TikTok ${nf(viewers.tiktok)}`].filter(Boolean).join(' · ') || '—'}</p></Card>
              <Card light={light}><Label>{t.homeFollows || 'Follows tonight'}</Label><p className="text-3xl font-black">{nf(totals.follows)}</p></Card>
              <Card light={light}><Label>{t.homeSubs || 'Subs and gifts'}</Label><p className="text-3xl font-black">{nf((Number(totals.subs) || 0) + (Number(totals.gifted) || 0))}</p>{Number(totals.members) > 0 && <p className="text-[11px] text-zinc-500 mt-1">{fill(t.homeMembers || '{n} YouTube members', { n: nf(totals.members) })}</p>}</Card>
              <Card light={light}><Label>{t.homeBits || 'Bits'}</Label><p className="text-3xl font-black">{nf(totals.bits)}</p></Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-home="ready">
              <Card light={light}>
                <Label>{t.homeGettingReady || 'Getting ready'}</Label>
                {[
                  // What is so right now: before a stream, OBS closed is only not open yet.
                  [t.homeReadyObs || 'OBS connected', system?.status?.obs === 'connected'],
                  [t.homeReadyPage || 'The stream page open in OBS', Number(data.surfaces?.canvasInObs) > 0],
                  [t.homeReadyPlatforms || 'Where you stream, connected', ['twitch', 'youtube', 'tiktok'].some((k) => system?.status?.[k] === 'connected' || (k === 'youtube' && system?.connections?.youtubeAuthorised))],
                ].map(([label, ok]: any) => (
                  <p key={label} className="flex items-center gap-2.5 py-1.5 text-sm">{ok ? <Check size={14} className="text-emerald-400" /> : <Circle size={14} className="text-zinc-600" />}<span className={ok ? 'text-zinc-300' : 'text-zinc-500'}>{label}</span></p>
                ))}
              </Card>
              <Card light={light}>
                <Label>{t.homeNextUp || 'Next up'}</Label>
                {next ? <p className="text-sm font-bold">{fill(t.homeNextStream || 'Next stream {when}', { when: ago(Date.parse(next.start), now, language) })}{next.title ? ` — ${next.title}` : ''}</p> : <p className="text-sm text-zinc-500">{t.homeNoSchedule || 'Nothing on your Twitch schedule.'}</p>}
                {(data.plan?.items || []).slice(0, 3).map((i: any) => <p key={i.id} className="text-xs text-zinc-400 mt-1.5">· {i.text}</p>)}
              </Card>
            </div>
          )}

          {/* needs you (the streamer) or the moderating tools (a moderator), beside the latest */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isMod ? (
              <Card light={light} data-home="mod-tools">
                {/* The switches carry their own title. */}
                <ChatModes ask={system.actions.twitchMod} t={t} inline />
                <div className="mt-3"><AutomodQueue held={data.automodHeld || []} ask={system.actions.twitchMod} t={t} /></div>
              </Card>
            ) : (
              <Card light={light} data-home="needs">
                <Label>{t.homeNeedsYou || 'Needs you'}</Label>
                {!needs.length
                  ? <p className="text-sm text-zinc-500 flex items-center gap-2" data-home-needs-none><Check size={14} className="text-emerald-400" /> {t.homeNothingNeeded || 'Nothing needs you right now.'}</p>
                  : needs.map((n) => (
                    <div key={n.id} className="flex items-center gap-3 py-2.5 border-t border-zinc-800/60 first:border-t-0" data-home-need={n.id}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${n.tone === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <span className="flex-1 text-sm">{n.text}</span>
                      {n.go && <Button size="sm" variant="secondary" onClick={() => setView(n.go!)}>{n.button}</Button>}
                    </div>
                  ))}
              </Card>
            )}
            <Card light={light} data-home="latest">
              <Label>{t.homeLatest || 'Latest'}</Label>
              {!events.length
                ? <p className="text-sm text-zinc-500">{t.homeNoEvents || 'No follows, subs or raids yet.'}</p>
                : events.map((e, i) => (
                  <div key={e.id || i} className="flex items-baseline gap-3 py-2 border-t border-zinc-800/60 first:border-t-0 text-sm">
                    <span className="font-bold truncate max-w-[40%]">{e.user}</span>
                    <span className="flex-1 text-zinc-400 truncate">{describeEvent(e, t)}</span>
                    <span className="text-[11px] text-zinc-600 shrink-0">{ago(e.timestamp ?? e.at, now, language)}</span>
                  </div>
                ))}
            </Card>
          </div>

          {/* a moderator's own deck */}
          {isMod && (data.dockButtons || []).length > 0 && (
            <Card light={light} data-home="deck">
              <Label>{t.homeYourDeck || 'Your deck'}</Label>
              <DockActionsGrid buttons={data.dockButtons} streamActions={data.streamActions || []} runDockAction={system.actions.runDockAction} stats={stats} columns={6} t={t} foldable={false} />
            </Card>
          )}

          <LayoutButtons system={system} t={t} light={light} canPick />
        </>
      )}
    </div>
  );
};
