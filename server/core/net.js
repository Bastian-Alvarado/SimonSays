/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Is a connection coming from the machine the server runs on?
 *
 * Loopback is the obvious case, but not the common one here: the dashboard is
 * usually opened at the machine's LAN address, because that is the URL the OBS
 * docks and the phone deck use, and people bookmark one address for
 * everything. A browser on the host reaching the host by its own LAN address
 * arrives with that address as its source, so a loopback-only test called it a
 * remote device and refused it.
 *
 * Comparing against this machine's own interface addresses distinguishes the
 * two properly: another device on the network presents *its* address, never
 * one of ours.
 *
 * Read live rather than cached — Wi-Fi reconnects, VPNs and docking stations
 * all change the list while the server is running.
 */

import { networkInterfaces } from 'node:os';

/** Strip the IPv6-mapped IPv4 prefix and any zone index. */
function normalise(addr) {
  if (typeof addr !== 'string') return '';
  let out = addr.trim();
  if (out.startsWith('::ffff:')) out = out.slice('::ffff:'.length);
  const zone = out.indexOf('%');
  if (zone >= 0) out = out.slice(0, zone);
  return out.toLowerCase();
}

export function isLoopback(addr) {
  const a = normalise(addr);
  return a === '::1' || a === '0:0:0:0:0:0:0:1' || /^127\./.test(a);
}

/**
 * True when `addr` is this machine — loopback, or one of its own interfaces.
 *
 * `interfaces` is injectable so the behaviour can be tested without depending
 * on whatever network the test machine happens to be on.
 */
export function isSameMachine(addr, interfaces = networkInterfaces()) {
  const a = normalise(addr);
  if (!a) return false;
  if (isLoopback(a)) return true;

  for (const list of Object.values(interfaces || {})) {
    for (const iface of list || []) {
      if (normalise(iface?.address) === a) return true;
    }
  }
  return false;
}
