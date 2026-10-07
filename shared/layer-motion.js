/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How a layer moves.
 *
 * Two separate things, because they answer different questions. An entrance
 * is what happens when the layer arrives — which matters most for a layer
 * that waits on a condition, since it arrives in the middle of a stream and
 * otherwise simply blinks into existence. An idle is what it does while it is
 * there, which is what makes an overlay feel built rather than placed.
 *
 * Named here so the editor's list, the canvas's stylesheet and the server's
 * validator cannot drift: an animation this build offers but has no keyframes
 * for is a layer that quietly does not move.
 */

/** Entrances. Each name matches a @keyframes block in the stylesheet. */
export const LAYER_ENTRANCES = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade in', css: 'layer-in-fade' },
  { id: 'up', label: 'Rise', css: 'layer-in-up' },
  { id: 'down', label: 'Drop', css: 'layer-in-down' },
  { id: 'left', label: 'In from left', css: 'layer-in-left' },
  { id: 'right', label: 'In from right', css: 'layer-in-right' },
  { id: 'zoom', label: 'Zoom', css: 'layer-in-zoom' },
  { id: 'pop', label: 'Pop', css: 'layer-in-pop' },
];

/** Loops, for while the layer is on screen. */
export const LAYER_IDLES = [
  { id: 'none', label: 'Still' },
  { id: 'float', label: 'Float', css: 'layer-idle-float' },
  { id: 'pulse', label: 'Pulse', css: 'layer-idle-pulse' },
  { id: 'sway', label: 'Sway', css: 'layer-idle-sway' },
  { id: 'spin', label: 'Spin', css: 'layer-idle-spin' },
  { id: 'breathe', label: 'Breathe', css: 'layer-idle-breathe' },
];

export const ENTRANCE_IDS = LAYER_ENTRANCES.map((e) => e.id);
export const IDLE_IDS = LAYER_IDLES.map((e) => e.id);

const ENTRANCE_BY_ID = new Map(LAYER_ENTRANCES.map((e) => [e.id, e]));
const IDLE_BY_ID = new Map(LAYER_IDLES.map((e) => [e.id, e]));

/**
 * The `animation` shorthand for a layer, or undefined when it does not move.
 *
 * Undefined rather than 'none' on purpose: an animation property, even an
 * inert one, promotes the element to its own compositing surface, and a
 * canvas of a dozen still layers should cost a browser source nothing.
 *
 * `speed` is a percentage where 100 is the natural pace, because a person
 * setting this is thinking "half as fast", not "1.4 seconds".
 */
export function layerAnimation(layer) {
  const entrance = ENTRANCE_BY_ID.get(layer?.animateIn);
  const idle = IDLE_BY_ID.get(layer?.animateIdle);
  if (!entrance?.css && !idle?.css) return undefined;

  const speed = Number(layer?.animateSpeed);
  const scale = (Number.isFinite(speed) && speed > 0 ? speed : 100) / 100;
  const parts = [];

  // The entrance runs once and the idle loops, so both can be listed: the
  // idle picks up where the entrance left off rather than fighting it.
  if (entrance?.css) {
    parts.push(`${entrance.css} ${(0.5 / scale).toFixed(2)}s cubic-bezier(0.34, 1.2, 0.64, 1) both`);
  }
  if (idle?.css) {
    // A spin reads as broken unless it is slow and even; the rest breathe.
    const seconds = (idle.id === 'spin' ? 12 : 4) / scale;
    const timing = idle.id === 'spin' ? 'linear' : 'ease-in-out';
    const delay = entrance?.css ? ` ${(0.5 / scale).toFixed(2)}s` : '';
    parts.push(`${idle.css} ${seconds.toFixed(2)}s ${timing}${delay} infinite`);
  }

  return parts.join(', ');
}
