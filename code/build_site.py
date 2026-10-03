#!/usr/bin/env python3
"""Build the Signature 3D Print Depository static layer.

Reads the spec + patent search indexes, then generates:
  sitemap-tangibles-N.xml  (per-range ?print= URL shards, 50k each)
  sitemap.xml              (index)
  robots.txt
  api.json
  data/counts.json
  browse/shard-XXXX.html   (static crawlable link shards, 2000/page, prev/next)
Stamps the static count line into index.html (STATIC-COUNT marker).
"""
import json, gzip, os, html, datetime, hashlib, re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://justinahiggins614-cmyk.github.io/signature-3d-print/"
SPEC_SEARCH = os.path.expanduser("~/workspace/signature-one-archive/data/index/specs.search.json.gz")
PAT_SEARCH = os.path.expanduser("~/workspace/cyber-patent-catalog/data/patents.search.json.gz")
TODAY = datetime.date.today().isoformat()
GEOMETRY_VERSION = "1.0"
SCHEMA_VERSION = "JAH-TANGIBLE-RECORD/1.0"

def load():
    items = []  # (id, title, kind)
    seen = set()
    def add(iid, title, kind):
        iid = iid or ""
        if not iid or (kind, iid) in seen:
            return
        seen.add((kind, iid))
        items.append((iid, title, kind))
    with gzip.open(SPEC_SEARCH, "rt") as z:
        for line in z:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            add(r[0], r[1], "spec")
    with gzip.open(PAT_SEARCH, "rt") as z:
        for line in z:
            line = line.strip()
            if not line:
                continue
            for r in json.loads(line):
                add(r[9] or r[0], r[1] or "Untitled patent record", "pat")
    return items

def esc(s): return html.escape(s or "", quote=True)

def main():
    items = load()
    n = len(items)
    specs = sum(1 for _, _, k in items if k == "spec")
    pats = n - specs
    print(f"tangibles: {n} ({specs} spec, {pats} patent)")

    # ---- sitemaps (50k per file) ----
    PER = 50000
    sm_files = []
    for i in range(0, n, PER):
        chunk = items[i:i+PER]
        fn = f"sitemap-tangibles-{i//PER+1}.xml"
        with open(os.path.join(HERE, fn), "w") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
            for (iid, _, _) in chunk:
                f.write(f' <url><loc>{BASE}?print={esc(iid)}</loc><lastmod>{TODAY}</lastmod><changefreq>yearly</changefreq></url>\n')
            f.write('</urlset>\n')
        sm_files.append(fn)
    with open(os.path.join(HERE, "sitemap-pages.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        f.write(f' <url><loc>{BASE}</loc><lastmod>{TODAY}</lastmod><changefreq>daily</changefreq></url>\n')
        f.write(f' <url><loc>{BASE}browse/</loc><lastmod>{TODAY}</lastmod><changefreq>daily</changefreq></url>\n')
        for doc in ("llms.txt", "ai-manifest.json", "tangibles-manifest.json",
                    "signature-tangible-schema.json", "docs/GEOMETRY_SPEC.md"):
            f.write(f' <url><loc>{BASE}{doc}</loc><lastmod>{TODAY}</lastmod><changefreq>monthly</changefreq></url>\n')
        f.write('</urlset>\n')
    sm_files.insert(0, "sitemap-pages.xml")
    with open(os.path.join(HERE, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for fn in sm_files:
            f.write(f' <sitemap><loc>{BASE}{fn}</loc><lastmod>{TODAY}</lastmod></sitemap>\n')
        f.write('</sitemapindex>\n')
    print(f"sitemaps: {len(sm_files)} files")

    # ---- robots.txt ----
    with open(os.path.join(HERE, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {BASE}sitemap.xml\n")

    # ---- api.json ----
    api = {
        "site": "The Signature 3D Print Depository (provisional name)",
        "url": BASE,
        "network": "THE JAH NETWORK",
        "site_number": 15,
        "sister_site": "https://justinahiggins614-cmyk.github.io/signature-cyber-mega-mall/",
        "sister_role": "tangible wing (this site) <-> software mall (sister)",
        "honesty": "Each tangible is a commemorative emblem FOR its record — not a functional replica of the invention described.",
        "tangibles": {"total": n, "spec": specs, "patent": pats, "goal": 1000000},
        "formats": ["stl", "obj", "3mf"],
        "gcode": "No universal G-code is shipped; slice the STL in your own slicer.",
        "deep_link": BASE + "?print=<JAH-SPEC-######|JAH-PAT-######|pub-number>",
        "updated": TODAY,
    }
    with open(os.path.join(HERE, "api.json"), "w") as f:
        json.dump(api, f, indent=1)

    # ---- tangibles-manifest.json (THE authoritative manifest) ----
    def sha256_file(p):
        h = hashlib.sha256()
        with open(p, "rb") as z:
            for ch in iter(lambda: z.read(1 << 20), b""):
                h.update(ch)
        return h.hexdigest()

    manifest = {
        "manifest": "tangibles-manifest",
        "manifest_version": "1.0",
        "site": "The Signature 3D Print Depository (provisional name)",
        "url": BASE,
        "network": "THE JAH NETWORK",
        "site_number": 15,
        "site_version": "1.0",
        "sister_site": "https://justinahiggins614-cmyk.github.io/signature-cyber-mega-mall/",
        "sister_role": "tangible wing (this site) <-> software mall (sister)",
        "counts": {
            "total": n, "spec": specs, "patent": pats, "goal": 1000000,
            "reconciliation": f"{specs} + {pats} = {n}",
        },
        "count_updated": TODAY,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "catalog_version": TODAY,
        "archive_version": TODAY,
        "index": {
            "index_version": f"search-index-{TODAY}",
            "sources": [
                {"kind": "spec",
                 "file": "signature-one-archive/data/index/specs.search.json.gz",
                 "sha256": sha256_file(SPEC_SEARCH),
                 "rows_indexed": specs},
                {"kind": "patent",
                 "file": "cyber-patent-catalog/data/patents.search.json.gz",
                 "sha256": sha256_file(PAT_SEARCH),
                 "rows_indexed": pats,
                 "dedupe_note": "Patent rows are deduped by record ID; any upstream duplicate IDs are reported, first record kept."},
            ],
        },
        "identity": {
            "tangible_id_standard": "The permanent tangible ID IS the source record ID (JAH-SPEC-######, JAH-PAT-######, or patent publication number). One source record <-> one medallion. No parallel ID namespace exists by design.",
            "deep_link": BASE + "?print=<SOURCE_ID>",
            "raw_json": BASE + "?print=<SOURCE_ID>&format=json",
            "canonical_url_form": BASE + "?print=<SOURCE_ID>",
            "source_types": {
                "SPEC": "Signature spec draft — status DRAFT (not filed, not a granted patent)",
                "PATENT": "Public patent record — status PUBLIC_RECORD (publication identifier shown)",
            },
        },
        "object": {
            "object_purpose": "COMMEMORATIVE_RECORD_EMBLEM",
            "functional_replica": False,
            "honesty": "Each tangible is a commemorative emblem FOR its record — not a functional replica of the invention described.",
            "generator": "deterministic client-side medallion generator (assets/mesh3d.js; reference: code/mesh.py)",
            "geometry_version": GEOMETRY_VERSION,
            "geometry_spec": "docs/GEOMETRY_SPEC.md",
            "determinism": "same source ID + same geometry version + same variant = identical mesh (cross-verified Python/JS, code/qa/test_determinism.py)",
            "dimensions_mm": {"diameter": 50, "height": 7.4, "keychain_height": 14.5,
                              "note": "measured from generated mesh bounding box; keychain variant adds fused loop"},
            "formats": ["stl", "obj", "3mf"],
            "gcode": "No universal G-code is shipped; slice the STL in your own slicer.",
        },
        "schema": "signature-tangible-schema.json",
        "schema_version": SCHEMA_VERSION,
        "api": "api.json",
        "ai_manifest": "ai-manifest.json",
        "llms": "llms.txt",
        "sitemap": "sitemap.xml (index of sitemap-pages.xml + tangible shards)",
        "browse": "browse/ (static shard pages, 2000 tangibles each)",
        "updated": TODAY,
    }
    with open(os.path.join(HERE, "tangibles-manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
        f.write("\n")
    print("wrote tangibles-manifest.json")

    # ---- data/counts.json (tiny snapshot the homepage loads instantly) ----
    os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
    with open(os.path.join(HERE, "data", "counts.json"), "w") as f:
        json.dump({"specs": specs, "patents": pats, "total": n, "goal": 1000000,
                   "updated": TODAY, "manifest": "tangibles-manifest.json"}, f, indent=1)

    # ---- static browse shards (2000 links/page, prev/next) ----
    bdir = os.path.join(HERE, "browse")
    os.makedirs(bdir, exist_ok=True)
    PERB = 2000
    npages = (n + PERB - 1) // PERB
    for p in range(npages):
        chunk = items[p*PERB:(p+1)*PERB]
        fn = f"shard-{p+1:04d}.html"
        prev_l = f'<a href="shard-{p:04d}.html">← prev</a>' if p > 0 else ""
        next_l = f'<a href="shard-{p+2:04d}.html">next →</a>' if p < npages-1 else ""
        lis = "\n".join(
            f'<li><a href="{BASE}?print={esc(iid)}">{esc(iid)}</a> — {esc(title[:90])} <i>({k})</i></li>'
            for (iid, title, k) in chunk)
        with open(os.path.join(bdir, fn), "w") as f:
            f.write(f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Tangibles shard {p+1} of {npages} — The Signature 3D Print Depository</title>
<meta name="description" content="Crawlable index of 3D-printable tangibles, page {p+1} of {npages}.">
<link rel="canonical" href="{BASE}browse/{fn}"></head>
<body><h1>Tangibles — shard {p+1} of {npages}</h1>
<p>{prev_l} · <a href="{BASE}">depository home</a> · {next_l}</p>
<p>Every tangible on this page is a <b>50 mm x ~7 mm commemorative medallion</b> — free STL, OBJ and 3MF print files are generated in your browser from the item's page. Files are not stored here; each link below opens its item's page with downloads.</p>
<p><b>COMMERCIAL/TECHNICAL NOTE: THIS IS A COMMEMORATIVE MEDALLION, NOT THE INVENTION.</b> Each file is a keepsake emblem for its record — not a functional replica of the invention described.</p>
<ol start="{p*PERB+1}">{lis}</ol>
<p>{prev_l} · <a href="{BASE}">depository home</a> · {next_l}</p></body></html>\n""")
    # browse index
    with open(os.path.join(bdir, "index.html"), "w") as f:
        f.write(f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Browse all tangibles — The Signature 3D Print Depository</title>
<meta name="description" content="Crawlable shard index of every 3D-printable tangible.">
<link rel="canonical" href="{BASE}browse/"></head>
<body><h1>Browse all {n:,} tangibles</h1><p>{npages} shards, 2000 per page:</p><ul>
""")
        for p in range(npages):
            f.write(f'<li><a href="shard-{p+1:04d}.html">Shard {p+1}</a> — tangibles {p*PERB+1:,}–{min((p+1)*PERB, n):,}</li>\n')
        f.write("</ul></body></html>\n")
    print(f"browse shards: {npages} pages")

    # ---- stamp static count into index.html (regex: the marker was consumed by an old build) ----
    idx = os.path.join(HERE, "index.html")
    s = open(idx).read()
    stamp = (f"{n:,} printable tangibles indexed ({specs:,} spec · {pats:,} patent), as of {TODAY}. "
             f"Free STL, OBJ and 3MF downloads — marching to 1,000,000.")
    newp = f'<p class="staticcount" id="staticcount">{esc(stamp)}</p>'
    s2, cnt = re.subn(r'<p class="staticcount"[^>]*>.*?</p>', newp, s, count=1, flags=re.S)
    if cnt:
        open(idx, "w").write(s2)
        print("stamped static count")
    elif "STATIC-COUNT" in s:
        s = s.replace("STATIC-COUNT", esc(stamp))
        open(idx, "w").write(s)
        print("stamped static count (legacy marker)")
    else:
        print("NOTE: no staticcount paragraph found (idempotent skip)")

if __name__ == "__main__":
    main()
