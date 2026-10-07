/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Words for things the server names, in the screen's language.
 *
 * The server speaks English: its refusals ("the plan is empty") and the names
 * of the built-in dock buttons ("Next question") are written once, there. A
 * screen in Spanish looks each one up here instead of showing it as sent.
 *
 * Found by name, so adding one is a line in each language in constants.ts
 * and nothing here: a refusal with the code "plans_full" is t.refusePlansFull,
 * and the built-in button "question_next" is t.dockBuiltinQuestionNext.
 * Anything without words — a code nobody wrote a sentence for, a failure
 * nobody foresaw — shows as the server said it, which is English, but says
 * what happened.
 */

/** "plans_full" → "PlansFull". */
const pascal = (id: string) => String(id).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');

export const refusalKey = (code: string) => `refuse${pascal(code)}`;
export const builtinKey = (id: string) => `dockBuiltin${pascal(id)}`;

export const fill = (text: string, vars?: Record<string, any>) =>
  Object.entries(vars || {}).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v ?? '')), text);

/**
 * What a refusal means, in the screen's language. Takes a thrown error from a
 * request or a `{ ok: false, code, error }` result — both carry the code and
 * what fills its sentence.
 */
export function refusalWords(t: any, err: { code?: string; message?: string; error?: string; vars?: Record<string, any> } | null | undefined): string {
  const said = err?.message || err?.error || '';
  const words = err?.code ? t?.[refusalKey(err.code)] : '';
  return words ? fill(String(words), err?.vars) : said;
}

/** A built-in dock button's name, in the screen's language. */
export const builtinName = (t: any, builtin: { id: string; name: string } | null | undefined) =>
  (builtin ? t?.[builtinKey(builtin.id)] || builtin.name : '');

/**
 * How a shoutout went. Twitch's own shoutout and the line in chat are sent
 * separately, and either can fail while the other goes — most often Twitch's,
 * which needs the stream live. Saying only "Shoutout sent" then was wrong.
 */
export function shoutoutWords(t: any, result: any): { ok: boolean; text: string } {
  if (result?.ok === false) return { ok: false, text: refusalWords(t, result) };
  const failures: any[] = result?.failures || [];
  if (!failures.length) return { ok: true, text: t.peopleShoutoutDone || 'Shoutout sent' };
  const why = failures.map((f) => (
    f.part === 'chat' ? (t.shoutoutChatFailed || 'The line in chat did not go out.')
      : f.code === 'not_live' ? (t.shoutoutNotLive || 'Twitch’s own shoutout needs the stream live.')
        : `${t.shoutoutNativeFailed || 'Twitch’s own shoutout did not go out:'} ${f.message || ''}`.trim()
  ));
  return { ok: false, text: `${t.shoutoutPartly || 'Only partly sent.'} ${why.join(' ')}` };
}
