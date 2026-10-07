/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The tall omnibar: the same slots as the omnibar, laid out as cards.
 *
 * Modelled on the bar along the bottom of Games Done Quick's 2026 layouts,
 * which is not a line of text but a strip of boxes: a logo, a box saying what
 * kind of thing is up ("MILESTONE!", with "DONATE NOW!" under it), a card
 * with a headline and a figure on its top row and the detail underneath, and
 * the total held at the right end the whole time.
 *
 * Its own component rather than a mode of the omnibar, on purpose. The two
 * share their slots and their data and nothing about how they draw them, and
 * the omnibar is right as it is — one component doing both would mean every
 * change to this one was a chance to disturb that one. So it has its own
 * layout, its own idea of what each slot says, and its own part names for a
 * stylesheet (data-tallbar), which is also what keeps a theme written for one
 * from landing on the other.
 *
 * What each slot shows is only what the app already knows. A goal is a card
 * of its own, with a bar along its second row; bid wars are not here yet.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { OmnibarConfig, OmnibarItem, StreamTags, CountdownState } from '../types';
import { formatRemaining, remainingFor } from './Countdown';
import { goalPercent, goalProgress, useRollingNumber } from './GoalBar';
import { SOURCES as GOAL_SOURCES } from './GoalLayerPanel';
import { OMNIBAR_OWN, omnibarChosen } from './Omnibar';
import { withDiscordText } from '../discordEmoji';

/** How many chips a detail row offers; the row clips whatever does not fit. */
const MAX_CHIPS = 8;

/** One chip on a detail row: a name, and the figure that goes with it. */
type Chip = { name: string; value?: string };

/**
 * What a slot says, as a card.
 *
 * `label` and `sub` fill the box beside the card; `title` and `figure` its
 * top row; `detail` its bottom row, as a line or as chips.
 */
export type TallCard = {
  label: string;
  sub: string;
  title: string;
  figure?: string;
  detail?: string | Chip[];
  /** A goal: drawn as rolling numbers on the top row and a bar on the second. */
  goal?: ReturnType<typeof goalProgress> & { prefix: string; show: 'remaining' | 'percent' };
};

interface Props {
  config: OmnibarConfig;
  tags: StreamTags;
  leaderboard: any[];
  track: { name?: string; artist?: string; isPlaying?: boolean } | null;
  upNext?: { name?: string; artist?: string } | null;
  commands?: any[];
  events?: any[];
  subscribers?: { name: string; months: number; tier?: string }[];
  countdown?: CountdownState;
  /** The counts the server keeps, for a goal following one of them. */
  stats?: Record<string, any>;
  /** The editor holds the bar on the slot being edited, by its place in the list. */
  frozenIndex?: number | null;
  t: any;
}

/** Which platform an entry came from, as a person would say it. */
const platformName = (p?: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : '');

/**
 * A slot as a card, or null when it has nothing to say.
 *
 * The same slot types as the omnibar, each given a top row and a bottom row.
 * A slot that would say nothing is dropped from the rotation, as there.
 */
export function tallCard(
  item: OmnibarItem,
  data: Omit<Props, 'config' | 'frozenIndex'>,
): TallCard | null {
  const { tags, leaderboard, track, upNext, commands, events, subscribers, countdown, stats, t } = data;
  const sub = item.sublabel || '';
  const card = (label: string, rest: Omit<TallCard, 'label' | 'sub'>): TallCard => ({ label: item.label || label, sub, ...rest });

  switch (item.type) {
    case 'text':
      return item.text ? card('', { title: item.text, detail: item.detail || '' }) : null;

    case 'latestFollower':
    case 'latestSubscriber': {
      const entry: any = item.type === 'latestFollower' ? tags?.latestFollower : tags?.latestSubscriber;
      if (!entry?.user) return null;
      return card(item.type === 'latestFollower' ? t.omnibarTypeFollower : t.omnibarTypeSubscriber, {
        title: String(entry.user),
        detail: platformName(entry.platform),
      });
    }

    case 'latestRaid': {
      const raid: any = tags?.latestRaid;
      if (!raid?.user) return null;
      return card(t.omnibarTypeRaid, {
        title: String(raid.user),
        figure: raid.amount ? `${raid.amount} ${t.tallbarViewers || 'viewers'}` : undefined,
        detail: platformName(raid.platform),
      });
    }

    case 'latestDonation':
    case 'topDonation': {
      const entry: any = item.type === 'topDonation' ? tags?.topDonation : tags?.latestDonation;
      if (!entry?.user) return null;
      return card(item.type === 'topDonation' ? t.omnibarTypeTopDonation : t.omnibarTypeDonation, {
        title: String(entry.user),
        figure: entry.amount ? `${entry.amount} ${entry.currency || ''}`.trim() : undefined,
        detail: platformName(entry.platform),
      });
    }

    case 'nowPlaying':
    case 'upNext': {
      const song = item.type === 'nowPlaying' ? track : upNext;
      if (!song?.name) return null;
      return card(item.type === 'nowPlaying' ? t.omnibarNowPlaying : t.omnibarUpNext, {
        title: String(song.name),
        detail: song.artist || '',
      });
    }

    case 'countdown': {
      // Only while it is counting, as on the omnibar: an idle clock says nothing.
      if (countdown?.mode !== 'running' && countdown?.mode !== 'paused') return null;
      const left = formatRemaining(remainingFor(countdown));
      return card(t.omnibarTypeCountdown, {
        title: countdown.label || t.omnibarTypeCountdown,
        figure: left,
        detail: countdown.mode === 'paused' ? t.countdownPaused : '',
      });
    }

    case 'commands': {
      // The same choice of commands as the omnibar makes: the ones picked, or
      // every enabled one anybody can use. All of them at once here — a card
      // has a whole row for them, where the omnibar had a few words.
      const usable = (commands || []).filter((c: any) => c.enabled !== false);
      const picked = item.commandIds || [];
      const chosen = picked.length
        ? picked.map((id: string) => usable.find((c: any) => c.id === id)).filter(Boolean)
        : usable.filter((c: any) => c.permissions?.anyone);
      const chips = chosen
        .flatMap((c: any) => {
          const list = (c.triggers || []).filter(Boolean);
          return (item.commandsAllTriggers ? list : list.slice(0, 1)).map((x: string) => ({ name: String(x).trim() }));
        })
        .filter((c: Chip) => c.name)
        .slice(0, MAX_CHIPS);
      if (!chips.length) return null;
      return card(t.omnibarTypeCommands, { title: item.name || t.omnibarTypeCommands, detail: chips });
    }

    case 'goal': {
      // A source with no figure yet says nothing rather than claiming zero.
      const g = goalProgress(item, stats);
      if (!g.known) return null;
      const source = GOAL_SOURCES.find((x) => x.value === (item.goalSource || 'followers'));
      return card(t.omnibarTypeGoal || 'Goal', {
        title: item.text || source?.label || '',
        goal: { ...g, prefix: item.goalPrefix || '', show: item.goalShow === 'percent' ? 'percent' : 'remaining' },
      });
    }

    case 'recentEvents': {
      const what = (e: any): Chip | null => {
        const who = e?.user;
        if (!who) return null;
        const d = e.data || {};
        switch (e.type) {
          case 'twitch_follow':
          case 'tiktok_follow': return { name: who, value: t.omnibarEventFollowed };
          case 'twitch_sub':
          case 'tiktok_sub': return { name: who, value: t.omnibarEventSubbed };
          case 'twitch_cheer': return { name: who, value: String(d.bits ?? d.amount ?? t.omnibarEventCheered) };
          case 'twitch_raid': return { name: who, value: String(d.viewers ?? d.amount ?? t.omnibarEventRaided) };
          case 'twitch_redemption': return { name: who, value: String(d.reward || d.rewardName || t.omnibarEventRedeemed) };
          case 'tiktok_gift': return { name: who, value: `${d.giftName || t.omnibarEventGifted}${d.count > 1 ? ` x${d.count}` : ''}` };
          case 'tiktok_share': return { name: who, value: t.omnibarEventShared };
          default: return null;
        }
      };
      const chips = (events || []).map(what).filter(Boolean).slice(0, item.topCount || 3) as Chip[];
      if (!chips.length) return null;
      return card(t.omnibarTypeRecent, { title: item.name || t.omnibarTypeRecent, detail: chips });
    }

    case 'topSubscribers': {
      const chips = (subscribers || []).slice(0, item.topCount || 3).map((s: any) => ({ name: s.name, value: `${s.months}` }));
      if (!chips.length) return null;
      return card(t.omnibarTypeTopSubs, { title: item.name || t.omnibarTypeTopSubs, detail: chips });
    }

    case 'topChatters': {
      const chips = (leaderboard || [])
        .map((u: any) => u?.name || u?.username || u?.user)
        .filter(Boolean)
        .slice(0, item.topCount || 3)
        .map((name: string, n: number) => ({ name, value: `#${n + 1}` }));
      if (!chips.length) return null;
      return card(t.omnibarTopChatters, { title: item.name || t.omnibarTopChatters, detail: chips });
    }

    default:
      return null;
  }
}

export const TallOmnibar = ({ config, frozenIndex = null, ...data }: Props) => {
  const style = config?.style || ({} as OmnibarConfig['style']);
  const [step, setStep] = useState(0);
  const [brokenLogo, setBrokenLogo] = useState('');

  // A running countdown changes every second without anything else changing.
  const [tick, setTick] = useState(0);
  const counting = data.countdown?.mode === 'running' && (config?.items || []).some((i) => i.type === 'countdown' && i.enabled !== false);
  useEffect(() => {
    if (!counting) return undefined;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const cards = useMemo(() => (config?.items || [])
    .filter((item) => item.enabled !== false)
    .map((item) => ({ item, card: tallCard(item, data) }))
    .filter((c) => c.card !== null) as { item: OmnibarItem; card: TallCard }[],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [config, data.tags, data.leaderboard, data.track, data.upNext, data.commands, data.events, data.subscribers, data.countdown, data.stats, data.t, tick]);

  // Pinned slots hold the right end, the way the total does on theirs.
  const pinned = cards.filter((c) => c.item.pinned === true);
  const rotating = cards.filter((c) => c.item.pinned !== true);
  const count = rotating.length;
  const index = count ? step % count : 0;

  // Keyed on values rather than the array, for the reason the omnibar gives:
  // every server frame is a new array, and a timer tied to it never fires.
  const rotationKey = rotating.map((c) => c.item.id).join('|');
  const seconds = rotating[index]?.item.seconds || config?.defaultSeconds || 12;
  useEffect(() => {
    if (frozenIndex !== null || count < 2) return undefined;
    const timer = setTimeout(() => setStep((n) => n + 1), seconds * 1000);
    return () => clearTimeout(timer);
  }, [step, rotationKey, count, seconds, frozenIndex]);

  // The editor asks for a slot by its place in the configured list.
  const frozenItem = frozenIndex === null ? null : (config?.items || [])[frozenIndex] || null;
  const frozenAt = frozenItem ? rotating.findIndex((c) => c.item.id === frozenItem.id) : -1;
  const shown = count ? rotating[frozenAt >= 0 ? frozenAt : index] : null;

  if (!config?.enabled || cards.length === 0) return null;

  const height = style.height ?? 100;
  const size = style.fontSize ?? 22;
  const accent = style.accentColor || OMNIBAR_OWN.accent;
  const caps = style.uppercase === false ? 'none' : 'uppercase';
  const entrance = style.transition === 'none' ? '' : style.transition === 'fade' ? 'animate-fade-in' : 'animate-slide-up';

  const detailRow = (detail: TallCard['detail']) => {
    if (!detail || (Array.isArray(detail) && !detail.length)) return null;
    if (!Array.isArray(detail)) {
      return <div className="truncate opacity-80" data-tallbar="detail" style={{ fontSize: `${Math.round(size * 0.8)}px` }}>{detail}</div>;
    }
    return (
      <div className="flex items-stretch gap-2 min-w-0 overflow-hidden" data-tallbar="detail">
        {detail.map((chip, n) => (
          <span
            key={`${chip.name}-${n}`}
            className="flex items-stretch shrink-0 rounded-md overflow-hidden"
            data-tallbar="chip"
            data-tallbar-first={n === 0 ? 'yes' : undefined}
            style={{ border: `1px solid ${accent}55`, fontSize: `${Math.round(size * 0.75)}px` }}
          >
            <span className="px-2 flex items-center font-bold" data-tallbar="chip-name">{chip.name}</span>
            {chip.value && (
              <span className="px-2 flex items-center font-black" data-tallbar="chip-value" style={{ background: accent, color: '#0b0b0e' }}>
                {chip.value}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      className="w-full flex items-stretch overflow-hidden"
      data-tallbar="bar"
      style={{
        // What was chosen, for a look to read first (see omnibarChosen).
        ...omnibarChosen(style),
        height: `${height}px`,
        background: style.transparent ? 'transparent' : (style.background || OMNIBAR_OWN.background),
        color: style.textColor || OMNIBAR_OWN.text,
      }}
    >
      {style.logo && brokenLogo !== style.logo && (
        <div className="shrink-0 flex items-center px-4" data-tallbar="logo">
          <img
            src={style.logo}
            alt=""
            draggable={false}
            onError={() => setBrokenLogo(style.logo || '')}
            style={{ height: `${Math.round((height * (style.logoSize ?? 70)) / 100)}px`, width: 'auto', maxWidth: 'none' }}
          />
        </div>
      )}

      {shown && (
        /*
          The label box and the card arrive together, keyed by the slot, so
          the box saying what kind of thing is up never disagrees with the
          card beside it for a frame.
        */
        <div key={shown.item.id} className={`flex items-stretch flex-1 min-w-0 ${entrance}`} data-tallbar="slot">
          {(shown.card.label || shown.card.sub) && (
            <div
              className="shrink-0 flex flex-col items-center justify-center px-5 text-center"
              data-tallbar="context"
              style={{ minWidth: `${Math.round(height * 2.2)}px`, borderRight: `1px solid ${accent}55` }}
            >
              {shown.card.label && (
                <span className="font-black tracking-widest leading-tight" data-tallbar="label" style={{ color: accent, fontSize: `${Math.round(size * 0.9)}px`, textTransform: caps }}>
                  {shown.card.label}
                </span>
              )}
              {shown.card.sub && (
                <span className="font-bold tracking-widest leading-tight opacity-80" data-tallbar="sub" style={{ fontSize: `${Math.round(size * 0.55)}px`, textTransform: caps }}>
                  {shown.card.sub}
                </span>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 px-5" data-tallbar="card">
            <div className="flex items-baseline gap-4 min-w-0" data-tallbar="head">
              <span className="font-bold truncate flex-1 min-w-0" data-tallbar="title" style={{ fontSize: `${size}px`, textTransform: caps }}>
                {withDiscordText(shown.card.title)}
              </span>
              {shown.card.figure && (
                <span className="font-black shrink-0 tabular-nums" data-tallbar="figure" style={{ fontSize: `${size}px` }}>
                  {shown.card.figure}
                </span>
              )}
              {shown.card.goal && <GoalFigure goal={shown.card.goal} size={size} />}
            </div>
            {shown.card.goal ? <GoalTrack goal={shown.card.goal} size={size} accent={accent} t={data.t} /> : detailRow(shown.card.detail)}
          </div>
        </div>
      )}
      {!shown && <div className="flex-1" />}

      {pinned.map(({ item, card }) => (
        /*
          A pinned slot is the big figure at the end: whatever it counts, large,
          with what it is underneath. Its figure if it has one, else its title.
        */
        <div
          key={item.id}
          className="shrink-0 flex flex-col items-end justify-center px-6"
          data-tallbar="pinned"
          style={{ borderLeft: `1px solid ${accent}55` }}
        >
          <span className="font-black leading-none tabular-nums" data-tallbar="pinned-figure" style={{ fontSize: `${Math.round(size * 1.6)}px` }}>
            {card.figure || withDiscordText(card.title)}
          </span>
          <span className="font-bold tracking-widest leading-tight" data-tallbar="pinned-caption" style={{ color: accent, fontSize: `${Math.round(size * 0.55)}px`, textTransform: caps }}>
            {card.figure ? (card.sub || card.title) : (card.sub || card.label)}
          </span>
        </div>
      ))}
    </div>
  );
};

type Goal = NonNullable<TallCard['goal']>;

/** Where a goal is against where it is going, climbing to each new value. */
const GoalFigure = ({ goal, size }: { goal: Goal; size: number }) => {
  const shown = useRollingNumber(goal.value);
  return (
    <span className="font-black shrink-0 tabular-nums" data-tallbar="figure" style={{ fontSize: `${size}px` }}>
      {goal.prefix}{shown.toLocaleString()}
      <span data-tallbar="figure-target" style={{ opacity: 0.6 }}> / {goal.prefix}{goal.target.toLocaleString()}</span>
    </span>
  );
};

/**
 * The bar along a goal card's second row, with a box riding the end of the
 * fill: what is left to go, as their milestones say it, or how far along it
 * is, as their incentives do — with a mark at each quarter for that one, so a
 * percentage has something to be measured against.
 */
const GoalTrack = ({ goal, size, accent, t }: { goal: Goal; size: number; accent: string; t: any }) => {
  const marker = goal.reached
    ? (t.omnibarGoalReached || 'reached!')
    : goal.show === 'percent'
      ? `${goalPercent(goal)}%`
      : `−${goal.prefix}${goal.left.toLocaleString()}`;
  const height = Math.round(size * 1.15);
  return (
    <div className="relative w-full" data-tallbar="goal-track" style={{ height: `${height}px`, background: `${accent}22`, border: `1px solid ${accent}55` }}>
      <div
        className="absolute left-0 top-0 bottom-0"
        data-tallbar="goal-fill"
        style={{ width: `${goal.pct}%`, background: accent, transition: 'width 900ms cubic-bezier(0.33, 1, 0.68, 1)' }}
      />
      {/* After the fill, so the quarters show on the part already reached
          as well as the part still to go — under it, the first two vanished
          on any goal past halfway. */}
      {goal.show === 'percent' && [25, 50, 75].map((at) => (
        <span key={at} className="absolute top-0 bottom-0" data-tallbar="goal-tick" style={{ left: `${at}%`, width: '2px', background: '#0b0b0e88' }} />
      ))}
      {/* Held inside the bar near either end, so it never hangs off the card. */}
      <span
        className="absolute top-0 bottom-0 flex items-center px-2 font-black tabular-nums whitespace-nowrap"
        data-tallbar="goal-marker"
        data-tallbar-reached={goal.reached ? 'yes' : undefined}
        style={{
          left: `clamp(0px, calc(${goal.pct}% - 0.5em), calc(100% - 7em))`,
          background: '#0b0b0e',
          color: accent,
          border: `1px solid ${accent}`,
          fontSize: `${Math.round(size * 0.8)}px`,
          transition: 'left 900ms cubic-bezier(0.33, 1, 0.68, 1)',
        }}
      >
        {marker}
      </span>
    </div>
  );
};
