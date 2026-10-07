/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A picture as the drawing (satori and resvg) can take it: what it really
 * is, read from its first bytes, and a WebP — which resvg cannot read —
 * turned into a PNG of its first frame. For the banners on Discord pages and
 * the welcome card alike.
 *
 * A file's name is not trusted: pictures saved from the web are often WebPs
 * called .png, and drawn as what the name says they draw as nothing.
 */
import zlib from 'node:zlib';

const KINDS = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

/** What the bytes are: png, jpg, gif, webp, svg — or null when they say nothing. */
export function kindOfBytes(data) {
  const b = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (/^\s*(<\?xml|<svg)/i.test(b.toString('utf8', 0, 200))) return 'svg';
  return null;
}

/** A picture { data, ext, type } with its kind put right from its bytes. */
export function pictureKind(picture) {
  const ext = kindOfBytes(picture.data) || picture.ext;
  return { ...picture, ext, type: KINDS[ext] || picture.type };
}

/** A PNG of RGBA pixels, unfiltered. */
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function pngOf(rgba, width, height) {
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8;
  head[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

let webpModule = null;
/** A WebP's first frame as a PNG, with its size; null if it cannot be read. */
export async function webpFirstFrame(data) {
  webpModule ||= await (await import('wasm-webp/dist/esm/webp-wasm.js')).default();
  const frames = webpModule.decodeAnimation(new Uint8Array(data), true);
  const first = frames?.get ? frames.get(0) : frames?.[0];
  if (!first?.width) return null;
  return { png: pngOf(new Uint8Array(first.data), first.width, first.height), width: first.width, height: first.height };
}

/**
 * A picture's bytes as a data URL the drawing can read: as it is, labelled
 * as what it really is, or — a WebP — its first frame as a PNG. `type` is
 * what it was said to be, used when the bytes say nothing.
 */
export async function drawableDataUrl(data, type = 'image/png') {
  const kind = kindOfBytes(data);
  if (kind === 'webp') {
    const still = await webpFirstFrame(data);
    return still ? `data:image/png;base64,${still.png.toString('base64')}` : null;
  }
  return `data:${KINDS[kind] || type};base64,${Buffer.from(data).toString('base64')}`;
}
