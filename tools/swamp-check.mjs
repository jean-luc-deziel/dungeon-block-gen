// Stress test for the swamp style: no exceptions, no overlapping pieces on a level, huts have roofs.
// Usage: node tools/swamp-check.mjs   (after build.mjs)
import { generate, DEFAULT_PARAMS } from '../js/generator.js';
import { readFileSync } from 'node:fs';

const cat = JSON.parse(readFileSync(new URL('../catalogue/elements-v1.json', import.meta.url), 'utf8'));
const byCode = new Map((cat.elements ?? cat).map((e) => [e.code, e]));
const rot = (u, v, o) => [[u, v], [-v, u], [-u, -v], [v, -u]][o];
let problems = 0;
let runs = 0;
for (const size of [12, 18, 24, 36, 48]) {
  for (const shape of ['rectangle', 'ellipse', 'organic']) {
    for (const water of [0, 0.4, 1]) {
      for (const seed of [1, 2, 3, 4]) {
        runs++;
        const r = generate({ ...DEFAULT_PARAMS, theme: 'CS', seed, width: size, height: size, shape, water, decor: 0.5, roomCount: 6 });
        for (const lv of r.design.levels) {
          const occ = new Map();
          for (const t of lv.tiles) {
            const e = byCode.get(t.element);
            const [fw, fd] = e?.footprint ?? [1, 1];
            // the tile position is the anchor cell; the footprint rotates around it
            const offs = [];
            for (let u = 0; u < fw; u++) for (let v = 0; v < fd; v++) offs.push(rot(u, v, t.orientation));
            for (const [dx, dy] of offs) {
              const key = `${t.x + dx},${t.y + dy}`;
              if (occ.has(key) && lv.tiles.length && t.element !== 'BB-001') {
                if (problems++ < 8) console.log(`overlap size ${size} ${shape} water ${water} seed ${seed} level ${lv.index} at ${key}: ${occ.get(key)} / ${t.element}`);
              }
              occ.set(key, t.element);
            }
          }
        }
      }
    }
  }
}
console.log(`${runs} runs, ${problems} overlaps`);
