/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Buttons under a welcome or a boost post: links (the rules, your channel,
 * your socials) and roles anybody can pick up or put down with a press —
 * the same press a button menu takes (discord-roles.js), so nothing new has
 * to be learnt by the server or by the people pressing.
 *
 * Up to ten, two rows of five, as Discord lays them out. A role appears once.
 */
import React from 'react';
import { Plus, Trash2, ArrowUp, Link as LinkIcon, Shield } from 'lucide-react';
import type { GreetingButton } from '../types';
import { EmojiField } from './EmojiField';

const MAX = 10;
// One height for every box in a button's row, the emoji's included, so they line up.
const field = 'w-full h-[30px] bg-zinc-950 border border-zinc-800 rounded-md px-2 text-[11px] text-white outline-none focus:border-current-accent';
const label = 'text-[8px] font-black uppercase tracking-widest text-zinc-600';

/** Discord's own button colours, by its numbers. */
const STYLES: { value: number; key: string; fallback: string; swatch: string }[] = [
  { value: 2, key: 'greetButtonGrey', fallback: 'Grey', swatch: '#4e5058' },
  { value: 1, key: 'greetButtonBlurple', fallback: 'Blurple', swatch: '#5865f2' },
  { value: 3, key: 'greetButtonGreen', fallback: 'Green', swatch: '#248046' },
  { value: 4, key: 'greetButtonRed', fallback: 'Red', swatch: '#da373c' },
];

export const GreetingButtons = ({ buttons = [], set, roles = [], customEmojis = [], t }: {
  buttons?: GreetingButton[]; set: (next: GreetingButton[]) => void; roles?: any[];
  /** The server's own emojis, offered in the picker beside the regular ones. */
  customEmojis?: any[]; t: any;
}) => {
  const patch = (i: number, p: Partial<GreetingButton>) => set(buttons.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...buttons];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    set(next);
  };
  const taken = new Set(buttons.filter((b) => b.kind === 'role').map((b) => b.roleId));

  return (
    <div className="space-y-2" data-greet-buttons>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.greetButtons || 'Buttons under it'}</span>
        {buttons.length < MAX && (
          <>
            <button onClick={() => set([...buttons, { kind: 'link', label: '', url: 'https://' }])} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white" data-greet-button-add="link">
              <Plus size={10} /> <LinkIcon size={10} /> {t.greetButtonLink || 'Link'}
            </button>
            <button onClick={() => set([...buttons, { kind: 'role', label: '', roleId: '', style: 2 }])} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white" data-greet-button-add="role">
              <Plus size={10} /> <Shield size={10} /> {t.greetButtonRole || 'Role'}
            </button>
          </>
        )}
      </div>
      {buttons.map((b, i) => (
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 items-start rounded-xl border border-zinc-800 bg-zinc-950/40 p-2" data-greet-button={b.kind}>
          <span className="pt-5 text-zinc-500">{b.kind === 'link' ? <LinkIcon size={12} /> : <Shield size={12} />}</span>
          <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <div className="flex flex-col gap-1">
              <span className={label}>{t.greetButtonEmoji || 'Emoji'}</span>
              {/* Picked rather than typed: a server emoji is written <:name:id>, which the picker writes for you. */}
              <EmojiField value={b.emoji || ''} onChange={(emoji) => patch(i, { emoji })} customEmojis={customEmojis} size="sm" t={t} />
            </div>
            <label className="flex flex-col gap-1">
              <span className={label}>{t.greetButtonLabel || 'Label'}</span>
              <input value={b.label} onChange={(e) => patch(i, { label: e.target.value })} maxLength={80} className={field} placeholder={b.kind === 'link' ? (t.greetButtonLinkExample || 'Rules') : (t.greetButtonRoleExample || 'Notifications')} />
            </label>
            {b.kind === 'link' ? (
              <label className="flex flex-col gap-1">
                <span className={label}>{t.greetButtonUrl || 'Address'}</span>
                <input value={b.url || ''} onChange={(e) => patch(i, { url: e.target.value })} className={field} placeholder="https://twitch.tv/…" />
              </label>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <label className="flex flex-col gap-1 min-w-0">
                  <span className={label}>{t.greetButtonRolePick || 'Role'}</span>
                  <select value={b.roleId || ''} onChange={(e) => patch(i, { roleId: e.target.value, label: b.label || roles.find((r) => r.id === e.target.value)?.name || '' })} className={field}>
                    <option value="">{t.greetPickRole || 'Choose a role…'}</option>
                    {roles.filter((r) => r.name !== '@everyone' && !r.managed).map((r) => (
                      <option key={r.id} value={r.id} disabled={r.id !== b.roleId && taken.has(r.id)}>{r.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={label}>{t.greetButtonColour || 'Colour'}</span>
                  <select value={b.style || 2} onChange={(e) => patch(i, { style: Number(e.target.value) })} className={field}>
                    {STYLES.map((s) => <option key={s.value} value={s.value}>{t[s.key] || s.fallback}</option>)}
                  </select>
                </label>
              </div>
            )}
            <span className="flex items-end gap-1 pb-1">
              <button onClick={() => moveUp(i)} disabled={i === 0} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30" title={t.greetButtonEarlier || 'Earlier'}><ArrowUp size={11} /></button>
              <button onClick={() => set(buttons.filter((_, j) => j !== i))} className="p-1 text-zinc-500 hover:text-rose-400" title={t.greetRemoveLine || 'Remove'}><Trash2 size={11} /></button>
            </span>
          </div>
        </div>
      ))}
      {buttons.length > 0 && (
        <p className="text-[9px] text-zinc-600 leading-relaxed">
          {t.greetButtonsHint || 'A role button gives the role to whoever presses it, or takes it away if they have it — the bot\'s role has to sit above it. A button needs a label or an emoji, and a link must start with https://.'}
        </p>
      )}
    </div>
  );
};
