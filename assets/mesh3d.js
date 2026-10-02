/* Signature Tangible medallion — deterministic client-side mesh generator.
   Parity port of code/mesh.py. Units: mm. Builds a commemorative keepsake
   medallion for a record ID (base coin + rim + radial rays + center emblem
   with ID-digit notches; optional keychain lug). Outputs ASCII STL / OBJ / 3MF.
   This is a COMMEMORATIVE EMBLEM for the record, not a functional replica. */
"use strict";
function fnv1a(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h>>>0}
function RNG(seed){this.s=(seed>>>0)||1}
RNG.prototype.next=function(){let x=this.s;x^=(x<<13)>>>0;x^=x>>>17;x^=(x<<5)>>>0;this.s=x>>>0;return (x>>>0)/4294967296};
function vsub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function vcross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function vnorm(v){const l=Math.hypot(v[0],v[1],v[2]);return l?[v[0]/l,v[1]/l,v[2]/l]:[0,0,0]}
function Mesh(){this.facets=[]}
Mesh.prototype.tri=function(a,b,c){this.facets.push([vnorm(vcross(vsub(b,a),vsub(c,a))),a,b,c])};
Mesh.prototype.quad=function(a,b,c,d){this.tri(a,b,c);this.tri(a,c,d)};
function cylinder(m,r,h,z0,seg,rot){rot=rot||0;
  const pts=[];for(let i=0;i<seg;i++){const a=rot+i*2*Math.PI/seg;pts.push([r*Math.cos(a),r*Math.sin(a)])}
  const zt=z0+h,zb=z0;
  for(let i=0;i<seg;i++){const j=(i+1)%seg;
    m.quad([pts[i][0],pts[i][1],zb],[pts[j][0],pts[j][1],zb],[pts[j][0],pts[j][1],zt],[pts[i][0],pts[i][1],zt]);
    m.tri([0,0,zb],[pts[j][0],pts[j][1],zb],[pts[i][0],pts[i][1],zb]);
    m.tri([0,0,zt],[pts[i][0],pts[i][1],zt],[pts[j][0],pts[j][1],zt]);}}
function box(m,w,d,h,cx,cy,z0,rot){rot=rot||0;const hw=w/2,hd=d/2,cs=Math.cos(rot),sn=Math.sin(rot);
  const P=(x,y,z)=>[cx+x*cs-y*sn,cy+x*sn+y*cs,z];
  const c=[P(-hw,-hd,z0),P(hw,-hd,z0),P(hw,hd,z0),P(-hw,hd,z0),P(-hw,-hd,z0+h),P(hw,-hd,z0+h),P(hw,hd,z0+h),P(-hw,hd,z0+h)];
  m.quad(c[0],c[1],c[2],c[3]);m.quad(c[4],c[5],c[6],c[7]);
  m.quad(c[0],c[4],c[5],c[1]);m.quad(c[1],c[5],c[6],c[2]);m.quad(c[2],c[6],c[7],c[3]);m.quad(c[3],c[7],c[4],c[0]);}
function torus(m,R,tube,zc,segR,segT){
  for(let i=0;i<segR;i++)for(let j=0;j<segT;j++){
    const a0=i*2*Math.PI/segR,a1=(i+1)*2*Math.PI/segR,b0=j*2*Math.PI/segT,b1=(j+1)*2*Math.PI/segT;
    const P=(a,b)=>[(R+tube*Math.cos(b))*Math.cos(a),(R+tube*Math.cos(b))*Math.sin(a),zc+tube*Math.sin(b)];
    m.quad(P(a0,b0),P(a1,b0),P(a1,b1),P(a0,b1));}}
function torusVertical(m,R,tube,cx,cy,zc,segR,segT){
  for(let i=0;i<segR;i++)for(let j=0;j<segT;j++){
    const a0=i*2*Math.PI/segR,a1=(i+1)*2*Math.PI/segR,b0=j*2*Math.PI/segT,b1=(j+1)*2*Math.PI/segT;
    const P=(a,b)=>[cx+(R+tube*Math.cos(b))*Math.cos(a),cy+tube*Math.sin(b),zc+(R+tube*Math.cos(b))*Math.sin(a)];
    m.quad(P(a0,b0),P(a1,b0),P(a1,b1),P(a0,b1));}}
function medallion(recordId,keychain){
  const rng=new RNG(fnv1a(recordId)),m=new Mesh();
  cylinder(m,25,3,0,64);
  torus(m,22.5,1.4,3,48,16);
  const k=8+Math.floor(rng.next()*9);
  for(let i=0;i<k;i++){const ang=i*2*Math.PI/k+rng.next()*0.25,rh=1.2+Math.floor(rng.next()*3)*0.6;
    box(m,2.2,11,rh,Math.cos(ang)*13,Math.sin(ang)*13,3,ang);}
  cylinder(m,8,2.2,3,6,rng.next()*Math.PI);
  cylinder(m,4,1.2,5.2,32);
  const digits=(recordId.match(/\d/g)||[]).join("");
  let ds=0;for(const ch of digits)ds+=+ch;
  const nn=(ds%12)+4;
  for(let i=0;i<nn;i++){const ang=i*2*Math.PI/nn;box(m,1.2,1.2,1,Math.cos(ang)*4,Math.sin(ang)*4,6.4,ang);}
  if(keychain)torusVertical(m,4,1.5,0,22.5,9,32,12);
  return m;}
/* Return the layout parameters (for the 2D top-view preview) without meshing. */
function medallionParams(recordId){
  const rng=new RNG(fnv1a(recordId));
  const k=8+Math.floor(rng.next()*9),rays=[];
  for(let i=0;i<k;i++){const ang=i*2*Math.PI/k+rng.next()*0.25;rays.push({ang,h:1.2+Math.floor(rng.next()*3)*0.6});}
  const digits=(recordId.match(/\d/g)||[]).join("");let ds=0;for(const ch of digits)ds+=+ch;
  return {rays,hexRot:rng.next()*Math.PI,notches:(ds%12)+4};}
function stlAscii(m,name){
  const L=["solid "+name];
  for(const f of m.facets){const n=f[0];
    L.push("  facet normal "+n[0]+" "+n[1]+" "+n[2],"    outer loop",
      "      vertex "+f[1][0]+" "+f[1][1]+" "+f[1][2],
      "      vertex "+f[2][0]+" "+f[2][1]+" "+f[2][2],
      "      vertex "+f[3][0]+" "+f[3][1]+" "+f[3][2],"    endloop","  endfacet");}
  L.push("endsolid "+name);return L.join("\n")+"\n";}
function objText(m,name){
  const seen={},L=["# "+name,"o tangible"];
  const vi=p=>{const k=p[0].toFixed(4)+","+p[1].toFixed(4)+","+p[2].toFixed(4);
    if(!(k in seen)){seen[k]=Object.keys(seen).length+1;L.push("v "+p[0]+" "+p[1]+" "+p[2]);}return seen[k];};
  for(const f of m.facets)L.push("f "+vi(f[1])+" "+vi(f[2])+" "+vi(f[3]));
  return L.join("\n")+"\n";}
/* --- minimal stored-zip writer for 3MF --- */
const _crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c}return t})();
function crc32(bytes){let c=0xFFFFFFFF;for(let i=0;i<bytes.length;i++)c=_crcT[(c^bytes[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipStored(files){ // files: [[name, Uint8Array]]
  const enc=new TextEncoder(),chunks=[],central=[];let off=0;
  for(const [nm,data] of files){
    const nb=enc.encode(nm),crc=crc32(data),sz=data.length;
    const lh=new DataView(new ArrayBuffer(30));let p=0;
    const W16=v=>{lh.setUint16(p,v,true);p+=2},W32=v=>{lh.setUint32(p,v,true);p+=4};
    W32(0x04034b50);W16(20);W16(0);W16(0);W16(0);W16(0);W32(crc);W32(sz);W32(sz);W16(nb.length);W16(0);
    chunks.push(new Uint8Array(lh.buffer),nb,data);
    central.push({nb,crc,sz,off});off+=30+nb.length+sz;}
  let coff=off;
  for(const e of central){
    const ch=new DataView(new ArrayBuffer(46));let p=0;
    const W16=v=>{ch.setUint16(p,v,true);p+=2},W32=v=>{ch.setUint32(p,v,true);p+=4};
    W32(0x02014b50);W16(20);W16(20);W16(0);W16(0);W16(0);W16(0);W32(e.crc);W32(e.sz);W32(e.sz);
    W16(e.nb.length);W16(0);W16(0);W16(0);W16(0);W32(0);W32(e.off);
    chunks.push(new Uint8Array(ch.buffer),e.nb);coff+=46+e.nb.length;}
  const end=new DataView(new ArrayBuffer(22));let p=0;
  const W16=v=>{end.setUint16(p,v,true);p+=2},W32=v=>{end.setUint32(p,v,true);p+=4};
  W32(0x06054b50);W16(0);W16(0);W16(central.length);W16(central.length);W32(coff-off);W32(off);W16(0);
  chunks.push(new Uint8Array(end.buffer));
  let tot=0;for(const c of chunks)tot+=c.length;
  const out=new Uint8Array(tot);let o=0;for(const c of chunks){out.set(c,o);o+=c.length}
  return out;}
function threeMF(m,name){
  const seen={},V=[],T=[];
  const vi=p=>{const k=p[0].toFixed(4)+","+p[1].toFixed(4)+","+p[2].toFixed(4);
    if(!(k in seen)){seen[k]=V.length;V.push(p)}return seen[k];};
  for(const f of m.facets)T.push([vi(f[1]),vi(f[2]),vi(f[3])]);
  let xml='<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n <resources><object id="1" type="model" name="'+name.replace(/[<>&"]/g,"")+'"><mesh>\n  <vertices>\n';
  for(const v of V)xml+='   <vertex x="'+v[0]+'" y="'+v[1]+'" z="'+v[2]+'"/>\n';
  xml+='  </vertices>\n  <triangles>\n';
  for(const t of T)xml+='   <triangle v1="'+t[0]+'" v2="'+t[1]+'" v3="'+t[2]+'"/>\n';
  xml+='  </triangles>\n </mesh></object></resources>\n <build><item objectid="1"/></build>\n</model>';
  const enc=new TextEncoder();
  const ct=enc.encode('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  const rels=enc.encode('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
  return zipStored([["[Content_Types].xml",ct],["_rels/.rels",rels],["3D/3dmodel.model",enc.encode(xml)]]);}
if(typeof module!=="undefined")module.exports={fnv1a,RNG,Mesh,cylinder,box,torus,torusVertical,medallion,medallionParams,stlAscii,objText,threeMF};
