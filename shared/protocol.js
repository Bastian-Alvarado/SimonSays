/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Shared wire protocol between the headless server and any client
 * (config UI, overlay, chat dock, third-party tooling).
 *
 * This file is consumed by both `server/` (CommonJS via esm interop) and
 * `web/` (ESM via Vite). Keep it dependency-free and side-effect-free.
 */

/** Client -> Server */
export const C2S = {
  // Handshake / sync
  HELLO: 'hello',
  GET_SNAPSHOT: 'get_snapshot',

  // Config CRUD (server is the source of truth)
  SAVE_COMMAND: 'save_command',
  DELETE_COMMAND: 'delete_command',
  SAVE_ACTION: 'save_action',
  DELETE_ACTION: 'delete_action',
  SAVE_ALERT: 'save_alert',
  DELETE_ALERT: 'delete_alert',
  SET_SETTINGS: 'set_settings',
  SET_TAG_OUTPUTS: 'set_tag_outputs',
  SYNC_TAG_OUTPUTS: 'sync_tag_outputs',
  SET_RELAY_CONFIG: 'set_relay_config',
  SET_DOCK_BUTTONS: 'set_dock_buttons',
  SET_DOCK_GRID: 'set_dock_grid',
  SET_OMNIBAR: 'set_omnibar',
  SET_OMNIBARS: 'set_omnibars',
  SET_VIEWERS: 'set_viewers',
  SET_PLAN: 'set_plan',
  SET_RUN: 'set_run',
  QUESTION_SET_STATUS: 'question_set_status',
  QUESTION_SHOW: 'question_show',
  QUESTIONS_CLEAR: 'questions_clear',
  QUESTIONS: 'questions',
  EVENTS: 'events',
  SET_PLAYERS: 'set_players',
  PLAN_GOTO: 'plan_goto',
  PLAN_SAVED: 'plan_saved',
  PEOPLE: 'people',
  SET_LAYOUTS: 'set_layouts',
  SET_CHAT_DOCK_SETTINGS: 'set_chat_dock_settings',
  PROFILE_SWITCH: 'profile_switch',
  PROFILE_CREATE: 'profile_create',
  PROFILE_DUPLICATE: 'profile_duplicate',
  PROFILE_RENAME: 'profile_rename',
  PROFILE_DELETE: 'profile_delete',
  PROFILE_CAPTURE: 'profile_capture',
  PROFILE_REVERT: 'profile_revert',
  DROIDCAM_SETTINGS: 'droidcam_settings',
  DROIDCAM_PROBE: 'droidcam_probe',
  DROIDCAM_CONTROL: 'droidcam_control',
  COUNTDOWN: 'countdown',
  OMNILAYER: 'omnilayer',
  /** The Pixel avatars tab: { op, … } — see server/engine/pixel-avatars.js. */
  PIXEL_AVATARS: 'pixel_avatars',
  // The themes made in the app: create, save, rename, delete (server/engine/user-themes.js).
  USER_THEMES: 'user_themes',
  POLL: 'poll',
  /** The giveaway: { op, value } — setDraft, open, close, draw, reroll, reset, remove, settings. */
  GIVEAWAY: 'giveaway',
  /** The Discord pages screen: { op, … } — save, remove, post, test, unpost, import, delete_source (server/engine/discord-pages.js). */
  DISCORD_PAGES: 'discord_pages',
  MIC: 'mic',
  TWITCH_EXTRAS: 'twitch_extras',
  SET_VOICE: 'set_voice',
  ROLE_SYNC: 'role_sync',
  WELCOME_CARD_PREVIEW: 'welcome_card_preview',
  /** Post a welcome, goodbye, boost or ban now, with the settings on screen: { kind, config, testChannelId }. */
  WELCOME_TEST: 'welcome_test',
  ANNOUNCE: 'announce',
  /** The Twitch schedule as Discord events: { settings } or { op: 'sync' }. */
  SCHEDULE_EVENTS: 'schedule_events',
  /** Viewer history: { op: 'settings', settings } | { op: 'stats' } | { op: 'prune' } (server/engine/viewer-history.js). */
  HISTORY: 'history',
  /** The Points screen: { op: 'settings' | 'post_shop' | 'give' | 'board', … } (server/engine/points.js). */
  POINTS: 'points',
  /** The profile card: { op: 'settings', settings } | { op: 'preview', uid?, settings? } (server/engine/profile-card.js). */
  PROFILE_CARD: 'profile_card',
  /** Highlights: { op: 'settings', settings } | { op: 'test' } (server/engine/highlights.js). */
  HIGHLIGHTS: 'highlights',
  /** Past streams: { op: 'list' } | { op: 'get', id } (server/engine/stream-sessions.js). */
  STREAMS: 'streams',
  /** Private go-live messages: { op: 'settings', settings } | { op: 'post', channelId } | { op: 'test' } (server/engine/live-dms.js). */
  LIVE_DMS: 'live_dms',
  /** Remote players: { op: 'set' | 'setup' | 'invite' | 'kick' | 'swap' | 'mute' | 'reload', … } (server/engine/remote-players.js). */
  REMOTE_PLAYERS: 'remote_players',
  /** Questions from Discord: { settings } (server/engine/discord-questions.js). */
  DISCORD_QUESTIONS: 'discord_questions',
  /** Game requests: { op: 'settings' | 'read' | 'plan' | 'played' | 'dismiss' | 'reopen' | 'remove', … } (server/engine/game-requests.js). */
  GAME_REQUESTS: 'game_requests',
  /** Moderation: { op: 'settings', settings } | { op: 'act', uid, platform, action } | { op: 'log' } (server/engine/moderation.js). */
  MODERATION: 'moderation',
  STOPWATCH: 'stopwatch',
  /** Change a count kept by hand (deaths): { name, op, value }. */
  COUNTER: 'counter',
  RUN_DOCK_ACTION: 'run_dock_action',
  SET_ROLE_MAPPINGS: 'set_role_mappings',
  SET_WELCOME_GOODBYE: 'set_welcome_goodbye',
  SET_REACTION_ROLES: 'set_reaction_roles',
  SET_BUTTON_MENUS: 'set_button_menus',
  CLEAR_ROLE_LOG: 'clear_role_log',

  // Runtime control
  TEST_ACTION: 'test_action',
  TEST_ALERT: 'test_alert',
  /** Skip, pause, resume, toggle or clear alerts, or `hold` them while nothing shows them. Payload: { op, value } */
  ALERT_CONTROL: 'alert_control',
  RUN_ACTION: 'run_action',
  SEND_CHAT: 'send_chat',
  CLEAR_EVENTS: 'clear_events',
  CLEAR_SYNC_LOG: 'clear_sync_log',

  // Platform lifecycle
  PLATFORM_CONNECT: 'platform_connect',
  PLATFORM_DISCONNECT: 'platform_disconnect',
  SET_CREDENTIALS: 'set_credentials',
  CONFIG_EXPORT: 'config_export',
  CONFIG_IMPORT: 'config_import',

  // Twitch
  TWITCH_FETCH_REWARDS: 'twitch_fetch_rewards',
  TWITCH_FETCH_TAGS: 'twitch_fetch_tags',
  TWITCH_SEARCH_CATEGORIES: 'twitch_search_categories',
  TWITCH_GET_USER: 'twitch_get_user',

  // Spotify
  SPOTIFY_CONTROL: 'spotify_control',
  SPOTIFY_QUEUE: 'spotify_queue',
  SPOTIFY_REFRESH: 'spotify_refresh',
  SPOTIFY_EXCHANGE_CODE: 'spotify_exchange_code',
  YOUTUBE_EXCHANGE_CODE: 'youtube_exchange_code',
  YOUTUBE_SET_SETTINGS: 'youtube_set_settings',
  YOUTUBE_LOGOUT: 'youtube_logout',

  // Leveling
  GET_XP_DATA: 'get_xp_data',
  UPDATE_XP_CONFIG: 'update_xp_config',
  RESET_XP: 'reset_xp',
  LINK_IDENTITIES: 'link_identities',
  UNLINK_USER: 'unlink_user',

  // Discord passthrough (kept 1:1 with V2 relay so behaviour is preserved)
  DISCORD: 'discord',
};

/** Server -> Client */
export const S2C = {
  // Full state replication
  SNAPSHOT: 'snapshot',
  CONFIG_PATCH: 'config_patch',
  STATUS: 'status',

  // Live stream
  CHAT: 'chat',
  EVENT: 'event',
  ALERT: 'alert',
  TAGS: 'tags',
  /** Live counters (viewers, likes) published for OBS text sources. */
  STATS: 'stats',
  /** Remove messages deleted upstream. Payload: { platform, msgIds, userIds } */
  CHAT_DELETE: 'chat_delete',
  /** Late-resolved profile pictures, applied to messages already on screen. */
  AVATARS: 'avatars',
  /** The alert on screen ends (`skip`), or every alert waiting in a page's queue goes (`clear`). Payload: { op } */
  ALERT_CONTROL: 'alert_control',

  // Local-device side effects the browser must perform
  // (audio + speech synthesis are browser-only capabilities)
  PLAY_AUDIO: 'play_audio',
  PLAY_TTS: 'play_tts',

  // Leveling
  XP_DATA: 'xp_data',
  XP_LEVELUP: 'xp_levelup',

  // Request/response correlation
  REPLY: 'reply',
  ERROR: 'error',
};

/**
 * Keys persisted server-side. Anything not in this list is considered
 * device-local (theme, font sizes, overlay chrome) and stays in localStorage.
 */
export const PERSISTED_CONFIG_KEYS = [
  'commands',
  'streamActions',
  'alertConfigs',
  'tagOutputs',
  'relayConfig',
  'roleMappings',
  'welcomeGoodbyeConfig',
  'reactionRoleConfigs',
  'discordButtonConfigs',
  'linkedUsers',
];

export const DEFAULT_PORT = 8081;
