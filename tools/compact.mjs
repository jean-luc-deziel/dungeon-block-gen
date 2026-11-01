// Dev helper: compact per-set listing "code name fp h" for writing themes.
// Usage: node tools/compact.mjs DE1,ET > out.txt
import fs from 'node:fs';

const els = JSON.parse(fs.readFileSync('catalogue/elements-v1.json', 'utf8'));
const only = new Set(process.argv[2].split(','));
const out = [];
let last = '';
for (const e of [...els].sort((a, b) => a.code.localeCompare(b.code))) {
  const p = e.code.split('-')[0];
  if (!only.has(p) || /^9\d\d$/.test(e.code.split('-')[1])) continue;
  if (p !== last) out.push(`== ${p}`);
  last = p;
  const fp = e.footprint.join('x');
  out.push(`${e.code.split('-')[1]} ${e.name}${fp !== '1x1' ? ' ' + fp : ''} h${e.height}${e.orientable ? '' : ' F'}`);
}
fs.writeFileSync(`tools/compact-${[...only].join('_')}.txt`, out.join('\n'));
console.log(out.length);
