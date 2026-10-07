/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The chat's leaderboard on stream: the first few by XP, with their level
 * and how far they are into it. The server keeps the board (leaderboard,
 * a few seconds behind the chat); this only draws it.
 *
 * Plain on purpose, like every layer here; a look dresses it. Its parts name
 * themselves (data-board="frame", "title", "list", "row", "place", "avatar",
 * "name", "level", "xp", "track", "fill"), and each row says its place
 * (data-board-place="1"); the first three also say data-board-podium="first",
 * "second" and "third", so a look can crown them.
 */
import React from 'react';
import { CommittedInput } from './CommittedInput';

export interface LeaderboardLayerConfig {
  title?: string;
  /** How many rows, 3 to 10. */
  count?: number;
  levelWord?: string;
  showXp?: boolean;
  showBar?: boolean;
  showAvatars?: boolean;
  showTitle?: boolean;
}

export interface BoardEntry {
  id: string;
  username: string;
  avatar?: string;
  xp: number;
  level: number;
}

/** The first three rows, by name, for a look to crown them. */
const PODIUM = ['first', 'second', 'third'];

/** XP a level starts at: the inverse of the server's getLevel. */
const xpForLevel = (level: number) => (level <= 0 ? 0 : (level * 10) ** 2);

/** How far somebody is from their level to the next, 0 to 100. */
export const levelProgress = (xp: number, level: number) => {
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return to > from ? Math.min(100, Math.max(0, Math.round(((xp - from) / (to - from)) * 100))) : 0;
};

export const LeaderboardLayer = ({ config, board }: { config: LeaderboardLayerConfig; board?: BoardEntry[] | null }) => {
  const rows = (board || []).slice(0, Math.min(10, Math.max(3, config.count ?? 5)));
  return (
    <div className="w-full h-full" style={{ containerType: 'size' }}>
      <div
        className="w-full h-full flex flex-col overflow-hidden rounded-xl text-white font-black"
        data-board="frame" data-board-empty={rows.length ? 'false' : 'true'}
        style={{ background: 'rgba(10,10,11,.72)', padding: '3cqh 4cqw', gap: '2cqh' }}
      >
        {config.showTitle !== false && (
          <div className="uppercase tracking-widest truncate leading-none" data-board="title" style={{ fontSize: '6cqh', color: 'var(--overlay-accent, #ffffff)' }}>
            {config.title || 'Top del chat'}
          </div>
        )}
        <ol className="flex-1 min-h-0 flex flex-col justify-start" data-board="list" style={{ gap: '1.5cqh' }}>
          {rows.map((u, i) => (
            <li key={u.id} className="flex items-center min-w-0" data-board="row" data-board-place={i + 1} data-board-podium={PODIUM[i]} style={{ gap: '2cqw', height: `${Math.min(14, 82 / rows.length)}cqh` }}>
              <span className="tabular-nums text-right shrink-0" data-board="place" style={{ width: '1.6em', fontSize: '5cqh', opacity: 0.7 }}>{i + 1}</span>
              {config.showAvatars !== false && (
                u.avatar
                  ? <img src={u.avatar} alt="" className="rounded-full object-cover shrink-0" data-board="avatar" style={{ height: '100%', aspectRatio: '1' }} />
                  : <span className="rounded-full shrink-0 bg-white/10" data-board="avatar" style={{ height: '100%', aspectRatio: '1' }} />
              )}
              <span className="flex-1 min-w-0 flex flex-col justify-center" style={{ gap: '0.8cqh' }}>
                <span className="flex items-baseline min-w-0" style={{ gap: '1.5cqw' }}>
                  <span className="truncate" data-board="name" style={{ fontSize: '5.5cqh' }}>{u.username}</span>
                  <span className="ml-auto whitespace-nowrap uppercase tracking-wider" data-board="level" style={{ fontSize: '4cqh', color: 'var(--overlay-accent, #ffffff)' }}>
                    {config.levelWord || 'Nv'} {u.level || 0}
                  </span>
                  {config.showXp && <span className="whitespace-nowrap tabular-nums opacity-60" data-board="xp" style={{ fontSize: '3.6cqh' }}>{(u.xp || 0).toLocaleString('es-MX')} XP</span>}
                </span>
                {config.showBar !== false && (
                  <span className="block w-full overflow-hidden rounded-full" data-board="track" style={{ height: '1.2cqh', background: 'rgba(255,255,255,.14)' }}>
                    <span className="block h-full rounded-full" data-board="fill" style={{ width: `${levelProgress(u.xp || 0, u.level || 0)}%`, background: 'var(--overlay-accent, #ffffff)', transition: 'width 600ms ease-out' }} />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

/** A board for the Library, before anybody has XP. */
export const SAMPLE_BOARD: BoardEntry[] = [
  { id: 's1', username: 'Tripulante', xp: 2650, level: 5 },
  { id: 's2', username: 'Impostor', xp: 1840, level: 4 },
  { id: 's3', username: 'Daltonico', xp: 1210, level: 3 },
  { id: 's4', username: 'Fantasma', xp: 560, level: 2 },
  { id: 's5', username: 'Novato', xp: 130, level: 1 },
];

// ------------------------------------------------------------ its settings

interface PanelProps {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';

const Check = ({ on, set, text, name }: { on: boolean; set: (v: boolean) => void; text: string; name: string }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-current-accent" data-board-option={name} />
    <span className="text-[9px] text-zinc-400">{text}</span>
  </label>
);

export const LeaderboardLayerPanel = ({ config, patch, t }: PanelProps) => (
  <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()} data-board-panel>
    <div className="grid grid-cols-[1fr_70px_70px] gap-2">
      <label className="block">
        <span className={label}>{t.boardTitle || 'Title'}</span>
        <CommittedInput value={config.title ?? ''} placeholder="Top del chat" onCommit={(v) => patch({ title: v })} className={field} />
      </label>
      <label className="block">
        <span className={label}>{t.boardLevelWord || 'Level'}</span>
        <CommittedInput value={config.levelWord ?? ''} placeholder="Nv" onCommit={(v) => patch({ levelWord: v })} className={field} />
      </label>
      <label className="block">
        <span className={label}>{t.boardCount || 'Rows'}</span>
        <input type="number" min={3} max={10} value={config.count ?? 5} onChange={(e) => patch({ count: Number(e.target.value) })} className={field} />
      </label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Check name="showTitle" on={config.showTitle !== false} set={(v) => patch({ showTitle: v })} text={t.boardShowTitle || 'Title'} />
      <Check name="showAvatars" on={config.showAvatars !== false} set={(v) => patch({ showAvatars: v })} text={t.boardShowAvatars || 'Pictures'} />
      <Check name="showBar" on={config.showBar !== false} set={(v) => patch({ showBar: v })} text={t.boardShowBar || 'Progress bar'} />
      <Check name="showXp" on={Boolean(config.showXp)} set={(v) => patch({ showXp: v })} text={t.boardShowXp || 'XP'} />
    </div>
    <p className="text-[9px] text-zinc-600 leading-relaxed">
      {t.boardHint || 'The chatters with the most XP, from every platform, a few seconds behind the chat. Your own accounts are left out.'}
    </p>
  </div>
);
