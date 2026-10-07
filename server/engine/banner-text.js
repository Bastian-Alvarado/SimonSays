/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Words on a banner, the way MEE6 writes "Welcome!" over a picture, and one
 * picture inside it — a logo, an avatar — under the words: drawn into the
 * banner by the server, so Discord shows them as part of it.
 *
 *   - a still banner (PNG, JPEG) comes back a PNG, drawn here at once.
 *   - a GIF or WebP banner comes back a WebP, every frame drawn on — moving
 *     if it moved, which Discord plays. That takes seconds, so it is done in
 *     a worker (banner-text-worker.js) and the stream carries on meanwhile.
 *
 * The picture inside is drawn still: a moving one shows its first frame.
 *
 * A banner wider than Discord ever shows one is made smaller first: past
 * 1100 pixels nobody sees the difference, and every frame costs less.
 *
 * What is drawn is kept in the uploads folder as banner-text-<key>, named by
 * the pictures, their files' size and time, and the words and where things
 * sit — the same banner is never drawn twice, and a page kept up to date can
 * tell nothing changed without drawing anything. Those files are not uploads
 * and are left out of the list; a block's older drawing goes when it gets a
 * new one, and drawings no block has any more go when the server starts.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { createLogger } from '../core/logger.js';
import { collection } from '../core/store.js';
import { refusal } from '../core/refusal.js';
import { config } from '../config.js';
import { cardFonts, emojiAsset, CARD_FACES } from './welcome-card.js';
import { cleanCaption, cleanInset, bannerDrawn } from '../../shared/discord-pages.js';
import { pictureKind, webpFirstFrame } from './picture-still.js';

export { pictureKind };

const log = createLogger('banner-text');

export const DRAWN_PREFIX = 'banner-text-';
/** Wider than any banner Discord shows, at twice its size for sharp screens. */
export const MAX_WIDTH = 1100;
const QUALITY = 82;
/** Raised whenever the drawing itself changes, so banners drawn the old way are drawn again. */
const VERSION = 2;
const WORKER_MS = 180_000;

let store = null;
const drawings = () => store?.get().blocks || {};

/** A picture's width and height, from the first bytes of its file. */
export function pictureSize(data, ext) {
  const b = Buffer.from(data);
  if (ext === 'png' && b.length > 24) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (ext === 'gif' && b.length > 10) return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (ext === 'webp' && b.length > 30) {
    const chunk = b.toString('latin1', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const marker = b[i + 1];
      // The frame's header: any SOF but the ones that are tables.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}


/** The size it is drawn at: as it is, or narrower if it is wider than anybody sees. */
export const drawnSize = ({ width, height }) => (width > MAX_WIDTH
  ? { width: MAX_WIDTH, height: Math.max(1, Math.round((height * MAX_WIDTH) / width)) }
  : { width, height });

/** An upload as its file is now (size and time), so a picture replaced under the same name is drawn again. */
function fileNow(src) {
  if (!src?.startsWith('/media/')) return '';
  try {
    const stat = fs.statSync(path.join(config.assetsDir, path.basename(decodeURIComponent(src))));
    return `${stat.size}:${Math.round(stat.mtimeMs)}`;
  } catch {
    return '';
  }
}

/** What a block's words and picture inside are, as drawn: blank when there is nothing of either. */
const looks = (block) => {
  const caption = cleanCaption(block.caption);
  const inset = cleanInset(block.inset);
  return { caption: caption.text.trim() ? caption : null, inset: inset.image ? inset : null };
};

/** What names a drawing: the pictures (and, for uploads, their files as they are now) and how it is all set. */
function keyOf(block) {
  const { caption, inset } = looks(block);
  return crypto.createHash('sha1')
    .update(JSON.stringify([VERSION, block.image, fileNow(block.image), caption, inset, fileNow(inset?.image)]))
    .digest('hex').slice(0, 20);
}

const drawnFile = (name) => path.join(config.assetsDir, name);
/** The drawing already made for this block as it is now, if there is one. */
export function drawnAlready(block) {
  const key = keyOf(block);
  for (const ext of ['png', 'webp']) {
    const name = `${DRAWN_PREFIX}${key}.${ext}`;
    if (fs.existsSync(drawnFile(name))) return name;
  }
  return null;
}

const ALIGN = { left: 'flex-start', center: 'center', right: 'flex-end' };
const AT = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

/**
 * What goes over the banner, laid out at this size: a satori tree. `inset` is
 * the picture inside, ready to draw ({ src, width, height } as it is, and
 * where and how big). With `background`, the banner itself is drawn under it all.
 */
export function bannerTree({ caption, inset }, width, height, background = null) {
  const children = [];
  if (background) children.push({ type: 'img', props: { src: background, width, height, style: { position: 'absolute', left: 0, top: 0, width, height } } });
  if (inset) {
    const h = Math.max(1, Math.round((height * inset.size) / 100));
    const w = Math.max(1, Math.round((h * inset.width) / inset.height));
    children.push({
      type: 'img',
      props: {
        src: inset.src, width: w, height: h,
        style: { position: 'absolute', left: Math.round((width * inset.x) / 100 - w / 2), top: Math.round((height * inset.y) / 100 - h / 2), width: w, height: h },
      },
    });
  }
  const style = {
    display: 'flex', flexDirection: 'column', position: 'relative', width, height,
    padding: `${Math.round(height * 0.08)}px ${Math.round(width * 0.05)}px`,
  };
  if (caption) {
    const fontSize = Math.max(8, Math.round((height * caption.size) / 100));
    const known = CARD_FACES.includes(caption.font) || cardFonts().some((f) => f.name === caption.font);
    const words = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          fontFamily: known ? caption.font : 'Montserrat',
          fontWeight: caption.weight,
          fontSize,
          lineHeight: 1.15,
          color: caption.color,
          textAlign: caption.align,
          whiteSpace: 'pre-wrap',
          ...(caption.shadow ? { textShadow: `0 ${Math.max(1, Math.round(fontSize * 0.04))}px ${Math.max(2, Math.round(fontSize * 0.18))}px rgba(0,0,0,0.6)` } : {}),
          ...(caption.outline ? { WebkitTextStroke: `${Math.max(1, Math.round(fontSize * 0.06))}px rgba(0,0,0,0.85)` } : {}),
        },
        children: caption.text,
      },
    };
    if (caption.x !== null && caption.y !== null) {
      /*
        Dragged: their middle where they were dropped. Centred in a box four
        times the banner's size whose middle is that spot — the same in the
        screen's CSS, and needing no measuring of the words first.
      */
      const bw = width * 4;
      const bh = height * 4;
      children.push({
        type: 'div',
        props: {
          style: {
            position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center',
            left: Math.round((width * caption.x) / 100 - bw / 2), top: Math.round((height * caption.y) / 100 - bh / 2), width: bw, height: bh,
          },
          children: words,
        },
      });
    } else {
      Object.assign(style, { justifyContent: AT[caption.at], alignItems: ALIGN[caption.align] });
      children.push(words);
    }
  }
  return { type: 'div', props: { style, children } };
}

const svgOf = (tree, width, height) => satori(tree, { width, height, fonts: cardFonts(), loadAdditionalAsset: emojiAsset });

/** What goes over a moving banner, see-through around it, as RGBA with colour not multiplied by how solid it is. */
async function overPixels(parts, width, height) {
  const rendered = new Resvg(await svgOf(bannerTree(parts, width, height), width, height), { fitTo: { mode: 'original' } }).render();
  const px = new Uint8Array(rendered.pixels);
  // resvg hands colour multiplied by alpha; laying it over wants it as it is.
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a > 0 && a < 255) for (let c = 0; c < 3; c += 1) px[i + c] = Math.min(255, Math.round((px[i + c] * 255) / a));
  }
  return px;
}

/** The picture inside, ready to draw: a data URL the drawing reads, and its size. A WebP's first frame becomes a PNG. */
async function insetPicture(picture) {
  if (picture.ext === 'webp') {
    const still = await webpFirstFrame(picture.data);
    if (!still) throw refusal('banner_inset_unreadable', 'the picture inside the banner cannot be read');
    return { src: `data:image/png;base64,${still.png.toString('base64')}`, width: still.width, height: still.height };
  }
  const size = pictureSize(picture.data, picture.ext);
  if (!size?.width || !size?.height) throw refusal('banner_inset_unreadable', 'the picture inside the banner cannot be read');
  return { src: `data:${picture.type};base64,${Buffer.from(picture.data).toString('base64')}`, ...size };
}

/** One banner drawn at a time: each takes the memory of all its frames. */
let queue = Promise.resolve();
const inFlight = new Map();

/** A drawing in a worker; `stoppable` is handed a way to stop it half done. */
function inWorker(workerData, stoppable) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./banner-text-worker.js', import.meta.url), { workerData });
    let over = false;
    const end = (settle, value) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      worker.terminate();
      settle(value);
    };
    const timer = setTimeout(() => end(reject, new Error('drawing the banner took too long')), WORKER_MS);
    stoppable?.(() => end(reject, refusal('banner_superseded', 'a newer change to the banner is being drawn')));
    worker.once('message', (m) => (m?.error ? end(reject, new Error(m.error)) : end(resolve, m)));
    worker.once('error', (err) => end(reject, err));
    worker.once('exit', (code) => end(reject, new Error(`the drawing stopped (${code})`)));
  });
}

/** The moving banner being drawn for the screen, by block, and how to stop it once a newer look is asked for. */
const drawingNow = new Map();

async function draw(block, load, key, { preview = false } = {}) {
  const picture = pictureKind(await load(block.image));
  const size = pictureSize(picture.data, picture.ext);
  if (!size?.width || !size?.height) throw refusal('banner_text_unreadable', 'the banner\'s picture cannot be read to draw on');
  const { width, height } = drawnSize(size);
  const { caption, inset } = looks(block);
  const parts = { caption, inset: inset ? { ...inset, ...(await insetPicture(pictureKind(await load(inset.image)))) } : null };
  const started = Date.now();
  let name;
  let frames = 1;
  if (picture.ext === 'png' || picture.ext === 'jpg') {
    const background = `data:${picture.type};base64,${Buffer.from(picture.data).toString('base64')}`;
    const png = new Resvg(await svgOf(bannerTree(parts, width, height, background), width, height), { fitTo: { mode: 'original' } }).render().asPng();
    name = `${DRAWN_PREFIX}${key}.png`;
    fs.writeFileSync(drawnFile(name), png);
  } else {
    const over = await overPixels(parts, width, height);
    let done;
    try {
      done = await inWorker({ data: picture.data, kind: picture.ext, width, height, words: over, quality: QUALITY }, (stop) => {
        if (preview) drawingNow.set(block.id, { key, stop });
      });
    } finally {
      if (drawingNow.get(block.id)?.key === key) drawingNow.delete(block.id);
    }
    frames = done.frames;
    name = `${DRAWN_PREFIX}${key}.webp`;
    fs.writeFileSync(drawnFile(name), Buffer.from(done.bytes));
  }
  log.info(`drew on a banner: ${width}x${height}, ${frames} frame${frames === 1 ? '' : 's'}, ${Date.now() - started} ms`);
  return { name, width, height, frames };
}

/** A block's drawing is this one now: the one it had before goes, unless another block has it too. */
function remember(blockId, name) {
  if (!store || !blockId) return;
  const all = { ...drawings() };
  const old = all[blockId];
  if (old === name) return;
  all[blockId] = name;
  store.set({ blocks: all });
  if (old && !Object.values(all).includes(old)) fs.rm(drawnFile(old), { force: true }, () => {});
}

/** The newest look the screen asked to see, by block: one still waiting behind a newer one is not drawn. */
const wanted = new Map();

/**
 * The banner with its words and picture drawn on, as an upload's address:
 * drawn now, or the drawing already made. `load(src)` reads a picture as
 * { data, ext, type } (only when it has to be drawn). `preview` is the
 * screen asking while it is edited — typing a word at a time would otherwise
 * queue a drawing for each. Returns { src, name, drawn }.
 */
export async function drawBanner(block, load, { preview = false } = {}) {
  if (!bannerDrawn(block)) throw refusal('banner_text_none', 'the banner has nothing to draw on it');
  const ready = drawnAlready(block);
  if (ready) {
    remember(block.id, ready);
    return { src: `/media/${ready}`, name: ready, drawn: false };
  }
  const key = keyOf(block);
  wanted.set(block.id, key);
  // A drawing for the screen of how this banner looked a moment ago is stopped: it would take seconds to show what is already gone.
  const stale = drawingNow.get(block.id);
  if (stale && stale.key !== key) stale.stop();
  if (!inFlight.has(key)) {
    const job = queue.then(() => {
      if (preview && wanted.get(block.id) !== key) throw refusal('banner_superseded', 'a newer change to the banner is being drawn');
      return draw(block, load, key, { preview });
    });
    queue = job.catch(() => {});
    inFlight.set(key, job);
    job.finally(() => inFlight.delete(key)).catch(() => {});
  }
  const made = await inFlight.get(key);
  remember(block.id, made.name);
  return { src: `/media/${made.name}`, name: made.name, drawn: true, width: made.width, height: made.height, frames: made.frames };
}

/** Only these blocks still exist: the drawings of any other go, and so does any drawing nothing has. */
export function keepDrawings(blockIds) {
  if (!store) return;
  const keep = new Set(blockIds);
  const all = Object.fromEntries(Object.entries(drawings()).filter(([id]) => keep.has(id)));
  store.set({ blocks: all });
  const kept = new Set(Object.values(all));
  let names = [];
  try { names = fs.readdirSync(config.assetsDir); } catch { return; }
  for (const name of names) {
    if (name.startsWith(DRAWN_PREFIX) && !kept.has(name)) fs.rm(drawnFile(name), { force: true }, () => {});
  }
}

export const _test = { drawingNow };

export function initBannerText() {
  store = collection('banner_text', { blocks: {} });
}
