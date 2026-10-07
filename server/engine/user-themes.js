/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The themes made in the app (shared/user-themes.js): kept here, handed to
 * every screen, and changed one whole theme at a time.
 *
 * The shipped themes are not among them and are never touched from here; a
 * copy of one is a new theme of the streamer's own. Outside every profile,
 * like the scene types: the same list whichever overlay profile is on.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { refusal } from '../core/refusal.js';
import { createLogger } from '../core/logger.js';
import { CSS_LOOKS } from '../../shared/css-presets.js';
import { cleanUserTheme, copyTheme, newThemeId, MAX_USER_THEMES } from '../../shared/user-themes.js';

const log = createLogger('user-themes');

let db = null;

export function initUserThemes() {
  db = collection('user_themes', { items: [] });
  // Whatever was kept is held to what a theme can be now; one that no longer is one is set aside, not lost silently.
  const items = [];
  for (const raw of db.get().items || []) {
    try { items.push(cleanUserTheme(raw)); } catch (err) { log.warn(`a theme could not be read and was left out: ${err.message}`); }
  }
  db.set({ items });
}

export const getUserThemes = () => db?.get().items ?? [];

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'userThemes', value: getUserThemes() });
}

const find = (id) => getUserThemes().find((th) => th.id === id) || null;
/** A theme to copy from: one of these, or a shipped one. */
const source = (id) => find(id) || CSS_LOOKS.find((th) => th.id === id) || null;

function kept(raw) {
  try {
    return cleanUserTheme(raw);
  } catch (err) {
    throw refusal('theme_invalid', err.message, { why: err.message });
  }
}

function roomForOne() {
  if (getUserThemes().length >= MAX_USER_THEMES) throw refusal('theme_full', `there are already ${MAX_USER_THEMES} themes`, { max: MAX_USER_THEMES });
}

function put(theme, now = Date.now()) {
  const next = { ...theme, updatedAt: now };
  db.update((v) => {
    const at = v.items.findIndex((i) => i.id === next.id);
    if (at >= 0) v.items[at] = next; else v.items.push(next);
  });
  publish();
  return { ok: true, id: next.id, theme: next };
}

/** A name not already taken: "Mania Menu (copy)", then "(copy 2)" and on. */
function freeName(base) {
  const names = new Set(getUserThemes().map((th) => th.name));
  if (!names.has(base)) return base;
  for (let n = 2; n < 100; n += 1) if (!names.has(`${base} ${n}`)) return `${base} ${n}`;
  return `${base} ${Date.now().toString(36)}`;
}

/**
 * Everything the Library can ask for:
 *   create { name, from? }   a new theme: empty, or a copy of `from` (a shipped theme's id, or one of these)
 *   save { theme }           the whole theme, replacing the one with its id
 *   rename { id, name, hint? }
 *   delete { id }
 */
export function control(payload = {}) {
  const { op } = payload;
  if (op === 'create') {
    roomForOne();
    const from = payload.from ? source(payload.from) : null;
    if (payload.from && !from) throw refusal('theme_missing', 'there is no theme like that');
    const name = String(payload.name ?? '').trim();
    const theme = from
      ? copyTheme(from, { name: name || freeName(`${from.name} (copy)`) })
      : kept({ id: newThemeId(), name: name || freeName('My theme'), objects: [] });
    log.info(`theme made: ${theme.name}${from ? ` (from ${from.name})` : ''}`);
    return put(theme);
  }
  if (op === 'save') {
    const theme = kept(payload.theme);
    if (!find(theme.id)) roomForOne();
    return put(theme);
  }
  const theme = find(payload.id);
  if (!theme) throw refusal('theme_missing', 'there is no theme like that');
  if (op === 'rename') {
    return put(kept({ ...theme, name: payload.name ?? theme.name, hint: payload.hint ?? theme.hint }));
  }
  if (op === 'delete') {
    db.update((v) => { v.items = v.items.filter((i) => i.id !== theme.id); });
    publish();
    log.info(`theme deleted: ${theme.name}`);
    return { ok: true };
  }
  throw refusal('theme_op', 'that is not something themes do');
}

export const snapshot = () => ({ userThemes: getUserThemes() });

/** For tests: none at all. */
export function resetForTests() {
  db.set({ items: [] });
}
