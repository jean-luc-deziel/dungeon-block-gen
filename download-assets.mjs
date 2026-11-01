// Downloads sprites + thumbnails for offline use into assets/PNG/v1/...
// Usage: node download-assets.mjs ALL        (every set)
//        node download-assets.mjs UD BB      (only these sets)
// Re-running skips files already downloaded.
import fs from 'node:fs';
import path from 'node:path';
import { spriteUrl, thumbnailUrl } from './js/catalogue.js';

const args = process.argv.slice(2).map((p) => p.toUpperCase());
if (!args.length) {
  console.error('Usage: node download-assets.mjs ALL | <SET> [SET...]   e.g. UD BB');
  process.exit(1);
}
const all = JSON.parse(fs.readFileSync('catalogue/elements-v1.json', 'utf8'));
const elements = (Array.isArray(all) ? all : all.elements).filter(
  (e) => e.code && !e.code.startsWith('X99') && !e.code.startsWith('ZZ') &&
    (args.includes('ALL') || args.includes(e.code.split('-')[0].toUpperCase())),
);
const styles = [['isometric', 'isometric'], ['isometric', 'classic'], ['top', 'isometric'], ['top', 'classic']];
const jobs = elements.flatMap((e) => [
  thumbnailUrl(e.code),
  ...styles.flatMap(([p, s]) => [0, 1, 2, 3].map((o) => spriteUrl(e.code, o, p, s))),
]);
const base = 'https://storage.googleapis.com/dungeon-blocks-online.appspot.com/';
const total = jobs.length;
jobs.reverse();

let saved = 0, skipped = 0, missing = 0, errors = 0, bytes = 0;
const t0 = Date.now();
const unavailable = [];
async function worker() {
  while (jobs.length) {
    const url = jobs.pop();
    const file = path.join('assets', url.slice(base.length));
    if (fs.existsSync(file)) { skipped++; continue; }
    let res = null;
    for (let attempt = 0; attempt < 3 && !res?.ok; attempt++) {
      res = await fetch(url).catch(() => null);
      if (res && res.status < 500 && res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
    if (!res?.ok) {
      if (res && (res.status === 403 || res.status === 404)) missing++; else errors++;
      unavailable.push({ url, status: res?.status ?? 0 });
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.part', buf);
    fs.renameSync(file + '.part', file);
    saved++;
    bytes += buf.length;
    if (saved % 500 === 0) {
      const done = saved + skipped + missing + errors;
      const mbps = bytes / 1e6 / ((Date.now() - t0) / 1000);
      console.log(`${done}/${total} files (${(bytes / 1e9).toFixed(2)} GB new, ${mbps.toFixed(1)} MB/s)`);
    }
  }
}
console.log(`${elements.length} pieces, ${total} files`);
// Written up front so the app starts using local files (with site fallback) during a download.
fs.mkdirSync('assets', { recursive: true });
if (!fs.existsSync('assets/manifest.json')) fs.writeFileSync('assets/manifest.json', JSON.stringify({ sets: args, inProgress: true }));
await Promise.all(Array.from({ length: 16 }, worker));
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/manifest.json', JSON.stringify({ updated: new Date().toISOString(), sets: args, unavailable }, null, 1));
console.log(`Done: ${saved} saved, ${skipped} already present, ${missing} not on server, ${errors} errors (${(bytes / 1e9).toFixed(2)} GB)`);
