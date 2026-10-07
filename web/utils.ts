
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React from 'react';
import { emoteImageUrl, splitEmotes } from '../shared/emotes.js';
import { withDiscordText, type DiscordNames } from './discordEmoji';

export function getRgbValues(hex: string) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export const safeJSONParse = (key: string, fallback: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn(`Failed to parse ${key} from localStorage`, e);
    return fallback;
  }
};

export const parseTwitchEmotes = (emotesStr: string) => {
  if (!emotesStr) return undefined;
  const emotes: { [id: string]: string[] } = {};
  emotesStr.split('/').forEach(part => {
    const [id, positions] = part.split(':');
    emotes[id] = positions.split(',');
  });
  return emotes;
};

// --- Message Parsing Helper for Emotes ---
/*
  Cut in whole characters, the way Twitch counts its emote positions, rather
  than in UTF-16 units — see shared/emotes.js. The emote's own word goes in as
  the picture's alt text, so it still reads if the picture does not load.
*/
export const parseMessageWithEmotes = (msg: string, emotes: { [id: string]: string[] } | undefined, size: number, names?: DiscordNames | null) => {
  // A Discord line's own server emojis, as pictures the size of an emote, and its mentions by name (they arrive as codes).
  if (!emotes || Object.keys(emotes).length === 0) return withDiscordText(msg, `${size}px`, names);

  return splitEmotes(msg, emotes).map((part: any, idx: number) => (part.emote
    ? React.createElement('img', {
      key: `${part.emote}-${idx}`,
      // The picture that suits the size it is drawn at, not always the smallest.
      src: emoteImageUrl(part.emote, size, typeof window === 'undefined' ? 1 : window.devicePixelRatio),
      alt: part.name,
      className: "inline-block align-middle mx-0.5",
      style: { height: `${size}px`, width: 'auto' }
    })
    : React.createElement(React.Fragment, { key: `t${idx}` }, withDiscordText(part.text, `${size}px`, names))));
};

// --- PKCE Helpers for Kick Auth ---

export type SortMode = 'created' | 'name';

/**
 * Order commands or actions for display.
 *
 * `created` is simply the stored order, and that genuinely is creation order:
 * the store appends new records and edits existing ones in place, so a rename
 * never moves a row. Neither commands nor actions carry a timestamp — their
 * ids are random strings, not sortable ones — so position is the only record
 * of when something was made. Give them a `createdAt` if that ever needs to
 * survive the array being reordered.
 *
 * Always returns a new array when it sorts: sorting the prop in place would
 * mutate React state held elsewhere.
 */
export const sortForDisplay = <T extends { name?: string }>(items: T[], mode: SortMode): T[] => {
  if (mode !== 'name') return items;
  // localeCompare with a base sensitivity so accents and case do not split
  // names apart — "Juegación" belongs next to "Juegacion", not after Z.
  return [...items].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
};

/**
 * The redirect URI to register with Spotify, and to send on the authorize call.
 *
 * Spotify refuses `localhost` outright — "localhost is not allowed as redirect
 * URI" — but permits plain HTTP for an explicit loopback literal. So a
 * dashboard opened at http://localhost:8081/ cannot register a usable URI at
 * all, while the very same server reached as 127.0.0.1 can. Rewriting only the
 * hostname keeps both legs of the exchange pointed at this same server, and
 * Spotify sends the browser back to the loopback address to finish.
 *
 * Twitch and Discord accept localhost, so this is deliberately Spotify-only.
 * https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
 */
export const spotifyRedirectUri = () => {
  const url = new URL(window.location.origin + window.location.pathname);
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url.toString();
};

/*
  Google returns to exactly this, and refuses anything that is not registered
  against the client id character for character — so the screen shows it and
  the login sends it, both from here.
*/
export const youtubeRedirectUri = () => spotifyRedirectUri();

export const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

export const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return base64urlencode(hash);
};

export const base64urlencode = (a: ArrayBuffer) => {
  const bytes = new Uint8Array(a);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Put text on the clipboard, on http:// as well as https://.
 *
 * `navigator.clipboard` only exists in a secure context. This app is normally
 * reached at http://<lan-ip>:8081 — from another PC, or the phone server —
 * which is NOT secure, so the modern API is simply absent and every copy
 * button silently did nothing. The deprecated execCommand path still works
 * there, as long as it runs inside the click that triggered it.
 *
 * Synchronous on purpose: awaiting first would spend the user gesture and the
 * fallback would then be refused too. Returns whether the text actually landed,
 * so a caller can say so instead of flashing a tick over nothing.
 */
export const copyText = (text: string): boolean => {
  const ta = document.createElement('textarea');
  ta.value = text;
  // Off-screen rather than hidden: execCommand ignores an unrendered element.
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);

  let ok = false;
  try {
    const prev = document.activeElement as HTMLElement | null;
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
    prev?.focus?.();
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);

  // On https:// (or localhost) prefer the real API, and let it correct a
  // false negative from the path above.
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }
  return ok;
};
