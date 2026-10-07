/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who is in tonight's game, a page at a time.
 *
 * The list lives on the Players screen and holds up to fifty. A page shows at
 * most twenty-four — fifty names at once is a wall nobody on stream can read —
 * and when there are more, the pages take turns, the way the omnibar's slots
 * do. The columns follow how many are on the page, so ten players and twenty
 * both fill the box rather than one of them rattling around in it.
 *
 * Plain on purpose: this is the default look, and themes dress it. Every part
 * names itself (data-players) and every row says where its player stands
 * (data-players-state), so a theme can grey out, strike through or stamp
 * EJECTED across whoever is no longer playing.
 */
import React, { useEffect, useMemo, useState } from 'react';

export interface Player { id: string; name: string; colour: string; state: 'in' | 'out' | 'ejected' | 'dead' }

export interface PlayersLayerConfig {
  perPage?: number;
  columns?: number;
  seconds?: number;
  onlyIn?: boolean;
  showState?: boolean;
  title?: string;
  textColor?: string;
  background?: string;
  radius?: number;
}

/** How many across, when the layer has not been told: by how many are showing. */
export const autoColumns = (n: number) => (n <= 6 ? 1 : n <= 16 ? 2 : 3);

/** The list, cut into pages of at most `perPage`. */
export function pagesOf<T>(items: T[], perPage: number): T[][] {
  const size = Math.max(1, perPage);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

export const PlayersLayer = ({ config, players, t }: { config: PlayersLayerConfig; players?: { items?: Player[] }; t: any }) => {
  const all = players?.items || [];
  const shown = config.onlyIn ? all.filter((p) => p.state === 'in') : all;
  const perPage = Math.max(1, Math.min(24, config.perPage ?? 24));
  const pages = useMemo(() => pagesOf(shown, perPage), [shown, perPage]);
  const seconds = Math.max(3, config.seconds ?? 8);

  const [page, setPage] = useState(0);
  // One page never turns; a timer for it would tick all stream to change nothing.
  useEffect(() => {
    if (pages.length < 2) return undefined;
    const id = setInterval(() => setPage((p) => (p + 1) % pages.length), seconds * 1000);
    return () => clearInterval(id);
  }, [pages.length, seconds]);

  // Nobody playing yet: nothing on stream, rather than an empty box.
  if (!shown.length) return null;

  const current = pages[page % pages.length] || [];
  /*
    Sized by the page, never by who is on it: rows are as tall as a full page
    of `perPage` makes them, however many players there are. Sized by the
    players instead, one player filled the whole box with one enormous row,
    and the last page of thirty blew its six names up. This way "Per page" is
    also how big a row is, the way the tablet in the game has fixed slots.
  */
  const capacity = perPage;
  const columns = config.columns || autoColumns(capacity);
  const rows = Math.ceil(capacity / columns);
  const stateLabel: Record<string, string> = {
    out: t?.playersStateOut || 'Out',
    ejected: t?.playersStateEjected || 'Ejected',
    dead: t?.playersStateDead || 'Dead',
  };

  return (
    <div
      className="w-full h-full flex flex-col gap-2 p-3 overflow-hidden" data-players="list"
      style={{
        // What was chosen, for a look to read before its own.
        ['--players-text' as any]: config.textColor || undefined,
        ['--players-background' as any]: config.background || undefined,
        color: config.textColor || '#ffffff',
        backgroundColor: config.background || '#09090bcc',
        borderRadius: `${config.radius ?? 10}px`,
      }}
    >
      {config.title && (
        <div className="shrink-0 font-black uppercase tracking-widest text-sm truncate" data-players="title">{config.title}</div>
      )}
      {/*
        Keyed by the page, so a theme's entrance plays for each page as it
        turns rather than once when the stream starts.
      */}
      <div
        key={`page-${page % pages.length}`}
        className="flex-1 min-h-0 grid gap-1.5" data-players="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          // Rows share the height, so a short list is not a few rows stuck to the top.
          gridTemplateRows: `repeat(${Math.max(rows, 1)}, minmax(0, 1fr))`,
        }}
      >
        {current.map((p) => (
          <div
            key={p.id}
            className="min-w-0 flex items-center gap-2 px-2 rounded-md bg-white/5" data-players="row"
            data-players-state={p.state}
            style={{
              // Sized to the row it is in, so twenty-four rows and six both read.
              containerType: 'size',
              opacity: p.state === 'in' ? 1 : 0.45,
            }}
          >
            <span
              className="shrink-0 rounded-full" data-players="dot"
              style={{ width: '42cqh', height: '42cqh', backgroundColor: p.colour }}
            />
            <span
              className="flex-1 min-w-0 truncate font-bold" data-players="name"
              style={{ fontSize: '46cqh', textDecoration: p.state === 'in' ? undefined : 'line-through' }}
            >
              {p.name}
            </span>
            {config.showState !== false && p.state !== 'in' && (
              <span className="shrink-0 font-black uppercase tracking-widest" data-players="state" style={{ fontSize: '26cqh' }}>
                {stateLabel[p.state]}
              </span>
            )}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="shrink-0 text-center text-[11px] font-bold opacity-60 tabular-nums" data-players="pages">
          {(page % pages.length) + 1} / {pages.length}
        </div>
      )}
    </div>
  );
};
