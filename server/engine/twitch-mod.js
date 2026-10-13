/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Moderating Twitch chat from the app (2.0.0, "The moderators update"):
 * from a message in the dock — delete it, time its sender out, ban or unban
 * them — the chat's modes, what AutoMod holds back, and the same from an
 * action's steps.
 *
 * Done as whoever pressed. A moderator signed in with Twitch acts with their
 * own sign-in when it allows that (api/auth.js modActingToken), so Twitch's
 * own mod log says it was them; anybody else, an action, or a moderator
 * whose sign-in is from before these were asked for, acts through the
 * channel's login. Either way the app's record says who (engine/mod-activity.js).
 *
 * AutoMod's held messages arrive over EventSub (platforms/twitch.js), are
 * kept here while they wait, newest first, and go to every dock as
 * `automodHeld`. Twitch says when one is decided, here or anywhere else, or
 * runs out, and it leaves the list.
 */

import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as twitch from '../platforms/twitch.js';

const log = createLogger('twitch-mod');

/** The scope each kind of moderating needs on the token that does it. */
export const SCOPE = {
  ban: 'moderator:manage:banned_users',
  timeout: 'moderator:manage:banned_users',
  unban: 'moderator:manage:banned_users',
  delete: 'moderator:manage:chat_messages',
  chatSettings: 'moderator:manage:chat_settings',
  automod: 'moderator:manage:automod',
};
/** Longest timeout Twitch takes: two weeks. */
const MAX_TIMEOUT = 1_209_600;
const HELD_LIMIT = 50;

let held = [];
let actingToken = () => null;

/**
 * `tokenFor(identity, scope)` answers a moderator's own { token, userId } when
 * their sign-in allows that scope, or null for the channel's login to act.
 */
export function initTwitchMod({ tokenFor } = {}) {
  if (tokenFor) actingToken = tokenFor;
  twitch.onAutomod(onAutomod);
}

const publish = () => bus.emit(EVENTS.CONFIG, { key: 'automodHeld', value: held });
export const heldNow = () => held;

function onAutomod(kind, e) {
  const msgId = String(e?.message_id || '');
  if (!msgId) return;
  if (kind === 'hold') {
    const text = typeof e.message === 'string' ? e.message : String(e.message?.text || '');
    // Why: the category AutoMod saw, or the blocked term it found.
    const reason = e.automod?.category || e.category || (e.blocked_term?.terms_found?.[0]?.text ? `“${e.blocked_term.terms_found[0].text}”` : '') || e.reason || '';
    held = [{ msgId, userId: String(e.user_id || ''), login: String(e.user_login || ''), name: String(e.user_name || e.user_login || ''), text: text.slice(0, 500), reason: String(reason).slice(0, 60), at: Date.now() },
      ...held.filter((h) => h.msgId !== msgId)].slice(0, HELD_LIMIT);
  } else {
    // Let through, kept out or run out — here, on Twitch's own screens, by anybody.
    held = held.filter((h) => h.msgId !== msgId);
  }
  publish();
}

const asFor = (identity, scope) => (identity?.role === 'mod' ? actingToken(identity, scope) : null);

/** From the dock or the Chat dock screen (C2S.TWITCH_MOD): what to do, and as whom. */
export async function control(identity, payload = {}) {
  const op = payload.op;
  const userId = String(payload.userId || '');
  // Never the channel itself, which Twitch would refuse anyway, with less to say.
  if (['ban', 'timeout', 'unban'].includes(op) && userId && userId === String(twitch.getCredentials().userId)) {
    throw refusal('mod_not_streamer', 'the streamer cannot be moderated');
  }
  const by = identity?.login || '';
  switch (op) {
    case 'timeout':
      if (!userId) throw refusal('unknown_request', 'nobody named');
      return twitch.banUser(userId, { seconds: Math.min(MAX_TIMEOUT, Math.max(1, Math.round(Number(payload.seconds) || 600))), reason: by ? `por ${by}` : '', as: asFor(identity, SCOPE.timeout) });
    case 'ban':
      if (!userId) throw refusal('unknown_request', 'nobody named');
      return twitch.banUser(userId, { reason: String(payload.reason || (by ? `por ${by}` : '')).slice(0, 500), as: asFor(identity, SCOPE.ban) });
    case 'unban':
      if (!userId) throw refusal('unknown_request', 'nobody named');
      return twitch.unbanUser(userId, { as: asFor(identity, SCOPE.unban) });
    case 'delete':
      return twitch.deleteChatMessage(String(payload.msgId || ''), { as: asFor(identity, SCOPE.delete) });
    case 'get-chat-settings':
      return twitch.getChatSettings();
    case 'chat-settings':
      return twitch.updateChatSettings(payload.settings || {}, { as: asFor(identity, SCOPE.chatSettings) });
    case 'automod': {
      const msgId = String(payload.msgId || '');
      const done = await twitch.resolveAutomod(msgId, payload.allow === true, { as: asFor(identity, SCOPE.automod) });
      // Gone from every dock now, rather than when Twitch gets round to saying so.
      held = held.filter((h) => h.msgId !== msgId);
      publish();
      return done;
    }
    default:
      throw refusal('unknown_request', `no Twitch moderation op "${op}"`);
  }
}

/**
 * The moderation steps in actions (engine/steps.js), through the channel's
 * login. `target` is a name ("{user}", "{input}", "@someone"); the person
 * who set the action off is known by id already, anybody else is looked up.
 */
export async function step(cfg, ctx) {
  const what = cfg.what;
  if (what === 'delete') {
    // The message that set the action off, when it was a Twitch one.
    if (ctx?.user?.platform !== 'twitch' || !ctx.chatId) return;
    await twitch.deleteChatMessage(ctx.chatId);
    return;
  }
  if (what === 'chat_mode') {
    const on = cfg.on !== false;
    const patch = cfg.mode === 'emote' ? { emoteOnly: on }
      : cfg.mode === 'followers' ? { followersOnly: on }
        : cfg.mode === 'subscribers' ? { subscribersOnly: on }
          : { slow: on, slowSeconds: cfg.seconds };
    await twitch.updateChatSettings(patch);
    return;
  }
  const name = String(cfg.targetName || '').trim().replace(/^@/, '').split(/\s+/)[0];
  if (!name) return;
  let id = '';
  if (ctx?.user?.platform === 'twitch' && ctx.user.id && String(ctx.user.name || '').toLowerCase() === name.toLowerCase()) id = String(ctx.user.id);
  else id = String((await twitch.getUser(name.toLowerCase()).catch(() => null))?.id || '');
  if (!id) { log.warn(`moderation step: nobody called "${name}" on Twitch`); return; }
  if (id === String(twitch.getCredentials().userId)) return;
  if (what === 'unban') await twitch.unbanUser(id);
  else if (what === 'ban') await twitch.banUser(id, { reason: String(cfg.reason || '').slice(0, 500) });
  else await twitch.banUser(id, { seconds: Math.min(MAX_TIMEOUT, Math.max(1, Math.round(Number(cfg.seconds) || 600))), reason: String(cfg.reason || '').slice(0, 500) });
}

/** For tests: AutoMod as if Twitch had said it. */
export const _test = { automod: (kind, e) => onAutomod(kind, e), reset: () => { held = []; } };
