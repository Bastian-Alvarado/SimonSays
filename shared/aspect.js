/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A layer held to a shape — 16:9, 4:3, 1:1 — while it is resized.
 *
 * For an OBS source above all: OBS fits a source whole inside its box, so a
 * box of any other shape than the source's shows the source smaller than the
 * box, with bars, and the canvas stops saying where it really is. Held to the
 * source's shape, the box is the picture. '' is free, as before.
 */

export const ASPECTS = ['', '16:9', '16:10', '21:9', '4:3', '3:2', '1:1', '4:5', '9:16'];
const MIN = 20;

/** Width over height for one of ASPECTS, or null for free. */
export function aspectRatio(aspect) {
  const m = /^(\d+):(\d+)$/.exec(String(aspect || ''));
  return m && ASPECTS.includes(aspect) ? Number(m[1]) / Number(m[2]) : null;
}

/** Big enough to grab, scaled up as one so the shape holds. */
function atLeast(width, height) {
  const k = Math.max(1, MIN / width, MIN / height);
  return { width: width * k, height: height * k };
}

/**
 * The box a layer becomes when it is given a shape: the largest of that
 * shape that fits inside the box it had, on the same centre — so picking a
 * shape never pushes anything off the canvas.
 */
export function fitAspect(box, ratio) {
  if (!ratio) return box;
  let width = box.width;
  let height = width / ratio;
  if (height > box.height) {
    height = box.height;
    width = height * ratio;
  }
  ({ width, height } = atLeast(width, height));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x: Math.round(cx - width / 2), y: Math.round(cy - height / 2), width: Math.round(width), height: Math.round(height) };
}

/**
 * A box pulled by one of its handles, kept to a shape.
 *
 * `pulled` is where the handle took the edges it pulls (snapped already).
 * A corner follows whichever of its edges moved further and brings the other
 * along, the opposite corner staying put. A side pulls its own edge and the
 * box grows or shrinks about its middle the other way.
 */
export function holdAspect(start, pulled, grip, ratio) {
  if (!ratio) return pulled;
  const right0 = start.x + start.width;
  const bottom0 = start.y + start.height;
  const corner = grip.length === 2;
  let width;
  let height;
  if (corner) {
    const byWidth = Math.abs(pulled.width / start.width - 1) >= Math.abs(pulled.height / start.height - 1);
    width = byWidth ? pulled.width : pulled.height * ratio;
    height = byWidth ? pulled.width / ratio : pulled.height;
  } else if (grip === 'e' || grip === 'w') {
    width = pulled.width;
    height = width / ratio;
  } else {
    height = pulled.height;
    width = height * ratio;
  }
  ({ width, height } = atLeast(width, height));
  let x;
  let y;
  if (corner) {
    x = grip.includes('w') ? right0 - width : start.x;
    y = grip.includes('n') ? bottom0 - height : start.y;
  } else if (grip === 'e' || grip === 'w') {
    x = grip === 'w' ? right0 - width : start.x;
    y = start.y + start.height / 2 - height / 2;
  } else {
    y = grip === 'n' ? bottom0 - height : start.y;
    x = start.x + start.width / 2 - width / 2;
  }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/** One side typed in a number field; the other follows. */
export function sizeWithAspect(field, value, ratio) {
  if (!ratio) return { [field]: value };
  return field === 'width'
    ? { width: value, height: Math.max(MIN, Math.round(value / ratio)) }
    : { height: value, width: Math.max(MIN, Math.round(value * ratio)) };
}
