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
 * Everything that is the streamer's — data/, assets/, .env, and the versions
 * updated to — is kept in one folder, the home, and every version is pointed
 * at it. A git or zip copy's home is its own folder, as it always was. A copy
 * the installer put on the computer (3.0.0) says so with installed.json beside
 * this file, and its home is the user's own app-data folder: the program can
 * be reinstalled or removed and what is the streamer's stays where it was.
 * Without a current.json the app runs from this folder itself.
 *
 * Bringing in an existing SimonSays (the server asks, with bring-in.json in
 * the home) happens here too, before the server starts: a running server
 * holds its data in memory and would write over a copy made underneath it.
 *
 * Nothing but Node's own modules, and nothing from the app: this file is
 * not replaced by an update, so it must not depend on one.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RESTART_FOR_UPDATE = 75;
/** The server stopping so the launcher can bring in an existing SimonSays (bring-in.json in the home). */
export const RESTART_TO_BRING_IN = 76;
/** Beside this file in a copy the installer made: its home is the user's app-data folder. */
export const INSTALLED_FILE = 'installed.json';
export const BRING_IN_FILE = 'bring-in.json';
export const BRING_IN_RESULT = 'bring-in-result.json';
/** A request older than this was not for this start: an older launcher, which knew nothing of it, was running then. */
export const REQUEST_FRESH_MS = 10 * 60_000;
/** What this launcher can do for the server, said in SIMONSAYS_LAUNCHER: 2 brings in, puts back backups, and restarts on 76. */
export const LAUNCHER_VERSION = '2';
const stale = (ask, now) => !Number(ask?.at) || now.getTime() - Number(ask.at) > REQUEST_FRESH_MS || Number(ask.at) - now.getTime() > REQUEST_FRESH_MS;
/** The server asking for one of the home's own backups (backups/<name>/data) to be put back, and how it went. */
export const RESTORE_FILE = 'restore.json';
export const RESTORE_RESULT = 'restore-result.json';

/**
 * The user's own folder for the app's things, where each system keeps them:
 * Local AppData on Windows (not Roaming: the versions kept are hundreds of MB,
 * nothing to carry between computers), Application Support on a Mac, the XDG
 * data folder elsewhere.
 */
export function userDataDir(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === 'win32') return path.win32.join(env.LOCALAPPDATA || path.win32.join(env.USERPROFILE || home, 'AppData', 'Local'), 'SimonSays');
  if (platform === 'darwin') return path.posix.join(home, 'Library', 'Application Support', 'SimonSays');
  return path.posix.join(env.XDG_DATA_HOME || path.posix.join(home, '.local', 'share'), 'simonsays');
}

/** The home for the app in `base`: SIMONSAYS_HOME when set, the user's folder for an installed copy, or `base` itself. */
export function homeFor(base, env = process.env, platform = process.platform) {
  if (env.SIMONSAYS_HOME) return path.resolve(env.SIMONSAYS_HOME);
  if (fs.existsSync(path.join(base, INSTALLED_FILE))) return userDataDir(platform, env);
  return base;
}

/**
 * An .env carried to a new home: DATA_DIR, ASSETS_DIR and ENV_FILE pointed at the old copy's folders, so they
 * are left as notes; and where updates come from is this copy's own, never what a folder brought in says.
 */
export const movedEnv = (text) => String(text).split(/\r?\n/).map((line) => (/^\s*(DATA_DIR|ASSETS_DIR|ENV_FILE|UPDATE_REPO|UPDATE_API|SIMONSAYS_HOME)\s*=/.test(line) ? `# left behind when this was brought in: ${line.trim()}` : line)).join('\n');

const KNOWN_DATA = ['accounts.json', 'commands.json', 'actions.json', 'alerts.json', 'layouts.json', 'profiles.json'];
/** Whether a folder looks like a SimonSays data folder: at least one of the files every copy has. */
export const looksLikeData = (dir) => { try { return fs.statSync(dir).isDirectory() && KNOWN_DATA.some((f) => fs.existsSync(path.join(dir, f))); } catch { return false; } };

/**
 * Bring in the existing SimonSays the server asked for: its data, its
 * pictures and its .env, into this home. What the home had goes to
 * backups/before-bring-in-<time> first, moved, not copied, so nothing of it
 * is lost and it is quick. The request goes before anything is done, so one
 * that fails is not tried again on every start; how it went is kept in
 * bring-in-result.json for the screen.
 */
export function bringIn(home, now = new Date()) {
  const file = path.join(home, BRING_IN_FILE);
  if (!fs.existsSync(file)) return null;
  let ask = null;
  try { ask = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* said below */ }
  fs.rmSync(file, { force: true });
  const done = (result) => {
    const out = { ...result, from: ask?.from || '', at: now.getTime() };
    try { fs.writeFileSync(path.join(home, BRING_IN_RESULT), JSON.stringify(out, null, 2)); } catch { /* the log still says */ }
    return out;
  };
  const inside = (p) => { const r = path.relative(home, path.resolve(p)); return !r || !r.startsWith('..') && !path.isAbsolute(r); };
  if (ask && stale(ask, now)) return done({ ok: false, error: 'stale' });
  if (!ask || typeof ask.data !== 'string' || !looksLikeData(ask.data)) return done({ ok: false, error: 'not_found' });
  if ([ask.data, ask.assets, ask.env].some((p) => typeof p === 'string' && p && inside(p))) return done({ ok: false, error: 'same_place' });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const backup = path.join(home, 'backups', `before-bring-in-${stamp}`);
  const moved = [];
  const wrote = [];
  // What was here (if anything) into the backup, then the old copy's in its place.
  const put = (name, write) => {
    const at = path.join(home, name);
    if (fs.existsSync(at)) { fs.renameSync(at, path.join(backup, name)); moved.push(name); }
    wrote.push(name);
    write(at);
  };
  try {
    fs.mkdirSync(backup, { recursive: true });
    put('data', (at) => fs.cpSync(ask.data, at, { recursive: true }));
    if (typeof ask.assets === 'string' && ask.assets && fs.existsSync(ask.assets)) put('assets', (at) => fs.cpSync(ask.assets, at, { recursive: true }));
    if (typeof ask.env === 'string' && ask.env && fs.existsSync(ask.env)) put('.env', (at) => fs.writeFileSync(at, movedEnv(fs.readFileSync(ask.env, 'utf8'))));
    if (!moved.length) fs.rmSync(backup, { recursive: true, force: true });
    return done({ ok: true, backup: moved.length ? path.relative(home, backup).replace(/\\/g, '/') : '', moved });
  } catch (err) {
    // Half done: what was here goes back, so the app starts as it was.
    for (const name of wrote) { try { fs.rmSync(path.join(home, name), { recursive: true, force: true }); } catch { /* left as it is */ } }
    for (const name of moved) { try { fs.renameSync(path.join(backup, name), path.join(home, name)); } catch { /* still in the backup */ } }
    return done({ ok: false, error: 'copy_failed', why: String(err?.message || err) });
  }
}
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

/**
 * Put back one of the home's own backups (server/engine/auto-backups.js asks,
 * with restore.json): its data/ in place of the data there now, which is
 * kept first as backups/before-restore-<time>, moved, so a restore can be
 * undone by restoring that. Asked once; how it went in restore-result.json.
 */
export function restoreBackup(home, now = new Date()) {
  const file = path.join(home, RESTORE_FILE);
  if (!fs.existsSync(file)) return null;
  let ask = null;
  try { ask = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* said below */ }
  fs.rmSync(file, { force: true });
  const done = (result) => {
    const out = { ...result, backup: String(ask?.backup || ''), at: now.getTime() };
    try { fs.writeFileSync(path.join(home, RESTORE_RESULT), JSON.stringify(out, null, 2)); } catch { /* the log still says */ }
    return out;
  };
  if (ask && stale(ask, now)) return done({ ok: false, error: 'stale' });
  const name = String(ask?.backup || '');
  // A folder of backups/ by its name: nothing else, nothing outside it.
  if (!/^[\w.-]+$/.test(name) || name.startsWith('.')) return done({ ok: false, error: 'not_found' });
  const from = path.join(home, 'backups', name, 'data');
  if (!looksLikeData(from)) return done({ ok: false, error: 'not_found' });
  const kept = path.join(home, 'backups', `before-restore-${now.toISOString().replace(/[:.]/g, '-')}`);
  const data = path.join(home, 'data');
  let moved = false;
  let copying = false;
  try {
    fs.mkdirSync(kept, { recursive: true });
    // Windows refuses to move a folder something holds open (an antivirus, a sync tool): then nothing here is touched.
    if (fs.existsSync(data)) { fs.renameSync(data, path.join(kept, 'data')); moved = true; }
    copying = true;
    fs.cpSync(from, data, { recursive: true });
    return done({ ok: true, kept: path.relative(home, kept).replace(/\\/g, '/') });
  } catch (err) {
    // Half done: what this wrote goes, and the data that was there comes back. Never the data it did not move.
    if (copying) { try { fs.rmSync(data, { recursive: true, force: true }); } catch { /* left as it is */ } }
    if (moved) { try { fs.renameSync(path.join(kept, 'data'), data); } catch { /* still in the backup */ } }
    if (!moved) { try { fs.rmSync(kept, { recursive: true, force: true }); } catch { /* an empty folder */ } }
    return done({ ok: false, error: 'copy_failed', why: String(err?.message || err) });
  }
}

/** The folder whose server runs: the version current.json names, or the app this launcher came with. */
export const codeDirFor = (base, current) => (current ? current.abs : base);

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
export function envFor(root, dir, base = process.env, app = root) {
  // SIMONSAYS_APP: the app this launcher came with, so the server can tell an installed copy's home from its program.
  const env = { ...base, SIMONSAYS_LAUNCHER: LAUNCHER_VERSION, SIMONSAYS_ROOT: root, SIMONSAYS_APP: app };
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
export function chooseCurrent(root, base = root) {
  const current = readCurrent(root);
  // An installed copy installed again, newer, is the same: the app the launcher came with runs.
  if (!current || !isNewer(versionIn(base), current.version)) return current;
  const file = path.join(root, 'current.json');
  try {
    const was = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...was, version: versionIn(base), dir: '', previous: null, at: Date.now() }, null, 2));
  } catch { /* still runs the install; asked again next start */ }
  return readCurrent(root);
}

const say = (...words) => console.log('[launcher]', ...words);

function main() {
  // The app this launcher came with, and the home for everything that is the streamer's (the same folder but in an installed copy).
  const base = path.dirname(fileURLToPath(import.meta.url));
  const root = homeFor(base);
  fs.mkdirSync(root, { recursive: true });
  if (root !== base) say(`keeping your things in ${root}`);
  // Asked by the server before it stopped (exit RESTART_TO_BRING_IN): a copy to bring in, or a backup to put back.
  const bringing = () => {
    const r = bringIn(root);
    if (r) say(r.ok ? `brought in ${r.from}${r.backup ? `; what was here is in ${r.backup}` : ''}` : `could not bring in ${r.from || 'that folder'} (${r.why || r.error})`);
    const b = restoreBackup(root);
    if (b) say(b.ok ? `put back the backup ${b.backup}; what was here is in ${b.kept}` : `could not put back the backup ${b.backup || ''} (${b.why || b.error})`);
  };
  bringing();
  let child = null;
  let stopping = false;
  const crashes = [];

  // justSwitched: a version just updated to, not yet trusted. wentBack: the one gone back to after one that would not start.
  const start = ({ justSwitched = false, wentBack = false } = {}) => {
    const current = chooseCurrent(root, base);
    const dir = codeDirFor(base, current);
    say(`starting ${current ? `version ${current.version}${dir === base ? '' : ` (${path.relative(root, dir)})`}` : 'the app'}`);
    // Its output passed on through this one, not handed this one's console: started
    // where there is no console (a task, a service, a tool), a handed-on one can stop
    // the server before it writes a line.
    child = spawn(process.execPath, [path.join(dir, 'server', 'index.js')], {
      cwd: path.join(dir, 'server'),
      env: envFor(root, dir, process.env, base),
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
      if (code === RESTART_TO_BRING_IN) { bringing(); start(); return; }
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
  /*
    Every stop is asked of the server over the channel it already has: it saves and says goodbye, and
    exits; then this one does. Not passed on as a kill: on Windows a kill is a kill, and the server, started
    with no console of its own, never hears a Ctrl+C or its window closing — so SimonSays.cmd's window
    closed used to cut it off without saving. A server that does not stop within 15 s is stopped.
    SIGHUP is the window it runs in closing: a terminal (the AppImage), or a console on Windows.
  */
  let asked = false;
  const stopCleanly = () => {
    if (asked) return;
    asked = true;
    stopping = true;
    if (!child || child.exitCode !== null || child.signalCode) { process.exit(0); return; }
    try { child.send({ type: 'simonsays-stop' }); } catch { try { child.kill(); } catch { process.exit(0); } }
    setTimeout(() => { try { child.kill(); } catch { /* gone */ } setTimeout(() => process.exit(0), 1000); }, 15_000).unref();
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, stopCleanly);
  /*
    Started by the tray (SimonSays.exe, SIMONSAYS_CONTROL=stdin): it says "stop" on this one's stdin,
    as Windows has no signal to send a program without a console. The tray gone (its end of the pipe
    closed) is a stop too.
  */
  if (process.env.SIMONSAYS_CONTROL === 'stdin') {
    let typed = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => {
      typed += d;
      const lines = typed.split(/\r?\n/);
      typed = lines.pop();
      if (lines.some((l) => l.trim() === 'stop')) stopCleanly();
    });
    process.stdin.on('end', stopCleanly);
    process.stdin.on('error', stopCleanly);
  }
  start();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
