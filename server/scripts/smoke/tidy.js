/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the words the app carries are the words it uses.
 *
 * The audit before 2.0.0 found 115 translation keys nothing read any more —
 * the old TikTok and Discord "server.js" setup steps from V2, screens since
 * rewritten, labels whose screen moved on — each in both languages. This
 * keeps it that way: every key is read somewhere, by name or by a prefix or
 * suffix a screen builds it from, and both languages hold the same keys.
 *
 * Runs in order with the other feature files, through scripts/smoke.js.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const root = new URL('../../', SCRIPT_URL);
const sources = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (/node_modules|[\\/]dist$/.test(p)) continue;
    if (e.isDirectory()) walk(p);
    else if (/\.(m?js|tsx?)$/.test(e.name) && !p.endsWith('constants.ts')) sources.push(fs.readFileSync(p, 'utf8'));
  }
}
walk(fileURLToPath(new URL('web/', root)));
walk(fileURLToPath(new URL('shared/', root)));
const code = sources.join('\n');

const constants = fs.readFileSync(new URL('web/constants.ts', root), 'utf8');
const enAt = constants.indexOf('en: {');
const esAt = constants.indexOf('es: {', enAt + 5);
const keysIn = (text) => [...text.matchAll(/^ {4}([A-Za-z_][\w]*)\s*:/gm)].map((m) => m[1]);
const en = keysIn(constants.slice(enAt, esAt));
const es = keysIn(constants.slice(esAt));

// Keys a screen builds rather than names: t[`alertType${…}`], t[`${key}Hint`] and the like.
const prefixes = new Set([
  ...code.matchAll(/t\??\.?\[`([A-Za-z_]+)\$\{/g),
  ...code.matchAll(/`([a-z][A-Za-z_]+)\$\{(?:pascal|keyPart)/g),
  ...code.matchAll(/t\??\.?\[['"]([A-Za-z_]+)['"]\s*\+/g),
].map((m) => m[1]));
const suffixes = new Set([...code.matchAll(/\}([A-Za-z]+)`\]/g)].map((m) => m[1]));
const named = (k) => new RegExp(`\\b${k}\\b`).test(code);
const built = (k) => [...prefixes].some((p) => k.startsWith(p) && k.length > p.length)
  || [...suffixes].some((s) => k.endsWith(s) && k.length > s.length && named(k.slice(0, -s.length)));

test('every translation key is read somewhere', () => {
  assert.ok(en.length > 3000, `only ${en.length} keys found — has the way they are written changed?`);
  assert.ok(prefixes.has('alertType') && prefixes.has('layerKind_') && suffixes.has('Hint'), 'the built keys are no longer recognised');
  const unread = en.filter((k) => !named(k) && !built(k));
  assert.deepEqual(unread, [], `keys nothing reads: ${unread.join(' ')}`);
});

/*
  Every page OBS shows is this same app, and each one downloaded the whole
  dashboard with it: one 2.9 MB script for a page that draws a chat. Screens
  load when the dashboard opens them, and what every page reads stays small:
  the dock's chat stylesheet without the Library's every look, the guides
  only for the dashboard.
*/
test('the pages OBS shows load only what they draw, not the dashboard\'s screens', () => {
  const app = fs.readFileSync(new URL('web/App.tsx', root), 'utf8');
  const direct = [...app.matchAll(/^import \{[^}]*\} from '\.\/components\/views\/(\w+)'/gm)].map((m) => m[1]);
  assert.deepEqual(direct, [], `screens imported with the page again: ${direct.join(', ')}`);
  assert.ok(/const ActionsView = screen\(\(\) => import\('\.\/components\/views\/ActionsView'\), 'ActionsView'\);/.test(app));
  assert.ok(app.includes('<Suspense fallback={<ScreenLoading t={t} />}>'), 'a screen loading has nothing to show meanwhile');
  assert.ok(!/^import \{[^}]*\} from '\.\.\/shared\/guides\.js'/m.test(app), 'the guides are loaded with every page again');
  assert.ok(app.includes("import('../shared/guides.js')"));
  const system = fs.readFileSync(new URL('web/hooks/useStreamSystem.ts', root), 'utf8');
  assert.ok(!system.includes("from '../../shared/css-presets.js'"), 'every page carries the Library\'s every look again');
  assert.ok(system.includes("import { DOCK_CHAT_CSS } from '../../shared/dock-chat-css.js';"));
});

test('both languages hold the same keys, each once', () => {
  assert.deepEqual(en.filter((k) => !es.includes(k)), [], 'in English only');
  assert.deepEqual(es.filter((k) => !en.includes(k)), [], 'in Spanish only');
  assert.deepEqual(en.filter((k, i) => en.indexOf(k) !== i), [], 'twice in English');
  assert.deepEqual(es.filter((k, i) => es.indexOf(k) !== i), [], 'twice in Spanish');
});
