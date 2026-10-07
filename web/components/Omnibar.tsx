/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The omnibar: a bar across the stream that rotates through a few things worth
 * saying — who followed last, what is playing, a plug for the Discord.
 *
 * Modelled on the ticker along the bottom of Games Done Quick's layouts. Theirs
 * is driven by a donation tracker this has no equivalent of, so the item types
 * here are limited to state the server actually holds.
 *
 * One component renders both the live overlay and the preview in the editor.
 * The chat overlay once had a hand-written copy of its rows for the preview and
 * it drifted for months — features landed in the real surface and never reached
 * the preview. Rendering both from here makes that impossible.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OmnibarConfig, OmnibarItem, StreamTags, CountdownState } from '../types';
import { formatRemaining, remainingFor } from './Countdown';
import { goalPercent, goalProgress } from './GoalBar';
import { withDiscordText } from '../discordEmoji';

/** How many triggers one appearance of the commands slot may show. */
const COMMANDS_PER_SLOT = 4;
/** And how much horizontal room they get, roughly, in characters. */
const COMMANDS_CHAR_BUDGET = 46;

/**
 * How long a slot on its way out stays on the bar.
 *
 * Long enough to cover the exits in the Tailwind config, which run for 0.4s,
 * with a little room either side. A theme writing its own exit has this long
 * before the element is taken away, and there is no way to ask for more: the
 * bar would have to hold the next slot back to give it, and a bar that pauses
 * to finish an animation is worse than one whose animation is cut short.
 */
const EXIT_MS = 450;

/** One slot as drawn: the item it came from, and what it currently says. */
type Slot = { item: OmnibarItem; content: { label: string; value: string } };

/** The bar's own colours: what it draws with no look on it and nothing chosen. */
export const OMNIBAR_OWN = { background: '#0b0b0ecc', text: '#ffffff', accent: '#f43f5e' };

/**
 * The colours chosen for a bar, for a look on it to read before its own.
 *
 * Only what was chosen — empty is automatic, and then the look decides. The
 * inline colours beside these draw the bar without a look, and a look
 * overrules them wherever it speaks; these it reads first. So a colour picked
 * for the bar shows in whichever part of the look plays that part — its
 * ground, its words, its accent — rather than only where the plain bar puts
 * it: the plain bar's accent is the label's lettering, a look's is usually
 * the cell behind it, with its own lettering on top.
 */
export const omnibarChosen = (style: Partial<OmnibarConfig['style']>): React.CSSProperties => ({
  ['--omnibar-background' as any]: style.transparent ? 'transparent' : (style.background || undefined),
  ['--omnibar-text' as any]: style.textColor || undefined,
  ['--omnibar-accent' as any]: style.accentColor || undefined,
});

/** How fast a value too long for the bar walks past, in pixels a second. */
const DRIFT_SPEED = 45;
/** The share of a drift cycle spent moving; the rest is a pause at each end. */
const DRIFT_MOVING = 0.35;
/** Below this it is not worth moving, and above it nothing is readable. */
const DRIFT_SECONDS = { least: 6, most: 40 };

/** How long a slot is marked as having just changed what it says. */
const FRESH_MS = 900;
/**
 * And how long it has to have been saying the same thing for the change to
 * count as news.
 *
 * A slot mirroring a running countdown says something different every second;
 * marking each of those is a bar that flashes once a second forever. Something
 * that has been steady for a few seconds and then changes is the case worth
 * pointing at — a total going up, the next song, a slot an action just wrote.
 */
const FRESH_QUIET_MS = 3000;

interface OmnibarProps {
  config: OmnibarConfig;
  tags: StreamTags;
  leaderboard: any[];
  track: { name?: string; artist?: string; isPlaying?: boolean } | null;
  /** What Spotify says plays next. Null when it has nothing lined up. */
  upNext?: { name?: string; artist?: string } | null;
  /** Commands, so the bar can teach viewers which ones exist. */
  commands?: any[];
  /** The event history ring, newest first. */
  events?: any[];
  /** Longest-standing current subscribers, newest tenure data first. */
  subscribers?: { name: string; months: number; tier?: string }[];
  /** The shared countdown, so the bar can mirror it while it runs. */
  countdown?: CountdownState;
  /** The counts the server keeps, for a goal slot following one of them. */
  stats?: Record<string, any>;
  /** Preview mode holds on one item rather than rotating past the one being edited. */
  frozenIndex?: number | null;
  t: any;
}

/** A slot's heading and body, or null when there is nothing to say yet. */
function renderItem(
  item: OmnibarItem,
  tags: StreamTags,
  leaderboard: any[],
  track: OmnibarProps['track'],
  upNext: OmnibarProps['upNext'],
  countdown: OmnibarProps['countdown'],
  commands: OmnibarProps['commands'],
  subscribers: OmnibarProps['subscribers'],
  events: OmnibarProps['events'],
  cycle: number,
  t: any,
  stats?: Record<string, any>,
): { label: string; value: string } | null {
  const named = (entry: any) => (entry && entry.user ? String(entry.user) : '');

  switch (item.type) {
    case 'text':
      return item.text ? { label: item.label || '', value: item.text } : null;

    case 'latestFollower': {
      const who = named(tags?.latestFollower);
      return who ? { label: item.label || t.omnibarTypeFollower, value: who } : null;
    }
    case 'latestSubscriber': {
      const who = named(tags?.latestSubscriber);
      return who ? { label: item.label || t.omnibarTypeSubscriber, value: who } : null;
    }
    case 'latestRaid': {
      const raid: any = tags?.latestRaid;
      if (!raid?.user) return null;
      const size = raid.amount ? ` (${raid.amount})` : '';
      return { label: item.label || t.omnibarTypeRaid, value: `${raid.user}${size}` };
    }
    case 'latestDonation':
    case 'topDonation': {
      const entry: any = item.type === 'topDonation' ? tags?.topDonation : tags?.latestDonation;
      if (!entry?.user) return null;
      const amount = entry.amount ? ` — ${entry.amount} ${entry.currency || ''}`.trimEnd() : '';
      return {
        label: item.label || (item.type === 'topDonation' ? t.omnibarTypeTopDonation : t.omnibarTypeDonation),
        value: `${entry.user}${amount}`,
      };
    }

    case 'nowPlaying': {
      // Nothing playing is the common case between songs; showing an empty
      // slot for a quarter of the rotation reads as a broken bar.
      if (!track?.name) return null;
      const artist = track.artist ? ` — ${track.artist}` : '';
      return { label: item.label || t.omnibarNowPlaying, value: `${track.name}${artist}` };
    }

    case 'upNext': {
      // Spotify genuinely has no answer sometimes — one track playing with
      // nothing queued and autoplay off. Hiding the slot beats an empty bar.
      if (!upNext?.name) return null;
      const nextArtist = upNext.artist ? ` — ${upNext.artist}` : '';
      return { label: item.label || t.omnibarUpNext, value: `${upNext.name}${nextArtist}` };
    }

    case 'countdown': {
      // Only while it is actually counting. An idle or finished clock has
      // nothing to say, and the bar drops slots that say nothing — so this
      // appears when you start the timer and removes itself when it ends,
      // with no extra wiring.
      if (countdown?.mode !== 'running' && countdown?.mode !== 'paused') return null;
      const left = formatRemaining(remainingFor(countdown));
      // The countdown's own label is the sensible default: it already says
      // "Starting soon", and repeating that in the slot's label is noise.
      return {
        label: item.label || countdown.label || t.omnibarTypeCountdown,
        value: countdown.mode === 'paused' ? `${left} (${t.countdownPaused})` : left,
      };
    }

    case 'commands': {
      const picked = item.commandIds || [];

      // An explicit choice wins outright. Picking a subs-only command is a
      // deliberate decision — advertising the perk is a reasonable thing to
      // want — so only the "anyone" filter is a default, not a rule.
      //
      // A disabled command is excluded either way: typing it does nothing, so
      // putting it on the bar is just a lie.
      const usable = (commands || []).filter((c: any) => c.enabled !== false);
      const chosen = picked.length
        // Ordered by the picker's own list so the bar reads the way it was set
        // up, not the order the commands happen to be stored in.
        ? picked.map((id: string) => usable.find((c: any) => c.id === id)).filter(Boolean)
        : usable.filter((c: any) => c.permissions?.anyone);

      // A command like "Discord" often carries !discord AND !disc — useful to
      // have, noise to advertise. The first trigger is the one worth teaching;
      // the rest are shorthand for people who already know it.
      const triggers = chosen
        .flatMap((c: any) => {
          const list = (c.triggers || []).filter(Boolean);
          return item.commandsAllTriggers ? list : list.slice(0, 1);
        })
        .map((x: string) => String(x).trim())
        .filter(Boolean);

      if (!triggers.length) return null;

      // A window, not the first few. With eighteen commands a fixed slice
      // means the same three are advertised forever and the rest are never
      // discovered — so the window walks forward once per full rotation of
      // the bar, and every command gets its turn.
      const start = (cycle * COMMANDS_PER_SLOT) % triggers.length;
      const shown: string[] = [];
      let width = 0;
      for (let i = 0; i < triggers.length && shown.length < COMMANDS_PER_SLOT; i += 1) {
        const trigger = triggers[(start + i) % triggers.length];
        // Budgeted by characters rather than count, so short triggers fit more
        // and long ones do not run off the end of the bar.
        if (shown.length && width + trigger.length > COMMANDS_CHAR_BUDGET) break;
        shown.push(trigger);
        width += trigger.length + 3;
      }

      return { label: item.label || t.omnibarTypeCommands, value: shown.join(' · ') };
    }

    case 'goal': {
      /*
        One line, like every other slot here: what it is for, where it is
        against where it is going, and either what is left or how far along.
        A source with no figure yet says nothing rather than claiming zero.
      */
      const g = goalProgress(item, stats);
      if (!g.known) return null;
      const p = item.goalPrefix || '';
      const numbers = `${p}${g.value.toLocaleString()} / ${p}${g.target.toLocaleString()}`;
      const after = g.reached
        ? (t.omnibarGoalReached || 'reached!')
        : item.goalShow === 'percent'
          ? `${goalPercent(g)}%`
          : `${p}${g.left.toLocaleString()} ${t.omnibarGoalToGo || 'to go'}`;
      return {
        label: item.label || t.omnibarTypeGoal || 'Goal',
        value: [item.text, `${numbers} · ${after}`].filter(Boolean).join(' — '),
      };
    }

    case 'recentEvents': {
      /**
       * One short phrase per event.
       *
       * Only things a viewer did. A track change or a finished countdown is a
       * real event on the bus, but nobody wants "Now playing" scrolling past
       * in a list of what the channel has been up to — and returning null for
       * those lets them be skipped rather than rendered as a blank.
       */
      const phrase = (e: any): string | null => {
        const who = e?.user || '';
        if (!who) return null;
        const d = e.data || {};
        switch (e.type) {
          case 'twitch_follow':
          case 'tiktok_follow': return `${who} ${t.omnibarEventFollowed}`;
          case 'twitch_sub':
          case 'tiktok_sub': return `${who} ${t.omnibarEventSubbed}`;
          case 'twitch_cheer': return `${who} ${t.omnibarEventCheered} ${d.bits ?? d.amount ?? ''}`.trim();
          case 'twitch_raid': return `${who} ${t.omnibarEventRaided} ${d.viewers ?? d.amount ?? ''}`.trim();
          case 'twitch_redemption': return `${who} ${t.omnibarEventRedeemed} ${d.reward || d.rewardName || ''}`.trim();
          case 'tiktok_gift': return `${who} ${t.omnibarEventGifted} ${d.giftName || ''}${d.count > 1 ? ` x${d.count}` : ''}`.trim();
          case 'tiktok_share': return `${who} ${t.omnibarEventShared}`;
          case 'twitch_sub_gift_bulk':
          case 'youtube_sub_gift_bulk': return `${who} ${t.omnibarEventGiftedSubs} ${d.count ?? d.amount ?? ''}`.trim();
          case 'youtube_sub': return `${who} ${t.omnibarEventMember}`;
          case 'youtube_cheer': return `${who} ${t.omnibarEventSuperChat} ${d.amount || ''}`.trim();
          default: return null;
        }
      };

      const recent = (events || [])
        .map(phrase)
        .filter(Boolean)
        .slice(0, item.topCount || 3) as string[];

      if (!recent.length) return null;
      return { label: item.label || t.omnibarTypeRecent, value: recent.join(' · ') };
    }

    case 'topSubscribers': {
      // The server only lists people it is sure about: currently subscribed
      // AND with an observed month count. Everyone else is simply absent, so
      // there is nothing to filter here.
      const top = (subscribers || []).slice(0, item.topCount || 3);
      if (!top.length) return null;
      return {
        label: item.label || t.omnibarTypeTopSubs,
        value: top.map((s: any) => `${s.name} (${s.months})`).join(' · '),
      };
    }

    case 'topChatters': {
      // Named before slicing: the leaderboard can contain entries with no
      // usable name, and slicing first would silently show fewer than asked
      // for rather than reaching further down the board.
      const names = (leaderboard || [])
        .map((u: any) => u?.name || u?.username || u?.user)
        .filter(Boolean)
        .slice(0, item.topCount || 3);
      return names.length ? { label: item.label || t.omnibarTopChatters, value: names.join(' · ') } : null;
    }

    default:
      return null;
  }
}

/**
 * One slot, in whichever of its three states it is in.
 *
 * Its own component because of the drift: whether a value fits cannot be
 * known from the words, only from the element holding them. The font is
 * whatever the overlay loaded, the size is whatever the bar was set to, and
 * the width is whatever OBS gave the source — so it is measured.
 */
const BarSlot: React.FC<{
  slot: Slot;
  state: 'current' | 'leaving' | 'pinned';
  style: OmnibarConfig['style'];
  entrance: string;
  departure: string;
  drift: boolean;
  /** How long this slot is up for, so a drift can be made to fit in it. */
  turn: number;
  /** Whether to point at a value that changes while the slot stays put. */
  notice: boolean;
  /** Called on a leaving slot that nothing is animating away. */
  onStill?: () => void;
}> = ({ slot, state, style, entrance, departure, drift, turn, notice, onStill }) => {
  const box = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);

  /*
    A slot is only kept on its way out while something is taking it away.

    Keeping it is the whole point of an exit, and it assumed there would be
    one. But a stylesheet written before exits existed can switch the slot's
    own animation off and offer nothing in its place — Marathon's drawn ticker
    did exactly that, and a layer is a copy taken when the theme was applied,
    so his still does. There the outgoing slot sat fully drawn over the top of
    the one arriving, hiding the first half second of its draw, and then
    vanished: opacity 1 and not one animation running, every frame it was
    held. Worse than the cut it replaced.

    So it is asked, the moment it starts leaving, whether anything is moving
    it. The drift and the change mark do not count — neither is a way out.
  */
  useLayoutEffect(() => {
    if (state !== 'leaving' || !onStill) return;
    const el = root.current;
    if (!el || typeof el.getAnimations !== 'function') return;
    /*
      Nor does anything that loops forever: a look's moving hatch never ends,
      so counting it would hold every outgoing slot for the whole exit window
      even when nothing was taking it away.
    */
    const leaving = el.getAnimations({ subtree: true }).some((a) => {
      const name = (a as any).animationName || '';
      const loops = a.effect?.getTiming().iterations === Infinity;
      return a.playState === 'running' && !loops && name !== 'barDrift' && name !== 'bar-fresh';
    });
    if (!leaving) onStill();
  }, [state]);
  const [over, setOver] = useState(0);
  const words = slot.content.value;

  /*
    A slot that stays and changes what it says.

    The rotation is the only thing that had a way of being noticed: everything
    else changed in silence, which is most of what a bar is for. A pinned
    total written by an action, the commands slot moving on to the next four
    triggers, a track ending — all of it simply became different text between
    two frames, and on a bar nobody is staring at, that is the same as not
    happening.
  */
  const [fresh, setFresh] = useState(false);
  const said = useRef(words);
  const changedAt = useRef(Date.now());

  useEffect(() => {
    if (said.current === words) return undefined;
    const now = Date.now();
    const steady = now - changedAt.current;
    said.current = words;
    changedAt.current = now;
    if (!notice || steady < FRESH_QUIET_MS) return undefined;
    setFresh(true);
    const timer = setTimeout(() => setFresh(false), FRESH_MS);
    return () => clearTimeout(timer);
  }, [words, notice]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !drift) { setOver(0); return undefined; }

    /*
      Re-measured when the bar changes width as well as when the words
      change: an overlay is resized by dragging its source in OBS, and a
      value that fitted at one width is the one most likely not to at the
      next. Two pixels of slack so a rounding difference is not a marquee.
    */
    const measure = () => {
      const spare = el.scrollWidth - el.clientWidth;
      setOver(spare > 2 ? spare : 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [words, drift, style.fontSize, style.uppercase]);

  /*
    Constant speed, but never slower than the slot's own turn.

    Speed first, because a long value and a short one walking past at
    different paces is the thing that reads as broken. But a rotating slot is
    only up for its own few seconds, and a drift measured purely by distance
    can be longer than that — the first version spent four seconds paused
    before moving, on a slot that was gone in three, so a value far too long
    for the bar was the one value that never moved at all. Whatever it takes,
    it finishes while the slot is still there to watch.
  */
  const room = state === 'pinned' ? DRIFT_SECONDS.most : Math.max(DRIFT_SECONDS.least, turn);
  const seconds = over
    ? Math.min(room, Math.max(DRIFT_SECONDS.least, over / (DRIFT_SPEED * DRIFT_MOVING)))
    : 0;

  return (
    <div
      ref={root}
      /*
        A pinned slot never shrinks. `overflow: hidden` inside takes away a
        flex item's automatic minimum size, so without this a single value too
        long for the bar squeezes the pinned one to nothing — which is the one
        thing pinning is supposed to prevent. Seen doing exactly that: the
        total went to zero pixels the moment a long incentive came round.
      */
      className={`flex items-baseline gap-3 min-w-0 ${state === 'pinned' ? 'shrink-0' : ''} ${state === 'current' ? entrance : ''} ${state === 'leaving' ? `absolute left-0 right-0 ${departure}` : ''}`} data-omnibar="slot" data-omnibar-state={state} data-omnibar-fresh={fresh ? 'yes' : undefined}
    >
      {slot.content.label && (
        <span
          className="font-black tracking-widest shrink-0" data-omnibar="label"
          style={{
            color: style.accentColor || OMNIBAR_OWN.accent,
            fontSize: `${Math.max(10, (style.fontSize ?? 22) * 0.6)}px`,
            textTransform: style.uppercase === false ? 'none' : 'uppercase',
            /*
              Both bar themes make the label a full-height cell and centre it,
              and centred it measures: the box is in the middle. The capitals
              in it are not. Drawn on the 1080p canvas they sat 0.9px above
              the middle of a 60px cell, with 25px over them and 27px under —
              the snapping Windows does to small text, which is exactly the
              size a label is. Against a bright cell that is the thing you
              see first.

              Padding at the top of a centred box moves what is in it down by
              half, so this is 0.08em, in the label's own size so it scales
              with the bar. Where the label is not a cell, as in the plain
              look, it sits on the value's baseline and padding does not move
              it at all.

              Inline, because both themes set the label's padding with the
              shorthand, and a rule of ours would be reset by it.
            */
            paddingTop: '0.16em',
          }}
        >
          {slot.content.label}
        </span>
      )}
      <span
        ref={box}
        // Cut short with an ellipsis, or walked past — never both, because an
        // ellipsis on words that are about to move says they are not coming.
        className={`font-bold ${drift ? 'overflow-hidden whitespace-nowrap' : 'truncate'}`} data-omnibar="value"
        style={{
          fontSize: `${style.fontSize ?? 22}px`,
          textTransform: style.uppercase === false ? 'none' : 'uppercase',
        }}
      >
        <span
          className={`inline-block whitespace-nowrap shrink-0 ${over ? 'animate-bar-drift' : ''}`} data-omnibar="words"
          style={over ? { animationDuration: `${seconds.toFixed(1)}s`, ['--bar-drift' as any]: `${-over}px` } : undefined}
        >
          {withDiscordText(words)}
        </span>
      </span>
    </div>
  );
};

export const Omnibar: React.FC<OmnibarProps> = ({ config, tags, leaderboard, track, upNext = null, countdown, commands, subscribers, events, stats, frozenIndex = null, t }) => {
  /**
   * A per-second re-render, but ONLY while a running countdown is on the bar.
   *
   * Every other slot changes when the server says so; a clock changes on its
   * own. Ticking unconditionally would re-render an overlay once a second
   * forever for no reason, so the interval only exists when something is
   * actually counting down.
   */
  const [tick, setTick] = useState(0);
  const needsTick = countdown?.mode === 'running'
    && (config?.items || []).some((item) => item.enabled !== false && item.type === 'countdown');

  useEffect(() => {
    if (!needsTick) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [needsTick]);

  /**
   * One monotonic counter drives both which slot is up and how many laps the
   * bar has done — the latter being what the commands slot reads to advance
   * which triggers it advertises.
   *
   * These were two separate states, and they drifted: the rotation bailed out
   * early when there was only one slot (nothing to rotate to), so the lap
   * counter never moved and a lone commands slot advertised the same four
   * triggers forever.
   *
   * The lap count is measured against the CONFIGURED slots rather than the
   * rendered ones, because the rendered list is what the memo below produces —
   * reading its length here would be circular. The exact lap boundary does not
   * matter; only that the number keeps moving.
   */
  const [step, setStep] = useState(0);

  /*
    The address of a logo that failed to load, so it can be left out rather
    than drawn as a broken-picture icon — which on a browser source is on
    stream, in front of everybody, for as long as nobody notices. Keyed by the
    address, so choosing a different logo tries again.
  */
  const [brokenLogo, setBrokenLogo] = useState('');
  const enabledCount = Math.max(1, (config?.items || []).filter((i) => i.enabled !== false && i.pinned !== true).length);
  const cycle = Math.floor(step / enabledCount);

  // Only items that currently have something to say. An enabled "latest
  // follower" on a channel that has had none would otherwise hold the bar
  // empty for its whole slot.
  const slots = useMemo(() => (config?.items || [])
    .filter((item) => item.enabled !== false)
    .map((item) => ({ item, content: renderItem(item, tags, leaderboard, track, upNext, countdown, commands, subscribers, events, cycle, t, stats) }))
    .filter((s) => s.content !== null), [config, tags, leaderboard, track, upNext, countdown, commands, subscribers, events, cycle, t, tick, stats]);

  /**
   * The rotation is keyed on values, never on the `slots` array itself.
   *
   * Every frame from the server produces a fresh snapshot object, so `slots` is
   * a new array on each one even when nothing about the bar changed. An effect
   * depending on that array tears down its timeout and starts a new one every
   * time — and since Spotify alone polls every three seconds, a twelve-second
   * slot never survived long enough to fire. The bar sat still while the server
   * was running and rotated the moment it was stopped, which is exactly how
   * this was spotted.
   *
   * These dependencies are a string and two numbers, so they only change when
   * the rotation genuinely should restart: a slot added or removed, or the
   * current slot's duration edited.
   */
  /*
    A pinned slot sits beside the rotation rather than taking a turn in it.

    This is the one structural thing a marathon bar does that a rotation
    cannot: the donation total is never away, whatever else is cycling past.
    Without it the bar says exactly one thing at any instant, and the piece
    worth keeping on screen is off it for most of every minute.

    Where a pinned slot lands follows the list — the ones above the first
    rotating item go to its left, the rest to its right — so the reorder
    arrows mean something for a slot that never rotates.
  */
  const at = new Map((config?.items || []).map((item, n) => [item.id, n]));
  const firstRotating = (config?.items || []).findIndex((i) => i.enabled !== false && i.pinned !== true);
  const lead = firstRotating < 0 ? Infinity : firstRotating;
  const pinned = slots.filter((s) => s.item.pinned === true);
  const pinnedLeft = pinned.filter((s) => (at.get(s.item.id) ?? 0) < lead);
  const pinnedRight = pinned.filter((s) => (at.get(s.item.id) ?? 0) > lead);
  const rotating = slots.filter((s) => s.item.pinned !== true);

  const rotationKey = rotating.map((s) => s.item.id).join('|');
  const slotCount = rotating.length;
  const index = slotCount ? step % slotCount : 0;
  const currentSeconds = rotating[index]?.item.seconds || config?.defaultSeconds || 12;

  // Runs even with a single slot, and with none at all: the step still has to
  // advance so the commands window keeps moving on a bar that holds nothing
  // else — including one whose only commands slot is pinned.
  useEffect(() => {
    if (frozenIndex !== null || slots.length === 0) return;
    const timer = setTimeout(() => setStep((n) => n + 1), currentSeconds * 1000);
    return () => clearTimeout(timer);
  }, [step, rotationKey, slotCount, slots.length, currentSeconds, frozenIndex]);

  // No clamping needed: the list can shrink while a later item is showing — a
  // song ending removes its slot — but `step % slotCount` is always in range.

  /*
    Which rotating slot is up.

    The editor holds the bar on the slot being edited, and sends that as an
    index into the CONFIGURED list — which is not the list drawn here, since
    slots with nothing to say are dropped and pinned ones were never in it.
    So it is resolved by id, and only falls back to counting when the edited
    item is not in the rotation at all.
  */
  const frozenItem = frozenIndex === null ? null : (config?.items || [])[frozenIndex] || null;
  const frozenAt = frozenItem ? rotating.findIndex((s) => s.item.id === frozenItem.id) : -1;
  const showing = frozenIndex !== null
    ? (frozenAt >= 0 ? frozenAt : Math.min(frozenIndex, slotCount - 1))
    : Math.min(index, slotCount - 1);
  const shown: Slot | null = slotCount ? rotating[Math.max(0, showing)] || null : null;

  const style = config?.style || ({} as OmnibarConfig['style']);
  const entrance = style.transition === 'none'
    ? ''
    : style.transition === 'fade' ? 'animate-fade-in' : 'animate-slide-up';
  const departure = style.transition === 'none'
    ? ''
    : style.transition === 'fade' ? 'animate-fade-out' : 'animate-slide-out-up';

  /**
   * The slot on its way out.
   *
   * React swaps one slot for the next in a single frame, so the bar had an
   * entrance and no exit: the old words were already gone before the new ones
   * started arriving, which is why even the slide read as a cut rather than a
   * handoff. The outgoing slot is kept for a moment longer, marked as
   * leaving, and animated away over the top of the one arriving.
   *
   * Nothing is held back to make room for it — it leaves the flow while it
   * goes, so the slot arriving is never pushed sideways by the one it is
   * replacing.
   *
   * "None" means none: a bar told not to transition mounts no leaving slot at
   * all, rather than a second copy of itself that sits there invisibly.
   */
  const [swap, setSwap] = useState<{ on: string; gone: Slot | null }>({ on: '', gone: null });
  const before = useRef<Slot | null>(null);
  const shownId = shown ? shown.item.id : '';
  const exitMs = style.transition === 'none' ? 0 : EXIT_MS;

  /*
    Worked out while rendering rather than in an effect afterwards, which is
    unusual enough to say why.

    An effect runs after the browser has the new tree. By then React has
    already drawn a bar holding only the slot that arrived — the outgoing one
    was unmounted in that same commit — so asking for it back a moment later
    hands you a brand new element wearing the old words. Everything the old
    one was in the middle of is gone with it, which is how a value that had
    walked to its far end came back showing its first word.

    Deciding here means the two are in the tree together from the first commit
    of the swap, and the one leaving is the element that was already there.
  */
  if (swap.on !== shownId) {
    const gone = before.current;
    setSwap({ on: shownId, gone: exitMs && shownId && gone && gone.item.id !== shownId ? gone : null });
  }
  const leaving = swap.gone;

  useEffect(() => {
    if (!swap.gone) return undefined;
    const timer = setTimeout(() => setSwap((was) => (was.gone ? { ...was, gone: null } : was)), exitMs);
    return () => clearTimeout(timer);
  }, [swap]);

  /*
    Recorded after the effect above has had its look at what was there before.
    Effects run in the order they are written, so this is what makes `before`
    the previous render's slot rather than this one's — and it runs on every
    render, so a slot whose words changed under a stable id leaves saying what
    it last said rather than what it said when it arrived.
  */
  useEffect(() => { before.current = shown; });

  if (!config?.enabled || slots.length === 0) return null;

  /*
    Keyed by the item alone, deliberately, including on the way out.

    A slot that starts leaving is the same slot that was just showing, and
    giving the outgoing copy a key of its own made React throw the old element
    away and mount a new one in its place. Everything mid-flight went back to
    the beginning with it: a long value that had walked to its far end snapped
    back to the start for its last four hundred milliseconds on screen.

    Kept under one key it is the same element throughout, and the exit still
    plays — an animation restarts when its NAME changes, which is exactly what
    swapping the entrance for the departure does.
  */
  const draw = (slot: Slot, state: 'current' | 'leaving' | 'pinned') => (
    <BarSlot
      key={slot.item.id}
      slot={slot}
      state={state}
      style={style}
      entrance={entrance}
      departure={departure}
      drift={style.scroll === true}
      turn={slot.item.seconds || config?.defaultSeconds || 12}
      notice={style.transition !== 'none'}
      onStill={state === 'leaving'
        ? () => setSwap((was) => (was.gone && was.gone.item.id === slot.item.id ? { ...was, gone: null } : was))
        : undefined}
    />
  );

  return (
    <div
      className="w-full flex items-center gap-4 px-6 overflow-hidden" data-omnibar="bar"
      /*
        Names a stylesheet can rely on.

        Without them the only way to reach these from custom CSS is to name the
        utility classes around them, which are an implementation detail and get
        rewritten whenever this component is touched — a stylesheet that breaks
        on an update for a reason nobody can see. These are a promise.
      */
      style={{
        ...omnibarChosen(style),
        height: `${style.height ?? 64}px`,
        // The chosen colour is kept while transparency is on, so turning it
        // back off restores what was there rather than a default.
        background: style.transparent ? 'transparent' : (style.background || OMNIBAR_OWN.background),
        color: style.textColor || OMNIBAR_OWN.text,
      }}
    >
      {/*
        The logo: the one part of the bar that is never text and never moves,
        at the left end where a marathon keeps its own. Outside every slot, so
        nothing a theme says about slots reaches it, and sized from the bar's
        height so it scales with the bar instead of being set twice.
      */}
      {style.logo && brokenLogo !== style.logo && (
        <div className="shrink-0 self-stretch flex items-center px-4" data-omnibar="logo">
          <img
            src={style.logo}
            alt=""
            draggable={false}
            onError={() => setBrokenLogo(style.logo || '')}
            style={{ height: `${Math.round(((style.height ?? 64) * (style.logoSize ?? 70)) / 100)}px`, width: 'auto', maxWidth: 'none' }}
          />
        </div>
      )}
      {pinnedLeft.map((slot) => draw(slot, 'pinned'))}
      {/*
        The stage is where the rotation happens, and the only reason it exists
        is that the slot leaving has to be measured against something: it is
        taken out of the flow, and a positioned parent of exactly the rotating
        region's size is what tells it where to stand. Pinned slots sit
        outside it, which is what keeps them still while it changes.
      */}
      {(shown || leaving) && (
        <div className="relative flex items-center self-stretch flex-1 min-w-0" data-omnibar="stage">
          {shown && draw(shown, 'current')}
          {/*
            The one leaving is drawn after the one arriving, so it is painted
            over the top of it: what you watch is the old words dissolving to
            reveal the new, rather than the new ones surfacing through them.

            Order is free here — the outgoing copy is positioned rather than
            in the flow, so where it sits among its siblings decides nothing
            but which of the two is on top.
          */}
          {leaving && draw(leaving, 'leaving')}
        </div>
      )}
      {pinnedRight.map((slot) => draw(slot, 'pinned'))}
    </div>
  );
};
