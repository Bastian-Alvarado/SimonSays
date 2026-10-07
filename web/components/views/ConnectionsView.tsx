
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState, useEffect } from 'react';
import { Button } from '../Button';
import { ThemeConfig, RelayConfig, SpotifyState } from '../../types';
import { AlertTriangle, Bot, Copy, ExternalLink, Info, LogOut, Mic, Monitor, Wifi, WifiOff, X, ToggleRight, ToggleLeft, Hash, Server, Camera } from 'lucide-react';
import { SpotifyIcon } from '../SpotifyPlayer';
import { spotifyRedirectUri, youtubeRedirectUri, copyText } from '../../utils';

const TwitchIcon = ({ size = 24, className = "" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></svg>
);
const TikTokIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
);
const DiscordIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6034.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
  </svg>
);


/**
 * What a platform needs registering before its login will work.
 *
 * Every one of these asks you to register a redirect URL on its developer
 * portal, and the value is not something to guess: it is the address this page
 * was opened at. Getting it wrong produces a rejection at the end of the login
 * flow rather than at the start, which is a miserable way to find out. It was
 * only ever written to the browser console, where nobody was looking.
 */
const DevPortalSetup = ({ href, redirectUri, accent, t }: {
  href: string;
  redirectUri: string;
  accent: string;
  t: any;
}) => {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    copyText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-3 bg-black/30 rounded-xl p-3 border border-white/5 text-left">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.redirectToRegister}</span>
        <button
          onClick={copy}
          className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors shrink-0"
        >
          {copied ? t.copied : t.copyIt}
        </button>
      </div>
      <code className="text-[10px] font-mono break-all block" style={{ color: accent }}>{redirectUri}</code>
      <p className="text-[9px] text-zinc-600 leading-relaxed mt-2">{t.redirectExactHint}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-bold mt-2 inline-flex items-center gap-1 hover:underline"
        style={{ color: accent }}
      >
        {t.openDevPortal} <ExternalLink size={10} />
      </a>
    </div>
  );
};

interface ConnectionsViewProps {
  /** DroidCam is an address on the LAN, not an account, so it carries no token. */
  droidcamSettings?: { host?: string; port?: number; reachable?: boolean; lastError?: string };
  droidcamProbe?: () => Promise<any>;
  setDroidcamSettings?: (patch: { host?: string; port?: number }) => void;
  twitchUser: any;
  twitchStatus: 'disconnected' | 'connecting' | 'connected';
  handleTwitchLogin: (type: 'main' | 'bot') => void;
  handleTwitchConnect: () => void;
  handleTwitchLogout: () => void;
  
  twitchBotUser: any;
  twitchBotStatus: 'disconnected' | 'connecting' | 'connected';
  handleTwitchBotConnect: () => void;
  handleTwitchBotLogout: () => void;

  tiktokUrl: string;
  setTiktokUrl: (url: string) => void;
  tiktokProxyUrl: string;
  setProxyUrl: (url: string) => void;
  /** polling: looking for the stream now and then; waiting: armed, looking for nothing until Twitch (or OBS) is live. */
  tiktokStatus: 'disconnected' | 'searching' | 'connected' | 'polling' | 'waiting';
  /** How TikTok is being looked for, by what OBS says about the stream. */
  tiktokWatch?: { mode: string; nextTryAt?: number } | null;
  handleTikTokConnect: () => void;
  tiktokError: string | null;



  // Discord
  discordToken: string | null;
  setDiscordToken: (token: string | null) => void; // Actually Client ID in UI logic sometimes, but name persisted
  discordChannelId: string | null;
  setDiscordChannelId: (id: string | null) => void;
  discordStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectDiscord: (clientId: string) => void;
  disconnectDiscord: () => void;
  discordUser: any;
  guilds: any[];
  channels: any[];
  fetchChannels: (guildId: string) => void;
  handleDiscordConnect: (channelId: string) => void;
  /** Commands work in every channel of the server (server/engine/index.js). */
  discordCommandsEverywhere?: boolean;
  setDiscordCommandsEverywhere?: (on: boolean) => void;
  discordGuildId: string | null;
  setDiscordGuildId: (id: string | null) => void;

  relayConfig: RelayConfig;
  /** Only the switch that changed: the server keeps the rest, so two quick clicks cannot undo each other. */
  setRelayConfig: (config: Partial<RelayConfig>) => void;

  // OBS
  obsStatus: 'disconnected' | 'connecting' | 'connected';
  obsHost: string; setObsHost: (h: string) => void;
  obsPort: string; setObsPort: (p: string) => void;
  obsPassword: string; setObsPassword: (p: string) => void;
  handleObsConnect: (auto?: boolean) => void;
  obsData: any;
  obsError: any;
  hasInsecureBlocked: boolean;
  setInsecureAcknowledgeMode: (mode: 'info' | 'guide' | 'nope') => void;
  setShowInsecureModal: (show: boolean) => void;

  // Spotify
  spotify: {
      state: SpotifyState;
      login: () => void;
      logout: () => void;
  };
  spotifyClientId?: string;
  setSpotifyClientId?: (id: string) => void;
  spotifyClientSecret?: string;
  setSpotifyClientSecret?: (secret: string) => void;
  spotifyHasSecret?: boolean;
  youtubeStatus?: string;
  youtubeClientId?: string;
  youtubeHasSecret?: boolean;
  youtubeAuthorised?: boolean;
  /** Whether the linked account let the app change the title and description. */
  youtubeCanEdit?: boolean;
  /** What the YouTube connection is doing: reading, waiting, out of allowance, failing. */
  youtubeHealth?: { state: string; since?: number; everyMs?: number; nextCheckAt?: number; resetsAt?: number; message?: string } | null;
  /** When the newest YouTube message in chat arrived, or 0. */
  youtubeLastMessageAt?: number;
  youtubeChannel?: { title?: string; avatar?: string } | null;
  youtube?: {
    login: () => void;
    logout: () => void;
    setSettings: (patch: { clientId?: string; clientSecret?: string }) => void;
  };
  discordBotToken?: string;
  setDiscordBotToken?: (v: string) => void;
  discordHasBotToken?: boolean;
  discordClientSecret?: string;
  setDiscordClientSecret?: (v: string) => void;
  discordHasClientSecret?: boolean;
  tiktokSignKey?: string;
  setTiktokSignKey?: (v: string) => void;
  tiktokHasSignKey?: boolean;
  geminiKey?: string;
  setGeminiKey?: (v: string) => void;
  hasGeminiKey?: boolean;

  // Twitch Client ID (New)
  twitchClientId?: string;
  setTwitchClientId?: (id: string) => void;

  activeTheme: ThemeConfig;
  t: any;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  droidcamSettings, droidcamProbe, setDroidcamSettings,
  twitchUser, twitchStatus, handleTwitchLogin, handleTwitchConnect, handleTwitchLogout,
  twitchBotUser, twitchBotStatus, handleTwitchBotConnect, handleTwitchBotLogout,
  tiktokUrl, setTiktokUrl, tiktokProxyUrl, setProxyUrl, tiktokStatus, handleTikTokConnect, tiktokError, tiktokWatch,
  discordToken, setDiscordToken, discordChannelId, setDiscordChannelId, discordStatus, connectDiscord, disconnectDiscord, discordUser, guilds, channels, fetchChannels, handleDiscordConnect, discordGuildId, setDiscordGuildId, discordCommandsEverywhere = true, setDiscordCommandsEverywhere,
  relayConfig, setRelayConfig,
  obsStatus, obsHost, setObsHost, obsPort, setObsPort, obsPassword, setObsPassword, handleObsConnect, obsData, obsError, hasInsecureBlocked, setInsecureAcknowledgeMode, setShowInsecureModal,
  spotify, spotifyClientId, setSpotifyClientId,
  spotifyClientSecret, setSpotifyClientSecret, spotifyHasSecret,
  youtube, youtubeStatus, youtubeClientId, youtubeHasSecret, youtubeAuthorised, youtubeCanEdit, youtubeHealth, youtubeLastMessageAt, youtubeChannel,
  discordBotToken, setDiscordBotToken, discordHasBotToken,
  discordClientSecret, setDiscordClientSecret, discordHasClientSecret,
  tiktokSignKey, setTiktokSignKey, tiktokHasSignKey,
  geminiKey, setGeminiKey, hasGeminiKey,
  twitchClientId, setTwitchClientId,
  activeTheme, t
}) => {

  /**
   * The address is edited locally and pushed as it changes.
   *
   * Kept in local state because saving marks the connection unproven again —
   * bound straight to server state, the status line would flicker while an IP
   * was being typed one character at a time.
   */
  const [droidcamHost, setDroidcamHostLocal] = useState(droidcamSettings?.host ?? '');
  const [droidcamPort, setDroidcamPortLocal] = useState(String(droidcamSettings?.port ?? 4747));
  const [droidcamResult, setDroidcamResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Another device may have set this; adopt what the server says.
  useEffect(() => {
    if (droidcamSettings?.host) setDroidcamHostLocal(droidcamSettings.host);
    if (droidcamSettings?.port) setDroidcamPortLocal(String(droidcamSettings.port));
  }, [droidcamSettings?.host, droidcamSettings?.port]);

  const setDroidcamHost = (v: string) => {
    setDroidcamHostLocal(v);
    setDroidcamSettings?.({ host: v, port: Number(droidcamPort) || 4747 });
  };
  const setDroidcamPort = (v: string) => {
    setDroidcamPortLocal(v);
    setDroidcamSettings?.({ host: droidcamHost, port: Number(v) || 4747 });
  };

  const onDroidcamTest = async () => {
    setDroidcamResult({ ok: true, text: '…' });
    try {
      const probe = await droidcamProbe?.();
      const zoom = probe?.info ? `, zoom ${probe.info.zmMin}-${probe.info.zmMax}x` : '';
      const cams = probe?.cameras?.length ? `, ${probe.cameras.length} cameras` : '';
      setDroidcamResult({ ok: true, text: `${probe?.name || 'Connected'}${cams}${zoom}` });
    } catch (err: any) {
      // The phone's own words, not a generic failure: a wrong IP and a
      // sleeping phone need different fixes.
      setDroidcamResult({ ok: false, text: err?.message || String(err) });
    }
  };

  // Auto-fetch channels if we have a persisted guild ID on reload
  useEffect(() => {
      if (discordStatus === 'connected' && discordGuildId && channels.length === 0) {
          fetchChannels(discordGuildId);
      }
  }, [discordStatus, discordGuildId, channels.length, fetchChannels]);


  return (
    <div className="animate-fade-in space-y-12 pb-20">
       <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
          
       </div>


       {/* Discord Help Modal */}

       {/* Render Rest of component same as original (Grid with Cards) */}
       <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* TWITCH */}
          <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} relative overflow-hidden`}>
             <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="p-3 bg-[#9146FF] rounded-2xl text-white shadow-lg shadow-[#9146FF]/20"><TwitchIcon size={24} /></div>
                <div> <h3 className="text-xl font-black uppercase tracking-tight text-[#9146FF]">Twitch</h3> <span className="text-xs font-bold text-zinc-500 flex items-center gap-2"> {twitchStatus === 'connected' ? <span className="text-green-500 flex items-center gap-1"><Wifi size={12} /> {t.online}</span> : <span className="text-zinc-500 flex items-center gap-1"><WifiOff size={12} /> {t.offline}</span>} </span> </div>
             </div>
             
             <div className="space-y-6 relative z-10">
                {(!twitchUser && !twitchBotUser) && (
                    <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 text-center mb-2">
                        <div className="mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block text-left">{t.twitchClientId}</label>
                            <input 
                                type="text" 
                                value={twitchClientId || ''} 
                                onChange={(e) => setTwitchClientId && setTwitchClientId(e.target.value)} 
                                placeholder={t.twitchClientIdPlaceholder} 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-[#9146FF] outline-none" 
                            />
                            <DevPortalSetup
                              href="https://dev.twitch.tv/console"
                              redirectUri={typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}
                              accent="#9146FF"
                              t={t}
                            />
                        </div>
                    </div>
                )}

                <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 block">{t.mainAccount}</span>
                    {twitchUser ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {twitchUser.profile_image_url && <img src={twitchUser.profile_image_url} className="w-10 h-10 rounded-full border-2 border-[#9146FF]" alt="" />}
                                <div> <div className="font-bold text-white">{twitchUser.display_name}</div> <div className="text-[10px] text-zinc-500 uppercase font-mono">{t.connected}</div> </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={handleTwitchLogout} icon={<LogOut size={14} />}>{t.twitchLogout}</Button>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-xs text-zinc-400 mb-4 font-medium">{t.connectReadChat}</p>
                            <Button 
                                className="w-full bg-[#9146FF] hover:bg-[#7c3aed] text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                                onClick={() => handleTwitchLogin('main')}
                                disabled={!twitchClientId}
                            >
                                {t.twitchLogin}
                            </Button>
                        </div>
                    )}
                </div>
                
                <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 block">{t.botAccount}</span>
                    {twitchBotUser ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {twitchBotUser.profile_image_url && <img src={twitchBotUser.profile_image_url} className="w-10 h-10 rounded-full border-2 border-blue-500" alt="" />}
                                <div> <div className="font-bold text-white">{twitchBotUser.display_name}</div> <div className="text-[10px] text-zinc-500 uppercase font-mono">{t.connected}</div> </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={handleTwitchBotLogout} icon={<LogOut size={14} />}>{t.twitchLogout}</Button>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                             <p className="text-xs text-zinc-400 mb-4 font-medium">{t.connectBotDesc}</p>
                             <Button 
                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                                onClick={() => handleTwitchLogin('bot')}
                                disabled={!twitchClientId}
                             >
                                 <Bot size={16} className="mr-2" /> {t.connectBotBtn}
                             </Button>
                        </div>
                    )}
                </div>
             </div>
          </div>

          {/* TIKTOK */}
          <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} relative overflow-hidden`}>
             <div className="flex items-center justify-between mb-6 relative z-10">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#ff0050] rounded-2xl text-white shadow-lg shadow-[#ff0050]/20"><TikTokIcon size={24} /></div>
                    <div> <h3 className="text-xl font-black uppercase tracking-tight text-[#ff0050]">TikTok Live</h3> <span className="text-xs font-bold text-zinc-500 flex items-center gap-2"> {tiktokStatus === 'connected' ? <span className="text-green-500 flex items-center gap-1"><Wifi size={12} /> {t.online}</span> : tiktokStatus === 'polling' ? <span className="text-amber-500 flex items-center gap-1 animate-pulse"><Wifi size={12} /> {t.tiktokLooking || 'Looking'}</span> : tiktokStatus === 'waiting' ? <span className="text-zinc-400 flex items-center gap-1"><Wifi size={12} /> {t.waiting}</span> : <span className="text-zinc-500 flex items-center gap-1"><WifiOff size={12} /> {t.offline}</span>} </span> </div>
                 </div>
             </div>

             <div className="space-y-6 relative z-10">
                 {(tiktokStatus === 'polling' || tiktokStatus === 'waiting') && tiktokWatch && tiktokWatch.mode !== 'connected' && (
                     <TiktokWatchLine watch={tiktokWatch} t={t} />
                 )}
                 {/* Switched off: said plainly, since nothing will look for the stream — not even when Twitch goes live. */}
                 {tiktokStatus === 'disconnected' && tiktokUrl && (
                     <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-left text-amber-200" data-tiktok-watch="off">
                         <div className="text-[11px] font-black uppercase tracking-widest">{t.tiktokOffNow || 'TikTok is switched off'}</div>
                         <div className="text-[11px] opacity-80 mt-1">{t.tiktokOffHint || 'It will not be looked for, not even when Twitch goes live. Press Connect to switch it back on: it waits for your Twitch stream, and looks for your TikTok stream once that is live.'}</div>
                     </div>
                 )}
                 {tiktokError && (
                     <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                         <AlertTriangle className="text-red-500 shrink-0" size={20} />
                         <span className="text-xs font-bold text-red-500">{tiktokError}</span>
                     </div>
                 )}
                 
                 {/* Mini Modal Container */}
                 <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 space-y-4">
                     <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.tiktokUsername}</label>
                         <div className="bg-black/30 border border-zinc-700 rounded-xl px-4 py-3 flex items-center gap-2">
                             <span className="text-zinc-500 font-bold">@</span>
                             <input type="text" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="username" className="bg-transparent border-none outline-none text-white text-sm font-bold w-full" />
                         </div>
                     </div>
                     

                     <div className="pt-2">
                         <Button
                           onClick={() => {
                             // Stopping while it waits switches TikTok off until Connect is pressed again: asked first, so a stray tap does not.
                             if ((tiktokStatus === 'polling' || tiktokStatus === 'waiting') && !window.confirm(t.tiktokStopConfirm || 'Stop looking for your TikTok stream? It will not be looked for when Twitch goes live until you press Connect again.')) return;
                             handleTikTokConnect();
                           }}
                           disabled={!tiktokUrl || tiktokStatus === 'searching'}
                           className={`w-full ${tiktokStatus === 'connected' || tiktokStatus === 'polling' || tiktokStatus === 'waiting' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#ff0050] hover:bg-[#e60049]'}`}
                           data-tiktok-button
                         >
                             {tiktokStatus === 'connected' ? t.disconnectServer
                               : tiktokStatus === 'waiting' ? (t.tiktokStopWaiting || 'Stop waiting')
                                 : tiktokStatus === 'polling' ? t.stopPolling
                                 : tiktokStatus === 'searching' ? <span className="animate-pulse">{t.connecting}</span> : t.connect}
                         </Button>
                     </div>

                     <div className="pt-2 border-t border-zinc-800/50 text-[10px] text-zinc-500 leading-relaxed">
                         {t.tiktokSetupInfo}
                     </div>
                     <div className="mt-4 text-left">
                         <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t.tiktokSignKey}</label>
                         <input
                             type="password"
                             autoComplete="off"
                             value={tiktokSignKey || ''}
                             onChange={(e) => setTiktokSignKey && setTiktokSignKey(e.target.value)}
                             placeholder={t.tiktokSignKeyPlaceholder}
                             className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-[#ff0050] outline-none"
                         />
                         <p className="text-[10px] text-zinc-600 mt-1">
                             {tiktokHasSignKey && !tiktokSignKey ? t.secretStored : t.tiktokSignKeyHint}
                         </p>
                     </div>
                 </div>
             </div>
          </div>

          {/* DISCORD */}
          <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} relative overflow-hidden`}>
             <div className="flex items-center justify-between mb-6 relative z-10">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#5865F2] rounded-2xl text-white shadow-lg shadow-[#5865F2]/20"><DiscordIcon size={24} /></div>
                    <div> <h3 className="text-xl font-black uppercase tracking-tight text-[#5865F2]">Discord</h3> <span className="text-xs font-bold text-zinc-500 flex items-center gap-2"> {discordStatus === 'connected' ? <span className="text-green-500 flex items-center gap-1"><Wifi size={12} /> {t.online}</span> : <span className="text-zinc-500 flex items-center gap-1"><WifiOff size={12} /> {t.offline}</span>} </span> </div>
                 </div>
             </div>
             
             <div className="space-y-6 relative z-10">
                 {!discordUser ? (
                    <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 text-center">
                        <div className="mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block text-left">{t.discordClientId}</label>
                            <input type="text" value={discordToken || ''} onChange={(e) => setDiscordToken(e.target.value)} placeholder="123456789..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-[#5865F2] outline-none" />
                        <div className="mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block text-left">{t.discordBotToken}</label>
                            <input
                                type="password"
                                autoComplete="off"
                                value={discordBotToken || ''}
                                onChange={(e) => setDiscordBotToken && setDiscordBotToken(e.target.value)}
                                placeholder={t.discordBotTokenPlaceholder}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-[#5865F2] outline-none"
                            />
                            <p className="text-[10px] text-zinc-600 mt-1 text-left">
                                {discordHasBotToken && !discordBotToken ? t.secretStored : t.secretNeverShown}
                            </p>
                        </div>
                        <div className="mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block text-left">{t.discordClientSecret}</label>
                            <input
                                type="password"
                                autoComplete="off"
                                value={discordClientSecret || ''}
                                onChange={(e) => setDiscordClientSecret && setDiscordClientSecret(e.target.value)}
                                placeholder={t.discordClientSecretPlaceholder}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-[#5865F2] outline-none"
                            />
                            <p className="text-[10px] text-zinc-600 mt-1 text-left">
                                {discordHasClientSecret && !discordClientSecret ? t.secretStored : t.secretNeverShown}
                            </p>
                        </div>
                            <DevPortalSetup
                              href="https://discord.com/developers/applications"
                              redirectUri={typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}
                              accent="#5865F2"
                              t={t}
                            />
                        </div>
                        <Button className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white" onClick={() => connectDiscord(discordToken || '')} disabled={!discordToken}>
                            {t.discordLogin || 'Login with Discord'}
                        </Button>
                    </div>
                 ) : (
                    <div className="space-y-4">
                        <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                {discordUser.avatar && <img src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`} className="w-10 h-10 rounded-full border-2 border-[#5865F2]" alt="" />}
                                <div> <div className="font-bold text-white">{discordUser.global_name || discordUser.username}</div> <div className="text-[10px] text-zinc-500 uppercase font-mono">{t.connected}</div> </div>
                             </div>
                             <Button size="sm" variant="secondary" onClick={disconnectDiscord} icon={<LogOut size={14} />}>{t.twitchLogout}</Button>
                        </div>

                        {/* Channel Selector */}
                        <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.activeChannelBot}</label>
                             <div className="flex gap-2">
                                 <select 
                                     value={discordGuildId || ''} 
                                     onChange={(e) => { setDiscordGuildId(e.target.value); fetchChannels(e.target.value); }} 
                                     className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-white outline-none"
                                 >
                                     <option value="">{t.discordPickServer || 'Select Server...'}</option>
                                     {guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                 </select>
                                 <select 
                                     value={discordChannelId || ''} 
                                     onChange={(e) => { setDiscordChannelId(e.target.value); handleDiscordConnect(e.target.value); }} 
                                     className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-white outline-none"
                                     disabled={!discordGuildId}
                                 >
                                     <option value="">Select Channel...</option>
                                     {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                                 </select>
                             </div>
                             <p className="text-[10px] text-zinc-600">{t.botMustBeInServer}</p>
                             <button data-discord-commands-everywhere onClick={() => setDiscordCommandsEverywhere?.(!discordCommandsEverywhere)} className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left ${discordCommandsEverywhere ? 'bg-[#5865F2]/10 border-[#5865F2] text-[#5865F2]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                 <span className="flex flex-col"><span className="text-xs font-bold">{t.discordCommandsEverywhere || 'Commands work in every channel'}</span><span className="text-[10px] font-medium opacity-80">{t.discordCommandsEverywhereHint || 'Off: only in the channel above. Either way, a command answers in the Discord channel it was typed in when its chat step sends to "Where it came from".'}</span></span>
                                 {discordCommandsEverywhere ? <ToggleRight size={18} className="shrink-0" /> : <ToggleLeft size={18} className="shrink-0" />}
                             </button>
                        </div>
                        
                        {/* Relay Config */}
                        <div className="pt-4 border-t border-zinc-800">
                             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 block">{t.chatRelay}</span>
                             <div className="space-y-2">
                                <button onClick={() => setRelayConfig({ twitchToDiscord: !relayConfig.twitchToDiscord})} className={`w-full p-3 rounded-xl border flex items-center justify-between ${relayConfig.twitchToDiscord ? 'bg-[#9146FF]/10 border-[#9146FF] text-[#9146FF]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                    <span className="text-xs font-bold">Twitch Chat {`->`} Discord</span>
                                    {relayConfig.twitchToDiscord ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                </button>
                                <button onClick={() => setRelayConfig({ tiktokToDiscord: !relayConfig.tiktokToDiscord})} className={`w-full p-3 rounded-xl border flex items-center justify-between ${relayConfig.tiktokToDiscord ? 'bg-[#ff0050]/10 border-[#ff0050] text-[#ff0050]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                    <span className="text-xs font-bold">TikTok Chat {`->`} Discord</span>
                                    {relayConfig.tiktokToDiscord ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                </button>
                                <button data-relay="youtubeToDiscord" onClick={() => setRelayConfig({ youtubeToDiscord: !relayConfig.youtubeToDiscord})} className={`w-full p-3 rounded-xl border flex items-center justify-between ${relayConfig.youtubeToDiscord ? 'bg-[#FF0000]/10 border-[#FF0000] text-[#FF0000]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                    <span className="text-xs font-bold">YouTube Chat {`->`} Discord</span>
                                    {relayConfig.youtubeToDiscord ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                </button>
                                <button data-relay="discordToTwitch" onClick={() => setRelayConfig({ discordToTwitch: !relayConfig.discordToTwitch})} className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left ${relayConfig.discordToTwitch ? 'bg-[#5865F2]/10 border-[#5865F2] text-[#5865F2]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                    <span className="flex flex-col"><span className="text-xs font-bold">Discord {`->`} Twitch Chat</span><span className="text-[10px] font-medium opacity-80">{t.relayDiscordToTwitchHint || 'Sent as your bot account when it is connected.'}</span></span>
                                    {relayConfig.discordToTwitch ? <ToggleRight size={18} className="shrink-0" /> : <ToggleLeft size={18} className="shrink-0" />}
                                </button>
                                <button data-relay="discordToYoutube" onClick={() => setRelayConfig({ discordToYoutube: !relayConfig.discordToYoutube})} className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left ${relayConfig.discordToYoutube ? 'bg-[#5865F2]/10 border-[#5865F2] text-[#5865F2]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                    <span className="flex flex-col"><span className="text-xs font-bold">Discord {`->`} YouTube Chat</span><span className="text-[10px] font-medium opacity-80">{t.relayDiscordToYoutubeHint || "Each message uses 50 of YouTube's 10,000 daily units. It pauses while fewer than 1,000 are left."}</span></span>
                                    {relayConfig.discordToYoutube ? <ToggleRight size={18} className="shrink-0" /> : <ToggleLeft size={18} className="shrink-0" />}
                                </button>
                             </div>
                        </div>
                    </div>
                 )}
             </div>
          </div>

          {/* YOUTUBE */}
          <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} relative overflow-hidden`} data-connection="youtube">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#FF0000] rounded-2xl text-white shadow-lg shadow-[#FF0000]/20">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-[#FF0000]">YouTube</h3>
                  <span className="text-xs font-bold text-zinc-500 flex items-center gap-2">
                    {youtubeStatus === 'connected'
                      ? <span className="text-green-500 flex items-center gap-1"><Wifi size={12} /> {t.online}</span>
                      : <span className="text-zinc-500 flex items-center gap-1"><WifiOff size={12} /> {t.offline}</span>}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              {/*
                Signed in, the card says whose account it is and offers the way
                out — the same as Discord and Spotify. The setup fields are for
                setting up, and once that is done they are a form asking to be
                filled in again.
              */}
              {youtubeAuthorised ? (
                <div className="flex items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {youtubeChannel?.avatar
                      ? <img src={youtubeChannel.avatar} alt="" className="w-10 h-10 rounded-full shrink-0" />
                      : <div className="w-10 h-10 rounded-full bg-[#FF0000]/20 shrink-0" />}
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{youtubeChannel?.title || t.youtubeChannel || 'YouTube channel'}</div>
                      <div className="text-[10px] text-zinc-500 uppercase font-mono">{t.connected}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => youtube?.logout()} icon={<LogOut size={14} />}>{t.twitchLogout}</Button>
                </div>
              ) : null}
              {/*
                Linked before the app could change titles, so the account only
                ever granted reading. One more sign-in grants the rest; until
                then a title step logs why it did nothing.
              */}
              {youtubeAuthorised && youtubeHealth && youtubeHealth.state !== 'off' && (
                <YoutubeHealthLine health={youtubeHealth} lastMessageAt={youtubeLastMessageAt || 0} t={t} />
              )}
              {youtubeAuthorised && !youtubeCanEdit && (
                <div className="flex items-center justify-between gap-4 bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 text-left">
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    {t.youtubeNeedsEdit || 'Sign in again to let actions change your stream title and description. Until then YouTube only lets the app read.'}
                  </p>
                  <Button size="sm" onClick={() => youtube?.login()}>{t.youtubeSignInAgain || 'Sign in again'}</Button>
                </div>
              )}
              {youtubeAuthorised ? null : (
              <>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block text-left">{t.youtubeClientId || 'Client ID'}</label>
                <input
                  type="text"
                  value={youtubeClientId || ''}
                  onChange={(e) => youtube?.setSettings({ clientId: e.target.value })}
                  placeholder="123456789-abc.apps.googleusercontent.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-[#FF0000]"
                />
                <p className="text-[10px] text-zinc-600 mt-1 text-left">
                  {t.youtubeConsoleHint || 'An OAuth client from the Google Cloud console, with the YouTube Data API v3 enabled.'}
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block text-left">{t.youtubeClientSecret || 'Client secret'}</label>
                <input
                  type="password"
                  onChange={(e) => youtube?.setSettings({ clientSecret: e.target.value })}
                  placeholder={youtubeHasSecret ? '••••••••••••' : 'GOCSPX-…'}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-[#FF0000]"
                />
              </div>

              {/*
                The same block every other platform gets: the exact redirect to
                copy, and the way to the console it has to be registered at.
                Google refuses anything that does not match character for
                character, so it is copied rather than described and retyped.
              */}
              <DevPortalSetup
                href="https://console.cloud.google.com/apis/credentials"
                redirectUri={typeof window !== 'undefined' ? youtubeRedirectUri() : ''}
                accent="#FF0000"
                t={t}
              />
              {/*
                Named exactly, because Google has two boxes and rejects anything
                that is not this string character for character. Putting it in
                the other one, or dropping the slash it ends with, both come
                back as redirect_uri_mismatch with nothing to say which it was.
              */}
              <p className="text-[10px] text-zinc-600 -mt-2 text-left leading-relaxed">
                {t.youtubeRedirectField
                  || 'On the OAuth client, this goes in "Authorised redirect URIs" — not "Authorised JavaScript origins". The slash at the end is part of it.'}
              </p>

              <Button onClick={() => youtube?.login()} className="w-full">{t.youtubeLogin || 'Sign in with Google'}</Button>
              </>
              )}

              {/*
                Said plainly rather than discovered: YouTube's live chat API
                raises nothing when somebody subscribes for free, so there is
                no alert for it anywhere in the app.
              */}
              <p className="text-[10px] text-zinc-600 text-left leading-relaxed">
                {t.youtubeNoSubscribeEvents
                  || 'YouTube reports members, gifted memberships and Super Chats. It reports nothing when somebody subscribes for free, so there is no alert for that.'}
              </p>
            </div>
          </div>

          {/* SPOTIFY */}
          <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} relative overflow-hidden`}>
             <div className="flex items-center justify-between mb-6 relative z-10">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#1DB954] rounded-2xl text-white shadow-lg shadow-[#1DB954]/20"><SpotifyIcon size={24} /></div>
                    <div> <h3 className="text-xl font-black uppercase tracking-tight text-[#1DB954]">Spotify</h3> <span className="text-xs font-bold text-zinc-500 flex items-center gap-2"> {spotify.state.isConnected ? <span className="text-green-500 flex items-center gap-1"><Wifi size={12} /> {t.online}</span> : <span className="text-zinc-500 flex items-center gap-1"><WifiOff size={12} /> {t.offline}</span>} </span> </div>
                 </div>
             </div>
             
             <div className="space-y-6 relative z-10">
                 {spotify.state.isConnected ? (
                    <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center text-black font-bold">S</div>
                            <div> <div className="font-bold text-white">{t.spotifyUser}</div> <div className="text-[10px] text-zinc-500 uppercase font-mono">{t.connected}</div> </div>
                         </div>
                         <Button size="sm" variant="secondary" onClick={spotify.logout} icon={<LogOut size={14} />}>{t.twitchLogout}</Button>
                    </div>
                 ) : (
                    <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 text-center">
                        <div className="mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block text-left">{t.spotifyClientId}</label>
                            <input 
                                type="text" 
                                value={spotifyClientId || ''} 
                                onChange={(e) => setSpotifyClientId && setSpotifyClientId(e.target.value)} 
                                placeholder={t.spotifyClientIdPlaceholder} 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-[#1DB954] outline-none" 
                            />
                            <p className="text-[10px] text-zinc-600 mt-1 text-left">{t.spotifyDashboardHint}</p>
                        </div>
                        <div className="mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block text-left">{t.spotifyClientSecret}</label>
                            <input
                                type="password"
                                autoComplete="off"
                                value={spotifyClientSecret || ''}
                                onChange={(e) => setSpotifyClientSecret && setSpotifyClientSecret(e.target.value)}
                                placeholder={t.spotifyClientSecretPlaceholder}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-[#1DB954] outline-none"
                            />
                            <p className="text-[10px] text-zinc-600 mt-1 text-left">
                                {spotifyHasSecret && !spotifyClientSecret ? t.spotifySecretStored : t.spotifyDashboardHint}
                            </p>
                        </div>
                        <div className="mb-4">
                            <DevPortalSetup
                              href="https://developer.spotify.com/dashboard"
                              redirectUri={typeof window !== 'undefined' ? spotifyRedirectUri() : ''}
                              accent="#1DB954"
                              t={t}
                            />
                            {/* Spotify refuses `localhost`, so the address above may not be the
                                one in the address bar. Say so, or it reads as a mistake. */}
                            <p className="text-[9px] text-zinc-600 leading-relaxed mt-2">{t.spotifyLoopbackNote}</p>
                        </div>
                        <Button
                            className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold"
                            onClick={spotify.login}
                            disabled={spotify.state.isAuthenticating || !spotifyClientId || !(spotifyHasSecret || spotifyClientSecret)}
                        >
                            {spotify.state.isAuthenticating ? t.connecting : t.spotifyLogin}
                        </Button>
                        {spotify.state.error && <p className="text-[10px] text-red-500 mt-2">{spotify.state.error}</p>}
                    </div>
                 )}
             </div>
          </div>
          
          {/* OBS */}
          <div className={`glass-panel p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} relative overflow-hidden xl:col-span-2`}>
             <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="p-3 bg-zinc-800 rounded-2xl text-white shadow-lg"><Monitor size={24} /></div>
                <div> <h3 className="text-xl font-black uppercase tracking-tight text-white">{t.obsTitle}</h3> <span className="text-xs font-bold text-zinc-500 flex items-center gap-2"> {obsStatus === 'connected' ? <span className="text-green-500 flex items-center gap-1"><Wifi size={12} /> {t.online}</span> : <span className="text-zinc-500 flex items-center gap-1"><WifiOff size={12} /> {t.offline}</span>} </span> </div>
             </div>

             <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                     {obsError && (
                         <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                             <AlertTriangle className="text-red-500 shrink-0" size={20} />
                             <span className="text-xs font-bold text-red-500">{obsError.message || "Connection Failed"}</span>
                         </div>
                     )}
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.serverHost}</label>
                             <input type="text" value={obsHost} onChange={(e) => setObsHost(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:border-current-accent outline-none" />
                         </div>
                         <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.serverPort}</label>
                             <input type="text" value={obsPort} onChange={(e) => setObsPort(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:border-current-accent outline-none" />
                         </div>
                     </div>
                     <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.serverPassword}</label>
                         <input type="password" value={obsPassword} onChange={(e) => setObsPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 focus:border-current-accent outline-none" />
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                         <Info size={14} className="shrink-0" />
                         <span>{t.obsNote}</span>
                     </div>
                     {/*
                       Clickable while connecting, on purpose.

                       The handler already sends a disconnect when the status is
                       "connecting", and disconnect is what clears the retry
                       timer — so disabling the button here was the one thing
                       standing between a stuck connection and being able to
                       stop it. A failed connect backs off toward two minutes
                       between tries, which is a long time to watch a button
                       you cannot press.
                     */}
                     <Button onClick={() => handleObsConnect()} className={`w-full ${obsStatus === 'connected' ? 'bg-zinc-700 hover:bg-zinc-600' : ''}`}>
                         {obsStatus === 'connected' ? t.disconnectServer
                           : obsStatus === 'connecting' ? (t.stopConnecting || 'Stop trying')
                             : t.connectServer}
                     </Button>
                 </div>
                 
                 <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 flex flex-col justify-center items-center text-center">
                    {obsStatus === 'connected' ? (
                        <>
                             <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-4 animate-pulse">
                                 <Monitor size={32} />
                             </div>
                             <h4 className="text-lg font-black uppercase tracking-tight text-white mb-1">{t.obsConnected}</h4>
                             <p className="text-xs text-zinc-500 font-mono mb-4">v{obsData.obsVersion} | {obsData.currentScene}</p>
                             <div className="grid grid-cols-2 gap-4 w-full">
                                 <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                                     <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">{t.stream}</div>
                                     <div className={`text-sm font-black ${obsData.streamStatus.active ? 'text-green-500' : 'text-zinc-400'}`}>
                                         {obsData.streamStatus.active ? t.live : t.offline}
                                     </div>
                                 </div>
                                 <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                                     <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">{t.recording}</div>
                                     <div className={`text-sm font-black ${obsData.recordingStatus.active ? 'text-red-500' : 'text-zinc-400'}`}>
                                         {obsData.recordingStatus.active ? t.rec : t.stopped}
                                     </div>
                                 </div>
                             </div>
                        </>
                    ) : (
                        <>
                             <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 mb-4">
                                 <Monitor size={32} />
                             </div>
                             <h4 className="text-lg font-black uppercase tracking-tight text-zinc-400 mb-2">{t.obsNotConnected}</h4>
                             <p className="text-xs text-zinc-500 max-w-[200px]">{t.obsConnectInfo}</p>
                        </>
                    )}
                 </div>
             </div>
          </div>
       </div>

       {/* DroidCam. Not an account either — just an address on the LAN, so the
           only useful feedback is whether the phone actually answers. */}
       <div className="glass-panel rounded-[40px] border border-zinc-800 bg-zinc-900/20 p-8">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <Camera size={24} />
             </div>
             <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">{t.droidcam}</h3>
                <span className="text-xs font-bold text-zinc-500">{t.droidcamDesc}</span>
             </div>
          </div>

          <div className="max-w-xl text-left space-y-3">
             <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t.droidcamHost}</label>
                   <input
                      type="text"
                      value={droidcamHost}
                      onChange={(e) => setDroidcamHost(e.target.value)}
                      placeholder="192.168.1.50"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-sky-500 outline-none"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t.droidcamPort}</label>
                   <input
                      type="number"
                      value={droidcamPort}
                      onChange={(e) => setDroidcamPort(e.target.value)}
                      placeholder="4747"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-sky-500 outline-none"
                   />
                </div>
             </div>

             <button
                onClick={onDroidcamTest}
                disabled={!droidcamHost}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-sky-500 hover:text-sky-400 transition-all disabled:opacity-40"
             >
                {t.droidcamTest}
             </button>

             {/* Whatever the phone said last, verbatim: a wrong IP and a sleeping
                 phone need different fixes, and only the message distinguishes them. */}
             {droidcamResult && (
                <p className={`text-[10px] font-bold ${droidcamResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                   {droidcamResult.text}
                </p>
             )}
             <p className="text-[10px] text-zinc-600">{t.droidcamHint}</p>
          </div>
       </div>

       {/* AI voice. Not a platform to connect to, but it is a credential, and
           this is where people come looking for those. */}
       <div className="glass-panel rounded-[40px] border border-zinc-800 bg-zinc-900/20 p-8">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Mic size={24} />
             </div>
             <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">{t.aiVoiceTitle}</h3>
                <span className="text-xs font-bold text-zinc-500">
                   {hasGeminiKey ? t.aiVoiceReady : t.aiVoiceOptional}
                </span>
             </div>
          </div>
          <div className="max-w-xl text-left">
             <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">{t.geminiKey}</label>
             <input
                type="password"
                autoComplete="off"
                value={geminiKey || ''}
                onChange={(e) => setGeminiKey && setGeminiKey(e.target.value)}
                placeholder={t.geminiKeyPlaceholder}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-amber-500 outline-none"
             />
             <p className="text-[10px] text-zinc-600 mt-1">
                {hasGeminiKey && !geminiKey ? t.secretStored : t.geminiKeyHint}
             </p>
             <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold mt-2 inline-flex items-center gap-1 text-amber-400 hover:underline"
             >
                {t.openDevPortal} <ExternalLink size={10} />
             </a>
          </div>
       </div>

    </div>
  );
};

/**
 * What the YouTube connection is doing, in words.
 *
 * "Online" said only that the account was linked; chat could be failing
 * underneath it for a whole stream with nothing on screen to say so. This
 * says which of the four it is, and for reading, when a message last came
 * through — the one thing that proves it is working.
 */
const YoutubeHealthLine = ({ health, lastMessageAt, t }: {
  health: { state: string; everyMs?: number; nextCheckAt?: number; resetsAt?: number; message?: string };
  lastMessageAt: number;
  t: any;
}) => {
  // Re-read every half minute, so "2 min ago" does not stand still.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const clock = (at?: number) => (at ? new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
  const ago = (at: number) => {
    const mins = Math.floor((Date.now() - at) / 60_000);
    return mins < 1 ? (t.youtubeJustNow || 'just now') : `${mins} ${t.youtubeMinAgo || 'min ago'}`;
  };

  const tone = health.state === 'reading' ? 'border-green-500/30 bg-green-500/5 text-green-300'
    : health.state === 'waiting' || health.state === 'paused' ? 'border-zinc-700 bg-zinc-900/60 text-zinc-300'
      : 'border-amber-500/30 bg-amber-500/5 text-amber-200';

  let title = '';
  let detail = '';
  if (health.state === 'reading') {
    title = t.youtubeReading || 'Reading chat';
    detail = `${t.youtubeEvery || 'Checks every'} ${Math.round((health.everyMs || 7000) / 1000)}s · ${
      lastMessageAt ? `${t.youtubeLastMessage || 'last message'} ${ago(lastMessageAt)}` : (t.youtubeNoMessagesYet || 'no messages yet')
    }`;
  } else if (health.state === 'waiting') {
    title = t.youtubeWaiting || 'Waiting for a live broadcast';
    detail = `${t.youtubeNextLook || 'Next look at'} ${clock(health.nextCheckAt)}`;
  } else if (health.state === 'paused') {
    title = t.youtubePaused || 'Waiting for Twitch to go live';
    detail = t.youtubePausedHint || 'Not looking for a YouTube broadcast until your Twitch stream is live — no allowance spent meanwhile.';
  } else if (health.state === 'quota') {
    title = t.youtubeQuota || 'Daily YouTube allowance used up';
    detail = `${t.youtubeQuotaBack || 'Chat resumes at'} ${clock(health.resetsAt)}`;
  } else {
    title = t.youtubeTrouble || 'Cannot reach YouTube';
    detail = `${health.message || ''}${health.nextCheckAt ? ` · ${t.youtubeRetryAt || 'trying again at'} ${clock(health.nextCheckAt)}` : ''}`;
  }

  return (
    <div className={`rounded-2xl border p-4 text-left${' '}${tone}`} data-youtube-health={health.state}>
      <div className="text-[11px] font-black uppercase tracking-widest">{title}</div>
      <div className="text-[11px] opacity-80 mt-1 break-words">{detail}</div>
    </div>
  );
};

/**
 * How TikTok is being looked for, in words: waiting on OBS, looking because
 * OBS is live, or looking on the slow timetable because OBS is not there.
 */
const TiktokWatchLine = ({ watch, t }: { watch: { mode: string; nextTryAt?: number }; t: any }) => {
  const clock = (at?: number) => (at ? new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '');
  const [title, detail] = watch.mode === 'twitch-idle'
    ? [t.tiktokTwitchIdle || 'Waiting for Twitch to go live', t.tiktokTwitchIdleHint || 'Not looking for your TikTok stream — no requests at all — until your Twitch stream is live.']
    : watch.mode === 'twitch-live'
      ? [t.tiktokTwitchLive || 'Twitch is live — looking for your TikTok stream', `${t.tiktokNextLook || 'Next look at'} ${clock(watch.nextTryAt)}`]
    : watch.mode === 'obs-idle'
    ? [t.tiktokObsIdle || 'Waiting for OBS to go live', t.tiktokObsIdleHint || 'Not looking for your TikTok stream — no requests at all — until OBS starts streaming.']
    : watch.mode === 'obs-live'
      ? [t.tiktokObsLive || 'OBS is live — looking for your TikTok stream', `${t.tiktokNextLook || 'Next look at'} ${clock(watch.nextTryAt)}`]
      : [t.tiktokNoObs || 'OBS not connected — looking every few minutes', `${t.tiktokNextLook || 'Next look at'} ${clock(watch.nextTryAt)}`];
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4 text-left text-zinc-300" data-tiktok-watch={watch.mode}>
      <div className="text-[11px] font-black uppercase tracking-widest">{title}</div>
      <div className="text-[11px] opacity-80 mt-1">{detail}</div>
    </div>
  );
};
