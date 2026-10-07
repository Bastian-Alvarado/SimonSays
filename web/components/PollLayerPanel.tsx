/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How a poll layer shows the poll: in how many columns, what each answer
 * says beside its name, and the line telling chat how to vote. The poll
 * itself — and how long a result stays up — is set up on the Polls screen.
 */
import React from 'react';
import { CommittedInput } from './CommittedInput';
import { AutoSwatch } from './AutoSwatch';

interface Props {
  config: Record<string, any>;
  patch: (next: Record<string, any>) => void;
  t: any;
}

const field = 'w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';

const Check = ({ on, set, text }: { on: boolean; set: (v: boolean) => void; text: string }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-current-accent" />
    <span className="text-[9px] text-zinc-400">{text}</span>
  </label>
);

export const PollLayerPanel = ({ config, patch, t }: Props) => (
  <div className="space-y-2.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
    <p className="text-[9px] text-zinc-600 leading-relaxed">{t.pollSlotsHint || 'Room for: answers keep the size that many would have, like the players list\'s slots, and fewer leave the rest empty. 0 makes the answers fill the card. Set it to the players list\'s "Per page" to match it.'}</p>
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className={label}>{t.pollColumns || 'Across'}</span>
        {/* 0 is automatic: the columns follow how many answers there are. */}
        <select value={config.columns ?? 0} onChange={(e) => patch({ columns: Number(e.target.value) })} className={field}>
          <option value={0}>{t.playersColumnsAuto || 'Auto'}</option>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="block">
        <span className={label}>{t.pollSlots || 'Room for (answers)'}</span>
        {/* 0 sizes the rows to the answers there are; a number keeps them the size that many would be. */}
        <input
          type="number" min={0} max={15} value={config.slots ?? 0}
          onChange={(e) => patch({ slots: Number(e.target.value) })}
          className={field} data-poll-slots
        />
      </label>
    </div>

    <Check on={config.showNumbers !== false} set={(v) => patch({ showNumbers: v })} text={t.pollShowNumbers || 'Number each answer'} />
    <Check on={config.showPercent !== false} set={(v) => patch({ showPercent: v })} text={t.pollShowPercent || 'Show percentages'} />
    <Check on={config.showCount === true} set={(v) => patch({ showCount: v })} text={t.pollShowCount || 'Show how many votes each has'} />
    <Check on={config.showHint !== false} set={(v) => patch({ showHint: v })} text={t.pollShowHint || 'Tell chat how to vote'} />

    <label className="block">
      <span className={label}>{t.pollHintLabel || 'How to vote'}</span>
      <CommittedInput
        value={config.hint || ''}
        placeholder={t.pollHintWords || 'Type a number or an answer in chat'}
        onCommit={(v: string) => patch({ hint: v })}
        className={field}
      />
    </label>

    {/*
      Automatic when empty: the look's, or white on see-through black with
      the bars in the canvas accent. The cross hands a chosen one back.
    */}
    <div className="flex flex-wrap items-center gap-3">
      {(['textColor', 'background', 'barColor'] as const).map((key) => (
        <AutoSwatch
          key={key}
          name={key}
          label={key === 'textColor' ? (t.playersText || 'Text') : key === 'barColor' ? (t.pollBar || 'Bars') : (t.playersBackground || 'Background')}
          value={config[key]}
          fallback={key === 'textColor' ? '#ffffff' : key === 'barColor' ? '#f43f5e' : '#09090b'}
          onChange={(v) => patch({ [key]: key === 'background' ? `${v}cc` : v })}
          onClear={() => patch({ [key]: '' })}
          t={t}
        />
      ))}
    </div>
  </div>
);
