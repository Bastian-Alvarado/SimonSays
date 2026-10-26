// The tray's icon, simonsays.ico: the dashboard's mark (web/index.html's favicon), filled so it reads at 16 px,
// drawn at each size Windows asks for and kept as PNGs inside the .ico.
//   node tray/icon/make-icon.mjs        (needs the server's packages installed: it draws with @resvg/resvg-js)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', '..', 'server', 'package.json'));
const { Resvg } = require('@resvg/resvg-js');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12 1.2l9.6 5.4v10.8L12 22.8l-9.6-5.4V6.6z" fill="#f43f5e" stroke="#be123c" stroke-width="0.8" stroke-linejoin="round"/>
  <path d="M16.6 8.4H7.4a1.3 1.3 0 0 0-1.3 1.3v4.6a1.3 1.3 0 0 0 1.3 1.3h1.4l2.2 2.2 2.2-2.2h3.4a1.3 1.3 0 0 0 1.3-1.3V9.7a1.3 1.3 0 0 0-1.3-1.3z" fill="#fff"/>
  <circle cx="9.6" cy="12" r="0.95" fill="#f43f5e"/><circle cx="12" cy="12" r="0.95" fill="#f43f5e"/><circle cx="14.4" cy="12" r="0.95" fill="#f43f5e"/>
</svg>`;
fs.writeFileSync(path.join(here, 'simonsays.svg'), svg);

const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const pngs = sizes.map((size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());

// ICONDIR, then one ICONDIRENTRY per size, then the PNGs.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((size, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
  e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
fs.writeFileSync(path.join(here, 'simonsays.ico'), Buffer.concat([header, ...dir, ...pngs]));
fs.writeFileSync(path.join(here, 'simonsays-256.png'), pngs[pngs.length - 1]);
console.log(`simonsays.ico: ${sizes.join(', ')} px`);
