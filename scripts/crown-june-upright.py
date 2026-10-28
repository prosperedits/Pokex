"""Faisal's June crown (assets/crown.glb) as the site's crown asset: stood upright, nothing else changed.

Run: blender -b -P scripts/crown-june-upright.py -- <in.glb> <out.glb> [--no-studs] [--band <scale>]
The June model is posed tilted for the old logo; the black band's own axis (its smallest principal
direction) becomes straight up, the band is centred on the axis, and the rest is exported as it was.
The cards no longer sit on the crown (Faisal, 27 Oct: "just make them hover around it"), so the band,
studs, points and sapphires stay exactly as he made them.
"""
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = {o.name: o for o in bpy.context.scene.objects if o.type == "MESH"}
for o in meshes.values():
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
band, body = meshes["Torus.010"], meshes["Circle.016"]
P = np.array([v.co[:] for v in band.data.vertices])
c = P.mean(0)
axis = np.linalg.svd(P - c)[2][2]
if np.dot(axis, np.array([v.co[:] for v in body.data.vertices]).mean(0) - c) < 0:
    axis = -axis
M = Vector(axis).rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4() @ Matrix.Translation(-Vector(c))
for o in meshes.values():
    o.data.transform(M)
if "--no-studs" in argv:   # P, 27 Oct: "the silver dials on the crown? We need to remove those"
    bpy.data.objects.remove(meshes.pop("Sphere.011"))
if "--band" in argv:       # P: the cards clip on the gold rims; the black band grows so they fit on it
    S = float(argv[argv.index("--band") + 1])
    bz0, bz1 = min(v.co.z for v in band.data.vertices), max(v.co.z for v in band.data.vertices)
    hb, mid = bz1 - bz0, (bz0 + bz1) / 2
    D = hb * (S - 1)
    for v in band.data.vertices:
        v.co.z = bz0 + (v.co.z - bz0) * S
    for v in meshes["Torus.009"].data.vertices:   # the two gold rims: the top one rides up with everything above it
        if v.co.z > mid:
            v.co.z += D
    for name, o in meshes.items():
        if name in ("Torus.010", "Torus.009"):
            continue
        for v in o.data.vertices:
            v.co.z += D
zs = [v.co.z for o in meshes.values() for v in o.data.vertices]
bz = [v.co.z for v in band.data.vertices]
rad = lambda o: max((v.co.x ** 2 + v.co.y ** 2) ** 0.5 for v in o.data.vertices)
foot = max(rad(o) for o in meshes.values()) * 2
print("UPRIGHT radii in crown3d units: band", round(rad(band) * 1.75 / foot, 4), "rims", round(rad(meshes["Torus.009"]) * 1.75 / foot, 4))
print("UPRIGHT height", round(max(zs) - min(zs), 3), "band from", round((min(bz) - min(zs)) / (max(zs) - min(zs)), 3), "to", round((max(bz) - min(zs)) / (max(zs) - min(zs)), 3), "of the height")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, use_selection=False)
print("UPRIGHT wrote", OUT, os.path.getsize(OUT))
