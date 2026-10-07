/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: uploads (server/api/http.js, shared/asset-kinds.js) — a
 * picture up to 5 MB is kept, and one too big is
 * answered with why, whether or not it said its size first, instead of the
 * connection being cut while it was still being sent (which a browser shows
 * only as "Failed to fetch").
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import path from 'node:path';
import { assert, fs, test } from './harness.js';

const { createHttpServer } = await import('../../api/http.js');
const { ASSET_KINDS, assetKindOf } = await import('../../../shared/asset-kinds.js');
const { PAGE_LIMITS } = await import('../../../shared/discord-pages.js');
const { config } = await import('../../config.js');

const server = createHttpServer({ webRoot: config.assetsDir });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/api/assets/`;
const MB = 1024 * 1024;

const send = async (name, bytes, { stream = false } = {}) => {
  const body = stream
    // No size said first: the server only finds out as the file arrives.
    ? new ReadableStream({ start(c) { for (let at = 0; at < bytes.length; at += MB) c.enqueue(bytes.subarray(at, at + MB)); c.close(); } })
    : bytes;
  const res = await fetch(base + encodeURIComponent(name), { method: 'POST', body, ...(stream ? { duplex: 'half' } : {}) });
  return { status: res.status, body: await res.json() };
};

const banner = await send('up-banner.webp', Buffer.alloc(4 * MB, 1));
const kept = fs.existsSync(path.join(config.assetsDir, 'up-banner.webp')) && fs.statSync(path.join(config.assetsDir, 'up-banner.webp')).size;
let big = null;
let bigStreamed = null;
let bigFont = null;
let failed = null;
try {
  big = await send('up-huge.png', Buffer.alloc(6 * MB, 1));
  bigStreamed = await send('up-huge-2.gif', Buffer.alloc(6 * MB, 1), { stream: true });
  bigFont = await send('up-font.ttf', Buffer.alloc(3 * MB, 1));
} catch (err) {
  failed = err.cause?.code || err.message;
}
const leftBehind = ['up-huge.png', 'up-huge-2.gif', 'up-font.ttf'].filter((f) => fs.existsSync(path.join(config.assetsDir, f)));
fs.rmSync(path.join(config.assetsDir, 'up-banner.webp'), { force: true });
await new Promise((r) => server.close(r));

test('a picture up to 5 MB can be uploaded, which Discord takes from a bot too', () => {
  assert.equal(ASSET_KINDS.image.max, 5 * MB);
  assert.ok(ASSET_KINDS.image.max <= PAGE_LIMITS.fileBytes, 'an upload could be too big for Discord');
  assert.equal(banner.status, 200);
  assert.equal(kept, 4 * MB);
});

test('a file too big is answered with why — not cut off mid-send — and not kept', () => {
  assert.equal(failed, null, `the connection was cut instead of answered: ${failed}`);
  assert.deepEqual([big.status, big.body.code, big.body.vars], [413, 'upload_too_big', { mb: 5 }]);
  assert.deepEqual([bigStreamed.status, bigStreamed.body.code], [413, 'upload_too_big'], 'without its size said first');
  assert.deepEqual([bigFont.status, bigFont.body.vars], [413, { mb: 2 }]);
  assert.deepEqual(leftBehind, []);
});

test('the screen knows the same kinds and sizes, to say so before sending', () => {
  assert.deepEqual([assetKindOf('a.WEBP'), assetKindOf('x.mp4'), assetKindOf('f.woff2'), assetKindOf('n.exe'), assetKindOf('none')], ['image', 'video', 'font', null, null]);
  const hook = fs.readFileSync(new URL('../../../web/hooks/useStreamSystem.ts', import.meta.url), 'utf8');
  assert.match(hook, /assetKindOf\(file\.name\)/, 'the upload no longer checks the size before sending');
});
