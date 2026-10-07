/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The pixel avatar: its parts and their colours, its expressions and extras,
 * and the colours it can be dressed in. The drawing itself is text, in
 * shared/avatar-art.js.
 *
 * Built as a grid and drawn as one path per part, so every part is a single
 * fill that a stylesheet can reach (--avatar-<part>) and a colour change is
 * a change of fills, never a redraw. The same code draws it in the browser
 * and writes it out as an SVG file.
 */

import { AVATAR_BASE, AVATAR_EXPRESSIONS, AVATAR_EXTRAS, AVATAR_COSTUMES, AVATAR_BUBBLE, AVATAR_PARTS, AVATAR_OUTFIT_WORDS, AVATAR_OUTFIT_NAMES, AVATAR_COLOUR_NAME, AVATAR_COLOURING } from './avatar-art.js';
import { PLAYER_COLOURS } from './players.js';
import { AVATAR_HAT_ART, AVATAR_HAT_WORDS } from './avatar-hats.js';
import { AVATAR_REGULARS } from './avatar-regulars.js';
import { AVATAR_ACTIONS, AVATAR_ACTION_WORDS } from './avatar-actions.js';

export { AVATAR_HAT_ART, AVATAR_REGULARS, AVATAR_ACTIONS, AVATAR_PARTS, AVATAR_OUTFIT_NAMES, AVATAR_COLOUR_NAME };

/*
  The extras as patches on the grid. The drawn hats bring only what they hide
  of the head here — the hair that would stick up out of their tops — and are
  drawn over it as pictures of their own (avatarHatPaths).
*/
const EXTRAS = { ...AVATAR_EXTRAS, ...Object.fromEntries(Object.entries(AVATAR_HAT_ART).map(([id, hat]) => [id, hat.hides])) };

const BY_CHAR = Object.fromEntries(AVATAR_PARTS.map((p) => [p.char, p]));

/** Faces, in the order they are offered. neutral is the drawing as it was drawn. */
export const AVATAR_EXPRESSIONS_LIST = ['neutral', 'blink', 'talking', 'happy', 'surprised', 'startled', 'wink', 'sad', 'angry', 'star-eyes', 'heart-eyes', 'dizzy', 'sleepy', 'deep-sleep'];

/** Things worn or shown over any face. Only one hat at a time. */
export const AVATAR_HATS = ['party-hat', ...Object.keys(AVATAR_HAT_ART)];
export const AVATAR_EXTRAS_LIST = ['blush', 'sweat', 'mic', ...AVATAR_HATS];

/** Outfits: '' is the one it was drawn in; the rest are in AVATAR_COSTUMES. */
export const AVATAR_COSTUMES_LIST = ['', ...Object.keys(AVATAR_COSTUMES)];

/** Outfits with headwear of their own, which wear no other hat. */
export const AVATAR_HEADWEAR = Object.keys(AVATAR_COSTUMES).filter((c) => AVATAR_COSTUMES[c].headwear);

/**
 * What viewers can dress it in, and the words they might use for each, in
 * English and Spanish — "!outfit" or "!hat" and a name. An outfit of '' is
 * the one it was drawn in; a hat of none takes the hat off.
 */
export const AVATAR_DRESS_WORDS = {
  // The outfits' words are the character's own (shared/avatar-art.js); so are the hats' (shared/avatar-hats.js).
  outfit: AVATAR_OUTFIT_WORDS,
  hat: {
    none: ['none', 'off', 'nada', 'ninguno', 'quitar'],
    ...AVATAR_HAT_WORDS,
  },
};

/**
 * The outfit or hat a viewer's words name ('outfit' or 'hat'), or null when
 * they name none: the name itself, or any of its words anywhere in what they
 * typed — "gorro de navidad" is the Santa hat. Case and accents do not matter.
 */
export function avatarDressName(what, words) {
  const table = AVATAR_DRESS_WORDS[what];
  const text = String(words ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!table || !text) return null;
  const said = text.split(/[^a-z0-9]+/).filter(Boolean);
  for (const [name, list] of Object.entries(table)) {
    if (name && text === name) return name;
    if (list.some((w) => said.includes(w))) return name;
  }
  return null;
}

/**
 * The grid for a face and whatever it is wearing, as 100 strings of 100
 * characters. Several faces are laid one over the next — ['sad', 'talking',
 * 'blink'] is the sad face, talking, mid-blink. Unknown faces and extras are
 * left off; of two hats, the last one wins.
 *
 * A costume is the whole drawing redrawn, under all of that; one with its
 * own headwear wears no other hat. On a costume a face paints only what it
 * changes from the original; where it keeps the original, the costume stays.
 * One with a face of its own (its own glasses) lays its own eyes and brows
 * inside that face instead, and its glasses over them.
 *
 * The resting eyes can also look elsewhere, half-shut or twinkle — see
 * below — which a face with eyes of its own ignores.
 *
 * @param {string | string[]} [expression]
 * @param {string[]} [extras]
 * @param {string} [costume]
 * A frame of something it does (drinking — see avatarActionFrames) goes
 * over all of that, last: its hand and glass are in front of everything.
 *
 * @param {{ look?: string, sparkle?: string, half?: boolean }} [eyes]
 * @param {{ name: string, frame: number } | null} [action]
 * @returns {string[]}
 */
export function avatarGrid(expression = 'neutral', extras = [], costume = '', eyes = {}, action = null) {
  const outfit = AVATAR_COSTUMES[costume];
  const own = outfit?.ownFace;
  const grid = (outfit?.rows || AVATAR_BASE).map((row) => row.split(''));
  const inOwnFace = (x, y) => own && x >= own.region[0] && x <= own.region[2] && y >= own.region[1] && y <= own.region[3];
  // original: one of the original's faces. On a costume, where it keeps the original drawing it keeps
  // the costume instead, so an anger mark does not paint the original's hair over a headdress.
  const lay = (patches, original = false) => {
    for (const { at: [x0, y0], rows } of patches || []) {
      rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx += 1) {
          const c = row[dx];
          if (c === '.') continue;
          const y = y0 + dy; const x = x0 + dx;
          if (y < 0 || y > 99 || x < 0 || x > 99) continue;
          let paint = c === '_' ? '.' : c;
          if (original && outfit) {
            if (inOwnFace(x, y)) continue;
            if (paint === AVATAR_BASE[y][x]) paint = outfit.rows[y][x];
          }
          grid[y][x] = paint;
        }
      });
    }
  };
  const faces = [].concat(expression || []);
  for (const face of faces) {
    if (face === 'neutral') continue;
    lay(AVATAR_EXPRESSIONS[face], true);
    if (own) lay(own.expressions[face]);
  }
  if (faces.every((f) => RESTING_EYES.includes(f))) {
    let moved = grid;
    if (eyes?.look && eyes.look !== 'right' || eyes?.sparkle && eyes.sparkle !== 'normal') moved = lookAt(moved, eyes.look, eyes.sparkle);
    if (eyes?.half) moved = halfShut(moved, own ? 55 : 53);
    moved.forEach((row, y) => { grid[y] = row; });
  }
  // Glasses of its own sit in front of the eyes, whatever they are doing.
  if (own) lay(own.glasses);
  const wanted = (extras || []).filter((e) => EXTRAS[e]);
  const hat = outfit?.headwear ? null : wanted.filter((e) => AVATAR_HATS.includes(e)).pop();
  for (const e of AVATAR_EXTRAS_LIST) {
    if (!wanted.includes(e)) continue;
    if (AVATAR_HATS.includes(e) && e !== hat) continue;
    lay(EXTRAS[e]);
  }
  if (action) lay(avatarActionFrames(action.name, costume)?.[action.frame]?.patches);
  return grid.map((row) => row.join(''));
}

// ------------------------------------------------------------- what it does

/** What it can do, a frame at a time, in the order they are offered. */
export const AVATAR_ACTIONS_LIST = Object.keys(AVATAR_ACTIONS);

/**
 * The frames of something it does, in this outfit ('' the one it was drawn in), or null
 * when that outfit has not been drawn doing it — which then plays nothing.
 *
 * @returns {{ ms: number, eyes?: 'shut', patches: { at: number[], rows: string[] }[] }[] | null}
 */
export function avatarActionFrames(name, costume = '') {
  return AVATAR_ACTIONS[name]?.costumes?.[costume || ''] || null;
}

/** How long it takes, start to end, in milliseconds: 0 when that outfit does not do it. */
export function avatarActionMs(name, costume = '') {
  return (avatarActionFrames(name, costume) || []).reduce((sum, f) => sum + f.ms, 0);
}

/**
 * The name of something it does, from what somebody typed: its own name, or
 * a loose word in English or Spanish ("agua", "tomar"). null when it names
 * nothing.
 */
// The character's own (shared/avatar-actions.js), beside the frames they name.
export { AVATAR_ACTION_WORDS };
export function avatarActionName(words) {
  const said = String(words ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!said) return null;
  for (const [name, list] of Object.entries(AVATAR_ACTION_WORDS)) {
    if (said === name || list.includes(said)) return name;
  }
  return null;
}

// ------------------------------------------------------------- the eyes

/*
  The eyes move by themselves: glancing about, half-shutting on the way into
  and out of a blink, and the sparkle twinkling. Worked out from the eyes as
  drawn rather than drawn again for every combination: each eye is its
  opening (the white and the iris) and its iris (ring, colour and sparkle),
  and the iris slides inside the opening. Only the resting eyes move like
  this; a face with eyes of its own (sad, angry, surprised…) keeps them.
*/

const EYE_BOXES = [{ x0: 27, x1: 39 }, { x0: 52, x1: 63 }];
const EYE_ROWS = [56, 64];
const EYE_CHARS = 'OrWIi';

/** Where the eyes can look, as how far the iris slides. Right is how it was drawn. */
export const AVATAR_LOOKS = { right: [0, 0], centre: [-2, 0], left: [-3, 0], up: [0, -1], 'up-left': [-2, -1], down: [0, 1], 'down-left': [-2, 1] };

/**
 * Which way to look from one box to another on the canvas, as one of the
 * looks above: the direction from the avatar's middle to the other's, in
 * eight sectors folded onto the looks there are. Right is how it was drawn,
 * so up-right is up and down-right is down; something right on top of it
 * is looked at straight ahead.
 */
export function avatarLookToward(from, to) {
  const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
  const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
  if (Math.hypot(dx, dy) < Math.min(from.width, from.height) / 2) return 'centre';
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (a > -30 && a <= 30) return 'right';
  if (a > 30 && a <= 110) return 'down';
  if (a > 110 && a <= 160) return 'down-left';
  if (a > 160 || a <= -160) return 'left';
  if (a > -160 && a <= -110) return 'up-left';
  return 'up';
}

/**
 * Too much at once: given when the things it tried to look at happened,
 * whether enough of them landed close enough together to make it dizzy.
 * Three within a second and a half, out of the box.
 */
export const AVATAR_OVERWHELM = { count: 3, withinMs: 1500, dizzyMs: 3000 };

export function avatarOverwhelmed(times, now = Date.now(), { count = AVATAR_OVERWHELM.count, withinMs = AVATAR_OVERWHELM.withinMs } = {}) {
  return times.filter((t) => now - t <= withinMs).length >= count;
}

/** What an avatar glances at when it happens, by the kind of layer it happens on. */
export const AVATAR_WATCHES = { chat: 'chat', alert: 'alerts', poll: 'poll', question: 'question', song: 'spotify' };

/** Faces whose eyes are the resting ones, and so can glance and half-blink. */
const RESTING_EYES = ['neutral', 'talking'];

function eyeParts(g, { x0, x1 }) {
  const mask = new Map();
  const iris = new Map();
  for (let y = EYE_ROWS[0]; y <= EYE_ROWS[1]; y += 1) {
    const row = [];
    for (let x = x0; x <= x1; x += 1) if (EYE_CHARS.includes(g[y][x])) { mask.set(`${x},${y}`, [x, y]); row.push(x); }
    // The iris starts at the first ring or iris pixel after the white; with no white, at the first one.
    const firstWhite = row.findIndex((x) => 'rW'.includes(g[y][x]));
    let start = firstWhite >= 0 ? row.find((x, i) => i > firstWhite && 'OIi'.includes(g[y][x])) : undefined;
    if (start === undefined) start = row.find((x) => 'OIi'.includes(g[y][x]));
    for (const x of row) if (start !== undefined && x >= start) iris.set(`${x},${y}`, g[y][x]);
  }
  return { mask, iris };
}

/** The sparkle smaller or bigger: the drawn star, found in the iris, redrawn about its middle. */
function sparkled(iris, size) {
  if (size !== 'small' && size !== 'big') return iris;
  const out = new Map(iris);
  const stars = [...iris].filter(([, c]) => c === 'W').map(([k]) => k.split(',').map(Number));
  if (!stars.length) return out;
  const cx = Math.round(stars.reduce((s, [x]) => s + x, 0) / stars.length);
  const ys = stars.map(([, y]) => y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  for (const [x, y] of stars) out.set(`${x},${y}`, y <= 59 ? 'I' : 'i');
  const set = (x, y) => { const k = `${x},${y}`; if (out.has(k) && out.get(k) !== 'O') out.set(k, 'W'); };
  if (size === 'small') { set(cx, top + 1); set(cx, top + 2); return out; }
  // Big: the cross a pixel longer each way, and a glint off its corner.
  for (let y = top - 1; y <= bottom + 1; y += 1) set(cx, y);
  for (const y of [top + 1, top + 2]) for (let x = cx - 2; x <= cx + 2; x += 1) set(x, y);
  set(cx - 2, bottom + 2);
  return out;
}

function lookAt(g, look, sparkle) {
  const [dx, dy] = AVATAR_LOOKS[look] || [0, 0];
  const out = g.map((r) => r.slice());
  for (const box of EYE_BOXES) {
    const { mask, iris } = eyeParts(g, box);
    const moved = sparkled(iris, sparkle);
    for (const [x, y] of mask.values()) {
      const src = `${x - dx},${y - dy}`;
      out[y][x] = moved.has(src) ? moved.get(src) : (y <= 59 ? 'r' : 'W');
    }
    // The far edge of the eye keeps its dark line, wherever the iris has gone.
    for (let y = EYE_ROWS[0]; y <= EYE_ROWS[1]; y += 1) {
      const xs = [...mask.values()].filter(([, yy]) => yy === y).map(([x]) => x);
      if (!xs.length) continue;
      const far = Math.max(...xs);
      if (g[y][far] === 'O') out[y][far] = 'O';
      if (y === EYE_ROWS[1] && dy === 0) for (const x of xs) if (g[y][x] === 'O') out[y][x] = 'O';
    }
  }
  return out;
}

/**
 * Halfway shut: the lid down to the middle of the eye, and the lashes above
 * it gone with it — above the frame on the original, and on down to where
 * the frame used to cross the eye on an outfit with round glasses (lashesTo).
 */
function halfShut(g, lashesTo = 53) {
  const out = g.map((r) => r.slice());
  for (const box of EYE_BOXES) {
    const { mask } = eyeParts(g, box);
    for (const [x, y] of mask.values()) {
      if (y < 60) out[y][x] = 'P';
      else if (y === 60) out[y][x] = 'O';
    }
    for (let y = 49; y <= lashesTo; y += 1) for (let x = box.x0 + 1; x <= box.x1 - 1; x += 1) if ('Or'.includes(out[y][x])) out[y][x] = 'P';
  }
  return out;
}

/**
 * The nose bubble of the fast-asleep face at one of its sizes (1 the
 * smallest; 0 or anything else, none), as paths by part like avatarPaths.
 * It is drawn over the finished face rather than into the grid, so the face
 * shows through its see-through inside.
 */
export function avatarBubblePaths(size) {
  const frame = AVATAR_BUBBLE[size - 1];
  if (!frame) return {};
  const grid = Array.from({ length: 100 }, () => Array(100).fill('.'));
  frame.rows.forEach((row, dy) => [...row].forEach((c, dx) => { if (c !== '.') grid[frame.at[1] + dy][frame.at[0] + dx] = c; }));
  return avatarPaths(grid.map((r) => r.join('')));
}

// ------------------------------------------------------- breathing and turning

/*
  Awake and quiet, the avatar was a still picture with eyes that changed now
  and then: nothing but the eyes ever moved unless it was talking, shouting or
  fast asleep. It now breathes, and its head turns a little with its glances.

  Both move whole pixels of the drawing, never fractions of one, so the art
  stays exactly the art at any size; and they move the head and the body
  apart, split where every outfit's head meets its body.
*/

/** The last row of the head. The same on every outfit: every face paints above it. */
export const AVATAR_HEAD_LAST_ROW = 76;

/**
 * What an outfit carries rather than wears — Link's sword, its fittings,
 * strap and shield. Always part of the body, even where it reaches up past
 * the head's last row over the shoulder, and drawn in front of the head,
 * as the sword is in front of the cap.
 */
export const AVATAR_CARRIED = ['espada', 'espada-sombra', 'espada-brillo', 'plata', 'plata-sombra', 'oro', 'oro-sombra', 'correa', 'correa-sombra', 'escudo-rojo'];

/**
 * A grid split three ways, each still 100 rows (the body two more): the head,
 * the body, and what the body carries. Every cell is in exactly one of them.
 * The body's last row is repeated below the drawing, out of sight until it
 * rises, so rising never opens a gap at the bottom edge.
 */
export function avatarSplit(grid) {
  const carried = new Set(AVATAR_CARRIED.map((id) => AVATAR_PARTS.find((p) => p.id === id)?.char).filter(Boolean));
  const empty = '.'.repeat(100);
  const head = []; const body = []; const held = [];
  grid.forEach((row, y) => {
    let h = ''; let b = ''; let c = '';
    for (const ch of row) {
      const isCarried = carried.has(ch);
      h += !isCarried && y <= AVATAR_HEAD_LAST_ROW ? ch : '.';
      b += !isCarried && y > AVATAR_HEAD_LAST_ROW ? ch : '.';
      c += isCarried ? ch : '.';
    }
    head.push(h); body.push(b); held.push(c);
  });
  body.push(body[99] || empty, body[99] || empty);
  held.push(held[99] || empty, held[99] || empty);
  return { head, body, carried: held };
}

/**
 * One breath, as a list of [shoulders up, head up, how long] in whole pixels:
 * the shoulders rise and the head follows a beat after, holds, then settles
 * first and the shoulders follow it down. The head is never higher than the
 * shoulders — risen alone it would open a gap at the neck — so the head leads
 * on the way down as the shoulders led on the way up.
 *
 * Lengths are [shortest, longest] and picked afresh each breath, so it
 * breathes rather than ticks. Dozing, every length is DOZING_BREATH times.
 */
export const AVATAR_BREATH = [
  [0, 0, [1600, 2200]],
  [1, 0, [150, 190]],
  [1, 1, [1300, 1700]],
  [1, 0, [150, 190]],
];
export const AVATAR_DOZING_BREATH = 1.6;

/** How long after the eyes glance the head follows them, in ms. */
export const AVATAR_HEAD_FOLLOW_MS = 110;

/**
 * Which way the head leans for a look, in whole pixels: a pixel toward
 * wherever the eyes have gone left, and a nod for a look down. Never up: a
 * head lifted off its shoulders opens a gap at the neck, so looking up is
 * left to the eyes.
 */
export function avatarHeadTurn(look) {
  const [dx, dy] = AVATAR_LOOKS[look] || [0, 0];
  return { x: dx <= -2 ? -1 : 0, y: dy > 0 ? 1 : 0 };
}

// ------------------------------------------------------------------ dizzy

/*
  Dizzy was a face and nothing else: spirals for eyes on a body that stood
  perfectly still, where asleep it sways. Now the whole of it shows it.

  The figure teeters from its feet, like the sleeping sway but side to side
  and uneven — further one way than the other, as something losing its
  balance does. The head lolls after it in whole pixels, a beat behind, so
  the two are one wobble rather than two motions arguing. And when it comes
  to, it shakes its head clear before it settles.
*/

/**
 * One rock of the teeter, in ms. Exactly half of a pile-up's dizzy spell
 * (AVATAR_OVERWHELM.dizzyMs), so the spell is two whole rocks and ends
 * upright rather than stopping mid-lean.
 */
export const AVATAR_DIZZY_ROCK_MS = 1500;

/**
 * Where the head is through one rock, as [from ms, [right, down]] in whole
 * pixels. The body leans furthest right at 30% of the rock and left at 80%
 * (see simonsaysAvatarTeeter); the head gets there about 150 ms after it,
 * dipping a pixel at the far right lean and not at the smaller left one.
 * Never up: a head lifted off the shoulders opens a gap at the neck.
 */
export const AVATAR_DIZZY_LOLL = [
  [0, [0, 0]],
  [300, [1, 0]],
  [600, [1, 1]],
  [800, [1, 0]],
  [975, [0, 0]],
  [1150, [-1, 0]],
  [1450, [0, 0]],
];

/** Coming to: the head shaken clear, a pixel each way twice, then still. [from ms, [right, down]]. */
export const AVATAR_SHAKE_OFF = [
  [0, [-1, 0]],
  [70, [1, 0]],
  [140, [-1, 0]],
  [210, [1, 0]],
  [280, [0, 0]],
];

/** Where the head is `ms` into a rock of the loll. */
export function avatarLollAt(ms) {
  const t = ((ms % AVATAR_DIZZY_ROCK_MS) + AVATAR_DIZZY_ROCK_MS) % AVATAR_DIZZY_ROCK_MS;
  let pose = AVATAR_DIZZY_LOLL[0][1];
  for (const [from, at] of AVATAR_DIZZY_LOLL) if (from <= t) pose = at;
  return pose;
}

// ------------------------------------------------------------------- hats

/**
 * How many rows above the grid are kept in view, so a hat that rises past
 * the drawing's top is not cut off: the tallest hat's reach, and a row more
 * for the head rising as it breathes.
 */
export const AVATAR_HEADROOM = Math.ceil(Math.max(0, ...Object.values(AVATAR_HAT_ART).map((h) => -h.y))) + 1;

/**
 * The drawn hat being worn, if any: the last hat asked for, as on the grid,
 * and none on an outfit with headwear of its own.
 */
export function avatarHatWorn(extras = [], costume = '') {
  if (AVATAR_COSTUMES[costume]?.headwear) return null;
  const hat = (extras || []).filter((e) => AVATAR_HATS.includes(e)).pop();
  return hat && AVATAR_HAT_ART[hat] ? hat : null;
}

/**
 * A drawn hat as one path per colour, in the avatar's grid units: each run of
 * a colour along one of its rows is a rectangle its own pixels tall. Edges
 * are worked out once and shared, so two neighbouring pixels meet on exactly
 * the same line and nothing shows between them.
 */
export function avatarHatPaths(id) {
  const hat = AVATAR_HAT_ART[id];
  if (!hat) return {};
  const edge = (start, n) => Array.from({ length: n + 1 }, (_, k) => +(start + k * hat.size).toFixed(3));
  const xs = edge(hat.x, hat.rows[0].length);
  const ys = edge(hat.y, hat.rows.length);
  const paths = {};
  hat.rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const c = row[i];
      let end = i;
      while (end + 1 < row.length && row[end + 1] === c) end += 1;
      if (c !== '.') {
        const fill = hat.palette[c.charCodeAt(0) - 97];
        paths[fill] = (paths[fill] || '') + `M${xs[i]} ${ys[j]}H${xs[end + 1]}V${ys[j + 1]}H${xs[i]}Z`;
      }
      i = end + 1;
    }
  });
  return paths;
}

/**
 * The parts drawn over a hat rather than under it: the marks that float by
 * the head — the sleepy z's, the startle's "!", the anger mark, sweat and
 * tears — which a tall hat would otherwise swallow.
 */
export const AVATAR_OVER_HAT = ['sueno', 'susto', 'vena', 'lagrima', 'lagrima-sombra'];

/**
 * One path per part: each run of a colour along a row is a rectangle, the
 * same way the original was written.
 */
export function avatarPaths(grid) {
  const paths = {};
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let end = x;
      while (end + 1 < row.length && row[end + 1] === c) end += 1;
      const part = BY_CHAR[c];
      if (part) {
        const w = end - x + 1;
        paths[part.id] = (paths[part.id] || '') + `M${x} ${y}h${w}v1h-${w}z`;
      }
      x = end + 1;
    }
  });
  return paths;
}

// ------------------------------------------------------------------ colours

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function hexToHsl(hex) {
  const n = Number.parseInt(String(hex).replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(String(v || ''));
const ORIGINAL = Object.fromEntries(AVATAR_PARTS.map((p) => [p.id, p.color]));

/*
  Which parts take a colour is the character's own, beside its art
  (AVATAR_COLOURING in shared/avatar-art.js): the main part, which becomes
  the colour exactly; the rest that follow it; the eyes among them; and a
  suit of two colours, if it has one. Every other part stays as drawn.
*/
const { main: MAIN, coloured: COLOURED, eyes: EYES, suit: SUIT } = AVATAR_COLOURING;
export const AVATAR_COLOURED = COLOURED;

/**
 * How much of a colour's vividness the eyes take, from none to all of it.
 *
 * All of it was a glare. The main part was drawn a muted colour, so every
 * part scales its vividness by how much more vivid the new colour is than
 * that — three times over for the layout's pink — and the irises went to
 * full saturation for nearly every colour there is. Clothes can carry that;
 * an eye looks lit from inside.
 */
export const AVATAR_EYE_VIVIDNESS = 0.65;

/**
 * How bright a colour looks, from 0 to 1: its relative luminance, which
 * weighs green far above red and red far above blue, the way an eye does.
 * Lightness does not — a yellow and a blue of the same lightness are nothing
 * like as bright as each other, which is why the yellow eyes glowed and the
 * blue ones did not.
 */
export function avatarLuminance(hex) {
  const n = Number.parseInt(String(hex).replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * How much of the extra brightness a colour gives the eyes they keep, over
 * the eyes as drawn: none would hold every colour to the drawing's own, all
 * of it would dim nothing.
 *
 * None was tried first, and it is wrong for exactly the colours that needed
 * it most. A yellow as dark as the drawn purple eyes is no longer yellow at
 * all but olive, and an orange that dark is brown — they stopped matching
 * the colour they were meant to be. Half keeps every colour recognisably
 * itself and still takes the glare out of it.
 */
export const AVATAR_EYE_BRIGHTNESS = 0.5;

/** The same hue and vividness at whatever lightness looks as bright as `target`, short of pure white. */
function atBrightness([h, s], target) {
  let lo = 0; let hi = 0.96;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (avatarLuminance(hslToHex([h, s, mid])) > target) hi = mid; else lo = mid;
  }
  return hslToHex([h, s, lo]);
}

/** The same hue and vividness, darkened only as far as it takes to look no brighter than `most`. */
function noBrighterThan([h, s, l], most) {
  if (avatarLuminance(hslToHex([h, s, l])) <= most) return hslToHex([h, s, l]);
  let lo = 0; let hi = l;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (avatarLuminance(hslToHex([h, s, mid])) > most) hi = mid; else lo = mid;
  }
  return hslToHex([h, s, lo]);
}

/**
 * The drawing in one colour. The main part becomes that colour exactly, and
 * every other coloured part keeps how much lighter, darker and more or less
 * vivid than the main part it was drawn, so the shading is the artist's.
 *
 * Except the eyes. They take the colour's hue, so they still match it, but
 * only part of its vividness, and only half of whatever brightness it would
 * add over the eyes as drawn. Measured before this: the layout's pink gave
 * irises 38% brighter than the drawing's, orange more than twice, green four
 * times and yellow six. A colour that was never brighter than the drawing —
 * blue, purple — keeps the brightness it had: this only ever dims.
 *
 * And a suit's body, which keeps its brightness against the suit's armour
 * rather than against the main part: each body tone looks as many times
 * brighter than the armour as it was drawn, so a suit of two colours stays
 * two colours in any one.
 */
export function avatarInColour(hex) {
  if (!isHex(hex)) return {};
  const [h, s, l] = hexToHsl(hex);
  const [, s0, l0] = hexToHsl(ORIGINAL[MAIN]);
  const out = {};
  for (const id of AVATAR_COLOURED) {
    const [, sp, lp] = hexToHsl(ORIGINAL[id]);
    const vividness = clamp(sp * (s / s0), 0, 1);
    if (EYES.includes(id)) {
      // Their own lightness to start from, or a white main part would give white eyes.
      const eye = [h, vividness * AVATAR_EYE_VIVIDNESS, lp];
      const drawn = avatarLuminance(ORIGINAL[id]);
      const would = avatarLuminance(hslToHex(eye));
      out[id] = noBrighterThan(eye, would > drawn ? drawn + (would - drawn) * AVATAR_EYE_BRIGHTNESS : would);
      continue;
    }
    const lightness = clamp(lp + (l - l0), 0.04, 0.97);
    out[id] = id === MAIN ? hex.toLowerCase() : hslToHex([h, vividness, lightness]);
  }
  if (SUIT) {
    const armour = avatarLuminance(out[SUIT.armour]);
    for (const id of SUIT.body) {
      const drawn = avatarLuminance(ORIGINAL[id]) / avatarLuminance(ORIGINAL[SUIT.armour]);
      out[id] = atBrightness(hexToHsl(out[id]), armour * drawn);
    }
  }
  return out;
}

/** Every colour as a shade of green, by how light it is: through night vision. */
export function avatarNightVision() {
  const dark = [4, 26, 6]; const light = [178, 255, 166];
  const out = {};
  for (const p of AVATAR_PARTS) {
    const n = Number.parseInt(p.color.slice(1), 16);
    const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    const t = lum ** 0.85;
    out[p.id] = `#${dark.map((d, i) => Math.round(d + (light[i] - d) * t).toString(16).padStart(2, '0')).join('')}`;
  }
  return out;
}

/** The colours a layer can dress it in. Crewmate colours are the players list's. */
export const AVATAR_COLOURINGS = ['original', 'layout', 'own', 'night-vision', ...Object.keys(PLAYER_COLOURS).filter((c) => c !== 'grey')];

/**
 * What each part is to be painted, as the parts that differ from the
 * drawing. "layout" follows the layout's accent, and is the drawing as it
 * was when the layout has none; "own" is the colour given.
 */
export function avatarColours(colouring = 'original', { accent, own } = {}) {
  if (colouring === 'layout') return avatarInColour(accent);
  if (colouring === 'own') return avatarInColour(own);
  if (colouring === 'night-vision') return avatarNightVision();
  if (PLAYER_COLOURS[colouring]) return avatarInColour(PLAYER_COLOURS[colouring]);
  return {};
}

/** The avatar as an SVG file, one path per part, each named after its part. */
export function avatarSvg({ expression = 'neutral', extras = [], colours = {}, size = 1024, costume = '' } = {}) {
  const paths = avatarPaths(avatarGrid(expression, extras, costume));
  const part = (p) => `  <path id="${p.id}" fill="${colours[p.id] || p.color}"${p.opacity ? ` fill-opacity="${p.opacity}"` : ''} d="${paths[p.id]}"/>`;
  // The drawn hat, between the head and the marks that float over it, with room above for one that rises past the top.
  const hat = avatarHatWorn(extras, costume);
  const hatPaths = hat ? Object.entries(avatarHatPaths(hat)).map(([fill, d]) => `  <path class="hat" fill="${fill}" d="${d}"/>`) : [];
  const body = [
    ...AVATAR_PARTS.filter((p) => paths[p.id] && !AVATAR_OVER_HAT.includes(p.id)).map(part),
    ...hatPaths,
    ...AVATAR_PARTS.filter((p) => paths[p.id] && AVATAR_OVER_HAT.includes(p.id)).map(part),
  ].join('\n');
  const above = hat && AVATAR_HAT_ART[hat].y < 0 ? AVATAR_HEADROOM : 0;
  const title = [costume, [].concat(expression).join(' + '), ...extras].filter(Boolean).join(' + ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-above} 100 ${100 + above}" width="${size}" height="${Math.round((size * (100 + above)) / 100)}" shape-rendering="crispEdges">\n  <title>Avatar pixel art — ${title}</title>\n${body}\n</svg>\n`;
}

// ------------------------------------------------------------- on a layer

/** The alerts an avatar layer can react to, by what they are rather than where from. */
export const AVATAR_REACTIONS = ['follow', 'sub', 'gift', 'cheer', 'raid', 'hype'];

/** What each is met with, out of the box. */
export const AVATAR_REACTION_DEFAULTS = { follow: 'heart-eyes', sub: 'heart-eyes', gift: 'star-eyes', cheer: 'surprised', raid: 'star-eyes', hype: 'star-eyes' };

/** How long it cheers a Hype Train on, as it starts and at each level up, in ms. */
export const AVATAR_HYPE_MS = 4000;

/** Which reaction an alert is: twitch_sub and youtube_sub are both a sub. */
export function avatarReactionFor(alertType) {
  const kind = String(alertType || '').replace(/^(twitch|youtube|tiktok|kick)_/, '');
  if (kind === 'sub_gift_bulk') return 'gift';
  return AVATAR_REACTIONS.includes(kind) ? kind : null;
}

/** How long the mic can be quiet before the avatar dozes off, in minutes; 0 is never. */
export const AVATAR_SLEEP_AFTER = [0, 1, 2, 3, 5, 10];

/** Quiet this many times as long as it takes to doze off, and it is fast asleep. */
export const AVATAR_DEEP_SLEEP_AFTER = 2;

/**
 * How asleep it is after being quiet so long, dozing off after `minutes`:
 * awake, dozing (sleepy), or deep (fast asleep) at twice that. 0 minutes is
 * never.
 */
export function avatarSleepState(quietMs, minutes) {
  if (!minutes) return 'awake';
  const dozeMs = minutes * 60000;
  if (quietMs >= dozeMs * AVATAR_DEEP_SLEEP_AFTER) return 'deep';
  return quietMs >= dozeMs ? 'dozing' : 'awake';
}

/** One slow breath while fast asleep, and the nose bubble through it, a frame a step (0 is none). */
export const AVATAR_BREATH_MS = 4000;
export const AVATAR_BUBBLE_BREATH = [0, 1, 2, 3, 4, 4, 3, 2];

/**
 * The resting face: sleepy when it has dozed off or was set to sleep (a BRB
 * screen), fast asleep when it has slept on twice as long or was set to,
 * but never while talking — talking wakes it.
 */
export function avatarRestingFace(expression = 'neutral', { asleep = false, deep = false, speaking = false } = {}) {
  const setAsleep = expression === 'sleepy' || expression === 'deep-sleep';
  if (!setAsleep && !asleep && !deep) return expression;
  if (speaking) return setAsleep ? 'neutral' : expression;
  return deep || expression === 'deep-sleep' ? 'deep-sleep' : 'sleepy';
}

/** How long it stays startled when something wakes it, before it shows what did. */
export const AVATAR_STARTLE_MS = 900;

/** The faces it sleeps with: something landing on one of these startles it awake. */
export const AVATAR_SLEEP_FACES = ['sleepy', 'deep-sleep'];

/** Faces a blink would spoil: eyes already shut, or eyes that are something else. */
const EYES_SHUT = ['blink', 'happy', 'wink', 'star-eyes', 'heart-eyes', 'dizzy', 'deep-sleep'];

/**
 * The faces to draw now, one over the next: the layer's own, or the one an
 * alert brought; the mouth open while talking, as wide as the voice is loud
 * (soft, normal or loud); and a blink, if the eyes are open to blink.
 */
export function avatarFacesNow({ expression = 'neutral', reaction = null, mouthOpen = false, blinking = false, voice = 'normal' } = {}) {
  const face = reaction || expression;
  const faces = [face];
  if (mouthOpen) faces.push(voice === 'soft' ? 'talking-soft' : voice === 'loud' ? 'talking-loud' : 'talking');
  if (blinking && !EYES_SHUT.includes(face)) faces.push('blink');
  return faces;
}

// --------------------------------------------------------------- regulars

/** Drawings of people of their own, for the call, in the order they are listed (shared/avatar-regulars.js). */
export const AVATAR_REGULARS_LIST = Object.keys(AVATAR_REGULARS);

/** Whether the faces drawn now have the mouth open: talking, softly or loudly. */
export const avatarMouthOpen = (faces = []) => [].concat(faces).some((f) => /^talking/.test(f));

/** How far a regular's eyes are shut: open, half on the way into or out of a blink, or shut. */
export const AVATAR_REGULAR_LIDS = ['open', 'half', 'shut'];

/** What a regular is doing now: `true` alone is talking, as it once was the only thing it could do. */
const regularNow = (now) => (typeof now === 'object' && now ? now : { talking: Boolean(now) });

/**
 * Which way a regular can face: your left, as its drawing was first given;
 * the front, if it has a front view; and your right, that drawing mirrored.
 */
export const AVATAR_REGULAR_FACINGS = ['left', 'front', 'right'];

/** Whether a regular turns: it needs a front view to turn through. */
export const avatarRegularTurns = (id) => Boolean(AVATAR_REGULARS[id]?.front);

/**
 * Turning from one side to the other passes through the front, held this
 * long, in ms: a turnaround a frame at a time, as pixel art turns.
 */
export const AVATAR_TURN_STEP_MS = 100;

/**
 * How long a regular in the call keeps facing whoever talked last once they
 * stop, in ms: long enough to span the gaps between words, so it does not
 * turn away and back at every one.
 */
export const AVATAR_TURN_HOLD_MS = 2500;

/**
 * Which way somebody in tile `mine` faces to look at tile `theirs`, the
 * tiles laid `cols` to a row: toward it if it is in another column, and
 * nowhere in particular (null) if it is straight above or below — a drawing
 * turns left and right, not up and down.
 */
export function avatarFacingToward(mine, theirs, cols) {
  if (mine < 0 || theirs < 0 || mine === theirs || !(cols > 0)) return null;
  const across = (theirs % cols) - (mine % cols);
  return across < 0 ? 'left' : across > 0 ? 'right' : null;
}

/**
 * A regular's drawing as rows: facing your left, the front or your right;
 * mouth shut or open; eyes open, half shut or shut if it has eyelids; and two
 * rows more below repeating its last — its body runs off the bottom the way
 * the avatar's does, so rising a pixel as it breathes shows more of it,
 * never a gap.
 */
export function avatarRegularRows(id, now = {}) {
  const regular = AVATAR_REGULARS[id];
  if (!regular) return [];
  const { talking = false, lid = 'open', facing = 'left' } = regularNow(now);
  // The front view has rows, mouth and lids of its own.
  const view = facing === 'front' && regular.front ? regular.front : regular;
  const rows = view.rows.map((row) => row.split(''));
  const lay = (patches) => {
    for (const { at: [x0, y0], rows: patch } of patches || []) {
      patch.forEach((row, dy) => [...row].forEach((c, dx) => {
        if (c !== '.') rows[y0 + dy][x0 + dx] = c === '_' ? '.' : c;
      }));
    }
  };
  if (talking && view.talking) lay([view.talking]);
  if (lid !== 'open') lay(view.blink?.[lid]);
  let out = rows.map((row) => row.join(''));
  // Facing your right: mirrored, with its writing copied back the right way round.
  if (facing === 'right' && regular.front) {
    const mirrored = out.map((row) => [...row].reverse());
    for (const [x0, y0, x1, y1] of regular.mirrorKeep || []) {
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) mirrored[y][99 - x1 + (x - x0)] = out[y][x];
    }
    out = mirrored.map((row) => row.join(''));
  }
  return [...out, out[out.length - 1], out[out.length - 1]];
}

/** Rows as one path per colour, keyed by the colour: each run of a colour along a row a rectangle, as the avatar's parts are drawn. */
function regularPathsOf(rows, palette) {
  const paths = {};
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let end = x;
      while (end + 1 < row.length && row[end + 1] === c) end += 1;
      if (c !== '.') {
        const fill = palette[c.charCodeAt(0) - 97];
        paths[fill] = (paths[fill] || '') + `M${x} ${y}h${end - x + 1}v1h${-(end - x + 1)}z`;
      }
      x = end + 1;
    }
  });
  return paths;
}

/** A regular's drawing, whole, as one path per colour. */
export function avatarRegularPaths(id, now = {}) {
  const regular = AVATAR_REGULARS[id];
  return regular ? regularPathsOf(avatarRegularRows(id, now), regular.palette) : {};
}

/**
 * A regular's drawing in the two parts it breathes in, as the avatar's head
 * and body: the rows down to its `breathSplit`, and the rows below, which
 * rise first. Every pixel is in one of them; one without a split is all head.
 */
export function avatarRegularParts(id, now = {}) {
  const regular = AVATAR_REGULARS[id];
  if (!regular) return { head: {}, body: {} };
  const rows = avatarRegularRows(id, now);
  const facingFront = regularNow(now).facing === 'front' && regular.front;
  const split = (facingFront ? regular.front.breathSplit : regular.breathSplit) ?? rows.length;
  const blank = '.'.repeat(100);
  return {
    head: regularPathsOf(rows.map((row, y) => (y <= split ? row : blank)), regular.palette),
    body: regularPathsOf(rows.map((row, y) => (y > split ? row : blank)), regular.palette),
  };
}

// ------------------------------------------------------------ in the call

/**
 * How somebody in the Discord call is drawn, as the Voice call screen keeps
 * it: a regular's own drawing, or the pixel avatar with the choices an
 * avatar layer has — its colour (the same `colouring` and `ownColour`), an
 * outfit and a hat. Whatever is unknown is left out, so an empty look is
 * the avatar in the layout's colour, in the outfit it was drawn in, bareheaded: how
 * everybody drawn as the avatar looked before there was a choice.
 */
export function avatarCallLook(raw) {
  if (!raw || typeof raw !== 'object') return {};
  // Their own drawing has its own colours, clothes and head: nothing else applies.
  if (AVATAR_REGULARS[raw.drawing]) return { drawing: raw.drawing };
  const out = {};
  if (AVATAR_COLOURINGS.includes(raw.colouring) && raw.colouring !== 'layout') out.colouring = raw.colouring;
  if (isHex(raw.ownColour)) out.ownColour = String(raw.ownColour).toLowerCase();
  if (AVATAR_COSTUMES[raw.costume]) out.costume = raw.costume;
  if (AVATAR_HATS.includes(raw.hat) && !AVATAR_COSTUMES[out.costume]?.headwear) out.hat = raw.hat;
  return out;
}

/** What the living avatar is given to draw somebody in the call, their look worked out against the layout's accent. */
export function avatarCallProps(look = {}, accent) {
  if (AVATAR_REGULARS[look.drawing]) return { drawing: look.drawing, costume: '', extras: [], colours: {} };
  return {
    drawing: '',
    costume: look.costume || '',
    extras: look.hat ? [look.hat] : [],
    colours: avatarColours(look.colouring || 'layout', { accent, own: look.ownColour }),
  };
}
