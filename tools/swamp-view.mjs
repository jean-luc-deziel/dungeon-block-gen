// ASCII preview of a generated swamp plus piece statistics.
// Usage: node tools/swamp-view.mjs [seed] [size] [theme]   (after build.mjs)
import { generate, DEFAULT_PARAMS } from '../js/generator.js';
import { readFileSync } from 'node:fs';

const [seed = '1', size = '48', theme = 'CS', water = '0.4', decor = '0.5'] = process.argv.slice(2);
const cat = JSON.parse(readFileSync(new URL('../catalogue/elements-v1.json', import.meta.url), 'utf8'));
const byCode = new Map((cat.elements ?? cat).map((e) => [e.code, e]));
const r = generate({ ...DEFAULT_PARAMS, theme, seed: Number(seed), width: Number(size), height: Number(size), roomMin: 3, roomMax: 5, roomCount: 6, water: Number(water), decor: Number(decor) });
const W = Number(size);
const grid = Array.from({ length: W }, () => Array(W).fill(' '));
const counts = {};
const level = { tiles: r.design.levels.flatMap((l) => l.tiles).filter((t) => t.element !== 'BB-001') };
const glyph = (name) => {
  if (/roof/i.test(name)) return 'R';
  if (/mushroom/i.test(name)) return 'm';
  if (/tree/i.test(name)) return 'T';
  if (/dock/i.test(name)) return 'd';
  if (/^water\b/i.test(name) || /water|lily/i.test(name)) return '~';
  if (/wall|door|angle|window|palisade/i.test(name)) return '#';
  if (/grass/i.test(name)) return ',';
  if (/ground|floor/i.test(name)) return '.';
  return '*';
};
for (const t of level.tiles) {
  const e = byCode.get(t.element);
  counts[e?.name ?? t.element] = (counts[e?.name ?? t.element] ?? 0) + 1;
  const [fw, fd] = e?.footprint ?? [1, 1];
  const g = glyph(e?.name ?? '');
  for (let u = 0; u < fw; u++) for (let v = 0; v < fd; v++) {
    const x = t.x + u;
    const y = t.y + v;
    if (x < W && y < W && (grid[y][x] === ' ' || '.,~'.includes(grid[y][x]))) grid[y][x] = g;
  }
}
console.log(grid.map((row) => row.join('')).join('\n'));
console.log(`rooms ${r.rooms}, cells ${r.floorCells}`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', '));
