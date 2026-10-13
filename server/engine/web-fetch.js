/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The "Fetch a web address" step: ask a web address something and use the
 * answer — a joke, the weather, a game's stats, a smart light switched on.
 * The way out for anything the app does not do itself.
 *
 * Afterwards {response} is what came back (cut to 1000 characters, which is
 * more than any chat takes), {response.status} the HTTP status and
 * {response.ok} whether it worked. An answer in JSON can be read by name:
 * {response.json.joke}, {response.json.main.temp}.
 *
 * What it will not reach is the phone itself. The dashboard is open to
 * whoever has its address, and an action fetching the server's own loopback,
 * or the link-local range where a cloud machine keeps its own secrets, would
 * hand them anything listening there. So the address a name resolves to is
 * checked, and checked again at every redirect, which is followed by hand for
 * that reason. Addresses on the home network are allowed: a light, a PC app,
 * a Stream Deck helper are exactly what this is for.
 *
 * Eight seconds at most, 64 KB at most, and a failure is an answer too:
 * {response.ok} is false and {response.error} says why, so the steps after it
 * can say so rather than nothing happening.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

export const TIMEOUT_MS = 8000;
export const MAX_BYTES = 64 * 1024;
export const MAX_TEXT = 1000;
const MAX_REDIRECTS = 3;

/** Whether an IP address is the machine itself, or link-local. */
export function blockedAddress(ip) {
  const a = String(ip || '').toLowerCase();
  const v4 = a.startsWith('::ffff:') ? a.slice(7) : a;
  if (net.isIPv4(v4)) {
    const [x, y] = v4.split('.').map(Number);
    return x === 127 || x === 0 || (x === 169 && y === 254);
  }
  if (net.isIPv6(a)) return a === '::1' || a === '::' || /^fe[89ab]/.test(a);
  return true;
}

/** Refuses an address the step may not reach: not http(s), or the phone itself. */
async function checkTarget(raw, lookup) {
  let url;
  // Not repeated in the error: an address often carries its API key, and errors reach the log.
  try { url = new URL(raw); } catch { throw new Error('that is not a web address (it should start with https://)'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('only http and https addresses can be fetched');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) throw new Error('the server itself cannot be fetched');
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((x) => blockedAddress(x.address))) throw new Error('the server itself cannot be fetched');
  return url;
}

/** "Name: value" lines, as the editor's box holds them. */
export function parseHeaders(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at <= 0) continue;
    const name = line.slice(0, at).trim();
    if (/^[A-Za-z0-9-]+$/.test(name)) out[name] = line.slice(at + 1).trim();
  }
  return out;
}

async function readCapped(res) {
  if (!res.body?.getReader) return (await res.text()).slice(0, MAX_BYTES);
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= MAX_BYTES) { reader.cancel().catch(() => {}); break; }
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, MAX_BYTES));
}

/**
 * Fetch for a step. Never throws: what happened is the answer.
 * @returns {Promise<{ ok: boolean, status: number, text: string, json?: any, error?: string }>}
 */
export async function fetchForStep({ url, method = 'GET', body = '', headers = '' }, { lookup = dns.lookup, fetchImpl = fetch } = {}) {
  const verb = method === 'POST' ? 'POST' : 'GET';
  const sendHeaders = parseHeaders(headers);
  if (verb === 'POST' && body && !Object.keys(sendHeaders).some((h) => h.toLowerCase() === 'content-type')) {
    // A body that reads as JSON is sent as JSON, which is what nearly every API wants.
    try { JSON.parse(body); sendHeaders['Content-Type'] = 'application/json'; } catch { sendHeaders['Content-Type'] = 'text/plain'; }
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    let target = await checkTarget(String(url || '').trim(), lookup);
    let res;
    for (let hop = 0; ; hop++) {
      res = await fetchImpl(target, {
        method: hop === 0 ? verb : 'GET',
        headers: sendHeaders,
        body: hop === 0 && verb === 'POST' ? body : undefined,
        redirect: 'manual',
        signal: abort.signal,
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!next) break;
      if (hop >= MAX_REDIRECTS) throw new Error('too many redirects');
      target = await checkTarget(new URL(next, target).href, lookup);
    }
    const raw = await readCapped(res);
    const out = { ok: res.ok, status: res.status, text: raw.trim().slice(0, MAX_TEXT) };
    const type = res.headers.get('content-type') || '';
    if (type.includes('json') || /^\s*[[{]/.test(raw)) {
      try { out.json = JSON.parse(raw); } catch { /* not JSON after all: the text is the answer */ }
    }
    if (!res.ok) out.error = `the address answered ${res.status}`;
    return out;
  } catch (err) {
    const error = err?.name === 'AbortError' ? `no answer within ${TIMEOUT_MS / 1000} seconds` : (err?.message || String(err));
    return { ok: false, status: 0, text: '', error };
  } finally {
    clearTimeout(timer);
  }
}
