/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What viewers have done: the Events dock's list, on the dashboard and in the
 * chat dock's Events tab.
 *
 * Only viewers' events — the list the server keeps apart from Spotify and OBS
 * (shared/viewer-events.js). This stream's totals across the top, filters by
 * platform and by kind, and on each event the presses that answer it: its
 * alert again, a thank-you in chat, and a shoutout for a raid.
 *
 * One component for both places, so the dock and the dashboard cannot drift:
 * the dock is the same list, tighter.
 */
import React, { useState } from 'react';
import { Heart, Star, Coins, Users, Ticket, Share2, RotateCcw, Megaphone, MessageCircleHeart, Filter } from 'lucide-react';
import { EVENT_KINDS, kindOf, canThank } from '../../shared/viewer-events.js';
import { PLATFORMS } from '../../shared/platforms.js';
import { refusalWords, shoutoutWords, fill } from '../words';

export interface ViewerEvent {
  id: string; type: string; platform: string; user: string; avatar?: string; timestamp: number; data?: Record<string, any>;
}
export interface EventTotals {
  startedAt: number | null; follows: number; subs: number; gifted: number; bits: number; raids: number; raiders: number;
  members: number; superChat: Record<string, number>; redeems: number; tiktokGifts: number; shares: number;
}

interface Props {
  events: ViewerEvent[];
  totals?: EventTotals;
  /** The Events dock's requests to the server (replay, thank). */
  run: (payload: Record<string, any>) => Promise<any>;
  /** A Twitch shoutout, as the Twitch screen and Who's on send one. */
  shoutout: (login: string) => Promise<any>;
  /** Start the totals over. Only offered where there is room to think about it. */
  onResetTotals?: () => void;
  compact?: boolean;
  language: string;
  t: any;
}

const PLATFORM_FILTERS = ['twitch', 'youtube', 'tiktok'] as const;

const KIND_STYLE: Record<string, { icon: any; colour: string }> = {
  follow: { icon: Heart, colour: 'text-rose-400 border-rose-500/25 bg-rose-500/5' },
  sub: { icon: Star, colour: 'text-purple-400 border-purple-500/25 bg-purple-500/5' },
  support: { icon: Coins, colour: 'text-amber-400 border-amber-500/25 bg-amber-500/5' },
  raid: { icon: Users, colour: 'text-orange-400 border-orange-500/25 bg-orange-500/5' },
  redeem: { icon: Ticket, colour: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5' },
  share: { icon: Share2, colour: 'text-sky-400 border-sky-500/25 bg-sky-500/5' },
  other: { icon: Ticket, colour: 'text-zinc-400 border-zinc-700 bg-zinc-900/40' },
};

/** What somebody did, as a line under their name, in the screen's language. */
export function describeEvent(e: ViewerEvent, t: any): string {
  const d = e.data || {};
  const said = (text?: string) => (typeof text === 'string' && text.trim() ? ` — “${text.trim()}”` : '');
  const tier = Number(d.tier) > 1 ? ` · ${fill(t.eventLineTier || 'Tier {tier}', { tier: d.tier })}` : '';
  switch (e.type) {
    case 'twitch_follow':
    case 'tiktok_follow':
      return t.eventLineFollow || 'New follow';
    case 'twitch_sub': {
      if (d.giftedBy) return `${fill(t.eventLineGiftedSub || 'Gift from {giver}', { giver: d.giftedBy })}${tier}`;
      const base = Number(d.months) > 1 ? fill(t.eventLineResub || 'Resubscribed · {months} months', { months: d.months }) : (t.eventLineSub || 'Subscribed');
      return `${base}${d.prime ? ' · Prime' : tier}${said(d.message)}`;
    }
    case 'tiktok_sub':
      return t.eventLineSub || 'Subscribed';
    case 'twitch_sub_gift_bulk':
      return `${fill(t.eventLineGiftBundle || 'Gifted {count} subs', { count: d.count ?? d.amount ?? '' })}${tier}`;
    case 'twitch_cheer':
      return `${fill(t.eventLineCheer || '{bits} bits', { bits: d.bits ?? d.amount ?? '' })}${said(d.message)}`;
    case 'twitch_raid':
      return fill(t.eventLineRaid || 'Raid with {viewers} viewers', { viewers: d.viewers ?? d.amount ?? '' });
    case 'twitch_redemption':
      return `${fill(t.eventLineRedeem || 'Redeemed {reward}', { reward: d.reward || d.rewardName || '' })}${said(d.input)}`;
    case 'youtube_cheer':
      return `${fill(t.eventLineSuperChat || 'Super Chat {amount}', { amount: d.amount || '' })}${said(d.message)}`;
    case 'youtube_sub': {
      const base = Number(d.months) > 0 ? fill(t.eventLineMemberMonths || 'Member for {months} months', { months: d.months }) : (t.eventLineMember || 'Became a member');
      return `${base}${d.tier ? ` · ${d.tier}` : ''}`;
    }
    case 'youtube_sub_gift_bulk':
      return fill(t.eventLineGiftMembers || 'Gifted {count} memberships', { count: d.count ?? '' });
    case 'tiktok_gift':
      return fill(t.eventLineTikTokGift || 'Sent {gift} ×{count}', { gift: d.giftName || '', count: d.count ?? 1 });
    case 'tiktok_share':
      return t.eventLineShare || 'Shared the stream';
    default:
      return e.type;
  }
}

export const EventFeed = ({ events, totals, run, shoutout, onResetTotals, compact = false, language, t }: Props) => {
  const [platform, setPlatform] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');
  // A short word beside an event after a press: done, or why not.
  const [notes, setNotes] = useState<Record<string, { text: string; ok: boolean }>>({});
  const note = (id: string, text: string, ok: boolean) => {
    setNotes((n) => ({ ...n, [id]: { text, ok } }));
    setTimeout(() => setNotes((n) => (n[id]?.text === text ? { ...n, [id]: { text: '', ok } } : n)), ok ? 3000 : 7000);
  };
  const press = async (id: string, work: () => Promise<any>, done: string) => {
    try {
      const out = await work();
      if (out?.ok === false) note(id, refusalWords(t, out), false);
      else note(id, done, true);
    } catch (err: any) {
      note(id, refusalWords(t, err), false);
    }
  };

  const lang = language === 'es' ? 'es' : 'en';
  const today = new Date().toDateString();
  const when = (at: number) => {
    const d = new Date(at);
    const time = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    // An event from another day says which, so yesterday's raid does not pass for tonight's.
    return d.toDateString() === today ? time : `${d.toLocaleDateString(lang, { weekday: 'short', day: 'numeric' })} ${time}`;
  };

  const shown = (events || []).filter((e) => (platform === 'all' || e.platform === platform) && (kind === 'all' || kindOf(e.type) === kind));

  const chip = (on: boolean) => `px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
    on ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
  }`;
  const n = (v: number) => v.toLocaleString(lang);
  const superChat = Object.entries(totals?.superChat || {}).map(([cur, v]) => `${cur}${n(v)}`).join(' · ');
  const tiles: [string, string | number, boolean][] = totals ? [
    [t.eventTotalFollows || 'Follows', n(totals.follows), true],
    [t.eventTotalSubs || 'Subs', n(totals.subs), true],
    [t.eventTotalGifted || 'Gifted', n(totals.gifted), totals.gifted > 0],
    [t.eventTotalBits || 'Bits', n(totals.bits), true],
    [t.eventTotalRaids || 'Raids', totals.raids ? `${n(totals.raids)} (${n(totals.raiders)})` : '0', true],
    [t.eventTotalMembers || 'Members', n(totals.members), totals.members > 0],
    [t.eventTotalSuperChat || 'Super Chat', superChat, Boolean(superChat)],
    [t.eventTotalTikTokGifts || 'TikTok gifts', n(totals.tiktokGifts), totals.tiktokGifts > 0],
    [t.eventTotalRedeems || 'Redeems', n(totals.redeems), totals.redeems > 0],
  ] : [];

  return (
    <div className={`flex flex-col min-h-0 ${compact ? 'gap-2' : 'gap-4'}`} data-event-feed={compact ? 'dock' : 'screen'}>
      {totals && (
        <div className={`rounded-xl border border-zinc-800 bg-zinc-900/40 ${compact ? 'p-2' : 'p-3'} space-y-2`} data-event-totals>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{t.eventTotalsTitle || 'This stream'}</span>
            {totals.startedAt && (
              <span className="text-[9px] font-mono text-zinc-600">{fill(t.eventTotalsSince || 'since {time}', { time: when(totals.startedAt) })}</span>
            )}
            {onResetTotals && (
              <button onClick={onResetTotals} className="ml-auto text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-200">
                {t.eventTotalsReset || 'Start over'}
              </button>
            )}
          </div>
          <div className={`grid gap-1.5 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5'}`}>
            {tiles.filter(([, , on]) => on).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-zinc-950/60 px-2 py-1.5 min-w-0">
                <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 truncate">{label}</div>
                <div className="text-sm font-black text-zinc-100 tabular-nums truncate">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1" data-event-filters>
        <div className="flex gap-0.5 bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800">
          <button onClick={() => setPlatform('all')} className={chip(platform === 'all')}>{t.allSources || 'All'}</button>
          {PLATFORM_FILTERS.map((p) => (
            <button
              key={p} onClick={() => setPlatform(p)} className={chip(platform === p)}
              style={platform === p ? { backgroundColor: (PLATFORMS as any)[p]?.colour } : undefined}
            >
              {(PLATFORMS as any)[p]?.name || p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-0.5 bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800">
          <button onClick={() => setKind('all')} className={chip(kind === 'all')}>{t.eventKindAll || 'Everything'}</button>
          {EVENT_KINDS.map((k) => (
            <button key={k} onClick={() => setKind(k)} className={chip(kind === k)} data-event-kind={k}>
              {t[`eventKind${k.charAt(0).toUpperCase()}${k.slice(1)}`] || k}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto space-y-1.5 ${compact ? '' : 'pr-1'}`}>
        {shown.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center opacity-60">
            <Filter size={compact ? 20 : 28} className="mb-3 text-zinc-600" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{events.length === 0 ? t.noRecentEvents : t.noEventsFilter}</p>
            <p className="text-[10px] text-zinc-600 mt-1 max-w-[220px]">{events.length === 0 ? t.waitingActivity : t.adjustFilters}</p>
          </div>
        ) : shown.map((e) => {
          const k = kindOf(e.type);
          const style = KIND_STYLE[k] || KIND_STYLE.other;
          const Icon = style.icon;
          const known = (PLATFORMS as any)[e.platform];
          const said = notes[e.id];
          const login = e.data?.login || e.user;
          const button = 'p-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 text-zinc-500 hover:text-white hover:border-zinc-600';
          return (
            <div key={e.id} className={`rounded-xl border ${style.colour} ${compact ? 'p-2' : 'p-3'} flex items-start gap-3`} data-event-row={e.type}>
              <div className="relative shrink-0">
                {e.avatar ? (
                  <img src={e.avatar} className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-full border border-white/10`} alt="" />
                ) : (
                  <div className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-full bg-black/30 flex items-center justify-center`}><Icon size={compact ? 13 : 16} /></div>
                )}
                <span
                  className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-black"
                  style={{ backgroundColor: known?.colour || '#52525b' }} title={known?.name || e.platform}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs text-zinc-100 truncate">{e.user}</span>
                  <span className="ml-auto shrink-0 text-[9px] font-mono text-zinc-500">{when(e.timestamp)}</span>
                </div>
                {/* Wraps rather than truncating: a redemption or a cheer carries the viewer's own words. */}
                <div className="text-[11px] text-zinc-300 break-words leading-snug mt-0.5">{describeEvent(e, t)}</div>
                {said?.text && <div className={`text-[10px] font-bold mt-1 ${said.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{said.text}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className={button} title={t.eventReplay || 'Replay its alert'} onClick={() => press(e.id, () => run({ op: 'replay', id: e.id }), t.eventReplayed || 'Alert replayed')}>
                  <RotateCcw size={12} />
                </button>
                {canThank(e) && (
                  <button className={button} title={t.eventThank || 'Thank them in chat'} onClick={() => press(e.id, () => run({ op: 'thank', id: e.id }), t.eventThanked || 'Said in chat')}>
                    <MessageCircleHeart size={12} />
                  </button>
                )}
                {e.type === 'twitch_raid' && (
                  <button className={button} title={fill(t.peopleShoutout || 'Shout out {login}', { login })} onClick={async () => {
                      try { const how = shoutoutWords(t, await shoutout(login)); note(e.id, how.text, how.ok); } catch (err: any) { note(e.id, refusalWords(t, err), false); }
                    }}>
                    <Megaphone size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
