/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: who a pixel avatar or a PNGtuber can be set to talk with —
 * whoever is in the Discord call now, the people already set up, and
 * everyone else in the Discord server, so a friend can be picked before
 * they join.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const { talkChoices, allChoices } = await import('../../../shared/talk-people.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

const NEL = '200000000000000001';
const ANA = '200000000000000002';
const BOB = '200000000000000003';
const ZOE = '200000000000000004';
const SHY = '200000000000000005';
const GONE = '200000000000000006';

const voice = {
  persons: { [ANA]: { name: 'ana_discord', streamName: 'Ana' }, [SHY]: { name: 'Shy', offStream: true } },
  pictures: { [BOB]: { name: 'Bob', avatar: true } },
  pinned: [{ id: ANA, name: 'ana_discord' }],
  follow: null,
};
const server = [
  { id: NEL, name: 'Nolan' }, { id: ANA, name: 'ana_discord' }, { id: BOB, name: 'Bob' },
  { id: ZOE, name: 'zoe' }, { id: SHY, name: 'Shy' }, { id: 'not-an-id', name: 'Broken' },
];
const choices = talkChoices({
  members: [{ id: NEL, name: 'Nel' }],
  voice,
  regulars: [{ name: 'Zoe the regular', discordId: ZOE }, { name: 'No Discord' }],
  server,
  chosen: null,
});
const ids = (list) => list.map((p) => p.id);

test('whoever is in the call comes first, as before', () => {
  assert.deepEqual(choices.inCall, [{ id: NEL, name: 'Nel' }]);
});

test('the people already set up come next, under their name on stream', () => {
  // Ana by her stream name, Bob for his pictures, Zoe as a Who's on regular with a Discord account.
  assert.deepEqual(choices.known.map((p) => p.name), ['Ana', 'Bob', 'Zoe the regular']);
  assert.ok(!ids(choices.known).includes(NEL), 'somebody in the call is offered twice');
});

test('then everyone else in the Discord server, each person once', () => {
  assert.deepEqual(choices.server, [], `offered twice: ${choices.server.map((p) => p.name).join(', ')}`);
  const fresh = talkChoices({ server, voice: {} });
  assert.deepEqual(fresh.server.map((p) => p.name), ['ana_discord', 'Bob', 'Nolan', 'Shy', 'zoe'], 'not by name, or a broken id got through');
  const all = ids(allChoices(choices));
  assert.equal(new Set(all).size, all.length, 'somebody is offered twice');
});

test('nobody kept off stream is offered, since the call never says when they talk', () => {
  assert.ok(!ids(allChoices(choices)).includes(SHY), 'a person kept off stream is offered');
});

test('the one chosen before is always offered, and warned about when kept off stream', () => {
  assert.equal(choices.kept, null, 'somebody already listed is offered again');
  const gone = talkChoices({ voice, chosen: { id: GONE, name: 'Old friend' } });
  assert.deepEqual(gone.kept, { id: GONE, name: 'Old friend' });
  const shy = talkChoices({ voice, chosen: { id: SHY, name: 'Shy' } });
  assert.equal(shy.kept?.offStream, true, 'choosing somebody kept off stream gives no warning');
  assert.equal(talkChoices({ chosen: { id: 'mic', name: 'mic' } }).kept, null, 'the microphone is taken for a person');
});

test('with an empty call, the list is no longer empty', () => {
  // The live case that asked for this: listening on, nobody in the call yet.
  const empty = talkChoices({ members: [], voice, server });
  assert.ok(allChoices(empty).length >= 4, 'with nobody in the call, nobody can be chosen');
});

test('the pixel avatar and the PNGtuber pick from the same list', () => {
  const select = read('../../web/components/TalkWithSelect.tsx');
  for (const group of ['inCall', 'known', 'server']) assert.ok(select.includes(`choices.${group}]`), `the ${group} group is not shown`);
  assert.ok(select.includes('<optgroup'), 'the groups are not told apart');
  for (const file of ['AvatarLayerPanel.tsx', 'PngtuberLayerPanel.tsx']) {
    const panel = read(`../../web/components/${file}`);
    assert.ok(panel.includes('<TalkWithSelect') && !panel.includes('members.some('), `${file} still lists only the call`);
  }
  const editor = read('../../web/components/views/LayoutsView.tsx');
  assert.equal(editor.split('choices={talkChoicesFor(layer)}').length - 1, 2, 'a talking layer is not given the whole list');
  assert.ok(editor.includes('system?.actions?.listServerMembers') && editor.includes("if (!talks || !discordUp || !list) return undefined;"), 'the server is asked whenever, or never');
});

test('the words for it are in both languages', () => {
  const strings = read('../../web/constants.ts');
  const select = read('../../web/components/TalkWithSelect.tsx');
  const keys = [...new Set([...select.matchAll(/t\.(\w+) \|\|/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 8, `only ${keys.length} strings`);
  for (const key of keys) assert.equal(strings.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  assert.ok(!strings.includes('    pngtuberDiscordPerson:'), 'the old "In the Discord call:" prefix is still there with nothing to say it');
});
