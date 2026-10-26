/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Automatic backups (3.0.0): the data folder copied whole — layouts,
 * commands, accounts, settings — once a day, and whenever the streamer asks,
 * into backups/ beside it, with the newest kept. The updater takes one before
 * each update (backups/before-<version>-…), the launcher before bringing a
 * copy in and before putting a backup back; they are all listed here, and
 * any can be put back.
 *
 * Not the configuration backup (engine/backup.js), which is a file to carry
 * to another computer and leaves the accounts out: these stay on this one,
 * whole, for going back.
 *
 * Putting one back happens in the launcher (start.js, restoreBackup), before
 * the server starts again: a running server holds its data in memory and
 * would write over it. What was there is kept first as a backup of its own.
 * Pictures (assets/) are not in them: they are added, rarely changed, and
 * large.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { flushAll } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { refusal } from '../core/refusal.js';
import { createLogger } from '../core/logger.js';
import { VERSION } from '../../shared/version.js';
import { copyTree } from './updater.js';
import { RESTART_TO_BRING_IN, mayChangeHere } from './install.js';

const log = createLogger('backups');

/** How many of each kind are kept: a week of days, a week's worth of the others. */
export const KEEP = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The first daily one waits a little after a start, so it never slows one. */
const FIRST_AFTER_MS = 2 * 60_000;
const RESTORE_FILE = 'restore.json';
const RESTORE_RESULT = 'restore-result.json';

/** The kinds, by how their folders are named. Anything else in backups/ is left alone and not listed. */
const KINDS = [
  ['daily', /^daily-/],
  ['manual', /^manual-/],
  ['update', /^before-\d+\.\d+\.\d+-/],
  ['bring-in', /^before-bring-in-/],
  ['restore', /^before-restore-/],
];
const kindOf = (name) => KINDS.find(([, re]) => re.test(name))?.[0] || '';

let restart = (code) => process.exit(code);
let obs = null;
let timer = null;
let busy = false;

const root = () => process.env.SIMONSAYS_ROOT || '';
/** Beside the data: the home's backups/ (the updater's and the launcher's too), or the data folder's own parent's. */
export const backupsDir = () => path.join(root() || path.dirname(config.dataDir), 'backups');
const homeDir = () => root() || path.dirname(config.dataDir);

const sizeOf = (dir) => {
  let n = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? sizeOf(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size;
  } catch { /* gone meanwhile */ }
  return n;
};

/** Every backup there is, newest first: its kind, when, which version took it, how big. */
export function listBackups() {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const kind = kindOf(e.name);
    if (!kind) continue;
    const at = path.join(dir, e.name);
    let about = {};
    try { about = JSON.parse(fs.readFileSync(path.join(at, 'backup.json'), 'utf8')) || {}; } catch { /* one taken before these said anything */ }
    const data = path.join(at, 'data');
    out.push({
      name: e.name,
      kind,
      at: Number(about.at) || fs.statSync(at).mtimeMs,
      version: String(about.version || ''),
      // A backup taken before an update says which version it was taken for.
      updateTo: kind === 'update' ? /^before-(\d+\.\d+\.\d+)-/.exec(e.name)[1] : '',
      bytes: Number(about.bytes) || sizeOf(data),
      restorable: fs.existsSync(data),
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** All but the newest KEEP of each kind, removed. Never anything not a backup. */
export function pruneAuto(keep = KEEP) {
  const gone = [];
  const all = listBackups();
  for (const [kind] of KINDS) {
    for (const b of all.filter((x) => x.kind === kind).slice(keep)) {
      try { fs.rmSync(path.join(backupsDir(), b.name), { recursive: true, force: true }); gone.push(b.name); } catch { /* in use: next time */ }
    }
  }
  return gone;
}

function readResult() {
  try { return JSON.parse(fs.readFileSync(path.join(homeDir(), RESTORE_RESULT), 'utf8')); } catch { return null; }
}

export function backupsState() {
  const list = listBackups();
  return {
    list,
    dir: backupsDir(),
    keep: KEEP,
    // Putting one back needs a launcher that knows how, to stop and start the server around it, and the data where it looks.
    canRestore: (() => { try { mayChangeHere(); return true; } catch { return false; } })(),
    lastDaily: list.find((b) => b.kind === 'daily')?.at || 0,
    restored: readResult(),
    busy,
  };
}

const publish = () => bus.emit(EVENTS.CONFIG, { key: 'backups', value: { lastDaily: backupsState().lastDaily } });

/** A backup now: everything in memory written first, then the data folder copied whole. */
export async function takeBackup(kind = 'manual', now = new Date()) {
  if (!['daily', 'manual'].includes(kind)) throw refusal('backup_unknown_kind', 'unknown kind of backup');
  if (busy) throw refusal('backup_busy', 'a backup is already being taken');
  busy = true;
  const name = `${kind}-${now.toISOString().replace(/[:.]/g, '-')}`;
  const to = path.join(backupsDir(), name);
  try {
    flushAll();
    await copyTree(config.dataDir, path.join(to, 'data'));
    fs.writeFileSync(path.join(to, 'backup.json'), JSON.stringify({ kind, at: now.getTime(), version: VERSION, bytes: sizeOf(path.join(to, 'data')) }, null, 2));
    pruneAuto();
    log.info(`took a ${kind} backup: ${name}`);
    return listBackups().find((b) => b.name === name);
  } catch (err) {
    fs.rmSync(to, { recursive: true, force: true });
    throw refusal('backup_failed', `the backup could not be taken: ${err.message}`, { why: err.message });
  } finally {
    busy = false;
    publish();
  }
}

const isLive = () => {
  const s = obs?.getStatus?.() || {};
  return Boolean(s.streamStatus?.active || s.recordingStatus?.active);
};

/** One put back: asked of the launcher, which does it while the server is stopped. */
export function restoreBackup(name) {
  mayChangeHere();
  if (isLive()) throw refusal('update_live', 'not while OBS is streaming or recording');
  const b = listBackups().find((x) => x.name === String(name || ''));
  if (!b || !b.restorable) throw refusal('backup_not_found', 'there is no such backup');
  fs.writeFileSync(path.join(root(), RESTORE_FILE), JSON.stringify({ backup: b.name, at: Date.now() }, null, 2));
  log.info(`putting back ${b.name}; restarting for the launcher to do it`);
  setTimeout(() => restart(RESTART_TO_BRING_IN), 600);
  return { ok: true, backup: b.name };
}

export async function control(payload = {}) {
  if (payload.op === 'list') return backupsState();
  if (payload.op === 'take') { await takeBackup('manual'); return backupsState(); }
  if (payload.op === 'restore') return restoreBackup(payload.name);
  if (payload.op === 'dismiss') { fs.rmSync(path.join(homeDir(), RESTORE_RESULT), { force: true }); return backupsState(); }
  throw refusal('backup_unknown_op', 'unknown request');
}

export const snapshot = () => ({ backups: { lastDaily: backupsState().lastDaily } });

/** Once a day: a little after starting when the last daily one is a day old, then a day after each. */
export function initAutoBackups({ restarter, obsService } = {}) {
  if (restarter) restart = restarter;
  obs = obsService || null;
  clearTimeout(timer);
  const daily = () => {
    takeBackup('daily').catch((err) => log.warn(`the daily backup failed: ${err.message}`));
    timer = setTimeout(daily, DAY_MS);
    timer.unref?.();
  };
  const last = backupsState().lastDaily;
  timer = setTimeout(daily, Math.max(FIRST_AFTER_MS, last + DAY_MS - Date.now()));
  timer.unref?.();
}

export function stopAutoBackups() {
  clearTimeout(timer);
  timer = null;
}
