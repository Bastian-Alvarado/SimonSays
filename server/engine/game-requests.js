/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Game requests: a Discord channel where people suggest what to play becomes
 * a board. Each post is a request; the bot puts 👍 under it so voting is one
 * click, and counts the 👍 people give. The streamer sees them by votes on
 * the Requests screen and puts one in tonight's plan with a press; when that
 * step of the plan starts, the request is played — whoever asked is told in
 * Discord, and given points if points are on.
 *
 * Optionally the channel keeps a ranking of its own, one message edited in
 * place as votes come in. The requests already in the channel can be read in
 * when it is chosen, votes and all.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as discord from '../platforms/discord.js';
import * as leveling from '../leveling/index.js';
import * as plan from './plan.js';
import * as points from './points.js';

const log = createLogger('requests');

export const VOTE = '👍';
export const DEFAULT_REQUESTS = {
  channelId: '',
  /** A ranking message in the channel, edited as votes change. */
  ranking: false,
  /** Points for whoever asked, when their request is played. */
  playedPoints: 100,
  /** Tell them in Discord when it is played. */
  tell: true,
};
const MAX_REQUESTS = 300;
const RANKING_EVERY_MS = 30_000;

let store = null;
let rankingTimer = null;
let rankingDue = false;

export function cleanRequestSettings(c = {}) {
  const n = Math.round(Number(c.playedPoints));
  return {
    channelId: /^\d{5,25}$/.test(String(c.channelId || '')) ? String(c.channelId) : '',
    ranking: c.ranking === true,
    playedPoints: Number.isFinite(n) ? Math.min(100_000, Math.max(0, n)) : DEFAULT_REQUESTS.playedPoints,
    tell: c.tell !== false,
  };
}
export const getRequestSettings = () => cleanRequestSettings({ ...DEFAULT_REQUESTS, ...(store?.get().settings || {}) });
const all = () => store.get().requests || [];

/** The board, best first: open and planned ones by votes, then played, then dismissed. */
export function board() {
  const order = { planned: 0, open: 1, played: 2, dismissed: 3 };
  return all().slice().sort((a, b) => (order[a.status] - order[b.status]) || (b.votes - a.votes) || (a.at - b.at));
}

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'gameRequests', value: { settings: getRequestSettings(), requests: board() } });
  if (getRequestSettings().ranking) rankingDue = true;
}

function save(list) {
  store.update((v) => ({ ...v, requests: list.slice(-MAX_REQUESTS) }));
  publish();
}
const change = (id, patch) => save(all().map((r) => (r.id === id ? { ...r, ...patch } : r)));

/** A request from a Discord message: the words, who asked, when. */
function requestOf(m) {
  const name = m.member?.nick || m.author?.global_name || m.author?.username || '?';
  // The bot's own 👍 is the button, not a vote.
  const vote = (m.reactions || []).find((r) => r.emoji?.name === VOTE);
  return {
    id: String(m.id),
    text: String(m.content || '').trim().slice(0, 200),
    user: name,
    discordId: String(m.author?.id || ''),
    at: m.timestamp ? Date.parse(m.timestamp) : Date.now(),
    votes: vote ? Math.max(0, (vote.count || 0) - (vote.me ? 1 : 0)) : 0,
    status: 'open',
    ...namesOf(discord.mentionNames(m)),
  };
}

/** A request's mentions by name, for the screen; their codes stay in the words. */
const namesOf = (names) => (names ? { names } : {});

/** A post in the requests channel: a request, with the vote under it. */
function onMessage(chat) {
  const cfg = getRequestSettings();
  if (!cfg.channelId || chat?.raw?.channelId !== cfg.channelId || chat.isBot || !chat.userId) return;
  const text = String(chat.msg || '').trim();
  if (!text || /^[!?]/.test(text)) return;
  const id = String(chat.raw?.messageId || chat.id);
  if (all().some((r) => r.id === id)) return;
  save([...all(), { id, text: text.slice(0, 200), user: chat.user, discordId: String(chat.userId), at: Date.now(), votes: 0, status: 'open', ...namesOf(chat.names) }]);
  discord.addReaction(cfg.channelId, id, VOTE).catch(() => {});
  log.info(`game request from ${chat.user}: ${text.slice(0, 60)}`);
}

function onReaction(d, delta) {
  if (d?.emoji?.name !== VOTE) return;
  const r = all().find((x) => x.id === String(d.message_id));
  if (!r) return;
  change(r.id, { votes: Math.max(0, r.votes + delta) });
}

/** Read the requests already in the channel: its newest messages, with their votes. */
export async function readChannel() {
  const cfg = getRequestSettings();
  if (!cfg.channelId) throw refusal('requests_no_channel', 'choose the requests channel first');
  const raw = (await discord.listMessages(cfg.channelId, 100)) || [];
  const known = new Set(all().map((r) => r.id));
  const fresh = raw.filter((m) => !m.author?.bot && !m.webhook_id && (m.type === 0 || m.type === 19) && String(m.content || '').trim() && !/^[!?]/.test(m.content.trim()) && !known.has(String(m.id)))
    .map(requestOf);
  // Votes on the ones already known, as Discord counts them now.
  const counts = new Map(raw.map((m) => [String(m.id), requestOf(m).votes]));
  save([...all().map((r) => (counts.has(r.id) ? { ...r, votes: counts.get(r.id) } : r)), ...fresh]);
  for (const r of fresh) discord.addReaction(cfg.channelId, r.id, VOTE).catch(() => {});
  return { read: fresh.length, total: all().length };
}

/** Into tonight's plan: as the next activity, or at the end. */
export function planIt(id, where = 'end') {
  const r = all().find((x) => x.id === id);
  if (!r) throw refusal('request_missing', 'that request is gone');
  const before = new Set(plan.getPlan().items.map((i) => i.id));
  const after = plan.service.add(r.text, `Pedido por ${r.user}`, where === 'next' ? 'next' : undefined);
  const item = after?.items?.find((i) => !before.has(i.id));
  if (!item) throw refusal('plan_full', 'the plan is full');
  change(id, { status: 'planned', planItemId: item.id });
  return { planItemId: item.id };
}

/** Played: whoever asked is told, and given points. */
export async function played(id) {
  const r = all().find((x) => x.id === id);
  if (!r || r.status === 'played') return { ok: false };
  const cfg = getRequestSettings();
  change(id, { status: 'played', playedAt: Date.now() });
  if (cfg.playedPoints && r.discordId) {
    const uid = leveling.personFor('discord', r.discordId, r.user);
    points.add(uid, cfg.playedPoints, `request played: ${r.text.slice(0, 30)}`, { now: true, name: r.user });
  }
  if (cfg.tell && cfg.channelId && r.discordId) {
    const unit = points.getPoints();
    const extra = cfg.playedPoints ? ` (+${cfg.playedPoints} ${unit.emoji && !/^<a?:/.test(unit.emoji) ? unit.emoji : unit.name})` : '';
    await discord.sendMessage(cfg.channelId, `🎮 <@${r.discordId}> ¡se está jugando tu petición!${extra}`, null, null, undefined, {
      allowed_mentions: { users: [r.discordId] },
      message_reference: { message_id: r.id, fail_if_not_exists: false },
    }).catch((err) => log.warn(`could not tell ${r.user}: ${err.message}`));
  }
  return { ok: true };
}

/** The plan moved: a planned request whose step has started is played. */
function onPlan(p) {
  const started = new Set((p?.items || []).filter((i) => typeof i.startedAt === 'number').map((i) => i.id));
  for (const r of all()) {
    if (r.status === 'planned' && r.planItemId && started.has(r.planItemId)) played(r.id).catch(() => {});
  }
}

/** The ranking message in the channel: the top ten still to play, by votes. */
export function rankingMessage() {
  const top = board().filter((r) => r.status === 'open' || r.status === 'planned').slice(0, 10);
  const lines = top.map((r, i) => `**${i + 1}.** ${discord.sanitise(r.text, 80)} — ${VOTE} ${r.votes}${r.status === 'planned' ? ' · 📋 en el plan' : ''}`);
  return { title: '🏆 Peticiones más votadas', description: lines.join('\n') || 'Todavía no hay peticiones.', color: '#f5a623', footer: `Vota con ${VOTE} en cada petición` };
}

async function updateRanking() {
  if (!rankingDue) return;
  rankingDue = false;
  const cfg = getRequestSettings();
  if (!cfg.ranking || !cfg.channelId) return;
  const at = store.get().rankingMessage;
  const embed = rankingMessage();
  try {
    if (at?.channelId === cfg.channelId && at.messageId) {
      await discord.editMessage(cfg.channelId, at.messageId, '', embed, undefined, { allowed_mentions: { parse: [] } });
      return;
    }
  } catch (err) {
    if (err.status !== 404) { log.warn(`ranking: ${err.message}`); return; }
  }
  const sent = await discord.sendMessage(cfg.channelId, '', embed, undefined, undefined, { allowed_mentions: { parse: [] } }).catch(() => null);
  if (sent?.id) store.update((v) => ({ ...v, rankingMessage: { channelId: cfg.channelId, messageId: String(sent.id) } }));
}

/** From the Requests screen. */
export async function control(payload = {}) {
  switch (payload.op) {
    case 'settings': {
      const next = cleanRequestSettings({ ...getRequestSettings(), ...(payload.settings || {}) });
      store.update((v) => ({ ...v, settings: next }));
      publish();
      return next;
    }
    case 'read': return readChannel();
    case 'plan': return planIt(String(payload.id || ''), payload.where);
    case 'played': return played(String(payload.id || ''));
    case 'dismiss': change(String(payload.id || ''), { status: 'dismissed' }); return { ok: true };
    case 'reopen': change(String(payload.id || ''), { status: 'open' }); return { ok: true };
    case 'remove': save(all().filter((r) => r.id !== String(payload.id || ''))); return { ok: true };
    default: throw new Error(`unknown requests operation "${payload.op}"`);
  }
}

export const snapshot = () => ({ gameRequests: { settings: getRequestSettings(), requests: board() } });

export function initGameRequests() {
  store = collection('game_requests', { settings: DEFAULT_REQUESTS, requests: [], rankingMessage: null });
  bus.on('discord:message_elsewhere', onMessage);
  bus.on(EVENTS.CHAT, (c) => { if (c?.platform === 'discord') onMessage(c); });
  bus.on('discord:reaction_add', (d) => onReaction(d, 1));
  bus.on('discord:reaction_remove', (d) => onReaction(d, -1));
  bus.on(EVENTS.CONFIG, (c) => { if (c?.key === 'plan') onPlan(c.value); });
  bus.on('plan:step_started', (item) => onPlan({ items: [{ ...item, startedAt: item?.startedAt || Date.now() }] }));
  clearInterval(rankingTimer);
  rankingTimer = setInterval(() => { updateRanking().catch(() => {}); }, RANKING_EVERY_MS);
  rankingTimer.unref?.();
}

export const _test = { onMessage, onReaction, onPlan, updateRanking: () => { rankingDue = true; return updateRanking(); } };
