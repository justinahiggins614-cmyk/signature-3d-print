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
import json, gzip, os, html, datetime

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://justinahiggins614-cmyk.github.io/signature-3d-print/"
SPEC_SEARCH = os.path.expanduser("~/workspace/signature-one-archive/data/index/specs.search.json.gz")
PAT_SEARCH = os.path.expanduser("~/workspace/cyber-patent-catalog/data/patents.search.json.gz")
TODAY = datetime.date.today().isoformat()

def load():
    items = []  # (id, title, kind)
    with gzip.open(SPEC_SEARCH, "rt") as z:
        for line in z:
            r = json.loads(line)
            items.append((r[0], r[1], "spec"))
    with gzip.open(PAT_SEARCH, "rt") as z:
        for line in z:
            for r in json.loads(line):
                items.append((r[9] or r[0], r[1] or "Untitled patent record", "pat"))
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

    # ---- data/counts.json ----
    os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
    with open(os.path.join(HERE, "data", "counts.json"), "w") as f:
        json.dump({"specs": specs, "patents": pats, "total": n, "goal": 1000000, "updated": TODAY}, f, indent=1)

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

    # ---- stamp static count into index.html ----
    idx = os.path.join(HERE, "index.html")
    s = open(idx).read()
    stamp = (f"{n:,} printable tangibles indexed ({specs:,} spec · {pats:,} patent), as of {TODAY}. "
             f"Free STL, OBJ and 3MF downloads — marching to 1,000,000.")
    if "STATIC-COUNT" in s:
        s = s.replace("STATIC-COUNT", esc(stamp))
        open(idx, "w").write(s)
        print("stamped static count")
    else:
        print("NOTE: STATIC-COUNT marker already replaced (idempotent skip)")

if __name__ == "__main__":
    main()
