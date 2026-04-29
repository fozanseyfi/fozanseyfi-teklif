"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

const CW = 600, CH = 350;
const ISO_H = 55;
const ROOF_COLOR = "#c05828";

const VIEWS = [
  { label: "Güney", az: 0,             el: Math.PI * 30 / 180 },
  { label: "Doğu",  az: Math.PI / 2,   el: Math.PI * 28 / 180 },
  { label: "Batı",  az: -Math.PI / 2,  el: Math.PI * 28 / 180 },
  { label: "Üst",   az: 0,             el: Math.PI / 2 },
];

interface Roof {
  id: string;
  vertices: [number, number][];
  color: string;
  elevations?: number[];
}

interface Props {
  projectId: string;
  roofs: Roof[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function mPxAt(lat: number, zoom: number) {
  return 156543.03392 * Math.cos((lat * Math.PI) / 180) / Math.pow(2, zoom);
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

function computeCenter(roofs: Roof[]): { lat: number; lng: number; zoom: number } {
  const allVerts = roofs.flatMap((r) => r.vertices);
  if (allVerts.length === 0) return { lat: 39.0, lng: 35.5, zoom: 17 };
  const lats = allVerts.map(([la]) => la);
  const lngs = allVerts.map(([, ln]) => ln);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const spanLat = Math.max(...lats) - Math.min(...lats);
  const spanLng = Math.max(...lngs) - Math.min(...lngs);
  const span = Math.max(spanLat * 110540, spanLng * 111320 * Math.cos((lat * Math.PI) / 180));
  // Choose zoom so the span fits in ~60% of CW
  const targetPx = CW * 0.6;
  let zoom = 17;
  for (let z = 19; z >= 14; z--) {
    const m = mPxAt(lat, z);
    if (span / m < targetPx) { zoom = z; break; }
  }
  return { lat, lng, zoom };
}

function renderRoofs(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  roofs: Roof[],
  az: number, el: number,
  cLat: number, cLng: number, zoom: number,
) {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = "#0d1827"; ctx.fillRect(0, 0, CW, CH);
  if (roofs.length === 0) return;

  const allPx = roofs.flatMap((r) => r.vertices.map(([la, ln]) => ll2px(la, ln, cLat, cLng, zoom)));
  const cx0 = allPx.reduce((s, p) => s + p[0], 0) / allPx.length;
  const cy0 = allPx.reduce((s, p) => s + p[1], 0) / allPx.length;
  const xs = allPx.map((p) => p[0]), ys = allPx.map((p) => p[1]);
  const maxDim = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  const baseScale = (Math.min(CW, CH) * 0.28) / maxDim;
  const mPerPx = mPxAt(cLat, zoom);

  function proj(ix: number, iy: number, wz: number): [number, number] {
    const wx = (ix - cx0) * baseScale, wy = (iy - cy0) * baseScale;
    const [sx, sy] = projOrbital(wx, wy, wz, az, el);
    return [CW / 2 + sx, CH / 2 + sy];
  }

  if (img) {
    const A = proj(0, 0, 0), B = proj(CW, 0, 0), C = proj(0, CH, 0);
    const a = (B[0] - A[0]) / CW, b = (B[1] - A[1]) / CW;
    const c = (C[0] - A[0]) / CH, d = (C[1] - A[1]) / CH;
    ctx.save(); ctx.setTransform(a, b, c, d, A[0], A[1]); ctx.drawImage(img, 0, 0, CW, CH); ctx.restore();
  }

  for (const roof of roofs) {
    if (roof.vertices.length < 3) continue;
    const pxArr = roof.vertices.map(([la, ln]) => ll2px(la, ln, cLat, cLng, zoom));
    const n = pxArr.length;
    const topZ = pxArr.map((_, i) => {
      const elev = roof.elevations?.[i] ?? 0;
      return ISO_H + (elev / mPerPx) * baseScale;
    });
    const screenTop = pxArr.map(([ix, iy], i) => proj(ix, iy, topZ[i]));
    const screenBot = pxArr.map(([ix, iy]) => proj(ix, iy, 0));

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      ctx.beginPath();
      ctx.moveTo(screenBot[i][0], screenBot[i][1]); ctx.lineTo(screenBot[j][0], screenBot[j][1]);
      ctx.lineTo(screenTop[j][0], screenTop[j][1]); ctx.lineTo(screenTop[i][0], screenTop[i][1]);
      ctx.closePath();
      ctx.fillStyle = "rgba(15,15,20,0.97)"; ctx.fill();
      ctx.strokeStyle = "#2a2a35"; ctx.lineWidth = 0.6; ctx.stroke();
    }

    ctx.beginPath(); ctx.moveTo(screenTop[0][0], screenTop[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(screenTop[i][0], screenTop[i][1]);
    ctx.closePath();
    ctx.fillStyle = ROOF_COLOR; ctx.fill();
    ctx.strokeStyle = "#8a3520"; ctx.lineWidth = 0.8; ctx.stroke();
  }
}

// ── ViewCanvas ────────────────────────────────────────────────────────────────
function ViewCanvas({ roofs, az, el }: { roofs: Roof[]; az: number; el: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { lat, lng, zoom } = computeCenter(roofs);
  const fixedZoom = Math.max(zoom, 17);

  useEffect(() => {
    function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderRoofs(ctx, imgRef.current, roofs, az, el, lat, lng, fixedZoom);
    }

    if (imgRef.current) { render(); return; }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgRef.current = img; render(); };
    img.onerror = () => { imgRef.current = null; render(); };

    const m = mPxAt(lat, fixedZoom);
    const cosL = Math.cos((lat * Math.PI) / 180);
    const hw = (CW / 2) * m, hh = (CH / 2) * m;
    const dLng = hw / (111320 * cosL), dLat = hh / 110540;
    img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}&bboxSR=4326&size=${CW},${CH}&imageSR=4326&format=jpg&f=image`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef} width={CW} height={CH}
      className="w-full rounded-xl border border-slate-200/70 shadow-sm bg-slate-900"
      style={{ aspectRatio: `${CW}/${CH}` }}
    />
  );
}

// ── DrawingViewer ─────────────────────────────────────────────────────────────
export function DrawingViewer({ projectId, roofs }: Props) {
  if (roofs.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-md shadow-slate-200/60 overflow-hidden mb-5">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-600">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm tracking-wide">Çatı Çizimi</h3>
            <p className="text-xs text-slate-400">
              {roofs.length} bölge · {roofs.some((r) => r.elevations?.some((e) => e > 0.05)) ? "eğimli çatı" : "düz çatı"}
            </p>
          </div>
        </div>
        <Link
          href={`/projects/${projectId}/drawing`}
          className="h-8 px-3 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <Pencil className="w-3.5 h-3.5" />Çizimi Düzenle
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        {VIEWS.map((v) => (
          <div key={v.label}>
            <p className="text-xs font-medium text-slate-500 mb-1.5 text-center">{v.label}</p>
            <ViewCanvas roofs={roofs} az={v.az} el={v.el} />
          </div>
        ))}
      </div>
    </div>
  );
}
