"""Find the card windows on a Meshy crown, in the units crown3d.js uses.

Run: blender -b -P scripts/crown-slots.py -- <crown.glb> <out.json>
Each face's base colour is sampled at its UV centre; pale, low-saturation faces facing
outward are the holographic card windows. They are clustered by angle around the crown
and reported as slots ({a, y, h, w, r}) after crown3d's normalisation (footprint 1.75,
base at y = 0, glTF axes: a = atan2(x, z)).
"""
import colorsys
import json
import math
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]


def gl(v):  # Blender Z-up -> glTF Y-up
    return Vector((v.x, v.z, -v.y))


pts = [gl(o.matrix_world @ Vector(c)) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
mid = (lo + hi) / 2
k = 1.75 / max(hi.x - lo.x, hi.z - lo.z)

win = []  # (angle, y, radius, area) of window faces, normalised
for o in meshes:
    me = o.data
    img = None
    for slot in o.material_slots:
        if slot.material and slot.material.use_nodes:
            for n in slot.material.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and "base" in (n.label + n.name + n.image.name).lower():
                    img = n.image
            if img is None:
                for n in slot.material.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image:
                        img = n.image
                        break
    if img is None:
        print("SLOTS no texture on", o.name)
        continue
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    uv = me.uv_layers.active.data
    mw = o.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    for poly in me.polygons:
        u = sum(uv[li].uv.x for li in poly.loop_indices) / poly.loop_total
        v = sum(uv[li].uv.y for li in poly.loop_indices) / poly.loop_total
        r, g, b, _ = px[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))]
        hh, ss, vv = colorsys.rgb_to_hsv(float(r), float(g), float(b))
        if not (vv > 0.62 and ss < 0.42):
            continue
        c = gl(mw @ poly.center)
        n = gl(nm @ poly.normal).normalized()
        x, z = (c.x - mid.x) * k, (c.z - mid.z) * k
        rad = math.hypot(x, z)
        if rad < 0.2 or (n.x * x + n.z * z) / rad < 0.35:  # outward-facing only
            continue
        win.append((math.atan2(x, z), (c.y - lo.y) * k, rad, poly.area * k * k))

print("SLOTS window faces", len(win))
win.sort()
# The gold dividers between windows are thin, so split by the valleys of an angular
# histogram of window area (1 degree bins, lightly smoothed) rather than by empty gaps.
hist = np.zeros(360)
for f in win:
    hist[int(math.degrees(f[0]) % 360)] += f[3]
sm = np.convolve(np.concatenate([hist[-2:], hist, hist[:2]]), np.ones(5) / 5, mode="valid")
print("SLOTS hist", " ".join(str(int(x * 1000)) for x in sm))
med = float(np.median(sm))
cuts = [i for i in range(360) if sm[i] <= sm[i - 1] and sm[i] <= sm[(i + 1) % 360] and sm[i] < med * 0.45]
merged = []
for c in cuts:  # one cut per valley
    if merged and c - merged[-1] < 8:
        continue
    merged.append(c)
if len(merged) > 1 and merged[0] + 360 - merged[-1] < 8:
    merged.pop()
print("SLOTS cuts", merged)
clusters = []
for i, c in enumerate(merged):
    e = merged[(i + 1) % len(merged)] + (360 if i + 1 == len(merged) else 0)
    clusters.append([f for f in win if c <= (math.degrees(f[0]) % 360) < e or c <= (math.degrees(f[0]) % 360) + 360 < e])

slots = []
for cl in clusters:
    area = sum(f[3] for f in cl)
    if area < 0.004:
        continue
    sx = sum(math.sin(f[0]) * f[3] for f in cl)
    cx = sum(math.cos(f[0]) * f[3] for f in cl)
    a = math.atan2(sx, cx)
    ys = sorted(f[1] for f in cl)
    y0, y1 = ys[int(len(ys) * 0.04)], ys[int(len(ys) * 0.96) - 1]
    r = sum(f[2] * f[3] for f in cl) / area
    da = [((f[0] - a + math.pi) % (2 * math.pi)) - math.pi for f in cl]
    da.sort()
    w = (da[int(len(da) * 0.96) - 1] - da[int(len(da) * 0.04)]) * r
    slots.append({"a": round(a, 4), "y": round((y0 + y1) / 2, 4), "h": round(y1 - y0, 4), "w": round(w, 4), "r": round(r, 4), "area": round(area, 4)})
slots.sort(key=lambda s: s["a"])
json.dump({"height": round((hi.y - lo.y) * k, 4), "slots": slots}, open(OUT, "w"), indent=1)
print("SLOTS", len(slots), "height", round((hi.y - lo.y) * k, 3))
for s in slots:
    print("SLOTS", s)
