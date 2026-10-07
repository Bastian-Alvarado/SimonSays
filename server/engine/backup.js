/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Configuration backup — the thing "Export Configuration" always claimed to be.
 *
 * The button it belongs to came from V2, where the browser *was* the database
 * and localStorage held everything. V3 moved all of it onto the server, so the
 * old export quietly produced a file of display preferences: no commands, no
 * actions, no alerts. This reads the collections instead.
 *
 * Everything goes through the live collections rather than the JSON files on
 * disk. Writing the files directly would be shorter, but a running server
 * holds each collection in memory and flushes it later — so a file written
 * underneath it is invisible until restart and then overwritten. Going through
 * the store keeps memory, disk and every connected client in agreement.
 */

import { getCollection } from '../core/store.js';
import { createLogger } from '../core/logger.js';
import { VERSION } from '../../shared/version.js';

const log = createLogger('backup');

/** What a file has to say about itself to be accepted. */
export const BACKUP_APP = 'SimonSays';
export const BACKUP_KIND = 'config-backup';
export const BACKUP_VERSION = 2;

/**
 * What travels, in the order it is restored.
 *
 * Order matters: dock buttons are dropped on save when they point at an action
 * that does not exist, so actions have to land first. The rest is independent.
 *
 * `strip` removes secrets. They are deliberately not in a backup — a file that
 * carries OAuth tokens is a file that hands over the account to anyone who
 * reads it, and on a new machine those tokens are the wrong ones anyway: the
 * redirect URI includes the host, so the new install has to sign in regardless.
 * Naming what was stripped lets the UI say which connections need attention.
 */
export const MANIFEST = [
  { name: 'commands' },
  { name: 'actions' },
  { name: 'alerts' },
  { name: 'dock_buttons' },
  { name: 'omnibar' },
  { name: 'omnibars' },
  { name: 'viewers' },
  // The chat every layout used to share. Kept so an older backup's layouts,
  // whose chat leaned on it, are filled out from it when they are restored.
  { name: 'chat_settings' },
  { name: 'chat_dock_settings' },
  // What has already been done to this install, so a restore does not redo it.
  { name: 'upgrades' },
  { name: 'plan' },
  // Plans for nights that repeat, saved to load again.
  { name: 'plan_saved' },
  // Regulars and crews: who is on often, and whole nights of seats.
  { name: 'people' },
  // What is being played. Tonight's state rather than configuration, but so
  // is the plan above it, and a blank run card after an import reads as a
  // bug rather than as a clean slate.
  { name: 'run' },
  // Who is in tonight's game. State rather than configuration, like the run.
  { name: 'players' },
  // Questions are what viewers typed, not configuration — see EXCLUDED.
  // The same goes for a poll's votes and past results, but not for what
  // happens around a poll: its announcements, its command, how long a result stays.
  { name: 'poll_settings' },
  // What the Events dock's "Thank" says in chat. The events and the stream's totals stay behind.
  { name: 'events_dock_settings' },
  // How they ask, though, is: the command, its cooldown, the word back.
  { name: 'questions_settings' },
  // The overlay arrangements. Somebody who has spent an afternoon placing
  // layers should not have to do it again on another machine.
  { name: 'layouts' },
  // The saved configurations themselves. Leaving these behind would export
  // only whichever profile happened to be live.
  { name: 'profiles' },
  // Which phone is the camera, and on what port. No credentials in it.
  { name: 'droidcam_settings' },
  { name: 'countdown' },
  { name: 'stopwatch' },
  // The deaths count: a playthrough's, carried from one night to the next.
  { name: 'counters' },
  { name: 'omnilayer' },
  // The remote players' seats: who is in each, and the links regulars keep from one night to the next.
  { name: 'remote_players' },
  // The pixel avatars drawn in the app, examples and all.
  { name: 'pixel_avatars' },
  // The themes made in the app's Library.
  { name: 'user_themes' },
  { name: 'relay_config' },
  // The shape of the button grid, which is arrangement rather than tonight.
  { name: 'dock_grid' },
  { name: 'tags' },
  { name: 'tag_outputs' },
  { name: 'reaction_roles' },
  { name: 'discord_buttons' },
  // Which voice channel the voice overlay shows, and whether the bot joins it.
  { name: 'discord_voice' },
  // Where and how going live is announced, the schedule as Discord events, and the channel pages.
  { name: 'discord_announce' }, { name: 'discord_events' }, { name: 'discord_pages' },
  // How giveaways are told and posted; the giveaway itself is tonight's.
  { name: 'giveaway_settings' }, { name: 'pngtuber_mic' },
  // Shoutouts for raiders and where clips are posted.
  { name: 'twitch_extras' },
  { name: 'welcome_goodbye' },
  { name: 'role_mappings' },
  // Roles for showing up: so many streams, a streak, platforms, messages.
  { name: 'loyalty_roles' },
  { name: 'xp_config' },
  // Viewer levels and the platform accounts linked to them. The whole point of
  // levels is that they accumulate, so a migration that dropped them would be
  // worse than no migration.
  { name: 'users' },
  { name: 'accounts' },
  // What each person has done across streams, and the streams themselves: they
  // accumulate the same way, and nothing could rebuild them.
  { name: 'viewer_history' },
  // Points people have to spend, and the shop's rewards.
  { name: 'points' },
  { name: 'profile_card' },
  { name: 'highlights' },
  // Who asked to be told privately when the stream starts, and where they watch.
  { name: 'live_dms' },
  // Which Discord channels feed the Questions dock.
  { name: 'discord_questions' },
  // The game requests board: what people asked for, their votes, what was played.
  { name: 'game_requests' },
  // Where the mod log goes, and what it said.
  { name: 'moderation' },
  { name: 'stream_sessions' },
  // Accumulated subscriber tenure. Learned from badge-info as people talk, so
  // it cannot be rebuilt on demand — the same reason levels travel.
  { name: 'subscribers' },
  { name: 'discord_settings', strip: ['botToken', 'clientSecret'] },
  { name: 'tiktok_credentials', strip: ['signApiKey'] },
  { name: 'twitch_credentials', strip: ['accessToken', 'botToken'] },
  { name: 'obs_credentials', strip: ['password'] },
  { name: 'spotify_settings', strip: ['clientSecret'] },
  { name: 'youtube_settings', strip: ['clientSecret'] },
  // Nothing in here but the key, so it travels as an empty object. Listed
  // rather than excluded so a later non-secret setting is carried by default.
  { name: 'ai_settings', strip: ['geminiApiKey'] },
];

/**
 * Left out on purpose:
 *   event_history, recent_chat  — a log of what happened, not configuration
 *   viewer_events               — a runtime ring of the last few events
 *   discord_cache, role_activity_log — rebuilt from the source at runtime
 *   spotify_tokens              — nothing but secrets
 *   youtube_tokens              — the same
 *   youtube_usage               — today's count of YouTube's allowance, by this app
 *   stream_tally                — tonight's stream so far, for its recap
 *   stream_live                 — the stream on now, until it is kept with the rest
 *   banner_text                 — which drawn banner each page block has: drawn again when missing
 *   giveaway                    — who entered tonight's giveaway: tonight's, not setup
 *   repeat_fired                — when each calendar action last ran
 *   xp_data                     — the pre-migration shape, already converted
 *   poll                        — who voted for what: tonight's, not setup
 *   poll_history                — the last few polls' results, the same
 *   event_totals                — tonight's follows, subs and bits, the same
 *   role_sync                   — what each viewer is (sub, VIP, bits), learned
 *                                 from chat and events and learned again
 *   questions                   — what viewers typed during a segment, not
 *                                 configuration, and stale the moment it ends
 *   twitch_rewards              — names Twitch owns, refetched on connect, and
 *                                 belonging to whichever channel is signed in
 *                                 rather than to this configuration
 *   pixel_avatar_versions       — each pixel avatar's earlier versions: an undo
 *                                 history, up to a dozen whole avatars each,
 *                                 where the avatars themselves (pixel_avatars)
 *                                 travel
 */
export const EXCLUDED = ['event_history', 'recent_chat', 'viewer_events', 'discord_cache', 'role_activity_log', 'spotify_tokens', 'youtube_tokens', 'xp_data', 'twitch_rewards', 'questions', 'poll', 'poll_history', 'event_totals', 'role_sync', 'pixel_avatar_versions', 'youtube_usage', 'stream_tally', 'stream_live', 'giveaway', 'repeat_fired', 'banner_text'];

/** Everything needed to stand this install up somewhere else. */
export function buildBundle() {
  const collections = {};
  const stripped = [];
  const missing = [];

  for (const entry of MANIFEST) {
    const c = getCollection(entry.name);
    if (!c) { missing.push(entry.name); continue; }

    const value = structuredClone(c.get());
    if (entry.strip && value && typeof value === 'object') {
      for (const field of entry.strip) {
        if (value[field]) { delete value[field]; stripped.push(`${entry.name}.${field}`); }
        else delete value[field];
      }
    }
    collections[entry.name] = value;
  }

  log.info(`exported ${Object.keys(collections).length} collections`
    + (stripped.length ? `, ${stripped.length} secret field(s) left out` : ''));

  return {
    meta: {
      app: BACKUP_APP,
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      // Which app wrote it, for whoever reads it later. `version` is the file's own format.
      appVersion: VERSION,
      exportedAt: new Date().toISOString(),
      // So the file itself says what it does not contain.
      stripped,
      excluded: EXCLUDED,
      unavailable: missing,
    },
    collections,
  };
}

/**
 * Restore a bundle, replacing what is there.
 *
 * Collections absent from the file are left alone rather than emptied: an older
 * backup should not wipe something it predates.
 */
export function applyBundle(bundle, { healCommands, setDockButtons } = {}) {
  if (!bundle || typeof bundle !== 'object') throw new Error('not a backup file');

  const meta = bundle.meta;
  if (!meta || meta.app !== BACKUP_APP) throw new Error('not a SimonSays backup file');
  if (!bundle.collections || typeof bundle.collections !== 'object') {
    // V1 files carried localStorage keys under `data` and no server state at
    // all, so there is genuinely nothing here to restore.
    throw new Error(meta.version === 1 || bundle.data
      ? 'this is an old settings-only backup and carries no commands or actions'
      : 'backup file has no collections');
  }

  const restored = [];
  const skipped = [];

  for (const entry of MANIFEST) {
    if (!(entry.name in bundle.collections)) continue;
    const value = bundle.collections[entry.name];
    if (value === undefined || value === null) continue;

    // Dock buttons go through the engine so the same validation that guards a
    // normal save applies here: colours checked, icons bounded, buttons whose
    // action is missing dropped.
    if (entry.name === 'dock_buttons' && setDockButtons) {
      setDockButtons(value);
      restored.push(entry.name);
      continue;
    }

    const c = getCollection(entry.name);
    if (!c) { skipped.push(entry.name); continue; }

    if (entry.strip) {
      // A backup carries no secrets, so writing it verbatim would delete the
      // ones already here — importing onto a machine that is signed in would
      // sign it out. Keep what this machine holds and take everything else
      // from the file. If the imported settings belong to a different account
      // the stored sign-in is simply the wrong one, and reconnecting replaces
      // it; that is recoverable, whereas a wiped token is not.
      const current = (c.get() && typeof c.get() === 'object') ? c.get() : {};
      const keep = {};
      for (const field of entry.strip) {
        if (current[field] !== undefined) keep[field] = current[field];
      }
      c.set({ ...current, ...value, ...keep });
    } else {
      c.set(value);
    }
    restored.push(entry.name);
  }

  // Same healing the boot path applies, so a hand-edited or older file cannot
  // leave a command missing fields the engine expects.
  if (restored.includes('commands') && healCommands) healCommands();

  log.info(`imported ${restored.length} collections`
    + (skipped.length ? `; ${skipped.length} had no home on this server` : ''));

  return { restored, skipped, exportedAt: meta.exportedAt ?? null, stripped: meta.stripped ?? [] };
}
