/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The app's version: one number for the server, the pages it serves, the
 * package files and the backups it writes. Changed with `npm run bump`
 * (scripts/bump.mjs), which changes it everywhere at once and opens its
 * entry in CHANGELOG.md.
 *
 * Numbered major.minor.patch:
 *   - patch: fixes and wording, nothing new to learn;
 *   - minor: something new, and everything that was there still works;
 *   - major: something the streamer has to do or re-do to keep working —
 *     a backup an older app cannot read, a feature taken out, a sign-in
 *     every platform needs again.
 *
 * 1.0.0 is the first numbered release (2026-10-06). The "V3" in the
 * project's name is the third rewrite, not a version: the package files
 * said 3.0.0 until then.
 */
export const VERSION = '1.1.2';
