/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: each chat on stream is a layer that keeps its own settings.
 *
 * There used to be one shared chat set, edited on a Chat overlay screen and
 * switched by a chat profile, which every chat layer drew with — and which a
 * layer could quietly override with a look of its own, beating the screen
 * with nothing to say so. Now a chat layer keeps its whole set, the Library
 * dresses it like any other layer, and it changes with the overlay profile.
 * A layer from before is filled out from the shared chat it was drawn with,
 * so nothing on stream moves.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const { normaliseChatLayer, isWholeChat, cleanChatSettings, DEFAULT_CHAT } = await import('../../engine/chat-settings.js');
const { CHAT_DEFAULTS, CHAT_PAGE_KEYS } = await import('../../../shared/chat-style.js');
const { ALL_PRESETS } = await import('../../../shared/css-presets.js');
const apply = await import('../../../shared/theme-apply.js');
const { normaliseLayouts } = await import('../../engine/layouts.js');
const preset = (id) => ALL_PRESETS.find((p) => p.id === id);

// The chat the layouts used to share, as it might have been left.
const SHARED = cleanChatSettings({
  ...DEFAULT_CHAT, chatTheme: 'custom', fontSize: 31, showAvatars: true,
  css: preset('cyber-chat').css, motionCss: preset('cyber-line-draw').css,
  transparentBackground: true, dockBackgroundColor: '#123456', migrated: true,
}, DEFAULT_CHAT);

// ------------------------------------------------------- filling one out

test('a chat layer that held nothing takes the whole of the chat it was drawn with', () => {
  const filled = normaliseChatLayer({}, SHARED);
  assert.ok(isWholeChat(filled));
  for (const key of Object.keys(CHAT_DEFAULTS)) {
    if (CHAT_PAGE_KEYS.includes(key)) continue;
    assert.deepEqual(filled[key], SHARED[key], `${key} did not come from the chat it was drawn with`);
  }
});

test('one that held only a look keeps its look, and takes the rest — so it draws exactly as it did', () => {
  /*
    What a Library apply used to leave on a layer: a theme and a stylesheet
    that beat the shared chat. On stream it was drawn with those over the
    shared rest, motion included; filled out, it is the same chat.
  */
  const own = { chatTheme: 'custom', css: preset('simonsays-chat').css };
  const filled = normaliseChatLayer(own, SHARED);
  assert.equal(filled.css, own.css, 'the layer lost its own look');
  assert.equal(filled.motionCss, SHARED.motionCss, 'the motion it was drawn with is gone');
  assert.equal(filled.fontSize, 31);
  assert.equal(filled.showAvatars, true);
});

test('a whole set is its own, and nothing shared is laid over it', () => {
  const whole = normaliseChatLayer({ ...CHAT_DEFAULTS, fontSize: 18, css: '' }, SHARED);
  assert.equal(whole.fontSize, 18);
  assert.equal(whole.css, '', 'the shared look reached a chat that has its own settings');
  assert.equal(whole.showAvatars, false);
});

test('a chat layer keeps nothing of the dock\'s page: no background colour, no migration mark', () => {
  const filled = normaliseChatLayer({}, SHARED);
  for (const key of [...CHAT_PAGE_KEYS, 'migrated']) assert.ok(!(key in filled), `a chat layer kept ${key}`);
  // And a layout save is where that happens.
  const saved = normaliseLayouts([{ id: 'x', layers: [{ type: 'chat', uid: 'c', config: { ...CHAT_DEFAULTS, transparentBackground: true } }] }])[0].layers[0].config;
  assert.ok(!('transparentBackground' in saved), 'a layout save keeps the dock\'s page settings on a chat layer');
});

// --------------------------------------------------- the Library's look

test('a Library chat look applied to a layout survives the save: its stylesheet, and the theme that reads it', () => {
  const layout = { id: 'lib', name: 'Lib', layers: [{ uid: 'c', type: 'chat', config: normaliseChatLayer({}, SHARED) }] };
  const changes = apply.piecePlan(preset('simonsays-chat'), layout, []);
  const saved = normaliseLayouts([apply.withChanges(layout, changes, 'to')])[0].layers[0].config;
  assert.equal(saved.css, preset('simonsays-chat').css, 'the look was dropped on the way in');
  assert.equal(saved.chatTheme, 'custom');
  assert.equal(saved.fontSize, 31, 'applying a look reset the rest of the chat');
});

// ------------------------------------- a backup, or a profile, from before

const original = engine.exportConfig();
const OWN = ':scope { --ink: #abcdef; }';
const old = structuredClone(original);
old.collections.chat_settings = SHARED;
old.collections.layouts = [
  { id: 'old-a', name: 'Old A', width: 1920, height: 1080, layers: [{ type: 'chat', uid: 'chat-a', x: 0, y: 0, width: 400, height: 600, config: {} }] },
];
old.collections.profiles = {
  ...(original.collections.profiles || {}),
  overlays: {
    active: 'old-live',
    profiles: [
      { id: 'old-live', name: 'Live', data: { ...(original.collections.profiles?.overlays?.profiles?.[0]?.data || {}), layouts: structuredClone(old.collections.layouts) } },
      { id: 'old-other', name: 'Other', data: { layouts: [{ id: 'old-b', name: 'Old B', width: 1920, height: 1080, layers: [{ type: 'chat', uid: 'chat-b', config: { chatTheme: 'custom', css: OWN } }] }] } },
    ],
  },
  // A chat group, from when there was one.
  chat: { active: 'default', profiles: [{ id: 'default', name: 'Main', data: { chat_settings: SHARED } }] },
};
engine.importConfig(old);
const liveChat = engine.store.getLayouts().find((l) => l.id === 'old-a').layers[0].config;
const { getCollection } = await import('../../core/store.js');
const savedOverlays = getCollection('profiles').get().overlays.profiles;
const otherChat = savedOverlays.find((p) => p.id === 'old-other').data.layouts[0].layers[0].config;
const liveSaved = savedOverlays.find((p) => p.id === 'old-live').data.layouts[0].layers[0].config;
engine.importConfig(original);

test('restoring a backup from before fills its chat layers from the chat it carries', () => {
  assert.ok(isWholeChat(liveChat), 'a restored chat layer still leans on a shared chat nothing edits');
  assert.equal(liveChat.fontSize, 31);
  assert.equal(liveChat.css, SHARED.css);
});

test('and its saved overlay profiles too, each keeping its own look', () => {
  assert.ok(isWholeChat(otherChat), 'a saved profile\'s chat layer was left leaning on the shared chat');
  assert.equal(otherChat.css, OWN, 'a saved profile\'s own chat look was replaced');
  assert.equal(otherChat.fontSize, 31);
  // The active profile's saved copy filled the same way as what is live, so it does not read as unsaved for nothing.
  assert.deepEqual(liveSaved, liveChat, 'the active profile\'s saved copy differs from what is live');
});

test('the same is done on every boot, before the profiles are read', () => {
  const src = read('../engine/index.js');
  const upgrade = src.indexOf('const chatLayersBehind = chatBehind(db.layouts.get());');
  const init = src.indexOf('profiles.initProfiles({');
  const saved = src.indexOf("const savedChatBehind = profiles.rewriteSaved('overlays', 'layouts',");
  assert.ok(upgrade > 0 && upgrade < init, 'the live chat layers are not filled before the profiles compare them');
  assert.ok(saved > init, 'the saved profiles are not filled once they are loaded');
  // And every save fills from the same place, set before anything saves.
  assert.ok(src.indexOf('setChatFallback(() => db.chat.get());') < src.indexOf('store.setDockButtons(db.dockButtons.get());'), 'a layout can be saved before it knows what to fill a chat from');
});

// ----------------------------------------------------------- the screen

test('a chat layer has its settings on the Overlays screen, and can give every layout the same', () => {
  const view = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(view.includes("{layer.type === 'chat' && (\n        <ChatLayerPanel"), 'a chat layer shows no settings');
  assert.ok(/const HAS_OWN = \[[^\]]*'chat'/.test(view), 'a chat layer says it has nothing of its own to set');
  // Every other layout's chat takes this one's settings, and keeps its own place.
  const share = view.slice(view.indexOf('const shareChat = '), view.indexOf('const shareChat = ') + 600);
  assert.ok(share.includes("(y.type === 'chat' ? { ...y, config: { ...settings } } : y)"), 'sharing moves the chats, or does not share their settings');
  // Asked first: it replaces somebody's work on every other layout.
  const panel = read('../../web/components/ChatLayerPanel.tsx');
  const ask = panel.indexOf('data-chat-layer-share-ask');
  const go = panel.indexOf('data-chat-layer-share-go');
  assert.ok(ask > 0 && go > ask && panel.slice(ask, go).includes('{asking && ('), 'the settings on every layout are replaced without asking');
  // A chat added to a layout starts as the profile's chat already looks.
  assert.ok(view.includes("const chatLike = type === 'chat'"), 'a new chat starts as a chat nobody chose');
});

test('the chat layer\'s words are in both languages', () => {
  const strings = read('../../web/constants.ts');
  for (const key of ['chatLayerHelp', 'chatCssTravelsLayer', 'chatLayerShareNone', 'chatLayerShareSame', 'chatLayerShareDiffer', 'chatLayerShare', 'chatLayerShareConfirm', 'chatLayerShareGo', 'chatLayerShareDone']) {
    assert.equal(strings.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
  for (const gone of ['chatOverlayNav', 'chatOverlayHelp', 'profileGroupChat', 'libraryOptChat', 'chatDockHelp', 'chatThemes', 'autoHide', 'autoHideHelp']) {
    assert.ok(!strings.includes(`    ${gone}: '`), `${gone} is still there with nothing to say it`);
  }
});

test('a chat layer\'s looks are named in both languages, and hiding old messages is a switch', () => {
  const panel = read('../../web/components/ChatLayerPanel.tsx');
  // The theme list's own names are English; the panel names each look itself, with what it is.
  assert.ok(!panel.includes('.name}') && panel.includes('CHAT_THEMES.map(({ id })'), 'a look is named in English only');
  for (const id of ['Modern', 'Compact', 'Retro', 'Custom']) {
    assert.ok(panel.includes(`t.chatTheme${id} ||`) && panel.includes(`t.chatTheme${id}Hint ||`), `${id} has no name or no line saying what it is`);
  }
  // On is a length of time to start from; off is 0, which the stream reads as never.
  assert.ok(panel.includes('patch({ autoHideSeconds: on ? HIDE_AFTER : 0 })'), 'the switch does not turn hiding on and off');
  const hiding = panel.indexOf('{hiding && (');
  assert.ok(hiding > 0 && panel.indexOf("set('autoHideSeconds')") > hiding && panel.indexOf("set('autoHideFadeMs')") > hiding, 'how long and how softly are not under the switch');
  assert.ok(panel.includes("s.fold('old'") && panel.includes('</>, hiding)}'), 'a folded section does not say hiding is on');
});
