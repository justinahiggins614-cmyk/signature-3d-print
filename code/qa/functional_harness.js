#!/usr/bin/env node
/* Functional harness for The Signature 3D Print Depository (site 27/27).
 * Drives the REAL shipped code:
 *   Part A: assets/mesh3d.js (mesh generation + STL/OBJ/3MF writers) in Node.
 *   Part B: the full index.html inline page script in a vm sandbox with a
 *           hand-rolled DOM + stubbed fetch serving tiny gzipped fixtures of
 *           the REAL search-index formats (JSONL specs, JSON-array patents).
 * Run: node code/qa/functional_harness.js
 * Exit 0 = all PASS, 1 = any FAIL.
 */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"),
      zlib = require("zlib");
const REPO = path.resolve(__dirname, "..", "..");
const M = require(path.join(REPO, "assets", "mesh3d.js"));

let pass = 0, fail = 0;
const results = [];
function t(name, fn) {
  try { fn(); pass++; results.push("PASS  " + name); }
  catch (e) { fail++; results.push("FAIL  " + name + "  :: " + (e && e.message)); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || "") + " expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function ok(c, msg) { if (!c) throw new Error(msg || "assertion failed"); }
function approx(a, b, eps, msg) { if (Math.abs(a - b) > eps) throw new Error((msg || "") + " expected ~" + b + ", got " + a); }

/* ================= Part A: mesh + formats (real mesh3d.js) ================= */
const ID1 = "JAH-SPEC-000123", ID2 = "JAH-PAT-004567";

t("A1 determinism: same ID -> identical STL bytes", () => {
  const a = M.stlAscii(M.medallion(ID1, false), "x");
  const b = M.stlAscii(M.medallion(ID1, false), "x");
  eq(a, b);
});
t("A2 determinism: medallionParams stable + matches medallion", () => {
  const p1 = M.medallionParams(ID1), p2 = M.medallionParams(ID1);
  eq(JSON.stringify(p1), JSON.stringify(p2));
  ok(p1.rays.length >= 8 && p1.rays.length <= 16, "ray count in range");
  ok(p1.notches >= 4 && p1.notches <= 15, "notch count in range");
});
t("A3 keychain variant is a real variant (adds loop, more facets)", () => {
  const med = M.medallion(ID1, false), kc = M.medallion(ID1, true);
  ok(med.facets.length > 0, "medallion has facets");
  ok(kc.facets.length > med.facets.length, "keychain adds facets");
});
t("A4 normals are unit-length, non-degenerate triangles", () => {
  for (const id of [ID1, ID2]) for (const kc of [false, true]) {
    const m = M.medallion(id, kc);
    for (const f of m.facets) {
      const n = f[0], l = Math.hypot(n[0], n[1], n[2]);
      ok(l > 0.999 && l < 1.001, "normal not unit: " + l);
      const a = f[1], b = f[2], c = f[3];
      const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
      const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
      const area = Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx) / 2;
      ok(area > 1e-9, "degenerate triangle");
    }
  }
});
function edgeKey(p, q) {
  // normalize -0 -> 0: trig seams (e.g. sin(2*PI) = -2.4e-16) must key identically
  const f = v => { const r = +v.toFixed(6); return (r === 0 ? 0 : r).toFixed(6); };
  const a = p.map(f).join(","), b = q.map(f).join(",");
  return a < b ? a + "|" + b : b + "|" + a;
}
t("A5 mesh validity: every shell closed (edges shared by exactly 2 triangles)", () => {
  // honest note: the medallion is a multi-shell assembly (base+rim+rays+emblem
  // intersect); this check verifies each shell is closed, which is what slicers union.
  for (const kc of [false, true]) {
    const m = M.medallion(ID1, kc), counts = {};
    for (const f of m.facets)
      for (const [p, q] of [[f[1], f[2]], [f[2], f[3]], [f[3], f[1]]]) {
        const k = edgeKey(p, q); counts[k] = (counts[k] || 0) + 1;
      }
    const keys = Object.keys(counts);
    const bad = keys.filter(k => counts[k] !== 2);
    const pct = (100 * (keys.length - bad.length) / keys.length).toFixed(2);
    ok(bad.length === 0, kc + ": " + bad.length + " of " + keys.length + " edges not paired (" + pct + "% closed)");
  }
});
t("A6 STL output: solid/endsolid envelope, facet count matches mesh", () => {
  for (const kc of [false, true]) {
    const m = M.medallion(ID1, kc), s = M.stlAscii(m, "tangible-" + ID1);
    ok(s.startsWith("solid tangible-" + ID1 + "\n"), "solid header");
    ok(s.endsWith("endsolid tangible-" + ID1 + "\n"), "endsolid footer");
    const n = (s.match(/facet normal/g) || []).length;
    eq(n, m.facets.length, "stl facet count");
  }
});
t("A7 OBJ output: vertices parse, face indices valid, facet count matches", () => {
  const m = M.medallion(ID1, false), s = M.objText(m, "tangible-" + ID1);
  const lines = s.split("\n");
  const v = lines.filter(l => l.startsWith("v ")).length;
  const f = lines.filter(l => l.startsWith("f "));
  eq(f.length, m.facets.length, "obj face count");
  for (const fl of f) {
    const idx = fl.slice(2).trim().split(/\s+/).map(Number);
    eq(idx.length, 3, "triangle face");
    for (const i of idx) ok(Number.isInteger(i) && i >= 1 && i <= v, "face index out of range: " + i);
  }
});
function parseStoredZip(buf) {
  // minimal parser for the harness's own stored-zip (no compression)
  const files = {}; let p = 0;
  const u16 = o => buf.readUInt16LE(o), u32 = o => buf.readUInt32LE(o);
  while (u32(p) === 0x04034b50) {
    const crc = u32(p + 14), sz = u32(p + 18), nl = u16(p + 26), el = u16(p + 28);
    const name = buf.toString("utf8", p + 30, p + 30 + nl);
    const data = buf.subarray(p + 30 + nl + el, p + 30 + nl + el + sz);
    files[name] = { data, crc, sz };
    p += 30 + nl + el + sz;
  }
  return files;
}
t("A8 3MF output: valid ZIP, model XML well-formed, triangle count matches", () => {
  for (const kc of [false, true]) {
    const m = M.medallion(ID1, kc), z = M.threeMF(m, "tangible-" + ID1);
    ok(z[0] === 0x50 && z[1] === 0x4b, "PK magic");
    const files = parseStoredZip(Buffer.from(z));
    ok(files["[Content_Types].xml"] && files["_rels/.rels"] && files["3D/3dmodel.model"], "3MF parts present");
    const xml = files["3D/3dmodel.model"].data.toString("utf8");
    ok(xml.includes('unit="millimeter"'), "millimeter units");
    const tris = (xml.match(/<triangle /g) || []).length;
    eq(tris, m.facets.length, "3mf triangle count");
    const verts = (xml.match(/<vertex /g) || []).length;
    ok(verts > 0, "vertices present");
    for (const [, f] of Object.entries(files)) {
      const c = M_crc32(f.data);
      eq(c, f.crc, "crc32 of " + f.sz + " bytes");
    }
  }
});
function M_crc32(bytes) {
  const T = (() => { const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = T[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
t("A9 cross-check: shipped python<->JS determinism suite passes", () => {
  const { execFileSync } = require("child_process");
  const out = execFileSync("python3", [path.join(REPO, "code", "qa", "test_determinism.py")],
    { encoding: "utf8", timeout: 120000 });
  ok(/PASS/.test(out), "no PASS lines in determinism output");
  ok(!/FAIL/.test(out), "FAIL in determinism output:\n" + out);
});

/* ================= Part B: full page script in a vm sandbox ================= */
async function partB() {
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  const start = html.indexOf('<script>\n"use strict";');
  ok(start > 0, "inline script found");
  const end = html.indexOf("</script>", start);
  const pageSrc = html.slice(start + 8, end);

  // ---- tiny gzipped fixtures in the REAL index formats ----
  const specRows = [
    ["JAH-SPEC-000123", "Solar water pump", 1, 2, "Energy"],
    ["JAH-SPEC-000124", "Solar garden lights", 1, 2, "Energy"],
    ["JAH-SPEC-000200", "Kitchen dough mixer", 1, 2, "Food"],
    ["JAH-SPEC-643512", "Quantum widget calibrator", 755, 16, "Physics"],
  ];
  const patRows = [
    ["US7654321B2", "Water pump assembly", "", "Jane Inventor", "Acme Corp", "Pumps", "2020-01-01", "", "", "JAH-PAT-000343"],
    ["US8123456B2", "Solar panel frame", "", "John Smith", "Solar Inc", "Energy", "2021-06-01", "", "", "JAH-PAT-000344"],
  ];
  const specGz = zlib.gzipSync(specRows.map(r => JSON.stringify(r)).join("\n") + "\n");
  const patGz = zlib.gzipSync(JSON.stringify(patRows));
  const countsFixture = { specs: 643512, patents: 53651, total: 697163, updated: "2026-10-03" };

  async function fakeFetch(url) {
    if (String(url).includes("data/counts.json"))
      return new Response(JSON.stringify(countsFixture), { status: 200 });
    if (String(url).includes("specs.search.json.gz"))
      return new Response(specGz, { status: 200 });
    if (String(url).includes("patents.search.json.gz"))
      return new Response(patGz, { status: 200 });
    if (String(url).includes("JAH-NETWORK-MANIFEST.json"))
      return new Response(JSON.stringify({ site_count: 27, site_number: 27 }), { status: 200 });
    return new Response("not found", { status: 404 });
  }

  // ---- hand-rolled DOM ----
  const domHandlers = {};
  function El(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this.children = []; this._innerHTML = ""; this.textContent = "";
    this.value = ""; this.style = {}; this.dataset = {}; this._attrs = {};
    this._cls = new Set(); this.parentNode = null; this.onclick = null;
    this.disabled = false; this.scrollTop = 0; this.offsetParent = {};
    const self = this;
    this.classList = {
      add(c) { self._cls.add(c); }, remove(c) { self._cls.delete(c); },
      toggle(c, f) { if (f === undefined) f = !self._cls.has(c);
        f ? self._cls.add(c) : self._cls.delete(c); return f; },
      contains(c) { return self._cls.has(c); }
    };
  }
  El.prototype.addEventListener = function (t, cb) { (this._ev = this._ev || {})[t] = cb; };
  El.prototype.appendChild = function (c) { this.children.push(c); c.parentNode = this; try{this._innerHTML += c._innerHTML||""}catch(e){} return c; };
  El.prototype.insertAdjacentHTML = function (p, h) {
    this._innerHTML = p === "afterbegin" ? h + this._innerHTML : this._innerHTML + h; };
  El.prototype.querySelector = function () { return new El("div"); };
  El.prototype.querySelectorAll = function () { return []; };
  El.prototype.setAttribute = function (k, v) { this._attrs[k] = v; };
  El.prototype.getAttribute = function (k) { return this._attrs[k] || null; };
  El.prototype.remove = function () {};
  El.prototype.removeChild = function (c) { return c; };
  El.prototype.getBoundingClientRect = function () { return { top: 50, bottom: 150 }; };
  El.prototype.scrollIntoView = function () {};
  El.prototype.click = function () { if (this.onclick) this.onclick(); };
  El.prototype.focus = function () {};
  El.prototype.select = function () {};
  Object.defineProperty(El.prototype, "innerHTML", {
    get() { return this._innerHTML; }, set(v) { this._innerHTML = String(v); }
  });
  const els = {};
  const documentStub = {
    getElementById(id) { return els[id] || (els[id] = new El("div")); },
    createElement(tag) { return new El(tag); },
    querySelector() { return new El("div"); },
    querySelectorAll() { return []; },
    addEventListener(t, cb) { domHandlers["doc:" + t] = cb; },
    body: new El("body"), head: new El("head"),
    documentElement: new El("html"), title: ""
  };
  const store = {};
  const locationStub = { href: "https://example/signature-3d-print/", search: "", pathname: "/", hash: "" };
  const captured = { anchors: [], audMsgs: [] };

  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    URL, Blob, Response, Request, Headers,
    TextEncoder, TextDecoder, AbortController,
    DecompressionStream, ReadableStream, TransformStream,
    URLSearchParams, RegExp, JSON, Math, Date, Promise, Array, Object,
    document: documentStub,
    window: {},
    navigator: {},
    localStorage: {
      getItem(k) { return k in store ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; }
    },
    location: locationStub,
    fetch: fakeFetch,
    alert() {}, prompt(m, d) { return d || ""; },
    requestAnimationFrame(cb) { setTimeout(cb, 0); },
    Audio: class { constructor(src) { this.src = src; } play() { return Promise.resolve(); } pause() {} },
    getComputedStyle() { return {}; },
    addEventListener() {}, removeEventListener() {}
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox; // bare `window.X` refs resolve
  vm.createContext(sandbox);

  // mesh3d.js globals first (as the browser loads it before the main script)
  vm.runInContext(fs.readFileSync(path.join(REPO, "assets", "mesh3d.js"), "utf8"), sandbox, { filename: "mesh3d.js" });
  vm.runInContext(fs.readFileSync(path.join(REPO, "js", "jah-talk-fallback.js"), "utf8"), sandbox, { filename: "jah-talk-fallback.js" });
  vm.runInContext(pageSrc, sandbox, { filename: "index-inline.js" });

  const R = (src) => vm.runInContext(src, sandbox);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function until(cond, ms) {
    const t0 = Date.now();
    while (!cond()) { if (Date.now() - t0 > (ms || 15000)) throw new Error("timeout waiting"); await sleep(50); }
  }

  // capture anchor-click downloads
  const origCreate = documentStub.createElement.bind(documentStub);
  documentStub.createElement = function (tag) {
    const e = origCreate(tag);
    if (String(tag).toLowerCase() === "a") {
      const old = e.click.bind(e);
      e.click = function () { captured.anchors.push({ href: this.href, download: this.download }); };
    }
    return e;
  };
  // capture toast messages
  sandbox.__audMsgs = captured.audMsgs;
  R(`(function(){var _am=audMsg; audMsg=function(m){__audMsgs.push(m); _am(m)};})()`);

  // ---- boot the page ----
  await bt("B1 boot: DOMContentLoaded -> finder greets, chips render", async () => {
    const cb = domHandlers["doc:DOMContentLoaded"];
    ok(cb, "DOMContentLoaded handler registered");
    cb();
    await until(() => (els["flog"] && els["flog"].children.length >= 2));
    ok(els["fchips"].innerHTML.includes("solar power"), "finder chips rendered");
  });

  await bt("B2 counts: stamped chip replaced by live chips with real count", async () => {
    await until(() => els["livecounts"] && /697,163/.test(els["livecounts"].innerHTML));
    ok(els["livecounts"].innerHTML.includes("Spec tangibles"), "spec chip present");
    ok(els["livecounts"].innerHTML.includes("Patent tangibles"), "patent chip present");
  });

  await bt("B3 DB.load parses real index formats (JSONL specs + JSON-array patents)", async () => {
    await until(() => R("DB.rows.length") === 6);
    eq(R("DB.counts.specs"), 4); eq(R("DB.counts.patents"), 2);
    eq(R("DB.resolve('JAH-SPEC-000123').title"), "Solar water pump");
    eq(R("DB.resolve('JAH-PAT-000343').title"), "Water pump assembly");
    eq(R("DB.resolve('US7654321B2').title"), "Water pump assembly"); // by pub number
    eq(R("DB.resolve('BOGUS-ID-!!!')"), null);
  });

  await bt("B4 browse grid renders all cards + match line", () => {
    R("App.search(true)");
    eq(R("App.shown"), 6);
    ok(/Showing 6 of 6 matching tangibles/.test(els["matchcount"].textContent), "match line: " + els["matchcount"].textContent);
    ok(els["grid"].innerHTML.includes("JAH-SPEC-000123"), "spec card present");
    ok(els["grid"].innerHTML.includes("DRAFT SPECIFICATION"), "draft badge present");
    ok(els["grid"].innerHTML.includes("PUBLIC RECORD"), "public-record badge present");
  });

  await bt("B5 filter: ALL / SPEC / PATENT tabs", () => {
    R("App.setSrc('spec')"); eq(R("App.grid.length"), 4);
    R("App.setSrc('pat')"); eq(R("App.grid.length"), 2);
    R("App.setSrc('all')"); eq(R("App.grid.length"), 6);
  });

  await bt("B6 filter: category dropdown", () => {
    R("App.setCat('Energy')"); eq(R("App.grid.length"), 3); // 2 spec + 1 patent
    R("App.setCat('')");
  });

  await bt("B7 search: title / ID / category query", () => {
    R("App.q='solar';App.search(true)"); eq(R("App.grid.length"), 3);
    R("App.q='JAH-PAT-000343';App.search(true)"); eq(R("App.grid.length"), 1);
    R("App.q='pumps';App.search(true)"); eq(R("App.grid.length"), 1);
    R("App.q='zzz-no-match';App.search(true)");
    ok(els["grid"].innerHTML.includes("No tangibles match"), "empty-state message");
    R("App.q='';App.search(true)");
  });

  await bt("B8 filter: A-Z letter chips", () => {
    R("App.letter='S';App.search(true)"); eq(R("App.grid.length"), 3); // Solar x2 + US... no: S-titles
    R("App.letter='';App.search(true)");
  });

  await bt("B9 Load More pages the grid", () => {
    R("App.page=2;App.search(true)"); eq(R("App.shown"), 2);
    R("App.more()"); eq(R("App.shown"), 4);
    R("App.more()"); eq(R("App.shown"), 6);
    R("App.page=60");
  });

  await bt("B10 Finder: keywords + scoring + ask flow", async () => {
    const kw = R("JSON.stringify(Finder.keywords('I want a solar water pump for my garden please'))");
    eq(kw, JSON.stringify(["solar", "water", "pump", "garden"]));
    const sc = R("JSON.stringify(Finder.score(DB.resolve('JAH-SPEC-000123'),['solar','pump']))");
    const o = JSON.parse(sc);
    ok(o.s > 0 && o.fields.includes("TITLE"), "scores on title: " + sc);
    const n0 = els["flog"].children.length;
    els["fq"].value = "solar pump";
    await R("Finder.ask()");
    await until(() => els["flog"].children.length >= n0 + 2);
    ok(els["flog"].innerHTML.includes("Take me there"), "finder links a tangible");
    ok(els["flog"].innerHTML.includes("MATCHED:"), "finder shows matched fields");
  });

  await bt("B11 item view: data, warning BEFORE downloads, variant switch", () => {
    R("Item.show(DB.resolve('JAH-SPEC-000123'))");
    const h = els["itemview"].innerHTML;
    ok(h.includes("JAH-SPEC-000123") && h.includes("Solar water pump"), "record data shown");
    const warnAt = h.indexOf("COMMERCIAL/TECHNICAL NOTE");
    ok(warnAt > 0, "commemorative warning present");
    ok(warnAt < h.indexOf("Print3D.dl('stl')"), "warning sits BEFORE the download buttons");
    ok(h.indexOf('<p class="dlwarn">') < h.indexOf('class="dlrow"'), "dlwarn block precedes dlrow");
    R("Item.setVariant('keychain')");
    ok(els["pv"].innerHTML.includes("keychain variant"), "keychain preview note");
    const rec = R("JSON.stringify(Item.recordJSON(DB.resolve('JAH-SPEC-000123')))"), rj = JSON.parse(rec);
    eq(rj.object_purpose, "COMMEMORATIVE_RECORD_EMBLEM");
    eq(rj.functional_replica, false);
    eq(rj.keychain_available, true);
  });

  await bt("B12 STL download: real bytes via the real download path", async () => {
    captured.anchors.length = 0;
    R("Item.show(DB.resolve('JAH-SPEC-000123'))");
    R("Print3D.dl('stl')");
    await until(() => captured.anchors.length > 0);
    const a = captured.anchors[0];
    eq(a.download, "tangible-JAH-SPEC-000123-medallion.stl");
    await until(() => /Done/.test(els["dlstep"].textContent));
  });

  await bt("B13 OBJ + 3MF downloads produce valid files", async () => {
    // exercise the writers through the same code the buttons call
    const stl = R("stlAscii(Print3D.mesh(),'tangible-JAH-SPEC-000123')");
    ok(stl.startsWith("solid tangible-JAH-SPEC-000123"), "stl solid line");
    const obj = R("objText(Print3D.mesh(),'tangible-JAH-SPEC-000123')");
    ok(obj.includes("\nf "), "obj faces");
    const z = R("threeMF(Print3D.mesh(),'tangible-JAH-SPEC-000123')");
    eq(z[0], 0x50); eq(z[1], 0x4b);
    captured.anchors.length = 0;
    R("Print3D.dl('obj')"); await until(() => captured.anchors.length > 0);
    eq(captured.anchors[0].download, "tangible-JAH-SPEC-000123-medallion.obj");
    captured.anchors.length = 0;
    R("Print3D.dl('3mf')"); await until(() => captured.anchors.length > 0);
    eq(captured.anchors[0].download, "tangible-JAH-SPEC-000123-medallion.3mf");
  });

  await bt("B14 BEFORE YOU DOWNLOAD panel: real measured dimensions", () => {
    R("Item.show(DB.resolve('JAH-PAT-000343'))");
    const h = els["dlspec"].innerHTML;
    ok(/50\.0 × 50\.0 × 7\.4 mm/.test(h), "measured dims: " + h.slice(0, 120));
    ok(h.includes("Est. material"), "material estimate");
    ok(h.includes("none required"), "supports note");
  });

  await bt("B15 malformed + very-large IDs: human-readable message", () => {
    R("App.setSrc('all');App.q='';App.letter='';App.search(true)");
    R("App.showNotFound('BOGUS-ID-!!!')");
    const h = els["grid"].innerHTML;
    ok(h.includes("No tangible found"), "human message");
    ok(h.includes("JAH-SPEC-000123"), "shows the ID format to copy");
    ok(h.includes("BACK TO THE VAULT"), "recovery action");
    R("App.showNotFound('JAH-SPEC-99999999999999999999')");
    ok(els["grid"].innerHTML.includes("No tangible found"), "very-large ID handled");
  });

  await bt("B16 random: pulls real tangibles across spec and patent", async () => {
    const seen = { spec: 0, pat: 0 };
    R("App.setSrc('all')");
    for (let i = 0; i < 24; i++) {
      locationStub.href = "https://example/";
      await R("App.random()");
      const id = locationStub.href.split("?print=")[1];
      ok(id, "random navigates to a tangible");
      if (decodeURIComponent(id).startsWith("JAH-SPEC")) seen.spec++;
      else seen.pat++;
    }
    ok(seen.spec > 0 && seen.pat > 0, "random spans both kinds: " + JSON.stringify(seen));
    locationStub.href = "https://example/";
    R("App.setSrc('spec')"); await R("App.random()");
    ok(decodeURIComponent(locationStub.href).includes("JAH-SPEC-"), "spec-scoped random");
    R("App.setSrc('all')");
  });

  await bt("B17 tour: steps render, keyboard + localStorage work", () => {
    for (const k of Object.keys(store)) delete store[k];
    R("Tour.maybe()");
    ok(els["tourbanner"].classList.contains("show"), "first-visit prompt shows");
    R("Tour.start(true)");
    ok(els["tourbanner"].innerHTML.includes("step 1 of 6"), "step 1");
    ok(els["tourbanner"].innerHTML.includes("WHAT IT DOES"), "WHAT/WHAT-IT-DOES/HOW format");
    R("Tour.i=1;Tour.show()");
    ok(els["tourbanner"].innerHTML.includes("step 2 of 6"), "next step");
    R("Tour.i=5;Tour.show()");
    ok(els["tourbanner"].innerHTML.includes("honest warning"), "warning step present");
    els["tourbanner"].onkeydown({ key: "Escape" });
    eq(store["jah-tour-seen-print"], "1", "dismissal persisted");
    ok(!els["tourbanner"].classList.contains("show"), "banner hidden after Esc");
    R("Tour.maybe()");
    ok(!els["tourbanner"].classList.contains("show"), "no re-prompt after seen");
  });

  await bt("B18 guide panel: documents every real feature", () => {
    R("Guide.toggle()");
    ok(els["guidepanel"].classList.contains("open"), "panel opens");
    const h = els["guidepanel"].innerHTML;
    for (const kw of ["Finder", "RANDOM", "LOAD MORE", "KEYCHAIN", "SHA-256", "no universal G-code", "STATIC ARCHIVE", "commemorative"])
      ok(h.toLowerCase().includes(kw.toLowerCase()), "guide mentions " + kw);
    R("Guide.toggle()");
    ok(!els["guidepanel"].classList.contains("open"), "panel closes");
  });

  await bt("B19 item Q&A answers from the page, honestly", async () => {
    R("Item.show(DB.resolve('JAH-SPEC-000123'))");
    const n0 = els["qlog"].children.length;
    els["qq"].value = "is this the actual invention";
    R("Ask.ask()");
    await until(() => els["qlog"].children.length > n0);
    ok(els["qlog"].innerHTML.includes("keepsake emblem"), "honest invention answer");
    els["qq"].value = "which printers work";
    R("Ask.ask()");
    await until(() => els["qlog"].children.length > n0 + 1);
    ok(els["qlog"].innerHTML.includes("Any printer"), "printer answer");
  });

  await bt("B20 mesh metrics from page code: volume + bbox honest", () => {
    const v = R("meshVolume(medallion('JAH-SPEC-000123',false))");
    ok(v > 5000 && v < 20000, "medallion volume mm^3 plausible: " + v);
    const bb = R("JSON.stringify(meshBBox(medallion('JAH-SPEC-000123',false)))");
    const o = JSON.parse(bb);
    ok(Math.abs((o.max[0] - o.min[0]) - 50) < 0.01, "50mm across");
    ok(Math.abs((o.max[2] - o.min[2]) - 7.4) < 0.01, "7.4mm tall");
    const kbb = R("JSON.stringify(meshBBox(medallion('JAH-SPEC-000123',true)))");
    ok(JSON.parse(kbb).max[2] > 14, "keychain taller (fused loop)");
  });

  await bt("B21 previewSVG renders for good and bad IDs", () => {
    const s = R("previewSVG('JAH-SPEC-000123',true)");
    ok(s.includes("<svg") && s.includes("JAH-SPEC-000123"), "preview svg");
    const bad = R("previewSVG('',false)");
    ok(bad.includes("unavailable"), "graceful bad-ID preview");
  });

  await bt("B22 index failure path: honest error state with retry + archive link", async () => {
    // point DB at dead endpoints by swapping the fetch stub
    const okFetch = sandbox.fetch;
    sandbox.fetch = async (url) => {
      if (String(url).includes("search.json.gz")) throw new Error("network down");
      return okFetch(url);
    };
    R("DB.rows=[];DB.specById={};DB.patById={};DB.patByPub={};DB.cats=[];DB.counts={specs:0,patents:0};App.loadTries=0;");
    R("App.loadIndex(null)");
    await until(() => /could not be loaded/.test(els["grid"].innerHTML));
    ok(els["grid"].innerHTML.includes("RETRY"), "retry offered");
    ok(els["grid"].innerHTML.includes("OPEN STATIC ARCHIVE"), "static archive fallback offered");
    ok(els["grid"].innerHTML.includes("last verified numbers"), "counts honesty note");
    sandbox.fetch = okFetch;
  });
}

async function bt(name, fn) {
  try { await fn(); pass++; results.push("PASS  " + name); }
  catch (e) { fail++; results.push("FAIL  " + name + "  :: " + (e && e.message)); }
}

/* ================= run ================= */
(async () => {
  // Part A tests run at module scope via t() — already registered above.
  // (they are sync; run them now)
  await partB();
  console.log("\n==== FUNCTIONAL HARNESS RESULTS ====");
  for (const r of results) console.log(r);
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("HARNESS CRASH:", e); process.exit(2); });
