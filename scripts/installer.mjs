#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Windows installer (3.0.0): installer/simonsays.iss, compiled with Inno
 * Setup from a portable build made with --installed.
 *
 *   node scripts/portable.mjs [folder] --installed
 *   node scripts/installer.mjs [build dir] [--out <dir>]
 *
 * `build dir` is the portable build's out folder, the one holding SimonSays/
 * (by default the one portable.mjs makes for this version on win-x64). The
 * installer is written beside it, SimonSays-Setup.exe, unless --out
 * says elsewhere. Inno Setup 6 is found where its installer puts it, or at
 * ISCC (the path to ISCC.exe).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appVersion } from './app-files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; };
const fail = (why) => { console.error(`installer: ${why}`); process.exit(1); };
const say = (...words) => console.log('installer:', ...words);

if (process.platform !== 'win32') fail('the Windows installer is built on Windows');
const version = appVersion(path.join(here, '..'));
const build = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') || path.join(os.tmpdir(), `simonsays-portable-${version}-win-x64`));
const app = path.join(build, 'SimonSays');

let made;
try { made = JSON.parse(fs.readFileSync(path.join(app, 'portable.json'), 'utf8')); } catch { fail(`no portable build in ${build} (scripts/portable.mjs makes one)`); }
if (made.platform !== 'win32') fail(`that build is for ${made.platform}, not Windows`);
if (!fs.existsSync(path.join(app, 'installed.json'))) fail('that build was made without --installed: an installed copy keeps its things in the user\'s own folder');
if (!fs.existsSync(path.join(app, 'SimonSays.exe'))) fail('that build has no tray (SimonSays.exe): it was made with --no-tray');
if (appVersion(app) !== made.version) fail('the build is not the version it says it is');

const iscc = [
  process.env.ISCC,
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Inno Setup 6', 'ISCC.exe'),
].find((p) => p && fs.existsSync(p));
if (!iscc) fail('Inno Setup 6 is not installed (winget install JRSoftware.InnoSetup), or say where ISCC.exe is with ISCC');

// The edition's repository, for the links in Apps & features: the build's own (shared/edition.js).
const repo = /UPDATE_REPO = '([^']*)'/.exec(fs.readFileSync(path.join(app, 'shared', 'edition.js'), 'utf8'))?.[1] || '';
const out = path.resolve(opt('--out') || build);
fs.mkdirSync(out, { recursive: true });

say(`compiling SimonSays ${made.version} for ${made.platform}-${made.arch} with ${iscc}`);
const r = spawnSync(iscc, [
  '/Qp',
  `/DAppVersion=${made.version}`,
  `/DSourceDir=${app}`,
  `/DOutputDir=${out}`,
  `/DIconFile=${path.join(here, '..', 'tray', 'icon', 'simonsays.ico')}`,
  `/DAppURL=${repo ? `https://github.com/${repo}` : ''}`,
  path.join(here, '..', 'installer', 'simonsays.iss'),
], { encoding: 'utf8' });
if (r.status !== 0) fail(`Inno Setup stopped:\n${(r.stdout || '').split('\n').slice(-25).join('\n')}${r.stderr || ''}`);
const exe = path.join(out, 'SimonSays-Setup.exe');
if (!fs.existsSync(exe)) fail(`Inno Setup made no ${exe}`);
say(`made ${exe} (${(fs.statSync(exe).size / 1024 / 1024).toFixed(1)} MB)`);
