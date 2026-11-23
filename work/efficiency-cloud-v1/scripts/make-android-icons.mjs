// Renders icon.svg into Android launcher icons (legacy, round, adaptive foreground) after `cap add android`.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
if (!fs.existsSync(res)) { console.error('android/ not found. Run: npx cap add android'); process.exit(1); }
const svg = fs.readFileSync(path.join(root, 'public', 'icon.svg'));
const svgText = svg.toString('utf8');
// Foreground for the adaptive icon: same artwork without the rounded-square background.
const fgSvg = Buffer.from(svgText.replace(/<rect[^>]*fill="url\(#bg\)"[^>]*\/>/, ''));
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [d, size] of Object.entries(legacy)) {
  const dir = path.join(res, `mipmap-${d}`); fs.mkdirSync(dir, { recursive: true });
  const square = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), square);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}"/></svg>`);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), await sharp(square).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer());
  const fsz = adaptive[d], inner = Math.round(fsz * 0.62), pad = Math.floor((fsz - inner) / 2);
  const art = await sharp(fgSvg, { density: 384 }).resize(inner, inner).png().toBuffer();
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), await sharp({ create: { width: fsz, height: fsz, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: art, left: pad, top: pad }]).png().toBuffer());
}
fs.mkdirSync(path.join(res, 'values'), { recursive: true });
fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#101827</color>\n</resources>\n');
console.log('Android launcher icons generated.');
