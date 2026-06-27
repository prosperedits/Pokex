# Isolate the Crowns wordmark. The source webp's background is uniformly SEMI-TRANSPARENT
# (alpha ~58) while the gold wordmark is OPAQUE (alpha ~255) — so an alpha ramp cleanly
# removes the whole gradient background (incl. the diagonal flare) without touching the gold.
from PIL import Image
import numpy as np

src = 'assets/crowns-src.webp'
out = 'assets/crowns-logo.png'
im = Image.open(src).convert('RGBA')
arr = np.array(im).astype(np.float32)
a = arr[..., 3]
# diagnostics
print('alpha  min/mean/max:', int(a.min()), round(float(a.mean()), 1), int(a.max()))
for t in (60, 100, 140, 200, 250):
    print(f'  px with alpha>{t}: {int((a > t).sum())}')

# alpha ramp: bg(~58) -> 0, wordmark(~255) -> 255, AA edges between ramp smoothly
lo, hi = 100.0, 170.0
out_a = np.clip((a - lo) / (hi - lo), 0, 1) * 255.0
arr[..., 3] = out_a
im = Image.fromarray(arr.astype(np.uint8), 'RGBA')

# trim to content + small even margin
bbox = im.getbbox()
im = im.crop(bbox)
m = max(8, im.size[0] // 70)
canvas = Image.new('RGBA', (im.size[0] + 2 * m, im.size[1] + 2 * m), (0, 0, 0, 0))
canvas.paste(im, (m, m), im)
canvas.save(out)
print('saved', out, canvas.size, '| opaque px:', int((np.array(canvas)[..., 3] > 8).sum()))
