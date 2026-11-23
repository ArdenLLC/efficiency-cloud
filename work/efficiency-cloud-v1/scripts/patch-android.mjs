// Post-`cap add android` tweaks: version from package.json, no cloud backup of tokens, cleartext off.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);
const versionCode = maj * 10000 + min * 100 + pat; // 3.4.0 -> 30400
const gradle = path.join(root, 'android', 'app', 'build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
g = g.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
fs.writeFileSync(gradle, g);
const manifest = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let m = fs.readFileSync(manifest, 'utf8');
m = m.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
if (!/usesCleartextTraffic/.test(m)) m = m.replace('<application', '<application\n        android:usesCleartextTraffic="false"');
fs.writeFileSync(manifest, m);
console.log(`Patched Android project: versionName ${pkg.version}, versionCode ${versionCode}.`);
