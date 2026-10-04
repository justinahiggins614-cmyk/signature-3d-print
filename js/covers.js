/* ==== JAH deterministic tangible-cover engine — signature-3d-print ====
   Zero storage, pure client-side SVG. (id, title, category) -> product-shot cover:
   the printed object rendered as a 3D product shot on a studio backdrop.
   ID hash -> palette (8 palettes); hash -> object motif (6 objects).
   Covers.svg({id,title,sub,kind,wide}) -> inline SVG string.
   Covers.thumb({id,title,sub,kind})   -> lazy placeholder <span>.
   Covers.lazy(scopeEl)                 -> IntersectionObserver fill for [data-cov]. */
(function(){
"use strict";
function xmur3(str){var h=1779033703^str.length;for(var i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function wrap(t,n){var w=String(t||"Untitled record").split(/\s+/),L=[],c="",i;for(i=0;i<w.length;i++){if((c+" "+w[i]).trim().length>n){if(c)L.push(c);c=w[i];}else c=(c+" "+w[i]).trim();}if(c)L.push(c);return L.slice(0,2);}
/* [bgTop,bgBot,accent,accent2,ink] — dark studio palettes */
var PALS=[
 ["#232a34","#0d1015","#ff7a1a","#ffb300","#f2ede2"],
 ["#1d2b3a","#0b1118","#57d0e6","#9fe8ff","#eef6fb"],
 ["#2c2333","#100d14","#c98aff","#f0d4ff","#f6eefb"],
 ["#233528","#0d130f","#7CFC00","#d6ff9e","#f0f7e6"],
 ["#33272a","#140e10","#ff7ab8","#ffc4dd","#fbeef3"],
 ["#26333a","#0e1418","#ffd166","#fff3c4","#fbf6e6"],
 ["#2a2f38","#101319","#8ad8d8","#d2f4f4","#eef7f7"],
 ["#38301f","#161209","#ff9f43","#ffd8a8","#faf3e3"]
];
function palFor(id){return PALS[xmur3(String(id))()%PALS.length];}
/* ---- object motifs, drawn centered at (cx,cy) with radius r ---- */
function objGear(cx,cy,r,c1,c2){
  var s="",i,a;for(i=0;i<8;i++){a=i*Math.PI/4;s+='<rect x="'+(cx-7)+'" y="'+(cy-r-9)+'" width="14" height="20" rx="3" fill="'+c1+'" transform="rotate('+(a*180/Math.PI)+' '+cx+' '+cy+')"/>';}
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+c1+'"/><circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.68)+'" fill="'+c2+'" opacity="0.85"/><circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.3)+'" fill="#0d1015"/>';
  return s;
}
function objVase(cx,cy,r,c1,c2){
  return '<path d="M'+cx+','+(cy-r*1.2)+' C '+(cx-r*0.9)+','+(cy-r*0.9)+' '+(cx-r*1.05)+','+(cy-r*0.2)+' '+(cx-r*0.7)+','+(cy+r*0.4)+' C '+(cx-r*0.5)+','+(cy+r*0.8)+' '+(cx-r*0.45)+','+(cy+r)+' '+(cx-r*0.55)+','+(cy+r*1.15)+' L '+(cx+r*0.55)+','+(cy+r*1.15)+' C '+(cx+r*0.45)+','+(cy+r)+' '+(cx+r*0.5)+','+(cy+r*0.8)+' '+(cx+r*0.7)+','+(cy+r*0.4)+' C '+(cx+r*1.05)+','+(cy-r*0.2)+' '+(cx+r*0.9)+','+(cy-r*0.9)+' '+cx+','+(cy-r*1.2)+' Z" fill="'+c1+'"/>'
  +'<path d="M'+(cx-r*0.32)+','+(cy-r*0.9)+' C '+(cx-r*0.5)+','+(cy-r*0.3)+' '+(cx-r*0.4)+','+(cy+r*0.5)+' '+(cx-r*0.3)+','+(cy+r*0.9)+'" stroke="'+c2+'" stroke-width="'+(r*0.16)+'" fill="none" opacity="0.55" stroke-linecap="round"/>';
}
function objCube(cx,cy,r,c1,c2){
  var t=r*0.95,w=r*0.55;
  return '<polygon points="'+cx+','+(cy-t)+' '+(cx+w)+','+(cy-t*0.55)+' '+cx+','+(cy-t*0.1)+' '+(cx-w)+','+(cy-t*0.55)+'" fill="'+c2+'"/>'
  +'<polygon points="'+(cx-w)+','+(cy-t*0.55)+' '+cx+','+(cy-t*0.1)+' '+cx+','+(cy+t*0.75)+' '+(cx-w)+','+(cy+t*0.3)+'" fill="'+c1+'"/>'
  +'<polygon points="'+(cx+w)+','+(cy-t*0.55)+' '+cx+','+(cy-t*0.1)+' '+cx+','+(cy+t*0.75)+' '+(cx+w)+','+(cy+t*0.3)+'" fill="'+c1+'" opacity="0.72"/>';
}
function objRocket(cx,cy,r,c1,c2){
  return '<path d="M'+cx+','+(cy-r*1.25)+' C '+(cx+r*0.55)+','+(cy-r*0.6)+' '+(cx+r*0.5)+','+(cy+r*0.2)+' '+(cx+r*0.5)+','+(cy+r*0.8)+' L '+(cx-r*0.5)+','+(cy+r*0.8)+' C '+(cx-r*0.5)+','+(cy+r*0.2)+' '+(cx-r*0.55)+','+(cy-r*0.6)+' '+cx+','+(cy-r*1.25)+' Z" fill="'+c1+'"/>'
  +'<circle cx="'+cx+'" cy="'+(cy-r*0.35)+'" r="'+(r*0.26)+'" fill="#0d1015" stroke="'+c2+'" stroke-width="3"/>'
  +'<polygon points="'+(cx-r*0.5)+','+(cy+r*0.5)+' '+(cx-r*0.95)+','+(cy+r*1.05)+' '+(cx-r*0.5)+','+(cy+r*0.95)+'" fill="'+c2+'"/>'
  +'<polygon points="'+(cx+r*0.5)+','+(cy+r*0.5)+' '+(cx+r*0.95)+','+(cy+r*1.05)+' '+(cx+r*0.5)+','+(cy+r*0.95)+'" fill="'+c2+'"/>'
  +'<polygon points="'+cx+','+(cy+r*0.8)+' '+(cx-r*0.22)+','+(cy+r*1.35)+' '+(cx+r*0.22)+','+(cy+r*1.35)+'" fill="'+c2+'" opacity="0.9"/>';
}
function objWrench(cx,cy,r,c1,c2){
  return '<g transform="rotate(-35 '+cx+' '+cy+')">'
  +'<rect x="'+(cx-r*0.22)+'" y="'+(cy-r*1.15)+'" width="'+(r*0.44)+'" height="'+(r*2.3)+'" rx="'+(r*0.2)+'" fill="'+c1+'"/>'
  +'<circle cx="'+cx+'" cy="'+(cy-r*1.05)+'" r="'+(r*0.5)+'" fill="'+c1+'"/>'
  +'<circle cx="'+cx+'" cy="'+(cy-r*1.18)+'" r="'+(r*0.28)+'" fill="#0d1015"/>'
  +'<rect x="'+(cx-r*0.28)+'" y="'+(cy-r*1.75)+'" width="'+(r*0.56)+'" height="'+(r*0.42)+'" fill="#0d1015" transform="rotate(18 '+cx+' '+(cy-r*1.55)+')"/>'
  +'<circle cx="'+cx+'" cy="'+(cy+r*0.95)+'" r="'+(r*0.16)+'" fill="'+c2+'"/></g>';
}
function objBot(cx,cy,r,c1,c2){
  return '<rect x="'+(cx-r*0.8)+'" y="'+(cy-r*0.75)+'" width="'+(r*1.6)+'" height="'+(r*1.5)+'" rx="'+(r*0.4)+'" fill="'+c1+'"/>'
  +'<line x1="'+cx+'" y1="'+(cy-r*0.75)+'" x2="'+cx+'" y2="'+(cy-r*1.25)+'" stroke="'+c1+'" stroke-width="'+(r*0.14)+'"/>'
  +'<circle cx="'+cx+'" cy="'+(cy-r*1.32)+'" r="'+(r*0.16)+'" fill="'+c2+'"/>'
  +'<circle cx="'+(cx-r*0.32)+'" cy="'+(cy-r*0.15)+'" r="'+(r*0.18)+'" fill="#0d1015"/>'
  +'<circle cx="'+(cx+r*0.32)+'" cy="'+(cy-r*0.15)+'" r="'+(r*0.18)+'" fill="#0d1015"/>'
  +'<circle cx="'+(cx-r*0.32)+'" cy="'+(cy-r*0.15)+'" r="'+(r*0.07)+'" fill="'+c2+'"/>'
  +'<circle cx="'+(cx+r*0.32)+'" cy="'+(cy-r*0.15)+'" r="'+(r*0.07)+'" fill="'+c2+'"/>'
  +'<rect x="'+(cx-r*0.4)+'" y="'+(cy+r*0.32)+'" width="'+(r*0.8)+'" height="'+(r*0.12)+'" rx="'+(r*0.06)+'" fill="#0d1015"/>';
}
var OBJS=[objGear,objVase,objCube,objRocket,objWrench,objBot];
function svg(o){
  o=o||{};var id=String(o.id||"?"),title=o.title||"Untitled record";
  var pal=palFor(id),h=xmur3(id+"::cov")(),rnd=xmur3(id+"::r");
  var W=300,H=o.wide?220:300;
  var lines=wrap(title,20);
  var s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Product cover art for '+esc(title)+'">';
  s+='<defs><linearGradient id="bg'+(h%999983)+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+pal[0]+'"/><stop offset="1" stop-color="'+pal[1]+'"/></linearGradient>'
    +'<radialGradient id="sp'+(h%999983)+'" cx="50%" cy="42%" r="55%"><stop offset="0" stop-color="'+pal[3]+'" stop-opacity="0.35"/><stop offset="1" stop-color="'+pal[3]+'" stop-opacity="0"/></radialGradient></defs>';
  s+='<rect width="'+W+'" height="'+H+'" fill="url(#bg'+(h%999983)+')"/>';
  s+='<ellipse cx="'+(W/2)+'" cy="'+(H*0.46)+'" rx="'+(W*0.42)+'" ry="'+(H*0.30)+'" fill="url(#sp'+(h%999983)+')"/>';
  /* title */
  var ty=o.wide?30:34;
  lines.forEach(function(ln,i){s+='<text x="'+(W/2)+'" y="'+(ty+i*24)+'" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="21" fill="'+pal[4]+'">'+esc(ln)+'</text>';});
  /* pedestal + shadow + object */
  var oy=H*0.62,pr=Math.min(W,H)*0.16;
  s+='<ellipse cx="'+(W/2)+'" cy="'+(oy+pr*1.9)+'" rx="'+(pr*2.1)+'" ry="'+(pr*0.42)+'" fill="#000" opacity="0.45"/>';
  s+='<rect x="'+(W/2-pr*1.9)+'" y="'+(oy+pr*1.15)+'" width="'+(pr*3.8)+'" height="'+(pr*0.75)+'" rx="'+(pr*0.14)+'" fill="#1a1f26" stroke="'+pal[2]+'" stroke-width="1.5"/>';
  s+='<rect x="'+(W/2-pr*1.9)+'" y="'+(oy+pr*1.15)+'" width="'+(pr*3.8)+'" height="'+(pr*0.22)+'" rx="'+(pr*0.1)+'" fill="'+pal[2]+'" opacity="0.35"/>';
  s+=OBJS[h%OBJS.length](W/2,oy,pr,pal[2],pal[3]);
  /* layer lines (3D-print texture) */
  var k;for(k=0;k<3;k++){s+='<path d="M'+(W/2-pr*1.4)+','+(oy+pr*(0.4+k*0.3))+' q '+(pr*0.7)+' '+(pr*0.12)+' '+(pr*1.4)+' 0" stroke="'+pal[3]+'" stroke-width="1" opacity="0.28" fill="none"/>';}
  /* ID stamp badge */
  var idt=id.length>26?id.slice(0,26)+"…":id;
  var bw=8+idt.length*8.2;
  s+='<rect x="10" y="'+(H-34)+'" width="'+bw+'" height="24" rx="12" fill="#000" opacity="0.62"/>'
    +'<rect x="10" y="'+(H-34)+'" width="'+bw+'" height="24" rx="12" fill="none" stroke="'+pal[2]+'" stroke-width="1.2"/>'
    +'<text x="'+(10+bw/2)+'" y="'+(H-17)+'" text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="12.5" fill="'+pal[3]+'">'+esc(idt)+'</text>';
  /* kind chip */
  if(o.kind){var kk=String(o.kind).toUpperCase().slice(0,8);
    s+='<rect x="'+(W-10-kk.length*8.6-14)+'" y="10" width="'+(kk.length*8.6+14)+'" height="22" rx="11" fill="'+pal[2]+'"/>'
    +'<text x="'+(W-10-(kk.length*8.6+14)/2)+'" y="25" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="11.5" fill="#0d1015">'+esc(kk)+'</text>';}
  s+='</svg>';return s;
}
function thumb(o){
  return '<span class="covthumb" data-cov="1" data-cov-id="'+esc(o.id||"")+'" data-cov-title="'+esc(o.title||"")+'" data-cov-sub="'+esc(o.sub||"")+'" data-cov-kind="'+esc(o.kind||"")+'"><span class="covph" aria-hidden="true">◈</span></span>';
}
var seen=false;
function fill(el){
  if(!el||el.getAttribute("data-cov-done"))return;
  el.setAttribute("data-cov-done","1");
  try{el.innerHTML=svg({id:el.getAttribute("data-cov-id"),title:el.getAttribute("data-cov-title"),sub:el.getAttribute("data-cov-sub"),kind:el.getAttribute("data-cov-kind")});}
  catch(e){el.innerHTML='<span class="covph">◈</span>';}
}
function lazy(scope){
  var root=scope||document;
  var els=root.querySelectorAll?root.querySelectorAll('[data-cov="1"]:not([data-cov-done])'):[];
  if(!els.length)return;
  if(typeof IntersectionObserver==="undefined"){for(var i=0;i<els.length;i++)fill(els[i]);return;}
  if(!lazy._io){lazy._io=new IntersectionObserver(function(es){for(var j=0;j<es.length;j++){if(es[j].isIntersecting){fill(es[j].target);lazy._io.unobserve(es[j].target);}}},{rootMargin:"240px"});}
  for(var i=0;i<els.length;i++)lazy._io.observe(els[i]);
}
window.Covers3D={svg:svg,thumb:thumb,lazy:lazy,fill:fill};
})();
