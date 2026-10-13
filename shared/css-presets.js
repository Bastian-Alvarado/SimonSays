/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The library: stylesheets to start from, grouped by the look they belong to.
 *
 * Grouped rather than listed, because a look is the thing somebody wants. The
 * ticker, the run card and the nameplate in "Marathon" are one decision, not
 * three, and a flat list of a dozen names makes you rebuild that decision
 * every time.
 *
 * Each entry names only parts the app promises to keep, so a preset cannot
 * quietly stop working when a component is rewritten. Tests hold that, and
 * hold each one to the layer it is offered on.
 *
 * Every one of these was rendered on a canvas and looked at before it was
 * written down. That matters more than it sounds: two were wrong the first
 * time in ways reading would never have shown — corner brackets that came out
 * a solid block, and a bezel that covered the digits it was meant to frame.
 *
 * Shaped as data with nothing built in about where it came from, so that a
 * page for making your own can add to the same list later without this having
 * to change.
 */

import { LOOK_THEMES } from './looks/index.js';

/** Every theme, in the Library's order: shared/looks/, a file each. */
export const CSS_LOOKS = LOOK_THEMES;

/**
 * Which box an entry belongs in.
 *
 * A look and a motion are different decisions about the same layer, kept in
 * different fields so that changing one cannot take the other with it. Every
 * entry that does not say is a look, which is what all of them were.
 */
/**
 * What a preset is written onto: a layer on a canvas, one alert, or the chat.
 *
 * An alert is not a layer. A layout holds one alerts layer that every alert
 * on the channel plays through, so these go on the alert record itself and
 * are picked one at a time rather than dropped across a layout.
 */
export const presetApplies = (entry) => {
  if (entry.applies === 'alert') return 'alert';
  if (entry.applies === 'chat') return 'chat';
  return 'layer';
};

export const presetKind = (entry) => (entry.kind === 'motion' ? 'motion' : 'look');

/** The field on a layer that a preset of this kind is written into. */
export const presetField = (entry) => (presetKind(entry) === 'motion' ? 'motionCss' : 'css');

/** Every entry, flat, for the places that do not care which look it came from. */
export const ALL_PRESETS = CSS_LOOKS.flatMap((look) =>
  look.objects.map((object) => ({ ...object, lookId: look.id, lookName: look.name })));

/**
 * The kinds of layer the library has anything for, in the order they appear.
 *
 * Read from the presets rather than written down beside them, so a filter can
 * never offer a kind with nothing behind it.
 */
export const PRESET_LAYER_TYPES = [...new Set(ALL_PRESETS.map((p) => p.layerType))];

/**
 * Whether a whole look can be dropped onto every matching layer at once.
 *
 * Shapes cannot. A layout holds many of them and each is a different piece of
 * the build — a wall, a frame, a divider — so writing one stylesheet across
 * all of them would destroy the others. Everything else in a layout is either
 * the only one of its kind or a set that wants to match.
 */
export const canApplyInBulk = (layerType) => layerType !== 'shape';

// The dock's chat: in its own file, so a page can have it without every look (dock-chat-css.js).
export { DOCK_CHAT_CSS } from './dock-chat-css.js';
