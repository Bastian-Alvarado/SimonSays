/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A bar counting toward a number.
 *
 * Games Done Quick's `total` is a donation figure with an odometer that rolls
 * up to each new value rather than snapping. The rolling is most of the effect:
 * a number that jumps looks like a page refresh, and one that climbs looks like
 * something happening. This is that, pointed at whatever the server already
 * counts — followers, subscribers, viewers, TikTok likes — or at a number typed
 * in by hand, which is what a subathon or a charity tally usually is.
 */
import React, { useEffect, useRef, useState } from 'react';

export interface GoalConfig {
  source?: 'manual' | 'followers' | 'subs' | 'viewers' | 'tiktokLikes';
  label?: string;
  target?: number;
  manualValue?: number;
  barColor?: string;
  trackColor?: string;
  textColor?: string;
  showNumbers?: boolean;
  showPercent?: boolean;
  radius?: number;
  /** Colours stored with empty as automatic, rather than the default in full (see the server's normaliseGoal). */
  settingsVersion?: number;
}

/**
 * Where a goal's number comes from, and whether there is one yet.
 *
 * Shared with both omnibars' goal slots, so a goal counts the same way on a
 * bar as it does on its own layer. A source the server has no figure for yet
 * reads as unknown rather than as zero — a goal sitting empty because a scope
 * was never granted looks identical to one nobody has contributed to.
 */
export function goalValue(source: string | undefined, manualValue: number | undefined, stats?: Record<string, any>) {
  const fromStats: Record<string, number | undefined> = {
    followers: stats?.twitchFollowers,
    subs: stats?.twitchSubs,
    viewers: stats?.twitchViewers,
    tiktokLikes: stats?.tiktokLikes,
  };
  const raw = (source || 'manual') === 'manual' ? (manualValue ?? 0) : fromStats[source as string];
  const known = Number.isFinite(Number(raw));
  return { known, value: known ? Number(raw) : 0 };
}

/**
 * A goal slot's progress: where it is, what it is aiming for, and what is left.
 *
 * Counted by goalValue, so a goal on a bar and a goal on its own layer agree.
 * A target below one is a bar that is always full, which is nobody's intent.
 */
export function goalProgress(
  goal: { goalSource?: string; goalTarget?: number; goalValue?: number },
  stats?: Record<string, any>,
) {
  const target = Math.max(1, Number(goal.goalTarget) || 100);
  const { known, value } = goalValue(goal.goalSource, goal.goalValue, stats);
  return {
    known,
    value,
    target,
    left: Math.max(0, target - value),
    pct: Math.max(0, Math.min(100, (value / target) * 100)),
    reached: value >= target,
  };
}

/**
 * A goal's percentage as it should be read out.
 *
 * Rounded, the way a marathon's incentive says 53% for $21,194 of $40,000 —
 * rounding down read one short of theirs. But never 100% until it is reached:
 * 99.6% rounds to a finished goal that is not finished.
 */
export function goalPercent(g: { pct: number; reached: boolean }) {
  return g.reached ? 100 : Math.min(99, Math.round(g.pct));
}

/** How long the number takes to travel to a new value. */
const ROLL_MS = 900;

/**
 * A number that climbs to its new value instead of jumping.
 *
 * Eased rather than linear, so a large jump does not spend most of its time
 * crawling through the last few digits. Driven by requestAnimationFrame rather
 * than an interval: a browser source that is not being composited throttles
 * timers unevenly, and rAF at least stops cleanly instead of queueing up.
 */
export function useRollingNumber(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) return undefined;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ROLL_MS);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(origin + delta * eased);
      setShown(next);
      from.current = next;
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  return shown;
}

interface Props {
  config: GoalConfig;
  /** The counts the server holds, so a goal can follow one without being told. */
  stats?: Record<string, any>;
}

/*
  data-goal names the head and the bar: the label, the numbers and the target
  inside them, the percentage beside them, and the track the fill runs along.

  :scope is the layer around all of it, which is where a panel goes. The
  colours of the track and the fill are written inline from the controls, so
  a stylesheet replacing one of those says !important.

  But a colour chosen in the panel beats any look. What was chosen is also
  set on the goal as --goal-bar, --goal-track and --goal-text, and every look
  reads those before its own; left automatic they are not set at all, and
  the look decides. A variable rather than the inline colour alone, because
  a look puts a colour where it likes — its percentage in the fill's colour,
  its label on a box of its own — and the variable goes wherever it does.
*/
export const GoalBar = ({ config, stats }: Props) => {
  const source = config.source || 'manual';
  const target = Math.max(1, config.target ?? 100);

  const { known, value } = goalValue(source, config.manualValue, stats);

  const shown = useRollingNumber(value);
  const pct = Math.max(0, Math.min(100, (shown / target) * 100));

  return (
    <div
      className="w-full h-full flex flex-col justify-center gap-2 px-1"
      style={{
        ['--goal-bar' as any]: config.barColor || undefined,
        ['--goal-track' as any]: config.trackColor || undefined,
        ['--goal-text' as any]: config.textColor || undefined,
      }}
    >
      <div className="flex items-baseline justify-between gap-3" data-goal="head">
        {config.label && (
          <span
            className="font-black uppercase tracking-widest truncate" data-goal="label"
            style={{ color: config.textColor || '#ffffff', fontSize: '0.9em' }}
          >
            {config.label}
          </span>
        )}
        {config.showNumbers !== false && (
          <span
            className="font-black tabular-nums whitespace-nowrap" data-goal="numbers"
            style={{ color: config.textColor || '#ffffff' }}
          >
            {known ? shown.toLocaleString() : '—'}
            <span data-goal="target" style={{ opacity: 0.55 }}> / {target.toLocaleString()}</span>
          </span>
        )}
        {config.showPercent && (
          <span
            className="font-black tabular-nums whitespace-nowrap" data-goal="percent"
            style={{ color: config.textColor || '#ffffff', opacity: 0.75 }}
          >
            {Math.round(pct)}%
          </span>
        )}
      </div>

      <div
        className="w-full overflow-hidden" data-goal="track"
        style={{
          /*
            How full it is, as a plain number a stylesheet can do sums with:
            a look that paints a gradient across the whole track — green to
            red, an EMF meter — sizes the fill's copy of it by this, so the
            colours stay where they are on the track as the fill grows.
          */
          ['--goal-pct' as any]: Math.max(0.5, pct),
          height: '0.55em',
          backgroundColor: config.trackColor || '#27272acc',
          borderRadius: `${config.radius ?? 12}px`,
        }}
      >
        <div
          className="h-full" data-goal="fill"
          style={{
            width: `${pct}%`,
            backgroundColor: config.barColor || 'var(--overlay-accent, #f43f5e)',
            borderRadius: `${config.radius ?? 12}px`,
            // The bar eases with the number rather than on its own clock, so
            // the two never disagree about how full it is.
            transition: `width ${ROLL_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
          }}
        />
      </div>
    </div>
  );
};
