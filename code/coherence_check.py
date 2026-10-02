#!/usr/bin/env python3
"""AI coherence check: every AI profile this site presents vs the phone-book canon.

Manon's order (2026-10-02): "There should be no ai any website incoherent" --
every AI profile matches the phone-book canon exactly. Canon source:
  ~/workspace/jah-ai-models/ai-catalog.json  (records[].ID/NAME/DESCRIPTION)

What this checks:
  1. Parses the JAH AI PROFILE blocks in index.html (var JIT_PROFILE_<X>={...};).
  2. Any profile claiming a non-empty canon ID must match the canon record's
     NAME and DESCRIPTION exactly (whitespace-normalized). Mismatch -> exit 1.
  3. Site-helper profiles (empty id) must NOT claim a canon ID anywhere in
     their fields -- they are presented as helpers with the JAHtalk voice.
  4. Scans the whole page for other canon-ID claims (JAH-AI-...) not declared
     in a profile -- those are drift and fail loudly.

Exit 0 = coherent. Exit 1 = drift found (loud report).
"""
import json, os, re, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANON_PATH = os.path.expanduser("~/workspace/jah-ai-models/ai-catalog.json")
PAGE_PATH = os.path.join(REPO, "index.html")


def norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def str_field(block, key):
    m = re.search(r'"' + key + r'"\s*:\s*"((?:[^"\\]|\\.)*)"', block)
    if not m:
        return ""
    return m.group(1).replace('\\"', '"').replace("\\\\", "\\")


def extract_profiles(html):
    """Find var JIT_PROFILE_<NAME>={ ... }; blocks with brace matching."""
    out = []
    for m in re.finditer(r"var\s+JIT_PROFILE_(\w+)\s*=\s*\{", html):
        name = m.group(1)
        depth = 1
        i = m.end()
        in_str = None
        esc = False
        while i < len(html) and depth:
            ch = html[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == in_str:
                    in_str = None
            else:
                if ch in '"\'':
                    in_str = ch
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
            i += 1
        body = html[m.end() - 1:i]
        out.append({
            "slot": name,
            "name": str_field(body, "name"),
            "id": str_field(body, "id"),
            "description": str_field(body, "description"),
        })
    return out


def main():
    issues, helpers = [], []
    html = open(PAGE_PATH, encoding="utf-8").read()
    canon = json.load(open(CANON_PATH, encoding="utf-8"))
    by_id = {r.get("ID", ""): r for r in canon.get("records", [])}

    profiles = extract_profiles(html)
    print(f"site profiles found: {len(profiles)}")
    for p in profiles:
        tag = f'JIT_PROFILE_{p["slot"]}'
        if p["id"]:
            rec = by_id.get(p["id"])
            if not rec:
                issues.append(f"{tag}: claims canon ID {p['id']} which is NOT in the canon catalog")
                continue
            if norm(p["name"]).lower() != norm(rec.get("NAME", "")).lower():
                issues.append(f'{tag}: name "{p["name"]}" != canon "{rec.get("NAME")}" for {p["id"]}')
            if norm(p["description"]) != norm(rec.get("DESCRIPTION", "")):
                issues.append(f"{tag}: description drift vs canon for {p['id']}")
        else:
            # helper AI: must not smuggle a canon identity in any field
            blob = " ".join([p["name"], p["description"]])
            smuggled = re.findall(r"JAH-AI-[A-Za-z0-9-]+", blob)
            if smuggled:
                issues.append(f"{tag}: helper AI claims canon ID(s) {smuggled} in profile text")
            helpers.append((tag, p["name"]))

    # any other canon-ID claims on the page outside declared profiles?
    profile_ids = {p["id"] for p in profiles if p["id"]}
    stray = sorted(set(re.findall(r"JAH-AI-[A-Za-z0-9-]+", html)) - profile_ids)
    if stray:
        issues.append(f"undeclared canon-ID claims on page: {stray}")

    print("helpers (no canon ID, JAHtalk voice):")
    for tag, nm in helpers:
        print(f"  - {tag}: \"{nm}\"")
    if issues:
        print("\nCOHERENCE DRIFT -- FAIL:")
        for i in issues:
            print("  !! " + i)
        return 1
    print("\nCOHERENT: every AI profile matches the phone-book canon.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
