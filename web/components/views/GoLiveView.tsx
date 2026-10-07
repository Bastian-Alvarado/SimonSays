/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Going live, announced in Discord (server/engine/announce.js): where, who to
 * ping, what it says, and what happens to the post when the stream ends —
 * marked over, or turned into a recap of the stream (server/engine/recap.js).
 * Settings save as they change; the tests post for real, now.
 */
import React, { useEffect, useState } from 'react';
import { Megaphone, Send, Loader2, ScrollText, CalendarDays, RefreshCw, Upload, Images, Trash2, Flame, BellRing } from 'lucide-react';
import { Button } from '../Button';
import { textChannels, pingableRoles } from '../DiscordPicks';
import { refusalWords, fill as fillWords } from '../../words';
import { StillImg } from '../StillPicture';

export interface AnnounceSettings {
  enabled: boolean;
  channelId: string;
  roleId: string;
  message: string;
  card: boolean;
  cardColor: string;
  delaySeconds: number;
  whenOver: 'edit' | 'delete' | 'keep';
  overMessage: string;
  youtubeUrl: string;
  tiktokUrl: string;
  recap?: RecapSettings;
  last?: { channelId: string; messageId: string; at: number; test?: boolean } | null;
}

export interface RecapSettings {
  enabled: boolean;
  where: 'edit' | 'new';
  title: string;
  parts: Record<'length' | 'peak' | 'events' | 'chatters' | 'clips' | 'plan' | 'chapters' | 'next', boolean>;
  chatters: number;
}

const RECAP_DEFAULT: RecapSettings = {
  enabled: false, where: 'edit', title: 'Resumen del directo', chatters: 3,
  parts: { length: true, peak: true, events: true, chatters: true, clips: true, plan: true, chapters: true, next: true },
};

export interface HighlightsSettings {
  enabled: boolean; factor: number; minMessages: number; cooldownMin: number; marker: boolean; clip: boolean; channelId: string; quotes: number;
}

export interface ScheduleEventsSettings {
  enabled: boolean;
  count: number;
  description: string;
  cover?: 'none' | 'twitch' | 'picture';
  coverPicture?: string;
  events?: number;
  lastSync?: { at: number; created: number; updated: number; removed: number } | null;
}

interface Props {
  settings?: AnnounceSettings;
  channels: any[];
  roles: any[];
  save: (patch: Partial<AnnounceSettings>) => void;
  test: () => Promise<any>;
  testRecap: () => Promise<any>;
  scheduleEvents?: ScheduleEventsSettings;
  saveScheduleEvents: (patch: Partial<ScheduleEventsSettings>) => void;
  syncScheduleEvents: () => Promise<any>;
  streamsOnSchedule: number;
  listAssets: () => Promise<any[]>;
  uploadAsset: (file: File) => Promise<any>;
  botConnected: boolean;
  highlights?: HighlightsSettings;
  highlightsControl?: (op: string, payload?: Record<string, any>) => Promise<any>;
  liveDms?: any;
  liveDmsControl?: (op: string, payload?: Record<string, any>) => Promise<any>;
  t: any;
}

const box = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent';
const tag = 'text-[9px] font-black uppercase tracking-widest text-zinc-500';

/*
  The moments chat goes wild: every platform's chat counted together, and a
  minute at several times the stream's usual pace is a marker, a clip and (if
  a channel is chosen) a post in Discord. Off until turned on.
*/
const HighlightsPanel = ({ settings, control, channels, botConnected, t }: { settings?: HighlightsSettings; control: (op: string, payload?: any) => Promise<any>; channels: any[]; botConnected: boolean; t: any }) => {
  const h: HighlightsSettings = { enabled: false, factor: 3, minMessages: 15, cooldownMin: 5, marker: true, clip: true, channelId: '', quotes: 4, ...(settings || {}) };
  const [said, setSaid] = useState('');
  const save = (patch: Partial<HighlightsSettings>) => control('settings', { settings: patch }).catch((err: any) => setSaid(refusalWords(t, err) || String(err)));
  const test = async () => {
    setSaid('');
    try { await control('test'); setSaid(t.goLiveTestSent || 'Posted — have a look in Discord.'); } catch (err: any) { setSaid(refusalWords(t, err) || String(err)); }
  };
  return (
    <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4" data-highlights>
      <div className="flex items-center gap-3">
        <Flame size={16} className="text-current-accent" />
        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.highlightsTitle || 'Highlights'}</span>
        <div onClick={() => save({ enabled: !h.enabled })} className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${h.enabled ? 'bg-current-accent' : 'bg-zinc-700'}`} data-highlights-toggle>
          <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${h.enabled ? 'translate-x-5' : ''}`} />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{t.highlightsHint || 'Every platform\'s chat counted together. When a minute runs at several times the stream\'s usual pace, that is a moment: a marker in the VOD, a clip, and a post in Discord with what chat was saying, the song and the plan\'s step. Moments become chapters too.'}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="space-y-1 block"><span className={tag}>{t.highlightsFactor || 'Times the usual pace'}</span>
          <select value={h.factor} onChange={(e) => save({ factor: Number(e.target.value) })} className={box}>
            {[2, 2.5, 3, 4, 5].map((f) => <option key={f} value={f}>×{f}</option>)}
          </select></label>
        <label className="space-y-1 block"><span className={tag}>{t.highlightsMin || 'At least, per minute'}</span>
          <input type="number" min={3} value={h.minMessages} onChange={(e) => save({ minMessages: Number(e.target.value) })} className={box} /></label>
        <label className="space-y-1 block"><span className={tag}>{t.highlightsCooldown || 'Minutes between'}</span>
          <input type="number" min={1} value={h.cooldownMin} onChange={(e) => save({ cooldownMin: Number(e.target.value) })} className={box} /></label>
        <label className="space-y-1 block"><span className={tag}>{t.highlightsQuotes || 'Messages quoted'}</span>
          <input type="number" min={0} max={8} value={h.quotes} onChange={(e) => save({ quotes: Number(e.target.value) })} className={box} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={h.marker} onChange={(e) => save({ marker: e.target.checked })} className="accent-current-accent" /><span className="text-[11px] text-zinc-300">{t.highlightsMarker || 'Marker in the VOD'}</span></label>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={h.clip} onChange={(e) => save({ clip: e.target.checked })} className="accent-current-accent" /><span className="text-[11px] text-zinc-300">{t.highlightsClip || 'A clip'}</span></label>
        <label className="flex items-center gap-2"><span className="text-[11px] text-zinc-400">{t.highlightsPostIn || 'Post in'}</span>
          <select value={h.channelId} onChange={(e) => save({ channelId: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 max-w-[200px]" data-highlights-channel>
            <option value="">{t.highlightsNowhere || 'Nowhere'}</option>
            {textChannels(channels).map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select></label>
        <Button size="sm" icon={<Send size={14} />} onClick={test} disabled={!botConnected} data-highlights-test>{t.highlightsTest || 'Test post'}</Button>
      </div>
      {said && <p className="text-[11px] text-zinc-400">{said}</p>}
    </div>
  );
};

/*
  Going live, told privately: viewers ask with a button on a sign-up post,
  choosing where they watch, and get a direct message with that link when
  the stream starts — instead of the whole server being pinged.
*/
const LiveDmsPanel = ({ state, control, channels, botConnected, t }: { state?: any; control: (op: string, payload?: any) => Promise<any>; channels: any[]; botConnected: boolean; t: any }) => {
  const s = { enabled: false, delaySec: 60, message: '', post: { channelId: '', messageId: '' }, count: 0, last: null, ...(state || {}) };
  const [message, setMessage] = useState(s.message);
  const [channelId, setChannelId] = useState(s.post.channelId);
  const [said, setSaid] = useState('');
  useEffect(() => { setMessage(s.message); }, [s.message]);
  useEffect(() => { setChannelId(s.post.channelId); }, [s.post.channelId]);
  const save = (patch: any) => control('settings', { settings: patch }).catch((err: any) => setSaid(refusalWords(t, err) || String(err)));
  const run = async (op: string, payload?: any) => {
    setSaid('');
    try {
      const r = await control(op, payload);
      setSaid(op === 'post' ? (r?.done === 'updated' ? (t.liveDmsUpdated || 'The sign-up post was updated.') : (t.liveDmsPosted || 'The sign-up post is up.')) : (t.goLiveTestSent || 'Posted — have a look in Discord.'));
    } catch (err: any) { setSaid(refusalWords(t, err) || String(err)); }
  };
  return (
    <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4" data-live-dms>
      <div className="flex items-center gap-3">
        <BellRing size={16} className="text-current-accent" />
        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.liveDmsTitle || 'Told privately'}</span>
        <span className="text-[10px] text-zinc-500" data-live-dms-count>{fillWords(t.liveDmsCount || '{count} signed up', { count: String(s.count || 0) })}</span>
        <div onClick={() => save({ enabled: !s.enabled })} className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${s.enabled ? 'bg-current-accent' : 'bg-zinc-700'}`} data-live-dms-toggle>
          <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${s.enabled ? 'translate-x-5' : ''}`} />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{t.liveDmsHint || 'Viewers press a button on a sign-up post in Discord, choosing where they watch, and get a direct message with that link when you go live — no ping for the whole server. Each message has a button to stop.'}</p>
      <label className="space-y-1 block"><span className={tag}>{t.liveDmsMessage || 'The message'}</span>
        <input value={message} onChange={(e) => setMessage(e.target.value)} onBlur={() => message !== s.message && save({ message })} className={box} />
        <span className="block text-[10px] text-zinc-600">{t.liveDmsVars || '{streamer}, {title}, {game} and {platform} — the link is a button under it.'}</span></label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2"><span className="text-[10px] text-zinc-500">{t.liveDmsDelay || 'Wait after OBS starts (s)'}</span>
          <input type="number" min={0} max={600} value={s.delaySec} onChange={(e) => save({ delaySec: Number(e.target.value) })} className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200" /></label>
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 max-w-[200px]" data-live-dms-channel>
          <option value="">{t.discordSendPickChannel || 'Choose a channel'}</option>
          {textChannels(channels).map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
        </select>
        <Button size="sm" icon={<Send size={14} />} onClick={() => run('post', { channelId })} disabled={!botConnected || !channelId} data-live-dms-post>
          {s.post.messageId && s.post.channelId === channelId ? (t.liveDmsUpdate || 'Update the sign-up post') : (t.liveDmsPost || 'Post the sign-up post')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => run('test')} disabled={!botConnected} data-live-dms-test>{t.liveDmsTest || 'Test message'}</Button>
      </div>
      {s.last && <p className="text-[10px] text-zinc-600">{fillWords(t.liveDmsLast || 'Last stream: {sent} told, {failed} could not be reached.', { sent: String(s.last.sent), failed: String(s.last.failed) })}</p>}
      {said && <p className="text-[11px] text-zinc-400">{said}</p>}
    </div>
  );
};

export const GoLiveView = ({ settings, channels, roles, save, test, testRecap, scheduleEvents, saveScheduleEvents, syncScheduleEvents, streamsOnSchedule, listAssets, uploadAsset, botConnected, highlights, highlightsControl, liveDms, liveDmsControl, t }: Props) => {
  const s: AnnounceSettings = settings || {
    enabled: false, channelId: '', roleId: '', message: '', card: true, cardColor: '#9146ff', delaySeconds: 45, whenOver: 'edit', overMessage: '', youtubeUrl: '', tiktokUrl: '',
  };
  // Typed fields keep their own text until they lose focus, so a keystroke is not a save.
  const [draft, setDraft] = useState({ message: s.message, overMessage: s.overMessage, youtubeUrl: s.youtubeUrl, tiktokUrl: s.tiktokUrl });
  useEffect(() => { setDraft({ message: s.message, overMessage: s.overMessage, youtubeUrl: s.youtubeUrl, tiktokUrl: s.tiktokUrl }); }, [s.message, s.overMessage, s.youtubeUrl, s.tiktokUrl]);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState('');
  const recap: RecapSettings = { ...RECAP_DEFAULT, ...(s.recap || {}), parts: { ...RECAP_DEFAULT.parts, ...(s.recap?.parts || {}) } };
  const saveRecap = (patch: Partial<RecapSettings>) => save({ recap: { ...recap, ...patch } });
  const [recapTitle, setRecapTitle] = useState(recap.title);
  useEffect(() => { setRecapTitle(recap.title); }, [recap.title]);
  const [recapTesting, setRecapTesting] = useState(false);
  const [recapResult, setRecapResult] = useState('');
  const events: ScheduleEventsSettings = { enabled: false, count: 3, description: '', ...(scheduleEvents || {}) };
  const saveEvents = (patch: Partial<ScheduleEventsSettings>) => saveScheduleEvents(patch);
  const [eventsText, setEventsText] = useState(events.description);
  useEffect(() => { setEventsText(events.description); }, [events.description]);
  const [syncing, setSyncing] = useState(false);
  // The cover: choosing from earlier uploads, or uploading one.
  const [pickingCover, setPickingCover] = useState(false);
  const [uploads, setUploads] = useState<any[]>([]);
  useEffect(() => {
    if (pickingCover) listAssets().then((all) => setUploads((all || []).filter((a: any) => a.kind === 'image'))).catch(() => setUploads([]));
  }, [pickingCover]);
  const uploadCover = async (file?: File | null) => {
    if (!file) return;
    try {
      const saved = await uploadAsset(file);
      if (saved?.url) saveEvents({ cover: 'picture', coverPicture: saved.url });
    } catch (err: any) {
      setSyncResult(err?.message || String(err));
    }
  };
  const [syncResult, setSyncResult] = useState('');
  const runSync = async () => {
    setSyncing(true);
    setSyncResult('');
    try {
      const r = await syncScheduleEvents();
      setSyncResult(fillWords(t.scheduleEventsSynced || 'Done: {created} made, {updated} changed, {removed} taken off.', { created: String(r?.created ?? 0), updated: String(r?.updated ?? 0), removed: String(r?.removed ?? 0) }));
    } catch (err: any) {
      setSyncResult(refusalWords(t, err) || String(err));
    } finally {
      setSyncing(false);
    }
  };
  const runRecapTest = async () => {
    setRecapTesting(true);
    setRecapResult('');
    try {
      await testRecap();
      setRecapResult(t.goLiveTestSent || 'Posted — have a look in Discord.');
    } catch (err: any) {
      setRecapResult(refusalWords(t, err) || String(err));
    } finally {
      setRecapTesting(false);
    }
  };

  const commit = (key: keyof typeof draft) => { if (draft[key] !== (s as any)[key]) save({ [key]: draft[key] } as any); };
  const runTest = async () => {
    setTesting(true);
    setResult('');
    try {
      await test();
      setResult(t.goLiveTestSent || 'Posted — have a look in Discord.');
    } catch (err: any) {
      setResult(refusalWords(t, err) || String(err));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Megaphone size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.goLiveNav || 'Go live'}</span>
          <div onClick={() => save({ enabled: !s.enabled })} className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${s.enabled ? 'bg-current-accent' : 'bg-zinc-700'}`} data-go-live-toggle>
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${s.enabled ? 'translate-x-5' : ''}`} />
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {t.goLiveHint || 'When OBS starts streaming, the bot waits for Twitch to show you live, then posts here — your message, a card with the title, game and live picture, and buttons to watch. When the stream stops, the post is marked as over.'}
        </p>
        {!botConnected && <p className="text-[11px] text-amber-400">{t.voiceNoBot || 'The Discord bot is not connected. Connect it on the Connections screen first.'}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className={tag}>{t.goLiveChannel || 'Announce in'}</span>
            <select value={s.channelId} onChange={(e) => save({ channelId: e.target.value })} className={box}>
              <option value="">{t.discordSendPickChannel || 'Choose a channel'}</option>
              {textChannels(channels).map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 block">
            <span className={tag}>{t.goLivePing || 'Ping'}</span>
            <select value={s.roleId} onChange={(e) => save({ roleId: e.target.value })} className={box}>
              <option value="">{t.goLiveNoPing || 'Nobody'}</option>
              <option value="everyone">@everyone</option>
              {pingableRoles(roles).map((r: any) => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </select>
          </label>
        </div>

        <label className="space-y-1 block">
          <span className={tag}>{t.goLiveMessage || 'Message'}</span>
          <textarea value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} onBlur={() => commit('message')} className={`${box} h-20 resize-none`} />
          <span className="block text-[10px] text-zinc-600">{t.goLiveVars || '{role} is the ping, {streamer} your name, {title} and {game} what Twitch says, {link} where to watch.'}</span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s.card} onChange={(e) => save({ card: e.target.checked })} className="accent-current-accent" />
            <span className="text-[11px] text-zinc-300">{t.goLiveCard || 'Card with the title, game and live picture'}</span>
          </label>
          {s.card && (
            <label className="flex items-center gap-2">
              <input type="color" value={s.cardColor} onChange={(e) => save({ cardColor: e.target.value })} className="w-7 h-7 bg-transparent border border-zinc-800 rounded cursor-pointer" />
              <span className="text-[10px] text-zinc-500">{t.discordSendCardColour || 'Card colour'}</span>
            </label>
          )}
          <label className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] text-zinc-500">{t.goLiveDelay || 'Wait after OBS starts (s)'}</span>
            <input type="number" min={0} max={600} value={s.delaySeconds} onChange={(e) => save({ delaySeconds: Number(e.target.value) })} className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200" />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className={tag}>{t.goLiveYouTube || 'YouTube link (optional)'}</span>
            <input value={draft.youtubeUrl} onChange={(e) => setDraft({ ...draft, youtubeUrl: e.target.value })} onBlur={() => commit('youtubeUrl')} placeholder="https://youtube.com/@…/live" className={box} />
          </label>
          <label className="space-y-1 block">
            <span className={tag}>{t.goLiveTikTok || 'TikTok link (optional)'}</span>
            <input value={draft.tiktokUrl} onChange={(e) => setDraft({ ...draft, tiktokUrl: e.target.value })} onBlur={() => commit('tiktokUrl')} placeholder="https://tiktok.com/@…/live" className={box} />
          </label>
        </div>

        <div className="space-y-2">
          <span className={tag}>{t.goLiveWhenOver || 'When the stream ends'}</span>
          <div className="flex flex-wrap gap-2">
            {([
              ['edit', t.goLiveOverEdit || 'Mark the post as over'],
              ['delete', t.goLiveOverDelete || 'Delete the post'],
              ['keep', t.goLiveOverKeep || 'Leave it'],
            ] as const).map(([value, text]) => (
              <button key={value} onClick={() => save({ whenOver: value })} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold ${s.whenOver === value ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>{text}</button>
            ))}
          </div>
          {s.whenOver === 'edit' && (
            <input value={draft.overMessage} onChange={(e) => setDraft({ ...draft, overMessage: e.target.value })} onBlur={() => commit('overMessage')} placeholder={t.goLiveOverPlaceholder || 'The stream is over — thanks for watching!'} className={box} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60">
          <Button size="sm" icon={testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} onClick={runTest} disabled={testing || !s.channelId || !botConnected}>
            {t.goLiveTest || 'Post a test now'}
          </Button>
          <span className="text-[10px] text-zinc-500">{result || (s.last ? `${t.goLiveLast || 'Last post'}: ${new Date(s.last.at).toLocaleString()}${s.last.test ? ` (${t.goLiveTestWord || 'test'})` : ''}` : '')}</span>
        </div>
        <p className="text-[10px] text-zinc-600">{t.goLiveTestHint || 'The test posts for real, with a ping if one is chosen — pick a quiet channel or take the ping off while you try it.'}</p>
      </div>

      {/* The stream recap: what the stream ending posts (server/engine/recap.js). */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5" data-recap>
        <div className="flex items-center gap-3">
          <ScrollText size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.recapTitle || 'Stream recap'}</span>
          <div onClick={() => saveRecap({ enabled: !recap.enabled })} className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${recap.enabled ? 'bg-current-accent' : 'bg-zinc-700'}`} data-recap-toggle>
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${recap.enabled ? 'translate-x-5' : ''}`} />
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {t.recapHint || 'A minute after the stream ends, a card in Discord says how it went: how long, the most watching at once, what viewers did, who talked the most, the clips, the plan as it went, and the next stream — with a button to the VOD.'}
        </p>

        <div className="space-y-2">
          <span className={tag}>{t.recapWhere || 'Where'}</span>
          <div className="flex flex-wrap gap-2">
            {([
              ['edit', t.recapWhereEdit || 'The go-live post becomes the recap'],
              ['new', t.recapWhereNew || 'A post of its own, in the same channel'],
            ] as const).map(([value, text]) => (
              <button key={value} onClick={() => saveRecap({ where: value })} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold ${recap.where === value ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-400 hover:text-white'}`} data-recap-where={value}>{text}</button>
            ))}
          </div>
          {recap.where === 'new' && <p className="text-[10px] text-zinc-600">{t.recapWhereNewHint || 'The go-live post still goes the way "When the stream ends" says.'}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
          <label className="space-y-1 block">
            <span className={tag}>{t.recapHeading || 'Heading'}</span>
            <input value={recapTitle} onChange={(e) => setRecapTitle(e.target.value)} onBlur={() => { if (recapTitle !== recap.title) saveRecap({ title: recapTitle }); }} placeholder="Resumen del directo" className={box} />
          </label>
          <label className="space-y-1 block">
            <span className={tag}>{t.recapChatters || 'Top chatters'}</span>
            <input type="number" min={1} max={10} value={recap.chatters} onChange={(e) => saveRecap({ chatters: Number(e.target.value) })} className={box} />
          </label>
        </div>

        <div className="space-y-2">
          <span className={tag}>{t.recapParts || 'What it says'}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              ['length', t.recapPartLength || 'How long'],
              ['peak', t.recapPartPeak || 'Most watching'],
              ['events', t.recapPartEvents || 'Follows, subs, bits…'],
              ['chatters', t.recapPartChatters || 'Top chatters'],
              ['clips', t.recapPartClips || 'Clips'],
              ['plan', t.recapPartPlan || 'The plan'],
              ['chapters', t.recapPartChapters || 'Chapters (for YouTube)'],
              ['next', t.recapPartNext || 'Next stream'],
            ] as const).map(([key, text]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={recap.parts[key] !== false} onChange={(e) => saveRecap({ parts: { ...recap.parts, [key]: e.target.checked } })} className="accent-current-accent" data-recap-part={key} />
                <span className="text-[11px] text-zinc-300">{text}</span>
              </label>
            ))}
          </div>
          {recap.parts.plan !== false && <p className="text-[10px] text-zinc-600">{t.recapPlanHint || 'With the plan here, the Stream plan screen does not post its own recap as well.'}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60">
          <Button size="sm" icon={recapTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} onClick={runRecapTest} disabled={recapTesting || !botConnected} data-recap-test>
            {t.recapTest || 'Post a test recap'}
          </Button>
          <span className="text-[10px] text-zinc-500">{recapResult}</span>
        </div>
        <p className="text-[10px] text-zinc-600">{t.recapTestHint || 'Built from the stream so far (or the last one), and posted in the test channel set on Welcome & Goodbye — or here, if there is none.'}</p>
      </div>

      {/* The Twitch schedule as Discord events (server/engine/schedule-events.js). */}
      <div className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-5" data-schedule-events>
        <div className="flex items-center gap-3">
          <CalendarDays size={16} className="text-current-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex-1">{t.scheduleEventsTitle || 'Schedule as Discord events'}</span>
          <div onClick={() => saveEvents({ enabled: !events.enabled })} className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${events.enabled ? 'bg-current-accent' : 'bg-zinc-700'}`} data-schedule-events-toggle>
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${events.enabled ? 'translate-x-5' : ''}`} />
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {t.scheduleEventsHint || 'The next streams on your Twitch schedule become events in your Discord server, with the Twitch link. Anyone who presses "Interested" is told by Discord when the stream starts — the event starts when OBS does. A stream moved or cancelled on Twitch moves or goes here too; an event you delete in Discord stays deleted. Everybody in the server can see them.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
          <label className="space-y-1 block">
            <span className={tag}>{t.scheduleEventsCount || 'Next streams'}</span>
            <input type="number" min={1} max={5} value={events.count} onChange={(e) => saveEvents({ count: Number(e.target.value) })} className={box} data-schedule-events-count />
          </label>
          <label className="space-y-1 block">
            <span className={tag}>{t.scheduleEventsDescription || 'What the event says'}</span>
            <textarea value={eventsText} onChange={(e) => setEventsText(e.target.value)} onBlur={() => { if (eventsText !== events.description) saveEvents({ description: eventsText }); }} className={`${box} h-16 resize-none`} />
            <span className="block text-[10px] text-zinc-600">{t.scheduleEventsVars || '{title} and {game} from the schedule, {link} your Twitch.'}</span>
          </label>
        </div>

        <div className="space-y-2" data-schedule-events-cover>
          <span className={tag}>{t.scheduleEventsCover || 'Cover'}</span>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['twitch', t.scheduleEventsCoverTwitch || 'Your Twitch offline image'],
              ['picture', t.scheduleEventsCoverPicture || 'A picture'],
              ['none', t.scheduleEventsCoverNone || 'None'],
            ] as const).map(([value, text]) => (
              <button key={value} onClick={() => saveEvents({ cover: value })} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold ${(events.cover || 'twitch') === value ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-400 hover:text-white'}`} data-schedule-events-cover-choice={value}>{text}</button>
            ))}
            {events.cover === 'picture' && (
              <>
                {events.coverPicture && <StillImg src={events.coverPicture} width={90} alt="" className="h-9 w-[90px] object-cover rounded border border-zinc-800" />}
                <label className="p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer" title={t.voicePicUpload || 'Upload'}>
                  <Upload size={12} />
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { uploadCover(e.target.files?.[0]); e.currentTarget.value = ''; }} />
                </label>
                <button onClick={() => setPickingCover(!pickingCover)} className="p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white" title={t.voicePicChoose || 'Choose an upload'}><Images size={12} /></button>
                {events.coverPicture && <button onClick={() => saveEvents({ coverPicture: '' })} className="p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-rose-400"><Trash2 size={12} /></button>}
              </>
            )}
          </div>
          {events.cover === 'picture' && pickingCover && (
            <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto">
              {uploads.length === 0 && <span className="col-span-6 text-[10px] text-zinc-600">{t.voicePicNoUploads || 'Nothing uploaded yet. Use the upload button.'}</span>}
              {uploads.map((a) => (
                <button key={a.url} onClick={() => { saveEvents({ coverPicture: a.url }); setPickingCover(false); }} className="aspect-video rounded border border-zinc-800 hover:border-current-accent overflow-hidden">
                  <StillImg src={a.url} width={96} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-zinc-600">{t.scheduleEventsCoverHint || 'Across the top of each event in Discord. Wide pictures fit best; PNG, JPEG, GIF or WebP.'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60">
          <Button size="sm" icon={syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} onClick={runSync} disabled={syncing || !events.enabled || !botConnected} data-schedule-events-sync>
            {t.scheduleEventsSync || 'Follow the schedule now'}
          </Button>
          <span className="text-[10px] text-zinc-500" data-schedule-events-status>
            {syncResult || (events.lastSync
              ? fillWords(t.scheduleEventsLast || '{events} events in Discord · last checked {when}', { events: String(events.events ?? 0), when: new Date(events.lastSync.at).toLocaleString() })
              : `${streamsOnSchedule} ${t.scheduleEventsOnSchedule || 'streams on your Twitch schedule'}`)}
          </span>
        </div>
      </div>

      {liveDmsControl && <LiveDmsPanel state={liveDms} control={liveDmsControl} channels={channels} botConnected={botConnected} t={t} />}

      {highlightsControl && <HighlightsPanel settings={highlights} control={highlightsControl} channels={channels} botConnected={botConnected} t={t} />}
    </div>
  );
};
