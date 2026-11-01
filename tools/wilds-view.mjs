// ASCII preview of the terrain steps of a generated wilds map (3x3 pieces), plus piece statistics.
// Usage: node tools/wilds-view.mjs [seed] [size] [theme] [elevation]   (after build.mjs)
import { generate, DEFAULT_PARAMS } from '../js/generator.js';
import { readFileSync } from 'node:fs';

const [seed = '1', size = '48', theme = 'MH', elevation = '0.5'] = process.argv.slice(2);
const cat = JSON.parse(readFileSync(new URL('../catalogue/elements-v1.json', import.meta.url), 'utf8'));
const byCode = new Map((cat.elements ?? cat).map((e) => [e.code, e]));
const r = generate({ ...DEFAULT_PARAMS, theme, style: 'wilds', seed: Number(seed), width: Number(size), height: Number(size), elevation: Number(elevation), baseGrid: false });
const M = Number(size) / 3;
const grid = Array.from({ length: M }, () => Array(M).fill(' '));
const counts = {};
for (const l of r.design.levels) {
  const step = l.index / 3;
  for (const t of l.tiles) {
    const e = byCode.get(t.element);
    const name = e?.name ?? t.element;
    counts[name] = (counts[name] ?? 0) + 1;
    const gx = Math.floor(t.x / 3);
    const gy = Math.floor(t.y / 3);
    if (gx < 0 || gy < 0 || gx >= M || gy >= M) continue;
    let ch = String(step);
    if (/stairs/i.test(name)) ch = 'S';
    else if (/level/i.test(name)) continue;
    else if (/wall|angle|corridor|end\b/i.test(name) && /low|medium|high|tall/i.test(name)) ch = ['.', 'l', 'm', 'h'][Math.round(step)] === '.' ? 'c' : 'C';
    if (grid[gy][gx] === ' ' || ch === 'S' || ch === 'c' || ch === 'C') grid[gy][gx] = ch;
  }
}
console.log(grid.map((row) => row.join(' ')).join('\n'));
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k}:${v}`).join(', '));
console.log('levels', r.design.levels.map((l) => `${l.index}:${l.tiles.length}`).join(' '));
