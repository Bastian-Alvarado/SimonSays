/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the app's version (shared/version.js) — one number, said the
 * same by the package files, the changelog, the health check, the backups
 * and every page; and `npm run bump`, which moves it everywhere at once.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const { VERSION } = await import('../../../shared/version.js');
const backup = await import('../../engine/backup.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const repo = path.resolve(path.dirname(fileURLToPath(SCRIPT_URL)), '..', '..');
const SEMVER = /^\d+\.\d+\.\d+$/;
const PACKAGES = ['package.json', 'server/package.json', 'web/package.json'];
const LOCKS = ['package-lock.json', 'server/package-lock.json', 'web/package-lock.json'];

test('the app has one version, and every package file says it', () => {
  assert.match(VERSION, SEMVER);
  for (const file of PACKAGES) assert.equal(JSON.parse(read(`../../${file}`)).version, VERSION, `${file} says another version`);
  for (const file of LOCKS) {
    const lock = JSON.parse(read(`../../${file}`));
    assert.equal(lock.version, VERSION, `${file} says another version at the top`);
    assert.equal(lock.packages[''].version, VERSION, `${file} says another version for the app itself`);
  }
});

test('the changelog has the version, newest first, dated', () => {
  const log = read('../../CHANGELOG.md');
  const headings = [...log.matchAll(/^## \[(\d+\.\d+\.\d+)\] — (\d{4}-\d{2}-\d{2})$/gm)].map((m) => m[1]);
  assert.ok(headings.length >= 1, 'no version headings');
  assert.equal(headings[0], VERSION, 'the newest heading is not this version');
  // Newest first: each heading is before the one it follows.
  const n = (v) => v.split('.').map(Number);
  for (let i = 1; i < headings.length; i += 1) {
    const [a, b] = [n(headings[i - 1]), n(headings[i])];
    assert.ok(a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))), `${headings[i - 1]} is listed above ${headings[i]} but is not later`);
  }
  // The version's own entry says something.
  const entry = log.slice(log.indexOf(`## [${VERSION}]`)).split(/^## \[/m)[1];
  assert.ok(/^- \S/m.test(entry), `[${VERSION}] has nothing under it`);
});

test('the server says its version: health, log, backups, and to every page', () => {
  assert.ok(read('../api/http.js').includes('version: VERSION,'), 'the health check');
  assert.ok(read('../index.js').includes('log.info(`SimonSays ${VERSION} — headless server starting`);'), 'the start-up log');
  assert.ok(read('../api/ws.js').includes('serverVersion: VERSION,'), 'the snapshot every page gets');
  const bundle = backup.buildBundle();
  assert.equal(bundle.meta.appVersion, VERSION, 'a backup says which app wrote it');
  assert.equal(typeof bundle.meta.version, 'number', 'the backup format keeps its own number');
});

test('Settings says the version, and when this page is older than the server', () => {
  const view = read('../../web/components/views/SettingsView.tsx');
  assert.ok(view.includes("import { VERSION } from '../../../shared/version.js';"));
  assert.ok(view.includes('serverVersion && serverVersion !== VERSION'), 'an older page says so');
  assert.ok(read('../../web/App.tsx').includes('serverVersion={(system.data as any).serverVersion}'));
  const constants = read('../../web/constants.ts');
  for (const key of ['aboutApp', 'versionLine', 'versionSame', 'versionMismatch', 'versionReload']) {
    assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
  }
});

test('npm run bump moves the version everywhere at once, and only the app’s own entries', () => {
  // On a copy: the real files are never touched by the test.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-bump-'));
  try {
    for (const file of ['shared/version.js', 'scripts/bump.mjs', 'CHANGELOG.md', ...PACKAGES, ...LOCKS]) {
      fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      fs.copyFileSync(path.join(repo, file), path.join(dir, file));
    }
    const bump = (arg) => execFileSync(process.execPath, [path.join(dir, 'scripts/bump.mjs'), arg], { encoding: 'utf8', stdio: 'pipe' });
    const [maj, min] = VERSION.split('.').map(Number);
    const next = `${maj}.${min + 1}.0`;
    const otherVersions = (file) => (fs.readFileSync(path.join(dir, file), 'utf8').match(/"version": "[^"]*"/g) || []).slice(2).join();
    const before = Object.fromEntries(LOCKS.map((f) => [f, otherVersions(f)]));

    assert.match(bump('minor'), new RegExp(`${VERSION.split('.').join('\\.')} → ${next.split('.').join('\\.')}`));
    assert.ok(fs.readFileSync(path.join(dir, 'shared/version.js'), 'utf8').includes(`export const VERSION = '${next}';`));
    for (const file of PACKAGES) assert.equal(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).version, next, file);
    for (const file of LOCKS) {
      const lock = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      assert.equal(lock.version, next, file);
      assert.equal(lock.packages[''].version, next, file);
      // A dependency that happened to share the old number keeps it.
      assert.equal(otherVersions(file), before[file], `${file}: a dependency's version moved`);
    }
    const log = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8');
    assert.ok(log.indexOf(`## [${next}] — `) < log.indexOf(`## [${VERSION}] — `), 'the new heading goes on top');

    assert.match(bump('patch'), new RegExp(`→ ${maj}\\.${min + 1}\\.1`));
    // Backwards, sideways or nonsense: refused, and nothing changed.
    for (const arg of [VERSION, `${maj}.${min + 1}.1`, 'banana', '']) {
      assert.throws(() => bump(arg), (err) => err.status === 1, `"${arg}" was taken`);
    }
    assert.ok(fs.readFileSync(path.join(dir, 'shared/version.js'), 'utf8').includes(`export const VERSION = '${maj}.${min + 1}.1';`));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
