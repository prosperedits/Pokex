"""Make a Meshy crown perfectly symmetric from its best point (P: "not all the points are even... some don't have a ball").

Run: blender -b -P scripts/crown-symmetrize.py -- <in.glb> <out.glb> [points] [pick_deg]
Finds the points from the angular profile of the top edge, takes the tallest one (the one with a full ball),
keeps the half-segment from its centre line to the next valley, mirrors it into a whole segment, then
repeats that segment round the crown. Mirror-then-rotate makes neighbouring seams the same cross-section,
so they weld exactly. Texture and UVs ride along, so every point, ball and stone is identical.
"""
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
NPTS = int(argv[2]) if len(argv) > 2 else 0
PICK = float(argv[3]) if len(argv) > 3 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
ob.data.transform(ob.matrix_world)
ob.matrix_world.identity()
me = ob.data
V = np.array([v.co[:] for v in me.vertices])
# the axis: centre of the bottom rim ring
zmin, zmax = V[:, 2].min(), V[:, 2].max()
low = V[V[:, 2] < zmin + (zmax - zmin) * 0.08]
cx, cy = (low[:, 0].max() + low[:, 0].min()) / 2, (low[:, 1].max() + low[:, 1].min()) / 2
me.transform(Matrix.Translation((-cx, -cy, 0)))
V = np.array([v.co[:] for v in me.vertices])
ang = np.degrees(np.arctan2(V[:, 1], V[:, 0])) % 360
# top-edge profile: highest vertex per degree
prof = np.full(360, -np.inf)
for a, z in zip(ang.astype(int), V[:, 2]):
    if z > prof[a]:
        prof[a] = z
prof[np.isinf(prof)] = zmin
sm = np.convolve(np.concatenate([prof[-3:], prof, prof[:3]]), np.ones(7) / 7, mode="valid")
top = zmin + (zmax - zmin) * 0.7
peaks = [i for i in range(360) if sm[i] >= sm[i - 1] and sm[i] >= sm[(i + 1) % 360] and sm[i] > top]
merged = []
for p in peaks:
    if merged and p - merged[-1] < 12:
        if sm[p] > sm[merged[-1]]:
            merged[-1] = p
        continue
    merged.append(p)
if len(merged) > 1 and merged[0] + 360 - merged[-1] < 12:
    merged.pop() if sm[merged[-1]] < sm[merged[0]] else merged.pop(0)
N = NPTS or len(merged)
print("SYM peaks", merged, "heights", [round(float(sm[p]), 3) for p in merged], "N", N)
phi = PICK if PICK is not None else float(max(merged, key=lambda p: sm[p]))
half = 180.0 / N
print("SYM picked point at", phi, "deg; segment", 2 * half, "deg")

bm = bmesh.new()
bm.from_mesh(me)
# rotate so the picked point sits on +X, then keep 0..half (one side of its centre line)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-phi), 3, "Z"))
n0 = Vector((0, 1, 0))                                                   # plane through the point's centre line (y = 0)
n1 = Vector((-math.sin(math.radians(half)), math.cos(math.radians(half)), 0))   # plane at +half
geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=-n0, clear_outer=True)   # keep y >= 0
geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=n1, clear_outer=True)    # keep the side toward 0
# mirror the half across y = 0 into a whole, symmetric segment
dup = bmesh.ops.duplicate(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:])
dverts = [g for g in dup["geom"] if isinstance(g, bmesh.types.BMVert)]
dfaces = [g for g in dup["geom"] if isinstance(g, bmesh.types.BMFace)]
for v in dverts:
    v.co.y = -v.co.y
bmesh.ops.reverse_faces(bm, faces=dfaces)
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
# repeat the segment round the crown
seg = bm.verts[:] + bm.edges[:] + bm.faces[:]
for k in range(1, N):
    d = bmesh.ops.duplicate(bm, geom=seg)
    bmesh.ops.rotate(bm, verts=[g for g in d["geom"] if isinstance(g, bmesh.types.BMVert)], cent=(0, 0, 0),
                     matrix=Matrix.Rotation(math.radians(2 * half * k), 3, "Z"))
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
bm.normal_update()
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = True
print("SYM verts", len(me.vertices), "faces", len(me.polygons))
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="WEBP", export_image_quality=90)
print("SYM wrote", OUT)
