"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle, Rect, Text, Group } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/solar-design/store";
import type { Vec } from "@/lib/solar-design/types";
import { dist, nearestOnPolygonEdges, centroid } from "@/lib/solar-design/geometry";

export type EditorTool = "select" | "draw" | "calibrate";

interface Props {
  tool: EditorTool;
  selectedPlaneId: string | null;
  onSelectPlane: (id: string | null) => void;
  onCalibrated: (pixelDistance: number) => void;
  onPlaneAdded: (points: Vec[]) => void;
}

const SNAP_SCREEN = 12; // px (ekran) — köşe/kenar yapışma eşiği

export default function CanvasEditor({
  tool,
  selectedPlaneId,
  onSelectPlane,
  onCalibrated,
  onPlaneAdded,
}: Props) {
  const doc = useDesignStore((s) => s.active);
  const update = useDesignStore((s) => s.update);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [draft, setDraft] = useState<Vec[]>([]);
  const [calib, setCalib] = useState<Vec[]>([]);
  const [cursor, setCursor] = useState<Vec | null>(null);
  // Sürüklenen köşenin canlı override'ı (store yazımını dragend'e bırakır).
  const [drag, setDrag] = useState<{ planeId: string; index: number; point: Vec } | null>(null);

  const mpp = doc?.metersPerPixel ?? null;

  // Konteyner boyutu.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Arka plan görüntüsü yükle + ekrana sığdır.
  useEffect(() => {
    if (!doc?.imageDataUrl) {
      setImg(null);
      return;
    }
    const im = new window.Image();
    im.onload = () => {
      setImg(im);
      const s = Math.min(size.w / im.width, size.h / im.height, 1) || 1;
      setScale(s);
      setPos({ x: (size.w - im.width * s) / 2, y: (size.h - im.height * s) / 2 });
    };
    im.src = doc.imageDataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.imageDataUrl]);

  const relPos = (): Vec | null => {
    const st = stageRef.current;
    if (!st) return null;
    const p = st.getRelativePointerPosition();
    return p ? { x: p.x, y: p.y } : null;
  };

  const snapPx = SNAP_SCREEN / scale;

  // Sürükleme sırasında yapışma: diğer köşeler + kenarlar (çatı kırılımı).
  function snap(p: Vec, ignore?: { planeId: string; index: number }): Vec {
    if (!doc) return p;
    let best: { pt: Vec; d: number } | null = null;
    for (const pl of doc.planes) {
      pl.points.forEach((v, i) => {
        if (ignore && ignore.planeId === pl.id && ignore.index === i) return;
        const d = dist(p, v);
        if (d <= snapPx && (!best || d < best.d)) best = { pt: v, d };
      });
    }
    if (best) return { ...(best as { pt: Vec }).pt };
    // Kenara yapış (çizgi üzerinden kırılım verme).
    for (const pl of doc.planes) {
      const r = nearestOnPolygonEdges(p, pl.points);
      if (r && r.dist <= snapPx && (!best || r.dist < (best as { d: number }).d)) {
        best = { pt: r.point, d: r.dist };
      }
    }
    return best ? { ...(best as { pt: Vec }).pt } : p;
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const st = stageRef.current;
    if (!st) return;
    const old = scale;
    const pointer = st.getPointerPosition();
    if (!pointer) return;
    const by = e.evt.deltaY > 0 ? 0.9 : 1.1;
    const next = Math.max(0.05, Math.min(8, old * by));
    const mousePoint = { x: (pointer.x - pos.x) / old, y: (pointer.y - pos.y) / old };
    setScale(next);
    setPos({ x: pointer.x - mousePoint.x * next, y: pointer.y - mousePoint.y * next });
  }

  function onStageClick() {
    const p = relPos();
    if (!p) return;
    if (tool === "calibrate") {
      const next = [...calib, p];
      if (next.length === 2) {
        onCalibrated(dist(next[0], next[1]));
        setCalib([]);
      } else setCalib(next);
      return;
    }
    if (tool === "draw") {
      if (draft.length >= 3 && dist(p, draft[0]) <= snapPx * 1.5) {
        onPlaneAdded(draft);
        setDraft([]);
        return;
      }
      setDraft([...draft, snap(p)]);
      return;
    }
  }

  function onStageMouseMove() {
    if (tool === "draw" || tool === "calibrate") setCursor(relPos());
  }

  const mLabel = (px: number) => (mpp ? `${(px * mpp).toFixed(2)} m` : `${Math.round(px)} px`);

  // Sürükleme override uygulanmış düzlemler.
  const planes = useMemo(() => {
    if (!doc) return [];
    if (!drag) return doc.planes;
    return doc.planes.map((pl) =>
      pl.id === drag.planeId
        ? { ...pl, points: pl.points.map((v, i) => (i === drag.index ? drag.point : v)) }
        : pl,
    );
  }, [doc, drag]);

  if (!doc) return null;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-100">
      {!img && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-sm text-slate-400">
          Önce “Görüntü & Ölçek” sekmesinden bir uydu/drone görüntüsü yükleyin.
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
        draggable={tool === "select" && !drag}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() });
        }}
        onWheel={onWheel}
        onMouseDown={(e) => {
          // Boş zemine tıklayınca (select) seçim bırak.
          if (tool === "select" && e.target === e.target.getStage()) onSelectPlane(null);
        }}
        onClick={onStageClick}
        onTap={onStageClick}
        onMouseMove={onStageMouseMove}
        style={{ background: "#e2e8f0", cursor: tool === "select" ? "default" : "crosshair" }}
      >
        <Layer>
          {img && <KonvaImage image={img} listening={false} />}
        </Layer>

        {/* Paneller */}
        <Layer listening={false}>
          {doc.placed.map((p) => (
            <Group key={p.id} x={p.x} y={p.y} rotation={p.rotationDeg}>
              <Rect width={p.w} height={p.h} fill="#0b1e3f" stroke="#3b82f6" strokeWidth={0.6 / scale} cornerRadius={0.5} opacity={0.92} />
              <Rect x={p.w * 0.5} width={0.3 / scale} height={p.h} fill="#1e3a8a" />
              <Rect y={p.h / 3} width={p.w} height={0.3 / scale} fill="#1e3a8a" />
              <Rect y={(p.h * 2) / 3} width={p.w} height={0.3 / scale} fill="#1e3a8a" />
            </Group>
          ))}
        </Layer>

        {/* Çatı düzlemleri */}
        <Layer>
          {planes.map((pl) => {
            const active = pl.id === selectedPlaneId;
            const flat = pl.points.flatMap((v) => [v.x, v.y]);
            return (
              <Group key={pl.id}>
                <Line
                  points={flat}
                  closed
                  fill={pl.color + "33"}
                  stroke={pl.color}
                  strokeWidth={(active ? 2.5 : 1.5) / scale}
                  onClick={() => tool === "select" && onSelectPlane(pl.id)}
                  onTap={() => tool === "select" && onSelectPlane(pl.id)}
                  onDblClick={() => {
                    if (tool !== "select") return;
                    const p = relPos();
                    if (!p) return;
                    const r = nearestOnPolygonEdges(p, pl.points);
                    if (!r) return;
                    update((d) => {
                      const target = d.planes.find((x) => x.id === pl.id);
                      if (target) target.points.splice(r.edgeIndex + 1, 0, r.point);
                    }, true);
                  }}
                />
                {/* Kenar ölçü etiketleri */}
                {mpp &&
                  pl.points.map((v, i) => {
                    const b = pl.points[(i + 1) % pl.points.length];
                    const mid = { x: (v.x + b.x) / 2, y: (v.y + b.y) / 2 };
                    return (
                      <Text
                        key={`e${i}`}
                        x={mid.x}
                        y={mid.y}
                        text={mLabel(dist(v, b))}
                        fontSize={12 / scale}
                        fill="#0f172a"
                        stroke="#fff"
                        strokeWidth={2.4 / scale}
                        fillAfterStrokeEnabled
                        offsetX={16 / scale}
                        offsetY={6 / scale}
                        listening={false}
                      />
                    );
                  })}
                {/* Köşe tutamakları */}
                {tool === "select" &&
                  active &&
                  pl.points.map((v, i) => (
                    <Circle
                      key={`v${i}`}
                      x={v.x}
                      y={v.y}
                      radius={5 / scale}
                      fill="#fff"
                      stroke={pl.color}
                      strokeWidth={2 / scale}
                      draggable
                      onDragStart={() => setDrag({ planeId: pl.id, index: i, point: v })}
                      onDragMove={(e) => {
                        const np = snap({ x: e.target.x(), y: e.target.y() }, { planeId: pl.id, index: i });
                        e.target.position(np);
                        setDrag({ planeId: pl.id, index: i, point: np });
                      }}
                      onDragEnd={(e) => {
                        const np = snap({ x: e.target.x(), y: e.target.y() }, { planeId: pl.id, index: i });
                        update((d) => {
                          const target = d.planes.find((x) => x.id === pl.id);
                          if (target) target.points[i] = np;
                        }, true);
                        setDrag(null);
                      }}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        if (pl.points.length <= 3) return;
                        update((d) => {
                          const target = d.planes.find((x) => x.id === pl.id);
                          if (target) target.points.splice(i, 1);
                        }, true);
                      }}
                    />
                  ))}
              </Group>
            );
          })}

          {/* Çizim taslağı */}
          {tool === "draw" && draft.length > 0 && (
            <>
              <Line
                points={[
                  ...draft.flatMap((v) => [v.x, v.y]),
                  ...(cursor ? [cursor.x, cursor.y] : []),
                ]}
                stroke="#059669"
                strokeWidth={1.5 / scale}
                dash={[6 / scale, 4 / scale]}
              />
              {draft.map((v, i) => (
                <Circle key={i} x={v.x} y={v.y} radius={4 / scale} fill="#059669" />
              ))}
              {cursor && draft.length > 0 && mpp && (
                <Text
                  x={cursor.x}
                  y={cursor.y}
                  text={mLabel(dist(draft[draft.length - 1], cursor))}
                  fontSize={12 / scale}
                  fill="#065f46"
                  stroke="#fff"
                  strokeWidth={2.4 / scale}
                  fillAfterStrokeEnabled
                  offsetY={-8 / scale}
                  listening={false}
                />
              )}
            </>
          )}

          {/* Kalibrasyon çizgisi */}
          {calib.length > 0 && (
            <>
              <Line
                points={[
                  ...calib.flatMap((v) => [v.x, v.y]),
                  ...(cursor && calib.length === 1 ? [cursor.x, cursor.y] : []),
                ]}
                stroke="#dc2626"
                strokeWidth={2 / scale}
              />
              {calib.map((v, i) => (
                <Circle key={i} x={v.x} y={v.y} radius={4 / scale} fill="#dc2626" />
              ))}
            </>
          )}
        </Layer>
      </Stage>

      {/* Yön etiketi (kuzey yok — sadeleştirilmiş) */}
      {img && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm">
          Tekerlek: yakınlaştır · Sürükle: kaydır
        </div>
      )}
    </div>
  );
}

export function planeCentroid(points: Vec[]): Vec {
  return centroid(points);
}
