/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: skipping and pausing alerts, holding them while nothing on
 * stream shows them, their sound from one page, fuller variations and firing
 * one, the platform words in Spanish, and the deck's numbered pages.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { EVENTS, SCRIPT_URL, assert, bus, fs, test } from './harness.js';

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');
const gate = await import('../../engine/alert-gate.js');
const { normaliseAlert, buildTestEvent, dispatch, CONDITION_FIELDS } = await import('../../engine/alerts.js');
const { collection } = await import('../../core/store.js');
const { says } = await import('../../../shared/platforms.js');
const { DOCK_BUILTINS } = await import('../../../shared/dock-builtins.js');

/*
  The gate with a stand-in hub: what reached the pages, what the pages were
  told, and whether OBS is open and anything on stream shows alerts. The real
  hub (ws.js's) goes back after.
*/
const withGate = (fn) => {
  const real = gate.alertGateHubForTests();
  const seen = { delivered: [], told: [], streamOpen: false, shows: true };
  gate.connectAlertGate({
    deliver: (a) => seen.delivered.push(a.id),
    tellPages: (p) => seen.told.push(p.op),
    streamOpen: () => seen.streamOpen,
    anyoneShows: () => seen.shows,
  });
  gate.resetAlertGateForTests();
  try {
    fn(seen);
  } finally {
    gate.resetAlertGateForTests();
    gate.controlAlerts('hold', true);
    gate.connectAlertGate(real);
  }
};
const alert = (id, extra = {}) => ({ id, config: { duration: 4000 }, ...extra });

test('alerts can be paused and resumed: new ones wait, then go out in order; a test is never held', () => {
  withGate((seen) => {
    assert.equal(gate.offerAlert(alert('a')), 'shown');
    gate.controlAlerts('pause');
    assert.deepEqual(gate.alertGateState(), { paused: true, held: 0, holdUnseen: true });
    assert.equal(gate.offerAlert(alert('b')), 'held');
    assert.equal(gate.offerAlert(alert('c')), 'held');
    // Fire on stream and the Events dock's replay are somebody asking to see it now.
    assert.equal(gate.offerAlert(alert('test', { manual: true })), 'shown');
    assert.equal(gate.alertGateState().held, 2);
    assert.deepEqual(gate.controlAlerts('toggle'), { ok: true, paused: false });
    assert.deepEqual(seen.delivered, ['a', 'test', 'b', 'c'], 'the waiting alerts went out of order, or not at all');
    assert.equal(gate.alertGateState().held, 0);
  });
});

test('Skip ends the alert on screen on every page, and says so when there is none', () => {
  withGate((seen) => {
    assert.throws(() => gate.controlAlerts('skip'), (err) => err.code === 'alert_nothing_showing');
    gate.offerAlert(alert('a'));
    gate.offerAlert(alert('b'));
    assert.deepEqual(gate.controlAlerts('skip'), { ok: true });
    assert.deepEqual(seen.told, ['skip']);
    // The second is playing now, so there is still one to skip; after it, none.
    gate.controlAlerts('skip');
    assert.throws(() => gate.controlAlerts('skip'), (err) => err.code === 'alert_nothing_showing');
  });
});

test('Clear drops what is waiting, here and in each page\'s line', () => {
  withGate((seen) => {
    gate.controlAlerts('pause');
    gate.offerAlert(alert('a'));
    gate.offerAlert(alert('b'));
    assert.deepEqual(gate.controlAlerts('clear'), { ok: true, cleared: 2 });
    assert.deepEqual(seen.told, ['clear']);
    gate.controlAlerts('resume');
    assert.deepEqual(seen.delivered, [], 'a cleared alert still played');
  });
});

test('with OBS open on a scene that shows no alerts, they wait for one that does — or not, when hold is off', () => {
  withGate((seen) => {
    seen.streamOpen = true;
    seen.shows = false;
    assert.equal(gate.offerAlert(alert('brb')), 'held', 'an alert during a BRB scene played on no page');
    assert.equal(gate.releaseAlerts(), 0, 'it went out with nothing to show it');
    seen.shows = true;
    assert.equal(gate.releaseAlerts(), 1);
    assert.deepEqual(seen.delivered, ['brb']);
    // OBS closed: nothing is on stream to wait for, so it goes as it always did.
    seen.streamOpen = false;
    seen.shows = false;
    assert.equal(gate.offerAlert(alert('offline')), 'shown');
    // Hold off: an alert nothing shows is missed, as before.
    seen.streamOpen = true;
    assert.deepEqual(gate.controlAlerts('hold', false), { ok: true, holdUnseen: false });
    assert.equal(collection('alert_settings', {}).get().holdUnseen, false, 'the choice is not kept');
    assert.equal(gate.offerAlert(alert('missed')), 'shown');
  });
});

test('at most fifty wait, and one that waited over half an hour is dropped rather than played late', () => {
  withGate((seen) => {
    gate.controlAlerts('pause');
    for (let i = 0; i < gate.HOLD_MAX + 5; i += 1) gate.offerAlert(alert(`n${i}`));
    assert.equal(gate.alertGateState().held, gate.HOLD_MAX);
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + gate.HOLD_MAX_MS + 1000;
      gate.controlAlerts('resume');
    } finally {
      Date.now = realNow;
    }
    assert.deepEqual(seen.delivered, [], 'alerts from over half an hour ago played');
  });
});

test('the state reaches every page, and the deck and the screen share the same controls', () => {
  withGate(() => {
    const heard = [];
    const listen = (c) => { if (c.key === 'alertGate') heard.push(c.value); };
    bus.on(EVENTS.CONFIG, listen);
    try {
      gate.controlAlerts('pause');
      gate.controlAlerts('resume');
    } finally {
      bus.off(EVENTS.CONFIG, listen);
    }
    assert.deepEqual(heard.map((h) => h.paused), [true, false]);
  });
  assert.throws(() => gate.controlAlerts('explode'), (err) => err.code === 'bad_request');
  const ws = read('../api/ws.js');
  assert.ok(ws.includes('bus.on(EVENTS.ALERT, (a) => offerAlert(a));'), 'alerts go to the pages without the gate');
  assert.ok(ws.includes('case C2S.ALERT_CONTROL:') && ws.includes('alertGate: alertGateState(),'), 'the screens cannot reach it');
  assert.ok(read('../engine/index.js').includes("{ manual: true, variationId }") && read('../engine/index.js').includes('null, { manual: true });'), 'a test or a replay can be held by a pause');
  const builtins = DOCK_BUILTINS.filter((b) => b.category === 'alerts').map((b) => `${b.id}:${b.op}`);
  assert.deepEqual(builtins, ['alert_skip:skip', 'alert_pause:toggle']);
  assert.ok(read('../engine/backup.js').includes("{ name: 'alert_settings' }"), 'the hold choice is not backed up');
});

test('a page skips and clears as told, and stops reading only the skipped alert aloud', () => {
  const hook = read('../../web/hooks/useStreamSystem.ts');
  assert.ok(hook.includes('on(S2C.ALERT_CONTROL,') && hook.includes("if (p?.op === 'clear') setAlertQueue([]);"), 'pages do not hear skip or clear');
  assert.ok(hook.includes('if (now) stopReadingAlert(now.id);') && hook.includes('speakAloud(speak, currentAlert!.id)'), 'skipping an alert keeps reading it, or stops every reading');
  assert.ok(hook.includes('for (const e of rest) speakAloud(e.said, e.alertId);'), 'a !tts queued behind a skipped alert is lost');
  const view = read('../../web/components/views/AlertsView.tsx');
  for (const mark of ['data-alert-gate', 'data-alert-skip', 'data-alert-pause', 'data-alert-clear', 'data-alert-hold']) {
    assert.ok(view.includes(mark), `the Alerts screen has no ${mark}`);
  }
});

test('an alert\'s sound plays on the one page that speaks, so two pages in OBS are heard once', () => {
  const ws = read('../api/ws.js');
  assert.ok(ws.includes('ws === sink ? { ...a, audible: true } : shown'), 'every page is allowed the sound');
  assert.ok(read('../../web/components/CanvasStage.tsx').includes('playSound={Boolean(system.data.currentAlert.audible)}'), 'the stream page plays every alert\'s sound');
  assert.ok(read('../../web/App.tsx').includes('playSound={Boolean(system.data.currentAlert.audible)}'), 'the alerts page plays every alert\'s sound');
  assert.ok(!/<AlertOverlay[^>]*playSound \/>/.test(read('../../web/App.tsx') + read('../../web/components/CanvasStage.tsx')), 'a page still always plays the sound');
});

test('any-platform and YouTube alerts can vary by size, and a Super Chat carries its money as a number', () => {
  const offered = (type) => CONDITION_FIELDS.filter((f) => f.types.includes(type)).map((f) => f.field);
  assert.deepEqual(offered('cheer'), ['bits', 'value']);
  assert.deepEqual(offered('sub'), ['tier', 'months']);
  assert.deepEqual(offered('raid'), ['viewers']);
  assert.deepEqual(offered('sub_gift_bulk'), ['count']);
  assert.deepEqual(offered('youtube_cheer'), ['value']);
  assert.deepEqual(offered('youtube_sub'), ['months']);
  assert.deepEqual(offered('youtube_sub_gift_bulk'), ['count']);
  assert.ok(read('../platforms/youtube.js').includes('value: Number(details.amountMicros || 0) / 1e6,'), 'a Super Chat\'s money is text only');
  // A tip variation in bits answers a Twitch cheer and never a Super Chat, and the other way round.
  const tip = normaliseAlert({
    id: 'tip', type: 'cheer', messageTemplate: '{user}',
    variations: [
      { id: 'bits', name: 'Muchos bits', conditions: [{ field: 'bits', op: 'gte', value: 1000 }], soundUrl: '/media/big.mp3' },
      { id: 'money', name: 'Mucho dinero', conditions: [{ field: 'value', op: 'gte', value: 20 }], soundUrl: '/media/money.mp3' },
    ],
  });
  const shown = [];
  const listen = (a) => shown.push(a.config.variationId || 'base');
  bus.on(EVENTS.ALERT, listen);
  try {
    dispatch([tip], { type: 'twitch_cheer', platform: 'twitch', user: 'A', data: { bits: 5000 } });
    dispatch([tip], { type: 'youtube_cheer', platform: 'youtube', user: 'B', data: { amount: '$25.00', value: 25 } });
    dispatch([tip], { type: 'youtube_cheer', platform: 'youtube', user: 'C', data: { amount: '$2.00', value: 2 } });
  } finally {
    bus.off(EVENTS.ALERT, listen);
  }
  assert.deepEqual(shown, ['bits', 'money', 'base']);
});

test('a variation can set everything the alert has, and keeps white text and Montserrat as chosen', () => {
  const a = normaliseAlert({
    id: 'v', type: 'twitch_cheer',
    variations: [{
      id: 'x', name: 'Grande', conditions: [{ field: 'bits', op: 'gte', value: 100 }],
      layout: 'image-cover', fontFamily: 'Montserrat', textColor: '#ffffff', accentColor: '#f43f5e', duration: 9000,
      animationIn: 'animate-zoom-in', animationOut: 'animate-pop-out', soundVolume: 0, highlightText: false,
    }],
  });
  const [v] = a.variations;
  assert.deepEqual(
    [v.layout, v.fontFamily, v.textColor, v.accentColor, v.duration, v.animationIn, v.animationOut, v.soundVolume, v.highlightText],
    ['image-cover', 'Montserrat', '#ffffff', '#f43f5e', 9000, 'animate-zoom-in', 'animate-pop-out', 0, false],
  );
  const view = read('../../web/components/views/AlertsView.tsx');
  for (const mark of ['data-alert-variation-layout', 'data-alert-variation-font', 'data-alert-variation-duration', 'data-alert-variation-in', 'data-alert-variation-out', 'data-alert-variation-volume', 'data-alert-variation-highlight', 'data-alert-variation-colour', 'data-alert-variation-upload', 'data-alert-variation-fire']) {
    assert.ok(view.includes(mark), `a variation's editor has no ${mark}`);
  }
});

test('"Fire this one" plays that variation, at numbers its conditions ask for', () => {
  const a = normaliseAlert({
    id: 'f', type: 'twitch_cheer', messageTemplate: '{user} {event.bits}',
    variations: [
      { id: 'small', name: 'Pocos', conditions: [{ field: 'bits', op: 'gte', value: 100 }] },
      { id: 'big', name: 'Muchos', conditions: [{ field: 'bits', op: 'gte', value: 10000 }, { field: 'bits', op: 'lte', value: 50000 }] },
      { id: 'cap', name: 'Tope', conditions: [{ field: 'bits', op: 'lte', value: 50 }] },
    ],
  });
  assert.equal(buildTestEvent(a, 'big').data.bits, 10000);
  assert.equal(buildTestEvent(a, 'cap').data.bits, 50);
  assert.equal(buildTestEvent(a, 'big').data.amount, 10000, 'a test cheer says 10000 bits and an amount of 500');
  assert.equal(buildTestEvent(a).data.bits, 500, 'a plain test lost its sample');
  const heard = [];
  const listen = (x) => heard.push(x);
  bus.on(EVENTS.ALERT, listen);
  try {
    // "small" also holds at 10000 and comes first; asked for "big", big it is.
    dispatch([a], buildTestEvent(a, 'big'), null, null, { manual: true, variationId: 'big' });
  } finally {
    bus.off(EVENTS.ALERT, listen);
  }
  assert.equal(heard[0].config.variationId, 'big');
  assert.equal(heard[0].text, 'TestUser 10000');
  assert.equal(heard[0].manual, true);
});

test('the platform words are Spanish, for captions and chat, and the variable list offers them', () => {
  assert.deepEqual(['follower', 'supporter', 'gift', 'tip'].map((k) => says('twitch', k)), ['seguidor', 'suscriptor', 'sub de regalo', 'bits']);
  assert.deepEqual(['follower', 'supporter', 'tip'].map((k) => says('youtube', k)), ['suscriptor', 'miembro', 'Super Chat']);
  assert.deepEqual(['follower', 'tip'].map((k) => says('tiktok', k)), ['seguidor', 'monedas']);
  const picker = read('../../web/components/VariablePicker.tsx');
  for (const k of ['follower', 'followers', 'followed', 'supporter', 'supporters', 'gift', 'tip']) {
    assert.ok(picker.includes(`token: 'words.${k}'`), `{words.${k}} is not in the variable list`);
  }
  assert.ok(picker.includes('  youtube_cheer: [') && picker.includes("token: 'event.value'"), 'a Super Chat\'s fields are not listed');
});

test('the deck\'s pages are numbered buttons, one tap to any of them', () => {
  const deck = read('../../web/components/DockDeck.tsx');
  assert.ok(deck.includes('data-dock-page-number={i}') && deck.includes('{i + 1}'), 'the pages have no numbered buttons');
  assert.ok(deck.includes('onClick={() => go(i)}'), 'a number does not go straight to its page');
  assert.ok(!deck.includes('data-dock-page-dot') && !deck.includes('data-dock-page-prev'), 'the dots and arrows are still there');
  assert.ok(deck.includes("aria-current={i === page ? 'page' : undefined}"), 'the page you are on is not marked');
});
