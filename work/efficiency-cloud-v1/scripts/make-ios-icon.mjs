// Renders the 1024x1024 App icon for the Capacitor iOS project (after `cap add ios`). iOS applies its own rounded mask.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dir = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
if (!fs.existsSync(dir)) { console.error('ios project not found. Run: npx cap add ios'); process.exit(1); }
const svg = fs.readFileSync(path.join(root, 'public', 'icon.svg'), 'utf8')
  .replace(/<rect[^>]*fill="url\(#bg\)"[^>]*\/>/, '<rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>');
const png = await sharp(Buffer.from(svg), { density: 600 }).resize(1024, 1024).flatten({ background: '#101827' }).png().toBuffer();
fs.writeFileSync(path.join(dir, 'AppIcon-512@2x.png'), png);
console.log('iOS app icon generated.');
