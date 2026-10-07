/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Hype Train on stream: its level, how far into it, how long is left and
 * who is pushing it — only while one runs, and for a few seconds after to say
 * how far it got. The train is Twitch's; the server keeps where it is
 * (hypeTrain), and this only draws it.
 *
 * Plain on purpose, like every layer here; a look dresses it. Its parts name
 * themselves (data-hype="frame", "title", "level", "track", "fill", "time",
 * "top", "done") and the frame says what it is doing: data-hype-state
 * (running, done), data-hype-levelup while a level has just gone up, and
 * data-hype-golden for a golden Kappa train.
 */
import React, { useEffect, useState } from 'react';

export interface HypeTrainLayerConfig {
  title?: string;
  levelWord?: string;
  doneText?: string;
  /** How long "level reached" stays once the train is over, in seconds. */
  doneSeconds?: number;
  showTop?: boolean;
}

export interface HypeTrainState {
  active: boolean;
  level: number;
  progress: number;
  goal: number;
  total?: number;
  expiresAt: number | null;
  endedAt: number | null;
  golden?: boolean;
  top?: { user: string; type?: string; total?: number }[];
  levelUpAt?: number | null;
}

/** How long "level up" is marked on the frame, for a look to celebrate it. */
const LEVEL_UP_MS = 2500;

export const HypeTrainLayer = ({ config, train }: { config: HypeTrainLayerConfig; train?: HypeTrainState | null }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!train) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [train]);
  if (!train) return null;
  const done = !train.active;
  if (done && (!train.endedAt || now - train.endedAt > (config.doneSeconds ?? 8) * 1000)) return null;

  const pct = train.goal > 0 ? Math.min(100, Math.max(0, Math.round((train.progress / train.goal) * 100))) : 0;
  const left = train.expiresAt ? Math.max(0, Math.round((train.expiresAt - now) / 1000)) : null;
  const time = left === null ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const levelUp = Boolean(train.levelUpAt && now - train.levelUpAt < LEVEL_UP_MS);
  const top = (train.top || []).map((c) => c.user).filter(Boolean);

  // Sized from the layer's box: the wrapper is that box, so the frame's own sizes can be measured against it.
  return (
    <div className="w-full h-full" style={{ containerType: 'size' }}>
    <div
      className="w-full h-full flex flex-col justify-center overflow-hidden rounded-xl text-white font-black"
      data-hype="frame" data-hype-state={done ? 'done' : 'running'} data-hype-levelup={levelUp ? 'true' : 'false'} data-hype-golden={train.golden ? 'true' : 'false'}
      style={{ background: 'rgba(10,10,11,.72)', padding: '8cqh 3cqw', gap: '7cqh', fontSize: '20cqh' }}
    >
      <div className="flex items-baseline gap-[2cqw] min-w-0 leading-none" data-hype="head">
        <span className="uppercase tracking-widest truncate" data-hype="title">{config.title || 'Hype Train'}</span>
        <span className="uppercase tracking-widest whitespace-nowrap" data-hype="level" style={{ color: 'var(--overlay-accent, #bf94ff)' }}>
          {config.levelWord || 'Nivel'} {train.level}
        </span>
        {!done && time && <span className="ml-auto tabular-nums whitespace-nowrap opacity-70" data-hype="time">{time}</span>}
      </div>
      {done ? (
        <div className="leading-none truncate" data-hype="done">
          {(config.doneText || '¡Nivel {level} alcanzado!').split('{level}').join(String(train.level))}
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-full" data-hype="track" style={{ height: '18cqh', background: 'rgba(255,255,255,.14)' }}>
          <div className="h-full rounded-full" data-hype="fill" style={{ width: `${pct}%`, background: 'var(--overlay-accent, #9146ff)', transition: 'width 600ms ease-out' }} />
        </div>
      )}
      {config.showTop !== false && !done && top.length > 0 && (
        <div className="truncate leading-none opacity-70" data-hype="top" style={{ fontSize: '0.6em' }}>{top.join(' · ')}</div>
      )}
    </div>
    </div>
  );
};
