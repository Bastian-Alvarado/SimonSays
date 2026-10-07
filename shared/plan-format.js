/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How long a step of the stream plan took, written the same way on the Stream
 * plan screen, in the dock and in the recap posted to Discord.
 */

/**
 * How long a step has been on while the stream was live: what it has kept,
 * and the stretch running now. Null for a step from before time was counted
 * live, which goes by when it started and finished.
 */
export function liveLength(item, now = Date.now()) {
  if (typeof item?.liveMs !== 'number' && typeof item?.liveFrom !== 'number') return null;
  return (Number(item.liveMs) || 0) + (typeof item.liveFrom === 'number' ? Math.max(0, now - item.liveFrom) : 0);
}

/** Whether a step is counting now: it is on, and the stream is live. */
export const isCounting = (item) => typeof item?.liveFrom === 'number';

/** "25 min", "1 h", "1 h 20 min". Never less than a minute: nothing on a stream takes no time. */
export function formatLength(ms) {
  const minutes = Math.max(1, Math.round((Number(ms) || 0) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
