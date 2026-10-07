/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Who's on screen's second half. Regulars and crews, seating
 * people from the Discord call — once, or following it — a shoutout for
 * anybody with a Twitch login, moving somebody to another seat, and the
 * commentators joined in Spanish on stream.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, EVENTS, engine, fs, settle, test } from './harness.js';
import * as people from '../../engine/people.js';
import { cleanLogin, cleanPerson } from '../../../shared/run.js';
import { OVERLAY_VARS } from '../../../shared/overlay-vars.js';
import { MANIFEST } from '../../engine/backup.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const runNow = () => engine.snapshot().run;
const names = (list) => (list || []).map((p) => p?.name);
const call = (members) => bus.emit(EVENTS.CONFIG, { key: 'voice', value: { channelId: '900000000000000001', members } });

// ------------------------------------------------------------ on stream

test('the commentators are joined in Spanish on stream', () => {
  const v = OVERLAY_VARS.find((x) => x.name === 'commentators');
  assert.equal(v.get({ run: { commentators: [{ name: 'Ana' }, { name: 'Bo' }, { name: 'Cy' }] } }), 'Ana, Bo y Cy');
  assert.equal(v.get({ run: { commentators: [{ name: 'Ana' }, { name: 'Bo' }] } }), 'Ana y Bo');
  assert.equal(v.get({ run: { commentators: [{ name: 'Ana' }] } }), 'Ana');
});

// ------------------------------------------------------------- a person

test('a person keeps a Twitch login and a Discord account when they are real ones', () => {
  assert.equal(cleanLogin('@PixelPepp'), 'pixelpepp');
  assert.equal(cleanLogin('https://www.twitch.tv/ninja_07/'), 'ninja_07');
  assert.equal(cleanLogin('not a login!'), '');
  assert.deepEqual(cleanPerson({ name: ' Ana ', subtitle: 'ella', twitch: '@Ana_1', discordId: '123456789012345678' }), { name: 'Ana', subtitle: 'ella', twitch: 'ana_1', discordId: '123456789012345678' });
  // Somebody nobody linked reads exactly as a seat always has.
  assert.deepEqual(cleanPerson({ name: 'Bo', twitch: '???', discordId: 'x' }), { name: 'Bo', subtitle: '' });
});

engine.store.setRun({ runner: { name: 'Rowan', twitch: 'i_might_be_a_bot' }, host: { name: 'Nolan', subtitle: 'él', twitch: 'pixelpepp' }, commentators: [] });
const kept = runNow();
test('a seat keeps its Twitch login, and a new name in it starts without one', () => {
  assert.equal(kept.host.twitch, 'pixelpepp', 'the run dropped the Twitch login');
  const src = read('../engine/index.js');
  assert.ok(src.includes('if (renamed) { delete next.twitch; delete next.discordId; }'), '"!host Ana" keeps the last host’s Twitch login');
});

// ------------------------------------------------------------ regulars

people.control({ op: 'regular_save', regular: { name: 'Ninja', subtitle: 'él', twitch: '@ninja_07' } });
people.control({ op: 'regular_save', regular: { name: 'ninja', subtitle: 'he/him' } });
people.control({ op: 'regular_save', regular: { name: 'Ana', discordId: '200000000000000002', twitch: 'ana_1' } });
let unnamed = '';
try { people.control({ op: 'regular_save', regular: { name: '  ' } }); } catch (err) { unnamed = err.message; }
const afterRegulars = people.getPeople().regulars;

test('a regular is saved once, however many times they are saved', () => {
  assert.deepEqual(afterRegulars.map((r) => r.name), ['ninja', 'Ana'], 'saving the same person twice made two regulars');
  assert.equal(afterRegulars[0].subtitle, 'he/him');
  assert.equal(afterRegulars[0].twitch, 'ninja_07', 'saving again without the login wiped it');
  assert.equal(unnamed, 'a regular needs a name');
  assert.ok(MANIFEST.some((e) => e.name === 'people'), 'regulars and crews are left out of a backup');
});

// ------------------------------------------------------------ the call

engine.store.setRun({ runner: { name: 'Rowan', discordId: '100000000000000001' }, host: { name: '' }, commentators: [] });
call([
  { id: '100000000000000001', name: 'SimonDiscord' },
  { id: '200000000000000002', name: 'ana.discord' },
  { id: '300000000000000003', name: 'Bo' },
]);
await settle();
const beforeFollow = names(runNow().commentators);
people.control({ op: 'fill' });
const filled = runNow().commentators;
people.control({ op: 'skip', id: '300000000000000003', skip: true });
people.control({ op: 'follow', on: true });
const following = names(runNow().commentators);
call([
  { id: '100000000000000001', name: 'SimonDiscord' },
  { id: '200000000000000002', name: 'ana.discord', speaking: true },
  { id: '300000000000000003', name: 'Bo' },
  { id: '400000000000000004', name: 'Cy' },
]);
await settle();
const afterJoin = names(runNow().commentators);
people.control({ op: 'seat', id: '400000000000000004', seat: 'host' });
const afterSeatHost = runNow();
call([{ id: '100000000000000001', name: 'SimonDiscord' }, { id: '400000000000000004', name: 'Cy' }]);
await settle();
const afterLeave = names(runNow().commentators);
people.control({ op: 'follow', on: false });
people.control({ op: 'skip', id: '300000000000000003', skip: false });

test('the commentator seats fill from the call, as regulars where they are ones', () => {
  assert.deepEqual(beforeFollow, [], 'the call seated people without being asked');
  // Whoever is playing is left out; a regular linked to Discord comes as the regular.
  assert.deepEqual(names(filled), ['Ana', 'Bo']);
  assert.equal(filled[0].twitch, 'ana_1', 'a regular seated from the call lost their Twitch login');
  assert.equal(filled[1].discordId, '300000000000000003');
});

test('following the call, the seats change as people join and leave, and nobody sits twice', () => {
  assert.deepEqual(following, ['Ana'], 'somebody marked never to be seated was seated');
  assert.deepEqual(afterJoin, ['Ana', 'Cy'], 'somebody joining was not seated');
  assert.equal(afterSeatHost.host.name, 'Cy');
  assert.deepEqual(names(afterSeatHost.commentators), ['Ana'], 'moved to host and still a commentator');
  assert.deepEqual(afterLeave, [], 'somebody who left is still seated');
});

// --------------------------------------------------------------- crews

engine.store.setRun({ runner: { name: 'Rowan' }, host: { name: 'Nolan' }, commentators: [{ name: 'Ana' }, { name: 'Bo' }] });
people.control({ op: 'crew_save', name: 'Noche de Among Us' });
engine.store.setRun({ runner: { name: 'Otro' }, host: { name: '' }, commentators: [] });
const crew = people.getPeople().crews.find((c) => c.name === 'Noche de Among Us');
people.control({ op: 'crew_load', id: crew.id });
const seatedCrew = runNow();
people.control({ op: 'crew_delete', id: crew.id });
let nobody = '';
engine.store.setRun({ runner: { name: '' }, host: { name: '' }, commentators: [] });
try { people.control({ op: 'crew_save', name: 'Vacío' }); } catch (err) { nobody = err.message; }

test('a crew seats a whole night at once, and is forgotten when asked', () => {
  assert.deepEqual([seatedCrew.runner.name, seatedCrew.host.name, ...names(seatedCrew.commentators)], ['Rowan', 'Nolan', 'Ana', 'Bo']);
  assert.ok(!people.getPeople().crews.some((c) => c.id === crew.id));
  assert.equal(nobody, 'nobody is seated');
});

// -------------------------------------------------------------- screen

test('the Who’s on screen moves people between seats, shouts them out, and speaks both languages', () => {
  const view = read('../../web/components/views/PeopleView.tsx');
  assert.ok(view.includes('const move = (from: string, to: string) =>') && view.includes('data-seat-move'), 'a seat cannot be moved');
  assert.ok(view.includes('data-seat-shoutout'), 'there is no shoutout beside a person');
  assert.ok(read('../../web/App.tsx').includes("shoutout={(login: string) => system.actions.twitchExtras({ op: 'shoutout', target: login })}"), 'the shoutout does not go through the Twitch screen’s');
  assert.ok(view.includes('data-people-call') && view.includes('data-people-regulars') && view.includes('data-people-crews'));
  // A seat is called, not rendered as a component made anew on every render — or typing in it would lose focus.
  assert.ok(!view.includes('<Seat ') && view.includes('const seat = (slot: string'), 'the seats are rebuilt on every render');
  const constants = read('../../web/constants.ts');
  const keys = [...new Set([...view.matchAll(/\bt\.((?:people|run)[A-Za-z]+)/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 25, `only ${keys.length} strings found`);
  for (const key of keys) assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  assert.ok(read('../../shared/protocol.js').includes("PEOPLE: 'people'") && read('../api/ws.js').includes('engine.store.people(payload)'));
});
