// Dev helper: summarizes each set in the catalogue (tags, names) into pack-summary.txt.
import fs from 'node:fs';

const a = JSON.parse(fs.readFileSync('catalogue/elements-v1.json', 'utf8'));
const els = (Array.isArray(a) ? a : a.elements).filter((e) => e.code && !e.code.startsWith('X99') && !e.code.startsWith('ZZ'));
const packs = new Map();
for (const e of els) {
  const p = e.code.split('-')[0];
  if (!packs.has(p)) packs.set(p, []);
  packs.get(p).push(e);
}
const out = [];
const only = process.argv[2]?.split(',');
for (const [p, list] of [...packs].sort()) {
  if (only && !only.includes(p)) continue;
  list.sort((x, y) => x.code.localeCompare(y.code));
  const tags = {};
  for (const e of list) for (const t of e.tags ?? []) tags[t] = (tags[t] ?? 0) + 1;
  out.push(`== ${p} (${list.length}) tags: ${Object.entries(tags).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t}:${n}`).join(' ')}`);
  if (only) {
    for (const e of list) {
      out.push(`${e.code.split('-')[1]} ${e.name} [${e.footprint.join('x')}h${e.height}${e.orientable ? '' : ' fixed'}${e.type !== 'Tile' ? ' ' + e.type : ''}] ${(e.tags ?? []).join(',')} t:${e.top ?? ''} b:${e.bottom ?? ''}`);
    }
  } else {
    out.push('  ' + list.slice(0, 400).map((e) => e.name).filter((n, i, arr) => arr.indexOf(n) === i).join(' | '));
  }
}
fs.writeFileSync(only ? `pack-${only.join('_')}.txt` : 'pack-summary.txt', out.join('\n'));
console.log(out.length, 'lines');
