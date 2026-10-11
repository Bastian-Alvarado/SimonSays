/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The release package's format: a gzipped tar, written by the release script
 * and read by the updater. Node has gzip but no tar, and a copy of the app
 * may run where the system has no tar either (or one that reads Windows
 * paths its own way), so both ends are here, and both only do what the
 * package needs: files and folders, in POSIX ustar, with paths that fit its
 * 255-byte name.
 */
import zlib from 'node:zlib';

const BLOCK = 512;

function header(name, size, type, mode) {
  const h = Buffer.alloc(BLOCK, 0);
  let prefix = '';
  let base = name;
  // ustar keeps up to 100 bytes of name and 155 of prefix, split at a slash.
  if (Buffer.byteLength(base) > 100) {
    const at = name.lastIndexOf('/', name.length - 1);
    let cut = -1;
    for (let i = at; i > 0; i = name.lastIndexOf('/', i - 1)) {
      if (Buffer.byteLength(name.slice(i + 1)) <= 100 && Buffer.byteLength(name.slice(0, i)) <= 155) { cut = i; break; }
    }
    if (cut < 0) throw new Error(`a path too long for the package: ${name}`);
    prefix = name.slice(0, cut);
    base = name.slice(cut + 1);
  }
  h.write(base, 0, 100, 'utf8');
  h.write(mode.toString(8).padStart(7, '0') + '\0', 100, 8, 'ascii');
  h.write('0000000\0', 108, 8, 'ascii');
  h.write('0000000\0', 116, 8, 'ascii');
  h.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  h.write('00000000000\0', 136, 12, 'ascii');
  h.write('        ', 148, 8, 'ascii');
  h.write(type, 156, 1, 'ascii');
  h.write('ustar\0', 257, 6, 'ascii');
  h.write('00', 263, 2, 'ascii');
  h.write(prefix, 345, 155, 'utf8');
  let sum = 0;
  for (let i = 0; i < BLOCK; i += 1) sum += h[i];
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return h;
}

/** Files ({ path, data }) and folders ({ path, dir: true }) as a gzipped tar. Paths use forward slashes, relative. */
export function packTarGz(entries) {
  const parts = [];
  for (const e of entries) {
    const name = String(e.path).replace(/\\/g, '/').replace(/^\.?\//, '');
    if (!name || name.split('/').includes('..')) throw new Error(`not a path for the package: ${e.path}`);
    if (e.dir) {
      parts.push(header(name.endsWith('/') ? name : `${name}/`, 0, '5', 0o755));
      continue;
    }
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data ?? '');
    parts.push(header(name, data.length, '0', 0o644), data);
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(BLOCK * 2, 0));
  return zlib.gzipSync(Buffer.concat(parts), { level: 9 });
}

const text = (buf, from, len) => {
  const raw = buf.subarray(from, from + len);
  const end = raw.indexOf(0);
  return raw.subarray(0, end < 0 ? raw.length : end).toString('utf8');
};

/**
 * A gzipped tar's files and folders, read without writing anything: each
 * { path, dir } or { path, data }. Refuses a path that would climb out of
 * the folder it is unpacked into, or one written as absolute.
 */
export function unpackTarGz(gz) {
  const buf = zlib.gunzipSync(gz);
  const out = [];
  let at = 0;
  while (at + BLOCK <= buf.length) {
    const h = buf.subarray(at, at + BLOCK);
    if (h.every((b) => b === 0)) break;
    const name = text(h, 0, 100);
    const prefix = text(h, 345, 155);
    const path = (prefix ? `${prefix}/${name}` : name).replace(/\\/g, '/');
    const size = parseInt(text(h, 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    let sum = 0;
    for (let i = 0; i < BLOCK; i += 1) sum += i >= 148 && i < 156 ? 32 : h[i];
    if (sum !== parseInt(text(h, 148, 8).trim(), 8)) throw new Error('the package is damaged (a header does not add up)');
    if (!path || path.startsWith('/') || /^[a-zA-Z]:/.test(path) || path.split('/').includes('..')) throw new Error(`the package has a path it may not: ${path}`);
    at += BLOCK;
    if (type === '5') out.push({ path: path.replace(/\/$/, ''), dir: true });
    else if (type === '0' || type === '\0') out.push({ path, data: Buffer.from(buf.subarray(at, at + size)) });
    // Anything else (links, devices) is not something the package holds.
    at += Math.ceil(size / BLOCK) * BLOCK;
  }
  return out;
}
