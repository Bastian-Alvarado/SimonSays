/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * One picture, or several on a rotation.
 *
 * The plainest layer there is, and the one that makes uploaded artwork usable:
 * a logo in the corner, a frame around the canvas, a set of sponsor marks
 * taking turns. Games Done Quick's bundles have a sponsors component that does
 * the rotating half of this; the single-image case matters just as much here,
 * because a border drawn once is most of what a layout is made of.
 *
 * Every image is mounted at once and cross-faded by opacity rather than
 * swapping one `src`. Swapping means the browser fetches the next picture at
 * the moment it has to appear, so the first pass through a rotation flickers
 * on a cold cache — on stream, where it is least forgivable.
 */
import React, { useEffect, useState } from 'react';

export interface ImageLayerConfig {
  sources?: string[];
  seconds?: number;
  fit?: 'contain' | 'cover' | 'fill';
  transition?: 'fade' | 'none';
  random?: boolean;
}

export const ImageLayer = ({ config }: { config: ImageLayerConfig }) => {
  const sources = (config.sources || []).filter(Boolean);
  const seconds = Math.max(1, config.seconds ?? 8);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // One picture never rotates, and a timer for it would tick for the whole
    // stream to change nothing.
    if (sources.length < 2) return undefined;
    const id = setInterval(() => {
      setIndex((i) => {
        if (!config.random) return (i + 1) % sources.length;
        // Never the same one twice in a row: with two or three pictures a
        // plain random pick repeats often enough to look broken.
        if (sources.length < 3) return (i + 1) % sources.length;
        let next = i;
        while (next === i) next = Math.floor(Math.random() * sources.length);
        return next;
      });
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [sources.length, seconds, config.random]);

  // Nothing chosen yet. An empty layer draws nothing rather than a grey box.
  if (!sources.length) return null;

  const fade = config.transition !== 'none';

  return (
    /*
      data-images names the frame the pictures sit in and each picture, so a
      look can put a panel behind them and hold them off its edges — the one
      thing a picture layer needs from a theme. The picture on show says so.
    */
    <div className="w-full h-full relative overflow-hidden" data-images="frame">
      {sources.map((src, i) => (
        <img
          key={src + i}
          src={src}
          alt=""
          data-images="picture"
          data-images-showing={i === index % sources.length ? 'yes' : undefined}
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: config.fit || 'contain',
            opacity: i === index % sources.length ? 1 : 0,
            transition: fade ? 'opacity 600ms ease-in-out' : undefined,
          }}
        />
      ))}
    </div>
  );
};
