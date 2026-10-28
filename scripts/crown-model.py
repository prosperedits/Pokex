"""The Crowns crown, modelled (not image-to-3D): ten gold tablets round a decagon, each with a card-sized
window, a prong and a cut sapphire; dividers with white diamonds; a base lip. Built from
docs/design/crown/arcade-35.png after Faisal rejected the Meshy mesh (27 Oct: "the worst 3d crown").

Run: blender -b -P scripts/crown-model.py -- <out.glb> <slots.json> <preview_dir>
Writes the GLB, the card windows in crown3d.js units ({a, y, h, w, r} per window, plus backInset),
and three Cycles stills of the bare crown on navy.
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_JSON, PREV = argv[0], argv[1], argv[2]
os.makedirs(PREV, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

N = 10                           # tablets (one card window each)
A = 1.0                          # apothem: centre to a tablet's outer face
TW, TH, TD = 0.58, 0.80, 0.14    # tablet width, height, depth
WW, WH, WD = 0.385, 0.537, 0.04  # window = one card (63 x 88 mm aspect), recess depth
BASE_H = 0.11
Z0 = BASE_H * 0.5                # tablets stand on the lip
WZ = Z0 + 0.10 + WH / 2          # window centre height
STEP = 2 * math.pi / N


def mat(name, color, metal, rough, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if emit:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = strength
    return m


GOLD = mat("gold", (1.0, 0.56, 0.10), 1.0, 0.24)                 # saturated arcade gold
SAPPHIRE = mat("sapphire", (0.015, 0.09, 0.9), 0.0, 0.04, (0.01, 0.06, 0.55), 0.6)
DIAMOND = mat("diamond", (0.86, 0.92, 1.0), 0.0, 0.03, (0.55, 0.65, 0.85), 0.18)
RECESS = mat("recess", (0.012, 0.012, 0.02), 0.2, 0.5)         # behind the card; never seen with a card in it


def link(name, bm, m, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    me.materials.append(m)
    for f in me.polygons:
        f.use_smooth = smooth
    return o


def box_bm(cx, cy, cz, sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz))
    return bm


def bevel(o, width, segs=3, angle=0.55):
    md = o.modifiers.new("bevel", "BEVEL")
    md.width, md.segments, md.limit_method, md.angle_limit = width, segs, "ANGLE", angle
    md.harden_normals = True
    return md


def apply_all(o):
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def taper(name, w0, w1, d, z0, h, yface, m):
    """a prong neck: a box that narrows from w0 at z0 to w1 at z0 + h, its front at yface"""
    bm = bmesh.new()
    y0, y1 = yface - d, yface
    vs = [bm.verts.new((x, y, z)) for (w, z) in ((w0, z0), (w1, z0 + h)) for (x, y) in ((-w / 2, y0), (w / 2, y0), (w / 2, y1), (-w / 2, y1))]
    b, t = vs[:4], vs[4:]
    bm.faces.new(b[::-1])
    bm.faces.new(t)
    for k in range(4):
        bm.faces.new((b[k], b[(k + 1) % 4], t[(k + 1) % 4], t[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link(name, bm, m)


def prism(name, n, r, depth, cz, yface, m, stretch=1.0, ang0=math.pi / 2):
    """a bezel: an n-sided plate facing outward (+y), front at yface"""
    bm = bmesh.new()
    rings = []
    for y in (yface - depth, yface):
        rings.append([bm.verts.new((r * math.cos(ang0 + 2 * math.pi * k / n), y, cz + r * stretch * math.sin(ang0 + 2 * math.pi * k / n))) for k in range(n)])
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[1])
    for k in range(n):
        bm.faces.new((rings[0][k], rings[0][(k + 1) % n], rings[1][(k + 1) % n], rings[1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link(name, bm, m)


def gem(name, n, r, cz, yface, m, stretch=1.0):
    """a cut stone facing outward: girdle at yface, table proud of it, culet sunk behind"""
    bm = bmesh.new()
    a0 = math.pi / 2
    g = [bm.verts.new((r * math.cos(a0 + 2 * math.pi * k / n), yface, cz + r * stretch * math.sin(a0 + 2 * math.pi * k / n))) for k in range(n)]
    t = [bm.verts.new((0.56 * r * math.cos(a0 + 2 * math.pi * (k + 0.5) / n), yface + 0.36 * r, cz + 0.56 * r * stretch * math.sin(a0 + 2 * math.pi * (k + 0.5) / n))) for k in range(n)]
    c = bm.verts.new((0, yface - 0.45 * r, cz))
    bm.faces.new(t)
    for k in range(n):
        bm.faces.new((g[k], g[(k + 1) % n], t[k]))
        bm.faces.new((t[k], g[(k + 1) % n], t[(k + 1) % n]))
        bm.faces.new((g[(k + 1) % n], g[k], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link(name, bm, m, smooth=False)   # facets stay crisp


def place(objs, phi):
    """parts are built facing +y; turn them to face angle phi (radians, about z)"""
    for o in objs:
        o.rotation_euler = (0, 0, phi - math.pi / 2)


gold_parts, others = [], []
for i in range(N):
    phi = i * STEP
    parts = []
    # the tablet, with the card window sunk into its face
    t = link(f"tablet{i}", box_bm(0, A - TD / 2, Z0 + TH / 2, TW, TD, TH), GOLD)
    # a raised frame round the window (the concept's thick rounded border)
    fr = link(f"frame{i}", box_bm(0, A + 0.012, WZ, WW + 0.09, 0.05, WH + 0.09), GOLD)
    un = t.modifiers.new("frame", "BOOLEAN")
    un.operation, un.object, un.solver = "UNION", fr, "EXACT"
    apply_all(t)
    bpy.data.objects.remove(fr)
    cut = link(f"cut{i}", box_bm(0, A + 0.04, WZ, WW, WD * 2 + 0.08, WH), RECESS)
    bo = t.modifiers.new("win", "BOOLEAN")
    bo.operation, bo.object, bo.solver = "DIFFERENCE", cut, "EXACT"
    bo.material_mode = "TRANSFER"
    apply_all(t)
    bpy.data.objects.remove(cut)
    bevel(t, 0.045, 5)
    apply_all(t)
    parts.append(t)
    # the prong: tall and short in turn, a hexagonal bezel, a sapphire
    tall = i % 2 == 0
    nh = 0.24 if tall else 0.13
    top = Z0 + TH
    # the prong: the tablet's top flares up into a narrow tab (concave sides, the tablet's own depth), like the concept
    prof = []
    for k in range(9):
        tt = k / 8
        prof.append((-(0.06 + 0.15 * (1 - tt) ** 2.2), top - 0.03 + (nh + 0.05) * tt))
    prof += [(-x, z) for (x, z) in reversed(prof)]
    bm = bmesh.new()
    front = [bm.verts.new((x, A, z)) for (x, z) in prof]
    face = bm.faces.new(front)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.y -= TD
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    neck = link(f"neck{i}", bm, GOLD)
    bevel(neck, 0.03, 4, angle=0.9)
    apply_all(neck)
    rb = 0.16 if tall else 0.14
    bz = top + nh + rb * 0.82
    bez = prism(f"bezel{i}", 6, rb, 0.12, bz, A + 0.005, GOLD)
    bevel(bez, 0.03, 4)
    apply_all(bez)
    parts += [neck, bez]
    sap = gem(f"sapphire{i}", 6, rb * 0.76, bz, A + 0.012, SAPPHIRE)
    place(parts + [sap], phi)
    gold_parts += parts
    others.append(sap)

    # the divider between this tablet and the next: a slim post with a white diamond
    dphi = phi + STEP / 2
    rc = A / math.cos(STEP / 2) - 0.035
    post = link(f"post{i}", box_bm(0, rc - 0.05, Z0 + TH * 0.42, 0.12, 0.1, TH * 0.84), GOLD)
    bevel(post, 0.03, 4)
    apply_all(post)
    dz = Z0 + 0.27
    dbez = prism(f"dbezel{i}", 4, 0.08, 0.06, dz, rc + 0.016, GOLD, stretch=1.6)
    bevel(dbez, 0.014, 3)
    apply_all(dbez)
    dia = gem(f"diamond{i}", 4, 0.06, dz, rc + 0.02, DIAMOND, stretch=1.6)
    place([post, dbez, dia], dphi)
    gold_parts += [post, dbez]
    others.append(dia)

# the base lip: a decagonal ring the tablets stand on
bpy.ops.mesh.primitive_cylinder_add(vertices=N, radius=(A + 0.035) / math.cos(STEP / 2), depth=BASE_H, end_fill_type="NOTHING", location=(0, 0, BASE_H / 2))
lip = bpy.context.object
lip.rotation_euler = (0, 0, STEP / 2)
lip.data.materials.append(GOLD)
so = lip.modifiers.new("solid", "SOLIDIFY")
so.thickness, so.offset = 0.16, -1
apply_all(lip)
bevel(lip, 0.04, 5)
apply_all(lip)
for f in lip.data.polygons:
    f.use_smooth = True
gold_parts.append(lip)

# one gold mesh, smooth by angle (crisp bevel edges, soft faces)
bpy.ops.object.select_all(action="DESELECT")
for o in gold_parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = lip
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
bpy.ops.object.join()
crown = bpy.context.object
crown.name = "crown_gold"
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
for o in others:
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", export_apply=True, use_selection=False)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in scene.objects if o.type == "MESH")
print("CROWN wrote", OUT_GLB, os.path.getsize(OUT_GLB), "tris", tris)


# ---- the card windows in crown3d.js units (glTF Y-up, footprint 1.75, base at y = 0) ----
def gl(v):
    return Vector((v.x, v.z, -v.y))


pts = [gl(o.matrix_world @ Vector(c)) for o in scene.objects if o.type == "MESH" for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
mid = (lo + hi) / 2
k = 1.75 / max(hi.x - lo.x, hi.z - lo.z)
slots = []
for i in range(N):
    phi = i * STEP
    c = gl(Vector(((A - WD) * math.cos(phi), (A - WD) * math.sin(phi), WZ)))
    x, z = (c.x - mid.x) * k, (c.z - mid.z) * k
    slots.append({"a": round(math.atan2(x, z), 5), "y": round((c.y - lo.y) * k, 5), "h": round(WH * k, 5), "w": round(WW * k, 5), "r": round(math.hypot(x, z), 5)})
json.dump({"height": round((hi.y - lo.y) * k, 4), "backInset": round((TD - WD) * k + 0.004, 4), "slots": slots}, open(OUT_JSON, "w"), indent=1)
print("CROWN slots", len(slots), "k", round(k, 4))

# ---- stills: studio light on transparent, composited on navy later ----
scene.render.engine = "CYCLES"
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 1400, 1000
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(os.path.dirname(bpy.app.binary_path), "4.3", "datafiles", "studiolights", "world", "studio.exr"))
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
world.node_tree.links.new(env.outputs[0], world.node_tree.nodes["Background"].inputs[0])
for name, energy, loc, col in (("key", 420, (3.4, -2.2, 3.6), (1.0, 0.93, 0.8)), ("rim", 380, (-3.0, 2.6, 2.4), (0.7, 0.82, 1.0)), ("fill", 120, (2.6, 3.2, 0.9), (1.0, 0.95, 0.9))):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy, 2.4, col
    lo_ = bpy.data.objects.new(name, ld)
    lo_.location = loc
    lo_.rotation_euler = (Vector((0, 0, 0.5)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(lo_)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 58
scene.collection.objects.link(cam)
scene.camera = cam
for idx, (az, el, dist) in enumerate(((0.0, 0.42, 5.4), (math.radians(18), 0.42, 5.4), (math.radians(-30), 0.85, 5.2))):
    target = Vector((0, 0, 0.62))
    cam.location = target + Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el))) * dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(PREV, f"view{idx}.png")
    bpy.ops.render.render(write_still=True)
print("CROWN previews", PREV)
