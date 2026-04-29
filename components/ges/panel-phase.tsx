"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight, LayoutGrid, MousePointer, RotateCcw, RotateCw, Trash2, X, Save, Ruler,
} from "lucide-react";
import { saveDrawing } from "@/app/actions/ges";

// ── Constants ────────────────────────────────────────────────────────────────
const CW = 1200, CH = 700;
const ISO_H = 55;
const PW_M = 1.134, PH_M = 2.382, GAP_M = 0.02;
const ROOF_COLOR = "#c05828";

// ── Types ────────────────────────────────────────────────────────────────────
type Orient = "portrait" | "landscape";
type PanelMode = "auto" | "manual";

interface Roof {
  id: string;
  vertices: [number, number][];
  elevations: number[];
  color: string;
}

interface Panel {
  id: number;
  roofId: string;
  corners: [[number, number], [number, number], [number, number], [number, number]];
}

interface SceneCtx {
  cx0: number;
  cy0: number;
  baseScale: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function mPxAt(lat: number, zoom: number) {
  return 156543.03392 * Math.cos((lat * Math.PI) / 180) / Math.pow(2, zoom);
}

function buildEsriUrl(lat: number, lng: number, zoom: number) {
  const z = Math.min(Math.max(zoom, 14), 18);
  const m = mPxAt(lat, z);
  const cosL = Math.cos((lat * Math.PI) / 180);
  const hw = (CW / 2) * m, hh = (CH / 2) * m;
  const dLng = hw / (111320 * cosL), dLat = hh / 110540;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}&bboxSR=4326&size=${CW},${CH}&imageSR=4326&format=jpg&f=image`;
}

function ll2px(la: number, ln: number, cLat: number, cLng: number, zoom: number): [number, number] {
  const m = mPxAt(cLat, zoom);
  const cosL = Math.cos((cLat * Math.PI) / 180);
  return [CW / 2 + ((ln - cLng) * 111320 * cosL) / m, CH / 2 - ((la - cLat) * 110540) / m];
}

function px2ll(px: number, py: number, cLat: number, cLng: number, zoom: number): [number, number] {
  const m = mPxAt(cLat, zoom);
  const cosL = Math.cos((cLat * Math.PI) / 180);
  return [cLat + ((CH / 2 - py) * m) / 110540, cLng + ((px - CW / 2) * m) / (111320 * cosL)];
}

function ll2m(la: number, ln: number, rLat: number, rLng: number): [number, number] {
  const cosR = Math.cos((rLat * Math.PI) / 180);
  return [(ln - rLng) * 111320 * cosR, (la - rLat) * 110540];
}

function m2ll(mx: number, my: number, rLat: number, rLng: number): [number, number] {
  const cosR = Math.cos((rLat * Math.PI) / 180);
  return [rLat + my / 110540, rLng + mx / (111320 * cosR)];
}

function ptInPoly(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function projOrbital(wx: number, wy: number, wz: number, az: number, el: number): [number, number] {
  const rx = wx * Math.cos(az) + wy * Math.sin(az);
  const ry = -wx * Math.sin(az) + wy * Math.cos(az);
  return [rx, ry * Math.sin(el) - wz * Math.cos(el)];
}

function buildSceneCtx(roofs: Roof[], cLat: number, cLng: number, zoom: number): SceneCtx {
  if (roofs.length === 0) return { cx0: CW / 2, cy0: CH / 2, baseScale: 1 };
  const allPx = roofs.flatMap((r) => r.vertices.map(([la, ln]) => ll2px(la, ln, cLat, cLng, zoom)));
  const cx0 = allPx.reduce((s, p) => s + p[0], 0) / allPx.length;
  const cy0 = allPx.reduce((s, p) => s + p[1], 0) / allPx.length;
  const xs = allPx.map((p) => p[0]), ys = allPx.map((p) => p[1]);
  const maxDim = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  return { cx0, cy0, baseScale: (Math.min(CW, CH) * 0.28) / maxDim };
}

function vertexWorldZ(elev: number, sc: SceneCtx, mPerPx: number): number {
  return ISO_H + (elev / mPerPx) * sc.baseScale;
}

function roofVertexZArr(roof: Roof, pxArr: [number, number][], sc: SceneCtx, mPerPx: number): number[] {
  return pxArr.map((_, i) => vertexWorldZ(roof.elevations[i] ?? 0, sc, mPerPx));
}

function worldPointElev(wx: number, wy: number, roof: Roof, ptsG: [number, number][]): number {
  const n = ptsG.length;
  if (roof.elevations.every((e) => Math.abs(e) < 0.01)) return 0;
  let wsum = 0, esum = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(wx - ptsG[i][0], wy - ptsG[i][1]) + 0.0001;
    const w = 1 / (d * d);
    wsum += w;
    esum += w * (roof.elevations[i] ?? 0);
  }
  return esum / wsum;
}

function fillRoof(roof: Roof, orient: Orient, idOffset: number, groupEnabled = false, panelsPerGroup = 4, groupGap = 0.5): Panel[] {
  if (roof.vertices.length < 3) return [];
  const rLat = roof.vertices.reduce((s, [la]) => s + la, 0) / roof.vertices.length;
  const rLng = roof.vertices.reduce((s, [, ln]) => s + ln, 0) / roof.vertices.length;
  const polyM = roof.vertices.map(([la, ln]) => ll2m(la, ln, rLat, rLng));
  let domAngle = 0, maxLen = 0;
  for (let i = 0; i < polyM.length; i++) {
    const j = (i + 1) % polyM.length;
    const dx = polyM[j][0] - polyM[i][0], dy = polyM[j][1] - polyM[i][1];
    const len = Math.hypot(dx, dy);
    if (len > maxLen) { maxLen = len; domAngle = Math.atan2(dy, dx); }
  }
  const pW = orient === "portrait" ? PW_M : PH_M;
  const pH = orient === "portrait" ? PH_M : PW_M;

  function tryAngle(angle: number, baseId: number): Panel[] {
    const cA = Math.cos(-angle), sA = Math.sin(-angle);
    const rot = ([x, y]: [number, number]): [number, number] => [x * cA - y * sA, x * sA + y * cA];
    const unrot = ([x, y]: [number, number]): [number, number] => [x * cA + y * sA, -x * sA + y * cA];
    const rPoly = polyM.map(rot);
    const xs = rPoly.map((v) => v[0]), ys = rPoly.map((v) => v[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const panels: Panel[] = []; let id = baseId;
    let rowIdx = 0;
    while (true) {
      const groupRow = groupEnabled ? Math.floor(rowIdx / panelsPerGroup) : 0;
      const y = y0 + rowIdx * (pH + GAP_M) + (groupEnabled ? groupRow * groupGap : 0);
      if (y + pH > y1 + 0.01) break;
      for (let x = x0; x + pW <= x1 + 0.01; x += pW + GAP_M) {
        const corners: [number, number][] = [[x, y], [x + pW, y], [x + pW, y + pH], [x, y + pH]];
        if (corners.every((c) => ptInPoly(c[0], c[1], rPoly))) {
          const ll = corners.map((c) => { const [mx, my] = unrot(c); return m2ll(mx, my, rLat, rLng); });
          panels.push({ id: id++, roofId: roof.id, corners: ll as Panel["corners"] });
        }
      }
      rowIdx++;
    }
    return panels;
  }
  const a1 = tryAngle(domAngle, idOffset);
  const a2 = tryAngle(domAngle + Math.PI / 2, idOffset);
  return a1.length >= a2.length ? a1 : a2;
}

function singlePanel(mx: number, my: number, roof: Roof, orient: Orient, rLat: number, rLng: number, id: number): Panel | null {
  const pW = orient === "portrait" ? PW_M : PH_M;
  const pH = orient === "portrait" ? PH_M : PW_M;
  const polyM = roof.vertices.map(([la, ln]) => ll2m(la, ln, rLat, rLng));
  let domAngle = 0, maxLen = 0;
  for (let i = 0; i < polyM.length; i++) {
    const j = (i + 1) % polyM.length;
    const dx = polyM[j][0] - polyM[i][0], dy = polyM[j][1] - polyM[i][1];
    const len = Math.hypot(dx, dy);
    if (len > maxLen) { maxLen = len; domAngle = Math.atan2(dy, dx); }
  }
  const cA = Math.cos(-domAngle), sA = Math.sin(-domAngle);
  const rot = ([x, y]: [number, number]): [number, number] => [x * cA - y * sA, x * sA + y * cA];
  const unrot = ([x, y]: [number, number]): [number, number] => [x * cA + y * sA, -x * sA + y * cA];
  const rPoly = polyM.map(rot);
  const [rmx, rmy] = rot([mx, my]);
  const snx = Math.floor(rmx / (pW + GAP_M)) * (pW + GAP_M);
  const sny = Math.floor(rmy / (pH + GAP_M)) * (pH + GAP_M);
  const corners: [number, number][] = [[snx, sny], [snx + pW, sny], [snx + pW, sny + pH], [snx, sny + pH]];
  if (!corners.every((c) => ptInPoly(c[0], c[1], rPoly))) return null;
  const ll = corners.map((c) => { const [ux, uy] = unrot(c); return m2ll(ux, uy, rLat, rLng); });
  return { id, roofId: roof.id, corners: ll as Panel["corners"] };
}

// ── Panel drawing ─────────────────────────────────────────────────────────────
function lerp2(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function bilinear(
  c0: [number, number], c1: [number, number],
  c3: [number, number], c2: [number, number],
  u: number, v: number,
): [number, number] {
  return lerp2(lerp2(c0, c1, u), lerp2(c3, c2, u), v);
}

function drawPanel3D(
  ctx: CanvasRenderingContext2D,
  projC: [number, number][],
  sel: boolean,
  hov: boolean,
  preview = false,
) {
  const c0 = projC[0] as [number, number], c1 = projC[1] as [number, number];
  const c2 = projC[2] as [number, number], c3 = projC[3] as [number, number];

  function outerPath() {
    ctx.beginPath(); ctx.moveTo(c0[0], c0[1]);
    ctx.lineTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]);
    ctx.closePath();
  }

  if (preview) {
    outerPath();
    ctx.fillStyle = "rgba(30,58,138,0.5)"; ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke();
    return;
  }

  // White frame fill
  outerPath();
  ctx.fillStyle = "#ffffff"; ctx.fill();

  // Selection / hover border on outer edge
  ctx.strokeStyle = sel ? "#fbbf24" : hov ? "#fde68a" : "rgba(255,255,255,0.85)";
  ctx.lineWidth = sel ? 2.5 : 1.5;
  ctx.stroke();

  // Inner cell area (inset by 6% on each side)
  const f = 0.06;
  const inner: [number, number][] = [
    bilinear(c0, c1, c3, c2, f, f),       // TL
    bilinear(c0, c1, c3, c2, 1 - f, f),   // TR
    bilinear(c0, c1, c3, c2, 1 - f, 1 - f), // BR
    bilinear(c0, c1, c3, c2, f, 1 - f),   // BL
  ];

  const pw = Math.hypot(inner[1][0] - inner[0][0], inner[1][1] - inner[0][1]);
  const ph = Math.hypot(inner[3][0] - inner[0][0], inner[3][1] - inner[0][1]);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(inner[0][0], inner[0][1]);
  ctx.lineTo(inner[1][0], inner[1][1]);
  ctx.lineTo(inner[2][0], inner[2][1]);
  ctx.lineTo(inner[3][0], inner[3][1]);
  ctx.closePath();
  ctx.fillStyle = "#0d1520"; ctx.fill();
  ctx.clip();

  if (pw > 6 && ph > 6) {
    // Cell grid — 6 rows × 3 columns
    ctx.strokeStyle = "rgba(255,255,255,0.38)"; ctx.lineWidth = 0.7;
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const a = lerp2(inner[0], inner[3], t), b = lerp2(inner[1], inner[2], t);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (let i = 1; i < 3; i++) {
      const t = i / 3;
      const a = lerp2(inner[0], inner[1], t), b = lerp2(inner[3], inner[2], t);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Compass ──────────────────────────────────────────────────────────────────
const COMPASS_CX = CW - 72, COMPASS_CY = CH - 72, COMPASS_R = 32;

function drawCompass(ctx: CanvasRenderingContext2D) {
  const cx = COMPASS_CX, cy = COMPASS_CY, r = COMPASS_R;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(8,15,28,0.82)"; ctx.fill();
  ctx.strokeStyle = "rgba(99,102,241,0.3)"; ctx.lineWidth = 1; ctx.stroke();
  const dirs = [{ l: "N", dx: 0, dy: -1 }, { l: "S", dx: 0, dy: 1 }, { l: "E", dx: 1, dy: 0 }, { l: "W", dx: -1, dy: 0 }];
  ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const d of dirs) {
    const bx = cx + d.dx * r, by = cy + d.dy * r;
    ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(40,50,68,0.9)"; ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.fillText(d.l, bx, by);
  }
  // TOP center
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(40,50,68,0.9)"; ctx.fill();
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#94a3b8"; ctx.font = "bold 7px sans-serif"; ctx.fillText("TOP", cx, cy);
  ctx.restore();
}

// ── Main render ──────────────────────────────────────────────────────────────
function renderScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  roofs: Roof[], panels: Panel[],
  removedIds: Set<number>, selectedIds: Set<number>, hovPanel: number | null,
  manPreview: Panel | null,
  showLengths: boolean,
  az: number, el: number,
  vScale: number, vPan: { x: number; y: number },
  cLat: number, cLng: number, zoom: number,
) {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = "#0d1827"; ctx.fillRect(0, 0, CW, CH);

  const sc = buildSceneCtx(roofs, cLat, cLng, zoom);
  const mPerPx = mPxAt(cLat, zoom);

  function proj(ix: number, iy: number, wz: number): [number, number] {
    const wx = (ix - sc.cx0) * sc.baseScale, wy = (iy - sc.cy0) * sc.baseScale;
    const [sx, sy] = projOrbital(wx, wy, wz, az, el);
    return [CW / 2 + sx * vScale + vPan.x, CH / 2 + sy * vScale + vPan.y];
  }

  // Satellite background
  if (img) {
    const A = proj(0, 0, 0), B = proj(CW, 0, 0), C = proj(0, CH, 0);
    const a = (B[0] - A[0]) / CW, b = (B[1] - A[1]) / CW;
    const c = (C[0] - A[0]) / CH, d = (C[1] - A[1]) / CH;
    ctx.save(); ctx.setTransform(a, b, c, d, A[0], A[1]); ctx.drawImage(img, 0, 0, CW, CH); ctx.restore();
  }

  // Shared edges detection
  const shared = new Set<string>();
  for (let ri = 0; ri < roofs.length; ri++) {
    for (let rj = ri + 1; rj < roofs.length; rj++) {
      const a = roofs[ri], b = roofs[rj];
      for (let ai = 0; ai < a.vertices.length; ai++) {
        const [a0la, a0ln] = a.vertices[ai], [a1la, a1ln] = a.vertices[(ai + 1) % a.vertices.length];
        for (let bi = 0; bi < b.vertices.length; bi++) {
          const [b0la, b0ln] = b.vertices[bi], [b1la, b1ln] = b.vertices[(bi + 1) % b.vertices.length];
          const eps = 0.000015;
          const fwd = Math.abs(a0la - b0la) < eps && Math.abs(a0ln - b0ln) < eps && Math.abs(a1la - b1la) < eps && Math.abs(a1ln - b1ln) < eps;
          const rev = Math.abs(a0la - b1la) < eps && Math.abs(a0ln - b1ln) < eps && Math.abs(a1la - b0la) < eps && Math.abs(a1ln - b0ln) < eps;
          if (fwd || rev) { shared.add(`${ri}-${ai}`); shared.add(`${rj}-${bi}`); }
        }
      }
    }
  }

  // Draw roofs
  for (let ri = 0; ri < roofs.length; ri++) {
    const roof = roofs[ri];
    if (roof.vertices.length < 3) continue;
    const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, cLat, cLng, zoom));
    const n = pxArr.length;
    const topZ = roofVertexZArr(roof, pxArr, sc, mPerPx);
    const screenTop = pxArr.map(([ix, iy], i) => proj(ix, iy, topZ[i]));
    const screenBot = pxArr.map(([ix, iy]) => proj(ix, iy, 0));

    // Walls — fully opaque, back-face culled
    for (let i = 0; i < n; i++) {
      if (shared.has(`${ri}-${i}`)) continue;
      const j = (i + 1) % n;
      const dx1 = screenBot[j][0] - screenBot[i][0], dy1 = screenBot[j][1] - screenBot[i][1];
      const dx2 = screenTop[j][0] - screenBot[i][0], dy2 = screenTop[j][1] - screenBot[i][1];
      if (dx1 * dy2 - dy1 * dx2 >= 0) continue; // back-facing wall, cull
      ctx.beginPath();
      ctx.moveTo(screenBot[i][0], screenBot[i][1]); ctx.lineTo(screenBot[j][0], screenBot[j][1]);
      ctx.lineTo(screenTop[j][0], screenTop[j][1]); ctx.lineTo(screenTop[i][0], screenTop[i][1]);
      ctx.closePath();
      ctx.fillStyle = "#0d0d14"; ctx.fill();
      ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 0.7; ctx.stroke();
    }

    // Top face
    ctx.beginPath(); ctx.moveTo(screenTop[0][0], screenTop[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(screenTop[i][0], screenTop[i][1]);
    ctx.closePath();
    ctx.fillStyle = ROOF_COLOR; ctx.fill();
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.2; ctx.stroke();

    // Edge length labels (no background)
    if (showLengths) {
      ctx.save();
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 4;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const [la1, ln1] = roof.vertices[i], [la2, ln2] = roof.vertices[j];
        const edx = (ln2 - ln1) * 111320 * Math.cos((la1 * Math.PI) / 180);
        const edy = (la2 - la1) * 110540;
        const lenM = Math.hypot(edx, edy);
        const midX = (screenTop[i][0] + screenTop[j][0]) / 2;
        const midY = (screenTop[i][1] + screenTop[j][1]) / 2;
        const label = lenM < 1 ? `${(lenM * 100).toFixed(0)}cm` : `${lenM.toFixed(2)}m`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, midX, midY);
      }
      ctx.restore();
    }
  }

  // Panels — grouped by roof and clipped to that roof's top face so they never bleed across ridges
  type PanelWithFlag = Panel & { _preview?: boolean };
  const allPanels: PanelWithFlag[] = manPreview ? [...panels, { ...manPreview, _preview: true }] : panels;

  // Build per-roof map
  const panelsByRoof = new Map<string, PanelWithFlag[]>();
  for (const p of allPanels) {
    if (!p._preview && removedIds.has(p.id)) continue;
    if (!panelsByRoof.has(p.roofId)) panelsByRoof.set(p.roofId, []);
    panelsByRoof.get(p.roofId)!.push(p);
  }

  for (const [roofId, rPanels] of panelsByRoof) {
    const roof = roofs.find(r => r.id === roofId);
    if (!roof || roof.vertices.length < 3) continue;
    const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, cLat, cLng, zoom));
    const topZ = roofVertexZArr(roof, pxArr, sc, mPerPx);
    const screenTop = pxArr.map(([ix, iy], i) => proj(ix, iy, topZ[i]));
    const ptsG = pxArr.map(([ix, iy]) => [(ix - sc.cx0) * sc.baseScale, (iy - sc.cy0) * sc.baseScale] as [number, number]);

    ctx.save();
    // Clip to this roof's top face
    ctx.beginPath();
    ctx.moveTo(screenTop[0][0], screenTop[0][1]);
    for (let i = 1; i < screenTop.length; i++) ctx.lineTo(screenTop[i][0], screenTop[i][1]);
    ctx.closePath();
    ctx.clip();

    for (const p of rPanels) {
      const projC = p.corners.map(([la, ln]) => {
        const [ix, iy] = ll2px(la, ln, cLat, cLng, zoom);
        const wx = (ix - sc.cx0) * sc.baseScale, wy = (iy - sc.cy0) * sc.baseScale;
        const elev = worldPointElev(wx, wy, roof, ptsG);
        return proj(ix, iy, vertexWorldZ(elev, sc, mPerPx));
      });
      drawPanel3D(ctx, projC, selectedIds.has(p.id), hovPanel === p.id, p._preview === true);
    }

    ctx.restore();
  }

  drawCompass(ctx);
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  projectId: string;
  lat: number;
  lng: number;
  zoom: number;
  roofs: { id: string; vertices: [number, number][]; color: string; height: number; elevations?: number[] }[];
  savedPanelCfg?: { orientation: string; panelsPerGroup: number; panelHGap: number; groupHGap: number; panelVGap: number };
  savedRemovedPanels: number[];
}

export default function PanelPhase({ projectId, lat, lng, zoom: rawZoom, roofs: rawRoofs, savedPanelCfg, savedRemovedPanels }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fixedZoom = Math.max(rawZoom, 17);

  const roofs: Roof[] = rawRoofs.map((r) => ({
    id: r.id, vertices: r.vertices, color: ROOF_COLOR,
    elevations: r.elevations ?? Array(r.vertices.length).fill(0),
  }));

  const [vScale, setVScale] = useState(1.0);
  const [vPan, setVPan] = useState({ x: 0, y: 0 });
  const [az, setAz] = useState(0);
  const [el, setEl] = useState(Math.PI * 30 / 180);
  const [orient, setOrient] = useState<Orient>((savedPanelCfg?.orientation as Orient) || "portrait");
  const [pMode, setPMode] = useState<PanelMode>("auto");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set(savedRemovedPanels));
  const [hovPanel, setHovPanel] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [boxRect, setBoxRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [manPreview, setManPreview] = useState<Panel | null>(null);
  const [groupEnabled, setGroupEnabled] = useState(false);
  const [panelsPerGroup, setPanelsPerGroup] = useState(savedPanelCfg?.panelsPerGroup ?? 4);
  const [groupGap, setGroupGap] = useState(savedPanelCfg?.groupHGap ?? 0.5);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLengths, setShowLengths] = useState(true);

  const vScaleRef = useRef(1.0);
  const vPanRef = useRef({ x: 0, y: 0 });
  const azRef = useRef(0);
  const elRef = useRef(Math.PI * 30 / 180);
  useEffect(() => { vScaleRef.current = vScale; }, [vScale]);
  useEffect(() => { vPanRef.current = vPan; }, [vPan]);
  useEffect(() => { azRef.current = az; }, [az]);
  useEffect(() => { elRef.current = el; }, [el]);

  const dragType = useRef<"none" | "orbit" | "pan" | "panels" | "boxsel">("none");
  const dragStart = useRef<[number, number]>([0, 0]);
  const dragAzEl = useRef({ az: 0, el: 0 });
  const dragPan = useRef({ x: 0, y: 0 });
  const dragImg = useRef<[number, number]>([0, 0]);
  const panelOrigs = useRef<Map<number, Panel>>(new Map());

  const dataRef = useRef({ roofs, panels, removedIds, hovPanel, selectedIds, boxRect, orient, pMode, manPreview, showLengths });
  dataRef.current = { roofs, panels, removedIds, hovPanel, selectedIds, boxRect, orient, pMode, manPreview, showLengths };

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.onerror = () => { imgRef.current = null; setImgLoaded(true); };
    img.src = buildEsriUrl(lat, lng, fixedZoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (roofs.length > 0) {
      let offset = 0; const all: Panel[] = [];
      for (const r of roofs) {
        const ps = fillRoof(r, (savedPanelCfg?.orientation as Orient) || "portrait", offset);
        offset += ps.length; all.push(...ps);
      }
      setPanels(all);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = dataRef.current;
    renderScene(
      ctx, imgRef.current, d.roofs, d.panels, d.removedIds, d.selectedIds, d.hovPanel,
      d.manPreview, d.showLengths,
      az, el, vScale, vPan, lat, lng, fixedZoom,
    );
  }, [az, el, vScale, vPan, lat, lng, fixedZoom]);

  useEffect(() => { redraw(); }, [redraw, panels, removedIds, hovPanel, selectedIds, manPreview, showLengths, imgLoaded]);

  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const delta = e.deltaY < 0 ? 1.14 : 0.88;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (CW / rect.width);
    const sy = (e.clientY - rect.top) * (CH / rect.height);
    setVScale((prev) => {
      const ns = Math.max(0.3, Math.min(12, prev * delta));
      const ratio = ns / prev;
      setVPan((pp) => ({
        x: sx - CW / 2 - (sx - CW / 2 - pp.x) * ratio,
        y: sy - CH / 2 - (sy - CH / 2 - pp.y) * ratio,
      }));
      return ns;
    });
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const h = (e: WheelEvent) => wheelRef.current(e);
    canvas.addEventListener("wheel", h, { passive: false });
    return () => canvas.removeEventListener("wheel", h);
  }, []);

  useEffect(() => {
    function onUp(e: MouseEvent) {
      if (e.button === 2) { dragType.current = "none"; return; }
      if (dragType.current === "boxsel") {
        const box = dataRef.current.boxRect;
        if (box) {
          const ids = new Set<number>();
          const sc = buildSceneCtx(dataRef.current.roofs, lat, lng, fixedZoom);
          for (const p of dataRef.current.panels) {
            if (dataRef.current.removedIds.has(p.id)) continue;
            const centLa = p.corners.reduce((s, [la]) => s + la, 0) / 4;
            const centLn = p.corners.reduce((s, [, ln]) => s + ln, 0) / 4;
            const [ix, iy] = ll2px(centLa, centLn, lat, lng, fixedZoom);
            const wx = (ix - sc.cx0) * sc.baseScale, wy = (iy - sc.cy0) * sc.baseScale;
            const [psx, psy] = projOrbital(wx, wy, ISO_H, azRef.current, elRef.current);
            const cpx = CW / 2 + psx * vScaleRef.current + vPanRef.current.x;
            const cpy = CH / 2 + psy * vScaleRef.current + vPanRef.current.y;
            if (cpx >= box.x1 && cpx <= box.x2 && cpy >= box.y1 && cpy <= box.y2) ids.add(p.id);
          }
          setSelectedIds(ids);
        }
        setBoxRect(null);
      }
      dragType.current = "none";
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [lat, lng, fixedZoom]);

  function canvasXY(e: React.MouseEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) * (CW / rect.width), (e.clientY - rect.top) * (CH / rect.height)];
  }

  function screenToImgPx(sx: number, sy: number): [number, number] {
    const sc = buildSceneCtx(dataRef.current.roofs, lat, lng, fixedZoom);
    const rx = (sx - CW / 2 - vPanRef.current.x) / vScaleRef.current;
    const ry = (sy - CH / 2 - vPanRef.current.y) / vScaleRef.current;
    const sinEl = Math.sin(elRef.current);
    if (Math.abs(sinEl) < 0.001) return [CW / 2, CH / 2];
    const q = ry / sinEl;
    const wx = rx * Math.cos(azRef.current) - q * Math.sin(azRef.current);
    const wy = rx * Math.sin(azRef.current) + q * Math.cos(azRef.current);
    return [wx / sc.baseScale + sc.cx0, wy / sc.baseScale + sc.cy0];
  }

  function findPanelAtScreen(sx: number, sy: number): number | null {
    const d = dataRef.current;
    const sc = buildSceneCtx(d.roofs, lat, lng, fixedZoom);
    for (let i = d.panels.length - 1; i >= 0; i--) {
      const p = d.panels[i];
      if (d.removedIds.has(p.id)) continue;
      const projC = p.corners.map(([la, ln]) => {
        const [ix, iy] = ll2px(la, ln, lat, lng, fixedZoom);
        const wx = (ix - sc.cx0) * sc.baseScale, wy = (iy - sc.cy0) * sc.baseScale;
        const [psx, psy] = projOrbital(wx, wy, ISO_H, azRef.current, elRef.current);
        return [CW / 2 + psx * vScaleRef.current + vPanRef.current.x, CH / 2 + psy * vScaleRef.current + vPanRef.current.y] as [number, number];
      });
      if (ptInPoly(sx, sy, projC)) return p.id;
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const [sx, sy] = canvasXY(e);

    if (e.button === 1) {
      e.preventDefault();
      dragType.current = "pan"; dragStart.current = [e.clientX, e.clientY]; dragPan.current = { ...vPanRef.current };
      return;
    }
    if (e.button === 2) {
      dragType.current = "orbit"; dragStart.current = [e.clientX, e.clientY];
      dragAzEl.current = { az: azRef.current, el: elRef.current };
      return;
    }

    const d = dataRef.current;

    if (d.pMode === "manual") {
      if (d.manPreview) {
        setPanels((prev) => [...prev, { ...d.manPreview! }]);
        setManPreview(null);
      }
      return;
    }

    const hitId = findPanelAtScreen(sx, sy);
    if (hitId !== null) {
      const sel = d.selectedIds.has(hitId) ? d.selectedIds : e.shiftKey ? new Set([...d.selectedIds, hitId]) : new Set([hitId]);
      setSelectedIds(sel);
      dragType.current = "panels"; dragImg.current = [sx, sy];
      const origMap = new Map<number, Panel>();
      for (const id of sel) { const p = d.panels.find((pp) => pp.id === id); if (p) origMap.set(id, p); }
      panelOrigs.current = origMap;
    } else {
      if (!e.shiftKey) setSelectedIds(new Set());
      dragType.current = "boxsel"; dragImg.current = [sx, sy];
      setBoxRect({ x1: sx, y1: sy, x2: sx, y2: sy });
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (CW / rect.width);
    const sy = (e.clientY - rect.top) * (CH / rect.height);
    const dt = dragType.current;

    if (dt === "pan") {
      const dx = (e.clientX - dragStart.current[0]) * (CW / rect.width);
      const dy = (e.clientY - dragStart.current[1]) * (CH / rect.height);
      const np = { x: dragPan.current.x + dx, y: dragPan.current.y + dy };
      vPanRef.current = np; setVPan(np); return;
    }
    if (dt === "orbit") {
      const dx = (e.clientX - dragStart.current[0]) * 0.007;
      const dy = (e.clientY - dragStart.current[1]) * 0.007;
      azRef.current = dragAzEl.current.az + dx;
      elRef.current = Math.max(0.1, Math.min(Math.PI / 2, dragAzEl.current.el - dy));
      setAz(azRef.current); setEl(elRef.current); return;
    }
    if (dt === "panels") {
      const [ix, iy] = screenToImgPx(sx, sy);
      const [ix0, iy0] = screenToImgPx(dragImg.current[0], dragImg.current[1]);
      const m = mPxAt(lat, fixedZoom); const cosL = Math.cos((lat * Math.PI) / 180);
      const dLat = -(iy - iy0) * m / 110540;
      const dLng = (ix - ix0) * m / (111320 * cosL);
      setPanels((prev) => prev.map((p) => {
        const orig = panelOrigs.current.get(p.id);
        if (!orig) return p;
        return { ...p, corners: orig.corners.map(([la, ln]) => [la + dLat, ln + dLng]) as Panel["corners"] };
      }));
      return;
    }
    if (dt === "boxsel") {
      const si = dragImg.current;
      setBoxRect({ x1: Math.min(si[0], sx), y1: Math.min(si[1], sy), x2: Math.max(si[0], sx), y2: Math.max(si[1], sy) });
      return;
    }

    // Hover / manual preview
    const d = dataRef.current;
    if (d.pMode === "auto") {
      setHovPanel(findPanelAtScreen(sx, sy));
    } else {
      // Manual preview — unproject to ground, find panel slot
      const [ix, iy] = screenToImgPx(sx, sy);
      const [la, ln] = px2ll(ix, iy, lat, lng, fixedZoom);
      let preview: Panel | null = null;
      for (const roof of d.roofs) {
        const rLat = roof.vertices.reduce((s, [l]) => s + l, 0) / roof.vertices.length;
        const rLng = roof.vertices.reduce((s, [, n]) => s + n, 0) / roof.vertices.length;
        const [mx, my] = ll2m(la, ln, rLat, rLng);
        const p = singlePanel(mx, my, roof, d.orient, rLat, rLng, Date.now());
        if (p) { preview = p; break; }
      }
      setManPreview(preview);
    }
  }

  function handleMouseLeave() { setHovPanel(null); setManPreview(null); }
  function handleContextMenu(e: React.MouseEvent) { e.preventDefault(); }

  function doFillRoof(roofId: string) {
    const roof = roofs.find((r) => r.id === roofId); if (!roof) return;
    const others = panels.filter((p) => p.roofId !== roofId);
    const offset = others.length > 0 ? Math.max(...others.map((p) => p.id)) + 1 : 0;
    const fresh = fillRoof(roof, orient, offset, groupEnabled, panelsPerGroup, groupGap);
    setPanels([...others, ...fresh]);
    setRemovedIds((prev) => { const s = new Set(prev); fresh.forEach((p) => s.delete(p.id)); return s; });
    setSelectedIds(new Set());
  }

  function clearRoofPanels(roofId: string) { setPanels((prev) => prev.filter((p) => p.roofId !== roofId)); setSelectedIds(new Set()); }
  function deleteSelected() { setRemovedIds((prev) => new Set([...prev, ...selectedIds])); setSelectedIds(new Set()); }

  function rotateSelected(deg: number) {
    const rads = (deg * Math.PI) / 180;
    const selP = panels.filter((p) => selectedIds.has(p.id)); if (!selP.length) return;
    const allC = selP.flatMap((p) => p.corners);
    const rLat = allC.reduce((s, [la]) => s + la, 0) / allC.length;
    const rLng = allC.reduce((s, [, ln]) => s + ln, 0) / allC.length;
    const cosR = Math.cos(rads), sinR = Math.sin(rads);
    setPanels((prev) => prev.map((p) => {
      if (!selectedIds.has(p.id)) return p;
      const nc = p.corners.map(([la, ln]) => {
        const [mx, my] = ll2m(la, ln, rLat, rLng);
        return m2ll(mx * cosR - my * sinR, mx * sinR + my * cosR, rLat, rLng);
      }) as Panel["corners"];
      return { ...p, corners: nc };
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const active = panels.filter((p) => !removedIds.has(p.id));
      await saveDrawing(
        projectId,
        roofs.map((r) => ({ id: r.id, color: r.color, height: 4, vertices: r.vertices, elevations: r.elevations })),
        { orientation: orient, panelsPerGroup, panelHGap: 0, groupHGap: groupGap, panelVGap: 0 },
        Array.from(removedIds),
        active.length,
      );
      router.push(`/projects/${projectId}/detail`);
    } finally {
      setSaving(false);
    }
  }

  const activeCount = panels.filter((p) => !removedIds.has(p.id)).length;
  const hasSelection = selectedIds.size > 0;
  const cursor = dragType.current === "panels" ? "grabbing" : pMode === "manual" ? "cell" : hovPanel !== null ? "pointer" : dragType.current === "orbit" ? "grabbing" : "default";

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white select-none">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-700/60 flex-shrink-0 flex-wrap">
        <button onClick={() => router.push(`/projects/${projectId}/drawing`)}
          className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300">
          ← Çizime Dön
        </button>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">2 / Panel Yerleşimi</span>
        <div className="flex-1" />

        <button onClick={() => setShowLengths((v) => !v)}
          className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${showLengths ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
          <Ruler className="w-3.5 h-3.5" />Ölçüler
        </button>

        <div className="flex items-center gap-0.5 bg-slate-800 rounded-xl p-1">
          {(["portrait", "landscape"] as const).map((o) => (
            <button key={o} onClick={() => setOrient(o)}
              className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all ${orient === o ? "bg-amber-500 text-white shadow" : "text-slate-400 hover:text-white"}`}>
              {o === "portrait" ? "Dikey" : "Yatay"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 bg-slate-800 rounded-xl p-1">
          <button onClick={() => { setPMode("auto"); setManPreview(null); }}
            className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${pMode === "auto" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"}`}>
            <LayoutGrid className="w-3 h-3" />Otomatik
          </button>
          <button onClick={() => setPMode("manual")}
            className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${pMode === "manual" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"}`}>
            <MousePointer className="w-3 h-3" />Manuel
          </button>
        </div>

        {hasSelection && (
          <div className="flex items-center gap-1 bg-blue-900/40 border border-blue-700/40 rounded-xl px-2 py-1">
            <span className="text-xs text-blue-300 font-semibold">{selectedIds.size} seçili</span>
            <button onClick={() => rotateSelected(-15)} className="h-6 w-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center"><RotateCcw className="w-3 h-3 text-slate-300" /></button>
            <button onClick={() => rotateSelected(15)} className="h-6 w-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center"><RotateCw className="w-3 h-3 text-slate-300" /></button>
            <button onClick={() => rotateSelected(-90)} className="h-6 px-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs text-slate-300">-90°</button>
            <button onClick={() => rotateSelected(90)} className="h-6 px-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs text-slate-300">+90°</button>
            <button onClick={deleteSelected} className="h-6 w-6 rounded-md bg-red-900/60 hover:bg-red-800 flex items-center justify-center"><Trash2 className="w-3 h-3 text-red-300" /></button>
            <button onClick={() => setSelectedIds(new Set())} className="h-6 w-6 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center"><X className="w-3 h-3 text-slate-300" /></button>
          </div>
        )}

        {activeCount > 0 && (
          <div className="flex items-center gap-2 bg-emerald-900/50 border border-emerald-700/40 rounded-xl px-3 py-1">
            <span className="text-xs font-bold text-emerald-400">{activeCount}</span>
            <span className="text-xs text-emerald-600">·</span>
            <span className="text-xs font-bold text-emerald-300">{((activeCount * 625) / 1000).toFixed(1)} kWp</span>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className="h-8 px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#f59e0b,#ea580c)" }}>
          <Save className="w-3.5 h-3.5" />{saving ? "…" : "Kaydet"} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub-bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/40 border-b border-slate-700/30 flex-shrink-0 overflow-x-auto min-h-[40px]">
        {roofs.map((r, i) => {
          const cnt = panels.filter((p) => p.roofId === r.id && !removedIds.has(p.id)).length;
          const tot = panels.filter((p) => p.roofId === r.id).length;
          return (
            <div key={r.id} className="flex items-center gap-2 bg-slate-700/40 border border-slate-600/30 rounded-xl px-3 py-1 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: ROOF_COLOR }} />
              <span className="text-xs text-slate-300 font-medium">Bölge {i + 1}</span>
              {tot > 0 && <span className="text-xs font-bold text-emerald-400">{cnt}/{tot}</span>}
              <button onClick={() => doFillRoof(r.id)}
                className="h-6 px-2.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
                <LayoutGrid className="w-2.5 h-2.5" />{tot > 0 ? "Yenile" : "Doldur"}
              </button>
              {tot > 0 && <button onClick={() => clearRoofPanels(r.id)} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>}
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 border-l border-slate-700/50 pl-3 ml-1 flex-shrink-0">
          <span className="text-xs text-slate-500">Gruplama:</span>
          <button onClick={() => setGroupEnabled((v) => !v)}
            className={`h-6 px-2.5 rounded-lg text-xs font-semibold transition-all ${groupEnabled ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"}`}>
            {groupEnabled ? "Açık" : "Kapalı"}
          </button>
          {groupEnabled && (
            <>
              <select value={panelsPerGroup} onChange={(e) => setPanelsPerGroup(Number(e.target.value))}
                className="h-6 px-1.5 bg-slate-700 text-xs text-slate-200 rounded-lg border-0 outline-none">
                {[2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}/grup</option>)}
              </select>
              <select value={groupGap} onChange={(e) => setGroupGap(Number(e.target.value))}
                className="h-6 px-1.5 bg-slate-700 text-xs text-slate-200 rounded-lg border-0 outline-none">
                {[0.3, 0.5, 0.8, 1.0, 1.5].map((v) => <option key={v} value={v}>{v}m</option>)}
              </select>
            </>
          )}
        </div>
        {pMode === "manual" && (
          <span className="text-xs text-amber-400 flex-shrink-0 ml-auto">Manuel: çatı üzerine fareyi getir → tıkla</span>
        )}
        <span className="text-xs text-indigo-400 flex-shrink-0 ml-auto">Sağ tuş → döndür · Scroll → zoom</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-slate-950">
        <canvas
          ref={canvasRef} width={CW} height={CH}
          className="absolute inset-0 w-full h-full"
          style={{ cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        />
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-slate-400 bg-slate-900/80 px-6 py-3 rounded-xl">Yükleniyor…</p>
          </div>
        )}
      </div>
    </div>
  );
}
