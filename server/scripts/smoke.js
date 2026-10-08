/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Headless smoke test.
 *
 * Boots the engine with stub platform services, pushes synthetic chat and
 * events onto the bus, and asserts the pipeline reacts. No browser, no
 * network, no OBS — which is exactly the property V3 exists to provide.
 *
 * The tests live in scripts/smoke/, a file per part of the app. They share
 * one engine and run in this order, because later ones build on what earlier
 * ones left behind; smoke/harness.js boots it and holds the helpers.
 *
 *   node scripts/smoke.js
 */

import fs from 'node:fs';

const { flushAll, results, tmp } = await import('./smoke/harness.js');

await import('./smoke/commands.js');
await import('./smoke/safety.js');
await import('./smoke/chat-steps.js');
await import('./smoke/run-card-and-bars.js');
await import('./smoke/timers.js');
await import('./smoke/music-and-speech.js');
await import('./smoke/subscribers-and-services.js');
await import('./smoke/backup-and-layouts.js');
await import('./smoke/queue-and-plan.js');
await import('./smoke/images-and-alerts.js');
await import('./smoke/alert-controls.js');
await import('./smoke/profiles-and-chat.js');
await import('./smoke/layers.js');
await import('./smoke/drag-order.js');
await import('./smoke/layer-groups.js');
await import('./smoke/dock-pages.js');
await import('./smoke/aspect.js');
await import('./smoke/now-playing-and-clock.js');
await import('./smoke/stylesheets.js');
await import('./smoke/looks.js');
await import('./smoke/alert-looks.js');
await import('./smoke/chat-looks.js');
await import('./smoke/chat-layers.js');
await import('./smoke/layer-looks.js');
await import('./smoke/omnibar-exit.js');
await import('./smoke/youtube-and-tiktok.js');
await import('./smoke/youtube-send.js');
await import('./smoke/players-and-polls.js');
await import('./smoke/discord-voice.js');
await import('./smoke/discord.js');
await import('./smoke/welcome-card.js');
await import('./smoke/welcome-pictures.js');
await import('./smoke/discord-posts.js');
await import('./smoke/discord-chat.js');
await import('./smoke/levels-on-stream.js');
await import('./smoke/repeating.js');
await import('./smoke/stream-recap.js');
await import('./smoke/schedule-events.js');
await import('./smoke/giveaway.js');
await import('./smoke/covers-calendar-commands.js');
await import('./smoke/linking-youtube.js');
await import('./smoke/people-linking.js');
await import('./smoke/history-and-streams.js');
await import('./smoke/points.js');
await import('./smoke/profile-card.js');
await import('./smoke/loyalty-roles.js');
await import('./smoke/moments.js');
await import('./smoke/discord-pages.js');
await import('./smoke/live-pages.js');
await import('./smoke/banner-text.js');
await import('./smoke/uploads.js');
await import('./smoke/pages-and-privacy.js');
await import('./smoke/still-pictures.js');
await import('./smoke/discord-emoji-text.js');
await import('./smoke/nav-menu.js');
await import('./smoke/live-dms.js');
await import('./smoke/discord-questions.js');
await import('./smoke/game-requests.js');
await import('./smoke/moderation.js');
await import('./smoke/pixel-avatars.js');
await import('./smoke/house-avatar.js');
await import('./smoke/sandwichxample.js');
await import('./smoke/pngtuber.js');
await import('./smoke/talk-people.js');
await import('./smoke/twitch-extras.js');
await import('./smoke/chat-dock.js');
await import('./smoke/chat-overlay.js');
await import('./smoke/stream-plan.js');
await import('./smoke/run-screen.js');
await import('./smoke/who-is-on.js');
await import('./smoke/questions.js');
await import('./smoke/refusals.js');
await import('./smoke/polls.js');
await import('./smoke/deaths.js');
await import('./smoke/countdown-steps.js');
await import('./smoke/omnilayer.js');
await import('./smoke/scene-types.js');
await import('./smoke/remote-players.js');
await import('./smoke/user-themes.js');
await import('./smoke/guides.js');
await import('./smoke/version.js');
await import('./smoke/translations.js');
await import('./smoke/events-dock.js');
await import('./smoke/voice-call.js');
await import('./smoke/call-triggers.js');
// Last: it gives the Spotify module a stand-in token no other file expects.
await import('./smoke/spotify-wake.js');

// ---------------------------------------------------------------- teardown

flushAll();
fs.rmSync(tmp, { recursive: true, force: true });

const { passed, failed } = results();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
