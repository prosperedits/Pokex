"""Slim a Meshy crown GLB for the web and render preview stills.

Run: blender -b -P scripts/crown-web.py -- <in.glb> <out.glb> <preview_dir> [target_tris] [tex_px]
Decimates to target_tris, downsizes textures to tex_px, exports a GLB with WebP
textures (three.js r147 GLTFLoader reads them), then renders three Cycles views.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST, PREV = argv[0], argv[1], argv[2]
TARGET = int(argv[3]) if len(argv) > 3 else 160000
TEX = int(argv[4]) if len(argv) > 4 else 2048
os.makedirs(PREV, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in scene.objects if o.type == "MESH"]

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
print("CROWN source tris", tris)
for o in meshes:
    if len(o.data.polygons) < 5000:   # small hand-made parts (the cut gems) keep every facet
        continue
    ratio = min(1.0, TARGET / max(tris, 1))
    if ratio < 1.0:
        m = o.modifiers.new("dec", "DECIMATE")
        m.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier="dec")
tris2 = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
print("CROWN web tris", tris2)

for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)

bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_image_format="WEBP",
                          export_image_quality=88, use_selection=False)
print("CROWN wrote", DST, os.path.getsize(DST))

# --- preview: frame the crown, studio light, three angles --------------------
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
mid, size = (lo + hi) / 2, max(hi - lo)

world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(os.path.dirname(bpy.app.binary_path), "4.3", "datafiles",
                                              "studiolights", "world", "studio.exr"))
bg = world.node_tree.nodes["Background"]; bg.inputs[1].default_value = 1.1
world.node_tree.links.new(env.outputs[0], bg.inputs[0])
scene.render.film_transparent = True

for name, energy, loc in (("key", 900, (1.2, -1.4, 1.6)), ("rim", 700, (-1.5, 1.2, 1.2)), ("fill", 250, (-1.6, -1.2, 0.4))):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy * size * size; ld.size = size
    lo_ = bpy.data.objects.new(name, ld); scene.collection.objects.link(lo_)
    lo_.location = mid + Vector(loc) * size * 1.6
    lo_.rotation_euler = (mid - lo_.location).to_track_quat("-Z", "Y").to_euler()

cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 70
cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
scene.render.engine = "CYCLES"; scene.cycles.samples = 96; scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 900
scene.view_settings.view_transform = "AgX"
for i, (az, el) in enumerate(((-35, 14), (0, 4), (60, 24))):
    r = size * 2.6
    a, e = math.radians(az), math.radians(el)
    cam.location = mid + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * r
    cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(PREV, f"view{i}.png")
    bpy.ops.render.render(write_still=True)
print("CROWN previews in", PREV)
