# uniselect-extract.py — build the universe-selector scene from P's crown-vortex
# generation (Downloads\uni 1.png): four MAGENTA placeholders around the crown,
# one per universe. The crown glow / swirls partially COVER some seats, so each
# seat gets an occluder layer (the gauntlet v7 chroma rule: anything inside the
# quad that is not magenta is in front of that card).
#
# Outputs (assets/bg/):
#   uniselect-bg.jpg        scene with magenta inpainted out
#   uniselect-geom.json     imgW/H + slots[] {cx,cy,w,h,angle,occ:{x,y,w,h}?}
#   uniselect-occ-N.png     per-seat front layer (crown glow, swirl crossings)
#
# Quad fit: minAreaRect over the blob's CONVEX HULL. The occluder bites are
# concave, so the hull restores the card's true outline from the surviving
# edges/corners, and minAreaRect over it is exact (plain minAreaRect over the
# bitten blob over-rotates; moment-axis fitting drifts on asymmetric bites).
import json
import math
import os
import numpy as np
import cv2

SRC = r"C:\Users\P\Downloads\uni 1.png"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "bg")
SP = r"C:\Users\P\AppData\Local\Temp\claude\C--Users-P-Downloads-Clauder\2de127a7-2c49-4be9-99de-913dd4cb324e\scratchpad"

img = cv2.imread(SRC)
h, w = img.shape[:2]
b, g, r = img[:, :, 0].astype(int), img[:, :, 1].astype(int), img[:, :, 2].astype(int)
mag = ((r > 170) & (b > 170) & (g < 80) & (np.abs(r - b) < 70)).astype(np.uint8) * 255
mag = cv2.morphologyEx(mag, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
nn, ll, stats, _ = cv2.connectedComponentsWithStats(mag, connectivity=8)
comps = sorted(range(1, nn), key=lambda i: -stats[i, cv2.CC_STAT_AREA])[:4]
if len(comps) < 4:
    raise SystemExit(f"expected 4 magenta slots, found {len(comps)}")

def fit_quad(mask):
    cnts, _ = cv2.findContours(mask * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull = cv2.convexHull(np.vstack([c.reshape(-1, 2) for c in cnts]))
    (cx, cy), (rw, rh), deg = cv2.minAreaRect(hull)
    if rw > rh:                     # cards are portrait: normalize
        rw, rh = rh, rw
        deg += 90
    while deg > 90: deg -= 180
    while deg < -90: deg += 180
    return cx, cy, rw, rh, deg

slots = []
mag_d = cv2.dilate(mag, np.ones((3, 3), np.uint8))
occ_meta = []
for i in comps:
    mask = (ll == i).astype(np.uint8)
    cx, cy, rw, rh, deg = fit_quad(mask)
    slots.append({"cx": round(cx, 2), "cy": round(cy, 2), "w": round(rw, 2), "h": round(rh, 2), "angle": round(deg, 3)})

slots.sort(key=lambda s: s["cx"])

# occluders per SORTED slot (stable numbering left→right)
for k, s in enumerate(slots):
    rect = np.zeros((h, w), np.uint8)
    box = cv2.boxPoints(((s["cx"], s["cy"]), (s["w"], s["h"]), s["angle"])).astype(np.int32)
    cv2.fillConvexPoly(rect, box, 255)
    occ = ((rect > 0) & (mag_d == 0)).astype(np.uint8) * 255
    occ = cv2.morphologyEx(occ, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n2, l2, st2, _ = cv2.connectedComponentsWithStats(occ, connectivity=8)
    keep = np.zeros((h, w), np.uint8)
    for j in range(1, n2):
        if st2[j, cv2.CC_STAT_AREA] >= 300:
            keep[l2 == j] = 255
    if not keep.any():
        s["occ"] = None
        continue
    alpha = cv2.GaussianBlur(keep, (3, 3), 0)
    ys, xs = np.nonzero(alpha)
    x0, y0 = max(0, xs.min() - 3), max(0, ys.min() - 3)
    x1, y1 = min(w, xs.max() + 3), min(h, ys.max() + 3)
    crop = np.dstack([img[y0:y1, x0:x1], alpha[y0:y1, x0:x1]])
    cv2.imwrite(os.path.join(OUT, f"uniselect-occ-{k}.png"), crop)
    s["occ"] = {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)}
    occ_meta.append((k, int((keep > 0).sum())))

# plate: magenta inpainted away so nothing pink ever peeks past a card edge
inp = cv2.dilate(mag, np.ones((9, 9), np.uint8))
plate = cv2.inpaint(img, inp, 9, cv2.INPAINT_TELEA)
cv2.imwrite(os.path.join(OUT, "uniselect-bg.jpg"), plate, [cv2.IMWRITE_JPEG_QUALITY, 90])

geom = {"imgW": w, "imgH": h, "slots": slots}
with open(os.path.join(OUT, "uniselect-geom.json"), "w") as f:
    json.dump(geom, f)

pv = plate.copy()
for k, s in enumerate(slots):
    box = cv2.boxPoints(((s["cx"], s["cy"]), (s["w"], s["h"]), s["angle"])).astype(np.int32)
    cv2.polylines(pv, [box], True, (0, 255, 0), 6)
    cv2.putText(pv, str(k), (int(s["cx"]) - 20, int(s["cy"])), cv2.FONT_HERSHEY_SIMPLEX, 3, (0, 255, 0), 8)
cv2.imwrite(os.path.join(SP, "uniselect-preview.png"), cv2.resize(pv, (w // 2, h // 2)))
print(json.dumps(geom))
print("occluders:", occ_meta)
