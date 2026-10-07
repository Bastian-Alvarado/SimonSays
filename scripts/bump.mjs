#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Moves the app to its next version, everywhere at once:
 *
 *   npm run bump patch     1.0.0 → 1.0.1   fixes and wording
 *   npm run bump minor     1.0.0 → 1.1.0   something new
 *   npm run bump major     1.0.0 → 2.0.0   something to do or re-do to keep working
 *   npm run bump 1.4.2     exactly that
 *
 * shared/version.js holds the number; the three package files and their
 * lockfiles say it too (only the app's own entries — a dependency that
 * happens to share the number is left alone), and CHANGELOG.md gets the
 * new version's heading, dated today, to be filled in. Nothing is committed
 * or tagged: that is done once the entry says what changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(root, p);
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const versionFile = at('shared/version.js');
const versionSrc = fs.readFileSync(versionFile, 'utf8');
const current = versionSrc.match(/export const VERSION = '([^']+)';/)?.[1];
if (!current || !SEMVER.test(current)) throw new Error(`shared/version.js has no version I can read (${current})`);

const ask = process.argv[2];
const [maj, min, pat] = current.match(SEMVER).slice(1).map(Number);
const next = ask === 'major' ? `${maj + 1}.0.0`
  : ask === 'minor' ? `${maj}.${min + 1}.0`
    : ask === 'patch' ? `${maj}.${min}.${pat + 1}`
      : ask;
if (!next || !SEMVER.test(next)) {
  console.error('Usage: npm run bump patch | minor | major | <x.y.z>');
  process.exit(1);
}
const order = (v) => v.match(SEMVER).slice(1).map(Number);
const later = (a, b) => { const [x, y] = [order(a), order(b)]; for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
if (!later(next, current)) {
  console.error(`${next} is not after ${current}.`);
  process.exit(1);
}

const changed = [];
const write = (file, text) => { fs.writeFileSync(at(file), text); changed.push(file); };

// The number itself.
write('shared/version.js', versionSrc.replace(`export const VERSION = '${current}';`, `export const VERSION = '${next}';`));

// The package files: their own "version", the first one in each.
for (const file of ['package.json', 'server/package.json', 'web/package.json']) {
  const text = fs.readFileSync(at(file), 'utf8');
  write(file, text.replace(/"version": "[^"]*"/, `"version": "${next}"`));
}

// The lockfiles: the version at the top, and the app's own entry under "packages" — nothing else.
for (const file of ['package-lock.json', 'server/package-lock.json', 'web/package-lock.json']) {
  if (!fs.existsSync(at(file))) continue;
  const text = fs.readFileSync(at(file), 'utf8');
  const split = text.indexOf('"packages"');
  if (split < 0) throw new Error(`${file} has no "packages"`);
  const head = text.slice(0, split).replace(/"version": "[^"]*"/, `"version": "${next}"`);
  const rest = text.slice(split).replace(/"version": "[^"]*"/, `"version": "${next}"`);
  write(file, head + rest);
}

// The changelog: a heading for this version, above the last one, to be filled in.
const logFile = 'CHANGELOG.md';
const log = fs.readFileSync(at(logFile), 'utf8');
const nl = log.includes('\r\n') ? '\r\n' : '\n';
const first = log.indexOf('## [');
if (first < 0) throw new Error('CHANGELOG.md has no version headings to put this one above');
const today = new Date().toISOString().slice(0, 10);
write(logFile, `${log.slice(0, first)}## [${next}] — ${today}${nl}${nl}- ${nl}${nl}${log.slice(first)}`);

console.log(`${current} → ${next}`);
for (const file of changed) console.log(`  ${file}`);
console.log(`Now say what changed under [${next}] in CHANGELOG.md, then commit and tag v${next}.`);
