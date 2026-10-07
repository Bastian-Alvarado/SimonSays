/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Free text on the canvas, with live values in it.
 *
 * Every other layer draws one particular thing. This one draws whatever is
 * typed into it, and fills in values as they change: follower counts, who
 * subscribed last, what is playing, what the stream is doing next. It is the
 * difference between an overlay and a picture of an overlay — a PNG can be
 * made better in an image editor, but it cannot say "140 seguidores".
 *
 * Re-rendered on a timer as well as on state, because two of the values it can
 * show — the clock and the date — change without anything in the app changing.
 */
import React, { useEffect, useState } from 'react';
import { fillTemplate } from '../../shared/overlay-vars.js';

export interface TextLayerConfig {
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  italic?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
  /** Settings stored with empty as automatic — the look's — rather than as the default in full (see the server's normaliseTextLayer). */
  settingsVersion?: number;
}

/** The same eight-way shadow the chat outline uses, for the same reason. */
const outlineShadow = (width: number, colour: string) => {
  if (!width) return undefined;
  const ring = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  return ring.map(([x, y]) => `${x * width}px ${y * width}px 0 ${colour}`).join(', ');
};

/*
  data-text names the two things there are: the box that decides where the
  words sit in the layer, and the words themselves.

  Everything about how the words look is written inline from the controls, so
  a stylesheet overriding one of those says !important — the same bargain the
  other layers make.
*/
export const TextLayer = ({ config, state }: { config: TextLayerConfig; state: any }) => {
  /*
    A tick, only for the values that move on their own.

    Every other variable arrives as a state change and re-renders anyway; the
    clock does not. Once a second is enough for a display showing hours and
    minutes, and cheap enough not to matter next to what else is on a canvas.
  */
  const [, tick] = useState(0);
  const usesClock = /\{(time|date)\}/.test(config.text || '');
  useEffect(() => {
    if (!usesClock) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [usesClock]);

  const filled = fillTemplate(config.text || '', state);
  if (!filled.trim()) return null;

  const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[config.verticalAlign || 'middle'];

  return (
    <div
      className="w-full h-full flex flex-col" data-text="box"
      style={{
        justifyContent: justify,
        alignItems: config.align === 'right' ? 'flex-end' : config.align === 'center' ? 'center' : 'flex-start',
        textAlign: config.align || 'left',
      }}
    >
      {/*
        Newlines are kept: somebody writing three lines into the box means
        three lines, and making them build it out of three layers instead
        would be the app being awkward for no reason.
      */}
      {/*
        What the panel is set to is written here, on the element, and so beats
        any look — but only what it is set to. A colour left automatic is not
        written at all: the look's colour shows, or the class's white without
        one. Likewise the font, capitals and outline, which are only written
        when chosen. (A look's rule is closer to this element than the class,
        so it wins over the class without needing !important.)
      */}
      <div
        className="w-full break-words text-white" data-text="words"
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: config.fontFamily || undefined,
          fontSize: config.fontSize ? `${config.fontSize}px` : undefined,
          fontWeight: config.fontWeight || undefined,
          fontStyle: config.italic ? 'italic' : undefined,
          color: config.color || undefined,
          lineHeight: config.lineHeight || undefined,
          letterSpacing: config.letterSpacing ? `${config.letterSpacing}px` : undefined,
          textTransform: config.uppercase ? 'uppercase' : undefined,
          textShadow: outlineShadow(config.outlineWidth || 0, config.outlineColor || '#000000'),
        }}
      >
        {filled}
      </div>
    </div>
  );
};
