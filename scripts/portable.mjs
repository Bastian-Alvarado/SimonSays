#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A portable build (3.0.0): SimonSays as one folder that runs on a computer
 * that never had Node — what the installer puts on it, and a zip for those
 * who would rather unzip.
 *
 *   node scripts/portable.mjs [folder] [--platform win32|linux|darwin] [--arch x64|arm64]
 *                             [--out <dir>] [--installed] [--no-tray] [--no-zip] [--no-check]
 *
 * `folder` is the app — the public edition's clone, built — and defaults to
 * this one. The build is, in <out>/SimonSays:
 *
 *   node/          the official Node (scripts/portable-node.json: one version, and the
 *                  SHA-256 of each platform's archive; a download that differs is refused)
 *   start.js …     the app, as an update package ships it (scripts/app-files.mjs)
 *   server/node_modules
 *                  its dependencies, from its package-lock.json, for the platform built
 *                  for (npm's --os and --cpu pick the native pieces: @resvg/resvg-js
 *                  draws the welcome card, @snazzah/davey speaks Discord's voice), with
 *                  no package's install scripts run
 *   SimonSays.exe  the tray (tray/, Rust): starts it with that Node, with no console, and
 *                  opens, restarts and stops it; built here with cargo (--no-tray leaves it out)
 *   SimonSays.cmd  (simonsays.sh elsewhere) starts it with that Node in a console, for when
 *                  the tray is not wanted, or to watch what it says
 *   portable.json  what was built: the version, platform, arch and Node
 *
 * --installed adds installed.json beside start.js: a copy the installer made,
 * whose things live in the user's own folder (start.js, homeFor). Without it
 * a portable copy keeps them in its own folder, as a zip copy always has.
 *
 * Built for this computer's own platform, it is then started once, on its own
 * Node, with nothing else on the PATH and a home of its own in a temporary
 * folder, and must answer /api/health with its version (--no-check skips it).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appVersion, appEntries, webNotReady } from './app-files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const valued = ['--platform', '--arch', '--out'];
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const flag = (name) => args.includes(name);
const folder = path.resolve(args.find((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1])) || path.join(here, '..'));
const platform = opt('--platform', process.platform);
const arch = opt('--arch', process.arch);

const fail = (why) => { console.error(`portable: ${why}`); process.exit(1); };
const say = (...words) => console.log('portable:', ...words);

if (!['win32', 'linux', 'darwin'].includes(platform)) fail(`no build for platform ${platform}`);
if (!['x64', 'arm64'].includes(arch)) fail(`no build for arch ${arch}`);
const version = appVersion(folder);
if (!version) fail(`${folder} has no shared/version.js`);
const notReady = webNotReady(folder, version);
if (notReady) fail(notReady);

// ---------------------------------------------------------------- the Node it carries

const pin = JSON.parse(fs.readFileSync(path.join(here, 'portable-node.json'), 'utf8'));
const key = `${{ win32: 'win', linux: 'linux', darwin: 'darwin' }[platform]}-${arch}`;
const sum = pin.sha256?.[key];
if (!pin.version || !sum) fail(`scripts/portable-node.json pins no Node for ${key}`);
const archive = `node-v${pin.version}-${key}.${platform === 'win32' ? 'zip' : platform === 'linux' ? 'tar.xz' : 'tar.gz'}`;
const cache = path.join(os.tmpdir(), 'simonsays-portable-cache');
fs.mkdirSync(cache, { recursive: true });
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function nodeArchive() {
  const at = path.join(cache, archive);
  if (fs.existsSync(at) && sha256(fs.readFileSync(at)) === sum) return at;
  const url = `https://nodejs.org/dist/v${pin.version}/${archive}`;
  say(`downloading ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok) fail(`nodejs.org answered ${res.status} for ${archive}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== sum) fail(`${archive} is not the one pinned: its SHA-256 is ${got}, not ${sum}`);
  fs.writeFileSync(at, buf);
  return at;
}

/** Windows' own tar reads and writes zips; elsewhere, unzip and zip. */
const winTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const run = (cmd, argv, options = {}) => {
  const r = spawnSync(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...options });
  if (r.status !== 0) fail(`${path.basename(cmd)} ${argv.slice(0, 3).join(' ')} failed: ${(r.stderr || r.stdout || r.error?.message || '').trim().slice(-800)}`);
  return r;
};
function unpack(file, into) {
  fs.mkdirSync(into, { recursive: true });
  if (file.endsWith('.zip')) {
    if (process.platform === 'win32') run(winTar, ['-xf', file, '-C', into]);
    else run('unzip', ['-q', file, '-d', into]);
  } else {
    run('tar', ['-xf', file, '-C', into]);
  }
}

// ---------------------------------------------------------------- the build

const out = path.resolve(opt('--out', path.join(os.tmpdir(), `simonsays-portable-${version}-${key}`)));
const app = path.join(out, 'SimonSays');
fs.rmSync(app, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });

const started = Date.now();
const unpacked = path.join(out, '.node');
fs.rmSync(unpacked, { recursive: true, force: true });
unpack(await nodeArchive(), unpacked);
const nodeFrom = path.join(unpacked, `node-v${pin.version}-${key}`);
const nodeExe = platform === 'win32' ? 'node.exe' : 'node';
fs.mkdirSync(path.join(app, 'node'), { recursive: true });
fs.copyFileSync(path.join(nodeFrom, platform === 'win32' ? nodeExe : path.join('bin', nodeExe)), path.join(app, 'node', nodeExe));
fs.copyFileSync(path.join(nodeFrom, 'LICENSE'), path.join(app, 'node', 'LICENSE'));
if (platform !== 'win32') fs.chmodSync(path.join(app, 'node', nodeExe), 0o755);
fs.rmSync(unpacked, { recursive: true, force: true });
say(`Node ${pin.version} for ${key}, its SHA-256 as pinned`);

const entries = appEntries(folder);
if (!entries.some((e) => e.path === 'server/package-lock.json')) fail('the server has no package-lock.json');
for (const e of entries) {
  const to = path.join(app, e.path);
  if (e.dir) fs.mkdirSync(to, { recursive: true });
  else fs.copyFileSync(e.abs, to);
}
if (flag('--installed')) fs.writeFileSync(path.join(app, 'installed.json'), `${JSON.stringify({ home: 'user', version }, null, 2)}\n`);

// Its dependencies, for the platform built for: npm picks the native pieces by --os and --cpu.
say(`installing the server's dependencies for ${platform}-${arch}`);
// One command line: Windows runs npm through its shell, and nothing in it comes from outside (the platform and arch are checked above).
run(`npm ci --omit=dev --ignore-scripts --no-audit --no-fund --os=${platform} --cpu=${arch}`, [], { cwd: path.join(app, 'server'), shell: true });
// The native pieces are there: one of each package's builds for this platform.
for (const pkg of ['@resvg/resvg-js', '@snazzah/davey']) {
  const dir = path.join(app, 'server', 'node_modules', ...pkg.split('/'));
  if (!fs.existsSync(dir)) continue;
  const builds = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).optionalDependencies || {}).filter((n) => n.includes(`-${platform}-${arch}`));
  if (builds.length && !builds.some((n) => fs.existsSync(path.join(app, 'server', 'node_modules', ...n.split('/'))))) fail(`${pkg} has no build for ${platform}-${arch} installed`);
}

/*
  Types and source maps are for editors, not for running: left out of the packages. The build is
  smaller, and its paths shorter — a Windows install still has to keep every path under 260
  characters, and the longest are deep in node_modules. The longest left is held to MAX_PATH_IN,
  room enough under Local AppData\Programs\SimonSays for any user name.
*/
const MAX_PATH_IN = 170;
let pruned = 0;
const prune = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const at = path.join(dir, e.name);
    if (e.isDirectory()) prune(at);
    else if (/\.d\.[cm]?ts$|\.map$/.test(e.name)) { pruned += fs.statSync(at).size; fs.rmSync(at); }
  }
};
prune(path.join(app, 'server', 'node_modules'));
const longest = (dir, rel = '') => fs.readdirSync(dir, { withFileTypes: true }).reduce((best, e) => {
  const r = rel ? `${rel}\\${e.name}` : e.name;
  const deeper = e.isDirectory() ? longest(path.join(dir, e.name), r) : r;
  return deeper.length > best.length ? deeper : best;
}, rel);
const deepest = longest(app);
if (deepest.length > MAX_PATH_IN) fail(`a path in the build is ${deepest.length} characters, more than ${MAX_PATH_IN}: ${deepest}`);
say(`left out ${(pruned / 1024 / 1024).toFixed(1)} MB of types and source maps; the longest path is ${deepest.length} characters`);

if (platform === 'win32') {
  fs.writeFileSync(path.join(app, 'SimonSays.cmd'), [
    '@echo off',
    'rem Starts SimonSays on the Node in this folder. Close this window to stop it.',
    'title SimonSays',
    'cd /d "%~dp0"',
    '"%~dp0node\\node.exe" "%~dp0start.js"',
    '',
  ].join('\r\n'));
} else {
  fs.writeFileSync(path.join(app, 'simonsays.sh'), [
    '#!/bin/sh',
    '# Starts SimonSays on the Node in this folder. Ctrl+C stops it.',
    'cd "$(dirname "$0")" || exit 1',
    'exec ./node/node ./start.js',
    '',
  ].join('\n'), { mode: 0o755 });
}
// The tray, for Windows: built from this folder's tray/, on Windows, for its own arch.
if (platform === 'win32' && !flag('--no-tray')) {
  const tray = path.join(folder, 'tray');
  if (!fs.existsSync(path.join(tray, 'Cargo.toml'))) fail(`${folder} has no tray/ to build SimonSays.exe from (or --no-tray)`);
  if (process.platform !== 'win32' || arch !== process.arch) fail(`the tray is built on Windows for its own arch, not for ${arch} on ${process.platform}-${process.arch} (or --no-tray)`);
  say('building the tray');
  run('cargo build --release --locked', [], { cwd: tray, shell: true });
  fs.copyFileSync(path.join(tray, 'target', 'release', 'SimonSays.exe'), path.join(app, 'SimonSays.exe'));
}
fs.writeFileSync(path.join(app, 'portable.json'), `${JSON.stringify({ version, platform, arch, node: pin.version, builtAt: new Date().toISOString() }, null, 2)}\n`);

const sizeOf = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? sizeOf(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
say(`built ${app} (${mb(sizeOf(app))})`);

// ---------------------------------------------------------------- it starts

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

/** Inside the check, refusals are thrown, so the build that is running is stopped first. */
const bad = (why) => { const err = new Error(why); err.code = 'ERR_PORTABLE'; throw err; };

async function check() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-portable-check-'));
  const envFile = path.join(home, 'empty.env');
  fs.writeFileSync(envFile, '');
  const port = await freePort();
  // Nothing but the system on the PATH: it has to run on its own Node.
  const system = process.platform === 'win32' ? [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'), process.env.SystemRoot || 'C:\\Windows'] : ['/usr/bin', '/bin'];
  const env = {
    PATH: system.join(path.delimiter), SystemRoot: process.env.SystemRoot || '', TEMP: os.tmpdir(), TMP: os.tmpdir(), HOME: home, USERPROFILE: home,
    SIMONSAYS_HOME: home, ENV_FILE: envFile, PORT: String(port), HOST: '127.0.0.1', AUTO_START: 'false', OBS_AUTOCONNECT: 'false',
  };
  const child = spawn(path.join(app, 'node', nodeExe), [path.join(app, 'start.js')], { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let said = '';
  child.stdout.on('data', (d) => { said += d; });
  child.stderr.on('data', (d) => { said += d; });
  const stop = () => {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  };
  try {
    const until = Date.now() + 90_000;
    while (Date.now() < until) {
      if (child.exitCode !== null) bad(`the build stopped as it started:\n${said.slice(-1500)}`);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
        const health = await res.json();
        if (health.version !== version) bad(`the build says it is ${health.version}, not ${version}`);
        if (!fs.existsSync(path.join(home, 'data'))) bad('the build did not keep its data in the home it was given');
        return Math.round((Date.now() - (until - 90_000)) / 1000);
      } catch (err) {
        if (err?.code === 'ERR_PORTABLE') throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    bad(`the build did not answer within 90 s:\n${said.slice(-1500)}`);
  } finally {
    stop();
    await new Promise((r) => setTimeout(r, 800));
    try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* a file still held; the temp folder is cleaned in time */ }
  }
  return 0;
}

if (flag('--no-check')) say('not started: --no-check');
else if (platform !== process.platform || arch !== process.arch) say(`not started: built for ${platform}-${arch} on ${process.platform}-${process.arch}`);
else {
  try { say(`started on its own Node and answered in ${await check()} s`); } catch (err) { fail(err.message); }
}

// ---------------------------------------------------------------- the zip

if (!flag('--no-zip')) {
  const zip = path.join(out, `SimonSays-${version}-${key}.zip`);
  fs.rmSync(zip, { force: true });
  if (process.platform === 'win32') run(winTar, ['-a', '-cf', zip, '-C', out, 'SimonSays']);
  else run('zip', ['-qry', zip, 'SimonSays'], { cwd: out });
  say(`zipped ${zip} (${mb(fs.statSync(zip).size)})`);
}
say(`done in ${Math.round((Date.now() - started) / 1000)} s`);
