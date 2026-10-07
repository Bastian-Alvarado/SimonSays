
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { useDragOrder, DragGrip } from '../../hooks/useDragOrder';
import { moveToGap } from '../../../shared/list-order.js';
import { ThemeConfig, ReactionRoleMessage, ReactionMapping, DiscordEmbed, DiscordEmbedField } from '../../types';
import { Button } from '../Button';
import { Plus, Trash2, CheckCircle, MessageSquare, Hash, MousePointerClick, RefreshCcw, Edit2, Smile, AlertTriangle, Bot, List, Palette, Image as ImageIcon, Type, X, Loader2, ToggleRight, ToggleLeft, Layers, ShieldAlert, Copy, RefreshCw } from 'lucide-react';
import { EmojiPicker } from '../EmojiPicker';

interface ReactionRolesViewProps {
  activeTheme: ThemeConfig;
  t: any;
  system: any;
}

export const ReactionRolesView: React.FC<ReactionRolesViewProps> = ({ activeTheme, t, system }) => {
  const { reactionRoleConfigs, discordRoles, roleActivityLog, syncingMessageId, reactionSyncError } = system.data;
  const { createReactionRole, deleteReactionRole, updateReactionRole, fetchDiscordRoles, fetchDiscordChannels, fetchDiscordEmojis, handleSyncReactionRole } = system.actions;
  const { discordGuildId, discordChannels, discordEmojis } = system.connections; 
  const { discord: discordStatus } = system.status;
  
  const { botMember } = system.connections;
  const { fetchBotMember } = system.actions;

  const [activeTab, setActiveTab] = useState<'config' | 'log'>('config');

  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [messageIdToEdit, setMessageIdToEdit] = useState<string>('');

  const [newMenuName, setNewMenuName] = useState('');
  const [newMessageBody, setNewMessageBody] = useState('React to get your roles!');
  const [targetChannel, setTargetChannel] = useState('');
  const [mappings, setMappings] = useState<ReactionMapping[]>([{ emoji: '', roleId: '' }]);
  const [menuMode, setMenuMode] = useState<'standard' | 'unique'>('standard');
  
  // Embed State
  const [useEmbed, setUseEmbed] = useState(false);
  const [embedConfig, setEmbedConfig] = useState<DiscordEmbed>({
      title: 'Role Menu',
      description: 'React below to get roles!',
      color: '#5865F2',
      footer: '',
      thumbnail: '',
      fields: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingEmojis, setIsRefreshingEmojis] = useState(false);
  const [isRefreshingRoles, setIsRefreshingRoles] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Picker State
  const [pickerState, setPickerState] = useState<{ fieldId: string, top: number, left: number } | null>(null);

  // Hierarchy State
  const [botHighestRolePosition, setBotHighestRolePosition] = useState<number>(0);
  const [botHighestRoleName, setBotHighestRoleName] = useState<string>('None');

  // Fetch roles AND channels on mount if needed
  useEffect(() => {
      if (discordStatus === 'connected' && discordGuildId) {
          if (!discordRoles || discordRoles.length === 0) {
              fetchDiscordRoles(discordGuildId);
          }
          if (!discordChannels || discordChannels.length === 0) {
              fetchDiscordChannels(discordGuildId);
          }
          // Fetch emojis
          if (!discordEmojis || discordEmojis.length === 0) {
              fetchDiscordEmojis(discordGuildId);
          }
          // Fetch Bot Member for hierarchy check
          if (fetchBotMember) {
              fetchBotMember(discordGuildId);
          }
      }
  }, [discordStatus, discordGuildId]);

  // Calculate Bot's Highest Role
  useEffect(() => {
      if (discordRoles && botMember && botMember.roles) {
          // Filter roles that the bot has
          const botRoles = discordRoles.filter((r: any) => botMember.roles.includes(r.id));
          if (botRoles.length > 0) {
              const sorted = botRoles.sort((a: any, b: any) => b.position - a.position);
              setBotHighestRolePosition(sorted[0].position);
              setBotHighestRoleName(sorted[0].name);
          } else {
              setBotHighestRolePosition(0);
              setBotHighestRoleName('None / Everyone');
          }
      } else {
          // Fallback if data is missing
          setBotHighestRolePosition(0);
          setBotHighestRoleName('Unknown');
      }
  }, [discordRoles, botMember]);

  useEffect(() => {
      if (isSubmitting) {
          setIsSubmitting(false);
          setIsCreating(false);
          setEditingId(null);
          resetForm();
      }
  }, [reactionRoleConfigs, isSubmitting]);

  // Reset loading states
  useEffect(() => {
      if (isRefreshingEmojis) {
          const t = setTimeout(() => setIsRefreshingEmojis(false), 2000);
          return () => clearTimeout(t);
      }
  }, [discordEmojis]);

  useEffect(() => {
      if (isRefreshingRoles) {
          const t = setTimeout(() => setIsRefreshingRoles(false), 2000);
          return () => clearTimeout(t);
      }
  }, [discordRoles, botMember]); 

  const resetForm = () => {
      setNewMenuName('');
      setNewMessageBody('React to get your roles!');
      setTargetChannel('');
      setMappings([{ emoji: '', roleId: '' }]);
      setEditingId(null);
      setMessageIdToEdit('');
      setUseEmbed(false);
      setMenuMode('standard');
      setEmbedConfig({ title: 'Role Menu', description: 'React below to get roles!', color: '#5865F2', fields: [] });
  };

  const handleEdit = (config: ReactionRoleMessage) => {
      setEditingId(config.id);
      setMessageIdToEdit(config.messageId);
      setNewMenuName(config.name);
      setNewMessageBody(config.content);
      setTargetChannel(config.channelId);
      setMenuMode(config.mode || 'standard');
      setMappings(config.mappings.length > 0 ? config.mappings : [{ emoji: '', roleId: '' }]);
      
      if (config.embed) {
          setUseEmbed(true);
          setEmbedConfig({ ...config.embed, fields: config.embed.fields || [] });
      } else {
          setUseEmbed(false);
      }
      
      setIsCreating(true);
  };

  const handleAddMapping = () => {
      setMappings([...mappings, { emoji: '', roleId: '' }]);
  };

  const handleRemoveMapping = (index: number) => {
      setMappings(mappings.filter((_, i) => i !== index));
  };

  // The order here is the order the bot adds the reactions in.
  const mappingOrder = useDragOrder(({ from, gap }) => setMappings(prev => moveToGap(prev, from, gap)));

  const handleUpdateMapping = (index: number, field: keyof ReactionMapping, value: string) => {
      const newMappings = [...mappings];
      newMappings[index] = { ...newMappings[index], [field]: value };
      if (field === 'roleId') {
          const role = discordRoles.find((r: any) => r.id === value);
          if (role) newMappings[index].roleName = role.name;
      }
      setMappings(newMappings);
  };

  const handleAddField = () => {
      setEmbedConfig(prev => ({
          ...prev,
          fields: [...(prev.fields || []), { name: 'New Field', value: 'Value', inline: false }]
      }));
  };

  const handleRemoveField = (index: number) => {
      setEmbedConfig(prev => ({
          ...prev,
          fields: (prev.fields || []).filter((_, i) => i !== index)
      }));
  };

  const handleUpdateField = (index: number, key: keyof DiscordEmbedField, value: any) => {
      const newFields = [...(embedConfig.fields || [])];
      newFields[index] = { ...newFields[index], [key]: value };
      setEmbedConfig(prev => ({ ...prev, fields: newFields }));
  };

  const handlePickerOpen = (fieldId: string, e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      
      let top = rect.bottom + 8;
      let left = rect.left;
      
      if (top + 400 > window.innerHeight) {
          top = rect.top - 408; 
      }

      setPickerState({ fieldId, top, left });
  };

  const handleEmojiSelect = (emoji: string) => {
      if (!pickerState) return;
      const { fieldId } = pickerState;

      if (fieldId.startsWith('mapping-')) {
          const index = parseInt(fieldId.split('-')[1]);
          handleUpdateMapping(index, 'emoji', emoji);
      } else if (fieldId === 'body') {
          setNewMessageBody(prev => prev + emoji);
      } else if (fieldId === 'embed-title') {
          setEmbedConfig(prev => ({ ...prev, title: (prev.title || '') + emoji }));
      } else if (fieldId === 'embed-desc') {
          setEmbedConfig(prev => ({ ...prev, description: (prev.description || '') + emoji }));
      } else if (fieldId === 'embed-footer') {
          setEmbedConfig(prev => ({ ...prev, footer: (prev.footer || '') + emoji }));
      } else if (fieldId.startsWith('field-name-')) {
          const index = parseInt(fieldId.split('field-name-')[1]);
          const current = embedConfig.fields?.[index]?.name || '';
          handleUpdateField(index, 'name', current + emoji);
      } else if (fieldId.startsWith('field-val-')) {
          const index = parseInt(fieldId.split('field-val-')[1]);
          const current = embedConfig.fields?.[index]?.value || '';
          handleUpdateField(index, 'value', current + emoji);
      }
  };

  const renderEmojiPreview = (emojiString: string) => {
      const match = emojiString.match(/<a?:.+?:(\d+)>/);
      if (match) {
          const isAnimated = emojiString.startsWith('<a:');
          return <img src={`https://cdn.discordapp.com/emojis/${match[1]}.${isAnimated ? 'gif' : 'png'}`} className="w-5 h-5 object-contain" alt="emoji" />;
      }
      return <span>{emojiString}</span>;
  };

  const handleRefreshEmojis = () => {
      if (discordGuildId) {
          setIsRefreshingEmojis(true);
          fetchDiscordEmojis(discordGuildId);
      }
  };

  // UPDATED: Refresh both Roles and Bot Member data
  const handleRefreshRoles = () => {
      if (discordGuildId) {
          setIsRefreshingRoles(true);
          fetchDiscordRoles(discordGuildId);
          if (fetchBotMember) {
              fetchBotMember(discordGuildId);
          }
      }
  };

  const handleSubmit = () => {
      if (!newMenuName || (!newMessageBody && !useEmbed) || !targetChannel) return;
      setIsSubmitting(true);
      
      const config: ReactionRoleMessage = {
          id: editingId || Math.random().toString(36).substr(2, 9),
          messageId: editingId ? messageIdToEdit : '', 
          channelId: targetChannel,
          guildId: discordGuildId || '',
          name: newMenuName,
          content: newMessageBody,
          mode: menuMode,
          embed: useEmbed ? embedConfig : undefined,
          mappings: mappings.filter(m => m.emoji && m.roleId)
      };

      if (editingId) {
          updateReactionRole(config);
      } else {
          createReactionRole(config);
      }
  };

  // Helper to check role validity
  const isRoleInvalid = (roleId: string) => {
      if (!roleId) return false;
      const role = discordRoles?.find((r: any) => r.id === roleId);
      if (!role) return false; // Role might be deleted
      return role.position >= botHighestRolePosition;
  };

  return (
    <div className="animate-fade-in space-y-8 relative">
      {/* Global Fixed Picker */}
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

      {/* Deletion Modal */}
      {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setDeletingId(null)}>
              <div className={`max-w-md w-full glass-panel rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} shadow-2xl p-6`} onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-black uppercase tracking-tight text-white">Delete Menu?</h3>
                      <p className="text-sm text-zinc-400">
                          Do you want to delete this menu from Discord as well, or just remove it from the dashboard?
                      </p>
                      <div className="flex gap-3 w-full pt-4">
                          <Button variant="secondary" onClick={() => setDeletingId(null)} className="flex-1">Cancel</Button>
                          <Button variant="danger" onClick={() => { deleteReactionRole(deletingId, true); setDeletingId(null); }} className="flex-1">Delete Everywhere</Button>
                      </div>
                      <button onClick={() => { deleteReactionRole(deletingId, false); setDeletingId(null); }} className="text-[10px] text-zinc-600 hover:text-zinc-400 hover:underline">
                          Remove from Dashboard only
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
        
        <div className="flex gap-2">
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-current-accent text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t.configure}</button>
                <button onClick={() => setActiveTab('log')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'log' ? 'bg-current-accent text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t.activityLog}</button>
            </div>
            {activeTab === 'config' && (
                <Button onClick={() => { resetForm(); setIsCreating(true); }} icon={<Plus size={18} />} disabled={!discordGuildId || discordStatus !== 'connected'}>
                    {t.createNew}
                </Button>
            )}
        </div>
      </div>

      {!discordGuildId || discordStatus !== 'connected' ? (
          <div className={`p-8 rounded-[32px] border border-dashed border-zinc-700 bg-zinc-900/20 text-center`}>
              <div className="text-zinc-500 text-sm font-medium">{t.connectDiscordFirst || 'Please connect Discord and select a server in the Connections tab.'}</div>
          </div>
      ) : activeTab === 'log' ? (
          // --- ACTIVITY LOG TAB ---
          <div className={`glass-panel p-6 rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} min-h-[400px]`}>
              <div className="flex items-center gap-3 mb-6 px-2">
                  <List size={20} className="text-zinc-400" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Recent Role Activity</h3>
              </div>
              <div className="space-y-2">
                  {roleActivityLog.length === 0 ? (
                      <div className="text-center py-20 text-zinc-600 italic">{t.noActivity}</div>
                  ) : (
                      roleActivityLog.map(entry => (
                          <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-900/60 transition-colors">
                              <div className="flex items-center gap-4">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${entry.action === 'added' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                      {entry.action === 'added' ? <Plus size={14} /> : <Trash2 size={14} />}
                                  </div>
                                  <div>
                                      <div className="flex items-baseline gap-2">
                                          <span className="text-xs font-bold text-white" title={(entry as any).userId || undefined}>{entry.user}</span>
                                          <span className={`text-[10px] font-black uppercase ${entry.action === 'added' ? 'text-green-500' : 'text-red-500'}`}>
                                              {entry.action === 'added' ? t.logAdded : t.logRemoved}
                                          </span>
                                      </div>
                                      <div className="text-[10px] text-zinc-500">
                                          Role: <span className="text-zinc-300 font-bold">{entry.roleName}</span> • Menu: {entry.menuName}
                                      </div>
                                  </div>
                              </div>
                              <div className="text-[10px] font-mono text-zinc-600">
                                  {new Date(entry.timestamp).toLocaleTimeString()}
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      ) : isCreating ? (
          // --- CREATE / EDIT FORM ---
          <div className={`glass-panel p-6 sm:p-8 rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} animate-fade-in`}>
              <h3 className="text-xl font-black uppercase tracking-tight mb-6">{editingId ? 'Edit Menu' : t.createMenu}</h3>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Left Column: Form */}
                  <div className="space-y-6">
                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.menuName}</label>
                              <input type="text" value={newMenuName} onChange={e => setNewMenuName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-current-accent" placeholder="e.g. Game Roles" />
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

                      {/* Mode & Embed Toggles */}
                      <div className="grid grid-cols-2 gap-4">
                          {/* Selection Mode Toggle */}
                          <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.selectionMode}</label>
                              <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                                  <button onClick={() => setMenuMode('standard')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${menuMode === 'standard' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>
                                      {t.modeStandard || 'Standard'}
                                  </button>
                                  <button onClick={() => setMenuMode('unique')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${menuMode === 'unique' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500'}`}>
                                      {t.modeUnique || 'Unique'}
                                  </button>
                              </div>
                              <p className="text-[9px] text-zinc-600">{t.modeDesc}</p>
                          </div>

                          {/* Embed Toggle */}
                          <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.useEmbed}</label>
                              <div onClick={() => setUseEmbed(!useEmbed)} className={`w-full h-[42px] bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex items-center px-3 cursor-pointer justify-between ${useEmbed ? 'border-current-accent/50' : ''}`}>
                                  <span className={`text-xs font-bold ${useEmbed ? 'text-current-accent' : 'text-zinc-500'}`}>{useEmbed ? 'Enabled' : 'Disabled'}</span>
                                  <div className={`w-10 h-6 rounded-full p-1 transition-colors ${useEmbed ? 'bg-current-accent' : 'bg-zinc-700'}`}>
                                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${useEmbed ? 'translate-x-4' : ''}`} />
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-2 relative">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.messageBody}</label>
                          <textarea value={newMessageBody} onChange={e => setNewMessageBody(e.target.value)} className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-medium text-white outline-none focus:border-current-accent resize-none pr-8" />
                          <button 
                            onClick={(e) => handlePickerOpen('body', e)}
                            className="absolute top-8 right-2 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
                          >
                              <Smile size={12} />
                          </button>
                          <p className="text-[9px] text-zinc-600">This text appears above the embed (if enabled). Clear it to send only the embed.</p>
                      </div>

                      {/* Message Content / Embed Config */}
                      {useEmbed && (
                          <div className="space-y-4 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50 animate-slide-up">
                              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  <Palette size={12} /> {t.embedBuilder}
                              </div>
                              <div className="space-y-2 relative">
                                  <label className="text-[9px] font-bold uppercase text-zinc-500">{t.title}</label>
                                  <input type="text" value={embedConfig.title} onChange={e => setEmbedConfig({...embedConfig, title: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-current-accent pr-8" />
                                  <button 
                                    onClick={(e) => handlePickerOpen('embed-title', e)}
                                    className="absolute top-6 right-1 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
                                  >
                                      <Smile size={12} />
                                  </button>
                              </div>
                              <div className="space-y-2 relative">
                                  <label className="text-[9px] font-bold uppercase text-zinc-500">{t.description}</label>
                                  <textarea value={embedConfig.description} onChange={e => setEmbedConfig({...embedConfig, description: e.target.value})} className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-current-accent resize-none pr-8" />
                                  <button 
                                    onClick={(e) => handlePickerOpen('embed-desc', e)}
                                    className="absolute top-6 right-2 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
                                  >
                                      <Smile size={12} />
                                  </button>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                      <label className="text-[9px] font-bold uppercase text-zinc-500">{t.color}</label>
                                      <div className="flex items-center gap-2">
                                          <input type="color" value={embedConfig.color} onChange={e => setEmbedConfig({...embedConfig, color: e.target.value})} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                                          <input type="text" value={embedConfig.color} onChange={e => setEmbedConfig({...embedConfig, color: e.target.value})} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono outline-none focus:border-current-accent" />
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-[9px] font-bold uppercase text-zinc-500">{t.thumbnail}</label>
                                      <input type="text" value={embedConfig.thumbnail || ''} onChange={e => setEmbedConfig({...embedConfig, thumbnail: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-current-accent" placeholder="https://..." />
                                  </div>
                              </div>
                              
                              {/* Embed Fields Section */}
                              <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                      <label className="text-[9px] font-bold uppercase text-zinc-500">Fields ({embedConfig.fields?.length || 0}/25)</label>
                                      <button onClick={handleAddField} className="text-[9px] text-current-accent hover:underline flex items-center gap-1">
                                          <Plus size={10} /> Add Field
                                      </button>
                                  </div>
                                  
                                  <div className="space-y-2">
                                      {embedConfig.fields && embedConfig.fields.map((field, idx) => (
                                          <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2 relative group animate-slide-up">
                                              <button onClick={() => handleRemoveField(idx)} className="absolute top-2 right-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <Trash2 size={14} />
                                              </button>
                                              
                                              <div className="flex gap-2">
                                                  <div className="flex-1 space-y-1 relative">
                                                      <label className="text-[8px] font-bold uppercase text-zinc-500">Name</label>
                                                      <input 
                                                        type="text" 
                                                        value={field.name} 
                                                        onChange={(e) => handleUpdateField(idx, 'name', e.target.value)} 
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-current-accent pr-6" 
                                                      />
                                                      <button 
                                                        onClick={(e) => handlePickerOpen(`field-name-${idx}`, e)}
                                                        className="absolute bottom-1 right-1 p-0.5 text-zinc-500 hover:text-white"
                                                      >
                                                          <Smile size={10} />
                                                      </button>
                                                  </div>
                                                  <div className="w-16 space-y-1 flex flex-col items-center">
                                                      <label className="text-[8px] font-bold uppercase text-zinc-500">Inline</label>
                                                      <button 
                                                        onClick={() => handleUpdateField(idx, 'inline', !field.inline)}
                                                        className={`w-10 h-6 rounded-full p-1 transition-colors ${field.inline ? 'bg-current-accent' : 'bg-zinc-800'}`}
                                                      >
                                                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${field.inline ? 'translate-x-4' : ''}`} />
                                                      </button>
                                                  </div>
                                              </div>
                                              
                                              <div className="space-y-1 relative">
                                                  <label className="text-[8px] font-bold uppercase text-zinc-500">Value</label>
                                                  <textarea 
                                                    value={field.value} 
                                                    onChange={(e) => handleUpdateField(idx, 'value', e.target.value)} 
                                                    className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-current-accent resize-none pr-6" 
                                                  />
                                                  <button 
                                                    onClick={(e) => handlePickerOpen(`field-val-${idx}`, e)}
                                                    className="absolute bottom-1 right-1 p-0.5 text-zinc-500 hover:text-white"
                                                  >
                                                      <Smile size={10} />
                                                  </button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                              <div className="space-y-2 relative">
                                  <label className="text-[9px] font-bold uppercase text-zinc-500">{t.footer}</label>
                                  <input type="text" value={embedConfig.footer || ''} onChange={e => setEmbedConfig({...embedConfig, footer: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-current-accent pr-8" />
                                  <button 
                                    onClick={(e) => handlePickerOpen('embed-footer', e)}
                                    className="absolute top-6 right-1 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
                                  >
                                      <Smile size={12} />
                                  </button>
                              </div>
                          </div>
                      )}

                      {/* Roles Mapping */}
                      <div className="space-y-4">
                          <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.rolesConfiguration}</label>
                              <div className="flex gap-2">
                                  <button onClick={handleRefreshEmojis} className="text-[10px] text-current-accent hover:underline flex items-center gap-1 transition-all">
                                      {isRefreshingEmojis ? <Loader2 size={10} className="animate-spin" /> : <Smile size={10} />} 
                                      Refresh Emojis
                                  </button>
                                  <button onClick={handleRefreshRoles} className="text-[10px] text-current-accent hover:underline flex items-center gap-1">
                                      {isRefreshingRoles ? <Loader2 size={10} className="animate-spin" /> : <RefreshCcw size={10} />} 
                                      Refresh Roles
                                  </button>
                              </div>
                          </div>

                          {/* Hierarchy Warning Banner */}
                          {!botMember && (
                              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
                                  <ShieldAlert className="text-amber-500 shrink-0" size={18} />
                                  <div>
                                      <h4 className="text-xs font-bold text-amber-500 uppercase">{t.hierarchyWarning || 'Hierarchy Check Failed'}</h4>
                                      <p className="text-[10px] text-amber-200/80 mb-2">
                                          {t.hierarchyFix || "The app cannot see the Bot's role position. Roles may appear locked."}
                                      </p>
                                      <p className="text-[10px] font-bold text-white mb-1">{t.fixSteps || 'Fix Steps'}:</p>
                                      <ol className="list-decimal list-inside text-[10px] text-zinc-300 space-y-1">
                                          <li>{t.step1 || 'Go to Connections tab'}</li>
                                          <li>{t.step2 || 'Copy new server.js code'}</li>
                                          <li>{t.step3 || 'Restart local server'}</li>
                                          <li>{t.step4 || 'Click Refresh Roles'}</li>
                                      </ol>
                                  </div>
                              </div>
                          )}

                          {/* Hierarchy Info Bar */}
                          {botMember && (
                              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-2 flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                                  <div className="flex items-center gap-2">
                                      <Bot size={12} />
                                      <span>{t.myHighestRole || 'My Highest Role'}: <strong className="text-white">{botHighestRoleName}</strong></span>
                                  </div>
                                  <span>{t.rolePosition || 'Position'}: <strong className="text-white">{botHighestRolePosition}</strong></span>
                              </div>
                          )}
                          
                          <div ref={mappingOrder.listRef} className="bg-black/20 rounded-2xl p-4 border border-zinc-800/50 space-y-3 max-h-[300px] overflow-y-auto relative">
                              {mappingOrder.line}
                              {mappings.map((map, idx) => (
                                  <div key={idx} {...mappingOrder.row(String(idx))} className={`flex gap-2 items-center animate-slide-up relative ${mappingOrder.held === String(idx) ? 'opacity-40' : ''}`}>
                                      {mappings.length > 1 && <DragGrip grip={mappingOrder.grip(String(idx))} title={t.reactionRolesDrag || 'Drag to change the order of the reactions'} className="-mx-1" />}
                                      <div className="w-12 flex-shrink-0 relative">
                                          <input 
                                            type="text" 
                                            value={map.emoji} 
                                            onChange={e => handleUpdateMapping(idx, 'emoji', e.target.value)} 
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-center text-lg outline-none focus:border-current-accent" 
                                            placeholder="😀"
                                          />
                                          <button 
                                            onClick={(e) => handlePickerOpen(`mapping-${idx}`, e)}
                                            className="absolute -right-2 -top-2 bg-zinc-800 hover:bg-current-accent text-white rounded-full p-1 shadow-lg"
                                          >
                                              <Smile size={10} />
                                          </button>
                                      </div>
                                      <div className="flex-1 relative">
                                          <select 
                                            value={map.roleId} 
                                            onChange={e => handleUpdateMapping(idx, 'roleId', e.target.value)} 
                                            className={`w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs font-medium text-white outline-none focus:border-current-accent ${isRoleInvalid(map.roleId) ? 'border-amber-500/50' : ''}`}
                                          >
                                              <option value="">{t.selectRole}</option>
                                              {discordRoles?.map((r: any) => (
                                                  <option 
                                                    key={r.id} 
                                                    value={r.id} 
                                                    disabled={r.position >= botHighestRolePosition}
                                                    className={r.position >= botHighestRolePosition ? 'text-zinc-500 italic' : ''}
                                                  >
                                                      {r.name} {r.position >= botHighestRolePosition ? '(Bot Role Too Low)' : ''}
                                                  </option>
                                              ))}
                                          </select>
                                          
                                          {/* Warning Icon if selected role is invalid */}
                                          {isRoleInvalid(map.roleId) && (
                                              <div className="absolute right-8 top-1/2 -translate-y-1/2 text-amber-500" title="Bot role is too low to assign this role.">
                                                  <AlertTriangle size={14} />
                                              </div>
                                          )}
                                      </div>
                                      <button onClick={() => handleRemoveMapping(idx)} className="p-2 text-zinc-600 hover:text-red-500 transition-colors">
                                          <Trash2 size={16} />
                                      </button>
                                  </div>
                              ))}
                              <button onClick={handleAddMapping} className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-500 text-xs font-bold hover:text-white hover:border-zinc-500 transition-all flex items-center justify-center gap-2">
                                  <Plus size={14} /> {t.addRole}
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* Right Column: Preview */}
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                          <MessageSquare size={12} /> Live Preview
                      </label>
                      <div className="bg-[#313338] rounded-xl p-4 border border-[#2B2D31] font-sans text-sm relative shadow-xl">
                          {/* Discord Header Simulator */}
                          <div className="flex items-start gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0">
                                  <Bot size={20} className="text-white" />
                              </div>
                              <div className="w-full">
                                  <div className="flex items-center gap-2">
                                      <span className="font-bold text-white">Simon Says Bot</span>
                                      <span className="bg-[#5865F2] text-white text-[9px] px-1 rounded font-bold uppercase">Bot</span>
                                      <span className="text-xs text-[#949BA4]">Today at {new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                  </div>
                                  
                                  {/* Simple Message Content */}
                                  <div className="text-[#DBDEE1] mt-1 whitespace-pre-wrap">{newMessageBody}</div>

                                  {/* RICH EMBED RENDER */}
                                  {useEmbed && (
                                      <div className="mt-2 flex">
                                          <div className="w-1 rounded-l-md shrink-0" style={{ backgroundColor: embedConfig.color }}></div>
                                          <div className="bg-[#2B2D31] rounded-r-md p-4 w-full border border-[#1E1F22] relative">
                                              <div className="flex gap-4">
                                                  <div className="flex-1 space-y-2">
                                                      {embedConfig.title && <div className="font-bold text-white text-base">{embedConfig.title}</div>}
                                                      {embedConfig.description && <div className="text-[#DBDEE1] text-sm whitespace-pre-wrap leading-relaxed">{embedConfig.description}</div>}
                                                      
                                                      {/* FIELDS RENDER */}
                                                      {embedConfig.fields && embedConfig.fields.length > 0 && (
                                                          <div className="grid grid-cols-12 gap-2 mt-2">
                                                              {embedConfig.fields.map((field, i) => (
                                                                  <div key={i} className={`${field.inline ? 'col-span-4' : 'col-span-12'}`}>
                                                                      <div className="text-xs font-bold text-white mb-1">{field.name}</div>
                                                                      <div className="text-xs text-[#DBDEE1] whitespace-pre-wrap">{field.value}</div>
                                                                  </div>
                                                              ))}
                                                          </div>
                                                      )}
                                                  </div>
                                                  {embedConfig.thumbnail && (
                                                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#1E1F22]">
                                                          <img src={embedConfig.thumbnail} className="w-full h-full object-cover" alt="Thumb" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                                      </div>
                                                  )}
                                              </div>
                                              {embedConfig.footer && (
                                                  <div className="mt-3 pt-2 text-[10px] text-[#949BA4] font-bold border-t border-[#3F4147]">
                                                      {embedConfig.footer}
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* Reaction Simulator */}
                          <div className="pl-[52px] flex flex-wrap gap-1 mt-1">
                              {mappings.filter(m => m.emoji).map((m, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-[#2B2D31] hover:bg-[#373A40] border border-transparent hover:border-[#5865F2] rounded-[4px] px-1.5 py-0.5 cursor-pointer transition-colors">
                                      {renderEmojiPreview(m.emoji)}
                                      <span className="text-xs font-bold text-[#949BA4]">1</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-2 text-center">
                          This preview mimics the Discord dark theme.
                      </p>
                  </div>
              </div>

              <div className="flex gap-3 mt-8 pt-6 border-t border-zinc-800">
                  <Button variant="secondary" onClick={() => { setIsCreating(false); setEditingId(null); }} disabled={isSubmitting}>Cancel</Button>
                  <Button onClick={handleSubmit} isLoading={isSubmitting}>{editingId ? 'Save Changes' : t.createMenu}</Button>
              </div>
          </div>
      ) : (
          // --- LIST VIEW ---
          <div>
              <div className="flex items-center gap-2 mb-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  <MousePointerClick size={14} /> {t.activeMenus}
              </div>
              
              {reactionRoleConfigs.length === 0 ? (
                  <div className="text-center py-20 bg-zinc-900/20 rounded-[40px] border border-dashed border-zinc-800">
                      <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-700">
                          <MessageSquare size={24} />
                      </div>
                      <p className="text-zinc-500 font-medium">{t.noActiveMenus}</p>
                      <p className="text-zinc-600 text-sm mt-1">{t.createFirstMenu}</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {reactionRoleConfigs.map((config: ReactionRoleMessage) => (
                          <div key={config.id} className={`glass-panel p-6 rounded-[32px] border ${activeTheme.borderClass} ${activeTheme.panelClass} group relative flex flex-col`}>
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  {/* Sync Button */}
                                  <button 
                                    onClick={() => handleSyncReactionRole(config)} 
                                    className={`p-2 rounded-xl text-zinc-500 hover:text-white transition-colors ${syncingMessageId === (config.messageId || config.id) ? 'bg-current-accent text-white animate-pulse' : 'bg-zinc-900/80'}`} 
                                    title={t.syncReactions}
                                    disabled={syncingMessageId === (config.messageId || config.id)}
                                  >
                                      {syncingMessageId === (config.messageId || config.id) ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                  </button>
                                  <button onClick={() => handleEdit(config)} className="p-2 bg-zinc-900/80 rounded-xl text-zinc-500 hover:text-white transition-colors" title="Edit Menu">
                                      <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => setDeletingId(config.id)} className="p-2 bg-zinc-900/80 rounded-xl text-zinc-500 hover:text-red-500 transition-colors" title="Delete Menu">
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                              
                              <div className="mb-4">
                                  <h4 className="text-lg font-black text-white truncate pr-20">{config.name}</h4>
                                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-1">
                                      <Hash size={10} />
                                      {discordChannels?.find((c:any) => c.id === config.channelId)?.name || config.channelId}
                                      {config.mode === 'unique' && (
                                          <span className="ml-1 bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded text-[9px] font-bold">UNIQUE</span>
                                      )}
                                  </div>
                              </div>
                              
                              {/* Preview Mini */}
                              <div className={`p-3 rounded-xl border border-white/5 mb-4 text-xs relative overflow-hidden ${config.embed ? '' : 'bg-black/20 text-zinc-300 italic'}`}>
                                  {config.embed ? (
                                      <div className="flex">
                                          <div className="w-1 rounded-l-sm shrink-0 mr-2" style={{ backgroundColor: config.embed.color }}></div>
                                          <div className="flex-1">
                                              <div className="font-bold text-white mb-1">{config.embed.title}</div>
                                              <div className="text-zinc-400 line-clamp-2 text-[10px]">{config.embed.description}</div>
                                              {/* Field count hint */}
                                              {config.embed.fields && config.embed.fields.length > 0 && (
                                                  <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-600 font-bold bg-black/20 px-1.5 py-0.5 rounded w-fit">
                                                      <Layers size={8} /> {config.embed.fields.length} Fields
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  ) : (
                                      <span className="line-clamp-3">"{config.content}"</span>
                                  )}
                              </div>
                              
                              <div className="space-y-1 flex-1">
                                  {config.mappings.slice(0, 3).map((m, idx) => (
                                      <div key={idx} className="flex items-center justify-between bg-zinc-900/40 px-3 py-1.5 rounded-lg">
                                          <div className="text-lg flex items-center justify-center h-6">{renderEmojiPreview(m.emoji)}</div>
                                          <div className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                                              {m.roleName || discordRoles?.find((r:any) => r.id === m.roleId)?.name || m.roleId}
                                          </div>
                                      </div>
                                  ))}
                                  {config.mappings.length > 3 && (
                                      <div className="text-center text-[10px] text-zinc-600 font-bold">+{config.mappings.length - 3} more</div>
                                  )}
                              </div>
                              
                              {reactionSyncError?.id === config.id && (
                                  <div className="mt-3 text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 normal-case tracking-normal">
                                      {t.syncFailed}: {reactionSyncError.message}
                                  </div>
                              )}
                              <div className="mt-4 pt-3 border-t border-zinc-800/50 flex justify-between items-center text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                                  {syncingMessageId === (config.messageId || config.id) ? (
                                      <span className="text-current-accent animate-pulse">{t.syncing}</span>
                                  ) : (
                                      <span>{config.messageId ? 'Active' : 'Creating...'}</span>
                                  )}
                                  {config.messageId ? <CheckCircle size={12} className="text-green-500" /> : <div className="w-3 h-3 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}
    </div>
  );
};
