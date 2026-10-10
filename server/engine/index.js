/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The engine: subscribes to the bus and turns raw platform activity into
 * commands, actions, alerts and tags.
 *
 * This module is the piece that used to live in the browser's
 * `useStreamSystem` hook. Moving it here is the whole point of V3 — the
 * pipeline now runs whether or not anything is rendering it.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { DEFAULT_CHAT, cleanChatSettings, normaliseChatLayer, isWholeChat } from './chat-settings.js';
import { dockBuiltin, DOCK_FACE_SECONDS } from '../../shared/dock-builtins.js';
import { MAX_DOCK_PAGES, pageCount, cleanPageNames, pagerPlace, sidewaysMode } from '../../shared/dock-pages.js';
import { AVATAR_ACTIONS_LIST } from '../../shared/avatar.js';
import { HOUSE_CHARACTER } from '../../shared/house-avatar.js';
import { youtubeCategoryName } from '../../shared/youtube-categories.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import { buildContext } from './variables.js';
import { runSteps } from './steps.js';
import * as commands from './commands.js';
import * as cooldowns from './cooldowns.js';
import * as alerts from './alerts.js';
import * as tags from './tags.js';
import * as countdown from './countdown.js';
import * as omnilayer from './omnilayer.js';
import { controlAlerts } from './alert-gate.js';
import * as remotePlayers from './remote-players.js';
import * as stopwatch from './stopwatch.js';
import * as counters from './counters.js';
import * as polls from './polls.js';
import * as giveaway from './giveaway.js';
import * as pngtuber from './pngtuber.js';
import * as pixelAvatars from './pixel-avatars.js';
import * as userThemes from './user-themes.js';
import * as twitchExtras from './twitch-extras.js';
import * as streamPlan from './plan.js';
import { getAnnounce } from './announce.js';
import { DEFAULT_LAYOUTS, normaliseLayouts, settingsBehind, readSettings, lookColour, SETTINGS_VERSION, setChatFallback, cleanAvatarSources, newAvatarSourceId, MAX_AVATAR_SOURCES } from './layouts.js';
import { supersededLook, looksNow } from '../../shared/looks-history.js';
import * as profiles from './profiles.js';
import * as sceneTypes from './scene-types.js';
import * as backup from './backup.js';
import { cleanPlayers, cleanName, sameName, readColour, colourFor, MAX_PLAYERS, PLAYER_STATES } from '../../shared/players.js';
import { MAX_COMMENTATORS, cleanPerson, sameGame } from '../../shared/run.js';
import * as people from './people.js';
import * as questionsModule from './questions.js';
import * as repeat from './repeat.js';
import {
  isViewerEvent, withViewerEvent, emptyTotals, addToTotals, canThank, thanksFor, DEFAULT_THANKS,
} from '../../shared/viewer-events.js';

const log = createLogger('engine');

const EVENT_HISTORY_LIMIT = 100;
/** The shortest pause before "started talking in the call" counts; the call says when it is shorter (discord-voice.js). */
export const MIN_CALL_QUIET_S = 10;

/**
 * How many chat lines are kept so a freshly-opened surface has something to
 * show. Chat is otherwise pure broadcast: a dock that reloads, or a server
 * that restarts, came back to an empty panel until the next viewer typed.
 * Small on purpose — this is a seed, not an archive.
 */
const RECENT_CHAT_LIMIT = 20;

/** How much of a viewer's message may go on the bar. */
const OMNIBAR_TEXT_LIMIT = 120;

/**
 * How many omnibars there can be besides Main. Enough for a bar per kind of
 * scene; past that it is a list nobody can find their way around.
 */
const MAX_OMNIBARS = 8;

/**
 * The omnibar, off until someone turns it on — it is a broadcast overlay, and
 * most people running this will never put one on screen.
 *
 * Items rotate in order; each is shown for its own `seconds` or the bar's
 * default. The types are limited to state the server actually holds, so an
 * item can never promise something there is no data for.
 */
const DEFAULT_OMNIBAR = {
  enabled: false,
  items: [],
  defaultSeconds: 12,
  style: {
    position: 'bottom',
    height: 64,
    // Empty is automatic: the look's colour, or the bar's own without one
    // (see OMNIBAR_OLD_COLOURS).
    background: '',
    textColor: '',
    accentColor: '',
    fontSize: 22,
    uppercase: true,
    transition: 'slide',
    settingsVersion: SETTINGS_VERSION,
  },
};

/**
 * The bar's own colours, drawn when it has no look — and what every bar
 * stored before a colour could be left automatic held in full, as though
 * somebody had chosen them. Read once as automatic (see SETTINGS_VERSION).
 */
const OMNIBAR_OLD_COLOURS = { background: '#0b0b0ecc', textColor: '#ffffff', accentColor: '#f43f5e' };

/**
 * The viewer counter overlay.
 *
 * Server-side like the other overlays: the browser source in OBS and the
 * screen you configure it on are usually different machines.
 */
const DEFAULT_VIEWERS = {
  mode: 'total',
  showIcon: true,
  showOffline: false,
  platforms: { twitch: true, youtube: true, tiktok: true },
  style: {
    fontSize: 28,
    // Empty is automatic: the look's colour, or the counter's own without one
    // (see VIEWERS_OLD_COLOURS).
    color: '',
    accentColor: '',
    background: '',
    transparent: true,
    settingsVersion: SETTINGS_VERSION,
  },
};

/**
 * The counter's own colours, drawn when it has no look — and what every
 * counter stored before a colour could be left automatic held in full.
 * Read once as automatic (see SETTINGS_VERSION).
 */
const VIEWERS_OLD_COLOURS = { color: '#ffffff', accentColor: '#f43f5e', background: '#0b0b0ecc' };


/**
 * What is being played, and who is on.
 *
 * One record rather than a list of them. A marathon keeps a schedule of runs
 * and points at one; this app already has that — the stream plan — and asking
 * somebody to maintain a second list so an overlay can read a game title
 * would be worse than asking them to type the title.
 *
 * It exists because a dozen places want the same few facts. The game card
 * wants the title and the year, the lower third wants who is playing, a text
 * layer wants the category, and without this each of them is somewhere else
 * to remember to edit when the game changes.
 *
 * The estimate is text, not a duration. It is only ever displayed, nothing
 * counts against it, and a field that insists on h:mm:ss is a field that
 * refuses "about an hour".
 */
const DEFAULT_RUN = {
  game: '', platform: '', year: '', category: '', estimate: '',
  runner: { name: '', subtitle: '' },
  host: { name: '', subtitle: '' },
  commentators: [],
  /** The Twitch category the card last followed; null until it has seen one. */
  twitchCategoryId: null,
};

/*
  The choices behind the chat style tokens live in shared/, beside the ones the
  editor builds its controls from, so a control cannot offer something this
  would then quietly drop.
*/

/** What an omnibar item may be. Anything else is dropped on save. */
const OMNIBAR_TYPES = [
  'text',
  'latestFollower',
  'latestSubscriber',
  'latestDonation',
  'topDonation',
  'latestRaid',
  'nowPlaying',
  'upNext',
  'countdown',
  'commands',
  'topChatters',
  'topSubscribers',
  'recentEvents',
  'goal',
];

/** What a goal slot can count, the same list a goal layer offers. */
const OMNIBAR_GOAL_SOURCES = ['manual', 'followers', 'subs', 'viewers', 'tiktokLikes'];

/**
 * Shared by every overlay validator.
 *
 * Values from a client end up interpolated into inline styles on a surface
 * that is on stream, so they are checked rather than trusted. An out-of-range
 * number is clamped into range; only something that is not a number at all
 * falls back to the default.
 */
const colour = (v, fallback) => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v || '') ? v : fallback);
const bounded = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/** The identity a button press runs as. Audible via `{user}` in TTS and chat. */
const DOCK_ACTION_USER = 'Dock Actions';

/**
 * Fill in the optional parts of a command.
 *
 * V2 applied these defaults every time it loaded commands; V3 stored and
 * returned them verbatim, so a command saved without `ignoreCooldowns` came
 * back without it. The Studio view's toggle handler does
 * `prev.ignoreCooldowns![role]` — a TypeScript non-null assertion, which is
 * erased at runtime — so clicking one threw and blanked the whole UI.
 *
 * Normalising here rather than in the view keeps the stored data complete for
 * every consumer, including the engine's own permission and cooldown checks.
 */
function normaliseCommand(c) {
  return {
    ...c,
    name: c.name || c.trigger || 'Command',
    triggers: c.triggers || (c.trigger ? [c.trigger] : []),
    permissions: {
      anyone: c.permissions?.anyone ?? true,
      vips: c.permissions?.vips ?? true,
      subscribers: c.permissions?.subscribers ?? true,
      moderators: c.permissions?.moderators ?? true,
      broadcaster: c.permissions?.broadcaster ?? true,
    },
    // Whether it runs when typed in Discord. On unless turned off on the command.
    discord: c.discord !== false,
    ignoreCooldowns: c.ignoreCooldowns ?? {
      broadcaster: true,
      moderators: true,
      vips: false,
      subscribers: false,
    },
  };
}

/**
 * Fill in a step whose editor showed a default it never saved.
 *
 * The camera step's dropdown rendered "Toggle flash" for a config that was
 * actually empty, so anyone who wanted the flash — the option already on
 * screen — never touched the control and stored nothing. The step then ran
 * with no operation and failed silently.
 *
 * Healed here rather than only in the editor, because actions saved before the
 * fix are already on disk and would otherwise stay broken.
 *
 * The OBS on/off steps had the same trap the other way round. Their editors
 * light Enable, Show and Mute for a step that never stored a choice, while
 * the step read the missing value as false — so a filter step left on the
 * Enable it showed turned the filter off. The choice the editor showed is
 * written in, so the two agree. 'toggle' is a choice too, and is kept.
 */
const SHOWN_ON = { obs_filter_toggle: 'filterEnabled', obs_visibility: 'visible', obs_set_mute: 'muted' };
const ON_OFF_CHOICES = [true, false, 'toggle'];

function normaliseAction(action) {
  const fix = (steps) => (Array.isArray(steps) ? steps.map((step) => {
    const next = { ...step };
    if (next.type === 'droidcam_control' && !next.config?.droidcamOperation) {
      // 'torch' is not a guess: it is exactly what the editor displayed.
      next.config = { ...(next.config || {}), droidcamOperation: 'torch' };
    }
    const flag = SHOWN_ON[next.type];
    if (flag && !ON_OFF_CHOICES.includes(next.config?.[flag])) {
      next.config = { ...(next.config || {}), [flag]: true };
    }
    if (next.thenActions) next.thenActions = fix(next.thenActions);
    if (next.elseActions) next.elseActions = fix(next.elseActions);
    return next;
  }) : steps);

  return { ...action, actions: fix(action.actions) };
}

let db = null;
/**
 * Save the players list and tell every screen. Every change goes through
 * here, so what a command did and what the dashboard did look the same.
 */
function savePlayers(next) {
  const clean = cleanPlayers(next);
  db.players.set(clean);
  bus.emit(EVENTS.CONFIG, { key: 'players', value: clean });
  return clean;
}

/** The index of a player by name, however it was typed. */
const findPlayer = (list, name) => list.findIndex((p) => sameName(p.name, name));

/**
 * What a command may do to the list. Each answers whether it did anything,
 * so a step can say so in the log rather than failing silently.
 */
const playersService = {
  /*
    Joining again is not a second copy: a name already on the list is put
    back in the game, and takes the new colour if one was given.
  */
  join(rawName, rawColour) {
    const name = cleanName(rawName);
    if (!name) return false;
    const list = db.players.get().items || [];
    const colour = readColour(rawColour);
    const at = findPlayer(list, name);
    if (at >= 0) {
      savePlayers({ items: list.map((p, i) => (i === at ? { ...p, colour: colour || p.colour, state: 'in' } : p)) });
      return true;
    }
    if (list.length >= MAX_PLAYERS) {
      log.warn(`players: the list is full (${MAX_PLAYERS}) — "${name}" was not added`);
      return false;
    }
    savePlayers({ items: [...list, { name, colour: colour || colourFor(name), state: 'in' }] });
    return true;
  },
  setState(rawName, state) {
    if (!PLAYER_STATES.includes(state)) return false;
    const list = db.players.get().items || [];
    const at = findPlayer(list, rawName);
    if (at < 0) {
      log.warn(`players: nobody called "${cleanName(rawName)}" is on the list`);
      return false;
    }
    savePlayers({ items: list.map((p, i) => (i === at ? { ...p, state } : p)) });
    return true;
  },
  remove(rawName) {
    const list = db.players.get().items || [];
    const at = findPlayer(list, rawName);
    if (at < 0) return false;
    savePlayers({ items: list.filter((_, i) => i !== at) });
    return true;
  },
  /** A new round: everybody back in, nobody removed. */
  reset() {
    savePlayers({ items: (db.players.get().items || []).map((p) => ({ ...p, state: 'in' })) });
    return true;
  },
  clear() {
    savePlayers({ items: [] });
    return true;
  },
};

let services = null;

/** How many chat layers in a set of layouts still lean on the shared chat, or wear an old copy of a look. */
const chatBehind = (layouts) => (layouts || []).reduce((n, l) => n + (l.layers || []).filter((y) => y.type === 'chat'
  && (!isWholeChat(y.config) || supersededLook(y.config?.css) || supersededLook(y.config?.motionCss))).length, 0);

/** The same layouts with every chat layer holding a whole set of its own, filled from `fallback` where it held less. */
const withWholeChat = (layouts, fallback) => (layouts || []).map((l) => ({
  ...l,
  layers: (l.layers || []).map((y) => (y.type !== 'chat' ? y : { ...y, config: normaliseChatLayer(y.config, fallback) })),
}));

export function initEngine(platformServices) {
  services = {
    ...platformServices,
    // Give steps a way to resolve `trigger_action` targets.
    actions: { getById: (id) => db.actions.get().find((a) => a.id === id) },
    // Lets an action put a viewer's words on the omnibar. Who may do that is
    // decided by the command's own permissions and cooldowns, which is the
    // gate this app already has — an omnibar slot does not need its own.
    omnibar: {
      setItemText: (slotId, text) => setOmnibarItemText(slotId, text),
      changeGoal: (slotId, mode, raw) => changeGoal(slotId, mode, raw),
    },
    // Same reasoning: the command that carries this step decides who may ask
    // and how often, so the queue itself needs no gate of its own.
    questions: { add: (q) => questionsModule.add(q) },
    // The players list, from a command. The command decides who may join,
    // and who may knock somebody out — the list needs no gate of its own.
    players: playersService,
    // A poll from a command — "!poll Question | answer | answer" — and closed
    // or cleared the same way. The command decides who may run one.
    poll: {
      open: (line) => polls.openFromLine(line),
      close: () => polls.control('close'),
      reset: () => polls.control('reset'),
    },
    // The giveaway, from an action: open the one set up (with a prize if given), stop entries, draw.
    giveaway: {
      open: (prize) => giveaway.openFromStep(prize),
      close: () => giveaway.control('close'),
      draw: () => giveaway.control('draw'),
    },
    // A face for the avatars on screen, for a few seconds, from any action.
    avatar: {
      face: (name, seconds) => pngtuber.showFace(name, seconds),
      dress: (what, words, minutes) => pngtuber.dressAvatar(what, words, minutes),
      act: (words) => pngtuber.playAvatarAction(words),
    },
    // Shoutouts, clips and stream markers, from any action.
    twitchExtras: {
      shoutout: (target) => twitchExtras.shoutout(target),
      clip: () => twitchExtras.clip(),
      marker: (description) => twitchExtras.marker(description),
    },
    // And again for the run card, which is how a mod keeps it right from
    // chat without being handed the dashboard.
    run: {
      setField: (field, value) => updateRun((prev) => ({ ...prev, [field]: value })),
      setPerson: (role, fields, seat) => updateRun((prev) => withPerson(prev, role, fields, seat)),
      clear: (what) => updateRun((prev) => clearedRun(prev, what)),
    },
    plan: streamPlan.service,
    layouts: { setTextLayer: (layoutId, uid, text) => setTextLayer(layoutId, uid, text) },
    // The run timer, for a step and a deck button alike.
    timer: { control: (op, value) => stopwatch.control(op, value) },
    countdown: { act: (op, opts) => countdown.act(op, opts) },
    omnilayer: { goLive: (layoutId, opts) => omnilayer.goLive(layoutId, opts), goLiveType: (typeId, opts) => omnilayer.goLiveType(typeId, opts), hasType: (typeId) => omnilayer.getOmnilayer().types.some((x) => x.id === typeId) },
    counters: { change: (name, op, amount) => counters.changeCounter(name, op, amount) },
    // Whose game is on screen in the Gameplay layouts, and whether the layout on stream shows the players at all.
    remotePlayers: {
      putOnScreen: (words) => remotePlayers.putOnScreen(words),
      liveShowsPlayers: () => Boolean(omnilayer.onAir()?.layers?.some((y) => y.type === 'source' && y.visible !== false && remotePlayers.isPlayerSource(y.config?.source))),
    },
  };

  db = {
    commands: collection('commands', []),
    actions: collection('actions', []),
    alerts: collection('alerts', []),
    history: collection('event_history', []),
    viewerEvents: collection('viewer_events', []),
    /* This stream's follows, subs, bits and the rest, from when it went live. See shared/viewer-events.js. */
    eventTotals: collection('event_totals', emptyTotals(Date.now())),
    /* What the Events dock's "Thank" says in chat. */
    eventsDock: collection('events_dock_settings', { thanks: DEFAULT_THANKS }),
    relay: collection('relay_config', { twitchToDiscord: false, tiktokToDiscord: false, kickToDiscord: false, youtubeToDiscord: false, discordToTwitch: false, discordToYoutube: false }),
    /*
      The shape of the button grid, held here rather than in each browser.

      The column count used to be a preference of whichever browser opened
      the screen, carried to the dock by writing it into the URL you copied.
      That worked while the grid was its own browser source and stopped the
      moment it became a panel of the chat dock, which is a different
      browser and cannot read the first one’s preferences.

      Rows at zero means as many as the buttons need, each cell square —
      which is what the grid did before there was anything to say otherwise.
    */
    dockGrid: collection('dock_grid', { columns: 3, rows: 0, pages: 1, pageNames: [''], pagerAt: 'bottom' }),
    recentChat: collection('recent_chat', []),
    // The rotating bar along the bottom of the stream. Server-side because it
    // is stream configuration rather than a display preference: the overlay in
    // OBS and the editor on a laptop have to agree about what it says.
    omnibar: collection('omnibar', DEFAULT_OMNIBAR),
    /* Every bar but Main, each with its own slots, named so a layer can pick one. */
    omnibars: collection('omnibars', []),
    // Named pixel avatars, which avatar layers on any layout can wear (layouts.js cleanAvatarSources).
    avatarSources: collection('avatar_sources', []),
    // Which actions appear on the Dock Actions surface, and in what order.
    // Server-side so the same buttons show up on every device, like the rest
    // of the configuration.
    dockButtons: collection('dock_buttons', []),
    viewers: collection('viewers', DEFAULT_VIEWERS),
    /*
      The things to check before going live.

      Not in a profile: it is a habit rather than a look, and the point of it
      is that it is the same list every time. Ticks live here too, so the list
      can be written at the desk and ticked off from a phone.
    */
    /* What is being played, and who is on. */
    run: collection('run', DEFAULT_RUN),
    /* Who is in tonight's game, for community nights. See shared/players.js. */
    players: collection('players', { items: [] }),
    // Overlays composed into one browser source. Server-side for the same
    // reason the omnibar is: OBS and the editor have to agree on the
    // arrangement, and it should survive a config export.
    layouts: collection('layouts', DEFAULT_LAYOUTS),
    /*
      The channel's point rewards, as Twitch last described them.

      Cached rather than fetched by whoever needs it: the alert editor names a
      reward by looking one up here, and it is the only thing that ever asked.
      Kept on disk so the name is there the moment a page loads, months after
      the fetch — the id in an alert is meaningless to read otherwise.
    */
    rewards: collection('twitch_rewards', []),
    /*
      The chat every layout used to share, kept as it was last left and no
      longer changed. Each chat layer keeps its own settings now; this is only
      what fills out one that still holds just what it overrode — a layout
      from before, live or in a saved profile, or in an old backup — so it
      looks the way it did the last time it was on stream.
    */
    chat: collection('chat_settings', DEFAULT_CHAT),
    /*
      The dock keeps its own complete set, in its own collection.

      The stream is for viewers and the dock is a tool for whoever is running
      it, so the two want different things from the same data: rank colours
      that tell you who is talking are useful at the desk and noise on stream.
      Being a separate collection is also what keeps the dock out of the
      profiles, since a collection is the unit a profile captures — switch to
      a different look for the stream and the desk stays where it was.
    */
    chatDock: collection('chat_dock_settings', DEFAULT_CHAT),
    /*
      What has already been done to this install, so a one-time change stays
      one-time. It travels in a backup on purpose: restoring somewhere else
      carries the fact that a rewrite already happened, rather than running
      it a second time over values somebody has since chosen for themselves.
    */
    upgrades: collection('upgrades', {}),
  };

  // Heal anything stored before these defaults existed, and persist it so the
  // file on disk is complete too.
  db.commands.update((prev) => prev.map(normaliseCommand));
  db.actions.update((prev) => prev.map(normaliseAction));
  // Alerts were stored unvalidated for a long time, so what is on disk names
  // animations that never existed. Healing on boot fixes them once rather
  // than leaving every old alert silently un-animated until it is re-saved.
  db.alerts.update((prev) => prev.map(alerts.normaliseAlert));

  // Tags push their value into an OBS text source when one is selected.
  tags.initTags(platformServices.obs);
  countdown.initCountdown();
  omnilayer.initOmnilayer({ obsService: platformServices.obs, layouts: () => db.layouts.get() });
  stopwatch.initStopwatch();
  counters.initCounters();
  // The bot tells chat when a poll opens and who won, and answers "!encuesta".
  polls.initPolls({ twitch: services.twitch });
  giveaway.initGiveaway({ twitch: services.twitch });
  pngtuber.initPngtuber(platformServices.obs);
  pixelAvatars.initPixelAvatars();
  userThemes.initUserThemes();
  twitchExtras.initTwitchExtras();

  // Profiles are initialised last: it snapshots and rewrites whole
  // collections, so every one of them has to exist first. The writers are
  // passed in rather than imported so a profile lands through the same
  // validation an ordinary save runs — dock buttons pointing at an action
  // that is not in the incoming profile get dropped here, not on stream.
  /*
    One-time: the dock used to be an override map on the shared settings.

    Each surface keeps exactly the look it had — the dock takes the shared
    values with its own differences folded in, the overlay the same with
    its own — so nothing moves on screen the first time this runs. The old
    maps are dropped in the process, which is also what stops it running
    twice.
  */
  const legacyChat = db.chat.get();
  if (legacyChat && (legacyChat.dockOverrides || legacyChat.overlayOverrides)) {
    db.chatDock.set(cleanChatSettings({ ...legacyChat, ...(legacyChat.dockOverrides || {}) }, DEFAULT_CHAT));
    db.chat.set(cleanChatSettings({ ...legacyChat, ...(legacyChat.overlayOverrides || {}) }, DEFAULT_CHAT));
    log.info('chat: the dock now keeps its own settings, separate from the overlay');
  }

  // A chat layer from before chat layers kept their own settings is filled out
  // from the chat it was drawn with — on every save, before anything below saves.
  setChatFallback(() => db.chat.get());

  /*
    One-time: plan layers that never chose how much of the list to show.

    Every save writes a mode, so a layer made before there was a screen to
    pick one on holds the default of the day — "upcoming" — as though it had
    been asked for. That made the newer default unreachable for every plan
    that already existed: the setting was there, nothing had chosen it, and
    nothing could change it. The ones still carrying that answer are moved
    to it once; from here it is a choice somebody made on a screen, so it is
    left alone.
  */
  /*
    Dock buttons stored before a button had a cell of its own. Saving them back
    through the same validation stamps each one with the cell a list would have
    put it in, so the file on disk says where everything is rather than leaving
    it to be worked out from the order every time it is drawn.
  */
  store.setDockButtons(db.dockButtons.get());

  const doneAlready = db.upgrades.get() || {};
  if (!doneAlready.planRecap) {
    let moved = 0;
    const next = (db.layouts.get() || []).map((l) => ({
      ...l,
      layers: (l.layers || []).map((y) => {
        if (y.type !== 'plan' || y.config?.mode !== 'upcoming') return y;
        moved += 1;
        return { ...y, config: { ...y.config, mode: 'recap' } };
      }),
    }));
    if (moved) {
      store.setLayouts(next);
      log.info(`plan: ${moved} plan layer(s) now keep the line just finished`);
    }
    db.upgrades.set({ ...doneAlready, planRecap: true });
  }

  /*
    Layers stored before a setting could be left to the look. Saving them back
    through the same validation empties what still holds the old default, so a
    look on the layer shows its own. Each layer carries the mark, so this runs
    once for each — and a profile saved long ago is caught the same way, by the
    same validation, whenever it is loaded.
  */
  const behind = settingsBehind(db.layouts.get());
  if (behind) {
    store.setLayouts(db.layouts.get());
    log.info(`layouts: ${behind} layer(s) brought up to date: defaults left to the look, looks to their current text`);
  }
  // The omnibars likewise: their colours are the bar's, whichever layer shows it.
  const barsBehind = [db.omnibar.get(), ...(db.omnibars.get() || [])].filter((b) => b && !readSettings(b.style)).length;
  if (barsBehind) {
    store.setOmnibar(db.omnibar.get());
    store.setOmnibars(db.omnibars.get());
    log.info(`omnibar: ${barsBehind} bar(s) now leave their look to decide what was left at the default`);
  }
  // Each alert carries its own, so each is read through once by its own mark.
  // Or wearing an old copy of a look, which does not read the alert's settings.
  const alertsBehind = (db.alerts.get() || []).filter((a) => a && (!readSettings(a) || supersededLook(a.css) || supersededLook(a.motionCss))).length;
  if (alertsBehind) {
    db.alerts.set((db.alerts.get() || []).map(alerts.normaliseAlert));
    log.info(`alerts: ${alertsBehind} alert(s) brought up to date: defaults left to the look, looks to their current text`);
  }
  /*
    Chat layers that still lean on the shared chat — holding nothing, or only
    the look a Library apply wrote — take a whole set of their own, filled
    from the chat they were drawn with, so nothing on stream moves. Or one
    wearing an old copy of a look, brought up to its current text. The saved
    overlay profiles are done the same way once they are loaded, below.
  */
  const chatLayersBehind = chatBehind(db.layouts.get());
  if (chatLayersBehind) {
    db.layouts.set(withWholeChat(db.layouts.get(), db.chat.get()));
    log.info(`chat: ${chatLayersBehind} chat layer(s) now keep their own settings`);
  }
  // And the viewer counter, one set of colours for every layer that shows it.
  if (!readSettings(db.viewers.get()?.style)) {
    store.setViewers(db.viewers.get());
    log.info('viewers: the counter now leaves its look to decide what was left at the default');
  }

  profiles.initProfiles({
    commands: (v) => db.commands.set((Array.isArray(v) ? v : []).map(normaliseCommand)),
    actions: (v) => db.actions.set((Array.isArray(v) ? v : []).map(normaliseAction)),
    dock_buttons: (v) => store.setDockButtons(v),
    alerts: (v) => db.alerts.set((Array.isArray(v) ? v : []).map(alerts.normaliseAlert)),
    layouts: (v) => store.setLayouts(v),
    omnibar: (v) => store.setOmnibar(v),
    omnibars: (v) => store.setOmnibars(v),
    viewers: (v) => store.setViewers(v),
    avatar_sources: (v) => db.avatarSources.set(cleanAvatarSources(v)),
  });
  // The saved overlay profiles' chat layers, filled out the same way as the live ones above —
  // done to the active one's saved copy too, so it does not read as unsaved for something nobody did.
  const savedChatBehind = profiles.rewriteSaved('overlays', 'layouts',
    (layouts) => (chatBehind(layouts) ? withWholeChat(layouts, db.chat.get()) : layouts));
  if (savedChatBehind) log.info(`chat: chat layers in ${savedChatBehind} saved overlay profile(s) now keep their own settings`);
  // Old copies of a look, in every saved profile's layers and alerts — the active one's copy too, as the
  // live ones were brought up to date above, so no profile reads as unsaved for a look that changed.
  const savedLooksBehind = profiles.rewriteSaved('overlays', 'layouts',
    (layouts) => (Array.isArray(layouts) ? layouts.map((l) => (Array.isArray(l?.layers) ? { ...l, layers: l.layers.map(looksNow) } : l)) : layouts))
    + profiles.rewriteSaved('alerts', 'alerts', (list) => (Array.isArray(list) ? list.map(looksNow) : list));
  if (savedLooksBehind) log.info(`looks: old copies brought up to date in ${savedLooksBehind} saved profile(s)`);

  // Diagnostics: confirm out loud the first time a message completes the trip
  // from a platform to the bus, then fall back to debug so a busy stream does
  // not flood the terminal. Run with LOG_LEVEL=debug to see every line.
  let sawFirstChat = false;
  bus.on(EVENTS.CHAT, (chat) => {
    if (!sawFirstChat) {
      sawFirstChat = true;
      log.info(`first chat received — ${chat.platform}/${chat.user}: "${chat.msg}" (pipeline is live)`);
    }
    log.debug(`[${chat.platform}] ${chat.user}: ${chat.msg}`);
  });

  // Newest first, matching the event history and the order the dock renders.
  // `raw` is dropped: it is the platform's whole tag blob, useful while the
  // message is being processed but not worth writing to disk twenty times over.
  bus.on(EVENTS.CHAT, ({ raw, ...chat }) => {
    db.recentChat.update((prev) => [chat, ...prev].slice(0, RECENT_CHAT_LIMIT));
  });

  // A moderator removing a message has to remove it from here too, or a
  // restart would put the deleted content back on screen.
  bus.on(EVENTS.CHAT_DELETE, ({ msgIds = [], userIds = [] }) => {
    if (msgIds.length === 0 && userIds.length === 0) return;
    db.recentChat.update((prev) => prev.filter(
      (m) => !msgIds.includes(m.id) && !userIds.includes(m.userId),
    ));
  });

  /*
    Keep the reward names Twitch last gave us.

    Trimmed to the two fields anything here uses rather than stored whole: the
    rest is prompt text, cooldowns and images that nothing reads, and all of it
    would travel to every client in the snapshot. Checked as well as trimmed —
    the title is drawn in the editor, and an account may name a reward
    anything at all.
  */
  bus.on(EVENTS.REWARD_LIST, (incoming) => {
    const clean = (Array.isArray(incoming) ? incoming : [])
      .map((r) => ({ id: String(r?.id ?? '').slice(0, 100), title: String(r?.title ?? '').slice(0, 120) }))
      .filter((r) => r.id)
      .slice(0, 200);
    /*
      An empty answer is almost always a failed or unauthorised fetch rather
      than a channel with no rewards, and replacing good names with none
      helps nobody — the id would be all the editor could show again.
    */
    if (!clean.length) return;
    db.rewards.set(clean);
    /*
      Told to the pages that are already open, not only to the next one to
      load. The first fetch happens when Twitch connects, which is usually
      after the editor is on screen — without this it would sit there showing
      an id until somebody reloaded it.
    */
    bus.emit(EVENTS.CONFIG, { key: 'rewards', value: clean });
    log.info(`rewards cached — ${clean.length} from Twitch`);
  });

  /*
    The stream plan: what a step starting asks of the channel, "!plan" in
    chat, and the recap when the stream stops. See plan.js.
  */
  streamPlan.initPlan({
    twitch: services.twitch,
    youtube: services.youtube,
    discord: services.discord,
    marker: (text) => twitchExtras.marker(text),
    announceChannel: () => getAnnounce().channelId,
    // The stream recap carries the plan when it is on: then the plan's own post would say it twice.
    recapHasPlan: () => Boolean(getAnnounce().recap?.enabled && getAnnounce().recap?.parts?.plan !== false),
    // A step's run card, through the same path every other change to the run takes.
    setCard: (card) => updateRun((prev) => ({ ...prev, ...card })),
  });

  /*
    Regulars, crews and the Discord call, around the seats on the run. They
    change the seats through the run's own path, like everything else. See
    people.js.
  */
  people.initPeople({ getRun: () => db.run.get(), setRun: (change) => updateRun(change) });

  /*
    Questions from viewers: "!pregunta" out of the box, a waiting question
    going with a deleted message, and the queue when the stream ends. See
    questions.js.
  */
  questionsModule.initQuestions({ twitch: services.twitch, discord: services.discord });

  bus.on(EVENTS.CHANNEL, onChannel);

  bus.on(EVENTS.CHAT, onChat);
  // The rest of the Discord server: its commands work too, unless that is turned off on Connections.
  bus.on('discord:message_elsewhere', (chat) => {
    if (services.discord?.commandsEverywhere?.() === false) return;
    onChat(chat).catch((err) => log.warn(`command from Discord failed: ${err.message}`));
  });
  bus.on(EVENTS.EVENT, onEvent);
  bus.on(EVENTS.TRIGGER, (event) => { runTriggered(event).catch((err) => log.warn(`${event?.type} actions failed: ${err.message}`)); });

  // "Every few minutes": actions that repeat, while live and once chat has said enough. See repeat.js.
  repeat.initRepeat({
    actions: () => db.actions.get(),
    obsStreaming: () => Boolean(platformServices.obs?.isStreaming?.()),
    run: (action) => runSteps(action.actions, buildContext({
      user: { name: '', platform: 'system' },
      nowPlaying: services.spotify?.getNowPlaying?.() ?? null,
      upNext: services.spotify?.getUpNext?.() ?? null,
      platform: 'system',
    }), services),
    autoTick: platformServices.repeatAutoTick !== false,
  });

  log.info(`ready — ${db.commands.get().length} commands, ${db.actions.get().length} actions, ${db.alerts.get().length} alerts`);
}

/**
 * Change the run card and tell every surface.
 *
 * Everything goes back through `store.setRun`, so a value from chat is
 * trimmed and bounded by exactly the rules the Game screen's are — a year that
 * is not four digits is dropped there, not here.
 */
function updateRun(change) {
  const next = store.setRun(change(db.run.get()));
  bus.emit(EVENTS.CONFIG, { key: 'run', value: next });
  return next;
}

/**
 * The run with one person's name or second line changed.
 *
 * A field that is not in `fields` is left as it was, so a step can change
 * somebody's pronouns without retyping their name. Commentators are by seat,
 * counted from one the way the Who's on screen lists them; asking for a seat past
 * the last fills the gap with empty ones, which draw nothing.
 */
function withPerson(run, role, fields, seat) {
  const pick = () => ({
    ...(fields.name !== undefined ? { name: fields.name } : {}),
    ...(fields.subtitle !== undefined ? { subtitle: fields.subtitle } : {}),
  });
  /*
    A different name is a different person: the last one's Twitch login and
    Discord account do not come with the seat, or "!host Ana" would shout out
    whoever hosted before her.
  */
  const into = (current = {}) => {
    const next = { ...current, ...pick() };
    const renamed = fields.name !== undefined
      && String(current.name ?? '').trim().toLowerCase() !== String(fields.name ?? '').trim().toLowerCase();
    if (renamed) { delete next.twitch; delete next.discordId; }
    return next;
  };
  if (role === 'runner' || role === 'host') {
    return { ...run, [role]: into(run[role] || {}) };
  }
  if (role !== 'commentator') return run;
  const at = Math.floor(Number(seat)) - 1;
  if (!(at >= 0 && at < MAX_COMMENTATORS)) {
    log.warn(`run card: there is no commentator seat ${seat} — seats go from 1 to ${MAX_COMMENTATORS}`);
    return run;
  }
  const seats = [...(run.commentators || [])];
  while (seats.length <= at) seats.push({ name: '', subtitle: '' });
  seats[at] = into(seats[at]);
  return { ...run, commentators: seats };
}

/**
 * The run with part of it emptied.
 *
 * `details` is the game and what is printed about it, `people` is everyone
 * sitting at it, and `all` is both — the end of a run. What the card last saw
 * of the Twitch category is kept whichever it is, or clearing the card would
 * look like a category change the next time the server connects.
 */
function clearedRun(run, what) {
  const details = { game: '', platform: '', year: '', category: '', estimate: '' };
  const people = { runner: { name: '', subtitle: '' }, host: { name: '', subtitle: '' }, commentators: [] };
  if (what === 'details') return { ...run, ...details };
  if (what === 'people') return { ...run, ...people };
  if (what === 'commentators') return { ...run, commentators: [] };
  return { ...run, ...details, ...people };
}

/**
 * Follow the Twitch category onto the run card.
 *
 * Only a change of category counts. Twitch announces a title edit the same way,
 * and a card that reset whenever the title was touched would undo whatever a
 * mod had just set. The platform and year are emptied rather than kept: they
 * were facts about the last game, and printed under the new one they would be
 * wrong. A category that is not a game — Just Chatting — becomes the card's
 * title like any other, with nothing under it.
 *
 * The first time the server ever hears the category it only takes note. The
 * card may already say what is being played, in words chosen on purpose, and
 * the first connect is not a change.
 *
 * The platform and year could be looked up rather than emptied: IGDB has
 * both, and signs in with the same Twitch app. It is left for later because
 * it needs that app's client secret, which this server has not needed so far.
 */
function onChannel({ categoryId, categoryName, initial } = {}) {
  const run = db.run.get();
  const seen = run.twitchCategoryId;
  if (seen === categoryId) return;
  if (initial && (seen === null || seen === undefined)) {
    store.setRun({ ...run, twitchCategoryId: categoryId });
    log.info(`run card: noted the Twitch category "${categoryName || 'none'}"`);
    return;
  }
  /*
    The details belong to the game they were typed for.

    A category naming the game already on the card keeps them: setting Twitch
    to the game just typed in used to wipe its platform and year. A different
    game takes all of them away, the speedrun category and the estimate too —
    "Any% · EST 1:20:00" left under the next game is wrong in a way nobody
    notices until it is on stream.
  */
  /*
    The plan's step asked for this category and says what its card reads: the
    step's card stays — its own title and all — rather than the category's
    name going up and the details being cleared a moment after the step put
    them there.
  */
  const planned = streamPlan.cardForCategory(categoryId, categoryName);
  if (planned) {
    updateRun((prev) => ({ ...prev, ...planned, twitchCategoryId: categoryId }));
    log.info(`run card: Twitch category is "${categoryName}", as the plan's step asked — its card kept`);
    return;
  }
  if (sameGame(run.game, categoryName)) {
    store.setRun({ ...run, twitchCategoryId: categoryId });
    log.info(`run card: Twitch category is "${categoryName}", the game already on the card — kept its details`);
    return;
  }
  updateRun((prev) => ({ ...prev, game: categoryName, platform: '', year: '', category: '', estimate: '', twitchCategoryId: categoryId }));
  log.info(`run card: Twitch category is now "${categoryName || 'none'}"${initial ? ' (changed while away)' : ''}`);
}

/**
 * Write into one text layer of one layout.
 *
 * The layer is found by the id it keeps however it is moved or restyled, and
 * only a text layer is written — an id that now names something else, or
 * nothing, is a step pointing at a layer that was deleted, and it says so in
 * the log instead of guessing. The layouts go back through the same check the
 * editor's saves do, so the text is capped exactly as if it had been typed.
 */
function setTextLayer(layoutId, uid, text) {
  const layouts = db.layouts.get() || [];
  const layout = layouts.find((l) => l.id === layoutId);
  const layer = layout?.layers?.find((l) => l.uid === uid && l.type === 'text');
  if (!layer) {
    log.warn(`text layer: no text layer "${uid}" in layout "${layout?.name || layoutId}" — it may have been deleted`);
    return null;
  }
  const next = store.setLayouts(layouts.map((l) => (l.id !== layoutId ? l : {
    ...l,
    layers: l.layers.map((y) => (y.uid !== uid ? y : { ...y, config: { ...(y.config || {}), text } })),
  })));
  bus.emit(EVENTS.CONFIG, { key: 'layouts', value: next });
  log.info(`text layer in "${layout.name}" set to "${String(text).slice(0, 60)}"`);
  return next;
}

const SCENE_TYPE_OPS = ['types', 'types_from_bindings', 'convert_steps'];

/** The layouts saved now, through the same check the editor's saves go through, and told to every screen. */
function saveLayoutsHere(layouts) {
  const next = store.setLayouts(layouts);
  bus.emit(EVENTS.CONFIG, { key: 'layouts', value: next });
  return next;
}

/**
 * Scene types (scene-types.js): the list, which Omnilayer keeps; types made
 * from the OBS scene bindings the layouts already have; and the commands that
 * name a layout turned to name its type.
 *
 * A type only means something if every profile has its layouts tagged, so
 * the saved profiles are changed along with what is live — each the same way,
 * so a profile with no unsaved changes still has none afterwards.
 */
function sceneTypeControl(payload) {
  const op = payload.op;
  if (op === 'types') {
    const state = omnilayer.configure({ types: sceneTypes.cleanSceneTypes(payload.types) });
    // A type taken off the list is taken off the layouts too, so none keeps a tag nothing can pick.
    const live = db.layouts.get() || [];
    const untagged = sceneTypes.untagGone(live, state.types);
    if (untagged !== live) saveLayoutsHere(untagged);
    profiles.rewriteSaved('overlays', 'layouts', (layouts) => sceneTypes.untagGone(layouts, state.types));
    return state;
  }
  if (op === 'types_from_bindings') {
    const live = db.layouts.get() || [];
    const types = sceneTypes.typesFromBindings(omnilayer.getOmnilayer().types, [live, ...profiles.savedData('overlays', 'layouts')]);
    const state = omnilayer.configure({ types });
    const tagged = sceneTypes.tagByBindings(live, state.types);
    if (tagged.tagged) saveLayoutsHere(tagged.layouts);
    const touched = profiles.rewriteSaved('overlays', 'layouts', (layouts) => sceneTypes.tagByBindings(layouts, state.types).layouts);
    log.info(`scene types: ${state.types.length} from the scene bindings, layouts tagged in ${touched} profile(s)`);
    return { ...state, made: { types: state.types.length, profiles: touched, live: tagged.tagged } };
  }
  // convert_steps
  const types = omnilayer.getOmnilayer().types;
  const lists = [db.layouts.get() || [], ...profiles.savedData('overlays', 'layouts')];
  const typeOf = (layoutId) => {
    for (const list of lists) {
      const l = (list || []).find((x) => x?.id === layoutId);
      if (l?.sceneType && types.some((t) => t.id === l.sceneType)) return l.sceneType;
    }
    return '';
  };
  const now = sceneTypes.stepsByType(db.actions.get(), typeOf);
  if (now.converted) {
    db.actions.set(now.actions);
    bus.emit(EVENTS.CONFIG, { key: 'streamActions', value: db.actions.get() });
  }
  const touched = profiles.rewriteSaved('automation', 'actions', (actions) => sceneTypes.stepsByType(actions, typeOf).actions);
  log.info(`scene types: ${now.converted} step(s) and trigger(s) now name a type, saved actions changed in ${touched} profile(s)`);
  return { ...omnilayer.getOmnilayer(), converted: { live: now.converted, profiles: touched } };
}

/**
 * Put text into one omnibar slot.
 *
 * Bounded and flattened because this goes straight onto the stream: a viewer
 * with a newline or three hundred characters would otherwise decide how tall
 * the bar is. Clearing it (empty text) is legitimate — a text slot with nothing
 * in it is skipped by the bar, so "!bar" with no words removes it again.
 */
function setOmnibarItemText(slotId, text) {
  if (!slotId) return null;

  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, OMNIBAR_TEXT_LIMIT);

  const done = changeOmnibarSlot(slotId, (item) => (item.type === 'text' ? { ...item, text: clean } : null));
  if (!done) {
    log.warn(`omnibar: no text slot with id "${slotId}" on any bar — the slot may have been deleted`);
    return null;
  }
  log.info(clean ? `omnibar slot updated: "${clean}"` : 'omnibar slot cleared');
  return done.next;
}

/**
 * Change one slot on whichever bar holds it, and tell every surface.
 *
 * Slot ids are unique across every bar, so the id alone says which — Main
 * first, since that is where every slot made before there were other bars
 * lives. `change` gets the slot and returns it changed, or null to leave it
 * alone (the wrong kind of slot for the step asking). Returns the changed
 * slot and the bar list it now sits in, or null when nothing was changed.
 */
function changeOmnibarSlot(slotId, change) {
  if (!slotId) return null;
  let changed = null;
  const writeInto = (items) => {
    let hit = false;
    const out = (items || []).map((item) => {
      if (item.id !== slotId) return item;
      const next = change(item);
      if (!next) return item;
      hit = true;
      changed = next;
      return next;
    });
    return { hit, out };
  };

  let key = 'omnibar';
  let next = null;
  const onMain = writeInto(db.omnibar.get()?.items);
  if (onMain.hit) {
    next = db.omnibar.update((prev) => ({ ...prev, items: onMain.out }));
  } else {
    const bars = db.omnibars.get() || [];
    const at = bars.findIndex((b) => writeInto(b.items).hit);
    if (at >= 0) {
      key = 'omnibars';
      next = db.omnibars.update((prev) => prev.map((b, n) => (n === at ? { ...b, items: writeInto(b.items).out } : b)));
    }
  }
  if (!next) return null;

  // Reaches every surface, so the bar on stream changes as it lands.
  bus.emit(EVENTS.CONFIG, { key, value: next });
  return { item: changed, next };
}

/**
 * A number out of what a mod typed: "+50", "-20", "500", "$1,234".
 *
 * The sign is kept apart from the figure, because it is the sign that says
 * whether "50" means add fifty or make it fifty. Anything before the digits
 * that is not a sign — a currency symbol — is skipped, and a typographic minus
 * counts as one. Nothing numeric in it at all is no number, rather than zero.
 */
function readGoalAmount(raw) {
  const s = String(raw ?? '').replace(/[\u2212\u2013]/g, '-').replace(/[,\s]/g, '');
  const m = s.match(/^([+-])?[^0-9+-]*([0-9]+(?:\.[0-9]+)?)/);
  return m ? { sign: m[1] || '', amount: Number(m[2]) } : null;
}

/**
 * Change a goal slot's number: set it, or move it up or down.
 *
 * `mode` is set, add or subtract, or auto — which reads the sign, so one
 * command does all three: "+50" adds, "-20" takes away, "500" sets. Only a
 * goal whose number is kept by hand is changed; one following followers or
 * subs has its number from Twitch, and writing over it would be undone by the
 * next count. Whole numbers, never below zero.
 */
function changeGoal(slotId, mode, raw) {
  const read = readGoalAmount(raw);
  if (!read) {
    log.warn(`goal: "${String(raw ?? '').slice(0, 40)}" has no number in it, so the goal was left as it was`);
    return null;
  }
  const how = mode === 'set' || mode === 'add' || mode === 'subtract'
    ? mode
    : read.sign === '+' ? 'add' : read.sign === '-' ? 'subtract' : 'set';
  let refused = '';
  const done = changeOmnibarSlot(slotId, (item) => {
    if (item.type !== 'goal') return null;
    if ((item.goalSource || 'followers') !== 'manual') { refused = item.goalSource; return null; }
    const now = Number(item.goalValue) || 0;
    const to = how === 'add' ? now + read.amount : how === 'subtract' ? now - read.amount : read.amount;
    return { ...item, goalValue: Math.min(100000000, Math.max(0, Math.round(to))) };
  });
  if (!done) {
    log.warn(refused
      ? `goal: "${slotId}" counts ${refused}, which comes from the platform — only a goal kept by hand can be changed`
      : `goal: no goal slot with id "${slotId}" on any bar — it may have been deleted`);
    return null;
  }
  const g = done.item;
  const target = Math.max(1, Number(g.goalTarget) || 100);
  log.info(`goal "${g.text || slotId}" is now ${g.goalValue} of ${target}`);
  return {
    value: String(g.goalValue),
    target: String(target),
    left: String(Math.max(0, target - g.goalValue)),
    percent: String(g.goalValue >= target ? 100 : Math.min(99, Math.round((g.goalValue / target) * 100))),
  };
}

// ---------------------------------------------------------------- chat path

async function onChat(chat) {
  // Sent from the dock to Twitch and YouTube at once: the command in it runs from Twitch's copy, not twice.
  if (chat.raw?.sentToBoth) return;
  const hit = commands.match(db.commands.get(), chat.msg);
  if (!hit) return;

  const { command } = hit;
  if (chat.platform === 'discord' && command.discord === false) {
    log.debug(`"${hit.trigger}" is not for Discord`);
    return;
  }
  const user = {
    name: chat.user,
    id: chat.userId,
    avatar: chat.avatar,
    isSub: chat.isSub,
    isMod: chat.isMod,
    isVip: chat.isVip,
    isBroadcaster: chat.isBroadcaster,
    platform: chat.platform,
  };

  if (!commands.isPermitted(command, user)) {
    log.debug(`"${hit.trigger}" denied for ${chat.user} (permissions)`);
    return;
  }

  const cd = cooldowns.check(command, user);
  if (!cd.ok) {
    log.debug(`"${hit.trigger}" on ${cd.reason} cooldown (${Math.ceil(cd.remainingMs / 1000)}s left)`);
    return;
  }

  const linked = db.actions.get().filter(
    (a) => a.enabled
      && a.trigger?.type === 'command_trigger'
      && a.trigger.config?.commandId === command.id,
  );

  if (linked.length === 0) {
    log.debug(`"${hit.trigger}" matched but no action is linked to it`);
    return;
  }

  cooldowns.mark(command, user);

  const ctx = buildContext({
    user,
    nowPlaying: services.spotify?.getNowPlaying?.() ?? null,
    upNext: services.spotify?.getUpNext?.() ?? null,
    message: chat.msg,
    // Text after the trigger. Makes `{message}` mean what the viewer actually
    // said rather than including "!tts" in, say, a text-to-speech readout.
    args: hit.args,
    platform: chat.platform,
    // The message it came in on, so a question from it goes if a moderator deletes it.
    // And, from Discord, the channel it was typed in: "Where it came from" answers there.
    extra: { command: { name: command.name, trigger: hit.trigger, args: hit.args }, chatId: chat.id, ...(chat.platform === 'discord' && chat.raw?.channelId ? { discordChannelId: chat.raw.channelId } : {}) },
  });

  log.info(`"${hit.trigger}" by ${chat.user} -> ${linked.length} action(s)`);
  for (const action of linked) {
    await runSteps(action.actions, ctx, services);
  }
}

// --------------------------------------------------------------- event path

async function onEvent(event) {
  // 1. Tags (persisted + mirrored to disk for OBS text sources)
  tags.applyEvent(event);

  // 2. History ring, newest first — matches what the Events dock expects.
  db.history.update((prev) => [event, ...prev].slice(0, EVENT_HISTORY_LIMIT));

  // 2b. A second, much smaller ring holding only things a VIEWER did.
  //
  // The main ring is shared with everything on the bus, and Spotify alone
  // pushes a track change every few minutes: on a live channel it was 96 of
  // 100 entries, which evicts every follow and cheer within an evening of
  // music. Anything wanting "what have viewers been doing" therefore cannot
  // read that ring — hence this one, which nothing else can crowd out.
  //
  // Which events count, and how a gifted bundle is one row rather than fifty,
  // is decided in shared/viewer-events.js — each screen adds a new event to
  // its own copy with the same rules, so the list is not sent again each time.
  if (isViewerEvent(event)) {
    db.viewerEvents.update((prev) => withViewerEvent(prev, event));
    db.eventTotals.update((prev) => addToTotals(prev, event));
    bus.emit(EVENTS.CONFIG, { key: 'eventTotals', value: db.eventTotals.get() });
  }
  // A stream starting starts its totals from nothing.
  if (event.type === 'obs_stream_started') {
    db.eventTotals.set(emptyTotals(event.timestamp || Date.now()));
    bus.emit(EVENTS.CONFIG, { key: 'eventTotals', value: db.eventTotals.get() });
  }

  // 3. Alerts
  alerts.dispatch(db.alerts.get(), event, services.spotify?.getNowPlaying?.() ?? null, services.spotify?.getUpNext?.() ?? null);

  // 4. Actions bound to this event type.
  await runTriggered(event);
}

/**
 * The actions an event sets off — every stream event, and the things that
 * only set actions off (EVENTS.TRIGGER: the Discord call). An action saved
 * without a trigger matches nothing; reading one blindly threw here, and
 * since this runs for every event, one such action stopped every event
 * action after it.
 */
async function runTriggered(event) {
  const matching = db.actions.get().filter((a) => a.enabled && a.trigger?.type === event.type && passesFilter(a, event));
  if (matching.length === 0) return;

  const ctx = buildContext({
    user: { name: event.user, avatar: event.avatar, platform: event.platform },
    nowPlaying: services.spotify?.getNowPlaying?.() ?? null,
    upNext: services.spotify?.getUpNext?.() ?? null,
    event,
    platform: event.platform,
  });

  log.info(`${event.type} by ${event.user} -> ${matching.length} action(s)`);
  for (const action of matching) {
    await runSteps(action.actions, ctx, services);
  }
}

/** Trigger-specific narrowing, ported 1:1 from the V2 browser engine. */
function passesFilter(action, event) {
  const cfg = action.trigger.config || {};

  if (event.type === 'twitch_cheer' && cfg.minBits) {
    if ((event.data?.bits ?? event.data?.amount ?? 0) < cfg.minBits) return false;
  }

  if (event.type === 'tiktok_gift' && cfg.giftName) {
    if (String(event.data?.giftName || '').toLowerCase() !== String(cfg.giftName).toLowerCase()) return false;
  }

  if (event.type === 'twitch_redemption' && cfg.rewardId) {
    if (cfg.rewardId !== event.data?.rewardId) return false;
  }

  // One saved countdown rather than any: the one that was loaded when it reached zero.
  // One layout going live rather than any — or one scene type, which is the same in every profile.
  // A type since deleted falls back to the layout the trigger named before.
  if (event.type === 'layout_changed' && cfg.sceneType && omnilayer.getOmnilayer().types.some((x) => x.id === cfg.sceneType)) {
    if (cfg.sceneType !== event.data?.sceneType) return false;
  } else if (event.type === 'layout_changed' && cfg.layoutId) {
    if (cfg.layoutId !== event.data?.layoutId) return false;
  }

  if (event.type === 'countdown_finished' && cfg.timerId) {
    if (cfg.timerId !== event.data?.timer) return false;
  }

  // The Discord call (discord-voice.js): one person rather than anyone, a number of people reached, a real pause first.
  if (event.type.startsWith('discord_call_') && cfg.discordId && cfg.discordId !== event.data?.userId) return false;
  if (event.type === 'discord_call_count') {
    const n = Math.max(1, Number(cfg.people) || 2);
    if (!(event.data?.previous < n && event.data?.count >= n)) return false;
  }
  if (event.type === 'discord_call_talking') {
    const quiet = Math.max(MIN_CALL_QUIET_S, Number(cfg.quietSeconds) || 30);
    if ((event.data?.quietFor ?? Infinity) < quiet * 1000) return false;
  }

  if (event.type === 'obs_scene_changed' && cfg.targetScene) {
    // For scene changes the scene name travels in `user` (V2 convention).
    if (cfg.targetScene !== event.user) return false;
  }

  return true;
}

// ------------------------------------------------------------------- config

/** Everything a freshly-connected client needs to render the whole UI. */
export function snapshot() {
  return {
    commands: db.commands.get(),
    streamActions: db.actions.get(),
    alertConfigs: db.alerts.get(),
    eventHistory: db.history.get(),
    viewerEvents: db.viewerEvents.get(),
    eventTotals: db.eventTotals.get(),
    eventsDockSettings: db.eventsDock.get(),
    viewers: db.viewers.get(),
    omnibar: db.omnibar.get(),
    omnibars: db.omnibars.get(),
    avatarSources: db.avatarSources.get(),
    layouts: db.layouts.get(),
    rewards: db.rewards.get(),
    plan: streamPlan.getPlan(),
    people: people.getPeople(),
    planSaved: streamPlan.getSaved(),
    run: db.run.get(),
    questions: questionsModule.getQuestions(),
    questionSettings: questionsModule.getSettings(),
    players: db.players.get(),
    chatDockSettings: db.chatDock.get(),
    profiles: profiles.summary(),
    countdown: countdown.getState(),
    omnilayer: omnilayer.getOmnilayer(),
    ...giveaway.snapshot(),
    poll: polls.getState(),
    pollSettings: polls.getSettings(),
    pollHistory: polls.getHistory(),
    ...pngtuber.snapshot(),
    ...pixelAvatars.snapshot(),
    ...userThemes.snapshot(),
    ...twitchExtras.snapshot(),
    stopwatch: stopwatch.getState(),
    counters: counters.getCounters(),
    recentChat: db.recentChat.get(),
    streamTags: tags.getTags(),
    tagOutputs: tags.getOutputs(),
    relayConfig: db.relay.get(),
    dockButtons: db.dockButtons.get(),
    dockGrid: db.dockGrid.get(),
  };
}

/** Everything needed to stand this install up on another machine. */
export function exportConfig() {
  return backup.buildBundle();
}

/** Replace this install's configuration with a bundle from one. */
export function importConfig(bundle) {
  const result = backup.applyBundle(bundle, {
    healCommands: () => db.commands.update((prev) => prev.map(normaliseCommand)),
    setDockButtons: (next) => store.setDockButtons(next),
    setDockGrid: (next) => store.setDockGrid(next),
  });
  // A backup from before chat layers kept their own settings brings layouts whose chat
  // leaned on the shared one — and that shared chat, restored with them, fills them out.
  if (chatBehind(db.layouts.get())) db.layouts.set(withWholeChat(db.layouts.get(), db.chat.get()));
  profiles.rewriteSaved('overlays', 'layouts', (layouts) => (chatBehind(layouts) ? withWholeChat(layouts, db.chat.get()) : layouts));
  return result;
}


/**
 * One omnibar, checked.
 *
 * Validated rather than trusted: this ends up interpolated into inline
 * styles on a surface that is on stream, and an item of an unknown type
 * would render as a permanent blank slot in the rotation. Shared by Main and
 * every other bar, so a rule added here reaches all of them at once.
 */
function cleanOmnibar(next) {
  const incoming = (next && typeof next === 'object') ? next : {};
  const style = (incoming.style && typeof incoming.style === 'object') ? incoming.style : {};
  const clean = {
    enabled: Boolean(incoming.enabled),
    defaultSeconds: bounded(incoming.defaultSeconds, 3, 120, DEFAULT_OMNIBAR.defaultSeconds),
    items: (Array.isArray(incoming.items) ? incoming.items : [])
      .filter((i) => i && OMNIBAR_TYPES.includes(i.type))
      .slice(0, 40)
      .map((i, index) => ({
        id: i.id || `omni-${index}-${Math.random().toString(36).slice(2, 8)}`,
        type: i.type,
        // What you call it, as distinct from the heading printed on stream.
        // Without this, a slot waiting for viewer text — no message, no
        // heading — could only be identified by its raw id.
        name: typeof i.name === 'string' ? i.name.slice(0, 60) : '',
        enabled: i.enabled !== false,
        label: typeof i.label === 'string' ? i.label.slice(0, 60) : '',
        text: typeof i.text === 'string' ? i.text.slice(0, 300) : '',
        seconds: i.seconds === undefined || i.seconds === null || i.seconds === ''
          ? null
          : bounded(i.seconds, 3, 120, null),
        // Kept on the bar rather than taking its turn in the rotation. Its
        // seconds are left alone rather than cleared: unpinning should put
        // the slot back the length it was, not at the bar's default.
        pinned: i.pinned === true,
        // Which commands a "commands" slot advertises. Empty means "every
        // command anyone can use", which is what an untouched slot does.
        // Ids are not checked against the command list on purpose: deleting
        // a command should not silently rewrite an unrelated bar slot, and
        // the renderer already ignores ids it cannot resolve.
        commandsAllTriggers: i.commandsAllTriggers === true,
        // How many names a top-chatters slot lists. Bounded so a pasted
        // number cannot push the bar past its own width.
        topCount: bounded(i.topCount, 1, 10, 3),
        // A tall bar's two extra lines. Kept on every bar, so a slot that is
        // copied or moved between kinds does not lose them, and ignored by the
        // omnibar, which has nowhere to draw them.
        sublabel: typeof i.sublabel === 'string' ? i.sublabel.slice(0, 40) : '',
        detail: typeof i.detail === 'string' ? i.detail.slice(0, 300) : '',
        // A goal slot's settings, checked by the rules a goal layer's are.
        // Kept on every slot, so switching one to a goal and back loses nothing.
        goalSource: OMNIBAR_GOAL_SOURCES.includes(i.goalSource) ? i.goalSource : 'followers',
        goalTarget: bounded(i.goalTarget, 1, 100000000, 100),
        goalValue: bounded(i.goalValue, 0, 100000000, 0),
        goalShow: i.goalShow === 'percent' ? 'percent' : 'remaining',
        goalPrefix: typeof i.goalPrefix === 'string' ? i.goalPrefix.slice(0, 4) : '',
        commandIds: Array.isArray(i.commandIds)
          ? i.commandIds.filter((id) => typeof id === 'string' && id).slice(0, 40)
          : [],
      })),
    style: {
      position: style.position === 'top' ? 'top' : 'bottom',
      height: bounded(style.height, 32, 200, DEFAULT_OMNIBAR.style.height),
      // Automatic when empty. Chosen, each beats any look on the bar: the
      // looks read --omnibar-background, --omnibar-text and --omnibar-accent
      // before their own, and the bar sets those only when chosen.
      background: lookColour(style, 'background', OMNIBAR_OLD_COLOURS.background),
      textColor: lookColour(style, 'textColor', OMNIBAR_OLD_COLOURS.textColor),
      accentColor: lookColour(style, 'accentColor', OMNIBAR_OLD_COLOURS.accentColor),
      settingsVersion: SETTINGS_VERSION,
      fontSize: bounded(style.fontSize, 10, 72, DEFAULT_OMNIBAR.style.fontSize),
      uppercase: style.uppercase !== false,
      transparent: style.transparent === true,
      transition: ['slide', 'fade', 'none'].includes(style.transition) ? style.transition : 'slide',
      // Off by default, so a bar that was set up before this existed reads
      // exactly as it did: what did not fit was cut short, and a marathon
      // that wanted it moving can say so.
      scroll: style.scroll === true,
      // A picture held at the left end of the bar. The same rule as every
      // other picture the server stores an address for: an upload of ours,
      // or something on http(s). Anything else is dropped rather than
      // guessed at, since it ends up as an image source on stream.
      logo: /^\/media\/|^https?:\/\//.test(style.logo || '') ? String(style.logo).slice(0, 500) : '',
      logoSize: bounded(style.logoSize, 30, 100, 70),
    },
  };

  return clean;
}

export const store = {
  saveCommand(command) {
    const next = normaliseCommand(command);
    db.commands.update((prev) => {
      const i = prev.findIndex((c) => c.id === next.id);
      if (i >= 0) { prev[i] = next; return [...prev]; }
      return [...prev, next];
    });
    return db.commands.get();
  },
  deleteCommand(id) {
    db.commands.update((prev) => prev.filter((c) => c.id !== id));
    cooldowns.reset(id);
    return db.commands.get();
  },
  saveAction(incoming) {
    const action = normaliseAction(incoming);
    db.actions.update((prev) => {
      const i = prev.findIndex((a) => a.id === action.id);
      if (i >= 0) { prev[i] = action; return [...prev]; }
      return [...prev, action];
    });
    return db.actions.get();
  },
  deleteAction(id) {
    db.actions.update((prev) => prev.filter((a) => a.id !== id));
    // Otherwise the Dock Actions surface keeps a button that throws when
    // pressed, which reads as the dock being broken rather than the action
    // being gone.
    db.dockButtons.update((prev) => prev.filter((b) => b.actionId !== id));
    return db.actions.get();
  },
  saveAlert(alert) {
    const next = alerts.normaliseAlert(alert);
    db.alerts.update((prev) => {
      const i = prev.findIndex((a) => a.id === next.id);
      if (i >= 0) { prev[i] = next; return [...prev]; }
      return [...prev, next];
    });
    return db.alerts.get();
  },
  deleteAlert(id) {
    db.alerts.update((prev) => prev.filter((a) => a.id !== id));
    return db.alerts.get();
  },
  /**
   * How many columns the button grid has, and how many rows.
   *
   * Both bounded at eight: past that the buttons are too small to hit on a
   * phone, which is one of the two things this grid is for. Rows may be zero,
   * meaning the grid takes as many as it needs and keeps its cells square.
   */
  setDockGrid(next) {
    const prev = db.dockGrid.get();
    /*
      And how many pages, each a grid of that shape, with a name each. A
      dock is not capped at what one grid holds: scenes on one page, sounds
      on the next. See shared/dock-pages.js.
    */
    const pages = next?.pages !== undefined ? pageCount(next) : pageCount(prev);
    return db.dockGrid.set({
      columns: bounded(next?.columns, 1, 8, prev.columns),
      rows: bounded(next?.rows, 0, 8, prev.rows),
      pages,
      pageNames: cleanPageNames(next?.pageNames !== undefined ? next.pageNames : prev.pageNames, pages),
      // The numbered page buttons, over the grid or under it.
      pagerAt: pagerPlace(next?.pagerAt !== undefined ? next : prev),
      // On a phone held sideways: the page folded to fill the width, or two pages side by side.
      sideways: sidewaysMode(next?.sideways !== undefined ? next : prev),
    });
  },
  getDockGrid: () => db.dockGrid.get(),
  setRelayConfig(cfg) {
    return db.relay.set({ ...db.relay.get(), ...cfg });
  },
  /**
   * Replace the Dock Actions button list.
   *
   * Buttons pointing at an action that no longer exists are dropped here
   * rather than rendered as a button that fails when pressed — deleting an
   * action from the Actions screen should quietly remove its button too.
   */
  /**
   * Replace Main, the omnibar every layer shows unless it names another.
   */
  setOmnibar(next) {
    const clean = cleanOmnibar(next);
    db.omnibar.set(clean);
    return clean;
  },

  /**
   * The named pixel avatars: `create` one from a layer's settings under a
   * name, `save` its settings (every layer wearing it changes), `rename`
   * it, or `delete` it — the layers that wore it draw with their own again.
   * Answers with the list, and the new one's id when one was made.
   */
  avatarSources(payload = {}) {
    const list = db.avatarSources.get() || [];
    const name = String(payload.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const taken = (n, id) => list.some((s) => s.id !== id && s.name.toLowerCase() === n.toLowerCase());
    const found = () => {
      const s = list.find((x) => x.id === payload.id);
      if (!s) throw refusal('avatar_source_gone', 'that named avatar is no longer there');
      return s;
    };
    switch (payload.op) {
      case 'create': {
        if (!name) throw refusal('avatar_source_name_empty', 'a named avatar needs a name');
        if (taken(name)) throw refusal('avatar_source_name_taken', `there is already an avatar called "${name}"`, { name });
        if (list.length >= MAX_AVATAR_SOURCES) throw refusal('avatar_sources_full', `there are already ${MAX_AVATAR_SOURCES} named avatars`, { max: MAX_AVATAR_SOURCES });
        const id = newAvatarSourceId();
        return { id, list: db.avatarSources.set(cleanAvatarSources([...list, { id, name, config: payload.config }])) };
      }
      case 'save': {
        const s = found();
        return { list: db.avatarSources.set(cleanAvatarSources(list.map((x) => (x.id === s.id ? { ...x, config: payload.config } : x)))) };
      }
      case 'rename': {
        const s = found();
        if (!name) throw refusal('avatar_source_name_empty', 'a named avatar needs a name');
        if (taken(name, s.id)) throw refusal('avatar_source_name_taken', `there is already an avatar called "${name}"`, { name });
        return { list: db.avatarSources.set(cleanAvatarSources(list.map((x) => (x.id === s.id ? { ...x, name } : x)))) };
      }
      case 'delete': {
        found();
        return { list: db.avatarSources.set(list.filter((x) => x.id !== payload.id)) };
      }
      default: throw refusal('unknown_request', `unknown request "${payload.op}"`);
    }
  },

  /**
   * Replace the omnibars other than Main.
   *
   * Each is checked by exactly the rule Main is, and carries an id a layer
   * can name and a name somebody can pick from a list. A slot's id has to be
   * unique across every bar, because that id is all an omnibar step keeps —
   * two bars holding a slot of the same id would leave the step writing to
   * whichever was found first. A duplicated bar arrives with its slots already
   * renamed by the screen that made it; this is what catches anything else.
   */
  setOmnibars(next) {
    const taken = new Set((db.omnibar.get()?.items || []).map((i) => i.id));
    const ids = new Set(['main']);
    const clean = (Array.isArray(next) ? next : [])
      .filter((b) => b && typeof b === 'object')
      .slice(0, MAX_OMNIBARS)
      .map((bar, n) => {
        let id = typeof bar.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(bar.id) ? bar.id : '';
        while (!id || ids.has(id)) id = `bar-${Math.random().toString(36).slice(2, 8)}`;
        ids.add(id);
        const config = cleanOmnibar(bar);
        config.items = config.items.map((item) => {
          let itemId = item.id;
          while (taken.has(itemId)) itemId = `omni-${Math.random().toString(36).slice(2, 10)}`;
          taken.add(itemId);
          return itemId === item.id ? item : { ...item, id: itemId };
        });
        const name = typeof bar.name === 'string' && bar.name.trim() ? bar.name.trim().slice(0, 40) : `Bar ${n + 2}`;
        // Anything but tall is the omnibar, so an unknown kind draws as the bar
        // everybody already knows rather than as nothing.
        const kind = bar.kind === 'tall' ? 'tall' : 'classic';
        return { id, name, kind, ...config };
      });
    db.omnibars.set(clean);
    return clean;
  },


  /*
    The question queue. It lives in questions.js with "!pregunta" and the rest
    of it; these are the names the steps, the socket and the tests call it by.
  */
  addQuestion(q) {
    return questionsModule.add(q);
  },
  setQuestionStatus(id, status) {
    return questionsModule.setStatus(id, status);
  },
  showQuestion(id) {
    return questionsModule.show(id);
  },
  clearQuestions(which) {
    return questionsModule.clear(which);
  },
  /** Add one by hand, edit one, "Next question", and the settings. */
  questions(payload) {
    return questionsModule.control(payload);
  },

  /** Validate and store what the stream is working through. */
  /**
   * Set what is being played.
   *
   * Everything is trimmed for storage, and every field is optional: a stream
   * that has a game but no category is normal, and a card that refuses to
   * save until every box is filled would be a card nobody fills in.
   */
  setRun(incoming) {
    // Name and second line, and a Twitch login and Discord account when known. See shared/run.js.
    const person = cleanPerson;
    const clean = {
      game: String(incoming?.game ?? '').trim().slice(0, 80),
      platform: String(incoming?.platform ?? '').trim().slice(0, 30),
      // Four digits or nothing: it is printed next to the platform, and
      // anything else there is a typo rather than a year.
      year: /^[0-9]{4}$/.test(String(incoming?.year ?? '').trim()) ? String(incoming.year).trim() : '',
      category: String(incoming?.category ?? '').trim().slice(0, 40),
      estimate: String(incoming?.estimate ?? '').trim().slice(0, 12),
      runner: person(incoming?.runner),
      host: person(incoming?.host),
      /*
        Nameless ones are kept. A seat exists before it has somebody in it:
        the editor adds one and then you type into it, and dropping it here
        meant the row came straight back deleted and the button did nothing.
        Nothing reaches stream from an empty seat — a plate following one
        draws nothing, which the canvas decides.
      */
      commentators: (Array.isArray(incoming?.commentators) ? incoming.commentators : [])
        .map(person)
        .slice(0, MAX_COMMENTATORS),
      /*
        Kept when the incoming card does not mention it, so a save from a
        surface that never heard of it cannot make the next connect look like
        the category changed.
      */
      twitchCategoryId: incoming?.twitchCategoryId !== undefined
        ? (incoming.twitchCategoryId === null ? null : String(incoming.twitchCategoryId).slice(0, 20))
        : (db.run.get()?.twitchCategoryId ?? null),
    };
    db.run.set(clean);
    return clean;
  },

  /** The whole players list, as the Players screen edits it. */
  setPlayers(incoming) {
    return savePlayers(incoming);
  },

  /** The whole plan, as the Stream plan screen edits it. See plan.js. */
  setPlan(incoming) {
    return streamPlan.setPlan(incoming);
  },

  /** Move the mark to one step, everything before it done. */
  planGoto(id) {
    return streamPlan.goto(id);
  },

  /** Save the plan under a name, load a saved one, or forget one. */
  planSaved(payload) {
    return streamPlan.savedControl(payload);
  },

  /**
   * The Events dock's requests: an event's alert again, a thank-you in chat
   * for it, the stream's totals started over, and what "Thank" says.
   */
  async events(payload = {}) {
    const find = () => db.viewerEvents.get().find((e) => e.id === payload.id);
    switch (payload.op) {
      case 'replay': {
        const event = find();
        if (!event) throw refusal('event_gone', 'that event is no longer in the list');
        // Somebody asked to see it again now: never held by a pause.
        const shown = alerts.dispatch(db.alerts.get(), event, services.spotify?.getNowPlaying?.() ?? null, services.spotify?.getUpNext?.() ?? null, { manual: true });
        if (!shown) throw refusal('no_alert_for_event', 'no alert is set up for this kind of event');
        log.info(`alert replayed for ${event.type} by ${event.user}`);
        return { ok: true };
      }
      case 'thank': {
        const event = find();
        if (!event) throw refusal('event_gone', 'that event is no longer in the list');
        if (!canThank(event)) throw refusal('cannot_thank', 'only Twitch events can be thanked in Twitch chat');
        const status = services.twitch?.getStatus?.();
        if (status && status.main !== 'connected' && status.bot !== 'connected') throw refusal('twitch_offline', 'Twitch is not connected');
        const { user, what } = thanksFor(event);
        const template = db.eventsDock.get()?.thanks || DEFAULT_THANKS;
        const line = template.split('{user}').join(user).split('{what}').join(what).slice(0, 500);
        await services.twitch.say(line, { useBot: true });
        return { ok: true, said: line };
      }
      case 'reset_totals': {
        db.eventTotals.set(emptyTotals(Date.now()));
        bus.emit(EVENTS.CONFIG, { key: 'eventTotals', value: db.eventTotals.get() });
        return { ok: true };
      }
      case 'settings': {
        const thanks = String(payload.settings?.thanks ?? '').trim().slice(0, 300) || DEFAULT_THANKS;
        db.eventsDock.set({ thanks });
        bus.emit(EVENTS.CONFIG, { key: 'eventsDockSettings', value: { thanks } });
        return { ok: true };
      }
      default:
        throw refusal('unknown_request', `unknown request "${payload.op}"`);
    }
  },

  /** Regulars, crews and the Discord call, for the Who's on screen. See people.js. */
  people(payload) {
    return people.control(payload);
  },

  /** Validate and store the viewer counter overlay config. */
  setViewers(incoming) {
    const prev = db.viewers.get();
    const style = incoming?.style || {};
    const clean = {
      mode: incoming?.mode === 'platforms' ? 'platforms' : 'total',
      showIcon: incoming?.showIcon !== false,
      // Whether a platform that is not live still takes up room. Off by
      // default: an overlay listing "TikTok 0" while you only stream to
      // Twitch is clutter, not information.
      showOffline: incoming?.showOffline === true,
      platforms: {
        twitch: incoming?.platforms?.twitch !== false,
        youtube: incoming?.platforms?.youtube !== false,
        tiktok: incoming?.platforms?.tiktok !== false,
      },
      style: {
        fontSize: bounded(style.fontSize, 10, 120, DEFAULT_VIEWERS.style.fontSize),
        // Automatic when empty; chosen, each beats a look on the counter
        // (the looks read --viewers-text, --viewers-accent and
        // --viewers-background first). Transparent is on by default, so it
        // cannot be told from a choice: it stays the plain counter's, and a
        // background beats a look only once Transparent is off.
        color: lookColour(style, 'color', VIEWERS_OLD_COLOURS.color),
        accentColor: lookColour(style, 'accentColor', VIEWERS_OLD_COLOURS.accentColor),
        background: lookColour(style, 'background', VIEWERS_OLD_COLOURS.background),
        transparent: style.transparent !== false,
        settingsVersion: SETTINGS_VERSION,
      },
    };
    void prev;
    db.viewers.set(clean);
    return clean;
  },

  /** Validate and store the overlay layouts. */
  setLayouts(incoming) {
    const before = db.layouts.get();
    const clean = normaliseLayouts(incoming);
    db.layouts.set(clean);
    // A source slot moved on the live layout: OBS follows the editor. And if
    // the live layout is gone, another takes its place before this returns.
    omnilayer.layoutsSaved(before, clean);
    return clean;
  },

  /**
   * Validate and store the dock's chat settings. The same rules as a chat
   * layer's — except the look, which is not the dock's to choose: it is
   * always Marathon's chat, drawn by the client, so the dock keeps no theme
   * and no stylesheet of its own.
   */
  setChatDockSettings(incoming) {
    const clean = { ...cleanChatSettings(incoming, db.chatDock.get()), chatTheme: 'custom', css: '', motionCss: '' };
    db.chatDock.set(clean);
    return clean;
  },

  getChatDockSettings: () => db.chatDock.get(),
  getLayouts: () => db.layouts.get(),

  // Profiles rewrite whole collections, so every one of these returns the
  // fresh summary and the caller broadcasts a full snapshot rather than a
  // patch — half the app just changed underneath it.
  profileSwitch: (groupId, profileId) => profiles.switchProfile(groupId, profileId),
  profileCreate: (groupId, name) => profiles.createProfile(groupId, name),
  profileDuplicate: (groupId, name) => profiles.duplicateProfile(groupId, name),
  profileRename: (groupId, profileId, name) => profiles.renameProfile(groupId, profileId, name),
  profileDelete: (groupId, profileId) => profiles.deleteProfile(groupId, profileId),
  profileCapture: (groupId) => profiles.captureActive(groupId),
  profileRevert: (groupId) => profiles.revertActive(groupId),
  profileSummary: () => profiles.summary(),

  getViewers: () => db.viewers.get(),

  getOmnibar() {
    return db.omnibar.get();
  },

  /** Start, pause, finish, reset or adjust the run timer. */
  stopwatch(op, value) {
    return stopwatch.control(op, value);
  },

  /** Change a count from the dashboard: `{ name, op, value }`, as the step does. */
  counter(payload) {
    const done = counters.changeCounter(payload?.name || 'deaths', payload?.op || 'add', payload?.value ?? '');
    if (!done) throw refusal('no_counter', `no count called ${payload?.name}`);
    return counters.getCounters();
  },

  /** Start, pause, reset or adjust the countdown. */
  /** Set up, open, close or clear the poll. */
  poll(op, value) {
    return polls.control(op, value);
  },

  /** Set up, open, close, draw, reroll or clear the giveaway. */
  giveaway(op, value) {
    return giveaway.control(op, value);
  },

  /** The Twitch extras: their settings, a shoutout, a clip, a marker, the schedule, a test Hype Train. */
  twitchExtras(payload) {
    return twitchExtras.control(payload);
  },

  /** The PNGtuber microphone: its settings, or keep its level coming for the meter. */
  mic(payload) {
    if (payload?.op === 'meter') return pngtuber.meter();
    if (payload?.op === 'face') return pngtuber.showFace(payload.face, payload.seconds);
    // Trying on what viewers can put on it, and taking it all off.
    if (payload?.op === 'dress') return pngtuber.dressAvatar(payload.what, payload.name, payload.minutes) ?? { ok: false };
    if (payload?.op === 'undress') return pngtuber.undressAvatar();
    // Something to do, to try: a glass of water.
    if (payload?.op === 'action') return pngtuber.playAvatarAction(payload.name) ?? { ok: false };
    return pngtuber.setMic(payload?.settings);
  },

  /** The Pixel avatars tab: save, create, duplicate, rename, delete or reset an avatar. */
  pixelAvatars(payload) {
    return pixelAvatars.control(payload);
  },

  /** The Library's own themes: create (empty or a copy), save, rename, delete. */
  userThemes(payload) {
    return userThemes.control(payload);
  },

  /** Omnilayer: its settings, putting a layout live, or what its OBS scene holds — and the scene types. */
  omnilayer(payload) {
    if (SCENE_TYPE_OPS.includes(payload?.op)) return sceneTypeControl(payload);
    return omnilayer.control(payload);
  },

  /**
   * One change made to the layouts everywhere: the live ones and every saved
   * overlay profile's, each the same way, so a profile with no unsaved
   * changes still has none. Says which live layouts changed, and in how many
   * profiles.
   */
  rewriteLayouts(change) {
    const live = db.layouts.get() || [];
    const next = change(live);
    const changed = next === live ? [] : next.filter((l, i) => l !== live[i]).map((l) => l.name);
    if (changed.length) saveLayoutsHere(next);
    return { live: changed, profiles: profiles.rewriteSaved('overlays', 'layouts', change) };
  },

  /** Omnilayer as the screens hold it: its settings, what is live, the wipe and any problems. */
  omnilayerState() {
    return omnilayer.getOmnilayer();
  },

  countdown(op, value) {
    return countdown.control(op, value);
  },

  setDockButtons(next) {
    const ids = new Set(db.actions.get().map((a) => a.id));
    /*
      A button points at an action you built, or at one of the built-in ones.

      The built-in list is the same on both ends, so a name this build does not
      have is refused here rather than drawn as a button that cannot work.
    */
    const clean = (Array.isArray(next) ? next : [])
      .filter((b) => b && ((b.builtin && dockBuiltin(b.builtin)) || (b.actionId && ids.has(b.actionId))))
      .map((b, i) => ({
        id: b.id || `dock-${i}-${Math.random().toString(36).slice(2, 8)}`,
        actionId: b.actionId || '',
        builtin: b.builtin && dockBuiltin(b.builtin) ? b.builtin : '',
        label: typeof b.label === 'string' ? b.label : '',
        // Which page it is on. One past the last is shown on the last, so nothing is lost.
        page: Number.isInteger(b.page) && b.page > 0 ? Math.min(b.page, MAX_DOCK_PAGES - 1) : 0,
        /*
          Which cell of the grid this sits in.

          A position rather than a place in a list, so a button can be parked
          where you want it with nothing above or beside it. A list can only put
          its gaps at the end; a dock is a board, and a board has holes in it
          wherever you left them.

          Where nothing has been said, the order it arrived in — which is where
          a list would have put it, so nothing moves the first time this is read.
        */
        slot: Number.isInteger(b.slot) && b.slot >= 0 ? b.slot : i,
        // Only a plain hex colour. This value is interpolated into inline
        // styles on every surface, so anything else is refused rather than
        // passed through.
        color: /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '',
        // An emoji or a couple of characters. Bounded so a paste of something
        // enormous cannot wreck the grid.
        icon: typeof b.icon === 'string' ? [...b.icon].slice(0, 4).join('') : '',
        // Either an uploaded asset or an explicit http(s) URL. A bare path or
        // a data/javascript URL is dropped.
        image: /^\/media\/|^https?:\/\//.test(b.image || '') ? b.image : '',
        /*
          A picture per state, for a built-in button that shows one — the
          YouTube category button, one for each of its two categories. Only
          the states the button has, and only pictures the image above would
          accept.
        */
        stateImages: Object.fromEntries(
          ((b.builtin && dockBuiltin(b.builtin)?.categories) || [])
            .map((state) => [state, b.stateImages?.[state]])
            .filter(([, url]) => /^\/media\/|^https?:\/\//.test(url || '')),
        ),
      }));
    return db.dockButtons.set(clean);
  },
  getDockButtons: () => db.dockButtons.get(),
  getRelayConfig: () => db.relay.get(),
  clearHistory() {
    db.history.set([]);
    // Clearing the activity log should not leave the bar still announcing
    // things the log no longer admits to.
    db.viewerEvents.set([]);
    return [];
  },
  setTagOutputs: tags.setOutputs,
};

// ---------------------------------------------------------------- test hooks

/** Run an action by id, as if it had been triggered. Used by the UI's Test button. */
/**
 * Run an action because someone pressed its button on the Dock Actions
 * surface.
 *
 * Separate from `testAction` because the identity differs and is audible:
 * a step like `{user} dice {message}` would otherwise be spoken as
 * "TestUser dice !test". Firing from a button is a real invocation, not a
 * rehearsal, so it runs as "Dock Actions" with no message — which also makes
 * it obvious in chat and TTS that a button did this rather than a viewer.
 *
 * Like `testAction`, it deliberately skips permissions and cooldowns: the
 * operator pressing their own button should never be rate-limited.
 */
/**
 * Run one of the built-in buttons.
 *
 * No context, no interpolation, no permissions: there is nothing in one of
 * these to interpolate and nobody but whoever is at the desk can press it.
 * It reaches the same place a one-step action would, which is the point — the
 * button is the step, without the action around it.
 */
export async function runDockBuiltin(id) {
  const builtin = dockBuiltin(id);
  if (!builtin) throw refusal('no_builtin', `no built-in button called ${id}`);
  if (builtin.category === 'spotify') {
    if (!services.spotify?.control) throw refusal('spotify_offline', 'Spotify is not connected');
    await services.spotify.control(builtin.op);
    return { ok: true };
  }
  if (builtin.category === 'deaths') {
    // One more, one fewer or back to none. Taking one away from none says so.
    const done = counters.changeCounter('deaths', builtin.op);
    if (done && done.value === done.before && builtin.op !== 'reset') throw refusal('deaths_unchanged', 'the count is already at none');
    return { ok: true };
  }
  if (builtin.category === 'countdown') {
    /*
      As the run timer's buttons: a press that changes nothing says so —
      a minute off a clock already at nothing, say — rather than flashing
      green. Reset always counts, as it does there.
    */
    const { before, after } = countdown.act(builtin.op, { amount: builtin.amount });
    const same = before.mode === after.mode && before.remainingMs === after.remainingMs && before.endsAt === after.endsAt;
    if (same && builtin.op !== 'reset') throw refusal('countdown_unchanged', 'the countdown did not change');
    return { ok: true };
  }
  if (builtin.category === 'timer') {
    /*
      A press that changes nothing says so, as the plan's buttons do: Finish
      on a timer that is not running, or Undo on one that is not finished,
      would otherwise flash green for having done nothing.
    */
    const before = stopwatch.getState().mode;
    const after = stopwatch.control(builtin.op).mode;
    if (after === before && builtin.op !== 'reset') {
      throw ({
        finish: refusal('timer_not_running', 'the timer is not running'),
        undoFinish: refusal('timer_not_finished', 'the timer has not finished'),
      })[builtin.op] || refusal('timer_unchanged', 'the timer did not change');
    }
    return { ok: true };
  }
  if (builtin.category === 'plan') {
    /*
      A press that moves nothing says so, and the button shows it failing: a
      deck button that lights up green at the end of the plan would be telling
      you something happened when it did not.
    */
    if (!streamPlan.getPlan().items.length) throw refusal('plan_empty', 'the stream plan is empty');
    if (!streamPlan.service.step(builtin.op === 'next' ? 1 : -1)) {
      throw builtin.op === 'next'
        ? refusal('plan_finished', 'the plan is already finished')
        : refusal('plan_not_started', 'the plan has not started yet');
    }
    return { ok: true };
  }
  if (builtin.category === 'avatar') {
    // Whatever viewers dressed it in comes off.
    if (builtin.op === 'undress') return pngtuber.undressAvatar();
    // Something a pixel avatar from the tab does: on every avatar that does it, and said so when none does.
    if (builtin.pixel) {
      if (!pngtuber.playAvatarAction(builtin.op)) throw refusal('avatar_cannot_do', 'no avatar on screen does that');
      return { ok: true };
    }
    // Something it does once, start to end: a glass of water.
    if (AVATAR_ACTIONS_LIST.includes(builtin.op)) {
      pngtuber.playAvatarAction(builtin.op);
      return { ok: true };
    }
    // With a house avatar standing in for the built-in one (shared/house-avatar.js), what it does is its own.
    if (HOUSE_CHARACTER && pngtuber.playAvatarAction(builtin.op)) return { ok: true };
    // Every avatar on screen, for as long as the step would keep it; "none" takes it off.
    pngtuber.showFace(builtin.op, DOCK_FACE_SECONDS);
    return { ok: true };
  }
  if (builtin.category === 'twitch') {
    // A clip or a marker needs the stream live, and the button says when it is not.
    const result = builtin.op === 'clip' ? await twitchExtras.clip({ post: true }) : await twitchExtras.marker('');
    if (!result.ok) throw refusal(result.code, result.error, result.vars);
    return result;
  }
  if (builtin.category === 'alerts') {
    // Skip says so when nothing is on screen; pause and resume are one button.
    return controlAlerts(builtin.op);
  }
  if (builtin.category === 'questions') {
    // Says so when nothing approved is left to put up, and the button shows it failing.
    questionsModule.next();
    return { ok: true };
  }
  if (builtin.category === 'youtube') {
    if (!services.youtube?.toggleCategory) throw refusal('youtube_offline', 'YouTube is not connected');
    const [first, second] = builtin.categories;
    // Resolves to the category it landed on, so the deck can say which.
    const now = await services.youtube.toggleCategory(first, second);
    return { ok: true, category: youtubeCategoryName(now) };
  }
  throw refusal('no_builtin', `nothing knows how to run ${id}`);
}

export async function runDockAction(actionId) {
  const action = db.actions.get().find((a) => a.id === actionId);
  if (!action) throw refusal('action_gone', `no action with id ${actionId}`);
  if (action.enabled === false) throw refusal('action_disabled', `"${action.name}" is disabled`, { name: action.name });

  const ctx = buildContext({
    user: {
      name: DOCK_ACTION_USER,
      isSub: true,
      isMod: true,
      isVip: true,
      isBroadcaster: true,
    },
    message: '',
    platform: 'system',
    nowPlaying: services.spotify?.getNowPlaying?.() ?? null,
    upNext: services.spotify?.getUpNext?.() ?? null,
  });

  log.info(`dock action: "${action.name}"`);
  await runSteps(action.actions, ctx, services);
  return { ok: true, name: action.name };
}

/**
 * Run an action for a viewer — a points-shop reward they bought: {user} is
 * them and {message} what they typed with it, as if a command had fired it.
 */
export async function runActionFor(actionId, { name, id, avatar, platform = 'system', isSub = false, isMod = false, input = '' } = {}) {
  const action = db.actions.get().find((a) => a.id === actionId);
  if (!action) throw refusal('action_gone', `no action with id ${actionId}`);
  if (action.enabled === false) throw refusal('action_disabled', `"${action.name}" is disabled`, { name: action.name });
  const ctx = buildContext({
    user: { name, id, avatar, isSub, isMod, platform },
    message: String(input || ''),
    args: String(input || ''),
    platform,
    nowPlaying: services.spotify?.getNowPlaying?.() ?? null,
    upNext: services.spotify?.getUpNext?.() ?? null,
  });
  log.info(`"${action.name}" for ${name}`);
  await runSteps(action.actions, ctx, services);
  return { ok: true, name: action.name };
}

export async function testAction(actionId) {
  const action = db.actions.get().find((a) => a.id === actionId);
  if (!action) throw new Error(`no action with id ${actionId}`);

  const ctx = buildContext({
    user: { name: 'TestUser', isSub: true, isMod: true, isVip: true, isBroadcaster: true },
    message: '!test',
    platform: 'system',
    // Without this, pressing Test on a command that prints the current song
    // showed an empty line and looked like the command itself was broken.
    nowPlaying: services.spotify?.getNowPlaying?.() ?? null,
    upNext: services.spotify?.getUpNext?.() ?? null,
  });

  log.info(`test run: "${action.name}"`);
  await runSteps(action.actions, ctx, services);
}

/** Fire one alert config through the real dispatch path. */
export function testAlert(alertId, variationId = null) {
  const config = db.alerts.get().find((a) => a.id === alertId);
  if (!config) throw new Error(`no alert with id ${alertId}`);
  // Asked for now, so never held by a pause (alert-gate.js); with a variation, that one at its numbers.
  alerts.dispatch([config], alerts.buildTestEvent(config, variationId), services.spotify?.getNowPlaying?.() ?? null, services.spotify?.getUpNext?.() ?? null, { manual: true, variationId });
}
