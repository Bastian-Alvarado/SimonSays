/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the server's refusals and the built-in dock buttons, in the
 * screen's language.
 *
 * The server says no in English, once, with a code; each screen turns the
 * code into its own words (web/words.ts). These make sure every code the
 * server can send has words in both languages, that the words carry the
 * number or name that goes in them, and that the screens look the words up
 * instead of showing the English as it came.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const constants = read('../../web/constants.ts');
const bothLanguages = (key) => constants.split(`    ${key}: '`).length - 1 === 2;
// Read from the file as the screens have it: English first, then Spanish.
const wordsFor = (key) => [...constants.matchAll(new RegExp(`    ${key}: '([^'\\n]*)',`, 'g'))].map((m) => m[1]);

const { refusalKey, builtinKey, refusalWords, builtinName, shoutoutWords } = await import('../../../web/words.ts');
const { DOCK_BUILTINS } = await import('../../../shared/dock-builtins.js');
const plan = await import('../../engine/plan.js');
const people = await import('../../engine/people.js');
const questions = await import('../../engine/questions.js');

// ------------------------------------------------------------ every code has words

test('every refusal the server can send has words in both languages', () => {
  const sources = ['plan.js', 'people.js', 'questions.js', 'index.js', 'twitch-extras.js', 'pixel-avatars.js', 'welcome.js', 'announce.js', 'schedule-events.js', 'giveaway.js', 'discord-pages.js', 'viewer-history.js', 'points.js', 'highlights.js', 'live-dms.js', 'remote-players.js', 'game-requests.js', 'moderation.js', 'banner-text.js'].map((f) => read(`../engine/${f}`)).join('\n');
  const codes = new Set([
    ...[...sources.matchAll(/refusal\('([a-z_]+)'/g)].map((m) => m[1]),
    ...[...sources.matchAll(/code: '([a-z_]+)'/g)].map((m) => m[1]),
  ]);
  // Twitch's own "not signed in", from its API helper, reaches Who's on through a shoutout.
  assert.ok(read('../platforms/twitch.js').includes("throw refusal('twitch_offline', 'Twitch: not authenticated')"));
  codes.add('twitch_offline');
  // Spotify's "not open anywhere", from a press that found no device to bring back, reaches the dock.
  assert.ok(read('../platforms/spotify.js').includes("throw refusal('spotify_no_device', "));
  codes.add('spotify_no_device');
  // YouTube's, from posting in its chat: the dock's box says them.
  const youtubeSrc = read('../platforms/youtube.js');
  for (const m of youtubeSrc.matchAll(/refusal\('([a-z_]+)'/g)) codes.add(m[1]);
  assert.ok(codes.size >= 25, `only ${codes.size} codes found — has the way they are written changed?`);
  for (const code of codes) assert.ok(bothLanguages(refusalKey(code)), `"${code}" (${refusalKey(code)}) is not in both languages`);
  // Nothing left in these that says no without a code.
  for (const f of ['plan.js', 'people.js', 'questions.js']) {
    assert.ok(!read(`../engine/${f}`).includes('throw new Error('), `${f} still refuses without a code`);
  }
});

test('every built-in dock button has a name in both languages, the English one as the server names it', () => {
  for (const b of DOCK_BUILTINS) {
    const [en, es] = wordsFor(builtinKey(b.id));
    assert.equal(en, b.name, `${b.id}: the English name drifted from the server's`);
    assert.ok(es && es !== b.name, `${b.id} has no Spanish name`);
  }
});

// ------------------------------------------------------------ the words themselves

// The Spanish strings, as a screen in Spanish has them: the second of each pair.
const spanish = {};
{
  const seen = new Set();
  for (const [, k, v] of constants.matchAll(/    ([A-Za-z]+): '([^'\n]*)',/g)) {
    if (seen.has(k)) spanish[k] = v; else seen.add(k);
  }
}

let planNameless = null;
let regularNameless = null;
let dockOnEmptyPlan = null;
let dockOnMissingAction = null;
let duplicateQuestion = null;
const savedBefore = plan.getSaved();
try { plan.savedControl({ op: 'save', name: '' }); } catch (err) { planNameless = err; }
try { people.control({ op: 'regular_save', regular: { name: '' } }); } catch (err) { regularNameless = err; }
const planBefore = plan.getPlan();
engine.store.setPlan({ items: [], currentId: '' });
try { await engine.runDockBuiltin('plan_next'); } catch (err) { dockOnEmptyPlan = err; }
engine.store.setPlan(planBefore);
try { await engine.runDockAction('no-such-action'); } catch (err) { dockOnMissingAction = err; }
questions.clear();
questions.addQuestion({ user: 'Ana', text: 'una' });
try { questions.control({ op: 'add', user: 'Ana', text: 'una' }); } catch (err) { duplicateQuestion = err; }
questions.clear();

test('what the server refuses comes with its code, and the screen says it in Spanish', () => {
  assert.equal(planNameless?.code, 'plan_name');
  assert.equal(regularNameless?.code, 'regular_name');
  assert.equal(dockOnEmptyPlan?.code, 'plan_empty');
  assert.equal(dockOnMissingAction?.code, 'action_gone');
  assert.equal(duplicateQuestion?.code, 'question_duplicate');
  assert.equal(refusalWords(spanish, planNameless), 'Ponle un nombre al plan.');
  assert.equal(refusalWords(spanish, dockOnEmptyPlan), 'El plan del directo está vacío.');
  assert.deepEqual(plan.getSaved(), savedBefore);
});

test('a number or a name goes into the sentence, and anything without words shows as it came', () => {
  assert.equal(refusalWords(spanish, { code: 'plans_full', message: 'there are already 20 saved plans', vars: { n: 20 } }), 'Ya hay 20 planes guardados. Borra uno primero.');
  assert.equal(refusalWords(spanish, { code: 'no_channel', error: 'no Twitch channel called x', vars: { login: 'amiga' } }), 'No hay ningún canal de Twitch llamado amiga.');
  assert.equal(refusalWords(spanish, { code: 'something_new', message: 'something new went wrong' }), 'something new went wrong');
  assert.equal(refusalWords(spanish, { message: 'Twitch Helix 500' }), 'Twitch Helix 500');
  // The limits travel with the refusal, so the sentence has the real number.
  assert.ok(read('../engine/plan.js').includes("{ n: MAX_SAVED_PLANS }") && read('../engine/people.js').includes('{ n: MAX_REGULARS }'));
});

test('the socket carries the code and what fills it, and the app keeps both', () => {
  assert.ok(read('../api/ws.js').includes('...(err.vars ? { vars: err.vars } : {})'));
  assert.ok(read('../../web/hooks/useBackend.ts').includes('if (msg.payload?.vars) err.vars = msg.payload.vars;'));
});

test('a built-in button is named in the screen\'s language', () => {
  const b = DOCK_BUILTINS.find((x) => x.id === 'question_next');
  assert.equal(builtinName(spanish, b), 'Siguiente pregunta');
  assert.equal(builtinName({}, b), 'Next question');
  const grid = read('../../web/components/DockActionsGrid.tsx');
  const list = read('../../web/components/views/DockActionsView.tsx');
  assert.ok(!grid.includes('builtin?.name') && !list.includes('{b.name}') && !list.includes('builtin?.name'), 'a built-in button name is still drawn in English');
});

test('a shoutout that only partly went says which part, instead of "Shoutout sent"', () => {
  assert.deepEqual(shoutoutWords(spanish, { ok: true, failures: [] }), { ok: true, text: spanish.peopleShoutoutDone });
  const partly = shoutoutWords(spanish, { ok: true, failures: [{ part: 'native', code: 'not_live', message: 'The broadcaster is not streaming live' }] });
  assert.deepEqual(partly, { ok: false, text: 'Solo salió en parte. El shoutout de Twitch necesita que estés en directo.' });
  assert.equal(shoutoutWords(spanish, { ok: false, code: 'nobody_to_shout', error: 'nobody to shout out' }).text, 'No hay nadie a quien darle shoutout.');
});

test('the screens look the words up instead of showing the server\'s English', () => {
  for (const file of ['views/PlanView.tsx', 'views/PeopleView.tsx', 'views/QuestionsView.tsx', 'DockPlan.tsx', 'DockActionsGrid.tsx', 'views/TwitchView.tsx']) {
    const src = read(`../../web/components/${file}`);
    assert.ok(!/err\??\.message/.test(src), `${file} still shows a refusal as the server said it`);
    assert.ok(src.includes('refusalWords(t, '), `${file} does not look its refusals up`);
  }
});

const { PROFILE_GROUPS } = await import('../../engine/profiles.js');

test('the profile bar speaks both languages: its group names, and what it asks before it replaces anything', () => {
  const bar = read('../../web/components/ProfileSwitcher.tsx');
  const keys = new Set([...bar.matchAll(/\bt\.(profile[A-Za-z]+)/g)].map((m) => m[1]));
  // The group names come from the server in English; each has words of its own.
  for (const g of PROFILE_GROUPS) {
    const key = [...bar.matchAll(new RegExp(`  ${g.id}: '(profileGroup[A-Za-z]+)',`, 'g'))].map((m) => m[1])[0];
    assert.ok(key, `the "${g.id}" group has no words on the bar`);
    keys.add(key);
  }
  // Nineteen since the chat's group went into the overlays one, its chat now a layer like the rest.
  assert.ok(keys.size >= 19, `only ${keys.size} strings found`);
  for (const key of keys) assert.ok(bothLanguages(key), `${key} is not in both languages`);
  // No question to the streamer written in English only.
  assert.ok(!/window\.(confirm|prompt)\(`/.test(bar) && !bar.includes('{state.label}'));
});
