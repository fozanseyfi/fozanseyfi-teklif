"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle, Rect, Text, Group } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/solar-design/store";
import type { Vec, RNode, DesignDoc } from "@/lib/solar-design/types";
import { FACE_COLORS } from "@/lib/solar-design/types";
import { dist, nearestOnSegment } from "@/lib/solar-design/geometry";
import { detectFaces } from "@/lib/solar-design/faces";
import { planarize } from "@/lib/solar-design/planarize";

export type EditorMode = "draw" | "roof-select" | "panel-select" | "view";

interface Props {
  mode: EditorMode;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  selectedFaceSig: string | null;
  onSelectFace: (sig: string | null) => void;
}

const SNAP_SCREEN = 12;

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `n${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

type Hit = { kind: "node"; id: string } | { kind: "edge"; edgeId: string; point: Vec } | { kind: "free"; point: Vec };

export default function CanvasEditor({ mode, selectedNodeId, onSelectNode, selectedFaceSig, onSelectFace }: Props) {
  const doc = useDesignStore((s) => s.active) as DesignDoc;
  const update = useDesignStore((s) => s.update);
  const undo = useDesignStore((s) => s.undo);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [cursor, setCursor] = useState<Vec | null>(null);

  // Çizim zinciri
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const chainRef = useRef(0);
  const [drawing, setDrawing] = useState(false);

  // Node sürükleme override
  const [nodeDrag, setNodeDrag] = useState<{ id: string; point: Vec } | null>(null);

  // Panel seçim + sürükleme
  const [selPanels, setSelPanels] = useState<Set<string>>(new Set());
  const [panelDelta, setPanelDelta] = useState<Vec | null>(null);
  const panelDragRef = useRef<{ id: string; orig: Map<string, Vec> } | null>(null);

  const nodeById = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc.nodes]);
  const faces = useMemo(() => detectFaces(doc.nodes, doc.edges), [doc.nodes, doc.edges]);

  useEffect(() => {
    activeRef.current = activeNode;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- çizim zinciri durumunu yansıt (dış senkronizasyon)
    setDrawing(!!activeNode);
  }, [activeNode]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mod değişince panel seçimini sıfırla (dış senkronizasyon)
  useEffect(() => { if (mode !== "panel-select") setSelPanels(new Set()); }, [mode]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mod değişince çizim zincirini sıfırla (dış senkronizasyon)
  useEffect(() => { if (mode !== "draw") { setActiveNode(null); chainRef.current = 0; } }, [mode]);

  // Boyut
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Görüntü
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
  const snapPx = SNAP_SCREEN / scale;

  function snapHit(p: Vec, ignoreId?: string): Hit {
    let bn: RNode | null = null;
    let bd = snapPx;
    for (const n of doc.nodes) {
      if (n.id === ignoreId) continue;
      const d = dist(p, n);
      if (d <= bd) { bd = d; bn = n; }
    }
    if (bn) return { kind: "node", id: bn.id };
    let be = snapPx;
    let bestEdge: { id: string; point: Vec } | null = null;
    for (const e of doc.edges) {
      if (ignoreId && (e.a === ignoreId || e.b === ignoreId)) continue;
      const a = nodeById.get(e.a);
      const b = nodeById.get(e.b);
      if (!a || !b) continue;
      const r = nearestOnSegment(p, a, b);
      if (r.dist <= be) { be = r.dist; bestEdge = { id: e.id, point: r.point }; }
    }
    if (bestEdge) return { kind: "edge", edgeId: bestEdge.id, point: bestEdge.point };
    return { kind: "free", point: p };
  }

  function splitEdge(d: DesignDoc, edgeId: string, point: Vec, newId: string): void {
    const e = d.edges.find((x) => x.id === edgeId);
    if (!e) return;
    const az = nodeById.get(e.a)?.z ?? 0;
    const bz = nodeById.get(e.b)?.z ?? 0;
    d.nodes.push({ id: newId, x: point.x, y: point.y, z: (az + bz) / 2 });
    d.edges = d.edges.filter((x) => x.id !== edgeId);
    d.edges.push({ id: genId(), a: e.a, b: newId }, { id: genId(), a: newId, b: e.b });
  }

  function addEdgeIfMissing(d: DesignDoc, a: string, b: string) {
    if (a === b) return;
    if (d.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return;
    d.edges.push({ id: genId(), a, b });
  }

  function drawClick(p: Vec) {
    const hit = snapHit(p);
    const nid = genId();
    const targetId = hit.kind === "node" ? hit.id : nid;
    const prev = activeRef.current;
    update((d) => {
      if (hit.kind === "free") d.nodes.push({ id: nid, x: p.x, y: p.y, z: 0 });
      else if (hit.kind === "edge") splitEdge(d, hit.edgeId, hit.point, nid);
      if (prev && prev !== targetId) addEdgeIfMissing(d, prev, targetId);
      planarize(d); // yeni çizgi mevcut çizgileri kesiyorsa kesişimlere nokta at
    }, true);
    activeRef.current = targetId;
    setActiveNode(targetId);
    chainRef.current += 1;
  }

  function finishChain() { setActiveNode(null); chainRef.current = 0; }
  function cancelChain() {
    const n = chainRef.current;
    for (let i = 0; i < n; i++) undo();
    setActiveNode(null);
    chainRef.current = 0;
  }

  function stageClick() {
    const p = relPos();
    if (!p) return;
    if (mode === "draw") { drawClick(p); return; }
  }

  function stageMouseMove() { if (mode === "draw" || mode === "roof-select") setCursor(relPos()); }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const st = stageRef.current;
    const pointer = st?.getPointerPosition();
    if (!pointer) return;
    const old = scale;
    const by = e.evt.deltaY > 0 ? 0.9 : 1.1;
    const next = Math.max(0.02, Math.min(60, old * by));
    const m = { x: (pointer.x - pos.x) / old, y: (pointer.y - pos.y) / old };
    setScale(next);
    setPos({ x: pointer.x - m.x * next, y: pointer.y - m.y * next });
  }

  // Klavye
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (mode === "draw") {
        if (e.key === "Enter") { e.preventDefault(); finishChain(); }
        else if (e.key === "Escape") { e.preventDefault(); cancelChain(); }
        else if (e.key === "Backspace") { e.preventDefault(); if (chainRef.current > 0) { undo(); chainRef.current -= 1; } }
      }
      if (mode === "panel-select" && selPanels.size) {
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelectedPanels(); }
        else if (e.key.toLowerCase() === "r") { e.preventDefault(); flipSelectedPanels(); }
      }
      if (mode === "roof-select" && selectedNodeId && (e.key === "Delete")) { e.preventDefault(); deleteNode(selectedNodeId); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selPanels, selectedNodeId]);

  function deleteNode(id: string) {
    update((d) => { d.nodes = d.nodes.filter((n) => n.id !== id); d.edges = d.edges.filter((e) => e.a !== id && e.b !== id); }, true);
    onSelectNode(null);
  }

  function nodeDragEnd(id: string, p: Vec) {
    const hit = snapHit(p, id);
    update((d) => {
      const self = d.nodes.find((n) => n.id === id);
      if (!self) return;
      if (hit.kind === "node") {
        // birleştir: id → hit.id
        const to = hit.id;
        for (const e of d.edges) { if (e.a === id) e.a = to; if (e.b === id) e.b = to; }
        d.edges = d.edges.filter((e) => e.a !== e.b);
        const seen = new Set<string>();
        d.edges = d.edges.filter((e) => { const k = [e.a, e.b].sort().join("-"); if (seen.has(k)) return false; seen.add(k); return true; });
        d.nodes = d.nodes.filter((n) => n.id !== id);
      } else if (hit.kind === "edge") {
        self.x = hit.point.x; self.y = hit.point.y;
        const e = d.edges.find((x) => x.id === hit.edgeId);
        if (e) { const a = e.a, b = e.b; d.edges = d.edges.filter((x) => x.id !== hit.edgeId); addEdgeIfMissing(d, a, id); addEdgeIfMissing(d, id, b); }
      } else {
        self.x = p.x; self.y = p.y;
      }
      planarize(d); // taşınan nokta bir çizgiyi kesiyorsa kesişime nokta at
    }, true);
    setNodeDrag(null);
  }

  // Panel seçim / taşıma / döndürme
  function togglePanel(id: string, additive: boolean) {
    setSelPanels((prev) => {
      const next = new Set(additive ? prev : []);
      if (additive && prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function deleteSelectedPanels() {
    update((d) => { d.placed = d.placed.filter((p) => !selPanels.has(p.id)); }, true);
    setSelPanels(new Set());
  }
  function flipSelectedPanels() {
    update((d) => {
      d.placed = d.placed.map((p) => {
        if (!selPanels.has(p.id)) return p;
        const rad = (p.rotationDeg * Math.PI) / 180;
        const cx = p.x + (Math.cos(rad) * p.w) / 2 - (Math.sin(rad) * p.h) / 2;
        const cy = p.y + (Math.sin(rad) * p.w) / 2 + (Math.cos(rad) * p.h) / 2;
        const nw = p.h, nh = p.w;
        return { ...p, w: nw, h: nh, x: cx - ((Math.cos(rad) * nw) / 2 - (Math.sin(rad) * nh) / 2), y: cy - ((Math.sin(rad) * nw) / 2 + (Math.cos(rad) * nh) / 2) };
      });
    }, true);
  }

  const mLabel = (px: number) => (doc.metersPerPixel ? `${(px * doc.metersPerPixel).toFixed(2)} m` : `${Math.round(px)} px`);

  // Sürükleme override uygulanan node konumları
  const nodePos = (n: RNode): Vec => (nodeDrag && nodeDrag.id === n.id ? nodeDrag.point : { x: n.x, y: n.y });
  const panelPos = (p: { id: string; x: number; y: number }): Vec =>
    panelDelta && selPanels.has(p.id) && panelDragRef.current?.id !== p.id
      ? { x: (panelDragRef.current!.orig.get(p.id)?.x ?? p.x) + panelDelta.x, y: (panelDragRef.current!.orig.get(p.id)?.y ?? p.y) + panelDelta.y }
      : { x: p.x, y: p.y };

  const draggableStage = mode === "roof-select" || mode === "panel-select" || mode === "view";
  const cursorStyle = mode === "draw" ? "crosshair" : "default";

  // Çizgi üstü hayalet nokta — imleç bir kenara yakınken (nokta değil) göster.
  const edgeGhost =
    (mode === "roof-select" || mode === "draw") && cursor
      ? (() => { const h = snapHit(cursor); return h.kind === "edge" ? h.point : null; })()
      : null;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-100">
      {!img && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-sm text-slate-400">
          Önce “Görüntü & Ölçek” sekmesinden altlık görüntüsünü ekleyin.
        </div>
      )}

      {/* Çizim üstü butonları */}
      {mode === "draw" && drawing && (
        <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 gap-2">
          <button type="button" onClick={finishChain} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700">Bitir (Enter)</button>
          <button type="button" onClick={cancelChain} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow hover:bg-slate-50">İptal (Esc)</button>
        </div>
      )}
      {/* Panel seçim aksiyonları */}
      {mode === "panel-select" && selPanels.size > 0 && (
        <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow">
          <span className="text-xs font-medium text-slate-600">{selPanels.size} panel</span>
          <button type="button" onClick={flipSelectedPanels} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium hover:bg-slate-200">Döndür (R)</button>
          <button type="button" onClick={deleteSelectedPanels} className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100">Sil (Del)</button>
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
        draggable={draggableStage && !nodeDrag && !panelDragRef.current}
        onDragEnd={(e) => { if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() }); }}
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            if (mode === "roof-select") { onSelectNode(null); onSelectFace(null); }
            if (mode === "panel-select") setSelPanels(new Set());
          }
        }}
        onClick={stageClick}
        onTap={stageClick}
        onMouseMove={stageMouseMove}
        style={{ background: "#e2e8f0", cursor: cursorStyle }}
      >
        <Layer>{img && <KonvaImage image={img} listening={false} />}</Layer>

        {/* Yüzeyler (çatı bölümleri) */}
        <Layer>
          {faces.map((f, i) => {
            const pts = f.nodes.flatMap((id) => { const n = nodeById.get(id); return n ? [nodePos(n).x, nodePos(n).y] : []; });
            const color = FACE_COLORS[i % FACE_COLORS.length];
            const active = f.sig === selectedFaceSig;
            const name = doc.faceMeta[f.sig]?.name || `Çatı Bölümü ${i + 1}`;
            return (
              <Group key={f.sig}>
                <Line points={pts} closed fill={color + (active ? "33" : "14")} stroke={color} strokeWidth={(active ? 2 : 1) / scale}
                  onClick={() => { if (mode === "roof-select") { onSelectFace(f.sig); onSelectNode(null); } }} onTap={() => mode === "roof-select" && onSelectFace(f.sig)} />
                <Text x={f.centroid.x} y={f.centroid.y} text={name} fontSize={13 / scale} fill="#0f172a" stroke="#fff" strokeWidth={3 / scale} fillAfterStrokeEnabled offsetX={30 / scale} listening={false} />
              </Group>
            );
          })}
        </Layer>

        {/* Kenarlar + ölçüler */}
        <Layer>
          {doc.edges.map((e) => {
            const a = nodeById.get(e.a);
            const b = nodeById.get(e.b);
            if (!a || !b) return null;
            const pa = nodePos(a), pb = nodePos(b);
            const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
            return (
              <Group key={e.id}>
                <Line points={[pa.x, pa.y, pb.x, pb.y]} stroke="#1e293b" strokeWidth={1.6 / scale}
                  hitStrokeWidth={12 / scale}
                  onMouseEnter={(ev) => { if (mode === "roof-select") { const st = ev.target.getStage(); if (st) st.container().style.cursor = "copy"; } }}
                  onMouseLeave={(ev) => { const st = ev.target.getStage(); if (st) st.container().style.cursor = cursorStyle; }}
                  onClick={() => { if (mode !== "roof-select") return; const p = relPos(); if (!p) return; const r = nearestOnSegment(p, pa, pb); update((d) => { splitEdge(d, e.id, r.point, genId()); planarize(d); }, true); }}
                  onDblClick={() => { if (mode !== "roof-select") return; const p = relPos(); if (!p) return; const r = nearestOnSegment(p, pa, pb); update((d) => { splitEdge(d, e.id, r.point, genId()); planarize(d); }, true); }} />
                <Text x={mid.x} y={mid.y} text={mLabel(dist(pa, pb))} fontSize={11.5 / scale} fill="#0f172a" stroke="#fff" strokeWidth={2.6 / scale} fillAfterStrokeEnabled offsetX={16 / scale} offsetY={6 / scale} listening={false} />
              </Group>
            );
          })}
        </Layer>

        {/* Paneller */}
        <Layer listening={mode === "panel-select"}>
          {doc.placed.map((p) => {
            const pp = panelPos(p);
            const sel = selPanels.has(p.id);
            return (
              <Group
                key={p.id}
                x={pp.x}
                y={pp.y}
                rotation={p.rotationDeg}
                draggable={mode === "panel-select"}
                onClick={(e) => { if (mode === "panel-select") togglePanel(p.id, e.evt.shiftKey); }}
                onTap={() => mode === "panel-select" && togglePanel(p.id, false)}
                onDragStart={() => {
                  const ids = selPanels.has(p.id) ? selPanels : new Set([p.id]);
                  if (!selPanels.has(p.id)) setSelPanels(new Set([p.id]));
                  const orig = new Map<string, Vec>();
                  doc.placed.forEach((q) => { if (ids.has(q.id)) orig.set(q.id, { x: q.x, y: q.y }); });
                  panelDragRef.current = { id: p.id, orig };
                  setPanelDelta({ x: 0, y: 0 });
                }}
                onDragMove={(e) => {
                  const o = panelDragRef.current?.orig.get(p.id);
                  if (o) setPanelDelta({ x: e.target.x() - o.x, y: e.target.y() - o.y });
                }}
                onDragEnd={(e) => {
                  const ref = panelDragRef.current;
                  const o = ref?.orig.get(p.id);
                  const delta = o ? { x: e.target.x() - o.x, y: e.target.y() - o.y } : { x: 0, y: 0 };
                  update((d) => {
                    d.placed = d.placed.map((q) => (ref?.orig.has(q.id) ? { ...q, x: (ref.orig.get(q.id)!.x) + delta.x, y: (ref.orig.get(q.id)!.y) + delta.y } : q));
                  }, true);
                  panelDragRef.current = null;
                  setPanelDelta(null);
                }}
              >
                {(() => {
                  const fr = Math.min(p.w, p.h) * 0.05;
                  const iw = p.w - 2 * fr, ih = p.h - 2 * fr;
                  return (
                    <>
                      {/* Beyaz çerçeve (dış) */}
                      <Rect width={p.w} height={p.h} fill="#ffffff" cornerRadius={0.5} stroke={sel ? "#f59e0b" : undefined} strokeWidth={(sel ? 2 : 0) / scale} />
                      {/* Koyu panel (iç) */}
                      <Rect x={fr} y={fr} width={iw} height={ih} fill="#0b1e3f" opacity={0.94} listening={false} />
                      <Rect x={fr + iw / 2} y={fr} width={0.3 / scale} height={ih} fill="#1e3a8a" listening={false} />
                      <Rect x={fr} y={fr + ih / 3} width={iw} height={0.3 / scale} fill="#1e3a8a" listening={false} />
                      <Rect x={fr} y={fr + (ih * 2) / 3} width={iw} height={0.3 / scale} fill="#1e3a8a" listening={false} />
                    </>
                  );
                })()}
              </Group>
            );
          })}
        </Layer>

        {/* Noktalar */}
        {(mode === "roof-select" || mode === "draw") && (
          <Layer>
            {doc.nodes.map((n) => {
              const p = nodePos(n);
              const active = n.id === selectedNodeId || n.id === activeNode;
              return (
                <Group key={n.id}>
                  <Circle
                    x={p.x}
                    y={p.y}
                    radius={5 / scale}
                    fill={active ? "#059669" : "#fff"}
                    stroke="#059669"
                    strokeWidth={2 / scale}
                    draggable={mode === "roof-select"}
                    onClick={() => { if (mode === "roof-select") { onSelectNode(n.id); onSelectFace(null); } }}
                    onTap={() => mode === "roof-select" && onSelectNode(n.id)}
                    onDragMove={(e) => { const sp = snappedPoint({ x: e.target.x(), y: e.target.y() }, n.id); e.target.position(sp); setNodeDrag({ id: n.id, point: sp }); }}
                    onDragEnd={(e) => nodeDragEnd(n.id, { x: e.target.x(), y: e.target.y() })}
                    onContextMenu={(e) => { e.evt.preventDefault(); if (mode === "roof-select") deleteNode(n.id); }}
                  />
                  {n.z ? (
                    <Text x={p.x} y={p.y} text={`${n.z} m`} fontSize={10.5 / scale} fill="#7c3aed" stroke="#fff" strokeWidth={2.2 / scale} fillAfterStrokeEnabled offsetX={-7 / scale} offsetY={14 / scale} listening={false} />
                  ) : null}
                </Group>
              );
            })}
          </Layer>
        )}

        {/* Geçici: çizim önizleme + kalibrasyon */}
        <Layer listening={false}>
          {mode === "draw" && activeNode && cursor && nodeById.get(activeNode) && (
            <>
              <Line points={[nodePos(nodeById.get(activeNode)!).x, nodePos(nodeById.get(activeNode)!).y, cursor.x, cursor.y]} stroke="#059669" strokeWidth={1.4 / scale} dash={[6 / scale, 4 / scale]} />
              {doc.metersPerPixel && (
                <Text x={cursor.x} y={cursor.y} text={mLabel(dist(nodePos(nodeById.get(activeNode)!), cursor))} fontSize={11.5 / scale} fill="#065f46" stroke="#fff" strokeWidth={2.4 / scale} fillAfterStrokeEnabled offsetY={-8 / scale} />
              )}
            </>
          )}
          {/* Çizgi üstü hayalet nokta — imleç kenardayken belirir, tıklayınca nokta olur. */}
          {edgeGhost && (
            <>
              <Circle x={edgeGhost.x} y={edgeGhost.y} radius={8 / scale} stroke="#059669" strokeWidth={1.5 / scale} dash={[3 / scale, 3 / scale]} />
              <Circle x={edgeGhost.x} y={edgeGhost.y} radius={4 / scale} fill="#059669" opacity={0.85} />
            </>
          )}
        </Layer>
      </Stage>

      {img && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm">
          Tekerlek: yakınlaş · Boşluğu sürükle: kaydır
        </div>
      )}
    </div>
  );

  function snappedPoint(p: Vec, ignoreId: string): Vec {
    const h = snapHit(p, ignoreId);
    if (h.kind === "node") { const n = nodeById.get(h.id); return n ? { x: n.x, y: n.y } : p; }
    if (h.kind === "edge") return h.point;
    return p;
  }
}
