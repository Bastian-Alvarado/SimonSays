/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * HTTP surface: a small read-mostly REST API, asset uploads, and static
 * hosting for the built config UI.
 *
 * The REST API exists so you can check on the stack from a phone, a terminal
 * or a monitoring script without speaking the WebSocket protocol:
 *   curl localhost:8081/api/health
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { fontFamilyName } from '../../shared/chat-style.js';
import { ASSET_KINDS as KINDS } from '../../shared/asset-kinds.js';
import { createLogger } from '../core/logger.js';
import { getRecentLogs } from '../core/logger.js';
import { bus, EVENTS, normaliseChat, normaliseEvent } from '../core/bus.js';
import { queueDepths } from '../core/queue.js';
import * as engine from '../engine/index.js';
import * as leveling from '../leveling/index.js';
import * as twitch from '../platforms/twitch.js';
import * as tiktok from '../platforms/tiktok.js';
import * as discord from '../platforms/discord.js';
import * as obs from '../platforms/obs.js';
import * as spotify from '../platforms/spotify.js';
import * as youtube from '../platforms/youtube.js';
import { VERSION } from '../../shared/version.js';

const log = createLogger('http');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.m4a': 'audio/mp4',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
};

const startedAt = Date.now();

export function createHttpServer({ webRoot } = {}) {
  return http.createServer(async (req, res) => {
    // The UI may be served by Vite on another origin during development.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    // Nothing here is for a search engine: the dashboard has no sign-in, so it must never be found by one.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // Said the old way too, for a crawler that reads only this.
    if (url.pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('User-agent: *\nDisallow: /\n');
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        await handleApi(req, res, url);
      } catch (err) {
        const status = err.statusCode ?? 500;
        if (status >= 500) log.error(`${req.method} ${url.pathname}:`, err);
        // A code, where there is one, lets the screen say it in its own language.
        json(res, status, { error: err.message, ...(err.code && typeof err.code === 'string' && !err.code.startsWith('E') ? { code: err.code } : {}), ...(err.vars ? { vars: err.vars } : {}) });
      }
      return;
    }

    // User-uploaded media lives under /media/, deliberately NOT /assets/ —
    // Vite emits the built bundle into /assets/, and routing that here would
    // shadow the app's own JavaScript with the uploads directory.
    // Ahead of the /media/ file lookup: this one is generated, not a file.
    if (url.pathname === '/media/fonts.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(fontFaceCss());
      return;
    }

    if (url.pathname.startsWith('/media/')) {
      serveFile(res, path.join(config.assetsDir, url.pathname.slice('/media/'.length)), config.assetsDir, { req, freshFor: 30 });
      return;
    }

    // Tag text files, so OBS can point a Text source at an HTTP URL too.
    if (url.pathname.startsWith('/tags/')) {
      const tagsDir = path.join(config.dataDir, 'tags');
      serveFile(res, path.join(tagsDir, path.basename(url.pathname)), tagsDir, { req });
      return;
    }

    if (webRoot) { serveStatic(res, webRoot, url.pathname, req); return; }

    // No build present. Someone opening this port during development would
    // otherwise get a bare {"error":"Not found"} and reasonably conclude the
    // whole thing is broken, so say what is actually going on.
    if (url.pathname === '/') { serveDevHint(res); return; }

    json(res, 404, { error: 'Not found' });
  });
}

// --------------------------------------------------------------------- API

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  // Asset routes carry the filename in the path, so they cannot be a plain
  // switch case.
  if (url.pathname.startsWith('/api/assets/')) {
    const name = decodeURIComponent(url.pathname.slice('/api/assets/'.length));
    if (req.method === 'POST') return json(res, 200, await saveAsset(req, name));
    if (req.method === 'DELETE') return json(res, 200, deleteAsset(name));
  }

  switch (route) {
    case 'GET /api/assets':
      return json(res, 200, listAssets());

    case 'GET /api/health':
      return json(res, 200, {
        ok: true,
        uptimeMs: Date.now() - startedAt,
        // The app's version (shared/version.js). It said 3 before 1.0.0: the rewrite, not a version.
        version: VERSION,
        platforms: {
          twitch: twitch.getStatus(),
          tiktok: tiktok.getStatus(),
          discord: discord.getStatus(),
          obs: obs.getStatus(),
          spotify: spotify.getStatus(),
          youtube: youtube.getStatus(),
        },
        queues: queueDepths(),
      });

    case 'GET /api/snapshot':
      return json(res, 200, engine.snapshot());

    case 'GET /api/commands':
      return json(res, 200, engine.snapshot().commands);

    case 'GET /api/actions':
      return json(res, 200, engine.snapshot().streamActions);

    case 'GET /api/alerts':
      return json(res, 200, engine.snapshot().alertConfigs);

    case 'GET /api/events':
      return json(res, 200, engine.snapshot().eventHistory);

    case 'GET /api/tags':
      return json(res, 200, engine.snapshot().streamTags);

    case 'GET /api/leaderboard':
      return json(res, 200, leveling.leaderboard(Number(url.searchParams.get('limit')) || 50));

    case 'GET /api/logs':
      return json(res, 200, getRecentLogs(Number(url.searchParams.get('limit')) || 200));

    case 'POST /api/actions/run': {
      const body = await readJson(req);
      await engine.testAction(body.id);
      return json(res, 200, { ok: true });
    }

    // Inject synthetic activity so you can lay out a chat dock or alert
    // overlay without waiting to go live. Localhost only — this drives the
    // real pipeline, so it must not be reachable from the network.
    case 'POST /api/test/chat': {
      requireLocal(req);
      const b = await readJson(req);
      bus.emit(EVENTS.CHAT, normaliseChat({
        platform: b.platform || 'twitch',
        user: b.user || 'TestViewer',
        userId: b.userId || 'test-1',
        msg: b.msg ?? 'Hello from the test endpoint!',
        color: b.color || '#9146FF',
        // Twitch's emote tag, as id → ["start-end"], to lay out emotes too.
        emotes: b.emotes && typeof b.emotes === 'object' ? b.emotes : undefined,
        avatar: b.avatar,
        isMod: Boolean(b.isMod),
        highlighted: Boolean(b.highlighted),
        // Lets the reward-with-text path be exercised without a real
        // redemption: a chat line carrying this is the duplicate a surface
        // showing the event is expected to drop.
        rewardId: b.rewardId || null,
        isSub: Boolean(b.isSub),
        isVip: Boolean(b.isVip),
        isBroadcaster: Boolean(b.isBroadcaster),
      }));
      return json(res, 200, { ok: true });
    }

    case 'POST /api/test/event': {
      requireLocal(req);
      const b = await readJson(req);
      if (!b.type) return json(res, 400, { error: '`type` is required (e.g. twitch_follow)' });
      bus.emit(EVENTS.EVENT, normaliseEvent({
        type: b.type,
        platform: b.platform || String(b.type).split('_')[0],
        user: b.user || 'TestViewer',
        data: b.data || {},
        avatar: b.avatar,
      }));
      return json(res, 200, { ok: true });
    }

    default:
      return json(res, 404, { error: `No route for ${route}` });
  }
}

// ------------------------------------------------------------------ assets
//
// User-supplied images, used today as Dock Actions button backgrounds. They
// are written into `assetsDir` and served from /media/, so a button stores a
// short path rather than a data URL — a handful of inlined images would
// otherwise bloat the config that every client receives in full on connect.

/** What may be uploaded, and how big each kind may be (shared/asset-kinds.js, which the screen checks too). */
const ASSET_KINDS = Object.fromEntries(Object.entries(KINDS).map(([kind, spec]) => [kind, { exts: new Set(spec.exts), max: spec.max }]));
/** Past this, an upload that is already too big is cut off rather than read to its end: nobody sends this much by mistake. */
const DRAIN_AT_MOST = 200 * 1024 * 1024;

/** Which kind an extension belongs to, or null if we do not accept it. */
function assetKind(ext) {
  for (const [kind, spec] of Object.entries(ASSET_KINDS)) if (spec.exts.has(ext)) return kind;
  return null;
}

const ACCEPTED_EXTENSIONS = new Set(Object.values(ASSET_KINDS).flatMap((k) => [...k.exts]));

/**
 * Reduce an arbitrary client-supplied name to something safe to write.
 *
 * Takes the basename so `../../.env` cannot escape the directory, keeps only
 * characters that are unambiguous on every filesystem, and insists on an
 * image extension — this endpoint is reachable by anything on the LAN, so it
 * must not become a way to drop arbitrary files on the host.
 */
function safeAssetName(raw) {
  const name = String(raw || '');

  // A name containing separators or `..` is refused outright rather than
  // quietly reduced to its basename. Taking the basename would contain it —
  // it lands in the assets folder either way — but answering 200 to a
  // traversal probe tells the prober their request was accepted.
  if (/[\\/]/.test(name) || name.includes('..')) return null;

  const base = path.basename(name).replace(/[^\w.-]+/g, '_');
  const ext = path.extname(base).toLowerCase();
  if (!base || base.startsWith('.') || !ACCEPTED_EXTENSIONS.has(ext)) return null;
  return base.slice(0, 120);
}

/**
 * A stylesheet declaring every uploaded font.
 *
 * Generated rather than wired through each surface: one link in the page
 * head makes uploaded fonts work on the overlay, the dock, the alerts and
 * the canvas at once, and a font uploaded later needs no client change to
 * be usable — a reload picks it up.
 */
function fontFaceCss() {
  let out = '/* Uploaded fonts. Generated; do not edit. */\n';
  for (const asset of listAssets()) {
    if (asset.kind !== 'font') continue;
    const family = fontFamilyName(asset.name);
    if (!family) continue;
    out += `@font-face { font-family: "${family}"; src: url("${asset.url}"); font-display: swap; }\n`;
  }
  return out;
}

function listAssets() {
  try {
    return fs.readdirSync(config.assetsDir)
      // Banners drawn on for Discord pages (engine/banner-text.js) are kept here but are not uploads.
      .filter((f) => ACCEPTED_EXTENSIONS.has(path.extname(f).toLowerCase()) && !f.startsWith('banner-text-'))
      .map((f) => {
        const stat = fs.statSync(path.join(config.assetsDir, f));
        return { name: f, url: `/media/${encodeURIComponent(f)}`, size: stat.size, kind: assetKind(path.extname(f).toLowerCase()) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    log.warn('could not list assets:', err.message);
    return [];
  }
}

/** Body is the raw file; the name comes from the path. No multipart needed. */
function saveAsset(req, rawName) {
  const name = safeAssetName(rawName);
  if (!name) {
    const err = new Error('Asset must be a plain filename ending in an image, audio, video or font extension (png, jpg, gif, webp, svg, mp3, ogg, wav, m4a, webm, mp4, woff2, woff, ttf, otf)');
    err.statusCode = 400;
    err.code = 'upload_type';
    throw err;
  }

  // The cap follows the kind, so a video is not held to an image budget.
  const MAX_ASSET_BYTES = ASSET_KINDS[assetKind(path.extname(name).toLowerCase())].max;

  /*
    A file too big is read to its end and thrown away, then refused. Cutting
    the connection while the browser was still sending left it with nothing
    but "Failed to fetch" — the reason never arrived.
  */
  const tooBig = () => {
    const err = new Error(`File is larger than ${MAX_ASSET_BYTES / 1024 / 1024}MB`);
    err.statusCode = 413;
    err.code = 'upload_too_big';
    err.vars = { mb: MAX_ASSET_BYTES / 1024 / 1024 };
    return err;
  };
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let over = Number(req.headers['content-length']) > MAX_ASSET_BYTES;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_ASSET_BYTES) over = true;
      if (over) {
        chunks.length = 0;
        if (size > DRAIN_AT_MOST) { req.destroy(); reject(tooBig()); }
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (over) { reject(tooBig()); return; }
      if (!size) { const e = new Error('Empty upload'); e.statusCode = 400; e.code = 'upload_empty'; reject(e); return; }
      try {
        fs.writeFileSync(path.join(config.assetsDir, name), Buffer.concat(chunks));
        log.info(`stored asset ${name} (${Math.round(size / 1024)}KB)`);
        resolve({ name, url: `/media/${encodeURIComponent(name)}`, size });
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function deleteAsset(rawName) {
  const name = safeAssetName(rawName);
  if (!name) { const e = new Error('Unknown asset'); e.statusCode = 400; throw e; }
  const target = path.join(config.assetsDir, name);
  // Belt and braces on top of safeAssetName: never delete outside the folder.
  if (!path.resolve(target).startsWith(path.resolve(config.assetsDir))) {
    const e = new Error('Forbidden'); e.statusCode = 403; throw e;
  }
  try {
    fs.unlinkSync(target);
    return { ok: true, name };
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: true, name };
    throw err;
  }
}

/**
 * Shown at `/` when the server is running but the UI has not been built.
 * The server is healthy in this state — the UI just lives on Vite's port.
 */
function serveDevHint(res) {
  const html = `<!doctype html>
<meta charset="utf-8">
<title>SimonSays server is running</title>
<style>
  :root { color-scheme: dark }
  body { background:#09090b; color:#e4e4e7; font:16px/1.6 system-ui,sans-serif;
         display:grid; place-items:center; min-height:100vh; margin:0; padding:2rem }
  main { max-width:34rem }
  h1 { color:#f43f5e; font-size:1.5rem; margin:0 0 .5rem }
  code { background:#18181b; padding:.15em .4em; border-radius:4px; color:#fda4af }
  a { color:#f43f5e }
  ul { padding-left:1.2rem } li { margin:.4rem 0 }
  .ok { color:#4ade80 }
</style>
<main>
  <h1>SimonSays server is running</h1>
  <p class="ok">The backend is healthy. It just has no UI build to serve yet.</p>
  <ul>
    <li><strong>In development</strong>, the interface is on
        <a href="http://localhost:5173">http://localhost:5173</a> — this port is the API.</li>
    <li><strong>For a single-port setup</strong>, build the UI once with
        <code>npm run build</code>, then restart. This page is replaced by the app.</li>
  </ul>
  <p>API check: <a href="/api/health">/api/health</a></p>
</main>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/** Throw unless the request came from this machine. */
function requireLocal(req) {
  const addr = req.socket.remoteAddress || '';
  const local = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
  if (!local) {
    const err = new Error('Test endpoints are only available from localhost');
    err.statusCode = 403;
    throw err;
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      // Refuse unbounded bodies rather than buffering them into memory.
      if (raw.length > 1_000_000) { req.destroy(); reject(new Error('Body too large')); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

// ------------------------------------------------------------------ statics

function serveStatic(res, root, pathname, req) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const target = path.join(root, rel);

  /*
    An address with nothing behind it gets the app all the same, which then
    says the page does not exist — with a 404, so a browser and anything
    checking a link know it too. The app itself is only ever at / (and
    /index.html, a file): every page OBS shows is /?mode=, and every sign-in
    comes back to the address it left from.
  */
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    serveFile(res, path.join(root, 'index.html'), undefined, { req, status: 404 });
    return;
  }
  serveFile(res, target, root, { req });
}

/**
 * Send a file, and let a browser that already has it keep it.
 *
 * Every response used to carry the bytes, with nothing to say the file had not
 * changed — so an overlay showing a clip on a follow alert re-downloaded the
 * whole thing on every follow, off whatever machine is running the server, on
 * every surface drawing alerts at once. A twenty-megabyte clip makes that
 * obvious; it was true of every image already.
 *
 * Revalidation rather than a long life, because an uploaded file keeps its own
 * name: replacing alert.gif writes over the old one at the same address, so a
 * browser told to keep it for a year would show the old one for a year. A
 * conditional request answers in a couple of hundred bytes instead of twenty
 * megabytes, and a replaced file appears immediately.
 *
 * @param {number} freshFor Seconds a browser may reuse it without asking at
 *        all. Small: it saves the round trip for alerts firing back to back,
 *        and is the longest anybody waits to see a file they just replaced.
 * @param {number} status 200, or 404 for the app sent in place of a page
 *        that does not exist — never answered as "unchanged", since that
 *        would say the address is fine.
 */
function serveFile(res, filePath, root, { req = null, freshFor = 0, status = 200 } = {}) {
  const resolved = path.resolve(filePath);

  // Directory traversal guard: a request must not escape its root.
  const base = path.resolve(root ?? path.dirname(resolved));
  if (!resolved.startsWith(base)) { json(res, 403, { error: 'Forbidden' }); return; }

  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    json(res, 404, { error: 'Not found' });
    return;
  }

  const stat = fs.statSync(resolved);
  const type = MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
  /* Size and time together: either changing is a different file. */
  const tag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  // HTTP dates carry whole seconds, so the comparison is made in whole seconds.
  const modified = Math.floor(stat.mtimeMs / 1000) * 1000;

  const headers = {
    'Content-Type': type,
    ETag: tag,
    'Last-Modified': new Date(modified).toUTCString(),
    'Cache-Control': freshFor > 0 ? `public, max-age=${freshFor}` : 'no-cache',
  };

  const asked = req?.headers?.['if-none-match'];
  const since = req?.headers?.['if-modified-since'];
  const unchanged = (asked && asked === tag)
    || (!asked && since && new Date(since).getTime() >= modified);
  if (unchanged && status === 200) {
    res.writeHead(304, headers);
    res.end();
    return;
  }

  headers['Content-Length'] = stat.size;
  res.writeHead(status, headers);
  fs.createReadStream(resolved).pipe(res);
}
