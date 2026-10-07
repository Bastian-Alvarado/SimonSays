/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Who a lower third is about.
 *
 * A nameplate can have a name typed into it, or it can follow the run: the
 * person playing, the host, or one of the commentators. Following is the point
 * of the run record existing — four plates that each have to be retyped when
 * the guests change are four chances to leave last week's name on stream.
 *
 * Named here rather than in the layer, because three things need the same
 * list: the validator that decides which sources may be stored, the canvas
 * that resolves one into a name, and the editor that offers them.
 */

/** As many commentators as fit across a lower third without reflowing it. */
export const MAX_COMMENTATORS = 4;
/** The seats on the Remote players screen (server/engine/remote-players.js). */
export const REMOTE_SEATS = 4;

/*
  Each with the translation key the editor shows it by; `label` is the
  English it falls back to, and a commentator's key carries "{n}".
*/
export const NAMEPLATE_SOURCES = [
  { id: 'manual', label: 'Typed here', key: 'plateSourceManual' },
  { id: 'runner', label: 'Who is playing', key: 'plateSourceRunner' },
  { id: 'host', label: 'Host', key: 'plateSourceHost' },
  ...Array.from({ length: MAX_COMMENTATORS }, (_, i) => ({
    id: `commentator${i + 1}`, label: `Commentator ${i + 1}`, key: 'plateSourceCommentator', n: i + 1,
  })),
  ...Array.from({ length: REMOTE_SEATS }, (_, i) => ({
    id: `player${i + 1}`, label: `Remote player ${i + 1}`, key: 'plateSourcePlayer', n: i + 1,
  })),
];

export const NAMEPLATE_SOURCE_IDS = NAMEPLATE_SOURCES.map((s) => s.id);

/**
 * The name and second line a plate should show.
 *
 * Returns null for 'manual', meaning "use what was typed into the layer".
 *
 * A source pointing at somebody who is not there — the third commentator on a
 * night with two — returns empty rather than falling back to the typed text.
 * Falling back would put the wrong person's name on screen, which is worse
 * than a plate that draws nothing; the nameplate already disappears when it
 * has no name.
 */
export function resolvePerson(source, run, remotePlayers) {
  if (!source || source === 'manual') return null;
  if (source === 'runner') return run?.runner || { name: '', subtitle: '' };
  if (source === 'host') return run?.host || { name: '', subtitle: '' };

  const match = /^commentator([1-9])$/.exec(source);
  if (match) {
    const at = Number(match[1]) - 1;
    return (run?.commentators || [])[at] || { name: '', subtitle: '' };
  }
  // A remote player's seat: whoever is in it, by name; an empty seat, nobody.
  const seat = /^player([1-9])$/.exec(source);
  if (seat) {
    const found = (remotePlayers?.seats || []).find((s) => s?.n === Number(seat[1]));
    return { name: String(found?.name || ''), subtitle: '' };
  }
  return null;
}

/**
 * How many seats a couch can fill: the commentators, plus the host, plus
 * whoever is playing. More seats than that could only ever be drawn empty, so
 * the editor does not offer them and the server does not keep them.
 */
export function rosterCapacity(include) {
  if (include === 'everyone') return MAX_COMMENTATORS + 2;
  if (include === 'couch') return MAX_COMMENTATORS + 1;
  return MAX_COMMENTATORS;
}

/** Whether two game names are the same game, as a person would read them. */
export function sameGame(a, b) {
  const tidy = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return Boolean(tidy(a)) && tidy(a) === tidy(b);
}

/** A Twitch login from whatever was typed — "@Name", "twitch.tv/name", "name" — or empty for anything that is not one. */
export function cleanLogin(value) {
  const s = String(value ?? '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/+$/, '').toLowerCase();
  return /^[a-z0-9_]{1,25}$/.test(s) ? s : '';
}

/**
 * A person in a seat, or a regular: the name and second line a plate shows,
 * and — when known — their Twitch login, for a shoutout, and their Discord
 * account, for seating them from the call. Unknown ones are left off rather
 * than kept empty, so a person nobody linked reads exactly as before.
 */
export function cleanPerson(p) {
  const twitch = cleanLogin(p?.twitch);
  const discordId = /^\d{5,25}$/.test(String(p?.discordId ?? '')) ? String(p.discordId) : '';
  return {
    name: String(p?.name ?? '').trim().slice(0, 60),
    subtitle: String(p?.subtitle ?? '').trim().slice(0, 80),
    ...(twitch ? { twitch } : {}),
    ...(discordId ? { discordId } : {}),
  };
}
