/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What the Game screen and the Who's on screen are both built from.
 *
 * They were one screen, and they still edit one record — the run, which the
 * run card, the nameplates, the couch, text layers and actions all read. They
 * came apart because the two halves change at different moments and feed
 * different things: the game with the plan and the Twitch category, the
 * people as guests arrive and leave. The pieces they share live here.
 */
import React from 'react';
import { Eraser } from 'lucide-react';
import { CommittedInput } from './CommittedInput';

/** A seat's person: what the plate shows, and their Twitch login and Discord account when known. */
export interface Person { name: string; subtitle?: string; twitch?: string; discordId?: string }
export interface Run {
  game?: string;
  platform?: string;
  year?: string;
  category?: string;
  estimate?: string;
  runner?: Person;
  host?: Person;
  commentators?: Person[];
}

export interface RunScreenProps {
  run: Run;
  setRun: (next: Run) => void;
  /** The layouts, so the preview can wear the colours a run card and a couch already have. */
  layouts?: any[];
  t: any;
}

export const EMPTY_PERSON: Person = { name: '', subtitle: '' };

/** The checkerboard a preview sits on, so a transparent background reads as one. */
export const PREVIEW_GROUND = 'rounded-xl overflow-hidden bg-[repeating-conic-gradient(#18181b_0%_25%,#09090b_0%_50%)] bg-[length:16px_16px] p-3';

export const Field = ({ label, value, onCommit, placeholder, wide, error }: {
  label: string; value: string; onCommit: (v: string) => void; placeholder?: string; wide?: boolean; error?: string;
}) => (
  <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
    <CommittedInput
      value={value || ''}
      placeholder={placeholder}
      onCommit={onCommit}
      className={`w-full mt-1 bg-zinc-900/60 border rounded-lg px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-current-accent ${error ? 'border-rose-500/70' : 'border-zinc-800'}`}
    />
    {error && <span role="alert" className="block mt-1 text-[10px] font-bold text-rose-400 leading-snug">{error}</span>}
  </label>
);

/** A panel heading, with room on the right for the panel's own button. */
export const Heading = ({ icon, text, action }: { icon: React.ReactNode; text: string; action?: React.ReactNode }) => (
  <div className="flex items-center gap-2">
    <span className="text-current-accent">{icon}</span>
    <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-zinc-400">{text}</span>
    {action}
  </div>
);

export const ClearButton = ({ onClick, t }: { onClick: () => void; t: any }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
  >
    <Eraser size={12} /> {t.runClear || 'Clear'}
  </button>
);

/** The first layer of a kind in any layout, so a preview wears its colours. */
export const firstLayer = (layouts: any[] | undefined, type: string) => {
  for (const layout of layouts || []) {
    const layer = (layout?.layers || []).find((l: any) => l?.type === type);
    if (layer) return layer.config || {};
  }
  return {};
};
