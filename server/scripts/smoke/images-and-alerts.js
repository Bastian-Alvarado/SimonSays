/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: The image layer, alert configs, channel point scoping, alert variations, video alerts.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, SCRIPT_URL, assert, bus, fs, test } from './harness.js';
import { LAYER_TYPES, MAX_LAYOUTS, applyBundle, buildBundle, getCollection, layoutForScene, normaliseLayout, normaliseLayouts } from './backup-and-layouts.js';

// ------------------------------------------------------------ the image layer

test('the image layer is one the canvas can hold', () => {
  assert.ok(LAYER_TYPES.includes('images'), 'the server would drop it on save');
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'images' }] }]);
  assert.equal(l.layers[0]?.type, 'images');
});

test('only a picture this server serves, or an ordinary web address', () => {
  /*
    These become the src of an <img> on a stream, and that attribute takes
    "javascript:" and "data:" as readily as it takes a picture. A path is also
    checked for traversal: /media/ is a real directory on the machine.
  */
  const sources = [
    '/media/logo.png', 'https://example.com/a.png', 'http://x.test/b.gif',
    'javascript:alert(1)', 'data:image/png;base64,AAAA', '/media/../../etc/passwd',
    'file:///C:/secret.png', 'ftp://x/y.png', '',
  ];
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'images', config: { sources } }] }]);
  assert.deepEqual(l.layers[0].config.sources,
    ['/media/logo.png', 'https://example.com/a.png', 'http://x.test/b.gif']);
});

test('an image layer cannot hold an unbounded number of pictures', () => {
  const many = Array.from({ length: 200 }, (_, i) => `/media/${i}.png`);
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'images', config: { sources: many } }] }]);
  assert.ok(l.layers[0].config.sources.length <= 24, String(l.layers[0].config.sources.length));
});

test('the image layer keeps the settings it is given, and clamps the rest', () => {
  const good = normaliseLayouts([{ id: 'a', layers: [{ type: 'images', config: { seconds: 3, fit: 'cover', transition: 'none', random: true } }] }])[0].layers[0].config;
  assert.deepEqual({ s: good.seconds, f: good.fit, t: good.transition, r: good.random },
    { s: 3, f: 'cover', t: 'none', r: true });
  const bad = normaliseLayouts([{ id: 'a', layers: [{ type: 'images', config: { seconds: 99999, fit: 'squish', transition: 'explode' } }] }])[0].layers[0].config;
  assert.ok(bad.seconds <= 3600 && bad.fit === 'contain' && bad.transition === 'fade', JSON.stringify(bad));
});

test('every picture is mounted at once rather than swapped in', () => {
  /*
    Swapping one src means the browser fetches the next picture at the moment
    it has to appear, so the first pass through a rotation flickers on a cold
    cache — on stream, where it is least forgivable.
  */
  const src = fs.readFileSync(new URL('../../web/components/ImageLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/sources\.map\(/.test(src), 'the layer no longer mounts every source');
  assert.ok(/opacity: i === index % sources\.length/.test(src), 'it no longer cross-fades by opacity');
});

test('an empty image layer draws nothing rather than a grey box', () => {
  const src = fs.readFileSync(new URL('../../web/components/ImageLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/if \(!sources\.length\) return null;/.test(src), 'an empty image layer now draws something');
});

test('a layer may bleed off the canvas edge on purpose', () => {
  const [l] = normaliseLayouts([{ id: "a", layers: [{ type: "chat", x: -120 }] }]);
  assert.equal(l.layers[0].x, -120);
});

test('opacity is clamped to 0..1 rather than passed through', () => {
  const [l] = normaliseLayouts([{ id: "a", layers: [
    { type: "chat", opacity: 4 },
    { type: "omnibar", opacity: -2 },
  ] }]);
  assert.equal(l.layers[0].opacity, 1);
  assert.equal(l.layers[1].opacity, 0);
});

test('a layout defaults to transparent, so it never hides the scene', () => {
  assert.equal(normaliseLayout({ id: "a" }).background, "transparent");
  assert.equal(normaliseLayout({ id: "a", background: "not a colour" }).background, "transparent");
  assert.equal(normaliseLayout({ id: "a", background: "#101014" }).background, "#101014");
});

test('two layouts cannot share an id, since the URL addresses them by it', () => {
  const out = normaliseLayouts([{ id: "same", name: "First" }, { id: "same", name: "Second" }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "First");
});

test('every layer type the editor offers is one the canvas can draw', () => {
  // Guards the two lists drifting apart: a type accepted here but unknown to
  // CanvasStage would save cleanly and then render nothing on stream.
  const canvas = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(LAYER_TYPES.length >= 6, `expected the full list of layer types, got ${LAYER_TYPES.length}`);
  for (const type of LAYER_TYPES) {
    assert.ok(canvas.includes(`case '${type}':`), `CanvasStage has no branch for the "${type}" layer`);
  }
});

test('garbage in place of a layout list yields an empty list, not a crash', () => {
  assert.deepEqual(normaliseLayouts(null), []);
  assert.deepEqual(normaliseLayouts("nope"), []);
  assert.deepEqual(normaliseLayouts([{}])[0].layers, []);
});

test('the editor stops at the same number of layouts the server keeps', () => {
  // Two constants in two languages. If the editor allows more than the server
  // stores, the extra layout is accepted, saved, and gone on the next reload.
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const m = view.match(/const MAX_LAYOUTS = (\d+);/);
  assert.ok(m, 'the editor declares no MAX_LAYOUTS');
  assert.equal(Number(m[1]), MAX_LAYOUTS,
    `the editor allows ${m[1]} layouts but the server keeps ${MAX_LAYOUTS}`);
});

test('layouts past the cap are dropped rather than stored', () => {
  const many = Array.from({ length: MAX_LAYOUTS + 5 }, (_, i) => ({ id: `l${i}`, name: `L${i}` }));
  assert.equal(normaliseLayouts(many).length, MAX_LAYOUTS);
});

test('a layout id that would break its own URL is replaced, not rewritten', () => {
  // The id is the whole of ?layout=<id>. An ampersand ends the parameter, so a
  // source pointed at that layout would silently load a different one.
  for (const bad of ['a&b=1', 'has space', 'hash#frag', '../escape', '']) {
    const id = normaliseLayout({ id: bad, name: 'x' }).id;
    assert.ok(/^[A-Za-z0-9_-]{1,64}$/.test(id), `got an unsafe id back: ${JSON.stringify(id)}`);
    assert.notEqual(id, bad);
  }
});

test('a usable id is left exactly as it was', () => {
  // Replacing a good id would break every browser source already pointed at it.
  for (const good of ['abc123', 'my-overlay', 'main_stream']) {
    assert.equal(normaliseLayout({ id: good }).id, good);
  }
});

test('a layout remembers the OBS scenes it is bound to', () => {
  const [l] = normaliseLayouts([{ id: 'a', scenes: ['Gameplay', 'Starting Soon'] }]);
  assert.deepEqual(l.scenes, ['Gameplay', 'Starting Soon']);
});

test('scene names are trimmed, deduplicated and emptied of blanks', () => {
  const [l] = normaliseLayouts([{ id: 'a', scenes: ['  Gameplay  ', 'Gameplay', '', '   ', null, 'Chat'] }]);
  assert.deepEqual(l.scenes, ['Gameplay', 'Chat']);
});

test('one scene cannot be claimed by two layouts', () => {
  // Otherwise the canvas has to guess which overlay a scene wants, and the
  // editor would show a binding that never takes effect.
  const out = normaliseLayouts([
    { id: 'a', name: 'First', scenes: ['Gameplay', 'Conversacion'] },
    { id: 'b', name: 'Second', scenes: ['Gameplay', 'Starting Soon'] },
  ]);
  assert.deepEqual(out[0].scenes, ['Gameplay', 'Conversacion']);
  assert.deepEqual(out[1].scenes, ['Starting Soon']);
});

test('garbage in place of a scene list is dropped, not stored', () => {
  assert.deepEqual(normaliseLayouts([{ id: 'a', scenes: 'Gameplay' }])[0].scenes, []);
  assert.deepEqual(normaliseLayouts([{ id: 'a' }])[0].scenes, []);
});

test('the scene a layout answers to resolves to that layout', () => {
  const layouts = normaliseLayouts([
    { id: 'a', name: 'Gameplay', scenes: ['Gameplay'] },
    { id: 'b', name: 'Chatting', scenes: ['Conversacion'] },
  ]);
  assert.equal(layoutForScene(layouts, 'Gameplay').id, 'a');
  assert.equal(layoutForScene(layouts, 'Conversacion').id, 'b');
});

test('an unbound scene resolves to nothing rather than to whatever is first', () => {
  // Leaving a scene unbound is a choice: it means no overlay there. Falling
  // back to the first layout would put chat on a scene deliberately kept bare.
  const layouts = normaliseLayouts([{ id: 'a', name: 'Gameplay', scenes: ['Gameplay'] }]);
  assert.equal(layoutForScene(layouts, 'Starting Soon'), null);
  assert.equal(layoutForScene(layouts, ''), null);
  assert.equal(layoutForScene(layouts, undefined), null);
  assert.equal(layoutForScene(null, 'Gameplay'), null);
});

test('scene bindings survive an export and a restore', () => {
  const layouts = getCollection('layouts');
  layouts.set(normaliseLayouts([{ id: 'bound', name: 'Bound', scenes: ['Gameplay', 'Conversacion'] }]));
  const bundle = buildBundle();
  layouts.set([]);
  applyBundle(bundle, {});
  assert.deepEqual(getCollection('layouts').get()[0].scenes, ['Gameplay', 'Conversacion']);
});

const { liveLayout } = await import('../../../shared/live-layout.js');

test('the editor and the canvas agree on how a scene picks a layout', () => {
  // The canvas asks shared/live-layout.js, which the Library asks too; wherever a scene is bound it must pick what the server's own rule picks.
  const app = fs.readFileSync(new URL('../../web/App.tsx', SCRIPT_URL), 'utf8');
  assert.ok(app.includes(': liveLayout(layouts, currentScene, omni);'),
    'App.tsx no longer resolves a layout by the active OBS scene');
  const bound = [{ id: 'a', scenes: ['Gameplay'] }, { id: 'b', scenes: ['Conversacion'] }, { id: 'c', scenes: [] }];
  for (const scene of ['Gameplay', 'Conversacion', 'Starting Soon', '']) {
    assert.equal(liveLayout(bound, scene), layoutForScene(bound, scene), `the canvas and the server disagree about "${scene}"`);
  }
  assert.equal(liveLayout([{ id: 'x' }, { id: 'y' }], 'Anything').id, 'x',
    'App.tsx no longer falls back to the first layout when nobody uses scene binding');
});

// ------------------------------------------------------------ alert configs

export const { normaliseAlert, ALERT_TYPES } = await import('../../engine/alerts.js');
export const { MAX_SCOPED_CSS, MAX_ALERT_CSS, MAX_CHAT_CSS } = await import('../../../shared/clean-css.js');

test('an alert saved with a nonexistent animation gets a real one', () => {
  // Three conventions reached disk over time — 'fadeIn' from createAlert,
  // 'animate-pop-in' from the old builder, 'fadeOut' from both — and not one
  // of them named a class that existed, so no alert ever animated.
  for (const bad of ['fadeIn', 'animate-pop', 'pop-in', '', undefined, 'animate-nonsense']) {
    const a = normaliseAlert({ id: 'x', animationIn: bad, animationOut: bad });
    assert.ok(a.animationIn.startsWith('animate-'), `bad entrance survived: ${a.animationIn}`);
    assert.ok(a.animationOut.startsWith('animate-'), `bad exit survived: ${a.animationOut}`);
  }
});

test('an animation that does exist is kept', () => {
  const a = normaliseAlert({ id: 'x', animationIn: 'animate-zoom-in', animationOut: 'animate-pop-out' });
  assert.equal(a.animationIn, 'animate-zoom-in');
  assert.equal(a.animationOut, 'animate-pop-out');
});

test('every animation the editor offers is one the stylesheet defines', () => {
  // The renderer, the validator and Tailwind are three lists that have to
  // agree. They did not before: the editor saved names nothing could draw.
  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  const tw = fs.readFileSync(new URL('../../web/tailwind.config.js', SCRIPT_URL), 'utf8');
  const offered = [...overlay.matchAll(/value: '(animate-[a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(offered.length >= 6, `expected the animation lists, found ${offered.length}`);
  for (const cls of offered) {
    const name = cls.replace('animate-', '');
    assert.ok(tw.includes(`'${name}':`), `the editor offers ${cls} but tailwind defines no '${name}' animation`);
    // And the validator must accept it, or saving it silently reverts.
    const which = ['pop-in', 'fade-in', 'zoom-in', 'slide-up', 'slide-down'].includes(name) ? 'animationIn' : 'animationOut';
    assert.equal(normaliseAlert({ id: 'x', [which]: cls })[which], cls, `the server rejects ${cls}`);
  }
});

test('an alert bound to an event that does not exist falls back to a real one', () => {
  assert.equal(normaliseAlert({ id: 'x', type: 'not_a_real_event' }).type, 'twitch_follow');
  assert.equal(normaliseAlert({ id: 'x', type: 'tiktok_gift' }).type, 'tiktok_gift');
});

test('the alert events the server accepts are the ones the client can offer', () => {
  // An alert stored for a type the editor cannot list is one nobody can ever
  // edit again — which is how a tiktok_follow alert ended up named
  // "New twitch_follow Alert" with no way to notice.
  const types = fs.readFileSync(new URL('../../web/types.ts', SCRIPT_URL), 'utf8');
  const union = types.slice(types.indexOf('export type AlertType'), types.indexOf('export interface AlertConfig'));
  for (const t of ALERT_TYPES) {
    assert.ok(union.includes(`'${t}'`), `the server accepts "${t}" but web/types.ts has no such AlertType`);
  }
});

test('style and timing are clamped, not trusted', () => {
  const a = normaliseAlert({
    id: 'x', fontSize: 9999, duration: 999999, soundVolume: 12,
    textColor: 'javascript:alert(1)', accentColor: '#abc',
  });
  assert.equal(a.fontSize, 200);
  assert.equal(a.duration, 60000);
  assert.equal(a.soundVolume, 1);
  // These are interpolated into inline styles on a surface that is on stream.
  // Not a colour is automatic: the look's, or white and pink without one.
  assert.equal(a.textColor, '');
  assert.equal(a.accentColor, '');
});

test('an alert\'s colours and font can be left automatic, and old defaults are read as automatic once', () => {
  const old = normaliseAlert({ id: 'x', textColor: '#FFFFFF', accentColor: '#f43f5e', fontFamily: 'Montserrat' });
  assert.deepEqual([old.textColor, old.accentColor, old.fontFamily], ['', '', ''], 'an old default still covers the look');
  assert.equal(old.settingsVersion, 2);
  const chosen = normaliseAlert({ id: 'x', textColor: '#ffffff', accentColor: '#c8102e', fontFamily: 'Baloo 2' });
  assert.deepEqual([chosen.accentColor, chosen.fontFamily], ['#c8102e', 'Baloo 2'], 'what somebody chose is theirs');
  const again = normaliseAlert({ ...old, accentColor: '#f43f5e', fontFamily: 'Montserrat' });
  assert.deepEqual([again.accentColor, again.fontFamily], ['#f43f5e', 'Montserrat'], 'a default picked since the change was turned back into automatic');
  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(overlay.includes("['--alert-name' as any]: config.accentColor || undefined"));
  assert.ok(overlay.includes('`"${config.fontFamily.replace(/"/g, \'\')}"`'), 'a chosen font reaches the look unquoted, and "Baloo 2" is not a font unquoted');
  const library = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(library.includes("textColor: '', accentColor: ''"), 'the Library\'s sample alert chooses colours, so every look in it shows them instead of its own');
});

const { ALL_PRESETS, presetKind } = await import('../../../shared/css-presets.js');

test('every alert look reads the alert\'s chosen name and words before its own', () => {
  const looks = ALL_PRESETS.filter((p) => p.layerType === 'alert' && presetKind(p) === 'look');
  assert.ok(looks.length >= 2, String(looks.length));
  const ruleOf = (css, part) => (css.match(new RegExp(`\\[data-alert="${part}"\\]\\s*\\{([^}]*)\\}`)) || [])[1] || '';
  for (const p of looks) {
    const name = /(?<![\w-])color\s*:([^;]*)/.exec(ruleOf(p.css, 'name'));
    if (name) assert.match(name[1], /var\(--alert-name,/, `${p.id} colours the name without reading the chosen one`);
    const caption = ruleOf(p.css, 'caption');
    const font = /(?<![\w-])font-family\s*:([^;]*!important)/.exec(caption);
    if (font) assert.match(font[1], /var\(--alert-font,/, `${p.id} forces its font over the chosen one`);
    const words = /(?<![\w-])color\s*:([^;]*)/.exec(caption);
    if (words) assert.match(words[1], /var\(--alert-text,/, `${p.id} colours the words without reading the chosen colour`);
  }
});

test('a duration below the floor is raised rather than accepted', () => {
  assert.equal(normaliseAlert({ id: 'x', duration: 10 }).duration, 500);
  assert.equal(normaliseAlert({ id: 'x', soundVolume: -5 }).soundVolume, 0);
});

test('a layout the renderer cannot draw becomes one it can', () => {
  assert.equal(normaliseAlert({ id: 'x', layout: 'image-diagonal' }).layout, 'image-above');
  assert.equal(normaliseAlert({ id: 'x', layout: 'image-cover' }).layout, 'image-cover');
});

test('garbage in place of an alert yields a usable alert', () => {
  const a = normaliseAlert(undefined);
  assert.ok(a.id && a.type && a.messageTemplate);
  assert.equal(a.enabled, true);
});

test('the overlay renders the text the server interpolated, not the raw template', () => {
  // The server resolves {spotify.track}, {event.bits} and the rest and ships
  // the result as `text`. The overlay used to ignore that and re-split the
  // template on {user}, so every other variable reached the stream literally.
  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/alert as any\)\.text \|\||alert\.text \|\|/.test(overlay),
    'AlertOverlay no longer prefers the server-rendered text');
});

// ------------------------------------------------- channel point scoping

const { dispatch: dispatchAlerts } = await import('../../engine/alerts.js');

/** Collect what a dispatch actually emitted, rather than trusting the count. */
function firedBy(configs, event) {
  const seen = [];
  const listener = (a) => seen.push(a.config.id);
  bus.on(EVENTS.ALERT, listener);
  dispatchAlerts(configs.map(normaliseAlert), event);
  bus.off(EVENTS.ALERT, listener);
  return seen;
}

const redemption = (rewardId, reward = 'Hydrate') => ({
  type: 'twitch_redemption', user: 'Someone', platform: 'twitch',
  data: { rewardId, reward },
});

test('a channel points alert with no reward chosen fires on every redemption', () => {
  const configs = [{ id: 'any', type: 'twitch_redemption', enabled: true }];
  assert.deepEqual(firedBy(configs, redemption('reward-a')), ['any']);
  assert.deepEqual(firedBy(configs, redemption('reward-b')), ['any']);
});

test('choosing a reward narrows it to that reward alone', () => {
  const configs = [{ id: 'scoped', type: 'twitch_redemption', enabled: true, redemptionRewardId: 'reward-a' }];
  assert.deepEqual(firedBy(configs, redemption('reward-a')), ['scoped']);
  assert.deepEqual(firedBy(configs, redemption('reward-b')), [], 'it fired for the wrong reward');
});

test('a scoped and an unscoped alert can coexist on one redemption', () => {
  // The catch-all still wants to fire alongside the specific one, which is the
  // whole reason "any reward" stays an option rather than being forced.
  const configs = [
    { id: 'any', type: 'twitch_redemption', enabled: true },
    { id: 'scoped', type: 'twitch_redemption', enabled: true, redemptionRewardId: 'reward-a' },
  ];
  assert.deepEqual(firedBy(configs, redemption('reward-a')).sort(), ['any', 'scoped']);
  assert.deepEqual(firedBy(configs, redemption('reward-b')), ['any']);
});

test('the reward scope survives being saved', () => {
  // It reaches the server as part of the alert like any other field; dropping
  // it in validation would silently widen the alert back to everything.
  assert.equal(normaliseAlert({ id: 'x', type: 'twitch_redemption', redemptionRewardId: 'abc-123' }).redemptionRewardId, 'abc-123');
  assert.equal(normaliseAlert({ id: 'x', type: 'twitch_redemption' }).redemptionRewardId, '');
});

test('the reward scope only narrows redemptions, not other events', () => {
  // A stale id left on an alert later re-pointed at follows must not stop it.
  const configs = [{ id: 'f', type: 'twitch_follow', enabled: true, redemptionRewardId: 'reward-a' }];
  assert.deepEqual(firedBy(configs, { type: 'twitch_follow', user: 'Someone', platform: 'twitch', data: {} }), ['f']);
});

test('the alert editor offers the reward picker for redemptions', () => {
  // The server has scoped per-reward all along; the previous builder never
  // exposed it, so every channel points alert fired on everything.
  const view = fs.readFileSync(new URL('../../web/components/views/AlertsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/twitch_redemption/.test(view), 'no redemption-specific branch in the editor');
  assert.ok(/redemptionRewardId/.test(view), 'the editor never reads or writes redemptionRewardId');
});

// --------------------------------------------------------- alert variations

const { pickVariation, CONDITION_FIELDS } = await import('../../engine/alerts.js');

const cheerAlert = (variations) => normaliseAlert({
  id: 'cheer', type: 'twitch_cheer', fontSize: 32, messageTemplate: '{user} cheered!',
  animationIn: 'animate-fade-in', variations,
});
const cheer = (bits) => ({ type: 'twitch_cheer', user: 'Someone', platform: 'twitch', data: { bits, amount: bits } });

test('a big event gets the variation, a small one gets the base alert', () => {
  const a = cheerAlert([{ name: 'Big', conditions: [{ field: 'bits', op: 'gte', value: 1000 }], fontSize: 72 }]);
  assert.equal(pickVariation(a, cheer(5000)).fontSize, 72);
  assert.equal(pickVariation(a, cheer(100)).fontSize, 32);
});

test('a variation only overrides what it sets', () => {
  // The whole point: change the size for big cheers without re-specifying the
  // font, the colours and the animation you already chose.
  const a = cheerAlert([{ name: 'Big', conditions: [{ field: 'bits', op: 'gte', value: 1000 }], fontSize: 72 }]);
  const picked = pickVariation(a, cheer(5000));
  assert.equal(picked.fontSize, 72);
  assert.equal(picked.animationIn, 'animate-fade-in', 'the base animation was lost');
  assert.equal(picked.messageTemplate, '{user} cheered!', 'the base message was lost');
});

test('the first matching variation wins, not the most specific', () => {
  // Order is the rule, because it is the only one you can predict by reading
  // the list. The second variation here is strictly more specific — two
  // conditions against one — and both match, so a specificity rule would pick
  // it. First-listed must win anyway.
  const a = normaliseAlert({
    id: 'cheer', type: 'twitch_cheer', fontSize: 32,
    variations: [
      { name: 'Any big cheer', conditions: [{ field: 'bits', op: 'gte', value: 1000 }], fontSize: 48 },
      { name: 'Big and huge', fontSize: 96, conditions: [
        { field: 'bits', op: 'gte', value: 1000 },
        { field: 'bits', op: 'lte', value: 9000 },
      ] },
    ],
  });
  assert.equal(pickVariation(a, cheer(5000)).variationName, 'Any big cheer');
  assert.equal(pickVariation(a, cheer(5000)).fontSize, 48);
});

test('reordering changes which one wins', () => {
  const a = cheerAlert([
    { name: 'Huge', conditions: [{ field: 'bits', op: 'gte', value: 5000 }], fontSize: 96 },
    { name: 'Medium', conditions: [{ field: 'bits', op: 'gte', value: 1000 }], fontSize: 48 },
  ]);
  assert.equal(pickVariation(a, cheer(5000)).variationName, 'Huge');
  assert.equal(pickVariation(a, cheer(2000)).variationName, 'Medium');
});

test('every condition must hold, not just one', () => {
  const a = normaliseAlert({
    id: 'sub', type: 'twitch_sub',
    variations: [{ name: 'Loyal tier 3', fontSize: 80, conditions: [
      { field: 'tier', op: 'gte', value: 3 },
      { field: 'months', op: 'gte', value: 12 },
    ] }],
  });
  const sub = (tier, months) => ({ type: 'twitch_sub', user: 'X', data: { tier, months } });
  assert.equal(pickVariation(a, sub(3, 24)).variationName, 'Loyal tier 3');
  assert.equal(pickVariation(a, sub(3, 2)).variationName, undefined, 'matched on tier alone');
  assert.equal(pickVariation(a, sub(1, 24)).variationName, undefined, 'matched on months alone');
});

test('a condition on a field the event does not carry never holds', () => {
  // Otherwise a missing value reads as 0 and "at least 1 bit" matches a follow.
  const a = normaliseAlert({
    id: 'f', type: 'twitch_follow',
    variations: [{ name: 'Nope', fontSize: 99, conditions: [{ field: 'bits', op: 'gte', value: 0 }] }],
  });
  assert.equal(pickVariation(a, { type: 'twitch_follow', user: 'X', data: {} }).fontSize, 32);
});

test('a variation with no conditions is a catch-all', () => {
  const a = cheerAlert([{ name: 'Always', conditions: [], fontSize: 55 }]);
  assert.equal(pickVariation(a, cheer(1)).variationName, 'Always');
});

test('nonsense conditions are dropped rather than stored', () => {
  const a = cheerAlert([{ name: 'Bad', conditions: [
    { field: 'not_a_field', op: 'gte', value: 1 },
    { field: 'bits', op: 'contains', value: 1 },
    { field: 'bits', op: 'gte', value: 'lots' },
    { field: 'bits', op: 'gte', value: 500 },
  ] }]);
  assert.deepEqual(a.variations[0].conditions, [{ field: 'bits', op: 'gte', value: 500 }]);
});

test('a variation carrying its own variations does not recurse forever', () => {
  // A hand-edited config file should not be able to hang the server.
  const a = cheerAlert([{ name: 'Nested', conditions: [], variations: [{ name: 'Deeper', variations: [{}] }] }]);
  assert.equal(a.variations.length, 1);
  assert.equal(a.variations[0].variations, undefined);
});

test('an alert with no variations behaves exactly as before', () => {
  const a = normaliseAlert({ id: 'plain', type: 'twitch_cheer', fontSize: 40 });
  assert.deepEqual(a.variations, []);
  assert.equal(pickVariation(a, cheer(9999)), a, 'a plain alert should come back untouched');
});

test('the condition fields the editor offers are the ones the server accepts', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/AlertsView.tsx', SCRIPT_URL), 'utf8');
  const block = view.slice(view.indexOf('const CONDITION_FIELDS'), view.indexOf('const OP_LABEL'));
  const offered = [...block.matchAll(/field: '([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(offered.length >= 8, `expected the editor's condition list, found ${offered.length}`);
  for (const f of offered) {
    assert.ok(CONDITION_FIELDS.some((x) => x.field === f), `the editor offers "${f}" but the server drops it`);
  }
  for (const { field } of CONDITION_FIELDS) {
    assert.ok(offered.includes(field), `the server accepts "${field}" but the editor never offers it`);
  }
});

test('a subscription tier is a number, not Twitch wire format', () => {
  // Twitch says "1000"/"2000"/"3000", or "Prime". Left raw, a message reads
  // "subscribed at tier 2000" and "tier is at least 2" never matches.
  const twitch = fs.readFileSync(new URL('../platforms/twitch.js', SCRIPT_URL), 'utf8');
  assert.ok(/function tierNumber/.test(twitch), 'twitch.js no longer normalises the tier');
  assert.ok(!/data: \{ tier: e\.tier \}/.test(twitch), 'the EventSub path still emits the raw tier');
});

test('the alert on screen is retired by an effect the queue cannot cancel', () => {
  // These were one effect keyed on [alertQueue, currentAlert]. A second alert
  // landing in the queue re-ran it, React fired the previous cleanup and
  // cancelled the pending timer, then the currentAlert guard returned before
  // setting a new one — so the first alert stayed on screen forever and
  // nothing behind it ever played. Only visible with more than one alert.
  const hook = fs.readFileSync(new URL('../../web/hooks/useStreamSystem.ts', SCRIPT_URL), 'utf8');
  const retire = hook.slice(hook.indexOf('Retire the alert on screen'));
  const deps = retire.slice(retire.indexOf('setCurrentAlert(null)')).match(/\}, \[([^\]]*)\]\);/);
  assert.ok(deps, 'could not find the retire effect dependencies');
  assert.equal(deps[1].trim(), 'currentAlert',
    'the retire timer depends on more than currentAlert, so the queue can cancel it again');
});

// ------------------------------------------ video alerts and gift bundles

test('an alert can use a video, not only an image', () => {
  // A webm with an alpha channel is what most noticeable alerts are made of,
  // and an <img> renders precisely nothing for one.
  const overlay = fs.readFileSync(new URL('../../web/components/AlertOverlay.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/webm\|mp4/.test(overlay), 'the overlay no longer recognises a video');
  assert.ok(/<video/.test(overlay), 'the overlay has no video element');
  assert.ok(/muted/.test(overlay), 'the video is not muted, so autoplay can be blocked and it can talk over the sound');
});

test('uploads accept the sound and video an alert needs', () => {
  // Uploads were images only, which silently broke the sound button: an mp3
  // was refused with "must be a plain image filename".
  const http = fs.readFileSync(new URL('../api/http.js', SCRIPT_URL), 'utf8');
  for (const ext of ['.mp3', '.ogg', '.wav', '.webm', '.mp4', '.png']) {
    assert.ok(http.includes(`'${ext}'`), `uploads still refuse ${ext}`);
  }
  assert.ok(/ASSET_KINDS\[assetKind/.test(http), 'every kind is still held to one size cap');
});

test('a gifted-sub bundle is its own event, and its recipients are marked', () => {
  // tmi.js announces the bundle then sends one subgift per recipient, so a
  // fifty-sub bomb was fifty alerts.
  const twitch = fs.readFileSync(new URL('../platforms/twitch.js', SCRIPT_URL), 'utf8');
  assert.ok(/submysterygift/.test(twitch), 'the bundle announcement is still ignored');
  assert.ok(/twitch_sub_gift_bulk/.test(twitch), 'no bundle event is emitted');
  assert.ok(/fromBulk/.test(twitch), 'recipients are not marked as part of a bundle');
});

test('recipients of a bundle are still emitted, so history and levels see them', () => {
  // Suppressing the events outright would have silently stopped counting subs.
  const twitch = fs.readFileSync(new URL('../platforms/twitch.js', SCRIPT_URL), 'utf8');
  const handler = twitch.slice(twitch.indexOf("client.on('subgift'"), twitch.indexOf("client.on('subgift'") + 600);
  assert.ok(/sub\(recipient/.test(handler), 'the individual sub event is no longer emitted at all');
});

test('a bundle collapses the individual alerts — but only if there is one to show', () => {
  const recipient = { type: 'twitch_sub', user: 'Lucky', platform: 'twitch', data: { giftedBy: 'Gifter', fromBulk: true } };
  const subAlert = normaliseAlert({ id: 'sub', type: 'twitch_sub', enabled: true });
  const bundleAlert = normaliseAlert({ id: 'bundle', type: 'twitch_sub_gift_bulk', enabled: true });

  const seen = [];
  const listen = (a) => seen.push(a.config.id);
  bus.on(EVENTS.ALERT, listen);

  // With a bundle alert configured, the individual ones are collapsed away.
  seen.length = 0;
  dispatchAlerts([subAlert, bundleAlert], recipient);
  assert.deepEqual(seen, [], 'an individual recipient still fired its own alert');

  // Without one, the old behaviour stands rather than going silent.
  seen.length = 0;
  dispatchAlerts([subAlert], recipient);
  assert.deepEqual(seen, ['sub'], 'with no bundle alert to show, the recipient alert should still fire');

  bus.off(EVENTS.ALERT, listen);
});

test('an ordinary gifted sub, outside a bundle, is unaffected', () => {
  const single = { type: 'twitch_sub', user: 'Lucky', platform: 'twitch', data: { giftedBy: 'Gifter' } };
  const seen = [];
  const listen = (a) => seen.push(a.config.id);
  bus.on(EVENTS.ALERT, listen);
  dispatchAlerts([normaliseAlert({ id: 'sub', type: 'twitch_sub', enabled: true })], single);
  bus.off(EVENTS.ALERT, listen);
  assert.deepEqual(seen, ['sub']);
});

test('the bundle alert is offered in the editor and accepted by the server', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/AlertsView.tsx', SCRIPT_URL), 'utf8');
  const types = fs.readFileSync(new URL('../../web/types.ts', SCRIPT_URL), 'utf8');
  const union = types.slice(types.indexOf('export type AlertType'), types.indexOf('export interface AlertCondition'));
  assert.ok(ALERT_TYPES.includes('twitch_sub_gift_bulk'), 'the server does not accept the bundle type');
  assert.ok(view.includes("'twitch_sub_gift_bulk'"), 'the editor never offers the bundle alert');
  assert.ok(union.includes("'twitch_sub_gift_bulk'"), 'AlertType has no bundle type');
});


{
  const { buildTestEvent } = await import('../../engine/alerts.js');
  const data = (type) => buildTestEvent({ type }).data;
  test('a test alert carries every number a real one would, so any message tests true', () => {
    assert.equal(data('twitch_raid').viewers, 42);
    assert.equal(data('raid').viewers, 42);
    assert.equal(data('sub_gift_bulk').count, 5);
    assert.equal(data('twitch_sub_gift_bulk').count, 5);
    assert.equal(data('tiktok_gift').count, 10);
    assert.equal(data('twitch_cheer').bits, 500);
  });
}

// ------------------------------------------------- read aloud

{
  const { readingMs, DEFAULT_ALERT_TTS_TEXT } = await import('../../engine/alerts.js');
  const { showsAlerts, preferred } = await import('../../api/ws.js');
  const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
  const heard = [];
  const listen = (a) => heard.push(a);
  bus.on(EVENTS.ALERT, listen);
  const reading = normaliseAlert({ id: 'read', type: 'twitch_cheer', messageTemplate: '{user} dio {event.bits} bits', duration: 3000, tts: { enabled: true, rate: 1, delayMs: 1000 } });
  const quiet = normaliseAlert({ id: 'quiet', type: 'twitch_cheer', messageTemplate: '{user} dio {event.bits} bits' });
  dispatchAlerts([reading, quiet], { type: 'twitch_cheer', platform: 'twitch', user: 'Ana', data: { bits: 100, message: 'hola a todos, esto es un mensaje largo para leer en voz alta' } });
  dispatchAlerts([normaliseAlert({ id: 'follow', type: 'twitch_follow', messageTemplate: 'Nuevo seguidor: {user}', tts: { enabled: true } })], { type: 'twitch_follow', platform: 'twitch', user: 'Beto', data: {} });
  dispatchAlerts([normaliseAlert({ id: 'blank', type: 'twitch_follow', tts: { enabled: true, text: '{message}' } })], { type: 'twitch_follow', platform: 'twitch', user: 'Caro', data: {} });
  bus.off(EVENTS.ALERT, listen);
  const [readOut, notRead, follow, blank] = heard;

  test('an alert can be read aloud: off unless turned on, its caption and what the viewer wrote', () => {
    assert.deepEqual(normaliseAlert({ id: 'x' }).tts, { enabled: false, text: DEFAULT_ALERT_TTS_TEXT, voice: '', rate: 1, pitch: 1, volume: 1, delayMs: 1000 });
    const wild = normaliseAlert({ id: 'x', tts: { enabled: 'yes', rate: 9, volume: -1, delayMs: 99999, voice: 'Microsoft Raul - Spanish (Mexico)' } }).tts;
    assert.deepEqual([wild.enabled, wild.rate, wild.volume, wild.delayMs, wild.voice], [false, 2, 0, 10000, 'Microsoft Raul - Spanish (Mexico)']);
    assert.equal(readOut.speak.text, 'Ana dio 100 bits hola a todos, esto es un mensaje largo para leer en voz alta');
    assert.equal(readOut.speak.delayMs, 1000);
    // Kept up for as long as reading it takes, so the next alert waits its turn.
    assert.ok(readOut.config.duration > 3000 && readOut.config.duration === readingMs(readOut.speak.text, 1, 1000));
    assert.equal(notRead.speak, undefined, 'an alert not set to read spoke anyway');
    assert.equal(notRead.config.duration, 5000);
    // With nothing written, the caption alone; with nothing at all to say, nothing.
    assert.equal(follow.speak.text, 'Nuevo seguidor: Beto');
    assert.equal(blank.speak, undefined);
    // The viewer's words reach the caption too, as {message}.
    assert.ok(read('../engine/alerts.js').includes("message: event.data?.message ?? event.data?.input ?? ''"));
  });

  test('speech goes to the page that shows the alerts first, then the dock, and an alert is read by one page only', () => {
    const layouts = [
      { id: 'with', layers: [{ type: 'avatar' }, { type: 'alerts' }] },
      { id: 'hidden', layers: [{ type: 'alerts', visible: false }] },
      { id: 'without', layers: [{ type: 'chat' }] },
    ];
    assert.equal(showsAlerts({ mode: 'canvas', layoutId: 'with' }, layouts), true);
    assert.equal(showsAlerts({ mode: 'canvas', layoutId: 'hidden' }, layouts), false);
    assert.equal(showsAlerts({ mode: 'canvas', layoutId: 'without' }, layouts), false);
    assert.equal(showsAlerts({ mode: 'alerts' }, layouts), true);
    assert.equal(showsAlerts({ mode: 'dock' }, layouts), false);
    const dock = { mode: 'dock', isLocal: false, connectedAt: 1 };
    const canvas = { mode: 'canvas', layoutId: 'with', isLocal: false, connectedAt: 5 };
    const plain = { mode: 'canvas', layoutId: 'without', isLocal: false, connectedAt: 0 };
    assert.equal(preferred(canvas, dock, layouts), true, 'the dock beat the alerts');
    assert.equal(preferred(dock, plain, layouts), true, 'a canvas without alerts beat the dock');
    const ws = read('../api/ws.js');
    assert.ok(ws.includes('ws === sink ? { ...a, audible: true } : shown'), 'every page is told to read the alert');
    assert.ok(read('../../web/hooks/useBackend.ts').includes("layout: query.get('layout') || undefined"), 'a canvas does not say which layout it shows');
    const hook = read('../../web/hooks/useStreamSystem.ts');
    assert.ok(hook.includes('const speak = currentAlert?.speak;') && hook.includes('speakAloud(speak, currentAlert!.id)'), 'the page never reads the alert');
    assert.ok(read('../../web/components/views/AlertsView.tsx').includes('data-alert-read-toggle'), 'the alert editor has no way to turn it on');
  });

  test('a canvas that follows the OBS scene speaks when the layout on stream has the alerts, by the same rule it draws by', () => {
    const bound = [
      { id: 'main', scenes: ['Gameplay'], layers: [{ type: 'alerts' }] },
      { id: 'chat', scenes: ['Just Chatting'], layers: [{ type: 'chat' }] },
      { id: 'omni', layers: [{ type: 'alerts' }] },
    ];
    const following = { mode: 'canvas', isLocal: false, connectedAt: 5 };
    assert.equal(showsAlerts(following, bound, 'Gameplay'), true, 'the scene\'s layout has the alerts, yet the canvas showing it does not count');
    assert.equal(showsAlerts(following, bound, 'Just Chatting'), false);
    assert.equal(showsAlerts(following, bound, 'Nobody bound this'), false, 'a scene showing nothing counted as showing the alerts');
    // Nothing bound to any scene: the first layout, as the page draws it.
    assert.equal(showsAlerts(following, [{ id: 'a', layers: [{ type: 'alerts' }] }, { id: 'b', layers: [] }], ''), true);
    assert.equal(showsAlerts(following, [{ id: 'b', layers: [] }, { id: 'a', layers: [{ type: 'alerts' }] }], ''), false);
    // The Omnilayer's live layout, while OBS is on its scene.
    const omnilayer = { enabled: true, live: 'omni', scene: 'Omnilayer' };
    assert.equal(showsAlerts(following, bound, 'Omnilayer', omnilayer), true);
    assert.equal(showsAlerts(following, bound, 'Just Chatting', omnilayer), false);
    // A pinned canvas is still its own layout, whatever the scene.
    assert.equal(showsAlerts({ mode: 'canvas', layoutId: 'chat' }, bound, 'Gameplay'), false);
    const dock = { mode: 'dock', isLocal: true, connectedAt: 1 };
    assert.equal(preferred(following, dock, bound, { scene: 'Gameplay' }), true, 'the dock read the alert over the stream page');
    assert.equal(preferred(dock, following, bound, { scene: 'Just Chatting' }), true);
    const ws = read('../api/ws.js');
    assert.ok(ws.includes('return liveLayout(layouts, scene, omnilayer);'), 'the server and the page pick the live layout by different rules');
    assert.ok(ws.includes("const liveNow = () => ({ scene: obs.currentScene(), omnilayer: engine.store.omnilayerState?.() || null });") && ws.includes("const live = liveNow();"), 'the speaker is chosen without the scene');
  });
}

// ------------------------------------------------- the Alerts audit

{
  const { buildTestEvent, dispatch: dispatchAlert } = await import('../../engine/alerts.js');
  const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
  const view = read('../../web/components/views/AlertsView.tsx');
  const words = read('../../web/constants.ts');
  const enBlock = words.slice(words.indexOf('\n  en: {'), words.indexOf('\n  es: {'));
  const esBlock = words.slice(words.indexOf('\n  es: {'));
  const inBoth = (key) => new RegExp(`\\n\\s+${key}:`).test(enBlock) && new RegExp(`\\n\\s+${key}:`).test(esBlock);
  const keyPart = (s) => s.split(/[_ ]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  // Every event the screen offers, with the caption a new alert starts with.
  const offered = [...view.matchAll(/\{ type: '([a-z_]+)', label: '[^']*', sample: '([^']*)' \}/g)].map((m) => ({ type: m[1], sample: m[2] }));

  test('a test alert is a real event on a real platform, with every field a real one carries', () => {
    assert.ok(offered.length >= 25, `expected the editor's event list, found ${offered.length}`);
    // An alert for a kind fires as that kind somewhere, so {platform} and {words.*} say what they would on stream.
    assert.deepEqual([buildTestEvent({ type: 'follow' }).type, buildTestEvent({ type: 'follow' }).platform], ['twitch_follow', 'twitch']);
    assert.equal(buildTestEvent({ type: 'sub_gift_bulk' }).platform, 'twitch', 'a gift bundle tested on a platform called "sub"');
    assert.equal(buildTestEvent({ type: 'gift' }).platform, 'tiktok');
    // Levels, giveaways and the shop happen to a viewer in a chat.
    for (const type of ['level_up', 'giveaway_winner', 'points_redeem']) assert.equal(buildTestEvent({ type }).platform, 'twitch', `${type} tested on no platform`);
    assert.equal(buildTestEvent({ type: 'level_up' }).data.level, 5);
    assert.equal(buildTestEvent({ type: 'giveaway_winner' }).data.prize, 'Premio de prueba');
    assert.equal(buildTestEvent({ type: 'points_redeem' }).data.item, 'Hidratarse');
    assert.equal(buildTestEvent({ type: 'youtube_cheer' }).data.amount, '$5.00');
    assert.equal(buildTestEvent({ type: 'twitch_sub' }).data.tier, 1, 'a test sub says tier "1000", which no real one does');
    const reward = buildTestEvent({ type: 'twitch_redemption', redemptionRewardId: 'r-1' }).data;
    assert.deepEqual([reward.rewardId, reward.reward, reward.rewardName], ['r-1', 'Recompensa de prueba', 'Recompensa de prueba']);
    assert.equal(buildTestEvent({ type: 'obs_scene_changed' }).user, 'Gameplay');
    // One table for the test and the preview.
    assert.ok(read('../engine/alerts.js').includes("import { sampleEvent } from '../../shared/alert-samples.js';"));
    assert.ok(view.includes("import { sampleEvent } from '../../../shared/alert-samples.js';") && view.includes("sampleEvent(draft?.type || '', SAMPLE_USER)"), 'the preview fills captions from its own guesses');
  });

  test('every caption a new alert starts with is in Spanish, and fires on stream with nothing left in braces', () => {
    const english = /\b(just|gifted|raided|subscribed|cheered|redeemed|sent|shared|joined|boosted|is a|is the|now playing|we are|that is|switching|member!)\b/i;
    const heard = [];
    const listen = (a) => heard.push(a);
    bus.on(EVENTS.ALERT, listen);
    try {
      for (const { type, sample } of offered) {
        assert.ok(!english.test(sample), `the ${type} alert starts out saying "${sample}" on a Spanish stream`);
        heard.length = 0;
        const config = normaliseAlert({ id: `audit-${type}`, type, messageTemplate: sample });
        dispatchAlert([config], buildTestEvent(config), { name: 'Blue Monday', artist: 'New Order' });
        assert.equal(heard.length, 1, `testing the ${type} alert showed nothing`);
        assert.ok(!heard[0].text.includes('{'), `testing the ${type} alert put "${heard[0].text}" on stream`);
      }
    } finally {
      bus.off(EVENTS.ALERT, listen);
    }
  });

  test('the Alerts screen speaks the screen\'s language: events, groups, numbers, layouts, entrances', () => {
    for (const { type } of offered) assert.ok(inBoth(`alertType${keyPart(type)}`), `the ${type} event has no name in one of the languages`);
    for (const group of ['Any platform', 'Levels', 'Stream']) assert.ok(inBoth(`alertGroup${keyPart(group)}`), `the "${group}" heading is English only`);
    const fields = view.slice(view.indexOf('const CONDITION_FIELDS'), view.indexOf('const OP_LABEL'));
    for (const [, field] of fields.matchAll(/field: '([a-z]+)'/g)) assert.ok(inBoth(`alertsField${keyPart(field)}`), `the "${field}" condition is English only`);
    for (const [, key] of view.matchAll(/key: '(alertsLayout[A-Za-z]+)'/g)) assert.ok(inBoth(key), `${key} is missing a language`);
    for (const [, key] of view.matchAll(/': '(alertsAnim[A-Za-z]+)'/g)) assert.ok(inBoth(key), `${key} is missing a language`);
    for (const key of ['alertsAnd', 'alertsDefaultName', 'alertsVariationDefaultName', 'alertsUrlPlaceholder', 'alertsVariationUp', 'alertsVariationDown', 'alertsVariationRemove', 'alertsConditionRemove', 'alertsDeleteConfirm', 'alertsUploadFailed']) {
      assert.ok(inBoth(key), `${key} is missing a language`);
    }
    // Read through t, not printed raw.
    for (const raw of ['{g.group}</span>', '<Plus size={10} /> {x.label}', "join(' and ')", 'placeholder="https://', '{a.label}</option>)}', '{f.label}</option>', '`${info?.label || type} alert`']) {
      assert.ok(!view.includes(raw), `the Alerts screen still prints ${raw}`);
    }
  });

  test('a failed upload on the Alerts screen says why, and deleting an alert asks first', () => {
    assert.ok(view.includes("setUploadError({ kind, text: refusalWords(t, err)"), 'an upload that fails is not explained');
    assert.ok(view.includes("uploadError?.kind === 'image'") && view.includes("uploadError?.kind === 'sound'"), 'the reason does not show under the box it was for');
    assert.ok(!view.includes('the button returning to normal is the failure signal'));
    assert.ok(view.includes('if (!window.confirm(fill(t.alertsDeleteConfirm'), 'an alert is deleted without asking');
  });
}
