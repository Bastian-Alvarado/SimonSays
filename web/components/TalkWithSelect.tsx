/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * "Talks when", for a layer that talks — a pixel avatar, a PNGtuber: nobody,
 * the microphone, or one person in the Discord call. The people come in
 * groups (shared/talk-people.js), so somebody can be chosen before they ever
 * join: whoever is in the call now, whoever is set up already, and everyone
 * else in the Discord server.
 *
 * One select for both layers, so the two cannot drift into offering
 * different people.
 */
import React from 'react';
import { allChoices } from '../../shared/talk-people.js';

export interface TalkChoices {
  inCall: { id: string; name: string }[];
  known: { id: string; name: string }[];
  server: { id: string; name: string }[];
  kept: { id: string; name: string; offStream?: boolean } | null;
}

interface Props {
  /** Who it talks with now: null for nobody, { id: 'mic' } for the microphone. */
  value: { id: string; name: string } | null;
  onChange: (next: { id: string; name: string } | null) => void;
  choices: TalkChoices;
  /** Whether "nobody" is a choice. A PNGtuber always talks with something; a pixel avatar may stay quiet. */
  nobody: boolean;
  /** Whether the bot is listening for who talks, on the Voice call screen. */
  listening: boolean;
  className: string;
  t: any;
}

export const TalkWithSelect = ({ value, onChange, choices, nobody, listening, className, t }: Props) => {
  const everyone = allChoices(choices);
  const person = value && value.id !== 'mic' ? value : null;
  const groups: [string, string, { id: string; name: string }[]][] = [
    ['call', t.talkGroupInCall || 'In the Discord call now', choices.inCall],
    ['known', t.talkGroupKnown || 'People you have set up', choices.known],
    ['server', t.talkGroupServer || 'Everyone else in your Discord server', choices.server],
  ];

  return (
    <>
      <select
        value={value?.id || (nobody ? '' : 'mic')}
        onChange={(e) => {
          const id = e.target.value;
          if (id === 'mic') return onChange({ id: 'mic', name: 'mic' });
          const p = everyone.find((m) => m.id === id);
          return onChange(p ? { id: p.id, name: p.name } : (nobody ? null : { id: 'mic', name: 'mic' }));
        }}
        className={className}
        data-talk-with
      >
        {nobody && <option value="">{t.avatarTalkNobody || 'Nobody — it stays quiet'}</option>}
        <option value="mic">{t.pngtuberMic || 'I talk into my microphone (set it up on the PNGtuber screen)'}</option>
        {choices.kept && <option value={choices.kept.id}>{choices.kept.name}</option>}
        {groups.map(([key, title, list]) => list.length > 0 && (
          <optgroup key={key} label={title} data-talk-group={key}>
            {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        ))}
      </select>
      {/*
        What it takes for the person chosen to move it: the bot in their call,
        listening. Said when somebody is chosen, and as a warning when
        listening is off or they are kept off stream, since then it never talks.
      */}
      {person && choices.kept?.offStream ? (
        <p className="text-[9px] text-amber-500 leading-relaxed" data-talk-warning>
          {t.talkKeptOff || 'They are kept off stream on the Voice call screen, so it will not talk for them. Let them back on there.'}
        </p>
      ) : person && !listening ? (
        <p className="text-[9px] text-amber-500 leading-relaxed" data-talk-warning>
          {t.talkNotListening || '"Light up whoever is talking" is off on the Voice call screen, so it will not talk until that is on.'}
        </p>
      ) : person ? (
        <p className="text-[9px] text-zinc-600 leading-relaxed">
          {t.talkPersonHint || 'Talks while they speak in the Discord call the bot is in. They can be chosen before they join.'}
        </p>
      ) : everyone.length === 0 ? (
        <p className="text-[9px] text-zinc-600 leading-relaxed">
          {t.avatarTalkHint || 'Join the call with "Light up whoever is talking" on in the Voice call screen, and you can be chosen here.'}
        </p>
      ) : null}
    </>
  );
};
