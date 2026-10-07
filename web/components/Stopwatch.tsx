/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The run timer on stream: "00:00.0", counting up.
 *
 * The clock beside every run at Games Done Quick. The server keeps when it
 * started, never a ticking number, and this works the time out from that —
 * so a browser source that reloads mid-run comes back on the right time, and
 * two overlays on two machines agree to the tenth.
 *
 * A device's clock can be seconds off the server's, so every state carries
 * the server's clock at the moment it was sent, and the gap is taken off.
 */
import React, { useEffect, useState } from 'react';
import { StopwatchState } from '../types';

/**
 * The time on the clock, in milliseconds, as this device should show it.
 *
 * While running it is measured from the start against the server's clock;
 * otherwise it is the time the server holds.
 */
export function elapsedFor(state: StopwatchState | undefined): number {
  if (!state) return 0;
  if (state.mode !== 'running' || !state.startedAt) return state.elapsedMs || 0;
  const skew = state.serverNow && state.clientReceivedAt ? state.serverNow - state.clientReceivedAt : 0;
  return Math.max(0, Date.now() + skew - state.startedAt);
}

/**
 * The time as a marathon writes it: 00:00.0 under an hour, 1:02:03.4 over.
 *
 * Minutes are always two digits, the way theirs reads before a run starts, so
 * the clock does not change width the moment it passes ten minutes. Tenths are
 * cut rather than rounded — a clock reading 1.0 at 0.95s would be ahead of the
 * run it is timing.
 */
export function formatStopwatch(ms: number, tenths = true): string {
  const t = Math.max(0, Math.floor(ms));
  const total = Math.floor(t / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return tenths ? `${base}.${Math.floor(t / 100) % 10}` : base;
}

interface Props {
  state: StopwatchState | undefined;
  /** Drawn smaller for a preview than it is on stream. */
  previewScale?: number;
}

/*
  data-stopwatch names the clock and its digits, and data-stopwatch-mode says
  whether it is idle, running, paused or finished — the moment a stylesheet
  most wants to catch, a finished run turning gold.
*/
export const Stopwatch: React.FC<Props> = ({ state, previewScale }) => {
  const [, tick] = useState(0);
  const running = state?.mode === 'running';

  // Often enough that the tenths move smoothly, and only while it runs.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 50);
    return () => clearInterval(id);
  }, [running]);

  if (!state) return null;
  const style = state.style || ({} as StopwatchState['style']);
  const colour = state.mode === 'finished'
    ? (style.finishedColor || '#facc15')
    : state.mode === 'paused' ? (style.pausedColor || '#a1a1aa') : (style.color || '#ffffff');

  return (
    <div
      className="w-full h-full flex items-center justify-center" data-stopwatch="clock" data-stopwatch-mode={state.mode}
      style={{
        background: style.background || 'transparent',
        // The colour chosen for the state it is in, for a look to read before
        // its own; left automatic, nothing is set and the look decides.
        ['--stopwatch-colour' as any]: (state.mode === 'finished' ? style.finishedColor
          : state.mode === 'paused' ? style.pausedColor : style.color) || undefined,
      }}
    >
      <span
        className="font-black tabular-nums leading-none" data-stopwatch="digits"
        style={{ color: colour, fontSize: `${(style.fontSize || 96) * (previewScale ?? 1)}px`, transition: 'color 300ms' }}
      >
        {formatStopwatch(elapsedFor(state), style.showTenths !== false)}
      </span>
    </div>
  );
};
