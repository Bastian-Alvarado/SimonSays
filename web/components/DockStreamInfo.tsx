/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * One line under the stream in the dock, when it sits beside the panels: is
 * it live and for how long, what it is called and what is being played, and
 * how many are watching. What a moderator glances at, without a tab of its
 * own.
 *
 * All of it is already on the page: the stream on now (server/engine/
 * stream-sessions.js streamNow, null while offline) and the platforms'
 * viewer counts (stats), the same the home screen shows. Its height is fixed
 * (DockPlayer keeps that much under the player) and its words are cut short
 * rather than wrapped, so the player never moves.
 */
import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

interface Props {
  streamNow: { startedAt: number; title: string; game: string } | null;
  stats: any;
  t: any;
}

/** 0:05, 1:23: hours and minutes live. */
export const liveFor = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

export const DockStreamInfo: React.FC<Props> = ({ streamNow, stats, t }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!streamNow) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [streamNow]);
  const s = stats || {};
  // As the home screen counts them: YouTube's only while it is live there.
  const viewers = (Number(s.twitchViewers) || 0) + (s.youtubeLive ? Number(s.youtubeViewers) || 0 : 0) + (Number(s.tiktokViewers) || 0);
  const what = streamNow ? [streamNow.title, streamNow.game].filter(Boolean).join(' · ') : '';
  return (
    <div className="h-7 shrink-0 flex items-center gap-2 px-2 rounded-lg border border-zinc-800 bg-zinc-900/80 text-[10px] font-bold min-w-0" data-dock-info={streamNow ? 'live' : 'offline'}>
      {streamNow ? (
        <span className="shrink-0 flex items-center gap-1.5 text-red-400 uppercase tracking-widest text-[9px] font-black">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          {(t.dockInfoLive || 'Live {time}').replace('{time}', liveFor(now - streamNow.startedAt))}
        </span>
      ) : (
        <span className="shrink-0 text-zinc-500 uppercase tracking-widest text-[9px] font-black">{t.dockInfoOffline || 'Offline'}</span>
      )}
      <span className="flex-1 min-w-0 truncate text-zinc-300" title={what}>{what}</span>
      {streamNow && (
        <span className="shrink-0 flex items-center gap-1 text-zinc-400 font-mono" title={t.dockInfoViewers || 'Watching now, every platform'}>
          <Eye size={11} /> {viewers}
        </span>
      )}
    </div>
  );
};
