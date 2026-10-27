#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * SimonSays as an AppImage (3.1): one file a Linux desktop runs with a
 * double-click, from a Linux build of scripts/portable.mjs.
 *
 *   node scripts/appimage.mjs <linux build's SimonSays folder> [--out <dir>] [--no-check]
 *
 * Runs on Linux, with mksquashfs (squashfs-tools), and nothing of the app's
 * but this file: the release runs it on a Linux machine with the build's own
 * Node. The build becomes the AppImage's folder as it is — Node, the app,
 * its packages, installed.json, so what is the streamer's lives in
 * ~/.local/share/simonsays — with installer/linux/AppRun to start it and a
 * menu entry and icon. The AppImage runtime is one release of
 * AppImage/type2-runtime (scripts/appimage-runtime.json, checksum pinned).
 *
 * Then it is started once, on a home of its own, and must answer
 * /api/health with its version (--no-check skips it).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const fail = (why) => { console.error(`appimage: ${why}`); process.exit(1); };
const say = (...w) => console.log('appimage:', ...w);

if (process.platform !== 'linux') fail('an AppImage is made on Linux');
if (spawnSync('mksquashfs', ['-version'], { stdio: 'ignore' }).status !== 0) fail('mksquashfs is not installed (squashfs-tools)');
const build = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') || '');
let made;
try { made = JSON.parse(fs.readFileSync(path.join(build, 'portable.json'), 'utf8')); } catch { fail(`${build} is not a portable build`); }
if (made.platform !== 'linux' || made.arch !== 'x64') fail(`that build is for ${made.platform}-${made.arch}, not linux-x64`);
if (!fs.existsSync(path.join(build, 'installed.json'))) fail('that build was made without --installed');
const out = path.resolve(opt('--out', path.dirname(build)));

// The runtime, as pinned.
const pin = JSON.parse(fs.readFileSync(path.join(here, 'appimage-runtime.json'), 'utf8'));
const want = pin.sha256.x86_64;
const cache = path.join(os.homedir(), '.cache', 'simonsays-build');
fs.mkdirSync(cache, { recursive: true });
const runtimeFile = path.join(cache, `appimage-runtime-x86_64-${pin.release}`);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
if (!fs.existsSync(runtimeFile) || sha(fs.readFileSync(runtimeFile)) !== want) {
  const url = `https://github.com/AppImage/type2-runtime/releases/download/${pin.release}/runtime-x86_64`;
  say(`downloading ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
  if (!res.ok) fail(`GitHub answered ${res.status} for the runtime`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha(buf) !== want) fail(`the runtime is not the one pinned: its SHA-256 is ${sha(buf)}`);
  fs.writeFileSync(runtimeFile, buf);
}
const runtime = fs.readFileSync(runtimeFile);

// The AppImage's folder: the build, without its install scripts, with AppRun, the menu entry and the icon at the top.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-appimage-'));
const appDir = path.join(work, 'SimonSays.AppDir');
spawnSync('cp', ['-a', build, appDir], { stdio: 'inherit' });
for (const f of ['install.sh', 'uninstall.sh']) fs.rmSync(path.join(appDir, f), { force: true });
fs.copyFileSync(path.join(here, '..', 'installer', 'linux', 'AppRun'), path.join(appDir, 'AppRun'));
fs.chmodSync(path.join(appDir, 'AppRun'), 0o755);
fs.writeFileSync(path.join(appDir, 'simonsays.desktop'), [
  '[Desktop Entry]', 'Type=Application', 'Name=SimonSays', 'Comment=Chat, overlays and buttons for your stream',
  'Exec=AppRun', 'Icon=simonsays', 'Terminal=false', 'Categories=AudioVideo;Network;', `X-AppImage-Version=${made.version}`, '',
].join('\n'));
if (!fs.existsSync(path.join(appDir, 'simonsays.png'))) fail('the build has no simonsays.png');
fs.symlinkSync('simonsays.png', path.join(appDir, '.DirIcon'));

const squash = path.join(work, 'SimonSays.squashfs');
const sq = spawnSync('mksquashfs', [appDir, squash, '-root-owned', '-noappend', '-comp', 'zstd', '-quiet'], { encoding: 'utf8' });
if (sq.status !== 0) fail(`mksquashfs stopped: ${sq.stderr || sq.stdout}`);
fs.mkdirSync(out, { recursive: true });
const image = path.join(out, 'SimonSays-x86_64.AppImage');
fs.writeFileSync(image, Buffer.concat([runtime, fs.readFileSync(squash)]));
fs.chmodSync(image, 0o755);
fs.rmSync(work, { recursive: true, force: true });
say(`made ${image} (${(fs.statSync(image).size / 1024 / 1024).toFixed(1)} MB), SimonSays ${made.version}`);

// It starts: on a home of its own, a free port, no browser, and answers with its version.
if (!args.includes('--no-check')) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-appimage-check-'));
  const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  fs.writeFileSync(path.join(home, '.env'), `PORT=${port}\nHOST=127.0.0.1\nAUTO_START=false\nOBS_AUTOCONNECT=false\n`);
  const env = { ...process.env, SIMONSAYS_HOME: home, SIMONSAYS_NO_BROWSER: '1', DISPLAY: '', WAYLAND_DISPLAY: '' };
  const child = spawn(image, [], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let said = '';
  child.stdout.on('data', (d) => { said += d; });
  child.stderr.on('data', (d) => { said += d; });
  let version = '';
  const until = Date.now() + 90_000;
  while (Date.now() < until && !version) {
    if (child.exitCode !== null) break;
    try { version = (await (await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) })).json()).version; } catch { await new Promise((r) => setTimeout(r, 700)); }
  }
  // Stopped as a closed terminal would: the whole group, SIGHUP.
  try { process.kill(-child.pid, 'SIGHUP'); } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 4000));
  try { process.kill(-child.pid, 'SIGKILL'); } catch { /* stopped by itself */ }
  const kept = fs.existsSync(path.join(home, 'data'));
  fs.rmSync(home, { recursive: true, force: true });
  if (version !== made.version) fail(`the AppImage did not answer as ${made.version}:\n${said.slice(-1500)}`);
  if (!kept) fail('the AppImage did not keep its data in the home it was given');
  if (!/goodbye/.test(said)) fail(`closing its window did not stop it cleanly:\n${said.slice(-800)}`);
  say(`started, answered as ${version}, and stopped cleanly`);
}
