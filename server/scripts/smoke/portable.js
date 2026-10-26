/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: a portable build (scripts/portable.mjs, 3.0.0) — the Node it
 * carries pinned to a version and a checksum for each platform, the same
 * files an update package ships and none of the streamer's, its packages
 * installed for the platform built for without running their scripts, and
 * the check that it starts on its own Node.
 *
 * The build itself downloads Node and installs packages, so it is run by
 * hand and by the release, not here; this holds it to its rules.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const { appEntries, appVersion, webNotReady } = await import('../../../scripts/app-files.mjs');
const pin = JSON.parse(read('../../scripts/portable-node.json'));
const script = read('../../scripts/portable.mjs');

test('a portable build carries one Node, pinned with the SHA-256 of each platform\'s official archive', () => {
  assert.match(pin.version, /^\d+\.\d+\.\d+$/);
  const major = Number(pin.version.split('.')[0]);
  const engines = JSON.parse(read('../package.json')).engines.node;
  assert.ok(major >= Number(/(\d+)/.exec(engines)[1]), `Node ${pin.version} is older than the server's engines (${engines})`);
  for (const key of ['win-x64', 'win-arm64', 'linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64']) assert.match(pin.sha256[key] || '', /^[0-9a-f]{64}$/, key);
  assert.ok(script.includes('if (got !== sum) fail('), 'a download that differs from the pin is not refused');
  assert.ok(script.includes('https://nodejs.org/dist/v${pin.version}/${archive}'), 'Node comes from somewhere other than nodejs.org');
});

// A made-up app, with everything a streamer's folder has beside the code.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-portable-'));
const put = (rel, text = 'x') => { const f = path.join(scratch, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
put('start.js'); put('package.json', '{}'); put('README.md');
put('shared/version.js', "export const VERSION = '9.8.7';\n");
put('server/index.js'); put('server/package-lock.json', '{}'); put('server/.env', 'SECRET=1'); put('server/.env.local', 'SECRET=1');
put('server/node_modules/x/index.js'); put('server/debug.log');
put('data/accounts.json', '{}'); put('assets/media/me.png'); put('.env', 'SECRET=1'); put('versions/1.0.0/start.js'); put('backups/b/data/x.json');
put('web/src/App.tsx'); put('web/node_modules/y.js');
put('web/dist/index.html'); put('web/dist/assets/index.js', 'const v="9.8.7"');
const listed = appEntries(scratch).map((e) => e.path);

test('a portable build and an update package ship the same files: the code, never the streamer\'s things or what is installed', () => {
  assert.equal(appVersion(scratch), '9.8.7');
  assert.equal(webNotReady(scratch, '9.8.7'), '');
  assert.match(webNotReady(scratch, '1.0.0'), /another version/);
  for (const p of ['start.js', 'server/index.js', 'server/package-lock.json', 'shared/version.js', 'web/dist/index.html', 'web/dist/assets/index.js']) assert.ok(listed.includes(p), `${p} is not shipped`);
  for (const bad of ['data', 'assets', '.env', 'server/.env', 'server/.env.local', 'server/node_modules', 'server/debug.log', 'versions', 'backups', 'web/src', 'web/node_modules']) {
    assert.ok(!listed.some((p) => p === bad || p.startsWith(`${bad}/`)), `${bad} is shipped`);
  }
  // Both builders take the list from one place.
  assert.ok(read('../../scripts/release-bundle.mjs').includes("import { appVersion, appEntries, webNotReady } from './app-files.mjs';"));
  assert.ok(script.includes("import { appVersion, appEntries, webNotReady } from './app-files.mjs';"));
});
fs.rmSync(scratch, { recursive: true, force: true });

test('its packages are installed for the platform built for, from the lock, with no package\'s scripts run, and its native pieces checked', () => {
  assert.ok(script.includes('npm ci --omit=dev --ignore-scripts --no-audit --no-fund --os=${platform} --cpu=${arch}'));
  assert.ok(script.includes("for (const pkg of ['@resvg/resvg-js', '@snazzah/davey'])"));
  assert.ok(script.includes("if (!['win32', 'linux', 'darwin'].includes(platform))") && script.includes("if (!['x64', 'arm64'].includes(arch))"), 'the command line takes a platform it does not check');
});

test('it starts on its own Node with nothing else on the PATH and a home of its own; installed.json only when asked', () => {
  assert.ok(script.includes(String.raw`'"%~dp0node\\node.exe" "%~dp0start.js"'`), 'SimonSays.cmd does not start the Node it carries');
  assert.ok(script.includes("if (flag('--installed')) fs.writeFileSync(path.join(app, 'installed.json')"));
  assert.ok(script.includes('SIMONSAYS_HOME: home, ENV_FILE: envFile'), 'the check runs on somebody\'s own data or .env');
  assert.ok(script.includes('PATH: system.join(path.delimiter)'), 'the check could use a Node installed on the computer');
  assert.ok(script.includes("if (health.version !== version) bad("));
  // A refusal in the check stops the build it started first.
  assert.ok(script.includes("spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']"));
});

test('the installer has one name for every version, and the README and Guides send Windows to it, SmartScreen and all', () => {
  assert.ok(read('../../installer/simonsays.iss').includes('OutputBaseFilename=SimonSays-Setup\r\n') || read('../../installer/simonsays.iss').includes('OutputBaseFilename=SimonSays-Setup\n'), 'the latest release\'s download link would change with every version');
  assert.ok(read('../../scripts/installer.mjs').includes("const exe = path.join(out, 'SimonSays-Setup.exe');"));
  // The public edition's README: its override here, the README itself once built.
  const readme = fs.existsSync(new URL('../../public-edition/overrides/README.md', SCRIPT_URL)) ? read('../../public-edition/overrides/README.md') : read('../../README.md');
  for (const words of ['../../releases/latest/download/SimonSays-Setup.exe', '../../releases/latest/download/SimonSays-Windows-Portable.zip', 'More info**, then **Run anyway', '#### Or from source']) assert.ok(readme.includes(words), words);
  const guides = read('../../shared/guides.js');
  assert.ok(guides.includes("id: 'installed', group: 'more', icon: 'download'"), 'no guide for the installed app');
  assert.ok(guides.includes('Click More info, then Run anyway.') && guides.includes('Haz clic en Más información y luego en Ejecutar de todas formas.'));
  assert.ok(read('../../web/components/views/GuidesView.tsx').includes('download: Download,'), 'the guide has no icon');
});
