/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * How good a remote player's picture is asked to be
 * (server/engine/remote-players.js): what the player's browser sends —
 * VDO.Ninja's quality step and frame rate — what OBS asks for, the bitrate,
 * and the size of the browser source, which VDO.Ninja scales to. A 4 Players
 * slot is about 736 by 414 on stream, so 720p is already more than it shows.
 *
 * Here because the screen offers the same list the server keeps.
 */
export const QUALITIES = {
  '1080p60': { quality: 0, fps: 60, kbps: 12000, width: 1920, height: 1080 },
  '720p60': { quality: 1, fps: 60, kbps: 6000, width: 1280, height: 720 },
  '720p30': { quality: 1, fps: 30, kbps: 3500, width: 1280, height: 720 },
  '360p30': { quality: 2, fps: 30, kbps: 1500, width: 640, height: 360 },
};
export const QUALITY_IDS = Object.keys(QUALITIES);
export const DEFAULT_QUALITY = '720p60';

/**
 * A slot that shows whichever seat is on screen, rather than one seat: the
 * Gameplay layouts' game, so one command puts any player's game full screen
 * (server/engine/remote-players.js, onScreen). Not an OBS source of its own —
 * it stands for "Player 1" to "Player 4", and for the streamer's capture
 * while their seat is the one on screen.
 */
export const ON_SCREEN_SOURCE = 'Player on screen';
