/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Twitch, beyond chat and alerts: shouting out whoever raids, the Hype Train
 * on stream, clips and stream markers from here or the dock, and the stream
 * schedule that text layers and the Discord posts read "next stream" from.
 *
 * The layers that draw these (Hype Train, Shoutout) are on the Overlays
 * screen; this is where they are set off and tried.
 */
import React, { useState } from 'react';
import { Twitch, Megaphone, TrainFront, Scissors, MapPin, CalendarClock, RefreshCcw, AlertTriangle } from 'lucide-react';
import { CommittedInput } from '../CommittedInput';
import { refusalWords, shoutoutWords } from '../../words';

interface Props {
  settings?: any;
  hype?: any;
  schedule?: { segments?: { start: string; title: string; category: string }[]; next?: any; error?: string | null; fetchedAt?: number | null } | null;
  scopes?: { have: string[]; missing: string[] } | null;
  request: (payload: Record<string, any>) => Promise<any>;
  t: any;
}

const box = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-current-accent';
const tag = 'block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5';
const button = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-40';

/** Which feature each missing permission is for, to say what reconnecting gets back. */
const SCOPE_NAMES: Record<string, [string, string]> = {
  'channel:read:hype_train': ['twitchScopeHype', 'the Hype Train'],
  'moderator:manage:shoutouts': ['twitchScopeShoutout', "Twitch's own shoutouts"],
  'clips:edit': ['twitchScopeClips', 'clips'],
  'channel:manage:broadcast': ['twitchScopeMarkers', 'stream markers'],
};

const Card = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4">
    <div className="flex items-center gap-3">
      <span className="text-[#a970ff]">{icon}</span>
      <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{title}</span>
    </div>
    {children}
  </div>
);

const Check = ({ on, set, text }: { on: boolean; set: (v: boolean) => void; text: string }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-current-accent" />
    <span className="text-[11px] text-zinc-400">{text}</span>
  </label>
);

export const TwitchView = ({ settings, hype, schedule, scopes, request, t }: Props) => {
  const so = settings?.shoutout || {};
  const clip = settings?.clip || {};
  const save = (part: 'shoutout' | 'clip', patch: Record<string, any>) => request({ op: 'settings', settings: { [part]: { ...(part === 'shoutout' ? so : clip), ...patch } } });
  const [target, setTarget] = useState('');
  const [said, setSaid] = useState<Record<string, string>>({});
  const run = async (key: string, payload: Record<string, any>, ok: (r: any) => string) => {
    setSaid((s) => ({ ...s, [key]: '…' }));
    try {
      const r = await request(payload);
      setSaid((s) => ({ ...s, [key]: r?.ok === false ? `✗ ${refusalWords(t, r)}` : ok(r) }));
    } catch (err: any) {
      setSaid((s) => ({ ...s, [key]: `✗ ${refusalWords(t, err)}` }));
    }
  };
  const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const missing = scopes?.missing || [];

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Twitch size={18} className="text-[#a970ff]" />
        <span className="text-[13px] font-black uppercase tracking-widest text-zinc-200">{t.twitchNav || 'Twitch'}</span>
      </div>
      {missing.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4" data-twitch-missing>
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200 leading-relaxed">
            {(t.twitchMissingScopes || 'Log out of Twitch and back in on the Connections screen to allow: {what}. Until then those stay off.')
              .replace('{what}', missing.map((s) => (SCOPE_NAMES[s] ? t[SCOPE_NAMES[s][0]] || SCOPE_NAMES[s][1] : s)).join(', '))}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card icon={<Megaphone size={16} />} title={t.twitchShoutouts || 'Shoutouts'}>
          <Check on={so.onRaid !== false} set={(v) => save('shoutout', { onRaid: v })} text={t.twitchShoutoutOnRaid || 'Shout out whoever raids, as the raid lands'} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={tag}>{t.twitchShoutoutMinViewers || 'Raids of at least'}</span>
              <input type="number" min={0} value={so.minViewers ?? 1} onChange={(e) => save('shoutout', { minViewers: Number(e.target.value) })} className={box} />
            </label>
            <label className="block">
              <span className={tag}>{t.twitchShoutoutCardSeconds || 'Card on stream (s)'}</span>
              <input type="number" min={0} max={60} value={so.cardSeconds ?? 12} onChange={(e) => save('shoutout', { cardSeconds: Number(e.target.value) })} className={box} />
            </label>
          </div>
          <Check on={so.native !== false} set={(v) => save('shoutout', { native: v })} text={t.twitchShoutoutNative || "Twitch's own /shoutout too (their card on Twitch, with a follow button)"} />
          <Check on={so.chat !== false} set={(v) => save('shoutout', { chat: v })} text={t.twitchShoutoutChat || 'Say it in chat'} />
          {so.chat !== false && (
            <label className="block">
              <span className={tag}>{t.twitchShoutoutMessage || 'In chat'}</span>
              <CommittedInput value={so.message || ''} onCommit={(v: string) => save('shoutout', { message: v })} className={box} />
              <span className="block text-[10px] text-zinc-600 mt-1 leading-relaxed">{t.twitchShoutoutMessageHint || '{name}, {login}, {link}, {game}, {title}, {viewers}. With no game to name, the part naming it is left out.'}</span>
            </label>
          )}
          <div className="flex gap-2 items-center pt-1">
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t.twitchShoutoutWho || 'Channel to shout out'} className={box} />
            <button className={button} disabled={!target.trim()} onClick={() => run('so', { op: 'shoutout', target }, (r) => { const how = shoutoutWords(t, r); return `${how.ok ? '✓' : '⚠'} ${r.name}${r.game ? ` · ${r.game}` : ''}${how.ok ? '' : ` — ${how.text}`}`; })} data-twitch-shoutout>
              {t.twitchShoutoutNow || 'Shout out'}
            </button>
          </div>
          {said.so && <p className="text-[10px] text-zinc-500">{said.so}</p>}
          <p className="text-[10px] text-zinc-600 leading-relaxed">{t.twitchShoutoutHint || 'The card shows on a Shoutout layer. For "!so name", add the "Twitch: shout out" step to a command.'}</p>
        </Card>

        <Card icon={<TrainFront size={16} />} title={t.twitchHype || 'Hype Train'}>
          <p className="text-[12px] text-zinc-300" data-twitch-hype-status>
            {hype?.active
              ? (t.twitchHypeRunning || 'Running: level {level}, {pct}% of the way.').replace('{level}', String(hype.level)).replace('{pct}', String(hype.goal ? Math.round((hype.progress / hype.goal) * 100) : 0))
              : hype?.endedAt
                ? (t.twitchHypeLast || 'The last one reached level {level}.').replace('{level}', String(hype.level))
                : (t.twitchHypeNone || 'None this session yet.')}
          </p>
          <button className={button} onClick={() => run('hype', { op: 'test_hype' }, () => t.twitchHypeTestOk || '✓ A test train runs for 20 s on every Hype Train layer.')} data-twitch-hype-test>
            <TrainFront size={12} /> {t.twitchHypeTest || 'Try one on stream'}
          </button>
          {said.hype && <p className="text-[10px] text-zinc-500">{said.hype}</p>}
          <p className="text-[10px] text-zinc-600 leading-relaxed">{t.twitchHypeHint || 'Add a Hype Train layer to a layout to see it. A pixel avatar cheers it on too — the face for it is under its reactions.'}</p>
        </Card>

        <Card icon={<Scissors size={16} />} title={t.twitchClipsMarkers || 'Clips and markers'}>
          <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => run('clip', { op: 'clip' }, (r) => `✓ ${r.url}`)} data-twitch-clip><Scissors size={12} /> {t.twitchClipNow || 'Clip it'}</button>
            <button className={button} onClick={() => run('marker', { op: 'marker' }, (r) => `✓ ${(t.twitchMarkerOk || 'Marker at {at}s').replace('{at}', String(r.at ?? '?'))}`)} data-twitch-marker><MapPin size={12} /> {t.twitchMarkerNow || 'Drop a marker'}</button>
          </div>
          {(said.clip || said.marker) && <p className="text-[10px] text-zinc-500 break-all">{said.clip}{said.clip && said.marker ? ' · ' : ''}{said.marker}</p>}
          <Check on={clip.chat !== false} set={(v) => save('clip', { chat: v })} text={t.twitchClipChat || 'Post a clip made here or from the dock in chat'} />
          {clip.chat !== false && (
            <label className="block">
              <span className={tag}>{t.twitchClipMessage || 'In chat'}</span>
              <CommittedInput value={clip.message || ''} onCommit={(v: string) => save('clip', { message: v })} className={box} />
            </label>
          )}
          <p className="text-[10px] text-zinc-600 leading-relaxed">{t.twitchClipsHint || 'Both need the stream live. They are dock buttons too (Dock Actions → Twitch), and action steps: "Twitch: clip" makes {clip.url} for the steps after it — a Discord post, say — and "Twitch: marker" takes a note, {input} by default.'}</p>
        </Card>

        <Card icon={<CalendarClock size={16} />} title={t.twitchSchedule || 'Stream schedule'}>
          {schedule?.error ? (
            <p className="text-[11px] text-rose-400">{schedule.error}</p>
          ) : (schedule?.segments || []).length === 0 ? (
            <p className="text-[11px] text-zinc-500">{t.twitchScheduleEmpty || 'Nothing on your Twitch schedule. Add streams to it on Twitch (Creator Dashboard → Settings → Stream schedule).'}</p>
          ) : (
            <ul className="space-y-1.5" data-twitch-schedule>
              {(schedule?.segments || []).slice(0, 5).map((s) => (
                <li key={s.start} className={`text-[11px] ${schedule?.next?.start === s.start ? 'text-white font-bold' : 'text-zinc-400'}`}>
                  {when(s.start)}{s.title ? ` — ${s.title}` : ''}{s.category ? ` · ${s.category}` : ''}
                </li>
              ))}
            </ul>
          )}
          <button className={button} onClick={() => run('schedule', { op: 'schedule' }, () => '✓')}><RefreshCcw size={12} /> {t.twitchScheduleRefresh || 'Ask Twitch again'}</button>
          <p className="text-[10px] text-zinc-600 leading-relaxed">{t.twitchScheduleHint || 'The one in white is "next stream". Text layers can show it with {nextStream}, {nextStreamDay}, {nextStreamTime}, {nextStreamIn}, {nextStreamTitle} and {nextStreamGame}; the Discord posts on the Go live screen with {next}, {nextTitle} and {nextGame}. Checked every 15 minutes.'}</p>
        </Card>
      </div>
    </div>
  );
};
