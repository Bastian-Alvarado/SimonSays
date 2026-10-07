/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord pages: a channel's standing posts — a welcome, the rules, the
 * links — built from blocks on the Discord pages screen and posted by the
 * bot, which keeps their message ids so a page can be changed later in place.
 * What a page holds and the messages each way of posting makes are in
 * shared/discord-pages.js; this sends them.
 *
 * Changing a page that is up:
 *
 *   - one message (the newer layout): the message is edited whole, so
 *     anything may change.
 *   - classic: each message whose block changed is edited. A page whose
 *     blocks were added, taken away or moved is posted again and the old
 *     messages removed, since Discord keeps messages in the order they were
 *     sent. So is one whose messages were deleted by hand in Discord.
 *
 * A test goes to the test channel set on the Welcome & Goodbye screen and
 * replaces the page's previous test there, so trying a page over and over
 * leaves one copy behind rather than many.
 *
 * A page can start from what a channel already has: its messages read back
 * into blocks, pictures saved as uploads (Discord's own links to them
 * expire). The messages read stay where they are until "delete the
 * originals" is pressed — a page made by MEE6 through a webhook can be
 * deleted by the bot but never edited, by it or anybody.
 */

import fs from 'node:fs';
import path from 'node:path';
import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import { config } from '../config.js';
import * as discord from '../platforms/discord.js';
import { getGreetings } from './welcome.js';
import {
  cleanPage, cleanBlock, classicMessages, singleMessage, picturesToSend, pageProblems, blockSignature, fillPage, bannerDrawn,
  PAGE_LIMITS, COMPONENTS_V2,
} from '../../shared/discord-pages.js';
import { drawBanner, keepDrawings, initBannerText } from './banner-text.js';
import * as engine from './index.js';
import * as tags from './tags.js';
import * as sessions from './stream-sessions.js';
import * as twitchExtras from './twitch-extras.js';
import * as twitch from '../platforms/twitch.js';
import * as spotify from '../platforms/spotify.js';
import * as discordVoice from '../platforms/discord-voice.js';

const log = createLogger('discord-pages');

/** How many pages there may be. */
export const MAX_PAGES = 30;
/** How many of a channel's newest messages a page can be read from. */
const IMPORT_LIMIT = 50;

let store = null;

const pages = () => store?.get().pages || [];
const find = (id) => pages().find((p) => p.id === id);
const save = (list) => {
  store.set({ pages: list });
  publish();
};
const putPage = (page) => save(pages().some((p) => p.id === page.id) ? pages().map((p) => (p.id === page.id ? page : p)) : [...pages(), page]);

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'discordPages', value: pages() });
}

export const snapshot = () => ({ discordPages: pages() });

// ------------------------------------------------------------------ pictures

const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const extOfType = (type) => Object.keys(TYPES).find((k) => TYPES[k] === type && k !== 'jpeg') || '';

/** A picture's bytes, from the upload library or a link, with what kind it is. */
export async function loadPicture(src) {
  let data;
  let ext;
  if (src.startsWith('/media/')) {
    const file = path.join(config.assetsDir, path.basename(decodeURIComponent(src)));
    ext = path.extname(file).slice(1).toLowerCase();
    if (!TYPES[ext] || !fs.existsSync(file)) throw refusal('page_picture', `the picture ${path.basename(file)} cannot be sent`, { name: path.basename(file) });
    data = fs.readFileSync(file);
  } else {
    let res;
    try {
      res = await fetch(src, { signal: AbortSignal.timeout(15_000) });
    } catch {
      res = null;
    }
    const type = (res?.headers.get('content-type') || '').split(';')[0].trim();
    ext = extOfType(type) || (/\.(png|jpe?g|gif|webp)(?:\?|$)/i.exec(src)?.[1] || '').toLowerCase();
    if (!res?.ok || !TYPES[ext]) throw refusal('page_picture', `the picture at ${src} cannot be read`, { name: src.slice(0, 80) });
    data = Buffer.from(await res.arrayBuffer());
  }
  if (data.length > PAGE_LIMITS.fileBytes) {
    throw refusal('page_picture_big', `a picture is ${(data.length / 1048576).toFixed(1)} MB; Discord takes ${PAGE_LIMITS.fileBytes / 1048576} MB`, {
      name: path.basename(src).slice(0, 80), size: (data.length / 1048576).toFixed(1), max: String(PAGE_LIMITS.fileBytes / 1048576),
    });
  }
  return { data, ext: ext === 'jpeg' ? 'jpg' : ext, type: TYPES[ext] };
}

/**
 * The page as it goes up: each banner with words or a picture inside it
 * points at the picture drawn with them (drawn now, or the one already made).
 * Its block as saved keeps the banner as it was, to draw on again.
 */
async function withDrawings(page) {
  if (!page.blocks.some(bannerDrawn)) return page;
  const blocks = [];
  for (const b of page.blocks) blocks.push(bannerDrawn(b) ? { ...b, image: (await drawBanner(b, loadPicture)).src } : b);
  return { ...page, blocks };
}

async function loadPictures(page) {
  const out = new Map();
  for (const src of picturesToSend(page)) out.set(src, await loadPicture(src));
  return out;
}

// ------------------------------------------------------------------ posting

const quietly = (p) => p.catch((err) => log.debug(err.message));
const gone = (err) => err?.status === 404 || err?.code === 10008 || err?.code === 10003;

// ------------------------------------------------------------------ what it says, now

/** The stream as the overlays see it, for the overlay's {names}. */
function liveState() {
  return { ...engine.snapshot(), stats: tags.getStats(), voice: discordVoice.getState?.(), spotifyTrack: spotify.getNowPlaying?.() };
}

/** The page's own {names}: live or not, since when, and times as Discord shows them. */
export function pageValues(now = Date.now()) {
  const s = sessions.current();
  const stats = tags.getStats() || {};
  const viewers = (Number(stats.twitchViewers) || 0) + (stats.youtubeLive ? Number(stats.youtubeViewers) || 0 : 0) + (Number(stats.tiktokViewers) || 0);
  const next = twitchExtras.nextStream?.(now);
  const unix = next?.start ? Math.floor(Date.parse(next.start) / 1000) : 0;
  const login = twitch.getCredentials?.()?.login;
  return {
    live: s ? '🔴 **En directo**' : '⚫ Fuera de directo',
    liveSince: s ? `<t:${Math.floor(s.startedAt / 1000)}:R>` : '',
    streamTitle: s?.title || '',
    streamGame: s?.game || '',
    viewersAll: s && viewers ? viewers.toLocaleString('es-MX') : '',
    nextStreamAt: unix ? `<t:${unix}:F>` : '',
    nextStreamRelative: unix ? `<t:${unix}:R>` : '',
    twitchLink: login ? `https://twitch.tv/${login}` : '',
  };
}

/** A page with its {names} filled in for now. */
const filled = (page) => fillPage(page, liveState(), pageValues());

/** What a message says, without its files' bytes: to tell whether it changed. */
const said = (m) => JSON.stringify({ body: m.body, files: (m.files || []).map((f) => `${f.name}:${f.src || ''}`) });

/** The messages a page makes, the way it is set to be posted. */
function messagesOf(page, pictures) {
  if (page.style === 'single') {
    const one = singleMessage(page, pictures);
    return [{ kind: 'single', block: 'page', ...one }];
  }
  return classicMessages(page, pictures);
}

async function react(channelId, messageId, emojis) {
  for (const e of emojis || []) await quietly(discord.addReaction(channelId, messageId, e));
}

/** Post a page's messages as new. If one fails, those already up go again, so a page is never left half there. */
async function postFresh(channelId, built) {
  const ids = [];
  try {
    for (const m of built) {
      const sent = await discord.sendBuilt('POST', `/channels/${channelId}/messages`, m.body, m.files);
      ids.push(sent?.id);
      await react(channelId, sent?.id, m.reactions);
    }
  } catch (err) {
    for (const id of ids) await quietly(discord.deleteMessage(channelId, id));
    throw err;
  }
  return ids;
}

async function removeAll(channelId, ids) {
  let removed = 0;
  for (const id of ids || []) {
    try {
      await discord.deleteMessage(channelId, id);
      removed += 1;
    } catch (err) {
      if (gone(err)) removed += 1;
      else log.debug(`could not remove ${id}: ${err.message}`);
    }
  }
  return removed;
}

/** A record of what went up: where, how, each message's id and what made it, so the next change knows what to edit. */
const record = (channelId, page, built, ids) => ({
  channelId,
  style: page.style,
  ids,
  kinds: built.map((m) => m.kind),
  signatures: page.style === 'single' ? [JSON.stringify(page.blocks) + page.color] : page.blocks.map((b) => blockSignature(b, page)),
  reactions: built.map((m) => m.reactions || []),
  rendered: built.map(said),
  at: Date.now(),
});

/** Edit a classic page in place: only the messages whose block changed. Returns how many changed, or null to post again. */
async function editClassic(page, before, built) {
  if (before.kinds.length !== built.length || before.kinds.some((k, i) => k !== built[i].kind)) return null;
  let changed = 0;
  for (let i = 0; i < built.length; i += 1) {
    const id = before.ids[i];
    const m = built[i];
    // Its block changed, or what its {names} say did.
    if (before.signatures?.[i] !== blockSignature(page.blocks[i], page) || before.rendered?.[i] !== said(m)) {
      try {
        await discord.sendBuilt('PATCH', `/channels/${before.channelId}/messages/${id}`, m.body, m.files);
      } catch (err) {
        if (gone(err)) return null;
        throw err;
      }
      changed += 1;
    }
    const had = before.reactions?.[i] || [];
    for (const e of had.filter((x) => !m.reactions.includes(x))) await quietly(discord.removeOwnReaction(before.channelId, id, e));
    await react(before.channelId, id, m.reactions.filter((x) => !had.includes(x)));
  }
  return changed;
}

/** Edit a one-message page in place. Returns 1, or null to post again (the message is gone). */
async function editSingle(page, before, built) {
  const id = before.ids[0];
  const m = built[0];
  try {
    await discord.sendBuilt('PATCH', `/channels/${before.channelId}/messages/${id}`, m.body, m.files);
  } catch (err) {
    if (gone(err)) return null;
    throw err;
  }
  const had = before.reactions?.[0] || [];
  for (const e of had.filter((x) => !m.reactions.includes(x))) await quietly(discord.removeOwnReaction(before.channelId, id, e));
  await react(before.channelId, id, m.reactions.filter((x) => !had.includes(x)));
  return 1;
}

function ready(page) {
  const problem = pageProblems(page)[0];
  if (problem) throw refusal(problem.code, `the page cannot go up: ${problem.code}`, problem.vars);
}

/**
 * Post a page to its channel, or bring the post already there up to date.
 * Says how it went: posted, updated (and how many messages changed) or
 * reposted.
 */
export async function postPage(id) {
  const page = find(id);
  if (!page) throw refusal('page_missing', 'that page is gone');
  if (!page.channelId) throw refusal('page_no_channel', 'choose a channel for the page first');
  ready(page);
  const shown = await withDrawings(page);
  const built = messagesOf(filled(shown), await loadPictures(shown));
  const before = page.posted;

  if (before?.channelId === page.channelId && before.style === page.style && before.ids?.length) {
    const changed = page.style === 'single' ? await editSingle(page, before, built) : await editClassic(page, before, built);
    if (changed !== null) {
      putPage({ ...find(id), posted: record(page.channelId, page, built, before.ids) });
      return { done: 'updated', changed, messages: before.ids.length, channelId: page.channelId };
    }
  }

  const ids = await postFresh(page.channelId, built);
  // The new one is up: the old one goes, wherever it was.
  if (before?.ids?.length) await removeAll(before.channelId, before.ids);
  putPage({ ...find(id), posted: record(page.channelId, page, built, ids) });
  return { done: before ? 'reposted' : 'posted', messages: ids.length, channelId: page.channelId };
}

/** Post a page to the test channel, in place of its last test there. */
export async function testPage(id) {
  const page = find(id);
  if (!page) throw refusal('page_missing', 'that page is gone');
  const channelId = getGreetings().testChannelId;
  if (!channelId) throw refusal('page_no_test_channel', 'choose a test channel on the Welcome & Goodbye screen first');
  ready(page);
  const shown = await withDrawings(page);
  const built = messagesOf(filled(shown), await loadPictures(shown));
  if (page.tested?.ids?.length) await removeAll(page.tested.channelId, page.tested.ids);
  const ids = await postFresh(channelId, built);
  putPage({ ...find(id), tested: { channelId, ids, at: Date.now() } });
  return { done: 'tested', messages: ids.length, channelId };
}

/** Take a page down from Discord. The page itself is kept, to put up again. */
export async function unpostPage(id) {
  const page = find(id);
  if (!page) throw refusal('page_missing', 'that page is gone');
  const removed = page.posted ? await removeAll(page.posted.channelId, page.posted.ids) : 0;
  putPage({ ...find(id), posted: null });
  return { removed };
}

// ------------------------------------------------------------------ reading a channel back

const INVISIBLE_ONLY = /^[\s\u0000​-‏⁠﻿]*$/;
const emojiText = (e) => (e?.id ? `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>` : String(e?.name || ''));
const colourOf = (n) => (Number.isInteger(n) ? `#${n.toString(16).padStart(6, '0')}` : '');
const isDiscordFile = (url) => /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//.test(String(url || ''));

/**
 * A picture of Discord's, saved as an upload: Discord's own links to a
 * message's files stop working after a day. A link elsewhere is kept as it
 * is. Saved once, however many times the same message is read.
 */
async function keepPicture(url, stem) {
  if (!url) return '';
  if (!isDiscordFile(url)) return url;
  try {
    const known = fs.readdirSync(config.assetsDir).find((f) => f.startsWith(`${stem}.`));
    if (known) return `/media/${encodeURIComponent(known)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return '';
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    const ext = extOfType(type) || (/\.(png|jpe?g|gif|webp)(?:\?|$)/i.exec(url)?.[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
    const name = `${stem}.${ext}`;
    fs.writeFileSync(path.join(config.assetsDir, name), Buffer.from(await res.arrayBuffer()));
    return `/media/${encodeURIComponent(name)}`;
  } catch (err) {
    log.debug(`could not keep ${url}: ${err.message}`);
    return '';
  }
}

const linksFrom = (rows) => (rows || []).filter((r) => r?.type === 1)
  .map((r) => (r.components || []).filter((c) => c.type === 2 && c.style === 5 && c.url)
    .map((c) => ({ label: c.label || '', url: c.url, emoji: c.emoji ? emojiText(c.emoji) : '' })))
  .filter((buttons) => buttons.length)
  .map((buttons) => ({ type: 'links', buttons }));

/** A message in the newer layout, back into blocks. */
async function blocksFromComponents(list, stem) {
  const out = [];
  let n = 0;
  for (const c of list || []) {
    if (c.type === 12) {
      for (const item of c.items || []) out.push({ type: 'banner', image: await keepPicture(item.media?.url, `${stem}-${n += 1}`) });
    } else if (c.type === 10) {
      out.push({ type: 'text', text: c.content || '' });
    } else if (c.type === 14) {
      out.push({ type: 'gap', size: c.spacing === 2 ? 'large' : 'small', line: c.divider !== false });
    } else if (c.type === 1) {
      out.push(...linksFrom([c]));
    } else if (c.type === 17) {
      const texts = [];
      let image = '';
      let thumbnail = '';
      for (const part of c.components || []) {
        if (part.type === 10) texts.push(part.content || '');
        if (part.type === 9) {
          texts.push(...(part.components || []).map((t) => t.content || ''));
          if (part.accessory?.type === 11) thumbnail = await keepPicture(part.accessory.media?.url, `${stem}-${n += 1}`);
        }
        if (part.type === 12 && !image) image = await keepPicture(part.items?.[0]?.media?.url, `${stem}-${n += 1}`);
      }
      out.push({ type: 'card', description: texts.join('\n\n'), color: colourOf(c.accent_color), image, thumbnail });
    }
  }
  return out;
}

/** One message, back into the blocks that would make it. */
async function blocksFromMessage(m) {
  const stem = `page-${m.id}`;
  const out = [];
  if (m.flags & COMPONENTS_V2) {
    out.push(...await blocksFromComponents(m.components, stem));
  } else {
    const content = m.content || '';
    const pictures = (m.attachments || []).filter((a) => /^image\//.test(a.content_type || '') || /\.(png|jpe?g|gif|webp)$/i.test(a.filename || ''));
    const cards = (m.embeds || []).filter((e) => e.type === 'rich');
    if (content && INVISIBLE_ONLY.test(content)) {
      if (!pictures.length && !cards.length) out.push({ type: 'gap', size: content.includes('\n') ? 'large' : 'small', line: false });
    } else if (content) {
      out.push({ type: 'text', text: content });
    }
    for (const [i, a] of pictures.entries()) out.push({ type: 'banner', image: await keepPicture(a.url, `${stem}-${i}`) });
    for (const [i, e] of cards.entries()) {
      out.push({
        type: 'card',
        author: e.author?.name || '',
        title: e.title || '',
        url: e.url || '',
        description: e.description || '',
        color: colourOf(e.color),
        fields: (e.fields || []).map((f) => ({ name: f.name === '​' ? '' : f.name, value: f.value === '​' ? '' : f.value, inline: f.inline === true })),
        image: await keepPicture(e.image?.url, `${stem}-e${i}-image`),
        thumbnail: await keepPicture(e.thumbnail?.url, `${stem}-e${i}-thumb`),
        footer: e.footer?.text || '',
      });
    }
    out.push(...linksFrom(m.components));
  }
  // The reactions under the message, on its last card or words.
  const reactions = (m.reactions || []).map((r) => emojiText(r.emoji)).filter(Boolean);
  const holder = [...out].reverse().find((b) => b.type === 'card' || b.type === 'text');
  if (holder && reactions.length) holder.reactions = reactions;
  return out;
}

/**
 * A new page from what a channel has: its newest messages, oldest first, as
 * blocks. Plain chat and joins are skipped; the bot's own pages, MEE6's and
 * anybody's embeds are read. The messages read are remembered, to delete once
 * the new page is up — only when asked.
 */
export async function importPage(channelId) {
  if (!/^\d{5,25}$/.test(String(channelId || ''))) throw refusal('page_no_channel', 'choose the channel to read');
  if (pages().length >= MAX_PAGES) throw refusal('page_too_many_pages', `there can be ${MAX_PAGES} pages`, { max: MAX_PAGES });
  const raw = (await discord.listMessages(channelId, IMPORT_LIMIT) || []).slice().reverse();
  const used = raw.filter((m) => (m.type === 0 || m.type === 19) && (m.author?.bot || m.webhook_id || m.embeds?.length || m.attachments?.length));
  const blocks = [];
  for (const m of used) blocks.push(...await blocksFromMessage(m));
  if (!blocks.length) throw refusal('page_nothing_to_read', 'nothing in that channel could be read into a page');
  const channel = (discord.getCache()?.channels || []).find((c) => c.id === String(channelId));
  const firstColour = blocks.find((b) => b.type === 'card' && b.color)?.color;
  const page = cleanPage({
    name: channel ? `#${channel.name}` : 'Page',
    channelId: String(channelId),
    style: 'classic',
    color: firstColour || '#fefefe',
    blocks: blocks.slice(0, PAGE_LIMITS.blocks).map((b) => cleanBlock(b)),
  });
  page.source = { channelId: String(channelId), ids: used.map((m) => m.id), at: Date.now(), cut: Math.max(0, blocks.length - PAGE_LIMITS.blocks) };
  putPage(page);
  return page;
}

/** Delete the messages a page was read from. Only when asked, and only those. */
export async function deleteSource(id) {
  const page = find(id);
  if (!page?.source) throw refusal('page_missing', 'that page was not read from a channel');
  const removed = await removeAll(page.source.channelId, page.source.ids);
  putPage({ ...find(id), source: null });
  return { removed, of: page.source.ids.length };
}

// ------------------------------------------------------------------ keeping live pages up to date

/*
  A page set to stay up to date is edited in place when what its {names}
  say changes: going live, a new game, the song, the plan's step, the
  viewers. Looked at once a minute, and soon after anything like that
  happens — at most every half minute per page. Only the messages whose
  words changed are sent again; a page whose blocks were changed by hand
  waits for "Update in Discord".
*/
const LIVE_EVERY_MS = 60_000;
const LIVE_AT_MOST_MS = 30_000;
let liveTimer = null;
let nudgeTimer = null;
const lastLive = new Map();

export async function refreshLive(now = Date.now()) {
  let edited = 0;
  for (const page of pages()) {
    const before = page.posted;
    if (!page.live || !before?.ids?.length || now - (lastLive.get(page.id) || 0) < LIVE_AT_MOST_MS) continue;
    if (before.style !== page.style) continue;
    // Names only, first: pictures are read only if a message with some must go again. Drawn banners are found, not drawn again.
    let shown;
    try {
      shown = await withDrawings(page);
    } catch (err) {
      log.warn(`could not draw on a banner of "${page.name}": ${err.message}`);
      continue;
    }
    let built = messagesOf(filled(shown), new Map());
    if (built.length !== before.ids.length || built.some((m, i) => (before.kinds?.[i] ?? m.kind) !== m.kind)) continue;
    const changed = built.map((m, i) => (before.rendered?.[i] !== said(m) ? i : -1)).filter((i) => i >= 0);
    if (!changed.length) continue;
    lastLive.set(page.id, now);
    if (changed.some((i) => built[i].files.length)) built = messagesOf(filled(shown), await loadPictures(shown));
    try {
      for (const i of changed) await discord.sendBuilt('PATCH', `/channels/${before.channelId}/messages/${before.ids[i]}`, built[i].body, built[i].files);
      const rendered = built.map((m, i) => (changed.includes(i) ? said(m) : before.rendered?.[i]));
      putPage({ ...find(page.id), posted: { ...before, rendered } });
      edited += changed.length;
    } catch (err) {
      log.warn(`could not bring "${page.name}" up to date: ${err.message}`);
    }
  }
  return edited;
}

/** Something a live page may show changed: look soon. */
function nudge() {
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(() => { refreshLive().catch((err) => log.warn(err.message)); }, 10_000);
  nudgeTimer.unref?.();
}

// ------------------------------------------------------------------ the screen

export function savePage(incoming) {
  const before = incoming?.id ? find(incoming.id) : null;
  if (!before && pages().length >= MAX_PAGES) throw refusal('page_too_many_pages', `there can be ${MAX_PAGES} pages`, { max: MAX_PAGES });
  const page = cleanPage(incoming, before);
  putPage(page);
  return page;
}

/** Forget a page. What it posted stays in Discord unless it was taken down first. */
export function removePage(id) {
  save(pages().filter((p) => p.id !== id));
  return { ok: true };
}

/** From the Discord pages screen: { op, … }. */
export async function control(payload = {}) {
  switch (payload.op) {
    case 'save': return savePage(payload.page);
    case 'remove': return removePage(String(payload.id || ''));
    case 'post': return postPage(String(payload.id || ''));
    case 'test': return testPage(String(payload.id || ''));
    case 'unpost': return unpostPage(String(payload.id || ''));
    case 'import': return importPage(payload.channelId);
    case 'delete_source': return deleteSource(String(payload.id || ''));
    // A banner's words and picture inside drawn as they will go up, for the screen to show.
    case 'draw': return drawBanner(cleanBlock({ ...payload.block, type: 'banner' }), loadPicture, { preview: true });
    default: throw new Error(`unknown pages operation "${payload.op}"`);
  }
}

export function initDiscordPages() {
  store = collection('discord_pages', { pages: [] });
  initBannerText();
  keepDrawings(pages().flatMap((p) => p.blocks.map((b) => b.id)));
  clearInterval(liveTimer);
  liveTimer = setInterval(() => { refreshLive().catch((err) => log.warn(`live pages: ${err.message}`)); }, LIVE_EVERY_MS);
  liveTimer.unref?.();
  for (const what of ['stream:started', 'stream:ended', EVENTS.CHANNEL]) bus.on(what, nudge);
  bus.on(EVENTS.EVENT, (e) => { if (e?.type === 'spotify_track_change' || e?.type === 'obs_stream_started' || e?.type === 'obs_stream_stopped') nudge(); });
  bus.on(EVENTS.CONFIG, (c) => { if (c?.key === 'plan' || c?.key === 'twitchSchedule') nudge(); });
}
