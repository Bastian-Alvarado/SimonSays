/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * One emoji, chosen from the picker — the regular ones and the server's own
 * Discord emojis — rather than typed: a server emoji has to be written as
 * <:name:id>, which nobody knows by heart, and the picker already writes it.
 *
 * Shows what was chosen the way Discord does: a server emoji as its picture,
 * a regular one as itself. Used for a button's emoji, the reaction under a
 * post and an emoji placed on the card.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';

/** A server emoji written as <:name:id> or <a:name:id>, as the picture Discord serves for it. */
export const customEmojiUrl = (value: string) => {
  const m = /^<(a?):[\w~-]+:(\d+)>$/.exec(String(value || '').trim());
  return m ? `https://cdn.discordapp.com/emojis/${m[2]}.${m[1] ? 'gif' : 'png'}?size=64` : '';
};

/** An emoji as Discord shows it: a server one as its picture, a regular one as itself. */
export const EmojiGlyph = ({ value, size = 18 }: { value: string; size?: number }) => {
  const url = customEmojiUrl(value);
  return url
    ? <img src={url} alt={value} className="inline-block object-contain" style={{ width: size, height: size }} />
    : <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{value}</span>;
};

export const EmojiField = ({ value, onChange, customEmojis, clearable = true, title, t, size = 'md' }: {
  value: string; onChange: (next: string) => void; customEmojis?: any[];
  /** Whether "none" is a choice: a button may have only a label, a reaction may be off. */
  clearable?: boolean; title?: string; t: any; size?: 'sm' | 'md';
}) => {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;
    if (top + 400 > window.innerHeight) top = Math.max(8, rect.top - 408);
    if (left + 320 > window.innerWidth) left = window.innerWidth - 340;
    setAt({ top, left });
  };
  const box = size === 'sm' ? 'h-[30px] min-w-[40px] px-2' : 'h-9 min-w-[44px] px-3';

  return (
    <span className="inline-flex items-center gap-1" data-emoji-field>
      <button type="button" onClick={open} title={title || t.greetReactPick || 'Choose an emoji'} className={`${box} rounded-lg border border-zinc-800 bg-zinc-950 hover:border-zinc-600 grid place-items-center`}>
        {value ? <EmojiGlyph value={value} size={size === 'sm' ? 16 : 20} /> : <span className="text-[9px] text-zinc-500 font-bold uppercase">{t.greetNoRole || 'None'}</span>}
      </button>
      {clearable && value && (
        <button type="button" onClick={() => onChange('')} className="p-1 text-zinc-500 hover:text-rose-400" title={t.emojiFieldClear || 'No emoji'}><X size={11} /></button>
      )}
      {/*
        Into the page itself, not here: a panel with a blur behind it makes
        anything fixed inside it place itself against the panel instead of the
        window, and the picker opened thousands of pixels off the screen.
      */}
      {at && createPortal(
        <>
          <div className="fixed inset-0 z-[9990] bg-transparent" onClick={() => setAt(null)} />
          <EmojiPicker style={{ top: at.top, left: at.left }} onSelect={(emoji: string) => { onChange(emoji); setAt(null); }} onClose={() => setAt(null)} customEmojis={customEmojis} />
        </>,
        document.body,
      )}
    </span>
  );
};
