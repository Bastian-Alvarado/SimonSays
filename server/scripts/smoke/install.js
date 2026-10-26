/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: where a copy keeps the streamer's things, and bringing in an
 * existing SimonSays (3.0.0) — the launcher's home (start.js homeFor), an
 * installed copy running its program on its home's data, and the copy made
 * before the server starts, with what was there kept in a backup.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SCRIPT_URL, assert, fs, test, settle } from './harness.js';

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const launcher = await import('../../../start.js');
const install = await import('../../engine/install.js');
const { config } = await import('../../config.js');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-install-'));
const put = (file, text = '{}') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

test('an installed copy keeps your things in your own app-data folder, where each system keeps them', () => {
  assert.equal(launcher.userDataDir('win32', { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'C:\\Users\\a'), 'C:\\Users\\a\\AppData\\Local\\SimonSays');
  assert.equal(launcher.userDataDir('win32', { USERPROFILE: 'C:\\Users\\a' }, 'C:\\Users\\a'), 'C:\\Users\\a\\AppData\\Local\\SimonSays');
  assert.equal(launcher.userDataDir('darwin', {}, '/Users/a'), '/Users/a/Library/Application Support/SimonSays');
  assert.equal(launcher.userDataDir('linux', { XDG_DATA_HOME: '/x' }, '/home/a'), '/x/simonsays');
  assert.equal(launcher.userDataDir('linux', {}, '/home/a'), '/home/a/.local/share/simonsays');
});

// A git or zip copy, an installed one (installed.json beside start.js), and one told where with SIMONSAYS_HOME.
const gitCopy = path.join(scratch, 'git-copy');
const program = path.join(scratch, 'Programs', 'SimonSays');
const home = path.join(scratch, 'AppData', 'SimonSays');
put(path.join(gitCopy, 'start.js'), '');
put(path.join(program, launcher.INSTALLED_FILE), '{}');

test('a git or zip copy\'s home is its own folder, as it always was; an installed copy\'s is the user\'s; SIMONSAYS_HOME says where for either', () => {
  assert.equal(launcher.homeFor(gitCopy, {}), gitCopy);
  assert.equal(launcher.homeFor(program, { LOCALAPPDATA: path.join(scratch, 'AppData') }, 'win32'), path.join(scratch, 'AppData', 'SimonSays'));
  assert.equal(launcher.homeFor(gitCopy, { SIMONSAYS_HOME: home }), home);
});

// The installed copy: its program is a version of its own; versions updated to are in its home.
const makeServer = (dir, version) => { put(path.join(dir, 'server', 'index.js'), ''); if (version) put(path.join(dir, 'shared', 'version.js'), `export const VERSION = '${version}';\n`); };
makeServer(program, '3.0.0');
makeServer(path.join(home, 'versions', '3.1.0'), '3.1.0');
put(path.join(home, '.env'), 'PORT=1\n');
const none = launcher.chooseCurrent(home, program);
fs.writeFileSync(path.join(home, 'current.json'), JSON.stringify({ version: '3.1.0', dir: 'versions/3.1.0', previous: { version: '3.0.0', dir: '.' } }));
const updated = launcher.chooseCurrent(home, program);
const envUpdated = launcher.envFor(home, updated.abs, {}, program);
const envProgram = launcher.envFor(home, program, {}, program);
// Back from 3.1.0: to the program itself.
launcher.rollBack(home);
const wentBack = launcher.chooseCurrent(home, program);
// Installed again, newer than the version updated to: the program runs.
fs.writeFileSync(path.join(home, 'current.json'), JSON.stringify({ version: '3.1.0', dir: 'versions/3.1.0', previous: { version: '3.0.0', dir: '.' } }));
makeServer(program, '3.2.0');
const reinstalled = launcher.chooseCurrent(home, program);
const reinstalledFile = JSON.parse(fs.readFileSync(path.join(home, 'current.json'), 'utf8'));

const configUrl = new URL('../config.js', SCRIPT_URL).href;
const placesWith = (vars) => {
  const env = { ...process.env, ...vars };
  for (const k of ['DATA_DIR', 'ASSETS_DIR']) delete env[k];
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `const { config } = await import(${JSON.stringify(configUrl)}); console.log(JSON.stringify({ data: config.dataDir, assets: config.assetsDir }));`], { env, encoding: 'utf8' });
  return r.status === 0 ? JSON.parse(r.stdout.trim().split('\n').pop()) : { error: r.stderr };
};
const placed = placesWith(envProgram);

test('an installed copy runs its program, or a version updated to in its home, and always on its home\'s data, pictures and .env', () => {
  assert.equal(none, null);
  assert.equal(launcher.codeDirFor(program, none), program, 'with nothing updated to, the program runs');
  assert.equal(updated.abs, path.join(home, 'versions', '3.1.0'));
  assert.equal(envUpdated.SIMONSAYS_ROOT, home);
  assert.equal(envUpdated.SIMONSAYS_APP, program);
  assert.equal(envProgram.ENV_FILE, path.join(home, '.env'), 'the program reads an .env of its own, not the home\'s');
  assert.deepEqual(placed, { data: path.join(home, 'data'), assets: path.join(home, 'assets') }, 'the program keeps data beside itself');
  assert.equal(wentBack, null, 'going back from an update did not go back to the program');
  assert.equal(reinstalled, null, 'an older version updated to ran over a newer install');
  assert.equal(reinstalledFile.version, '3.2.0');
  // The updater names the program as '.', the version to go back to, though it is outside the home.
  assert.ok(read('../engine/updater.js').includes("const here = !rel || rel.startsWith('..') || path.isAbsolute(rel) ? '.' : rel;"));
  assert.equal(launcher.RESTART_TO_BRING_IN, install.RESTART_TO_BRING_IN, 'the launcher and the server disagree on the exit code');
});

// An old copy to bring in: data, pictures, an .env that moved nothing; and the home, with things of its own.
const old = path.join(scratch, 'old-copy');
put(path.join(old, 'data', 'commands.json'), JSON.stringify({ a: 1, b: 2, c: 3 }));
put(path.join(old, 'data', 'layouts.json'), JSON.stringify({ x: {}, y: {} }));
put(path.join(old, 'data', 'twitch_credentials.json'), '{"secret":"never read"}');
put(path.join(old, 'assets', 'media', 'pic.png'), 'png');
put(path.join(old, '.env'), 'PORT=8081\nDATA_DIR=../data\nDISCORD_BOT_TOKEN=abc\n');
put(path.join(old, 'shared', 'version.js'), "export const VERSION = '2.4.0';\n");
const bhome = path.join(scratch, 'bring-home');
put(path.join(bhome, 'data', 'layouts.json'), '{"mine":{}}');
put(path.join(bhome, '.env'), 'PORT=2\n');
const at = new Date('2026-10-25T12:00:00Z');
// Asked at a time: the launcher only carries out a request made for this start.
const ask = (what, when = at) => put(path.join(bhome, launcher.BRING_IN_FILE), JSON.stringify({ at: when.getTime(), ...what }));
ask({ from: old, data: path.join(old, 'data'), assets: path.join(old, 'assets'), env: path.join(old, '.env') });
const brought = launcher.bringIn(bhome, at);
const again = launcher.bringIn(bhome, at);
const backupDir = path.join(bhome, brought.backup || 'none');

test('the launcher brings an existing SimonSays in before the server starts: its data, pictures and .env, with what was here kept in a backup', () => {
  assert.equal(brought.ok, true, JSON.stringify(brought));
  assert.ok(fs.existsSync(path.join(bhome, 'data', 'commands.json')) && !fs.existsSync(path.join(bhome, 'data', 'mine')));
  assert.ok(fs.existsSync(path.join(bhome, 'assets', 'media', 'pic.png')));
  assert.equal(fs.readFileSync(path.join(backupDir, 'data', 'layouts.json'), 'utf8'), '{"mine":{}}', 'what was here is not in the backup');
  assert.equal(fs.readFileSync(path.join(backupDir, '.env'), 'utf8'), 'PORT=2\n');
  assert.deepEqual(brought.moved, ['data', '.env']);
  const env = fs.readFileSync(path.join(bhome, '.env'), 'utf8');
  assert.ok(env.includes('DISCORD_BOT_TOKEN=abc') && env.includes('# left behind when this was brought in: DATA_DIR=../data') && !/^DATA_DIR=/m.test(env), env);
  // Asked once, done once; how it went kept for the screen.
  assert.ok(!fs.existsSync(path.join(bhome, launcher.BRING_IN_FILE)));
  assert.equal(again, null);
  assert.equal(JSON.parse(fs.readFileSync(path.join(bhome, launcher.BRING_IN_RESULT), 'utf8')).from, old);
  // The old copy is left as it was.
  assert.ok(fs.existsSync(path.join(old, 'data', 'commands.json')) && fs.existsSync(path.join(old, '.env')));
});

// Refused: a folder that is not one, one inside this home; and one that fails half way, put back.
ask({ from: scratch, data: path.join(scratch, 'nothing') });
const notFound = launcher.bringIn(bhome, at);
ask({ from: bhome, data: path.join(bhome, 'data') });
const samePlace = launcher.bringIn(bhome, at);
const homeBefore = fs.readFileSync(path.join(bhome, 'data', 'commands.json'), 'utf8');
const oneOClock = new Date('2026-10-25T13:00:00Z');
ask({ from: old, data: path.join(old, 'data'), assets: path.join(old, 'assets'), env: path.join(old, 'data') }, oneOClock);
const halfWay = launcher.bringIn(bhome, oneOClock);
// Asked an hour ago, while a launcher that knew nothing of it ran: not done now.
ask({ from: old, data: path.join(old, 'data') }, at);
const stale = launcher.bringIn(bhome, oneOClock);
const afterStale = fs.readFileSync(path.join(bhome, 'data', 'commands.json'), 'utf8');

test('a folder with no SimonSays, or this one\'s own, is refused, and one that fails half way puts back what was here', () => {
  assert.equal(notFound.ok, false);
  assert.equal(notFound.error, 'not_found');
  assert.equal(samePlace.error, 'same_place');
  assert.equal(halfWay.ok, false);
  assert.equal(halfWay.error, 'copy_failed');
  assert.equal(stale.error, 'stale', 'a request from long ago was carried out');
  assert.equal(afterStale, homeBefore);
  // What a brought-in .env says about where updates come from is left out.
  assert.ok(launcher.movedEnv('UPDATE_REPO=evil/x\nUPDATE_API=http://x\nPORT=1').split('\n').every((l) => l === 'PORT=1' || l.startsWith('# left behind')));
  assert.equal(fs.readFileSync(path.join(bhome, 'data', 'commands.json'), 'utf8'), homeBefore, 'what was here was lost');
  assert.ok(fs.existsSync(path.join(bhome, 'assets', 'media', 'pic.png')) && fs.existsSync(path.join(bhome, '.env')));
});

// The server's half: finding the copy somebody pasted, saying what is in it, and asking the launcher.
const moved = path.join(scratch, 'moved-copy');
put(path.join(moved, 'server', '.env'), 'DATA_DIR=../../elsewhere-data\nASSETS_DIR="../../elsewhere-assets"\n');
put(path.join(scratch, 'elsewhere-data', 'alerts.json'), '[1,2]');
fs.mkdirSync(path.join(scratch, 'elsewhere-assets'), { recursive: true });
const was = process.env.SIMONSAYS_ROOT;
const restarted = [];
install.initInstall({ restarter: (code) => restarted.push(code) });
const refusedWith = (fn) => { try { fn(); return null; } catch (err) { return err.code; } };
delete process.env.SIMONSAYS_ROOT;
const noLauncher = refusedWith(() => install.bringIn(old));
const ahome = path.dirname(config.dataDir);
const launcherWas = process.env.SIMONSAYS_LAUNCHER;
// A copy whose data is not where the launcher looks, and one run by a launcher from before 3.0.0, are refused.
process.env.SIMONSAYS_ROOT = path.join(scratch, 'elsewhere-home');
process.env.SIMONSAYS_LAUNCHER = launcher.LAUNCHER_VERSION;
const dataMoved = refusedWith(() => install.bringIn(old));
process.env.SIMONSAYS_ROOT = ahome;
process.env.SIMONSAYS_LAUNCHER = '1';
const oldLauncher = refusedWith(() => install.bringIn(old));
const oldLauncherLook = refusedWith(() => install.lookAt(old));
process.env.SIMONSAYS_LAUNCHER = launcher.LAUNCHER_VERSION;
const looked = install.lookAt(old);
const where = install.whereThingsAre();
const inHome = refusedWith(() => { put(path.join(ahome, 'copy', 'data', 'commands.json')); return install.lookAt(path.join(ahome, 'copy')); });
const nothing = refusedWith(() => install.lookAt(path.join(scratch, 'nothing-here')));
const itself = refusedWith(() => install.lookAt(path.dirname(config.dataDir)));
const asked = install.bringIn(`"${path.join(old, 'server')}"`);
const request = JSON.parse(fs.readFileSync(path.join(ahome, 'bring-in.json'), 'utf8'));
await settle(); await new Promise((r) => setTimeout(r, 700));
if (was === undefined) delete process.env.SIMONSAYS_ROOT; else process.env.SIMONSAYS_ROOT = was;
if (launcherWas === undefined) delete process.env.SIMONSAYS_LAUNCHER; else process.env.SIMONSAYS_LAUNCHER = launcherWas;
fs.rmSync(path.join(ahome, 'bring-in.json'), { force: true });
fs.rmSync(path.join(ahome, 'copy'), { recursive: true, force: true });

test('the screen finds the copy pasted — its folder, server or data, wherever its .env moved things — and says what is in it, never what its accounts hold', () => {
  for (const typed of [old, path.join(old, 'server'), path.join(old, 'data'), `"${old}"`]) assert.equal(install.findExisting(typed)?.root, old, typed);
  const found = install.findExisting(moved);
  assert.equal(found.data, path.join(scratch, 'elsewhere-data'));
  assert.equal(found.assets, path.join(scratch, 'elsewhere-assets'));
  assert.equal(install.findExisting(''), null);
  assert.equal(looked.version, '2.4.0');
  assert.deepEqual(looked.counts, { layouts: 2, commands: 3, actions: 0, alerts: 0 });
  assert.deepEqual(looked.accounts, ['Twitch']);
  assert.equal(looked.env, true);
  assert.ok(!JSON.stringify(looked).includes('never read'), 'a token was read out');
  assert.equal(where.home, ahome);
  assert.equal(where.launcher, true);
  assert.equal(inHome, 'install_same_place');
  assert.equal(nothing, 'install_not_found');
  assert.equal(noLauncher, 'install_no_launcher');
  assert.equal(dataMoved, 'install_data_moved', 'a copy that keeps its data elsewhere could be brought into a folder it does not read');
  assert.equal(oldLauncher, 'install_old_launcher', 'an older launcher would leave the request for a later start');
  assert.equal(oldLauncherLook, 'install_old_launcher');
  assert.equal(itself, 'install_same_place', 'this copy could bring in itself');
});

test('bringing in asks the launcher and stops for it, with the exit code it waits for; only the streamer may, and Settings shows it', () => {
  assert.equal(asked.ok, true);
  assert.equal(request.from, old);
  assert.equal(request.data, path.join(old, 'data'));
  assert.equal(request.env, path.join(old, '.env'));
  assert.deepEqual(restarted, [76]);
  const ws = read('../api/ws.js');
  assert.ok(/OWNER_ONLY = new Set\(\[[^\]]*C2S\.INSTALL/.test(ws), 'a moderator could bring a copy in');
  assert.ok(ws.includes('return reply(install.control(payload));'));
  assert.ok(ws.includes("mayChangeThisComputer(ws, payload, ['look', 'bring_in']);") && ws.includes("mayChangeThisComputer(ws, payload, ['take', 'restore']);") && ws.includes("mayChangeThisComputer(ws, payload, ['network']);"), 'any device on the network could bring a copy in while sign-in is off');
  assert.ok(ws.includes("if (ws.isLocal || (auth.isEnabled() && ws.who?.role === 'owner')) return;"));
  assert.ok(read('../index.js').includes("initInstall({ restarter: (code) => shutdown('bring-in', code), obsService: obs });"));
  assert.ok(read('../../start.js').includes('if (code === RESTART_TO_BRING_IN) { bringing(); start(); return; }'));
  assert.ok(read('../../web/components/views/SettingsView.tsx').includes('{owner && installAct && <BringInPanel'));
  const strings = read('../../web/constants.ts');
  for (const key of ['bringInTitle', 'bringInHint', 'bringInWhere', 'bringInDoneBackup', 'bringInFailed', 'bringInConfirm', 'refuseInstallNotFound', 'refuseInstallSamePlace', 'refuseInstallNoLauncher', 'refuseInstallUnknownOp']) {
    assert.equal(strings.split(`    ${key}: `).length - 1, 2, key);
  }
});

fs.rmSync(scratch, { recursive: true, force: true });
