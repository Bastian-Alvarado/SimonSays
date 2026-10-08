
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/

export type AppView = 'twitch' | 'dashboard' | 'assets' | 'plan' | 'run' | 'people' | 'questions' | 'players' | 'remote-players' | 'polls' | 'giveaway' | 'points' | 'streams' | 'requests' | 'voice' | 'go-live' | 'pngtuber' | 'pixel-avatars' | 'events' | 'studio' | 'actions' | 'gallery' | 'settings' | 'tags' | 'role-management' | 'reaction-roles' | 'discord-buttons' | 'welcome-goodbye' | 'discord-pages' | 'spotify-overlay' | 'levels' | 'dock-actions' | 'omnibar' | 'countdown' | 'timer' | 'viewers' | 'layouts' | 'library' | 'alerts' | 'guides';

/** One button on the Dock Actions surface. */
export interface DockButton {
  id: string;
  /** The StreamAction this fires. Empty on a built-in button. */
  actionId: string;
  /** A built-in button's name, which needs no action set up for it. */
  builtin?: string;
  /** Overrides the action's name on the button. Empty means use the name. */
  label: string;
  /** Which cell of the grid it sits in. Gaps are cells nothing claims. */
  slot: number;
  /** Which page of the dock it is on, from 0. See shared/dock-pages.js. */
  page: number;
  /** Six-digit hex. Empty means inherit the action's platform tint. */
  color: string;
  /** An emoji shown instead of the default glyph. */
  icon: string;
  /** A /media/ path or http(s) URL drawn behind the button. */
  image: string;
  /**
   * A picture per state, for a built-in button that shows one: the YouTube
   * category button keys these by category id. Wins over `image`.
   */
  stateImages?: Record<string, string>;
}

export interface LoadingState {
  isLoading: boolean;
  message: string;
}

export interface CommandPermissions {
  anyone: boolean;
  vips: boolean;
  subscribers: boolean;
  moderators: boolean;
  broadcaster: boolean;
}

export interface CooldownPermissions {
  vips: boolean;
  subscribers: boolean;
  moderators: boolean;
  broadcaster: boolean;
}

export interface Command {
  id: string;
  name: string; // Friendly name for the command group
  triggers: string[]; // Array of trigger words
  permissions: CommandPermissions;
  ignoreCooldowns?: CooldownPermissions; // New property for bypass logic
  enabled: boolean;
  globalCooldown?: number; // Seconds
  userCooldown?: number;   // Seconds
  /** Runs when typed in Discord. On unless turned off. */
  discord?: boolean;
}

// --- Chat Types ---

export interface ChatMessage {
  id: string; // Unique ID for React keys
  platform: 'twitch' | 'tiktok' | 'youtube' | 'discord';
  user: string;
  msg: string;
  color: string;
  time: string;
  avatar?: string;
  isMod?: boolean;
  isSub?: boolean;
  isVip?: boolean;
  /**
   * The channel owner. Sent by the server like the other three, but omitted
   * here until rank highlighting needed it.
   *
   * Only Twitch reports all four. YouTube reports owner, moderator and member
   * (as subscriber), TikTok moderator and subscriber; Discord reports none.
   */
  isBroadcaster?: boolean;
  emotes?: { [id: string]: string[] }; // Map of emote ID to array of range strings "start-end"
  /** Twitch "Highlight My Message" — a built-in reward, flagged via IRC tags. */
  highlighted?: boolean;
  /**
   * Set when this was typed into a channel-point reward that asks for text.
   * The same content also arrives as a redemption event, so surfaces showing
   * events hide this copy.
   */
  rewardId?: string | null;
  /**
   * Replayed from the server's saved tail when this surface opened, rather
   * than received live. Nothing that fires on arrival — speech, alerts — runs
   * for these.
   */
  restored?: boolean;
  /** When it arrived, in ms. What auto-hide and the timestamp format read. */
  at?: number;
  /** A stream event rendered inline in the dock rather than a real chat line. */
  isEvent?: boolean;
  eventType?: string;
  eventData?: any;
}

// --- Spotify Types ---

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
  progress: number;
  isPlaying: boolean;
}

export interface SpotifyState {
  isConnected: boolean;
  isAuthenticating: boolean;
  track: SpotifyTrack | null;
  error: string | null;
}

// --- Tags / Events Types ---

export interface TagEvent {
  user: string;
  platform: 'twitch' | 'tiktok' | 'kick';
  amount?: number;
  currency?: string; // 'BITS', 'DIAMONDS', 'VIEWERS', etc.
  timestamp: number;
  avatar?: string;
}

export interface StreamTags {
  latestFollower: TagEvent | null;
  latestSubscriber: TagEvent | null;
  latestDonation: TagEvent | null;
  topDonation: TagEvent | null;
  latestRaid: TagEvent | null;
}

/** One rotating slot in the omnibar. */
export interface OmnibarItem {
  id: string;
  type: 'text' | 'latestFollower' | 'latestSubscriber' | 'latestDonation'
    | 'topDonation' | 'latestRaid' | 'nowPlaying' | 'upNext' | 'countdown' | 'commands' | 'topChatters' | 'topSubscribers' | 'recentEvents'
    | 'goal';
  enabled: boolean;
  /** For your own reference in the editor. Never rendered on the bar. */
  name: string;
  /** Heading shown before the value. Blank falls back to a sensible default. */
  label: string;
  /** Only used by the 'text' type. */
  text: string;
  /** Seconds on screen; null uses the bar's default. */
  seconds: number | null;
  /** Always on the bar, beside the rotation rather than taking a turn in it. */
  pinned?: boolean;
  /** For a commands slot: which commands to advertise. Empty means all public ones. */
  commandIds?: string[];
  /** Show every trigger of a command, rather than just the first. */
  commandsAllTriggers?: boolean;
  /** For a top-chatters slot: how many names to show. */
  topCount?: number;
  /** Tall bars only: a small line under the label, such as "Donate now!". */
  sublabel?: string;
  /** Tall bars only: a message's second line, under its headline. */
  detail?: string;
  /** A goal slot: what it counts, what it is counting to, and the number kept by hand. */
  goalSource?: 'manual' | 'followers' | 'subs' | 'viewers' | 'tiktokLikes';
  goalTarget?: number;
  goalValue?: number;
  /** Whether a goal says what is left to go, or how far along it is. */
  goalShow?: 'remaining' | 'percent';
  /** Put before every figure, such as "$". */
  goalPrefix?: string;
}

/** An omnibar other than Main: its own slots, and a name a layer picks it by. */
export type OmnibarBar = OmnibarConfig & { id: string; name: string };

/**
 * Which kind of bar a bar is. The omnibar draws one line; a tall bar draws
 * each slot as a two-row card. Main is always the omnibar.
 */
export type OmnibarKind = 'classic' | 'tall';

export interface OmnibarConfig {
  /** Only ever set on a bar other than Main. Missing means the omnibar. */
  kind?: OmnibarKind;
  enabled: boolean;
  items: OmnibarItem[];
  defaultSeconds: number;
  style: {
    position: 'top' | 'bottom';
    height: number;
    /** These three are automatic when empty: the look's colour, or the bar's own (OMNIBAR_OWN). */
    background: string;
    textColor: string;
    accentColor: string;
    fontSize: number;
    uppercase: boolean;
    transition: 'slide' | 'fade' | 'none';
    /** Stored with empty as automatic, rather than the default in full (see the server's cleanOmnibar). */
    settingsVersion?: number;
    /** Walk a value too long for the bar past, rather than cutting it short. */
    scroll?: boolean;
    /** A picture held at the left end of the bar. Empty for none. */
    logo?: string;
    /** Its height, as a percentage of the bar's. */
    logoSize?: number;
    /** Paint no background at all, keeping the chosen colour for later. */
    transparent?: boolean;
  };
}

/** The run timer, as the server describes it. */
export interface StopwatchState {
  mode: 'idle' | 'running' | 'paused' | 'finished';
  /** Epoch ms on the *server's* clock it would have started at without its pauses. */
  startedAt: number | null;
  /** The time, whenever it is not running. */
  elapsedMs: number;
  style: {
    fontSize: number;
    color: string;
    pausedColor: string;
    finishedColor: string;
    background: string;
    showTenths: boolean;
  };
  /** The server's clock at the moment this was sent, for correcting skew. */
  serverNow?: number;
  /** When this frame reached this device, for clock-skew correction. */
  clientReceivedAt?: number;
}

/** The countdown, as the server describes it. */
export interface CountdownState {
  mode: 'idle' | 'running' | 'paused' | 'finished';
  /** Epoch ms on the *server's* clock; compare against serverNow, not Date.now(). */
  endsAt: number | null;
  remainingMs: number;
  durationMs: number;
  label: string;
  /** Saved setups for this one clock. See SavedTimers. */
  presets?: { id: string; name: string; durationMs: number; label: string; style?: any }[];
  /** Which saved setup the live fields came from. */
  activeId?: string;
  style: {
    fontSize: number;
    color: string;
    labelColor: string;
    background: string;
    showLabel: boolean;
  };
  /** The server's clock at the moment this was sent, for correcting skew. */
  serverNow?: number;
  /** When this frame reached this device, for clock-skew correction. */
  clientReceivedAt?: number;
}

export interface AppEvent {
  id: string;
  type: AlertType;
  platform: 'twitch' | 'tiktok' | 'obs' | 'discord' | 'spotify';
  // Who the event is about: the follower, raider, cheerer, gifter. The server
  // has always sent this — `normaliseEvent` sets it and every emit path
  // supplies it, including all the EventSub mappers — but the type omitted it,
  // so the events dock read `event.user` against a field TypeScript did not
  // believe existed.
  user: string;
  timestamp: number;
  avatar?: string; // Added avatar field
  data?: any; // Extra info like giftName, subTier, amount
}

// --- Connection / Relay Types ---

export interface RelayConfig {
  twitchToDiscord: boolean;
  tiktokToDiscord: boolean;
  youtubeToDiscord?: boolean;
  /** Out of the Discord channel the app reads (engine/relay.js). */
  discordToTwitch?: boolean;
  discordToYoutube?: boolean;
}

// --- Reaction Roles Types ---

export interface ReactionMapping {
  emoji: string;
  roleId: string;
  roleName?: string; // Cache for display
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/** One block of a Discord page (shared/discord-pages.js): which fields it has depends on its type. */
export interface DiscordPageBlock {
  id: string;
  type: 'banner' | 'card' | 'text' | 'gap' | 'links';
  image?: string;
  author?: string;
  title?: string;
  url?: string;
  description?: string;
  color?: string;
  fields?: { name: string; value: string; inline: boolean }[];
  thumbnail?: string;
  footer?: string;
  text?: string;
  size?: 'small' | 'large';
  line?: boolean;
  buttons?: { label: string; url: string; emoji: string }[];
  reactions?: string[];
  /** A banner's words, drawn into its picture by the server. */
  caption?: BannerCaption;
  /** One picture inside a banner, under the words. */
  inset?: BannerInset;
}

export interface BannerCaption {
  text: string;
  font: string;
  weight: number;
  /** Height of the words, as a share of the banner's height. */
  size: number;
  color: string;
  at: 'top' | 'middle' | 'bottom';
  align: 'left' | 'center' | 'right';
  shadow: boolean;
  outline: boolean;
  /** Placed by hand: where their middle is, as a share of the banner's width and height. Null where `at` and `align` put them. */
  x?: number | null;
  y?: number | null;
}

export interface BannerInset {
  image: string;
  /** Where its middle is, as a share of the banner's width and height. */
  x: number;
  y: number;
  /** Its height, as a share of the banner's. */
  size: number;
}

export interface DiscordPagePost {
  channelId: string;
  style?: 'classic' | 'single';
  ids: string[];
  kinds?: string[];
  at: number;
  cut?: number;
}

/** A channel's standing post, built on the Discord pages screen. */
export interface DiscordPage {
  id: string;
  name: string;
  channelId: string;
  style: 'classic' | 'single';
  color: string;
  blocks: DiscordPageBlock[];
  /** Kept up to date: edited in place as its { } values change. */
  live?: boolean;
  posted: DiscordPagePost | null;
  tested: DiscordPagePost | null;
  source: DiscordPagePost | null;
  updatedAt: number;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: string; // Hex string
  footer?: string;
  thumbnail?: string; // URL
  image?: string; // URL
  fields?: DiscordEmbedField[];
}

export interface ReactionRoleMessage {
  id: string; // Internal UUID
  messageId: string; // Discord Message ID
  channelId: string;
  guildId: string;
  name: string; // Friendly label
  mode?: 'standard' | 'unique'; // Behavior mode
  content: string; // Message content (outside embed)
  embed?: DiscordEmbed; // Optional Rich Embed
  mappings: ReactionMapping[];
}

export interface RoleActivityLogEntry {
  id: string;
  timestamp: number;
  user: string; // Discord User ID or Name
  action: 'added' | 'removed';
  roleName: string;
  menuName: string;
}

// --- Discord Buttons Types ---

export interface DiscordButtonMapping {
  id: string; // Internal ID for React keys
  label: string;
  style: '1' | '2' | '3' | '4'; // 1: Blurple, 2: Gray, 3: Green, 4: Red
  emoji?: string;
  roleId: string;
  roleName?: string;
}

export interface DiscordButtonMessage {
  id: string;
  messageId: string;
  channelId: string;
  guildId: string;
  name: string;
  content: string;
  embed?: DiscordEmbed;
  buttons: DiscordButtonMapping[];
}

// --- Welcome / Goodbye Types ---

// New Canvas Types
export interface WelcomeGoodbyeEntry {
  enabled: boolean;
  channelId: string;
  messages: string[]; // Array of message variations
  // Card / Embed Properties
  sendCard: boolean;
  cardTitle?: string;
  cardDescription?: string;
  cardColor?: string;
  cardThumbnail?: boolean; // Use user avatar as thumbnail
  cardImage?: string; // Large Image URL
  cardFooter?: string;
  // NEW: Auto Role
  autoRoleId?: string;
  // A picture of them, drawn on the server: see WelcomeCardEditor and shared/card-css.js.
  image?: import('./components/WelcomeCardEditor').WelcomeCard;
  /** An emoji the bot reacts to its own post with, for everybody else to add theirs. '' is none. */
  react?: string;
  /** Buttons under the post: links, and roles anybody can pick up. See cleanButtons in server/engine/welcome.js. */
  buttons?: GreetingButton[];
  /** The welcome's direct message to the newcomer: its own lines, the card if wanted, the link buttons. */
  dm?: { enabled: boolean; messages: string[]; picture: boolean; links: boolean };
}

export interface GreetingButton {
  kind: 'link' | 'role';
  label: string;
  emoji?: string;
  url?: string;
  roleId?: string;
  /** A role button's colour, as Discord numbers them: 1 blurple, 2 grey, 3 green, 4 red. */
  style?: number;
}

export interface WelcomeGoodbyeConfig {
  welcome: WelcomeGoodbyeEntry;
  goodbye: WelcomeGoodbyeEntry;
  boost?: WelcomeGoodbyeEntry;
  ban?: WelcomeGoodbyeEntry;
  /** Where a test goes: a private channel, so trying one out is not a post everybody sees. '' is the real channel. */
  testChannelId?: string;
}

/** The kinds of greeting post, in the order the screen shows them. */
export type GreetingKind = 'welcome' | 'goodbye' | 'boost' | 'ban';

// --- Role Management Types ---

export interface RoleMappingConfig {
  subscriberTier1: string | null;
  subscriberTier2: string | null;
  subscriberTier3: string | null;
  vip: string | null;
  moderator: string | null;
  // New Expanded Types
  follower: string | null;
  founder: string | null;
  bits1k: string | null;
  bits5k: string | null;
  bits10k: string | null;
  bits25k: string | null;
  // TikTok Specific
  tiktokFollower: string | null;
  tiktokSubscriber: string | null;
  tiktokModerator: string | null;
  tiktokGifter: string | null;
}

export interface LinkedUserData {
  id: string;
  username: string;
  avatar?: string;
  linkedAt: number;
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  twitchUser: string;
  platform?: 'twitch' | 'tiktok'; // Added platform field
  roleName: string;
  source: 'Auto' | 'Manual';
}

// --- Leveling System Types ---

export interface RoleReward {
  level: number;
  roleId: string;
  roleName?: string;
}

export interface LevelSystemConfig {
  enabled: boolean;
  xpRate: number; // Multiplier
  minXp: number;
  maxXp: number;
  cooldown: number; // Seconds
  levelUpMessage: string;
  announceChannelId?: string; // Null = Current Channel
  roleRewards: RoleReward[];
  ignoredChannelIds: string[];
  /** "!rank" and "!top" in chat (server/leveling/chat.js). */
  chat?: {
    enabled: boolean;
    rankWord: string;
    topWord: string;
    rankText: string;
    topText: string;
    topCount: number;
    youtube: boolean;
  };
}

export interface LevelProfile {
  userId: string;
  username: string;
  avatar?: string;
  xp: number;
  level: number;
  lastXpTime: number; // Timestamp
}

// --- New Action System Types ---

export type TriggerCategory = 'command' | 'twitch' | 'tiktok' | 'obs' | 'discord' | 'spotify' | 'system';

export type TriggerType = 
  | 'command_trigger' 
  | 'twitch_follow' | 'twitch_sub' | 'twitch_cheer' | 'twitch_raid' | 'twitch_redemption'
  | 'tiktok_follow' | 'tiktok_sub' | 'tiktok_share' | 'tiktok_gift'
  | 'obs_stream_started' | 'obs_stream_stopped' | 'obs_recording_started' | 'obs_recording_stopped'
  | 'obs_scene_changed' // NEW
  | 'discord_message'
  // Somebody joining the Discord server, or boosting it.
  | 'discord_join' | 'discord_boost'
  | 'spotify_track_change' | 'spotify_played' | 'spotify_paused'
  // The app's own stream tools: the countdown reaching zero, a poll closing, somebody levelling up.
  | 'countdown_finished' | 'poll_closed' | 'level_up'
  // An action that repeats every so many minutes (server/engine/repeat.js).
  | 'timer_interval'
  // An action on a calendar: set days, a set time (server/engine/repeat.js).
  | 'timer_schedule'
  // A giveaway's winner, once the overlay's reel stops (server/engine/giveaway.js).
  | 'giveaway_winner'
  // Somebody spending points in the shop (server/engine/points.js).
  | 'points_redeem'
  // Chat going wild on every platform at once (server/engine/highlights.js): only actions.
  | 'chat_highlight'
  // The Discord call on the Voice call screen: only actions, never alerts.
  | 'discord_call_join' | 'discord_call_leave' | 'discord_call_count' | 'discord_call_talking'
  // Omnilayer: a layout going live.
  | 'layout_changed';

export interface ActionTrigger {
  id: string;
  category: TriggerCategory;
  type: TriggerType;
  // Configuration for the trigger (e.g., specific command name, gift name)
  config: {
    commandId?: string; // Changed from command string to ID for better linking
    minBits?: number;
    giftName?: string;
    rewardName?: string; // For Channel Point Redemptions
    rewardId?: string; // Unique ID for Channel Point Redemptions
    targetScene?: string; // NEW: For Scene Change Trigger
    /** Countdown finished: one saved countdown, by id. Empty is any of them. */
    timerId?: string;
    /** Layout changed: one layout, by id. Empty is any. */
    layoutId?: string;
    /** Every few minutes: how often, whether only while live, and how much chat first. */
    minutes?: number;
    onlyLive?: boolean;
    minChat?: number;
    /** On set days, at a set time: days as JavaScript counts them (0 Sunday), "HH:MM", and the time zone it is in. */
    days?: number[];
    time?: string;
    tz?: string;
    /** The Discord call: one person by Discord id (empty is anyone), a number of people, a pause before talking. */
    discordId?: string;
    people?: number;
    quietSeconds?: number;
  };
}

export type ActionStepType =
  | 'omnibar_set'
  | 'run_set_game'
  | 'run_set_platform'
  | 'run_set_year'
  | 'run_set_category'
  | 'run_set_estimate'
  | 'run_set_runner'
  | 'run_set_host'
  | 'run_set_commentator'
  | 'run_clear'
  | 'plan_add'
  | 'plan_next'
  | 'plan_back'
  | 'text_layer_set'
  | 'goal_change'
  | 'deaths_change'
  | 'timer_control'
  | 'countdown_control'
  | 'layout_switch'
  | 'remote_on_screen'
  | 'question_add'
  | 'players_join'
  | 'players_state'
  | 'players_remove'
  | 'players_reset'
  | 'players_clear'
  | 'poll_open'
  | 'poll_close'
  | 'poll_reset'
  // The giveaway: open the one set up (a prize may be given), stop entries, draw.
  | 'giveaway_open' | 'giveaway_close' | 'giveaway_draw'
  | 'avatar_face'
  | 'avatar_dress'
  | 'avatar_action'
  | 'twitch_shoutout'
  | 'twitch_clip'
  | 'twitch_marker'
  | 'youtube_set_title'
  | 'youtube_set_description'
  | 'youtube_toggle_category'
  | 'twitch_chat' 
  | 'twitch_set_title'
  | 'twitch_set_category'
  | 'obs_scene' 
  | 'obs_visibility' 
  | 'obs_text'
  | 'obs_filter_toggle'
  | 'obs_set_volume'
  | 'obs_set_mute'
  | 'obs_save_replay'
  | 'obs_stop_stream'
  | 'obs_set_browser_url'
  | 'obs_set_transform'
  | 'discord_webhook'
  | 'discord_send'
  | 'spotify_control'
  | 'droidcam_control'
  | 'condition'
  | 'trigger_action'
  | 'browser_tts'; // NEW: Text to Speech

export interface SingleCondition {
  id: string;
  variable: string; // 'user.isSub', 'user.isMod', 'random.1-100', 'message.content'
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matchesRegex' | 'greaterThan' | 'lessThan' | 'isTrue' | 'isFalse';
  value: string;
}

export interface ConditionLogic {
  // New Array-based structure
  matchType?: 'AND' | 'OR';
  conditions?: SingleCondition[];
  
  // Legacy fields (kept for migration types)
  variable?: string;
  operator?: string;
  value?: string;
}

export interface ActionStep {
  id: string;
  type: ActionStepType;
  // Configuration for the action (e.g., message text, scene name)
  config: {
    /** omnibar_set: which text slot to write into, and what to put there. */
    slotId?: string;
    text?: string;
    /** avatar_face: which face, and for how long. */
    face?: string;
    /** Avatar: do something — which thing (drink), or {input}. */
    action?: string;
    /** Avatar: dress up — an outfit or a hat, and for how many minutes. */
    what?: 'outfit' | 'hat';
    /** Twitch: who to shout out (a marker's note is description). */
    target?: string;
    minutes?: number;
    seconds?: number;
    /** run_set_game … run_set_estimate: what the field becomes. Empty clears it. */
    value?: string;
    /** run_set_runner / host / commentator: the name, and a second line only when set. players_*: who the step is about. */
    name?: string;
    subtitle?: string;
    /** run_set_commentator: which seat, counted from 1. */
    seat?: number;
    /** remote_on_screen: whose game — a seat's number, or {input} for what chat typed — and whether any layout may be switched from. */
    player?: string;
    anyLayout?: boolean;
    /** run_clear: which part of the card to empty. */
    clearWhat?: 'all' | 'details' | 'people' | 'commentators';
    /** text_layer_set: which layout, and which text layer in it by its uid. */
    layoutId?: string;
    layerUid?: string;
    /** goal_change: set the number, move it by the amount, or read the sign to decide. */
    goalMode?: 'auto' | 'set' | 'add' | 'subtract';
    /** The Deaths step: by what is typed, or always one way. */
    deathsOp?: 'auto' | 'add' | 'subtract' | 'set' | 'reset';
    /** The Countdown step: what to do, and for start, which saved countdown (empty is the one set up now). */
    countdownOp?: 'start' | 'toggle' | 'pause' | 'resume' | 'add' | 'reset';
    timer?: string;
    /** The Omnilayer step: how the layout arrives. Empty is as set up on the Layouts screen. */
    transition?: '' | 'cut' | 'cover';
    /** youtube_toggle_category: the category to switch to, and the one to switch back to. */
    categoryA?: string;
    categoryB?: string;
    /** youtube_set_description: the whole new description. */
    description?: string;
    /** players_join: the colour, by name ("red") or hex. */
    colour?: string;
    /** players_state: where the player now stands. */
    playerState?: 'in' | 'out' | 'ejected' | 'dead';
    /** question_add: who the queue credits; blank means whoever ran the action. */
    asker?: string;
    /** timer_control: what to do to the run timer. */
    timerOp?: 'toggle' | 'start' | 'pause' | 'finish' | 'undoFinish' | 'reset';
    /** plan_add: the activity is `text`; this is the line under it. */
    note?: string;
    /** plan_add: at the bottom of the plan, or straight after the current activity. */
    where?: 'end' | 'next';
    message?: string;
    sceneName?: string;
    sourceName?: string;
    visible?: boolean;
    textContent?: string;
    useBotAccount?: boolean;
    /** A chat step's destination: Twitch (also when unset), YouTube, both, or where what set it off came from. */
    sendTo?: 'twitch' | 'youtube' | 'both' | 'origin';
    /** giveaway_open: the prize, or empty for the one set up on the Giveaways screen. */
    prize?: string;
    fallbackToMain?: boolean;
    actionId?: string; // For Trigger Action
    webhookUrl?: string; // For Discord Webhook
    /** discord_send: where, and the optional card under the message. */
    channelId?: string;
    card?: boolean;
    cardTitle?: string;
    cardDescription?: string;
    cardColor?: string;
    cardImage?: string;
    cardUrl?: string;
    // Twitch Stream Mgmt
    title?: string;
    gameId?: string;
    gameName?: string;
    // Spotify Control
    spotifyOperation?: 'play' | 'pause' | 'next' | 'previous' | 'queue';
    /** Camera control on a phone running DroidCam. See server/platforms/droidcam.js. */
    droidcamOperation?: string;
    droidcamValue?: string;
    spotifyUri?: string; // For adding to queue
    // Condition Config
    logic?: ConditionLogic;
    // OBS Advanced
    filterName?: string;
    filterEnabled?: boolean;
    volumeDb?: number;
    muted?: boolean;
    browserUrl?: string;
    positionX?: number;
    positionY?: number;
    scale?: number;
    rotation?: number;
    // TTS Config
    ttsProvider?: 'browser' | 'gemini';
    ttsVoice?: string;
    ttsText?: string;
    ttsRate?: number; // 0.1 - 2.0
    ttsPitch?: number; // 0 - 2
    ttsVolume?: number; // 0 - 1
  };
  // Recursive Branches
  thenActions?: ActionStep[];
  elseActions?: ActionStep[];
}

export interface StreamAction {
  id: string;
  name: string;
  enabled: boolean;
  trigger: ActionTrigger;
  actions: ActionStep[];
}

// --- Alert System Types ---

export type AlertType =
  // A kind on its own answers to the same thing on every platform at once.
  | 'follow' | 'sub' | 'sub_gift_bulk' | 'cheer' | 'raid' | 'gift' | 'share'
  | 'twitch_follow' | 'twitch_sub' | 'twitch_sub_gift_bulk' | 'twitch_cheer' | 'twitch_raid' | 'twitch_redemption'
  // No youtube_follow: YouTube raises no event for a free subscribe.
  | 'youtube_sub' | 'youtube_sub_gift_bulk' | 'youtube_cheer'
  | 'tiktok_follow' | 'tiktok_sub' | 'tiktok_gift' | 'tiktok_share'
  | 'obs_stream_started' | 'obs_stream_stopped' | 'obs_recording_started' | 'obs_recording_stopped'
  | 'obs_scene_changed' // New
  | 'discord_message'
  | 'discord_join' | 'discord_boost'
  | 'spotify_track_change' | 'spotify_played' | 'spotify_paused'
  | 'level_up' | 'giveaway_winner' | 'points_redeem';

/** A number an alert variation can test against the event that fired it. */
export interface AlertCondition {
  field: 'bits' | 'value' | 'tier' | 'months' | 'viewers' | 'cost' | 'count' | 'diamonds' | 'amount' | 'level';
  op: 'gte' | 'lte' | 'eq';
  value: number;
}

/**
 * A different look for the same event, chosen by size.
 *
 * Only the fields actually set here override the alert, so a variation that
 * changes the sound alone inherits everything else. The server picks the first
 * variation whose conditions all hold, in order — not the most specific one,
 * because ordering is the only rule you can predict by reading the list.
 */
export interface AlertVariation extends Partial<Omit<AlertConfig, 'id' | 'name' | 'type' | 'enabled' | 'variations' | 'redemptionRewardId'>> {
  id: string;
  name: string;
  conditions: AlertCondition[];
}

export interface AlertConfig {
  id: string;
  name: string;
  type: AlertType;
  enabled: boolean;
  
  // Visuals
  imageUrl?: string;
  soundUrl?: string;
  layout: 'image-above' | 'image-left' | 'image-right' | 'image-cover';
  
  // Content
  messageTemplate: string; // "{user} followed!"
  highlightText: boolean; // Wrap user in span
  
  // Styling
  fontFamily: string;
  fontSize: number;
  textColor: string;
  accentColor: string;
  duration: number; // ms
  animationIn: string;
  animationOut: string;
  /** This alert's own stylesheet, scoped to it. Not the layer's: see AlertOverlay. */
  css?: string;
  /** And its motion, kept apart so a change of look cannot take it. */
  motionCss?: string;
  /** 0..1. Alerts are loud by default and a stream mix rarely wants that. */
  soundVolume?: number;

  // Specifics
  redemptionRewardId?: string; // For Channel Point Redemptions

  /**
   * Read aloud as it shows. {alert} in the text is the caption, {message}
   * what the viewer wrote with it. A browser voice of the computer that
   * speaks; the wait is so it does not talk over the alert's sound.
   */
  tts?: { enabled: boolean; text: string; voice: string; rate: number; pitch: number; volume: number; delayMs: number };

  /** Different looks for different sizes of the same event. First match wins. */
  variations?: AlertVariation[];
}

export interface ActiveAlert {
  id: string; // Runtime ID
  config: AlertConfig;
  user: string;
  data?: any; // Extra data (bits amount, gift name)
  /**
   * The message template already interpolated by the server.
   *
   * Pre-rendered there so every connected overlay shows identical text, and so
   * variables the browser has no way to resolve — the event payload, what
   * Spotify is playing — still work. The renderer should use this, not the
   * template.
   */
  text?: string;
  avatar?: string;
  /** What to read aloud, sent only to the one page that speaks. */
  speak?: { text: string; voiceURI?: string; rate?: number; pitch?: number; volume?: number; delayMs?: number };
  /**
   * True on the one page that speaks, which alone plays the alert's sound:
   * with the alerts page and a stream page both in OBS, it is heard once.
   */
  audible?: boolean;
  /** A test or a replay: somebody asked to see it now, so a pause did not hold it. */
  manual?: boolean;
}

// --- Theme & Language Types ---

export type ThemeId = 'light' | 'simon-default' | 'midnight-purple' | 'emerald-drift' | 'cyberpunk-gold' | 'ocean-blue';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  primary: string;
  accentClass: string;
  bgClass: string;
  panelClass: string;
  textClass: string;
  borderClass: string;
  isLight?: boolean;
}

export type ChatThemeId = 'modern' | 'compact' | 'retro' | 'custom';

export interface ChatThemeConfig {
  id: ChatThemeId;
  name: string;
}

export type Language = 'en' | 'es';

/** A patch laid over a pixel avatar's drawing: at its top-left corner, '.' keeps a pixel, '_' clears it. */
export interface PixelPatch { at: [number, number]; rows: string[] }

/** A pixel avatar made in the Pixel avatars tab, as shared/pixel-avatars.js describes it. */
export interface PixelAvatarDef {
  id: string;
  name: string;
  /** Which built-in drawing an example was converted from. */
  example?: string;
  version: number;
  parts: { id: string; char: string; color: string; name: string; opacity?: number; effect?: 'float' | 'pop' }[];
  base: string[];
  baseLabel: string;
  baseWords: string[];
  faces: { name: string; label: string; patches: PixelPatch[]; glances: boolean; blinks: boolean }[];
  extras: { name: string; label: string; patches: PixelPatch[]; hat: boolean; art?: { x: number; y: number; size: number; palette: string[]; rows: string[] }; words: string[] }[];
  outfits: { name: string; label: string; rows: string[]; headwear: boolean; ownFace?: { region: number[]; glasses: PixelPatch[]; faces: Record<string, PixelPatch[]> }; lashesTo?: number; words: string[] }[];
  actions: { name: string; label: string; words: string[]; outfits: Record<string, { ms: number; eyes?: 'shut'; patches: PixelPatch[] }[]> }[];
  split: { headLastRow: number; carried: string[]; follow: boolean };
  overHat: string[];
  eyes: Record<string, any> | null;
  colouring: { main: string; coloured: string[]; eyes: string[]; suit: { armour: string; body: string[] } | null } | null;
  bubble: PixelPatch[];
  /** The front view: its own drawing and faces, and the outfits and extras as they look from the front, by their names. */
  turn: { front: { base: string[]; faces: PixelAvatarDef['faces']; headLastRow: number; outfits?: { name: string; rows: string[] }[]; extras?: { name: string; patches: PixelPatch[] }[] }; mirrorKeep: number[][] } | null;
  drawnFacing: 'left' | 'right';
}
