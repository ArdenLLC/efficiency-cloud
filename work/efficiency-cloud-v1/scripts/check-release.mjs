// Fails a release build while legal pages still contain unfilled placeholders or env is incomplete.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const strict = process.env.RELEASE === '1';
const problems = [];
for (const f of fs.readdirSync(path.join(root, 'public', 'legal'))) {
  const text = fs.readFileSync(path.join(root, 'public', 'legal', f), 'utf8');
  const hits = text.match(/【待填写[^】]*】/g);
  if (hits) problems.push(`legal/${f}: ${hits.length} 处待填写（如 ${hits[0]}）`);
}
for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_APP_URL']) if (!process.env[k]) problems.push(`缺少环境变量 ${k}`);
if (problems.length) {
  console.warn((strict ? 'RELEASE CHECK FAILED:\n' : 'Release check warnings (set RELEASE=1 to make these fatal):\n') + problems.map(p => ' - ' + p).join('\n'));
  if (strict) process.exit(1);
} else console.log('Release check passed.');
