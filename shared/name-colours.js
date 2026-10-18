/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The colour a chat name takes from its platform, when it has none of its own
 * or the chat was told to go by platform: the dock (shared/dock-chat-css.js)
 * and every chat layer (web/components/ChatMessageRow.tsx) read them here, so
 * the two never disagree. Twitch has none: it keeps the look's accent.
 */

export const PLATFORM_NAME_COLOURS = Object.freeze({
  tiktok: '#ffffff',
  discord: '#8fa3e6',
  youtube: '#ff4d4d',
});

/** How a chat layer colours its names: the look's own colour, the platform's, or the person's own (else the platform's). */
export const NAME_COLOUR_SOURCES = ['layout', 'platform', 'own'];

/**
 * Which of those a chat goes by: the one chosen, or, where none was, what the
 * old Name colours switch meant (on: their own; off: the look's).
 */
export function nameColourSource(settings = {}) {
  if (NAME_COLOUR_SOURCES.includes(settings.nameColours)) return settings.nameColours;
  return settings.colorUsername ? 'own' : 'layout';
}

/** The colour a name is drawn in, or '' to leave it to the look: by platform, or theirs and else the platform's. */
export function nameColourFor(source, platform, ownColour) {
  if (source === 'layout') return '';
  const byPlatform = PLATFORM_NAME_COLOURS[platform] || '';
  return source === 'own' ? (ownColour || byPlatform) : byPlatform;
}
