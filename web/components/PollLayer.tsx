/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The poll, as the stream sees it: the question, the answers with their
 * bars, how to vote, and how long is left.
 *
 * The poll lives on the server and on the Polls screen; this only draws it.
 * Nothing is drawn while no poll is up. A closed poll keeps its result on
 * screen — the winner marked — until it is cleared, by hand or after the
 * seconds set on the Polls screen.
 *
 * Plain on purpose: this is the default look, and themes dress it. Every
 * part names itself (data-poll), the card says whether the poll is open or
 * closed (data-poll-state), and each answer says whether it is ahead and
 * whether it won (data-poll-leading, data-poll-winner).
 */
import React, { useEffect, useState } from 'react';
import { percentOf } from '../../shared/polls.js';
import { formatRemaining } from './Countdown';
import { autoColumns } from './PlayersLayer';

export interface PollState {
  mode: 'idle' | 'open' | 'closed';
  question: string;
  options: string[];
  counts?: number[];
  total?: number;
  leaders?: number[];
  byPlatform?: Record<string, number>;
  durationMs?: number;
  endsAt?: number | null;
  closedAt?: number | null;
  rules?: { numbers?: boolean; words?: boolean; change?: boolean };
  serverNow?: number;
  clientReceivedAt?: number;
}

export interface PollLayerConfig {
  columns?: number;
  /** Room for this many answers; 0 sizes the rows to the answers there are. */
  slots?: number;
  showNumbers?: boolean;
  showPercent?: boolean;
  showCount?: boolean;
  showHint?: boolean;
  hint?: string;
  textColor?: string;
  background?: string;
  barColor?: string;
  radius?: number;
}

/** How far this screen's clock is from the server's, measured from the frame. */
const skewOf = (poll?: PollState) => (poll?.serverNow && poll?.clientReceivedAt ? poll.serverNow - poll.clientReceivedAt : 0);

/** Milliseconds left in an open poll with a clock; null for one without. */
export function pollTimeLeft(poll?: PollState): number | null {
  if (!poll || poll.mode !== 'open' || !poll.endsAt) return null;
  return Math.max(0, poll.endsAt - (Date.now() + skewOf(poll)));
}

/** How many across, when the layer has not been told: by how many answers. */
export const pollColumns = (n: number) => (n <= 6 ? 1 : n <= 12 ? 2 : 3);

export const PollLayer = ({ config, poll, t }: { config: PollLayerConfig; poll?: PollState; t: any }) => {
  const [, tick] = useState(0);
  const open = poll?.mode === 'open';
  const timed = open && Boolean(poll?.endsAt);

  // The clock ticks only while there is one to watch.
  useEffect(() => {
    if (!timed) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [timed, poll?.endsAt]);

  if (!poll || poll.mode === 'idle' || !poll.options?.length) return null;

  const options = poll.options;
  const counts = poll.counts || options.map(() => 0);
  const total = poll.total ?? counts.reduce((a, b) => a + b, 0);
  const leaders = new Set(poll.leaders || []);
  /*
    With room for a set number of answers the rows are sized for that many,
    however many there are, the way the players list's slots are: three
    answers sit in three slots of the same size as fifteen would, and the
    rest of the card is left empty, rather than three rows so tall their
    names no longer fit. The columns then follow the players list's rule, so
    the two laid out for the same number match.
  */
  const capacity = config.slots ? Math.max(config.slots, options.length) : options.length;
  const columns = config.columns || (config.slots ? autoColumns(capacity) : pollColumns(options.length));
  const rows = Math.ceil(capacity / columns);
  const left = pollTimeLeft(poll);
  const bar = config.barColor || 'var(--overlay-accent, #f43f5e)';

  const words = poll.rules?.words !== false;
  const hint = config.hint
    || (words ? (t?.pollHintWords || 'Type a number or an answer in chat') : (t?.pollHint || 'Type a number in chat to vote'));

  return (
    /*
      The layer is the container the card is measured against, so the whole
      card scales with the layer: its type is set in em from a size that
      follows the layer's height, and a theme's em sizes follow along.
    */
    <div className="w-full h-full" style={{ containerType: 'size' }}>
    <div
      className="w-full h-full flex flex-col gap-[0.6em] p-[1em] overflow-hidden" data-poll="card"
      data-poll-state={poll.mode}
      style={{
        fontSize: 'max(11px, 3.6cqh)',
        // What was chosen, for a look to read before its own.
        ['--poll-text' as any]: config.textColor || undefined,
        ['--poll-background' as any]: config.background || undefined,
        ['--poll-bar' as any]: config.barColor || undefined,
        color: config.textColor || '#ffffff',
        backgroundColor: config.background || '#09090bcc',
        borderRadius: `${config.radius ?? 12}px`,
      }}
    >
      <div className="shrink-0 font-black text-[1.5em] leading-tight" data-poll="question">{poll.question}</div>
      <div
        className="flex-1 min-h-0 grid gap-1.5" data-poll="options"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${Math.max(rows, 1)}, minmax(0, 1fr))`,
        }}
      >
        {options.map((text, i) => {
          const n = counts[i] || 0;
          const pct = percentOf(n, total);
          const leading = leaders.has(i);
          return (
            <div
              key={`${i}-${text}`}
              className="relative min-w-0 flex items-center gap-2 px-3 rounded-lg overflow-hidden bg-white/10" data-poll="option"
              data-poll-leading={leading ? 'true' : 'false'}
              data-poll-winner={leading && poll.mode === 'closed' ? 'true' : 'false'}
              // Sized to the row it is in, so three answers and fifteen both read.
              style={{ containerType: 'size' }}
            >
              <div className="absolute inset-0 pointer-events-none" data-poll="bar">
                <div
                  className="h-full" data-poll="fill"
                  style={{ width: `${pct}%`, background: bar, opacity: 0.55, transition: 'width 400ms ease-out' }}
                />
              </div>
              {config.showNumbers !== false && (
                <span className="relative shrink-0 font-black tabular-nums opacity-80" data-poll="number" style={{ fontSize: '40cqh' }}>{i + 1}</span>
              )}
              <span className="relative flex-1 min-w-0 truncate font-bold" data-poll="label" style={{ fontSize: '40cqh' }}>{text}</span>
              {config.showCount === true && (
                <span className="relative shrink-0 font-bold tabular-nums opacity-80" data-poll="count" style={{ fontSize: '32cqh' }}>{n}</span>
              )}
              {config.showPercent !== false && (
                <span className="relative shrink-0 font-black tabular-nums" data-poll="percent" style={{ fontSize: '36cqh' }}>{pct}%</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="shrink-0 flex items-center gap-[0.8em] text-[0.9em] font-bold" data-poll="footer">
        {config.showHint !== false && (
          <span className="flex-1 min-w-0 truncate opacity-80" data-poll="hint">
            {open ? hint : (t?.pollClosedLabel || 'Poll closed')}
          </span>
        )}
        <span className="shrink-0 tabular-nums opacity-80" data-poll="votes">
          {total} {total === 1 ? (t?.pollVote || 'vote') : (t?.pollVotes || 'votes')}
        </span>
        {left !== null && (
          <span className="shrink-0 font-black tabular-nums" data-poll="timer">{formatRemaining(left)}</span>
        )}
      </div>
    </div>
    </div>
  );
};
