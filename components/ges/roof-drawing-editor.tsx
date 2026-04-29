"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveDrawing } from "@/app/actions/ges";
import {
  ArrowLeft, Pencil, LayoutGrid, Trash2, CheckCircle2,
  X, BarChart2, Save, ChevronRight, MousePointer, RotateCcw, RotateCw, Ruler,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const CW = 1200, CH = 700;
const PW_M = 1.134, PH_M = 2.382, GAP_M = 0.02;
const SNAP = 15;
const ROOF_COLOR = "#c05828"; // terracotta / kiremit
const ELEV_DEF = Math.PI * 42 / 180;
const ISO_H = 55;

// ── Types ─────────────────────────────────────────────────────────────────────
type Orient    = "portrait" | "landscape";
type Phase     = "draw" | "panel";
type PanelMode = "auto" | "manual";

interface Roof {
  id: string;
  vertices: [number,number][];
  color: string;
  pitch?: number;      // degrees 0-45, ridge is at top
  pitchEdge?: number;  // index of the ridge edge
}
interface Panel {
  id: number;
  roofId: string;
  corners: [[number,number],[number,number],[number,number],[number,number]];
}

type ViewPreset = "top" | "south" | "north" | "east" | "west";
const VIEW_PRESETS: Record<ViewPreset, { az: number; el: number }> = {
  top:   { az: 0,          el: Math.PI / 2 },
  south: { az: 0,          el: Math.PI * 30/180 },
  north: { az: Math.PI,    el: Math.PI * 30/180 },
  east:  { az: Math.PI/2,  el: Math.PI * 30/180 },
  west:  { az: -Math.PI/2, el: Math.PI * 30/180 },
};

// ── Coordinate helpers ────────────────────────────────────────────────────────
function mPxAt(lat: number, zoom: number) {
  return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
}

function buildEsriUrl(lat: number, lng: number, zoom: number) {
  const m = mPxAt(lat, zoom);
  const cosL = Math.cos(lat * Math.PI / 180);
  const hw = (CW / 2) * m, hh = (CH / 2) * m;
  const dLng = hw / (111320 * cosL), dLat = hh / 110540;
  const [w, e, s, n] = [lng - dLng, lng + dLng, lat - dLat, lat + dLat];
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${w},${s},${e},${n}&bboxSR=4326&size=${CW},${CH}&imageSR=4326&format=jpg&f=image`;
}

function px2ll(px: number, py: number, cLat: number, cLng: number, zoom: number): [number,number] {
  const m = mPxAt(cLat, zoom);
  const cosL = Math.cos(cLat * Math.PI / 180);
  return [cLat + (CH/2 - py) * m / 110540, cLng + (px - CW/2) * m / (111320 * cosL)];
}

function ll2px(la: number, ln: number, cLat: number, cLng: number, zoom: number): [number,number] {
  const m = mPxAt(cLat, zoom);
  const cosL = Math.cos(cLat * Math.PI / 180);
  return [CW/2 + (ln - cLng) * 111320 * cosL / m, CH/2 - (la - cLat) * 110540 / m];
}

function ll2m(la: number, ln: number, rLat: number, rLng: number): [number,number] {
  const cosR = Math.cos(rLat * Math.PI / 180);
  return [(ln - rLng) * 111320 * cosR, (la - rLat) * 110540];
}

function m2ll(mx: number, my: number, rLat: number, rLng: number): [number,number] {
  const cosR = Math.cos(rLat * Math.PI / 180);
  return [rLat + my / 110540, rLng + mx / (111320 * cosR)];
}

function ptInPoly(px: number, py: number, poly: [number,number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function hexRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function canvasXY(e: React.MouseEvent<HTMLCanvasElement> | MouseEvent, canvas: HTMLCanvasElement): [number,number] {
  const rect = canvas.getBoundingClientRect();
  return [(e.clientX - rect.left) * (CW / rect.width), (e.clientY - rect.top) * (CH / rect.height)];
}

function c2img(cx: number, cy: number, pan: {x:number;y:number}, scale: number): [number,number] {
  return [(cx - pan.x - CW/2) / scale + CW/2, (cy - pan.y - CH/2) / scale + CH/2];
}

function ptToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx-ax, dy = by-ay;
  const len2 = dx*dx + dy*dy;
  if (len2 < 1e-10) return Math.hypot(px-ax, py-ay);
  const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / len2));
  return Math.hypot(px - (ax+t*dx), py - (ay+t*dy));
}

// ── Slope helpers ─────────────────────────────────────────────────────────────
// Compute top-of-wall height for each vertex given pitch angle and ridge edge.
// Ridge vertices → ISO_H + extra, eave (far) vertices → ISO_H.
function roofVertexHeights(roof: Roof, worldPts: [number,number][]): number[] {
  const n = worldPts.length;
  const pitch = roof.pitch ?? 0;
  if (pitch <= 0 || roof.pitchEdge === undefined) return Array(n).fill(ISO_H);
  const ei = roof.pitchEdge % n;
  const A = worldPts[ei], B = worldPts[(ei+1) % n];
  const rdx = B[0]-A[0], rdy = B[1]-A[1];
  const rlen = Math.hypot(rdx, rdy);
  if (rlen < 0.001) return Array(n).fill(ISO_H);
  // Normal to ridge (2D)
  const nx = rdy/rlen, ny = -rdx/rlen;
  // Make sure normal points into polygon (centroid side)
  const cx0 = worldPts.reduce((s,v)=>s+v[0],0)/n;
  const cy0 = worldPts.reduce((s,v)=>s+v[1],0)/n;
  const cdot = (cx0-A[0])*nx + (cy0-A[1])*ny;
  const sn = cdot >= 0 ? 1 : -1;
  const dists = worldPts.map(v => ((v[0]-A[0])*nx + (v[1]-A[1])*ny) * sn);
  const maxDist = Math.max(...dists, 0.001);
  const pitchH = maxDist * Math.tan(pitch * Math.PI / 180);
  return dists.map(d => ISO_H + pitchH * (1 - Math.max(0, d) / maxDist));
}

// Height at a 2D world point for a roof (for panel placement)
function worldPointHeight(wx: number, wy: number, roof: Roof, worldPts: [number,number][]): number {
  const n = worldPts.length;
  const pitch = roof.pitch ?? 0;
  if (pitch <= 0 || roof.pitchEdge === undefined) return ISO_H;
  const ei = roof.pitchEdge % n;
  const A = worldPts[ei], B = worldPts[(ei+1) % n];
  const rdx = B[0]-A[0], rdy = B[1]-A[1];
  const rlen = Math.hypot(rdx, rdy);
  if (rlen < 0.001) return ISO_H;
  const nx = rdy/rlen, ny = -rdx/rlen;
  const cx0 = worldPts.reduce((s,v)=>s+v[0],0)/n;
  const cy0 = worldPts.reduce((s,v)=>s+v[1],0)/n;
  const sn = ((cx0-A[0])*nx + (cy0-A[1])*ny) >= 0 ? 1 : -1;
  const dists = worldPts.map(v => ((v[0]-A[0])*nx + (v[1]-A[1])*ny) * sn);
  const maxDist = Math.max(...dists, 0.001);
  const pitchH = maxDist * Math.tan(pitch * Math.PI / 180);
  const d = ((wx-A[0])*nx + (wy-A[1])*ny) * sn;
  return ISO_H + pitchH * (1 - Math.max(0, d) / maxDist);
}

// ── Panel fill ────────────────────────────────────────────────────────────────
function fillRoof(
  roof: Roof, orient: Orient, idOffset: number,
  groupEnabled = false, panelsPerGroup = 4, groupGap = 0.5,
): Panel[] {
  if (roof.vertices.length < 3) return [];
  const pitchRad = (roof.pitch ?? 0) * Math.PI / 180;
  const cosP = Math.max(Math.cos(pitchRad), 0.01);
  const pW = orient === "portrait" ? PW_M : PH_M;
  const pH = (orient === "portrait" ? PH_M : PW_M) * cosP; // compress along slope
  const rLat = roof.vertices.reduce((s,[la])=>s+la,0)/roof.vertices.length;
  const rLng = roof.vertices.reduce((s,[,ln])=>s+ln,0)/roof.vertices.length;
  const polyM = roof.vertices.map(([la,ln]) => ll2m(la,ln,rLat,rLng));

  let domAngle = 0, maxLen = 0;
  for (let i=0;i<polyM.length;i++){
    const j=(i+1)%polyM.length;
    const dx=polyM[j][0]-polyM[i][0],dy=polyM[j][1]-polyM[i][1];
    const len=Math.hypot(dx,dy);
    if(len>maxLen){maxLen=len;domAngle=Math.atan2(dy,dx);}
  }

  function tryAngle(angle: number, baseId: number): Panel[] {
    const cA=Math.cos(-angle),sA=Math.sin(-angle);
    const rot  = ([x,y]: [number,number]): [number,number] => [x*cA-y*sA, x*sA+y*cA];
    const unrot = ([x,y]: [number,number]): [number,number] => [x*cA+y*sA,-x*sA+y*cA];
    const rPoly=polyM.map(rot);
    const xs=rPoly.map(v=>v[0]),ys=rPoly.map(v=>v[1]);
    const [x0,x1,y0,y1]=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];
    const panels: Panel[]=[];let id=baseId;
    let rowIdx=0;
    while(true){
      const groupRow=groupEnabled?Math.floor(rowIdx/panelsPerGroup):0;
      const y=y0+rowIdx*(pH+GAP_M)+(groupEnabled?groupRow*groupGap:0);
      if(y+pH>y1+0.01)break;
      for(let x=x0;x+pW<=x1+0.01;x+=pW+GAP_M){
        const corners: [number,number][]=[[x,y],[x+pW,y],[x+pW,y+pH],[x,y+pH]];
        if(corners.every(c=>ptInPoly(c[0],c[1],rPoly))){
          const ll=corners.map(c=>{const[mx,my]=unrot(c);return m2ll(mx,my,rLat,rLng);});
          panels.push({id:id++,roofId:roof.id,corners:ll as Panel["corners"]});
        }
      }
      rowIdx++;
    }
    return panels;
  }
  const a1=tryAngle(domAngle,idOffset);
  const a2=tryAngle(domAngle+Math.PI/2,idOffset);
  return a1.length>=a2.length?a1:a2;
}

function singlePanel(
  mx: number, my: number, roof: Roof, orient: Orient,
  rLat: number, rLng: number, id: number,
): Panel | null {
  const pW=orient==="portrait"?PW_M:PH_M;
  const pH=orient==="portrait"?PH_M:PW_M;
  const polyM=roof.vertices.map(([la,ln])=>ll2m(la,ln,rLat,rLng));
  let domAngle=0,maxLen=0;
  for(let i=0;i<polyM.length;i++){
    const j=(i+1)%polyM.length;
    const dx=polyM[j][0]-polyM[i][0],dy=polyM[j][1]-polyM[i][1];
    const len=Math.hypot(dx,dy);
    if(len>maxLen){maxLen=len;domAngle=Math.atan2(dy,dx);}
  }
  const cA=Math.cos(-domAngle),sA=Math.sin(-domAngle);
  const rot  = ([x,y]: [number,number]): [number,number] => [x*cA-y*sA,x*sA+y*cA];
  const unrot = ([x,y]: [number,number]): [number,number] => [x*cA+y*sA,-x*sA+y*cA];
  const rPoly=polyM.map(rot);
  const[rmx,rmy]=rot([mx,my]);
  const snx=Math.floor(rmx/(pW+GAP_M))*(pW+GAP_M);
  const sny=Math.floor(rmy/(pH+GAP_M))*(pH+GAP_M);
  const corners: [number,number][]=[[snx,sny],[snx+pW,sny],[snx+pW,sny+pH],[snx,sny+pH]];
  if(!corners.every(c=>ptInPoly(c[0],c[1],rPoly)))return null;
  const ll=corners.map(c=>{const[ux,uy]=unrot(c);return m2ll(ux,uy,rLat,rLng);});
  return{id,roofId:roof.id,corners:ll as Panel["corners"]};
}

// ── 3D projection ─────────────────────────────────────────────────────────────
function projOrbital(wx: number, wy: number, wz: number, az: number, el: number): [number,number] {
  const rx = wx * Math.cos(az) + wy * Math.sin(az);
  const ry = -wx * Math.sin(az) + wy * Math.cos(az);
  return [rx, ry * Math.sin(el) - wz * Math.cos(el)];
}

// ── Canvas draw helpers ───────────────────────────────────────────────────────
function drawRoofPx(ctx: CanvasRenderingContext2D, pts: [number,number][], color: string, alpha: number, lw: number, highlightEdge?: number) {
  if(pts.length<2)return;
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(const p of pts.slice(1))ctx.lineTo(p[0],p[1]);
  ctx.closePath();ctx.fillStyle=hexRgba(color,alpha);ctx.fill();
  ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke();
  // Highlight the ridge edge if pitch is set
  if(highlightEdge!==undefined){
    const i=highlightEdge, j=(i+1)%pts.length;
    ctx.beginPath();ctx.moveTo(pts[i][0],pts[i][1]);ctx.lineTo(pts[j][0],pts[j][1]);
    ctx.strokeStyle="#fbbf24";ctx.lineWidth=lw*2.5;ctx.stroke();
  }
}

function drawDots(ctx: CanvasRenderingContext2D, pts: [number,number][], color: string, invScale = 1) {
  pts.forEach((p,i)=>{
    const r=(i===0?6:4)*invScale;
    ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);
    ctx.fillStyle=i===0?"#f59e0b":color;
    ctx.strokeStyle="rgba(255,255,255,0.8)";ctx.lineWidth=1.5*invScale;
    ctx.fill();ctx.stroke();
  });
}

function drawInProgress(
  ctx: CanvasRenderingContext2D, verts: [number,number][], mouse: [number,number]|null,
  color: string, snapVerts: [number,number][], invScale = 1,
) {
  if(verts.length===0)return;
  ctx.beginPath();ctx.moveTo(verts[0][0],verts[0][1]);
  for(const v of verts.slice(1))ctx.lineTo(v[0],v[1]);
  if(mouse)ctx.lineTo(mouse[0],mouse[1]);
  ctx.strokeStyle=color;ctx.lineWidth=2*invScale;ctx.setLineDash([6*invScale,4*invScale]);ctx.stroke();ctx.setLineDash([]);
  drawDots(ctx,verts,color,invScale);
  if(mouse){
    if(verts.length>=3){
      const d=Math.hypot(mouse[0]-verts[0][0],mouse[1]-verts[0][1]);
      if(d<SNAP*invScale){
        ctx.beginPath();ctx.arc(verts[0][0],verts[0][1],SNAP*invScale,0,Math.PI*2);
        ctx.strokeStyle="#f59e0b";ctx.lineWidth=1.5*invScale;ctx.setLineDash([3*invScale,3*invScale]);ctx.stroke();ctx.setLineDash([]);
      }
    }
    for(const sv of snapVerts){
      const d=Math.hypot(mouse[0]-sv[0],mouse[1]-sv[1]);
      if(d<SNAP*invScale){
        ctx.beginPath();ctx.arc(sv[0],sv[1],SNAP*invScale,0,Math.PI*2);
        ctx.strokeStyle="#60a5fa";ctx.lineWidth=1.5*invScale;ctx.setLineDash([3*invScale,3*invScale]);ctx.stroke();ctx.setLineDash([]);
      }
    }
  }
}

function drawEdgeLengths2D(
  ctx: CanvasRenderingContext2D,
  pts: [number,number][], vertices: [number,number][],
  invScale: number,
) {
  ctx.save();
  const fs = Math.max(9, Math.round(11 * invScale));
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    const [la1,ln1]=vertices[i], [la2,ln2]=vertices[j];
    const dx=(ln2-ln1)*111320*Math.cos(la1*Math.PI/180);
    const dy=(la2-la1)*110540;
    const lenM=Math.hypot(dx,dy);
    const mx=(pts[i][0]+pts[j][0])/2, my=(pts[i][1]+pts[j][1])/2;
    const label=lenM<1?`${(lenM*100).toFixed(0)}cm`:`${lenM.toFixed(1)}m`;
    const tw=ctx.measureText(label).width;
    const pad=4*invScale, bh=15*invScale;
    ctx.fillStyle="rgba(0,0,0,0.72)";
    ctx.fillRect(mx-tw/2-pad, my-bh/2, tw+pad*2, bh);
    ctx.fillStyle="#fbbf24";
    ctx.fillText(label,mx,my);
  }
  ctx.restore();
}

function drawPanelPx(
  ctx: CanvasRenderingContext2D, px: [number,number][],
  removed: boolean, hovered: boolean, selected: boolean,
) {
  ctx.beginPath();ctx.moveTo(px[0][0],px[0][1]);
  for(const p of px.slice(1))ctx.lineTo(p[0],p[1]);
  ctx.closePath();
  if(removed){ctx.strokeStyle="rgba(255,255,255,0.12)";ctx.lineWidth=0.5;ctx.stroke();return;}
  const pw=Math.hypot(px[1][0]-px[0][0],px[1][1]-px[0][1]);
  const ph=Math.hypot(px[3][0]-px[0][0],px[3][1]-px[0][1]);
  ctx.fillStyle=selected?"#1e3a8a":hovered?"#2a4070":"#1a2e5a";ctx.fill();
  if(pw>4&&ph>4){
    ctx.save();ctx.clip();
    ctx.strokeStyle="rgba(255,255,255,0.12)";ctx.lineWidth=0.35;
    for(let i=1;i<10;i++){
      const t=i/10;
      const tx=px[0][0]+(px[1][0]-px[0][0])*t,ty=px[0][1]+(px[1][1]-px[0][1])*t;
      const bx=px[3][0]+(px[2][0]-px[3][0])*t,by=px[3][1]+(px[2][1]-px[3][1])*t;
      ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(bx,by);ctx.stroke();
    }
    for(let i=1;i<20;i++){
      const t=i/20;
      const lx=px[0][0]+(px[3][0]-px[0][0])*t,ly=px[0][1]+(px[3][1]-px[0][1])*t;
      const rx=px[1][0]+(px[2][0]-px[1][0])*t,ry=px[1][1]+(px[2][1]-px[1][1])*t;
      ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(rx,ry);ctx.stroke();
    }
    const midx=(px[0][0]+px[1][0])/2,midy=(px[0][1]+px[1][1])/2;
    const grad=ctx.createLinearGradient(px[0][0],px[0][1],midx,midy);
    grad.addColorStop(0,"rgba(255,255,255,0.06)");grad.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=grad;ctx.fillRect(-999,-999,9999,9999);
    ctx.restore();
  }
  // White frame
  const alpha = selected ? 1.0 : hovered ? 0.85 : 0.6;
  ctx.strokeStyle=`rgba(255,255,255,${alpha})`;ctx.lineWidth=selected?1.5:0.8;ctx.stroke();
}

// ── Compass widget ────────────────────────────────────────────────────────────
const COMPASS_CX = CW - 72, COMPASS_CY = 72, COMPASS_R = 38;
const COMPASS_DIRS: { label: string; v: ViewPreset; dx: number; dy: number }[] = [
  { label:"N", v:"north", dx:0,  dy:-1 },
  { label:"S", v:"south", dx:0,  dy:1  },
  { label:"E", v:"east",  dx:1,  dy:0  },
  { label:"W", v:"west",  dx:-1, dy:0  },
];

function drawCompass(ctx: CanvasRenderingContext2D, az: number, el: number) {
  const cx=COMPASS_CX,cy=COMPASS_CY,r=COMPASS_R;
  ctx.save();
  ctx.beginPath();ctx.arc(cx,cy,r+10,0,Math.PI*2);
  ctx.fillStyle="rgba(8,15,28,0.82)";ctx.fill();
  ctx.strokeStyle="rgba(99,102,241,0.3)";ctx.lineWidth=1;ctx.stroke();
  const isTop=el>Math.PI/3;
  const azN=((az%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  function closest(): ViewPreset {
    if(isTop)return"top";
    if(azN<Math.PI/4||azN>=7*Math.PI/4)return"south";
    if(azN<3*Math.PI/4)return"east";
    if(azN<5*Math.PI/4)return"north";
    return"west";
  }
  const cur=closest();
  ctx.font="bold 9px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
  for(const d of COMPASS_DIRS){
    const bx=cx+d.dx*r,by=cy+d.dy*r;
    const active=cur===d.v;
    ctx.beginPath();ctx.arc(bx,by,11,0,Math.PI*2);
    ctx.fillStyle=active?"#6366f1":"rgba(40,50,68,0.9)";ctx.fill();
    ctx.strokeStyle=active?"#818cf8":"#475569";ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=active?"#fff":"#94a3b8";ctx.fillText(d.label,bx,by);
  }
  ctx.beginPath();ctx.arc(cx,cy,14,0,Math.PI*2);
  ctx.fillStyle=isTop?"#f59e0b":"rgba(40,50,68,0.9)";ctx.fill();
  ctx.strokeStyle=isTop?"#fbbf24":"#475569";ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle=isTop?"#fff":"#94a3b8";ctx.font="bold 7px sans-serif";ctx.fillText("TOP",cx,cy);
  ctx.restore();
}

function compassHit(cx: number, cy: number): ViewPreset|null {
  for(const d of COMPASS_DIRS){
    const bx=COMPASS_CX+d.dx*COMPASS_R,by=COMPASS_CY+d.dy*COMPASS_R;
    if(Math.hypot(cx-bx,cy-by)<13)return d.v;
  }
  if(Math.hypot(cx-COMPASS_CX,cy-COMPASS_CY)<14)return"top";
  return null;
}

// ── 3D canvas render ──────────────────────────────────────────────────────────
export function renderScene3D(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  roofs: Roof[], panels: Panel[],
  removedIds: Set<number>, selectedIds: Set<number>,
  az: number, el: number,
  vScale: number, vPan: {x:number;y:number},
  cLat: number, cLng: number, zoom: number,
  showLengths = false,
) {
  ctx.clearRect(0,0,CW,CH);
  ctx.fillStyle="#0d1827";ctx.fillRect(0,0,CW,CH);
  if(roofs.length===0){drawCompass(ctx,az,el);return;}

  const allPx=roofs.flatMap(r=>r.vertices.map(([la,ln])=>ll2px(la,ln,cLat,cLng,zoom)));
  const cx0=allPx.reduce((s,p)=>s+p[0],0)/allPx.length;
  const cy0=allPx.reduce((s,p)=>s+p[1],0)/allPx.length;
  const xs=allPx.map(p=>p[0]),ys=allPx.map(p=>p[1]);
  const sceneW=Math.max(...xs)-Math.min(...xs),sceneH=Math.max(...ys)-Math.min(...ys);
  const maxDim=Math.max(sceneW,sceneH,1);
  const baseScale=Math.min(CW,CH)*0.28/maxDim;

  function toWorld(px: number,py: number): [number,number] {
    return[(px-cx0)*baseScale,(py-cy0)*baseScale];
  }
  function project(wx: number,wy: number,wz: number): [number,number] {
    const[sx,sy]=projOrbital(wx,wy,wz,az,el);
    return[CW/2+sx*vScale+vPan.x, CH/2+sy*vScale+vPan.y];
  }

  // Satellite image as ground plane
  if(img){
    const corners=[toWorld(0,0),toWorld(CW,0),toWorld(0,CH)];
    const [A,B,C]=corners.map(([wx,wy])=>project(wx,wy,0));
    const a=(B[0]-A[0])/CW,b=(B[1]-A[1])/CW;
    const c=(C[0]-A[0])/CH,d=(C[1]-A[1])/CH;
    ctx.save();ctx.setTransform(a,b,c,d,A[0],A[1]);ctx.drawImage(img,0,0,CW,CH);ctx.restore();
  }

  // Roofs
  for(const roof of roofs){
    if(roof.vertices.length<3)continue;
    const ptsG=roof.vertices.map(([la,ln])=>{const[px,py]=ll2px(la,ln,cLat,cLng,zoom);return toWorld(px,py);});
    const n=ptsG.length;
    const topZ=roofVertexHeights(roof,ptsG);

    // Walls — solid black
    for(let i=0;i<n;i++){
      const j=(i+1)%n;
      const[ax,ay]=project(ptsG[i][0],ptsG[i][1],0);
      const[bx,by]=project(ptsG[j][0],ptsG[j][1],0);
      const[ax2,ay2]=project(ptsG[i][0],ptsG[i][1],topZ[i]);
      const[bx2,by2]=project(ptsG[j][0],ptsG[j][1],topZ[j]);
      ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.lineTo(bx2,by2);ctx.lineTo(ax2,ay2);ctx.closePath();
      ctx.fillStyle="rgba(15,15,20,0.97)";ctx.fill();
      ctx.strokeStyle="#2a2a35";ctx.lineWidth=0.8;ctx.stroke();
    }
    // Top face — solid terracotta
    ctx.beginPath();
    const[f0x,f0y]=project(ptsG[0][0],ptsG[0][1],topZ[0]);ctx.moveTo(f0x,f0y);
    for(let i=1;i<n;i++){const[fx,fy]=project(ptsG[i][0],ptsG[i][1],topZ[i]);ctx.lineTo(fx,fy);}
    ctx.closePath();
    ctx.fillStyle=ROOF_COLOR;ctx.fill();
    ctx.strokeStyle="#8a3520";ctx.lineWidth=1;ctx.stroke();

    // 3D edge length labels
    if(showLengths){
      ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
      for(let i=0;i<n;i++){
        const j=(i+1)%n;
        const [la1,ln1]=roof.vertices[i], [la2,ln2]=roof.vertices[j];
        const edx=(ln2-ln1)*111320*Math.cos(la1*Math.PI/180);
        const edy=(la2-la1)*110540;
        // 3D length accounts for height difference
        const hDiff = (topZ[j] - topZ[i]) / baseScale * mPxAt(cLat,zoom);
        const lenM=Math.hypot(edx,edy,hDiff);
        const midWx=(ptsG[i][0]+ptsG[j][0])/2, midWy=(ptsG[i][1]+ptsG[j][1])/2;
        const midZ=(topZ[i]+topZ[j])/2;
        const[sx,sy]=project(midWx,midWy,midZ+8);
        const label=lenM<1?`${(lenM*100).toFixed(0)}cm`:`${lenM.toFixed(1)}m`;
        const tw=ctx.measureText(label).width;
        ctx.fillStyle="rgba(0,0,0,0.75)";
        ctx.fillRect(sx-tw/2-4,sy-8,tw+8,16);
        ctx.fillStyle="#fbbf24";ctx.fillText(label,sx,sy);
      }
    }
  }

  // Panels — always on top of roofs
  for(const panel of panels){
    if(removedIds.has(panel.id))continue;
    const roof=roofs.find(r=>r.id===panel.roofId);
    const worldPts = roof ? roof.vertices.map(([la,ln])=>{const[px,py]=ll2px(la,ln,cLat,cLng,zoom);return toWorld(px,py);}) : null;
    const projC=panel.corners.map(([la,ln])=>{
      const[px,py]=ll2px(la,ln,cLat,cLng,zoom);
      const[wx,wy]=toWorld(px,py);
      const h = roof && worldPts ? worldPointHeight(wx,wy,roof,worldPts) : ISO_H;
      return project(wx,wy,h);
    });
    ctx.beginPath();ctx.moveTo(projC[0][0],projC[0][1]);
    for(const[px,py]of projC.slice(1))ctx.lineTo(px,py);
    ctx.closePath();
    const sel=selectedIds.has(panel.id);
    ctx.fillStyle=sel?"#1e3a8a":"#182444";ctx.fill();
    const pw=Math.hypot(projC[1][0]-projC[0][0],projC[1][1]-projC[0][1]);
    const ph=Math.hypot(projC[3][0]-projC[0][0],projC[3][1]-projC[0][1]);
    if(pw>6&&ph>6){
      ctx.save();ctx.clip();
      ctx.strokeStyle="rgba(255,255,255,0.09)";ctx.lineWidth=0.3;
      for(let i=1;i<10;i++){
        const t=i/10;
        ctx.beginPath();
        ctx.moveTo(projC[0][0]+(projC[1][0]-projC[0][0])*t,projC[0][1]+(projC[1][1]-projC[0][1])*t);
        ctx.lineTo(projC[3][0]+(projC[2][0]-projC[3][0])*t,projC[3][1]+(projC[2][1]-projC[3][1])*t);
        ctx.stroke();
      }
      for(let i=1;i<20;i++){
        const t=i/20;
        ctx.beginPath();
        ctx.moveTo(projC[0][0]+(projC[3][0]-projC[0][0])*t,projC[0][1]+(projC[3][1]-projC[0][1])*t);
        ctx.lineTo(projC[1][0]+(projC[2][0]-projC[1][0])*t,projC[1][1]+(projC[2][1]-projC[1][1])*t);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle=sel?"rgba(255,255,255,1.0)":"rgba(255,255,255,0.55)";
    ctx.lineWidth=sel?1.5:0.5;ctx.stroke();
  }

  drawCompass(ctx,az,el);
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  projectId: string; projectName: string;
  lat: number; lng: number; zoom: number;
  savedRoofs: { id: string; vertices: [number,number][]; color: string; height: number; pitch?: number; pitchEdge?: number }[];
  savedPanelCfg?: { orientation: string; panelsPerGroup: number; panelHGap: number; groupHGap: number; panelVGap: number };
  savedRemovedPanels: number[];
}

export default function RoofDrawingEditor({
  projectId, projectName, lat, lng, zoom: rawZoom,
  savedRoofs, savedPanelCfg, savedRemovedPanels,
}: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const fixedZoom = Math.max(rawZoom, 17);

  const [viewScale, setViewScale] = useState(1.0);
  const [viewPan,   setViewPan]   = useState({ x: 0, y: 0 });
  const [phase,     setPhase]     = useState<Phase>("draw");
  const [orient,    setOrient]    = useState<Orient>((savedPanelCfg?.orientation as Orient)||"portrait");
  const [pMode,     setPMode]     = useState<PanelMode>("auto");
  const [current,   setCurrent]   = useState<[number,number][]>([]);
  const [mouse,     setMouse]     = useState<[number,number]|null>(null);
  const [roofs,     setRoofs]     = useState<Roof[]>(savedRoofs.map(r=>({...r, color: ROOF_COLOR})));
  const [panels,    setPanels]    = useState<Panel[]>([]);
  const [removedIds,setRemovedIds]= useState<Set<number>>(new Set(savedRemovedPanels));
  const [hovPanel,  setHovPanel]  = useState<number|null>(null);
  const [manPreview,setManPreview]= useState<Panel|null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [showResults,setShowResults]=useState(false);
  const [showLengths,setShowLengths]=useState(false);
  const [show3D,    setShow3D]    = useState(false);
  const [orbAz,     setOrbAz]     = useState(0);
  const [orbEl,     setOrbEl]     = useState(ELEV_DEF);
  const [selectedIds,setSelectedIds]=useState<Set<number>>(new Set());
  const [boxRect,    setBoxRect]    =useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
  const [groupEnabled,   setGroupEnabled]   = useState(false);
  const [panelsPerGroup, setPanelsPerGroup] = useState(4);
  const [groupGap,       setGroupGap]       = useState(0.5);
  const [hoverEdge, setHoverEdge] = useState<{roofId: string; edgeIdx: number} | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => { imgRef.current = img; setImgLoaded(true); };
    img.onerror = () => { imgRef.current = null; setImgLoaded(true); };
    img.src = buildEsriUrl(lat, lng, fixedZoom);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (savedRoofs.length > 0) {
      const o = (savedPanelCfg?.orientation as Orient) || "portrait";
      let offset = 0; const all: Panel[] = [];
      for (const r of savedRoofs) { const ps=fillRoof({...r,color:ROOF_COLOR},o,offset); offset+=ps.length; all.push(...ps); }
      setPanels(all);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type DragType = "none"|"pan"|"orbit"|"panels"|"boxsel"|"slope";
  const dragTypeRef   = useRef<DragType>("none");
  const dragClientRef = useRef<[number,number]>([0,0]);
  const dragPanRef    = useRef<{x:number;y:number}>({x:0,y:0});
  const dragAzElRef   = useRef<{az:number;el:number}>({az:0,el:0});
  const dragImgRef    = useRef<[number,number]>([0,0]);
  const panelOrigsRef = useRef<Map<number,Panel>>(new Map());
  const viewScaleRef  = useRef(1.0);
  const viewPanRef    = useRef({x:0,y:0});
  const dragSlopeRoofRef  = useRef<string>("");
  const dragSlopeEdgeRef  = useRef<number>(0);
  const dragSlopeStartYRef= useRef<number>(0);
  const dragSlopeStartPitchRef = useRef<number>(0);

  useEffect(()=>{ viewScaleRef.current=viewScale; },[viewScale]);
  useEffect(()=>{ viewPanRef.current=viewPan; },[viewPan]);

  const dataRef = useRef({
    roofs,current,mouse,panels,removedIds,hovPanel,phase,show3D,
    orient,pMode,manPreview,imgLoaded,orbAz,orbEl,
    viewScale,viewPan,selectedIds,boxRect,showLengths,hoverEdge,
  });
  dataRef.current = {
    roofs,current,mouse,panels,removedIds,hovPanel,phase,show3D,
    orient,pMode,manPreview,imgLoaded,orbAz,orbEl,
    viewScale,viewPan,selectedIds,boxRect,showLengths,hoverEdge,
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if(!canvas)return;
    const ctx = canvas.getContext("2d");
    if(!ctx)return;
    const d = dataRef.current;
    ctx.clearRect(0,0,CW,CH);

    if(d.show3D && d.phase==="panel"){
      renderScene3D(ctx,imgRef.current,d.roofs,d.panels,d.removedIds,d.selectedIds,
             d.orbAz,d.orbEl,d.viewScale,d.viewPan,lat,lng,fixedZoom,d.showLengths);
      return;
    }

    ctx.save();
    ctx.translate(d.viewPan.x+CW/2,d.viewPan.y+CH/2);
    ctx.scale(d.viewScale,d.viewScale);
    ctx.translate(-CW/2,-CH/2);
    if(imgRef.current){ ctx.drawImage(imgRef.current,0,0,CW,CH); }
    else{ ctx.fillStyle="#0f1b2d";ctx.fillRect(0,0,CW,CH); }
    const invScale = 1 / d.viewScale;

    if(d.phase==="draw"){
      const existingVertsPx: [number,number][] = [];
      for(const r of d.roofs){
        for(const [la,ln] of r.vertices) existingVertsPx.push(ll2px(la,ln,lat,lng,fixedZoom));
      }
      for(const r of d.roofs){
        const pts=r.vertices.map(([la,ln])=>ll2px(la,ln,lat,lng,fixedZoom)) as [number,number][];
        const heIdx = d.hoverEdge?.roofId===r.id ? d.hoverEdge.edgeIdx : undefined;
        drawRoofPx(ctx,pts,ROOF_COLOR,0.35,2*invScale,r.pitchEdge!==undefined&&r.pitch&&r.pitch>0?r.pitchEdge:heIdx);
        drawDots(ctx,pts,ROOF_COLOR,invScale);
        if(d.showLengths) drawEdgeLengths2D(ctx,pts,r.vertices,invScale);
        // Pitch label
        if(r.pitch && r.pitch > 0 && r.pitchEdge !== undefined){
          const ei=r.pitchEdge%pts.length, ej=(ei+1)%pts.length;
          const mx=(pts[ei][0]+pts[ej][0])/2+8*invScale, my=(pts[ei][1]+pts[ej][1])/2-12*invScale;
          ctx.save();
          ctx.font=`bold ${Math.round(11*invScale)}px sans-serif`;
          ctx.textAlign="left";ctx.textBaseline="middle";
          const label=`${r.pitch.toFixed(0)}°`;
          ctx.fillStyle="rgba(0,0,0,0.7)";ctx.fillRect(mx-3*invScale,my-7*invScale,ctx.measureText(label).width+6*invScale,14*invScale);
          ctx.fillStyle="#fbbf24";ctx.fillText(label,mx,my);
          ctx.restore();
        }
      }
      // Hover edge highlight
      if(d.hoverEdge){
        const r=d.roofs.find(r=>r.id===d.hoverEdge!.roofId);
        if(r){
          const pts=r.vertices.map(([la,ln])=>ll2px(la,ln,lat,lng,fixedZoom)) as [number,number][];
          const i=d.hoverEdge.edgeIdx, j=(i+1)%pts.length;
          ctx.beginPath();ctx.moveTo(pts[i][0],pts[i][1]);ctx.lineTo(pts[j][0],pts[j][1]);
          ctx.strokeStyle="rgba(251,191,36,0.7)";ctx.lineWidth=4*invScale;ctx.stroke();
        }
      }
      const mouseImg=d.mouse?c2img(d.mouse[0],d.mouse[1],d.viewPan,d.viewScale):null;
      drawInProgress(ctx,d.current,mouseImg,ROOF_COLOR,existingVertsPx,invScale);
    } else {
      for(const r of d.roofs){
        const pts=r.vertices.map(([la,ln])=>ll2px(la,ln,lat,lng,fixedZoom)) as [number,number][];
        drawRoofPx(ctx,pts,ROOF_COLOR,0.08,1.2*invScale);
        if(d.showLengths) drawEdgeLengths2D(ctx,pts,r.vertices,invScale);
      }
      for(const panel of d.panels){
        const px=panel.corners.map(([la,ln])=>ll2px(la,ln,lat,lng,fixedZoom)) as [number,number][];
        const sel=d.selectedIds.has(panel.id);
        drawPanelPx(ctx,px,d.removedIds.has(panel.id),d.hovPanel===panel.id,sel);
      }
      if(d.manPreview&&d.pMode==="manual"){
        const px=d.manPreview.corners.map(([la,ln])=>ll2px(la,ln,lat,lng,fixedZoom)) as [number,number][];
        ctx.save();ctx.globalAlpha=0.6;drawPanelPx(ctx,px,false,false,false);ctx.restore();
      }
      if(d.boxRect){
        const{x1,y1,x2,y2}=d.boxRect;
        ctx.save();
        ctx.strokeStyle="#60a5fa";ctx.lineWidth=1/d.viewScale;
        ctx.setLineDash([4/d.viewScale,4/d.viewScale]);
        ctx.strokeRect(x1,y1,x2-x1,y2-y1);
        ctx.fillStyle="rgba(96,165,250,0.1)";ctx.fillRect(x1,y1,x2-x1,y2-y1);
        ctx.setLineDash([]);ctx.restore();
      }
    }
    ctx.restore();
    ctx.fillStyle="rgba(0,0,0,0.45)";ctx.fillRect(CW-132,CH-28,130,24);
    ctx.fillStyle="#94a3b8";ctx.font="11px monospace";ctx.textAlign="right";
    ctx.fillText(`z${fixedZoom}  ${mPxAt(lat,fixedZoom).toFixed(2)} m/px`,CW-8,CH-11);
  }, [lat, lng, fixedZoom]);

  useEffect(() => { redraw(); }, [
    redraw,roofs,current,mouse,panels,removedIds,hovPanel,phase,show3D,
    orbAz,orbEl,manPreview,imgLoaded,viewScale,viewPan,selectedIds,boxRect,showLengths,hoverEdge,
  ]);

  const wheelHandlerRef = useRef<(e: WheelEvent)=>void>(()=>{});
  wheelHandlerRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const d = dataRef.current;
    const canvas = canvasRef.current;
    if(!canvas)return;
    const delta = e.deltaY < 0 ? 1.14 : 0.88;
    if(d.show3D && d.phase==="panel"){
      setViewScale(prev => Math.max(0.3, Math.min(10, prev * delta)));
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX-rect.left)*(CW/rect.width);
    const cy = (e.clientY-rect.top)*(CH/rect.height);
    setViewScale(prev => {
      const ns = Math.max(0.4, Math.min(10, prev*delta));
      const ratio = ns/prev;
      setViewPan(pp => ({
        x: cx-CW/2-(cx-CW/2-pp.x)*ratio,
        y: cy-CH/2-(cy-CH/2-pp.y)*ratio,
      }));
      return ns;
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas)return;
    const h=(e: WheelEvent)=>wheelHandlerRef.current(e);
    canvas.addEventListener("wheel",h,{passive:false});
    return ()=>canvas.removeEventListener("wheel",h);
  }, []);

  useEffect(() => {
    function onUp(e: MouseEvent) {
      if(e.button===2){dragTypeRef.current="none";return;}
      const dt=dragTypeRef.current;
      if(dt==="slope"){dragTypeRef.current="none";return;}
      if(dt==="boxsel"){
        const box=dataRef.current.boxRect;
        if(box){
          const ids=new Set<number>();
          for(const p of dataRef.current.panels){
            if(dataRef.current.removedIds.has(p.id))continue;
            const centLa=p.corners.reduce((s,[la])=>s+la,0)/4;
            const centLn=p.corners.reduce((s,[,ln])=>s+ln,0)/4;
            const[cpx,cpy]=ll2px(centLa,centLn,lat,lng,fixedZoom);
            if(cpx>=box.x1&&cpx<=box.x2&&cpy>=box.y1&&cpy<=box.y2)ids.add(p.id);
          }
          setSelectedIds(ids);
        }
        setBoxRect(null);
      }
      dragTypeRef.current="none";
    }
    window.addEventListener("mouseup",onUp);
    return ()=>window.removeEventListener("mouseup",onUp);
  }, [lat,lng,fixedZoom]);

  // ── Edge detection for slope ──────────────────────────────────────────────
  function findEdgeAt(ix: number, iy: number): {roofId: string; edgeIdx: number} | null {
    const threshold = 8 / viewScaleRef.current;
    for(const r of dataRef.current.roofs){
      const pts=r.vertices.map(([la,ln])=>ll2px(la,ln,lat,lng,fixedZoom));
      for(let i=0;i<pts.length;i++){
        const j=(i+1)%pts.length;
        const d=ptToSegDist(ix,iy,pts[i][0],pts[i][1],pts[j][0],pts[j][1]);
        if(d<threshold)return{roofId:r.id,edgeIdx:i};
      }
    }
    return null;
  }

  function findPanelAt(ix: number, iy: number): number|null {
    const d=dataRef.current;
    for(let i=d.panels.length-1;i>=0;i--){
      const p=d.panels[i];
      if(d.removedIds.has(p.id))continue;
      const pxC=p.corners.map(([la,ln])=>ll2px(la,ln,lat,lng,fixedZoom));
      if(ptInPoly(ix,iy,pxC))return p.id;
    }
    return null;
  }

  function hasOverlap(candidateCorners: Panel["corners"], exclude?: number): boolean {
    const d=dataRef.current;
    const centLa=candidateCorners.reduce((s,[la])=>s+la,0)/4;
    const centLn=candidateCorners.reduce((s,[,ln])=>s+ln,0)/4;
    const[cpx,cpy]=ll2px(centLa,centLn,lat,lng,fixedZoom);
    for(const p of d.panels){
      if(p.id===exclude)continue;
      if(d.removedIds.has(p.id))continue;
      const pxC=p.corners.map(([la,ln])=>ll2px(la,ln,lat,lng,fixedZoom));
      if(ptInPoly(cpx,cpy,pxC))return true;
    }
    return false;
  }

  function snapExistingVertex(ix: number, iy: number): [number,number] {
    const threshold = SNAP / viewScaleRef.current;
    for(const r of dataRef.current.roofs){
      for(const [la,ln] of r.vertices){
        const [vx,vy] = ll2px(la,ln,lat,lng,fixedZoom);
        if(Math.hypot(ix-vx,iy-vy) < threshold) return [vx,vy];
      }
    }
    return [ix,iy];
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas=canvasRef.current;
    if(!canvas)return;
    const[cx,cy]=canvasXY(e,canvas);

    if(e.button===1){
      e.preventDefault();
      dragTypeRef.current="pan";
      dragClientRef.current=[e.clientX,e.clientY];
      dragPanRef.current={...viewPanRef.current};
      return;
    }
    if(e.button===2){
      if(show3D&&phase==="panel"){
        dragTypeRef.current="orbit";
        dragClientRef.current=[e.clientX,e.clientY];
        dragAzElRef.current={az:orbAz,el:orbEl};
      }
      return;
    }

    // In 3D panel mode: compass or switch to 2D
    if(show3D&&phase==="panel"){
      const hit=compassHit(cx,cy);
      if(hit){
        if(hit==="top"){setShow3D(false);setViewScale(1);setViewPan({x:0,y:0});}
        else{setOrbAz(VIEW_PRESETS[hit].az);setOrbEl(VIEW_PRESETS[hit].el);}
        return;
      }
      // Switch to 2D so panel operations work
      setShow3D(false);
      setViewScale(1);
      setViewPan({x:0,y:0});
      return;
    }

    const[ix,iy]=c2img(cx,cy,viewPanRef.current,viewScaleRef.current);

    if(phase==="draw"){
      // Check for slope drag on existing roof edge
      const edgeHit = findEdgeAt(ix,iy);
      if(edgeHit){
        dragTypeRef.current="slope";
        dragClientRef.current=[e.clientX,e.clientY];
        dragSlopeRoofRef.current=edgeHit.roofId;
        dragSlopeEdgeRef.current=edgeHit.edgeIdx;
        const r=roofs.find(r=>r.id===edgeHit.roofId);
        dragSlopeStartPitchRef.current=r?.pitch??0;
        dragSlopeStartYRef.current=e.clientY;
        return;
      }
      // Vertex snap + polygon drawing
      const [six,siy] = snapExistingVertex(ix,iy);
      const closeThresh = SNAP / viewScaleRef.current;
      if(current.length>=3&&Math.hypot(six-current[0][0],siy-current[0][1])<closeThresh){
        closeRoof(current);return;
      }
      setCurrent(v=>[...v,[six,siy]]);return;
    }

    if(pMode==="manual"){
      if(manPreview&&!hasOverlap(manPreview.corners)){
        setPanels(prev=>[...prev,manPreview]);setManPreview(null);
      }
      return;
    }

    const hitId=findPanelAt(ix,iy);
    if(hitId!==null){
      const d=dataRef.current;
      const sel=d.selectedIds.has(hitId)?d.selectedIds:e.shiftKey?new Set([...d.selectedIds,hitId]):new Set([hitId]);
      setSelectedIds(sel);
      dragTypeRef.current="panels";
      dragImgRef.current=[ix,iy];
      const origMap=new Map<number,Panel>();
      for(const id of sel){const p=d.panels.find(pp=>pp.id===id);if(p)origMap.set(id,p);}
      panelOrigsRef.current=origMap;
    } else {
      if(!e.shiftKey)setSelectedIds(new Set());
      dragTypeRef.current="boxsel";
      dragImgRef.current=[ix,iy];
      setBoxRect({x1:ix,y1:iy,x2:ix,y2:iy});
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas=canvasRef.current;
    if(!canvas)return;
    const[cx,cy]=canvasXY(e,canvas);
    setMouse([cx,cy]);
    const dt=dragTypeRef.current;

    if(dt==="pan"){
      const rect=canvas.getBoundingClientRect();
      const dx=(e.clientX-dragClientRef.current[0])*(CW/rect.width);
      const dy=(e.clientY-dragClientRef.current[1])*(CH/rect.height);
      const np={x:dragPanRef.current.x+dx,y:dragPanRef.current.y+dy};
      viewPanRef.current=np;setViewPan(np);return;
    }
    if(dt==="orbit"){
      const dx=(e.clientX-dragClientRef.current[0])*0.007;
      const dy=(e.clientY-dragClientRef.current[1])*0.007;
      setOrbAz(dragAzElRef.current.az+dx);
      setOrbEl(Math.max(0.05,Math.min(Math.PI/2,dragAzElRef.current.el-dy)));
      return;
    }
    if(dt==="slope"){
      const dy = dragSlopeStartYRef.current - e.clientY;
      const newPitch = Math.max(0, Math.min(45, dragSlopeStartPitchRef.current + dy * 0.18));
      setRoofs(prev => prev.map(r =>
        r.id === dragSlopeRoofRef.current
          ? { ...r, pitch: newPitch, pitchEdge: dragSlopeEdgeRef.current }
          : r
      ));
      return;
    }

    const[ix,iy]=c2img(cx,cy,viewPanRef.current,viewScaleRef.current);

    if(dt==="panels"){
      const m=mPxAt(lat,fixedZoom);const cosL=Math.cos(lat*Math.PI/180);
      const dLat=-(iy-dragImgRef.current[1])*m/110540;
      const dLng=(ix-dragImgRef.current[0])*m/(111320*cosL);
      setPanels(prev=>prev.map(p=>{
        const orig=panelOrigsRef.current.get(p.id);
        if(!orig)return p;
        return{...p,corners:orig.corners.map(([la,ln])=>[la+dLat,ln+dLng]) as Panel["corners"]};
      }));
      return;
    }
    if(dt==="boxsel"){
      const si=dragImgRef.current;
      setBoxRect({x1:Math.min(si[0],ix),y1:Math.min(si[1],iy),x2:Math.max(si[0],ix),y2:Math.max(si[1],iy)});
      return;
    }

    // Hover detection
    if(phase==="draw" && dt==="none"){
      const edgeHit = findEdgeAt(ix,iy);
      setHoverEdge(edgeHit);
    }

    if(phase==="panel"&&!show3D){
      if(pMode==="auto"){setHovPanel(findPanelAt(ix,iy));}
      else{
        const[la,ln]=px2ll(ix,iy,lat,lng,fixedZoom);
        let preview: Panel|null=null;
        for(const roof of dataRef.current.roofs){
          const rLat=roof.vertices.reduce((s,[l])=>s+l,0)/roof.vertices.length;
          const rLng=roof.vertices.reduce((s,[,n])=>s+n,0)/roof.vertices.length;
          const[mx,my]=ll2m(la,ln,rLat,rLng);
          const p=singlePanel(mx,my,roof,dataRef.current.orient,rLat,rLng,Date.now());
          if(p){preview=p;break;}
        }
        setManPreview(preview);
      }
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if(e.button!==0)return;
    if(dragTypeRef.current==="panels"||dragTypeRef.current==="slope")dragTypeRef.current="none";
  }

  function handleMouseLeave(){setMouse(null);setHovPanel(null);setManPreview(null);setHoverEdge(null);}
  function handleContextMenu(e: React.MouseEvent){e.preventDefault();}

  function closeRoof(verts: [number,number][]){
    if(verts.length<3)return;
    const id=`roof-${Date.now()}`;
    const llVerts=verts.map(([px,py])=>px2ll(px,py,lat,lng,fixedZoom));
    setRoofs(prev=>[...prev,{id,vertices:llVerts,color:ROOF_COLOR}]);
    setCurrent([]);
  }

  function deleteRoof(id: string){
    setRoofs(prev=>prev.filter(r=>r.id!==id));
    setPanels(prev=>prev.filter(p=>p.roofId!==id));
    setSelectedIds(prev=>{const s=new Set(prev);panels.filter(p=>p.roofId===id).forEach(p=>s.delete(p.id));return s;});
  }

  function doFillRoof(roofId: string){
    const roof=roofs.find(r=>r.id===roofId);if(!roof)return;
    const others=panels.filter(p=>p.roofId!==roofId);
    const offset=others.length>0?Math.max(...others.map(p=>p.id))+1:0;
    const fresh=fillRoof(roof,orient,offset,groupEnabled,panelsPerGroup,groupGap);
    setPanels([...others,...fresh]);
    setRemovedIds(prev=>{const s=new Set(prev);fresh.forEach(p=>s.delete(p.id));return s;});
    setSelectedIds(new Set());
  }

  function clearRoofPanels(roofId: string){
    setPanels(prev=>prev.filter(p=>p.roofId!==roofId));setSelectedIds(new Set());
  }

  function deleteSelectedPanels(){
    setRemovedIds(prev=>new Set([...prev,...selectedIds]));setSelectedIds(new Set());
  }

  function rotateSelectedPanels(degrees: number){
    const rads=degrees*Math.PI/180;
    const selP=panels.filter(p=>selectedIds.has(p.id));if(!selP.length)return;
    const allC=selP.flatMap(p=>p.corners);
    const rLat=allC.reduce((s,[la])=>s+la,0)/allC.length;
    const rLng=allC.reduce((s,[,ln])=>s+ln,0)/allC.length;
    const cosR=Math.cos(rads),sinR=Math.sin(rads);
    setPanels(prev=>prev.map(p=>{
      if(!selectedIds.has(p.id))return p;
      const nc=p.corners.map(([la,ln])=>{
        const[mx,my]=ll2m(la,ln,rLat,rLng);
        return m2ll(mx*cosR-my*sinR,mx*sinR+my*cosR,rLat,rLng);
      }) as Panel["corners"];
      return{...p,corners:nc};
    }));
  }

  function enterPanelPhase(){
    setPhase("panel");
    setShow3D(true);
    setViewScale(1);
    setViewPan({x:0,y:0});
  }

  async function handleSave(){
    setSaving(true);
    try{
      const dbRoofs=roofs.map(r=>({
        id:r.id,color:r.color,height:4,
        vertices:r.vertices as [number,number][],
        pitch:r.pitch,pitchEdge:r.pitchEdge,
      }));
      const active=panels.filter(p=>!removedIds.has(p.id));
      await saveDrawing(projectId,dbRoofs,
        {orientation:orient,panelsPerGroup,panelHGap:0,groupHGap:groupGap,panelVGap:0},
        Array.from(removedIds),active.length);
      router.push(`/projects/${projectId}/detail`);
    }finally{setSaving(false);}
  }

  const activeCount=panels.filter(p=>!removedIds.has(p.id)).length;
  const totalAreaM2=roofs.reduce((sum,r)=>{
    const rLat=r.vertices.reduce((s,[la])=>s+la,0)/r.vertices.length;
    const rLng=r.vertices.reduce((s,[,ln])=>s+ln,0)/r.vertices.length;
    const polyM=r.vertices.map(([la,ln])=>ll2m(la,ln,rLat,rLng));
    let a=0;const n=polyM.length;
    for(let i=0;i<n;i++){const j=(i+1)%n;a+=polyM[i][0]*polyM[j][1]-polyM[j][0]*polyM[i][1];}
    return sum+Math.abs(a/2);
  },0);
  const hasSelection=selectedIds.size>0;

  const drawCursor =
    phase==="draw" ? (hoverEdge ? "ns-resize" : "crosshair") :
    pMode==="manual" ? "cell" :
    dragTypeRef.current==="panels" ? "grabbing" :
    hovPanel!==null ? "pointer" :
    dragTypeRef.current==="pan" ? "grabbing" : "default";

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-700/60 flex-shrink-0 flex-wrap">
        <button onClick={()=>router.push(`/projects/${projectId}/detail`)}
          className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-slate-300"/>
        </button>
        <span className="text-sm font-semibold truncate max-w-[180px]">{projectName}</span>

        <div className="flex items-center gap-1 ml-1">
          <button onClick={()=>setPhase("draw")}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${phase==="draw"?"bg-amber-500 text-white":"text-slate-400 hover:text-white"}`}>
            <Pencil className="w-3 h-3"/>1. Çizim
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600"/>
          <button onClick={()=>roofs.length>0&&enterPanelPhase()} disabled={roofs.length===0}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${phase==="panel"?"bg-amber-500 text-white":"text-slate-400 hover:text-white"}`}>
            <LayoutGrid className="w-3 h-3"/>2. Panel
          </button>
        </div>
        <div className="flex-1"/>

        {phase==="draw"&&(<>
          <button onClick={()=>setShowLengths(v=>!v)}
            className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${showLengths?"bg-amber-500 text-white":"bg-slate-800 text-slate-400 hover:text-white"}`}>
            <Ruler className="w-3.5 h-3.5"/>Uzunluklar
          </button>
          {current.length>=3&&(
            <button onClick={()=>closeRoof(current)}
              className="h-8 px-3 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
              style={{background:"linear-gradient(135deg,#10b981,#059669)"}}>
              <CheckCircle2 className="w-3.5 h-3.5"/>Kapat
            </button>
          )}
          {current.length>0&&(
            <button onClick={()=>setCurrent([])} className="h-8 w-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center">
              <Trash2 className="w-3.5 h-3.5 text-slate-400"/>
            </button>
          )}
          {roofs.length>0&&(
            <button onClick={enterPanelPhase}
              className="h-8 px-3 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
              style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
              Panel<ChevronRight className="w-3.5 h-3.5"/>
            </button>
          )}
        </>)}

        {phase==="panel"&&(<>
          <div className="flex items-center gap-0.5 bg-slate-800 rounded-xl p-1">
            {(["portrait","landscape"] as const).map(o=>(
              <button key={o} onClick={()=>setOrient(o)}
                className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all ${orient===o?"bg-amber-500 text-white shadow":"text-slate-400 hover:text-white"}`}>
                {o==="portrait"?"Dikey":"Yatay"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 bg-slate-800 rounded-xl p-1">
            <button onClick={()=>setPMode("auto")}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${pMode==="auto"?"bg-sky-600 text-white":"text-slate-400 hover:text-white"}`}>
              <LayoutGrid className="w-3 h-3"/>Otomatik
            </button>
            <button onClick={()=>{ setPMode("manual"); setShow3D(false); setViewScale(1); setViewPan({x:0,y:0}); }}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${pMode==="manual"?"bg-sky-600 text-white":"text-slate-400 hover:text-white"}`}>
              <MousePointer className="w-3 h-3"/>Manuel
            </button>
          </div>
          <button onClick={()=>setShowLengths(v=>!v)}
            className={`h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${showLengths?"bg-amber-500 text-white":"bg-slate-800 text-slate-400 hover:text-white"}`}>
            <Ruler className="w-3.5 h-3.5"/>
          </button>
          <div className="flex items-center gap-0.5 bg-slate-800 rounded-xl p-1">
            <button onClick={()=>{setShow3D(false);setViewScale(1);setViewPan({x:0,y:0});}}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all ${!show3D?"bg-amber-500 text-white":"text-slate-400 hover:text-white"}`}>2D</button>
            <button onClick={()=>{setShow3D(true);setViewScale(1);setViewPan({x:0,y:0});}}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all ${show3D?"bg-indigo-600 text-white":"text-slate-400 hover:text-white"}`}>3D</button>
            {show3D&&(["south","north","east","west"] as const).map(v=>(
              <button key={v} onClick={()=>{setOrbAz(VIEW_PRESETS[v].az);setOrbEl(VIEW_PRESETS[v].el);}}
                className="h-7 px-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
                {v[0].toUpperCase()}
              </button>
            ))}
          </div>
          {hasSelection&&(
            <div className="flex items-center gap-1 bg-blue-900/40 border border-blue-700/40 rounded-xl px-2 py-1">
              <span className="text-xs text-blue-300 font-semibold">{selectedIds.size} seçili</span>
              <button onClick={()=>rotateSelectedPanels(-15)} title="-15°"
                className="h-6 w-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                <RotateCcw className="w-3 h-3 text-slate-300"/>
              </button>
              <button onClick={()=>rotateSelectedPanels(15)} title="+15°"
                className="h-6 w-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                <RotateCw className="w-3 h-3 text-slate-300"/>
              </button>
              <button onClick={()=>rotateSelectedPanels(-90)}
                className="h-6 px-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs text-slate-300">-90°</button>
              <button onClick={()=>rotateSelectedPanels(90)}
                className="h-6 px-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs text-slate-300">+90°</button>
              <button onClick={deleteSelectedPanels}
                className="h-6 w-6 rounded-md bg-red-900/60 hover:bg-red-800 flex items-center justify-center">
                <Trash2 className="w-3 h-3 text-red-300"/>
              </button>
              <button onClick={()=>setSelectedIds(new Set())}
                className="h-6 w-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                <X className="w-3 h-3 text-slate-300"/>
              </button>
            </div>
          )}
          {activeCount>0&&(
            <div className="flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/40 rounded-xl px-3 py-1">
              <span className="text-xs font-bold text-emerald-400">{activeCount}</span>
              <span className="text-xs text-emerald-600">·</span>
              <span className="text-xs font-bold text-emerald-300">{(activeCount*625/1000).toFixed(1)} kWp</span>
            </div>
          )}
          {activeCount>0&&(
            <button onClick={()=>setShowResults(true)} className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-slate-300"/>
            </button>
          )}
        </>)}

        <button onClick={handleSave} disabled={saving}
          className="h-8 px-3 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{background:"linear-gradient(135deg,#f59e0b,#ea580c)"}}>
          <Save className="w-3.5 h-3.5"/>{saving?"…":"Kaydet"}
        </button>
      </div>

      {/* ── Sub-bar ── */}
      {phase==="draw"&&(
        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/40 border-b border-slate-700/30 flex-shrink-0 min-h-[34px] overflow-x-auto">
          {roofs.map((r,i)=>(
            <div key={r.id} className="flex items-center gap-1.5 bg-slate-700/50 rounded-lg px-2.5 py-1 flex-shrink-0 border border-slate-600/30">
              <div className="w-2.5 h-2.5 rounded-sm" style={{background:ROOF_COLOR}}/>
              <span className="text-xs text-slate-300">Bölge {i+1}</span>
              {r.pitch && r.pitch > 0 && <span className="text-[10px] text-amber-400 font-semibold">{r.pitch.toFixed(0)}°</span>}
              <button onClick={()=>deleteRoof(r.id)} className="text-slate-500 hover:text-red-400 ml-0.5"><X className="w-3 h-3"/></button>
            </div>
          ))}
          {current.length>0&&(
            <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-600/30 rounded-lg px-2.5 py-1 flex-shrink-0">
              <span className="text-xs text-amber-300">{current.length} nokta</span>
              <button onClick={()=>setCurrent([])} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3"/></button>
            </div>
          )}
          {roofs.length===0&&current.length===0&&(
            <p className="text-xs text-slate-500">Çatı köşelerine tıkla · kenara tıklayıp yukarı sürükle → eğim ver · mevcut noktaya yapış · scroll zoom</p>
          )}
        </div>
      )}

      {phase==="panel"&&(
        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/40 border-b border-slate-700/30 flex-shrink-0 overflow-x-auto min-h-[40px]">
          {roofs.map((r,i)=>{
            const cnt=panels.filter(p=>p.roofId===r.id&&!removedIds.has(p.id)).length;
            const tot=panels.filter(p=>p.roofId===r.id).length;
            return(
              <div key={r.id} className="flex items-center gap-2 bg-slate-700/40 border border-slate-600/30 rounded-xl px-3 py-1 flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-sm" style={{background:ROOF_COLOR}}/>
                <span className="text-xs text-slate-300 font-medium">Bölge {i+1}</span>
                {r.pitch&&r.pitch>0&&<span className="text-[10px] text-amber-400">{r.pitch.toFixed(0)}°</span>}
                {tot>0&&<span className="text-xs font-bold text-emerald-400">{cnt}/{tot}</span>}
                <button onClick={()=>doFillRoof(r.id)}
                  className="h-6 px-2.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                  style={{background:"linear-gradient(135deg,#0ea5e9,#6366f1)"}}>
                  <LayoutGrid className="w-2.5 h-2.5"/>{tot>0?"Yenile":"Doldur"}
                </button>
                {tot>0&&<button onClick={()=>clearRoofPanels(r.id)} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3"/></button>}
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 border-l border-slate-700/50 pl-3 ml-1 flex-shrink-0">
            <span className="text-xs text-slate-500">Gruplama:</span>
            <button onClick={()=>setGroupEnabled(v=>!v)}
              className={`h-6 px-2.5 rounded-lg text-xs font-semibold transition-all ${groupEnabled?"bg-violet-600 text-white":"bg-slate-700 text-slate-400 hover:text-white"}`}>
              {groupEnabled?"Açık":"Kapalı"}
            </button>
            {groupEnabled&&(<>
              <select value={panelsPerGroup} onChange={e=>setPanelsPerGroup(Number(e.target.value))}
                className="h-6 px-1.5 bg-slate-700 text-xs text-slate-200 rounded-lg border-0 outline-none">
                <option value={2}>2/grup</option><option value={3}>3/grup</option>
                <option value={4}>4/grup</option><option value={6}>6/grup</option><option value={8}>8/grup</option>
              </select>
              <select value={groupGap} onChange={e=>setGroupGap(Number(e.target.value))}
                className="h-6 px-1.5 bg-slate-700 text-xs text-slate-200 rounded-lg border-0 outline-none">
                <option value={0.3}>0.3m</option><option value={0.5}>0.5m</option>
                <option value={0.8}>0.8m</option><option value={1.0}>1.0m</option><option value={1.5}>1.5m</option>
              </select>
            </>)}
          </div>
          {pMode==="manual"&&<span className="text-xs text-amber-400 flex-shrink-0 ml-auto">Manuel: 2D görünümde çatı üzerine tıkla</span>}
          {show3D&&<span className="text-xs text-indigo-400 flex-shrink-0 ml-auto">3D: sağ tuş → döndür · scroll → zoom · sol tık → 2D&apos;ye geç</span>}
        </div>
      )}

      {/* ── Canvas ── */}
      <div className="flex-1 relative overflow-hidden bg-slate-950">
        <canvas
          ref={canvasRef} width={CW} height={CH}
          className="absolute inset-0 w-full h-full"
          style={{cursor: drawCursor}}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        />
        {phase==="draw"&&roofs.length===0&&current.length===0&&(
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-slate-900/85 backdrop-blur-sm border border-slate-600/40 rounded-xl px-5 py-2.5">
              <p className="text-xs text-slate-300 text-center">
                Köşelere tıkla · kenara tıklayıp sürükle → eğim · mevcut noktaya yapış · <span className="text-amber-400 font-semibold">Kapat</span> ile bitir
              </p>
            </div>
          </div>
        )}
        {show3D&&phase==="panel"&&(
          <div className="absolute bottom-5 left-4 pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur-sm border border-indigo-600/30 rounded-xl px-4 py-2">
              <p className="text-xs text-indigo-300">Sağ tuş → döndür · Scroll → zoom · Sol tık → 2D&apos;ye geç (seçim için)</p>
            </div>
          </div>
        )}
        {!imgLoaded&&(
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/80 rounded-xl px-6 py-3">
              <p className="text-sm text-slate-400">Uydu görüntüsü yükleniyor…</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Results modal ── */}
      {showResults&&(
        <div className="absolute inset-0 z-[700] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-600/60 rounded-2xl shadow-2xl p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Çizim Özeti</h3>
              <button onClick={()=>setShowResults(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-2.5 mb-5">
              {[
                ["Çatı Bölgesi",`${roofs.length} bölge`],
                ["Toplam Alan",`${totalAreaM2.toFixed(0)} m²`],
                ["Aktif Panel",`${activeCount} adet`],
                ["Toplam Güç",`${(activeCount*625/1000).toFixed(1)} kWp`],
                ["DC Güç",`${(activeCount*625/1000000).toFixed(3)} MWp`],
              ].map(([l,v])=>(
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-slate-400">{l}</span>
                  <span className="font-semibold text-white">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowResults(false)}
                className="flex-1 h-9 rounded-xl border border-slate-600 text-sm text-slate-300 hover:bg-slate-700">Kapat</button>
              <button onClick={()=>{setShowResults(false);router.push(`/projects/${projectId}/detail`);}}
                className="flex-1 h-9 rounded-xl text-sm font-semibold text-white"
                style={{background:"linear-gradient(135deg,#f59e0b,#ea580c)"}}>Detaya Git →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
