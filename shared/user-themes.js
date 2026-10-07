/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Themes made in the app: the streamer's own, beside the ones that ship.
 *
 * A theme is already only data — a name, a line about it, and its pieces,
 * each a stylesheet for one kind of layer (or for the alerts, or the chat) —
 * so a theme made here is the same shape as one in css-presets.js, and the
 * Library applies, previews and undoes it the same way. The shipped ones stay
 * in code and are never changed from here: a copy of one is a new theme.
 *
 * What is kept is only ever what cleanUserTheme hands back, so every theme
 * stored is one the Library can draw.
 */

import { PRESET_LAYER_TYPES } from './css-presets.js';
import { cleanCss, MAX_SCOPED_CSS, MAX_ALERT_CSS, MAX_CHAT_CSS } from './clean-css.js';
import { fieldOf, isTallBarLayer } from './theme-apply.js';
import { readFields } from './css-fields.js';
import { CHAT_FONTS } from './chat-style.js';

/** How many can be kept: every screen is sent all of them. */
export const MAX_USER_THEMES = 30;
/** How many pieces one can have: the biggest shipped theme has 43. */
export const MAX_THEME_PIECES = 80;

/** What a piece can dress: every kind the shipped themes dress, the alerts and the chat among them. */
export const THEME_PIECE_TYPES = PRESET_LAYER_TYPES;

const ID = /^ut-[a-z0-9]{4,30}$/;
const PIECE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const bool = (v) => v === true;
const num = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

/** How long one piece's stylesheet may be: an alert's or the chat's has the room theirs has, a layer's a layer's. */
export const pieceCssMax = (layerType) => (layerType === 'alert' ? MAX_ALERT_CSS : layerType === 'chat' ? MAX_CHAT_CSS : MAX_SCOPED_CSS);

/** A new id for a theme, or for a piece in one. */
export const newThemeId = () => `ut-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newPieceId = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * A preview's own settings, as the shipped pieces carry them: a few short
 * words or numbers for the stand-in it is drawn on ("Starting soon" on a
 * chip). Nothing nested, nothing long.
 */
function cleanPreviewConfig(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const [k, value] of Object.entries(v).slice(0, 12)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,30}$/.test(k)) continue;
    if (typeof value === 'string') out[k] = value.slice(0, 120);
    else if (typeof value === 'number' && Number.isFinite(value)) out[k] = value;
    else if (typeof value === 'boolean') out[k] = value;
  }
  return Object.keys(out).length ? out : null;
}

/** One piece as kept: what it dresses, what it is called, its stylesheet, and how the Library shows it. */
export function cleanThemePiece(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const layerType = THEME_PIECE_TYPES.includes(p.layerType) ? p.layerType : null;
  if (!layerType) throw new Error(`a piece for "${String(p.layerType ?? '').slice(0, 30)}", which is nothing a theme dresses`);
  const id = PIECE_ID.test(String(p.id ?? '')) ? String(p.id) : newPieceId();
  const piece = {
    id,
    layerType,
    name: text(p.name, 60) || layerType,
    hint: text(p.hint, 300),
    css: cleanCss(p.css, pieceCssMax(layerType)),
  };
  // How the shipped pieces say they are motion, and that they go on an alert or the chat — kept the same way.
  if (p.kind === 'motion') piece.kind = 'motion';
  if (layerType === 'alert') piece.applies = 'alert';
  if (layerType === 'chat') piece.applies = 'chat';
  if (layerType === 'omnibar' && bool(p.previewTall)) piece.previewTall = true;
  if (bool(p.previewOver)) piece.previewOver = true;
  const width = num(p.previewSize?.width, 8, 1920);
  const height = num(p.previewSize?.height, 8, 1080);
  if (width && height) piece.previewSize = { width, height };
  if (typeof p.previewWith === 'string' && PIECE_ID.test(p.previewWith)) piece.previewWith = p.previewWith;
  const previewConfig = cleanPreviewConfig(p.previewConfig);
  if (previewConfig) piece.previewConfig = previewConfig;
  return piece;
}

/**
 * A theme as kept. Throws, saying why, for anything that is not one: a
 * theme with no name is given one, but a piece for a kind of layer nobody
 * has is not quietly dropped.
 */
export function cleanUserTheme(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  if (!ID.test(String(t.id ?? ''))) throw new Error('a theme needs an id');
  const pieces = Array.isArray(t.objects) ? t.objects : [];
  if (pieces.length > MAX_THEME_PIECES) throw new Error(`a theme can have up to ${MAX_THEME_PIECES} pieces`);
  const objects = [];
  const seen = new Set();
  for (const raw of pieces) {
    const piece = cleanThemePiece(raw);
    // Two pieces with one id would be one piece to the Library: the second gets an id of its own.
    if (seen.has(piece.id)) piece.id = newPieceId();
    seen.add(piece.id);
    objects.push(piece);
  }
  // A motion drawn over a look names it; a name that is not in the theme names nothing.
  for (const piece of objects) if (piece.previewWith && !seen.has(piece.previewWith)) delete piece.previewWith;
  return {
    id: String(t.id),
    name: text(t.name, 60) || 'My theme',
    hint: text(t.hint, 400),
    // The theme it started as, if it is a copy: a shipped one's id, or another of these.
    ...(text(t.from, 40) ? { from: text(t.from, 40) } : {}),
    objects,
    updatedAt: Number.isFinite(Number(t.updatedAt)) ? Number(t.updatedAt) : 0,
  };
}

/**
 * A copy of a theme — a shipped one or one of these — to change: new ids for
 * it and every piece, its motions still pointing at its own looks, and where
 * it came from remembered.
 */
export function copyTheme(theme, { id = newThemeId(), name } = {}) {
  const ids = new Map();
  const objects = (theme?.objects || []).map((o) => {
    const fresh = newPieceId();
    ids.set(o.id, fresh);
    // Only what a piece is: the Library's own bookkeeping on a shipped one (which theme it is in) is left behind.
    const { lookId, lookName, ...piece } = o;
    return { ...structuredClone(piece), id: fresh };
  });
  for (const o of objects) {
    if (!o.previewWith) continue;
    if (ids.has(o.previewWith)) o.previewWith = ids.get(o.previewWith);
    else delete o.previewWith;
  }
  return cleanUserTheme({
    id,
    name: name || theme?.name || 'My theme',
    hint: theme?.hint || '',
    from: theme?.id || '',
    objects,
  });
}

const escapeName = (name) => name.replace(/[-/\\^$*+?.()|[\]{}]/g, (c) => `\\${c}`);

/**
 * A piece's stylesheet with one of its knobs (a field from readFields in
 * css-fields.js) starting at another value: the default itself changed, in
 * the text, since a theme's piece is what layers are given — not a value
 * kept beside it the way a layer keeps its own. A knob declared with its
 * default behind a var() — `--seat: var(--overlay-accent, #2ec4b6)` — keeps
 * the var() and changes only the default; one only ever read — `var(--strike,
 * 7s)` — has its default changed everywhere it is read.
 */
export function setFieldDefault(css, field, value) {
  const text = String(css ?? '');
  const v = String(value ?? '').trim();
  if (!field?.name || !v) return text;
  const name = escapeName(field.name);
  if (field.declared) {
    const re = new RegExp(`(${name}\\s*:\\s*)([^;{}]*)`);
    return text.replace(re, (whole, head, old) => {
      const behind = /^(var\(\s*--[A-Za-z0-9_-]+\s*,)([^()]*)(\))(\s*)$/.exec(old);
      return behind ? `${head}${behind[1]} ${v}${behind[3]}${behind[4]}` : `${head}${v}${/\s$/.test(old) ? ' ' : ''}`;
    });
  }
  const re = new RegExp(`(var\\(\\s*${name}\\s*,)([^()]*)(\\))`, 'g');
  return text.replace(re, (whole, head, old, tail) => `${head} ${v}${tail}`);
}

/**
 * A theme gathered from a layout somebody has styled: every look on its
 * layers, and every motion, each once.
 *
 * Each kind of layer gives a piece for each different look it wears, the
 * first one first, so the theme gives that kind the look the layout's first
 * layer of it wears; a tall bar's look is told from a bar's. A motion is
 * drawn over the look it was on. Shapes, each a different part of the
 * build, are pieces of their own. A chat layer only counts if it uses its
 * stylesheet (the Custom look). The alerts, which every layout shares, come
 * along only when asked for: `alerts` is their list.
 *
 * `nameFor(kind)` is what a kind of layer is called on screen, for the
 * pieces' names; `motionWord` the word for a motion.
 */
export function themeFromLayout(layout, { omnibars = [], alerts = null, nameFor = (kind) => kind, motionWord = 'motion', name = '' } = {}) {
  const objects = [];
  const seen = new Map();
  const counts = {};
  const numbered = (kind) => {
    counts[kind] = (counts[kind] || 0) + 1;
    return counts[kind] > 1 ? `${nameFor(kind)} ${counts[kind]}` : nameFor(kind);
  };
  // Made only when it is new, so a look worn twice is not counted twice in the names.
  const add = (key, make) => {
    if (!seen.has(key)) {
      const piece = make();
      seen.set(key, piece.id);
      objects.push(piece);
    }
    return seen.get(key);
  };
  for (const layer of layout?.layers || []) {
    if (!THEME_PIECE_TYPES.includes(layer?.type)) continue;
    const css = layer.type === 'chat' && (layer.config?.chatTheme || '') !== 'custom' ? '' : String(fieldOf(layer, 'css') || '').trim();
    const motion = String(fieldOf(layer, 'motionCss') || '').trim();
    const tall = isTallBarLayer(layer, omnibars);
    let lookId = null;
    if (css) {
      lookId = add(`look|${layer.type}|${tall}|${css}`, () => ({
        id: newPieceId(), layerType: layer.type, name: numbered(layer.type), css, ...(tall ? { previewTall: true } : {}),
      }));
    }
    if (motion) {
      add(`motion|${layer.type}|${motion}`, () => ({
        id: newPieceId(), layerType: layer.type, kind: 'motion', name: `${nameFor(layer.type)} · ${motionWord}`, css: motion,
        ...(lookId ? { previewWith: lookId } : {}),
      }));
    }
  }
  for (const alert of alerts || []) {
    const css = String(alert?.css || '').trim();
    const motion = String(alert?.motionCss || '').trim();
    let lookId = null;
    if (css) lookId = add(`look|alert|${css}`, () => ({ id: newPieceId(), layerType: 'alert', name: numbered('alert'), css }));
    if (motion) {
      add(`motion|alert|${motion}`, () => ({
        id: newPieceId(), layerType: 'alert', kind: 'motion', name: `${nameFor('alert')} · ${motionWord}`, css: motion,
        ...(lookId ? { previewWith: lookId } : {}),
      }));
    }
  }
  return cleanUserTheme({
    id: newThemeId(),
    name: name || layout?.name || 'My theme',
    hint: '',
    objects: objects.slice(0, MAX_THEME_PIECES),
  });
}

// ------------------------------------------------------------ the whole theme at once

/*
  A theme's pieces tend to share their knobs: Marathon's all sit on --ground
  and edge their parts with --edge, Mania's all write in --gold. Set once for
  the whole theme, each such knob changes it everywhere at once — which is
  the change somebody making a theme of their own actually wants to make,
  without opening forty stylesheets to make it.
*/

const mostCommon = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/**
 * The knobs two or more of a theme's pieces share, each once: its most
 * common value now, how many values it has across them (1: they agree),
 * and in how many pieces it is. Most-shared first.
 */
export function themeKnobs(theme) {
  const byName = new Map();
  for (const piece of theme?.objects || []) {
    for (const f of readFields(piece.css || '', '')) {
      const key = `${f.name}|${f.kind}`;
      const entry = byName.get(key) || { name: f.name, kind: f.kind, unit: f.unit, label: f.label, min: f.min, max: f.max, values: [], pieces: 0 };
      entry.values.push(f.value);
      entry.pieces += 1;
      if (f.kind === 'number') {
        entry.min = Math.min(entry.min, f.min);
        entry.max = Math.max(entry.max, f.max);
      }
      byName.set(key, entry);
    }
  }
  return [...byName.values()]
    .filter((k) => k.pieces >= 2)
    .map(({ values, ...k }) => ({ ...k, value: mostCommon(values), differing: new Set(values).size }))
    .sort((a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name));
}

/** The theme with one shared knob at a value in every piece that has it — declared, behind a var(), or only read. */
export function setThemeKnob(theme, knob, value) {
  return {
    ...theme,
    objects: (theme?.objects || []).map((piece) => {
      const f = readFields(piece.css || '', '').find((x) => x.name === knob.name && x.kind === knob.kind);
      if (!f) return piece;
      // A number keeps each piece's own unit: a knob in px stays in px.
      const v = knob.kind === 'number' && f.unit !== knob.unit ? `${parseFloat(value)}${f.unit}` : value;
      return { ...piece, css: setFieldDefault(piece.css, f, v) };
    }),
  };
}

/** Each font-family a stylesheet sets, as written: `'VT323', monospace` and the like. */
const FONT_DECLARATION = /font-family\s*:\s*([^;{}]+)/gi;
/** The first family a font-family names, behind any var() fallback: the one the look is drawn in. */
const firstFamily = (value) => {
  const inner = String(value).replace(/var\(\s*--[A-Za-z0-9_-]+\s*,/g, '').replace(/[()]/g, ' ');
  const first = inner.split(',')[0].trim().replace(/!important/i, '').trim();
  return first.replace(/^(['"])(.*)\1$/, '$2').trim();
};
/** Families every browser has, not a font of the theme's own to swap. */
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit', 'initial', 'unset', 'ui-monospace', 'ui-sans-serif', 'ui-serif']);

/** The fonts a theme is drawn in, each with how many pieces use it, most used first. */
export function themeFonts(theme) {
  const counts = new Map();
  for (const piece of theme?.objects || []) {
    const here = new Set();
    for (const m of String(piece.css || '').matchAll(FONT_DECLARATION)) {
      const family = firstFamily(m[1]);
      if (family && !GENERIC.has(family.toLowerCase()) && !family.startsWith('var(')) here.add(family);
    }
    for (const family of here) counts.set(family, (counts.get(family) || 0) + 1);
  }
  return [...counts].map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
}

/**
 * The theme drawn in another font wherever it used one: the family swapped
 * inside every font-family that names it, quoted or not, a var() fallback
 * included. What comes after it in each list — the generic family — stays.
 */
export function swapThemeFont(theme, from, to) {
  const name = String(to ?? '').replace(/['"\\;{}<>]/g, '').trim();
  if (!from || !name) return theme;
  const family = new RegExp(`(['"]?)${escapeName(from)}\\1(?=\\s*(,|\\)|!|$))`, 'gi');
  return {
    ...theme,
    objects: (theme?.objects || []).map((piece) => ({
      ...piece,
      css: String(piece.css || '').replace(FONT_DECLARATION, (whole, value) => whole.replace(value, value.replace(family, `'${name}'`))),
    })),
  };
}

/**
 * Every stylesheet the streamer's themes hold, so a layer wearing one of
 * them reads as a theme's look rather than as one somebody typed (see
 * isOwnCss in theme-apply.js).
 */
export const userThemeCss = (themes) => new Set((themes || []).flatMap((th) => (th.objects || []).map((o) => String(o.css || '').trim()).filter(Boolean)));

/** The fonts the app carries, to draw a theme in: the chat's, and the shipped themes' own. Uploaded fonts are offered beside them. */
export const THEME_FONTS = [...new Set([...CHAT_FONTS, 'Pixelify Sans', 'Chakra Petch', 'Baloo 2', 'Special Elite', 'Arial'])];

// ------------------------------------------------------------ sharing one as a file

/** What a theme file says it is, so anything else is told apart from one. */
export const THEME_FILE_FORMAT = 'simonsays-theme';
export const THEME_FILE_VERSION = 1;
/** As big as an uploaded font may be (shared/asset-kinds.js). */
export const THEME_FONT_MAX_BYTES = 2 * 1024 * 1024;
const FONT_FILE = /^[^\/:*?"<>|]{1,120}\.(woff2|woff|ttf|otf)$/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * A theme as a file to hand to somebody else: what it is, and the fonts
 * uploaded to this app that it is drawn in, so it looks the same where it
 * lands. `fonts` are { file, data } — the font's file name and its bytes as
 * base64. The shipped fonts travel with the app, so they are never in one.
 */
export function themeFile(theme, fonts = []) {
  return {
    format: THEME_FILE_FORMAT,
    version: THEME_FILE_VERSION,
    theme: { name: theme?.name || '', hint: theme?.hint || '', objects: theme?.objects || [] },
    fonts: (fonts || []).filter((f) => FONT_FILE.test(String(f?.file ?? '')) && typeof f?.data === 'string'),
  };
}

/**
 * A theme file read back: the theme, as a new theme of this app's own (a
 * fresh id, held to what a theme can be), and the fonts that came in it.
 * Throws, saying why, for anything that is not one.
 */
export function readThemeFile(text) {
  let data;
  try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch { throw new Error('it is not a theme file'); }
  if (!data || data.format !== THEME_FILE_FORMAT) throw new Error('it is not a theme file');
  if (Number(data.version) > THEME_FILE_VERSION) throw new Error('it was made by a newer version of the app');
  const theme = cleanUserTheme({ ...(data.theme || {}), id: newThemeId(), from: '' });
  if (!theme.objects.length) throw new Error('the theme in it has no pieces');
  const fonts = [];
  for (const f of Array.isArray(data.fonts) ? data.fonts.slice(0, 12) : []) {
    const file = String(f?.file ?? '');
    const b64 = String(f?.data ?? '');
    if (!FONT_FILE.test(file) || !BASE64.test(b64)) throw new Error(`a font in it is not one: ${file.slice(0, 60)}`);
    if (Math.floor(b64.length * 3 / 4) > THEME_FONT_MAX_BYTES) throw new Error(`the font ${file} is bigger than a font can be`);
    fonts.push({ file, data: b64 });
  }
  return { theme, fonts };
}
