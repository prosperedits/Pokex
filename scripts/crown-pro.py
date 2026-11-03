"""Clean a multi-view Meshy crown for the hero: plain gold and black, real cut sapphires, the band at the hero's units.

Run: blender -b -P scripts/crown-pro.py -- <meshy.glb> <out.glb> [target_tris] [--marquise|--hex|--paint]
P (28 Oct night): Meshy "always looks splotchy or heavily messed up texture-wise". The multi-view crowns
(docs/design/crown/turnarounds/) come out with clean shapes, so only the surface is redone here:
- Faces are sorted by their painted colour: blue = stone, near-black low on the outside = band, everything else = gold.
  Gold and band become flat materials (no painted reflections, no noisy normal map).
- Each stone (an island of blue faces) is measured and a real faceted gem is set over it in a clean gold bezel:
  --marquise (pointed oval, crown 3), --hex (crown 1), or --paint (keep the painted stone, made glassy).
- The model is moved and scaled so the band's centre is the origin and its radius is 1 (the hero's units,
  docs/design/crown/size-target.md), then decimated to target_tris and exported without textures.
Prints CROWNPRO lines with the measured band, rims and tips (in band radii) for crown3d.js.
"""
import colorsys
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
TARGET = int(argv[2]) if len(argv) > 2 and argv[2].isdigit() else 180000
CUT = "hex" if "--hex" in argv else "paint" if "--paint" in argv else "marquise"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
ob.data.transform(ob.matrix_world)
ob.matrix_world.identity()
me = ob.data
print("CROWNPRO source tris", sum(len(p.vertices) - 2 for p in me.polygons))

src_mat = me.materials[0]
img = next(n.image for n in src_mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image
           and any(l.to_socket.name == "Base Color" for l in n.outputs[0].links))
W, H = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)


def mat(name, base, metal, rough, coat=0.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*base, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    if emit:
        p.inputs["Emission Color"].default_value = (*emit[0], 1)
        p.inputs["Emission Strength"].default_value = emit[1]
    return m


GOLD = mat("gold", (1.0, 0.66, 0.24), 1.0, 0.14)
BAND = mat("band", (0.012, 0.012, 0.016), 0.0, 0.34, 0.6)
UNDER = mat("stone_under", (0.01, 0.05, 0.35), 0.0, 0.2)   # the painted stone, hidden under the cut gem
me.materials.clear()
for m in (GOLD, BAND, UNDER):
    me.materials.append(m)

# ---- sort faces by paint ----
uv = me.uv_layers.active.data
zs = np.array([v.co.z for v in me.vertices])
zlo, zhi = zs.min(), zs.max()
counts = [0, 0, 0]
for p in me.polygons:
    u = sum(uv[i].uv.x for i in p.loop_indices) / p.loop_total
    v = sum(uv[i].uv.y for i in p.loop_indices) / p.loop_total
    r, g, b, _ = px[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))]
    h, s, val = colorsys.rgb_to_hsv(float(r), float(g), float(b))
    outward = (p.normal.x * p.center.x + p.normal.y * p.center.y) > 0.2 * math.hypot(p.center.x, p.center.y)
    if b > r * 1.5 and b > g * 1.2 and s > 0.45 and val > 0.12:
        k = 2
    elif val < 0.2 and p.center.z < zlo + (zhi - zlo) * 0.5 and outward:
        k = 1
    else:
        k = 0
    p.material_index = k
    counts[k] += 1
print("CROWNPRO faces gold/band/stone", counts)

bm = bmesh.new()
bm.from_mesh(me)
bm.faces.ensure_lookup_table()

# ---- the band: its centre and radius set the hero's units ----
bandv = {v for f in bm.faces if f.material_index == 1 for v in f.verts}
B = np.array([v.co[:] for v in bandv])
cx, cy = B[:, 0].mean(), B[:, 1].mean()
rad = np.hypot(B[:, 0] - cx, B[:, 1] - cy)
R = float(np.median(rad))
bz0, bz1 = np.percentile(B[:, 2], 1), np.percentile(B[:, 2], 99)
cz = (bz0 + bz1) / 2
print("CROWNPRO band raw centre", round(cx, 4), round(cy, 4), round(cz, 4), "radius", round(R, 4), "height", round(bz1 - bz0, 4))
T = Matrix.Scale(1 / R, 4) @ Matrix.Translation((-cx, -cy, -cz))
bmesh.ops.transform(bm, matrix=T, verts=bm.verts)
# Meshy's band is lumpy (its reflections streak): every vertex that only touches band faces goes onto a true cylinder
snapped = 0
for v in bm.verts:
    if v.link_faces and all(f.material_index == 1 for f in v.link_faces):
        rr = math.hypot(v.co.x, v.co.y)
        if rr > 1e-6:
            v.co.x, v.co.y = v.co.x / rr, v.co.y / rr
            snapped += 1
print("CROWNPRO band verts snapped to the cylinder", snapped)

# ---- stones: islands of blue faces ----
stone = [f for f in bm.faces if f.material_index == 2]
seen, islands = set(), []
for f0 in stone:
    if f0.index in seen:
        continue
    stack, isl = [f0], []
    seen.add(f0.index)
    while stack:
        f = stack.pop()
        isl.append(f)
        for e in f.edges:
            for lf in e.link_faces:
                if lf.material_index == 2 and lf.index not in seen:
                    seen.add(lf.index)
                    stack.append(lf)
    islands.append(isl)
# one stone is often several islands (its painted facet lines read as gold): merge islands whose centres are close
cen_ = [sum((f.calc_center_median() * f.calc_area() for f in isl), Vector()) / max(sum(f.calc_area() for f in isl), 1e-9) for isl in islands]
par = list(range(len(islands)))
def root(i):
    while par[i] != i:
        par[i] = par[par[i]]
        i = par[i]
    return i
for i in range(len(islands)):
    for j in range(i + 1, len(islands)):
        if (cen_[i] - cen_[j]).length < 0.15:
            par[root(i)] = root(j)
merged = {}
for i, isl in enumerate(islands):
    merged.setdefault(root(i), []).extend(isl)
islands = list(merged.values())
areas = sorted((sum(f.calc_area() for f in isl) for isl in islands), reverse=True)
big = areas[0] if areas else 0
gems = []
for isl in islands:
    area = sum(f.calc_area() for f in isl)
    if area < big * 0.25:   # specks of blue paint on the gold: gold
        for f in isl:
            f.material_index = 0
        continue
    cen = sum((f.calc_center_median() * f.calc_area() for f in isl), Vector()) / area
    nrm = sum((f.normal * f.calc_area() for f in isl), Vector()).normalized()
    up = Vector((0, 0, 1))
    tan = up.cross(nrm).normalized()
    up = nrm.cross(tan).normalized()
    vs = {v for f in isl for v in f.verts}
    xs = [(v.co - cen).dot(tan) for v in vs]
    ys = [(v.co - cen).dot(up) for v in vs]
    zs_ = [(v.co - cen).dot(nrm) for v in vs]
    gems.append((cen, nrm, tan, up, (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2, max(zs_)))
print("CROWNPRO stones", len(gems), "of", len(islands), "islands; first rx/ry", [(round(g[4], 3), round(g[5], 3)) for g in gems[:3]])

# Meshy's stone edges are a staircase of triangles: grow each stone two rings into the gold, under the bezel
for _ in range(2):
    grow = [lf for f in bm.faces if f.material_index == 2 for e in f.edges for lf in e.link_faces if lf.material_index == 0]
    for lf in grow:
        lf.material_index = 2
bm.normal_update()
bm.to_mesh(me)
bm.free()

# ---- decimate the shell (the cut gems stay exact) ----
tris = sum(len(p.vertices) - 2 for p in me.polygons)
if tris > TARGET:
    md = ob.modifiers.new("dec", "DECIMATE")
    md.ratio = TARGET / tris
    md.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="dec")
print("CROWNPRO shell tris", sum(len(p.vertices) - 2 for p in me.polygons))
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(45))


# ---- cut gems + bezels ----
def outline(rx, ry, n, phase=0.0):
    """Girdle points (x, y): a pointed oval (marquise) or a hexagon, long axis vertical."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * (i + phase) / n
        if CUT == "hex":
            pts.append((rx * math.cos(math.pi / 2 + t), ry * math.sin(math.pi / 2 + t)))
            continue
        y = ry * math.cos(t)
        Rr = (rx * rx + ry * ry) / (2 * rx)   # two circular arcs meeting in points at the ends
        w = max(0.0, math.sqrt(max(Rr * Rr - y * y, 0)) - (Rr - rx))
        pts.append((w if math.sin(t) >= 0 else -w, y))
    return pts


if CUT != "paint" and gems:
    n = 6 if CUT == "hex" else 20
    GEM = mat("sapphire_cut", (0.004, 0.05, 0.62), 0.2, 0.03, 1.0, ((0.004, 0.03, 0.4), 0.25))   # deep royal blue, not pale
    gbm, bbm = bmesh.new(), bmesh.new()
    for cen, nrm, tan, up, rx, ry, lift in gems:
        rx, ry = rx * 1.05, ry * 1.03          # a hair over the painted stone so none of it shows
        depth = min(rx, ry) * 0.5
        base = cen + nrm * max(lift * 0.6, depth * 0.1)
        P = lambda x, y, z: base + tan * x + up * y + nrm * z
        gir = [gbm.verts.new(P(x, y, 0)) for x, y in outline(rx, ry, n)]
        crn = [gbm.verts.new(P(x, y, depth * 0.55)) for x, y in outline(rx * 0.66, ry * 0.7, n, 0.5)]
        tab = [gbm.verts.new(P(x, y, depth)) for x, y in outline(rx * 0.42, ry * 0.5, n)]
        # the pavilion runs to a keel along the long axis (marquise) or a point (hex)
        keel = [gbm.verts.new(P(0, ry * 0.45, -depth * 0.85)), gbm.verts.new(P(0, -ry * 0.45, -depth * 0.85))] if CUT == "marquise" else [gbm.verts.new(P(0, 0, -depth * 0.9))]
        gbm.faces.new(tab)
        for i in range(n):
            j = (i + 1) % n
            gbm.faces.new((gir[i], gir[j], crn[i]))
            gbm.faces.new((crn[i], gir[j], tab[j]))
            gbm.faces.new((crn[i], tab[j], tab[i]))
            gy = (gir[i].co - base).dot(up) + (gir[j].co - base).dot(up)
            gbm.faces.new((gir[j], gir[i], keel[0] if (len(keel) == 1 or gy >= 0) else keel[1]))
        if CUT == "marquise":   # close the keel between the two pavilion halves
            for i in range(n):
                j = (i + 1) % n
                yi, yj = (gir[i].co - base).dot(up), (gir[j].co - base).dot(up)
                if (yi >= 0) != (yj >= 0):
                    try:
                        gbm.faces.new((gir[j], keel[1] if yj < 0 else keel[0], keel[0] if yj < 0 else keel[1]))
                    except ValueError:
                        pass
        # a clean gold bezel round the gem hides Meshy's lumpy painted setting
        rings = []
        for sx, sy, z in ((1.0, 1.0, depth * 0.42), (1.0, 1.0, -depth * 0.3), (1.22, 1.14, -depth * 0.3), (1.22, 1.14, depth * 0.26), (1.11, 1.07, depth * 0.5)):
            rings.append([bbm.verts.new(P(x, y, z)) for x, y in outline(rx * sx, ry * sy, n)])
        for a_, b_ in ((0, 1), (1, 2), (2, 3), (3, 4), (4, 0)):
            for i in range(n):
                j = (i + 1) % n
                bbm.faces.new((rings[a_][i], rings[a_][j], rings[b_][j], rings[b_][i]))
    for b_ in (gbm, bbm):
        bmesh.ops.remove_doubles(b_, verts=b_.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(b_, faces=b_.faces)
    gme = bpy.data.meshes.new("gems"); gbm.to_mesh(gme); gbm.free()
    gme.materials.append(GEM)
    for p in gme.polygons:
        p.use_smooth = False   # crisp facets
    bpy.context.scene.collection.objects.link(bpy.data.objects.new("gems", gme))
    bme = bpy.data.meshes.new("bezels"); bbm.to_mesh(bme); bbm.free()
    bme.materials.append(GOLD)
    bo = bpy.data.objects.new("bezels", bme)
    bpy.context.scene.collection.objects.link(bo)
    bpy.context.view_layer.objects.active = bo
    bo.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
elif CUT == "paint":   # keep the painted facets, glassy
    t = UNDER.node_tree; bsdf = t.nodes["Principled BSDF"]
    tx = t.nodes.new("ShaderNodeTexImage"); tx.image = img
    t.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.05; bsdf.inputs["Coat Weight"].default_value = 1.0

# ---- measurements for crown3d.js, in band radii ----
V = np.array([v.co[:] for v in me.vertices])
r_all = np.hypot(V[:, 0], V[:, 1])
bandV = np.array([me.vertices[i].co[:] for p in me.polygons if p.material_index == 1 for i in p.vertices])
print("CROWNPRO band z", round(float(np.percentile(bandV[:, 2], 1)), 4), round(float(np.percentile(bandV[:, 2], 99)), 4),
      "| rims out to", round(float(r_all[V[:, 2] < 0.6].max()), 4), "| foot", round(float(V[:, 2].min()), 4), "| tips", round(float(V[:, 2].max()), 4))

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_materials="EXPORT", export_image_format="NONE")
print("CROWNPRO wrote", OUT)
