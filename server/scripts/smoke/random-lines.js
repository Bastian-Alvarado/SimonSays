/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: one alternative per line, one picked at random, beyond the
 * action steps — alert captions and speech, the shoutout and clip lines,
 * !pregunta and !plan, the live DMs and the "stream over" message, level-up
 * messages, and the welcome card's words.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, EVENTS, fs, normaliseEvent, test } from './harness.js';

const { pickLine } = await import('../../../shared/pick-line.js');
const alerts = await import('../../engine/alerts.js');
const plan = await import('../../engine/plan.js');
const liveDms = await import('../../engine/live-dms.js');
const welcome = await import('../../engine/welcome.js');
const { cleanCard } = await import('../../../shared/card-css.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');

/** Math.random held at a value while `fn` runs: the first line at 0, the last near 1. */
function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
}

test('one line at random; a single line, blank lines and anything that is not text as they were', () => {
  assert.equal(pickLine('Hola {user}'), 'Hola {user}');
  assert.equal(pickLine('  spaced  '), '  spaced  ', 'a single line was trimmed');
  assert.equal(pickLine('uno\ndos\ntres', () => 0), 'uno');
  assert.equal(pickLine('uno\r\n\r\n  dos  \n', () => 0.99), 'dos', 'blank lines or spaces counted as alternatives');
  assert.equal(pickLine('solo\n\n'), 'solo');
  assert.equal(pickLine(undefined), undefined);
});

// ------------------------------------------------------------ alerts

const shown = [];
const keep = (a) => shown.push(a);
bus.on(EVENTS.ALERT, keep);
const config = alerts.normaliseAlert({
  id: 'rl-follow', type: 'follow', enabled: true,
  messageTemplate: '{user} is here!\nWelcome, {user}!\nLook who followed: {user}',
  tts: { enabled: true, text: 'Say one {alert}\nSay two {alert}' },
});
const follow = normaliseEvent({ type: 'twitch_follow', platform: 'twitch', user: 'Ana', data: {} });
withRandom(0, () => alerts.dispatch([config], follow));
withRandom(0.99, () => alerts.dispatch([config], follow));
bus.off(EVENTS.ALERT, keep);

test('an alert caption and its speech each pick one of their lines, and every surface gets that one', () => {
  assert.equal(shown[0].text, 'Ana is here!');
  assert.equal(shown[0].speak?.text, 'Say one Ana is here!', 'the speech did not pick a line, or {alert} is not the caption picked');
  assert.equal(shown[1].text, 'Look who followed: Ana');
  assert.equal(shown[1].speak?.text, 'Say two Look who followed: Ana');
  assert.ok(config.messageTemplate.length > 40 && alerts.normaliseAlert({ messageTemplate: 'x'.repeat(1200) }).messageTemplate.length === 1000, 'there is no room for a few alternatives');
});

// ------------------------------------------------------------ !plan, live DMs, welcome

const plain = plan.answerFor({ items: [{ id: 'a', text: 'Ranked' }], currentId: 'a', answer: { text: 'Now: {plan.current}\nOn now: {plan.current}' } });
const planFirst = withRandom(0, () => plan.answerFor({ items: [{ id: 'a', text: 'Ranked' }], currentId: 'a', answer: { text: 'Now: {plan.current}\nOn now: {plan.current}' } }));
const planLast = withRandom(0.99, () => plan.answerFor({ items: [{ id: 'a', text: 'Ranked' }], currentId: 'a', answer: { text: 'Now: {plan.current}\nOn now: {plan.current}' } }));
const dm = withRandom(0.99, () => liveDms.dmFor('twitch', { name: 'Rowan', title: 'Speedruns' }, { message: '{streamer} is live!\n{streamer} just went live: {title}' }));
const greet = withRandom(0.99, () => welcome.greetingFor({
  sendCard: true, messages: ['hi'], cardTitle: 'Welcome!\nLook who is here!', cardDescription: 'Line one\nLine two', cardFooter: 'Footer A\nFooter B',
}, { id: '1', username: 'ana' }, true));

test('the !plan answer, a live DM and a welcome card\'s title and footer pick a line; its description keeps its lines', () => {
  assert.ok(['Now: Ranked', 'On now: Ranked'].includes(plain), plain);
  assert.equal(planFirst, 'Now: Ranked');
  assert.equal(planLast, 'On now: Ranked');
  assert.equal(dm.content, 'Rowan just went live: Speedruns');
  assert.equal(greet.embed.title, 'Look who is here!');
  assert.equal(greet.embed.footer, 'Footer B');
  assert.equal(greet.embed.description, 'Line one\nLine two', 'the description lost its lines');
});

test('the drawn welcome card keeps its alternatives, and picks one each time it is drawn', () => {
  const card = cleanCard({ title: 'Welcome\r\nHello', name: '{username}', subtitle: 'Member #{count}\nNumber {count}' });
  assert.equal(card.title, 'Welcome\nHello', 'the card squashed its lines into one');
  assert.equal(card.subtitle, 'Member #{count}\nNumber {count}');
  assert.ok(read('../engine/welcome-card.js').includes("[['title', fill(pickLine(c.title))], ['name', fill(pickLine(c.name))], ['subtitle', fill(pickLine(c.subtitle))]]"));
});

test('the shoutout and clip lines, !pregunta, the "stream over" message and level-ups pick a line too', () => {
  const extras = read('../engine/twitch-extras.js');
  assert.ok(extras.includes('const picked = pickLine(cfg.message);') && extras.includes("const line = vars.game ? picked : picked.replace("), 'the shoutout picks after taking the game out, or not at all');
  assert.ok(extras.includes('await api.say(fill(pickLine(cfg.message), { url: made.url }));'));
  assert.ok(read('../engine/questions.js').includes('const text = fill(pickLine(ask.replyText), { user: name });'));
  const announce = read('../engine/announce.js');
  assert.equal(announce.split("fillNext(pickLine(cfg.overMessage || ''))").length - 1, 2, 'the edited and the posted "stream over" message are not both picked');
  assert.ok(read('../leveling/index.js').includes("String(pickLine(c.levelUpMessage || ''))"));
  // And the steps use the same one, not a copy of their own.
  const steps = read('../engine/steps.js');
  assert.ok(steps.includes("import { pickLine } from '../../shared/pick-line.js';") && !steps.includes('function pickLine('));
});

test('every box that takes alternatives is one that can hold them, and says so in both languages', () => {
  const boxes = {
    '../../web/components/views/AlertsView.tsx': ['alert-caption', 'alert-tts'],
    '../../web/components/views/TwitchView.tsx': ['shoutout', 'clip'],
    '../../web/components/views/QuestionsView.tsx': ['question-reply'],
    '../../web/components/views/PlanView.tsx': ['plan-answer'],
    '../../web/components/views/GoLiveView.tsx': ['live-dm', 'go-live-over'],
    '../../web/components/views/LevelsView.tsx': ['level-up'],
    '../../web/components/views/WelcomeGoodbyeView.tsx': ['greet-title', 'greet-footer'],
    '../../web/components/WelcomeCardEditor.tsx': ['card-title', 'card-name', 'card-subtitle'],
  };
  for (const [file, ids] of Object.entries(boxes)) {
    const src = read(file);
    for (const id of ids) {
      const at = src.indexOf(`data-random-lines="${id}"`);
      assert.ok(at > 0, `${id}: no box`);
      const tag = src.slice(src.lastIndexOf('<', at), at);
      assert.ok(/<textarea|as="textarea"/.test(tag), `${id} is a single-line input, which cannot hold a second line`);
    }
    assert.ok(src.includes('t.oneLinePerOption'), `${file} does not say one per line`);
  }
  const constants = read('../../web/constants.ts');
  assert.equal(constants.split("    oneLinePerOption: '").length - 1, 2);
  // The previews show one alternative at a time, not all of them at once.
  assert.ok(read('../../web/components/views/AlertsView.tsx').includes('lines[(Number(previewKey) || 0) % lines.length]'));
  assert.ok(read('../../web/components/views/WelcomeGoodbyeView.tsx').includes('title: fillGreeting(oneOf(data.cardTitle'));
});
