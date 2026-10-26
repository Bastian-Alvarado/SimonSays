/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The first-run setup (3.0.0): what a new install asks before anything
 * else — the language, bringing in an existing SimonSays, who can open the
 * dashboard, and finding OBS — and then hands over to the Guides' setup
 * steps for the platforms.
 *
 * Only on a new install: the data folder was empty when the server started.
 * Every copy that already had data — one updated from before, one brought in
 * — counts as set up, so nobody who knows the app is walked through it.
 *
 * Finding OBS reads OBS's own WebSocket settings (obs-websocket's
 * config.json, where OBS keeps them) for whether its server is on, its port
 * and whether it has a password; only when the streamer says to use them is
 * the password read and kept, as the OBS connection's own, and only from the
 * machine running the server. It is never sent to a page.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { refusal } from '../core/refusal.js';
import { config } from '../config.js';
import * as obs from '../platforms/obs.js';
import { setEnvValue, restartApp, mayRestart, whereThingsAre } from './install.js';

let store = null;

/**
 * `fresh`: the data folder had nothing in it when the server started (index.js
 * looks before anything is created). Asked once: what it says is kept.
 */
export function initFirstRun({ fresh = false } = {}) {
  store = collection('first_run', null);
  if (!store.get()) store.set({ done: !fresh, at: Date.now() });
}

export const firstRunState = () => ({ done: store?.get()?.done !== false });
export const snapshot = () => ({ firstRun: firstRunState() });
const publish = () => bus.emit(EVENTS.CONFIG, { key: 'firstRun', value: firstRunState() });

/** Where OBS keeps its settings, on each system, and obs-websocket's among them. */
export function obsConfigFile(platform = process.platform, env = process.env, home = os.homedir()) {
  const dir = platform === 'win32'
    ? path.win32.join(env.APPDATA || path.win32.join(home, 'AppData', 'Roaming'), 'obs-studio')
    : platform === 'darwin'
      ? path.posix.join(home, 'Library', 'Application Support', 'obs-studio')
      : path.posix.join(env.XDG_CONFIG_HOME || path.posix.join(home, '.config'), 'obs-studio');
  const join = platform === 'win32' ? path.win32.join : path.posix.join;
  return { dir, file: join(dir, 'plugin_config', 'obs-websocket', 'config.json') };
}

const readObsWebsocket = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

/** What is known about OBS on this computer, without its password: installed, its WebSocket server on, the port, whether a password is set. */
export function findObs(where = obsConfigFile()) {
  const ws = readObsWebsocket(where.file);
  const status = obs.getStatus();
  return {
    installed: fs.existsSync(where.dir),
    found: Boolean(ws),
    enabled: Boolean(ws) && ws.server_enabled !== false,
    port: Number(ws?.server_port) || 4455,
    password: Boolean(ws) && ws.auth_required !== false && Boolean(ws.server_password),
    status: status.status,
    error: status.error || null,
  };
}

/** OBS's own settings, used: the connection set to them, and tried. */
export async function useObs(where = obsConfigFile()) {
  const ws = readObsWebsocket(where.file);
  if (!ws) throw refusal('first_run_obs_not_found', 'OBS\'s WebSocket settings were not found on this computer');
  if (ws.server_enabled === false) throw refusal('first_run_obs_off', 'OBS\'s WebSocket server is off: OBS → Tools → WebSocket Server Settings → Enable');
  obs.setCredentials({
    host: 'localhost',
    port: Number(ws.server_port) || 4455,
    password: ws.auth_required !== false ? String(ws.server_password || '') : '',
  });
  await obs.connect().catch(() => { /* said in the status */ });
  return findObs(where);
}

/** Who can open the dashboard: only this computer, or every device on the network as well. */
export const networkState = () => ({ open: !['127.0.0.1', 'localhost', '::1'].includes(config.host), host: config.host, port: config.port });

export function setNetwork(open) {
  if (!whereThingsAre().launcher) throw refusal('install_no_launcher', 'start the app with npm start (start.js) to change this from here');
  // Asked before anything is written: a setting saved now but refused a restart would come into force at some later one.
  mayRestart();
  setEnvValue('HOST', open ? '0.0.0.0' : '127.0.0.1');
  restartApp();
  return { ok: true, open: Boolean(open) };
}

export async function control(payload = {}, { local = false } = {}) {
  if (payload.op === 'state') return { ...firstRunState(), network: networkState(), launcher: whereThingsAre().launcher };
  if (payload.op === 'done') { store.set({ ...store.get(), done: true, doneAt: Date.now() }); publish(); return firstRunState(); }
  if (payload.op === 'obs_find') return findObs();
  if (payload.op === 'obs_use') {
    // A password from this machine's own files, kept as the connection's: from this machine only, as secrets are.
    if (!local) throw refusal('secrets_local_only', 'secrets can only be set from the machine running the server');
    return useObs();
  }
  if (payload.op === 'network') return setNetwork(Boolean(payload.open));
  throw refusal('first_run_unknown_op', 'unknown request');
}
