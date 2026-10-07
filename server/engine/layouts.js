/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Overlay layouts: several overlays composed into one browser source.
 *
 * Every surface this app draws — chat, alerts, the omnibar, the countdown, the
 * viewer count, the Spotify card — already exists as its own `?mode=` page.
 * Putting all of them on stream means adding a browser source per overlay,
 * positioning each one in OBS, and repeating that for every scene collection.
 *
 * A layout is the alternative: one browser source, and the arrangement lives
 * here instead of in OBS. That also means the arrangement travels with the
 * rest of the configuration — export it, import it on another machine, and the
 * stream looks the same.
 *
 * Positions are pixels in the layout's own coordinate space, not percentages.
 * A person building an overlay thinks "the chat box is 380 wide", and a
 * percentage stops meaning anything the moment the canvas is resized. The page
 * scales the whole stage to whatever the browser source actually is, so a
 * 1920x1080 layout still fills a 1280x720 source.
 */

import { safeFontName } from '../../shared/chat-style.js';
import { NAMEPLATE_SOURCE_IDS, rosterCapacity } from '../../shared/run.js';
import { ENTRANCE_IDS, IDLE_IDS } from '../../shared/layer-motion.js';
import { CONDITION_IDS } from '../../shared/layer-conditions.js';
import { cleanCss, MAX_SCOPED_CSS, MAX_CANVAS_CSS } from '../../shared/clean-css.js';
import { normaliseSourceLayer } from './omnilayer.js';
import { normaliseChatLayer } from './chat-settings.js';
import { cleanTypeId } from './scene-types.js';
import { readFields, cleanVars } from '../../shared/css-fields.js';
import { currentLook, supersededLook } from '../../shared/looks-history.js';
import { MAX_PER_PAGE } from '../../shared/players.js';
import { AVATAR_EXPRESSIONS_LIST, AVATAR_EXTRAS_LIST, AVATAR_HATS, AVATAR_COLOURINGS, AVATAR_REACTIONS, AVATAR_REACTION_DEFAULTS, AVATAR_COSTUMES_LIST, AVATAR_SLEEP_AFTER, AVATAR_ACTIONS_LIST } from '../../shared/avatar.js';
import { PIXEL_ID, PIXEL_NAME } from '../../shared/pixel-avatars.js';
import { HOUSE_CHARACTER } from '../../shared/house-avatar.js';
import { GROUP_ID, tidyGroups } from '../../shared/layer-groups.js';
import { aspectRatio } from '../../shared/aspect.js';

/**
 * The layers a layout may hold.
 *
 * Deliberately closed: a layer names a surface this server actually renders,
 * so a layout can never promise something there is no data for. Adding a new
 * overlay to the app means adding it here on purpose.
 */
export const LAYER_TYPES = ['chat', 'alerts', 'omnibar', 'countdown', 'viewers', 'spotify', 'nameplate', 'images', 'goal', 'plan', 'question', 'text', 'shape', 'runcard', 'roster', 'stopwatch', 'players', 'poll', 'voice', 'avatar', 'pngtuber', 'hypetrain', 'shoutout', 'leaderboard', 'giveaway', 'source'];

/**
 * How many layouts one install may keep.
 *
 * Exported because the editor has to stop somebody at the same number: a save
 * that quietly drops the layout they just made is worse than a disabled button.
 */
export const MAX_LAYOUTS = 20;

/** The canvas a layout is authored against, and the bounds we accept. */
const CANVAS = { width: 1920, height: 1080, min: 160, max: 7680 };

/**
 * One of each layer type, at most.
 *
 * Two chat boxes on one stream is not a thing anyone asked for, and allowing
 * duplicates would force every layer to carry an identity separate from what
 * it draws — which the editor would then have to explain. One per type keeps
 * a layer addressable by what it is.
 */
const DEFAULT_LAYER = { x: 0, y: 0, width: 400, height: 300, opacity: 1, visible: true, config: {} };

/** Sensible first placement, so a layer turned on is never a 400x300 box at the origin. */
const LAYER_PRESETS = {
  chat: { x: 40, y: 320, width: 380, height: 700 },
  alerts: { x: 0, y: 0, width: CANVAS.width, height: CANVAS.height },
  omnibar: { x: 0, y: 1016, width: CANVAS.width, height: 64 },
  countdown: { x: 760, y: 60, width: 400, height: 160 },
  // Under the game, where a marathon keeps it, and wide enough for 1:23:45.6.
  stopwatch: { x: 40, y: 560, width: 620, height: 140 },
  // Down the right side, tall enough for a full page in columns.
  players: { x: 1340, y: 120, width: 540, height: 760 },
  // Beside the game, tall enough for five answers without squeezing them.
  poll: { x: 1300, y: 300, width: 580, height: 440 },
  // Along the bottom right, room for a row of six.
  voice: { x: 1180, y: 840, width: 700, height: 180 },
  // A square, the avatar's own shape, low on the right.
  avatar: { x: 1560, y: 700, width: 320, height: 320 },
  pngtuber: { x: 1480, y: 620, width: 400, height: 400 },
  // Along the top, where a progress bar reads at a glance.
  hypetrain: { x: 610, y: 30, width: 700, height: 110 },
  // Across the middle, where a draw is watched.
  giveaway: { x: 560, y: 380, width: 800, height: 320 },
  // Down the right side, tall enough for five rows.
  leaderboard: { x: 1480, y: 300, width: 400, height: 380 },
  // Top left, clear of the game's middle.
  shoutout: { x: 60, y: 60, width: 640, height: 170 },
  viewers: { x: 1620, y: 40, width: 260, height: 80 },
  spotify: { x: 1480, y: 880, width: 400, height: 140 },
  // Low and left, where a lower third goes.
  nameplate: { x: 60, y: 820, width: 560, height: 120 },
  // A corner, out of the way. Big enough to read a logo in.
  images: { x: 1560, y: 60, width: 300, height: 170 },
  // Wide and short, along the top where a progress bar reads at a glance.
  goal: { x: 660, y: 40, width: 600, height: 90 },
  // Down the side, tall enough for a few lines without covering the game.
  plan: { x: 1480, y: 260, width: 400, height: 260 },
  // Across the lower middle, where a question is read rather than glanced at.
  question: { x: 460, y: 760, width: 1000, height: 180 },
  // Middle of the canvas, where you will see it to move it somewhere better.
  text: { x: 660, y: 480, width: 600, height: 120 },
  // Beside the game, where a marathon puts it: wide, short, two rows.
  runcard: { x: 1180, y: 900, width: 620, height: 120 },
  // The same middle, and a size worth seeing before it is placed.
  shape: { x: 660, y: 420, width: 600, height: 240 },
  // An OBS source's slot (Omnilayer): the whole canvas, as a game usually is, until it is given a box.
  source: { x: 0, y: 0, width: CANVAS.width, height: CANVAS.height },
};

/**
 * How a layer blends with what is under it.
 *
 * A subset of the CSS modes rather than all of them: these are the ones that
 * do something recognisable over video, and every one left out is either a
 * near-duplicate or produces mud on anything but a flat colour.
 */
const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
];

const bounded = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

const colour = (v, fallback) => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v || '') ? v : fallback);

/** How many OBS scenes one layout may claim. */
const MAX_SCENES_PER_LAYOUT = 24;

/**
 * The OBS scene names a layout answers to.
 *
 * Names, not ids, because obs-websocket identifies a scene by its name and
 * that is also the only thing a person can recognise in a list. Renaming a
 * scene in OBS therefore breaks the binding — which is visible in the editor,
 * where the scene simply stops appearing as bound, rather than silently
 * showing the wrong overlay on stream.
 */
const cleanScenes = (v) => {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  return v
    .map((s) => String(s ?? '').trim())
    .filter((s) => s && s.length <= 200 && !seen.has(s) && seen.add(s))
    .slice(0, MAX_SCENES_PER_LAYOUT);
};

/** Fonts the UI loads. The same list the chat and alert editors offer. */
const TEXT_ALIGN = ['left', 'center', 'right'];
const TEXT_VALIGN = ['top', 'middle', 'bottom'];

/**
 * A free text layer's settings.
 *
 * The text itself is not trimmed and newlines survive: somebody typing three
 * lines means three lines. It is capped, and it is only ever rendered as text
 * — never as markup — so the cap is about a layout staying readable rather
 * than about safety.
 */
/*
  Settings a look can decide.

  A look from the Library styles a layer with a stylesheet, and the layer's
  own controls write what they are set to straight onto the element. Which of
  the two shows was decided by !important, so a look beat the controls and a
  colour picked in the panel did nothing while one was on. Now a control the
  look also speaks to has a third state, empty — automatic: the look's, or the
  layer's own default without one — and a value picked in it always shows,
  look or no look.

  Layers saved before this stored the default in full (white, for a text
  colour), which cannot be told apart from somebody choosing white. They are
  read once as automatic wherever they hold that default — which is what they
  showed under a look all along — and marked, so a white chosen after that
  stays chosen.
*/
export const SETTINGS_VERSION = 2;
export const readSettings = (c) => (Number(c?.settingsVersion) || 1) >= SETTINGS_VERSION;
/** A colour a look can decide: empty is automatic; before the mark, the old default was automatic too. */
export const lookColour = (c, key, oldDefault) => {
  const v = colour(c?.[key], '');
  return !readSettings(c) && (v === '' || v.toLowerCase() === oldDefault) ? '' : v;
};

function normaliseTextLayer(c) {
  return {
    text: String(c?.text ?? '').slice(0, 500),
    fontFamily: safeFontName(c?.fontFamily),
    fontSize: bounded(c?.fontSize, 8, 400, 48),
    fontWeight: bounded(c?.fontWeight, 100, 900, 800),
    // Automatic when empty: the look's colour, or white.
    color: lookColour(c, 'color', '#ffffff'),
    settingsVersion: SETTINGS_VERSION,
    align: TEXT_ALIGN.includes(c?.align) ? c.align : 'left',
    verticalAlign: TEXT_VALIGN.includes(c?.verticalAlign) ? c.verticalAlign : 'middle',
    lineHeight: bounded(c?.lineHeight * 100, 80, 300, 120) / 100,
    letterSpacing: bounded(c?.letterSpacing, -20, 40, 0),
    uppercase: c?.uppercase === true,
    italic: c?.italic === true,
    outlineWidth: bounded(c?.outlineWidth, 0, 8, 0),
    outlineColor: colour(c?.outlineColor, '#000000'),
  };
}

const RUN_CARD_ALIGN = ['left', 'center', 'right'];

/**
 * The card that says what is being played.
 *
 * Only how it looks. What it says comes from the run, which is one record
 * for the whole app rather than a copy per layout — the point of that
 * record is that changing the game changes every layout at once.
 */
function normaliseRunCard(c) {
  return {
    accentColor: colour(c?.accentColor, ''),
    textColor: colour(c?.textColor, '#ffffff'),
    backgroundColor: colour(c?.backgroundColor, '#09090bd9'),
    align: RUN_CARD_ALIGN.includes(c?.align) ? c.align : 'center',
    titleSize: bounded(c?.titleSize, 10, 200, 34),
    detailSize: bounded(c?.detailSize, 8, 120, 16),
    radius: bounded(c?.radius, 0, 64, 8),
    showEdge: c?.showEdge !== false,
    showCategory: c?.showCategory !== false,
    showEstimate: c?.showEstimate !== false,
    // Trimmed but not required: some streams say EST, some say nothing.
    estimateLabel: String(c?.estimateLabel ?? 'EST').trim().slice(0, 12),
  };
}

const SHAPE_KINDS = ['rect', 'ellipse', 'line'];

/**
 * A drawn shape: a box, a circle or a line.
 *
 * Nothing here is live, which is the point — this is the panel an overlay
 * sits on rather than a view onto anything the server keeps. Every colour
 * goes through the same check as the rest: a layer config reaches a page as
 * inline style, so a value that is not a colour has no business being one.
 */
function normaliseShape(c) {
  return {
    kind: SHAPE_KINDS.includes(c?.kind) ? c.kind : 'rect',
    // Unset means the canvas accent; see normaliseLayout.
    fill: colour(c?.fill, ''),
    gradient: c?.gradient === true,
    fillTo: colour(c?.fillTo, '#09090b'),
    angle: bounded(c?.angle, 0, 360, 90),
    radius: bounded(c?.radius, 0, 200, 0),
    borderWidth: bounded(c?.borderWidth, 0, 40, 0),
    borderColor: colour(c?.borderColor, '#ffffff'),
    // A line of no thickness is a line nobody can see.
    thickness: bounded(c?.thickness, 1, 80, 4),
  };
}

/**
 * How a players layer lays the list out. The list itself is the Players
 * screen's; this is how many a page shows, in how many columns, and whether
 * the ones already out are shown at all.
 */
function normalisePlayersLayer(c) {
  return {
    perPage: bounded(c?.perPage, 1, MAX_PER_PAGE, MAX_PER_PAGE),
    // 0 is "work it out from how many are showing".
    columns: bounded(c?.columns, 0, 6, 0),
    seconds: bounded(c?.seconds, 3, 60, 8),
    onlyIn: c?.onlyIn === true,
    showState: c?.showState !== false,
    title: String(c?.title ?? '').trim().slice(0, 40),
    // Automatic when empty: the look's, or white on see-through black.
    textColor: lookColour(c, 'textColor', '#ffffff'),
    background: lookColour(c, 'background', '#09090bcc'),
    settingsVersion: SETTINGS_VERSION,
    radius: bounded(c?.radius, 0, 40, 10),
  };
}

/**
 * How a poll layer shows the poll. The poll itself is the Polls screen's;
 * this is what it shows of it, and how long a result stays up.
 */
function normalisePollLayer(c) {
  return {
    // 0 is "work it out from how many answers there are".
    columns: bounded(c?.columns, 0, 3, 0),
    // Room for this many answers, like the players list's slots: rows keep
    // their size and fewer answers leave the rest empty. 0 fits the answers.
    slots: bounded(c?.slots, 0, 15, 0),
    showNumbers: c?.showNumbers !== false,
    showPercent: c?.showPercent !== false,
    showCount: c?.showCount === true,
    showHint: c?.showHint !== false,
    hint: String(c?.hint ?? '').trim().slice(0, 80),
    // Automatic when empty: the look's, or white on see-through black, and
    // the bars in the canvas accent.
    textColor: lookColour(c, 'textColor', '#ffffff'),
    background: lookColour(c, 'background', '#09090bcc'),
    barColor: colour(c?.barColor, ''),
    settingsVersion: SETTINGS_VERSION,
    radius: bounded(c?.radius, 0, 40, 12),
  };
}

/**
 * How a voice layer shows the Discord call. The call itself — which channel,
 * who is in it, who is talking — is the Voice call screen's and the bot's.
 */
function normaliseVoiceLayer(c) {
  return {
    arrange: ['row', 'column', 'grid'].includes(c?.arrange) ? c.arrange : 'row',
    // How many the tiles are sized for, so they keep their size as people come and go.
    slots: bounded(c?.slots, 1, 25, 6),
    shape: c?.shape === 'rounded' ? 'rounded' : 'circle',
    show: c?.show === 'talking' ? 'talking' : 'everyone',
    showNames: c?.showNames !== false,
    showStatus: c?.showStatus !== false,
    dimQuiet: c?.dimQuiet === true,
    // Somebody's own pictures from the Voice call screen, instead of their avatar.
    usePictures: c?.usePictures !== false,
    hop: c?.hop !== false,
    // An emoji or soundboard sound sent in the call, over whoever sent it.
    showReactions: c?.showReactions !== false,
    // Who to leave out, kept with a name so they can be listed while not in the call.
    hide: (Array.isArray(c?.hide) ? c.hide : [])
      .filter((h) => h && /^\d{5,25}$/.test(String(h.id)))
      .slice(0, 25)
      .map((h) => ({ id: String(h.id), name: String(h.name ?? '').trim().slice(0, 40) })),
    // Automatic when empty: the look's talking colour, or Discord green.
    // No look colours the names, so the text colour stays a plain colour.
    glowColor: lookColour(c, 'glowColor', '#23a55a'),
    textColor: colour(c?.textColor, '#ffffff'),
    settingsVersion: SETTINGS_VERSION,
  };
}

/**
 * The pixel avatar: which face, what it is wearing, what colour, and what it
 * does by itself — blinking, talking along with somebody in the Discord
 * call, and reacting to alerts.
 */
function normaliseAvatarLayer(c) {
  /*
    Drawn as the built-in avatar (''), or as a pixel avatar from the Pixel
    avatars tab, by its id. One of those has faces, outfits and hats of its
    own, which this cannot see, so for it any well-formed name is kept and
    the drawing leaves out what it does not have. One hat at a time is then
    the drawing's to keep: the last one asked for is the one worn.
  */
  const character = typeof c?.character === 'string' && PIXEL_ID.test(c.character) ? c.character : '';
  // Naming none draws the house avatar when there is one (shared/house-avatar.js), so its names are kept the same way.
  const own = Boolean(character || HOUSE_CHARACTER);
  const isFace = (f) => (own ? PIXEL_NAME.test(String(f ?? '')) && f !== 'neutral' || f === 'neutral' : AVATAR_EXPRESSIONS_LIST.includes(f));
  const extras = (Array.isArray(c?.extras) ? c.extras : []).filter((e) => (own ? PIXEL_NAME.test(String(e ?? '')) : AVATAR_EXTRAS_LIST.includes(e))).slice(0, 40);
  // One hat at a time: the last one chosen.
  const hat = extras.filter((e) => AVATAR_HATS.includes(e)).pop();
  const reactions = {};
  for (const kind of AVATAR_REACTIONS) {
    const r = c?.reactions?.[kind];
    reactions[kind] = r === 'none' || isFace(r) ? r : AVATAR_REACTION_DEFAULTS[kind];
  }
  /*
    Something it does as an alert of a kind lands — a wave for a raid — as
    well as the face it pulls. Kept only when there is any, so a layer that
    does nothing at alerts is written exactly as it was before there could be.
  */
  const reactionActions = {};
  for (const kind of AVATAR_REACTIONS) {
    const a = c?.reactionActions?.[kind];
    if (typeof a === 'string' && (own ? PIXEL_NAME.test(a) : AVATAR_ACTIONS_LIST.includes(a))) reactionActions[kind] = a;
  }
  return {
    character,
    expression: isFace(c?.expression) ? c.expression : 'neutral',
    extras: own ? [...new Set(extras)] : [...new Set(extras.filter((e) => !AVATAR_HATS.includes(e) || e === hat))],
    colouring: AVATAR_COLOURINGS.includes(c?.colouring) ? c.colouring : 'layout',
    // An outfit: '' is the one it was drawn in; the rest are costumes (shared/avatar-art.js), or a pixel avatar's own.
    costume: (own ? c?.costume === '' || PIXEL_NAME.test(String(c?.costume ?? '')) : AVATAR_COSTUMES_LIST.includes(c?.costume)) ? c.costume : '',
    ownColour: colour(c?.ownColour, '#a56cae').slice(0, 7),
    blink: c?.blink !== false,
    glance: c?.glance !== false,
    // Glance toward the chat, an alert, a poll, a question or a new song as it happens.
    watch: c?.watch !== false,
    // Dizzy when too much happens at once to follow.
    overwhelm: c?.overwhelm !== false,
    // How many things at once it takes: three to six.
    overwhelmCount: bounded(c?.overwhelmCount, 3, 6, 3),
    // Dozes off after the mic has been quiet this many minutes; 0 never.
    sleepAfter: AVATAR_SLEEP_AFTER.includes(Number(c?.sleepAfter)) ? Number(c.sleepAfter) : 3,
    twinkle: c?.twinkle !== false,
    // Breathing, the shoulders and then the head: on unless turned off.
    breathe: c?.breathe !== false,
    // Somebody in the Discord call to talk along with, kept with a name so they can be shown while not in it.
    talkWith: talkWith(c?.talkWith),
    hop: c?.hop !== false,
    shake: c?.shake !== false,
    // A face while you are loud, or 'none' to keep the one it has.
    loudFace: isFace(c?.loudFace) && c.loudFace !== 'neutral' ? c.loudFace : 'none',
    react: c?.react !== false,
    reactions,
    ...(Object.keys(reactionActions).length ? { reactionActions } : {}),
    // Viewers may dress it up from chat or with channel points.
    dressable: c?.dressable !== false,
    label: String(c?.label ?? '').trim().slice(0, 60),
  };
}

/** The words on a Hype Train layer; the train itself is Twitch's. */
function normaliseHypeTrainLayer(c) {
  const words = (v, max) => String(v ?? '').trim().slice(0, max);
  return {
    title: words(c?.title, 40),
    levelWord: words(c?.levelWord, 20),
    doneText: words(c?.doneText, 80),
    doneSeconds: bounded(c?.doneSeconds, 0, 30, 8),
    showTop: c?.showTop !== false,
  };
}

/** The chat's leaderboard: its words, how many rows, and what each row shows. The board is the server's. */
function normaliseLeaderboardLayer(c) {
  const words = (v, max) => String(v ?? '').trim().slice(0, max);
  return {
    title: words(c?.title, 40),
    levelWord: words(c?.levelWord, 12),
    count: bounded(c?.count, 3, 10, 5),
    showTitle: c?.showTitle !== false,
    showAvatars: c?.showAvatars !== false,
    showBar: c?.showBar !== false,
    showXp: c?.showXp === true,
  };
}

/** The giveaway's words, and how long its winner stays; the giveaway is the server's. */
function normaliseGiveawayLayer(c) {
  const words = (v, max) => String(v ?? '').trim().slice(0, max);
  return {
    title: words(c?.title, 40),
    howText: words(c?.howText, 80),
    showCount: c?.showCount !== false,
    winnerSeconds: bounded(c?.winnerSeconds, 0, 600, 30),
  };
}

/** The words on a shoutout card; who it is for comes from the shoutout. */
function normaliseShoutoutLayer(c) {
  const words = (v, max) => String(v ?? '').trim().slice(0, max);
  return {
    title: words(c?.title, 60),
    gameText: words(c?.gameText, 60),
    viewersText: words(c?.viewersText, 30),
    showViewers: c?.showViewers !== false,
  };
}

/**
 * Who an avatar talks along with: your microphone in OBS ({ id: 'mic' }), or
 * somebody in the Discord call, kept with a name so they can be shown while
 * not in it.
 */
function talkWith(who) {
  if (who?.id === 'mic') return { id: 'mic', name: 'mic' };
  return who && /^\d{5,25}$/.test(String(who.id)) ? { id: String(who.id), name: String(who.name ?? '').trim().slice(0, 40) } : null;
}

/** An uploaded file, or a picture on the web. Nothing else is drawn. */
const pictureUrl = (v) => {
  const url = String(v ?? '').trim();
  if (url.length > 300) return '';
  return /^\/media\/[\w.-]+$/.test(url) || /^https?:\/\/\S+$/.test(url) ? url : '';
};

const PNGTUBER_FRAMES = ['idle', 'talking', 'blink', 'blinkTalking'];

/**
 * A PNGtuber of your own pictures: quiet, talking, and the same two with the
 * eyes shut for blinking; and sets of pictures by name, for the faces an
 * action asks for.
 */
function normalisePngtuberLayer(c) {
  const frames = {};
  for (const k of PNGTUBER_FRAMES) {
    const url = pictureUrl(c?.frames?.[k]);
    if (url) frames[k] = url;
  }
  const expressions = (Array.isArray(c?.expressions) ? c.expressions : [])
    .map((e) => ({ name: String(e?.name ?? '').trim().toLowerCase().slice(0, 40), idle: pictureUrl(e?.idle), talking: pictureUrl(e?.talking) }))
    .filter((e) => e.name && (e.idle || e.talking))
    .slice(0, 12);
  return {
    frames,
    expressions,
    talkWith: talkWith(c?.talkWith) ?? { id: 'mic', name: 'mic' },
    blinks: c?.blinks !== false,
    hop: c?.hop !== false,
    shake: c?.shake !== false,
    // The name of one of its faces to show while you are loud, or nothing.
    loudFace: String(c?.loudFace ?? '').trim().toLowerCase().slice(0, 40),
    dimQuiet: c?.dimQuiet === true,
  };
}

/** The question overlay's own settings. It has no screen of its own. */
function normaliseQuestionLayer(c) {
  return {
    label: String(c?.label ?? '').trim().slice(0, 40),
    textColor: colour(c?.textColor, '#ffffff'),
    // Unset means the canvas accent.
    accentColor: colour(c?.accentColor, ''),
    background: colour(c?.background, '#09090bd9'),
    radius: bounded(c?.radius, 0, 64, 16),
    showAsker: c?.showAsker !== false,
  };
}

/** How much of the plan an overlay shows. */
const PLAN_MODES = ['recap', 'all', 'upcoming', 'current'];

/** The plan overlay's own settings. Validated here: it has no screen of its own. */
function normalisePlanLayer(c) {
  return {
    mode: PLAN_MODES.includes(c?.mode) ? c.mode : 'recap',
    // Enough to be useful, few enough to fit the box it is drawn in.
    limit: bounded(c?.limit, 1, 12, 4),
    title: String(c?.title ?? '').trim().slice(0, 40),
    textColor: colour(c?.textColor, '#ffffff'),
    // Unset means the canvas accent.
    accentColor: colour(c?.accentColor, ''),
    doneColor: colour(c?.doneColor, '#71717a'),
    // Transparent by default: this usually sits over gameplay.
    background: colour(c?.background, ''),
    radius: bounded(c?.radius, 0, 64, 12),
    showNotes: c?.showNotes === true,
    // Beside the line it belongs to, or under it with the whole row to itself.
    notesOwnLine: c?.notesOwnLine === true,
  };
}

/**
 * What a goal counts toward.
 *
 * Every source but "manual" is a number the server already holds, so the bar
 * follows it without anyone typing anything. Manual is there because the most
 * common goal on a small stream is one nothing measures — a subathon total, a
 * charity tally, a number kept on paper.
 */
const GOAL_SOURCES = ['manual', 'followers', 'subs', 'viewers', 'tiktokLikes'];

/** The goal bar's own settings. Validated here: it has no screen of its own. */
function normaliseGoal(c) {
  return {
    source: GOAL_SOURCES.includes(c?.source) ? c.source : 'manual',
    label: String(c?.label ?? '').trim().slice(0, 60),
    // A goal of zero is a bar that is always full, which is nobody's intent.
    target: bounded(c?.target, 1, 100000000, 100),
    // Only read when the source is manual; kept either way so switching to
    // manual and back does not lose the number that was typed.
    manualValue: bounded(c?.manualValue, 0, 100000000, 0),
    // Unset means the look's fill, or the canvas accent without one.
    barColor: colour(c?.barColor, ''),
    // Automatic when empty: the look's, or zinc-800 at 80% — so the empty
    // part of the bar reads as a track rather than as a black box on a
    // transparent overlay — and white for the text.
    trackColor: lookColour(c, 'trackColor', '#27272acc'),
    textColor: lookColour(c, 'textColor', '#ffffff'),
    settingsVersion: SETTINGS_VERSION,
    showNumbers: c?.showNumbers !== false,
    showPercent: c?.showPercent === true,
    radius: bounded(c?.radius, 0, 64, 12),
  };
}

/**
 * One image source, or nothing.
 *
 * Only two shapes are allowed through. A path under /media/, which is where
 * this server's own uploads are served from, and an ordinary http(s) URL for
 * something hosted elsewhere. Everything else is dropped — these end up as the
 * src of an <img> on a stream, and "javascript:" and "data:" both belong to
 * that attribute as much as a picture does.
 *
 * A relative path is kept relative on purpose: the overlay is opened by IP
 * from OBS on another machine, and baking in whatever host the editor happened
 * to be on is how a source works on the desk and shows nothing on the stream.
 */
function cleanImageSource(v) {
  const s = String(v ?? '').trim();
  if (!s || s.length > 2000) return '';
  if (s.startsWith('/media/')) return s.includes('..') ? '' : s;
  const lower = s.toLowerCase();
  return (lower.startsWith('http://') || lower.startsWith('https://')) ? s : '';
}

/** How many pictures one layer may hold. Past this it is a slideshow app. */
const MAX_IMAGES = 24;
const IMAGE_FITS = ['contain', 'cover', 'fill'];
const IMAGE_TRANSITIONS = ['fade', 'none'];

/**
 * The image layer's own settings.
 *
 * Validated here for the same reason the nameplate is: it has no screen of its
 * own that would otherwise check them.
 */
function normaliseImages(c) {
  const sources = (Array.isArray(c?.sources) ? c.sources : [])
    .map(cleanImageSource)
    .filter(Boolean)
    .slice(0, MAX_IMAGES);
  return {
    sources,
    // Long enough to read a logo, short enough to feel like a rotation.
    seconds: bounded(c?.seconds, 1, 3600, 8),
    fit: IMAGE_FITS.includes(c?.fit) ? c.fit : 'contain',
    transition: IMAGE_TRANSITIONS.includes(c?.transition) ? c.transition : 'fade',
    // Off by default: a fixed order is what somebody arranging sponsors wants.
    random: c?.random === true,
  };
}

/**
 * The nameplate's own settings.
 *
 * Every other layer's config is passed through untouched, because chat, the
 * omnibar and the rest each have a surface of their own that already validates
 * what it is given, and writing those rules twice is how the two drift apart.
 *
 * The nameplate has no such surface — it exists only as a layer — so this is
 * the only place its settings are ever checked, and they end up as text and
 * inline styles on a stream. Hence the exception.
 */
const NAMEPLATE_ALIGNMENTS = ['left', 'right'];
function normaliseNameplate(c) {
  return {
    // Long enough for a name and a handle, short enough not to reflow the bar.
    /*
      Who the plate is about. Following the run is the point of the run
      record: four plates that each have to be retyped when the guests
      change are four chances to leave last week's name on stream.
    */
    source: NAMEPLATE_SOURCE_IDS.includes(c?.source) ? c.source : 'manual',
    // Kept whatever the source, so switching to the run and back does not
    // lose the name that was typed.
    name: String(c?.name ?? '').slice(0, 60),
    subtitle: String(c?.subtitle ?? '').slice(0, 80),
    // Unset means the look's accent, or the canvas accent without one.
    accentColor: colour(c?.accentColor, ''),
    // Automatic when empty: the look's, or white words on a see-through black
    // plate (eight-digit hex is allowed, which is how that is see-through).
    textColor: lookColour(c, 'textColor', '#ffffff'),
    backgroundColor: lookColour(c, 'backgroundColor', '#09090bd9'),
    settingsVersion: SETTINGS_VERSION,
    align: NAMEPLATE_ALIGNMENTS.includes(c?.align) ? c.align : 'left',
    nameSize: bounded(c?.nameSize, 10, 160, 40),
    subtitleSize: bounded(c?.subtitleSize, 8, 120, 18),
    showBar: c?.showBar !== false,
    radius: bounded(c?.radius, 0, 64, 12),
  };
}

const ROSTER_INCLUDE = ['commentators', 'couch', 'everyone'];

/**
 * The couch, as a grid of seats.
 *
 * Only the arrangement and the look. Who is in the seats comes from the run,
 * which is the whole point of it: the seats follow that one record instead of
 * each holding a copy of a name that has to be retyped when the guests change.
 *
 * Validated here for the same reason the nameplate is — it exists only as a
 * layer, so there is no surface of its own that has already checked it, and
 * what is in it ends up as text and inline styles on a stream.
 */
function normaliseRoster(c) {
  const include = ROSTER_INCLUDE.includes(c?.include) ? c.include : 'commentators';
  return {
    include,
    // No more seats than the people it seats: one past that could only ever be drawn empty.
    seats: Math.min(bounded(c?.seats, 1, 8, 4), rosterCapacity(include)),
    columns: bounded(c?.columns, 1, 4, 2),
    showEmpty: c?.showEmpty !== false,
    showRole: c?.showRole !== false,
    // Empty means the layer's own wording, rather than an empty seat saying
    // nothing at all.
    emptyText: String(c?.emptyText ?? '').slice(0, 24),
    // Unset means the canvas accent.
    accentColor: colour(c?.accentColor, ''),
    // The host's tab, so the one who is not a commentator reads as different.
    hostColor: colour(c?.hostColor, '#e0a63a'),
    textColor: colour(c?.textColor, '#ffffff'),
    backgroundColor: colour(c?.backgroundColor, '#09090bd9'),
    radius: bounded(c?.radius, 0, 64, 6),
    nameSize: bounded(c?.nameSize, 8, 120, 22),
    pronounSize: bounded(c?.pronounSize, 6, 80, 11),
  };
}

/** A fresh id. Short, and made only of characters a URL carries unchanged. */
const newId = () => Math.random().toString(36).slice(2, 11);

/**
 * Keep an id if it is URL-safe, otherwise mint one.
 *
 * Rewriting the unsafe characters instead would risk turning two different
 * layouts into the same id, which is worse than renaming one of them.
 */
const safeId = (v) => {
  const s = String(v ?? '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : newId();
};

/**
 * The kinds a layout may hold more than one of.
 *
 * Most layers are a view onto one thing the server keeps — there is one
 * chat feed, one countdown, one song playing — and a second copy of one
 * would just be the same thing drawn twice.
 *
 * These are different: they are what somebody builds a look out of. One
 * text layer, one logo and one box is not an overlay, it is a demo of one.
 */
const REPEATABLE = ['text', 'images', 'nameplate', 'goal', 'shape', 'runcard', 'roster', 'players', 'voice', 'avatar', 'pngtuber', 'source'];

/*
  What a chat layer from before chat layers kept their own settings is
  filled out from: the chat every layout used to share. Handed in by the
  engine, which holds it; nothing at all until then, which is the defaults.
*/
let chatFallback = () => ({});
export function setChatFallback(read) {
  chatFallback = typeof read === 'function' ? read : () => ({});
}

/** A layer's placement, clamped to something that can actually be seen. */
function normaliseLayer(incoming, type) {
  const preset = { ...DEFAULT_LAYER, ...(LAYER_PRESETS[type] || {}) };
  const opacity = Number(incoming?.opacity);
  return {
    type,
    /*
      A layer is addressed by this rather than by its type, so that a layout
      can hold three text layers and the editor can tell which one is being
      dragged. Layers saved before ids existed are given one here, which is
      why it is generated rather than required.
    */
    uid: safeId(incoming?.uid),
    // Negative positions are allowed on purpose: bleeding a layer off the edge
    // is a legitimate look, and clamping to zero would silently move it.
    x: bounded(incoming?.x, -CANVAS.max, CANVAS.max, preset.x),
    y: bounded(incoming?.y, -CANVAS.max, CANVAS.max, preset.y),
    width: bounded(incoming?.width, 20, CANVAS.max, preset.width),
    height: bounded(incoming?.height, 20, CANVAS.max, preset.height),
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1,
    visible: incoming?.visible !== false,
    /*
      Locked means "leave this one alone": the editor stops drawing its
      outline and its label and stops offering it to the pointer, so a
      background panel that is already placed cannot be nudged while you
      are reaching for something on top of it.

      It changes nothing about what is drawn on stream, which is why it
      lives here rather than in the config — it is a fact about the layer,
      and it has to survive a save like every other one.
    */
    locked: incoming?.locked === true,
    /*
      Which of the layout's groups it is in, if any — a folder in the editor
      whose layers move and resize together. Nothing on stream reads it.
      Written only when there is one, so a layout without groups is saved
      exactly as it was.
    */
    ...(GROUP_ID.test(String(incoming?.group ?? '')) ? { group: String(incoming.group) } : {}),
    /*
      A shape the editor keeps it to while it is resized — an OBS source's,
      so the box is where the source really shows. Only when there is one.
    */
    ...(aspectRatio(incoming?.aspect) ? { aspect: incoming.aspect } : {}),

    /*
      How the layer is drawn, as opposed to what it draws.

      These sit on the layer rather than in its config because they mean the
      same thing for every type — a rotated nameplate and a rotated image are
      the same operation — so one implementation covers everything already
      built and everything added later.

      Every default here is a no-op, and the canvas emits nothing at all when
      they are all left alone: an unused filter still forces the browser to
      composite the layer on its own surface, which on an overlay is a cost
      paid for nothing.
    */
    /*
      How the layer moves: once when it arrives, and then while it is
      there. On the layer for the same reason the filters are — an
      entrance means the same thing whatever is being drawn — and it
      pairs with the condition above, which is what makes a layer
      arriving mid-stream look deliberate rather than like a glitch.
    */
    animateIn: ENTRANCE_IDS.includes(incoming?.animateIn) ? incoming.animateIn : 'none',
    animateIdle: IDLE_IDS.includes(incoming?.animateIdle) ? incoming.animateIdle : 'none',
    // A percentage, because somebody setting this thinks "half as fast".
    animateSpeed: bounded(incoming?.animateSpeed, 25, 400, 100),

    /*
      This layer's own stylesheet.

      The layout has one too, and it can already reach a layer by id. This
      exists because that id is the copy's undoing: duplicating a layer mints
      a new one, so a rule written against the old id styles the original and
      not the copy. Held here, the rules are part of the layer and a duplicate
      brings them along.

      Scoped to the layer by the canvas, so `:scope` means this layer and
      nothing written here can reach another one.
    */
    // An exact copy of a look from before a change to it is brought up to
    // date (see shared/looks-history.js); anything else is kept as written.
    css: currentLook(cleanCss(incoming?.css, MAX_LAYER_CSS)),

    /*
      And the same layer's motion, kept apart from its look.

      One box meant the two could not coexist: dropping a look onto a layer
      replaced everything, so whatever animation was written there went with
      it. They are different decisions — what a thing looks like, and how it
      arrives — and a change to one should not cost the other.

      Written after the look when the page is built, so that where both
      speak about the same property the motion has the last word.
    */
    motionCss: currentLook(cleanCss(incoming?.motionCss, MAX_LAYER_CSS)),
    /*
      What the stylesheet's own controls have been set to.

      Held to the fields that stylesheet really has, so a value cannot be
      stored for a property nothing reads, and held to what each one can be —
      a colour to a colour, a length back into its own unit. Anything left at
      its default is not stored at all, which is what makes putting one back
      the same as never having touched it.
    */
    cssVars: cleanVars(
      incoming?.cssVars,
      readFields(currentLook(cleanCss(incoming?.css, MAX_LAYER_CSS)), currentLook(cleanCss(incoming?.motionCss, MAX_LAYER_CSS))),
    ),

    /*
      When the layer is allowed to draw itself.

      On the layer rather than in its config for the same reason rotation
      is: "only while a song is playing" means the same thing whatever the
      layer happens to be, and a box that appears with the song is as
      useful as the song card itself.
    */
    showWhen: CONDITION_IDS.includes(incoming?.showWhen) ? incoming.showWhen : 'always',
    showWhenNot: incoming?.showWhenNot === true,

    rotation: bounded(incoming?.rotation, -180, 180, 0),
    flipH: incoming?.flipH === true,
    flipV: incoming?.flipV === true,
    blendMode: BLEND_MODES.includes(incoming?.blendMode) ? incoming.blendMode : 'normal',
    blur: bounded(incoming?.blur, 0, 40, 0),
    // 100 is "as it was", so these are percentages rather than multipliers —
    // a person setting brightness thinks 120%, not 1.2.
    brightness: bounded(incoming?.brightness, 0, 300, 100),
    contrast: bounded(incoming?.contrast, 0, 300, 100),
    saturate: bounded(incoming?.saturate, 0, 300, 100),
    hueRotate: bounded(incoming?.hueRotate, -180, 180, 0),
    /*
      A drop-shadow rather than a box-shadow: it follows the alpha of what is
      actually drawn, so a logo with transparency casts the logo's shadow and
      not a rectangle's.
    */
    shadowBlur: bounded(incoming?.shadowBlur, 0, 80, 0),
    shadowX: bounded(incoming?.shadowX, -80, 80, 0),
    shadowY: bounded(incoming?.shadowY, -80, 80, 0),
    shadowColor: colour(incoming?.shadowColor, '#000000cc'),
    // Per-layer overrides — which chat theme, how tall the omnibar is. Passed
    // through rather than validated here: each surface already validates its
    // own configuration, and duplicating those rules is how they drift apart.
    config: type === 'nameplate' ? normaliseNameplate(incoming?.config)
      : type === 'images' ? normaliseImages(incoming?.config)
        : type === 'goal' ? normaliseGoal(incoming?.config)
        : type === 'plan' ? normalisePlanLayer(incoming?.config)
        : type === 'question' ? normaliseQuestionLayer(incoming?.config)
        : type === 'text' ? normaliseTextLayer(incoming?.config)
        : type === 'shape' ? normaliseShape(incoming?.config)
        : type === 'runcard' ? normaliseRunCard(incoming?.config)
        : type === 'roster' ? normaliseRoster(incoming?.config)
        : type === 'players' ? normalisePlayersLayer(incoming?.config)
        : type === 'poll' ? normalisePollLayer(incoming?.config)
        : type === 'voice' ? normaliseVoiceLayer(incoming?.config)
        : type === 'avatar' ? normaliseAvatarLayer(incoming?.config)
        : type === 'pngtuber' ? normalisePngtuberLayer(incoming?.config)
        : type === 'hypetrain' ? normaliseHypeTrainLayer(incoming?.config)
        : type === 'shoutout' ? normaliseShoutoutLayer(incoming?.config)
        : type === 'leaderboard' ? normaliseLeaderboardLayer(incoming?.config)
        : type === 'giveaway' ? normaliseGiveawayLayer(incoming?.config)
        : type === 'source' ? normaliseSourceLayer(incoming?.config)
        : type === 'chat' ? normaliseChatLayer(incoming?.config, chatFallback())
          : (incoming?.config && typeof incoming.config === 'object' ? incoming.config : {}),
  };
}

/**
 * Validate and fill in one layout.
 *
 * Layer order is the stacking order, back to front, so the array's own order
 * is the z-order and there is no separate index to keep in sync.
 */
/**
 * As many layers as one layout may hold.
 *
 * The list of types used to be the ceiling. Now that some kinds repeat,
 * there has to be one on purpose: every layer is a live DOM subtree in a
 * browser source, and a layout with four hundred of them would cost frames
 * on stream rather than fail in a way anybody could see.
 */
export const MAX_LAYERS = 40;

/**
 * How much stylesheet one layout may carry.
 *
 * Enough for the kind of thing this is for — a few rules against the layer
 * hooks — and not enough to be a way to move a megabyte through the config
 * that every client receives in full on connect.
 */
const MAX_CUSTOM_CSS = MAX_CANVAS_CSS;

/**
 * How much stylesheet one layer may carry.
 *
 * Smaller than the layout's, because a canvas can hold forty layers and all
 * of it travels in the config every client receives on connect. Generous for
 * what this is actually for — a handful of rules about one shape.
 */
const MAX_LAYER_CSS = MAX_SCOPED_CSS;


const cleanCustomCss = (v) => cleanCss(v, MAX_CUSTOM_CSS);

export function normaliseLayout(incoming) {
  const seen = new Set();
  const ids = new Set();
  const layers = (Array.isArray(incoming?.layers) ? incoming.layers : [])
    .filter((l) => LAYER_TYPES.includes(l?.type))
    // One per type, for the kinds where a second copy would draw the same
    // thing twice. A later duplicate is dropped rather than replacing the
    // first, so the order somebody arranged is the order that survives.
    .filter((l) => REPEATABLE.includes(l.type) || (!seen.has(l.type) && seen.add(l.type)))
    .slice(0, MAX_LAYERS)
    .map((l) => normaliseLayer(l, l.type))
    // Two layers with one id would make the editor move both at once.
    .map((l) => {
      while (ids.has(l.uid)) l.uid = newId();
      ids.add(l.uid);
      return l;
    });
  // Groups that hold something, layers only in groups that exist, and each group's layers side by side.
  const grouped = tidyGroups(layers, incoming?.groups);

  return {
    // The id is what a browser source URL carries, so it is held to what
    // survives one: an ampersand or a hash in it would truncate the query and
    // the source would quietly load a different layout, or none.
    id: safeId(incoming?.id),
    name: String(incoming?.name || 'Overlay').slice(0, 60),

    /*
      What the whole canvas is made of, so a brand is set once rather than
      nine times.

      The font is inherited by anything that has not chosen one, which is
      ordinary CSS cascade rather than a mechanism. The accent is a custom
      property the layers read, so a colour left unset follows the canvas
      and a colour somebody actually chose stays chosen — which is why
      these do not overwrite anything already saved.
    */
    fontFamily: safeFontName(incoming?.fontFamily),
    /*
      An empty accent is kept as "none" rather than filled in: a layout can
      choose to have no accent, and then every layer falls back to its own
      default — pink for most, white for SimonSays Default. Only a layout
      saved before the choice existed, with no accent field at all, is given
      the pink it always had.
    */
    accent: incoming?.accent === '' ? '' : colour(incoming?.accent, '#f43f5e'),

    /*
      The escape hatch. Everything else here is a control with a name; this
      is for the look somebody has in mind that no control covers.
    */
    css: cleanCustomCss(incoming?.css),
    width: bounded(incoming?.width, CANVAS.min, CANVAS.max, CANVAS.width),
    height: bounded(incoming?.height, CANVAS.min, CANVAS.max, CANVAS.height),
    // Transparent unless a colour is chosen: a browser source sits over the
    // scene, and anything else hides what is underneath.
    background: incoming?.background === 'transparent' ? 'transparent' : colour(incoming?.background, 'transparent'),
    // Which OBS scenes show this layout. Empty means it is only reachable by
    // naming it in the URL.
    scenes: cleanScenes(incoming?.scenes),
    // What the layout is for — a scene type's id (scene-types.js) — so a command can ask for the type.
    ...(cleanTypeId(incoming?.sceneType) ? { sceneType: cleanTypeId(incoming.sceneType) } : {}),
    ...(grouped.groups.length ? { groups: grouped.groups } : {}),
    layers: grouped.layers,
  };
}

/**
 * Nothing until someone builds one.
 *
 * No starter layout is shipped: an empty list renders nothing, whereas a
 * sample would put somebody's chat on stream the first time they pointed OBS
 * at the canvas URL.
 */
export const DEFAULT_LAYOUTS = [];

/** The kinds of layer whose settings carry the mark (see SETTINGS_VERSION). */
const MARKED_KINDS = new Set(['text', 'goal', 'voice', 'nameplate', 'players', 'poll']);

/**
 * How many layers were stored before their settings could be left automatic,
 * and so still hold an old default as though it had been chosen. Only saving
 * them fixes that, and layouts are read from disk as they are.
 */
export function settingsBehind(layouts) {
  if (!Array.isArray(layouts)) return 0;
  return layouts.reduce((n, l) => n + (l?.layers || [])
    .filter((y) => (MARKED_KINDS.has(y?.type) && !readSettings(y.config))
      // Or wearing an old copy of a look, which does not read the settings.
      || supersededLook(y?.css) || supersededLook(y?.motionCss)).length, 0);
}

/** Validate a whole list, dropping anything malformed. */
export function normaliseLayouts(incoming) {
  if (!Array.isArray(incoming)) return [];
  const seen = new Set();
  const claimed = new Set();
  const typed = new Set();
  return incoming
    .map(normaliseLayout)
    // Ids address a layout in the browser source URL, so a duplicate would
    // make which one you get a coin flip.
    .filter((l) => !seen.has(l.id) && seen.add(l.id))
    .slice(0, MAX_LAYOUTS)
    // One scene cannot show two layouts at once. The first claim wins, so the
    // canvas never has to guess and the editor never shows a binding that
    // would not actually take effect.
    .map((l) => ({ ...l, scenes: l.scenes.filter((s) => !claimed.has(s) && claimed.add(s)) }))
    // And one layout per scene type, the same way: asking for a type has to mean one layout.
    .map((l) => {
      if (!l.sceneType) return l;
      if (!typed.has(l.sceneType)) { typed.add(l.sceneType); return l; }
      const { sceneType, ...rest } = l;
      return rest;
    });
}

/**
 * The layout an OBS scene should display, or null for none.
 *
 * Exported so the canvas and the tests agree on the rule rather than each
 * having their own copy of it.
 */
export function layoutForScene(layouts, sceneName) {
  if (!Array.isArray(layouts) || !sceneName) return null;
  return layouts.find((l) => Array.isArray(l.scenes) && l.scenes.includes(sceneName)) || null;
}
