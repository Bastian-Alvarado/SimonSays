/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * A release, as the updater reads it (server/engine/updater.js) and the
 * release script writes it (scripts/release-bundle.mjs).
 *
 * Every GitHub release of the app carries two files: the package itself —
 * simonsays-<version>.tgz, everything needed to run that version, already
 * built, without its dependencies — and release.json, which says what is in
 * the package and how to know it arrived whole:
 *
 *   { version, file, size, sha256, node }
 *
 * `node` is the lowest major version of Node the release runs on; a copy on
 * an older Node is told so rather than updated into something it cannot run.
 */

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** A version as three numbers, or null for anything that is not one. "v1.2.0" and "1.2.0" are the same. */
export function parseVersion(v) {
  const m = SEMVER.exec(String(v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Below zero when a is older than b, zero when the same, above zero when newer. Anything unreadable is older than everything. */
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

export const RELEASE_MANIFEST = 'release.json';
export const packageName = (version) => `simonsays-${version}.tgz`;

/** release.json, held to its shape: anything off and it is not a release this can install. */
export function cleanReleaseManifest(raw) {
  const m = raw && typeof raw === 'object' ? raw : null;
  if (!m) return null;
  const version = parseVersion(m.version) ? String(m.version).replace(/^v/, '') : null;
  if (!version) return null;
  if (m.file !== packageName(version)) return null;
  if (!/^[0-9a-f]{64}$/.test(String(m.sha256 || ''))) return null;
  const size = Number(m.size);
  if (!Number.isInteger(size) || size <= 0 || size > MAX_PACKAGE_BYTES) return null;
  const node = Number(m.node);
  return { version, file: m.file, size, sha256: m.sha256, node: Number.isInteger(node) && node > 0 ? node : 22 };
}

/** The most a package may weigh: the app without its dependencies is a few MB, so this is room to grow, not a target. */
export const MAX_PACKAGE_BYTES = 80 * 1024 * 1024;

/**
 * Whether two package-lock.json files ask for the same dependencies, the
 * app's own version number aside: if they do, the update reuses what is
 * installed instead of downloading it all again.
 */
export function sameDependencies(lockA, lockB) {
  const deps = (lock) => {
    const packages = { ...(lock?.packages || {}) };
    if (packages['']) {
      const { version, ...rest } = packages[''];
      packages[''] = rest;
    }
    return JSON.stringify(packages);
  };
  return deps(lockA) === deps(lockB);
}
