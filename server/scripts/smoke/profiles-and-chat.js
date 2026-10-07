/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Profiles, chat appearance, and chat style tokens.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, collection, engine, fs, normaliseChat, spotifyOps, test } from './harness.js';
import { bc, interp } from './music-and-speech.js';
import { DOCK_BUILTINS, MANIFEST, alertsModule, busModule, has, platformsWith, resolveServerUrl, says, youtubeModule } from './backup-and-layouts.js';

// ------------------------------------------------------------------ profiles

const { AVATAR_EXPRESSIONS_LIST: AVATAR_FACES, AVATAR_ACTIONS_LIST } = await import('../../../shared/avatar.js');
// What the house avatar does, where one stands in for the built-in one (shared/house-avatar.js).
const { HOUSE_CHARACTER } = await import('../../../shared/house-avatar.js');
const HOUSE_ACTIONS = HOUSE_CHARACTER
  ? ((await import('../../../shared/pixel-avatar-examples.js')).pixelAvatarExamples().find((e) => e.id === HOUSE_CHARACTER)?.actions || []).map((a) => a.name)
  : [];
const { PROFILE_GROUPS, MAX_PROFILES_PER_GROUP } = await import('../../engine/profiles.js');
const PROTOCOL = await import('../../../shared/protocol.js');

test('the same settings with their keys in another order are not unsaved changes', () => {
  /*
    Found on the live server: a group sat on "Unsaved changes" with nothing
    different from its saved profile but the order of its keys, because the
    save path rebuilds an object in an order of its own. The chat on stream
    is in the overlays group now, so it is that group's layouts that are
    reordered here.
  */
  const dirtyOverlays = () => engine.store.profileSummary().find((g) => g.id === 'overlays').dirty;
  engine.store.profileCapture('overlays');
  assert.equal(dirtyOverlays(), false, 'a group is unsaved straight after being saved');

  const live = collection('layouts');
  const before = live.get();
  const reordered = before.map((l) => Object.fromEntries(Object.entries(l).reverse()));
  assert.notEqual(JSON.stringify(reordered), JSON.stringify(before), 'the test did not reorder anything');
  live.set(reordered);
  assert.equal(dirtyOverlays(), false, 'reordering the keys counted as a change');

  // And a real change still is one.
  live.set(reordered.map((l, i) => (i === 0 ? { ...l, name: `${l.name} (changed)` } : l)));
  assert.equal(dirtyOverlays(), true, 'a changed value no longer marks the group unsaved');
  live.set(before);
  engine.store.profileCapture('overlays');
});

// --------------------------------------------------------- chat appearance

/*
  The chat on stream is a layer, and a layout save is what checks its
  settings — so the rules are tested here through that save, the way a client
  value actually arrives.
*/
const { normaliseLayouts: normaliseLayoutsForChat } = await import('../../engine/layouts.js');
/** A chat layer's settings, as saving a layout with it stores them. */
export const chatLayer = (config) => normaliseLayoutsForChat([
  { id: 'chat-check', name: 'Chat check', layers: [{ type: 'chat', uid: 'chat-1', config }] },
])[0].layers.find((y) => y.type === 'chat').config;

test('an unreadable chat size is clamped rather than stored', () => {
  // These land in an inline style on a surface that is on stream, so a value
  // from a client is checked rather than trusted.
  const huge = chatLayer({ fontSize: 4000 });
  assert.ok(huge.fontSize <= 96, `stored ${huge.fontSize}px`);
  const tiny = chatLayer({ fontSize: 0 });
  assert.ok(tiny.fontSize >= 8, `stored ${tiny.fontSize}px`);
});

test('a chat theme the renderer cannot draw is never stored', () => {
  const out = chatLayer({ fontSize: 16, chatTheme: 'not-a-theme' });
  assert.ok(['modern', 'compact', 'retro'].includes(out.chatTheme), out.chatTheme);
});

test('a theme that has since been removed falls back instead of sticking', () => {
  /*
    The horror and block themes were removed. A layout saved while one was
    chosen still holds it; left alone, the dead theme would survive every
    later save and leave the chat drawing the default while its settings
    said otherwise.
  */
  const out = chatLayer({ fontSize: 20, chatTheme: 'horror' });
  assert.notEqual(out.chatTheme, 'horror', 'a removed theme survived a save');
  assert.ok(['modern', 'compact', 'retro'].includes(out.chatTheme), out.chatTheme);
});

test('the dock and a chat on stream keep separate settings', () => {
  const dock = engine.store.setChatDockSettings({ migrated: true, fontSize: 34 });
  const layer = chatLayer({ fontSize: 20 });
  assert.equal(layer.fontSize, 20);
  assert.equal(dock.fontSize, 34);
  assert.equal(engine.store.getChatDockSettings().fontSize, 34);
});

test('changing one surface leaves the other alone', () => {
  /*
    The stream is for viewers and the dock is a tool for whoever is running
    it. They want different things from the same data, so neither write may
    reach the other.
  */
  const before = engine.store.getLayouts();
  engine.store.setChatDockSettings({ migrated: true, fontSize: 34, emoteSize: 40 });
  engine.store.setLayouts([...before, { id: 'chat-apart', name: 'Apart', layers: [{ type: 'chat', uid: 'ca', config: { ...chatLayer({ fontSize: 11 }), emoteSize: 24 } }] }]);
  const dock = engine.store.getChatDockSettings();
  const saved = engine.store.getLayouts().find((l) => l.id === 'chat-apart').layers[0].config;
  engine.store.setLayouts(before);
  assert.equal(dock.fontSize, 34, 'a chat layer wrote over the dock');
  assert.equal(dock.emoteSize, 40);
  assert.equal(saved.fontSize, 11, 'the dock wrote over the chat layer');
});

test('the dock is checked by the same rules as a chat on stream', () => {
  // A second, looser validator for the dock is how a value the overlay
  // refuses gets in anyway, and the dock is on the streamer's screen.
  const out = engine.store.setChatDockSettings({
    migrated: true, fontSize: 9999, chatTheme: 'not-a-theme', textColor: 'red; url(x)',
  });
  assert.ok(out.fontSize <= 96, String(out.fontSize));
  assert.ok(['modern', 'compact', 'retro', 'custom'].includes(out.chatTheme));
  assert.equal(out.textColor, '');
});

test('the dock is deliberately outside every profile', () => {
  /*
    The whole reason it is its own collection: a collection is the unit a
    profile captures, so switching the look of the stream leaves the desk
    alone. Putting it in a group would undo that silently.
  */
  for (const group of PROFILE_GROUPS) {
    assert.ok(!group.collections.includes('chat_dock_settings'),
      `the dock is inside the "${group.id}" profile group`);
  }
  const ws = fs.readFileSync(new URL('../api/ws.js', SCRIPT_URL), 'utf8');
  const listed = ws.slice(ws.indexOf('PROFILED_KEYS'), ws.indexOf('PROFILED_KEYS') + 400);
  assert.ok(!listed.includes('chatDockSettings'),
    'changing the dock would mark a profile unsaved');
});

test('the dock screen offers no profile bar, and there is no chat overlay screen', () => {
  /*
    The dock keeps its own settings outside every profile, so a bar on its
    screen would offer to switch something that changes nothing there. The
    chat on stream is set on its layer, on the Overlays screen — which has the
    overlays bar — so there is no separate chat overlay screen to put one on.
  */
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  const from = app.indexOf('PROFILE_GROUP_FOR_VIEW');
  const map = app.slice(from, app.indexOf('};', from));
  assert.ok(!map.includes("'chat-overlay'"), 'a chat overlay screen has a profile bar again');
  assert.ok(!/\bassets:\s*'chat'/.test(map), 'the dock screen has a profile bar again');
  assert.ok(/layouts:\s*'overlays'/.test(map), 'the Overlays screen lost its profile bar');
  assert.ok(!app.includes("setView('chat-overlay')"), 'the chat overlay screen is back in the menu');

  // And the dock screen edits only the dock: nothing to switch between.
  const view = fs.readFileSync(new URL('../../web/components/views/ChatDockView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!/surface: 'dock' \| 'overlay'/.test(view), 'the dock screen edits another surface again');
  assert.ok(!view.includes('setChatTarget'), 'the dock screen aims the editor somewhere else again');
  assert.ok(view.includes('<ChatDockSettings values={chat} patch={patchChat}'), 'the dock screen no longer edits the dock\'s settings');
});

test('the chat on stream travels with the overlay profile, not a group of its own', () => {
  /*
    There was a chat group, so switching the stream's look meant remembering
    to switch the chat's as well — and a chat layer could quietly override it.
    The chat is part of its layouts now, so the overlays group carries it.
  */
  assert.ok(!PROFILE_GROUPS.some((g) => g.id === 'chat'), 'the chat has a profile group of its own again');
  assert.ok(PROFILE_GROUPS.find((g) => g.id === 'overlays').collections.includes('layouts'));
  assert.ok(!PROFILE_GROUPS.some((g) => g.collections.includes('chat_settings')), 'the old shared chat is in a profile again');
  assert.ok(!engine.store.profileSummary().some((g) => g.id === 'chat'), 'the chat group is still offered');
});

test('the dock reads its own set, and a chat on stream reads its layer', () => {
  /*
    Everything that draws a message is handed its settings. The dock resolves
    its own set in the hook; a chat layer is drawn from the layer's own — and
    never from this device's, which are the dock's, a different chat.
  */
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  assert.ok(/chatDockSettings/.test(hook), 'the dock set never reaches the client');
  assert.ok(/CHAT_SURFACE === 'dock'/.test(hook), 'a standalone dock no longer picks its own');
  assert.ok(/...surfaceOverrides,/.test(hook), 'the resolved values no longer reach settings');
  assert.ok(!/\(snapshot as any\)\.chatSettings\b/.test(hook), 'the hook reads the old shared chat again');
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const chatCase = stage.slice(stage.indexOf("case 'chat':"), stage.indexOf("case 'runcard':"));
  assert.ok(chatCase.includes('settings={{ ...CHAT_DEFAULTS, ...cfg }'), 'a chat layer is not drawn with its own settings');
  assert.ok(!chatCase.includes('system.settings'), 'a chat layer is drawn with the dock\'s settings');
});

test('the dock keeps the look it had when it became its own', () => {
  /*
    The dock used to be an override map on one shared set. The move has to
    leave both surfaces looking exactly as they did, or everyone's chat
    changes on upgrade for no reason they asked for.
  */
  const src = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  const migration = src.slice(src.indexOf('legacyChat'), src.indexOf('profiles.initProfiles'));
  assert.ok(migration.includes('db.chatDock.set('), 'the dock is not seeded from what it had');
  // Plain substrings: the text being matched is mostly spread syntax, and a
  // regex for it is more escaping than meaning.
  assert.ok(migration.includes('legacyChat.dockOverrides'),
    'the dock is seeded without folding in its own differences');
  assert.ok(migration.includes('legacyChat.overlayOverrides'),
    'the overlay loses its own differences in the move');
});

test('chat appearance is not read from the URL any more', () => {
  /*
    Deliberately removed: each chat on stream keeps its own settings on its
    layer, and a stale URL silently outranking them would be the worst of
    both. A reader could easily put this back by habit.
  */
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  // Comment lines still describe the old behaviour, so only code counts.
  const code = hook.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const key of ['chatTheme', 'fontSize', 'usernameFontSize', 'emoteSize', 'messageGap']) {
    assert.ok(!new RegExp(`qp\\w*\\(\\s*'${key}'`).test(code), `${key} is read from the URL again`);
  }
});

test('nothing writes the old shared chat any more', () => {
  /*
    It is kept only to fill out a chat layer from before chat layers kept
    their own settings. A browser carrying up what it held — the one-time
    migration from when chat lived in localStorage — or any other write to it
    would change what those layers are filled from, out of sight.
  */
  const { C2S } = PROTOCOL;
  assert.ok(!('SET_CHAT_SETTINGS' in C2S), 'the shared chat can be written over the socket again');
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  assert.ok(!hook.includes('SET_CHAT_SETTINGS'), 'a client writes the shared chat again');
  assert.ok(!hook.includes('mayMigrateChat'), 'a browser carries its old chat up again');
  assert.ok(!('setChatSettings' in engine.store), 'the engine writes the shared chat again');
  const snap = engine.snapshot();
  assert.ok(!('chatSettings' in snap), 'clients are sent the old shared chat again');
});

// ------------------------------------------------------ chat style tokens

export const {
  CHAT_FONTS, USERNAME_CASES, TIMESTAMP_FORMATS, CHAT_ANIMATIONS, CHAT_STYLE_KEYS,
  CHAT_LAYOUTS, TIMESTAMP_POSITIONS, BADGE_POSITIONS, AVATAR_SHAPES, CHAT_DEFAULTS, CHAT_THEME_IDS,
} = await import('../../../shared/chat-style.js');

test('every style token the editor knows about is one the server stores', () => {
  /*
    A key in the shared list with no home in the defaults would be validated
    and then dropped on the next save: the control would appear to work once
    and then forget, with nothing on screen to say why.
  */
  for (const key of CHAT_STYLE_KEYS) {
    assert.ok(key in CHAT_DEFAULTS, `"${key}" is offered but has no default`);
    assert.ok(key in chatLayer({ fontSize: 16 }), `"${key}" is offered but a chat layer never stores it`);
  }
});

test('the server accepts every choice the editor offers', () => {
  // The lists are shared so they cannot drift, but only this proves the
  // validators are actually built from them.
  for (const font of CHAT_FONTS) {
    assert.equal(chatLayer({ fontSize: 16, fontFamily: font }).fontFamily, font);
  }
  for (const c of USERNAME_CASES) {
    assert.equal(chatLayer({ fontSize: 16, usernameCase: c }).usernameCase, c);
  }
  for (const f of TIMESTAMP_FORMATS) {
    assert.equal(chatLayer({ fontSize: 16, timestampFormat: f }).timestampFormat, f);
  }
  for (const a of CHAT_ANIMATIONS) {
    assert.equal(chatLayer({ fontSize: 16, animationIn: a }).animationIn, a);
  }
});

test('a style token is checked, not trusted', () => {
  // These are interpolated into inline styles on a surface that is on stream.
  assert.ok(chatLayer({ fontSize: 16, outlineWidth: 999 }).outlineWidth <= 8);
  assert.equal(chatLayer({ fontSize: 16, textColor: 'red; background:url(x)' }).textColor, '');
  // A font this build has never heard of is allowed — it may be one the user
  // uploaded — but a name carrying CSS is not a name.
  assert.equal(chatLayer({ fontSize: 16, fontFamily: 'Bebas Neue' }).fontFamily, 'Bebas Neue');
  assert.equal(chatLayer({ fontSize: 16, fontFamily: 'x"; background: url(y); font-family: "z' }).fontFamily, '');
  assert.ok(chatLayer({ fontSize: 16, lineHeight: 900 }).lineHeight <= 3);
});

test('an unset style token stays unset rather than becoming a default', () => {
  /*
    The whole reason the tokens could land without changing how anything looks.
    If clearing a control wrote some number instead, the theme would be gone
    and there would be no way back to it.
  */
  const out = chatLayer({ fontSize: 16, fontFamily: '', lineHeight: '', textColor: '', rowRadius: '' });
  for (const key of ['fontFamily', 'lineHeight', 'textColor', 'rowRadius']) {
    assert.equal(out[key], '', `"${key}" did not stay unset`);
  }
});

test('chat carries the moment it arrived, not only a formatted string', () => {
  // `time` is formatted in the server's locale, so offering 12h/24h needs the
  // raw value — and so does knowing whether a replayed message has expired.
  const c = normaliseChat({ platform: 'twitch', user: 'x', msg: 'y' });
  assert.equal(typeof c.at, 'number', 'no arrival time on a chat message');
  assert.ok(Math.abs(Date.now() - c.at) < 5000, String(c.at));
});

test('messages only expire on a surface that is on stream', () => {
  /*
    The dock has an auto-hide setting like any chat, and an expiry read
    straight from it would empty the dock you are reading in. A surface has to
    opt in, and only the chat on stream — a layer, drawn by the canvas — does.
  */
  const row = fs.readFileSync(new URL('../../web/components/ChatMessageRow.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/autoHide = false/.test(row), 'expiry is no longer off unless a surface asks for it');
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(app.includes('autoHide={false}'), 'the dock now expires messages too');
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const chatCase = stage.slice(stage.indexOf("case 'chat':"), stage.indexOf("case 'runcard':"));
  assert.ok(/\bautoHide\b/.test(chatCase), 'the chat on stream no longer expires messages');
});

test('the custom theme is offered wherever a theme is chosen', () => {
  assert.ok(CHAT_THEME_IDS.includes('custom'), 'the server would reject its own theme');
  const constants = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  assert.ok(constants.includes("id: 'custom'"), 'the picker does not offer it');
  const types = fs.readFileSync(new URL('../../web/types.ts', SCRIPT_URL), 'utf8');
  assert.ok(/ChatThemeId =[^;]*'custom'/.test(types), 'the type does not allow it');
});

test('the server accepts every arrangement the editor offers', () => {
  const cases = [
    ['layout', CHAT_LAYOUTS], ['timestampPosition', TIMESTAMP_POSITIONS],
    ['badgePosition', BADGE_POSITIONS], ['avatarShape', AVATAR_SHAPES],
  ];
  for (const [key, allowed] of cases) {
    for (const value of allowed) {
      const out = chatLayer({ fontSize: 16, [key]: value });
      assert.equal(out[key], value, `"${key}" rejected "${value}"`);
    }
    assert.ok(allowed.includes(chatLayer({ fontSize: 16, [key]: 'nonsense' })[key]),
      `"${key}" stored something outside its list`);
  }
});

test('an arrangement always has a value, unlike a style token', () => {
  /*
    The style tokens can be unset because a theme is underneath them. The
    custom theme has nothing underneath, so a slot left empty would mean a
    part with nowhere to go — these carry real defaults instead.
  */
  const out = chatLayer({ fontSize: 16, layout: '', timestampPosition: '', badgePosition: '', avatarShape: '' });
  for (const key of ['layout', 'timestampPosition', 'badgePosition', 'avatarShape']) {
    assert.ok(out[key], `"${key}" came back empty`);
  }
});

test('only the custom theme reads the arrangement', () => {
  /*
    The other three keep their hardcoded markup on purpose: honouring an
    arrangement setting in them would mean rewriting the thing that makes each
    of them itself, and it is what guarantees nobody's existing chat moves.
  */
  const row = fs.readFileSync(new URL('../../web/components/ChatMessageRow.tsx', SCRIPT_URL), 'utf8');
  const start = row.indexOf("settings.chatTheme === 'custom'");
  const end = row.indexOf("settings.chatTheme === 'compact'");
  assert.ok(start > 0 && end > start, 'the custom branch is gone or has moved after the others');
  const custom = row.slice(start, end);
  for (const slot of ['layout', 'timestampPosition', 'badgePosition', 'avatarShape', 'nameSeparator']) {
    const reads = [...row.matchAll(new RegExp(`settings\\.${slot}\\b`, 'g'))].length;
    const inCustom = [...custom.matchAll(new RegExp(`settings\\.${slot}\\b`, 'g'))].length;
    assert.equal(reads, inCustom, `"${slot}" is read outside the custom theme, so another theme would move`);
  }
});

test('a chat stylesheet can argue with every property the controls write', () => {
  /*
    The sizes and the username colour used to be written inline on every
    message, which put them out of a stylesheet's reach — while the background
    and padding beside them obeyed, because those are only written when
    somebody sets one. Half the box answered to CSS and half ignored it.

    They are handed over as values now, read back by defaults that carry no
    specificity, so a rule written about any of them wins.
  */
  const row = fs.readFileSync(new URL('../../web/components/ChatMessageRow.tsx', SCRIPT_URL), 'utf8');
  const styles = row.slice(row.indexOf('const commonStyle'), row.indexOf('The custom theme: the only one'));
  assert.ok(styles.length > 100, 'the two style objects have moved');
  for (const written of ['fontSize:', 'color: settings.colorUsername']) {
    assert.ok(!styles.includes(written),
      `"${written}" is written on every message again, so no stylesheet can reach it`);
  }
  for (const name of ['--chat-font-size', '--chat-username-size', '--chat-user-color']) {
    assert.ok(row.includes(name), `chat no longer hands over ${name}`);
  }

  const sheet = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  for (const [name, rule] of [
    ['--chat-font-size', ':where([data-chat="text"])'],
    ['--chat-username-size', ':where([data-chat="user"])'],
    ['--chat-user-color', ':where([data-chat="user"])'],
  ]) {
    assert.ok(sheet.includes(`var(${name})`), `nothing reads ${name}, so the control stopped working`);
    assert.ok(sheet.includes(rule), `${rule} is gone, so the default carries specificity a stylesheet must outrank`);
  }
});

test('the dock switches between panels, and the overlay has none', () => {
  /*
    The buttons are called Dock Actions and lived in a second browser source
    you had to add and place yourself. They are a panel of the dock now, and
    the switch above them belongs to it alone: the overlay is what viewers see,
    and a control there is one nobody can reach.
  */
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(app.includes("mode === 'dock' && <DockTabs"),
    'the dock draws no switch, or draws one where viewers would see it');
  assert.ok(app.includes("mode === 'dock' && panel === 'actions'"),
    'the buttons are not a panel of the dock');
  assert.ok(app.includes("mode === 'dock' && panel === 'chat'"),
    'the composer is drawn whichever panel is up');

  /*
    Chat keeps its place in the tree while another panel is up. Taking it down
    and putting it back would drop the scroll position, so coming back from the
    buttons would land somewhere other than where you left off.
  */
  assert.ok(app.includes("panel !== 'chat' ? { display: 'none' } : undefined"),
    'chat is unmounted while another panel is up, so it loses its place');

  /* Remembered per browser, and a browser source may refuse storage outright. */
  assert.ok(app.includes("localStorage.getItem('dock_tab')")
    && app.includes("localStorage.setItem('dock_tab'"),
    'the dock forgets which panel was open');
  const around = app.indexOf("localStorage.getItem('dock_tab')");
  assert.ok(app.slice(around - 60, around).includes('try {'),
    'storage is read without a guard, so a dock that refuses it would draw nothing at all');

  /* A stored name nothing offers falls back rather than leaving the dock blank. */
  assert.ok(app.includes("DOCK_TABS.some((x) => x.id === dockTab) ? dockTab : 'chat'"),
    'a stored panel that no longer exists would leave the dock showing nothing');
});

test('another dock panel is an entry in a list, not a rearrangement', () => {
  /*
    The point of a switch rather than a strip is that the next panel is cheap.
    The bar takes its tabs as data and knows nothing about what any of them
    hold, and draws nothing at all when there is only one — a switch with
    nowhere to go is a control that has never done anything.
  */
  const bar = fs.readFileSync(new URL('../../web/components/DockTabs.tsx', SCRIPT_URL), 'utf8');
  assert.ok(bar.includes('tabs: DockTab[]'), 'the bar no longer takes its tabs as data');
  assert.ok(bar.includes('if (tabs.length < 2) return null;'),
    'a dock with one panel still spends room on a switch');
  for (const part of ['data-dock="tabs"', 'data-dock="tab"', 'data-dock-tab=']) {
    assert.ok(bar.includes(part), 'the switch does not name ' + part);
  }
});


test('the button grid has a shape, bounded, with square cells still reachable', () => {
  /*
    Columns and rows both, because a dock is a tall narrow column or a wide
    short strip far more often than it is a square, and a grid that only ever
    draws squares leaves the rest of the box empty.

    Eight at most: past that the buttons are too small to hit on a phone, which
    is one of the two things the grid is for.
  */
  const huge = engine.store.setDockGrid({ columns: 99, rows: 99 });
  assert.ok(huge.columns <= 8 && huge.rows <= 8, JSON.stringify(huge));
  const none = engine.store.setDockGrid({ columns: 3, rows: 0 });
  assert.equal(none.rows, 0, 'rows cannot be none, so square cells stopped being reachable');
  const one = engine.store.setDockGrid({ columns: 4 });
  assert.equal(one.columns, 4);
  assert.equal(one.rows, 0, 'setting one of the two cleared the other');
  engine.store.setDockGrid({ columns: 3, rows: 0 });

  // And it travels: an arrangement somebody sized should survive a move.
  assert.ok(MANIFEST.some((e) => e.name === 'dock_grid'), 'the grid shape is left out of a backup');
});

test('every surface draws the grid at the shape the server holds', () => {
  /*
    The column count used to be written into the URL you copied, because the
    grid was its own browser source and the shape was a preference of whichever
    browser copied the link. The chat dock draws it too now, and a number
    pinned into one browser source is a number the other cannot see.
  */
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!app.includes("searchParams.get('cols')"),
    'the standalone grid still takes its shape from its own URL, so the two can disagree');
  assert.equal(app.split('rows={system.data.dockGrid.rows}').length - 1, 2,
    'one of the two surfaces draws the grid without the stored shape');
  assert.equal(app.split('columns={system.data.dockGrid.columns}').length - 1, 2,
    'one of the two surfaces draws the grid without the stored columns');

  const view = fs.readFileSync(new URL('../../web/components/views/DockActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!view.includes("localStorage.getItem('dock_actions_columns')"),
    'the screen still keeps the shape in this browser, where no other surface can read it');
  assert.ok(!view.includes("url.searchParams.set('cols'"),
    'the copied URL still pins a shape, which would outrank the one somebody sets later');
});

test('rows size the grid to the height it was given', () => {
  /*
    A dock is a tall narrow column or a wide short strip far more often than it
    is a square, and a grid that can only be told its columns leaves the rest
    of the box empty. With rows set, the height is part of what decides how
    big the buttons are — by measuring the whole box, not by dividing it into
    cells the buttons then sit loose inside.
  */
  const grid = fs.readFileSync(new URL('../../web/components/DockActionsGrid.tsx', SCRIPT_URL), 'utf8');
  assert.ok(grid.includes('(100cqh - '), 'the height no longer decides how big the buttons are');
  assert.ok(grid.includes('className="w-full h-full min-h-0 flex items-center justify-center"'),
    'the box being measured does not fill the height the grid was given');
});


test('a dock button is square, and so is the cell it fills', () => {
  /*
    Stretching a button to its cell would make a single row a row of enormous
    letterboxes, and the point of a grid of buttons is that they are the same
    size and the same shape wherever they are. The cells are one computed side
    in both directions, and the button fills its cell.
  */
  const grid = fs.readFileSync(new URL('../../web/components/DockActionsGrid.tsx', SCRIPT_URL), 'utf8');
  assert.ok(grid.includes("const squareStyle = { width: '100%' };"), 'the button no longer fills its cell');
  assert.ok(grid.includes('repeat(${columns}, ${side})') && grid.includes('repeat(${rowCount}, ${side})'),
    'the columns and rows are different sizes, so a cell is not square');
  assert.ok(!grid.includes("rows > 0 ? 'min-h-0' : 'aspect-square'"),
    'the square ratio is conditional again, so rows would stretch the button');
  const button = grid.slice(grid.indexOf('<button'), grid.indexOf('</button>'));
  assert.ok(button.includes('aspect-square'), 'the button is not square');

  /*
    And the screen previewing it takes the grid's own proportions, or the rows
    divide a height of nothing and the squares come out a few pixels across.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/DockActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('style={rows > 0 ? { aspectRatio: `${columns} / ${rows}` } : undefined}'),
    'the preview box has no shape for the rows to divide');
});



test('a dock button owns a cell, not a place in a queue', () => {
  /*
    A list can only put its gaps at the end. A dock is a board, and a board has
    holes wherever you left them — so the position is the button's own, and the
    empty cells are the ones nothing claims.

    Where nothing has been said it is the order it arrived in, which is where a
    list would have put it, so nothing moves the first time this is read.
  */
  // Its own action, because the ones other tests make are theirs to delete.
  engine.store.saveAction({ id: 'act-slots', name: 'Slots', enabled: true, steps: [] });
  const saved = engine.store.setDockButtons([
    { actionId: 'act-slots', label: 'First' },
    { actionId: 'act-slots', label: 'Second', slot: 9 },
    { actionId: 'act-slots', label: 'Third', slot: -4 },
  ]);
  assert.equal(saved.length, 3, 'the buttons did not survive the save');
  assert.equal(saved[0].slot, 0, 'a button that was never placed did not fall where a list would have put it');
  assert.equal(saved[1].slot, 9, 'a button parked far out was not left there');
  assert.equal(saved[2].slot, 2, 'a cell below the board was kept instead of being refused');
});

test('the grid is laid out by cell, and a gap holds its place', () => {
  /*
    On the dock a gap has to take up room or the arrangement loses its shape;
    on the screen that arranges it the gap is also somewhere to put something
    down, so there it is drawn. Same cell either way, different clothes.
  */
  const grid = fs.readFileSync(new URL('../../web/components/DockActionsGrid.tsx', SCRIPT_URL), 'utf8');
  assert.ok(grid.includes('const layout: (typeof buttons[number] | null)[]'),
    'the grid no longer builds a board of cells');
  assert.ok(grid.includes('if (at >= 0 && at < cells && !layout[at]) layout[at] = b;'),
    'a button is no longer put in the cell it owns');
  assert.ok(grid.includes('{preview && ('),
    'an empty cell is drawn on the dock as well, or not drawn where it is needed');
  assert.ok(grid.includes('data-dock-empty="yes"'), 'an empty cell is not named');

  /*
    Nothing may vanish. A button whose cell is off the end of the board, or
    whose cell somebody else got to first, lands in the first free one.
  */
  assert.ok(grid.includes('const free = layout.findIndex((c) => c === null);'),
    'a button with nowhere to go is dropped from the grid entirely');

  /*
    And a grid told its rows is that many rows: a button parked outside comes
    back inside rather than dragging the whole board out to reach it. Only more
    buttons than cells grows it.
  */
  assert.ok(grid.includes('rows > 0 ? Math.max(rows, toHold) : Math.max(toHold, toReach)'),
    'the rows somebody asked for are not the rows they get');
});

test('a button is dropped into the cell you chose, and trades if it is taken', () => {
  const grid = fs.readFileSync(new URL('../../web/components/DockActionsGrid.tsx', SCRIPT_URL), 'utf8');
  assert.ok(grid.includes('arrange.over(cell)'),
    'the drop target is something other than the cell under the pointer');
  assert.ok(grid.includes('draggable={Boolean(arrange)}'), 'the grid cannot be dragged');
  assert.ok(grid.includes('onClick={preview ? undefined : () => press(button)}'),
    'a preview button fires its action again');
  assert.ok(grid.includes('const inert = preview && !arrange;'),
    'the preview is inert whether or not it can be arranged, so the drag is dead');
  /* The cell being aimed at is shown, which is the whole feedback now that
     crossing one no longer moves anything into it. */
  assert.ok(grid.includes('arrange.overCell === cell'),
    'nothing shows which cell the button would land in');

  const view = fs.readFileSync(new URL('../../web/components/views/DockActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('arrange={{ dragId, overCell, start: startDrag, over: dragOverCell, overPage: dragOverPage, drop: dropIt }}'),
    'the screen does not hand the grid its arranging');
  /*
    Trading places is the only answer that moves nothing nobody touched:
    whatever was in the cell takes the one the button came from.
  */
  assert.ok(view.includes('sitting && b.id === sitting.id ? { ...b, slot: held.slot }'),
    'dropping on an occupied cell no longer trades places');
  /* A new button lands in the gap you can see rather than after everything. */
  assert.ok(view.includes('const firstFree = ()'), 'a new button does not take the first free cell');
});

test('nothing on the board moves until the button is let go', () => {
  /*
    Crossing a cell used to place the button in it there and then, so dragging
    across a full row dealt every button in it a new home on the way past — a
    gesture that had not finished yet rewriting the board behind the pointer.
    The cell under the pointer is only noted; the board changes on the drop.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/DockActionsView.tsx', SCRIPT_URL), 'utf8');
  const crossing = view.slice(view.indexOf('const dragOverCell'), view.indexOf('const clearDrag'));
  assert.ok(crossing.length > 40, 'the crossing handler has moved');
  assert.ok(!crossing.includes('setDockButtons'),
    'crossing a cell still rearranges the board before anything is dropped');
  assert.ok(crossing.includes('overRef.current = cell;'),
    'the cell under the pointer is not remembered, so the drop has nowhere to land');
  assert.ok(view.includes('const cell = overRef.current;'),
    'the drop reads the cell from state, so it can land on the one before it');
});

test('the list beside the board says what is on it, not where', () => {
  /*
    Where things are is a question the board answers. A list with an opinion of
    its own would be a second, quieter arrangement for the two to disagree
    about — which is what the arrows and the sort in it amounted to.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/DockActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!view.includes('sort((a, b) => a.slot - b.slot)'),
    'the list is sorted again, so it implies an order of its own');
  assert.ok(!view.includes('ArrowUp'), 'the list can be reordered again');
  assert.ok(!view.includes('const move = (index: number'), 'the list still moves buttons about');
  // Split by what kind of button it is, which says what, not where — and the
  // two halves together are every button on the dock, none twice.
  assert.ok(view.includes('dockButtons.filter((b) => b.builtin)') && view.includes('dockButtons.filter((b) => !b.builtin)'),
    'the list draws something other than what is on the dock');
});



test('a built-in dock button needs no action set up for it', () => {
  /*
    A button points at an action you built, which is right for anything
    particular to a stream and absurd for pausing the music: an action whose
    whole body is one step, made once, named, and pointed at — four screens to
    arrive at a play button.
  */
  const saved = engine.store.setDockButtons([
    { builtin: 'spotify_play_pause', label: '' },
    { builtin: 'spotify_launch_rocket', label: 'Invented' },
    { actionId: 'no-such-action', label: 'Also invented' },
  ]);
  assert.equal(saved.length, 1, 'the invented ones were kept, or the real one was dropped');
  assert.equal(saved[0].builtin, 'spotify_play_pause');
  assert.equal(saved[0].actionId, '', 'a built-in button claims an action as well');
});

test('every built-in button names something the player can actually do', () => {
  /*
    The list and the thing it drives are in different files, so nothing but
    this stops one naming an operation the other has never heard of — which
    would be a button that draws, presses, and fails.
  */
  const src = fs.readFileSync(new URL('../platforms/spotify.js', SCRIPT_URL), 'utf8');
  const handled = src.slice(src.indexOf('export async function control'));
  const engineSrc = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  const runsBuiltins = engineSrc.slice(engineSrc.indexOf('export async function runDockBuiltin'), engineSrc.indexOf('export async function runDockAction'));
  for (const b of DOCK_BUILTINS) {
    // A category this does not know is a button nothing here checks.
    assert.ok(['spotify', 'plan', 'timer', 'youtube', 'avatar', 'twitch', 'questions', 'deaths', 'countdown'].includes(b.category), `${b.id} is ${b.category}, which this test does not cover yet`);
    if (b.category === 'countdown') {
      const countdownSrc = fs.readFileSync(new URL('../engine/countdown.js', SCRIPT_URL), 'utf8');
      const ops = countdownSrc.slice(countdownSrc.indexOf('COUNTDOWN_OPS = ['), countdownSrc.indexOf('];', countdownSrc.indexOf('COUNTDOWN_OPS = [')));
      assert.ok(runsBuiltins.includes("builtin.category === 'countdown'") && ops.includes(`'${b.op}'`),
        `the countdown cannot do "${b.op}", which ${b.id} asks for`);
    } else if (b.category === 'deaths') {
      const counterSrc = fs.readFileSync(new URL('../engine/counters.js', SCRIPT_URL), 'utf8');
      assert.ok(runsBuiltins.includes("builtin.category === 'deaths'") && counterSrc.includes(`case '${b.op}':`),
        `the deaths count cannot do "${b.op}", which ${b.id} asks for`);
    } else if (b.category === 'twitch') {
      assert.ok(runsBuiltins.includes("builtin.category === 'twitch'") && ['clip', 'marker'].includes(b.op), `${b.id} does something the dock cannot`);
    } else if (b.category === 'avatar') {
      assert.ok(runsBuiltins.includes("builtin.category === 'avatar'") && (b.op === 'none' || b.op === 'undress' || AVATAR_FACES.includes(b.op) || AVATAR_ACTIONS_LIST.includes(b.op) || HOUSE_ACTIONS.includes(b.op)),
        `the avatar has no face or action called "${b.op}", which ${b.id} asks for`);
    } else if (b.category === 'spotify') {
      assert.ok(handled.includes(`case '${b.op}':`), `the player cannot do "${b.op}", which ${b.id} asks for`);
    } else if (b.category === 'youtube') {
      assert.ok(runsBuiltins.includes("builtin.category === 'youtube'") && b.categories?.length === 2,
        `${b.id} names no two categories to flip between`);
    } else if (b.category === 'questions') {
      assert.ok(runsBuiltins.includes("builtin.category === 'questions'") && b.op === 'next',
        `the question queue cannot do "${b.op}", which ${b.id} asks for`);
    } else if (b.category === 'plan') {
      assert.ok(runsBuiltins.includes("builtin.category === 'plan'") && ['next', 'back'].includes(b.op),
        `the plan cannot do "${b.op}", which ${b.id} asks for`);
    } else {
      const timerSrc = fs.readFileSync(new URL('../engine/stopwatch.js', SCRIPT_URL), 'utf8');
      assert.ok(runsBuiltins.includes("builtin.category === 'timer'") && timerSrc.includes(`case '${b.op}':`),
        `the timer cannot do "${b.op}", which ${b.id} asks for`);
    }
  }
  /* And the five the dock was asked for are all there. */
  for (const id of ['spotify_play_pause', 'spotify_next', 'spotify_previous', 'spotify_volume_up', 'spotify_volume_down']) {
    assert.ok(DOCK_BUILTINS.some((b) => b.id === id), `${id} is gone`);
  }
});

/* Pressed up here, because the test below cannot await anything. */
spotifyOps.length = 0;
await engine.runDockBuiltin('spotify_play_pause');
await engine.runDockBuiltin('spotify_volume_down');
const pressedOps = [...spotifyOps];
let builtinRefused = null;
try { await engine.runDockBuiltin('spotify_launch_rocket'); } catch (err) { builtinRefused = err; }

/* The plan buttons, pressed the same way, and their answers kept for the test. */
engine.store.setPlan({ items: [{ id: 'd1', text: 'One' }, { id: 'd2', text: 'Two' }], currentId: '' });
const planPress = async (id) => { try { await engine.runDockBuiltin(id); return 'ok'; } catch (err) { return err.message; } };
const deckPresses = [];
deckPresses.push(await planPress('plan_back'));                    // nothing started yet
deckPresses.push(await planPress('plan_next'));                    // starts One
const afterStart = engine.snapshot().plan.currentId;
deckPresses.push(await planPress('plan_next'));                    // One done, Two current
deckPresses.push(await planPress('plan_next'));                    // Two done, finished
deckPresses.push(await planPress('plan_next'));                    // nothing left
deckPresses.push(await planPress('plan_back'));                    // Two back
const afterBack = engine.snapshot().plan;
engine.store.setPlan({ items: [], currentId: '' });
deckPresses.push(await planPress('plan_next'));                    // empty plan

test('the deck can complete the plan’s current activity and take it back', () => {
  assert.equal(afterStart, 'd1', 'the first press did not start the plan');
  assert.equal(afterBack.currentId, 'd2', 'going back from the end did not bring the last one back');
  assert.deepEqual(afterBack.items.map((i) => i.done), [true, false]);
  assert.deepEqual(deckPresses.map((r) => r === 'ok'), [false, true, true, true, false, true, false],
    `the presses answered ${JSON.stringify(deckPresses)}`);
});

test('a plan button that moves nothing fails and says why, rather than lighting up', () => {
  assert.equal(deckPresses[0], 'the plan has not started yet');
  assert.equal(deckPresses[4], 'the plan is already finished');
  assert.equal(deckPresses[6], 'the stream plan is empty');
});

test('pressing a built-in button reaches the player, and an invented one does not', () => {
  assert.deepEqual(pressedOps, ['toggle', 'volume_down'],
    `the presses reached the player as ${JSON.stringify(pressedOps)}`);
  assert.ok(builtinRefused, 'a built-in this build does not have ran anyway');
});

test('play and pause are one button, not two', () => {
  /*
    The thing you press to stop the music is the thing you press to start it
    again. Two cells where one would do costs a cell and makes you read them
    before pressing.
  */
  const ids = DOCK_BUILTINS.map((b) => b.id);
  assert.ok(ids.includes('spotify_play_pause'), 'the toggle is gone');
  assert.ok(!ids.includes('spotify_play') && !ids.includes('spotify_pause'),
    'play and pause are offered separately again');
});


test('a volume press starts from the one before it, not from the device', () => {
  /*
    Volume, shuffle and repeat are read-modify-write, and reading the device
    every time is both slow and wrong: slow because it is a second round trip
    before anything happens, wrong because four quick presses all read the same
    number and all compute the same answer. Measured against a stub player,
    four quick presses moved the volume by ten instead of forty.
  */
  const src = fs.readFileSync(new URL('../platforms/spotify.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('const WANTED_FRESH_MS'), 'nothing remembers what the last press asked for');
  assert.ok(src.includes('stillFresh() && wanted.volume !== null'),
    'a volume press reads the device again instead of the press before it');

  /*
    And they queue, or a press that starts before the one before it has written
    lands on the same answer anyway.
  */
  /* Matched without a line ending between them: that file is CRLF. */
  assert.ok(src.includes("case 'volume_down': return queued("),
    'volume presses no longer wait for each other');
  assert.ok(/case 'volume_up':\s*case 'volume_down':/.test(src),
    'the two volume presses no longer share one path');
  for (const op of ['toggle', 'shuffle', 'repeat']) {
    assert.ok(src.includes(`case '${op}': return queued(`), `${op} no longer waits for the press before it`);
  }

  /*
    Remembered only once the player has agreed. A press that failed changed
    nothing, and recording what it wanted would make the next press step from
    somewhere the volume never was.
  */
  const volume = src.slice(src.indexOf("case 'volume_up':"), src.indexOf("case 'shuffle':"));
  // Sent through command(), which brings back a Spotify that has let go — and still throws if the press failed.
  const wrote = volume.indexOf('await command(');
  const noted = volume.indexOf('remember({ volume');
  // Both have to be there: -1 is less than everything, and would pass on absence.
  assert.ok(wrote >= 0 && noted >= 0 && wrote < noted,
    'a failed press is remembered, so the press after it starts from the wrong place');
});

test('only what a viewer can see is worth re-polling', () => {
  /*
    Every control used to schedule three extra polls. Volume, shuffle and
    repeat change nothing on any overlay, so pressing volume four times cost
    twelve polls to show the same picture — on top of the one already running
    every three seconds.
  */
  const src = fs.readFileSync(new URL('../platforms/spotify.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('if (CHANGES_THE_VIEW.includes(operation)) refreshAfterControl();'),
    'every operation re-polls again, including the ones nothing can see');
  const list = src.slice(src.indexOf('const CHANGES_THE_VIEW'), src.indexOf('const CHANGES_THE_VIEW') + 120);
  for (const op of ['play', 'pause', 'next', 'previous', 'toggle']) {
    assert.ok(list.includes(`'${op}'`), `${op} changes what is on screen and no longer re-polls`);
  }
  for (const op of ['volume_up', 'shuffle', 'repeat']) {
    assert.ok(!list.includes(`'${op}'`), `${op} re-polls for a picture that cannot have changed`);
  }
});

test('volume is the one button that may be pressed again while it is working', () => {
  /*
    A press arriving while one is in flight is normally a double-tap rather
    than a second intent — firing a scene switch twice is messy and easy to do
    on a phone. Volume is the opposite: four presses are four tenths, and they
    arrive faster than a round trip. Measured before this: two of four clicks
    never left the page.
  */
  /*
    And the deaths count, for the same reason: three deaths in a row are three
    presses, not a double-tap to swallow. Back to zero is not repeatable.
    The countdown's minute on and minute off likewise.
  */
  const repeatable = DOCK_BUILTINS.filter((b) => b.repeatable).map((b) => b.id);
  assert.deepEqual(repeatable.sort(), ['countdown_less', 'countdown_more', 'deaths_add', 'deaths_subtract', 'spotify_volume_down', 'spotify_volume_up'],
    `the repeatable buttons are now ${JSON.stringify(repeatable)}`);

  const grid = fs.readFileSync(new URL('../../web/components/DockActionsGrid.tsx', SCRIPT_URL), 'utf8');
  assert.ok(grid.includes("const repeatable = Boolean(dockBuiltin(button.builtin || '')?.repeatable);"),
    'the grid no longer asks whether a button may be pressed again');
  assert.ok(grid.includes("if (!repeatable && fired[button.id] === 'running') return;"),
    'every press is swallowed while one is in flight, or none of them are');
});


test('each platform is asked what it calls a thing, rather than told', () => {
  /*
    Twitch and YouTube have swapped the words. You follow a Twitch channel for
    nothing and subscribe for money; you subscribe to a YouTube channel for
    nothing and become a member for money. Showing Twitch's words to somebody
    streaming to YouTube is the wrong word for a thing they use all day.
  */
  assert.equal(says('twitch', 'follower'), 'Follower');
  assert.equal(says('twitch', 'supporter'), 'Subscriber');
  assert.equal(says('youtube', 'follower'), 'Subscriber');
  assert.equal(says('youtube', 'supporter'), 'Member');
  assert.equal(says('youtube', 'tip'), 'Super Chat');

  /* And where a platform has no such thing, it says so rather than guessing. */
  assert.ok(!has('youtube', 'vip'), 'YouTube has grown a VIP rank');
  assert.ok(has('twitch', 'vip'), 'Twitch has lost its VIP rank');
  assert.deepEqual(platformsWith('vip'), ['Twitch'], 'somebody else claims to have VIPs');

  /* An unknown platform falls back rather than drawing an empty label. */
  assert.equal(says('myspace', 'followers'), 'Followers');
});

test('the one rule that keeps the inside honest is written down', () => {
  /*
    isSub means this person pays you. A YouTube subscriber has paid nothing.
    Getting it backwards treats every free subscriber as a paying one at once —
    in permissions, cooldowns, the chat highlight, and any condition written
    against user.isSub — and none of it fails loudly, which is why the rule is
    stated where the mapping is done rather than left to be remembered.
  */
  const src = fs.readFileSync(new URL('../../shared/platforms.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('`isSub` means THIS PERSON PAYS YOU'),
    'the rule about isSub is gone from where the words are decided');
});

test('a chat message is marked with whatever platform it came from', () => {
  /*
    Four themes each carried the same three lines naming one platform at a
    time, so a fourth meant four more edits and a fifth four more again.
  */
  const row = fs.readFileSync(new URL('../../web/components/ChatMessageRow.tsx', SCRIPT_URL), 'utf8');
  assert.ok(row.includes('export const PlatformMark'), 'the mark is no longer one component');
  assert.ok(!row.includes("chat.platform === 'twitch'"),
    'a theme names a platform by hand again, so the next one will be missed');
  assert.ok(row.includes("youtube: YouTubeIcon"), 'YouTube has no mark of its own');

  /*
    The colour goes on a wrapper. These icons take a className and nothing
    else, so a style prop handed to one is dropped and every mark comes out
    white — which is what it did until it was drawn and looked at.
  */
  const mark = row.slice(row.indexOf('export const PlatformMark'), row.indexOf('/** Only the display preferences'));
  assert.ok(mark.includes('<span className="inline-flex shrink-0" style={{ color:'),
    'the colour is handed to the icon again, which quietly ignores it');
});


/*
  One alert, three platforms. Dispatched up here because test() cannot await,
  and dispatch is the real thing rather than a description of it.
*/
const anyFollow = [{ id: 'any', enabled: true, type: 'follow', duration: 1000, variations: [] }];
const twitchOnly = [{ id: 'tw', enabled: true, type: 'twitch_follow', duration: 1000, variations: [] }];
const firedFor = (configs, type) => alertsModule.dispatch(
  configs, { type, user: 'somebody', platform: type.split('_')[0], timestamp: Date.now(), data: {} },
);

const anyHits = ['twitch_follow', 'youtube_follow', 'tiktok_follow'].map((t) => firedFor(anyFollow, t));
const anyMiss = firedFor(anyFollow, 'twitch_sub');
const namedHits = ['twitch_follow', 'youtube_follow'].map((t) => firedFor(twitchOnly, t));

test('one alert can answer for every platform, and a named one still cannot', () => {
  /*
    Alert types name a platform and a thing — twitch_follow, tiktok_gift. Right
    when you want a different alert for each, tiresome the moment you stream to
    two places: the same alert built twice, and again for a third.

    A kind on its own answers to the same thing wherever it happens. The
    platform-specific types still work, so wanting YouTube to have its own is
    still possible.
  */
  assert.deepEqual(anyHits, [1, 1, 1],
    `a "follow" alert fired ${JSON.stringify(anyHits)} times for Twitch, YouTube and TikTok`);
  assert.equal(anyMiss, 0, 'a "follow" alert fired for a subscription');
  assert.deepEqual(namedHits, [1, 0],
    'a twitch_follow alert answered for YouTube, or stopped answering for Twitch');
});

test('a kind is the event type with the platform taken off', () => {
  assert.equal(alertsModule.kindOf('youtube_follow'), 'follow');
  assert.equal(alertsModule.kindOf('twitch_sub_gift_bulk'), 'sub_gift_bulk');
  assert.equal(alertsModule.kindOf('nounderscore'), '', 'something with no platform on it claims a kind');

  /*
    sub_gift_bulk must not read as sub, or a bundle would fire the ordinary
    subscription alert as well as the bundle one.
  */
  assert.notEqual(alertsModule.kindOf('twitch_sub_gift_bulk'), 'sub');
});

test('YouTube says the thing it means, in its own words', () => {
  /*
    Its subscribe is this app's follow and its membership is this app's sub, so
    the alert types read the same as every other platform's while the words on
    screen come from the table.
  */
  for (const type of ['youtube_sub', 'youtube_sub_gift_bulk', 'youtube_cheer']) {
    assert.ok(alertsModule.ALERT_TYPES.includes(type), `the server cannot alert on ${type}`);
  }
  /*
    And nothing is offered that YouTube cannot raise: it has no channel points
    to redeem, and its live chat API raises no event for a free subscribe and
    never says whether a chatter is one. Either alert could be built and would
    wait forever.
  */
  for (const cannot of ['youtube_redemption', 'youtube_follow']) {
    assert.ok(!alertsModule.ALERT_TYPES.includes(cannot),
      `YouTube is offered ${cannot}, which nothing can ever fire`);
  }
});


test('one caption reads correctly wherever it fires', () => {
  /*
    The whole point of an alert that answers for every platform: written once,
    and right on each of them. "{user} is a new {words.follower}" is a Follower
    on Twitch and a Subscriber on YouTube, because those are the same thing
    under two names. Without it a caption written once is wrong on one of the
    two, and written twice is two alerts to keep in step.
  */
  const reads = (template, platform) => interp(
    template, bc({ user: { name: 'somebody', platform }, platform }),
  );
  assert.equal(reads('{user} is a new {words.follower}!', 'twitch'), 'somebody is a new Follower!');
  assert.equal(reads('{user} is a new {words.follower}!', 'youtube'), 'somebody is a new Subscriber!');
  assert.equal(reads('{user} is a {words.supporter}!', 'twitch'), 'somebody is a Subscriber!');
  assert.equal(reads('{user} is a {words.supporter}!', 'youtube'), 'somebody is a Member!');
  assert.equal(reads('{words.tip}', 'youtube'), 'Super Chat');

  /* Something with no platform still reads, rather than going blank. */
  assert.equal(reads('{user} is a new {words.follower}!', 'system'), 'somebody is a new Follower!');
});

test('the alerts screen offers a kind before it offers a platform', () => {
  /*
    One alert that answers wherever the thing happened is usually the right
    answer, so it is the first thing on the screen; the per-platform groups are
    for when you genuinely want them to differ.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/AlertsView.tsx', SCRIPT_URL), 'utf8');
  const any = view.indexOf("group: 'Any platform'");
  const twitch = view.indexOf("group: 'Twitch'");
  const youtube = view.indexOf("group: 'YouTube'");
  assert.ok(any > 0 && any < twitch, 'the any-platform alerts are gone, or buried under a platform');
  assert.ok(youtube > 0, 'YouTube is not offered on the alerts screen');
  /* And the samples use the word rather than one platform's word. */
  assert.ok(view.includes('{words.follower}'), 'the any-platform sample names one platform\u2019s word');
});


/*
  Driven with the shapes the Data API v3 actually sends, up here because test()
  cannot await and the bus is listened to rather than described.
*/
const ytChats = [];
const ytEvents = [];
busModule.bus.on(busModule.EVENTS.CHAT, (m) => { if (m.platform === 'youtube') ytChats.push(m); });
busModule.bus.on(busModule.EVENTS.EVENT, (e) => { if (e.platform === 'youtube') ytEvents.push(e); });

const ytAuthor = (over = {}) => ({
  displayName: 'someone', channelId: 'UC123', profileImageUrl: 'http://x/a.png',
  isChatOwner: false, isChatModerator: false, isChatSponsor: false, ...over,
});
youtubeModule.handleMessage({ id: 'y1', snippet: { type: 'textMessageEvent', displayMessage: 'hello' }, authorDetails: ytAuthor({ displayName: 'freewatcher' }) });
youtubeModule.handleMessage({ id: 'y2', snippet: { type: 'textMessageEvent', displayMessage: 'paid' }, authorDetails: ytAuthor({ displayName: 'amember', isChatSponsor: true }) });
youtubeModule.handleMessage({ id: 'y3', snippet: { type: 'newSponsorEvent', newSponsorDetails: { memberLevelName: 'Tier 1' } }, authorDetails: ytAuthor({ displayName: 'joined' }) });
youtubeModule.handleMessage({ id: 'y4', snippet: { type: 'superChatEvent', superChatDetails: { amountDisplayString: '$5.00', userComment: 'take it' } }, authorDetails: ytAuthor({ displayName: 'spender' }) });
youtubeModule.handleMessage({ id: 'y5', snippet: { type: 'membershipGiftingEvent', membershipGiftingDetails: { giftMembershipsCount: 5 } }, authorDetails: ytAuthor({ displayName: 'generous' }) });
youtubeModule.handleMessage({ id: 'y6', snippet: { type: 'messageDeletedEvent' }, authorDetails: ytAuthor() });

test('a free YouTube subscriber is never treated as someone who pays', () => {
  /*
    The one rule that must not be got wrong. YouTube's live chat says whether
    an author is a member — money — and never whether they subscribed for free.
    Treating one as the other would light up every free subscriber in
    permissions, cooldowns, the chat highlight and any user.isSub condition,
    and none of it would fail loudly.
  */
  const free = ytChats.find((c) => c.user === 'freewatcher');
  const member = ytChats.find((c) => c.user === 'amember');
  assert.ok(free && member, 'the two chat messages did not arrive');
  assert.equal(free.isSub, false, 'somebody who pays nothing is marked as paying');
  assert.equal(member.isSub, true, 'a member is not marked as paying');

  /* And YouTube has no VIP, said plainly rather than left undefined. */
  assert.equal(free.isVip, false);
  assert.equal(member.isVip, false);
});

const { defaultNameColour, DEFAULT_NAME_COLOURS } = await import('../../../shared/platforms.js');

test('YouTube and TikTok names are coloured the way Twitch colours somebody who never chose, not white', () => {
  const free = ytChats.find((c) => c.user === 'freewatcher');
  const member = ytChats.find((c) => c.user === 'amember');
  for (const c of [free, member]) {
    assert.notEqual(c.color.toLowerCase(), '#ffffff', `${c.user} is still white`);
    assert.ok(DEFAULT_NAME_COLOURS.includes(c.color), `${c.user} is not in a Twitch colour`);
  }
  // The same person keeps the same colour; the colour is not what makes a member.
  assert.equal(free.color, defaultNameColour('freewatcher'));
  assert.equal(defaultNameColour('freewatcher'), defaultNameColour('freewatcher'));
  assert.equal(member.isSub, true);
  // Twitch's own pick: first and last letters.
  assert.equal(defaultNameColour('ab'), DEFAULT_NAME_COLOURS[('a'.charCodeAt(0) + 'b'.charCodeAt(0)) % 15]);
  const tw = fs.readFileSync(new URL('../platforms/twitch.js', SCRIPT_URL), 'utf8');
  assert.ok(tw.includes('color: tags.color || defaultNameColour(username)'), 'a Twitch viewer with no colour is not given Twitch\'s');
  assert.ok(fs.readFileSync(new URL('../platforms/tiktok.js', SCRIPT_URL), 'utf8').includes('color: defaultNameColour(nameOf(d))'), 'TikTok names are still white');
});

test('YouTube events arrive as the things this app already understands', () => {
  const byType = (t) => ytEvents.filter((e) => e.type === t);
  assert.equal(byType('youtube_sub').length, 1, 'a new member did not raise one subscription event');
  assert.equal(byType('youtube_cheer').length, 1, 'a Super Chat did not raise a tip event');
  assert.equal(byType('youtube_sub_gift_bulk').length, 1, 'gifted memberships did not raise a bundle');
  assert.equal(byType('youtube_sub_gift_bulk')[0].data.count, 5, 'the bundle lost its count');
  assert.equal(byType('youtube_cheer')[0].data.amount, '$5.00', 'the Super Chat lost its amount');

  /* The words of a Super Chat go to chat as well, the way a cheer does. */
  assert.ok(ytChats.some((c) => c.user === 'spender' && c.msg === 'take it'),
    'a Super Chat said nothing in chat');

  /* And anything else — deletions, bans — is ignored rather than guessed at. */
  assert.equal(ytChats.length + ytEvents.length, 6,
    `something was invented or dropped: ${ytChats.length} chats, ${ytEvents.length} events`);
});

test('there is a way in, and it asks Google for what it needs', () => {
  /*
    Everything above was reachable only by injecting events; without this there
    was nothing on any screen to connect a YouTube account with.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/ConnectionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('data-connection="youtube"'), 'the Connections screen has no YouTube card');
  assert.ok(view.includes('youtubeRedirectUri()'),
    'the card does not show the redirect Google will be told to come back to');
  /*
    And the way to the console the id comes from, the same as every other
    platform gets — through the same component, so the redirect to register
    and the link to register it at stay together.
  */
  assert.ok(view.includes('https://console.cloud.google.com/apis/credentials'),
    'the card no longer says where to get a client id');
  const card = view.slice(view.indexOf('data-connection="youtube"'));
  assert.ok(card.slice(0, card.indexOf('SPOTIFY')).includes('<DevPortalSetup'),
    'the YouTube card hand-rolls its own redirect box again');

  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  /* Sliced from a single line, because that file is CRLF. */
  const login = hook.slice(hook.indexOf('accounts.google.com/o/oauth2'));
  assert.ok(login.length > 100, 'the YouTube login no longer builds its own URL');
  /*
    Google hands back a refresh token only for offline access, and only when
    consent is asked for. Without both, a login works for an hour and then
    quietly stops.
  */
  assert.ok(login.includes("url.searchParams.set('access_type', 'offline');"),
    'the login does not ask for offline access, so it would get no refresh token');
  assert.ok(login.includes("url.searchParams.set('prompt', 'consent');"),
    'the login does not force consent, so a second one would get no refresh token');
  assert.ok(login.includes("url.searchParams.set('state', 'youtube');"),
    'nothing tells the callback which provider is returning');
});


test('a page served from a default port finds the backend behind it', () => {
  /*
    The API listens on its own port, so a page served straight off the server —
    a phone on the LAN at 192.168.1.201:8081 — finds it at that same host and
    port. But a page on a default port is behind something: a reverse proxy on
    443 with a real certificate, which is also where the socket is proxied.
    Adding :8081 to that guesses a port nothing is listening on and nothing
    could reach through the proxy anyway, so a public domain needed ?server= in
    the address to work at all.
  */
  const at = (protocol, hostname, port, search = '') => resolveServerUrl({ protocol, hostname, port, search }, {});
  assert.equal(at('https:', 'example.com', '').url, 'wss://example.com',
    'a proxied page still guesses at a port of its own');
  assert.equal(at('http:', 'example.com', '').url, 'ws://example.com');
  assert.equal(at('http:', '192.168.1.201', '8081').url, 'ws://192.168.1.201:8081',
    'a page served straight off the server stopped finding it');
  assert.equal(at('http:', 'localhost', '5173').url, 'ws://localhost:8081',
    'the dev server stopped pointing back at the API');
});

test('an address given once survives the round trip that drops it', () => {
  /*
    An OAuth sign-in leaves for the provider and comes back to a registered
    redirect carrying the provider's own query and nothing else. A dashboard
    opened at ?server=… returns without it, and would have to guess again —
    which for a proxied page used to mean guessing wrong and never finishing
    the exchange it went away to do.
  */
  const given = resolveServerUrl(
    { protocol: 'https:', hostname: 'example.com', port: '', search: '?server=wss://elsewhere.test' }, {},
  );
  assert.equal(given.url, 'wss://elsewhere.test', 'an explicit address is ignored');
  assert.equal(given.remember, 'wss://elsewhere.test', 'an explicit address is not remembered');

  const back = resolveServerUrl(
    { protocol: 'https:', hostname: 'example.com', port: '', search: '?code=abc&state=youtube' },
    { remembered: 'wss://elsewhere.test' },
  );
  assert.equal(back.url, 'wss://elsewhere.test', 'coming back, it forgot where the backend was');
  assert.equal(back.remember, null, 'it rewrote what it had only just read');
  /*
    And it reads no other stored key. It used to fall back to server_url,
    which the TikTok proxy setting writes — so setting a proxy pointed the
    whole app at it, and the next load could reach nothing at all.
  */
  const withLegacy = resolveServerUrl(
    { protocol: 'https:', hostname: 'example.com', port: '', search: '' },
    { legacy: 'https://a-tiktok-proxy.test' },
  );
  assert.equal(withLegacy.url, 'wss://example.com',
    'the resolver still reads a key another setting writes');
});

test('the browser side asks the shared rule rather than keeping its own', () => {
  const hook = fs.readFileSync(new URL('../../web/hooks/useBackend.ts', SCRIPT_URL), 'utf8');
  assert.ok(hook.includes('resolveServerUrl(window.location, {'),
    'the hook works the address out for itself again');
  assert.ok(!hook.includes('${API_PORT}`'), 'the old guess is still in the hook, so the two can disagree');
  assert.ok(hook.includes("localStorage.setItem(REMEMBERED, remember)"),
    'the address given in the query is no longer remembered');
});


test('the TikTok proxy and the app\u2019s own address do not share a key', () => {
  /*
    setTiktokProxyUrl wrote to server_url, which the backend resolver read to
    find the app's own server. So setting a TikTok proxy pointed the whole app
    at it, and the next load opened a socket to a proxy that speaks a different
    protocol entirely — silently, because the only symptom is not connecting.
  */
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  assert.ok(hook.includes("setTiktokProxyUrl: (v: string) => localStorage.setItem('tiktok_proxy_url', v)"),
    'the TikTok proxy writes to the shared key again');
  /* Read from the old one too, so a proxy set before this keeps working. */
  assert.ok(hook.includes("localStorage.getItem('tiktok_proxy_url') || localStorage.getItem('server_url')"),
    'a proxy set before this change is forgotten');

  const backend = fs.readFileSync(new URL('../../web/hooks/useBackend.ts', SCRIPT_URL), 'utf8');
  assert.ok(!backend.includes("read('server_url')"),
    'the backend resolver reads the key the TikTok proxy writes');
});


test('a platform that is connected says so on every screen', () => {
  /*
    YouTube was added to the HTTP status endpoint, which nothing in the app
    reads, and not to the snapshot every surface actually gets. So a signed-in
    account with a stored refresh token showed Offline for ever.
  */
  const ws = fs.readFileSync(new URL('../api/ws.js', SCRIPT_URL), 'utf8');
  const snapshot = ws.slice(ws.indexOf('status: {'), ws.indexOf('connections: buildConnections()'));
  for (const platform of ['twitch', 'tiktok', 'discord', 'obs', 'spotify', 'youtube']) {
    assert.ok(snapshot.includes(`${platform}:`), `the snapshot says nothing about ${platform}`);
  }

  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(app.includes("{ id: 'youtube', name: 'YouTube', icon: <PlatformMark platform=\"youtube\""),
    'the sidebar does not list YouTube among the connections');
});

test('a status is understood whether it arrives as a word or wrapped', () => {
  /*
    A snapshot carries the word itself — "connected" — while a live status
    event carries an object with it inside. Reading only the object meant every
    platform read as disconnected from the moment a page loaded until the next
    event happened to arrive. Spotify hid it by polling every three seconds;
    YouTube only speaks when something changes, so it stayed wrong until it did.
  */
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  assert.ok(hook.includes("const settled = (v: any) => (typeof v === 'string' ? v : v?.status) ?? 'disconnected';"),
    'the reader takes one shape again');
  for (const platform of ['tiktok', 'discord', 'obs', 'spotify', 'youtube']) {
    assert.ok(hook.includes(`${platform}: settled(s.${platform})`), `${platform} is read one way only`);
  }
  /* Twitch is the exception: it reports several connections inside one. */
  assert.ok(hook.includes("twitch: s.twitch?.main"), 'twitch stopped reading its own shape');
});


test('a signed-in YouTube card says whose account it is', () => {
  /*
    Every other card names the account: Discord shows the user, Spotify shows
    the user. YouTube said only that something was connected, and went on
    showing the setup fields — a form asking to be filled in again for
    something already done.
  */
  const yt = fs.readFileSync(new URL('../platforms/youtube.js', SCRIPT_URL), 'utf8');
  assert.ok(yt.includes('authorised: Boolean(tokens?.get().refreshToken)'),
    'the server no longer says whether the account is signed in');
  assert.ok(yt.includes('channel,'), 'the server no longer reports which channel');
  assert.ok(yt.includes("api('/channels?part=snippet&mine=true&maxResults=1')"),
    'nothing reads the channel name');

  /*
    And reading it must never be the reason chat does not start: a channel
    whose name cannot be read is still a channel whose chat can be.
  */
  const start = yt.slice(yt.indexOf('export async function start()'), yt.indexOf('const found = await findLiveChat();'));
  assert.ok(start.includes('try {') && start.includes('} catch (err) {'),
    'a name that cannot be read would stop the chat being read');

  const view = fs.readFileSync(new URL('../../web/components/views/ConnectionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('{youtubeAuthorised ? ('),
    'the card shows the same thing signed in or not');
  assert.ok(view.includes('{youtubeChannel?.title'), 'the card never names the channel');
});


test('a file already in a browser is not sent again', () => {
  /*
    Every response used to carry the bytes with nothing to say the file had not
    changed, so an overlay showing a clip on a follow alert re-downloaded the
    whole thing on every follow, on every surface drawing alerts at once.

    Measured: a second request carrying the tag answers 304 with no body, and
    the same request after the file is replaced answers 200 with the new one.
  */
  const src = fs.readFileSync(new URL('../api/http.js', SCRIPT_URL), 'utf8');
  const serve = src.slice(src.indexOf('function serveFile('));
  assert.ok(serve.includes('ETag: tag'), 'nothing identifies the version being sent');
  assert.ok(serve.includes("'Last-Modified'"), 'nothing says when it last changed');
  assert.ok(serve.includes('res.writeHead(304, headers);'), 'an unchanged file is sent again in full');

  /*
    Revalidation rather than a long life, because an uploaded file keeps its
    own name: replacing alert.gif writes over the old one at the same address,
    so a browser told to keep it for a year would show the old one for a year.
  */
  assert.ok(!serve.includes('immutable'), 'a file that can be replaced is marked unchangeable');
  assert.ok(serve.includes("freshFor > 0 ? `public, max-age=${freshFor}` : 'no-cache'"),
    'the freshness rule is gone');
});

test('everything that serves a file can answer a conditional request', () => {
  /*
    A caller that forgets the request loses the whole point — and, when it is
    the one serving the app itself, throws on every page load. Which it did.
  */
  const src = fs.readFileSync(new URL('../api/http.js', SCRIPT_URL), 'utf8');
  const calls = [...src.matchAll(/serveFile\(([^;]*?)\);/gs)].map((m) => m[1]);
  assert.ok(calls.length >= 4, `expected the callers, found ${calls.length}`);
  for (const call of calls) {
    assert.ok(call.includes('req'), `a caller does not pass the request: serveFile(${call.slice(0, 60)}…`);
  }

  /* Uploaded media is the one fetched over and over, so it skips even asking. */
  assert.ok(src.includes('{ req, freshFor: 30 }'), 'uploaded media revalidates on every single alert');
});

test('an alert can be given a clip, not only a picture', () => {
  /*
    The overlay has drawn video all along — it has a <video> branch for webm
    and mp4 — and the server has accepted those uploads all along. The file
    picker was the only thing that would not let one be chosen.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/AlertsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('accept="image/*,video/*"'), 'a clip cannot be chosen for an alert');

  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(overlay.includes('(webm|mp4)') && overlay.includes('const isVideo'),
    'the overlay stopped recognising a clip');
});


test('a clip keeps its own sound, and its own corners', () => {
  /*
    It was muted always, on the reasoning that an alert's audio was the
    soundUrl's job. But a clip somebody chose for its sound arriving silent is
    not a design, it is the clip not working — and the volume control applies
    to it, so the two are still one setting rather than two.
  */
  const src = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('muted={!playSound}'), 'a clip is muted whatever surface it is on');
  assert.ok(src.includes('el.volume = Math.min(1, Math.max(0, config.soundVolume ?? 1));'),
    'the volume control no longer reaches a clip');

  /*
    And a browser that refuses to start audio without a gesture must not cost
    the picture as well.
  */
  const fallback = src.slice(src.indexOf('el.play().catch('));
  assert.ok(fallback.includes('el.muted = true;'), 'a refused autoplay loses the clip entirely');

  /* Square: the corners of a clip are the clip's business. */
  assert.ok(src.includes("const mediaClass = 'object-contain shadow-2xl drop-shadow-2xl';"),
    'the media is rounded again, or has lost something else');
  assert.ok(!src.includes('rounded-2xl shadow-2xl'), 'the rounded corners are back');
  /* Spelled in pieces: the guard forbids the hook appearing outside a tag. */
  assert.ok(src.includes('data-alert=' + String.fromCharCode(34) + 'media'),
    'the media cannot be reached from a stylesheet');
});

test('only the surfaces meant for a stream are allowed to make a noise', () => {
  /*
    Nothing passed playSound at all, so an alert sound would never have played
    anywhere. The three surfaces that exist to be put in OBS pass it; the
    previews on the dashboard deliberately do not, or opening a screen would
    play a sound at whoever is sitting there.
  */
  const loud = ['../../web/App.tsx', '../../web/components/CanvasStage.tsx'];
  const quiet = [
    '../../web/components/views/AlertsView.tsx',
    '../../web/components/views/LibraryView.tsx',
    '../../web/components/views/ChatDockView.tsx',
  ];
  for (const rel of loud) {
    const src = fs.readFileSync(new URL(rel, SCRIPT_URL), 'utf8');
    const uses = [...src.matchAll(/<AlertOverlay[^>]*>/g)].map((m) => m[0]);
    assert.ok(uses.length > 0, `${rel} draws no alert at all`);
    for (const use of uses) {
      assert.ok(use.includes('playSound'), `a stream surface is silent: ${use.slice(0, 70)}`);
    }
  }
  for (const rel of quiet) {
    const src = fs.readFileSync(new URL(rel, SCRIPT_URL), 'utf8');
    for (const use of [...src.matchAll(/<AlertOverlay[^>]*>/g)].map((m) => m[0])) {
      assert.ok(!use.includes('playSound'), `a preview would make a noise: ${use.slice(0, 70)}`);
    }
  }
});


test('the library opens on its themes rather than on everything it has', () => {
  /*
    Every piece the app ships laid out at once is a wall rather than a shelf,
    and it gets worse with every theme added. Arriving shows the themes;
    opening one shows its pieces.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('const [openTheme, setOpenTheme]'), 'nothing remembers which theme is open');
  assert.ok(view.includes('{!searching && !open && ('),
    'the themes are not shown on their own, or are shown over a search');
  assert.ok(view.includes('const visible = searching ? themes : (open ? [open] : []);'),
    'everything is laid out at once again');
  /* And a way back out of one. */
  assert.ok(view.includes('data-library="back"'), 'there is no way back to the themes');
});

test('looking for a piece crosses every theme', () => {
  /*
    The cost of a drill-down is that "where is that panel" becomes a hunt
    through themes. So searching ignores which theme is open and puts them all
    on screen — browsing is by theme, finding is by search.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("const searching = q !== '' || filter !== 'all';"),
    'a search, or a kind, no longer widens to every theme');
  assert.ok(view.includes('data-library="search"'), 'there is nothing to search with');

  /*
    Across every theme, and across the motion in them too — there is no shelf
    left to be kept to. A motion turning up in a search is fine: it is shown
    under its own heading and still writes into its own box. What would not be
    fine is mixing it into the looks grid, which is what the split below stops.
  */
  // Every theme: the shipped ones and the streamer's own.
  assert.ok(view.includes('const themes = useMemo(() => [...CSS_LOOKS, ...mine], [mine]);'),
    'a search no longer reaches every theme');
  assert.ok(view.includes("const motion = objects.filter((o: any) => presetKind(o) === 'motion');")
    && view.includes("const still = objects.filter((o: any) => presetKind(o) !== 'motion');"),
    'a search mixes looks and motions into one grid, which are applied to different places');
});

test('a search answers to what a piece is called before what it is described as', () => {
  /*
    Several descriptions mention a panel in passing — "lay it on a panel" — so
    searching them for "panel" buried the four things actually named one under
    seven that were not. Measured before this: eleven hits, four of them real.
  */
  const view = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('const named = (o: any) =>') && view.includes('const described = (o: any) =>'),
    'names and descriptions are searched as one again');
  assert.ok(view.includes('const widened = Boolean(q) && byName === 0 && count(described) > 0;'),
    'descriptions are no longer a fallback, so either they are never searched or always are');
  /* And it says when it has widened, rather than quietly returning something else. */
  assert.ok(view.includes('libraryFoundInDescriptions'), 'a widened search does not say that it widened');
  /* A search that finds nothing says so rather than emptying the screen. */
  assert.ok(view.includes('data-library="nothing"'), 'a fruitless search leaves a blank screen');
});


test('the removed chat themes are gone from every list that offers them', () => {
  const constants = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  const row = fs.readFileSync(new URL('../../web/components/ChatMessageRow.tsx', SCRIPT_URL), 'utf8');
  for (const dead of ['horror', 'block']) {
    assert.ok(!constants.includes(`id: '${dead}'`), `the picker still offers "${dead}"`);
    assert.ok(!row.includes(`chatTheme === '${dead}'`), `the renderer still draws "${dead}"`);
  }
});

test('every collection a profile covers is one that actually exists', () => {
  // A group naming a collection nothing creates would snapshot nothing and
  // restore nothing, silently, for whichever part of the app it covered.
  const src = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8')
    + fs.readFileSync(new URL('../engine/discord-roles.js', SCRIPT_URL), 'utf8');
  for (const group of PROFILE_GROUPS) {
    for (const name of group.collections) {
      assert.ok(src.includes(`collection('${name}'`), `no collection named "${name}" is ever created`);
    }
  }
});

test('actions are written back before the dock buttons that reference them', () => {
  // Load-bearing. A dock button names an action by id and its validator DROPS
  // it when the action is missing, so writing buttons first loses every one of
  // them — silently, because dropping is the validator working as intended.
  const automation = PROFILE_GROUPS.find((g) => g.id === 'automation');
  const actions = automation.collections.indexOf('actions');
  const buttons = automation.collections.indexOf('dock_buttons');
  assert.ok(actions >= 0 && buttons >= 0, 'automation no longer covers both');
  assert.ok(actions < buttons, 'dock buttons are written before their actions and will all be dropped');
});

test('commands, actions and dock buttons share one profile', () => {
  // They reference each other in a chain: a button names an action, an action
  // names the command that triggers it. Split across profiles, switching one
  // breaks the others.
  const automation = PROFILE_GROUPS.find((g) => g.id === 'automation');
  assert.deepEqual(automation.collections, ['commands', 'actions', 'dock_buttons']);
});

test('nothing that accumulates is ever inside a profile', () => {
  // Levels, linked accounts and subscriber tenure are earned, not configured.
  // Switching a profile must never look like every viewer losing theirs.
  const forbidden = ['users', 'accounts', 'subscribers', 'event_history', 'xp_data'];
  for (const group of PROFILE_GROUPS) {
    for (const name of group.collections) {
      assert.ok(!forbidden.includes(name), `"${name}" accumulates and must not be profiled`);
    }
  }
});

test('no collection belongs to two groups at once', () => {
  const seen = new Set();
  for (const group of PROFILE_GROUPS) {
    for (const name of group.collections) {
      assert.ok(!seen.has(name), `"${name}" is in more than one group, so switching either would fight the other`);
      seen.add(name);
    }
  }
});

test('the unsaved marker watches every collection a profile covers', () => {
  // The marker is recomputed in ws.js when a broadcast touches a profiled key.
  // A group gaining a collection whose snapshot key is not in that list would
  // leave the marker stale for it — the edit lands, the bar still says saved.
  const ws = fs.readFileSync(new URL('../api/ws.js', SCRIPT_URL), 'utf8');
  const listed = [...ws.slice(ws.indexOf('PROFILED_KEYS')).matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
  // Snapshot keys are not always the collection name.
  const keyFor = {
    commands: 'commands', actions: 'streamActions', dock_buttons: 'dockButtons',
    alerts: 'alertConfigs', layouts: 'layouts', omnibar: 'omnibar', omnibars: 'omnibars', viewers: 'viewers',
    chat_settings: 'chatSettings',
  };
  for (const group of PROFILE_GROUPS) {
    for (const name of group.collections) {
      const key = keyFor[name];
      assert.ok(key, `no snapshot key is known for the profiled collection "${name}"`);
      assert.ok(listed.includes(key), `PROFILED_KEYS is missing "${key}", so the unsaved marker goes stale for ${name}`);
    }
  }
});

test('the editor offers a profile bar for exactly the groups that exist', () => {
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  const start = app.indexOf('PROFILE_GROUP_FOR_VIEW');
  const map = app.slice(start, app.indexOf('};', start));
  const offered = new Set([...map.matchAll(/:\s*'([a-z]+)'/g)].map((m) => m[1]));
  const real = new Set(PROFILE_GROUPS.map((g) => g.id));
  for (const id of offered) assert.ok(real.has(id), `the editor maps a view to "${id}", which is not a profile group`);
  for (const id of real) assert.ok(offered.has(id), `the group "${id}" exists but no screen offers it`);
});

test('the profile bar outranks the screen below it', () => {
  /*
    glass-panel carries a backdrop-filter, and that creates a stacking context.
    So the dropdown's own z-50 only ranked it against its siblings *inside* the
    bar: the view below is a later sibling with its own blur-made context, and
    with both at z-index auto the later one won on document order alone. The
    menu drew behind the chat dock panel however high its z-index went.

    Dropping `relative z-50` from the bar brings that straight back, and it
    looks like a tidy-up rather than a regression, which is why this is here.
  */
  const src = fs.readFileSync(new URL('../../web/components/ProfileSwitcher.tsx', SCRIPT_URL), 'utf8');
  const root = src.slice(src.indexOf('glass-panel rounded-2xl'));
  const openTag = root.slice(0, root.indexOf('>'));
  assert.ok(/relative/.test(openTag) && /z-50/.test(openTag),
    'the profile bar no longer raises itself, so its menu will draw behind the panel below');
});

test('discord is deliberately not profiled', () => {
  // It describes one server and does not change with what is being streamed.
  assert.ok(!PROFILE_GROUPS.some((g) => g.id === 'discord'), 'discord has profiles again');
});

test('profiles travel in a config export', () => {
  // Otherwise an export carries only whichever profile happened to be live.
  assert.ok(MANIFEST.some((e) => e.name === 'profiles'), 'the backup manifest has no profiles entry');
});

test('a group cannot hold an unbounded number of profiles', () => {
  assert.ok(MAX_PROFILES_PER_GROUP > 0 && MAX_PROFILES_PER_GROUP <= 50, String(MAX_PROFILES_PER_GROUP));
});

test('a first boot adopts the existing configuration rather than crying unsaved', () => {
  // The default profile starts empty while the collections are already full of
  // a real setup, so without adopting it every group reports unsaved changes
  // before the user has touched anything.
  const src = fs.readFileSync(new URL('../engine/profiles.js', SCRIPT_URL), 'utf8');
  const init = src.slice(src.indexOf('export function initProfiles'), src.indexOf('Read every collection'));
  assert.ok(init.includes('captureActive(group.id)'), 'initProfiles no longer adopts the current configuration');
  assert.ok(init.includes('Object.keys(active.data || {}).length === 0'),
    'the adoption is no longer guarded to empty profiles and could overwrite a saved one');
});


{
  const saved = engine.store.setViewers({ mode: 'platforms', platforms: { twitch: true, youtube: false } });
  const kept = engine.store.setViewers({ mode: 'platforms' });
  const counter = fs.readFileSync(new URL('../../web/components/ViewerCount.tsx', SCRIPT_URL), 'utf8');
  const page = fs.readFileSync(new URL('../../web/components/views/ViewersView.tsx', SCRIPT_URL), 'utf8');
  const yt = fs.readFileSync(new URL('../platforms/youtube.js', SCRIPT_URL), 'utf8');
  test('the viewer counter counts YouTube too, and drops it when YouTube is not live', () => {
    assert.equal(saved.platforms.youtube, false);
    assert.equal(kept.platforms.youtube, true, 'YouTube is not counted unless asked');
    assert.ok(counter.includes("key: 'youtube'") && counter.includes('stats?.youtubeViewers'), 'the counter has no YouTube row');
    assert.ok(page.includes("(['twitch', 'youtube', 'tiktok'] as const)"), 'the Viewers page has no YouTube switch');
    assert.ok(yt.includes("bus.emit(EVENTS.STAT, { key: 'youtubeLive', value: false });"), 'YouTube stays live after it stops');
    assert.ok(yt.includes('const live = !details.actualEndTime;'), 'an ended broadcast still counts as live');
  });
}
