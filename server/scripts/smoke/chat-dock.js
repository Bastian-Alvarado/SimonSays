/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the chat dock. Emotes after an emoji, YouTube's events in the
 * chat, the words an event line uses on stream, event lines that fade like
 * messages, a message that did not go saying why, and what the dock no
 * longer offers.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, normaliseEvent, test } from './harness.js';
import { splitEmotes } from '../../../shared/emotes.js';
import * as twitch from '../../platforms/twitch.js';
import { chatLayer } from './profiles-and-chat.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const APP = read('../../web/App.tsx');
const HOOK = read('../../web/hooks/useStreamSystem.ts');
const CONSTANTS = read('../../web/constants.ts');
const ROW = read('../../web/components/ChatMessageRow.tsx');
const DOCK_SCREEN = read('../../web/components/views/ChatDockView.tsx');
// What both chat menus are built from, and the sections they share.
const PARTS = read('../../web/components/ChatSettingParts.tsx');
// A chat layer's panel, on the Overlays screen.
const LAYER_PANEL = read('../../web/components/ChatLayerPanel.tsx');
// And the dock's own page, on its screen.
const DOCK_SETTINGS = read('../../web/components/ChatDockSettings.tsx');

// ------------------------------------------------------------------ emotes

test('an emote after an emoji is cut where Twitch says, not a character late', () => {
  // Twitch counts "😀 Kappa" as seven characters, so Kappa is 2-6.
  assert.deepEqual(splitEmotes('😀 Kappa', { 25: ['2-6'] }), [{ text: '😀 ' }, { emote: '25', name: 'Kappa' }]);
  assert.deepEqual(
    splitEmotes('🔥🔥 LUL y PogChamp!', { 425618: ['3-5'], 305954156: ['9-16'] }).map((p) => p.name || p.text),
    ['🔥🔥 ', 'LUL', ' y ', 'PogChamp', '!'],
  );
  assert.deepEqual(splitEmotes('Kappa hola Kappa', { 25: ['0-4', '11-15'] }).map((p) => p.name || p.text), ['Kappa', ' hola ', 'Kappa']);
  // A range running off the end of the message is not this message's.
  assert.deepEqual(splitEmotes('hola', { 1: ['2-9'] }), [{ text: 'hola' }]);
  assert.deepEqual(splitEmotes('hola', undefined), [{ text: 'hola' }]);
  assert.ok(read('../../web/utils.ts').includes('splitEmotes(msg, emotes)'), 'the chat cuts emotes its own way again');
});

// ---------------------------------------------------- YouTube events in chat

const dockBefore = engine.store.getChatDockSettings();
const onStream = chatLayer({ fontSize: 16, eventPlatforms: { twitch: true, tiktok: false } });
const dockOff = engine.store.setChatDockSettings({ eventPlatforms: { youtube: false }, migrated: true });
engine.store.setChatDockSettings(dockBefore);

test('YouTube events can show in the chat, and Discord has no switch that did nothing', () => {
  assert.deepEqual(onStream.eventPlatforms, { twitch: true, youtube: true, tiktok: false }, 'YouTube is off unless asked for');
  assert.equal(dockOff.eventPlatforms.youtube, false, 'YouTube cannot be switched off');
  // Settings saved before YouTube was a choice never mention it, which has to read as on.
  assert.ok(CONSTANTS.includes("export const CHAT_EVENT_PLATFORMS = ['twitch', 'youtube', 'tiktok'] as const;"));
  assert.ok(CONSTANTS.includes('prefs?.[platform] !== false'), 'a saved setting that never mentions YouTube hides it');
  assert.ok(HOOK.includes('if (!chatEventsOn(eventPlatformsRef.current, ev?.platform)) return;'));
  assert.ok(PARTS.includes('CHAT_EVENT_PLATFORMS.map(') && PARTS.includes('YouTubeIcon'), 'the settings have no YouTube switch');
  assert.ok(!PARTS.includes('DiscordIcon') && !DOCK_SCREEN.includes('DiscordIcon'), 'the Discord switch is still there');
  // A fifty-sub bomb is one line, not fifty-one.
  assert.ok(HOOK.includes("if (ev?.type === 'twitch_sub' && ev?.data?.fromBulk) return;"));
});

// ------------------------------------------------------------- the words

test('every event line has words of its own, in both languages, and in Spanish on stream', () => {
  for (const type of ['youtube_cheer', 'youtube_sub', 'youtube_sub_gift_bulk', 'twitch_sub_gift_bulk', 'twitch_sub', 'twitch_cheer', 'twitch_raid']) {
    assert.ok(ROW.includes(`case '${type}':`), `${type} is still just "Event"`);
  }
  assert.ok(!ROW.includes('(Tier ${') && !ROW.includes(' bits)`') && !ROW.includes(' viewers)`') && !ROW.includes("return 'Event'"), 'English is still written into event lines');
  for (const key of ['chatEventTier', 'chatEventGiftFrom', 'chatEventGiftedSubs', 'chatEventBits', 'chatEventViewers', 'chatEventNewMember', 'chatEventMemberMonths', 'chatEventGiftedMemberships', 'chatEventOther']) {
    assert.equal(CONSTANTS.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
  assert.ok(ROW.includes('const words: any = onStream ? TRANSLATIONS.es : t;'), 'the stream takes this device\'s language');
  assert.ok(read('../../web/components/CanvasStage.tsx').includes('          onStream\n'), 'a chat layer does not know it is on stream');
  assert.ok(APP.includes('onStream={false}'), 'the dock speaks the stream\'s language instead of this device\'s');
});

// ------------------------------------------------------- lines that fade

const stamped = normaliseEvent({ type: 'twitch_follow', platform: 'twitch', user: 'x' });

test('an event line carries when it happened, so it fades on stream like a message', () => {
  assert.equal(typeof stamped.timestamp, 'number', 'events carry no time');
  assert.ok(HOOK.includes('const at = Number(ev.timestamp) || Date.now();'));
  assert.ok(/\n\s+at,\r?\n\s+avatar: ev\.avatar,/.test(HOOK), 'the event line is not given its time');
});

// ---------------------------------------------------------------- sending

const outcome = {};
for (const [name, text, opts] of [
  ['command', '/ban alguien', {}],
  ['me', '/me saluda', {}],
  ['long', 'a'.repeat(501), {}],
  ['main', 'hola', {}],
  ['bot', 'hola', { useBot: true }],
]) {
  try {
    await twitch.sayFromDock(text, opts);
    outcome[name] = 'sent';
  } catch (err) {
    outcome[name] = err.code || err.message;
  }
}

test('a message the dock cannot send says why, instead of vanishing', () => {
  assert.equal(outcome.command, 'twitch_command', 'a /command Twitch will eat is sent anyway');
  assert.equal(outcome.me, 'twitch_offline', '/me is refused as a command');
  assert.equal(outcome.long, 'too_long');
  assert.equal(outcome.main, 'twitch_offline');
  assert.equal(outcome.bot, 'bot_offline', 'the bot quietly falls back to the main account');
  const ws = read('../api/ws.js');
  assert.ok(ws.includes('twitch.sayFromDock(text, { useBot: payload.useBot })'), 'the dock still sends through the quiet say()');
  assert.ok(ws.includes('...(err.code ? { code: err.code } : {})'), 'the reason is lost on the way back');
  assert.ok(read('../../web/hooks/useBackend.ts').includes('if (msg.payload?.code) err.code = msg.payload.code;'));
  assert.ok(HOOK.includes('return request(C2S.SEND_CHAT'), 'the send is not awaited');
  assert.ok(APP.includes('setMessageInput((now: string) => (now ? now : text));'), 'a failed message is not put back');
  for (const key of ['sendErrorCommand', 'sendErrorOffline', 'sendErrorBotOffline', 'sendErrorTooLong', 'sendErrorOther']) {
    assert.equal(CONSTANTS.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
  assert.ok(APP.includes('data-dock="send-error"') && DOCK_SCREEN.includes('{sendError && <p role="alert"'), 'the reason is never shown');
});

// ------------------------------------------------------- what it dropped

test('the dock has no stop-speaking button, and its emoji picker offers no Discord emojis', () => {
  assert.ok(!APP.includes('speechSynthesis?.cancel()') && !CONSTANTS.includes('stopSpeech'), 'the stop button is back');
  const dock = APP.slice(APP.indexOf("if (mode === 'dock') { return ("));
  const picker = dock.slice(dock.indexOf('<EmojiPicker'), dock.indexOf('/></>)}'));
  assert.ok(picker.startsWith('<EmojiPicker') && !picker.includes('customEmojis'), 'the dock offers Discord emojis it would post to Twitch as text');
  assert.ok(!DOCK_SCREEN.includes('customEmojis'), 'the settings preview offers Discord emojis');
});

// ------------------------------------------------- which platforms say what

test('the rank settings name every platform that reports the rank', () => {
  const rank = (key) => (CONSTANTS.match(new RegExp(`key: '${key}'[^}]*platforms: '([^']*)'`)) || [])[1];
  assert.equal(rank('broadcaster'), 'Twitch · YouTube');
  assert.equal(rank('moderator'), 'Twitch · YouTube · TikTok');
  assert.equal(rank('vip'), 'Twitch', 'YouTube and TikTok have no VIPs');
  assert.equal(rank('subscriber'), 'Twitch · YouTube · TikTok');
  // Because YouTube does report them: owner, moderator, member.
  const yt = read('../platforms/youtube.js');
  for (const flag of ['isMod: Boolean(author.isChatModerator)', 'isSub: Boolean(author.isChatSponsor)', 'isBroadcaster: Boolean(author.isChatOwner)']) {
    assert.ok(yt.includes(flag), `YouTube no longer sends ${flag.split(':')[0]}`);
  }
});

// ------------------------------------------- the dock is Marathon, always

const { DOCK_CHAT_CSS, ALL_PRESETS } = await import('../../../shared/css-presets.js');
const { inkFor } = await import('../../../shared/chat-style.js');
const dockSaved = engine.store.getChatDockSettings();
const pinned = engine.store.setChatDockSettings({ migrated: true, chatTheme: 'retro', css: '[data-chat="row"] { color: red }', motionCss: '.x {}' });
engine.store.setChatDockSettings(dockSaved);

test('the dock is always the Marathon chat, and keeps no stylesheet of its own', () => {
  assert.equal(pinned.chatTheme, 'custom', 'the dock took a theme');
  assert.equal(pinned.css, '', 'the dock kept a stylesheet');
  assert.equal(pinned.motionCss, '');
  // Only a chat layer is offered a stylesheet or a theme list; the dock says what it wears.
  assert.ok(LAYER_PANEL.includes("{custom && s.fold('sheet'"), 'a chat layer offers its stylesheet under every look, or not at all');
  assert.ok(DOCK_SCREEN.includes('<ChatDockSettings ') && !DOCK_SCREEN.includes('<ChatLayerPanel'), 'the dock screen shows a chat layer\'s controls');
  // Neither the dock's page nor what both menus share has a theme list or a stylesheet: those are a layer's.
  for (const [name, src] of [['the dock', DOCK_SETTINGS], ['the shared sections', PARTS]]) {
    assert.ok(!src.includes('CHAT_THEMES') && !src.includes('StylesheetPanel'), `${name} offers a theme list or a stylesheet`);
  }
  assert.ok(DOCK_SETTINGS.includes('t.dockIntro ||') && CONSTANTS.split("    dockIntro: '").length - 1 === 2, 'the dock does not say what it wears, in both languages');
});


test('words on a chip are whichever of black and white reads', () => {
  assert.equal(inkFor('#ffffff'), '#09090b');
  assert.equal(inkFor('#00ff88'), '#09090b');
  assert.equal(inkFor('#fff'), '#09090b');
  assert.equal(inkFor('#0000FF'), '#ffffff', 'dark words on navy');
  assert.equal(inkFor('#8205B3'), '#ffffff', 'dark words on the Twitch subscriber purple');
  assert.equal(inkFor('#09090b'), '#ffffff');
  assert.equal(inkFor('red'), undefined);
  assert.equal(inkFor(''), undefined);
});

test('no other screen draws the dock\'s chat settings', () => {
  /*
    The editor used to be aimed at the dock while its screen was open, and had
    to be handed back to the overlay's chat on the way out, or the Overlays
    editor drew the dock's settings. There is nothing to aim now: the dock's
    are the only settings the hook holds, and a chat layer is drawn from its own.
  */
  assert.ok(!HOOK.includes('chatTarget') && !DOCK_SCREEN.includes('setChatTarget'), 'the editor is aimed somewhere again');
  const stage = read('../../web/components/CanvasStage.tsx');
  const chatCase = stage.slice(stage.indexOf("case 'chat':"), stage.indexOf("case 'runcard':"));
  assert.ok(!chatCase.includes('system.settings'), 'a chat layer draws the dock\'s settings');
});

// ------------------------------------------------------------ the dock's settings page

test('the dock\'s settings fold into sections, in the order they are reached for, and remember which are open', () => {
  const order = ['{s.size}', '{s.shows}', '{s.text}', '{s.box}', '{s.ranks}', '{s.events}', '{s.motion}', "s.fold('background'"];
  const at = order.map((s) => DOCK_SETTINGS.indexOf(s));
  assert.ok(at.every((n) => n > 0), `a section is missing: ${order[at.indexOf(-1)]}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'the sections are out of order');
  for (const id of ['size', 'shows', 'text', 'box', 'ranks', 'events', 'motion']) {
    assert.ok(PARTS.includes(`const ${id} = fold('${id}'`), `the shared ${id} section is gone`);
  }
  assert.ok(PARTS.includes('localStorage.setItem(key, JSON.stringify(next))'), 'which sections are open is forgotten');
  assert.ok(PARTS.includes("return Array.isArray(saved) ? saved : ['size'];"), 'a first visit opens nothing, or everything');
  // Each menu remembers its own, so opening one does not open the other.
  assert.ok(DOCK_SETTINGS.includes("storageKey: 'chat_dock_sections'") && LAYER_PANEL.includes("storageKey: 'chat_layer_sections'"), 'the two menus share which sections are open');
});

test('a switch and what it brings sit together, on the dock\'s page and a chat layer\'s', () => {
  const after = (a, b) => PARTS.indexOf(b) > PARTS.indexOf(a) && PARTS.indexOf(b) - PARTS.indexOf(a) < 900;
  assert.ok(after("on={Boolean(v.showAvatars)}", "set('avatarShape')"), 'the avatar shape is not under the avatar switch');
  assert.ok(after('on={timeOn}', "set('timestampFormat')"), 'the clock is not under the time switch');
  assert.ok(after("on={Boolean(v.showEvents)}", 'CHAT_EVENT_PLATFORMS.map('), 'the event platforms are not under the events switch');
  assert.ok(after("set('outlineWidth')", "set('outlineColor')"), 'the outline colour is not beside the outline');
});

test('the dock\'s page offers only what does something on the dock, each choice in both languages', () => {
  // The dock never hides old messages; that is the overlay's, and only a chat layer's panel offers it.
  assert.ok(!DOCK_SETTINGS.includes('autoHide') && !PARTS.includes('autoHide'), 'the dock offers auto-hide, which does nothing there');
  // One switch, not three kinds of toggle.
  for (const src of [DOCK_SETTINGS, PARTS, LAYER_PANEL]) {
    assert.ok(!src.includes('<EyeOff') && !src.includes('<Ghost') && !src.includes('<Check '), 'the toggles are not all one switch');
  }
  assert.ok(PARTS.includes('role="switch"'));
  // Every word on a choice goes through the translations.
  for (const word of ["'Name above'", "'As typed'", "'12 hour'", "'Pop in'", "'Before the name'", "'Circle'"]) {
    const i = PARTS.indexOf(word);
    assert.ok(i > 0 && PARTS.slice(i - 30, i).includes('t.chat'), `${word} is not translated`);
  }
  assert.ok(DOCK_SETTINGS.includes("word: t.dockDefault || 'Default'") && LAYER_PANEL.includes("word: t.chatThemeReset || 'Theme'"), 'putting a value back is not said in both languages');
  for (const src of [DOCK_SETTINGS, PARTS, LAYER_PANEL]) {
    for (const key of [...new Set([...src.matchAll(/t\.((?:dock|chat)[A-Za-z0-9]+)/g)].map((m) => m[1]))]) {
      assert.equal(CONSTANTS.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
    }
  }
  // Pop out lives with the link, not floating over the preview.
  assert.ok(DOCK_SETTINGS.includes('data-dock-popout') && !DOCK_SCREEN.includes("window.open(dockUrl"), 'pop out is still over the preview');
});

test('the stream in the dock: Twitch\'s own player, off until switched on, on one device at a time, never pictures from OBS', () => {
  const player = read('../../web/components/DockPlayer.tsx');
  const app = read('../../web/App.tsx');
  const tabs = read('../../web/components/DockTabs.tsx');
  // Straight from Twitch to the phone, with this page as the parent Twitch checks; muted, as a phone asks a tap for sound.
  assert.ok(player.includes('https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(host)}&muted=true&autoplay=true'));
  assert.ok(player.includes('twitchPlayerUrl(channel, window.location.hostname)'));
  assert.ok(!/GetSourceScreenshot|screenshot/i.test(player), 'the streamer chose no OBS pictures: no load on the computer or the server');
  // Twitch plays only on https: a note where it can't, rather than Twitch's error; and a note with no channel.
  assert.ok(player.includes('!window.isSecureContext ?') && player.includes('const note = !channel ?') && player.includes('const player = note ? say(note) :'));
  // Its own space, at least 300 tall upright, beside the tabs sideways; never over the panels.
  assert.ok(player.includes("'w-full shrink-0 mb-2 aspect-video min-h-[min(300px,50dvh)] max-h-[50dvh]'"));
  // Sideways: always 16:9 (no bars), as wide as the moderator dragged it on this device, unless the height runs out first.
  assert.ok(player.includes("? 'w-full shrink-0 aspect-video'") && player.includes('data-dock-side'));
  assert.ok(player.includes("const SPLIT_KEY = 'dock_watch_split';") && player.includes('data-dock-player-handle') && player.includes('setPointerCapture'));
  assert.ok(player.includes("return beside ? <>{column(player)}{handle}</> : player;"));
  // Under the picture, beside the panels: the stream's line always (its room kept in the width), and another tab when it fits.
  assert.ok(player.includes('calc((100dvh - ${topRoom + UNDER_ROOM}px) * 16 / 9))') && player.includes('export const UNDER_ROOM = 36;'));
  assert.ok(app.includes('<DockStreamInfo streamNow={(system.data as any).streamNow} stats={(system.data as any).stats} t={t} />'));
  assert.ok(app.includes('<DockBelow tabs={DOCK_TABS} body={(id) => dockPanelBody(id, true)} t={t} />'));
  const below = read('../../web/components/DockBelow.tsx');
  assert.ok(below.includes('export const MIN_HEIGHT = 120;') && below.includes('setFits(el.clientHeight >= MIN_HEIGHT)'), 'no sliver of a panel under a full-height picture');
  assert.ok(below.includes("tabs.filter((tab) => tab.id !== 'chat')") && below.includes("const KEY = 'dock_below';"), 'any tab but the chat, chosen per device');
  // The deck under the stream is laid out for its short, wide box at a desk too, as on a phone held sideways; the tab's own deck is not.
  const deck = read('../../web/components/DockDeck.tsx');
  assert.ok(deck.includes('const sideways = useSideways() || fitted;') && app.includes('fitted={under}') && app.includes('body={(id) => dockPanelBody(id, true)}'));
  const info = read('../../web/components/DockStreamInfo.tsx');
  assert.ok(info.includes("(s.youtubeLive ? Number(s.youtubeViewers) || 0 : 0)") && info.includes('className="h-7 shrink-0'), 'the home screen’s count, in a line that never moves the player');
  // A wide desk window too: the stream beside the panels under the tabs, not a band of bars across the top.
  assert.ok(app.includes("const dockWide = useWideDesk() && watching && !dockSideways;") && app.includes("'(min-width: 900px) and (min-aspect-ratio: 4/3) and (hover: hover)'"));
  assert.ok(app.includes('[data-dock-layout="wide"] > [data-dock="tabs"] { grid-column: 1 / -1; }'));
  // Full screen and keep-awake upright too, on a phone (no browser bar to hide at a desk or in OBS).
  assert.ok(app.includes('{isTouchScreen() && <ScreenControls t={t} row />}'));
  assert.ok(read('../../web/components/ScreenControls.tsx').includes("data-screen-controls={row ? 'row' : 'column'}"));
  // Off unless this device was switched on; the switch sits by the tabs, upright and sideways.
  assert.ok(app.includes("localStorage.getItem('dock_watch') === 'on'"));
  assert.ok(app.includes('extra={dockSideways ? watchButton : <>{watchButton}') && app.includes("<DockPlayer channel={system.connections.twitchChannel} beside={dockSideways || dockWide} topRoom={dockWide ? 56 : 16} t={t}>") && app.includes("{mode === 'dock' && watching && ("));
  assert.ok(tabs.includes('{extra}') && tabs.includes('if (tabs.length < 2 && !extra) return null;'));
});

test('a name with no colour of its own, or with name colours off, is its platform’s in the dock: Twitch the accent, TikTok white, Discord a washed-out blue, YouTube a brighter red', () => {
  const css = read('../../shared/dock-chat-css.js');
  assert.ok(css.includes('--name-twitch: var(--accent);'));
  for (const p of ['tiktok', 'discord', 'youtube']) assert.ok(css.includes(`--name-${p}: \${N.${p}};`), p);
  // One list for the dock and every chat layer (shared/name-colours.js).
  const names = read('../../shared/name-colours.js');
  for (const [p, c] of [['tiktok', '#ffffff'], ['discord', '#8fa3e6'], ['youtube', '#ff4d4d']]) assert.ok(names.includes(`${p}: '${c}',`), p);
  for (const p of ['twitch', 'tiktok', 'discord', 'youtube']) assert.ok(css.includes(`[data-chat-platform="${p}"] { --name-own: var(--name-${p}); }`), p);
  // Their own colour still first, when name colours are on and they have one.
  assert.ok(css.includes('background: var(--chat-user-color, var(--name-own));'));
  const row = read('../../web/components/ChatMessageRow.tsx');
  assert.equal(row.split('data-chat="row" data-chat-platform={chat.platform}').length - 1, 6, 'every kind of row says its platform');
});

const nameColours = await import('../../../shared/name-colours.js');
const chatSettings = await import('../../engine/chat-settings.js');

test('a chat layer colours its names by the look, the platform or their own, and a saved look that only knows its accent follows too', () => {
  const { nameColourSource: src, nameColourFor: colour } = nameColours;
  // Unchosen, the old switch decides: on is their own, off the look's.
  assert.deepEqual([src({ colorUsername: true }), src({ colorUsername: false }), src({ colorUsername: false, nameColours: 'platform' })], ['own', 'layout', 'platform']);
  assert.equal(colour('layout', 'tiktok', '#123456'), '', 'the look decides');
  assert.equal(colour('platform', 'tiktok', '#123456'), '#ffffff', 'the platform even over their own');
  assert.equal(colour('platform', 'twitch', '#123456'), '', 'Twitch keeps the look\u2019s accent');
  assert.equal(colour('own', 'twitch', '#123456'), '#123456');
  assert.equal(colour('own', 'youtube', ''), '#ff4d4d', 'no colour of their own: the platform\u2019s');
  const row = read('../../web/components/ChatMessageRow.tsx');
  // On the name alone, the accent and its ink become the chosen colour: SimonSays Casual's chip is var(--overlay-accent).
  assert.ok(row.includes("...(nameColour ? { ['--overlay-accent' as any]: nameColour,"));
  assert.ok(row.includes("...(nameColour ? { ['--chat-user-color' as any]: nameColour } : {}),"));
  assert.ok(!row.includes('settings.colorUsername'), 'every theme goes by the chosen colour, not the old switch');
  // The choice is a chat layer's; the dock keeps its switch.
  assert.ok(read('../../web/components/ChatLayerPanel.tsx').includes('nameChoice: true,'));
  assert.ok(read('../../web/components/ChatSettingParts.tsx').includes("onChange={(s: string) => patch({ nameColours: s, colorUsername: s === 'own' })}"));
  // Kept by the server, a wrong one refused, and not lost by a save that does not mention it.
  const d = chatSettings.DEFAULT_CHAT;
  assert.equal(chatSettings.cleanChatSettings({ ...d, nameColours: 'platform' }, d).nameColours, 'platform');
  assert.equal(chatSettings.cleanChatSettings({ ...d, nameColours: 'rainbow' }, d).nameColours, '');
  assert.equal(chatSettings.cleanChatSettings({ fontSize: 20 }, { ...d, nameColours: 'own' }).nameColours, 'own');
});
