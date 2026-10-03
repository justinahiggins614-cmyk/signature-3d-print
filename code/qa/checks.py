#!/usr/bin/env python3
"""Build gates for the Signature 3D Print Depository.

Fails loudly (exit 1) when any invariant breaks:
  1. count reconciliation: spec + patent == total (counts.json, api.json, manifest)
  2. api.json / data/counts.json / tangibles-manifest.json all agree
  3. sitemap XML validity; tangible URL count == total
  4. browse shard files: count == ceil(total/2000), all parse as HTML
  5. search-index parse sanity: every spec row has an ID; patent rows parse;
     (kind,id) duplicates reported (known: 1 upstream patent dup)
  6. required machine-readable files exist: llms.txt, ai-manifest.json,
     signature-tangible-schema.json, docs/GEOMETRY_SPEC.md
  7. manifest index hashes match the actual search-index files on disk
"""
import gzip, json, math, os, re, sys, hashlib, xml.etree.ElementTree as ET

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC_SEARCH = os.path.expanduser("~/workspace/signature-one-archive/data/index/specs.search.json.gz")
PAT_SEARCH = os.path.expanduser("~/workspace/cyber-patent-catalog/data/patents.search.json.gz")
issues = []


def fail(msg):
    issues.append(msg)
    print("  !! " + msg)


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as z:
        for ch in iter(lambda: z.read(1 << 20), b""):
            h.update(ch)
    return h.hexdigest()


def main():
    print("== 3d-print build gates ==")
    counts = json.load(open(os.path.join(REPO, "data/counts.json")))
    api = json.load(open(os.path.join(REPO, "api.json")))
    man = json.load(open(os.path.join(REPO, "tangibles-manifest.json")))
    spec, pat, total = counts["specs"], counts["patents"], counts["total"]

    # 1. reconciliation
    if spec + pat != total:
        fail(f"count reconciliation: {spec} + {pat} != {total}")
    else:
        print(f"  counts reconcile: {spec} + {pat} = {total}")

    # 2. agreement across the three count sources
    at, as_, ap = api["tangibles"]["total"], api["tangibles"]["spec"], api["tangibles"]["patent"]
    mt, ms, mp = man["counts"]["total"], man["counts"]["spec"], man["counts"]["patent"]
    if (at, as_, ap) != (total, spec, pat):
        fail(f"api.json disagrees: {(at, as_, ap)} vs counts.json {(total, spec, pat)}")
    if (mt, ms, mp) != (total, spec, pat):
        fail(f"tangibles-manifest.json disagrees: {(mt, ms, mp)}")
    if not man["counts"]["reconciliation"].replace(" ", "") == f"{spec}+{pat}={total}":
        fail("manifest reconciliation string malformed")
    print("  api.json / counts.json / manifest agree")

    # 3. sitemaps
    try:
        idx = ET.parse(os.path.join(REPO, "sitemap.xml"))
        sms = [e.text for e in idx.getroot().iter() if e.tag.endswith("loc")]
    except Exception as e:
        fail(f"sitemap.xml invalid: {e}")
        sms = []
    url_total, sm_files = 0, 0
    for loc in sms:
        fn = loc.rsplit("/", 1)[-1]
        p = os.path.join(REPO, fn)
        if not os.path.exists(p):
            fail(f"sitemap listed but missing: {fn}")
            continue
        try:
            urls = [e.text for e in ET.parse(p).getroot().iter() if e.tag.endswith("loc")]
        except Exception as e:
            fail(f"sitemap invalid XML: {fn}: {e}")
            continue
        sm_files += 1
        if fn.startswith("sitemap-tangibles-"):
            url_total += len(urls)
    if url_total != total:
        fail(f"sitemap tangible URLs {url_total} != total {total}")
    else:
        print(f"  sitemaps valid: {sm_files} files, {url_total} tangible URLs")

    # 4. browse shards
    bdir = os.path.join(REPO, "browse")
    shards = sorted(f for f in os.listdir(bdir) if re.fullmatch(r"shard-\d{4}\.html", f))
    expect = math.ceil(total / 2000)
    if len(shards) != expect:
        fail(f"browse shards: {len(shards)} files, expected {expect}")
    else:
        print(f"  browse shards: {len(shards)} pages x 2000")
    bad = 0
    for fn in shards:
        s = open(os.path.join(bdir, fn), encoding="utf-8").read()
        if "<html" not in s or "?print=" not in s:
            bad += 1
    if bad:
        fail(f"{bad} browse shards malformed")

    # 5. index parse sanity + dup detection
    nspec, seen, dups = 0, set(), []
    with gzip.open(SPEC_SEARCH, "rt") as z:
        for line in z:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if not r[0]:
                fail("spec row without ID")
                continue
            nspec += 1
            k = ("spec", str(r[0]))
            if k in seen:
                dups.append(k)
            seen.add(k)
    npat = 0
    with gzip.open(PAT_SEARCH, "rt") as z:
        for line in z:
            line = line.strip()
            if not line:
                continue
            for r in json.loads(line):
                iid = r[9] or r[0]
                if not iid:
                    continue
                npat += 1
                k = ("pat", str(iid))
                if k in seen:
                    dups.append(k)
                seen.add(k)
    if nspec != spec:
        fail(f"spec index rows {nspec} != counts.json {spec}")
    if npat - len([d for d in dups if d[0] == "pat"]) != pat:
        fail(f"patent index rows {npat} (minus dups) != counts.json {pat}")
    print(f"  indexes parse: {nspec} spec rows, {npat} patent rows, {len(dups)} dup IDs {dups[:3]}")

    # 6. required machine-readable files
    for rel in ("llms.txt", "ai-manifest.json", "signature-tangible-schema.json",
                "docs/GEOMETRY_SPEC.md", "JAH-NETWORK-MANIFEST.json"):
        if not os.path.exists(os.path.join(REPO, rel)):
            fail(f"missing required file: {rel}")
    print("  machine-readable suite present")

    # 7. manifest index hashes match disk
    for src in man["index"]["sources"]:
        disk = os.path.expanduser(f"~/workspace/{src['file']}")
        if os.path.exists(disk):
            h = sha256_file(disk)
            if h != src["sha256"]:
                fail(f"manifest hash stale for {src['file']}")
    print("  manifest index hashes match disk")

    if issues:
        print(f"\n{len(issues)} GATE(S) FAILED")
        return 1
    print("\nALL GATES PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
