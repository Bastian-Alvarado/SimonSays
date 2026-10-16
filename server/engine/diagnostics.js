/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What a bug report needs to know about this copy, as text the streamer copies
 * and pastes into the report themselves (Settings → About → Copy details for a
 * bug report). Nothing is sent anywhere: the server answers the page that
 * asked, and only the streamer's own sign-in may ask (a moderator's is refused
 * by the API's gate, server/api/http.js).
 *
 * What goes in: the version and how this copy is updated, the system and
 * Node, how long the server has run, whether sign-in is on, each platform's
 * state, and the last warnings and errors. What stays out: keys, tokens and
 * passwords, the streamer's accounts (logins, channels, ids, the Discord
 * server, the bot), chat, and the user's folder on the computer.
 *
 * The log lines are the risk, since they were written for the streamer's own
 * eyes ("could not load Twitch profile for <login>"). redact() takes out the
 * names and ids the app knows for the streamer's accounts (handed in by the
 * caller, matched exactly), and everything that looks like a secret or carries
 * one, a Discord id, an e-mail address, an @handle, an address on the internet
 * (a number, or a web address that is not a platform's own) and the home
 * folder. Scene and source names stay: they are the streamer's own words, not
 * who anybody is, and a report about a layout needs them. A viewer named in a
 * warning can't be told from any other word, so the page shows the text, to be
 * read and changed, before anybody pastes it.
 */

import os from 'node:os';
import { VERSION } from '../../shared/version.js';
import { UPDATE_REPO } from '../../shared/edition.js';

/** How many warnings and errors the report carries, newest last, and how long each may be. */
export const RECENT_PROBLEMS = 15;
const LINE_MAX = 400;
const HIDDEN = '[hidden]';

// Names that say "a secret follows", in a query string, JSON or "name: value". In an address "code" is a
// sign-in's one-time code; elsewhere it is an error's code, which a report wants.
const SECRET_NAMES = 'access_token|refresh_token|id_token|token|key|apikey|api_key|secret|client_secret|clientsecret|password|passwd|authorization|sig|signature|bottoken|bot_token|streamkey|stream_key|ownerkey|owner_key|pagekey|page_key';
// …and who: TikTok's uniqueId, Twitch's login and broadcaster in an address.
const QUERY_NAMES = `${SECRET_NAMES}|code|auth|uniqueid|unique_id|username|user|user_login|login|channel|broadcaster_login|broadcaster_user_login`;
// Hidden whatever they hold; the other names only when what follows looks like a key, not a word ("token: expired").
const ALWAYS_HIDDEN = /^(password|passwd|secret|client_secret|clientsecret)$/i;
const PRIVATE_V4 = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
// Web addresses that say nothing about the streamer: the platforms' and services' own. Any other host (a home
// domain in front of OBS or the dashboard, say) is hidden.
const PUBLIC_HOSTS = /(^|\.)(twitch\.tv|twitch\.com|youtube\.com|googleapis\.com|google\.com|discord\.com|discordapp\.com|discord\.gg|spotify\.com|tiktok\.com|eulerstream\.com|github\.com|githubusercontent\.com|vdo\.ninja|jsdelivr\.net|kick\.com|obsproject\.com|nodejs\.org)$/i;
const isLocalHost = (host) => /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/i.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
/** A line is cut to this before anything is looked for in it (at a space, so no key is split): a huge line would be slow. */
const SCAN_MAX = 1000;

/** The home folder, as it may be written in a path, longest first so "C:\Users\me" goes before "C:". */
function homeForms() {
  const home = os.homedir();
  if (!home || home.length < 4) return [];
  return [...new Set([home, home.replace(/\\/g, '/'), home.replace(/\//g, '\\')])].sort((a, b) => b.length - a.length);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The names and ids worth looking for: 3 letters or more, and an id of only
 * digits 6 or more (a Twitch user id; "100" would take out every "100 ms").
 * Longest first, so a login inside a longer name goes with it.
 */
function knownWords(known) {
  return [...new Set((known || []).map((k) => String(k ?? '').trim()))]
    .filter((k) => (/^\d+$/.test(k) ? k.length >= 6 : k.length >= 3))
    .sort((a, b) => b.length - a.length);
}

/**
 * A line of the log with what could identify the streamer or open their
 * accounts taken out. known: the names and ids of the streamer's accounts, as
 * the app has them (server/api/http.js gathers them), taken out wherever they
 * stand as a word of their own.
 */
export function redact(text, known = []) {
  let s = String(text ?? '');
  for (const word of knownWords(known)) {
    s = s.replace(new RegExp(`(?<![A-Za-z0-9_])${escapeRe(word)}(?![A-Za-z0-9_])`, 'gi'), /^\d+$/.test(word) ? '[id]' : '[account]');
  }
  for (const form of homeForms()) s = s.split(form).join('~');
  // Another user's folder (a path written from elsewhere): the folder name only.
  s = s.replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s"']+/gi, '$1…');
  s = s.replace(/(\/(?:home|Users)\/)[^/\s"']+/g, '$1…');
  // A Discord webhook carries its own key in the address.
  s = s.replace(/(discord(?:app)?\.com\/api\/webhooks\/\d+\/)[\w-]+/gi, `$1${HIDDEN}`);
  // ?token=…, &code=…, #access_token=…
  s = s.replace(new RegExp(`([?&#;](?:${QUERY_NAMES})=)[^&#\\s"']+`, 'gi'), `$1${HIDDEN}`);
  // "token":"…", 'password': '…', botToken: …, key=…
  s = s.replace(new RegExp(`(["']?\\b(${SECRET_NAMES})\\b["']?\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,;}&]+)`, 'gi'), (m, lead, name, value) => {
    const bare = value.replace(/^["']|["']$/g, '');
    return ALWAYS_HIDDEN.test(name) || /\d/.test(bare) || bare.length >= 20 ? `${lead}${HIDDEN}` : m;
  });
  // A credential after its scheme, at least 8 long: "OAuth 2 access token" in Google's errors is words.
  s = s.replace(/\b(Bearer|OAuth|Basic|Bot)\s+[\w\-.~+/]{8,}=*/g, `$1 ${HIDDEN}`);
  s = s.replace(/\boauth:[\w]+/gi, `oauth:${HIDDEN}`);
  // Signed tokens in three dotted parts (JWTs, Discord bot tokens): every part, since the middle one can carry names.
  s = s.replace(/\b[\w-]{10,}\.[\w-]{6,}\.[\w-]{20,}/g, HIDDEN);
  // Anything long enough to be a key, whatever it is called: letters and digits mixed, 24 or more (a Twitch
  // token has 30). A path is left alone, and so is a long name of only letters.
  s = s.replace(/[A-Za-z0-9_\-+/]{24,}={0,2}/g, (m) => {
    if (/\//.test(m) && !/[A-Za-z0-9]{24,}/.test(m)) return m;
    return /\d/.test(m) && /[A-Za-z]/.test(m) ? HIDDEN : m;
  });
  s = s.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail]');
  // Accounts by their handle (@streamer, @a.viewer, tiktok.com/@name/live); not a package in a path
  // (node_modules/@scope/name).
  s = s.replace(/(?<![\w@])(?<!node_modules\/)@[A-Za-z0-9_](?:[\w.]*\w)?/g, '@[name]');
  // Discord's ids (17 to 20 digits): a server, a channel, a member. A time in milliseconds has 13.
  s = s.replace(/(?<![\w.])\d{17,20}(?![\w.])/g, '[id]');
  // A web address's host, unless it is a platform's own or on the streamer's network; a host a lookup failed on.
  s = s.replace(/\b([a-z][a-z0-9+.-]*:\/\/)([^/\s:?#"'@]+)/gi, (m, scheme, host) => (PUBLIC_HOSTS.test(host) || isLocalHost(host) ? m : `${scheme}[host]`));
  s = s.replace(/\b(ENOTFOUND|EAI_AGAIN)\s+([\w.-]+)/g, (m, code, host) => (PUBLIC_HOSTS.test(host) || isLocalHost(host) ? m : `${code} [host]`));
  // Addresses on the internet say where the streamer is; ones on their own network don't.
  s = s.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, (m) => (m.split('.').every((n) => Number(n) <= 255) && !PRIVATE_V4.test(m) ? '[address]' : m));
  s = s.replace(/(?<![\w:])(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}(?![\w:])|(?<![\w:])[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*::(?:[0-9a-f]{1,4}:)*[0-9a-f]{1,4}(?![\w:])/gi,
    (m) => (/^(fe80|fc|fd)/i.test(m) ? m : '[address]'));
  return s;
}

/** One platform's state in a few words: what it is doing, never who it is. */
export function platformState(name, s, known = []) {
  if (s == null) return 'unknown';
  if (typeof s === 'string') return s;
  const parts = [];
  if (name === 'twitch') {
    for (const k of ['main', 'bot', 'eventsub']) if (typeof s[k] === 'string') parts.push(`${k === 'main' ? 'chat' : k} ${s[k]}`);
  } else if (typeof s.status === 'string') {
    parts.push(s.status);
  }
  if (name === 'obs') {
    if (s.obsVersion) parts.push(`OBS ${s.obsVersion}`);
    if (s.streamStatus?.active) parts.push('streaming');
    if (s.recordingStatus?.active) parts.push('recording');
  }
  if (name === 'discord') {
    parts.push(`bot token ${s.hasBotToken ? 'set' : 'not set'}`, `client secret ${s.hasClientSecret ? 'set' : 'not set'}`);
  }
  if (name === 'tiktok' && s.watch?.mode) parts.push(`watching: ${s.watch.mode}`);
  if (s.error) parts.push(`error: ${redact(scanPart(s.error), known).slice(0, LINE_MAX)}`);
  return parts.join(', ') || 'unknown';
}

const PLATFORM_NAMES = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', discord: 'Discord', obs: 'OBS', spotify: 'Spotify' };

function system() {
  const termux = (process.env.PREFIX || '').includes('com.termux');
  const kind = termux ? 'Android (Termux)' : { win32: 'Windows', linux: 'Linux', darwin: 'macOS' }[process.platform] || process.platform;
  return `${kind}, ${os.type()} ${os.release()}, ${process.arch}`;
}

function duration(ms) {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} days ${h % 24} h`;
}

/** The start of a line, up to SCAN_MAX, cut at a space so no key is split in two and half of it left showing. */
function scanPart(text) {
  const s = String(text ?? '');
  if (s.length <= SCAN_MAX) return s;
  const space = s.lastIndexOf(' ', SCAN_MAX);
  return `${space > 0 ? s.slice(0, space) : '[long text]'} …`;
}

/** A log entry as one short line: when, how bad, where, and what, redacted. A stack keeps its first lines. */
function problemLine(e, known) {
  const when = new Date(e.ts).toISOString().replace('T', ' ').slice(0, 19);
  const text = String(e.message ?? '').split('\n').slice(0, 4).map((l) => redact(scanPart(l.trim()), known)).join(' | ');
  return `${when} ${e.level.toUpperCase()} ${e.scope}: ${text.length > LINE_MAX ? `${text.slice(0, LINE_MAX)}…` : text}`;
}

/**
 * The report, as plain text. Everything it reads is handed in, so a test can
 * give it a made-up server: platforms (each module's getStatus()), logs (the
 * warnings and errors, server/core/logger.js getRecentProblems()), known (the
 * names and ids of the streamer's accounts, to take out), signIn (on or off),
 * startedAt and now.
 */
export function diagnosticsReport({ platforms = {}, logs = [], known = [], signIn = false, startedAt = Date.now(), now = Date.now() } = {}) {
  const launcher = process.env.SIMONSAYS_LAUNCHER === '1';
  const lines = [
    `SimonSays ${VERSION}`,
    `Updates: ${UPDATE_REPO ? 'from GitHub releases' : 'by hand (a copy built from the source)'}; started ${launcher ? 'by start.js' : 'without start.js (npm run serve or similar)'}`,
    `System: ${system()}`,
    `Node: ${process.version}`,
    `Server running for: ${duration(now - startedAt)}; memory ${Math.round(process.memoryUsage().rss / 1e6)} MB of ${Math.round(os.totalmem() / 1e9)} GB`,
    `Sign-in: ${signIn ? 'on' : 'off'}`,
    '',
    'Platforms:',
    ...Object.entries(PLATFORM_NAMES).map(([key, label]) => `  ${label}: ${platformState(key, platforms[key], known)}`),
    '',
  ];
  const problems = logs.filter((e) => e.level === 'warn' || e.level === 'error').slice(-RECENT_PROBLEMS);
  lines.push(problems.length ? `Latest warnings and errors (${problems.length}):` : 'No warnings or errors since the server started.');
  for (const e of problems) lines.push(`  ${problemLine(e, known)}`);
  return lines.join('\n');
}
