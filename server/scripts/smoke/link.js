/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The link between a page and the server, when it is slow or gone.
 *
 * Found the hard way (2026-11-08): the server's phone fell to 200 kbit/s, the
 * state a page is sent on connecting took longer than the heartbeat allows,
 * and every dashboard was dropped and started again each 30 seconds. Accounts
 * read as signed out, the overlay editor said "All changes saved" over
 * changes that never arrived, and a refused bot sign-in said nothing at all.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';
import { stillSending, SLOW_ROUNDS_MAX } from '../../api/ws.js';

const read = (rel) => fs.readFileSync(new URL(rel, SCRIPT_URL), 'utf8').split('\r\n').join('\n');

test('a page still being sent its state is not dropped for a late pong, but one gone for good still is', () => {
  // Nothing waiting to go out: silence means gone.
  assert.equal(stillSending({ bufferedAmount: 0 }), false);
  // Data still on its way: given a round, and another, up to the limit.
  const slow = { bufferedAmount: 500_000 };
  for (let i = 0; i < SLOW_ROUNDS_MAX; i++) assert.equal(stillSending(slow), true, `round ${i + 1}`);
  assert.equal(stillSending(slow), false, 'a connection that never drains is kept for ever');
  const ws = read('../api/ws.js');
  assert.ok(ws.includes('if (!ws.isAlive && stillSending(ws)) continue;'), 'the heartbeat does not ask');
  // Answered a ping: the count starts again.
  assert.ok(ws.includes('ws.slowRounds = 0;'));
});

test('what a page is sent is squeezed, and only when it is big enough to be worth it', () => {
  const ws = read('../api/ws.js');
  assert.ok(ws.includes('perMessageDeflate: { threshold: 2048, concurrencyLimit: 4 }'));
});

test('a refusal nobody waited for is still told to the page that asked, with what it was for', () => {
  const ws = read('../api/ws.js');
  assert.ok(ws.includes("...(id ? {} : { for: type }) }, id ? { id } : {});"));
  const backend = read('../../web/hooks/useBackend.ts');
  assert.ok(backend.includes('if (msg.type === S2C.ERROR) { if (!msg.id) setRefused({ ...(msg.payload || {}), at: Date.now() }); return; }'));
  // A moderator's page is not told of what it may not ask: it sends some of those unprompted.
  assert.ok(ws.includes("if (!id && err.code === 'signin_not_allowed') return;"));
  const notice = read('../../web/components/LinkNotice.tsx');
  assert.ok(notice.includes('data-link-refused'));
});

test('the dashboard says when it has no server, or not its state yet, and the profile bar does not say "saved" then', () => {
  const backend = read('../../web/hooks/useBackend.ts');
  assert.ok(backend.includes('if (type === S2C.SNAPSHOT) setLoaded(true);'));
  assert.ok(backend.includes('setLoaded(false);'), 'a dropped connection still reads as loaded');
  // What was asked on a connection that closed is refused at once, not after its 15 seconds.
  assert.ok(backend.includes("for (const [, p] of pendingRef.current) p.reject(new Error('not connected'));"));
  const app = read('../../web/App.tsx');
  assert.ok(app.includes('<LinkNotice link={system.link} t={t} />'));
  assert.ok(app.includes('link={system.link}'));
  const bar = read('../../web/components/ProfileSwitcher.tsx');
  const offline = bar.indexOf('link && (!link.connected || !link.loaded)');
  assert.ok(offline > 0 && offline < bar.indexOf('state.dirty ? ('), 'the link is asked about before "saved" is said');
  const words = read('../../web/constants.ts');
  for (const key of ['linkOffline', 'linkLoading', 'linkRefused', 'profileOffline', 'profileSending']) assert.equal(words.split(`    ${key}: `).length - 1, 2, key);
});

test('a layout save is kept until the server answers, shown meanwhile, and sent again when the link is back', () => {
  const sys = read('../../web/hooks/useStreamSystem.ts');
  assert.ok(sys.includes('request(C2S.SET_LAYOUTS, list).then(() => {'), 'saved without waiting to hear it arrived');
  assert.ok(sys.includes('if (list && unsavedLayoutsRef.current !== list) return;'), 'an older answer settles a newer save');
  assert.ok(sys.includes("if (err?.message === 'not connected') return;"), 'a save made offline is given up');
  // A refusal is an answer: the page goes back to what the server has, and says so.
  assert.ok(sys.includes('dropUnsavedLayouts(list);\n      showRefused('), 'a refused save stays on the page for ever');
  // One nobody answered, on a link still up, is asked again while it is the newest.
  assert.ok(sys.includes("if (/timed out/.test(String(err?.message))) { if (unsavedLayoutsRef.current === list) sendLayouts(list); return; }"));
  // And never sent over another profile's layouts.
  assert.ok(sys.includes('if (unsavedOnProfileRef.current !== overlayProfile) { dropUnsavedLayouts(); return; }'));
  assert.ok(sys.includes('sendLayouts(unsavedLayoutsRef.current);'));
  assert.ok(sys.includes("layouts: peeked('layouts', unsavedLayouts ?? (snapshot as any).layouts ?? []),"), 'the editor goes back to the old layout while a save is on its way');
  assert.ok(!sys.includes('send(C2S.SET_LAYOUTS'));
  // And the server answers it.
  const ws = read('../api/ws.js');
  const at = ws.indexOf('case C2S.SET_LAYOUTS:');
  assert.ok(ws.slice(at, at + 700).includes('return reply({ ok: true });'));
});

test('the reskin\'s reach-everything rules stop at a stream preview, like the rest of it', () => {
  const css = read('../../web/ss-ui.css');
  const lines = css.split('\n').map((l) => l.trim());
  for (const l of lines) {
    assert.ok(!l.startsWith('.ss-ui * {'), `reaches into previews: ${l}`);
    assert.ok(!l.startsWith('.ss-ui :focus-visible'), `reaches into previews: ${l}`);
    assert.ok(!l.startsWith('.ss-ui ::-webkit-scrollbar'), `reaches into previews: ${l}`);
  }
  // A scope with a fence names both kinds of preview. (One without is for a part no preview holds, like the theme cartridges.)
  const fenced = lines.filter((l) => l.startsWith('@scope') && l.includes(' to ('));
  assert.ok(fenced.length >= 3);
  for (const s of fenced) {
    for (const stop of ['.canvas-stage', '.ss-keep']) assert.ok(s.includes(stop), `${stop} missing from ${s}`);
  }
});
