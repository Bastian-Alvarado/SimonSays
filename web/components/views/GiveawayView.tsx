/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Giveaways screen (server/engine/giveaway.js): set one up — the prize,
 * the word to type, how long, how many win, who may enter — run it, draw it,
 * and see who is in. Entered from every chat, and from a button in Discord
 * when it is posted there; drawn live on the Giveaway layer.
 */
import React, { useEffect, useState } from 'react';
import { Gift, Play, Square, Shuffle, RotateCcw, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '../Button';
import { textChannels } from '../DiscordPicks';
import { refusalWords } from '../../words';

const PLATFORMS: [string, string][] = [['twitch', 'Twitch'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['kick', 'Kick'], ['discord', 'Discord']];
const box = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent';
const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';

interface Props {
  giveaway: any;
  settings: any;
  control: (op: string, value?: any) => Promise<any>;
  channels: any[];
  roles: any[];
  botConnected: boolean;
  t: any;
}

export const GiveawayView = ({ giveaway, settings, control, channels, roles, botConnected, t }: Props) => {
  const g = giveaway || { mode: 'idle', count: 0, entrants: [], winners: [], byPlatform: {}, draft: {} };
  const d = g.draft || {};
  const rules = d.rules || { subsOnly: false, minLevel: 0, subLuck: 1, discordRole: '', platforms: PLATFORMS.map(([p]) => p) };
  const s = settings || { announce: true, postToDiscord: false, discordChannelId: '', autoDraw: false };
  const [prize, setPrize] = useState(d.prize || '');
  const [keyword, setKeyword] = useState(d.keyword || '!sorteo');
  useEffect(() => { setPrize(d.prize || ''); }, [d.prize]);
  useEffect(() => { setKeyword(d.keyword || '!sorteo'); }, [d.keyword]);
  const [busy, setBusy] = useState('');
  const [said, setSaid] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (g.mode !== 'open' || !g.endsAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [g.mode, g.endsAt]);

  const draft = (value: any) => control('setDraft', value).catch(() => {});
  const setRules = (patch: any) => draft({ rules: { ...rules, ...patch } });
  const run = async (op: string, value?: any) => {
    setBusy(op);
    setSaid('');
    try {
      await control(op, value);
    } catch (err: any) {
      setSaid(refusalWords(t, err) || String(err));
    } finally {
      setBusy('');
    }
  };
  const left = g.endsAt ? Math.max(0, Math.round((g.endsAt - now) / 1000)) : null;
  const stateWord: Record<string, string> = {
    idle: t.giveawayIdle || 'Nothing running',
    open: t.giveawayOpenNow || 'Open — taking entries',
    closed: t.giveawayClosedNow || 'Entries closed — ready to draw',
    drawn: t.giveawayDrawnNow || 'Drawn',
  };
  const icon = (node: React.ReactNode, op: string) => (busy === op ? <Loader2 size={14} className="animate-spin" /> : node);

  return (
    <div className="animate-fade-in space-y-6 pb-20" data-giveaway-view>
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Gift size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.giveawayNav || 'Giveaways'}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${g.mode === 'open' ? 'bg-emerald-500/15 text-emerald-300' : g.mode === 'idle' ? 'bg-zinc-800 text-zinc-500' : 'bg-amber-500/15 text-amber-300'}`} data-giveaway-mode={g.mode}>
            {stateWord[g.mode] || g.mode}{left !== null && g.mode === 'open' ? ` · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''}
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {t.giveawayHint || 'Viewers enter by typing the word in any chat — Twitch, YouTube, TikTok, Kick or Discord — or with the button on the Discord post. The draw runs on the Giveaway layer: a reel of names that stops on the winner, then chat and Discord are told.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
          <label className="space-y-1 block">
            <span className={tag}>{t.giveawayPrize || 'Prize'}</span>
            <input value={prize} onChange={(e) => setPrize(e.target.value)} onBlur={() => { if (prize !== d.prize) draft({ prize }); }} placeholder="Un juego de Steam" className={box} data-giveaway-field="prize" />
          </label>
          <label className="space-y-1 block">
            <span className={tag}>{t.giveawayKeyword || 'Word to type'}</span>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onBlur={() => { if (keyword !== d.keyword) draft({ keyword }); }} className={box} data-giveaway-field="keyword" />
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="space-y-1 block">
            <span className={tag}>{t.giveawayMinutes || 'Minutes (0: until closed)'}</span>
            <input type="number" min={0} max={120} value={Math.round((d.durationMs || 0) / 60000)} onChange={(e) => draft({ durationMs: Number(e.target.value) * 60000 })} className={box} data-giveaway-field="minutes" />
          </label>
          <label className="space-y-1 block">
            <span className={tag}>{t.giveawayWinners || 'Winners'}</span>
            <input type="number" min={1} max={10} value={d.winnersCount || 1} onChange={(e) => draft({ winnersCount: Number(e.target.value) })} className={box} />
          </label>
          <label className="space-y-1 block">
            <span className={tag}>{t.giveawayMinLevel || 'Lowest level'}</span>
            <input type="number" min={0} max={500} value={rules.minLevel || 0} onChange={(e) => setRules({ minLevel: Number(e.target.value) })} className={box} />
          </label>
          <label className="space-y-1 block">
            <span className={tag}>{t.giveawaySubLuck || 'Tickets for subs'}</span>
            <input type="number" min={1} max={5} value={rules.subLuck || 1} onChange={(e) => setRules({ subLuck: Number(e.target.value) })} className={box} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={rules.subsOnly === true} onChange={(e) => setRules({ subsOnly: e.target.checked })} className="accent-current-accent" data-giveaway-field="subsOnly" />
            <span className="text-[11px] text-zinc-300">{t.giveawaySubsOnly || 'Subscribers only'}</span>
          </label>
          {PLATFORMS.map(([p, name]) => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={(rules.platforms || []).includes(p)} onChange={(e) => setRules({ platforms: e.target.checked ? [...(rules.platforms || []), p] : (rules.platforms || []).filter((x: string) => x !== p) })} className="accent-current-accent" data-giveaway-platform={p} />
              <span className="text-[11px] text-zinc-400">{name}</span>
            </label>
          ))}
        </div>
        <label className="space-y-1 block max-w-sm">
          <span className={tag}>{t.giveawayDiscordRole || 'Discord entrants need the role'}</span>
          <select value={rules.discordRole || ''} onChange={(e) => setRules({ discordRole: e.target.value })} className={box}>
            <option value="">{t.giveawayAnyRole || 'Any'}</option>
            {(roles || []).filter((r: any) => r.name !== '@everyone' && !r.managed).map((r: any) => <option key={r.id} value={r.id}>@{r.name}</option>)}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60">
          <Button size="sm" icon={icon(<Play size={14} />, 'open')} onClick={() => run('open', { prize, keyword })} disabled={Boolean(busy) || g.mode === 'open'} data-giveaway-action="open">{t.giveawayOpen || 'Open'}</Button>
          <Button size="sm" variant="secondary" icon={icon(<Square size={14} />, 'close')} onClick={() => run('close')} disabled={Boolean(busy) || g.mode !== 'open'} data-giveaway-action="close">{t.giveawayClose || 'Stop entries'}</Button>
          <Button size="sm" icon={icon(<Shuffle size={14} />, 'draw')} onClick={() => run('draw')} disabled={Boolean(busy) || g.mode === 'idle' || g.mode === 'drawn'} data-giveaway-action="draw">{t.giveawayDraw || 'Draw'}</Button>
          <Button size="sm" variant="secondary" icon={icon(<RotateCcw size={14} />, 'reroll')} onClick={() => run('reroll')} disabled={Boolean(busy) || g.mode !== 'drawn'} data-giveaway-action="reroll">{t.giveawayReroll || 'Draw again'}</Button>
          <Button size="sm" variant="danger" icon={icon(<Trash2 size={14} />, 'reset')} onClick={() => run('reset')} disabled={Boolean(busy) || g.mode === 'idle'} data-giveaway-action="reset">{t.giveawayReset || 'Clear'}</Button>
          <span className="text-[10px] text-amber-400" data-giveaway-said>{said}</span>
        </div>
      </div>

      {g.mode !== 'idle' && (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4" data-giveaway-live>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-black text-white tabular-nums" data-giveaway-count>{g.count}</span>
            <span className="text-[11px] text-zinc-500">{t.giveawayEntered || 'entered'}{g.tickets > g.count ? ` · ${g.tickets} ${t.giveawayTickets || 'tickets'}` : ''}</span>
            <span className="flex flex-wrap gap-1.5 ml-auto">
              {Object.entries(g.byPlatform || {}).map(([p, n]) => <span key={p} className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">{PLATFORMS.find(([x]) => x === p)?.[1] || p} {String(n)}</span>)}
            </span>
          </div>
          {(g.winners || []).length > 0 && (
            <div className="space-y-1" data-giveaway-winners>
              <span className={tag}>{(g.winners || []).length === 1 ? (t.giveawayWinner || 'Winner') : (t.giveawayWinnersNow || 'Winners')}</span>
              <div className="flex flex-wrap gap-2">
                {g.winners.map((w: any) => <span key={w.key} className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-200 text-xs font-black">🎉 {w.name} <span className="opacity-60 font-bold">· {PLATFORMS.find(([x]) => x === w.platform)?.[1] || w.platform}</span></span>)}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <span className={tag}>{t.giveawayWhoIsIn || 'Who is in'}</span>
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
              {(g.entrants || []).map((e: any) => (
                <span key={e.key} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-300" data-giveaway-entrant={e.key}>
                  {e.name}{e.tickets > 1 ? ` ×${e.tickets}` : ''}
                  <span className="text-[9px] text-zinc-600">{PLATFORMS.find(([x]) => x === e.platform)?.[1] || e.platform}</span>
                  <button onClick={() => run('remove', e.key)} title={t.giveawayRemove || 'Take out'} className="p-0.5 text-zinc-600 hover:text-red-400"><X size={11} /></button>
                </span>
              ))}
              {!g.entrants?.length && <span className="text-[11px] text-zinc-600">{t.giveawayNobodyYet || 'Nobody yet.'}</span>}
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4" data-giveaway-settings>
        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.giveawaySettings || 'Around it'}</span>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s.announce !== false} onChange={(e) => control('settings', { announce: e.target.checked })} className="accent-current-accent" />
            <span className="text-[11px] text-zinc-300">{t.giveawayAnnounce || 'Say it in Twitch chat when it opens and who won'}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s.autoDraw === true} onChange={(e) => control('settings', { autoDraw: e.target.checked })} className="accent-current-accent" />
            <span className="text-[11px] text-zinc-300">{t.giveawayAutoDraw || 'Draw when the time runs out'}</span>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s.postToDiscord === true} onChange={(e) => control('settings', { postToDiscord: e.target.checked })} className="accent-current-accent" data-giveaway-post />
            <span className="text-[11px] text-zinc-300">{t.giveawayPostDiscord || 'Post it in Discord with a button to enter'}</span>
          </label>
          {s.postToDiscord && (
            <select value={s.discordChannelId || ''} onChange={(e) => control('settings', { discordChannelId: e.target.value })} className={box} disabled={!botConnected}>
              <option value="">{t.discordSendPickChannel || 'Choose a channel'}</option>
              {textChannels(channels).map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          )}
        </div>
        <p className="text-[10px] text-zinc-600">{t.giveawayPostHint || 'The post says the prize and how to enter, closes when entries stop, and names the winner once the draw has played on stream. Discord winners are pinged.'}</p>
      </div>
    </div>
  );
};
