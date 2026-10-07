/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Text layers, repeatable layers, shapes, conditions, fonts, one look, motion, the escape hatch.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';
import { LAYER_TYPES, normaliseLayout, normaliseLayouts } from './backup-and-layouts.js';

// ------------------------------------------------- free text, with live values

export const { OVERLAY_VARS, fillTemplate } = await import('../../../shared/overlay-vars.js');

test('a text layer puts live values into whatever you typed', () => {
  const state = {
    stats: { twitchFollowers: 1234 },
    streamTags: { latestSubscriber: { user: 'nora' } },
    spotifyTrack: { name: 'Bad Habit', artist: 'Steve Lacy' },
  };
  assert.equal(
    fillTemplate('{followers} seguidores — gracias {latestSubscriber}! escuchando {nowPlaying}', state),
    '1,234 seguidores — gracias nora! escuchando Bad Habit',
  );
});

test('a value that has not happened yet reads as an absence, not as undefined', () => {
  // No raid tonight is a normal state, and "undefined" on stream is not.
  assert.equal(fillTemplate('last raid: {latestRaid}', { streamTags: {} }), 'last raid: —');
});

test('a misspelt variable stays on screen so it can be seen and fixed', () => {
  /*
    The opposite choice — blanking it — makes a typo invisible: the preview
    looks empty for no stated reason and the same emptiness goes out live.
  */
  assert.equal(fillTemplate('{folowers} followers', { stats: { twitchFollowers: 9 } }), '{folowers} followers');
});

test('every variable the editor offers is one the layer can resolve', () => {
  /*
    The picker is generated from this same list, so this is really a check that
    each entry can be read at all: one that threw on an empty state would put
    a raw "{name}" on stream the moment something was not connected yet.
  */
  for (const v of OVERLAY_VARS) {
    assert.equal(typeof v.name, 'string', JSON.stringify(v));
    assert.equal(typeof v.label, 'string', v.name);
    assert.equal(fillTemplate(`{${v.name}}`, {}) === `{${v.name}}`, false, `{${v.name}} resolved to itself`);
  }
});

test('a text layer is checked like everything else that reaches a stream', () => {
  const [l] = normaliseLayouts([{
    id: 'a',
    layers: [{ type: 'text', config: { text: 'hi', fontSize: 9999, align: 'sideways', fontFamily: 'Wingdings', color: 'red; url(x)' } }],
  }]);
  const c = l.layers[0].config;
  assert.ok(c.fontSize <= 400, String(c.fontSize));
  assert.equal(c.align, 'left');
  assert.equal(c.fontFamily, 'Wingdings', 'an uploaded font would be thrown away on save');
  assert.equal(c.color, '', 'what is not a colour is left automatic: the look\'s, or white');
});

/*
  Controls win, on the text layer: what the panel is set to beats the look on
  the layer, and what it was never set to is the look's to decide.
*/
const { settingsBehind, SETTINGS_VERSION } = await import('../../engine/layouts.js');
const { ALL_PRESETS } = await import('../../../shared/css-presets.js');

test('a text colour can be left automatic, and one stored before that was possible is read as automatic once', () => {
  const text = (config) => normaliseLayouts([{ id: 'a', layers: [{ type: 'text', config }] }])[0].layers[0].config;
  // Stored before the mark: the old default is what every untouched layer held.
  assert.equal(text({ color: '#ffffff' }).color, '', 'the old white default still covers any look');
  assert.equal(text({ color: '#FFFFFF' }).color, '');
  assert.equal(text({}).color, '');
  assert.equal(text({ color: '#ff8800' }).color, '#ff8800', 'a colour somebody chose is theirs');
  // Marked, so it happens once: a white chosen after that is kept.
  const once = text({ color: '#ffffff' });
  assert.equal(once.settingsVersion, SETTINGS_VERSION);
  assert.equal(text({ ...once, color: '#ffffff' }).color, '#ffffff', 'a white picked since the change was turned back into automatic');
  assert.equal(text({ ...once, color: '' }).color, '');
});

test('layouts on disk from before the mark are saved through once at startup, so an old white stops covering the look', () => {
  const old = [{ id: 'a', layers: [{ type: 'text', config: { color: '#ffffff' } }, { type: 'shape', config: {} }, { type: 'text', config: { color: '#ff8800' } }] }];
  assert.equal(settingsBehind(old), 2);
  assert.equal(settingsBehind(normaliseLayouts(old)), 0, 'saving through validation marks every text layer');
  assert.equal(settingsBehind(undefined), 0);
  // Layouts are read from disk as stored; only saving them rewrites anything.
  const engine = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  assert.match(engine, /const behind = settingsBehind\(db\.layouts\.get\(\)\);\s*if \(behind\) \{\s*store\.setLayouts\(db\.layouts\.get\(\)\);/);
});

test('the text layer writes a colour only when one is chosen, and the panel says when the look decides', () => {
  const layer = fs.readFileSync(new URL('../../web/components/TextLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(layer.includes('color: config.color || undefined'), 'an automatic colour is written inline and covers the look');
  assert.ok(layer.includes('text-white" data-text="words"'), 'without a look, automatic is white');
  assert.ok(layer.includes("fontFamily: config.fontFamily || undefined"));
  assert.ok(layer.includes("textTransform: config.uppercase ? 'uppercase' : undefined"));
  const panel = fs.readFileSync(new URL('../../web/components/TextLayerPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes("data-text-colour={config.color ? 'set' : 'auto'}"));
  assert.ok(panel.includes("patch({ color: '' })"), 'nothing hands a chosen colour back to the look');
  assert.ok(panel.includes("t.fontAutomatic || 'Automatic'"));
});

test('a goal\'s track and text colours can be left automatic, and old defaults are read as automatic once', () => {
  const goal = (config) => normaliseLayouts([{ id: 'a', layers: [{ type: 'goal', config }] }])[0].layers[0].config;
  const old = goal({ trackColor: '#27272acc', textColor: '#FFFFFF', barColor: '' });
  assert.deepEqual([old.trackColor, old.textColor, old.barColor], ['', '', ''], 'an old default still covers the look');
  assert.equal(old.settingsVersion, SETTINGS_VERSION);
  const chosen = goal({ trackColor: '#1e3a8a', textColor: '#fde047', barColor: '#22c55e' });
  assert.deepEqual([chosen.trackColor, chosen.textColor, chosen.barColor], ['#1e3a8a', '#fde047', '#22c55e'], 'a colour somebody chose is theirs');
  assert.equal(goal({ ...old, textColor: '#ffffff' }).textColor, '#ffffff', 'a white picked since the change was turned back into automatic');
  assert.equal(settingsBehind([{ id: 'a', layers: [{ type: 'goal', config: { textColor: '#ffffff' } }] }]), 1, 'an old goal is not saved through at startup');
});

test('every goal look reads the layer\'s chosen colours before its own', () => {
  /*
    GoalBar sets --goal-bar, --goal-track and --goal-text only when chosen. A
    look painting the fill, the track or the numbers without reading them is
    one where the goal's colours do nothing.
  */
  const looks = ALL_PRESETS.filter((p) => p.layerType === 'goal');
  assert.ok(looks.length >= 2, String(looks.length));
  const ruleOf = (css, part) => (css.match(new RegExp(`\\[data-goal="${part}"\\][^{]*\\{([^}]*)\\}`)) || [])[1] || '';
  for (const p of looks) {
    assert.match(ruleOf(p.css, 'track'), /background:[^;]*var\(--goal-track,/, `${p.id} paints the track without reading its chosen colour`);
    assert.match(ruleOf(p.css, 'fill'), /background:[^;]*var\(--goal-bar,/, `${p.id} paints the fill without reading the chosen bar colour`);
    assert.ok(p.css.includes('var(--goal-text,'), `${p.id} colours the words without reading the chosen text colour`);
  }
  const bar = fs.readFileSync(new URL('../../web/components/GoalBar.tsx', SCRIPT_URL), 'utf8');
  for (const v of ['--goal-bar\' as any]: config.barColor || undefined', '--goal-track\' as any]: config.trackColor || undefined', '--goal-text\' as any]: config.textColor || undefined']) {
    assert.ok(bar.includes(v), `the goal does not hand the look ${v.split("'")[0]}, or hands it when automatic`);
  }
  const panel = fs.readFileSync(new URL('../../web/components/GoalLayerPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes("onClear={() => patch({ trackColor: '' })}") && panel.includes("onClear={() => patch({ textColor: '' })}"),
    'nothing hands a chosen track or text colour back to the look');
});

test('a voice layer\'s talking colour can be left automatic, and the look reads a chosen one first', () => {
  const voice = (config) => normaliseLayouts([{ id: 'a', layers: [{ type: 'voice', config }] }])[0].layers[0].config;
  const old = voice({ glowColor: '#23A55A', textColor: '#ffffff' });
  assert.equal(old.glowColor, '', 'the old Discord green still covers the look\'s talking colour');
  assert.equal(old.textColor, '#ffffff', 'no look colours the names, so their colour stays as it was');
  assert.equal(old.settingsVersion, SETTINGS_VERSION);
  assert.equal(voice({ glowColor: '#ff8800' }).glowColor, '#ff8800', 'a colour somebody chose is theirs');
  assert.equal(voice({ ...old, glowColor: '#23a55a' }).glowColor, '#23a55a', 'a green picked since the change was turned back into automatic');
  for (const p of ALL_PRESETS.filter((x) => x.layerType === 'voice')) {
    const talking = (p.css.match(/\[data-voice-speaking="true"\] \[data-voice="avatar"\]\s*\{([^}]*)\}/) || [])[1] || '';
    if (/var\(--talk\)/.test(talking.replace(/var\(--voice-glow, var\(--talk\)\)/g, ''))) assert.fail(`${p.id} draws its talking colour without reading the chosen one`);
  }
  const layer = fs.readFileSync(new URL('../../web/components/VoiceLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(layer.includes("['--voice-glow' as any]: config.glowColor || undefined"));
});

const { currentLook, supersededLook } = await import('../../../shared/looks-history.js');
const { SUPERSEDED } = await import('../../../shared/looks-superseded.js');
const { isOwnCss } = await import('../../../shared/theme-apply.js');

test('a layer wearing an old copy of a look is brought up to date, and one somebody edited is not', () => {
  /*
    An applied look is a copy, so a change to the look reaches nothing already
    wearing it — and the old copy reads as hand-written. The Night title as it
    was before its controls could win: the same text with its !importants.
  */
  assert.equal(currentLook(''), '');
  // Every text in the table is a look that exists, and none is its current text.
  const ids = new Set(ALL_PRESETS.map((p) => p.id));
  for (const id of Object.values(SUPERSEDED)) assert.ok(ids.has(id), `${id} is in the table and not in the Library`);
  for (const p of ALL_PRESETS) assert.equal(supersededLook(p.css), null, `${p.id}'s current text is listed as out of date`);
});

test('every chat look reads the chat\'s chosen row, words and name weight before its own', () => {
  const looks = ALL_PRESETS.filter((p) => p.layerType === 'chat' && !/^motion-/.test(p.id) && /\[data-chat="row"\]/.test(p.css));
  assert.ok(looks.length >= 2, String(looks.length));
  const ruleOf = (css, part) => (css.match(new RegExp(`\\[data-chat="${part}"\\]\\s*\\{([^}]*)\\}`)) || [])[1] || '';
  const reads = (body, prop, v) => {
    const d = new RegExp(`(?<![\\w-])${prop}\\s*:([^;]*)`).exec(body);
    return !d || !/!important/.test(d[1]) || d[1].includes(`var(${v},`);
  };
  for (const p of looks) {
    const row = ruleOf(p.css, 'row');
    assert.ok(reads(row, 'background', '--chat-row-bg'), `${p.id} forces the row's background over the chosen one`);
    assert.ok(reads(row, 'border-radius', '--chat-row-radius'), `${p.id} forces the row's corners over the chosen ones`);
    assert.ok(reads(row, 'padding', '--chat-row-padding'), `${p.id} forces the row's padding over the chosen one`);
    assert.ok(reads(ruleOf(p.css, 'text'), 'color', '--chat-text'), `${p.id} forces the words' colour over the chosen one`);
    assert.ok(reads(ruleOf(p.css, 'user'), 'font-weight', '--chat-user-weight'), `${p.id} forces the name's weight over the chosen one`);
  }
  const row = fs.readFileSync(new URL('../../web/components/ChatMessageRow.tsx', SCRIPT_URL), 'utf8');
  for (const v of ["['--chat-row-padding' as any]: px(settings.rowPadding)", "['--chat-user-weight' as any]: val(settings.usernameWeight)"]) assert.ok(row.includes(v), v);
  // Every chat's settings — each chat layer's and the dock's — go through the one validator.
  const chatSrc = fs.readFileSync(new URL('../engine/chat-settings.js', SCRIPT_URL), 'utf8');
  assert.ok(chatSrc.includes("css: currentLook(incoming?.css === undefined ? (prev.css || '') : cleanCss(incoming.css, MAX_CHAT_CSS)),"), 'the chat keeps an old copy of its look');
});

test('a nameplate\'s colours can be left automatic, and its looks read the chosen ones first', () => {
  const plate = (config) => normaliseLayouts([{ id: 'a', layers: [{ type: 'nameplate', config }] }])[0].layers[0].config;
  const old = plate({ textColor: '#ffffff', backgroundColor: '#09090bD9', accentColor: '' });
  assert.deepEqual([old.textColor, old.backgroundColor, old.accentColor], ['', '', ''], 'an old default still covers the look');
  assert.equal(old.settingsVersion, SETTINGS_VERSION);
  assert.equal(plate({ textColor: '#fde047' }).textColor, '#fde047', 'a colour somebody chose is theirs');
  const ruleOf = (css, part) => (css.match(new RegExp(`\\[data-nameplate="${part}"\\]\\s*\\{([^}]*)\\}`)) || [])[1] || '';
  for (const p of ALL_PRESETS.filter((x) => x.layerType === 'nameplate' && /\[data-nameplate="plate"\]/.test(x.css) && !/^motion-/.test(x.id))) {
    const bg = /(?<![\w-])background\s*:([^;]*!important)/.exec(ruleOf(p.css, 'plate'));
    if (bg) assert.match(bg[1], /var\(--nameplate-background,/, `${p.id} paints the plate without reading the chosen background`);
    const name = /(?<![\w-])color\s*:([^;]*!important)/.exec(ruleOf(p.css, 'name'));
    if (name) assert.match(name[1], /var\(--nameplate-text,/, `${p.id} colours the name without reading the chosen colour`);
  }
  const src = fs.readFileSync(new URL('../../web/components/Nameplate.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes("['--nameplate-background' as any]: config.backgroundColor || undefined"));
});

test('a run card\'s chosen accent goes wherever its look puts its own', () => {
  const byId = (id) => ALL_PRESETS.find((p) => p.id === id).css;
  const RUNCARDS = ['simonsays-runcard', 'cyber-runcard'];
  for (const id of RUNCARDS) {
    assert.ok(byId(id).includes('var(--runcard-accent,'), `${id} ignores the chosen accent`);
  }
  // Outside :scope, the looks that draw with their own accent draw with nothing else.
  for (const [id, own] of [['simonsays-runcard', 'var(--color)'], ['cyber-runcard', 'var(--neon)']]) {
    const css = byId(id);
    const rules = css.slice(css.indexOf('}') + 1);
    assert.equal(rules.split(own).length - 1, rules.split(`var(--runcard-accent, ${own})`).length - 1, `${id} still uses ${own} without the chosen accent`);
  }
  const card = fs.readFileSync(new URL('../../web/components/RunCard.tsx', SCRIPT_URL), 'utf8');
  assert.ok(card.includes("['--runcard-accent' as any]: config.accentColor || undefined"));
});

test('the players list\'s and the poll\'s colours can be left automatic, and their looks read the chosen ones first', () => {
  const cfg = (type, config) => normaliseLayouts([{ id: 'a', layers: [{ type, config }] }])[0].layers[0].config;
  for (const type of ['players', 'poll']) {
    const old = cfg(type, { textColor: '#ffffff', background: '#09090bcc' });
    assert.deepEqual([old.textColor, old.background, old.settingsVersion], ['', '', SETTINGS_VERSION], `${type}: an old default still covers the look`);
    assert.equal(cfg(type, { background: '#1e3a8acc' }).background, '#1e3a8acc', `${type}: a background somebody chose is theirs`);
  }
  const css = (id) => ALL_PRESETS.find((p) => p.id === id).css;
  for (const v of ['--players-background', '--players-text']) assert.ok(css('cyber-players').includes(`var(${v},`), `cyber-players ignores ${v}`);
  for (const v of ['--poll-background', '--poll-text', '--poll-bar']) assert.ok(css('cyber-poll').includes(`var(${v},`), `cyber-poll ignores ${v}`);
  const poll = fs.readFileSync(new URL('../../web/components/PollLayer.tsx', SCRIPT_URL), 'utf8');
  assert.ok(poll.includes("['--poll-bar' as any]: config.barColor || undefined"));
});

test('a Library preview is as wide as its card, however wide the piece', () => {
  /*
    Without a width of its own, a box with an aspect ratio turns its minimum
    height into a minimum width: an omnibar held to 110px tall asked for
    2200px wide, and on a phone every bar and rule ran out of its card.
  */
  const lib = fs.readFileSync(new URL('../../web/components/views/LibraryView.tsx', SCRIPT_URL), 'utf8');
  const at = lib.indexOf("aspectRatio: `${size.width} / ${size.height}`, minHeight: 110");
  assert.ok(at > 0, 'the preview box lost its shape');
  const before = lib.slice(Math.max(0, at - 800), at);
  assert.ok(before.includes("width: '100%',") && before.includes('minWidth: 0,'), 'the preview box has no width of its own, so its minimum height makes it wider than its card');
});

test('no text piece overrules what the text panel sets', () => {
  /*
    The panel writes these on the element; a piece's !important on one would
    beat it, and the control would do nothing. Without it the piece still
    decides whatever the control was left at.
  */
  const CONTROLLED = ['color', 'font-family', 'text-transform', 'text-shadow'];
  const pieces = ALL_PRESETS.filter((p) => p.layerType === 'text');
  assert.ok(pieces.length >= 2, String(pieces.length));
  for (const p of pieces) {
    for (const [, prop] of p.css.matchAll(/(?<![\w-])([a-z-]+)\s*:[^;{}]*!important/g)) {
      assert.ok(!CONTROLLED.includes(prop), `"${p.id}" says ${prop} !important, over the text panel`);
    }
  }
});

test('the text itself keeps its spaces and its newlines', () => {
  /*
    Trimming here is what made the goal label impossible to type a space into.
    A text layer is worse: its content is prose, and three lines typed means
    three lines wanted.
  */
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'text', config: { text: 'line one\nline two ' } }] }]);
  assert.equal(l.layers[0].config.text, 'line one\nline two ');
});

test('a font the user uploaded survives being saved', () => {
  /*
    The offered list is what the app suggests, not what it allows. A closed
    list threw an uploaded font away on save, with nothing on screen to say
    why — which is the failure this rule exists to prevent.
  */
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'text', config: { fontFamily: 'Bebas Neue' } }] }]);
  assert.equal(l.layers[0].config.fontFamily, 'Bebas Neue');
});

test('but a font name carrying CSS is not a font name', () => {
  // It reaches a page inside a font-family declaration in inline style.
  for (const bad of ['x"; background: url(y); a: "', 'Inter; color: red', 'a{b}', "it's"]) {
    const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'text', config: { fontFamily: bad } }] }]);
    assert.equal(l.layers[0].config.fontFamily, '', JSON.stringify(bad));
  }
});

test('an uploaded font is declared where every surface can see it', () => {
  /*
    One generated stylesheet rather than wiring the list through each
    surface: the overlay, the dock, the alerts and the canvas all get it from
    one link, and a font uploaded later needs no client change.
  */
  const http = fs.readFileSync(new URL('../api/http.js', SCRIPT_URL), 'utf8');
  assert.ok(http.includes("'/media/fonts.css'"), 'nothing serves the uploaded fonts');
  assert.ok(http.includes('@font-face'), 'the stylesheet declares no faces');
  for (const ext of ['.woff2', '.woff', '.ttf', '.otf']) {
    assert.ok(http.includes(`'${ext}'`), `uploads still refuse ${ext}`);
    assert.ok(http.includes(`'${ext}': 'font/`), `${ext} is served without a font content type`);
  }
  const html = fs.readFileSync(new URL('../../web/index.html', SCRIPT_URL), 'utf8');
  assert.ok(html.includes('/media/fonts.css'), 'no page asks for the uploaded fonts');
});

test('the text field commits on blur rather than on every keystroke', () => {
  // Same trap as the goal label: the server tidies, so a per-keystroke field
  // would make a space impossible to type.
  const panel = fs.readFileSync(new URL('../../web/components/TextLayerPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/CommittedInput/.test(panel), 'the text box saves per keystroke again');
  const input = fs.readFileSync(new URL('../../web/components/CommittedInput.tsx', SCRIPT_URL), 'utf8');
  assert.ok(/as === 'input'/.test(input), 'Enter in a textarea commits instead of making a new line');
});

// --------------------------------------------- more than one of the same kind

const { MAX_LAYERS } = await import('../../engine/layouts.js');

test('a layout can hold several of the kinds a look is built from', () => {
  // One text layer and one box is not an overlay, it is a demonstration of one.
  const [l] = normaliseLayouts([{ id: 'a', layers: [
    { type: 'text', config: { text: 'one' } },
    { type: 'text', config: { text: 'two' } },
    { type: 'images' }, { type: 'images' },
  ] }]);
  assert.equal(l.layers.filter((x) => x.type === 'text').length, 2);
  assert.equal(l.layers.filter((x) => x.type === 'images').length, 2);
  assert.deepEqual(l.layers.filter((x) => x.type === 'text').map((x) => x.config.text), ['one', 'two']);
});

test('but only one of the kinds that would draw the same thing twice', () => {
  const [l] = normaliseLayouts([{ id: 'a', layers: [
    { type: 'chat' }, { type: 'chat' }, { type: 'countdown' }, { type: 'countdown' },
  ] }]);
  assert.equal(l.layers.length, 2, l.layers.map((x) => x.type).join(','));
});

test('every layer carries an id, and no two share one', () => {
  /*
    The id is what the editor drags, hides and deletes. Two layers sharing one
    would move together, which is the failure this exists to prevent.
  */
  const [l] = normaliseLayouts([{ id: 'a', layers: [
    { type: 'text', uid: 'same' }, { type: 'text', uid: 'same' }, { type: 'text' },
  ] }]);
  const ids = l.layers.map((x) => x.uid);
  assert.equal(new Set(ids).size, 3, ids.join(','));
  assert.ok(ids.every(Boolean), ids.join(','));
});

test('an id already given survives a round trip', () => {
  // Otherwise every reload reshuffles which layer the editor had selected.
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'text', uid: 'keepme' }] }]);
  assert.equal(l.layers[0].uid, 'keepme');
});

test('a layout cannot hold an unbounded number of layers', () => {
  /*
    The type list used to be the ceiling. Now that kinds repeat there has to be
    one on purpose: each layer is a live DOM subtree in a browser source, and
    four hundred of them costs frames on stream rather than failing visibly.
  */
  const [l] = normaliseLayouts([{ id: 'a', layers: Array.from({ length: 300 }, () => ({ type: 'text' })) }]);
  assert.equal(l.layers.length, MAX_LAYERS);
  assert.ok(MAX_LAYERS > 0 && MAX_LAYERS <= 100, String(MAX_LAYERS));
});

test('the editor addresses a layer by its id, not by its kind', () => {
  const src = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('const patchLayer = (uid: string'), 'patchLayer still takes a kind');
  assert.ok(src.includes('l.uid === uid'), 'the editor still matches layers by type');
  assert.ok(!src.includes('key={layer.type}'), 'the layer list is still keyed by type, so repeats collide');
});

test('the palette keeps offering the kinds that repeat', () => {
  // Hiding "Text" once one exists is how the old one-per-type rule survives
  // in the interface after being lifted on the server.
  const src = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('k.repeatable ||'), 'the palette hides a repeatable kind once one is placed');
  const server = fs.readFileSync(new URL('../engine/layouts.js', SCRIPT_URL), 'utf8');
  const listed = new RegExp('const REPEATABLE = ' + String.fromCharCode(92) + '[([^' + String.fromCharCode(92) + ']]*)').exec(server);
  assert.ok(listed, 'the server no longer says which kinds repeat');
  for (const name of listed[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean)) {
    assert.ok(new RegExp(`type: '${name}'[^\n]*repeatable: true`).test(src),
      `the editor does not offer repeats of ${name}, but the server allows them`);
  }
});

// --------------------------------------------------------- boxes and lines

test('a shape is a layer like any other', () => {
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'shape' }] }]);
  const c = l.layers[0].config;
  assert.equal(c.kind, 'rect');
  // Unset, so it follows the canvas accent rather than arriving pink.
  assert.equal(c.fill, '');
  assert.equal(c.borderWidth, 0, 'a shape arrives with an outline nobody asked for');
});

test('and is checked like everything else that reaches a stream', () => {
  /*
    A layer config becomes inline style on a page an overlay loads, so a fill
    that is not a colour has no business being one.
  */
  const [l] = normaliseLayouts([{
    id: 'a',
    layers: [{ type: 'shape', config: { kind: 'blob', fill: 'red; background: url(x)', radius: 9999, thickness: 0, angle: 999 } }],
  }]);
  const c = l.layers[0].config;
  assert.equal(c.kind, 'rect');
  assert.equal(c.fill, '');
  assert.ok(c.radius <= 200, String(c.radius));
  assert.ok(c.thickness >= 1, 'a line of no thickness is a line nobody can see');
  assert.ok(c.angle <= 360, String(c.angle));
});

test('a layout can hold as many shapes as a look needs', () => {
  // One box is not a panel, a frame or a pair of rules under a heading.
  const [l] = normaliseLayouts([{ id: 'a', layers: [
    { type: 'shape', config: { kind: 'rect' } },
    { type: 'shape', config: { kind: 'line' } },
    { type: 'shape', config: { kind: 'ellipse' } },
  ] }]);
  assert.equal(l.layers.length, 3);
  assert.deepEqual(l.layers.map((x) => x.config.kind), ['rect', 'line', 'ellipse']);
});

test('the shape panel does not offer what every layer already has', () => {
  /*
    Rotation, opacity, blend and shadow belong to the layer, not to the shape.
    Two controls for one number is how they come to disagree.
  */
  const src = fs.readFileSync(new URL('../../web/components/ShapeLayerPanel.tsx', SCRIPT_URL), 'utf8');
  // Named as a property being written, not merely mentioned: the file's own
  // comment explains why these are absent, and matching that is not a test.
  for (const dup of ['rotation:', 'opacity:', 'blendMode:', 'shadowBlur:']) {
    assert.ok(!src.includes(dup), `the shape panel sets ${dup} which belongs to the layer`);
  }
});

test('the canvas can draw every kind the server accepts', () => {
  // The two lists drifting apart is a layer that saves and then draws nothing.
  const src = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  for (const type of LAYER_TYPES) {
    assert.ok(src.includes(`case '${type}':`), `the canvas cannot draw a ${type} layer`);
  }
});

// ------------------------------------------- layers that wait for something

export const { LAYER_CONDITIONS, CONDITION_IDS, conditionMet } = await import('../../../shared/layer-conditions.js');

test('a layer can wait for something before it draws', () => {
  /*
    A layer that is always on screen has to be designed for its emptiest
    moment — the song card saying nothing between songs. This is the
    alternative, and it belongs to the layer rather than to any one type.
  */
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'spotify', showWhen: 'song' }] }]);
  assert.equal(l.layers[0].showWhen, 'song');
  assert.equal(l.layers[0].showWhenNot, false);
});

test('a condition nobody has heard of is not a condition', () => {
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'chat', showWhen: 'when i feel like it' }] }]);
  assert.equal(l.layers[0].showWhen, 'always');
});

test('every condition is one the canvas can actually test', () => {
  for (const c of LAYER_CONDITIONS) {
    assert.equal(typeof c.test, 'function', c.id);
    assert.equal(typeof c.label, 'string', c.id);
    assert.equal(typeof c.hint, 'string', c.id);
    // Asked about nothing at all, rather than throwing on a stream that has
    // only just started and has none of this yet.
    assert.equal(typeof c.test({}), 'boolean', c.id);
  }
});

test('the conditions read the state they say they read', () => {
  assert.equal(conditionMet('song', false, { spotifyTrack: { name: 'Bad Habit' } }), true);
  assert.equal(conditionMet('song', false, {}), false);
  assert.equal(conditionMet('countdown', false, { countdown: { mode: 'running' } }), true);
  assert.equal(conditionMet('countdown', false, { countdown: { mode: 'idle' } }), false);
  assert.equal(conditionMet('question', false, { questions: { showingId: 'q1' } }), true);
  assert.equal(conditionMet('question', false, { questions: { showingId: '' } }), false);
  assert.equal(conditionMet('alert', false, { currentAlert: { id: 'x' } }), true);
  assert.equal(conditionMet('plan', false, { plan: { currentId: 'p2', items: [{ id: 'p2' }] } }), true);
  // A plan pointing at an item that is gone is not somewhere it is up to.
  assert.equal(conditionMet('plan', false, { plan: { currentId: 'p9', items: [{ id: 'p2' }] } }), false);
});

test('a condition can be read the other way round', () => {
  // Half of what this is for: hide the chat box while an alert is playing.
  assert.equal(conditionMet('alert', true, { currentAlert: { id: 'x' } }), false);
  assert.equal(conditionMet('alert', true, {}), true);
});

test('an unknown condition draws the layer rather than hiding it', () => {
  /*
    A layout made by a newer version would otherwise go blank on an older one,
    with nothing on screen to say why.
  */
  assert.equal(conditionMet('invented-later', false, {}), true);
});

test('a layer waiting on a condition is faded in the editor, not gone', () => {
  // A layer that vanishes the moment its condition goes false is a layer
  // nobody can position, and the thing it waits for is usually not happening
  // while the layout is being built.
  const src = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('if (!met && !showGuides) return null;'), 'the canvas hides an unmet layer in the editor too');
  assert.ok(src.includes('layer.opacity * 0.25'), 'an unmet layer is drawn at full strength in the editor');
});

test('the editor offers exactly the conditions that exist', () => {
  const src = fs.readFileSync(new URL('../../web/components/LayerConditionPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('LAYER_CONDITIONS'), 'the condition panel keeps its own list');
  assert.ok(CONDITION_IDS.includes('always'), 'there is no way back to an unconditional layer');
});

// ------------------------------------------------------ fonts of one's own

const { fontFamilyName, safeFontName } = await import('../../../shared/chat-style.js');

test('a font file is known by a name somebody would recognise', () => {
  // Somebody who uploads Bebas_Neue.woff2 expects to see "Bebas Neue" offered.
  assert.equal(fontFamilyName('Bebas_Neue.woff2'), 'Bebas Neue');
  assert.equal(fontFamilyName('Inter.ttf'), 'Inter');
  assert.equal(fontFamilyName('my.brand.font.otf'), 'my brand font');
});

test('a filename that would write CSS instead of naming a font is refused', () => {
  /*
    The name is written into a generated @font-face and into inline style, so
    a quote or a brace in it would be a way to write CSS.
  */
  assert.equal(fontFamilyName('a";}body{display:none}.x{font-family:"b.woff2'), '');
  assert.equal(safeFontName('Inter; color: red'), '');
  assert.equal(safeFontName('url(x)'), '');
  assert.equal(safeFontName('Bebas Neue'), 'Bebas Neue');
});

test('the same rule names a font on both sides', () => {
  // Two rules would mean a font you can pick and a font that never loads.
  const http = fs.readFileSync(new URL('../api/http.js', SCRIPT_URL), 'utf8');
  assert.ok(http.includes("from '../../shared/chat-style.js'"), 'the server names fonts its own way again');
  const hook = fs.readFileSync(new URL('../../web/hooks/useCustomFonts.ts', SCRIPT_URL), 'utf8');
  assert.ok(hook.includes('fontFamilyName'), 'the editor names fonts its own way again');
});

const { ASSET_KINDS } = await import('../../../shared/asset-kinds.js');
test('a font is capped smaller than a video, and larger than nothing', () => {
  assert.ok(ASSET_KINDS.font, 'fonts are no longer an accepted upload');
  assert.equal(ASSET_KINDS.font.max, 2 * 1024 * 1024);
  assert.ok(ASSET_KINDS.font.max < ASSET_KINDS.video.max);
});

test('both font pickers offer what was uploaded', () => {
  // A list that only has what the app ships is a picker that cannot see the
  // font the user just added, which reads as the upload having failed.
  for (const f of ['ChatSettingParts.tsx', 'TextLayerPanel.tsx']) {
    const src = fs.readFileSync(new URL(`../../web/components/${f}`, SCRIPT_URL), 'utf8');
    assert.ok(src.includes('useCustomFonts'), `${f} offers only the built-in fonts`);
  }
});

// ------------------------------------------------ one look, set in one place

test('a canvas carries the two things a look is mostly made of', () => {
  const [l] = normaliseLayouts([{ id: 'a', fontFamily: 'Bebas Neue', accent: '#00ff88', layers: [] }]);
  assert.equal(l.fontFamily, 'Bebas Neue');
  assert.equal(l.accent, '#00ff88');
});

test('and checks them like everything else that reaches a stream', () => {
  const [l] = normaliseLayouts([{ id: 'a', fontFamily: 'x"; color: red', accent: 'red; url(x)', layers: [] }]);
  assert.equal(l.fontFamily, '');
  assert.equal(l.accent, '#f43f5e');
});

test('a colour nobody chose follows the canvas, one somebody chose does not', () => {
  /*
    The whole point of the accent. A layer given its own colour keeps it —
    otherwise setting a canvas accent would silently undo every deliberate
    choice already made in a layout.
  */
  const [l] = normaliseLayouts([{ id: 'a', layers: [
    { type: 'shape', uid: 'own', config: { fill: '#123456' } },
    { type: 'shape', uid: 'follows', config: {} },
  ] }]);
  assert.equal(l.layers.find((x) => x.uid === 'own').config.fill, '#123456');
  assert.equal(l.layers.find((x) => x.uid === 'follows').config.fill, '');
});

test('a layout can have no accent, and one saved before that could keeps its pink', () => {
  // Chosen: none is kept as none, so SimonSays Default draws white.
  assert.equal(normaliseLayout({ id: 'a', accent: '' }).accent, '');
  // Never chosen, because the layout predates the choice: the pink it always had.
  assert.equal(normaliseLayout({ id: 'a' }).accent, '#f43f5e');
  assert.equal(normaliseLayout({ id: 'a', accent: 'not a colour' }).accent, '#f43f5e');
  assert.equal(normaliseLayout({ id: 'a', accent: '#123456' }).accent, '#123456');
  // And the canvas sets nothing for none, so every look's own fallback is used.
  const stage = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(stage.includes("['--overlay-accent' as any]: layout.accent || undefined"));
  const view = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("patchLayout({ accent: '' })"), 'there is no way to clear a layout accent');
  assert.ok(/accent: '',\s*layers: \[\]/.test(view), 'a new layout does not start with no accent');
});

test('the canvas declares the accent where every layer can read it', () => {
  const src = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes("'--overlay-accent'"), 'the stage no longer declares the accent');
  assert.ok(src.includes('fontFamily: layout.fontFamily'), 'the canvas typeface is not applied');
  for (const file of ['GoalBar.tsx', 'Nameplate.tsx', 'PlanOverlay.tsx', 'QuestionOverlay.tsx', 'ShapeLayer.tsx']) {
    const layer = fs.readFileSync(new URL(`../../web/components/${file}`, SCRIPT_URL), 'utf8');
    assert.ok(layer.includes('var(--overlay-accent'), `${file} still hard-codes its accent`);
  }
});

test('a colour that has been set can be given back', () => {
  // A colour input cannot express "none", so without this the accent would
  // look broken on exactly the layers somebody had touched.
  const src = fs.readFileSync(new URL('../../web/components/AccentSwatch.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('onClear'), 'the swatch cannot return a layer to the canvas');
  for (const file of ['ShapeLayerPanel.tsx', 'GoalLayerPanel.tsx']) {
    const panel = fs.readFileSync(new URL(`../../web/components/${file}`, SCRIPT_URL), 'utf8');
    assert.ok(panel.includes('AccentSwatch'), `${file} has no way back to the canvas accent`);
  }
});

// ------------------------------------------------------------ layers that move

const { LAYER_ENTRANCES, LAYER_IDLES, layerAnimation } = await import('../../../shared/layer-motion.js');

test('a layer can be given an entrance and something to do while it is there', () => {
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'text', animateIn: 'pop', animateIdle: 'float', animateSpeed: 50 }] }]);
  const layer = l.layers[0];
  assert.deepEqual(
    { in: layer.animateIn, idle: layer.animateIdle, speed: layer.animateSpeed },
    { in: 'pop', idle: 'float', speed: 50 },
  );
});

test('an animation nobody has heard of is not an animation', () => {
  const [l] = normaliseLayouts([{ id: 'a', layers: [{ type: 'text', animateIn: 'backflip', animateIdle: 'explode', animateSpeed: 99999 }] }]);
  const layer = l.layers[0];
  assert.equal(layer.animateIn, 'none');
  assert.equal(layer.animateIdle, 'none');
  assert.ok(layer.animateSpeed <= 400, String(layer.animateSpeed));
});

test('a layer that does not move is given no animation at all', () => {
  /*
    Undefined rather than 'none': an animation property, even an inert one,
    promotes the element to its own compositing surface, and a canvas of a
    dozen still layers should cost a browser source nothing.
  */
  assert.equal(layerAnimation({}), undefined);
  assert.equal(layerAnimation({ animateIn: 'none', animateIdle: 'none' }), undefined);
});

test('an entrance runs once and an idle loops after it', () => {
  const both = layerAnimation({ animateIn: 'pop', animateIdle: 'float' });
  assert.ok(both.includes('layer-in-pop'), both);
  assert.ok(both.includes('infinite'), both);
  // The idle waits for the entrance instead of fighting it for the same frames.
  assert.ok(both.indexOf('layer-idle-float') > both.indexOf('layer-in-pop'), both);
});

test('speed is a percentage, and a bigger number is faster', () => {
  const slow = layerAnimation({ animateIdle: 'float', animateSpeed: 50 });
  const fast = layerAnimation({ animateIdle: 'float', animateSpeed: 200 });
  const secondsOf = (css) => Number(/([0-9.]+)s/.exec(css)[1]);
  assert.ok(secondsOf(slow) > secondsOf(fast), `${slow} vs ${fast}`);
});

test('every animation offered has keyframes that will reach the build', () => {
  /*
    Tailwind emits a @keyframes block only for utilities it finds in the source
    it scans. These are referenced from inline style, so named through the
    theme they would be purged and the layer would simply not move on stream.
  */
  const css = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  for (const a of [...LAYER_ENTRANCES, ...LAYER_IDLES]) {
    if (!a.css) continue;
    assert.ok(css.includes(`@keyframes ${a.css} {`), `${a.id} is offered but has no keyframes`);
  }
});

test('motion is applied inside the placement, not on it', () => {
  // The wrapper carries the layer's rotate and flip; an animation on the same
  // element would replace them for every frame it runs.
  const src = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  const at = src.indexOf('...layerAppearance(layer)');
  const motion = src.indexOf('style={motion ?');
  assert.ok(at > 0 && motion > at, 'the animation is set on the element that carries the transform');
});

test('a viewer who asked for less motion gets less motion', () => {
  const css = fs.readFileSync(new URL('../../web/styles.css', SCRIPT_URL), 'utf8');
  assert.ok(css.includes('prefers-reduced-motion'), 'layers animate regardless of the setting');
  assert.ok(css.includes('[data-layer-animation]'), 'the reduced-motion rule matches nothing');
});

test('duplicating a layer gives the copy its own identity and somewhere to be', () => {
  /*
    Two layers in the same place look like one layer, so the copy would be
    dragged before it could be seen — and two sharing an id would move
    together, which is the bug ids exist to prevent.
  */
  const src = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  const fn = src.slice(src.indexOf('const duplicateLayer'), src.indexOf('const removeLayer'));
  assert.ok(fn.includes('uid:'), 'the copy keeps the original id');
  assert.ok(fn.includes('x: w.layers[at].x + 24'), 'the copy lands exactly on top of the original');
  assert.ok(fn.includes('JSON.parse(JSON.stringify'), 'the copy shares the original config object');
});

// ----------------------------------------------------- the escape hatch

test('a layout can carry a stylesheet of its own', () => {
  const [l] = normaliseLayouts([{ id: 'a', css: '.canvas-stage { filter: sepia(1); }', layers: [] }]);
  assert.equal(l.css, '.canvas-stage { filter: sepia(1); }');
});

test('and it is not parsed, because that is what an escape hatch is', () => {
  /*
    A validator that understood CSS would be one that refused whatever it had
    not been taught, which is the opposite of the point. The overlay is the
    same person's own page.
  */
  const odd = '@supports (mask: url(x)) { [data-layer-type="chat"] { mask: url(#m); } }';
  const [l] = normaliseLayouts([{ id: 'a', css: odd, layers: [] }]);
  assert.equal(l.css, odd);
});

test('but it cannot stop being a stylesheet', () => {
  // It reaches the page inside a <style>, and that sequence would end the
  // element early and let the rest be parsed as markup.
  const [l] = normaliseLayouts([{ id: 'a', css: `.x{} ${'<' + '/StYlE'}><img src=x onerror=1>`, layers: [] }]);
  assert.ok(!l.css.toLowerCase().includes('</style'), l.css);
});

test('a stylesheet is capped, like everything else in the config', () => {
  // Every client receives the config in full on connect.
  const [l] = normaliseLayouts([{ id: 'a', css: 'a'.repeat(99999), layers: [] }]);
  assert.ok(l.css.length <= 4000, String(l.css.length));
});

test('a layer can be named from a stylesheet without guessing at markup', () => {
  /*
    Hooks that this app promises, so a stylesheet does not break on an update
    for a reason nobody can see.
  */
  const src = fs.readFileSync(new URL('../../web/components/CanvasStage.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('data-layer-type={layer.type}'), 'layers cannot be named by kind');
  assert.ok(src.includes('data-layer-id={layer.uid}'), 'a single layer cannot be named');
  assert.ok(src.includes('canvas-stage'), 'the canvas itself cannot be named');
});

test('the editor names the canvas the way a scoped stylesheet actually can', () => {
  /*
    Measured in a browser, not assumed: inside @scope the root is named by
    :scope, and a bare .canvas-stage matches the canvas's descendants but
    not the canvas itself. Offering the obvious-looking class selector would
    be offering one that quietly does nothing.
  */
  const panel = fs.readFileSync(new URL('../../web/components/LayoutCssPanel.tsx', SCRIPT_URL), 'utf8');
  const list = panel.slice(panel.indexOf('<ul'), panel.indexOf('</ul>'));
  assert.ok(list.includes(':scope'), 'the editor does not say how to name the canvas');
  assert.ok(!list.includes('.canvas-stage'), 'the editor offers a selector that matches nothing');
  assert.ok(list.includes('data-layer-type'), 'the editor does not say how to name a kind of layer');
});

test('the editor says which properties a stylesheet cannot simply override', () => {
  /*
    A layer's placement is written as inline style, and inline style beats a
    stylesheet. Measured in a browser: an opacity rule on a layer is ignored
    without !important, while outline-offset on the same selector applies.
    Unsaid, that is a question with no visible answer.
  */
  const panel = fs.readFileSync(new URL('../../web/components/LayoutCssPanel.tsx', SCRIPT_URL), 'utf8');
  assert.ok(panel.includes('!important'), 'nothing warns that a layer outranks the stylesheet');
});

test('a stylesheet cannot reach the editor around the canvas', () => {
  /*
    The editor draws the same canvas inside the rest of the app, so a rule as
    ordinary as div { opacity: 0.5 } would otherwise reach the sidebar, the
    layer list, and the control needed to undo it.
  */
  const src = fs.readFileSync(new URL('../../web/components/LayoutStyle.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('@scope (.canvas-stage)'), 'the stylesheet is applied unscoped');
  assert.ok(src.includes('if (!canScopeStyles && inEditor) return null;'),
    'a browser without @scope would apply it to the whole editor');
});


// ------------------------------------------------- dragging a layer's row

const { dropLayer } = await import('../../../shared/layer-order.js');
// Back first, as a layout keeps them; the list shows d, c, b, a.
const STACK = ['a', 'b', 'c', 'd'].map((uid) => ({ uid }));
const order = (layers) => layers.map((l) => l.uid).join('');

test('a row dragged to the bottom of the list sends the layer to the very back, and to the top the very front', () => {
  assert.equal(order(dropLayer(STACK, 'd', 4)), 'dabc', 'the newest layer did not go behind everything');
  assert.equal(order(dropLayer(STACK, 'a', 0)), 'bcda', 'the back layer did not come to the front');
});

test('a row dropped between two others lands between those two, from either direction', () => {
  // Shown d c b a: d dropped in the gap between b and a (gap 3) is shown c b d a.
  assert.equal(order(dropLayer(STACK, 'd', 3)), 'adbc');
  // a dropped between d and c (gap 1) is shown d a c b.
  assert.equal(order(dropLayer(STACK, 'a', 1)), 'bcad');
});

test('dropping a row where it already was, or a layer that is not there, changes nothing', () => {
  // c is shown second: the gaps above and below it are 1 and 2.
  assert.equal(dropLayer(STACK, 'c', 1), STACK);
  assert.equal(dropLayer(STACK, 'c', 2), STACK);
  assert.equal(dropLayer(STACK, 'zz', 0), STACK);
  assert.equal(order(dropLayer(STACK, 'b', 99)), 'bacd', 'a gap past the end is not the very back');
  assert.equal(order(STACK), 'abcd', 'the layers given were changed in place');
});

test('every layer row has a grip, and a drop saves through the same commit as the arrows', () => {
  const src = fs.readFileSync(new URL('../../web/components/views/LayoutsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(src.includes("import { dropLayer } from '../../../shared/layer-order.js';"), 'the list works out drops on its own');
  // One row for every layer, in the list itself and in a group's folder: only the list it belongs to differs.
  assert.ok(src.includes('<DragGrip grip={order.grip(layer.uid)}'), 'the rows have no grip');
  assert.ok(src.includes('{...order.row(layer.uid)}'), 'the gaps cannot be measured without the rows marked');
  assert.ok(src.includes('layerRow(unit.layer as CanvasLayer, layerOrder)'), 'a layer on its own is not a row of the list');
  const drop = src.slice(src.indexOf('const layerOrder = useDragOrder('), src.indexOf('const layerOrder = useDragOrder(') + 400);
  assert.ok(drop.includes('const layers = dropLayer(w.layers, id, gap);'), 'a drop works out the order some other way');
  assert.ok(drop.includes('if (layers === w.layers) return;'), 'a drop that changes nothing is saved anyway');
  assert.ok(drop.includes('applyWorking(next);') && drop.includes('commit(next);'), 'a drop is not saved the way the arrows save');
});

const { looksNow } = await import('../../../shared/looks-history.js');
const { ALL_PRESETS: PRESETS_NOW } = await import('../../../shared/css-presets.js');

test('a saved profile\'s old copies of a look come up to date like the live ones, and nothing else about them changes', () => {
  /*
    The live layers are brought up to date by the validation that saves them;
    the saved copy of the profile that is on was not, and read as an unsaved
    change nobody made. The security monitor before its camera number became a
    field is a real old copy.
  */
  const src = fs.readFileSync(new URL('../engine/index.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes("profiles.rewriteSaved('overlays', 'layouts',\n    (layouts) => (Array.isArray(layouts) ? layouts.map((l) => (Array.isArray(l?.layers) ? { ...l, layers: l.layers.map(looksNow) } : l)) : layouts))"), 'the saved overlay profiles are not brought up to date at startup');
  assert.ok(src.includes("profiles.rewriteSaved('alerts', 'alerts', (list) => (Array.isArray(list) ? list.map(looksNow) : list))"), 'the saved alert profiles are not brought up to date at startup');
});
