/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Which layout is on stream now: the one bound to the OBS scene that is live,
 * or — while nobody binds layouts to scenes at all — the first, so a browser
 * source set up before scene binding existed keeps working. Once bindings
 * exist, a scene nobody bound shows nothing, because that is what leaving it
 * unbound means.
 *
 * One rule for everything that asks: the canvas the stream draws, and the
 * screens that want to aim at what the stream is showing — so the two never
 * disagree about which layout that is.
 */

/**
 * The layout on stream for `currentScene`, or null when that scene shows none.
 *
 * With Omnilayer on (server/engine/omnilayer.js) the app decides instead:
 * whichever layout it put live, while OBS is on the Omnilayer scene — or on
 * any, when none is named or OBS has said nothing. A different scene still
 * shows what is bound to it, so the two ways can live side by side.
 */
export function liveLayout(layouts = [], currentScene = '', omnilayer = null) {
  const list = Array.isArray(layouts) ? layouts : [];
  if (omnilayer?.enabled && omnilayer.live && (!omnilayer.scene || !currentScene || currentScene === omnilayer.scene)) {
    const chosen = list.find((l) => l.id === omnilayer.live);
    if (chosen) return chosen;
  }
  const bound = currentScene ? list.find((l) => Array.isArray(l.scenes) && l.scenes.includes(currentScene)) : null;
  if (bound) return bound;
  const anyBindings = list.some((l) => Array.isArray(l.scenes) && l.scenes.length);
  return anyBindings ? null : list[0] || null;
}
