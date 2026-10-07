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
 * A stylesheet for one layer.
 *
 * Tighter than the others on purpose: a layout can hold forty layers and
 * every one of their stylesheets travels in the config each client receives
 * on connect.
 *
 * 2000 until the looks started reading a layer's own settings before their
 * colours (the omnibar's, first), which is a fallback around each colour they
 * set: the tall bars came to just over 2100, and the richest of the rest sit
 * within fifty characters of the old cap. Forty layers at the extra five
 * hundred is twenty kilobytes, once, on a connection over the local network.
 */
export const MAX_SCOPED_CSS = 2500;

/**
 * A stylesheet for one alert.
 *
 * Roomier, because the reason layers are kept tight does not apply: an alert
 * carries its own and they do not arrive forty at a time. It also needs the
 * room — a layer stylesheet restyles one element, while an alert motion is a
 * timeline with a beat and a set of keyframes for each part of it, and the
 * one this ships came to just over three thousand characters.
 *
 * The cap does not refuse what is too long, it cuts the end off. At 2000 the
 * shipped motion lost its last rule and the alert played the whole sequence
 * except the part where the name arrives, with nothing anywhere to say why.
 */
export const MAX_ALERT_CSS = 4000;

/**
 * A stylesheet for the chat.
 *
 * One of them for the whole app rather than one per layer, so it is held to
 * the roomier budget for the same reason an alert is — and chat has four
 * themes and six named parts, which is a lot to have opinions about.
 */
export const MAX_CHAT_CSS = 4000;

/** A stylesheet for a whole canvas, which has more to say. */
export const MAX_CANVAS_CSS = 4000;

export function cleanCss(v, max) {
  return String(v ?? '').replace(/<\/style/gi, '').slice(0, max);
}
