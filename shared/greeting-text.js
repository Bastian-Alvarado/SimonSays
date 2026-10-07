/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The words in a welcome, goodbye, boost or ban post: the placeholders and
 * what each one becomes, the same in a message line, the embed, the direct
 * message and the picture card.
 *
 * Here in shared/ because the dashboard's preview fills them as well, and a
 * placeholder the preview filled and the post left raw is the kind of thing
 * that is only noticed in the server, in front of everybody. That is how
 * {server} and {count} went: offered under every message line, filled only
 * on the picture card.
 *
 * In Spanish, like everything else the community sees — a date, an age.
 */

/** Every placeholder there is, in the order the editors offer them. */
export const GREETING_PLACEHOLDERS = ['{user}', '{username}', '{server}', '{count}', '{boosts}', '{date}', '{account_age}', '{created}'];

const DISCORD_EPOCH = 1420070400000;

/** When a Discord account was made, from its id. Null for anything that is not one. */
export function createdAt(id) {
  try {
    const ms = Number((BigInt(String(id)) >> 22n) + BigInt(DISCORD_EPOCH));
    return Number.isFinite(ms) && ms > DISCORD_EPOCH ? ms : null;
  } catch {
    return null;
  }
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * How old an account is, in words: "hoy", "3 días", "5 meses", "2 años".
 * The largest whole unit only — "2 años" says what matters, and an alt made
 * yesterday reads as "1 día" at a glance.
 */
export function accountAge(created, now = Date.now()) {
  if (!created) return '';
  const days = Math.floor((now - created) / DAY);
  if (days < 1) return 'hoy';
  if (days < 31) return days === 1 ? '1 día' : `${days} días`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`;
  const years = Math.floor(days / 365.25);
  return years === 1 ? '1 año' : `${years} años`;
}

/** A day as the community reads it: "2 de octubre de 2026". */
export function longDate(ms) {
  if (!ms) return '';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
}

/**
 * A text with its placeholders filled.
 *
 *   ctx.name      their name, as shown
 *   ctx.mention   <@id>, where a mention is drawn (a message line, a
 *                 description); left out, {user} is their name
 *   ctx.server    the server's name
 *   ctx.count     how many are in it
 *   ctx.boosts    how many boosts it has
 *   ctx.id        their Discord id, for when the account was made
 *   ctx.now       the moment, for {date} and the age (now, by default)
 *
 * A value nobody had — no count, no id — becomes nothing rather than the
 * placeholder, which would read as a broken bot.
 */
export function fillGreeting(text, ctx = {}) {
  const now = ctx.now ?? Date.now();
  const made = createdAt(ctx.id);
  const value = (v) => (v === undefined || v === null ? '' : String(v));
  return String(text ?? '')
    .replace(/\{user\}/g, ctx.mention || value(ctx.name))
    .replace(/\{username\}/g, value(ctx.name))
    .replace(/\{server\}/g, value(ctx.server))
    .replace(/\{count\}/g, value(ctx.count))
    .replace(/\{boosts\}/g, value(ctx.boosts))
    .replace(/\{date\}/g, longDate(now))
    .replace(/\{account_age\}/g, accountAge(made, now))
    .replace(/\{created\}/g, made ? longDate(made) : '');
}
