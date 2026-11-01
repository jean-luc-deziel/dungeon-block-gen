"""Detects, for each structural piece, which sides/corners it occupies at each orientation.

Usage: python tools/analyze-masks.py JOBS_JSON OUT_JSON
  JOBS_JSON: [{"code": "LC-001", "hint": "wall", "ref": null | "LC-007"}, ...]
    hint: wall | angle | corridor | end | corner | corners2 | corners3 |
          l-end | l-angle | l-straight | l-t | l-x | full
    ref:  when given, the piece is compared with this reference piece (same orientation) and only
          the differing pixels are measured (flat pieces: shores, paths, rivers). Otherwise the
          opaque pixels are measured (tall pieces: walls, cliffs).
Masks: bits 0-3 = sides W N E S, bits 4-7 = corners NW NE SE SW.
Output: {code: {"masks": [m0, m1, m2, m3], "score": s, "margin": m}}
Images come from assets/ when downloaded, otherwise from the site.
"""
import io
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

import numpy as np
from PIL import Image, ImageFilter

BASE = 'https://storage.googleapis.com/dungeon-blocks-online.appspot.com/PNG/v1'
SIDE_VEC = [(-1, 0), (0, -1), (1, 0), (0, 1)]
CORNER_VEC = [(-0.7, -0.7), (0.7, -0.7), (0.7, 0.7), (-0.7, 0.7)]


def iso_x(vx, vy):
    return vx - vy  # screen x in the isometric view is proportional to (x - y)


@lru_cache(maxsize=4096)
def load(code: str, o: int, style: str = 'top-isometric'):
    pack = code.split('-')[0]
    rel = f'{style}/{pack}/{code}_{o}.png'
    local = os.path.join('assets', 'PNG', 'v1', *rel.split('/'))
    for _ in range(3):
        try:
            if os.path.exists(local):
                return Image.open(local).convert('RGBA')
            with urllib.request.urlopen(f'{BASE}/{rel}', timeout=30) as r:
                return Image.open(io.BytesIO(r.read())).convert('RGBA')
        except urllib.error.HTTPError:
            return None
        except Exception:
            continue
    return None


def rot(mask: int, k: int) -> int:
    k %= 4
    s = mask & 15
    c = mask >> 4
    s = ((s << k) | (s >> (4 - k))) & 15
    c = ((c << k) | (c >> (4 - k))) & 15
    return s | (c << 4)


def candidates(hint: str):
    def sides(*ss):
        return sum(1 << s for s in ss)
    if hint in ('wall', 'l-end'):
        return [sides(0)]
    if hint in ('angle', 'l-angle'):
        return [sides(0, 1)]
    if hint in ('corridor', 'l-straight'):
        return [sides(0, 2), sides(1, 3)]
    if hint in ('end', 'l-t'):
        return [sides(0, 1, 2)]
    if hint == 'corner':
        return [1 << 4]
    if hint == 'corners2':
        return [(1 << 4) | (1 << 5), (1 << 4) | (1 << 6)]
    if hint == 'corners3':
        return [(1 << 4) | (1 << 5) | (1 << 6)]
    if hint == 'anglecorner':
        return [sides(0, 1) | (1 << 6)]
    if hint == 'tedge':
        return [sides(0) | (1 << 5) | (1 << 6)]
    if hint == 'straightcorner':
        return [sides(0) | (1 << 5), sides(0) | (1 << 6)]
    return None  # symmetric: l-x / full / corners4


def predict(mask: int):
    tx = ix = 0.0
    for s in range(4):
        if mask & (1 << s):
            tx += SIDE_VEC[s][0]
            ix += iso_x(*SIDE_VEC[s])
    for c in range(4):
        if mask & (1 << (4 + c)):
            tx += CORNER_VEC[c][0]
            ix += iso_x(*CORNER_VEC[c])
    an = (1 if mask & 1 else 0) + (1 if mask & 4 else 0) - (1 if mask & 2 else 0) - (1 if mask & 8 else 0)
    return tx, ix, an


def centroid_x(code, ref, o, style):
    img = load(code, o, style)
    if img is None:
        return None
    a = np.asarray(img).astype(np.float32)
    if ref:
        rimg = load(ref, o, style)
        if rimg is None:
            return None
        b = np.asarray(rimg).astype(np.float32)
        ab = np.asarray(img.filter(ImageFilter.BoxBlur(8))).astype(np.float32)
        bb = np.asarray(rimg.filter(ImageFilter.BoxBlur(8))).astype(np.float32)
        both = (a[:, :, 3] > 200) & (b[:, :, 3] > 200)
        d = np.abs(ab[:, :, :3] - bb[:, :, :3]).sum(axis=2)
        m = both & (d > 55)
    else:
        m = a[:, :, 3] > 128
    ys, xs = np.nonzero(m)
    if len(xs) < 50:
        return 0.0, 0.0
    return float(xs.mean() - 500), float(xs.std())


def measure(code: str, ref, scale: int):
    feats = []
    for o in range(4):
        t = centroid_x(code, ref, o, 'top-isometric')
        i = centroid_x(code, ref, o, 'isometric')
        if t is None or i is None:
            return None
        feats.append((t[0] / (156.0 * scale), i[0] / (110.0 * scale), (t[1] / (156.0 * scale)) ** 2))
    return feats


def corr(p, q):
    p = np.asarray(p, dtype=float)
    q = np.asarray(q, dtype=float)
    p = p - p.mean()
    q = q - q.mean()
    n = np.linalg.norm(p) * np.linalg.norm(q)
    return float(p @ q / n) if n > 1e-9 else 0.0


def fit(job):
    code, hint, ref = job['code'], job['hint'], job.get('ref')
    cands = candidates(hint)
    if cands is None:
        full = {'l-x': 15, 'full': 0, 'corners4': 0xF0}.get(hint, 0)
        return code, {'masks': [full] * 4, 'score': 1, 'margin': 1}
    feats = measure(code, ref, job.get('scale', 1))
    if feats is None:
        return code, None
    best = []
    for base in cands:
        for k0 in range(4):
            for direction in (1,):  # orientation o rotates sides by +o (verified on UD)
                masks = [rot(base, k0 + direction * o) for o in range(4)]
                preds = [predict(m) for m in masks]
                pv = [c for p in preds for c in p[:2]]
                ov = [c for f in feats for c in f[:2]]
                pa = [p[2] for p in preds]
                oa = [f[2] for f in feats]
                s = 0.0
                if np.ptp(pv) > 1e-6:
                    s += corr(pv, ov)
                elif np.ptp(pa) > 1e-6:
                    s += corr(pa, oa)
                best.append((s, masks))
    best.sort(key=lambda t: -t[0])
    top = best[0]
    second = next((b for b in best[1:] if b[1] != top[1]), (top[0] - 1, None))
    return code, {'masks': top[1], 'score': round(top[0], 3), 'margin': round(top[0] - second[0], 3)}


def main():
    if sys.argv[1] == '--features':
        for c in sys.argv[2:]:
            code, _, ref = c.partition(':')
            print(code, [tuple(round(v, 3) for v in f) for f in (measure(code, ref or None, 1) or [])])
        return
    jobs = json.load(open(sys.argv[1], encoding='utf8'))
    out_path = sys.argv[2]
    result = json.load(open(out_path, encoding='utf8')) if os.path.exists(out_path) else {}

    def key(j):
        return f"{j['code']}|{j['hint']}|{j.get('ref') or ''}"

    todo = [j for j in jobs if result.get(j['code'], {}).get('key') != key(j)]
    with ThreadPoolExecutor(12) as ex:
        for i, (code, res) in enumerate(ex.map(fit, todo)):
            result[code] = dict(res or {'masks': None}, key=key(todo[i]))
            if (i + 1) % 50 == 0:
                print(f'{i + 1}/{len(todo)}', flush=True)
    json.dump(result, open(out_path, 'w', encoding='utf8'), indent=0)
    weak = sorted(c for c, r in result.items() if r.get('masks') is None or r.get('margin', 1) < 0.15)
    print(f'done: {len(todo)} analyzed; weak/missing: {len(weak)} {weak[:60]}')


if __name__ == '__main__':
    main()
