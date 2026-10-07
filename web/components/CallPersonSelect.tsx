/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who in the Discord call an action waits for: anyone, or one person. The
 * same three groups a talking layer offers (shared/talk-people.js) — who is
 * in the call now, who is set up already, everyone else in the server — so
 * somebody can be chosen before they ever join.
 */
import React, { useEffect, useState } from 'react';
import { talkChoices, allChoices } from '../../shared/talk-people.js';

interface Props {
  value: string;
  /** The person chosen, and the name they go by on stream — empty for nobody. */
  onChange: (id: string, name: string) => void;
  /** The voice state (system.data.voice): who is in the call, and the people set up on the Voice call screen. */
  voice: any;
  regulars: { name?: string; discordId?: string }[];
  /** Everyone in the server, asked of Discord once the select is shown. */
  listServerMembers?: () => Promise<{ id: string; name: string }[]>;
  className: string;
  /** What the empty choice says: "Anyone" unless told otherwise. */
  emptyLabel?: string;
  t: any;
}

export const CallPersonSelect = ({ value, onChange, voice, regulars, listServerMembers, className, emptyLabel, t }: Props) => {
  const [server, setServer] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!listServerMembers) return undefined;
    let gone = false;
    listServerMembers().then((people) => { if (!gone) setServer(people || []); }).catch(() => { /* the call and the people set up are still offered */ });
    return () => { gone = true; };
    // Once per opening: the list is kept a minute on the server, and the function is made anew each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = value ? (allChoices(talkChoices({ members: voice?.members || [], voice: voice || {}, regulars, server })).find((p: any) => p.id === value) || { id: value, name: value }) : null;
  const choices = talkChoices({ members: voice?.members || [], voice: voice || {}, regulars, server, chosen });
  const groups: [string, string, { id: string; name: string }[]][] = [
    ['call', t.talkGroupInCall || 'In the Discord call now', choices.inCall],
    ['known', t.talkGroupKnown || 'People you have set up', choices.known],
    ['server', t.talkGroupServer || 'Everyone else in your Discord server', choices.server],
  ];
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value, allChoices(choices).find((p: any) => p.id === e.target.value)?.name || '')}
      className={className}
      data-call-person
    >
      <option value="">{emptyLabel || t.callPersonAnyone || 'Anyone'}</option>
      {choices.kept && <option value={choices.kept.id}>{choices.kept.name}</option>}
      {groups.map(([key, title, list]) => list.length > 0 && (
        <optgroup key={key} label={title}>
          {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
};
