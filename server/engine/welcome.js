/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The posts Discord gets when somebody arrives or leaves: a message line,
 * an embed, the picture card drawn for them (welcome-card.js), and a
 * reaction under it for everybody else to say hi with.
 *
 * Every kind of greeting takes the same path — who it is about, the words
 * filled in for them, the post, the reaction — so a feature added to one is
 * there for all of them. A test goes down that path too, with the server's
 * owner standing in for the newcomer, so what the test posts is what a real
 * join would.
 *
 * Moved here out of discord-roles.js, which keeps reaction and button menus.
 */

import fs from 'node:fs';
import path from 'node:path';
import { collection } from '../core/store.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import * as discord from '../platforms/discord.js';
import { renderCard } from './welcome-card.js';
import { kindOfBytes } from './picture-still.js';
import { config } from '../config.js';
import { cleanCard } from '../../shared/card-css.js';
import { fillGreeting, accountAge, createdAt, longDate } from '../../shared/greeting-text.js';

const log = createLogger('welcome');

/*
  Somebody arriving, leaving, boosting the server, or banned from it. A ban
  is a leave as well, and with the ban post on it takes the goodbye's place:
  "so-and-so left" is the wrong thing to say about a ban.
*/
export const GREETING_KINDS = ['welcome', 'goodbye', 'boost', 'ban'];

const BASE = {
  enabled: false, channelId: '', messages: [], sendCard: false,
  /** An emoji the bot reacts to its own post with, so everybody else can add theirs in one click. '' is none. */
  react: '',
  /** Buttons under the post: links (rules, the channel, socials) and roles to pick up. */
  buttons: [],
};
export const DEFAULT_GREETINGS = {
  // A direct message to the newcomer as well, in their own words: its lines, the card, the link buttons.
  welcome: { ...BASE, autoRoleId: '', react: '👋', dm: { enabled: false, messages: [], picture: false, links: true } },
  goodbye: { ...BASE },
  boost: { ...BASE, react: '🎉' },
  ban: { ...BASE },
};

let greetings = null;

export function initWelcome() {
  greetings = collection('welcome_goodbye', DEFAULT_GREETINGS);
  bus.on('discord:member_join', onMemberJoin);
  bus.on('discord:member_join', (d) => { if (ours(d)) announce('discord_join', d).catch(() => {}); });
  bus.on('discord:member_leave', onMemberLeave);
  bus.on('discord:member_update', onMemberUpdate);
  bus.on('discord:member_ban', onMemberBan);
}

/**
 * Somebody joining or boosting, told to the rest of the app as a stream event,
 * so an action can answer it — an alert on stream, a thank-you in Twitch chat,
 * a sound — whether or not a post goes in Discord. {user} is their name in
 * the server; {event.username}, {event.accountAge} ("2 años"),
 * {event.created} and {event.count} say the rest.
 */
async function announce(type, d) {
  const user = d?.user || {};
  const made = createdAt(user.id);
  const context = await contextFor(d.guild_id).catch(() => ({}));
  bus.emit(EVENTS.EVENT, normaliseEvent({
    type,
    platform: 'discord',
    user: d.nick || user.global_name || user.username || 'Alguien',
    avatar: user.id && user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
    data: {
      userId: user.id || '',
      username: user.username || '',
      accountAge: accountAge(made),
      created: made ? longDate(made) : '',
      count: context.count ?? '',
      ...(type === 'discord_boost' ? { boosts: context.boosts ?? '' } : {}),
    },
  }));
}

const line = (v, max) => String(v ?? '').slice(0, max);

/** A reaction as Discord takes one: a unicode emoji, or a server one as <:name:id>. */
export function cleanReaction(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^<a?:[\w~-]{1,32}:\d{5,25}>$/.test(s)) return s;
  // Unicode emoji only — a word here would make every reaction fail.
  return s.length <= 16 && /\p{Extended_Pictographic}/u.test(s) && !/[\w<>:]/.test(s) ? s : '';
}

const lines = (list) => (Array.isArray(list) ? list : []).map((m) => line(m, 2000)).filter((m) => m.trim()).slice(0, 25);

export const MAX_GREETING_BUTTONS = 10;

/**
 * Buttons under a post, as kept: a link (a label, an https address) or a role
 * to pick up (a label, the role, a colour). Up to two rows of five. A role
 * appears once — Discord refuses two buttons with the same id.
 */
export function cleanButtons(list) {
  const roles = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const b = raw && typeof raw === 'object' ? raw : {};
    const label = line(b.label, 80).trim();
    const emoji = cleanReaction(b.emoji);
    if (!label && !emoji) continue;
    if (b.kind === 'role') {
      const roleId = String(b.roleId ?? '');
      if (!/^\d{1,25}$/.test(roleId) || roles.has(roleId)) continue;
      roles.add(roleId);
      out.push({ kind: 'role', label, emoji, roleId, style: [1, 2, 3, 4].includes(Number(b.style)) ? Number(b.style) : 2 });
    } else {
      const url = String(b.url ?? '').trim();
      if (!/^https?:\/\/\S+$/.test(url) || url.length > 512) continue;
      out.push({ kind: 'link', label, emoji, url });
    }
    if (out.length >= MAX_GREETING_BUTTONS) break;
  }
  return out;
}

/** One kind's settings as they are kept: what is there, bounded, and nothing else. */
export function cleanGreeting(kind, incoming) {
  const c = incoming && typeof incoming === 'object' ? incoming : {};
  const { canvas: _canvas, ...rest } = c;
  const dm = c.dm && typeof c.dm === 'object' ? c.dm : {};
  return {
    ...DEFAULT_GREETINGS[kind],
    ...rest,
    enabled: c.enabled === true,
    channelId: /^\d{1,25}$/.test(String(c.channelId ?? '')) ? String(c.channelId) : '',
    messages: lines(c.messages),
    sendCard: c.sendCard === true,
    // Left out means the kind's own (a wave for a welcome); '' is none, on purpose.
    react: c.react === undefined ? DEFAULT_GREETINGS[kind].react : cleanReaction(c.react),
    buttons: cleanButtons(c.buttons),
    image: cleanCard(c.image),
    ...(kind === 'welcome' ? {
      dm: { enabled: dm.enabled === true, messages: lines(dm.messages), picture: dm.picture === true, links: dm.links !== false },
    } : {}),
  };
}

/*
  Read through the same cleaning as a save, so a setup saved before a setting
  existed reads with that setting's default — a welcome saved before the
  reaction gets the wave — without anything on disk being rewritten.
*/
export function getGreetings() {
  const stored = greetings?.get() || DEFAULT_GREETINGS;
  return {
    ...Object.fromEntries(GREETING_KINDS.map((kind) => [kind, cleanGreeting(kind, stored[kind])])),
    testChannelId: cleanChannel(stored.testChannelId),
  };
}

const cleanChannel = (v) => (/^\d{1,25}$/.test(String(v ?? '')) ? String(v) : '');

export function setGreetings(v) {
  const next = {};
  for (const kind of GREETING_KINDS) next[kind] = cleanGreeting(kind, v?.[kind]);
  /*
    Where a test goes: a private channel, so trying a card out is not a post
    the whole server sees. Empty, a test goes where the real one would.
  */
  next.testChannelId = cleanChannel(v?.testChannelId);
  greetings.set(next);
  return getGreetings();
}

function pickMessage(messages) {
  if (!messages?.length) return null;
  return messages[Math.floor(Math.random() * messages.length)];
}

const CARD_FILE = 'welcome.png';

/**
 * The welcome or goodbye post for somebody, or null when there is nothing to
 * post.
 *
 * A card counts on its own. It used to be sent only alongside a text line, so
 * a welcome set up as a card with no line — the natural way to set one up —
 * posted nothing at all, and a goodbye card was never sent even with one.
 *
 * `{user}` is a real mention where Discord draws one: in the text line and
 * the card's description, for somebody arriving. In a card's title and footer
 * Discord shows a mention as raw markup, and somebody who has left cannot be
 * mentioned, so there it is their name. Names are escaped: display names are
 * whatever a stranger typed.
 *
 * `context` fills the rest: { server, count, boosts }.
 */
export function greetingFor(cfg, user, arriving, withPicture = false, context = {}) {
  if (!cfg) return null;
  const name = discord.sanitise(context.name || user?.global_name || user?.username || 'Someone');
  const mention = arriving && user?.id ? `<@${user.id}>` : '';
  const base = { ...context, name, id: user?.id, server: context.server ? discord.sanitise(context.server) : '' };
  const fill = (text, withMention) => fillGreeting(text, { ...base, mention: withMention ? mention : '' });

  // The list the screen edits, or the single line an older setup kept.
  const template = pickMessage(cfg.messages) || (cfg.message ? String(cfg.message) : '');
  const content = template ? fill(template, true) : '';

  const embed = cfg.sendCard
    ? {
      title: fill(cfg.cardTitle, false) || undefined,
      description: fill(cfg.cardDescription, true) || undefined,
      footer: fill(cfg.cardFooter, false) || undefined,
      color: cfg.cardColor,
      // The picture card, when there is one, is the embed's big picture.
      image: withPicture ? `attachment://${CARD_FILE}` : cfg.cardImage,
      thumbnail: cfg.cardThumbnail && user?.id && user?.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
    }
    : undefined;
  const cardHasSomething = embed && (embed.title || embed.description || embed.footer || embed.image);

  if (!content && !cardHasSomething && !withPicture) return null;
  return { content, embed: cardHasSomething || (embed && withPicture) ? embed : undefined };
}

/*
  The server, as the posts need it: its name, how many are in it, and its
  owner — who stands in for the newcomer in a test. Asked of Discord at most
  once a minute.
*/
let guildSeen = { at: 0, id: '', info: null };
async function guildInfo(guildId, fresh = false) {
  if (!fresh && guildSeen.id === guildId && Date.now() - guildSeen.at < 60000) return guildSeen.info;
  try {
    const g = await discord.request('GET', `/guilds/${guildId}?with_counts=true`);
    guildSeen = {
      at: Date.now(),
      id: guildId,
      info: {
        name: g?.name || '',
        count: g?.approximate_member_count,
        boosts: g?.premium_subscription_count ?? 0,
        ownerId: g?.owner_id || '',
        icon: g?.icon ? `https://cdn.discordapp.com/icons/${guildId}/${g.icon}.png?size=256` : '',
      },
    };
  } catch (err) {
    log.debug(`could not read the server: ${err.message}`);
  }
  return guildSeen.id === guildId ? guildSeen.info : null;
}

/** Everything a post fills in that is about the server rather than them. */
async function contextFor(guildId, fresh = false) {
  const g = (guildId && await guildInfo(guildId, fresh)) || {};
  const cached = discord.getCache?.()?.guilds?.find((x) => x.id === guildId);
  return { server: g.name || cached?.name || '', count: g.count, boosts: g.boosts, serverIcon: g.icon || '' };
}

/** The server's name and icon, for the dashboard's preview of a card. */
export async function previewFacts() {
  const guildId = discord.getSettings?.().guildId;
  if (!guildId || discord.getStatus?.().status !== 'connected') return {};
  const g = await guildInfo(guildId);
  return { ...(g?.name ? { server: g.name } : {}), ...(g?.icon ? { serverIcon: g.icon } : {}) };
}

const hex = (n) => (Number.isFinite(n) && n > 0 ? `#${n.toString(16).padStart(6, '0')}` : '');

/**
 * Who a post is about, as the card draws them: their name in this server,
 * the avatar they use here, their top role's colour — the roles they are
 * being given counted too, so a newcomer's auto-role colours them — and, when
 * the card asks for it, the banner and colour on their profile, which only a
 * second request for the person carries.
 */
export async function personFor(card, user, member, guildId, givenRoles = []) {
  const id = user?.id;
  const avatar = member?.avatar && guildId
    ? `https://cdn.discordapp.com/guilds/${guildId}/users/${id}/avatars/${member.avatar}.png?size=256`
    : id && user?.avatar ? `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.png?size=256` : undefined;
  const held = new Set([...(member?.roles || []), ...givenRoles]);
  const top = (discord.getCache?.()?.roles || [])
    .filter((r) => held.has(r.id) && r.color)
    .sort((a, b) => (b.position || 0) - (a.position || 0))[0];
  const person = {
    name: member?.nick || user?.global_name || user?.username || 'Someone',
    avatar,
    roleColour: top ? hex(top.color) : '',
  };
  const wantsProfile = card?.backdrop || /--their-accent/.test(card?.css || '');
  if (wantsProfile && id) {
    const profile = await discord.request('GET', `/users/${id}`).catch(() => null);
    // A moving banner is served as its first frame: a card is a still picture.
    if (profile?.banner) person.banner = `https://cdn.discordapp.com/banners/${id}/${profile.banner}.png?size=1024`;
    if (profile?.accent_color) person.accentColour = hex(profile.accent_color);
  }
  return person;
}

/**
 * The picture card for somebody, when it is switched on: the PNG to attach,
 * or null. A card that cannot be drawn is logged and left out — the post
 * still goes.
 */
async function pictureFor(cfg, person, user, context) {
  if (!cfg.image?.enabled) return null;
  try {
    const { png } = await renderCard(cfg.image, person, { ...context, id: user?.id });
    return { name: CARD_FILE, data: png, type: 'image/png' };
  } catch (err) {
    log.warn(`could not draw the card: ${err.message}`);
    return null;
  }
}

/**
 * The embed's large picture when it is an upload (/media/…), as a file to
 * send with the post: Discord cannot reach this server to fetch it. Named by
 * what the picture really is. Null when the file is gone or too big — the
 * post then goes without it rather than not at all.
 */
const UPLOAD_MAX = 10 * 1024 * 1024;
export function uploadedPicture(src) {
  try {
    const data = fs.readFileSync(path.join(config.assetsDir, path.basename(decodeURIComponent(String(src)))));
    if (data.length > UPLOAD_MAX) return null;
    const ext = kindOfBytes(data) || (path.extname(String(src)).slice(1).toLowerCase() || 'png');
    const type = { jpg: 'image/jpeg', svg: 'image/svg+xml' }[ext] || `image/${ext}`;
    return { name: `picture.${ext}`, data, type };
  } catch {
    return null;
  }
}

/**
 * A post's buttons as Discord message components: rows of up to five. A link
 * opens its address; a role button is pressed like one on a button menu
 * (custom id `role:<id>`, handled in discord-roles.js), so anybody can pick
 * the role up or put it down. `linksOnly` is for a direct message, where a
 * role button would have no server to give the role in.
 */
export function greetingButtonRows(buttons, { linksOnly = false } = {}) {
  const usable = (buttons || []).filter((b) => !linksOnly || b.kind === 'link');
  const emoji = (raw) => {
    const custom = /^<(a?):([^:]+):(\d+)>$/.exec(raw || '');
    return custom ? { id: custom[3], name: custom[2], animated: custom[1] === 'a' } : raw ? { name: raw } : undefined;
  };
  const rows = [];
  for (let i = 0; i < usable.length; i += 5) {
    rows.push({
      type: 1,
      components: usable.slice(i, i + 5).map((b) => ({
        type: 2,
        ...(b.kind === 'link' ? { style: 5, url: b.url } : { style: b.style || 2, custom_id: `role:${b.roleId}` }),
        ...(b.label ? { label: b.label } : {}),
        ...(emoji(b.emoji) ? { emoji: emoji(b.emoji) } : {}),
      })),
    });
  }
  return rows;
}

/**
 * Post one kind of greeting about somebody: the line, the embed, the card,
 * the buttons and the reaction. Answers what was posted — the message, and
 * the picture and words made for it, which a direct message reuses — or null
 * when there was nothing to post. Failures are thrown, for a test to report;
 * the gateway's handlers log them.
 */
async function post(kind, cfg, user, guildId, { arriving, member = null, givenRoles = [], fresh = false }) {
  if (!cfg.channelId) return null;
  const context = await contextFor(guildId, fresh);
  const person = await personFor(cfg.image, user, member, guildId, givenRoles);
  const picture = await pictureFor(cfg, person, user, context);
  const message = greetingFor(cfg, user, arriving, Boolean(picture), { ...context, name: person.name });
  if (!message) return null;
  const files = picture ? [picture] : [];
  if (String(message.embed?.image || '').startsWith('/media/')) {
    const upload = uploadedPicture(message.embed.image);
    if (upload) {
      files.push(upload);
      message.embed.image = `attachment://${upload.name}`;
    } else {
      log.warn(`the ${kind} post's large picture ${message.embed.image} could not be read; posting without it`);
      delete message.embed.image;
    }
  }
  const sent = await discord.sendMessage(cfg.channelId, message.content, message.embed, greetingButtonRows(cfg.buttons), files.length ? files : undefined);
  /*
    The reaction, under the post: one click for everybody else to say hi with.
    A reaction that fails — an emoji from another server, no permission —
    costs nothing but itself.
  */
  if (cfg.react && sent?.id) {
    await discord.addReaction(cfg.channelId, sent.id, cfg.react)
      .catch((err) => log.warn(`could not react to the ${kind} post: ${err.message}`));
  }
  return { sent, picture, context, person };
}

/**
 * The welcome's direct message: one of its own lines, the card if it was
 * asked for, the link buttons. To `channelId` when given — a test, posted
 * where tests go — and otherwise to the person, in a DM the bot opens.
 * Plenty of people take no messages from servers; that is theirs to choose,
 * and only logged.
 */
async function sendDm(cfg, user, made, channelId = '') {
  const dm = cfg.dm;
  if (!dm?.enabled || !user?.id) return null;
  const chosen = pickMessage(dm.messages);
  const content = chosen
    ? fillGreeting(chosen, { ...made.context, server: discord.sanitise(made.context.server || ''), name: discord.sanitise(made.person.name), id: user.id, mention: `<@${user.id}>` })
    : '';
  const picture = dm.picture ? made.picture : null;
  if (!content && !picture) return null;
  const to = channelId || (await discord.request('POST', '/users/@me/channels', { body: { recipient_id: user.id } }))?.id;
  if (!to) return null;
  return discord.sendMessage(to, content, undefined, dm.links ? greetingButtonRows(cfg.buttons, { linksOnly: true }) : undefined, picture ? [picture] : undefined);
}

/**
 * Whether a join or leave belongs to the server this app looks after. The bot
 * may sit in others, and their members are not ours to welcome or rename.
 * Bots are not greeted either: a welcome to a music bot is noise.
 */
function ours(d) {
  const guildId = discord.getSettings?.().guildId;
  if (guildId && d?.guild_id && d.guild_id !== guildId) return false;
  return !d?.user?.bot;
}

async function onMemberJoin(d) {
  const cfg = getGreetings().welcome;
  if (!cfg?.enabled || !ours(d)) return;
  const user = d.user || {};

  if (cfg.autoRoleId && d.guild_id) {
    await discord.addRole(d.guild_id, user.id, cfg.autoRoleId)
      .catch((err) => log.warn(`auto-role failed: ${err.message}`));
  }
  // The join is the member: their roles, nickname and server avatar, and the auto-role they were just given.
  const made = await post('welcome', cfg, user, d.guild_id, { arriving: true, member: d, givenRoles: cfg.autoRoleId ? [cfg.autoRoleId] : [] })
    .catch((err) => { log.warn(`welcome message failed: ${err.message}`); return null; });
  if (made) {
    await sendDm(cfg, user, made)
      .catch((err) => log.info(`could not message ${user.username || user.id} directly: ${err.message}`));
  }
}

/*
  Who was banned a moment ago. A ban is a leave as well — Discord sends both,
  in either order — so with the ban post on, a leave waits a moment to hear
  of a ban and leaves it to that post.
*/
const banned = new Map();
const BAN_WAIT_MS = 2000;
const bannedLately = (id) => Date.now() - (banned.get(id) || 0) < 60000;

async function onMemberLeave(d) {
  const cfg = getGreetings().goodbye;
  if (!cfg?.enabled || !ours(d)) return;
  if (getGreetings().ban.enabled) {
    await new Promise((r) => setTimeout(r, BAN_WAIT_MS));
    if (bannedLately(d.user?.id)) return;
  }
  await post('goodbye', cfg, d.user || {}, d.guild_id, { arriving: false })
    .catch((err) => log.warn(`goodbye message failed: ${err.message}`));
}

async function onMemberBan(d) {
  if (!ours(d) || !d?.user?.id) return;
  banned.set(d.user.id, Date.now());
  if (banned.size > 200) banned.delete(banned.keys().next().value);
  const cfg = getGreetings().ban;
  if (!cfg?.enabled) return;
  // Not a mention: nobody wants a ping about their own ban, and they cannot see it.
  await post('ban', cfg, d.user, d.guild_id, { arriving: false })
    .catch((err) => log.warn(`ban message failed: ${err.message}`));
}

/*
  A boost is seen as a member update whose boosting-since time is new. The
  same update also arrives for a nickname or a role, so only a boost that
  started in the last few minutes counts, once per person and boost. A second
  boost from somebody already boosting does not move that time, so it goes
  unannounced here — Discord's own boost message still says it.
*/
const BOOST_FRESH_MS = 5 * 60 * 1000;
const boosted = new Set();

async function onMemberUpdate(d) {
  const since = d?.premium_since ? Date.parse(d.premium_since) : NaN;
  if (!Number.isFinite(since) || Date.now() - since > BOOST_FRESH_MS || !ours(d)) return;
  const key = `${d.user?.id}:${d.premium_since}`;
  if (boosted.has(key)) return;
  boosted.add(key);
  // Asked afresh: the count of boosts has just changed. The event first, for actions; then the post, when it is on.
  await guildInfo(d.guild_id, true);
  await announce('discord_boost', d).catch(() => {});
  const cfg = getGreetings().boost;
  if (!cfg?.enabled) return;
  await post('boost', cfg, d.user || {}, d.guild_id, { arriving: true, member: d })
    .catch((err) => log.warn(`boost message failed: ${err.message}`));
}

/**
 * Post a greeting now, as it would go for a real one — with the settings on
 * screen rather than the saved ones, so a change can be tried before it is
 * saved. The server's owner stands in for the person (the bot, if the owner
 * cannot be read). Nobody is given a role. A welcome's direct message goes to
 * the test channel too when there is one, and otherwise to the owner.
 */
export async function testGreeting(kind, incoming, testChannelId) {
  if (!GREETING_KINDS.includes(kind)) throw refusal('welcome_unknown_kind', `there is no "${kind}" greeting`);
  if (discord.getStatus().status !== 'connected') throw refusal('discord_offline', 'The Discord bot is not connected');
  const guildId = discord.getSettings().guildId;
  if (!guildId) throw refusal('welcome_no_server', 'No Discord server is chosen yet');
  const cfg = cleanGreeting(kind, incoming ?? getGreetings()[kind]);
  // To the test channel when one is chosen, so a test is not a post the whole server sees.
  const testChannel = cleanChannel(testChannelId ?? getGreetings().testChannelId);
  if (testChannel) cfg.channelId = testChannel;
  if (!cfg.channelId) throw refusal('welcome_no_channel', 'Choose a channel for it first');

  const info = await guildInfo(guildId);
  // The owner as a member of the server, so their roles and server avatar show as a real member's would.
  const member = info?.ownerId ? await discord.request('GET', `/guilds/${guildId}/members/${info.ownerId}`).catch(() => null) : null;
  const user = member?.user || (await discord.request('GET', '/users/@me').catch(() => null)) || {};

  const made = await post(kind, cfg, user, guildId, { arriving: kind === 'welcome' || kind === 'boost', member, fresh: kind === 'boost' });
  if (!made) throw refusal('welcome_nothing', 'There is nothing to post: add a message line, the embed or the picture card');
  let dm = '';
  if (kind === 'welcome' && cfg.dm?.enabled) {
    const sentDm = await sendDm(cfg, user, made, testChannel).catch((err) => { log.info(`test DM failed: ${err.message}`); return null; });
    dm = sentDm ? (testChannel ? 'channel' : 'sent') : 'failed';
  }
  return { ok: true, as: member?.nick || user.global_name || user.username || '', channelId: cfg.channelId, messageId: made.sent?.id || '', dm };
}
