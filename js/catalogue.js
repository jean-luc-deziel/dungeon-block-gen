import { SETS } from './sets.js';
const SPRITE_BASE = 'https://storage.googleapis.com/dungeon-blocks-online.appspot.com/PNG/v1';
const LOCAL_BASE = './assets/PNG/v1';
let useLocal = false;
/** Enables local sprites if download-assets.mjs has been run (it writes assets/manifest.json). */
export async function detectLocalAssets() {
    try {
        useLocal = (await fetch('./assets/manifest.json', { method: 'HEAD' })).ok;
    }
    catch {
        useLocal = false;
    }
    return useLocal;
}
/** Local copy of a remote sprite URL, or null when local assets are not in use. */
export function localUrl(remote) {
    return useLocal && remote.startsWith(SPRITE_BASE) ? LOCAL_BASE + remote.slice(SPRITE_BASE.length) : null;
}
export class Catalogue {
    elements;
    byCode = new Map();
    constructor(elements) {
        const all = elements.filter((e) => e.code).sort((a, b) => a.code.localeCompare(b.code));
        // Unlisted packs stay resolvable for imported designs but are not offered in the palette.
        this.elements = all.filter((e) => packOf(e.code) === 'BB' || SETS.some((s) => s.id === packOf(e.code)));
        for (const e of all)
            this.byCode.set(e.code, e);
    }
    static async load() {
        const res = await fetch('./catalogue/elements-v1.json');
        if (!res.ok)
            throw new Error(`Failed to load catalogue (${res.status})`);
        return new Catalogue(await res.json());
    }
    get(code) {
        return this.byCode.get(code);
    }
    packs() {
        const counts = new Map();
        for (const e of this.elements) {
            const p = packOf(e.code);
            counts.set(p, (counts.get(p) ?? 0) + 1);
        }
        return [...counts].map(([code, count]) => ({ code, count })).sort((a, b) => a.code.localeCompare(b.code));
    }
}
export function packOf(code) {
    const i = code.indexOf('-');
    return i < 0 ? '???' : code.substring(0, i);
}
export function spriteUrl(code, orientation, projection, set) {
    const folder = (projection === 'top' ? 'top-' : '') + set;
    return `${SPRITE_BASE}/${folder}/${packOf(code)}/${code}_${orientation}.png`;
}
export function thumbnailUrl(code) {
    return `${SPRITE_BASE}/isometric/${packOf(code)}/${code}_thumbnail.png`;
}
// Orientation rotates the footprint clockwise (screen, y down) around the anchor cell.
export function rotate(u, v, o) {
    switch (((o % 4) + 4) % 4) {
        case 1: return [-v, u];
        case 2: return [-u, -v];
        case 3: return [v, -u];
        default: return [u, v];
    }
}
export function footprintCells(el, x, y, o) {
    const [w, d] = el?.footprint ?? [1, 1];
    const cells = [];
    for (let u = 0; u < w; u++) {
        for (let v = 0; v < d; v++) {
            const [dx, dy] = rotate(u, v, o);
            cells.push([x + dx, y + dy]);
        }
    }
    return cells;
}
export function footprintCenter(el, x, y, o) {
    const [w, d] = el?.footprint ?? [1, 1];
    const [dx, dy] = rotate((w - 1) / 2, (d - 1) / 2, o);
    return [x + dx, y + dy];
}
//# sourceMappingURL=catalogue.js.map