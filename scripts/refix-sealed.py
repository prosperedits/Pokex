# refix-sealed.py — re-cut the specific sealed products the user flagged as
# cut-off / broken / missing, using the birefnet-general model (NOT u2net, which
# shredded white/black boxes). Keeps the WHOLE product — tight-crops only to the
# real alpha bbox, never into the box. Sources are the official TCGplayer
# 1000x1000 product photos (white bg). Writes transparent webp into
# assets/sealed/tcg/ and is otherwise a no-op on every other product.
#
# Targeted fix (does NOT touch the good sets). Run: python scripts/refix-sealed.py
#   - Mega Evolution (me01)            ETB  644279  (was ghost-outline)
#   - Ascended Heroes (me02.5)         Bundle 668541 (was cut off)
#   - Surging Sparks (sv08)            Bundle 679564 (was a weak 280px render)
#   - Black Bolt (sv10.5b)             ETB 630686, Bundle 630431 (were shredded)
#   - White Flare (sv10.5w)            PC-ETB 630688, ETB 630689, Bundle 630696
#   - Prismatic Evolutions (sv08.5)    Super-Premium Collection 622770 (NEW),
#                                      Premium Figure Collection 650799 (NEW)
#
# Requires: pip install rembg onnxruntime pillow   (already installed)
import io, os, urllib.request
from PIL import Image
from rembg import remove, new_session

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'assets', 'sealed', 'tcg')
os.makedirs(OUT_DIR, exist_ok=True)
SESSION = new_session('birefnet-general')   # full-object segmentation; survives white/black boxes
MAXDIM = 560
PAD = 6

# product ids to (re)cut from TCGplayer 1000x1000 photos
PIDS = ['644279', '668541', '679564', '630686', '630431', '630688', '630689', '630696', '622770', '650799']

def fetch(pid):
    url = f'https://tcgplayer-cdn.tcgplayer.com/product/{pid}_in_1000x1000.jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'pokex/1.0'})
    return urllib.request.urlopen(req, timeout=60).read()

def cut(pid, raw):
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    out = remove(im, session=SESSION, post_process_mask=True)     # clean AI alpha
    bbox = out.split()[3].getbbox()                               # tight-crop to the product only
    if bbox:
        out = out.crop((max(0, bbox[0]-PAD), max(0, bbox[1]-PAD),
                        min(out.width, bbox[2]+PAD), min(out.height, bbox[3]+PAD)))
    if max(out.size) > MAXDIM:                                    # downscale for the web
        s = MAXDIM / max(out.size)
        out = out.resize((round(out.width*s), round(out.height*s)), Image.LANCZOS)
    dest = os.path.join(OUT_DIR, f'{pid}.webp')
    out.save(dest, 'WEBP', quality=92, method=6)
    # guard: a healthy box fills a good chunk of its bbox — warn if the mask looks fragmented
    import numpy as np
    cov = (np.asarray(out.split()[3]) > 200).mean()
    flag = '' if cov >= 0.45 else '  <-- LOW COVERAGE, inspect!'
    print(f'{pid}: src {im.size} -> {out.size}  opaque_frac={cov:.3f}{flag}')

for pid in PIDS:
    try:
        cut(pid, fetch(pid))
    except Exception as e:
        print(f'{pid}: FAIL {e}')
print('done — transparent webp written to assets/sealed/tcg/')
