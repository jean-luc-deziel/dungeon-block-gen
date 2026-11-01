// Lists every element of a set: code, name, footprint, height, slots.
// Usage: node tools/list-set.mjs MH [regex]
import { readFileSync } from 'node:fs';

const [pack, re] = process.argv.slice(2);
const cat = JSON.parse(readFileSync(new URL('../catalogue/elements-v1.json', import.meta.url), 'utf8'));
const rx = re ? new RegExp(re, 'i') : null;
for (const e of (cat.elements ?? cat).filter((x) => x.code.startsWith(`${pack}-`) && (!rx || rx.test(x.name))).sort((a, b) => a.code.localeCompare(b.code))) {
  console.log(e.code, e.name, JSON.stringify(e.footprint), `h${e.height}`, `top:${e.top}`, `bottom:${e.bottom}`, e.orientable ? '' : 'fixed', e.layout !== 'Default' ? e.layout : '');
}
