/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Everybody on the couch, as one layer.
 *
 * A nameplate draws one person, so a couch is four plates that each have to be
 * placed by hand and each told which seat they are. This draws the same people
 * as one thing: it reads the run, lays the seats out in a grid, and draws the
 * free ones as free rather than as nothing.
 *
 * That last part is the reason this exists rather than being four plates. A
 * plate with nobody in it hides itself, which is right for a lower third and
 * wrong for a couch: a gap where the fourth seat should be reads as something
 * having broken. Here an empty seat is drawn as an empty seat.
 *
 * It also knows which seat is which, so the role marker is worked out rather
 * than typed in — nobody has to keep "commentator 2" and the second box in
 * step, which is exactly the bookkeeping four plates would leave you with.
 */
import React from 'react';
import { rosterCapacity } from '../../shared/run.js';

export interface RosterLayerConfig {
  /** Who fills the seats: the commentators, the couch, or the whole room. */
  include?: 'commentators' | 'couch' | 'everyone';
  /** How many seats are drawn, free ones included. */
  seats?: number;
  columns?: number;
  /** Draw the seats nobody is in yet. Off means the grid shrinks to fit. */
  showEmpty?: boolean;
  emptyText?: string;
  /** The marker on a seat's tab. Off leaves the tab as a plain colour. */
  showRole?: boolean;
  accentColor?: string;
  /** The host's tab, so the one who is not a commentator reads as different. */
  hostColor?: string;
  textColor?: string;
  backgroundColor?: string;
  radius?: number;
  nameSize?: number;
  pronounSize?: number;
}

interface Person { name?: string; subtitle?: string }
interface Run { runner?: Person; host?: Person; commentators?: Person[] }

/** What each seat's tab says. Derived from the seat, never typed into it. */
const MARK: Record<string, string> = { runner: 'R', host: 'H', commentator: 'C' };

/**
 * The seats, in the order they are sat in.
 *
 * The runner and the host come first because that is the order a couch is
 * introduced in, and because a grid that reordered itself as people arrived
 * would move somebody's name out from under them mid-stream.
 */
const seatsOf = (run: Run | undefined, include: string) => {
  const out: { role: string; person: Person }[] = [];
  if (include === 'everyone') out.push({ role: 'runner', person: run?.runner || {} });
  if (include !== 'commentators') out.push({ role: 'host', person: run?.host || {} });
  for (const person of run?.commentators || []) out.push({ role: 'commentator', person: person || {} });
  return out;
};

export const RosterLayer = ({ config, run }: { config: RosterLayerConfig; run?: Run }) => {
  const include = config.include || 'commentators';
  // Never more seats than the people it seats; a layout saved before that rule is held to it here too.
  const seats = Math.max(1, Math.min(rosterCapacity(include), config.seats ?? 4));
  const columns = Math.max(1, Math.min(4, config.columns ?? 2));
  const showEmpty = config.showEmpty !== false;
  const accent = config.accentColor || 'var(--overlay-accent, #f43f5e)';
  const host = config.hostColor || '#e0a63a';
  const text = config.textColor || '#ffffff';

  const taken = seatsOf(run, include);
  const named = taken.filter((s) => (s.person?.name || '').trim());

  /*
    Free seats are padded on as commentators, because that is what a free seat
    on this couch is. Without showEmpty the grid is only the people there.
  */
  const rows = showEmpty
    ? [...taken, ...Array.from({ length: Math.max(0, seats - taken.length) },
      () => ({ role: 'commentator', person: {} as Person }))].slice(0, seats)
    : named;

  if (!rows.length) return null;

  return (
    <div
      className="w-full h-full grid" data-roster="grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        /*
          Rows share the height rather than hugging their text, so the grid
          fills the box it was given — which is what every other layer does,
          and what somebody who has just dragged this to a size expects.
        */
        gridAutoRows: 'minmax(0, 1fr)',
        gap: '8px',
      }}
    >
      {rows.map((seat, i) => {
        const name = (seat.person?.name || '').trim();
        const pronouns = (seat.person?.subtitle || '').trim();
        const empty = !name;
        const tab = seat.role === 'host' ? host : accent;

        return (
          <div
            key={`${seat.role}-${i}`}
            className="flex items-stretch overflow-hidden min-w-0"
            data-roster="seat"
            data-roster-role={seat.role}
            /* An attribute rather than a class, so a stylesheet can reach it. */
            data-roster-empty={empty ? 'yes' : 'no'}
            style={{
              backgroundColor: config.backgroundColor || '#09090bd9',
              borderRadius: `${config.radius ?? 6}px`,
              opacity: empty ? 0.55 : 1,
            }}
          >
            {config.showRole !== false && (
              <div
                className="flex items-center justify-center shrink-0"
                data-roster="tab"
                style={{ backgroundColor: tab, width: '1.6em', fontSize: `${config.nameSize ?? 22}px` }}
              >
                <span
                  className="font-black leading-none" data-roster="role"
                  style={{ color: '#0b0b0e', fontSize: '0.6em' }}
                >
                  {MARK[seat.role] || 'C'}
                </span>
              </div>
            )}

            <div
              className="flex-1 min-w-0 flex flex-col items-center justify-center px-2 py-1"
              data-roster="body"
            >
              <div
                className="w-full text-center font-black uppercase truncate leading-none"
                data-roster="name"
                style={{ color: text, fontSize: `${config.nameSize ?? 22}px` }}
              >
                {empty ? (config.emptyText || 'Press start') : name}
              </div>
              {!empty && pronouns && (
                <div
                  className="max-w-full font-semibold uppercase truncate leading-none mt-1 px-1"
                  data-roster="pronouns"
                  style={{
                    color: '#0b0b0e',
                    backgroundColor: tab,
                    fontSize: `${config.pronounSize ?? 11}px`,
                  }}
                >
                  {pronouns}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
