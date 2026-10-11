/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: updates from GitHub (server/engine/updater.js) — a release's
 * versions and release.json, the package's tar both ways, the launcher's
 * memory (start.js), the updater against a stand-in GitHub, the release
 * script's package, and the wiring between them.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const constants = read('../../web/constants.ts');
const bothLanguages = (key) => constants.split(`    ${key}: '`).length - 1 === 2;
const { parseVersion, compareVersions, cleanReleaseManifest, sameDependencies, packageName, MAX_PACKAGE_BYTES } = await import('../../../shared/release.js');
const { packTarGz, unpackTarGz } = await import('../../core/tar.js');
const launcher = await import('../../../start.js');
const updater = await import('../../engine/updater.js');
const { UPDATE_REPO } = await import('../../../shared/edition.js');
const { VERSION } = await import('../../../shared/version.js');

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-updates-'));

test('versions compare as numbers, with or without the v, and anything unreadable is the oldest', () => {
  assert.deepEqual(parseVersion('v1.2.0'), [1, 2, 0]);
  assert.equal(parseVersion('1.2'), null);
  assert.equal(parseVersion('1.2.0-beta'), null);
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0, '1.10 is not newer than 1.9');
  assert.equal(compareVersions('v1.2.0', '1.2.0'), 0);
  assert.ok(compareVersions('2.0.0', '1.99.99') > 0);
  assert.ok(compareVersions('nonsense', '0.0.1') < 0);
  assert.ok(compareVersions('0.0.1', '') > 0);
});

test('release.json is held to its shape: the package name, a whole SHA-256, a size within reason', () => {
  const good = { version: '1.2.0', file: packageName('1.2.0'), size: 1234, sha256: 'a'.repeat(64), node: 22 };
  assert.deepEqual(cleanReleaseManifest(good), good);
  assert.equal(cleanReleaseManifest({ ...good, version: 'v1.2.0' }).version, '1.2.0');
  assert.equal(cleanReleaseManifest({ ...good, node: undefined }).node, 22, 'no node means the current one');
  for (const bad of [{ file: 'simonsays-1.2.1.tgz' }, { file: '../evil.tgz' }, { sha256: 'abc' }, { sha256: 'A'.repeat(64) }, { size: 0 }, { size: MAX_PACKAGE_BYTES + 1 }, { size: 1.5 }, { version: 'latest' }]) {
    assert.equal(cleanReleaseManifest({ ...good, ...bad }), null, `took ${JSON.stringify(bad)}`);
  }
  assert.equal(cleanReleaseManifest(null), null);
  assert.equal(cleanReleaseManifest('1.2.0'), null);
});

test('the same dependencies are the same whatever the app\'s own version says, and any other change is not', () => {
  const lock = (version, ws) => ({ name: 'server', version, lockfileVersion: 3, packages: { '': { name: 'server', version, dependencies: { ws } }, 'node_modules/ws': { version: ws.replace('^', '') } } });
  assert.ok(sameDependencies(lock('1.1.4', '^8.18.0'), lock('1.2.0', '^8.18.0')));
  assert.ok(!sameDependencies(lock('1.1.4', '^8.18.0'), lock('1.1.4', '^8.19.0')));
  assert.ok(!sameDependencies(null, lock('1.1.4', '^8.18.0')));
});

// A package with a path longer than ustar's 100-byte name, a folder, and bytes that are not text.
const longPath = `server/${'deep/'.repeat(24)}file.js`;
const binary = Buffer.from([0, 1, 2, 255, 254, 10, 13]);
const roundTrip = unpackTarGz(packTarGz([{ path: 'server', dir: true }, { path: 'server/index.js', data: 'console.log(1);\n' }, { path: longPath, data: 'x' }, { path: 'web/dist/logo.bin', data: binary }, { path: 'empty.txt', data: '' }]));

// One whose path climbs out, made by hand: the packer refuses to write one.
const climbing = (() => {
  const raw = zlib.gunzipSync(packTarGz([{ path: 'zz/evil', data: 'x' }]));
  raw.write('../evil', 0, 'utf8');
  raw.write('        ', 148, 8, 'ascii');
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += raw[i];
  raw.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return zlib.gzipSync(raw);
})();

test('the package\'s tar comes back as it went in: long paths, folders, bytes, empty files', () => {
  const byPath = Object.fromEntries(roundTrip.map((e) => [e.path, e]));
  assert.ok(byPath.server?.dir, 'the folder is gone');
  assert.equal(byPath['server/index.js'].data.toString(), 'console.log(1);\n');
  assert.ok(longPath.length > 100 && byPath[longPath], 'a path over 100 bytes did not survive');
  assert.ok(byPath['web/dist/logo.bin'].data.equals(binary));
  assert.equal(byPath['empty.txt'].data.length, 0);
});

test('the tar refuses paths that climb out or are absolute, and a header that does not add up', () => {
  assert.throws(() => packTarGz([{ path: 'a/../../x', data: 'x' }]), /not a path/);
  assert.throws(() => unpackTarGz(climbing), /a path it may not/);
  const damaged = zlib.gunzipSync(packTarGz([{ path: 'ok.txt', data: 'x' }]));
  damaged[0] = 'p'.charCodeAt(0);
  assert.throws(() => unpackTarGz(zlib.gzipSync(damaged)), /damaged/);
});

// The launcher's memory, in an install of its own: the app's folder, and a version beside it.
const install = path.join(scratch, 'install');
const makeServer = (dir) => { fs.mkdirSync(path.join(dir, 'server'), { recursive: true }); fs.writeFileSync(path.join(dir, 'server', 'index.js'), ''); };
makeServer(install);
makeServer(path.join(install, 'versions', '9.0.0'));
makeServer(path.join(install, 'versions', '8.0.0'));
makeServer(path.join(install, 'versions', '7.0.0'));
fs.writeFileSync(path.join(install, '.env'), 'PORT=1\n');
const before = launcher.readCurrent(install);
fs.writeFileSync(path.join(install, 'current.json'), JSON.stringify({ version: '9.0.0', dir: 'versions/9.0.0', previous: { version: '8.0.0', dir: 'versions/8.0.0' } }));
const current = launcher.readCurrent(install);
const fromRoot = launcher.envFor(install, install, { PATH: 'x' });
const fromVersion = launcher.envFor(install, current.abs, { PATH: 'x' });
const kept = launcher.envFor(install, current.abs, { DATA_DIR: '/elsewhere' });
const pruned = launcher.prune(install);
const left = fs.readdirSync(path.join(install, 'versions')).sort();
const back = launcher.rollBack(install);
const afterBack = JSON.parse(fs.readFileSync(path.join(install, 'current.json'), 'utf8'));
// Back again, this time to the install itself: the version before was not one under versions/.
fs.writeFileSync(path.join(install, 'current.json'), JSON.stringify({ version: '8.0.0', dir: 'versions/8.0.0', previous: { version: '7.9.0', dir: '.' }, failed: ['9.0.0'] }));
launcher.rollBack(install);
const toRoot = launcher.readCurrent(install);
const toRootFile = JSON.parse(fs.readFileSync(path.join(install, 'current.json'), 'utf8'));
// A current.json naming a folder outside the install, or one with no server, is not followed.
fs.writeFileSync(path.join(install, 'current.json'), JSON.stringify({ version: '6.0.0', dir: '../../somewhere' }));
const outside = launcher.readCurrent(install);
fs.writeFileSync(path.join(install, 'current.json'), JSON.stringify({ version: '6.0.0', dir: 'versions/6.0.0' }));
const missing = launcher.readCurrent(install);
// An install updated by hand since (a git pull): newer than the version current.json names.
const handInstall = path.join(scratch, 'by-hand');
makeServer(handInstall);
makeServer(path.join(handInstall, 'versions', '1.2.0'));
const handTo = (installed) => {
  fs.mkdirSync(path.join(handInstall, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(handInstall, 'shared', 'version.js'), `export const VERSION = '${installed}';\n`);
  fs.writeFileSync(path.join(handInstall, 'current.json'), JSON.stringify({ version: '1.2.0', dir: 'versions/1.2.0', previous: { version: '1.1.0', dir: '.' } }));
  return launcher.chooseCurrent(handInstall);
};
const pulled = handTo('1.3.0');
const pulledFile = JSON.parse(fs.readFileSync(path.join(handInstall, 'current.json'), 'utf8'));
const notPulled = handTo('1.1.0');

test('the launcher runs the version current.json names, and the install itself without one', () => {
  assert.equal(before, null);
  assert.equal(current.abs, path.join(install, 'versions', '9.0.0'));
  assert.equal(launcher.codeDirFor(install, current), current.abs);
  assert.equal(launcher.codeDirFor(install, null), install);
  assert.equal(outside, null, 'it would run a folder outside the install');
  assert.equal(missing, null, 'it would run a folder with no server');
  assert.equal(launcher.RESTART_FOR_UPDATE, updater.RESTART_FOR_UPDATE, 'the launcher and the updater disagree on the exit code');
});

test('an install updated by hand since runs itself, not the older version an update left in current.json', () => {
  assert.equal(pulled.abs, handInstall, 'a git pull would be undone by the version updated to before it');
  assert.equal(pulled.version, '1.3.0');
  assert.equal(pulledFile.dir, '');
  assert.equal(notPulled.abs, path.join(handInstall, 'versions', '1.2.0'), 'an older install ran over the version updated to');
  assert.ok(launcher.isNewer('1.10.0', '1.9.0') && !launcher.isNewer('1.2.0', '1.2.0') && !launcher.isNewer('x', '1.0.0'));
  assert.ok(read('../../start.js').includes('const current = chooseCurrent(root);'));
});

/*
  Where a version keeps the streamer's things, asked of the real config.js in
  a process of its own, started as the launcher starts a version: from a
  version's folder, told where the install is, with the install's .env.
*/
const configUrl = new URL('../config.js', SCRIPT_URL).href;
const placesWith = (vars, envText) => {
  const envFile = path.join(scratch, `env-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(envFile, envText);
  const env = { ...process.env, ...vars, ENV_FILE: envFile };
  for (const k of ['DATA_DIR', 'ASSETS_DIR']) delete env[k];
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `const { config } = await import(${JSON.stringify(configUrl)}); console.log(JSON.stringify({ data: config.dataDir, assets: config.assetsDir }));`], { env, encoding: 'utf8' });
  return r.status === 0 ? JSON.parse(r.stdout.trim().split('\n').pop()) : { error: r.stderr };
};
const elsewhere = path.join(scratch, 'moved-data');
const placed = {
  plain: placesWith(launcher.envFor(install, current.abs, {}), ''),
  moved: placesWith(launcher.envFor(install, current.abs, {}), `DATA_DIR=${elsewhere}\nASSETS_DIR=${elsewhere}-assets\n`),
  relative: placesWith(launcher.envFor(install, current.abs, {}), 'DATA_DIR=../my-data\n'),
};

test('a version runs on the install\'s own data, assets and .env, never on copies of its own', () => {
  assert.equal(fromRoot.SIMONSAYS_LAUNCHER, '1');
  assert.equal(fromRoot.SIMONSAYS_ROOT, install);
  assert.equal(fromVersion.SIMONSAYS_ROOT, install);
  assert.equal(fromVersion.ENV_FILE, path.join(install, '.env'));
  assert.equal(fromVersion.DATA_DIR, undefined, 'the launcher sets DATA_DIR, which beats a DATA_DIR in .env');
  assert.equal(fromVersion.ASSETS_DIR, undefined, 'the launcher sets ASSETS_DIR, which beats an ASSETS_DIR in .env');
  assert.equal(kept.DATA_DIR, '/elsewhere', 'a DATA_DIR given on purpose was overridden');
  assert.deepEqual(placed.plain, { data: path.join(install, 'data'), assets: path.join(install, 'assets') }, 'a version keeps its data somewhere of its own');
  assert.deepEqual(placed.moved, { data: elsewhere, assets: `${elsewhere}-assets` }, 'data moved with DATA_DIR in .env is not where an updated version looks');
  assert.equal(placed.relative.data, path.join(install, 'my-data'), 'a relative DATA_DIR means somewhere else once the version runs from its own folder');
});

test('after an update only the version running and the one before stay; one that will not start is gone back from and remembered', () => {
  assert.deepEqual(pruned, ['7.0.0']);
  assert.deepEqual(left, ['8.0.0', '9.0.0']);
  assert.deepEqual(back, { from: '9.0.0', to: '8.0.0' });
  assert.equal(afterBack.dir, 'versions/8.0.0');
  assert.deepEqual(afterBack.failed, ['9.0.0']);
  assert.equal(afterBack.rolledBackFrom, '9.0.0');
  assert.equal(toRoot.abs, install, 'going back to the install itself did not run it');
  assert.deepEqual(toRootFile.failed, ['9.0.0', '8.0.0'], 'an earlier failure was forgotten');
});

// The updater against a stand-in GitHub. Nothing it does here gets past checking a package.
let live = false;
let restartedWith = null;
updater.initUpdater({ restarter: (code) => { restartedWith = code; }, obsService: { getStatus: () => ({ streamStatus: { active: live }, recordingStatus: { active: false } }) } });
updater.stopUpdater();
const codeOf = async (fn) => { try { await fn(); return 'went ahead'; } catch (err) { return err.code || err.message; } };
// Only where there is no repository: in the public edition this would ask the real GitHub.
const handOff = UPDATE_REPO ? null : { state: updater.getUpdates(), check: await codeOf(() => updater.control({ op: 'check' })), apply: await codeOf(() => updater.control({ op: 'apply' })) };

let release = null;
const github = http.createServer((req, res) => {
  const base = `http://127.0.0.1:${github.address().port}`;
  if (req.url === '/repos/test/app/releases/latest') {
    if (!release) { res.writeHead(404); res.end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      tag_name: `v${release.tag}`, name: `SimonSays ${release.tag}`, body: '## New\n- things', html_url: 'https://example.invalid/r', published_at: '2026-10-10T00:00:00Z',
      assets: [{ name: 'release.json', browser_download_url: `${base}/dl/release.json` }, { name: packageName(release.tag), browser_download_url: `${base}/dl/pkg` }],
    }));
    return;
  }
  if (req.url === '/dl/release.json') { res.writeHead(200); res.end(JSON.stringify(release.manifest)); return; }
  if (req.url === '/dl/pkg') { res.writeHead(200); res.end(release.pkg); return; }
  res.writeHead(404); res.end();
});
await new Promise((resolve) => github.listen(0, '127.0.0.1', resolve));
const saved = { UPDATE_REPO: process.env.UPDATE_REPO, UPDATE_API: process.env.UPDATE_API, SIMONSAYS_ROOT: process.env.SIMONSAYS_ROOT };
process.env.UPDATE_REPO = 'test/app';
process.env.UPDATE_API = `http://127.0.0.1:${github.address().port}`;
const updRoot = path.join(scratch, 'updating');
fs.mkdirSync(updRoot, { recursive: true });

const pkg = packTarGz([{ path: 'server/index.js', data: '' }, { path: 'shared/version.js', data: "export const VERSION = '99.0.0';\n" }]);
const goodManifest = { version: '99.0.0', file: packageName('99.0.0'), size: pkg.length, sha256: sha(pkg), node: 22 };
const seen = {};
seen.noRelease = (await updater.check()).error?.code;
release = { tag: VERSION, manifest: { ...goodManifest }, pkg };
seen.same = await updater.check();
delete process.env.SIMONSAYS_ROOT;
release = { tag: '99.0.0', manifest: goodManifest, pkg };
seen.newer = await updater.check();
seen.noLauncher = await codeOf(() => updater.apply());
process.env.SIMONSAYS_ROOT = updRoot;
live = true;
seen.live = await codeOf(() => updater.apply());
live = false;
release = { tag: '99.0.0', manifest: { ...goodManifest, sha256: 'b'.repeat(64) }, pkg };
// From the screen: answered as it starts, a second press refused, and the failure said in the steps.
seen.answered = await updater.apply();
seen.second = await codeOf(() => updater.apply());
for (let i = 0; i < 200 && updater.getUpdates().phase.step !== 'failed'; i += 1) await new Promise((resolve) => { setTimeout(resolve, 20); });
seen.background = updater.getUpdates().phase;
seen.checksum = await codeOf(() => updater.applyNow());
seen.checksumPhase = updater.getUpdates().phase;
release = { tag: '99.0.0', manifest: { ...goodManifest, version: '98.0.0', file: packageName('98.0.0') }, pkg };
seen.mismatch = await codeOf(() => updater.applyNow());
release = { tag: '99.0.0', manifest: { ...goodManifest, node: 999 }, pkg };
seen.node = await codeOf(() => updater.applyNow());
seen.nodeVars = updater.getUpdates().phase.vars;
seen.unknown = await codeOf(() => updater.control({ op: 'reinstall' }));
seen.touched = fs.readdirSync(updRoot);
await new Promise((resolve) => github.close(resolve));
for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
updater.stopUpdater();

// The parallel copy, over a small tree: nested folders, an empty file, more files than workers.
const tree = path.join(scratch, 'tree');
for (let i = 0; i < 70; i += 1) {
  const f = path.join(tree, `d${i % 7}`, `sub${i % 3}`, `f${i}.txt`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `file ${i}`);
}
fs.mkdirSync(path.join(tree, 'empty-folder'));
fs.writeFileSync(path.join(tree, 'empty.txt'), '');
const copied = await updater.copyTree(tree, path.join(scratch, 'tree-copy'), { at: 8 });
const warmed = await updater.warmTree(path.join(scratch, 'tree-copy'), { at: 8 });
const sameTree = (a, b) => fs.readdirSync(a, { withFileTypes: true }).every((e) => (e.isDirectory()
  ? sameTree(path.join(a, e.name), path.join(b, e.name))
  : fs.readFileSync(path.join(a, e.name)).equals(fs.readFileSync(path.join(b, e.name)))));

// Seven backups taken before updates, a day apart, and something else in the folder that is not one.
const backupsDir = path.join(scratch, 'backups');
for (let i = 0; i < 7; i += 1) {
  const b = path.join(backupsDir, `before-1.${i}.0-x`);
  fs.mkdirSync(path.join(b, 'data'), { recursive: true });
  const at = new Date(Date.UTC(2026, 0, 1 + i));
  fs.utimesSync(b, at, at);
}
fs.mkdirSync(path.join(backupsDir, 'mine'));
const prunedBackups = updater.pruneBackups(backupsDir);
const keptBackups = fs.readdirSync(backupsDir).sort();

test('only the newest backups taken before updates are kept, and nothing else in the folder is touched', () => {
  assert.equal(updater.KEEP_BACKUPS, 5);
  assert.deepEqual(prunedBackups.sort(), ['before-1.0.0-x', 'before-1.1.0-x']);
  assert.deepEqual(keptBackups, ['before-1.2.0-x', 'before-1.3.0-x', 'before-1.4.0-x', 'before-1.5.0-x', 'before-1.6.0-x', 'mine']);
  assert.ok(read('../engine/updater.js').includes('try { pruneBackups(path.dirname(backup)); }'));
});

test('the updater copies a folder whole, many files at a time, and reads the new version through before switching to it', () => {
  assert.equal(copied, 71);
  assert.ok(sameTree(tree, path.join(scratch, 'tree-copy')), 'the copy differs');
  assert.ok(fs.existsSync(path.join(scratch, 'tree-copy', 'empty-folder')), 'an empty folder was left out');
  assert.ok(read('../engine/updater.js').includes("await copyTree(installed, path.join(partial, 'server', 'node_modules'));"));
  assert.equal(warmed, 71, 'not every file was read through');
  const updaterSrc = read('../engine/updater.js');
  assert.ok(updaterSrc.indexOf('await warmTree(target);') > updaterSrc.indexOf('fs.renameSync(partial, target);'), 'the new version is not read through before the switch');
});

test('a stop is over in seconds: the goodbyes are capped and the pages let go, so an update is not overlays off for twenty', () => {
  const index = read('../index.js');
  assert.ok(index.includes('setTimeout(() => process.exit(code), 6000).unref();'));
  assert.ok(index.includes('await Promise.race([new Promise((resolve) => { setTimeout(resolve, 3000); }), Promise.allSettled(['));
  assert.ok(index.indexOf('closeWebSocket();') < index.indexOf('server.close(() => {'), 'the server waits for pages that never leave');
  assert.ok(read('../api/ws.js').includes('for (const ws of clients) { try { ws.terminate(); } catch { /* already gone */ } }'));
});

test('a copy with no repository to update from says so and does nothing: the private edition is updated by hand', () => {
  if (UPDATE_REPO) {
    assert.match(UPDATE_REPO, /^[\w.-]+\/[\w.-]+$/, 'the edition names something that is not a repository');
    return;
  }
  assert.equal(handOff.state.enabled, false);
  assert.equal(handOff.check, 'update_off');
  assert.equal(handOff.apply, 'update_off');
});

test('a check finds the latest release and whether it is newer, and says when there is none', () => {
  assert.equal(seen.noRelease, 'update_no_release');
  assert.equal(seen.same.available, false, 'the same version is offered as an update');
  assert.equal(seen.same.error, null);
  assert.equal(seen.newer.available, true);
  assert.equal(seen.newer.latest.version, '99.0.0');
  assert.equal(seen.newer.latest.notes, '## New\n- things');
  assert.ok(seen.newer.latest.manifestUrl.endsWith('/dl/release.json'));
  assert.ok(seen.newer.checkedAt > 0);
});

test('an update from the screen is answered as it starts, not when it is done, and what stops it is said in its steps', () => {
  assert.equal(seen.answered.phase.step, 'checking', 'the screen waits for the whole update, longer than it waits for any answer');
  assert.equal(seen.second, 'update_busy');
  assert.equal(seen.background.step, 'failed');
  assert.equal(seen.background.code, 'update_checksum');
  const panel = read('../../web/components/UpdatesPanel.tsx');
  assert.ok(panel.includes('if (err?.code) remember(null);'), 'a dropped answer forgets the version to reload into');
});

test('an update is refused without the launcher, while live, for a package that is not whole, or one that is not what it says', () => {
  assert.equal(seen.noLauncher, 'update_no_launcher');
  assert.equal(seen.live, 'update_live');
  assert.equal(seen.checksum, 'update_checksum');
  assert.equal(seen.checksumPhase.step, 'failed', 'the screen is not told it stopped');
  assert.equal(seen.mismatch, 'update_bad_release');
  assert.equal(seen.node, 'update_node');
  assert.deepEqual(seen.nodeVars, { need: 999, have: Number(process.versions.node.split('.')[0]) });
  assert.equal(seen.unknown, 'update_unknown_op');
  assert.equal(restartedWith, null, 'a refused update restarted the server');
  assert.deepEqual(seen.touched, [], 'a refused update left something in the install');
});

// The release script's package, from a stand-in app folder: what goes in, what never does.
const app = path.join(scratch, 'app');
const put = (rel, text = '') => { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), text); };
put('shared/version.js', "export const VERSION = '9.9.9';\n");
put('start.js', '// launcher\n');
put('package.json', '{}');
put('server/index.js', '');
put('server/package.json', JSON.stringify({ engines: { node: '>=22' } }));
put('server/package-lock.json', '{}');
put('server/node_modules/ws/index.js', '');
put('server/.env', 'SECRET=1');
put('data/config.json', '{}');
put('assets/sound.mp3', '');
put('web/src/App.tsx', '');
put('web/dist/index.html', '<html></html>');
const bundle = (out) => spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/release-bundle.mjs', SCRIPT_URL)), app, '--out', out], { encoding: 'utf8' });
put('web/dist/assets/index.js', 'const v="9.9.8";');
const stale = bundle(path.join(scratch, 'out-stale'));
put('web/dist/assets/index.js', 'const v="9.9.9";');
const out = path.join(scratch, 'out');
const made = bundle(out);
const madeManifest = made.status === 0 ? JSON.parse(fs.readFileSync(path.join(out, 'release.json'), 'utf8')) : null;
const madeTgz = made.status === 0 ? fs.readFileSync(path.join(out, packageName('9.9.9'))) : null;
const madePaths = madeTgz ? unpackTarGz(madeTgz).map((e) => e.path) : [];

test('the release script packages what runs and nothing that is the streamer\'s, and release.json describes it', () => {
  assert.notEqual(stale.status, 0, 'a web build from another version was packaged');
  assert.equal(made.status, 0, made.stderr);
  assert.deepEqual(cleanReleaseManifest(madeManifest), madeManifest);
  assert.equal(madeManifest.size, madeTgz.length);
  assert.equal(madeManifest.sha256, sha(madeTgz));
  assert.equal(madeManifest.node, 22);
  for (const p of ['start.js', 'server/index.js', 'server/package-lock.json', 'shared/version.js', 'web/dist/index.html', 'web/dist/assets/index.js']) assert.ok(madePaths.includes(p), `${p} is not in the package`);
  for (const p of madePaths) assert.ok(!/node_modules|\.env|^data|^assets|^web\/src/.test(p), `${p} is in the package`);
});

test('wired: started by the launcher it says when it is up, it stops with the launcher\'s code, and the socket, backups and builder know it', () => {
  const index = read('../index.js');
  assert.ok(index.includes("if (process.send) process.send({ type: 'simonsays-ready', version: VERSION });"));
  assert.ok(index.includes("initUpdater({ restarter: (code) => shutdown('update', code), obsService: obs });"));
  assert.ok(index.includes('const shutdown = async (signal, code = 0) => {') && index.includes('process.exit(code);'));
  assert.ok(read('../../start.js').includes("if (m?.type !== 'simonsays-ready') return;"));
  assert.ok(read('../api/ws.js').includes('return reply(await updater.control(payload));'));
  assert.ok(read('../engine/backup.js').includes("EXCLUDED = ['updates',"), 'a backup would carry one copy\'s update state to another');
  assert.ok(read('../../shared/protocol.js').includes("UPDATES: 'updates',"));
  assert.ok(JSON.parse(read('../../package.json')).scripts.start === 'node start.js', 'npm start is not the launcher');
  for (const ignored of ['versions/', 'current.json', 'backups/']) assert.ok(read('../../.gitignore').includes(ignored), `${ignored} is not ignored`);
});


test('Settings shows updates only on a copy that updates itself, the menu marks one that is out, and the page reloads into it', () => {
  const settings = read('../../web/components/views/SettingsView.tsx');
  assert.ok(settings.includes('{updates?.enabled && updatesAct && ('));
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("dot: updateOut ? 'news' : undefined"));
  assert.ok(app.includes("useReloadAfterUpdate((system.data as any).serverVersion || '', (system.data as any).updates || null);"));
  assert.ok(read('../../web/components/NavMenu.tsx').includes("{!waiting && !running && news && <Dot kind=\"news\" />}"));
  const panel = read('../../web/components/UpdatesPanel.tsx');
  assert.ok(panel.includes('if (serverVersion === to && serverVersion !== VERSION) { remember(null); window.location.reload(); return; }'));
  assert.ok(panel.includes("data-updates-confirm"), 'updating is one press, with no second to confirm');
  for (const key of ['updatesTitle', 'updatesCheck', 'updatesAvailable', 'updatesUpdate', 'updatesConfirm', 'updatesConfirmGo', 'updatesNoLauncher', 'updatesRolledBack', 'updatesStopped', 'updatesStepDownloading', 'updatesStepRestarting', 'updatesReloadSoon']) {
    assert.ok(bothLanguages(key), `${key} is not in both languages`);
  }
});

fs.rmSync(scratch, { recursive: true, force: true });
