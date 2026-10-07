/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A box, a circle, or a line.
 *
 * Nothing here comes from the server and nothing about it is live — which is
 * exactly the point. Every other overlay draws something the app knows; this
 * draws the panel that overlay sits on, the rule under a heading, the bar
 * behind a name. Without it, a background for the chat box means opening an
 * image editor, exporting a PNG, uploading it, and doing the whole thing again
 * to change one colour.
 *
 * It is deliberately small. Rotation, opacity, blend mode, blur and drop
 * shadow already belong to every layer, so a diagonal stripe is a line that
 * has been rotated, and a glow is a shadow with no offset. Adding those here
 * would be a second way to do what the layer already does.
 */
import React from 'react';

export interface ShapeLayerConfig {
  kind?: 'rect' | 'ellipse' | 'line';
  fill?: string;
  /** A second colour turns the fill into a two-stop gradient. */
  gradient?: boolean;
  fillTo?: string;
  angle?: number;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
  /** A line's thickness. The layer's own height is the space it may use. */
  thickness?: number;
}

/*
  data-shape names the drawn element, because :scope is the layer around it
  and the shape sits inside with its fill written inline. A stylesheet aiming
  at :scope paints behind the shape and is never seen.
*/
export const ShapeLayer = ({ config }: { config: ShapeLayerConfig }) => {
  const kind = config.kind || 'rect';

  const background = config.gradient
    ? `linear-gradient(${config.angle ?? 90}deg, ${config.fill || 'var(--overlay-accent, #f43f5e)'}, ${config.fillTo || '#09090b'})`
    : (config.fill || 'var(--overlay-accent, #f43f5e)');

  if (kind === 'line') {
    /*
      A line is its own shape rather than a very short box, because keeping the
      thickness separate from the layer's height means the line stays where it
      is when the box around it is resized — and a line you have to resize in
      two directions to move is not a line, it is a rectangle.
    */
    return (
      <div className="w-full h-full flex items-center" data-shape="box">
        <div
          className="w-full" data-shape="rule"
          style={{
            height: `${Math.max(1, config.thickness ?? 4)}px`,
            background,
            borderRadius: config.radius ? `${config.radius}px` : undefined,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full" data-shape="box"
      style={{
        background,
        // A circle is a box whose corners have been rounded all the way.
        borderRadius: kind === 'ellipse' ? '50%' : (config.radius ? `${config.radius}px` : undefined),
        border: config.borderWidth ? `${config.borderWidth}px solid ${config.borderColor || '#ffffff'}` : undefined,
        // The border sits inside, so a bordered box stays the size it was given.
        boxSizing: 'border-box',
      }}
    />
  );
};
