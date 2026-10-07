/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Several overlays composed onto one canvas.
 *
 * OBS normally needs a browser source per overlay, each positioned by hand and
 * repeated for every scene collection. A canvas is one source: the arrangement
 * lives in the layout, travels with a config export, and can be edited without
 * touching OBS.
 *
 * Nothing here draws anything itself. Every layer mounts the same component
 * its standalone `?mode=` page mounts, so a layer and its own browser source
 * are the same overlay — there is no second implementation to drift.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChatLog } from './ChatMessageRow';
import { Nameplate } from './Nameplate';
import { ImageLayer } from './ImageLayer';
import { GoalBar } from './GoalBar';
import { PlanOverlay } from './PlanOverlay';
import { QuestionOverlay } from './QuestionOverlay';
import { TextLayer } from './TextLayer';
import { ShapeLayer } from './ShapeLayer';
import { RunCard } from './RunCard';
import { RosterLayer } from './RosterLayer';
import { conditionMet } from '../../shared/layer-conditions.js';
import { kitFor } from '../../shared/house-avatar.js';
import { layerAnimation } from '../../shared/layer-motion.js';
import { resolvePerson } from '../../shared/run.js';
import { LayoutStyle } from './LayoutStyle';
import { LayerStyle } from './LayerStyle';
import { AlertOverlay } from './AlertOverlay';
import { Omnibar } from './Omnibar';
import { TallOmnibar } from './TallOmnibar';
import { Stopwatch } from './Stopwatch';
import { PlayersLayer } from './PlayersLayer';
import { PollLayer } from './PollLayer';
import { TRANSLATIONS } from '../constants';
import { withoutVotes } from '../../shared/polls.js';
import { CHAT_DEFAULTS } from '../../shared/chat-style.js';
import { VoiceLayer } from './VoiceLayer';
import { AvatarLayer } from './AvatarLayer';
import { PngtuberLayer } from './PngtuberLayer';
import { HypeTrainLayer } from './HypeTrainLayer';
import { LeaderboardLayer, SAMPLE_BOARD } from './LeaderboardLayer';
import { GiveawayLayer, SAMPLE_GIVEAWAY } from './GiveawayLayer';
import { ShoutoutLayer } from './ShoutoutLayer';
import { Countdown, countdownFor } from './Countdown';
import { ViewerCount } from './ViewerCount';
import { SpotifyNowPlaying } from './SpotifyNowPlaying';

export interface CanvasLayer {
  type: 'chat' | 'alerts' | 'omnibar' | 'countdown' | 'stopwatch' | 'viewers' | 'spotify' | 'nameplate' | 'images' | 'goal' | 'plan' | 'question' | 'text' | 'shape' | 'runcard' | 'roster' | 'players' | 'poll' | 'voice' | 'avatar' | 'pngtuber' | 'hypetrain' | 'shoutout' | 'leaderboard' | 'giveaway' | 'source';
  /** Only draw while this is true. See shared/layer-conditions.js. */
  showWhen?: string;
  showWhenNot?: boolean;
  /** This layer's own stylesheet, scoped to it. See LayerStyle. */
  css?: string;
  /**
   * What that stylesheet's own controls have been set to.
   *
   * Beside the text rather than written into it, so the stylesheet stays as
   * it was typed and putting a value back is forgetting a key. Read out of
   * the sheet itself — see shared/css-fields.js.
   */
  cssVars?: Record<string, string>;
  /** And its motion, kept apart so a change of look cannot take it. */
  motionCss?: string;
  /** How it arrives, and what it does once it is there. */
  animateIn?: string;
  animateIdle?: string;
  animateSpeed?: number;
  /** Which layer this is. Several layers can share a type. */
  uid: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  /** Left alone by the editor: no outline, no label, and no dragging it. */
  locked?: boolean;
  /** The editor's group it is in, if any: its layers move and resize together. Not drawn. */
  group?: string;
  /** A shape the editor keeps it to while it is resized, as '16:9'. '' or none is free. See shared/aspect.js. */
  aspect?: string;
  /* How it is drawn, as opposed to what it draws. All optional, all no-ops. */
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  blendMode?: string;
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  hueRotate?: number;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  shadowColor?: string;
  /** Per-layer overrides, merged over the surface's own configuration. */
  config?: Record<string, any>;
}

export interface CanvasLayout {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  /** One typeface for the whole canvas; anything that has not chosen one follows. */
  fontFamily?: string;
  /** The colour layers use where none was chosen. */
  accent?: string;
  /** The layout's own stylesheet. See LayoutStyle. */
  css?: string;
  /**
   * OBS scene names this layout is shown for.
   *
   * By name because that is what obs-websocket reports and the only thing a
   * person recognises in a list. One scene belongs to at most one layout.
   */
  scenes?: string[];
  /** What the layout is for: a scene type's id (server/engine/scene-types.js), which a command can ask for in any profile. */
  sceneType?: string;
  /** Folders in the editor's list of layers. See shared/layer-groups.js. */
  groups?: { id: string; name: string }[];
  layers: CanvasLayer[];
}

interface CanvasStageProps {
  layout: CanvasLayout;
  /** The whole client state object, so each layer can take what it needs. */
  system: any;
  t: any;
  /**
   * Draw the layout's bounds and each layer's box.
   *
   * Off on stream. The editor turns it on, because an empty layer — a chat
   * box before anyone has spoken — is otherwise invisible and impossible to
   * position.
   */
  showGuides?: boolean;
  /**
   * Drawn inside the stage, on top of the layers, in the layout's own
   * coordinate space — so an editor's selection handles scale with the stage
   * instead of having to be repositioned every time the pane resizes.
   */
  children?: React.ReactNode;
  /**
   * The current fit scale, whenever it changes. An editor needs it to turn a
   * drag measured in screen pixels into a move measured in canvas pixels.
   */
  onScale?: (scale: number) => void;
  /**
   * The Omnilayer wipe in progress, if any: `{ phase: 'cover' | 'reveal', id, coverMs, maxMs }`
   * (server/engine/omnilayer.js). Only the canvas OBS shows passes it.
   */
  moving?: { phase: 'cover' | 'reveal'; id?: number; coverMs?: number; maxMs?: number } | null;
}

/**
 * Where OBS puts one of its sources, in Omnilayer mode.
 *
 * Nothing at all on stream — the source itself shows through here, from
 * underneath the overlay. In the editor a box with the source's name, so the
 * slot can be seen and placed.
 */
const SourceSlot = ({ layer }: { layer: CanvasLayer }) => (
  <div
    className="w-full h-full flex flex-col items-center justify-center gap-2 text-center"
    data-source-slot=""
    style={{
      background: 'repeating-linear-gradient(135deg, rgba(56,189,248,0.10) 0 18px, rgba(56,189,248,0.04) 18px 36px)',
      border: '2px dashed rgba(56,189,248,0.7)',
      color: 'rgba(186,230,253,0.95)',
      font: '800 28px/1.1 Montserrat, sans-serif',
      letterSpacing: '0.04em',
    }}
  >
    <span style={{ fontSize: 18, letterSpacing: '0.2em', opacity: 0.8 }}>OBS</span>
    <span>{(layer.config as any)?.source || '—'}</span>
  </div>
);

/**
 * The Omnilayer cover: a black panel with the accent along its leading edge,
 * sweeping in from the left to cover the whole canvas, and on out to the
 * right to uncover it. A second switch mid-wipe keeps it covered rather than
 * starting it again.
 *
 * It moves by a transition rather than keyframes, so a change of direction
 * starts from wherever the panel is: a new switch arriving while it slides
 * out turns it round mid-screen, where keyframes would have snapped it back
 * to the left edge and swept it in again. It mounts off to the left and is
 * measured there once, so the first sweep has somewhere to start from.
 *
 * It also never trusts that it will be told to leave. Past `maxMs` covered —
 * the longest the server can take, with room to spare — it slides out by
 * itself: the connection to the server dropping mid-wipe must not leave the
 * stream black until it comes back. Given up on, a switch stays given up on
 * through its reveal; the next switch has a new id and is drawn again.
 *
 * data-omni="cover" is the hook for a layout's own stylesheet to restyle it.
 */
const OmniCover = ({ moving }: { moving: NonNullable<CanvasStageProps['moving']> }) => {
  const ms = Math.max(150, moving.coverMs || 450);
  const panel = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [gaveUpOn, setGaveUpOn] = useState<number | null>(null);
  const id = moving.id ?? -1;
  const covering = moving.phase === 'cover' && gaveUpOn !== id;

  useLayoutEffect(() => {
    panel.current?.getBoundingClientRect();
    setReady(true);
  }, []);

  useEffect(() => {
    if (moving.phase !== 'cover' || !moving.maxMs) return;
    const timer = setTimeout(() => setGaveUpOn(id), moving.maxMs);
    return () => clearTimeout(timer);
  }, [moving.phase, id, moving.maxMs]);

  const x = !ready ? (moving.phase === 'cover' ? -104 : 0) : covering ? 0 : 104;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2147483000 }}>
      <div
        ref={panel}
        data-omni="cover"
        data-omni-phase={covering ? 'cover' : 'reveal'}
        className="absolute inset-0"
        style={{
          background: '#0a0a0b',
          boxShadow: covering ? 'inset -28px 0 0 var(--overlay-accent, #f43f5e)' : 'inset 28px 0 0 var(--overlay-accent, #f43f5e)',
          transform: `translateX(${x}%)`,
          transition: ready ? `transform ${ms}ms cubic-bezier(.7,0,.3,1)` : 'none',
        }}
      />
    </div>
  );
};

/**
 * Scale the stage so a layout fills whatever the browser source turned out to
 * be.
 *
 * The alternative is authoring against the exact source size, which makes a
 * layout worthless the moment somebody uses a different one. `contain` rather
 * than `cover`: overflowing the source would silently crop an overlay, and
 * finding out on stream is the wrong time.
 */
function useFitScale(width: number, height: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      setScale(Math.min(w / width, h / height));
    };
    measure();
    // OBS resizes a browser source without reloading it, so a one-off
    // measurement at mount would be wrong for the rest of the stream.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  return { ref, scale };
}

/**
 * How a layer is drawn: rotation, flips, filters, blending.
 *
 * Returns nothing at all when every setting is left alone, which is the point.
 * A `filter` or a `transform` that does nothing still promotes the layer to its
 * own compositing surface, so writing `filter: none` on eight untouched layers
 * would cost real frames on a browser source for no visible difference.
 */
/**
 * What a condition is allowed to ask about.
 *
 * Named here rather than handing conditions the whole client: a condition
 * that could reach anywhere would have to be changed every time anything
 * moved, and this is also the list the editor describes to the user.
 */
function conditionState(system: any) {
  return {
    spotifyTrack: system?.spotify?.state?.track,
    countdown: system?.data?.countdown,
    plan: system?.data?.plan,
    questions: system?.data?.questions,
    currentAlert: system?.data?.currentAlert,
    poll: system?.data?.poll,
    giveaway: system?.data?.giveaway,
    voice: system?.data?.voice,
  };
}

function layerAppearance(layer: CanvasLayer): React.CSSProperties {
  const style: React.CSSProperties = {};

  const transforms: string[] = [];
  if (layer.rotation) transforms.push(`rotate(${layer.rotation}deg)`);
  if (layer.flipH) transforms.push('scaleX(-1)');
  if (layer.flipV) transforms.push('scaleY(-1)');
  if (transforms.length) style.transform = transforms.join(' ');

  const filters: string[] = [];
  if (layer.blur) filters.push(`blur(${layer.blur}px)`);
  if (layer.brightness !== undefined && layer.brightness !== 100) filters.push(`brightness(${layer.brightness}%)`);
  if (layer.contrast !== undefined && layer.contrast !== 100) filters.push(`contrast(${layer.contrast}%)`);
  if (layer.saturate !== undefined && layer.saturate !== 100) filters.push(`saturate(${layer.saturate}%)`);
  if (layer.hueRotate) filters.push(`hue-rotate(${layer.hueRotate}deg)`);
  // A shadow with no blur and no offset is invisible, so it is not a shadow.
  if (layer.shadowBlur || layer.shadowX || layer.shadowY) {
    filters.push(`drop-shadow(${layer.shadowX || 0}px ${layer.shadowY || 0}px ${layer.shadowBlur || 0}px ${layer.shadowColor || '#000000cc'})`);
  }
  if (filters.length) style.filter = filters.join(' ');

  if (layer.blendMode && layer.blendMode !== 'normal') style.mixBlendMode = layer.blendMode as any;

  return style;
}

/** One layer's contents. Returns null for a layer with nothing to show. */
/** What the Library shows a Hype Train and a shoutout look with, since neither is on screen until Twitch says so. */
const SAMPLE_TRAIN = { active: true, level: 2, progress: 1150, goal: 1800, expiresAt: Date.now() + 3600000, endedAt: null, top: [{ user: 'Tripulante' }, { user: 'Impostor' }] };
const SAMPLE_SHOUTOUT = { name: 'Streamer', login: 'streamer', game: 'Among Us', viewers: 42, at: 0 };

function renderLayer(layer: CanvasLayer, system: any, t: any, accent?: string, layers: CanvasLayer[] = []) {
  const cfg = layer.config || {};

  switch (layer.type) {
    case 'chat':
      // Its settings are the layer's own, whole — the server fills them out —
      // so the defaults are only there for a layout saved by an older version.
      // Never this device's: those are the dock's, which is a different chat.
      return (
        <ChatLog
          messages={withoutVotes(system.data.chatMessages, (system.data as any).poll, (system.data as any).pollSettings)}
          settings={{ ...CHAT_DEFAULTS, ...cfg } as any}
          gap={cfg.gap ?? cfg.messageGap ?? 0}
          t={t}
          // The canvas is only ever a browser source, so messages expire here,
          // and the chat's own words are the stream's.
          autoHide
          onStream
        />
      );

    case 'runcard':
      // What is being played, from the one record the whole app shares.
      {
        /*
          Keyed on what it shows, so a change of game remounts it and any
          entrance written for it plays again. Without this, motion on a
          run card runs once on load and then never, which looks like the
          animation simply not working.
        */
        const run = system.data.run;
        const shows = [run?.game, run?.platform, run?.year, run?.category, run?.estimate].join('|');
        return <RunCard key={`card-${shows}`} config={cfg} run={run} />;
      }

    case 'shape':
      // Nothing live in it: this is what the live layers sit on.
      return <ShapeLayer config={cfg} />;

    case 'nameplate':
      // Its look is its own — there is no other surface to inherit from,
      // which is why the server validates this layer's config. Who it is
      // about can come from the run instead of from the layer.
      {
        /*
          Resolved here rather than inside the plate, so the plate stays a
          thing that draws a name and does not have to know what a run is.
        */
        const person = resolvePerson(cfg.source, system.data.run, (system.data as any).remotePlayers);
        /*
          Following somebody who is not there draws nothing at all, rather
          than a plate with only their pronouns on it. The plate hides itself
          when both lines are empty, which is not the same test: a seat that
          has been added and half filled in has a second line and no name.
          Typed plates are left alone — a subtitle with no name is odd, but
          it is what was asked for.
        */
        if (person && !person.name) return null;
        // Keyed for the same reason as the run card: a new name is a new plate.
        const shown = person ? { ...cfg, ...person } : cfg;
        return <Nameplate key={`plate-${shown.name}|${shown.subtitle}`} config={shown} />;
      }

    case 'roster':
      /*
        Handed the run rather than reaching for it, so a seat and a nameplate
        following the same person cannot resolve to two different people.
      */
      return <RosterLayer config={cfg} run={system.data.run} />;

    case 'players':
      // The list is the Players screen's; the layer only decides how it is laid out.
      return <PlayersLayer config={cfg} players={(system.data as any).players} t={t} />;

    case 'poll':
      // The poll is the Polls screen's; the layer only draws it.
      return <PollLayer config={cfg} poll={(system.data as any).poll} t={t} />;

    case 'voice':
      // The call is the Voice call screen's and the bot's; the layer only draws it.
      return <VoiceLayer config={cfg} voice={(system.data as any).voice} accent={accent} pixelAvatars={(system.data as any).pixelAvatars || []} />;

    case 'avatar':
      /*
        Handed the layout's colour rather than reading it off the page, so its
        colours are worked out once, in shared/avatar.js, and not by the browser.
      */
      return (
        <AvatarLayer
          config={cfg} voice={(system.data as any).voice} alert={system.data.currentAlert} accent={accent}
          // A pixel avatar from the Pixel avatars tab, if the layer draws one; gone or none, the house avatar (shared/house-avatar.js).
          kit={kitFor(cfg.character, (system.data as any).pixelAvatars)}
          mic={(system.data as any).micTalk} asked={(system.data as any).avatarFace} dress={(system.data as any).avatarDress} acted={(system.data as any).avatarAction} hypeTrain={(system.data as any).hypeTrain}
          // Where it is and where everything else is, and what just happened, so it can glance at it.
          self={layer} layers={layers}
          happenings={{
            chat: system.data.chatMessages?.[system.data.chatMessages.length - 1]?.id,
            alert: system.data.currentAlert?.id,
            poll: (system.data as any).poll?.mode === 'open' ? String((system.data as any).poll?.openedAt) : undefined,
            question: (system.data.questions as any)?.showingId || undefined,
            song: system.spotify?.state?.track ? `${system.spotify.state.track.name}|${system.spotify.state.track.artist}` : undefined,
          }}
        />
      );

    case 'pngtuber':
      // Talking comes from the microphone in OBS, or from the Discord call.
      return <PngtuberLayer config={cfg} voice={(system.data as any).voice} mic={(system.data as any).micTalk} asked={(system.data as any).avatarFace} />;

    case 'hypetrain':
      // The train is Twitch's; the server keeps where it is. A preview (the Library) draws a sample.
      return <HypeTrainLayer config={cfg} train={cfg.preview ? SAMPLE_TRAIN : (system.data as any).hypeTrain} />;

    case 'giveaway':
      // The giveaway is the Giveaways screen's and the server's; the layer only draws it. A preview draws a sample.
      return <GiveawayLayer config={cfg} giveaway={cfg.preview ? SAMPLE_GIVEAWAY : (system.data as any).giveaway} />;

    case 'leaderboard':
      // The chat's top by XP, kept by the server a few seconds behind the chat. A preview draws a sample.
      return <LeaderboardLayer config={cfg} board={cfg.preview ? SAMPLE_BOARD : (system.data as any).leaderboard} />;

    case 'shoutout':
      // Who is being shouted out, for as long as the Twitch screen says.
      return <ShoutoutLayer config={cfg} card={cfg.preview ? SAMPLE_SHOUTOUT : (system.data as any).shoutoutCard} />;

    case 'images':
      // Its settings are its own, which is also why the server validates them.
      return <ImageLayer config={cfg} />;

    case 'goal':
      // Follows a count the server already keeps, or a number typed in.
      return <GoalBar config={cfg} stats={system.data.stats} />;

    case 'plan':
      // What the stream is working through, and where it has got to.
      return <PlanOverlay plan={system.data.plan} config={cfg} />;

    case 'question':
      // Only ever the one that was chosen, and only once approved.
      // Keyed on the question on screen, so a motion replays for each one put up.
      return <QuestionOverlay key={`question-${(system.data.questions as any)?.showingId || ''}`} questions={system.data.questions} config={cfg} />;

    case 'text':
      /*
        Composed here rather than reaching into the client state from the
        layer: the song is on the spotify slice and the rest is on data, and
        a layer that knew that would have to be changed whenever they move.
      */
      return (
        <TextLayer
          config={cfg}
          state={{
            stats: system.data.stats,
            streamTags: system.data.streamTags,
            plan: system.data.plan,
            run: system.data.run,
            players: (system.data as any).players,
            poll: (system.data as any).poll,
            voice: (system.data as any).voice,
            spotifyTrack: system.spotify?.state?.track,
            twitchSchedule: (system.data as any).twitchSchedule,
            counters: (system.data as any).counters,
          }}
        />
      );

    case 'alerts':
      // Alerts fill their layer and disappear between firings, which is why
      // this layer is usually the whole canvas.
      return system.data.currentAlert ? <AlertOverlay alert={system.data.currentAlert} playSound /> : null;

    case 'omnibar': {
      /* The bar this layer names, or Main — which is also where a layer lands
         whose bar has since been deleted, rather than on nothing. Drawn by
         whichever component its kind says. */
      const bar = (layer.config?.bar && (system.data.omnibars || []).find((b: any) => b.id === layer.config.bar)) || system.data.omnibar;
      const Bar: any = bar?.kind === 'tall' ? TallOmnibar : Omnibar;
      return (
        <Bar
          config={bar}
          stats={system.data.stats}
          tags={system.data.streamTags}
          leaderboard={system.data.leaderboard}
          track={system.spotify.state.track}
          upNext={system.spotify.state.upNext}
          countdown={system.data.countdown}
          commands={system.data.commands}
          subscribers={system.data.subscribers}
          events={system.data.viewerEvents}
          t={t}
        />
      );
    }

    case 'stopwatch':
      // The run timer, working its time out from the server's start time.
      return <Stopwatch state={system.data.stopwatch} />;

    case 'countdown':
      // The saved timer this layer names, or the clock as it is when it names none.
      return <Countdown state={countdownFor(system.data.countdown, layer.config?.timer)} t={t} />;

    case 'viewers':
      return <ViewerCount config={system.data.viewers} stats={system.data.stats} status={system.status} t={t} />;

    case 'spotify':
      /*
        The reshapeable one, not the player from the dashboard. That one has
        buttons and hover states, which a browser source cannot use and which
        are what forced it to be a card.
      */
      return <SpotifyNowPlaying spotify={system.spotify} config={cfg} t={t} />;

    case 'source':
      // An OBS source's slot (Omnilayer): the source shows through from under
      // the overlay, so on stream there is nothing to draw. The stage draws the
      // editor's box for it before this is ever asked.
      return null;

    default:
      // A layout saved by a newer version. Skipping beats crashing the whole
      // canvas over one layer this build does not know about.
      return null;
  }
}

/**
 * The words on stream. A canvas is what viewers see, and the stream is in
 * Spanish — whatever language the screen showing it is set to. An OBS
 * browser source has never been told a language, so going by the device
 * put "votes", "Out" and "Paused" on a Spanish stream. The editor's preview
 * uses the same words, so it shows what the stream will.
 */
const STREAM_WORDS = TRANSLATIONS.es;

export const CanvasStage: React.FC<CanvasStageProps> = ({
  layout, system, t, showGuides = false, children, onScale, moving = null,
}) => {
  const { ref, scale } = useFitScale(layout.width, layout.height);

  useEffect(() => { onScale?.(scale); }, [scale, onScale]);

  return (
    <div ref={ref} className="w-full h-full overflow-hidden flex items-center justify-center">
      <div
        className="canvas-stage relative shrink-0"
        style={{
          width: layout.width,
          height: layout.height,
          background: layout.background,
          /*
            The canvas tokens. The font is plain inheritance — a layer that
            sets none gets this one — and the accent is a custom property
            each layer falls back to, so a colour nobody chose follows the
            canvas and a colour somebody did choose does not.
          */
          fontFamily: layout.fontFamily || undefined,
          ['--overlay-accent' as any]: layout.accent || undefined,
          transform: `scale(${scale})`,
          // Without this the stage scales about its centre and the flex
          // centring above then has nothing to centre.
          transformOrigin: 'center center',
          outline: showGuides ? '1px dashed rgba(255,255,255,0.35)' : undefined,
        }}
      >
        <LayoutStyle css={layout.css} inEditor={showGuides} />
        {layout.layers
          .filter((l) => l.visible)
          .map((layer) => {
            /*
              A layer whose condition is not met is gone on stream, but in the
              editor it is only faded: one that vanishes the moment its
              condition goes false is a layer nobody can position, and the
              thing it waits for is usually not happening while you build.
            */
            const met = conditionMet(layer.showWhen, layer.showWhenNot, conditionState(system));
            const motion = layerAnimation(layer);
            if (!met && !showGuides) return null;

            return (
              <div
                key={layer.uid}
                className="absolute overflow-hidden"
                /*
                  Hooks for custom CSS. Without something stable to name, the only
                  way to reach a layer from a stylesheet is by guessing at markup
                  this app is free to change, which is a stylesheet that breaks on
                  an update for a reason nobody can see.
                */
                data-layer-type={layer.type}
                data-layer-id={layer.uid}
                style={{
                  left: layer.x,
                  top: layer.y,
                  width: layer.width,
                  height: layer.height,
                  opacity: met ? layer.opacity : layer.opacity * 0.25,
                  ...layerAppearance(layer),
                  outline: showGuides
                    ? `1px dashed ${met ? 'rgba(244,63,94,0.6)' : 'rgba(244,63,94,0.25)'}`
                    : undefined,
                }}
              >
                {/*
                  The motion sits inside the placement, not on it: the wrapper
                  already carries this layer's rotate and flip, and an animation
                  on the same element would replace them while it ran.
                */}
                <div
                  className="w-full h-full"
                  data-layer-animation={motion ? '' : undefined}
                  style={motion ? { animation: motion } : undefined}
                >
                  {/* Scoped to this layer by being here. See LayerStyle. */}
                  <LayerStyle css={layer.css} motionCss={layer.motionCss} vars={layer.cssVars} />
                  {/* An OBS source's slot shows as a box in the editor, and as nothing on stream. */}
                  {layer.type === 'source' && showGuides && <SourceSlot layer={layer} />}
                  {renderLayer(layer, system, STREAM_WORDS, layout.accent, layout.layers)}
                </div>
              </div>
            );
          })}
        {moving && !showGuides && <OmniCover moving={moving} />}
        {children}
      </div>
    </div>
  );
};
