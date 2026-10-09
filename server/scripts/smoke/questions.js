/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the question queue, the Questions screen and the question card.
 * The built-in "!pregunta", the same question twice, editing, adding by hand,
 * "Next question", a deleted message or a timeout taking a waiting question
 * with it, the end of a stream; both languages, "Clear all" asking first, and
 * a question too tall for its card sliding to show the rest.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, chat, collection, engine, EVENTS, fs, said, settle, test } from './harness.js';

const questions = await import('../../engine/questions.js');

const read = (path) => fs.readFileSync(new URL(path, SCRIPT_URL), 'utf8');

test('the Questions screen speaks both languages', () => {
  const view = read('../../web/components/views/QuestionsView.tsx');
  const constants = read('../../web/constants.ts');
  const keys = [...new Set([...view.matchAll(/\bt\.(questions[A-Za-z]+)/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 13, `only ${keys.length} strings found`);
  for (const key of keys) assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  // The hint names the step the way the Actions screen does.
  assert.ok(constants.includes('“Questions: add to queue” step') && constants.includes('«Preguntas: agregar a la cola»'));
});

test('clearing every question asks first', () => {
  const view = read('../../web/components/views/QuestionsView.tsx');
  assert.ok(view.includes("if (window.confirm(t.questionsClearAllConfirm"), 'one slip throws the whole queue away');
});

test('a question too tall for its card slides to show the rest, like the omnibar', () => {
  const card = read('../../web/components/QuestionOverlay.tsx');
  assert.ok(card.includes('const spare = el.scrollHeight - el.clientHeight;'), 'nothing measures whether it fits');
  assert.ok(card.includes("over ? 'animate-question-drift' : ''"), 'it does not move when it does not fit');
  assert.ok(card.includes("['--question-drift' as any]: `${-over}px`"), 'it does not know how far to go');
  assert.ok(card.includes('className="min-h-0 overflow-hidden" data-question="window"'), 'the window cannot shrink below the question, so nothing is ever out of sight to slide to');
  assert.ok(card.includes('data-question="head">') || card.includes('shrink-0" data-question="head"'), 'the head is squeezed instead of the question');
  const tw = read('../../web/tailwind.config.js');
  assert.ok(/'question-drift': 'questionDrift/.test(tw) && tw.includes("translateY(var(--question-drift, 0px))"), 'the slide is not defined');
  assert.ok(read('../../web/components/LayerCssPanel.tsx').includes('[data-question="window"]'), 'a look cannot reach the window');
});

// ------------------------------------------------------------ the queue itself

const items = () => questions.getQuestions().items;
const byText = (text) => items().find((q) => q.text === text);

questions.clear();
questions.addQuestion({ user: 'Ana', platform: 'twitch', text: '¿Cuál es tu juego favorito?' });
const twice = questions.addQuestion({ user: 'ana', platform: 'twitch', text: '  ¿cuál es tu   juego favorito? ' });
const otherPerson = questions.addQuestion({ user: 'Luis', platform: 'twitch', text: '¿Cuál es tu juego favorito?' });

test('the same person asking the same thing again is the one question', () => {
  assert.equal(twice.added, false, 'a repeat — spacing and capitals aside — went in twice');
  assert.equal(otherPerson.added, true, 'somebody else asking the same thing was refused');
  assert.equal(items().length, 2);
});

test('once it is turned down, asking again is a new question', () => {
  questions.setStatus(items()[0].id, 'rejected');
  assert.equal(questions.addQuestion({ user: 'Ana', text: '¿Cuál es tu juego favorito?' }).added, true);
});

test('a question can be tidied before it goes up, and not after it is answered', () => {
  questions.clear();
  questions.addQuestion({ user: 'Ana', text: 'wat is ur fav game' });
  const q = items()[0];
  questions.edit(q.id, '  ¿Cuál es tu juego favorito?  ');
  assert.equal(items()[0].text, '¿Cuál es tu juego favorito?');
  questions.edit(q.id, '   ');
  assert.equal(items()[0].text, '¿Cuál es tu juego favorito?', 'an empty edit wiped the question');
  questions.setStatus(q.id, 'done');
  questions.edit(q.id, 'rewritten after the fact');
  assert.equal(items()[0].text, '¿Cuál es tu juego favorito?', 'an answered question was rewritten');
});

test('"Next question" answers the one up and puts up the oldest approved', () => {
  questions.clear();
  for (const text of ['primera', 'segunda', 'tercera']) questions.addQuestion({ user: 'Ana', text });
  assert.throws(() => questions.next(), /no approved question/, 'it put up a question nobody approved');
  questions.setStatus(byText('segunda').id, 'approved');
  questions.setStatus(byText('primera').id, 'approved');
  questions.next();
  // Oldest asked first, not first approved.
  assert.equal(questions.getQuestions().showingId, byText('primera').id);
  questions.next();
  assert.equal(byText('primera').status, 'done', 'the one it took down was not marked answered');
  assert.equal(questions.getQuestions().showingId, byText('segunda').id);
  questions.next();
  assert.equal(questions.getQuestions().showingId, '', 'with nothing left it should take the last one down');
  assert.equal(byText('tercera').status, 'pending', 'a question nobody approved was touched');
});

test('adding one by hand puts it in Waiting, credited as typed, and says why when it cannot', () => {
  questions.clear();
  assert.deepEqual(questions.control({ op: 'add', text: '¿Qué opinas del speedrun?', user: 'Discord' }), { ok: true });
  const q = items()[0];
  assert.equal(q.user, 'Discord');
  assert.equal(q.platform, '');
  assert.equal(q.status, 'pending');
  assert.throws(() => questions.control({ op: 'add', text: '¿Qué opinas del speedrun?', user: 'Discord' }), /already in the queue/);
  assert.throws(() => questions.control({ op: 'add', text: '   ' }), /nothing to add/);
  assert.throws(() => questions.control({ op: 'launch' }), /unknown request/);
});

test('the settings refuse what cannot work', () => {
  const clean = questions.cleanSettings({ ask: { trigger: 'pregunta sin signo', cooldownSeconds: -5, replyText: 'x'.repeat(500) }, atStreamEnd: 'sometimes' });
  assert.equal(clean.ask.trigger, '!pregunta', 'a trigger that is not a !word was kept');
  assert.equal(clean.ask.cooldownSeconds, 0);
  assert.equal(clean.ask.replyText.length, 200);
  assert.equal(clean.atStreamEnd, 'keep');
  assert.equal(questions.cleanSettings({ ask: { trigger: '!Ask', cooldownSeconds: 99999 } }).ask.cooldownSeconds, 3600);
  assert.equal(questions.cleanSettings({ ask: { trigger: '!Ask' } }).ask.trigger, '!ask');
  // Typed without the "!", it is added; two words keep the word it had.
  assert.equal(questions.cleanSettings({ ask: { trigger: 'ask' } }).ask.trigger, '!ask');
  assert.equal(questions.cleanSettings({ ask: { trigger: 'two words' } }, { ask: { ...questions.DEFAULT_ASK, trigger: '!q' } }).ask.trigger, '!q');
  // A setting sent alone leaves the others as they were.
  const before = questions.getSettings();
  questions.setSettings({ atStreamEnd: 'finished' });
  assert.deepEqual(questions.getSettings().ask, before.ask);
  questions.setSettings({ atStreamEnd: 'keep' });
});

// ------------------------------------------------------------ "!pregunta"

questions.clear();
questions.resetCooldownsForTests();
questions.setSettings({ ask: { ...questions.DEFAULT_ASK } });
const saidAt = said.length;
chat('!pregunta ¿Cuándo es el próximo maratón?', { user: 'Ana', userId: 'u-ana', id: 'msg-1' });
chat('!pregunta ¿Y otra más?', { user: 'Ana', userId: 'u-ana', id: 'msg-2' });
chat('!PREGUNTA ¿Juegas Celeste?', { user: 'Luis', userId: 'u-luis', id: 'msg-3' });
chat('!pregunta', { user: 'Sofía', userId: 'u-sofia', id: 'msg-4' });
chat('!pregunta ¿Soy un bot?', { user: 'BotAccount', userId: 'u-bot', id: 'msg-5', isBot: true });
await settle();
const askedByChat = items().map((q) => [q.user, q.text, q.userId, q.msgId, q.platform, q.status]);
const repliedToChat = said.slice(saidAt);

test('"!pregunta" puts a question in Waiting and says so in chat, once per person per minute', () => {
  assert.deepEqual(askedByChat, [
    ['Ana', '¿Cuándo es el próximo maratón?', 'u-ana', 'msg-1', 'twitch', 'pending'],
    ['Luis', '¿Juegas Celeste?', 'u-luis', 'msg-3', 'twitch', 'pending'],
  ], 'the cooldown, an empty "!pregunta" or the channel’s own bot got through');
  assert.deepEqual(repliedToChat, ['¡Pregunta recibida, @Ana!', '¡Pregunta recibida, @Luis!']);
});

// A command of the streamer's own on the same word answers instead.
questions.clear();
questions.resetCooldownsForTests();
const commandsStore = collection('commands', []);
const commandsBefore = commandsStore.get();
commandsStore.set([...(commandsBefore || []), { id: 'own-pregunta', enabled: true, triggers: ['!pregunta'] }]);
// One that runs: an action linked to it. A command left without one does not take the word (commands.ownCommandAnswers).
const ownActions = collection('actions', []);
const ownActionsBefore = ownActions.get();
ownActions.set([...(ownActionsBefore || []), { id: 'act-own-pregunta', name: 'Own', enabled: true, trigger: { type: 'command_trigger', category: 'command', config: { commandId: 'own-pregunta' } }, actions: [] }]);
chat('!pregunta ¿me respondes tú?', { user: 'Ana', userId: 'u-ana', id: 'msg-6' });
await settle();
const overOwn = items().length;
commandsStore.set(commandsBefore);
ownActions.set(ownActionsBefore);

// Turned off, and on another word.
questions.resetCooldownsForTests();
questions.setSettings({ ask: { ...questions.DEFAULT_ASK, enabled: false } });
chat('!pregunta ¿estás apagado?', { user: 'Ana', userId: 'u-ana', id: 'msg-7' });
await settle();
const whileOff = items().length;
questions.setSettings({ ask: { ...questions.DEFAULT_ASK, trigger: '!ask', reply: false } });
const saidBeforeQuiet = said.length;
chat('!ask what is your PB?', { user: 'Sam', userId: 'u-sam', id: 'msg-8' });
chat('!pregunta ¿y la palabra vieja?', { user: 'Leo', userId: 'u-leo', id: 'msg-9' });
await settle();
const onOtherWord = items().map((q) => q.text);
const quietReply = said.slice(saidBeforeQuiet);
questions.setSettings({ ask: { ...questions.DEFAULT_ASK } });

test('it steps aside for a command of your own, when turned off, and follows its word', () => {
  assert.equal(overOwn, 0, 'the built-in answered a word the streamer had given a command of their own');
  assert.equal(whileOff, 0, 'it took a question while turned off');
  assert.deepEqual(onOtherWord, ['what is your PB?'], 'it did not follow its new word, or still answered the old one');
  assert.deepEqual(quietReply, [], 'it answered in chat with the reply turned off');
});

// ------------------------------------------------------------ deletes and timeouts

questions.clear();
questions.resetCooldownsForTests();
chat('!pregunta primera de Ana', { user: 'Ana', userId: 'u-ana', id: 'm-a1' });
chat('!pregunta la de Luis', { user: 'Luis', userId: 'u-luis', id: 'm-l1' });
chat('!pregunta la de Leo', { user: 'Leo', userId: 'u-leo', id: 'm-leo' });
await settle();
questions.setStatus(byText('la de Leo').id, 'approved');
bus.emit(EVENTS.CHAT_DELETE, { platform: 'twitch', msgIds: ['m-a1'], userIds: [] });
const afterMessageDeleted = items().map((q) => q.text);
bus.emit(EVENTS.CHAT_DELETE, { platform: 'youtube', msgIds: [], userIds: ['u-luis'] });
const afterOtherPlatform = items().map((q) => q.text);
bus.emit(EVENTS.CHAT_DELETE, { platform: 'twitch', msgIds: [], userIds: ['u-luis', 'u-leo'] });
const afterTimeout = items().map((q) => q.text);

test('a deleted message or a timeout takes a waiting question with it, and leaves an approved one', () => {
  assert.deepEqual(afterMessageDeleted, ['la de Luis', 'la de Leo'], 'the question stayed after its message was deleted');
  assert.deepEqual(afterOtherPlatform, ['la de Luis', 'la de Leo'], 'a timeout on another platform removed a Twitch question');
  assert.deepEqual(afterTimeout, ['la de Leo'], 'a timeout left the question, or took one the streamer had approved');
});

test('Twitch reports deleted messages, timeouts and bans, and its own message ids', () => {
  const twitch = read('../platforms/twitch.js');
  assert.ok(twitch.includes("client.on('messagedeleted'") && twitch.includes("tags?.['target-msg-id']"), 'a deleted message is never reported');
  assert.ok(twitch.includes("client.on('timeout'") && twitch.includes("client.on('ban'") && twitch.includes("tags?.['target-user-id']"), 'a timeout or a ban is never reported');
  assert.ok(twitch.includes('      id: id || null,'), 'Twitch messages carry a made-up id, so a deletion can never be matched');
  // A step asking from a command carries the message and who sent it too.
  assert.ok(read('../engine/steps.js').includes('...(named ? {} : { userId: ctx.user?.id, msgId: ctx.chatId })'));
  assert.ok(read('../engine/index.js').includes('chatId: chat.id,'), 'a command context no longer carries the message it came on');
});

// ------------------------------------------------------------ the end of the stream

const endWith = (setting) => {
  questions.clear();
  for (const text of ['esperando', 'aprobada', 'respondida']) questions.addQuestion({ user: 'Ana', text });
  questions.setStatus(byText('aprobada').id, 'approved');
  questions.setStatus(byText('respondida').id, 'done');
  questions.setSettings({ atStreamEnd: setting });
  questions.streamEnded();
  return items().map((q) => q.text);
};

test('the end of a stream keeps the queue, clears the finished ones, or clears it all — as chosen', () => {
  assert.deepEqual(endWith('keep'), ['esperando', 'aprobada', 'respondida']);
  assert.deepEqual(endWith('finished'), ['esperando', 'aprobada']);
  assert.deepEqual(endWith('all'), []);
  questions.setSettings({ atStreamEnd: 'keep' });
  assert.ok(read('../engine/questions.js').includes("if (event?.type === 'obs_stream_stopped') streamEnded();"), 'nothing calls it when the stream stops');
});

// ------------------------------------------------------------ the dock button

questions.clear();
let dockRefused = null;
try { await engine.runDockBuiltin('question_next'); } catch (err) { dockRefused = err; }
questions.addQuestion({ user: 'Ana', text: 'desde el dock' });
questions.setStatus(byText('desde el dock').id, 'approved');
const dockPressed = await engine.runDockBuiltin('question_next');
const dockShowing = questions.getQuestions().showingId;

test('the dock’s "Next question" puts up the next approved, and says so when there is none', () => {
  assert.ok(/no approved question/.test(dockRefused?.message || ''), 'the button would light up for doing nothing');
  assert.deepEqual(dockPressed, { ok: true });
  assert.equal(dockShowing, byText('desde el dock').id);
});

test('what everyone sees: the snapshot carries the queue and its settings', () => {
  const snap = engine.snapshot();
  assert.equal(snap.questions.showingId, dockShowing);
  assert.equal(snap.questionSettings.ask.trigger, '!pregunta');
});
questions.clear();

// ------------------------------------------------------------ the screens

test('the Questions screen can edit, add, move on and change the rules', () => {
  const view = read('../../web/components/views/QuestionsView.tsx');
  assert.ok(view.includes("run({ op: 'next' })"), 'no "Next question"');
  assert.ok(view.includes("run({ op: 'edit', id: q.id, text })"), 'a question cannot be edited');
  assert.ok(view.includes("run({ op: 'add', text: newText, user: newAsker })"), 'a question cannot be added by hand');
  assert.ok(view.includes("run({ op: 'settings', settings: { atStreamEnd: choice } })"), 'the end-of-stream choice is missing');
  assert.ok(view.includes('platform?.name') && view.includes('toLocaleTimeString'), 'where a question came from and when is not shown');
  // The row keeps its own editing state, so it cannot be declared inside the screen.
  assert.ok(view.indexOf('const QuestionRow') < view.indexOf('export const QuestionsView'));
});

test('the dock has a Questions tab, and the menu counts what is waiting', () => {
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("{ id: 'questions', label: t.questionsNav || 'Questions', icon: MessageCircleQuestion, count: waitingQuestions }"));
  assert.ok(app.includes("panel === 'questions' && (") && app.includes('<DockQuestions'));
  assert.ok(app.includes('number: waitingQuestions || undefined'), 'the menu does not count waiting questions');
  // `0 && …` is 0, and React draws a number: an empty count showed a bare "0".
  const menu = read('../../web/components/NavMenu.tsx');
  assert.ok(menu.includes('{item.number ? (') && !menu.includes('{item.number && ('));
  const dock = read('../../web/components/DockQuestions.tsx');
  const constants = read('../../web/constants.ts');
  for (const key of new Set([...dock.matchAll(/\bt\.(questions[A-Za-z]+)/g)].map((m) => m[1]))) {
    assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
  assert.ok(read('../../web/components/views/DockActionsView.tsx').includes("questions: { name: 'Questions', key: 'questionsNav' }"), 'the built-in button has no heading');
});

test('how viewers ask travels with a backup; what they asked does not', () => {
  const backup = read('../engine/backup.js');
  assert.ok(backup.includes("{ name: 'questions_settings' }"));
  assert.ok(/EXCLUDED = \[[^\]]*'questions'/.test(backup));
});

// ------------------------------------------------------------ from Discord, and an own command that does nothing

{
  const { ownCommandAnswers } = await import('../../engine/commands.js');
  const { discordSent, normaliseChat } = await import('./harness.js');
  const queue = () => questions.getQuestions().items;
  const fromDiscord = (msg, over = {}) => bus.emit('discord:message_elsewhere', normaliseChat({
    platform: 'discord', user: 'I_Am_Streamer', userId: 'd-rowan', msg, raw: { channelId: '1300000000000000001', messageId: '1300000000000000002' }, ...over,
  }));

  questions.clear();
  questions.resetCooldownsForTests();
  questions.setSettings({ ask: { ...questions.DEFAULT_ASK } });

  // The live setup on 2026-10-08: a "Preguntas" command on !q, !preguntar and !pregunta, with no action linked.
  const commandsStore = collection('commands', []);
  const commandsBefore = commandsStore.get();
  commandsStore.set([...(commandsBefore || []), { id: 'empty-preguntas', name: 'Preguntas', enabled: true, triggers: ['!q', '!preguntar', '!pregunta'], discord: true }]);
  const sentBefore = discordSent.length;
  fromDiscord('!pregunta que es esto? prueba');
  await settle();
  const askedInDiscord = queue().map((q) => [q.user, q.platform, q.text]);
  const answeredThere = discordSent.slice(sentBefore);
  commandsStore.set(commandsBefore);

  // Turned off on Connections: commands in the rest of the server do nothing, and neither does this.
  questions.clear();
  questions.resetCooldownsForTests();
  const { doubles } = await import('./harness.js');
  doubles.discordCommandsEverywhere = false;
  fromDiscord('!pregunta ¿y con los comandos apagados?');
  await settle();
  delete doubles.discordCommandsEverywhere;
  const whileCommandsOff = queue().length;

  test('an own command with no action does not silence it, and "!pregunta" works in any Discord channel, answered there', () => {
    assert.deepEqual(askedInDiscord, [['I_Am_Streamer', 'discord', 'que es esto? prueba']], 'the question asked in Discord went nowhere');
    assert.equal(answeredThere.length, 1, 'nobody was told the question went in');
    const [channelId, text, , , , extra] = answeredThere[0];
    assert.equal(channelId, '1300000000000000001', 'the answer went to another channel');
    assert.equal(text, '¡Pregunta recibida, @I_Am_Streamer!');
    assert.deepEqual(extra.message_reference?.message_id, '1300000000000000002', 'the answer is not a reply to the question');
    assert.deepEqual(extra.allowed_mentions, { parse: [] });
    assert.equal(whileCommandsOff, 0, 'it answered with Discord commands turned off');
  });

  test('a built-in word steps aside only for an own command that would run', () => {
    const own = [{ id: 'c1', enabled: true, triggers: ['!top'] }, { id: 'c2', enabled: true, triggers: ['!plan'], discord: false }];
    const linked = (commandId, enabled = true) => ({ id: `a-${commandId}`, enabled, trigger: { type: 'command_trigger', config: { commandId } } });
    assert.equal(ownCommandAnswers(own, [], '!top', 'twitch'), false, 'a command with no action took the word');
    assert.equal(ownCommandAnswers(own, [linked('c1', false)], '!top', 'twitch'), false, 'a command whose action is off took the word');
    assert.equal(ownCommandAnswers(own, [linked('c1')], '!top', 'twitch'), true);
    assert.equal(ownCommandAnswers(own, [linked('c2')], '!plan', 'twitch'), true);
    assert.equal(ownCommandAnswers(own, [linked('c2')], '!plan', 'discord'), false, 'a command kept off Discord took the word there');
    assert.equal(ownCommandAnswers(own, [linked('c1')], '!rank', 'twitch'), false);
    // Every built-in word asks the same question the command handler does.
    for (const file of ['giveaway.js', 'plan.js', 'points.js', 'polls.js', 'profile-card.js', 'questions.js']) {
      const src = read(`../engine/${file}`);
      assert.ok(src.includes('commands.ownCommandAnswers(') && !src.includes("commands.match(collection('commands'"), `${file} steps aside for a command that does nothing`);
    }
    const levels = read('../leveling/chat.js');
    assert.ok(levels.includes('commands.ownCommandAnswers(') && !levels.includes("commands.match(collection('commands'"), 'the levels step aside for a command that does nothing');
  });
}
