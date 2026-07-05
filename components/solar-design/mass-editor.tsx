"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Group } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/solar-design/store";
import type { Vec } from "@/lib/solar-design/types";
import { dist, nearestOnSegment } from "@/lib/solar-design/geometry";
import { generateRoof } from "@/lib/solar-design/roof-model";

export type MassMode = "draw" | "edit" | "move" | "view";

const SNAP_SCREEN = 12;

/**
 * 2B plan editörü — aktif kütlenin dış hattını çizer/düzenler/taşır. Çatının iç
 * çizgileri (sırt/kırma) parametrik modelden hesaplanıp gösterilir (önizleme).
 * Diğer kütleler salt-okunur. Çatı 3B'de üretilir.
 */
export default function MassEditor({ mode }: { mode: MassMode }) {
  const doc = useDesignStore((s) => s.active)!;
  const update = useDesignStore((s) => s.update);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [cursor, setCursor] = useState<Vec | null>(null);

  const active = doc.masses.find((m) => m.id === doc.activeMassId) || null;
  const fp = active?.footprint ?? [];
  const mpp = doc.metersPerPixel;
  const snapPx = SNAP_SCREEN / scale;

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- altlık görüntüsünü yükle (dış kaynak senkronizasyonu)
    if (!doc.imageDataUrl) { setImg(null); return; }
    const im = new window.Image();
    im.onload = () => {
      setImg(im);
      const s = Math.min(size.w / im.width, size.h / im.height, 1) || 1;
      setScale(s);
      setPos({ x: (size.w - im.width * s) / 2, y: (size.h - im.height * s) / 2 });
    };
    im.src = doc.imageDataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.imageDataUrl]);

  const relPos = (): Vec | null => {
    const p = stageRef.current?.getRelativePointerPosition();
    return p ? { x: p.x, y: p.y } : null;
  };

  function setFootprint(mut: (arr: Vec[]) => Vec[], history = true) {
    if (!active) return;
    update((d) => {
      const m = d.masses.find((x) => x.id === active.id);
      if (m) m.footprint = mut(m.footprint.map((p) => ({ ...p })));
    }, history);
  }

  const nearFirst = (p: Vec) => fp.length >= 3 && dist(p, fp[0]) <= snapPx;

  function stageClick() {
    if (mode !== "draw" || !active) return;
    const p = relPos();
    if (!p) return;
    if (nearFirst(p)) return;
    setFootprint((arr) => [...arr, p]);
  }
  function stageMouseMove() { if (mode === "draw") setCursor(relPos()); }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const st = stageRef.current;
    const pointer = st?.getPointerPosition();
    if (!pointer) return;
    const old = scale;
    const next = Math.max(0.02, Math.min(60, old * (e.evt.deltaY > 0 ? 0.9 : 1.1)));
    const m = { x: (pointer.x - pos.x) / old, y: (pointer.y - pos.y) / old };
    setScale(next);
    setPos({ x: pointer.x - m.x * next, y: pointer.y - m.y * next });
  }

  const mLabel = (px: number) => (mpp ? `${(px * mpp).toFixed(2)} m` : `${Math.round(px)} px`);
  const draggableStage = mode === "edit" || mode === "view";
  const others = useMemo(() => doc.masses.filter((m) => m.id !== doc.activeMassId), [doc.masses, doc.activeMassId]);

  // Çatının iç çizgileri (sırt/kırma) — parametrik modelden; 2 düzlemce paylaşılan kenarlar.
  const roofLines: [Vec, Vec][] = (() => {
    if (!active || active.footprint.length < 3 || !mpp) return [];
    const model = generateRoof(active.footprint, active.roofType, active.pitchDeg, active.ridgeAxisDeg, active.baseM + active.wallM, mpp);
    const seen = new Map<string, { a: Vec; b: Vec; n: number }>();
    const r = (v: number) => Math.round(v * 2) / 2;
    const key = (p: Vec, q: Vec) => { const A = `${r(p.x)},${r(p.y)}`, B = `${r(q.x)},${r(q.y)}`; return A < B ? `${A}|${B}` : `${B}|${A}`; };
    for (const pl of model.planes) {
      const P = pl.poly;
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        const k = key(a, b);
        const e = seen.get(k);
        if (e) e.n++; else seen.set(k, { a, b, n: 1 });
      }
    }
    return [...seen.values()].filter((e) => e.n >= 2).map((e) => [e.a, e.b] as [Vec, Vec]);
  })();

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-100">
      {!img && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-sm text-slate-400">
          Önce “Görüntü &amp; Ölçek” sekmesinden altlık ekleyin.
        </div>
      )}
      {mode === "draw" && active && (
        <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow">
          Köşeleri tıkla · ilk köşeye dönünce kapanır ({fp.length} köşe)
        </div>
      )}
      {mode === "move" && active && (
        <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow">
          Kütleyi sürükleyerek taşı (yanlış birleşmeyi düzelt)
        </div>
      )}
      {!active && (
        <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow">
          Sağdan “Kütle” ile bir bina kütlesi oluşturun.
        </div>
      )}

      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable={draggableStage}
        onDragEnd={(e) => { if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() }); }}
        onWheel={onWheel}
        onClick={stageClick}
        onTap={stageClick}
        onMouseMove={stageMouseMove}
        style={{ background: "#e2e8f0", cursor: mode === "draw" ? "crosshair" : mode === "move" ? "move" : "default" }}
      >
        <Layer>{img && <KonvaImage image={img} listening={false} />}</Layer>

        {/* Diğer kütleler — salt-okunur */}
        <Layer listening={false}>
          {others.map((m) => (
            m.footprint.length >= 2 ? (
              <Line key={m.id} points={m.footprint.flatMap((p) => [p.x, p.y])} closed={m.footprint.length >= 3}
                stroke="#94a3b8" strokeWidth={1.4 / scale} fill="#94a3b833" dash={[6 / scale, 4 / scale]} />
            ) : null
          ))}
        </Layer>

        {/* Aktif kütle + çatı iç çizgileri */}
        <Layer>
          {mode === "move" && fp.length >= 2 ? (
            <Group
              draggable
              onDragEnd={(e) => { const g = e.target; const dx = g.x(), dy = g.y(); g.position({ x: 0, y: 0 }); setFootprint((arr) => arr.map((p) => ({ x: p.x + dx, y: p.y + dy }))); }}
            >
              <Line points={fp.flatMap((p) => [p.x, p.y])} closed={fp.length >= 3} stroke="#f59e0b" strokeWidth={2.5 / scale} fill="#f59e0b22" />
              {fp.map((p, i) => <Circle key={`mv${i}`} x={p.x} y={p.y} radius={4 / scale} fill="#f59e0b" listening={false} />)}
            </Group>
          ) : (
            <>
              {fp.length >= 2 && (
                <Line points={fp.flatMap((p) => [p.x, p.y])} closed={fp.length >= 3} stroke="#059669" strokeWidth={2 / scale} fill="#05966922" />
              )}
              {/* Çatı iç çizgileri (sırt/kırma) — önizleme */}
              {roofLines.map(([a, b], i) => (
                <Line key={`rl${i}`} points={[a.x, a.y, b.x, b.y]} stroke="#2563eb" strokeWidth={1.6 / scale} dash={[5 / scale, 4 / scale]} listening={false} />
              ))}
              {/* Köşe ölçüleri */}
              {fp.length >= 2 && fp.map((a, i) => {
                const b = fp[(i + 1) % fp.length];
                if (i === fp.length - 1 && fp.length < 3) return null;
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                return <Text key={`m${i}`} x={mid.x} y={mid.y} text={mLabel(dist(a, b))} fontSize={11.5 / scale} fill="#0f172a" stroke="#fff" strokeWidth={2.6 / scale} fillAfterStrokeEnabled offsetX={16 / scale} offsetY={6 / scale} listening={false} />;
              })}
              {/* Köşe noktaları */}
              {(mode === "edit" || mode === "draw") && fp.map((p, i) => (
                <Circle
                  key={`v${i}`}
                  x={p.x} y={p.y} radius={5 / scale}
                  fill={i === 0 && mode === "draw" ? "#f59e0b" : "#059669"} stroke="#fff" strokeWidth={1.6 / scale}
                  draggable={mode === "edit"}
                  onDragMove={(e) => setFootprint((arr) => { arr[i] = { x: e.target.x(), y: e.target.y() }; return arr; }, false)}
                  onDragEnd={(e) => setFootprint((arr) => { arr[i] = { x: e.target.x(), y: e.target.y() }; return arr; }, true)}
                  onContextMenu={(e) => { e.evt.preventDefault(); if (mode === "edit" && fp.length > 3) setFootprint((arr) => arr.filter((_, k) => k !== i)); }}
                />
              ))}
            </>
          )}
        </Layer>

        {/* Kenar ekleme (edit): çizgiye çift tık → araya köşe */}
        {mode === "edit" && fp.length >= 3 && (
          <Layer>
            {fp.map((a, i) => {
              const b = fp[(i + 1) % fp.length];
              return <Line key={`e${i}`} points={[a.x, a.y, b.x, b.y]} stroke="transparent" strokeWidth={0.1} hitStrokeWidth={12 / scale}
                onDblClick={() => { const p = relPos(); if (!p) return; const rr = nearestOnSegment(p, a, b); setFootprint((arr) => { arr.splice(i + 1, 0, rr.point); return arr; }); }} />;
            })}
          </Layer>
        )}

        {/* Çizim önizleme */}
        <Layer listening={false}>
          {mode === "draw" && fp.length > 0 && cursor && (
            <Line points={[fp[fp.length - 1].x, fp[fp.length - 1].y, cursor.x, cursor.y]} stroke="#059669" strokeWidth={1.4 / scale} dash={[6 / scale, 4 / scale]} />
          )}
          {mode === "draw" && cursor && nearFirst(cursor) && (
            <Circle x={fp[0].x} y={fp[0].y} radius={9 / scale} stroke="#f59e0b" strokeWidth={2 / scale} />
          )}
        </Layer>
      </Stage>

      {img && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm">
          Mavi kesik çizgiler = çatı sırt/kırma · Tekerlek: yakınlaş · Boşluğu sürükle: kaydır{mode === "edit" ? " · Köşe sürükle/çift tık ekle/sağ tık sil" : ""}
        </div>
      )}
    </div>
  );
}
