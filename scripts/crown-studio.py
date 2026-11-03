"""Render a crown GLB the way the concept sheets were lit, to check it side by side with its concept.

Run: blender -b -P scripts/crown-studio.py -- <in.glb> <out_prefix>
Writes <out_prefix>-front.png (eye level) and <out_prefix>-34.png (30 degrees above), 1600x1100, on the concept's
grey (#8A8F98). Polished gold is a mirror: it only reads yellow when the room around it is bright, so the world is a
bright sky-to-floor gradient plus large softboxes (crown-render-glb.py's dark studio turns gold brown).
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, PRE = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
objs = [o for o in scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
mid, size = (lo + hi) / 2, max(hi - lo)

scene.render.engine = "CYCLES"
scene.cycles.samples = 160
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 16
scene.cycles.transmission_bounces = 12
scene.render.resolution_x, scene.render.resolution_y = 1600, 1100
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.2

world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
nt = world.node_tree
bg = nt.nodes["Background"]
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
ramp = nt.nodes.new("ShaderNodeValToRGB")
nt.links.new(tc.outputs["Generated"], sep.inputs[0])
nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
ramp.color_ramp.elements[0].position = 0.0
ramp.color_ramp.elements[0].color = (0.015, 0.012, 0.01, 1)   # a dark floor and a dark line under the horizon: gold needs dark to reflect too
e = ramp.color_ramp.elements.new(0.42); e.color = (0.04, 0.035, 0.03, 1)
e2 = ramp.color_ramp.elements.new(0.5); e2.color = (0.55, 0.5, 0.44, 1)   # a warm bright horizon: the walls facing the camera read yellow
e3 = ramp.color_ramp.elements.new(0.66); e3.color = (0.62, 0.6, 0.57, 1)
ramp.color_ramp.elements[1].position = 1.0
ramp.color_ramp.elements[1].color = (1.0, 0.98, 0.95, 1)
nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.4
# the camera sees the concept's flat grey; the gold sees the bright room
lp = nt.nodes.new("ShaderNodeLightPath")
grey = nt.nodes.new("ShaderNodeBackground"); grey.inputs["Color"].default_value = (0.25, 0.27, 0.30, 1)
mix = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
nt.links.new(bg.outputs[0], mix.inputs[1]); nt.links.new(grey.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], nt.nodes["World Output"].inputs[0])

for name, energy, off, sz, col in (("top", 900, (0, 0, 2.2), 2.4, (1, 0.97, 0.92)), ("key", 650, (1.6, -1.8, 1.0), 1.6, (1, 0.95, 0.88)),
                                   ("left", 420, (-2.0, -1.2, 0.6), 1.4, (0.95, 0.97, 1.0)), ("back", 380, (0, 2.2, 0.9), 1.8, (1, 1, 1))):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy * (size / 2.2) ** 2, size * sz, col
    ob = bpy.data.objects.new(name, ld)
    ob.location = mid + Vector(off) * size
    ob.rotation_euler = (mid - ob.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(ob)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 85
scene.collection.objects.link(cam)
scene.camera = cam
for tag, el in (("front", 3), ("34", 30)):
    e_ = math.radians(el)
    cam.location = mid + Vector((0, -math.cos(e_), math.sin(e_))) * size * 3.9
    cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{PRE}-{tag}.png"
    bpy.ops.render.render(write_still=True)
    print("STUDIO", scene.render.filepath)
