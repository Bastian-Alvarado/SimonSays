/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Where the backend is, worked out from where the page came from.
 *
 * Three ways, in order:
 *
 *   1. ?server= in the address. Explicit, and remembered, because it has to
 *      survive a round trip that drops it — an OAuth sign-in leaves for the
 *      provider and comes back to a registered redirect carrying the
 *      provider's own query and nothing else, so a page opened with ?server=
 *      returns without it and would otherwise have to guess again.
 *
 *   2. What was remembered.
 *
 *   3. A guess from the page's own address.
 *
 * The guess is the part worth explaining. The API listens on its own port, so
 * for a page served straight off the server — a phone on the LAN at
 * 192.168.1.201:8081 — the answer is that same host and port.
 *
 * But a page served from a default port is behind something: a reverse proxy
 * on 443 with a real certificate, which is also where the websocket will have
 * been proxied. Adding :8081 to that guesses at a port nothing is listening on
 * and nothing could reach through the proxy anyway. So a default port means
 * the page's own origin, which is what makes a plain https://example.com work
 * with nothing in the address at all.
 */

/** The API's own port, for a page served directly by the server. */
export const DEFAULT_API_PORT = '8081';

/**
 * @param {{protocol: string, hostname: string, port: string, search: string}} where
 *        The page's address — window.location, or anything shaped like it.
 * @param {{remembered?: string|null, apiPort?: string}} known
 *        What was stored last time, and which port to fall back to.
 *
 * Deliberately no second stored key. This used to fall back to `server_url`,
 * which the TikTok proxy setting writes — so setting a proxy pointed the whole
 * app at it and the next load reached nothing at all.
 */
export function resolveServerUrl(where, known = {}) {
  const asked = new URLSearchParams(where.search || '').get('server');
  if (asked) return { url: asked, remember: asked };

  if (known.remembered) return { url: known.remembered, remember: null };

  const wss = where.protocol === 'https:' ? 'wss:' : 'ws:';

  /*
    No port means the default one, which means something is in front. Whatever
    serves the page on 443 is what serves the socket, at the same origin.
  */
  if (!where.port) return { url: `${wss}//${where.hostname}`, remember: null };

  return { url: `${wss}//${where.hostname}:${known.apiPort || DEFAULT_API_PORT}`, remember: null };
}
