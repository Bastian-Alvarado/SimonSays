
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React from 'react';
import { Command, ThemeConfig } from '../../types';
import { Button } from '../Button';
import { Plus, Terminal, Edit2, Trash2, X, Clock, Shield, LayoutGrid, List, ArrowDownAZ, History } from 'lucide-react';
import { SortMode, sortForDisplay } from '../../utils';

/**
 * Permission and cooldown chips, shared by the card and row layouts so the two
 * cannot drift apart.
 *
 * `permissions` is optional-chained: the server normalises it on save, but a
 * command stored before those defaults existed would otherwise take the whole
 * screen down rather than simply showing no chips.
 */
const CommandBadges: React.FC<{ cmd: Command; t: any }> = ({ cmd, t }) => (
  <>
    {cmd.permissions?.anyone ? (
      <span className="px-2 py-1 rounded-md bg-zinc-800 text-[8px] font-black uppercase text-zinc-400">{t.permAnyone}</span>
    ) : (
      <>
        {cmd.permissions?.broadcaster && <span className="px-2 py-1 rounded-md bg-purple-500/10 text-[8px] font-black uppercase text-purple-500">{t.permOwner}</span>}
        {cmd.permissions?.moderators && <span className="px-2 py-1 rounded-md bg-rose-500/10 text-[8px] font-black uppercase text-rose-500">{t.permMods}</span>}
        {cmd.permissions?.vips && <span className="px-2 py-1 rounded-md bg-amber-500/10 text-[8px] font-black uppercase text-amber-500">{t.permVips}</span>}
        {cmd.permissions?.subscribers && <span className="px-2 py-1 rounded-md bg-blue-500/10 text-[8px] font-black uppercase text-blue-500">{t.permSubs}</span>}
      </>
    )}
    {(cmd.globalCooldown || cmd.userCooldown) && (
      <span className="px-2 py-1 rounded-md bg-zinc-800 text-[8px] font-black uppercase text-zinc-500 flex items-center gap-1">
        <Clock size={8} /> {cmd.globalCooldown || 0}s/{cmd.userCooldown || 0}s
      </span>
    )}
  </>
);

// The command editor dialog used to live here. It now renders from App so the
// Actions screen can open it too — see components/CommandEditorModal.tsx.
interface StudioViewProps {
  commands: Command[];
  setCommands: React.Dispatch<React.SetStateAction<Command[]>>;
  handleDeleteCommand: (id: string) => void;
  handleOpenCommandModal: (cmd?: Command) => void;
  activeTheme: ThemeConfig;
  t: any;
}

export const StudioView: React.FC<StudioViewProps> = ({
  commands,
  setCommands,
  handleDeleteCommand,
  handleOpenCommandModal,
  activeTheme,
  t
}) => {
  // Which layout to draw. A per-display preference like theme and font sizes,
  // so it stays device-local rather than syncing through the server — the
  // dashboard on a phone wants a different answer from the one on a monitor.
  const [layout, setLayoutState] = React.useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('commands_layout') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const setLayout = (next: 'grid' | 'list') => {
    setLayoutState(next);
    try {
      localStorage.setItem('commands_layout', next);
    } catch {
      /* private browsing: the choice just will not survive a reload */
    }
  };

  const [sort, setSortState] = React.useState<SortMode>(() => {
    try {
      return localStorage.getItem('commands_sort') === 'name' ? 'name' : 'created';
    } catch {
      return 'created';
    }
  });

  const setSort = (next: SortMode) => {
    setSortState(next);
    try {
      localStorage.setItem('commands_sort', next);
    } catch {
      /* private browsing: the choice just will not survive a reload */
    }
  };

  // Never sorts `commands` in place — that array is state owned further up.
  const visibleCommands = sortForDisplay(commands, sort);

  const toggleButton = (active: boolean, onClick: () => void, label: string, icon: React.ReactNode) => (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`p-2 rounded-lg transition-colors ${active ? 'bg-current-accent/10 text-current-accent' : 'text-zinc-600 hover:text-zinc-300'}`}
    >
      {icon}
    </button>
  );

  const layoutButton = (mode: 'grid' | 'list', label: string, icon: React.ReactNode) =>
    toggleButton(layout === mode, () => setLayout(mode), label, icon);

  const sortButton = (mode: SortMode, label: string, icon: React.ReactNode) =>
    toggleButton(sort === mode, () => setSort(mode), label, icon);

  return (
    <div className="animate-fade-in space-y-8">

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">  <div className="flex items-center gap-3"> <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1"> {sortButton('created', t.sortByCreated, <History size={16} />)} {sortButton('name', t.sortByName, <ArrowDownAZ size={16} />)} </div> <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1"> {layoutButton('grid', t.gridView, <LayoutGrid size={16} />)} {layoutButton('list', t.listView, <List size={16} />)} </div> <Button onClick={() => handleOpenCommandModal()} icon={<Plus size={18} />}>{t.addCommand}</Button> </div> </div>
      {commands.length === 0 ? (<div className="glass-panel p-20 rounded-[40px] border border-zinc-800 text-center flex flex-col items-center"> <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700 mb-6 border border-zinc-800"> <Terminal size={32} /> </div> <h3 className="text-xl font-extrabold uppercase tracking-tight mb-2">{t.noCommands}</h3> <p className="text-xs text-zinc-500 mb-8 max-w-xs mx-auto">{t.startBuildingCommand}</p> </div>) : layout === 'list' ? (<div className="flex flex-col gap-2"> {visibleCommands.map((cmd) => (<div key={cmd.id} className="glass-panel px-4 py-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all group flex items-center gap-4"> <div className="w-8 h-8 rounded-lg bg-current-accent/10 text-current-accent flex items-center justify-center flex-shrink-0"> <Terminal size={14} /> </div> <span className="font-black text-xs uppercase text-zinc-100 truncate w-40 sm:w-56 flex-shrink-0">{cmd.name}</span> <span className="text-[10px] text-zinc-500 font-mono truncate flex-1 min-w-0">{cmd.triggers?.length ? cmd.triggers.join('   ') : 'No triggers'}</span> <div className="hidden md:flex flex-wrap items-center gap-2 flex-shrink-0"> <CommandBadges cmd={cmd} t={t} /> </div> <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"> <button onClick={() => handleOpenCommandModal(cmd)} className="p-2 text-zinc-500 hover:text-white bg-zinc-900/50 rounded-lg"><Edit2 size={14} /></button> <button onClick={() => handleDeleteCommand(cmd.id)} className="p-2 text-zinc-500 hover:text-red-500 bg-zinc-900/50 rounded-lg"><Trash2 size={14} /></button> </div> </div>))} </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> {visibleCommands.map((cmd) => (<div key={cmd.id} className="glass-panel p-6 rounded-[32px] border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all group flex flex-col"> <div className="flex items-center justify-between mb-4"> <div className="flex items-center gap-3"> <div className="w-10 h-10 rounded-xl bg-current-accent/10 text-current-accent flex items-center justify-center"> <Terminal size={18} /> </div> <div className="flex flex-col"> <span className="font-black text-sm uppercase text-zinc-100">{cmd.name}</span> <span className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[120px]">{cmd.triggers.length > 0 ? cmd.triggers[0] : 'No triggers'} {cmd.triggers.length > 1 && `+${cmd.triggers.length - 1}`}</span> </div> </div> <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"> <button onClick={() => handleOpenCommandModal(cmd)} className="p-2 text-zinc-500 hover:text-white bg-zinc-900/50 rounded-lg"><Edit2 size={14} /></button> <button onClick={() => handleDeleteCommand(cmd.id)} className="p-2 text-zinc-500 hover:text-red-500 bg-zinc-900/50 rounded-lg"><Trash2 size={14} /></button> </div> </div> <div className="flex flex-wrap gap-2 mt-auto"> <CommandBadges cmd={cmd} t={t} /> </div> </div>))} </div>)}
    </div>
  );
};
