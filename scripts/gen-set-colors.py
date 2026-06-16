# Pre-compute each set's signature colour(s) from its LOGO (the true theme colour
# — booster-box art misleads). tcgdex logos are cross-origin so the browser can't
# canvas-read them; we sample server-side and bake the result into
# data/set-colors.js → window.SET_COLORS = { '<setId>': ['#rrggbb', ...] }.
# Run: python scripts/gen-set-colors.py
import urllib.request, io, os, json, colorsys
from collections import defaultdict
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS = ['sv01','sv02','sv03','sv03.5','sv04','sv04.5','sv05','sv06','sv06.5','sv07',
        'sv08','sv08.5','sv09','sv10','sv10.5b','sv10.5w','me01','me02','me02.5','me03','me04']

def top_colors(url, n=3):
    raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'pokex/1.0'}), timeout=20).read()
    im = Image.open(io.BytesIO(raw)).convert('RGBA').resize((80, 80))
    a = np.array(im); rgb = a[..., :3].astype(int); al = a[..., 3]
    mx, mn = rgb.max(2), rgb.min(2)
    mask = (al > 140) & ((mx - mn) > 42) & (mx > 80)        # saturated, opaque, not grey
    if mask.sum() < 24:
        return None
    buckets = defaultdict(list)
    for r, g, b in rgb[mask]:
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        buckets[int(h * 18) % 18].append((r, g, b))
    ranked = sorted(buckets.values(), key=len, reverse=True)[:n]
    out = []
    for grp in ranked:
        m = np.array(grp).mean(0)
        # lift toward a vivid light so it reads as ambient light, not mud
        h, s, v = colorsys.rgb_to_hsv(*(m / 255))
        r, g, b = colorsys.hsv_to_rgb(h, min(1, s * 1.05), max(v, 0.62))
        out.append('#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255)))
    return out

colors = {}
for sid in SETS:
    pre = ''.join(c for c in sid if c.isalpha())[:2]  # sv / me
    try:
        c = top_colors(f'https://assets.tcgdex.net/en/{pre}/{sid}/logo.png')
        if c:
            colors[sid] = c; print(f'{sid:9} {c}')
        else:
            print(f'{sid:9} (monochrome logo — skipped)')
    except Exception as e:
        print(f'{sid:9} miss ({str(e)[:40]})')

banner = ('// Per-set signature colours, sampled from each set LOGO by\n'
          '// scripts/gen-set-colors.py. Drives the per-set background ambience.\n')
open(os.path.join(ROOT, 'data', 'set-colors.js'), 'w', encoding='utf-8').write(
    banner + 'window.SET_COLORS = ' + json.dumps(colors, indent=2) + ';\n')
print(f'\nwrote {len(colors)} set colours -> data/set-colors.js')
