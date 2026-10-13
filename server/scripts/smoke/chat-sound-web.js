/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the "Somebody says something" trigger, the Play a sound and
 * Fetch a web address steps, and {random.user}.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, bus, chat, doubles, engine, EVENTS, fs, said, settle, test, webRequests } from './harness.js';

const match = await import('../../../shared/chat-match.js');
const chatters = await import('../../engine/chatters.js');
const web = await import('../../engine/web-fetch.js');
const { interpolate } = await import('../../engine/variables.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const anyone = { anyone: true, vips: true, subscribers: true, moderators: true, broadcaster: true };
const saidDuring = async (fn) => { const from = said.length; await fn(); await settle(); return said.slice(from); };
const onChat = (id, config, message) => engine.store.saveAction({
  id, name: id, enabled: true,
  trigger: { id: `t-${id}`, category: 'chat', type: 'chat_message', config },
  actions: [{ id: `s-${id}`, type: 'twitch_chat', config: { message } }],
});

// ------------------------------------------------------------ matching

test('"any of these words" finds whole words, in any case, and not inside other words', () => {
  const cfg = { match: 'words', text: 'gg, good game' };
  assert.equal(match.matchChat(cfg, 'GG wp')?.text, 'GG');
  assert.equal(match.matchChat(cfg, 'that was a good game!')?.text, 'good game');
  assert.equal(match.matchChat(cfg, 'eggs'), null, 'gg was found inside "eggs"');
  assert.equal(match.matchChat(cfg, 'ggg'), null);
  assert.equal(match.matchChat({ match: 'words', text: 'olé' }, '¡Olé!')?.text, 'Olé', 'a word with an accent was not one');
  assert.equal(match.matchChat({ match: 'words', text: ' , ' }, 'anything'), null, 'nothing to look for matched everything');
});

test('starts with, is exactly, and a pattern with groups', () => {
  assert.ok(match.matchChat({ match: 'starts', text: 'hola' }, '  Hola a todos'));
  assert.equal(match.matchChat({ match: 'starts', text: 'hola' }, 'y hola'), null);
  assert.ok(match.matchChat({ match: 'exact', text: 'f' }, ' F '));
  assert.equal(match.matchChat({ match: 'exact', text: 'f' }, 'f in chat'), null);
  const link = match.matchChat({ match: 'regex', text: 'https?://(?:www\\.)?([\\w.-]+)' }, 'mira https://www.youtube.com/watch');
  assert.equal(link?.[1], 'youtube.com');
  assert.equal(match.matchChat({ match: 'regex', text: '(' }, '('), null, 'a broken pattern matched');
  assert.ok(match.patternError('(').length > 0);
  assert.equal(match.patternError('a\\-b'), '', 'an escape ordinary patterns allow was called broken');
  // A pattern with dots and question marks in "words" is taken as written, not as a pattern.
  assert.equal(match.matchChat({ match: 'words', text: 'why?' }, 'whys'), null);
});

test('never the bot, the streamer only when asked, and one chat when one is picked', () => {
  const c = { platform: 'any' };
  assert.equal(match.listensTo(c, { platform: 'twitch', isBot: true }), false);
  assert.equal(match.listensTo(c, { platform: 'twitch', isBroadcaster: true }), false, 'what the app sends from the streamer would set itself off');
  assert.equal(match.listensTo({ streamerToo: true }, { platform: 'twitch', isBroadcaster: true }), true);
  assert.equal(match.listensTo({ platform: 'youtube' }, { platform: 'twitch' }), false);
  assert.equal(match.listensTo({ platform: 'youtube' }, { platform: 'youtube' }), true);
  assert.deepEqual(match.cleanChatTrigger({ cooldown: -5, userCooldown: 'x', match: 'nope', platform: 'mars' }), { match: 'words', text: '', platform: 'any', streamerToo: false, cooldown: 0, userCooldown: 0 });
});

// ------------------------------------------------------------ the trigger

onChat('act-gg', { match: 'words', text: 'gg', cooldown: 0 }, '{user} said {match}: {message}');
const gg = await saidDuring(async () => {
  chat('gg wp', { user: 'Ana', userId: 'csw-ana' });
  chat('I like eggs', { user: 'Beto', userId: 'csw-beto' });
  chat('gg', { user: 'TheBot', userId: 'csw-bot', isBot: true });
  chat('gg', { user: 'Me', userId: 'csw-me', isBroadcaster: true });
});

onChat('act-gg-cool', { match: 'exact', text: 'F', cooldown: 60 }, 'paying respects');
const cooled = await saidDuring(async () => { chat('F', { user: 'Ana', userId: 'csw-ana' }); chat('f', { user: 'Caro', userId: 'csw-caro' }); });

onChat('act-gg-person', { match: 'exact', text: 'hi', cooldown: 0, userCooldown: 60 }, 'hi {user}');
const perPerson = await saidDuring(async () => {
  chat('hi', { user: 'Ana', userId: 'csw-ana' });
  chat('hi', { user: 'Ana', userId: 'csw-ana' });
  chat('hi', { user: 'Beto', userId: 'csw-beto' });
});

onChat('act-link', { match: 'regex', text: 'https?://(?:www\\.)?([\\w.-]+)', cooldown: 0 }, 'a link to {match.1}');
const linked = await saidDuring(async () => { chat('look https://clips.twitch.tv/abc', { user: 'Ana', userId: 'csw-ana' }); });

test('somebody saying the words sets the action off, with {match} and {message}', () => {
  assert.deepEqual(gg.filter((s) => s.includes(' said ')), ['Ana said gg: gg wp'], gg.join(' | '));
});

test('the cooldown for everybody and the one for each person hold it back', () => {
  assert.deepEqual(cooled.filter((s) => s === 'paying respects'), ['paying respects'], 'a second F inside the cooldown set it off again');
  assert.deepEqual(perPerson.filter((s) => s.startsWith('hi ')), ['hi Ana', 'hi Beto']);
});

test('a pattern\'s groups are {match.1} and on', () => {
  assert.deepEqual(linked.filter((s) => s.startsWith('a link')), ['a link to clips.twitch.tv']);
});

for (const id of ['act-gg', 'act-gg-cool', 'act-gg-person', 'act-link']) engine.store.deleteAction(id);

// ------------------------------------------------------------ {random.user}

chatters._test.clear();
engine.store.saveCommand({ id: 'cmd-hug', name: 'hug', triggers: ['!hug'], enabled: true, permissions: anyone, globalCooldown: 0, userCooldown: 0 });
engine.store.saveAction({
  id: 'act-hug', name: 'hug', enabled: true,
  trigger: { id: 't-hug', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-hug' } },
  actions: [{ id: 's-hug', type: 'twitch_chat', config: { message: '{user} hugs {random.user} ({random.user} again)' } }],
});
const alone = await saidDuring(async () => { chat('!hug', { user: 'Solo', userId: 'csw-solo' }); });
chat('hello', { user: 'Dani', userId: 'csw-dani' });
chat('beep', { user: 'Botty', userId: 'csw-botty', isBot: true });
chat('I am live', { user: 'Streamer', userId: 'csw-streamer', isBroadcaster: true });
await settle();
const hugs = await saidDuring(async () => { chat('!hug', { user: 'Solo', userId: 'csw-solo' }); });

test('{random.user} is somebody else around, the same one all through a run', () => {
  assert.ok(alone.includes('Solo hugs Solo (Solo again)'), `with nobody else around: ${alone.join(' | ')}`);
  assert.ok(hugs.includes('Solo hugs Dani (Dani again)'), hugs.join(' | '));
  const names = chatters.around().map((c) => c.name);
  assert.ok(names.includes('Dani') && !names.includes('Botty') && !names.includes('Streamer'), 'the bot or the streamer counts as around');
});

test('somebody quiet for over half an hour is not around', () => {
  chatters._test.clear();
  chatters.noteChat({ platform: 'twitch', user: 'Old' });
  assert.deepEqual(chatters.around(Date.now() + chatters.RECENT_MS + 1000).map((c) => c.name), []);
  assert.equal(chatters.pick('Me'), 'Me', 'with nobody around, the one who asked');
});
engine.store.deleteAction('act-hug');

// ------------------------------------------------------------ Play a sound

const devices = [];
const keepDevice = (d) => { if (d.kind === 'play_sound') devices.push(d); };
bus.on(EVENTS.DEVICE, keepDevice);
engine.store.saveAction({
  id: 'act-airhorn', name: 'airhorn', enabled: true,
  trigger: { id: 't-air', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [
    { id: 'air1', type: 'play_sound', config: { soundUrl: '/media/airhorn.mp3', soundVolume: 3 } },
    { id: 'air2', type: 'play_sound', config: { soundUrl: '' } },
  ],
});
await engine.testAction('act-airhorn');
bus.off(EVENTS.DEVICE, keepDevice);
engine.store.deleteAction('act-airhorn');

test('Play a sound sends its file to the surface that plays sound, at a volume it can play', () => {
  assert.deepEqual(devices, [{ kind: 'play_sound', url: '/media/airhorn.mp3', volume: 1 }], 'an empty one was sent, or the volume was not held to 1');
  const ws = read('../api/ws.js');
  assert.ok(ws.includes("d.kind === 'play_sound' ? S2C.PLAY_SOUND"), 'it is not delivered as a sound');
  const system = read('../../web/hooks/useStreamSystem.ts');
  assert.ok(system.includes('on(S2C.PLAY_SOUND, (d: any) => {') && system.includes('audio.volume = Math.min(1, Math.max(0, Number(d.volume ?? 1)));'), 'no page plays it');
});

// ------------------------------------------------------------ Fetch a web address

engine.store.saveAction({
  id: 'act-joke', name: 'joke', enabled: true,
  trigger: { id: 't-joke', category: 'command', type: 'command_trigger', config: { commandId: 'cmd-none' } },
  actions: [
    { id: 'j1', type: 'web_request', config: { method: 'GET', url: 'https://api.example.com/weather?q={input}&who={user}', headers: 'Accept: application/json' } },
    { id: 'j2', type: 'twitch_chat', config: { message: 'It is {response.json.temp} degrees. Raw: {response}' } },
    { id: 'j3', type: 'condition', config: { logic: { conditions: [{ id: 'c', variable: 'response.ok', operator: 'isFalse', value: '' }] } }, thenActions: [{ id: 'j4', type: 'twitch_chat', config: { message: 'no weather: {response.error}' } }], elseActions: [] },
  ],
});
webRequests.length = 0;
doubles.webAnswer = { ok: true, status: 200, text: '{"temp":21}', json: { temp: 21 } };
const okRun = await saidDuring(async () => {
  await engine.runActionFor('act-joke', { name: 'Ana', input: 'New York & more' });
});
doubles.webAnswer = { ok: false, status: 0, text: '', error: 'no answer within 8 seconds' };
const failedRun = await saidDuring(async () => { await engine.runActionFor('act-joke', { name: 'Ana', input: 'x' }); });
doubles.webAnswer = null;
engine.store.deleteAction('act-joke');

test('Fetch a web address asks with what was typed made safe, and the steps after it read the answer', () => {
  assert.equal(webRequests[0].url, 'https://api.example.com/weather?q=New%20York%20%26%20more&who=Ana', 'a viewer\'s words were put into the address as they are');
  assert.equal(webRequests[0].method, 'GET');
  assert.equal(webRequests[0].headers, 'Accept: application/json');
  assert.ok(okRun.includes('It is 21 degrees. Raw: {"temp":21}'), okRun.join(' | '));
  assert.ok(!okRun.some((s) => s.startsWith('no weather')));
  assert.ok(failedRun.includes('no weather: no answer within 8 seconds'), failedRun.join(' | '));
});

// The real fetch, with the network and the name lookup stood in for.
const answer = (status, body, headers = {}) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: (h) => ({ 'content-type': 'application/json', ...headers })[h.toLowerCase()] ?? null },
  text: async () => body,
});
const publicLookup = async () => [{ address: '93.184.216.34' }];
const asked = [];
const fetchImpl = async (url, opts) => { asked.push([String(url), opts.method, opts.headers, opts.body]); return answer(200, '{"joke":"ha"}'); };
const good = await web.fetchForStep({ url: 'https://icanhazdadjoke.com/', headers: 'Accept: application/json\nnot a header' }, { lookup: publicLookup, fetchImpl });
const posted = await web.fetchForStep({ url: 'https://hook.example/x', method: 'POST', body: '{"a":1}' }, { lookup: publicLookup, fetchImpl });
const refusals = [];
for (const url of ['http://127.0.0.1:8081/api/health', 'http://localhost:8081/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'ftp://example.com/', 'not an address']) {
  refusals.push((await web.fetchForStep({ url }, { lookup: publicLookup, fetchImpl })).error);
}
const rebound = await web.fetchForStep({ url: 'https://sneaky.example/' }, { lookup: async () => [{ address: '127.0.0.1' }], fetchImpl });
let hops = 0;
const redirected = await web.fetchForStep({ url: 'https://short.example/' }, {
  lookup: async (host) => [{ address: host === 'internal.example' ? '127.0.0.2' : '93.184.216.34' }],
  fetchImpl: async () => { hops += 1; return answer(302, '', { location: 'http://internal.example/secret' }); },
});
const home = await web.fetchForStep({ url: 'http://192.168.1.50/light/on' }, { lookup: publicLookup, fetchImpl });

test('the web fetch reads JSON, sends headers and a JSON body', () => {
  assert.equal(good.ok, true);
  assert.deepEqual(good.json, { joke: 'ha' });
  assert.deepEqual(asked[0][2], { Accept: 'application/json' }, 'a line that is not a header was sent as one');
  assert.equal(posted.ok, true);
  assert.equal(asked[1][1], 'POST');
  assert.equal(asked[1][2]['Content-Type'], 'application/json');
  assert.equal(asked[1][3], '{"a":1}');
});

test('the web fetch will not reach the server itself, by name, by number or by redirect, and the home network is fine', () => {
  for (const [i, why] of refusals.entries()) assert.ok(why, `address ${i} was fetched`);
  assert.equal(refusals[0], 'the server itself cannot be fetched');
  assert.equal(refusals[4], 'only http and https addresses can be fetched');
  assert.ok(!refusals[5].includes('not an address'), 'the address was repeated in the error, where an API key would reach the log');
  assert.equal(rebound.error, 'the server itself cannot be fetched', 'a name pointing at the loopback was fetched');
  assert.equal(redirected.error, 'the server itself cannot be fetched', 'a redirect to the loopback was followed');
  assert.equal(hops, 1);
  assert.equal(home.ok, true, 'an address on the home network was refused');
  assert.equal(web.blockedAddress('::ffff:127.0.0.1'), true);
  assert.equal(web.blockedAddress('10.0.0.5'), false);
});

test('a value that is an object goes in as JSON, and {response} and {match} are short for their text', () => {
  assert.equal(interpolate('{response}', { response: { text: 'hi' } }), 'hi');
  assert.equal(interpolate('{match}', { match: { text: 'gg' } }), 'gg');
  assert.equal(interpolate('{response.json}', { response: { json: { a: 1 } } }), '{"a":1}');
  // A list is its items with commas, as {message.words} always printed.
  assert.equal(interpolate('{message.words}', { message: { words: ['!tts', 'hola', 'mundo'] } }), '!tts,hola,mundo');
  // V2's {username} and {args} are gone with 2.0.0: left as typed, like any unknown name.
  assert.equal(interpolate('{username} {args}', { user: { name: 'Ana' }, message: { args: 'x' } }), '{username} {args}');
  assert.equal(interpolate('{nothing.here}', {}), '{nothing.here}', 'an unknown value was not left as typed');
  // The log names the host only: an address often carries its API key.
  const steps = read('../engine/steps.js');
  assert.ok(steps.includes('log.warn(`web request to ${host ||') && !steps.includes("['url', 'address']"));
});

// ------------------------------------------------------------ the editor

test('the editor offers the chat trigger, the sound and the web steps, in both languages', () => {
  const view = read('../../web/components/views/ActionsView.tsx');
  assert.ok(view.includes("{ value: 'chat_message', label: t.triggerChatMessage"));
  assert.ok(view.includes("onClick: () => addStep('play_sound')") && view.includes("onClick: () => addStep('web_request')"));
  assert.ok(view.includes('patternError(c.text)'), 'a broken pattern is not said');
  const app = read('../../web/App.tsx');
  assert.ok(app.includes("? { ...DEFAULT_CHAT_TRIGGER } as ActionTrigger['config']"), 'a new chat trigger is saved without what its editor shows');
  assert.ok(app.includes("play_sound: { soundUrl: '', soundVolume: 1 }") && app.includes("web_request: { method: 'GET', url: '', body: '', headers: '' }"));
  const constants = read('../../web/constants.ts');
  for (const key of ['stepPlaySound', 'stepPlaySoundFile', 'stepPlaySoundHint', 'stepWebRequest', 'stepWebBody', 'stepWebHeaders', 'stepWebRequestHint', 'triggerChatMessage', 'chatMatchWords', 'chatMatchStarts', 'chatMatchExact', 'chatMatchRegex', 'chatOnAny', 'chatMatchWordsExample', 'chatPatternBroken', 'chatCooldown', 'chatUserCooldown', 'chatStreamerToo', 'chatMessageHint']) {
    assert.equal(constants.split(`    ${key}: '`).length - 1, 2, `${key} is not in both languages`);
  }
  const picker = read('../../web/components/VariablePicker.tsx');
  for (const token of ['random.user', 'response', 'response.json.name', 'match', 'match.1']) assert.ok(picker.includes(`token: '${token}'`), `{${token}} is not in the variables list`);
});
