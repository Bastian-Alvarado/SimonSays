/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Game and Who's on screens, which were the Run screen. Both
 * languages, on the screens and in the layer panels for the people on them; a
 * year that is not one refused out loud; a couch never offered seats it could
 * only draw empty; the previews and the clear buttons; and the split itself.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';
import { MAX_COMMENTATORS, NAMEPLATE_SOURCES, rosterCapacity, sameGame } from '../../../shared/run.js';
import { normaliseLayouts } from '../../engine/layouts.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const CONSTANTS = read('../../web/constants.ts');
const bothLanguages = (key) => CONSTANTS.split(`    ${key}: '`).length - 1 === 2;

test('the Game and Who’s on screens, and the panels for the people on them, speak both languages', () => {
  for (const file of ['../../web/components/views/GameView.tsx', '../../web/components/views/PeopleView.tsx', '../../web/components/RunParts.tsx', '../../web/components/RosterLayerPanel.tsx']) {
    const src = read(file);
    const keys = [...new Set([...src.matchAll(/\bt\.((?:run|roster|game|people)[A-Za-z]+)/g)].map((m) => m[1]))];
    assert.ok(keys.length >= 1, `only ${keys.length} strings in ${file}`);
    for (const key of keys) assert.ok(bothLanguages(key), `${key} is not in both languages`);
  }
  // The roster's choices are looked up by key, with the hint beside each.
  for (const key of ['rosterWhoCommentators', 'rosterWhoCouch', 'rosterWhoEveryone']) {
    assert.ok(bothLanguages(key) && bothLanguages(`${key}Hint`), `${key} is not in both languages`);
  }
  // And the nameplate's "who it is about".
  for (const key of ['plateAbout', 'layoutPlateName', 'layoutPlateSubtitle', ...new Set(NAMEPLATE_SOURCES.map((s) => s.key))]) {
    assert.ok(bothLanguages(key), `${key} is not in both languages`);
  }
  assert.ok(read('../../web/components/views/LayoutsView.tsx').includes("String(t[src.key] || src.label).split('{n}')"), 'the nameplate sources are still read in English');
});

test('a year that is not one is refused out loud, not blanked', () => {
  const view = read('../../web/components/views/GameView.tsx');
  assert.ok(view.includes("if (year && !/^[0-9]{4}$/.test(year)) {") && view.includes('setBadYear(year);'), 'a bad year is still sent to be blanked');
  assert.ok(bothLanguages('runYearInvalid'));
});

test('a couch is never given more seats than the people it can seat', () => {
  assert.equal(rosterCapacity('commentators'), MAX_COMMENTATORS);
  assert.equal(rosterCapacity('couch'), MAX_COMMENTATORS + 1);
  assert.equal(rosterCapacity('everyone'), MAX_COMMENTATORS + 2);
  const seatsFor = (include) => normaliseLayouts([{ id: 'r', layers: [{ type: 'roster', config: { include, seats: 8 } }] }])[0].layers[0].config.seats;
  assert.equal(seatsFor('commentators'), 4);
  assert.equal(seatsFor('everyone'), 6);
  assert.ok(read('../../web/components/RosterLayerPanel.tsx').includes('max={most}'), 'the editor still offers eight');
  assert.ok(read('../../web/components/RosterLayer.tsx').includes('Math.min(rosterCapacity(include), config.seats ?? 4)'));
  // One number for the commentators, everywhere.
  assert.equal(NAMEPLATE_SOURCES.filter((s) => s.id.startsWith('commentator')).length, MAX_COMMENTATORS);
  assert.ok(/import \{[^}]*\bMAX_COMMENTATORS\b[^}]*\} from '\.\.\/\.\.\/shared\/run\.js';/.test(read('../engine/index.js')), 'the engine keeps a commentator count of its own');
});

test('the same game is the same game however it is typed', () => {
  assert.ok(sameGame('Mega Man 2', ' mega  man 2 '));
  assert.ok(!sameGame('Mega Man 2', 'Mega Man 3'));
  assert.ok(!sameGame('', ''), 'two empty games are not the same game');
});

test('each screen shows what it will look like, and can be emptied in one press', () => {
  const game = read('../../web/components/views/GameView.tsx');
  const people = read('../../web/components/views/PeopleView.tsx');
  assert.ok(game.includes('data-run-preview="game"') && game.includes('<RunCard config={firstLayer(layouts, \'runcard\')} run={run} />'), 'there is no preview of the card');
  assert.ok(people.includes('data-run-preview="people"') && people.includes('<RosterLayer'), 'there is no preview of the people');
  assert.ok(game.includes('const clearGame = () =>'), 'the game cannot be emptied');
  assert.ok(people.includes('const clearPeople = () =>'), 'the people cannot be taken off');
});

test('the Run screen is two, the Game and Who’s on, editing the one record', () => {
  const app = read('../../web/App.tsx');
  assert.ok(!fs.existsSync(new URL('../../web/components/views/RunView.tsx', SCRIPT_URL)), 'the old screen is still there');
  assert.ok(app.includes("{ view: 'run', label: t.gameNav || 'Game'"), 'there is no Game tab');
  assert.ok(app.includes("{ view: 'people', label: t.navPeopleOnStream || 'People on stream'"), 'there is no Who’s on tab');
  // Both save through the run's one message, so every reader of it still agrees.
  const saves = app.split('setRun={system.actions.setRun}').length - 1;
  assert.equal(saves, 2, 'the two screens do not both edit the run');
  assert.equal(app.split("layouts={(system.data as any).layouts || []}").length - 1 >= 2, true, 'a preview is not handed the layouts');
  assert.ok(read('../../web/types.ts').includes("| 'run' | 'people' |"));
  for (const key of ['gameNav', 'peopleNav', 'peopleHint', 'gamePreviewEmpty', 'peoplePreviewEmpty', 'runCardHint']) assert.ok(bothLanguages(key), `${key} is not in both languages`);
  assert.ok(!CONSTANTS.includes('runNav:'), 'the old tab name is still there');
});
