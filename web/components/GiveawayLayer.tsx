/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The giveaway on stream (server/engine/giveaway.js): while it is open, the
 * prize and how to enter; when it is drawn, a reel of names that turns,
 * slows and stops on the winner; then the winner, for a while.
 *
 * The reel is the server's — the same names in the same order on every
 * screen — and runs from the moment it drew, measured against the server's
 * clock, so an overlay that reloads mid-reel picks it up where it is.
 *
 * Plain on purpose; a look dresses it. Its parts name themselves
 * (data-giveaway="frame", "title", "prize", "how", "count", "time", "reel",
 * "winner", "avatar", "name", "platform") and the frame says what it is
 * doing: data-giveaway-state = open, closed, drawing or drawn.
 */
import React, { useEffect, useRef, useState } from 'react';
import { CommittedInput } from './CommittedInput';

export interface GiveawayLayerConfig {
  title?: string;
  /** How to enter; {keyword} is the word to type. */
  howText?: string;
  showCount?: boolean;
  /** How long the winner stays up, in seconds. 0 is until the giveaway is cleared. */
  winnerSeconds?: number;
}

export interface GiveawayState {
  mode: 'idle' | 'open' | 'closed' | 'drawn';
  prize: string;
  keyword: string;
  count: number;
  endsAt: number | null;
  drawAt: number | null;
  reel: string[];
  winners: { key: string; name: string; platform: string; avatar?: string }[];
  serverNow?: number;
}

/** How long the reel turns: the server tells chat once it has stopped (REEL_MS). */
export const REEL_MS = 6000;
const PLATFORM: Record<string, string> = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', kick: 'Kick', discord: 'Discord' };

/** Where the reel is at `elapsed`: fast at first, slowing to a stop on the last name. */
export function reelIndex(elapsed: number, length: number) {
  if (length <= 1) return 0;
  const t = Math.min(1, Math.max(0, elapsed / REEL_MS));
  const eased = 1 - (1 - t) ** 3;
  return Math.min(length - 1, Math.round(eased * (length - 1)));
}

export const GiveawayLayer = ({ config, giveaway }: { config: GiveawayLayerConfig; giveaway?: GiveawayState | null }) => {
  // The server's clock, as of the last word from it.
  const skew = useRef(0);
  useEffect(() => { if (giveaway?.serverNow) skew.current = giveaway.serverNow - Date.now(); }, [giveaway?.serverNow]);
  const [now, setNow] = useState(Date.now());
  const busy = Boolean(giveaway && giveaway.mode !== 'idle');
  const drawing = Boolean(giveaway?.mode === 'drawn' && giveaway.drawAt && now + skew.current - giveaway.drawAt < REEL_MS);
  useEffect(() => {
    if (!busy) return undefined;
    const id = setInterval(() => setNow(Date.now()), drawing ? 50 : 500);
    return () => clearInterval(id);
  }, [busy, drawing]);
  if (!giveaway || giveaway.mode === 'idle') return null;

  const serverNow = now + skew.current;
  // The winner has had their seconds.
  const over = (config.winnerSeconds ?? 30) > 0 && giveaway.mode === 'drawn' && giveaway.drawAt
    && serverNow - giveaway.drawAt > REEL_MS + (config.winnerSeconds ?? 30) * 1000;
  if (over) return null;

  const state = giveaway.mode === 'drawn' ? (drawing ? 'drawing' : 'drawn') : giveaway.mode;
  const left = giveaway.endsAt ? Math.max(0, Math.round((giveaway.endsAt - serverNow) / 1000)) : null;
  const time = left === null ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const how = (config.howText || 'Escribe {keyword} para participar').split('{keyword}').join(giveaway.keyword);
  const reel = giveaway.reel || [];
  const winners = giveaway.winners || [];

  return (
    <div className="w-full h-full" style={{ containerType: 'size' }}>
      <div
        className="w-full h-full flex flex-col items-center justify-center text-center overflow-hidden rounded-xl text-white font-black"
        data-giveaway="frame" data-giveaway-state={state}
        style={{ background: 'rgba(10,10,11,.78)', padding: '5cqh 5cqw', gap: '3cqh' }}
      >
        <div className="uppercase tracking-widest leading-none" data-giveaway="title" style={{ fontSize: '7cqh', color: 'var(--overlay-accent, #ffffff)' }}>
          {config.title || 'Sorteo'}
        </div>
        <div className="leading-tight max-w-full" data-giveaway="prize" style={{ fontSize: '11cqh' }}>{giveaway.prize}</div>

        {state === 'open' && (
          <>
            <div className="font-bold opacity-80 leading-tight" data-giveaway="how" style={{ fontSize: '6.5cqh' }}>{how}</div>
            <div className="flex items-center gap-[4cqw] opacity-70 tabular-nums" style={{ fontSize: '5.5cqh' }}>
              {config.showCount !== false && <span data-giveaway="count">{giveaway.count} {giveaway.count === 1 ? 'participante' : 'participantes'}</span>}
              {time && <span data-giveaway="time">{time}</span>}
            </div>
          </>
        )}

        {state === 'closed' && (
          <div className="font-bold opacity-80" data-giveaway="how" style={{ fontSize: '6.5cqh' }}>
            {giveaway.count} {giveaway.count === 1 ? 'participante' : 'participantes'} · ¡Ya viene el sorteo!
          </div>
        )}

        {state === 'drawing' && (
          <div className="w-full truncate leading-none" data-giveaway="reel" style={{ fontSize: '13cqh', color: 'var(--overlay-accent, #ffffff)' }}>
            {reel[reelIndex(serverNow - (giveaway.drawAt || serverNow), reel.length)] || '…'}
          </div>
        )}

        {state === 'drawn' && (
          <div className="flex flex-wrap items-center justify-center gap-[4cqw]" data-giveaway="winner">
            {winners.map((w) => (
              <div key={w.key} className="flex items-center gap-[2cqw] min-w-0">
                {w.avatar && <img src={w.avatar} alt="" className="rounded-full object-cover shrink-0" data-giveaway="avatar" style={{ width: '16cqh', height: '16cqh' }} />}
                <div className="flex flex-col items-start min-w-0 leading-none" style={{ gap: '1.5cqh' }}>
                  <span className="truncate" data-giveaway="name" style={{ fontSize: '12cqh', color: 'var(--overlay-accent, #ffffff)' }}>🎉 {w.name}</span>
                  <span className="uppercase tracking-widest opacity-60" data-giveaway="platform" style={{ fontSize: '4.5cqh' }}>{PLATFORM[w.platform] || w.platform}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** A giveaway for the Library, open with a few in. */
export const SAMPLE_GIVEAWAY: GiveawayState = {
  mode: 'open', prize: 'Un juego de Steam', keyword: '!sorteo', count: 42, endsAt: null, drawAt: null, reel: [], winners: [],
};

// ------------------------------------------------------------ its settings

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';

export const GiveawayLayerPanel = ({ config, patch, t }: { config: Record<string, any>; patch: (next: Record<string, any>) => void; t: any }) => (
  <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()} data-giveaway-panel>
    <div className="grid grid-cols-[1fr_80px] gap-2">
      <label className="block">
        <span className={label}>{t.giveawayLayerTitle || 'Title'}</span>
        <CommittedInput value={config.title ?? ''} placeholder="Sorteo" onCommit={(v) => patch({ title: v })} className={field} />
      </label>
      <label className="block">
        <span className={label}>{t.giveawayLayerWinnerSeconds || 'Winner (s)'}</span>
        <input type="number" min={0} max={600} value={config.winnerSeconds ?? 30} onChange={(e) => patch({ winnerSeconds: Number(e.target.value) })} className={field} />
      </label>
    </div>
    <label className="block">
      <span className={label}>{t.giveawayLayerHow || 'How to enter'}</span>
      <CommittedInput value={config.howText ?? ''} placeholder="Escribe {keyword} para participar" onCommit={(v) => patch({ howText: v })} className={field} />
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={config.showCount !== false} onChange={(e) => patch({ showCount: e.target.checked })} className="accent-current-accent" />
      <span className="text-[9px] text-zinc-400">{t.giveawayLayerShowCount || 'Show how many have entered'}</span>
    </label>
    <p className="text-[9px] text-zinc-600 leading-relaxed">
      {t.giveawayLayerHint || 'Only on screen while a giveaway is up: open, drawing, then the winner for the seconds set (0 keeps it until the giveaway is cleared). Run one from the Giveaways screen.'}
    </p>
  </div>
);
