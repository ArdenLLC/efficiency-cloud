// Renders PNG icons for iPhone / PWA from public/icon.svg before every build.
// iOS ignores SVG home-screen icons and applies its own rounded mask, so the artwork is made full-bleed.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const pub = path.join(root, 'public');
const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8')
  .replace(/<rect[^>]*fill="url\(#bg\)"[^>]*\/>/, '<rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>');
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(path.join(pub, name));
}
console.log('PWA icons generated.');
