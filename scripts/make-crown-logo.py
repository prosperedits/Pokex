"""Stitch the header logo: one full turn of the arcade crown as an animated WebP.

Run: python scripts/make-crown-logo.py <frames_dir>
Frames come from docs/design/crown/logo.html (transparent PNGs, one turn). The old logo was a
72-frame sprite stepped by JS over 14 s, about 5 frames a second, which read as laggy; this is
360 frames at 30 fps (a 12 s turn), played by the browser itself, so it needs no script and keeps its alpha.
Writes assets/crown/crown-turn.webp (the logo) and assets/crown/crown-logo.png (a still).
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frames = [Image.open(f).convert("RGBA") for f in sorted(glob.glob(os.path.join(sys.argv[1], "f*.png")))]
H = 112  # 2x the largest header height (56px)

box = None  # one crop for every frame: the union of where the crown ever is
for im in frames:
    b = im.getbbox()
    box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
pad = 4
box = (max(0, box[0] - pad), max(0, box[1] - pad), min(frames[0].width, box[2] + pad), min(frames[0].height, box[3] + pad))
W = round(H * (box[2] - box[0]) / (box[3] - box[1]))
N = 360  # 30 fps over a 12 s turn: 1 degree a frame, ~2 MB (40 fps was 4.3 MB)
idx = [round(i * len(frames) / N) % len(frames) for i in range(N)]
out = [frames[i].crop(box).resize((W, H), Image.LANCZOS) for i in idx]

dst = os.path.join(ROOT, "assets", "crown", "crown-turn.webp")
out[0].save(dst, save_all=True, append_images=out[1:], duration=round(12000 / N), loop=0, quality=62, method=6,
            minimize_size=True, alpha_quality=70)
still = frames[0].crop(box)
still.resize((round(still.width * 2 * H / still.height / 2), H * 2 // 2 * 2), Image.LANCZOS).save(os.path.join(ROOT, "assets", "crown", "crown-logo.png"))
print("logo", W, "x", H, "aspect", round(W / H, 4), "frames", len(out), "bytes", os.path.getsize(dst))
