/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The command editor dialog.
 *
 * Lifted out of StudioView so it can be opened from anywhere. It used to be
 * rendered inside the Commands screen, which meant the Actions screen could
 * only ever link to a command that already existed — you had to leave, create
 * it, and come back. App renders this once, above the view switch, so both
 * screens can reach it.
 *
 * It holds no state of its own: the draft lives in App alongside the save
 * handler, so a command created here is the same record the Commands screen
 * manages, with no second source of truth.
 */
import React from 'react';
import { Command, ThemeConfig } from '../types';
import { Button } from './Button';
import { Terminal, X, Clock, Shield } from 'lucide-react';

interface CommandEditorModalProps {
  isCommandModalOpen: boolean;
  setIsCommandModalOpen: (open: boolean) => void;
  currentCommand: Partial<Command>;
  setCurrentCommand: React.Dispatch<React.SetStateAction<Partial<Command>>>;
  tempTriggers: string;
  setTempTriggers: (triggers: string) => void;
  handleSaveCommand: () => void;
  activeTheme: ThemeConfig;
  t: any;
}

export const CommandEditorModal: React.FC<CommandEditorModalProps> = ({
  isCommandModalOpen,
  setIsCommandModalOpen,
  currentCommand,
  setCurrentCommand,
  tempTriggers,
  setTempTriggers,
  handleSaveCommand,
  activeTheme,
  t,
}) => (
  <>
    {/*
      z-[110], not the usual z-[100] modal layer: this one can open on top of
      another modal. Opened from the Actions screen's interaction editor, an
      equal z-index leaves the outcome to DOM order — and App renders this
      above the view switch, so it lost and opened behind, invisible until the
      action editor was closed. Still below z-[9990]/z-[9999] so the emoji
      picker and dropdowns keep floating over it.
    */}
    {isCommandModalOpen && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className={`max-w-2xl w-full glass-panel rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} shadow-2xl flex flex-col overflow-hidden`}>
          <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-current-accent/10 rounded-xl text-current-accent"><Terminal size={20} /></div>
              <h2 className="text-xl font-black uppercase tracking-tight">{t.commandEditor || 'Command Editor'}</h2>
            </div>
            <button onClick={() => setIsCommandModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
            <div className="space-y-2"> <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.commandName || 'Command Name'}</label> <input type="text" value={currentCommand.name || ''} onChange={(e) => setCurrentCommand({ ...currentCommand, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold focus:border-current-accent outline-none text-white" placeholder="e.g. Socials" /> </div>
            <div className="space-y-2"> <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.triggersInstruction || 'Triggers (One per line)'}</label> <textarea value={tempTriggers} onChange={(e) => setTempTriggers(e.target.value)} className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-400 focus:border-current-accent outline-none resize-none" placeholder="!socials&#10;!twitter&#10;!insta" /> </div>
            
            {/* Permissions */}
            <div className="space-y-2"> <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.permissions}</label> <div className="grid grid-cols-2 sm:grid-cols-3 gap-3"> {['anyone', 'subscribers', 'vips', 'moderators', 'broadcaster'].map(perm => (<button key={perm} onClick={() => setCurrentCommand(prev => ({ ...prev, permissions: { ...prev.permissions!, [perm]: !prev.permissions![perm as keyof typeof prev.permissions] } }))} className={`p-3 rounded-xl border text-center transition-all ${currentCommand.permissions?.[perm as keyof typeof currentCommand.permissions] ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}> <span className="text-[10px] font-black uppercase">{t[perm === 'anyone' ? 'permAnyone' : perm === 'broadcaster' ? 'permOwner' : perm === 'moderators' ? 'permMods' : perm === 'vips' ? 'permVips' : 'permSubs'] || perm}</span> </button>))} </div> </div>
            
            {/* Discord */}
            <label className="flex items-center gap-2 cursor-pointer" data-command-discord>
                <input type="checkbox" checked={currentCommand.discord !== false} onChange={(e) => setCurrentCommand({ ...currentCommand, discord: e.target.checked })} className="accent-current-accent" />
                <span className="text-[11px] text-zinc-300">{t.commandWorksInDiscord || 'Works in Discord'}</span>
            </label>

            {/* Rate Limiting */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/50">
                <div className="flex items-center gap-2 mb-2 text-zinc-500">
                    <Clock size={12} />
                    <label className="text-[10px] font-black uppercase tracking-widest">Rate Limiting</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-zinc-600">Global Cooldown (seconds)</label>
                        <input 
                            type="number" 
                            min="0"
                            value={currentCommand.globalCooldown || 0} 
                            onChange={(e) => setCurrentCommand({ ...currentCommand, globalCooldown: Math.max(0, parseInt(e.target.value)) })} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono font-bold focus:border-current-accent outline-none text-white" 
                            placeholder="0" 
                        />
                        <p className="text-[8px] text-zinc-600">Time before command can be used again by anyone.</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-zinc-600">User Cooldown (seconds)</label>
                        <input 
                            type="number" 
                            min="0"
                            value={currentCommand.userCooldown || 0} 
                            onChange={(e) => setCurrentCommand({ ...currentCommand, userCooldown: Math.max(0, parseInt(e.target.value)) })} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono font-bold focus:border-current-accent outline-none text-white" 
                            placeholder="0" 
                        />
                        <p className="text-[8px] text-zinc-600">Time before specific user can use command again.</p>
                    </div>
                </div>
            </div>

            {/* Cooldown Bypass (New) */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/50">
                <div className="flex items-center gap-2 mb-2 text-zinc-500">
                    <Shield size={12} />
                    <label className="text-[10px] font-black uppercase tracking-widest">{t.ignoreCooldowns || 'Ignore Cooldowns'}</label>
                </div>
                <p className="text-[9px] text-zinc-600 mb-2">{t.ignoreCooldownsDesc || 'Selected roles will bypass global and user cooldowns.'}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"> 
                    {['broadcaster', 'moderators', 'vips', 'subscribers'].map(role => (
                        <button 
                            key={role} 
                            onClick={() => setCurrentCommand(prev => ({
                                ...prev,
                                ignoreCooldowns: {
                                    // `ignoreCooldowns` is optional on Command, and a newly created
                                    // command has none until it is saved. The previous `!` assertions
                                    // were erased at compile time, so clicking any of these toggles
                                    // dereferenced undefined and blanked the whole UI.
                                    ...(prev.ignoreCooldowns ?? { broadcaster: false, moderators: false, vips: false, subscribers: false }),
                                    [role]: !prev.ignoreCooldowns?.[role as keyof NonNullable<Command['ignoreCooldowns']>]
                                }
                            }))}
                            className={`p-2 rounded-xl border text-center transition-all ${currentCommand.ignoreCooldowns?.[role as keyof typeof currentCommand.ignoreCooldowns] ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                        > 
                            <span className="text-[9px] font-black uppercase">
                                {t[role === 'broadcaster' ? 'permOwner' : role === 'moderators' ? 'permMods' : role === 'vips' ? 'permVips' : 'permSubs'] || role}
                            </span> 
                        </button>
                    ))} 
                </div> 
            </div>

          </div>
          <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 flex gap-3"> <Button className="w-full" variant="secondary" onClick={() => setIsCommandModalOpen(false)}>{t.cancel || 'Cancel'}</Button> <Button className="w-full" onClick={handleSaveCommand}>{t.saveCommand}</Button> </div>
        </div>
      </div>
    )}
  </>
);
