/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Discord's words as Discord shows them, wherever they are shown here: a
 * server emoji as its picture, a mention as the name it mentions.
 *
 * Discord writes its own emoji as a code — `<:Wow:1199000000000000002>`,
 * `<a:Dance:…>` when it moves — and a mention as one too: `<@id>` somebody,
 * `<@&id>` a role, `<#id>` a channel. What the bot posts has to keep those
 * codes for Discord to draw them. Shown on these screens as they are, though,
 * they read as gibberish: a request on the board, a question in the dock, a
 * line of Discord chat, a step of the plan. Here they are drawn instead, and
 * nothing else changes: a box where the words are typed keeps the codes,
 * since that is what gets posted.
 *
 * The names come with the words where the server sent them (a chat line's,
 * a request's, a question's `names`), and otherwise from what this screen
 * has seen: the server's channels and roles, and every name sent so far.
 */
import React from 'react';

export interface DiscordNames {
  users?: Record<string, string>;
  roles?: Record<string, { name: string; color?: number }>;
  channels?: Record<string, string>;
}

/** Every name seen on this screen, for words that came without their own. */
const seen = { users: new Map<string, string>(), roles: new Map<string, { name: string; color?: number }>(), channels: new Map<string, string>() };

/** Learn the names sent with some words. */
export function rememberDiscordNames(names?: DiscordNames | null) {
  if (!names) return;
  for (const [id, name] of Object.entries(names.users || {})) if (name) seen.users.set(id, name);
  for (const [id, role] of Object.entries(names.roles || {})) if (role?.name) seen.roles.set(id, role);
  for (const [id, name] of Object.entries(names.channels || {})) if (name) seen.channels.set(id, name);
}

/** Learn the server's channels and roles. */
export function rememberDiscordLists({ channels, roles }: { channels?: any[]; roles?: any[] }) {
  for (const c of channels || []) if (c?.id && c?.name) seen.channels.set(String(c.id), String(c.name));
  for (const r of roles || []) if (r?.id && r?.name) seen.roles.set(String(r.id), { name: String(r.name), color: Number(r.color) || 0 });
}

const CODES = /<(a?):([\w~-]{1,32}):(\d{5,25})>|<@!?(\d{5,25})>|<@&(\d{5,25})>|<#(\d{5,25})>/g;

/** Whether some words have a server emoji in them. */
export const hasDiscordEmoji = (text: string) => /<a?:[\w~-]{1,32}:\d{5,25}>/.test(String(text || ''));

/** The picture Discord serves for a server emoji. */
export const discordEmojiUrl = (id: string, animated: boolean, size = 48) => `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=${size}`;

/** One emoji's picture; its name instead if Discord has none for it any more (an emoji since deleted). */
const EmojiImage = ({ src, name, size }: { src: string; name: string; size: string }) => {
  const [gone, setGone] = React.useState(false);
  if (gone) return React.createElement('span', { 'data-discord-emoji': name, title: `:${name}:` }, `:${name}:`);
  return React.createElement('img', {
    src,
    alt: `:${name}:`,
    title: `:${name}:`,
    draggable: false,
    className: 'inline-block object-contain',
    style: { width: size, height: size, verticalAlign: '-0.25em' },
    'data-discord-emoji': name,
    onError: () => setGone(true),
  });
};

/** A mention as Discord draws one: its name, on a tint — a role's in its own colour. */
const mention = (key: string, kind: string, words: string, colour?: number) => {
  const c = colour ? `#${colour.toString(16).padStart(6, '0')}` : '';
  return React.createElement('span', {
    key,
    'data-discord-mention': kind,
    style: {
      color: c || '#c9cdfb',
      background: c ? `${c}26` : 'rgba(88, 101, 242, 0.3)',
      borderRadius: 3,
      padding: '0 2px',
      fontWeight: 500,
    },
  }, words);
};

/**
 * The words with each server emoji as its picture, `size` high (a CSS length:
 * a little over the words' own height by default), and each mention as the
 * name it mentions — from `names` when the words came with them, otherwise
 * from what this screen has seen. The words as they are when there is none.
 */
export function withDiscordText(text: string, size: string = '1.3em', names?: DiscordNames | null): React.ReactNode {
  const s = String(text ?? '');
  if (!s.includes('<')) return s;
  const out: React.ReactNode[] = [];
  let last = 0;
  CODES.lastIndex = 0;
  for (let m = CODES.exec(s); m; m = CODES.exec(s)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const key = `d${m.index}`;
    if (m[3]) out.push(React.createElement(EmojiImage, { key, src: discordEmojiUrl(m[3], m[1] === 'a'), name: m[2], size }));
    else if (m[4]) out.push(mention(key, 'user', `@${names?.users?.[m[4]] || seen.users.get(m[4]) || 'user'}`));
    else if (m[5]) {
      const role = names?.roles?.[m[5]] || seen.roles.get(m[5]);
      out.push(mention(key, 'role', `@${role?.name || 'role'}`, role?.color));
    } else out.push(mention(key, 'channel', `#${names?.channels?.[m[6]] || seen.channels.get(m[6]) || 'channel'}`));
    last = m.index + m[0].length;
  }
  if (!out.length) return s;
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** The same as a component, for JSX. */
export const DiscordText = ({ text, size, names }: { text: string; size?: string; names?: DiscordNames | null }) => React.createElement(React.Fragment, null, withDiscordText(text, size, names));
