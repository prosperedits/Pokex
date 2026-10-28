"""Ten retextures of Faisal's June crown, rendered in Cycles: same mesh, different metal, stones and band.

Run: blender -b -P scripts/crown-variants.py -- <crown.glb> <out_dir> [only_index]
<crown.glb> is the upright June crown without studs (scripts/crown-june-upright.py --no-studs).
Writes <out_dir>/vNN.png (transparent) for each look; scripts compose the contact sheet.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
ONLY = int(argv[2]) if len(argv) > 2 else None
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)   # first: materials made after this survive


def principled(name, base, metal=0.0, rough=0.3, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*base, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        if k == "bump":   # hammered / brushed surface
            tex = nt.nodes.new("ShaderNodeTexVoronoi" if v[0] == "voronoi" else "ShaderNodeTexNoise")
            tex.inputs["Scale"].default_value = v[1]
            bump = nt.nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = v[2]
            nt.links.new(tex.outputs["Distance" if v[0] == "voronoi" else "Fac"], bump.inputs["Height"])
            nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
            continue
        name_ = {"transmission": "Transmission Weight", "ior": "IOR", "coat": "Coat Weight", "sheen": "Sheen Weight",
                 "sheen_tint": "Sheen Tint", "film": "Thin Film Thickness", "film_ior": "Thin Film IOR",
                 "emit": "Emission Color", "emit_s": "Emission Strength", "aniso": "Anisotropic"}[k]
        val = (*v, 1) if isinstance(v, tuple) else v
        p.inputs[name_].default_value = val
    return m


def gem(name, color, ior=1.77, film=0.0):
    return principled(name, color, 0.0, 0.0, transmission=1.0, ior=ior, **({"film": film, "film_ior": 1.45} if film else {}))


# (gold parts, band, stones) per look
LOOKS = [
    ("Polished gold, cut sapphires, black velvet", principled("g1", (1.0, 0.72, 0.26), 1, 0.16), principled("b1", (0.01, 0.01, 0.014), 0, 0.9, sheen=0.6, sheen_tint=(0.25, 0.25, 0.35)), gem("s1", (0.05, 0.22, 1.0))),
    ("Rose gold, pink diamonds, ivory enamel", principled("g2", (0.96, 0.62, 0.5), 1, 0.18), principled("b2", (0.86, 0.82, 0.74), 0, 0.25, coat=1.0), gem("s2", (1.0, 0.45, 0.7), 2.42)),
    ("Platinum, diamonds, midnight velvet", principled("g3", (0.86, 0.87, 0.9), 1, 0.12), principled("b3", (0.01, 0.015, 0.05), 0, 0.9, sheen=0.8, sheen_tint=(0.3, 0.4, 0.9)), gem("s3", (0.96, 0.98, 1.0), 2.42)),
    ("Antique gold, rubies, crimson velvet", principled("g4", (0.78, 0.55, 0.22), 1, 0.38, bump=("noise", 60, 0.12)), principled("b4", (0.18, 0.005, 0.02), 0, 0.85, sheen=0.7, sheen_tint=(1, 0.3, 0.35)), gem("s4", (0.95, 0.03, 0.08))),
    ("Black gold, emeralds, forest velvet", principled("g5", (0.12, 0.1, 0.08), 1, 0.2), principled("b5", (0.005, 0.05, 0.02), 0, 0.85, sheen=0.7, sheen_tint=(0.3, 1, 0.5)), gem("s5", (0.02, 0.8, 0.3), 1.58)),
    ("Mirror chrome, opal stones, black lacquer", principled("g6", (0.95, 0.95, 0.97), 1, 0.04), principled("b6", (0.005, 0.005, 0.006), 0, 0.08, coat=1.0), gem("s6", (0.85, 0.9, 1.0), 1.45, film=520)),
    ("Holo foil gold, amethysts, black", principled("g7", (1.0, 0.8, 0.4), 1, 0.14, film=420, film_ior=1.6), principled("b7", (0.006, 0.006, 0.008), 0, 0.4), gem("s7", (0.55, 0.15, 1.0), 1.54)),
    ("Hammered gold, sapphires, royal blue velvet", principled("g8", (1.0, 0.7, 0.24), 1, 0.2, bump=("voronoi", 28, 0.35)), principled("b8", (0.01, 0.03, 0.2), 0, 0.85, sheen=0.8, sheen_tint=(0.4, 0.5, 1)), gem("s8", (0.05, 0.25, 1.0))),
    ("Brushed white gold, topaz, black leather", principled("g9", (0.93, 0.88, 0.78), 1, 0.3, aniso=0.8), principled("b9", (0.012, 0.01, 0.009), 0, 0.55, bump=("noise", 240, 0.08)), gem("s9", (1.0, 0.55, 0.08), 1.62)),
    ("Arcade candy gold, glowing blue crystal, gloss black", principled("g10", (1.0, 0.68, 0.12), 1, 0.1, coat=1.0), principled("b10", (0.004, 0.004, 0.006), 0, 0.05, coat=1.0), principled("s10", (0.1, 0.45, 1.0), 0, 0.0, transmission=0.6, ior=1.6, emit=(0.1, 0.4, 1.0), emit_s=1.6)),
]

scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
objs = {o.name: o for o in scene.objects if o.type == "MESH"}
gold = [o for n, o in objs.items() if n.startswith("Circle") or n.startswith("Torus.009")]
band = [o for n, o in objs.items() if n.startswith("Torus.010")]
stones = [o for n, o in objs.items() if n.startswith("Cube")]
print("VAR parts", [o.name for o in gold], [o.name for o in band], [o.name for o in stones])

pts = [o.matrix_world @ Vector(c) for o in objs.values() for c in o.bound_box]
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
world.node_tree.nodes["Background"].inputs[1].default_value = 2.6   # polished metal shows what it reflects: a bright studio, not a dim one
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
az, el = math.radians(-24), math.radians(19)
cam.location = mid + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * size * 2.55
cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()


def assign(objs_, mat):
    for o in objs_:
        o.data.materials.clear()
        o.data.materials.append(mat)
        for p in o.data.polygons:
            p.material_index = 0


for i, (label, g, b, s) in enumerate(LOOKS, 1):
    if ONLY and i != ONLY:
        continue
    assign(gold, g)
    assign(band, b)
    assign(stones, s)
    scene.render.filepath = os.path.join(OUT, f"v{i:02d}.png")
    bpy.ops.render.render(write_still=True)
    print("VAR", i, label)
