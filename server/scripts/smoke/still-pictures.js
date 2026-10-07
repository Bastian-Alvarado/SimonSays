/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Smoke tests: pictures picked are shown still (web/components/StillPicture.tsx)
 * — wherever pictures are picked, the uploads to choose from and the one
 * chosen are first frames at the size shown, not every upload moving at full
 * size at once, which made each of those screens lag. Previews of what goes
 * out can move, and can be stopped; the two Discord editors redraw only
 * when what they show changed.
 *
 * Runs in order with the other feature files, on the one engine the harness
 * boots — through scripts/smoke.js, never on its own.
 */

import { SCRIPT_URL, assert, fs, test } from './harness.js';

const read = (p) => fs.readFileSync(new URL(p, SCRIPT_URL), 'utf8');
const components = (dir = '../../web/components/') => fs.readdirSync(new URL(dir, SCRIPT_URL), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? components(`${dir}${d.name}/`) : d.name.endsWith('.tsx') ? [`${dir}${d.name}`] : []));

test('no picture picker shows its uploads moving: every list of uploads is stills', () => {
  // A screen that lists the uploads to pick from, drawing one as it is.
  const raw = /<img\b[^>]*\bsrc=\{(?:\w+\()?\w+\.url\)?\}/;
  const pickers = components().filter((f) => /listAssets|uploads\.map|assets\.map/.test(read(f)));
  assert.ok(pickers.length >= 10, `too few pickers found: ${pickers.length}`);
  for (const f of pickers) assert.ok(!raw.test(read(f)), `${f.replace('../../web/components/', '')} shows its uploads moving`);
});

test('and the picture chosen is a still too, in every picker', () => {
  const chosen = {
    'ImageLayerPanel.tsx': '<StillImg src={src} width={32}',
    'OmnibarLogoPanel.tsx': '<StillImg src={logo} width={56}',
    'PngtuberLayerPanel.tsx': '<StillImg src={value} width={96}',
    'VoicePicturesEditor.tsx': '<StillImg src={entry[kind]} width={160}',
    'WelcomeCardLayers.tsx': '<StillImg src={l.src} width={48}',
    'PicturePick.tsx': '<StillImg src={pictureSrc(value)}',
    'views/GoLiveView.tsx': '<StillImg src={events.coverPicture} width={90}',
    'views/VoiceView.tsx': '<StillImg src={entry.quiet || entry.talking || entry.muted} width={28}',
  };
  for (const [file, still] of Object.entries(chosen)) assert.ok(read(`../../web/components/${file}`).includes(still), `${file} shows the picture chosen moving`);
});

test('the previews of what goes out move, and a button stops them, remembered once for both', () => {
  const pages = read('../../web/components/views/DiscordPagesView.tsx');
  const greet = read('../../web/components/views/WelcomeGoodbyeView.tsx');
  for (const [name, text] of [['Discord pages', pages], ['Welcome & Goodbye', greet]]) {
    assert.ok(text.includes('usePreviewStill()'), `${name} does not remember the choice`);
    assert.ok(text.includes("t.previewStill || 'Stop moving pictures'"), `${name} has no button to stop them`);
  }
  assert.ok(greet.includes('? <StillImg src={embed.image} width={520}'), 'the welcome preview does not stop');
});

test('the two Discord editors are drawn again only when something they show changed', () => {
  assert.ok(read('../../web/components/views/DiscordPagesView.tsx').includes('export const DiscordPagesView = React.memo(PagesScreen,'));
  const greet = read('../../web/components/views/WelcomeGoodbyeView.tsx');
  assert.ok(greet.includes('export const WelcomeGoodbyeView = React.memo(WelcomeScreen,'));
  // An update given as a function reads the welcome settings: the screen must be fresh whenever they change.
  assert.ok(greet.includes('a.system.data.welcomeGoodbyeConfig === b.system.data.welcomeGoodbyeConfig'), 'its settings changing would not draw it again');
  // Everything it reads from the system is compared.
  for (const used of ['discordRoles', 'discordChannels', 'discordEmojis', 'discordGuilds', 'discordGuildId', 'botMember', 'status.discord']) {
    assert.ok(greet.split('React.memo(WelcomeScreen')[1].includes(used), `${used} changing would not draw it again`);
  }
});
