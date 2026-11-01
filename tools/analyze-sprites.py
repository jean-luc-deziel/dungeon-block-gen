"""Measures top-down sprite features used to orient structural/edge pieces.

Usage: python tools/analyze-sprites.py CODES_FILE OUT_JSON
  CODES_FILE: one element code per line.
Per code, for orientations 0-3 of the painted top-down sprite: alpha centroid (cx, cy),
spread (sx, sy) and opaque pixel count, relative to the footprint center; plus mean RGB of
9 regions (NW N NE W C E SW S SE) of the 1x1 top surface at orientation 0.
Uses assets/ when downloaded, otherwise fetches from the site.
"""
import io
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

BASE = 'https://storage.googleapis.com/dungeon-blocks-online.appspot.com/PNG/v1'
UX, UY, UZ = 156, 94, 30  # painted top-down units


def load(code: str, o: int):
    pack = code.split('-')[0]
    rel = f'top-isometric/{pack}/{code}_{o}.png'
    local = os.path.join('assets', 'PNG', 'v1', *rel.split('/'))
    try:
        if os.path.exists(local):
            return Image.open(local).convert('RGBA')
        with urllib.request.urlopen(f'{BASE}/{rel}', timeout=30) as r:
            return Image.open(io.BytesIO(r.read())).convert('RGBA')
    except Exception:
        return None


def features(code: str):
    out = {'rot': [], 'regions': None}
    for o in range(4):
        img = load(code, o)
        if img is None:
            return code, None
        a = np.asarray(img)
        alpha = a[:, :, 3] > 128
        ys, xs = np.nonzero(alpha)
        if len(xs) == 0:
            return code, None
        cx, cy = xs.mean() - 500, ys.mean() - 500
        out['rot'].append([round(cx, 1), round(cy, 1), round(xs.std(), 1), round(ys.std(), 1), int(len(xs))])
        if o == 0:
            # 1x1 top surface of a 1-high tile sits at rows 500-UY/2-UZ .. 500+UY/2-UZ
            x0, y0 = 500 - UX / 2, 500 - UY / 2 - UZ
            regs = []
            for ry in range(3):
                for rx in range(3):
                    xa, xb = int(x0 + rx * UX / 3), int(x0 + (rx + 1) * UX / 3)
                    ya, yb = int(y0 + ry * UY / 3), int(y0 + (ry + 1) * UY / 3)
                    patch = a[ya:yb, xa:xb]
                    m = patch[:, :, 3] > 128
                    regs.append([round(float(patch[:, :, c][m].mean()), 1) if m.any() else -1 for c in range(3)])
            out['regions'] = regs
    return code, out


def main():
    codes = [c.strip() for c in open(sys.argv[1], encoding='utf8') if c.strip()]
    result = {}
    if os.path.exists(sys.argv[2]):
        result = json.load(open(sys.argv[2], encoding='utf8'))
    todo = [c for c in codes if c not in result]
    with ThreadPoolExecutor(12) as ex:
        for i, (code, feat) in enumerate(ex.map(features, todo)):
            result[code] = feat
            if (i + 1) % 100 == 0:
                print(f'{i + 1}/{len(todo)}', flush=True)
    json.dump(result, open(sys.argv[2], 'w', encoding='utf8'))
    print(f'done: {len(todo)} analyzed, {sum(1 for c in todo if result[c] is None)} unavailable')


if __name__ == '__main__':
    main()
