/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Words laid over every frame of a banner, off the main thread: a picture of
 * a few dozen frames takes seconds to write, and the server goes on with the
 * stream meanwhile. Started by banner-text.js, one picture each.
 *
 * In: the picture's bytes and kind (gif or webp), the size to draw it at, and
 * the words already drawn as see-through RGBA at that size. Out: a WebP —
 * moving if the picture moved, which Discord plays — and how many frames.
 */
import { parentPort, workerData } from 'node:worker_threads';
import omggif from 'omggif';
import Module from 'wasm-webp/dist/esm/webp-wasm.js';

/** Every frame whole, as it is seen: a GIF's frames are patches over what came before. */
function gifFrames(data) {
  const gif = new omggif.GifReader(data);
  const { width, height } = gif;
  const canvas = new Uint8Array(width * height * 4);
  const out = [];
  for (let i = 0; i < gif.numFrames(); i += 1) {
    const info = gif.frameInfo(i);
    const before = info.disposal === 3 ? canvas.slice() : null;
    gif.decodeAndBlitFrameRGBA(i, canvas);
    // A delay of nothing is shown by browsers as a tenth of a second.
    const ms = info.delay > 1 ? info.delay * 10 : 100;
    out.push({ rgba: canvas.slice(), width, height, ms });
    if (info.disposal === 2) {
      for (let y = info.y; y < info.y + info.height; y += 1) canvas.fill(0, (y * width + info.x) * 4, (y * width + info.x + info.width) * 4);
    } else if (before) {
      canvas.set(before);
    }
  }
  return out;
}

function webpFrames(webp, data) {
  const decoded = webp.decodeAnimation(data, true);
  const out = [];
  const count = decoded?.size ? decoded.size() : decoded?.length || 0;
  for (let i = 0; i < count; i += 1) {
    const f = decoded.get ? decoded.get(i) : decoded[i];
    out.push({ rgba: new Uint8Array(f.data), width: f.width, height: f.height, ms: f.duration || 100 });
  }
  return out;
}

/**
 * Smaller, each new pixel the average of the ones it covers (parts of pixels
 * counted by how much), across and then down. Colour is weighed by how
 * solid it is, so a see-through edge does not darken.
 */
function shrink(src, sw, sh, dw, dh) {
  if (sw === dw && sh === dh) return src;
  const weights = (from, to) => {
    const scale = from / to;
    const out = [];
    for (let d = 0; d < to; d += 1) {
      const start = d * scale;
      const end = start + scale;
      const parts = [];
      for (let s = Math.floor(start); s < Math.min(from, Math.ceil(end)); s += 1) {
        const w = Math.min(end, s + 1) - Math.max(start, s);
        if (w > 0) parts.push(s, w / scale);
      }
      out.push(parts);
    }
    return out;
  };
  const across = weights(sw, dw);
  const down = weights(sh, dh);
  const mid = new Float32Array(dw * sh * 4);
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const parts = across[x];
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let p = 0; p < parts.length; p += 2) {
        const i = (y * sw + parts[p]) * 4;
        const w = parts[p + 1] * src[i + 3];
        r += src[i] * w; g += src[i + 1] * w; b += src[i + 2] * w; a += w;
      }
      const o = (y * dw + x) * 4;
      mid[o] = r; mid[o + 1] = g; mid[o + 2] = b; mid[o + 3] = a;
    }
  }
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const parts = down[y];
    for (let x = 0; x < dw; x += 1) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let p = 0; p < parts.length; p += 2) {
        const i = (parts[p] * dw + x) * 4;
        const w = parts[p + 1];
        r += mid[i] * w; g += mid[i + 1] * w; b += mid[i + 2] * w; a += mid[i + 3] * w;
      }
      const o = (y * dw + x) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
      out[o + 3] = Math.min(255, Math.round(a));
    }
  }
  return out;
}

/**
 * The last frame shown as long as it should be. libwebp, as packaged, writes
 * every frame's time but the last one's, which it makes the average of the
 * others; the rest are right, so the last is what is left of the whole.
 * Frames are found by walking the file's chunks, not by looking for their
 * name, which could turn up inside a picture.
 */
function lastFrameFor(bytes, total) {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length);
  const frames = [];
  for (let at = 12; at + 8 <= b.length;) {
    const size = b.readUInt32LE(at + 4);
    if (b.toString('latin1', at, at + 4) === 'ANMF') frames.push(at + 8 + 12);
    at += 8 + size + (size % 2);
  }
  if (frames.length < 2) return bytes;
  const before = frames.slice(0, -1).reduce((sum, at) => sum + b.readUIntLE(at, 3), 0);
  const last = total - before;
  if (last > 0 && last < 0x1000000) b.writeUIntLE(last, frames.at(-1), 3);
  return bytes;
}

/** The words over a frame, in place. */
function lay(frame, words) {
  for (let i = 0; i < frame.length; i += 4) {
    const a = words[i + 3];
    if (a === 0) continue;
    const k = a / 255;
    const under = frame[i + 3] / 255;
    const alpha = k + under * (1 - k);
    for (let c = 0; c < 3; c += 1) frame[i + c] = Math.round((words[i + c] * k + frame[i + c] * under * (1 - k)) / alpha);
    frame[i + 3] = Math.round(alpha * 255);
  }
  return frame;
}

const { data, kind, width, height, words, quality } = workerData;
try {
  const webp = await Module();
  const frames = kind === 'gif' ? gifFrames(new Uint8Array(data)) : webpFrames(webp, new Uint8Array(data));
  if (!frames.length) throw new Error('the picture has no frames');
  const drawn = frames.map((f) => ({ rgba: lay(shrink(f.rgba, f.width, f.height, width, height), words), ms: f.ms }));
  // RGBA in, always: libwebp leaves the see-through part out by itself when nothing is see-through.
  const config = { lossless: 0, quality };
  let bytes;
  if (drawn.length === 1) {
    bytes = webp.encode(drawn[0].rgba, width, height, true, config);
  } else {
    const list = new webp.VectorWebPAnimationFrame();
    for (const f of drawn) list.push_back({ duration: f.ms, data: f.rgba, config, has_config: true });
    bytes = webp.encodeAnimation(width, height, true, list);
    if (bytes?.length) bytes = lastFrameFor(new Uint8Array(bytes), drawn.reduce((sum, f) => sum + f.ms, 0));
  }
  if (!bytes?.length) throw new Error('the picture could not be written');
  const copy = new Uint8Array(bytes);
  parentPort.postMessage({ bytes: copy, frames: drawn.length }, [copy.buffer]);
} catch (err) {
  parentPort.postMessage({ error: err.message || String(err) });
}
