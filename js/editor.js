import { footprintCells } from './catalogue.js';
export function emptyDesign(title = 'New Map') {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        title,
        description: '',
        creationDate: now,
        modificationDate: now,
        levels: [
            { index: 0, tiles: [] },
            { index: 1, tiles: [] },
        ],
    };
}
export function parseDesign(text) {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.levels))
        throw new Error('Not a Dungeon Blocks Builder map: missing "levels" array.');
    const str = (v) => (typeof v === 'string' ? v : undefined);
    const levels = [];
    for (const l of raw.levels) {
        const index = Number(l?.index);
        if (!Number.isFinite(index) || !Array.isArray(l?.tiles))
            throw new Error('Invalid level entry.');
        const tiles = [];
        for (const t of l.tiles) {
            const x = Number(t?.x);
            const y = Number(t?.y);
            const orientation = Number(t?.orientation ?? 0);
            if (!Number.isFinite(x) || !Number.isFinite(y) || typeof t?.element !== 'string')
                throw new Error('Invalid tile entry.');
            tiles.push({ x: Math.round(x), y: Math.round(y), element: t.element, orientation: ((Math.round(orientation) % 4) + 4) % 4 });
        }
        levels.push({ index: Math.round(index), tiles });
    }
    levels.sort((a, b) => a.index - b.index);
    return {
        id: str(raw.id) ?? crypto.randomUUID(),
        title: str(raw.title) ?? 'Imported Map',
        description: str(raw.description) ?? '',
        creationDate: str(raw.creationDate) ?? new Date().toISOString(),
        modificationDate: str(raw.modificationDate) ?? new Date().toISOString(),
        ...(str(raw.ownerId) ? { ownerId: str(raw.ownerId) } : {}),
        levels,
    };
}
export function serializeDesign(d) {
    const out = {
        ...d,
        modificationDate: new Date().toISOString(),
        levels: d.levels.filter((l) => l.tiles.length > 0).map((l) => ({ index: l.index, tiles: l.tiles.map((t) => ({ x: t.x, y: t.y, element: t.element, orientation: t.orientation })) })),
    };
    return JSON.stringify(out, null, 2);
}
export class DesignStore {
    catalogue;
    design;
    undoStack = [];
    redoStack = [];
    listeners = [];
    constructor(catalogue, initial) {
        this.catalogue = catalogue;
        this.design = initial;
    }
    onChange(fn) {
        this.listeners.push(fn);
    }
    emit() {
        for (const fn of this.listeners)
            fn();
    }
    checkpoint() {
        this.undoStack.push(JSON.stringify(this.design));
        if (this.undoStack.length > 200)
            this.undoStack.shift();
        this.redoStack = [];
    }
    replace(d, undoable = true) {
        if (undoable)
            this.checkpoint();
        this.design = d;
        this.emit();
    }
    changed() {
        this.emit();
    }
    undo() {
        const s = this.undoStack.pop();
        if (!s)
            return;
        this.redoStack.push(JSON.stringify(this.design));
        this.design = JSON.parse(s);
        this.emit();
    }
    redo() {
        const s = this.redoStack.pop();
        if (!s)
            return;
        this.undoStack.push(JSON.stringify(this.design));
        this.design = JSON.parse(s);
        this.emit();
    }
    level(index, create = false) {
        let l = this.design.levels.find((x) => x.index === index);
        if (!l && create) {
            l = { index, tiles: [] };
            this.design.levels.push(l);
            this.design.levels.sort((a, b) => a.index - b.index);
        }
        return l;
    }
    cellsOf(t) {
        return footprintCells(this.catalogue.get(t.element), t.x, t.y, t.orientation);
    }
    tileAt(level, x, y) {
        const l = this.level(level);
        if (!l)
            return undefined;
        for (let i = l.tiles.length - 1; i >= 0; i--) {
            if (this.cellsOf(l.tiles[i]).some(([cx, cy]) => cx === x && cy === y))
                return l.tiles[i];
        }
        return undefined;
    }
    // Highest tile covering the cell across all visible levels.
    topTileAt(x, y, maxLevel = Infinity) {
        const levels = [...this.design.levels].filter((l) => l.index <= maxLevel).sort((a, b) => b.index - a.index);
        for (const l of levels) {
            const t = this.tileAt(l.index, x, y);
            if (t)
                return { level: l.index, tile: t };
        }
        return undefined;
    }
    // Level on which a new tile would sit when stacked on top of what's below.
    stackLevel(cells, maxLevel = Infinity) {
        let top = 0;
        for (const l of this.design.levels) {
            if (l.index > maxLevel)
                continue;
            for (const t of l.tiles) {
                const el = this.catalogue.get(t.element);
                const tc = this.cellsOf(t);
                if (tc.some(([x, y]) => cells.some(([cx, cy]) => cx === x && cy === y)))
                    top = Math.max(top, l.index + (el?.height ?? 1));
            }
        }
        return top;
    }
    place(level, tile) {
        const l = this.level(level, true);
        const cells = this.cellsOf(tile);
        l.tiles = l.tiles.filter((t) => !this.cellsOf(t).some(([x, y]) => cells.some(([cx, cy]) => cx === x && cy === y)));
        l.tiles.push(tile);
        this.emit();
    }
    remove(level, tile) {
        const l = this.level(level);
        if (!l)
            return;
        l.tiles = l.tiles.filter((t) => t !== tile);
        this.emit();
    }
    // Adds BB-001 3x3 base grids on level 0 under every tile of the given level.
    fillBaseGrid(aboveLevel = 1) {
        const base = this.level(0, true);
        const above = this.level(aboveLevel);
        if (!above)
            return 0;
        const covered = new Set(base.tiles.flatMap((t) => this.cellsOf(t).map(([x, y]) => `${x},${y}`)));
        const blocks = new Set();
        for (const t of above.tiles) {
            for (const [x, y] of this.cellsOf(t)) {
                if (covered.has(`${x},${y}`))
                    continue;
                blocks.add(`${Math.floor(x / 3) * 3},${Math.floor(y / 3) * 3}`);
            }
        }
        for (const b of blocks) {
            const [x, y] = b.split(',').map(Number);
            base.tiles.push({ x, y, element: 'BB-001', orientation: 0 });
        }
        if (blocks.size)
            this.emit();
        return blocks.size;
    }
}
//# sourceMappingURL=editor.js.map