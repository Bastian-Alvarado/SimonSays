/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The chat style tokens, named once for both sides.
 *
 * The server validates against these lists and the editor builds its controls
 * from them, so a choice the UI offers is a choice the server accepts. Kept
 * here rather than duplicated because the failure when they drift is quiet:
 * the control shows the new value, the server drops it, and the setting simply
 * does not take — with nothing on screen to say why.
 *
 * Every token is optional. An unset one means "whatever the theme already
 * does" — '' for a value, 'theme' for a choice — which is what lets the tokens
 * exist without changing how any theme looks until somebody sets one.
 */

/** Fonts the UI already loads. The alert builder offers the same list. */
export const CHAT_FONTS = ['Montserrat', 'Inter', 'JetBrains Mono', 'Creepster', 'VT323', 'Impact', 'Georgia'];

/**
 * The family name an uploaded font file is known by.
 *
 * Taken from the filename, because there is nowhere else to take it from
 * without parsing the font, and because somebody who uploads
 * Bebas_Neue.woff2 expects to see "Bebas Neue" offered. The server writes
 * this into the @font-face it generates and the editor lists it, so both
 * read it from here — two rules would mean a font you can pick and a font
 * that never loads.
 */
export function fontFamilyName(file) {
  // Separators become spaces rather than being dropped: "Bebas.Neue.woff2"
  // is a real filename, and a font that silently fails to be offered reads
  // as the upload having failed.
  return safeFontName(String(file ?? '').replace(/\.[^.]+$/, '').replace(/[._]+/g, ' '));
}

/**
 * A font name that is safe to write into CSS.
 *
 * The list above is what the app offers, not what it allows: a font the
 * user uploaded is a name this build has never heard of, and a closed list
 * would throw it away on save with nothing on screen to say why.
 *
 * So the check is on the shape of the name rather than on membership.
 * These names reach a page as inline style and inside a font-family
 * declaration, so letters, digits, spaces and hyphens only — a quote, a
 * semicolon or a bracket would be a way to write CSS rather than to name a
 * typeface. A name that does not fit becomes empty, which means "whatever
 * the surface already uses".
 */
export function safeFontName(value) {
  const name = String(value ?? '').trim().slice(0, 40);
  return /^[A-Za-z0-9 -]+$/.test(name) ? name : '';
}

export const USERNAME_CASES = ['theme', 'none', 'upper', 'lower'];

export const TIMESTAMP_FORMATS = ['theme', '12h', '24h'];

/** The alert overlay's entry animations, reused so the two agree. */
export const CHAT_ANIMATIONS = [
  'theme', 'animate-pop-in', 'animate-fade-in', 'animate-zoom-in',
  'animate-slide-up', 'animate-slide-down',
];

/*
 * The slots: which parts of a message go where.
 *
 * These belong to the "custom" theme alone, and that is the point. What makes
 * modern, compact and retro different from each other is arrangement, not
 * colour — compact puts the time first and runs the name into the message,
 * modern stacks a name row over the body, retro wraps the whole thing in a
 * bezel. Bending those three to honour an arrangement setting would mean
 * rewriting the markup that *is* each of them, for no gain: somebody who wants
 * a different arrangement wants their own, not a modified Retro.
 *
 * So the three keep their hardcoded look and "custom" is assembled from these.
 * Nobody's existing chat can change as a result, which is worth more here than
 * the tidiness of one renderer.
 */

/** Stacked puts the name on its own line above the message; inline runs on. */
export const CHAT_LAYOUTS = ['stacked', 'inline'];

export const TIMESTAMP_POSITIONS = ['left', 'right'];

/** Badges and the platform mark travel together, before or after the name. */
export const BADGE_POSITIONS = ['before', 'after'];

export const AVATAR_SHAPES = ['circle', 'rounded', 'square'];

/**
 * Which keys of the chat settings are style tokens.
 *
 * The client holds these as one object rather than a state variable each: they
 * are server-owned, and unlike the older settings none of them was ever kept
 * in a browser, so there is no per-key migration for them to take part in.
 */
export const CHAT_STYLE_KEYS = [
  'fontFamily', 'fontWeight', 'lineHeight', 'textColor', 'outlineWidth', 'outlineColor',
  'usernameWeight', 'usernameCase',
  'showTimestamp', 'timestampFormat',
  'rowBackground', 'rowRadius', 'rowPadding',
  'animationIn', 'animationMs',
  'autoHideSeconds', 'autoHideFadeMs',
  // The slots. Only the custom theme reads these.
  'layout', 'timestampPosition', 'badgePosition', 'avatarShape', 'avatarSize', 'nameSeparator',
  // The escape hatch, and its motion. Each chat keeps its own, with the rest of its look.
  'css', 'motionCss',
];

/** The chat themes the renderer can actually draw. */
export const CHAT_THEME_IDS = ['modern', 'compact', 'retro', 'custom'];

/**
 * A chat's settings when nothing has been chosen.
 *
 * Every chat on stream is a layer on a layout, and each keeps the whole of its
 * look on itself: what goes on stream with one overlay profile is that
 * profile's layouts, chat and all, so switching the profile switches the chat
 * with everything else. The chat dock keeps its own set the same shape. Here,
 * in shared/, because the server fills a set out from these and the stream
 * page draws with them, and the two must agree on what "not chosen" means.
 */
export const CHAT_DEFAULTS = {
  chatTheme: 'modern',
  fontSize: 16,
  usernameFontSize: 13,
  emoteSize: 24,
  messageGap: 0,
  animations: true,
  showAvatars: false,
  showEvents: false,
  showPlatformIcons: true,
  showRankBadges: true,
  colorUsername: true,
  // The page behind the dock. A chat layer sits on a layout, which has a background of its own.
  transparentBackground: false,
  dockBackgroundColor: '#09090b',
  // Discord sends no stream events, so it has no switch here.
  eventPlatforms: { twitch: true, youtube: true, tiktok: true },
  highlightRanks: { broadcaster: '', moderator: '', vip: '', subscriber: '' },

  // --- style tokens -------------------------------------------------------
  // Unset means the theme decides, so these defaults draw exactly as before.

  // Message text.
  fontFamily: '',
  fontWeight: '',
  lineHeight: '',
  textColor: '',
  /*
    Legibility over bright gameplay, drawn as a layered text-shadow rather
    than -webkit-text-stroke: a real stroke eats into the glyph and makes a
    light weight look anaemic at the sizes chat runs at. 0 is off.
  */
  outlineWidth: 0,
  outlineColor: '#000000',

  // The name.
  usernameWeight: '',
  usernameCase: 'theme',

  // The time. Chat carries the moment it arrived, so this reformats it.
  showTimestamp: true,
  timestampFormat: 'theme',

  // The row a message sits in.
  rowBackground: '',
  rowRadius: '',
  rowPadding: '',

  // How a new message arrives.
  animationIn: 'theme',
  animationMs: '',

  // On stream only: the dock keeps everything, so you can still read back. 0 means never.
  autoHideSeconds: 0,
  autoHideFadeMs: 600,

  /*
    The slots, read only by the "custom" theme. These have real defaults
    rather than an unset state: custom has no hardcoded look of its own to
    fall back to, so every slot has to say where its part goes.
  */
  layout: 'stacked',
  timestampPosition: 'right',
  badgePosition: 'before',
  avatarShape: 'circle',
  avatarSize: 32,
  nameSeparator: '',

  // The escape hatch. Empty means the themes above are the whole story.
  css: '',
  motionCss: '',
};

/**
 * What only the dock's page has: the colour behind it. A chat layer's
 * settings leave these out, since it is drawn on a layout rather than on a
 * page of its own.
 */
export const CHAT_PAGE_KEYS = ['transparentBackground', 'dockBackgroundColor'];

/**
 * Black or white, whichever reads on a colour — for words drawn on a filled
 * chip of somebody's own name colour or a rank colour picked in the settings.
 *
 * Either can be anything: Twitch lets a viewer pick navy, and a rank colour
 * is whatever the picker was left on. Dark words on #0000FF are unreadable,
 * so the choice follows the colour's brightness (WCAG relative luminance,
 * split where black and white give the same contrast). Undefined for
 * anything that is not a #rgb or #rrggbb colour, so a stylesheet's own
 * fallback stays in charge.
 */
export function inkFor(colour) {
  const raw = String(colour ?? '').trim().replace(/^#/, '');
  const hex = /^[0-9a-f]{3}$/i.test(raw) ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return undefined;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return light > 0.179 ? '#09090b' : '#ffffff';
}
