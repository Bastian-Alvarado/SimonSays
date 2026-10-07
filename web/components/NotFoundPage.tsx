/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What an address with no page behind it shows: a path that is not the app,
 * or a ?mode= the app has no page for — a link mistyped into an OBS browser
 * source, say. That used to open the whole dashboard, chat and settings and
 * all, and in OBS that could be on stream.
 *
 * A card of its own, so it reads on OBS's see-through page as well as in a
 * browser; in OBS the rest stays see-through, so a mistyped source covers
 * only the middle of the scene rather than all of it.
 */
import React from 'react';
import { SearchX } from 'lucide-react';
import { fill } from '../words';

export const NotFoundPage = ({ asked, t }: { asked: string; t: any }) => {
  const inObs = typeof window !== 'undefined' && Boolean((window as any).obsstudio);
  // Back to the dashboard on this same server, keeping whatever says which server that is.
  const back = new URL(window.location.href);
  back.pathname = '/';
  back.searchParams.delete('mode');
  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans" data-not-found>
      {inObs && <style>{'body, html { background: transparent !important; }'}</style>}
      <div className="max-w-md w-full rounded-3xl border border-zinc-800 bg-zinc-950/95 p-8 space-y-4 text-center shadow-2xl">
        <SearchX size={28} className="mx-auto text-current-accent" />
        <h1 className="text-lg font-black text-white">{t.notFoundTitle || 'This page doesn’t exist'}</h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {fill(t.notFoundHint || 'Nothing here answers to “{asked}”. If you copied this address into OBS, copy it again: Guides lists every page OBS can show.', { asked })}
        </p>
        <a href={back.toString()} className="inline-block px-4 py-2 rounded-xl bg-current-accent text-white text-xs font-black uppercase tracking-widest" data-not-found-back>
          {t.notFoundBack || 'Open the dashboard'}
        </a>
      </div>
    </div>
  );
};
