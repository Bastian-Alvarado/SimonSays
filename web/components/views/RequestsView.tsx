/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Game requests: the Discord channel where people suggest what to play, as a
 * board by votes. Put one in tonight's plan with a press; when that step
 * starts, whoever asked is told and given points. From
 * server/engine/game-requests.js.
 */
import React, { useState } from 'react';
import { Gamepad2, ListPlus, CheckCircle2, X, Undo2, Download, Loader2, Trash2 } from 'lucide-react';
import { textChannels } from '../DiscordPicks';
import { refusalWords, fill } from '../../words';
import { withDiscordText, type DiscordNames } from '../../discordEmoji';

interface Request { id: string; text: string; user: string; discordId: string; at: number; votes: number; status: 'open' | 'planned' | 'played' | 'dismissed'; planItemId?: string; playedAt?: number; names?: DiscordNames }
interface Props {
  state?: { settings: { channelId: string; ranking: boolean; playedPoints: number; tell: boolean }; requests: Request[] };
  control: (op: string, payload?: Record<string, any>) => Promise<any>;
  channels: { id: string; name: string; type: number }[];
  botConnected: boolean;
  t: any;
}

const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';
const smallButton = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-40';

export const RequestsView = ({ state, control, channels, botConnected, t }: Props) => {
  const s = state?.settings || { channelId: '', ranking: false, playedPoints: 100, tell: true };
  const requests = state?.requests || [];
  const [busy, setBusy] = useState('');
  const [said, setSaid] = useState('');
  const [show, setShow] = useState<'todo' | 'all'>('todo');
  const run = async (op: string, payload: Record<string, any> = {}, ok?: (r: any) => string) => {
    setBusy(`${op}:${payload.id || ''}`);
    setSaid('');
    try { const r = await control(op, payload); if (ok) setSaid(ok(r)); } catch (err: any) { setSaid(refusalWords(t, err) || String(err?.message || err)); } finally { setBusy(''); }
  };
  const shown = show === 'todo' ? requests.filter((r) => r.status === 'open' || r.status === 'planned') : requests;
  const statusName: Record<string, string> = { open: t.requestsOpen || 'Waiting', planned: t.requestsPlanned || 'In the plan', played: t.requestsPlayed || 'Played', dismissed: t.requestsDismissed || 'Set aside' };

  return (
    <div className="animate-fade-in space-y-6 pb-20" data-requests>
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Gamepad2 size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.requestsNav || 'Game requests'}</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">{t.requestsHint || 'A Discord channel where people suggest what to play, as a board by votes: the bot puts 👍 under each post so voting is one click. Put one in tonight\'s plan with a press; when that step starts, whoever asked is told in Discord and given points.'}</p>
        <div className="flex flex-wrap items-center gap-3">
          <select value={s.channelId} onChange={(e) => run('settings', { settings: { channelId: e.target.value } })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 max-w-[240px]" data-requests-channel>
            <option value="">{t.requestsPickChannel || 'The requests channel…'}</option>
            {textChannels(channels).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select>
          <button onClick={() => run('read', {}, (r) => fill(t.requestsRead || 'Read {count} requests from the channel.', { count: r?.read ?? 0 }))} disabled={!s.channelId || !botConnected || !!busy} className={smallButton} data-requests-read>
            {busy === 'read:' ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} {t.requestsReadButton || 'Read the channel'}
          </button>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">{t.requestsPoints || 'Points when played'}
            <input type="number" min={0} value={s.playedPoints} onChange={(e) => run('settings', { settings: { playedPoints: Number(e.target.value) } })} className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white text-right" /></label>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-zinc-400"><input type="checkbox" checked={s.tell} onChange={(e) => run('settings', { settings: { tell: e.target.checked } })} className="accent-current-accent" /> {t.requestsTell || 'Tell them in Discord'}</label>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-zinc-400"><input type="checkbox" checked={s.ranking} onChange={(e) => run('settings', { settings: { ranking: e.target.checked } })} className="accent-current-accent" /> {t.requestsRanking || 'A ranking in the channel'}</label>
        </div>
        {said && <p className="text-[11px] text-zinc-400" data-requests-said>{said}</p>}
      </div>

      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-3" data-requests-board>
        <div className="flex items-center gap-2">
          <span className={`${tag} flex-1`}>{shown.length === 1 ? (t.requestsOne || '1 request') : fill(t.requestsCount || '{count} requests', { count: shown.length })}</span>
          <button onClick={() => setShow(show === 'todo' ? 'all' : 'todo')} className={smallButton}>{show === 'todo' ? (t.requestsShowAll || 'Show played and set aside') : (t.requestsShowTodo || 'Only the ones to play')}</button>
        </div>
        {shown.length === 0 && <p className="text-[11px] text-zinc-600 italic">{t.requestsNone || 'No requests yet.'}</p>}
        <div className="divide-y divide-zinc-800/60">
          {shown.map((r) => (
            <div key={r.id} className={`flex items-center gap-3 py-2.5 ${r.status === 'played' || r.status === 'dismissed' ? 'opacity-50' : ''}`} data-request={r.id}>
              <div className="w-10 text-center shrink-0">
                <div className="text-sm font-black text-white">{r.votes}</div>
                <div className="text-[9px]">👍</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white break-words">{withDiscordText(r.text, undefined, r.names)}</div>
                <div className="text-[10px] text-zinc-500">{r.user} · {new Date(r.at).toLocaleDateString()} · <span className={r.status === 'planned' ? 'text-current-accent' : ''}>{statusName[r.status]}</span></div>
              </div>
              {r.status === 'open' && (
                <>
                  <button onClick={() => run('plan', { id: r.id, where: 'next' }, () => t.requestsPlannedNext || 'Added as the next thing in the plan.')} disabled={!!busy} className={smallButton} title={t.requestsPlanNextHint || 'Straight after what is on now'} data-request-plan-next><ListPlus size={11} /> {t.requestsPlanNext || 'Next'}</button>
                  <button onClick={() => run('plan', { id: r.id }, () => t.requestsPlannedEnd || 'Added at the end of the plan.')} disabled={!!busy} className={smallButton} data-request-plan><ListPlus size={11} /> {t.requestsPlanEnd || 'To the plan'}</button>
                </>
              )}
              {(r.status === 'open' || r.status === 'planned') && (
                <>
                  <button onClick={() => run('played', { id: r.id }, () => t.requestsMarkedPlayed || 'Played — they were told.')} disabled={!!busy} className={smallButton} title={t.requestsPlayedHint || 'Played without the plan'} data-request-played><CheckCircle2 size={11} /></button>
                  <button onClick={() => run('dismiss', { id: r.id })} disabled={!!busy} className={smallButton} title={t.requestsDismiss || 'Set aside'}><X size={11} /></button>
                </>
              )}
              {r.status === 'dismissed' && <button onClick={() => run('reopen', { id: r.id })} className={smallButton} title={t.requestsReopen || 'Back on the board'}><Undo2 size={11} /></button>}
              {(r.status === 'played' || r.status === 'dismissed') && <button onClick={() => run('remove', { id: r.id })} className={smallButton} title={t.requestsRemove || 'Forget it'}><Trash2 size={11} /></button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
