/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Layout templates: a set of ready layouts — every scene, styled — to start
 * an overlay profile from, instead of an empty one.
 *
 * Each is a file in layout-templates/, made from a real setup with nobody's
 * content left in it: no avatar of anybody's (an avatar layer draws the
 * default one), no pictures, no OBS sources picked, no timers, no scenes
 * bound, no names. Its words are kept in both languages (`{ $t: { en, es } }`)
 * and the profile is made in the dashboard's.
 *
 * A template is only ever a new profile: what anybody already has is never
 * replaced (engine/profiles.js createProfile).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refusal } from '../core/refusal.js';
import { LAYOUT_TEMPLATES } from '../../shared/layout-template-list.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'layout-templates');
const loaded = new Map();

function read(id) {
  if (!LAYOUT_TEMPLATES.some((t) => t.id === id)) throw refusal('layout_template_unknown', `no layout template called ${id}`);
  if (!loaded.has(id)) loaded.set(id, JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8')));
  return loaded.get(id);
}

/** Words kept in both languages, in one. */
function say(v, lang) {
  if (Array.isArray(v)) return v.map((x) => say(x, lang));
  if (!v || typeof v !== 'object') return v;
  if (v.$t && typeof v.$t === 'object') return String(v.$t[lang] ?? v.$t.en ?? '');
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, say(x, lang)]));
}

/**
 * A template's layouts, in a language, ready to be cleaned as any saved
 * layout is: ids of their own (a template can be used twice, and a layout's
 * id is what an OBS link names), named "<template> - <scene>".
 */
export function templateLayouts(id, lang = 'en', suffix = Math.random().toString(36).slice(2, 7)) {
  const t = read(id);
  const lg = lang === 'es' ? 'es' : 'en';
  return t.layouts.map(({ key, name, ...layout }) => ({
    ...say(layout, lg),
    id: `${t.id}-${key}-${suffix}`,
    name: `${say({ $t: t.name }, lg)} - ${say({ $t: name }, lg)}`,
  }));
}

/** A template's name, in a language: what the new profile is called unless given another. */
export const templateName = (id, lang = 'en') => say({ $t: read(id).name }, lang === 'es' ? 'es' : 'en');
