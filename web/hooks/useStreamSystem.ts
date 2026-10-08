/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * `useStreamSystem` — same public contract as V2, completely different insides.
 *
 * V2 this hook *was* the application: it held the platform connections, the
 * command engine, the cooldown state and the alert queue, which is why nothing
 * worked with the tab closed. It is now a replica of server state plus a
 * request channel.
 *
 * The returned object is shape-identical to V2 on purpose — `App.tsx` and every
 * view under `components/` are byte-for-byte unchanged from the original.
 *
 * What still lives here, correctly:
 *   - display preferences (theme, font sizes, chat chrome) — per-device
 *   - the chat ring buffer and alert queue — per-surface rendering state
 *   - OAuth redirects — inherently a browser flow; the token is handed to the
 *     server immediately and never used from here
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Command, StreamAction, AlertConfig, ActiveAlert, ChatMessage, AppEvent,
  ThemeId, ChatThemeId, Language, AlertType, RelayConfig, ReactionRoleMessage,
  DiscordButtonMessage, RoleMappingConfig, WelcomeGoodbyeConfig, DockButton,
  OmnibarConfig, CountdownState, PixelAvatarDef,
} from '../types';
import { CHAT_THEMES, chatEventsOn } from '../constants';
import { PLATFORMS } from '../../shared/platforms.js';
import { CHAT_STYLE_KEYS } from '../../shared/chat-style.js';
import { DOCK_CHAT_CSS } from '../../shared/css-presets.js';
import { ASSET_KINDS, assetKindOf } from '../../shared/asset-kinds.js';
import { safeJSONParse, spotifyRedirectUri, youtubeRedirectUri } from '../utils';
import { useBackend, httpBase, C2S, S2C } from './useBackend';
import { rememberDiscordNames, rememberDiscordLists } from '../discordEmoji';

const CHAT_BUFFER = 200;

/**
 * The browser's voice list, waiting for it if it is not ready yet.
 *
 * `speechSynthesis.getVoices()` is populated asynchronously: the first call on
 * a freshly loaded document returns an empty array, and `voiceschanged` fires
 * once the list arrives. Looking the voice up at speak time therefore found
 * nothing for the very first utterance after the dock opened, left
 * `utterance.voice` unset, and the browser used its own default — which is
 * en-US regardless of what was selected. Every later utterance matched,
 * because that first call is itself what kicks the load off. Hence "the first
 * one of the day is in English".
 *
 * Uses addEventListener rather than assigning `onvoiceschanged`, which the
 * Actions editor also sets — assigning would silently unhook whichever loaded
 * second.
 */
let voiceListPromise: Promise<SpeechSynthesisVoice[]> | null = null;

const getVoicesWhenReady = (): Promise<SpeechSynthesisVoice[]> => {
  if (!window.speechSynthesis) return Promise.resolve([]);

  const ready = window.speechSynthesis.getVoices();
  if (ready.length) return Promise.resolve(ready);

  // Cached so several utterances arriving at once share one wait.
  if (!voiceListPromise) {
    voiceListPromise = new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.speechSynthesis.removeEventListener('voiceschanged', finish);
        clearTimeout(timer);
        voiceListPromise = null;
        resolve(window.speechSynthesis.getVoices());
      };
      // A browser with genuinely no voices never fires the event. Speak with
      // the default rather than swallowing the message.
      const timer = setTimeout(finish, 2000);
      window.speechSynthesis.addEventListener('voiceschanged', finish);
    });
  }
  return voiceListPromise;
};

/**
 * Find the chosen voice, tolerating engines that disagree about how to name it.
 *
 * Matched on `voiceURI` first, then on `name`. The URI is captured in whichever
 * browser authored the action, but the speaking surface is usually a different
 * one — the chat dock inside OBS runs CEF, not Chrome — and the two do not
 * always spell the identifier the same way for the same underlying voice.
 * `name` is what the operating system reports, so it travels better.
 *
 * If it is still missing, the list may not have finished arriving: some engines
 * fire `voiceschanged` more than once, adding voices each time. Rather than
 * silently falling back to the default and speaking the wrong language, wait
 * for one more round and look again.
 */
const resolveVoice = async (wanted: string): Promise<SpeechSynthesisVoice | undefined> => {
  const match = (list: SpeechSynthesisVoice[]) =>
    list.find((v) => v.voiceURI === wanted) || list.find((v) => v.name === wanted);

  let found = match(await getVoicesWhenReady());
  if (found) return found;

  found = await new Promise<SpeechSynthesisVoice | undefined>((resolve) => {
    const finish = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      clearTimeout(timer);
      resolve(match(window.speechSynthesis.getVoices()));
    };
    const onChange = () => { if (match(window.speechSynthesis.getVoices())) finish(); };
    const timer = setTimeout(finish, 1500);
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
  });

  if (!found) {
    // Leave a breadcrumb naming what was asked for and what this surface
    // actually has — the difference is the whole answer when speech comes out
    // in the wrong language.
    console.warn(
      `[tts] voice "${wanted}" is not available on this surface; speaking with the default. Available:`,
      window.speechSynthesis.getVoices().map((v) => v.name),
    );
  }
  return found;
};

/**
 * Say something aloud in a browser voice: a TTS step, or an alert read out.
 * The voice is resolved first, so the first line after the page loads is not
 * spoken in the browser's default.
 */
type Said = { text: string; voiceURI?: string; rate?: number; pitch?: number; volume?: number };

/**
 * What this page has queued to say and not finished, and for which alert, if
 * any: so skipping an alert stops its reading and only its reading. The
 * browser can only cancel everything, so the rest is put back in line.
 */
const speaking: { u: SpeechSynthesisUtterance; said: Said; alertId?: string }[] = [];

const speakAloud = async (d: Said, alertId?: string) => {
  if (!window.speechSynthesis || !d?.text) return;
  const voice = d.voiceURI ? await resolveVoice(d.voiceURI) : undefined;
  const u = new SpeechSynthesisUtterance(d.text);
  u.rate = d.rate ?? 1;
  u.pitch = d.pitch ?? 1;
  u.volume = d.volume ?? 1;
  if (voice) {
    u.voice = voice;
    // Set alongside the voice: an unset `lang` defaults to the document's,
    // which is `en` here, and some engines weigh that in selection rather
    // than taking `voice` as final.
    u.lang = voice.lang;
  }
  const entry = { u, said: d, alertId };
  speaking.push(entry);
  const done = () => { const i = speaking.indexOf(entry); if (i >= 0) speaking.splice(i, 1); };
  u.onend = done;
  u.onerror = done;
  // Queued behind whatever is being said, so a !tts and an alert never talk over each other.
  window.speechSynthesis.speak(u);
};

/** Stops reading this alert aloud; whatever else was queued to be said still is. */
const stopReadingAlert = (alertId: string) => {
  if (!window.speechSynthesis || !speaking.some((e) => e.alertId === alertId)) return;
  const rest = speaking.filter((e) => e.alertId !== alertId);
  speaking.length = 0;
  window.speechSynthesis.cancel();
  for (const e of rest) speakAloud(e.said, e.alertId);
};

/** Parse the query string once instead of on every state initialiser. */
const params = new URLSearchParams(window.location.search);
const qp = (key: string) => params.get(key);
const qpNum = (key: string, fallback: number) => {
  const v = qp(key);
  const n = v === null ? NaN : parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
};
const qpBool = (key: string, fallback: boolean) => {
  const v = qp(key);
  return v === null ? fallback : v === 'true';
};
const lsBool = (key: string, fallback: boolean) => {
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === 'true';
};

/** Which surface this browser is: the dock, the dashboard, or a page OBS shows. */
const CHAT_SURFACE = qp('mode') || 'dashboard';

/*
  Chat appearance used to be set per surface, in the URL: an overlay carried
  `&chatTheme=retro&fontSize=44` and each browser source could look different.

  That is gone, and so is the one shared set that replaced it. Each chat on
  stream is a layer on a layout and keeps its own settings there, read by the
  canvas straight off the layer; the dock keeps its own set on the server. The
  settings this hook holds are the dock's.
*/

export const useStreamSystem = () => {
  const backend = useBackend();
  const { snapshot, send, request, on, connected } = backend;

  // ------------------------------------------------------- device settings
  // Deliberately NOT server state: two overlays on two monitors should be
  // able to use different font sizes.

  const [activeThemeId, setActiveThemeId] = useState<ThemeId>(
    () => (localStorage.getItem('app_theme') as ThemeId) || 'simon-default');
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem('app_lang') as Language) || 'en');

  const [fontSize, setFontSize] = useState(16);
  const [usernameFontSize, setUsernameFontSize] = useState(13);
  const [emoteSize, setEmoteSize] = useState(24);
  // Space between chat rows. Zero by default because that is what the dock has
  // always rendered — every bit of apparent separation comes from the padding
  // inside each theme's own row.
  const [messageGap, setMessageGap] = useState(0);
  // A theme this browser saved before it was removed would otherwise be
  // carried up by the one-time migration and stored as a value nothing draws.
  const [chatTheme, setChatTheme] = useState<ChatThemeId>(() => {
    const saved = localStorage.getItem('chat_theme') as ChatThemeId;
    return CHAT_THEMES.some((t) => t.id === saved) ? saved : 'modern';
  });
  const [animations, setAnimations] = useState(true);
  const [showAvatars, setShowAvatars] = useState(() => lsBool('chat_show_avatars', false));
  // Whether stream events (redemptions, follows, subs...) appear inline in the
  // chat dock. Per-device like the rest of the chat chrome.
  const [showEvents, setShowEvents] = useState(() => lsBool('chat_show_events', false));
  // Which platforms' events may appear in the dock. Only platforms explicitly
  // enabled show, so OBS scene changes and Spotify track changes stay out —
  // they would flood the dock and are not chat-worthy.
  const [eventPlatforms, setEventPlatforms] = useState<Record<string, boolean>>(
    () => safeJSONParse('chat_event_platforms', { twitch: true, youtube: true, tiktok: true }),
  );
  /**
   * Per-rank highlight colours, or '' for a rank that is not highlighted.
   *
   * Only these four ranks exist because only these are actually reported:
   * Twitch sends all four in its message tags, YouTube sends owner, moderator
   * and member (as subscriber), TikTok sends moderator and subscriber, and
   * Discord sends none at all. Anything else — Twitch founder
   * or artist badges, TikTok gifter tiers, Discord roles — would need the
   * platform layer to start capturing it first.
   */
  const [highlightRanks, setHighlightRanks] = useState<Record<string, string>>(() => {
    return safeJSONParse('chat_highlight_ranks', { broadcaster: '', moderator: '', vip: '', subscriber: '' });
  });

  const [showPlatformIcons, setShowPlatformIcons] = useState(() => lsBool('chat_show_platform_icons', true));
  const [showRankBadges, setShowRankBadges] = useState(() => lsBool('chat_rank_badges', true));
  const [colorUsername, setColorUsername] = useState(() => lsBool('chat_color_username', true));
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [dockBackgroundColor, setDockBackgroundColor] = useState(
    () => localStorage.getItem('chat_dock_bg') || '#09090b');
  const [senderRole, setSenderRole] = useState<'main' | 'bot'>(
    () => (localStorage.getItem('chat_sender_role') as 'main' | 'bot') || 'main');
  // Where the dock's box sends: Twitch, YouTube or both. Per device, like who it sends as.
  const [sendTo, setSendTo] = useState<'twitch' | 'youtube' | 'both'>(() => {
    const saved = localStorage.getItem('chat_send_to');
    return saved === 'youtube' || saved === 'both' ? saved : 'twitch';
  });

  // These three stay per-device on purpose: which UI theme and language you
  // like, and which account you type as, are properties of where you are
  // sitting rather than of the stream.
  useEffect(() => { localStorage.setItem('app_theme', activeThemeId); }, [activeThemeId]);
  useEffect(() => { localStorage.setItem('app_lang', language); }, [language]);
  useEffect(() => { localStorage.setItem('chat_sender_role', senderRole); }, [senderRole]);
  useEffect(() => { localStorage.setItem('chat_send_to', sendTo); }, [sendTo]);

  /*
    The dock's chat settings, as the server holds them, so the dock on a
    laptop and the one in OBS agree and the sizes persist. Mirrored into the
    state above, which the dock draws from; every change goes up whole and
    comes back in the next snapshot. The chat on stream keeps its own settings
    on its layer, and the canvas reads them there.
  */
  const serverChat = (snapshot as any).chatDockSettings as Record<string, any> | undefined;

  const chatLocal: Record<string, any> = {
    chatTheme, fontSize, usernameFontSize, emoteSize, messageGap, animations,
    showAvatars, showEvents, showPlatformIcons, showRankBadges, colorUsername,
    transparentBackground, dockBackgroundColor, eventPlatforms, highlightRanks,
  };
  const chatSetters: Record<string, (v: any) => void> = {
    chatTheme: setChatTheme as any,
    fontSize: setFontSize,
    usernameFontSize: setUsernameFontSize,
    emoteSize: setEmoteSize,
    messageGap: setMessageGap,
    animations: setAnimations,
    showAvatars: setShowAvatars,
    showEvents: setShowEvents,
    showPlatformIcons: setShowPlatformIcons,
    showRankBadges: setShowRankBadges,
    colorUsername: setColorUsername,
    transparentBackground: setTransparentBackground,
    dockBackgroundColor: setDockBackgroundColor,
    eventPlatforms: setEventPlatforms as any,
    highlightRanks: setHighlightRanks as any,
  };

  // Take the server's values.
  useEffect(() => {
    if (!serverChat) return;
    for (const key of Object.keys(chatSetters)) {
      const next = serverChat[key];
      if (next === undefined) continue;
      if (JSON.stringify(next) !== JSON.stringify(chatLocal[key])) chatSetters[key](next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverChat]);

  /*
    Where these settings are in force: the dock, and the dashboard's screen
    for it. On a page OBS shows nothing reads them.
  */
  const editingDock = CHAT_SURFACE === 'dock' || CHAT_SURFACE === 'dashboard';
  const surfaceOverrides: Record<string, any> = {};
  /*
    The dock's look is not a choice: it is Marathon's chat, always.

    It used to draw whatever theme and stylesheet the stream's chat had, so
    the desk changed look every time the stream did. Now the theme is pinned
    to the one a stylesheet can dress and the stylesheet is the dock's own
    Marathon — never the stream's, and never one typed for the dock. Its
    options and sliders still apply on top; see DOCK_CHAT_CSS for how they win.
  */
  if (editingDock) Object.assign(surfaceOverrides, { chatTheme: 'custom', css: DOCK_CHAT_CSS, motionCss: '' });

  /** The server's last word, for a change to build its message on. */
  const chatLatest = useRef<Record<string, any> | null>(null);
  useEffect(() => { if (serverChat) chatLatest.current = serverChat; }, [serverChat]);

  /*
    Push a change up from the setter that caused it, not from an effect.

    An effect watching the values cannot tell an edit from an adoption, and the
    two race: both fire on the render where a new snapshot lands, the adopt
    schedules its setState, and the push — still holding the previous render's
    values — sends those stale ones straight back and undoes it. Pushing where
    the user actually acts has no such ambiguity, and the adopt only ever sets
    state, so nothing can loop. The whole set goes, with the change folded in.
  */
  const pushChat = useCallback((patch: Record<string, any>) => {
    send(C2S.SET_CHAT_DOCK_SETTINGS, { ...(chatLatest.current || {}), ...patch, migrated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  /** Wrap one setter so it updates the screen and tells the server. */
  const chatSetter = (key: string, setLocal: (v: any) => void, read: () => any) => (v: any) => {
    const next = typeof v === 'function' ? v(read()) : v;
    setLocal(next);
    pushChat({ [key]: next });
  };

  /*
    The style tokens, held as one object rather than a state variable each:
    they arrived after the others and were never kept in a browser, so they
    simply follow the server.
  */
  const [chatStyle, setChatStyleLocal] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!serverChat) return;
    const next: Record<string, any> = {};
    for (const key of CHAT_STYLE_KEYS) {
      if (serverChat[key] !== undefined) next[key] = serverChat[key];
    }
    // Replacing the object on every snapshot would re-render every surface
    // that draws a message, for snapshots that touched nothing here.
    setChatStyleLocal((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverChat]);

  /** Change one or more tokens: on screen at once, and up to the server. */
  const setChatStyle = useCallback((patch: Record<string, any>) => {
    setChatStyleLocal((prev) => ({ ...prev, ...patch }));
    pushChat(patch);
  }, [pushChat]);

  /**
   * Change any of the dock's settings at once — the controls send a patch of
   * whatever they hold — on screen straight away, and up in one message.
   */
  const patchChat = useCallback((patch: Record<string, any>) => {
    for (const [key, value] of Object.entries(patch)) chatSetters[key]?.(value);
    const style = Object.fromEntries(Object.entries(patch).filter(([key]) => CHAT_STYLE_KEYS.includes(key)));
    if (Object.keys(style).length) setChatStyleLocal((prev) => ({ ...prev, ...style }));
    pushChat(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushChat]);


  // ----------------------------------------------------- live render state

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Avatars resolved so far, by platform user id. Twitch sends none over IRC,
  // so the server looks them up and broadcasts; keeping the map here lets both
  // already-rendered and newly-arriving messages be filled in, which is what
  // makes this converge instead of depending on message ordering.
  const avatarMapRef = useRef<Record<string, string>>({});

  // The chat/event socket handlers are registered once, so they would capture
  // the first render's settings. Mirror them into refs.
  const showEventsRef = useRef(showEvents);
  const eventPlatformsRef = useRef(eventPlatforms);
  useEffect(() => { showEventsRef.current = showEvents; }, [showEvents]);
  useEffect(() => { eventPlatformsRef.current = eventPlatforms; }, [eventPlatforms]);
  const [alertQueue, setAlertQueue] = useState<ActiveAlert[]>([]);
  const [currentAlert, setCurrentAlert] = useState<ActiveAlert | null>(null);

  // Client-side view of things the server owns but the UI edits optimistically.
  const [discordRoles, setDiscordRoles] = useState<any[]>(() => safeJSONParse('discord_roles', []));
  const [discordEmojis, setDiscordEmojis] = useState<any[]>(() => safeJSONParse('discord_emojis', []));
  const [discordChannels, setDiscordChannels] = useState<any[]>([]);
  const [discordGuilds, setDiscordGuilds] = useState<any[]>(() => safeJSONParse('discord_guilds', []));
  const [discordUser, setDiscordUser] = useState<any>(() => safeJSONParse('discord_user', null));
  const [discordBotMember, setDiscordBotMember] = useState<any>(() => safeJSONParse('discord_bot_member', null));
  const [discordSearchResults, setDiscordSearchResults] = useState<any[]>([]);
  const [availableRewards, setAvailableRewards] = useState<any[]>([]);
  const [syncingMessageId, setSyncingMessageId] = useState<string | null>(null);
  // Which menu last failed to publish, and why. Without this a failed sync was
  // indistinguishable from a successful one: the spinner simply stopped.
  const [reactionSyncError, setReactionSyncError] = useState<{ id: string; message: string } | null>(null);

  // Credentials the UI displays. Tokens themselves live only on the server.
  // The OBS password field is a controlled input, but the server never sends
  // secrets back to clients — so binding it to server state pinned it to "" and
  // made it impossible to type in. This holds the draft locally instead.
  // Deliberately in memory only: it is persisted server-side, so a reload
  // showing an empty password box is correct rather than a loss.
  const [obsPasswordDraft, setObsPasswordDraft] = useState('');

  const [spotifyClientId, setSpotifyClientIdState] = useState(() => localStorage.getItem('spotify_client_id') || '');
  // Deliberately NOT persisted to localStorage like the client id is: the
  // secret lives on the server, which is the only place that needs it. The
  // server never sends it back either — it reports `hasSecret` instead — so
  // this draft stays empty on a fresh device even when one is configured.
  const [spotifyClientSecretDraft, setSpotifyClientSecretDraft] = useState('');
  // The server never sends these back, so the input is always blank on load.
  // Held locally only for the life of the keystroke.
  const [discordBotTokenDraft, setDiscordBotTokenDraft] = useState('');
  const [discordClientSecretDraft, setDiscordClientSecretDraft] = useState('');
  const [tiktokSignKeyDraft, setTiktokSignKeyDraft] = useState('');
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
  const [twitchClientId, setTwitchClientIdState] = useState(() => localStorage.getItem('twitch_client_id') || '');

  // Adopt the server's Twitch Client ID into this origin's storage. Opening the
  // UI on a different port (Vite's :5173 vs the server's :8081) starts with an
  // empty localStorage, and without this the id stayed server-only on that
  // origin — visible in the field but missing everywhere that read it locally.
  // Tracked in a ref so the OAuth callback (which runs from a mount-time effect
  // and would otherwise capture an empty first-render snapshot) can compare the
  // returning account against the one already connected.
  const mainLoginRef = useRef<string>('');
  useEffect(() => {
    mainLoginRef.current = (snapshot.connections as any)?.twitch?.login || '';
  }, [snapshot.connections]);

  const serverTwitchClientId = (snapshot.connections as any)?.twitch?.clientId;
  useEffect(() => {
    if (!serverTwitchClientId) return;
    setTwitchClientIdState((prev) => {
      if (prev === serverTwitchClientId) return prev;
      localStorage.setItem('twitch_client_id', serverTwitchClientId);
      return serverTwitchClientId;
    });
  }, [serverTwitchClientId]);

  /** Empty this surface's chat. Local only — nothing is asked of the server. */
  const clearChat = useCallback(() => setChatMessages([]), []);

  // ------------------------------------------------------- server pushes

  useEffect(() => {
    // Start the voice list loading now rather than when the first message
    // arrives, so even that one does not have to wait for it.
    void getVoicesWhenReady();

    const offs = [
      // The server keeps a short tail of chat so a surface that has just
      // opened is not blank. Seed from it only while this surface has nothing
      // of its own: a snapshot also arrives on every reconnect, and a dock
      // that stayed open through a server restart must keep what it is
      // already showing rather than have it replaced by an older copy.
      on(S2C.SNAPSHOT, (snap: any) => {
        const recent: ChatMessage[] = Array.isArray(snap?.recentChat) ? snap.recentChat : [];
        // What the Discord lines mention, by name, for whatever shows their words.
        for (const m of recent) rememberDiscordNames((m as any).names);
        if (recent.length === 0) return;

        setChatMessages((prev) => (prev.length > 0 ? prev : recent.map((m) => ({
          // A reward message is normally hidden in favour of its event row,
          // but no event row is restored alongside it — so without this the
          // line would be filtered out and simply go missing.
          ...m,
          rewardId: null,
          restored: true,
        }))));
      }),

      on(S2C.CHAT, (msg: ChatMessage) => {
        rememberDiscordNames((msg as any).names);
        // A resolved avatar may already be known from an earlier broadcast —
        // apply it on arrival. Without this, a message that lands *after* its
        // user's avatar was resolved stayed blank forever, because the
        // retroactive patch had already run and the server would not look the
        // same user up twice.
        const id = (msg as any).userId;
        const known = id ? avatarMapRef.current[id] : undefined;
        const withAvatar = !msg.avatar && known ? { ...msg, avatar: known } : msg;

        // Newest first. App.tsx renders this list inside a `flex-col-reverse`
        // container, so index 0 is painted at the BOTTOM — appending instead
        // put the newest message at the top and ran the dock backwards.
        setChatMessages((prev) => [withAvatar, ...prev].slice(0, CHAT_BUFFER));
      }),

      // Stream events shown inline in the dock, when enabled for that platform.
      on(S2C.EVENT, (ev: any) => {
        if (!showEventsRef.current) return;
        if (!chatEventsOn(eventPlatformsRef.current, ev?.platform)) return;
        // One sub of a gifted bundle: the bundle's own line already says it,
        // and fifty of these would bury the chat.
        if (ev?.type === 'twitch_sub' && ev?.data?.fromBulk) return;

        // When it happened, so it expires on stream and keeps the chosen
        // timestamp format like any message.
        const at = Number(ev.timestamp) || Date.now();
        const line: ChatMessage = {
          id: ev.id,
          platform: ev.platform,
          user: ev.user,
          msg: '',
          color: (PLATFORMS as any)[ev.platform]?.colour || '#a1a1aa',
          time: new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          at,
          avatar: ev.avatar,
          isEvent: true,
          eventType: ev.type,
          eventData: ev.data,
        };
        setChatMessages((prev) => [line, ...prev].slice(0, CHAT_BUFFER));
      }),

      on(S2C.ALERT, (alert: ActiveAlert) => {
        setAlertQueue((prev) => [...prev, alert]);
      }),

      // A moderator removed a message (or banned a user) on the platform.
      // Mirror that here rather than leaving deleted content on screen.
      on(S2C.CHAT_DELETE, (payload: any) => {
        const msgIds: string[] = payload?.msgIds ?? [];
        const userIds: string[] = payload?.userIds ?? [];
        if (msgIds.length === 0 && userIds.length === 0) return;

        const byMsg = new Set(msgIds.map(String));
        const byUser = new Set(userIds.map(String));

        setChatMessages((prev) => {
          const next = prev.filter((m) => {
            if (payload.platform && m.platform !== payload.platform) return true;
            if (byMsg.has(String(m.id))) return false;
            const uid = (m as any).userId;
            return !(uid && byUser.has(String(uid)));
          });
          return next.length === prev.length ? prev : next;
        });
      }),

      // Twitch sends no avatar over IRC, so the server resolves them from
      // Helix a moment later and pushes them here. Backfill messages already
      // on screen rather than leaving that user's first message blank.
      on(S2C.AVATARS, (payload: any) => {
        const map = payload?.avatars;
        if (!map || Object.keys(map).length === 0) return;

        // Remember them, so messages arriving later can be filled in too.
        avatarMapRef.current = { ...avatarMapRef.current, ...map };

        setChatMessages((prev) => {
          let changed = false;
          const next = prev.map((m) => {
            // `userId` rides along on the wire but is not part of V2's
            // ChatMessage interface, which is kept byte-identical.
            const id = (m as any).userId;
            if (m.avatar || !id) return m;
            const url = map[id];
            if (!url) return m;
            changed = true;
            return { ...m, avatar: url };
          });
          return changed ? next : prev;
        });
      }),

      // Speech synthesis and audio playback are browser-only capabilities, so
      // the server delegates them to whichever surfaces are connected.
      on(S2C.PLAY_TTS, (d: any) => { speakAloud(d); }),

      on(S2C.PLAY_AUDIO, (d: any) => {
        const audio = new Audio(`data:audio/mp3;base64,${d.audioBase64}`);
        if (d.rate) audio.playbackRate = d.rate;
        audio.play().catch((err) => console.error('audio playback failed:', err));
      }),
    ];

    return () => offs.forEach((off) => off());
  }, [on]);

  // Take the next alert off the queue when nothing is on screen.
  useEffect(() => {
    if (currentAlert || alertQueue.length === 0) return;
    const [next, ...rest] = alertQueue;
    setAlertQueue(rest);
    setCurrentAlert(next);
  }, [alertQueue, currentAlert]);

  /**
   * Retire the alert on screen once its time is up.
   *
   * Separate from the drain above, and depending on `currentAlert` alone, for a
   * reason that only shows up with more than one alert: these were one effect
   * keyed on `[alertQueue, currentAlert]`, so the moment a second alert landed
   * in the queue the effect re-ran, React fired the previous run's cleanup and
   * cancelled the pending timer — then hit the `if (currentAlert) return` guard
   * before setting a new one. The first alert stayed on screen forever and
   * nothing behind it ever played. A single alert never revealed it.
   */
  useEffect(() => {
    if (!currentAlert) return;
    const timer = setTimeout(() => setCurrentAlert(null), currentAlert.config.duration || 5000);
    return () => clearTimeout(timer);
  }, [currentAlert]);

  /*
    Read the alert on screen aloud, if it is to be read and this is the page
    the server chose to speak (only that one is sent `speak`) — a moment
    after it appears, so it does not talk over its own sound.
  */
  useEffect(() => {
    const speak = currentAlert?.speak;
    if (!speak?.text) return;
    const timer = setTimeout(() => { speakAloud(speak, currentAlert!.id); }, speak.delayMs ?? 0);
    return () => clearTimeout(timer);
  }, [currentAlert]);

  /*
    Skip and clear, from the Alerts screen or the deck (engine/alert-gate.js):
    the alert on screen ends now, its reading with it, and the next in line
    starts; or everything waiting in this page's line goes.
  */
  const currentAlertRef = useRef<ActiveAlert | null>(null);
  currentAlertRef.current = currentAlert;
  useEffect(() => {
    const off = on(S2C.ALERT_CONTROL, (p: any) => {
      if (p?.op === 'skip') {
        const now = currentAlertRef.current;
        if (now) stopReadingAlert(now.id);
        setCurrentAlert(null);
      }
      if (p?.op === 'clear') setAlertQueue([]);
    });
    return () => { off(); };
  }, [on]);

  // ------------------------------------------------------- OAuth callbacks

  useEffect(() => {
    // Twitch implicit flow returns the token in the URL fragment. Hand it to
    // the server and scrub it from the address bar immediately.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('access_token');
    if (!token) return;

    (async () => {
      try {
        const isBot = localStorage.getItem('twitch_pending_role') === 'bot';

        // Validate first: this is what tells us the login and user id that
        // the token actually belongs to, rather than trusting anything typed.
        const res = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: { Authorization: `OAuth ${token}` },
        });
        if (!res.ok) {
          throw new Error(`Twitch rejected the token (HTTP ${res.status}). `
            + 'This usually means the login was cancelled or the token expired.');
        }
        const validated = await res.json();

        // Twitch authorises whichever account the browser is signed into. If
        // that turns out to be the account already connected as main, the user
        // almost certainly meant to switch accounts and did not notice.
        if (isBot && mainLoginRef.current
          && String(validated.login).toLowerCase() === mainLoginRef.current.toLowerCase()) {
          const proceed = window.confirm(
            `You just authorised "${validated.login}", which is already connected as your main account.\n\n`
            + 'To use a different account for the bot, sign out of Twitch first, or open this page in a '
            + 'private/incognito window and connect the bot from there.\n\n'
            + 'Connect it as the bot anyway?',
          );
          if (!proceed) {
            localStorage.removeItem('twitch_pending_role');
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
            return;
          }
        }

        send(C2S.SET_CREDENTIALS, isBot
          ? { platform: 'twitch', botToken: token, botLogin: validated.login }
          : {
            platform: 'twitch',
            accessToken: token,
            login: validated.login,
            userId: validated.user_id,
            channel: validated.login,
            clientId: validated.client_id,
          });

        localStorage.removeItem('twitch_pending_role');
        // Connect immediately so the user does not have to click again.
        send(C2S.PLATFORM_CONNECT, { platform: 'twitch' });

        // Only scrub the token from the address bar once it has actually been
        // handed over. Clearing it unconditionally previously destroyed the
        // credential whenever the handoff failed, leaving nothing but a
        // mysterious page reload.
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
        console.info(`Twitch: connected as ${validated.login}`);
      } catch (err: any) {
        console.error('Twitch token handoff failed:', err);
        alert(`Could not finish Twitch login.\n\n${err.message}\n\n`
          + 'The token is still in the address bar — reload the page to retry, '
          + 'or check the server terminal for details.');
      }
    })();
  }, [send]);

  // Discord and Spotify return an authorisation code on the query string
  // (Twitch uses the hash). The exchange needs a live socket to carry the
  // reply, so this waits for the connection rather than firing on mount.
  const codeHandled = useRef(false);
  useEffect(() => {
    if (!backend.connected || codeHandled.current) return;

    const search = new URLSearchParams(window.location.search);
    const code = search.get('code');
    const provider = search.get('state');
    if (!code || !provider) return;

    codeHandled.current = true;
    const redirectUri = window.location.origin + window.location.pathname;

    const scrub = () => {
      search.delete('code');
      search.delete('state');
      const qs = search.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    };

    (async () => {
      try {
        if (provider === 'discord') {
          const result: any = await request(C2S.DISCORD, { op: 'exchange_code', code, redirectUri });

          if (result?.user) {
            setDiscordUser(result.user);
            localStorage.setItem('discord_user', JSON.stringify(result.user));
          }
          if (result?.guilds) {
            setDiscordGuilds(result.guilds);
            localStorage.setItem('discord_guilds', JSON.stringify(result.guilds));
          }

          console.info(`Discord: signed in as ${result?.user?.username ?? 'unknown'}`);
          scrub();
        } else if (provider === 'spotify') {
          await request(C2S.SPOTIFY_EXCHANGE_CODE, { code, redirectUri });
          console.info('Spotify: authorised');
          scrub();
        } else if (provider === 'youtube') {
          await request(C2S.YOUTUBE_EXCHANGE_CODE, { code, redirectUri });
          console.info('YouTube: authorised');
          scrub();
        }
      } catch (err: any) {
        console.error(`${provider} code exchange failed:`, err);
        alert(`Could not finish the ${provider} login.\n\n${err.message}\n\n`
          + 'Check that the redirect URL is registered on the developer portal, '
          + 'and that the client secret is set in .env on the server.');
      }
    })();
  }, [backend.connected, request]);

  // --------------------------------------------------------------- actions

  const req = useCallback(
    (type: string, payload?: any) => request(type, payload).catch((err) => {
      console.error(`${type} failed:`, err.message);
      return null;
    }),
    [request],
  );

  const actions = useMemo(() => ({
    // -- config
    //
    // These are handed to views as if they were React state setters, so they
    // may be called with an updater function rather than a plain value —
    // TagsView does `setTagOutputs(prev => ({ ...prev, [key]: value }))`.
    // Sending that function straight to the server serialised to nothing,
    // which is why selecting an OBS text source never stuck.
    setTagOutputs: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
      const next = typeof v === 'function' ? v(snapshot.tagOutputs ?? {}) : v;
      send(C2S.SET_TAG_OUTPUTS, next);
    },
    // Push the current tag values out now. Resolves with a summary
    // ({ files, configured, sources, failed }) so the button can report what
    // actually landed rather than just claiming success.
    syncTagOutputs: () => request(C2S.SYNC_TAG_OUTPUTS, {}),
    // Everything the server holds, for moving this install to another machine.
    // Secrets are left out by the server, which reports what it dropped.
    exportConfig: () => request(C2S.CONFIG_EXPORT, {}),
    importConfig: (bundle: any) => request(C2S.CONFIG_IMPORT, { bundle }),
    saveCommand: (c: Command) => send(C2S.SAVE_COMMAND, c),
    deleteCommand: (id: string) => send(C2S.DELETE_COMMAND, { id }),
    saveAction: (a: StreamAction) => send(C2S.SAVE_ACTION, a),
    deleteAction: (id: string) => send(C2S.DELETE_ACTION, { id }),
    saveAlertConfig: (a: AlertConfig) => send(C2S.SAVE_ALERT, a),
    deleteAlert: (id: string) => send(C2S.DELETE_ALERT, { id }),
    clearEventHistory: () => send(C2S.CLEAR_EVENTS, {}),

    createAlert: (type: AlertType) => {
      const alert: AlertConfig = {
        id: Math.random().toString(36).slice(2, 11),
        name: `New ${type} Alert`,
        type,
        enabled: true,
        layout: 'image-above',
        messageTemplate: '{user}',
        highlightText: true,
        fontFamily: 'Inter',
        fontSize: 32,
        textColor: '#ffffff',
        accentColor: '#a855f7',
        duration: 5000,
        animationIn: 'fadeIn',
        animationOut: 'fadeOut',
      };
      send(C2S.SAVE_ALERT, alert);
      return alert;
    },

    // -- runtime
    // ActionsView calls this with the whole StreamAction, not an id — passing
    // it straight through sent `{id: {…}}` and the server matched nothing, so
    // the Test button silently did nothing. Accept either shape.
    testAction: (a: any) => send(C2S.TEST_ACTION, { id: typeof a === 'string' ? a : a?.id }),
    // Requested rather than sent, so a button can show whether it worked.
    // Rejects with the server's message when the action is missing or disabled.
    runDockAction: (ref: string | { id?: string; builtin?: string }) => request(
      C2S.RUN_DOCK_ACTION, typeof ref === 'string' ? { id: ref } : ref,
    ),
    setDockButtons: (buttons: any[]) => send(C2S.SET_DOCK_BUTTONS, buttons),
    setDockGrid: (next: { columns?: number; rows?: number; pages?: number; pageNames?: string[]; pagerAt?: 'top' | 'bottom' }) => send(C2S.SET_DOCK_GRID, next),
    setOmnibar: (config: any) => send(C2S.SET_OMNIBAR, config),
    setOmnibars: (bars: any[]) => send(C2S.SET_OMNIBARS, bars),
    setViewers: (config: any) => send(C2S.SET_VIEWERS, config),
    setPlan: (next: any) => send(C2S.SET_PLAN, next),
    setRun: (next: any) => send(C2S.SET_RUN, next),
    setQuestionStatus: (id: string, status: string) => send(C2S.QUESTION_SET_STATUS, { id, status }),
    setPlayers: (next: { items: any[] }) => send(C2S.SET_PLAYERS, next),
    /** Set up, open, close or clear the poll. The server counts the votes. */
    poll: (op: string, value?: any) => send(C2S.POLL, { op, value }),
    // Answers, so the Giveaways screen can say why not (no prize, nobody to draw).
    giveaway: (op: string, value?: any) => request(C2S.GIVEAWAY, { op, value }),
    /** The Discord pages screen: save, remove, post, test, unpost, import, delete_source (server/engine/discord-pages.js). */
    discordPages: (op: string, payload: Record<string, any> = {}) => request(C2S.DISCORD_PAGES, { ...payload, op }),
    /** Viewer history: 'stats', 'settings' ({ settings: { forgetAfterMonths } }) or 'prune' (server/engine/viewer-history.js). */
    history: (op: string, payload: Record<string, any> = {}) => request(C2S.HISTORY, { ...payload, op }),
    /** The Points screen: 'settings', 'post_shop', 'give' ({ uid, amount }), 'board' (server/engine/points.js). */
    points: (op: string, payload: Record<string, any> = {}) => request(C2S.POINTS, { ...payload, op }),
    /** The profile card: 'settings' or 'preview' (server/engine/profile-card.js). */
    profileCard: (op: string, payload: Record<string, any> = {}) => request(C2S.PROFILE_CARD, { ...payload, op }),
    /** Highlights: 'settings' or 'test' (server/engine/highlights.js). */
    highlights: (op: string, payload: Record<string, any> = {}) => request(C2S.HIGHLIGHTS, { ...payload, op }),
    /** Private go-live messages: 'settings', 'post' or 'test' (server/engine/live-dms.js). */
    liveDms: (op: string, payload: Record<string, any> = {}) => request(C2S.LIVE_DMS, { ...payload, op }),
    remotePlayers: (op: string, payload: Record<string, any> = {}) => request(C2S.REMOTE_PLAYERS, { ...payload, op }),
    /** Which Discord channels feed the Questions dock (server/engine/discord-questions.js). */
    setDiscordQuestions: (settings: Record<string, any>) => request(C2S.DISCORD_QUESTIONS, { settings }),
    /** The game requests board (server/engine/game-requests.js). */
    gameRequests: (op: string, payload: Record<string, any> = {}) => request(C2S.GAME_REQUESTS, { ...payload, op }),
    /** Moderation: 'settings', 'act' ({ uid, platform, action }) or 'log' (server/engine/moderation.js). */
    moderation: (op: string, payload: Record<string, any> = {}) => request(C2S.MODERATION, { ...payload, op }),
    /** Past streams: 'list', or 'get' with an id (server/engine/stream-sessions.js). */
    streams: (op: string, payload: Record<string, any> = {}) => request(C2S.STREAMS, { ...payload, op }),
    /** Which Discord call to show, and whether the bot joins it to hear who talks. */
    setVoice: (patch: { channelId?: string; listen?: boolean; pictures?: Record<string, any>; pinned?: { id: string; name: string }[]; follow?: { id: string; name: string } | null; persons?: Record<string, any> }) => send(C2S.SET_VOICE, patch),
    showQuestion: (id: string) => send(C2S.QUESTION_SHOW, { id }),
    clearQuestions: (which?: string) => send(C2S.QUESTIONS_CLEAR, { which }),
    /** Add one by hand, edit one, "Next question", the settings. Awaited, so the screen can say why not. */
    questions: (payload: Record<string, any>) => request(C2S.QUESTIONS, payload),
    /** The Events dock: replay an alert, thank somebody, start the totals over, the thank-you line. Awaited, so it can say why not. */
    events: (payload: Record<string, any>) => request(C2S.EVENTS, payload),
    // One press moves the mark and marks everything above it done.
    planGoto: (id: string) => send(C2S.PLAN_GOTO, { id }),
    /** Save the plan under a name, load a saved one, or forget one. Awaited, so the screen can say why it did not. */
    planSaved: (payload: { op: 'save' | 'load' | 'delete'; name?: string; id?: string }) => request(C2S.PLAN_SAVED, payload),
    /** Regulars, crews and the Discord call, for the Who's on screen. Awaited, so the screen can say why not. */
    people: (payload: Record<string, any>) => request(C2S.PEOPLE, payload),
    setLayouts: (layouts: any[]) => send(C2S.SET_LAYOUTS, layouts),
    // Profiles. Switching and reverting replace whole collections, so the
    // server answers those with a full snapshot rather than a patch.
    profileSwitch: (group: string, id: string) => send(C2S.PROFILE_SWITCH, { group, id }),
    profileSave: (group: string) => send(C2S.PROFILE_CAPTURE, { group }),
    profileRevert: (group: string) => send(C2S.PROFILE_REVERT, { group }),
    profileCreate: (group: string, name: string) => send(C2S.PROFILE_CREATE, { group, name }),
    profileDuplicate: (group: string, name: string) => send(C2S.PROFILE_DUPLICATE, { group, name }),
    profileRename: (group: string, id: string, name: string) => send(C2S.PROFILE_RENAME, { group, id, name }),
    profileDelete: (group: string, id: string) => send(C2S.PROFILE_DELETE, { group, id }),
    setDroidcamSettings: (patch: any) => send(C2S.DROIDCAM_SETTINGS, patch),
    droidcamProbe: () => request(C2S.DROIDCAM_PROBE, {}),
    droidcamControl: (op: string, value?: any) => request(C2S.DROIDCAM_CONTROL, { op, value }),
    /** Start, pause, reset or adjust the countdown. The server holds the clock. */
    countdown: (op: string, value?: any) => send(C2S.COUNTDOWN, { op, value }),
    /** Start, pause, finish, reset or adjust the run timer. The server holds the clock. */
    stopwatch: (op: string, value?: any) => send(C2S.STOPWATCH, { op, value }),
    /** Change a count kept by hand — `op` add, subtract, set or reset. The server holds it. */
    counter: (name: string, op: string, value?: any) => send(C2S.COUNTER, { name, op, value }),
    /** Omnilayer: `set` its settings, `go` live with a layout, or `inspect` what its OBS scene holds. Answers, or refuses. */
    omnilayer: (payload: any) => request(C2S.OMNILAYER, payload),
    /** The Pixel avatars tab: `save`, `create`, `duplicate`, `rename`, `delete`, `reset` or `restore-examples`. Answers, or refuses. */
    pixelAvatars: (payload: any) => request(C2S.PIXEL_AVATARS, payload),
    // The Library's own themes: create, save, rename, delete.
    userThemes: (payload: any) => request(C2S.USER_THEMES, payload),
    // Assets go over HTTP rather than the socket: the body is the file, and
    // pushing binary through the JSON protocol would mean base64 on a channel
    // shared with live chat.
    listAssets: () => fetch(`${httpBase()}/api/assets`).then((r) => r.json()),
    uploadAsset: async (file: File) => {
      // Said at once rather than after sending a file the server would only turn away.
      const kind = assetKindOf(file.name);
      if (kind && file.size > ASSET_KINDS[kind as keyof typeof ASSET_KINDS].max) {
        const mb = ASSET_KINDS[kind as keyof typeof ASSET_KINDS].max / 1024 / 1024;
        const err: any = new Error(`File is larger than ${mb}MB`);
        err.code = 'upload_too_big';
        err.vars = { mb };
        throw err;
      }
      const res = await fetch(`${httpBase()}/api/assets/${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });
      const body = await res.json();
      if (!res.ok) {
        // With the code and what fills it, so the screen can say why in its own language.
        const err: any = new Error(body?.error || `upload failed (${res.status})`);
        if (body?.code) err.code = body.code;
        if (body?.vars) err.vars = body.vars;
        throw err;
      }
      return body;
    },
    // With a variation's id, that variation, at numbers its conditions hold for.
    testAlert: (id: string, variationId?: string) => send(C2S.TEST_ALERT, { id, variationId }),
    /** Skip, pause, resume, toggle or clear alerts, or `hold` (value true/false) the ones nothing shows. Answers, or refuses. */
    alertControl: (op: string, value?: any) => request(C2S.ALERT_CONTROL, { op, value }),
    /*
      Awaited rather than fired off, so the dock hears when a message did not
      go — and why, as the error's code — instead of clearing the box on a
      message that went nowhere.
    */
    sendMessage: (text: string): Promise<any> => {
      if (!text?.trim()) return Promise.resolve();
      // Both: the answer may say one of the two did not go (`failed`).
      return request(C2S.SEND_CHAT, { text, useBot: senderRole === 'bot', to: sendTo });
    },

    // -- twitch
    handleTwitchLogin: (role: 'main' | 'bot' = 'main') => {
      // Resolve in the same order the Connections screen displays it. The
      // server value has to come first: localStorage is per-origin, so a
      // Client ID saved while viewing :8081 is invisible on :5173 and the
      // login button rejected an id that was plainly visible in the field.
      const clientId = (snapshot.connections as any)?.twitch?.clientId
        || twitchClientId
        || localStorage.getItem('twitch_client_id')
        || '';

      if (!clientId) {
        alert('Set your Twitch Client ID in Connections first.');
        return;
      }
      localStorage.setItem('twitch_pending_role', role);
      const scopes = [
        'chat:read', 'chat:edit', 'channel:read:redemptions', 'channel:manage:broadcast',
        'moderator:read:followers', 'channel:read:subscriptions', 'bits:read',
        // The Hype Train on stream, shouting out raiders, and clipping from the dock.
        'channel:read:hype_train', 'moderator:manage:shoutouts', 'clips:edit',
        // Banning and timing out, from the mod log and Role Management.
        'moderator:manage:banned_users',
      ].join(' ');

      const redirectUri = window.location.origin + window.location.pathname;
      // Twitch requires this to match a registered URL character for character,
      // and it differs between the dev port and the server port — worth having
      // in the console when a login bounces.
      console.info(`Twitch login: redirect_uri=${redirectUri} (must be registered on your Twitch app)`);

      const url = new URL('https://id.twitch.tv/oauth2/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'token');
      url.searchParams.set('scope', scopes);

      // Without this Twitch silently reuses whichever account the browser is
      // already signed into and redirects straight back — which made it
      // impossible to attach a separate bot account. force_verify always shows
      // the consent screen, where the signed-in account is visible and can be
      // changed.
      url.searchParams.set('force_verify', 'true');

      window.location.href = url.toString();
    },
    handleTwitchConnect: () => send(C2S.PLATFORM_CONNECT, { platform: 'twitch' }),
    handleTwitchLogout: () => {
      send(C2S.SET_CREDENTIALS, { platform: 'twitch', accessToken: '', login: '', userId: '' });
      send(C2S.PLATFORM_DISCONNECT, { platform: 'twitch' });
    },
    handleTwitchBotConnect: () => send(C2S.PLATFORM_CONNECT, { platform: 'twitch' }),
    handleTwitchBotLogout: () => send(C2S.SET_CREDENTIALS, { platform: 'twitch', botToken: '', botLogin: '' }),
    fetchTwitchRewards: async () => {
      const rewards = await req(C2S.TWITCH_FETCH_REWARDS);
      if (rewards) setAvailableRewards(rewards);
      return rewards;
    },
    // The Tag Manager's "Refresh Data" button. Back-fills latest follower and
    // subscriber from Helix; cheers and raids have no history to fetch.
    fetchTwitchTags: () => request(C2S.TWITCH_FETCH_TAGS, {})
      .catch((err: any) => {
        console.error('tag refresh failed:', err);
        alert(`Could not refresh tags.\n\n${err.message}`);
      }),
    getTwitchUser: (login: string) => req(C2S.TWITCH_GET_USER, { login }),
    searchCategories: (query: string) => req(C2S.TWITCH_SEARCH_CATEGORIES, { query }),
    setTwitchClientId: (v: string) => {
      setTwitchClientIdState(v);
      localStorage.setItem('twitch_client_id', v);
      // The server needs this too — Helix and EventSub both send it as a
      // header. Keeping it only in localStorage left those failing silently
      // while IRC (which does not need it) appeared to work.
      send(C2S.SET_CREDENTIALS, { platform: 'twitch', clientId: v });
    },

    // -- tiktok
    setTiktokUrl: (v: string) => send(C2S.SET_CREDENTIALS, { platform: 'tiktok', username: v }),
    /** Optional Euler Stream key; without one TikTok uses the shared quota. */
    setTiktokSignKey: (v: string) => {
      setTiktokSignKeyDraft(v);
      send(C2S.SET_CREDENTIALS, { platform: 'tiktok', signApiKey: v });
    },
    /** Gemini key, for the AI voice option in TTS actions. */
    setGeminiKey: (v: string) => {
      setGeminiKeyDraft(v);
      send(C2S.SET_CREDENTIALS, { platform: 'ai', geminiApiKey: v });
    },
    /*
      Its own key. This wrote to server_url, which is what the backend resolver
      read to find the app's own server — so setting a TikTok proxy pointed the
      whole app at it, and the next load could not reach anything.
    */
    setTiktokProxyUrl: (v: string) => localStorage.setItem('tiktok_proxy_url', v),
    // Same toggle semantics as OBS: the view turns the button red once the
    // connection is live (or polling) and expects a second press to stop it.
    handleTikTokConnect: () => {
      const s = (snapshot.status as any)?.tiktok?.status;
      const live = s === 'connected' || s === 'connecting' || s === 'polling' || s === 'waiting' || s === 'searching';
      send(live ? C2S.PLATFORM_DISCONNECT : C2S.PLATFORM_CONNECT, { platform: 'tiktok' });
    },

    // -- obs
    setObsHost: (v: string) => send(C2S.SET_CREDENTIALS, { platform: 'obs', host: v }),
    setObsPort: (v: string | number) => send(C2S.SET_CREDENTIALS, { platform: 'obs', port: Number(v) }),

    setObsPassword: (v: string) => {
      setObsPasswordDraft(v);
      send(C2S.SET_CREDENTIALS, { platform: 'obs', password: v });
    },
    // The button is a toggle — the view swaps its label to "Disconnect
    // Server" when connected and calls this same handler. Always sending
    // PLATFORM_CONNECT meant pressing Disconnect silently reconnected.
    handleObsConnect: () => {
      const s = (snapshot.status as any)?.obs?.status;
      const live = s === 'connected' || s === 'connecting';
      send(live ? C2S.PLATFORM_DISCONNECT : C2S.PLATFORM_CONNECT, { platform: 'obs' });
    },

    // -- discord
    setDiscordToken: (v: string) => {
      localStorage.setItem('discord_client_id', v ?? '');
      send(C2S.SET_CREDENTIALS, { platform: 'discord', clientId: v ?? '' });
    },
    setDiscordChannelId: (v: string) => send(C2S.SET_CREDENTIALS, { platform: 'discord', channelId: v }),
    /**
     * The bot token, and the secret its OAuth exchange needs.
     *
     * Both were readable only from .env, which meant Discord could not be set
     * up without shell access to the machine running the server. The server
     * reconnects the gateway as soon as a token lands.
     */
    setDiscordBotToken: (v: string) => {
      setDiscordBotTokenDraft(v);
      send(C2S.SET_CREDENTIALS, { platform: 'discord', botToken: v });
    },
    setDiscordClientSecret: (v: string) => {
      setDiscordClientSecretDraft(v);
      send(C2S.SET_CREDENTIALS, { platform: 'discord', clientSecret: v });
    },
    setDiscordGuildId: (v: string) => send(C2S.SET_CREDENTIALS, { platform: 'discord', guildId: v }),
    /**
     * Start the Discord OAuth flow. The Connections screen passes the Client
     * ID in, because this authorises *you* — it is what populates your account
     * and server list. The bot gateway is a separate concern driven by the bot
     * token; previously this started the gateway instead, so the bot came
     * online but the screen stayed empty.
     */
    connectDiscord: (clientIdArg?: string) => {
      const id = clientIdArg
        || (snapshot.connections as any)?.discord?.clientId
        || localStorage.getItem('discord_client_id')
        || '';

      if (!id) {
        alert('Set your Discord Client ID in Connections first.');
        return;
      }

      localStorage.setItem('discord_client_id', id);
      send(C2S.SET_CREDENTIALS, { platform: 'discord', clientId: id });

      const redirectUri = window.location.origin + window.location.pathname;
      console.info(`Discord login: redirect_uri=${redirectUri} (must be registered under OAuth2 -> Redirects)`);

      const url = new URL('https://discord.com/oauth2/authorize');
      url.searchParams.set('client_id', id);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'identify guilds');
      // Distinguishes this callback from Spotify's, which also returns ?code=.
      url.searchParams.set('state', 'discord');
      window.location.href = url.toString();
    },
    disconnectDiscord: () => send(C2S.PLATFORM_DISCONNECT, { platform: 'discord' }),
    connectDiscordChannel: (channelId: string) => send(C2S.SET_CREDENTIALS, { platform: 'discord', channelId }),
    setDiscordCommandsEverywhere: (on: boolean) => send(C2S.SET_CREDENTIALS, { platform: 'discord', commandsEverywhere: on }),

    fetchDiscordRoles: async (guildId: string) => {
      const roles = await req(C2S.DISCORD, { op: 'get_roles', guildId });
      if (roles) {
        setDiscordRoles(roles);
        localStorage.setItem('discord_roles', JSON.stringify(roles));
      }
      return roles;
    },
    fetchDiscordChannels: async (guildId: string) => {
      const channels = await req(C2S.DISCORD, { op: 'get_channels', guildId });
      if (channels) setDiscordChannels(channels);
      return channels;
    },
    fetchDiscordEmojis: async (guildId: string) => {
      const emojis = await req(C2S.DISCORD, { op: 'get_emojis', guildId });
      if (emojis) {
        setDiscordEmojis(emojis);
        localStorage.setItem('discord_emojis', JSON.stringify(emojis));
      }
      return emojis;
    },
    fetchBotMember: async (guildId: string) => {
      const member = await req(C2S.DISCORD, { op: 'get_member_me', guildId });
      if (member) setDiscordBotMember(member);
      return member;
    },
    // Everybody in the server the voice call is in, people only, by name: to set somebody up before they join.
    listServerMembers: async (): Promise<{ id: string; name: string; username: string; avatar: string }[]> =>
      (await req(C2S.DISCORD, { op: 'server_members' })) || [],
    searchDiscordMember: async (guildId: string, query: string) => {
      const results = await req(C2S.DISCORD, { op: 'search_members', guildId, query });
      setDiscordSearchResults(results || []);
      return results;
    },

    // -- reaction roles / buttons / welcome
    // Same setter-shaped contract as setTagOutputs above — accept either a
    // value or an updater, so a view using the React idiom cannot silently
    // send an unserialisable function.
    setRoleMappings: (v: any) => send(C2S.SET_ROLE_MAPPINGS,
      typeof v === 'function' ? v((snapshot as any).roleMappings ?? {}) : v),
    setWelcomeGoodbyeConfig: (v: any) => send(C2S.SET_WELCOME_GOODBYE,
      typeof v === 'function' ? v((snapshot as any).welcomeGoodbyeConfig ?? {}) : v),

    createReactionRole: (config: ReactionRoleMessage) =>
      send(C2S.SET_REACTION_ROLES, [...snapshot.reactionRoleConfigs ?? [], config]),
    updateReactionRole: (config: ReactionRoleMessage) =>
      send(C2S.SET_REACTION_ROLES, (snapshot.reactionRoleConfigs ?? []).map((c: any) => (c.id === config.id ? config : c))),
    deleteReactionRole: (id: string) =>
      send(C2S.SET_REACTION_ROLES, (snapshot.reactionRoleConfigs ?? []).filter((c: any) => c.id !== id)),
    /**
     * Put the menu on Discord and make sure it carries its reactions.
     *
     * This used to be a bare `send_message`, which posted a *new* message every
     * time, never added the reactions, and never recorded the id — so a menu
     * that already existed got a bare duplicate and the config went on pointing
     * at the original. Now an existing message is edited in place, which is what
     * matters for a menu people have already reacted to: republishing would
     * orphan every role anyone holds.
     *
     * Reactions already present are left alone, so syncing twice is harmless.
     */
    handleSyncReactionRole: async (config: ReactionRoleMessage) => {
      setSyncingMessageId(config.messageId || config.id);
      setReactionSyncError(null);
      try {
        let messageId = config.messageId;

        if (messageId) {
          await request(C2S.DISCORD, {
            op: 'edit_message',
            channelId: config.channelId,
            messageId,
            content: config.content,
            embed: config.embed,
          });
        } else {
          const posted: any = await request(C2S.DISCORD, {
            op: 'send_message',
            channelId: config.channelId,
            content: config.content,
            embed: config.embed,
          });
          messageId = posted?.id;
          // Record it immediately: without the id nothing can match an incoming
          // reaction to this menu, and a second sync would post another copy.
          if (messageId) {
            send(C2S.SET_REACTION_ROLES, (snapshot.reactionRoleConfigs ?? [])
              .map((c: any) => (c.id === config.id ? { ...c, messageId } : c)));
          }
        }

        if (!messageId) throw new Error('Discord did not return a message id');

        // Only add what is missing. Re-adding an existing reaction is a no-op
        // for Discord but still costs a rate-limited request each time.
        const current: any = await request(C2S.DISCORD, {
          op: 'get_message', channelId: config.channelId, messageId,
        }).catch(() => null);

        const already = new Set(
          (current?.reactions ?? [])
            .filter((r: any) => r.me)
            .map((r: any) => (r.emoji?.id ? `id:${r.emoji.id}` : String(r.emoji?.name ?? '').trim())),
        );
        const keyOf = (e: string) => {
          const markup = /^<(a?):([^:]+):(\d+)>$/.exec(String(e).trim());
          return markup ? `id:${markup[3]}` : String(e).trim();
        };

        for (const mapping of config.mappings ?? []) {
          if (!mapping.emoji || already.has(keyOf(mapping.emoji))) continue;
          await request(C2S.DISCORD, {
            op: 'add_reaction', channelId: config.channelId, messageId, emoji: mapping.emoji,
          });
        }
      } catch (err: any) {
        console.error('reaction role sync failed:', err);
        setReactionSyncError({ id: config.id, message: err?.message || String(err) });
      } finally {
        setSyncingMessageId(null);
      }
    },

    createButtonMenu: (config: DiscordButtonMessage) =>
      send(C2S.SET_BUTTON_MENUS, [...(snapshot.discordButtonConfigs ?? []), config]),
    updateButtonMenu: (config: DiscordButtonMessage) =>
      send(C2S.SET_BUTTON_MENUS, (snapshot.discordButtonConfigs ?? []).map((c: any) => (c.id === config.id ? config : c))),
    /** Going live in Discord: change a setting, or post a test now. */
    setAnnounce: (settings: any) => send(C2S.ANNOUNCE, { settings }),
    /** The Twitch schedule as Discord events: its settings, and following it now. */
    setScheduleEvents: (settings: any) => send(C2S.SCHEDULE_EVENTS, { settings }),
    syncScheduleEvents: () => request(C2S.SCHEDULE_EVENTS, { op: 'sync' }),
    /** The PNGtuber microphone: change a setting, keep the meter coming, or pull a face now. */
    setMic: (settings: any) => send(C2S.MIC, { settings }),
    micMeter: () => send(C2S.MIC, { op: 'meter' }),
    avatarFace: (face: string, seconds = 5) => send(C2S.MIC, { op: 'face', face, seconds }),
    avatarDress: (what: 'outfit' | 'hat', name: string, minutes = 5) => send(C2S.MIC, { op: 'dress', what, name, minutes }),
    // Every avatar on screen does something once: drinks a glass of water.
    avatarAction: (name: string) => send(C2S.MIC, { op: 'action', name }),
    avatarUndress: () => send(C2S.MIC, { op: 'undress' }),
    /** Twitch extras: settings, a shoutout, a clip, a marker, the schedule, a test train — and what came of it. */
    twitchExtras: (payload: Record<string, any>) => request(C2S.TWITCH_EXTRAS, payload),
    testAnnounce: () => request(C2S.ANNOUNCE, { op: 'test' }),
    /** The stream recap, from the stream so far, to the test channel. */
    testRecap: () => request(C2S.ANNOUNCE, { op: 'test_recap' }),
    /** The welcome card, drawn by the server exactly as it will be posted. */
    previewWelcomeCard: (card: any, sample: any) => request(C2S.WELCOME_CARD_PREVIEW, { card, sample }),
    // Posts it in the server for real, with the settings on screen; refusals carry a code.
    testWelcome: (kind: string, config: any, testChannelId?: string) => request(C2S.WELCOME_TEST, { kind, config, testChannelId }),
    /** Post a saved button menu to Discord, or update the one already there. */
    publishButtonMenu: (id: string) => request(C2S.DISCORD, { op: 'publish_button_menu', id }),
    // Deleting a menu here takes its message out of Discord too.
    deleteButtonMenu: async (id: string) => {
      await request(C2S.DISCORD, { op: 'unpublish_button_menu', id }).catch(() => {});
      send(C2S.SET_BUTTON_MENUS, (snapshot.discordButtonConfigs ?? []).filter((c: any) => c.id !== id));
    },

    /*
      Discord roles that follow stream status (server/engine/role-sync.js).
      The server links, syncs and keeps the log; this screen only asks.
    */
    linkDiscord: (link: { platform: 'twitch' | 'tiktok' | 'youtube'; platformId: string; platformName?: string; discordId: string; discordName?: string; discordAvatar?: string }) =>
      request(C2S.ROLE_SYNC, { op: 'link', ...link }),
    unlinkDiscord: (key: string) => send(C2S.ROLE_SYNC, { op: 'unlink', key }),
    /** Another account for somebody already linked, named by any account they have; one that was somebody else's brings them along. */
    /** Roles for showing up (role-sync loyalty): [{ kind, atLeast, roleId }]. */
    setLoyaltyRoles: (rules: any[]) => request(C2S.ROLE_SYNC, { op: 'loyalty', rules }),
    addAccount: (account: { to: string; platform: 'discord' | 'twitch' | 'tiktok' | 'youtube'; platformId: string; platformName?: string; avatar?: string }) =>
      request(C2S.ROLE_SYNC, { op: 'add_account', ...account }),
    forceSyncUser: (key: string) => request(C2S.ROLE_SYNC, { op: 'sync', key }),
    clearSyncLog: () => send(C2S.ROLE_SYNC, { op: 'clear_log' }),
    /** Somebody on YouTube to link: seen in its chat by name, or a channel by @handle / id. */
    findYoutube: (query: string) => request(C2S.ROLE_SYNC, { op: 'find_youtube', query }),
    /** Everybody following on Twitch, newest first, with how many there are and whether all were listed. */
    listTwitchFollowers: (): Promise<{ followers: { id: string; login: string; name: string; followedAt: number; avatar: string }[]; total: number; complete: boolean }> =>
      request(C2S.ROLE_SYNC, { op: 'twitch_followers' }),

    // -- leveling
    updateXpConfig: (config: any) => send(C2S.UPDATE_XP_CONFIG, config),
    resetXp: () => send(C2S.RESET_XP, {}),
    linkIdentity: (primary: any, secondary: any) => send(C2S.LINK_IDENTITIES, { primary, secondary }),
    unlinkUser: (key: string) => send(C2S.UNLINK_USER, { key }),
    manualLinkUser: (twitchUser: string, discordId: string) => send(C2S.LINK_IDENTITIES, {
      primary: { platform: 'twitch', id: twitchUser, username: twitchUser },
      secondary: { platform: 'discord', id: discordId },
    }),

    // -- spotify
    setSpotifyClientId: (v: string) => {
      setSpotifyClientIdState(v);
      localStorage.setItem('spotify_client_id', v);
      // Shared config lives on the server so a second device inherits it.
      send(C2S.SET_CREDENTIALS, { platform: 'spotify', clientId: v });
    },
    setSpotifyClientSecret: (v: string) => {
      setSpotifyClientSecretDraft(v);
      // Server-side only. Spotify's token exchange needs the secret, and it
      // used to be readable solely from SPOTIFY_CLIENT_SECRET in .env, which
      // meant Spotify could not be set up from the UI at all.
      send(C2S.SET_CREDENTIALS, { platform: 'spotify', clientSecret: v });
    },
    addToQueue: (uri: string) => send(C2S.SPOTIFY_QUEUE, { uri }),
  }), [send, req, request, snapshot, senderRole, sendTo, twitchClientId]);

  // ---------------------------------------------------------------- status

  /** A platform's status, whether it arrived as a word or wrapped in an object. */
  const settled = (v: any) => (typeof v === 'string' ? v : v?.status) ?? 'disconnected';

  const status = useMemo(() => {
    const s: any = snapshot.status || {};
    return {
      twitch: s.twitch?.main ?? 'disconnected',
      twitchBot: s.twitch?.bot ?? 'disconnected',
      /*
        Either shape. A snapshot carries the word itself — "connected" — while
        a live status event carries an object with it inside, so reading only
        the object meant every platform read as disconnected from the moment a
        page loaded until the next event happened to arrive. Spotify hid it by
        polling every three seconds; YouTube only speaks when something
        changes, so it stayed wrong until it did.
      */
      tiktok: settled(s.tiktok),
      youtube: settled(s.youtube),
      discord: settled(s.discord),
      obs: settled(s.obs),
      spotify: settled(s.spotify),
      obsError: s.obs?.error ? { name: 'Error', message: s.obs.error } : null,
      tiktokError: s.tiktok?.error ?? null,
      tiktokWatch: s.tiktok?.watch ?? null,
    };
  }, [snapshot.status]);

  const connections = useMemo(() => {
    const c: any = snapshot.connections || {};
    return {
      // The Connections screen renders `profile_image_url` and `display_name`,
      // so pass the full Helix user record the server resolved rather than a
      // bare login — that was why the panel showed "Connected" with no avatar.
      twitchUser: c.twitch?.user ?? null,
      twitchBotUser: c.twitch?.botUser ?? null,
      twitchChannel: c.twitch?.channel ?? '',
      // Every field the views dereference must exist. ConnectionsView reads
      // `obsData.streamStatus.active` and ActionsView maps `obsData.sources`,
      // so a missing key is not a blank panel — it throws during render and
      // takes the whole app down to a black page.
      obsData: {
        scenes: [],
        sources: [],
        currentScene: '',
        obsVersion: '',
        streamStatus: { active: false },
        recordingStatus: { active: false },
        ...((snapshot.status as any)?.obs ?? {}),
      },
      obsHost: c.obs?.host ?? 'localhost',
      obsPort: c.obs?.port ?? 4455,
      obsPassword: obsPasswordDraft,
      tiktokUrl: c.tiktok?.username ?? '',
      // The old key is still read, so a proxy set before this keeps working.
      tiktokProxyUrl: localStorage.getItem('tiktok_proxy_url') || localStorage.getItem('server_url') || '',
      /*
        The names the server has cached, until this browser asks for fresh
        ones. Without the fallback the list was empty on every load and a
        redemption alert showed the reward's id where its name should be,
        even though the server knew the name perfectly well.
      */
      availableRewards: availableRewards.length ? availableRewards : ((snapshot as any).rewards || []),
      discordToken: c.discord?.clientId || localStorage.getItem('discord_client_id') || '',
      discordChannelId: c.discord?.channelId ?? '',
      // Commands in every channel of the server, not only the one the app reads.
      discordCommandsEverywhere: c.discord?.commandsEverywhere !== false,
      discordGuildId: c.discord?.guildId ?? '',
      // Server-cached metadata wins. Held only in localStorage before, these
      // were empty on any device that had not run the Discord OAuth flow
      // itself — so a phone showed Discord connected but with no guild or
      // channel names, and every Discord screen stayed blank.
      discordUser: c.discord?.user ?? discordUser,
      discordGuilds: c.discord?.guilds?.length ? c.discord.guilds : discordGuilds,
      discordChannels: c.discord?.channels?.length ? c.discord.channels : discordChannels,
      discordEmojis: c.discord?.emojis?.length ? c.discord.emojis : discordEmojis,
      botMember: c.discord?.botMember ?? discordBotMember,
      // Prefer the server's values so any device — a second browser, a phone,
      // another machine — inherits what was already configured, falling back to
      // this device's copy only until the snapshot lands.
      spotifyClientId: c.spotify?.clientId || spotifyClientId,
      /* The secret never comes back; the server only says whether it has one. */
      youtubeClientId: c.youtube?.clientId || '',
      youtubeHasSecret: Boolean(c.youtube?.hasSecret),
      youtubeAuthorised: Boolean(c.youtube?.authorised),
      youtubeCanEdit: Boolean(c.youtube?.canEdit),
      youtubeHealth: c.youtube?.health || null,
      // A live chat to post in, right now.
      youtubeLive: Boolean(c.youtube?.live),
      youtubeChannel: c.youtube?.channel || null,
      spotifyClientSecret: spotifyClientSecretDraft,
      // The secret itself never crosses the wire back to the client; the
      // server only reports whether one is stored.
      spotifyHasSecret: Boolean(c.spotify?.hasSecret),
      discordBotToken: discordBotTokenDraft,
      discordClientSecret: discordClientSecretDraft,
      discordHasBotToken: Boolean(c.discord?.hasBotToken),
      discordHasClientSecret: Boolean(c.discord?.hasClientSecret),
      tiktokSignKey: tiktokSignKeyDraft,
      tiktokHasSignKey: Boolean(c.tiktok?.hasSignKey),
      geminiKey: geminiKeyDraft,
      hasGeminiKey: Boolean((c as any).ai?.hasGeminiKey),
      twitchClientId: c.twitch?.clientId || twitchClientId,
    };
  }, [snapshot, availableRewards, discordUser, discordGuilds, discordChannels,
    discordEmojis, discordBotMember, spotifyClientId, spotifyClientSecretDraft,
    twitchClientId, obsPasswordDraft,
    discordBotTokenDraft, discordClientSecretDraft, tiktokSignKeyDraft, geminiKeyDraft]);

  /**
   * A reward that asks the viewer for text produces two lines: the chat
   * message they typed, and the redemption event. Showing both prints the same
   * sentence twice, once plainly and once as "Redeemed: … — …".
   *
   * The event row is the better of the two — it names the reward — so the chat
   * copy is dropped whenever that row is actually on screen. When events are
   * hidden, or Twitch events specifically are filtered out, the chat copy is
   * the only representation left and stays.
   *
   * Filtered here rather than at ingestion so toggling events re-evaluates
   * immediately, instead of only affecting messages that arrive afterwards.
   */
  const visibleChatMessages = useMemo(() => {
    const eventsVisible = showEvents && chatEventsOn(eventPlatforms, 'twitch');
    if (!eventsVisible) return chatMessages;
    return chatMessages.filter((m) => !m.rewardId || m.isEvent);
  }, [chatMessages, showEvents, eventPlatforms]);

  /**
   * A control the viewer pressed that Spotify has not confirmed yet.
   *
   * Pressing pause used to change nothing on screen until the server polled,
   * saw the new state and broadcast it — the command goes to Spotify's
   * servers, which relay it to the playing device, which then has to show up
   * in the next Now Playing read. That is seconds of a button that looks
   * broken, and on an overlay it is seconds of a lying overlay.
   *
   * So the press is shown immediately and reconciled when the truth arrives.
   * Nothing extra is requested from Spotify to do it: this is presentation
   * only, and it self-heals — if the command failed, or the wrong device was
   * active, the override is dropped and the real state comes back.
   *
   * Two separate overrides, not one slot. "Which song" and "playing or not"
   * are independent facts, and a viewer can change the second while the first
   * is still unconfirmed — skip, then pause a moment later. Holding one slot
   * meant the pause replaced the skip, and the pause was then drawn over the
   * server's copy of the track, which is still the OLD song until the next
   * poll lands. That flashed the previous song for a frame.
   */
  const [pendingTrack, setPendingTrack] = useState<{ fromId?: string; show?: any; at: number } | null>(null);
  const [pendingPlay, setPendingPlay] = useState<{ isPlaying: boolean; at: number } | null>(null);

  const liveTrack: any = (snapshot.status as any)?.spotify?.track ?? null;

  // Any different track means the skip landed. `previous` and `next` both
  // satisfy this, which is why the id is compared rather than matched.
  useEffect(() => {
    if (!pendingTrack) return;
    if (Boolean(liveTrack?.id) && liveTrack.id !== pendingTrack.fromId) { setPendingTrack(null); return; }
    // Never hold a guess on screen indefinitely. If Spotify has not agreed by
    // now, whatever it actually reports is the honest thing to show.
    const timer = setTimeout(() => setPendingTrack(null), 6000);
    return () => clearTimeout(timer);
  }, [pendingTrack, liveTrack]);

  useEffect(() => {
    if (!pendingPlay) return;
    if (liveTrack?.isPlaying === pendingPlay.isPlaying) { setPendingPlay(null); return; }
    const timer = setTimeout(() => setPendingPlay(null), 6000);
    return () => clearTimeout(timer);
  }, [pendingPlay, liveTrack]);

  const spotifyState = useMemo(() => {
    const sp: any = (snapshot.status as any)?.spotify ?? {};
    const real = sp.track ?? null;

    // Layered, so pausing mid-skip pauses the NEW song rather than reverting
    // to the server's not-yet-updated copy of the old one.
    let shown = real;

    // A skip is only shown early when the next song is actually known —
    // otherwise the old track stays put rather than blanking the overlay.
    if (pendingTrack?.show) shown = { ...pendingTrack.show, isPlaying: true, progress: 0 };

    if (pendingPlay && shown) shown = { ...shown, isPlaying: pendingPlay.isPlaying };

    return {
      isConnected: sp.status === 'connected',
      isAuthenticating: false,
      track: shown,
      upNext: sp.upNext ?? null,
      error: null,
    };
  }, [snapshot.status, pendingTrack, pendingPlay]);

  // ------------------------------------------------------ identical shape

  /*
    The names Discord's codes stand for, learned for every screen that shows
    Discord's words (discordEmoji.ts): the server's channels and roles, and
    the people mentioned in requests and questions — so a step of the plan
    made from a request still names whoever it mentions.
  */
  // Learned while drawing, before the screens below draw with them: an effect would come a draw too late.
  useMemo(() => {
    const s: any = snapshot;
    rememberDiscordLists({
      channels: s.connections?.discord?.channels?.length ? s.connections.discord.channels : discordChannels,
      roles: s.connections?.discord?.roles?.length ? s.connections.discord.roles : discordRoles,
    });
    for (const r of s.gameRequests?.requests || []) rememberDiscordNames(r.names);
    for (const q of s.questions?.items || []) rememberDiscordNames(q.names);
  }, [snapshot, discordChannels, discordRoles]);

  return {
    data: {
      plan: (snapshot as any).plan,
      // The pages open now, by kind, and how many are inside OBS (server/api/ws.js countSurfaces).
      surfaces: (snapshot as any).surfaces || null,
      // The server's version (shared/version.js), beside this page's own.
      serverVersion: (snapshot as any).serverVersion || '',
      planSaved: (snapshot as any).planSaved || [],
      people: (snapshot as any).people,
      run: (snapshot as any).run,
      questions: (snapshot as any).questions,
      questionSettings: (snapshot as any).questionSettings,
      players: (snapshot as any).players || { items: [] },
      poll: (snapshot as any).poll,
      pollSettings: (snapshot as any).pollSettings,
      pollHistory: (snapshot as any).pollHistory || [],
      // The giveaway (server/engine/giveaway.js) and how it is told and posted.
      giveaway: (snapshot as any).giveaway,
      giveawaySettings: (snapshot as any).giveawaySettings,
      // A channel's standing posts, built from blocks (server/engine/discord-pages.js).
      discordPages: (snapshot as any).discordPages,
      // How long people are kept (server/engine/viewer-history.js).
      historySettings: (snapshot as any).historySettings,
      // Points: what they are called, how they are earned, the shop (server/engine/points.js).
      pointsSettings: (snapshot as any).pointsSettings,
      // "!perfil" (server/engine/profile-card.js).
      profileCard: (snapshot as any).profileCard,
      // The moments chat goes wild (server/engine/highlights.js).
      highlights: (snapshot as any).highlights,
      // Going live, told privately (server/engine/live-dms.js).
      liveDms: (snapshot as any).liveDms,
      // Remote players' seats, their links and how each is doing (server/engine/remote-players.js).
      remotePlayers: (snapshot as any).remotePlayers,
      discordQuestions: (snapshot as any).discordQuestions,
      gameRequests: (snapshot as any).gameRequests,
      moderation: (snapshot as any).moderation,
      moderationLog: (snapshot as any).moderationLog ?? [],
      voice: (snapshot as any).voice,
      announce: (snapshot as any).announce,
      // The Twitch schedule as Discord events: the settings, how many there are, when last checked.
      scheduleEvents: (snapshot as any).scheduleEvents,
      // PNGtuber: the microphone's settings, whether you are talking, its level for the meter, and a face an action asked for.
      micSettings: (snapshot as any).micSettings,
      micTalk: (snapshot as any).micTalk ?? { talking: false, loud: false },
      micLevel: (snapshot as any).micLevel ?? null,
      avatarFace: (snapshot as any).avatarFace ?? null,
      // What viewers dressed the avatars in, for a few minutes.
      avatarDress: (snapshot as any).avatarDress ?? null,
      // Something an action asked every avatar to do, by a key that changes each time.
      avatarAction: (snapshot as any).avatarAction ?? null,
      // The pixel avatars drawn in the Pixel avatars tab, examples and all.
      pixelAvatars: ((snapshot as any).pixelAvatars ?? []) as PixelAvatarDef[],
      // The themes made in the Library, beside the shipped ones.
      userThemes: ((snapshot as any).userThemes ?? []) as any[],
      // Twitch extras: their settings, the Hype Train, the shoutout card, the schedule, the login's permissions.
      twitchExtras: (snapshot as any).twitchExtras ?? null,
      hypeTrain: (snapshot as any).hypeTrain ?? null,
      shoutoutCard: (snapshot as any).shoutoutCard ?? null,
      twitchSchedule: (snapshot as any).twitchSchedule ?? null,
      twitchScopes: (snapshot as any).twitchScopes ?? null,
      roleSyncSubsCheck: (snapshot as any).roleSyncSubsCheck ?? null,
      commands: snapshot.commands as Command[],
      streamActions: snapshot.streamActions as StreamAction[],
      streamTags: snapshot.streamTags,
      omnibar: (snapshot as any).omnibar as OmnibarConfig | undefined,
      omnibars: ((snapshot as any).omnibars || []) as any[],
      countdown: (snapshot as any).countdown as CountdownState | undefined,
      omnilayer: (snapshot as any).omnilayer,
      stopwatch: (snapshot as any).stopwatch as any,
      // Counts kept by hand: { deaths }.
      counters: ((snapshot as any).counters || { deaths: 0 }) as { deaths: number },
      alertConfigs: snapshot.alertConfigs as AlertConfig[],
      chatMessages: visibleChatMessages,
      clearChat,
      tagOutputs: snapshot.tagOutputs,
      alertQueue,
      currentAlert,
      // The server's side of it: paused, how many wait there, and whether it holds alerts nothing shows.
      alertGate: (snapshot as any).alertGate as { paused: boolean; held: number; holdUnseen: boolean } | undefined,
      eventHistory: snapshot.eventHistory as AppEvent[],
      viewerEvents: ((snapshot as any).viewerEvents || []) as AppEvent[],
      eventTotals: (snapshot as any).eventTotals,
      eventsDockSettings: (snapshot as any).eventsDockSettings,
      viewers: (snapshot as any).viewers,
      layouts: (snapshot as any).layouts ?? [],
      profiles: (snapshot as any).profiles ?? [],
      stats: (snapshot as any).stats,
      linkedUsers: (snapshot as any).linkedUsers ?? {},
      // The same links as people: everybody with more than one account, each account listed (server/engine/role-sync.js).
      linkedPeople: (snapshot as any).linkedPeople ?? [],
      loyaltyRoles: (snapshot as any).loyaltyRoles ?? [],
      pendingLinks: (snapshot as any).pendingLinks ?? {},
      // Roles gate the Reaction Roles and Role Management screens, so they
      // must come from the server for a device that never fetched them.
      discordRoles: (snapshot.connections as any)?.discord?.roles?.length
        ? (snapshot.connections as any).discord.roles
        : discordRoles,
      roleMappings: (snapshot as any).roleMappings ?? {},
      reactionRoleConfigs: (snapshot as any).reactionRoleConfigs ?? [],
      roleActivityLog: (snapshot as any).roleActivityLog ?? [],
      syncingMessageId,
      reactionSyncError,
      discordButtonConfigs: (snapshot as any).discordButtonConfigs ?? [],
      syncLog: (snapshot as any).roleSyncLog ?? [],
      welcomeGoodbyeConfig: (snapshot as any).welcomeGoodbyeConfig ?? {},
      discordSearchResults,
      dockButtons: ((snapshot as any).dockButtons ?? []) as DockButton[],
      dockGrid: ((snapshot as any).dockGrid ?? { columns: 3, rows: 0, pages: 1, pageNames: [''], pagerAt: 'bottom' }) as { columns: number; rows: number; pages?: number; pageNames?: string[]; pagerAt?: 'top' | 'bottom' },
      xpData: (snapshot as any).xpData ?? {},
      leaderboard: snapshot.leaderboard,
      subscribers: (snapshot as any).subscribers,
      xpConfig: snapshot.xpConfig,
    },
    settings: {
      activeThemeId, setActiveThemeId,
      language, setLanguage,
      /*
        The dock's chat settings. Each of these sets local state so the control
        responds at once, and tells the server, which is what reaches the dock
        wherever else it is open. A setter may be handed a value or an updater,
        because several views pass an updater to toggle one key of an object.
      */
      // The style tokens, flat alongside the rest so the renderer reads them
      // the same way. Every key is new, so nothing below is shadowed.
      ...chatStyle,
      setChatStyle,

      fontSize, setFontSize: chatSetter('fontSize', setFontSize, () => fontSize),
      usernameFontSize, setUsernameFontSize: chatSetter('usernameFontSize', setUsernameFontSize, () => usernameFontSize),
      emoteSize, setEmoteSize: chatSetter('emoteSize', setEmoteSize, () => emoteSize),
      messageGap, setMessageGap: chatSetter('messageGap', setMessageGap, () => messageGap),
      chatTheme, setChatTheme: chatSetter('chatTheme', setChatTheme, () => chatTheme),
      animations, setAnimations: chatSetter('animations', setAnimations, () => animations),
      showAvatars, setShowAvatars: chatSetter('showAvatars', setShowAvatars, () => showAvatars),
      showEvents, setShowEvents: chatSetter('showEvents', setShowEvents, () => showEvents),
      eventPlatforms, setEventPlatforms: chatSetter('eventPlatforms', setEventPlatforms, () => eventPlatforms),
      highlightRanks, setHighlightRanks: chatSetter('highlightRanks', setHighlightRanks, () => highlightRanks),
      showPlatformIcons, setShowPlatformIcons: chatSetter('showPlatformIcons', setShowPlatformIcons, () => showPlatformIcons),
      showRankBadges, setShowRankBadges: chatSetter('showRankBadges', setShowRankBadges, () => showRankBadges),
      colorUsername, setColorUsername: chatSetter('colorUsername', setColorUsername, () => colorUsername),
      transparentBackground, setTransparentBackground: chatSetter('transparentBackground', setTransparentBackground, () => transparentBackground),
      dockBackgroundColor, setDockBackgroundColor: chatSetter('dockBackgroundColor', setDockBackgroundColor, () => dockBackgroundColor),
      senderRole, setSenderRole,
      sendTo, setSendTo,
      relayConfig: snapshot.relayConfig as RelayConfig,
      setRelayConfig: (v: any) => send(C2S.SET_RELAY_CONFIG,
        typeof v === 'function' ? v(snapshot.relayConfig ?? {}) : v),

      // The dock's fixed look, last so it wins over the values above.
      ...surfaceOverrides,

      // Any of the dock's chat settings at once, as the shared chat controls send them.
      patchChat,
    },
    status,
    connections,
    actions,
    /*
      YouTube, which is the same dance: the id and secret are kept on the
      server so any device inherits them, and the login is a redirect that
      comes back to exactly the URL the screen shows.
    */
    youtube: {
      setSettings: (patch: { clientId?: string; clientSecret?: string }) => send(C2S.YOUTUBE_SET_SETTINGS, patch),
      logout: () => send(C2S.YOUTUBE_LOGOUT, {}),
      login: () => {
        const clientId = (snapshot.connections as any)?.youtube?.clientId;
        if (!clientId) {
          alert('Set your YouTube Client ID in Connections first.');
          return;
        }
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('redirect_uri', youtubeRedirectUri());
        // Reading chat, and changing the broadcast's title and description.
        url.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.force-ssl');
        /*
          Google hands back a refresh token only for offline access, and only
          the first time somebody consents — so consent is asked for every
          time. Without it a second login would authorise for an hour and
          then quietly stop working.
        */
        url.searchParams.set('access_type', 'offline');
        url.searchParams.set('prompt', 'consent');
        // Tells the shared callback handler which provider is returning.
        url.searchParams.set('state', 'youtube');
        window.location.href = url.toString();
      },
    },
    spotify: {
      state: spotifyState,
      login: () => {
        // Prefer the server's copy, exactly as the Connections input and the
        // Twitch login already do. Reading only the local state meant a client
        // id configured from another device — or simply stored server-side
        // while this browser's localStorage was empty — showed a filled-in box
        // and an enabled button, then refused with "set your Client ID first".
        const clientId = (snapshot.connections as any)?.spotify?.clientId || spotifyClientId;
        if (!clientId) {
          alert('Set your Spotify Client ID in Connections first.');
          return;
        }
        const url = new URL('https://accounts.spotify.com/authorize');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('response_type', 'code');
        // Must match the box shown on the Connections screen exactly.
        url.searchParams.set('redirect_uri', spotifyRedirectUri());
        url.searchParams.set('scope', 'user-read-currently-playing user-read-playback-state user-modify-playback-state');
        // Tells the shared callback handler which provider is returning.
        url.searchParams.set('state', 'spotify');
        window.location.href = url.toString();
      },
      logout: () => send(C2S.PLATFORM_DISCONNECT, { platform: 'spotify' }),
      controls: {
        // Each of these shows the result straight away and lets the effect
        // above put it right if Spotify disagrees. `next` can name the new
        // song because the queue is already known; `previous` cannot, so it
        // holds the current one rather than guessing.
        next: () => {
          setPendingTrack({ fromId: liveTrack?.id, show: (snapshot.status as any)?.spotify?.upNext ?? null, at: Date.now() });
          send(C2S.SPOTIFY_CONTROL, { operation: 'next' });
        },
        previous: () => {
          setPendingTrack({ fromId: liveTrack?.id, show: null, at: Date.now() });
          send(C2S.SPOTIFY_CONTROL, { operation: 'previous' });
        },
        play: () => {
          setPendingPlay({ isPlaying: true, at: Date.now() });
          send(C2S.SPOTIFY_CONTROL, { operation: 'play' });
        },
        pause: () => {
          setPendingPlay({ isPlaying: false, at: Date.now() });
          send(C2S.SPOTIFY_CONTROL, { operation: 'pause' });
        },
        // Was a no-op wired to a visible button: clicking it did nothing at all.
        refresh: () => send(C2S.SPOTIFY_REFRESH, {}),
      },
    },
    /** Not part of the V2 contract; handy for a connection indicator. */
    _backendConnected: backend.connected,
  };
};
