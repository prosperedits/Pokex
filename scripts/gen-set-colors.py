# Pre-compute each set's signature colour(s) from its LOGO (the true theme colour
# — booster-box art misleads). tcgdex logos are cross-origin so the browser can't
# canvas-read them; we sample server-side and bake the result into
# data/set-colors.js → window.SET_COLORS = { '<setId>': ['#rrggbb', ...] }.
# Run: python scripts/gen-set-colors.py
import urllib.request, io, os, re, json, colorsys
from collections import defaultdict
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
LOGOS = os.path.join(ROOT, 'assets', 'setlogos')
UA = {'User-Agent': 'pokex/1.0'}

def read(src):
    if src.startswith('http'):
        return urllib.request.urlopen(urllib.request.Request(src, headers=UA), timeout=20).read()
    return open(os.path.join(ROOT, src.split('?')[0]), 'rb').read()

def top_colors(src, n=3):
    im = Image.open(io.BytesIO(read(src))).convert('RGBA').resize((80, 80))
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

# Every set the app can open gets its own colour (Faisal, 27 Oct: the carousel
# ground is the set's colour, so Pokemon sets must not share one fallback):
#   1. the set's local wordmark (assets/setlogos/<id>.png|webp), the logo the app shows
#   2. its tcgdex logo (bundled sets carry the path; fresh sets come from tcgdex)
#   3. no logo anywhere (First Partner sets, some promos): its priciest card's art
def bundled_sets():
    out = {}
    for f in sorted(os.listdir(DATA)):
        if not re.match(r'^cards-.*\.js$', f):
            continue
        txt = open(os.path.join(DATA, f), encoding='utf-8').read()
        for m in re.finditer(r'window\.CARD_SETS\["([^"]+)"\]\s*=\s*', txt):
            try:
                d, _ = json.JSONDecoder().raw_decode(txt, m.end())
            except ValueError:
                continue
            cards = [c for c in d.get('cards', []) if not c.get('sealed') and c.get('image')]
            cards.sort(key=lambda c: -(c['priceUsd'] if isinstance(c.get('priceUsd'), (int, float)) else 0))   # priciest first; unpriced sets keep card order
            art = []
            for c in cards[:1]:
                art.append(c['image'] if c.get('fullImg') else c['image'] + '/low.png')
            out[m.group(1)] = {'logo': (d.get('set') or {}).get('logo') or '', 'art': art}
    return out

def fresh_pokemon_sets():
    # the same two newest series the app's set browser discovers
    try:
        series = json.loads(read('https://api.tcgdex.net/v2/en/series'))
        out = {}
        for sid in [x['id'] for x in series if x['id'] != 'tcgp'][-2:]:
            for st in json.loads(read(f'https://api.tcgdex.net/v2/en/series/{sid}')).get('sets', []):
                out[st['id']] = {'logo': st.get('logo') or '', 'art': []}
        return out
    except Exception as e:
        print(f'tcgdex series miss ({str(e)[:40]})')
        return {}

def sources(sid, info):
    out = [f'assets/setlogos/{sid}.{ext}' for ext in ('png', 'webp') if os.path.exists(os.path.join(LOGOS, f'{sid}.{ext}'))]
    if info.get('logo'):
        out.append(info['logo'] + '.png')
    return out + info.get('art', [])

try:   # keep last run's colours for any set whose images can't be reached this time
    prev = json.loads(re.search(r'=\s*(\{.*\});', open(os.path.join(DATA, 'set-colors.js'), encoding='utf-8').read(), re.S).group(1))
except Exception:
    prev = {}
sets = {**fresh_pokemon_sets(), **bundled_sets()}
for f in sorted(os.listdir(LOGOS)):   # other games' local wordmarks (Magic, Lorcana, One Piece)
    sets.setdefault(os.path.splitext(f)[0], {'logo': '', 'art': []})

colors = {}
for sid, info in sets.items():
    got = None
    for src in sources(sid, info):
        try:
            got = top_colors(src)
        except Exception:
            continue
        if got:
            print(f'{sid:9} {got}  <- {src[-60:]}')
            break
    if got:
        colors[sid] = got
    elif sid in prev:
        colors[sid] = prev[sid]; print(f'{sid:9} kept last run')
    else:
        print(f'{sid:9} no colour (monochrome or unreachable)')

banner = ('// Per-set signature colours, sampled from each set LOGO by\n'
          '// scripts/gen-set-colors.py. Drives the per-set background ambience.\n')
open(os.path.join(ROOT, 'data', 'set-colors.js'), 'w', encoding='utf-8').write(
    banner + 'window.SET_COLORS = ' + json.dumps(colors, indent=2) + ';\n')
print(f'\nwrote {len(colors)} set colours -> data/set-colors.js')
