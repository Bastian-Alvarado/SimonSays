/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The overlay editor: arrange every overlay onto one canvas.
 *
 * Without this, putting five overlays on stream means five browser sources,
 * each positioned by hand in OBS, and all of it redone for every scene
 * collection. Here the arrangement is one saved layout, it travels with a
 * config export, and OBS only ever needs one source pointed at it.
 *
 * The preview is the real thing. It mounts the same `CanvasStage` the browser
 * source mounts, showing live chat and a live countdown, so what you arrange
 * is literally what goes out — not a diagram of it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasStage, CanvasLayer, CanvasLayout } from '../CanvasStage';
import { SceneTypePicker } from '../SceneTypes';
import { Button } from '../Button';
import { ImageLayerPanel } from '../ImageLayerPanel';
import { GoalLayerPanel } from '../GoalLayerPanel';
import { TextLayerPanel } from '../TextLayerPanel';
import { PlanLayerPanel } from '../PlanLayerPanel';
import { RosterLayerPanel } from '../RosterLayerPanel';
import { PlayersLayerPanel } from '../PlayersLayerPanel';
import { PollLayerPanel } from '../PollLayerPanel';
import { VoiceLayerPanel } from '../VoiceLayerPanel';
import { AvatarLayerSection } from '../AvatarLayerPanel';
import { PngtuberLayerPanel } from '../PngtuberLayerPanel';
import { HypeTrainLayerPanel, ShoutoutLayerPanel } from '../TwitchLayerPanels';
import { LeaderboardLayerPanel } from '../LeaderboardLayer';
import { GiveawayLayerPanel } from '../GiveawayLayer';
import { SourceLayerPanel } from '../SourceLayerPanel';
import { ChatLayerPanel } from '../ChatLayerPanel';
import { OmnilayerPanel } from '../OmnilayerPanel';
import { StyleFieldsPanel } from '../StyleFieldsPanel';
import { ShapeLayerPanel } from '../ShapeLayerPanel';
import { RunCardPanel } from '../RunCardPanel';
import { LayerAppearancePanel } from '../LayerAppearancePanel';
import { LayerConditionPanel } from '../LayerConditionPanel';
import { LayerMotionPanel } from '../LayerMotionPanel';
import { LayerCssPanel } from '../LayerCssPanel';
import { LayoutCssPanel } from '../LayoutCssPanel';
import { FontUploadButton } from '../FontUploadButton';
import { AccentSwatch } from '../AccentSwatch';
import { AutoSwatch } from '../AutoSwatch';
import { NAMEPLATE_SOURCES } from '../../../shared/run.js';
import { dropLayer } from '../../../shared/layer-order.js';
import { tidyGroups, displayUnits, dropInGroup, groupBox, fitGroup, groupLayers, ungroupLayers, newGroupId, groupKey, cleanGroupName } from '../../../shared/layer-groups.js';
import { useDragOrder, DragGrip, DragOrder } from '../../hooks/useDragOrder';
import { ASPECTS, aspectRatio, fitAspect, holdAspect, sizeWithAspect } from '../../../shared/aspect.js';
import { LayerGroupFolder } from '../LayerGroupFolder';
import { CommittedInput } from '../CommittedInput';
import { fill, refusalWords } from '../../words';
import { themeFromLayout } from '../../../shared/user-themes.js';
import { useCustomFonts } from '../../hooks/useCustomFonts';
import { CHAT_FONTS } from '../../../shared/chat-style.js';
import { talkChoices } from '../../../shared/talk-people.js';
import { copyText } from '../../utils';
import { ThemeConfig } from '../../types';
import {
  Check, Copy, ExternalLink, Eye, EyeOff, Layers, Plus, Trash2, ArrowUp, ArrowDown, Lock, LockOpen, SquareDashed, Tag,
  MessageSquare, Bell, Radio, Clock, Users, BarChart3, Headphones, Music, MonitorPlay, Monitor, IdCard, Image as ImageIcon, Target, ListOrdered, MessageCircleQuestion, Type, Square, CopyPlus, Gamepad2, Smile, Mic, X,
  TrainFront, Megaphone, Trophy, Gift, Folder, FolderPlus, FolderOutput, SquareCheck, Ungroup,
} from 'lucide-react';

/**
 * The layer types, in the order they are offered.
 *
 * Mirrors LAYER_TYPES on the server; the smoke suite asserts the canvas can
 * draw every type the server accepts, so the two cannot drift apart silently.
 */
const LAYER_KINDS: { type: CanvasLayer['type']; label: string; icon: any; hint: string; repeatable?: boolean }[] = [
  { type: 'chat', label: 'Chat', icon: MessageSquare, hint: 'Messages from every connected platform.' },
  { type: 'alerts', label: 'Alerts', icon: Bell, hint: 'Follows, subs and raids. Usually covers the whole canvas.' },
  { type: 'omnibar', label: 'Omnibar', icon: Radio, hint: 'The rotating bar. Configure its slots on the Omnibar screen.' },
  { type: 'countdown', label: 'Countdown', icon: Clock, hint: 'The shared timer.' },
  { type: 'stopwatch', label: 'Timer', icon: Clock, hint: 'The run timer, counting up. Run it from the Timer screen, the deck or a command.' },
  { type: 'viewers', label: 'Viewers', icon: Users, hint: 'Live viewer count.' },
  { type: 'spotify', label: 'Spotify', icon: Music, hint: 'What is playing now.' },
  { type: 'nameplate', label: 'Nameplate', icon: IdCard, hint: 'A lower third: who is on camera. Draws nothing until you give it a name.', repeatable: true },
  { type: 'runcard', label: 'Run card', icon: Gamepad2, hint: 'What is being played: title, platform, category, estimate. Filled in on the Game screen.', repeatable: true },
  { type: 'images', label: 'Images', icon: ImageIcon, hint: 'One picture, or several taking turns. Logos, frames, sponsor marks.', repeatable: true },
  { type: 'goal', label: 'Goal', icon: Target, hint: 'A bar counting toward a number: followers, subs, or one you keep yourself.', repeatable: true },
  { type: 'plan', label: 'Plan', icon: ListOrdered, hint: 'What the stream is working through, so viewers can see what is coming.' },
  { type: 'question', label: 'Question', icon: MessageCircleQuestion, hint: 'The viewer question being read out. Empty until you put one up.' },
  { type: 'text', label: 'Text', icon: Type, hint: 'Anything you type, with live values in it: counts, who was last, what is playing.', repeatable: true },
  { type: 'shape', label: 'Shape', icon: Square, hint: 'A box, a circle or a line. What the rest of the overlay sits on.', repeatable: true },
  { type: 'roster', label: 'Commentators', icon: Users, hint: 'Everybody commentating, as a grid of seats. Follows the Who’s on screen, and draws the free seats as free.', repeatable: true },
  { type: 'players', label: 'Players', icon: Users, hint: 'Who is in tonight\'s game, from the Players screen. Up to 24 a page; more take turns.', repeatable: true },
  { type: 'poll', label: 'Poll', icon: BarChart3, hint: 'The poll from the Polls screen, with its votes from every chat. Only on screen while a poll is up.' },
  { type: 'voice', label: 'Voice call', icon: Headphones, hint: 'Everybody in the Discord call, glowing while they talk. The channel is chosen on the Voice call screen.', repeatable: true },
  { type: 'avatar', label: 'Pixel avatar', icon: Smile, hint: 'Your pixel avatar: a face, a hat, a colour. It blinks, talks along with you in the Discord call, and reacts to alerts.', repeatable: true },
  { type: 'pngtuber', label: 'PNGtuber', icon: Mic, hint: 'Your own pictures, PNGtuber style: quiet, talking and blinking, swapped as you talk into your microphone.', repeatable: true },
  { type: 'hypetrain', label: 'Hype Train', icon: TrainFront, hint: 'Twitch\'s Hype Train while it runs: the level, how far, how long is left. Try one from the Twitch screen.' },
  { type: 'giveaway', label: 'Giveaway', icon: Gift, hint: 'The giveaway from the Giveaways screen: how to enter while it is open, then a reel that stops on the winner.' },
  { type: 'leaderboard', label: 'Leaderboard', icon: Trophy, hint: 'The chatters with the most XP, from every platform, with their level. A few seconds behind the chat.' },
  { type: 'shoutout', label: 'Shoutout', icon: Megaphone, hint: 'Who is being shouted out — whoever raids, or a "!so" — with their picture and what they were playing.' },
  { type: 'source', label: 'OBS source', icon: MonitorPlay, hint: 'Omnilayer: where OBS puts one of its sources — your game, a second screen, your camera. Nothing is drawn on stream; the source shows through.', repeatable: true },
];

const SIZE_PRESETS = [
  { label: '1080p', width: 1920, height: 1080 },
  { label: '720p', width: 1280, height: 720 },
  { label: 'Vertical', width: 1080, height: 1920 },
];

/**
 * The resize handles on the selected layer, and where each sits.
 *
 * Corners are squares half over the corner; sides are bars across the middle
 * of their edge, long enough to find and short enough to leave the corners
 * clear. In canvas pixels, like the layer they belong to.
 */
const GRIP_SIZE = 20;
const GRIP_BAR = 44;
const GRIPS: { grip: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'; cursor: string; style: React.CSSProperties }[] = [
  { grip: 'nw', cursor: 'nwse-resize', style: { left: -GRIP_SIZE / 2, top: -GRIP_SIZE / 2, width: GRIP_SIZE, height: GRIP_SIZE } },
  { grip: 'ne', cursor: 'nesw-resize', style: { right: -GRIP_SIZE / 2, top: -GRIP_SIZE / 2, width: GRIP_SIZE, height: GRIP_SIZE } },
  { grip: 'sw', cursor: 'nesw-resize', style: { left: -GRIP_SIZE / 2, bottom: -GRIP_SIZE / 2, width: GRIP_SIZE, height: GRIP_SIZE } },
  { grip: 'se', cursor: 'nwse-resize', style: { right: -GRIP_SIZE / 2, bottom: -GRIP_SIZE / 2, width: GRIP_SIZE, height: GRIP_SIZE } },
  { grip: 'n', cursor: 'ns-resize', style: { left: `calc(50% - ${GRIP_BAR / 2}px)`, top: -7, width: GRIP_BAR, height: 14 } },
  { grip: 's', cursor: 'ns-resize', style: { left: `calc(50% - ${GRIP_BAR / 2}px)`, bottom: -7, width: GRIP_BAR, height: 14 } },
  { grip: 'w', cursor: 'ew-resize', style: { top: `calc(50% - ${GRIP_BAR / 2}px)`, left: -7, width: 14, height: GRIP_BAR } },
  { grip: 'e', cursor: 'ew-resize', style: { top: `calc(50% - ${GRIP_BAR / 2}px)`, right: -7, width: 14, height: GRIP_BAR } },
];

/** How close an edge has to be before it sticks, in canvas pixels. */
const SNAP_PX = 8;

/**
 * As many layouts as the server will keep.
 *
 * Must match MAX_LAYOUTS in server/engine/layouts.js. Past it the server drops
 * the extras on save, so the button stops rather than letting someone build a
 * layout that disappears without a word.
 */
const MAX_LAYOUTS = 20;

/**
 * Canvas on the left, controls on the right.
 *
 * `minmax(0,1fr)` rather than `1fr`: a `1fr` track will not shrink below the
 * intrinsic width of its content, and the content here is a stage the full
 * size of the layout — 1920px. Left as `1fr` the column sizes itself to the
 * canvas, the canvas then measures that column, and the fit scale settles at 1
 * with the editor overflowing the page.
 */
const EDITOR_GRID = 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start';

const kindOf = (type: string) => LAYER_KINDS.find((k) => k.type === type);

/**
 * What tells one layer of a kind from another in the list.
 *
 * Three rows all reading "Text" is a list you have to click through to use.
 * Shown only where it helps: a layout with one image layer does not need to
 * be told it holds one image.
 */
const layerDetail = (layer: CanvasLayer): string => {
  const when = (layer as any).showWhen;
  // Said first: a layer that is not drawing is explained by this, not by
  // whatever its text happens to say.
  if (when && when !== 'always') return `${(layer as any).showWhenNot ? 'not ' : ''}${when}`;
  const c: any = layer.config || {};
  if (layer.type === 'text') return String(c.text || '').replace(/\s+/g, ' ').slice(0, 28);
  if (layer.type === 'shape') return String(c.kind === 'ellipse' ? 'circle' : c.kind || 'box');
  if (layer.type === 'nameplate') return String(c.name || '');
  if (layer.type === 'goal') return String(c.label || c.source || '');
  if (layer.type === 'avatar') return String(c.label || (c.expression && c.expression !== 'neutral' ? c.expression : ''));
  if (layer.type === 'images') {
    const n = (c.sources || []).length;
    return n ? `${n} image${n === 1 ? '' : 's'}` : '';
  }
  return '';
};

interface LayoutsViewProps {
  layouts: CanvasLayout[];
  /* The uploaded pictures, for the image layer to choose from. */
  listAssets: () => Promise<any[]>;
  uploadAsset: (file: File) => Promise<any>;
  setLayouts: (layouts: CanvasLayout[]) => void;
  /** The live client state, so the preview shows real chat and real counters. */
  system: any;
  /** Scene names as OBS reports them. Empty when OBS is not connected. */
  obsScenes?: string[];
  obsCurrentScene?: string;
  obsConnected?: boolean;
  activeTheme: ThemeConfig;
  t: any;
}

/** "Save its looks as a theme": a name, the alerts or not, and where to find it after. */
const SaveAsTheme = ({ layout, system, t }: { layout: CanvasLayout; system: any; t: any }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [withAlerts, setWithAlerts] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const kindName = (type: string) => (type === 'alert' ? t.libraryKind_alert : t[`layerKind_${type}`]) || kindOf(type)?.label || type;
  const save = async () => {
    setSaid(null);
    const theme = themeFromLayout(layout, {
      omnibars: system?.data?.omnibars || [],
      alerts: withAlerts ? (system?.data?.alertConfigs || []) : null,
      name: name.trim() || layout.name,
      nameFor: kindName,
      motionWord: (t.libraryMotion || 'Motion').toLowerCase(),
    });
    if (!theme.objects.length) {
      setSaid({ ok: false, words: t.layoutThemeNothing || 'Nothing on this layout wears a look yet: style a layer first.' });
      return;
    }
    try {
      await system.actions.userThemes({ op: 'save', theme });
      setSaid({ ok: true, words: fill(t.layoutThemeSaved || 'Saved as {theme}, with {count} pieces. Find it in Looks.', { theme: theme.name, count: String(theme.objects.length) }) });
      setOpen(false);
      setName('');
    } catch (err: any) {
      setSaid({ ok: false, words: refusalWords(t, err) || String(err?.message || err) });
    }
  };
  return (
    <div className="space-y-2" data-layout-save-theme>
      {!open ? (
        <button
          onClick={() => { setOpen(true); setSaid(null); }}
          className="w-full py-2.5 rounded-xl border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
          data-layout-save-theme-open
        >
          {t.layoutSaveTheme || 'Save its looks as a theme'}
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-800 p-3 space-y-2">
          <p className="text-[9px] text-zinc-500 leading-snug">{t.layoutSaveThemeHint || 'Every look and motion on this layout\'s layers, each once, as a theme of your own in Looks — to apply to any other layout.'}</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={layout.name} maxLength={60} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent" data-layout-save-theme-name />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={withAlerts} onChange={(e) => setWithAlerts(e.target.checked)} className="accent-current-accent" data-layout-save-theme-alerts />
            <span className="text-[10px] text-zinc-400">{t.libraryWithAlerts || 'And the alerts\' looks, which every layout shares'}</span>
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" icon={<Check size={13} />} onClick={save} data-layout-save-theme-go>{t.save || 'Save'}</Button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>{t.cancel || 'Cancel'}</Button>
          </div>
        </div>
      )}
      {said && <p className={`text-[10px] leading-snug ${said.ok ? 'text-emerald-400' : 'text-rose-400'}`} data-layout-save-theme-said>{said.words}</p>}
    </div>
  );
};

export const LayoutsView: React.FC<LayoutsViewProps> = ({
  layouts, setLayouts, system, obsScenes = [], obsCurrentScene = '', obsConnected = false, activeTheme, t,
  listAssets, uploadAsset,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  /*
    A group chosen as a whole: on the canvas its layers move and resize
    together. Choosing one of its layers instead — in the list, or by a
    double-click on the canvas — is choosing that layer on its own.
  */
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  useEffect(() => { if (selectedLayer) setSelectedGroup(null); }, [selectedLayer]);
  // Ticking layers to put in a group: a new one, or one already there.
  const [picking, setPicking] = useState<{ into: string | null } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  /*
    Open groups. They start folded, so a layout of many groups opens as a
    short list of them; how the list is being looked at, not a fact about the
    layout, so never saved.
  */
  const [opened, setOpened] = useState<string[]>([]);
  const openGroup = (gid: string) => setOpened((o) => (o.includes(gid) ? o : [...o, gid]));
  const canvasFonts = [...CHAT_FONTS, ...useCustomFonts()];
  const [copied, setCopied] = useState(false);

  /*
    What the editor draws on top of the overlay, and nothing to do with the
    overlay itself.

    Kept in the browser rather than on the server because it is a fact about
    how one person is looking at the canvas right now, not about the layout:
    turning the labels off to check the spacing should not reach the machine
    running the stream, or anybody else editing the same layouts.
  */
  const [showOutlines, setShowOutlines] = useState(() => {
    try { return localStorage.getItem('layout_outlines') !== 'off'; } catch { return true; }
  });
  const [showLabels, setShowLabels] = useState(() => {
    try { return localStorage.getItem('layout_labels') !== 'off'; } catch { return true; }
  });
  const setChrome = (which: string, on: boolean) => {
    try { localStorage.setItem(which, on ? 'on' : 'off'); } catch { /* private mode */ }
  };

  // The layout being edited. Local because a drag produces a move per pointer
  // event and the server does not need to hear about every one of them — it
  // hears the result when the pointer comes up.
  const [working, setWorking] = useState<CanvasLayout | null>(null);
  const workingRef = useRef<CanvasLayout | null>(null);
  // A layer chosen on the canvas inside a folded group: the group opens, so its row and settings show.
  useEffect(() => {
    const gid = selectedLayer ? workingRef.current?.layers.find((l) => l.uid === selectedLayer)?.group : null;
    if (gid) openGroup(gid);
  }, [selectedLayer]);
  const dragging = useRef(false);
  const scaleRef = useRef(1);

  const saved = layouts.find((l) => l.id === selectedId) || layouts[0] || null;

  /**
   * Set the layout being edited, and record it where the pointer handlers can
   * see it immediately.
   *
   * The ref cannot be kept in sync by an effect: a drag ends with a pointermove
   * and a pointerup in quick succession, and the effect for that last move has
   * not run by the time pointerup saves. The result is that the final part of
   * every drag is silently dropped — the layer lands a few pixels short of
   * where it was let go.
   */
  const applyWorking = useCallback((next: CanvasLayout | null) => {
    workingRef.current = next;
    setWorking(next);
  }, []);

  // Adopt whatever the server says, except mid-drag: a config patch landing
  // between two pointer moves would otherwise yank the layer back.
  useEffect(() => {
    if (dragging.current) return;
    applyWorking(saved ? JSON.parse(JSON.stringify(saved)) : null);
  }, [saved]);

  const commit = useCallback((next?: CanvasLayout | null) => {
    const layout = next || workingRef.current;
    if (!layout) return;
    setLayouts(layouts.map((l) => (l.id === layout.id ? layout : l)));
  }, [layouts, setLayouts]);

  /**
   * Change one layer, in local state only.
   *
   * Addressed by its own id rather than by its kind, because a layout can
   * hold three text layers and "the text one" stopped meaning anything.
   */
  const patchLayer = (uid: string, patch: Partial<CanvasLayer>) => {
    const w = workingRef.current;
    if (!w) return;
    applyWorking({ ...w, layers: w.layers.map((l) => (l.uid === uid ? { ...l, ...patch } : l)) });
  };

  /** Change one layer and tell the server straight away. */
  const patchLayerAndSave = (uid: string, patch: Partial<CanvasLayer>) => {
    const w = workingRef.current;
    if (!w) return;
    const next = { ...w, layers: w.layers.map((l) => (l.uid === uid ? { ...l, ...patch } : l)) };
    applyWorking(next);
    commit(next);
  };

  /** Several layers changed at once, in local state only: a group being dragged. */
  const patchMany = (patches: Record<string, Partial<CanvasLayer>>) => {
    const w = workingRef.current;
    if (!w) return;
    applyWorking({ ...w, layers: w.layers.map((l) => (patches[l.uid] ? { ...l, ...patches[l.uid] } : l)) });
  };

  /*
    Layers and groups saved together, tidied on the way: every group's
    layers side by side in the stack, and no group left with nothing in it.
    A layout with no groups is saved without the field at all.
  */
  const saveGroups = (layers: CanvasLayer[], groups: CanvasLayout['groups']) => {
    const w = workingRef.current;
    if (!w) return;
    const tidy = tidyGroups(layers, groups);
    const { groups: _old, ...rest } = w;
    const next: CanvasLayout = { ...rest, ...(tidy.groups.length ? { groups: tidy.groups } : {}), layers: tidy.layers as CanvasLayer[] };
    applyWorking(next);
    commit(next);
  };

  const groupOf = (gid: string | null) => working?.groups?.find((g) => g.id === gid) || null;

  /** The ticked layers into a group: the one being added to, or a new one, which is then chosen. */
  const makeGroup = () => {
    const w = workingRef.current;
    if (!w || !picking || !picked.length) return;
    const into = picking.into ? groupOf(picking.into) : null;
    const group = into || { id: newGroupId(), name: fill(t.layoutGroupNew || 'Group {n}', { n: String((w.groups?.length || 0) + 1) }) };
    const tidy = groupLayers(w.layers, w.groups || [], picked, group);
    saveGroups(tidy.layers as CanvasLayer[], tidy.groups);
    setPicking(null);
    setPicked([]);
    setSelectedLayer(null);
    setSelectedGroup(group.id);
    // Just made, or just added to: open, so what went in can be seen.
    openGroup(group.id);
  };

  const ungroup = (gid: string) => {
    const w = workingRef.current;
    if (!w) return;
    const tidy = ungroupLayers(w.layers, w.groups || [], { group: gid });
    saveGroups(tidy.layers as CanvasLayer[], tidy.groups);
    if (selectedGroup === gid) setSelectedGroup(null);
  };

  const leaveGroup = (uid: string) => {
    const w = workingRef.current;
    if (!w) return;
    const tidy = ungroupLayers(w.layers, w.groups || [], { uid });
    saveGroups(tidy.layers as CanvasLayer[], tidy.groups);
  };

  const renameGroup = (gid: string, name: string) => {
    const w = workingRef.current;
    if (!w) return;
    saveGroups(w.layers, (w.groups || []).map((g) => (g.id === gid ? { ...g, name: cleanGroupName(name, g.name) } : g)));
  };

  /** One change to every layer in a group: all locked, all hidden. */
  const patchGroup = (gid: string, patch: Partial<CanvasLayer>) => {
    const w = workingRef.current;
    if (!w) return;
    const next = { ...w, layers: w.layers.map((l) => (l.group === gid ? { ...l, ...patch } : l)) };
    applyWorking(next);
    commit(next);
  };

  const patchLayout = (patch: Partial<CanvasLayout>) => {
    const w = workingRef.current;
    if (!w) return;
    const next = { ...w, ...patch };
    applyWorking(next);
    commit(next);
  };

  /*
    One accent for every layout of the profile being edited, while the switch
    is on: a colour picked, or cleared, goes on all of them in one save, and
    switching it on gives them all this layout's accent there and then.
    Remembered in this browser, so it stays the way it was left.
  */
  const [accentAll, setAccentAll] = useState(() => {
    try { return localStorage.getItem('layouts_accent_all') === '1'; } catch { return false; }
  });
  const setAccent = (accent: string) => {
    const w = workingRef.current;
    if (!w) return;
    const next = { ...w, accent };
    applyWorking(next);
    if (accentAll) setLayouts(layouts.map((l) => (l.id === next.id ? next : { ...l, accent })));
    else commit(next);
  };
  const toggleAccentAll = (on: boolean) => {
    setAccentAll(on);
    try { localStorage.setItem('layouts_accent_all', on ? '1' : '0'); } catch { /* private mode */ }
    const w = workingRef.current;
    if (on && w) setLayouts(layouts.map((l) => (l.id === w.id ? w : { ...l, accent: w.accent || '' })));
  };
  // How many layouts of the profile wear an accent other than this one's: what the switch would change.
  const accentOthers = working ? layouts.filter((l) => l.id !== working.id && (l.accent || '') !== (working.accent || '')).length : 0;

  // ------------------------------------------------------------- layouts

  const atCapacity = layouts.length >= MAX_LAYOUTS;

  const newLayout = () => {
    if (atCapacity) return;
    const layout: CanvasLayout = {
      id: Math.random().toString(36).slice(2, 11),
      name: `Overlay ${layouts.length + 1}`,
      width: 1920,
      height: 1080,
      background: 'transparent',
      // A new layout starts with no accent, so every layer draws its own default.
      accent: '',
      layers: [],
    };
    setLayouts([...layouts, layout]);
    setSelectedId(layout.id);
    setSelectedLayer(null);
  };

  const deleteLayout = (id: string) => {
    const rest = layouts.filter((l) => l.id !== id);
    setLayouts(rest);
    setSelectedId(rest[0]?.id ?? null);
  };

  // -------------------------------------------------------------- layers

  const addLayer = (type: CanvasLayer['type']) => {
    const w = workingRef.current;
    if (!w) return;
    // The id is minted here rather than waiting for the server's copy, so the
    // layer just added is the one selected — otherwise adding a second text
    // layer would select the first.
    const uid = Math.random().toString(36).slice(2, 11);
    // A new chat starts as the profile's chat already looks, from another layout's,
    // rather than as a chat nobody chose — within one profile they usually match.
    const chatLike = type === 'chat'
      ? layouts.flatMap((l) => l.layers || []).find((y: any) => y.type === 'chat')?.config
      : undefined;
    // Placement is left to the server, which knows a sensible first position
    // for each surface — an omnibar spanning the bottom, not a box at 0,0.
    const next = { ...w, layers: [...w.layers, { type, uid, ...(chatLike ? { config: { ...chatLike } } : {}) } as CanvasLayer] };
    applyWorking(next);
    commit(next);
    setSelectedLayer(uid);
  };

  /**
   * Copy a layer, as an alternative to building the same thing twice.
   *
   * Offset rather than placed exactly on top, because two layers in the same
   * place look like one layer and the copy would be dragged before it could
   * be seen. Inserted directly above the original so the new one is in front,
   * which is what somebody copying a thing is usually about to arrange.
   */
  const duplicateLayer = (uid: string) => {
    const w = workingRef.current;
    if (!w) return;
    const at = w.layers.findIndex((l) => l.uid === uid);
    if (at < 0) return;
    const copy = {
      ...JSON.parse(JSON.stringify(w.layers[at])),
      uid: Math.random().toString(36).slice(2, 11),
      x: w.layers[at].x + 24,
      y: w.layers[at].y + 24,
      // The copy arrives unlocked whatever the original was. A duplicate
      // that cannot be seen or dragged is a duplicate nobody can place.
      locked: false,
    };
    const layers = [...w.layers];
    layers.splice(at + 1, 0, copy);
    const next = { ...w, layers };
    applyWorking(next);
    commit(next);
    setSelectedLayer(copy.uid);
  };

  const removeLayer = (uid: string) => {
    const w = workingRef.current;
    if (!w) return;
    const next = { ...w, layers: w.layers.filter((l) => l.uid !== uid) };
    applyWorking(next);
    commit(next);
    if (selectedLayer === uid) setSelectedLayer(null);
  };

  /*
    Array order is stacking order, so moving a row moves the layer. One step
    is one row of the list: a layer in a group steps among the group's
    layers, and anything else — a layer on its own, or a whole group — steps
    past the next row, a group counting as one.
  */
  const moveLayer = (id: string, delta: number) => {
    const w = workingRef.current;
    if (!w) return;
    const layer = w.layers.find((l) => l.uid === id);
    let layers = w.layers;
    if (layer?.group) {
      const shown = w.layers.filter((l) => l.group === layer.group).reverse();
      const at = shown.findIndex((l) => l.uid === id);
      layers = dropInGroup(w.layers, layer.group, id, delta > 0 ? at - 1 : at + 2);
    } else {
      const at = displayUnits(w.layers).findIndex((u) => u.id === id);
      if (at >= 0) layers = dropLayer(w.layers, id, delta > 0 ? at - 1 : at + 2);
    }
    if (layers === w.layers) return;
    const next = { ...w, layers };
    applyWorking(next);
    commit(next);
  };

  /** A layer dragged among the other layers of its group. */
  const dropMember = (gid: string, uid: string, gap: number) => {
    const w = workingRef.current;
    if (!w) return;
    const layers = dropInGroup(w.layers, gid, uid, gap);
    if (layers === w.layers) return;
    const next = { ...w, layers };
    applyWorking(next);
    commit(next);
  };

  /*
    A row dragged by its grip, for moving a layer further than one step: a
    new layer arrives at the front, and taking it to the back was a press of
    the down arrow for every layer in between.
  */
  const layerOrder = useDragOrder(({ id, gap }) => {
    const w = workingRef.current;
    if (!w) return;
    const layers = dropLayer(w.layers, id, gap);
    if (layers === w.layers) return;
    const next = { ...w, layers };
    applyWorking(next);
    commit(next);
  });

  // ------------------------------------------------------------ dragging

  /**
   * Stick to the canvas edges and centre lines.
   *
   * Placing an overlay flush to an edge by hand is a game of one-pixel
   * nudges otherwise. Holding Shift turns it off for the times you meant
   * to be two pixels off centre.
   */
  const snap = (value: number, targets: number[], off: boolean) => {
    if (off) return Math.round(value);
    for (const target of targets) {
      if (Math.abs(value - target) < SNAP_PX) return Math.round(target);
    }
    return Math.round(value);
  };

  /*
    Which edges a handle pulls. A corner pulls two, a side one — the side
    handles are what let a layer be stretched in one direction without the
    other drifting as the pointer wanders.
  */
  type Grip = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

  const startDrag = (e: React.PointerEvent, layer: CanvasLayer, mode: 'move' | Grip) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLayer(layer.uid);

    const layout = workingRef.current;
    if (!layout) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...layer };
    dragging.current = true;

    const onMove = (ev: PointerEvent) => {
      // The stage is drawn scaled to fit the pane, so a drag of 10 screen
      // pixels is 10/scale pixels on the canvas.
      const k = scaleRef.current || 1;
      const dx = (ev.clientX - startX) / k;
      const dy = (ev.clientY - startY) / k;

      if (mode === 'move') {
        const x = snap(start.x + dx, [0, (layout.width - start.width) / 2, layout.width - start.width], ev.shiftKey);
        const y = snap(start.y + dy, [0, (layout.height - start.height) / 2, layout.height - start.height], ev.shiftKey);
        patchLayer(start.uid, { x, y });
      } else {
        // A layer held to a shape keeps it, whichever handle pulls it.
        patchLayer(start.uid, holdAspect(start, pullEdges(start, mode, dx, dy, layout, ev.shiftKey), mode, aspectRatio(start.aspect)));
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      dragging.current = false;
      commit();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /*
    A box pulled by one of its handles. Each pulled edge moves on its own
    and snaps on its own, to the canvas edges and its centre lines, as a
    moved layer does. Pulling the top or left edge moves the box as well as
    resizing it — the far edge is the one that must stay put, or pulling
    left would push the box right. Neither side can pass the other: a box
    stops at 20px rather than turning inside out. A layer's box, or the box
    a group's layers fill between them.
  */
  const pullEdges = (start: { x: number; y: number; width: number; height: number }, mode: Grip, dx: number, dy: number, layout: CanvasLayout, free: boolean) => {
    const MIN = 20;
    const right0 = start.x + start.width;
    const bottom0 = start.y + start.height;
    const xs = [0, layout.width / 2, layout.width];
    const ys = [0, layout.height / 2, layout.height];
    let { x, y, width, height } = start;
    if (mode.includes('e')) width = Math.max(MIN, snap(right0 + dx, xs, free) - start.x);
    if (mode.includes('w')) {
      x = Math.min(right0 - MIN, snap(start.x + dx, xs, free));
      width = right0 - x;
    }
    if (mode.includes('s')) height = Math.max(MIN, snap(bottom0 + dy, ys, free) - start.y);
    if (mode.includes('n')) {
      y = Math.min(bottom0 - MIN, snap(start.y + dy, ys, free));
      height = bottom0 - y;
    }
    return { x, y, width, height };
  };

  /*
    A group dragged by any of its layers, or pulled by a handle on the box
    they fill between them: every layer moves by the same amount, or keeps
    its place in the box as the box stretches. Snapping works on the box, as
    it does on a single layer. A locked layer holds its whole group where it
    is — a lock that gave way whenever its group was dragged would not be one.
  */
  const startGroupDrag = (e: React.PointerEvent, gid: string, mode: 'move' | Grip) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLayer(null);
    setSelectedGroup(gid);
    const layout = workingRef.current;
    if (!layout) return;
    const start = layout.layers.filter((l) => l.group === gid).map((l) => ({ ...l }));
    const box0 = groupBox(start);
    if (!box0 || start.some((l) => l.locked)) return;
    const startX = e.clientX;
    const startY = e.clientY;
    dragging.current = true;

    const onMove = (ev: PointerEvent) => {
      const k = scaleRef.current || 1;
      const dx = (ev.clientX - startX) / k;
      const dy = (ev.clientY - startY) / k;
      const box = mode === 'move'
        ? {
          ...box0,
          x: snap(box0.x + dx, [0, (layout.width - box0.width) / 2, layout.width - box0.width], ev.shiftKey),
          y: snap(box0.y + dy, [0, (layout.height - box0.height) / 2, layout.height - box0.height], ev.shiftKey),
        }
        // A group holding a layer kept to a shape keeps its own, so stretching it cannot bend that one.
        : holdAspect(box0, pullEdges(box0, mode, dx, dy, layout, ev.shiftKey), mode,
          start.some((l) => aspectRatio(l.aspect)) ? box0.width / box0.height : null);
      patchMany(fitGroup(start, box0, box));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      dragging.current = false;
      commit();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /*
    A double-click on a chosen group goes through it to the layer under the
    pointer — the frontmost one there — and chooses that layer on its own.
  */
  const pickInGroup = (e: React.MouseEvent<HTMLElement>, gid: string, box: { x: number; y: number }) => {
    const w = workingRef.current;
    if (!w) return;
    const r = e.currentTarget.getBoundingClientRect();
    const k = scaleRef.current || 1;
    const px = box.x + (e.clientX - r.left) / k;
    const py = box.y + (e.clientY - r.top) / k;
    const hit = [...w.layers].reverse().find((l) => l.group === gid && l.visible && !l.locked
      && px >= l.x && px <= l.x + l.width && py >= l.y && py <= l.y + l.height);
    if (hit) setSelectedLayer(hit.uid);
  };

  /** Arrow keys for the placements a mouse cannot hit. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    // A chosen group moves as one — or not at all, if one of its layers is locked.
    if (selectedGroup && !selectedLayer) {
      e.preventDefault();
      const w = workingRef.current;
      const members = w?.layers.filter((l) => l.group === selectedGroup) || [];
      if (!w || !members.length || members.some((l) => l.locked)) return;
      const next = { ...w, layers: w.layers.map((l) => (l.group === selectedGroup ? { ...l, x: l.x + move[0], y: l.y + move[1] } : l)) };
      applyWorking(next);
      commit(next);
      return;
    }
    if (!selectedLayer) return;
    e.preventDefault();
    const layer = working?.layers.find((l) => l.uid === selectedLayer);
    // A locked layer does not move for the keyboard either, or the lock
    // would only hold against the mouse.
    if (!layer || layer.locked) return;
    patchLayerAndSave(selectedLayer, { x: layer.x + move[0], y: layer.y + move[1] });
  };

  // -------------------------------------------------------------- scenes

  /** Which layout, if any, currently claims a scene. */
  const ownerOf = (scene: string) => layouts.find((l) => l.scenes?.includes(scene));

  /**
   * Bind or unbind an OBS scene.
   *
   * Binding moves the scene rather than copying it: a scene can only show one
   * layout, so taking it from whoever held it is the only thing a click there
   * can honestly mean. The server enforces the same rule, but doing it here
   * keeps the editor from briefly showing a binding that would not survive.
   */
  const toggleScene = (scene: string) => {
    const w = workingRef.current;
    if (!w) return;
    const mine = w.scenes?.includes(scene);
    const next = layouts.map((l) => {
      const scenes = (l.scenes || []).filter((s) => s !== scene);
      if (l.id === w.id && !mine) scenes.push(scene);
      return l.id === w.id ? { ...w, scenes } : { ...l, scenes };
    });
    applyWorking(next.find((l) => l.id === w.id) as CanvasLayout);
    setLayouts(next);
  };

  /**
   * Give this layout a scene type, or none. Like a scene binding it moves: one
   * layout per type, so a command asking for the type always means one layout.
   */
  const setSceneType = (typeId: string) => {
    const w = workingRef.current;
    if (!w) return;
    const next = layouts.map((l) => {
      if (l.id === w.id) {
        const { sceneType, ...rest } = w;
        return (typeId ? { ...rest, sceneType: typeId } : rest) as CanvasLayout;
      }
      if (!typeId || l.sceneType !== typeId) return l;
      const { sceneType, ...rest } = l;
      return rest as CanvasLayout;
    });
    applyWorking(next.find((l) => l.id === w.id) as CanvasLayout);
    setLayouts(next);
  };

  // ----------------------------------------------------------------- url

  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  // Naming no layout means "follow the active OBS scene". That is the URL to
  // put in every scene; the pinned one is for a source that must always show
  // this particular layout.
  const autoUrl = base ? `${base}?mode=canvas` : '';
  const canvasUrl = base && working ? `${base}?mode=canvas&layout=${working.id}` : '';
  const boundScenes = working?.scenes || [];
  // The one to copy: whichever the panel is actually offering.
  const omni = (system?.data as any)?.omnilayer;
  const usingBindings = layouts.some((l) => l.scenes?.length) || Boolean(omni?.enabled);
  const shownUrl = usingBindings ? autoUrl : canvasUrl;

  const copyUrl = () => {
    copyText(shownUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const heading = activeTheme.id === 'light' ? 'text-zinc-900' : 'text-zinc-100';
  /*
    The palette hides a kind the layout already has — except the kinds that
    are meant to repeat, which are how a look is built and are useless at one
    each. Mirrors REPEATABLE on the server.
  */
  const unused = LAYER_KINDS.filter((k) => k.repeatable || !working?.layers.some((l) => l.type === k.type));

  /*
    The layer the editor is about. Under the canvas it has no row to sit in,
    so it has to be looked up rather than closed over.
  */
  const chosen = working?.layers.find((l) => l.uid === selectedLayer) || null;
  const ChosenIcon = (chosen && kindOf(chosen.type)?.icon) || Layers;

  /** Which layer kinds have settings of their own, beyond where they sit. */
  const HAS_OWN = ['omnibar', 'countdown', 'goal', 'runcard', 'roster', 'players', 'poll', 'voice', 'avatar', 'pngtuber', 'hypetrain', 'shoutout', 'leaderboard', 'giveaway', 'plan', 'shape', 'text', 'images', 'nameplate', 'source', 'chat'];

  /*
    The chat on the other layouts, for "use this chat on every layout": how
    many there are, and how many look different from this one. Compared with
    the keys in one order, so two copies of the same settings built in a
    different order are not counted as different.
  */
  const sameChat = (a: any, b: any) => {
    const sorted = (v: any) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
    return sorted(a || {}) === sorted(b || {});
  };
  const chatElsewhere = (layer: any) => {
    const theirs = layouts.filter((l) => l.id !== working?.id)
      .flatMap((l) => (l.layers || []).filter((y: any) => y.type === 'chat'));
    return { count: theirs.length, differ: theirs.filter((y: any) => !sameChat(y.config, layer.config)).length };
  };
  /** Every other layout's chat takes this one's settings; where each sits stays its own. */
  const shareChat = (layer: any) => {
    const w = workingRef.current;
    if (!w) return;
    const settings = layer.config || {};
    const next = layouts.map((l) => (l.id === w.id ? w : {
      ...l,
      layers: (l.layers || []).map((y: any) => (y.type === 'chat' ? { ...y, config: { ...settings } } : y)),
    }));
    setLayouts(next);
  };

  /*
    Everyone in the Discord server, for "Talks when" on a pixel avatar or a
    PNGtuber, so a friend can be picked before they join the call. Asked for
    when one of those is chosen and the bot is connected; the server keeps
    the list a minute, so choosing another does not ask Discord again.
  */
  const [serverPeople, setServerPeople] = useState<{ id: string; name: string }[]>([]);
  const chosenType = working?.layers.find((l) => l.uid === selectedLayer)?.type;
  const talks = chosenType === 'avatar' || chosenType === 'pngtuber';
  const discordUp = system?.status?.discord === 'connected';
  useEffect(() => {
    const list = system?.actions?.listServerMembers;
    if (!talks || !discordUp || !list) return undefined;
    let gone = false;
    list().then((people: any[]) => { if (!gone) setServerPeople(people || []); }).catch(() => { /* the call and the people set up are still offered */ });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talks, discordUp]);
  const voiceNow = (system?.data as any)?.voice || {};
  const talkChoicesFor = (layer: any) => talkChoices({
    members: voiceNow.members || [],
    voice: voiceNow,
    regulars: (system?.data as any)?.people?.regulars || [],
    server: serverPeople,
    chosen: layer.config?.talkWith || null,
  });

  /*
    Everything about one layer, in three groups: where it sits and when it
    shows, what it draws, and how it looks.

    On a wide screen these are three columns under the canvas. Below that they
    stack inside the layer's row in the list, which is what a phone has always
    done and is right there — one column has no room for anything else.
  */
  // A kind of layer by name, and what it is for, in the dashboard's language.
  const kindName = (type: string) => t[`layerKind_${type}`] || kindOf(type)?.label || type;
  const kindHint = (type: string) => t[`layerKindHint_${type}`] || kindOf(type)?.hint || '';

  const layerEditor = (layer: any) => {
    const kind = kindOf(layer.type);
    return (
      <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[210px_minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-6 xl:items-start">
        <div className="flex flex-col gap-2 min-w-0">
      <div className="grid grid-cols-4 gap-1.5">
        {(['x', 'y', 'width', 'height'] as const).map((field) => (
          <label key={field} className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{field.slice(0, 1)}</span>
            <input
              type="number"
              value={layer[field]}
              // Typing one side of a layer kept to a shape brings the other with it.
              onChange={(e) => patchLayer(layer.uid, field === 'width' || field === 'height'
                ? sizeWithAspect(field, Number(e.target.value) || 0, aspectRatio(layer.aspect))
                : { [field]: Number(e.target.value) || 0 })}
              onBlur={() => commit()}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-300 outline-none focus:border-current-accent"
            />
          </label>
        ))}
      </div>
      {/*
        A shape to keep while resizing, for the layers whose shape is a fact
        elsewhere: an OBS source is the shape of what it captures, and a shape
        layer is often meant to frame one.
      */}
      {(layer.type === 'source' || layer.type === 'shape') && (
        <div data-layer-aspect>
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.layoutAspect || 'Shape of the box'}</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {ASPECTS.map((a) => (
              <button
                key={a || 'free'}
                onClick={(e) => {
                  e.stopPropagation();
                  patchLayerAndSave(layer.uid, { aspect: a, ...(a ? fitAspect(layer, aspectRatio(a)) : {}) });
                }}
                className={`px-1.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all ${
                  (layer.aspect || '') === a ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
                data-aspect={a || 'free'}
              >
                {a || (t.layoutAspectFree || 'Free')}
              </button>
            ))}
          </div>
          {layer.type === 'source' && (
            <p className="text-[9px] text-zinc-600 leading-snug mt-1">
              {t.layoutAspectHint || 'Pick the shape of what the source shows — 16:9 for a 1920×1080 capture — and the box on the canvas is exactly where it shows in OBS.'}
            </p>
          )}
        </div>
      )}
      <label className="block">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
          {t.opacity || 'Opacity'} — {Math.round(layer.opacity * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={layer.opacity}
          onChange={(e) => patchLayer(layer.uid, { opacity: Number(e.target.value) })}
          onPointerUp={() => commit()}
          onClick={(e) => e.stopPropagation()}
          className="w-full accent-current-accent"
        />
      </label>
      <LayerConditionPanel
        layer={layer}
        patch={(next) => patchLayerAndSave(layer.uid, next)}
        t={t}
      />
        </div>

        <div className="flex flex-col gap-2 min-w-0">
      {layer.type === 'goal' && (
        <GoalLayerPanel
          accent={working.accent}
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          stats={system?.data?.stats}
          t={t}
        />
      )}
      {layer.type === 'countdown' && (() => {
        /*
          Which saved timer this layer shows. There is one clock, so a layer
          naming a timer shows it live while it is the one loaded, and waiting
          at its full time otherwise — which is what lets an Intermission
          layout say "Intermission 15:00" while Starting soon is counting.
        */
        const timers: any[] = system?.data?.countdown?.presets || [];
        const chosen = (layer.config as any)?.timer || '';
        const gone = Boolean(chosen) && !timers.some((p) => p.id === chosen);
        return (
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.layerCountdownWhich || 'Which saved timer'}
            </span>
            <select
              value={gone ? '' : chosen}
              onChange={(e) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), timer: e.target.value } })}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
            >
              <option value="">{t.layerCountdownLoaded || 'Whichever is loaded'}</option>
              {timers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="text-[9px] text-zinc-600 leading-snug">
              {gone
                ? (t.layerCountdownGone || 'The saved timer this layer showed was deleted, so it shows whichever is loaded.')
                : (t.layerCountdownHint || 'A saved timer shows live while it is the one loaded on the Countdown screen, and waiting at its full time otherwise.')}
            </p>
          </div>
        );
      })()}
      {layer.type === 'omnibar' && (() => {
        /*
          Which bar this layer shows. Main unless it says otherwise, and Main
          again if the bar it named is deleted — so an old layout, or one
          whose bar went away, still has a bar on it rather than a hole.
        */
        const bars: any[] = system?.data?.omnibars || [];
        const chosen = (layer.config as any)?.bar || '';
        const gone = Boolean(chosen) && !bars.some((b) => b.id === chosen);
        return (
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.layerOmnibarWhich || 'Which omnibar'}
            </span>
            <select
              value={gone ? '' : chosen}
              onChange={(e) => {
                /*
                  A bar is drawn at its own height and clipped to the layer's,
                  so a 64px layer switched to a tall bar kept the top of every
                  card and cut the detail row off. Choosing a taller bar grows
                  the layer to fit, keeping its bottom edge where it was —
                  which is where a bar along the bottom of the screen lives.
                  A shorter one leaves the layer alone: that is only room.
                */
                const next = e.target.value;
                const wants = (next ? bars.find((b) => b.id === next) : system?.data?.omnibar)?.style?.height || 64;
                const has = (layer as any).height || 0;
                const grow = wants > has ? { height: wants, y: Math.max(0, ((layer as any).y || 0) - (wants - has)) } : {};
                patchLayerAndSave(layer.uid, { ...grow, config: { ...(layer.config || {}), bar: next } } as any);
              }}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
            >
              <option value="">{t.omnibarBarMain || 'Main'}</option>
              {bars.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <p className="text-[9px] text-zinc-600 leading-snug">
              {gone
                ? (t.layerOmnibarGone || 'The bar this layer showed was deleted, so it shows Main.')
                : (t.layerOmnibarHint || 'Its slots are set on the Omnibar screen, one bar at a time.')}
            </p>
          </div>
        );
      })()}
      {layer.type === 'runcard' && (
        <RunCardPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          accent={working.accent}
          t={t}
        />
      )}

      {layer.type === 'roster' && (
        <RosterLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'players' && (
        <PlayersLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'voice' && (
        <VoiceLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          members={(system?.data as any)?.voice?.members || []}
          t={t}
        />
      )}

      {layer.type === 'avatar' && (
        <AvatarLayerSection
          layerConfig={layer.config || {}}
          patchLayer={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          setLayer={(config) => patchLayerAndSave(layer.uid, { config })}
          sources={(system?.data as any)?.avatarSources || []}
          // Every other avatar layer of the profile's layouts wearing it: this layout as it is being edited, the rest as saved.
          othersWearing={(id) => [working, ...layouts.filter((l) => l.id !== working.id)]
            .flatMap((l) => l.layers.map((y) => ({ y, here: l.id === working.id })))
            .filter(({ y, here }) => y.type === 'avatar' && (y.config as any)?.source === id && !(here && y.uid === layer.uid)).length}
          request={(payload) => (system as any).actions.avatarSources(payload)}
          why={(err) => refusalWords(t, err) || String(err?.message || err)}
          choices={talkChoicesFor(layer)}
          listening={Boolean(voiceNow.listen)}
          accent={working.accent}
          pixelAvatars={(system?.data as any)?.pixelAvatars || []}
          t={t}
        />
      )}

      {layer.type === 'pngtuber' && (
        <PngtuberLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          choices={talkChoicesFor(layer)}
          listening={Boolean(voiceNow.listen)}
          listAssets={listAssets}
          uploadAsset={uploadAsset}
          t={t}
        />
      )}

      {layer.type === 'chat' && (
        <ChatLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          others={chatElsewhere(layer)}
          shareEverywhere={() => shareChat(layer)}
          t={t}
        />
      )}

      {layer.type === 'source' && (
        <SourceLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          sources={((system?.connections?.obsData?.sources || []) as any[]).map((i) => i.inputName).filter(Boolean)}
          t={t}
        />
      )}

      {layer.type === 'hypetrain' && (
        <HypeTrainLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'giveaway' && (
        <GiveawayLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'leaderboard' && (
        <LeaderboardLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'shoutout' && (
        <ShoutoutLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'poll' && (
        <PollLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'plan' && (
        <PlanLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'shape' && (
        <ShapeLayerPanel
          accent={working.accent}
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          t={t}
        />
      )}

      {layer.type === 'text' && (
        <TextLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          /* The same shape CanvasStage hands the layer, so the
             preview in the panel and the text on the canvas
             can never disagree about what a value means. */
          state={{
            stats: system?.data?.stats,
            streamTags: system?.data?.streamTags,
            plan: system?.data?.plan,
            players: system?.data?.players,
            poll: system?.data?.poll,
            voice: (system?.data as any)?.voice,
            spotifyTrack: system?.spotify?.state?.track,
            twitchSchedule: (system?.data as any)?.twitchSchedule,
          }}
          t={t}
        />
      )}

      {layer.type === 'images' && (
        <ImageLayerPanel
          config={layer.config || {}}
          patch={(next) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), ...next } })}
          listAssets={listAssets}
          uploadAsset={uploadAsset}
          t={t}
        />
      )}

      {layer.type === 'nameplate' && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/60">
          <label className="block">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
              {t.plateAbout || 'Who it is about'}
            </span>
            <select
              value={(layer.config as any)?.source || 'manual'}
              onChange={(e) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), source: e.target.value } })}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
            >
              {NAMEPLATE_SOURCES.map((src: any) => (
                <option key={src.id} value={src.id}>{src.n ? String(t[src.key] || src.label).split('{n}').join(String(src.n)) : (t[src.key] || src.label)}</option>
              ))}
            </select>
          </label>

          {/*
            The typed fields stay visible while following the
            run, greyed rather than hidden: they still hold
            what was typed, and hiding them would look like
            the text had been thrown away.
          */}
          {(['name', 'subtitle'] as const).map((field) => (
            <label key={field} className={`block ${((layer.config as any)?.source || 'manual') !== 'manual' ? 'opacity-40' : ''}`}>
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
                {field === 'name' ? (t.layoutPlateName || 'Name') : (t.layoutPlateSubtitle || 'Second line')}
              </span>
              <input
                type="text"
                value={(layer.config as any)?.[field] || ''}
                placeholder={field === 'name' ? 'Rowan' : 'he/him — @handle'}
                onChange={(e) => patchLayer(layer.uid, { config: { ...(layer.config || {}), [field]: e.target.value } })}
                onBlur={() => commit()}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
              />
            </label>
          ))}
          <div className="flex items-center gap-2">
            {/* The accent may follow the canvas; the other two are its own. */}
            <AccentSwatch
              label={t.accent || 'accent'}
              value={(layer.config as any)?.accentColor}
              fallback={working.accent || '#f43f5e'}
              onChange={(v) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), accentColor: v } })}
              onClear={() => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), accentColor: '' } })}
              t={t}
            />
            {/* Automatic when empty: the look's, or white on a see-through black plate. */}
            {([['textColor', '#ffffff', t.plateText || 'text'], ['backgroundColor', '#09090b', t.plateBackground || 'background']] as const).map(([field, own, label]) => (
              <AutoSwatch
                key={field}
                name={field}
                label={label}
                value={(layer.config as any)?.[field]}
                fallback={own}
                onChange={(v) => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), [field]: v } })}
                onClear={() => patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), [field]: '' } })}
                t={t}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['nameSize', 'subtitleSize'] as const).map((field) => (
              <label key={field} className="block">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
                  {field === 'nameSize' ? 'Name px' : 'Line px'}
                </span>
                <input
                  type="number"
                  value={(layer.config as any)?.[field] ?? (field === 'nameSize' ? 40 : 18)}
                  onChange={(e) => patchLayer(layer.uid, { config: { ...(layer.config || {}), [field]: Number(e.target.value) || 0 } })}
                  onBlur={() => commit()}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-300 outline-none focus:border-current-accent"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                onClick={(e) => { e.stopPropagation(); patchLayerAndSave(layer.uid, { config: { ...(layer.config || {}), align: side } }); }}
                className={`flex-1 px-2 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${((layer.config as any)?.align || 'left') === side ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
              >
                {side}
              </button>
            ))}
          </div>
        </div>
      )}
      <LayerAppearancePanel
        layer={layer}
        patch={(next) => patchLayerAndSave(layer.uid, next)}
        t={t}
      />

      <LayerMotionPanel
        layer={layer}
        patch={(next) => patchLayerAndSave(layer.uid, next)}
        t={t}
      />
          {!HAS_OWN.includes(layer.type) && (
            <p className="text-[9px] text-zinc-600 leading-snug">
              {t.layerNoSettings || 'This one has nothing of its own to set — what it draws comes from its own screen.'}
            </p>
          )}

      {/* After that note, not before it: it is about the settings above, and
          under a row of fields it would read as denying they exist. */}
      <StyleFieldsPanel
        css={layer.css}
        motionCss={layer.motionCss}
        vars={(layer as any).cssVars}
        patch={(next) => patchLayerAndSave(layer.uid, { cssVars: next } as any)}
        t={t}
      />
        </div>

        <div className="flex flex-col gap-2 min-w-0">
      <LayerCssPanel
        layer={layer}
        patch={(next) => patchLayerAndSave(layer.uid, next)}
        t={t}
      />
      <p className="text-[9px] text-zinc-600 leading-snug">{kindHint(layer.type)}</p>
        </div>
      </div>
    );
  };

  // The group chosen as a whole — its layers, and the box they fill — while it is still in this layout.
  const groupMembers = selectedGroup ? (working?.layers.filter((l) => l.group === selectedGroup) || []) : [];
  const chosenGroup = groupMembers.length ? groupOf(selectedGroup) : null;
  const chosenBox = chosenGroup ? groupBox(groupMembers) : null;
  const chosenGroupLocked = groupMembers.some((l) => l.locked);

  // Another layout: nothing in the last one is chosen or being ticked any more.
  useEffect(() => { setSelectedGroup(null); setPicking(null); setPicked([]); }, [working?.id]);

  const groupChip = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all';

  /** Everything about a chosen group: its name, how it moves, and the ways in and out of it. */
  const groupPanel = chosenGroup ? (
    <div className="space-y-3" data-group-panel>
      <label className="block">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutGroupName || 'Group name'}</span>
        <CommittedInput
          value={chosenGroup.name}
          onCommit={(v: string) => renameGroup(chosenGroup.id, v)}
          className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-current-accent"
          data-group-name
        />
      </label>
      <p className="text-[10px] text-zinc-500 leading-relaxed">
        {chosenGroupLocked
          ? (t.layoutGroupLockedHint || 'A layer in it is locked, so the group stays where it is. Unlock it to move the group.')
          : (t.layoutGroupHint || 'Drag the group on the canvas to move its layers together, or pull a handle to resize them together. To move one on its own, pick it in the list or double-click it on the canvas.')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => { setPicking({ into: chosenGroup.id }); setPicked([]); }} className={groupChip} data-group-add>
          <FolderPlus size={11} /> {t.layoutGroupAddLayers || 'Add layers'}
        </button>
        <button onClick={() => ungroup(chosenGroup.id)} className={groupChip} data-group-ungroup>
          <Ungroup size={11} /> {t.layoutGroupUngroup || 'Ungroup'}
        </button>
      </div>
    </div>
  ) : null;

  /*
    One layer's row, the same in the list itself and in a group's folder —
    only the list its grip belongs to differs. While layers are being ticked
    for a group, a press ticks the row instead of choosing it.
  */
  const layerRow = (layer: CanvasLayer, order: DragOrder) => {
    const kind = kindOf(layer.type);
    const Icon = kind?.icon || Layers;
    const active = selectedLayer === layer.uid;
    const ticked = picked.includes(layer.uid);
    return (
      <div
        key={layer.uid}
        {...order.row(layer.uid)}
        onClick={() => (picking
          ? setPicked((p) => (p.includes(layer.uid) ? p.filter((u) => u !== layer.uid) : [...p, layer.uid]))
          : setSelectedLayer(layer.uid))}
        className={`rounded-xl border p-3 cursor-pointer transition-all ${
          active || ticked ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
        } ${order.held === layer.uid ? 'opacity-40' : ''}`}
      >
        {/* On a narrow screen the buttons go under the name rather than squeezing it out. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {picking ? (
            <span className={`-ml-1 ${ticked ? 'text-current-accent' : 'text-zinc-600'}`} data-layer-tick={ticked ? 'on' : 'off'}>
              {ticked ? <SquareCheck size={14} /> : <Square size={14} />}
            </span>
          ) : (
            <DragGrip grip={order.grip(layer.uid)} title={t.layoutDrag || 'Drag to move it in front of or behind the others'} className="-ml-2 -my-1" />
          )}
          <Icon size={14} className={`shrink-0 ${active ? 'text-current-accent' : 'text-zinc-500'}`} />
          <span className="flex-1 min-w-[6rem] text-[10px] font-black uppercase tracking-widest text-zinc-200 truncate">
            {kindName(layer.type)}
            {Boolean(layerDetail(layer)) && (
              <span className="ml-1.5 font-medium normal-case tracking-normal text-zinc-500">
                {layerDetail(layer)}
              </span>
            )}
          </span>
          <div className="flex items-center ml-auto">
          {/*
            Locking is here rather than on the canvas because a
            locked layer has nothing on the canvas left to click.
          */}
          <button
            onClick={(e) => { e.stopPropagation(); patchLayerAndSave(layer.uid, { locked: !layer.locked }); }}
            title={layer.locked ? (t.layoutUnlock || 'Unlock') : (t.layoutLock || 'Lock')}
            className={`p-1 ${layer.locked ? 'text-current-accent' : 'text-zinc-500 hover:text-white'}`}
          >
            {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); patchLayerAndSave(layer.uid, { visible: !layer.visible }); }}
            title={layer.visible ? (t.hide || 'Hide') : (t.show || 'Show')}
            className="p-1 text-zinc-500 hover:text-white"
          >
            {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.uid, 1); }} className="p-1 text-zinc-500 hover:text-white">
            <ArrowUp size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.uid, -1); }} className="p-1 text-zinc-500 hover:text-white">
            <ArrowDown size={13} />
          </button>
          {layer.group && (
            <button
              onClick={(e) => { e.stopPropagation(); leaveGroup(layer.uid); }}
              title={t.layoutGroupLeave || 'Take it out of the group'}
              className="p-1 text-zinc-500 hover:text-white"
              data-layer-leave
            >
              <FolderOutput size={13} />
            </button>
          )}
          {/* Only where a second copy would survive the save. */}
          {kind?.repeatable && (
            <button
              onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.uid); }}
              title={t.duplicateLayer || 'Duplicate'}
              className="p-1 text-zinc-500 hover:text-white"
            >
              <CopyPlus size={13} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); removeLayer(layer.uid); }} className="p-1 text-zinc-500 hover:text-rose-500">
            <Trash2 size={13} />
          </button>
          </div>
        </div>

        {active && (
          <div className="mt-3 xl:hidden">{layerEditor(layer)}</div>
        )}
      </div>
    );
  };

  return (
    /*
      Tighter than the other screens on purpose: every row above the canvas is
      height the canvas does not get, and this is the one screen where the
      thing being edited wants the room. The layout tabs and New layout share a
      row for the same reason.
    */
    <div className="animate-fade-in space-y-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {layouts.map((l) => (
            <button
              key={l.id}
              onClick={() => { setSelectedId(l.id); setSelectedLayer(null); }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                l.id === working?.id
                  ? 'bg-current-accent text-white border-transparent shadow-lg'
                  : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {l.name}
              {omni?.enabled && omni.live === l.id && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 align-middle" title={t.omniLiveNow || 'Live now'} data-omnilayer-tab-live />}
            </button>
          ))}
        </div>
        <Button icon={<Plus size={16} />} onClick={newLayout} disabled={atCapacity}>{t.layoutNew || 'New layout'}</Button>
      </div>

      {!working ? (
        <div className="glass-panel rounded-3xl border border-zinc-800 p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 text-zinc-500">
            <Layers size={32} />
          </div>
          <h3 className="text-xl font-extrabold mb-2 uppercase tracking-tight">{t.layoutNone || 'No layouts yet'}</h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-8">
            {t.layoutNoneHint || 'A layout holds your overlays in one place, so OBS only needs one browser source instead of one per overlay.'}
          </p>
          <Button icon={<Plus size={16} />} onClick={newLayout} disabled={atCapacity}>{t.layoutNew || 'New layout'}</Button>
        </div>
      ) : (
        <div className={EDITOR_GRID}>
          {/* ------------------------- the canvas, and what it is showing */}
          <div className="min-w-0 space-y-4">
            {/* ------------------------------------------------- the canvas */}
            <div
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={() => { setSelectedLayer(null); setSelectedGroup(null); }}
              className="glass-panel rounded-3xl border border-zinc-800 p-4 outline-none focus:border-zinc-700"
            >
              <div
                className="relative w-full mx-auto overflow-hidden"
                style={{
                  aspectRatio: `${working.width} / ${working.height}`,
                  /*
                    Now that the page is not capped, the canvas is as wide as the
                    window — which on a short screen would make it taller than the
                    window too, and you would scroll to see the bottom of your own
                    overlay. Capping the width by what the height allows keeps the
                    whole canvas on screen; mx-auto centres it once that bites.
                  */
                  maxWidth: `calc((100vh - 13rem) * ${working.width} / ${working.height})`,
                  // A checkerboard, so a transparent layout reads as transparent
                  // rather than as a black background somebody forgot to set.
                  backgroundImage:
                    'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: '#09090b',
                  /*
                    Square corners, and a hairline to say exactly where they
                    are. The canvas is a 1920 by 1080 rectangle and OBS will
                    crop it as one, so a rounded editor rounds off the only
                    thing in here that is measured: a layer pushed into a
                    corner had its corner clipped away, and lining anything up
                    against an edge meant opening OBS to see where the edge
                    really was. The panel around it keeps its radius, being a
                    panel rather than a measurement.
                  */
                  outline: '1px solid #3f3f46',
                }}
              >
                <CanvasStage
                  layout={working}
                  system={system}
                  t={t}
                  showGuides
                  onScale={(k) => { scaleRef.current = k; }}
                >
                  {/*
                    Handles live inside the stage, in canvas coordinates, so they
                    scale with it and stay on their layer no matter how the pane
                    is sized.
                  */}
                  {working.layers
                    // A locked layer is not offered to the pointer at all, so
                    // there is nothing over it to catch a drag meant for
                    // whatever sits on top.
                    .filter((l) => l.visible && !l.locked)
                    // The selected layer’s handle goes last, so it is on top and
                    // can always be grabbed. Without this an alerts layer — which
                    // covers the whole canvas by design — sits over everything
                    // else and nothing underneath can be dragged at all.
                    .sort((a, b) => Number(a.uid === selectedLayer) - Number(b.uid === selectedLayer))
                    .map((layer) => {
                    const active = selectedLayer === layer.uid;
                    /*
                      The toggles govern the chrome for layers you are not
                      working on. The one you have selected keeps its outline
                      and its handle whatever they say, because dragging a box
                      you cannot see is not a cleaner view, it is a blind one.
                    */
                    const outline = active
                      ? '3px solid #f43f5e'
                      : (showOutlines ? '2px dashed rgba(255,255,255,0.28)' : 'none');
                    return (
                      <div
                        key={layer.uid}
                        // A layer in a group takes its group with it, unless it is the one chosen on its own.
                        onPointerDown={(e) => (layer.group && !active ? startGroupDrag(e, layer.group, 'move') : startDrag(e, layer, 'move'))}
                        onDoubleClick={layer.group ? () => setSelectedLayer(layer.uid) : undefined}
                        className="absolute cursor-move"
                        style={{
                          left: layer.x, top: layer.y, width: layer.width, height: layer.height,
                          outline,
                          background: active ? 'rgba(244,63,94,0.08)' : 'transparent',
                        }}
                      >
                        {/*
                          The label sits above the box, except when there is no
                          room above it — an alerts layer starts at y=0, and its
                          label would be drawn off the canvas and clipped away.
                        */}
                        {(showLabels || active) && (
                          <span
                            className="absolute left-0 px-2 py-1 rounded-md text-white font-black uppercase tracking-widest whitespace-nowrap"
                            style={{
                              top: layer.y < 30 ? 0 : -28,
                              fontSize: 13,
                              background: active ? '#f43f5e' : 'rgba(0,0,0,0.65)',
                            }}
                          >
                            {kindName(layer.type)}{layer.aspect ? ` · ${layer.aspect}` : ''}
                          </span>
                        )}
                        {/*
                          Eight handles: a corner pulls both of its edges, a
                          side one only. Drawn in canvas pixels, so they scale
                          with the stage like everything else here. The side
                          bars sit between the corners and never cover them.
                        */}
                        {active && GRIPS.map(({ grip, cursor, style }) => (
                          <div
                            key={grip}
                            data-grip={grip}
                            onPointerDown={(e) => startDrag(e, layer, grip)}
                            className="absolute rounded-sm"
                            style={{ ...style, cursor, background: '#f43f5e', border: '2px solid white' }}
                          />
                        ))}
                      </div>
                    );
                  })}
                  {/*
                    The chosen group: one box round everything in it, on top,
                    with the same handles a layer has. Dragged, every layer in
                    it moves; pulled, every layer keeps its place in the box.
                  */}
                  {chosenGroup && chosenBox && (
                    <div
                      onPointerDown={(e) => startGroupDrag(e, chosenGroup.id, 'move')}
                      onDoubleClick={(e) => pickInGroup(e, chosenGroup.id, chosenBox)}
                      className={`absolute ${chosenGroupLocked ? '' : 'cursor-move'}`}
                      data-group-box={chosenGroup.id}
                      style={{
                        left: chosenBox.x, top: chosenBox.y, width: chosenBox.width, height: chosenBox.height,
                        outline: '3px dashed #f43f5e',
                        background: 'rgba(244,63,94,0.06)',
                      }}
                    >
                      <span
                        className="absolute left-0 px-2 py-1 rounded-md text-white font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5"
                        style={{ top: chosenBox.y < 30 ? 0 : -28, fontSize: 13, background: '#f43f5e' }}
                      >
                        <Folder size={13} /> {chosenGroup.name}
                      </span>
                      {!chosenGroupLocked && GRIPS.map(({ grip, cursor, style }) => (
                        <div
                          key={grip}
                          data-grip={grip}
                          onPointerDown={(e) => startGroupDrag(e, chosenGroup.id, grip)}
                          className="absolute rounded-sm"
                          style={{ ...style, cursor, background: '#f43f5e', border: '2px solid white' }}
                        />
                      ))}
                    </div>
                  )}
                </CanvasStage>
              </div>
              <div className="flex items-center gap-3 mt-3 px-1">
                <p className="flex-1 min-w-0 text-[10px] text-zinc-500">
                  {t.layoutDragHint || 'Drag to move. Pull a corner to resize, or a side to stretch one way. Arrow keys nudge. Hold Shift to ignore snapping, or with an arrow key to move 10px.'}
                </p>
                {/*
                  Two switches for the editor’s own furniture. With both off the
                  canvas is the overlay and nothing else, which is the only way
                  to judge spacing without opening OBS to look at the real thing.
                */}
                <button
                  onClick={() => { setShowOutlines((v) => { setChrome('layout_outlines', !v); return !v; }); }}
                  title={t.layoutBordersHint || 'Show a dashed border around every layer'}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                    showOutlines ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <SquareDashed size={12} />
                  {t.layoutBorders || 'Borders'}
                </button>
                <button
                  onClick={() => { setShowLabels((v) => { setChrome('layout_labels', !v); return !v; }); }}
                  title={t.layoutNamesHint || 'Show each layer name above it'}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                    showLabels ? 'bg-current-accent/10 border-current-accent text-current-accent' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Tag size={12} />
                  {t.layoutNames || 'Names'}
                </button>
              </div>
            </div>

            {/*
              What the list used to open inside itself. Here because this is
              where you are already looking, and because a layout with a dozen
              layers pushed the settings for one of them off the bottom of the
              screen — you set a number, scrolled up to see what it did, and
              scrolled back down for the next one.
            */}
            <div className="hidden xl:block glass-panel rounded-3xl border border-zinc-800 p-5">
              {chosen ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <ChosenIcon size={14} className="text-current-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200">
                      {kindName(chosen.type)}
                    </span>
                    {Boolean(layerDetail(chosen)) && (
                      <span className="min-w-0 truncate text-[10px] text-zinc-500">{layerDetail(chosen)}</span>
                    )}
                  </div>
                  {layerEditor(chosen)}
                </>
              ) : chosenGroup ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Folder size={14} className="text-current-accent" />
                    <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-zinc-200">{chosenGroup.name}</span>
                    <span className="text-[10px] text-zinc-500">{fill(t.layoutGroupCount || '{n} layers', { n: String(groupMembers.length) })}</span>
                  </div>
                  {groupPanel}
                </>
              ) : (
                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  {t.layoutPickLayer || 'Pick a layer — on the canvas or in the list — and everything about it appears here.'}
                </p>
              )}
            </div>
          </div>

          {/* -------------------------------------------------- the panel */}
          <div className="space-y-4">
            <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-4">
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutName || 'Name'}</span>
                <input
                  type="text"
                  value={working.name}
                  onChange={(e) => applyWorking({ ...working, name: e.target.value })}
                  onBlur={() => commit()}
                  className="w-full mt-1 bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-current-accent"
                />
              </label>

              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutSize || 'Canvas size'}</span>
                <div className="flex gap-2 mt-1">
                  {SIZE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => patchLayout({ width: p.width, height: p.height })}
                      className={`flex-1 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                        working.width === p.width && working.height === p.height
                          ? 'bg-current-accent text-white border-transparent'
                          : 'bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {(['width', 'height'] as const).map((dim) => (
                    <input
                      key={dim}
                      type="number"
                      value={working[dim]}
                      onChange={(e) => applyWorking({ ...working, [dim]: Number(e.target.value) || working[dim] })}
                      onBlur={() => commit()}
                      className="flex-1 min-w-0 bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] font-mono text-zinc-300 outline-none focus:border-current-accent"
                    />
                  ))}
                </div>
              </div>

              {/*
                The canvas tokens. Both are what a look is mostly made of, so
                they sit with the canvas rather than inside any one layer: a
                colour set here is the one every layer uses unless it was given
                its own, and the typeface is inherited by anything that has not
                chosen one.
              */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutFont || 'Typeface'}</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={working.fontFamily || ''}
                    onChange={(e) => patchLayout({ fontFamily: e.target.value })}
                    className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
                  >
                    <option value="">{t.perLayer || 'Per layer'}</option>
                    {canvasFonts.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <FontUploadButton t={t} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutAccent || 'Accent'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-600">
                    {working.accent ? (t.accentHint || 'Used where a layer sets no colour') : (t.layoutAccentNoneHint || 'None: each layer uses its own default')}
                  </span>
                  {/*
                    No accent is shown as a dashed, faded swatch, so "none" and
                    "a colour that happens to be pink" never look the same.
                  */}
                  <input
                    type="color"
                    value={working.accent || '#f43f5e'}
                    onChange={(e) => setAccent(e.target.value)}
                    title={working.accent ? undefined : (t.layoutAccentNone || 'No accent')}
                    className={`w-8 h-8 rounded-lg bg-transparent border cursor-pointer ${
                      working.accent ? 'border-zinc-800' : 'border-dashed border-zinc-600 opacity-35'
                    }`}
                  />
                  {working.accent && (
                    <button
                      onClick={() => setAccent('')}
                      title={t.layoutAccentClear || 'No accent'}
                      className="p-1 text-zinc-600 hover:text-current-accent"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {layouts.length > 1 && (
                <label className="flex items-start gap-2 -mt-1 cursor-pointer" data-layout-accent-all>
                  <input type="checkbox" checked={accentAll} onChange={(e) => toggleAccentAll(e.target.checked)} className="accent-current-accent mt-0.5" />
                  <span className="text-[9px] text-zinc-500 leading-snug">
                    <span className="font-bold text-zinc-300">{t.layoutAccentAll || 'Same accent on every layout of this profile'}</span>
                    {' · '}
                    {accentAll
                      ? fill(t.layoutAccentAllOn || 'all {n} follow it', { n: layouts.length })
                      : accentOthers
                        ? fill(accentOthers === 1 ? (t.layoutAccentAllOne || '1 other layout has a different one') : (t.layoutAccentAllSome || '{n} other layouts have a different one'), { n: accentOthers })
                        : (t.layoutAccentAllSame || 'they already match')}
                  </span>
                </label>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutBackground || 'Background'}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => patchLayout({ background: working.background === 'transparent' ? '#101014' : 'transparent' })}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                      working.background === 'transparent'
                        ? 'bg-current-accent text-white border-transparent'
                        : 'bg-zinc-900/60 text-zinc-500 border-zinc-800'
                    }`}
                  >
                    {t.transparent || 'Transparent'}
                  </button>
                  {working.background !== 'transparent' && (
                    <input
                      type="color"
                      value={working.background}
                      onChange={(e) => patchLayout({ background: e.target.value })}
                      className="w-8 h-8 rounded-lg bg-transparent border border-zinc-800 cursor-pointer"
                    />
                  )}
                </div>
              </div>

              <LayoutCssPanel
                css={working.css}
                setCss={(next) => patchLayout({ css: next })}
                t={t}
              />
            </div>

            {/* layers, front of the stack at the top of the list */}
            <div ref={layerOrder.listRef} className={`relative glass-panel rounded-3xl border border-zinc-800 p-5 space-y-3 ${layerOrder.held ? 'select-none' : ''}`}>
              {layerOrder.line}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutLayers || 'Layers'}</span>
                <span className="flex-1 text-[9px] text-zinc-600 font-bold text-right">{t.layoutFrontFirst || 'front first'}</span>
                {!picking && working.layers.length > 0 && (
                  <button
                    onClick={() => { setPicking({ into: null }); setPicked([]); }}
                    title={t.layoutGroupStartHint || 'Put layers in a folder, to move and resize them together'}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700"
                    data-layer-group-start
                  >
                    <FolderPlus size={11} /> {t.layoutGroupStart || 'Group'}
                  </button>
                )}
              </div>

              {/* Ticking layers for a group: what to do, and the button that does it. */}
              {picking && (
                <div className="rounded-xl border border-current-accent/40 bg-current-accent/5 p-3 space-y-2" data-layer-picking>
                  <p className="text-[10px] text-zinc-300">{t.layoutGroupPickHint || 'Tick the layers to put together.'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={makeGroup}
                      disabled={!picked.length}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-current-accent text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
                      data-layer-group-make
                    >
                      <FolderPlus size={11} />
                      {picking.into
                        ? fill(t.layoutGroupAddTo || 'Add to {name} ({n})', { name: groupOf(picking.into)?.name || '', n: String(picked.length) })
                        : fill(t.layoutGroupMake || 'Make a group ({n})', { n: String(picked.length) })}
                    </button>
                    <button onClick={() => { setPicking(null); setPicked([]); }} className={groupChip}>
                      {t.cancel || 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              {working.layers.length === 0 && (
                <p className="text-[10px] text-zinc-600 py-2">{t.layoutNoLayers || 'Nothing on the canvas yet. Add a layer below.'}</p>
              )}

              {/*
                A layer on its own is a row; a group is a folder of rows,
                dragged as one. Both are rows of the same list, so a group
                goes in front of or behind other layers whole.
              */}
              {displayUnits(working.layers).map((unit: any) => (unit.group ? (
                <LayerGroupFolder
                  key={unit.id}
                  group={groupOf(unit.group) || { id: unit.group, name: unit.group }}
                  members={unit.layers as CanvasLayer[]}
                  order={layerOrder}
                  rowId={unit.id}
                  open={Boolean(picking) || opened.includes(unit.group)}
                  selected={selectedGroup === unit.group && !selectedLayer}
                  onSelect={() => { setSelectedLayer(null); setSelectedGroup(unit.group); }}
                  onToggleOpen={() => setOpened((o) => (o.includes(unit.group) ? o.filter((g) => g !== unit.group) : [...o, unit.group]))}
                  onMove={(delta) => moveLayer(unit.id, delta)}
                  onUngroup={() => ungroup(unit.group)}
                  onLock={(locked) => patchGroup(unit.group, { locked })}
                  onShow={(visible) => patchGroup(unit.group, { visible })}
                  onDropMember={(uid, gap) => dropMember(unit.group, uid, gap)}
                  renderMember={layerRow}
                  editor={groupPanel}
                  t={t}
                />
              ) : layerRow(unit.layer as CanvasLayer, layerOrder)))}

              {unused.length > 0 && (
                <div className="pt-2 border-t border-zinc-800">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutAdd || 'Add a layer'}</span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {unused.map((k) => (
                      <button
                        key={k.type}
                        onClick={() => addLayer(k.type)}
                        title={kindHint(k.type)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                      >
                        <k.icon size={11} /> {kindName(k.type)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Omnilayer: this layout on stream, and the mode's settings */}
            <OmnilayerPanel
              omni={omni}
              layout={working as any}
              layouts={layouts as any}
              obsScenes={obsScenes}
              obsConnected={obsConnected}
              currentScene={obsCurrentScene}
              run={(payload) => system?.actions?.omnilayer?.(payload) ?? Promise.resolve(null)}
              t={t}
            />

            {/* what this layout is for: the scene type a command can ask for in any profile */}
            <SceneTypePicker
              types={omni?.types || []}
              layout={working as any}
              layouts={layouts as any}
              onPick={setSceneType}
              run={(payload) => system?.actions?.omnilayer?.(payload) ?? Promise.resolve(null)}
              t={t}
            />

            {/* which OBS scenes show this layout */}
            <div className="glass-panel rounded-3xl border border-zinc-800 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Monitor size={13} className="text-current-accent" />
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutScenes || 'Show in these scenes'}</span>
              </div>
              <p className="text-[9px] text-zinc-600 mb-3 leading-snug">
                {t.layoutScenesHint || 'Add one canvas source to every OBS scene, then pick which scenes show this layout. A scene can only show one.'}
              </p>

              {!obsConnected ? (
                <p className="text-[10px] text-zinc-600 py-1">
                  {t.layoutScenesOffline || 'Connect OBS to bind scenes.'}
                </p>
              ) : obsScenes.length === 0 ? (
                <p className="text-[10px] text-zinc-600 py-1">{t.layoutScenesNone || 'OBS reported no scenes.'}</p>
              ) : (
                <div className="space-y-1.5">
                  {obsScenes.map((scene) => {
                    const owner = ownerOf(scene);
                    const mine = owner?.id === working.id;
                    const takenByOther = owner && !mine;
                    return (
                      <button
                        key={scene}
                        onClick={() => toggleScene(scene)}
                        // Naming the other layout matters: clicking moves the
                        // scene, and that is worth knowing before the click.
                        title={takenByOther ? `Currently shown by "${owner!.name}" — clicking moves it here` : undefined}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                          mine ? 'border-current-accent bg-current-accent/10' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-md border shrink-0 flex items-center justify-center ${
                          mine ? 'bg-current-accent border-transparent' : 'border-zinc-700'
                        }`}>
                          {mine && <Check size={10} className="text-white" />}
                        </span>
                        <span className="flex-1 text-[10px] font-bold text-zinc-300 truncate">{scene}</span>
                        {scene === obsCurrentScene && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-current-accent shrink-0">{t.live || 'live'}</span>
                        )}
                        {takenByOther && (
                          <span className="text-[8px] font-bold text-zinc-600 truncate max-w-[90px] shrink-0">{owner!.name}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {obsConnected && obsScenes.length > 0 && boundScenes.length === 0 && (
                <p className="text-[9px] text-amber-500/80 mt-3 leading-snug">
                  {t.layoutScenesUnbound || 'No scenes selected, so this layout only appears if a source names it directly.'}
                </p>
              )}
            </div>

            {/* the whole point: one URL for OBS */}
            <div className="glass-panel rounded-3xl border border-zinc-800 p-5">
              <div className="flex items-center gap-2 mb-2">
                <MonitorPlay size={13} className="text-current-accent" />
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t.layoutSource || 'Browser source'}</span>
              </div>
              <code className="text-[10px] text-current-accent font-mono break-all block mb-2">{shownUrl}</code>
              <p className="text-[9px] text-zinc-600 mb-3 leading-snug">
                {usingBindings
                  ? (t.layoutSourceAutoHint || 'One source, added to every scene. It follows whichever scene is live. Set it to the canvas size above.')
                  : (t.layoutSourceHint || 'Set the source to the canvas size above.')}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copyUrl}>
                  {copied ? (t.copied || 'Copied') : (t.copy || 'Copy')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ExternalLink size={13} />}
                  onClick={() => window.open(shownUrl, '_blank', `width=${Math.min(1280, working.width)},height=${Math.min(720, working.height)}`)}
                >
                  {t.preview || 'Open'}
                </Button>
              </div>
            </div>

            {/*
              The looks this layout wears, kept as a theme of the streamer's
              own: styled here, a layer at a time, and then theirs to apply
              to any other layout from the Library.
            */}
            <SaveAsTheme layout={working} system={system} t={t} />

            <button
              onClick={() => deleteLayout(working.id)}
              className="w-full py-2.5 rounded-xl border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-rose-500 hover:border-rose-900 transition-all"
            >
              {t.layoutDelete || 'Delete this layout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
