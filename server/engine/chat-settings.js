/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A chat's settings, checked: the dock's set, and each chat layer's own.
 *
 * Every chat on stream is a layer on a layout, and each keeps the whole of its
 * look on itself — theme, sizes, toggles, stylesheet and motion. It used to be
 * one shared set that every chat layer drew with, plus a chat profile to swap
 * it, and a layer could quietly override parts of it: a Library look written
 * onto a layer beat the Chat overlay screen with nothing on screen to say so.
 * Now there is one place a chat's look comes from, and it is the layer you
 * can see on the Overlays screen. The dock keeps its own set, checked by the
 * same rules here, so a value one refuses the other cannot accept.
 */

import {
  CHAT_DEFAULTS, CHAT_THEME_IDS, CHAT_PAGE_KEYS,
  USERNAME_CASES, TIMESTAMP_FORMATS, CHAT_ANIMATIONS,
  CHAT_LAYOUTS, TIMESTAMP_POSITIONS, BADGE_POSITIONS, AVATAR_SHAPES,
  safeFontName,
} from '../../shared/chat-style.js';
import { cleanCss, MAX_CHAT_CSS } from '../../shared/clean-css.js';
import { currentLook } from '../../shared/looks-history.js';

/** The chat themes the renderer can actually draw. */
export const CHAT_THEMES = CHAT_THEME_IDS;

/**
 * The dock's set when nothing has been chosen. `migrated` is the dock's
 * alone: set once, by the first client that had settings in its browser to
 * carry up, from before chat settings lived on the server.
 */
export const DEFAULT_CHAT = { ...CHAT_DEFAULTS, migrated: false };

/*
  Values from a client end up interpolated into inline styles on a surface
  that is on stream, so they are checked rather than trusted. An out-of-range
  number is clamped into range; only something that is not a number at all
  falls back.
*/
const colour = (v, fallback) => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v || '') ? v : fallback);
const bounded = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

/*
  The chat style tokens are all optional, and an unset one means "whatever the
  theme already does" — '' for a value, 'theme' for a choice.

  That is what lets them land without changing how anything looks. The three
  themes keep their own hardcoded look as the floor, and a token only takes
  over once somebody sets it, so the defaults render exactly as before and
  clearing a control puts it back rather than leaving it on some new value.
*/
const optColour = (v) => colour(v, '');
const optNumber = (v, lo, hi) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : '';
};
const optDecimal = (v, lo, hi) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : '';
};
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/**
 * Validate a whole set of chat settings against the ones already stored.
 *
 * A whole set, not a patch: a client sends everything it knows with its
 * change folded in. One set of rules for the dock and for every chat layer —
 * writing a second, looser validator is how a value the dock refuses ends up
 * accepted on stream.
 */
export function cleanChatSettings(incoming, prev) {
  const ranks = incoming?.highlightRanks || {};
  const platforms = incoming?.eventPlatforms || {};
  return {
    // A theme that has since been removed falls back rather than sticking:
    // otherwise a profile saved under it keeps a value nothing can draw.
    chatTheme: CHAT_THEMES.includes(incoming?.chatTheme) ? incoming.chatTheme
      : (CHAT_THEMES.includes(prev.chatTheme) ? prev.chatTheme : DEFAULT_CHAT.chatTheme),
    // Bounds a person could actually read, at either end.
    fontSize: bounded(incoming?.fontSize, 8, 96, prev.fontSize),
    usernameFontSize: bounded(incoming?.usernameFontSize, 8, 96, prev.usernameFontSize),
    emoteSize: bounded(incoming?.emoteSize, 8, 128, prev.emoteSize),
    messageGap: bounded(incoming?.messageGap, 0, 64, prev.messageGap),
    animations: incoming?.animations !== false,
    showAvatars: incoming?.showAvatars === true,
    showEvents: incoming?.showEvents === true,
    showPlatformIcons: incoming?.showPlatformIcons !== false,
    showRankBadges: incoming?.showRankBadges !== false,
    colorUsername: incoming?.colorUsername !== false,
    transparentBackground: incoming?.transparentBackground === true,
    dockBackgroundColor: colour(incoming?.dockBackgroundColor, prev.dockBackgroundColor),

    /*
      The chat stylesheet, and its motion: read only by the custom theme.

      Kept when the caller does not mention them, the same as every other
      token here — a patch setting one colour must not wipe the rest. An
      exact copy of a look from before a change to it is brought up to date
      (see shared/looks-history.js); anything else is kept as written.
    */
    css: currentLook(incoming?.css === undefined ? (prev.css || '') : cleanCss(incoming.css, MAX_CHAT_CSS)),
    motionCss: currentLook(incoming?.motionCss === undefined ? (prev.motionCss || '') : cleanCss(incoming.motionCss, MAX_CHAT_CSS)),
    eventPlatforms: {
      twitch: platforms.twitch !== false,
      youtube: platforms.youtube !== false,
      tiktok: platforms.tiktok !== false,
    },
    // A rank with no colour chosen is not highlighted, so empty is a real
    // value here rather than something to fall back from.
    highlightRanks: Object.fromEntries(['broadcaster', 'moderator', 'vip', 'subscriber']
      .map((k) => [k, colour(ranks[k], '')])),

    /*
      Style tokens. Every one of these is optional and clears back to the
      theme, so an unreadable value is dropped rather than replaced with
      some default the person never chose — and a cleared control means the
      theme again, not a new setting they now have to undo.
    */
    // Not oneOf: an uploaded font is a name this build has never heard of.
    fontFamily: safeFontName(incoming?.fontFamily),
    fontWeight: optNumber(incoming?.fontWeight, 100, 900),
    lineHeight: optDecimal(incoming?.lineHeight, 0.8, 3),
    textColor: optColour(incoming?.textColor),
    outlineWidth: bounded(incoming?.outlineWidth, 0, 8, 0),
    outlineColor: colour(incoming?.outlineColor, prev.outlineColor || '#000000'),

    usernameWeight: optNumber(incoming?.usernameWeight, 100, 900),
    usernameCase: oneOf(incoming?.usernameCase, USERNAME_CASES, 'theme'),

    showTimestamp: incoming?.showTimestamp !== false,
    timestampFormat: oneOf(incoming?.timestampFormat, TIMESTAMP_FORMATS, 'theme'),

    rowBackground: optColour(incoming?.rowBackground),
    rowRadius: optNumber(incoming?.rowRadius, 0, 48),
    rowPadding: optNumber(incoming?.rowPadding, 0, 48),

    animationIn: oneOf(incoming?.animationIn, CHAT_ANIMATIONS, 'theme'),
    animationMs: optNumber(incoming?.animationMs, 0, 3000),

    // A few seconds is the shortest that is readable; an hour is as good as
    // never, and never is what 0 means.
    autoHideSeconds: bounded(incoming?.autoHideSeconds, 0, 3600, 0),
    autoHideFadeMs: bounded(incoming?.autoHideFadeMs, 0, 5000, 600),

    layout: oneOf(incoming?.layout, CHAT_LAYOUTS, prev.layout || 'stacked'),
    timestampPosition: oneOf(incoming?.timestampPosition, TIMESTAMP_POSITIONS, prev.timestampPosition || 'right'),
    badgePosition: oneOf(incoming?.badgePosition, BADGE_POSITIONS, prev.badgePosition || 'before'),
    avatarShape: oneOf(incoming?.avatarShape, AVATAR_SHAPES, prev.avatarShape || 'circle'),
    avatarSize: bounded(incoming?.avatarSize, 12, 96, prev.avatarSize ?? 32),
    // Shown between the name and the message on one line, e.g. ":".
    nameSeparator: typeof incoming?.nameSeparator === 'string'
      ? incoming.nameSeparator.slice(0, 3) : (prev.nameSeparator || ''),
    migrated: incoming?.migrated === true || prev.migrated === true,
  };
}

/**
 * Whether a chat layer holds a whole set of its own, rather than the two or
 * three keys an older one overrode the shared chat with — or nothing at all,
 * which is what most of them held.
 */
export const isWholeChat = (config) => typeof config?.fontSize === 'number';

/**
 * A chat layer's settings, whole and checked.
 *
 * One that still holds only what it overrode is filled out from `fallback` —
 * the shared chat it was drawn with until now — so it looks exactly as it
 * did, and from then on is complete on its own. Without the page's own keys
 * (the colour behind the dock), and without the dock's migration mark.
 */
export function normaliseChatLayer(config, fallback = {}) {
  const own = config && typeof config === 'object' ? config : {};
  const clean = cleanChatSettings(isWholeChat(own) ? own : { ...(fallback || {}), ...own }, DEFAULT_CHAT);
  for (const key of [...CHAT_PAGE_KEYS, 'migrated']) delete clean[key];
  return clean;
}
