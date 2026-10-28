"""Crowns card back: satin black, full-bleed fine guilloche rings in dark gold, the card
crown in the middle. No frame line (a thin gold frame on black is Lorcana's back; gold on
navy is One Piece's), per docs/design/culture/study.md, direction 7.
Run: python scripts/make-card-back.py   ->  assets/card-back.webp (630 x 880, 63 x 88 mm)
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
W, H, S = 630, 880, 3                      # draw at 3x, downsample for clean lines
w, h = W * S, H * S
img = Image.new('RGBA', (w, h), (7, 8, 11, 255))
d = ImageDraw.Draw(img)
cx, cy = w / 2, h * 0.5
for i, r in enumerate(range(10 * S, int(h * 0.75), 13 * S)):   # wide spacing: fine rings turn to moire at card size
    pts = []
    for k in range(721):
        a = k / 720 * math.tau
        rr = r + math.sin(a * 24 + r * 0.004) * 2.2 * S          # guilloche wobble
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 1.18))
    shade = 46 + int(18 * (0.5 + 0.5 * math.cos(i * 0.35)))
    d.line(pts, fill=(shade + 22, shade + 8, shade - 14, 255), width=2 * S)
# soft vignette so the rings fade toward the edges
vig = Image.new('L', (w, h), 0)
ImageDraw.Draw(vig).ellipse((-w * 0.25, -h * 0.2, w * 1.25, h * 1.2), fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(160 * S / 3))
base = Image.new('RGBA', (w, h), (7, 8, 11, 255))
img = Image.composite(img, base, vig)
# the crown, centred
crown = Image.open(ROOT / 'assets' / 'crown' / 'crown-still.png').convert('RGBA')
cw = int(w * 0.62)
crown = crown.resize((cw, int(crown.height * cw / crown.width)), Image.LANCZOS)
img.alpha_composite(crown, (int(cx - cw / 2), int(cy - crown.height / 2)))
# physical corner radius (3 mm of 63 mm)
mask = Image.new('L', (w, h), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=int(w * 3 / 63), fill=255)
img.putalpha(mask)
out = ROOT / 'assets' / 'card-back.webp'
img.resize((W, H), Image.LANCZOS).save(out, 'WEBP', quality=90, method=6)
print('wrote', out, out.stat().st_size // 1024, 'KB')
