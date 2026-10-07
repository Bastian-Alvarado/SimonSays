/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The fonts the user has uploaded, for the pickers to offer.
 *
 * Only the names. The faces themselves are declared by the server in a
 * generated stylesheet the page already links, so nothing here has to load
 * anything — by the time a name appears in a list, the browser can render it.
 *
 * A hook rather than a prop threaded through every panel with a font control:
 * there are four of them in different parts of the tree, and the list is the
 * same list for all of them.
 */
import { useEffect, useState } from 'react';
import { fontFamilyName } from '../../shared/chat-style.js';

/** Shared across every caller, so opening four panels is still one request. */
let cache: string[] | null = null;
let inFlight: Promise<string[]> | null = null;

const load = (): Promise<string[]> => {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  inFlight = fetch('/api/assets')
    .then((r) => (r.ok ? r.json() : []))
    .then((list: any[]) => {
      const names = (Array.isArray(list) ? list : [])
        .filter((a) => a?.kind === 'font')
        .map((a) => fontFamilyName(a.name))
        .filter(Boolean);
      // A family uploaded as both woff2 and ttf is one font, not two.
      cache = [...new Set(names)].sort((a, b) => a.localeCompare(b));
      return cache;
    })
    .catch(() => [])
    .finally(() => { inFlight = null; });
  return inFlight;
};

/** Forget the list, so an upload shows up without a reload. */
export const forgetCustomFonts = () => { cache = null; };

export const useCustomFonts = (): string[] => {
  const [fonts, setFonts] = useState<string[]>(cache || []);
  useEffect(() => {
    let alive = true;
    load().then((f) => { if (alive) setFonts(f); });
    return () => { alive = false; };
  }, []);
  return fonts;
};
