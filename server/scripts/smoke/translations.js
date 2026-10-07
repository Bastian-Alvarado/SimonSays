/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: both languages, everywhere.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import path from 'node:path';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const { ALL_PRESETS, CSS_LOOKS } = await import('../../../shared/css-presets.js');
const { LOOKS_ES, THEMES_ES, lookWords, themeWords } = await import('../../../shared/looks-es.js');
const { LAYER_TYPES } = await import('../../engine/layouts.js');

const web = new URL('../../web/', SCRIPT_URL);
const constants = fs.readFileSync(new URL('constants.ts', web), 'utf8');
const esAt = constants.indexOf('\n  es: {');
const keysIn = (block) => new Map([...block.matchAll(/^\s{4}([A-Za-z0-9_]+)\s*:\s*(['"])((?:\\.|(?!\2).)*)\2/gm)].map((m) => [m[1], m[3]]));
const EN = keysIn(constants.slice(constants.indexOf('\n  en: {'), esAt));
const ES = keysIn(constants.slice(esAt));

const sources = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory() && !['dist', 'node_modules'].includes(f.name)) walk(p);
    else if (/\.(tsx|ts)$/.test(f.name) && f.name !== 'constants.ts') sources.push(p);
  }
};
walk(decodeURIComponent(web.pathname).replace(/^\/(\w:)/, '$1'));

test('every string the dashboard reaches for with an English fallback exists in both languages', () => {
  /*
    `t.key || 'English'` renders the English wherever the key is missing, so
    a missing Spanish string is not an error anywhere — it is a screen that
    silently speaks English. 186 of them had built up, the Library's among
    them, before they were written down.
  */
  const missing = [];
  const re = /\bt\??\.([A-Za-z0-9_]+)\s*\|\|\s*['"`]/g;
  for (const f of sources) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(re)) {
      if (!EN.has(m[1]) || !ES.has(m[1])) missing.push(`${m[1]} (${path.basename(f)})`);
    }
  }
  assert.ok(sources.length > 50, `only ${sources.length} source files found`);
  assert.deepEqual([...new Set(missing)], [], 'these have only their English fallback');
  assert.equal(EN.size, ES.size, 'the two languages hold different numbers of strings');
});

test('every look and every theme in the Library has its name and description in Spanish', () => {
  const ids = new Set(ALL_PRESETS.map((p) => p.id));
  const without = ALL_PRESETS.filter((p) => !LOOKS_ES[p.id]?.name || !LOOKS_ES[p.id]?.hint).map((p) => p.id);
  assert.deepEqual(without, [], 'these looks would show their English in a Spanish Library');
  assert.deepEqual(Object.keys(LOOKS_ES).filter((id) => !ids.has(id)), [], 'Spanish for looks that do not exist: a misspelt id');
  assert.deepEqual(CSS_LOOKS.filter((t) => !THEMES_ES[t.id]).map((t) => t.id), [], 'themes without Spanish');
  // And the Library reads them in the dashboard's language.
  const look = ALL_PRESETS.find((p) => p.id === 'cyber-hazard');
  assert.equal(lookWords(look, 'es').name, 'Rayado de peligro');
  assert.equal(lookWords(look, 'en').name, look.name);
  assert.equal(themeWords(CSS_LOOKS.find((t) => t.id === 'simonsays'), 'es').name, 'SimonSays predeterminado');
  const lib = fs.readFileSync(new URL('components/views/LibraryView.tsx', web), 'utf8');
  for (const use of ['{lookWords(object, t.lang).name}', '{lookWords(object, t.lang).hint}', '{themeWords(look, t.lang).name}', '{themeWords(look, t.lang).hint}']) {
    assert.ok(lib.includes(use), `the Library prints a look or theme without its translation: ${use}`);
  }
  assert.ok(!/\{(object|look)\.(name|hint)\}/.test(lib), 'the Library prints a name or description straight from the English');
});

test('every kind of layer has its name and what it is for in both languages', () => {
  for (const type of LAYER_TYPES) {
    for (const key of [`layerKind_${type}`, `layerKindHint_${type}`]) {
      assert.ok(EN.has(key) && ES.has(key), `${key} is missing from a language`);
    }
  }
  assert.ok(EN.has('libraryKind_alert') && ES.has('libraryKind_alert'));
  const editor = fs.readFileSync(new URL('components/views/LayoutsView.tsx', web), 'utf8');
  assert.ok(!/\{k\.label\}|\{kind\?\.label|\{kind\?\.hint\}|title=\{k\.hint\}/.test(editor), 'the Overlays editor names a kind of layer in English only');
});

test('the Spanish strings keep their accents', () => {
  /*
    Some were once typed on a keyboard without them — "diseno", "Anade",
    "Tamano" — which reads as broken to anybody who speaks it. Only words that
    are wrong without the accent in every use are checked here, so a right
    word can never be flagged.
  */
  const NEVER = /\b(diseno|disenos|anade|anadir|anadida|tamano|basicos|aparecera|reporto|ajustala|reune|pagina|musica|cancion|titulo|categoria|numero|ultimo|ultima|tambien|accion|opcion|configuracion|conexion|informacion|sesion|boton|automatico|automatica|aqui|rotacion|telefono|camara|imagenes|codigo|vacio|vacia|todavia|envia|despues|segun|unica|unico)\b/i;
  const bad = [...ES].filter(([, v]) => NEVER.test(v)).map(([k, v]) => `${k}: ${v.slice(0, 60)}`);
  assert.deepEqual(bad, [], 'Spanish written without its accents');
});
