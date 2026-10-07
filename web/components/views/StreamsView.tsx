/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Every stream, kept: when, how long, what it was called and played, chat's
 * pace minute by minute on every platform together, the moments chat went
 * wild, the chapters (ready to paste into a YouTube description), the songs,
 * the plan, and who came. From server/engine/stream-sessions.js.
 */
import React, { useEffect, useState } from 'react';
import { History, Copy, Check, ExternalLink, Flame, Scissors, Bookmark, Music, ListChecks, Users, RefreshCw } from 'lucide-react';
import { withDiscordText } from '../../discordEmoji';

interface Listed { id: string; n: number; startedAt: number; endedAt: number; title: string; game: string; people: number; messages: number; songs: number; moments: number; vod?: string; live?: boolean }
interface Props { streams: (op: string, payload?: Record<string, any>) => Promise<any>; t: any }

const PLATFORM_COLOURS: Record<string, string> = { twitch: '#9146ff', youtube: '#ff0000', tiktok: '#ff0050', discord: '#5865f2', kick: '#53fc18' };
const PLATFORM_NAMES: Record<string, string> = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', discord: 'Discord', kick: 'Kick' };
const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';

/** "3 h 12 min", "45 min". */
const lengthOf = (ms: number) => {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
};
const clock = (at: number, start: number) => {
  const total = Math.max(0, Math.floor((at - start) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}` : `${m} min`;
};

/** Chat's pace, a bar a minute, with the moments marked above it. */
const PaceChart = ({ perMinute, moments, start }: { perMinute: number[]; moments: any[]; start: number }) => {
  if (!perMinute.length) return <div className="text-[11px] text-zinc-600 italic">—</div>;
  const max = Math.max(...perMinute, 1);
  const w = 600;
  const h = 80;
  const bw = w / perMinute.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 12}`} className="w-full h-28" preserveAspectRatio="none" data-streams-chart>
      {perMinute.map((n, i) => (
        <rect key={i} x={i * bw} y={12 + h - (n / max) * h} width={Math.max(1, bw - 0.5)} height={(n / max) * h} fill="currentColor" className="text-current-accent" opacity={0.75} />
      ))}
      {moments.filter((m) => m.kind === 'highlight').map((m, i) => {
        const x = ((m.at - start) / 60_000) * bw;
        return <text key={i} x={x} y={10} fontSize={10} textAnchor="middle">🔥</text>;
      })}
    </svg>
  );
};

export const StreamsView = ({ streams, t }: Props) => {
  const [list, setList] = useState<Listed[]>([]);
  const [picked, setPicked] = useState<string>('');
  const [details, setDetails] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const load = () => streams('list').then((l) => { setList(l || []); if (!picked && l?.length) setPicked(l[0].id); }).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!picked) return;
    setDetails(null);
    streams('get', { id: picked }).then(setDetails).catch(() => setDetails(null));
  }, [picked]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(details?.chaptersText || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20" data-streams>
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <History size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.streamsNav || 'Streams'}</span>
          <button onClick={load} className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white"><RefreshCw size={12} /></button>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">{t.streamsHint || 'Every stream since this started being kept: chat\'s pace on every platform together, the moments it went wild, chapters to paste into YouTube, the songs, the plan and who came.'}</p>
        {list.length === 0 && <p className="text-[11px] text-zinc-600 italic">{t.streamsNone || 'No stream kept yet — the next one will be.'}</p>}
        <div className="flex gap-2 overflow-x-auto pb-1" data-streams-list>
          {list.map((s) => (
            <button key={s.id} onClick={() => setPicked(s.id)} data-streams-pick={s.id}
              className={`shrink-0 text-left px-3 py-2 rounded-xl border transition-colors ${s.id === picked ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'}`}>
              <div className="text-[11px] font-bold text-white">{new Date(s.startedAt).toLocaleDateString()} {s.live && <span className="ml-1 text-[9px] text-rose-400 font-black">● LIVE</span>}</div>
              <div className="text-[9px] text-zinc-500 max-w-[180px] truncate">{s.game || s.title || `#${s.n}`}</div>
              <div className="text-[9px] text-zinc-600">{lengthOf((s.endedAt || Date.now()) - s.startedAt)} · {s.people} {t.streamsPeople || 'people'}</div>
            </button>
          ))}
        </div>
      </div>

      {details && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-3" data-streams-details>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-white">{details.title || details.game || `#${details.n}`}</div>
                  <div className="text-[11px] text-zinc-500">{details.game && details.title ? `${details.game} · ` : ''}{new Date(details.startedAt).toLocaleString()} · {lengthOf((details.endedAt || Date.now()) - details.startedAt)}</div>
                </div>
                {details.vodUrl && <a href={details.vodUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-current-accent hover:underline">VOD <ExternalLink size={10} /></a>}
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-zinc-400">
                <span>{details.messages.toLocaleString()} {t.streamsMessages || 'messages'}</span>
                {details.byPlatform.map((p: any) => <span key={p.platform} style={{ color: PLATFORM_COLOURS[p.platform] }}>{PLATFORM_NAMES[p.platform]} {p.messages.toLocaleString()}</span>)}
              </div>
              <span className={tag}>{t.streamsPace || 'Chat\'s pace, a bar a minute'}</span>
              <PaceChart perMinute={details.perMinute} moments={details.moments} start={details.startedAt} />
            </div>

            <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-3" data-streams-chapters>
              <div className="flex items-center gap-2">
                <Bookmark size={14} className="text-current-accent" />
                <span className={`${tag} flex-1`}>{t.streamsChapters || 'Chapters'}</span>
                <button onClick={copy} disabled={!details.chaptersText} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white disabled:opacity-40" data-streams-copy>
                  {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? (t.streamsCopied || 'Copied') : (t.streamsCopy || 'Copy for YouTube')}
                </button>
              </div>
              {details.chapters.length < 3 && <p className="text-[10px] text-zinc-600">{t.streamsFewChapters || 'YouTube shows chapters from three on — a plan with steps, a change of game or a highlight adds them.'}</p>}
              <div className="space-y-1 font-mono text-[11px]">
                {details.chapters.map((c: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    {c.link ? <a href={c.link} target="_blank" rel="noreferrer" className="text-current-accent hover:underline w-16 shrink-0">{c.time}</a> : <span className="text-zinc-500 w-16 shrink-0">{c.time}</span>}
                    <span className="text-zinc-300 truncate">{c.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {details.moments.length > 0 && (
              <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-2" data-streams-moments>
                <span className={tag}>{t.streamsMoments || 'Moments'}</span>
                {details.moments.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {m.kind === 'highlight' ? <Flame size={12} className="text-orange-400" /> : m.kind === 'clip' ? <Scissors size={12} className="text-purple-400" /> : <Bookmark size={12} className="text-zinc-400" />}
                    <span className="text-zinc-500 w-14">{clock(m.at, details.startedAt)}</span>
                    <span className="text-zinc-300 flex-1 truncate">{m.text || m.kind}</span>
                    {(m.url || m.link) && <a href={m.url || m.link} target="_blank" rel="noreferrer" className="text-current-accent"><ExternalLink size={11} /></a>}
                  </div>
                ))}
              </div>
            )}
            {(details.plan.length > 0 || details.songs.length > 0) && (
              <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-3">
                {details.plan.length > 0 && (
                  <div className="space-y-1">
                    <span className={`${tag} flex items-center gap-1`}><ListChecks size={11} /> {t.streamsPlan || 'The plan'}</span>
                    {details.plan.map((p: any, i: number) => <div key={i} className="text-[11px] text-zinc-300"><span className="text-zinc-500 mr-2">{clock(p.startedAt, details.startedAt)}</span>{withDiscordText(p.text)}</div>)}
                  </div>
                )}
                {details.songs.length > 0 && (
                  <div className="space-y-1" data-streams-songs>
                    <span className={`${tag} flex items-center gap-1`}><Music size={11} /> {details.songs.length === 1 ? (t.streamsOneSong || '1 song') : (t.streamsSongs || '{count} songs').replace('{count}', String(details.songs.length))}</span>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {details.songs.map((s: any, i: number) => <div key={i} className="text-[11px] text-zinc-300 truncate"><span className="text-zinc-500 mr-2">{clock(s.at, details.startedAt)}</span>{s.title}{s.artist ? ` — ${s.artist}` : ''}</div>)}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-2" data-streams-people>
              <span className={`${tag} flex items-center gap-1`}><Users size={11} /> {details.people.length === 1 ? (t.streamsOneWho || '1 person talked') : (t.streamsWho || '{count} people talked').replace('{count}', String(details.people.length))}</span>
              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/60">
                {details.people.map((p: any) => (
                  <div key={p.uid} className="flex items-center gap-2 py-1.5">
                    {p.avatar ? <img src={p.avatar} alt="" className="w-5 h-5 rounded-full" /> : <div className="w-5 h-5 rounded-full bg-zinc-800" />}
                    <span className="text-[11px] text-white flex-1 truncate">{p.name}</span>
                    {p.platforms.map((pl: string) => <span key={pl} className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOURS[pl] }} title={PLATFORM_NAMES[pl]} />)}
                    <span className="text-[10px] font-mono text-zinc-500 w-10 text-right">{p.messages}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
