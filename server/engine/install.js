/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Where this copy keeps the streamer's things, and bringing in an existing
 * SimonSays (3.0.0, the easy install).
 *
 * A copy the installer made keeps everything that is the streamer's — data,
 * pictures, the .env, the versions updated to — in the user's own app-data
 * folder, its home, apart from the program (start.js, homeFor). Somebody who
 * ran SimonSays from a git or zip copy before brings that one in: this finds
 * its data folder (and its pictures and .env, wherever its .env moved them),
 * says what is in it, and asks the launcher to copy it, which it does before
 * the server starts again — a running server holds its data in memory and
 * would write over a copy made underneath it. What the home had is kept in
 * its backups/ first.
 *
 * Only the streamer's, only with the launcher, never while OBS is live.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { refusal } from '../core/refusal.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('install');

/** The same as start.js's: the launcher brings it in when the server stops with this. */
export const RESTART_TO_BRING_IN = 76;
const BRING_IN_FILE = 'bring-in.json';
const BRING_IN_RESULT = 'bring-in-result.json';
/** Files every copy's data folder has some of: the same list as start.js's looksLikeData. */
const KNOWN_DATA = ['accounts.json', 'commands.json', 'actions.json', 'alerts.json', 'layouts.json', 'profiles.json'];
/** Signed-in accounts a data folder holds, by their files: named, never read. */
const ACCOUNTS = [['twitch_credentials.json', 'Twitch'], ['youtube_tokens.json', 'YouTube'], ['tiktok_credentials.json', 'TikTok'], ['spotify_tokens.json', 'Spotify'], ['obs_credentials.json', 'OBS']];

const CODE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let restart = (code) => process.exit(code);
let obs = null;

const root = () => process.env.SIMONSAYS_ROOT || '';
const app = () => process.env.SIMONSAYS_APP || CODE_DIR;
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const inside = (p, dir) => { const r = path.relative(path.resolve(dir), path.resolve(p)); return !r || (!r.startsWith('..') && !path.isAbsolute(r)); };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const looksLikeData = (dir) => isDir(dir) && KNOWN_DATA.some((f) => isFile(path.join(dir, f)));

/**
 * Whether the launcher can copy into this copy's data, refused with why when not. It does that while the
 * server is stopped, so it has to be one that knows how (start.js LAUNCHER_VERSION 2: a copy updated from
 * Settings since 2.x keeps the launcher it was unzipped with), and the data has to be where it looks
 * (<home>/data): a copy whose .env moved it with DATA_DIR or ASSETS_DIR is not.
 */
export function mayChangeHere({ assets = false } = {}) {
  if (!root()) throw refusal('install_no_launcher', 'start the app with npm start (start.js) to do this from here');
  if (Number(process.env.SIMONSAYS_LAUNCHER) < 2) throw refusal('install_old_launcher', 'this copy\'s launcher (start.js) is older than this needs: download SimonSays again, or install it and bring this copy in');
  if (!same(config.dataDir, path.join(root(), 'data')) || (assets && !same(config.assetsDir, path.join(root(), 'assets')))) {
    throw refusal('install_data_moved', 'this copy keeps its data somewhere else (DATA_DIR or ASSETS_DIR in its .env)');
  }
}

function readResult() {
  if (!root()) return null;
  try { return JSON.parse(fs.readFileSync(path.join(root(), BRING_IN_RESULT), 'utf8')); } catch { return null; }
}

/** Where this copy's things are, for Settings: the home, the program, and what was last brought in. */
export function whereThingsAre() {
  const home = root() || CODE_DIR;
  return {
    launcher: Boolean(root()),
    // An installed copy: its home is not the program's own folder.
    installed: Boolean(root()) && !same(root(), app()),
    home,
    app: app(),
    dataDir: config.dataDir,
    assetsDir: config.assetsDir,
    broughtIn: readResult(),
    // The language chosen in the installer (language.txt beside the program): the first-run setup starts in it.
    language: installerLanguage(),
  };
}

function installerLanguage() {
  try {
    const lang = fs.readFileSync(path.join(app(), 'language.txt'), 'utf8').trim();
    return ['en', 'es'].includes(lang) ? lang : '';
  } catch {
    return '';
  }
}

/** DATA_DIR and ASSETS_DIR from an .env: an old copy may keep its data somewhere else. */
function envDirs(file) {
  const out = {};
  if (!file) return out;
  try {
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(DATA_DIR|ASSETS_DIR)\s*=\s*(.*)$/.exec(raw);
      if (m) out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch { /* none */ }
  return out;
}

/**
 * The existing SimonSays a folder is: the copy's own folder, or its server/
 * or data/ folder, as somebody might paste. Its data, pictures and .env, or
 * null when there is none.
 */
export function findExisting(input) {
  const typed = String(input || '').trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!typed) return null;
  const folder = path.resolve(typed);
  const tries = [folder];
  if (['server', 'data'].includes(path.basename(folder).toLowerCase())) tries.push(path.dirname(folder));
  for (const at of tries) {
    const env = [path.join(at, '.env'), path.join(at, 'server', '.env')].find(isFile) || '';
    const dirs = envDirs(env);
    // A relative one is from the copy's server folder, as config.js reads it.
    const data = dirs.DATA_DIR ? path.resolve(at, 'server', dirs.DATA_DIR) : path.join(at, 'data');
    if (!looksLikeData(data)) continue;
    const assets = dirs.ASSETS_DIR ? path.resolve(at, 'server', dirs.ASSETS_DIR) : path.join(at, 'assets');
    return { root: at, data, assets: isDir(assets) ? assets : '', env };
  }
  return null;
}

const count = (dir, file) => {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    return Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
  } catch { return 0; }
};
const versionOf = (dir) => {
  try { return /export const VERSION = '(\d+\.\d+\.\d+)'/.exec(fs.readFileSync(path.join(dir, 'shared', 'version.js'), 'utf8'))?.[1] || ''; } catch { return ''; }
};

/** Why a found copy cannot be brought in here: it is this copy, or inside its home. */
function samePlace(found) {
  const home = root();
  return same(found.data, config.dataDir) || (home && [found.data, found.assets, found.env].some((p) => p && inside(p, home)));
}

/** What an existing SimonSays holds, before bringing it in: how many of each, which accounts, its version. */
export function lookAt(folder) {
  mayChangeHere({ assets: true });
  const found = findExisting(folder);
  if (!found) throw refusal('install_not_found', 'no SimonSays data was found in that folder');
  if (samePlace(found)) throw refusal('install_same_place', 'that is this copy’s own folder');
  return {
    root: found.root,
    data: found.data,
    assets: found.assets,
    env: Boolean(found.env),
    version: versionOf(found.root),
    counts: { layouts: count(found.data, 'layouts.json'), commands: count(found.data, 'commands.json'), actions: count(found.data, 'actions.json'), alerts: count(found.data, 'alerts.json') },
    accounts: ACCOUNTS.filter(([f]) => isFile(path.join(found.data, f))).map(([, name]) => name),
  };
}

const isLive = () => {
  const s = obs?.getStatus?.() || {};
  return Boolean(s.streamStatus?.active || s.recordingStatus?.active);
};

/** Ask the launcher to bring it in, and stop for it to. */
export function bringIn(folder) {
  mayChangeHere({ assets: true });
  if (isLive()) throw refusal('update_live', 'not while OBS is streaming or recording');
  const found = findExisting(folder);
  if (!found) throw refusal('install_not_found', 'no SimonSays data was found in that folder');
  if (samePlace(found)) throw refusal('install_same_place', 'that is this copy’s own folder');
  fs.writeFileSync(path.join(root(), BRING_IN_FILE), JSON.stringify({ from: found.root, data: found.data, assets: found.assets, env: found.env, at: Date.now() }, null, 2));
  log.info(`bringing in ${found.root}; restarting for the launcher to copy it`);
  setTimeout(() => restart(RESTART_TO_BRING_IN), 600);
  return { ok: true, from: found.root };
}

/** The .env this copy reads: the one the launcher pointed it at, or the home's. */
export const envFile = () => process.env.ENV_FILE || path.join(root() || CODE_DIR, '.env');

/** One setting in the .env, set (or added), every other line left as it was. Read again when the app restarts. */
export function setEnvValue(key, value) {
  const file = envFile();
  let lines = [];
  try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch { /* a new one */ }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const at = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
  if (at >= 0) lines[at] = `${key}=${value}`; else lines.push(`${key}=${value}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
}

/** Whether the app can be restarted from here now: refused at once, before anything is changed, when not. */
export function mayRestart() {
  if (!root() || Number(process.env.SIMONSAYS_LAUNCHER) < 2) throw refusal('install_old_launcher', 'this copy\'s launcher (start.js) is older than this needs: download SimonSays again, or install it and bring this copy in');
  if (isLive()) throw refusal('update_live', 'not while OBS is streaming or recording');
}

/** Stopped for the launcher to start again, as for bringing in, with nothing to bring in: a setting read at start changed. */
export function restartApp() {
  mayRestart();
  setTimeout(() => restart(RESTART_TO_BRING_IN), 600);
}

export function control(payload = {}) {
  if (payload.op === 'where') return whereThingsAre();
  if (payload.op === 'look') return lookAt(payload.folder);
  if (payload.op === 'bring_in') return bringIn(payload.folder);
  // The note about the last one, read: it goes.
  if (payload.op === 'dismiss') { if (root()) fs.rmSync(path.join(root(), BRING_IN_RESULT), { force: true }); return whereThingsAre(); }
  throw refusal('install_unknown_op', 'unknown request');
}

/** `restarter` stops the server cleanly with an exit code (index.js's own shutdown); `obsService` says whether OBS is live. */
export function initInstall({ restarter, obsService } = {}) {
  if (restarter) restart = restarter;
  obs = obsService || null;
}
