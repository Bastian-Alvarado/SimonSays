/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Scene types: what a layout is for — Starting, Gameplay, BRB — named by the
 * streamer, so a command can ask for "BRB" and get whichever layout is BRB in
 * the overlay profile that is on.
 *
 * A step or trigger that names a layout names one layout in one profile, and
 * switching profile left every such command pointing at a layout that was no
 * longer there. Naming the type instead is the same command in every profile.
 *
 * The list is kept with Omnilayer's settings, outside the profiles, so it is
 * the same whichever profile is on; each layout carries the type it fills,
 * so each profile carries its own links. One layout per type within a list:
 * the first claim wins, as it does for an OBS scene binding.
 *
 * Types are addressed by id, so renaming one breaks nothing that names it.
 * Everything here is pure — the lists in, the lists out — and the engine
 * (index.js) does the storing.
 */

/** How many types there can be: far more than anyone switches between. */
export const MAX_SCENE_TYPES = 24;
const MAX_NAME = 40;

/** A type's id as stored: short, and safe to put anywhere. */
export const cleanTypeId = (v) => {
  const id = String(v ?? '').trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : '';
};

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** A fresh id for a type, from its name where it can be: "st-brb", "st-gameplay". */
export function newTypeId(name, taken = []) {
  const slug = String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'type';
  const used = new Set(taken);
  let id = `st-${slug}`;
  for (let n = 2; used.has(id); n += 1) id = `st-${slug}-${n}`;
  return id;
}

/**
 * The list as stored: each with an id and a name, no two the same either
 * way, at most MAX_SCENE_TYPES. A type with no id is given one; one with no
 * name is dropped, since nothing could pick it.
 */
export function cleanSceneTypes(incoming) {
  if (!Array.isArray(incoming)) return [];
  const out = [];
  for (const t of incoming) {
    const name = String(t?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!name || out.some((o) => sameName(o.name, name))) continue;
    let id = cleanTypeId(t?.id);
    if (!id || out.some((o) => o.id === id)) id = newTypeId(name, out.map((o) => o.id));
    out.push({ id, name });
    if (out.length >= MAX_SCENE_TYPES) break;
  }
  return out;
}

/** The layout of one type in a list, or null. */
export function layoutOfType(layouts, typeId) {
  if (!typeId || !Array.isArray(layouts)) return null;
  return layouts.find((l) => l?.sceneType === typeId) || null;
}

/** The layouts with no tag left for a type that no longer exists. */
export function untagGone(layouts, types) {
  if (!Array.isArray(layouts)) return layouts;
  const ids = new Set((types || []).map((t) => t.id));
  let changed = false;
  const next = layouts.map((l) => {
    if (!l?.sceneType || ids.has(l.sceneType)) return l;
    changed = true;
    const { sceneType, ...rest } = l;
    return rest;
  });
  return changed ? next : layouts;
}

/**
 * Types made from the OBS scene bindings the layouts already have.
 *
 * Every profile binds its own layouts to the same scene names, so those
 * names are already the types in all but name. Each scene name some layout
 * is bound to, in any of the lists, becomes a type — or is matched to one
 * that already has that name — in the order they are first met.
 */
export function typesFromBindings(types, layoutLists) {
  const next = cleanSceneTypes(types);
  for (const list of layoutLists || []) {
    for (const l of list || []) {
      for (const scene of l?.scenes || []) {
        if (next.length >= MAX_SCENE_TYPES) return next;
        if (!next.some((t) => sameName(t.name, scene))) {
          next.push({ id: newTypeId(scene, next.map((t) => t.id)), name: String(scene).trim().slice(0, MAX_NAME) });
        }
      }
    }
  }
  return cleanSceneTypes(next);
}

/**
 * One list of layouts with each untyped layout given the type its first
 * bound scene is named after — unless another layout in the list already
 * fills that type. A layout already given a type keeps it.
 */
export function tagByBindings(layouts, types) {
  if (!Array.isArray(layouts)) return { layouts, tagged: 0 };
  const held = new Set(layouts.map((l) => l?.sceneType).filter(Boolean));
  let tagged = 0;
  const next = layouts.map((l) => {
    if (!l || l.sceneType) return l;
    for (const scene of l.scenes || []) {
      const type = types.find((t) => sameName(t.name, scene));
      if (type && !held.has(type.id)) {
        held.add(type.id);
        tagged += 1;
        return { ...l, sceneType: type.id };
      }
    }
    return l;
  });
  return { layouts: tagged ? next : layouts, tagged };
}

/**
 * Actions whose layout steps and "layout went live" triggers name a layout
 * that has a type, turned to name the type instead.
 *
 * `typeOf(layoutId)` says which type a layout fills, looking in every
 * profile, since an action may name a layout of a profile that is not on.
 * The layout stays named beside the type, so nothing about what it was is
 * lost; the type is what is read.
 */
export function stepsByType(actions, typeOf) {
  if (!Array.isArray(actions)) return { actions, converted: 0 };
  let converted = 0;
  const walk = (steps) => (Array.isArray(steps) ? steps.map((s) => {
    if (!s) return s;
    let next = s;
    const type = s.type === 'layout_switch' && !s.config?.sceneType && s.config?.layoutId ? typeOf(s.config.layoutId) : '';
    if (type) {
      converted += 1;
      next = { ...s, config: { ...s.config, sceneType: type } };
    }
    if (s.thenActions) next = { ...next, thenActions: walk(s.thenActions) };
    if (s.elseActions) next = { ...next, elseActions: walk(s.elseActions) };
    return next;
  }) : steps);
  const next = actions.map((a) => {
    if (!a) return a;
    let out = { ...a, actions: walk(a.actions) };
    const cfg = a.trigger?.config;
    const type = a.trigger?.type === 'layout_changed' && cfg?.layoutId && !cfg.sceneType ? typeOf(cfg.layoutId) : '';
    if (type) {
      converted += 1;
      out = { ...out, trigger: { ...a.trigger, config: { ...cfg, sceneType: type } } };
    }
    return out;
  });
  return { actions: converted ? next : actions, converted };
}
