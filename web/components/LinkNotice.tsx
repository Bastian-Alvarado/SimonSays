/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What the dashboard says about its link to the server.
 *
 * It used to say nothing. With the connection down the screens went on
 * looking as they always do — accounts signed out, lists empty, "All changes
 * saved" — and what was changed went nowhere. Three things are said here, at
 * the bottom of the screen, over whatever is open:
 *   - not connected: nothing changed now is saved until it is back;
 *   - connected, but the server's state is still on its way (a slow link);
 *   - something asked for that the server refused, where no screen was
 *     waiting for the answer to say so itself.
 * The first two wait a moment before showing, so a page load or a blip of a
 * second does not flash them.
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { refusalWords } from '../words';

export interface LinkState {
  connected: boolean;
  loaded: boolean;
  layoutsUnsaved: boolean;
  refused: any;
  clearRefused: () => void;
}

/** How long the link may be down, or the state on its way, before it is worth saying. */
export const LINK_NOTICE_AFTER_MS = 2500;
/** How long a refusal stays up by itself. */
export const LINK_REFUSED_FOR_MS = 10_000;

export const LinkNotice: React.FC<{ link: LinkState; t: any }> = ({ link, t }) => {
  const waiting = !link.connected ? 'offline' : !link.loaded ? 'loading' : '';
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!waiting) { setShown(''); return; }
    const timer = setTimeout(() => setShown(waiting), LINK_NOTICE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const refused = link.refused;
  useEffect(() => {
    if (!refused) return;
    const timer = setTimeout(link.clearRefused, LINK_REFUSED_FOR_MS);
    return () => clearTimeout(timer);
  }, [refused]);

  if (!shown && !refused) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 px-4 w-full max-w-xl pointer-events-none" data-link-notice>
      {shown && (
        <div role="status" data-link-state={shown} className="pointer-events-auto w-full glass-panel rounded-2xl border border-amber-400/50 px-4 py-3 text-[12px] font-bold text-amber-300 leading-relaxed">
          {shown === 'offline'
            ? (t.linkOffline || 'Not connected to the server. Nothing you change is saved until it is back. Trying again…')
            : (t.linkLoading || 'Connected. Getting your setup from the server…')}
        </div>
      )}
      {refused && (
        <div role="alert" data-link-refused={refused.for || ''} className="pointer-events-auto w-full glass-panel rounded-2xl border border-red-400/50 px-4 py-3 text-[12px] font-bold text-red-300 leading-relaxed flex items-start gap-3">
          <span className="flex-1 min-w-0">{refusalWords(t, refused.code ? refused : null) || (t.linkRefused || 'The server could not do that. Nothing was changed.')}</span>
          <button onClick={link.clearRefused} aria-label={t.close || 'Close'} className="shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center hover:text-white transition-colors"><X size={14} /></button>
        </div>
      )}
    </div>
  );
};
