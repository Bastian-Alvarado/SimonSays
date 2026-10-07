/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Profiles: several saved configurations per area, one live at a time.
 *
 * The live collections stay exactly where they are and keep exactly their
 * shape. Switching a profile snapshots the collections it covers into the
 * profile being left, then writes the incoming one back through the same save
 * paths a normal edit uses. Nothing downstream learns that profiles exist —
 * `db.commands.get()` still returns an array, and the engine, the matchers and
 * every view are untouched.
 *
 * Profiles are grouped rather than per-collection because the data is linked.
 * A dock button names an action by id and is *dropped* by its validator when
 * that action is missing; an action names the command that triggers it. Swap
 * commands without actions and most actions lose their trigger; swap actions
 * without dock buttons and buttons quietly disappear. So those three move
 * together or not at all.
 */

import { collection, getCollection } from '../core/store.js';
import { createLogger } from '../core/logger.js';
import * as cooldowns from './cooldowns.js';

const log = createLogger('profiles');

/**
 * What can be profiled, and what moves together.
 *
 * Collection order within a group is significant: a collection is written back
 * in this order, and dock buttons validate against the actions that must
 * already be in place. Actions before buttons, always.
 *
 * Deliberately absent: `users`, `accounts` and `subscribers`, which accumulate
 * rather than being configured — switching a profile would look exactly like
 * every viewer losing their levels and tenure. Credentials likewise.
 */
export const PROFILE_GROUPS = [
  {
    id: 'automation',
    label: 'Commands & actions',
    collections: ['commands', 'actions', 'dock_buttons'],
  },
  {
    id: 'alerts',
    label: 'Alerts',
    collections: ['alerts'],
  },
  {
    id: 'overlays',
    label: 'Overlays',
    // The chat on stream too: each chat layer keeps its own look, so it travels
    // with its layout. There was a chat group of its own, which meant switching
    // the stream's look and then remembering to switch the chat's as well. The
    // dock is in neither — it keeps its own set, so the desk stays put.
    collections: ['layouts', 'omnibar', 'omnibars', 'viewers'],
  },
  // Discord is deliberately not here. Reaction roles, the welcome message and
  // the role mappings describe one server and do not change with what is being
  // streamed, so profiles for them would be four more things to keep in sync
  // for no benefit.
];

const GROUP_IDS = PROFILE_GROUPS.map((g) => g.id);
const groupById = (id) => PROFILE_GROUPS.find((g) => g.id === id);

/** As many saved configurations per area as anyone could keep track of. */
export const MAX_PROFILES_PER_GROUP = 12;

const DEFAULT_PROFILE_ID = 'default';
const DEFAULT_PROFILE_NAME = 'Main';

let db = null;
/** Supplied by the engine so writes go through the validation a save gets. */
let writers = {};

const safeName = (v, fallback) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, 60) : fallback;
};

/** Ids address a profile over the wire, so they are held to something simple. */
const safeId = (v) => {
  const s = String(v ?? '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : Math.random().toString(36).slice(2, 11);
};

/** One group's stored shape, filled in and bounded. */
function normaliseGroup(incoming, group) {
  const seen = new Set();
  let profiles = (Array.isArray(incoming?.profiles) ? incoming.profiles : [])
    .map((p) => ({
      id: safeId(p?.id),
      name: safeName(p?.name, 'Profile'),
      // The contents of a profile are whatever the collections held when it
      // was last left. Stored verbatim: they are validated on the way back in,
      // by the same code that validates a normal save.
      data: (p?.data && typeof p.data === 'object') ? p.data : {},
    }))
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .slice(0, MAX_PROFILES_PER_GROUP);

  // Every group always has at least one profile, and it is whatever is live.
  if (profiles.length === 0) {
    profiles = [{ id: DEFAULT_PROFILE_ID, name: DEFAULT_PROFILE_NAME, data: {} }];
  }

  const active = profiles.some((p) => p.id === incoming?.active) ? incoming.active : profiles[0].id;
  // The label lives in PROFILE_GROUPS and is read from there. Storing a copy
  // meant a renamed group kept its old name on disk forever.
  return { active, profiles };
}

export function initProfiles(collectionWriters = {}) {
  writers = collectionWriters;
  db = collection('profiles', {});
  // Heal on boot so a group added in a later version appears with a default
  // rather than being missing until somebody saves.
  db.update((prev) => {
    const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
    for (const group of PROFILE_GROUPS) next[group.id] = normaliseGroup(next[group.id], group);
    for (const key of Object.keys(next)) if (!GROUP_IDS.includes(key)) delete next[key];
    return next;
  });
  /*
    Adopt whatever is already configured as the first profile.

    On a fresh install — or the first boot after this feature existed — the
    default profile has no contents while the collections are full of somebody's
    real setup. Left alone, every group would report unsaved changes before they
    had touched anything, which is the same permanent amber warning this design
    goes out of its way to avoid.

    Only when the active profile is genuinely empty, so it can never overwrite a
    profile somebody actually saved.
  */
  for (const group of PROFILE_GROUPS) {
    const state = db.get()[group.id];
    const active = state.profiles.find((p) => p.id === state.active);
    if (active && Object.keys(active.data || {}).length === 0) {
      captureActive(group.id);
      log.info(`${group.id}: adopted the current configuration as "${active.name}"`);
      continue;
    }
    /*
      A collection added to a group after its profile was saved — the other
      omnibars, joining Overlays — is missing from that profile, and a missing
      collection reads as a change. So the active profile takes what is live
      for just the ones it lacks, which is what it would have held had the
      collection existed when it was saved. Nothing it already holds is
      touched. Other profiles are left alone: switching to one simply leaves a
      collection it never had as it is.
    */
    const missing = group.collections.filter((name) => active && !(name in (active.data || {})) && getCollection(name));
    if (missing.length) {
      db.update((prev) => ({
        ...prev,
        [group.id]: {
          ...prev[group.id],
          profiles: prev[group.id].profiles.map((p) => (p.id !== active.id ? p : {
            ...p,
            data: { ...p.data, ...Object.fromEntries(missing.map((name) => [name, structuredClone(getCollection(name).get())])) },
          })),
        },
      }));
      log.info(`${group.id}: "${active.name}" now also keeps ${missing.join(', ')}`);
    }
  }

  log.info(`ready — ${PROFILE_GROUPS.length} groups, ${PROFILE_GROUPS.reduce((n, g) => n + db.get()[g.id].profiles.length, 0)} profiles`);
}

/**
 * Rewrite one collection in every saved profile of a group, for an upgrade
 * that changes what the collection holds — so a profile saved before is
 * brought along without being switched to, and the active one's saved copy
 * keeps matching what is live. Writes only when something changed; answers
 * how many profiles did.
 */
export function rewriteSaved(groupId, name, rewrite) {
  const state = db.get()[groupId];
  if (!state) return 0;
  let changed = 0;
  const profiles = state.profiles.map((p) => {
    if (!p.data || !(name in p.data)) return p;
    const next = rewrite(p.data[name]);
    if (canonical(next) === canonical(p.data[name])) return p;
    changed += 1;
    return { ...p, data: { ...p.data, [name]: next } };
  });
  if (changed) db.update((prev) => ({ ...prev, [groupId]: { ...prev[groupId], profiles } }));
  return changed;
}

/** One collection as every profile of a group saved it, for a change that has to reach them all. */
export function savedData(groupId, name) {
  const state = db.get()[groupId];
  return (state?.profiles || []).filter((p) => p.data && name in p.data).map((p) => p.data[name]);
}

/** Read every collection in a group as it stands right now. */
function snapshotLive(group) {
  const data = {};
  for (const name of group.collections) {
    const c = getCollection(name);
    if (c) data[name] = structuredClone(c.get());
  }
  return data;
}

/**
 * Write a group's collections back.
 *
 * Through the engine's own setters where one exists, so the same validation a
 * normal save performs still runs — dock buttons pointing at an action that is
 * not in this profile get dropped here rather than breaking a surface later.
 */
function applyToLive(group, data) {
  for (const name of group.collections) {
    if (!(name in data)) continue;
    const value = data[name];
    if (value === undefined || value === null) continue;

    const writer = writers[name];
    if (writer) { writer(value); continue; }

    const c = getCollection(name);
    if (c) c.set(structuredClone(value));
  }
}

/**
 * What a client needs to render the switcher: names and which one is live.
 *
 * Deliberately without the contents. Every connected surface receives the
 * snapshot, and shipping every saved command, action and alert to each of them
 * would be several times the size of the configuration actually in use.
 */
export function summary() {
  const state = db.get();
  return PROFILE_GROUPS.map((group) => {
    const stored = state[group.id];
    return {
      id: group.id,
      label: group.label,
      collections: group.collections,
      active: stored.active,
      // So the editor can offer Save, and warn before a switch would discard.
      dirty: isDirty(group, stored.profiles.find((p) => p.id === stored.active)),
      profiles: stored.profiles.map((p) => ({
        id: p.id,
        name: p.name,
        // Counted from what is live for the active one, since its stored copy
        // is only refreshed when it is switched away from.
        items: p.id === stored.active
          ? group.collections.reduce((n, c) => n + countOf(getCollection(c)?.get()), 0)
          : group.collections.reduce((n, c) => n + countOf(p.data?.[c]), 0),
      })),
    };
  });
}

const countOf = (v) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? 1 : 0);

/**
 * Does the live configuration differ from what the active profile has saved?
 *
 * Compared by serialising rather than by a flag, because edits arrive through
 * a dozen different save paths and every one of them would have to remember to
 * set the flag. This cannot forget.
 *
 * The comparison is only sound because a profile is re-captured immediately
 * after being applied: the writers normalise on the way in, so a profile saved
 * before some validation rule existed would otherwise read as permanently
 * unsaved.
 */
function isDirty(group, profile) {
  if (!profile) return false;
  for (const name of group.collections) {
    const liveValue = getCollection(name)?.get();
    const savedValue = profile.data?.[name];
    if (savedValue === undefined) return true;
    if (canonical(liveValue) !== canonical(savedValue)) return true;
  }
  return false;
}

/**
 * JSON with every object's keys in one order, so two copies of the same
 * settings compare equal however each was built.
 *
 * Plain JSON.stringify keeps the order keys were written in, and the save
 * paths rebuild objects in their own order — the chat overlay's settings
 * sat permanently "unsaved" with nothing different but the order of their
 * keys. Arrays keep their order: a list of commands in a different order is
 * a different list.
 */
function canonical(value) {
  return JSON.stringify(value, (_key, v) => (
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v
  ));
}

/**
 * Put the active profile's saved copy back, throwing away anything since.
 *
 * The counterpart to saving. Without it "save" would be a button whose only
 * effect was invisible: there would be no state it protected you from.
 */
export function revertActive(groupId) {
  const group = groupById(groupId);
  if (!group) throw new Error(`no such profile group: ${groupId}`);
  const state = db.get()[groupId];
  const active = state.profiles.find((p) => p.id === state.active);
  if (!active) throw new Error('no active profile to revert to');
  applyToLive(group, active.data || {});
  // Re-capture so the saved copy matches what the validators produced, or the
  // group would read as unsaved the instant it was reverted.
  captureActive(groupId);
  log.info(`${groupId}: reverted to the saved "${active.name}"`);
  return summary();
}

/** Save what is live into the active profile, without switching anything. */
export function captureActive(groupId) {
  const group = groupById(groupId);
  if (!group) throw new Error(`no such profile group: ${groupId}`);
  db.update((prev) => {
    const g = prev[groupId];
    return {
      ...prev,
      [groupId]: {
        ...g,
        profiles: g.profiles.map((p) => (p.id === g.active ? { ...p, data: snapshotLive(group) } : p)),
      },
    };
  });
  return summary();
}

/**
 * Make `profileId` the live one.
 *
 * The outgoing profile is snapshotted first, always. Without that, switching
 * away would throw away everything edited since the last switch — and nobody
 * expects picking a different profile to be destructive.
 */
export function switchProfile(groupId, profileId) {
  const group = groupById(groupId);
  if (!group) throw new Error(`no such profile group: ${groupId}`);
  const state = db.get()[groupId];
  const target = state.profiles.find((p) => p.id === profileId);
  if (!target) throw new Error(`no such profile: ${profileId}`);
  if (target.id === state.active) return summary();

  // The outgoing profile is always saved. Switching is confirmed in the editor,
  // and confirming it is taken to mean the work so far is wanted — so there is
  // no path here that loses it, and no discard flag a client could get wrong.
  //
  // The cost is that switching away can no longer be used to abandon changes:
  // it moves the restore point. Reverting is how you throw work away, and it
  // has to happen before the switch rather than after.
  captureActive(groupId);

  // Re-read: captureActive has just rewritten the outgoing profile's contents.
  const fresh = db.get()[groupId].profiles.find((p) => p.id === profileId);
  applyToLive(group, fresh.data || {});
  db.update((prev) => ({ ...prev, [groupId]: { ...prev[groupId], active: profileId } }));
  // Capture immediately, so the saved copy is what the validators actually
  // produced. Without this the group reads as unsaved the moment it loads,
  // because the stored data predates whatever normalisation has since been
  // added and the comparison would never match.
  captureActive(groupId);

  // A cooldown is keyed by command id and would otherwise outlive the command
  // it belonged to — leaving a fresh profile's command on cooldown for
  // something the previous profile did.
  cooldowns.reset();

  log.info(`${groupId}: switched to "${fresh.name}"`);
  return summary();
}

/** A new, empty profile. Creating does not switch to it. */
export function createProfile(groupId, name) {
  const group = groupById(groupId);
  if (!group) throw new Error(`no such profile group: ${groupId}`);
  const state = db.get()[groupId];
  if (state.profiles.length >= MAX_PROFILES_PER_GROUP) {
    throw new Error(`that is already ${MAX_PROFILES_PER_GROUP} profiles`);
  }
  const profile = {
    id: Math.random().toString(36).slice(2, 11),
    name: safeName(name, `Profile ${state.profiles.length + 1}`),
    // Empty rather than a copy: a new profile is for a different setup. Use
    // duplicate when the point is to start from what is already there.
    data: Object.fromEntries(group.collections.map((c) => [c, emptyFor(c)])),
  };
  db.update((prev) => ({ ...prev, [groupId]: { ...prev[groupId], profiles: [...prev[groupId].profiles, profile] } }));
  return summary();
}

/** A copy of the live configuration under a new name. Does not switch. */
export function duplicateProfile(groupId, name) {
  const group = groupById(groupId);
  if (!group) throw new Error(`no such profile group: ${groupId}`);
  const state = db.get()[groupId];
  if (state.profiles.length >= MAX_PROFILES_PER_GROUP) {
    throw new Error(`that is already ${MAX_PROFILES_PER_GROUP} profiles`);
  }
  const active = state.profiles.find((p) => p.id === state.active);
  const profile = {
    id: Math.random().toString(36).slice(2, 11),
    name: safeName(name, `${active?.name || 'Profile'} copy`),
    // From what is live, not from the active profile's stored copy, which is
    // only as fresh as the last switch.
    data: snapshotLive(group),
  };
  db.update((prev) => ({ ...prev, [groupId]: { ...prev[groupId], profiles: [...prev[groupId].profiles, profile] } }));
  return summary();
}

export function renameProfile(groupId, profileId, name) {
  if (!groupById(groupId)) throw new Error(`no such profile group: ${groupId}`);
  db.update((prev) => ({
    ...prev,
    [groupId]: {
      ...prev[groupId],
      profiles: prev[groupId].profiles.map((p) => (p.id === profileId ? { ...p, name: safeName(name, p.name) } : p)),
    },
  }));
  return summary();
}

/**
 * Remove a profile.
 *
 * The live one cannot be deleted: there would be nothing to fall back to, and
 * the collections currently loaded would belong to a profile that no longer
 * exists. Switch away first — which is also a moment to notice what is about
 * to be lost.
 */
export function deleteProfile(groupId, profileId) {
  const group = groupById(groupId);
  if (!group) throw new Error(`no such profile group: ${groupId}`);
  const state = db.get()[groupId];
  if (state.active === profileId) throw new Error('switch to another profile before deleting this one');
  if (state.profiles.length <= 1) throw new Error('a group keeps at least one profile');
  db.update((prev) => ({
    ...prev,
    [groupId]: { ...prev[groupId], profiles: prev[groupId].profiles.filter((p) => p.id !== profileId) },
  }));
  return summary();
}

/** What an empty version of a collection looks like: a list, or an object. */
function emptyFor(name) {
  const current = getCollection(name)?.get();
  return Array.isArray(current) ? [] : {};
}
