import { Rng } from '../js/rng.js';
const W = 48, H = 48;
const rng = new Rng(5);
function valueNoise(cell, angle = 0) {
  const K = Math.ceil(Math.hypot(W, H) / cell) + 1;
  const gw = 2 * K + 2;
  const lat = Float32Array.from({ length: gw * gw }, () => rng.next());
  const out = new Float32Array(W * H);
  const sm = (t) => t * t * (3 - 2 * t);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = (cos * (x - W / 2) - sin * (y - H / 2)) / cell + K;
    const fy = (sin * (x - W / 2) + cos * (y - H / 2)) / cell + K;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = sm(fx - x0), ty = sm(fy - y0);
    const a = lat[y0 * gw + x0], b = lat[y0 * gw + x0 + 1], c = lat[(y0 + 1) * gw + x0], d = lat[(y0 + 1) * gw + x0 + 1];
    out[y * W + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }
  return out;
}
const sc = 14;
const a = valueNoise(sc, 0.4), b = valueNoise(7, 1.1), c = valueNoise(3, 2.3);
const f = a.map((v, i) => v * 0.55 + b[i] * 0.3 + c[i] * 0.15);
const s = [...f].sort((x, y) => y - x);
const thr = s[Math.floor(s.length * 0.5)];
for (let y = 0; y < H; y++) console.log(Array.from({ length: W }, (_, x) => (f[y * W + x] >= thr ? '#' : '.')).join(''));
