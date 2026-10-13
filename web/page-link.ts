/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Links to the pages OBS shows, with the page key in them.
 *
 * A browser source in OBS cannot sign in, so once sign-in is on
 * (server/api/auth.js) its link has to carry the page key, which lets it
 * draw the stream and nothing else. The key is put in every such link the
 * streamer copies, whether sign-in is on yet or not: a link copied today
 * goes on working the day it is switched on.
 *
 * Only the streamer's dashboard knows the key (it asks for it, App.tsx sets
 * it here); a moderator's copies come without, and the docks never carry
 * it — a dock is used, so it signs in like any browser.
 */

let pageKey = '';

/** Set by App.tsx on each render, from the streamer's sign-in settings. */
export function setLinkKey(key: string | undefined | null) {
  pageKey = key || '';
}

/** Modes that are used rather than shown: they sign in instead. */
const SIGNS_IN = new Set(['dock', 'dock-actions', 'dashboard']);

/** A page link with the page key in it, when this dashboard knows it. Takes and answers a string, or fills in a URL. */
export function pageLink<T extends string | URL>(link: T): T {
  if (!pageKey || !link) return link;
  const url: URL | null = typeof link === 'string' ? (() => { try { return new URL(link); } catch { return null; } })() : (link as URL);
  if (!url || SIGNS_IN.has(url.searchParams.get('mode') || 'dashboard')) return link;
  url.searchParams.set('key', pageKey);
  return (typeof link === 'string' ? url.toString() : url) as T;
}
