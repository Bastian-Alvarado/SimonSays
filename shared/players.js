/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The players list: who is in tonight's game.
 *
 * For community nights rather than speedruns — the run card keeps a runner,
 * a host and a few commentators, and a lobby of fifteen crewmates or a room
 * of thirty drawing each other badly is not that. Shared, because both ends
 * have to agree exactly: the server cleans what it is sent with these rules,
 * and the screens offer what the server will keep.
 */

/**
 * As many as a list holds.
 *
 * Fifty covers the biggest room anyone runs on stream — a full Gartic Phone
 * room — with margin over Fall Guys (32) and Mario Kart World (24). A layer
 * shows them a page at a time; the list itself is not what is on screen.
 */
export const MAX_PLAYERS = 50;

/** How many one page of the layer may show. More is a grid nobody can read. */
export const MAX_PER_PAGE = 24;

/**
 * Where a player stands. "in" is playing; the rest are ways of not being.
 * Generic on purpose: "out" is any elimination, and the other two are there
 * for the social-deduction games where how somebody left is the story.
 */
export const PLAYER_STATES = ['in', 'out', 'ejected', 'dead'];

/**
 * Colours a player can name from chat — "!join red". The twelve of a
 * social-deduction lobby, and the handful anyone else would reach for.
 */
export const PLAYER_COLOURS = {
  red: '#c51111',
  blue: '#132ed1',
  green: '#117f2d',
  pink: '#ed54ba',
  orange: '#ef7d0d',
  yellow: '#f5f557',
  black: '#3f474e',
  white: '#d6e0f0',
  purple: '#6b2fbb',
  brown: '#71491e',
  cyan: '#38fedc',
  lime: '#50ef39',
  maroon: '#6b2b3c',
  rose: '#ecc0d3',
  banana: '#fffebe',
  gray: '#758593',
  grey: '#758593',
  tan: '#928776',
  coral: '#d76464',
};

/** The palette a player with no colour of their own is given one from. */
const AUTO = ['red', 'blue', 'green', 'pink', 'orange', 'yellow', 'purple', 'cyan', 'lime', 'brown', 'white', 'coral'];

/**
 * A colour for a name, the same every time, so a regular keeps theirs across
 * nights without anybody choosing it.
 */
export function colourFor(name) {
  let h = 0;
  for (const ch of String(name || '').toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PLAYER_COLOURS[AUTO[h % AUTO.length]];
}

/**
 * A colour from what somebody typed: a name from the list, or a hex code.
 * Anything else is no colour, and the player keeps the one they had.
 */
export function readColour(raw) {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return '';
  if (PLAYER_COLOURS[text]) return PLAYER_COLOURS[text];
  return /^#[0-9a-f]{6}$/.test(text) ? text : '';
}

/** A player's name, as the list keeps it. */
export const cleanName = (raw) => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);

/** Two names that are the same person: case and a leading @ do not count. */
export const sameName = (a, b) => cleanName(a).replace(/^@/, '').toLowerCase() === cleanName(b).replace(/^@/, '').toLowerCase();

/**
 * A whole list, held to what it can be: named, coloured, in a known state,
 * no one twice, and no more than fifty.
 */
export function cleanPlayers(incoming) {
  const items = Array.isArray(incoming?.items) ? incoming.items : [];
  const out = [];
  for (const p of items) {
    const name = cleanName(p?.name);
    if (!name || out.some((q) => sameName(q.name, name))) continue;
    out.push({
      id: typeof p?.id === 'string' && p.id ? p.id.slice(0, 40) : Math.random().toString(36).slice(2, 11),
      name,
      colour: readColour(p?.colour) || colourFor(name),
      state: PLAYER_STATES.includes(p?.state) ? p.state : 'in',
    });
    if (out.length >= MAX_PLAYERS) break;
  }
  return { items: out };
}
