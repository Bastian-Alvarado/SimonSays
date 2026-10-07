/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Writes shared/looks-superseded.js: every earlier text of a Library look
 * that a later change replaced, fingerprinted, with the look it was.
 *
 * A look is applied by copying its stylesheet onto the layer (or the alert),
 * so a change to the look reaches nothing already wearing it — and the old
 * copy no longer matches anything the Library ships, so it reads as a
 * stylesheet somebody wrote by hand. The table is how the server knows an
 * old copy for what it is and brings it up to date (see looks-history.js).
 *
 *   node server/scripts/superseded-looks.mjs <since-commit>
 *
 * Every version of shared/css-presets.js from <since-commit> to the working
 * tree is read; a look's text in any of them that differs from its text now
 * is superseded. Only list commits whose changes to the looks drew the same
 * thing — a copy is replaced without asking, so it must look the same after.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cssPrint } from '../../shared/looks-print.js';

const since = process.argv[2];
if (!since) { console.error('usage: superseded-looks.mjs <since-commit>'); process.exit(1); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const commits = [since, ...git('rev-list', '--reverse', `${since}..HEAD`).split('\n').filter(Boolean)];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'looks-'));
const load = async (file) => (await import(pathToFileURL(file).href + `?v=${Math.random()}`)).ALL_PRESETS;

const now = new Map((await load(path.join(root, 'shared/css-presets.js'))).map((p) => [p.id, p.css.trim()]));
const table = {};
for (const c of commits) {
  const file = path.join(tmp, `presets-${c}.mjs`);
  fs.writeFileSync(file, git('show', `${c}:shared/css-presets.js`));
  for (const p of await load(file)) {
    const old = p.css.trim();
    if (!now.has(p.id) || now.get(p.id) === old) continue;
    const print = cssPrint(old);
    if (table[print] && table[print] !== p.id) throw new Error(`${print} is both ${table[print]} and ${p.id}`);
    table[print] = p.id;
  }
}

const out = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Earlier texts of the Library's looks, by fingerprint: which look each was.
 * Written by server/scripts/superseded-looks.mjs — do not edit by hand.
 * From ${since} to the working tree, ${Object.keys(table).length} texts.
 */
export const SUPERSEDED = ${JSON.stringify(table, null, 2)};
`;
fs.writeFileSync(path.join(root, 'shared/looks-superseded.js'), out);
console.log(`${Object.keys(table).length} superseded texts of ${new Set(Object.values(table)).size} looks, from ${commits.length} commits`);
