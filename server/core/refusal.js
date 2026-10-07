/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A refusal a screen can say in its own language.
 *
 * The message is English, for the log and for any screen with no words for
 * the code. The code is what a screen looks up, and `vars` fill in the parts
 * of its sentence that change — how many saved plans there can be, which
 * channel was not found. The socket passes all three along; the words for
 * each code are in web/constants.ts, found through web/words.ts.
 */
export function refusal(code, message, vars) {
  const err = new Error(message);
  err.code = code;
  if (vars) err.vars = vars;
  return err;
}
