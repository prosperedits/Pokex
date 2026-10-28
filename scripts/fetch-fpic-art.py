# fetch-fpic-art.py — bundle the First Partner Illustration Collection card art
# (MEP Black Star Promos 037-063) at the best free resolution found.
#
# Source: the Limitless TCG CDN full-size scan, MEP_<nnn>_R_EN.png (no size
# suffix) = 736x1024 RGBA, the official clean scan with transparent rounded
# corners. That beats every other free source checked on 2026-10-27:
#   Limitless _LG 460x640 (the old Series 1 art), TCGplayer _in_1000x1000
#   420x585 (Series 1) / 660x920, Scrydex large 598x834, TCGdex has no MEP art.
#
# Output (trimmed to the card edge: alpha bbox, then any near-white margin):
#   assets/fpic1/mep-37..45.png   Series 1 (PNG: index.html also points at mep-38.png)
#   assets/fpic2/mep-46..54.webp  Series 2
#   assets/fpic3/mep-55..63.webp  Series 3
# Run: python -I scripts/fetch-fpic-art.py      (needs Pillow)
import io, os, sys, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEP/MEP_{:03d}_R_EN.png'
SERIES = [('fpic1', range(37, 46), 'png'), ('fpic2', range(46, 55), 'webp'), ('fpic3', range(55, 64), 'webp')]
MIN_W = 700   # refuse anything smaller than the full-size scan


def fetch(n):
    req = urllib.request.Request(URL.format(n), headers={'User-Agent': 'CrownsTCG/1.0 (personal card tracker)'})
    return urllib.request.urlopen(req, timeout=60).read()


def trim(im):
    """Crop to the card: drop fully transparent margins, then near-white rows/cols."""
    im = im.convert('RGBA')
    box = im.getchannel('A').getbbox()
    if box and box != (0, 0, im.width, im.height):
        im = im.crop(box)
    px = im.load()
    def white_row(y): return all(px[x, y][3] < 10 or min(px[x, y][:3]) > 245 for x in range(0, im.width, 4))
    def white_col(x): return all(px[x, y][3] < 10 or min(px[x, y][:3]) > 245 for y in range(0, im.height, 4))
    t, b, l, r = 0, im.height - 1, 0, im.width - 1
    while t < b and white_row(t): t += 1
    while b > t and white_row(b): b -= 1
    while l < r and white_col(l): l += 1
    while r > l and white_col(r): r -= 1
    if (l, t, r + 1, b + 1) != (0, 0, im.width, im.height):
        im = im.crop((l, t, r + 1, b + 1))
    return im


fails = 0
for folder, nums, fmt in SERIES:
    out_dir = os.path.join(ROOT, 'assets', folder)
    os.makedirs(out_dir, exist_ok=True)
    for n in nums:
        try:
            raw = fetch(n)
            src = Image.open(io.BytesIO(raw))
            if src.width < MIN_W:
                raise ValueError(f'too small {src.size}')
            im = trim(src)
            dest = os.path.join(out_dir, f'mep-{n}.{fmt}')
            if fmt == 'png':
                if im.size == src.size:
                    open(dest, 'wb').write(raw)          # untouched original bytes (smallest)
                else:
                    im.save(dest, 'PNG', optimize=True)
            else:
                im.save(dest, 'WEBP', quality=95, method=6)
            print(f'{folder}/mep-{n}.{fmt}: {im.size[0]}x{im.size[1]} {os.path.getsize(dest)} bytes')
        except Exception as e:
            fails += 1
            print(f'{folder}/mep-{n}: FAIL {e} (existing file kept)')
sys.exit(1 if fails else 0)
