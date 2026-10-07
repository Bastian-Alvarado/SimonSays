/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the chat on stream. Every chat on stream is a layer on a
 * layout; the standalone chat page that came before is retired and draws
 * nothing. The stream's clock and names are Spanish, and emotes are drawn
 * from a picture big enough for their size.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';
import { emoteImageUrl } from '../../../shared/emotes.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const APP = read('../../web/App.tsx');
const SCREEN = read('../../web/components/views/ChatDockView.tsx');
const { showsAlerts } = await import('../../api/ws.js');

test('a browser source still pointed at the retired chat page draws nothing on stream', () => {
  /*
    Not the dock, and not the whole dashboard — which is what an unknown mode
    falls through to, and would be on stream. Before the dock, so the dock's
    page can never be what it draws.
  */
  const retired = APP.indexOf("if (mode === 'overlay') return <style>{'body, html { background: transparent !important; }'}</style>;");
  assert.ok(retired > 0, 'the retired chat page draws something');
  assert.ok(retired < APP.indexOf("if (mode === 'dock') { return ("), 'the retired chat page reaches the dock first');
  assert.ok(!APP.includes("mode === 'dock' || mode === 'overlay'"), 'the dock\'s page is still the chat overlay\'s too');
});

test('a page still pointed at the chat overlay shows no alerts and is not where they are read aloud', () => {
  assert.equal(showsAlerts({ mode: 'overlay' }, []), false, 'the chat overlay still counts as showing alerts');
  assert.equal(showsAlerts({ mode: 'alerts' }, []), true);
  assert.ok(!APP.includes("mode === 'overlay' && system.data.currentAlert"), 'the chat overlay still draws alerts');
  assert.ok(!SCREEN.includes('AlertOverlay'), 'the preview shows alerts the overlay no longer shows');
});

test('the stream\'s clock and an anonymous cheer are in Spanish', () => {
  const row = read('../../web/components/ChatMessageRow.tsx');
  assert.ok(row.includes("if (onStream && (chat as any).at) {") && row.includes("toLocaleTimeString('es', {"), 'the stream reads the clock in OBS\'s language');
  const tw = read('../platforms/twitch.js');
  assert.ok(tw.includes("const ANONYMOUS = 'Anónimo';"));
  assert.ok(tw.includes("=== 'ananonymouscheerer' ? ANONYMOUS"), 'an anonymous cheer on IRC is AnAnonymousCheerer');
  assert.ok(tw.includes('user: (!e.is_anonymous && e.user_name) || ANONYMOUS'), 'an anonymous cheer from EventSub is "Anonymous"');
  assert.ok(!tw.includes("'Anonymous'"));
});

test('an emote is drawn from a picture at least as big as it is shown', () => {
  const at = (size, density) => emoteImageUrl('25', size, density).split('/').pop();
  assert.equal(at(18), '1.0');
  assert.equal(at(28), '1.0');
  assert.equal(at(37), '2.0', 'the stream\'s 37px emote is stretched from 28px');
  assert.equal(at(56), '2.0');
  assert.equal(at(64), '3.0');
  assert.equal(at(37, 2), '3.0', 'a sharper screen is not given a sharper picture');
  assert.equal(emoteImageUrl('emotesv2_abc', 24), 'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_abc/default/dark/1.0');
  assert.ok(read('../../web/utils.ts').includes('src: emoteImageUrl(part.emote, size,'), 'the chat still draws the smallest picture');
});
