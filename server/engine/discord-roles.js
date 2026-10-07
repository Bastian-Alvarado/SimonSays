/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord membership automation: reaction roles, button roles, and
 * welcome/goodbye messages.
 *
 * In V2 these were driven from the browser — a member who joined while the
 * dashboard was closed simply never got their welcome message or auto-role.
 * The gateway events are now consumed here.
 */

import { collection } from '../core/store.js';
import { bus, EVENTS } from '../core/bus.js';
import { createLogger } from '../core/logger.js';
import * as discord from '../platforms/discord.js';
import { initWelcome, getGreetings, setGreetings } from './welcome.js';

// Kept here for the callers that always found them here; the posts themselves live in welcome.js.
export { greetingFor } from './welcome.js';

const log = createLogger('discord-roles');

let reactionRoles = null;
let buttonMenus = null;
let roleMappings = null;
let activityLog = null;

const LOG_LIMIT = 100;

export function initDiscordRoles() {
  reactionRoles = collection('reaction_roles', []);
  buttonMenus = collection('discord_buttons', []);
  roleMappings = collection('role_mappings', {});
  activityLog = collection('role_activity_log', []);

  bus.on('discord:reaction_add', (d) => onReaction(d, 'added'));
  bus.on('discord:reaction_remove', (d) => onReaction(d, 'removed'));
  // Welcome, goodbye and the rest: welcome.js.
  initWelcome();
  bus.on('discord:interaction', onInteraction);
  // Entries written before names were kept say who by id; name them once the bot is up.
  bus.on('discord:ready', () => { nameOldEntries().catch((err) => log.debug(`could not name old entries: ${err.message}`)); });

  log.info(`ready — ${reactionRoles.get().length} reaction menus, ${buttonMenus.get().length} button menus`);
}

/**
 * One comparable form for an emoji, whichever way it was written down.
 *
 * The gateway describes a reaction as an object — `{name}` for unicode,
 * `{name, id}` for a custom one. A stored mapping may hold either of those, or
 * the markup a person pastes out of Discord: `<:thinking:131…>`, `<a:name:id>`
 * for an animated one. Comparing those literally never matched, so every
 * custom-emoji menu silently did nothing while unicode ones worked — which is
 * a confusing way to fail.
 *
 * Custom emoji key on the id alone: it is the stable identity, so renaming an
 * emoji in Discord no longer breaks the menus that use it.
 */
export function emojiKey(emoji) {
  if (!emoji) return '';

  if (typeof emoji === 'object') {
    return emoji.id ? `id:${emoji.id}` : String(emoji.name ?? '').trim();
  }

  const markup = /^<(a?):([^:]+):(\d+)>$/.exec(String(emoji).trim());
  if (markup) return `id:${markup[3]}`;

  // `name:id`, the shape the previous key produced and older configs may hold.
  const pair = /^([^:<>]+):(\d+)$/.exec(String(emoji).trim());
  if (pair) return `id:${pair[2]}`;

  return String(emoji).trim();
}

/*
  Who somebody is, by the name the server knows them by — their nickname
  here, else their display name, else their username. A reaction arrives with
  the member attached and a button press with the member too; a reaction
  being taken off does not, so that name is remembered from before or asked
  of Discord once.
*/
const names = new Map();
const nameFromMember = (member) => member?.nick || member?.user?.global_name || member?.user?.username || '';

async function displayName(guildId, userId, member) {
  const known = nameFromMember(member);
  if (known) { names.set(userId, known); return known; }
  if (names.has(userId)) return names.get(userId);
  if (guildId && userId) {
    try {
      const fetched = nameFromMember(await discord.request('GET', `/guilds/${guildId}/members/${userId}`));
      if (fetched) { names.set(userId, fetched); return fetched; }
    } catch { /* gone from the server: the id is all there is */ }
  }
  return String(userId);
}

/** Put names on log entries that only have an id — the ones written before names were kept. */
async function nameOldEntries() {
  const guildId = discord.getSettings().guildId;
  const nameless = [...new Set(activityLog.get().filter((e) => !e.userId && /^\d{15,25}$/.test(String(e.user))).map((e) => String(e.user)))].slice(0, 25);
  if (!nameless.length || !guildId) return;
  for (const id of nameless) await displayName(guildId, id);
  const next = activityLog.update((prev) => prev.map((e) => (
    !e.userId && names.has(String(e.user)) ? { ...e, userId: String(e.user), user: names.get(String(e.user)) } : e
  )));
  bus.emit(EVENTS.CONFIG, { key: 'roleActivityLog', value: next });
  log.info(`named ${nameless.length} people in the role activity log`);
}

function record(entry) {
  const next = activityLog.update((prev) => [{ id: `${Date.now()}`, timestamp: Date.now(), ...entry }, ...prev].slice(0, LOG_LIMIT));
  // Push it out. The log was only ever sent in the snapshot a client gets
  // when it connects, so a page that was already open never saw a role
  // change — the entries were on disk while the screen said there had been
  // no activity.
  bus.emit(EVENTS.CONFIG, { key: 'roleActivityLog', value: next });
}

async function onReaction(d, direction) {
  const menu = reactionRoles.get().find((m) => m.messageId === d.message_id);
  if (!menu) return;

  const key = emojiKey(d.emoji);
  const mapping = menu.mappings.find((m) => emojiKey(m.emoji) === key);
  if (!mapping) return;

  const guildId = d.guild_id || menu.guildId;

  try {
    if (direction === 'added') {
      // In "unique" mode a member may hold only one role from the menu, so
      // strip the others before granting the new one — and their reactions
      // with them, or the message goes on showing the old choice as theirs.
      if (menu.mode === 'unique') {
        for (const other of menu.mappings) {
          if (other.roleId === mapping.roleId) continue;
          await discord.removeRole(guildId, d.user_id, other.roleId).catch(() => {});
          if (emojiKey(other.emoji) !== key) {
            await discord.removeUserReaction(d.channel_id || menu.channelId, d.message_id, other.emoji, d.user_id).catch(() => {});
          }
        }
      }
      await discord.addRole(guildId, d.user_id, mapping.roleId);
    } else {
      await discord.removeRole(guildId, d.user_id, mapping.roleId);
    }

    record({ user: await displayName(guildId, d.user_id, d.member), userId: d.user_id, action: direction, roleName: mapping.roleName || mapping.roleId, menuName: menu.name });
    log.info(`${direction} ${mapping.roleName || mapping.roleId} for ${names.get(d.user_id) || d.user_id}`);
  } catch (err) {
    log.warn(`reaction role failed: ${err.message}`);
  }
}

async function onInteraction(d) {
  // Type 3 = MESSAGE_COMPONENT (a button press).
  if (d.type !== 3) return;

  const customId = d.data?.custom_id || '';
  if (!customId.startsWith('role:')) return;

  const roleId = customId.slice('role:'.length);
  const userId = d.member?.user?.id;
  const guildId = d.guild_id;
  if (!userId || !guildId) return;

  // Acknowledge FIRST, before going anywhere near the role queue.
  //
  // Discord voids an interaction that is not acknowledged within 3 seconds and
  // shows the presser "This interaction failed" — even though the role change
  // itself still succeeds, which makes it look like a broken menu. Role calls
  // run on a serial 300ms-spaced queue shared with reaction menus, so a handful
  // of simultaneous presses used to blow that budget (measured: eight queued
  // operations reached 3.4s, and that assumed a generous 120ms per API call).
  //
  // Type 5 = DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, flag 64 = ephemeral: the
  // presser privately sees a pending state, and the result replaces it below.
  // This call is unqueued, so it lands in one round trip however deep the
  // backlog is.
  let acknowledged = true;
  try {
    await discord.request('POST', `/interactions/${d.id}/${d.token}/callback`, {
      body: { type: 5, data: { flags: 64 } },
    });
  } catch (err) {
    // There will be nothing to edit later, but the role change is still worth
    // making, so carry on and skip the reply.
    acknowledged = false;
    log.warn(`could not acknowledge interaction: ${err.message}`);
  }

  const has = (d.member?.roles || []).includes(roleId);
  const menu = buttonMenus.get().find((m) => m.messageId === d.message?.id);
  // A button under a welcome belongs to no menu: the role's own name, from the server's list.
  const label = menu?.buttons.find((b) => b.roleId === roleId)?.roleName || discord.getCache?.()?.roles?.find((r) => r.id === roleId)?.name || roleId;

  let reply;
  try {
    if (has) await discord.removeRole(guildId, userId, roleId);
    else await discord.addRole(guildId, userId, roleId);

    record({
      user: await displayName(guildId, userId, d.member),
      userId,
      action: has ? 'removed' : 'added',
      roleName: label,
      menuName: menu?.name || 'Button Menu',
    });
    reply = has ? `Removed **${label}**.` : `Added **${label}**.`;
  } catch (err) {
    log.warn(`button role failed: ${err.message}`);
    // Previously the presser just saw a failed interaction with no reason.
    reply = `Could not update **${label}**. The bot may lack Manage Roles, `
      + 'or its own role may sit below that one in the server list.';
  }

  if (!acknowledged) return;

  // Replace the pending state. The interaction token stays valid for 15
  // minutes, so this is safe no matter how long the queue took to drain.
  await discord.request('PATCH', `/webhooks/${d.application_id}/${d.token}/messages/@original`, {
    body: { content: reply },
  }).catch((err) => log.warn(`could not deliver interaction reply: ${err.message}`));
}

// ------------------------------------------------------------------- public

// ------------------------------------------------------------- button menus

/** A button's emoji as Discord wants it: a custom one by id, a unicode one by itself. */
function buttonEmoji(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return undefined;
  const custom = /^<(a?):([^:]+):(\d+)>$/.exec(s);
  return custom ? { id: custom[3], name: custom[2], animated: custom[1] === 'a' } : { name: s };
}

/**
 * A menu's buttons as Discord message components: rows of up to five, at
 * most five rows. Each button's id is `role:<id>`, which is what a press is
 * matched on (onInteraction above). One button per role — Discord refuses a
 * message with two buttons sharing an id.
 */
export function buttonRows(buttons) {
  const seen = new Set();
  const usable = (Array.isArray(buttons) ? buttons : [])
    .filter((b) => b?.roleId && (b.label || b.emoji) && !seen.has(b.roleId) && seen.add(b.roleId))
    .slice(0, 25);
  const rows = [];
  for (let i = 0; i < usable.length; i += 5) {
    rows.push({
      type: 1,
      components: usable.slice(i, i + 5).map((b) => ({
        type: 2,
        style: [1, 2, 3, 4].includes(Number(b.style)) ? Number(b.style) : 1,
        custom_id: `role:${b.roleId}`,
        ...(b.label ? { label: String(b.label).slice(0, 80) } : {}),
        ...(buttonEmoji(b.emoji) ? { emoji: buttonEmoji(b.emoji) } : {}),
      })),
    });
  }
  return rows;
}

/**
 * Put a button menu in Discord, or bring the one there up to date.
 *
 * The menu used to be saved and never posted, so there was never anything in
 * the server to press. The message is edited in place once it exists; if it
 * was deleted in Discord, a new one is posted and remembered instead.
 */
export async function publishButtonMenu(id) {
  const menu = buttonMenus.get().find((m) => m.id === id);
  if (!menu) throw new Error('no such button menu');
  if (!menu.channelId) throw new Error('choose a channel for the menu first');
  const components = buttonRows(menu.buttons);
  if (!components.length) throw new Error('give at least one button a role first');
  // Discord will not post buttons on an otherwise empty message.
  const content = menu.content || (menu.embed ? '' : menu.name || '');

  let messageId = menu.messageId;
  if (messageId) {
    try {
      await discord.editMessage(menu.channelId, messageId, content, menu.embed, components);
    } catch (err) {
      if (err.status !== 404) throw err;
      messageId = '';
    }
  }
  if (!messageId) {
    const posted = await discord.sendMessage(menu.channelId, content, menu.embed, components);
    messageId = posted?.id;
    if (!messageId) throw new Error('Discord did not say which message it posted');
    const next = buttonMenus.update((prev) => prev.map((m) => (m.id === id ? { ...m, messageId } : m)));
    bus.emit(EVENTS.CONFIG, { key: 'discordButtonConfigs', value: next });
  }
  log.info(`button menu "${menu.name}" is in Discord`);
  return { messageId };
}

/** Take a menu's message out of Discord, when the menu is deleted here. Gone already is fine. */
export async function unpublishButtonMenu(id) {
  const menu = buttonMenus.get().find((m) => m.id === id);
  if (!menu?.messageId || !menu.channelId) return { ok: true };
  await discord.deleteMessage(menu.channelId, menu.messageId).catch((err) => {
    if (err.status !== 404) throw err;
  });
  return { ok: true };
}

/** Stream status → Discord role, as set on the Role Management screen. See role-sync.js. */
export const getRoleMappings = () => roleMappings?.get() || {};

export const snapshot = () => ({
  reactionRoleConfigs: reactionRoles.get(),
  discordButtonConfigs: buttonMenus.get(),
  welcomeGoodbyeConfig: getGreetings(),
  roleMappings: roleMappings.get(),
  roleActivityLog: activityLog.get(),
});

export const store = {
  setReactionRoles: (v) => reactionRoles.set(v),
  setButtonMenus: (v) => buttonMenus.set(v),
  // Cleaned on the way in (welcome.js), the picture card like a layer.
  setWelcomeGoodbye: (v) => setGreetings(v),
  setRoleMappings: (v) => roleMappings.set(v),
  clearActivityLog: () => activityLog.set([]),
};
