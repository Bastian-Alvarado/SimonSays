#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The two files a GitHub release carries so copies of the app can update
 * themselves (server/engine/updater.js): the package, simonsays-<version>.tgz,
 * and release.json, which says what is in it (shared/release.js).
 *
 *   node scripts/release-bundle.mjs [folder] [--out <dir>] [--platform <portable SimonSays folder>]...
 *
 * `folder` is the app to package — the public edition's clone, built — and
 * defaults to this one. The package is what runs: start.js, the server
 * without its dependencies, shared/, and the built web app (web/dist, so
 * run `npm run build` first; a build from another version is refused). Never
 * data/, assets/, .env or node_modules: an update brings code, and the
 * streamer's own things stay where they are.
 *
 * Each --platform is a portable build of the same version (scripts/portable.mjs,
 * its SimonSays folder): packed again with its dependencies, installed for
 * its platform, as simonsays-<version>-<platform>-<arch>.tgz, and named in
 * release.json, for the copies the installer made, which have no npm. Not
 * its Node or its tray: those are the installer's, and stay as installed.
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
import { RELEASE_MANIFEST, packageName, platformPackageName, PLATFORM_KEYS, cleanReleaseManifest, MAX_PACKAGE_BYTES } from '../shared/release.js';
import { appVersion, appEntries, webNotReady } from './app-files.mjs';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : '';
const platformDirs = args.flatMap((a, i) => (a === '--platform' && args[i + 1] ? [path.resolve(args[i + 1])] : []));
const folder = path.resolve(args.find((a, i) => !a.startsWith('--') && !['--out', '--platform'].includes(args[i - 1])) || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

const fail = (why) => { console.error(`release-bundle: ${why}`); process.exit(1); };

const version = appVersion(folder);
if (!version) fail('shared/version.js has no VERSION');
const notReady = webNotReady(folder, version);
if (notReady) fail(notReady);

const entries = appEntries(folder).map((e) => (e.dir ? e : { path: e.path, data: fs.readFileSync(e.abs) }));

if (!entries.some((e) => e.path === 'server/index.js') || !entries.some((e) => e.path === 'server/package-lock.json')) fail('the server or its package-lock.json is missing');

// The lowest Node this version runs on, from the server's own "engines".
const engines = JSON.parse(fs.readFileSync(path.join(folder, 'server', 'package.json'), 'utf8')).engines?.node || '';
const node = Number(/(\d+)/.exec(engines)?.[1]) || 22;

const tgz = packTarGz(entries);
if (tgz.length > MAX_PACKAGE_BYTES) fail(`the package is ${tgz.length} bytes, more than a release may be`);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// The packages for built copies: the same app, from each portable build, with its node_modules.
const platformTgz = {};
const platforms = {};
for (const dir of platformDirs) {
  let made;
  try { made = JSON.parse(fs.readFileSync(path.join(dir, 'portable.json'), 'utf8')); } catch { fail(`${dir} is not a portable build (no portable.json)`); }
  const key = `${made.platform}-${made.arch}`;
  if (!PLATFORM_KEYS.includes(key)) fail(`${dir} is built for ${key}, which a release does not carry`);
  if (made.version !== version || appVersion(dir) !== version) fail(`${dir} is version ${made.version}, not ${version}`);
  if (!fs.existsSync(path.join(dir, 'server', 'node_modules'))) fail(`${dir} has no server/node_modules`);
  const list = appEntries(dir).map((e) => (e.dir ? e : { path: e.path, data: fs.readFileSync(e.abs) }));
  const walk = (rel) => {
    for (const ent of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = path.posix.join(rel, ent.name);
      if (ent.isDirectory()) { list.push({ path: r, dir: true }); walk(r); } else if (ent.isFile()) list.push({ path: r, data: fs.readFileSync(path.join(dir, r)) });
    }
  };
  list.push({ path: 'server/node_modules', dir: true });
  walk('server/node_modules');
  const packed = packTarGz(list);
  if (packed.length > MAX_PACKAGE_BYTES) fail(`the ${key} package is ${packed.length} bytes, more than a release may be`);
  platformTgz[key] = packed;
  platforms[key] = { file: platformPackageName(version, key), size: packed.length, sha256: sha(packed) };
}

const manifest = cleanReleaseManifest({
  version,
  file: packageName(version),
  size: tgz.length,
  sha256: sha(tgz),
  node,
  platforms,
});
if (manifest && Object.keys(manifest.platforms || {}).length !== platformDirs.length) fail('a platform package would not describe itself properly');
if (!manifest) fail('the release would not describe itself properly');

const dir = path.resolve(out || path.join(os.tmpdir(), `simonsays-release-${version}`));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, manifest.file), tgz);
for (const [key, packed] of Object.entries(platformTgz)) fs.writeFileSync(path.join(dir, manifest.platforms[key].file), packed);
fs.writeFileSync(path.join(dir, RELEASE_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
const files = entries.filter((e) => !e.dir).length;
console.log(`release-bundle: ${manifest.file}, ${files} files, ${(tgz.length / 1024 / 1024).toFixed(2)} MB, node >= ${node}`);
console.log(`  ${path.join(dir, manifest.file)}`);
for (const p of Object.values(manifest.platforms || {})) console.log(`  ${path.join(dir, p.file)} (${(p.size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  ${path.join(dir, RELEASE_MANIFEST)}`);
