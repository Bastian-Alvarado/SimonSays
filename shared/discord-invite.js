/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The link that adds the streamer's own bot to a Discord server: what the
 * Developer Portal's OAuth2 → URL Generator makes when "bot" and these
 * permissions are ticked, made here from the Client ID so it is one press on
 * the Connections screen instead. It goes straight to Discord, which asks
 * which server and shows the permissions before anything is added.
 *
 * Only the bot scope: the menus the bot posts are buttons, which need no
 * slash-command scope. The permissions are what its features use (Guides →
 * Discord lists the same, for doing it by hand).
 */

/** Discord's permission bits, by the name the portal shows. */
export const BOT_PERMISSIONS = Object.freeze([
  ['Manage Roles', 28], // levels, subscriber and role-menu roles
  ['Manage Events', 33], // scheduled events from the stream schedule
  ['View Channels', 10],
  ['Send Messages', 11],
  ['Embed Links', 14], // pages, go-live posts, welcome cards
  ['Attach Files', 15], // drawn welcome cards and banners
  ['Read Message History', 16],
  ['Mention Everyone', 17], // a go-live post that pings
  ['Add Reactions', 6], // reaction roles
  ['Use External Emojis', 18],
  ['Manage Messages', 13], // relayed and moderated chat
  ['Connect', 20], // voice avatars in a call
]);

/** Those permissions as the number Discord's link carries (bit 33 is past 32 bits, so BigInt). */
export const botPermissions = () => BOT_PERMISSIONS.reduce((sum, [, bit]) => sum | (1n << BigInt(bit)), 0n).toString();

/** The invite link for a Client ID, or '' when there is no usable one yet (an application id is a long number). */
export function botInviteUrl(clientId) {
  const id = String(clientId || '').trim();
  if (!/^\d{15,22}$/.test(id)) return '';
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', id);
  url.searchParams.set('scope', 'bot');
  url.searchParams.set('permissions', botPermissions());
  return url.toString();
}
