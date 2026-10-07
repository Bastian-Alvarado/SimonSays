/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: Discord pages — a channel's standing posts built from blocks
 * (server/engine/discord-pages.js, shared/discord-pages.js). The messages
 * each way of posting makes, Discord's limits, posting, changing a page in
 * place or posting it again, tests to the test channel, taking it down, and
 * reading a page back from what a channel has — MEE6's webhook messages
 * included — then deleting those originals.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. After discord.js, which
 * set the welcome settings up.
 */

import path from 'node:path';
import { SCRIPT_URL, assert, collection, fs, test } from './harness.js';

const pages = await import('../../engine/discord-pages.js');
const shared = await import('../../../shared/discord-pages.js');
const { config } = await import('../../config.js');
const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
pages.initDiscordPages();

const EMOJI = '<:basslinekid:1199000000000000002>';
fs.writeFileSync(path.join(config.assetsDir, 'page-banner.png'), Buffer.from('banner one'));
fs.writeFileSync(path.join(config.assetsDir, 'page-banner-2.png'), Buffer.from('banner two'));

// ---------------------------------------------------------------- the messages each way makes

const page = shared.cleanPage({
  name: 'Bienvenida', channelId: '700000000000000100', style: 'classic', color: '#fefefe',
  blocks: [
    { type: 'banner', image: '/media/page-banner.png' },
    { type: 'card', title: 'Bienvenidos', description: `Hola ${EMOJI} en <#1199000000000000003>`, footer: `${EMOJI} la cueva` },
    { type: 'gap', size: 'small' },
    { type: 'card', description: 'Aqui los links', color: '#ff0000', reactions: ['✅'], fields: [
      { name: 'Enlaces', value: '[Los directos!](https://twitch.tv/x)', inline: true },
      { name: 'Redes', value: '[Youtube](https://youtube.com/)', inline: true },
    ] },
    { type: 'text', text: 'Hola **todos**' },
    { type: 'links', buttons: [{ label: 'Twitch', url: 'https://twitch.tv/x', emoji: EMOJI }, { label: 'sin link', url: 'nope' }] },
  ],
});
const pictures = new Map([['/media/page-banner.png', await pages.loadPicture('/media/page-banner.png')]]);
const classic = shared.classicMessages(page, pictures);
const single = shared.singleMessage({ ...page, style: 'single', blocks: page.blocks.map((b) => (b.type === 'gap' ? { ...b, line: true } : b)) }, pictures);

test('the classic way makes a message per block, like MEE6: a banner as a file, cards as embeds, a gap as an invisible character', () => {
  assert.deepEqual(classic.map((m) => m.kind), ['banner', 'card', 'gap', 'card', 'text', 'links']);
  assert.deepEqual(classic[0].files.map((f) => f.name), ['banner-0.png']);
  assert.equal(String(classic[0].files[0].data), 'banner one');
  assert.equal(classic[0].body.embeds, undefined, 'a banner went in a box');
  assert.equal(classic[1].body.embeds[0].color, 0xfefefe, 'a card without its own colour did not take the page\'s');
  assert.equal(classic[3].body.embeds[0].color, 0xff0000);
  assert.deepEqual(classic[1].body.embeds[0].footer, { text: 'la cueva', icon_url: 'https://cdn.discordapp.com/emojis/1199000000000000002.png' });
  assert.equal(classic[2].body.content, '​');
  assert.deepEqual(classic[3].body.embeds[0].fields.map((f) => f.inline), [true, true], 'fields lost side by side');
  assert.deepEqual(classic[3].reactions, ['✅']);
  assert.deepEqual(classic[5].body.components[0].components, [{ type: 2, style: 5, url: 'https://twitch.tv/x', label: 'Twitch', emoji: { id: '1199000000000000002', name: 'basslinekid', animated: false } }]);
  assert.ok(classic.every((m) => m.body.allowed_mentions?.parse?.length === 0), 'a page could ping');
});

test('one message lays the page out in Discord\'s newer layout: galleries, containers with the edge, separators', () => {
  const c = single.body.components;
  assert.equal(single.body.flags, 1 << 15);
  assert.equal(single.body.content, undefined);
  assert.deepEqual(c.map((x) => x.type), [12, 17, 14, 17, 10, 1]);
  assert.equal(c[0].items[0].media.url, 'attachment://banner-0.png');
  assert.equal(c[1].accent_color, 0xfefefe);
  assert.equal(c[1].components[0].content, `### Bienvenidos\nHola ${EMOJI} en <#1199000000000000003>`);
  assert.deepEqual(c[2], { type: 14, divider: true, spacing: 1 });
  assert.equal(c[3].components[1].content, '**Enlaces**\n[Los directos!](https://twitch.tv/x)\n\n**Redes**\n[Youtube](https://youtube.com/)', 'fields did not stack');
  assert.deepEqual(single.reactions, ['✅']);
  assert.equal(shared.countComponents(c), 11);
});

// Discord's limits, said before anything is sent.
const card = { type: 'card', title: 'x', description: 'y', thumbnail: 'https://pic/t.png', image: 'https://pic/i.png', footer: 'z', fields: [{ name: 'a', value: 'b' }] };
const tooMany = shared.pageProblems(shared.cleanPage({ style: 'single', blocks: Array.from({ length: 7 }, () => card) }));
const tooLong = shared.pageProblems(shared.cleanPage({ style: 'single', blocks: [{ type: 'text', text: 'a'.repeat(2000) }, { type: 'text', text: 'b'.repeat(2000) }, { type: 'text', text: 'c' }] }));
const cardLong = shared.pageProblems(shared.cleanPage({ style: 'classic', blocks: [{ type: 'card', description: 'd'.repeat(4096), fields: [1, 2].map(() => ({ name: 'n', value: 'v'.repeat(1024) })) }] }));
const empties = shared.pageProblems(shared.cleanPage({ blocks: [{ type: 'banner' }, { type: 'links', buttons: [{ label: 'x' }] }] }));

test('Discord\'s limits are said before posting: pieces and characters of one message, a long card, an empty banner', () => {
  assert.deepEqual(tooMany.map((p) => p.code), ['page_too_many']);
  assert.equal(tooMany[0].vars.max, 40);
  assert.deepEqual(tooLong.map((p) => p.code), ['page_too_long']);
  assert.deepEqual(cardLong.map((p) => p.code), ['page_card_long']);
  assert.deepEqual(empties.map((p) => p.code), ['page_banner_empty', 'page_links_empty']);
  assert.deepEqual(shared.pageProblems(shared.cleanPage({ blocks: [] })).map((p) => p.code), ['page_empty']);
});

// ---------------------------------------------------------------- posting, changing, testing, taking down

const calls = [];
const missing = new Set();
let nextId = 9000;
let channelMessages = [];
const realFetch = globalThis.fetch;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith('https://cdn.discordapp.com/attachments/')) return new Response(Buffer.from('a picture of discord\'s'), { status: 200, headers: { 'content-type': 'image/gif' } });
  if (!u.includes('discord.com/api')) return realFetch(url, init);
  const method = init.method || 'GET';
  const route = u.replace(/^.*\/api\/v10/, '');
  let body = null;
  if (init.body instanceof FormData) {
    body = JSON.parse(init.body.get('payload_json'));
    body.fileNames = [...init.body.keys()].filter((k) => k.startsWith('files[')).map((k) => init.body.get(k).name);
  } else if (typeof init.body === 'string') body = JSON.parse(init.body);
  calls.push({ method, route, body });
  const id = route.split('/').pop();
  if ((method === 'PATCH' || method === 'DELETE') && missing.has(id)) return json({ message: 'Unknown Message', code: 10008 }, 404);
  if (method === 'POST' && /\/messages$/.test(route)) return json({ id: String(nextId += 1) });
  if (method === 'GET' && /\/messages\?limit=/.test(route)) return json(channelMessages);
  if (method === 'PATCH') return json({ id });
  return new Response(null, { status: 204 });
};
const tokenBefore = config.discord.botToken;
config.discord.botToken = 'test-token';
const greetings = collection('welcome_goodbye', {});
const greetingsBefore = greetings.get();
greetings.set({ ...greetingsBefore, testChannelId: '700000000000000999' });

const since = () => { const n = calls.length; return () => calls.slice(n); };
const short = (list) => list.map((c) => `${c.method} ${c.route.replace(/\/reactions\/.*$/, '/reactions')}`);

const small = pages.savePage({
  name: 'Reglas', channelId: '700000000000000100', style: 'classic', color: '#fefefe',
  blocks: [
    { id: 'b-banner', type: 'banner', image: '/media/page-banner.png' },
    { id: 'b-rules', type: 'card', description: '1. Respetar', reactions: ['✅'] },
    { id: 'b-gap', type: 'gap' },
    { id: 'b-text', type: 'text', text: 'Hola' },
  ],
});
let seen = since();
const posted = await pages.postPage(small.id);
const firstPost = seen();
const firstIds = pages.snapshot().discordPages.find((p) => p.id === small.id).posted.ids;

// Only the words of one block change: one message is edited.
pages.savePage({ ...small, blocks: small.blocks.map((b) => (b.id === 'b-text' ? { ...b, text: 'Hola a todos' } : b)) });
seen = since();
const wordsChanged = await pages.postPage(small.id);
const wordsCalls = seen();

// The banner's picture and the rules' reaction change: the banner's message gets the new file, the reaction moves.
pages.savePage({ ...small, blocks: small.blocks.map((b) => (b.id === 'b-text' ? { ...b, text: 'Hola a todos' } : b.id === 'b-banner' ? { ...b, image: '/media/page-banner-2.png' } : b.id === 'b-rules' ? { ...b, reactions: ['🎉'] } : b)) });
seen = since();
const pictureChanged = await pages.postPage(small.id);
const pictureCalls = seen();

// Blocks moved: posted again, the old messages removed.
const current = () => pages.snapshot().discordPages.find((p) => p.id === small.id);
pages.savePage({ ...current(), blocks: [current().blocks[0], current().blocks[1], current().blocks[3], current().blocks[2]] });
seen = since();
const moved = await pages.postPage(small.id);
const movedCalls = seen();
const movedIds = current().posted.ids;

// As one message instead: one message up, the separate ones gone.
pages.savePage({ ...current(), style: 'single' });
seen = since();
const asOne = await pages.postPage(small.id);
const asOneCalls = seen();
const oneId = current().posted.ids[0];

// One message edited whole; then deleted by hand in Discord, so posted again.
pages.savePage({ ...current(), blocks: current().blocks.map((b) => (b.id === 'b-rules' ? { ...b, title: 'Reglas!' } : b)) });
seen = since();
const oneEdited = await pages.postPage(small.id);
const oneEditedCalls = seen();
missing.add(oneId);
seen = since();
const afterHandDelete = await pages.postPage(small.id);
const handDeleteCalls = seen();

// Tests go to the test channel, each in place of the last.
seen = since();
const tested = await pages.testPage(small.id);
const retested = await pages.testPage(small.id);
const testCalls = seen();

const upId = current().posted.ids[0];
seen = since();
const takenDown = await pages.unpostPage(small.id);
const downCalls = seen();
const afterDown = current();

test('a page goes up a message per block, with its reactions, and says where its messages are', () => {
  assert.deepEqual(posted, { done: 'posted', messages: 4, channelId: '700000000000000100' });
  assert.deepEqual(short(firstPost), [
    'POST /channels/700000000000000100/messages', 'POST /channels/700000000000000100/messages', 'PUT /channels/700000000000000100/messages/9002/reactions',
    'POST /channels/700000000000000100/messages', 'POST /channels/700000000000000100/messages',
  ]);
  assert.deepEqual(firstPost[0].body.fileNames, ['banner-0.png'], 'the banner was not sent as a file');
  assert.equal(firstIds.length, 4);
});

test('changing a page that is up edits only the messages whose block changed, and moves reactions', () => {
  assert.deepEqual(wordsChanged, { done: 'updated', changed: 1, messages: 4, channelId: '700000000000000100' });
  assert.deepEqual(short(wordsCalls), [`PATCH /channels/700000000000000100/messages/${firstIds[3]}`]);
  assert.equal(wordsCalls[0].body.content, 'Hola a todos');
  assert.equal(pictureChanged.changed, 1, 'a reaction counted as a change to the message');
  assert.deepEqual(short(pictureCalls), [
    `PATCH /channels/700000000000000100/messages/${firstIds[0]}`,
    `DELETE /channels/700000000000000100/messages/${firstIds[1]}/reactions`,
    `PUT /channels/700000000000000100/messages/${firstIds[1]}/reactions`,
  ]);
  assert.deepEqual(pictureCalls[0].body.fileNames, ['banner-0.png']);
  assert.deepEqual(pictureCalls[0].body.attachments, [{ id: 0, filename: 'banner-0.png' }], 'the old picture was kept beside the new');
});

test('a page whose blocks moved is posted again and the old copy removed', () => {
  assert.equal(moved.done, 'reposted');
  assert.equal(movedCalls.filter((c) => c.method === 'POST').length, 4);
  assert.deepEqual(movedCalls.filter((c) => c.method === 'DELETE' && !c.route.includes('/reactions/')).map((c) => c.route.split('/').pop()), firstIds);
  assert.ok(movedCalls.findIndex((c) => c.method === 'DELETE') > movedCalls.findIndex((c) => c.method === 'POST'), 'the old copy went before the new one was up');
});

test('as one message: posted with the newer layout\'s flag, edited whole, and posted again if deleted by hand', () => {
  assert.equal(asOne.done, 'reposted');
  const post = asOneCalls.find((c) => c.method === 'POST' && c.route.endsWith('/messages'));
  assert.equal(post.body.flags, 1 << 15);
  assert.deepEqual(post.body.components.map((c) => c.type), [12, 17, 10, 14]);
  assert.deepEqual(post.body.fileNames, ['banner-0.png']);
  assert.deepEqual(asOneCalls.filter((c) => c.method === 'DELETE' && !c.route.includes('/reactions/')).map((c) => c.route.split('/').pop()), movedIds);
  assert.deepEqual(oneEdited, { done: 'updated', changed: 1, messages: 1, channelId: '700000000000000100' });
  assert.deepEqual(short(oneEditedCalls), [`PATCH /channels/700000000000000100/messages/${oneId}`]);
  assert.equal(oneEditedCalls[0].body.flags, 1 << 15);
  assert.ok(oneEditedCalls[0].body.components[1].components[0].content.startsWith('### Reglas!'));
  assert.equal(afterHandDelete.done, 'reposted');
  assert.deepEqual(handDeleteCalls.filter((c) => !c.route.includes('/reactions/')).map((c) => c.method), ['PATCH', 'POST', 'DELETE']);
});

test('a test goes to the test channel in place of the last one; taking a page down removes it', () => {
  assert.deepEqual(tested, { done: 'tested', messages: 1, channelId: '700000000000000999' });
  assert.equal(retested.channelId, '700000000000000999');
  const testPosts = testCalls.filter((c) => c.method === 'POST');
  assert.ok(testPosts.every((c) => c.route === '/channels/700000000000000999/messages'), 'a test went somewhere else');
  assert.equal(testCalls.filter((c) => c.method === 'DELETE' && !c.route.includes('/reactions/')).length, 1, 'the last test was left behind');
  assert.equal(takenDown.removed, 1);
  assert.deepEqual(short(downCalls), [`DELETE /channels/700000000000000100/messages/${upId}`]);
  assert.equal(afterDown.posted, null);
  assert.ok(afterDown.tested?.ids?.length, 'the test was forgotten');
});

// ---------------------------------------------------------------- reading a channel back, MEE6's page included

const WEBHOOK = { id: '1306060077681344585', username: 'StreamBot', bot: true };
const at = (n) => `https://cdn.discordapp.com/attachments/1/${n}/image.gif?ex=1&is=2&hm=3`;
// Newest first, the way Discord lists them.
channelMessages = [
  { id: '611', type: 0, author: { id: '5', username: 'someone' }, content: 'jaja buenas', embeds: [], attachments: [] },
  { id: '610', type: 0, author: WEBHOOK, webhook_id: WEBHOOK.id, content: '', embeds: [{ type: 'rich', color: 0xfefefe, description: '😃 1. Respetar' }], attachments: [], reactions: [{ emoji: { name: '✅', id: null }, count: 4 }] },
  { id: '609', type: 0, author: WEBHOOK, webhook_id: WEBHOOK.id, content: '', embeds: [], attachments: [{ filename: 'image.gif', content_type: 'image/gif', url: at(609) }] },
  { id: '608', type: 0, author: WEBHOOK, webhook_id: WEBHOOK.id, content: '\u0000', embeds: [], attachments: [] },
  { id: '607', type: 0, author: WEBHOOK, webhook_id: WEBHOOK.id, content: '', attachments: [], embeds: [{ type: 'rich', color: 0xfefefe, description: `Aqui los links ${EMOJI}`, fields: [{ name: 'Enlaces', value: '[Los directos!](https://www.twitch.tv/i_might_be_a_bot )', inline: true }] }] },
  { id: '606', type: 7, author: { id: '6', username: 'joined' }, content: '', embeds: [], attachments: [] },
  { id: '605', type: 0, author: { id: '7', username: 'bot', bot: true }, flags: 1 << 15, content: '', embeds: [], attachments: [], components: [
    { type: 14, divider: true, spacing: 2 },
    { type: 17, accent_color: 0x123456, components: [{ type: 10, content: '### Mods' }, { type: 12, items: [{ media: { url: at(605) } }] }] },
    { type: 1, components: [{ type: 2, style: 5, label: 'Twitch', url: 'https://twitch.tv/x' }] },
  ] },
];
seen = since();
const imported = await pages.importPage('700000000000000100');
const importCalls = seen();
const importedBlocks = imported.blocks;
const savedPicture = importedBlocks.find((b) => b.type === 'banner')?.image || '';
const savedFile = path.join(config.assetsDir, decodeURIComponent(savedPicture.replace('/media/', '')));
seen = since();
const deleted = await pages.deleteSource(imported.id);
const deleteCalls = seen();

globalThis.fetch = realFetch;
config.discord.botToken = tokenBefore;
greetings.set(greetingsBefore);
for (const p of pages.snapshot().discordPages) pages.removePage(p.id);

test('a page is read back from a channel: MEE6\'s banners, cards, invisible gaps and reactions, and the newer layout', () => {
  assert.deepEqual(importedBlocks.map((b) => b.type), ['gap', 'card', 'links', 'card', 'gap', 'banner', 'card']);
  assert.deepEqual(importedBlocks[0], { id: importedBlocks[0].id, type: 'gap', size: 'large', line: true });
  assert.equal(importedBlocks[1].color, '#123456');
  assert.equal(importedBlocks[1].description, '### Mods');
  assert.match(importedBlocks[1].image, /^\/media\/page-605-/, 'a picture in a container was not kept');
  assert.equal(importedBlocks[3].fields[0].value, '[Los directos!](https://www.twitch.tv/i_might_be_a_bot )');
  assert.equal(importedBlocks[3].fields[0].inline, true);
  assert.deepEqual(importedBlocks[4], { id: importedBlocks[4].id, type: 'gap', size: 'small', line: false }, 'MEE6\'s invisible message was not read as a gap');
  assert.match(savedPicture, /^\/media\/page-609-0\.gif$/);
  assert.equal(fs.readFileSync(savedFile, 'utf8'), 'a picture of discord\'s', 'Discord\'s picture was linked rather than kept');
  assert.deepEqual(importedBlocks[6].reactions, ['✅']);
  assert.equal(imported.style, 'classic');
  assert.equal(imported.color, '#123456');
  assert.deepEqual(imported.source.ids, ['605', '607', '608', '609', '610'], 'chat or a join was read as part of the page');
  assert.ok(importCalls.every((c) => c.method === 'GET'), 'reading a channel changed something in it');
});

test('the originals are deleted only when asked, and only those', () => {
  assert.deepEqual(deleted, { removed: 5, of: 5 });
  assert.deepEqual(deleteCalls.map((c) => `${c.method} ${c.route}`), ['605', '607', '608', '609', '610'].map((id) => `DELETE /channels/700000000000000100/messages/${id}`));
});

test('the Discord pages tab: both ways to post, a test, reading a channel, and the preview', () => {
  const view = read('../../web/components/views/DiscordPagesView.tsx');
  assert.ok(view.includes('data-page-style-pick={style}') && view.includes("(['classic', 'single'] as const)"), 'the two ways are not offered');
  assert.ok(view.includes("act('test', { id: draft.id }") && view.includes("act('import', { channelId: importFrom }"));
  assert.ok(view.includes("arm('source'"), 'the originals can be deleted with one press');
  assert.ok(read('../../web/App.tsx').includes("view === 'discord-pages'"));
  assert.ok(read('../api/ws.js').includes('case C2S.DISCORD_PAGES:'));
  assert.ok(read('../../web/components/DiscordPagePreview.tsx').includes('data-page-preview-container'));
});
