/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The backup manifest, overlay layouts, the nameplate, the goal bar, and how a layer is drawn.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

// -------------------------------------------------- the backup manifest

export const { MANIFEST, EXCLUDED, buildBundle, applyBundle } = await import('../../engine/backup.js');
export const { DOCK_BUILTINS } = await import('../../../shared/dock-builtins.js');
export const { says, has, platformsWith } = await import('../../../shared/platforms.js');
export const alertsModule = await import('../../engine/alerts.js');
export const youtubeModule = await import('../../platforms/youtube.js');
export const busModule = await import('../../core/bus.js');
export const { resolveServerUrl } = await import('../../../shared/server-url.js');
export const { getCollection } = await import('../../core/store.js');
const { normaliseLayouts: normLayouts } = await import('../../engine/layouts.js');

test('every stored collection either travels in a backup or is excluded on purpose', () => {
  // The manifest and the code that creates collections are two lists that have
  // to agree, and nothing made them. They had already drifted: the viewer
  // counter, the camera settings, the subscriber ledger and the overlay
  // layouts were in neither list, so "Export Configuration" quietly left all
  // four behind and a restore came back without them.
  const root = new URL('../', SCRIPT_URL);
  const named = new Set();

  const walk = (dir) => {
    for (const entry of fs.readdirSync(new URL(dir, root), { withFileTypes: true })) {
      // scripts/ is this file's own home and holds no collections.
      if (entry.name === 'node_modules' || entry.name === 'scripts') continue;
      const next = `${dir}${entry.name}${entry.isDirectory() ? '/' : ''}`;
      if (entry.isDirectory()) { walk(next); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const src = fs.readFileSync(new URL(next, root), 'utf8');
      for (const m of src.matchAll(/\bcollection\(\s*'([a-z0-9_]+)'/g)) named.add(m[1]);
    }
  };
  walk('');

  // If the scan finds nothing the comparison below passes vacuously.
  assert.ok(named.size > 20, `expected to find the collections by scanning, found ${named.size}`);

  const manifest = MANIFEST.map((e) => e.name);
  const orphans = [...named].filter((n) => !manifest.includes(n) && !EXCLUDED.includes(n));
  assert.deepEqual(orphans, [],
    `in neither the backup manifest nor the excluded list: ${orphans.join(', ')}`);
});

test('nothing is both exported and excluded', () => {
  const both = MANIFEST.map((e) => e.name).filter((n) => EXCLUDED.includes(n));
  assert.deepEqual(both, [], `listed twice: ${both.join(', ')}`);
});

test('a layout survives an export and a restore', () => {
  // The whole claim of the overlay editor is that an arrangement travels. This
  // is that claim, end to end, through the real bundle code.
  const layouts = getCollection('layouts');
  layouts.set(normLayouts([{
    id: 'travelling', name: 'Travelling', width: 1280, height: 720,
    layers: [{ type: 'chat', x: 11, y: 22, width: 333, height: 444 }],
  }]));

  const bundle = buildBundle();
  assert.ok(bundle.collections.layouts, 'the bundle carries no layouts at all');

  // Wipe it the way a fresh install would be, then restore.
  layouts.set([]);
  applyBundle(bundle, {});

  const back = getCollection('layouts').get();
  assert.equal(back.length, 1);
  assert.equal(back[0].name, 'Travelling');
  assert.equal(back[0].width, 1280);
  assert.deepEqual(
    { x: back[0].layers[0].x, y: back[0].layers[0].y, w: back[0].layers[0].width },
    { x: 11, y: 22, w: 333 },
  );
});

// ------------------------------------------------------- overlay layouts

export const { normaliseLayouts, normaliseLayout, LAYER_TYPES, MAX_LAYOUTS, layoutForScene } = await import('../../engine/layouts.js');

test('a layout keeps the layers it was given, in order', () => {
  const [l] = normaliseLayouts([{ id: "a", name: "Main", layers: [
    { type: "chat", x: 10, y: 20, width: 300, height: 600 },
    { type: "omnibar" },
  ] }]);
  assert.deepEqual(l.layers.map((x) => x.type), ["chat", "omnibar"]);
  assert.equal(l.layers[0].x, 10);
});

test('a layer naming a surface that does not exist is dropped', () => {
  const [l] = normaliseLayouts([{ id: "a", layers: [{ type: "chat" }, { type: "nonsense" }] }]);
  assert.deepEqual(l.layers.map((x) => x.type), ["chat"]);
});

test('one layer per type: a duplicate is dropped, the first wins', () => {
  const [l] = normaliseLayouts([{ id: "a", layers: [
    { type: "chat", x: 10 },
    { type: "chat", x: 900 },
  ] }]);
  assert.equal(l.layers.length, 1);
  assert.equal(l.layers[0].x, 10);
});

test('a layer with no placement gets its preset, not a box at the origin', () => {
  const [l] = normaliseLayouts([{ id: "a", layers: [{ type: "omnibar" }] }]);
  const bar = l.layers[0];
  // The omnibar spans the bottom edge; a 400x300 default would be nonsense.
  assert.equal(bar.width, 1920);
  assert.ok(bar.y > 900, `expected the bar near the bottom, got y=${bar.y}`);
});

// ------------------------------------------------------------ the nameplate

test('the nameplate is a layer the canvas can hold', () => {
  assert.ok(LAYER_TYPES.includes('nameplate'), 'the server would drop it on save');
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'nameplate' }] }]);
  assert.equal(l.layers[0]?.type, 'nameplate');
});

test('the nameplate is the one layer whose config the server checks', () => {
  /*
    Every other layer's config is passed through, because chat and the omnibar
    each have a surface that validates its own. The nameplate has no such
    surface — it exists only as a layer — so this is the only place its
    settings are ever checked, and they become text and inline styles on a
    stream. Losing this check would not break anything visibly.
  */
  const [l] = normaliseLayouts([{
    id: 'a',
    layers: [{ type: 'nameplate', config: {
      name: 'x'.repeat(300), subtitle: 'y'.repeat(300),
      accentColor: 'red; content:url(evil)', nameSize: 9999, radius: -40, align: 'sideways',
    } }],
  }]);
  const c = l.layers[0].config;
  assert.equal(c.name.length, 60, 'a name longer than the bar was stored whole');
  assert.equal(c.subtitle.length, 80);
  assert.equal(c.accentColor, '', `a colour that is not a colour was kept: ${c.accentColor}`);
  assert.ok(c.nameSize <= 160 && c.radius >= 0, JSON.stringify({ n: c.nameSize, r: c.radius }));
  assert.equal(c.align, 'left', 'an alignment that does not exist was kept');
});

test('a nameplate keeps the text it is actually given', () => {
  // The check above only proves nonsense is refused; this proves it is not
  // refusing everything, which would pass that test just as well.
  const [l] = normaliseLayouts([{
    id: 'a',
    layers: [{ type: 'nameplate', config: { name: 'Rowan', subtitle: 'he/him', accentColor: '#22d3ee', align: 'right' } }],
  }]);
  const c = l.layers[0].config;
  assert.equal(c.name, 'Rowan');
  assert.equal(c.subtitle, 'he/him');
  assert.equal(c.accentColor, '#22d3ee');
  assert.equal(c.align, 'right');
});

test('an unfilled nameplate draws nothing rather than an empty bar', () => {
  // A layer added and not yet filled in should be invisible on stream, not a
  // blank panel somebody has to remember to turn off before going live.
  const src = fs.readFileSync(new URL('../../web/components/Nameplate.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/if \(!name && !subtitle\) return null;/.test(src), 'an empty nameplate now draws a bar');
});

test('the nameplate is offered in the editor and drawn on the canvas', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/type: 'nameplate'/.test(view), 'no way to add one');
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/case 'nameplate':/.test(stage), 'the canvas would skip it silently');
});

test('a field that saves as you type does not fight what you type', () => {
  /*
    The server trims what it stores, which is right. A field that also saves on
    every keystroke turns that into a space being impossible to type: the space
    goes up, comes back trimmed, and replaces the box before the next letter
    lands. "Follower goal" could only be typed as "Followergoal".

    Both of these are saved per keystroke, so both hold the value locally until
    focus leaves. Anything else here that starts saving per keystroke needs the
    same treatment.
  */
  const committed = fs.readFileSync(new URL('../../web/components/CommittedInput.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/editing.current/.test(committed), 'the field no longer knows whether it is being typed in');
  assert.ok(/onBlur/.test(committed) && /onCommit/.test(committed), 'it no longer waits for focus to leave');

  for (const file of ['../../web/components/GoalLayerPanel.tsx', '../../web/components/views/PlanView.tsx']) {
    const src = fs.readFileSync(new URL(file, SCRIPT_URL), 'utf8');
    assert.ok(/CommittedInput/.test(src), `${file} types straight into a save again`);
  }
});

// -------------------------------------------------------------- the goal bar

test('the goal is a layer the canvas can hold', () => {
  assert.ok(LAYER_TYPES.includes('goal'), 'the server would drop it on save');
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'goal' }] }]);
  assert.equal(l.layers[0]?.type, 'goal');
});

test('a goal counts toward something real', () => {
  /*
    A target of zero is a bar that is always full, and a source nothing feeds
    is a bar that sits empty on stream for a reason nobody can see. Both fall
    back rather than being stored.
  */
  const [l] = normaliseLayouts([{
    id: 'a',
    layers: [{ type: 'goal', config: { source: 'nonsense', target: 0, manualValue: -5, barColor: 'red; url(x)' } }],
  }]);
  const c = l.layers[0].config;
  assert.equal(c.source, 'manual');
  assert.ok(c.target >= 1, String(c.target));
  assert.ok(c.manualValue >= 0, String(c.manualValue));
  // Empty, not a literal: an unset accent follows the canvas.
  assert.equal(c.barColor, '');
});

test('a goal keeps the settings it is actually given', () => {
  // The check above only proves nonsense is refused; this proves it is not
  // refusing everything, which would pass that test just as well.
  const [l] = normaliseLayouts([{
    id: 'a',
    layers: [{ type: 'goal', config: { source: 'followers', target: 500, label: 'Follower goal', showPercent: true } }],
  }]);
  const c = l.layers[0].config;
  assert.deepEqual({ s: c.source, t: c.target, l: c.label, p: c.showPercent },
    { s: 'followers', t: 500, l: 'Follower goal', p: true });
});

test('the totals a goal follows are actually fetched', () => {
  /*
    Followers and subscribers are a `total` beside a page of names, so each
    asks for one item and reads the count off the envelope. Separate try/catch
    on purpose: each needs its own scope, and a channel that granted one but
    not the other should still get the one it granted.
  */
  const src = fs.readFileSync(new URL('../platforms/twitch.js', SCRIPT_URL), 'utf8');
  assert.ok(/twitchFollowers/.test(src), 'nothing ever fetches a follower total');
  assert.ok(/twitchSubs/.test(src), 'nothing ever fetches a subscriber total');
  const totals = src.slice(src.indexOf('async function pollTotals'), src.indexOf('async function pollTotals') + 1400);
  assert.equal((totals.match(/catch \(err\)/g) || []).length, 2,
    'one failed scope now takes the other count down with it');
});

test('a count that was never fetched reads as nothing, not as zero', () => {
  // A goal bar sitting at zero because a scope was never granted looks exactly
  // like one nobody has contributed to, which is the worse of the two.
  const src = fs.readFileSync(new URL('../../web/components/GoalBar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/const known = Number\.isFinite/.test(src), 'an absent count is no longer distinguished');
  assert.ok(/known \? shown\.toLocaleString\(\) : '—'/.test(src), 'an absent count now draws as a number');
});

test('the goal number climbs rather than jumping', () => {
  // The rolling is most of the effect: a number that jumps reads as a page
  // refresh, one that climbs reads as something happening.
  const src = fs.readFileSync(new URL('../../web/components/GoalBar.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/requestAnimationFrame/.test(src), 'the roll is gone');
  assert.ok(/Math\.pow\(1 - t, 3\)/.test(src), 'the roll is linear again, so a big jump crawls at the end');
});

// ------------------------------------------------------ how a layer is drawn

test('rotation, filters and blending belong to every layer', () => {
  /*
    On the layer rather than in its config, because rotating a nameplate and
    rotating a logo are the same operation — one implementation covers every
    type already built and every one added later.
  */
  const [l] = normaliseLayouts([{
    id: 'a',
    layers: [{ type: 'images', rotation: -8, blur: 3, brightness: 120, blendMode: 'screen', shadowBlur: 12 }],
  }]);
  const layer = l.layers[0];
  assert.deepEqual(
    { r: layer.rotation, b: layer.blur, br: layer.brightness, m: layer.blendMode, s: layer.shadowBlur },
    { r: -8, b: 3, br: 120, m: 'screen', s: 12 },
  );
});

test('and are checked like everything else that reaches a stream', () => {
  const [l] = normaliseLayouts([{
    id: 'a',
    layers: [{ type: 'images', rotation: 999, blur: -5, brightness: 9999, blendMode: 'explode', shadowColor: 'red; url(x)' }],
  }]);
  const layer = l.layers[0];
  assert.ok(Math.abs(layer.rotation) <= 180, String(layer.rotation));
  assert.ok(layer.blur >= 0 && layer.brightness <= 300, JSON.stringify(layer));
  assert.equal(layer.blendMode, 'normal');
  assert.equal(layer.shadowColor, '#000000cc');
});

test('a layer nobody has touched is drawn with no filter at all', () => {
  /*
    The whole reason this is written as "emit nothing" rather than "emit the
    default": a filter or transform that does nothing still promotes the layer
    to its own compositing surface. Eight untouched layers each carrying
    `filter: none` costs frames on a browser source for no visible difference,
    and nothing on screen would ever show it.
  */
  const src = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const fn = src.slice(src.indexOf('function layerAppearance'), src.indexOf('/** One layer\'s contents'));
  assert.ok(/if \(transforms\.length\) style\.transform/.test(fn), 'a transform is written even when empty');
  assert.ok(/if \(filters\.length\) style\.filter/.test(fn), 'a filter is written even when empty');
  assert.ok(/!== 'normal'\) style\.mixBlendMode/.test(fn), 'a blend mode is written even when normal');
});

test('a layer shadow follows what is drawn, not its box', () => {
  // drop-shadow respects the alpha, so a logo casts the logo's shadow rather
  // than a rectangle's. box-shadow cannot do that.
  const src = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/drop-shadow\(/.test(src), 'the shadow is a box again');
});

