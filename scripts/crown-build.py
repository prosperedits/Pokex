"""Build crown 3 (Spires) exactly, from the concept's measurements, instead of trusting Meshy's mesh.

Run: blender -b -P scripts/crown-build.py -- <out.glb> [out.blend]
P (28 Oct night) picked crown 3 from docs/design/crown/turnarounds/crown-3-spires.png. Meshy's mesh came back with
thin, wavy spires (P: "atrocious"), and the shape is simple, so it is built here from numbers measured off the
concept's front view (band radius = 571.5 px = 1 unit; heights from the band's centre):
  band r 1.0, z -0.142..0.142 | bottom rim to r 1.056, z -0.254..-0.147 | upper rim r 1.05, z 0.142..0.32
  wall r 1.035 leaning to 1.0 at the tips | valleys z 0.64 | tips z 1.07 | 12 spires, narrow at the top, wide round valleys
  one marquise sapphire per spire: centre z 0.577, 0.318 tall, 0.137 wide
Units are the hero's (band radius 1, band centre at the origin; docs/design/crown/size-target.md). Z is up in Blender;
the glTF export turns it to Y-up.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
BLEND = argv[1] if len(argv) > 1 else None

N_SPIRES = 12
# P (29 Oct): the cards on the band should be bigger and easier to see, so the band is 0.08 taller than the concept's
# (half-height 0.142 + DZ); everything above it moves up by DZ, everything below it down by DZ
DZ = 0.04
# P (2 Nov): the crown wider, to the card ring's radius. DR widens every radius, so rims and wall keep their thickness
DR = 0.19
Z_WALL0, Z_VALLEY, Z_TIP = 0.25 + DZ, 0.62 + DZ, 1.05 + DZ
R_WALL0, R_TIP, TH = 1.035, 1.0, 0.045
SPIRE_P = 2.4   # the edge is (1 - u)^2.4 across each slot: slender spires, concave flanks, wide round valleys (the concept)
GEM_Z, GEM_H, GEM_W = 0.577 + DZ, 0.35, 0.172   # a touch bigger than measured: the concept's stones fill the spire base

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, base, metal, rough, coat=0.0, transmission=0.0, ior=1.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*base, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Transmission Weight"].default_value = transmission
    p.inputs["IOR"].default_value = ior
    return m


GOLD = material("gold", (1.0, 0.62, 0.17), 1.0, 0.12)
BAND = material("band", (0.004, 0.004, 0.005), 0.0, 0.4)
BAND.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.25   # satin black, not grey
GEM = material("sapphire", (0.0, 0.03, 0.7), 0.0, 0.08, 0.15)   # vivid royal blue (v1 glass went teal over the gold)
_g = GEM.node_tree.nodes["Principled BSDF"]
_g.inputs["Emission Color"].default_value = (0.0, 0.02, 0.5, 1)
_g.inputs["Emission Strength"].default_value = 0.35
_ca = GEM.node_tree.nodes.new("ShaderNodeVertexColor"); _ca.layer_name = "Col"
GEM.node_tree.links.new(_ca.outputs["Color"], _g.inputs["Base Color"])
GEM.node_tree.links.new(_ca.outputs["Color"], _g.inputs["Emission Color"])


def link(name, bm, mat, smooth_angle=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = smooth_angle is not None
    if smooth_angle is not None:
        bpy.context.view_layer.objects.active = ob
        for o in scene.objects:
            o.select_set(o is ob)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    return ob


def lathe(name, profile, mat, seg=256):
    """Revolve a closed (r, z) profile round Z."""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new(((r + DR) * ca, (r + DR) * sa, z)) for r, z in profile])
    n = len(profile)
    for i in range(seg):
        A, B_ = rings[i], rings[(i + 1) % seg]
        for k in range(n):
            q = (k + 1) % n
            bm.faces.new((A[k], A[q], B_[q], B_[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link(name, bm, mat, 40)


def rounded_rect(r0, r1, z0, z1, cr, k=8):
    """A closed (r, z) outline: a rectangle with round corners, counter-clockwise."""
    pts = []
    for (cx, cz, a0) in ((r1 - cr, z0 + cr, -90), (r1 - cr, z1 - cr, 0), (r0 + cr, z1 - cr, 90), (r0 + cr, z0 + cr, 180)):
        for j in range(k + 1):
            a = math.radians(a0 + 90 * j / k)
            pts.append((cx + cr * math.cos(a), cz + cr * math.sin(a)))
    return pts


def torus_profile(rc, zc, rr, rz, k=24):
    return [(rc + rr * math.cos(2 * math.pi * j / k), zc + rz * math.sin(2 * math.pi * j / k)) for j in range(k)]


# ---- band, rims ----
# the concept's rims are rolled tubes (a fat roll and a thinner one), not flat steps
# P (2 Nov): the thin rolls next to the cards go ("the bevels above the card and below... should be completely removed. And it
# should just give more room for the cards to expand"), so the band runs from fat roll to fat roll, a hair proud of the backs
lathe("band", rounded_rect(0.968, 1.002, -0.175 - DZ, 0.205 + DZ, 0.008, 3), BAND)
lathe("rim_bottom_back", rounded_rect(0.955, 1.0, -0.254 - DZ, -0.14 - DZ, 0.02), GOLD)
lathe("rim_bottom", torus_profile(1.02, -0.212 - DZ, 0.037, 0.042, 32), GOLD)
lathe("rim_upper_back", rounded_rect(0.955, 1.0, 0.14 + DZ, 0.29 + DZ, 0.02), GOLD)
lathe("rim_upper", torus_profile(1.026, 0.242 + DZ, 0.032, 0.042, 32), GOLD)


# ---- the spired wall ----
def top_z(theta):
    """Height of the wall's top edge at angle theta (spire tips at 0, 30, 60... degrees)."""
    slot = 2 * math.pi / N_SPIRES
    u = abs(((theta / slot + 0.5) % 1.0) - 0.5) * 2   # 0 at a tip, 1 halfway to the next
    return Z_VALLEY + (Z_TIP - Z_VALLEY) * (1 - u) ** SPIRE_P   # one curve: slender tip, concave flanks, round valley


def wall_r(z, theta):
    t = max(0.0, min(1.0, (z - Z_WALL0) / (Z_TIP - Z_WALL0)))
    r = R_WALL0 + DR - (R_WALL0 - R_TIP) * t ** 1.5
    # a raised ridge down each spire's centre, above its gem
    slot = 2 * math.pi / N_SPIRES
    u = abs(((theta / slot + 0.5) % 1.0) - 0.5) * 2
    fade = max(0.0, min(1.0, (z - (GEM_Z + GEM_H * 0.5)) / 0.06))
    # No per-spire swell any more: it stuck out of the silhouette at the crown's sides as the spires turned away (P, 29 Oct:
    # "the protrusion of each section just looks a little bit goofy on the right side... even the left"). The wall is round.
    return r + 0.006 * math.exp(-(u / 0.07) ** 2) * fade


def taper(z):
    """Wall and rolled-edge thickness, 1 low down to 0.22 at the tips, so a tip is sharp from every side. A thick rolled edge
    right up to the point read sharp face-on and round side-on (P, 29 Oct: "make it sharp all around? All the tips?")."""
    t = max(0.0, min(1.0, (z - (Z_VALLEY + 0.1)) / (Z_TIP - Z_VALLEY - 0.1)))
    return 1 - 0.78 * t * t * (3 - 2 * t)


M, ROWS, CAP = N_SPIRES * 48, 44, 8
BEAD, BEAD_W = 0.026, 0.034    # the rolled edge the concept's spires have: the wall swells along its top edge
dth = 2 * math.pi / M
bm = bmesh.new()
cols = []
for i in range(M):
    th = 2 * math.pi * i / M
    ca, sa = math.cos(th), math.sin(th)
    zt = top_z(th)
    slope = (top_z(th + dth) - top_z(th - dth)) / (2 * dth * (R_TIP + DR))   # dz/ds of the edge, for distance-to-edge
    col_out, col_in, col_cap = [], [], []
    for j in range(ROWS + 1):
        t = j / ROWS
        t = 1 - (1 - t) ** 1.6     # rows bunch toward the top edge, where the curvature is
        z = Z_WALL0 + (zt - Z_WALL0) * t
        d = (zt - z) / math.sqrt(1 + slope * slope)
        tk = taper(z)
        bead = math.exp(-(d / (BEAD_W * (0.5 + 0.5 * tk))) ** 2) * tk
        ro = wall_r(z, th) + BEAD * bead
        col_out.append(Vector((ro * ca, ro * sa, z)))
        ri = ro - TH * tk - BEAD * 1.4 * bead
        col_in.append(Vector((ri * ca, ri * sa, z)))
    ro, ri = col_out[-1].xy.length, col_in[-1].xy.length
    for k in range(1, CAP):           # a round cap over the top edge, outside to inside
        a = math.pi * k / CAP
        rr = (ro + ri) / 2 + (ro - ri) / 2 * math.cos(a)
        col_cap.append(Vector((rr * ca, rr * sa, zt + (ro - ri) / 2 * 0.9 * math.sin(a))))
    ring = col_out + col_cap + list(reversed(col_in))
    cols.append([bm.verts.new(p) for p in ring])
L = len(cols[0])
for i in range(M):
    A, B_ = cols[i], cols[(i + 1) % M]
    for k in range(L - 1):
        bm.faces.new((A[k], B_[k], B_[k + 1], A[k + 1]))
    bm.faces.new((A[L - 1], B_[L - 1], B_[0], A[0]))   # the wall's foot (hidden in the upper rim)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
link("wall", bm, GOLD, 60)


# ---- marquise sapphires in gold bezels ----
def marquise(w, h, n, scale=1.0, phase=0.0):
    rx, ry = w / 2 * scale, h / 2 * scale
    R_ = (rx * rx + ry * ry) / (2 * rx)
    pts = []
    for i in range(n):
        t = 2 * math.pi * (i + phase) / n
        y = ry * math.cos(t)
        x = math.sqrt(max(R_ * R_ - y * y, 0)) - (R_ - rx)
        pts.append((x if math.sin(t) >= 0 else -x, y))
    return pts


gbm, bbm = bmesh.new(), bmesh.new()
col = gbm.loops.layers.float_color.new("Col")
FACET = [(0.05, 0.26, 1.0, 1), (0.02, 0.13, 0.92, 1), (0.0, 0.04, 0.5, 1), (0.08, 0.36, 1.0, 1), (0.01, 0.07, 0.7, 1), (0.0, 0.02, 0.32, 1)]
NG = 48   # smooth girdles and collars (24 showed facets on the collar)
for k in range(N_SPIRES):
    th = 2 * math.pi * k / N_SPIRES
    nrm = Vector((math.cos(th), math.sin(th), 0))
    tan = Vector((-math.sin(th), math.cos(th), 0))
    up = Vector((0, 0, 1))
    base = nrm * (wall_r(GEM_Z, th) + 0.006) + up * GEM_Z
    P = lambda x, y, z: base + tan * x + up * y + nrm * z
    ch, pd = GEM_W * 0.26, GEM_W * 0.5      # crown height, pavilion depth
    G = [gbm.verts.new(P(x, y, 0)) for x, y in marquise(GEM_W, GEM_H, NG)]
    Mid = [gbm.verts.new(P(x, y, ch * 0.62)) for x, y in marquise(GEM_W, GEM_H, NG, 0.8, 0.5)]
    Tb = [gbm.verts.new(P(x, y, ch)) for x, y in marquise(GEM_W, GEM_H, NG, 0.55)]
    cul = gbm.verts.new(P(0, 0, -pd))
    fc = [(gbm.faces.new(Tb), 0)]
    for i in range(NG):
        j = (i + 1) % NG
        fc.append((gbm.faces.new((Tb[i], Tb[j], Mid[i])), 1))         # star facets
        fc.append((gbm.faces.new((G[i], G[j], Mid[i])), 2))           # upper girdle facets
        fc.append((gbm.faces.new((Mid[i], Tb[j], Mid[j], G[j])), 3 + i % 2))   # kites, light and dark in turn
        fc.append((gbm.faces.new((G[j], G[i], cul)), 5))              # pavilion
    # each facet gets its own blue (light table and kites, deep girdle and pavilion): the sparkle a cut stone has,
    # which a single flat blue never shows (v1 to v4 read as enamel)
    for f, kind in fc:
        for l in f.loops:
            l[col] = FACET[kind]
    # the bezel: a rounded gold collar round the girdle that runs down into the wall with a soft fillet. Its outer edge
    # sits ON the wall's own surface (the wall curves away under a flat collar), so there is no crease: P (29 Oct) saw
    # "a shadow residue under each gem around the bevels" on the first collar, a flat ring hovering over a curved wall.
    def on_wall(x, y, h):
        q = base + tan * x + up * y
        a = math.atan2(q.y, q.x)
        rw = wall_r(q.z, a)
        return Vector((math.cos(a) * (rw + h), math.sin(a) * (rw + h), q.z))
    rings = []
    for sc, h in ((0.97, -0.02), (0.98, 0.006 + ch * 0.3), (1.04, 0.006 + ch * 0.56), (1.1, 0.006 + ch * 0.56), (1.15, 0.006 + ch * 0.42),
                  (1.19, 0.006 + ch * 0.2), (1.23, 0.003), (1.25, -0.002), (1.25, -0.02)):
        rings.append([bbm.verts.new(on_wall(x, y, h)) for x, y in marquise(GEM_W, GEM_H, NG, sc)])
    for a_ in range(len(rings)):
        b_ = (a_ + 1) % len(rings)
        for i in range(NG):
            j = (i + 1) % NG
            bbm.faces.new((rings[a_][i], rings[a_][j], rings[b_][j], rings[b_][i]))
for b_ in (gbm, bbm):
    bmesh.ops.remove_doubles(b_, verts=b_.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(b_, faces=b_.faces)
link("gems", gbm, GEM)                 # flat: crisp facets
link("bezels", bbm, GOLD, 85)   # fully smooth: a polished collar

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in scene.objects if o.type == "MESH")
print("CROWNBUILD tris", tris)
if BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="NONE")
print("CROWNBUILD wrote", OUT)
