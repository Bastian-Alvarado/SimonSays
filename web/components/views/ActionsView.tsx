
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ActionStep, ActionStepType, Command, StreamAction, ThemeConfig, TriggerCategory, TriggerType, SingleCondition } from '../../types';
import { Button } from '../Button';
import { GlassWater, Hourglass, MonitorPlay, Target, Activity, Plus, Zap, ArrowRight, Play, Edit2, Trash2, X, RefreshCcw, ToggleRight, ToggleLeft, Monitor, Terminal, GitBranch, Split, Workflow, Smile, Search, Gamepad2, Type, GitMerge, Check, ArrowDown, ChevronDown, Eye, Type as TypeIcon, Heart, Star, Coins, Users, Share2, Gift, Ticket, Radio, Disc, Square, AlertTriangle, Music, SkipForward, SkipBack, Pause, ListPlus, Volume2, VolumeX, Save, Globe, Move, Mic, Sliders, Layers, LayoutGrid, List, ArrowDownAZ, History, Clock, Braces, Camera, Cpu, CalendarDays, Tag, Timer, User, Megaphone, Eraser, Undo2, MessageCircleQuestion, BarChart3, Shirt, Skull, Repeat, Trophy, Headphones, OctagonX, Dices, AlarmClock, CornerDownRight, MessageSquare, TrainFront, Sparkles, Upload, MessageSquareText, Shield } from 'lucide-react';
import { EmojiPicker } from '../EmojiPicker';
import { VariablePicker } from '../VariablePicker';
import { SpotifyIcon } from '../SpotifyPlayer';

/** Mirrors OPERATIONS in server/platforms/droidcam.js. */
const DROIDCAM_OPS = [
  'torch', 'autofocus', 'zoom', 'zoom_in', 'zoom_out', 'camera',
  'focus', 'exposure', 'iso', 'shutter', 'white_balance',
  'autofocus_mode', 'wb_mode', 'exposure_lock', 'exposure_level_lock', 'wb_lock', 'mic',
];

/** The ones whose value box is worth showing. */
const DROIDCAM_OPS_WITH_VALUE = [
  'zoom', 'zoom_in', 'zoom_out', 'camera', 'focus', 'exposure', 'iso',
  'shutter', 'white_balance', 'autofocus_mode', 'wb_mode',
];
import { SortMode, sortForDisplay } from '../../utils';
import { YOUTUBE_CATEGORIES } from '../../../shared/youtube-categories.js';
import { DiscordPicksProvider, useDiscordPicks, textChannels, pingableRoles } from '../DiscordPicks';
import { AVATAR_EXPRESSIONS_LIST, AVATAR_DRESS_WORDS, AVATAR_ACTIONS_LIST } from '../../../shared/avatar.js';
import { REMOTE_SEATS } from '../../../shared/run.js';
import { useDragOrder, DragGrip, DragOrder } from '../../hooks/useDragOrder';
import { CallPersonSelect } from '../CallPersonSelect';
import { fill, refusalWords } from '../../words';
import { cleanChatTrigger, patternError } from '../../../shared/chat-match.js';

const TwitchIcon = ({ size = 24, className = "" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" /></svg>
);
const YouTubeIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
);
const TikTokIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
);
const DiscordIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6034.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
  </svg>
);

/**
 * Platform colour and glyph for a trigger, shared by the card and row layouts
 * so the two cannot drift apart.
 */
const triggerTint = (category?: string) => (
  category === 'twitch' ? 'bg-[#9146FF]'
    : category === 'youtube' ? 'bg-[#FF0000]'
    : category === 'tiktok' ? 'bg-[#ff0050]'
      : category === 'spotify' ? 'bg-[#1DB954]'
        : category === 'obs' ? 'bg-zinc-700'
          : category === 'discord' ? 'bg-[#5865F2]'
          : category === 'chat' ? 'bg-emerald-600'
          : category === 'system' ? 'bg-sky-600'
          : 'bg-current-accent'
);

const TriggerGlyph = ({ category, size }: { category?: string; size: number }) => (
  category === 'twitch' ? <TwitchIcon size={size} />
    : category === 'youtube' ? <YouTubeIcon size={size} />
    : category === 'tiktok' ? <TikTokIcon size={size} />
      : category === 'spotify' ? <SpotifyIcon size={size} />
        : category === 'obs' ? <Monitor size={size} />
          : category === 'discord' ? <DiscordIcon size={size} />
          : category === 'chat' ? <MessageSquare size={size} />
          : category === 'system' ? <Timer size={size} />
          : <Terminal size={size} />
);

/**
 * The overlay steps after the omnibar's, in the order the Overlay menu lists
 * them: the stream plan, then the run card.
 *
 * One table for the menu, the step's heading and which editor it gets, so a
 * step cannot be offered in one and missing from another. `kind` is the
 * editor: one value, a person, which part to empty, an activity to add, or
 * none at all for the two that only move the plan.
 */
const OVERLAY_STEPS: { type: ActionStepType; key: string; label: string; icon: any; kind: 'field' | 'person' | 'clear' | 'plan-add' | 'plan-move' | 'text-layer' | 'goal-change' | 'deaths' | 'timer' | 'countdown' | 'layout-switch' | 'remote-on-screen' | 'question' | 'players' | 'poll' | 'giveaway' | 'avatar-face' | 'avatar-dress' | 'avatar-action' }[] = [
  { type: 'text_layer_set', key: 'textLayerStep', label: 'Text layer', icon: Type, kind: 'text-layer' },
  { type: 'goal_change', key: 'goalStepChange', label: 'Goal: change number', icon: Target, kind: 'goal-change' },
  { type: 'deaths_change', key: 'deathsStepChange', label: 'Deaths: count one', icon: Skull, kind: 'deaths' },
  { type: 'timer_control', key: 'timerStepControl', label: 'Run timer', icon: Timer, kind: 'timer' },
  { type: 'countdown_control', key: 'countdownStepControl', label: 'Countdown', icon: Hourglass, kind: 'countdown' },
  { type: 'layout_switch', key: 'layoutSwitchStep', label: 'Omnilayer: go live with a layout', icon: MonitorPlay, kind: 'layout-switch' },
  { type: 'remote_on_screen', key: 'onScreenStep', label: 'Remote players: whose game is on screen', icon: Gamepad2, kind: 'remote-on-screen' },
  { type: 'question_add', key: 'questionStepAdd', label: 'Questions: add to queue', icon: MessageCircleQuestion, kind: 'question' },
  { type: 'players_join', key: 'playersStepJoin', label: 'Players: join', icon: Users, kind: 'players' },
  { type: 'players_state', key: 'playersStepState', label: 'Players: set in or out', icon: Users, kind: 'players' },
  { type: 'players_remove', key: 'playersStepRemove', label: 'Players: take off the list', icon: Users, kind: 'players' },
  { type: 'players_reset', key: 'playersStepReset', label: 'Players: everyone back in', icon: Users, kind: 'players' },
  { type: 'players_clear', key: 'playersStepClear', label: 'Players: clear the list', icon: Users, kind: 'players' },
  { type: 'poll_open', key: 'pollStepOpen', label: 'Poll: open', icon: BarChart3, kind: 'poll' },
  { type: 'poll_close', key: 'pollStepClose', label: 'Poll: close', icon: BarChart3, kind: 'poll' },
  { type: 'poll_reset', key: 'pollStepReset', label: 'Poll: clear from screen', icon: BarChart3, kind: 'poll' },
  { type: 'giveaway_open', key: 'giveawayStepOpen', label: 'Giveaway: open', icon: Gift, kind: 'giveaway' },
  { type: 'giveaway_close', key: 'giveawayStepClose', label: 'Giveaway: stop entries', icon: Gift, kind: 'giveaway' },
  { type: 'giveaway_draw', key: 'giveawayStepDraw', label: 'Giveaway: draw', icon: Gift, kind: 'giveaway' },
  { type: 'avatar_face', key: 'avatarFaceStep', label: 'Avatar: show a face', icon: Smile, kind: 'avatar-face' },
  { type: 'avatar_dress', key: 'avatarDressStep', label: 'Avatar: dress up', icon: Shirt, kind: 'avatar-dress' },
  { type: 'avatar_action', key: 'avatarActionStep', label: 'Avatar: do something', icon: GlassWater, kind: 'avatar-action' },
  { type: 'plan_add', key: 'planStepAdd', label: 'Plan: add activity', icon: ListPlus, kind: 'plan-add' },
  { type: 'plan_next', key: 'planStepNext', label: 'Plan: complete current', icon: Check, kind: 'plan-move' },
  { type: 'plan_back', key: 'planStepBack', label: 'Plan: go back', icon: Undo2, kind: 'plan-move' },
  { type: 'run_set_game', key: 'runStepGame', label: 'Run card: game', icon: Gamepad2, kind: 'field' },
  { type: 'run_set_platform', key: 'runStepPlatform', label: 'Run card: platform', icon: Cpu, kind: 'field' },
  { type: 'run_set_year', key: 'runStepYear', label: 'Run card: year', icon: CalendarDays, kind: 'field' },
  { type: 'run_set_category', key: 'runStepCategory', label: 'Run card: category', icon: Tag, kind: 'field' },
  { type: 'run_set_estimate', key: 'runStepEstimate', label: 'Run card: estimate', icon: Timer, kind: 'field' },
  { type: 'run_set_runner', key: 'runStepRunner', label: 'Run card: runner', icon: User, kind: 'person' },
  { type: 'run_set_host', key: 'runStepHost', label: 'Run card: host', icon: Megaphone, kind: 'person' },
  { type: 'run_set_commentator', key: 'runStepCommentator', label: 'Run card: commentator', icon: Users, kind: 'person' },
  { type: 'run_clear', key: 'runStepClear', label: 'Run card: clear', icon: Eraser, kind: 'clear' },
];
const overlayStep = (type: string) => OVERLAY_STEPS.find((s) => s.type === type);

/** Steps that change what the overlay shows, which the Overlay menu and filter gather. */
const isOverlayStep = (type: string) => type === 'omnibar_set' || type === 'text_layer_set' || type === 'goal_change' || type === 'deaths_change' || type === 'timer_control' || type === 'countdown_control' || type === 'layout_switch' || type === 'remote_on_screen' || type === 'question_add' || type.startsWith('players_') || type.startsWith('poll_') || type.startsWith('run_') || type.startsWith('plan_');

/** A layout as the text layer step needs it: its name, and its text layers — and the scene type it fills. */
type LayoutRef = { id: string; name?: string; sceneType?: string; layers?: { uid: string; type: string; config?: { text?: string } }[] };

/** A scene type, as the layout step and trigger name one (server/engine/scene-types.js). */
type SceneTypeRef = { id: string; name: string };

/** A goal slot as the goal step lists it: which bar it is on, and what it counts. */
type GoalSlotRef = { id: string; bar: string; name: string; source: string };
/** A saved countdown, as the Countdown step and trigger pick one. */
type CountdownPresetRef = { id: string; name: string };

/** The Logic menu's steps, Trigger Action aside: it chains to another action, and keeps its own plain chip. */
const LOGIC_STEPS = new Set(['condition', 'wait', 'stop', 'repeat', 'random_pick', 'random_choice', 'later', 'web_request']);

/** A list of steps the menus add into instead of the action's own: a step holding steps, and which of its lists. */
type AddTarget = { parentId: string; branch: 'then' | 'else' };

/**
 * Flow filters, keyed by what a step actually talks to rather than by what
 * triggers the action — "show me everything that touches OBS" is the question
 * being asked, and 11 of 12 actions here are command-triggered anyway, so
 * filtering on the trigger would sort almost nothing.
 */
const FLOW_FILTERS: { id: string; label: string; match: (type: string) => boolean; tint: string }[] = [
  { id: 'twitch', label: 'Twitch', match: (t) => t.startsWith('twitch_'), tint: 'border-[#9146FF] bg-[#9146FF]/10 text-[#9146FF]' },
  { id: 'obs', label: 'OBS', match: (t) => t.startsWith('obs_'), tint: 'border-zinc-400 bg-zinc-400/10 text-zinc-200' },
  { id: 'spotify', label: 'Spotify', match: (t) => t.startsWith('spotify_'), tint: 'border-[#1DB954] bg-[#1DB954]/10 text-[#1DB954]' },
  { id: 'discord', label: 'Discord', match: (t) => t.startsWith('discord_'), tint: 'border-[#5865F2] bg-[#5865F2]/10 text-[#5865F2]' },
  { id: 'tts', label: 'TTS', match: (t) => t.startsWith('browser_'), tint: 'border-current-accent bg-current-accent/10 text-current-accent' },
  { id: 'logic', label: 'Logic', match: (t) => t === 'trigger_action' || LOGIC_STEPS.has(t), tint: 'border-amber-500 bg-amber-500/10 text-amber-500' },
  { id: 'overlay', label: 'Overlay', match: isOverlayStep, tint: 'border-sky-400 bg-sky-400/10 text-sky-400' },
];

/**
 * Every step type an action uses, descending into condition branches.
 *
 * The branches are where the real work usually sits: an action whose only
 * top-level step is a condition would otherwise look as though it does
 * nothing at all, and would vanish from every filter.
 */
const collectStepTypes = (steps: any[] | undefined, out: Set<string> = new Set<string>()): Set<string> => {
  for (const step of steps || []) {
    if (!step) continue;
    if (step.type) out.add(step.type);
    collectStepTypes(step.thenActions, out);
    collectStepTypes(step.elseActions, out);
  }
  return out;
};

/** One step rendered as a compact chip. Conditions and the other Logic steps get their own colour. */
const stepChipLabel = (type: string) => (
  LOGIC_STEPS.has(type) ? 'Logic' : type.startsWith('browser_') ? 'TTS' : type.split('_')[0]
);

/**
 * A step chip wears the colour of whatever it talks to, so a row can be read
 * at a glance: an action that posts to Discord and one that changes the stream
 * title no longer look identical until you read the words.
 *
 * Keyed by the chip's own label rather than by step type, which keeps the
 * colour and the word it tints in step with each other. Platform values match
 * the flow filters above and the brand colours used elsewhere in the app.
 *
 * The two that are deliberately not branded:
 *   trigger — chaining to another action is plumbing, not a platform, and it
 *             appears in long runs where colour would be noise
 *   obs     — OBS has no colour of its own, and a bright one here would
 *             outshout the platforms that do
 */
const STEP_CHIP_TINTS: Record<string, string> = {
  twitch: 'bg-[#9146FF]/10 border-[#9146FF]/30 text-[#9146FF]',
  discord: 'bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2]',
  spotify: 'bg-[#1DB954]/10 border-[#1DB954]/30 text-[#1DB954]',
  tiktok: 'bg-[#ff0050]/10 border-[#ff0050]/30 text-[#ff0050]',
  TTS: 'bg-current-accent/10 border-current-accent/30 text-current-accent',
  Logic: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
  obs: 'bg-zinc-700/40 border-zinc-600 text-zinc-300',
  trigger: 'bg-zinc-800 border-zinc-700 text-zinc-400',
};

const stepChipClass = (type: string) => (
  STEP_CHIP_TINTS[stepChipLabel(type)] ?? 'bg-zinc-800 border-zinc-700 text-zinc-400'
);

// Helper for Action Flow buttons
const ActionCategoryDropdown = ({
    id, 
    label, 
    icon: Icon, 
    colorClass, 
    items,
    activeDropdown,
    setActiveDropdown,
    scrollContainerRef 
}: any) => {
    const isOpen = activeDropdown === id;
    const btnRef = useRef<HTMLButtonElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (isOpen && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            let left = rect.left;
            if (left + 192 > window.innerWidth) {
                left = window.innerWidth - 200;
            }
            
            setCoords({
                top: rect.bottom + 8,
                left: left
            });
        }
    }, [isOpen]);

    useEffect(() => {
        const el = scrollContainerRef?.current;
        if (!el) return;
        const handleScroll = () => {
            if (isOpen) setActiveDropdown(null);
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', handleScroll);
        };
    }, [isOpen, scrollContainerRef, setActiveDropdown]);

    return (
        <div className="relative">
            <button 
                ref={btnRef}
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(isOpen ? null : id);
                }} 
                className={`flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold transition-all hover:bg-zinc-800 ${isOpen ? 'ring-2 ring-opacity-50 ' + colorClass.replace('text-', 'ring-') : ''}`}
            >
                <Icon size={14} className={colorClass} /> <span className="text-zinc-300">{label}</span> <ChevronDown size={12} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && createPortal(
                <div 
                    className="fixed w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-[9999] overflow-hidden animate-slide-up max-h-60 overflow-y-auto"
                    style={{ top: coords.top, left: coords.left }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {items.map((item: any, idx: number) => (
                        <button key={idx} onClick={(e) => { e.stopPropagation(); item.onClick(); setActiveDropdown(null); }} className="w-full text-left px-4 py-2.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 transition-colors border-b border-zinc-800/50 last:border-none">
                            {item.icon && <item.icon size={12} className="opacity-70" />} {item.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

/*
  The trigger's two pickers. Out here, not inside the screen: a component
  declared inside another's render is a new component every render, so React
  threw the open list away and built it again — the slide-in replayed and the
  scroll went back to the top whenever anything on the screen changed, which
  with live data arriving and the pointer moving was all the time.
*/
type PickOption = { value: string; label: string; icon: any; color?: string };
const SelectionDropdown = ({ id, selected, options, onSelect, colorClass, activeDropdown, setActiveDropdown }: {
  id: string;
  selected: PickOption;
  options: PickOption[];
  onSelect: (val: string) => void;
  colorClass: string;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
}) => {
  const isOpen = activeDropdown === id;
  const Icon = selected.icon;
  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()} data-trigger-picker={id}>
      <button
        onClick={() => setActiveDropdown(isOpen ? null : id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold transition-all hover:bg-zinc-800 ${isOpen ? 'ring-2 ring-opacity-50 ' + colorClass.replace('text-', 'ring-') : ''}`}
      >
        <div className="flex items-center gap-3">
          <Icon size={16} className={colorClass} />
          <span className="text-zinc-300">{selected.label}</span>
        </div>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden animate-slide-up max-h-60 overflow-y-auto" data-trigger-options>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); setActiveDropdown(null); }}
              className={`w-full text-left px-4 py-2.5 text-[11px] font-medium hover:bg-zinc-800 flex items-center gap-3 transition-colors border-b border-zinc-800/50 last:border-none ${opt.value === selected.value ? 'bg-white/5 text-white' : 'text-zinc-400'}`}
            >
              <opt.icon size={14} className={opt.color || 'opacity-70'} />
              {opt.label}
              {opt.value === selected.value && <Check size={12} className="ml-auto text-current-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface StepRendererProps {
  /** What the pixel avatars drawn in the Pixel avatars tab can do, for the "Avatar: do something" step. */
  avatarActions?: string[];
  /** Omnibar text slots, for the slot picker on an omnibar_set step. */
  omnibarSlots?: { id: string; name?: string; label: string; text: string }[];
  /** Layouts, for the text layer step's layout and layer pickers. */
  layouts?: LayoutRef[];
  /** Every goal slot on every bar, for the goal step's picker. */
  goalSlots?: GoalSlotRef[];
  /** The saved countdowns, for the Countdown step's picker. */
  countdownPresets?: CountdownPresetRef[];
  /** The scene types, for the Omnilayer step. */
  sceneTypes?: SceneTypeRef[];
  /** Who is in each remote player seat, first seat first, for the player on screen step. */
  seatNames?: string[];
  step: ActionStep;
  index: number;
  t: any;
  obsData: any;
  streamActions: StreamAction[];
  removeActionStep: (stepId: string) => void;
  /** The list this step sits in, for its grip; and the move a drop in any list makes. */
  order?: DragOrder;
  moveActionStep?: (stepId: string, gap: number) => void;
  updateActionStepConfig: (stepId: string, key: string, value: any) => void;
  addActionStep: (type: ActionStepType, parentId?: string, branch?: 'then' | 'else') => void;
  onOpenPicker: (stepId: string, field: string, e: React.MouseEvent) => void;
  searchCategories: (query: string) => Promise<any[]>;
  /** The list the step menus add into, when it is not the action's own, and how a list asks to be it. */
  addInto?: AddTarget | null;
  onAddInto?: (target: AddTarget | null) => void;
  /** A random choice: the weights of it and its neighbours together, for its chance in percent. */
  choiceTotal?: number;
  /** Uploads a file to the server's media, for the Play a sound step. */
  uploadAsset?: (file: File) => Promise<any>;
}

/**
 * The "send as the bot" step: a channel, a message with an optional role ping,
 * and an optional card. Only the pings written here go out — a viewer's
 * "@everyone" arriving through {message} is just text.
 */
const DiscordSendStep = ({ step, update, onOpenPicker, t }: { step: ActionStep; update: (key: string, value: any) => void; onOpenPicker: (stepId: string, field: string, e: React.MouseEvent) => void; t: any }) => {
  const { channels, roles } = useDiscordPicks();
  const c = step.config as any;
  const box = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white focus:border-current-accent outline-none';
  const tag = 'text-[10px] font-black uppercase tracking-widest text-zinc-500';
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className={tag}>{t.discordSendChannel || 'Channel'}</label>
        <select value={c.channelId || ''} onChange={(e) => update('channelId', e.target.value)} className={box}>
          <option value="">{t.discordSendPickChannel || 'Choose a channel'}</option>
          {textChannels(channels).map((ch) => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className={tag}>{t.messageContent}</label>
          <select
            value="" onChange={(e) => { if (e.target.value) update('message', `${c.message || ''}${c.message ? ' ' : ''}${e.target.value === 'everyone' ? '@everyone' : `<@&${e.target.value}>`}`); }}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-400"
          >
            <option value="">{t.discordSendPing || '+ Ping a role'}</option>
            <option value="everyone">@everyone</option>
            {pingableRoles(roles).map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <textarea value={c.message || ''} onChange={(e) => update('message', e.target.value)} className={`${box} h-16 resize-none pr-8`} />
          <button onClick={(e) => onOpenPicker(step.id, 'message', e)} className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-white"><Smile size={12} /></button>
        </div>
        <p className="text-[9px] text-zinc-500 font-medium ml-1">{t.discordSendHint || 'Variables like {user} and {message} work. Only the pings written here go out — a viewer typing @everyone into a command cannot ping anybody.'}</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={c.card === true} onChange={(e) => update('card', e.target.checked)} className="accent-current-accent" />
        <span className="text-[10px] text-zinc-400">{t.discordSendCard || 'Add a card'}</span>
      </label>
      {c.card && (
        <div className="grid grid-cols-2 gap-2">
          <input value={c.cardTitle || ''} onChange={(e) => update('cardTitle', e.target.value)} placeholder={t.discordSendCardTitle || 'Card title'} className={`${box} col-span-2`} />
          <textarea value={c.cardDescription || ''} onChange={(e) => update('cardDescription', e.target.value)} placeholder={t.discordSendCardText || 'Card text'} className={`${box} col-span-2 h-14 resize-none`} />
          <input value={c.cardImage || ''} onChange={(e) => update('cardImage', e.target.value)} placeholder={t.discordSendCardImage || 'Picture URL (optional)'} className={box} />
          <input value={c.cardUrl || ''} onChange={(e) => update('cardUrl', e.target.value)} placeholder={t.discordSendCardLink || 'Title link (optional)'} className={box} />
          <label className="flex items-center gap-2">
            <input type="color" value={c.cardColor || '#5865f2'} onChange={(e) => update('cardColor', e.target.value)} className="w-7 h-7 bg-transparent border border-zinc-800 rounded cursor-pointer" />
            <span className="text-[10px] text-zinc-500">{t.discordSendCardColour || 'Card colour'}</span>
          </label>
        </div>
      )}
    </div>
  );
};

/**
 * On, off, or the other one from what it is now — for the OBS steps that
 * switch something: a filter, a source, a sound.
 *
 * `value` is the step's saved choice. Nothing saved shows as on, which is
 * what the server does with it too (normaliseAction writes it in). Toggle is
 * asked of OBS at the time, so one command can do both — a !blur that
 * unblurs as well.
 */
const OnOffChoice = ({ value, set, on, off, onTone, offTone, t }: {
  value: any; set: (v: boolean | 'toggle') => void;
  on: React.ReactNode; off: React.ReactNode;
  /** Which colour each side lights: on is usually green, but Mute is the red one. */
  onTone: 'green' | 'red'; offTone: 'green' | 'red'; t: any;
}) => {
  const now: boolean | 'toggle' = value === 'toggle' ? 'toggle' : value !== false;
  const tone = { green: 'bg-green-500/10 border-green-500 text-green-500', red: 'bg-red-500/10 border-red-500 text-red-500' };
  const idle = 'bg-zinc-950 border-zinc-800 text-zinc-500';
  const button = 'flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all';
  return (
    <div className="space-y-1.5" data-on-off>
      <div className="flex gap-2">
        <button onClick={() => set(true)} className={`${button} ${now === true ? tone[onTone] : idle}`} data-on-off-choice="on">{on}</button>
        <button onClick={() => set(false)} className={`${button} ${now === false ? tone[offTone] : idle}`} data-on-off-choice="off">{off}</button>
        <button onClick={() => set('toggle')} className={`${button} ${now === 'toggle' ? 'bg-current-accent/10 border-current-accent text-current-accent' : idle}`} data-on-off-choice="toggle">
          <Repeat size={12} className="inline mr-1" />{t.obsToggle || 'Toggle'}
        </button>
      </div>
      {now === 'toggle' && (
        <p className="text-[9px] text-zinc-600 leading-relaxed">{t.obsToggleHint || 'Turns it on if it is off and off if it is on, so one command does both.'}</p>
      )}
    </div>
  );
};

/**
 * Which layout a step or trigger means: a scene type — whichever layout is
 * that type in the overlay profile that is on, so the same command works in
 * every profile — or one layout by name, as before.
 *
 * Says what the type comes to in the profile that is on, warns when nothing
 * there is that type, and offers the type when the layout picked has one.
 */
const LayoutTarget = ({ sceneType, layoutId, types, layouts, anyLabel, set, className, t }: {
  sceneType?: string; layoutId?: string; types: SceneTypeRef[]; layouts?: LayoutRef[];
  /** The empty choice: "Pick one…" for a step, "Any layout" for a trigger. */
  anyLabel: string;
  set: (patch: { sceneType?: string; layoutId?: string }) => void;
  className: string; t: any;
}) => {
  const value = sceneType ? `type:${sceneType}` : (layoutId || '');
  const type = sceneType ? types.find((x) => x.id === sceneType) : undefined;
  const filled = sceneType ? (layouts || []).find((l) => l.sceneType === sceneType) : undefined;
  const picked = !sceneType && layoutId ? (layouts || []).find((l) => l.id === layoutId) : undefined;
  const pickedType = picked?.sceneType ? types.find((x) => x.id === picked.sceneType) : undefined;
  return (
    <div className="space-y-1" data-layout-target>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v.startsWith('type:')) set({ sceneType: v.slice(5) });
          else set({ sceneType: '', layoutId: v });
        }}
        className={className}
      >
        <option value="">{anyLabel}</option>
        {sceneType && !type && <option value={value}>{t.sceneTypeGone || 'A scene type that was deleted'}</option>}
        {types.length > 0 && (
          <optgroup label={t.sceneTypeGroup || 'Scene type — the same in every profile'}>
            {types.map((x) => <option key={x.id} value={`type:${x.id}`}>{x.name}</option>)}
          </optgroup>
        )}
        <optgroup label={t.layoutOneGroup || 'One layout'}>
          {(layouts || []).map((l) => <option key={l.id} value={l.id}>{l.name || l.id}</option>)}
        </optgroup>
      </select>
      {type && filled && (
        <p className="text-[9px] text-zinc-600" data-layout-target-now>{fill(t.sceneTypeNow || 'In the profile that is on: {layout}.', { layout: filled.name || filled.id })}</p>
      )}
      {type && !filled && (
        <p className="text-[9px] text-amber-500/80" data-layout-target-empty>{fill(t.sceneTypeEmpty || 'No layout in the profile that is on is “{type}” yet, so this does nothing there until one is.', { type: type.name })}</p>
      )}
      {pickedType && (
        <button onClick={() => set({ sceneType: pickedType.id })} className="text-left text-[9px] text-current-accent hover:underline" data-use-type>
          {fill(t.sceneTypeUse || 'This layout is the “{type}” type. Use the type instead, so this works in every profile.', { type: pickedType.name })}
        </button>
      )}
    </div>
  );
};

const StepRenderer: React.FC<StepRendererProps> = (props) => {
  const {
  avatarActions = [],
  omnibarSlots,
  layouts,
  goalSlots,
  countdownPresets,
  sceneTypes = [],
  seatNames = [],
  step,
  index,
  t,
  obsData,
  streamActions,
  removeActionStep,
  order,
  moveActionStep,
  updateActionStepConfig,
  addActionStep,
  onOpenPicker,
  searchCategories,
  addInto,
  onAddInto,
  choiceTotal,
  } = props;
     const [gameQuery, setGameQuery] = useState('');
     // Why a Play a sound step's upload did not take, said under the field.
     const [uploadError, setUploadError] = useState('');
     // A condition's then and else are lists of their own: a step is dragged among its own neighbours.
     const thenOrder = useDragOrder(({ id, gap }) => moveActionStep?.(id, gap));
     const elseOrder = useDragOrder(({ id, gap }) => moveActionStep?.(id, gap));
     const stepGrip = order && <DragGrip grip={order.grip(step.id)} title={t.actionStepDrag || 'Drag to change when this step runs'} className="-m-1" />;
     const [gameResults, setGameResults] = useState<any[]>([]);
     const [isSearching, setIsSearching] = useState(false);
     const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

     useEffect(() => {
         if (step.type === 'browser_tts') {
             const loadVoices = () => {
                 const vs = window.speechSynthesis.getVoices();
                 setVoices(vs);
             };
             loadVoices();
             window.speechSynthesis.onvoiceschanged = loadVoices;
             return () => { window.speechSynthesis.onvoiceschanged = null; };
         }
     }, [step.type]);

     const handleSearch = async () => {
         if (!gameQuery) return;
         setIsSearching(true);
         const results = await searchCategories(gameQuery);
         setGameResults(results);
         setIsSearching(false);
     };

     const updateCondition = (conditionId: string, field: keyof SingleCondition, value: string) => {
         const currentLogic = step.config.logic || { conditions: [] };
         const currentConditions = currentLogic.conditions || [];
         
         const newConditions = currentConditions.map(c => 
             c.id === conditionId ? { ...c, [field]: value } : c
         );
         
         updateActionStepConfig(step.id, 'logic.conditions', newConditions);
     };

     const addCondition = () => {
         const currentLogic = step.config.logic || { conditions: [] };
         const currentConditions = currentLogic.conditions || [];
         
         const newCondition: SingleCondition = {
             id: Math.random().toString(36).substr(2, 9),
             variable: 'user.isSub',
             operator: 'isTrue',
             value: ''
         };
         
         updateActionStepConfig(step.id, 'logic.conditions', [...currentConditions, newCondition]);
     };

     const removeCondition = (conditionId: string) => {
         const currentLogic = step.config.logic || { conditions: [] };
         const currentConditions = currentLogic.conditions || [];
         const newConditions = currentConditions.filter(c => c.id !== conditionId);
         
         updateActionStepConfig(step.id, 'logic.conditions', newConditions);
     };

     /*
       A list of steps inside a step: a condition's then and else, and the one
       list in a repeat, a later and a random choice. Each can be the list the
       step menus add into — the button under it asks — so anything the menus
       offer can go inside, where a condition's quick buttons only ever had
       chat, speech and a scene.
     */
     const innerList = (list: ActionStep[] | undefined, ord: DragOrder, branch: 'then' | 'else' = 'then', extra: Partial<StepRendererProps> = { choiceTotal: undefined }, canAdd = true) => {
         const here = addInto?.parentId === step.id && addInto?.branch === branch;
         return (
             <div ref={ord.listRef} data-step-list={`${step.id}:${branch}`} className={`relative space-y-3 pl-2 rounded-xl ${here ? 'ring-2 ring-amber-500/60 ring-offset-4 ring-offset-zinc-950' : ''}`}>
                 {ord.line}
                 {list?.map((subStep, i) => (<StepRenderer {...props} {...extra} key={subStep.id} step={subStep} index={i} order={ord} />))}
                 {(!list || list.length === 0) && <div className="text-[9px] text-zinc-600 italic p-3 border border-dashed border-zinc-800 rounded-xl text-center">{t.noActionsDefined}</div>}
                 {canAdd && onAddInto && (
                     <button onClick={() => onAddInto(here ? null : { parentId: step.id, branch })} data-add-here={`${step.id}:${branch}`} className={`w-full py-1.5 rounded-xl border border-dashed text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${here ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-zinc-800 text-zinc-500 hover:border-amber-500 hover:text-amber-500'}`}>
                         <CornerDownRight size={12} /> {here ? (t.addingHere || 'The menus above add steps here') : (t.addStepsHere || 'Add steps here')}
                     </button>
                 )}
             </div>
         );
     };

     // The Logic steps' own card: the condition's look, its icon and its name.
     const logicCard = (Icon: any, title: string, body: React.ReactNode) => (
         <div {...order?.row(step.id)} data-logic-step={step.type} className={`bg-zinc-950/40 rounded-3xl border border-zinc-800 relative group animate-slide-up ml-4 mb-4 overflow-hidden ${order?.held === step.id ? 'opacity-40' : ''}`}>
             <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                 <button onClick={() => removeActionStep(step.id)} className="text-zinc-600 hover:text-red-500 bg-zinc-900 rounded-full p-1"><X size={14} /></button>
             </div>
             <div className="bg-zinc-900/50 p-3 border-b border-zinc-800 flex items-center gap-2">
                 {stepGrip}
                 <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-amber-500 text-white shadow-lg shadow-amber-500/20"><Icon size={14} /></div>
                 <span className="text-xs font-black uppercase tracking-wider text-zinc-300">{title}</span>
             </div>
             {body}
         </div>
     );
     const logicHint = (text: string) => <p className="text-[9px] text-zinc-500 leading-relaxed">{text}</p>;
     const numberField = (key: string, label: string, value: any, min: number, max: number, by = 1) => (
         <label className="flex flex-col gap-1 w-28">
             <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
             <input type="number" min={min} max={max} step={by} value={value ?? ''} data-logic-field={key}
                 onChange={(e) => updateActionStepConfig(step.id, key, e.target.value === '' ? '' : Number(e.target.value))}
                 className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-amber-500" />
         </label>
     );

     if (step.type === 'wait') {
         return logicCard(Hourglass, t.stepWait || 'Wait', (
             <div className="p-4 space-y-2">
                 {numberField('seconds', t.stepWaitSeconds || 'Seconds', step.config.seconds, 0, 600, 0.5)}
                 {logicHint(t.stepWaitHint || 'Holds the action here, then carries on with the next step. Up to 10 minutes: a restart in the middle loses the rest, so for anything longer use Later.')}
             </div>
         ));
     }

     if (step.type === 'stop') {
         return logicCard(OctagonX, t.stepStop || 'Stop here', (
             <div className="p-4">{logicHint(t.stepStopHint || 'The steps after this one do not run. Most useful inside a Condition: not a mod, say so and stop.')}</div>
         ));
     }

     if (step.type === 'repeat') {
         return logicCard(Repeat, t.stepRepeat || 'Repeat', (
             <>
                 <div className="p-4 space-y-2 border-b border-zinc-800">
                     <div className="flex flex-wrap items-end gap-3">
                         {numberField('times', t.stepRepeatTimes || 'Times', step.config.times, 1, 50)}
                         {numberField('waitSeconds', t.stepRepeatGap || 'Seconds between', step.config.waitSeconds, 0, 600, 0.5)}
                     </div>
                     {logicHint(t.stepRepeatHint || 'Runs the steps below this many times, up to 50. {repeat.count} is which time it is, from 1.')}
                 </div>
                 <div className="p-4 bg-amber-900/5">{innerList(step.thenActions, thenOrder)}</div>
             </>
         ));
     }

     if (step.type === 'later') {
         const mode = step.config.mode === 'streamEnd' ? 'streamEnd' : 'after';
         const units: [string, string][] = [['seconds', t.unitSeconds || 'Seconds'], ['minutes', t.unitMinutes || 'Minutes'], ['hours', t.unitHours || 'Hours'], ['days', t.unitDays || 'Days']];
         return logicCard(AlarmClock, t.stepLater || 'Later', (
             <>
                 <div className="p-4 space-y-3 border-b border-zinc-800">
                     <div className="flex w-fit bg-black/40 rounded-lg p-0.5 border border-zinc-700/50">
                         {(['after', 'streamEnd'] as const).map((m) => (
                             <button key={m} onClick={() => updateActionStepConfig(step.id, 'mode', m)} data-later-mode={m} className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${mode === m ? 'bg-amber-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                 {m === 'after' ? (t.stepLaterAfter || 'After a time') : (t.stepLaterStreamEnd || 'When the stream ends')}
                             </button>
                         ))}
                     </div>
                     {mode === 'after' && (
                         <div className="flex flex-wrap items-end gap-3">
                             {numberField('amount', t.stepLaterAmount || 'How long', step.config.amount, 1, 10080)}
                             <label className="flex flex-col gap-1 w-32">
                                 <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.stepLaterUnit || 'Of'}</span>
                                 <select value={step.config.unit || 'minutes'} onChange={(e) => updateActionStepConfig(step.id, 'unit', e.target.value)} data-logic-field="unit" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500">
                                     {units.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                 </select>
                             </label>
                         </div>
                     )}
                     {logicHint(mode === 'after'
                         ? (t.stepLaterHint || 'The action carries on now, and the steps below run on their own when the time is up, up to 7 days, even after a restart. Running this step again starts its wait over. Waiting steps are listed on the Actions screen.')
                         : (t.stepLaterStreamEndHint || 'The steps below run once the stream is over: five minutes after it stops, so a quick restart is not an end. Running this step again replaces the one waiting.'))}
                 </div>
                 <div className="p-4 bg-amber-900/5">{innerList(step.thenActions, thenOrder)}</div>
             </>
         ));
     }

     if (step.type === 'random_pick') {
         const choices = (step.thenActions || []).filter((s) => s.type === 'random_choice');
         const total = choices.reduce((n, c) => n + Math.max(0, Number(c.config.weight ?? 1) || 0), 0);
         return logicCard(Dices, t.stepRandom || 'Pick one at random', (
             <div className="p-4 space-y-3 bg-amber-900/5">
                 {logicHint(t.stepRandomHint || 'One of the choices runs, at random. A choice with weight 2 comes up twice as often as one with 1; 0 never.')}
                 {innerList(step.thenActions, thenOrder, 'then', { choiceTotal: total }, false)}
                 <button onClick={() => addActionStep('random_choice', step.id, 'then')} data-add-choice className="w-full py-2 border border-dashed border-zinc-700 hover:border-amber-500 rounded-xl text-[10px] font-bold text-zinc-500 hover:text-amber-500 flex items-center justify-center gap-1 transition-all">
                     <Plus size={12} /> {t.stepRandomAdd || 'Add a choice'}
                 </button>
             </div>
         ));
     }

     if (step.type === 'random_choice') {
         const weight = Math.max(0, Number(step.config.weight ?? 1) || 0);
         const chance = choiceTotal ? Math.round((weight / choiceTotal) * 100) : 0;
         return (
             <div {...order?.row(step.id)} data-logic-step="random_choice" className={`bg-zinc-900/60 rounded-2xl border border-zinc-800 relative group mb-2 overflow-hidden ${order?.held === step.id ? 'opacity-40' : ''}`}>
                 <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                     <button onClick={() => removeActionStep(step.id)} className="text-zinc-600 hover:text-red-500 bg-zinc-900 rounded-full p-1"><X size={14} /></button>
                 </div>
                 <div className="p-3 pr-10 flex flex-wrap items-center gap-3 border-b border-zinc-800/60">
                     {stepGrip}
                     <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{fill(t.stepRandomChoice || 'Choice {n}', { n: index + 1 })}</span>
                     <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                         {t.stepRandomWeight || 'Weight'}
                         <input type="number" min={0} max={1000} value={step.config.weight ?? ''} data-logic-field="weight"
                             onChange={(e) => updateActionStepConfig(step.id, 'weight', e.target.value === '' ? '' : Number(e.target.value))}
                             className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-white outline-none focus:border-amber-500" />
                     </label>
                     <span className="text-[10px] font-mono text-zinc-400" data-choice-chance>{fill(t.stepRandomChance || '{n}% of the time', { n: chance })}</span>
                 </div>
                 <div className="p-3">{innerList(step.thenActions, thenOrder)}</div>
             </div>
         );
     }

     // A plain step's card, for the steps drawn here rather than in the long list below.
     const plainCard = (Icon: any, title: string, tint: string, body: React.ReactNode) => (
         <div {...order?.row(step.id)} data-plain-step={step.type} className={`bg-zinc-900 rounded-2xl border border-zinc-800 p-4 relative group animate-slide-up mb-2 ${order?.held === step.id ? 'opacity-40' : ''}`}>
             <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"> <button onClick={() => removeActionStep(step.id)} className="text-zinc-600 hover:text-red-500"><X size={16} /></button> </div>
             <div className="flex items-center gap-3 mb-4">
                 {stepGrip}
                 <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${tint}`}><Icon size={14} /></div>
                 <span className="text-xs font-black uppercase tracking-wider text-zinc-300">{title}</span>
             </div>
             <div className="pl-9 space-y-3">{body}</div>
         </div>
     );
     const fieldLabel = "text-[10px] font-black uppercase tracking-widest text-zinc-500";
     const fieldInput = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent";

     /*
       A sound file, played where the alerts' sounds play. Uploaded here like
       an alert's, or any address; tried out in this browser with the button.
     */
     if (step.type === 'play_sound') {
         const url = step.config.soundUrl || '';
         const volume = step.config.soundVolume ?? 1;
         return plainCard(Volume2, t.stepPlaySound || 'Play a sound', 'bg-pink-500 text-white', (
             <>
                 <label className={fieldLabel}>{t.stepPlaySoundFile || 'Sound file'}</label>
                 <div className="flex gap-2">
                     <input className={fieldInput} placeholder={t.alertsUrlPlaceholder || 'https://… or /media/…'} value={url} onChange={(e) => updateActionStepConfig(step.id, 'soundUrl', e.target.value)} data-step-field="soundUrl" />
                     {props.uploadAsset && (
                         <label className="px-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white flex items-center cursor-pointer" title={t.upload || 'Upload'}>
                             <Upload size={13} />
                             <input type="file" accept="audio/*" hidden onChange={async (e) => {
                                 const file = e.target.files?.[0];
                                 e.target.value = '';
                                 if (!file) return;
                                 setUploadError('');
                                 try {
                                     const res = await props.uploadAsset!(file);
                                     const at = res?.url || res?.path || '';
                                     if (at) updateActionStepConfig(step.id, 'soundUrl', at);
                                 } catch (err: any) {
                                     setUploadError(refusalWords(t, err) || t.alertsUploadFailed || 'That file could not be uploaded.');
                                 }
                             }} />
                         </label>
                     )}
                 </div>
                 {uploadError && <p className="text-[9px] text-rose-400" data-sound-upload-error>{uploadError}</p>}
                 {url && (
                     <div className="flex items-center gap-2">
                         <button onClick={() => { const a = new Audio(url); a.volume = volume; a.play().catch(() => {}); }} title={t.alertsPlaySound || 'Play it'} className="p-1.5 rounded-lg text-zinc-400 hover:text-white border border-zinc-800"><Play size={13} /></button>
                         <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => updateActionStepConfig(step.id, 'soundVolume', Number(e.target.value))} className="flex-1 accent-current-accent" data-step-field="soundVolume" />
                         <span className="text-[9px] font-mono text-zinc-500 w-8 text-right">{Math.round(volume * 100)}%</span>
                     </div>
                 )}
                 <p className="text-[9px] text-zinc-500 leading-relaxed">{t.stepPlaySoundHint || 'Plays on the overlay in OBS that shows your alerts, so the stream hears it, or on the dock when no overlay is open. It does not wait for alerts or hold them up.'}</p>
             </>
         ));
     }

     /*
       Ask a web address; the answer is {response} for the steps after it.
     */
     if (step.type === 'web_request') {
         const method = step.config.method === 'POST' ? 'POST' : 'GET';
         return plainCard(Globe, t.stepWebRequest || 'Fetch a web address', 'bg-amber-500 text-white', (
             <>
                 <div className="flex gap-2">
                     <select value={method} onChange={(e) => updateActionStepConfig(step.id, 'method', e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2 text-xs font-mono text-white outline-none" data-step-field="method">
                         <option value="GET">GET</option>
                         <option value="POST">POST</option>
                     </select>
                     <input className={`${fieldInput} font-mono`} placeholder="https://icanhazdadjoke.com/" value={step.config.url || ''} onChange={(e) => updateActionStepConfig(step.id, 'url', e.target.value)} data-step-field="url" />
                 </div>
                 {method === 'POST' && (
                     <>
                         <label className={fieldLabel}>{t.stepWebBody || 'What to send'}</label>
                         <textarea value={step.config.body || ''} onChange={(e) => updateActionStepConfig(step.id, 'body', e.target.value)} placeholder='{"user": "{user}"}' className={`${fieldInput} h-16 resize-none font-mono`} data-step-field="body" />
                     </>
                 )}
                 <label className={fieldLabel}>{t.stepWebHeaders || 'Headers (optional, one per line)'}</label>
                 <textarea value={step.config.headers || ''} onChange={(e) => updateActionStepConfig(step.id, 'headers', e.target.value)} placeholder="Accept: application/json" className={`${fieldInput} h-12 resize-none font-mono`} data-step-field="headers" />
                 <p className="text-[9px] text-zinc-500 leading-relaxed">{t.stepWebRequestHint || 'The steps after this one can use {response}, what came back, and {response.json.name} for one field of a JSON answer. {response.ok} is false when it failed, and {response.error} says why. Words typed into the address, like {input}, are made safe for it. It cannot reach the server itself.'}</p>
             </>
         ));
     }

     if (step.type === 'condition') {
         const logic = step.config.logic || { conditions: [], matchType: 'AND' };
         const conditions = logic.conditions || [];

         return (
             <div {...order?.row(step.id)} className={`bg-zinc-950/40 rounded-3xl border border-zinc-800 p-0 relative group animate-slide-up ml-4 mb-4 overflow-hidden ${order?.held === step.id ? 'opacity-40' : ''}`}>
                 <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"> 
                     <button onClick={() => removeActionStep(step.id)} className="text-zinc-600 hover:text-red-500 bg-zinc-900 rounded-full p-1"><X size={14} /></button> 
                 </div>
                 
                 <div className="bg-zinc-900/50 p-3 border-b border-zinc-800 flex items-center justify-between">
                     <div className="flex items-center gap-2"> 
                         {stepGrip}
                         <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black bg-amber-500 text-white shadow-lg shadow-amber-500/20`}> <Split size={14} /> </div> 
                         <span className="text-xs font-black uppercase tracking-wider text-zinc-300"> {t.condition || 'Logic Gate'} </span> 
                     </div>
                     <div className="flex bg-black/40 rounded-lg p-0.5 border border-zinc-700/50">
                         <button onClick={() => updateActionStepConfig(step.id, 'logic.matchType', 'AND')} className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${logic.matchType !== 'OR' ? 'bg-amber-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>{t.logicMatchAll || 'Match ALL'}</button>
                         <button onClick={() => updateActionStepConfig(step.id, 'logic.matchType', 'OR')} className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${logic.matchType === 'OR' ? 'bg-amber-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>{t.logicMatchAny || 'Match ANY'}</button>
                     </div>
                 </div>
                 
                 <div className="p-4 space-y-2 bg-zinc-900/20">
                     {conditions.map((cond, idx) => (
                         <div key={cond.id} className="flex flex-wrap gap-2 items-center bg-zinc-900 border border-zinc-800 p-2 rounded-xl">
                             <span className="text-[9px] font-mono text-zinc-600 w-4 text-center">{idx + 1}</span>
                             <div className="flex-1 min-w-[120px]">
                                 <select value={cond.variable} onChange={(e) => updateCondition(cond.id, 'variable', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-zinc-300 outline-none focus:border-amber-500">
                                     <optgroup label="User Properties"> <option value="user.isSub">User is Subscriber</option> <option value="user.isMod">User is Moderator</option> <option value="user.isVip">User is VIP</option> <option value="user.isBroadcaster">User is Owner</option> </optgroup>
                                     <optgroup label="Stream State"> <option value="stream.isLive">{t.varStreamLive || 'Stream is Live'}</option> <option value="obs.currentScene">{t.obsCurrentScene || 'OBS Current Scene'}</option> <option value="time.hour">{t.varTimeHour || 'Time (Hour 0-23)'}</option> </optgroup>
                                     <optgroup label="Spotify State"> <option value="spotify.isPlaying">Spotify is Playing</option> <option value="spotify.trackName">Track Name</option> <option value="spotify.artist">Artist Name</option> </optgroup>
                                     <optgroup label="Message Content"> <option value="message.content">Message Body</option> </optgroup>
                                     <optgroup label="Misc"> <option value="random.1-100">Random (1-100)</option> </optgroup>
                                 </select>
                             </div>
                             <div className="min-w-[100px]">
                                 <select value={cond.operator} onChange={(e) => updateCondition(cond.id, 'operator', e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-400 outline-none focus:border-amber-500">
                                     <option value="isTrue">{t.opIsTrue || 'Is True'}</option> <option value="isFalse">{t.opIsFalse || 'Is False'}</option> <option value="equals">{t.opEquals || 'Equals (=)'}</option> <option value="contains">{t.opContains || 'Contains'}</option> <option value="startsWith">{t.opStartsWith || 'Starts With'}</option> <option value="endsWith">{t.opEndsWith || 'Ends With'}</option> <option value="matchesRegex">{t.opRegex || 'Regex Match'}</option> <option value="greaterThan">{t.opGt || 'Greater (>)'}</option> <option value="lessThan">{t.opLt || 'Less (<)'}</option>
                                 </select>
                             </div>
                             {!['isTrue', 'isFalse', 'stream.isLive', 'spotify.isPlaying'].includes(cond.operator) && (
                                 <div className="flex-1 min-w-[100px]">
                                    {cond.variable === 'obs.currentScene' ? (
                                        <select value={cond.value} onChange={(e) => updateCondition(cond.id, 'value', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white outline-none focus:border-amber-500">
                                            <option value="">{t.selectTextSource}</option>
                                            {obsData.scenes.map((s: any) => (<option key={s.sceneName} value={s.sceneName}>{s.sceneName}</option>))}
                                        </select>
                                    ) : (<input type="text" value={cond.value} onChange={(e) => updateCondition(cond.id, 'value', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white outline-none focus:border-amber-500" placeholder={t.value} />)}
                                 </div>
                             )}
                             <button onClick={() => removeCondition(cond.id)} className="text-zinc-600 hover:text-red-500 p-1"><X size={12} /></button>
                         </div>
                     ))}
                     <button onClick={addCondition} className="w-full py-2 border border-dashed border-zinc-700 hover:border-amber-500 rounded-xl text-[10px] font-bold text-zinc-500 hover:text-amber-500 flex items-center justify-center gap-1 transition-all"> <Plus size={12} /> {t.addCondition || 'Add Check'} </button>
                 </div>

                 <div className="flex flex-col border-t border-zinc-800">
                     <div className="p-4 bg-green-900/5 relative">
                         <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                         <div className="flex items-center justify-between mb-3 pl-2">
                            <div className="flex items-center gap-2"> <span className="text-[10px] font-black uppercase text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">{t.then}</span> <ArrowRight size={12} className="text-green-500/50" /> </div>
                            <div className="flex gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                <button onClick={() => addActionStep('twitch_chat', step.id, 'then')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Add Chat"><TwitchIcon size={12}/></button>
                                <button onClick={() => addActionStep('browser_tts', step.id, 'then')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Add TTS"><Mic size={12}/></button>
                                <button onClick={() => addActionStep('obs_scene', step.id, 'then')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Add Scene"><Monitor size={12}/></button>
                            </div>
                         </div>
                         {innerList(step.thenActions, thenOrder, 'then')}
                     </div>
                     <div className="p-4 bg-red-900/5 relative border-t border-zinc-800/50">
                         <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                         <div className="flex items-center justify-between mb-3 pl-2">
                            <div className="flex items-center gap-2"> <span className="text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{t.else}</span> <ArrowRight size={12} className="text-red-500/50" /> </div>
                            <div className="flex gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                <button onClick={() => addActionStep('twitch_chat', step.id, 'else')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Add Chat"><TwitchIcon size={12}/></button>
                                <button onClick={() => addActionStep('browser_tts', step.id, 'else')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Add TTS"><Mic size={12}/></button>
                                <button onClick={() => addActionStep('obs_scene', step.id, 'else')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Add Scene"><Monitor size={12}/></button>
                            </div>
                         </div>
                         {innerList(step.elseActions, elseOrder, 'else')}
                     </div>
                 </div>
             </div>
         );
     }

     const run = overlayStep(step.type);
     const RunIcon = run?.icon;
     const runInput = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent";
     const runLabel = "text-[10px] font-black uppercase tracking-widest text-zinc-500";

     return (
        <div {...order?.row(step.id)} className={`bg-zinc-900 rounded-2xl border border-zinc-800 p-4 relative group animate-slide-up mb-2 ${order?.held === step.id ? 'opacity-40' : ''}`}>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"> <button onClick={() => removeActionStep(step.id)} className="text-zinc-600 hover:text-red-500"><X size={16} /></button> </div>
            <div className="flex items-center gap-3 mb-4"> 
                {stepGrip}
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${isOverlayStep(step.type) ? 'bg-sky-400 text-black' : step.type.startsWith('twitch_') ? 'bg-[#9146FF] text-white' : step.type.startsWith('youtube_') ? 'bg-[#FF0000] text-white' : step.type.startsWith('discord_') ? 'bg-[#5865F2] text-white' : step.type === 'spotify_control' ? 'bg-[#1DB954] text-black' : step.type === 'trigger_action' ? 'bg-indigo-500 text-white' : step.type === 'browser_tts' ? 'bg-pink-500 text-white' : step.type.startsWith('obs_') ? 'bg-zinc-700 text-white' : 'bg-white text-black'}`}> 
                    {RunIcon ? <RunIcon size={14} /> : step.type === 'omnibar_set' ? <Radio size={14} /> : step.type === 'trigger_action' ? <Workflow size={14} /> : step.type.startsWith('discord_') ? <DiscordIcon size={14} /> : step.type.startsWith('youtube_') ? <YouTubeIcon size={12} /> : step.type === 'spotify_control' ? <SpotifyIcon size={14} /> : step.type === 'browser_tts' ? <Mic size={14} /> : step.type.startsWith('obs_') ? <Monitor size={14} /> : (index + 1)} 
                </div> 
                <span className="text-xs font-black uppercase tracking-wider text-zinc-300"> 
                    {run ? (t[run.key] || run.label) : step.type === 'omnibar_set' ? (t.omnibarStepMenu || 'Omnibar slot') : step.type === 'trigger_action' ? t.triggerAction : step.type === 'spotify_control' ? t.spotifyControl : step.type === 'browser_tts' ? t.ttsTitle || 'Text to Speech' : step.type === 'twitch_shoutout' ? (t.twitchStepShoutoutTitle || 'Twitch: shout out') : step.type === 'twitch_clip' ? (t.twitchStepClipTitle || 'Twitch: clip') : step.type === 'twitch_marker' ? (t.twitchStepMarkerTitle || 'Twitch: stream marker') : step.type === 'twitch_moderate' ? (t.twitchStepModerateTitle || 'Twitch: moderate') : step.type === 'twitch_chat_mode' ? (t.twitchStepChatModeTitle || 'Twitch: chat mode') : step.type === 'youtube_set_title' ? (t.youtubeStepTitle || 'YouTube: set title') : step.type === 'youtube_set_description' ? (t.youtubeStepDescription || 'YouTube: set description') : step.type === 'youtube_toggle_category' ? (t.youtubeStepCategory || 'YouTube: toggle category') : step.type === 'obs_stop_stream' ? (t.obsStopStreamTitle || 'OBS: stop streaming') : step.type.replace('_', ' ')} 
                </span> 
            </div>
            <div className="pl-9">
            
            {/* NEW: TTS Step Config */}
            {step.type === 'browser_tts' && (
                <div className="space-y-4">
                    <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-1 mb-2">
                        <button 
                            onClick={() => updateActionStepConfig(step.id, 'ttsProvider', 'browser')} 
                            className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all uppercase ${!step.config.ttsProvider || step.config.ttsProvider === 'browser' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {t.ttsBrowser || 'Browser Native'}
                        </button>
                        <button 
                            onClick={() => updateActionStepConfig(step.id, 'ttsProvider', 'gemini')} 
                            className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all uppercase ${step.config.ttsProvider === 'gemini' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {t.ttsGemini || 'Gemini AI'}
                        </button>
                    </div>

                    <div className="space-y-1 relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.ttsText || 'Text to Speak'}</label>
                        <textarea 
                            value={step.config.ttsText || ''} 
                            onChange={(e) => updateActionStepConfig(step.id, 'ttsText', e.target.value)} 
                            placeholder="Hello {user}!"
                            className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium focus:border-current-accent outline-none resize-none pr-8 text-white" 
                        />
                        <button 
                            onClick={(e) => onOpenPicker(step.id, 'ttsText', e)}
                            className="absolute bottom-2 right-2 p-1 text-zinc-500 hover:text-white transition-colors"
                        >
                            <Smile size={12} />
                        </button>
                    </div>
                    <p className="text-[9px] text-zinc-500 font-medium ml-1">{t.randomMessageHelp}</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.ttsVoice || 'Voice'}</label>
                            <select 
                                value={step.config.ttsVoice || ''} 
                                onChange={(e) => updateActionStepConfig(step.id, 'ttsVoice', e.target.value)} 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-zinc-300 outline-none focus:border-current-accent"
                            >
                                {step.config.ttsProvider === 'gemini' ? (
                                    <>
                                        <option value="Puck">Puck</option>
                                        <option value="Charon">Charon</option>
                                        <option value="Kore">Kore</option>
                                        <option value="Fenrir">Fenrir</option>
                                        <option value="Zephyr">Zephyr</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="">Default Browser Voice</option>
                                        {voices.map(v => (
                                            <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex justify-between">
                                <span>{t.ttsVolume || 'Volume'}</span> 
                                <span>{Math.round((step.config.ttsVolume ?? 1) * 100)}%</span>
                            </label>
                            <input 
                                type="range" 
                                min="0" max="1" step="0.1" 
                                value={step.config.ttsVolume ?? 1} 
                                onChange={(e) => updateActionStepConfig(step.id, 'ttsVolume', parseFloat(e.target.value))} 
                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex justify-between">
                                <span>{t.ttsRate || 'Speed'}</span> 
                                <span>{step.config.ttsRate ?? 1}x</span>
                            </label>
                            <input 
                                type="range" 
                                min="0.1" max="2" step="0.1" 
                                value={step.config.ttsRate ?? 1} 
                                onChange={(e) => updateActionStepConfig(step.id, 'ttsRate', parseFloat(e.target.value))} 
                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                            />
                        </div>
                        {step.config.ttsProvider !== 'gemini' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex justify-between">
                                    <span>{t.ttsPitch || 'Pitch'}</span> 
                                    <span>{step.config.ttsPitch ?? 1}</span>
                                </label>
                                <input 
                                    type="range" 
                                    min="0" max="2" step="0.1" 
                                    value={step.config.ttsPitch ?? 1} 
                                    onChange={(e) => updateActionStepConfig(step.id, 'ttsPitch', parseFloat(e.target.value))} 
                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500" 
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step.type === 'twitch_shoutout' && (
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.twitchStepShoutoutWho || 'Who'}</label>
                    <input type="text" value={step.config.target ?? '{input}'} onChange={(e) => updateActionStepConfig(step.id, 'target', e.target.value)} placeholder="{input}" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium focus:border-current-accent outline-none text-white" />
                    <p className="text-[9px] text-zinc-500 font-medium ml-1">{t.twitchStepShoutoutHint || '"!so name" with {input}, or {user} to shout out whoever ran it. Twitch\'s own shoutout, the line in chat and the card on stream, as the Twitch screen says.'}</p>
                </div>
            )}

            {step.type === 'twitch_clip' && (
                <p className="text-[9px] text-zinc-500 font-medium ml-1">{t.twitchStepClipHint || 'Clips the last half minute of the stream (it has to be live). {clip.url} is its link, for the steps after this one: a chat message, a Discord post.'}</p>
            )}

            {step.type === 'twitch_marker' && (
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.twitchStepMarkerNote || 'Note'}</label>
                    <input type="text" value={step.config.description ?? '{input}'} onChange={(e) => updateActionStepConfig(step.id, 'description', e.target.value)} placeholder="{input}" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium focus:border-current-accent outline-none text-white" />
                    <p className="text-[9px] text-zinc-500 font-medium ml-1">{t.twitchStepMarkerHint || 'A marker in the VOD at this moment, to find it later (the stream has to be live). The note is optional.'}</p>
                </div>
            )}

            {/* Moderating, through the channel's login (server/engine/twitch-mod.js step). */}
            {step.type === 'twitch_moderate' && (
                <div className="space-y-2" data-step-moderate>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.twitchStepModerateWhat || 'Do'}</label>
                        <select value={step.config.what ?? 'timeout'} onChange={(e) => updateActionStepConfig(step.id, 'what', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-current-accent" data-step-moderate-what>
                            <option value="timeout">{t.twitchStepModerateTimeout || 'Time out'}</option>
                            <option value="ban">{t.twitchStepModerateBan || 'Ban'}</option>
                            <option value="unban">{t.twitchStepModerateUnban || 'Unban, or end a timeout'}</option>
                            <option value="delete">{t.twitchStepModerateDelete || 'Delete the message that set this off'}</option>
                        </select>
                    </div>
                    {(step.config.what ?? 'timeout') !== 'delete' && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.twitchStepShoutoutWho || 'Who'}</label>
                            <input type="text" value={step.config.target ?? '{user}'} onChange={(e) => updateActionStepConfig(step.id, 'target', e.target.value)} placeholder="{user}" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-current-accent" />
                        </div>
                    )}
                    {(step.config.what ?? 'timeout') === 'timeout' && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.twitchStepModerateSeconds || 'For how long (seconds)'}</label>
                            <input type="number" min={1} max={1209600} value={step.config.seconds ?? 600} onChange={(e) => updateActionStepConfig(step.id, 'seconds', Number(e.target.value) || 600)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-current-accent" />
                        </div>
                    )}
                    {['timeout', 'ban'].includes(step.config.what ?? 'timeout') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.twitchStepModerateReason || 'Reason (optional)'}</label>
                            <input type="text" value={step.config.reason ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'reason', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-current-accent" />
                        </div>
                    )}
                    <p className="text-[9px] text-zinc-500 font-medium ml-1">{t.twitchStepModerateHint || '{user} is whoever set the action off, {input} whoever they named. Done as your channel, and never to you.'}</p>
                </div>
            )}

            {step.type === 'twitch_chat_mode' && (
                <div className="space-y-2" data-step-chat-mode>
                    <div className="grid grid-cols-2 gap-2">
                        <select value={step.config.mode ?? 'slow'} onChange={(e) => updateActionStepConfig(step.id, 'mode', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-current-accent" data-step-chat-mode-which>
                            <option value="slow">{t.chatModeSlowName || 'Slow mode'}</option>
                            <option value="emote">{t.chatModeEmote || 'Emotes only'}</option>
                            <option value="followers">{t.chatModeFollowers || 'Followers only'}</option>
                            <option value="subscribers">{t.chatModeSubs || 'Subscribers only'}</option>
                        </select>
                        <select value={step.config.on === false ? 'off' : 'on'} onChange={(e) => updateActionStepConfig(step.id, 'on', e.target.value === 'on')} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-current-accent">
                            <option value="on">{t.twitchStepChatModeOn || 'Switch on'}</option>
                            <option value="off">{t.twitchStepChatModeOff || 'Switch off'}</option>
                        </select>
                    </div>
                    {(step.config.mode ?? 'slow') === 'slow' && step.config.on !== false && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.twitchStepChatModeSeconds || 'Seconds between messages (3 to 120)'}</label>
                            <input type="number" min={3} max={120} value={step.config.seconds ?? 30} onChange={(e) => updateActionStepConfig(step.id, 'seconds', Number(e.target.value) || 30)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-current-accent" />
                        </div>
                    )}
                </div>
            )}

            {step.type === 'twitch_chat' && (
                <div className="space-y-3"> 
                    <div className="space-y-1 relative">
                        <textarea value={step.config.message || ''} onChange={(e) => updateActionStepConfig(step.id, 'message', e.target.value)} placeholder={t.randomMessageHelp} className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium focus:border-current-accent outline-none resize-none pr-8 text-white" />
                        <button onClick={(e) => onOpenPicker(step.id, 'message', e)} className="absolute top-2 right-2 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"><Smile size={12} /></button>
                        <p className="text-[9px] text-zinc-500 font-medium ml-1">{t.randomMessageHelp}</p>
                    </div>
                    {/*
                      Where it goes. Twitch unless chosen otherwise, as before;
                      "where it came from" answers a YouTube viewer on YouTube.
                      A message to YouTube costs 50 of the day's 10,000 units.
                    */}
                    <div className="space-y-1" data-chat-step-to>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.chatStepSendTo || 'Send it to'}</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {([
                                ['twitch', 'Twitch'],
                                ['youtube', 'YouTube'],
                                ['both', t.sendToBoth || 'Both'],
                                ['origin', t.chatStepOrigin || 'Where it came from'],
                            ] as const).map(([value, name]) => (
                                <button
                                    key={value}
                                    onClick={() => updateActionStepConfig(step.id, 'sendTo', value)}
                                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${(step.config.sendTo || 'twitch') === value ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                                    data-chat-step-to-choice={value}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                        {step.config.sendTo === 'origin' && (
                            <p className="text-[9px] text-zinc-500 leading-relaxed" data-chat-step-origin-hint>{t.chatStepOriginHint || 'A YouTube viewer is answered in YouTube chat, a command typed in Discord in the channel it was typed in, everybody else in Twitch chat.'}</p>
                        )}
                        {(step.config.sendTo || 'twitch') !== 'twitch' && (
                            <p className="text-[9px] text-zinc-500 leading-relaxed">{t.chatStepYoutubeHint || 'To YouTube only while it has a live chat, as your channel. Each message there costs 50 of the day\'s 10,000 units — about a minute of reading chat — and is cut at 200 characters.'}</p>
                        )}
                    </div>
                    {(step.config.sendTo || 'twitch') !== 'youtube' && (
                    <div className="flex gap-2">
                        <button onClick={() => updateActionStepConfig(step.id, 'useBotAccount', !step.config.useBotAccount)} className={`flex-1 p-2 rounded-xl border flex items-center justify-between transition-all ${step.config.useBotAccount ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}> <span className="text-[10px] font-black uppercase">{t.botAccountBtn}</span> {step.config.useBotAccount ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} </button>
                    </div>
                    )}
                </div>
            )}
            
            {step.type === 'omnibar_set' && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarStepSlot}</label>
                        <select
                            value={step.config.slotId || ''}
                            onChange={(e) => updateActionStepConfig(step.id, 'slotId', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent"
                        >
                            <option value="">{t.omnibarStepPickSlot}</option>
                            {(omnibarSlots || []).map((slot: any) => (
                                <option key={slot.id} value={slot.id}>{slot.name || slot.label || slot.text || slot.id}</option>
                            ))}
                        </select>
                        {(omnibarSlots || []).length === 0 && (
                            <p className="text-[10px] text-amber-500">{t.omnibarStepNoSlots}</p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.omnibarStepText}</label>
                        <input
                            type="text"
                            value={step.config.text || ''}
                            onChange={(e) => updateActionStepConfig(step.id, 'text', e.target.value)}
                            placeholder="{user}: {input}"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-current-accent"
                        />
                        <p className="text-[10px] text-zinc-600">{t.omnibarStepTextHint}</p>
                    </div>
                </div>
            )}

            {run?.kind === 'field' && (
                <div className="space-y-1">
                    <label className={runLabel}>{t.runStepValue || 'Set it to'}</label>
                    <input
                        type="text"
                        value={step.config.value ?? ''}
                        onChange={(e) => updateActionStepConfig(step.id, 'value', e.target.value)}
                        placeholder="{input}"
                        className={runInput}
                    />
                    <p className="text-[10px] text-zinc-600">
                        {step.type === 'run_set_year'
                            ? (t.runStepYearHint || 'Four digits, like 2023. Anything else leaves the year empty.')
                            : (t.runStepValueHint || '{input} is whatever comes after the command, so "!platform PC" sets PC. When it comes to nothing, the card loses this line.')}
                    </p>
                </div>
            )}

            {run?.kind === 'person' && (
                <div className="space-y-3">
                    {step.type === 'run_set_commentator' && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.runStepSeat || 'Seat'}</label>
                            <select
                                value={step.config.seat ?? 1}
                                onChange={(e) => updateActionStepConfig(step.id, 'seat', Number(e.target.value))}
                                className={runInput}
                            >
                                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{(t.runStepSeatN || 'Seat {n}').replace('{n}', String(n))}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className={runLabel}>{t.runStepName || 'Name'}</label>
                        <input type="text" value={step.config.name ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'name', e.target.value)} placeholder="{input}" className={runInput} />
                    </div>
                    <div className="space-y-1">
                        <label className={runLabel}>{t.runStepSubtitle || 'Second line'}</label>
                        <input type="text" value={step.config.subtitle ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'subtitle', e.target.value)} placeholder={t.runStepSubtitlePlaceholder || 'Left as it is when empty'} className={runInput} />
                        <p className="text-[10px] text-zinc-600">{t.runStepPersonHint || 'The name is always written, so a command with nothing after it takes the person off the card. The second line only changes when this box has something in it.'}</p>
                    </div>
                </div>
            )}

            {run?.kind === 'timer' && (
                <div className="space-y-1">
                    <label className={runLabel}>{t.timerStepDo || 'What to do'}</label>
                    <select value={step.config.timerOp || 'toggle'} onChange={(e) => updateActionStepConfig(step.id, 'timerOp', e.target.value)} className={runInput}>
                        <option value="toggle">{t.timerStepToggle || 'Start, or pause if running'}</option>
                        <option value="start">{t.timerStepStart || 'Start (or resume)'}</option>
                        <option value="pause">{t.timerStepPause || 'Pause'}</option>
                        <option value="finish">{t.timerStepFinish || 'Finish'}</option>
                        <option value="undoFinish">{t.timerStepUndo || 'Undo finish'}</option>
                        <option value="reset">{t.timerStepReset || 'Reset to zero'}</option>
                    </select>
                    <p className="text-[10px] text-zinc-600">{t.timerStepHint || 'Follow it with a chat step using {timer.time} to say the time — "GG! Finished in {timer.time}".'}</p>
                </div>
            )}

            {run?.kind === 'layout-switch' && (
                <div className="space-y-2">
                    <div className="space-y-1">
                        <label className={runLabel}>{t.layoutSwitchWhich || 'Which layout'}</label>
                        <LayoutTarget
                          sceneType={(step.config as any).sceneType}
                          layoutId={step.config.layoutId}
                          types={sceneTypes}
                          layouts={layouts}
                          anyLabel={t.layoutSwitchPick || 'Pick one…'}
                          set={(patch) => { for (const [k, v] of Object.entries(patch)) updateActionStepConfig(step.id, k, v); }}
                          className={runInput}
                          t={t}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className={runLabel}>{t.layoutSwitchHow || 'How'}</label>
                        <select value={step.config.transition || ''} onChange={(e) => updateActionStepConfig(step.id, 'transition', e.target.value)} className={runInput}>
                            <option value="">{t.layoutSwitchAsSet || 'As set up on the Layouts screen'}</option>
                            <option value="cover">{t.omniCover || 'Behind a wipe'}</option>
                            <option value="cut">{t.omniCutOption || 'A cut'}</option>
                        </select>
                    </div>
                    <p className="text-[10px] text-zinc-600">{t.layoutSwitchHint || 'Omnilayer only: puts the layout on stream and moves your OBS sources to its boxes. Does nothing while Omnilayer is off.'}</p>
                </div>
            )}

            {run?.kind === 'remote-on-screen' && (
                <div className="space-y-2">
                    <div className="space-y-1">
                        <label className={runLabel}>{t.onScreenStepWho || 'Whose game'}</label>
                        <select value={String(step.config.player ?? '1')} onChange={(e) => updateActionStepConfig(step.id, 'player', e.target.value)} className={runInput} data-on-screen-player>
                            {Array.from({ length: REMOTE_SEATS }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={String(n)}>{n} · {seatNames[n - 1] || `Player ${n}`}</option>
                            ))}
                            <option value="{input}">{t.onScreenStepInput || 'What chat typed: a number or a name'}</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={runLabel}>{t.onScreenStepThen || 'Then go live with'}</label>
                        <select value={(step.config as any).sceneType || ''} onChange={(e) => updateActionStepConfig(step.id, 'sceneType', e.target.value)} className={runInput} data-on-screen-type>
                            <option value="">{t.onScreenStepStay || 'Nothing else: only change whose game it is'}</option>
                            {sceneTypes.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                        </select>
                    </div>
                    {Boolean((step.config as any).sceneType) && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={step.config.anyLayout === true} onChange={(e) => updateActionStepConfig(step.id, 'anyLayout', e.target.checked)} className="accent-current-accent" data-on-screen-any />
                            <span className="text-[10px] text-zinc-400">{t.onScreenStepAny || 'From any layout, not only one already showing the players'}</span>
                        </label>
                    )}
                    <p className="text-[10px] text-zinc-600">{t.onScreenStepHint || 'Puts this player\'s game in every "Player on screen" box: the Gameplay layouts\' game, full screen. Seat 1 is yours while you play in it. With a layout type it then goes live with that layout too, but only from a layout already showing the players, so a viewer\'s command never pulls the stream off Starting, BRB or Just Chatting. From those it only changes whose game is up when you go back.'}</p>
                </div>
            )}

            {run?.kind === 'countdown' && (
                <div className="space-y-2">
                    <div className="space-y-1">
                        <label className={runLabel}>{t.countdownStepDo || 'What to do'}</label>
                        <select value={step.config.countdownOp || 'start'} onChange={(e) => updateActionStepConfig(step.id, 'countdownOp', e.target.value)} className={runInput}>
                            <option value="start">{t.countdownStepStart || 'Start a timer from the beginning'}</option>
                            <option value="toggle">{t.countdownStepToggle || 'Start, or pause if running'}</option>
                            <option value="pause">{t.countdownStepPause || 'Pause'}</option>
                            <option value="resume">{t.countdownStepResume || 'Carry on after a pause'}</option>
                            <option value="add">{t.countdownStepAdd || 'Add or take off time'}</option>
                            <option value="reset">{t.countdownStepReset || 'Stop, back to its full time'}</option>
                        </select>
                    </div>
                    {(step.config.countdownOp || 'start') === 'start' && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.countdownStepWhich || 'Which timer'}</label>
                            <select value={step.config.timer || ''} onChange={(e) => updateActionStepConfig(step.id, 'timer', e.target.value)} className={runInput}>
                                <option value="">{t.countdownStepCurrent || 'The one set up now'}</option>
                                {(countdownPresets || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            {Boolean(step.config.timer) && !(countdownPresets || []).some((p) => p.id === step.config.timer) && (
                                <p className="text-[10px] text-amber-500">{t.countdownStepGone || 'That saved timer is gone. Pick another one.'}</p>
                            )}
                        </div>
                    )}
                    {step.config.countdownOp === 'add' && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.countdownStepAmount || 'How much'}</label>
                            <input type="text" value={step.config.value ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'value', e.target.value)} placeholder="1:00" className={runInput} />
                            <p className="text-[10px] text-zinc-600">{t.countdownStepAmountHint || '1:30 is a minute and a half, 30s is thirty seconds, and a plain number is minutes. A minus takes time off. {input} is whatever comes after the command.'}</p>
                        </div>
                    )}
                    <p className="text-[10px] text-zinc-600">{t.countdownStepHint || 'Follow it with a chat step using {countdown.time} to say what is left — "Back in {countdown.time}".'}</p>
                </div>
            )}

            {run?.kind === 'deaths' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={runLabel}>{t.deathsStepHow || 'How'}</label>
                            <select value={step.config.deathsOp || 'auto'} onChange={(e) => updateActionStepConfig(step.id, 'deathsOp', e.target.value)} className={runInput}>
                                <option value="auto">{t.deathsStepAuto || 'By what is typed: nothing adds one, -1 takes one back, 5 sets'}</option>
                                <option value="add">{t.deathsStepAdd || 'Always add'}</option>
                                <option value="subtract">{t.deathsStepSubtract || 'Always take away'}</option>
                                <option value="set">{t.deathsStepSet || 'Always set it to'}</option>
                                <option value="reset">{t.deathsStepReset || 'Back to zero'}</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={runLabel}>{t.deathsStepAmount || 'Amount'}</label>
                            <input type="text" value={step.config.value ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'value', e.target.value)} placeholder="{input}" className={runInput} disabled={step.config.deathsOp === 'reset'} />
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-600">{t.deathsStepHint || '{input} is whatever comes after the command, so "!muerte" on its own adds one. Show it on an overlay with {deaths} in a text layer, and follow this with a chat step using {deaths} to say the count.'}</p>
                </div>
            )}

            {run?.kind === 'goal-change' && (() => {
                const chosen = (goalSlots || []).find((g) => g.id === step.config.slotId);
                const gone = Boolean(step.config.slotId) && !chosen;
                return (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className={runLabel}>{t.goalStepWhich || 'Which goal'}</label>
                        <select value={step.config.slotId || ''} onChange={(e) => updateActionStepConfig(step.id, 'slotId', e.target.value)} className={runInput}>
                            <option value="">{t.goalStepPick || 'Choose a goal…'}</option>
                            {(goalSlots || []).map((g) => (
                                <option key={g.id} value={g.id}>{`${g.bar}: ${g.name}`}</option>
                            ))}
                        </select>
                        {(goalSlots || []).length === 0 && <p className="text-[10px] text-amber-500">{t.goalStepNone || 'There are no goal slots yet. Add one on the Omnibar screen first.'}</p>}
                        {gone && <p className="text-[10px] text-amber-500">{t.goalStepGone || 'The goal this step changed is no longer on any bar. Pick another.'}</p>}
                        {chosen && chosen.source !== 'manual' && (
                            <p className="text-[10px] text-amber-500">{t.goalStepNotManual || 'This goal counts from Twitch, so its number cannot be changed here. Set it to "A number I keep" on the Omnibar screen.'}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className={runLabel}>{t.goalStepHow || 'How'}</label>
                            <select value={step.config.goalMode || 'auto'} onChange={(e) => updateActionStepConfig(step.id, 'goalMode', e.target.value)} className={runInput}>
                                <option value="auto">{t.goalStepAuto || 'By what is typed: +50 adds, -20 takes away, 500 sets'}</option>
                                <option value="add">{t.goalStepAdd || 'Always add'}</option>
                                <option value="subtract">{t.goalStepSubtract || 'Always take away'}</option>
                                <option value="set">{t.goalStepSet || 'Always set it to'}</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={runLabel}>{t.goalStepAmount || 'Amount'}</label>
                            <input type="text" value={step.config.value ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'value', e.target.value)} placeholder="{input}" className={runInput} />
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-600">{t.goalStepHint || '{input} is whatever comes after the command, so "!goal +50" adds fifty. Whole numbers; "$" and commas are fine. Follow it with a chat step using {goal.value}, {goal.target}, {goal.left} or {goal.percent}.'}</p>
                </div>
                );
            })()}

            {run?.kind === 'text-layer' && (() => {
                const layout = (layouts || []).find((l) => l.id === step.config.layoutId);
                const texts = (layout?.layers || []).filter((l) => l.type === 'text');
                // Layers have no names, so each is known by what it says now.
                const describe = (l: any, n: number) => {
                    const words = String(l.config?.text || '').replace(/\s+/g, ' ').trim();
                    return words ? (words.length > 48 ? `${words.slice(0, 48)}…` : words) : `${t.textLayerEmpty || 'Empty text layer'} ${n + 1}`;
                };
                const gone = Boolean(step.config.layerUid) && !texts.some((l) => l.uid === step.config.layerUid);
                return (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className={runLabel}>{t.textLayerLayout || 'Layout'}</label>
                        <select
                            value={step.config.layoutId || ''}
                            onChange={(e) => { updateActionStepConfig(step.id, 'layoutId', e.target.value); updateActionStepConfig(step.id, 'layerUid', ''); }}
                            className={runInput}
                        >
                            <option value="">{t.textLayerPickLayout || 'Choose a layout…'}</option>
                            {(layouts || []).map((l) => <option key={l.id} value={l.id}>{l.name || l.id}</option>)}
                        </select>
                    </div>
                    {layout && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.textLayerLayer || 'Text layer'}</label>
                            <select value={step.config.layerUid || ''} onChange={(e) => updateActionStepConfig(step.id, 'layerUid', e.target.value)} className={runInput}>
                                <option value="">{t.textLayerPickLayer || 'Choose a text layer…'}</option>
                                {texts.map((l, n) => <option key={l.uid} value={l.uid}>{describe(l, n)}</option>)}
                            </select>
                            {texts.length === 0 && <p className="text-[10px] text-amber-500">{t.textLayerNone || 'This layout has no text layers. Add one on the Overlays screen first.'}</p>}
                            {gone && <p className="text-[10px] text-amber-500">{t.textLayerGone || 'The layer this step wrote to is no longer in this layout. Pick another.'}</p>}
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className={runLabel}>{t.textLayerText || 'What to write'}</label>
                        <input type="text" value={step.config.text ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'text', e.target.value)} placeholder="{input}" className={runInput} />
                        <p className="text-[10px] text-zinc-600">{t.textLayerHint || 'Replaces everything the layer says, and keeps how it looks. {input} is whatever comes after the command. Overlay values such as {followers} or {game} stay live in the layer.'}</p>
                    </div>
                </div>
                );
            })()}

            {run?.kind === 'plan-add' && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className={runLabel}>{t.planStepText || 'Activity'}</label>
                        <input type="text" value={step.config.text ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'text', e.target.value)} placeholder="{input}" className={runInput} />
                    </div>
                    <div className="space-y-1">
                        <label className={runLabel}>{t.planStepNote || 'Note under it'}</label>
                        <input type="text" value={step.config.note ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'note', e.target.value)} placeholder={t.planStepNotePlaceholder || 'Optional'} className={runInput} />
                    </div>
                    <div className="space-y-1">
                        <label className={runLabel}>{t.planStepWhere || 'Where it goes'}</label>
                        <select value={step.config.where || 'end'} onChange={(e) => updateActionStepConfig(step.id, 'where', e.target.value)} className={runInput}>
                            <option value="end">{t.planWhereEnd || 'At the end of the plan'}</option>
                            <option value="next">{t.planWhereNext || 'Right after the current activity'}</option>
                        </select>
                        <p className="text-[10px] text-zinc-600">{t.planStepAddHint || '{input} is whatever comes after the command, so "!addplan Viewer games" adds Viewer games. The plan holds up to 30.'}</p>
                    </div>
                </div>
            )}

            {run?.kind === 'players' && (
                <div className="space-y-3">
                    {(step.type === 'players_join' || step.type === 'players_state' || step.type === 'players_remove') && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.playersStepName || 'Who'}</label>
                            <input type="text" value={step.config.name ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'name', e.target.value)} placeholder={step.type === 'players_join' ? '{user}' : '{input}'} className={runInput} />
                        </div>
                    )}
                    {step.type === 'players_join' && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.playersStepColour || 'Colour'}</label>
                            <input type="text" value={step.config.colour ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'colour', e.target.value)} placeholder="{input}" className={runInput} />
                        </div>
                    )}
                    {step.type === 'players_state' && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.playersStepStateLabel || 'Now'}</label>
                            <select value={step.config.playerState || 'out'} onChange={(e) => updateActionStepConfig(step.id, 'playerState', e.target.value)} className={runInput}>
                                <option value="in">{t.playersStateIn || 'In'}</option>
                                <option value="out">{t.playersStateOut || 'Out'}</option>
                                <option value="ejected">{t.playersStateEjected || 'Ejected'}</option>
                                <option value="dead">{t.playersStateDead || 'Dead'}</option>
                            </select>
                        </div>
                    )}
                    <p className="text-[10px] text-zinc-600">
                        {step.type === 'players_join' ? (t.playersStepJoinHint || '{user} is whoever typed the command, so "!join red" adds them in red. A colour by name (red, blue, lime…) or a hex code; none picks one from the name. Joining again puts somebody back in.')
                          : step.type === 'players_state' ? (t.playersStepStateHint || '{input} is whatever comes after the command, so "!eject Rowan" puts Rowan out. Make it a mod-only command.')
                          : step.type === 'players_remove' ? (t.playersStepRemoveHint || 'Takes the player off the list altogether.')
                          : step.type === 'players_reset' ? (t.playersStepResetHint || 'A new round: everybody back in, nobody removed.')
                          : (t.playersStepClearHint || 'Empties the list.')}
                    </p>
                </div>
            )}

            {run?.kind === 'giveaway' && (
                <div className="space-y-3" data-giveaway-step>
                    {step.type === 'giveaway_open' && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.giveawayStepPrize || 'Prize (empty: the one set up)'}</label>
                            <input type="text" value={step.config.prize ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'prize', e.target.value)} placeholder="{input}" className={runInput} />
                        </div>
                    )}
                    <p className="text-[10px] text-zinc-600">
                        {step.type === 'giveaway_open' ? (t.giveawayStepOpenHint || 'Opens the giveaway set up on the Giveaways screen. "!giveaway Juego gratis" with {input} here opens it for that prize. Make it a mod-only command.')
                          : step.type === 'giveaway_close' ? (t.giveawayStepCloseHint || 'Stops taking entries. Whoever entered stays in for the draw.')
                          : (t.giveawayStepDrawHint || 'Draws the winner now, on the overlay\'s reel, then tells chat and Discord.')}
                    </p>
                </div>
            )}

            {run?.kind === 'poll' && (
                <div className="space-y-3">
                    {step.type === 'poll_open' && (
                        <div className="space-y-1">
                            <label className={runLabel}>{t.pollStepText || 'Poll'}</label>
                            <input type="text" value={step.config.text ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'text', e.target.value)} placeholder="{input}" className={runInput} />
                        </div>
                    )}
                    <p className="text-[10px] text-zinc-600">
                        {step.type === 'poll_open' ? (t.pollStepOpenHint || '"!poll Who is the impostor? | Red | Blue" opens that poll: the question, then each answer after a |. The command alone opens the poll set up on the Polls screen. Make it a mod-only command.')
                          : step.type === 'poll_close' ? (t.pollStepCloseHint || 'Closes the poll now and leaves the result on screen.')
                          : (t.pollStepResetHint || 'Takes the poll off the screen. The question and answers stay on the Polls screen.')}
                    </p>
                </div>
            )}

            {run?.kind === 'avatar-face' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_90px] gap-2">
                        <div className="space-y-1">
                            <label className={runLabel}>{t.avatarFaceStepFace || 'Face'}</label>
                            <input type="text" list="avatar-faces" value={step.config.face ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'face', e.target.value)} placeholder="happy" className={runInput} />
                            <datalist id="avatar-faces">
                                {AVATAR_EXPRESSIONS_LIST.map((f: string) => <option key={f} value={f} />)}
                            </datalist>
                        </div>
                        <div className="space-y-1">
                            <label className={runLabel}>{t.avatarFaceStepSeconds || 'Seconds'}</label>
                            <input type="number" min={1} max={600} value={step.config.seconds ?? 5} onChange={(e) => updateActionStepConfig(step.id, 'seconds', Number(e.target.value))} className={runInput} />
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-600">
                        {t.avatarFaceStepHint || 'Every avatar on screen shows this face for that long: a face of the pixel avatar (happy, surprised, wink, sad, angry…) or the name of a face on a PNGtuber layer. {input} lets chat choose: "!face happy". "none" puts the faces back.'}
                    </p>
                </div>
            )}

            {run?.kind === 'avatar-action' && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className={runLabel}>{t.avatarActionStepWhich || 'What'}</label>
                        <input type="text" list="avatar-actions" value={step.config.action ?? 'drink'} onChange={(e) => updateActionStepConfig(step.id, 'action', e.target.value)} placeholder="drink" className={runInput} />
                        <datalist id="avatar-actions">
                            {[...new Set([...AVATAR_ACTIONS_LIST, ...avatarActions])].map((a: string) => <option key={a} value={a} />)}
                            <option value="{input}" />
                        </datalist>
                    </div>
                    <p className="text-[10px] text-zinc-600">
                        {t.avatarActionStepHint || 'Every pixel avatar on screen does it once, start to end: drink is a glass of water, about three and a half seconds. An outfit not drawn doing it yet skips it. {input} lets chat choose, by name or a loose word ("!tomar agua").'}
                    </p>
                </div>
            )}

            {run?.kind === 'avatar-dress' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-[110px_1fr_80px] gap-2">
                        <div className="space-y-1">
                            <label className={runLabel}>{t.avatarDressStepWhat || 'Put on'}</label>
                            <select value={step.config.what === 'hat' ? 'hat' : 'outfit'} onChange={(e) => updateActionStepConfig(step.id, 'what', e.target.value)} className={runInput}>
                                <option value="outfit">{t.avatarDressStepOutfit || 'An outfit'}</option>
                                <option value="hat">{t.avatarDressStepHat || 'A hat'}</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={runLabel}>{t.avatarDressStepName || 'Which'}</label>
                            <input type="text" list={`avatar-dress-${step.config.what === 'hat' ? 'hat' : 'outfit'}`} value={step.config.name ?? '{input}'} onChange={(e) => updateActionStepConfig(step.id, 'name', e.target.value)} placeholder="{input}" className={runInput} />
                            {(['outfit', 'hat'] as const).map((what) => (
                                <datalist key={what} id={`avatar-dress-${what}`}>
                                    <option value="{input}" />
                                    {/* The outfit it was drawn in is asked for by the first of its own words. */}
                                    {Object.keys((AVATAR_DRESS_WORDS as any)[what]).map((name: string) => name || (AVATAR_DRESS_WORDS as any)[what][''][0]).filter(Boolean).map((name: string) => <option key={name} value={name} />)}
                                </datalist>
                            ))}
                        </div>
                        <div className="space-y-1">
                            <label className={runLabel}>{t.avatarDressStepMinutes || 'Minutes'}</label>
                            <input type="number" min={1} max={60} value={step.config.minutes ?? 5} onChange={(e) => updateActionStepConfig(step.id, 'minutes', Number(e.target.value))} className={runInput} />
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-600">
                        {t.avatarDressStepHint || "Every pixel avatar on screen wears it for that long, then its own again (a layer can say no to this). {input} lets viewers choose: a chat command like \"!outfit\" or \"!hat\" followed by the outfit's or hat's name, or a channel-point reward that asks for text; \"none\" takes a hat off. Loose words work in English and Spanish; words that name nothing change nothing. Give a chat command a cooldown."}
                    </p>
                </div>
            )}

            {run?.kind === 'question' && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className={runLabel}>{t.questionStepText || 'The question'}</label>
                        <input type="text" value={step.config.text ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'text', e.target.value)} placeholder="{input}" className={runInput} />
                    </div>
                    <div className="space-y-1">
                        <label className={runLabel}>{t.questionStepAsker || 'Asked by'}</label>
                        <input type="text" value={step.config.asker ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'asker', e.target.value)} placeholder={t.questionStepAskerPlaceholder || 'Whoever ran it'} className={runInput} />
                        <p className="text-[10px] text-zinc-600">{t.questionStepHint || '{input} is whatever comes after the command, so "!ask what got you into speedrunning?" queues that question. It waits in Questions until you approve it; nothing reaches the screen on its own. Give the command a cooldown so one person cannot fill the queue.'}</p>
                    </div>
                </div>
            )}

            {run?.kind === 'plan-move' && (
                <p className="text-[10px] text-zinc-500">
                    {step.type === 'plan_next'
                        ? (t.planStepNextHint || 'Marks the current activity done and makes the next one current. Before anything has started, it starts the first. Follow it with a chat step using {plan.current} to say what is on now.')
                        : (t.planStepBackHint || 'Undoes the last move: the activity before becomes current again and is no longer marked done. After the last one is finished, it brings that one back.')}
                </p>
            )}

            {run?.kind === 'clear' && (
                <div className="space-y-1">
                    <label className={runLabel}>{t.runStepClearWhat || 'What to empty'}</label>
                    <select
                        value={step.config.clearWhat || 'all'}
                        onChange={(e) => updateActionStepConfig(step.id, 'clearWhat', e.target.value)}
                        className={runInput}
                    >
                        <option value="all">{t.runClearAll || 'The whole card'}</option>
                        <option value="details">{t.runClearDetails || 'The game and its details'}</option>
                        <option value="people">{t.runClearPeople || 'Runner, host and commentators'}</option>
                        <option value="commentators">{t.runClearCommentators || 'Only the commentators'}</option>
                    </select>
                </div>
            )}

            {step.type === 'twitch_set_title' && (
                <div className="space-y-3">
                    <div className="space-y-1 relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stream Title</label>
                        <input type="text" value={step.config.title || ''} onChange={(e) => updateActionStepConfig(step.id, 'title', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium focus:border-current-accent outline-none text-white" placeholder="New Stream Title..." />
                    </div>
                </div>
            )}

            {step.type === 'youtube_set_title' && (
                <div className="space-y-1">
                    <label className={runLabel}>{t.youtubeTitleLabel || 'Stream title'}</label>
                    <input type="text" value={step.config.title ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'title', e.target.value)} placeholder="{input}" className={runInput} />
                    <p className="text-[10px] text-zinc-600">{t.youtubeTitleHint || 'Changes the broadcast that is live, or the next one scheduled if you are not live yet. {input} is whatever comes after the command. Up to 100 characters; YouTube does not allow < or >.'}</p>
                </div>
            )}

            {step.type === 'youtube_set_description' && (
                <div className="space-y-1">
                    <label className={runLabel}>{t.youtubeDescriptionLabel || 'Description'}</label>
                    <textarea value={step.config.description ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'description', e.target.value)} rows={5} placeholder={t.youtubeDescriptionPlaceholder || 'The whole new description. Variables such as {game} work here.'} className={runInput + ' resize-y'} />
                    <p className="text-[10px] text-zinc-600">{t.youtubeDescriptionHint || 'Replaces the whole description of the live broadcast, or the next one scheduled. Tags and the rest are kept. If it comes out empty nothing is changed.'}</p>
                </div>
            )}

            {step.type === 'youtube_toggle_category' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        {(['categoryA', 'categoryB'] as const).map((field) => (
                            <div key={field} className="space-y-1">
                                <label className={runLabel}>{field === 'categoryA' ? (t.youtubeCategoryA || 'Switch to') : (t.youtubeCategoryB || 'And back to')}</label>
                                <select value={step.config[field] ?? (field === 'categoryA' ? '20' : '22')} onChange={(e) => updateActionStepConfig(step.id, field, e.target.value)} className={runInput}>
                                    {field === 'categoryB' && <option value="">{t.youtubeCategoryNone || 'Nothing: always set the first'}</option>}
                                    {YOUTUBE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t.lang === 'es' ? c.es : c.en}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-zinc-600">{t.youtubeCategoryHint || 'Each time it runs it switches to whichever of the two the stream is not in, so one dock button flips between them. From any other category it goes to the first. Follow it with a chat step using {youtube.category} to say which it is now. YouTube categories are broad genres; the game itself is set in YouTube Studio.'}</p>
                </div>
            )}

            {step.type === 'twitch_set_category' && (
                <div className="space-y-3">
                    <div className="space-y-1 relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Game / Category</label>
                        <div className="relative">
                            <input 
                                type="text"
                                value={gameQuery || step.config.gameId || ''} 
                                onChange={(e) => { setGameQuery(e.target.value); updateActionStepConfig(step.id, 'gameId', e.target.value); }}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium focus:border-current-accent outline-none pr-8 text-white" 
                                placeholder="Search Game..."
                            />
                            <button onClick={handleSearch} className="absolute top-1/2 -translate-y-1/2 right-2 text-zinc-500 hover:text-white p-1"><Search size={12} /></button>
                        </div>
                        {gameResults.length > 0 && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto">
                                {gameResults.map(game => (
                                    <button key={game.id} onClick={() => { setGameQuery(game.name); updateActionStepConfig(step.id, 'gameId', game.id); updateActionStepConfig(step.id, 'gameName', game.name); setGameResults([]); }} className="w-full text-left px-3 py-2 text-[10px] hover:bg-zinc-800 flex items-center gap-2">
                                        <img src={game.box_art_url.replace('{width}', '40').replace('{height}', '50')} className="w-5 h-7 object-cover rounded" alt="" /> <span>{game.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {step.config.gameName && <div className="text-[9px] text-green-500 mt-1 flex items-center gap-1"><Check size={10} /> Selected: {step.config.gameName}</div>}
                    </div>
                </div>
            )}

            {step.type === 'discord_send' && (
                <DiscordSendStep step={step} update={(key, value) => updateActionStepConfig(step.id, key, value)} onOpenPicker={onOpenPicker} t={t} />
            )}

            {step.type === 'discord_webhook' && (
                <div className="space-y-3"> 
                    <div className="space-y-1"> <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Webhook URL</label> <input type="text" value={step.config.webhookUrl || ''} onChange={(e) => updateActionStepConfig(step.id, 'webhookUrl', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-zinc-300 focus:border-current-accent outline-none" /> </div> 
                    <div className="space-y-1"> <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.messageContent}</label> <textarea value={step.config.message || ''} onChange={(e) => updateActionStepConfig(step.id, 'message', e.target.value)} className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium focus:border-current-accent outline-none resize-none text-white" /> <p className="text-[9px] text-zinc-500 font-medium ml-1">{t.randomMessageHelp}</p> </div>
                </div>
            )}
            
            {step.type === 'droidcam_control' && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.droidcamOp}</label>
                        <select
                            value={step.config.droidcamOperation || 'torch'}
                            onChange={(e) => updateActionStepConfig(step.id, 'droidcamOperation', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-zinc-300 outline-none focus:border-current-accent"
                        >
                            {DROIDCAM_OPS.map((op) => (
                                <option key={op} value={op}>{t[`droidcamOp_${op}`] || op}</option>
                            ))}
                        </select>
                    </div>
                    {DROIDCAM_OPS_WITH_VALUE.includes(step.config.droidcamOperation) && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.droidcamValue}</label>
                            <input
                                type="text"
                                value={step.config.droidcamValue || ''}
                                onChange={(e) => updateActionStepConfig(step.id, 'droidcamValue', e.target.value)}
                                placeholder={t.droidcamValuePlaceholder}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-current-accent"
                            />
                            <p className="text-[9px] text-zinc-600">{t.droidcamValueHint}</p>
                        </div>
                    )}
                </div>
            )}

            {step.type === 'spotify_control' && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.spotifyOp}</label>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={() => updateActionStepConfig(step.id, 'spotifyOperation', 'play')} className={`flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold transition-all ${step.config.spotifyOperation === 'play' ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20' : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'}`}> <Play size={12} fill={step.config.spotifyOperation === 'play' ? 'currentColor' : 'none'} /> Play </button>
                            <button onClick={() => updateActionStepConfig(step.id, 'spotifyOperation', 'pause')} className={`flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold transition-all ${step.config.spotifyOperation === 'pause' ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20' : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'}`}> <Pause size={12} fill={step.config.spotifyOperation === 'pause' ? 'currentColor' : 'none'} /> Pause </button>
                            <button onClick={() => updateActionStepConfig(step.id, 'spotifyOperation', 'next')} className={`flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold transition-all ${step.config.spotifyOperation === 'next' ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20' : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'}`}> <SkipForward size={12} fill={step.config.spotifyOperation === 'next' ? 'currentColor' : 'none'} /> Next </button>
                            <button onClick={() => updateActionStepConfig(step.id, 'spotifyOperation', 'previous')} className={`flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold transition-all ${step.config.spotifyOperation === 'previous' ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20' : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'}`}> <SkipBack size={12} fill={step.config.spotifyOperation === 'previous' ? 'currentColor' : 'none'} /> Previous </button>
                        </div>
                        <button onClick={() => updateActionStepConfig(step.id, 'spotifyOperation', 'queue')} className={`w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold transition-all mb-2 ${step.config.spotifyOperation === 'queue' ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20' : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'}`}> <ListPlus size={12} /> Add to Queue </button>
                        {step.config.spotifyOperation === 'queue' && (
                            <div className="animate-slide-up">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Spotify Track URI or Variable</label>
                                <div className="flex gap-2">
                                    <input type="text" value={step.config.spotifyUri || ''} onChange={(e) => updateActionStepConfig(step.id, 'spotifyUri', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-white focus:border-[#1DB954] outline-none" placeholder="spotify:track:xyz or {input}" />
                                    <button onClick={() => updateActionStepConfig(step.id, 'spotifyUri', '{input}')} className="px-2 bg-zinc-800 rounded-xl text-[10px] text-zinc-400 hover:text-white" title="Use Input Variable">{`{input}`}</button>
                                </div>
                                <p className="text-[9px] text-zinc-600 mt-1">Accepts URIs, Links, or <code>{`{input}`}</code> from chat.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {step.type === 'obs_scene' && (
                <div className="space-y-1"> 
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.scene}</label> 
                    <select value={step.config.sceneName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sceneName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"> 
                        <option value="">Select Scene...</option> 
                        {obsData.scenes.map((s: any) => (<option key={s.sceneName} value={s.sceneName}>{s.sceneName}</option>))} 
                    </select> 
                </div>
            )}

            {step.type === 'obs_visibility' && (
                <div className="space-y-3">
                    {/* Which scene the source is in. It never had one to pick, and OBS will not find a source without; by default, the scene on air. */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.scene || 'Scene'}</label>
                        <select value={step.config.sceneName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sceneName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent" data-obs-step-scene>
                            <option value="">{t.obsSceneOnAir || 'The scene on air'}</option>
                            {obsData.scenes.map((s: any) => (<option key={s.sceneName} value={s.sceneName}>{s.sceneName}</option>))}
                        </select>
                    </div>
                    <div className="space-y-1"> 
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.obsStepSource || 'Source'}</label> 
                        <select value={step.config.sourceName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sourceName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"> 
                            <option value="">{t.obsPickSource || 'Choose a source…'}</option> 
                            {obsData.sources.map((s: any) => (<option key={s.inputName} value={s.inputName}>{s.inputName}</option>))} 
                        </select> 
                    </div>
                    <OnOffChoice value={step.config.visible} set={(v) => updateActionStepConfig(step.id, 'visible', v)}
                        on={t.show || 'Show'} off={t.hide || 'Hide'} onTone="green" offTone="red" t={t} />
                </div>
            )}

            {/* NEW OBS STEPS */}
            {step.type === 'obs_filter_toggle' && (
                <div className="space-y-3">
                    <div className="space-y-1"> 
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.obsStepSource || 'Source'}</label> 
                        <select value={step.config.sourceName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sourceName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"> 
                            <option value="">{t.obsPickSource || 'Choose a source…'}</option> 
                            {obsData.sources.map((s: any) => (<option key={s.inputName} value={s.inputName}>{s.inputName}</option>))} 
                        </select> 
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.obsFilterName || 'Filter name'}</label>
                        <input type="text" value={step.config.filterName || ''} onChange={(e) => updateActionStepConfig(step.id, 'filterName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium text-white outline-none focus:border-current-accent" placeholder={t.obsFilterExample || 'e.g. Color Correction'} />
                    </div>
                    <OnOffChoice value={step.config.filterEnabled} set={(v) => updateActionStepConfig(step.id, 'filterEnabled', v)}
                        on={t.obsEnable || 'Enable'} off={t.obsDisable || 'Disable'} onTone="green" offTone="red" t={t} />
                </div>
            )}

            {step.type === 'obs_set_volume' && (
                <div className="space-y-3">
                    <div className="space-y-1"> 
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Audio Source</label> 
                        <select value={step.config.sourceName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sourceName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"> 
                            <option value="">Select Audio Source...</option> 
                            {obsData.sources.filter((s:any) => s.inputKind?.includes('capture') || s.inputKind?.includes('source')).map((s: any) => (<option key={s.inputName} value={s.inputName}>{s.inputName}</option>))} 
                        </select> 
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex justify-between">
                            <span>Volume (dB)</span>
                            <span>{step.config.volumeDb !== undefined ? step.config.volumeDb : 0} dB</span>
                        </label>
                        <input type="range" min="-100" max="0" step="0.5" value={step.config.volumeDb !== undefined ? step.config.volumeDb : 0} onChange={(e) => updateActionStepConfig(step.id, 'volumeDb', parseFloat(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-current-accent" />
                    </div>
                </div>
            )}

            {step.type === 'obs_set_mute' && (
                <div className="space-y-3">
                    <div className="space-y-1"> 
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Audio Source</label> 
                        <select value={step.config.sourceName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sourceName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"> 
                            <option value="">Select Audio Source...</option> 
                            {obsData.sources.filter((s:any) => s.inputKind?.includes('capture') || s.inputKind?.includes('source')).map((s: any) => (<option key={s.inputName} value={s.inputName}>{s.inputName}</option>))} 
                        </select> 
                    </div>
                    <OnOffChoice value={step.config.muted} set={(v) => updateActionStepConfig(step.id, 'muted', v)}
                        on={<><VolumeX size={14} className="inline mr-1" /> {t.obsMute || 'Mute'}</>}
                        off={<><Volume2 size={14} className="inline mr-1" /> {t.obsUnmute || 'Unmute'}</>}
                        onTone="red" offTone="green" t={t} />
                </div>
            )}

            {step.type === 'obs_save_replay' && (
                <div className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl flex items-center justify-center gap-2">
                    <Save size={16} className="text-current-accent" />
                    <span className="text-xs font-bold text-zinc-300">Triggers Replay Buffer Save</span>
                </div>
            )}

            {/*
              It ends the stream, so it says so — and says where it belongs:
              behind a command only you or your mods can run, or a dock button,
              never one any viewer can type.
            */}
            {step.type === 'obs_stop_stream' && (
                <div className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-1.5" data-step="obs-stop-stream">
                    <div className="flex items-center justify-center gap-2">
                        <Square size={16} className="text-red-400" />
                        <span className="text-xs font-bold text-zinc-300">{t.obsStopStreamDoes || 'Ends the stream in OBS'}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-snug text-center">
                        {t.obsStopStreamHint || 'Does nothing if OBS is not streaming. Put it behind a command only you or your mods can use, or a dock button.'}
                    </p>
                </div>
            )}

            {step.type === 'obs_set_browser_url' && (
                <div className="space-y-3">
                    <div className="space-y-1"> 
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Browser Source</label> 
                        <select value={step.config.sourceName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sourceName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"> 
                            <option value="">Select Browser Source...</option> 
                            {obsData.sources.filter((s:any) => s.inputKind === 'browser_source').map((s: any) => (<option key={s.inputName} value={s.inputName}>{s.inputName}</option>))} 
                        </select> 
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">New URL</label>
                        <input type="text" value={step.config.browserUrl || ''} onChange={(e) => updateActionStepConfig(step.id, 'browserUrl', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-zinc-300 focus:border-current-accent outline-none" placeholder="https://..." />
                    </div>
                </div>
            )}

            {step.type === 'obs_set_transform' && (
                <div className="space-y-3">
                    <div className="space-y-1"> 
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Source</label> 
                        <select value={step.config.sourceName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sourceName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"> 
                            <option value="">Select Source...</option> 
                            {obsData.sources.map((s: any) => (<option key={s.inputName} value={s.inputName}>{s.inputName}</option>))} 
                        </select> 
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-600">Position X</label>
                            <input type="number" value={step.config.positionX ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'positionX', parseFloat(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white" placeholder="No Change" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-600">Position Y</label>
                            <input type="number" value={step.config.positionY ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'positionY', parseFloat(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white" placeholder="No Change" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-600">Scale</label>
                            <input type="number" step="0.1" value={step.config.scale ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'scale', parseFloat(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white" placeholder="No Change" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-600">Rotation</label>
                            <input type="number" value={step.config.rotation ?? ''} onChange={(e) => updateActionStepConfig(step.id, 'rotation', parseFloat(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white" placeholder="No Change" />
                        </div>
                    </div>
                </div>
            )}

            {step.type === 'obs_text' && (
                <div className="space-y-3">
                    <div className="space-y-1"> 
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Text Source</label> 
                        <select value={step.config.sourceName || ''} onChange={(e) => updateActionStepConfig(step.id, 'sourceName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"> 
                            <option value="">Select Text Source...</option> 
                            {obsData.sources.filter((s:any) => s.inputKind === 'text_gdiplus_v2').map((s: any) => (<option key={s.inputName} value={s.inputName}>{s.inputName}</option>))} 
                        </select> 
                    </div>
                    <div className="space-y-1"> 
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">New Text Content</label> 
                        <input type="text" value={step.config.textContent || ''} onChange={(e) => updateActionStepConfig(step.id, 'textContent', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-medium focus:border-current-accent outline-none" /> 
                    </div> 
                </div>
            )}

            {step.type === 'trigger_action' && (
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Select Action to Trigger</label>
                    <select 
                        value={step.config.actionId || ''} 
                        onChange={(e) => updateActionStepConfig(step.id, 'actionId', e.target.value)} 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-current-accent"
                    >
                        <option value="">Select Action...</option>
                        {streamActions.filter(a => a.id !== step.id).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                    <p className="text-[9px] text-zinc-600 mt-1">{t.executesAction}</p>
                </div>
            )}
            </div>
        </div>
     );
};

interface ActionsViewProps {
  /** What the pixel avatars drawn in the Pixel avatars tab can do, for the "Avatar: do something" step. */
  avatarActions?: string[];
  /** Text slots on the omnibar, so a step can target one by name. */
  omnibarSlots?: { id: string; name?: string; label: string; text: string }[];
  /** Layouts, for the text layer step's layout and layer pickers. */
  layouts?: LayoutRef[];
  /** Every goal slot on every bar, for the goal step's picker. */
  goalSlots?: GoalSlotRef[];
  /** The saved countdowns, for the Countdown step and the Countdown finished trigger. */
  countdownPresets?: CountdownPresetRef[];
  /** The scene types, for the Omnilayer step and the "layout went live" trigger. */
  sceneTypes?: SceneTypeRef[];
  /** Who is in each remote player seat, first seat first, for the player on screen step. */
  seatNames?: string[];
  /** The Discord call and the people known, for the call triggers' person picker. */
  voice?: any;
  regulars?: { name?: string; discordId?: string }[];
  listServerMembers?: () => Promise<{ id: string; name: string }[]>;
  streamActions: StreamAction[];
  setStreamActions: React.Dispatch<React.SetStateAction<StreamAction[]>>;
  isActionModalOpen: boolean;
  setIsActionModalOpen: (open: boolean) => void;
  currentAction: Partial<StreamAction>;
  setCurrentAction: React.Dispatch<React.SetStateAction<Partial<StreamAction>>>;
  commands: Command[];
  obsData: any;
  availableRewards: any[];
  fetchTwitchRewards: () => void;
  handleSaveAction: () => void;
  handleDeleteAction: (id: string) => void;
  handleTestAction: (action: StreamAction) => void;
  handleOpenActionModal: (action?: StreamAction) => void;
  /** Opens the shared command editor. `onSaved` receives the saved command's id. */
  handleOpenCommandModal: (cmd?: Command, onSaved?: (id: string) => void) => void;
  addActionStep: (type: ActionStepType, parentId?: string, branch?: 'then' | 'else') => void;
  removeActionStep: (stepId: string) => void;
  moveActionStep: (stepId: string, gap: number) => void;
  updateActionStepConfig: (stepId: string, key: string, value: any) => void;
  updateTrigger: (category: TriggerCategory, type: TriggerType) => void;
  updateTriggerConfig: (key: string, value: any) => void;
  activeTheme: ThemeConfig;
  discordEmojis?: any[];
  /** For the "send as the bot" step's channel and role pickers. */
  discordChannels?: any[];
  discordRoles?: any[];
  t: any;
  searchCategories: (query: string) => Promise<any[]>;
  /** Later steps waiting their turn, soonest first (server/engine/later.js), and the Waiting list's two buttons. */
  laterSteps?: LaterStepRef[];
  laterControl?: (op: 'run' | 'cancel', key: string) => Promise<any>;
  /** Uploads a file to the server's media, for the Play a sound step. */
  uploadAsset?: (file: File) => Promise<any>;
}

/** A Later step waiting its turn, as the server lists it. */
type LaterStepRef = { key: string; actionId: string; actionName: string; stepId: string; mode: 'after' | 'streamEnd'; dueAt: number | null; setAt: number; user: string; input: string };

/** How long until a moment, the way the Waiting list says it: 4 h 59 min, 12 min, 40 s. */
const timeLeft = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
};

/*
  The Later steps waiting their turn: what each belongs to, who set it off,
  how long is left, and the two things that can be done about one. Shown only
  while something waits, since an empty list of nothing is clutter.
*/
const LaterWaitingList = ({ steps, control, t }: { steps: LaterStepRef[]; control?: (op: 'run' | 'cancel', key: string) => Promise<any>; t: any }) => {
  // Read at every render, and rendered every second while anything waits: a
  // clock kept from when the list first appeared said 30 s for a 20 s wait.
  const [, setTick] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!steps.length) return undefined;
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, [steps.length]);
  if (!steps.length) return null;
  const now = Date.now();
  const act = (op: 'run' | 'cancel', key: string) => {
    setError('');
    control?.(op, key).catch((err: any) => setError(refusalWords(t, err)));
  };
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3" data-later-waiting>
      <div className="flex items-center gap-2">
        <AlarmClock size={14} className="text-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{fill(t.laterWaitingTitle || 'Waiting to run ({n})', { n: steps.length })}</span>
      </div>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.key} data-later-row={s.key} className="flex flex-wrap items-center gap-3 bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2">
            <div className="flex-1 min-w-[160px]">
              <div className="text-xs font-bold text-zinc-200">{s.actionName || (t.laterNoAction || 'A step run on its own')}</div>
              <div className="text-[10px] text-zinc-500">
                {s.mode === 'streamEnd' ? (t.laterWhenStreamEnds || 'When the stream ends') : fill(t.laterIn || 'In {time}', { time: timeLeft((s.dueAt || 0) - now) })}
                {s.user ? ` · ${fill(t.laterBy || 'set off by {user}', { user: s.user })}` : ''}
                {s.input ? ` · “${s.input.length > 40 ? `${s.input.slice(0, 40)}…` : s.input}”` : ''}
              </div>
            </div>
            <button onClick={() => act('run', s.key)} data-later-run className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-white text-[10px] font-bold text-zinc-300 flex items-center gap-1 transition-colors"><Play size={11} /> {t.laterRunNow || 'Run now'}</button>
            <button onClick={() => act('cancel', s.key)} data-later-cancel className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500 hover:text-white text-[10px] font-bold text-zinc-300 flex items-center gap-1 transition-colors"><X size={11} /> {t.laterCancel || 'Cancel'}</button>
          </div>
        ))}
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
};

export const ActionsView: React.FC<ActionsViewProps> = ({
  avatarActions = [],
  omnibarSlots,
  layouts,
  goalSlots,
  countdownPresets,
  sceneTypes = [],
  seatNames = [],
  voice,
  regulars = [],
  listServerMembers,
  streamActions,
  isActionModalOpen,
  setIsActionModalOpen,
  currentAction,
  setCurrentAction,
  commands,
  obsData,
  availableRewards,
  fetchTwitchRewards,
  handleSaveAction,
  handleDeleteAction,
  handleTestAction,
  handleOpenActionModal,
  handleOpenCommandModal,
  addActionStep,
  removeActionStep,
  moveActionStep,
  updateActionStepConfig,
  updateTrigger,
  updateTriggerConfig,
  activeTheme,
  discordEmojis,
  discordChannels,
  discordRoles,
  t,
  searchCategories,
  laterSteps = [],
  laterControl,
  uploadAsset,
}) => {
  /*
    Where the step menus add: the action's own steps, or a list inside a step
    that asked with its "Add steps here". A target that has since been
    deleted is no target — the step goes to the action's own list rather
    than nowhere — and opening another action starts at its own list.
  */
  const [addInto, setAddInto] = useState<AddTarget | null>(null);
  useEffect(() => { setAddInto(null); }, [currentAction?.id, isActionModalOpen]);
  const holdsStep = (steps: ActionStep[] | undefined, id: string): boolean => (steps || []).some((s) => s.id === id || holdsStep(s.thenActions, id) || holdsStep(s.elseActions, id));
  const addStep = (type: ActionStepType) => {
    if (addInto && holdsStep(currentAction.actions, addInto.parentId)) addActionStep(type, addInto.parentId, addInto.branch);
    else { setAddInto(null); addActionStep(type); }
  };
  // Card or row. Device-local like the Commands screen's equivalent, and kept
  // under its own key so the two screens can be set independently.
  // The action's own steps; a condition's then and else have theirs (StepRenderer).
  const stepOrder = useDragOrder(({ id, gap }) => moveActionStep(id, gap));
  const [layout, setLayoutState] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('actions_layout') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const setLayout = (next: 'grid' | 'list') => {
    setLayoutState(next);
    try {
      localStorage.setItem('actions_layout', next);
    } catch {
      /* private browsing: the choice just will not survive a reload */
    }
  };

  const [sort, setSortState] = useState<SortMode>(() => {
    try {
      return localStorage.getItem('actions_sort') === 'name' ? 'name' : 'created';
    } catch {
      return 'created';
    }
  });

  const setSort = (next: SortMode) => {
    setSortState(next);
    try {
      localStorage.setItem('actions_sort', next);
    } catch {
      /* private browsing: the choice just will not survive a reload */
    }
  };

  // Flow filters are deliberately not persisted. Layout and sort are
  // preferences; a filter is a temporary narrowing, and one restored silently
  // on load just reads as "half my actions disappeared".
  const [flowFilters, setFlowFilters] = useState<string[]>([]);

  const toggleFlowFilter = (id: string) => setFlowFilters(
    (prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]),
  );

  const stepTypesByAction = React.useMemo(
    () => new Map(streamActions.map((a) => [a.id, [...collectStepTypes(a.actions)]])),
    [streamActions],
  );

  const filterCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of FLOW_FILTERS) {
      counts[f.id] = streamActions.filter(
        (a) => (stepTypesByAction.get(a.id) || []).some(f.match),
      ).length;
    }
    return counts;
  }, [streamActions, stepTypesByAction]);

  // No selection means no narrowing. Several selected is an OR: picking Twitch
  // and OBS shows anything touching either, not only actions touching both.
  const filteredActions = flowFilters.length === 0
    ? streamActions
    : streamActions.filter((a) => {
      const types = stepTypesByAction.get(a.id) || [];
      return FLOW_FILTERS.some((f) => flowFilters.includes(f.id) && types.some(f.match));
    });

  // Never sorts the source array in place — it is state owned further up.
  const visibleActions = sortForDisplay(filteredActions, sort);

  const toggleButton = (active: boolean, onClick: () => void, label: string, icon: React.ReactNode) => (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`p-2 rounded-lg transition-colors ${active ? 'bg-current-accent/10 text-current-accent' : 'text-zinc-600 hover:text-zinc-300'}`}
    >
      {icon}
    </button>
  );

  const layoutButton = (mode: 'grid' | 'list', label: string, icon: React.ReactNode) =>
    toggleButton(layout === mode, () => setLayout(mode), label, icon);

  const sortButton = (mode: SortMode, label: string, icon: React.ReactNode) =>
    toggleButton(sort === mode, () => setSort(mode), label, icon);

  const [pickerState, setPickerState] = useState<{ stepId: string, field: string, top: number, left: number } | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          setActiveDropdown(null);
      };
      document.addEventListener('click', handleClickOutside);
      return () => {
          document.removeEventListener('click', handleClickOutside);
      };
  }, []);

  const handleOpenPicker = (stepId: string, field: string, e: React.MouseEvent) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = rect.left;
      
      if (top + 400 > window.innerHeight) top = rect.top - 408; 
      if (left + 320 > window.innerWidth) left = window.innerWidth - 340;

      setPickerState({ stepId, field, top, left });
  };

  const handleEmojiSelect = (emoji: string) => {
      if (!pickerState) return;
      const { stepId, field } = pickerState;
      const findStep = (steps: ActionStep[]): ActionStep | undefined => {
          for (const s of steps) {
              if (s.id === stepId) return s;
              if (s.thenActions) { const res = findStep(s.thenActions); if (res) return res; }
              if (s.elseActions) { const res = findStep(s.elseActions); if (res) return res; }
          }
          return undefined;
      };
      const step = findStep(currentAction.actions || []);
      if (step) {
          const currentVal = step.config[field as keyof typeof step.config] || '';
          updateActionStepConfig(stepId, field, currentVal + emoji);
      }
  };

  const TRIGGER_CATEGORIES = [
      { value: 'command', label: t.triggerCommand, icon: Terminal, color: 'text-amber-500' },
      { value: 'twitch', label: t.triggerTwitch, icon: TwitchIcon, color: 'text-[#9146FF]' },
      { value: 'youtube', label: t.triggerYoutube || 'YouTube', icon: YouTubeIcon, color: 'text-[#FF0000]' },
      { value: 'tiktok', label: t.triggerTiktok, icon: TikTokIcon, color: 'text-[#ff0050]' },
      { value: 'chat', label: t.triggerChat || 'Chat', icon: MessageSquare, color: 'text-emerald-400' },
      { value: 'spotify', label: t.triggerSpotify, icon: SpotifyIcon, color: 'text-[#1DB954]' },
      { value: 'obs', label: t.triggerObs, icon: Monitor, color: 'text-zinc-400' },
      { value: 'discord', label: t.triggerDiscord || 'Discord', icon: DiscordIcon, color: 'text-[#5865F2]' },
      { value: 'system', label: t.triggerSystem || 'Stream tools', icon: Timer, color: 'text-sky-400' },
  ];

  const TRIGGER_TYPES: Record<string, { value: string, label: string, icon: any, color?: string }[]> = {
      twitch: [
          { value: 'twitch_follow', label: t.triggerFollow, icon: Heart, color: 'text-rose-500' },
          { value: 'twitch_sub', label: t.triggerSub, icon: Star, color: 'text-purple-500' },
          { value: 'twitch_cheer', label: t.triggerCheer, icon: Coins, color: 'text-amber-500' },
          { value: 'twitch_raid', label: t.triggerRaid, icon: Users, color: 'text-orange-500' },
          { value: 'twitch_redemption', label: t.triggerRedeem, icon: Ticket, color: 'text-emerald-500' },
          { value: 'twitch_sub_gift_bulk', label: t.triggerGiftBomb || 'Gifted subs (a bundle)', icon: Gift, color: 'text-purple-400' },
          { value: 'twitch_hype_train_begin', label: t.triggerHypeBegin || 'Hype Train started', icon: TrainFront, color: 'text-fuchsia-400' },
          { value: 'twitch_hype_train_level', label: t.triggerHypeLevel || 'Hype Train reached a new level', icon: TrainFront, color: 'text-fuchsia-400' },
          { value: 'twitch_hype_train_end', label: t.triggerHypeEnd || 'Hype Train ended', icon: TrainFront, color: 'text-zinc-400' },
          { value: 'twitch_stream_online', label: t.triggerTwitchOnline || 'Went live on Twitch', icon: Radio, color: 'text-green-500' },
          { value: 'twitch_stream_offline', label: t.triggerTwitchOffline || 'Stream ended on Twitch', icon: X, color: 'text-red-500' },
      ],
      // YouTube's own: a Super Chat or Super Sticker, a new member or a milestone, gifted memberships.
      youtube: [
          { value: 'youtube_cheer', label: t.triggerSuperChat || 'Super Chat or Super Sticker', icon: Coins, color: 'text-amber-500' },
          { value: 'youtube_sub', label: t.triggerYoutubeMember || 'New member or milestone', icon: Star, color: 'text-emerald-400' },
          { value: 'youtube_sub_gift_bulk', label: t.triggerYoutubeGifts || 'Gifted memberships', icon: Gift, color: 'text-pink-400' },
      ],
      // Somebody arriving: their first words this stream, and their first words ever, on any stream chat.
      chat: [
          { value: 'chat_message', label: t.triggerChatMessage || 'Somebody says something', icon: MessageSquareText, color: 'text-emerald-400' },
          { value: 'chat_first_of_stream', label: t.triggerFirstOfStream || 'First message this stream', icon: Sparkles, color: 'text-emerald-400' },
          { value: 'chat_first_ever', label: t.triggerFirstEver || 'First message ever', icon: Sparkles, color: 'text-amber-400' },
      ],
      tiktok: [
          { value: 'tiktok_follow', label: t.triggerFollow, icon: Heart, color: 'text-rose-500' },
          { value: 'tiktok_sub', label: t.triggerSub, icon: Star, color: 'text-yellow-400' },
          { value: 'tiktok_gift', label: t.triggerGift, icon: Gift, color: 'text-pink-500' },
          { value: 'tiktok_share', label: t.triggerShare, icon: Share2, color: 'text-blue-400' },
      ],
      spotify: [
          { value: 'spotify_track_change', label: t.triggerTrackChange, icon: Music, color: 'text-[#1DB954]' },
          { value: 'spotify_played', label: t.triggerMusicPlay, icon: Play, color: 'text-white' },
          { value: 'spotify_paused', label: t.triggerMusicPause, icon: Pause, color: 'text-zinc-400' },
      ],
      obs: [
          { value: 'obs_scene_changed', label: t.triggerSceneChange || 'Scene Active', icon: Layers, color: 'text-yellow-500' }, // NEW
          { value: 'obs_stream_started', label: t.triggerStreamStart, icon: Radio, color: 'text-green-500' },
          { value: 'obs_stream_stopped', label: t.triggerStreamStop, icon: X, color: 'text-red-500' },
          { value: 'obs_recording_started', label: t.triggerRecStart, icon: Disc, color: 'text-red-500' },
          { value: 'obs_recording_stopped', label: t.triggerRecStop, icon: Square, color: 'text-zinc-400' },
      ],
      // Somebody joining your Discord server, or boosting it — whether or not a welcome is posted.
      discord: [
          { value: 'discord_join', label: t.triggerDiscordJoin || 'Joined the Discord', icon: Users, color: 'text-[#5865F2]' },
          { value: 'discord_boost', label: t.triggerDiscordBoost || 'Boosted the Discord', icon: Star, color: 'text-pink-400' },
          // The call on the Voice call screen: only actions, never alerts (server/platforms/discord-voice.js).
          { value: 'discord_call_join', label: t.triggerCallJoin || 'Joined the call', icon: Headphones, color: 'text-[#5865F2]' },
          { value: 'discord_call_leave', label: t.triggerCallLeave || 'Left the call', icon: Headphones, color: 'text-zinc-400' },
          { value: 'discord_call_count', label: t.triggerCallCount || 'The call reaches a number of people', icon: Users, color: 'text-[#5865F2]' },
          { value: 'discord_call_talking', label: t.triggerCallTalking || 'Started talking in the call', icon: Mic, color: 'text-emerald-400' },
      ],
      // Moments the app itself decides: the countdown reaching zero, a poll opening and closing.
      system: [
          { value: 'countdown_finished', label: t.triggerCountdownFinished || 'Countdown finished', icon: Timer, color: 'text-sky-400' },
          { value: 'layout_changed', label: t.triggerLayoutChanged || 'Layout went live (Omnilayer)', icon: MonitorPlay, color: 'text-sky-400' },
          { value: 'poll_opened', label: t.triggerPollOpened || 'Poll opened', icon: BarChart3, color: 'text-sky-400' },
          { value: 'poll_closed', label: t.triggerPollClosed || 'Poll closed', icon: BarChart3, color: 'text-sky-400' },
          { value: 'level_up', label: t.triggerLevelUp || 'Somebody levelled up', icon: Trophy, color: 'text-amber-400' },
          { value: 'timer_interval', label: t.triggerRepeat || 'Every few minutes', icon: Repeat, color: 'text-sky-400' },
          { value: 'timer_schedule', label: t.triggerSchedule || 'On set days, at a set time', icon: CalendarDays, color: 'text-sky-400' },
          { value: 'giveaway_winner', label: t.triggerGiveawayWinner || 'A giveaway winner was drawn', icon: Gift, color: 'text-amber-400' },
          { value: 'points_redeem', label: t.triggerPointsRedeem || 'Somebody spent points in the shop', icon: Gift, color: 'text-amber-400' },
          { value: 'chat_highlight', label: t.triggerChatHighlight || 'Chat went wild (a highlight)', icon: Gift, color: 'text-orange-400' },
      ],
  };

  const currentCategory = TRIGGER_CATEGORIES.find(c => c.value === currentAction.trigger?.category) || TRIGGER_CATEGORIES[0];
  const currentTypeList = TRIGGER_TYPES[currentCategory.value] || [];
  const [isVariablesOpen, setIsVariablesOpen] = useState(false);

  const currentType = currentTypeList.find(t => t.value === currentAction.trigger?.type) || (currentTypeList.length > 0 ? currentTypeList[0] : { value: 'unknown', label: 'Unknown', icon: AlertTriangle });

  return (
    <DiscordPicksProvider value={{ channels: discordChannels || [], roles: discordRoles || [] }}>
    <div className="animate-fade-in space-y-8 relative">
      {pickerState && (
          <>
            <div className="fixed inset-0 z-[9990] bg-transparent" onClick={() => setPickerState(null)} />
            <EmojiPicker 
                style={{ top: pickerState.top, left: pickerState.left }}
                onSelect={handleEmojiSelect}
                onClose={() => setPickerState(null)}
                customEmojis={discordEmojis}
            />
          </>
      )}
      
      {isActionModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`max-w-4xl w-full h-[90vh] glass-panel rounded-[40px] border ${activeTheme.borderClass} ${activeTheme.panelClass} shadow-2xl flex flex-col overflow-hidden`}>
            <VariablePicker
              open={isVariablesOpen}
              onClose={() => setIsVariablesOpen(false)}
              triggerType={currentAction.trigger?.type}
              triggerLabel={currentType?.value === 'unknown' ? currentCategory?.label : currentType?.label}
              t={t}
            />
            <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-current-accent/10 rounded-xl text-current-accent"><Zap size={20} /></div>
                <h2 className="text-xl font-black uppercase tracking-tight">{t.interactionEditor}</h2>
              </div>
              <button onClick={() => setIsActionModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8" ref={dropdownRef}>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.actionName}</label>
                      <input type="text" value={currentAction.name || ''} onChange={(e) => setCurrentAction({ ...currentAction, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold focus:border-current-accent outline-none text-white" placeholder={t.actionNamePlaceholder} />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.commandTrigger}</label>
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-3">
                          
                          <SelectionDropdown 
                              id="trigger-category"
                              selected={currentCategory}
                              options={TRIGGER_CATEGORIES}
                              colorClass={currentCategory.color}
                              activeDropdown={activeDropdown}
                              setActiveDropdown={setActiveDropdown}
                              onSelect={(val) => updateTrigger(val as TriggerCategory, val === 'command' ? 'command_trigger' : val === 'twitch' ? 'twitch_follow' : val === 'youtube' ? 'youtube_cheer' : val === 'chat' ? 'chat_message' : val === 'tiktok' ? 'tiktok_follow' : val === 'spotify' ? 'spotify_track_change' : val === 'system' ? 'countdown_finished' : val === 'discord' ? 'discord_join' : 'obs_stream_started')}
                          />

                          {currentCategory.value !== 'command' && (
                              <SelectionDropdown 
                                  id="trigger-type"
                                  selected={currentType}
                                  options={currentTypeList}
                                  colorClass={currentType.color || 'text-white'}
                                  activeDropdown={activeDropdown}
                                  setActiveDropdown={setActiveDropdown}
                                  onSelect={(val) => updateTrigger(currentCategory.value as TriggerCategory, val as TriggerType)}
                              />
                          )}

                          {currentAction.trigger?.category === 'command' && (() => {
                             const selectedId = currentAction.trigger.config.commandId || '';
                             const selected = commands.find(c => c.id === selectedId);
                             // How many *other* actions already fire on this command. Linking
                             // two actions to one command is legal, but doing it by accident
                             // gives you two things running on one trigger word.
                             const alsoUsedBy = streamActions.filter(
                               a => a.id !== currentAction.id
                                 && a.trigger?.type === 'command_trigger'
                                 && a.trigger.config?.commandId === selectedId,
                             ).length;
                             return (
                               <div className="space-y-2">
                                  <div className="flex gap-2">
                                     <select value={selectedId} onChange={(e) => updateTriggerConfig('commandId', e.target.value)} className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs font-mono text-zinc-400 outline-none">
                                        <option value="">Select Command...</option>
                                        {/* Triggers in the label, because that is what you search by. */}
                                        {commands.map(c => (
                                          <option key={c.id} value={c.id}>
                                            {c.name}{c.triggers?.length ? ` — ${c.triggers.join(' ')}` : ''}
                                          </option>
                                        ))}
                                     </select>
                                     <button
                                        onClick={() => handleOpenCommandModal(undefined, (id) => updateTriggerConfig('commandId', id))}
                                        title={t.newCommand}
                                        className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest flex-shrink-0"
                                     >
                                        <Plus size={12} /> {t.newCommand}
                                     </button>
                                  </div>

                                  {selected && (
                                    <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 flex items-center gap-3">
                                       <div className="flex-1 min-w-0">
                                          <div className="text-[10px] font-mono text-zinc-400 truncate">{selected.triggers?.join('  ') || 'No triggers'}</div>
                                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                             {selected.permissions?.anyone ? (
                                               <span className="px-2 py-0.5 rounded bg-zinc-800 text-[8px] font-black uppercase text-zinc-400">{t.permAnyone}</span>
                                             ) : (
                                               <>
                                                 {selected.permissions?.broadcaster && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-[8px] font-black uppercase text-purple-500">{t.permOwner}</span>}
                                                 {selected.permissions?.moderators && <span className="px-2 py-0.5 rounded bg-rose-500/10 text-[8px] font-black uppercase text-rose-500">{t.permMods}</span>}
                                                 {selected.permissions?.vips && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-[8px] font-black uppercase text-amber-500">{t.permVips}</span>}
                                                 {selected.permissions?.subscribers && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-[8px] font-black uppercase text-blue-500">{t.permSubs}</span>}
                                               </>
                                             )}
                                             {(selected.globalCooldown || selected.userCooldown) ? (
                                               <span className="px-2 py-0.5 rounded bg-zinc-800 text-[8px] font-black uppercase text-zinc-500 flex items-center gap-1"><Clock size={8} /> {selected.globalCooldown || 0}s/{selected.userCooldown || 0}s</span>
                                             ) : null}
                                             {alsoUsedBy > 0 && (
                                               <span className="px-2 py-0.5 rounded bg-amber-500/10 text-[8px] font-black uppercase text-amber-500 flex items-center gap-1" title={t.commandAlsoUsedHint}>
                                                 <AlertTriangle size={8} /> +{alsoUsedBy}
                                               </span>
                                             )}
                                          </div>
                                       </div>
                                       <button
                                          onClick={() => handleOpenCommandModal(selected)}
                                          title={t.editCommand}
                                          className="p-2 text-zinc-500 hover:text-white bg-zinc-900/50 rounded-lg flex-shrink-0"
                                       >
                                          <Edit2 size={12} />
                                       </button>
                                    </div>
                                  )}
                               </div>
                             );
                          })()}
                          {currentAction.trigger?.type === 'twitch_cheer' && (
                              <input type="number" placeholder={`${t.minBits} (e.g. 100)`} value={currentAction.trigger.config.minBits || ''} onChange={(e) => updateTriggerConfig('minBits', parseInt(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                          )}
                          {currentAction.trigger?.type === 'chat_message' && (() => {
                              const c = cleanChatTrigger(currentAction.trigger.config);
                              const broken = c.match === 'regex' && c.text ? patternError(c.text) : '';
                              const field = "w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none";
                              const modes: [string, string][] = [['words', t.chatMatchWords || 'Any of these words'], ['starts', t.chatMatchStarts || 'Starts with'], ['exact', t.chatMatchExact || 'Is exactly'], ['regex', t.chatMatchRegex || 'Matches a pattern']];
                              const where: [string, string][] = [['any', t.chatOnAny || 'Any chat'], ['twitch', 'Twitch'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['kick', 'Kick'], ['discord', 'Discord']];
                              return (
                                  <div className="space-y-2" data-chat-trigger>
                                      <select value={c.match} onChange={(e) => updateTriggerConfig('match', e.target.value)} className={field} data-trigger-field="match">
                                          {modes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                      </select>
                                      <input value={currentAction.trigger.config.text || ''} onChange={(e) => updateTriggerConfig('text', e.target.value)} placeholder={c.match === 'words' ? (t.chatMatchWordsExample || 'gg, good game, wp') : c.match === 'regex' ? 'https?://' : 'hola'} className={`${field} font-mono ${broken ? 'border-rose-500' : ''}`} data-trigger-field="text" />
                                      {broken && <p className="text-[9px] text-rose-400" data-pattern-error>{fill(t.chatPatternBroken || 'That pattern does not work: {why}', { why: broken })}</p>}
                                      <select value={c.platform} onChange={(e) => updateTriggerConfig('platform', e.target.value)} className={field} data-trigger-field="platform">
                                          {where.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                      </select>
                                      <div className="grid grid-cols-2 gap-2">
                                          <label className="space-y-1">
                                              <span className="text-[9px] font-bold text-zinc-500">{t.chatCooldown || 'Wait between (seconds)'}</span>
                                              <input type="number" min={0} value={currentAction.trigger.config.cooldown ?? c.cooldown} onChange={(e) => updateTriggerConfig('cooldown', e.target.value === '' ? '' : Number(e.target.value))} className={field} data-trigger-field="cooldown" />
                                          </label>
                                          <label className="space-y-1">
                                              <span className="text-[9px] font-bold text-zinc-500">{t.chatUserCooldown || 'Per person (seconds)'}</span>
                                              <input type="number" min={0} value={currentAction.trigger.config.userCooldown ?? c.userCooldown} onChange={(e) => updateTriggerConfig('userCooldown', e.target.value === '' ? '' : Number(e.target.value))} className={field} data-trigger-field="userCooldown" />
                                          </label>
                                      </div>
                                      <label className="flex items-center gap-2 text-[10px] text-zinc-400">
                                          <input type="checkbox" checked={c.streamerToo} onChange={(e) => updateTriggerConfig('streamerToo', e.target.checked)} data-trigger-field="streamerToo" />
                                          {t.chatStreamerToo || 'Also when I say it'}
                                      </label>
                                      <p className="text-[9px] text-zinc-600">{t.chatMessageHint || 'Never the channel’s bot. Not you unless ticked: what the app sends from your account comes back as your own chat, so a reply could set itself off. {message} is the whole message, {match} what matched, and a pattern’s groups are {match.1}, {match.2}.'}</p>
                                  </div>
                              );
                          })()}
                          {(currentAction.trigger?.type === 'twitch_sub_gift_bulk' || currentAction.trigger?.type === 'youtube_sub_gift_bulk') && (
                              <div className="space-y-1">
                                  <input type="number" min={0} placeholder={t.minGifts || 'At least this many gifts (empty: any)'} value={currentAction.trigger.config.minGifts || ''} onChange={(e) => updateTriggerConfig('minGifts', e.target.value === '' ? '' : Number(e.target.value))} data-trigger-field="minGifts" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                                  <p className="text-[9px] text-zinc-600">{t.giftBombHint || 'Once per bundle, with {event.count} gifts. Each gift is still a sub of its own for the Sub trigger.'}</p>
                              </div>
                          )}
                          {currentAction.trigger?.type === 'youtube_cheer' && (
                              <div className="space-y-1">
                                  <input type="number" min={0} placeholder={t.minSuperChat || 'At least this much, in its own currency (empty: any)'} value={currentAction.trigger.config.minValue || ''} onChange={(e) => updateTriggerConfig('minValue', e.target.value === '' ? '' : Number(e.target.value))} data-trigger-field="minValue" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                                  <p className="text-[9px] text-zinc-600">{t.superChatHint || '{event.amount} is the amount as YouTube shows it, {message} what they wrote.'}</p>
                              </div>
                          )}
                          {currentAction.trigger?.type === 'youtube_sub' && (
                              <p className="text-[9px] text-zinc-600">{t.youtubeMemberHint || 'A new member, or a member showing a milestone: then {event.months} is how many months.'}</p>
                          )}
                          {(currentAction.trigger?.type || '').startsWith('twitch_hype_train_') && (
                              <p className="text-[9px] text-zinc-600">{t.hypeTrainHint || '{event.level} is the level it is at, {event.total} the points so far, and {user} the top contributor.'}</p>
                          )}
                          {(currentAction.trigger?.type === 'twitch_stream_online' || currentAction.trigger?.type === 'twitch_stream_offline') && (
                              <p className="text-[9px] text-zinc-600">{t.twitchLiveHint || 'When Twitch itself says the stream started or ended. The OBS triggers fire for any stream OBS sends, a test one too.'}</p>
                          )}
                          {(currentAction.trigger?.type === 'chat_first_of_stream' || currentAction.trigger?.type === 'chat_first_ever') && (
                              <p className="text-[9px] text-zinc-600">{currentAction.trigger?.type === 'chat_first_of_stream'
                                  ? (t.firstOfStreamHint || 'The first time somebody talks during a stream, on Twitch, YouTube, TikTok or Kick. Only while a stream is on. {message} is what they said, {event.streak} how many streams in a row they have been at.')
                                  : (t.firstEverHint || 'The first time somebody ever talks in your chat. A brand-new chatter during a stream also sets off "First message this stream". {message} is what they said.')}</p>
                          )}
                          {currentAction.trigger?.type === 'tiktok_gift' && (
                              <input type="text" placeholder={`${t.giftName} (e.g. Rose)`} value={currentAction.trigger.config.giftName || ''} onChange={(e) => updateTriggerConfig('giftName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                          )}
                          {currentAction.trigger?.type === 'twitch_redemption' && (
                              <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                      <span className="text-[9px] font-bold text-zinc-500">{t.reward}</span>
                                      <button onClick={fetchTwitchRewards} className="text-[9px] text-current-accent hover:underline">{t.refreshData}</button>
                                  </div>
                                  <select value={currentAction.trigger.config.rewardId || ''} onChange={(e) => updateTriggerConfig('rewardId', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs font-mono text-zinc-400 outline-none">
                                      <option value="">{t.anyReward}</option>
                                      {availableRewards.map((r: any) => <option key={r.id} value={r.id}>{r.title}</option>)}
                                  </select>
                              </div>
                          )}
                          
                          {currentAction.trigger?.type === 'layout_changed' && (
                              <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-zinc-500">{t.layoutSwitchWhich || 'Which layout'}</label>
                                  <LayoutTarget
                                      sceneType={(currentAction.trigger.config as any).sceneType}
                                      layoutId={currentAction.trigger.config.layoutId}
                                      types={sceneTypes}
                                      layouts={layouts}
                                      anyLabel={t.layoutChangedAny || 'Any layout'}
                                      set={(patch) => { for (const [k, v] of Object.entries(patch)) updateTriggerConfig(k, v); }}
                                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs font-mono text-zinc-400 outline-none"
                                      t={t}
                                  />
                              </div>
                          )}

                          {currentAction.trigger?.type?.startsWith('discord_call_') && (
                              <div className="space-y-2" data-call-trigger>
                                  {currentAction.trigger.type !== 'discord_call_count' && (
                                      <label className="space-y-1 block">
                                          <span className="text-[9px] font-bold text-zinc-500">{t.callPersonWho || 'Who'}</span>
                                          <CallPersonSelect
                                              value={currentAction.trigger.config.discordId || ''}
                                              onChange={(id) => updateTriggerConfig('discordId', id)}
                                              voice={voice}
                                              regulars={regulars}
                                              listServerMembers={listServerMembers}
                                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-zinc-300 outline-none"
                                              t={t}
                                          />
                                      </label>
                                  )}
                                  {currentAction.trigger.type === 'discord_call_count' && (
                                      <label className="space-y-1 block">
                                          <span className="text-[9px] font-bold text-zinc-500">{t.callCountPeople || 'When it reaches this many people'}</span>
                                          <input type="number" min={1} max={25} value={currentAction.trigger.config.people ?? 2} onChange={(e) => updateTriggerConfig('people', parseInt(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none" data-call-field="people" />
                                      </label>
                                  )}
                                  {currentAction.trigger.type === 'discord_call_talking' && (
                                      <label className="space-y-1 block">
                                          <span className="text-[9px] font-bold text-zinc-500">{t.callQuietSeconds || 'After being quiet for at least (seconds)'}</span>
                                          <input type="number" min={10} max={3600} value={currentAction.trigger.config.quietSeconds ?? 30} onChange={(e) => updateTriggerConfig('quietSeconds', parseInt(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none" data-call-field="quietSeconds" />
                                      </label>
                                  )}
                                  <p className="text-[9px] text-zinc-600 leading-relaxed">
                                      {currentAction.trigger.type === 'discord_call_talking'
                                          ? (t.callTalkingHint || 'Needs "Light up whoever is talking" on in the Voice call screen. Counts a start after a pause, not every word.')
                                          : (t.callTriggerHint || 'The call chosen on the Voice call screen. {user} is their name on stream; {event.count} is how many are in the call now.')}
                                  </p>
                              </div>
                          )}

                          {currentAction.trigger?.type === 'timer_schedule' && (() => {
                              const cfg = currentAction.trigger.config;
                              // The browser's time zone, saved with it: the phone the server runs on may keep UTC.
                              const tz = cfg.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                              const days: number[] = cfg.days || [1];
                              // 2024-01-07 was a Sunday: day d is the 7th plus d.
                              const dayName = (d: number) => new Intl.DateTimeFormat(t.lang === 'es' ? 'es' : 'en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + d)));
                              const toggleDay = (d: number) => {
                                  const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
                                  if (!next.length) return;
                                  updateTriggerConfig('days', next.sort((a, b) => a - b));
                                  updateTriggerConfig('tz', tz);
                              };
                              return (
                                  <div className="space-y-2" data-schedule-trigger>
                                      <div className="flex flex-wrap gap-1">
                                          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                                              <button key={d} onClick={() => toggleDay(d)} className={`px-2 py-1 rounded-md border text-[10px] font-bold capitalize ${days.includes(d) ? 'border-current-accent text-current-accent bg-current-accent/10' : 'border-zinc-800 text-zinc-500 hover:text-white'}`} data-schedule-day={d}>{dayName(d)}</button>
                                          ))}
                                      </div>
                                      <label className="flex items-center gap-2">
                                          <span className="text-[9px] font-bold text-zinc-500">{t.scheduleTime || 'At'}</span>
                                          <input type="time" value={cfg.time || '18:00'} onChange={(e) => { if (!e.target.value) return; updateTriggerConfig('time', e.target.value); updateTriggerConfig('tz', tz); }} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none [color-scheme:dark]" data-schedule-field="time" />
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                          <input type="checkbox" checked={cfg.onlyLive === true} onChange={(e) => updateTriggerConfig('onlyLive', e.target.checked)} className="accent-current-accent" data-schedule-field="onlyLive" />
                                          <span className="text-[10px] text-zinc-400">{t.repeatOnlyLive || 'Only while live'}</span>
                                      </label>
                                      <p className="text-[9px] text-zinc-600 leading-relaxed">{(t.scheduleHint || 'Times are in {tz}. Once at that time on each day picked — a Discord post with the week\'s schedule every Monday, say. If the server was off at that minute, it catches up within five.').split('{tz}').join(tz)}</p>
                                  </div>
                              );
                          })()}

                          {currentAction.trigger?.type === 'timer_interval' && (
                              <div className="space-y-2" data-repeat-trigger>
                                  <div className="grid grid-cols-2 gap-2">
                                      <label className="space-y-1">
                                          <span className="text-[9px] font-bold text-zinc-500">{t.repeatMinutes || 'Every (minutes)'}</span>
                                          <input type="number" min={1} max={1440} value={currentAction.trigger.config.minutes ?? 15} onChange={(e) => updateTriggerConfig('minutes', parseInt(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none" data-repeat-field="minutes" />
                                      </label>
                                      <label className="space-y-1">
                                          <span className="text-[9px] font-bold text-zinc-500">{t.repeatMinChat || 'After this many chat messages'}</span>
                                          <input type="number" min={0} max={500} value={currentAction.trigger.config.minChat ?? 0} onChange={(e) => updateTriggerConfig('minChat', parseInt(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none" data-repeat-field="minChat" />
                                      </label>
                                  </div>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" checked={currentAction.trigger.config.onlyLive !== false} onChange={(e) => updateTriggerConfig('onlyLive', e.target.checked)} className="accent-current-accent" data-repeat-field="onlyLive" />
                                      <span className="text-[10px] text-zinc-400">{t.repeatOnlyLive || 'Only while live'}</span>
                                  </label>
                                  <p className="text-[9px] text-zinc-600 leading-relaxed">{t.repeatHint || 'The first one comes one interval after going live. With a number of chat messages, it waits until chat has said that much since the last time, so a quiet chat is not talked over. Two set to the same time take turns.'}</p>
                              </div>
                          )}

                          {currentAction.trigger?.type === 'countdown_finished' && (
                              <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-zinc-500">{t.countdownTriggerWhich || 'Which timer'}</label>
                                  <select
                                      value={currentAction.trigger.config.timerId || ''}
                                      onChange={(e) => updateTriggerConfig('timerId', e.target.value)}
                                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs font-mono text-zinc-400 outline-none"
                                  >
                                      <option value="">{t.countdownTriggerAny || 'Any timer'}</option>
                                      {(countdownPresets || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  <p className="text-[9px] text-zinc-600">{t.countdownTriggerHint || 'Whichever saved timer was loaded when the countdown reached zero.'}</p>
                              </div>
                          )}

                          {/* NEW: Scene Selection for OBS Trigger */}
                          {currentAction.trigger?.type === 'obs_scene_changed' && (
                              <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-zinc-500">{t.targetScene || 'Target Scene'}</label>
                                  <select 
                                      value={currentAction.trigger.config.targetScene || ''} 
                                      onChange={(e) => updateTriggerConfig('targetScene', e.target.value)} 
                                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs font-mono text-zinc-400 outline-none"
                                  >
                                      <option value="">{t.anyScene || 'Any Scene'}</option>
                                      {obsData.scenes.map((s: any) => (
                                          <option key={s.sceneName} value={s.sceneName}>{s.sceneName}</option>
                                      ))}
                                  </select>
                              </div>
                          )}

                      </div>

                      {/* Templates are typed by hand into a dozen different
                          fields; without this the only way to learn a name was
                          to read the engine source. */}
                      <button
                         onClick={() => setIsVariablesOpen(true)}
                         className="w-full mt-2 px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-current-accent hover:border-current-accent/60 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                         <Braces size={13} /> {t.variablesButton}
                      </button>
                   </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                    <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.actionFlow}</label>
                        <div className="flex flex-wrap gap-2">
                             <ActionCategoryDropdown 
                                id="twitch" 
                                label="Twitch" 
                                icon={TwitchIcon} 
                                colorClass="text-[#9146FF]"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                scrollContainerRef={dropdownRef}
                                items={[
                                    { label: t.chat, onClick: () => addStep('twitch_chat'), icon: TwitchIcon },
                                    { label: 'Set Title', onClick: () => addStep('twitch_set_title'), icon: TypeIcon },
                                    { label: 'Set Game', onClick: () => addStep('twitch_set_category'), icon: Gamepad2 },
                                    { label: t.twitchStepShoutout || 'Shout out', onClick: () => addStep('twitch_shoutout'), icon: Megaphone },
                                    { label: t.twitchStepClip || 'Clip', onClick: () => addStep('twitch_clip'), icon: Camera },
                                    { label: t.twitchStepMarker || 'Stream marker', onClick: () => addStep('twitch_marker'), icon: Tag },
                                    { label: t.twitchStepModerate || 'Moderate', onClick: () => addStep('twitch_moderate'), icon: Shield },
                                    { label: t.twitchStepChatMode || 'Chat mode', onClick: () => addStep('twitch_chat_mode'), icon: Shield },
                                ]}
                             />
                             <ActionCategoryDropdown
                                id="youtube"
                                label="YouTube"
                                icon={YouTubeIcon}
                                colorClass="text-[#FF0000]"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                scrollContainerRef={dropdownRef}
                                items={[
                                    { label: t.youtubeMenuTitle || 'Set Title', onClick: () => addStep('youtube_set_title'), icon: TypeIcon },
                                    { label: t.youtubeMenuDescription || 'Set Description', onClick: () => addStep('youtube_set_description'), icon: List },
                                    { label: t.youtubeMenuCategory || 'Toggle Category', onClick: () => addStep('youtube_toggle_category'), icon: RefreshCcw },
                                ]}
                             />
                             <ActionCategoryDropdown
                                id="audio" 
                                label="Audio / TTS" 
                                icon={Mic} 
                                colorClass="text-pink-500"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                scrollContainerRef={dropdownRef}
                                items={[
                                    { label: 'Speak (TTS)', onClick: () => addStep('browser_tts'), icon: Mic },
                                    { label: t.stepPlaySound || 'Play a sound', onClick: () => addStep('play_sound'), icon: Volume2 },
                                    { label: 'Spotify Control', onClick: () => addStep('spotify_control'), icon: Play }
                                ]}
                             />
                             <ActionCategoryDropdown 
                                id="discord" 
                                label="Discord" 
                                icon={DiscordIcon} 
                                colorClass="text-[#5865F2]"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                scrollContainerRef={dropdownRef}
                                items={[
                                    { label: t.discordSendStep || 'Send as the bot', onClick: () => addStep('discord_send'), icon: DiscordIcon },
                                    { label: 'Send Webhook', onClick: () => addStep('discord_webhook'), icon: DiscordIcon }
                                ]}
                             />
                             <ActionCategoryDropdown 
                                id="obs" 
                                label="OBS" 
                                icon={Monitor} 
                                colorClass="text-zinc-200"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                scrollContainerRef={dropdownRef}
                                items={[
                                    { label: t.scene, onClick: () => addStep('obs_scene'), icon: Monitor },
                                    { label: 'Source Visibility', onClick: () => addStep('obs_visibility'), icon: Eye },
                                    { label: 'Set Text', onClick: () => addStep('obs_text'), icon: Type },
                                    { label: 'Toggle Filter', onClick: () => addStep('obs_filter_toggle'), icon: AlertTriangle },
                                    { label: 'Set Volume', onClick: () => addStep('obs_set_volume'), icon: Volume2 },
                                    { label: 'Mute/Unmute', onClick: () => addStep('obs_set_mute'), icon: VolumeX },
                                    { label: 'Save Replay', onClick: () => addStep('obs_save_replay'), icon: Save },
                                    { label: t.obsStopStream || 'Stop streaming', onClick: () => addStep('obs_stop_stream'), icon: Square },
                                    { label: 'Browser URL', onClick: () => addStep('obs_set_browser_url'), icon: Globe },
                                    { label: 'Transform', onClick: () => addStep('obs_set_transform'), icon: Move },
                                    { label: 'Phone Camera', onClick: () => addStep('droidcam_control'), icon: Camera },
                                ]}
                             />
                             <ActionCategoryDropdown 
                                id="logic" 
                                label="Logic" 
                                icon={Split} 
                                colorClass="text-amber-500"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                scrollContainerRef={dropdownRef}
                                items={[
                                    { label: 'Condition', onClick: () => addStep('condition'), icon: Split },
                                    { label: 'Trigger Action', onClick: () => addStep('trigger_action'), icon: Workflow },
                                    { label: t.stepWait || 'Wait', onClick: () => addStep('wait'), icon: Hourglass },
                                    { label: t.stepStop || 'Stop here', onClick: () => addStep('stop'), icon: OctagonX },
                                    { label: t.stepRepeat || 'Repeat', onClick: () => addStep('repeat'), icon: Repeat },
                                    { label: t.stepRandom || 'Pick one at random', onClick: () => addStep('random_pick'), icon: Dices },
                                    { label: t.stepLater || 'Later', onClick: () => addStep('later'), icon: AlarmClock },
                                    { label: t.stepWebRequest || 'Fetch a web address', onClick: () => addStep('web_request'), icon: Globe },
                                ]}
                             />
                             {/* What is on the overlay, wherever it came from. The
                                 omnibar slot lived under Twitch before this, which
                                 is where nobody looking for it would have looked. */}
                             <ActionCategoryDropdown
                                id="overlay"
                                label={t.overlayStepsMenu || 'Overlay'}
                                icon={Layers}
                                colorClass="text-sky-400"
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                scrollContainerRef={dropdownRef}
                                items={[
                                    { label: t.omnibarStepMenu || 'Omnibar slot', onClick: () => addStep('omnibar_set'), icon: Radio },
                                    ...OVERLAY_STEPS.map((s) => ({ label: t[s.key] || s.label, onClick: () => addStep(s.type), icon: s.icon })),
                                ]}
                             />
                        </div>
                    </div>
                    
                    {addInto && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2" data-adding-into>
                            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><CornerDownRight size={12} /> {t.addingIntoInner || 'The menus now add steps into the highlighted list.'}</span>
                            <button onClick={() => setAddInto(null)} data-adding-top className="text-[10px] font-bold text-zinc-300 hover:text-white underline">{t.addingBackToTop || 'Add to the action’s own steps again'}</button>
                        </div>
                    )}
                    <div ref={stepOrder.listRef} className={`relative min-h-[300px] bg-black/20 rounded-2xl border border-zinc-800/50 p-4 space-y-4 ${stepOrder.held ? 'select-none' : ''}`}>
                        {stepOrder.line}
                        {currentAction.actions?.map((step, i) => (
                           <StepRenderer 
                             order={stepOrder}
                             moveActionStep={moveActionStep}
                             avatarActions={avatarActions}
                             omnibarSlots={omnibarSlots}
                             layouts={layouts}
                             goalSlots={goalSlots}
                             countdownPresets={countdownPresets}
                             sceneTypes={sceneTypes}
                             seatNames={seatNames}
                             key={step.id} 
                             step={step} 
                             index={i} 
                             t={t}
                             obsData={obsData}
                             streamActions={streamActions}
                             removeActionStep={removeActionStep}
                             updateActionStepConfig={updateActionStepConfig}
                             addActionStep={addActionStep}
                             onOpenPicker={handleOpenPicker}
                             searchCategories={searchCategories}
                             addInto={addInto}
                             onAddInto={setAddInto}
                             uploadAsset={uploadAsset}
                           />
                        ))}
                        {(!currentAction.actions || currentAction.actions.length === 0) && (
                            <div className="flex flex-col items-center justify-center p-8 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-xl">
                                <Zap size={24} className="mb-2 opacity-50" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{t.noActionsDefined}</span>
                                <span className="text-[9px] mt-1">{t.addStepsHint}</span>
                            </div>
                        )}
                    </div>
                </div>
              </div>

            </div>
            
            <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 flex gap-3 shrink-0"> 
               <Button className="w-full" variant="secondary" onClick={() => setIsActionModalOpen(false)}>{t.cancel || 'Cancel'}</Button> 
               <Button className="w-full" onClick={handleSaveAction}>{t.saveCommand || 'Save Action'}</Button> 
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4"> 
           
          <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                  {sortButton('created', t.sortByCreated, <History size={16} />)}
                  {sortButton('name', t.sortByName, <ArrowDownAZ size={16} />)}
              </div>
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                  {layoutButton('grid', t.gridView, <LayoutGrid size={16} />)}
                  {layoutButton('list', t.listView, <List size={16} />)}
              </div>
              <Button onClick={() => handleOpenActionModal()} icon={<Plus size={18} />}>{t.createInteraction}</Button>
          </div>
      </div>

      <LaterWaitingList steps={laterSteps} control={laterControl} t={t} />

      {streamActions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mr-1 flex items-center gap-1">
                  <GitBranch size={11} /> {t.filterByFlow}
              </span>
              {FLOW_FILTERS.map((f) => {
                  const active = flowFilters.includes(f.id);
                  const count = filterCounts[f.id] || 0;
                  return (
                      <button
                          key={f.id}
                          onClick={() => toggleFlowFilter(f.id)}
                          disabled={count === 0}
                          aria-pressed={active}
                          className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${active ? f.tint : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                      >
                          {f.label} <span className="opacity-60 font-mono">{count}</span>
                      </button>
                  );
              })}
              {flowFilters.length > 0 && (
                  <button onClick={() => setFlowFilters([])} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors flex items-center gap-1">
                      <X size={11} /> {t.clearFilters}
                  </button>
              )}
          </div>
      )}

      {streamActions.length === 0 ? (
          <div className="glass-panel p-20 rounded-[40px] border border-zinc-800 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700 mb-6 border border-zinc-800"> <Zap size={32} /> </div>
              <h3 className="text-xl font-extrabold uppercase tracking-tight mb-2">{t.noInteractions}</h3>
              <p className="text-xs text-zinc-500 mb-8 max-w-xs mx-auto">{t.createWorkflowsHint}</p>
          </div>
      ) : visibleActions.length === 0 ? (
          <div className="glass-panel p-16 rounded-[40px] border border-zinc-800 text-center flex flex-col items-center">
              <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700 mb-5 border border-zinc-800"> <Search size={26} /> </div>
              <h3 className="text-lg font-extrabold uppercase tracking-tight mb-4">{t.noMatchingActions}</h3>
              <Button size="sm" variant="secondary" onClick={() => setFlowFilters([])} icon={<X size={14} />}>{t.clearFilters}</Button>
          </div>
      ) : layout === 'list' ? (
          <div className="flex flex-col gap-2">
             {visibleActions.map((action) => (
                 <div key={action.id} className="glass-panel px-4 py-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all group flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${triggerTint(action.trigger?.category)}`}>
                         <TriggerGlyph category={action.trigger?.category} size={14} />
                     </div>
                     <span className="font-black text-xs uppercase text-zinc-100 truncate w-40 sm:w-56 flex-shrink-0">{action.name}</span>
                     <span className="text-[10px] text-zinc-500 font-mono truncate flex-1 min-w-0 flex items-center gap-1">
                         <Activity size={10} className="flex-shrink-0" />
                         {action.trigger?.type?.replace(/_/g, ' ')}
                         {action.trigger?.config?.commandId && ` (${commands.find(c => c.id === action.trigger.config.commandId)?.name || 'Unknown'})`}
                         {action.trigger?.config?.targetScene && ` (${action.trigger.config.targetScene})`}
                         {action.trigger?.config?.timerId && ` (${(countdownPresets || []).find((p) => p.id === action.trigger.config.timerId)?.name || '?'})`}
                         {action.trigger?.config?.layoutId && ` (${(layouts || []).find((l) => l.id === action.trigger.config.layoutId)?.name || '?'})`}
                         {action.trigger?.type === 'timer_interval' && ` (${action.trigger.config?.minutes ?? 15} min)`}
                         {action.trigger?.type === 'timer_schedule' && ` (${action.trigger.config?.time || '18:00'})`}
                     </span>
                     {/* The flow, so a row still answers "what does this do?" */}
                     <div className="hidden lg:flex items-center gap-1 flex-shrink-0 max-w-[40%] overflow-hidden">
                         {action.actions.map((step, idx) => (
                             <span key={idx} className={`px-2 py-1 rounded-md text-[9px] font-bold border whitespace-nowrap ${stepChipClass(step.type)}`}>
                                 {stepChipLabel(step.type)}
                             </span>
                         ))}
                         {action.actions.length === 0 && <span className="text-[9px] text-zinc-600 italic whitespace-nowrap">{t.noSteps}</span>}
                     </div>
                     <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleTestAction(action)} className="p-2 text-zinc-500 hover:text-green-400 bg-zinc-900/50 rounded-lg" title="Test Action"><Play size={14} /></button>
                         <button onClick={() => handleOpenActionModal(action)} className="p-2 text-zinc-500 hover:text-white bg-zinc-900/50 rounded-lg"><Edit2 size={14} /></button>
                         <button onClick={() => handleDeleteAction(action.id)} className="p-2 text-zinc-500 hover:text-red-500 bg-zinc-900/50 rounded-lg"><Trash2 size={14} /></button>
                     </div>
                 </div>
             ))}
          </div>
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {visibleActions.map((action) => (
                 <div key={action.id} className="glass-panel p-6 rounded-[32px] border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all group flex flex-col"> 
                     <div className="flex items-center justify-between mb-4"> 
                         <div className="flex items-center gap-3"> 
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${triggerTint(action.trigger.category)}`}>
                                 <TriggerGlyph category={action.trigger.category} size={20} />
                             </div>
                             <div className="flex flex-col"> 
                                 <span className="font-black text-lg uppercase text-zinc-100">{action.name}</span> 
                                 <span className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1"> 
                                     <Activity size={10} /> {action.trigger.type.replace(/_/g, ' ')} 
                                     {action.trigger.config.commandId && ` (${commands.find(c => c.id === action.trigger.config.commandId)?.name || 'Unknown'})`}
                                     {action.trigger.config.targetScene && ` (${action.trigger.config.targetScene})`}
                                     {action.trigger.config.timerId && ` (${(countdownPresets || []).find((p) => p.id === action.trigger.config.timerId)?.name || '?'})`}
                                     {action.trigger.config.layoutId && ` (${(layouts || []).find((l) => l.id === action.trigger.config.layoutId)?.name || '?'})`}
                                     {action.trigger.type === 'timer_interval' && ` (${action.trigger.config.minutes ?? 15} min)`}
                                     {action.trigger.type === 'timer_schedule' && ` (${action.trigger.config.time || '18:00'})`}
                                 </span> 
                             </div> 
                         </div> 
                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"> 
                             <button onClick={() => handleTestAction(action)} className="p-2 text-zinc-500 hover:text-green-400 bg-zinc-900/50 rounded-lg" title="Test Action"><Play size={14} /></button>
                             <button onClick={() => handleOpenActionModal(action)} className="p-2 text-zinc-500 hover:text-white bg-zinc-900/50 rounded-lg"><Edit2 size={14} /></button> 
                             <button onClick={() => handleDeleteAction(action.id)} className="p-2 text-zinc-500 hover:text-red-500 bg-zinc-900/50 rounded-lg"><Trash2 size={14} /></button> 
                         </div> 
                     </div> 
                     <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-zinc-800/50"> 
                         <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                             <GitBranch size={12} /> {t.flowSummary}
                         </div>
                         <div className="flex flex-wrap gap-1">
                             {action.actions.map((step, idx) => (
                                 <span key={idx} className={`px-2 py-1 rounded-md text-[9px] font-bold border ${stepChipClass(step.type)}`}>
                                     {stepChipLabel(step.type)}
                                 </span>
                             ))}
                             {action.actions.length === 0 && <span className="text-[9px] text-zinc-600 italic">{t.noSteps}</span>}
                         </div>
                     </div> 
                 </div>
             ))} 
          </div>
      )}
    </div>
    </DiscordPicksProvider>
  );
};
