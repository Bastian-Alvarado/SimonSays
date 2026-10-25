/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Roadmap (shared/roadmap.js, web/components/views/
 * RoadmapView.tsx) — the changelogs read as releases, the tree they grow
 * into with the major updates planned, the work in progress, a newer release
 * to update to, and `npm run bump` turning the work in progress into the
 * release.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCRIPT_URL, assert, fs, test } from './harness.js';

const R = await import('../../../shared/roadmap.js');
const { VERSION } = await import('../../../shared/version.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const constants = read('../../web/constants.ts');
const bothLanguages = (key) => constants.split(`    ${key}: '`).length - 1 === 2;
const repo = fileURLToPath(new URL('../../', SCRIPT_URL));

test('both changelogs read as releases: every heading, newest first, each dated and saying what changed', () => {
  // The public edition's own copy is its CHANGELOG.md: the override is only in this repo.
  for (const file of ['CHANGELOG.md', 'public-edition/overrides/CHANGELOG.md'].filter((f) => fs.existsSync(path.join(repo, f)))) {
    const text = fs.readFileSync(path.join(repo, file), 'utf8');
    const { releases } = R.parseChangelog(text);
    const headings = (text.match(/^## \[\d+\.\d+\.\d+\]/gm) || []).length;
    assert.equal(releases.length, headings, `${file}: a release heading was not read`);
    assert.ok(releases.length >= 11, `${file}: releases went missing`);
    for (let i = 1; i < releases.length; i += 1) assert.ok(R.compareVersions(releases[i - 1].version, releases[i].version) > 0, `${file}: not newest first`);
    for (const r of releases) {
      assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, `${file}: ${r.version} has no date`);
      assert.ok(r.notes.length > 0, `${file}: ${r.version} says nothing`);
    }
    assert.ok(releases.some((r) => r.version === VERSION) || R.parseChangelog(text).unreleased, `${file}: this version is not in it`);
  }
});

const LOG = `# Changelog

## [Unreleased] — 1.3.0

- Something new, being built.
  Still the same line.
-

## [1.2.1] — 2026-02-02

- A fix.

## [1.2.0] — 2026-02-01

- A minor: **bold** and \`code\`.

## [1.1.0] — 2026-01-15

- Older.

## [1.0.1] — 2026-01-02

- First fix.

## [1.0.0] — 2026-01-01

- The start.
`;
const parsed = R.parseChangelog(LOG);
const tree = R.roadmapTree(LOG, { current: '1.2.1', plans: [{ version: '2.0.0', name: 'The moderators update' }, { version: '3.0.0', name: 'The kick update', goals: ['Kick chat'] }] });
const minorsOf = (major) => tree.find((m) => m.major === major).minors;

test('the changelog\'s own marks are kept, a wrapped line is one line, and an empty item is none', () => {
  assert.deepEqual(parsed.unreleased, { version: '1.3.0', notes: ['Something new, being built. Still the same line.'] });
  assert.deepEqual(parsed.releases.map((r) => r.version), ['1.2.1', '1.2.0', '1.1.0', '1.0.1', '1.0.0']);
  assert.equal(parsed.releases[1].notes[0], 'A minor: **bold** and `code`.');
  assert.equal(R.parseChangelog(LOG.replace('- Something new, being built.\n  Still the same line.\n', '')).unreleased, null, 'an Unreleased heading with nothing under it is work in progress');
});

test('the tree: planned majors by name first, then each major\'s minors newest first, with their patches as twigs', () => {
  assert.deepEqual(tree.map((m) => [m.major, m.name, m.status]), [[3, 'The kick update', 'planned'], [2, 'The moderators update', 'planned'], [1, '', 'in-progress']]);
  assert.deepEqual(tree[0].goals, ['Kick chat']);
  assert.deepEqual(minorsOf(1).map((mi) => mi.minor), ['1.3', '1.2', '1.1', '1.0']);
  const v12 = minorsOf(1).find((mi) => mi.minor === '1.2');
  assert.equal(v12.node.version, '1.2.0');
  assert.deepEqual(v12.patches.map((p) => [p.version, p.status]), [['1.2.1', 'current']]);
  assert.equal(minorsOf(1).find((mi) => mi.minor === '1.3').node.status, 'in-progress', 'the work in progress is not where it is heading');
  assert.equal(tree.find((m) => m.major === 1).since, '2026-01-01');
  assert.equal(minorsOf(1).find((mi) => mi.minor === '1.0').node.status, 'released');
});

test('a newer release to update to is on the tree, and unreleased work that names no version is the next minor', () => {
  const withUpdate = R.roadmapTree(LOG.replace(/## \[Unreleased\][\s\S]*?(?=## \[1\.2\.1\])/, ''), { current: '1.2.1', available: { version: '2.0.0', date: '2026-03-01', notes: R.notesFromMarkdown('## New\n- Mods\n* Roles') } });
  const two = withUpdate.find((m) => m.major === 2);
  assert.equal(two.status, 'available');
  assert.equal(two.name, 'The moderators update', 'the plan\'s name left the branch once it was out');
  assert.deepEqual(two.minors[0].node.notes, ['Mods', 'Roles']);
  const noVersion = R.roadmapTree(LOG.replace('## [Unreleased] — 1.3.0', '## [Unreleased]'), { current: '1.2.1', plans: [] });
  assert.equal(noVersion[0].minors[0].node.version, '1.3.0');
  assert.equal(noVersion[0].minors[0].node.status, 'in-progress');
  // An older copy is not offered an update to what it already has.
  assert.ok(!R.roadmapTree(LOG, { current: '1.2.1', available: { version: '1.2.0', notes: [] } }).some((m) => m.status === 'available'));
});

test('the planned major updates are the two named so far, nothing of the private edition\'s own', () => {
  assert.deepEqual(R.PLANS.map((p) => [p.version, p.name]), [['2.0.0', 'The moderators update'], ['3.0.0', 'The easy install update'], ['4.0.0', 'The community update'], ['5.0.0', 'The creators update'], ['6.0.0', 'The kick update'], ['7.0.0', 'The automation update'], ['8.0.0', 'The insights update'], ['9.0.0', 'The on-the-go update']]);
  for (const plan of R.PLANS) assert.ok(plan.summary && plan.goals?.length, `${plan.name} has nothing said about it`);
});

test('the kick update says up front that Kick needs a public address of your own, and that nothing goes through anybody else\'s server', () => {
  // The streamer's decision (2026-10-16): Kick sends its events only to an address on the internet, and they
  // come to the streamer's own, never through a relay of the people who make SimonSays.
  const kick = R.PLANS.find((p) => p.name === 'The kick update');
  assert.ok(kick.goals.some((g) => g.includes('public address or domain') && g.includes('never through anybody else’s server')));
});

// The bump, on a copy: the work in progress becomes the release, in both changelogs.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-roadmap-bump-'));
const PUBLIC_LOG = 'public-edition/overrides/CHANGELOG.md';
for (const file of ['shared/version.js', 'scripts/bump.mjs', 'package.json', 'server/package.json', 'web/package.json']) {
  fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
  fs.copyFileSync(path.join(repo, file), path.join(dir, file));
}
fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), `# Changelog\n\n## [Unreleased] — 9.9.9\n\n- Built so far.\n\n## [${VERSION}] — 2026-10-10\n\n- Before.\n`);
fs.mkdirSync(path.join(dir, path.dirname(PUBLIC_LOG)), { recursive: true });
fs.writeFileSync(path.join(dir, PUBLIC_LOG), `# Changelog\n\n## [${VERSION}] — 2026-10-10\n\n- Before.\n`);
const said = execFileSync(process.execPath, [path.join(dir, 'scripts/bump.mjs'), 'minor'], { encoding: 'utf8', stdio: 'pipe' });
const bumpedLog = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8');
const bumpedPublic = fs.readFileSync(path.join(dir, PUBLIC_LOG), 'utf8');
fs.rmSync(dir, { recursive: true, force: true });
const [maj, min] = VERSION.split('.').map(Number);
const next = `${maj}.${min + 1}.0`;

test('npm run bump makes the work in progress the release\'s entry, and gives a changelog without one an empty heading', () => {
  assert.ok(!bumpedLog.includes('[Unreleased]'), 'the Unreleased heading was left');
  assert.match(bumpedLog, new RegExp(`## \\[${next.split('.').join('\\.')}\\] — \\d{4}-\\d{2}-\\d{2}\\n\\n- Built so far\\.`), 'the notes written so far were not carried into the release');
  assert.match(bumpedPublic, new RegExp(`## \\[${next.split('.').join('\\.')}\\] — \\d{4}-\\d{2}-\\d{2}\\n\\n- \\n`), 'the public changelog got no heading');
  assert.ok(said.includes('read it over'), 'the bump did not say the notes were carried');
});

test('the Roadmap screen: in the menu, the changelog built in, the update to have, and a way there from About', () => {
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("{ view: 'roadmap', label: t.roadmapNav || 'Roadmap', icon: <GitBranch size={I} />"));
  assert.ok(app.includes("{view === 'roadmap' && ("));
  assert.ok(app.includes("openRoadmap={() => goTo('roadmap')}"));
  assert.ok(read('../../web/types.ts').includes("'roadmap'"));
  const view = read('../../web/components/views/RoadmapView.tsx');
  assert.ok(view.includes("import changelog from '../../../CHANGELOG.md?raw';"), 'the roadmap does not read the changelog this copy was built with');
  assert.ok(view.includes('roadmapTree(changelog, { current: VERSION, available })'));
  assert.ok(read('../../web/components/views/SettingsView.tsx').includes('data-settings-roadmap'));
  for (const key of ['roadmapNav', 'roadmapIntro', 'roadmapHere', 'roadmapInProgress', 'roadmapAvailable', 'roadmapReleased', 'roadmapPlanned', 'roadmapChanges', 'roadmapSince', 'roadmapToCome', 'roadmapUpdate', 'roadmapAboutLink']) {
    assert.ok(bothLanguages(key), `${key} is not in both languages`);
  }
});
