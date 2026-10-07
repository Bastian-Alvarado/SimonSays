/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A ledger of who is subscribed, and for how long.
 *
 * Twitch does not offer this as a single question. The two halves come from
 * different places and neither is sufficient alone:
 *
 *   - WHO is subscribed right now: Get Broadcaster Subscriptions. Authoritative,
 *     includes people who never speak — but it does NOT report tenure. Its
 *     fields are the broadcaster, the gifter, is_gift, tier, plan_name and the
 *     user. No months.
 *
 *   - HOW LONG they have been subscribed: the `badge-info` tag on a chat
 *     message, which carries `subscriber/<months>` with the exact cumulative
 *     count. Resub notices carry it too. Both are events, so a month total can
 *     only be LEARNED as it goes past — never fetched.
 *
 * So this accumulates. A subscriber who has not spoken since the server was
 * first run is known to be subscribed but has no month count yet, and is left
 * out of "top subscribers" rather than being guessed at or ranked as zero.
 * Once they say anything, they are placed correctly and stay that way.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('subscribers');

let people = null;

/** Twitch logins are case-insensitive; the ledger keys on the lowered form. */
const key = (name) => String(name || '').trim().toLowerCase();

export function initSubscribers() {
  people = collection('subscribers', {});

  bus.on(EVENTS.CHAT, onChat);
  bus.on(EVENTS.EVENT, onEvent);
  // The authoritative membership list, refreshed by the Twitch connector.
  bus.on(EVENTS.SUBSCRIBER_LIST, onList);
}

/** Merge what we just learned about one person into the ledger. */
function record(name, patch) {
  const id = key(name);
  if (!id || !people) return;

  const prev = people.get()[id] || {};
  const next = {
    name: name || prev.name || id,
    // Months only ever grow. A stale badge on a delayed message must not walk
    // the count backwards.
    months: Math.max(Number(prev.months) || 0, Number(patch.months) || 0),
    tier: patch.tier || prev.tier || '',
    current: patch.current === undefined ? prev.current !== false : patch.current,
    updatedAt: Date.now(),
  };

  const unchanged = prev.months === next.months
    && prev.current === next.current
    && prev.tier === next.tier;
  if (unchanged) return;

  people.set({ ...people.get(), [id]: next });
  bus.emit(EVENTS.CONFIG, { key: 'subscribers', value: topSubscribers() });
}

/**
 * The exact month count Twitch puts on a subscriber's chat message.
 *
 * `badges` carries the DISPLAYED badge tier, which is rounded to whichever
 * milestones the channel has configured — `badge-info` is the precise number,
 * which is the whole reason it exists.
 */
function monthsFromChat(raw) {
  const info = raw?.['badge-info'];
  if (!info) return 0;
  const months = typeof info === 'object' ? info.subscriber : null;
  return Number(months) || 0;
}

function onChat(chat) {
  if (chat.platform !== 'twitch' || !chat.isSub) return;
  const months = monthsFromChat(chat.raw);
  if (!months) return;
  // Speaking with a sub badge is proof of a live subscription, so this also
  // corrects anyone the last membership refresh had marked as lapsed.
  record(chat.user, { months, current: true });
}

function onEvent(event) {
  if (event.type !== 'twitch_sub') return;
  record(event.user, {
    months: Number(event.data?.months) || 1,
    tier: event.data?.tier || '',
    current: true,
  });
}

/**
 * Reconcile against the authoritative list.
 *
 * Anyone absent from it has lapsed and stops counting as a subscriber, but
 * their month total is kept: resubscribing should not start them at zero.
 */
function onList(list) {
  if (!people || !Array.isArray(list)) return;

  const seen = new Set();
  const next = { ...people.get() };

  for (const sub of list) {
    const id = key(sub.user_name || sub.user_login);
    if (!id) continue;
    seen.add(id);
    const prev = next[id] || {};
    next[id] = {
      name: sub.user_name || sub.user_login || prev.name || id,
      months: Number(prev.months) || 0,
      tier: sub.tier || prev.tier || '',
      current: true,
      updatedAt: Date.now(),
    };
  }

  let lapsed = 0;
  for (const [id, entry] of Object.entries(next)) {
    if (seen.has(id) || entry.current === false) continue;
    next[id] = { ...entry, current: false, updatedAt: Date.now() };
    lapsed += 1;
  }

  people.set(next);
  const known = Object.values(next).filter((p) => p.current && p.months > 0).length;
  log.info(`subscriber list refreshed — ${seen.size} current, ${known} with a known tenure, ${lapsed} lapsed`);
  bus.emit(EVENTS.CONFIG, { key: 'subscribers', value: topSubscribers() });
}

/**
 * Current subscribers with a known tenure, longest first.
 *
 * Anyone whose months we have never observed is omitted rather than sorted in
 * at zero — an overlay saying someone is a brand-new subscriber when they have
 * been here three years is worse than not listing them yet.
 */
export function topSubscribers(limit = 10) {
  return Object.values(people?.get() ?? {})
    .filter((p) => p.current && p.months > 0)
    .sort((a, b) => b.months - a.months || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit)
    .map((p) => ({ name: p.name, months: p.months, tier: p.tier }));
}

export const snapshot = () => ({ subscribers: topSubscribers() });
