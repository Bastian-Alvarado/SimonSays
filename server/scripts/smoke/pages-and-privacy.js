/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: pages that do not exist, search engines, browser tabs and the
 * privacy note — an address with no page behind it says so (with a 404)
 * instead of opening the dashboard, nothing asks to be indexed, every screen
 * names itself in the tab, and PRIVACY.md names every service the code
 * reaches.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const { createHttpServer } = await import('../../api/http.js');
const { FORGET_CHOICES } = await import('../../engine/viewer-history.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');

// A built app of one page, served the way the real one is.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-pages-'));
const SHELL = '<!doctype html><title>shell</title><div id="root"></div>';
fs.writeFileSync(path.join(root, 'index.html'), SHELL);
fs.mkdirSync(path.join(root, 'assets'));
const server = createHttpServer({ webRoot: root });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const get = async (p, headers = {}) => {
  const res = await fetch(base + p, { headers });
  return { status: res.status, robots: res.headers.get('x-robots-tag'), etag: res.headers.get('etag'), type: res.headers.get('content-type'), body: await res.text() };
};
let answers;
try {
  const home = await get('/');
  answers = {
    home,
    homeAgain: await get('/', { 'If-None-Match': home.etag }),
    file: await get('/index.html'),
    missing: await get('/overlay'),
    missingAgain: await get('/overlay', { 'If-None-Match': home.etag }),
    folder: await get('/assets/'),
    robots: await get('/robots.txt'),
    api: await get('/api/no-such-thing'),
  };
} finally {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
}

test('an address with no page behind it gets the app with a 404, never an "unchanged"; the app itself is a 200', () => {
  assert.equal(answers.home.status, 200);
  assert.equal(answers.home.body, SHELL);
  assert.equal(answers.homeAgain.status, 304, 'the app is no longer kept by the browser');
  assert.equal(answers.file.status, 200);
  assert.equal(answers.missing.status, 404);
  assert.equal(answers.missing.body, SHELL, 'the page that says so is not the app');
  assert.equal(answers.missingAgain.status, 404, 'a page that does not exist was answered as unchanged');
  assert.equal(answers.folder.status, 404);
});

test('nothing asks to be indexed: every answer says so, robots.txt turns every crawler away, and so does the page', () => {
  for (const [what, a] of Object.entries(answers)) assert.equal(a.robots, 'noindex, nofollow', `${what} lets a search engine index it`);
  assert.equal(answers.robots.status, 200);
  assert.match(answers.robots.type, /^text\/plain/);
  assert.equal(answers.robots.body, 'User-agent: *\nDisallow: /\n');
  assert.ok(read('../../web/index.html').includes('<meta name="robots" content="noindex, nofollow" />'));
});

// ---------------------------------------------------------------- the app's own side

const app = read('../../web/App.tsx');
const modes = JSON.parse(app.match(/const PAGE_MODES = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));

test('every page the app shows by ?mode= is one it knows, so none of them is ever taken for a page that does not exist', () => {
  const shown = [...app.matchAll(/^ {2}if \(mode === '([a-z-]+)'\)/gm)].map((m) => m[1]);
  assert.ok(shown.length >= 10, 'the pages were not found in App.tsx');
  for (const m of shown) assert.ok(modes.includes(m), `?mode=${m} is shown but not known`);
  // And every link the app or its guides hand out.
  const linked = new Set();
  const files = ['../../web/App.tsx', '../../shared/guides.js', '../../README.md', ...fs.readdirSync(new URL('../../web/components/views/', SCRIPT_URL)).map((f) => `../../web/components/views/${f}`)];
  for (const f of files) {
    const text = read(f);
    for (const m of text.matchAll(/\?mode=([a-z-]+)|searchParams\.set\('mode', '([a-z-]+)'\)|\{url:([a-z-]+)\}|\{ mode: '([a-z-]+)', words:/g)) linked.add(m[1] || m[2] || m[3] || m[4]);
  }
  assert.ok(linked.size >= 8, `too few links found: ${[...linked]}`);
  for (const m of linked) assert.ok(modes.includes(m), `a link to ?mode=${m} would open a page that does not exist`);
});

test('a page that does not exist says so, before any other page is chosen, and every screen names itself in the tab', () => {
  assert.ok(app.includes("const APP_PATHS = ['/', '/index.html'];"));
  const notFound = app.indexOf('if (notFound) return');
  assert.ok(notFound > 0 && notFound < app.indexOf("if (mode === 'alerts')"), 'another page is chosen first');
  assert.ok(app.includes('document.title = screenTitle ? `${screenTitle} · Simon Says` : \'Simon Says\';'));
  const page = read('../../web/components/NotFoundPage.tsx');
  assert.ok(page.includes('data-not-found') && page.includes("back.searchParams.delete('mode')"));
  const strings = read('../../web/constants.ts');
  for (const key of ['notFoundTitle', 'notFoundHint', 'notFoundBack', 'notFoundTab']) {
    assert.equal(strings.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
  }
});

// ---------------------------------------------------------------- the privacy note

test('PRIVACY.md names every service the code reaches out to, and the forgetting the app really offers', () => {
  const note = read('../../PRIVACY.md');
  for (const service of ['Twitch', 'YouTube', 'Discord', 'Spotify', 'TikTok', 'Euler Stream', 'VDO.Ninja', 'Gemini', 'jsDelivr', 'OBS', 'DroidCam']) {
    assert.ok(note.includes(service), `${service} is not in the privacy note`);
  }
  const months = FORGET_CHOICES.filter(Boolean);
  assert.ok(note.includes(`${months.slice(0, -1).join(', ')} or ${months[months.length - 1]} months`), 'the note offers forgetting the app does not');
  assert.ok(read('../../README.md').includes('[PRIVACY.md](PRIVACY.md)'), 'the README does not point at it');
});
