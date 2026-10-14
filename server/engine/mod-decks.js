/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Each moderator's own dock (2.0.0, "The moderators update").
 *
 * The dock is where a moderator works: the chat as they like to read it, and
 * a deck of buttons laid out for what they do. Shared, one moderator's
 * tidying would rearrange everybody's — the streamer's included — so a
 * moderator has their own copy of three things:
 *
 *   chatDockSettings   how the dock shows the chat, and which tabs it has
 *   dockButtons        the deck: which actions, where, how they look
 *   dockGrid           the deck's shape: columns, rows, pages
 *
 * Until a moderator changes one, theirs is the streamer's as it is now, so a
 * new moderator starts with the streamer's dock rather than an empty one.
 * The first change makes it theirs; from then on the streamer's changes no
 * longer reach it, nor theirs the streamer's. Each of the three on its own:
 * a moderator who only rearranged the deck still reads the chat the
 * streamer's way.
 *
 * Checked exactly as the streamer's are (engine/index.js cleanDockButtons and
 * the rest), and a button whose action has since been deleted drops out when
 * the deck is read, as it does from the streamer's.
 *
 * What the dock shows — the chat, the plan, the questions, the events — is
 * the stream, and the same for everybody; only how it is laid out is a
 * moderator's own.
 */

import { collection } from '../core/store.js';
import * as engine from './index.js';
import * as home from './home.js';

/** The three a moderator keeps, by the name the snapshot gives them. */
export const MOD_OWN = ['chatDockSettings', 'dockButtons', 'dockGrid', 'homeLayouts'];

let prefs = null;

// Keyed by Twitch user id: { [userId]: { login, chatDockSettings?, dockButtons?, dockGrid?, changedAt } }. Made on first use too.
const db = () => (prefs ??= collection('mod_prefs', {}));

export function initModDecks() {
  db();
}

const streamers = () => ({
  chatDockSettings: engine.store.getChatDockSettings(),
  dockButtons: engine.store.getDockButtons(),
  dockGrid: engine.store.getDockGrid(),
  // And the home screen's layout buttons (engine/home.js).
  homeLayouts: home.homeLayouts(),
});

/** A moderator's dock as they see it: their own where they have made it so, the streamer's where not. */
export function dockFor(userId) {
  const mine = (userId && db().get()[userId]) || {};
  const theirs = streamers();
  return {
    chatDockSettings: mine.chatDockSettings || theirs.chatDockSettings,
    // Read again through the check, so a button whose action is gone is gone here too.
    dockButtons: mine.dockButtons ? engine.store.cleanDockButtons(mine.dockButtons) : theirs.dockButtons,
    dockGrid: mine.dockGrid || theirs.dockGrid,
    homeLayouts: mine.homeLayouts || theirs.homeLayouts,
  };
}

/** Whether a moderator has made any of the three their own (for the Moderators screen, and resetting). */
export const hasOwn = (userId) => MOD_OWN.some((k) => Boolean(db().get()[userId]?.[k]));

/**
 * Change one of a moderator's three, checked against what they have now.
 * Answers the value as kept.
 */
export function setFor(identity, key, value) {
  if (!identity?.userId || !MOD_OWN.includes(key)) throw new Error(`no moderator setting "${key}"`);
  const now = dockFor(identity.userId);
  const clean = key === 'dockButtons' ? engine.store.cleanDockButtons(value)
    : key === 'dockGrid' ? engine.store.cleanDockGrid(value, now.dockGrid)
      : key === 'homeLayouts' ? home.cleanHomeLayouts(value)
        : engine.store.cleanChatDock(value, now.chatDockSettings);
  db().update((all) => ({
    ...all,
    [identity.userId]: { ...(all[identity.userId] || {}), login: identity.login || '', [key]: clean, changedAt: Date.now() },
  }));
  return clean;
}

/** Back to the streamer's dock: all three, or one. */
export function resetFor(userId, key) {
  if (!db().get()[userId]) return;
  db().update((all) => {
    if (!key) { const { [userId]: _gone, ...rest } = all; return rest; }
    const { [key]: _k, ...mine } = all[userId];
    return { ...all, [userId]: mine };
  });
}

/** For tests. */
export const _test = { all: () => db().get() };
