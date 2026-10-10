/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Whether this is a phone held sideways: a touch screen, wider than tall, and
 * short — where the dock and the deck lay themselves out across the width
 * rather than down it. A tablet sideways has the height to stay as it is, and
 * a short, wide OBS dock on a computer has a mouse, so neither changes.
 */
import { useEffect, useState } from 'react';

export const SIDEWAYS_QUERY = '(orientation: landscape) and (max-height: 600px) and (hover: none) and (pointer: coarse)';

export function useSideways() {
  const [sideways, setSideways] = useState(() => {
    try { return window.matchMedia(SIDEWAYS_QUERY).matches; } catch { return false; }
  });
  useEffect(() => {
    let query: MediaQueryList;
    try { query = window.matchMedia(SIDEWAYS_QUERY); } catch { return undefined; }
    const update = () => setSideways(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return sideways;
}
