/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Making a stylesheet somebody typed safe to put on a page.
 *
 * Not parsed, and deliberately so. These boxes are the escape hatch for the
 * things the controls do not cover, and a validator that understood CSS would
 * be a validator that refused whatever it had not been taught — which is the
 * opposite of what an escape hatch is for. The overlay is the same person's
 * own page, and bad CSS there shows up immediately and is edited back.
 *
 * The one thing removed is a closing style tag. This reaches the page inside
 * a <style> element, and that sequence would end the element early and let the
 * rest be parsed as markup — which is a different thing from styling an
 * overlay, and not one anybody typed a stylesheet expecting.
 *
 * Shared rather than copied, because it is the only thing standing between a
 * text box and the page, and a second copy is the one that gets forgotten
 * when the rule changes.
 */

/**
 * How long any one stylesheet box may be: a layer's look or its motion, an
 * alert's, the chat's, or a whole canvas's.
 *
 * These used to differ — 2500 for a layer, 4000 for the rest — on the grounds
 * that a layout can hold forty layers and every layer's stylesheet travels in
 * the config each page receives on connect and again on every save. Measured
 * on a real streaming setup that reasoning had nothing left to protect: the
 * biggest layer stylesheet across nine layouts was 1242 characters, and all
 * the CSS in all of them came to 75 KB of a 271 KB file. A cap is a ceiling,
 * not space set aside, so a higher one costs nothing until somebody actually
 * writes that much, and then it costs it once, over the local network.
 *
 * What the low cap did cost was the end of a long stylesheet, cut off without
 * a word — at 2000 the shipped alert motion lost the rule where the name
 * arrives. The boxes now count as you type and refuse to save past this
 * (web/components/CssBox.tsx), so this cut is only the server's last word on
 * what somebody sent it by another route.
 */
export const MAX_CSS = 10000;

/** One limit for every box. The names stay because each is imported where its own box is cleaned. */
export const MAX_SCOPED_CSS = MAX_CSS;
export const MAX_ALERT_CSS = MAX_CSS;
export const MAX_CHAT_CSS = MAX_CSS;
export const MAX_CANVAS_CSS = MAX_CSS;

export function cleanCss(v, max) {
  return String(v ?? '').replace(/<\/style/gi, '').slice(0, max);
}
