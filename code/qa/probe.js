#!/usr/bin/env node
/* Determinism + parity probe for assets/mesh3d.js.
   Usage: node probe.js <recordId> [keychain]
   Prints: facets, bbox, sha256(canonical rounded coords), stl bytes.
*/
"use strict";
const fs = require("fs"), crypto = require("crypto"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "mesh3d.js"), "utf8");
const sandbox = {};
// mesh3d.js declares top-level functions; evaluate in a function scope and export what we need
const factory = new Function("module", "exports", src + "\n;return {medallion, stlAscii, objText, threeMF, medallionParams};");
const M = factory({}, {});
// note: medallionParams is the top-view layout helper; meshBBox lives in index.html
const rid = process.argv[2] || "JAH-SPEC-000123";
const kc = process.argv[3] === "keychain";
const m = M.medallion(rid, kc);
const bb = (function(){var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const f of m.facets){for(let k=1;k<=3;k++){const p=f[k];
    for(let a=0;a<3;a++){if(p[a]<mn[a])mn[a]=p[a];if(p[a]>mx[a])mx[a]=p[a]}}}
  return {min:mn,max:mx}})();
const canon = [];
for (const f of m.facets) {
  const tri = [f[1], f[2], f[3]].map(p => p.map(v => v.toFixed(4)).join(",")).sort();
  canon.push(tri.join("|"));
}
canon.sort();
const hash = crypto.createHash("sha256").update(canon.join(";")).digest("hex");
const stl = M.stlAscii(m, "tangible");
console.log(JSON.stringify({
  id: rid, keychain: kc,
  facets: m.facets.length,
  bbox: {min: bb.min.map(v=>+v.toFixed(4)), max: bb.max.map(v=>+v.toFixed(4))},
  canon_sha256: hash,
  stl_bytes: Buffer.byteLength(stl, "utf8"),
  obj_bytes: Buffer.byteLength(M.objText(m, "tangible"), "utf8"),
  mf3_bytes: M.threeMF(m, "tangible").length,
  params: M.medallionParams(rid)
}));
