/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The question queue, the stream plan, reward names, screen chrome, stopping a connect — and the checklist, which is gone.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';
import { EXCLUDED, LAYER_TYPES, MANIFEST, normaliseLayouts } from './backup-and-layouts.js';

// --------------------------------------------------------- the question queue

test('nothing reaches the screen without being approved', () => {
  /*
    The entire point of a queue. An unmoderated question box on a stream is a
    dare, so the refusal lives on the server rather than in whichever screen
    happens to be asking.
  */
  engine.store.clearQuestions();
  engine.store.addQuestion({ user: 'Someone', platform: 'twitch', text: 'a question' });
  const [q] = engine.store.clearQuestions('handled').items;

  assert.equal(engine.store.showQuestion(q.id).showingId, '', 'a waiting question went on screen');
  engine.store.setQuestionStatus(q.id, 'approved');
  assert.equal(engine.store.showQuestion(q.id).showingId, q.id, 'an approved question would not go up');
});

test('taking a question out of the approved pile takes it off screen', () => {
  // Otherwise the overlay keeps showing something that has been turned down.
  engine.store.clearQuestions();
  engine.store.addQuestion({ user: 'Someone', text: 'another' });
  const q = engine.store.clearQuestions('handled').items[0];
  engine.store.setQuestionStatus(q.id, 'approved');
  engine.store.showQuestion(q.id);
  assert.equal(engine.store.setQuestionStatus(q.id, 'done').showingId, '');
});

test('a full queue forgets a waiting question, never an approved one', () => {
  /*
    Approving is work somebody did; a question nobody has looked at yet is not.
    Refusing new ones instead would break the queue during the one segment it
    exists for, and silently.
  */
  engine.store.clearQuestions();
  engine.store.addQuestion({ user: 'Early', text: 'approved and old' });
  const keep = engine.store.clearQuestions('handled').items[0];
  engine.store.setQuestionStatus(keep.id, 'approved');
  for (let i = 0; i < 260; i += 1) engine.store.addQuestion({ user: 'Flood', text: `spam ${i}` });

  const items = engine.store.clearQuestions('handled').items;
  assert.ok(items.length <= 200, String(items.length));
  assert.ok(items.some((q) => q.id === keep.id), 'the approved question was dropped');
});

test('asking is a step, so a command decides who may ask and how often', () => {
  /*
    A trigger word of its own would have meant a question box with no cooldown,
    which is a queue one person can fill by themselves. As a step it hangs off
    an ordinary command and inherits what commands already have.
  */
  const steps = fs.readFileSync(new URL('../engine/steps.js', SCRIPT_URL), 'utf8');
  assert.ok(/case 'question_add'/.test(steps), 'the step is gone');
  assert.ok(/questions\?\.add/.test(steps), 'it no longer reaches the queue');
  // ctx.user is the whole chatter, not a name — this read "[object Object]".
  assert.ok(/ctx\.user\?\.name/.test(steps), 'the asker is stored as an object again');
});

test('questions do not travel in a config backup', () => {
  // What viewers typed during one segment, stale the moment it ends.
  assert.ok(EXCLUDED.includes('questions'), 'questions are exported as configuration');
});

// ------------------------------------------------------------ the stream plan

test('moving the mark marks everything before it done', () => {
  /*
    Moving on always means the last thing finished, so the two are one press
    rather than two — two would only be two chances to forget one mid-stream.
  */
  engine.store.setPlan({ items: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }, { id: 'c', text: 'Three' }] });
  const out = engine.store.planGoto('c');
  assert.equal(out.currentId, 'c');
  assert.deepEqual(out.items.map((i) => i.done), [true, true, false]);
});

test('and going back un-marks what came after', () => {
  // A mis-press mid-stream should cost one press to undo, not a rebuild.
  engine.store.setPlan({ items: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }, { id: 'c', text: 'Three' }] });
  engine.store.planGoto('c');
  const out = engine.store.planGoto('a');
  assert.equal(out.currentId, 'a');
  assert.deepEqual(out.items.map((i) => i.done), [false, false, false]);
});

test('a mark on something no longer in the plan is dropped', () => {
  // Otherwise the overlay highlights a row that is not there, which reads as
  // nothing being current at all.
  const out = engine.store.setPlan({
    items: [{ id: 'a', text: 'One' }],
    currentId: 'deleted-yesterday',
  });
  assert.equal(out.currentId, '');
});

test('the plan overlay starts where the stream is, not at the top', () => {
  /*
    Three things in, the top of the list is history and the part worth screen
    space has scrolled past it.
  */
  const src = fs.readFileSync(new URL('../../web/components/PlanOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/const start = at >= 0 \? at : 0;/.test(src), 'the list no longer starts at the current item');
  assert.ok(/if \(!all\.length\) return null;/.test(src), 'an empty plan now draws something');
});

test('a plan keeps the line it just finished, and only that one', () => {
  /*
    Read out of the component so the rule is checked where it is written. A
    stream three things in has two finished lines behind it and the useful one
    is the nearest — the other is a stream that ended an hour ago.
  */
  const src = fs.readFileSync(new URL('../../web/components/PlanOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('for (let i = start - 1; i >= 0; i -= 1) if (all[i].done) { back = i; break; }'),
    'the plan no longer looks back for the line it just finished');
  assert.ok(src.includes('const ahead = all.slice(start, start + (back >= 0 ? cap - 1 : cap));'),
    'the crossed-off line stopped counting against the cap, so the box can outgrow it');
  assert.ok(src.includes("if (mode === 'recap' && cap > 1 && plan?.showDone !== false)"),
    'the crossed-off line ignores the cap of one, or the switch that turns finished lines off');
});

test('the plan still offers the way it worked before', () => {
  /*
    The default changed, so the old behaviour has to be something somebody can
    pick — and until now no screen could pick any of them.
  */
  const panel = fs.readFileSync(new URL('../../web/components/PlanLayerPanel.tsx', SCRIPT_URL), 'utf8');
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  for (const mode of ['recap', 'upcoming', 'all', 'current']) {
    assert.ok(panel.includes(`value: '${mode}'`), `the editor cannot choose "${mode}"`);
    const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'plan', config: { mode } }] }]);
    assert.equal(l.layers[0].config.mode, mode, `the server refuses "${mode}"`);
  }
  assert.ok(view.includes('<PlanLayerPanel' + String.fromCharCode(10)), 'the panel is not rendered, so nothing can be chosen');
  assert.ok(view.includes("import { PlanLayerPanel }"), 'the editor does not import the panel');
});

const inTheNoteText = (src) => {
  const at = src.indexOf('data-plan="note"');
  return src.slice(at, src.indexOf('</span>', at));
};

test('a plan too tall for its box loses the bottom of it, not the top', () => {
  /*
    Centred, a full plan overflowed in both directions at once, and the half
    that went off the top was the half worth keeping: the title and the line
    that is happening now. "safe" centres it while it fits and starts it at
    the top when it does not, so what falls away is the part still to come.

    Measured at 460 by 230: two items and three stayed centred, with equal gaps
    above and below; eight sat twelve pixels from the top — the padding — and
    ran 293 pixels off the bottom.
  */
  const src = fs.readFileSync(new URL('../../web/components/PlanOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes("justifyContent: 'safe center'"),
    'the plan centres itself even when it does not fit, which throws away the top');

  /*
    And nothing in it is squeezed to nothing on the way. truncate brings
    overflow: hidden, which takes away a flex item's automatic minimum size —
    so in a full box the title was still there, still first, still inside the
    box, and nought pixels tall. It measured height 0 while every number said
    it was fine, and only the picture showed it missing.
  */
  const title = src.slice(src.indexOf('data-plan="title"') - 200, src.indexOf('data-plan="title"'));
  assert.ok(title.includes('shrink-0'),
    'the plan title can be squeezed to nothing again by a plan that overflows');
  const item = src.slice(src.indexOf('data-plan="item"') - 200, src.indexOf('data-plan="item"'));
  assert.ok(item.includes('shrink-0'), 'the lines can be squeezed by a plan that overflows');
});

test('a plan note can be shown, and does not cost the line it annotates', () => {
  /*
    The note used to live inside the words it annotates, which meant it
    shared their truncation and their strike-through: a long note ate the
    name of the thing it was a note about, and on a finished line the note
    read as having been crossed off itself.
  */
  const src = fs.readFileSync(new URL('../../web/components/PlanOverlay.tsx', SCRIPT_URL), 'utf8');
  const text = src.indexOf('{withDiscordText(item.text)}');
  const closes = src.indexOf('</span>', text);
  const noteAt = src.indexOf('data-plan="note"');
  assert.ok(text > 0 && closes > text && noteAt > closes,
    'the note is back inside the words, so it shares their truncation');

  /*
    Beside the line, it takes what is left rather than taking from the title:
    a hair of shrinking costs a whole glyph in the fixed-width faces these
    use. Under it, it has the whole row and no longer competes at all, which
    is the point of putting it there.
  */
  assert.ok(src.includes("className={ownLine ? 'basis-full min-w-0' : 'truncate basis-0 grow'} data-plan=\"note\""),
    'the note can make the title give up room again, or has lost its own line');
  assert.ok(src.includes("const ownLine = config.notesOwnLine === true;"),
    'nothing decides which of the two the note gets');

  /*
    The dash stays when the note moves. Beside the line it reads as an aside;
    under it, it is the thing that says this is a note about the line above
    rather than a line of the plan in its own right — so it matters more
    there, not less.
  */
  assert.ok(inTheNoteText(src).includes('— {item.note}'),
    'the note lost its dash, so on its own line it reads as another item');

  /*
    Read out of the note itself. The line it sits on carries the same rule,
    so a check against the whole file passes on the title alone and says
    nothing at all about the note.
  */
  const inTheNote = src.slice(noteAt, src.indexOf('</span>', noteAt));
  assert.ok(inTheNote.includes('color: item.done ? doneColor : text,'),
    'the note no longer follows the line it belongs to');
  assert.ok(!inTheNote.includes('color: doneColor,'),
    'the note is drawn in the colour for finished things again, whatever line it is on');

  const panel = fs.readFileSync(new URL('../../web/components/PlanLayerPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes('patch({ showNotes: !config.showNotes })'),
    'nothing can switch the notes on, so they are written and never drawn');
  assert.ok(panel.includes('patch({ notesOwnLine: !config.notesOwnLine })'),
    'nothing can move a note onto its own line');

  /* And the store keeps it, or the switch turns something nothing reads. */
  const [kept] = normaliseLayouts([{ id: 'p', layers: [{ type: 'plan', config: { notesOwnLine: true } }] }]);
  assert.equal(kept.layers[0].config.notesOwnLine, true);
  assert.equal(normaliseLayouts([{ id: 'q', layers: [{ type: 'plan' }] }])[0].layers[0].config.notesOwnLine, false);
});

test('a plan layer that never chose a mode is moved to the new default once', () => {
  /*
    Every save writes a mode, so a layer made before there was a screen to
    pick one on holds the default of its day as though it had been asked for.
    Changing the default could therefore never reach a plan that already
    existed. This moves those, once, and records that it happened — from here
    "upcoming" is an answer somebody gave, and answers are left alone.
  */
  const src = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  const at = src.indexOf('doneAlready');
  assert.ok(at > 0, 'the one-time move is gone');
  const move = src.slice(at, src.indexOf('profiles.initProfiles'));
  assert.ok(move.includes('db.upgrades.get()') && move.includes('db.upgrades.set('),
    'nothing records that the move ran, so it would run again over a chosen value');
  assert.ok(move.includes("mode !== " + "'upcoming'"),
    'the move no longer leaves every other answer alone');
  assert.ok(move.includes("mode: " + "'recap'"),
    'the move no longer lands on the new default');
  assert.ok(src.indexOf('doneAlready') < src.indexOf('profiles.initProfiles'),
    'the move runs after the profiles have already rewritten the collections');

  /* And it travels, so a restore elsewhere does not redo it. */
  assert.ok(MANIFEST.some((e) => e.name === 'upgrades'),
    'the record of what has been done is left out of a backup');
});

test('the plan line being replaced is given time to leave', () => {
  /*
    Crossing something off swaps one crossed-out line for another, and a swap
    with no motion reads as the list having been rewritten rather than having
    moved on by one.
  */
  const src = fs.readFileSync(new URL('../../web/components/PlanOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('data-plan-leaving={isLeaving'),
    'the line on its way out is not named, so no stylesheet can reach it');
  assert.ok(src.includes('onAnimationEnd={isLeaving ? () => setLeavingId(null) : undefined}'),
    'the line never clears when its animation ends, so a longer exit would be cut off');
  assert.ok(src.includes('setTimeout(() => setLeavingId(null)'),
    'nothing removes the line if its animation never runs, so it would stay for good');
  assert.ok(src.includes('item.id !== leaving?.id'),
    'the line on its way out can be drawn as the current one');

  const sheet = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  assert.ok(sheet.includes('@keyframes plan-line-leaving'), 'the exit has no animation of its own');
  assert.ok(sheet.includes('[data-plan-leaving]'),
    'nothing applies the exit animation');

  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes('data-plan-leaving'), 'the editor does not offer the line on its way out');
});

test('the plan is a layer the canvas can hold, and travels in a backup', () => {
  assert.ok(LAYER_TYPES.includes('plan'), 'the server would drop the layer on save');
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'plan', config: { mode: 'nonsense', limit: 999 } }] }]);
  assert.equal(l.layers[0].config.mode, 'recap');
  assert.ok(l.layers[0].config.limit <= 12, String(l.layers[0].config.limit));
  // Viewers see it, so losing it on a move to another machine would show.
  assert.ok(MANIFEST.some((e) => e.name === 'plan'), 'the plan is left out of a backup');
});

// ------------------------------------------------------------- the checklist

test('the checklist is gone: no screen, no messages, nothing kept or backed up', () => {
  /*
    Taken out on 2026-09-28: it was only ever opened to see that it worked.
    Nothing else read it, so it goes whole rather than being left half-wired —
    a message nothing answers, or a store nothing shows, is how a removed
    feature comes back as a bug.
  */
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!/checklist/i.test(app), 'the checklist is still on a screen or in the menu');
  assert.ok(!fs.existsSync(new URL('../../web/components/views/ChecklistView.tsx', SCRIPT_URL)), 'its screen is still there');
  const protocol = fs.readFileSync(new URL('../../shared/protocol.js', SCRIPT_URL), 'utf8');
  assert.ok(!/CHECKLIST|CHECK_ITEM/.test(protocol), 'the socket still carries it');
  const engineSrc = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  assert.ok(!/checklist/i.test(engineSrc), 'the server still keeps or resets it');
  assert.equal(typeof engine.store.setChecklist, 'undefined');
  assert.ok(!MANIFEST.some((e) => e.name === 'checklist'), 'a backup still carries it');
  assert.ok(!/checklist/i.test(fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8')));
});

// ---------------------------------------------------------- the reward names

test('the channel rewards are kept, not re-fetched by whoever needs them', () => {
  /*
    The alert editor was the only thing that ever asked Twitch for them, and it
    threw the answer away on reload — so a redemption alert filtered to a
    reward showed an id where its name belonged until somebody pressed
    Refresh, even though the id in the alert was perfectly good.
  */
  const src = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  assert.ok(/collection\('twitch_rewards'/.test(src), 'the names are not kept anywhere');
  assert.ok(/rewards: db\.rewards\.get\(\)/.test(src), 'they never reach a page that loads');
  assert.ok(/EVENTS\.CONFIG, \{ key: 'rewards'/.test(src), 'they never reach a page already open');

  const twitch = fs.readFileSync(new URL('../platforms/twitch.js', SCRIPT_URL), 'utf8');
  assert.ok(/bus\.emit\(EVENTS\.REWARD_LIST, rewards\)/.test(twitch), 'a fetch no longer publishes what it found');
  assert.ok(/fetchRewards\(\)\.catch/.test(twitch), 'nothing fetches them on connect');
});

test('an empty reward list does not erase the names already known', () => {
  /*
    An empty answer is almost always a failed or unauthorised fetch rather than
    a channel with no rewards. Replacing good names with none would put the
    editor back to showing an id, which is the thing being fixed.
  */
  const src = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  const listener = src.slice(src.indexOf('EVENTS.REWARD_LIST'), src.indexOf('EVENTS.REWARD_LIST') + 1200);
  assert.ok(/if \(!clean\.length\) return;/.test(listener), 'an empty fetch now wipes the cache');
});

// ------------------------------------------------------------- screen chrome

test('no screen prints its own name in a heading', () => {
  /*
    The sidebar says which screen you are on and the breadcrumb repeats it, so
    a third copy set in 3xl was costing about 200px of height on every page —
    and on the overlay editor that height belongs to the canvas.

    Easy to reintroduce one view at a time, which is why this counts them all.
  */
  const dir = new URL('../../web/components/views/', SCRIPT_URL);
  const offenders = fs.readdirSync(dir)
// The panel is excluded on purpose: it holds the list being checked, so
// scanning it would let every selector prove its own existence.
  .filter((f) => f.endsWith('.tsx') && f !== 'LayerCssPanel.tsx')
    .filter((f) => /<h[12][^>]*text-3xl/.test(fs.readFileSync(new URL(f, dir), 'utf8')));
  assert.deepEqual(offenders, [], `page titles are back in: ${offenders.join(', ')}`);
});

test('the top bar is for phones, where it is the only way out', () => {
  /*
    It holds the menu button and the name of the screen. On a desktop the
    sidebar is already open beside you with that screen lit up, so the bar was
    64px repeating it. On a phone the sidebar is hidden behind that button, so
    hiding the bar everywhere would leave no way to change screens at all —
    which is what this is really guarding.
  */
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  const bar = app.slice(app.indexOf('sticky top-0 z-40 h-16') - 120, app.indexOf('sticky top-0 z-40 h-16') + 60);
  assert.ok(/md:hidden/.test(bar), 'the bar is back on desktop, costing 64px on every screen');
  assert.ok(/aria-label="Open Menu"/.test(app), 'the phone has no way to open the menu');
  // And the page below it reclaims that height only where the bar is gone.
  assert.ok(/h-\[calc\(100dvh-4rem\)\] md:h-dvh/.test(app),
    'the page still reserves room for a bar that is no longer there');
});

test('the overlay editor is not squeezed by the reading width', () => {
  /*
    max-w-7xl keeps a form readable and cost the canvas 23% of the window. It
    stays everywhere else; this checks the editor is the exception and that the
    canvas cannot outgrow a short screen as a result.
  */
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/view === 'layouts' \? '' : 'max-w-7xl'/.test(app),
    'the overlay editor is capped to the reading width again');
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  // The exact margin moves whenever the chrome above the canvas does; what
  // must not disappear is a cap derived from the window's own height.
  assert.ok(/maxWidth: `calc\(\(100vh - \d+rem\)/.test(view),
    'nothing stops the canvas growing taller than the window');
});

// ------------------------------------------------------- stopping a connect

test('stopping OBS stops the attempt in flight, not just the next one', () => {
  /*
    disconnect() clears the retry timer but cannot cancel a connect that is
    already running, and one that is timing out rather than being refused hangs
    for a long time. Its failure path then scheduled a fresh retry, so pressing
    stop on an unreachable address put the status back to "connecting" a moment
    later and there was no way out of it.

    Every retry asks `wanted` first, and a failure that arrives after someone
    stopped no longer sets an error over the disconnected status they asked
    for.
  */
  const src = fs.readFileSync(new URL('../platforms/obs.js', SCRIPT_URL), 'utf8');
  assert.ok(/let wanted = false;/.test(src), 'the intent flag is gone');
  assert.ok(/function scheduleReconnect\(\)[\s\S]{0,200}if \(!wanted\) return;/.test(src),
    'a retry no longer checks whether anyone still wants one');
  assert.ok(/export async function disconnect\(\)\s*\{\s*wanted = false;/.test(src),
    'stopping no longer clears the intent');
  assert.ok(/if \(!wanted\) throw err;/.test(src),
    'a failure arriving after a stop would set an error over it again');
});

test('the OBS button stays pressable while it is connecting', () => {
  // The handler already sends a disconnect when the status is "connecting",
  // so disabling the button was the only thing between a stuck connection and
  // being able to stop it.
  const view = fs.readFileSync(new URL('../../web/components/views/ConnectionsView.tsx', SCRIPT_URL), 'utf8');
  const button = view.slice(view.indexOf('handleObsConnect()'), view.indexOf('handleObsConnect()') + 400);
  assert.ok(!/disabled=\{obsStatus === 'connecting'\}/.test(button),
    'the button is disabled while connecting again, which is when it is needed');
});

