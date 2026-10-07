
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState, useMemo, useEffect } from 'react';
import { LevelProfile, LevelSystemConfig, RoleReward, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { Trophy, Settings, Gift, Medal, User, Save, RefreshCcw, Trash2, Plus, Hash, Shield, Info, AlertTriangle, MessageSquare, ArrowRight, History } from 'lucide-react';

interface LevelsViewProps {
  activeTheme: ThemeConfig;
  t: any;
  system: any;
}

/*
  How long people are kept. History is counts, not messages — a few hundred
  bytes a person — so keeping everybody forever is the default; the choice is
  for a channel with a great many one-time visitors.
*/
const HistoryPanel = ({ settings, history, t, panelClass }: { settings: any; history: (op: string, payload?: any) => Promise<any>; t: any; panelClass: string }) => {
  const months = Number(settings?.forgetAfterMonths || 0);
  const [stats, setStats] = useState<any>(null);
  const [armed, setArmed] = useState(false);
  const [said, setSaid] = useState('');
  const refresh = () => history('stats').then(setStats).catch(() => setStats(null));
  useEffect(() => { refresh(); }, [months, settings?.lastPrune?.at]);
  const choose = async (next: number) => {
    setSaid('');
    try { await history('settings', { settings: { forgetAfterMonths: next } }); } catch (err: any) { setSaid(err?.message || String(err)); }
  };
  const forgetNow = async () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false);
    try {
      const r = await history('prune');
      setSaid((t.historyForgot || 'Forgot {count} people.').replace('{count}', String(r?.people ?? 0)));
      refresh();
    } catch (err: any) { setSaid(err?.message || String(err)); }
  };
  const would = months ? (stats?.wouldForget?.[months] ?? 0) : 0;
  return (
    <div className={`glass-panel p-8 rounded-[40px] border ${panelClass} space-y-5 animate-fade-in`} data-history-panel>
      <div className="flex items-center gap-3">
        <History className="text-current-accent" size={20} />
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300">{t.historyTitle || 'Viewer history'}</h3>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{t.historyHint || 'Everybody who talks has a history: the streams they came to, their messages on each platform, what they gave and the giveaways they won. It is counts, not messages — a few hundred bytes a person.'}</p>
      {stats && <p className="text-[11px] text-zinc-400" data-history-stats>{(t.historyStats || '{people} people known · {withHistory} with history so far').replace('{people}', String(stats.people)).replace('{withHistory}', String(stats.withHistory))}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.historyForget || 'Forget people not seen for'}</span>
        <select value={months} onChange={(e) => choose(Number(e.target.value))} className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white" data-history-months>
          <option value={0}>{t.historyForever || 'Never — keep everybody'}</option>
          {[3, 6, 12].map((m) => <option key={m} value={m}>{(t.historyMonths || '{count} months').replace('{count}', String(m))}</option>)}
        </select>
      </div>
      <p className="text-[10px] text-zinc-600 leading-relaxed">{t.historyWho || 'Only people with a single account, linked to nothing, with no points to spend. Their XP goes with them. Checked once a day.'}</p>
      {months > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-amber-400" data-history-would>{(t.historyWould || '{count} people would be forgotten now.').replace('{count}', String(would))}</span>
          {would > 0 && (
            <button onClick={forgetNow} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20" data-history-forget-now>
              <Trash2 size={11} /> {armed ? (t.historySure || 'Press again to forget them') : (t.historyForgetNow || 'Forget them now')}
            </button>
          )}
        </div>
      )}
      {settings?.lastPrune && <p className="text-[10px] text-zinc-600">{(t.historyLast || 'Last time: {count} people forgotten, {date}.').replace('{count}', String(settings.lastPrune.people)).replace('{date}', new Date(settings.lastPrune.at).toLocaleDateString())}</p>}
      {said && <p className="text-[11px] text-zinc-300">{said}</p>}
    </div>
  );
};

/*
  "!perfil": a person's level, points, streams and accounts — a picture in
  Discord, a line in the other chats. The preview is the person at the top of
  the board, drawn by the server as Discord will get it.
*/
const ProfilePanel = ({ settings, profileCard, t, panelClass }: { settings: any; profileCard: (op: string, payload?: any) => Promise<any>; t: any; panelClass: string }) => {
  const s = { enabled: true, word: '!perfil', accent: '#9146ff', youtube: true, ...(settings || {}) };
  const [word, setWord] = useState(s.word);
  const [preview, setPreview] = useState<{ image: string; name: string; line?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setWord(s.word); }, [s.word]);
  const save = (patch: any) => profileCard('settings', { settings: patch }).catch(() => {});
  const show = async () => {
    setBusy(true);
    try { setPreview(await profileCard('preview')); } catch { setPreview(null); } finally { setBusy(false); }
  };
  return (
    <div className={`glass-panel p-8 rounded-[40px] border ${panelClass} space-y-5 animate-fade-in`} data-profile-panel>
      <div className="flex items-center gap-3">
        <User className="text-current-accent" size={20} />
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300 flex-1">{t.profileTitle || 'Profile card'}</h3>
        <div onClick={() => save({ enabled: !s.enabled })} className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${s.enabled ? 'bg-current-accent' : 'bg-zinc-700'}`} data-profile-toggle>
          <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${s.enabled ? 'translate-x-5' : ''}`} />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{t.profileHint || 'Anybody can ask for their profile — or somebody else\'s by name — in any chat: level, place, points, streams, streak and every account they have linked. In Discord it is a picture; Twitch, YouTube and TikTok get a line. The shop in Discord has a "Mi perfil" button too.'}</p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.profileWord || 'Word'}</span>
          <input value={word} onChange={(e) => setWord(e.target.value)} onBlur={() => word !== s.word && save({ word })} className="w-28 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono" /></label>
        <label className="flex items-center gap-2"><input type="color" value={s.accent} onChange={(e) => save({ accent: e.target.value })} className="w-7 h-7 bg-transparent border border-zinc-800 rounded cursor-pointer" /><span className="text-[10px] text-zinc-500">{t.profileAccent || 'Colour'}</span></label>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={s.youtube} onChange={(e) => save({ youtube: e.target.checked })} className="accent-current-accent" /><span className="text-[11px] text-zinc-400">{t.profileYoutube || 'Answer on YouTube too'}</span></label>
        <button onClick={show} disabled={busy} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-zinc-300 hover:text-white" data-profile-preview-button>{busy ? '…' : (t.profilePreview || 'Preview')}</button>
      </div>
      {preview?.image && (
        <div className="space-y-2" data-profile-preview>
          <img src={preview.image} alt="" className="rounded-xl max-w-full border border-zinc-800" />
          {preview.line && <p className="text-[11px] text-zinc-400 font-mono">{preview.line}</p>}
        </div>
      )}
      {preview && !preview.image && <p className="text-[11px] text-zinc-500 italic">{t.profileNobody || 'Nobody has XP yet to preview.'}</p>}
    </div>
  );
};

const getXpForLevel = (level: number) => {
    // Inverse of: Math.floor(0.1 * Math.sqrt(xp))
    // level = 0.1 * sqrt(xp)  ->  level * 10 = sqrt(xp)  ->  (level * 10)^2 = xp
    if (level <= 0) return 0;
    return Math.pow(level * 10, 2);
};

export const LevelsView: React.FC<LevelsViewProps> = ({ activeTheme, t, system }) => {
  const { leaderboard, xpConfig, discordRoles } = system.data;
  const { updateXpConfig, resetXp, fetchDiscordRoles, fetchDiscordChannels } = system.actions;
  const { discordChannels, discordGuildId } = system.connections; 
  const { discord: discordStatus } = system.status;

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'config' | 'rewards'>('leaderboard');
  const [configForm, setConfigForm] = useState<LevelSystemConfig>(xpConfig);
  const [isDirty, setIsDirty] = useState(false);

  // Sync internal form state when global config updates (unless dirty)
  useEffect(() => {
      if (!isDirty) setConfigForm(xpConfig);
  }, [xpConfig, isDirty]);

  // Fetch roles and channels if connected but missing
  useEffect(() => {
      if (discordStatus === 'connected' && discordGuildId) {
          if (!discordRoles || discordRoles.length === 0) {
              fetchDiscordRoles(discordGuildId);
          }
          if (!discordChannels || discordChannels.length === 0) {
              fetchDiscordChannels(discordGuildId);
          }
      }
  }, [discordStatus, discordGuildId, discordRoles, discordChannels, fetchDiscordRoles, fetchDiscordChannels]);

  // "!rank" and "!top": filled in for a config saved before they existed (the server's own defaults).
  const levelChat = { enabled: true, rankWord: '!rank', topWord: '!top', rankText: '', topText: '', topCount: 5, youtube: true, ...(configForm.chat || {}) };

  const handleConfigChange = (key: keyof LevelSystemConfig, value: any) => {
      setConfigForm(prev => ({ ...prev, [key]: value }));
      setIsDirty(true);
  };

  const saveConfig = () => {
      updateXpConfig(configForm);
      setIsDirty(false);
  };

  // --- Rewards Management ---
  const addReward = () => {
      const newReward: RoleReward = { level: 1, roleId: '' };
      const newRewards = [...(configForm.roleRewards || []), newReward];
      handleConfigChange('roleRewards', newRewards);
  };

  const removeReward = (index: number) => {
      const newRewards = [...configForm.roleRewards];
      newRewards.splice(index, 1);
      handleConfigChange('roleRewards', newRewards);
  };

  const updateReward = (index: number, field: keyof RoleReward, value: any) => {
      const newRewards = [...configForm.roleRewards];
      newRewards[index] = { ...newRewards[index], [field]: value };
      
      // Update cached name if roleId changes
      if (field === 'roleId') {
          const role = discordRoles?.find((r:any) => r.id === value);
          if (role) newRewards[index].roleName = role.name;
      }
      handleConfigChange('roleRewards', newRewards);
  };

  // Render Rank Badge
  const renderRankBadge = (rank: number) => {
      if (rank === 1) return <div className="w-8 h-8 rounded-full bg-yellow-500 text-black flex items-center justify-center font-black shadow-lg shadow-yellow-500/50"><Trophy size={16} /></div>;
      if (rank === 2) return <div className="w-8 h-8 rounded-full bg-zinc-400 text-black flex items-center justify-center font-black shadow-lg shadow-zinc-400/50"><Medal size={16} /></div>;
      if (rank === 3) return <div className="w-8 h-8 rounded-full bg-orange-700 text-white flex items-center justify-center font-black shadow-lg shadow-orange-700/50"><Medal size={16} /></div>;
      return <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center font-bold font-mono text-xs">#{rank}</div>;
  };

  return (
    <div className="animate-fade-in space-y-8 pb-20">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
            
            
            <div className="flex gap-2">
                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                    <button onClick={() => setActiveTab('leaderboard')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'leaderboard' ? 'bg-current-accent text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        {t.leaderboard}
                    </button>
                    <button onClick={() => setActiveTab('rewards')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'rewards' ? 'bg-current-accent text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        {t.roleRewards}
                    </button>
                    <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-current-accent text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        {t.xpConfig}
                    </button>
                </div>
            </div>
        </div>

        {/* --- LEADERBOARD TAB --- */}
        {activeTab === 'leaderboard' && (
            <div className={`glass-panel p-0 rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} overflow-hidden min-h-[500px] flex flex-col`}>
                <div className="p-6 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/20">
                    <div className="flex items-center gap-3">
                        <Trophy className="text-yellow-500" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300">Top Users</h3>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">
                        Total Ranked: {leaderboard.length}
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-20 text-zinc-600">
                            <p className="text-sm font-bold">{t.noLeaderboard}</p>
                        </div>
                    ) : (
                        leaderboard.map((profile: LevelProfile, idx: number) => {
                            const currentLevelXp = getXpForLevel(profile.level);
                            const nextLevelXp = getXpForLevel(profile.level + 1);
                            const progress = Math.min(100, Math.max(0, ((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));
                            
                            return (
                                <div key={(profile as any).id || profile.userId || idx} className="flex items-center gap-4 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl hover:bg-zinc-800/50 transition-colors group animate-slide-up">
                                    <div className="shrink-0">
                                        {renderRankBadge(idx + 1)}
                                    </div>
                                    
                                    <div className="shrink-0 relative">
                                        {profile.avatar ? (
                                            <img src={profile.avatar} className="w-12 h-12 rounded-xl object-cover border border-zinc-700" alt="" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-600">
                                                <User size={20} />
                                            </div>
                                        )}
                                        <div className="absolute -bottom-2 -right-2 bg-zinc-950 border border-zinc-700 text-xs font-black px-1.5 rounded-md text-white min-w-[24px] text-center">
                                            {profile.level}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h4 className="font-bold text-white truncate">{profile.username}</h4>
                                            <span className="text-[10px] font-mono text-zinc-500">
                                                {profile.xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                                            <div 
                                                className="h-full bg-gradient-to-r from-current-accent to-purple-500 transition-all duration-500" 
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        )}

        {/* --- CONFIG TAB --- */}
        {activeTab === 'config' && (
            <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} space-y-8 animate-fade-in`}>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Rates */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-2 border-b border-zinc-800">
                            <Settings className="text-zinc-400" size={18} />
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Rates & Limits</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500 flex justify-between">
                                    <span>{t.xpRate}</span>
                                    <span className="text-white">{configForm.xpRate}x</span>
                                </label>
                                <input type="range" min="0.1" max="5" step="0.1" value={configForm.xpRate} onChange={(e) => handleConfigChange('xpRate', parseFloat(e.target.value))} className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-current-accent" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500">{t.minMaxXp}</label>
                                <div className="flex gap-4 items-center">
                                    <input type="number" value={configForm.minXp} onChange={(e) => handleConfigChange('minXp', parseInt(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white text-center" />
                                    <span className="text-zinc-600">-</span>
                                    <input type="number" value={configForm.maxXp} onChange={(e) => handleConfigChange('maxXp', parseInt(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white text-center" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500 flex justify-between">
                                    <span>{t.cooldown}</span>
                                    <span className="text-white">{configForm.cooldown}s</span>
                                </label>
                                <input type="range" min="0" max="300" step="5" value={configForm.cooldown} onChange={(e) => handleConfigChange('cooldown', parseInt(e.target.value))} className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                            </div>
                        </div>
                    </div>

                    {/* Messages & Channels */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-2 border-b border-zinc-800">
                            <MessageSquare className="text-zinc-400" size={18} />
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Announcements</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500">{t.levelUpMsg}</label>
                                <textarea 
                                    value={configForm.levelUpMessage} 
                                    onChange={(e) => handleConfigChange('levelUpMessage', e.target.value)} 
                                    className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white focus:border-current-accent outline-none resize-none"
                                    placeholder="Congrats {user} on level {level}!"
                                />
                                <div className="flex gap-2">
                                    {['{user}', '{level}'].map(v => (
                                        <button key={v} onClick={() => handleConfigChange('levelUpMessage', configForm.levelUpMessage + v)} className="text-[9px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 hover:text-white">{v}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500">{t.announceChannel}</label>
                                <select 
                                    value={configForm.announceChannelId || ''} 
                                    onChange={(e) => handleConfigChange('announceChannelId', e.target.value || null)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                                    disabled={!discordChannels}
                                >
                                    <option value="">Current Channel (Context)</option>
                                    {discordChannels?.map((c:any) => (
                                        <option key={c.id} value={c.id}>#{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* "!rank" and "!top", answered in the chat they were asked in */}
                    <div className="space-y-4" data-level-chat>
                        <div className="flex items-center gap-3 pb-2 border-b border-zinc-800">
                            <MessageSquare className="text-zinc-400" size={18} />
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">{t.levelChatTitle || 'In chat'}</h3>
                            <button
                                onClick={() => handleConfigChange('chat', { ...levelChat, enabled: !levelChat.enabled })}
                                className={`ml-auto text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${levelChat.enabled ? 'border-current-accent text-current-accent' : 'border-zinc-800 text-zinc-500'}`}
                                data-level-chat-on={levelChat.enabled ? 'true' : 'false'}
                            >
                                {levelChat.enabled ? (t.switchOn || 'On') : (t.switchOff || 'Off')}
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">{t.levelChatHint || 'Answered where it is asked: Twitch (as your bot), YouTube, or the Discord channel it was typed in. "!rank Ana" asks about someone else.'}</p>
                        <div className="grid grid-cols-[110px_1fr] gap-2 items-center">
                            <input value={levelChat.rankWord} onChange={(e) => handleConfigChange('chat', { ...levelChat, rankWord: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none" data-level-chat-field="rankWord" />
                            <input value={levelChat.rankText} onChange={(e) => handleConfigChange('chat', { ...levelChat, rankText: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none" data-level-chat-field="rankText" />
                            <input value={levelChat.topWord} onChange={(e) => handleConfigChange('chat', { ...levelChat, topWord: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none" data-level-chat-field="topWord" />
                            <input value={levelChat.topText} onChange={(e) => handleConfigChange('chat', { ...levelChat, topText: e.target.value })} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none" data-level-chat-field="topText" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {['{user}', '{level}', '{xp}', '{rank}', '{total}', '{next}', '{count}', '{top}'].map((v) => (
                                <span key={v} className="text-[9px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 font-mono">{v}</span>
                            ))}
                        </div>
                        <label className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-zinc-500">
                            <span>{t.levelChatTopCount || 'How many !top names'}</span>
                            <input type="number" min={1} max={10} value={levelChat.topCount} onChange={(e) => handleConfigChange('chat', { ...levelChat, topCount: Number(e.target.value) })} className="w-16 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1.5 text-xs font-bold text-white text-center" />
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input type="checkbox" checked={levelChat.youtube} onChange={(e) => handleConfigChange('chat', { ...levelChat, youtube: e.target.checked })} className="mt-0.5 accent-current-accent" data-level-chat-youtube />
                            <span className="text-[10px] text-zinc-400 leading-relaxed">{t.levelChatYoutube || "Answer on YouTube too. Each answer uses 50 of YouTube's 10,000 daily units."}</span>
                        </label>
                    </div>

                    {/* Discord channels where talking earns nothing */}
                    <div className="space-y-4" data-level-ignored>
                        <div className="flex items-center gap-3 pb-2 border-b border-zinc-800">
                            <Hash className="text-zinc-400" size={18} />
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">{t.ignoredChannels || 'Ignored Channels'}</h3>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">{t.levelIgnoredHint || 'Talking anywhere in your Discord server earns XP, except in the channels picked here.'}</p>
                        <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                            {(discordChannels || []).filter((c: any) => c.type === 0 || c.type === 5).map((c: any) => {
                                const off = (configForm.ignoredChannelIds || []).includes(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => handleConfigChange('ignoredChannelIds', off ? configForm.ignoredChannelIds.filter((id) => id !== c.id) : [...(configForm.ignoredChannelIds || []), c.id])}
                                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${off ? 'bg-red-500/10 border-red-500/60 text-red-300 line-through' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}
                                        data-level-ignored-channel={c.id}
                                    >
                                        #{c.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="flex justify-between items-center pt-6 border-t border-zinc-800">
                    <Button variant="danger" size="sm" onClick={resetXp} icon={<Trash2 size={14} />}>
                        {t.resetXp}
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setConfigForm(xpConfig)} disabled={!isDirty}>Cancel</Button>
                        <Button onClick={saveConfig} disabled={!isDirty} icon={<Save size={16} />}>Save Configuration</Button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'config' && system.actions.profileCard && (
            <ProfilePanel settings={(system.data as any).profileCard} profileCard={system.actions.profileCard} t={t} panelClass={`${activeTheme.borderClass} ${activeTheme.panelClass}`} />
        )}

        {activeTab === 'config' && system.actions.history && (
            <HistoryPanel settings={(system.data as any).historySettings} history={system.actions.history} t={t} panelClass={`${activeTheme.borderClass} ${activeTheme.panelClass}`} />
        )}

        {/* --- REWARDS TAB --- */}
        {activeTab === 'rewards' && (
            <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} space-y-6 animate-fade-in`}>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <Gift className="text-pink-500" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300">{t.roleRewards}</h3>
                    </div>
                    {isDirty && <Button size="sm" onClick={saveConfig} icon={<Save size={14} />}>Save Changes</Button>}
                </div>

                {!discordGuildId || discordStatus !== 'connected' ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center">
                        <AlertTriangle className="text-amber-500 mx-auto mb-2" size={24} />
                        <p className="text-xs text-amber-200">{t.connectDiscordFirst}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {configForm.roleRewards?.map((reward, idx) => (
                            <div key={idx} className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 animate-slide-up group">
                                <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Level</span>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="100" 
                                        value={reward.level} 
                                        onChange={(e) => updateReward(idx, 'level', parseInt(e.target.value))}
                                        className="w-12 bg-transparent text-center font-black text-white outline-none border-b border-transparent focus:border-current-accent"
                                    />
                                </div>
                                
                                <div className="text-zinc-600"><ArrowRight size={16}/></div>

                                <div className="flex-1 relative">
                                    <select 
                                        value={reward.roleId} 
                                        onChange={(e) => updateReward(idx, 'roleId', e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-current-accent appearance-none"
                                    >
                                        <option value="">Select Role...</option>
                                        {discordRoles?.map((r:any) => (
                                            <option key={r.id} value={r.id} style={{color: r.color ? `#${r.color.toString(16)}` : undefined}}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500"><Shield size={12}/></div>
                                </div>

                                <button onClick={() => removeReward(idx)} className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}

                        <button onClick={addReward} className="w-full py-3 border border-dashed border-zinc-700 rounded-xl text-zinc-500 text-xs font-bold hover:text-white hover:border-zinc-500 transition-all flex items-center justify-center gap-2">
                            <Plus size={16} /> {t.addReward}
                        </button>
                    </div>
                )}
            </div>
        )}

    </div>
  );
};
