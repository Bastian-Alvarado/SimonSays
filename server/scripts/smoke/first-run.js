/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the first-run setup (engine/first-run.js, 3.0.0) — only on a
 * new install, OBS found from its own settings without its password leaving
 * the server, used only from this machine, and who can open the dashboard
 * kept in the .env, with an installed copy reached from this computer only
 * until the streamer says otherwise.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const { getCollection } = await import('../../core/store.js');

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const firstRun = await import('../../engine/first-run.js');
const install = await import('../../engine/install.js');
const obs = await import('../../platforms/obs.js');
// The OBS connection's settings, as the server makes them (AUTO_START is off here: it reaches for no OBS).
obs.initObs();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-first-run-'));
const refusedWith = async (fn) => { try { await fn(); return null; } catch (err) { return err.code; } };

// Asked once: a new install starts it, and nothing after changes that but finishing it.
firstRun.initFirstRun({ fresh: true });
const fresh = firstRun.firstRunState();
firstRun.initFirstRun({ fresh: false });
const askedAgain = firstRun.firstRunState();
const finished = await firstRun.control({ op: 'done' });
firstRun.initFirstRun({ fresh: true });
const afterFinished = firstRun.firstRunState();

test('the first-run setup is for a new install only, asked once, and once finished it does not come back', () => {
  assert.equal(fresh.done, false);
  assert.equal(askedAgain.done, false, 'a restart before finishing skipped it');
  assert.equal(finished.done, true);
  assert.equal(afterFinished.done, true);
  assert.deepEqual(firstRun.snapshot(), { firstRun: { done: true } });
  // The server looks at the data folder before anything in it is written, then starts the rest.
  const index = read('../index.js');
  const looked = index.indexOf("const fresh = !fs.readdirSync(config.dataDir).some((f) => f.endsWith('.json'));");
  assert.ok(looked > 0 && looked < index.indexOf('initEngine({'), 'the data folder is looked at after the engine has written to it');
});

test('OBS\'s settings are where OBS keeps them, on each system', () => {
  assert.equal(firstRun.obsConfigFile('win32', { APPDATA: 'C:\\Users\\a\\AppData\\Roaming' }, 'C:\\Users\\a').file, 'C:\\Users\\a\\AppData\\Roaming\\obs-studio\\plugin_config\\obs-websocket\\config.json');
  assert.equal(firstRun.obsConfigFile('darwin', {}, '/Users/a').file, '/Users/a/Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json');
  assert.equal(firstRun.obsConfigFile('linux', {}, '/home/a').file, '/home/a/.config/obs-studio/plugin_config/obs-websocket/config.json');
});

// OBS on this computer, as a scratch folder: not installed, installed with its server off, and on with a password.
const obsDir = path.join(scratch, 'obs-studio');
const where = { dir: obsDir, file: path.join(obsDir, 'plugin_config', 'obs-websocket', 'config.json') };
const notInstalled = firstRun.findObs(where);
fs.mkdirSync(path.dirname(where.file), { recursive: true });
const neverSetUp = firstRun.findObs(where);
fs.writeFileSync(where.file, JSON.stringify({ server_enabled: false, server_port: 4455, auth_required: true, server_password: 'pw-from-obs' }));
const off = firstRun.findObs(where);
const offUse = await refusedWith(() => firstRun.useObs(where));
fs.writeFileSync(where.file, JSON.stringify({ server_enabled: true, server_port: 4499, auth_required: true, server_password: 'pw-from-obs' }));
const on = firstRun.findObs(where);
// Used: the connection set to OBS's own settings, then put back as it was for the tests after this one.
const credsBefore = { ...getCollection('obs_credentials').get() };
const used = await firstRun.useObs(where);
const credsUsed = { ...getCollection('obs_credentials').get() };
await obs.disconnect();
getCollection('obs_credentials').set(credsBefore);
const notLocal = await refusedWith(() => firstRun.control({ op: 'obs_use' }, { local: false }));
const unknown = await refusedWith(() => firstRun.control({ op: 'nope' }));

test('OBS is found from its own WebSocket settings, said without its password, and used only when asked, from this machine', () => {
  assert.equal(notInstalled.installed, false);
  assert.equal(neverSetUp.installed, true);
  assert.equal(neverSetUp.found, false);
  assert.equal(off.enabled, false);
  assert.equal(offUse, 'first_run_obs_off');
  assert.deepEqual({ found: on.found, enabled: on.enabled, port: on.port, password: on.password }, { found: true, enabled: true, port: 4499, password: true });
  for (const said of [off, on, used]) assert.ok(!JSON.stringify(said).includes('pw-from-obs'), 'the password was sent to the page');
  assert.deepEqual({ host: credsUsed.host, port: credsUsed.port, password: credsUsed.password }, { host: 'localhost', port: 4499, password: 'pw-from-obs' });
  assert.equal(notLocal, 'secrets_local_only');
  assert.equal(unknown, 'first_run_unknown_op');
});

// Who can open the dashboard: one line of the .env set, the rest left as it was.
const envFile = path.join(scratch, 'home', '.env');
fs.mkdirSync(path.dirname(envFile), { recursive: true });
fs.writeFileSync(envFile, '# mine\nPORT=9000\nHOST=0.0.0.0\nDISCORD_BOT_TOKEN=keep\n');
const envWas = process.env.ENV_FILE;
process.env.ENV_FILE = envFile;
install.setEnvValue('HOST', '127.0.0.1');
const replaced = fs.readFileSync(envFile, 'utf8');
install.setEnvValue('AUTO_START', 'true');
const added = fs.readFileSync(envFile, 'utf8');
if (envWas === undefined) delete process.env.ENV_FILE; else process.env.ENV_FILE = envWas;
const rootWas = process.env.SIMONSAYS_ROOT;
delete process.env.SIMONSAYS_ROOT;
const noLauncher = await refusedWith(() => firstRun.control({ op: 'network', open: true }));
// A launcher that cannot restart it: refused before the .env is written, so the setting does not come in at some later start.
const launcherWas = process.env.SIMONSAYS_LAUNCHER;
process.env.SIMONSAYS_ROOT = path.join(scratch, 'home');
process.env.SIMONSAYS_LAUNCHER = '1';
process.env.ENV_FILE = envFile;
const envBefore = fs.readFileSync(envFile, 'utf8');
const oldLauncher = await refusedWith(() => firstRun.control({ op: 'network', open: true }));
const envAfterRefused = fs.readFileSync(envFile, 'utf8');
if (envWas === undefined) delete process.env.ENV_FILE; else process.env.ENV_FILE = envWas;
if (launcherWas === undefined) delete process.env.SIMONSAYS_LAUNCHER; else process.env.SIMONSAYS_LAUNCHER = launcherWas;
delete process.env.SIMONSAYS_ROOT;
if (rootWas !== undefined) process.env.SIMONSAYS_ROOT = rootWas;

// Where it listens, asked of the real config.js: an installed copy, a copy of its own, and HOST said.
const configUrl = new URL('../config.js', SCRIPT_URL).href;
const hostWith = (vars) => {
  const empty = path.join(scratch, 'empty.env');
  fs.writeFileSync(empty, '');
  // An .env of nothing, so the repository's own is not read instead.
  const env = { ...process.env, ENV_FILE: empty, ...vars };
  delete env.HOST;
  Object.assign(env, vars);
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `const { config } = await import(${JSON.stringify(configUrl)}); console.log(config.host);`], { env, encoding: 'utf8' });
  return r.stdout.trim().split('\n').pop();
};
const hosts = {
  installed: hostWith({ SIMONSAYS_ROOT: path.join(scratch, 'home'), SIMONSAYS_APP: path.join(scratch, 'Programs', 'SimonSays') }),
  ownFolder: hostWith({ SIMONSAYS_ROOT: path.join(scratch, 'copy'), SIMONSAYS_APP: path.join(scratch, 'copy') }),
  noLauncher: hostWith({}),
  said: hostWith({ SIMONSAYS_ROOT: path.join(scratch, 'home'), SIMONSAYS_APP: path.join(scratch, 'Programs', 'SimonSays'), HOST: '0.0.0.0' }),
};
fs.rmSync(scratch, { recursive: true, force: true });

test('who can open the dashboard is one line in the .env; an installed copy is this computer\'s only until the streamer says otherwise', () => {
  assert.equal(replaced, '# mine\nPORT=9000\nHOST=127.0.0.1\nDISCORD_BOT_TOKEN=keep\n');
  assert.equal(added, '# mine\nPORT=9000\nHOST=127.0.0.1\nDISCORD_BOT_TOKEN=keep\nAUTO_START=true\n');
  assert.equal(noLauncher, 'install_no_launcher');
  assert.equal(oldLauncher, 'install_old_launcher');
  assert.equal(envAfterRefused, envBefore, 'a refused change was written to the .env anyway');
  assert.deepEqual(hosts, { installed: '127.0.0.1', ownFolder: '0.0.0.0', noLauncher: '0.0.0.0', said: '0.0.0.0' });
  assert.deepEqual(firstRun.networkState().open, !['127.0.0.1', 'localhost', '::1'].includes(firstRun.networkState().host));
});

test('the setup is the streamer\'s, shown over the dashboard to them only, and its words are in both languages', () => {
  const ws = read('../api/ws.js');
  assert.ok(/OWNER_ONLY = new Set\(\[[^\]]*C2S\.FIRST_RUN/.test(ws), 'a moderator could run the setup');
  assert.ok(ws.includes('return reply(await firstRun.control(payload, { local: ws.isLocal }));'));
  assert.ok(ws.includes('...firstRun.snapshot(),'));
  assert.ok(read('../../web/hooks/useStreamSystem.ts').includes('firstRun: (snapshot as any).firstRun || null,'), 'the page never hears of it');
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("{!system.auth.isMod && !showIntro && (system.data as any).firstRun?.done === false && ("));
  const strings = read('../../web/constants.ts');
  for (const key of ['firstRunWelcome', 'firstRunNetworkTitle', 'firstRunNetworkOpenHint', 'firstRunObsConsent', 'firstRunObsOff', 'firstRunDoneHint', 'refuseFirstRunObsNotFound', 'refuseFirstRunObsOff', 'refuseFirstRunUnknownOp']) {
    assert.equal(strings.split(`    ${key}: `).length - 1, 2, key);
  }
});
