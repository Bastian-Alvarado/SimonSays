/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A layout's own stylesheet.
 *
 * The escape hatch. Everything else on a canvas is a control with a name, and
 * this is for the look somebody has in mind that no control covers — a
 * texture, a mask, a gradient border, an animation nobody thought to offer.
 *
 * It is scoped to the stage. The editor draws the same canvas inside the rest
 * of the app, so a rule as ordinary as `div { opacity: 0.5 }` would otherwise
 * reach the sidebar, the layer list and the button you need to undo it with.
 * Scoping also means the preview and the stream agree, which is the whole
 * premise of the preview being the real thing.
 *
 * One consequence worth knowing, since it is not obvious: inside a scope the
 * root is named by :scope. A bare `.canvas-stage` matches descendants of the
 * canvas but not the canvas itself, so the editor offers :scope instead —
 * measured, not assumed.
 *
 * Where @scope is unavailable the stylesheet is applied unscoped on the
 * standalone canvas — that page is nothing but the overlay, so there is
 * nothing else for it to reach — and not applied in the editor at all, which
 * is said on screen rather than left as a mystery.
 */
import React from 'react';

/** Chromium 118+. The canvas is a browser source, so in practice: yes. */
export const canScopeStyles = typeof window !== 'undefined' && typeof (window as any).CSSScopeRule !== 'undefined';

export const LayoutStyle = ({ css, inEditor }: { css?: string; inEditor?: boolean }) => {
  /*
    Never empty, for the reason written on ScopedStyle: emptying a stylesheet
    leaves its rules applied to what they had already matched, so clearing
    this box would leave every open browser source showing the old canvas
    until it was refreshed. Written as a rule that does nothing instead.
  */
  const text = (css || '').trim() || '.canvas-stage { --canvas-css: none }';
  if (!canScopeStyles && inEditor) return null;

  /*
    Indented into the block rather than concatenated flat, only so that a
    stylesheet read out of the page source still looks like one.
  */
  const scoped = canScopeStyles
    ? `@scope (.canvas-stage) {\n${text}\n}`
    : text;

  return <style>{scoped}</style>;
};
