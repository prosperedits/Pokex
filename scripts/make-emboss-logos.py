"""Turn the four game logos into one height map for the relief on the crown (assets/crown/emboss-logos.png).

Run: python scripts/make-emboss-logos.py
P (2 Nov): "instead of the clover engravings, we have embossed logos of like the Pokemon logo, the MTG logo, and so on. Around
the crown." crown3d.js bumps the gold with this map, so the logos catch the light as raised metal. White is the top of the
relief, grey a lower step, black the crown's wall. Four cells in a row, in the order the crown cycles them.
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CW, CH = 1024, 512   # one cell; a cell's shape is the logo's 0.38 x 0.19 patch on the wall
MARGIN = 0.05
BEVEL = 7.0          # px of blur at cell scale: a wide, rounded shoulder. Mirror gold shows every step, so a tight bevel reads as jagged (P, 2 Nov)


def load(name):
    return np.asarray(Image.open(os.path.join(ROOT, "assets", "logos", name + ".png")).convert("RGBA")).astype(np.float32) / 255


def pokemon(a):
    # the yellow letters stand above the blue outline
    yellow = (a[..., 0] > 0.75) & (a[..., 1] > 0.55) & (a[..., 2] < 0.45) & (a[..., 3] > 0.5)
    return 0.55 * (a[..., 3] > 0.5) + 0.45 * yellow


def magic(a):
    # the planeswalker mark and MAGIC only: THE GATHERING is too fine to emboss smoothly
    m = (a[..., 3] > 0.5).astype(np.float32)
    w = a.shape[1]
    m[int(a.shape[0] * 0.66):, int(w * 0.2):] = 0
    return m


def lorcana(a):
    # the gold wordmark and star stand above the violet outline; the small Disney and Trading Card Game lines are cropped off
    h = a.shape[0]
    a = a[int(h * 0.31):int(h * 0.86)]
    lum = a[..., :3].mean(-1)
    return 0.45 * (a[..., 3] > 0.5) + 0.55 * ((lum > 0.55) & (a[..., 3] > 0.5))


def onepiece(a):
    # the ONE PIECE wordmark only: CARD GAME is too fine to emboss smoothly
    return (a[:int(a.shape[0] * 0.62)][..., 3] > 0.5).astype(np.float32)


def cell(mask):
    ys, xs = np.where(mask > 0.05)
    mask = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    w, h = mask.shape[1], mask.shape[0]
    k = min(CW * (1 - 2 * MARGIN) / w, CH * (1 - 2 * MARGIN) / h)
    # the small source logos go up in two steps, sharpened by a soft threshold, so curves stay smooth
    im = Image.fromarray((mask * 255).astype(np.uint8)).resize((round(w * k), round(h * k)), Image.BICUBIC)
    im = im.filter(ImageFilter.GaussianBlur(max(k * 0.5, 4.0)))   # melt the small sources' pixel stairs before re-crisping
    arr = np.asarray(im).astype(np.float32) / 255
    levels = sorted({0.0, *[round(float(v), 2) for v in np.unique(np.round(mask, 2))]})
    out = np.zeros_like(arr)
    for lo, hi in zip(levels, levels[1:]):   # re-crisp each step of the relief
        out += (hi - lo) * np.clip((arr - (lo + hi) / 2) / 0.12 + 0.5, 0, 1)
    canvas = Image.new("L", (CW, CH), 0)
    canvas.paste(Image.fromarray((out * 255).astype(np.uint8)), ((CW - im.width) // 2, (CH - im.height) // 2))
    return canvas.filter(ImageFilter.GaussianBlur(BEVEL))


atlas = Image.new("L", (CW * 4, CH), 0)
for i, (name, fn) in enumerate((("pokemon", pokemon), ("magic", magic), ("lorcana", lorcana), ("onepiece", onepiece))):
    atlas.paste(cell(fn(load(name))), (i * CW, 0))
dst = os.path.join(ROOT, "assets", "crown", "emboss-logos.png")
atlas.save(dst, optimize=True)
print("emboss", atlas.size, os.path.getsize(dst) // 1024, "KB")
