/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * One layer's own stylesheet.
 *
 * The layout has one too, and it can already reach a layer by id. This exists
 * because that id is the copy's undoing: duplicating a layer mints a new one,
 * so a rule written against the old id goes on styling the original and leaves
 * the copy plain. Held on the layer, the rules are part of it, and a duplicate
 * brings them along.
 *
 * The scoping is the trick. A `<style>` placed inside an element, containing
 * `@scope` with nothing in front of it, scopes to that element — so the rules
 * need no selector naming the layer, which is exactly why they survive being
 * copied. `:scope` means this layer, and nothing written here can reach
 * another one.
 *
 * Verified in the browser rather than assumed: pseudo-elements on `:scope`
 * work, and `@keyframes` declared inside the scope register and run, so an
 * animation nobody offered can be written here.
 */
import React from 'react';
import { ScopedStyle } from './ScopedStyle';

export const LayerStyle = ({ css, motionCss, vars }: { css?: string; motionCss?: string; vars?: Record<string, string> }) => (
  <ScopedStyle css={css} motionCss={motionCss} vars={vars} />
);
