/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The roadmap: where the app has been and where it is going, as one tree
 * (web/components/views/RoadmapView.tsx). It doubles as the changelog.
 *
 * Where it has been is CHANGELOG.md, read as it is written — one heading
 * per release, `## [1.1.4] — 2026-10-10`, and a line per change — so a
 * release is on the roadmap the moment its entry is. Work not yet released
 * sits under `## [Unreleased] — 1.2.0` (the version it is heading for), and
 * `npm run bump` turns that heading into the release's own.
 *
 * Where it is going is PLANS: the major updates ahead, by name. A major
 * version is a big branch — everything from 1.0.0 until 2.0.0 grows on the
 * 1.x one — a minor version a smaller branch along it, and its patches the
 * twigs off that.
 */

/** The major updates ahead: a name, what it is about in a line, and what it is planned to bring. */
export const PLANS = [
  {
    version: '2.0.0',
    name: 'The moderators update',
    summary: 'A dashboard of their own for your moderators, so they can help run the stream without access to everything.',
    goals: [
      'Moderators sign in with their own Twitch account, and only moderators of your channel get in.',
      'They can chat as themselves or as your bot.',
      'Each moderator gets a stream deck of their own, set up the way they like.',
      'Your overlays and pixel avatars stay yours: moderators can\'t open them.',
    ],
  },
  {
    version: '3.0.0',
    name: 'The kick update',
    summary: 'Kick joins Twitch, YouTube and TikTok as a platform SimonSays supports.',
    goals: [
      'Kick chat and events alongside your other platforms.',
      'Every feature of the app working with Kick, as far as Kick allows it.',
    ],
  },
];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const parts = (v) => (SEMVER.exec(String(v || '')) || []).slice(1).map(Number);
/** Below zero when a is older than b. */
export const compareVersions = (a, b) => {
  const x = parts(a);
  const y = parts(b);
  if (x.length !== 3 || y.length !== 3) return x.length === 3 ? 1 : y.length === 3 ? -1 : 0;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

const HEADING = /^## \[(\d+\.\d+\.\d+)\]\s*[—–-]\s*(\d{4}-\d{2}-\d{2})\s*$/;
const UNRELEASED = /^## \[Unreleased\](?:\s*[—–-]\s*(\d+\.\d+\.\d+))?\s*$/i;

/**
 * A changelog's releases, newest first, each with its date and its lines,
 * and the work not yet released, if any. A line's own wrapped continuation
 * is joined to it; an empty "- " (a heading just added by the bump, not yet
 * filled in) is no line at all.
 */
export function parseChangelog(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  const releases = [];
  let unreleased = null;
  let open = null;
  for (const line of lines) {
    const h = HEADING.exec(line);
    const u = UNRELEASED.exec(line);
    if (h || u || /^## /.test(line)) {
      open = null;
      if (h) { open = { version: h[1], date: h[2], notes: [] }; releases.push(open); }
      else if (u) { open = { version: u[1] || '', notes: [] }; unreleased = open; }
      continue;
    }
    if (!open) continue;
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) { open.notes.push(item[1].trim()); continue; }
    // A line wrapped under its item: indented, and something to add.
    if (/^\s{2,}\S/.test(line) && open.notes.length) open.notes[open.notes.length - 1] += ` ${line.trim()}`;
  }
  const clean = (r) => ({ ...r, notes: r.notes.filter(Boolean) });
  return {
    releases: releases.map(clean).sort((a, b) => compareVersions(b.version, a.version)),
    unreleased: unreleased && unreleased.notes.some(Boolean) ? clean(unreleased) : null,
  };
}

/**
 * The tree: major branches, newest first — the ones planned, then the ones
 * released — each with its minor branches, newest first, and their patches.
 *
 * Every node says what it is to whoever is looking: `released`, `current`
 * (the version this copy runs), `in-progress` (the unreleased work),
 * `available` (a newer release this copy can update to, from the updater)
 * or `planned`.
 *
 * `available` is { version, notes } — the newest release on GitHub, when it
 * is newer than this copy and so not in the changelog this copy carries.
 */
export function roadmapTree(changelogText, { current = '', available = null, plans = PLANS } = {}) {
  const { releases, unreleased } = parseChangelog(changelogText);
  const nodes = releases.map((r) => ({ ...r, status: r.version === current ? 'current' : 'released' }));
  // What is coming: the unreleased work, by the version it is heading for, and a newer release to update to.
  if (available?.version && compareVersions(available.version, current) > 0 && !nodes.some((n) => n.version === available.version)) {
    nodes.push({ version: available.version, date: available.date || '', notes: available.notes || [], status: 'available' });
  }
  if (unreleased) {
    const heading = unreleased.version && !nodes.some((n) => n.version === unreleased.version)
      ? unreleased.version
      : nextAfter(nodes.map((n) => n.version));
    nodes.push({ version: heading, date: '', notes: unreleased.notes, status: 'in-progress' });
  }

  const majors = new Map();
  const majorOf = (n) => {
    if (!majors.has(n)) majors.set(n, { major: n, version: `${n}.0.0`, name: '', status: 'released', minors: new Map() });
    return majors.get(n);
  };
  for (const node of nodes) {
    const [ma, mi] = parts(node.version);
    const branch = majorOf(ma).minors;
    const key = `${ma}.${mi}`;
    if (!branch.has(key)) branch.set(key, { minor: key, version: `${key}.0`, node: null, patches: [] });
    const minor = branch.get(key);
    if (node.version.endsWith('.0') && parts(node.version)[2] === 0) minor.node = node;
    else minor.patches.push(node);
  }
  for (const plan of plans) {
    const [ma] = parts(plan.version);
    if (ma === undefined) continue;
    const m = majorOf(ma);
    m.name = plan.name;
    if (plan.summary) m.summary = plan.summary;
    if (Array.isArray(plan.goals)) m.goals = plan.goals;
    m.planned = true;
  }

  return [...majors.values()]
    .sort((a, b) => b.major - a.major)
    .map((m) => {
      const minors = [...m.minors.values()]
        .sort((a, b) => compareVersions(b.version, a.version))
        .map((mi) => ({ ...mi, patches: mi.patches.sort((a, b) => compareVersions(b.version, a.version)) }));
      const all = minors.flatMap((mi) => [mi.node, ...mi.patches]).filter(Boolean);
      const has = (s) => all.some((n) => n.status === s);
      // A major is what its newest news is: in progress, available, where this copy is, or simply out.
      const status = has('in-progress') ? 'in-progress'
        : has('available') ? 'available'
          : has('current') ? 'current'
            : all.length ? 'released' : 'planned';
      const first = all.filter((n) => n.date).map((n) => n.date).sort()[0] || '';
      return { major: m.major, version: m.version, name: m.name, ...(m.summary ? { summary: m.summary } : {}), ...(m.goals ? { goals: m.goals } : {}), status, since: first, minors };
    });
}

/** The next minor version after the newest of these, for unreleased work that does not say where it is heading. */
function nextAfter(versions) {
  const newest = versions.filter((v) => SEMVER.test(v)).sort((a, b) => compareVersions(b, a))[0] || '0.0.0';
  const [ma, mi] = parts(newest);
  return `${ma}.${mi + 1}.0`;
}

/** A release's notes from its GitHub release text (its changelog entry): the lines that are items. */
export function notesFromMarkdown(body) {
  return String(body || '').split(/\r?\n/).map((l) => /^\s*[-*]\s+(.*)$/.exec(l)?.[1]?.trim()).filter(Boolean);
}
