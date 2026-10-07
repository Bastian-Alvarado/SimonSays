/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: words and a picture drawn into a Discord page's banner
 * (server/engine/banner-text.js and its worker) — what a banner keeps, a
 * still banner coming back a PNG with the words and the picture where they
 * were put, a moving one coming back a moving WebP with every frame drawn on
 * and its timing kept, a wide one made narrower, the same banner never drawn
 * twice and an older drawing cleared away, the drawing being what goes up,
 * a page kept up to date not sent again for it, and drawings kept out of the
 * uploads list.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After live-pages.js.
 */

import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import Module from 'wasm-webp/dist/esm/webp-wasm.js';
import { assert, collection, fs, test } from './harness.js';

const pages = await import('../../engine/discord-pages.js');
const banner = await import('../../engine/banner-text.js');
const shared = await import('../../../shared/discord-pages.js');
const { encodeGif } = await import('../../../shared/gif.js');
const { createHttpServer } = await import('../../api/http.js');
const { config } = await import('../../config.js');
const webp = await Module();

const solid = (w, h, colour) => new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${colour}"/></svg>`).render().asPng();
/** A PNG's pixels, read back by drawing it. */
const pixelsOf = (png, w, h) => new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="data:image/png;base64,${Buffer.from(png).toString('base64')}" width="${w}" height="${h}"/></svg>`).render().pixels;
const at = (px, w, x, y) => [...px.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];
const whitish = (px) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 220 && px[i + 1] > 220 && px[i + 2] > 220) n += 1; return n; };
const put = (name, data) => fs.writeFileSync(path.join(config.assetsDir, name), data);
const drawnBytes = (src) => fs.readFileSync(path.join(config.assetsDir, path.basename(src)));

put('bt-blue.png', solid(400, 100, '#1020c0'));
put('bt-red.png', solid(40, 40, '#ff0000'));
put('bt-wide.png', solid(2200, 200, '#103010'));
// A WebP under a .png name, as pictures saved from the web often are.
const green = new Uint8Array(40 * 40 * 4);
for (let i = 0; i < green.length; i += 4) { green[i + 1] = 255; green[i + 3] = 255; }
put('bt-green-really-webp.png', Buffer.from(webp.encode(green, 40, 40, true, { lossless: 1, quality: 100 })));
// Three frames of one colour each, a tenth, a fifth and three tenths of a second.
const frame = (r, g, b) => { const px = new Uint8Array(200 * 60 * 4); for (let i = 0; i < px.length; i += 4) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; } return px; };
put('bt-moving.gif', Buffer.from(encodeGif({ width: 200, height: 60, frames: [{ rgba: frame(200, 0, 0), ms: 100 }, { rgba: frame(0, 160, 0), ms: 200 }, { rgba: frame(0, 0, 200), ms: 300 }] })));

// ---------------------------------------------------------------- what a banner keeps

const kept = shared.cleanBlock({ id: 'k', type: 'banner', image: '/media/bt-blue.png', caption: { text: 'a\nb\nc\nd', size: 500, weight: 650, at: 'sideways', color: 'red', font: 'x"}body{' }, inset: { image: 'javascript:1', x: -5, y: 140, size: 1 } });
const plain = shared.cleanBlock({ id: 'p', type: 'banner', image: '/media/bt-blue.png' });

// ---------------------------------------------------------------- drawing

const load = pages.loadPicture;
const still = await banner.drawBanner({ id: 'bt-1', type: 'banner', image: '/media/bt-blue.png', caption: { text: 'HOLA', size: 50 } }, load);
const stillPx = pixelsOf(drawnBytes(still.src), 400, 100);
const stillAgain = await banner.drawBanner({ id: 'bt-1', type: 'banner', image: '/media/bt-blue.png', caption: { text: 'HOLA', size: 50 } }, load);
const changed = await banner.drawBanner({ id: 'bt-1', type: 'banner', image: '/media/bt-blue.png', caption: { text: 'ADIOS', size: 50 } }, load);
await new Promise((r) => setTimeout(r, 100));
const oldGone = !fs.existsSync(path.join(config.assetsDir, still.name));

// Words dragged to a quarter across, halfway down.
const placed = await banner.drawBanner({ id: 'bt-7', type: 'banner', image: '/media/bt-blue.png', caption: { text: 'MM', size: 40, weight: 900, x: 25, y: 50 } }, load);
const placedPx = pixelsOf(drawnBytes(placed.src), 400, 100);
const whiteBox = (px, w, h) => {
  let x0 = w; let x1 = 0; let y0 = h; let y1 = 0;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = (y * w + x) * 4;
    if (px[i] > 230 && px[i + 1] > 230 && px[i + 2] > 230) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { middle: [(x0 + x1) / 2, (y0 + y1) / 2], right: x1 };
};
const inset = await banner.drawBanner({ id: 'bt-2', type: 'banner', image: '/media/bt-blue.png', inset: { image: '/media/bt-red.png', x: 20, y: 50, size: 60 } }, load);
const insetPx = pixelsOf(drawnBytes(inset.src), 400, 100);

const misnamed = await banner.drawBanner({ id: 'bt-6', type: 'banner', image: '/media/bt-blue.png', inset: { image: '/media/bt-green-really-webp.png', x: 80, y: 50, size: 60 } }, load);
const misnamedPx = pixelsOf(drawnBytes(misnamed.src), 400, 100);
const wide = await banner.drawBanner({ id: 'bt-3', type: 'banner', image: '/media/bt-wide.png', caption: { text: 'Ancho' } }, load);
const wideSize = banner.pictureSize(drawnBytes(wide.src), 'png');

const moving = await banner.drawBanner({ id: 'bt-4', type: 'banner', image: '/media/bt-moving.gif', caption: { text: 'MMMM', size: 60 } }, load);
const movingFrames = webp.decodeAnimation(new Uint8Array(drawnBytes(moving.src)), true);

// A bigger moving banner, so its drawing is still going when a newer look is asked for.
const big = (r, g, b) => { const px = new Uint8Array(900 * 300 * 4); for (let i = 0; i < px.length; i += 4) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; } return px; };
put('bt-slow.gif', Buffer.from(encodeGif({ width: 900, height: 300, frames: Array.from({ length: 12 }, (_, i) => ({ rgba: big(20 * i, 40, 90), ms: 80 })) })));
const older = banner.drawBanner({ id: 'bt-8', type: 'banner', image: '/media/bt-slow.gif', caption: { text: 'Uno' } }, load, { preview: true }).then(() => 'drawn', (err) => err.code);
for (let i = 0; i < 200 && !banner._test.drawingNow.has('bt-8'); i += 1) await new Promise((r) => setTimeout(r, 20));
const wasDrawing = banner._test.drawingNow.has('bt-8');
const newer = await banner.drawBanner({ id: 'bt-8', type: 'banner', image: '/media/bt-slow.gif', caption: { text: 'Dos' } }, load, { preview: true });
const olderEnded = await older;

let none = null;
try { await banner.drawBanner({ id: 'bt-5', type: 'banner', image: '/media/bt-blue.png', caption: { text: '   ' } }, load); } catch (err) { none = err.code; }

// ---------------------------------------------------------------- posting it

const calls = [];
let nextId = 9500;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.includes('discord.com/api')) return realFetch(url, init);
  const method = init.method || 'GET';
  const route = u.replace(/^.*\/api\/v10/, '');
  let body = null;
  let files = [];
  if (init.body instanceof FormData) {
    body = JSON.parse(init.body.get('payload_json'));
    files = [...init.body.keys()].filter((k) => k.startsWith('files[')).map((k) => ({ name: init.body.get(k).name, size: init.body.get(k).size }));
  } else if (typeof init.body === 'string') body = JSON.parse(init.body);
  calls.push({ method, route, body, files });
  if (method === 'POST' && /\/messages$/.test(route)) return new Response(JSON.stringify({ id: String(nextId += 1) }), { status: 200 });
  if (method === 'PATCH') return new Response(JSON.stringify({ id: route.split('/').pop() }), { status: 200 });
  return new Response(null, { status: 204 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';

const page = pages.savePage({
  name: 'Con texto', channelId: '700000000000000300', style: 'single', live: true,
  blocks: [{ id: 'bt-post', type: 'banner', image: '/media/bt-blue.png', caption: { text: 'Bienvenido!', weight: 300 } }, { type: 'text', text: 'Hola' }],
});
const first = await pages.postPage(page.id);
const sent = calls.at(-1);
const drawnForPost = banner.drawnAlready(pages.snapshot().discordPages.find((p) => p.id === page.id).blocks[0]);
const drawnForPostSize = drawnForPost ? drawnBytes(`/media/${drawnForPost}`).length : -1;
const again = await pages.postPage(page.id);
const liveEdits = await pages.refreshLive(Date.now() + 10 * 60_000);
await pages.unpostPage(page.id);
pages.removePage(page.id);

globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;

// ---------------------------------------------------------------- not an upload

const server = createHttpServer({ webRoot: config.assetsDir });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const listed = await (await realFetch(`http://127.0.0.1:${server.address().port}/api/assets`)).json();
await new Promise((r) => server.close(r));

banner.keepDrawings([]);
await new Promise((r) => setTimeout(r, 100));
const leftOver = fs.readdirSync(config.assetsDir).filter((f) => f.startsWith(banner.DRAWN_PREFIX));
for (const f of ['bt-blue.png', 'bt-red.png', 'bt-wide.png', 'bt-moving.gif', 'bt-green-really-webp.png', 'bt-slow.gif']) fs.rmSync(path.join(config.assetsDir, f), { force: true });
collection('banner_text', { blocks: {} }).set({ blocks: {} });

test('a banner keeps its words and picture inside within bounds, and one from before them is kept as it was', () => {
  assert.equal(kept.caption.text, 'a\nb\nc', 'more than three lines were kept');
  assert.equal(kept.caption.size, 60);
  assert.equal(kept.caption.weight, 400);
  assert.equal(kept.caption.at, 'middle');
  assert.equal(kept.caption.color, '#ffffff');
  assert.equal(kept.caption.font, 'Montserrat', 'a font name that is more than a name was kept');
  assert.deepEqual(kept.inset, { image: '', x: 0, y: 100, size: 5 });
  assert.deepEqual(Object.keys(plain), ['id', 'type', 'image'], 'a banner without words grew settings, and its post would be edited for nothing');
  assert.equal(shared.bannerDrawn(kept), true);
  assert.equal(shared.bannerDrawn(plain), false);
  assert.equal(none, 'banner_text_none');
});

test('a still banner comes back a PNG of its size with the words on it, and is not drawn twice', () => {
  assert.match(still.src, /^\/media\/banner-text-[0-9a-f]{20}\.png$/);
  assert.equal(still.drawn, true);
  assert.ok(whitish(stillPx) > 300, 'no words were drawn');
  assert.deepEqual(at(stillPx, 400, 5, 5), [16, 32, 192], 'the picture itself changed away from the words');
  assert.equal(stillAgain.drawn, false);
  assert.equal(stillAgain.src, still.src);
  assert.notEqual(changed.src, still.src);
  assert.ok(oldGone, 'the block\'s older drawing was left behind');
});

test('words dragged by hand are drawn with their middle where they were dropped; half a place is no place', () => {
  const { middle, right } = whiteBox(placedPx, 400, 100);
  assert.ok(Math.abs(middle[0] - 100) <= 3 && Math.abs(middle[1] - 50) <= 4, `their middle is at ${middle}`);
  assert.ok(right < 200, 'they reach past the middle of the banner');
  assert.deepEqual([shared.cleanCaption({ x: 30 }).x, shared.cleanCaption({ x: 30, y: 'x' }).y], [null, null]);
  assert.deepEqual([shared.cleanCaption({ x: -4, y: 140.04 }).x, shared.cleanCaption({ x: -4, y: 140.04 }).y], [0, 100]);
});

test('the picture inside sits where it was put, at its size', () => {
  // Its middle at a fifth across and half down; 60 high on a banner of 100.
  assert.deepEqual(at(insetPx, 400, 80, 50), [255, 0, 0]);
  assert.deepEqual(at(insetPx, 400, 80, 25), [255, 0, 0]);
  assert.deepEqual(at(insetPx, 400, 80, 15), [16, 32, 192], 'it is taller than it was set');
  assert.deepEqual(at(insetPx, 400, 300, 50), [16, 32, 192]);
});

test('a picture is drawn as what it is, not what its name says: a WebP named .png still shows', () => {
  assert.deepEqual(at(misnamedPx, 400, 320, 50), [0, 255, 0], 'the misnamed picture inside was not drawn');
  assert.equal(banner.pictureKind({ data: Buffer.from('RIFF\0\0\0\0WEBPVP8 '), ext: 'png', type: 'image/png' }).ext, 'webp');
});

test('a moving banner comes back a moving WebP, every frame drawn on and its timing kept; a wide one is made narrower', () => {
  assert.match(moving.src, /\.webp$/);
  assert.equal(movingFrames.length, 3);
  assert.deepEqual(movingFrames.map((f) => f.duration), [100, 200, 300]);
  for (const f of movingFrames) assert.ok(whitish(f.data) > 200, 'a frame has no words');
  const corner = (f) => [...f.data.slice(0, 3)];
  assert.ok(corner(movingFrames[0])[0] > 150 && corner(movingFrames[1])[1] > 120 && corner(movingFrames[2])[2] > 150, 'the frames are not their own colours any more');
  assert.deepEqual([wide.drawn, wideSize], [true, { width: 1100, height: 100 }]);
});

test('a newer look of a banner stops the screen\'s drawing of the older one half done', () => {
  assert.equal(wasDrawing, true, 'the older drawing never got going');
  assert.equal(olderEnded, 'banner_superseded');
  assert.equal(newer.drawn, true);
  assert.equal(banner._test.drawingNow.has('bt-8'), false);
});

test('the drawing is what goes up, and posting or keeping it up to date again draws and sends nothing new', () => {
  assert.equal(first.done, 'posted');
  assert.deepEqual(sent.files.map((f) => f.name), ['banner-0.png']);
  assert.equal(sent.files[0].size, drawnForPostSize, 'the banner went up without its words');
  assert.equal(sent.body.components[0].items[0].media.url, 'attachment://banner-0.png');
  assert.equal(again.done, 'updated');
  assert.equal(liveEdits, 0, 'a page kept up to date was sent again for its drawn banner');
});

test('drawings are kept out of the uploads list, and go when no block has them', () => {
  assert.ok(Array.isArray(listed) && listed.some((a) => a.name === 'bt-blue.png'));
  assert.ok(!listed.some((a) => a.name.startsWith('banner-text-')), 'a drawing is listed as an upload');
  assert.deepEqual(leftOver, []);
});
