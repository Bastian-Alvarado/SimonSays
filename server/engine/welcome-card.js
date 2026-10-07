/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The welcome card, drawn: a picture of somebody arriving (or leaving), made
 * here on the server so it can be posted the moment they join, with nothing
 * open anywhere.
 *
 * Satori lays the card out from HTML-like elements and styles — flexbox,
 * gradients, borders, shadows, transforms, the bundled faces — into an SVG
 * with its text as shapes, and resvg turns that into a PNG. The dashboard's
 * preview is this same picture, so what is designed is what is posted.
 *
 * The card's look is a stylesheet on its named parts; shared/card-css.js is
 * the cascade that turns it into a style per part. On top of the look come
 * the choices made without CSS — where the avatar sits, its shape, the font,
 * the name in their role's colour, their banner behind them — and the things
 * placed by hand (layers). Each choice left empty is the look's own.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { createLogger } from '../core/logger.js';
import { config } from '../config.js';
import { cascadeCard, cleanCard, fillCardText, DEFAULT_CARD } from '../../shared/card-css.js';
import { fontFamilyName } from '../../shared/chat-style.js';
import { drawableDataUrl } from './picture-still.js';

const log = createLogger('welcome-card');
const require = createRequire(import.meta.url);

/*
  The faces a card can use, by the names a stylesheet writes. Each is the one
  the dashboard and overlays bundle, so a look written for an overlay reads the
  same on a card. Latin-ext as well for Montserrat, the default, so a name with
  ł or ş does not come out as boxes.
*/
const FACES = [
  // 300 for words on a banner: thin and large, the way a MEE6 banner writes them.
  ['Montserrat', 'montserrat', [300, 400, 600, 800, 900], ['latin', 'latin-ext']],
  ['Baloo 2', 'baloo-2', [600, 700, 800], ['latin']],
  ['Chakra Petch', 'chakra-petch', [600, 700], ['latin']],
  ['VT323', 'vt323', [400], ['latin']],
  ['Special Elite', 'special-elite', [400], ['latin']],
];
export const CARD_FACES = FACES.map(([name]) => name);

let bundled = null;
function bundledFonts() {
  if (bundled) return bundled;
  bundled = [];
  for (const [name, pkg, weights, subsets] of FACES) {
    let dir;
    try { dir = path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)); } catch { log.warn(`the ${name} face is not installed`); continue; }
    for (const weight of weights) {
      for (const subset of subsets) {
        const file = path.join(dir, 'files', `${pkg}-${subset}-${weight}-normal.woff`);
        if (fs.existsSync(file)) bundled.push({ name, data: fs.readFileSync(file), weight, style: 'normal' });
      }
    }
  }
  return bundled;
}

/*
  Fonts uploaded on the dashboard, under the family name the editors list
  them by (shared/chat-style.js), so a font picked for an overlay can be
  picked for a card. Satori reads TTF, OTF and WOFF but not WOFF2: a family
  uploaded only as WOFF2 is listed as such, for the editor to say so rather
  than drawing in the wrong face. The folder is looked at on every card —
  an upload shows up at once — and each file read once.
*/
const UPLOADED_EXTS = ['.ttf', '.otf', '.woff'];
const fontFiles = new Map();
function uploadedFonts() {
  let names = [];
  try { names = fs.readdirSync(config.assetsDir); } catch { return { fonts: [], woff2Only: [] }; }
  const fonts = [];
  const usable = new Set();
  const woff2 = new Set();
  for (const file of names) {
    const ext = path.extname(file).toLowerCase();
    const family = fontFamilyName(file);
    if (!family) continue;
    if (ext === '.woff2') { woff2.add(family); continue; }
    if (!UPLOADED_EXTS.includes(ext)) continue;
    if (!fontFiles.has(file)) {
      try { fontFiles.set(file, fs.readFileSync(path.join(config.assetsDir, file))); } catch { continue; }
    }
    usable.add(family);
    // One file is every weight: the face is drawn as it was made, bold or not.
    for (const weight of [400, 700, 900]) fonts.push({ name: family, data: fontFiles.get(file), weight, style: 'normal' });
  }
  return { fonts, woff2Only: [...woff2].filter((f) => !usable.has(f)) };
}

/** The parts' own look, before any stylesheet: a dark card, the avatar left, the name large. */
const DEFAULT_STYLES = {
  card: {
    display: 'flex', alignItems: 'center', gap: 40, padding: 48, width: '100%', height: '100%',
    position: 'relative', overflow: 'hidden', color: '#ffffff', fontFamily: 'Montserrat',
    backgroundColor: '#18181b', backgroundImage: 'linear-gradient(135deg, #18181b, #3f3f46)',
  },
  background: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' },
  avatar: { width: 180, height: 180, borderRadius: 9999, border: '6px solid #ffffff', flexShrink: 0, objectFit: 'cover' },
  text: { display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1, minWidth: 0 },
  title: { display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.75 },
  name: { display: 'flex', fontSize: 64, fontWeight: 900, lineHeight: 1.05 },
  subtitle: { display: 'flex', fontSize: 26, fontWeight: 600, opacity: 0.7 },
};

/** A picture as a data URL: an upload from the assets folder, or a download with a short leash. */
const pictures = new Map();
export async function pictureData(src) {
  if (!src) return null;
  if (pictures.has(src)) return pictures.get(src);
  let data = null;
  try {
    /*
      Read as what the bytes are, not what the name or the server says: a
      WebP — or one called .png — drew as nothing, as the drawing cannot read
      WebP. It is drawn from its first frame.
    */
    if (src.startsWith('/media/')) {
      const file = path.join(config.assetsDir, path.basename(src));
      const ext = path.extname(file).slice(1).toLowerCase();
      const type = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      data = await drawableDataUrl(fs.readFileSync(file), type);
    } else if (/^https?:\/\//.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
      if (res.ok) data = await drawableDataUrl(Buffer.from(await res.arrayBuffer()), res.headers.get('content-type') || 'image/png');
    }
  } catch (err) {
    log.debug(`could not load ${src}: ${err.message}`);
  }
  // Avatars change; uploads stay put. Keep a few of each, not forever.
  if (data) {
    pictures.set(src, data);
    if (pictures.size > 64) pictures.delete(pictures.keys().next().value);
  }
  return data;
}

/*
  Emoji in a name — plenty of Discord names have some — drawn as Twemoji
  pictures. Without this they would come out as nothing at all.
*/
async function loadAdditionalAsset(code, segment) {
  if (code !== 'emoji') return [];
  const points = [...segment].map((c) => c.codePointAt(0).toString(16)).filter((h) => h !== 'fe0f').join('-');
  return (await pictureData(`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${points}.svg`)) || [];
}

const el = (type, style, props = {}, children) => ({ type, props: { ...props, style, 'data-card': props['data-card'], children } });

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' };
const TEXT_ALIGN = { start: 'left', center: 'center', end: 'right' };

/**
 * The choices made without CSS, laid over what the look's stylesheet made of
 * each part. Changes `styles` in place.
 */
function applyChoices(c, styles, member) {
  const lines = ['title', 'name', 'subtitle'];
  if (c.layout === 'left') styles.card.flexDirection = 'row';
  if (c.layout === 'right') styles.card.flexDirection = 'row-reverse';
  if (c.layout === 'top') {
    Object.assign(styles.card, { flexDirection: 'column', justifyContent: 'center', gap: 16 });
    styles.text.flexGrow = 0;
    /*
      Stacked, the avatar and three lines have to share the height: on a
      banner-shaped card the bottom line fell off. Unless a size was chosen,
      the avatar gives way.
    */
    const fit = Math.round(c.height * 0.36);
    if (!c.avatarSize && (Number(styles.avatar.width) || 180) > fit) Object.assign(styles.avatar, { width: fit, height: fit });
  }
  // Above the words, they read centred unless something else was chosen.
  const align = c.align || (c.layout === 'top' ? 'center' : '');
  if (align) {
    styles.text.alignItems = ALIGN[align];
    for (const part of lines) styles[part].textAlign = TEXT_ALIGN[align];
    if (c.layout === 'top') styles.card.alignItems = ALIGN[align];
  }
  if (c.avatarSize) Object.assign(styles.avatar, { width: c.avatarSize, height: c.avatarSize });
  if (c.avatarShape) {
    const size = Number(styles.avatar.width) || 180;
    styles.avatar.borderRadius = { circle: 9999, rounded: Math.round(size * 0.22), square: 0 }[c.avatarShape];
  }
  // The font on every line, over whatever face the look gave each one.
  if (c.font) for (const part of ['card', ...lines]) styles[part].fontFamily = c.font;
  if (c.nameColour === 'role' && member.roleColour) styles.name.color = member.roleColour;
  // A colour of one's own, for a background the look's colour does not read on.
  if (c.nameColour === 'own' && c.nameColourValue) styles.name.color = c.nameColourValue;
  if (c.backdrop === 'accent' && member.accentColour) {
    Object.assign(styles.card, { backgroundColor: member.accentColour, backgroundImage: `linear-gradient(135deg, ${member.accentColour}, #0b0b0f)` });
  }
}

/** The faces a card can be drawn in — the bundled ones and any uploaded — and the emoji loader: for other cards drawn the same way (the profile card). */
export const cardFonts = () => [...bundledFonts(), ...uploadedFonts().fonts];
export const emojiAsset = loadAdditionalAsset;

/** A Discord emoji written as <:name:id>, as the picture Discord serves for it. */
const customEmoji = (s) => {
  const m = /^<(a?):[\w~-]+:(\d+)>$/.exec(s);
  return m ? `https://cdn.discordapp.com/emojis/${m[2]}.${m[1] ? 'gif' : 'png'}?size=128` : '';
};

/** The things placed by hand, as absolutely placed elements. */
async function layerElements(c, context) {
  const out = { behind: [], front: [] };
  for (const [i, l] of c.layers.entries()) {
    const box = {
      position: 'absolute', left: l.x, top: l.y, width: l.width, height: l.height,
      opacity: l.opacity, ...(l.rotate ? { transform: `rotate(${l.rotate}deg)` } : {}),
    };
    let node = null;
    if (l.kind === 'shape') {
      node = el('div', { ...box, backgroundColor: l.colour, borderRadius: l.shape === 'circle' ? 9999 : 0 }, { 'data-card': `layer${i}` });
    } else if (l.kind === 'emoji' && l.emoji) {
      const src = customEmoji(l.emoji);
      const data = src ? await pictureData(src) : null;
      node = data
        ? el('img', { ...box, objectFit: 'contain' }, { 'data-card': `layer${i}`, src: data })
        : el('div', { ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(Math.min(l.width, l.height) * 0.85), lineHeight: 1 }, { 'data-card': `layer${i}` }, l.emoji);
    } else {
      const src = l.kind === 'server' ? context.serverIcon : l.src;
      const data = await pictureData(src);
      if (data) node = el('img', { ...box, objectFit: 'contain', ...(l.kind === 'server' ? { borderRadius: Math.round(Math.min(l.width, l.height) * 0.22) } : {}) }, { 'data-card': `layer${i}`, src: data });
    }
    if (node) out[l.front ? 'front' : 'behind'].push(node);
  }
  return out;
}

/**
 * Draw a card for somebody.
 *   member   { name, avatar, roleColour, accentColour, banner }   who it is about
 *   context  { server, count, boosts, id, serverIcon }             for the placeholders and the server's icon
 * Returns the PNG, any selectors the stylesheet named that a picture cannot
 * have, and notes for the editor (a font that cannot be drawn).
 */
export async function renderCard(card, member = {}, context = {}, { format = 'png' } = {}) {
  const c = cleanCard(card, DEFAULT_CARD);
  /*
    What they bring, as custom properties a look can use: their top role's
    colour and their profile colour. Only the ones they have — a look's
    var(--their-colour, white) falls back to its own for anybody without.
  */
  const theirs = {
    ...(member.roleColour ? { '--their-colour': member.roleColour } : {}),
    ...(member.accentColour ? { '--their-accent': member.accentColour } : {}),
  };
  const { styles, ignored } = cascadeCard(c.css, { ...c.cssVars, ...theirs }, DEFAULT_STYLES);
  applyChoices(c, styles, member);
  const fill = (text) => fillCardText(text, { name: member.name || 'Someone', ...context }).trim();

  const { fonts: uploaded, woff2Only } = uploadedFonts();
  const notes = [];
  if (c.font && !CARD_FACES.includes(c.font) && !uploaded.some((f) => f.name === c.font)) {
    notes.push(woff2Only.includes(c.font) ? 'font-woff2' : 'font-missing');
  }

  // Their banner behind them, when that was chosen and they have one; the card's own picture otherwise.
  const backdrop = c.backdrop === 'banner' && member.banner ? member.banner : c.background;
  const [background, avatar, layers] = await Promise.all([
    pictureData(backdrop),
    c.showAvatar ? pictureData(member.avatar) : null,
    layerElements(c, context),
  ]);
  const texts = [['title', fill(c.title)], ['name', fill(c.name)], ['subtitle', fill(c.subtitle)]]
    .filter(([, text]) => text)
    .map(([part, text]) => el('div', styles[part], { 'data-card': part }, text));

  const children = [];
  if (background) children.push(el('img', styles.background, { 'data-card': 'background', src: background }));
  children.push(...layers.behind);
  if (c.showAvatar) {
    // No picture to be had: the avatar's frame, empty, rather than a gap.
    children.push(avatar
      ? el('img', styles.avatar, { 'data-card': 'avatar', src: avatar })
      : el('div', { backgroundColor: '#3f3f46', ...styles.avatar }, { 'data-card': 'avatar' }));
  }
  if (texts.length) children.push(el('div', styles.text, { 'data-card': 'text' }, texts));
  children.push(...layers.front);

  const svg = await satori(el('div', styles.card, { 'data-card': 'card' }, children), {
    width: c.width,
    height: c.height,
    fonts: [...bundledFonts(), ...uploaded],
    loadAdditionalAsset,
  });
  if (format === 'svg') return { svg, ignored, notes };
  const png = new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
  return { png, ignored, notes };
}

/**
 * The dashboard's preview: the same picture, for a stand-in member — with a
 * role colour and a profile colour, so choosing those shows something.
 */
export async function previewCard(card, {
  name = 'NewMember', avatar = 'https://cdn.discordapp.com/embed/avatars/0.png', server = 'My Server', count = 42,
  roleColour = '#f47fff', accentColour = '#5865f2', banner = '', serverIcon = '', id = '306050655881793586',
} = {}) {
  try {
    const { png, ignored, notes } = await renderCard(card, { name, avatar, roleColour, accentColour, banner }, { server, count, id, serverIcon });
    return { image: `data:image/png;base64,${png.toString('base64')}`, ignored, notes };
  } catch (err) {
    return { error: err.message, ignored: [], notes: [] };
  }
}
