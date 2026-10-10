/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the Guides tab (shared/guides.js, web/components/views/GuidesView.tsx)
 * — every way there goes to a screen that exists, every button it names is a
 * word the app has in both languages, both languages say the same steps, the
 * checklist ticks from what the app can see, the chat words come from the
 * settings as they are, and the server counts the pages open in OBS.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, engine, fs, test } from './harness.js';

const g = await import('../../../shared/guides.js');
const { countSurfaces } = await import('../../api/ws.js');
const points = await import('../../engine/points.js');
const profileCard = await import('../../engine/profile-card.js');
const leveling = await import('../../leveling/index.js');
const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

const types = read('../../web/types.ts');
const constants = read('../../web/constants.ts');
const VIEWS = new Set([...types.match(/export type AppView =([^;]+);/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
const LANGS = ['en', 'es'];
const tokens = (text) => [...String(text).matchAll(g.GUIDE_TOKEN)].map((m) => `${m[1]}:${m[2]}`);

test('the Guides screen is a screen, and every way it sends somebody goes to one that exists', () => {
  assert.ok(VIEWS.has('guides'), 'guides is an AppView');
  assert.ok(VIEWS.size > 30, 'the AppView union was read');
  const named = [];
  for (const guide of g.GUIDES) {
    named.push(...guide.screens.map((s) => [s, `${guide.id} screens`]));
    guide.steps.forEach((s, i) => s.go && named.push([s.go, `${guide.id} step ${i + 1}`]));
    for (const lang of LANGS) for (const text of g.guideTexts(guide, lang)) {
      for (const tok of tokens(text)) if (tok.startsWith('screen:')) named.push([tok.slice(7), `${guide.id} (${lang})`]);
    }
  }
  for (const c of g.SETUP_CHECKS) if (c.go) named.push([c.go, `check ${c.id}`]);
  for (const w of g.GLOSSARY) if (w.go) named.push([w.go, `glossary ${w.id}`]);
  for (const b of g.BUILTIN_WORDS) named.push([b.go, `word ${b.id}`]);
  for (const [view, where] of named) assert.ok(VIEWS.has(view), `${where} goes to "${view}", which is no screen`);
});

test('every guide says the same in both languages: its words, its steps, and the same screens and buttons in each', () => {
  const ids = new Set();
  for (const guide of g.GUIDES) {
    assert.ok(!ids.has(guide.id), `${guide.id} twice`);
    ids.add(guide.id);
    assert.ok(g.GUIDE_GROUPS.some((x) => x.id === guide.group), `${guide.id} is in no group`);
    assert.ok(guide.steps.length >= 3, `${guide.id} has too few steps to be a guide`);
    for (const lang of LANGS) {
      for (const part of ['title', 'intro', 'worked']) assert.ok(guide[lang]?.[part]?.trim(), `${guide.id} has no ${lang} ${part}`);
      guide.steps.forEach((s, i) => assert.ok(s[lang]?.trim(), `${guide.id} step ${i + 1} has no ${lang}`));
    }
    // A link or a button named in one language and not the other is a step the other reader cannot follow.
    const sorted = (texts) => texts.flatMap(tokens).sort().join(' ');
    assert.equal(sorted([guide.es.intro, guide.es.worked]), sorted([guide.en.intro, guide.en.worked]), `${guide.id}: the two languages name different things`);
    guide.steps.forEach((s, i) => assert.equal(sorted([s.es]), sorted([s.en]), `${guide.id} step ${i + 1}: the two languages name different things`));
  }
  for (const group of g.GUIDE_GROUPS) assert.ok(group.en && group.es && g.GUIDES.some((x) => x.group === group.id), `${group.id} is empty or unnamed`);
});

test('every button a guide names is a word the app has in both languages, and every page is one OBS can open', () => {
  const keys = new Set();
  const pages = new Set();
  for (const guide of g.GUIDES) for (const lang of LANGS) for (const text of g.guideTexts(guide, lang)) {
    for (const tok of tokens(text)) {
      if (tok.startsWith('t:')) keys.add(tok.slice(2));
      if (tok.startsWith('url:')) pages.add(tok.slice(4));
    }
  }
  assert.ok(keys.size >= 20, 'the guides name the buttons through the app’s words');
  for (const key of keys) assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
  assert.deepEqual([...pages].sort(), ['alerts', 'canvas', 'dock']);
  // And the README's pages are the same three, so the two never tell different stories.
  const readme = read('../../README.md');
  for (const mode of pages) assert.ok(readme.includes(`?mode=${mode}`), `the README has no ?mode=${mode}`);
});

test('a screen’s "?" opens one guide: no screen is claimed by two', () => {
  const owner = new Map();
  for (const guide of g.GUIDES) for (const s of guide.screens) {
    assert.ok(!owner.has(s), `${s} is in ${owner.get(s)} and ${guide.id}`);
    owner.set(s, guide.id);
  }
  assert.equal(g.guideForScreen('remote-players').id, 'remote-players');
  assert.equal(g.guideForScreen('layouts').id, 'layouts');
  assert.equal(g.guideForScreen('guides'), null);
  assert.equal(g.guideForScreen('dashboard'), null);
});

test('the setup steps tick themselves from what the app can see, remember what they saw, and count only what is needed', () => {
  for (const c of g.SETUP_CHECKS) {
    for (const lang of LANGS) assert.ok(c[lang]?.title && c[lang]?.why, `check ${c.id} has no ${lang} words`);
    if (c.guide) assert.ok(g.GUIDES.some((x) => x.id === c.guide), `check ${c.id} points at no guide`);
    // Before the server has said anything, nothing reads as done, and nothing throws.
    assert.equal(c.done({}), false, `${c.id} is done with nothing known`);
    assert.equal(c.done({ status: {}, data: {} }), false, `${c.id} is done with nothing known`);
  }
  const empty = g.setupState({ status: {}, data: {} });
  const needed = g.SETUP_CHECKS.filter((c) => !c.optional).length;
  assert.equal(empty.needed, needed);
  assert.equal(empty.left, needed);

  const all = {
    status: { twitch: 'connected', twitchBot: 'connected', obs: 'connected', discord: 'connected' },
    data: {
      surfaces: { canvas: 1, canvasInObs: 1, dock: 1, dockInObs: 1 },
      layouts: [{ id: 'a', scenes: ['Gameplay'] }],
      alertConfigs: [{ id: 'f', enabled: true }],
      streamActions: [{ id: 'x', trigger: { category: 'command', type: 'command_trigger', config: { commandId: 'c' } } }],
    },
  };
  const full = g.setupState(all);
  assert.equal(full.left, 0, 'all the needed steps are done');
  assert.deepEqual(full.items.filter((i) => !i.done).map((i) => i.check.id), ['backup'], 'only the hand-ticked one is left');
  // YouTube or TikTok is as good as Twitch; Omnilayer is as good as scene bindings.
  const other = { status: { tiktok: 'connected' }, data: { layouts: [{ id: 'a' }], omnilayer: { enabled: true } } };
  const ticks = Object.fromEntries(g.setupState(other).items.map((i) => [i.check.id, i.done]));
  assert.equal(ticks.platform, true);
  assert.equal(ticks['layout-on'], true);
  // A layout with no scenes, and Omnilayer off, is not yet on stream.
  assert.equal(g.setupState({ data: { layouts: [{ id: 'a', scenes: [] }] } }).items.find((i) => i.check.id === 'layout-on').done, false);
  // OBS closed after the stream page was seen in it: still ticked, as it was seen.
  const later = g.setupState({ status: {}, data: { surfaces: { canvasInObs: 0 } } }, { seen: ['stream-page', 'obs', 'platform'] });
  assert.equal(later.items.find((i) => i.check.id === 'stream-page').done, true);
  assert.equal(later.items.find((i) => i.check.id === 'obs').done, true);
  // What only a hand can tick is ticked by one, and nothing else is ticked by hand.
  assert.equal(g.setupState({}, { ticked: ['backup'] }).items.find((i) => i.check.id === 'backup').done, true);
  assert.equal(g.setupState({}, { ticked: ['alerts'] }).items.find((i) => i.check.id === 'alerts').done, false);
  // Everything that is only true while something is open is remembered once seen.
  for (const id of ['platform', 'obs', 'stream-page', 'dock', 'bot', 'discord']) {
    assert.ok(g.SETUP_CHECKS.find((c) => c.id === id).sticky, `${id} should stay ticked once seen`);
  }
});

test('the chat words that need no command are read from the settings as they are now', () => {
  const data = {
    ...engine.snapshot(),
    ...points.snapshot(),
    ...profileCard.snapshot(),
    xpConfig: leveling.getConfig(),
  };
  const found = Object.fromEntries(g.BUILTIN_WORDS.map((b) => [b.id, b.read(data)]));
  for (const b of g.BUILTIN_WORDS) {
    for (const lang of LANGS) assert.ok(b[lang]?.does, `${b.id} has no ${lang} words`);
    assert.ok(['anyone', 'mods'].includes(b.who), `${b.id}: who may use it`);
    assert.ok(found[b.id], `${b.id} found nothing in the settings`);
    assert.match(found[b.id].word, /^!\S+$/, `${b.id}: "${found[b.id].word}"`);
    // Nothing comes from settings that have not arrived.
    assert.equal(b.read({}), null, `${b.id} reads a word from nothing`);
    if (b.en.after || b.es.after) assert.ok(b.en.after && b.es.after, `${b.id} says what follows in one language only`);
  }
  assert.equal(found.plan.word, '!plan');
  assert.equal(found.question.word, '!pregunta');
  assert.equal(found.poll.word, '!encuesta');
  assert.equal(found.balance.word, '!puntos');
  assert.equal(found.rank.word, '!rank');
  // A word changed in the settings is the word the reference shows.
  const moved = g.BUILTIN_WORDS.find((b) => b.id === 'question').read({ questionSettings: { ask: { enabled: false, trigger: '!ask' } } });
  assert.deepEqual(moved, { on: false, word: '!ask' });
});

test('the server counts the pages open, by kind, and those inside OBS', () => {
  const counted = countSurfaces([
    { mode: 'canvas', inObs: true },
    { mode: 'canvas', inObs: false },
    { mode: 'dock', inObs: true },
    { mode: 'alerts' },
    { mode: 'dashboard', inObs: true },
    { mode: 'whatever' },
    null,
  ]);
  assert.deepEqual(counted, { canvas: 2, dock: 1, alerts: 1, canvasInObs: 1, dockInObs: 1, alertsInObs: 0 });
  const ws = read('../api/ws.js');
  assert.ok(ws.includes('ws.inObs = payload.obs === true;'), 'a page says whether it is in OBS');
  assert.ok(ws.includes('surfaces: surfacesNow(),'), 'a new page is told what is open');
  assert.match(ws, /publishSurfaces\(\);\s*\}\);/, 'a page going away is told to the others');
  assert.ok(read('../../web/hooks/useBackend.ts').includes('obs: Boolean((window as any).obsstudio)'), 'the page says whether OBS opened it');
});

test('the app has the tab: in the menu, in the search with each guide, a "?" on each screen, and on the dashboard', () => {
  const app = read('../../web/App.tsx');
  const view = read('../../web/components/views/GuidesView.tsx');
  assert.ok(app.includes(`{ view: 'guides', label: t.guidesNav || 'Guides'`), 'the menu has Guides');
  assert.ok(app.includes(`guides: t.guidesNav || 'Guides',`), 'the screen has a name');
  assert.ok(app.includes('onChoose: () => openGuideAt(g.id)'), 'the search opens each guide');
  assert.ok(read('../../web/components/NavMenu.tsx').includes('if (e.onChoose) e.onChoose(); else go(e.view);'));
  assert.ok(app.includes('data-screen-guide={screenGuide.id}') && app.includes('data-screen-guide-phone={screenGuide.id}'), 'a "?" on a desktop and on a phone');
  assert.ok(app.includes("{view === 'guides' && ("), 'the screen is drawn');
  assert.ok(read('../../web/components/views/DashboardView.tsx').includes("onClick={() => setView('guides')}"), 'the dashboard points at it');
  const keys = new Set([...(app + view + read('../../web/components/views/DashboardView.tsx')).matchAll(/\bt\.(guides[A-Za-z0-9_]+)/g)].map((m) => m[1]));
  assert.ok(keys.size >= 30);
  for (const key of keys) assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
});

// ------------------------------------------------------------ connecting each platform

test('each platform’s walkthrough says the same in both languages, and names only screens, buttons and fields the app has', () => {
  const ids = new Set();
  for (const p of g.PLATFORM_SETUPS) {
    assert.ok(!ids.has(p.id), `${p.id} twice`);
    ids.add(p.id);
    assert.ok(p.steps.length >= 2 && p.problems.length >= 1, `${p.id} is too thin to walk somebody through`);
    assert.ok(Number(p.minutes) > 0, `${p.id}: how long it takes`);
    if (p.portal) assert.match(p.portal, /^https:\/\/[^/]+\.[a-z]+\//, `${p.id}: the portal is a site`);
    for (const lang of LANGS) {
      for (const part of ['name', 'for', 'worked']) assert.ok(p[lang]?.[part]?.trim(), `${p.id} has no ${lang} ${part}`);
      p.steps.forEach((s, i) => assert.ok(s[lang]?.trim(), `${p.id} step ${i + 1} has no ${lang}`));
      p.problems.forEach((x, i) => assert.ok(x[lang]?.trim(), `${p.id} problem ${i + 1} has no ${lang}`));
      p.fields.forEach((f) => assert.ok(f[lang]?.trim(), `${p.id} field ${f.t} has no ${lang}`));
    }
    const sorted = (texts) => texts.flatMap(tokens).sort().join(' ');
    p.steps.forEach((s, i) => assert.equal(sorted([s.es]), sorted([s.en]), `${p.id} step ${i + 1}: the two languages name different things`));
    p.problems.forEach((x, i) => assert.equal(sorted([x.es]), sorted([x.en]), `${p.id} problem ${i + 1}: the two languages name different things`));
    assert.equal(sorted([p.es.worked]), sorted([p.en.worked]), `${p.id}: the two languages name different things`);
    for (const lang of LANGS) for (const text of g.platformTexts(p, lang)) {
      for (const tok of tokens(text)) {
        const [kind, name] = tok.split(':');
        if (kind === 'screen') assert.ok(VIEWS.has(name), `${p.id} goes to "${name}", which is no screen`);
        if (kind === 't') assert.equal(constants.split(`    ${name}: `).length - 1, 2, `${p.id}: ${name} is not in both languages`);
        if (kind === 'redirect') assert.ok(['page', 'loopback'].includes(name), `${p.id}: no such address as ${name}`);
        assert.notEqual(kind, 'url', `${p.id}: a sign-in has no OBS page in it`);
      }
    }
    p.steps.forEach((s) => s.go && assert.ok(VIEWS.has(s.go), `${p.id} goes to "${s.go}"`));
    for (const f of p.fields) assert.equal(constants.split(`    ${f.t}: `).length - 1, 2, `${p.id}: the field ${f.t} is not a word the Connections screen has`);
    // A platform that signs in through a site of its own gives the address to register there.
    const redirects = p.steps.flatMap((s) => tokens(s.en)).filter((x) => x.startsWith('redirect:'));
    if (['twitch', 'youtube', 'discord', 'spotify'].includes(p.id)) assert.equal(redirects.length, 1, `${p.id} gives one address to register`);
  }
  assert.deepEqual([...ids], ['twitch', 'twitch-bot', 'youtube', 'tiktok', 'obs', 'discord', 'spotify']);
  // The setup steps about a platform open its walkthrough.
  for (const c of g.SETUP_CHECKS) if (c.setup) assert.ok(ids.has(c.setup), `check ${c.id} opens no walkthrough`);
  assert.deepEqual(g.SETUP_CHECKS.filter((c) => c.setup).map((c) => c.id), ['platform', 'obs', 'bot', 'discord']);
});

test('the address each walkthrough says to register is the one the Connections screen signs in with', () => {
  const kindOf = (id) => g.PLATFORM_SETUPS.find((p) => p.id === id).steps.flatMap((s) => tokens(s.en)).find((x) => x.startsWith('redirect:'));
  assert.equal(kindOf('twitch'), 'redirect:page');
  assert.equal(kindOf('discord'), 'redirect:page');
  assert.equal(kindOf('spotify'), 'redirect:loopback');
  assert.equal(kindOf('youtube'), 'redirect:loopback');
  // page: the address the page is at; loopback: the same, localhost made 127.0.0.1 — as the logins send them.
  const connections = read('../../web/components/views/ConnectionsView.tsx');
  assert.equal(connections.split("redirectUri={typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}").length - 1, 2, 'Twitch and Discord register the page’s own address');
  assert.ok(connections.includes("redirectUri={typeof window !== 'undefined' ? spotifyRedirectUri() : ''}"));
  assert.ok(connections.includes("redirectUri={typeof window !== 'undefined' ? youtubeRedirectUri() : ''}"));
  const utils = read('../../web/utils.ts');
  assert.ok(utils.includes("if (url.hostname === 'localhost') url.hostname = '127.0.0.1';"), 'Spotify and Google come back to 127.0.0.1');
  // And the walkthrough writes them for the computer the app runs on, whatever address the guide was opened at.
  const view = read('../../web/components/views/GuidesView.tsx');
  assert.ok(view.includes("page.hostname = 'localhost';") && view.includes("loopback.hostname = '127.0.0.1';"));
  assert.ok(view.includes('data-guides-sign-in="elsewhere"'), 'opened from elsewhere, it says where to sign in instead');
  // The Discord button the walkthrough names is the one on the screen, in both languages.
  for (const key of ['discordLogin', 'discordPickServer']) {
    assert.equal(constants.split(`    ${key}: `).length - 1, 2, `${key} is not in both languages`);
    assert.ok(connections.includes(`t.${key} ||`), `Connections does not use ${key}`);
  }
});

test('a walkthrough says how far along each platform is', () => {
  const state = (id, s) => g.PLATFORM_SETUPS.find((p) => p.id === id).state(s);
  for (const p of g.PLATFORM_SETUPS) assert.equal(p.state({}), 'off', `${p.id} is on with nothing known`);
  assert.equal(state('twitch', { status: { twitch: 'connected' } }), 'on');
  assert.equal(state('twitch-bot', { status: { twitch: 'connected' } }), 'off');
  assert.equal(state('twitch-bot', { status: { twitchBot: 'connected' } }), 'on');
  assert.equal(state('tiktok', { status: { tiktok: 'waiting' } }), 'ready');
  assert.equal(state('tiktok', { status: { tiktok: 'polling' } }), 'ready');
  assert.equal(state('tiktok', { status: { tiktok: 'connected' } }), 'on');
  assert.equal(state('obs', { status: { obs: 'connected' } }), 'on');
  assert.equal(state('spotify', { status: { spotify: 'disconnected' } }), 'off');
});

test('YouTube, TikTok and OBS count as done once set up, not only while connected; the menu still lights only what is connected', () => {
  const state = (id, s) => g.PLATFORM_SETUPS.find((p) => p.id === id).state(s);
  const step = (id, s) => g.SETUP_CHECKS.find((c) => c.id === id).done(s);
  const off = { youtube: 'disconnected', tiktok: 'disconnected', obs: 'error', twitch: 'disconnected' };
  // Signed in to YouTube, a TikTok username, OBS with a password or reached before: set up, between streams too.
  assert.equal(state('youtube', { status: off, connections: { youtubeAuthorised: true } }), 'ready');
  assert.equal(state('tiktok', { status: off, connections: { tiktokUrl: 'someone' } }), 'ready');
  assert.equal(state('obs', { status: off, connections: { obsHasPassword: true } }), 'ready');
  assert.equal(state('obs', { status: off, connections: { obsLastConnectedAt: 1791000000000 } }), 'ready');
  // Nothing kept: still not.
  assert.equal(state('youtube', { status: off, connections: { youtubeAuthorised: false } }), 'off');
  assert.equal(state('tiktok', { status: off, connections: { tiktokUrl: '  ' } }), 'off');
  assert.equal(state('obs', { status: off, connections: { obsHasPassword: false, obsLastConnectedAt: 0 } }), 'off');
  // Connected beats set up.
  assert.equal(state('youtube', { status: { youtube: 'connected' }, connections: { youtubeAuthorised: true } }), 'on');
  // The steps tick the same way.
  assert.equal(step('platform', { status: off, connections: { youtubeAuthorised: true } }), true);
  assert.equal(step('platform', { status: off, connections: {} }), false);
  assert.equal(step('obs', { status: off, connections: { obsHasPassword: true } }), true);
  assert.equal(step('obs', { status: off, connections: {} }), false);
  // Both places hand the rules what is set up.
  const view = read('../../web/components/views/GuidesView.tsx');
  assert.ok(view.includes('p.state({ status: system?.status, data: system?.data, connections: system?.connections })'));
  assert.ok(view.includes("state === 'on' || state === 'ready' ? 'bg-emerald-500/10 text-emerald-400'"), 'set up is not shown as done');
  const app = read('../../web/App.tsx');
  assert.ok(app.includes('setupState({ status: system.status, data: system.data, connections: system.connections }'));
  // The server says OBS was reached before, and when.
  const obs = read('../platforms/obs.js');
  assert.ok(obs.includes('creds.set({ ...creds.get(), lastConnectedAt: Date.now() });') && obs.includes('lastConnectedAt: Number(c.lastConnectedAt) || 0'));
  const hook = read('../../web/hooks/useStreamSystem.ts');
  assert.ok(hook.includes('obsHasPassword: Boolean(c.obs?.hasPassword),') && hook.includes('obsLastConnectedAt: Number(c.obs?.lastConnectedAt) || 0,'));
  // The menu's row of platforms is untouched: lit by the status, connected or not.
  for (const id of ['youtube', 'tiktok', 'obs']) assert.ok(app.includes('ok: system.status.' + id + " === 'connected' }"), 'the menu lights ' + id + ' when it is only set up');
  for (const key of ['guidesPlatformReady']) assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
});
