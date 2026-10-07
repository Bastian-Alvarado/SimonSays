/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A pixel avatar made in the Pixel avatars tab, drawn: what PixelAvatar is
 * for the built-in one, for any of them (shared/pixel-avatars.js says what
 * each looks like; this only turns it into an SVG).
 *
 * Drawn the same way, so a look dresses both alike: every part filled from
 * --avatar-<part>, falling back to its colour; the drawing in three groups —
 * data-avatar="body", "head" and "carried" — that move by whole pixels as it
 * breathes and turns; a drawn hat in data-avatar="hat" between the head and
 * the marks that float over it.
 */
import React, { useMemo } from 'react';
import { pixelGrid, pixelSplit, pixelPaths, pixelHatWorn, pixelHatPaths, pixelHeadroom, pixelBubblePaths } from '../../shared/pixel-avatars.js';
import type { AvatarPose } from './PixelAvatar';
import type { PixelAvatarDef } from '../types';

interface Props {
  kit: PixelAvatarDef;
  /** One face, or several laid one over the next. */
  faces?: string | string[];
  extras?: string[];
  /** Colours by part, for the parts that differ from the drawing. */
  colours?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  /** Only part of the grid, as a viewBox. */
  crop?: string;
  /** An outfit other than the one it was drawn in. */
  outfit?: string;
  /** Where the resting eyes look, how big the sparkle is, and whether they are half shut. */
  eyes?: { look?: string; sparkle?: string; half?: boolean };
  /** Fast asleep, the size of the bubble at its nose now: 1 the smallest, 0 none. */
  bubble?: number;
  /** Breathing and turning; still when left out. */
  pose?: AvatarPose;
  /** For one that turns: its front view, or facing your left or right. Left out, as drawn. */
  facing?: 'left' | 'front' | 'right' | null;
  /** A frame of something it does, over everything else. */
  action?: { name: string; frame: number } | null;
}

export const PixelKitAvatar = ({ kit, faces = 'neutral', extras = [], colours = {}, className, style, crop, outfit = '', eyes, bubble = 0, pose, facing = null, action = null }: Props) => {
  const faceKey = ([] as string[]).concat(faces).join('+');
  const extraKey = extras.join('+');
  const eyeKey = eyes ? `${eyes.look || ''}|${eyes.sparkle || ''}|${eyes.half ? 1 : 0}` : '';
  const actionKey = action ? `${action.name}:${action.frame}` : '';
  const groups = useMemo((): Record<'body' | 'head' | 'carried', Record<string, string>> => {
    const grid = pixelGrid(kit, { faces: faceKey.split('+'), extras: extraKey ? extraKey.split('+') : [], outfit, eyes, action, facing }) as string[];
    const split = pixelSplit(kit, grid, { facing }) as Record<'body' | 'head' | 'carried', string[]>;
    const paths = (rows: string[]) => pixelPaths(kit, rows) as Record<string, string>;
    return { body: paths(split.body), head: paths(split.head), carried: paths(split.carried) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit, faceKey, extraKey, outfit, eyeKey, actionKey, facing]);
  const deep = faceKey.split('+').includes('deep-sleep');
  const bubblePaths = useMemo(() => pixelBubblePaths(kit, deep ? bubble : 0) as Record<string, string>, [kit, deep, bubble]);
  const headroom = useMemo(() => pixelHeadroom(kit) as number, [kit]);
  const hat = facing === 'front' ? null : pixelHatWorn(kit, extras, outfit) as string | null;
  const hatPaths = useMemo(() => (hat ? pixelHatPaths(kit, hat) as Record<string, string> : {}), [kit, hat]);
  const overHat = useMemo(() => new Set(kit.overHat || []), [kit]);
  const fill = (p: { id: string; color: string; opacity?: number }) => ({
    fill: `var(--avatar-${p.id}, ${colours[p.id] || p.color})`, ...(p.opacity ? { fillOpacity: p.opacity } : {}),
  });
  const draw = (paths: Record<string, string>, group: string, which: (id: string) => boolean = () => true) => kit.parts.filter((p) => paths[p.id] && which(p.id)).map((p) => (
    <path
      key={`${group}-${p.id}`} d={paths[p.id]} data-avatar-part={p.id}
      style={{
        ...fill(p),
        ...(p.effect === 'float' ? { animation: deep ? 'simonsaysAvatarZDeep 2.4s ease-in infinite' : 'simonsaysAvatarZ 2.6s ease-in-out infinite' } : {}),
        ...(p.effect === 'pop' ? { animation: 'simonsaysAvatarBang 0.5s ease-out both', transformBox: 'fill-box', transformOrigin: '50% 100%' } : {}),
      }}
    />
  ));
  const bodyAt = `translate(0 ${-(pose?.bodyUp || 0)})`;
  // A head that does not follow the eyes only rises and settles with the breath.
  const headAt = kit.split?.follow === false
    ? `translate(0 ${-(pose?.headUp || 0)})`
    : `translate(${pose?.turnX || 0} ${(pose?.turnY || 0) - (pose?.headUp || 0)})`;
  return (
    <svg
      viewBox={crop || `0 ${-headroom} 100 ${100 + headroom}`} shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet"
      className={className} style={{ display: 'block', width: '100%', height: '100%', ...style }}
      data-avatar="svg" data-avatar-kit={kit.id} data-avatar-action={action ? `${action.name}:${action.frame + 1}` : undefined}
      data-avatar-facing={facing || undefined}
    >
      <g transform={bodyAt} data-avatar="body">{draw(groups.body, 'body')}</g>
      <g transform={headAt} data-avatar="head">
        {draw(groups.head, 'head', (id) => !overHat.has(id))}
        {hat && (
          <g data-avatar="hat" data-avatar-hat={hat}>
            {Object.entries(hatPaths).map(([colour, d]) => <path key={colour} d={d} fill={colour} />)}
          </g>
        )}
        {draw(groups.head, 'over', (id) => overHat.has(id))}
        {kit.parts.filter((p) => bubblePaths[p.id]).map((p) => (
          <path key={`bubble-${p.id}`} d={bubblePaths[p.id]} data-avatar-part={p.id} data-avatar-bubble="" style={fill(p)} />
        ))}
      </g>
      <g transform={bodyAt} data-avatar="carried">{draw(groups.carried, 'carried')}</g>
    </svg>
  );
};
