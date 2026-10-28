"""Clean the symmetric Meshy crown: perfect spheres on every point, clean gold and black, the stones keep their facets.

Run: blender -b -P scripts/crown-clean.py -- <sym.glb> <out.glb> [points] [--no-balls]
P (27 Oct): "the texture is clearly not clean, and so are the edges and the bulbs... the bulbs look like butt cracks."
- Faces are sorted by their painted colour: blue = stone (keeps its painted facets, made glassy), near-black = band,
  everything else = gold. Gold and band become flat clean materials (no blotchy paint, no noisy normal map).
- Each point's ball (mirrored from Meshy's lopsided one, so it carried a crease) is cut off and replaced by a true sphere.
Expects the points at 0, 36, 72... degrees (scripts/crown-symmetrize.py puts the picked point on +X).
"""
import colorsys
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
N = int(argv[2]) if len(argv) > 2 and argv[2].isdigit() else 10
NO_BALLS = "--no-balls" in argv
MULTI = "--multi-gems" in argv   # P, 28 Oct: "The gems should be different colors on the crown"   # P, 28 Oct: "I'd prefer there not being any sort of round bits at all"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
bpy.context.view_layer.objects.active = ob
ob.data.transform(ob.matrix_world)
ob.matrix_world.identity()
me = ob.data
src_mat = me.materials[0]
img = next(n.image for n in src_mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image and "normal" not in n.image.name.lower()
           and any(l.to_socket.name == "Base Color" for l in n.outputs[0].links))
W, H = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)


def mat(name, base, metal, rough, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*base, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    return m


GOLD = mat("gold", (1.0, 0.64, 0.2), 1.0, 0.12)
BLACK = mat("band", (0.012, 0.012, 0.016), 0.0, 0.32, 0.6)
# the stones keep the painted brilliant-cut facets, lit from within a little
STONE = bpy.data.materials.new("sapphire")
STONE.use_nodes = True
nt = STONE.node_tree
bs = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
nt.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
nt.links.new(tex.outputs["Color"], bs.inputs["Emission Color"])
bs.inputs["Emission Strength"].default_value = 0.45
bs.inputs["Metallic"].default_value = 0.0
bs.inputs["Roughness"].default_value = 0.06
bs.inputs["Coat Weight"].default_value = 1.0
me.materials.clear()
for m in (GOLD, BLACK, STONE):
    me.materials.append(m)
# one stone per point, round the crown: sapphire, ruby, emerald, amethyst, topaz. The stones' painted facets become a
# grey texture (only the stones use it) and each gem multiplies it by its own colour, which glTF keeps as baseColorFactor
GEMS = [("sapphire", (0.06, 0.25, 1.0)), ("ruby", (1.0, 0.02, 0.08)), ("emerald", (0.02, 0.85, 0.3)), ("amethyst", (0.55, 0.1, 1.0)), ("topaz", (1.0, 0.5, 0.02))]
if MULTI:
    g = px[..., :3]
    lum = 0.3 * g[..., 0] + 0.59 * g[..., 1] + 0.11 * g[..., 2]
    lum = np.clip((lum - 0.1) / 0.75, 0, 1) ** 1.45   # deep stones with bright facet edges, not milky
    grey = bpy.data.images.new("gem_facets", W, H)
    grey.pixels[:] = np.dstack([lum, lum, lum, np.ones_like(lum)]).ravel().tolist()
    grey.pack()
    me.materials.pop(index=2)
    for name, col in GEMS:
        m = bpy.data.materials.new(name); m.use_nodes = True
        t = m.node_tree; bsdf = t.nodes["Principled BSDF"]
        tx = t.nodes.new("ShaderNodeTexImage"); tx.image = grey
        mix = t.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
        mix.inputs[7].default_value = (*col, 1)
        t.links.new(tx.outputs["Color"], mix.inputs[6]); t.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        bsdf.inputs["Metallic"].default_value = 0.0; bsdf.inputs["Roughness"].default_value = 0.05; bsdf.inputs["Coat Weight"].default_value = 1.0
        bsdf.inputs["Emission Color"].default_value = (*col, 1); bsdf.inputs["Emission Strength"].default_value = 0.25
        me.materials.append(m)

uv = me.uv_layers.active.data
counts = [0, 0, 0]
zs_ = [v.co.z for v in me.vertices]
zlo, zhi = min(zs_), max(zs_)
band_top = zlo + (zhi - zlo) * 0.3
for p in me.polygons:
    u = sum(uv[i].uv.x for i in p.loop_indices) / p.loop_total
    v = sum(uv[i].uv.y for i in p.loop_indices) / p.loop_total
    r, g, b, _ = px[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))]
    h, s, val = colorsys.rgb_to_hsv(float(r), float(g), float(b))
    k = 2 if (b > r * 1.6 and b > g * 1.25 and s > 0.5 and val > 0.22) else 1 if (val < 0.17 and p.center.z < band_top and (p.normal.x * p.center.x + p.normal.y * p.center.y) > 0.2 * math.hypot(p.center.x, p.center.y)) else 0   # the band's outside only: inside is gold
    if k == 2 and MULTI:   # which point this stone sits under: points every 360/N degrees from +X
        slot = int(round((math.degrees(math.atan2(p.center.y, p.center.x)) % 360) / (360 / N))) % N
        k = 2 + (slot % len(GEMS))
    p.material_index = k
    counts[min(k, 2)] += 1
print("CLEAN faces gold/band/stone", counts)

# ---- the balls: cut each lopsided one off, set a true sphere in its place (--keep-tips: a crown without balls is left alone) ----
KEEP_TIPS = "--keep-tips" in argv
V = np.array([v.co[:] for v in me.vertices])
zTop = V[:, 2].max()
ang = np.degrees(np.arctan2(V[:, 1], V[:, 0])) % 360
near0 = ((ang < 6) | (ang > 354)) & (V[:, 2] > zTop - (V[:, 2].max() - V[:, 2].min()) * 0.12)
cluster = V[near0]
# ball width across the point (tangent direction = y at angle 0) and through it (radial = x)
rb = max(cluster[:, 1].max() - cluster[:, 1].min(), 1e-4) / 2
bx = (cluster[:, 0].max() + cluster[:, 0].min()) / 2
bz = zTop - rb
print("CLEAN ball radius", round(float(rb), 4), "centre r", round(float(bx), 4), "z", round(float(bz), 4))
bm = bmesh.new()
bm.from_mesh(me)
if KEEP_TIPS:
    # Stones are picked face by face from the paint, which leaves a jagged staircase of triangles round each one
    # (P: "weird triangle-looking artifacts"). Grow each stone's region two rings into its gold setting, so the
    # stone's own painted edge (the texture, smooth at any size) draws the outline instead of the triangles.
    stone_ids = set(range(2, len(me.materials)))
    # --new-gems: Meshy paints the stones as a low-res texture (P: "the jewels are absolutely atrocious... slop").
    # Measure each stone (centre, size, facing) and set a real cut gem over it: crisp facets, flat-shaded.
    gems_out = []
    if "--new-gems" in argv:
        slots = {}
        for f in bm.faces:
            if f.material_index in stone_ids:
                c = f.calc_center_median()
                k_ = int(round((math.degrees(math.atan2(c.y, c.x)) % 360) / (360 / N))) % N
                slots.setdefault(k_, []).append(f)
        for k_, fs in sorted(slots.items()):
            area = sum(f.calc_area() for f in fs)
            if area <= 0:
                continue
            cen = sum((f.calc_center_median() * f.calc_area() for f in fs), Vector()) / area
            nrm = sum((f.normal * f.calc_area() for f in fs), Vector()).normalized()
            up = Vector((0, 0, 1)); tan = up.cross(nrm).normalized(); up = nrm.cross(tan).normalized()
            vs = {v for f in fs for v in f.verts}
            xs = [(v.co - cen).dot(tan) for v in vs]; ys = [(v.co - cen).dot(up) for v in vs]
            gems_out.append((cen, nrm, tan, up, (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2))
        print("CLEAN stones measured", len(gems_out), [(round(g[4], 3), round(g[5], 3)) for g in gems_out[:2]])
    for _ in range(2):
        grow = [lf for f in bm.faces if f.material_index in stone_ids for e in f.edges for lf in e.link_faces if lf.material_index == 0]
        for lf in grow:
            lf.material_index = 2
    # ...and repaint that texture clean: pure polished gold everywhere except the stones' own blue pixels (a soft mask),
    # with a metallic/roughness map to match, so the grown ring reads exactly like the plain gold beside it
    rgb = px[..., :3]
    mx_, mn_ = rgb.max(-1), rgb.min(-1)
    sat = (mx_ - mn_) / np.maximum(mx_, 1e-4)
    blue = np.clip(((rgb[..., 2] - np.maximum(rgb[..., 0], rgb[..., 1])) / np.maximum(mx_, 1e-4) - 0.12) / 0.25, 0, 1) * np.clip((sat - 0.25) / 0.2, 0, 1)
    gold_srgb = np.array([1.0, 0.82, 0.49])
    col = rgb * blue[..., None] + gold_srgb * (1 - blue[..., None])
    clean = bpy.data.images.new("gem_clean", W, H)
    clean.pixels[:] = np.dstack([col, np.ones_like(blue)]).ravel().tolist()
    clean.pack()
    mr = bpy.data.images.new("gem_mr", W, H)   # glTF: G = roughness, B = metallic
    mr.pixels[:] = np.dstack([np.zeros_like(blue), 0.12 * (1 - blue) + 0.04 * blue, 1 - blue, np.ones_like(blue)]).ravel().tolist()
    mr.pack()
    mr.colorspace_settings.name = "Non-Color"
    t = STONE.node_tree; bsdf = t.nodes["Principled BSDF"]
    for n in [n for n in t.nodes if n.type == "TEX_IMAGE"]:
        t.nodes.remove(n)
    tb = t.nodes.new("ShaderNodeTexImage"); tb.image = clean
    tm = t.nodes.new("ShaderNodeTexImage"); tm.image = mr
    sep = t.nodes.new("ShaderNodeSeparateColor")
    t.links.new(tb.outputs["Color"], bsdf.inputs["Base Color"])
    t.links.new(tm.outputs["Color"], sep.inputs["Color"])
    t.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"]); t.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    bsdf.inputs["Emission Strength"].default_value = 0.0
    # polish: smooth Meshy's wobble out of the gold away from the stones (the settings keep their shape)
    near = {v for f in bm.faces if f.material_index in stone_ids for v in f.verts}
    goldv = [v for v in bm.verts if v not in near and v.link_faces and all(f.material_index == 0 for f in v.link_faces)]
    for _ in range(int(next((a.split('=')[1] for a in argv if a.startswith('--polish=')), '0'))):
        bmesh.ops.smooth_vert(bm, verts=goldv, factor=0.4, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
    if gems_out:
        GEM = bpy.data.materials.new("sapphire_cut"); GEM.use_nodes = True
        gp = GEM.node_tree.nodes["Principled BSDF"]
        gp.inputs["Base Color"].default_value = (0.02, 0.16, 0.95, 1); gp.inputs["Metallic"].default_value = 0.25
        gp.inputs["Roughness"].default_value = 0.03; gp.inputs["Coat Weight"].default_value = 1.0
        gp.inputs["Emission Color"].default_value = (0.01, 0.08, 0.55, 1); gp.inputs["Emission Strength"].default_value = 0.6
        gbm = bmesh.new()
        n6 = 6
        for cen, nrm, tan, up, rx, ry in gems_out:
            rx, ry = rx * 1.06, ry * 1.04   # a hair over the painted stone so none of it shows
            depth = min(rx, ry) * 0.45
            P = lambda x, y, z: cen + tan * x + up * y + nrm * (z + depth * 0.15)
            gir = [gbm.verts.new(P(rx * math.cos(math.pi / 2 + 2 * math.pi * i / n6), ry * math.sin(math.pi / 2 + 2 * math.pi * i / n6), 0)) for i in range(n6)]
            crown_ = [gbm.verts.new(P(0.62 * rx * math.cos(math.pi / 2 + 2 * math.pi * (i + .5) / n6), 0.62 * ry * math.sin(math.pi / 2 + 2 * math.pi * (i + .5) / n6), depth * 0.55)) for i in range(n6)]
            table = [gbm.verts.new(P(0.42 * rx * math.cos(math.pi / 2 + 2 * math.pi * i / n6), 0.42 * ry * math.sin(math.pi / 2 + 2 * math.pi * i / n6), depth)) for i in range(n6)]
            culet = gbm.verts.new(P(0, 0, -depth * 0.9))
            gbm.faces.new(table)
            for i in range(n6):
                j = (i + 1) % n6
                gbm.faces.new((gir[i], gir[j], crown_[i])); gbm.faces.new((crown_[i], gir[j], table[j])); gbm.faces.new((crown_[i], table[j], table[i]))
                gbm.faces.new((gir[j], gir[i], culet))
        bmesh.ops.recalc_face_normals(gbm, faces=gbm.faces)
        # a clean gold bezel round every gem: Meshy's lumpy painted settings stay hidden under it (P: artifacts round the jewels)
        bbm = bmesh.new()
        for cen, nrm, tan, up, rx, ry in gems_out:
            rx, ry = rx * 1.06, ry * 1.04
            depth = min(rx, ry) * 0.45
            Q = lambda x, y, z: cen + tan * x + up * y + nrm * z
            rings = []
            for (sx, sy, z) in ((1.0, 1.0, depth * 0.45), (1.0, 1.0, -depth * 0.35), (1.26, 1.2, -depth * 0.35), (1.26, 1.2, depth * 0.3), (1.13, 1.1, depth * 0.52)):
                rings.append([bbm.verts.new(Q(sx * rx * math.cos(math.pi / 2 + 2 * math.pi * i / n6), sy * ry * math.sin(math.pi / 2 + 2 * math.pi * i / n6), z)) for i in range(n6)])
            for a_, b_ in ((0, 1), (1, 2), (2, 3), (3, 4), (4, 0)):
                for i in range(n6):
                    j = (i + 1) % n6
                    bbm.faces.new((rings[a_][i], rings[a_][j], rings[b_][j], rings[b_][i]))
        bmesh.ops.recalc_face_normals(bbm, faces=bbm.faces)
        bme = bpy.data.meshes.new("bezels"); bbm.to_mesh(bme); bbm.free()
        bme.materials.append(GOLD)
        for p in bme.polygons:
            p.use_smooth = False
        bo = bpy.data.objects.new("bezels", bme); bpy.context.scene.collection.objects.link(bo)
        gme = bpy.data.meshes.new("gems"); gbm.to_mesh(gme); gbm.free()
        gme.materials.append(GEM)
        for p in gme.polygons:
            p.use_smooth = False   # crisp facets
        go = bpy.data.objects.new("gems", gme); bpy.context.scene.collection.objects.link(go)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="WEBP", export_image_quality=90)
    print("CLEAN wrote", OUT, "(tips kept)")
    sys.exit(0)
cut = bz - rb * (1.05 if NO_BALLS else 0.35)
kill = [f for f in bm.faces if all(v.co.z > cut for v in f.verts) and math.hypot(f.calc_center_median().x, f.calc_center_median().y) > bx * 0.6]
bmesh.ops.delete(bm, geom=kill, context="FACES")
if NO_BALLS:
    rim = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z - cut) < rb * 0.6 for v in e.verts)]
    bmesh.ops.holes_fill(bm, edges=rim, sides=0)
    capped = [f for f in bm.faces if f.calc_area() > 0 and all(abs(v.co.z - cut) < rb * 0.6 for v in f.verts) and abs(f.normal.z) > 0.7]
    for f in capped:
        f.material_index = 0
    # Meshy's necks are lumpy: smooth the tips so each point ends in a clean, rounded edge
    tipv = [v for v in bm.verts if v.co.z > cut - rb * 2.6]
    for _ in range(14):
        bmesh.ops.smooth_vert(bm, verts=tipv, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(me)
bm.free()
for k in ([] if NO_BALLS else range(N)):
    a = math.radians(360 / N * k)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=rb * 1.04, location=(bx * math.cos(a), bx * math.sin(a), bz))
    s = bpy.context.object
    s.data.materials.append(GOLD)
    bpy.ops.object.shade_smooth()
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = ob
bpy.ops.object.join()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="WEBP", export_image_quality=90)
print("CLEAN wrote", OUT)
