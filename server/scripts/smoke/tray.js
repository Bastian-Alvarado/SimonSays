/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the tray (tray/, SimonSays.exe, 3.0.0) and how it stops the
 * app — the launcher told "stop" on its stdin, or the tray gone and the pipe
 * closed, asks the server to stop over the channel it already has, since
 * Windows has no signal for it; the server saves and says goodbye.
 *
 * The launcher is run for real here, with a stand-in server; the tray itself
 * is a Rust program, built by scripts/portable.mjs, and is held to its rules
 * by what it says.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'simonsays-tray-'));

// An app with the real launcher and a server that only says it is up, and how it was asked to stop.
const app = path.join(scratch, 'app');
fs.mkdirSync(path.join(app, 'server'), { recursive: true });
fs.copyFileSync(new URL('../../start.js', SCRIPT_URL), path.join(app, 'start.js'));
fs.writeFileSync(path.join(app, 'server', 'index.js'), `
import fs from 'node:fs';
process.send({ type: 'simonsays-ready', version: '0.0.0' });
process.on('message', (m) => { if (m?.type === 'simonsays-stop') { fs.writeFileSync(process.env.STOPPED_FILE, 'asked'); process.exit(0); } });
setInterval(() => {}, 1000);
`);

/** The launcher, as the tray starts it; `how` stops it. Resolves with how it went. */
const runLauncher = (name, how) => new Promise((resolve) => {
  const home = path.join(scratch, `home-${name}`);
  const stopped = path.join(scratch, `stopped-${name}`);
  const child = spawn(process.execPath, [path.join(app, 'start.js')], {
    cwd: app,
    env: { ...process.env, SIMONSAYS_CONTROL: 'stdin', SIMONSAYS_HOME: home, STOPPED_FILE: stopped },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let said = '';
  child.stdout.on('data', (d) => { said += d; });
  const at = Date.now();
  const giveUp = setTimeout(() => { child.kill(); }, 12_000);
  child.on('exit', (code) => {
    clearTimeout(giveUp);
    resolve({ code, asked: fs.existsSync(stopped), ms: Date.now() - at, said });
  });
  setTimeout(() => how(child), 1200);
});
const typed = await runLauncher('typed', (c) => c.stdin.write('stop\n'));
const closed = await runLauncher('closed', (c) => c.stdin.end());

test('told "stop" by the tray, or with the tray gone, the launcher asks the server to stop and stops after it', () => {
  assert.equal(typed.asked, true, `the server was not asked: ${typed.said}`);
  assert.equal(typed.code, 0);
  assert.ok(typed.ms < 8000, `it took ${typed.ms} ms`);
  assert.equal(closed.asked, true, 'a tray that is gone left the app running');
  assert.equal(closed.code, 0);
  // Only when the tray says so: a console's own stdin is left alone.
  assert.ok(read('../../start.js').includes("if (process.env.SIMONSAYS_CONTROL === 'stdin') {"));
  assert.ok(read('../index.js').includes("process.on('message', (m) => { if (m?.type === 'simonsays-stop') shutdown('stop'); });"), 'the server does not stop when asked');
});
fs.rmSync(scratch, { recursive: true, force: true });

test('the tray starts the app on its own Node with no console, keeps one running, and stops it cleanly before by force', () => {
  const tray = read('../../tray/src/main.rs');
  assert.ok(tray.includes('#![cfg_attr(windows, windows_subsystem = "windows")]'), 'the tray opens a console window');
  assert.ok(tray.includes('.env("SIMONSAYS_CONTROL", "stdin")'));
  assert.ok(tray.includes('cmd.creation_flags(CREATE_NO_WINDOW);'));
  assert.ok(tray.includes('let _ = stdin.write_all(b"stop\\n");') && tray.includes('os::kill_tree(&mut child);'), 'Quit is a kill');
  assert.ok(tray.includes('const STOP_WITHIN: Duration = Duration::from_secs(20);'));
  assert.ok(tray.includes('const MUTEX: &str = "Local\\\\SimonSaysTray";') && tray.includes('CreateMutexW(std::ptr::null(), 1, name.as_ptr())'), 'two trays could start two apps');
  // --quit, for the installer: the one running is asked, the same way as its Quit, and waited for until it is gone.
  assert.ok(tray.includes('if std::env::args().any(|a| a == "--quit") {') && tray.includes('Event::UserEvent(UserEvent::QuitAsked) => {'));
  assert.ok(tray.includes('unsafe { WaitForSingleObject(mutex, QUIT_WAIT_MS) };'));
  // Its home is start.js's: SIMONSAYS_HOME, the user's own folder for an installed copy, or its own.
  assert.ok(tray.includes('app.join("installed.json").exists()') && tray.includes('base.join("SimonSays")'));
  assert.ok(tray.includes(`format!("\\"{}\\" --background", exe.display())`), 'Start with Windows opens the dashboard at every sign-in');
  // The menu in both languages.
  for (const words of ['Open the dashboard', 'Abrir el panel', 'Start with Windows', 'Iniciar con Windows', 'Quit SimonSays', 'Salir de SimonSays']) assert.ok(tray.includes(`"${words}"`), words);
  assert.ok(read('../../scripts/portable.mjs').includes("run('cargo build --release --locked', [], { cwd: tray, shell: true });"));
  assert.ok(fs.existsSync(new URL('../../tray/Cargo.lock', SCRIPT_URL)), 'the tray is built from whatever versions are newest that day');
});

test('the installer is for the person installing, keeps their things apart from the program, and asks a running copy to quit first', () => {
  const iss = read('../../installer/simonsays.iss');
  assert.ok(iss.startsWith('\uFEFF'), 'without its BOM, the Spanish words are read wrong');
  for (const line of ['PrivilegesRequired=lowest', 'DefaultDirName={autopf}\\SimonSays', 'AppId={{7CE81691-828C-415F-834E-F1C18D69F7B3}', 'Name: "spanish"; MessagesFile: "compiler:Languages\\Spanish.isl"']) assert.ok(iss.includes(line), line);
  // Replaced whole, never the data: it is not in the program's folder.
  for (const dir of ['node', 'server', 'shared', 'web']) assert.ok(iss.includes(`Type: filesandordirs; Name: "{app}\\${dir}"`), dir);
  assert.ok(!/Name: "\{app\}\\(data|assets)/.test(iss) && !iss.includes('{app}\\.env'));
  // A running SimonSays quits cleanly before the program is replaced or removed.
  assert.ok(iss.includes("Exec(Dir + '\\SimonSays.exe', '--quit', Dir, SW_HIDE, ewWaitUntilTerminated, Code);"));
  assert.ok(iss.includes('function PrepareToInstall(') && iss.includes('function InitializeUninstall()'));
  // Uninstalling keeps the data unless the person says yes; a silent one never deletes it; No is the default.
  assert.ok(iss.includes('if DirExists(Home) and not UninstallSilent then') && iss.includes('MB_YESNO or MB_DEFBUTTON2) = IDYES then'));
  assert.ok(iss.includes("Home := ExpandConstant('{localappdata}\\SimonSays');"), 'the uninstaller deletes somewhere other than the home start.js keeps');
  assert.ok(iss.includes('ValueData: """{app}\\SimonSays.exe"" --background"'), 'the installer\'s Start with Windows differs from the tray\'s');
  const builder = read('../../scripts/installer.mjs');
  assert.ok(builder.includes("if (!fs.existsSync(path.join(app, 'installed.json'))) fail("), 'an installer could keep the data in the program folder');
  assert.ok(builder.includes("if (!fs.existsSync(path.join(app, 'SimonSays.exe'))) fail("));
  // The paths an install has to hold under Windows' limit.
  const portable = read('../../scripts/portable.mjs');
  assert.ok(portable.includes('const MAX_PATH_IN = 170;') && portable.includes('if (deepest.length > MAX_PATH_IN) fail('));
});
