// Plan morning-digest § 3/§ 4: save one rig page as one self-contained HTML file (ADR 0001, 0003).
// Usage: tsx --env-file-if-exists=.env scripts/save-page.ts <path> <out-file>
// Writes under var/ (git-ignored): previews never go into the repo (ADR 0003).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';
import { lane } from '../src/lane.js';

const [path = '/digest/2026-10-28', out = 'var/preview/index.html'] = process.argv.slice(2);

const res = await createApp().request(path);
if (res.status !== 200) {
  console.error(`rig answered ${res.status} for ${path}`);
  process.exit(1);
}
const html = await res.text();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`saved ${path} -> ${out} (${html.length} bytes, marker: ${lane().marker ? 'set' : 'none'})`);
