"""Faisal's June crown (assets/crown.glb), edited so trading cards fit round its band.

Run: blender -b -P scripts/crown-june-cards.py -- <in.glb> <out.glb> <slots.json> <preview_dir> [cards]
The June model is posed tilted; this stands it upright (the black band's own axis), removes the
silver studs, makes the black band tall enough for a card (the top rim, the points and the gems move
up, the band stretches between the rims), and adds a gold frame per card all the way round. Writes the
GLB, the card windows in crown3d.js units ({a, y, h, w, r} each, plus backInset) and Cycles stills.
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_GLB, OUT_JSON, PREV = argv[:4]
N = int(argv[4]) if len(argv) > 4 else 12
os.makedirs(PREV, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = {o.name: o for o in scene.objects if o.type == "MESH"}
for o in meshes.values():                       # bake every transform into the vertices
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
band, rims, body, studs = meshes["Torus.010"], meshes["Torus.009"], meshes["Circle.016"], meshes["Sphere.011"]
gems = [meshes[n] for n in meshes if n.startswith("Cube.")]

# ---- stand it upright: the band's axis is its smallest principal direction ----
P = np.array([v.co[:] for v in band.data.vertices])
c = P.mean(0)
axis = np.linalg.svd(P - c)[2][2]
bc = np.array([v.co[:] for v in body.data.vertices]).mean(0)
if np.dot(axis, bc - c) < 0:
    axis = -axis                                # points up, toward the crown's points
M = Vector(axis).rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4() @ Matrix.Translation(-Vector(c))
for o in meshes.values():
    o.data.transform(M)


def zr(o):
    zs = [v.co.z for v in o.data.vertices]
    return min(zs), max(zs)


def rr(o):
    return max(Vector((v.co.x, v.co.y)).length for v in o.data.vertices)


bz0, bz1 = zr(band)
RB = rr(band)                                   # the band's outer radius
print("JUNE band z", round(bz0, 3), round(bz1, 3), "r", round(RB, 3), "rims z", [round(x, 3) for x in zr(rims)], "body z", [round(x, 3) for x in zr(body)])

# ---- the band grows to hold a card: everything above it moves up, the band stretches ----
CW = 2 * RB * math.sin(math.pi / N) * 0.80      # card width: N cards round the band with gold between
CH = CW / 0.716                                 # a real card's height (63 x 88 mm)
need = CH * 1.16                                # card + frame + a little black above and below
hb = bz1 - bz0
D = max(0.0, need - hb)
mid = (bz0 + bz1) / 2
for v in band.data.vertices:
    v.co.z = bz0 + (v.co.z - bz0) * (hb + D) / hb
for v in rims.data.vertices:
    if v.co.z > mid:
        v.co.z += D
for o in [body] + gems:
    for v in o.data.vertices:
        v.co.z += D
bpy.data.objects.remove(studs)                  # the silver studs give way to the cards
bz1 += D
ZC = (bz0 + bz1) / 2
print("JUNE card", round(CW, 3), "x", round(CH, 3), "band grew by", round(D, 3))

# ---- a gold frame per card, flat, tangent to the band ----
GOLD = body.data.materials[0]


def frame_bm(w, h, t, d, y):
    """a rectangular frame of bar width t and depth d, its back at radius y (outward = +y)"""
    bm = bmesh.new()
    for (cx, cz, sx, sz) in ((0, h / 2 + t / 2, w + 2 * t, t), (0, -h / 2 - t / 2, w + 2 * t, t), (-w / 2 - t / 2, 0, t, h), (w / 2 + t / 2, 0, t, h)):
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        for v in tmp.verts:
            v.co = Vector((cx + v.co.x * sx, y + 0.03 - d / 2 + v.co.y * d, ZC + cz + v.co.z * sz))   # front 0.03 proud of the card
        me = bpy.data.meshes.new("t")
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    return bm


# the band is a round tube, widest at its middle: each card's flat back sits just in front of that bulge,
# and its frame reaches back past the curve so no gap shows at the card's edges
SAG = RB - math.sqrt(RB * RB - (CW / 2) ** 2)
YB = RB + 0.015
T, DEP = CW * 0.075, 0.09 + SAG
frames = []
for i in range(N):
    phi = 2 * math.pi * i / N
    bm = frame_bm(CW, CH, T, DEP, YB)
    me = bpy.data.meshes.new(f"frame{i}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"frame{i}", me)
    scene.collection.objects.link(o)
    me.materials.append(GOLD)
    bev = o.modifiers.new("bevel", "BEVEL")
    bev.width, bev.segments, bev.limit_method, bev.harden_normals = T * 0.32, 3, "ANGLE", True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="bevel")
    o.rotation_euler = (0, 0, phi - math.pi / 2)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    for p in me.polygons:
        p.use_smooth = True
    frames.append(o)
bpy.ops.object.select_all(action="DESELECT")
for o in frames:
    o.select_set(True)
bpy.context.view_layer.objects.active = frames[0]
bpy.ops.object.join()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))

bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", export_apply=True, use_selection=False, export_image_format="WEBP")
print("JUNE wrote", OUT_GLB, os.path.getsize(OUT_GLB))


# ---- the card windows in crown3d.js units (glTF Y-up, footprint 1.75, base at y = 0) ----
def gl(v):
    return Vector((v.x, v.z, -v.y))


pts = [gl(o.matrix_world @ Vector(cc)) for o in scene.objects if o.type == "MESH" for cc in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
mc = (lo + hi) / 2
k = 1.75 / max(hi.x - lo.x, hi.z - lo.z)
slots = []
for i in range(N):
    phi = 2 * math.pi * i / N
    p = gl(Vector((YB * math.cos(phi), YB * math.sin(phi), ZC)))
    x, z = (p.x - mc.x) * k, (p.z - mc.z) * k
    slots.append({"a": round(math.atan2(x, z), 5), "y": round((p.y - lo.y) * k, 5), "h": round(CH * k, 5), "w": round(CW * k, 5), "r": round(math.hypot(x, z), 5)})
json.dump({"height": round((hi.y - lo.y) * k, 4), "backInset": round(0.05 * k, 4), "slots": slots}, open(OUT_JSON, "w"), indent=1)
print("JUNE slots", N, "k", round(k, 4))

# ---- stills on transparent ----
scene.render.engine = "CYCLES"
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 1400, 1000
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(os.path.dirname(bpy.app.binary_path), "4.3", "datafiles", "studiolights", "world", "studio.exr"))
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
world.node_tree.links.new(env.outputs[0], world.node_tree.nodes["Background"].inputs[0])
size = max(hi.x - lo.x, hi.z - lo.z)
target = Vector((0, 0, (bz0 + zr(body)[1]) / 2))
for name, energy, loc, col in (("key", 900, (6, -4, 7), (1.0, 0.93, 0.8)), ("rim", 800, (-6, 5, 5), (0.7, 0.82, 1.0)), ("fill", 250, (5, 6, 2), (1.0, 0.95, 0.9))):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy, 4.5, col
    lo_ = bpy.data.objects.new(name, ld)
    lo_.location = loc
    lo_.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(lo_)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 58
scene.collection.objects.link(cam)
scene.camera = cam
for idx, (az, el) in enumerate(((0.0, 0.32), (math.pi / N, 0.32), (-0.5, 0.7))):
    dist = size * 2.6
    cam.location = target + Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el))) * dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(PREV, f"view{idx}.png")
    bpy.ops.render.render(write_still=True)
print("JUNE previews", PREV)
