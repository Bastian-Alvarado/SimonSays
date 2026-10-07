/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The library: every stylesheet the app ships, shown rather than named.
 *
 * A row of buttons labelled "Panel" and "Notched panel" tells you nothing
 * about what you are getting. With a dozen it is a guessing game and with
 * fifty it is unusable, so each one is drawn here — by the real component,
 * through the same canvas the stream uses, with the stylesheet applied. A
 * picture of a preset would be a second thing to keep in step with the preset;
 * this cannot drift, because it *is* the preset.
 *
 * Nothing is edited here. The stylesheet is shown so you can read it, and the
 * two buttons take it somewhere it can be changed — the overlay editor, which
 * already has a box for exactly that.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, CopyPlus, Download, Layers, Palette, Pencil, Plus, RotateCcw, Trash2, Undo2, Upload, Wand2, X } from 'lucide-react';
import { CanvasStage, CanvasLayout } from '../CanvasStage';
import { AlertOverlay } from '../AlertOverlay';
import { ChatLog } from '../ChatMessageRow';
import { CSS_LOOKS, ALL_PRESETS, PRESET_LAYER_TYPES, canApplyInBulk, presetKind, presetField, presetApplies } from '../../../shared/css-presets.js';
import { previewSystem } from '../../../shared/preview-sample.js';
import { pieceTargets, piecePlan, themePlan, alertPlan, withChanges, replacesOwn, isOwnCss, themesToApply } from '../../../shared/theme-apply.js';
import { liveLayout } from '../../../shared/live-layout.js';
import { lookWords, themeWords } from '../../../shared/looks-es.js';
import { userThemeCss, newPieceId, THEME_PIECE_TYPES, themeFromLayout, themeFonts, themeFile, readThemeFile } from '../../../shared/user-themes.js';
import { fontFamilyName } from '../../../shared/chat-style.js';
import { httpBase } from '../../hooks/useBackend';
import { forgetCustomFonts } from '../../hooks/useCustomFonts';
import { ThemePieceEditor } from '../ThemePieceEditor';
import { ThemeStylePanel } from '../ThemeStylePanel';
import { refusalWords, fill } from '../../words';

/** One field of one layer, from what it was to what it is set to. */
interface Change { uid: string; kind: string; field: string; from: string; to: string; piece: string | null }

/**
 * What an apply changed, kept so it can be taken back: the layers it wrote on
 * one layout — the chat among them — and the alerts, each with what they held before.
 */
interface UndoRecord {
  label: string;
  layoutId?: string;
  changes?: Change[];
  alerts?: { id: string; applied: Record<string, any>; before: Record<string, any> }[];
}

/*
  A picture for an images look to frame: drawn here as an SVG, so the card
  never depends on an upload that might not exist. A mark with a transparent
  background, because that is what a look holding a logo most has to handle.
*/
const SAMPLE_PICTURE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">'
  + '<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ff2d95"/><stop offset=".5" stop-color="#ffe600"/><stop offset="1" stop-color="#00d5ff"/></linearGradient></defs>'
  + '<rect x="30" y="40" width="80" height="80" rx="18" fill="url(#g)"/>'
  + '<text x="130" y="95" font-family="Montserrat, sans-serif" font-weight="900" font-size="42" fill="#ffffff">LOGO</text></svg>',
);
/*
  A scene for a piece to be seen against, where the piece is about what is
  behind it (previewOver): bright, busy and full of edges, the way a game
  capture is, so a blur shows as a blur and a texture as a texture.
*/
const SAMPLE_SCENE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="200" viewBox="0 0 520 200">'
  + '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>'
  + '<rect width="520" height="200" fill="url(#s)"/>'
  + '<circle cx="410" cy="60" r="34" fill="#fde047"/>'
  + '<path d="M0 150 L70 95 L130 140 L210 70 L300 150 L380 105 L520 160 L520 200 L0 200 Z" fill="#16a34a"/>'
  + '<path d="M0 175 L520 175 L520 200 L0 200 Z" fill="#78350f"/>'
  + '<rect x="40" y="30" width="90" height="16" rx="3" fill="#f43f5e"/><rect x="140" y="30" width="60" height="16" rx="3" fill="#22d3ee"/>'
  + '<text x="40" y="92" font-family="Montserrat, sans-serif" font-weight="900" font-size="30" fill="#ffffff">GAMEPLAY</text></svg>',
);
import { copyText } from '../../utils';

interface Props {
  layouts: CanvasLayout[];
  setLayouts: (next: CanvasLayout[]) => void;
  system: any;
  t: any;
}

/** How big each kind of preview is, in canvas pixels, before it is scaled. */
const PREVIEW_SIZE: Record<string, { width: number; height: number }> = {
  omnibar: { width: 1280, height: 64 },
  runcard: { width: 640, height: 140 },
  nameplate: { width: 520, height: 130 },
  viewers: { width: 420, height: 90 },
  alert: { width: 560, height: 150 },
  chat: { width: 420, height: 220 },
  text: { width: 520, height: 120 },
  goal: { width: 520, height: 110 },
  spotify: { width: 520, height: 150 },
  plan: { width: 460, height: 190 },
  question: { width: 520, height: 150 },
  poll: { width: 520, height: 330 },
  voice: { width: 560, height: 180 },
  avatar: { width: 260, height: 260 },
  pngtuber: { width: 260, height: 260 },
  hypetrain: { width: 560, height: 110 },
  shoutout: { width: 520, height: 150 },
  leaderboard: { width: 420, height: 360 },
  giveaway: { width: 520, height: 260 },
  players: { width: 540, height: 300 },
  countdown: { width: 700, height: 220 },
  stopwatch: { width: 700, height: 220 },
  shape: { width: 520, height: 200 },
  roster: { width: 560, height: 190 },
  images: { width: 560, height: 200 },
};

/** A kind of piece by name, in the dashboard's language; alert looks are not a layer, so they have their own. */
const kindLabel = (kind: string, t: any): string =>
  (kind === 'alert' ? t.libraryKind_alert : t[`layerKind_${kind}`]) || LABELS[kind] || kind;

const LABELS: Record<string, string> = {
  omnibar: 'Omnibar',
  runcard: 'Run card',
  nameplate: 'Nameplate',
  viewers: 'Viewers',
  alert: 'Alert',
  chat: 'Chat',
  text: 'Text',
  goal: 'Goal',
  spotify: 'Spotify',
  plan: 'Plan',
  question: 'Question',
  players: 'Players',
  poll: 'Poll',
  voice: 'Voice call',
  avatar: 'Pixel avatar',
  pngtuber: 'PNGtuber',
  hypetrain: 'Hype Train',
  shoutout: 'Shoutout',
  leaderboard: 'Leaderboard',
  giveaway: 'Giveaway',
  countdown: 'Countdown',
  stopwatch: 'Run timer',
  shape: 'Shape',
  roster: 'Commentators',
  images: 'Images',
};

/**
 * Which box each stylesheet goes in for a preview.
 *
 * A look is a look. A motion goes in the motion box with nothing in the look
 * box — right for one that animates the layer itself, and wrong for one that
 * animates something a look drew. Those name that look in previewWith, and it
 * is put underneath so the card shows the motion doing what it really does.
 */
/*
  The streamer's own themes' pieces, by id, for a motion of theirs drawn over
  a look of theirs. Set by the Library each time it draws, which is the only
  place these previews are made.
*/
let userPieces = new Map<string, any>();
const lookFor = (object: any) => {
  if (presetKind(object) !== 'motion') return object.css;
  const under = userPieces.get(object.previewWith) || (ALL_PRESETS as any[]).find((p) => p.id === object.previewWith);
  return under ? under.css : '';
};
const motionFor = (object: any) => (presetKind(object) === 'motion' ? object.css : '');

/** What the Library's stand-ins say, in the dashboard's language; names stay as they are. */
const SAMPLE_WORDS: Record<string, { followed: string; chat: string[]; nowPlaying: string; question: string; tonight: string; subGoal: string; impostor: string }> = {
  en: { followed: '{user} followed!', chat: ['good luck tonight', 'that skip was clean', 'hello chat'], nowPlaying: 'Now playing', question: 'Question', tonight: 'Tonight', subGoal: 'Sub goal', impostor: 'Who Is The Impostor?' },
  es: { followed: '¡{user} te sigue!', chat: ['suerte esta noche', 'ese skip fue limpio', 'hola chat'], nowPlaying: 'Sonando', question: 'Pregunta', tonight: 'Esta noche', subGoal: 'Meta de subs', impostor: '¿Quién es el Impostor?' },
};
const sampleWords = (lang?: string) => SAMPLE_WORDS[lang || 'en'] || SAMPLE_WORDS.en;

/**
 * An alert for a preview to draw.
 *
 * Not one of yours: an alert preset is picked before it is applied to any
 * particular alert, and a card showing whichever alert happened to be first
 * in the list would be showing something the preset has nothing to do with.
 * A follow with a name in it exercises every part one can name.
 */
const sampleAlert = (object: any, replay: number, lang = 'en') => ({
  id: `preview-${object.id}-${replay}`,
  user: 'ROWAN',
  text: sampleWords(lang).followed.split('{user}').join('ROWAN'),
  config: {
    id: object.id,
    name: object.name, type: 'twitch_follow', enabled: true,
    messageTemplate: sampleWords(lang).followed, highlightText: true,
    layout: 'image-above',
    // Automatic, so the look shows its own: a colour here would be chosen,
    // and beat the look the card is there to show.
    fontFamily: '', fontSize: 30,
    textColor: '', accentColor: '',
    // Long enough that the built-in exit never fires here: what this card is
    // showing is the stylesheet, and the motion presets end themselves.
    duration: 600000,
    animationIn: 'animate-pop-in', animationOut: 'animate-fade-out',
    css: lookFor(object),
    motionCss: motionFor(object),
  },
});

/**
 * A few messages for a preview to draw.
 *
 * Not yours: a chat preset is picked before it is applied, and a card
 * showing whatever happened to be said a moment ago would be showing
 * something the preset has nothing to do with. Three of them, because a
 * chat look is mostly about how rows sit against each other.
 */
const sampleChat = (lang = 'en') => {
  const [a, b, c] = sampleWords(lang).chat;
  return [
    { id: 'c1', platform: 'twitch', user: 'pixelpepp', msg: a, color: '#00d5ff', ts: 0 },
    { id: 'c2', platform: 'twitch', user: 'ninja_07', msg: b, color: '#00ff88', ts: 0 },
    { id: 'c3', platform: 'twitch', user: 'i_might_be_a_bot', msg: c, color: '#ffe600', ts: 0 },
  ];
};

/** The chat settings a preview draws with: the custom theme, and the preset. */
const sampleChatSettings = (object: any) => ({
  chatTheme: 'custom',
  fontSize: 15,
  usernameFontSize: 15,
  emoteSize: 18,
  showAvatars: false,
  showPlatformIcons: true,
  showRankBadges: false,
  colorUsername: true,
  animations: false,
  css: lookFor(object),
  motionCss: motionFor(object),
});

/**
 * One preset, drawn by the thing that will draw it on stream.
 *
 * `height` is how tall the box is, in pixels. The stage fits itself to
 * whatever it is given, so a shorter box is the same preset seen smaller —
 * which is what a theme card wants and what a card for one piece does not.
 */
/*
  The strings are the app's own, passed through. The stage was once given an
  empty set, and every label the app supplies rather than one somebody typed
  — "Top chatters", "Now playing" — came out blank, so a slot showing one
  drew with no header at all.
*/
const Preview = ({ object, system, accent, replay, height, t }: { object: any; system: any; accent: string; replay: number; height?: number; t: any }) => {
  /*
    An alert is not a layer, so it is not drawn through the canvas. It is
    still the real component with the real stylesheet — the whole point of
    the library is that a card cannot drift from what it is showing.
  */
  /*
    Chat is not a layer either. Drawn by the same column the stream uses, so
    a card cannot come to disagree with what it is showing.
  */
  if (presetApplies(object) === 'chat') {
    return (
      <div
        className="rounded-xl overflow-hidden border border-zinc-800 p-2"
        /*
          As tall as its three messages, whatever the look makes of them: a
          fixed height cut off the top one in looks that put each in a bubble.
          The column fills its box, so with no height of its own the box is the
          column's own height.
        */
        style={{ backgroundColor: '#0b0b0e', ...(height ? { height } : { minHeight: 150 }) }}
      >
        <ChatLog
          key={`chat-${object.id}-${replay}`}
          messages={sampleChat(t.lang) as any}
          settings={sampleChatSettings(object) as any}
          gap={6}
          t={t}
        />
      </div>
    );
  }

  if (presetApplies(object) === 'alert') {
    return (
      <div
        className="relative rounded-xl overflow-hidden border border-zinc-800"
        style={{ backgroundColor: '#0b0b0e', height: height || 150 }}
      >
        <AlertOverlay alert={sampleAlert(object, replay, t.lang) as any} scale={0.8} />
      </div>
    );
  }
  /*
    A preset may say what shape it should be shown at. A rule is a few pixels
    tall and drawn at the height of a panel it is a slab of colour, which is
    the one thing a catalogue of pictures must not do.
  */
  const size = object.previewSize || PREVIEW_SIZE[object.layerType] || PREVIEW_SIZE.shape;

  const layout = useMemo(() => ({
    id: `preview-${object.id}-${replay}`,
    name: object.name,
    width: size.width,
    height: size.height,
    background: 'transparent',
    accent,
    scenes: [],
    css: '',
    layers: [
      /*
        Something behind it, for a piece that is about what is behind it: a
        frosted glass blurs the layers under it, scanlines lie over a picture,
        a panel's cut corners are cut out of something. Over the empty
        checkerboard each looked like a plain dark box, and like each other.
      */
      ...(object.previewOver ? [{
        type: 'images', uid: `preview-under-${object.id}-${replay}`, x: 0, y: 0, width: size.width, height: size.height,
        opacity: 1, visible: true, css: '', motionCss: '', config: { sources: [SAMPLE_SCENE], fit: 'cover' },
      }] : []),
      {
      type: object.layerType,
      uid: `preview-${object.id}-${replay}`,
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      opacity: 1,
      visible: true,
      css: lookFor(object),
      motionCss: motionFor(object),
      // Shapes need a kind; a plate needs somebody to be about.
      // A tall-bar look is shown on the tall bar it was drawn for, not on Main.
      // A look that needs something particular to be shown with says so itself.
      config: object.previewConfig ? object.previewConfig
        : object.previewTall ? { bar: 'preview-tall' }
        : object.layerType === 'images' ? { sources: [SAMPLE_PICTURE], fit: 'contain' }
        : object.layerType === 'shape' ? { kind: 'rect' }
        : object.layerType === 'nameplate' ? { source: 'runner' }
          : object.layerType === 'text' ? { text: sampleWords(t.lang).nowPlaying, fontSize: 34, align: 'center' }
          : object.layerType === 'question' ? { label: sampleWords(t.lang).question, showAsker: true }
          : object.layerType === 'plan' ? { title: sampleWords(t.lang).tonight, mode: 'all', showNotes: true }
          : object.layerType === 'spotify' ? { preview: true }
          : object.layerType === 'goal' ? { source: 'manual', manualValue: 64, target: 100, label: sampleWords(t.lang).subGoal, showPercent: true }
          : object.layerType === 'players' ? { title: sampleWords(t.lang).impostor }
          : object.layerType === 'voice' ? { slots: 4 }
          : object.layerType === 'pngtuber' ? { frames: { idle: SAMPLE_PICTURE } }
          : object.layerType === 'hypetrain' || object.layerType === 'shoutout' || object.layerType === 'leaderboard' || object.layerType === 'giveaway' ? { preview: true }
          : {},
    }],
  }), [object.id, object.css, object.previewWith, accent, size.width, size.height, replay]) as any;

  return (
    <div
      className="rounded-xl overflow-hidden border border-zinc-800"
      style={{
        /*
          The shape of the piece, within reason. A box the same height for
          everything shrank the tall ones — a plan, a poll, the players — until
          their words could not be read; the box now follows the piece and is
          held between a strip and a panel. A theme card, which shows a strip
          of each, still says how tall.
        */
        /*
          The width is the card's, said outright. Left to itself, a box with
          an aspect ratio carries its minimum height across into a minimum
          width — a bar 20 times wider than tall, held to 110px, asked for
          2200 — and every wide piece spilled out of its card. With the width
          set, the minimum and maximum can only make it taller or shorter.
        */
        width: '100%',
        minWidth: 0,
        ...(height ? { height } : { aspectRatio: `${size.width} / ${size.height}`, minHeight: 110, maxHeight: 240 }),
        // A checkerboard, so a preset that is mostly transparent reads as
        // transparent rather than as one that failed to draw.
        backgroundImage:
          'linear-gradient(45deg, #17171b 25%, transparent 25%), linear-gradient(-45deg, #17171b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #17171b 75%), linear-gradient(-45deg, transparent 75%, #17171b 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        backgroundColor: '#0b0b0e',
      }}
    >
      <CanvasStage layout={layout} system={system} t={t} />
    </div>
  );
};

/** How many pieces a theme card draws to say what it looks like. */
const SIGNATURE = 3;

/**
 * The pieces that stand for a theme on its card.
 *
 * Its first few, skipping three things. Motion, because a still frame of an
 * animation is not what it looks like and a card that replayed on arrival
 * would have several of them going at once. Chat and alerts, because both
 * want a box half again as tall as this strip and both would be showing
 * sample messages rather than the theme. What is left is the theme's own
 * furniture, which is what "what does this look like" is actually asking.
 */
const signature = (look: any) => look.objects
  .filter((o: any) => presetKind(o) !== 'motion'
    && presetApplies(o) !== 'chat' && presetApplies(o) !== 'alert')
  .slice(0, SIGNATURE);

/** One of a theme's tools: make a copy, rename, delete. */
const ToolButton = ({ onClick, icon: Icon, label, data, danger = false, disabled = false }: { onClick: () => void; icon: any; label: string; data: string; danger?: boolean; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    data-library={data}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border disabled:opacity-40 ${danger ? 'border-rose-500/50 text-rose-300 hover:bg-rose-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600'}`}
  >
    <Icon size={12} /> {label}
  </button>
);

const field = 'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-current-accent';

export const LibraryView = ({ layouts, setLayouts, system, t }: Props) => {
  const [filter, setFilter] = useState<string>('all');
  /*
    Which theme is open, and what is being looked for.

    Everything used to be laid out at once — thirty-eight pieces across several
    themes, which is a wall rather than a shelf, and gets worse with every
    theme added. Arriving now shows the themes; opening one shows its pieces.

    Searching ignores that entirely and looks across every theme at once,
    because the two questions are different: "what looks do I have" is answered
    by browsing, and "where is that panel" is answered by looking for it. A
    drill-down without that would swap one annoyance for a worse one.
  */
  const [openTheme, setOpenTheme] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  /*
    Which layout an apply lands on. Empty until somebody chooses: it follows
    whatever is on stream, scene to scene — the layout an apply most likely
    means, and not simply the first in the list.
  */
  const [target, setTarget] = useState<string>('');
  /*
    An alert preset lands on one alert rather than across a layout, so it
    needs a target of its own. Everything on the channel plays through the
    one alerts layer, which is exactly why a stylesheet cannot live there.
  */
  const alerts = (system?.data?.alertConfigs || []) as any[];
  const [targetAlert, setTargetAlert] = useState<string>('');
  const alertTarget = alerts.find((a) => a.id === targetAlert) || alerts[0] || null;
  const [copied, setCopied] = useState<string>('');
  const [applied, setApplied] = useState<string>('');
  const [replays, setReplays] = useState<Record<string, number>>({});
  /*
    Applying, made safe. A piece that would replace a stylesheet written by
    hand says so and waits to be told; a whole theme always shows what it
    will do first. Whatever is applied can be taken back until the next
    apply, from the bar at the top.
  */
  const [confirming, setConfirming] = useState<string>('');
  const [themePanel, setThemePanel] = useState<boolean>(false);
  const [themeOpts, setThemeOpts] = useState({ motion: true, alerts: false });
  const [undo, setUndo] = useState<UndoRecord | null>(null);
  // The latest of everything, for an undo pressed after other changes have arrived.
  const latest = useRef({ layouts, system });
  latest.current = { layouts, system };
  // Another theme opened, or none: its plan and any question waiting on a piece go with it.
  useEffect(() => { setThemePanel(false); setConfirming(''); }, [openTheme]);

  const preview = useMemo(() => previewSystem(system, t.lang), [system, t.lang]);

  /*
    Every theme, looks and motion together.

    These were two shelves behind a toggle, as though "Motion" were one more
    theme sitting beside Marathon. It never was one: a drawn-in ticker and a
    flickering alert are Marathon's, and a theme is how its parts look *and*
    how they arrive. So they live in the theme they belong to, and are told
    apart inside it — where the distinction still matters, because they go in
    the motion box on a layer rather than the look one.
  */
  /*
    And the streamer's own, after the ones that ship: the same shape, so
    everything below — previews, applying, undo — treats them alike. Their
    stylesheets are known, so a layer wearing one reads as a theme's look
    and not as one somebody typed.
  */
  const mine = ((system?.data as any)?.userThemes || []) as any[];
  userPieces = new Map(mine.flatMap((th: any) => (th.objects || []).map((o: any) => [o.id, o])));
  const known = useMemo(() => userThemeCss(mine), [mine]);
  const themes = useMemo(() => [...CSS_LOOKS, ...mine], [mine]);
  const isMine = (look: any) => Boolean(look) && mine.some((m: any) => m.id === look.id);

  /*
    Making and keeping the streamer's own: a new one, empty or a copy of any
    theme here; renaming; deleting. The server keeps them and tells every
    screen, so this only asks, and says why when it cannot.
  */
  const themeOps = (system?.actions as any)?.userThemes as ((payload: any) => Promise<any>) | undefined;
  const [making, setMaking] = useState<{ name: string; from: string; alerts?: boolean } | null>(null);
  const [renaming, setRenaming] = useState<{ name: string; hint: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [themeError, setThemeError] = useState('');
  const runTheme = async (payload: any) => {
    setThemeError('');
    try {
      return await themeOps?.(payload);
    } catch (err: any) {
      setThemeError(refusalWords(t, err) || String(err?.message || err));
      return null;
    }
  };
  /**
   * A new theme of the streamer's own, opened as soon as it exists: empty, a
   * copy of a theme, or (from "layout:<id>") the looks a layout wears.
   */
  const makeTheme = async (from: string, name = '', withAlerts = false) => {
    const fromLayout = from.startsWith('layout:') ? layouts.find((l: any) => l.id === from.slice(7)) : null;
    const out = fromLayout
      ? await runTheme({ op: 'save', theme: themeFromLayout(fromLayout, {
        omnibars, alerts: withAlerts ? alerts : null, name: name || fromLayout.name,
        nameFor: (kind: string) => kindLabel(kind, t), motionWord: (t.libraryMotion || 'Motion').toLowerCase(),
      }) })
      : await runTheme({ op: 'create', ...(from ? { from } : {}), name });
    if (out?.id) {
      setMaking(null);
      setQuery('');
      setFilter('all');
      setOpenTheme(out.id);
    }
  };
  /*
    Changing pieces: one at a time, as a draft drawn by the preview as it is
    typed, and saved as the whole theme once it is right. A new piece is a
    draft too until it is saved, so starting one and thinking better of it
    leaves the theme as it was.
  */
  const [editing, setEditing] = useState<{ themeId: string; draft: any; isNew: boolean } | null>(null);
  const [adding, setAdding] = useState<{ layerType: string; from: string; kind: 'look' | 'motion' } | null>(null);
  const [pieceBusy, setPieceBusy] = useState(false);
  /*
    The whole theme at once: its shared colours and sizes and its fonts, as a
    draft every piece on the shelf is drawn from while it is open, kept only
    when saved.
  */
  const [styling, setStyling] = useState<{ themeId: string; draft: any } | null>(null);

  /*
    Sharing a theme: a file with the theme in it and the uploaded fonts it is
    drawn in, so it looks the same on somebody else's app; and reading one
    back, its fonts uploaded first unless this app already has them.
  */
  const [shared, setShared] = useState<{ ok: boolean; words: string } | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const uploadedFonts = async () => {
    const res = await fetch(`${httpBase()}/api/assets`);
    const list = res.ok ? await res.json() : [];
    return (Array.isArray(list) ? list : []).filter((a: any) => a?.kind === 'font');
  };
  const toBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(out);
  };
  const exportTheme = async (theme: any) => {
    setShared(null);
    try {
      const used = new Set(themeFonts(theme).map((f: any) => f.family));
      const fonts: { file: string; data: string }[] = [];
      for (const asset of await uploadedFonts()) {
        if (!used.has(fontFamilyName(asset.name))) continue;
        const res = await fetch(`${httpBase()}${asset.url}`);
        if (res.ok) fonts.push({ file: asset.name, data: toBase64(await res.arrayBuffer()) });
      }
      const file = themeFile({ ...theme, name: themeWords(theme, t.lang).name, hint: themeWords(theme, t.lang).hint }, fonts);
      const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(file.theme.name || 'theme').replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'theme'}.simonsays-theme.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setShared({ ok: true, words: fill(t.libraryExported || 'Saved as a file, with {count} of your fonts in it.', { count: String(fonts.length) }) });
    } catch (err: any) {
      setShared({ ok: false, words: String(err?.message || err) });
    }
  };
  const importTheme = async (picked: File) => {
    setShared(null);
    try {
      const { theme, fonts } = readThemeFile(await picked.text());
      const have = new Set((await uploadedFonts()).map((a: any) => a.name));
      let added = 0;
      for (const f of fonts) {
        if (have.has(f.file)) continue;
        const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
        const res = await fetch(`${httpBase()}/api/assets/${encodeURIComponent(f.file)}`, { method: 'POST', body: bytes });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `${f.file}: ${res.status}`);
        added += 1;
      }
      if (added) forgetCustomFonts();
      // A name already taken gets a number, as copies do.
      const names = new Set(mine.map((th: any) => th.name));
      let name = theme.name;
      for (let n = 2; names.has(name); n += 1) name = `${theme.name} ${n}`;
      const out = await runTheme({ op: 'save', theme: { ...theme, name } });
      if (!out?.id) return;
      setShared({ ok: true, words: added
        ? fill(t.libraryImportedFonts || 'Added {theme}, and {count} fonts it uses. Reload this page and any open overlay to draw them.', { theme: name, count: String(added) })
        : fill(t.libraryImported || 'Added {theme}.', { theme: name }) });
      setMaking(null);
      setQuery('');
      setFilter('all');
      setOpenTheme(out.id);
    } catch (err: any) {
      setShared({ ok: false, words: fill(t.libraryImportFailed || 'That file could not be added: {why}', { why: String(err?.message || err) }) });
    }
  };
  useEffect(() => { setRenaming(null); setDeleting(false); setThemeError(''); setEditing(null); setAdding(null); setStyling(null); }, [openTheme]);
  const styledFrom = styling ? mine.find((th: any) => th.id === styling.themeId) : null;
  const styleDirty = Boolean(styling && styledFrom && JSON.stringify(styling.draft.objects) !== JSON.stringify(styledFrom.objects));
  const saveStyle = async () => {
    if (!styling) return;
    setPieceBusy(true);
    const out = await runTheme({ op: 'save', theme: styling.draft });
    setPieceBusy(false);
    if (out?.theme) setStyling({ themeId: out.theme.id, draft: out.theme });
  };

  /** The theme of the streamer's own a piece is in, if it is in one. */
  const ownerOf = (pieceId: string) => mine.find((th: any) => (th.objects || []).some((o: any) => o.id === pieceId)) || null;
  const saveObjects = async (theme: any, objects: any[]) => {
    setPieceBusy(true);
    const out = await runTheme({ op: 'save', theme: { ...theme, objects } });
    setPieceBusy(false);
    return out;
  };
  const savePiece = async () => {
    if (!editing) return;
    const theme = mine.find((th: any) => th.id === editing.themeId);
    if (!theme) return;
    const objects = editing.isNew
      ? [...theme.objects, editing.draft]
      : theme.objects.map((o: any) => (o.id === editing.draft.id ? editing.draft : o));
    if (await saveObjects(theme, objects)) setEditing(null);
  };
  const deletePiece = async (theme: any, pieceId: string) => {
    if (await saveObjects(theme, theme.objects.filter((o: any) => o.id !== pieceId))) setEditing(null);
  };
  /*
    A whole theme gives each kind of layer the first look it has for it (a
    tall bar its first tall-bar look): this puts one first among those.
  */
  const sameSlot = (a: any, b: any) => a.layerType === b.layerType && presetKind(a) !== 'motion' && presetKind(b) !== 'motion'
    && (a.layerType !== 'omnibar' || Boolean(a.previewTall) === Boolean(b.previewTall));
  const isMain = (theme: any, piece: any) => presetKind(piece) === 'motion' || (theme.objects || []).find((o: any) => sameSlot(o, piece))?.id === piece.id;
  const makeMain = async (theme: any, piece: any) => {
    const rest = theme.objects.filter((o: any) => o.id !== piece.id);
    const at = rest.findIndex((o: any) => sameSlot(o, piece));
    const objects = at < 0 ? [...rest, piece] : [...rest.slice(0, at), piece, ...rest.slice(at)];
    await saveObjects(theme, objects);
  };
  /** Every piece there is for one kind of layer, in any theme, to start a new one from. */
  const piecesOfKind = (kind: string) => themes.flatMap((th: any) => (th.objects || [])
    .filter((o: any) => o.layerType === kind)
    .map((o: any) => ({ id: o.id, label: `${themeWords(th, t.lang).name} · ${lookWords(o, t.lang).name}${presetKind(o) === 'motion' ? ` (${(t.libraryMotion || 'Motion').toLowerCase()})` : ''}`, piece: o })));
  const startPiece = () => {
    if (!adding || !open) return;
    const src = adding.from ? piecesOfKind(adding.layerType).find((p: any) => p.id === adding.from)?.piece : null;
    let draft: any;
    if (src) {
      const { lookId, lookName, previewWith, ...rest } = src;
      draft = { ...structuredClone(rest), id: newPieceId() };
    } else {
      draft = {
        id: newPieceId(), layerType: adding.layerType, name: kindLabel(adding.layerType, t), hint: '',
        css: adding.kind === 'motion' ? ':scope {\n  animation: simonsaysPieceIn 0.6s ease-out both;\n}\n\n@keyframes simonsaysPieceIn {\n  from { opacity: 0; transform: translateY(12px); }\n  to { opacity: 1; transform: none; }\n}\n' : ':scope {\n  --ink: #ffffff; /* Text */\n  --ground: #09090b; /* Background */\n}\n',
        ...(adding.kind === 'motion' ? { kind: 'motion' } : {}),
        ...(adding.layerType === 'alert' ? { applies: 'alert' } : adding.layerType === 'chat' ? { applies: 'chat' } : {}),
      };
    }
    setEditing({ themeId: open.id, draft, isNew: true });
    setAdding(null);
  };

  /*
    Looking for something, by name or by kind, is what puts every theme on
    screen at once.
  */
  const q = query.trim().toLowerCase();
  const searching = q !== '' || filter !== 'all';

  /*
    What it is called, not what it is described as.

    Hints are prose written to explain a piece, and several of them mention a
    panel in passing — "lay it on a panel" — so searching descriptions for
    "panel" buried the four things actually named one under seven that were
    not. Names and the kind of layer, then, with the descriptions kept as a
    fallback so a word nothing is named after is still not a dead end.
  */
  const named = (o: any) => `${o.name} ${lookWords(o, 'es').name} ${kindLabel(o.layerType, t)} ${LABELS[o.layerType] || o.layerType}`.toLowerCase().includes(q);
  const described = (o: any) => `${o.hint || ''} ${lookWords(o, 'es').hint}`.toLowerCase().includes(q);
  const ofKind = (o: any) => filter === 'all' || o.layerType === filter;
  const count = (test: any) => themes.reduce(
    (n: number, l: any) => n + l.objects.filter((o: any) => ofKind(o) && test(o)).length, 0,
  );
  const byName = q ? count(named) : 0;
  /* Widened only when nothing answers to the name, and said so when it is. */
  const widened = Boolean(q) && byName === 0 && count(described) > 0;
  const matches = (o: any) => ofKind(o) && (!q || (widened ? described(o) : named(o)));

  const open = themes.find((look: any) => look.id === openTheme) || null;
  const visible = searching ? themes : (open ? [open] : []);
  const found = searching ? count((o: any) => !q || (widened ? described(o) : named(o))) : 0;
  const kindsHere = PRESET_LAYER_TYPES.filter(
    (kind) => themes.some((look: any) => look.objects.some((o: any) => o.layerType === kind)));
  const alertsHere = themes.some((look: any) => look.objects.some((o: any) => presetApplies(o) === 'alert'));
  const live = liveLayout(layouts, system?.connections?.obsData?.currentScene || '', (system?.data as any)?.omnilayer);
  const layout = layouts.find((l) => l.id === target) || live || layouts[0];
  // A layout with no accent previews with none, so each look shows its own default.
  const accent = (layout as any)?.accent || '';

  const copy = (object: any) => {
    copyText(object.css);
    setCopied(object.id);
    setTimeout(() => setCopied(''), 1500);
  };

  /**
   * Write one preset onto every layer of its kind in the chosen overlay.
   *
   * Never offered for shapes: a layout holds many, each a different piece of
   * the build, and one stylesheet across all of them would destroy the rest.
   */
  const omnibars = (system?.data?.omnibars || []) as any[];

  /** Writes a set of layer changes onto one layout: `to` to apply, `from` to take them back. */
  const writeLayers = (layoutId: string, changes: Change[], direction: 'to' | 'from') => {
    setLayouts(latest.current.layouts.map((l: any) => (l.id !== layoutId ? l : withChanges(l, changes, direction))));
  };

  /**
   * Takes back the last apply: each field only where it still holds what was
   * applied, so anything changed since stays as it was changed.
   */
  const runUndo = () => {
    if (!undo) return;
    if (undo.layoutId && undo.changes?.length) writeLayers(undo.layoutId, undo.changes, 'from');
    for (const a of undo.alerts || []) {
      const current = ((latest.current.system?.data?.alertConfigs || []) as any[]).find((x) => x.id === a.id);
      if (!current) continue;
      const back: Record<string, any> = {};
      for (const [key, value] of Object.entries(a.applied)) if ((current[key] || '') === (value || '')) back[key] = a.before[key];
      if (Object.keys(back).length) latest.current.system.actions.saveAlertConfig({ ...current, ...back });
    }
    setUndo(null);
  };

  const flashApplied = (id: string) => {
    setApplied(id);
    setTimeout(() => setApplied(''), 1800);
  };

  /**
   * Whether applying a piece would replace a stylesheet somebody wrote: on
   * one of its layers — a chat layer's included — or on the alert it is going to.
   */
  const ownFor = (object: any): number => {
    const field = presetField(object);
    if (presetApplies(object) === 'alert') return alertTarget && isOwnCss(alertTarget[field], known) ? 1 : 0;
    return layout ? replacesOwn(piecePlan(object, layout, omnibars), known) : 0;
  };

  /**
   * Write one preset where it goes, and keep what it replaced.
   *
   * Never offered for shapes: a layout holds many, each a different piece of
   * the build, and one stylesheet across all of them would destroy the rest.
   */
  const commit = (object: any) => {
    const field = presetField(object);
    setConfirming('');
    /*
      A chat piece goes on the layout's chat layer like any other piece goes
      on its layers; only the custom theme reads a chat stylesheet, so the plan
      turns that layer's theme to Custom beside it (see shared/theme-apply.js).
    */
    /*
      An alert is saved one at a time, through the same action the alert
      editor uses, so the server validates it the same way and every other
      surface hears about it at once.
    */
    if (presetApplies(object) === 'alert') {
      if (!alertTarget) return;
      system.actions.saveAlertConfig({ ...alertTarget, [field]: object.css });
      setUndo({ label: `${lookWords(object, t.lang).name} → ${alertTarget.name}`, alerts: [{ id: alertTarget.id, applied: { [field]: object.css }, before: { [field]: alertTarget[field] || '' } }] });
      flashApplied(object.id);
      return;
    }
    if (!layout || !canApplyInBulk(object.layerType)) return;
    // Into the box this preset belongs in, so applying a look cannot take a layer's motion with it, or the other way round.
    const changes = piecePlan(object, layout, omnibars) as Change[];
    if (!changes.length) { flashApplied(object.id); return; }
    writeLayers(layout.id, changes, 'to');
    setUndo({ label: `${lookWords(object, t.lang).name} → ${layout.name}`, layoutId: layout.id, changes });
    flashApplied(object.id);
  };

  /*
    The whole-theme panel: a button, and once pressed, what it will do —
    which look goes on how many layers of each kind, the motions with them,
    what it leaves alone and why, and the alerts to add on —
    before it does any of it. A function rather than a component, as the
    piece cards are, so nothing inside is rebuilt on every render.
  */
  const themePlanView = () => {
    if (!open || !layout || !plan) return null;
    const label = (kind: string) => kindLabel(kind, t);
    const byKind = new Map<string, { looks: Map<string, number>; motions: Map<string, number> }>();
    for (const c of plan.layers.changes as Change[]) {
      // A chat turned to Custom so its look takes is part of that look, not a change of its own to list.
      if (c.field === 'chatTheme') continue;
      const entry = byKind.get(c.kind) || { looks: new Map(), motions: new Map() };
      const map = c.field === 'css' ? entry.looks : entry.motions;
      const name = c.piece || (t.libraryMotionOff || 'motion taken off');
      map.set(name, (map.get(name) || 0) + 1);
      byKind.set(c.kind, entry);
    }
    const own = replacesOwn(plan.layers.changes, known)
      + (themeOpts.alerts && plan.alerts ? plan.alerts.own : 0);
    const nothing = !plan.layers.changes.length
      && !(themeOpts.alerts && plan.alerts?.changes.length);
    const why = (l: { kind: string; why: string; count: number }) => (l.why === 'shape'
      ? String(t.libraryLeftShapes || '{count} shapes — every shape is a different piece of the build').split('{count}').join(String(l.count))
      : l.why === 'shared'
        ? String(t.libraryLeftShared || '{kind} — shared by every layout, below').split('{kind}').join(label(l.kind))
        : String(t.libraryLeftNothing || '{count} {kind} — nothing in this theme for it').split('{count}').join(String(l.count)).split('{kind}').join(label(l.kind).toLowerCase()));

    if (!themePanel) {
      return (
        <button
          onClick={() => setThemePanel(true)} data-library="theme-apply"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-current-accent/10 border-current-accent text-current-accent hover:bg-current-accent/20"
        >
          {applied === `theme:${open.id}` ? <Check size={12} /> : <Wand2 size={12} />}
          {applied === `theme:${open.id}`
            ? (t.libraryApplied || 'Applied')
            : String(t.libraryApplyTheme || 'Apply this theme to {layout}').split('{layout}').join(layout.name)}
        </button>
      );
    }

    return (
      <div className="glass-panel rounded-2xl border border-current-accent/60 p-4 space-y-3 max-w-3xl" data-library="theme-plan">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-200 flex-1">
            {String(t.libraryThemePlanTitle || '{theme} on {layout}').split('{theme}').join(themeWords(open, t.lang).name).split('{layout}').join(layout.name)}
          </span>
          <button onClick={() => setThemePanel(false)} className="p-1 text-zinc-500 hover:text-white"><X size={14} /></button>
        </div>

        {byKind.size > 0 ? (
          <ul className="space-y-1" data-library="theme-plan-changes">
            {[...byKind.entries()].map(([kind, { looks, motions }]) => (
              <li key={kind} className="text-[10px] text-zinc-300 leading-relaxed">
                <span className="font-black uppercase tracking-widest text-[9px] text-zinc-500 mr-2">{label(kind)}</span>
                {[...looks.entries()].map(([name, n]) => `${name}${n > 1 ? ` ×${n}` : ''}`).join(', ')}
                {motions.size > 0 && (
                  <span className="text-zinc-500">
                    {looks.size ? ' · ' : ''}{t.libraryMotionShort || 'motion'}: {[...motions.entries()].map(([name, n]) => `${name}${n > 1 ? ` ×${n}` : ''}`).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] text-zinc-500">{t.libraryThemeNothingOnLayers || 'Every layer here that this theme dresses is wearing it already.'}</p>
        )}

        {plan.layers.left.length > 0 && (
          <div className="space-y-0.5" data-library="theme-plan-left">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.libraryLeftTitle || 'Left as they are'}</span>
            {plan.layers.left.map((l: any) => <p key={`${l.kind}-${l.why}`} className="text-[10px] text-zinc-500">{why(l)}</p>)}
          </div>
        )}

        <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={themeOpts.motion} onChange={(e) => setThemeOpts((o) => ({ ...o, motion: e.target.checked }))} className="accent-current-accent" data-library="theme-opt-motion" />
            <span className="text-[10px] text-zinc-300">{t.libraryOptMotion || 'How they arrive, too — each look\'s motion, where the theme has one'}</span>
          </label>
          {plan.alerts && alerts.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={themeOpts.alerts} onChange={(e) => setThemeOpts((o) => ({ ...o, alerts: e.target.checked }))} className="accent-current-accent" data-library="theme-opt-alerts" />
              <span className="text-[10px] text-zinc-300">
                {String(t.libraryOptAlerts || 'Every alert as well: {look} on all {count} — they play on every layout').split('{look}').join(plan.alerts.look).split('{count}').join(String(alerts.length))}
              </span>
            </label>
          )}
        </div>

        {own > 0 && (
          <p className="text-[10px] text-amber-200" data-library="theme-plan-own">
            {String(t.libraryThemeReplacesOwn || 'This replaces a stylesheet you wrote on {count} of them — you can undo it afterwards.').split('{count}').join(String(own))}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={applyTheme} disabled={nothing} data-library="theme-plan-apply"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-current-accent/10 border-current-accent text-current-accent hover:bg-current-accent/20 disabled:opacity-40 disabled:border-zinc-800 disabled:text-zinc-600 disabled:bg-transparent"
          >
            <Wand2 size={12} /> {t.libraryApplyThemeNow || 'Apply the theme'}
          </button>
          <button onClick={() => setThemePanel(false)} className="px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white">
            {t.cancel || 'Cancel'}
          </button>
        </div>
      </div>
    );
  };

  /** Apply, or first ask, when it would replace something written by hand. */
  const apply = (object: any) => {
    if (ownFor(object)) { setConfirming(object.id); return; }
    commit(object);
  };

  /**
   * Why a piece has nowhere to go: no alert yet; no layout at all; no layer
   * of its kind in the one chosen; or — for a bar look — bars there, but all
   * of the other shape, tall where it was drawn for a plain bar or the other
   * way round.
   */
  const whyNot = (object: any): string => {
    if (presetApplies(object) === 'alert') return t.libraryNoAlert || 'There is no alert to apply this to';
    if (!layout) return t.libraryNoLayout || 'Make a layout first, on the Overlays screen';
    const kind = kindLabel(object.layerType, t).toLowerCase();
    const ofKind = (layout.layers || []).filter((l: any) => l.type === object.layerType).length;
    if (ofKind && object.layerType === 'omnibar' && presetKind(object) === 'look') {
      return object.previewTall
        ? String(t.libraryNoTallBar || 'No omnibar in {layout} shows a tall bar').split('{layout}').join(layout.name)
        : String(t.libraryOnlyTallBars || 'Every omnibar in {layout} shows a tall bar').split('{layout}').join(layout.name);
    }
    return String(t.libraryNoLayerIn || 'No {kind} layer in {layout}').split('{kind}').join(kind).split('{layout}').join(layout.name);
  };

  /** How many things an apply would rewrite, so the button can say so. */
  const countFor = (object: any) => (presetApplies(object) === 'alert'
    ? (alertTarget ? 1 : 0)
    : pieceTargets(object, layout, omnibars).length);

  /*
    A whole theme at once, on the chosen layout: each layer its look, and
    with it the motion that goes with that look. Shapes are left alone —
    each is a different piece of the build — and the alerts, which
    every layout shares, only when asked for.
  */
  const plan = useMemo(() => {
    if (!open || !layout) return null;
    const layers = themePlan(open, layout, { omnibars, motion: themeOpts.motion, known });
    const alertsPlan = alertPlan(open, alerts, { motion: themeOpts.motion, known });
    return { layers, alerts: alertsPlan };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layout, omnibars, themeOpts.motion, alerts, known]);

  const applyTheme = () => {
    if (!open || !layout || !plan) return;
    const record: UndoRecord = { label: `${themeWords(open, t.lang).name} → ${layout.name}` };
    const changes = plan.layers.changes as Change[];
    if (changes.length) {
      writeLayers(layout.id, changes, 'to');
      record.layoutId = layout.id;
      record.changes = changes;
    }
    if (themeOpts.alerts && plan.alerts) {
      record.alerts = [];
      for (const change of plan.alerts.changes) {
        const current = alerts.find((a) => a.id === change.id);
        if (!current) continue;
        system.actions.saveAlertConfig({ ...current, ...change.next });
        record.alerts.push({ id: change.id, applied: change.next, before: change.before });
      }
    }
    setUndo(record);
    setThemePanel(false);
    flashApplied(`theme:${open.id}`);
  };

  /*
    One piece's card.

    A function called from two places rather than a component mounted in two
    places: a component declared in here is a new type on every render, so
    React would throw away every preview and build it again each time anything
    on this screen changed — including, on a motion card, the replay it was
    part-way through.
  */
  const piece = (object: any) => {
    const bulk = presetApplies(object) === 'alert' || canApplyInBulk(object.layerType);
    const count = countFor(object);
    const owner = ownerOf(object.id);
    const editingThis = Boolean(owner && editing && !editing.isNew && editing.draft.id === object.id);
    const shown = editingThis ? editing!.draft : object;

    return (
      <div key={object.id} className="glass-panel rounded-2xl border border-zinc-800 p-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200">
            {lookWords(object, t.lang).name}
          </span>
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {kindLabel(object.layerType, t)}
          </span>
        </div>

        <Preview object={shown} system={preview} accent={accent} replay={replays[object.id] || 0} t={t} />

        <div className="flex items-center gap-2">
          {presetKind(object) === 'motion' && (
            <button
              onClick={() => setReplays((r) => ({ ...r, [object.id]: (r[object.id] || 0) + 1 }))}
              title={t.libraryReplayHint || 'Play it again'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            >
              <RotateCcw size={11} /> {t.libraryReplay || 'Replay'}
            </button>
          )}

          <button
            onClick={() => copy(object)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
          >
            {copied === object.id ? <Check size={11} /> : <Copy size={11} />}
            {copied === object.id ? (t.copied || 'Copied') : (t.copy || 'Copy')}
          </button>

          {owner && !editingThis && !styling && (
            <button
              onClick={() => { setAdding(null); setEditing({ themeId: owner.id, draft: structuredClone(object), isNew: false }); }}
              data-library="piece-edit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            >
              <Pencil size={11} /> {t.libraryEditPiece || 'Edit'}
            </button>
          )}

          {bulk ? (
            <button
              onClick={() => apply(object)}
              disabled={!count}
              title={count
                ? (presetApplies(object) === 'alert'
                  ? `${t.libraryWillChange || 'Changes'} ${alertTarget?.name || ''}`
                  : `${t.libraryWillChange || 'Changes'} ${count} ${kindLabel(object.layerType, t).toLowerCase()}`)
                : whyNot(object)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-current-accent/10 border-current-accent text-current-accent disabled:opacity-40 disabled:border-zinc-800 disabled:text-zinc-600 disabled:bg-transparent"
            >
              {applied === object.id ? <Check size={11} /> : <Wand2 size={11} />}
              {applied === object.id
                ? (t.libraryApplied || 'Applied')
                : `${t.libraryApply || 'Apply'}${count > 1 ? ` (${count})` : ''}`}
            </button>
          ) : (
            /*
              Shapes are copy-only. A layout holds many and each is a
              different piece of the build, so one stylesheet across all of
              them would wipe out the others.
            */
            <span className="text-[9px] text-zinc-600">
              {t.libraryShapeCopyOnly || 'Copy only — every shape is different'}
            </span>
          )}
          {/* Greyed out, and why — in plain sight, not only in a tooltip nobody hovers. */}
          {bulk && !count && (
            <span className="text-[9px] text-zinc-500 leading-snug" data-library="apply-why">{whyNot(object)}</span>
          )}
        </div>

        {/* It would replace something written by hand: said, and left to be decided. */}
        {confirming === object.id && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-2" data-library="confirm">
            <p className="text-[10px] text-amber-200 leading-relaxed">
              {presetApplies(object) === 'alert'
                  ? String(t.libraryReplacesAlert || '{name} has a stylesheet you wrote. Applying replaces it — you can undo it afterwards.').split('{name}').join(alertTarget?.name || '')
                  : String(t.libraryReplacesLayers || 'This replaces a stylesheet you wrote on {count} of these layers — you can undo it afterwards.').split('{count}').join(String(ownFor(object)))}
            </p>
            <div className="flex gap-2">
              <button onClick={() => commit(object)} data-library="confirm-apply" className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-amber-500/10 border-amber-500/60 text-amber-200 hover:bg-amber-500/20">
                {t.libraryReplace || 'Replace it'}
              </button>
              <button onClick={() => setConfirming('')} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white">
                {t.cancel || 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {editingThis ? (
          <ThemePieceEditor
            draft={editing!.draft}
            onChange={(draft) => setEditing({ ...editing!, draft })}
            theme={owner}
            kindName={(kind) => kindLabel(kind, t)}
            onSave={savePiece}
            onCancel={() => setEditing(null)}
            onDelete={() => deletePiece(owner, object.id)}
            onMakeMain={isMain(owner, object) ? undefined : () => makeMain(owner, object)}
            busy={pieceBusy}
            error={themeError}
            t={t}
          />
        ) : (
          <>
            <p className="text-[9px] text-zinc-600 leading-relaxed">{lookWords(object, t.lang).hint}</p>

            {/* Readable here; a piece of the streamer's own theme is changed with Edit, a shipped one by copying its theme. */}
            <pre className="text-[9px] font-mono text-zinc-500 bg-zinc-950/60 border border-zinc-800 rounded-lg p-2.5 overflow-x-auto max-h-44 leading-relaxed whitespace-pre">
              {object.css}
            </pre>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      {/* What was just applied, and the way back — held at the top while the screen scrolls. */}
      {undo && (
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-current-accent/50 bg-zinc-950/95 backdrop-blur" data-library="undo-bar">
          <Check size={13} className="text-current-accent shrink-0" />
          <span className="flex-1 min-w-0 truncate text-[10px] font-bold text-zinc-300">
            {t.libraryAppliedWhat || 'Applied'}: {undo.label}
          </span>
          <button onClick={runUndo} data-library="undo" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500">
            <Undo2 size={11} /> {t.libraryUndo || 'Undo'}
          </button>
          <button onClick={() => setUndo(null)} title={t.libraryUndoDismiss || 'Keep it'} className="p-1 text-zinc-500 hover:text-white"><X size={13} /></button>
        </div>
      )}

      <div className="glass-panel rounded-3xl border border-zinc-800 p-5 space-y-4">
        <p className="text-[11px] text-zinc-500 leading-relaxed max-w-2xl">
          {t.libraryIntro
            || 'Every stylesheet the app ships, drawn by the same components your stream uses. A theme is how its parts look and how they arrive — open one for its pieces, or look for something across all of them.'}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.librarySearch || 'Look for a piece…'}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-[10px] text-zinc-300 outline-none focus:border-current-accent w-56"
            data-library="search"
          />
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {t.libraryShow || 'Show'}
          </span>
          {['all', ...kindsHere].map((kind) => (
            <button
              key={kind}
              onClick={() => setFilter(kind)}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                filter === kind
                  ? 'bg-current-accent/10 border-current-accent text-current-accent'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {kind === 'all' ? (t.libraryAll || 'Everything') : kindLabel(kind, t)}
            </button>
          ))}
        </div>

        {/*
          Where an apply lands, said out loud — the layout on stream unless
          somebody chose another, because a button that changes an overlay you
          cannot see named is a button nobody should press. Each list is named
          by its own label, which also gives it focus when pressed.
        */}
        {layouts.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2">
              <Layers size={13} className="text-zinc-600" />
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
                {t.libraryApplyTo || 'Apply to'}
              </span>
              <select
                value={layout?.id || ''}
                onChange={(e) => setTarget(e.target.value)}
                className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
                data-library="apply-to"
              >
                {/* The one on stream now says so, so it can be found in a long list and told from the rest. */}
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{live && l.id === live.id ? ` · ${t.libraryLiveNow || 'on stream now'}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {/*
              And which alert, when there is something here for one. Hidden
              otherwise rather than greyed out: a control for a thing not on
              screen is a question nobody asked. Labelled, since beside the
              layouts an unnamed list of alert names reads as more layouts.
            */}
            {alertsHere && alerts.length > 0 && (
              <label className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
                  {t.libraryAlertTo || 'Alert pieces go on'}
                </span>
                <select
                  value={alertTarget?.id || ''}
                  onChange={(e) => setTargetAlert(e.target.value)}
                  className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 outline-none focus:border-current-accent"
                  data-library="alert-to"
                >
                  {alerts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      {/*
        The themes, when nothing is open and nothing is being looked for. What
        it is called, what a few of its pieces look like, and what it covers —
        which is the whole of what this screen is being asked at this point.
      */}
      {!searching && !open && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-library="themes">
          {themes.map((look: any) => (
            <button
              key={look.id}
              onClick={() => setOpenTheme(look.id)}
              data-library="theme" data-library-theme={look.id}
              className="glass-panel rounded-2xl border border-zinc-800 hover:border-current-accent p-5 text-left transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] font-black uppercase tracking-widest text-zinc-200">{themeWords(look, t.lang).name}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 shrink-0 flex items-center gap-2">
                  {isMine(look) && <span className="px-1.5 py-0.5 rounded bg-current-accent/10 border border-current-accent/40 text-current-accent" data-library="mine">{t.libraryMine || 'Mine'}</span>}
                  {look.objects.length} {t.libraryPieces || 'pieces'}
                </span>
              </div>

              {/*
                A few of its pieces, drawn the way the cards inside it draw
                them — same components, same stylesheets, so a theme cannot
                come to look like something it is not. Nothing here takes a
                click: the whole card is the way in, and a preview that
                swallowed the press would read as a theme refusing to open.
              */}
              <div className="mt-3 space-y-2 pointer-events-none" data-library="theme-preview">
                {signature(look).map((object: any) => (
                  <Preview
                    key={object.id}
                    object={object}
                    system={preview}
                    accent={accent}
                    replay={0}
                    height={64}
                    t={t}
                  />
                ))}
              </div>

              <p className="text-[10px] text-zinc-500 leading-relaxed mt-3">{themeWords(look, t.lang).hint}</p>
              {/* What it covers, so two themes can be told apart before opening one. */}
              <div className="flex flex-wrap gap-1 mt-3">
                {[...new Set(look.objects.map((o: any) => o.layerType))].map((kind: any) => (
                  <span key={kind} className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[8px] font-black uppercase tracking-widest text-zinc-600">
                    {kindLabel(kind, t)}
                  </span>
                ))}
              </div>
            </button>
          ))}

          {/* A theme of the streamer's own: empty, or a copy of any theme here to change. */}
          <div className="glass-panel rounded-2xl border border-dashed border-zinc-700 p-5" data-library="new-theme">
            {!making ? (
              <button
                onClick={() => setMaking({ name: '', from: '' })}
                data-library="new-theme-open"
                className="w-full min-h-[140px] flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-white"
              >
                <Plus size={20} />
                <span className="text-[11px] font-black uppercase tracking-widest">{t.libraryNewTheme || 'New theme'}</span>
                <span className="text-[10px] text-zinc-600">{t.libraryNewThemeHint || 'Your own: empty, or a copy of one of these to change.'}</span>
              </button>
            ) : null}
            {!making && (
              <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-zinc-800/60">
                <input
                  ref={importInput}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    e.target.value = '';
                    if (picked) importTheme(picked);
                  }}
                  data-library="theme-import-file"
                />
                <button onClick={() => importInput.current?.click()} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white" data-library="theme-import">
                  <Upload size={11} /> {t.libraryImport || 'Add a theme from a file'}
                </button>
                {shared && <span className={`text-[10px] text-center ${shared.ok ? 'text-emerald-400' : 'text-rose-400'}`} data-library="theme-import-said">{shared.words}</span>}
              </div>
            )}
            {!making ? null : (
              <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{t.libraryNewTheme || 'New theme'}</span>
                <label className="block space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.libraryThemeName || 'Name'}</span>
                  <input value={making.name} onChange={(e) => setMaking({ ...making, name: e.target.value })} maxLength={60} placeholder={t.libraryThemeNamePlaceholder || 'My theme'} className={field} data-library="new-theme-name" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.libraryStartFrom || 'Start from'}</span>
                  <select value={making.from} onChange={(e) => setMaking({ ...making, from: e.target.value })} className={field} data-library="new-theme-from">
                    <option value="">{t.libraryStartEmpty || 'Nothing: an empty theme'}</option>
                    <optgroup label={t.libraryStartThemes || 'A copy of a theme'}>
                      {themes.map((th: any) => <option key={th.id} value={th.id}>{fill(t.libraryStartCopy || 'A copy of {theme}', { theme: themeWords(th, t.lang).name })}</option>)}
                    </optgroup>
                    <optgroup label={t.libraryStartLayouts || 'The looks a layout wears'}>
                      {layouts.map((l: any) => <option key={l.id} value={`layout:${l.id}`}>{fill(t.libraryStartLayout || 'The looks on {layout}', { layout: l.name })}</option>)}
                    </optgroup>
                  </select>
                </label>
                {making.from.startsWith('layout:') && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={making.alerts === true} onChange={(e) => setMaking({ ...making, alerts: e.target.checked })} className="accent-current-accent" data-library="new-theme-alerts" />
                    <span className="text-[10px] text-zinc-400">{t.libraryWithAlerts || 'And the alerts\' looks, which every layout shares'}</span>
                  </label>
                )}
                <div className="flex items-center gap-2">
                  <ToolButton onClick={() => makeTheme(making.from, making.name.trim(), making.alerts === true)} icon={Check} label={t.libraryMake || 'Make it'} data="new-theme-make" />
                  <ToolButton onClick={() => { setMaking(null); setThemeError(''); }} icon={X} label={t.cancel || 'Cancel'} data="new-theme-cancel" />
                </div>
                {themeError && <p className="text-[10px] text-rose-400">{themeError}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* The way back, and what searching turned up. */}
      {(open || searching) && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setOpenTheme(null); setQuery(''); setFilter('all'); }}
            data-library="back"
            className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
          >
            {t.libraryBack || 'All themes'}
          </button>
          {searching && (
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
              {found} {widened
                ? (t.libraryFoundInDescriptions || 'found, by description, across every theme')
                : (t.libraryFound || 'found across every theme')}
            </span>
          )}
        </div>
      )}

      {/*
        A search that finds nothing says so. Without this the screen simply
        emptied, which reads as something having gone wrong rather than as an
        answer to what was asked.
      */}
      {searching && found === 0 && (
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest" data-library="nothing">
          {t.libraryNothing || "Nothing here answers to that."}
        </p>
      )}

      {visible.map((look: any) => {
        // While the whole theme is being changed, its pieces are drawn as they would be.
        const objects = (styling && styling.themeId === look.id ? styling.draft : look).objects.filter(matches);
        const opened = !searching && Boolean(open) && look.id === open.id;
        if (!objects.length && !opened) return null;

        /*
          Looks and motion, told apart inside the theme they share. They are
          still two different things — one goes in the look box on a layer and
          the other in the motion box — so they are not simply mixed into one
          grid. Labelled only when there is motion to label: a lone "Looks"
          heading over a theme that has none answers a question nobody asked.
        */
        const motion = objects.filter((o: any) => presetKind(o) === 'motion');
        const still = objects.filter((o: any) => presetKind(o) !== 'motion');
        const split = motion.length > 0 && still.length > 0;

        return (
          <div key={look.id} className="space-y-3" data-library-shelf={look.id}>
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                {themeWords(look, t.lang).name}
                {isMine(look) && <span className="px-1.5 py-0.5 rounded bg-current-accent/10 border border-current-accent/40 text-current-accent text-[8px]">{t.libraryMine || 'Mine'}</span>}
              </h3>
              <p className="text-[10px] text-zinc-600 leading-relaxed max-w-2xl">{themeWords(look, t.lang).hint}</p>
            </div>

            {/*
              What can be done with the theme itself. A shipped one is never
              changed: it can be copied, and the copy is the streamer's to
              change. One of their own can be renamed, copied or deleted.
            */}
            {opened && (
              <div className="flex flex-wrap items-center gap-2" data-library="theme-tools">
                {isMine(look) ? (
                  <>
                    <ToolButton onClick={() => { setEditing(null); setAdding(null); setStyling({ themeId: look.id, draft: structuredClone(look) }); }} icon={Palette} label={t.libraryStyleTitle || 'Colours, sizes and fonts'} data="theme-style" disabled={Boolean(styling)} />
                    <ToolButton onClick={() => { setEditing(null); setStyling(null); setAdding({ layerType: THEME_PIECE_TYPES[0], from: '', kind: 'look' }); }} icon={Plus} label={t.libraryAddPiece || 'Add a piece'} data="theme-add-piece" disabled={styleDirty} />
                    <ToolButton onClick={() => setRenaming({ name: look.name, hint: look.hint || '' })} icon={Pencil} label={t.libraryRename || 'Rename'} data="theme-rename" />
                    <ToolButton onClick={() => makeTheme(look.id)} icon={CopyPlus} label={t.libraryCopyTheme || 'Make a copy'} data="theme-copy" />
                    {!deleting ? (
                      <ToolButton onClick={() => setDeleting(true)} icon={Trash2} label={t.libraryDeleteTheme || 'Delete'} data="theme-delete" danger />
                    ) : (
                      <span className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 px-2.5 py-1.5" data-library="theme-delete-confirm">
                        <span className="text-[10px] text-rose-200">{t.libraryDeleteSure || 'Delete this theme? Layers already wearing its looks keep them.'}</span>
                        <ToolButton onClick={async () => { if (await runTheme({ op: 'delete', id: look.id })) setOpenTheme(null); }} icon={Trash2} label={t.libraryDeleteYes || 'Delete it'} data="theme-delete-yes" danger />
                        <ToolButton onClick={() => setDeleting(false)} icon={X} label={t.cancel || 'Cancel'} data="theme-delete-no" />
                      </span>
                    )}
                  </>
                ) : (
                  <ToolButton onClick={() => makeTheme(look.id)} icon={CopyPlus} label={t.libraryCopyToChange || 'Make a copy to change'} data="theme-copy" />
                )}
                <ToolButton onClick={() => exportTheme(look)} icon={Download} label={t.libraryExport || 'Save as a file'} data="theme-export" />
                {themeError && <span className="text-[10px] text-rose-400" data-library="theme-error">{themeError}</span>}
                {shared && <span className={`text-[10px] ${shared.ok ? 'text-emerald-400' : 'text-rose-400'}`} data-library="theme-shared">{shared.words}</span>}
              </div>
            )}
            {opened && renaming && (
              <div className="glass-panel rounded-2xl border border-zinc-800 p-4 space-y-2 max-w-xl" data-library="theme-rename-form">
                <label className="block space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.libraryThemeName || 'Name'}</span>
                  <input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={60} className={field} data-library="theme-rename-name" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.libraryThemeHint || 'What it is for'}</span>
                  <textarea value={renaming.hint} onChange={(e) => setRenaming({ ...renaming, hint: e.target.value })} maxLength={400} rows={2} className={field} data-library="theme-rename-hint" />
                </label>
                <div className="flex items-center gap-2">
                  <ToolButton onClick={async () => { if (await runTheme({ op: 'rename', id: look.id, name: renaming.name, hint: renaming.hint })) setRenaming(null); }} icon={Check} label={t.save || 'Save'} data="theme-rename-save" />
                  <ToolButton onClick={() => setRenaming(null)} icon={X} label={t.cancel || 'Cancel'} data="theme-rename-cancel" />
                </div>
              </div>
            )}
            {opened && styling && styling.themeId === look.id && (
              <ThemeStylePanel
                draft={styling.draft}
                onChange={(draft) => setStyling({ ...styling, draft })}
                dirty={styleDirty}
                onSave={saveStyle}
                onDiscard={() => styledFrom && setStyling({ ...styling, draft: structuredClone(styledFrom) })}
                onClose={() => setStyling(null)}
                busy={pieceBusy}
                error={themeError}
                t={t}
              />
            )}
            {opened && adding && isMine(look) && (
              <div className="glass-panel rounded-2xl border border-zinc-800 p-4 space-y-2 max-w-xl" data-library="add-piece">
                <label className="block space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.libraryAddPieceFor || 'For'}</span>
                  <select value={adding.layerType} onChange={(e) => setAdding({ ...adding, layerType: e.target.value, from: '' })} className={field} data-library="add-piece-kind">
                    {(THEME_PIECE_TYPES as string[]).map((kind) => <option key={kind} value={kind}>{kindLabel(kind, t)}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.libraryStartFrom || 'Start from'}</span>
                  <select value={adding.from} onChange={(e) => setAdding({ ...adding, from: e.target.value })} className={field} data-library="add-piece-from">
                    <option value="">{t.libraryAddPieceEmpty || 'Nothing: write it from scratch'}</option>
                    {piecesOfKind(adding.layerType).map((p: any) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
                {!adding.from && (
                  <label className="block space-y-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{t.libraryAddPieceIs || 'It is'}</span>
                    <select value={adding.kind} onChange={(e) => setAdding({ ...adding, kind: e.target.value as 'look' | 'motion' })} className={field} data-library="add-piece-is">
                      <option value="look">{t.libraryAddPieceLook || 'A look: how it is drawn'}</option>
                      <option value="motion">{t.libraryAddPieceMotion || 'A motion: how it arrives'}</option>
                    </select>
                  </label>
                )}
                <div className="flex items-center gap-2">
                  <ToolButton onClick={startPiece} icon={Check} label={t.libraryAddPieceStart || 'Start it'} data="add-piece-start" />
                  <ToolButton onClick={() => setAdding(null)} icon={X} label={t.cancel || 'Cancel'} data="add-piece-cancel" />
                </div>
              </div>
            )}
            {opened && editing?.isNew && editing.themeId === look.id && (
              <div className="glass-panel rounded-2xl border border-current-accent/60 p-4 space-y-3 max-w-3xl" data-library="new-piece">
                <Preview object={editing.draft} system={preview} accent={accent} replay={replays[editing.draft.id] || 0} t={t} />
                <ThemePieceEditor
                  draft={editing.draft}
                  onChange={(draft) => setEditing({ ...editing, draft })}
                  theme={look}
                  kindName={(kind) => kindLabel(kind, t)}
                  onSave={savePiece}
                  onCancel={() => setEditing(null)}
                  busy={pieceBusy}
                  error={themeError}
                  t={t}
                />
              </div>
            )}
            {opened && !look.objects.length && !editing && !adding && (
              <p className="text-[10px] text-zinc-500" data-library="theme-empty">{t.libraryThemeEmpty || 'No pieces yet: add one, or make a copy of a theme instead.'}</p>
            )}

            {/* The whole theme at once, on the layout chosen above: its plan shown first. */}
            {!searching && open && look.id === open.id && layout && themesToApply(themes).some((th: any) => th.id === open.id) && themePlanView()}

            {split && (
              <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400" data-library="looks-heading">
                {t.libraryLooks || 'Looks'}
              </h4>
            )}

            {still.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{still.map(piece)}</div>
            )}

            {motion.length > 0 && (
              <div className="space-y-3 pt-2" data-library="motion-section">
                <div>
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    {t.libraryMotion || 'Motion'}
                  </h4>
                  <p className="text-[10px] text-zinc-600 leading-relaxed max-w-2xl">
                    {t.libraryMotionIntro
                      || 'How a layer arrives. These go in the motion box on a layer, so they sit alongside whatever look it already has rather than replacing it.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{motion.map(piece)}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
