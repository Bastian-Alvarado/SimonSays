#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The launcher: what `npm start` runs. It starts the server and stays
 * beside it, so the app can update itself.
 *
 * A program cannot safely replace itself while running, so the server only
 * gets the new version ready — downloaded, checked, unpacked into a folder
 * of its own under versions/, beside this one — and then exits with
 * RESTART_FOR_UPDATE. This starts whichever version current.json names,
 * and waits for it to say it is up. If it never does, it goes back to the
 * version before and starts that: an update that does not start costs a
 * minute, not the stream.
 *
 * Everything that is the streamer's — data/, assets/, .env — stays here in
 * the folder the app was installed in, and every version is pointed at it.
 * Without a current.json the app runs from this folder itself, as it always
 * did.
 *
 * Nothing but Node's own modules, and nothing from the app: this file is
 * not replaced by an update, so it must not depend on one.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RESTART_FOR_UPDATE = 75;
const READY_WITHIN_MS = Number(process.env.SIMONSAYS_READY_MS) || 90_000;
/** A crash restarts the server, but not forever: more than this many inside CRASH_WINDOW_MS and it stops. */
const MAX_CRASHES = 5;
const CRASH_WINDOW_MS = 2 * 60_000;

/** current.json, or null when there is none or it names a folder that is not there. */
export function readCurrent(root) {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(root, 'current.json'), 'utf8'));
    if (!c || typeof c.dir !== 'string' || !c.version) return null;
    const dir = path.resolve(root, c.dir);
    // Inside the install, and with a server in it.
    if (path.relative(root, dir).startsWith('..') || !fs.existsSync(path.join(dir, 'server', 'index.js'))) return null;
    return { ...c, abs: dir };
  } catch {
    return null;
  }
}

/** The folder whose server runs: the version current.json names, or the install itself. */
export const codeDirFor = (root, current) => (current ? current.abs : root);

/**
 * The environment a version runs in: told it has a launcher and where the
 * install is (SIMONSAYS_ROOT, which server/config.js keeps data/ and assets/
 * in), and — when it runs from a version's own folder — pointed at the
 * install's .env, never at a copy of its own.
 *
 * Not DATA_DIR or ASSETS_DIR: set here, they would be "real" environment,
 * which beats the .env, and a streamer who moved their data with DATA_DIR in
 * .env would come up after an update on an empty folder.
 */
export function envFor(root, dir, base = process.env) {
  const env = { ...base, SIMONSAYS_LAUNCHER: '1', SIMONSAYS_ROOT: root };
  if (path.resolve(dir) !== path.resolve(root)) {
    if (!env.ENV_FILE) {
      const found = [path.join(root, '.env'), path.join(root, 'server', '.env')].find((f) => fs.existsSync(f));
      if (found) env.ENV_FILE = found;
    }
  }
  return env;
}

/** Back to the version before the one that would not start, and that one remembered as failed. */
export function rollBack(root) {
  const file = path.join(root, 'current.json');
  const c = readCurrent(root);
  if (!c) return null;
  const failed = [...new Set([...(Array.isArray(c.failed) ? c.failed : []), c.version])];
  const prev = c.previous;
  if (prev && prev.dir && prev.dir !== '.') {
    fs.writeFileSync(file, JSON.stringify({ version: prev.version, dir: prev.dir, previous: null, failed, rolledBackFrom: c.version, at: Date.now() }, null, 2));
  } else {
    // The version before was the install itself: no current.json, but the failure still kept.
    fs.writeFileSync(file, JSON.stringify({ version: prev?.version || '', dir: '', previous: null, failed, rolledBackFrom: c.version, at: Date.now() }, null, 2));
  }
  return { from: c.version, to: prev?.version || '' };
}

/** Versions no longer needed: everything under versions/ but the one running and the one before it. */
export function prune(root) {
  const c = readCurrent(root);
  const keep = new Set([c?.abs, c?.previous?.dir ? path.resolve(root, c.previous.dir) : null].filter(Boolean));
  const versions = path.join(root, 'versions');
  if (!fs.existsSync(versions)) return [];
  const gone = [];
  for (const name of fs.readdirSync(versions)) {
    const dir = path.join(versions, name);
    if (keep.has(dir)) continue;
    try { fs.rmSync(dir, { recursive: true, force: true }); gone.push(name); } catch { /* in use: next time */ }
  }
  return gone;
}

/** The version a folder holds (its shared/version.js), or '' when it cannot be read. */
export function versionIn(dir) {
  try {
    return /export const VERSION = '(\d+\.\d+\.\d+)'/.exec(fs.readFileSync(path.join(dir, 'shared', 'version.js'), 'utf8'))?.[1] || '';
  } catch {
    return '';
  }
}

/** Whether version a is newer than b, both "1.2.3"; anything unreadable is never newer. */
export function isNewer(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  if (x.length !== 3 || y.length !== 3 || [...x, ...y].some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/**
 * The version to run. An install updated by hand since (a git pull, a new
 * copy over the old) is newer than the version current.json names, and
 * running that older one would undo the update: the install itself runs, and
 * current.json is set to say so.
 */
export function chooseCurrent(root) {
  const current = readCurrent(root);
  if (!current || !isNewer(versionIn(root), current.version)) return current;
  const file = path.join(root, 'current.json');
  try {
    const was = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...was, version: versionIn(root), dir: '', previous: null, at: Date.now() }, null, 2));
  } catch { /* still runs the install; asked again next start */ }
  return readCurrent(root);
}

const say = (...words) => console.log('[launcher]', ...words);

function main() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  let child = null;
  let stopping = false;
  const crashes = [];

  // justSwitched: a version just updated to, not yet trusted. wentBack: the one gone back to after one that would not start.
  const start = ({ justSwitched = false, wentBack = false } = {}) => {
    const current = chooseCurrent(root);
    const dir = codeDirFor(root, current);
    say(`starting ${current ? `version ${current.version}${dir === root ? '' : ` (${path.relative(root, dir)})`}` : 'the app'}`);
    // Its output passed on through this one, not handed this one's console: started
    // where there is no console (a task, a service, a tool), a handed-on one can stop
    // the server before it writes a line.
    child = spawn(process.execPath, [path.join(dir, 'server', 'index.js')], {
      cwd: path.join(dir, 'server'),
      env: envFor(root, dir),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true,
    });
    child.stdout.pipe(process.stdout, { end: false });
    child.stderr.pipe(process.stderr, { end: false });
    child.on('error', (err) => say(`could not start the server: ${err.message}`));
    let ready = false;
    let rolled = false;
    const giveUp = () => {
      if (ready || rolled) return;
      rolled = true;
      const back = rollBack(root);
      say(`version ${back?.from} did not start; going back to ${back?.to || 'the one before'}`);
      try { child.kill(); } catch { /* already gone */ }
    };
    const timer = justSwitched ? setTimeout(giveUp, READY_WITHIN_MS) : null;
    child.on('message', (m) => {
      if (m?.type !== 'simonsays-ready') return;
      ready = true;
      clearTimeout(timer);
      // Up: the versions no longer needed go, the one that would not start among them.
      if (justSwitched || wentBack) {
        const gone = prune(root);
        say(`version ${m.version} is up${gone.length ? `; removed ${gone.join(', ')}` : ''}`);
      }
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (stopping) { process.exit(code ?? 0); return; }
      if (code === RESTART_FOR_UPDATE) { start({ justSwitched: true }); return; }
      if (justSwitched && !ready) {
        if (!rolled) { rolled = true; const back = rollBack(root); say(`version ${back?.from} stopped before it was up; going back to ${back?.to || 'the one before'}`); }
        start({ wentBack: true });
        return;
      }
      if (code === 0 && !signal) { process.exit(0); return; }
      // A crash: started again, a few seconds later, but not forever.
      const now = Date.now();
      crashes.push(now);
      while (crashes.length && now - crashes[0] > CRASH_WINDOW_MS) crashes.shift();
      if (crashes.length > MAX_CRASHES) { say(`the server stopped ${crashes.length} times in two minutes; not starting it again`); process.exit(1); return; }
      say(`the server stopped (${signal || code}); starting it again`);
      setTimeout(() => start(), 3000);
    });
  };

  // Nowhere to write (the window that started it closed) is no reason to stop.
  for (const out of [process.stdout, process.stderr]) out.on('error', () => {});
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      stopping = true;
      try { child?.kill(sig); } catch { process.exit(0); }
    });
  }
  start();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
