/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Going live, told privately: viewers who ask for it get a direct message
 * from the bot when the stream starts, with a link to where they like to
 * watch — Twitch, YouTube or TikTok — instead of the whole server being
 * pinged. They ask with a button on a sign-up post in Discord, choosing the
 * platform; a button on every message stops them.
 *
 * Sent once a stream, a little after it starts (as the go-live post waits for
 * Twitch to show it live), one message a second so Discord does not take it
 * for spam. Somebody whose messages cannot be delivered three times running
 * — their direct messages are closed — is taken off the list.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import { refusal } from '../core/refusal.js';
import * as discord from '../platforms/discord.js';
import * as twitch from '../platforms/twitch.js';
import * as sessions from './stream-sessions.js';
import { getAnnounce } from './announce.js';
import { getGreetings } from './welcome.js';

const log = createLogger('live-dms');

export const DM_PLATFORMS = ['twitch', 'youtube', 'tiktok'];
const NAMES = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok' };
const EMOJI = { twitch: '💜', youtube: '❤️', tiktok: '🎵' };
export const DEFAULT_LIVE_DMS = {
  enabled: false,
  /** Seconds after OBS starts streaming, so the link works when it lands. */
  delaySec: 60,
  /** The words of the message. {streamer}, {title}, {game}, {platform}. */
  message: '🔴 ¡{streamer} está en directo! {title}',
  /** The sign-up post, once posted. */
  post: { channelId: '', messageId: '' },
};
const GIVE_UP_AFTER = 3;
const EVERY_MS = 1_000;

let store = null;
let timer = null;
let sending = false;

export function cleanLiveDms(c = {}, before = DEFAULT_LIVE_DMS) {
  const x = { ...before, ...(c && typeof c === 'object' ? c : {}) };
  const d = Number(x.delaySec);
  return {
    enabled: x.enabled === true,
    delaySec: Number.isFinite(d) ? Math.min(600, Math.max(0, Math.round(d))) : DEFAULT_LIVE_DMS.delaySec,
    message: String(x.message ?? '').slice(0, 300) || DEFAULT_LIVE_DMS.message,
    post: {
      channelId: /^\d{5,25}$/.test(String(x.post?.channelId || '')) ? String(x.post.channelId) : '',
      messageId: /^\d{5,25}$/.test(String(x.post?.messageId || '')) ? String(x.post.messageId) : '',
    },
  };
}
export const getLiveDms = () => cleanLiveDms(store?.get().settings || {});
const people = () => store.get().people || {};

function publish() {
  bus.emit(EVENTS.CONFIG, { key: 'liveDms', value: { ...getLiveDms(), count: Object.keys(people()).length } });
}

/** Where somebody watches, as a link: the Go live screen's links, Twitch's own when there is no other. */
export function linkFor(platform, cfg = getAnnounce()) {
  const login = twitch.getCredentials?.()?.login;
  const twitchUrl = login ? `https://twitch.tv/${login}` : '';
  if (platform === 'youtube' && cfg.youtubeUrl) return cfg.youtubeUrl;
  if (platform === 'tiktok' && cfg.tiktokUrl) return cfg.tiktokUrl;
  return twitchUrl || cfg.youtubeUrl || cfg.tiktokUrl || '';
}

/** The platforms a viewer can choose: the ones there is a link for. */
export function choices(cfg = getAnnounce()) {
  return DM_PLATFORMS.filter((p) => p === 'twitch' ? Boolean(twitch.getCredentials?.()?.login) : Boolean(p === 'youtube' ? cfg.youtubeUrl : cfg.tiktokUrl));
}

/** The direct message: words, the link as a button, and a way to stop. */
export function dmFor(platform, info = {}, cfg = getLiveDms()) {
  const url = linkFor(platform);
  const words = cfg.message
    .replace(/\{streamer\}/g, info.name || 'El directo')
    .replace(/\{title\}/g, info.title || '')
    .replace(/\{game\}/g, info.game || '')
    .replace(/\{platform\}/g, NAMES[platform] || 'Twitch')
    .trim();
  return {
    content: words,
    components: [{ type: 1, components: [
      ...(url ? [{ type: 2, style: 5, label: `Ver en ${NAMES[platform] || 'Twitch'}`, url }] : []),
      { type: 2, style: 2, label: 'Dejar de avisarme', custom_id: 'livedm:stop' },
    ] }],
  };
}

/** The sign-up post: what it is for, a button per platform there is a link for, and one to stop. */
export function signUpPost() {
  const can = choices();
  const buttons = can.map((p) => ({ type: 2, style: 1, label: NAMES[p], emoji: { name: EMOJI[p] }, custom_id: `livedm:on:${p}` }));
  buttons.push({ type: 2, style: 2, label: 'Ya no', custom_id: 'livedm:stop' });
  return {
    embed: {
      title: '🔔 Avísame cuando empiece el directo',
      description: 'Elige dónde lo ves y te escribo por mensaje privado cuando empiece, con el link. Sin pings a todo el servidor.',
      color: '#5865f2',
    },
    components: [{ type: 1, components: buttons.slice(0, 5) }],
  };
}

/** Post the sign-up message, or bring the one already there up to date. */
export async function postSignUp(channelId) {
  const cfg = getLiveDms();
  const where = /^\d{5,25}$/.test(String(channelId || '')) ? String(channelId) : cfg.post.channelId;
  if (!where) throw refusal('live_dms_no_channel', 'choose a channel for the sign-up post first');
  if (!choices().length) throw refusal('live_dms_no_links', 'connect Twitch, or give a YouTube or TikTok link on the Go live screen');
  const { embed, components } = signUpPost();
  if (where === cfg.post.channelId && cfg.post.messageId) {
    try {
      await discord.editMessage(where, cfg.post.messageId, '', embed, components);
      return { done: 'updated' };
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }
  const sent = await discord.sendMessage(where, '', embed, components);
  store.update((v) => ({ ...v, settings: { ...getLiveDms(), post: { channelId: where, messageId: String(sent?.id || '') } } }));
  publish();
  return { done: 'posted' };
}

const respond = (i, content) => discord.request('POST', `/interactions/${i.id}/${i.token}/callback`, { body: { type: 4, data: { content, flags: 64 } } });

/** A button: on (with a platform) or stop — from the sign-up post or from a message itself. */
async function onInteraction(i) {
  const id = i?.data?.custom_id || '';
  if (!id.startsWith('livedm:')) return;
  const user = i.member?.user || i.user;
  if (!user?.id) return;
  const [, what, platform] = id.split(':');
  if (what === 'on' && DM_PLATFORMS.includes(platform)) {
    store.update((v) => ({ ...v, people: { ...(v.people || {}), [user.id]: { platform, at: Date.now(), name: i.member?.nick || user.global_name || user.username || '', failed: 0 } } }));
    publish();
    await respond(i, `🔔 Listo: te escribo cuando empiece, con el link de ${NAMES[platform]}.`);
    return;
  }
  if (what === 'stop') {
    store.update((v) => {
      const next = { ...(v.people || {}) };
      delete next[user.id];
      return { ...v, people: next };
    });
    publish();
    // In a direct message the reply is the message's own: no ephemeral there, but nobody else sees it either.
    await respond(i, '🔕 Ya no te aviso. Puedes volver a pedirlo cuando quieras.');
  }
}

/** Everybody on the list, one a second: a direct message with their link. */
export async function sendAll(info = {}, { wait = EVERY_MS } = {}) {
  if (sending) return { sent: 0, failed: 0 };
  sending = true;
  let sent = 0;
  let failed = 0;
  try {
    for (const [userId, p] of Object.entries(people())) {
      const dm = dmFor(p.platform, info);
      try {
        const channel = await discord.request('POST', '/users/@me/channels', { body: { recipient_id: userId } });
        await discord.sendMessage(channel?.id, dm.content, null, dm.components, undefined, { allowed_mentions: { parse: [] } });
        sent += 1;
        if (p.failed) store.update((v) => ({ ...v, people: { ...v.people, [userId]: { ...v.people[userId], failed: 0 } } }));
      } catch (err) {
        failed += 1;
        const times = (p.failed || 0) + 1;
        store.update((v) => {
          const next = { ...(v.people || {}) };
          if (times >= GIVE_UP_AFTER) delete next[userId];
          else next[userId] = { ...p, failed: times };
          return { ...v, people: next };
        });
        log.debug(`could not tell ${p.name || userId}: ${err.message}`);
      }
      if (wait) await new Promise((r) => setTimeout(r, wait));
    }
  } finally {
    sending = false;
  }
  store.update((v) => ({ ...v, last: { at: Date.now(), sent, failed } }));
  publish();
  log.info(`going live told privately: ${sent} sent, ${failed} could not be delivered`);
  return { sent, failed };
}

/** A stream started: once it has had its moment to show up on Twitch, tell everybody on the list. */
function onStarted(s) {
  const cfg = getLiveDms();
  if (!cfg.enabled || !Object.keys(people()).length) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    // Still the same stream, still on, and not already told.
    const now = sessions.current();
    if (!now || now.id !== s.id || store.get().toldFor === s.id) return;
    store.update((v) => ({ ...v, toldFor: s.id }));
    const info = await twitch.getLiveInfo?.().catch(() => null);
    await sendAll({ name: info?.name || twitch.getCredentials?.()?.user?.display_name || '', title: info?.title || now.title || '', game: info?.game || now.game || '' });
  }, cfg.delaySec * 1000);
  timer.unref?.();
}

/** From the Go live screen: the settings, the sign-up post, or a test message to the test channel. */
export async function control(payload = {}) {
  if (payload.op === 'post') return postSignUp(payload.channelId);
  if (payload.op === 'test') {
    const channelId = getGreetings().testChannelId;
    if (!channelId) throw refusal('live_dms_no_test_channel', 'choose a test channel on the Welcome & Goodbye screen first');
    const info = await twitch.getLiveInfo?.().catch(() => null);
    const dm = dmFor(choices()[0] || 'twitch', { name: info?.name || 'El streamer', title: info?.title || 'Título del directo', game: info?.game || '' });
    await discord.sendMessage(channelId, dm.content, null, dm.components, undefined, { allowed_mentions: { parse: [] } });
    return { ok: true, channelId };
  }
  const next = cleanLiveDms({ ...getLiveDms(), ...(payload.settings || {}) });
  store.update((v) => ({ ...v, settings: next }));
  publish();
  return { ...next, count: Object.keys(people()).length };
}

export const snapshot = () => ({ liveDms: { ...getLiveDms(), count: Object.keys(people()).length, last: store?.get().last || null } });

export function initLiveDms() {
  store = collection('live_dms', { settings: {}, people: {}, toldFor: '', last: null });
  bus.on('stream:started', onStarted);
  bus.on('discord:interaction', (i) => { onInteraction(i).catch((err) => log.warn(`live DM button: ${err.message}`)); });
}

export const _test = { onInteraction, onStarted, people: () => people() };
