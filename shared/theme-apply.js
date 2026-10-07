/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Putting the library on a layout: one piece, or a whole theme at once — as a
 * plan first, so what it will change can be said before it changes it, and
 * undone after.
 *
 * A plan is a list of changes, each one field of one layer from one value to
 * another. Applying writes the `to`s; undoing writes the `from`s back, but only
 * where the field still holds what was applied — something changed since is
 * somebody's later decision, and an undo that took it away would be a second
 * accident.
 *
 * Shapes are never part of a theme's plan. A layout holds many, each a
 * different piece of the build — a wall, a frame, a divider — and a theme has
 * several kinds of shape besides; no one of them is "the" shape to put on all.
 *
 * The alerts are not layers: one set of alerts plays on every layout. A
 * theme reaches them only when asked to, and they are planned apart
 * (alertPlan) for that reason. The chat is a layer like the rest — each
 * keeps its own look — except that its look is part of its settings rather
 * than the layer's own box, and only its Custom theme reads one: so a change
 * to a chat layer's look is written into its settings, with a second change
 * beside it that turns it to Custom (see fieldOf). A look that landed and
 * then did nothing because of a theme chosen elsewhere would read as broken.
 */

import { CSS_LOOKS, ALL_PRESETS, presetApplies, presetKind, presetField } from './css-presets.js';
import { supersededLook } from './looks-history.js';

/*
  Where a field lives on a layer. A chat layer keeps its look in its settings,
  with the rest of what decides how it draws; every other kind keeps it on
  the layer itself.
*/
const inConfig = (layer) => layer?.type === 'chat';
/** A field of a layer, wherever that kind keeps it. */
export const fieldOf = (layer, field) => ((inConfig(layer) ? layer.config?.[field] : layer?.[field]) || '');
/** The layer with one field written, wherever that kind keeps it. */
const withField = (layer, field, value) => (inConfig(layer)
  ? { ...layer, config: { ...(layer.config || {}), [field]: value } }
  : { ...layer, [field]: value });

/** The fields a look or a motion is written into — not the theme switch beside a chat's. */
const LOOK_FIELDS = ['css', 'motionCss'];

/** The changes a chat layer needs besides its look: its theme turned to Custom, which is the one that reads a stylesheet. */
const toCustom = (layer, piece) => (inConfig(layer) && (layer.config?.chatTheme || '') !== 'custom'
  ? [{ uid: layer.uid, kind: layer.type, field: 'chatTheme', from: layer.config?.chatTheme || '', to: 'custom', piece }]
  : []);

/** Every stylesheet the library ships, to tell one of them from something written by hand. */
const SHIPPED = new Set(ALL_PRESETS.map((p) => p.css.trim()));

/**
 * Whether a stylesheet was written by hand: there is one, and it is none of
 * the library's — not even an old copy of one of its looks, which the server
 * brings up to date (see looks-history.js).
 */
export const isOwnCss = (css, known = null) => Boolean((css || '').trim()) && !SHIPPED.has((css || '').trim()) && !supersededLook(css) && !known?.has((css || '').trim());

/**
 * Whether a stylesheet is one the library ships — or, given `known` (the
 * stylesheets of the streamer's own themes, userThemeCss), one of theirs.
 */
export const isShippedCss = (css, known = null) => SHIPPED.has((css || '').trim()) || Boolean(supersededLook(css)) || Boolean(known?.has((css || '').trim()));

/** Whether an omnibar layer draws a tall bar: the bar it names is one. */
export const isTallBarLayer = (layer, omnibars = []) =>
  layer?.type === 'omnibar' && (omnibars || []).find((b) => b.id === layer.config?.bar)?.kind === 'tall';

/** The kinds of layer a theme never dresses as a whole. */
export const THEME_SKIPS = ['shape'];

/**
 * A theme's look for one kind of layer: its first — the one it leads with —
 * and for an omnibar, its tall-bar look on a tall bar and its bar look on any
 * other, since the two draw different parts.
 */
export function themeLookFor(theme, kind, { tall = false } = {}) {
  const looks = (theme?.objects || []).filter((o) => o.layerType === kind && presetKind(o) === 'look');
  if (kind === 'omnibar') return looks.find((o) => Boolean(o.previewTall) === tall) || null;
  return looks[0] || null;
}

/**
 * A theme's motion to go with one of its looks: one written for that look, or
 * one written for none in particular — but not onto a tall bar, whose parts
 * a motion for the plain bar does not know.
 */
export function themeMotionFor(theme, look) {
  if (!look) return null;
  const motions = (theme?.objects || []).filter((o) => o.layerType === look.layerType && presetKind(o) === 'motion');
  return motions.find((m) => m.previewWith === look.id)
    || motions.find((m) => !m.previewWith && !look.previewTall)
    || null;
}

/**
 * The layers one piece goes on: every one of its kind in the layout — and for
 * an omnibar look, only the bars it was drawn for, tall or not, since a bar
 * look on a tall bar names parts that are not there.
 */
export function pieceTargets(piece, layout, omnibars = []) {
  if (presetApplies(piece) === 'alert' || piece.layerType === 'shape') return [];
  return (layout?.layers || []).filter((layer) => {
    if (layer.type !== piece.layerType) return false;
    if (piece.layerType === 'omnibar' && presetKind(piece) === 'look') return isTallBarLayer(layer, omnibars) === Boolean(piece.previewTall);
    return true;
  });
}

/** The changes one piece makes: its box on each of its layers, where that is not already it. */
export function piecePlan(piece, layout, omnibars = []) {
  const field = presetField(piece);
  return pieceTargets(piece, layout, omnibars).flatMap((layer) => [
    ...(fieldOf(layer, field) !== piece.css
      ? [{ uid: layer.uid, kind: layer.type, field, from: fieldOf(layer, field), to: piece.css, piece: piece.name }]
      : []),
    ...toCustom(layer, piece.name),
  ]);
}

/**
 * The changes a whole theme makes to a layout, and what it leaves alone.
 *
 * Each layer gets the theme's look for its kind; with `motion`, the motion
 * that goes with that look too — and a motion from the library that does not
 * (another theme's, or this one's for a different look) is taken off, since
 * it animates parts the new look may not have. A motion written by hand stays.
 *
 * `left` says what was not touched and why: shapes, which a theme never
 * touches; the alerts layer, which plays the one set of alerts every layout
 * shares; and kinds the theme has nothing for.
 */
export function themePlan(theme, layout, { omnibars = [], motion = true, known = null } = {}) {
  const changes = [];
  const left = new Map();
  const leave = (kind, why) => {
    const key = `${kind}|${why}`;
    left.set(key, { kind, why, count: (left.get(key)?.count || 0) + 1 });
  };
  for (const layer of layout?.layers || []) {
    if (THEME_SKIPS.includes(layer.type)) { leave(layer.type, 'shape'); continue; }
    if (layer.type === 'alerts') { leave(layer.type, 'shared'); continue; }
    const look = themeLookFor(theme, layer.type, { tall: isTallBarLayer(layer, omnibars) });
    if (!look) { leave(layer.type, 'nothing'); continue; }
    if (fieldOf(layer, 'css') !== look.css) {
      changes.push({ uid: layer.uid, kind: layer.type, field: 'css', from: fieldOf(layer, 'css'), to: look.css, piece: look.name });
    }
    changes.push(...toCustom(layer, look.name));
    if (!motion) continue;
    const move = themeMotionFor(theme, look);
    const now = fieldOf(layer, 'motionCss');
    if (move && now !== move.css) {
      changes.push({ uid: layer.uid, kind: layer.type, field: 'motionCss', from: now, to: move.css, piece: move.name });
    } else if (!move && isShippedCss(now, known)) {
      changes.push({ uid: layer.uid, kind: layer.type, field: 'motionCss', from: now, to: '', piece: null });
    }
  }
  return { changes, left: [...left.values()] };
}

/** The changes to every alert for a theme: its alert look on each, and with `motion` the motion that goes with it. */
export function alertPlan(theme, alerts = [], { motion = true, known = null } = {}) {
  const look = (theme?.objects || []).find((o) => presetApplies(o) === 'alert' && presetKind(o) === 'look');
  if (!look) return null;
  const move = motion ? themeMotionFor(theme, look) : null;
  const changes = [];
  for (const alert of alerts || []) {
    const next = { css: look.css };
    if (motion) {
      if (move) next.motionCss = move.css;
      else if (isShippedCss(alert.motionCss, known)) next.motionCss = '';
    }
    const differs = Object.entries(next).some(([k, v]) => (alert[k] || '') !== v);
    if (differs) changes.push({ id: alert.id, name: alert.name, next, before: { css: alert.css || '', motionCss: alert.motionCss || '' } });
  }
  return { look: look.name, motion: move?.name || null, changes, own: changes.filter((c) => isOwnCss(c.before.css, known) || (motion && move && isOwnCss(c.before.motionCss, known))).length };
}

/** A layout with changes written: `to` to apply them, `from` to undo them. */
export function withChanges(layout, changes, direction = 'to') {
  const byUid = new Map();
  for (const c of changes) byUid.set(c.uid, [...(byUid.get(c.uid) || []), c]);
  return {
    ...layout,
    layers: (layout.layers || []).map((layer) => {
      const mine = byUid.get(layer.uid);
      if (!mine) return layer;
      let next = layer;
      for (const c of mine) {
        // Undone only where it still holds what was applied: a later edit is somebody's decision.
        if (direction === 'from' && fieldOf(next, c.field) !== c.to) continue;
        next = withField(next, c.field, direction === 'to' ? c.to : c.from);
      }
      return next;
    }),
  };
}

/** How many of an undo's changes still hold what was applied, and so would be undone. */
export const stillApplied = (layout, changes) => changes.filter((c) => {
  const layer = (layout?.layers || []).find((l) => l.uid === c.uid);
  return layer && fieldOf(layer, c.field) === c.to;
}).length;

/** How many changes would replace a stylesheet written by hand. */
export const replacesOwn = (changes, known = null) => changes
  .filter((c) => LOOK_FIELDS.includes(c.field) && c.to !== '' && isOwnCss(c.from, known)).length;

/** The themes a whole theme can be applied from: those with anything for a layer besides shapes. */
export const themesToApply = (themes = CSS_LOOKS) => themes.filter((theme) => theme.objects.some((o) =>
  (presetApplies(o) !== 'alert' && !THEME_SKIPS.includes(o.layerType)) || presetApplies(o) === 'alert'));
