/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Layout, Package, MessageSquare, ListOrdered, MessageCircleQuestion, Menu, X, Terminal, Share2, Zap, Monitor, Bell, Settings as SettingsIcon, Tag, 
  Wifi, WifiOff, LogOut, Send, Bot, User, Check, Eye, EyeOff, Ghost, Link as LinkIcon, Loader2, Copy, ExternalLink,
  HelpCircle, Info, AlertTriangle, List, ChevronDown, Shield, Trash2, Clock, MousePointerClick, DoorOpen, GripHorizontal, Trophy, Newspaper, Coins, History
, Smile, LayoutGrid, Sword, Gem, Star, Video, Radio, Layers, Gamepad2, Palette, Users, BarChart3, Gift, Headphones, Megaphone, Mic, Sparkles, Inbox, Cast, BookOpen
} from 'lucide-react';
import { NavSections, StatusRow, NavSearch, SearchButton, ScreenTabs, PhoneBar, type NavSection, type SearchEntry } from './components/NavMenu';
import { Button } from './components/Button';
import { NotFoundPage } from './components/NotFoundPage';
import { EmojiPicker } from './components/EmojiPicker';
import { Omnibar } from './components/Omnibar';
import { TallOmnibar } from './components/TallOmnibar';
import { Countdown, countdownFor } from './components/Countdown';
import { ViewerCount } from './components/ViewerCount';
import { ViewersView } from './components/views/ViewersView';
import { CountdownView } from './components/views/CountdownView';
import { TimerView } from './components/views/TimerView';
import { Stopwatch } from './components/Stopwatch';
import { OmnibarView } from './components/views/OmnibarView';
import { OmnibarBarPicker } from './components/OmnibarBarPicker';
import { LayoutsView } from './components/views/LayoutsView';
import { AlertsView } from './components/views/AlertsView';
import { ProfileSwitcher } from './components/ProfileSwitcher';
import { AppView, Command, StreamAction, ActionStep, TriggerCategory, TriggerType, ActionStepType, AlertConfig, ActiveAlert, AlertType, ChatMessage } from './types';
import { THEMES, TRANSLATIONS, CHAT_THEMES, CHAT_RANKS } from './constants';
import { liveLayout } from '../shared/live-layout.js';
import { moveInTree } from '../shared/list-order.js';
import { parseMessageWithEmotes, getRgbValues } from './utils';

// Import "The Brain"
import { useStreamSystem } from './hooks/useStreamSystem';

// Import Views
import { DashboardView } from './components/views/DashboardView';
import { SettingsView } from './components/views/SettingsView';
import { StudioView } from './components/views/StudioView';
import { CommandEditorModal } from './components/CommandEditorModal';
import { DockDeck } from './components/DockDeck';
import { DockPlan } from './components/DockPlan';
import { DockQuestions } from './components/DockQuestions';
import { EventFeed } from './components/EventFeed';

/**
 * When the last YouTube message arrived, from the chat already on screen: the
 * server says what the connection is doing, and this says whether anything
 * has actually come through it.
 */
const lastYoutubeMessageAt = (messages: any[]) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.platform === 'youtube') return Number(messages[i].at) || 0;
  }
  return 0;
};
import { DockActionsView } from './components/views/DockActionsView';
import { ActionsView } from './components/views/ActionsView';
import { ConnectionsView } from './components/views/ConnectionsView';
import { TagsView } from './components/views/TagsView';
import { ChatDockView } from './components/views/ChatDockView';
import { SendToPicker } from './components/SendToPicker';
import { refusalWords, fill } from './words';
import { DockTabs, DockTab } from './components/DockTabs';
import { PlanView } from './components/views/PlanView';
import { GameView } from './components/views/GameView';
import { PeopleView } from './components/views/PeopleView';
import { LibraryView } from './components/views/LibraryView';
import { QuestionsView } from './components/views/QuestionsView';
import { PlayersView } from './components/views/PlayersView';
import { RemotePlayersView } from './components/views/RemotePlayersView';
import { GuidesView, type GuidesTab } from './components/views/GuidesView';
import { GUIDES, setupState, guideForScreen } from '../shared/guides.js';
import { PollsView } from './components/views/PollsView';
import { GiveawayView } from './components/views/GiveawayView';
import { DiscordPagesView } from './components/views/DiscordPagesView';
import { PointsView } from './components/views/PointsView';
import { StreamsView } from './components/views/StreamsView';
import { RequestsView } from './components/views/RequestsView';
import { VoiceView } from './components/views/VoiceView';
import { GoLiveView } from './components/views/GoLiveView';
import { PngtuberView } from './components/views/PngtuberView';
import { PixelAvatarsView } from './components/views/PixelAvatarsView';
import { TwitchView } from './components/views/TwitchView';
import { EventsDockView } from './components/views/EventsDockView';
import { RoleManagementViewConnected } from './components/views/RoleManagementView';
import { ReactionRolesView } from './components/views/ReactionRolesView';
import { WelcomeGoodbyeView } from './components/views/WelcomeGoodbyeView';
import { DiscordButtonsView } from './components/views/DiscordButtonsView';
import { ChatMessageRow, ChatStyle, PlatformMark } from './components/ChatMessageRow';
import { AlertOverlay } from './components/AlertOverlay';
import { CanvasStage } from './components/CanvasStage';
import { SpotifyOverlayView } from './components/views/SpotifyOverlayView'; // New
import { LevelsView } from './components/views/LevelsView'; // New Phase 4
import { SpotifyPlayer, SpotifyIcon as SpotifyIconComponent } from './components/SpotifyPlayer'; // Import Player for standalone mode

// --- Custom Components ---
const Logo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width="24" height="24">
    <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
    <path d="M16 9H8a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1l2 2 2-2h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1z" />
    <circle cx="10" cy="12" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="12" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);
const TwitchIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></svg>
);
const TikTokIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
);
const DiscordIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6034.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
  </svg>
);

/**
 * Which profile group each screen belongs to.
 *
 * Commands, actions and dock actions share one entry on purpose: a dock
 * button names an action and an action names the command that triggers it, so
 * they are one profile between them and switching from any of the three moves
 * all three.
 *
 * A screen absent from here has no profiles, which is the answer for Discord —
 * reaction roles and the welcome message describe one server and do not change
 * with what is being streamed.
 */
const PROFILE_GROUP_FOR_VIEW: Record<string, string> = {
  studio: 'automation',
  actions: 'automation',
  'dock-actions': 'automation',
  alerts: 'alerts',
  layouts: 'overlays',
  omnibar: 'overlays',
  viewers: 'overlays',
  // The chat dock screen, called 'assets' for historical reasons, is in none:
  // the dock keeps its own settings, outside every profile.
};

/*
  Every page there is: the dashboard, at / with no mode, and the pages OBS
  shows, each by its ?mode=. Any other mode or path is a page that does not
  exist (NotFoundPage) — never the dashboard in its place.
*/
const PAGE_MODES = ['dashboard', 'alerts', 'dock-actions', 'timer', 'countdown', 'viewers', 'canvas', 'omnibar', 'spotify', 'overlay', 'dock'];
const APP_PATHS = ['/', '/index.html'];

export default function App() {
  // --- Initialize "The Brain" ---
  const system = useStreamSystem();
  
  // --- UI State (Non-Persistent / View-Specific) ---
  const [showIntro, setShowIntro] = useState(true);
  const [view, setView] = useState<AppView>('dashboard');
  /** Which omnibar the Omnibar screen is editing: 'main', or another bar's id. */
  const [omnibarBar, setOmnibarBar] = useState('main');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  // Emoji picker for the standalone dock, mirroring the in-app preview.
  const [pickerState, setPickerState] = useState<{ open: boolean, top: number, left: number } | null>(null);
  const handlePickerOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();

    // Keep the picker on screen. It is 320x400, and anchoring it to the
    // button's left edge pushed it off the right side of a narrow dock, so
    // clamp both axes and fall back to opening downwards if there is no room
    // above.
    const W = 320, H = 400, M = 8;

    let top = rect.top - H - M;
    if (top < M) top = Math.min(rect.bottom + M, window.innerHeight - H - M);
    top = Math.max(M, top);

    let left = rect.left;
    if (left + W > window.innerWidth - M) left = window.innerWidth - W - M;
    left = Math.max(M, left);

    setPickerState({ open: true, top, left });
  };

  // Modals & Forms UI State
  const [isCommandModalOpen, setIsCommandModalOpen] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<Partial<Command>>({});
  const [tempTriggers, setTempTriggers] = useState('');

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<Partial<StreamAction>>({});

  const [activeAlertCategory, setActiveAlertCategory] = useState<string | null>('follows');
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  const [showInsecureModal, setShowInsecureModal] = useState(false);
  const [insecureAcknowledgeMode, setInsecureAcknowledgeMode] = useState<'info' | 'guide' | 'nope'>('info');
  const [hasInsecureBlocked, setHasInsecureBlocked] = useState(false);

  // Derived Constants
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode');
  const unknownPath = !APP_PATHS.includes(window.location.pathname);
  const notFound = unknownPath || (mode !== null && !PAGE_MODES.includes(mode));
  const activeTheme = useMemo(() => THEMES.find(t => t.id === system.settings.activeThemeId) || THEMES[0], [system.settings.activeThemeId]);

  /**
   * Accent colour classes. Declared before the early returns because the
   * dock, overlay and alert modes return above the main render — they were
   * emitting `bg-current-accent` with no rule behind it, so anything using
   * the theme accent came out unstyled in OBS.
   */
  const accentStyles = <style>{` :root { --current-accent: ${activeTheme.primary}; } .text-current-accent { color: var(--current-accent); } .bg-current-accent { background-color: var(--current-accent); } .border-current-accent { border-color: var(--current-accent); } .bg-current-accent\\/10 { background-color: rgba(${getRgbValues(activeTheme.primary)}, 0.1); } `}</style>;
  const t = useMemo(() => TRANSLATIONS[system.settings.language], [system.settings.language]);
  // The pages OBS shows on stream speak the stream's language, whatever this device's is.
  const streamT = TRANSLATIONS.es;
  const viewNames: Record<AppView, string> = { 
    twitch: t.twitchNav || 'Twitch',
    dashboard: t.dashboard, 
    viewers: t.navViewerCount || 'Viewer count',
    layouts: t.layouts,
    alerts: t.alerts,
    assets: t.chatDock,
    plan: t.planNav || 'Stream plan',
    run: t.gameNav || 'Game',
    people: t.navPeopleOnStream || 'People on stream',
    library: t.navLooks || 'Looks',
    questions: t.questionsNav || 'Questions',
    players: t.navGameNight || 'Game night',
    'remote-players': t.remotePlayersNav || 'Remote players',
    polls: t.pollsNav || 'Polls', 
    giveaway: t.giveawayNav || 'Giveaways',
    points: t.pointsNav || 'Points',
    streams: t.streamsNav || 'Streams',
    requests: t.requestsNav || 'Game requests',
    events: t.eventsDock, 
    studio: t.commands, 
    actions: t.actions, 
    gallery: t.connections,
    tags: t.navStreamLabels || 'Stream labels',
    settings: t.settings, 
    voice: t.voiceNav || 'Voice call',
    'go-live': t.goLiveNav || 'Go live',
    pngtuber: t.pngtuberNav || 'PNGtuber',
    'pixel-avatars': t.pixelAvatarsNav || 'Pixel avatars',
    'role-management': t.roleManagement,
    'reaction-roles': t.reactionRoles,
    'discord-buttons': t.discordButtons || 'Discord Buttons',
    'welcome-goodbye': t.welcomeGoodbye || 'Welcome & Goodbye',
    'discord-pages': t.discordPagesNav || 'Discord pages',
    'spotify-overlay': t.spotifyOverlay || 'Spotify Overlay',
    'dock-actions': t.dockActions,
    countdown: t.countdown || 'Countdown',
    timer: t.timer || 'Timer',
    omnibar: t.omnibar || 'Omnibar',
    levels: t.levels || 'Levels & XP',
    guides: t.guidesNav || 'Guides',
  };

  // The browser tab says which screen it is; a page OBS shows keeps the app's name.
  const screenTitle = notFound ? (t.notFoundTab || 'Page not found') : !mode || mode === 'dashboard' ? viewNames[view] : '';
  useEffect(() => {
    document.title = screenTitle ? `${screenTitle} · Simon Says` : 'Simon Says';
  }, [screenTitle]);

  // URL Generation Helpers
  const getBaseUrl = () => { const url = new URL(window.location.href); url.search = ''; return url; };
  const appendConfigToUrl = useCallback((url: URL, targetMode: 'dock' | 'alerts') => { 
      url.searchParams.set('mode', targetMode); 
      if (system.connections.twitchChannel) url.searchParams.set('channel', system.connections.twitchChannel); 
      // Security: Pass generic token params if needed, mostly handled by localStorage in real usage or new tab
      if (system.connections.tiktokUrl) url.searchParams.set('tiktokUser', system.connections.tiktokUrl); 
      if (system.connections.tiktokProxyUrl) url.searchParams.set('tiktokProxy', system.connections.tiktokProxyUrl); 
      
      /*
        Appearance is no longer spelled out here.

        It used to be, because each browser source had its own localStorage and
        anything absent from the URL simply never reached it. Now the dock's
        settings live on the server, and a URL carrying them would be a second,
        stale copy. The chat on stream is a layer with its own settings, which
        change with the overlay profile.
      */
      return url.toString(); 
  }, [system.connections, system.settings]);

  const dockUrl = useMemo(() => appendConfigToUrl(getBaseUrl(), 'dock'), [appendConfigToUrl]);
  const alertsUrl = useMemo(() => appendConfigToUrl(getBaseUrl(), 'alerts'), [appendConfigToUrl]);

  // Effects
  useEffect(() => { const timer = setTimeout(() => setShowIntro(false), 9000); return () => clearTimeout(timer); }, []);
  useEffect(() => { 
      if (system.status.obsError && (system.status.obsError.name === 'SecurityError' || system.status.obsError.message?.includes('insecure'))) {
          setShowInsecureModal(true); 
      } 
  }, [system.status.obsError]);

  // --- Handlers for UI Interaction ---

  /*
    Why the last message typed at the dock did not go, in words, or ''.

    The box clears the moment you send, the way a chat does; a message that
    fails comes back into it — unless you have started typing something else
    since — with the reason beside it, for long enough to read.
  */
  const [sendError, setSendError] = useState('');
  useEffect(() => {
    if (!sendError) return;
    const timer = setTimeout(() => setSendError(''), 8000);
    return () => clearTimeout(timer);
  }, [sendError]);
  const sendErrorWords = (err: any) => {
    switch (err?.code) {
      case 'twitch_command': return t.sendErrorCommand;
      case 'twitch_offline': return t.sendErrorOffline;
      case 'bot_offline': return t.sendErrorBotOffline;
      case 'too_long': return t.sendErrorTooLong;
      // YouTube's, through the same words every screen uses for a refusal.
      case 'youtube_offline': case 'youtube_sign_in_again': case 'youtube_not_live': case 'youtube_too_long': case 'youtube_quota':
        return refusalWords(t, err);
      default: return `${t.sendErrorOther} ${err?.message || ''}`.trim();
    }
  };
  const handleSendMessage = () => {
    const text = messageInput;
    if (!text.trim()) return;
    setMessageInput('');
    setSendError('');
    system.actions.sendMessage(text).then((res: any) => {
      // Sent to both, and one of the two did not take it: said, with why.
      if (res?.failed) {
        // The one that did go, after why the other did not.
        const other = res.failed.platform === 'youtube' ? 'Twitch' : 'YouTube';
        setSendError(String(t.sendPartly || '{why} It did go to {other}.').split('{why}').join(sendErrorWords(res.failed)).split('{other}').join(other));
      }
    }).catch((err: any) => {
      setMessageInput((now: string) => (now ? now : text));
      setSendError(sendErrorWords(err));
    });
  };

  // Commands
  // Set when the editor is opened from somewhere that needs the result — the
  // Actions screen creating a command mid-edit wants to select it immediately,
  // and the id is known before the save because it is minted on open.
  const commandModalOnSaved = useRef<((id: string) => void) | null>(null);

  const handleOpenCommandModal = (cmd?: Command, onSaved?: (id: string) => void) => { commandModalOnSaved.current = onSaved ?? null; if (cmd) { setCurrentCommand(cmd); setTempTriggers(cmd.triggers.join('\n')); } else { setCurrentCommand({ id: Math.random().toString(36).substr(2, 9), name: 'New Command', triggers: [], permissions: { anyone: true, vips: true, subscribers: true, moderators: true, broadcaster: true }, enabled: true }); setTempTriggers(''); } setIsCommandModalOpen(true); };
  const handleCloseCommandModal = () => { commandModalOnSaved.current = null; setIsCommandModalOpen(false); };
  const handleSaveCommand = () => { if (!currentCommand.name) { alert("Please enter a command name."); return; } const triggersArray = tempTriggers.split('\n').map(t => t.trim().replace(/\s/g, '')).filter(t => t.length > 0); if (triggersArray.length === 0) { alert("Please enter at least one trigger."); return; } const finalCommand = { ...currentCommand, triggers: triggersArray } as Command; system.actions.saveCommand(finalCommand); const onSaved = commandModalOnSaved.current; commandModalOnSaved.current = null; setIsCommandModalOpen(false); onSaved?.(finalCommand.id); };
  
  // Actions
  const handleOpenActionModal = (action?: StreamAction) => { if (action) { setCurrentAction(action); } else { setCurrentAction({ id: Math.random().toString(36).substr(2, 9), name: 'New Interaction', enabled: true, trigger: { id: Math.random().toString(36).substr(2, 9), category: 'command', type: 'command_trigger', config: {} }, actions: [] }); } setIsActionModalOpen(true); };
  const handleSaveAction = () => { if (!currentAction.name) { alert("Please give your action a name."); return; } if (!currentAction.trigger) { alert("Please select a trigger."); return; } system.actions.saveAction(currentAction as StreamAction); setIsActionModalOpen(false); };
  
  // Recursive Action Helpers
  const addActionStep = (type: ActionStepType, parentId?: string, branch?: 'then' | 'else') => {
    /**
     * A step whose editor SHOWS a default must be SAVED with it.
     *
     * The camera step's dropdown renders `config.droidcamOperation || 'torch'`,
     * so a freshly added step displayed "Toggle flash" while its config was
     * empty. Nobody changes a dropdown that already says what they want, so
     * onChange never fired, nothing was stored, and the step ran with no
     * operation at all — it looked configured and did nothing.
     */
    const defaultConfig: Partial<Record<ActionStepType, any>> = {
        condition: { logic: { variable: 'user.isSub', operator: 'isTrue', value: '' } },
        droidcam_control: { droidcamOperation: 'torch' },
        // The run card steps start as a mod command would use them: whatever
        // follows the command word goes on the card.
        run_set_game: { value: '{input}' },
        run_set_platform: { value: '{input}' },
        run_set_year: { value: '{input}' },
        run_set_category: { value: '{input}' },
        run_set_estimate: { value: '{input}' },
        run_set_runner: { name: '{input}' },
        run_set_host: { name: '{input}' },
        run_set_commentator: { seat: 1, name: '{input}' },
        run_clear: { clearWhat: 'all' },
        plan_add: { text: '{input}', where: 'end' },
        text_layer_set: { text: '{input}' },
        goal_change: { value: '{input}', goalMode: 'auto' },
        deaths_change: { value: '{input}', deathsOp: 'auto' },
        timer_control: { timerOp: 'toggle' },
        countdown_control: { countdownOp: 'start', timer: '', value: '1:00' },
        layout_switch: { layoutId: '', transition: '' },
        remote_on_screen: { player: '1', sceneType: '' },
        question_add: { text: '{input}' },
        players_join: { name: '{user}', colour: '{input}' },
        players_state: { name: '{input}', playerState: 'out' },
        players_remove: { name: '{input}' },
        players_reset: {},
        players_clear: {},
        poll_open: { text: '{input}' },
        discord_send: { channelId: '', message: '', card: false },
        poll_close: {},
        poll_reset: {},
        avatar_face: { face: 'happy', seconds: 5 },
        avatar_action: { action: 'drink' },
        youtube_set_title: { title: '{input}' },
        youtube_set_description: { description: '' },
        youtube_toggle_category: { categoryA: '20', categoryB: '22' },
    };

    const newStep: ActionStep = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        config: { ...(defaultConfig[type] || {}) },
    };

    if (!parentId) {
        // Add to root
        setCurrentAction(prev => ({ ...prev, actions: [...(prev.actions || []), newStep] }));
        return;
    }

    // Add nested
    const addToTree = (steps: ActionStep[]): ActionStep[] => {
        return steps.map(step => {
            if (step.id === parentId) {
                if (branch === 'then') return { ...step, thenActions: [...(step.thenActions || []), newStep] };
                if (branch === 'else') return { ...step, elseActions: [...(step.elseActions || []), newStep] };
                return step;
            }
            return {
                ...step,
                thenActions: step.thenActions ? addToTree(step.thenActions) : undefined,
                elseActions: step.elseActions ? addToTree(step.elseActions) : undefined
            };
        });
    };
    setCurrentAction(prev => ({ ...prev, actions: prev.actions ? addToTree(prev.actions) : [] }));
  };

  const removeActionStep = (stepId: string) => {
      const removeFromTree = (steps: ActionStep[]): ActionStep[] => {
          return steps.filter(s => s.id !== stepId).map(s => ({
              ...s,
              thenActions: s.thenActions ? removeFromTree(s.thenActions) : undefined,
              elseActions: s.elseActions ? removeFromTree(s.elseActions) : undefined
          }));
      };
      setCurrentAction(prev => ({ ...prev, actions: prev.actions ? removeFromTree(prev.actions) : [] }));
  };

  /** A step dragged to a gap in its own list — the action's steps, or a condition's then or else. */
  const moveActionStep = (stepId: string, gap: number) => {
      setCurrentAction(prev => (prev.actions ? { ...prev, actions: moveInTree(prev.actions, stepId, gap) } : prev));
  };

  const updateActionStepConfig = (stepId: string, key: string, value: any) => {
      const updateTree = (steps: ActionStep[]): ActionStep[] => {
          return steps.map(s => {
              if (s.id === stepId) {
                  // Special handling for deep logic updates
                  if (key.startsWith('logic.')) {
                      const logicKey = key.split('.')[1];
                      return { ...s, config: { ...s.config, logic: { ...s.config.logic!, [logicKey]: value } } };
                  }
                  return { ...s, config: { ...s.config, [key]: value } };
              }
              return {
                  ...s,
                  thenActions: s.thenActions ? updateTree(s.thenActions) : undefined,
                  elseActions: s.elseActions ? updateTree(s.elseActions) : undefined
              };
          });
      };
      setCurrentAction(prev => ({ ...prev, actions: prev.actions ? updateTree(prev.actions) : [] }));
  };

  // A calendar trigger starts with its time zone: this browser's, since the phone the server runs on may keep UTC.
  const triggerDefaults = (type: TriggerType) => (type === 'timer_schedule'
    ? { days: [1], time: '18:00', tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
    : {});
  const updateTrigger = (category: TriggerCategory, type: TriggerType) => { setCurrentAction(prev => ({ ...prev, trigger: { ...prev.trigger!, category, type, config: triggerDefaults(type) } })); };
  const updateTriggerConfig = (key: string, value: any) => { setCurrentAction(prev => ({ ...prev, trigger: { ...prev.trigger!, config: { ...prev.trigger!.config, [key]: value } } })); };


  // Misc
  /*
    Which panel the dock is showing.

    Per browser rather than on the server: two docks open at once are two
    people at two desks, and the one watching chat should not be moved to
    the buttons because somebody else pressed one. Storage can be missing or
    refused outright in a browser source, so it is read behind a guard and a
    failure just means the dock opens on chat.
  */
  const [dockTab, setDockTabRaw] = useState<string>(() => {
    try { return localStorage.getItem('dock_tab') || 'chat'; } catch { return 'chat'; }
  });
  const setDockTab = (id: string) => {
    setDockTabRaw(id);
    try { localStorage.setItem('dock_tab', id); } catch { /* nothing to do about it */ }
  };
  const waitingQuestions = (((system.data as any).questions?.items || []) as any[]).filter((q) => q.status === 'pending').length;

  /*
    Guides (shared/guides.js): which tab and guide are open, and the setup
    steps — worked out here, since the menu counts what is left of them and
    the dashboard shows them too. What is only true while something is open
    (the stream page in OBS, an account connected) stays ticked once seen;
    what the app cannot see is ticked by hand. Both are this browser's.
  */
  const [guidesTab, setGuidesTab] = useState<GuidesTab>('start');
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const GUIDES_SEEN = 'simonsays.guides-seen';
  const GUIDES_TICKED = 'simonsays.guides-ticked';
  const readIds = (key: string): string[] => {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
  };
  const [guidesSeen, setGuidesSeen] = useState<string[]>(() => readIds(GUIDES_SEEN));
  const [guidesTicked, setGuidesTicked] = useState<string[]>(() => readIds(GUIDES_TICKED));
  const tickGuide = (id: string, done: boolean) => {
    const next = done ? [...new Set([...guidesTicked, id])] : guidesTicked.filter((x) => x !== id);
    setGuidesTicked(next);
    try { localStorage.setItem(GUIDES_TICKED, JSON.stringify(next)); } catch { /* this visit only */ }
  };
  // Not before the server has said what it has: until then everything would read as not done.
  const guidesReady = Boolean((system.data as any).surfaces);
  const setupProgress = setupState({ status: system.status, data: system.data }, { seen: guidesSeen, ticked: guidesTicked });
  const newlySeen = setupProgress.items.filter((i) => i.done && i.check.sticky && !guidesSeen.includes(i.check.id)).map((i) => i.check.id).join(',');
  useEffect(() => {
    if (!newlySeen) return;
    const next = [...new Set([...guidesSeen, ...newlySeen.split(',')])];
    setGuidesSeen(next);
    try { localStorage.setItem(GUIDES_SEEN, JSON.stringify(next)); } catch { /* this visit only */ }
  }, [newlySeen]);
  const openGuideAt = (id: string) => { setOpenGuide(id); setGuidesTab('guides'); setView('guides'); setIsMobileMenuOpen(false); };
  /*
    A screen gone to opens at its top. The screens share one scrolling area,
    so without this a "Go to" from far down the Guides landed halfway down
    the next screen, past its heading.
  */
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [view]);
  // The guide a screen's "?" opens.
  const screenGuide = view === 'guides' ? null : guideForScreen(view);

  // --- The menu (components/NavMenu.tsx) ---
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Two screens that are one thing, as tabs: the menu goes back to whichever of them was last open.
  const PAIRS: Record<string, AppView[]> = { timers: ['countdown', 'timer'], roleMenus: ['reaction-roles', 'discord-buttons'] };
  const [lastOfPair, setLastOfPair] = useState<Record<string, AppView>>({});
  useEffect(() => {
    for (const [pair, views] of Object.entries(PAIRS)) if (views.includes(view)) setLastOfPair((p) => (p[pair] === view ? p : { ...p, [pair]: view }));
  }, [view]);
  // Requests posted since the board was last looked at.
  const REQUESTS_SEEN = 'simonsays.requests-seen';
  const [requestsSeen, setRequestsSeen] = useState<number>(() => {
    try {
      const known = Number(localStorage.getItem(REQUESTS_SEEN));
      if (known) return known;
      localStorage.setItem(REQUESTS_SEEN, String(Date.now()));
    } catch { /* counted from now, this visit */ }
    return Date.now();
  });
  const gameRequestList: any[] = (system.data as any).gameRequests?.requests || [];
  useEffect(() => {
    if (view !== 'requests') return;
    const now = Date.now();
    setRequestsSeen(now);
    try { localStorage.setItem(REQUESTS_SEEN, String(now)); } catch { /* this visit only */ }
    // On the server's copy, not the list taken from it: that is a new empty list on every draw before one arrives.
  }, [view, (system.data as any).gameRequests]);
  const newRequests = view === 'requests' ? 0 : gameRequestList.filter((r) => r.status === 'open' && Number(r.at) > requestsSeen).length;
  /*
    A connection that dropped: on earlier in this visit, off now. TikTok is
    left out — it is meant to go when the stream does. Seen on the
    Connections screen, what is off is taken as meant.
  */
  const WATCHED: [keyof typeof system.status, string][] = [['twitch', 'Twitch'], ['twitchBot', 'Twitch Bot'], ['discord', 'Discord'], ['obs', 'OBS'], ['spotify', 'Spotify'], ['youtube', 'YouTube']];
  const wasOn = useRef<Set<string>>(new Set());
  const [dropped, setDropped] = useState<string[]>([]);
  const statusKey = WATCHED.map(([k]) => system.status[k]).join('|');
  useEffect(() => {
    for (const [k] of WATCHED) if (system.status[k] === 'connected') wasOn.current.add(String(k));
    if (view === 'gallery') wasOn.current = new Set(WATCHED.filter(([k]) => system.status[k] === 'connected').map(([k]) => String(k)));
    const lost = WATCHED.filter(([k]) => wasOn.current.has(String(k)) && system.status[k] !== 'connected' && system.status[k] !== 'connecting').map(([, name]) => name);
    setDropped((prev) => (prev.join() === lost.join() ? prev : lost));
  }, [statusKey, view]);
  const DOCK_TABS: DockTab[] = [
    { id: 'chat', label: t.chat || 'Chat', icon: MessageSquare },
    { id: 'actions', label: t.dockTabActions || 'Actions', icon: Zap },
    // Where the stream has got to, and the two presses that move it.
    { id: 'plan', label: t.dockTabPlan || 'Plan', icon: ListOrdered },
    // The question queue, to run a Q&A without leaving OBS; the number is what is waiting.
    { id: 'questions', label: t.questionsNav || 'Questions', icon: MessageCircleQuestion, count: waitingQuestions },
    // What viewers have done, this stream's totals, and the presses that answer them.
    { id: 'events', label: t.dockTabEvents || 'Events', icon: List },
  ];
  const panel = DOCK_TABS.some((x) => x.id === dockTab) ? dockTab : 'chat';

  const handleAcknowledgeInsecure = (blocked: boolean) => { if (!blocked) { window.location.reload(); } else { setHasInsecureBlocked(false); localStorage.setItem('insecure_content_acknowledged', 'true'); setShowInsecureModal(false); } };

  /**
   * Whether the reader has scrolled back through the log, and how much has
   * arrived since they did.
   *
   * The list is `flex-col-reverse`, so the newest message sits at scrollTop 0
   * and scrolling back gives *negative* values — measured in Chromium, which
   * is what OBS embeds. The browser also re-anchors on its own as messages
   * arrive, so nothing here has to fight it: this only decides whether to
   * offer the way back.
   */
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [chatPinned, setChatPinned] = useState(true);
  const [missedCount, setMissedCount] = useState(0);
  const chatPinnedRef = useRef(true);

  const onChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    // A few pixels of slack: a trackpad rarely lands exactly on zero.
    const pinned = el.scrollTop > -24;
    chatPinnedRef.current = pinned;
    setChatPinned(pinned);
    if (pinned) setMissedCount(0);
  }, []);

  const jumpToNewest = useCallback(() => {
    chatScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    chatPinnedRef.current = true;
    setChatPinned(true);
    setMissedCount(0);
  }, []);

  // Count what arrives while the reader is away, so the pill can say how much
  // they are behind.
  useEffect(() => {
    if (chatPinnedRef.current) return;
    setMissedCount((n) => n + 1);
  }, [system.data.chatMessages.length]);

  /**
   * Start a reply to whoever was clicked.
   *
   * Appends rather than replaces: half a sentence already typed is worth more
   * than the mention, and a second click should not wipe it. The trailing
   * space means you can carry on typing.
   */
  const mentionUser = (name: string) => {
    setMessageInput((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')} @${name} ` : `@${name} `));
  };

  // Chat rendering moved to <ChatMessageRow/> so surfaces other than App can
  // draw a message. Kept as a function because ChatDockView takes it as a prop.
  const renderChatMessageHelper = (chat: ChatMessage, idx: number) => (
    <ChatMessageRow
      key={chat.id}
      chat={chat}
      idx={idx}
      settings={system.settings}
      t={t}
      onMention={mentionUser}
      // The dock: nothing expires, since a message disappearing out from under
      // you while you read it would be a bug, and it speaks this device's language.
      // The chat on stream is a layer, drawn by the canvas with its own settings.
      autoHide={false}
      onStream={false}
    />
  );

  
  // An address with no page behind it.
  if (notFound) return <>{accentStyles}<NotFoundPage asked={unknownPath ? window.location.pathname : `?mode=${mode}`} t={t} /></>;

  // Standalone Modes
  if (mode === 'alerts') { return ( <div className="min-h-screen bg-transparent overflow-hidden relative"> <style>{`body, html { background-color: transparent !important; background-image: none !important; overflow: hidden; }`}</style>{accentStyles} {system.data.currentAlert && <AlertOverlay alert={system.data.currentAlert} playSound={Boolean(system.data.currentAlert.audible)} />} </div> ); }
  
  // Spotify Standalone Overlay
  // A standalone button grid: an OBS custom browser dock, a phone propped up
  // beside the keyboard, or a window on a second monitor.
  if (mode === 'dock-actions') {
    /*
      The shape comes from the server rather than from ?cols= on this URL.

      It was a URL parameter while this was the only place the grid was drawn.
      The chat dock draws it too now, and a number pinned into one browser
      source is a number the other cannot see — so the two would disagree and
      the screen where you set it could only ever fix one of them.
    */
    return (
      <div className="h-dvh overflow-auto bg-[#0a0a0a] p-3 font-sans">
        <style>{'body, html { background-color: #0a0a0a !important; background-image: none !important; }'}</style>
        {accentStyles}
        <DockDeck
          grid={system.data.dockGrid}
          remember="dock_page_deck"
          buttons={system.data.dockButtons}
          streamActions={system.data.streamActions}
          runDockAction={system.actions.runDockAction}
          stats={(system.data as any).stats}
          columns={system.data.dockGrid.columns}
          rows={system.data.dockGrid.rows}
          t={t}
        />
      </div>
    );
  }

  // The run timer on its own, for a browser source outside a layout.
  if (mode === 'timer') {
    return (
      <div className="min-h-screen bg-transparent overflow-hidden flex items-center justify-center">
        <style>{`body, html { background-color: transparent !important; background-image: none !important; overflow: hidden; margin: 0; }`}</style>
        {accentStyles}
        <div className="w-screen h-screen"><Stopwatch state={(system.data as any).stopwatch} /></div>
      </div>
    );
  }

  if (mode === 'countdown') {
    return (
      <div className="min-h-screen bg-transparent overflow-hidden flex items-center justify-center">
        <style>{`body, html { background-color: transparent !important; background-image: none !important; overflow: hidden; margin: 0; }`}</style>
        {accentStyles}
        {/* ?timer= names a saved timer, as a countdown layer can. */}
        <Countdown state={countdownFor(system.data.countdown, searchParams.get('timer'))} t={streamT} />
      </div>
    );
  }

  if (mode === 'viewers') {
    return (
      <div className="min-h-screen bg-transparent overflow-hidden flex items-center justify-center">
        <style>{`body, html { background-color: transparent !important; background-image: none !important; overflow: hidden; margin: 0; }`}</style>
        {accentStyles}
        <ViewerCount
          config={(system.data as any).viewers}
          stats={(system.data as any).stats}
          status={system.status}
          t={streamT}
        />
      </div>
    );
  }

  /**
   * Several overlays on one canvas, for a single browser source.
   *
   * Two ways to choose what it shows. Naming a layout in the URL pins it, which
   * is what a second, special-purpose source wants. Naming nothing follows the
   * active OBS scene, which is the point of the whole thing: one source, added
   * to every scene, showing whatever that scene is bound to — instead of a
   * browser source per overlay per scene.
   */
  if (mode === 'canvas') {
    const layouts = (system.data as any).layouts || [];
    const wanted = searchParams.get('layout');
    const currentScene = system.connections.obsData?.currentScene || '';
    const omni = (system.data as any).omnilayer;

    // In order: an explicit layout always wins; then whichever is on stream —
    // the scene binding, or the first layout while nobody binds any (liveLayout).
    const layout = wanted
      ? layouts.find((l: any) => l.id === wanted)
      : liveLayout(layouts, currentScene, omni);
    return (
      <div className="min-h-screen bg-transparent overflow-hidden">
        <style>{`body, html { background-color: transparent !important; background-image: none !important; overflow: hidden; margin: 0; height: 100%; }`}</style>
        {accentStyles}
        <div className="fixed inset-0">
          {layout ? (
            <CanvasStage
              layout={layout} system={system} t={t} showGuides={searchParams.get('guides') === 'true'}
              // The Omnilayer wipe, on the source that follows what is live — not on one pinned to a layout.
              moving={!wanted && omni?.enabled ? omni.moving : null}
            />
          ) : null}
        </div>
      </div>
    );
  }

  if (mode === 'omnibar') {
    const wantedBar = searchParams.get('bar');
    const omni = (wantedBar && ((system.data as any).omnibars || []).find((b: any) => b.id === wantedBar)) || system.data.omnibar;
    return (
      <div className="min-h-screen bg-transparent overflow-hidden">
        <style>{`body, html { background-color: transparent !important; background-image: none !important; overflow: hidden; margin: 0; }`}</style>
        {accentStyles}
        <div className={`fixed inset-x-0 ${omni?.style?.position === 'top' ? 'top-0' : 'bottom-0'}`}>
          {/* Drawn by whichever component the bar's kind says. */}
          {React.createElement((omni as any)?.kind === 'tall' ? TallOmnibar : Omnibar, {
            config: omni as any,
            stats: (system.data as any).stats,
            tags: system.data.streamTags,
            leaderboard: system.data.leaderboard,
            track: system.spotify.state.track,
            upNext: system.spotify.state.upNext,
            countdown: system.data.countdown,
            commands: system.data.commands,
            subscribers: (system.data as any).subscribers,
            events: (system.data as any).viewerEvents,
            t: streamT,
          } as any)}
        </div>
      </div>
    );
  }

  if (mode === 'spotify') {
      const showProgress = searchParams.get('showProgress') !== 'false';
      const showControls = searchParams.get('showControls') !== 'false';
      const showBlur = searchParams.get('showBlur') !== 'false';
      const transparentCard = searchParams.get('transparentCard') === 'true';
      const enableAnimation = searchParams.get('enableAnimation') !== 'false';

      return (
          <div className="min-h-screen bg-transparent overflow-hidden relative flex items-center justify-center">
              <style>{`body, html { background-color: transparent !important; background-image: none !important; overflow: hidden; }`}</style>{accentStyles}
              <div className="w-full max-w-sm p-4">
                  <SpotifyPlayer 
                      spotify={system.spotify}
                      config={{
                          showProgress,
                          showControls,
                          showBlur,
                          transparentCard,
                          enableAnimation
                      }}
                  />
              </div>
          </div>
      );
  }

  /*
    The chat overlay page, retired: every chat on stream is a layer on a layout
    now, with its own settings. A browser source still pointed here draws
    nothing rather than the whole dashboard, on stream.
  */
  if (mode === 'overlay') return <style>{'body, html { background: transparent !important; }'}</style>;

  if (mode === 'dock') { return ( <div className={`min-h-dvh font-sans ${system.settings.transparentBackground ? 'bg-transparent' : ''} overflow-hidden`} style={{ backgroundColor: system.settings.transparentBackground ? 'transparent' : system.settings.dockBackgroundColor }}> <style>{` body, html { background-color: ${system.settings.transparentBackground ? 'transparent' : system.settings.dockBackgroundColor} !important; ${system.settings.transparentBackground ? 'background-image: none !important;' : ''} height: 100%; overflow: hidden; } `}</style> {accentStyles}<div className="flex flex-col h-dvh p-2 relative"> {pickerState && (<><div className="fixed inset-0 z-[9990] bg-transparent" onClick={() => setPickerState(null)} /><EmojiPicker style={{ top: pickerState.top, left: pickerState.left }} onSelect={(emoji: string) => setMessageInput(messageInput + emoji)} onClose={() => setPickerState(null)} /></>)}
      {mode === 'dock' && <DockTabs tabs={DOCK_TABS} active={panel} onPick={setDockTab} />}
      {/* No alerts here: the dock is chat. Alerts belong to the alerts page and the alerts layer on a layout. */} <div className="flex-1 min-h-0 flex relative" style={mode === 'dock' && panel !== 'chat' ? { display: 'none' } : undefined}><div className="flex-1 overflow-y-auto flex flex-col-reverse relative scroll-smooth" ref={chatScrollRef} onScroll={onChatScroll} style={{ gap: `${system.settings.messageGap}px` }}> {<ChatStyle settings={system.settings} />} {/* The placeholders are for somebody looking at the dock. On stream they were a caption nobody asked for, in English, and "Connecting…" took the place of the whole chat whenever the page loaded or the server restarted. */}{(mode === 'dock' && system.status.twitch === 'disconnected' && system.status.tiktok === 'disconnected' && system.status.discord === 'disconnected') ? ( <div className="flex flex-col items-center justify-center h-full text-center p-4"> <div className="w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 border border-zinc-700/50"> <WifiOff size={24} className="text-zinc-500" /> </div> <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t.connecting}</p> </div> ) : (mode === 'dock' && system.data.chatMessages.length === 0) ? ( <div className="flex flex-col items-center justify-center h-full text-center p-4"> <Loader2 className="w-8 h-8 text-current-accent animate-spin mb-4" /> <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t.noMessages}</p> </div> ) : ( system.data.chatMessages.map((chat, idx) => renderChatMessageHelper(chat, idx)) )} </div> {mode === 'dock' && !chatPinned && (
        <button onClick={jumpToNewest} className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-current-accent text-white text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 hover:brightness-110 transition-all">
          <ChevronDown size={12} />
          {missedCount > 0 ? `${missedCount} ${t.newMessages}` : t.jumpToNewest}
        </button>
      )}</div>
      {mode === 'dock' && panel === 'actions' && (
        <div className="flex-1 min-h-0 overflow-y-auto" data-dock="panel" data-dock-panel="actions">
          <DockDeck
            grid={system.data.dockGrid}
            remember="dock_page_tab"
            buttons={system.data.dockButtons}
            streamActions={system.data.streamActions}
            runDockAction={system.actions.runDockAction}
            stats={(system.data as any).stats}
            columns={system.data.dockGrid.columns}
            rows={system.data.dockGrid.rows}
            compact
            t={t}
          />
        </div>
      )}
      {mode === 'dock' && panel === 'events' && (
        <div className="flex-1 min-h-0 flex flex-col p-1" data-dock="panel" data-dock-panel="events">
          <EventFeed
            compact
            events={(system.data as any).viewerEvents || []}
            totals={(system.data as any).eventTotals}
            run={system.actions.events}
            shoutout={(login: string) => system.actions.twitchExtras({ op: 'shoutout', target: login })}
            language={system.settings.language}
            t={t}
          />
        </div>
      )}
      {mode === 'dock' && panel === 'questions' && (
        <div className="flex-1 min-h-0 overflow-y-auto" data-dock="panel" data-dock-panel="questions">
          <DockQuestions
            questions={(system.data as any).questions}
            setStatus={system.actions.setQuestionStatus}
            show={system.actions.showQuestion}
            control={system.actions.questions}
            t={t}
          />
        </div>
      )}
      {mode === 'dock' && panel === 'plan' && (
        <div className="flex-1 min-h-0 overflow-y-auto" data-dock="panel" data-dock-panel="plan">
          <DockPlan
            plan={(system.data as any).plan}
            planGoto={system.actions.planGoto}
            runDockAction={system.actions.runDockAction}
            t={t}
          />
        </div>
      )}
      {mode === 'dock' && panel === 'chat' && ( <div className="mt-2 pt-3 border-t border-white/10 flex flex-col"> <div className="flex items-center gap-2 px-1 mb-1.5"> <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 opacity-60">{t.sendingAs}:</span>{system.status.twitchBot === 'connected' ? ( <div className="flex bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800 shadow-sm"> <button onClick={() => system.settings.setSenderRole('main')} className={`px-3 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${system.settings.senderRole === 'main' ? 'bg-current-accent text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}> {t.mainAccount} </button> <button onClick={() => system.settings.setSenderRole('bot')} className={`px-3 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${system.settings.senderRole === 'bot' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}> {t.botAccount} </button> </div> ) : ( <span className="text-[8px] font-black uppercase tracking-widest text-current-accent opacity-60"> {t.mainAccount} {system.connections.twitchUser?.display_name ? `(${system.connections.twitchUser.display_name})` : ''} </span> )} <SendToPicker value={(system.settings as any).sendTo} set={(system.settings as any).setSendTo} authorised={Boolean((system.connections as any).youtubeAuthorised)} live={Boolean((system.connections as any).youtubeLive)} unitsUsed={(system.data as any).stats?.youtubeUnitsUsed} t={t} /> <div className="ml-auto flex items-center gap-1">
          <button onClick={system.data.clearChat} title={t.clearChat} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"><Trash2 size={13} /></button>
        </div> </div> {sendError && <p role="alert" data-dock="send-error" className="px-1 mb-1.5 text-[10px] font-bold leading-snug text-red-400">{sendError}</p>} <div className="flex gap-2 items-stretch"> <div className="flex-1 bg-zinc-900/50 rounded-xl border border-zinc-800 flex items-center px-4 pr-1 relative"> <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }} placeholder={system.status.twitch === 'connected' ? t.typeGlobal : t.connecting} disabled={system.status.twitch === 'disconnected'} className="bg-transparent border-none outline-none w-full text-xs font-bold text-zinc-400 disabled:opacity-50 pr-8 py-3" /> <button onClick={handlePickerOpen} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Add Emoji"> <Smile size={14} /> </button> </div> <Button onClick={handleSendMessage} icon={<Send size={16} />} className="font-extrabold px-4" disabled={system.status.twitch === 'disconnected' || !messageInput.trim()}> <span className="hidden xs:inline">{t.send}</span> </Button> </div> </div> )} </div> </div> ); }

  /**
   * The sidebar's markup — a plain function that is called, rather than a
   * component rendered as an element.
   *
   * As a component it was declared inside App, so every App render produced a
   * new component type. React cannot know the new type is "the same" as the
   * old one, so it unmounted the whole sidebar and built it again from
   * scratch — and a fresh DOM node has scrollTop 0. With the server pushing a
   * frame every few seconds, the nav scrolled itself back to the top roughly
   * once a second, and again on every click.
   *
   * Called as a function, the elements are reconciled in place and the
   * scroller keeps its DOM node, and therefore its scroll position. It must
   * stay hook-free for that reason: hooks here would belong to App.
   */
  const goTo = (next: AppView) => { setView(next); setIsMobileMenuOpen(false); };
  const pollOpen = (system.data as any).poll?.mode === 'open';
  const giveawayOpen = (system.data as any).giveaway?.mode === 'open';
  const remoteSending = ((system.data as any).remotePlayers?.seats || []).some((s: any) => s.status?.state === 'live');
  const I = 18;
  /*
    By when a screen is used: live, the community, what is on screen,
    Discord, automation, setup. Each is the screen's own name and icon; a
    pair that is one thing (the clocks, the role menus) is one entry, opened
    on whichever of the two was last used, with tabs between them.
  */
  const navSections: NavSection[] = [
    { id: 'live', label: t.navLive || 'Live', items: [
      { view: 'dashboard', label: t.dashboard, icon: <Layout size={I} /> },
      { view: 'assets', label: t.chatDock, icon: <Package size={I} />, keywords: 'chat' },
      { view: 'events', label: t.eventsDock, icon: <List size={I} />, keywords: 'events thank eventos' },
      { view: 'plan', label: t.planNav || 'Stream plan', icon: <ListOrdered size={I} /> },
      { view: 'questions', label: t.questionsNav || 'Questions', icon: <MessageCircleQuestion size={I} />, number: waitingQuestions || undefined },
      { view: 'polls', label: t.pollsNav || 'Polls', icon: <BarChart3 size={I} />, dot: pollOpen ? 'on' : undefined, hint: pollOpen ? (t.navRunning || 'Running now') : undefined },
      { view: 'giveaway', label: t.giveawayNav || 'Giveaways', icon: <Gift size={I} />, dot: giveawayOpen ? 'on' : undefined, hint: giveawayOpen ? (t.navRunning || 'Running now') : undefined },
      { view: 'run', label: t.gameNav || 'Game', icon: <Gamepad2 size={I} />, keywords: 'run title category juego' },
      { view: 'people', label: t.navPeopleOnStream || 'People on stream', icon: <Video size={I} />, keywords: `who host guests commentators nameplates ${t.peopleNav || ''}` },
      { view: 'players', label: t.navGameNight || 'Game night', icon: <Users size={I} />, keywords: `players among us ${t.playersNav || ''}` },
      { view: 'remote-players', label: t.remotePlayersNav || 'Remote players', icon: <Cast size={I} />, keywords: 'vdo ninja co-op guests 4 players jugadores remotos invite', dot: remoteSending ? 'on' : undefined, hint: remoteSending ? (t.remoteNavSending || 'Somebody is sending') : undefined },
    ] },
    { id: 'community', label: t.navCommunity || 'Community', items: [
      { view: 'levels', label: t.levels || 'Levels & XP', icon: <Trophy size={I} />, keywords: 'xp ranks niveles' },
      { view: 'points', label: t.pointsNav || 'Points', icon: <Coins size={I} />, keywords: 'shop tienda puntos' },
      { view: 'requests', label: t.requestsNav || 'Game requests', icon: <Inbox size={I} />, number: newRequests || undefined, hint: newRequests ? fill(t.navNewRequests || '{count} new since you last looked', { count: newRequests }) : undefined },
      { view: 'streams', label: t.streamsNav || 'Streams', icon: <History size={I} />, keywords: 'history vod chapters historial' },
    ] },
    { id: 'screen', label: t.navOnScreen || 'On screen', items: [
      { view: 'layouts', label: t.layouts || 'Overlays', icon: <Layers size={I} />, keywords: 'layouts canvas scenes' },
      { view: 'alerts', label: t.alerts || 'Alerts', icon: <Bell size={I} /> },
      { view: 'omnibar', label: t.omnibar || 'Omnibar', icon: <Radio size={I} /> },
      { view: 'viewers', label: t.navViewerCount || 'Viewer count', icon: <Eye size={I} />, keywords: `viewers ${t.viewers || ''}` },
      { view: 'tags', label: t.navStreamLabels || 'Stream labels', icon: <Tag size={I} />, keywords: `tags latest follower subscriber donation ${t.tags || ''}` },
      { view: 'spotify-overlay', label: t.spotifyOverlay || 'Spotify Overlay', icon: <SpotifyIconComponent size={I} />, keywords: 'music song' },
      { view: lastOfPair.timers || 'countdown', also: ['countdown', 'timer'], label: t.navTimers || 'Timers', icon: <Clock size={I} />, keywords: `${t.countdown || 'countdown'} ${t.timer || 'timer'} clock` },
      { view: 'pngtuber', label: t.pngtuberNav || 'PNGtuber', icon: <Mic size={I} />, keywords: 'avatar voice' },
      { view: 'pixel-avatars', label: t.pixelAvatarsNav || 'Pixel avatars', icon: <Sparkles size={I} /> },
      { view: 'library', label: t.navLooks || 'Looks', icon: <Palette size={I} />, keywords: `library styles css ${t.libraryNav || ''}` },
    ] },
    { id: 'discord', label: t.navDiscord || 'Discord', items: [
      { view: 'welcome-goodbye', label: t.welcomeGoodbye || 'Welcome & Goodbye', icon: <DoorOpen size={I} /> },
      { view: 'discord-pages', label: t.discordPagesNav || 'Discord pages', icon: <Newspaper size={I} /> },
      { view: 'role-management', label: t.roleManagement, icon: <Shield size={I} />, keywords: 'link accounts loyalty mod log' },
      { view: lastOfPair.roleMenus || 'reaction-roles', also: ['reaction-roles', 'discord-buttons'], label: t.navRoleMenus || 'Role menus', icon: <MousePointerClick size={I} />, keywords: `${t.reactionRoles || ''} ${t.discordButtons || ''}` },
      { view: 'voice', label: t.voiceNav || 'Voice call', icon: <Headphones size={I} /> },
      { view: 'go-live', label: t.goLiveNav || 'Go live', icon: <Megaphone size={I} />, keywords: 'announce highlights dms anuncio' },
    ] },
    { id: 'automation', label: t.navAutomation || 'Automation', items: [
      { view: 'studio', label: t.commands, icon: <Terminal size={I} /> },
      { view: 'actions', label: t.actions, icon: <Zap size={I} /> },
      { view: 'dock-actions', label: t.dockActions, icon: <LayoutGrid size={I} /> },
    ] },
    { id: 'setup', label: t.navSetup || 'Setup', items: [
      { view: 'gallery', label: t.connections, icon: <Share2 size={I} />, dot: dropped.length ? 'alert' : undefined, hint: dropped.length ? fill(t.navDropped || '{names} dropped since it was on', { names: dropped.join(', ') }) : undefined },
      { view: 'twitch', label: t.twitchNav || 'Twitch', icon: <TwitchIcon size={I} />, keywords: 'raid shoutout hype clips schedule' },
      { view: 'settings', label: t.settings, icon: <SettingsIcon size={I} />, keywords: 'language theme idioma version versión about acerca backup' },
      // Last in the menu: where somebody new starts, counting the setup steps still to do.
      { view: 'guides', label: t.guidesNav || 'Guides', icon: <BookOpen size={I} />, keywords: 'help ayuda tutorial start empezar setup configurar how como glossary glosario',
        number: guidesReady && setupProgress.left ? setupProgress.left : undefined,
        hint: guidesReady && setupProgress.left ? fill(t.guidesNavLeft || '{count} setup steps left', { count: setupProgress.left }) : undefined },
    ] },
  ];
  // Every screen for the search, the paired ones each under its own name too.
  const searchEntries: SearchEntry[] = [
    ...navSections.flatMap((sec) => sec.items.map((item) => ({ view: item.view, label: item.label, section: sec.label, icon: item.icon, keywords: item.keywords }))),
    { view: 'countdown', label: t.countdown || 'Countdown', section: t.navOnScreen || 'On screen', icon: <Clock size={I} /> },
    { view: 'timer', label: t.timer || 'Timer', section: t.navOnScreen || 'On screen', icon: <Clock size={I} />, keywords: 'run' },
    { view: 'reaction-roles', label: t.reactionRoles, section: t.navDiscord || 'Discord', icon: <MousePointerClick size={I} /> },
    { view: 'discord-buttons', label: t.discordButtons || 'Discord Buttons', section: t.navDiscord || 'Discord', icon: <GripHorizontal size={I} /> },
    // Each guide by its title, opened where it is.
    ...GUIDES.map((g: any) => ({
      view: 'guides' as AppView,
      label: (system.settings.language === 'es' ? g.es : g.en).title,
      section: t.guidesNav || 'Guides',
      icon: <BookOpen size={I} />,
      // Found by its name in either language, the screens it is about, and what it is ("omnilayer", "remote players").
      keywords: `${g.id.split('-').join(' ')} ${g.en.title} ${g.es.title} ${g.screens.map((s: string) => viewNames[s as AppView] || '').join(' ')}`,
      onChoose: () => openGuideAt(g.id),
    })),
  ];
  const statusMarks = [
    { id: 'twitch', name: 'Twitch', icon: <TwitchIcon size={13} />, ok: system.status.twitch === 'connected' },
    { id: 'twitchBot', name: 'Twitch Bot', icon: <Bot size={13} />, ok: system.status.twitchBot === 'connected' },
    { id: 'tiktok', name: 'TikTok', icon: <TikTokIcon size={13} />, ok: system.status.tiktok === 'connected' },
    { id: 'discord', name: 'Discord', icon: <DiscordIcon size={13} />, ok: system.status.discord === 'connected' },
    { id: 'obs', name: 'OBS', icon: <Monitor size={13} />, ok: system.status.obs === 'connected' },
    { id: 'spotify', name: 'Spotify', icon: <SpotifyIconComponent size={13} />, ok: system.status.spotify === 'connected' },
    { id: 'youtube', name: 'YouTube', icon: <PlatformMark platform="youtube" size={13} plain />, ok: system.status.youtube === 'connected' },
  ];
  // The phone's bar: what is pressed mid-stream.
  const phoneItems = [
    navSections[0].items[0],
    { ...navSections[0].items[1], label: t.chat || 'Chat' },
    { ...navSections[0].items[3], label: t.dockTabPlan || 'Plan' },
    navSections[0].items[4],
  ];

  const renderSidebar = (isMobile?: boolean) => (
    <>
      <div className={`shrink-0 p-6 flex items-center gap-3 ${isMobile ? 'justify-between' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-rose-500 to-rose-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <Logo className="w-5 h-5" />
          </div>
          <span className={`font-black tracking-tight text-lg ${activeTheme.id === 'light' ? 'text-zinc-900' : 'text-white'}`}>SIMON SAYS</span>
        </div>
        {isMobile && ( <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-500 hover:text-white transition-colors"> <X size={24} /> </button> )}
      </div>
      <div className="shrink-0 px-4 pb-2">
        <SearchButton onOpen={() => { setSearchOpen(true); }} t={t} light={activeTheme.id === 'light'} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 scrollbar-thin scrollbar-thumb-zinc-800" data-nav>
        <NavSections sections={navSections} view={view} go={goTo} />
      </div>
      <div className="shrink-0 p-4 border-t border-zinc-800/50">
        <StatusRow marks={statusMarks} onOpen={() => goTo('gallery')} label={t.connections} light={activeTheme.id === 'light'} />
      </div>
    </>
  );

  return (
    <div className={`h-dvh ${activeTheme.bgClass} ${activeTheme.textClass} font-sans flex overflow-hidden relative transition-colors duration-500`}>
      {accentStyles}

      {/* Rendered above the view switch so the Actions screen can open it too. */}
      <CommandEditorModal
        isCommandModalOpen={isCommandModalOpen}
        setIsCommandModalOpen={handleCloseCommandModal}
        currentCommand={currentCommand}
        setCurrentCommand={setCurrentCommand}
        tempTriggers={tempTriggers}
        setTempTriggers={setTempTriggers}
        handleSaveCommand={handleSaveCommand}
        activeTheme={activeTheme}
        t={t}
      />

      {showIntro && ( <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center font-sans overflow-hidden"> <div className="relative flex items-center justify-center"> <div className="absolute inset-0 bg-rose-500/20 blur-[100px] rounded-full animate-pulse"></div> <div className="relative z-10 flex flex-col items-center"> <div className="relative w-32 h-32 mb-8"> <div className="absolute inset-0 border-4 border-rose-500/30 rounded-full animate-[spin_3s_linear_infinite]"></div> <div className="absolute inset-2 border-4 border-rose-500/50 rounded-full border-t-transparent animate-[spin_2s_linear_infinite_reverse]"></div> <div className="absolute inset-0 flex items-center justify-center"> <Logo className="w-16 h-16 text-rose-500 animate-[pulse_2s_ease-in-out_infinite]" /> </div> </div> <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-4 animate-[slide-up_0.8s_ease-out]"> SIMON SAYS </h1> <div className="h-1 w-24 bg-gradient-to-r from-transparent via-rose-500 to-transparent rounded-full animate-[width_1s_ease-out]"></div> </div> </div> </div> )}
      {isMobileMenuOpen && ( <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} /> )}
      
      <aside className={`fixed inset-y-0 left-0 z-[70] w-72 ${activeTheme.bgClass} border-r ${activeTheme.borderClass} md:hidden transform transition-transform duration-300 ease-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full shadow-none'}`}> {renderSidebar(true)} </aside>
      <aside className={`w-64 shrink-0 h-full min-h-0 border-r ${activeTheme.borderClass} ${activeTheme.id === 'light' ? 'bg-white' : 'bg-zinc-950/50'} hidden md:flex flex-col transition-colors duration-300`}> {renderSidebar()} </aside>

      <main ref={mainRef} className="flex-1 overflow-y-auto relative pt-0">
        {/*
          The bar is for phones only.

          All it holds is the menu button and the name of the screen you are
          on. On a desktop the sidebar is already open beside you with that
          screen lit up, so the bar was 64px of height repeating it. On a phone
          the sidebar is hidden behind that menu button, so both earn their
          place there.
        */}
        <div className={`md:hidden sticky top-0 z-40 h-16 ${activeTheme.bgClass}/80 backdrop-blur-md border-b ${activeTheme.borderClass} flex items-center justify-between px-4 md:px-8 transition-colors duration-300`}>
           <div className="flex items-center gap-4">
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white transition-colors" aria-label="Open Menu"> <Menu size={24} /> </button>
              <div className={`text-sm ${activeTheme.id === 'light' ? 'text-zinc-500' : 'text-zinc-400'} breadcrumbs truncate`}> <span className="opacity-50 uppercase tracking-widest text-[10px] font-bold hidden xs:inline">{t.commandCenter}</span> <span className="mx-2 hidden xs:inline">/</span> <span className={`${activeTheme.id === 'light' ? 'text-zinc-900' : 'text-white'} font-extrabold uppercase tracking-tight`}>{viewNames[view]}</span> </div>
           </div>
           {screenGuide && (
             <button type="button" onClick={() => openGuideAt(screenGuide.id)} className="p-2 -mr-2 text-zinc-500 hover:text-white" title={fill(t.guidesForScreen || 'Guide: {title}', { title: (system.settings.language === 'es' ? screenGuide.es : screenGuide.en).title })} data-screen-guide-phone={screenGuide.id}>
               <HelpCircle size={20} />
             </button>
           )}
        </div>

        {/*
          The width cap is for reading, not for editing.

          Long lines of form are hard to read, which is what max-w-7xl is for
          on every other screen. The overlay editor is a canvas, and capping it
          left 379px of a 1659px area — 23% — as empty margin either side while
          the canvas it was squeezing sat at 42% scale. The pixel avatar
          editor is a canvas too.
        */}
        {/* The 4rem is the bar above, which only a phone still has. */}
        <div className={`${view === 'layouts' || view === 'pixel-avatars' ? '' : 'max-w-7xl'} relative mx-auto p-4 sm:p-6 md:p-10 h-[calc(100dvh-4rem)] md:h-dvh`}>
          {/*
            The screen's guide, a press away: in the margin above it, where no
            screen puts anything, so it never covers a screen's own buttons.
          */}
          {screenGuide && (
            <button
              type="button"
              onClick={() => openGuideAt(screenGuide.id)}
              className="hidden md:flex absolute top-2 right-10 h-7 items-center gap-1.5 px-2.5 rounded-full text-[10px] font-bold text-zinc-500 hover:text-white hover:bg-zinc-900/60 transition-colors z-10"
              title={t.guidesHelpHint || 'How this screen works'}
              data-screen-guide={screenGuide.id}
            >
              <HelpCircle size={13} />
              {fill(t.guidesForScreen || 'Guide: {title}', { title: (system.settings.language === 'es' ? screenGuide.es : screenGuide.en).title })}
            </button>
          )}
          {/*
            The profile bar for whichever section is open.

            Rendered here rather than inside each view because one group spans
            several screens — commands, actions and dock actions share a profile
            — and because a view should not have to know profiles exist to have
            one. Views not in the map simply get no bar.
          */}
          {/* Two screens that are one thing: tabs between them, at the top of each. */}
          {(view === 'countdown' || view === 'timer') && (
            <ScreenTabs view={view} go={goTo} tabs={[{ view: 'countdown', label: t.countdown || 'Countdown' }, { view: 'timer', label: t.timer || 'Timer' }]} />
          )}
          {(view === 'reaction-roles' || view === 'discord-buttons') && (
            <ScreenTabs view={view} go={goTo} tabs={[{ view: 'reaction-roles', label: t.reactionRoles }, { view: 'discord-buttons', label: t.discordButtons || 'Discord Buttons' }]} />
          )}
          {PROFILE_GROUP_FOR_VIEW[view] && (
            <div className="mb-6">
              <ProfileSwitcher
                group={PROFILE_GROUP_FOR_VIEW[view]}
                profiles={(system.data as any).profiles || []}
                actions={system.actions}
                t={t}
              />
            </div>
          )}
           {view === 'settings' && ( 
             <SettingsView 
               activeTheme={activeTheme} 
               activeThemeId={system.settings.activeThemeId} 
               setActiveThemeId={system.settings.setActiveThemeId} 
               language={system.settings.language} 
               setLanguage={system.settings.setLanguage} 
               exportConfig={system.actions.exportConfig}
               importConfig={system.actions.importConfig}
               serverVersion={(system.data as any).serverVersion}
               t={t} 
             /> 
           )}
           {view === 'dashboard' && ( <DashboardView activeTheme={activeTheme} t={t} setView={setView} spotify={system.spotify} setup={guidesReady ? setupProgress : null} /> )}
           {view === 'guides' && (
             <GuidesView
               t={t}
               system={system}
               go={goTo}
               screens={viewNames}
               progress={setupProgress}
               ticked={guidesTicked}
               setTicked={tickGuide}
               tab={guidesTab}
               setTab={setGuidesTab}
               openGuide={openGuide}
               setOpenGuide={setOpenGuide}
             />
           )}
           
           {view === 'studio' && (
             <StudioView
               commands={system.data.commands}
               setCommands={() => {}} // CRUD actions are used instead
               handleDeleteCommand={system.actions.deleteCommand}
               handleOpenCommandModal={handleOpenCommandModal}
               activeTheme={activeTheme}
               t={t}
             />
           )}

           {view === 'actions' && (
             <ActionsView
                avatarActions={((system.data as any).pixelAvatars || []).flatMap((p: any) => (p.actions || []).map((a: any) => a.name))}
                omnibarSlots={(() => {
                  const bars: any[] = (system.data as any).omnibars || [];
                  const named = (bar: string, i: any) => (bars.length ? { ...i, name: `${bar}: ${i.name || i.label || i.text || i.id}` } : i);
                  return [
                    ...(system.data.omnibar?.items || []).filter((i: any) => i.type === 'text').map((i: any) => named(t.omnibarBarMain || 'Main', i)),
                    ...bars.flatMap((b) => (b.items || []).filter((i: any) => i.type === 'text').map((i: any) => named(b.name, i))),
                  ];
                })()}
                layouts={(system.data as any).layouts || []}
                sceneTypes={(system.data as any).omnilayer?.types || []}
                goalSlots={(() => {
                  // Every goal slot on every bar, named by bar and by what it is for.
                  const bars: any[] = [{ name: t.omnibarBarMain || 'Main', items: system.data.omnibar?.items || [] }, ...((system.data as any).omnibars || [])];
                  return bars.flatMap((b) => (b.items || []).filter((i: any) => i.type === 'goal').map((i: any) => ({
                    id: i.id, bar: b.name, name: i.text || i.name || i.label || i.id, source: i.goalSource || 'followers',
                  })));
                })()}
                countdownPresets={((system.data as any).countdown?.presets || []).map((p: any) => ({ id: p.id, name: p.name }))}
                seatNames={((system.data as any).remotePlayers?.seats || []).map((s: any) => s.name || '')}
                voice={(system.data as any).voice}
                regulars={(system.data as any).people?.regulars || []}
                listServerMembers={system.status.discord === 'connected' ? (system.actions as any).listServerMembers : undefined}
                streamActions={system.data.streamActions}
                setStreamActions={() => {}} // CRUD
                isActionModalOpen={isActionModalOpen}
                setIsActionModalOpen={setIsActionModalOpen}
                currentAction={currentAction}
                setCurrentAction={setCurrentAction}
                commands={system.data.commands}
                obsData={system.connections.obsData}
                availableRewards={system.connections.availableRewards}
                fetchTwitchRewards={system.actions.fetchTwitchRewards}
                handleSaveAction={handleSaveAction}
                handleDeleteAction={system.actions.deleteAction}
                handleTestAction={system.actions.testAction}
                handleOpenActionModal={handleOpenActionModal}
                handleOpenCommandModal={handleOpenCommandModal}
                addActionStep={addActionStep}
                removeActionStep={removeActionStep}
                moveActionStep={moveActionStep}
                updateActionStepConfig={updateActionStepConfig}
                updateTrigger={updateTrigger}
                updateTriggerConfig={updateTriggerConfig}
                activeTheme={activeTheme}
                discordEmojis={system.connections.discordEmojis} 
                discordChannels={system.connections.discordChannels}
                discordRoles={(system.data as any).discordRoles}
                t={t}
                searchCategories={system.actions.searchCategories} // Updated
             />
           )}



           {view === 'tags' && (
             <TagsView 
               streamTags={system.data.streamTags}
               tagOutputs={system.data.tagOutputs}
               setTagOutputs={system.actions.setTagOutputs}
               fetchTwitchTags={system.actions.fetchTwitchTags}
               syncTagOutputs={system.actions.syncTagOutputs}
               obsStatus={system.status.obs}
               obsData={system.connections.obsData}
               setView={setView}
               activeTheme={activeTheme}
               t={t}
             />
           )}

           {view === 'twitch' && (
             <TwitchView
               settings={(system.data as any).twitchExtras}
               hype={(system.data as any).hypeTrain}
               schedule={(system.data as any).twitchSchedule}
               scopes={(system.data as any).twitchScopes}
               request={(system.actions as any).twitchExtras}
               t={t}
             />
           )}

           {view === 'pngtuber' && (
             <PngtuberView
               settings={(system.data as any).micSettings}
               talk={(system.data as any).micTalk}
               level={(system.data as any).micLevel}
               asked={(system.data as any).avatarFace}
               sources={(system.connections as any).obsData?.sources || []}
               obsConnected={system.status.obs === 'connected'}
               save={(system.actions as any).setMic}
               meter={(system.actions as any).micMeter}
               face={(system.actions as any).avatarFace}
               dress={(system.actions as any).avatarDress}
               undress={(system.actions as any).avatarUndress}
               dressed={(system.data as any).avatarDress}
               act={(system.actions as any).avatarAction}
               acted={(system.data as any).avatarAction}
               pixelAvatars={(system.data as any).pixelAvatars || []}
               t={t}
             />
           )}

           {view === 'go-live' && (
             <GoLiveView
               settings={(system.data as any).announce}
               channels={system.connections.discordChannels}
               roles={(system.data as any).discordRoles}
               save={(system.actions as any).setAnnounce}
               test={(system.actions as any).testAnnounce}
               testRecap={(system.actions as any).testRecap}
               scheduleEvents={(system.data as any).scheduleEvents}
               saveScheduleEvents={(system.actions as any).setScheduleEvents}
               syncScheduleEvents={(system.actions as any).syncScheduleEvents}
               streamsOnSchedule={((system.data as any).twitchSchedule?.segments || []).length}
               listAssets={system.actions.listAssets}
               uploadAsset={system.actions.uploadAsset}
               botConnected={system.status.discord === 'connected'}
               highlights={(system.data as any).highlights}
               highlightsControl={(system.actions as any).highlights}
               liveDms={(system.data as any).liveDms}
               liveDmsControl={(system.actions as any).liveDms}
               t={t}
             />
           )}

           {view === 'voice' && (
             <VoiceView
               pixelAvatars={(system.data as any).pixelAvatars || []}
               voice={(system.data as any).voice}
               channels={system.connections.discordChannels}
               setVoice={(system.actions as any).setVoice}
               botConnected={system.status.discord === 'connected'}
               listAssets={system.actions.listAssets}
               uploadAsset={system.actions.uploadAsset}
               layouts={(system.data as any).layouts || []}
               listServerMembers={(system.actions as any).listServerMembers}
               t={t}
             />
           )}

           {view === 'role-management' && (
             <RoleManagementViewConnected 
               activeTheme={activeTheme}
               t={t}
               system={system}
             />
           )}

           {view === 'reaction-roles' && (
             <ReactionRolesView
               activeTheme={activeTheme}
               t={t}
               system={system}
             />
           )}

           {view === 'discord-buttons' && (
             <DiscordButtonsView 
               activeTheme={activeTheme}
               t={t}
               system={system}
             />
           )}

           {view === 'welcome-goodbye' && (
             <WelcomeGoodbyeView
               activeTheme={activeTheme}
               t={t}
               system={system}
             />
           )}

           {view === 'discord-pages' && (
             <DiscordPagesView
               pages={(system.data as any).discordPages || []}
               control={(system.actions as any).discordPages}
               channels={system.connections.discordChannels || []}
               roles={(system.data as any).discordRoles || []}
               emojis={system.connections.discordEmojis || []}
               testChannelId={(system.data as any).welcomeGoodbyeConfig?.testChannelId}
               listAssets={system.actions.listAssets}
               uploadAsset={system.actions.uploadAsset}
               botConnected={system.status.discord === 'connected'}
               botName={(() => { const m: any = system.connections.botMember; return m?.nick || m?.user?.global_name || m?.user?.username; })()}
               botAvatar={(() => { const u: any = (system.connections.botMember as any)?.user; return u?.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=80` : undefined; })()}
               t={t}
             />
           )}

           {view === 'timer' && (
             <TimerView
                state={(system.data as any).stopwatch}
                control={(system.actions as any).stopwatch}
                activeTheme={activeTheme}
                t={t}
             />
           )}

           {view === 'countdown' && (
             <CountdownView
                state={system.data.countdown}
                control={system.actions.countdown}
                activeTheme={activeTheme}
                t={t}
             />
           )}

           {view === 'viewers' && (
             <ViewersView
                config={(system.data as any).viewers}
                setViewers={(system.actions as any).setViewers}
                stats={(system.data as any).stats}
                status={system.status}
                activeTheme={activeTheme}
                t={t}
             />
           )}

           {view === 'omnibar' && (() => {
             const bars: any[] = (system.data as any).omnibars || [];
             const bar = omnibarBar === 'main' ? null : bars.find((b) => b.id === omnibarBar) || null;
             // How many layers show each bar, so deleting one can say what it changes.
             const usedBy: Record<string, number> = {};
             for (const layout of ((system.data as any).layouts || [])) {
               for (const layer of (layout.layers || [])) {
                 if (layer.type === 'omnibar' && layer.config?.bar) usedBy[layer.config.bar] = (usedBy[layer.config.bar] || 0) + 1;
               }
             }
             return (
             <>
             <OmnibarBarPicker
                main={system.data.omnibar}
                bars={bars}
                selected={bar ? bar.id : 'main'}
                onSelect={setOmnibarBar}
                setOmnibars={system.actions.setOmnibars}
                usedBy={usedBy}
                t={t}
             />
             <OmnibarView
                /* A different bar is a different screen's worth of open rows and drafts. */
                key={bar ? bar.id : 'main'}
                barId={bar?.id}
                config={bar || system.data.omnibar}
                stats={(system.data as any).stats}
                setOmnibar={bar
                  ? (next: any) => system.actions.setOmnibars(bars.map((b) => (b.id === bar.id ? { ...next, id: b.id, name: b.name } : b)))
                  : system.actions.setOmnibar}
                tags={system.data.streamTags}
                leaderboard={system.data.leaderboard}
                track={system.spotify.state.track}
                upNext={system.spotify.state.upNext}
                countdown={system.data.countdown}
                commands={system.data.commands}
                subscribers={(system.data as any).subscribers}
                events={(system.data as any).viewerEvents}
                listAssets={system.actions.listAssets}
                uploadAsset={system.actions.uploadAsset}
                activeTheme={activeTheme}
                t={t}
             />
             </>
             );
           })()}

           {view === 'alerts' && (
             <AlertsView
                alerts={system.data.alertConfigs}
                saveAlert={system.actions.saveAlertConfig}
                deleteAlert={system.actions.deleteAlert}
                testAlert={system.actions.testAlert}
                alertGate={(system.data as any).alertGate}
                alertControl={(system.actions as any).alertControl}
                rewards={system.connections.availableRewards}
                fetchRewards={system.actions.fetchTwitchRewards}
                uploadAsset={system.actions.uploadAsset}
                activeTheme={activeTheme}
                t={t}
             />
           )}

           {view === 'pixel-avatars' && (
             <PixelAvatarsView
               avatars={(system.data as any).pixelAvatars || []}
               request={(system.actions as any).pixelAvatars}
               listAssets={system.actions.listAssets}
               uploadAsset={system.actions.uploadAsset}
               t={t}
             />
           )}

           {view === 'library' && (
             <LibraryView
               layouts={(system.data as any).layouts || []}
               setLayouts={system.actions.setLayouts}
               system={system}
               t={t}
             />
           )}

           {view === 'layouts' && (
             <LayoutsView
                listAssets={system.actions.listAssets}
                uploadAsset={system.actions.uploadAsset}
                layouts={(system.data as any).layouts || []}
                setLayouts={system.actions.setLayouts}
                system={system}
                obsScenes={(system.connections.obsData?.scenes || []).map((s: any) => s.sceneName).filter(Boolean)}
                obsCurrentScene={system.connections.obsData?.currentScene || ''}
                obsConnected={system.status.obs === 'connected'}
                activeTheme={activeTheme}
                t={t}
             />
           )}

           {view === 'dock-actions' && (
             <DockActionsView
                pixelAvatars={(system.data as any).pixelAvatars || []}
                dockButtons={system.data.dockButtons}
                streamActions={system.data.streamActions}
                setDockButtons={system.actions.setDockButtons}
                dockGrid={system.data.dockGrid}
                setDockGrid={system.actions.setDockGrid}
                runDockAction={system.actions.runDockAction}
                stats={(system.data as any).stats}
                listAssets={system.actions.listAssets}
                uploadAsset={system.actions.uploadAsset}
                activeTheme={activeTheme}
                t={t}
             />
           )}

           {view === 'spotify-overlay' && (
             <SpotifyOverlayView
                activeTheme={activeTheme}
                t={t}
                spotify={system.spotify}
             />
           )}

           {view === 'levels' && (
             <LevelsView 
                activeTheme={activeTheme}
                t={t}
                system={system}
             />
           )}

           {view === 'gallery' && (
              <ConnectionsView
                droidcamSettings={(system.connections as any).droidcam}
                droidcamProbe={(system.actions as any).droidcamProbe}
                setDroidcamSettings={(system.actions as any).setDroidcamSettings}
                youtube={(system as any).youtube}
                youtubeStatus={(system.status as any).youtube}
                youtubeClientId={(system.connections as any).youtubeClientId}
                youtubeHasSecret={(system.connections as any).youtubeHasSecret}
                youtubeAuthorised={(system.connections as any).youtubeAuthorised}
                youtubeCanEdit={(system.connections as any).youtubeCanEdit}
                youtubeHealth={(system.connections as any).youtubeHealth}
                youtubeLastMessageAt={lastYoutubeMessageAt(system.data.chatMessages)}
                youtubeChannel={(system.connections as any).youtubeChannel}
                twitchUser={system.connections.twitchUser}
                twitchStatus={system.status.twitch}
                handleTwitchLogin={system.actions.handleTwitchLogin}
                handleTwitchConnect={system.actions.handleTwitchConnect}
                handleTwitchLogout={system.actions.handleTwitchLogout}
                twitchBotUser={system.connections.twitchBotUser}
                twitchBotStatus={system.status.twitchBot}
                handleTwitchBotConnect={system.actions.handleTwitchBotConnect}
                handleTwitchBotLogout={system.actions.handleTwitchBotLogout}
                tiktokUrl={system.connections.tiktokUrl}
                setTiktokUrl={system.actions.setTiktokUrl}
                tiktokProxyUrl={system.connections.tiktokProxyUrl}
                setProxyUrl={system.actions.setTiktokProxyUrl}
                tiktokStatus={system.status.tiktok}
                handleTikTokConnect={system.actions.handleTikTokConnect}
                tiktokError={system.status.tiktokError}
                tiktokWatch={(system.status as any).tiktokWatch}
                
                // Discord Props
                discordToken={system.connections.discordToken}
                setDiscordToken={system.actions.setDiscordToken}
                discordChannelId={system.connections.discordChannelId}
                setDiscordChannelId={system.actions.setDiscordChannelId}
                discordStatus={system.status.discord}
                connectDiscord={system.actions.connectDiscord}
                disconnectDiscord={system.actions.disconnectDiscord}
                discordUser={system.connections.discordUser}
                
                // Passed from useDiscord hook via useStreamSystem
                guilds={system.connections.discordGuilds} 
                channels={system.connections.discordChannels}
                fetchChannels={system.actions.fetchDiscordChannels}
                // NEW: Connect specific channel
                handleDiscordConnect={system.actions.connectDiscordChannel}
                discordCommandsEverywhere={(system.connections as any).discordCommandsEverywhere !== false}
                setDiscordCommandsEverywhere={(system.actions as any).setDiscordCommandsEverywhere}
                discordGuildId={system.connections.discordGuildId}
                setDiscordGuildId={system.actions.setDiscordGuildId}

                relayConfig={system.settings.relayConfig}
                setRelayConfig={system.settings.setRelayConfig}

                obsStatus={system.status.obs}
                obsHost={system.connections.obsHost}
                setObsHost={system.actions.setObsHost}
                obsPort={system.connections.obsPort}
                setObsPort={system.actions.setObsPort}
                obsPassword={system.connections.obsPassword}
                setObsPassword={system.actions.setObsPassword}
                handleObsConnect={system.actions.handleObsConnect}
                obsData={system.connections.obsData}
                obsError={system.status.obsError}
                hasInsecureBlocked={hasInsecureBlocked}
                setInsecureAcknowledgeMode={setInsecureAcknowledgeMode}
                setShowInsecureModal={setShowInsecureModal}
                
                spotify={system.spotify}
                spotifyClientId={system.connections.spotifyClientId}
                setSpotifyClientId={system.actions.setSpotifyClientId}
                spotifyClientSecret={system.connections.spotifyClientSecret}
                setSpotifyClientSecret={system.actions.setSpotifyClientSecret}
                spotifyHasSecret={system.connections.spotifyHasSecret}
                discordBotToken={system.connections.discordBotToken} setDiscordBotToken={system.actions.setDiscordBotToken}
                discordHasBotToken={system.connections.discordHasBotToken}
                discordClientSecret={system.connections.discordClientSecret} setDiscordClientSecret={system.actions.setDiscordClientSecret}
                discordHasClientSecret={system.connections.discordHasClientSecret}
                tiktokSignKey={system.connections.tiktokSignKey} setTiktokSignKey={system.actions.setTiktokSignKey}
                tiktokHasSignKey={system.connections.tiktokHasSignKey}
                geminiKey={system.connections.geminiKey} setGeminiKey={system.actions.setGeminiKey}
                hasGeminiKey={system.connections.hasGeminiKey}

                twitchClientId={system.connections.twitchClientId}
                setTwitchClientId={system.actions.setTwitchClientId}

                activeTheme={activeTheme}
                t={t}
              />
           )}
           
           {view === 'questions' && (
              <QuestionsView
                questions={(system.data as any).questions || { items: [], showingId: '' }}
                settings={(system.data as any).questionSettings}
                setStatus={system.actions.setQuestionStatus}
                show={system.actions.showQuestion}
                clear={system.actions.clearQuestions}
                control={system.actions.questions}
                fromDiscord={(system.data as any).discordQuestions}
                setFromDiscord={(system.actions as any).setDiscordQuestions}
                channels={system.connections.discordChannels || []}
                language={system.settings.language}
                t={t}
              />
            )}

           {view === 'polls' && (
              <PollsView
                settings={(system.data as any).pollSettings}
                history={(system.data as any).pollHistory}
                language={system.settings.language}
                poll={(system.data as any).poll}
                control={(system.actions as any).poll}
                players={(system.data as any).players}
                t={t}
              />
            )}

           {view === 'requests' && (
              <RequestsView state={(system.data as any).gameRequests} control={(system.actions as any).gameRequests} channels={system.connections.discordChannels || []} botConnected={system.status.discord === 'connected'} t={t} />
           )}

           {view === 'streams' && (
              <StreamsView streams={(system.actions as any).streams} t={t} />
           )}

           {view === 'points' && (
              <PointsView
                settings={(system.data as any).pointsSettings}
                control={(system.actions as any).points}
                actions={(system.data.streamActions || []).map((a: any) => ({ id: a.id, name: a.name }))}
                channels={system.connections.discordChannels || []}
                emojis={system.connections.discordEmojis || []}
                botConnected={system.status.discord === 'connected'}
                t={t}
              />
           )}

           {view === 'giveaway' && (
              <GiveawayView
                giveaway={(system.data as any).giveaway}
                settings={(system.data as any).giveawaySettings}
                control={(system.actions as any).giveaway}
                channels={system.connections.discordChannels}
                roles={(system.data as any).discordRoles}
                botConnected={system.status.discord === 'connected'}
                t={t}
              />
            )}

           {view === 'remote-players' && (
              <RemotePlayersView
                remote={(system.data as any).remotePlayers}
                control={(system.actions as any).remotePlayers}
                obsConnected={system.status.obs === 'connected'}
                obsSources={(((system.connections as any)?.obsData?.sources || []) as any[]).map((i) => i.inputName).filter(Boolean)}
                discordConnected={system.status.discord === 'connected'}
                voice={(system.data as any).voice}
                regulars={(system.data as any).people?.regulars || []}
                listServerMembers={system.status.discord === 'connected' ? (system.actions as any).listServerMembers : undefined}
                t={t}
              />
            )}

           {view === 'players' && (
              <PlayersView
                players={(system.data as any).players || { items: [] }}
                setPlayers={(system.actions as any).setPlayers}
                t={t}
              />
            )}

           {/* Two screens, one record: both edit the run the card, the plates and the couch read. */}
           {view === 'run' && (
             <GameView
               run={(system.data as any).run || {}}
               setRun={system.actions.setRun}
               deaths={(system.data as any).counters?.deaths ?? 0}
               changeDeaths={(op, value) => system.actions.counter('deaths', op, value)}
               layouts={(system.data as any).layouts || []}
               t={t}
             />
           )}
           {view === 'people' && (
             <PeopleView
               run={(system.data as any).run || {}}
               setRun={system.actions.setRun}
               layouts={(system.data as any).layouts || []}
               people={(system.data as any).people}
               peopleControl={system.actions.people}
               voice={(system.data as any).voice}
               shoutout={(login: string) => system.actions.twitchExtras({ op: 'shoutout', target: login })}
               t={t}
             />
           )}

           {view === 'plan' && (
              <PlanView
                plan={(system.data as any).plan || { items: [], currentId: '', showDone: true }}
                setPlan={system.actions.setPlan}
                planGoto={system.actions.planGoto}
                saved={(system.data as any).planSaved || []}
                savedControl={system.actions.planSaved}
                searchCategories={system.actions.searchCategories}
                language={system.settings.language}
                t={t}
              />
            )}

           {view === 'assets' && (
              <ChatDockView
                chat={system.settings}
                patchChat={(system.settings as any).patchChat}
                dockUrl={dockUrl}
                twitchStatus={system.status.twitch}
                tiktokStatus={system.status.tiktok}
                chatMessages={system.data.chatMessages}
                senderRole={system.settings.senderRole} setSenderRole={system.settings.setSenderRole}
                sendToPicker={<SendToPicker value={(system.settings as any).sendTo} set={(system.settings as any).setSendTo} authorised={Boolean((system.connections as any).youtubeAuthorised)} live={Boolean((system.connections as any).youtubeLive)} unitsUsed={(system.data as any).stats?.youtubeUnitsUsed} t={t} />}
                twitchBotStatus={system.status.twitchBot}
                twitchUser={system.connections.twitchUser}
                messageInput={messageInput} setMessageInput={setMessageInput}
                handleSendMessage={handleSendMessage}
                renderChatMessageHelper={renderChatMessageHelper}
                setView={setView}
                activeTheme={activeTheme}
                discordStatus={system.status.discord}
                sendError={sendError}
                t={t}
              />
           )}

           {view === 'events' && (
              <EventsDockView
                events={(system.data as any).viewerEvents || []}
                totals={(system.data as any).eventTotals}
                settings={(system.data as any).eventsDockSettings}
                run={system.actions.events}
                shoutout={(login: string) => system.actions.twitchExtras({ op: 'shoutout', target: login })}
                clearHistory={system.actions.clearEventHistory}
                activeTheme={activeTheme}
                language={system.settings.language}
                t={t}
              />
           )}
          {/* Room at the end of every screen for the phone's bar, so it never covers the last of it. */}
          <div className="h-20 md:hidden" aria-hidden data-phone-bar-room />
        </div>
      </main>
      <PhoneBar items={phoneItems} view={view} go={goTo} onMenu={() => setIsMobileMenuOpen(true)} t={t} />
      {searchOpen && <NavSearch entries={searchEntries} go={goTo} onClose={() => setSearchOpen(false)} t={t} />}
    </div>
  );
}
