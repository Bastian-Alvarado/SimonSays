/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: SimonSays beyond Windows (3.1) — the Linux download
 * (scripts/portable.mjs on linux, installer/linux/install.sh with a systemd
 * user service), the AppImage (scripts/appimage.mjs, installer/linux/AppRun)
 * and the one command for Android (scripts/install-termux.sh); and how each
 * stops: every signal, a closed window among them, asks the server to stop.
 *
 * The scripts themselves run on Linux and on a phone, so they are tried there
 * (on the laptop and in Termux) and held to their rules here; what can run
 * here does.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import zlib from 'node:zlib';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const { packTarGz } = await import('../../core/tar.js');

test('a tar made here keeps what has to run executable where it is unpacked, and everything else not', () => {
  const tar = zlib.gunzipSync(packTarGz([{ path: 'SimonSays', dir: true }, { path: 'SimonSays/node/node', data: 'x', mode: 0o755 }, { path: 'SimonSays/start.js', data: 'y' }]));
  // Each header: the name at 0, the mode (octal) at 100.
  const modes = {};
  for (let at = 0; at + 512 <= tar.length; at += 512) {
    const name = tar.subarray(at, at + 100).toString('utf8').replace(/\0.*$/s, '');
    if (!name) break;
    modes[name] = tar.subarray(at + 100, at + 107).toString('ascii');
    const size = parseInt(tar.subarray(at + 124, at + 135).toString('ascii'), 8) || 0;
    at += Math.ceil(size / 512) * 512;
  }
  assert.deepEqual(modes, { 'SimonSays/': '0000755', 'SimonSays/node/node': '0000755', 'SimonSays/start.js': '0000644' });
  const portable = read('../../scripts/portable.mjs');
  assert.ok(portable.includes("const executable = (rel) => /^SimonSays\\/node\\/node$|\\.sh$/.test(rel);"), 'Node or the scripts are packed without their exec bit');
  // Built on Windows for Linux: glibc only, and none of npm's shims for the computer it was built on.
  assert.ok(portable.includes("const musl = new RegExp(`-${platform}-${arch}-musl$`);") && portable.includes("fs.rmSync(path.join(app, 'server', 'node_modules', '.bin')"));
  assert.ok(portable.includes("for (const f of ['install.sh', 'uninstall.sh'])"), 'the Linux build has no install.sh');
});

test('install.sh installs it just for the user: the program apart from their things, a port of its own, a user service that stops cleanly', () => {
  const sh = read('../../installer/linux/install.sh');
  assert.ok(sh.includes('[ "$(id -u)" -ne 0 ] || die'), 'it can be run with sudo');
  assert.ok(sh.includes('PROGRAM="$HOME/.local/opt/simonsays"'));
  // The same home start.js gives an installed copy on Linux.
  assert.ok(sh.includes('HOME_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/simonsays"') && read('../../start.js').includes("path.posix.join(env.XDG_DATA_HOME || path.posix.join(home, '.local', 'share'), 'simonsays')"));
  assert.ok(sh.includes('for (let p = 8081; p < 8100; p += 1)'), 'it takes 8081 when something else has it');
  assert.ok(sh.includes('if [ "$DESKTOP" = 0 ]; then printf \'HOST=0.0.0.0\\n\'; fi'), 'a computer with no screen cannot open its own dashboard');
  assert.ok(sh.includes('if [ ! -f "$ENV" ]; then'), 'installing again writes over the settings');
  for (const line of ['Restart=on-failure', 'TimeoutStopSec=25', 'ExecStart=$PROGRAM/node/node $PROGRAM/start.js']) assert.ok(sh.includes(line), line);
  const un = read('../../installer/linux/uninstall.sh');
  assert.ok(un.includes('[ "${1:-}" = "--purge" ] && PURGE=1') && un.includes('your things are kept in'), 'uninstalling deletes the data unasked');
  assert.ok(un.includes('systemctl --user disable --now simonsays'));
});

test('the AppImage opens a window of its own to be stopped from, a port of its own, and the dashboard', () => {
  const run = read('../../installer/linux/AppRun');
  assert.ok(run.includes('export SIMONSAYS_IN_TERMINAL=1') && run.includes('exec "$t" -e "$APPIMAGE" "$@"'), 'double-clicked, there is no window to stop it from');
  assert.ok(run.includes('for (let p = 8081; p < 8100; p += 1)'));
  assert.ok(run.includes('xdg-open "http://localhost:$PORT/"') && run.includes('SIMONSAYS_NO_BROWSER'));
  const pin = JSON.parse(read('../../scripts/appimage-runtime.json'));
  assert.match(pin.sha256.x86_64, /^[0-9a-f]{64}$/);
  const make = read('../../scripts/appimage.mjs');
  assert.ok(make.includes('if (sha(buf) !== want) fail('), 'a runtime that differs from the pin is used');
  assert.ok(make.includes("if (!/goodbye/.test(said)) fail("), 'the check does not see it stop cleanly');
});

test('the one command for Android installs the release it came with, checked, and never touches a SimonSays already there', () => {
  const sh = read('../../scripts/install-termux.sh');
  for (const p of ["REPO='__SIMONSAYS_REPO__'", "VERSION='__SIMONSAYS_VERSION__'", "SHA256='__SIMONSAYS_SHA256__'"]) assert.ok(sh.includes(p), p);
  assert.ok(sh.includes('case "$REPO$VERSION$SHA256" in *__SIMONSAYS_*) die'), 'it runs unfilled');
  assert.ok(sh.includes('[ ! -e "$DIR" ] || die'), 'it installs over a folder that is there');
  assert.ok(sh.includes('if [ -e "$BOOT" ]; then'), 'it writes over a boot script that is there');
  assert.ok(sh.includes('[ "$(sha256sum "$TGZ" | cut -c1-64)" = "$SHA256" ]'), 'the download is not checked');
  assert.ok(sh.includes('if command -v node >/dev/null 2>&1; then'), 'it installs Node over the one there');
  assert.ok(sh.includes('if [ -z "${SIMONSAYS_NO_BOOT:-}" ] && command -v termux-wake-lock'), 'a trial copy takes the phone\'s wake lock');
  assert.ok(sh.includes('npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null 2>&1 || npm install --omit=dev'));
});

test('every stop asks the server to stop — Ctrl+C, a closed window, systemd, the tray — and a newer npm\'s complaint about the lock is got past', () => {
  const start = read('../../start.js');
  assert.ok(start.includes("for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, stopCleanly);"));
  assert.ok(start.includes("try { child.send({ type: 'simonsays-stop' }); }"), 'a stop is passed on as a kill, which on Windows cuts the server off');
  assert.ok(read('../index.js').includes("process.on('SIGHUP', () => shutdown('SIGHUP'));"), 'a closed terminal cuts the server off');
  const updater = read('../engine/updater.js');
  assert.ok(updater.includes("if (!/in sync|EUSAGE/i.test(err.message)) throw err;") && updater.includes("await npmIn(dir, 'install');"));
  // The lock has what Termux's npm wants (written with a newer npm than the PC's).
  const lock = JSON.parse(read('../package-lock.json'));
  assert.ok(lock.packages['node_modules/@emnapi/core'] && lock.packages['node_modules/@emnapi/runtime'], 'npm ci on Termux refuses this lock');
});

test('the README and the Guides send Linux to its download and Android to its one command', () => {
  // The public edition's README: its override here, the README itself once built.
  const readme = fs.existsSync(new URL('../../public-edition/overrides/README.md', SCRIPT_URL)) ? read('../../public-edition/overrides/README.md') : read('../../README.md');
  for (const words of ['../../releases/latest/download/SimonSays-Linux-x64.tar.gz', '../../releases/latest/download/SimonSays-x86_64.AppImage', '#### On Linux', '#### On an Android phone', 'SimonSays/install.sh']) assert.ok(readme.includes(words), words);
  const guides = read('../../shared/guides.js');
  assert.ok(guides.includes("id: 'linux-android', group: 'more', icon: 'terminal'"), 'no guide for Linux and Android');
  assert.ok(guides.includes('paste the one command on the SimonSays website') && guides.includes('pega el comando que está en la web de SimonSays'));
});
