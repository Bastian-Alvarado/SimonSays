/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Where a layer lands when its row is dragged on the Overlays screen.
 *
 * The list there shows the front of the stack first, while a layout keeps
 * its layers back first — array order is stacking order. A drop is worked
 * out on the list as it is seen and turned back into array order after, so
 * the two orders are swapped in one place only.
 *
 * A group is one row of that list (shared/layer-groups.js): dragging it
 * moves all of its layers, and a layer outside it can land in front of it or
 * behind it but never in the middle.
 */

import { moveToGap } from './list-order.js';
import { displayUnits } from './layer-groups.js';

/**
 * The layers with one row moved to a gap in the list as shown: gap 0 is
 * above the first row (the very front), gap n below the last (the very
 * back). The row is a layer's uid, or a group's key. The same array comes
 * back when nothing would move — the gaps either side of the row itself, or
 * a row that is not there.
 */
export function dropLayer(layers, id, gap) {
  const units = displayUnits(layers);
  const moved = moveToGap(units, units.findIndex((u) => u.id === id), gap);
  return moved === units ? layers : moved.flatMap((u) => u.layers).reverse();
}
