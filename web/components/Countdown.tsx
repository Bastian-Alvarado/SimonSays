/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The countdown, as every surface renders it.
 *
 * The server sends an absolute end time, not a ticking number — so this ticks
 * locally and only hears from the server when something actually changes.
 *
 * Two details that matter:
 *
 *   - The end time is on the *server's* clock. A phone or an OBS machine can
 *     be seconds off, which would show the wrong number, so each payload
 *     carries `serverNow` and the offset is measured from it.
 *   - The ticking interval depends on values, never on the config object's
 *     identity. A new object arrives from the server on every unrelated frame,
 *     and an interval rebuilt that often is the bug that froze the omnibar.
 */
import React, { useEffect, useRef, useState } from 'react';
import { CountdownState } from '../types';

interface CountdownProps {
  state: CountdownState | undefined;
  /** Rendered at a fixed size for the editor preview rather than the real one. */
  previewScale?: number;
  t: any;
}

/**
 * The countdown as a surface showing one particular saved timer should draw it.
 *
 * There is one clock, and a saved timer is a setup loaded into it. A layer
 * that names a saved timer shows the live clock while that timer is the one
 * loaded — running, paused, finished, all of it — and otherwise that timer
 * waiting at its full time, in its own label and colours: an Intermission
 * layer reads "Intermission 15:00" until Intermission is loaded and started.
 *
 * No timer named, or one since deleted, is the clock as it is, which is what
 * every countdown layer showed before a layer could name one.
 */
export function countdownFor(state: CountdownState | undefined, timerId?: string | null): CountdownState | undefined {
  if (!state || !timerId || state.activeId === timerId) return state;
  const preset = (state.presets || []).find((p) => p.id === timerId);
  if (!preset) return state;
  return {
    ...state,
    mode: 'idle',
    endsAt: null,
    remainingMs: preset.durationMs,
    durationMs: preset.durationMs,
    label: preset.label,
    style: { ...state.style, ...(preset.style || {}) } as CountdownState['style'],
  };
}

/**
 * mm:ss, or h:mm:ss once there is an hour to show.
 *
 * Rounded up, as a countdown reads: 0:01 until there is truly nothing left.
 * Rounding to the nearest showed 0:00 for the last half second while it was
 * still running, and five minutes read 5:00 for only half a second.
 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * What the clock should read, correcting for a client whose clock is off.
 *
 * The skew comes from the frame itself — `serverNow` paired with the moment it
 * was received — rather than being measured when a component mounts. It used
 * to be the latter, and the difference is not academic: `serverNow` is only
 * the current time for the instant the frame lands. Re-reading it on a later
 * mount treats a stale timestamp as now, so the clock jumped forward by the
 * age of the last frame. Switching pages remounts this component, which is
 * how a running countdown appeared to reset to its full duration.
 *
 * As a property of the frame, the correction is now the same number no matter
 * how many times anything mounts.
 */
export function remainingFor(state: CountdownState | undefined): number {
  if (!state) return 0;
  if (state.mode !== 'running' || !state.endsAt) return state.remainingMs ?? 0;
  const skew = state.serverNow && state.clientReceivedAt
    ? state.serverNow - state.clientReceivedAt
    : 0;
  return Math.max(0, state.endsAt - (Date.now() + skew));
}

/*
  data-countdown is a promise a stylesheet can rely on: the clock itself, the
  label above it, the digits, and the word that says it is paused.

  :scope is the layer around all of it and is where a panel goes. The clock
  fills that layer and carries its own background inline, so a preset that
  wants the layer to show through says so with !important.
*/
export const Countdown: React.FC<CountdownProps> = ({ state, previewScale, t }) => {
  const [, forceTick] = useState(0);
  const running = state?.mode === 'running';

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => forceTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [running]);

  if (!state) return null;

  const remaining = remainingFor(state);
  const style = state.style || ({} as CountdownState['style']);
  const scale = previewScale ?? 1;

  return (
    <div
      className="flex flex-col items-center justify-center gap-2 w-full h-full" data-countdown="clock"
      style={{
        background: style.background || 'transparent',
        /*
          The colours chosen for the clock, for a look to read before its
          own; left automatic, nothing is set and the look decides. The label
          colour goes wherever the look puts its label: the box behind it, or
          the letters.
        */
        ['--countdown-text' as any]: style.color || undefined,
        ['--countdown-label' as any]: style.labelColor || undefined,
      }}
    >
      {style.showLabel !== false && state.label && (
        <span
          className="font-black uppercase tracking-[0.3em]" data-countdown="label"
          style={{ color: style.labelColor || '#f43f5e', fontSize: `${Math.max(10, (style.fontSize || 96) * 0.18 * scale)}px` }}
        >
          {state.label}
        </span>
      )}
      <span
        className="font-black tabular-nums leading-none" data-countdown="digits"
        style={{
          color: style.color || '#ffffff',
          fontSize: `${(style.fontSize || 96) * scale}px`,
          // Dimmed once it has run out, so a finished timer reads as finished
          // rather than as a clock that is simply sitting at zero.
          opacity: state.mode === 'finished' ? 0.55 : 1,
        }}
      >
        {formatRemaining(remaining)}
      </span>
      {state.mode === 'paused' && (
        <span className="text-[10px] font-black uppercase tracking-widest" data-countdown="paused" style={{ color: style.labelColor || '#f43f5e' }}>
          {t.countdownPaused}
        </span>
      )}
    </div>
  );
};
