"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle, Rect, Text, Group } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/solar-design/store";
import type { Vec, DesignDoc } from "@/lib/solar-design/types";
import { dist, nearestOnSegment } from "@/lib/solar-design/geometry";
import { planarize } from "@/lib/solar-design/planarize";

export type MassMode = "draw" | "edit" | "move" | "view";

const SNAP_SCREEN = 12;
function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `n${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}
/** Bir önceki noktaya göre yatay/dikey hizaya "kilitle" (8° tolerans). */
function orthoSnap(from: Vec, to: Vec): { p: Vec; ax: "h" | "v" | null } {
  const dx = to.x - from.x, dy = to.y - from.y;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const near = (t: number) => Math.abs(((ang - t + 540) % 360) - 180) < 8;
  if (near(0) || near(180)) return { p: { x: to.x, y: from.y }, ax: "h" };
  if (near(90) || near(-90)) return { p: { x: from.x, y: to.y }, ax: "v" };
  return { p: to, ax: null };
}

/**
 * 2B plan editörü. İki mod:
 *  • Footprint: kütlenin dış hattını çiz/düzenle/taşı (çatı 3B'de parametrik).
 *  • Elle çatı (roofEditable): çatı grafiğini (sırt/kırma çizgileri) sürükle/
 *    sil/ekle/çiz; köşeye tıklayıp yükseklik ver. Aurora benzeri.
 */
export default function MassEditor({ mode, dormerDraw }: { mode: MassMode; dormerDraw?: boolean }) {
  const doc = useDesignStore((s) => s.active)!;
  const update = useDesignStore((s) => s.update);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [cursor, setCursor] = useState<Vec | null>(null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [snapAxis, setSnapAxis] = useState<"h" | "v" | null>(null);
  const [dpts, setDpts] = useState<Vec[]>([]); // dormer 3-nokta çizim

  const active = doc.masses.find((m) => m.id === doc.activeMassId) || null;
  const editingRoof = !!active?.roofEditable;
  const fp = active?.footprint ?? [];
  const rn = active?.roofNodes ?? [];
  const re = active?.roofEdges ?? [];
  const mpp = doc.metersPerPixel;
  const snapPx = SNAP_SCREEN / scale;
  const nodeById = new Map(rn.map((n) => [n.id, n]));

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- altlık görüntüsünü yükle (dış kaynak)
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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mod/kütle değişince seçim sıfırla (dış senkronizasyon)
  useEffect(() => { setChainId(null); setSelNode(null); }, [mode, doc.activeMassId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- dormer çizim kapanınca yarım noktaları sil
  useEffect(() => { if (!dormerDraw) setDpts([]); }, [dormerDraw]);

  const relPos = (): Vec | null => {
    const p = stageRef.current?.getRelativePointerPosition();
    return p ? { x: p.x, y: p.y } : null;
  };

  // ── Footprint yazma ──
  function setFootprint(mut: (arr: Vec[]) => Vec[], history = true) {
    if (!active) return;
    update((d) => { const m = d.masses.find((x) => x.id === active.id); if (m) m.footprint = mut(m.footprint.map((p) => ({ ...p }))); }, history);
  }
  function moveDormer(id: string, x: number, y: number) {
    if (!active) return;
    update((d) => { const m = d.masses.find((mm) => mm.id === active.id); const dm = m?.dormers.find((x2) => x2.id === id); if (dm) { dm.x = x; dm.y = y; } }, true);
  }
  // 3 nokta: p1 (arka/tepe) → p2 (ön/oluk) omurga; p3 genişlik. Taban çatıya hizalı.
  function addDormerShape(p1: Vec, p2: Vec, p3: Vec) {
    if (!active || !mpp) return;
    const sx = p2.x - p1.x, sy = p2.y - p1.y;
    const len = Math.hypot(sx, sy) || 1;
    const sAng = Math.atan2(sy, sx);
    const perpUnit = { x: Math.sin(sAng), y: -Math.cos(sAng) };
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const perpPx = Math.abs((p3.x - mid.x) * perpUnit.x + (p3.y - mid.y) * perpUnit.y) || len * 0.4;
    const dirDeg = (sAng * 180) / Math.PI - 90;
    update((d) => {
      const m = d.masses.find((mm) => mm.id === active.id);
      if (m) m.dormers.push({ id: genId(), x: mid.x, y: mid.y, widthM: 2 * perpPx * mpp, depthM: len * mpp, ridgeM: 1, dirDeg, type: "hip" });
    }, true);
    setDpts([]);
  }
  // ── Çatı grafiği yazma (planarize ile) ──
  function setRoof(mut: (g: { nodes: typeof rn; edges: typeof re }) => void, history = true) {
    if (!active) return;
    update((d) => {
      const m = d.masses.find((x) => x.id === active.id);
      if (!m) return;
      const g = { nodes: m.roofNodes.map((n) => ({ ...n })), edges: m.roofEdges.map((e) => ({ ...e })) };
      mut(g);
      const tmp = { nodes: g.nodes, edges: g.edges } as unknown as DesignDoc;
      planarize(tmp);
      m.roofNodes = tmp.nodes;
      m.roofEdges = tmp.edges;
    }, history);
  }

  // Yakalama: yakın nokta / kenar / boş
  function snap(p: Vec, ignore?: string): { kind: "node"; id: string } | { kind: "edge"; id: string; point: Vec } | { kind: "free"; point: Vec } {
    let bn: string | null = null, bd = snapPx;
    for (const n of rn) { if (n.id === ignore) continue; const d = dist(p, n); if (d <= bd) { bd = d; bn = n.id; } }
    if (bn) return { kind: "node", id: bn };
    let be = snapPx, bestE: { id: string; point: Vec } | null = null;
    for (const e of re) { if (ignore && (e.a === ignore || e.b === ignore)) continue; const a = nodeById.get(e.a), b = nodeById.get(e.b); if (!a || !b) continue; const r = nearestOnSegment(p, a, b); if (r.dist <= be) { be = r.dist; bestE = { id: e.id, point: r.point }; } }
    if (bestE) return { kind: "edge", id: bestE.id, point: bestE.point };
    return { kind: "free", point: p };
  }
  function splitEdge(g: { nodes: typeof rn; edges: typeof re }, edgeId: string, point: Vec): string {
    const e = g.edges.find((x) => x.id === edgeId);
    if (!e) return "";
    const az = g.nodes.find((n) => n.id === e.a)?.z ?? 0, bz = g.nodes.find((n) => n.id === e.b)?.z ?? 0;
    const id = genId();
    g.nodes.push({ id, x: point.x, y: point.y, z: (az + bz) / 2 });
    g.edges = g.edges.filter((x) => x.id !== edgeId);
    g.edges.push({ id: genId(), a: e.a, b: id }, { id: genId(), a: id, b: e.b });
    return id;
  }

  function stageClick() {
    if (!active) return;
    const p = relPos();
    if (!p) return;
    if (dormerDraw) {
      if (dpts.length < 2) setDpts([...dpts, p]);
      else addDormerShape(dpts[0], dpts[1], p);
      return;
    }
    if (editingRoof) {
      if (mode !== "draw") return;
      const hit = snap(p);
      const prev = chainId;
      let newId = "";
      setRoof((g) => {
        let targetId: string;
        if (hit.kind === "node") targetId = hit.id;
        else if (hit.kind === "edge") targetId = splitEdge(g, hit.id, hit.point);
        else { targetId = genId(); g.nodes.push({ id: targetId, x: p.x, y: p.y, z: 0 }); }
        if (prev && prev !== targetId && !g.edges.some((e) => (e.a === prev && e.b === targetId) || (e.a === targetId && e.b === prev))) g.edges.push({ id: genId(), a: prev, b: targetId });
        newId = targetId;
      });
      setChainId(newId || prev);
      return;
    }
    // footprint çizim (dik snap)
    if (mode !== "draw") return;
    if (fp.length >= 3 && dist(p, fp[0]) <= snapPx) return;
    const sp = fp.length > 0 ? orthoSnap(fp[fp.length - 1], p).p : p;
    setFootprint((arr) => [...arr, sp]);
  }
  function stageMouseMove() {
    if (dormerDraw) { setCursor(relPos()); return; }
    if (mode !== "draw") { return; }
    const raw = relPos();
    if (!raw) { setCursor(null); return; }
    if (!editingRoof && fp.length > 0) { const s = orthoSnap(fp[fp.length - 1], raw); setCursor(s.p); setSnapAxis(s.ax); }
    else { setCursor(raw); setSnapAxis(null); }
  }

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (mode === "draw" && (e.key === "Enter" || e.key === "Escape")) { setChainId(null); setCursor(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const mLabel = (px: number) => (mpp ? `${(px * mpp).toFixed(2)} m` : `${Math.round(px)} px`);
  const draggableStage = (mode === "edit" || mode === "view") && !dormerDraw;
  const others = useMemo(() => doc.masses.filter((m) => m.id !== doc.activeMassId), [doc.masses, doc.activeMassId]);
  const selNodeObj = rn.find((n) => n.id === selNode) || null;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-100">
      {!img && <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-sm text-slate-400">Önce “Görüntü &amp; Ölçek” sekmesinden altlık ekleyin.</div>}
      {!active && <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow">Sağdan “Kütle” ile bir bina kütlesi oluşturun.</div>}
      {mode === "draw" && active && <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow">{editingRoof ? "Çatı çizgisi çiz: köşelere/çizgilere tıkla (Esc bitir)" : `Köşeleri tıkla · ilk köşeye dönünce kapanır (${fp.length})`}</div>}
      {mode === "move" && active && !dormerDraw && <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow">Kütleyi sürükleyerek taşı</div>}
      {dormerDraw && active && <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow">Dormer çiz: 1) arka/tepe → 2) ön/oluk → 3) genişlik ({Math.min(dpts.length, 3)}/3)</div>}
      {editingRoof && mode !== "move" && (
        <div className="absolute left-2 top-2 z-20 max-w-[240px] rounded-lg bg-white/95 p-2.5 text-[11px] leading-relaxed text-slate-600 shadow ring-1 ring-slate-200">
          <p className="mb-1 font-semibold text-blue-700">Çatı çizgilerini düzenle</p>
          <p>• Köşeyi <b>sürükle</b> → çizgiyi taşı</p>
          <p>• Köşeye <b>tıkla</b> → sağ üstte <b>yükseklik</b> gir</p>
          <p>• Çizgiye <b>çift tık</b> → köşe ekle · <b>sağ tık</b> → sil</p>
          <p>• <b>Hat Çiz</b> aracı → yeni çizgi / fold çiz</p>
        </div>
      )}
      {!editingRoof && active && fp.length >= 3 && mode !== "draw" && (
        <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow">
          Çatı çizgilerini düzenlemek için üstteki mavi “Çatıyı Düzenle”ye bas
        </div>
      )}

      {/* Seçili çatı noktası yükseklik girişi */}
      {editingRoof && selNodeObj && (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px] shadow ring-1 ring-slate-200">
          <span className="font-medium text-slate-600">Nokta yüksekliği</span>
          <input type="number" step="0.1" value={selNodeObj.z}
            onChange={(e) => { const z = Math.round((parseFloat(e.target.value) || 0) * 10) / 10; setRoof((g) => { const n = g.nodes.find((x) => x.id === selNode); if (n) n.z = z; }, false); }}
            className="h-8 w-20 rounded border border-slate-300 px-2" />
          <span className="text-slate-500">m</span>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={size.w} height={size.h} scaleX={scale} scaleY={scale} x={pos.x} y={pos.y}
        draggable={draggableStage}
        onDragEnd={(e) => { if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() }); }}
        onWheel={onWheel} onClick={stageClick} onTap={stageClick} onMouseMove={stageMouseMove}
        style={{ background: "#e2e8f0", cursor: dormerDraw || mode === "draw" ? "crosshair" : mode === "move" ? "move" : "default" }}
      >
        <Layer>{img && <KonvaImage image={img} listening={false} />}</Layer>

        {/* Diğer kütleler — salt-okunur */}
        <Layer listening={false}>
          {others.map((m) => m.footprint.length >= 2 ? (
            <Line key={m.id} points={m.footprint.flatMap((p) => [p.x, p.y])} closed={m.footprint.length >= 3} stroke="#94a3b8" strokeWidth={1.4 / scale} fill="#94a3b833" dash={[6 / scale, 4 / scale]} />
          ) : null)}
        </Layer>

        {editingRoof ? (
          /* ── Elle çatı grafiği ── */
          <Layer>
            {/* footprint referans */}
            {fp.length >= 3 && <Line points={fp.flatMap((p) => [p.x, p.y])} closed stroke="#94a3b8" strokeWidth={1.2 / scale} dash={[4 / scale, 4 / scale]} listening={false} />}
            {mode === "move" ? (
              <Group draggable onDragEnd={(e) => { const g = e.target; const dx = g.x(), dy = g.y(); g.position({ x: 0, y: 0 }); setRoof((gr) => { gr.nodes = gr.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })); }); }}>
                {re.map((e) => { const a = nodeById.get(e.a), b = nodeById.get(e.b); return a && b ? <Line key={e.id} points={[a.x, a.y, b.x, b.y]} stroke="#059669" strokeWidth={2 / scale} /> : null; })}
                {rn.map((n) => <Circle key={n.id} x={n.x} y={n.y} radius={4 / scale} fill="#059669" listening={false} />)}
              </Group>
            ) : (
              <>
                {re.map((e) => {
                  const a = nodeById.get(e.a), b = nodeById.get(e.b);
                  if (!a || !b) return null;
                  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                  return (
                    <Group key={e.id}>
                      <Line points={[a.x, a.y, b.x, b.y]} stroke="#2563eb" strokeWidth={2 / scale} hitStrokeWidth={12 / scale}
                        onDblClick={() => { if (mode !== "edit") return; const p = relPos(); if (!p) return; const r = nearestOnSegment(p, a, b); setRoof((g) => { splitEdge(g, e.id, r.point); }); }}
                        onContextMenu={(ev) => { ev.evt.preventDefault(); if (mode === "edit") setRoof((g) => { g.edges = g.edges.filter((x) => x.id !== e.id); }); }} />
                      {mpp && <Text x={mid.x} y={mid.y} text={mLabel(dist(a, b))} fontSize={10.5 / scale} fill="#1e3a8a" stroke="#fff" strokeWidth={2.4 / scale} fillAfterStrokeEnabled offsetX={14 / scale} offsetY={6 / scale} listening={false} />}
                    </Group>
                  );
                })}
                {rn.map((n) => (
                  <Group key={n.id}>
                    <Circle x={n.x} y={n.y} radius={5 / scale} fill={n.id === selNode ? "#f59e0b" : "#059669"} stroke="#fff" strokeWidth={1.6 / scale}
                      draggable={mode === "edit"}
                      onClick={() => setSelNode(n.id)} onTap={() => setSelNode(n.id)}
                      onDragMove={(e) => setRoof((g) => { const t = g.nodes.find((x) => x.id === n.id); if (t) { t.x = e.target.x(); t.y = e.target.y(); } }, false)}
                      onDragEnd={(e) => setRoof((g) => { const t = g.nodes.find((x) => x.id === n.id); if (t) { t.x = e.target.x(); t.y = e.target.y(); } })}
                      onContextMenu={(e) => { e.evt.preventDefault(); if (mode === "edit") { setRoof((g) => { g.nodes = g.nodes.filter((x) => x.id !== n.id); g.edges = g.edges.filter((x) => x.a !== n.id && x.b !== n.id); }); setSelNode(null); } }} />
                    {n.z ? <Text x={n.x} y={n.y} text={`${n.z.toFixed(1)} m`} fontSize={10 / scale} fill="#7c3aed" stroke="#fff" strokeWidth={2.2 / scale} fillAfterStrokeEnabled offsetX={-7 / scale} offsetY={13 / scale} listening={false} /> : null}
                  </Group>
                ))}
              </>
            )}
          </Layer>
        ) : (
          /* ── Footprint ── */
          <Layer>
            {mode === "move" && fp.length >= 2 ? (
              <Group draggable onDragEnd={(e) => { const g = e.target; const dx = g.x(), dy = g.y(); g.position({ x: 0, y: 0 }); setFootprint((arr) => arr.map((p) => ({ x: p.x + dx, y: p.y + dy }))); }}>
                <Line points={fp.flatMap((p) => [p.x, p.y])} closed={fp.length >= 3} stroke="#f59e0b" strokeWidth={2.5 / scale} fill="#f59e0b22" />
                {fp.map((p, i) => <Circle key={`mv${i}`} x={p.x} y={p.y} radius={4 / scale} fill="#f59e0b" listening={false} />)}
              </Group>
            ) : (
              <>
                {fp.length >= 2 && <Line points={fp.flatMap((p) => [p.x, p.y])} closed={fp.length >= 3} stroke="#059669" strokeWidth={2 / scale} fill="#05966922" />}
                {fp.length >= 2 && fp.map((a, i) => {
                  const b = fp[(i + 1) % fp.length];
                  if (i === fp.length - 1 && fp.length < 3) return null;
                  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                  return <Text key={`m${i}`} x={mid.x} y={mid.y} text={mLabel(dist(a, b))} fontSize={11.5 / scale} fill="#0f172a" stroke="#fff" strokeWidth={2.6 / scale} fillAfterStrokeEnabled offsetX={16 / scale} offsetY={6 / scale} listening={false} />;
                })}
                {(mode === "edit" || mode === "draw") && fp.map((p, i) => (
                  <Circle key={`v${i}`} x={p.x} y={p.y} radius={5 / scale} fill={i === 0 && mode === "draw" ? "#f59e0b" : "#059669"} stroke="#fff" strokeWidth={1.6 / scale}
                    draggable={mode === "edit"}
                    onDragMove={(e) => setFootprint((arr) => { arr[i] = { x: e.target.x(), y: e.target.y() }; return arr; }, false)}
                    onDragEnd={(e) => setFootprint((arr) => { arr[i] = { x: e.target.x(), y: e.target.y() }; return arr; }, true)}
                    onContextMenu={(e) => { e.evt.preventDefault(); if (mode === "edit" && fp.length > 3) setFootprint((arr) => arr.filter((_, k) => k !== i)); }} />
                ))}
                {mode === "edit" && fp.length >= 3 && fp.map((a, i) => {
                  const b = fp[(i + 1) % fp.length];
                  return <Line key={`e${i}`} points={[a.x, a.y, b.x, b.y]} stroke="transparent" strokeWidth={0.1} hitStrokeWidth={12 / scale}
                    onDblClick={() => { const p = relPos(); if (!p) return; const rr = nearestOnSegment(p, a, b); setFootprint((arr) => { arr.splice(i + 1, 0, rr.point); return arr; }); }} />;
                })}
              </>
            )}
          </Layer>
        )}

        {/* Dormerlar — sürükleyerek konumla */}
        {active && mpp && active.dormers.length > 0 && (
          <Layer>
            {active.dormers.map((dm) => {
              const hw = dm.widthM / 2 / mpp, hd = dm.depthM / 2 / mpp;
              return (
                <Group key={dm.id} x={dm.x} y={dm.y} rotation={dm.dirDeg || 0} draggable={mode === "edit" || mode === "move"} onDragEnd={(e) => moveDormer(dm.id, e.target.x(), e.target.y())}>
                  <Rect x={-hw} y={-hd} width={hw * 2} height={hd * 2} fill="#7c3aed22" stroke="#7c3aed" strokeWidth={1.6 / scale} />
                  {dm.type === "hip" ? (
                    <>
                      <Line points={[-hw * 0.35, 0, hw * 0.35, 0]} stroke="#7c3aed" strokeWidth={1.3 / scale} dash={[4 / scale, 3 / scale]} listening={false} />
                      <Line points={[-hw, -hd, -hw * 0.35, 0, -hw, hd]} stroke="#7c3aed" strokeWidth={1 / scale} dash={[3 / scale, 3 / scale]} listening={false} />
                      <Line points={[hw, -hd, hw * 0.35, 0, hw, hd]} stroke="#7c3aed" strokeWidth={1 / scale} dash={[3 / scale, 3 / scale]} listening={false} />
                    </>
                  ) : (
                    <Line points={dm.type === "gable" ? [-hw, 0, hw, 0] : [-hw, -hd, hw, -hd]} stroke="#7c3aed" strokeWidth={1.3 / scale} dash={[4 / scale, 3 / scale]} listening={false} />
                  )}
                  <Text text="dormer" fontSize={10 / scale} fill="#5b21b6" stroke="#fff" strokeWidth={2.2 / scale} fillAfterStrokeEnabled offsetX={16 / scale} offsetY={5 / scale} listening={false} />
                </Group>
              );
            })}
          </Layer>
        )}

        {/* Dormer 3-nokta çizim önizleme */}
        {dormerDraw && (
          <Layer listening={false}>
            {dpts.length >= 1 && cursor && <Line points={[...dpts.flatMap((p) => [p.x, p.y]), cursor.x, cursor.y]} stroke="#7c3aed" strokeWidth={1.4 / scale} dash={[5 / scale, 4 / scale]} />}
            {dpts.length === 2 && cursor && (() => {
              const p1 = dpts[0], p2 = dpts[1];
              const sAng = Math.atan2(p2.y - p1.y, p2.x - p1.x);
              const pu = { x: Math.sin(sAng), y: -Math.cos(sAng) };
              const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
              const perp = (cursor.x - mid.x) * pu.x + (cursor.y - mid.y) * pu.y;
              const c = [[p1.x + pu.x * perp, p1.y + pu.y * perp], [p2.x + pu.x * perp, p2.y + pu.y * perp], [p2.x - pu.x * perp, p2.y - pu.y * perp], [p1.x - pu.x * perp, p1.y - pu.y * perp]];
              return <Line points={c.flat()} closed stroke="#7c3aed" strokeWidth={1.4 / scale} fill="#7c3aed22" dash={[5 / scale, 4 / scale]} />;
            })()}
            {dpts.map((p, i) => <Circle key={`dp${i}`} x={p.x} y={p.y} radius={5 / scale} fill="#7c3aed" stroke="#fff" strokeWidth={1.5 / scale} />)}
          </Layer>
        )}

        {/* Çizim önizleme */}
        <Layer listening={false}>
          {mode === "draw" && cursor && !editingRoof && fp.length > 0 && (
            <>
              <Line points={[-100000, fp[fp.length - 1].y, 100000, fp[fp.length - 1].y]} stroke={snapAxis === "h" ? "#d946ef" : "#cbd5e1"} strokeWidth={(snapAxis === "h" ? 1.4 : 0.8) / scale} dash={[8 / scale, 6 / scale]} />
              <Line points={[fp[fp.length - 1].x, -100000, fp[fp.length - 1].x, 100000]} stroke={snapAxis === "v" ? "#d946ef" : "#cbd5e1"} strokeWidth={(snapAxis === "v" ? 1.4 : 0.8) / scale} dash={[8 / scale, 6 / scale]} />
              <Line points={[fp[fp.length - 1].x, fp[fp.length - 1].y, cursor.x, cursor.y]} stroke={snapAxis ? "#d946ef" : "#059669"} strokeWidth={1.6 / scale} dash={[6 / scale, 4 / scale]} />
            </>
          )}
          {mode === "draw" && cursor && !editingRoof && fp.length >= 3 && dist(cursor, fp[0]) <= snapPx && (
            <Circle x={fp[0].x} y={fp[0].y} radius={9 / scale} stroke="#f59e0b" strokeWidth={2 / scale} />
          )}
          {mode === "draw" && cursor && editingRoof && chainId && nodeById.get(chainId) && (
            <Line points={[nodeById.get(chainId)!.x, nodeById.get(chainId)!.y, cursor.x, cursor.y]} stroke="#2563eb" strokeWidth={1.4 / scale} dash={[6 / scale, 4 / scale]} />
          )}
        </Layer>
      </Stage>

      {img && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm">
          {editingRoof ? "Mavi = çatı çizgileri · köşe sürükle · çift tık: ekle · sağ tık: sil · köşeye tıkla: yükseklik" : "Tekerlek: yakınlaş · Boşluğu sürükle: kaydır"}
        </div>
      )}
    </div>
  );
}
