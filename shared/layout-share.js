/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Layouts as a file, to give to somebody else: one layout or a whole
 * overlay profile's, and back again.
 *
 * What a layout is made of travels — its layers, where each sits, its
 * styling, its vertical side, its groups. What only makes sense on the setup
 * it was made on is left out by default, the way the layout templates leave
 * it out (server/engine/layout-templates.js): the OBS sources picked, the
 * timers, the OBS scenes it is bound to and its scene type, which avatar it
 * draws (a named avatar, a pixel avatar, an outfit), which other omnibar it
 * shows, and pictures uploaded to the app, which the file does not carry.
 * Pictures from a web address stay. Text stays as it was written.
 *
 * Read back, a file's layouts get ids of their own, so bringing one in never
 * replaces a layout that is there; the server then cleans them as it does
 * any saved layout (server/engine/layouts.js).
 */

export const SHARE_KIND = 'simonsays-layouts';
export const SHARE_VERSION = 1;

const copy = (v) => JSON.parse(JSON.stringify(v));
const uploaded = (src) => typeof src === 'string' && !/^https?:\/\//i.test(src.trim());
const newId = () => Math.random().toString(36).slice(2, 11);

/**
 * A layout without what is only the sharer's. Also says how many uploaded
 * pictures it left behind, so the screen can say so.
 */
export function withoutMine(layout) {
  const { scenes: _s, sceneType: _t, ...rest } = copy(layout);
  let pictures = 0;
  const layers = (rest.layers || []).map((layer) => {
    const c = { ...(layer.config || {}) };
    if (layer.type === 'avatar') { delete c.source; delete c.costume; c.character = ''; }
    if (layer.type === 'source') c.source = '';
    if (layer.type === 'countdown') c.timer = '';
    if (layer.type === 'omnibar') delete c.bar;
    if (layer.type === 'images' && Array.isArray(c.sources)) {
      const kept = c.sources.filter((src) => !uploaded(src));
      pictures += c.sources.length - kept.length;
      c.sources = kept;
    }
    return { ...layer, config: c };
  });
  return { layout: { ...rest, layers }, pictures };
}

/** The file: what it is, the app's version that made it, and the layouts, each without what is the sharer's unless asked. */
export function shareFile(layouts, { leaveMine = true, app = '' } = {}) {
  let pictures = 0;
  const out = (layouts || []).map((l) => {
    if (!leaveMine) return copy(l);
    const done = withoutMine(l);
    pictures += done.pictures;
    return done.layout;
  });
  return { file: { kind: SHARE_KIND, version: SHARE_VERSION, app: String(app || ''), layouts: out }, pictures };
}

/** A name for the file: the layout's, or the profile's, made safe for a file system. */
export const shareFileName = (name) => `${String(name || 'layouts').replace(/[^\w\- ]+/g, '').trim().replace(/[\s-]+/g, '-').slice(0, 60) || 'layouts'}.simonsays-layouts.json`;

/**
 * A file's layouts, ready to add: ids of their own. Throws with a code the
 * screen can say when the text is not a layouts file.
 */
export function readShareFile(text) {
  let json;
  try { json = JSON.parse(String(text || '')); } catch { json = null; }
  if (!json || json.kind !== SHARE_KIND || !Array.isArray(json.layouts) || !json.layouts.length) {
    const err = new Error('that file is not a SimonSays layouts file');
    err.code = 'layout_share_not_a_file';
    throw err;
  }
  return json.layouts
    .filter((l) => l && typeof l === 'object' && Array.isArray(l.layers))
    .map((l) => ({ ...copy(l), id: newId(), name: String(l.name || 'Overlay').slice(0, 60) }));
}
