/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: the welcome card — a stylesheet on named parts turned into a
 * picture on the server, and posted with the welcome.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own. The Discord module and
 * the membership automation were set up by the files before this one.
 */

import { SCRIPT_URL, assert, bus, fs, test } from './harness.js';

const cardCss = await import('../../../shared/card-css.js');
const { CARD_LOOKS } = await import('../../../shared/card-looks.js');
const card = await import('../../engine/welcome-card.js');
const roles = await import('../../engine/discord-roles.js');
const { config } = await import('../../config.js');

// ---------------------------------------------------------------- the cascade

const sheet = `
:scope { --accent: #22d3ee; /* Accent */ background: #101010; }
[data-card="name"] { color: var(--accent) !important; }
[data-card="name"] { color: red; font-weight: 700; }
[data-card="title"], [data-card="subtitle"] { color: var(--missing, #abcdef); display: block; }
[data-card="avatar"]::before { content: "x"; }
.anything span { color: red; }
@keyframes spin { to { transform: rotate(1turn); } }
[data-card="background"] { background-image: none; }
`;
const cascaded = cardCss.cascadeCard(sheet, { '--accent': '#f472b6' }, { card: { backgroundImage: 'linear-gradient(red, blue)', backgroundColor: '#000' }, background: { backgroundImage: 'url(x)' } });

test('a card stylesheet reaches its named parts, and says which rules a picture cannot have', () => {
  const { styles, ignored } = cascaded;
  // The field's value wins over the stylesheet's, and !important over a later plain rule.
  assert.equal(styles.name.color, '#f472b6');
  assert.equal(styles.name.fontWeight, 700, 'a numeric weight stayed a string');
  // A var() with nothing to find falls back; one rule can name two parts.
  assert.equal(styles.title.color, '#abcdef');
  assert.equal(styles.subtitle.color, '#abcdef');
  // The renderer only lays out with flex.
  assert.equal(styles.title.display, 'flex');
  // A shorthand resets the default gradient under it; "none" takes a picture away.
  assert.equal(styles.card.backgroundImage, undefined);
  assert.equal(styles.card.background, '#101010');
  assert.equal(styles.background.backgroundImage, undefined);
  assert.deepEqual(ignored, ['[data-card="avatar"]::before', '.anything span']);
});

test('a card is kept within bounds, and only fetches pictures it may', () => {
  const clean = cardCss.cleanCard({ width: 99999, height: 1, background: 'file:///etc/passwd', cssVars: { '--ok': '#fff', 'bad': 'x', '--evil': 'red; } body {' }, title: 'line\nbreak' });
  assert.equal(clean.width, 1600);
  assert.equal(clean.height, 150);
  assert.equal(clean.background, '');
  assert.deepEqual(clean.cssVars, { '--ok': '#fff' });
  assert.equal(clean.title, 'line break');
  assert.equal(cardCss.cleanCard({ background: '/media/banner.png' }).background, '/media/banner.png');
  assert.equal(cardCss.fillCardText('Welcome {username} to {server}, #{count}', { name: 'Ana', server: 'S', count: 7 }), 'Welcome Ana to S, #7');
});

// ---------------------------------------------------------------- drawing it

const PNG = '89504e470d0a1a0a';
const drawn = await card.renderCard({ enabled: true, css: sheet, title: 'Bienvenido', subtitle: 'Miembro #{count}' }, { name: 'Ñandú Ölçer' }, { server: 'S', count: 128 });
const looks = [];
for (const look of CARD_LOOKS) {
  try {
    const r = await card.renderCard({ css: look.css }, { name: 'Rowan' }, { count: 3 });
    looks.push([look.id, r.png.subarray(0, 8).toString('hex') === PNG, r.ignored.length]);
  } catch (err) {
    looks.push([look.id, false, err.message]);
  }
}
const previewed = await card.previewCard({ enabled: true, css: '.nope {}' }, { avatar: '' });

test('the server draws the card as a PNG, and every look draws', () => {
  assert.equal(drawn.png.subarray(0, 8).toString('hex'), PNG, 'not a PNG');
  assert.ok(drawn.png.length > 5000, 'suspiciously small picture');
  for (const [id, ok, extra] of looks) {
    assert.ok(ok, `${id} did not draw: ${extra}`);
    assert.equal(extra, 0, `${id} uses rules a picture cannot have`);
  }
  assert.ok(previewed.image?.startsWith('data:image/png;base64,'), previewed.error);
  assert.deepEqual(previewed.ignored, ['.nope']);
});

// ---------------------------------------------------------------- posted with the welcome

const sentForms = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (init.body instanceof FormData) {
    sentForms.push({ path: u.replace(/^.*\/api\/v10/, ''), payload: JSON.parse(init.body.get('payload_json')), file: init.body.get('files[0]') });
  }
  if (/\/guilds\/g1\?with_counts=true$/.test(u)) return new Response(JSON.stringify({ approximate_member_count: 99 }), { status: 200 });
  return new Response(JSON.stringify({ id: 'm' }), { status: 200 });
};
const realToken = config.discord.botToken;
config.discord.botToken = 'test-token';
const saved = roles.store.setWelcomeGoodbye({
  welcome: { enabled: true, channelId: '55', messages: [], sendCard: true, cardDescription: 'Hola {user}', canvas: { enabled: true, layers: [] }, image: { enabled: true, title: 'Bienvenido', subtitle: 'Miembro #{count}' } },
  goodbye: { enabled: false, channelId: '', messages: [], canvas: { enabled: false } },
});
bus.emit('discord:member_join', { guild_id: 'g1', user: { id: '4242424242', username: 'nuevo', global_name: 'Nuevo' } });
await new Promise((r) => setTimeout(r, 2500));
config.discord.botToken = realToken;
globalThis.fetch = realFetch;
roles.store.setWelcomeGoodbye({ welcome: { enabled: false }, goodbye: { enabled: false } });

test('somebody joining is welcomed with the card drawn for them, as the embed\'s picture', () => {
  assert.equal(saved.welcome.canvas, undefined, 'the first version\'s canvas is still kept');
  assert.equal(saved.welcome.image.enabled, true);
  const post = sentForms.find((f) => f.path === '/channels/55/messages');
  assert.ok(post, 'no welcome was posted with a picture');
  assert.equal(post.payload.embeds[0].image.url, 'attachment://welcome.png');
  assert.equal(post.payload.embeds[0].description, 'Hola <@4242424242>');
  assert.equal(post.payload.attachments[0].filename, 'welcome.png');
  assert.ok(post.file && post.file.size > 5000, 'the picture was not attached');
});

test('the first version\'s canvas editor is gone, and the card editor asks the server to draw', () => {
  const view = fs.readFileSync(new URL('../../web/components/views/WelcomeGoodbyeView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(!/renderCanvas|canvasRef|CanvasConfig/.test(view), 'the canvas editor is still there');
  assert.ok(view.includes('<WelcomeCardEditor'));
  const utils = fs.readFileSync(new URL('../../web/utils.ts', SCRIPT_URL), 'utf8');
  assert.ok(!utils.includes('renderCanvas'), 'the canvas drawing code is still shipped');
  const editor = fs.readFileSync(new URL('../../web/components/WelcomeCardEditor.tsx', SCRIPT_URL), 'utf8');
  assert.ok(editor.includes('<StyleFieldsPanel') && editor.includes('CARD_LOOKS.map'), 'the card has no fields or looks');
  const strings = fs.readFileSync(new URL('../../web/constants.ts', SCRIPT_URL), 'utf8');
  for (const key of ['welcomeCardTitle', 'welcomeCardHint', 'welcomeCardCss', 'welcomeCardIgnored', 'welcomeCardVars']) assert.equal(strings.split(key + ':').length - 1, 2, key);
});

// ---------------------------------------------------------------- placeholders, the reaction, tests

const welcome = await import('../../engine/welcome.js');
const words = await import('../../../shared/greeting-text.js');

const NOW = Date.UTC(2026, 9, 2, 18, 0, 0);
// An account id made at a known moment: the moment since Discord's epoch, shifted into place.
const idMadeAt = (ms) => String(BigInt(ms - 1420070400000) << 22n);
const twoYears = idMadeAt(Date.UTC(2024, 6, 1, 18));
const filled = words.fillGreeting('{user}|{username}|{server}|{count}|{boosts}|{date}|{account_age}|{created}', {
  name: 'Ana', mention: '<@1>', server: 'SS', count: 42, boosts: 3, id: twoYears, now: NOW,
});
const line = welcome.greetingFor({ messages: ['Hola {user}, eres el #{count} en {server}'] }, { id: '99999', username: 'nuevo' }, true, false, { server: 'SimonSays', count: 7 });

test('every placeholder is filled, the same way in a line, the embed and the card', () => {
  assert.equal(filled, '<@1>|Ana|SS|42|3|2 de octubre de 2026|2 años|1 de julio de 2024');
  // {server} and {count} were offered under every line and only ever filled on the card.
  assert.equal(line.content, 'Hola <@99999>, eres el #7 en SimonSays');
  assert.equal(words.accountAge(NOW - 3 * 86400000, NOW), '3 días');
  assert.equal(words.accountAge(NOW - 3600000, NOW), 'hoy');
  assert.equal(words.accountAge(NOW - 45 * 86400000, NOW), '1 mes');
  assert.equal(words.createdAt('not an id'), null);
  assert.equal(cardCss.fillCardText('{user} · {account_age}', { name: 'Ana', id: twoYears, now: NOW }), 'Ana · 2 años', 'the card pings, or misses the new ones');
});

test('a welcome waves by default, and a reaction is an emoji or nothing', () => {
  const saved = welcome.setGreetings({ welcome: { enabled: true }, goodbye: { react: '' } });
  assert.equal(saved.welcome.react, '👋', 'a welcome saved before the reaction does not wave');
  assert.equal(saved.goodbye.react, '');
  assert.equal(welcome.cleanReaction('hola'), '', 'a word was kept as a reaction');
  assert.equal(welcome.cleanReaction('<:Wow:123456789012345678>'), '<:Wow:123456789012345678>');
  assert.equal(welcome.cleanReaction('🎉'), '🎉');
});

// A real join, with the reaction under the post.
const reacted = [];
const realFetch2 = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if ((init.method || 'GET') === 'PUT' && u.includes('/reactions/')) reacted.push(u.replace(/^.*\/api\/v10/, ''));
  if (u.includes('/guilds/g1?with_counts=true')) return new Response(JSON.stringify({ approximate_member_count: 12, name: 'SimonSays', owner_id: '1' }), { status: 200 });
  return new Response(JSON.stringify({ id: 'posted1' }), { status: 200 });
};
config.discord.botToken = 'test-token';
welcome.setGreetings({ welcome: { enabled: true, channelId: '55', messages: ['Hola {user}'] }, goodbye: { enabled: false }, testChannelId: '777' });
const keptTestChannel = welcome.getGreetings().testChannelId;
bus.emit('discord:member_join', { guild_id: 'g1', user: { id: '4242424242', username: 'nuevo' } });
await new Promise((r) => setTimeout(r, 1500));
config.discord.botToken = realToken;
globalThis.fetch = realFetch2;
let offline = null;
try { await welcome.testGreeting('welcome'); } catch (err) { offline = err; }
let unknown = null;
try { await welcome.testGreeting('party'); } catch (err) { unknown = err; }
welcome.setGreetings({ welcome: { enabled: false }, goodbye: { enabled: false } });

test('the bot reacts under its own welcome, for everybody else to say hi', () => {
  assert.deepEqual(reacted, [`/channels/55/messages/posted1/reactions/${encodeURIComponent('👋')}/@me`]);
});

test('a test goes to the test channel, and says why when it cannot go', () => {
  assert.equal(keptTestChannel, '777', 'where tests go is not kept');
  assert.equal(offline?.code, 'discord_offline', offline?.message);
  assert.equal(unknown?.code, 'welcome_unknown_kind', unknown?.message);
  const src = fs.readFileSync(new URL('../engine/welcome.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes('if (testChannel) cfg.channelId = testChannel;'), 'a test goes to the real channel even with a test channel chosen');
  assert.ok(!src.slice(src.indexOf('export async function testGreeting')).includes('addRole'), 'a test hands out the auto-role');
  const view = fs.readFileSync(new URL('../../web/components/views/WelcomeGoodbyeView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes("system.actions.testWelcome(kind, entry(kind), config.testChannelId || '')"), 'the screen tests the saved settings, or ignores the test channel');
  assert.ok(view.includes('data-greet-test-channel') && view.includes('data-greet-react'), 'the screen has no test channel or reaction');
  // The preview fills placeholders with the server's own function.
  assert.ok(view.includes("import { fillGreeting, GREETING_PLACEHOLDERS } from '../../../shared/greeting-text.js';"));
});

// ---------------------------------------------------------------- the card without CSS, and from the person

const { collection } = await import('./harness.js');
const kept = cardCss.cleanCard({
  layout: 'diagonal', align: 'center', avatarShape: 'rounded', avatarSize: 9999, font: 'Bad"Font', nameColour: 'role', backdrop: 'banner',
  layers: [
    { kind: 'shape', shape: 'circle', colour: 'red; x', x: 5, y: 5, width: 50, height: 50, opacity: 4 },
    { kind: 'picture', src: 'file:///etc/passwd' },
    { kind: 'emoji', emoji: '<:Wow:123456789012345678>' },
    { kind: 'virus' },
    ...Array.from({ length: 12 }, () => ({ kind: 'emoji', emoji: '⭐' })),
  ],
});

test('a card\'s choices are kept within what the renderer knows', () => {
  assert.equal(kept.layout, '', 'a layout nobody offered was kept');
  assert.equal(kept.align, 'center');
  assert.equal(kept.avatarShape, 'rounded');
  assert.equal(kept.avatarSize, 480, 'the avatar can grow past the card');
  assert.equal(kept.font, '', 'a font name that is not a name was kept');
  assert.equal(kept.nameColour, 'role');
  assert.equal(kept.backdrop, 'banner');
  assert.equal(kept.layers.length, 8, 'there is no cap on layers');
  assert.equal(kept.layers[0].colour, '#ffffff', 'a colour that is not one was kept');
  assert.equal(kept.layers[0].opacity, 1);
  assert.equal(kept.layers[1].src, '', 'a picture from anywhere but an upload or the web is fetched');
  assert.equal(kept.layers[2].emoji, '<:Wow:123456789012345678>');
  assert.ok(!kept.layers.some((l) => l.kind === 'virus'));
});

const drawnSvg = await card.renderCard({
  enabled: true, title: 'Hola', name: '{username}', subtitle: '{account_age}',
  layout: 'top', avatarShape: 'square', nameColour: 'role', backdrop: 'accent', font: 'Baloo 2',
  layers: [{ kind: 'shape', colour: '#00ff00', x: 0, y: 300, width: 1000, height: 20 }, { kind: 'emoji', emoji: '⭐', x: 900, y: 10, width: 80, height: 80, front: true }],
}, { name: 'Ana', roleColour: '#f47fff', accentColour: '#2b6cb0' }, { id: '306050655881793586' }, { format: 'svg' });
const missingFont = await card.renderCard({ enabled: true, font: 'Nope Font' }, { name: 'Ana' }, {}, { format: 'svg' });

test('the choices and the layers are drawn, over the look', () => {
  assert.ok(drawnSvg.svg.includes('#f47fff'), 'the name is not in their role\'s colour');
  assert.ok(drawnSvg.svg.includes('#2b6cb0'), 'their profile colour is not behind them');
  assert.ok(drawnSvg.svg.includes('#00ff00'), 'the shape layer is not drawn');
  assert.deepEqual(drawnSvg.notes, []);
  assert.deepEqual(missingFont.notes, ['font-missing'], 'a font that cannot be drawn goes without a word');
  const src = fs.readFileSync(new URL('../engine/welcome-card.js', SCRIPT_URL), 'utf8');
  assert.ok(src.includes("if (ext === '.woff2') { woff2.add(family); continue; }"), 'a WOFF2 upload is handed to a renderer that cannot read it');
  const editor = fs.readFileSync(new URL('../../web/components/WelcomeCardEditor.tsx', SCRIPT_URL), 'utf8');
  assert.ok(editor.includes('<WelcomeCardChoices') && editor.includes('<WelcomeCardLayers'), 'the editor has no layout choices or layers');
  assert.ok(editor.includes('const key = JSON.stringify({ ...card, enabled: undefined });'), 'a change to a choice does not redraw the preview');
});

// Who the post is about: their roles from the server's list, their server avatar, their profile when the card wants it.
const discordCache = collection('discord_cache');
const cacheBefore = discordCache.get();
discordCache.set({ ...cacheBefore, roles: [
  { id: 'r1', name: 'Plain', color: 0, position: 9 },
  { id: 'r2', name: 'Pink', color: 0xf47fff, position: 5 },
  { id: 'r3', name: 'Blue', color: 0x2b6cb0, position: 2 },
] });
const profileAsked = [];
const realFetch3 = globalThis.fetch;
globalThis.fetch = async (url) => {
  profileAsked.push(String(url));
  return new Response(JSON.stringify({ id: '77777', banner: 'abc', accent_color: 0x112233 }), { status: 200 });
};
config.discord.botToken = 'test-token';
const plain = await welcome.personFor({ backdrop: '' }, { id: '77777', username: 'nuevo', avatar: 'u1' }, { nick: 'Nuevito', avatar: 'g1', roles: ['r3'] }, 'guild9', ['r2']);
const withProfile = await welcome.personFor({ backdrop: 'banner' }, { id: '77777', username: 'nuevo' }, null, 'guild9');
config.discord.botToken = realToken;
globalThis.fetch = realFetch3;
discordCache.set(cacheBefore);

test('the person is drawn as this server knows them', () => {
  assert.equal(plain.name, 'Nuevito', 'their nickname here is not used');
  assert.equal(plain.avatar, 'https://cdn.discordapp.com/guilds/guild9/users/77777/avatars/g1.png?size=256', 'their server avatar is not used');
  // The auto-role they were just given counts, and the higher coloured role wins.
  assert.equal(plain.roleColour, '#f47fff');
  assert.equal(plain.banner, undefined, 'their profile was asked for when the card does not use it');
  assert.equal(withProfile.banner, 'https://cdn.discordapp.com/banners/77777/abc.png?size=1024');
  assert.equal(withProfile.accentColour, '#112233');
  assert.equal(profileAsked.length, 1, 'their profile was asked for more than when needed');
});

// ---------------------------------------------------------------- boosts, bans, buttons and the DM

const buttons = welcome.cleanButtons([
  { kind: 'link', label: 'Reglas', url: 'https://example.com/rules', emoji: '📜' },
  { kind: 'link', label: 'Nope', url: 'javascript:alert(1)' },
  { kind: 'role', label: 'Avisos', roleId: '111', style: 3 },
  { kind: 'role', label: 'Avisos again', roleId: '111' },
  { kind: 'role', label: '', roleId: '222' },
  { kind: 'link', label: '', url: 'https://x.y' },
  ...Array.from({ length: 12 }, (_, i) => ({ kind: 'link', label: `L${i}`, url: `https://x.y/${i}` })),
]);
const rows = welcome.greetingButtonRows(buttons);
const dmRows = welcome.greetingButtonRows(buttons, { linksOnly: true });

test('buttons under a post: safe links, each role once, two rows at most', () => {
  assert.equal(buttons.length, 10, 'there is no cap on buttons');
  assert.ok(!buttons.some((b) => b.url?.startsWith('javascript')), 'a link that is not a web address was kept');
  assert.equal(buttons.filter((b) => b.roleId === '111').length, 1, 'a role appears twice — Discord refuses that message');
  assert.ok(!buttons.some((b) => b.roleId === '222'), 'a button with neither a label nor an emoji was kept');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].components[0], { type: 2, style: 5, url: 'https://example.com/rules', label: 'Reglas', emoji: { name: '📜' } });
  assert.deepEqual(rows[0].components[1], { type: 2, style: 3, custom_id: 'role:111', label: 'Avisos' }, 'a role button is not pressed like a button menu\'s');
  assert.ok(dmRows.flatMap((r) => r.components).every((c) => c.style === 5), 'a role button went into a direct message, where there is no server to give it in');
});

/*
  A stand-in Discord for the rest: every message, reaction and DM channel it
  is asked for, the server's counts, and a DM channel to answer with.
*/
const asked = [];
const realFetch4 = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url).replace(/^.*\/api\/v10/, '');
  const method = init.method || 'GET';
  let body = null;
  if (init.body instanceof FormData) body = JSON.parse(init.body.get('payload_json'));
  else if (init.body) body = JSON.parse(init.body);
  asked.push({ method, path: u, body });
  if (u.startsWith('/guilds/g1?with_counts=true')) return new Response(JSON.stringify({ name: 'SimonSays', approximate_member_count: 53, premium_subscription_count: 7, owner_id: '1' }), { status: 200 });
  if (u === '/users/@me/channels') return new Response(JSON.stringify({ id: 'dm9' }), { status: 200 });
  return new Response(JSON.stringify({ id: `m${asked.length}` }), { status: 200 });
};
config.discord.botToken = 'test-token';
welcome.setGreetings({
  welcome: {
    enabled: true, channelId: '55', messages: ['Hola {user}'], react: '',
    buttons: [{ kind: 'link', label: 'Reglas', url: 'https://example.com/rules' }, { kind: 'role', label: 'Avisos', roleId: '111' }],
    dm: { enabled: true, messages: ['Bienvenido a {server}, {username}'], links: true },
  },
  goodbye: { enabled: true, channelId: '56', messages: ['Adiós {username}'], react: '' },
  boost: { enabled: true, channelId: '57', messages: ['¡Gracias {user}! Ya van {boosts}'], buttons: [{ kind: 'link', label: 'Ver', url: 'https://example.com' }] },
  ban: { enabled: true, channelId: '58', messages: ['{username} fue baneado'] },
});
const posts = (channel) => asked.filter((a) => a.method === 'POST' && a.path === `/channels/${channel}/messages`);

bus.emit('discord:member_join', { guild_id: 'g1', user: { id: '4242424242', username: 'nuevo' }, roles: [] });
// A boost that just started, the same update again, and one from an hour ago.
const justNow = new Date().toISOString();
bus.emit('discord:member_update', { guild_id: 'g1', user: { id: '5151515151', username: 'booster' }, premium_since: justNow, roles: [] });
bus.emit('discord:member_update', { guild_id: 'g1', user: { id: '5151515151', username: 'booster' }, premium_since: justNow, roles: [] });
bus.emit('discord:member_update', { guild_id: 'g1', user: { id: '6161616161', username: 'oldbooster' }, premium_since: new Date(Date.now() - 3600000).toISOString(), roles: [] });
// A ban, and the leave Discord sends with it; and somebody simply leaving.
bus.emit('discord:member_ban', { guild_id: 'g1', user: { id: '7171717171', username: 'troll' } });
bus.emit('discord:member_leave', { guild_id: 'g1', user: { id: '7171717171', username: 'troll' } });
bus.emit('discord:member_leave', { guild_id: 'g1', user: { id: '8181818181', username: 'leaver' } });
await new Promise((r) => setTimeout(r, 3500));
config.discord.botToken = realToken;
globalThis.fetch = realFetch4;
welcome.setGreetings({ welcome: { enabled: false }, goodbye: { enabled: false }, boost: { enabled: false }, ban: { enabled: false } });

test('a welcome carries its buttons, and the newcomer gets a direct message of their own', () => {
  const [welcomed] = posts('55');
  assert.ok(welcomed, 'no welcome was posted');
  assert.deepEqual(welcomed.body.components[0].components.map((c) => c.style), [5, 2], 'the welcome lost its buttons');
  assert.ok(asked.some((a) => a.path === '/users/@me/channels' && a.body?.recipient_id === '4242424242'), 'no direct message was opened with the newcomer');
  const [dm] = posts('dm9');
  // The server's name comes from a read cached a minute, which an earlier test's stand-in left blank.
  assert.ok(dm?.body.content.startsWith('Bienvenido a ') && dm.body.content.endsWith(', nuevo'), dm?.body.content);
  assert.deepEqual(dm.body.components[0].components.map((c) => c.style), [5], 'the DM carries a role button, or not the link');
});

test('a fresh boost is thanked once, with the server\'s boost count; an old one is not', () => {
  const boosts = posts('57');
  assert.equal(boosts.length, 1, `${boosts.length} thank-yous for one boost`);
  assert.equal(boosts[0].body.content, '¡Gracias <@5151515151>! Ya van 7');
  assert.ok(asked.some((a) => a.method === 'PUT' && a.path.startsWith('/channels/57/messages/') && a.path.includes(encodeURIComponent('🎉'))), 'a boost is not celebrated by default');
});

test('a ban posts the ban, in place of the goodbye; a plain leave still says goodbye', () => {
  const bans = posts('58');
  assert.equal(bans.length, 1);
  assert.equal(bans[0].body.content, 'troll fue baneado', 'the banned person was pinged, or not named');
  const goodbyes = posts('56');
  assert.equal(goodbyes.length, 1, 'a ban was also said goodbye to, or a leave was not');
  assert.equal(goodbyes[0].body.content, 'Adiós leaver');
});

test('the bot hears of bans and boosts, and the screen offers every kind', () => {
  const gateway = fs.readFileSync(new URL('../platforms/discord.js', SCRIPT_URL), 'utf8');
  assert.ok(/const INTENTS = [^;]*\(1 << 2\)/.test(gateway), 'the bot does not ask to hear of bans');
  assert.ok(gateway.includes("case 'GUILD_BAN_ADD':") && gateway.includes("case 'GUILD_MEMBER_UPDATE':"));
  const view = fs.readFileSync(new URL('../../web/components/views/WelcomeGoodbyeView.tsx', SCRIPT_URL), 'utf8');
  for (const id of ['welcome', 'goodbye', 'boost', 'ban']) assert.ok(view.includes(`id: '${id}'`), `the screen has no ${id} tab`);
  assert.ok(view.includes('<GreetingButtons') && view.includes('data-greet-dm'), 'the screen has no buttons or direct message');
  const roles = fs.readFileSync(new URL('../engine/discord-roles.js', SCRIPT_URL), 'utf8');
  assert.ok(roles.includes("discord.getCache?.()?.roles?.find((r) => r.id === roleId)?.name"), 'a welcome\'s role button answers with a number instead of the role\'s name');
});

// ---------------------------------------------------------------- a join or a boost, for actions and alerts

const { engine, said } = await import('./harness.js');
const heard = [];
const hear = (e) => { if (e?.platform === 'discord') heard.push(e); };
const { EVENTS } = await import('../../core/bus.js');
bus.on(EVENTS.EVENT, hear);
engine.store.saveAction({
  id: 'act-discord-join', name: 'Discord join', enabled: true,
  trigger: { id: 't-dj', category: 'discord', type: 'discord_join', config: {} },
  actions: [{ id: 's-dj', type: 'twitch_chat', config: { message: '{user} entró al Discord ({event.accountAge})' } }],
});
said.length = 0;
const realFetch5 = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ id: 'x', approximate_member_count: 60, premium_subscription_count: 4 }), { status: 200 });
config.discord.botToken = 'test-token';
// The welcome post is off: the event is the app's, whether or not Discord gets a post.
welcome.setGreetings({ welcome: { enabled: false }, goodbye: { enabled: false }, boost: { enabled: false }, ban: { enabled: false } });
bus.emit('discord:member_join', { guild_id: 'g1', user: { id: twoYears, username: 'nueva', global_name: 'Nueva' }, nick: 'Nuevita' });
bus.emit('discord:member_join', { guild_id: 'g1', user: { id: '9191919191', username: 'musicbot', bot: true } });
bus.emit('discord:member_update', { guild_id: 'g1', user: { id: '5252525252', username: 'booster2' }, premium_since: new Date().toISOString() });
await new Promise((r) => setTimeout(r, 800));
config.discord.botToken = realToken;
globalThis.fetch = realFetch5;
bus.off(EVENTS.EVENT, hear);
engine.store.deleteAction('act-discord-join');

test('somebody joining or boosting the Discord is a stream event an action can answer', () => {
  const join = heard.find((e) => e.type === 'discord_join');
  assert.ok(join, 'a join with the welcome off told the app nothing');
  assert.equal(join.user, 'Nuevita', 'not the name they show in the server');
  assert.equal(join.data.accountAge, words.accountAge(words.createdAt(twoYears)));
  assert.equal(heard.filter((e) => e.type === 'discord_join').length, 1, 'a bot joining was announced');
  assert.ok(said.some((line) => line.startsWith('Nuevita entró al Discord (')), `the action did not run: ${JSON.stringify(said)}`);
  const boost = heard.find((e) => e.type === 'discord_boost');
  assert.ok(boost, 'a boost with its post off told the app nothing');
  assert.equal(boost.data.boosts, 4);
});

test('an action can be set off by them, and an alert can show them', () => {
  const actions = fs.readFileSync(new URL('../../web/components/views/ActionsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(actions.includes("value: 'discord_join'") && actions.includes("value: 'discord_boost'"), 'the action editor does not offer them');
  const alerts = fs.readFileSync(new URL('../engine/alerts.js', SCRIPT_URL), 'utf8');
  assert.ok(alerts.includes("'discord_join', 'discord_boost',"), 'an alert cannot be made for them');
  const alertsView = fs.readFileSync(new URL('../../web/components/views/AlertsView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(alertsView.includes("type: 'discord_join'"), 'the Alerts screen does not offer them');
  const picker = fs.readFileSync(new URL('../../web/components/VariablePicker.tsx', SCRIPT_URL), 'utf8');
  assert.ok(picker.includes('  discord_join: [') && picker.includes('  discord_boost: ['), 'their variables are not listed');
});

// ---------------------------------------------------------------- a name colour of one's own; server emojis picked

const ownColour = cardCss.cleanCard({ nameColour: 'own', nameColourValue: '#123456' });
const badColour = cardCss.cleanCard({ nameColour: 'own', nameColourValue: 'red; color: blue' });
const ownSvg = await card.renderCard({ enabled: true, title: 'Hola', name: '{username}', nameColour: 'own', nameColourValue: '#123456' }, { name: 'Ana' }, {}, { format: 'svg' });
const emojiButtons = welcome.cleanButtons([
  { kind: 'link', label: 'Twitch!', url: 'https://www.twitch.tv/i_might_be_a_bot', emoji: '<:Wow:123456789012345678>' },
  { kind: 'link', label: 'Baile', url: 'https://example.com', emoji: '<a:Dance:223456789012345678>' },
]);
const emojiRows = welcome.greetingButtonRows(emojiButtons);

test('the name can be any colour, for a background the look\'s does not read on', () => {
  assert.equal(ownColour.nameColour, 'own');
  assert.equal(ownColour.nameColourValue, '#123456');
  assert.equal(badColour.nameColourValue, '', 'a colour that is not one was kept');
  assert.ok(ownSvg.svg.includes('#123456'), 'the name is not drawn in the colour chosen');
  const choices = fs.readFileSync(new URL('../../web/components/WelcomeCardChoices.tsx', SCRIPT_URL), 'utf8');
  // A swatch that is always there: picking a colour is choosing it.
  assert.ok(choices.includes("onChange={(e) => set({ nameColour: 'own', nameColourValue: e.target.value })}") && choices.includes('data-card-name-colour-pick'), 'the editor offers no colour of one\'s own');
});

test('a button\'s emoji can be one of the server\'s, picked rather than typed', () => {
  assert.deepEqual(emojiRows[0].components.map((c) => c.emoji), [
    { id: '123456789012345678', name: 'Wow', animated: false },
    { id: '223456789012345678', name: 'Dance', animated: true },
  ], 'a server emoji does not reach Discord as one');
  const buttonsEditor = fs.readFileSync(new URL('../../web/components/GreetingButtons.tsx', SCRIPT_URL), 'utf8');
  assert.ok(buttonsEditor.includes('<EmojiField') && !buttonsEditor.includes('placeholder="📜"'), 'the button emoji is still typed');
  const view = fs.readFileSync(new URL('../../web/components/views/WelcomeGoodbyeView.tsx', SCRIPT_URL), 'utf8');
  assert.ok(view.includes('customEmojis={discordEmojis}'), 'the server\'s emojis are not offered');
  assert.ok(!view.includes("startsWith('<') ? '🙂'"), 'a server emoji is still shown as a stand-in');
  const layers = fs.readFileSync(new URL('../../web/components/WelcomeCardLayers.tsx', SCRIPT_URL), 'utf8');
  assert.ok(layers.includes('<EmojiField'), 'an emoji on the card is still typed');
});

// ---------------------------------------------------------------- every look has a Name field; the picker opens on screen

const { PREVIOUS_CARD_LOOKS } = await import('../../../shared/card-looks-previous.js');

test('every look gives the name a colour field, beside its other colours', () => {
  for (const look of CARD_LOOKS) {
    const field = /--([\w-]+):[^;]*;\s*\/\*\s*(Name|The name)\s*\*\//.exec(look.css);
    assert.ok(field, `${look.name} has no field for the name's colour`);
    const nameRule = look.css.slice(look.css.indexOf('[data-card="name"]'));
    assert.ok(nameRule.slice(0, nameRule.indexOf('}')).includes(`var(--${field[1]})`), `${look.name}'s name does not use its field`);
  }
});

test('a card wearing a look as it was is brought up to date; an edited one is left alone', () => {
  const was = PREVIOUS_CARD_LOOKS['card-simonsays'][0];
  // The live welcome card is exactly this: SimonSays Default, never edited.
  assert.ok(was.includes('[data-card="name"] { color: #ffffff; }'));
  const now = CARD_LOOKS.find((l) => l.id === 'card-simonsays').css;
  assert.equal(cardCss.cleanCard({ css: was }).css, now, 'a card with the old look gets no Name field');
  const edited = `${was}\n[data-card="title"] { color: red; }`;
  assert.equal(cardCss.cleanCard({ css: edited }).css, edited, 'an edited stylesheet was rewritten');
  for (const [id, versions] of Object.entries(PREVIOUS_CARD_LOOKS)) {
    assert.ok(CARD_LOOKS.some((l) => l.id === id), `${id} upgrades to a look that is not there`);
    for (const v of versions) assert.notEqual(v, CARD_LOOKS.find((l) => l.id === id).css, `${id} lists its current version as a previous one`);
  }
});

test('the emoji picker opens on the page, not inside the blurred panel', () => {
  const field = fs.readFileSync(new URL('../../web/components/EmojiField.tsx', SCRIPT_URL), 'utf8');
  // A blur behind a panel makes anything fixed inside it place itself against the panel: it opened thousands of pixels away.
  assert.ok(field.includes('createPortal(') && field.includes('document.body,'), 'the picker is drawn inside the panel again');
});
