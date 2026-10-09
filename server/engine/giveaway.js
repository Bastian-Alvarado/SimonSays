/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The giveaway: one at a time, entered from every chat the app reads — the
 * keyword ("!sorteo") on Twitch, YouTube, TikTok, Kick or Discord — or with
 * the "Participar" button on its Discord post, and drawn live on stream.
 *
 * Bots that do giveaways do them in Discord, for Discord. This one is the
 * stream's: whoever is watching enters from wherever they watch, in one
 * pool, and the draw is a moment on the overlay (the Giveaway layer turns a
 * reel of names and stops on the winner) before chat and Discord are told.
 *
 * Rules, set on the Giveaways screen: subscribers only, a level to reach,
 * extra tickets for subscribers, a Discord role, which platforms count.
 * Entering is quiet — no answer in chat per entry — except the button, which
 * answers the person who pressed it, privately.
 *
 * Like the poll, two in a sense: the one running, and the draft the screen
 * is setting up next. Opening copies the draft over.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS, normaliseEvent } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as commands from './commands.js';
import * as discord from '../platforms/discord.js';
import * as leveling from '../leveling/index.js';
import { getRoleMappings } from './discord-roles.js';
import {
  cleanPrize, cleanKeyword, cleanDuration, cleanWinners, cleanRules, pickWinners,
  DEFAULT_GIVEAWAY_RULES, MAX_ENTRANTS,
} from '../../shared/giveaway.js';

const log = createLogger('giveaway');

const DEFAULT = {
  /** idle | open | closed (no more entries) | drawn (winners up). */
  mode: 'idle',
  prize: '',
  keyword: '!sorteo',
  durationMs: 0,
  winnersCount: 1,
  rules: DEFAULT_GIVEAWAY_RULES,
  draft: null,
  openedAt: null,
  closedAt: null,
  endsAt: null,
  /** platform:who → { name, platform, userId, avatar, tickets, at }. */
  entrants: {},
  winners: [],
  /** Who was drawn and passed over with a reroll: not drawn again. */
  passed: [],
  /** The latest draw: when, and the names the overlay's reel turns through before it stops. */
  drawAt: null,
  reel: [],
  /** The Discord post with the button. */
  post: null,
};

export const DEFAULT_GIVEAWAY_SETTINGS = {
  /** Say in Twitch chat when it opens and who won. */
  announce: true,
  /** Post it in Discord, with a button to enter. */
  postToDiscord: false,
  discordChannelId: '',
  /** Draw as soon as the clock runs out. */
  autoDraw: false,
};

/** How long the overlay's reel turns before the winner is told to chat and Discord. */
export const REEL_MS = 6000;
const PUBLISH_EVERY_MS = 300;
const REEL_NAMES = 30;

let state = null;
let settingsStore = null;
let deps = {};
let closeTimer = null;
let publishTimer = null;
let tellTimer = null;

const draftOf = (s) => {
  const d = s.draft && typeof s.draft === 'object' ? s.draft : s;
  return {
    prize: d.prize ?? '',
    keyword: d.keyword || '!sorteo',
    durationMs: d.durationMs ?? 0,
    winnersCount: d.winnersCount ?? 1,
    rules: cleanRules(d.rules || DEFAULT_GIVEAWAY_RULES),
  };
};

export const getSettings = () => cleanSettings(settingsStore?.get());

export function cleanSettings(v = {}, before = DEFAULT_GIVEAWAY_SETTINGS) {
  const c = { ...DEFAULT_GIVEAWAY_SETTINGS, ...before, ...(v && typeof v === 'object' ? v : {}) };
  return {
    announce: c.announce !== false,
    postToDiscord: c.postToDiscord === true,
    discordChannelId: /^\d{5,25}$/.test(String(c.discordChannelId ?? '')) ? String(c.discordChannelId) : '',
    autoDraw: c.autoDraw === true,
  };
}

/** What a surface is sent: the names entered (they typed it in public), not their ids. */
export function getState() {
  const s = state?.get() ?? DEFAULT;
  const list = Object.entries(s.entrants || {}).sort((a, b) => b[1].at - a[1].at);
  const byPlatform = {};
  let tickets = 0;
  for (const [, e] of list) {
    byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1;
    tickets += e.tickets || 1;
  }
  const { entrants: _e, passed: _p, ...rest } = s;
  return {
    ...rest,
    draft: draftOf(s),
    count: list.length,
    tickets,
    byPlatform,
    entrants: list.slice(0, 300).map(([key, e]) => ({ key, name: e.name, platform: e.platform, tickets: e.tickets || 1 })),
    serverNow: Date.now(),
  };
}

function announceState() {
  if (publishTimer) { clearTimeout(publishTimer); publishTimer = null; }
  bus.emit(EVENTS.CONFIG, { key: 'giveaway', value: getState() });
}

function publish(next) {
  state.set(next);
  state.flush();
  announceState();
  return getState();
}

function publishSoon(next) {
  state.set(next);
  if (!publishTimer) publishTimer = setTimeout(announceState, PUBLISH_EVERY_MS);
}

function say(text) {
  if (!text || !getSettings().announce || !deps.twitch?.say) return;
  Promise.resolve(deps.twitch.say(text.slice(0, 500), { useBot: true })).catch((err) => log.warn(`could not tell chat: ${err.message}`));
}

// ------------------------------------------------------------ words

const PLATFORM = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', kick: 'Kick', discord: 'Discord' };
const listed = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`);

/** What it asks of people, in a few words: "Solo suscriptores · Nivel 5+ · Los subs tienen 2 boletos". */
export function rulesLine(rules) {
  const r = cleanRules(rules);
  return [
    r.subsOnly && 'Solo suscriptores',
    r.minLevel > 0 && `Nivel ${r.minLevel}+`,
    !r.subsOnly && r.subLuck > 1 && `Los subs tienen ${r.subLuck} boletos`,
    r.platforms.length < 5 && `Desde ${listed(r.platforms.map((p) => PLATFORM[p] || p))}`,
  ].filter(Boolean).join(' · ');
}

export const openLine = (s) => `🎁 ¡Sorteo de ${s.prize}! Escribe ${s.keyword} para participar${rulesLine(s.rules) ? ` (${rulesLine(s.rules)})` : ''}.`;
export const winnerLine = (s, winners) => `🎉 ¡${listed(winners.map((w) => w.name))} ${winners.length === 1 ? 'ganó' : 'ganaron'} ${s.prize}! Felicidades.`;

// ------------------------------------------------------------ Discord

function postFor(s, phase) {
  const unix = s.endsAt ? Math.floor(s.endsAt / 1000) : null;
  const rules = rulesLine(s.rules);
  const count = Object.keys(s.entrants || {}).length;
  const winners = s.winners || [];
  const description = phase === 'open'
    ? `Escribe **${discord.sanitise(s.keyword)}** en el chat del directo, o pulsa **Participar**.${rules ? `\n${rules}` : ''}`
    : phase === 'closed'
      ? `Cerrado — ${count} ${count === 1 ? 'participante' : 'participantes'}. El ganador sale en el directo.`
      : `🎉 ${winners.length === 1 ? 'Ganador' : 'Ganadores'}: ${winners.map((w) => (w.platform === 'discord' && w.userId ? `<@${w.userId}>` : `**${discord.sanitise(w.name)}**`)).join(', ')}\nEntre ${count} ${count === 1 ? 'participante' : 'participantes'}.`;
  const embed = {
    title: `🎁 ${s.prize}`.slice(0, 256),
    description,
    color: phase === 'drawn' ? '#43b581' : '#f5a623',
    fields: [
      ...(phase === 'open' ? [{ name: 'Termina', value: unix ? `<t:${unix}:R>` : 'Cuando se cierre', inline: true }] : []),
      { name: s.winnersCount === 1 ? 'Ganador' : 'Ganadores', value: String(s.winnersCount), inline: true },
    ],
  };
  const components = [{ type: 1, components: [{ type: 2, style: 1, label: 'Participar', emoji: { name: '🎉' }, custom_id: `giveaway:enter:${s.openedAt}`, disabled: phase !== 'open' }] }];
  const pinged = phase === 'drawn' ? winners.filter((w) => w.platform === 'discord' && w.userId).map((w) => w.userId) : [];
  return { embed, components, allowed_mentions: { parse: [], users: pinged } };
}

async function postOpen(s) {
  const cfg = getSettings();
  if (!cfg.postToDiscord || !cfg.discordChannelId) return null;
  try {
    const p = postFor(s, 'open');
    const sent = await discord.sendMessage(cfg.discordChannelId, '', p.embed, p.components, undefined, { allowed_mentions: p.allowed_mentions });
    return sent?.id ? { channelId: cfg.discordChannelId, messageId: sent.id } : null;
  } catch (err) {
    log.warn(`could not post the giveaway in Discord: ${err.message}`);
    return null;
  }
}

function updatePost(s, phase) {
  if (!s.post?.messageId) return;
  const p = postFor(s, phase);
  Promise.resolve(discord.editMessage(s.post.channelId, s.post.messageId, '', p.embed, p.components, { allowed_mentions: p.allowed_mentions }))
    .catch((err) => log.warn(`could not update the giveaway post: ${err.message}`));
}

// ------------------------------------------------------------ entering

const subRoles = () => {
  const m = getRoleMappings() || {};
  return ['subscriberTier1', 'subscriberTier2', 'subscriberTier3'].map((k) => m[k]).filter(Boolean);
};

/**
 * One person entering. Answers why not (why): closed, already, platform,
 * subs_only, level, role, full — for the button's private answer, not a refusal.
 */
export function enter(person, now = Date.now()) {
  const s = state.get();
  if (s.mode !== 'open' || (s.endsAt && now >= s.endsAt)) return { ok: false, why: 'closed' };
  const platform = person.platform || 'chat';
  if (!s.rules.platforms.includes(platform)) return { ok: false, why: 'platform' };
  const name = String(person.name || '').trim();
  const id = person.userId || name.toLowerCase();
  if (!id) return { ok: false, why: 'closed' };
  const key = `${platform}:${id}`;
  if (s.entrants[key]) return { ok: false, why: 'already' };
  if (Object.keys(s.entrants).length >= MAX_ENTRANTS) return { ok: false, why: 'full' };
  if (s.rules.subsOnly && !person.isSub) return { ok: false, why: 'subs_only' };
  if (s.rules.minLevel > 0) {
    const level = leveling.findUser(platform, id)?.level ?? 0;
    if (level < s.rules.minLevel) return { ok: false, why: 'level', level: s.rules.minLevel };
  }
  if (platform === 'discord' && s.rules.discordRole && !(person.roles || []).includes(s.rules.discordRole)) return { ok: false, why: 'role' };
  const tickets = person.isSub ? s.rules.subLuck : 1;
  publishSoon({ ...s, entrants: { ...s.entrants, [key]: { name, platform, userId: person.userId || '', avatar: person.avatar || '', tickets, at: now } } });
  return { ok: true, tickets };
}

function onChat(chat) {
  const s = state?.get();
  if (!s || s.mode !== 'open' || !chat?.msg || chat.isBot || chat.isBroadcaster) return;
  const said = String(chat.msg).trim();
  if (said.split(/\s+/)[0].toLowerCase() !== s.keyword) return;
  // A command of the streamer's own on the same word answers instead.
  if (commands.ownCommandAnswers(collection('commands', []).get(), collection('actions', []).get(), said, chat.platform)) return;
  const roles = chat.raw?.roles || [];
  enter({ platform: chat.platform, userId: chat.userId, name: chat.user, avatar: chat.avatar, isSub: Boolean(chat.isSub) || (chat.platform === 'discord' && subRoles().some((r) => roles.includes(r))), roles });
}

const REPLIES = {
  ok: '¡Estás dentro del sorteo! 🍀',
  already: 'Ya estás dentro. ¡Suerte!',
  closed: 'Este sorteo ya está cerrado.',
  platform: 'Este sorteo no acepta entradas desde Discord.',
  subs_only: 'Este sorteo es solo para suscriptores.',
  role: 'Te falta el rol que pide este sorteo.',
  full: 'El sorteo está lleno.',
};

/** The "Participar" button on the Discord post, answered privately to whoever pressed it. */
export async function onInteraction(d) {
  const customId = d?.data?.custom_id || '';
  if (d?.type !== 3 || !customId.startsWith('giveaway:enter')) return null;
  const s = state.get();
  const member = d.member || {};
  const user = member.user || d.user || {};
  const roles = member.roles || [];
  // A button from a giveaway that has ended is not this one's.
  const result = customId !== `giveaway:enter:${s.openedAt}`
    ? { ok: false, why: 'closed' }
    : enter({
      platform: 'discord',
      userId: user.id,
      name: member.nick || user.global_name || user.username || '',
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : '',
      isSub: subRoles().some((r) => roles.includes(r)),
      roles,
    });
  const content = result.ok
    ? (result.tickets > 1 ? `¡Estás dentro del sorteo con ${result.tickets} boletos! 🍀` : REPLIES.ok)
    : result.why === 'level' ? `Necesitas nivel ${result.level} para entrar a este sorteo.` : REPLIES[result.why] || REPLIES.closed;
  await discord.request('POST', `/interactions/${d.id}/${d.token}/callback`, { body: { type: 4, data: { content, flags: 64 } } })
    .catch((err) => log.warn(`could not answer the button: ${err.message}`));
  return result;
}

// ------------------------------------------------------------ the clock and the draw

function scheduleClose(s) {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  if (s.mode !== 'open' || !s.endsAt) return;
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (state.get().mode !== 'open') return;
    close('time');
    if (getSettings().autoDraw) {
      try { draw(); } catch (err) { log.warn(`could not draw: ${err.message}`); }
    }
  }, Math.max(0, s.endsAt - Date.now()));
  closeTimer.unref?.();
}

function close(why) {
  const s = state.get();
  if (s.mode !== 'open') return getState();
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  if (publishTimer) { clearTimeout(publishTimer); publishTimer = null; }
  const next = { ...s, mode: 'closed', closedAt: Date.now(), endsAt: null };
  log.info(`giveaway closed (${why}): ${Object.keys(s.entrants).length} entered`);
  updatePost(next, 'closed');
  return publish(next);
}

/** A reel for the overlay: some of who entered, shuffled, stopping on the winners. */
function reelFor(entrants, winners, random = Math.random) {
  const names = Object.values(entrants).map((e) => e.name);
  for (let i = names.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return [...names.slice(0, REEL_NAMES), ...winners.map((w) => w.name)];
}

/**
 * Draw: closes it if open, picks the winners by their tickets, and puts them
 * up — the overlay turns its reel for a few seconds, then chat and Discord
 * are told, and an action can answer (giveaway_winner).
 */
export function draw({ reroll = false, random = Math.random } = {}) {
  let s = state.get();
  if (s.mode === 'idle') throw refusal('giveaway_none', 'there is no giveaway to draw');
  if (s.mode === 'open') { close('drawn'); s = state.get(); }
  const passed = reroll ? [...(s.passed || []), ...s.winners.slice(-1).map((w) => w.key)] : (s.passed || []);
  const keep = reroll ? s.winners.slice(0, -1) : [];
  const exclude = [...passed, ...keep.map((w) => w.key)];
  const picked = pickWinners(s.entrants, reroll ? 1 : s.winnersCount, exclude, random);
  if (!picked.length) throw refusal(Object.keys(s.entrants).length ? 'giveaway_nobody_left' : 'giveaway_empty', 'nobody to draw');
  const now = Date.now();
  const drawn = picked.map((w) => ({ key: w.key, name: w.name, platform: w.platform, userId: w.userId || '', avatar: w.avatar || '', at: now }));
  const next = { ...s, mode: 'drawn', winners: [...keep, ...drawn], passed, drawAt: now, reel: reelFor(s.entrants, drawn, random) };
  const shown = publish(next);
  log.info(`giveaway ${reroll ? 'rerolled' : 'drawn'}: ${drawn.map((w) => `${w.name} (${w.platform})`).join(', ')}`);

  // Told once the reel has stopped, so chat does not give it away first.
  if (tellTimer) clearTimeout(tellTimer);
  tellTimer = setTimeout(() => {
    tellTimer = null;
    const after = state.get();
    if (after.drawAt !== now) return;
    say(winnerLine(after, drawn));
    updatePost(after, 'drawn');
    for (const w of drawn) {
      bus.emit(EVENTS.EVENT, normaliseEvent({
        type: 'giveaway_winner',
        platform: w.platform,
        user: w.name,
        avatar: w.avatar || undefined,
        data: { prize: after.prize, entrants: Object.keys(after.entrants).length, reroll, userId: w.userId || '' },
      }));
    }
  }, deps.reelMs ?? REEL_MS);
  tellTimer.unref?.();
  return shown;
}

// ------------------------------------------------------------ requests

function withDraft(s, value) {
  if (!value || typeof value !== 'object') return s;
  const d = draftOf(s);
  return {
    ...s,
    draft: {
      prize: value.prize !== undefined ? cleanPrize(value.prize) : d.prize,
      keyword: value.keyword !== undefined ? cleanKeyword(value.keyword) : d.keyword,
      durationMs: value.durationMs !== undefined ? cleanDuration(value.durationMs) : d.durationMs,
      winnersCount: value.winnersCount !== undefined ? cleanWinners(value.winnersCount) : d.winnersCount,
      rules: value.rules !== undefined ? cleanRules({ ...d.rules, ...value.rules }) : d.rules,
    },
  };
}

/** Every way the giveaway can change. */
export async function control(op, value) {
  const s = state.get();
  switch (op) {
    case 'setDraft':
      return publish(withDraft(s, value));

    case 'open': {
      const next = withDraft(s, value);
      const d = draftOf(next);
      if (!d.prize) throw refusal('giveaway_no_prize', 'say what the prize is');
      if (s.mode === 'open') throw refusal('giveaway_running', 'a giveaway is already open');
      const now = Date.now();
      const opened = {
        ...next, ...d, mode: 'open', entrants: {}, winners: [], passed: [], reel: [], drawAt: null, post: null,
        openedAt: now, closedAt: null, endsAt: d.durationMs ? now + d.durationMs : null,
      };
      publish(opened);
      scheduleClose(opened);
      log.info(`giveaway opened: "${d.prize}", ${d.keyword}`);
      say(openLine(opened));
      const post = await postOpen(opened);
      if (post) publish({ ...state.get(), post });
      return getState();
    }

    case 'close':
      return close('closed');

    case 'draw':
      return draw();

    case 'reroll':
      if (s.mode !== 'drawn') throw refusal('giveaway_none', 'draw first');
      return draw({ reroll: true });

    /** Back to nothing on screen; the prize and rules stay, ready to run again. */
    case 'reset': {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      if (tellTimer) { clearTimeout(tellTimer); tellTimer = null; }
      if (s.mode === 'open') updatePost(s, 'closed');
      return publish({ ...s, mode: 'idle', entrants: {}, winners: [], passed: [], reel: [], drawAt: null, endsAt: null, post: null });
    }

    /** Take somebody out — a mod's call. */
    case 'remove': {
      if (!s.entrants[value]) return getState();
      const { [value]: _gone, ...entrants } = s.entrants;
      return publish({ ...s, entrants });
    }

    case 'settings': {
      const next = cleanSettings(value, getSettings());
      settingsStore.set(next);
      bus.emit(EVENTS.CONFIG, { key: 'giveawaySettings', value: next });
      return next;
    }

    default:
      throw new Error(`giveaway: unknown operation "${op}"`);
  }
}

/** For a step: open the one set up, with a prize if one is given. */
export async function openFromStep(prize) {
  const p = cleanPrize(prize);
  return control('open', p ? { prize: p } : undefined);
}

export function initGiveaway(d = {}) {
  deps = d;
  state = collection('giveaway', DEFAULT);
  settingsStore = collection('giveaway_settings', DEFAULT_GIVEAWAY_SETTINGS);
  const s = state.get();
  // A restart mid-giveaway keeps it; one whose time ran out while down closes now.
  if (s.mode === 'open' && s.endsAt) {
    if (s.endsAt <= Date.now()) close('time ran out while the server was down');
    else scheduleClose(s);
  }
  bus.on(EVENTS.CHAT, onChat);
  bus.on('discord:message_elsewhere', onChat);
  bus.on('discord:interaction', (i) => { onInteraction(i).catch((err) => log.warn(`giveaway button: ${err.message}`)); });
}

/** Tests only: a shorter reel, so a draw is told without waiting six seconds. */
export function useReelForTests(ms) {
  deps = { ...deps, reelMs: ms };
}

export function stopGiveaway() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  if (publishTimer) { clearTimeout(publishTimer); publishTimer = null; }
  if (tellTimer) { clearTimeout(tellTimer); tellTimer = null; }
}

export const snapshot = () => ({ giveaway: getState(), giveawaySettings: getSettings() });
