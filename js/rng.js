export class Rng {
    s;
    constructor(seed) {
        this.s = seed >>> 0 || 0x9e3779b9;
    }
    next() {
        let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    chance(p) {
        return this.next() < p;
    }
    pick(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }
    weighted(items) {
        const total = items.reduce((s, i) => s + i.w, 0);
        let r = this.next() * total;
        for (const i of items) {
            r -= i.w;
            if (r < 0)
                return i.v;
        }
        return items[items.length - 1].v;
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}
//# sourceMappingURL=rng.js.map