/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The welcome card: what it is made of, how it is kept, and how a stylesheet
 * becomes the look of each part.
 *
 * The card is drawn on the server as a picture (server/engine/welcome-card.js),
 * so it can be posted to Discord the moment somebody joins, with no browser
 * open anywhere. The renderer takes one style per element rather than a
 * stylesheet, so this is the small cascade in between: the rules a person
 * writes, aimed at the card's named parts, applied to each part in order,
 * `!important` winning, custom properties inherited and `var()` filled in —
 * the same way a stylesheet on an overlay layer behaves, for the parts of a
 * still picture.
 *
 * What a picture cannot have is left out and said so: selectors that reach
 * past the named parts (descendants, pseudo-elements, states) are reported
 * back rather than silently doing nothing, and animations and at-rules are
 * skipped — nothing moves in a PNG.
 */

import { fillGreeting } from './greeting-text.js';
import { CARD_LOOKS } from './card-looks.js';
import { PREVIOUS_CARD_LOOKS } from './card-looks-previous.js';

/**
 * A stylesheet that is word for word an earlier version of one of the looks —
 * picked and never edited — as that look is now, so a field the look gained
 * since (the name's colour) shows up. Anything else is left exactly as it is.
 */
export function upgradeLookCss(css) {
  for (const [id, versions] of Object.entries(PREVIOUS_CARD_LOOKS)) {
    if (versions.includes(css)) return CARD_LOOKS.find((l) => l.id === id)?.css ?? css;
  }
  return css;
}

/** The parts a stylesheet may name, as \`[data-card="…"]\`. \`:scope\` is the card itself. */
export const CARD_PARTS = ['card', 'background', 'avatar', 'text', 'title', 'name', 'subtitle'];

/** Which part holds which, for custom properties to inherit down. */
const PARENT = { background: 'card', avatar: 'card', text: 'card', title: 'text', name: 'text', subtitle: 'text' };

export const CARD_SIZES = { minWidth: 300, maxWidth: 1600, minHeight: 150, maxHeight: 900 };
export const MAX_CARD_CSS = 6000;

export const DEFAULT_CARD = {
  enabled: false,
  width: 1000,
  height: 320,
  title: 'Welcome',
  name: '{username}',
  subtitle: 'Member #{count}',
  showAvatar: true,
  background: '',
  css: '',
  cssVars: {},
  /*
    The layout without writing CSS. Each one left empty is the look's own;
    set, it wins over the look, since it is the thing chosen on purpose.
  */
  layout: '',
  align: '',
  avatarShape: '',
  avatarSize: 0,
  font: '',
  // The name's colour: the look's, their top role's ('role'), or one chosen here ('own', in nameColourValue).
  nameColour: '',
  nameColourValue: '',
  // From the person: their profile banner or colour behind them.
  backdrop: '',
  layers: [],
};

/** Where the avatar sits: beside the words on the left or the right, or above them. */
export const CARD_LAYOUTS = ['left', 'right', 'top'];
export const CARD_ALIGNS = ['start', 'center', 'end'];
export const CARD_AVATAR_SHAPES = ['circle', 'rounded', 'square'];
/** What is behind them, from their own profile: the banner they set, or their profile colour. */
export const CARD_BACKDROPS = ['banner', 'accent'];
/** Things placed on the card by hand: a picture, the server's icon, an emoji, a plain shape. */
export const CARD_LAYER_KINDS = ['picture', 'server', 'emoji', 'shape'];
export const MAX_CARD_LAYERS = 8;

const bounded = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};
const line = (v, max) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, max);
const oneOf = (v, list) => (list.includes(v) ? v : '');
/** An uploaded picture, or one on the web. Nothing else is ever fetched. */
const pictureSrc = (v) => {
  const s = String(v ?? '').trim();
  return /^\/media\/[\w.-]+$/.test(s) || /^https?:\/\/\S+$/.test(s) ? s.slice(0, 300) : '';
};
const colour = (v) => (/^#[0-9a-f]{3,8}$/i.test(String(v ?? '')) ? String(v) : '');
/** A font name as the app writes one: letters, digits, spaces and hyphens. */
const fontName = (v) => (/^[\w -]{1,40}$/.test(String(v ?? '').trim()) ? String(v).trim() : '');

/** One thing placed on the card: what it is, where, how big, turned and see-through how far. */
export function cleanCardLayer(raw, card) {
  const l = raw && typeof raw === 'object' ? raw : {};
  const kind = oneOf(l.kind, CARD_LAYER_KINDS);
  if (!kind) return null;
  const emoji = String(l.emoji ?? '').trim();
  return {
    kind,
    ...(kind === 'picture' ? { src: pictureSrc(l.src) } : {}),
    ...(kind === 'emoji' ? { emoji: /^<a?:[\w~-]{1,32}:\d{5,25}>$/.test(emoji) || (emoji.length <= 16 && !/[<>]/.test(emoji)) ? emoji : '' } : {}),
    ...(kind === 'shape' ? { shape: l.shape === 'circle' ? 'circle' : 'box', colour: colour(l.colour) || '#ffffff' } : {}),
    x: bounded(l.x, -card.width, card.width * 2, 0),
    y: bounded(l.y, -card.height, card.height * 2, 0),
    width: bounded(l.width, 4, 1600, 120),
    height: bounded(l.height, 4, 900, 120),
    rotate: bounded(l.rotate, -180, 180, 0),
    opacity: Math.min(1, Math.max(0, Number.isFinite(Number(l.opacity)) ? Number(l.opacity) : 1)),
    // In front of the avatar and the words, or behind them.
    front: l.front === true,
  };
}

/** A card as it is kept: bounded sizes, one-line texts, a stylesheet of reasonable length. */
export function cleanCard(incoming, fallback = DEFAULT_CARD) {
  const c = incoming && typeof incoming === 'object' ? incoming : {};
  const vars = {};
  for (const [k, v] of Object.entries(c.cssVars && typeof c.cssVars === 'object' ? c.cssVars : {})) {
    if (/^--[\w-]{1,40}$/.test(k) && typeof v === 'string' && v.length <= 200 && !/[;{}]/.test(v)) vars[k] = v;
  }
  const width = bounded(c.width, CARD_SIZES.minWidth, CARD_SIZES.maxWidth, fallback.width);
  const height = bounded(c.height, CARD_SIZES.minHeight, CARD_SIZES.maxHeight, fallback.height);
  return {
    enabled: c.enabled === true,
    width,
    height,
    title: line(c.title ?? fallback.title, 120),
    name: line(c.name ?? fallback.name, 120),
    subtitle: line(c.subtitle ?? fallback.subtitle, 160),
    showAvatar: c.showAvatar !== false,
    background: pictureSrc(c.background),
    css: upgradeLookCss(String(c.css ?? '').slice(0, MAX_CARD_CSS)),
    cssVars: vars,
    layout: oneOf(c.layout, CARD_LAYOUTS),
    align: oneOf(c.align, CARD_ALIGNS),
    avatarShape: oneOf(c.avatarShape, CARD_AVATAR_SHAPES),
    // 0 is the look's own size.
    avatarSize: c.avatarSize ? bounded(c.avatarSize, 40, 480, 0) : 0,
    font: fontName(c.font),
    nameColour: c.nameColour === 'role' || c.nameColour === 'own' ? c.nameColour : '',
    nameColourValue: colour(c.nameColourValue),
    backdrop: oneOf(c.backdrop, CARD_BACKDROPS),
    layers: (Array.isArray(c.layers) ? c.layers : []).map((l) => cleanCardLayer(l, { width, height })).filter(Boolean).slice(0, MAX_CARD_LAYERS),
  };
}

/**
 * A card's texts filled in, with the same placeholders as every other part of
 * a greeting (shared/greeting-text.js). A picture cannot ping anybody, so
 * {user} is their name here.
 */
export function fillCardText(text, context) {
  return fillGreeting(text, { ...context, mention: '' });
}

// ------------------------------------------------------------------ parsing

/** Split on a character outside brackets, parentheses and quotes. */
function splitTop(text, sep) {
  const out = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) { if (ch === quote && text[i - 1] !== '\\') quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === sep && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
}

/** Where the block opened at \`open\` closes. */
function closing(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') { depth -= 1; if (depth === 0) return i; }
  }
  return text.length;
}

/** The part a selector names, or null when it names something a picture cannot have. */
export function partOf(selector) {
  const s = selector.trim();
  if (s === ':scope') return 'card';
  const m = /^\[data-card=(["']?)([a-z]+)\1\]$/.exec(s);
  return m && CARD_PARTS.includes(m[2]) ? m[2] : null;
}

/**
 * The rules of a stylesheet, in order, and every selector that had to be
 * ignored. At-rules — @keyframes, @property, @media — are skipped whole.
 */
export function parseCardCss(css) {
  const text = String(css ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const ignored = [];
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf('{', at);
    if (open < 0) break;
    const prelude = text.slice(at, open).trim();
    const close = closing(text, open);
    const body = text.slice(open + 1, close);
    at = close + 1;
    if (!prelude || prelude.startsWith('@')) continue;
    const parts = [];
    for (const selector of splitTop(prelude, ',')) {
      const part = partOf(selector);
      if (part) parts.push(part);
      else if (selector.trim()) ignored.push(selector.trim());
    }
    if (!parts.length || body.includes('{')) continue;
    const decls = [];
    for (const raw of splitTop(body, ';')) {
      const colon = raw.indexOf(':');
      if (colon < 0) continue;
      const prop = raw.slice(0, colon).trim().toLowerCase();
      let value = raw.slice(colon + 1).trim();
      const important = /!important\s*$/i.test(value);
      if (important) value = value.replace(/\s*!important\s*$/i, '').trim();
      if (prop && value) decls.push({ prop, value, important });
    }
    rules.push({ parts, decls });
  }
  return { rules, ignored };
}

// ------------------------------------------------------------------ cascading

const camel = (prop) => prop.replace(/^-webkit-/, 'Webkit-').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Plain numbers the renderer wants as numbers rather than strings. */
const NUMERIC = new Set(['fontWeight', 'lineHeight', 'opacity', 'zIndex', 'flexGrow', 'flexShrink', 'order']);

/** Fill in var(--x, fallback), from the custom properties in reach. */
function resolveVars(value, props, depth = 0) {
  if (depth > 8 || !value.includes('var(')) return value;
  let out = '';
  let i = 0;
  while (i < value.length) {
    const start = value.indexOf('var(', i);
    if (start < 0) { out += value.slice(i); break; }
    out += value.slice(i, start);
    let depthP = 0;
    let end = start + 3;
    for (; end < value.length; end += 1) {
      if (value[end] === '(') depthP += 1;
      else if (value[end] === ')') { depthP -= 1; if (depthP === 0) break; }
    }
    const inner = value.slice(start + 4, end);
    const [name, ...rest] = splitTop(inner, ',');
    const fallback = rest.join(',').trim();
    const found = props[name.trim()];
    out += resolveVars(found !== undefined ? found : fallback, props, depth + 1);
    i = end + 1;
  }
  return out;
}

/**
 * The style of every part: the part's own defaults, then the stylesheet's
 * rules in order — important ones after the rest — then the field values set
 * on the card, which override the custom properties the stylesheet declares.
 */
export function cascadeCard(css, cssVars = {}, defaults = {}) {
  const { rules, ignored } = parseCardCss(css);
  const declared = Object.fromEntries(CARD_PARTS.map((p) => [p, []]));
  rules.forEach((rule, order) => {
    for (const part of rule.parts) for (const d of rule.decls) declared[part].push({ ...d, order });
  });

  const props = {};
  const styles = {};
  for (const part of CARD_PARTS) {
    const list = declared[part].slice().sort((a, b) => (a.important - b.important) || (a.order - b.order));
    // Custom properties first, inherited from the part that holds this one.
    const own = { ...(PARENT[part] ? props[PARENT[part]] : {}) };
    for (const d of list) if (d.prop.startsWith('--')) own[d.prop] = d.value;
    if (part === 'card') Object.assign(own, cssVars);
    props[part] = own;

    const style = { ...(defaults[part] || {}) };
    for (const d of list) {
      if (d.prop.startsWith('--')) continue;
      let value = resolveVars(d.value, own).trim();
      const key = camel(d.prop);
      if (NUMERIC.has(key) && /^-?\d*\.?\d+$/.test(value)) value = Number(value);
      // The renderer only lays out with flex; anything else would drop the part.
      if (key === 'display' && value !== 'none') value = 'flex';
      // A shorthand resets its longhands, as in a browser — a plain colour
      // must not sit under the default gradient.
      if (key === 'background') { delete style.backgroundImage; delete style.backgroundColor; }
      // "none" is how a stylesheet takes a background away; the renderer wants it simply absent.
      if ((key === 'backgroundImage' || key === 'background') && value === 'none') { delete style[key]; continue; }
      style[key] = value;
    }
    styles[part] = style;
  }
  return { styles, ignored };
}
