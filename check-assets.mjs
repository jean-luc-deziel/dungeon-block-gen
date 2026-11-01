// Checks that every catalogue piece has a sprite (orientation 0) in all 4 styles.
// Usage: node check-assets.mjs  -> writes asset-report.json
import fs from 'node:fs';
import { spriteUrl } from './js/catalogue.js';

const all = JSON.parse(fs.readFileSync('catalogue/elements-v1.json', 'utf8'));
const elements = (Array.isArray(all) ? all : all.elements ?? Object.values(all))
  .filter((e) => e.code && !e.code.startsWith('X99') && !e.code.startsWith('ZZ'));
const styles = [
  ['isometric', 'isometric'],
  ['isometric', 'classic'],
  ['top', 'isometric'],
  ['top', 'classic'],
];
const jobs = elements.flatMap((e) => styles.map(([p, s]) => ({ code: e.code, style: `${p}/${s}`, url: spriteUrl(e.code, 0, p, s) })));

const missing = [];
let done = 0;
async function worker() {
  while (jobs.length) {
    const j = jobs.pop();
    let status = 0;
    for (let attempt = 0; attempt < 3 && (status === 0 || status >= 500); attempt++) {
      try {
        status = (await fetch(j.url, { method: 'HEAD' })).status;
      } catch {
        status = 0;
      }
    }
    if (status !== 200) missing.push({ code: j.code, style: j.style, status });
    if (++done % 2000 === 0) console.log(`${done} checked, ${missing.length} missing`);
  }
}
await Promise.all(Array.from({ length: 32 }, worker));

const byStyle = {};
for (const m of missing) byStyle[m.style] = (byStyle[m.style] ?? 0) + 1;
const missingEverywhere = Object.entries(
  missing.reduce((acc, m) => ((acc[m.code] = (acc[m.code] ?? 0) + 1), acc), {}),
).filter(([, n]) => n === styles.length).map(([c]) => c);
fs.writeFileSync('asset-report.json', JSON.stringify({ pieces: elements.length, checked: done, byStyle, missingEverywhere, missing }, null, 1));
console.log(JSON.stringify({ pieces: elements.length, checked: done, missing: missing.length, byStyle, missingEverywhere: missingEverywhere.length }));
