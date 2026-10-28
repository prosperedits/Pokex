"""Find the black band on a Meshy crown (one textured mesh) and, optionally, make it taller so cards fit on it.

Run: blender -b -P scripts/crown-band.py -- <in.glb> [<out.glb> <scale> [top_scale]]
Dark, outward-facing texels near the outer radius are the band. With <scale>, every vertex inside the band's
height is stretched by it and everything above moves up, so the rims, points and stones keep their shape.
Prints the band in crown3d.js units (footprint 1.75, base at y 0): y0, y1, radius.
"""
import math
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC = argv[0]
OUT = argv[1] if len(argv) > 1 else None
S = float(argv[2]) if len(argv) > 2 else 1.0
TOP = float(argv[3]) if len(argv) > 3 else 1.0   # squash everything above the band: shorter points, a wider-looking crown (P)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in objs:
    o.data.transform(o.matrix_world)
    o.matrix_world.identity()


def foot():
    zs = [v.co.z for o in objs for v in o.data.vertices]
    rs = [math.hypot(v.co.x, v.co.y) for o in objs for v in o.data.vertices]
    return min(zs), max(zs), max(rs)


z0, z1, rmax = foot()
hits = []
for o in objs:   # a cleaned crown (scripts/crown-clean.py) names its band material: use it directly
    me = o.data
    bi = [i for i, m in enumerate(me.materials) if m and "band" in m.name.lower()]
    if bi:
        for p in me.polygons:
            c = p.center
            rad = math.hypot(c.x, c.y)
            if p.material_index in bi and (p.normal.x * c.x + p.normal.y * c.y) / max(rad, 1e-6) > 0.6:
                hits.append((c.z, rad, p.area))
        continue
    img = next((n.image for s in o.material_slots if s.material and s.material.use_nodes for n in s.material.node_tree.nodes
                if n.type == "TEX_IMAGE" and n.image and "base" in (n.image.name + n.label).lower()), None)
    if img is None:
        img = next((n.image for s in o.material_slots if s.material and s.material.use_nodes for n in s.material.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
    if img is None:   # untextured parts (the cut gems) carry no band
        continue
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    uv = me.uv_layers.active.data
    for p in me.polygons:
        u = sum(uv[i].uv.x for i in p.loop_indices) / p.loop_total
        v = sum(uv[i].uv.y for i in p.loop_indices) / p.loop_total
        r, g, b, _ = px[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))]
        c = p.center
        rad = math.hypot(c.x, c.y)
        if max(r, g, b) < 0.16 and rad > rmax * 0.8 and (p.normal.x * c.x + p.normal.y * c.y) / max(rad, 1e-6) > 0.6:
            hits.append((c.z, rad, p.area))
zs = np.array([h[0] for h in hits])
ws = np.array([h[2] for h in hits])
order = np.argsort(zs)
cum = np.cumsum(ws[order]) / ws.sum()
b0, b1 = zs[order][np.searchsorted(cum, 0.03)], zs[order][np.searchsorted(cum, 0.97)]
brad = float(np.average([h[1] for h in hits], weights=ws))
k = 1.75 / (2 * rmax)
print("BAND model z", round(b0, 4), round(b1, 4), "of", round(z0, 4), round(z1, 4), "radius", round(brad, 4), "rmax", round(rmax, 4))
if OUT:
    D = (b1 - b0) * (S - 1)
    for o in objs:
        for v in o.data.vertices:
            if v.co.z > b1:
                v.co.z += D
            elif v.co.z > b0:
                v.co.z = b0 + (v.co.z - b0) * S
    b1 += D
    z1 += D
    if TOP != 1.0:
        for o in objs:
            for v in o.data.vertices:
                if v.co.z > b1:
                    v.co.z = b1 + (v.co.z - b1) * TOP
        z1 = b1 + (z1 - b1) * TOP
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="WEBP", export_image_quality=88)
    print("BAND wrote", OUT)
print("BAND crown3d y0", round((b0 - z0) * k, 4), "y1", round((b1 - z0) * k, 4), "centre frac", round(((b0 + b1) / 2 - z0) / (z1 - z0), 4),
      "radius", round(brad * k, 4), "rims radius", round(rmax * k, 4), "height", round((z1 - z0) * k, 4))
