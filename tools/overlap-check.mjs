// Stress test: no exceptions and no overlapping pieces on a level, for a set and style.
// Usage: node tools/overlap-check.mjs [SET] [style]   (after build.mjs)
import { generate, DEFAULT_PARAMS } from '../js/generator.js';
import { readFileSync } from 'node:fs';

const [theme = 'CS', style = 'auto'] = process.argv.slice(2);
const cat = JSON.parse(readFileSync(new URL('../catalogue/elements-v1.json', import.meta.url), 'utf8'));
const byCode = new Map((cat.elements ?? cat).map((e) => [e.code, e]));
const rot = (u, v, o) => [[u, v], [-v, u], [-u, -v], [v, -u]][o];
let problems = 0;
let runs = 0;
for (const size of [12, 18, 24, 36, 48, 72]) {
  for (const shape of ['rectangle', 'ellipse', 'organic', 'cross']) {
    for (const elevation of [0, 0.5, 1]) {
      for (const seed of [1, 2, 3, 4]) {
        runs++;
        let r;
        try {
          r = generate({ ...DEFAULT_PARAMS, theme, style, seed, width: size, height: size, shape, elevation, water: 0.5, decor: 0.6 });
        } catch (e) {
          if (problems++ < 8) console.log(`error size ${size} ${shape} elev ${elevation} seed ${seed}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
          continue;
        }
        for (const lv of r.design.levels) {
          const occ = new Map();
          for (const t of lv.tiles) {
            const e = byCode.get(t.element);
            const [fw, fd] = e?.footprint ?? [1, 1];
            for (let u = 0; u < fw; u++) {
              for (let v = 0; v < fd; v++) {
                const [dx, dy] = rot(u, v, t.orientation);
                const key = `${t.x + dx},${t.y + dy}`;
                if (occ.has(key) && t.element !== 'BB-001' && problems++ < 8) console.log(`overlap size ${size} ${shape} elev ${elevation} seed ${seed} level ${lv.index} at ${key}: ${occ.get(key)} / ${t.element}`);
                occ.set(key, t.element);
              }
            }
          }
        }
      }
    }
  }
}
console.log(`${theme}/${style}: ${runs} runs, ${problems} problems`);
