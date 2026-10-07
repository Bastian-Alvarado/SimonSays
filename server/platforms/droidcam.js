/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * DroidCam: camera control over the phone app's own HTTP server.
 *
 * The app serves a remote-control page on the LAN (port 4747 by default) and
 * that page drives the camera with plain HTTP. This speaks the same endpoints,
 * so a chat command or a dock button can zoom, kill the flash, or switch to
 * the front camera mid-stream.
 *
 * Two things worth knowing about this API:
 *
 *   - It is UNDOCUMENTED. Dev47Apps has never published it; the request for a
 *     REST API (droidcam-linux-client#140, 2021) was never answered, and the
 *     official Linux client does not use HTTP at all — it speaks a raw TCP
 *     protocol, so it is no reference either. Everything here was read out of
 *     the app's own remote page. An app update could rename any of it without
 *     a changelog, which is why failures say what they tried.
 *
 *   - Controls are PUT, reads are GET, and there is no authentication. Anything
 *     on the network can drive the camera; that is the app's design, not a
 *     choice made here.
 *
 * Ranges are read from the device rather than hardcoded: `/v1/camera/info`
 * reports the real limits, and they differ per phone and per lens.
 */

import { collection } from '../core/store.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('droidcam');

/**
 * The camera ramps to a new value rather than jumping, so reading it back
 * needs to wait for it to stop moving.
 *
 * A fixed delay is the wrong tool: measured on a real device, 1x -> 8x takes
 * about 1.3 seconds, while nudging 3.0x -> 3.5x is done almost at once. So
 * this polls until two consecutive reads agree, which costs one request for a
 * small change and a handful for a big one.
 *
 * The cap matters because not every value ramps — switching camera or white
 * balance mode is instant — and a control that never settles must not hold an
 * action open forever.
 */
const SETTLE_POLL_MS = 120;
const SETTLE_TIMEOUT_MS = 2000;

let settings = null;
/** Last successful contact, so the UI can say whether the phone is reachable. */
let reachable = false;
let lastError = '';

export function initDroidcam() {
  settings = collection('droidcam_settings', { host: '', port: 4747 });
}

const base = () => {
  const s = settings?.get() ?? {};
  if (!s.host) return null;
  return `http://${s.host}:${s.port || 4747}`;
};

export const getSettings = () => {
  const s = settings?.get() ?? {};
  return { host: s.host || '', port: s.port || 4747, reachable, lastError };
};

export function setSettings(patch) {
  const s = settings.get();
  const next = {
    host: typeof patch?.host === 'string' ? patch.host.trim() : s.host,
    port: Number(patch?.port) > 0 ? Math.min(65535, Math.round(Number(patch.port))) : s.port,
  };
  settings.set(next);
  // A new address has not been proven yet; saying "reachable" because the old
  // one was would be a lie the UI then shows.
  reachable = false;
  lastError = '';
  return getSettings();
}

/**
 * One request, with a short deadline.
 *
 * A phone that has gone to sleep or left the network does not refuse the
 * connection — it simply never answers, so without this an action step would
 * hang for the whole default socket timeout while the stream waited on it.
 */
async function request(path, method = 'GET') {
  const root = base();
  if (!root) throw new Error('DroidCam: no address set — add the phone on the Connections screen');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${root}${path}`, { method, signal: controller.signal });
    if (!res.ok) throw new Error(`DroidCam ${res.status} on ${method} ${path}`);
    reachable = true;
    lastError = '';
    const text = await res.text();
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  } catch (err) {
    reachable = false;
    lastError = err.name === 'AbortError'
      ? `no answer from ${root} — is DroidCam open and the phone awake?`
      : err.message;
    throw new Error(lastError);
  } finally {
    clearTimeout(timer);
  }
}

/** Everything the camera reports it can do, including the real value ranges. */
export const info = () => request('/v1/camera/info');

/** `0 - Back`, `1 - Front`, as the device names them. */
export async function cameraList() {
  const raw = await request('/v1/camera/camera_list');
  return String(raw || '')
    .split('\n')
    .map((line) => {
      const m = /^\s*(\d+)\s*-\s*(.+?)\s*$/.exec(line);
      return m ? { id: Number(m[1]), name: m[2] } : null;
    })
    .filter(Boolean);
}

export const phoneName = () => request('/v1/phone/name');
export const batteryInfo = () => request('/v1/phone/battery_info');

/** Controls that take no argument. */
const TOGGLES = {
  torch: '/v1/camera/torch_toggle',
  autofocus: '/v1/camera/autofocus',
  exposure_lock: '/v1/camera/ae_toggle',
  exposure_level_lock: '/v1/camera/el_toggle',
  wb_lock: '/v1/camera/wbl_toggle',
  mic: '/v1/camera/mic_toggle',
};

/**
 * Controls that take a value, and how it must be written.
 *
 * `decimals` matters: the remote page sends zoom and manual focus with one
 * decimal place and everything else as whole numbers. Zoom really does accept
 * 3.5 — sending 4 instead would quietly be a different shot.
 *
 * `range` names the pair of fields in /v1/camera/info that bound it, so the
 * value can be clamped against the actual device rather than a guess.
 */
const VALUES = {
  zoom: { path: '/v3/camera/zoom/', decimals: 1, range: ['zmMin', 'zmMax'], field: 'zmValue' },
  focus: { path: '/v3/camera/mf/', decimals: 1, range: ['mfMin', 'mfMax'], field: 'mfValue' },
  exposure: { path: '/v3/camera/ev/', decimals: 0, range: ['evMin', 'evMax'], field: 'evValue' },
  iso: { path: '/v3/camera/iso/', decimals: 0, range: ['isoMin', 'isoMax'], field: 'isoValue' },
  shutter: { path: '/v3/camera/ss/', decimals: 0, range: ['ssMin', 'ssMax'], field: 'ssValue' },
  white_balance: { path: '/v2/camera/wb_level/', decimals: 0, range: ['wbMin', 'wbMax'], field: 'wbValue' },
  autofocus_mode: { path: '/v1/camera/autofocus_mode/', decimals: 0, field: 'focusMode' },
  wb_mode: { path: '/v1/camera/wb_mode/', decimals: 0, field: 'wbMode' },
  camera: { path: '/v1/camera/active/', decimals: 0, field: 'active' },
};

/** The ops an action step may ask for, for validation and for the UI. */
export const OPERATIONS = [
  ...Object.keys(TOGGLES),
  ...Object.keys(VALUES),
  'zoom_in',
  'zoom_out',
];

/**
 * Nudge a value relative to where it is now.
 *
 * Worth the extra read: a dock button called "zoom in" has to know the current
 * zoom, and hardcoding a guess would make the first press jump.
 */
async function nudge(name, delta) {
  const spec = VALUES[name];
  const current = await info();
  const now = Number(current?.zmValue) || 1;
  return applyValue(name, now + delta, current, spec);
}

async function applyValue(name, value, deviceInfo, specArg) {
  const spec = specArg || VALUES[name];
  let n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`DroidCam: "${value}" is not a number for ${name}`);

  if (spec.range) {
    // The phone clamps too — sending 99 lands at its maximum and still answers
    // 200 — but clamping here means the value reported back is the one asked
    // for, rather than a surprise.
    const data = deviceInfo || await info();
    const lo = Number(data?.[spec.range[0]]);
    const hi = Number(data?.[spec.range[1]]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) n = Math.min(hi, Math.max(lo, n));
  }

  const asked = Number(n.toFixed(spec.decimals));
  await request(`${spec.path}${n.toFixed(spec.decimals)}`, 'PUT');

  // Report where the camera came to rest, not what it was told.
  //
  // Reading straight after the PUT returns a value the lens is merely passing
  // through: a jump to maximum sampled early came back as 2.8x. Waiting for it
  // to stop moving also answers a question those mid-flight numbers made look
  // like a hardware limit — the advertised maximum IS exactly reachable.
  let actual = asked;
  if (spec.field) {
    try {
      const settled = await settle(spec.field);
      if (settled !== null) actual = Number(settled.toFixed(spec.decimals));
    } catch { /* the PUT worked; the readback is a nicety */ }
  }

  return { ok: true, op: name, value: actual, asked };
}

/** Poll one field until it stops changing, or the cap runs out. */
async function settle(field) {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let previous = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
    const current = Number((await info())?.[field]);
    if (!Number.isFinite(current)) return previous;
    if (previous !== null && Math.abs(current - previous) < 1e-6) return current;
    previous = current;
  }

  log.debug(`${field} was still moving after ${SETTLE_TIMEOUT_MS}ms`);
  return previous;
}

/**
 * Run one camera control.
 *
 * @param {string} op     one of OPERATIONS
 * @param {*}      value  required by the value ops, ignored by the toggles
 */
export async function control(op, value) {
  if (TOGGLES[op]) {
    await request(TOGGLES[op], 'PUT');
    return { ok: true, op };
  }

  if (op === 'zoom_in') return nudge('zoom', Number(value) || 0.5);
  if (op === 'zoom_out') return nudge('zoom', -(Number(value) || 0.5));

  if (VALUES[op]) return applyValue(op, value);

  throw new Error(`DroidCam: unknown operation "${op}"`);
}

/** Probe the phone and report what it can do. Used by the Connections screen. */
export async function probe() {
  const [camera, cameras, name, battery] = await Promise.all([
    info(),
    cameraList().catch(() => []),
    phoneName().catch(() => ''),
    batteryInfo().catch(() => null),
  ]);
  log.info(`connected to ${name || 'a phone'} — zoom ${camera?.zmMin}-${camera?.zmMax}x, ${cameras.length} camera(s)`);
  return { info: camera, cameras, name: String(name || '').trim(), battery };
}

export const service = { control, info, cameraList, probe };
