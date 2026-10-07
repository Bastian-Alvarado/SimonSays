/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A PNGtuber of your own pictures: one while you are quiet, one while you
 * talk, and the same two with the eyes shut for blinking. Talking comes from
 * your microphone in OBS (engine/pngtuber.js), or from somebody in the
 * Discord call. It hops while you talk and shakes while you are loud.
 *
 * Sets of pictures by name are faces: an action asking for "happy" shows
 * the set called happy, on every PNGtuber layer that has one, for as long
 * as the action said.
 *
 * Every picture it might need is loaded up front and stacked, with only the
 * one for now showing, so a swap is a change of opacity and never a picture
 * still on its way. Parts: data-pngtuber="frame", "figure", "picture"; the
 * frame says data-pngtuber-talking, -loud and -face.
 */
import React, { useEffect, useState } from 'react';
import { AVATAR_KEYFRAMES, talkingNow } from './AvatarLayer';

export interface PngtuberFrames { idle?: string; talking?: string; blink?: string; blinkTalking?: string }
export interface PngtuberExpression { name: string; idle?: string; talking?: string }

export interface PngtuberLayerConfig {
  frames?: PngtuberFrames;
  expressions?: PngtuberExpression[];
  talkWith?: { id: string; name: string } | null;
  blinks?: boolean;
  hop?: boolean;
  shake?: boolean;
  /** One of its faces, shown while you are loud. */
  loudFace?: string;
  dimQuiet?: boolean;
}

/**
 * Which picture to show now. A face's pictures stand in for the idle and
 * talking ones; a missing talking picture falls back to the quiet one; the
 * blinking ones only exist for the layer's own face.
 */
export function pngtuberPicture(config: PngtuberLayerConfig, { speaking = false, blinking = false, face = null as string | null } = {}) {
  const f = config.frames || {};
  const set = face ? (config.expressions || []).find((e) => e.name === face) : null;
  const idle = set?.idle || set?.talking || f.idle || f.talking || '';
  const talking = set?.talking || (set ? idle : f.talking) || idle;
  if (set) return speaking ? talking : idle;
  if (blinking && config.blinks !== false) {
    const shut = speaking ? (f.blinkTalking || f.blink) : f.blink;
    if (shut) return shut;
  }
  return speaking ? talking : idle;
}

/** Every picture the layer could show, to load them all at once. */
export function pngtuberPictures(config: PngtuberLayerConfig) {
  const f = config.frames || {};
  return [...new Set([f.idle, f.talking, f.blink, f.blinkTalking, ...(config.expressions || []).flatMap((e) => [e.idle, e.talking])].filter(Boolean) as string[])];
}

export const PngtuberLayer = ({ config, voice, mic, asked }: {
  config: PngtuberLayerConfig;
  voice?: { members?: { id: string; speaking: boolean }[] };
  mic?: { talking?: boolean; loud?: boolean } | null;
  asked?: { name?: string } | null;
}) => {
  const { speaking, loud } = talkingNow(config.talkWith ?? { id: 'mic' }, voice, mic);
  const has = (name?: string | null) => Boolean(name) && (config.expressions || []).some((e) => e.name === name);
  // An action's face first, then the loud one.
  const face = has(asked?.name) ? asked!.name! : loud && has(config.loudFace) ? config.loudFace! : null;
  const [blinking, setBlinking] = useState(false);
  const canBlink = config.blinks !== false && Boolean(config.frames?.blink);

  useEffect(() => {
    if (!canBlink) { setBlinking(false); return undefined; }
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        timer = setTimeout(() => { setBlinking(false); next(); }, 140);
      }, 2200 + Math.random() * 3800);
    };
    next();
    return () => clearTimeout(timer);
  }, [canBlink]);

  const all = pngtuberPictures(config);
  if (!all.length) return null;
  const now = pngtuberPicture(config, { speaking, blinking, face });

  return (
    <div
      className="w-full h-full" data-pngtuber="frame"
      data-pngtuber-talking={speaking ? 'true' : 'false'}
      data-pngtuber-loud={loud ? 'true' : 'false'}
      data-pngtuber-face={face || 'none'}
      style={{ opacity: config.dimQuiet && !speaking ? 0.6 : 1, transition: speaking ? 'opacity 40ms linear' : 'opacity 200ms ease-out' }}
    >
      <style>{AVATAR_KEYFRAMES}</style>
      <div
        className="relative w-full h-full" data-pngtuber="figure"
        style={{
          animation: config.shake !== false && loud ? 'simonsaysAvatarShake 0.12s linear infinite'
            : config.hop !== false && speaking ? 'simonsaysAvatarHop 0.24s ease-in-out infinite alternate' : undefined,
        }}
      >
        {all.map((src) => (
          <img
            key={src} src={src} alt="" data-pngtuber="picture"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ opacity: src === now ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  );
};
