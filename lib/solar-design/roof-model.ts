import type { Vec, RoofType, Mass, RNode, REdge } from "./types";
import { polygonAreaPx, centroid } from "./geometry";
import { detectFaces, faceCoords, detectOuterBoundary } from "./faces";

/**
 * Parametrik çatı üretimi — bina ayak izi (footprint) + çatı tipi + eğim'den
 * her zaman DÜZLEMSEL, su geçirmez çatı düzlemleri üretir. (SketchUp/Aurora
 * mantığı.) Serbest nokta sürükleme yerine bu kullanılır → kusursuz sonuç.
 *
 * Koordinatlar: footprint görüntü pikseli (px). Yükseklikler metre. Yatay
 * mesafe metreye `mpp` (metre/piksel) ile çevrilir; yükselme = yatay_m * tan(eğim).
 *
 * Tipler:
 *  - "flat"  : tek yatay düzlem (saçak yüksekliğinde).
 *  - "gable" : sırt (ridge) ekseni boyunca iki eğimli düzlem (beşik çatı).
 *  - "hip"   : her kenardan içeri eğimli düzlemler (kırma çatı); dışbükey
 *              ayak izinde kenar-Voronoi bölgeleri = doğru straight-skeleton.
 */

export interface RoofPlane {
  id: string;
  name: string;
  poly: Vec[]; // çatı düzleminin ayak izi bölgesi (px)
  z: (x: number, y: number) => number; // yükseklik (m) — düzlemsel (lineer)
  tiltDeg: number;
  azimuthDeg: number; // 0=Kuzey, 90=Doğu (görüntü +x doğu, +y güney varsayımı)
}

export interface RoofModel {
  planes: RoofPlane[];
  /** Ayak izi sınırındaki çatı yüksekliği (m) — duvar/cephe yüksekliği için. */
  heightAtBoundary: (p: Vec) => number;
  ridgeM: number; // en yüksek sırt yüksekliği (m) — bilgi amaçlı
}

const EPS = 1e-7;

/** Poligonu bir yarı-düzlemle kırp (a·x+b·y ≤ c kalır). */
function clipHalf(poly: Vec[], a: number, b: number, c: number): Vec[] {
  if (poly.length < 3) return [];
  const out: Vec[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const prev = poly[(i + n - 1) % n];
    const curD = a * cur.x + b * cur.y - c;
    const prevD = a * prev.x + b * prev.y - c;
    const curIn = curD <= EPS;
    const prevIn = prevD <= EPS;
    if (curIn) {
      if (!prevIn) out.push(segCut(prev, cur, prevD, curD));
      out.push(cur);
    } else if (prevIn) {
      out.push(segCut(prev, cur, prevD, curD));
    }
  }
  return out;
}
function segCut(p: Vec, q: Vec, pd: number, qd: number): Vec {
  const t = pd / (pd - qd);
  return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
}

/** CCW/CW bağımsız: kenarın içe bakan birim normali (centroid tarafına). */
function inwardNormal(a: Vec, b: Vec, c: Vec): { nx: number; ny: number } {
  let nx = -(b.y - a.y);
  let ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  if ((c.x - mx) * nx + (c.y - my) * ny < 0) { nx = -nx; ny = -ny; }
  return { nx, ny };
}

function azimuthFromNormal(nx: number, ny: number): number {
  // Düzlem aşağı-eğim yönü = dışa normal (-nx,-ny). +y güney → azimut.
  const dx = -nx, dy = -ny;
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0=Kuzey(-y), 90=Doğu(+x)
  if (deg < 0) deg += 360;
  return Math.round(deg);
}

export function generateRoof(
  footprint: Vec[],
  type: RoofType,
  pitchDeg: number,
  ridgeAxisDeg: number,
  eavesM: number,
  mpp: number,
): RoofModel {
  const poly = footprint.filter(Boolean);
  if (poly.length < 3 || !mpp || mpp <= 0) {
    return { planes: [], heightAtBoundary: () => eavesM, ridgeM: eavesM };
  }
  const tan = Math.tan((Math.max(0, Math.min(85, pitchDeg)) * Math.PI) / 180);
  const c = centroid(poly);
  const risePerPx = mpp * tan; // her px yatay için metre yükselme

  if (type === "flat") {
    return {
      planes: [{ id: "flat", name: "Çatı", poly, z: () => eavesM, tiltDeg: 0, azimuthDeg: 0 }],
      heightAtBoundary: () => eavesM,
      ridgeM: eavesM,
    };
  }

  if (type === "gable") {
    // Sırt ekseni yönü u; ona dik n boyunca yükseklik değişir.
    const rad = (ridgeAxisDeg * Math.PI) / 180;
    const nx = -Math.sin(rad), ny = Math.cos(rad); // eksene dik birim
    const ds = poly.map((p) => (p.x - c.x) * nx + (p.y - c.y) * ny);
    const minD = Math.min(...ds), maxD = Math.max(...ds);
    const mid = (minD + maxD) / 2;
    const halfPx = (maxD - minD) / 2 || 1;
    const relief = (x: number, y: number) => {
      const d = (x - c.x) * nx + (y - c.y) * ny;
      return Math.max(0, (halfPx - Math.abs(d - mid))) * risePerPx;
    };
    const zFn = (x: number, y: number) => eavesM + relief(x, y);
    // Sırt çizgisi: n·(p-c) = mid → footprint'i ikiye böl.
    const cVal = mid + (c.x * nx + c.y * ny);
    const sideA = clipHalf(poly, nx, ny, cVal); // n·p ≤ cVal
    const sideB = clipHalf(poly, -nx, -ny, -cVal);
    const planes: RoofPlane[] = [];
    if (sideA.length >= 3) planes.push({ id: "gableA", name: "Çatı A", poly: sideA, z: zFn, tiltDeg: pitchDeg, azimuthDeg: azimuthFromNormal(nx, ny) });
    if (sideB.length >= 3) planes.push({ id: "gableB", name: "Çatı B", poly: sideB, z: zFn, tiltDeg: pitchDeg, azimuthDeg: azimuthFromNormal(-nx, -ny) });
    return { planes, heightAtBoundary: (p) => eavesM + relief(p.x, p.y), ridgeM: eavesM + halfPx * risePerPx };
  }

  // hip — her kenar için bir düzlem; bölge = o kenara diğerlerinden daha yakın
  // noktalar (dışbükeyde straight-skeleton yüzü). Yükseklik = kenara dik uzaklık.
  const n = poly.length;
  const edges = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const nm = inwardNormal(a, b, c);
    const cc = nm.nx * a.x + nm.ny * a.y; // sınır: nx*x+ny*y = cc, içeri > cc
    return { a, b, nx: nm.nx, ny: nm.ny, cc };
  });
  const planes: RoofPlane[] = [];
  let ridgeM = eavesM;
  edges.forEach((e, i) => {
    // Bölge: tüm j için  d_i ≤ d_j  →  (n_i - n_j)·p ≤ (cc_i - cc_j)
    let region = poly.slice();
    for (let j = 0; j < n && region.length >= 3; j++) {
      if (j === i) continue;
      const f = edges[j];
      region = clipHalf(region, e.nx - f.nx, e.ny - f.ny, e.cc - f.cc);
    }
    if (region.length < 3) return;
    const zFn = (x: number, y: number) => eavesM + Math.max(0, (e.nx * x + e.ny * y - e.cc)) * risePerPx;
    for (const p of region) ridgeM = Math.max(ridgeM, zFn(p.x, p.y));
    planes.push({ id: `hip${i}`, name: `Çatı ${i + 1}`, poly: region, z: zFn, tiltDeg: pitchDeg, azimuthDeg: azimuthFromNormal(e.nx, e.ny) });
  });
  return { planes, heightAtBoundary: () => eavesM, ridgeM };
}

/** Düzlemin izdüşüm alanı (m²) — panel/analiz için gerçek alan tilt ile büyür. */
export function planeAreaM2(plane: RoofPlane, mpp: number): number {
  const projected = polygonAreaPx(plane.poly) * mpp * mpp;
  return projected / Math.cos((plane.tiltDeg * Math.PI) / 180);
}

export function faceAreaM2(poly: Vec[], mpp: number): number {
  return polygonAreaPx(poly) * mpp * mpp;
}

// ─────────────────────────────────────────────────────────────────────────
// Birleşik çatı arayüzü — hem parametrik hem düzenlenebilir (grafik) kütleyi
// aynı "yüzey" listesi olarak verir. 3B, panel ve analiz bunu kullanır.
// ─────────────────────────────────────────────────────────────────────────

export interface RoofFace {
  id: string;
  name: string;
  poly: Vec[]; // px
  zAbs: (x: number, y: number) => number; // mutlak yükseklik (m)
}
export interface MassRoof {
  faces: RoofFace[];
  boundary: Vec[]; // duvar/cephe için dış hat (px)
  boundaryZ: (p: Vec) => number; // sınırdaki çatı yüksekliği (m)
  eavesM: number;
}

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `r${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

function bary(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const v0x = bx - ax, v0y = by - ay, v1x = cx - ax, v1y = cy - ay, v2x = px - ax, v2y = py - ay;
  const den = v0x * v1y - v1x * v0y;
  if (Math.abs(den) < 1e-9) return null;
  const v = (v2x * v1y - v1x * v2y) / den;
  const w = (v0x * v2y - v2x * v0y) / den;
  return { u: 1 - v - w, v, w };
}

/** Fan-üçgen yükseklik örnekleyici — düzlemsel olmasa da sürekli yükseklik verir. */
function fanSampler(pts: { x: number; y: number; z: number }[]): (x: number, y: number) => number {
  const avg = pts.reduce((s, p) => s + p.z, 0) / (pts.length || 1);
  if (pts.length < 3) return () => avg;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
  return (x, y) => {
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      const bc = bary(x, y, cx, cy, a.x, a.y, b.x, b.y);
      if (bc && bc.u >= -0.02 && bc.v >= -0.02 && bc.w >= -0.02) return bc.u * cz + bc.v * a.z + bc.w * b.z;
    }
    return cz;
  };
}

export function massRoof(mass: Mass, mpp: number): MassRoof {
  const eavesM = mass.baseM + mass.wallM;
  if (!mass.roofEditable) {
    const m = generateRoof(mass.footprint, mass.roofType, mass.pitchDeg, mass.ridgeAxisDeg, eavesM, mpp);
    return {
      faces: m.planes.map((p) => ({ id: p.id, name: p.name, poly: p.poly, zAbs: p.z })),
      boundary: mass.footprint,
      boundaryZ: m.heightAtBoundary,
      eavesM,
    };
  }
  const nodeById = new Map(mass.roofNodes.map((n) => [n.id, n]));
  const faces = detectFaces(mass.roofNodes, mass.roofEdges).map((f, i) => {
    const poly = faceCoords(f, mass.roofNodes);
    const p3 = f.nodes.map((id) => { const n = nodeById.get(id)!; return { x: n.x, y: n.y, z: eavesM + (n.z || 0) }; });
    return { id: f.sig, name: `Çatı ${i + 1}`, poly, zAbs: fanSampler(p3) };
  });
  const bIds = detectOuterBoundary(mass.roofNodes, mass.roofEdges);
  const boundary = bIds
    ? (bIds.map((id) => nodeById.get(id)).filter(Boolean).map((n) => ({ x: n!.x, y: n!.y })))
    : mass.footprint;
  const boundaryZ = (p: Vec) => {
    let best = eavesM, bd = Infinity;
    for (const n of mass.roofNodes) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < bd) { bd = d; best = eavesM + (n.z || 0); } }
    return best;
  };
  return { faces, boundary, boundaryZ, eavesM };
}

/** Parametrik çatıyı düzenlenebilir grafiğe "tohumla" (elle düzenlemeye geçiş). */
export function seedRoofGraph(mass: Mass, mpp: number): { nodes: RNode[]; edges: REdge[] } {
  const eavesM = mass.baseM + mass.wallM;
  const model = generateRoof(mass.footprint, mass.roofType, mass.pitchDeg, mass.ridgeAxisDeg, eavesM, mpp);
  const nodes: RNode[] = [];
  const key2id = new Map<string, string>();
  const r = (v: number) => Math.round(v * 2) / 2;
  const getId = (x: number, y: number, z: number) => {
    const k = `${r(x)},${r(y)}`;
    let id = key2id.get(k);
    if (!id) { id = genId(); key2id.set(k, id); nodes.push({ id, x, y, z }); }
    return id;
  };
  const edgeSet = new Set<string>();
  const edges: REdge[] = [];
  for (const pl of model.planes) {
    const ids = pl.poly.map((p) => getId(p.x, p.y, pl.z(p.x, p.y) - eavesM));
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i], b = ids[(i + 1) % ids.length];
      if (a === b) continue;
      const ek = [a, b].sort().join("|");
      if (edgeSet.has(ek)) continue;
      edgeSet.add(ek);
      edges.push({ id: genId(), a, b });
    }
  }
  return { nodes, edges };
}
