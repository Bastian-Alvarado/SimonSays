/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The pixel avatars drawn in the Pixel avatars tab: kept here, handed to
 * every screen, and changed one whole avatar at a time.
 *
 * The built-in pixel avatar is not one of them and is never touched from
 * here. The examples (shared/pixel-avatar-examples.js) are seeded once:
 * edited, they stay edited, deleted they stay deleted — unless put back from
 * the tab — and an example added later arrives on the next start. One
 * nobody has changed catches up with the example as shipped (catchUp).
 *
 * What is stored is only ever what cleanPixelAvatar (shared/pixel-avatars.js)
 * hands back, so every avatar kept is one the screens can draw.
 */

import { createHash } from 'node:crypto';
import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { refusal } from '../core/refusal.js';
import { createLogger } from '../core/logger.js';
import { cleanPixelAvatar, blankPixelAvatar } from '../../shared/pixel-avatars.js';
import { pixelAvatarExamples, pixelAvatarExample } from '../../shared/pixel-avatar-examples.js';

const log = createLogger('pixel-avatars');

/** How many can be kept: each is up to a couple of hundred KB, and every screen is sent all of them. */
export const MAX_PIXEL_AVATARS = 40;

let db = null;
/*
  Earlier versions of each avatar, newest first: every time one is changed,
  what it was before is kept, up to VERSIONS_KEPT of them. Kept apart from
  the avatars, and not handed to the screens — only to the tab, when asked.
*/
let versions = null;
export const VERSIONS_KEPT = 12;

export function initPixelAvatars() {
  db = collection('pixel_avatars', { items: [], seeded: [] });
  versions = collection('pixel_avatar_versions', { items: {} });
  seedExamples();
}

/** Any example not seeded before, added: once each, so one deleted stays deleted. Then the unchanged ones catch up. */
function seedExamples() {
  const { items, seeded } = db.get();
  const fresh = pixelAvatarExamples().filter((e) => !seeded.includes(e.example));
  if (fresh.length) {
    const added = [];
    for (const e of fresh) {
      try {
        added.push(cleanPixelAvatar(e));
      } catch (err) {
        log.warn(`the ${e.example} example could not be made: ${err.message}`);
      }
    }
    const marks = { ...(db.get().seededAs || {}) };
    for (const a of added) marks[a.example] = fingerprint(a);
    db.set({ ...db.get(), items: [...added, ...items.filter((i) => !added.some((a) => a.id === i.id))], seeded: [...seeded, ...fresh.map((e) => e.example)], seededAs: marks });
  }
  catchUp();
}

/** What an avatar is, as one short string: the same for the same avatar, to tell whether it was changed. */
const fingerprint = (pa) => createHash('sha1').update(JSON.stringify(pa)).digest('hex');

/** The same avatar with its front view's outfits and extras set aside: what no example had before they existed. */
function frontless(pa) {
  const c = structuredClone(pa);
  if (c.turn?.front) { c.turn.front.outfits = []; c.turn.front.extras = []; }
  return c;
}

/*
  An example nobody has changed catches up with the example as shipped, so
  an update that draws more of one — Sandwichxample's outfits and extras
  from the front, added after it first shipped — reaches the copy in the
  tab, under whatever name it has there. One changed in any way is left as
  it is; "Put back" brings the new one. What it was is kept as a version.

  Unchanged is: exactly the copy that was seeded or last caught up, by its
  fingerprint (seededAs). A copy seeded before fingerprints were kept has
  none; for it, unchanged is the example as shipped with what no example
  had then — front outfits and extras — set aside on both sides.
*/
function catchUp(now = Date.now()) {
  const state = db.get();
  const items = [...state.items];
  const marks = { ...(state.seededAs || {}) };
  let changed = false;
  for (const e of pixelAvatarExamples()) {
    const at = items.findIndex((i) => i.id === e.id && i.example === e.example);
    if (at < 0) continue;
    let held; let shipped;
    try {
      held = cleanPixelAvatar(items[at]);
      shipped = cleanPixelAvatar({ ...e, name: items[at].name });
    } catch (err) {
      log.warn(`the ${e.example} example could not be compared: ${err.message}`);
      continue;
    }
    // A copy that is the one shipped is unchanged whatever came before — edited into it, or shipped from it — and catches up from here.
    const untouched = fingerprint(held) === fingerprint(shipped) || (marks[e.example]
      ? fingerprint(items[at]) === marks[e.example]
      : fingerprint(frontless(held)) === fingerprint(frontless(shipped)));
    if (!untouched) continue;
    if (fingerprint(held) !== fingerprint(shipped)) {
      const before = items[at];
      versions.update((v) => {
        const list = v.items[before.id] || [];
        v.items[before.id] = [{ at: Math.max(now, (list[0]?.at ?? 0) + 1), avatar: before }, ...list].slice(0, VERSIONS_KEPT);
      });
      items[at] = shipped;
      changed = true;
      log.info(`the ${e.example} example caught up with the one shipped`);
    }
    // Saved only when something is new: nothing is written on a start that changes nothing.
    const mark = fingerprint(items[at]);
    if (marks[e.example] !== mark) { marks[e.example] = mark; changed = true; }
  }
  if (changed) db.set({ ...db.get(), items, seededAs: marks });
}

/** An example put back as shipped: from here on it catches up again. */
function markShipped(avatar) {
  if (!avatar?.example) return;
  db.update((v) => { v.seededAs = { ...(v.seededAs || {}), [avatar.example]: fingerprint(find(avatar.id)) }; });
}

export const getPixelAvatars = () => db?.get().items ?? [];

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'pixelAvatars', value: getPixelAvatars() });
}

const newId = () => `pa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function kept(raw) {
  try {
    return cleanPixelAvatar(raw);
  } catch (err) {
    throw refusal('pixel_avatar_invalid', err.message, { why: err.message });
  }
}

function put(avatar, now = Date.now()) {
  const before = find(avatar.id);
  // What it was, kept — unless nothing about it changed.
  if (before && JSON.stringify(before) !== JSON.stringify(avatar)) {
    versions.update((v) => {
      const list = v.items[avatar.id] || [];
      // Each version known by when it was left, never two at once: a quick second save is a millisecond later.
      const at = Math.max(now, (list[0]?.at ?? 0) + 1);
      v.items[avatar.id] = [{ at, avatar: before }, ...list].slice(0, VERSIONS_KEPT);
    });
  }
  db.update((v) => {
    const at = v.items.findIndex((i) => i.id === avatar.id);
    if (at >= 0) v.items[at] = avatar; else v.items.push(avatar);
  });
  publish();
  return { ok: true, id: avatar.id };
}

const find = (id) => getPixelAvatars().find((i) => i.id === id) || null;

/**
 * Everything the tab can ask for:
 *   save { avatar }      the whole avatar, replacing the one with its id, or added
 *   create { name }      a new, empty one
 *   duplicate { id }     a copy to change, no longer an example
 *   rename { id, name }
 *   delete { id }
 *   reset { id }         an example put back as the built-in one draws it
 *   restore-examples     any example deleted, back again
 *   versions { id }      its earlier versions, newest first: { at, avatar }
 *   restore { id, at }   an earlier version brought back; what it is now becomes one
 */
export function control(payload = {}) {
  const { op } = payload;
  if (op === 'save') {
    const avatar = kept(payload.avatar);
    if (!find(avatar.id) && getPixelAvatars().length >= MAX_PIXEL_AVATARS) throw refusal('pixel_avatar_full', `there are already ${MAX_PIXEL_AVATARS} pixel avatars`);
    return put(avatar);
  }
  if (op === 'create') {
    if (getPixelAvatars().length >= MAX_PIXEL_AVATARS) throw refusal('pixel_avatar_full', `there are already ${MAX_PIXEL_AVATARS} pixel avatars`);
    return put(kept(blankPixelAvatar(newId(), String(payload.name ?? '').trim() || 'New avatar')));
  }
  const avatar = find(payload.id);
  if (op === 'restore-examples') {
    const missing = pixelAvatarExamples().filter((e) => !getPixelAvatars().some((i) => i.id === e.id));
    for (const e of missing) { const back = kept(e); put(back); markShipped(back); }
    return { ok: true, restored: missing.length };
  }
  if (!avatar) throw refusal('pixel_avatar_missing', 'there is no pixel avatar like that');
  if (op === 'duplicate') {
    if (getPixelAvatars().length >= MAX_PIXEL_AVATARS) throw refusal('pixel_avatar_full', `there are already ${MAX_PIXEL_AVATARS} pixel avatars`);
    const { example, ...rest } = avatar;
    return put(kept({ ...structuredClone(rest), id: newId(), name: `${avatar.name} (copy)`.slice(0, 60) }));
  }
  if (op === 'rename') return put(kept({ ...avatar, name: payload.name }));
  if (op === 'versions') return { ok: true, versions: versions.get().items[avatar.id] || [] };
  if (op === 'restore') {
    const old = (versions.get().items[avatar.id] || []).find((x) => x.at === Number(payload.at));
    if (!old) throw refusal('pixel_avatar_no_version', 'there is no version like that');
    return put(kept({ ...old.avatar, id: avatar.id }));
  }
  if (op === 'delete') {
    versions.update((v) => { delete v.items[avatar.id]; });
    db.update((v) => { v.items = v.items.filter((i) => i.id !== avatar.id); });
    publish();
    return { ok: true };
  }
  if (op === 'reset') {
    const fresh = avatar.example && pixelAvatarExample(avatar.example);
    if (!fresh) throw refusal('pixel_avatar_not_example', 'only an example can be put back');
    const done = put(kept({ ...fresh, id: avatar.id, name: avatar.name }));
    markShipped(avatar);
    return done;
  }
  throw refusal('pixel_avatar_op', 'that is not something the pixel avatars do');
}

export const snapshot = () => ({ pixelAvatars: getPixelAvatars() });

/** For tests: everything back to how a fresh install starts. */
export function resetForTests() {
  versions.set({ items: {} });
  db.set({ items: [], seeded: [], seededAs: {} });
  seedExamples();
}

/** For tests: the examples caught up as on a start. */
export const catchUpForTests = (now) => catchUp(now);
