/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What a pretend event carries: for the Alerts screen's "Fire on stream"
 * (engine/alerts.js buildTestEvent) and for the preview beside it, so the two
 * say the same thing. Shaped like the real events — each platform's emit —
 * so a caption using any field a real one carries tests true, instead of
 * reaching the stream as a literal "{event.level}".
 */

/** The platforms a viewer can be on; anything else (obs, spotify) is the app's own. */
const VIEWER_PLATFORMS = ['twitch', 'youtube', 'tiktok', 'discord', 'kick'];

/**
 * An alert for a kind ("follow", "cheer") answers on any platform, so a test
 * of one has to pick: Twitch, except for the kinds only TikTok has.
 */
const KIND_ON = { gift: 'tiktok', share: 'tiktok' };
const KINDS = ['follow', 'sub', 'sub_gift_bulk', 'cheer', 'raid', 'gift', 'share'];

const SAID = 'Esto es una prueba del mensaje';

export const SAMPLE_DATA = {
  twitch_cheer: { amount: 500, bits: 500, currency: 'BITS', message: SAID },
  twitch_raid: { amount: 42, viewers: 42, currency: 'VIEWERS' },
  // A tier is a number by the time an alert sees it (twitch.js), not Twitch's "1000".
  twitch_sub: { tier: 1, months: 3, message: SAID },
  twitch_sub_gift_bulk: { count: 5, amount: 5, tier: 1 },
  // Both names a real redemption carries: the Events dock reads `reward`, captions often `rewardName`.
  twitch_redemption: { reward: 'Recompensa de prueba', rewardName: 'Recompensa de prueba', cost: 500, input: SAID },
  // YouTube says the amount as it is shown, currency and all.
  youtube_cheer: { amount: '$5.00', message: SAID },
  youtube_sub: { tier: 'Miembro', months: 3 },
  youtube_sub_gift_bulk: { count: 5, tier: 'Miembro' },
  tiktok_gift: { giftName: 'Rose', count: 10, amount: 10, diamonds: 10, currency: 'DIAMONDS' },
  level_up: { level: 5, xp: 1200, rank: 3 },
  giveaway_winner: { prize: 'Premio de prueba', entrants: 12, reroll: false },
  points_redeem: { item: 'Hidratarse', cost: 500, input: SAID, balance: 1500 },
  obs_scene_changed: { sceneName: 'Gameplay' },
};

/** The type a pretend event for an alert of `type` has: a kind becomes that kind on its platform. */
export function sampleType(type) {
  const t = String(type || '');
  return KINDS.includes(t) ? `${KIND_ON[t] || 'twitch'}_${t}` : t;
}

/**
 * The platform it happened on. Levels, giveaways and the points shop happen
 * to a viewer in a chat, so Twitch; OBS and Spotify are their own.
 */
export function samplePlatform(type) {
  const head = sampleType(type).split('_')[0];
  if (VIEWER_PLATFORMS.includes(head)) return head;
  return ['obs', 'spotify'].includes(head) ? head : 'twitch';
}

/** A pretend event for an alert of `type`, by `user`. */
export function sampleEvent(type, user = 'TestUser') {
  const concrete = sampleType(type);
  const data = { ...(SAMPLE_DATA[concrete] || {}) };
  // A scene change is "by" the scene, as obs.js raises it.
  return { type: concrete, platform: samplePlatform(type), user: concrete === 'obs_scene_changed' ? data.sceneName : user, data };
}
