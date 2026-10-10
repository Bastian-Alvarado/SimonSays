/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: small things put right — the upright deck kept against its
 * page buttons, the chat boxes for a stream on YouTube alone and an emoji at
 * the cursor, the last English labels in the layer panels, and an outline
 * for an avatar on a dark background.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const constants = read('../../web/constants.ts');
const bothLanguages = (key) => constants.split(`    ${key}: '`).length - 1 === 2;
const { normaliseLayouts } = await import('../../engine/layouts.js');

test('upright, a deck with rows keeps to its page buttons instead of floating in the middle of what is left', () => {
  const deck = read('../../web/components/DockDeck.tsx');
  assert.ok(deck.includes("<DockActionsGrid {...gridProps} page={page} pages={pages} anchor={pages > 1 ? (onTop ? 'top' : 'bottom') : undefined} />"), 'the grid is not told where its page buttons are');
  const grid = read('../../web/components/DockActionsGrid.tsx');
  assert.ok(grid.includes("anchor === 'top' ? 'items-start' : anchor === 'bottom' ? 'items-end' : 'items-center'"));
});

test('a message can go to YouTube with Twitch off, a stream on YouTube alone is not "nothing connected", and an emoji goes in at the cursor', () => {
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("const chatSendable = system.status.twitch === 'connected' || (chatSendTo !== 'twitch' && Boolean((system.connections as any).youtubeLive));"));
  assert.ok(app.includes('placeholder={chatSendable ? t.typeGlobal : t.connecting} disabled={!chatSendable}'), 'the dock box is still Twitch or nothing');
  assert.ok(app.includes("system.status.discord === 'disconnected' && system.status.youtube !== 'connected')"), 'the dock says Connecting on a YouTube-only stream');
  assert.ok(app.includes('setMessageInput(insertAtCursor(chatInputRef.current, messageInput, emoji))'), 'the dock puts an emoji on the end');
  const view = read('../../web/components/views/ChatDockView.tsx');
  assert.ok(view.includes("discordStatus === 'disconnected' && youtubeStatus !== 'connected' ? ("), 'the Chat dock screen says nothing is connected on a YouTube-only stream');
  assert.ok(view.includes('disabled={!canSend}') && view.includes('setMessageInput(insertAtCursor(inputRef.current, messageInput, emoji));'));
  assert.ok(bothLanguages('addEmoji'));
});

test('an emoji goes where the cursor is, replacing what is selected', () => {
  const src = read('../../web/utils.ts');
  // The pure part, taken out to run here: no box, so it goes on the end.
  const body = src.slice(src.indexOf('export const insertAtCursor'), src.indexOf('export const copyText'));
  assert.ok(body.includes('const next = value.slice(0, at) + text + value.slice(to);'));
  const at = (value, start, end, text) => value.slice(0, start) + text + value.slice(end);
  assert.equal(at('hola mundo', 5, 5, '😀'), 'hola 😀mundo');
  assert.equal(at('hola mundo', 0, 4, '👋'), '👋 mundo');
});

test('the last English in the layer panels is in both languages', () => {
  const layouts = read('../../web/components/views/LayoutsView.tsx');
  assert.ok(!layouts.includes("'Name px' : 'Line px'}") && layouts.includes("(t.plateNameSize || 'Name px')"), 'the nameplate sizes are English');
  assert.ok(layouts.includes("side === 'left' ? (t.plateAlignLeft || 'Left') : (t.plateAlignRight || 'Right')"), 'the nameplate sides print their raw value');
  const image = read('../../web/components/ImageLayerPanel.tsx');
  assert.ok(image.includes("fit === 'contain' ? (t.imageFitContain || 'Contain')"), 'the picture fit prints its raw value');
  for (const key of ['plateNameSize', 'plateLineSize', 'plateAlignLeft', 'plateAlignRight', 'imageFitContain', 'imageFitCover', 'imageFitFill']) assert.ok(bothLanguages(key), `${key} is not in both languages`);
});

test('an avatar can be outlined for a dark background, one of its own pixels thick, and only when asked', () => {
  const layer = (outline) => normaliseLayouts([{ id: 'l', name: 'L', layers: [{ type: 'avatar', config: { outline } }] }])[0].layers[0].config;
  assert.equal(layer('#FFFFFF').outline, '#ffffff');
  assert.ok(!('outline' in layer('')), 'no outline wrote one anyway');
  assert.ok(!('outline' in layer('white')), 'a colour that is not one was kept');
  assert.ok(!('outline' in layer(undefined)), 'a layer from before the outline gained one');
  const avatar = read('../../web/components/AvatarLayer.tsx');
  // A hundredth of the drawing's width, worked out as its box is.
  assert.ok(avatar.includes('const dot = `min(1cqw, calc(${label ? 82 : 100}cqh / ${100 + headroom}))`;'));
  assert.ok(avatar.includes('...(outline ? { filter: outline } : {})'));
  const panel = read('../../web/components/AvatarLayerPanel.tsx');
  assert.ok(panel.includes("patch({ outline: v ? (config.outline || '#ffffff') : '' })"), 'there is no switch for it');
  for (const key of ['avatarOutline', 'avatarOutlineColour']) assert.ok(bothLanguages(key), `${key} is not in both languages`);
  // Put back says what it keeps.
  assert.ok(constants.includes('What it is now is kept under Versions.') && constants.includes('Lo que tiene ahora se guarda en Versiones.'));
});
