# Signature Tangible — Deterministic Geometry Specification

**GEOMETRY_VERSION: 1.0** · Reference implementation: `code/mesh.py` ·
Browser implementation: `assets/mesh3d.js` (parity port) ·
Verification: `code/qa/test_determinism.py` (cross-verified Python/JS)

## Pipeline

```
SOURCE_ID → NORMALIZED_ID → FNV-1a HASH → xorshift32 SEED → GEOMETRY PARAMS → MESH
```

1. **NORMALIZED_ID** — the record ID string exactly as it appears in the archive
   index (e.g. `JAH-SPEC-000123`, `JAH-PAT-000343`, `US7654321B2`). No case folding,
   no trimming beyond what the index already stores.
2. **HASH** — FNV-1a 32-bit over the UTF-8 bytes of the normalized ID
   (offset basis 2166136261, prime 16777619).
3. **SEED** — the hash value, used directly as the xorshift32 state
   (`x ^= x<<13; x ^= x>>17; x ^= x<<5`, 32-bit). A zero seed is replaced by 1.
4. **GEOMETRY PARAMS** — drawn from the seeded stream, in order:
   - ray count `k = 8 + floor(next()*9)` (8–16)
   - per ray: angle jitter `next()*0.25`, height `1.2 + floor(next()*3)*0.6`
   - center-hex rotation `next()*π`
   - notch count `nn = (sum(ID digits) mod 12) + 4` (4–15; notches ring the face
     and encode the ID's digits)
5. **MESH** — built from fixed primitives plus the seeded params, all units mm:
   - base coin: cylinder r=25, h=3, z=0, 64 segments → **50 mm diameter**
   - rim: torus R=22.5, tube=1.4, z=3, 48×16
   - rays: k boxes (2.2 × 11 × rh) at radius 13, z=3
   - center hex: cylinder r=8, h=2.2, z=3, 6 segments, seeded rotation
   - inner disc: cylinder r=4, h=1.2, z=5.2, 32 segments
   - notches: nn boxes (1.2³) at radius 4, z=6.4 → **~7.4 mm total height**
   - keychain variant only: vertical torus lug (R=4, tube=1.5) fused into the rim
     at (0, 22.5, 9) → 5 mm hole, total height ~14.5 mm
6. **FILES** — ASCII STL (`solid tangible … endsolid`), OBJ (deduped vertices),
   3MF (stored ZIP: `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`).

## Guarantees

- **Same source ID + same geometry version + same variant = identical geometry.**
  Verified order-independently: the Python reference and the JS parity port emit
  cap triangles in different loop order (Python: all sides then all caps; JS:
  interleaved per segment). Same triangles, different emission order — the
  canonical comparison sorts triangles before hashing, so it tests geometry
  equality, not byte equality. STL byte sizes differ slightly between
  implementations (Python `%g` vs JS number formatting); the mesh is identical.
- **MEDALLION vs KEYCHAIN are distinct geometry variants**, selected on the item
  page. The keychain lug is part of the mesh (no assembly).
- **GEOMETRY_VERSION is incremented on any intentional geometry change, never
  silently.** Version 1.0 is the original 2026-10-02 medallion.

## Honesty rules (permanent)

- `OBJECT_PURPOSE = COMMEMORATIVE_RECORD_EMBLEM`, `FUNCTIONAL_REPLICA = FALSE`.
- The medallion is a keepsake emblem FOR the record. It does not reproduce,
  implement, or model the invention described by the source record.
- Meshes are **generated in the visitor's browser**; no mesh files are stored
  server-side. Download buttons show format, computed size, SHA-256 of the
  generated file, generation moment, and geometry version.
- `MESH_VALIDATED` (deterministic, cross-verified) ≠ `PRINT_TESTED`. No physical
  print test is claimed for the archive. Slicer profiles are starting points,
  never factory profiles. No universal G-code exists or is shipped.

## Minimum printable guidance

- Relief features resolve at 0.10 mm layers and up; the notch ring (1.2 mm
  features) prints on any FDM machine at 0.20 mm layers.
- Flat base, no overhangs beyond the rim lip: **no supports required**.
- Scaling is unrestricted in the slicer, but relief detail below ~30 mm diameter
  may lose the notch ring — the UI states dimensions before download.
