# gauntlet-extract.py — build the layered set-piece assets for gauntlet.html.
#
# Inputs (Downloads):
#   master: image-a248900f-... (scene WITH front tendrils, green card)
#   plate:  gauntlet-plate.png (same scene, front tendrils REMOVED)  [optional]
#
# Outputs (assets/bg/):
#   gauntlet-plate.jpg   — the background plate the card sits on
#   gauntlet-front.png   — the front tendrils with TRUE soft alpha
#   gauntlet-geom.json   — card rect + front-layer crop offsets
#
# With a real plate, the front layer comes from DIFFERENCE MATTING (wherever
# master and plate differ IS the front element, alpha = how strongly they
# differ). Without one, we synthesize a stand-in plate by inpainting the
# master under the v7 front mask (good enough to run the living rig).
import json
import os
import numpy as np
import cv2

MASTER = r"C:\Users\P\Downloads\image-a248900f-55cd-4942-9fb2-33c749bcce49.png"
PLATE_IN = r"C:\Users\P\Downloads\gauntlet-plate.png"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "bg")

img = cv2.imread(MASTER)
h, w = img.shape[:2]
b, g, r = img[:, :, 0].astype(int), img[:, :, 1].astype(int), img[:, :, 2].astype(int)
green = (g > 120) & (g > r * 16 // 10) & (g > b * 16 // 10)
gmask = (green * 255).astype(np.uint8)
gclean = cv2.morphologyEx(gmask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
cnts, _ = cv2.findContours(gclean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
big = max(cnts, key=cv2.contourArea)
(cx, cy), (rw, rh), ang = cv2.minAreaRect(big)
if rw > rh:
    rw, rh = rh, rw
    ang += 90

have_plate = os.path.exists(PLATE_IN)
if have_plate:
    plate = cv2.imread(PLATE_IN)
    if plate.shape[:2] != (h, w):
        plate = cv2.resize(plate, (w, h), interpolation=cv2.INTER_LANCZOS4)
    # difference matte: |master - plate| -> front alpha (soft, real edges)
    diff = np.abs(img.astype(int) - plate.astype(int)).max(axis=2)
    alpha = np.clip((diff - 12) * (255.0 / 60.0), 0, 255).astype(np.uint8)
    # keep only meaningful clusters (kill generator re-render noise)
    hard = (alpha > 90).astype(np.uint8) * 255
    hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    nn, ll, stats, _ = cv2.connectedComponentsWithStats(hard, connectivity=8)
    keepmask = np.zeros((h, w), np.uint8)
    for i in range(1, nn):
        if stats[i, cv2.CC_STAT_AREA] >= 400:
            keepmask[ll == i] = 255
    keepmask = cv2.dilate(keepmask, np.ones((9, 9), np.uint8))
    alpha[keepmask == 0] = 0
    # never front-matte the green itself (card region shows the live card)
    alpha[cv2.dilate(gmask, np.ones((3, 3), np.uint8)) > 0] = 0
    front_rgb = img
    plate_out = plate
    mode = "difference-matte (real plate)"
else:
    # stand-in: v7 rule for the mask, inpaint the master underneath it
    rect = np.zeros((h, w), np.uint8)
    box = cv2.boxPoints(((cx, cy), (rw, rh), ang)).astype(np.int32)
    cv2.fillConvexPoly(rect, box, 255)
    green_d = cv2.dilate(gmask, np.ones((3, 3), np.uint8)) > 0
    occ = ((rect > 0) & ~green_d).astype(np.uint8) * 255
    occ = cv2.morphologyEx(occ, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    alpha = cv2.GaussianBlur(occ, (3, 3), 0)
    inp_mask = cv2.dilate(occ, np.ones((7, 7), np.uint8))
    plate_out = cv2.inpaint(img, inp_mask, 7, cv2.INPAINT_TELEA)
    front_rgb = img
    mode = "stand-in (inpainted plate; drop gauntlet-plate.png in Downloads for the real one)"

# crop the front layer to its bbox
ys, xs = np.nonzero(alpha)
if len(xs):
    fx0, fy0 = max(0, xs.min() - 4), max(0, ys.min() - 4)
    fx1, fy1 = min(w, xs.max() + 4), min(h, ys.max() + 4)
else:
    fx0 = fy0 = 0; fx1 = fy1 = 4
front = np.dstack([front_rgb[fy0:fy1, fx0:fx1], alpha[fy0:fy1, fx0:fx1]])
cv2.imwrite(os.path.join(OUT, "gauntlet-front.png"), front)

# erase the green card from the plate — its geometry is captured in the JSON,
# and the parallax shifts layers against each other, so any green left in the
# plate would peek out from behind the live card. Fill it from the socket.
pg = plate_out
pb, pgc, pr = pg[:, :, 0].astype(int), pg[:, :, 1].astype(int), pg[:, :, 2].astype(int)
pgreen = ((pgc > 110) & (pgc > pr * 14 // 10) & (pgc > pb * 14 // 10)).astype(np.uint8) * 255
pgreen = cv2.dilate(pgreen, np.ones((9, 9), np.uint8))
plate_out = cv2.inpaint(pg, pgreen, 9, cv2.INPAINT_TELEA)
cv2.imwrite(os.path.join(OUT, "gauntlet-plate.jpg"), plate_out, [cv2.IMWRITE_JPEG_QUALITY, 91])

geom = {
    "imgW": w, "imgH": h,
    "card": {"cx": round(cx, 2), "cy": round(cy, 2), "w": round(rw, 2), "h": round(rh, 2), "angle": round(ang, 3)},
    "front": {"x": int(fx0), "y": int(fy0), "w": int(fx1 - fx0), "h": int(fy1 - fy0)},
}
with open(os.path.join(OUT, "gauntlet-geom.json"), "w") as f:
    json.dump(geom, f)
print(mode)
print(json.dumps(geom))
