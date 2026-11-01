import { Catalogue, footprintCells, footprintCenter, localUrl, spriteUrl } from './catalogue.js';
import type { GenResult } from './generator.js';
import type { DbbDesign, DbbTile, Projection, SpriteSet } from './types.js';

interface Units {
  ux: number;
  uy: number;
  uz: number;
}

// Pixel units per cell/height step for the 1000x1000 sprites (from dungeonblocksbuilder.com).
const UNITS: Record<SpriteSet, Record<Projection, Units>> = {
  isometric: { isometric: { ux: 219, uy: 122, uz: 31 }, top: { ux: 156, uy: 94, uz: 30 } },
  classic: { isometric: { ux: 219, uy: 186, uz: 20 }, top: { ux: 156, uy: 134, uz: 18 } },
};

interface Sprite {
  canvas: HTMLCanvasElement | null; // cropped
  ox: number; // crop offset within the 1000x1000 sprite
  oy: number;
  failed: boolean;
}

export interface Ghost {
  tile: DbbTile;
  level: number;
  valid: boolean;
}

export class MapRenderer {
  design: DbbDesign = { levels: [] };
  projection: Projection = 'isometric';
  spriteSet: SpriteSet = 'isometric';
  rotation = 0;
  zoom = 0.25;
  offsetX = 0;
  offsetY = 0;
  showGrid = true;
  area: GenResult['area'] | null = null;
  activeLevel = 1;
  maxVisibleLevel = Infinity;
  dimOtherLevels = false;
  ghost: Ghost | null = null;
  hoverCell: { x: number; y: number } | null = null;
  selected: { level: number; tile: DbbTile } | null = null;

  private ctx: CanvasRenderingContext2D;
  private sprites = new Map<string, Sprite>();
  private frame = 0;
  /** True until the user pans or zooms; keeps the map fitted on resize. */
  private autoFit = false;

  constructor(readonly canvas: HTMLCanvasElement, readonly catalogue: Catalogue) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    this.offsetX += (w - this.canvas.width) / 2;
    this.offsetY += (h - this.canvas.height) / 2;
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.autoFit) this.fit();
    this.requestRender();
  }

  get units(): Units {
    return UNITS[this.spriteSet][this.projection];
  }

  requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private rot(x: number, y: number): [number, number] {
    switch (this.rotation & 3) {
      case 1: return [-y, x];
      case 2: return [-x, -y];
      case 3: return [y, -x];
      default: return [x, y];
    }
  }

  private unrot(x: number, y: number): [number, number] {
    switch (this.rotation & 3) {
      case 1: return [y, -x];
      case 2: return [-x, -y];
      case 3: return [-y, x];
      default: return [x, y];
    }
  }

  // World (cell-centered) -> sprite pixel space (before zoom/offset)
  private project(wx: number, wy: number, z: number): [number, number] {
    const [rx, ry] = this.rot(wx, wy);
    const { ux, uy, uz } = this.units;
    if (this.projection === 'isometric') return [((rx - ry) * ux) / 2, ((rx + ry) * uy) / 2 - z * uz];
    return [rx * ux, ry * uy - z * uz];
  }

  toScreen(wx: number, wy: number, z: number): [number, number] {
    const [px, py] = this.project(wx, wy, z);
    return [px * this.zoom + this.offsetX, py * this.zoom + this.offsetY];
  }

  // Screen (canvas device px) -> fractional world coords on plane z
  toWorld(sx: number, sy: number, z: number): [number, number] {
    const { ux, uy, uz } = this.units;
    const px = (sx - this.offsetX) / this.zoom;
    const py = (sy - this.offsetY) / this.zoom + z * uz;
    let rx: number;
    let ry: number;
    if (this.projection === 'isometric') {
      const a = px / (ux / 2);
      const b = py / (uy / 2);
      rx = (a + b) / 2;
      ry = (b - a) / 2;
    } else {
      rx = px / ux;
      ry = py / uy;
    }
    return this.unrot(rx, ry);
  }

  cellAt(clientX: number, clientY: number, level: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / r.width;
    const [wx, wy] = this.toWorld((clientX - r.left) * dpr, (clientY - r.top) * dpr, level);
    return { x: Math.round(wx), y: Math.round(wy) };
  }

  panBy(dxClient: number, dyClient: number): void {
    const dpr = this.canvas.width / this.canvas.getBoundingClientRect().width;
    this.offsetX += dxClient * dpr;
    this.offsetY += dyClient * dpr;
    this.autoFit = false;
    this.requestRender();
  }

  zoomAt(clientX: number, clientY: number, factor: number): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / r.width;
    const sx = (clientX - r.left) * dpr;
    const sy = (clientY - r.top) * dpr;
    const nz = Math.min(2, Math.max(0.03, this.zoom * factor));
    const f = nz / this.zoom;
    this.offsetX = sx - (sx - this.offsetX) * f;
    this.offsetY = sy - (sy - this.offsetY) * f;
    this.zoom = nz;
    this.autoFit = false;
    this.requestRender();
  }

  setRotation(rotation: number): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const [wx, wy] = this.toWorld(cx, cy, this.activeLevel);
    this.rotation = ((rotation % 4) + 4) % 4;
    const [sx, sy] = this.toScreen(wx, wy, this.activeLevel);
    this.offsetX += cx - sx;
    this.offsetY += cy - sy;
    this.requestRender();
  }

  setProjection(projection: Projection, spriteSet: SpriteSet): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const [wx, wy] = this.toWorld(cx, cy, this.activeLevel);
    this.projection = projection;
    this.spriteSet = spriteSet;
    const [sx, sy] = this.toScreen(wx, wy, this.activeLevel);
    this.offsetX += cx - sx;
    this.offsetY += cy - sy;
    this.requestRender();
  }

  fit(): void {
    this.autoFit = true;
    const pts: [number, number][] = [];
    if (this.area) {
      const { w, h, scale } = this.area;
      for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) pts.push(this.project(x * scale - 0.5, y * scale - 0.5, 0));
    }
    for (const l of this.design.levels) {
      for (const t of l.tiles) {
        const el = this.catalogue.get(t.element);
        for (const [x, y] of footprintCells(el, t.x, t.y, t.orientation)) {
          pts.push(this.project(x - 0.5, y - 0.5, l.index), this.project(x + 0.5, y + 0.5, l.index + (el?.height ?? 1)));
          pts.push(this.project(x + 0.5, y - 0.5, l.index), this.project(x - 0.5, y + 0.5, l.index + (el?.height ?? 1)));
        }
      }
    }
    if (!pts.length) {
      this.zoom = 0.25;
      const [px, py] = this.project(5, 5, 0);
      this.offsetX = this.canvas.width / 2 - px * this.zoom;
      this.offsetY = this.canvas.height / 2 - py * this.zoom;
      this.requestRender();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const margin = 40;
    const zx = (this.canvas.width - margin * 2) / Math.max(1, maxX - minX);
    const zy = (this.canvas.height - margin * 2) / Math.max(1, maxY - minY);
    this.zoom = Math.min(1.2, Math.max(0.03, Math.min(zx, zy)));
    this.offsetX = this.canvas.width / 2 - ((minX + maxX) / 2) * this.zoom;
    this.offsetY = this.canvas.height / 2 - ((minY + maxY) / 2) * this.zoom;
    this.requestRender();
  }

  private sprite(code: string, orientation: number, set: SpriteSet = this.spriteSet): Sprite {
    const url = spriteUrl(code, orientation, this.projection, set);
    let s = this.sprites.get(url);
    if (s) return s;
    s = { canvas: null, ox: 0, oy: 0, failed: false };
    this.sprites.set(url, s);
    const sp = s;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cropSprite(img, sp);
      this.requestRender();
    };
    img.onerror = () => {
      if (img.src !== url && !sp.failed) {
        img.src = url;
        return;
      }
      sp.failed = true;
      this.requestRender();
    };
    img.src = localUrl(url) ?? url;
    return s;
  }

  // Painter's order key: the front edge of the footprint, so that a tall piece hides what is behind it whatever the level.
  private sortKey(t: DbbTile): [number, number] {
    const el = this.catalogue.get(t.element);
    const [cx, cy] = footprintCenter(el, t.x, t.y, t.orientation);
    const [rx, ry] = this.rot(cx, cy);
    let front = -Infinity;
    for (const [x, y] of footprintCells(el, t.x, t.y, t.orientation)) {
      const [qx, qy] = this.rot(x, y);
      front = Math.max(front, this.projection === 'isometric' ? qx + qy : qy);
    }
    return [front, rx];
  }

  render(): void {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const items: { level: number; tile: DbbTile; k: [number, number]; ghost?: boolean; valid?: boolean }[] = [];
    for (const l of this.design.levels) {
      if (l.index > this.maxVisibleLevel) continue;
      for (const t of l.tiles) items.push({ level: l.index, tile: t, k: this.sortKey(t) });
    }
    if (this.ghost) items.push({ level: this.ghost.level, tile: this.ghost.tile, k: this.sortKey(this.ghost.tile), ghost: true, valid: this.ghost.valid });
    const isBase = (t: DbbTile) => t.element.startsWith('BB-');
    items.sort((a, b) => Number(isBase(b.tile)) - Number(isBase(a.tile)) || (isBase(a.tile) ? a.level - b.level : 0) || a.k[0] - b.k[0] || a.level - b.level || a.k[1] - b.k[1]);

    let underlay = false;
    for (const it of items) {
      if (!underlay && it.level >= this.activeLevel) {
        this.drawUnderlay();
        underlay = true;
      }
      ctx.globalAlpha = it.ghost ? 0.6 : this.dimOtherLevels && it.level !== this.activeLevel ? 0.35 : 1;
      this.drawTile(it.tile, it.level);
      if (it.ghost && !it.valid) this.outlineTile(it.tile, it.level, 'rgba(255,60,60,0.9)');
    }
    ctx.globalAlpha = 1;
    if (!underlay) this.drawUnderlay();
    if (this.selected) this.outlineTile(this.selected.tile, this.selected.level, '#ffd54a');
    if (this.hoverCell && !this.ghost) this.outlineCells([[this.hoverCell.x, this.hoverCell.y]], this.activeLevel, 'rgba(120,200,255,0.9)');
  }

  private drawTile(t: DbbTile, level: number): void {
    const el = this.catalogue.get(t.element);
    const o = (((t.orientation + this.rotation) % 4) + 4) % 4;
    let s = this.sprite(t.element, o);
    if (s.failed && o !== 0) s = this.sprite(t.element, 0);
    // Some pieces lack one style (e.g. MR-002 classic): borrow the other, stretched to this grid's height.
    let k = 1;
    if (s.failed) {
      const other: SpriteSet = this.spriteSet === 'classic' ? 'isometric' : 'classic';
      s = this.sprite(t.element, o, other);
      if (s.failed && o !== 0) s = this.sprite(t.element, 0, other);
      k = this.units.uy / UNITS[other][this.projection].uy;
    }
    const [cx, cy] = footprintCenter(el, t.x, t.y, t.orientation);
    const [sx, sy] = this.toScreen(cx, cy, level + 1);
    if (!s.canvas) {
      if (s.failed || !el) this.outlineTile(t, level, 'rgba(255,80,80,0.8)');
      return;
    }
    const z = this.zoom;
    const offX = this.projection === 'isometric' ? (el?.renderOffsetX ?? 0) * z : 0;
    const offY = this.projection === 'isometric' ? (el?.renderOffsetY ?? 0) * z : 0;
    this.ctx.drawImage(s.canvas, sx - 500 * z + s.ox * z - offX, sy + (s.oy - 500) * z * k - offY, s.canvas.width * z, s.canvas.height * z * k);
  }

  private cellPolygon(x: number, y: number, z: number): [number, number][] {
    return [
      this.toScreen(x - 0.5, y - 0.5, z),
      this.toScreen(x + 0.5, y - 0.5, z),
      this.toScreen(x + 0.5, y + 0.5, z),
      this.toScreen(x - 0.5, y + 0.5, z),
    ];
  }

  private outlineTile(t: DbbTile, level: number, color: string): void {
    this.outlineCells(footprintCells(this.catalogue.get(t.element), t.x, t.y, t.orientation), level, color);
  }

  private outlineCells(cells: [number, number][], level: number, color: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.18)');
    ctx.lineWidth = 2;
    for (const [x, y] of cells) {
      const poly = this.cellPolygon(x, y, level);
      ctx.beginPath();
      poly.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawUnderlay(): void {
    if (this.showGrid) this.drawGrid();
    if (this.area) this.drawArea(this.area);
  }

  // Dashed outline of the generator's allowed space (size and overall shape).
  private drawArea({ w, h, scale, mask }: GenResult['area']): void {
    const { ctx } = this;
    const z = this.activeLevel;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    const line = (ax: number, ay: number, bx: number, by: number) => {
      const [px, py] = this.toScreen(ax * scale - 0.5, ay * scale - 0.5, z);
      const [qx, qy] = this.toScreen(bx * scale - 0.5, by * scale - 0.5, z);
      ctx.moveTo(px, py);
      ctx.lineTo(qx, qy);
    };
    ctx.save();
    ctx.strokeStyle = 'rgba(255,200,90,0.5)';
    ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1);
    ctx.setLineDash([6 * (window.devicePixelRatio || 1), 5 * (window.devicePixelRatio || 1)]);
    ctx.beginPath();
    for (let y = 0; y <= h; y++) {
      for (let x = 0; x < w; ) {
        if (on(x, y - 1) === on(x, y)) {
          x++;
          continue;
        }
        const x0 = x;
        const up = on(x, y - 1);
        while (x < w && on(x, y - 1) !== on(x, y) && on(x, y - 1) === up) x++;
        line(x0, y, x, y);
      }
    }
    for (let x = 0; x <= w; x++) {
      for (let y = 0; y < h; ) {
        if (on(x - 1, y) === on(x, y)) {
          y++;
          continue;
        }
        const y0 = y;
        const left = on(x - 1, y);
        while (y < h && on(x - 1, y) !== on(x, y) && on(x - 1, y) === left) y++;
        line(x, y0, x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawGrid(): void {
    const { ctx, canvas } = this;
    const z = this.activeLevel;
    const corners = [
      this.toWorld(0, 0, z),
      this.toWorld(canvas.width, 0, z),
      this.toWorld(0, canvas.height, z),
      this.toWorld(canvas.width, canvas.height, z),
    ];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const x0 = Math.floor(Math.min(...xs)) - 1;
    const x1 = Math.ceil(Math.max(...xs)) + 1;
    const y0 = Math.floor(Math.min(...ys)) - 1;
    const y1 = Math.ceil(Math.max(...ys)) + 1;
    if ((x1 - x0) * (y1 - y0) > 40000) return;
    ctx.save();
    ctx.lineWidth = 1;
    for (let x = x0; x <= x1; x++) {
      const [ax, ay] = this.toScreen(x - 0.5, y0 - 0.5, z);
      const [bx, by] = this.toScreen(x - 0.5, y1 + 0.5, z);
      ctx.strokeStyle = ((x % 3) + 3) % 3 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    for (let y = y0; y <= y1; y++) {
      const [ax, ay] = this.toScreen(x0 - 0.5, y - 0.5, z);
      const [bx, by] = this.toScreen(x1 + 0.5, y - 0.5, z);
      ctx.strokeStyle = ((y % 3) + 3) % 3 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function cropSprite(img: HTMLImageElement, s: Sprite): void {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  try {
    const data = cx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } catch {
    s.canvas = c;
    return;
  }
  if (maxX < 0) {
    s.failed = true;
    return;
  }
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  s.canvas = out;
  s.ox = minX;
  s.oy = minY;
}
