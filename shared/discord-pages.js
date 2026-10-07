/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord pages, shared: what a page may hold, and the messages each way of
 * posting it makes. Here, without the server, so the Discord pages screen
 * counts pieces and characters exactly as the post will, and the tests read
 * the same rules.
 *
 * A page is blocks in order:
 *
 *   banner  a picture across the channel, on its own
 *   card    a box with a coloured edge: small print at the top, a title (a
 *           link if given one), text, fields, a picture, a thumbnail, a footer
 *   text    plain words, as anybody would write them
 *   gap     space between sections; in one message it can draw a line
 *   links   up to five buttons that open a link
 *
 * Two ways to post it:
 *
 *   classic  a message per block, the way MEE6 posts a welcome page: a banner
 *            is a picture sent as a file, a card an embed, a gap a message of
 *            one invisible character. Fields can sit side by side.
 *   single   the whole page as one message in Discord's newer layout
 *            (components v2): banners as image galleries, cards as containers
 *            with the same coloured edge, gaps as separators. Up to 40 pieces
 *            and 4,000 characters of text; fields stack.
 */

import { OVERLAY_VARS, fillTemplate } from './overlay-vars.js';

export const PAGE_BLOCK_TYPES = ['banner', 'card', 'text', 'gap', 'links'];

/**
 * A page's own words, beside every overlay variable ({viewers}, {nowPlaying},
 * {planNow}, {nextStream}, {latestFollower}…): what only a Discord page says —
 * the times as Discord shows them, in each reader's own time zone, and
 * counting by themselves.
 */
export const PAGE_VARS = [
  { name: 'live', label: 'Live or not, as a line' },
  { name: 'liveSince', label: 'How long it has been on (Discord counts it up)' },
  { name: 'streamTitle', label: "The stream's title, while live" },
  { name: 'streamGame', label: "The stream's game, while live" },
  { name: 'viewersAll', label: 'Viewers on every platform together, while live' },
  { name: 'nextStreamAt', label: "Next stream, in each reader's own time" },
  { name: 'nextStreamRelative', label: 'Next stream, as "in 2 days"' },
  { name: 'twitchLink', label: 'Your Twitch link' },
];
/** Every {name} a page fills in. */
export const PAGE_VAR_NAMES = new Set([...OVERLAY_VARS.map((v) => v.name), ...PAGE_VARS.map((v) => v.name)]);

/**
 * A page's words with their {names} filled in: the page's own from `values`,
 * the overlay's from `state`. A line whose names all came out empty goes
 * altogether, so one card reads right both live ("👀 {viewersAll} viendo")
 * and not. An unknown name stays as typed, to be seen and fixed.
 */
export function fillWords(text, state, values = {}) {
  return String(text ?? '').split('\n').map((line) => {
    let named = 0;
    let empty = 0;
    const out = line.replace(/\{([a-zA-Z]+)\}/g, (whole, name) => {
      let value;
      if (Object.prototype.hasOwnProperty.call(values, name)) value = values[name];
      else if (PAGE_VAR_NAMES.has(name)) value = fillTemplate(whole, state, '');
      else return whole;
      named += 1;
      if (value === '' || value === null || value === undefined) { empty += 1; return ''; }
      return String(value);
    });
    return named && named === empty ? null : out;
  }).filter((line) => line !== null).join('\n')
    // What is left where lines went: no blank lines at either end, never two in a row.
    .replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

/** The page with every block's words filled in. */
export function fillPage(page, state, values) {
  const f = (t) => fillWords(t, state, values);
  return {
    ...page,
    blocks: page.blocks.map((b) => {
      if (b.type === 'card') return { ...b, author: f(b.author), title: f(b.title), description: f(b.description), footer: f(b.footer), fields: b.fields.map((x) => ({ ...x, name: f(x.name), value: f(x.value) })) };
      if (b.type === 'text') return { ...b, text: f(b.text) };
      if (b.type === 'links') return { ...b, buttons: b.buttons.map((x) => ({ ...x, label: f(x.label) })) };
      return b;
    }),
  };
}

/** A card ready to show the stream as it is: live or not, title, game, viewers, song, the plan, the next stream. */
export const LIVE_STATUS_CARD = {
  type: 'card',
  title: '{live}',
  description: '**{streamTitle}**\n🎮 {streamGame}\n👀 {viewersAll} viendo\n⏱️ En directo desde {liveSince}\n🎵 {nowPlaying} — {nowPlayingArtist}\n📋 Ahora: {planNow}\n\n📅 Próximo directo: {nextStreamAt} ({nextStreamRelative})',
  footer: 'Se actualiza solo',
};
export const PAGE_STYLES = ['classic', 'single'];

export const PAGE_LIMITS = {
  /** Blocks on a page — a message each when posted the classic way. */
  blocks: 25,
  /** Discord's own limits for one message in the newer layout. */
  components: 40,
  text: 4000,
  /** An embed's title, description, fields, footer and small print together. */
  embed: 6000,
  /** Words in a message of its own. */
  content: 2000,
  /** What one picture may weigh: Discord's limit for a bot's upload. */
  fileBytes: 10 * 1024 * 1024,
  reactions: 10,
};

/** The flag that tells Discord a message is laid out in components (the newer layout). */
export const COMPONENTS_V2 = 1 << 15;
/** What a gap is made of the classic way: Discord takes no empty message, and shows this as nothing. */
export const INVISIBLE = '​';

const str = (v, max) => String(v ?? '').slice(0, max);
const link = (v) => {
  const s = String(v ?? '').trim();
  return /^https?:\/\/\S+$/.test(s) ? s.slice(0, 512) : '';
};
/** An upload (/media/…) or a link to a picture. */
export const pagePicture = (v) => {
  const s = String(v ?? '').trim();
  return /^\/media\/[^/\s]+$/.test(s) || /^https?:\/\/\S+$/.test(s) ? s.slice(0, 500) : '';
};
const colour = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : fallback);
const emojiOk = (e) => typeof e === 'string' && e.trim() !== '' && e.trim().length <= 80;
const blockId = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : `b-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`);

/**
 * Words over a banner, drawn into its picture by the server (the way MEE6
 * writes "Welcome!" on one). The size is a share of the picture's height, so
 * the words look the same on a small banner and a big one.
 *
 * They sit where `at` and `align` put them, in line with the banner's edges —
 * or, once dragged, wherever `x` and `y` say: where their middle is, as a
 * share of the banner's width and height, like the picture inside.
 */
export const CAPTION_DEFAULTS = { text: '', font: 'Montserrat', weight: 400, size: 30, color: '#ffffff', at: 'middle', align: 'center', shadow: true, outline: false, x: null, y: null };
export const CAPTION_WEIGHTS = [300, 400, 700, 900];
export const CAPTION_LIMITS = { text: 120, lines: 3, size: [8, 60] };

/** A share of the banner, 0 to 100 to a tenth, or null for none. */
const shareOf = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 10) / 10)) : null;
};

export function cleanCaption(c) {
  const d = CAPTION_DEFAULTS;
  const size = Math.round(Number(c?.size));
  // Placed by hand only with both: half a place is no place.
  const x = shareOf(c?.x);
  const y = shareOf(c?.y);
  const placed = x !== null && y !== null;
  return {
    x: placed ? x : null,
    y: placed ? y : null,
    text: str(c?.text, CAPTION_LIMITS.text).replace(/\r/g, '').split('\n').slice(0, CAPTION_LIMITS.lines).join('\n'),
    // A face the server has, or one uploaded: a name, never anything a stylesheet would read as more.
    font: typeof c?.font === 'string' && /^[^"'<>;{}\\\n]{1,80}$/.test(c.font.trim()) ? c.font.trim() : d.font,
    weight: CAPTION_WEIGHTS.includes(Number(c?.weight)) ? Number(c.weight) : d.weight,
    size: Number.isFinite(size) ? Math.min(CAPTION_LIMITS.size[1], Math.max(CAPTION_LIMITS.size[0], size)) : d.size,
    color: colour(c?.color, d.color),
    at: ['top', 'middle', 'bottom'].includes(c?.at) ? c.at : d.at,
    align: ['left', 'center', 'right'].includes(c?.align) ? c.align : d.align,
    shadow: c?.shadow !== false,
    outline: c?.outline === true,
  };
}

/**
 * One picture inside a banner — a logo, an avatar — under the words. Where it
 * sits is where its middle is, as a share of the banner's width and height;
 * its size is its height as a share of the banner's, like the words'.
 */
export const INSET_DEFAULTS = { image: '', x: 50, y: 50, size: 60 };
export const INSET_LIMITS = { size: [5, 200] };

export function cleanInset(i) {
  const d = INSET_DEFAULTS;
  const share = (v, lo, hi, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 10) / 10)) : fallback;
  };
  return {
    image: pagePicture(i?.image),
    x: share(i?.x, 0, 100, d.x),
    y: share(i?.y, 0, 100, d.y),
    size: share(i?.size, INSET_LIMITS.size[0], INSET_LIMITS.size[1], d.size),
  };
}

/** A banner with words to draw on it. */
export const captionShown = (b) => b?.type === 'banner' && Boolean(b.image) && Boolean(String(b.caption?.text || '').trim());
/** A banner the server draws on: words, a picture inside, or both. */
export const bannerDrawn = (b) => b?.type === 'banner' && Boolean(b.image) && (captionShown(b) || Boolean(b.inset?.image));

/** One block as kept: its own fields only, each of a size Discord takes. Anything else is dropped. */
export function cleanBlock(b) {
  const type = PAGE_BLOCK_TYPES.includes(b?.type) ? b.type : null;
  if (!type) return null;
  const id = blockId(b.id);
  const reactions = (Array.isArray(b.reactions) ? b.reactions : []).filter(emojiOk).map((e) => e.trim()).slice(0, PAGE_LIMITS.reactions);
  // Words only once some were set: a banner from before them is kept as it was, and its post is not edited for nothing.
  if (type === 'banner') {
    return {
      id, type, image: pagePicture(b.image),
      ...(b.caption && typeof b.caption === 'object' ? { caption: cleanCaption(b.caption) } : {}),
      ...(b.inset && typeof b.inset === 'object' ? { inset: cleanInset(b.inset) } : {}),
    };
  }
  if (type === 'text') return { id, type, text: str(b.text, PAGE_LIMITS.content), reactions };
  if (type === 'gap') return { id, type, size: b.size === 'large' ? 'large' : 'small', line: b.line === true };
  if (type === 'links') {
    return {
      id, type,
      buttons: (Array.isArray(b.buttons) ? b.buttons : []).slice(0, 5)
        .map((x) => ({ label: str(x?.label, 80), url: link(x?.url), emoji: emojiOk(x?.emoji) ? x.emoji.trim() : '' })),
    };
  }
  return {
    id, type,
    author: str(b.author, 256),
    title: str(b.title, 256),
    url: link(b.url),
    description: str(b.description, 4096),
    // Empty is the page's colour.
    color: colour(b.color, ''),
    fields: (Array.isArray(b.fields) ? b.fields : []).slice(0, 25)
      .map((f) => ({ name: str(f?.name, 256), value: str(f?.value, 1024), inline: f?.inline === true })),
    image: pagePicture(b.image),
    thumbnail: pagePicture(b.thumbnail),
    footer: str(b.footer, 2048),
    reactions,
  };
}

/**
 * A page as the screen may set it: a name, where it goes, how it is posted,
 * its colour and its blocks. Where it was posted, tested and read from are
 * the server's own, and carried over from `before` untouched.
 */
export function cleanPage(p, before = null) {
  return {
    id: before?.id || (typeof p?.id === 'string' && /^[\w-]{1,40}$/.test(p.id) ? p.id : `pg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`),
    name: str(p?.name, 80).trim() || 'Page',
    channelId: /^\d{5,25}$/.test(String(p?.channelId ?? '')) ? String(p.channelId) : '',
    style: PAGE_STYLES.includes(p?.style) ? p.style : 'classic',
    color: colour(p?.color, '#fefefe'),
    blocks: (Array.isArray(p?.blocks) ? p.blocks : []).slice(0, PAGE_LIMITS.blocks).map(cleanBlock).filter(Boolean),
    // Kept up to date: posted again, in place, as what it shows changes.
    live: p?.live === true,
    posted: before?.posted ?? null,
    tested: before?.tested ?? null,
    source: before?.source ?? null,
    updatedAt: Date.now(),
  };
}

const hex = (c) => Number.parseInt(String(c).replace('#', ''), 16);

/** An emoji as a button or a reaction wants it: a server one by id, a regular one as itself. */
export function emojiObject(e) {
  const m = /^<(a?):([\w~-]+):(\d+)>$/.exec(String(e || '').trim());
  return m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : { name: String(e || '').trim() };
}

/**
 * Small print with a server emoji in it, the way an embed shows one: the
 * first emoji as the line's icon and the words beside it, since Discord draws
 * no emoji in an embed's author or footer.
 */
export function smallPrint(text, key, max) {
  const raw = String(text ?? '');
  const first = /<(a?):[\w~-]+:(\d+)>/.exec(raw);
  if (!first) return { [key]: raw.slice(0, max) };
  const words = raw.replace(/<a?:[\w~-]+:\d+>/g, '').replace(/[ \t]{2,}/g, ' ').trim() || INVISIBLE;
  return { [key]: words.slice(0, max), icon_url: `https://cdn.discordapp.com/emojis/${first[2]}.${first[1] ? 'gif' : 'png'}` };
}

const linkButtons = (b) => b.buttons.filter((x) => x.url && (x.label || x.emoji)).map((x) => ({
  type: 2, style: 5, url: x.url,
  ...(x.label ? { label: x.label } : {}),
  ...(x.emoji ? { emoji: emojiObject(x.emoji) } : {}),
}));

/**
 * Which pictures go up as files. A picture from the upload library always
 * does (Discord cannot reach this server); a classic banner always does too,
 * since only a file shows as a bare picture. A link anywhere else is used as
 * it is.
 */
export function picturesToSend(page) {
  const out = new Set();
  for (const b of page.blocks) {
    if (b.type === 'banner' && b.image && (page.style === 'classic' || b.image.startsWith('/media/'))) out.add(b.image);
    if (b.type === 'card') for (const p of [b.image, b.thumbnail]) if (p && p.startsWith('/media/')) out.add(p);
  }
  return [...out];
}

/**
 * Hands out a message's files: a picture to send gets a file name and is
 * named attachment://… in the message; a link is used as it is. Without its
 * bytes (the screen counting, or a picture that could not be read) a picture
 * still gets its name, so the count is the same either way.
 */
function attacher(pictures) {
  const files = [];
  const attach = (src, stem, { upload = false } = {}) => {
    if (!src) return '';
    if (!upload && !src.startsWith('/media/')) return src;
    const pic = pictures?.get?.(src);
    const ext = pic?.ext || (/\.(\w{3,4})$/.exec(src)?.[1] || 'png').toLowerCase();
    const name = `${stem}-${files.length}.${ext}`;
    files.push({ name, src, data: pic?.data, type: pic?.type || `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    return `attachment://${name}`;
  };
  return { files, attach };
}

/** A card as an embed, for the classic way. */
export function cardEmbed(b, page, attach) {
  const e = {};
  if (b.author) e.author = smallPrint(b.author, 'name', 256);
  if (b.title) e.title = b.title;
  if (b.title && b.url) e.url = b.url;
  if (b.description) e.description = b.description;
  const fields = b.fields.filter((f) => f.name || f.value);
  if (fields.length) e.fields = fields.map((f) => ({ name: f.name || INVISIBLE, value: f.value || INVISIBLE, inline: f.inline }));
  const image = attach(b.image, 'image');
  if (image) e.image = { url: image };
  const thumbnail = attach(b.thumbnail, 'thumb');
  if (thumbnail) e.thumbnail = { url: thumbnail };
  if (b.footer) e.footer = smallPrint(b.footer, 'text', 2048);
  // An embed with nothing in it is refused.
  if (!e.author && !e.title && !e.description && !e.fields && !e.image && !e.thumbnail && !e.footer) e.description = INVISIBLE;
  e.color = hex(b.color || page.color);
  return e;
}

/** How long Discord counts an embed: title, description, field names and values, footer and small print. */
export const embedLength = (e) => (e.title || '').length + (e.description || '').length + (e.author?.name || '').length
  + (e.footer?.text || '').length + (e.fields || []).reduce((n, f) => n + f.name.length + f.value.length, 0);

/**
 * The classic way: a message per block, each { body, files, reactions, kind }.
 * Nothing pings — a mention shows, but nobody is called by a page.
 */
export function classicMessages(page, pictures) {
  return page.blocks.map((b) => {
    const { files, attach } = attacher(pictures);
    const body = { content: '', allowed_mentions: { parse: [] } };
    let reactions = [];
    if (b.type === 'banner') {
      attach(b.image, 'banner', { upload: true });
      if (!files.length) body.content = INVISIBLE;
    } else if (b.type === 'card') {
      body.embeds = [cardEmbed(b, page, attach)];
      reactions = b.reactions;
    } else if (b.type === 'text') {
      body.content = b.text.trim() ? b.text : INVISIBLE;
      reactions = b.reactions;
    } else if (b.type === 'gap') {
      body.content = b.size === 'large' ? `${INVISIBLE}\n${INVISIBLE}` : INVISIBLE;
    } else if (b.type === 'links') {
      const buttons = linkButtons(b);
      if (buttons.length) body.components = [{ type: 1, components: buttons }];
      else body.content = INVISIBLE;
    }
    return { kind: b.type, block: b.id, body, files, reactions };
  });
}

/** A card as a container, for the newer layout: the same coloured edge, its parts as text and galleries. */
function cardContainer(b, page, attach) {
  const parts = [];
  const head = [];
  if (b.author) head.push(`-# ${b.author}`);
  if (b.title) head.push(`### ${b.url ? `[${b.title}](${b.url})` : b.title}`);
  if (b.description) head.push(b.description);
  const thumbnail = attach(b.thumbnail, 'thumb');
  if (head.length && thumbnail) {
    parts.push({ type: 9, components: [{ type: 10, content: head.join('\n') }], accessory: { type: 11, media: { url: thumbnail } } });
  } else {
    if (head.length) parts.push({ type: 10, content: head.join('\n') });
    if (thumbnail) parts.push({ type: 12, items: [{ media: { url: thumbnail } }] });
  }
  // Side by side is the classic way's alone: here each field is a name over its value.
  const fields = b.fields.filter((f) => f.name || f.value);
  if (fields.length) parts.push({ type: 10, content: fields.map((f) => [f.name && `**${f.name}**`, f.value].filter(Boolean).join('\n')).join('\n\n') });
  const image = attach(b.image, 'image');
  if (image) parts.push({ type: 12, items: [{ media: { url: image } }] });
  if (b.footer) parts.push({ type: 10, content: `-# ${b.footer}` });
  if (!parts.length) parts.push({ type: 10, content: INVISIBLE });
  return { type: 17, accent_color: hex(b.color || page.color), components: parts };
}

/** The newer layout: the whole page as one message, { body, files, reactions }. */
export function singleMessage(page, pictures) {
  const { files, attach } = attacher(pictures);
  const components = [];
  const reactions = [];
  for (const b of page.blocks) {
    if (b.type === 'banner') {
      const url = attach(b.image, 'banner');
      if (url) components.push({ type: 12, items: [{ media: { url } }] });
    } else if (b.type === 'card') {
      components.push(cardContainer(b, page, attach));
      reactions.push(...b.reactions);
    } else if (b.type === 'text') {
      if (b.text.trim()) components.push({ type: 10, content: b.text });
      reactions.push(...b.reactions);
    } else if (b.type === 'gap') {
      components.push({ type: 14, divider: b.line, spacing: b.size === 'large' ? 2 : 1 });
    } else if (b.type === 'links') {
      const buttons = linkButtons(b);
      if (buttons.length) components.push({ type: 1, components: buttons });
    }
  }
  return {
    body: { flags: COMPONENTS_V2, components, allowed_mentions: { parse: [] } },
    files,
    reactions: [...new Set(reactions)].slice(0, 20),
  };
}

/** Every piece of a message in the newer layout, the way Discord counts them: each one, however deep. */
export function countComponents(list) {
  return (list || []).reduce((n, c) => n + 1 + countComponents(c.components) + (c.accessory ? 1 : 0), 0);
}

/** The text of a message in the newer layout, as Discord counts it toward its 4,000. */
export function componentText(list) {
  return (list || []).reduce((n, c) => n + (c.type === 10 ? (c.content || '').length : 0) + componentText(c.components)
    + (c.accessory?.type === 10 ? (c.accessory.content || '').length : 0), 0);
}

/**
 * What would stop the page going up, as codes the screen has words for, each
 * with what fills them. Empty when it can be posted.
 */
export function pageProblems(page) {
  const out = [];
  if (!page.blocks.length) out.push({ code: 'page_empty' });
  if (page.blocks.some((b) => b.type === 'banner' && !b.image)) out.push({ code: 'page_banner_empty' });
  if (page.blocks.some((b) => b.type === 'links' && !b.buttons.some((x) => x.url && (x.label || x.emoji)))) out.push({ code: 'page_links_empty' });
  if (page.style === 'single') {
    const { body } = singleMessage(page);
    const pieces = countComponents(body.components);
    const text = componentText(body.components);
    if (pieces > PAGE_LIMITS.components) out.push({ code: 'page_too_many', vars: { count: pieces, max: PAGE_LIMITS.components } });
    if (text > PAGE_LIMITS.text) out.push({ code: 'page_too_long', vars: { count: text, max: PAGE_LIMITS.text } });
  } else {
    classicMessages(page).forEach((m, i) => {
      const e = m.body.embeds?.[0];
      if (e && embedLength(e) > PAGE_LIMITS.embed) out.push({ code: 'page_card_long', vars: { block: i + 1, count: embedLength(e), max: PAGE_LIMITS.embed } });
    });
  }
  return out;
}

/** What one block looks like when posted, to tell whether its message needs editing. */
export const blockSignature = (b, page) => JSON.stringify({ ...b, reactions: undefined, pageColor: b.type === 'card' && !b.color ? page.color : undefined });
