// Room count accuracy (count layout) and floor coverage (fill layout) over many seeds.
// Usage: node tools/room-stats.mjs   (after build.mjs)
import { generate, DEFAULT_PARAMS } from '../js/generator.js';

const base = { ...DEFAULT_PARAMS, theme: 'UD', style: 'dungeon' };
for (const [size, roomCount, roomMin, roomMax] of [[18, 6, 3, 7], [24, 8, 3, 7], [24, 12, 3, 7], [24, 16, 3, 7], [36, 12, 4, 6], [36, 20, 3, 7], [48, 25, 3, 7], [24, 6, 6, 9], [48, 30, 3, 11]]) {
  const N = 30;
  let rooms = 0;
  let exact = 0;
  const t0 = Date.now();
  for (let seed = 1; seed <= N; seed++) {
    const r = generate({ ...base, seed, width: size, height: size, roomCount, roomMin, roomMax });
    rooms += r.rooms;
    if (r.rooms === roomCount) exact++;
  }
  console.log(`count ${size}x${size} want ${roomCount} (${roomMin}-${roomMax}): avg ${(rooms / N).toFixed(1)}, exact ${exact}/${N}, ${((Date.now() - t0) / N).toFixed(0)} ms`);
}
for (const size of [18, 24, 36, 48]) {
  const N = 20;
  let rooms = 0;
  let floor = 0;
  const t0 = Date.now();
  for (let seed = 1; seed <= N; seed++) {
    const r = generate({ ...base, layout: 'fill', seed, width: size, height: size, roomMin: 3, roomMax: 7 });
    rooms += r.rooms;
    floor += r.floorCells / (size * size);
  }
  console.log(`fill  ${size}x${size}: avg ${(rooms / N).toFixed(1)} rooms, floor ${((100 * floor) / N).toFixed(0)}%, ${((Date.now() - t0) / N).toFixed(0)} ms`);
}
