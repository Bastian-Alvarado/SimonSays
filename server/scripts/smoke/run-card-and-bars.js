/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The run card following Twitch, more than one omnibar, the tall bar, and goals on either bar.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, SCRIPT_URL, assert, bus, chat, engine, fs, said, settle, test } from './harness.js';
import { mod, runCommand, runNow } from './chat-steps.js';

// ----------------------------------------- the run card follows Twitch

engine.store.setRun({ game: 'Street Fighter 6', platform: 'PC', year: '2023', estimate: '1:00:00', twitchCategoryId: null });
const channel = (id, name, initial = false, title = 'a title') =>
  bus.emit(EVENTS.CHANNEL, { categoryId: id, categoryName: name, title, initial });

channel('55453844', 'Street Fighter 6', true);
test('the first category ever seen is only noted, so the card is not rewritten on connect', () => {
  const r = runNow();
  assert.equal(r.twitchCategoryId, '55453844');
  assert.deepEqual([r.game, r.platform, r.year], ['Street Fighter 6', 'PC', '2023']);
});

channel('55453844', 'Street Fighter 6', false, 'a new title');
test('a title edit is not a category change', () => {
  assert.deepEqual([runNow().game, runNow().platform], ['Street Fighter 6', 'PC']);
});

engine.store.setRun({ ...runNow(), category: 'Any%' });
channel('509658', 'Just Chatting');
test('a new game takes the last game’s details with it — platform, year, category and estimate', () => {
  /*
    The estimate was kept once, as a detail Twitch knows nothing about. But it
    is a fact about the last run like the platform is, and "EST 1:00:00" under
    Just Chatting was wrong on stream in a way nobody noticed.
  */
  const r = runNow();
  assert.deepEqual([r.game, r.platform, r.year, r.category, r.estimate], ['Just Chatting', '', '', '', '']);
});

engine.store.setRun({ ...runNow(), game: 'Mega Man 2', platform: 'NES', year: '1988', category: 'Any%', estimate: '30:00' });
channel('4455', 'mega man 2 ');
test('setting Twitch to the game already on the card keeps what was typed for it', () => {
  const r = runNow();
  assert.deepEqual([r.game, r.platform, r.year, r.category, r.estimate], ['Mega Man 2', 'NES', '1988', 'Any%', '30:00']);
  assert.equal(r.twitchCategoryId, '4455', 'the category it follows was not noted');
});

channel('490100', 'Celeste', true);
test('a category changed while the server was away is caught on the next connect', () => {
  assert.equal(runNow().game, 'Celeste');
});

engine.store.setRun({ game: 'Typed by hand' });
test('a save that does not mention the category keeps what the card last saw', () => {
  assert.equal(runNow().twitchCategoryId, '490100');
});

test('a deck with set rows packs its buttons and leaves the spare room around them', () => {
  /*
    Columns once divided the width and rows the height, and each button took
    the biggest square its cell allowed; across a wide window that was 110px
    buttons 186px apart. The cells are now squares of one computed size at
    the ordinary gap, measured against the box they are drawn in.
  */
  const grid = fs.readFileSync(new URL('../../web/components/DockActionsGrid.tsx', SCRIPT_URL), 'utf8');
  assert.ok(grid.includes("containerType: 'size'"), 'the grid has no box to measure its size against');
  assert.ok(/min\(\(100cqw - .*\/ \$\{columns\}, \(100cqh - .*\/ \$\{rowCount\}\)/.test(grid),
    'the button size is not the largest that fits every column and every row');
  assert.ok(grid.includes('gridTemplateColumns: `repeat(${columns}, ${side})`') && grid.includes('gridTemplateRows: `repeat(${rowCount}, ${side})`'),
    'the columns and rows are not the same computed size, so they spread apart again');
  assert.ok(!grid.includes('gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`'),
    'the rows divide the height again, which is what spread the buttons out');
});

test('the dock keeps its built-in buttons apart from the ones made from actions', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/DockActionsView.tsx', SCRIPT_URL), 'utf8');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  const builtin = view.indexOf('data-dock-section="builtin"');
  const actions = view.indexOf('data-dock-section="actions"');
  assert.ok(builtin > 0 && actions > builtin, 'the list of what can be added is not split into built-in, then actions');
  assert.ok(view.includes('data-dock-category={category}'), 'built-in buttons are not grouped by what they control');
  const builtins = fs.readFileSync(new URL('../../shared/dock-builtins.js', SCRIPT_URL), 'utf8');
  for (const category of new Set([...builtins.matchAll(/category: '([a-z_]+)'/g)].map((m) => m[1]))) {
    assert.ok(new RegExp(`\\b${category}: \\{ name: '`).test(view), `built-in category "${category}" has no heading`);
  }
  assert.ok(view.includes("data-deck-section={section.id}"), 'what is on the deck is not split the same way');
  for (const key of ['dockBuiltinsHeading', 'dockActionsFromActions']) {
    assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
  }
});

test('a screen a phone can open is sized to what the phone shows, not to 100vh', () => {
  /*
    On Android, 100vh is the height with the browser's bars tucked away, so
    while they show, the last few dozen pixels are under them. The chat dock
    pins its message bar to exactly there and does not scroll, so on a phone
    the bar was simply gone. dvh is the height actually on screen.
  */
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  const dock = app.slice(app.indexOf("if (mode === 'dock') { return ("));
  // Upright a column, sideways a row (the tabs at the side), and either way the height on screen.
  assert.ok(/flex \$\{dockSideways \? 'flex-row gap-2' : 'flex-col'\} h-dvh/.test(dock.slice(0, 2000)), 'the chat dock is sized to 100vh again');
  const grid = app.slice(app.indexOf("if (mode === 'dock-actions')"));
  // Scrolling upright, filling the screen exactly sideways — the height on screen either way.
  assert.ok(grid.slice(0, 2500).includes("className={`h-dvh bg-[#0a0a0a] font-sans ${dockSideways ? 'overflow-hidden p-2' : 'overflow-auto p-3'}`}"), 'the button grid is sized to 100vh again');
  for (const file of ['views/ChatDockView.tsx', 'views/EventsDockView.tsx']) {
    const src = fs.readFileSync(new URL(`../../web/components/${file}`, SCRIPT_URL), 'utf8');
    assert.ok(!src.includes('100vh'), `${file} is sized to 100vh`);
  }
  assert.ok(!/h-\[calc\(100vh-4rem\)\]/.test(app), 'the dashboard page is sized to 100vh on phones');
});

test('the Overlay menu comes after Logic and offers every plan and run card step', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/ActionsView.tsx', SCRIPT_URL), 'utf8');
  const types = fs.readFileSync(new URL('../../web/types.ts', SCRIPT_URL), 'utf8');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  const steps = fs.readFileSync(new URL('../engine/steps.js', SCRIPT_URL), 'utf8');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');

  const logic = view.indexOf('id="logic"');
  const overlay = view.indexOf('id="overlay"');
  assert.ok(logic > 0 && overlay > logic, 'the Overlay menu is not after Logic');

  const twitchMenu = view.slice(view.indexOf('id="twitch"'), view.indexOf('id="audio"'));
  assert.ok(!twitchMenu.includes("'omnibar_set'"), 'the omnibar slot is still offered under Twitch');
  const overlayMenu = view.slice(overlay, view.indexOf('/>', overlay));
  assert.ok(overlayMenu.includes("'omnibar_set'") && overlayMenu.includes('OVERLAY_STEPS.map'),
    'the Overlay menu does not hold the omnibar, plan and run card steps');

  const listed = [...view.matchAll(/type: '((?:run|plan|text_layer|goal)_[a-z_]+)', key: '([A-Za-z]+)'.*kind: '([a-z-]+)'/g)];
  assert.ok(listed.length >= 14, `only ${listed.length} overlay steps are listed`);
  for (const [, type, key, kind] of listed) {
    assert.ok(types.includes(`'${type}'`), `${type} is not an ActionStepType`);
    assert.ok(steps.includes(`case '${type}'`), `${type} is offered but the server does not run it`);
    // A step with no editor has nothing it could show and not save.
    if (kind !== 'plan-move') assert.ok(app.includes(`${type}: {`), `${type} starts with nothing saved, whatever its editor shows`);
    assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
  }
  for (const key of [...new Set([...view.matchAll(/t[.]((?:runStep|runClear|planStep|planWhere|textLayer|goalStep|overlaySteps|omnibarStepMenu)[A-Za-z]*)/g)].map((m) => m[1]))]) {
    assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
  }
});

// ------------------------------------------------- more than one omnibar

const barsSaved = engine.store.setOmnibars([
  { id: 'bar-chatting', name: '  Just chatting  ', enabled: true, items: [
    { id: 'slot-chatting', type: 'text', label: 'Say hi', text: '' },
    // Collides with a slot on Main, so it must be renamed rather than shadow it.
    { id: 'slot-shout', type: 'text', label: 'Copied', text: '' },
    { id: 'x', type: 'no-such-slot' },
  ] },
  { id: 'main', name: 'Pretending to be Main', items: [] },
  { id: 'bar-chatting', name: 'Same id again', items: [] },
  ...Array.from({ length: 12 }, (_, n) => ({ name: `Extra ${n}`, items: [] })),
]);

test('other omnibars are checked like Main, and each keeps an id and a name', () => {
  assert.ok(barsSaved.length <= 8, `${barsSaved.length} bars were kept`);
  assert.equal(barsSaved[0].id, 'bar-chatting');
  assert.equal(barsSaved[0].name, 'Just chatting', 'the name was not tidied');
  assert.ok(barsSaved[0].items.every((i) => i.type !== 'no-such-slot'), 'a slot of an unknown type was kept');
  const ids = barsSaved.map((b) => b.id);
  assert.ok(!ids.includes('main'), 'a bar took the id Main answers to');
  assert.equal(new Set(ids).size, ids.length, 'two bars share an id');
});

test('a slot id is never shared between bars, so a step always knows which it means', () => {
  const copied = barsSaved[0].items.find((i) => i.label === 'Copied');
  assert.ok(copied && copied.id !== 'slot-shout', 'a bar kept a slot id Main already uses');
});

runCommand('hi', [{ type: 'omnibar_set', config: { slotId: 'slot-chatting', text: '{user} says {input}' } }]);
chat('!hi hello there', mod);
chat('!bar still on Main', mod);
await settle();
test('an omnibar step writes into a slot on whichever bar holds it', () => {
  const bars = engine.snapshot().omnibars;
  assert.equal(bars[0].items.find((i) => i.id === 'slot-chatting').text, 'Modzilla says hello there');
  assert.equal(engine.store.getOmnibar().items.find((i) => i.id === 'slot-shout').text, 'Modzilla: still on Main',
    'a step for a slot on Main stopped reaching it');
});

test('a layer picks its bar, and one whose bar is gone shows Main', () => {
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes('layer.config?.bar && (system.data.omnibars || []).find((b: any) => b.id === layer.config.bar)) || system.data.omnibar'),
    'the omnibar layer does not follow its bar, or has nothing to fall back to');
  const editor = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(editor.includes("layer.type === 'omnibar' && (() =>") && editor.includes('bar: next }'),
    'an omnibar layer cannot be told which bar to show');
  // A bar is clipped to its layer, so a taller one grows it, bottom edge kept.
  assert.ok(editor.includes('const grow = wants > has ? { height: wants, y: Math.max(0,'),
    'choosing a taller bar leaves the layer too short, and cuts the bar off');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(app.includes("const wantedBar = searchParams.get('bar');"), 'the standalone bar ignores ?bar=');
});

test('duplicating a bar gives its slots new ids, and every string it uses exists in both languages', () => {
  const picker = fs.readFileSync(new URL('../../web/components/OmnibarBarPicker.tsx', SCRIPT_URL), 'utf8');
  assert.ok(picker.includes('items: (source.items || []).map((item) => ({ ...item, id: newSlotId() }))'),
    'a duplicated bar keeps its slot ids, so a step could not tell the copies apart');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  const editor = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const wanted = [...new Set([...`${picker}${editor}`.matchAll(/t[.]((?:omnibarBar|layerOmnibar)[A-Za-z]+)/g)].map((m) => m[1]))];
  assert.ok(wanted.length >= 10, `only ${wanted.length} strings found`);
  for (const key of wanted) assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
});

// ------------------------------------------------------------ the tall bar

const tallSaved = engine.store.setOmnibars([
  { id: 'bar-tall', name: 'Marathon', kind: 'tall', enabled: true, items: [
    { id: 'slot-tall-msg', type: 'text', label: 'Milestone!', sublabel: 'Donate now! '.repeat(10), text: 'Kirby', detail: 'Upgrade to No Dupes' },
  ] },
  { id: 'bar-odd', name: 'Odd', kind: 'sideways', items: [] },
]);

test('a bar can be the tall kind, and anything else is the omnibar', () => {
  assert.equal(tallSaved[0].kind, 'tall');
  assert.equal(tallSaved[1].kind, 'classic', 'an unknown kind was kept, and would draw as nothing');
  assert.ok(!('kind' in engine.store.getOmnibar()), 'Main was given a kind; it is always the omnibar');
});

test('a slot keeps the tall bar’s two extra lines, bounded', () => {
  const slot = tallSaved[0].items[0];
  assert.equal(slot.detail, 'Upgrade to No Dupes');
  assert.ok(slot.sublabel.startsWith('Donate now!') && slot.sublabel.length <= 40, `sublabel kept as ${slot.sublabel.length} characters`);
});

test('the tall bar is its own component, and the omnibar does not know it exists', () => {
  const tall = fs.readFileSync(new URL('../../web/components/TallOmnibar.tsx', SCRIPT_URL), 'utf8');
  const omnibar = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!/tall/i.test(omnibar), 'the omnibar mentions the tall bar, so a change to one reaches the other');
  // Its own part names, so a theme written for one never lands on the other.
  for (const part of ['bar', 'context', 'label', 'sub', 'card', 'title', 'figure', 'detail', 'chip', 'pinned']) {
    assert.ok(tall.includes(`data-tallbar="${part}"`), `the tall bar has no "${part}" part for a stylesheet to name`);
  }
  assert.ok(!tall.includes('data-omnibar='), 'the tall bar wears the omnibar’s part names, so its themes would apply');
});

test('every place a bar is drawn draws a tall one as tall', () => {
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  const view = fs.readFileSync(new URL('../../web/components/views/OmnibarView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes("bar?.kind === 'tall' ? TallOmnibar : Omnibar"), 'a layer draws a tall bar as the omnibar');
  assert.ok(app.includes("(omni as any)?.kind === 'tall' ? TallOmnibar : Omnibar"), 'the standalone source draws a tall bar as the omnibar');
  assert.ok(view.includes("cfg.kind === 'tall' ? TallOmnibar : Omnibar"), 'the editor previews a tall bar as the omnibar');
  assert.ok(view.includes("cfg.kind === 'tall' && ("), 'the tall-only fields are offered on every bar');
});

test('a new tall bar starts tall enough for two rows, and says what it is', () => {
  const picker = fs.readFileSync(new URL('../../web/components/OmnibarBarPicker.tsx', SCRIPT_URL), 'utf8');
  assert.ok(picker.includes("create('tall')") && picker.includes('height: 100'), 'a tall bar starts at the omnibar’s height');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  const files = ['OmnibarBarPicker.tsx', 'TallOmnibar.tsx', 'views/OmnibarView.tsx']
    .map((f) => fs.readFileSync(new URL(`../../web/components/${f}`, SCRIPT_URL), 'utf8')).join('');
  const wanted = [...new Set([...files.matchAll(/t[.](tallbar[A-Za-z]+)/g)].map((m) => m[1]))];
  assert.ok(wanted.length >= 8, `only ${wanted.length} tall bar strings found`);
  for (const key of wanted) assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
});

// ------------------------------------------------ a goal on either bar

const goalMain = engine.store.setOmnibar({ ...engine.store.getOmnibar(), items: [
  ...engine.store.getOmnibar().items,
  { id: 'slot-goal', type: 'goal', text: 'Upgrade to No Dupes', goalSource: 'manual', goalTarget: 100000, goalValue: 90393, goalShow: 'percent', goalPrefix: '$$$$$$' },
  { id: 'slot-goal-odd', type: 'goal', goalSource: 'nonsense', goalTarget: -5, goalValue: 'lots', goalShow: 'sideways' },
] });

test('a goal slot is kept on a bar, with its settings checked like a goal layer’s', () => {
  const g = goalMain.items.find((i) => i.id === 'slot-goal');
  assert.ok(g, 'a goal slot was dropped as an unknown type');
  assert.deepEqual([g.goalSource, g.goalTarget, g.goalValue, g.goalShow], ['manual', 100000, 90393, 'percent']);
  assert.equal(g.goalPrefix, '$$$$', 'the prefix was not bounded');
  const odd = goalMain.items.find((i) => i.id === 'slot-goal-odd');
  assert.equal(odd.goalSource, 'followers', 'a source nothing counts was kept');
  assert.ok(odd.goalTarget >= 1, 'a target below one was kept, which is a bar always full');
  assert.equal(odd.goalShow, 'remaining');
});

test('both kinds of bar draw a goal, from the one count the goal layer uses', () => {
  const goalBar = fs.readFileSync(new URL('../../web/components/GoalBar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(goalBar.includes('export function goalProgress(') && goalBar.includes('const { known, value } = goalValue(source, config.manualValue, stats);'),
    'the goal layer and the goal slots count in different places, so they can disagree');
  const classic = fs.readFileSync(new URL('../../web/components/Omnibar.tsx', SCRIPT_URL), 'utf8');
  const tall = fs.readFileSync(new URL('../../web/components/TallOmnibar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(classic.includes("case 'goal': {") && classic.includes('goalProgress(item, stats)'), 'the omnibar cannot draw a goal');
  assert.ok(tall.includes("case 'goal': {") && tall.includes('goalProgress(item, stats)'), 'the tall bar cannot draw a goal');
  assert.ok(tall.includes('data-tallbar="goal-track"') && tall.includes('data-tallbar="goal-marker"'), 'the tall bar’s goal has no bar to show it');
});

test('every place a bar is drawn hands it the counts a goal follows', () => {
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  const view = fs.readFileSync(new URL('../../web/components/views/OmnibarView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes('config={bar}\n') || stage.includes('config={bar}\r\n'), 'the canvas bar changed shape');
  assert.ok(stage.includes('stats={system.data.stats}'), 'the canvas bar has no counts, so a goal on it never shows');
  assert.ok(app.includes('stats: (system.data as any).stats,') && app.includes('stats={(system.data as any).stats}'),
    'the standalone bar or the editor has no counts');
  assert.ok(view.includes("{ type: 'goal', label: 'omnibarTypeGoal'") && view.includes('data-goal-fields'), 'the Omnibar screen offers no goal slot');
  assert.ok(view.includes('{ config: previewCfg, stats,'), 'the editor’s preview has no counts, so its goal never shows');
});

test('every string the goal slot uses exists in both languages', () => {
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  const files = ['Omnibar.tsx', 'TallOmnibar.tsx', 'views/OmnibarView.tsx']
    .map((f) => fs.readFileSync(new URL(`../../web/components/${f}`, SCRIPT_URL), 'utf8')).join('');
  const wanted = [...new Set([...files.matchAll(/t[.](omnibar(?:Goal|TypeGoal)[A-Za-z]*)/g)].map((m) => m[1]))];
  assert.ok(wanted.length >= 12, `only ${wanted.length} goal strings found`);
  for (const key of wanted) assert.equal(strings.split(key + ':').length - 1, 2, `${key} is not declared in both languages`);
});

// A mod moves a goal from chat.
engine.store.setOmnibars([{ id: 'bar-goals', name: 'Goals', kind: 'tall', enabled: true, items: [
  { id: 'slot-kept', type: 'goal', text: 'Charity', goalSource: 'manual', goalTarget: 1000, goalValue: 0 },
  { id: 'slot-follows', type: 'goal', goalSource: 'followers', goalTarget: 200 },
] }]);
runCommand('goal', [
  { type: 'goal_change', config: { slotId: 'slot-kept', value: '{input}' } },
  { type: 'twitch_chat', config: { message: 'Goal: {goal.value} / {goal.target} ({goal.left} left, {goal.percent}%)' } },
]);
runCommand('goaladd', [{ type: 'goal_change', config: { slotId: 'slot-kept', goalMode: 'add', value: '{input}' } }]);
runCommand('goalfollow', [{ type: 'goal_change', config: { slotId: 'slot-follows', value: '{input}' } }]);
const kept = () => engine.snapshot().omnibars[0].items.find((i) => i.id === 'slot-kept').goalValue;
const followsGoal = () => engine.snapshot().omnibars[0].items.find((i) => i.id === 'slot-follows').goalValue;

said.length = 0;
chat('!goal 500', mod);
await settle();
test('a mod can set a goal’s number, and chat is told where it got to', () => {
  assert.equal(kept(), 500);
  assert.ok(said.some((l) => l.includes('Goal: 500 / 1000 (500 left, 50%)')), `chat said ${JSON.stringify(said)}`);
});

chat('!goal +50', mod); await settle();
const afterPlus = kept();
chat('!goal -$20', mod); await settle();
const afterMinus = kept();
chat('!goal $1,200', mod); await settle();
const afterMoney = kept();
chat('!goal −3,000', mod); await settle();
const afterFloor = kept();
test('a plus adds, a minus takes away, and money is read as a number', () => {
  assert.equal(afterPlus, 550);
  assert.equal(afterMinus, 530);
  assert.equal(afterMoney, 1200, 'a figure with a $ and a comma was not read');
  assert.equal(afterFloor, 0, 'a goal went below zero, or a typographic minus was not read as one');
});

chat('!goal lots', mod);
chat('!goal 999', { user: 'RandomViewer' });
chat('!goaladd 7', mod);
await settle();
test('words with no number change nothing, a viewer cannot, and an add step adds', () => {
  assert.equal(kept(), 7, 'the goal did not end on 0 + 7');
});

chat('!goalfollow 5000', mod);
await settle();
test('a goal counting followers is left to the count, whatever a mod types', () => {
  assert.equal(followsGoal(), 0);
});

engine.store.setOmnibar({ ...goalMain, items: goalMain.items.filter((i) => !i.id.startsWith('slot-goal')) });
engine.store.setOmnibars([]);

