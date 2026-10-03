#!/usr/bin/env python3
"""Determinism test vectors for the Signature Tangible medallion generator.

Verifies:
  1. code/mesh.py is deterministic (same ID -> same canonical hash across runs).
  2. assets/mesh3d.js (parity port) agrees with code/mesh.py on facet count,
     bounding box, and canonical rounded-coordinate hash for each vector.
  3. Same ID + same geometry version + same variant = identical mesh.

The canonical form rounds every vertex coordinate to 4 decimals, so the
comparison is immune to Python %g vs JS number-to-string formatting quirks.
Exit 0 = all vectors pass. Exit 1 = divergence found.
"""
import hashlib, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "code"))
from mesh import medallion, to_stl_ascii  # noqa: E402

GEOMETRY_VERSION = "1.0"
VECTORS = [
    ("JAH-SPEC-000123", False),
    ("JAH-SPEC-000123", True),
    ("JAH-SPEC-643512", False),
    ("JAH-PAT-000343", False),
    ("JAH-PAT-035742", True),
    ("US7654321B2", False),
]


def canon(m):
    # Order-independent: the parity port emits cap triangles interleaved with
    # the side loop while the Python reference emits them in a second loop.
    # Same triangles, different emission order -> sort before hashing so the
    # comparison tests GEOMETRY equality, not emission order.
    parts = []
    for (n, a, b, c) in m.facets:
        tri = tuple(sorted(",".join(f"{v:.4f}" for v in p) for p in (a, b, c)))
        parts.append("|".join(tri))
    parts.sort()
    return ";".join(parts)


def py_vector(rid, kc):
    m = medallion(rid, kc)
    xs = [p[0] for (_, a, b, c) in m.facets for p in (a, b, c)]
    ys = [p[1] for (_, a, b, c) in m.facets for p in (a, b, c)]
    zs = [p[2] for (_, a, b, c) in m.facets for p in (a, b, c)]
    return {
        "facets": len(m.facets),
        "bbox": {
            "min": [round(min(xs), 4), round(min(ys), 4), round(min(zs), 4)],
            "max": [round(max(xs), 4), round(max(ys), 4), round(max(zs), 4)],
        },
        "canon_sha256": hashlib.sha256(canon(m).encode()).hexdigest(),
        "stl_bytes": len(to_stl_ascii(m, "tangible").encode()),
    }


def js_vector(rid, kc):
    args = ["node", os.path.join(HERE, "probe.js"), rid]
    if kc:
        args.append("keychain")
    out = subprocess.run(args, capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        raise RuntimeError(f"probe.js failed for {rid}: {out.stderr[:500]}")
    return json.loads(out.stdout)


def main():
    fails = 0
    print(f"geometry version under test: {GEOMETRY_VERSION}")
    for rid, kc in VECTORS:
        tag = f"{rid}{' +keychain' if kc else ''}"
        # Python self-determinism: build twice
        p1 = py_vector(rid, kc)
        p2 = py_vector(rid, kc)
        if p1["canon_sha256"] != p2["canon_sha256"]:
            print(f"FAIL {tag}: mesh.py not self-deterministic")
            fails += 1
            continue
        try:
            j = js_vector(rid, kc)
        except RuntimeError as e:
            print(f"FAIL {tag}: {e}")
            fails += 1
            continue
        ok = True
        for field in ("facets", "canon_sha256"):
            if p1[field] != j[field]:
                print(f"FAIL {tag}: {field} py={p1[field]} js={j[field]}")
                ok = False
        for side in ("min", "max"):
            for a, b in zip(p1["bbox"][side], j["bbox"][side]):
                if abs(a - b) > 0.0002:
                    print(f"FAIL {tag}: bbox {side} py={p1['bbox'][side]} js={j['bbox'][side]}")
                    ok = False
                    break
        # JS self-determinism
        j2 = js_vector(rid, kc)
        if j["canon_sha256"] != j2["canon_sha256"]:
            print(f"FAIL {tag}: mesh3d.js not self-deterministic")
            ok = False
        if ok:
            print(f"PASS {tag}: {p1['facets']} facets, bbox {p1['bbox']['min']}..{p1['bbox']['max']}, "
                  f"sha256 {p1['canon_sha256'][:16]}..., stl {p1['stl_bytes']}B (py) / {j['stl_bytes']}B (js)")
        else:
            fails += 1
    if fails:
        print(f"\n{fails} vector(s) FAILED")
        return 1
    print("\nALL VECTORS PASS: deterministic, JS/Python parity confirmed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
