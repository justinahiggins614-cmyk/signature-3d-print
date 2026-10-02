#!/usr/bin/env python3
"""Signature Tangible medallion — deterministic parametric mesh generator (reference).

For a record ID (JAH-SPEC-###### / JAH-PAT-###### / patent pub no.), builds a
commemorative keepsake medallion: base coin + rim + radial rays + center
emblem with ID-digit notches. All units mm. Output: ASCII STL / OBJ / 3MF.

This is a COMMEMORATIVE EMBLEM for the record — not a functional replica of
the invention described by the record.
"""
import math, struct, binascii, io, zipfile

def fnv1a(s):
    h = 2166136261
    for c in s.encode("utf-8"):
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    return h

class RNG:
    def __init__(self, seed): self.s = seed or 1
    def next(self):
        x = self.s
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= (x >> 17) & 0xFFFFFFFF
        x ^= (x << 5) & 0xFFFFFFFF
        self.s = x & 0xFFFFFFFF
        return self.s / 4294967296.0

def sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def norm(v):
    l = math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2])
    return (v[0]/l, v[1]/l, v[2]/l) if l else (0, 0, 0)

class Mesh:
    def __init__(self): self.facets = []
    def tri(self, a, b, c):
        n = norm(cross(sub(b, a), sub(c, a)))
        self.facets.append((n, a, b, c))
    def quad(self, a, b, c, d):
        self.tri(a, b, c); self.tri(a, c, d)

def cylinder(m, r, h, z0, seg, rot=0.0):
    pts = [(r*math.cos(rot+i*2*math.pi/seg), r*math.sin(rot+i*2*math.pi/seg)) for i in range(seg)]
    zt, zb = z0+h, z0
    for i in range(seg):
        j = (i+1) % seg
        m.quad((pts[i][0], pts[i][1], zb), (pts[j][0], pts[j][1], zb),
               (pts[j][0], pts[j][1], zt), (pts[i][0], pts[i][1], zt))
    for i in range(seg):
        j = (i+1) % seg
        m.tri((0, 0, zb), (pts[j][0], pts[j][1], zb), (pts[i][0], pts[i][1], zb))
        m.tri((0, 0, zt), (pts[i][0], pts[i][1], zt), (pts[j][0], pts[j][1], zt))

def box(m, w, d, h, cx, cy, z0, rot=0.0):
    hw, hd = w/2, d/2
    cs, sn = math.cos(rot), math.sin(rot)
    def P(x, y, z): return (cx + x*cs - y*sn, cy + x*sn + y*cs, z)
    c = [P(-hw,-hd,z0), P(hw,-hd,z0), P(hw,hd,z0), P(-hw,hd,z0),
         P(-hw,-hd,z0+h), P(hw,-hd,z0+h), P(hw,hd,z0+h), P(-hw,hd,z0+h)]
    m.quad(c[0], c[1], c[2], c[3])
    m.quad(c[4], c[5], c[6], c[7])
    m.quad(c[0], c[4], c[5], c[1])
    m.quad(c[1], c[5], c[6], c[2])
    m.quad(c[2], c[6], c[7], c[3])
    m.quad(c[3], c[7], c[4], c[0])

def torus(m, R, tube, zc, segR, segT):
    """Horizontal ring (rim)."""
    for i in range(segR):
        for j in range(segT):
            a0 = i*2*math.pi/segR; a1 = (i+1)*2*math.pi/segR
            b0 = j*2*math.pi/segT; b1 = (j+1)*2*math.pi/segT
            def P(a, b):
                return ((R + tube*math.cos(b))*math.cos(a),
                        (R + tube*math.cos(b))*math.sin(a),
                        zc + tube*math.sin(b))
            m.quad(P(a0,b0), P(a1,b0), P(a1,b1), P(a0,b1))

def torus_vertical(m, R, tube, cx, cy, zc, segR, segT):
    """Ring standing in the XZ plane (for the keychain lug)."""
    for i in range(segR):
        for j in range(segT):
            a0 = i*2*math.pi/segR; a1 = (i+1)*2*math.pi/segR
            b0 = j*2*math.pi/segT; b1 = (j+1)*2*math.pi/segT
            def P(a, b):
                return (cx + (R + tube*math.cos(b))*math.cos(a),
                        cy + tube*math.sin(b),
                        zc + (R + tube*math.cos(b))*math.sin(a))
            m.quad(P(a0,b0), P(a1,b0), P(a1,b1), P(a0,b1))

def medallion(record_id, keychain=False):
    """Build the Signature Tangible medallion mesh for a record ID."""
    rng = RNG(fnv1a(record_id))
    m = Mesh()
    cylinder(m, 25.0, 3.0, 0.0, 64)                    # base coin
    torus(m, 22.5, 1.4, 3.0, 48, 16)                   # rim
    k = 8 + int(rng.next()*9)                          # 8..16 rays
    for i in range(k):
        ang = i*2*math.pi/k + rng.next()*0.25
        rh = 1.2 + int(rng.next()*3)*0.6
        box(m, 2.2, 11.0, rh, math.cos(ang)*13, math.sin(ang)*13, 3.0, ang)
    cylinder(m, 8.0, 2.2, 3.0, 6, rot=rng.next()*math.pi)  # center hex
    cylinder(m, 4.0, 1.2, 5.2, 32)                     # inner disc
    digits = "".join(c for c in record_id if c.isdigit())
    nn = (sum(int(d) for d in digits) % 12) + 4         # 4..15 notches
    for i in range(nn):
        ang = i*2*math.pi/nn
        box(m, 1.2, 1.2, 1.0, math.cos(ang)*4.0, math.sin(ang)*4.0, 6.4, ang)
    if keychain:
        # lug: vertical loop fused into the rim (rim top z~4.4 at r=22.5);
        # loop bottom buried at z~3.5, top at ~14.5, 5mm hole for a keyring
        torus_vertical(m, 4.0, 1.5, 0.0, 22.5, 9.0, 32, 12)
    return m

def to_stl_ascii(m, name):
    out = ["solid %s" % name]
    for (n, a, b, c) in m.facets:
        out.append("  facet normal %g %g %g" % n)
        out.append("    outer loop")
        out.append("      vertex %g %g %g" % a)
        out.append("      vertex %g %g %g" % b)
        out.append("      vertex %g %g %g" % c)
        out.append("    endloop")
        out.append("  endfacet")
    out.append("endsolid %s" % name)
    return "\n".join(out) + "\n"

def to_obj(m, name):
    verts = {}
    lines = ["# %s" % name, "o tangible"]
    def vi(p):
        key = (round(p[0],4), round(p[1],4), round(p[2],4))
        if key not in verts:
            verts[key] = len(verts)+1
            lines.append("v %g %g %g" % p)
        return verts[key]
    for (_, a, b, c) in m.facets:
        lines.append("f %d %d %d" % (vi(a), vi(b), vi(c)))
    return "\n".join(lines) + "\n"

def to_3mf(m, name):
    verts = {}
    vlist, tlist = [], []
    def vi(p):
        key = (round(p[0],4), round(p[1],4), round(p[2],4))
        if key not in verts:
            verts[key] = len(verts)
            vlist.append(p)
        return verts[key]
    for (_, a, b, c) in m.facets:
        tlist.append((vi(a), vi(b), vi(c)))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
     '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
     ' <resources><object id="1" type="model" name="%s"><mesh>' % name,
     '  <vertices>'] + \
     ['   <vertex x="%g" y="%g" z="%g"/>' % v for v in vlist] + \
     ['  </vertices>', '  <triangles>'] + \
     ['   <triangle v1="%d" v2="%d" v3="%d"/>' % t for t in tlist] + \
     ['  </triangles>', ' </mesh></object></resources>',
     ' <build><item objectid="1"/></build>', '</model>']
    model = "\n".join(xml).encode("utf-8")
    ct = b'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'
    rels = b'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        z.writestr("[Content_Types].xml", ct)
        z.writestr("_rels/.rels", rels)
        z.writestr("3D/3dmodel.model", model)
    return buf.getvalue()

def bounds(m):
    xs = [p[i] for (_, a, b, c) in m.facets for p in (a, b, c) for i in (0,)]
    return None

if __name__ == "__main__":
    import sys
    rid = sys.argv[1] if len(sys.argv) > 1 else "JAH-SPEC-000123"
    kc = len(sys.argv) > 2 and sys.argv[2] == "keychain"
    m = medallion(rid, kc)
    xs = [p[0] for (_, a, b, c) in m.facets for p in (a, b, c)]
    ys = [p[1] for (_, a, b, c) in m.facets for p in (a, b, c)]
    zs = [p[2] for (_, a, b, c) in m.facets for p in (a, b, c)]
    print("facets:", len(m.facets))
    print("x: %.2f..%.2f  y: %.2f..%.2f  z: %.2f..%.2f" % (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)))
    stl = to_stl_ascii(m, "tangible")
    print("stl bytes:", len(stl), "head:", stl[:14].replace("\n","|"), "tail:", stl.strip().split("\n")[-1])
    print("obj bytes:", len(to_obj(m, "tangible")))
    print("3mf bytes:", len(to_3mf(m, "tangible")))
    # determinism check
    m2 = medallion(rid, kc)
    print("deterministic:", to_stl_ascii(m, "t") == to_stl_ascii(m2, "t"))
