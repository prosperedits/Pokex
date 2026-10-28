"""Render any crown GLB with its own materials in the same studio as scripts/crown-variants.py, for side-by-side picks.

Run: blender -b -P scripts/crown-render-glb.py -- <in.glb> <out.png> [azimuth_deg]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
AZ = math.radians(float(argv[2])) if len(argv) > 2 else math.radians(-24)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
objs = [o for o in scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
mid, size = (lo + hi) / 2, max(hi - lo)
scene.render.engine = "CYCLES"
scene.cycles.samples = 80
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 1100
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Punchy"
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(os.path.dirname(bpy.app.binary_path), "4.3", "datafiles", "studiolights", "world", "studio.exr"))
world.node_tree.nodes["Background"].inputs[1].default_value = 2.6
world.node_tree.links.new(env.outputs[0], world.node_tree.nodes["Background"].inputs[0])
for name, energy, off, col in (("key", 2600, (1.2, -1.0, 1.4), (1.0, 0.93, 0.82)), ("rim", 2000, (-1.3, 1.2, 1.0), (0.75, 0.85, 1.0)), ("fill", 900, (-1.2, -1.3, 0.35), (1.0, 0.96, 0.92))):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy * (size / 5) ** 2, size * 0.9, col
    lo_ = bpy.data.objects.new(name, ld)
    lo_.location = mid + Vector(off) * size * 1.4
    lo_.rotation_euler = (mid - lo_.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(lo_)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 60
scene.collection.objects.link(cam)
scene.camera = cam
el = math.radians(19)
cam.location = mid + Vector((math.sin(AZ) * math.cos(el), -math.cos(AZ) * math.cos(el), math.sin(el))) * size * 2.55
cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
