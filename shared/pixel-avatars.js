/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Pixel avatars made in the app: the same kind of drawing as the built-in
 * avatar — a grid of parts, with faces, extras, outfits, drawn hats and
 * things it does a frame at a time laid over it as patches — but held as
 * data, one object an avatar, so a new one can be drawn in the Pixel avatars
 * tab rather than in code.
 *
 * The built-in avatar is not drawn by this. It keeps its own code and art
 * (shared/avatar.js and the files beside it), untouched by anything here, so
 * nothing done in the tab can change it. The examples are the built-in ones
 * converted to this format (shared/pixel-avatar-examples.js), and a test
 * holds that this draws them exactly as shared/avatar.js draws the
 * originals: the same pixels, the same colours, for every face, outfit, hat
 * and frame.
 *
 * An avatar, as stored:
 *
 *   id, name            its own, and what the tab calls it
 *   parts               every colour in it: { id, char, color, name } and,
 *                       optionally, opacity and effect ('float' drifts like
 *                       sleep z's, 'pop' pops up like a startle's "!")
 *   base                the drawing, 100 strings of 100 characters, one a
 *                       pixel: a part's char, or '.' for none
 *   baseLabel           what the outfit it was drawn in is called
 *   faces               [{ name, label, patches, glances, blinks }]: laid
 *                       over the drawing, one over the next. glances: the
 *                       eyes may look about in it; blinks: a blink may go
 *                       over it (false where the eyes are shut or something
 *                       else already)
 *   extras              [{ name, label, patches, hat, art?, words? }]: laid
 *                       over whatever face shows, in this order. One hat at
 *                       a time; a hat with art is a picture of its own over
 *                       the head (see hatPaths), its patches what it hides
 *   outfits             [{ name, label, rows, headwear, ownFace?, lashesTo?, words? }]:
 *                       the whole drawing redrawn. headwear wears no other
 *                       hat; ownFace is a face of its own (its own glasses)
 *   actions             [{ name, label, words, outfits: { [outfit]: frames } }]:
 *                       frames { ms, eyes?: 'shut', patches }, '' the base
 *                       outfit; an outfit with none does not do it
 *   split               { headLastRow, carried, follow }: where the head
 *                       ends, for breathing; parts carried rather than worn
 *                       (always with the body, in front of the head); and
 *                       whether the head follows the eyes
 *   overHat             parts drawn over a hat rather than under it
 *   eyes                null, or how its resting eyes are found, so they can
 *                       glance, half-shut and twinkle by themselves (EYES)
 *   colouring           null, or which parts take a colour (see colours)
 *   bubble              the fast-asleep nose bubble, a patch a size
 *   turn                null, or a front view and what stays unmirrored,
 *                       for a drawing that turns to face whoever talks.
 *                       The front view is { base, faces, headLastRow,
 *                       outfits, extras }: its own drawing and faces, and
 *                       the outfits and extras as they look from the front
 *                       — outfits [{ name, rows }] redrawn whole, extras
 *                       [{ name, patches }] over it, by the names of the
 *                       ones above. One with no front version of its own
 *                       is not shown from the front.
 *   drawnFacing         which way the drawing faces as drawn: 'left' or 'right'
 *
 * A patch is { at: [x, y], rows }: placed at its top-left corner, '.' leaves
 * a pixel as it was, '_' clears it, anything else paints that part.
 */

import { PLAYER_COLOURS } from './players.js';
import { hexToHsl, hslToHex, avatarLuminance, AVATAR_EYE_VIVIDNESS, AVATAR_EYE_BRIGHTNESS, AVATAR_LOOKS, avatarCallLook } from './avatar.js';

export const PIXEL_SIZE = 100;
export const PIXEL_AVATAR_VERSION = 1;

/** The colours any avatar can be put in: as drawn, the layout's, your own, night vision, or a crewmate's. */
export const PIXEL_COLOURINGS = ['original', 'layout', 'own', 'night-vision', ...Object.keys(PLAYER_COLOURS).filter((c) => c !== 'grey')];

/**
 * The faces the living avatar reaches for by name, and what each is for.
 * An avatar without one of them simply does not do that thing: no blink
 * face, no blinking.
 */
export const PIXEL_SPECIAL_FACES = ['blink', 'blink-half', 'talking', 'talking-soft', 'talking-loud', 'startled', 'sleepy', 'deep-sleep', 'dizzy'];

/*
  Looked up rather than searched: an avatar's faces, extras, outfits and
  actions by name, and its parts by char and id, worked out once per avatar
  object. Avatars are replaced rather than changed in place, so a new object
  is a new avatar and the old one's tables go with it.
*/
const TABLES = new WeakMap();
function tables(pa) {
  let t = TABLES.get(pa);
  if (t) return t;
  const byName = (list) => Object.fromEntries((list || []).map((x) => [x.name, x]));
  t = {
    byChar: Object.fromEntries((pa.parts || []).map((p) => [p.char, p])),
    byId: Object.fromEntries((pa.parts || []).map((p) => [p.id, p])),
    faces: byName(pa.faces),
    extras: byName(pa.extras),
    outfits: byName(pa.outfits),
    actions: byName(pa.actions),
    frontFaces: byName(pa.turn?.front?.faces),
    frontOutfits: byName(pa.turn?.front?.outfits),
    frontExtras: byName(pa.turn?.front?.extras),
  };
  TABLES.set(pa, t);
  return t;
}

const isHat = (pa, name) => Boolean(tables(pa).extras[name]?.hat);

/** Its hats, in order: the extras that are worn on the head, one at a time. */
export const pixelHats = (pa) => (pa?.extras || []).filter((e) => e.hat).map((e) => e.name);

/** An outfit by name, or null for the one it was drawn in (''). */
export const pixelOutfit = (pa, name) => (name ? tables(pa).outfits[name] || null : null);

/**
 * Whether a face is one it has: its own faces, neutral (the drawing itself),
 * and the softer and louder talking, which fall back to talking.
 */
export function pixelHasFace(pa, name) {
  if (!pa) return false;
  if (name === 'neutral') return true;
  return Boolean(tables(pa).faces[name]);
}

// ------------------------------------------------------------------ the grid

/** The face actually laid for a name: talking softly or loudly is plain talking on an avatar without them. */
function faceFor(t, name) {
  if (t.faces[name]) return t.faces[name];
  if (name === 'talking-soft' || name === 'talking-loud') return t.faces.talking || null;
  return null;
}

/**
 * The grid for a face and whatever it is wearing, as 100 strings of 100
 * characters: what shared/avatar.js's avatarGrid is for the built-in one,
 * for any avatar.
 *
 * Several faces are laid one over the next. An outfit is the whole drawing
 * redrawn, under all of that; on one, a face paints only what it changes
 * from the drawing as drawn, and where it keeps it the outfit stays. One
 * with a face of its own lays its own eyes inside that face instead, and its
 * glasses over them. The resting eyes can look elsewhere, twinkle or
 * half-shut (eyes); a frame of something it does goes over everything, last.
 *
 * Facing (an avatar that turns): its front view, or its drawing mirrored to
 * face the other way, with what is kept unmirrored copied back. From the
 * front, an outfit and the extras are their front versions, where they
 * have them; what it does is drawn from the side only.
 */
export function pixelGrid(pa, { faces = ['neutral'], extras = [], outfit = '', eyes = {}, action = null, facing = null } = {}) {
  if (!pa?.base) return [];
  const t = tables(pa);
  const front = facing === 'front' && pa.turn?.front ? pa.turn.front : null;
  const out = pixelOutfit(pa, outfit);
  // The drawing faces go over, and that drawing redrawn as the outfit: from the side, or from the front.
  const drawn = front ? front.base : pa.base;
  const dressed = front ? (out && t.frontOutfits[out.name]?.rows) || null : out?.rows || null;
  const own = front ? null : out?.ownFace;
  const grid = (dressed || drawn).map((row) => row.split(''));
  const inOwnFace = (x, y) => own && x >= own.region[0] && x <= own.region[2] && y >= own.region[1] && y <= own.region[3];
  const lay = (patches, original = false) => {
    for (const { at: [x0, y0], rows } of patches || []) {
      rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx += 1) {
          const c = row[dx];
          if (c === '.') continue;
          const y = y0 + dy; const x = x0 + dx;
          if (y < 0 || y > 99 || x < 0 || x > 99) continue;
          let paint = c === '_' ? '.' : c;
          if (original && dressed) {
            if (inOwnFace(x, y)) continue;
            if (paint === drawn[y][x]) paint = dressed[y][x];
          }
          grid[y][x] = paint;
        }
      });
    }
  };
  const list = [].concat(faces || []);
  const faceTable = front ? t.frontFaces : null;
  for (const name of list) {
    if (name === 'neutral') continue;
    const face = faceTable ? (faceTable[name] || ((name === 'talking-soft' || name === 'talking-loud') ? faceTable.talking : null)) : faceFor(t, name);
    lay(face?.patches, true);
    if (own) lay(own.faces?.[name]);
  }
  if (pa.eyes && !front && list.every((f) => f === 'neutral' || t.faces[f]?.glances)) {
    let moved = grid;
    if (eyes?.look && eyes.look !== 'right' || eyes?.sparkle && eyes.sparkle !== 'normal') moved = lookAt(pa.eyes, moved, eyes.look, eyes.sparkle);
    if (eyes?.half) moved = halfShut(pa.eyes, moved, out?.lashesTo ?? pa.eyes.lashes[1]);
    moved.forEach((row, y) => { grid[y] = row; });
  } else if (!pa.eyes && eyes?.half && !list.includes('blink')) {
    // Without eyes it can find, half-shut is a face of its own, drawn: blink-half.
    lay((faceTable || t.faces)['blink-half']?.patches);
  }
  if (own) lay(own.glasses);
  // The extras, in their own order, one hat at a time and none with headwear: from the front, as drawn from the front.
  const wanted = (extras || []).filter((e) => t.extras[e]);
  const hat = out?.headwear ? null : wanted.filter((e) => isHat(pa, e)).pop();
  for (const e of pa.extras || []) {
    if (!wanted.includes(e.name)) continue;
    if (e.hat && e.name !== hat) continue;
    lay(front ? t.frontExtras[e.name]?.patches : e.patches);
  }
  if (action && !front) lay(pixelActionFrames(pa, action.name, outfit)?.[action.frame]?.patches);
  let rows = grid.map((row) => row.join(''));
  if (pa.turn && (facing === 'left' || facing === 'right') && facing !== (pa.drawnFacing || 'left')) rows = mirrored(rows, pa.turn.mirrorKeep);
  return rows;
}

/** Facing the other way: mirrored, with whatever is kept (writing) copied back the right way round. */
function mirrored(rows, keep = []) {
  const flipped = rows.map((row) => [...row].reverse());
  for (const [x0, y0, x1, y1] of keep || []) {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) flipped[y][99 - x1 + (x - x0)] = rows[y][x];
  }
  return flipped.map((row) => row.join(''));
}

// ------------------------------------------------------------------ the eyes

/*
  The resting eyes, moving by themselves: glancing about, half-shutting on
  the way into and out of a blink, and the sparkle twinkling — worked out
  from the eyes as drawn, as the built-in avatar's are, from where they are
  and what each of their colours is:

    boxes      [[x0, x1], …]: each eye's columns
    rows       [first, last]: the rows the eyes are in
    opening    the chars that are the eye's opening (white, iris, ring)
    white      the chars of the white, after which the iris starts
    iris       the chars of the iris and its ring
    shine      the sparkle's char
    line       the dark line at the eye's far edge, which stays put
    split      the last row of the eye's upper half
    fill       what shows where the iris has moved from: [upper, lower]
    irisFill   what the sparkle is painted over with when it is redrawn: [upper, lower]
    lid, lidLine, lidRow   half shut: the lid's char down to lidRow, and its edge on it
    lashes     [from, to]: the rows of lashes that go with the lid
    lashChars  the chars of those lashes
*/

function eyeParts(E, g, [x0, x1]) {
  const mask = new Map();
  const iris = new Map();
  for (let y = E.rows[0]; y <= E.rows[1]; y += 1) {
    const row = [];
    for (let x = x0; x <= x1; x += 1) if (E.opening.includes(g[y][x])) { mask.set(`${x},${y}`, [x, y]); row.push(x); }
    const firstWhite = row.findIndex((x) => E.white.includes(g[y][x]));
    let start = firstWhite >= 0 ? row.find((x, i) => i > firstWhite && E.iris.includes(g[y][x])) : undefined;
    if (start === undefined) start = row.find((x) => E.iris.includes(g[y][x]));
    for (const x of row) if (start !== undefined && x >= start) iris.set(`${x},${y}`, g[y][x]);
  }
  return { mask, iris };
}

function sparkled(E, iris, size) {
  if (size !== 'small' && size !== 'big') return iris;
  const out = new Map(iris);
  const stars = [...iris].filter(([, c]) => c === E.shine).map(([k]) => k.split(',').map(Number));
  if (!stars.length) return out;
  const cx = Math.round(stars.reduce((s, [x]) => s + x, 0) / stars.length);
  const ys = stars.map(([, y]) => y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  for (const [x, y] of stars) out.set(`${x},${y}`, y <= E.split ? E.irisFill[0] : E.irisFill[1]);
  const set = (x, y) => { const k = `${x},${y}`; if (out.has(k) && out.get(k) !== E.line) out.set(k, E.shine); };
  if (size === 'small') { set(cx, top + 1); set(cx, top + 2); return out; }
  for (let y = top - 1; y <= bottom + 1; y += 1) set(cx, y);
  for (const y of [top + 1, top + 2]) for (let x = cx - 2; x <= cx + 2; x += 1) set(x, y);
  set(cx - 2, bottom + 2);
  return out;
}

function lookAt(E, g, look, sparkle) {
  const [dx, dy] = (E.looks || AVATAR_LOOKS)[look] || [0, 0];
  const out = g.map((r) => r.slice());
  for (const box of E.boxes) {
    const { mask, iris } = eyeParts(E, g, box);
    const moved = sparkled(E, iris, sparkle);
    for (const [x, y] of mask.values()) {
      const src = `${x - dx},${y - dy}`;
      out[y][x] = moved.has(src) ? moved.get(src) : (y <= E.split ? E.fill[0] : E.fill[1]);
    }
    for (let y = E.rows[0]; y <= E.rows[1]; y += 1) {
      const xs = [...mask.values()].filter(([, yy]) => yy === y).map(([x]) => x);
      if (!xs.length) continue;
      const far = Math.max(...xs);
      if (g[y][far] === E.line) out[y][far] = E.line;
      if (y === E.rows[1] && dy === 0) for (const x of xs) if (g[y][x] === E.line) out[y][x] = E.line;
    }
  }
  return out;
}

function halfShut(E, g, lashesTo) {
  const out = g.map((r) => r.slice());
  for (const box of E.boxes) {
    const { mask } = eyeParts(E, g, box);
    for (const [x, y] of mask.values()) {
      if (y < E.lidRow) out[y][x] = E.lid;
      else if (y === E.lidRow) out[y][x] = E.lidLine;
    }
    for (let y = E.lashes[0]; y <= lashesTo; y += 1) for (let x = box[0] + 1; x <= box[1] - 1; x += 1) if (E.lashChars.includes(out[y][x])) out[y][x] = E.lid;
  }
  return out;
}

/** Where its eyes can look. Right is how the built-in one was drawn. */
export const pixelLooks = (pa) => Object.keys(pa?.eyes?.looks || AVATAR_LOOKS);

// ------------------------------------------------------- breathing and turning

/**
 * A grid split three ways, as shared/avatar.js's avatarSplit: the head, the
 * body, and what the body carries, each still 100 rows (the body and what
 * it carries two more, their last row repeated, so rising never opens a gap
 * at the bottom). Every cell is in exactly one of them.
 */
export function pixelSplit(pa, grid, { facing = null } = {}) {
  const front = facing === 'front' && pa?.turn?.front;
  const last = front ? (pa.turn.front.headLastRow ?? 99) : (pa?.split?.headLastRow ?? 99);
  const t = tables(pa);
  const carried = new Set((pa?.split?.carried || []).map((id) => t.byId[id]?.char).filter(Boolean));
  const empty = '.'.repeat(PIXEL_SIZE);
  const head = []; const body = []; const held = [];
  grid.forEach((row, y) => {
    let h = ''; let b = ''; let c = '';
    for (const ch of row) {
      const isCarried = carried.has(ch);
      h += !isCarried && y <= last ? ch : '.';
      b += !isCarried && y > last ? ch : '.';
      c += isCarried ? ch : '.';
    }
    head.push(h); body.push(b); held.push(c);
  });
  body.push(body[99] || empty, body[99] || empty);
  held.push(held[99] || empty, held[99] || empty);
  return { head, body, carried: held };
}

/** Whether it turns to face whoever is talking: it needs a front view to turn through. */
export const pixelTurns = (pa) => Boolean(pa?.turn?.front);

// ------------------------------------------------------------------- drawing

/** One path per part, keyed by the part's id: each run of a colour along a row a rectangle. */
export function pixelPaths(pa, grid) {
  const { byChar } = tables(pa);
  const paths = {};
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let end = x;
      while (end + 1 < row.length && row[end + 1] === c) end += 1;
      const part = byChar[c];
      if (part) {
        const w = end - x + 1;
        paths[part.id] = (paths[part.id] || '') + `M${x} ${y}h${w}v1h-${w}z`;
      }
      x = end + 1;
    }
  });
  return paths;
}

/** The drawn hat being worn, if any: the last hat asked for, and none on an outfit with headwear of its own. */
export function pixelHatWorn(pa, extras = [], outfit = '') {
  if (pixelOutfit(pa, outfit)?.headwear) return null;
  const hat = (extras || []).filter((e) => isHat(pa, e)).pop();
  return hat && tables(pa).extras[hat]?.art ? hat : null;
}

/** A drawn hat as one path per colour, in the avatar's grid units, at its own pixel size. */
export function pixelHatPaths(pa, name) {
  const hat = tables(pa).extras[name]?.art;
  if (!hat) return {};
  const edge = (start, n) => Array.from({ length: n + 1 }, (_, k) => +(start + k * hat.size).toFixed(3));
  const xs = edge(hat.x, hat.rows[0]?.length || 0);
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
        if (fill) paths[fill] = (paths[fill] || '') + `M${xs[i]} ${ys[j]}H${xs[end + 1]}V${ys[j + 1]}H${xs[i]}Z`;
      }
      i = end + 1;
    }
  });
  return paths;
}

/** Rows kept in view above the drawing, so a hat that rises past its top is not cut off: the tallest hat's reach, and one for breathing. */
export function pixelHeadroom(pa) {
  return Math.ceil(Math.max(0, ...(pa?.extras || []).filter((e) => e.art).map((e) => -e.art.y))) + 1;
}

/** The nose bubble of the fast-asleep face at one of its sizes (1 the smallest; 0, none), as paths by part. */
export function pixelBubblePaths(pa, size) {
  const frame = pa?.bubble?.[size - 1];
  if (!frame) return {};
  const grid = Array.from({ length: PIXEL_SIZE }, () => Array(PIXEL_SIZE).fill('.'));
  frame.rows.forEach((row, dy) => [...row].forEach((c, dx) => {
    const y = frame.at[1] + dy; const x = frame.at[0] + dx;
    if (c !== '.' && y >= 0 && y < PIXEL_SIZE && x >= 0 && x < PIXEL_SIZE) grid[y][x] = c;
  }));
  return pixelPaths(pa, grid.map((r) => r.join('')));
}

// ------------------------------------------------------------------- colours

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(String(v || ''));

function atBrightness([h, s], target) {
  let lo = 0; let hi = 0.96;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (avatarLuminance(hslToHex([h, s, mid])) > target) hi = mid; else lo = mid;
  }
  return hslToHex([h, s, lo]);
}

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
 * The drawing in one colour, as the built-in avatar is put in one: the main
 * part becomes that colour exactly, every other coloured part keeps how much
 * lighter, darker and more or less vivid than it it was drawn, the eyes take
 * the hue but only part of the vividness and brightness, and a suit's body
 * keeps its brightness against its armour.
 *
 *   colouring: { main, coloured: [part ids], eyes: [part ids], suit: { armour, body: [part ids] } | null }
 */
export function pixelInColour(pa, hex) {
  const C = pa?.colouring;
  if (!isHex(hex) || !C?.main) return {};
  const ORIGINAL = Object.fromEntries(pa.parts.map((p) => [p.id, p.color]));
  if (!ORIGINAL[C.main]) return {};
  const [h, s, l] = hexToHsl(hex);
  const [, s0, l0] = hexToHsl(ORIGINAL[C.main]);
  const out = {};
  for (const id of C.coloured || []) {
    if (!ORIGINAL[id]) continue;
    const [, sp, lp] = hexToHsl(ORIGINAL[id]);
    // A grey main part has no vividness to scale by: the colour's own is taken instead.
    const vividness = clamp(s0 > 0 ? sp * (s / s0) : s, 0, 1);
    if ((C.eyes || []).includes(id)) {
      const eye = [h, vividness * AVATAR_EYE_VIVIDNESS, lp];
      const drawn = avatarLuminance(ORIGINAL[id]);
      const would = avatarLuminance(hslToHex(eye));
      out[id] = noBrighterThan(eye, would > drawn ? drawn + (would - drawn) * AVATAR_EYE_BRIGHTNESS : would);
      continue;
    }
    const lightness = clamp(lp + (l - l0), 0.04, 0.97);
    out[id] = id === C.main ? hex.toLowerCase() : hslToHex([h, vividness, lightness]);
  }
  if (C.suit?.armour && out[C.suit.armour]) {
    const armour = avatarLuminance(out[C.suit.armour]);
    for (const id of C.suit.body || []) {
      if (!out[id]) continue;
      const drawn = avatarLuminance(ORIGINAL[id]) / avatarLuminance(ORIGINAL[C.suit.armour]);
      out[id] = atBrightness(hexToHsl(out[id]), armour * drawn);
    }
  }
  return out;
}

/** Every colour as a shade of green, by how light it is: through night vision. */
export function pixelNightVision(pa) {
  const dark = [4, 26, 6]; const light = [178, 255, 166];
  const out = {};
  for (const p of pa?.parts || []) {
    const n = Number.parseInt(p.color.slice(1), 16);
    const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    const t = lum ** 0.85;
    out[p.id] = `#${dark.map((d, i) => Math.round(d + (light[i] - d) * t).toString(16).padStart(2, '0')).join('')}`;
  }
  return out;
}

/** What each part is painted, as the parts that differ from the drawing, for one of PIXEL_COLOURINGS. */
export function pixelColours(pa, colouring = 'original', { accent, own } = {}) {
  if (colouring === 'layout') return pixelInColour(pa, accent);
  if (colouring === 'own') return pixelInColour(pa, own);
  if (colouring === 'night-vision') return pixelNightVision(pa);
  if (PLAYER_COLOURS[colouring]) return pixelInColour(pa, PLAYER_COLOURS[colouring]);
  return {};
}

/** The avatar as an SVG file, one path per part, each named after its part. */
export function pixelSvg(pa, { faces = ['neutral'], extras = [], colours = {}, size = 1024, outfit = '', action = null, facing = null } = {}) {
  const paths = pixelPaths(pa, pixelGrid(pa, { faces, extras, outfit, action, facing }));
  const over = new Set(pa.overHat || []);
  const part = (p) => `  <path id="${p.id}" fill="${colours[p.id] || p.color}"${p.opacity ? ` fill-opacity="${p.opacity}"` : ''} d="${paths[p.id]}"/>`;
  const hat = facing === 'front' ? null : pixelHatWorn(pa, extras, outfit);
  const hatPaths = hat ? Object.entries(pixelHatPaths(pa, hat)).map(([fill, d]) => `  <path class="hat" fill="${fill}" d="${d}"/>`) : [];
  const body = [
    ...pa.parts.filter((p) => paths[p.id] && !over.has(p.id)).map(part),
    ...hatPaths,
    ...pa.parts.filter((p) => paths[p.id] && over.has(p.id)).map(part),
  ].join('\n');
  const above = hat && tables(pa).extras[hat].art.y < 0 ? pixelHeadroom(pa) : 0;
  const title = [pa.name, outfit, [].concat(faces).join(' + '), ...extras].filter(Boolean).join(' + ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-above} 100 ${100 + above}" width="${size}" height="${Math.round((size * (100 + above)) / 100)}" shape-rendering="crispEdges">\n  <title>${escapeXml(title)}</title>\n${body}\n</svg>\n`;
}

const escapeXml = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ------------------------------------------------------------- on a layer

/**
 * The faces to draw now, one over the next, as avatarFacesNow does for the
 * built-in one: the layer's own or the one an alert brought; the mouth open
 * while talking, as wide as the voice is loud; and a blink, if the face is
 * one a blink can go over.
 */
export function pixelFacesNow(pa, { expression = 'neutral', reaction = null, mouthOpen = false, blinking = false, voice = 'normal' } = {}) {
  const face = reaction || expression;
  const faces = [face];
  if (mouthOpen) faces.push(voice === 'soft' ? 'talking-soft' : voice === 'loud' ? 'talking-loud' : 'talking');
  if (blinking && tables(pa).faces[face]?.blinks !== false) faces.push('blink');
  return faces;
}

/** The frames of something it does, in this outfit ('' the one it was drawn in), or null when that outfit does not do it. */
export function pixelActionFrames(pa, name, outfit = '') {
  return tables(pa).actions[name]?.outfits?.[outfit || ''] || null;
}

/** How long it takes, start to end, in ms: 0 when that outfit does not do it. */
export function pixelActionMs(pa, name, outfit = '') {
  return (pixelActionFrames(pa, name, outfit) || []).reduce((sum, f) => sum + f.ms, 0);
}

/** What makes a word a word: no case, no accents. */
const plain = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** The action its words name — its own name or one of its words — or null. */
export function pixelActionName(pa, words) {
  const said = plain(words);
  if (!said) return null;
  for (const a of pa?.actions || []) if (said === a.name || (a.words || []).map(plain).includes(said)) return a.name;
  return null;
}

/**
 * The outfit or hat a viewer's words name, as avatarDressName does for the
 * built-in one: the name itself, or any of its words anywhere in what they
 * typed. Returns '' for the outfit it was drawn in, 'none' to take a hat
 * off, or null when they name nothing it has.
 */
export const PIXEL_HAT_OFF_WORDS = ['none', 'off', 'nada', 'ninguno', 'quitar'];
export function pixelDressName(pa, what, words) {
  const text = plain(words);
  if (!pa || !text) return null;
  const said = text.split(/[^a-z0-9]+/).filter(Boolean);
  if (what === 'outfit') {
    if ((pa.baseWords || []).map(plain).some((w) => said.includes(w))) return '';
    for (const o of pa.outfits || []) if (text === o.name || (o.words || []).map(plain).some((w) => said.includes(w))) return o.name;
    return null;
  }
  if (what === 'hat') {
    if (PIXEL_HAT_OFF_WORDS.some((w) => said.includes(w))) return 'none';
    for (const e of pa.extras || []) if (e.hat && (text === e.name || (e.words || []).map(plain).some((w) => said.includes(w)))) return e.name;
  }
  return null;
}

// ------------------------------------------------------------- in the call

/**
 * How somebody in the Discord call is drawn, kept with their pictures: a
 * pixel avatar from the tab by its id (`kit`), with a colour, an outfit and
 * a hat of its own — names only it knows, so any well-formed one is kept and
 * the drawing leaves out what it has not got — or else the built-in avatar's
 * look, exactly as avatarCallLook keeps it.
 */
export function voiceLook(raw) {
  if (raw && typeof raw === 'object' && PIXEL_ID.test(String(raw.kit ?? ''))) {
    const out = { kit: raw.kit };
    if (PIXEL_COLOURINGS.includes(raw.colouring) && raw.colouring !== 'layout') out.colouring = raw.colouring;
    if (isHex(raw.ownColour)) out.ownColour = String(raw.ownColour).toLowerCase();
    if (PIXEL_NAME.test(String(raw.costume ?? ''))) out.costume = raw.costume;
    if (PIXEL_NAME.test(String(raw.hat ?? ''))) out.hat = raw.hat;
    return out;
  }
  return avatarCallLook(raw);
}

// ------------------------------------------------------------- keeping it sound

/** How a face, extra, outfit or action is named: lower case, digits and dashes, as the built-in ones are. */
export const PIXEL_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** How an avatar's own id is written. */
export const PIXEL_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** A part's char: one printable character, never '.' (nothing) or '_' (cleared). */
export const pixelCharOk = (c) => typeof c === 'string' && c.length === 1 && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126 && c !== '.' && c !== '_';

export const PIXEL_LIMITS = {
  parts: 92, faces: 80, extras: 80, outfits: 40, actions: 40, frames: 240, patches: 200, words: 30, bubble: 8, bytes: 2_000_000,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const fail = (why) => { throw new Error(why); };
const int = (v, lo, hi, what) => (Number.isInteger(v) && v >= lo && v <= hi ? v : fail(`${what} must be a whole number from ${lo} to ${hi}`));
const num = (v, lo, hi, what) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : fail(`${what} must be a number from ${lo} to ${hi}`));
const label = (v) => String(v ?? '').trim().slice(0, 40);
const words = (v) => (Array.isArray(v) ? v : []).map((w) => String(w ?? '').trim().toLowerCase().slice(0, 40)).filter(Boolean).slice(0, PIXEL_LIMITS.words);
const list = (v, max, what) => {
  if (v == null) return [];
  if (!Array.isArray(v)) fail(`${what} must be a list`);
  if (v.length > max) fail(`at most ${max} ${what}`);
  return v;
};
function names(items, what, reserved = []) {
  const seen = new Set();
  for (const it of items) {
    if (!PIXEL_NAME.test(String(it?.name ?? ''))) fail(`${what} "${it?.name}" needs a name of lower-case letters, digits and dashes`);
    if (reserved.includes(it.name)) fail(`${what} cannot be called "${it.name}"`);
    if (seen.has(it.name)) fail(`two ${what}s are called "${it.name}"`);
    seen.add(it.name);
  }
}

/**
 * An avatar as received, checked and copied into exactly the shape the
 * drawing code reads, or an Error saying what is wrong with it. Nothing it
 * does not know is kept, so a stored avatar is always one this can draw.
 */
export function cleanPixelAvatar(raw) {
  if (!raw || typeof raw !== 'object') fail('not a pixel avatar');
  if (JSON.stringify(raw).length > PIXEL_LIMITS.bytes) fail('too big to keep');
  const id = String(raw.id ?? '');
  if (!PIXEL_ID.test(id)) fail('its id is not one this can keep');
  const name = String(raw.name ?? '').trim().slice(0, 60) || fail('it needs a name');

  const parts = list(raw.parts, PIXEL_LIMITS.parts, 'parts').map((p) => {
    if (!PIXEL_NAME.test(String(p?.id ?? ''))) fail(`part "${p?.id}" needs an id of lower-case letters, digits and dashes`);
    if (!pixelCharOk(p.char)) fail(`part "${p.id}" needs one printable character other than . and _`);
    if (!HEX.test(String(p.color ?? ''))) fail(`part "${p.id}" needs a colour like #a56cae`);
    return {
      id: p.id, char: p.char, color: p.color.toLowerCase(), name: label(p.name) || p.id,
      ...(p.opacity != null ? { opacity: num(p.opacity, 0.05, 1, `part "${p.id}"'s opacity`) } : {}),
      ...(p.effect === 'float' || p.effect === 'pop' ? { effect: p.effect } : {}),
    };
  });
  if (!parts.length) fail('it needs at least one part');
  if (new Set(parts.map((p) => p.id)).size !== parts.length) fail('two parts have the same id');
  if (new Set(parts.map((p) => p.char)).size !== parts.length) fail('two parts have the same character');
  const chars = new Set(parts.map((p) => p.char));
  const partIds = new Set(parts.map((p) => p.id));
  const charOf = (c, what, extra = '') => (c === '.' || extra.includes(c) || chars.has(c) ? c : fail(`${what} has "${c}", which is no part of it`));
  const partChar = (c, what) => (typeof c === 'string' && chars.has(c) ? c : fail(`${what} must be one of its parts' characters`));
  const partChars = (s, what) => { const v = String(s ?? ''); if (v.length > 20) fail(`${what} is too long`); [...v].forEach((c) => partChar(c, what)); return v; };
  const partList = (v, what) => list(v, PIXEL_LIMITS.parts, what).map((p) => (partIds.has(p) ? p : fail(`${what} names "${p}", which is no part of it`)));

  const grid = (rows, what) => {
    if (!Array.isArray(rows) || rows.length !== PIXEL_SIZE) fail(`${what} must be ${PIXEL_SIZE} rows`);
    return rows.map((row, y) => {
      if (typeof row !== 'string' || row.length !== PIXEL_SIZE) fail(`${what}: row ${y + 1} must be ${PIXEL_SIZE} pixels`);
      for (const c of row) charOf(c, what);
      return row;
    });
  };
  const patch = (p, what) => {
    if (!p || !Array.isArray(p.at) || p.at.length !== 2) fail(`${what} has a patch with no place`);
    const at = [int(p.at[0], -200, 300, `${what}: where a patch is`), int(p.at[1], -200, 300, `${what}: where a patch is`)];
    const rows = list(p.rows, 120, `rows in ${what}`).map((row) => {
      if (typeof row !== 'string' || row.length > 120) fail(`${what} has a row that is too long`);
      for (const c of row) charOf(c, what, '_');
      return row;
    });
    return { at, rows };
  };
  const patches = (v, what) => list(v, PIXEL_LIMITS.patches, `patches in ${what}`).map((p) => patch(p, what));
  const faceList = (v, what) => {
    const faces = list(v, PIXEL_LIMITS.faces, what);
    names(faces, 'face', ['neutral']);
    return faces.map((f) => ({ name: f.name, label: label(f.label), patches: patches(f.patches, `face "${f.name}"`), glances: f.glances === true, blinks: f.blinks !== false }));
  };

  const base = grid(raw.base, 'the drawing');
  const faces = faceList(raw.faces, 'faces');

  const extrasIn = list(raw.extras, PIXEL_LIMITS.extras, 'extras');
  names(extrasIn, 'extra');
  const extras = extrasIn.map((e) => {
    const out = { name: e.name, label: label(e.label), patches: patches(e.patches, `extra "${e.name}"`), hat: e.hat === true };
    if (e.art) {
      const what = `hat "${e.name}"`;
      const palette = list(e.art.palette, 26, `colours in ${what}`).map((c) => (HEX.test(String(c)) ? c.toLowerCase() : fail(`${what} has a colour that is not like #a56cae`)));
      if (!palette.length) fail(`${what} needs a colour`);
      const allowed = palette.map((_, i) => String.fromCharCode(97 + i)).join('');
      const rows = list(e.art.rows, 120, `rows in ${what}`).map((row) => {
        if (typeof row !== 'string' || row.length > 120) fail(`${what} has a row that is too long`);
        for (const c of row) if (c !== '.' && !allowed.includes(c)) fail(`${what} has "${c}", which is none of its colours`);
        return row;
      });
      if (!rows.length) fail(`${what} is empty`);
      out.art = { x: num(e.art.x, -100, 200, `where ${what} sits`), y: num(e.art.y, -100, 200, `where ${what} sits`), size: num(e.art.size, 0.1, 10, `${what}'s pixel size`), palette, rows };
    }
    out.words = words(e.words);
    return out;
  });

  const outfitsIn = list(raw.outfits, PIXEL_LIMITS.outfits, 'outfits');
  names(outfitsIn, 'outfit');
  const outfits = outfitsIn.map((o) => {
    const what = `outfit "${o.name}"`;
    const out = { name: o.name, label: label(o.label), rows: grid(o.rows, what), headwear: o.headwear === true };
    if (o.ownFace) {
      const r = list(o.ownFace.region, 4, `${what}'s face`);
      if (r.length !== 4) fail(`${what}'s face needs a box`);
      const region = r.map((v) => int(v, 0, 99, `${what}'s face`));
      const ownFaces = {};
      for (const [k, v] of Object.entries(o.ownFace.faces || {})) {
        if (!PIXEL_NAME.test(k)) fail(`${what} has a face of its own with a name that is not allowed`);
        ownFaces[k] = patches(v, `${what}'s "${k}"`);
      }
      out.ownFace = { region, glasses: patches(o.ownFace.glasses, `${what}'s glasses`), faces: ownFaces };
    }
    if (o.lashesTo != null) out.lashesTo = int(o.lashesTo, 0, 99, `${what}'s lashes`);
    out.words = words(o.words);
    return out;
  });
  const outfitNames = new Set(['', ...outfits.map((o) => o.name)]);

  const actionsIn = list(raw.actions, PIXEL_LIMITS.actions, 'actions');
  names(actionsIn, 'action');
  const actions = actionsIn.map((a) => {
    const by = {};
    for (const [outfit, frames] of Object.entries(a.outfits || {})) {
      if (!outfitNames.has(outfit)) continue;
      by[outfit] = list(frames, PIXEL_LIMITS.frames, `frames of "${a.name}"`).map((f, i) => ({
        ms: int(f?.ms, 16, 20000, `frame ${i + 1} of "${a.name}"`),
        ...(f?.eyes === 'shut' ? { eyes: 'shut' } : {}),
        patches: patches(f?.patches, `frame ${i + 1} of "${a.name}"`),
      }));
    }
    return { name: a.name, label: label(a.label), words: words(a.words), outfits: by };
  });

  const split = {
    headLastRow: int(raw.split?.headLastRow ?? 99, -1, 99, 'where the head ends'),
    carried: partList(raw.split?.carried, 'what it carries'),
    follow: raw.split?.follow !== false,
  };

  let eyes = null;
  if (raw.eyes) {
    const E = raw.eyes;
    const pair = (v, lo, hi, what) => (Array.isArray(v) && v.length === 2 ? [int(v[0], lo, hi, what), int(v[1], lo, hi, what)] : fail(`${what} needs two numbers`));
    const charPair = (v, what) => (Array.isArray(v) && v.length === 2 ? [partChar(v[0], what), partChar(v[1], what)] : fail(`${what} needs two parts`));
    eyes = {
      boxes: list(E.boxes, 4, 'eyes').map((b) => pair(b, 0, 99, 'an eye\'s columns')),
      rows: pair(E.rows, 0, 99, 'the eyes\' rows'),
      opening: partChars(E.opening, 'the eye opening'),
      white: partChars(E.white, 'the white of the eye'),
      iris: partChars(E.iris, 'the iris'),
      shine: partChar(E.shine, 'the sparkle'),
      line: partChar(E.line, 'the eye\'s edge'),
      split: int(E.split, 0, 99, 'the eye\'s middle'),
      fill: charPair(E.fill, 'what shows where the iris was'),
      irisFill: charPair(E.irisFill, 'what covers the sparkle'),
      lid: partChar(E.lid, 'the eyelid'),
      lidLine: partChar(E.lidLine, 'the eyelid\'s edge'),
      lidRow: int(E.lidRow, 0, 99, 'how far the lid comes down'),
      lashes: pair(E.lashes, 0, 99, 'the lashes\' rows'),
      lashChars: partChars(E.lashChars, 'the lashes'),
    };
    if (!eyes.boxes.length) fail('the eyes need at least one eye');
    if (E.looks) {
      eyes.looks = {};
      for (const [k, v] of Object.entries(E.looks).slice(0, 12)) eyes.looks[k] = pair(v, -5, 5, `the look "${k}"`);
    }
  }

  let colouring = null;
  if (raw.colouring?.main) {
    const C = raw.colouring;
    if (!partIds.has(C.main)) fail('the part that takes the colour is no part of it');
    colouring = {
      main: C.main,
      coloured: partList(C.coloured, 'the parts that take the colour'),
      eyes: partList(C.eyes, 'the eyes that take the colour'),
      suit: C.suit?.armour ? { armour: partList([C.suit.armour], 'the suit\'s armour')[0], body: partList(C.suit.body, 'the suit\'s body') } : null,
    };
  }

  let turn = null;
  if (raw.turn?.front) {
    const F = raw.turn.front;
    /*
      Outfits and extras from the front, by the names of the ones above: one
      whose outfit or extra is gone goes with it, as an action's frames for
      an outfit no longer there do, and a second of one name is not kept.
    */
    const ofThese = (v, known, what, max) => {
      const seen = new Set();
      return list(v, max, what).filter((x) => {
        const name = String(x?.name ?? '');
        if (!known.has(name) || seen.has(name)) return false;
        seen.add(name);
        return true;
      });
    };
    turn = {
      front: {
        base: grid(F.base, 'the front view'),
        faces: faceList(F.faces, 'the front view\'s faces'),
        headLastRow: int(F.headLastRow ?? 99, -1, 99, 'where the front view\'s head ends'),
        outfits: ofThese(F.outfits, new Set(outfits.map((o) => o.name)), 'the front view\'s outfits', PIXEL_LIMITS.outfits)
          .map((o) => ({ name: o.name, rows: grid(o.rows, `outfit "${o.name}" from the front`) })),
        extras: ofThese(F.extras, new Set(extras.map((e) => e.name)), 'the front view\'s extras', PIXEL_LIMITS.extras)
          .map((e) => ({ name: e.name, patches: patches(e.patches, `extra "${e.name}" from the front`) })),
      },
      mirrorKeep: list(raw.turn.mirrorKeep, 8, 'parts kept unmirrored').map((b) => (Array.isArray(b) && b.length === 4 ? b.map((v) => int(v, 0, 99, 'a part kept unmirrored')) : fail('a part kept unmirrored needs a box'))),
    };
  }

  return {
    id,
    name,
    ...(PIXEL_NAME.test(String(raw.example ?? '')) ? { example: raw.example } : {}),
    version: PIXEL_AVATAR_VERSION,
    parts,
    base,
    baseLabel: label(raw.baseLabel),
    baseWords: words(raw.baseWords),
    faces,
    extras,
    outfits,
    actions,
    split,
    overHat: partList(raw.overHat, 'what goes over a hat'),
    eyes,
    colouring,
    bubble: list(raw.bubble, PIXEL_LIMITS.bubble, 'bubble sizes').map((b) => patch(b, 'the sleep bubble')),
    turn,
    drawnFacing: raw.drawnFacing === 'right' ? 'right' : 'left',
  };
}

/** A new avatar with nothing drawn yet: a few colours to start from, one of them the colour it takes. */
export function blankPixelAvatar(id, name) {
  const parts = [
    ['outline', 'O', '#2b2233', 'Outline'], ['skin', 'P', '#e5c5b3', 'Skin'], ['skin-shadow', 'p', '#d49a85', 'Skin shadow'],
    ['hair', 'H', '#4a3852', 'Hair'], ['clothes', 'S', '#a56cae', 'Clothes'], ['clothes-shadow', 's', '#5d3997', 'Clothes shadow'],
    ['white', 'W', '#fefdfd', 'White'], ['eye', 'I', '#8c58af', 'Eyes'],
  ].map(([pid, char, color, partName]) => ({ id: pid, char, color, name: partName }));
  return {
    id, name, version: PIXEL_AVATAR_VERSION, parts,
    base: Array.from({ length: PIXEL_SIZE }, () => '.'.repeat(PIXEL_SIZE)),
    baseLabel: '', baseWords: [], faces: [], extras: [], outfits: [], actions: [],
    split: { headLastRow: 76, carried: [], follow: true }, overHat: [], eyes: null,
    colouring: { main: 'clothes', coloured: ['clothes', 'clothes-shadow'], eyes: [], suit: null },
    bubble: [], turn: null, drawnFacing: 'right',
  };
}
