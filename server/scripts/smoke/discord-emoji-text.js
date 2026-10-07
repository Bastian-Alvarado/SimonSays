/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Discord's codes drawn as Discord draws them on the screens that
 * show its words (web/discordEmoji.ts) — a server emoji as its picture, a
 * mention of somebody, a role or a channel as its name — on chat lines,
 * requests, questions, steps of the plan and page summaries, with the names
 * sent along by the server (discord.js mentionNames); while the boxes where
 * the words are typed keep the codes, which is what Discord needs.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { assert, fs, test } from './harness.js';

const discord = await import('../../platforms/discord.js');
const questions = await import('../../engine/questions.js');

// Node reads the TypeScript as it is (its types stripped).
const { withDiscordText, hasDiscordEmoji, rememberDiscordLists, rememberDiscordNames } = await import('../../../web/discordEmoji.ts');
const read = (p) => fs.readFileSync(new URL(`../../../web/${p}`, import.meta.url), 'utf8');

const drawn = withDiscordText('juega <:1bit72x72:1199000000000000005> y <a:Dance:123456789012345678>!');
const plain = withDiscordText('sin emojis <3 nada');

// ---------------------------------------------------------------- mentions, by name

const ROLES = [{ id: '900000000000000071', name: 'Mods', color: 0x2ecc71 }];
const CHANNELS = [{ id: '900000000000000072', name: 'peticiones-de-juegos' }];
const gateway = {
  id: '900000000000000073', guild_id: 'g9', channel_id: 'c-stream',
  author: { id: '900000000000000074', username: 'ana', global_name: 'Ana' }, member: { roles: [] },
  content: 'oye <@900000000000000075> y <@!900000000000000076>, pregunten en <#900000000000000072> a los <@&900000000000000071>',
  mentions: [{ id: '900000000000000075', username: 'k_iro', global_name: 'K-iro' }, { id: '900000000000000076', username: 'nel', member: { nick: 'PixelPep' } }, { id: '900000000000000099', username: 'not-in-it' }],
};
const names = discord.mentionNames(gateway, { channels: CHANNELS, roles: ROLES });
const none = discord.mentionNames({ ...gateway, content: 'nada que mencionar' }, { channels: CHANNELS, roles: ROLES });
const cacheBefore = (await import('./harness.js')).collection('discord_cache', {}).get();
(await import('./harness.js')).collection('discord_cache', {}).set({ ...cacheBefore, roles: ROLES, channels: CHANNELS });
const chat = discord.messageFromGateway(gateway, { guildId: 'g9', channelId: 'c-stream' })?.chat;
(await import('./harness.js')).collection('discord_cache', {}).set(cacheBefore);
const asked = questions.addQuestion({ user: 'Ana', userId: '900000000000000074', platform: 'discord', text: gateway.content, names: { ...names, users: { ...names.users, 'not-an-id': 'x' } } });
const question = asked.state.items.find((q) => q.text === gateway.content);
// Turned down, so nothing answers it in Discord, and nothing waits on it.
if (question) questions.setStatus(question.id, 'rejected');

const said = withDiscordText(gateway.content, undefined, names);
const shown = (parts) => (Array.isArray(parts) ? parts.map((p) => (typeof p === 'string' ? p : p.props.children)).join('') : parts);
// Without names of their own, from what the screen has learned; unknown ones still read as mentions.
rememberDiscordLists({ channels: CHANNELS, roles: ROLES });
rememberDiscordNames({ users: { '900000000000000077': 'Lupe' } });
const learned = shown(withDiscordText('<@900000000000000077> en <#900000000000000072> con <@&900000000000000071>'));
const unknown = shown(withDiscordText('<@900000000000000098> <#900000000000000097>'));

test('a server emoji\'s code is drawn as its picture, moving or not; the words around it stay', () => {
  assert.ok(Array.isArray(drawn), 'the code was left as words');
  assert.deepEqual(drawn.map((p) => (typeof p === 'string' ? p : p.props.src)), [
    'juega ', 'https://cdn.discordapp.com/emojis/1199000000000000005.png?size=48', ' y ', 'https://cdn.discordapp.com/emojis/123456789012345678.gif?size=48', '!',
  ]);
  assert.equal(drawn[1].props.name, '1bit72x72');
  assert.equal(plain, 'sin emojis <3 nada', 'words without an emoji were changed');
  assert.deepEqual([hasDiscordEmoji('a <:Wow:1199000000000000002>'), hasDiscordEmoji('<:nope:12>')], [true, false]);
});

test('a mention is drawn by the name it mentions — somebody, a role in its colour, a channel', () => {
  assert.deepEqual(names, {
    users: { '900000000000000075': 'K-iro', '900000000000000076': 'PixelPep' },
    roles: { '900000000000000071': { name: 'Mods', color: 0x2ecc71 } },
    channels: { '900000000000000072': 'peticiones-de-juegos' },
  });
  assert.equal(none, undefined, 'words that mention nobody were given names');
  assert.deepEqual(chat?.names, names, 'a Discord chat line does not carry its names to the screens');
  assert.equal(chat?.msg, gateway.content, 'the chat line lost its codes');
  assert.deepEqual(Object.keys(question?.names?.users || {}), ['900000000000000075', '900000000000000076'], 'a question did not keep its names, or kept junk');
  assert.equal(shown(said), 'oye @K-iro y @PixelPep, pregunten en #peticiones-de-juegos a los @Mods');
  const role = said.find((p) => typeof p !== 'string' && p.props['data-discord-mention'] === 'role');
  assert.equal(role.props.style.color, '#2ecc71');
  assert.equal(learned, '@Lupe en #peticiones-de-juegos con @Mods');
  assert.equal(unknown, '@user #channel');
});

test('every screen showing Discord\'s words draws them; boxes where they are typed keep the code', () => {
  for (const [file, shown] of [
    ['utils.ts', 'withDiscordText(msg'],
    ['components/views/RequestsView.tsx', 'withDiscordText(r.text'],
    ['components/DockQuestions.tsx', 'withDiscordText(q.text'],
    ['components/views/QuestionsView.tsx', 'withDiscordText(q.text'],
    ['components/DockPlan.tsx', 'withDiscordText(item.text)'],
    ['components/PlanOverlay.tsx', 'withDiscordText(item.text)'],
    ['components/Omnibar.tsx', 'withDiscordText(words)'],
    ['components/views/DiscordPagesView.tsx', 'withDiscordText(blockSummary(b)'],
    ['components/ChatMessageRow.tsx', '(chat as any).names'],
    ['components/views/RequestsView.tsx', 'withDiscordText(r.text, undefined, r.names)'],
    ['hooks/useStreamSystem.ts', 'rememberDiscordNames((msg as any).names)'],
  ]) assert.ok(read(file).includes(shown), `${file} shows the code`);
  // A request read from the channel or posted in it keeps its names too.
  const requests = fs.readFileSync(new URL('../../engine/game-requests.js', import.meta.url), 'utf8');
  assert.ok(requests.includes('namesOf(discord.mentionNames(m))') && requests.includes('namesOf(chat.names)'));
  // Where a question or a step is typed, its code is what is kept and posted.
  assert.ok(read('components/views/QuestionsView.tsx').includes('value={q.text}'));
  assert.ok(read('components/views/PlanView.tsx').includes('value={item.text}'));
});
