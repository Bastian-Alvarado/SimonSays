/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A text field that does not fight the server while you are typing in it.
 *
 * Several of these fields save on every keystroke, and the server tidies what
 * it stores — a label and a plan item are both trimmed, so that leading
 * and trailing spaces do not end up in the data. Put those two together and a
 * space becomes impossible to type: it is sent, stripped, and the stripped
 * value comes back and replaces what is in the box before the next letter
 * arrives. "Follower goal" could only ever be typed as "Followergoal".
 *
 * So the value is held here while the field has focus, and only handed over
 * when you leave it. The server keeps tidying what it stores; it just stops
 * doing it between one keystroke and the next.
 */
import React, { useEffect, useRef, useState } from 'react';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  /** Called when the field loses focus, or on Enter. */
  onCommit: (next: string) => void;
  /**
   * A textarea instead of a single line, for fields where newlines are part of
   * the content. Enter then means a new line rather than a commit, so leaving
   * the field is the only way out — which is what a multi-line box should do.
   */
  as?: 'input' | 'textarea';
}

export const CommittedInput = ({ value, onCommit, as = 'input', ...rest }: Props) => {
  const [local, setLocal] = useState(value ?? '');
  const editing = useRef(false);

  /*
    Follow the server only while nobody is typing. Without this guard the field
    would still be overwritten mid-word by any change from elsewhere — the very
    thing this exists to prevent, arriving by a different route.
  */
  useEffect(() => {
    if (!editing.current) setLocal(value ?? '');
  }, [value]);

  const Tag: any = as;

  return (
    <Tag
      {...rest}
      value={local}
      onFocus={(e: any) => { editing.current = true; (rest.onFocus as any)?.(e); }}
      onChange={(e: any) => setLocal(e.target.value)}
      onBlur={(e: any) => {
        editing.current = false;
        if (local !== value) onCommit(local);
        (rest.onBlur as any)?.(e);
      }}
      onKeyDown={(e: any) => {
        // Enter commits by leaving the field, so there is one path, not two.
        // A textarea is exempt: there, Enter is a new line.
        if (e.key === 'Enter' && as === 'input') e.currentTarget.blur();
        (rest.onKeyDown as any)?.(e);
      }}
    />
  );
};
