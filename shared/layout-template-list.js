/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The layout templates there are, for the dashboard to offer and the server
 * to check against: small on purpose, since the layouts themselves are the
 * server's (server/engine/layout-templates/) and never sent to a screen.
 */

export const LAYOUT_TEMPLATES = Object.freeze([
  {
    id: 'simonsays-casual',
    name: { en: 'SimonSays Casual', es: 'SimonSays Casual' },
    hint: {
      en: 'Every scene in the SimonSays look: starting, in game, just chatting, BRB, ending, 16:9 and 4:3 game, co-op and 4 players. Pick your OBS sources and bind your scenes after.',
      es: 'Todas las escenas con el estilo SimonSays: empezando, en juego, charlando, pausa, final, juego 16:9 y 4:3, cooperativo y 4 jugadores. Luego eliges tus fuentes de OBS y enlazas tus escenas.',
    },
    layouts: 9,
  },
]);
