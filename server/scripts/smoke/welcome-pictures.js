/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: pictures in welcome and goodbye posts — a large picture from
 * the uploads goes with the post as a file (Discord cannot reach this
 * server), and a WebP background, or one named .png that is really a WebP,
 * is drawn on the picture card instead of leaving it blank.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After welcome-card.js.
 */

import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import Module from 'wasm-webp/dist/esm/webp-wasm.js';
import { assert, bus, fs, test } from './harness.js';

const welcome = await import('../../engine/welcome.js');
const card = await import('../../engine/welcome-card.js');
const { config } = await import('../../config.js');
const webp = await Module();

const solid = (w, h, colour) => new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${colour}"/></svg>`).render().asPng();
const put = (name, data) => fs.writeFileSync(path.join(config.assetsDir, name), data);
const large = solid(300, 100, '#ff8800');
put('wp-large.png', large);
const green = new Uint8Array(200 * 100 * 4);
for (let i = 0; i < green.length; i += 4) { green[i + 1] = 220; green[i + 3] = 255; }
put('wp-bg-really-webp.png', Buffer.from(webp.encode(green, 200, 100, true, { lossless: 1, quality: 100 })));

// ---------------------------------------------------------------- the upload goes with the post

const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('/guilds/g1?with_counts=true')) return new Response(JSON.stringify({ approximate_member_count: 12, name: 'SimonSays', owner_id: '1' }), { status: 200 });
  if ((init.method || 'GET') === 'POST' && /\/channels\/56\/messages$/.test(u)) {
    const form = init.body instanceof FormData ? init.body : null;
    sent.push({
      body: form ? JSON.parse(form.get('payload_json')) : JSON.parse(init.body || '{}'),
      files: form ? [...form.keys()].filter((k) => k.startsWith('files[')).map((k) => ({ name: form.get(k).name, size: form.get(k).size })) : [],
    });
  }
  return new Response(JSON.stringify({ id: 'posted2' }), { status: 200 });
};
const realToken = config.discord.botToken;
config.discord.botToken = 'test-token';
welcome.setGreetings({
  welcome: { enabled: true, channelId: '56', messages: [], sendCard: true, cardTitle: 'Hola', cardImage: '/media/wp-large.png', react: '' },
  goodbye: { enabled: true, channelId: '56', messages: [], sendCard: true, cardTitle: 'Adiós', cardImage: '/media/wp-gone.png', react: '' },
});
bus.emit('discord:member_join', { guild_id: 'g1', user: { id: '4242424243', username: 'nueva' } });
await new Promise((r) => setTimeout(r, 1500));
bus.emit('discord:member_leave', { guild_id: 'g1', user: { id: '4242424244', username: 'ida' } });
await new Promise((r) => setTimeout(r, 1500));
config.discord.botToken = realToken;
globalThis.fetch = realFetch;
welcome.setGreetings({ welcome: { enabled: false }, goodbye: { enabled: false } });

// ---------------------------------------------------------------- a WebP background is drawn

const pixelsOf = (png) => {
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  return { w, h, px: new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="data:image/png;base64,${png.toString('base64')}" width="${w}" height="${h}"/></svg>`).render().pixels };
};
const withWebp = pixelsOf((await card.renderCard({ enabled: true, showAvatar: false, title: '', name: '', subtitle: '', background: '/media/wp-bg-really-webp.png' }, { name: 'Ana' }, {})).png);
const without = pixelsOf((await card.renderCard({ enabled: true, showAvatar: false, title: '', name: '', subtitle: '' }, { name: 'Ana' }, {})).png);
const at = ({ w, px }, x, y) => [...px.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];

for (const f of ['wp-large.png', 'wp-bg-really-webp.png']) fs.rmSync(path.join(config.assetsDir, f), { force: true });

test('a large picture from the uploads goes with the welcome as a file, and one gone leaves the post without it', () => {
  const [joined, left] = sent;
  assert.ok(joined, 'nothing was posted for the join');
  assert.deepEqual(joined.files.map((f) => f.name), ['picture.png']);
  assert.equal(joined.files[0].size, large.length, 'the file sent is not the upload');
  assert.equal(joined.body.embeds[0].image.url, 'attachment://picture.png');
  assert.ok(left, 'the goodbye was not posted for want of its picture');
  assert.deepEqual(left.files, []);
  assert.equal(left.body.embeds[0].image, undefined, 'an upload that is gone was sent as an address Discord cannot reach');
});

test('a WebP background — even one named .png — is drawn on the card, not left out', () => {
  const [r, g, b] = at(withWebp, Math.round(withWebp.w * 0.9), Math.round(withWebp.h * 0.2));
  assert.ok(g > 120 && g > r * 2 && g > b * 2, `the background is not the green picture: ${[r, g, b]}`);
  assert.notDeepEqual(at(without, Math.round(without.w * 0.9), Math.round(without.h * 0.2)), [r, g, b]);
});
