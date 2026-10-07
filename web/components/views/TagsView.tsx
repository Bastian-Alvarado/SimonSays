
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState } from 'react';
import { AppView, StreamTags, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { AlertTriangle, Coins, Heart, Monitor, RefreshCcw, Star, Trophy, Users, Check, UploadCloud } from 'lucide-react';

const TwitchIcon = ({ size = 24, className = "" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></svg>
);
const TikTokIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
);

interface TagsViewProps {
  streamTags: StreamTags;
  tagOutputs: Record<string, string>;
  setTagOutputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fetchTwitchTags: () => void;
  /** Resolves with { files, configured, sources, failed } describing what landed. */
  syncTagOutputs?: () => Promise<any>;
  obsStatus: 'disconnected' | 'connecting' | 'connected';
  obsData: any;
  setView: (view: AppView) => void;
  activeTheme: ThemeConfig;
  t: any;
}

export const TagsView: React.FC<TagsViewProps> = ({
  streamTags,
  tagOutputs,
  setTagOutputs,
  fetchTwitchTags,
  syncTagOutputs,
  obsStatus,
  obsData,
  setView,
  activeTheme,
  t
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ text: string; ok: boolean } | null>(null);

  const handleSync = async () => {
    if (!syncTagOutputs || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await syncTagOutputs();
      // Report what actually landed rather than just "done", which would be a
      // lie when OBS is disconnected or a chosen source has since been renamed.
      if (!r?.configured) {
        setSyncResult({ text: t.syncNoOutputs, ok: false });
      } else if (!r.attempted) {
        // Sources are chosen but every one of those tags is still empty, so
        // there was genuinely nothing to push. Not a failure.
        setSyncResult({ text: t.syncNothingToSend, ok: false });
      } else {
        setSyncResult({
          text: `${r.sources}/${r.attempted}`,
          ok: r.sources === r.attempted,
        });
      }
    } catch (err: any) {
      setSyncResult({ text: err?.message || 'failed', ok: false });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 6000);
    }
  };

  return (
    <div className="animate-fade-in space-y-12">
      <div className="flex justify-end items-center mb-4">
        
        <div className="flex items-center gap-3">
          {syncResult && (
            <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${syncResult.ok ? 'text-green-500' : 'text-amber-500'}`}>
              {syncResult.ok ? <Check size={12} /> : <AlertTriangle size={12} />} {syncResult.text}
            </span>
          )}
          <Button
            variant="secondary"
            icon={<UploadCloud size={18} />}
            onClick={handleSync}
            disabled={syncing}
            title={t.syncOutputsHint}
          >
            {syncing ? t.syncing : t.syncOutputs}
          </Button>
          <Button icon={<RefreshCcw size={18} />} onClick={fetchTwitchTags} title="Force refresh from API">{t.refreshData}</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[{ title: t.latestFollower, dataKey: 'latestFollower', outputKey: 'latestFollower', Icon: Heart, colorClass: 'text-zinc-400' }, { title: t.latestSubscriber, dataKey: 'latestSubscriber', outputKey: 'latestSubscriber', Icon: Star, colorClass: 'text-zinc-400' }, { title: t.latestDonation, dataKey: 'latestDonation', outputKey: 'latestDonation', Icon: Coins, colorClass: 'text-zinc-400' }, { title: t.topDonation, dataKey: 'topDonation', outputKey: 'topDonation', Icon: Trophy, colorClass: 'text-yellow-500', bgGradient: 'bg-gradient-to-br from-yellow-500/5 to-transparent' }, { title: t.latestRaid, dataKey: 'latestRaid', outputKey: 'latestRaid', Icon: Users, colorClass: 'text-orange-500' }].map((card, idx) => {
          const data = streamTags[card.dataKey as keyof StreamTags];
          const selectedSource = tagOutputs[card.outputKey] || '';
          return (<div key={idx} className={`glass-panel p-6 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} flex flex-col relative overflow-hidden group ${card.bgGradient || ''}`}> <div className={`absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500 ${card.colorClass}`}> <card.Icon size={100} /> </div> <div className="flex items-center justify-between mb-6 z-10"> <div className={`p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800 ${card.colorClass}`}> <card.Icon size={24} /> </div> {data && (<div className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2"> {data.platform === 'twitch' ? <TwitchIcon size={14} className="text-[#9146FF]" /> : <TikTokIcon size={14} className="text-[#ff0050]" />} </div>)} </div> <div className="z-10 mb-6 flex-1"> <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">{card.title}</h3> <div className={`text-2xl font-black uppercase tracking-tight truncate ${data ? 'text-white' : 'text-zinc-600'}`}> {data ? data.user : '---'} </div> {data?.amount && (<div className={`text-sm font-bold font-mono ${card.dataKey === 'topDonation' ? 'text-yellow-500' : 'text-current-accent'}`}> {data.amount} {data.currency} </div>)} </div> <div className="h-px bg-zinc-800 w-full mb-4 z-10"></div> <div className="z-10 space-y-3"> <div className="flex items-center gap-2"> <Monitor size={12} className="text-zinc-500" /> <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">OBS Text Output</span> </div> {obsStatus !== 'connected' ? (<div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3"> <div className="flex items-center gap-2 mb-2 text-amber-500"> <AlertTriangle size={14} /> <span className="text-[10px] font-bold uppercase">No OBS Connection</span> </div> <Button size="sm" variant="secondary" className="w-full h-8 text-[9px]" onClick={() => setView('gallery')}> Connect OBS </Button> </div>) : (<select value={selectedSource} onChange={(e) => setTagOutputs(prev => ({ ...prev, [card.outputKey]: e.target.value }))} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 focus:border-current-accent outline-none"> <option value="">-- Select Text Source --</option> {obsData.sources.filter((s: any) => s.inputKind?.includes('text') || s.unversionedInputKind?.includes('text')).map((s: any) => (<option key={s.inputName} value={s.inputName}>{s.inputName}</option>))} {obsData.sources.filter((s: any) => s.inputKind?.includes('text') || s.unversionedInputKind?.includes('text')).length === 0 && (<optgroup label="All Sources"> {obsData.sources.map((s: any) => <option key={s.inputName} value={s.inputName}>{s.inputName}</option>)} </optgroup>)} </select>)} </div> </div>);
        })}
      </div>
    </div>
  );
};
