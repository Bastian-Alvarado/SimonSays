/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A stylesheet scoped to the thing it is written inside.
 *
 * A `<style>` placed inside an element, containing `@scope` with nothing in
 * front of it, scopes to that element — so the rules need no selector naming
 * it, which is what lets them survive being copied. `:scope` means that
 * element, and nothing written can reach anything outside it.
 *
 * One implementation for the three things that have a box: a layer, an alert,
 * and the chat. They had a copy each, which was three places for the rule
 * below to be got wrong independently.
 *
 * Two boxes, one scope, and the motion written last. They are kept apart so
 * that dropping a look onto something cannot take its animation with it — but
 * they style the same element, so where both speak about one property the one
 * you would expect to win is the motion. One element rather than two, so a
 * keyframe declared in the look is visible to the motion.
 */
import React from 'react';
import { canScopeStyles } from './LayoutStyle';
import { readFields, varsRule } from '../../shared/css-fields.js';

/**
 * What to write when there is nothing to write.
 *
 * Measured, not guessed: emptying a scoped stylesheet leaves its rules applied
 * to whatever they had already matched. A chat kept the styling of a sheet that
 * was no longer anywhere in the document — four seconds and a forced layout
 * later, with nothing left in the CSSOM to explain it — and unmounting the
 * element does the same. Editing one, on the other hand, correctly drops the
 * rules it no longer has.
 *
 * So it is always an edit. With nothing to apply it writes a rule that does
 * nothing, which is a change like any other and takes the old ones with it.
 * Without this, clearing a box left every browser source already open showing
 * the old look until somebody refreshed it — which on stream is the middle of
 * the stream.
 */
const NOTHING = ':scope { --scoped-css: none }';

/**
 * The two boxes, and then whatever the controls beside them have been set to.
 *
 * Last, and on the same selector the value was declared on, so it is the later
 * of two declarations of equal weight and wins on order alone. Not !important:
 * a sheet that really means a value should still be able to say so, and a
 * control nobody could overrule would be a poor kind of control.
 */
export const scopedText = (css?: string, motionCss?: string, vars?: Record<string, string>) => {
  const written = [(css || '').trim(), (motionCss || '').trim()].filter(Boolean).join('\n\n');
  const set = vars && Object.keys(vars).length
    ? varsRule(readFields(css, motionCss), vars)
    : '';
  return [written, set].filter(Boolean).join('\n\n');
};

export const ScopedStyle = ({ css, motionCss, vars }: { css?: string; motionCss?: string; vars?: Record<string, string> }) => {
  /*
    No @scope, no stylesheet at all. Unlike the layout's, these cannot fall
    back to applying unscoped: every rule is written on the assumption that
    `:scope` is the thing it was typed into, so unscoped it would either do
    nothing or style the whole page. Nothing is the safer of the two.
  */
  if (!canScopeStyles) return null;
  return <style>{`@scope {\n${scopedText(css, motionCss, vars) || NOTHING}\n}`}</style>;
};
