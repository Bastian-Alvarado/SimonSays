/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Where the dock's box sends: Twitch, YouTube, or both.
 *
 * Only there once YouTube is signed in. A message to YouTube costs 50 units
 * of the day's allowance — ten reads of chat — so with YouTube chosen it
 * says roughly how many more the day can take, and when YouTube has no live
 * chat to post in it says that rather than letting a message fail.
 */
import React from 'react';

/** As the server counts them: YouTube's default day, and what a message costs. */
const DAILY_UNITS = 10_000;
const SEND_UNITS = 50;

export type SendTo = 'twitch' | 'youtube' | 'both';

export const SendToPicker = ({ value, set, authorised, live, unitsUsed, t }: {
  value: SendTo; set: (next: SendTo) => void;
  /** YouTube signed in, and reading a live chat right now. */
  authorised: boolean; live: boolean;
  /** Today's spend so far, as the server counts it. */
  unitsUsed?: number; t: any;
}) => {
  if (!authorised) return null;
  const left = Math.max(0, Math.floor((DAILY_UNITS - (Number(unitsUsed) || 0)) / SEND_UNITS));
  const options: { value: SendTo; label: string }[] = [
    { value: 'twitch', label: 'Twitch' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'both', label: t.sendToBoth || 'Both' },
  ];
  const toYoutube = value !== 'twitch';
  return (
    <div className="flex items-center gap-1.5 flex-wrap" data-send-to>
      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 opacity-60">{t.sendTo || 'To'}:</span>
      <div className="flex bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800 shadow-sm">
        {options.map((o) => (
          <button
            key={o.value} onClick={() => set(o.value)}
            className={`px-2.5 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${value === o.value ? (o.value === 'youtube' ? 'bg-red-600 text-white shadow-lg' : 'bg-current-accent text-white shadow-lg') : 'text-zinc-500 hover:text-zinc-300'}`}
            data-send-to-choice={o.value}
          >
            {o.label}
          </button>
        ))}
      </div>
      {toYoutube && (
        <span className={`text-[8px] font-bold ${live ? 'text-zinc-500' : 'text-amber-400'}`} data-send-to-note>
          {live
            ? String(t.sendToYoutubeLeft || '≈ {n} YouTube messages left today').split('{n}').join(String(left))
            : (t.sendToYoutubeNotLive || 'YouTube has no live chat right now')}
        </span>
      )}
    </div>
  );
};
