/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * What viewers did: the events the Events dock lists, the omnibar's "Recent"
 * slot reads and the stream's totals add up.
 *
 * Kept apart from everything else on the event bus — a Spotify track change
 * or an OBS scene switch is an event too, and on a live channel they were 94
 * of the last 100, pushing every follow and raid out of a list meant for
 * the audience.
 *
 * Shared, because the server keeps the list and the totals, and each screen
 * adds a new event to its copy as it arrives, with the same rules.
 */

export const VIEWER_EVENT_TYPES = [
  'twitch_follow', 'twitch_sub', 'twitch_sub_gift_bulk', 'twitch_cheer', 'twitch_raid', 'twitch_redemption',
  'youtube_cheer', 'youtube_sub', 'youtube_sub_gift_bulk',
  'tiktok_follow', 'tiktok_sub', 'tiktok_gift', 'tiktok_share',
];

/** How many are kept. Enough for a stream's worth of what matters. */
export const VIEWER_EVENT_LIMIT = 100;

/**
 * Whether an event goes in the list. One sub of a gifted bundle does not: the
 * bundle's own event says it, and a fifty-sub bomb was fifty rows that pushed
 * everything else out.
 */
export const isViewerEvent = (event) => Boolean(event)
  && VIEWER_EVENT_TYPES.includes(event.type)
  && !event.data?.fromBulk;

/** Add one to a list kept newest first, without repeating one already there. */
export const withViewerEvent = (list, event) => (
  !isViewerEvent(event) || (list || []).some((e) => e.id === event.id)
    ? (list || [])
    : [event, ...(list || [])].slice(0, VIEWER_EVENT_LIMIT)
);

/** The kinds the list can be filtered by. */
export const EVENT_KINDS = ['follow', 'sub', 'support', 'raid', 'redeem', 'share'];

export function kindOf(type) {
  switch (type) {
    case 'twitch_follow': case 'tiktok_follow': return 'follow';
    case 'twitch_sub': case 'twitch_sub_gift_bulk': case 'tiktok_sub': case 'youtube_sub': case 'youtube_sub_gift_bulk': return 'sub';
    case 'twitch_cheer': case 'youtube_cheer': case 'tiktok_gift': return 'support';
    case 'twitch_raid': return 'raid';
    case 'twitch_redemption': return 'redeem';
    case 'tiktok_share': return 'share';
    default: return 'other';
  }
}

// ------------------------------------------------------------ the stream's totals

/**
 * "MX$100.00" → { currency: 'MX$', value: 100 }. YouTube sends a Super Chat's
 * amount as it is shown, in the viewer's currency, so they are added up per
 * currency rather than converted.
 */
export function readMoney(shown) {
  const text = String(shown ?? '').trim();
  const digits = text.match(/[\d.,]+/);
  if (!digits) return null;
  const currency = text.replace(digits[0], '').trim() || '$';
  let number = digits[0];
  // "1.234,56" and "1,234.56": the last separator is the decimal one.
  const lastDot = number.lastIndexOf('.');
  const lastComma = number.lastIndexOf(',');
  if (lastComma > lastDot) number = number.replace(/\./g, '').replace(',', '.');
  else number = number.replace(/,/g, '');
  const value = Number(number);
  return Number.isFinite(value) ? { currency, value } : null;
}

export const emptyTotals = (startedAt = null) => ({
  startedAt,
  follows: 0,
  subs: 0,
  gifted: 0,
  bits: 0,
  raids: 0,
  raiders: 0,
  members: 0,
  superChat: {},
  redeems: 0,
  tiktokGifts: 0,
  shares: 0,
});

/** The totals with one more event in them. */
export function addToTotals(totals, event) {
  if (!isViewerEvent(event)) return totals;
  const t = { ...emptyTotals(), ...totals, superChat: { ...(totals?.superChat || {}) } };
  const d = event.data || {};
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  switch (event.type) {
    case 'twitch_follow': case 'tiktok_follow': t.follows += 1; break;
    case 'twitch_sub':
      // A single gift outside a bundle is a sub given, not a sub bought.
      if (d.giftedBy) t.gifted += 1; else t.subs += 1;
      break;
    case 'tiktok_sub': t.subs += 1; break;
    case 'twitch_sub_gift_bulk': t.gifted += n(d.count) || 1; break;
    case 'twitch_cheer': t.bits += n(d.bits ?? d.amount); break;
    case 'twitch_raid': t.raids += 1; t.raiders += n(d.viewers ?? d.amount); break;
    case 'twitch_redemption': t.redeems += 1; break;
    case 'youtube_sub': t.members += 1; break;
    case 'youtube_sub_gift_bulk': t.gifted += n(d.count) || 1; break;
    case 'youtube_cheer': {
      const money = readMoney(d.amount);
      if (money) t.superChat[money.currency] = Math.round(((t.superChat[money.currency] || 0) + money.value) * 100) / 100;
      break;
    }
    case 'tiktok_gift': t.tiktokGifts += n(d.count) || 1; break;
    case 'tiktok_share': t.shares += 1; break;
    default: break;
  }
  return t;
}

// ------------------------------------------------------------ thanking somebody

/** Events a "Thank" can answer: Twitch's, since that is the chat the bot speaks in. */
export const canThank = (event) => Boolean(event?.platform === 'twitch' && isViewerEvent(event));

/** The default line, in the stream's language. {user} is who, {what} is what they did. */
export const DEFAULT_THANKS = '¡Gracias, @{user}, por {what}! 💜';

/**
 * Who to thank for an event, and for what, in the stream's language — "la
 * raid", "los 100 bits". A gifted sub thanks whoever gave it.
 */
export function thanksFor(event) {
  const d = event?.data || {};
  const who = event?.user || '';
  switch (event?.type) {
    case 'twitch_follow': return { user: who, what: 'el follow' };
    case 'twitch_sub':
      if (d.giftedBy) return { user: d.giftedBy, what: `regalarle una sub a ${who}` };
      if (Number(d.months) > 1) return { user: who, what: `los ${d.months} meses de sub` };
      return { user: who, what: d.prime ? 'la sub con Prime' : 'la sub' };
    case 'twitch_sub_gift_bulk': return { user: who, what: `las ${d.count || ''} subs de regalo`.replace('  ', ' ') };
    case 'twitch_cheer': return { user: who, what: `los ${d.bits ?? d.amount} bits` };
    case 'twitch_raid': return { user: who, what: 'la raid' };
    case 'twitch_redemption': return { user: who, what: `canjear «${d.reward || d.rewardName || ''}»` };
    default: return { user: who, what: 'el apoyo' };
  }
}
