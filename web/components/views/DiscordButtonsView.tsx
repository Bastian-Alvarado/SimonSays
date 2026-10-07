
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState, useEffect } from 'react';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap } from '../../../shared/list-order.js';
import { DiscordButtonMapping, DiscordButtonMessage, DiscordEmbed, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { Plus, Trash2, Edit2, Smile, AlertTriangle, MessageSquare, Palette, Layers, MousePointerClick, Hash } from 'lucide-react';
import { EmojiPicker } from '../EmojiPicker';

interface DiscordButtonsViewProps {
  activeTheme: ThemeConfig;
  t: any;
  system: any;
}

export const DiscordButtonsView: React.FC<DiscordButtonsViewProps> = ({ activeTheme, t, system }) => {
  const { discordButtonConfigs, discordRoles } = system.data;
  const { createButtonMenu, deleteButtonMenu, updateButtonMenu, publishButtonMenu, fetchDiscordRoles, fetchDiscordChannels, fetchDiscordEmojis } = system.actions;
  /* Which menu is being posted, and why the last post failed, per menu. */
  const [posting, setPosting] = useState<string | null>(null);
  const [postError, setPostError] = useState<Record<string, string>>({});
  const publish = async (id: string) => {
      setPosting(id);
      setPostError((prev) => ({ ...prev, [id]: '' }));
      try {
          await publishButtonMenu(id);
      } catch (err: any) {
          setPostError((prev) => ({ ...prev, [id]: err?.message || String(err) }));
      } finally {
          setPosting(null);
      }
  };
  const { discordGuildId, discordChannels, discordEmojis } = system.connections;
  const { discord: discordStatus } = system.status;

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [newMenuName, setNewMenuName] = useState('');
  const [targetChannel, setTargetChannel] = useState('');
  const [messageBody, setMessageBody] = useState('Click buttons below!');
  const [useEmbed, setUseEmbed] = useState(false);
  const [embedConfig, setEmbedConfig] = useState<DiscordEmbed>({
      title: 'Role Menu',
      description: 'Click buttons to toggle roles.',
      color: '#5865F2'
  });
  const [buttons, setButtons] = useState<DiscordButtonMapping[]>([{ id: '1', label: 'Role', style: '1', roleId: '' }]);

  // Picker
  const [pickerState, setPickerState] = useState<{ fieldId: string, top: number, left: number } | null>(null);

  // Auto-fetch data
  useEffect(() => {
      if (discordStatus === 'connected' && discordGuildId) {
          if (!discordRoles || discordRoles.length === 0) fetchDiscordRoles(discordGuildId);
          if (!discordChannels || discordChannels.length === 0) fetchDiscordChannels(discordGuildId);
          if (!discordEmojis || discordEmojis.length === 0) fetchDiscordEmojis(discordGuildId);
      }
  }, [discordStatus, discordGuildId]);

  const resetForm = () => {
      setNewMenuName('');
      setTargetChannel('');
      setMessageBody('Click buttons below!');
      setUseEmbed(false);
      setEmbedConfig({ title: 'Role Menu', description: 'Click buttons to toggle roles.', color: '#5865F2' });
      setButtons([{ id: Math.random().toString(36).substr(2, 9), label: 'Role', style: '1', roleId: '' }]);
      setEditingId(null);
  };

  const handleEdit = (config: DiscordButtonMessage) => {
      setEditingId(config.id);
      setNewMenuName(config.name);
      setTargetChannel(config.channelId);
      setMessageBody(config.content);
      if (config.embed) {
          setUseEmbed(true);
          setEmbedConfig(config.embed);
      } else {
          setUseEmbed(false);
      }
      setButtons(config.buttons.map(b => ({ ...b, id: b.id || Math.random().toString(36).substr(2, 9) }))); // Ensure IDs for React keys
      setIsCreating(true);
  };

  const handleSubmit = () => {
      if (!newMenuName || !targetChannel || buttons.length === 0) return;
      
      const config: DiscordButtonMessage = {
          id: editingId || Math.random().toString(36).substr(2, 9),
          messageId: editingId ? (discordButtonConfigs.find((c: any) => c.id === editingId)?.messageId || '') : '',
          channelId: targetChannel,
          guildId: discordGuildId || '',
          name: newMenuName,
          content: messageBody,
          embed: useEmbed ? embedConfig : undefined,
          buttons: buttons.filter(b => b.label && b.roleId)
      };

      if (editingId) {
          updateButtonMenu(config);
      } else {
          createButtonMenu(config);
      }
      setIsCreating(false);
      resetForm();
      // Saved, then put in Discord — or brought up to date there. The save goes
      // first on the same connection, so the server has it when this arrives.
      publish(config.id);
  };

  const addButton = () => {
      if (buttons.length >= 25) return; // Discord Limit
      setButtons([...buttons, { id: Math.random().toString(36).substr(2, 9), label: 'New Button', style: '1', roleId: '' }]);
  };

  const updateButton = (id: string, key: keyof DiscordButtonMapping, value: string) => {
      setButtons(prev => prev.map(b => b.id === id ? { ...b, [key]: value } : b));
  };

  const removeButton = (id: string) => {
      setButtons(prev => prev.filter(b => b.id !== id));
  };

  // The order here is the order they sit in under the message.
  const buttonOrder = useDragOrder(({ from, gap }) => setButtons(prev => moveToGap(prev, from, gap)));

  const handlePickerOpen = (fieldId: string, e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = rect.left;
      if (top + 400 > window.innerHeight) top = rect.top - 408;
      setPickerState({ fieldId, top, left });
  };

  const handleEmojiSelect = (emoji: string) => {
      if (!pickerState) return;
      const { fieldId } = pickerState;
      if (fieldId.startsWith('btn-')) {
          const btnId = fieldId.split('btn-')[1];
          updateButton(btnId, 'emoji', emoji);
      }
  };

  // Helper to render emoji preview in list
  const renderEmoji = (emojiStr: string) => {
      const match = emojiStr.match(/<a?:.+?:(\d+)>/);
      if (match) {
          const isAnimated = emojiStr.startsWith('<a:');
          return <img src={`https://cdn.discordapp.com/emojis/${match[1]}.${isAnimated ? 'gif' : 'png'}`} className="w-4 h-4 object-contain" alt="" />;
      }
      return <span>{emojiStr}</span>;
  };

  return (
    <div className="animate-fade-in space-y-8 relative">
        {pickerState && (
            <>
                <div className="fixed inset-0 z-[9990] bg-transparent" onClick={() => setPickerState(null)} />
                <EmojiPicker 
                    style={{ top: pickerState.top, left: pickerState.left }}
                    onSelect={handleEmojiSelect}
                    onClose={() => setPickerState(null)}
                    customEmojis={discordEmojis}
                />
            </>
        )}

        <div className="flex justify-end items-center">
            
            {!isCreating && (
                <Button onClick={() => { resetForm(); setIsCreating(true); }} icon={<Plus size={18} />} disabled={!discordGuildId || discordStatus !== 'connected'}>
                    {t.createNew}
                </Button>
            )}
        </div>

        {!discordGuildId || discordStatus !== 'connected' ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[32px] p-8 text-center">
                <AlertTriangle size={32} className="mx-auto text-amber-500 mb-4" />
                <p className="text-zinc-400 text-sm">{t.connectDiscordFirst}</p>
            </div>
        ) : isCreating ? (
            <div className={`glass-panel p-6 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} animate-slide-up`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black uppercase tracking-tight">{editingId ? 'Edit Buttons' : 'Create Buttons'}</h3>
                    <Button variant="secondary" size="sm" onClick={() => setIsCreating(false)}>Cancel</Button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Left: Config */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.menuName}</label>
                                <input type="text" value={newMenuName} onChange={e => setNewMenuName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-current-accent" placeholder="e.g. Color Roles" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.channel}</label>
                                <select 
                                    value={targetChannel} 
                                    onChange={e => setTargetChannel(e.target.value)} 
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-current-accent"
                                    disabled={!!editingId}
                                >
                                    <option value="">Select Channel...</option>
                                    {discordChannels?.map((c: any) => (
                                        <option key={c.id} value={c.id}>#{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.messageBody}</label>
                            <textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} className="w-full h-20 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-medium text-white outline-none focus:border-current-accent resize-none" />
                        </div>

                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.buttonsConfig}</label>
                                <button onClick={addButton} className="text-[10px] text-current-accent hover:underline flex items-center gap-1"><Plus size={12} /> {t.addButton}</button>
                            </div>
                            <div ref={buttonOrder.listRef} className="relative space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {buttonOrder.line}
                                {buttons.map((btn, idx) => (
                                    <div key={btn.id} {...buttonOrder.row(btn.id)} className={`bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex gap-2 items-center animate-slide-up ${buttonOrder.held === btn.id ? 'opacity-40' : ''}`}>
                                        {buttons.length > 1 && <DragGrip grip={buttonOrder.grip(btn.id)} title={t.buttonsDrag || 'Drag to change the order of the buttons'} className="-mx-1" />}
                                        <div className="flex flex-col gap-1 w-1/4">
                                            <input type="text" value={btn.label} onChange={e => updateButton(btn.id, 'label', e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white" placeholder="Label" />
                                            <div className="flex items-center gap-1">
                                                <input type="text" value={btn.emoji || ''} onChange={e => updateButton(btn.id, 'emoji', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400" placeholder="Emoji" />
                                                <button onClick={(e) => handlePickerOpen(`btn-${btn.id}`, e)} className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded"><Smile size={10} /></button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 w-1/4">
                                            <select value={btn.style} onChange={e => updateButton(btn.id, 'style', e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white">
                                                <option value="1">{t.styleBlurple || 'Blurple'}</option>
                                                <option value="2">{t.styleGrey || 'Grey'}</option>
                                                <option value="3">{t.styleGreen || 'Green'}</option>
                                                <option value="4">{t.styleRed || 'Red'}</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <select value={btn.roleId} onChange={e => updateButton(btn.id, 'roleId', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white">
                                                <option value="">Select Role</option>
                                                {discordRoles?.map((r: any) => <option key={r.id} value={r.id} style={{color: r.color ? `#${r.color.toString(16)}` : undefined}}>{r.name}</option>)}
                                            </select>
                                        </div>
                                        <button onClick={() => removeButton(btn.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <MessageSquare size={12} /> Live Preview
                        </label>
                        <div className="bg-[#313338] rounded-xl p-4 border border-[#2B2D31] font-sans text-sm relative shadow-xl">
                            {/* Message */}
                            <div className="flex items-start gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0">
                                    <div className="text-white font-bold">Bot</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white">Simon Says Bot</span>
                                        <span className="bg-[#5865F2] text-white text-[9px] px-1 rounded font-bold uppercase">Bot</span>
                                    </div>
                                    <div className="text-[#DBDEE1] mt-1 whitespace-pre-wrap">{messageBody}</div>
                                    {useEmbed && (
                                        <div className="mt-2 flex">
                                            <div className="w-1 rounded-l-md shrink-0" style={{ backgroundColor: embedConfig.color }}></div>
                                            <div className="bg-[#2B2D31] rounded-r-md p-4 w-full border border-[#1E1F22]">
                                                <div className="font-bold text-white text-base">{embedConfig.title}</div>
                                                <div className="text-[#DBDEE1] text-sm">{embedConfig.description}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Buttons Grid */}
                            <div className="pl-[52px] grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                                {buttons.map((btn, idx) => {
                                    let btnClass = 'bg-[#5865F2] hover:bg-[#4752C4]'; // 1
                                    if (btn.style === '2') btnClass = 'bg-[#4F545C] hover:bg-[#686D73]';
                                    if (btn.style === '3') btnClass = 'bg-[#2D7D46] hover:bg-[#3BA55D]';
                                    if (btn.style === '4') btnClass = 'bg-[#ED4245] hover:bg-[#ED4245]/80';
                                    
                                    return (
                                        <div key={idx} className={`${btnClass} text-white px-4 py-2 rounded-[3px] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm`}>
                                            {btn.emoji && renderEmoji(btn.emoji)}
                                            <span className="truncate">{btn.label || 'Button'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-800 flex justify-end">
                    <Button onClick={handleSubmit}>{editingId ? 'Save Changes' : 'Create Menu'}</Button>
                </div>
            </div>
        ) : (
            // --- LIST ---
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {discordButtonConfigs.length === 0 ? (
                    <div className="col-span-full text-center py-20 text-zinc-600 italic">{t.noButtons}</div>
                ) : (
                    discordButtonConfigs.map((config: DiscordButtonMessage) => (
                        <div key={config.id} className={`glass-panel p-6 rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} group relative flex flex-col`}>
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button onClick={() => handleEdit(config)} className="p-2 bg-zinc-900/80 rounded-xl text-zinc-500 hover:text-white transition-colors"><Edit2 size={16} /></button>
                                <button onClick={() => deleteButtonMenu(config.id)} className="p-2 bg-zinc-900/80 rounded-xl text-zinc-500 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                            
                            <div className="mb-4">
                                <h4 className="text-lg font-black text-white truncate pr-20">{config.name}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-1">
                                    <Hash size={10} />
                                    {discordChannels?.find((c:any) => c.id === config.channelId)?.name || config.channelId}
                                </div>
                            </div>

                            <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    {config.buttons.map((btn, idx) => (
                                        <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1 flex items-center gap-1 text-[10px] text-zinc-300">
                                            {btn.emoji && renderEmoji(btn.emoji)}
                                            <span>{btn.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Whether it is in Discord, and the way to put it there. */}
                            <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center gap-2" data-button-menu-status={config.messageId ? 'posted' : 'not-posted'}>
                                <span className={`flex-1 text-[10px] font-bold ${config.messageId ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {config.messageId ? (t.buttonMenuPosted || 'In Discord') : (t.buttonMenuNotPosted || 'Not in Discord yet')}
                                </span>
                                <button
                                    onClick={() => publish(config.id)}
                                    disabled={posting === config.id}
                                    className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-900 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white disabled:opacity-50"
                                >
                                    {posting === config.id ? (t.buttonMenuPosting || 'Posting…') : config.messageId ? (t.buttonMenuUpdate || 'Update in Discord') : (t.buttonMenuPost || 'Post to Discord')}
                                </button>
                            </div>
                            {postError[config.id] && <p className="mt-2 text-[10px] text-rose-400">{postError[config.id]}</p>}
                        </div>
                    ))
                )}
            </div>
        )}
    </div>
  );
};
