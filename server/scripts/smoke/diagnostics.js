/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The details for a bug report (server/engine/diagnostics.js; Settings →
 * About): what a report needs to know about this copy, and nothing that
 * identifies the streamer or opens their accounts. Who may ask for them is in
 * sign-in.js.
 */

import os from 'node:os';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const { redact, platformState, diagnosticsReport, RECENT_PROBLEMS } = await import('../../engine/diagnostics.js');
const { createLogger, getRecentLogs, getRecentProblems } = await import('../../core/logger.js');
const { VERSION } = await import('../../../shared/version.js');
const read = (rel) => fs.readFileSync(new URL(rel, SCRIPT_URL), 'utf8');

const home = os.homedir();
const hidden = {
  query: redact('GET https://id.twitch.tv/oauth2/validate?access_token=abc123def456&client_id=xyz failed'),
  oauthCode: redact('callback http://localhost:8081/auth/discord?code=XyZ123abc&state=s1 refused'),
  bearer: redact('Authorization: Bearer 9f8e7d6c5b4a39281706f5e4d3c2b1a0 rejected'),
  irc: redact('irc login oauth:abcd1234efgh5678'),
  // Made-up keys, and the ones shaped like real tokens put together from parts: GitHub's push protection turns
  // away a public push holding anything that reads as a real Discord bot token, made up or not.
  json: redact('{"botToken":"made-up-bot-token-for-tests-0000","guildId":"123"}'),
  dotted: redact(`Bot ${['MTA5ODc2NTQz', 'GaBcDe', 'made-up-bot-token-part-for-tests'].join('.')}`),
  webhook: redact('posting to https://discord.com/api/webhooks/123456789012345678/made-up-webhook-key failed'),
  bare: redact('token gk1z3y7m0abcdefghij2klmnopqrs8 here'),
  jwt: redact(['eyJhbGciOiJub25lIn0', 'eyJzdWIiOiJ0ZXN0In0', 'made-up-signature-for-the-tests'].join('.')),
  password: redact('password: hunter'),
  homeWin: redact(`could not read ${home.replace(/\//g, '\\')}\\AppData\\thing.json`),
  homeSlash: redact(`could not read ${home.replace(/\\/g, '/')}/Documents/data/x.json`),
  otherUser: redact('C:\\Users\\SomeoneElse\\Desktop\\file.txt missing'),
  linuxUser: redact('/home/someone/SimonSays/data missing'),
  email: redact('mail streamer.name+tag@gmail.com bounced'),
  addresses: redact('connect ECONNREFUSED 192.168.1.201:4455, 8.8.8.8:53, 10.0.0.2 and 172.20.1.1'),
  handle: redact('could not connect to @my_tiktok_name: Failed to retrieve Room ID'),
};

test('the details for a bug report hide keys, tokens, sign-in codes, passwords, e-mails, internet addresses and the user\'s folder', () => {
  assert.equal(hidden.query, 'GET https://id.twitch.tv/oauth2/validate?access_token=[hidden]&client_id=xyz failed');
  assert.equal(hidden.oauthCode, 'callback http://localhost:8081/auth/discord?code=[hidden]&state=s1 refused');
  assert.equal(hidden.bearer, 'Authorization: Bearer [hidden] rejected');
  assert.equal(hidden.irc, 'irc login oauth:[hidden]');
  assert.equal(hidden.json, '{"botToken":[hidden],"guildId":"123"}');
  assert.equal(hidden.dotted, 'Bot [hidden]', 'a Discord bot token, in its three dotted parts');
  assert.equal(hidden.webhook, 'posting to https://discord.com/api/webhooks/[id]/[hidden] failed');
  assert.equal(hidden.bare, 'token [hidden] here', 'a Twitch token is 30 letters and digits, named or not');
  assert.equal(hidden.jwt, '[hidden]', 'all three parts: the middle one carries names');
  assert.equal(hidden.password, 'password: [hidden]');
  assert.equal(hidden.homeWin, 'could not read ~\\AppData\\thing.json');
  assert.equal(hidden.homeSlash, 'could not read ~/Documents/data/x.json');
  assert.equal(hidden.otherUser, 'C:\\Users\\…\\Desktop\\file.txt missing');
  assert.equal(hidden.linuxUser, '/home/…/SimonSays/data missing');
  assert.equal(hidden.email, 'mail [e-mail] bounced');
  assert.equal(hidden.addresses, 'connect ECONNREFUSED 192.168.1.201:4455, [address]:53, 10.0.0.2 and 172.20.1.1', 'the streamer\'s own network says nothing about where they are');
  assert.equal(hidden.handle, 'could not connect to @[name]: Failed to retrieve Room ID', 'the TikTok watcher names the account it could not reach');
});

test('and keep what a report needs: error codes, words after "token", versions, paths in the app, times, the platforms’ own addresses', () => {
  assert.equal(redact('refused with code: signin_needed (token: expired)'), 'refused with code: signin_needed (token: expired)');
  assert.equal(redact('version 2.2.1 on Node v24.13.0'), 'version 2.2.1 on Node v24.13.0');
  const at = 'at file:///D:/Coding%20projects/SimonSays-V3/server/scripts/smoke/youtube-and-tiktok.js:1:1';
  assert.equal(redact(at), at);
  assert.equal(redact('handleEventSubNotificationMessageReceived threw'), 'handleEventSubNotificationMessageReceived threw');
  assert.equal(redact('took 1760000000000 ms at 12:30'), 'took 1760000000000 ms at 12:30', 'a time in milliseconds is not a Discord id');
  assert.equal(redact('Twitch Helix 401 on https://api.twitch.tv/helix/users'), 'Twitch Helix 401 on https://api.twitch.tv/helix/users', 'a platform\'s own address says nothing about the streamer');
  assert.equal(redact('connect ECONNREFUSED ws://localhost:4455'), 'connect ECONNREFUSED ws://localhost:4455');
  // Google's own words, as the test copy's YouTube warning showed them: "2" is not a credential.
  assert.equal(redact('Expected OAuth 2 access token, login cookie'), 'Expected OAuth 2 access token, login cookie');
  assert.equal(redact('at x (node_modules/@bufbuild/protobuf/dist/x.js:1:1)'), 'at x (node_modules/@bufbuild/protobuf/dist/x.js:1:1)');
  assert.equal(redact(undefined), '');
});

// Who the streamer is, as the app knows it (server/api/http.js gathers these), and warnings as the platforms
// really write them: twitch.js "could not load Twitch profile for <login>", discord.js "Discord 403 on PUT …".
const known = ['streamer_login', 'Streamer Login', 'my_bot', '123456789', 'my_tiktok', 'My YouTube Channel', '888000888000888000', 'myhome.duckdns.org', '100', 'tv'];
const whoLines = {
  profile: redact('could not load Twitch profile for streamer_login: Twitch Helix 401', known),
  bot: redact('bot my_bot could not join #streamer_login', known),
  display: redact('Streamer Login went live', known),
  userId: redact('EventSub subscribe for broadcaster 123456789 failed', known),
  shortId: redact('took 100 ms', known),
  youtube: redact('no chat on My YouTube Channel right now', known),
  discord: redact('Discord 403 on PUT /guilds/888000888000888000/members/234567890123456789/roles/345678901234567890: Missing Permissions', known),
  obsHost: redact('connect ETIMEDOUT myhome.duckdns.org:4455', known),
  homeUrl: redact('could not reach wss://dash.example.net/socket', known),
  lookup: redact('getaddrinfo ENOTFOUND dash.example.net', known),
  tiktokUrl: redact('fetch https://www.tiktok.com/@someone_else/live failed', known),
  query: redact('GET https://tikrx.example/webcast?uniqueId=someone&room=1', known),
  ipv6: redact('connect to 2001:db8:85a3:0:0:8a2e:370:7334 and fe80::1ff:fe23:4567:890a', known),
};

test('the streamer\'s own accounts are taken out where a warning names them: logins, display names, ids, the Discord server, a home domain', () => {
  assert.equal(whoLines.profile, 'could not load Twitch profile for [account]: Twitch Helix 401');
  assert.equal(whoLines.bot, 'bot [account] could not join #[account]');
  assert.equal(whoLines.display, '[account] went live');
  assert.equal(whoLines.userId, 'EventSub subscribe for broadcaster [id] failed');
  assert.equal(whoLines.shortId, 'took 100 ms', 'an id of three digits would take out every "100"; real ones are longer');
  assert.equal(whoLines.youtube, 'no chat on [account] right now');
  assert.equal(whoLines.discord, 'Discord 403 on PUT /guilds/[id]/members/[id]/roles/[id]: Missing Permissions', 'a viewer\'s and a role\'s ids too, known or not');
  assert.equal(whoLines.obsHost, 'connect ETIMEDOUT [account]:4455');
  assert.equal(whoLines.homeUrl, 'could not reach wss://[host]/socket');
  assert.equal(whoLines.lookup, 'getaddrinfo ENOTFOUND [host]');
  assert.equal(whoLines.tiktokUrl, 'fetch https://www.tiktok.com/@[name]/live failed');
  assert.equal(whoLines.query, 'GET https://[host]/webcast?uniqueId=[hidden]&room=1');
  assert.equal(whoLines.ipv6, 'connect to [address] and fe80::1ff:fe23:4567:890a', 'a link-local address is the streamer\'s own network');
});

test('a huge line is cut before it is looked through, at a space, so it is quick and no key is left in halves', () => {
  const blob = `${'a-'.repeat(30_000)}`;
  const started = Date.now();
  const r = diagnosticsReport({ logs: [{ ts: 1, level: 'warn', scope: 'x', message: blob }, { ts: 2, level: 'warn', scope: 'y', message: `first ${'word '.repeat(400)}gk1z3y7m0abcdefghij2klmnopqrs8 end` }] });
  assert.ok(Date.now() - started < 500, `took ${Date.now() - started} ms`);
  assert.ok(r.includes('WARN x: [long text] …'));
  assert.ok(!r.includes('gk1z3y7m0abc'), 'a key past the cut is not half shown');
});

const report = diagnosticsReport({
  platforms: {
    twitch: { main: 'connected', bot: 'disconnected', eventsub: 'connected', login: 'secret_login' },
    youtube: 'disconnected',
    tiktok: { status: 'disconnected', error: null, channel: 'secret_tiktok', watch: { mode: 'no-obs', nextTryAt: 0 } },
    discord: { status: 'connected', botUserId: '999000999', guildId: '888000888', channelId: '777000777', clientId: '666000666', hasClientSecret: true, hasBotToken: false },
    obs: { status: 'connected', error: null, scenes: ['Secret scene'], currentScene: 'Secret scene', obsVersion: '32.0.1', streamStatus: { active: true }, recordingStatus: { active: false } },
    spotify: { status: 'error', error: 'refresh failed for refresh_token=abc123def456ghi789', track: { name: 'Secret song' } },
  },
  logs: [
    { ts: 1, level: 'info', scope: 'chat', message: 'secret_viewer said hello' },
    ...Array.from({ length: RECENT_PROBLEMS + 3 }, (_, i) => ({ ts: 1000 + i, level: i % 2 ? 'warn' : 'error', scope: 'twitch', message: `problem ${i}` })),
    { ts: 5000, level: 'error', scope: 'obs', message: 'Error: boom\n    at a (x.js:1:1)\n    at b (y.js:2:2)\n    at c\n    at d\n    at e' },
    { ts: 6000, level: 'warn', scope: 'twitch', message: `disconnected: oauth:abcd1234efgh5678 ${'x'.repeat(600)}` },
    { ts: 7000, level: 'warn', scope: 'twitch', message: 'could not load Twitch profile for secret_login: Twitch Helix 401' },
  ],
  known: ['secret_login', 'secret_tiktok'],
  signIn: true,
  startedAt: 0,
  now: (3 * 60 + 12) * 60_000,
});

test('the report says the version, system, Node, uptime, sign-in and each platform\'s state, in a few words', () => {
  assert.ok(report.startsWith(`SimonSays ${VERSION}\n`));
  for (const line of ['System: ', `Node: ${process.version}`, 'Server running for: 3 h 12 min', 'Sign-in: on']) assert.ok(report.includes(line), line);
  assert.ok(report.includes('  Twitch: chat connected, bot disconnected, eventsub connected'));
  assert.ok(report.includes('  YouTube: disconnected'));
  assert.ok(report.includes('  TikTok: disconnected, watching: no-obs'));
  assert.ok(report.includes('  Discord: connected, bot token not set, client secret set'));
  assert.ok(report.includes('  OBS: connected, OBS 32.0.1, streaming'));
  assert.ok(report.includes('  Spotify: error, error: refresh failed for refresh_token=[hidden]'));
  assert.equal(platformState('youtube', undefined), 'unknown');
});

test('never who: no logins, channels, Discord ids, scenes, songs or chat; only the last warnings and errors, short, redacted', () => {
  for (const secret of ['secret_login', 'secret_tiktok', '999000999', '888000888', '777000777', '666000666', 'Secret scene', 'Secret song', 'secret_viewer', 'abcd1234efgh5678', 'abc123def456']) {
    assert.ok(!report.includes(secret), secret);
  }
  const problems = report.split('\n').filter((l) => / (WARN|ERROR) /.test(l));
  assert.equal(problems.length, RECENT_PROBLEMS);
  assert.ok(!report.includes('problem 5\n') && report.includes('problem 17'), 'the newest, not the oldest');
  assert.ok(report.includes('could not load Twitch profile for [account]'), 'a login a warning names, taken out');
  assert.ok(problems.some((l) => l.endsWith('Error: boom | at a (x.js:1:1) | at b (y.js:2:2) | at c')), 'a stack keeps its first lines');
  assert.ok(problems.every((l) => l.length < 500), 'a long line is cut');
  assert.ok(diagnosticsReport({ logs: [] }).includes('No warnings or errors since the server started.'));
});

test('the page asks the server, shows the text before it is pasted, copies without a secure page too, and links the issues only where there is a repository', () => {
  const panel = read('../../web/components/BugReportPanel.tsx');
  assert.ok(panel.includes("apiFetch('/api/diagnostics')"));
  assert.ok(panel.includes('<textarea') && panel.includes("onChange={(e) => { setText(e.target.value); setState('edited'); }}"), 'the text is shown, to read and change before pasting');
  assert.ok(panel.includes("const shown = state === 'copied' || state === 'select' || state === 'edited';") && panel.includes('{text && shown && ('), 'old details are not shown under a word that is no longer true while new ones are fetched');
  assert.ok(!panel.includes('readOnly'));
  assert.ok(panel.includes("document.execCommand('copy')"), 'a dashboard opened at a LAN address is not a secure page, so the clipboard API is missing there');
  assert.ok(panel.includes('UPDATE_REPO ?') && panel.includes('/issues/new/choose'), 'the public edition links its own issues; a copy built from the source has none');
  const settings = read('../../web/components/views/SettingsView.tsx');
  assert.ok(/\{owner && <BugReportPanel /.test(settings), 'the streamer\'s alone, as the API is');
  assert.ok(read('../api/http.js').includes("case 'GET /api/diagnostics':"));
});

// The warnings and errors are kept apart from the log of everything (server/core/logger.js), whose 500 lines
// turn over in hours on a busy stream, with every command and event. The tests log at "warn" (harness.js), so
// that flood can't be made here; the store kept apart, and its limit, can. Said quietly.
const quiet = createLogger('smoke-busy');
const consoleWarn = console.warn;
console.warn = () => {};
try { for (let i = 0; i < 60; i++) quiet.warn(`warning ${i}`); } finally { console.warn = consoleWarn; }
const kept = getRecentProblems();

test('warnings and errors are kept apart from the busy log of everything, the latest 50, and the report reads those', () => {
  assert.equal(kept.length, 50);
  assert.deepEqual([kept[0].message, kept.at(-1).message], ['warning 10', 'warning 59']);
  assert.ok(kept.every((e) => e.level === 'warn' || e.level === 'error'));
  const logger = read('../core/logger.js');
  assert.ok(logger.includes("if (level === 'warn' || level === 'error') {") && logger.includes('problems.push(entry);') && logger.includes('const RING_SIZE = 500;'));
  assert.ok(getRecentLogs(500).length <= 500);
  assert.ok(read('../api/http.js').includes('logs: getRecentProblems(),'));
});
