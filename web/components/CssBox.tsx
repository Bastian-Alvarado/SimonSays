/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A box to type a stylesheet into, that says how much room is left.
 *
 * Every stylesheet box has a limit, and the server enforces it by cutting
 * off whatever is past it. Without a count, going over was invisible: the
 * end of the stylesheet — usually the last rule written, the one being worked
 * on — simply stopped existing, with nothing anywhere to say why.
 *
 * So the count is always there, turns amber in the last stretch, and past
 * the limit the box refuses to save instead of letting the server cut. What
 * was typed stays in the box, marked, until it is short enough to keep —
 * losing a rule is worse than not having saved yet, and the red line under
 * the box says which of the two is happening.
 *
 * One component for every stylesheet box (a layer's look and motion, an
 * alert's, the chat's, a whole canvas's), so the rule is the same everywhere.
 */
import React, { useState } from 'react';
import { CommittedInput } from './CommittedInput';
import { MAX_CSS } from '../../shared/clean-css.js';
import { fill } from '../words';

interface Props {
  value: string | undefined;
  onCommit: (next: string) => void;
  placeholder?: string;
  /** The textarea's own classes: each box keeps its height and border. */
  className: string;
  t: any;
  max?: number;
}

export const CssBox = ({ value, onCommit, placeholder, className, t, max = MAX_CSS }: Props) => {
  const [length, setLength] = useState((value || '').length);
  const over = length - max;

  return (
    <div>
      <CommittedInput
        as="textarea"
        value={value || ''}
        placeholder={placeholder}
        spellCheck={false}
        onDraft={(text) => setLength(text.length)}
        onCommit={(next) => { if (next.length <= max) onCommit(next); }}
        className={`${className} ${over > 0 ? '!border-rose-500/70' : ''}`}
        data-css-box
      />
      <div className="flex items-start gap-2 text-[9px] leading-snug">
        {over > 0 && (
          <span className="flex-1 text-rose-400" data-css-too-long>
            {fill(t.cssTooLong || '{n} characters too long, so this is not saved. Shorten it to save.', { n: over })}
          </span>
        )}
        <span
          className={`ml-auto shrink-0 font-mono tabular-nums ${over > 0 ? 'text-rose-400' : length > max * 0.95 ? 'text-amber-400' : 'text-zinc-600'}`}
          data-css-count
        >
          {length} / {max}
        </span>
      </div>
    </div>
  );
};
