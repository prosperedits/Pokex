# Merge step: after gen-sealed-tcgcsv.mjs (prices, all games) + fetch-sealed.mjs
# (authentic Pokémon renders) + cutout-sealed.py (rembg cutouts), pick the BEST
# image per product:
#   1. Pokémon product with an AUTHENTIC official transparent render -> use it.
#   2. otherwise the rembg cutout webp (Magic / Lorcana / One Piece / uncovered).
#   3. otherwise leave the TCGplayer photo URL.
# Run last:  python scripts/merge-sealed-images.py
import os, re, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEALED_JS = os.path.join(ROOT, 'data', 'sealed.js')
SEALED_DIR = os.path.join(ROOT, 'assets', 'sealed')
VER = 61

# product display-name -> authentic-render key (fetch-sealed.mjs filenames)
KEY = [
    (re.compile(r'pok[eé]mon center', re.I), 'pc-etb'),
    (re.compile(r'elite trainer', re.I), 'etb'),
    (re.compile(r'booster box|booster display', re.I), 'display'),
    (re.compile(r'booster bundle', re.I), 'bundle'),
    (re.compile(r'build ?& ?battle|build and battle', re.I), 'bnb'),
]
def authentic(set_id, name):
    for rx, key in KEY:
        if rx.search(name):
            f = f"{set_id.replace('.', '_')}-{key}.png"
            if os.path.exists(os.path.join(SEALED_DIR, f)):
                return f'assets/sealed/{f}'
    return None

def main():
    src = open(SEALED_JS, encoding='utf-8').read()
    data = json.loads(re.search(r'window\.SEALED_PRODUCTS = ([\s\S]*);', src).group(1))
    auth = cut = photo = 0
    for set_id, arr in data.items():
        is_poke = bool(re.match(r'(sv|me)\d', set_id))
        for p in arr:
            m = re.search(r'(\d{4,})', p.get('img', ''))
            pid = m.group(1) if m else None
            a = authentic(set_id, p['name']) if is_poke else None
            if a:
                p['img'] = a; auth += 1
            elif pid and os.path.exists(os.path.join(SEALED_DIR, 'tcg', f'{pid}.webp')):
                p['img'] = f'assets/sealed/tcg/{pid}.webp?v={VER}'; cut += 1
            else:
                photo += 1  # keep whatever URL is there
    banner = ('// Sealed-product prices (gen-sealed-tcgcsv.mjs) + images: authentic\n'
              '// official Pokémon renders where they exist, rembg cutouts otherwise\n'
              '// (merge-sealed-images.py).\n')
    open(SEALED_JS, 'w', encoding='utf-8').write(banner + 'window.SEALED_PRODUCTS = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';\n')
    print(f'authentic Pokémon renders: {auth} | rembg cutouts: {cut} | left as photo: {photo}')

main()
