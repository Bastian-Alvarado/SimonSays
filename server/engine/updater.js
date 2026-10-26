/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Updates from GitHub: a copy of the public edition finds out a newer
 * version is out — once a day by itself, or when asked from Settings → About
 * — and, when told to, gets it ready and hands over to it.
 *
 * Getting it ready, in order: the release's release.json (shared/release.js)
 * and its package, checked against the size and SHA-256 it gives; the data
 * folder copied to backups/; the package unpacked into versions/<version>,
 * beside the version running, never over it; its dependencies — the ones
 * already installed when they are the same, npm's otherwise; and
 * current.json pointed at it. Then the server stops with RESTART_FOR_UPDATE
 * and the launcher (start.js) starts the new version, going back to this
 * one if it does not come up.
 *
 * Never on its own: checking is automatic, installing is a button. Never
 * while OBS is streaming or recording. Never without the launcher, which is
 * what makes it safe: without it there is nobody to start the new version.
 * And only from the repository this edition names (shared/edition.js) — the
 * source is not something a request can choose.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import { unpackTarGz } from '../core/tar.js';
import { config } from '../config.js';
import { VERSION } from '../../shared/version.js';
import { UPDATE_REPO } from '../../shared/edition.js';
import { compareVersions, cleanReleaseManifest, sameDependencies, RELEASE_MANIFEST, MAX_PACKAGE_BYTES, PLATFORM_KEYS } from '../../shared/release.js';

const log = createLogger('updater');

export const RESTART_FOR_UPDATE = 75;
const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_CHECK_MS = 60_000;

// The install this runs in (start.js says, with SIMONSAYS_ROOT) and the version's own folder: the one holding server/.
const CODE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let store = null;
let obs = null;
let restart = (code) => process.exit(code);
let timer = null;
/** What an update is doing now, for the screen: idle, or one of the steps, or failed with why. */
let phase = { step: 'idle' };
let busy = false;

const repo = () => process.env.UPDATE_REPO || UPDATE_REPO;
const api = () => (process.env.UPDATE_API || 'https://api.github.com').replace(/\/+$/, '');
const root = () => process.env.SIMONSAYS_ROOT || '';
// The program the launcher came with (start.js says, with SIMONSAYS_APP): an installed copy's is not where its home is.
const app = () => process.env.SIMONSAYS_APP || CODE_DIR;
export const updatesEnabled = () => Boolean(repo());

/**
 * The platform a built copy was built for — one the installer made, or a
 * portable zip (scripts/portable.mjs leaves portable.json in it) — or '' for
 * a git or zip copy of the source. A built copy has no npm: when a version's
 * dependencies change, it takes the release's package for its platform, with
 * them in it, instead of installing them.
 */
export function builtFor() {
  try {
    const made = JSON.parse(fs.readFileSync(path.join(app(), 'portable.json'), 'utf8'));
    const key = `${made.platform}-${made.arch}`;
    return PLATFORM_KEYS.includes(key) ? key : '';
  } catch {
    return '';
  }
}

/** What the launcher remembers: versions that would not start, so the screen can say so. */
function launcherMemory() {
  if (!root()) return {};
  try { return JSON.parse(fs.readFileSync(path.join(root(), 'current.json'), 'utf8')) || {}; } catch { return {}; }
}

export function getUpdates() {
  const s = store?.get() || {};
  const memory = launcherMemory();
  const latest = s.latest || null;
  return {
    enabled: updatesEnabled(),
    current: VERSION,
    // Without the launcher an update could be readied but nothing would start it.
    launcher: Boolean(root()),
    checkedAt: s.checkedAt || 0,
    latest,
    available: Boolean(latest && compareVersions(latest.version, VERSION) > 0),
    error: s.error || null,
    failed: Array.isArray(memory.failed) ? memory.failed : [],
    rolledBackFrom: memory.rolledBackFrom || '',
    phase,
  };
}

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'updates', value: getUpdates() });
}

export const snapshot = () => ({ updates: getUpdates() });

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SimonSays-updater' }, signal: AbortSignal.timeout(12_000) });
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429) throw refusal('update_rate_limited', 'GitHub has had too many questions from this network; try again in an hour');
  }
  if (res.status === 404) throw refusal('update_no_release', 'there is no release to update to yet');
  if (!res.ok) throw refusal('update_github', `GitHub answered ${res.status}`, { status: res.status });
  return res.json();
}

/** Whether a newer version is out: GitHub's latest release, with the two files an update needs. */
export async function check() {
  if (!updatesEnabled()) throw refusal('update_off', 'this copy is updated by hand');
  try {
    const rel = await getJson(`${api()}/repos/${repo()}/releases/latest`);
    const version = String(rel.tag_name || '').replace(/^v/, '');
    const assets = Array.isArray(rel.assets) ? rel.assets : [];
    const manifest = assets.find((a) => a.name === RELEASE_MANIFEST);
    const latest = {
      version,
      name: String(rel.name || `v${version}`).slice(0, 120),
      // The release's notes, its changelog entry: shown before updating, as text.
      notes: String(rel.body || '').slice(0, 4000),
      url: String(rel.html_url || ''),
      publishedAt: rel.published_at || '',
      manifestUrl: manifest?.browser_download_url || '',
      assets: Object.fromEntries(assets.filter((a) => /\.tgz$/.test(a.name)).map((a) => [a.name, a.browser_download_url])),
    };
    store.set({ ...store.get(), checkedAt: Date.now(), latest, error: null });
    if (compareVersions(version, VERSION) > 0) log.info(`version ${version} is out (this is ${VERSION})`);
  } catch (err) {
    store.set({ ...store.get(), checkedAt: Date.now(), error: { code: err.code || 'update_github', message: err.message, vars: err.vars || null } });
    log.warn(`could not check for updates: ${err.message}`);
  }
  publish();
  return getUpdates();
}

const step = (name, extra = {}) => { phase = { step: name, ...extra }; publish(); };

async function download(url, max) {
  const res = await fetch(url, { headers: { Accept: 'application/octet-stream', 'User-Agent': 'SimonSays-updater' }, signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok) throw refusal('update_download', `the download failed (${res.status})`, { status: res.status });
  const length = Number(res.headers.get('content-length'));
  if (length && length > max) throw refusal('update_too_big', 'the package is bigger than a release can be');
  const chunks = [];
  let got = 0;
  for await (const chunk of res.body) {
    got += chunk.length;
    if (got > max) throw refusal('update_too_big', 'the package is bigger than a release can be');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** A package's files into the new version's folder, none of them outside it. */
function unpackInto(pkg, dir) {
  for (const e of unpackTarGz(pkg)) {
    const to = path.join(dir, e.path);
    if (path.relative(dir, to).startsWith('..')) throw refusal('update_bad_release', 'the release does not describe itself properly');
    if (e.dir) fs.mkdirSync(to, { recursive: true });
    else { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, e.data); }
  }
}

/** npm ci in the new version's server folder, for dependencies that changed. */
function installDependencies(dir) {
  return new Promise((resolve, reject) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const run = spawn(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: dir, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let said = '';
    run.stdout.on('data', (d) => { said = (said + d).slice(-2000); });
    run.stderr.on('data', (d) => { said = (said + d).slice(-2000); });
    const t = setTimeout(() => { run.kill(); reject(new Error('npm took longer than 15 minutes')); }, 15 * 60_000);
    run.on('error', (err) => { clearTimeout(t); reject(err); });
    run.on('exit', (code) => { clearTimeout(t); if (code === 0) resolve(); else reject(new Error(said.trim().split('\n').slice(-3).join(' ') || `npm stopped with ${code}`)); });
  });
}

/**
 * A folder copied many files at a time. fs.cp copies one after another, and
 * a node_modules is thousands of small files: on Windows that was a minute
 * and more of "Installing". Links are made again as links, pointing where
 * they pointed.
 */
export async function copyTree(from, to, { at = 32 } = {}) {
  const dirs = [];
  const files = [];
  const links = [];
  const walk = (src, dst) => {
    dirs.push(dst);
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const a = path.join(src, e.name);
      const b = path.join(dst, e.name);
      if (e.isSymbolicLink()) links.push([a, b]);
      else if (e.isDirectory()) walk(a, b);
      else if (e.isFile()) files.push([a, b]);
    }
  };
  walk(from, to);
  for (const d of dirs) fs.mkdirSync(d, { recursive: true });
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const [a, b] = files[next];
      next += 1;
      await fs.promises.copyFile(a, b);
    }
  };
  await Promise.all(Array.from({ length: at }, worker));
  for (const [a, b] of links) {
    const isDir = fs.statSync(a, { throwIfNoEntry: false })?.isDirectory();
    fs.symlinkSync(fs.readlinkSync(a), b, isDir ? 'junction' : 'file');
  }
  return files.length;
}

/**
 * Every file under a folder read once, many at a time, and nothing done with
 * it. A file written a moment ago is checked by the antivirus the first time
 * it is opened, and a new version opens thousands as it starts: on Windows
 * that was twenty seconds with the overlays off, between the old version
 * stopping and the new one listening. Read here, while the old version still
 * runs, most of the checks are done before the switch: about eight seconds
 * off on the PC this was measured on, not twenty-two.
 */
export async function warmTree(dir, { at = 32 } = {}) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile()) files.push(f);
    }
  };
  walk(dir);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next];
      next += 1;
      try { await fs.promises.readFile(f); } catch { /* read when it is used, then */ }
    }
  };
  await Promise.all(Array.from({ length: at }, worker));
  return files.length;
}

/** How many of the backups taken before updates are kept: the newest, so a year of updates is not a year of copies. */
export const KEEP_BACKUPS = 5;

/** The backups taken before updates (backups/before-<version>-*), all but the newest KEEP_BACKUPS removed: never the launcher's or the daily ones (engine/auto-backups.js). */
export function pruneBackups(dir, keep = KEEP_BACKUPS) {
  if (!fs.existsSync(dir)) return [];
  const taken = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^before-\d+\.\d+\.\d+-/.test(e.name))
    .map((e) => ({ name: e.name, at: fs.statSync(path.join(dir, e.name)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  const gone = taken.slice(keep).map((b) => b.name);
  for (const name of gone) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  return gone;
}

const isLive = () => {
  const s = obs?.getStatus?.() || {};
  return Boolean(s.streamStatus?.active || s.recordingStatus?.active);
};

/** Whether an update may start now: refused at once, before anything is done, when not. */
function mayStart() {
  if (!updatesEnabled()) throw refusal('update_off', 'this copy is updated by hand');
  if (!root()) throw refusal('update_no_launcher', 'start the app with npm start (start.js) to update it from here');
  if (busy) throw refusal('update_busy', 'an update is already on its way');
  if (isLive()) throw refusal('update_live', 'not while OBS is streaming or recording');
}

/**
 * Start getting the newest version ready, and answer at once: the steps take
 * longer than a page waits for an answer, so each is published as it goes
 * (phase), a failure among them too, and the restart says the rest.
 */
export async function apply() {
  mayStart();
  busy = true;
  run().catch(() => { /* said in the phase */ });
  return getUpdates();
}

/** The same, waited for to the end: what it failed with is thrown. */
export async function applyNow() {
  mayStart();
  busy = true;
  return run();
}

async function run() {
  const versions = path.join(root(), 'versions');
  let partial = '';
  try {
    step('checking');
    await check();
    const { latest, error } = getUpdates();
    // Not on an older check's word: if GitHub could not be asked just now, that is the answer.
    if (error) throw refusal(error.code || 'update_github', error.message, error.vars || {});
    if (!latest || compareVersions(latest.version, VERSION) <= 0) throw refusal('update_none', 'this is the newest version');
    if (!latest.manifestUrl) throw refusal('update_not_packaged', 'that release has no package to update with');

    step('downloading', { version: latest.version });
    const manifest = cleanReleaseManifest(JSON.parse((await download(latest.manifestUrl, 64 * 1024)).toString('utf8')));
    if (!manifest || manifest.version !== latest.version) throw refusal('update_bad_release', 'the release does not describe itself properly');
    const have = Number(process.versions.node.split('.')[0]);
    if (have < manifest.node) throw refusal('update_node', `version ${manifest.version} needs Node ${manifest.node} or newer; this is Node ${have}`, { need: manifest.node, have });
    const url = latest.assets[manifest.file];
    if (!url) throw refusal('update_not_packaged', 'that release has no package to update with');
    const pkg = await download(url, Math.min(MAX_PACKAGE_BYTES, manifest.size + 1024));

    step('verifying', { version: manifest.version });
    const sum = crypto.createHash('sha256').update(pkg).digest('hex');
    if (pkg.length !== manifest.size || sum !== manifest.sha256) throw refusal('update_checksum', 'the package did not arrive whole; nothing was changed');

    step('backing-up', { version: manifest.version });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(root(), 'backups', `before-${manifest.version}-${stamp}`);
    fs.mkdirSync(backup, { recursive: true });
    // Not the synchronous copy: the overlays and docks keep going while it runs.
    if (fs.existsSync(config.dataDir)) await copyTree(config.dataDir, path.join(backup, 'data'));
    try { pruneBackups(path.dirname(backup)); } catch { /* the oldest stay until next time */ }

    step('unpacking', { version: manifest.version });
    const target = path.join(versions, manifest.version);
    partial = `${target}.partial`;
    fs.rmSync(partial, { recursive: true, force: true });
    fs.mkdirSync(partial, { recursive: true });
    unpackInto(pkg, partial);
    // The package is the version it says it is.
    const said = fs.readFileSync(path.join(partial, 'shared', 'version.js'), 'utf8');
    if (!fs.existsSync(path.join(partial, 'server', 'index.js')) || !said.includes(`'${manifest.version}'`)) throw refusal('update_bad_release', 'the release does not describe itself properly');

    step('installing', { version: manifest.version });
    const lock = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'server', 'package-lock.json'), 'utf8')); } catch { return null; } };
    const installed = path.join(CODE_DIR, 'server', 'node_modules');
    const built = builtFor();
    if (fs.existsSync(installed) && sameDependencies(lock(CODE_DIR), lock(partial))) {
      await copyTree(installed, path.join(partial, 'server', 'node_modules'));
    } else if (built) {
      // No npm here: the release's package for this platform, which has them in it, checked as the first one was.
      const entry = manifest.platforms?.[built];
      const url = entry ? latest.assets[entry.file] : '';
      if (!url) throw refusal('update_no_bundle', `that release has no package for this computer (${built}); install it with its installer instead`, { platform: built });
      const bundle = await download(url, Math.min(MAX_PACKAGE_BYTES, entry.size + 1024));
      if (bundle.length !== entry.size || crypto.createHash('sha256').update(bundle).digest('hex') !== entry.sha256) throw refusal('update_checksum', 'the package did not arrive whole; nothing was changed');
      unpackInto(bundle, partial);
      if (!fs.existsSync(path.join(partial, 'server', 'node_modules'))) throw refusal('update_bad_release', 'the release does not describe itself properly');
    } else {
      try {
        await installDependencies(path.join(partial, 'server'));
      } catch (err) {
        throw refusal('update_install', `its dependencies could not be installed: ${err.message}`, { why: err.message });
      }
    }
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(partial, target);
    partial = '';
    // Still "installing" on the screen: the new version read through once, so it starts fast (warmTree).
    await warmTree(target);

    // The launcher's turn: this version, and the one to go back to if it will not start.
    // '.' is the app the launcher came with: this folder itself, or an installed copy's program, outside its home.
    const rel = path.relative(root(), CODE_DIR);
    const here = !rel || rel.startsWith('..') || path.isAbsolute(rel) ? '.' : rel;
    const memory = launcherMemory();
    fs.writeFileSync(path.join(root(), 'current.json'), JSON.stringify({
      version: manifest.version,
      dir: path.relative(root(), target).replace(/\\/g, '/'),
      previous: { version: VERSION, dir: here.replace(/\\/g, '/') },
      failed: (Array.isArray(memory.failed) ? memory.failed : []).filter((v) => v !== manifest.version),
      at: Date.now(),
    }, null, 2));

    step('restarting', { version: manifest.version });
    log.info(`version ${manifest.version} is ready; restarting into it`);
    setTimeout(() => restart(RESTART_FOR_UPDATE), 600);
    return getUpdates();
  } catch (err) {
    if (partial) fs.rmSync(partial, { recursive: true, force: true });
    busy = false;
    phase = { step: 'failed', code: err.code || 'update_failed', message: err.message, vars: err.vars || null };
    publish();
    log.warn(`update failed: ${err.message}`);
    throw err.code ? err : refusal('update_failed', `the update failed: ${err.message}`, { why: err.message });
  }
}

/** From Settings → About: check now, or update. */
export async function control(payload = {}) {
  if (payload.op === 'check') return check();
  if (payload.op === 'apply') return apply();
  throw refusal('update_unknown_op', 'unknown update request');
}

/**
 * `restarter` stops the server cleanly with an exit code (index.js's own
 * shutdown); `obsService` says whether OBS is live.
 */
export function initUpdater({ restarter, obsService } = {}) {
  store = collection('updates', { checkedAt: 0, latest: null, error: null });
  obs = obsService || null;
  if (restarter) restart = restarter;
  phase = { step: 'idle' };
  busy = false;
  if (!updatesEnabled()) return;
  const daily = () => {
    check().catch(() => { /* said in the state */ });
    timer = setTimeout(daily, DAY_MS);
    timer.unref?.();
  };
  // Once a day: a minute after starting, or when the last check turns a day old, whichever is later.
  const last = store.get().checkedAt || 0;
  timer = setTimeout(daily, Math.max(FIRST_CHECK_MS, last + DAY_MS - Date.now()));
  timer.unref?.();
}

export function stopUpdater() {
  clearTimeout(timer);
  timer = null;
}
