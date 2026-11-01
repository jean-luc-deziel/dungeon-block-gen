// Lists the pieces of an exported design per level, with names, footprints, heights and slots.
// Usage: node tools/describe-design.mjs design.json
import { readFileSync } from 'node:fs';

const cat = JSON.parse(readFileSync(new URL('../catalogue/elements-v1.json', import.meta.url), 'utf8'));
const by = new Map((cat.elements ?? cat).map((e) => [e.code, e]));
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const l of d.levels) {
  console.log('LEVEL', l.index);
  for (const t of l.tiles) {
    if (t.element === 'BB-001') continue;
    const e = by.get(t.element);
    console.log(' ', t.x, t.y, `o${t.orientation}`, t.element, e ? `${e.name} ${JSON.stringify(e.footprint)} h${e.height} top:${e.top} bottom:${e.bottom}` : '?');
  }
}
