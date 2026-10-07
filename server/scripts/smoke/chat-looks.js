/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The chat's own stylesheet, looks for it, and ranks a stylesheet can see.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { CHAT_ROW, SCOPED, SCRIPT_URL, assert, engine, fs, test } from './harness.js';
import { MAX_CHAT_CSS } from './images-and-alerts.js';
import { CHAT_STYLE_KEYS, chatLayer } from './profiles-and-chat.js';
import { ALL_PRESETS, componentsDraw } from './stylesheets.js';
import { presetApplies, presetKind } from './looks.js';
import { LIBRARY } from './alert-looks.js';

const APPLY = await import('../../../shared/theme-apply.js');

// ------------------------------------------ a stylesheet for the chat itself

const DOCK_VIEW = fs.readFileSync(new URL('../../web/components/views/ChatDockView.tsx', SCRIPT_URL), 'utf8');
// A chat layer's panel, on the Overlays screen: its look, its stylesheet, and the sections it shares with the dock.
const LAYER_PANEL = fs.readFileSync(new URL('../../web/components/ChatLayerPanel.tsx', SCRIPT_URL), 'utf8');
const PARTS = fs.readFileSync(new URL('../../web/components/ChatSettingParts.tsx', SCRIPT_URL), 'utf8');
// MAX_CHAT_CSS comes in with the other caps at the top of the suite.

test('a chat layer keeps a stylesheet and a motion of its own', () => {
  const out = chatLayer({ fontSize: 16, css: '.look {}', motionCss: '.motion {}' });
  assert.equal(out.css, '.look {}');
  assert.equal(out.motionCss, '.motion {}');
});

test('and a change to anything else leaves them alone', () => {
  /*
    Every control sends one key. If the stylesheet were rebuilt from what the
    change happened to carry, changing the font size would empty the box —
    which is the sort of thing you notice a week later. The panel folds a
    change into the layer's whole set, and the save keeps what it is given.
  */
  const first = chatLayer({ fontSize: 16, css: ':scope { gap: 4px }' });
  const after = chatLayer({ ...first, fontSize: 22 });
  assert.equal(after.css, ':scope { gap: 4px }');
  assert.equal(after.fontSize, 22);
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}'),
    'a change to a chat layer replaces its settings rather than folding into them');
});

test('and both are checked the way every other stylesheet is', () => {
  const closer = '<' + '/StYlE';
  const out = chatLayer({ fontSize: 16, css: `.x{} ${closer}><img src=x>`, motionCss: 'a'.repeat(9999) });
  assert.ok(!out.css.toLowerCase().includes('<' + '/style'), out.css);
  assert.ok(out.motionCss.length <= MAX_CHAT_CSS, String(out.motionCss.length));
});

test('the chat stylesheet reaches the page scoped to the chat', () => {
  /*
    It has to be scoped here more than anywhere: on the dock surface the chat
    shares a document with the whole app, so an unscoped rule would restyle the
    editor somebody is standing in.
  */
  assert.ok(CHAT_ROW.includes('<ScopedStyle css={custom ?'), 'the chat does not hand its stylesheet over');
  const call = CHAT_ROW.slice(CHAT_ROW.indexOf('<ScopedStyle'));
  assert.ok(call.indexOf('settings?.css') < call.indexOf('settings?.motionCss'), call.slice(0, 110));
});

test('every surface that draws chat draws the look chosen for it', () => {
  /*
    Three of them: a chat layer on the canvas, the dock, and the dock's copy
    on its own screen. (The overlay browser source was a fourth; every chat on
    stream is a layer now.)

    The dock used to be left out deliberately — it is a place to read chat from
    rather than something anybody sees. But its look is the custom theme's, and
    the custom theme without its stylesheet is its markup with nothing styling
    it: not a plainer chat, a broken one. So it draws its look too.
  */
  assert.ok(CHAT_ROW.includes('<ChatStyle settings={(rest as any).settings} />'), 'the canvas layer does not');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(app.includes('{<ChatStyle settings={system.settings} />}'), 'the dock does not');
  assert.ok(DOCK_VIEW.includes('{<ChatStyle settings={chat} />}'), 'the dock screen\'s copy does not');
});

test('the dock draws its own Marathon, never the overlay\'s stylesheet', () => {
  /*
    The dock used to draw the overlay's theme and stylesheet, so the desk
    changed look whenever the stream did. It is pinned to its own now, and
    the overlay's values are never spread over it.
  */
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  assert.ok(hook.includes("if (editingDock) Object.assign(surfaceOverrides, { chatTheme: 'custom', css: DOCK_CHAT_CSS, motionCss: '' });"),
    'the dock follows the overlay\'s look again');
});


test('every theme names the same parts', () => {
  /*
    Four themes and an event row, each its own markup. A rule written against
    one that meant nothing in another would break the moment somebody switched
    theme, with nothing on screen to say why.
  */
  const kinds = ['custom', 'compact', 'retro', 'modern', 'event'];
  for (const kind of kinds) {
    assert.ok(CHAT_ROW.includes(`data-chat-kind="${kind}"`), `the ${kind} row is not named`);
  }
  for (const part of ['row', 'user', 'text', 'time', 'avatar', 'marks']) {
    const seen = CHAT_ROW.split(`data-chat="${part}"`).length - 1;
    assert.ok(seen >= 4, `only ${seen} theme(s) name the ${part}`);
  }
});

test('a chat part is an attribute rather than text on the page', () => {
  // The same mistake as everywhere else: a hook after the closing bracket is
  // a text child, and the words go out on stream.
  for (const line of CHAT_ROW.split(String.fromCharCode(10))) {
    if (!line.includes('data-chat=')) continue;
    assert.ok(line.includes('className') || line.includes('<'),
      `this is not inside a tag, so it reaches the page as text: ${line.trim().slice(0, 80)}`);
  }
});

test('the chat\'s stylesheet is on its layer, with the rest of its settings — and not on the dock', () => {
  /*
    Each chat on stream keeps its own look, so the box is on the chat layer's
    panel on the Overlays screen. The dock's look is fixed, so it has none.
    And the layer's own box sits beside it, as on every other layer — the
    chat's look and where the layer sits are two different things.
  */
  assert.ok(LAYER_PANEL.includes('<StylesheetPanel'), 'a chat layer offers no stylesheet');
  assert.ok(LAYER_PANEL.includes("{custom && s.fold('sheet'"), 'a layer offers it where it does nothing');
  assert.ok(LAYER_PANEL.includes('css={v.css}') && LAYER_PANEL.includes('motionCss={v.motionCss}'),
    'the box is not wired to the chat\'s settings');
  assert.ok(LAYER_PANEL.includes('useChatSections({'), 'the chat layer\'s panel is not a chat\'s controls');
  assert.ok(!DOCK_VIEW.includes('<StylesheetPanel'), 'the dock screen offers a stylesheet its fixed look ignores');
  const panel = fs.readFileSync(new URL('../../web/components/LayerCssPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes("STYLED_ELSEWHERE = ['alerts']"), 'a chat layer\'s own box is hidden again — and with it whatever is written there');
});

test('the editor offers exactly the parts the chat draws', () => {
  const from = LAYER_PANEL.indexOf('const CHAT_PARTS');
  const block = LAYER_PANEL.slice(from, LAYER_PANEL.indexOf('];', from));
  const listed = [];
  let at = block.indexOf('[data-');
  while (at >= 0) { listed.push(block.slice(at + 1, block.indexOf(']', at))); at = block.indexOf('[data-', at + 1); }
  assert.ok(listed.length >= 6, `the editor offers only: ${listed.join(', ')}`);
  for (const selector of listed) {
    assert.ok(CHAT_ROW.includes(selector), `the editor offers ${selector}, which no chat row draws`);
  }
});

test('the two keys travel with the rest of the chat style', () => {
  // Otherwise the box would save to the server and never come back, so it
  // would look empty again on the next reload.
  assert.ok(CHAT_STYLE_KEYS.includes('css'), 'the stylesheet does not reach the client');
  assert.ok(CHAT_STYLE_KEYS.includes('motionCss'), 'the motion does not reach the client');
});

test('the chat stylesheet belongs to the custom theme, and only draws there', () => {
  /*
    The other three themes draw markup of their own that is rewritten whenever
    they are touched, so a rule aimed at them breaks on an update for a reason
    nobody can see. And the box is only offered under custom, so applying it
    elsewhere would be styling somebody cannot turn off.
  */
  assert.ok(CHAT_ROW.includes("const custom = settings?.chatTheme === 'custom';"),
    'the stylesheet still draws under every theme');
  // Handed over as nothing rather than not rendered, so the shared stylesheet
  // is still the thing deciding what to do with nothing.
  assert.ok(CHAT_ROW.includes('css={custom ? settings?.css : undefined}'),
    'the chat decides for itself what to render when there is nothing');
});

test('and is offered only where it does something', () => {
  // The same rule the arrangement slots already follow: a control that
  // silently does nothing is worse than one that is absent.
  assert.ok(LAYER_PANEL.includes("const custom = v.chatTheme === 'custom';") && LAYER_PANEL.includes("{custom && s.fold('sheet'"),
    'the box shows under themes that ignore it');
  // The slots are only Custom's, and Retro draws neither the platform icons nor the badges.
  assert.ok(LAYER_PANEL.includes("draws: { marks: v.chatTheme !== 'retro', slots: custom }"), 'the slots no longer follow that rule');
  for (const gate of ['{draws.slots && v.showAvatars && (', '{draws.slots && (v.showPlatformIcons || v.showRankBadges) && (', '{draws.slots ? (', '{draws.marks ? (']) {
    assert.ok(PARTS.includes(gate), `a control is offered under a look that ignores it: ${gate}`);
  }
  // And it says so, rather than leaving somebody to hunt for them.
  assert.ok(PARTS.includes('data-chat-slots-note') && PARTS.includes('data-chat-marks-note'), 'what a look leaves out goes without a word');
});

test('the boxes come before the rest of a chat\'s controls', () => {
  /*
    The look first, since it decides what the sections under it offer; then,
    under Custom, the stylesheet, because somebody writing one is doing the
    thing the look is for — not hunting for it under a column of toggles.
    Hiding old messages, which only the stream does, comes last.
  */
  const order = ['data-chat-layer-share', 'data-chat-look', "s.fold('sheet'", '{s.size}', '{s.shows}', '{s.text}', '{s.box}', '{s.ranks}', '{s.events}', '{s.motion}', "s.fold('old'"];
  const at = order.map((s) => LAYER_PANEL.indexOf(s));
  assert.ok(at.every((n) => n > 0), `a section is missing: ${order[at.indexOf(-1)]}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'the chat layer\'s sections are out of order');
  // Folded inside its section, rather than a fold inside a fold.
  const sheet = LAYER_PANEL.indexOf('<StylesheetPanel');
  assert.ok(LAYER_PANEL.slice(sheet, sheet + 40).includes('bare'), 'the stylesheet folds twice');
  // The time's place is Custom's too, under the time switch.
  const clock = PARTS.indexOf("set('timestampFormat')");
  assert.ok(PARTS.slice(clock, PARTS.indexOf('t.timePosition')).includes('{draws.slots && ('), 'the time\'s place is offered under every look');
  // And on the dock screen, its URL for OBS comes first.
  const dock = fs.readFileSync(new URL('../../web/components/ChatDockSettings.tsx', SCRIPT_URL), 'utf8');
  assert.ok(dock.indexOf('copyText(dockUrl)') > 0 && dock.indexOf('copyText(dockUrl)') < dock.indexOf('{s.size}'), 'the dock\'s url is below its controls');
});

test('turning a stylesheet off actually turns it off', () => {
  /*
    Found by switching theme on an open page and looking: emptying a scoped
    stylesheet leaves its rules applied to whatever they had already matched.
    The chat stayed painted by a sheet that was no longer anywhere in the
    document — four seconds and a forced layout later, with nothing left in the
    CSSOM to explain it. Editing one drops the rules it no longer has, so a
    stylesheet is always edited and never emptied: with nothing to apply it
    writes a rule that does nothing.

    Without this, clearing a box left every browser source already open showing
    the old look until somebody refreshed it, which on stream is the middle of
    the stream.
  */
  assert.ok(SCOPED.includes('scopedText(css, motionCss, vars) || NOTHING'),
    'a scoped stylesheet can go empty again, and then it never goes away');
  const body = SCOPED.slice(SCOPED.indexOf('export const ScopedStyle'));
  assert.equal(body.split('return null;').length - 1, 1, 'there is more than one way out of it');

  // The canvas one has the same hole and the same answer.
  const layout = fs.readFileSync(new URL('../../web/components/LayoutStyle.tsx', SCRIPT_URL), 'utf8');
  assert.ok(layout.includes("|| '.canvas-stage { --canvas-css: none }'"),
    'clearing the canvas stylesheet leaves it applied');
});

// --------------------------------------------- a look for the chat itself

test('a preset can be written onto the chat as well as a layer or an alert', () => {
  /*
    Three things, and they are not interchangeable: a layer preset drops
    across a layout, an alert preset lands on one alert, and a chat preset goes
    on a layout's chat layer — into its settings, which is where a chat reads
    its look from.
  */
  assert.equal(presetApplies({ applies: 'chat' }), 'chat');
  assert.equal(presetApplies({ applies: 'alert' }), 'alert');
  assert.equal(presetApplies({}), 'layer');
});


test('a chat preset only names parts a chat row actually draws', () => {
  /*
    The generic check reads selectors against every component, so a chat preset
    naming a layer part would sail through it by matching something else
    entirely.
  */
  for (const preset of ALL_PRESETS.filter((p) => presetApplies(p) === 'chat')) {
    let at = preset.css.indexOf('[data-');
    while (at >= 0) {
      const selector = preset.css.slice(at + 1, preset.css.indexOf(']', at));
      assert.ok(selector.startsWith('data-chat'),
        `chat preset "${preset.id}" names ${selector}, which is not part of a chat row`);
      assert.ok(componentsDraw(selector), `chat preset "${preset.id}" names ${selector}, which no row draws`);
      at = preset.css.indexOf('[data-', at + 1);
    }
  }
});

test('applying a chat preset turns the chat layer to the theme that reads it', () => {
  /*
    A chat layer keeps its stylesheet in its settings and only the custom
    theme reads it. A preset that landed and then did nothing because of a
    theme chosen elsewhere would read as the preset being broken — so the plan
    that writes the look also turns the theme, as one more change beside it.
  */
  const planner = fs.readFileSync(new URL('../../shared/theme-apply.js', SCRIPT_URL), 'utf8');
  assert.ok(planner.includes('...toCustom(layer, piece.name),'), 'applying a chat preset leaves a theme that ignores it');
  assert.ok(planner.includes('changes.push(...toCustom(layer, look.name));'), 'applying a whole theme leaves the chat in a theme that ignores it');
  // And it takes the same road as any layer's piece: no special case of its own in the Library.
  const commit = LIBRARY.slice(LIBRARY.indexOf('const commit = (object: any) => {'), LIBRARY.indexOf('const themePlanView'));
  assert.ok(!commit.includes("presetApplies(object) === 'chat'"), 'a chat preset is applied apart from its layout again');
  assert.ok(commit.includes('writeLayers('), 'a piece is no longer written onto its layout');
});

test('the library draws a chat preset with the chat column', () => {
  // Through the canvas it would be a layer, which is the one thing it is not.
  assert.ok(LIBRARY.includes('<ChatLog'), 'a chat preset is not previewed by a chat');
  const preview = LIBRARY.slice(LIBRARY.indexOf('const Preview = ('), LIBRARY.indexOf('export const LibraryView'));
  assert.ok(preview.includes("presetApplies(object) === 'chat'"), 'the preview does not tell chat apart');
  // Drawn under the theme that reads it, or the card would show nothing of the preset.
  assert.ok(LIBRARY.includes("chatTheme: 'custom',"), 'the preview draws under a theme that ignores the preset');
});


test('a chat preset is applied in one save, not two', () => {
  /*
    Measured once by recording what the page actually sent: two writes in the
    same breath both start from the same stale copy, and the second undoes the
    first — the theme arrived and the stylesheet did not, with nothing on
    screen to say so. A chat preset's theme and stylesheet are changes in one
    plan now, written onto the layout together in one save of the layouts.
  */
  const commit = LIBRARY.slice(LIBRARY.indexOf('const commit = (object: any) => {'), LIBRARY.indexOf('const themePlanView'));
  assert.ok(!commit.includes('system.settings.set'), 'a chat preset is written through a chat setting again');
  const layerPath = commit.slice(commit.indexOf('const changes = piecePlan('));
  assert.equal(layerPath.slice(0, layerPath.indexOf('setUndo(')).split('writeLayers(').length - 1, 1, 'a piece is written in more than one save');
  // The plan carries both, so the one save carries both.
  const chatLook = ALL_PRESETS.find((p) => p.id === 'simonsays-chat');
  const layout = { id: 'l', layers: [{ uid: 'c', type: 'chat', config: { chatTheme: 'modern' } }] };
  const fields = APPLY.piecePlan(chatLook, layout, []).map((c) => c.field).sort();
  assert.deepEqual(fields, ['chatTheme', 'css'], 'the plan does not carry the theme and the stylesheet together');
});

// --------------------------------------------- a rank a stylesheet can see

test('a row says which rank its chatter holds', () => {
  /*
    The highlight was a wrapper with an inline border colour and no name on it,
    so a stylesheet could not tell a moderator's line from anybody else's, let
    alone do something other than draw a bubble around it.
  */
  assert.ok(CHAT_ROW.includes('const rankOf = (chat: ChatMessage): string =>'), 'nothing works out the rank');
  const seen = CHAT_ROW.split('data-chat-rank=').length - 1;
  assert.ok(seen >= 5, `only ${seen} row(s) say which rank they are`);
});

test('and in the same order the highlight colour uses', () => {
  /*
    These overlap — a broadcaster is also a moderator and usually a subscriber
    — so without one order they would disagree, and a line would be outlined
    as one rank and named as another.
  */
  const rankOf = CHAT_ROW.slice(CHAT_ROW.indexOf('const rankOf ='), CHAT_ROW.indexOf('const renderChatMessageBody'));
  const colour = CHAT_ROW.slice(CHAT_ROW.indexOf('const highlightColorFor ='));
  const order = (src) => ['isBroadcaster', 'isMod', 'isVip', 'isSub'].map((k) => src.indexOf(k));
  const a = order(rankOf);
  const b = order(colour.slice(0, colour.indexOf('const renderChatMessageHelper')));
  assert.ok(a.every((n) => n > 0), `the rank order names only ${a.filter((n) => n > 0).length} of them`);
  assert.deepEqual(a.map((n, i) => n < a[i + 1] || i === 3), [true, true, true, true], 'the rank order is not highest first');
  assert.ok(b.every((n) => n > 0), `the colour order names only ${b.filter((n) => n > 0).length} of them`);
  assert.deepEqual(b.map((n, i) => n < b[i + 1] || i === 3), [true, true, true, true], 'the colour order is not highest first');
});

test('the colour somebody chose reaches the stylesheet without being named', () => {
  /*
    As a custom property, so a rule can paint with it — var(--chat-rank, …) —
    rather than a stylesheet having to hardcode the colours from a screen it
    cannot see.
  */
  const shared = CHAT_ROW.slice(CHAT_ROW.indexOf('const rowWithRank'));
  assert.ok(shared.slice(0, 200).includes("['--chat-rank' as any]: rankColour"), 'the rank colour is not handed over');
  // Only when one was chosen, so the fallback in a rule is what decides for
  // everybody who holds no rank.
  assert.ok(CHAT_ROW.includes('const rowWithRank: React.CSSProperties = rankColour'),
    'the property is written even where no colour was chosen');
});

test('the bubble a rank draws is named, so it can be turned off', () => {
  // Restyling it is one thing; replacing it with something else is the other,
  // and both need a way to reach it.
  assert.ok(CHAT_ROW.includes('data-chat="highlight"'), 'the highlight wrapper has no name');
  assert.ok(CHAT_ROW.includes('data-chat-highlight="paid"'), 'the paid highlight is not told apart');
  assert.ok(CHAT_ROW.includes('data-chat-highlight="rank"'), 'the rank highlight is not told apart');
  assert.ok(LAYER_PANEL.includes('[data-chat="highlight"]'), 'the editor does not offer it');
});



