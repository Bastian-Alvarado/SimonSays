/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the left-hand menu (web/components/NavMenu.tsx, App.tsx) —
 * every screen still reachable from it after the regrouping, each once; the
 * paired screens one entry with tabs between them; the search reaching every
 * screen by its own name; the badges, the row of platforms, the phone's bar
 * and its room at the end of every screen; and every new word in both
 * languages.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { assert, fs, test } from './harness.js';

const read = (p) => fs.readFileSync(new URL(`../../../web/${p}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const menu = read('components/NavMenu.tsx');
const constants = read('constants.ts');
const views = [...read('types.ts').match(/export type AppView = ([^;]+);/)[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

const sections = app.slice(app.indexOf('const navSections: NavSection[] = ['), app.indexOf('// Every screen for the search'));
const entries = [...sections.matchAll(/\{ view: (?:lastOfPair\.\w+ \|\| )?'([a-z-]+)'(?:, also: \[([^\]]*)\])?/g)];
const listed = entries.map((m) => m[1]);
const reached = new Set(entries.flatMap((m) => [m[1], ...[...(m[2] || '').matchAll(/'([a-z-]+)'/g)].map((x) => x[1])]));
const searchable = app.slice(app.indexOf('const searchEntries'), app.indexOf('const statusMarks'));

test('every screen is in the menu, once; the paired ones as one entry with tabs between them', () => {
  assert.ok(views.length >= 38, 'the list of screens was not read');
  for (const v of views) assert.ok(reached.has(v), `the "${v}" screen cannot be reached from the menu`);
  assert.equal(new Set(listed).size, listed.length, 'a screen is in the menu twice');
  assert.deepEqual([...sections.matchAll(/\{ id: '([a-z]+)', label:/g)].map((m) => m[1]), ['live', 'community', 'screen', 'discord', 'automation', 'setup']);
  for (const pair of [["'countdown'", "'timer'"], ["'reaction-roles'", "'discord-buttons'"]]) {
    assert.ok(app.includes(`<ScreenTabs view={view} go={goTo} tabs={[{ view: ${pair[0]}`) && app.includes(`{ view: ${pair[1]}, label:`), `${pair.join(' and ')} have no tabs between them`);
  }
});

test('the search reaches every screen, the paired ones each by its own name too', () => {
  assert.ok(searchable.includes('navSections.flatMap'), 'the search does not hold the menu\'s screens');
  for (const v of ['countdown', 'timer', 'reaction-roles', 'discord-buttons']) assert.ok(searchable.includes(`view: '${v}'`), `"${v}" cannot be searched for by its own name`);
  assert.ok(app.includes("(e.ctrlKey || e.metaKey)") && app.includes("e.key.toLowerCase() === 'k'"), 'Ctrl+K does not open the search');
  assert.ok(menu.includes("normalize('NFD')"), 'the search minds accents');
});

test('badges for what wants doing; the platforms as one row; the phone\'s bar never covering a screen', () => {
  assert.ok(sections.includes('number: waitingQuestions || undefined') && sections.includes('number: newRequests || undefined'));
  assert.ok(sections.includes("dot: pollOpen ? 'on'") && sections.includes("dot: giveawayOpen ? 'on'") && sections.includes("dot: dropped.length ? 'alert'"));
  assert.ok(!/view: 'studio'[^}]*number/.test(sections) && !/view: 'actions'[^}]*number/.test(sections), 'commands and actions still count themselves');
  assert.ok(app.includes("wasOn.current.has(String(k))") && !app.slice(app.indexOf('const WATCHED'), app.indexOf('const wasOn')).includes('tiktok'), 'TikTok going with the stream would count as dropped');
  for (const id of ['twitch', 'twitchBot', 'tiktok', 'discord', 'obs', 'spotify', 'youtube']) assert.ok(app.includes(`{ id: '${id}', name:`), `${id} is not in the row of platforms`);
  assert.ok(app.includes('<PhoneBar items={phoneItems}') && app.includes('data-phone-bar-room'), 'the phone has no bar, or it covers the end of a screen');
  assert.ok(menu.includes("localStorage.setItem(CLOSED_KEY"), 'folded sections are not remembered');
});

test('every word the menu adds is in both languages', () => {
  const keys = new Set([...(app + menu).matchAll(/\bt\.(nav[A-Z][A-Za-z]+)/g)].map((m) => m[1]));
  assert.ok(keys.size >= 15);
  for (const key of keys) assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
});
