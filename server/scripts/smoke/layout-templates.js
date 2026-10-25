/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: layout templates (server/engine/layout-templates.js) — every
 * scene of a look, ready, with nobody's content in it, made into a new
 * overlay profile in the dashboard's language without touching what is there.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';

const T = await import('../../engine/layout-templates.js');
const { LAYOUT_TEMPLATES } = await import('../../../shared/layout-template-list.js');
const { normaliseLayouts } = await import('../../engine/layouts.js');

const raw = fs.readFileSync(new URL('../engine/layout-templates/simonsays-casual.json', SCRIPT_URL), 'utf8');
const en = normaliseLayouts(T.templateLayouts('simonsays-casual', 'en', 'aaaaa'));
const es = normaliseLayouts(T.templateLayouts('simonsays-casual', 'es', 'bbbbb'));
const texts = (ls) => ls.flatMap((l) => l.layers.filter((x) => x.type === 'text').map((x) => x.config.text));

test('the SimonSays Casual template has every scene and nobody\'s content: no avatar, picture, OBS source, timer, scene or name of anybody\'s', () => {
  assert.equal(en.length, 9);
  assert.equal(LAYOUT_TEMPLATES.find((t) => t.id === 'simonsays-casual').layouts, 9);
  for (const l of en) {
    assert.ok(!l.scenes?.length, `${l.id} is bound to an OBS scene`);
    assert.ok(!l.sceneType, `${l.id} names a scene type of somebody's install`);
    for (const x of l.layers) {
      assert.notEqual(x.type, 'images', `${l.id} shows a picture somebody uploaded`);
      if (x.type === 'avatar') assert.ok(!x.config.character && !x.config.source && !x.config.costume, `${l.id} draws somebody's avatar`);
      if (x.type === 'source') assert.equal(x.config.source, '', `${l.id} names an OBS source`);
      if (x.type === 'countdown') assert.equal(x.config.timer, '', `${l.id} counts down somebody's timer`);
    }
  }
  // Nothing of the streamer's it was made from, in any form.
  for (const bad of ['as-mv0g5', 'All_stars', 'Screen Capture', 'Player on screen', 'example-shark', '"Rowan"', 'i_might_be']) assert.ok(!raw.includes(bad), `left in: ${bad}`);
});

test('a template\'s words come in the dashboard\'s language, and every layout has an id of its own each time it is made', () => {
  assert.ok(texts(en).includes('BE RIGHT BACK') && texts(en).includes('STARTING SOON'), JSON.stringify(texts(en)));
  assert.ok(texts(es).includes('VUELVO ENSEGUIDA') && texts(es).includes('EMPEZAMOS EN BREVE'));
  assert.ok(!JSON.stringify(en).includes('$t'), 'a word was left in both languages');
  assert.equal(en[0].name, 'SimonSays Casual - Starting');
  assert.equal(es[0].name, 'SimonSays Casual - Empezando');
  const ids = new Set([...en, ...es].map((l) => l.id));
  assert.equal(ids.size, 18, 'two layouts share an id');
  // Its vertical sides and groups come with it.
  assert.ok(en.some((l) => l.vertical) && en.some((l) => (l.groups || []).length));
});

const before = engine.store.profileSummary().find((g) => g.id === 'overlays');
const layoutsBefore = JSON.stringify(engine.store.getLayouts());
engine.store.profileCreate('overlays', '', { template: 'simonsays-casual', lang: 'es' });
const after = engine.store.profileSummary().find((g) => g.id === 'overlays');
const made = after.profiles.find((p) => !before.profiles.some((b) => b.id === p.id));
const peeked = made ? engine.store.profilePeek('overlays', made.id) : null;
let unknown = null;
try { engine.store.profileCreate('overlays', 'x', { template: 'nope', lang: 'en' }); } catch (err) { unknown = err.code; }

test('a template is a new overlay profile, named for it, and what is on screen now is not touched', () => {
  assert.ok(made, 'no profile was made');
  assert.equal(made.name, 'SimonSays Casual');
  assert.equal(after.active, before.active, 'making it switched to it');
  assert.equal(JSON.stringify(engine.store.getLayouts()), layoutsBefore, 'the layouts on screen changed');
  assert.equal(peeked.data.layouts.length, 9);
  assert.equal(peeked.data.layouts[0].name, 'SimonSays Casual - Empezando');
  assert.equal(unknown, 'layout_template_unknown');
  const ws = fs.readFileSync(new URL('../api/ws.js', SCRIPT_URL), 'utf8');
  assert.ok(ws.includes("if (payload?.template && payload?.group !== 'overlays') throw refusal('layout_template_unknown'"), 'a template can make a profile of another kind');
  const screen = fs.readFileSync(new URL('../../web/components/ProfileSwitcher.tsx', SCRIPT_URL), 'utf8');
  assert.ok(screen.includes("group === 'overlays' && LAYOUT_TEMPLATES.map((tpl)") && screen.includes('actions.profileCreate(group, name.trim(), { template: tpl.id, lang })'));
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['profileFromTemplate', 'profileTemplatePrompt', 'refuseLayoutTemplateUnknown']) assert.equal(strings.split(`    ${key}: `).length - 1, 2, key);
});


// A new overlay profile, from a template or empty, has the starter omnibar: on, with one slot saying where to change it.
const beforeEmpty = engine.store.profileSummary().find((g) => g.id === 'overlays');
engine.store.profileCreate('overlays', 'Empty one', { lang: 'en' });
const emptyMade = engine.store.profileSummary().find((g) => g.id === 'overlays').profiles.find((p) => !beforeEmpty.profiles.some((b) => b.id === p.id));
const emptyBar = engine.store.profilePeek('overlays', emptyMade.id).data.omnibar;

test('a new overlay profile\'s omnibar is on, with one slot that says where to change it, in the dashboard\'s language', () => {
  assert.equal(emptyBar.enabled, true);
  assert.equal(emptyBar.items.length, 1);
  assert.equal(emptyBar.items[0].type, 'text');
  assert.equal(emptyBar.items[0].text, 'Go to the omnibar tab to modify what appears here!');
  const templateBar = peeked.data.omnibar;
  assert.equal(templateBar.enabled, true);
  assert.equal(templateBar.items[0].text, '¡Ve a la pestaña Omnibar para cambiar lo que aparece aquí!');
  // A fresh install starts with it too.
  const src = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes("omnibar: collection('omnibar', starterOmnibar()),"), 'a fresh install starts with an empty, switched-off omnibar');
});
