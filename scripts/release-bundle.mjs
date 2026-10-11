#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The two files a GitHub release carries so copies of the app can update
 * themselves (server/engine/updater.js): the package, simonsays-<version>.tgz,
 * and release.json, which says what is in it (shared/release.js).
 *
 *   node scripts/release-bundle.mjs [folder] [--out <dir>]
 *
 * `folder` is the app to package — the public edition's clone, built — and
 * defaults to this one. The package is what runs: start.js, the server
 * without its dependencies, shared/, and the built web app (web/dist, so
 * run `npm run build` first; a build from another version is refused). Never
 * data/, assets/, .env or node_modules: an update brings code, and the
 * streamer's own things stay where they are.
 *
 * Then, in the public repo:
 *
 *   gh release create v<version> <out>/simonsays-<version>.tgz <out>/release.json --notes-file <notes>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { packTarGz } from '../server/core/tar.js';
import { RELEASE_MANIFEST, packageName, cleanReleaseManifest, MAX_PACKAGE_BYTES } from '../shared/release.js';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : '';
const folder = path.resolve(args.find((a, i) => !a.startsWith('--') && (outAt < 0 || i !== outAt + 1)) || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

const fail = (why) => { console.error(`release-bundle: ${why}`); process.exit(1); };

const versionFile = fs.readFileSync(path.join(folder, 'shared', 'version.js'), 'utf8');
const version = /export const VERSION = '([^']+)'/.exec(versionFile)?.[1];
if (!version) fail('shared/version.js has no VERSION');

// The web app, built from this version: the page says its version, so the build has it in it.
const dist = path.join(folder, 'web', 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) fail('web/dist is not built; run npm run build first');
const builtFrom = (dir) => fs.readdirSync(dir, { withFileTypes: true }).some((e) => (e.isDirectory()
  ? builtFrom(path.join(dir, e.name))
  : /\.js$/.test(e.name) && fs.readFileSync(path.join(dir, e.name), 'utf8').includes(`"${version}"`)));
if (!builtFrom(dist)) fail(`web/dist was built from another version than ${version}; run npm run build again`);

/**
 * Never in a package: what is installed, what is secret. The streamer's
 * data/ and assets/ are at the top, which is never walked — only the folders
 * named below are — and are not skipped by name inside them: web/dist/assets
 * is the built app's own.
 */
const SKIP = new Set(['node_modules', '.env', '.git', '.DS_Store', 'Thumbs.db', 'update.tgz']);
const skipped = (name) => SKIP.has(name) || name.startsWith('.env') || name.endsWith('.log');

const entries = [];
const add = (rel) => {
  const abs = path.join(folder, rel);
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    entries.push({ path: rel, dir: true });
    for (const name of fs.readdirSync(abs).sort()) if (!skipped(name)) add(path.posix.join(rel, name));
  } else {
    entries.push({ path: rel, data: fs.readFileSync(abs) });
  }
};
for (const top of ['start.js', 'package.json', 'README.md', 'LICENSE', 'NOTICE', 'CHANGELOG.md', 'PRIVACY.md', 'server', 'shared']) add(top);
// Of web/, only the build: the source is for building, and the package is built.
entries.push({ path: 'web', dir: true });
add('web/dist');

if (!entries.some((e) => e.path === 'server/index.js') || !entries.some((e) => e.path === 'server/package-lock.json')) fail('the server or its package-lock.json is missing');

// The lowest Node this version runs on, from the server's own "engines".
const engines = JSON.parse(fs.readFileSync(path.join(folder, 'server', 'package.json'), 'utf8')).engines?.node || '';
const node = Number(/(\d+)/.exec(engines)?.[1]) || 22;

const tgz = packTarGz(entries);
if (tgz.length > MAX_PACKAGE_BYTES) fail(`the package is ${tgz.length} bytes, more than a release may be`);
const manifest = cleanReleaseManifest({
  version,
  file: packageName(version),
  size: tgz.length,
  sha256: crypto.createHash('sha256').update(tgz).digest('hex'),
  node,
});
if (!manifest) fail('the release would not describe itself properly');

const dir = path.resolve(out || path.join(os.tmpdir(), `simonsays-release-${version}`));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, manifest.file), tgz);
fs.writeFileSync(path.join(dir, RELEASE_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
const files = entries.filter((e) => !e.dir).length;
console.log(`release-bundle: ${manifest.file}, ${files} files, ${(tgz.length / 1024 / 1024).toFixed(2)} MB, node >= ${node}`);
console.log(`  ${path.join(dir, manifest.file)}`);
console.log(`  ${path.join(dir, RELEASE_MANIFEST)}`);
