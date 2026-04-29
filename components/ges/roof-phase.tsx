"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Ruler, Trash2, X, CheckCircle2, MoveVertical, PenLine, MousePointer } from "lucide-react";
import { saveRoofs } from "@/app/actions/ges";

// ── Constants ────────────────────────────────────────────────────────────────
const CW = 1200, CH = 700;
const ISO_H = 55;
const ROOF_COLOR = "#c05828";
const SNAP_PX = 18;
const VERT_EPS = 0.000020;
const ELEV_SENS = 0.05;

// ── Types ────────────────────────────────────────────────────────────────────
type DrawMode = "polygon" | "edit" | "elevation";

interface Roof {
  id: string;
  vertices: [number, number][];
  elevations: number[];
  color: string;
}

interface SceneCtx { cx0: number; cy0: number; baseScale: number; }

type ElevDrag =
  | { kind: "vertex"; roofId: string; vi: number; startElev: number; startY: number; vLat: number; vLng: number }
  | { kind: "edge";   roofId: string; vi: number; startElevA: number; startElevB: number; startY: number; vALat: number; vALng: number; vBLat: number; vBLng: number }
  | null;

type EditHover =
  | { kind: "vertex"; roofId: string; vi: number }
  | { kind: "edgeMid"; roofId: string; ei: number }
  | null;

type EditDrag = { srcLat: number; srcLng: number } | null;

// ── Math helpers ──────────────────────────────────────────────────────────────
function sameVertex(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) < VERT_EPS && Math.abs(a[1] - b[1]) < VERT_EPS;
}
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
function px2ll(px: number, py: number, cLat: number, cLng: number, zoom: number): [number, number] {
  const m = mPxAt(cLat, zoom);
  return [cLat + ((CH / 2 - py) * m) / 110540, cLng + ((px - CW / 2) * m) / (111320 * Math.cos((cLat * Math.PI) / 180))];
}
function ll2px(la: number, ln: number, cLat: number, cLng: number, zoom: number): [number, number] {
  const m = mPxAt(cLat, zoom);
  const cosL = Math.cos((cLat * Math.PI) / 180);
  return [CW / 2 + ((ln - cLng) * 111320 * cosL) / m, CH / 2 - ((la - cLat) * 110540) / m];
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
function toWorld(ix: number, iy: number, sc: SceneCtx): [number, number] {
  return [(ix - sc.cx0) * sc.baseScale, (iy - sc.cy0) * sc.baseScale];
}
function project(wx: number, wy: number, wz: number, az: number, el: number, vScale: number, vPan: { x: number; y: number }): [number, number] {
  const [sx, sy] = projOrbital(wx, wy, wz, az, el);
  return [CW / 2 + sx * vScale + vPan.x, CH / 2 + sy * vScale + vPan.y];
}
function unprojectGround(sx: number, sy: number, az: number, el: number, vScale: number, vPan: { x: number; y: number }): [number, number] {
  const rx = (sx - CW / 2 - vPan.x) / vScale;
  const ry = (sy - CH / 2 - vPan.y) / vScale;
  const q = ry / Math.sin(el);
  return [rx * Math.cos(az) - q * Math.sin(az), rx * Math.sin(az) + q * Math.cos(az)];
}
function screen2imgPx(sx: number, sy: number, az: number, el: number, vScale: number, vPan: { x: number; y: number }, sc: SceneCtx): [number, number] {
  const [wx, wy] = unprojectGround(sx, sy, az, el, vScale, vPan);
  return [wx / sc.baseScale + sc.cx0, wy / sc.baseScale + sc.cy0];
}
function ptToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function ptToSegClosest(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return [ax, ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return [ax + t * dx, ay + t * dy];
}
function vertexWorldZ(elev: number, sc: SceneCtx, mPerPx: number): number {
  return ISO_H + (elev / mPerPx) * sc.baseScale;
}

// ── Compass ───────────────────────────────────────────────────────────────────
const COMPASS_CX = CW - 72, COMPASS_CY = 72, COMPASS_R = 38;
function drawCompass(ctx: CanvasRenderingContext2D, az: number) {
  const cx = COMPASS_CX, cy = COMPASS_CY, r = COMPASS_R;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(8,15,28,0.82)"; ctx.fill();
  ctx.strokeStyle = "rgba(99,102,241,0.3)"; ctx.lineWidth = 1; ctx.stroke();
  const azN = ((az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const d of [{ l: "N", dx: 0, dy: -1 }, { l: "S", dx: 0, dy: 1 }, { l: "E", dx: 1, dy: 0 }, { l: "W", dx: -1, dy: 0 }]) {
    const bx = cx + d.dx * r, by = cy + d.dy * r;
    ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(40,50,68,0.9)"; ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.fillText(d.l, bx, by);
  }
  const nAngle = -azN - Math.PI / 2;
  const nx = cx + Math.cos(nAngle) * (r - 8), ny = cy + Math.sin(nAngle) * (r - 8);
  ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444"; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 6px sans-serif"; ctx.fillText("N", nx, ny);
  ctx.restore();
  void azN;
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  roofs: Roof[],
  inProgress: [number, number][],
  mouseScreen: [number, number] | null,
  drawMode: DrawMode,
  az: number, el: number,
  vScale: number, vPan: { x: number; y: number },
  cLat: number, cLng: number, zoom: number,
  showLengths: boolean,
  elevHover: { roofId: string; vi: number; kind: "vertex" | "edge" } | null,
  snapScreen: [number, number] | null,
  editHover: EditHover,
) {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = "#0d1827"; ctx.fillRect(0, 0, CW, CH);

  const sc = buildSceneCtx(roofs, cLat, cLng, zoom);
  const mPerPx = mPxAt(cLat, zoom);

  function proj(ix: number, iy: number, wz: number): [number, number] {
    const [wx, wy] = toWorld(ix, iy, sc);
    return project(wx, wy, wz, az, el, vScale, vPan);
  }

  // Satellite background
  if (img) {
    const A = proj(0, 0, 0), B = proj(CW, 0, 0), C = proj(0, CH, 0);
    const a = (B[0] - A[0]) / CW, b = (B[1] - A[1]) / CW;
    const c = (C[0] - A[0]) / CH, d = (C[1] - A[1]) / CH;
    ctx.save(); ctx.setTransform(a, b, c, d, A[0], A[1]); ctx.drawImage(img, 0, 0, CW, CH); ctx.restore();
  }

  // Shared edges
  const shared = new Set<string>();
  for (let ri = 0; ri < roofs.length; ri++) {
    for (let rj = ri + 1; rj < roofs.length; rj++) {
      const a = roofs[ri], b = roofs[rj];
      for (let ai = 0; ai < a.vertices.length; ai++) {
        const v0a = a.vertices[ai], v1a = a.vertices[(ai + 1) % a.vertices.length];
        for (let bi = 0; bi < b.vertices.length; bi++) {
          const v0b = b.vertices[bi], v1b = b.vertices[(bi + 1) % b.vertices.length];
          if ((sameVertex(v0a, v0b) && sameVertex(v1a, v1b)) || (sameVertex(v0a, v1b) && sameVertex(v1a, v0b))) {
            shared.add(`${ri}-${ai}`); shared.add(`${rj}-${bi}`);
          }
        }
      }
    }
  }

  // Draw each roof
  for (let ri = 0; ri < roofs.length; ri++) {
    const roof = roofs[ri];
    if (roof.vertices.length < 3) continue;
    const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, cLat, cLng, zoom));
    const n = pxArr.length;

    if (drawMode === "polygon" || drawMode === "edit") {
      const screenFlat = pxArr.map(([ix, iy]) => proj(ix, iy, 0));
      ctx.beginPath(); ctx.moveTo(screenFlat[0][0], screenFlat[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(screenFlat[i][0], screenFlat[i][1]);
      ctx.closePath();
      ctx.fillStyle = "rgba(192,88,40,0.40)"; ctx.fill();
      // outer edges
      for (let i = 0; i < n; i++) {
        if (shared.has(`${ri}-${i}`)) continue;
        const j = (i + 1) % n;
        ctx.beginPath(); ctx.moveTo(screenFlat[i][0], screenFlat[i][1]); ctx.lineTo(screenFlat[j][0], screenFlat[j][1]);
        ctx.strokeStyle = "#f97316"; ctx.lineWidth = 1.5; ctx.stroke();
      }
      if (showLengths) {
        ctx.save(); ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 4;
        for (let i = 0; i < n; i++) {
          if (shared.has(`${ri}-${i}`)) continue;
          const j = (i + 1) % n;
          const [la1, ln1] = roof.vertices[i], [la2, ln2] = roof.vertices[j];
          const len = Math.hypot((ln2 - ln1) * 111320 * Math.cos((la1 * Math.PI) / 180), (la2 - la1) * 110540);
          const midX = (screenFlat[i][0] + screenFlat[j][0]) / 2, midY = (screenFlat[i][1] + screenFlat[j][1]) / 2;
          ctx.fillStyle = "#ffffff"; ctx.fillText(len < 1 ? `${(len * 100).toFixed(0)}cm` : `${len.toFixed(1)}m`, midX, midY);
        }
        ctx.restore();
      }
    } else {
      // Elevation mode: 3D view — fully opaque solid walls
      const topZ = pxArr.map((_, i) => vertexWorldZ(roof.elevations[i] ?? 0, sc, mPerPx));
      const screenTop = pxArr.map(([ix, iy], i) => proj(ix, iy, topZ[i]));
      const screenBot = pxArr.map(([ix, iy]) => proj(ix, iy, 0));
      // Walls — fully opaque, back-face culled (only draw walls facing the viewer)
      for (let i = 0; i < n; i++) {
        if (shared.has(`${ri}-${i}`)) continue;
        const j = (i + 1) % n;
        // Screen-space cross product: skip wall if face normal points away from viewer
        const dx1 = screenBot[j][0] - screenBot[i][0], dy1 = screenBot[j][1] - screenBot[i][1];
        const dx2 = screenTop[j][0] - screenBot[i][0], dy2 = screenTop[j][1] - screenBot[i][1];
        if (dx1 * dy2 - dy1 * dx2 >= 0) continue;
        ctx.beginPath();
        ctx.moveTo(screenBot[i][0], screenBot[i][1]); ctx.lineTo(screenBot[j][0], screenBot[j][1]);
        ctx.lineTo(screenTop[j][0], screenTop[j][1]); ctx.lineTo(screenTop[i][0], screenTop[i][1]);
        ctx.closePath();
        ctx.fillStyle = "#0d0d14"; ctx.fill();
        ctx.strokeStyle = "#1e2028"; ctx.lineWidth = 0.8; ctx.stroke();
      }
      // Roof face
      ctx.beginPath(); ctx.moveTo(screenTop[0][0], screenTop[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(screenTop[i][0], screenTop[i][1]);
      ctx.closePath(); ctx.fillStyle = ROOF_COLOR; ctx.fill(); ctx.strokeStyle = "#8a3520"; ctx.lineWidth = 1; ctx.stroke();
      // Labels
      if (showLengths) {
        ctx.save(); ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 4;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const [la1, ln1] = roof.vertices[i], [la2, ln2] = roof.vertices[j];
          const dh = ((topZ[j] - topZ[i]) / sc.baseScale) * mPerPx;
          const len = Math.hypot((ln2 - ln1) * 111320 * Math.cos((la1 * Math.PI) / 180), (la2 - la1) * 110540, dh);
          const midX = (screenTop[i][0] + screenTop[j][0]) / 2, midY = (screenTop[i][1] + screenTop[j][1]) / 2;
          ctx.fillStyle = "#ffffff"; ctx.fillText(len < 1 ? `${(len * 100).toFixed(0)}cm` : `${len.toFixed(1)}m`, midX, midY);
        }
        ctx.restore();
      }
      // Vertex handles
      for (let i = 0; i < n; i++) {
        const [sx, sy] = screenTop[i];
        const isHov = elevHover?.roofId === roof.id && elevHover.vi === i && elevHover.kind === "vertex";
        ctx.beginPath(); ctx.arc(sx, sy, isHov ? 9 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? "#fbbf24" : "#e2e8f0"; ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
        const elev = roof.elevations[i] ?? 0;
        if (Math.abs(elev) > 0.05) {
          ctx.save(); ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
          ctx.fillStyle = "#fbbf24"; ctx.fillText(`${elev.toFixed(1)}m`, sx, sy - 4); ctx.restore();
        }
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const mx = (screenTop[i][0] + screenTop[j][0]) / 2, my = (screenTop[i][1] + screenTop[j][1]) / 2;
        const isEdgeHov = elevHover?.kind === "edge" && elevHover.roofId === roof.id && elevHover.vi === i;
        ctx.beginPath(); ctx.arc(mx, my, isEdgeHov ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isEdgeHov ? "#f97316" : "rgba(148,163,184,0.6)"; ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1; ctx.fill(); ctx.stroke();
      }
    }
  }

  // Thick shared (internal) edges — ridge / hip lines
  if (shared.size > 0) {
    ctx.save();
    for (let ri = 0; ri < roofs.length; ri++) {
      const roof = roofs[ri];
      if (roof.vertices.length < 3) continue;
      const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, cLat, cLng, zoom));
      const topZ = drawMode === "elevation"
        ? pxArr.map((_, i) => vertexWorldZ(roof.elevations[i] ?? 0, sc, mPerPx))
        : pxArr.map(() => 0);
      for (let i = 0; i < pxArr.length; i++) {
        if (!shared.has(`${ri}-${i}`)) continue;
        const j = (i + 1) % pxArr.length;
        const A = proj(pxArr[i][0], pxArr[i][1], topZ[i]);
        const B = proj(pxArr[j][0], pxArr[j][1], topZ[j]);
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
        ctx.strokeStyle = "rgba(255,255,255,0.90)"; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = "rgba(251,191,36,0.55)"; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Polygon mode: vertex dots (deduplicated) — clicking these snaps to them
  if ((drawMode === "polygon") && roofs.length > 0) {
    const shown: [number, number][] = [];
    for (const roof of roofs) {
      for (const [la, ln] of roof.vertices) {
        const [ix, iy] = ll2px(la, ln, cLat, cLng, zoom);
        const [sx, sy] = proj(ix, iy, 0);
        if (shown.some(([ex, ey]) => Math.hypot(sx - ex, sy - ey) < 8)) continue;
        shown.push([sx, sy]);
        ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#f97316"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
      }
    }
  }

  // Edit mode: vertex handles + edge midpoint handles
  if (drawMode === "edit" && roofs.length > 0) {
    // Edge midpoints first (under vertices)
    for (const roof of roofs) {
      const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, cLat, cLng, zoom));
      const n = pxArr.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const mx = (pxArr[i][0] + pxArr[j][0]) / 2, my = (pxArr[i][1] + pxArr[j][1]) / 2;
        const [msx, msy] = proj(mx, my, 0);
        const isHov = editHover?.kind === "edgeMid" && editHover.roofId === roof.id && editHover.ei === i;
        ctx.beginPath(); ctx.arc(msx, msy, isHov ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? "#fbbf24" : "rgba(100,116,139,0.85)";
        ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1; ctx.fill(); ctx.stroke();
      }
    }
    // Vertex handles (dedup by proximity)
    const shown: [number, number][] = [];
    for (const roof of roofs) {
      for (let vi = 0; vi < roof.vertices.length; vi++) {
        const [la, ln] = roof.vertices[vi];
        const [ix, iy] = ll2px(la, ln, cLat, cLng, zoom);
        const [sx, sy] = proj(ix, iy, 0);
        if (shown.some(([ex, ey]) => Math.hypot(sx - ex, sy - ey) < 6)) continue;
        shown.push([sx, sy]);
        const isHov = editHover?.kind === "vertex" && editHover.roofId === roof.id && editHover.vi === vi;
        ctx.beginPath(); ctx.arc(sx, sy, isHov ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? "#fbbf24" : "#f97316";
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
      }
    }
  }

  // In-progress polygon
  if (inProgress.length > 0) {
    const pts = inProgress.map(([ix, iy]) => proj(ix, iy, 0));
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    if (mouseScreen) ctx.lineTo(mouseScreen[0], mouseScreen[1]);
    ctx.strokeStyle = ROOF_COLOR; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < pts.length; i++) {
      ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], i === 0 ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? "#f59e0b" : ROOF_COLOR;
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
    }
    if (mouseScreen && inProgress.length >= 2) {
      for (let i = 0; i < pts.length; i++) {
        const d = Math.hypot(mouseScreen[0] - pts[i][0], mouseScreen[1] - pts[i][1]);
        if (d < SNAP_PX * 1.5 && (i === 0 ? inProgress.length >= 3 : inProgress.length - i >= 2)) {
          ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], SNAP_PX * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
  }

  if (snapScreen && drawMode === "polygon") {
    ctx.beginPath(); ctx.arc(snapScreen[0], snapScreen[1], SNAP_PX, 0, Math.PI * 2);
    ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
  }

  drawCompass(ctx, az);
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  projectId: string; lat: number; lng: number; zoom: number;
  initialRoofs: { id: string; vertices: [number, number][]; color: string; height: number; elevations?: number[] }[];
}

export default function RoofPhase({ projectId, lat, lng, zoom: rawZoom, initialRoofs }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fixedZoom = Math.max(rawZoom, 14);

  const [vScale, setVScale] = useState(1.0);
  const [vPan, setVPan] = useState({ x: 0, y: 0 });
  const [az, setAz] = useState(0);
  const [el, setEl] = useState(Math.PI * 35 / 180);
  const [drawMode, setDrawMode] = useState<DrawMode>("polygon");
  const [roofs, setRoofs] = useState<Roof[]>(() =>
    initialRoofs.map((r) => ({ id: r.id, vertices: r.vertices, color: ROOF_COLOR, elevations: r.elevations ?? Array(r.vertices.length).fill(0) }))
  );
  const [inProgress, setInProgress] = useState<[number, number][]>([]);
  const [mouseScreen, setMouseScreen] = useState<[number, number] | null>(null);
  const [showLengths, setShowLengths] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elevHover, setElevHover] = useState<{ roofId: string; vi: number; kind: "vertex" | "edge" } | null>(null);
  const [snapScreen, setSnapScreen] = useState<[number, number] | null>(null);
  const [editHover, setEditHover] = useState<EditHover>(null);

  const vScaleRef = useRef(1.0);
  const vPanRef = useRef({ x: 0, y: 0 });
  const azRef = useRef(0);
  const elRef = useRef(Math.PI * 35 / 180);
  useEffect(() => { vScaleRef.current = vScale; }, [vScale]);
  useEffect(() => { vPanRef.current = vPan; }, [vPan]);
  useEffect(() => { azRef.current = az; }, [az]);
  useEffect(() => { elRef.current = el; }, [el]);

  const dragType = useRef<"none" | "orbit" | "pan" | "elevVertex" | "elevEdge" | "editVertex" | "editEdgeMid">("none");
  const dragStart = useRef<[number, number]>([0, 0]);
  const dragAzEl = useRef({ az: 0, el: 0 });
  const dragPan = useRef({ x: 0, y: 0 });
  const elevDragRef = useRef<ElevDrag>(null);
  const editDragRef = useRef<EditDrag>(null);
  // For edge-mid insertion: store roofId + edge index until first move
  const edgeMidInsertRef = useRef<{ roofId: string; ei: number } | null>(null);

  const dataRef = useRef({ roofs, inProgress, mouseScreen, vScale, vPan, az, el, drawMode, showLengths, elevHover, snapScreen, editHover });
  dataRef.current = { roofs, inProgress, mouseScreen, vScale, vPan, az, el, drawMode, showLengths, elevHover, snapScreen, editHover };

  // Load satellite — no crossOrigin so it always loads
  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.onerror = () => { imgRef.current = null; setImgLoaded(true); };
    img.src = buildEsriUrl(lat, lng, fixedZoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = dataRef.current;
    renderScene(ctx, imgRef.current, d.roofs, d.inProgress, d.mouseScreen,
      d.drawMode, d.az, d.el, d.vScale, d.vPan, lat, lng, fixedZoom,
      d.showLengths, d.elevHover, d.snapScreen, d.editHover);
  }, [lat, lng, fixedZoom]);

  useEffect(() => { redraw(); }, [redraw, roofs, inProgress, mouseScreen, vScale, vPan, az, el, drawMode, showLengths, elevHover, snapScreen, editHover, imgLoaded]);

  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const delta = e.deltaY < 0 ? 1.14 : 0.88;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (CW / rect.width);
    const cy = (e.clientY - rect.top) * (CH / rect.height);
    setVScale((prev) => {
      const ns = Math.max(0.3, Math.min(12, prev * delta));
      setVPan((pp) => ({ x: cx - CW / 2 - (cx - CW / 2 - pp.x) * (ns / prev), y: cy - CH / 2 - (cy - CH / 2 - pp.y) * (ns / prev) }));
      return ns;
    });
  };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const h = (e: WheelEvent) => wheelRef.current(e);
    canvas.addEventListener("wheel", h, { passive: false });
    return () => canvas.removeEventListener("wheel", h);
  }, []);

  useEffect(() => {
    function onUp(e: MouseEvent) {
      if (e.button === 2) { dragType.current = "none"; return; }
      dragType.current = "none";
      elevDragRef.current = null;
      editDragRef.current = null;
      edgeMidInsertRef.current = null;
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  // ── Scene helpers ──────────────────────────────────────────────────────────
  function getSceneCtx() { return buildSceneCtx(dataRef.current.roofs, lat, lng, fixedZoom); }

  function canvasXY(e: React.MouseEvent<HTMLCanvasElement>): [number, number] {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * (CW / r.width), (e.clientY - r.top) * (CH / r.height)];
  }

  function llToScreen(la: number, ln: number): [number, number] {
    const sc = getSceneCtx();
    const [ix, iy] = ll2px(la, ln, lat, lng, fixedZoom);
    const [wx, wy] = toWorld(ix, iy, sc);
    return project(wx, wy, 0, azRef.current, elRef.current, vScaleRef.current, vPanRef.current);
  }

  function imgPxToScreen(ix: number, iy: number): [number, number] {
    const sc = getSceneCtx();
    const [wx, wy] = toWorld(ix, iy, sc);
    return project(wx, wy, 0, azRef.current, elRef.current, vScaleRef.current, vPanRef.current);
  }

  function snapToExistingGeometry(imgX: number, imgY: number): { snapped: [number, number]; screen: [number, number] | null } {
    const sc = getSceneCtx();
    const curAz = azRef.current, curEl = elRef.current, curVS = vScaleRef.current, curVP = vPanRef.current;
    const cPt = (() => { const [wx, wy] = toWorld(imgX, imgY, sc); return project(wx, wy, 0, curAz, curEl, curVS, curVP); })();
    let bestDist = SNAP_PX, bestImgPx: [number, number] = [imgX, imgY], bestScreen: [number, number] | null = null;
    for (const roof of dataRef.current.roofs) {
      const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, lat, lng, fixedZoom));
      for (const [ix, iy] of pxArr) {
        const [wx, wy] = toWorld(ix, iy, sc);
        const [vsx, vsy] = project(wx, wy, 0, curAz, curEl, curVS, curVP);
        const d = Math.hypot(cPt[0] - vsx, cPt[1] - vsy);
        if (d < bestDist) { bestDist = d; bestImgPx = [ix, iy]; bestScreen = [vsx, vsy]; }
      }
      for (let i = 0; i < pxArr.length; i++) {
        const j = (i + 1) % pxArr.length;
        const [asx, asy] = (() => { const [wx, wy] = toWorld(pxArr[i][0], pxArr[i][1], sc); return project(wx, wy, 0, curAz, curEl, curVS, curVP); })();
        const [bsx, bsy] = (() => { const [wx, wy] = toWorld(pxArr[j][0], pxArr[j][1], sc); return project(wx, wy, 0, curAz, curEl, curVS, curVP); })();
        const d = ptToSegDist(cPt[0], cPt[1], asx, asy, bsx, bsy);
        if (d < bestDist) {
          bestDist = d;
          const [cpx, cpy] = ptToSegClosest(cPt[0], cPt[1], asx, asy, bsx, bsy);
          bestScreen = [cpx, cpy];
          const [wx2, wy2] = unprojectGround(cpx, cpy, curAz, curEl, curVS, curVP);
          bestImgPx = [wx2 / sc.baseScale + sc.cx0, wy2 / sc.baseScale + sc.cy0];
        }
      }
    }
    return { snapped: bestImgPx, screen: bestScreen };
  }

  function findElevHandle(sx: number, sy: number) {
    const d = dataRef.current, sc = getSceneCtx(), mPerPx2 = mPxAt(lat, fixedZoom);
    const curAz = azRef.current, curEl = elRef.current, curVS = vScaleRef.current, curVP = vPanRef.current;
    let best = 14;
    let result: { roofId: string; vi: number; kind: "vertex" | "edge" } | null = null;
    for (const roof of d.roofs) {
      const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, lat, lng, fixedZoom));
      const n = pxArr.length;
      const topZ = pxArr.map((_, i) => vertexWorldZ(roof.elevations[i] ?? 0, sc, mPerPx2));
      const screenTop = pxArr.map(([ix, iy], i) => { const [wx, wy] = toWorld(ix, iy, sc); return project(wx, wy, topZ[i], curAz, curEl, curVS, curVP); });
      for (let i = 0; i < n; i++) {
        const d2 = Math.hypot(sx - screenTop[i][0], sy - screenTop[i][1]);
        if (d2 < best) { best = d2; result = { roofId: roof.id, vi: i, kind: "vertex" }; }
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const mx = (screenTop[i][0] + screenTop[j][0]) / 2, my = (screenTop[i][1] + screenTop[j][1]) / 2;
        const d2 = Math.hypot(sx - mx, sy - my);
        if (d2 < best) { best = d2; result = { roofId: roof.id, vi: i, kind: "edge" }; }
      }
    }
    return result;
  }

  function findEditHandle(sx: number, sy: number): EditHover {
    const sc = getSceneCtx();
    const curAz = azRef.current, curEl = elRef.current, curVS = vScaleRef.current, curVP = vPanRef.current;
    let best = SNAP_PX;
    let result: EditHover = null;
    for (const roof of dataRef.current.roofs) {
      const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, lat, lng, fixedZoom));
      const n = pxArr.length;
      // Vertices first (higher priority)
      for (let vi = 0; vi < n; vi++) {
        const [wx, wy] = toWorld(pxArr[vi][0], pxArr[vi][1], sc);
        const [vsx, vsy] = project(wx, wy, 0, curAz, curEl, curVS, curVP);
        const d = Math.hypot(sx - vsx, sy - vsy);
        if (d < best) { best = d; result = { kind: "vertex", roofId: roof.id, vi }; }
      }
    }
    if (result) return result; // vertex takes priority over edge mid
    // Edge midpoints
    best = SNAP_PX;
    for (const roof of dataRef.current.roofs) {
      const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, lat, lng, fixedZoom));
      const n = pxArr.length;
      for (let ei = 0; ei < n; ei++) {
        const j = (ei + 1) % n;
        const mx = (pxArr[ei][0] + pxArr[j][0]) / 2, my = (pxArr[ei][1] + pxArr[j][1]) / 2;
        const [wx, wy] = toWorld(mx, my, sc);
        const [msx, msy] = project(wx, wy, 0, curAz, curEl, curVS, curVP);
        const d = Math.hypot(sx - msx, sy - msy);
        if (d < best) { best = d; result = { kind: "edgeMid", roofId: roof.id, ei }; }
      }
    }
    return result;
  }

  function snapFinalVerts(llVerts: [number, number][]): [number, number][] {
    return llVerts.map(v => {
      let best: [number, number] = v, bestD = VERT_EPS;
      for (const roof of dataRef.current.roofs)
        for (const rv of roof.vertices) {
          const d = Math.hypot(v[0] - rv[0], v[1] - rv[1]);
          if (d < bestD) { bestD = d; best = rv; }
        }
      return best;
    });
  }

  function closePolygon(verts: [number, number][]) {
    if (verts.length < 3) return;
    const id = `roof-${Date.now()}`;
    const llVerts = snapFinalVerts(verts.map(([ix, iy]) => px2ll(ix, iy, lat, lng, fixedZoom)));
    setRoofs((prev) => [...prev, { id, vertices: llVerts, elevations: Array(llVerts.length).fill(0), color: ROOF_COLOR }]);
    setInProgress([]);
  }

  // ── Event handlers ─────────────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const [sx, sy] = canvasXY(e);
    if (e.button === 1) { e.preventDefault(); dragType.current = "pan"; dragStart.current = [e.clientX, e.clientY]; dragPan.current = { ...vPanRef.current }; return; }
    if (e.button === 2) { dragType.current = "orbit"; dragStart.current = [e.clientX, e.clientY]; dragAzEl.current = { az: azRef.current, el: elRef.current }; return; }

    const d = dataRef.current;

    if (d.drawMode === "elevation") {
      const hit = findElevHandle(sx, sy);
      if (!hit) return;
      const roof = d.roofs.find((r) => r.id === hit.roofId)!;
      if (hit.kind === "vertex") {
        dragType.current = "elevVertex";
        elevDragRef.current = { kind: "vertex", roofId: hit.roofId, vi: hit.vi, startElev: roof.elevations[hit.vi] ?? 0, startY: e.clientY, vLat: roof.vertices[hit.vi][0], vLng: roof.vertices[hit.vi][1] };
      } else {
        const j = (hit.vi + 1) % roof.vertices.length;
        dragType.current = "elevEdge";
        elevDragRef.current = { kind: "edge", roofId: hit.roofId, vi: hit.vi, startElevA: roof.elevations[hit.vi] ?? 0, startElevB: roof.elevations[j] ?? 0, startY: e.clientY, vALat: roof.vertices[hit.vi][0], vALng: roof.vertices[hit.vi][1], vBLat: roof.vertices[j][0], vBLng: roof.vertices[j][1] };
      }
      return;
    }

    if (d.drawMode === "edit") {
      const hit = findEditHandle(sx, sy);
      if (!hit) return;
      if (hit.kind === "vertex") {
        const roof = d.roofs.find(r => r.id === hit.roofId)!;
        dragType.current = "editVertex";
        editDragRef.current = { srcLat: roof.vertices[hit.vi][0], srcLng: roof.vertices[hit.vi][1] };
      } else {
        // Edge midpoint — will insert vertex on first mousemove
        dragType.current = "editEdgeMid";
        edgeMidInsertRef.current = { roofId: hit.roofId, ei: hit.ei };
        editDragRef.current = null;
      }
      return;
    }

    // Polygon draw mode — NO dragging, only snap + place + auto-close
    const sc = getSceneCtx();
    const imgPt = screen2imgPx(sx, sy, d.az, d.el, vScaleRef.current, vPanRef.current, sc);
    const { snapped } = snapToExistingGeometry(imgPt[0], imgPt[1]);
    const cur = d.inProgress;

    // Auto-close on any inProgress vertex
    if (cur.length >= 2) {
      for (let vi = 0; vi < cur.length; vi++) {
        const [ptsx, ptsy] = imgPxToScreen(cur[vi][0], cur[vi][1]);
        if (Math.hypot(sx - ptsx, sy - ptsy) < SNAP_PX * 1.5) {
          if (vi === 0 && cur.length >= 3) { closePolygon(cur); return; }
          if (vi > 0 && vi >= 2) { closePolygon(cur.slice(0, vi)); return; }
        }
      }
    }
    // Auto-close on existing roof vertex
    if (cur.length >= 2) {
      for (const roof of d.roofs) {
        for (const [la, ln] of roof.vertices) {
          const [vsx, vsy] = llToScreen(la, ln);
          if (Math.hypot(sx - vsx, sy - vsy) < SNAP_PX * 1.5) {
            closePolygon([...cur, ll2px(la, ln, lat, lng, fixedZoom)]);
            return;
          }
        }
      }
    }
    setInProgress((prev) => [...prev, snapped]);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (CW / rect.width);
    const sy = (e.clientY - rect.top) * (CH / rect.height);
    setMouseScreen([sx, sy]);

    const dt = dragType.current;

    if (dt === "pan") {
      const dx = (e.clientX - dragStart.current[0]) * (CW / rect.width);
      const dy = (e.clientY - dragStart.current[1]) * (CH / rect.height);
      const np = { x: dragPan.current.x + dx, y: dragPan.current.y + dy };
      vPanRef.current = np; setVPan(np); return;
    }
    if (dt === "orbit") {
      const newAz = dragAzEl.current.az + (e.clientX - dragStart.current[0]) * 0.007;
      const newEl = Math.max(0.1, Math.min(Math.PI / 2, dragAzEl.current.el - (e.clientY - dragStart.current[1]) * 0.007));
      azRef.current = newAz; elRef.current = newEl; setAz(newAz); setEl(newEl); return;
    }

    if (dt === "editEdgeMid") {
      const ins = edgeMidInsertRef.current;
      if (!ins) return;
      // Insert vertex at the midpoint of the edge, then switch to editVertex drag
      setRoofs(prev => prev.map(r => {
        if (r.id !== ins.roofId) return r;
        const j = (ins.ei + 1) % r.vertices.length;
        const midLat = (r.vertices[ins.ei][0] + r.vertices[j][0]) / 2;
        const midLng = (r.vertices[ins.ei][1] + r.vertices[j][1]) / 2;
        const newVerts = [...r.vertices];
        newVerts.splice(ins.ei + 1, 0, [midLat, midLng]);
        const newElevs = [...r.elevations];
        newElevs.splice(ins.ei + 1, 0, (r.elevations[ins.ei] ?? 0 + (r.elevations[j] ?? 0)) / 2);
        editDragRef.current = { srcLat: midLat, srcLng: midLng };
        return { ...r, vertices: newVerts as [number, number][], elevations: newElevs };
      }));
      edgeMidInsertRef.current = null;
      dragType.current = "editVertex";
      return;
    }

    if (dt === "editVertex") {
      const drag = editDragRef.current;
      if (!drag) return;
      const sc = getSceneCtx();
      const imgPt = screen2imgPx(sx, sy, dataRef.current.az, dataRef.current.el, vScaleRef.current, vPanRef.current, sc);
      const newLL = px2ll(imgPt[0], imgPt[1], lat, lng, fixedZoom);
      setRoofs(prev => prev.map(r => ({
        ...r,
        vertices: r.vertices.map(v => sameVertex(v, [drag.srcLat, drag.srcLng]) ? newLL : v) as [number, number][],
      })));
      editDragRef.current = { srcLat: newLL[0], srcLng: newLL[1] };
      return;
    }

    if (dt === "elevVertex" || dt === "elevEdge") {
      const drag = elevDragRef.current;
      if (!drag) return;
      const delta = (drag.startY - e.clientY) * ELEV_SENS;
      if (drag.kind === "vertex") {
        const newElev = Math.max(0, drag.startElev + delta);
        setRoofs(prev => prev.map(r => {
          const elev = [...r.elevations]; let changed = false;
          r.vertices.forEach(([la, ln], vi) => { if (sameVertex([la, ln], [drag.vLat, drag.vLng])) { elev[vi] = newElev; changed = true; } });
          return changed ? { ...r, elevations: elev } : r;
        }));
      } else {
        const j = (() => { const roof = dataRef.current.roofs.find(r => r.id === drag.roofId); return roof ? (drag.vi + 1) % roof.vertices.length : drag.vi + 1; })();
        const newElevA = Math.max(0, drag.startElevA + delta), newElevB = Math.max(0, drag.startElevB + delta);
        setRoofs(prev => prev.map(r => {
          const elev = [...r.elevations]; let changed = false;
          r.vertices.forEach(([la, ln], vi) => {
            if (sameVertex([la, ln], [drag.vALat, drag.vALng])) { elev[vi] = newElevA; changed = true; }
            if (sameVertex([la, ln], [drag.vBLat, drag.vBLng])) { elev[vi] = newElevB; changed = true; }
          });
          return changed ? { ...r, elevations: elev } : r;
        }));
      }
      return;
    }

    const d = dataRef.current;
    if (d.drawMode === "elevation") {
      setElevHover(findElevHandle(sx, sy)); setEditHover(null); setSnapScreen(null);
    } else if (d.drawMode === "edit") {
      setEditHover(findEditHandle(sx, sy)); setElevHover(null); setSnapScreen(null);
    } else {
      setElevHover(null); setEditHover(null);
      if (d.roofs.length > 0) {
        const sc = getSceneCtx();
        const imgPt = screen2imgPx(sx, sy, d.az, d.el, vScaleRef.current, vPanRef.current, sc);
        const { screen } = snapToExistingGeometry(imgPt[0], imgPt[1]);
        setSnapScreen(screen);
      } else { setSnapScreen(null); }
    }
  }

  function handleMouseLeave() { setMouseScreen(null); setElevHover(null); setSnapScreen(null); setEditHover(null); }
  function handleContextMenu(e: React.MouseEvent) { e.preventDefault(); }
  function deleteRoof(id: string) { setRoofs(prev => prev.filter(r => r.id !== id)); }

  async function handleSave() {
    setSaving(true);
    try {
      await saveRoofs(projectId, roofs.map(r => ({ id: r.id, color: r.color, height: 4, vertices: r.vertices, elevations: r.elevations })));
      router.push(`/projects/${projectId}/drawing/panels`);
    } finally { setSaving(false); }
  }

  const cursor = drawMode === "elevation"
    ? elevHover ? "ns-resize" : "default"
    : drawMode === "edit"
    ? editHover ? (dragType.current === "editVertex" || dragType.current === "editEdgeMid" ? "grabbing" : "move") : "default"
    : dragType.current === "orbit" ? "grabbing" : "crosshair";

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white select-none">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-700/60 flex-shrink-0 flex-wrap">
        <button onClick={() => router.push(`/projects/${projectId}/detail`)}
          className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300">← Geri</button>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">1 / Çatı Çizimi</span>
        <div className="flex-1" />
        <button onClick={() => setShowLengths(v => !v)}
          className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${showLengths ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
          <Ruler className="w-3.5 h-3.5" />Uzunluklar
        </button>
        {/* Mode buttons */}
        <button onClick={() => { setDrawMode("polygon"); setInProgress([]); }}
          className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${drawMode === "polygon" ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
          <PenLine className="w-3.5 h-3.5" />Çiz
        </button>
        <button onClick={() => { setDrawMode("edit"); setInProgress([]); }}
          className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${drawMode === "edit" ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
          <MousePointer className="w-3.5 h-3.5" />Düzenle
        </button>
        <button onClick={() => { setDrawMode("elevation"); setInProgress([]); }}
          className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${drawMode === "elevation" ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
          <MoveVertical className="w-3.5 h-3.5" />Eğim Ver
        </button>
        {inProgress.length >= 3 && drawMode === "polygon" && (
          <button onClick={() => closePolygon(inProgress)}
            className="h-8 px-3 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
            <CheckCircle2 className="w-3.5 h-3.5" />Kapat
          </button>
        )}
        {inProgress.length > 0 && (
          <button onClick={() => setInProgress([])}
            className="h-8 w-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center">
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
        {roofs.length > 0 && (
          <button onClick={handleSave} disabled={saving}
            className="h-8 px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            Panel Yerleşimi <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/40 border-b border-slate-700/30 flex-shrink-0 min-h-[34px] overflow-x-auto">
        {roofs.map((r, i) => (
          <div key={r.id} className="flex items-center gap-1.5 bg-slate-700/50 rounded-lg px-2.5 py-1 flex-shrink-0 border border-slate-600/30">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: ROOF_COLOR }} />
            <span className="text-xs text-slate-300">Bölge {i + 1}</span>
            {r.elevations.some(e => e > 0.05) && <span className="text-[10px] text-amber-400">↑eğim</span>}
            <button onClick={() => deleteRoof(r.id)} className="text-slate-500 hover:text-red-400 ml-0.5"><X className="w-3 h-3" /></button>
          </div>
        ))}
        {inProgress.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-600/30 rounded-lg px-2.5 py-1 flex-shrink-0">
            <span className="text-xs text-amber-300">{inProgress.length} nokta</span>
          </div>
        )}
        {roofs.length === 0 && inProgress.length === 0 && drawMode === "polygon" && (
          <p className="text-xs text-slate-500">Çatı köşelerine tıkla · mevcut noktaya yakın tıklayarak birleştir · Düzenle → noktaları sürükle</p>
        )}
        {drawMode === "edit" && <p className="text-xs text-sky-400 ml-auto flex-shrink-0">Düzenleme: köşeleri sürükle · kenar ortasını sürükle → yeni nokta ekler</p>}
        {drawMode === "elevation" && <p className="text-xs text-orange-400 ml-auto flex-shrink-0">Eğim: köşe/kenar noktalarını yukarı/aşağı sürükle — paylaşılan köşe tüm bölmeleri etkiler</p>}
      </div>

      <div className="flex-1 relative overflow-hidden bg-slate-950">
        <canvas ref={canvasRef} width={CW} height={CH}
          className="absolute inset-0 w-full h-full"
          style={{ cursor }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave} onContextMenu={handleContextMenu} />
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/80 rounded-xl px-6 py-3"><p className="text-sm text-slate-400">Uydu görüntüsü yükleniyor…</p></div>
          </div>
        )}
        <div className="absolute bottom-5 right-5 pointer-events-none">
          <p className="text-xs text-slate-600">Sağ tuş → döndür · Scroll → zoom · Orta tuş → kaydır</p>
        </div>
      </div>
    </div>
  );
}
