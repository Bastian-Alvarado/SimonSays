/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The profile bar that sits above a section it applies to.
 *
 * One group can cover several screens — commands, actions and dock actions are
 * one profile between them, because a dock button names an action and an action
 * names the command that triggers it. So the same bar appears on all three, and
 * switching from any of them moves all three together.
 *
 * Switching is confirmed, and confirming it saves: the server has no path
 * through a switch that loses work. Abandoning changes is what Revert is for,
 * and it has to happen before the switch rather than after — which is why the
 * unsaved marker is on screen rather than buried in a menu.
 */
import React, { useState } from 'react';
import { Button } from './Button';
import { fill } from '../words';
import {
  Layers, Plus, Copy, Pencil, Trash2, Save, Undo2, Check, ChevronDown,
} from 'lucide-react';

export interface ProfileGroupState {
  id: string;
  label: string;
  collections: string[];
  active: string;
  /** Whether the live configuration differs from this profile's saved copy. */
  dirty: boolean;
  profiles: { id: string; name: string; items: number }[];
}

interface ProfileSwitcherProps {
  /** Which group this section belongs to: automation, alerts or overlays. */
  group: string;
  profiles: ProfileGroupState[];
  actions: {
    profileSwitch: (group: string, id: string) => void;
    profileSave: (group: string) => void;
    profileRevert: (group: string) => void;
    profileCreate: (group: string, name: string) => void;
    profileDuplicate: (group: string, name: string) => void;
    profileRename: (group: string, id: string, name: string) => void;
    profileDelete: (group: string, id: string) => void;
  };
  t: any;
}

/** The server names the groups in English; the bar says them in the screen's language. */
const GROUP_KEYS: Record<string, string> = {
  automation: 'profileGroupAutomation',
  alerts: 'profileGroupAlerts',
  overlays: 'profileGroupOverlays',
};

export const ProfileSwitcher: React.FC<ProfileSwitcherProps> = ({ group, profiles, actions, t }) => {
  const [open, setOpen] = useState(false);
  const state = profiles.find((g) => g.id === group);
  if (!state) return null;

  const active = state.profiles.find((p) => p.id === state.active);
  const label = t[GROUP_KEYS[group]] || state.label;
  const atCapacity = state.profiles.length >= 12;

  const switchTo = (id: string) => {
    setOpen(false);
    if (id === state.active) return;
    const target = state.profiles.find((p) => p.id === id);
    // Naming what is about to be saved, and what is about to replace it. The
    // switch is not reversible by switching back once the outgoing profile has
    // been overwritten with the current work.
    const names = { active: active?.name, target: target?.name, group: label.toLowerCase() };
    const message = state.dirty
      ? fill(t.profileSaveAndLoadConfirm || 'Save your changes to “{active}” and load “{target}”?\n\nEverything in {group} is replaced.', names)
      : fill(t.profileLoadConfirm || 'Load “{target}”?\n\nEverything in {group} is replaced.', names);
    if (!window.confirm(message)) return;
    actions.profileSwitch(group, id);
  };

  const create = () => {
    setOpen(false);
    const name = window.prompt(t.profileNewPrompt || 'Name for the new, empty profile');
    if (name?.trim()) actions.profileCreate(group, name.trim());
  };

  const duplicate = () => {
    setOpen(false);
    const name = window.prompt(t.profileCopyPrompt || 'Name for the copy', fill(t.profileCopyName || '{name} copy', { name: active?.name }));
    if (name?.trim()) actions.profileDuplicate(group, name.trim());
  };

  const rename = () => {
    setOpen(false);
    const name = window.prompt(t.profileRenamePrompt || 'Rename this profile', active?.name || '');
    if (name?.trim()) actions.profileRename(group, state.active, name.trim());
  };

  const remove = (id: string, name: string) => {
    setOpen(false);
    // The server refuses to delete the live one, but saying so here is kinder
    // than letting the request bounce.
    if (id === state.active) {
      window.alert(t.profileDeleteActive || 'Switch to another profile before deleting this one.');
      return;
    }
    if (!window.confirm(fill(t.profileDeleteConfirm || 'Delete “{name}”? This cannot be undone.', { name }))) return;
    actions.profileDelete(group, id);
  };

  const revert = () => {
    if (!window.confirm(fill(t.profileRevertConfirm || 'Throw away your changes and go back to the saved “{name}”?', { name: active?.name }))) return;
    actions.profileRevert(group);
  };

  return (
    /*
      `relative z-50` on the bar itself, not just on the menu.

      glass-panel carries a backdrop-filter, and that creates a stacking
      context — so the menu's own z-50 only ever ranked it against its
      siblings *inside* this bar. The view below is a later sibling with its
      own blur-made context, and with both at z-index auto the later one wins
      on document order alone. The menu was drawn behind the panel no matter
      how high its z-index went. Raising the bar is what actually moves it.
    */
    <div className="glass-panel rounded-2xl border border-zinc-800 px-4 py-3 flex flex-wrap items-center gap-3 relative z-50">
      <div className="flex items-center gap-2 shrink-0">
        <Layers size={13} className="text-current-accent" />
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      </div>

      {/* which profile is live */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200">{active?.name}</span>
          {state.dirty && (
            // The whole reason Save and Revert are on screen.
            <span title={t.profileUnsaved || 'Unsaved changes'} className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
          <ChevronDown size={12} className="text-zinc-500" />
        </button>

        {open && (
          <>
            {/* click anywhere else to dismiss */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
              {state.profiles.map((p) => (
                <div key={p.id} className="flex items-center group">
                  <button
                    onClick={() => switchTo(p.id)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors ${
                      p.id === state.active ? 'text-current-accent' : 'text-zinc-300'
                    }`}
                  >
                    <span className="w-3 shrink-0">{p.id === state.active && <Check size={11} />}</span>
                    <span className="flex-1 text-[10px] font-bold truncate">{p.name}</span>
                    <span className="text-[9px] font-mono text-zinc-600">{p.items}</span>
                  </button>
                  {p.id !== state.active && (
                    <button
                      onClick={() => remove(p.id, p.name)}
                      title={t.delete || 'Delete'}
                      className="px-2 py-2 text-zinc-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}

              <div className="border-t border-zinc-800">
                <button onClick={create} disabled={atCapacity} className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30 transition-colors">
                  <Plus size={11} /> {t.profileNew || 'New empty profile'}
                </button>
                <button onClick={duplicate} disabled={atCapacity} className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30 transition-colors">
                  <Copy size={11} /> {t.profileDuplicate || 'Duplicate this one'}
                </button>
                <button onClick={rename} className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-zinc-400 hover:bg-white/5 hover:text-white transition-colors">
                  <Pencil size={11} /> {t.profileRename || 'Rename'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* save and revert, only worth offering when there is something to act on */}
      <div className="flex items-center gap-2 ml-auto">
        {state.dirty ? (
          <>
            <span className="text-[9px] font-bold text-amber-400/90 hidden sm:inline">
              {t.profileUnsaved || 'Unsaved changes'}
            </span>
            <Button size="sm" variant="secondary" icon={<Undo2 size={12} />} onClick={revert}>
              {t.profileRevertBtn || 'Revert'}
            </Button>
            <Button size="sm" icon={<Save size={12} />} onClick={() => actions.profileSave(group)}>
              {t.profileSave || 'Save'}
            </Button>
          </>
        ) : (
          <span className="text-[9px] font-bold text-zinc-600">{t.profileSaved || 'All changes saved'}</span>
        )}
      </div>
    </div>
  );
};
