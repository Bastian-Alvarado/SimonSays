/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What of the app is shipped, for both the update package
 * (scripts/release-bundle.mjs) and a portable build (scripts/portable.mjs):
 * start.js, the server without its dependencies, shared/, and the built web
 * app. Never data/, assets/, .env or node_modules: what is shipped is code,
 * and the streamer's own things stay where they are.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The version a folder is (shared/version.js), or '' when it says none. */
export function appVersion(folder) {
  try { return /export const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(folder, 'shared', 'version.js'), 'utf8'))?.[1] || ''; } catch { return ''; }
}

/** Why the folder's web app cannot be shipped, or '' when it can: built, and from this version (the page says its version, so the build has it in it). */
export function webNotReady(folder, version) {
  const dist = path.join(folder, 'web', 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) return 'web/dist is not built; run npm run build first';
  const builtFrom = (dir) => fs.readdirSync(dir, { withFileTypes: true }).some((e) => (e.isDirectory()
    ? builtFrom(path.join(dir, e.name))
    : /\.js$/.test(e.name) && fs.readFileSync(path.join(dir, e.name), 'utf8').includes(`"${version}"`)));
  return builtFrom(dist) ? '' : `web/dist was built from another version than ${version}; run npm run build again`;
}

/**
 * Never shipped: what is installed, what is secret. The streamer's data/ and
 * assets/ are at the top, which is never walked — only the folders named
 * below are — and are not skipped by name inside them: web/dist/assets is
 * the built app's own.
 */
const SKIP = new Set(['node_modules', '.env', '.git', '.DS_Store', 'Thumbs.db', 'update.tgz']);
const skipped = (name) => SKIP.has(name) || name.startsWith('.env') || name.endsWith('.log');

/** The app's files, as { path, dir } and { path, abs } entries with posix paths, folders before what is in them. */
export function appEntries(folder) {
  const entries = [];
  const add = (rel) => {
    const abs = path.join(folder, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory()) {
      entries.push({ path: rel, dir: true });
      for (const name of fs.readdirSync(abs).sort()) if (!skipped(name)) add(path.posix.join(rel, name));
    } else {
      entries.push({ path: rel, abs });
    }
  };
  for (const top of ['start.js', 'package.json', 'README.md', 'LICENSE', 'NOTICE', 'CHANGELOG.md', 'PRIVACY.md', 'server', 'shared']) add(top);
  // Of web/, only the build: the source is for building, and what is shipped is built.
  entries.push({ path: 'web', dir: true });
  add('web/dist');
  return entries;
}
