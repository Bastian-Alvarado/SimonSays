/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The home screen's own settings (2.1.0, web DashboardView): which layouts
 * get a button there, to put on screen in one press. Picked by whoever uses
 * it — the streamer's here, each moderator's in their own copy
 * (engine/mod-decks.js) — and in the order picked.
 *
 * Putting one on screen is Omnilayer's "go" when Omnilayer is on; without
 * it, the first OBS scene the layout is bound to, which is what shows it.
 */

import { collection } from '../core/store.js';
import { refusal } from '../core/refusal.js';
import * as omnilayer from './omnilayer.js';
import * as obs from '../platforms/obs.js';

/** As many buttons as fit in a row on the home screen. */
export const MAX_HOME_LAYOUTS = 8;

let db = null;
const store = () => (db ??= collection('home_settings', { layouts: [] }));

export function initHome() {
  store();
}

/** Layout ids, checked: strings, no repeats, at most MAX_HOME_LAYOUTS. */
export const cleanHomeLayouts = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string' && x).map((x) => x.slice(0, 80)))].slice(0, MAX_HOME_LAYOUTS);

export const homeLayouts = () => store().get().layouts || [];
export function setHomeLayouts(ids) {
  const layouts = cleanHomeLayouts(ids);
  store().set({ ...store().get(), layouts });
  return layouts;
}

/** Put a layout on screen: through Omnilayer, or by its OBS scene. */
export async function show(layoutId, layouts) {
  const layout = (layouts || []).find((l) => l.id === layoutId);
  if (!layout) throw refusal('no_layout', 'there is no layout like that');
  if (omnilayer.getOmnilayer().enabled) return omnilayer.goLive(layout.id);
  const scene = (layout.scenes || [])[0];
  if (!scene) throw refusal('home_no_scene', 'this layout is not bound to an OBS scene, and Omnilayer is off');
  await obs.setScene(scene);
  return { ok: true, scene };
}
