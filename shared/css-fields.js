/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The knobs a stylesheet already has, found by reading it.
 *
 * Every look worth keeping ends up with a handful of numbers and colours at
 * the top of it — the width of a cell, how long a strike takes, which pink.
 * They are the things anybody actually wants to change, and changing one
 * meant opening a box of CSS and editing text in the middle of it.
 *
 * So they are read out instead. A stylesheet that declares
 *
 *   --cell: 28px;
 *
 * has a field called cell, of a kind you can put a slider on, with a default.
 * Nothing has to be declared twice and nothing has to be annotated: every
 * preset already shipped grows a panel the day this arrives.
 *
 * Nothing here changes the stylesheet. Reading is reading, and what a control
 * sets is kept beside the text as data — so the preset stays as it was typed,
 * putting a value back is forgetting a key, and the values can be checked on
 * the way in, which raw CSS never can be.
 */

/** Units a field can carry. A value is only ever set back in its own one. */
const UNITS = ['px', 'em', 'rem', '%', 's', 'ms', 'deg', 'vw', 'vh', 'ch', 'fr', 'cqw', 'cqh'];

const COLOUR = /^#[0-9a-fA-F]{3,8}$/;
const NUMBER = /^-?\d*\.?\d+$/;

/**
 * Properties the app feeds in rather than the stylesheet owning.
 *
 * The canvas accent, and the values each surface publishes about what it is
 * drawing. They are read by presets constantly, so without this every panel
 * would open with a colour picker for the accent sitting above the one that
 * already sets it.
 *
 * And each layer's own: a colour chosen in its panel, set on it as
 * --goal-bar, --countdown-text and the like for a look to read before its
 * own, and what it reports about itself (--goal-pct). A look reading one
 * with a plain colour behind it is not offering a knob.
 */
const APP_OWNED = [
  '--overlay-', '--chat-', '--spotify-', '--scoped-css',
  '--alert-', '--countdown-', '--goal-', '--nameplate-', '--omnibar-', '--players-',
  '--poll-', '--question-', '--runcard-', '--stopwatch-', '--viewers-', '--voice-',
];
const appOwns = (name) => APP_OWNED.some((prefix) => name.startsWith(prefix));

/**
 * Comments out, so a brace or a semicolon inside one cannot be read as CSS.
 *
 * The label annotation is pulled out first, because it lives in a comment and
 * would go with them.
 */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * What a value is, and what it can be set to.
 *
 * The unit is remembered rather than re-derived when a value is set back: a
 * slider that wrote 2 where the sheet said 2px would break every calc() that
 * reads it, silently, because a length without a unit is not a length.
 */
export function readValue(raw) {
  const value = String(raw ?? '').trim();
  /*
    A default held behind a var() is still a default. The couch keeps its seat
    colour as var(--overlay-accent, #2ec4b6) — a real knob whose value happens
    to be written as a fallback, and which reads as text without this.
  */
  const behind = /^var\(\s*--[A-Za-z0-9_-]+\s*,([^()]*)\)$/.exec(value);
  if (behind) {
    const inner = readValue(behind[1]);
    if (inner.kind !== 'text') return { ...inner, viaVar: true };
  }
  if (COLOUR.test(value)) return { kind: 'colour', value, unit: '' };
  if (NUMBER.test(value)) return { kind: 'number', value, unit: '' };
  for (const unit of UNITS) {
    if (value.endsWith(unit) && NUMBER.test(value.slice(0, -unit.length))) {
      return { kind: 'number', value, unit };
    }
  }
  return { kind: 'text', value, unit: '' };
}

/**
 * A range to put a slider on, when nobody said one.
 *
 * Generous on purpose: a guess that will not reach the value somebody wants
 * is worse than one that goes further than they need, because the first is a
 * control that cannot do its job and the second is only a long slider.
 */
const guessRange = (number, unit) => {
  const n = Math.abs(Number(number)) || 1;
  if (unit === '%') return [0, 100];
  if (unit === 's') return [0, Math.max(10, Math.ceil(n * 3))];
  if (unit === 'ms') return [0, Math.max(2000, Math.ceil(n * 3))];
  if (unit === 'deg') return [-360, 360];
  return [0, Math.max(10, Math.ceil(n * 3))];
};

/** cell-width -> Cell width, for a stylesheet that named nothing. */
const prettify = (name) => {
  const words = name.replace(/^--/, '').replace(/[-_]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : name;
};

/**
 * The fields a stylesheet has.
 *
 * Two things count. A property it declares — the usual case, and the one that
 * carries a default. And a property it only ever reads, with the default in
 * the fallback: `var(--strike, 7s)`. The second is easy to forget and is
 * exactly where the interesting numbers hide, because a value used once tends
 * to be written where it is used.
 *
 * The frames of an animation never arrive as fields, and not because of the
 * at-rule check below — that is for tidiness. Inside @keyframes the text
 * before a colon is "0% { --step", which is not a property name, so a frame
 * cannot be read as a declaration however the block is reached. Worth knowing
 * before anyone simplifies the name check into something looser.
 *
 * A knob inside @media is not found either: the scan steps over a block whole
 * and never descends. Knobs live at the top of a rule by convention, and one
 * buried in a query is a look that has more to say than a slider can.
 */
export function readFields(css, motionCss) {
  const text = stripComments([css || '', motionCss || ''].join('\n'));
  const labels = readLabels([css || '', motionCss || ''].join('\n'));

  const found = new Map();
  let at = 0;
  let selector = '';

  while (at < text.length) {
    const open = text.indexOf('{', at);
    if (open < 0) break;
    selector = text.slice(at, open).split('}').pop().trim().replace(/\s+/g, ' ');

    /* Find this block's end, counting the ones nested inside it. */
    let depth = 1;
    let i = open + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
      i += 1;
    }
    const body = text.slice(open + 1, i - 1);

    if (!selector.startsWith('@')) {
      for (const line of body.split(';')) {
        const colon = line.indexOf(':');
        if (colon < 0) continue;
        const name = line.slice(0, colon).trim();
        if (!name.startsWith('--')) continue;
        /* A nested block's declarations are its own; this one only owns its. */
        if (line.includes('{')) continue;
        if (found.has(name)) continue;
        const read = readValue(line.slice(colon + 1).trim());
        found.set(name, { name, selector, declared: true, ...read });
      }
    }
    at = i;
  }

  /*
    And the ones only ever read. Set on the scope rather than where they are
    read: nothing declares them, so inheritance reaches the place that does,
    and the scope is one selector instead of however many read it.
  */
  const uses = stripComments([css || '', motionCss || ''].join('\n'));
  const re = /var\(\s*(--[A-Za-z0-9_-]+)\s*,([^()]*)\)/g;
  let m = re.exec(uses);
  while (m) {
    const name = m[1];
    if (!found.has(name)) {
      const read = readValue(m[2].trim());
      if (read.kind !== 'text') {
        found.set(name, { name, selector: ':scope', declared: false, ...read });
      }
    }
    m = re.exec(uses);
  }

  /*
    Colours and numbers only. Everything else a property can hold is either
    plumbing — a gradient, a calc, a whole animation — or something no control
    could sensibly edit, and a panel of those is worse than no panel.
  */
  return [...found.values()].filter((f) => f.kind !== 'text' && !appOwns(f.name)).map((field) => {
    const said = labels.get(field.name) || {};
    const [min, max] = field.kind === 'number'
      ? (said.min !== undefined ? [said.min, said.max] : guessRange(parseFloat(field.value), field.unit))
      : [0, 0];
    return { ...field, label: said.label || prettify(field.name), min, max };
  });
}

/**
 * What a stylesheet calls its own knobs, where it bothers to say.
 *
 * A comment after the declaration, so it reads as a note rather than as
 * markup: `--cell: 28px; /* Cell width | 10-60 *\/`. Nothing has to have one.
 */
function readLabels(text) {
  const out = new Map();
  /*
    On the same line as the declaration, not merely somewhere after it.
    Crossing a newline made a comment introducing the next part of a sheet
    into the label of the line above it.
  */
  const re = /(--[A-Za-z0-9_-]+)\s*:[^;{}]*;[^\S\r\n]*\/\*([^*]*)\*\//g;
  let m = re.exec(text);
  while (m) {
    const parts = m[2].split('|');
    const label = parts[0].trim();
    const range = (parts[1] || '').trim().split('-').map((n) => parseFloat(n));
    out.set(m[1], range.length === 2 && range.every(Number.isFinite)
      ? { label, min: range[0], max: range[1] }
      : { label });
    m = re.exec(text);
  }
  return out;
}

/**
 * One value, held to what its field can be.
 *
 * Run on the way in as well as on the way out, because this is the first
 * thing beside a stylesheet that the server can actually check — the CSS
 * itself it can only cap and pass on.
 */
export function cleanValue(raw, field) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (field.kind === 'colour') return COLOUR.test(value) ? value : '';
  if (field.kind === 'number') {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return '';
    /* Back in its own unit, whatever arrived: a length without one is not one. */
    return String(n) + field.unit;
  }
  return value.slice(0, 120);
}

/** Only the values this stylesheet has a field for, and only what they can be. */
export function cleanVars(incoming, fields) {
  const out = {};
  if (!incoming || typeof incoming !== 'object') return out;
  for (const field of fields) {
    const clean = cleanValue(incoming[field.name], field);
    /*
      Nothing is stored for a value left at the default — unless the default
      is only a fallback. A colour written var(--overlay-accent, #ffffff) is
      white only when the layout has no accent, so white picked on purpose is
      a real choice and has to be kept, or it would quietly follow the accent.
    */
    if (clean && (field.viaVar || clean !== field.value)) out[field.name] = clean;
  }
  return out;
}

/**
 * The rule that sets them, to go after the stylesheet it came from.
 *
 * After, and on the same selector, so it is the later of two declarations of
 * equal weight and wins on order alone. Not !important: a sheet that really
 * means a value should still be able to say so, and a control that could not
 * be overruled would be a control nobody could get out from under.
 */
export function varsRule(fields, vars) {
  if (!vars || typeof vars !== 'object') return '';
  const bySelector = new Map();
  for (const field of fields) {
    const value = vars[field.name];
    if (!value || (!field.viaVar && value === field.value)) continue;
    const list = bySelector.get(field.selector) || [];
    list.push(`  ${field.name}: ${value};`);
    bySelector.set(field.selector, list);
  }
  return [...bySelector.entries()]
    .map(([selector, lines]) => `${selector} {\n${lines.join('\n')}\n}`)
    .join('\n\n');
}
