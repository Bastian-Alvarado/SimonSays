
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState } from 'react';
import { ChatMessage, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { Layout, Loader2, Send, WifiOff, Smile } from 'lucide-react';
import { EmojiPicker } from '../EmojiPicker';
import { ChatStyle } from '../ChatMessageRow';
import { ChatDockSettings } from '../ChatDockSettings';

/**
 * The chat dock's own screen: its settings, and a working copy of the dock.
 *
 * Only the dock. The chat on stream is a layer on a layout now, with its
 * settings on the Overlays screen beside the layout it is part of, so this
 * screen no longer has a second surface to switch between.
 */
interface ChatDockViewProps {
  /** The dock's whole set of chat settings, as the server holds them. */
  chat: Record<string, any>;
  /** Change one or more of them. */
  patchChat: (patch: Record<string, any>) => void;
  dockUrl: string;
  twitchStatus: string;
  tiktokStatus: string;

  discordStatus: string;
  chatMessages: ChatMessage[];
  senderRole: 'main' | 'bot';
  /** Where the box sends — Twitch, YouTube or both — once YouTube is signed in. */
  sendToPicker?: React.ReactNode;
  setSenderRole: (role: 'main' | 'bot') => void;
  twitchBotStatus: string;
  twitchUser: any;
  messageInput: string;
  setMessageInput: (val: string) => void;
  handleSendMessage: () => void;
  renderChatMessageHelper: (chat: ChatMessage, idx: number) => React.ReactNode;
  setView: (view: any) => void;
  activeTheme: ThemeConfig;
  /** Why the last message typed here did not go, or ''. */
  sendError?: string;
  t: any;
}


export const ChatDockView: React.FC<ChatDockViewProps> = ({
  chat, patchChat,
  dockUrl,
  twitchStatus, tiktokStatus, discordStatus,
  chatMessages,
  senderRole, setSenderRole, sendToPicker,
  twitchBotStatus, twitchUser,
  messageInput, setMessageInput,
  handleSendMessage,
  renderChatMessageHelper,
  setView,
  activeTheme,
  sendError,
  t
}) => {
  const [pickerState, setPickerState] = useState<{ open: boolean, top: number, left: number } | null>(null);

  const handlePickerOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();

      // Keep the picker on screen. It is 320x400, and anchoring it to the
      // button's left edge pushed it off the right side of a narrow dock, so
      // clamp both axes and fall back to opening downwards if there is no room
      // above.
      const W = 320, H = 400, M = 8;

      let top = rect.top - H - M;
      if (top < M) top = Math.min(rect.bottom + M, window.innerHeight - H - M);
      top = Math.max(M, top);

      let left = rect.left;
      if (left + W > window.innerWidth - M) left = window.innerWidth - W - M;
      left = Math.max(M, left);

      setPickerState({ open: true, top, left });
  };

  const handleEmojiSelect = (emoji: string) => {
      setMessageInput(messageInput + emoji);
  };

  return (
    <div className="animate-fade-in h-[calc(100dvh-12rem)] flex flex-col md:flex-row gap-6 relative">
      {/* Picker Portal */}
      {pickerState && (
          <>
            <div className="fixed inset-0 z-[9990] bg-transparent" onClick={() => setPickerState(null)} />
            <EmojiPicker 
                style={{ top: pickerState.top, left: pickerState.left }}
                onSelect={handleEmojiSelect}
                onClose={() => setPickerState(null)}
            />
          </>
      )}

      <aside className="w-full md:w-80 xl:w-96 flex-shrink-0 flex flex-col gap-6 md:h-full">
        <div className={`glass-panel p-6 rounded-3xl flex flex-col h-full border ${activeTheme.borderClass} ${activeTheme.panelClass} overflow-y-auto`}>
          <ChatDockSettings values={chat} patch={patchChat} dockUrl={dockUrl} t={t} />
        </div>
      </aside>
      <div className={`flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden border ${activeTheme.borderClass} relative ${activeTheme.id === 'light' ? 'bg-white' : 'bg-zinc-950/20'} min-h-[400px] transition-all`} > <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col-reverse relative" style={{ gap: `${chat.messageGap || 0}px` }}> {<ChatStyle settings={chat} />} {twitchStatus === 'disconnected' && tiktokStatus === 'disconnected' && discordStatus === 'disconnected' ? (<div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-fade-in"> <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 text-zinc-500"> <WifiOff size={32} /> </div> <h3 className="text-xl font-extrabold mb-2 uppercase tracking-tight">{t.platformsDisconnected}</h3> <p className="text-xs text-zinc-500 max-w-xs mb-8">{t.connectToStart}</p> <Button icon={<Layout size={16} />} onClick={() => setView('gallery')}> {t.connectPlatforms} </Button> </div>) : chatMessages.length === 0 ? (<div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-fade-in"> <Loader2 className="w-8 h-8 text-current-accent animate-spin mb-4" /> <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t.noMessages}</p> </div>) : (chatMessages.map((chat, idx) => renderChatMessageHelper(chat, idx)))} </div> {(<div className={`min-h-24 border-t ${activeTheme.borderClass} p-4 flex flex-col bg-zinc-900/10`}> <div className="flex items-center justify-between px-2 mb-1.5"> <div className="flex items-center gap-2"> <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 opacity-60">{t.sendingAs}:</span> {twitchBotStatus === 'connected' ? (<div className="flex bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800 shadow-sm"> <button onClick={() => setSenderRole('main')} className={`px-3 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${senderRole === 'main' ? 'bg-current-accent text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}> {t.mainAccount} </button> <button onClick={() => setSenderRole('bot')} className={`px-3 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${senderRole === 'bot' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}> {t.botAccount} </button> </div>) : (<span className={`text-[8px] font-black uppercase tracking-widest text-current-accent opacity-60`}> {t.mainAccount} {twitchUser?.display_name ? `(${twitchUser.display_name})` : ''} </span>)} {sendToPicker} </div> </div> {sendError && <p role="alert" className="px-2 mb-1.5 text-[10px] font-bold leading-snug text-red-400">{sendError}</p>} <div className="flex gap-2 flex-1 items-stretch"> <div className="flex-1 bg-zinc-900/50 rounded-xl border border-zinc-800 flex items-center px-4 pr-1 relative"> <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }} placeholder={twitchStatus === 'connected' || discordStatus === 'connected' ? t.typeGlobal : t.connectToStart} disabled={twitchStatus === 'disconnected' && discordStatus === 'disconnected'} className="bg-transparent border-none outline-none w-full text-xs font-bold text-zinc-400 disabled:opacity-50 pr-8" /> <button onClick={handlePickerOpen} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Add Emoji"> <Smile size={14} /> </button> </div> <Button onClick={handleSendMessage} icon={<Send size={16} />} className="font-extrabold px-4 sm:px-6 h-full" disabled={(twitchStatus === 'disconnected' && discordStatus === 'disconnected') || !messageInput.trim()}> <span className="hidden xs:inline">{t.send}</span> </Button> </div> </div>)} </div>
    </div>
  );
};
