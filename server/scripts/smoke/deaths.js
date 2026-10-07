/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The deaths count.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, chat, engine, fs, said, settle, test } from './harness.js';
import { mod, runCommand } from './chat-steps.js';

const counters = await import('../../engine/counters.js');
const { fillTemplate } = await import('../../../shared/overlay-vars.js');
const { DOCK_BUILTIN_IDS } = await import('../../../shared/dock-builtins.js');
const count = () => counters.getCounters().deaths;
const change = (op, value) => engine.store.counter({ name: 'deaths', op, value });

change('reset');
const seen = [];
counters.changeCounter('deaths', 'auto', ''); seen.push(count());
counters.changeCounter('deaths', 'auto', '+2'); seen.push(count());
counters.changeCounter('deaths', 'auto', '-1'); seen.push(count());
counters.changeCounter('deaths', 'auto', '7'); seen.push(count());
counters.changeCounter('deaths', 'subtract', '50'); seen.push(count());
counters.changeCounter('deaths', 'add', 'nothing numeric'); seen.push(count());
test('the deaths count reads what was typed: nothing is one more, +2, -1, a bare number sets, and it never goes below none', () => {
  assert.deepEqual(seen, [1, 3, 2, 7, 0, 1]);
});

change('reset');
runCommand('muerte', [
  { type: 'deaths_change', config: { value: '{input}', deathsOp: 'auto' } },
  { type: 'twitch_chat', config: { message: 'Muertes: {deaths}' } },
]);
said.length = 0;
chat('!muerte', mod);
await settle();
chat('!muerte', mod);
await settle();
const afterTwo = count();
const chatSaid = [...said];
test('"!muerte" adds one each time, and a chat step after it can say the count', () => {
  assert.equal(afterTwo, 2);
  assert.ok(chatSaid.some((l) => /Muertes: 2/.test(l)), `chat said ${JSON.stringify(chatSaid)}`);
});

change('reset');
await engine.runDockBuiltin('deaths_add');
await engine.runDockBuiltin('deaths_add');
await engine.runDockBuiltin('deaths_subtract');
const deckCount = count();
change('reset');
let refused = null;
try { await engine.runDockBuiltin('deaths_subtract'); } catch (err) { refused = err.message; }
test('the deck has buttons for it, and taking one from none says so', () => {
  assert.equal(deckCount, 1);
  assert.equal(refused, 'the count is already at none');
  for (const id of ['deaths_add', 'deaths_subtract', 'deaths_reset']) assert.ok(DOCK_BUILTIN_IDS.includes(id), id);
});

change('set', '12');
test('a text layer shows it as {deaths}, the snapshot carries it, and a backup keeps it', () => {
  assert.equal(fillTemplate('MUERTES: {deaths}', { counters: engine.snapshot().counters }), 'MUERTES: 12');
  assert.equal(fillTemplate('MUERTES: {deaths}', {}), 'MUERTES: 0', 'no count yet should read as none, not as a dash');
  const backup = fs.readFileSync(new URL('../engine/backup.js', SCRIPT_URL), 'utf8');
  assert.ok(backup.includes("{ name: 'counters' }"), 'the count is left behind by a backup');
  const game = fs.readFileSync(new URL('../../web/components/views/GameView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(game.includes("changeDeaths('add')") && game.includes("changeDeaths('reset')"), 'the Game screen cannot change it');
});
change('reset');
