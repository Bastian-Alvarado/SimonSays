/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The pixel avatar on stream: a face, what it is wearing, in the layout's
 * colour or another, doing things by itself — blinking now and then,
 * talking while you talk (your microphone in OBS, or somebody chosen in the
 * Discord call), shaking when you are loud, pulling a face at an alert for
 * as long as the alert is up, and wearing whatever face an action asks for.
 *
 * Plain on purpose: this is the default look, and themes dress it. Its parts
 * name themselves (data-avatar="frame", "figure", "svg", "label"), the frame
 * says what it is doing (data-avatar-expression, -talking, -reacting), and
 * every colour is a custom property (--avatar-<part>, see PixelAvatar).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PixelAvatar } from './PixelAvatar';
import { PixelKitAvatar } from './PixelKitAvatar';
import { pixelColours, pixelFacesNow, pixelActionFrames, pixelTurns, pixelHats, pixelHasFace, pixelHeadroom, pixelOutfit } from '../../shared/pixel-avatars.js';
import type { PixelAvatarDef } from '../types';
import { avatarColours, avatarFacesNow, AVATAR_HATS, avatarReactionFor, avatarLookToward, avatarOverwhelmed, avatarRestingFace, avatarSleepState, AVATAR_SLEEP_FACES, AVATAR_STARTLE_MS, AVATAR_HYPE_MS, AVATAR_OVERWHELM, AVATAR_REACTION_DEFAULTS, AVATAR_EXPRESSIONS_LIST, AVATAR_WATCHES, AVATAR_BREATH_MS, AVATAR_BUBBLE_BREATH, AVATAR_BREATH, AVATAR_DOZING_BREATH, AVATAR_HEAD_FOLLOW_MS, avatarHeadTurn, AVATAR_HEADROOM, AVATAR_DIZZY_ROCK_MS, AVATAR_DIZZY_LOLL, AVATAR_SHAKE_OFF, avatarLollAt, avatarRegularTurns, AVATAR_TURN_STEP_MS, avatarActionFrames } from '../../shared/avatar.js';

export interface AvatarLayerConfig {
  expression?: string;
  extras?: string[];
  costume?: string;
  colouring?: string;
  ownColour?: string;
  blink?: boolean;
  talkWith?: { id: string; name: string } | null;
  hop?: boolean;
  shake?: boolean;
  /** The eyes glance about by themselves. */
  glance?: boolean;
  /** The sparkle in the eyes twinkles now and then. */
  twinkle?: boolean;
  /** Breathes while awake: the shoulders rise, the head follows. */
  breathe?: boolean;
  /** The eyes glance toward what just happened: chat, an alert, a poll, a question, a song. */
  watch?: boolean;
  /** Dizzy when too much happens at once to follow. */
  overwhelm?: boolean;
  /** How many things at once it takes, three to six. */
  overwhelmCount?: number;
  /** Dozes off after the mic has been quiet this many minutes; 0 never. */
  sleepAfter?: number;
  loudFace?: string;
  react?: boolean;
  reactions?: Record<string, string>;
  /** Something it does as an alert of a kind lands (and as a Hype Train starts or levels up): by kind, its name. */
  reactionActions?: Record<string, string>;
  /** Viewers may dress it up, from chat or with channel points. */
  dressable?: boolean;
  label?: string;
  /** A pixel avatar from the Pixel avatars tab to draw instead of the built-in one, by its id; '' is the built-in one. */
  character?: string;
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// The dizzy timings, typed: shared/avatar.js is plain JavaScript and says nothing of their shape.
const LOLL = AVATAR_DIZZY_LOLL as [number, [number, number]][];
const SHAKE_OFF = AVATAR_SHAKE_OFF as [number, [number, number]][];

/** Hopping while talking, shaking while loud, breathing slow when fast asleep, jolting when startled, teetering when dizzy. Shared with the PNGtuber layer. */
export const AVATAR_KEYFRAMES = '@keyframes simonsaysAvatarHop { from { transform: translateY(0); } to { transform: translateY(-3%); } }'
  + ' @keyframes simonsaysAvatarZ { 0%, 100% { transform: translate(0, 0); opacity: 1; } 50% { transform: translate(1.5px, -2.5px); opacity: .55; } }'
  + ' @keyframes simonsaysAvatarZDeep { 0% { transform: translate(-2px, 3px); opacity: 0; } 25% { opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(4px, -7px); opacity: 0; } }'
  + ' @keyframes simonsaysAvatarSnore { 0%, 100% { transform: translateY(0) rotate(0) scale(1, 1); } 50% { transform: translateY(2.5%) rotate(-2.5deg) scale(1.015, 0.985); } }'
  + ' @keyframes simonsaysAvatarStartle { 0% { transform: translateY(0) rotate(0); } 12% { transform: translateY(-5%) rotate(-3deg); } 24% { transform: translateY(-3.5%) rotate(3deg); } 36% { transform: translateY(-4.5%) rotate(-2deg); } 50% { transform: translateY(-2%) rotate(1deg); } 70% { transform: translateY(0.5%) rotate(0); } 100% { transform: translateY(0) rotate(0); } }'
  + ' @keyframes simonsaysAvatarBang { 0% { transform: scale(0.2); opacity: 0; } 40% { transform: scale(1.15); opacity: 1; } 60% { transform: scale(0.95); } 100% { transform: scale(1); opacity: 1; } }'
  + ' @keyframes simonsaysAvatarShake { 0% { transform: translate(0, 0) rotate(0); } 25% { transform: translate(-1.5%, 0.5%) rotate(-1.5deg); } 50% { transform: translate(1.5%, -0.5%) rotate(1deg); } 75% { transform: translate(-1%, -1%) rotate(-0.5deg); } 100% { transform: translate(0, 0) rotate(0); } }'
  // Dizzy: rocking from the feet, further right than left, upright again at the end of every rock.
  + ' @keyframes simonsaysAvatarTeeter { 0%, 55%, 100% { transform: translateX(0) rotate(0); } 30% { transform: translateX(1.5%) rotate(4deg); } 80% { transform: translateX(-1%) rotate(-2.5deg); } }';

/**
 * Whether the layer's person is talking, and how loud: your microphone
 * (soft, normal or loud), or somebody in the call (the call says only
 * whether they speak, so always normal).
 */
export function talkingNow(talkWith: { id: string } | null | undefined, voice?: { members?: { id: string; speaking: boolean }[] }, mic?: { talking?: boolean; loud?: boolean; soft?: boolean } | null) {
  if (!talkWith) return { speaking: false, loud: false, soft: false };
  if (talkWith.id === 'mic') return { speaking: Boolean(mic?.talking), loud: Boolean(mic?.talking && mic?.loud), soft: Boolean(mic?.talking && mic?.soft && !mic?.loud) };
  return { speaking: Boolean(voice?.members?.some((m) => m.id === talkWith.id && m.speaking)), loud: false, soft: false };
}

/**
 * The avatar, alive: blinking every few seconds, now and then twice, and
 * while `speaking`, a mouth that opens and shuts at the uneven pace of
 * speech rather than a metronome's — a little when the voice is `soft`,
 * wide when it is `loud`.
 */
export const LivingAvatar = ({
  expression = 'neutral', reaction = null, extras = [], colours = {}, speaking = false, loud = false, soft = false, blink = true, hop = true, shake = true, costume = '', glance = true, twinkle = true, glanceAt = null, breathe = true, drawing = '', facing = null, action = null, kit = null,
}: {
  expression?: string; reaction?: string | null; extras?: string[]; colours?: Record<string, string>; costume?: string;
  speaking?: boolean; loud?: boolean; soft?: boolean; blink?: boolean; hop?: boolean; shake?: boolean; glance?: boolean; twinkle?: boolean;
  /** A look to hold for a moment, each time its key changes: something happened over there. */
  glanceAt?: { look: string; key: string } | null;
  /** Breathes while awake, the shoulders and then the head, a pixel at a time. */
  breathe?: boolean;
  /** A regular's own drawing in its place, talking and breathing the same way (see PixelAvatar). */
  drawing?: string;
  /**
   * Which way to face, for a drawing that turns — toward whoever is talking
   * in the call. Left out, it faces the front and now and then glances off
   * to one side, as the avatar's eyes do.
   */
  facing?: 'left' | 'front' | 'right' | null;
  /** Something to do — drink a glass of water — played once each time its key changes. */
  action?: { name: string; key: string } | null;
  /** A pixel avatar from the Pixel avatars tab, drawn in place of the built-in one and doing all the same things. */
  kit?: PixelAvatarDef | null;
}) => {
  // A blink goes open, half, shut, half, open: softer than a snap, and no slower.
  const [lid, setLid] = useState<'open' | 'half' | 'shut'>('open');
  const blinking = lid === 'shut';
  const [mouthOpen, setMouthOpen] = useState(false);
  const [look, setLook] = useState('right');
  const [eventLook, setEventLook] = useState<string | null>(null);
  const [sparkle, setSparkle] = useState('normal');
  // Fast asleep: one slow breath every few seconds, the nose bubble swelling and shrinking with it.
  const deep = (reaction || expression) === 'deep-sleep';
  const [snore, setSnore] = useState(0);

  useEffect(() => {
    if (!blink) { setLid('open'); return undefined; }
    let timer: ReturnType<typeof setTimeout>;
    const shut = (then: () => void) => {
      setLid('half');
      timer = setTimeout(() => {
        setLid('shut');
        timer = setTimeout(() => {
          setLid('half');
          timer = setTimeout(() => { setLid('open'); then(); }, 45);
        }, 90);
      }, 45);
    };
    const next = () => {
      timer = setTimeout(() => shut(() => {
        // One blink in six is a double.
        if (Math.random() < 1 / 6) timer = setTimeout(() => shut(next), 160);
        else next();
      }), rand(2200, 6000));
    };
    next();
    return () => clearTimeout(timer);
  }, [blink]);

  // Now and then a glance somewhere else, for a second or two, and back.
  useEffect(() => {
    if (!glance) { setLook('right'); return undefined; }
    let timer: ReturnType<typeof setTimeout>;
    const places = ['centre', 'left', 'up', 'up-left', 'centre'];
    const next = () => {
      timer = setTimeout(() => {
        setLook(places[Math.floor(Math.random() * places.length)]);
        timer = setTimeout(() => { setLook('right'); next(); }, rand(800, 2200));
      }, rand(6000, 16000));
    };
    next();
    return () => clearTimeout(timer);
  }, [glance]);

  // Something happened over there: look at it for a moment, whatever the idle glances were doing.
  useEffect(() => {
    if (!glanceAt?.key) return undefined;
    setEventLook(glanceAt.look);
    const timer = setTimeout(() => setEventLook(null), rand(1300, 1900));
    return () => clearTimeout(timer);
  }, [glanceAt?.key]);

  // The sparkle catches the light: small, then big, then as drawn.
  useEffect(() => {
    if (!twinkle) { setSparkle('normal'); return undefined; }
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        setSparkle('small');
        timer = setTimeout(() => {
          setSparkle('big');
          timer = setTimeout(() => { setSparkle('normal'); next(); }, 180);
        }, 90);
      }, rand(3000, 8000));
    };
    next();
    return () => clearTimeout(timer);
  }, [twinkle]);

  useEffect(() => {
    if (!speaking) { setMouthOpen(false); return undefined; }
    let timer: ReturnType<typeof setTimeout>;
    let open = false;
    const flap = () => {
      open = !open;
      setMouthOpen(open);
      timer = setTimeout(flap, open ? rand(100, 180) : rand(70, 140));
    };
    flap();
    return () => clearTimeout(timer);
  }, [speaking]);

  useEffect(() => {
    if (!deep) { setSnore(0); return undefined; }
    let step = 0;
    const id = setInterval(() => { step = (step + 1) % AVATAR_BUBBLE_BREATH.length; setSnore(step); }, AVATAR_BREATH_MS / AVATAR_BUBBLE_BREATH.length);
    return () => clearInterval(id);
  }, [deep]);

  /*
    Dizzy. The figure teeters from its feet (simonsaysAvatarTeeter, below)
    and the head lolls after it a beat behind, in whole pixels. The loll is
    read off the clock since the dizziness began rather than stepped by a
    chain of timers, so however long it lasts it stays in time with the
    teeter — two rhythms drifting apart would fight rather than wobble.
  */
  const dizzy = (reaction || expression) === 'dizzy';
  const [loll, setLoll] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    if (!dizzy) { setLoll([0, 0]); return undefined; }
    const began = performance.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = (performance.now() - began) % AVATAR_DIZZY_ROCK_MS;
      setLoll(avatarLollAt(t) as [number, number]);
      const next = LOLL.find(([from]) => from > t);
      timer = setTimeout(tick, Math.max(10, (next ? next[0] : AVATAR_DIZZY_ROCK_MS) - t));
    };
    tick();
    return () => clearTimeout(timer);
  }, [dizzy]);

  // Coming to: the head shaken clear, the moment the dizziness ends.
  const wasDizzy = useRef(false);
  const [shakeOff, setShakeOff] = useState<[number, number] | null>(null);
  useEffect(() => {
    const was = wasDizzy.current;
    wasDizzy.current = dizzy;
    if (dizzy || !was) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const run = (i: number) => {
      if (i >= SHAKE_OFF.length) { setShakeOff(null); return; }
      setShakeOff(SHAKE_OFF[i][1]);
      const gap = i + 1 < SHAKE_OFF.length ? SHAKE_OFF[i + 1][0] - SHAKE_OFF[i][0] : 70;
      timer = setTimeout(() => run(i + 1), gap);
    };
    run(0);
    return () => { clearTimeout(timer); setShakeOff(null); };
  }, [dizzy]);
  const shakingOff = shakeOff !== null;

  /*
    Breathing. Everything else it did by itself was in the eyes, and between
    one blink and the next not a pixel of it moved — which is what read as
    stiff. Fast asleep it has its own slower sway, so it does not breathe
    this way on top of that; dozing, it breathes slower.
  */
  const dozing = (reaction || expression) === 'sleepy';
  const [breath, setBreath] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    // Not on top of the snore, and not while dizzy or shaking it off: those move it their own way.
    if (!breathe || deep || dizzy || shakingOff) { setBreath([0, 0]); return undefined; }
    let timer: ReturnType<typeof setTimeout>;
    let step = 0;
    const next = () => {
      const [bodyUp, headUp, [lo, hi]] = AVATAR_BREATH[step] as [number, number, [number, number]];
      setBreath([bodyUp, headUp]);
      step = (step + 1) % AVATAR_BREATH.length;
      timer = setTimeout(next, rand(lo, hi) * (dozing ? AVATAR_DOZING_BREATH : 1));
    };
    next();
    return () => clearTimeout(timer);
  }, [breathe, deep, dozing, dizzy, shakingOff]);

  /*
    The head follows the eyes: a beat after they glance somewhere, it turns a
    pixel that way — or nods a pixel, for a look down — and comes back a beat
    after they do. Eyes that move alone read as a doll's.
  */
  const eyesOn = eventLook || look;
  const [headLook, setHeadLook] = useState('right');
  useEffect(() => {
    const timer = setTimeout(() => setHeadLook(eyesOn), AVATAR_HEAD_FOLLOW_MS);
    return () => clearTimeout(timer);
  }, [eyesOn]);
  // One switch for the body moving at all: breathing and the head following the eyes.
  const turn = breathe ? avatarHeadTurn(headLook) : { x: 0, y: 0 };
  // Dizzy or shaking it off, the head is doing that instead of following the eyes.
  const head = dizzy ? { x: loll[0], y: loll[1] } : shakeOff ? { x: shakeOff[0], y: shakeOff[1] } : turn;

  /*
    Turning, for a regular's drawing with a front view. It faces the front,
    and now and then — as often and as long as the avatar's eyes glance —
    looks off to one side and back. Told which way to face (whoever is
    talking in the call), it faces that way instead. It follows a beat
    after, as the avatar's head follows its eyes, and from one side to the
    other it turns through the front, a frame at a time.
  */
  const turns = kit ? Boolean(pixelTurns(kit)) : Boolean(drawing) && avatarRegularTurns(drawing);
  const [idleFacing, setIdleFacing] = useState<'left' | 'front' | 'right'>('front');
  /*
    Asleep, it keeps still and faces the stream: no looking about with its
    eyes shut, and the nose bubble — drawn once, for the front — stays at
    its mouth.
  */
  const asleep = deep || dozing;
  useEffect(() => {
    if (!turns || !glance || asleep) { setIdleFacing('front'); return undefined; }
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        setIdleFacing(Math.random() < 0.5 ? 'left' : 'right');
        timer = setTimeout(() => { setIdleFacing('front'); next(); }, rand(800, 2200));
      }, rand(6000, 16000));
    };
    next();
    return () => clearTimeout(timer);
  }, [turns, glance, asleep]);
  const wantFacing = facing || idleFacing;
  const [facingNow, setFacingNow] = useState<'left' | 'front' | 'right'>('front');
  const facingShown = useRef<'left' | 'front' | 'right'>('front');
  useEffect(() => {
    if (!turns) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const now = facingShown.current;
      if (now === wantFacing) return;
      const nextFacing = now !== 'front' && wantFacing !== 'front' ? 'front' : wantFacing;
      facingShown.current = nextFacing;
      setFacingNow(nextFacing);
      if (nextFacing !== wantFacing) timer = setTimeout(step, AVATAR_TURN_STEP_MS);
    };
    timer = setTimeout(step, AVATAR_HEAD_FOLLOW_MS);
    return () => clearTimeout(timer);
  }, [turns, wantFacing]);

  /*
    Something it does, a frame at a time — a glass of water — played once,
    start to end, each time the key changes. Not the key it opened with: a
    page opening in the middle of one plays nothing. One already underway
    is not started over, and an outfit not drawn doing it does not do it.
  */
  const [doing, setDoing] = useState<{ name: string; frame: number } | null>(null);
  const seenAction = useRef(action?.key ?? null);
  const doingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(doingTimer.current), []);
  useEffect(() => {
    const key = action?.key ?? null;
    if (!key || !action || key === seenAction.current) return;
    seenAction.current = key;
    const { name } = action;
    const frames = (kit ? pixelActionFrames(kit, name, costume) : drawing ? null : avatarActionFrames(name, costume)) as { ms: number }[] | null;
    if (!frames?.length || doingTimer.current !== undefined) return;
    const run = (i: number) => {
      if (i >= frames.length) { doingTimer.current = undefined; setDoing(null); return; }
      setDoing({ name, frame: i });
      doingTimer.current = setTimeout(() => run(i + 1), frames[i].ms);
    };
    run(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action?.key]);
  // The frame up now, if its outfit has it: changing outfit halfway stops it showing.
  const frameNow = doing ? ((kit ? pixelActionFrames(kit, doing.name, costume) : avatarActionFrames(doing.name, costume)) as { eyes?: string }[] | null)?.[doing.frame] : null;
  const acting = doing && frameNow ? doing : null;

  /*
    While it does it, it holds still with its resting face and its mouth
    shut: each frame is drawn for the head and body exactly where they sit
    at rest, and nobody talks with a glass at their lips.
  */
  const faces = acting ? (frameNow?.eyes === 'shut' ? ['neutral', 'blink'] : ['neutral'])
    : kit ? pixelFacesNow(kit, { expression, reaction, mouthOpen, blinking, voice: loud ? 'loud' : soft ? 'soft' : 'normal' })
      : avatarFacesNow({ expression, reaction, mouthOpen, blinking, voice: loud ? 'loud' : soft ? 'soft' : 'normal' });
  const snoring = deep && !speaking && !acting;
  const jolting = (reaction || expression) === 'startled';
  return (
    <div
      className="relative shrink-0" data-avatar="figure"
      style={{
        width: '100%', height: '100%',
        // Dizzy comes first: it is what the pile-up did to it, talking or not.
        animation: acting ? undefined
          : dizzy ? `simonsaysAvatarTeeter ${AVATAR_DIZZY_ROCK_MS}ms ease-in-out infinite`
          : shake && loud && speaking ? 'simonsaysAvatarShake 0.12s linear infinite'
            : hop && speaking ? 'simonsaysAvatarHop 0.24s ease-in-out infinite alternate'
              : jolting ? `simonsaysAvatarStartle ${AVATAR_STARTLE_MS}ms ease-out`
                : snoring ? `simonsaysAvatarSnore ${AVATAR_BREATH_MS}ms ease-in-out infinite` : undefined,
        // Nodding off, and teetering, pivot at the feet.
        ...(snoring || dizzy ? { transformOrigin: '50% 100%' } : {}),
      }}
      data-avatar-doing={acting ? acting.name : undefined}
    >
      {/* Named so no theme's keyframes collide with them. */}
      <style>{AVATAR_KEYFRAMES}</style>
      {kit ? (
        <PixelKitAvatar
          kit={kit} faces={faces} extras={extras} colours={colours} outfit={costume} bubble={snoring ? AVATAR_BUBBLE_BREATH[snore] : 0}
          eyes={acting ? { look: 'right', sparkle: 'normal', half: false } : { look: eyesOn, sparkle, half: lid === 'half' }}
          // What it does is drawn from the side: facing the front, it turns to the side it was drawn facing while it does it.
          pose={acting ? {} : { bodyUp: breath[0], headUp: breath[1], turnX: head.x, turnY: head.y }} facing={turns ? (acting && facingNow === 'front' ? kit.drawnFacing || 'left' : facingNow) : null}
          action={acting}
        />
      ) : (
        <PixelAvatar
          faces={faces} extras={extras} colours={colours} costume={costume} bubble={snoring ? AVATAR_BUBBLE_BREATH[snore] : 0}
          eyes={acting ? { look: 'right', sparkle: 'normal', half: false } : { look: eyesOn, sparkle, half: lid === 'half' }}
          pose={acting ? {} : { bodyUp: breath[0], headUp: breath[1], turnX: head.x, turnY: head.y }} drawing={drawing} facing={turns ? facingNow : 'left'}
          action={acting}
        />
      )}
    </div>
  );
};

/**
 * The glance a layer should make now: toward whatever just happened, if it
 * happened on a layer this layout has. Chat is only looked at when it has
 * been quiet for a while — a busy chat would have the eyes twitching.
 */
const CHAT_QUIET_MS = 15000;

function useGlances(on: boolean, self: { x: number; y: number; width: number; height: number } | undefined, layers: any[], happenings: Record<string, string | undefined>, overwhelm = true, count = AVATAR_OVERWHELM.count) {
  const seen = useRef<Record<string, string | undefined> | null>(null);
  const lastChat = useRef(0);
  const [glance, setGlance] = useState<{ look: string; key: string } | null>(null);
  // When it last tried to follow something, to notice too much at once; chat counts once a burst.
  const tried = useRef<number[]>([]);
  const lastChatTried = useRef(0);
  const [dizzy, setDizzy] = useState(false);
  const dizzyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(dizzyTimer.current), []);
  const signature = Object.keys(AVATAR_WATCHES).map((k) => happenings[k] || '').join('|');
  useEffect(() => {
    const before = seen.current;
    seen.current = { ...happenings };
    // The first look at the state is where things stand, not something happening.
    if (!before || !on || !self) return;
    let next: { look: string; key: string } | null = null;
    for (const kind of Object.keys(AVATAR_WATCHES) as (keyof typeof AVATAR_WATCHES)[]) {
      const now = happenings[kind];
      if (!now || now === before[kind]) continue;
      const where = layers.find((l) => l.type === AVATAR_WATCHES[kind] && l.visible !== false);
      if (!where) continue;
      const at = Date.now();
      if (kind !== 'chat' || at - lastChatTried.current > AVATAR_OVERWHELM.withinMs) {
        tried.current = [...tried.current.filter((t) => at - t <= AVATAR_OVERWHELM.withinMs), at];
        if (kind === 'chat') lastChatTried.current = at;
      }
      if (overwhelm && avatarOverwhelmed(tried.current, at, { count })) {
        tried.current = [];
        setDizzy(true);
        clearTimeout(dizzyTimer.current);
        dizzyTimer.current = setTimeout(() => setDizzy(false), AVATAR_OVERWHELM.dizzyMs);
      }
      if (next) continue;
      if (kind === 'chat') {
        const quiet = Date.now() - lastChat.current > CHAT_QUIET_MS;
        lastChat.current = Date.now();
        if (!quiet) continue;
      }
      next = { look: avatarLookToward(self, where), key: `${kind}:${now}` };
    }
    if (next) setGlance(next);
  }, [signature, on]);
  return { glance, dizzy };
}

/**
 * Dozing off: dozing once the person it talks with has been quiet for
 * `minutes`, fast asleep at twice that, and awake again the moment they
 * speak. Quiet is counted from when they stopped — a long speech is not
 * quiet — and from when the layer appeared, so it does not start out asleep.
 */
function useDozing(speaking: boolean, minutes: number) {
  const lastSpoke = useRef(Date.now());
  const talking = useRef(speaking);
  const [sleep, setSleep] = useState<'awake' | 'dozing' | 'deep'>('awake');
  useEffect(() => {
    talking.current = speaking;
    lastSpoke.current = Date.now();
    if (speaking) setSleep('awake');
  }, [speaking]);
  useEffect(() => {
    if (!minutes) { setSleep('awake'); return undefined; }
    const id = setInterval(() => {
      if (talking.current) lastSpoke.current = Date.now();
      setSleep(avatarSleepState(Date.now() - lastSpoke.current, minutes));
    }, 5000);
    return () => clearInterval(id);
  }, [minutes]);
  return sleep;
}

/**
 * The Hype Train, cheered on: a key for a few seconds as a train starts and
 * each time it goes up a level, for the layer's "hype" face.
 */
function useHypeCheer(train?: { active?: boolean; level?: number; startedAt?: number } | null) {
  const [cheer, setCheer] = useState<string | null>(null);
  const key = train?.active ? `${train.startedAt ?? ''}:${train.level ?? 1}` : null;
  useEffect(() => {
    if (!key) return undefined;
    setCheer(key);
    const timer = setTimeout(() => setCheer(null), AVATAR_HYPE_MS);
    return () => clearTimeout(timer);
  }, [key]);
  return cheer;
}

/**
 * Startled awake: an alert, or a face an action asks for, lands while it is
 * asleep — for a moment it jolts up with a "!" before it shows what woke it.
 * Only from sleep: an alert straight after another finds it already up.
 */
function useStartle(asleep: boolean, wakeKey: string | null) {
  const [startled, setStartled] = useState(false);
  const before = useRef<string | null>(null);
  useEffect(() => {
    const was = before.current;
    before.current = wakeKey;
    if (!wakeKey || was || !asleep) return undefined;
    setStartled(true);
    const timer = setTimeout(() => setStartled(false), AVATAR_STARTLE_MS);
    return () => { clearTimeout(timer); setStartled(false); };
  }, [wakeKey]);
  return startled;
}

/**
 * What it wears now: the layer's outfit and extras, with whatever viewers
 * put on it instead — their outfit, their hat in place of the layer's (none
 * takes it off) — unless the layer does not let them.
 */
export function avatarDressed(config: AvatarLayerConfig, dress?: { outfit?: string | null; hat?: string | null } | null, kit?: PixelAvatarDef | null) {
  const own = { costume: config.costume || '', extras: config.extras || [], dressed: false };
  if (config.dressable === false || !dress || (dress.outfit == null && dress.hat == null)) return own;
  // A pixel avatar of the tab's wears what viewers named only if it has one: its own outfits and hats.
  const hats = (kit ? pixelHats(kit) : AVATAR_HATS) as string[];
  const outfitOk = !kit || dress.outfit == null || dress.outfit === '' || Boolean(pixelOutfit(kit, dress.outfit));
  const hatOk = !kit || dress.hat == null || dress.hat === 'none' || hats.includes(dress.hat);
  if (!outfitOk && !hatOk) return own;
  const costume = outfitOk ? (dress.outfit ?? own.costume) : own.costume;
  const extras = dress.hat == null || !hatOk ? own.extras
    : [...own.extras.filter((e) => !hats.includes(e)), ...(dress.hat === 'none' ? [] : [dress.hat])];
  return { costume, extras, dressed: true };
}

/** What an alert brings to the face, or nothing: by kind, as the layer says. */
export function avatarReaction(config: AvatarLayerConfig, alertType?: string | null) {
  if (config.react === false || !alertType) return { kind: null, face: null };
  const kind = avatarReactionFor(alertType);
  if (!kind) return { kind: null, face: null };
  const face = config.reactions?.[kind] ?? (AVATAR_REACTION_DEFAULTS as Record<string, string>)[kind];
  return { kind, face: face && face !== 'none' ? face : null };
}

export const AvatarLayer = ({ config, voice, alert, accent, mic, asked, dress, acted, hypeTrain, self, layers = [], happenings = {}, kit = null }: {
  config: AvatarLayerConfig;
  /** The pixel avatar its config names, from the Pixel avatars tab; null draws the built-in one. */
  kit?: PixelAvatarDef | null;
  voice?: { members?: { id: string; speaking: boolean }[] };
  alert?: { id?: string; config?: { type?: string } } | null;
  accent?: string;
  mic?: { talking?: boolean; loud?: boolean; soft?: boolean } | null;
  /** A face an action asked for, for every avatar on screen. */
  asked?: { name?: string } | null;
  /** What viewers dressed every avatar in, for a few minutes. */
  dress?: { outfit?: string | null; hat?: string | null } | null;
  /** Something an action asked every avatar to do — drink water — by a key that changes each time. */
  acted?: { name: string; key: string } | null;
  /** Twitch's Hype Train, if one is running, to cheer on. */
  hypeTrain?: { active?: boolean; level?: number; startedAt?: number } | null;
  /** This layer's box and every layer's, to know which way things are. */
  self?: { x: number; y: number; width: number; height: number };
  layers?: { type: string; x: number; y: number; width: number; height: number; visible?: boolean }[];
  /** What last happened of each kind, by an id that changes when it happens again. */
  happenings?: Partial<Record<keyof typeof AVATAR_WATCHES, string | undefined>>;
}) => {
  const { glance: glanceAt, dizzy } = useGlances(config.watch !== false, self, layers, happenings, config.overwhelm !== false, config.overwhelmCount ?? AVATAR_OVERWHELM.count);
  const { speaking, loud, soft } = talkingNow(config.talkWith, voice, mic);
  const sleep = useDozing(speaking, config.talkWith ? (config.sleepAfter ?? 3) : 0);
  const resting = avatarRestingFace(config.expression || 'neutral', { asleep: sleep !== 'awake', deep: sleep === 'deep', speaking });
  const reacted = avatarReaction(config, alert?.config?.type);
  // An action's face wins over an alert's, and both over the layer's own.
  const forced = asked?.name && (kit ? pixelHasFace(kit, asked.name) : (AVATAR_EXPRESSIONS_LIST as string[]).includes(asked.name)) ? asked.name : null;
  const kind = reacted.kind;
  const loudFace = loud && config.loudFace && config.loudFace !== 'none' ? config.loudFace : null;
  // A Hype Train starting or going up a level: the layer's "hype" face, unless it pulls no faces.
  const cheer = useHypeCheer(config.react === false ? null : hypeTrain);
  const hypeChoice = config.reactions?.hype ?? (AVATAR_REACTION_DEFAULTS as Record<string, string>).hype;
  const hypeFace = cheer && hypeChoice && hypeChoice !== 'none' ? hypeChoice : null;

  /*
    What it is doing: whichever came last of something an action asked every
    avatar to do, and what this layer does as an alert of a kind lands or a
    Hype Train starts or levels up. Each by a key of its own, played once. An
    alert already up as the page opens is not played: it landed before.
  */
  const doesAt = (k: string | null) => { const a = k && config.react !== false ? config.reactionActions?.[k] : null; return a && a !== 'none' ? a : null; };
  const [doing, setDoing] = useState<{ name: string; key: string } | null>(acted ?? null);
  useEffect(() => { if (acted?.key) setDoing(acted); }, [acted?.key]);
  const alertAtOpen = useRef(alert?.id ?? null);
  useEffect(() => {
    if (!alert?.id || alert.id === alertAtOpen.current) return;
    alertAtOpen.current = null;
    const name = doesAt(reacted.kind);
    if (name) setDoing({ name, key: `alert:${alert.id}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.id]);
  useEffect(() => {
    const name = cheer ? doesAt('hype') : null;
    if (name) setDoing({ name, key: `hype:${cheer}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheer]);
  // An alert, an action's face or the train, landing while it sleeps, startles it awake first.
  const wakeKey = forced && !(AVATAR_SLEEP_FACES as string[]).includes(forced) ? `face:${forced}` : kind ? `alert:${alert?.id ?? kind}` : hypeFace ? `hype:${cheer}` : null;
  const startled = useStartle((AVATAR_SLEEP_FACES as string[]).includes(resting), wakeKey);
  // Too much at once beats an alert's face: it is what the pile-up did to it.
  const face = (startled ? 'startled' : null) || forced || (dizzy ? 'dizzy' : null) || reacted.face || hypeFace || loudFace;
  const colouring = config.colouring || 'layout';
  const colours = useMemo(() => (kit ? pixelColours(kit, colouring, { accent, own: config.ownColour }) : avatarColours(colouring, { accent, own: config.ownColour })), [kit, colouring, accent, config.ownColour]);
  const label = (config.label || '').trim();
  const worn = avatarDressed(config, dress, kit);
  // Room above it for its tallest hat: the built-in one's, or the one its pixel avatar has.
  const headroom = kit ? pixelHeadroom(kit) as number : AVATAR_HEADROOM;
  // Eyes it can find glance about; one that turns looks about by turning. Neither, and there is nothing to glance with.
  const canGlance = !kit || Boolean(kit.eyes) || Boolean(pixelTurns(kit));

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center" data-avatar="frame"
      data-avatar-expression={face || config.expression || 'neutral'}
      data-avatar-talking={speaking ? 'true' : 'false'}
      data-avatar-reacting={kind || 'none'}
      data-avatar-dressed={worn.dressed ? 'true' : 'false'}
      data-avatar-sleep={(face || resting) === 'deep-sleep' ? 'deep' : (face || resting) === 'sleepy' ? 'dozing' : 'awake'}
      data-avatar-kit={kit?.id || undefined}
      style={{ containerType: 'size' }}
    >
      {/*
        Room is kept under it for its text. A look that puts the text over the
        box instead gives that room back with --avatar-size. The box is a
        little taller than wide: the drawing has rows above it for a hat.
      */}
      <div
        className="shrink-0"
        style={{ width: `var(--avatar-size, ${label ? `min(100cqw, calc(82cqh * 100 / ${100 + headroom}))` : `min(100cqw, calc(100cqh * 100 / ${100 + headroom}))`})`, aspectRatio: `100 / ${100 + headroom}` }}
      >
        <LivingAvatar
          expression={resting} reaction={face} extras={worn.extras} colours={colours} costume={worn.costume} glance={config.glance !== false && canGlance} twinkle={config.twinkle !== false && (!kit || Boolean(kit.eyes))}
          glanceAt={glanceAt} action={doing} kit={kit}
          speaking={speaking} loud={loud} soft={soft} blink={config.blink !== false} hop={config.hop !== false} shake={config.shake !== false} breathe={config.breathe !== false}
        />
      </div>
      {label && (
        <span
          className="max-w-full truncate font-black uppercase tracking-widest leading-none text-white" data-avatar="label"
          style={{ fontSize: 'min(7cqh, 10cqw)', marginTop: '3cqh' }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
