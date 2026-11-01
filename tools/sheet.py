"""Contact sheet of pieces for visual inspection.
Usage: python tools/sheet.py OUT.png [--top] [--all-rot] CODE [CODE...]
"""
import io
import os
import sys
import urllib.request

from PIL import Image, ImageDraw

BASE = 'https://storage.googleapis.com/dungeon-blocks-online.appspot.com/PNG/v1'


def load(code, o, style):
    pack = code.split('-')[0]
    rel = f'{style}/{pack}/{code}_{o}.png'
    local = os.path.join('assets', 'PNG', 'v1', *rel.split('/'))
    try:
        if os.path.exists(local):
            return Image.open(local).convert('RGBA')
        with urllib.request.urlopen(f'{BASE}/{rel}', timeout=30) as r:
            return Image.open(io.BytesIO(r.read())).convert('RGBA')
    except Exception:
        return None


def main():
    args = sys.argv[1:]
    out = args.pop(0)
    style = 'isometric'
    rots = [0]
    if '--top' in args:
        args.remove('--top')
        style = 'top-isometric'
    crop = '--crop' in args
    if crop:
        args.remove('--crop')
    if '--all-rot' in args:
        args.remove('--all-rot')
        rots = [0, 1, 2, 3]
    cell = 250
    cols = 4 if rots == [0] else 4
    cells = [(c, o) for c in args for o in rots]
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 16)), (40, 40, 48, 255))
    d = ImageDraw.Draw(sheet)
    for i, (code, o) in enumerate(cells):
        img = load(code, o, style)
        x, y = (i % cols) * cell, (i // cols) * (cell + 16)
        if img is not None:
            if crop:
                img = img.crop((300, 250, 700, 650))
            img = img.resize((cell, cell))
            sheet.alpha_composite(img, (x, y + 16))
        d.text((x + 4, y + 2), f'{code} o{o}', fill=(255, 255, 255, 255))
    sheet.save(out)


if __name__ == '__main__':
    main()
