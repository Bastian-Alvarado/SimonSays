/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who a talking layer — a pixel avatar, a PNGtuber — can be set to talk with.
 *
 * It used to be only whoever was in the call at that moment, so a layout
 * could not be set up for a friend before they joined, and with an empty call
 * the list said nobody at all. Now it is three groups, each person once:
 *
 *   in the call now     — as before, in the call's own order;
 *   people set up       — anybody the app already knows by their Discord id:
 *                         a name on stream, pictures, a pin or the follow on
 *                         the Voice call screen, or a Discord account on a
 *                         Who's on regular;
 *   everyone else       — the rest of the Discord server, as the Voice call
 *                         screen lists it.
 *
 * Under their name on stream where they have one, since that is what the
 * stream calls them. Nobody kept off stream is offered: the call never says
 * when they talk, to keep them off every overlay, so a layer set to them
 * would never move. The one already chosen is always offered, even when no
 * group has them, so the choice does not read as blank.
 *
 * Here in shared/, without the screen, so what it offers can be tested.
 */

const DISCORD_ID = /^\d{5,25}$/;

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * @param {object} from
 * @param {{id: string, name: string}[]} [from.members]   who is in the call, as the voice state lists them
 * @param {object} [from.voice]                           the voice state: persons, pictures, pinned, follow
 * @param {{name?: string, discordId?: string}[]} [from.regulars]  Who's on regulars
 * @param {{id: string, name: string}[]} [from.server]    everyone in the Discord server
 * @param {{id: string, name: string} | null} [from.chosen]  who the layer talks with now
 */
export function talkChoices({ members = [], voice = {}, regulars = [], server = [], chosen = null } = {}) {
  const persons = voice?.persons || {};
  const away = new Set(Object.entries(persons).filter(([, p]) => p?.offStream).map(([id]) => id));
  // The name on stream first, then whatever name came with them.
  const named = (id, name) => persons[id]?.streamName || name || persons[id]?.name || '';

  const seen = new Set();
  const take = (list) => {
    const out = [];
    for (const p of list) {
      const id = String(p?.id ?? '');
      if (!DISCORD_ID.test(id) || seen.has(id) || away.has(id)) continue;
      seen.add(id);
      out.push({ id, name: String(p.name || id) });
    }
    return out;
  };

  const inCall = take((members || []).map((m) => ({ id: m?.id, name: m?.name })));
  const known = take([
    ...Object.entries(persons).map(([id, p]) => ({ id, name: named(id, p?.name) })),
    ...Object.entries(voice?.pictures || {}).map(([id, p]) => ({ id, name: named(id, p?.name) })),
    ...(voice?.pinned || []).map((p) => ({ id: p?.id, name: named(p?.id, p?.name) })),
    ...(voice?.follow ? [{ id: voice.follow.id, name: named(voice.follow.id, voice.follow.name) }] : []),
    ...(regulars || []).filter((r) => r?.discordId).map((r) => ({ id: r.discordId, name: named(r.discordId, r.name) })),
  ]).sort(byName);
  const everyone = take((server || []).map((m) => ({ id: m?.id, name: named(m?.id, m?.name) }))).sort(byName);

  /*
    Chosen before, and in no group now — gone from the server, the list not
    loaded yet, or kept off stream since, which the panel says, as that one
    will never talk.
  */
  const id = String(chosen?.id ?? '');
  const kept = DISCORD_ID.test(id) && !seen.has(id)
    ? { id, name: String(named(id, chosen.name) || id), ...(away.has(id) ? { offStream: true } : {}) }
    : null;

  return { inCall, known, server: everyone, kept };
}

/** Everybody offered, in one list, to find the one picked. */
export const allChoices = (c) => [...(c.kept ? [c.kept] : []), ...c.inCall, ...c.known, ...c.server];
