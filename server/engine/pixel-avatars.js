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
 * the tab — and an example added later arrives on the next start.
 *
 * What is stored is only ever what cleanPixelAvatar (shared/pixel-avatars.js)
 * hands back, so every avatar kept is one the screens can draw.
 */

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

/** Any example not seeded before, added: once each, so one deleted stays deleted. */
function seedExamples() {
  const { items, seeded } = db.get();
  const fresh = pixelAvatarExamples().filter((e) => !seeded.includes(e.example));
  if (!fresh.length) return;
  const added = [];
  for (const e of fresh) {
    try {
      added.push(cleanPixelAvatar(e));
    } catch (err) {
      log.warn(`the ${e.example} example could not be made: ${err.message}`);
    }
  }
  db.set({ items: [...added, ...items.filter((i) => !added.some((a) => a.id === i.id))], seeded: [...seeded, ...fresh.map((e) => e.example)] });
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
    for (const e of missing) put(kept(e));
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
    return put(kept({ ...fresh, id: avatar.id, name: avatar.name }));
  }
  throw refusal('pixel_avatar_op', 'that is not something the pixel avatars do');
}

export const snapshot = () => ({ pixelAvatars: getPixelAvatars() });

/** For tests: everything back to how a fresh install starts. */
export function resetForTests() {
  versions.set({ items: {} });
  db.set({ items: [], seeded: [] });
  seedExamples();
}
