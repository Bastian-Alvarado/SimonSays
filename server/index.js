/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Entry point for the headless SimonSays server.
 *
 * Boot order matters: the store must exist before anything reads config, the
 * engine must be listening before platforms start emitting, and the HTTP/WS
 * surface comes up last so a client can never observe a half-built system.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, describeConfig } from './config.js';
import { initStore, flushAll } from './core/store.js';
import { createLogger } from './core/logger.js';

import { initEngine } from './engine/index.js';
import { initDiscordRoles } from './engine/discord-roles.js';
import { initRoleSync } from './engine/role-sync.js';
import { initAnnounce, stopAnnounce } from './engine/announce.js';
import { initScheduleEvents } from './engine/schedule-events.js';
import { initDiscordPages } from './engine/discord-pages.js';
import { initSubscribers } from './engine/subscribers.js';
import { initLeveling } from './leveling/index.js';
import { initLevelChat } from './leveling/chat.js';
import { initStreamSessions } from './engine/stream-sessions.js';
import { initViewerHistory } from './engine/viewer-history.js';
import { initPoints } from './engine/points.js';
import { initProfileCard } from './engine/profile-card.js';
import { initHighlights } from './engine/highlights.js';
import { initLiveDms } from './engine/live-dms.js';
import { initRemotePlayers, aliasFor, everyAliasOf } from './engine/remote-players.js';
import * as omnilayer from './engine/omnilayer.js';
import { getGreetings } from './engine/welcome.js';
import { initDiscordQuestions } from './engine/discord-questions.js';
import { initGameRequests } from './engine/game-requests.js';
import { initModeration } from './engine/moderation.js';
import * as engineModule from './engine/index.js';
import { initRelay } from './engine/relay.js';

import * as twitch from './platforms/twitch.js';
import * as tiktok from './platforms/tiktok.js';
import * as discord from './platforms/discord.js';
import * as discordVoice from './platforms/discord-voice.js';
import * as obs from './platforms/obs.js';
import * as spotify from './platforms/spotify.js';
import * as youtube from './platforms/youtube.js';
import * as tts from './platforms/tts.js';
import * as droidcam from './platforms/droidcam.js';

import { createHttpServer } from './api/http.js';
import { initWebSocket } from './api/ws.js';
import { VERSION } from '../shared/version.js';

const log = createLogger('boot');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  log.info(`SimonSays ${VERSION} — headless server starting`);
  log.info('config:', describeConfig());

  // 1. Persistence
  initStore();

  // 2. Engine, wired to the platform services it will drive
  initEngine({
    twitch: twitch.service,
    obs: obs.service,
    discord: discord.service,
    spotify: spotify.service,
    youtube: youtube.service,
    tts: tts.service,
    droidcam: droidcam.service,
  });

  // 3. Leveling (subscribes to chat on the bus)
  initLeveling();
  // "!rank" and "!top", answered in the chat they were asked in.
  initLevelChat();
  // Every stream kept (chat speed, who took part, songs, clips, the VOD), and what each person has done across them.
  initStreamSessions();
  initViewerHistory();
  // Points: a currency apart from XP, earned everywhere and spent in the shop.
  initPoints({ engine: engineModule });
  // "!perfil": a person's level, points, streams and accounts — a picture in Discord, a line elsewhere.
  initProfileCard();
  // The moments chat goes wild, on every platform at once: a marker, a clip, a post.
  initHighlights();
  // Going live, told privately to those who asked, with the link to where they watch.
  initLiveDms();
  // Remote players: four seats for people playing from home, through VDO.Ninja, shown in OBS.
  initRemotePlayers({
    obsService: obs.service,
    discordService: discord,
    layouts: { rewrite: (change) => engineModule.store.rewriteLayouts(change) },
    // Omnilayer's scene, where the layouts place their sources; or whichever scene OBS has on.
    scene: () => engineModule.store.omnilayerState().scene || obs.currentScene(),
    testChannelId: () => getGreetings().testChannelId,
    streamer: () => twitch.getCredentials()?.user?.display_name || '',
    omnilayer: { refresh: (gone) => omnilayer.refresh(gone) },
  });
  // The streamer's own seat shows their capture in the slot that names the seat; "Player on screen", whichever seat is on screen.
  omnilayer.setSourceAlias(aliasFor, everyAliasOf);
  // Questions posted in a Discord channel, into the Questions dock; answered on stream, answered there.
  initDiscordQuestions();
  // A Discord channel of game suggestions, as a board by votes that feeds the plan.
  initGameRequests();
  // The mod log, and banning or timing out somebody on their other accounts.
  initModeration();

  // 4. Discord membership automation (reaction roles, buttons, welcomes)
  initDiscordRoles();
  // Discord roles that follow stream status, for accounts linked to Discord.
  initRoleSync();
  // Going live, announced in Discord.
  initAnnounce();
  // The Twitch schedule, as Discord events.
  initScheduleEvents();
  // A channel's standing posts — welcome, rules, links — built from blocks.
  initDiscordPages();

  // 4b. The subscriber ledger (learns tenure from chat badges)
  initSubscribers();

  // 5. Cross-platform relays (engine/relay.js)
  initRelay();

  // 5. Platform connectors
  twitch.initTwitch();
  tiktok.initTikTok();
  // Before the gateway connects, so it hears the first voice states.
  discordVoice.initDiscordVoice();
  discord.initDiscord();
  obs.initObs();
  spotify.initSpotify();
  youtube.initYouTube();
  tts.initTts();
  droidcam.initDroidcam();

  // 6. Public surface. Serve the built UI when it exists.
  const webDist = path.join(__dirname, '..', 'web', 'dist');
  const webRoot = fs.existsSync(webDist) ? webDist : null;
  if (webRoot) log.info(`serving built UI from ${webDist}`);
  else log.info('no web/dist build found — run the UI with `npm run dev:web`');

  const server = createHttpServer({ webRoot });
  initWebSocket(server);

  // A failed bind must be fatal and legible. Without this the process kept
  // running with no listener, and requests were silently answered by whatever
  // stale instance already held the port.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log.error(`port ${config.port} is already in use — another SimonSays server is probably running.`);
      log.error('Stop it first, or start this one with a different PORT.');
    } else {
      log.error('server error:', err);
    }
    process.exit(1);
  });

  server.listen(config.port, config.host, () => {
    log.info(`listening on http://${config.host}:${config.port}`);
    log.info('the stack is now live and does not need a browser open');
  });

  installShutdownHandlers(server);
}

function installShutdownHandlers(server) {
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} received — shutting down`);

    // Persist before tearing down connections; an unflushed store is the one
    // piece of state we cannot rebuild.
    flushAll();

    await Promise.allSettled([
      twitch.disconnect(),
      tiktok.disconnect(),
      obs.disconnect(),
      Promise.resolve(discordVoice.stopDiscordVoice()),
      Promise.resolve(stopAnnounce()),
      Promise.resolve(discord.disconnect()),
      Promise.resolve(spotify.stop()),
    ]);

    server.close(() => {
      log.info('goodbye');
      process.exit(0);
    });

    // Don't hang forever on a stuck socket.
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // A crash must not take the database with it.
  process.on('uncaughtException', (err) => {
    log.error('uncaught exception:', err);
    flushAll();
  });
  process.on('unhandledRejection', (reason) => {
    log.error('unhandled rejection:', reason);
  });
}

main().catch((err) => {
  log.error('fatal during boot:', err);
  process.exit(1);
});
