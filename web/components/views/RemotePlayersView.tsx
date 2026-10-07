/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Remote players: four seats for people playing from their own homes, each
 * with a link of its own that brings their game into OBS through VDO.Ninja
 * (server/engine/remote-players.js).
 *
 * Set up once: the button makes the four browser sources in OBS and points
 * the 4 Players layouts at them. After that a game night is choosing who is
 * in each seat, sending them their link, and the director's buttons while it
 * runs — mute a seat, reload a picture that froze, swap two seats, or empty
 * one, which also makes its old link stop working.
 */
import React, { useState } from 'react';
import { Cast, Copy, Check, Send, FlaskConical, Volume2, VolumeX, RotateCw, UserX, ArrowLeftRight, Wrench, Maximize2 } from 'lucide-react';
import { Button } from '../Button';
import { CallPersonSelect } from '../CallPersonSelect';
import { QUALITY_IDS, DEFAULT_QUALITY } from '../../../shared/remote-players.js';
import { refusalWords, fill } from '../../words';
import { copyText } from '../../utils';

interface Seat {
  n: number;
  name: string;
  discordId: string;
  quality: string;
  source: string;
  invite: string;
  muted: boolean;
  /** The streamer's own seat. */
  me?: boolean;
  status: { state: string; label?: string; width?: number; height?: number; fps?: number; at?: number };
}

interface Props {
  remote: { seats: Seat[]; scene: string; target: string; setupAt: number; me?: { seat: number; source: string }; onScreen?: number } | undefined;
  control: (op: string, payload?: Record<string, any>) => Promise<any>;
  obsConnected: boolean;
  /** OBS's sources by name, for the streamer's own capture. */
  obsSources: string[];
  discordConnected: boolean;
  voice: any;
  regulars: { name?: string; discordId?: string }[];
  listServerMembers?: () => Promise<{ id: string; name: string }[]>;
  t: any;
}

const LIGHT: Record<string, string> = {
  live: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]',
  connecting: 'bg-amber-400',
  waiting: 'bg-amber-400',
  off: 'bg-rose-500',
  unknown: 'bg-zinc-600',
  me: 'bg-sky-400',
};

const field = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-current-accent';

export const RemotePlayersView = ({ remote, control, obsConnected, obsSources, discordConnected, voice, regulars, listServerMembers, t }: Props) => {
  const seats = remote?.seats || [];
  const ready = Boolean(remote?.setupAt);
  const mine = remote?.me || { seat: 0, source: '' };
  const [busy, setBusy] = useState('');
  const [said, setSaid] = useState<Record<string, string>>({});
  const [setupResult, setSetupResult] = useState<any>(null);
  const [copied, setCopied] = useState(0);

  const say = (key: string, words: string) => setSaid((prev) => ({ ...prev, [key]: words }));
  const run = async (key: string, op: string, payload: Record<string, any> = {}, done = '') => {
    setBusy(key);
    say(key, '');
    try {
      const out = await control(op, payload);
      if (done) say(key, done);
      return out;
    } catch (err: any) {
      say(key, refusalWords(t, err) || String(err?.message || err));
      return null;
    } finally {
      setBusy('');
    }
  };

  const setup = async () => {
    const out = await run('setup', 'setup');
    if (out) setSetupResult(out);
  };

  const statusWords = (s: Seat) => {
    if (s.me) return mine.source ? fill(t.remoteMeStatus || 'You play here, shown with {source}', { source: mine.source }) : (t.remoteMeNoSource || 'You play here — choose your capture above');
    if (!ready) return t.remoteNotSetUp || 'Not set up in OBS yet';
    if (!obsConnected) return t.remoteObsOff || 'OBS is not connected';
    const st = s.status || { state: 'unknown' };
    if (st.state === 'live') {
      const size = st.width && st.height ? ` · ${st.width}×${st.height}` : '';
      const fps = st.fps ? ` · ${st.fps} fps` : '';
      return `${t.remoteLive || 'Sending'}${size}${fps}`;
    }
    if (st.state === 'connecting') return t.remoteConnecting || 'Connecting…';
    if (st.state === 'waiting') return t.remoteWaiting || 'Waiting for the player';
    if (st.state === 'off') return t.remotePageOff || 'Its page is not running in OBS';
    return st.at ? (t.remoteNoVdo || 'VDO.Ninja cannot be reached') : (t.remoteChecking || 'Checking…');
  };
  const light = (s: Seat) => (s.me ? LIGHT.me : ready && obsConnected ? LIGHT[s.status?.state] || LIGHT.unknown : LIGHT.unknown);

  const doneWords: Record<string, string> = {
    created: t.remoteSourceCreated || 'made',
    updated: t.remoteSourceUpdated || 'already there, brought up to date',
    added: t.remoteSourceAdded || 'added to the scene',
    other_kind: t.remoteSourceOtherKind || 'a source by that name is something else — rename it in OBS and try again',
    failed: t.remoteSourceFailed || 'could not be made',
  };
  const qualityWords: Record<string, string> = {
    '1080p60': t.remoteQuality1080p60 || '1080p, 60 fps — a fast connection',
    '720p60': t.remoteQuality720p60 || '720p, 60 fps — recommended',
    '720p30': t.remoteQuality720p30 || '720p, 30 fps',
    '360p30': t.remoteQuality360p30 || '360p, 30 fps — a slow connection',
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20" data-remote-players>
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Cast size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.remotePlayersNav || 'Remote players'}</span>
          <div className="ml-auto">
            <Button size="sm" variant={ready ? 'secondary' : 'primary'} icon={<Wrench size={14} />} onClick={setup} disabled={!obsConnected || busy === 'setup'} data-remote-setup>
              {ready ? (t.remoteSetupAgain || 'Set up again') : (t.remoteSetup || 'Set up in OBS')}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {t.remoteIntro || 'Each seat has a link of its own. The player opens it in Chrome or Edge, presses Share screen and picks the game window; their game arrives in OBS through VDO.Ninja, free and straight from their computer to yours. A link stays the same from one game night to the next.'}
        </p>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {!obsConnected ? (t.remoteSetupNeedsObs || 'Connect OBS to set this up.')
            : fill(t.remoteSetupHint || 'Makes four browser sources, Player 1 to 4, in the scene “{scene}”, and points every layout made for remote players at them: layouts with two to four source slots that are all empty. A slot already showing something is left alone.', { scene: remote?.target || remote?.scene || '—' })}
        </p>
        {said.setup && <p className="text-[10px] text-rose-400">{said.setup}</p>}

        {/* The streamer's own seat: their capture goes in its slot instead of a remote player. */}
        <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-zinc-800/60" data-remote-me>
          <label className="space-y-1 block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.remoteMeSeat || 'You play in'}</span>
            <select value={mine.seat} onChange={(e) => run('me', 'me', { seat: Number(e.target.value) })} className={field} data-remote-me-seat>
              <option value={0}>{t.remoteMeNobody || 'Nobody — I am only commenting'}</option>
              {seats.map((o) => <option key={o.n} value={o.n}>{o.source}</option>)}
            </select>
          </label>
          <label className="space-y-1 block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.remoteMeSource || 'Your capture'}</span>
            <select value={mine.source} onChange={(e) => run('me', 'me', { source: e.target.value })} className={field} data-remote-me-source>
              <option value="">{t.remoteMeSourcePick || 'Choose an OBS source'}</option>
              {mine.source && !obsSources.includes(mine.source) && <option value={mine.source}>{mine.source} {t.remoteMeMissing || '(not in OBS)'}</option>}
              {obsSources.filter((n) => !/^Player [1-9]$/.test(n)).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <p className="sm:col-span-2 text-[10px] text-zinc-600 leading-relaxed">
            {t.remoteMeHint || 'Your seat shows your own capture instead of a remote player, wherever a layout has that seat. Choose “only commenting” and the seat goes back to a remote player.'}
          </p>
          {said.me && <p className="sm:col-span-2 text-[10px] text-rose-400">{said.me}</p>}
        </div>
        {setupResult && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 space-y-1 text-[10px] text-zinc-400" data-remote-setup-result>
            {(setupResult.sources || []).map((x: any) => (
              <p key={x.n}><span className="font-bold text-zinc-200">{x.source}</span>: {doneWords[x.done] || x.done}{x.error ? ` (${x.error})` : ''}</p>
            ))}
            <p>
              {setupResult.layouts?.live?.length || setupResult.layouts?.profiles
                ? fill(t.remoteLayoutsWired || 'Layouts now showing the seats: {live}; changed in {profiles} saved profile(s) too.', { live: setupResult.layouts.live.join(', ') || '—', profiles: setupResult.layouts.profiles || 0 })
                : (t.remoteLayoutsNone || 'No layout needed changing: the ones made for remote players already show the seats.')}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {seats.map((s) => {
          const key = (what: string) => `${what}-${s.n}`;
          return (
            <div key={s.n} className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3 min-w-0" data-remote-seat={s.n} data-state={s.status?.state}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${light(s)}`} />
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-200">{s.source}</span>
                <span className="text-[10px] text-zinc-500 truncate" data-remote-status>{statusWords(s)}</span>
                {/* Whose game the "Player on screen" boxes show: the Gameplay layouts' game, full screen. */}
                <button
                  onClick={() => run(key('screen'), 'onscreen', { n: s.n })}
                  disabled={busy === key('screen')}
                  title={t.remoteOnScreenHint || 'Show this seat in every “Player on screen” box: the game in the Gameplay layouts, full screen'}
                  className={`ml-auto shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-widest ${remote?.onScreen === s.n ? 'border-current-accent bg-current-accent/10 text-current-accent' : 'border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600'}`}
                  data-remote-on-screen={remote?.onScreen === s.n ? 'true' : 'false'}
                >
                  <Maximize2 size={10} /> {remote?.onScreen === s.n ? (t.remoteOnScreenNow || 'On screen') : (t.remoteOnScreenPut || 'Put on screen')}
                </button>
              </div>
              {said[key('screen')] && <p className="text-[10px] text-rose-400">{said[key('screen')]}</p>}

              <div className="grid grid-cols-2 gap-2">
                {!s.me && <label className="space-y-1 block">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.remoteWhoDiscord || 'From Discord'}</span>
                  <CallPersonSelect
                    value={s.discordId}
                    onChange={(id, name) => run(key('who'), 'set', { n: s.n, discordId: id, ...(id && name ? { name } : {}) })}
                    voice={voice}
                    regulars={regulars}
                    listServerMembers={listServerMembers}
                    emptyLabel={t.remoteNobody || 'Nobody'}
                    className={field}
                    t={t}
                  />
                </label>}
                <label className="space-y-1 block">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.remoteName || 'Name on stream'}</span>
                  <input
                    key={`${s.n}|${s.name}`}
                    defaultValue={s.name}
                    maxLength={40}
                    placeholder={s.source}
                    onBlur={(e) => { if (e.target.value.trim() !== s.name) run(key('who'), 'set', { n: s.n, name: e.target.value }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className={field}
                    data-remote-name
                  />
                </label>
              </div>

              {!s.me && <>
              <label className="space-y-1 block">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.remoteQuality || 'Picture'}</span>
                <select value={s.quality || DEFAULT_QUALITY} onChange={(e) => run(key('who'), 'set', { n: s.n, quality: e.target.value })} className={field} data-remote-quality>
                  {QUALITY_IDS.map((q: string) => <option key={q} value={q}>{qualityWords[q] || q}</option>)}
                </select>
              </label>

              <div className="space-y-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.remoteLink || 'Their link'}</span>
                <div className="flex gap-1.5">
                  <input readOnly value={s.invite} onFocus={(e) => e.target.select()} className={`${field} font-mono text-[10px] text-zinc-400`} data-remote-link />
                  <Button
                    size="sm" variant="secondary"
                    icon={copied === s.n ? <Check size={14} /> : <Copy size={14} />}
                    onClick={() => { if (copyText(s.invite)) { setCopied(s.n); setTimeout(() => setCopied(0), 1500); } }}
                    title={t.remoteCopy || 'Copy'}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="sm" icon={<Send size={14} />}
                    disabled={!discordConnected || !s.discordId || busy === key('invite')}
                    onClick={() => run(key('invite'), 'invite', { n: s.n }, t.remoteInviteSent || 'Sent by direct message.')}
                    data-remote-invite
                  >
                    {t.remoteInvite || 'Send by Discord DM'}
                  </Button>
                  <Button
                    size="sm" variant="ghost" icon={<FlaskConical size={14} />}
                    disabled={!discordConnected || busy === key('invite')}
                    onClick={() => run(key('invite'), 'invite', { n: s.n, test: true }, t.remoteTestSent || 'A sample is in the test channel.')}
                    title={t.remoteTestHint || 'The same message, posted in the test channel instead'}
                  >
                    {t.remoteTest || 'Test'}
                  </Button>
                </div>
              </div>
              </>}

              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-800/60">
                {!s.me && <>
                <Button
                  size="sm" variant={s.muted ? 'danger' : 'secondary'}
                  icon={s.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  disabled={!ready || !obsConnected}
                  onClick={() => run(key('do'), 'mute', { n: s.n, muted: !s.muted })}
                  data-remote-mute
                >
                  {s.muted ? (t.remoteUnmute || 'Unmute') : (t.remoteMute || 'Mute')}
                </Button>
                <Button
                  size="sm" variant="secondary" icon={<RotateCw size={14} />}
                  disabled={!ready || !obsConnected}
                  onClick={() => run(key('do'), 'reload', { n: s.n }, t.remoteReloaded || 'Reloaded.')}
                  title={t.remoteReloadHint || 'Load the seat’s page in OBS again, for a picture that froze'}
                >
                  {t.remoteReload || 'Reload'}
                </Button>
                </>}
                <label className="flex items-center gap-1 text-zinc-500" title={t.remoteSwapHint || 'The two seats change places, people and links both'}>
                  <ArrowLeftRight size={14} />
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) run(key('do'), 'swap', { a: s.n, b: Number(e.target.value) }); }}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-1.5 py-1 text-[10px] text-zinc-300 outline-none"
                    data-remote-swap
                  >
                    <option value="">{t.remoteSwap || 'Swap with…'}</option>
                    {seats.filter((o) => o.n !== s.n).map((o) => (
                      <option key={o.n} value={o.n}>{o.source}{o.name ? ` — ${o.name}` : ''}</option>
                    ))}
                  </select>
                </label>
                {!s.me && <Button
                  size="sm" variant="ghost" icon={<UserX size={14} />}
                  className="ml-auto text-rose-400"
                  onClick={() => {
                    if (window.confirm(fill(t.remoteKickConfirm || 'Empty {seat}? Whoever is in it is disconnected, and its old link stops working: it gets a new one.', { seat: s.source }))) run(key('do'), 'kick', { n: s.n });
                  }}
                  data-remote-kick
                >
                  {t.remoteKick || 'Kick'}
                </Button>}
              </div>
              {[said[key('who')], said[key('invite')], said[key('do')]].filter(Boolean).map((w, i) => (
                <p key={i} className="text-[10px] text-zinc-400">{w}</p>
              ))}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed px-2">
        {t.remoteSoundHint || 'Game sound only comes through when the player shares a whole screen or a browser tab with “Share audio” ticked; a single window sends picture only. Their voice is best left to the Discord call.'}
      </p>
    </div>
  );
};
