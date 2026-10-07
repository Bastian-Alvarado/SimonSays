/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The pixel avatar, drawn: a face, whatever it is wearing, in whatever
 * colours. What it looks like lives in shared/avatar.js and avatar-art.js;
 * this only turns it into an SVG.
 *
 * Every part is filled from --avatar-<part>, falling back to the colour it
 * was given, so a stylesheet can repaint any part of it:
 *
 *   :scope { --avatar-<part id>: #22c55e; }
 *
 * The drawing is in three groups — data-avatar="body", "head" and "carried" —
 * so the head and body can each move by whole pixels while it breathes and
 * turns; a part can therefore be drawn as a path in more than one of them.
 */
import React, { useMemo } from 'react';
import { AVATAR_PARTS, avatarBubblePaths, avatarGrid, avatarPaths, avatarSplit, avatarHatWorn, avatarHatPaths, AVATAR_OVER_HAT, AVATAR_HEADROOM, AVATAR_REGULARS, avatarRegularParts, avatarMouthOpen } from '../../shared/avatar.js';

/**
 * How the head and body sit this moment, in whole pixels of the drawing:
 * the shoulders and the head each up a pixel or not (breathing), and the
 * head turned a pixel left and nodded a pixel down (following the eyes).
 */
export interface AvatarPose {
  bodyUp?: number;
  headUp?: number;
  turnX?: number;
  turnY?: number;
}

interface Props {
  /** One face, or several laid one over the next. */
  faces?: string | string[];
  extras?: string[];
  /** Colours by part, for the parts that differ from the drawing. */
  colours?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  /** Only part of the grid, as a viewBox — the face alone, for a thumbnail. */
  crop?: string;
  /** An outfit other than the one it was drawn in: a key of AVATAR_COSTUMES. */
  costume?: string;
  /** Where the resting eyes look, how big the sparkle is, and whether they are half shut. */
  eyes?: { look?: string; sparkle?: string; half?: boolean };
  /** Fast asleep, the size of the bubble at its nose now: 1 the smallest, 0 none. */
  bubble?: number;
  /** Breathing and turning; still when left out. */
  pose?: AvatarPose;
  /**
   * A regular's own drawing in place of the avatar (shared/avatar-regulars.js):
   * its own colours, its mouth open whenever the faces talk, rising as the
   * shoulders do. Outfits, hats, colours and the avatar's other faces are
   * the avatar's, and do not apply to it.
   */
  drawing?: string;
  /** Which way that drawing faces, if it turns: your left as drawn, the front, or your right. */
  facing?: 'left' | 'front' | 'right';
  /** A frame of something it does — drinking — over everything else (shared/avatar-actions.js). */
  action?: { name: string; frame: number } | null;
}

export const PixelAvatar = ({ faces = 'neutral', extras = [], colours = {}, className, style, crop, costume = '', eyes, bubble = 0, pose, drawing = '', facing = 'left', action = null }: Props) => {
  const faceKey = ([] as string[]).concat(faces).join('+');
  const regular = Boolean(drawing && (AVATAR_REGULARS as Record<string, unknown>)[drawing]);
  const talking = avatarMouthOpen(faceKey.split('+'));
  // Its eyelids follow the avatar's blink: half on the way in and out, shut at its middle.
  const lid = faceKey.split('+').includes('blink') ? 'shut' : eyes?.half ? 'half' : 'open';
  const regularParts = useMemo(
    () => (regular ? avatarRegularParts(drawing, { talking, lid, facing }) as { head: Record<string, string>; body: Record<string, string> } : null),
    [regular, drawing, talking, lid, facing],
  );
  const extraKey = extras.join('+');
  const eyeKey = eyes ? `${eyes.look || ''}|${eyes.sparkle || ''}|${eyes.half ? 1 : 0}` : '';
  const actionKey = action ? `${action.name}:${action.frame}` : '';
  /*
    Three groups rather than one: the body, the head, and what the body
    carries, so each can move by whole pixels of its own. At rest they add up
    to the drawing exactly — every cell is in one of them and only one.
  */
  const groups = useMemo((): Record<'body' | 'head' | 'carried', Record<string, string>> => {
    const split = avatarSplit(avatarGrid(faceKey.split('+'), extraKey ? extraKey.split('+') : [], costume, eyes, action));
    const paths = (grid: string[]) => avatarPaths(grid) as Record<string, string>;
    return { body: paths(split.body), head: paths(split.head), carried: paths(split.carried) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceKey, extraKey, costume, eyeKey, actionKey]);
  // Fast asleep: bigger z's drifting further off, and the bubble over the face, which shows through it.
  const deep = faceKey.split('+').includes('deep-sleep');
  const bubblePaths = useMemo(() => avatarBubblePaths(deep ? bubble : 0), [deep, bubble]);
  const fill = (p: { id: string; color: string; opacity?: number }) => ({
    fill: `var(--avatar-${p.id}, ${colours[p.id] || p.color})`, ...(p.opacity ? { fillOpacity: p.opacity } : {}),
  });
  /*
    A drawn hat: a picture of its own over the head, at its own pixel size,
    moving with the head. The marks that float by the head go over it.
  */
  const hat = avatarHatWorn(extras, costume);
  const hatPaths = useMemo(() => (hat ? avatarHatPaths(hat) as Record<string, string> : {}), [hat]);
  const overHat = (id: string) => (AVATAR_OVER_HAT as string[]).includes(id);
  const draw = (paths: Record<string, string>, group: string, which: (id: string) => boolean = () => true) => AVATAR_PARTS.filter((p) => paths[p.id] && which(p.id)).map((p) => (
    <path
      key={`${group}-${p.id}`} d={paths[p.id]} data-avatar-part={p.id}
      style={{
        ...fill(p),
        ...(p.id === 'sueno' ? { animation: deep ? 'simonsaysAvatarZDeep 2.4s ease-in infinite' : 'simonsaysAvatarZ 2.6s ease-in-out infinite' } : {}),
        // The startle's "!" pops up from its foot.
        ...(p.id === 'susto' ? { animation: 'simonsaysAvatarBang 0.5s ease-out both', transformBox: 'fill-box', transformOrigin: '50% 100%' } : {}),
      }}
    />
  ));
  // Whole pixels only: in the drawing's own units, so a pixel of the art moves by exactly a pixel of the art.
  const bodyAt = `translate(0 ${-(pose?.bodyUp || 0)})`;
  const headAt = `translate(${pose?.turnX || 0} ${(pose?.turnY || 0) - (pose?.headUp || 0)})`;
  if (regularParts) {
    const draw = (paths: Record<string, string>, part: string) => Object.entries(paths).map(([colour, d]) => <path key={`${part}-${colour}`} d={d} fill={colour} />);
    return (
      <svg
        viewBox={crop || `0 ${-AVATAR_HEADROOM} 100 ${100 + AVATAR_HEADROOM}`} shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet"
        className={className} style={{ display: 'block', width: '100%', height: '100%', ...style }}
        data-avatar="svg" data-avatar-drawing={drawing} data-avatar-mouth={talking ? 'open' : 'shut'} data-avatar-lid={lid} data-avatar-facing={facing}
      >
        {/*
          Breathing as the avatar does: the lower part rises first, over the
          top row of the upper part, and the upper part follows. It turns as
          a whole, from one view to another, rather than a head on a body.
        */}
        <g transform={bodyAt} data-avatar="body">{draw(regularParts.body, 'body')}</g>
        <g transform={`translate(0 ${-(pose?.headUp || 0)})`} data-avatar="head">{draw(regularParts.head, 'head')}</g>
      </svg>
    );
  }
  return (
    <svg
      // Room above the drawing for a hat that rises past its top — the same room whatever it wears, so putting a hat on never moves it.
      viewBox={crop || `0 ${-AVATAR_HEADROOM} 100 ${100 + AVATAR_HEADROOM}`} shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet"
      className={className} style={{ display: 'block', width: '100%', height: '100%', ...style }}
      data-avatar="svg" data-avatar-action={action ? `${action.name}:${action.frame + 1}` : undefined}
    >
      <g transform={bodyAt} data-avatar="body">{draw(groups.body, 'body')}</g>
      <g transform={headAt} data-avatar="head">
        {draw(groups.head, 'head', (id) => !overHat(id))}
        {hat && (
          <g data-avatar="hat" data-avatar-hat={hat}>
            {Object.entries(hatPaths).map(([colour, d]) => <path key={colour} d={d} fill={colour} />)}
          </g>
        )}
        {draw(groups.head, 'over', overHat)}
        {AVATAR_PARTS.filter((p) => bubblePaths[p.id]).map((p) => (
          <path key={`bubble-${p.id}`} d={bubblePaths[p.id]} data-avatar-part={p.id} data-avatar-bubble="" style={fill(p)} />
        ))}
      </g>
      <g transform={bodyAt} data-avatar="carried">{draw(groups.carried, 'carried')}</g>
    </svg>
  );
};
