/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: automatic backups (engine/auto-backups.js, 3.0.0) — the data
 * folder copied whole, listed by kind, the newest of each kept and nothing
 * else in backups/ touched, and one put back by the launcher (start.js,
 * restoreBackup) with what was there kept first. And the installer's
 * language, asked every time and kept for the tray and the first-run setup.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const backups = await import('../../engine/auto-backups.js');
const updater = await import('../../engine/updater.js');
const launcher = await import('../../../start.js');
const { VERSION } = await import('../../../shared/version.js');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-backups-'));
const refusedWith = async (fn) => { try { await fn(); return null; } catch (err) { return err.code; } };

const { config } = await import('../../config.js');
const home = path.dirname(config.dataDir);
const dir = path.join(home, 'backups');
const launcherWas = process.env.SIMONSAYS_LAUNCHER;
process.env.SIMONSAYS_LAUNCHER = launcher.LAUNCHER_VERSION;
const was = process.env.SIMONSAYS_ROOT;
process.env.SIMONSAYS_ROOT = home;
const restarted = [];
backups.initAutoBackups({ restarter: (code) => restarted.push(code) });
backups.stopAutoBackups();

// One now: the data folder, whole, said in its backup.json.
const taken = await backups.takeBackup('manual');
const unknownKind = await refusedWith(() => backups.takeBackup('nightly'));

// The other kinds, as the updater and the launcher name theirs, and a folder that is not a backup.
const make = (name, daysAgo, file = 'commands.json') => {
  const at = path.join(dir, name);
  fs.mkdirSync(path.join(at, 'data'), { recursive: true });
  fs.writeFileSync(path.join(at, 'data', file), '{}');
  const when = new Date(Date.now() - daysAgo * 86_400_000);
  fs.utimesSync(at, when, when);
};
for (let i = 0; i < 9; i += 1) make(`daily-old-${i}`, i + 1);
make('before-2.9.0-x', 3);
make('before-bring-in-x', 4);
make('before-restore-x', 5);
fs.mkdirSync(path.join(dir, 'mine'));
const listed = backups.listBackups();
const pruned = backups.pruneAuto();
const afterPrune = backups.listBackups();
// The updater's own pruning, after: only its backups taken before updates count against it.
for (let i = 0; i < 6; i += 1) make(`before-3.${i}.0-x`, 10 + i);
const updaterGone = updater.pruneBackups(dir);

test('a backup is the data folder whole, said by kind and version; the newest of each kind are kept, and nothing else in the folder is touched', () => {
  assert.equal(taken.kind, 'manual');
  assert.equal(taken.version, VERSION);
  assert.ok(taken.bytes > 0 && taken.restorable);
  assert.ok(fs.existsSync(path.join(dir, taken.name, 'data')), 'the data was not copied');
  assert.equal(unknownKind, 'backup_unknown_kind');
  assert.ok(!listed.some((b) => b.name === 'mine'), 'a folder that is not a backup is listed');
  assert.deepEqual([...new Set(listed.map((b) => b.kind))].sort(), ['bring-in', 'daily', 'manual', 'restore', 'update']);
  assert.equal(listed.find((b) => b.kind === 'update').updateTo, '2.9.0');
  assert.equal(listed[0].name, taken.name, 'the newest is not first');
  assert.equal(backups.KEEP, 7);
  assert.deepEqual(pruned.sort(), ['daily-old-7', 'daily-old-8']);
  assert.equal(afterPrune.filter((b) => b.kind === 'daily').length, 7);
  assert.ok(fs.existsSync(path.join(dir, 'mine')));
  // The updater keeps five of its own and never takes the launcher's or the daily ones with them.
  assert.equal(updaterGone.length, 2);
  assert.ok(updaterGone.every((n) => /^before-\d+\.\d+\.\d+-/.test(n)));
  assert.ok(fs.existsSync(path.join(dir, 'before-bring-in-x')) && fs.existsSync(path.join(dir, 'before-restore-x')) && fs.existsSync(path.join(dir, 'daily-old-0')));
});

// Putting one back: asked of the launcher, with the server stopping for it.
const noSuch = await refusedWith(() => backups.restoreBackup('daily-nope'));
const asked = backups.restoreBackup('daily-old-0');
const request = JSON.parse(fs.readFileSync(path.join(home, 'restore.json'), 'utf8'));
await new Promise((r) => { setTimeout(r, 800); });
fs.rmSync(path.join(home, 'restore.json'), { force: true });
delete process.env.SIMONSAYS_ROOT;
const noLauncher = await refusedWith(() => backups.restoreBackup('daily-old-0'));
// A copy whose data is somewhere else (DATA_DIR): putting one back would change a folder it does not read.
process.env.SIMONSAYS_ROOT = path.join(scratch, 'elsewhere');
const dataMoved = await refusedWith(() => backups.restoreBackup('daily-old-0'));
process.env.SIMONSAYS_ROOT = home;
process.env.SIMONSAYS_LAUNCHER = '1';
const oldLauncher = await refusedWith(() => backups.restoreBackup('daily-old-0'));
const oldCanRestore = backups.backupsState().canRestore;
if (was === undefined) delete process.env.SIMONSAYS_ROOT; else process.env.SIMONSAYS_ROOT = was;
if (launcherWas === undefined) delete process.env.SIMONSAYS_LAUNCHER; else process.env.SIMONSAYS_LAUNCHER = launcherWas;
fs.rmSync(dir, { recursive: true, force: true });

test('putting a backup back is asked of the launcher, which does it with the server stopped; only one that is there', () => {
  assert.equal(noSuch, 'backup_not_found');
  assert.equal(asked.ok, true);
  assert.equal(request.backup, 'daily-old-0');
  assert.deepEqual(restarted, [76]);
  assert.equal(noLauncher, 'install_no_launcher');
  assert.equal(dataMoved, 'install_data_moved');
  assert.equal(oldLauncher, 'install_old_launcher', 'an older launcher would leave restore.json for a later start');
  assert.equal(oldCanRestore, false, 'Settings offers a restore an older launcher cannot do');
});

// The launcher's half: a home with data of now, and a backup of then.
const lhome = path.join(scratch, 'launcher-home');
fs.mkdirSync(path.join(lhome, 'data'), { recursive: true });
fs.writeFileSync(path.join(lhome, 'data', 'commands.json'), '"now"');
fs.mkdirSync(path.join(lhome, 'backups', 'daily-then', 'data'), { recursive: true });
fs.writeFileSync(path.join(lhome, 'backups', 'daily-then', 'data', 'commands.json'), '"then"');
const tenOClock = new Date('2026-10-26T10:00:00Z');
const ask = (backup, when = tenOClock) => fs.writeFileSync(path.join(lhome, launcher.RESTORE_FILE), JSON.stringify({ backup, at: when.getTime() }));
// Windows refusing to move the data folder (something holds a file in it open): nothing is touched.
const realRename = fs.renameSync;
fs.renameSync = (from, to) => { if (path.basename(from) === 'data' && path.dirname(from) === lhome) { const err = new Error('EBUSY: resource busy or locked'); err.code = 'EBUSY'; throw err; } return realRename(from, to); };
ask('daily-then');
const held = launcher.restoreBackup(lhome, tenOClock);
fs.renameSync = realRename;
const afterHeld = fs.readFileSync(path.join(lhome, 'data', 'commands.json'), 'utf8');
const keptAfterHeld = fs.readdirSync(path.join(lhome, 'backups')).filter((n) => n.startsWith('before-restore-'));
// Asked an hour before this start, under a launcher that knew nothing of it: not done now.
ask('daily-then', new Date(tenOClock.getTime() - 3_600_000));
const staleRestore = launcher.restoreBackup(lhome, tenOClock);
ask('daily-then');
const put = launcher.restoreBackup(lhome, tenOClock);
const again = launcher.restoreBackup(lhome);
ask('../../outside');
const climbing = launcher.restoreBackup(lhome, tenOClock);
ask('daily-gone');
const gone = launcher.restoreBackup(lhome, tenOClock);

test('the launcher puts a backup back with what was there kept first, once, and only one of the home\'s own', () => {
  assert.equal(held.ok, false);
  assert.equal(afterHeld, '"now"', 'a move Windows refused deleted the data');
  assert.deepEqual(keptAfterHeld, [], 'an empty backup was left from a restore that never started');
  assert.equal(staleRestore.error, 'stale');
  assert.equal(put.ok, true, JSON.stringify(put));
  assert.equal(fs.readFileSync(path.join(lhome, 'data', 'commands.json'), 'utf8'), '"then"');
  assert.equal(fs.readFileSync(path.join(lhome, put.kept, 'data', 'commands.json'), 'utf8'), '"now"', 'what was there was not kept');
  assert.ok(/^backups\/before-restore-/.test(put.kept));
  assert.equal(again, null);
  assert.equal(climbing.error, 'not_found');
  assert.equal(gone.error, 'not_found');
  assert.equal(JSON.parse(fs.readFileSync(path.join(lhome, launcher.RESTORE_RESULT), 'utf8')).backup, 'daily-gone');
  assert.ok(read('../../start.js').includes('const b = restoreBackup(root);'), 'the launcher never puts one back');
});
fs.rmSync(scratch, { recursive: true, force: true });

test('backups are the streamer\'s, a day apart, and listed under Settings in both languages', () => {
  const ws = read('../api/ws.js');
  assert.ok(/OWNER_ONLY = new Set\(\[[^\]]*C2S\.BACKUPS/.test(ws), 'a moderator could put a backup back');
  assert.ok(ws.includes('return reply(await autoBackups.control(payload));'));
  assert.ok(read('../index.js').includes("initAutoBackups({ restarter: (code) => shutdown('restore', code), obsService: obs });"));
  const src = read('../engine/auto-backups.js');
  assert.ok(src.includes('flushAll();') && src.indexOf('flushAll();') < src.indexOf('await copyTree(config.dataDir'), 'a backup is taken of what was last written, not what is in memory');
  assert.ok(src.includes('timer = setTimeout(daily, Math.max(FIRST_AFTER_MS, last + DAY_MS - Date.now()));'));
  assert.ok(read('../../web/components/views/SettingsView.tsx').includes('{backupsAct && <AutoBackupsPanel'));
  const strings = read('../../web/constants.ts');
  for (const key of ['autoBackupsTitle', 'autoBackupsHint', 'autoBackupUpdate', 'autoBackupsConfirm', 'autoBackupsRestoredOk', 'refuseBackupNotFound', 'refuseBackupFailed', 'refuseBackupBusy', 'refuseBackupUnknownKind', 'refuseBackupUnknownOp']) {
    assert.equal(strings.split(`    ${key}: `).length - 1, 2, key);
  }
});

test('the installer asks English or Spanish every time, and the tray and the first-run setup start in what was chosen', () => {
  const iss = read('../../installer/simonsays.iss');
  assert.ok(iss.includes('ShowLanguageDialog=yes'), 'on an English Windows there is no Spanish installer to choose');
  assert.ok(iss.includes("if ActiveLanguage = 'spanish' then Lang := 'es' else Lang := 'en';") && iss.includes("SaveStringToFile(ExpandConstant('{app}\\language.txt'), Lang, False);"));
  assert.ok(iss.includes('Type: files; Name: "{app}\\language.txt"'), 'the uninstaller leaves language.txt, and so the folder');
  for (const lang of ['english', 'spanish']) for (const msg of ['AutoStart', 'AppComment', 'DeleteDataAsk']) assert.ok(iss.includes(`${lang}.${msg}=`), `${lang}.${msg}`);
  assert.ok(read('../../tray/src/main.rs').includes('match fs::read_to_string(app.join("language.txt"))'));
  assert.ok(read('../engine/install.js').includes("const lang = fs.readFileSync(path.join(app(), 'language.txt'), 'utf8').trim();"));
  assert.ok(read('../../web/components/FirstRun.tsx').includes("if ((w?.language === 'en' || w?.language === 'es') && w.language !== language) setLanguage(w.language);"));
});
