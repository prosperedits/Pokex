# gauntlet-layers.py — build the FULL multiplane layer stack:
#   gauntlet-bg.jpg     bare scene (P's hand-removed generation), green inpainted
#   gauntlet-hand.png   the gauntlet + socket, cut from the REGISTERED plate by
#                       its gold signature (generous margins: fringe is white
#                       swirl over white swirl, invisible at parallax)
#   gauntlet-debris.png the red ring arcs + floating debris outside the hand
#   (gauntlet-front.png stays as built — registered with the master's card)
# Depth registration rule: socket, card and front waves all derive from the
# master; the bg is P's re-render (fine — layers at different depths never
# need pixel registration with each other).
# ORDER: run gauntlet-extract.py FIRST, then this — this script inpaints the
# debris out of gauntlet-plate.jpg in place, so it must start from a fresh
# extract (running it twice back-to-back finds no debris to cut).
import json
import os
import numpy as np
import cv2

DL = r"C:\Users\P\Downloads"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "assets", "bg")

plate = cv2.imread(os.path.join(OUT, "gauntlet-plate.jpg"))     # registered (master-derived)
bare = cv2.imread(os.path.join(DL, "gauntlet-bare.png"))        # P's background generation
h, w = plate.shape[:2]
if bare.shape[:2] != (h, w):
    bare = cv2.resize(bare, (w, h), interpolation=cv2.INTER_LANCZOS4)

def inpaint_green(img):
    b, g, r = img[:, :, 0].astype(int), img[:, :, 1].astype(int), img[:, :, 2].astype(int)
    gm = ((g > 110) & (g > r * 14 // 10) & (g > b * 14 // 10)).astype(np.uint8) * 255
    gm = cv2.dilate(gm, np.ones((9, 9), np.uint8))
    return cv2.inpaint(img, gm, 9, cv2.INPAINT_TELEA) if gm.any() else img

# ---- background: bare, greenless ----
bg = inpaint_green(bare)
cv2.imwrite(os.path.join(OUT, "gauntlet-bg.jpg"), bg, [cv2.IMWRITE_JPEG_QUALITY, 90])

# ---- hand layer: gold blob + margins + filled holes (socket rides along) ----
b, g, r = plate[:, :, 0].astype(int), plate[:, :, 1].astype(int), plate[:, :, 2].astype(int)
gold = ((r > 105) & (g > 55) & (g < r) & (b < g) & (r - b > 45)).astype(np.uint8) * 255
blob = cv2.morphologyEx(gold, cv2.MORPH_CLOSE, np.ones((41, 41), np.uint8))
# fingers, thumb, arm and knuckles are separate gold islands — keep every
# sizable one, then bridge them (the dark socket between them gets enclosed)
nn, ll, stats, _ = cv2.connectedComponentsWithStats(blob, connectivity=8)
blob = np.zeros_like(blob)
for i in range(1, nn):
    if stats[i, cv2.CC_STAT_AREA] >= 3000:
        blob[ll == i] = 255
blob = cv2.morphologyEx(blob, cv2.MORPH_CLOSE, np.ones((81, 81), np.uint8))
blob = cv2.dilate(blob, np.ones((31, 31), np.uint8))
# fill enclosed holes (the socket + card area inside the grip). The arm spans
# the frame and PARTITIONS the outside, so "outside" = every inverse component
# touching the border; true holes are the rest.
inv = cv2.bitwise_not(blob)
nn2, ll2, stats2, _ = cv2.connectedComponentsWithStats(inv, connectivity=8)
handmask = blob.copy()
for i in range(1, nn2):
    x, y, ww, hh = stats2[i, cv2.CC_STAT_LEFT], stats2[i, cv2.CC_STAT_TOP], stats2[i, cv2.CC_STAT_WIDTH], stats2[i, cv2.CC_STAT_HEIGHT]
    touches_border = x == 0 or y == 0 or x + ww >= w or y + hh >= h
    if not touches_border:
        handmask[ll2 == i] = 255
hand_alpha = cv2.GaussianBlur(handmask, (21, 21), 0)   # soft 10px feather
ys, xs = np.nonzero(hand_alpha)
hx0, hy0, hx1, hy1 = max(0, xs.min() - 4), max(0, ys.min() - 4), min(w, xs.max() + 4), min(h, ys.max() + 4)
hand = np.dstack([plate[hy0:hy1, hx0:hx1], hand_alpha[hy0:hy1, hx0:hx1]])
cv2.imwrite(os.path.join(OUT, "gauntlet-hand.png"), hand)

# ---- crude depth map: hand near, socket bump, edges far — drives the plate's
#      fragment-shader displacement (fake-3D), no cutting required ----
geom0 = json.load(open(os.path.join(OUT, "gauntlet-geom.json")))
c0 = geom0["card"]
depth = np.full((h, w), 0.34, np.float32)
depth += 0.44 * (cv2.GaussianBlur(handmask, (0, 0), 45).astype(np.float32) / 255.0)
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
rad = np.sqrt(((xx - c0["cx"]) / 760) ** 2 + ((yy - c0["cy"]) / 760) ** 2)
depth += 0.20 * np.clip(1.0 - rad, 0, 1)
depth = np.clip(depth, 0, 1)
cv2.imwrite(os.path.join(OUT, "gauntlet-depth.jpg"), (depth * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 88])

# ---- debris/ring layer: red-dominant clusters OUTSIDE the hand and OUTSIDE
#      the socket neighbourhood (the plate's inpainted card region is red) ----
red = ((r > 85) & (r > g * 27 // 20) & (r > b * 27 // 20)).astype(np.uint8) * 255
red[handmask > 0] = 0
red[rad < 0.85] = 0
red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
nn, ll, stats, _ = cv2.connectedComponentsWithStats(red, connectivity=8)
keep = np.zeros((h, w), np.uint8)
for i in range(1, nn):
    if 80 <= stats[i, cv2.CC_STAT_AREA]:
        keep[ll == i] = 255
deb_alpha = cv2.GaussianBlur(keep, (5, 5), 0)
ys, xs = np.nonzero(deb_alpha)
dx0, dy0, dx1, dy1 = max(0, xs.min() - 4), max(0, ys.min() - 4), min(w, xs.max() + 4), min(h, ys.max() + 4)
debris = np.dstack([plate[dy0:dy1, dx0:dx1], deb_alpha[dy0:dy1, dx0:dx1]])
cv2.imwrite(os.path.join(OUT, "gauntlet-debris.png"), debris)

# ---- lift the debris OUT of the plate (the drifting copy must be the only
#      instance, or its motion doubles against the baked original) ----
lift = cv2.dilate(keep, np.ones((9, 9), np.uint8))
plate_clean = cv2.inpaint(plate, lift, 7, cv2.INPAINT_TELEA)
cv2.imwrite(os.path.join(OUT, "gauntlet-plate.jpg"), plate_clean, [cv2.IMWRITE_JPEG_QUALITY, 91])

# ---- extend the geometry manifest ----
gpath = os.path.join(OUT, "gauntlet-geom.json")
geom = json.load(open(gpath))
geom["layers"] = {
    "hand": {"x": int(hx0), "y": int(hy0), "w": int(hx1 - hx0), "h": int(hy1 - hy0)},
    "debris": {"x": int(dx0), "y": int(dy0), "w": int(dx1 - dx0), "h": int(dy1 - dy0)},
}
json.dump(geom, open(gpath, "w"))
print("hand", geom["layers"]["hand"], "cover", round((handmask > 0).mean() * 100, 1), "%")
print("debris", geom["layers"]["debris"], "cover", round((keep > 0).mean() * 100, 1), "%")
