"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle, Rect, Text, Group } from "react-konva";
import type Konva from "konva";
import { useDesignStore } from "@/lib/solar-design/store";
import type { Vec, RNode, DesignDoc, Dormer } from "@/lib/solar-design/types";
import { FACE_COLORS } from "@/lib/solar-design/types";
import { dist, nearestOnSegment, pointInPolygon } from "@/lib/solar-design/geometry";
import { detectFaces } from "@/lib/solar-design/faces";
import { planarize } from "@/lib/solar-design/planarize";
import { massRoof, dormerRoofFaces } from "@/lib/solar-design/roof-model";
import { toast } from "sonner";

export type EditorMode = "draw" | "roof-select" | "panel-select" | "view";

/** Panelin dünya köşeleri (grup orijini x,y etrafında dönmüş dörtgen). */
function panelCorners(p: { x: number; y: number; w: number; h: number; rotationDeg: number }): Vec[] {
  const rad = (p.rotationDeg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  return ([[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]] as const).map(([lx, ly]) => ({ x: p.x + lx * c - ly * s, y: p.y + lx * s + ly * c }));
}

/** Dormer'ın 2B görünümü: dış hat + iç sırt/mahya (eğim) çizgileri (px). */
function dormerLines2D(dm: Dormer, mpp: number): { outline: Vec[]; creases: [Vec, Vec][]; center: Vec } {
  const hw = dm.widthM / 2 / mpp, hd = dm.depthM / 2 / mpp;
  const ang = ((dm.dirDeg || 0) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
  const W = (lx: number, ly: number): Vec => ({ x: dm.x + lx * ca - ly * sa, y: dm.y + lx * sa + ly * ca });
  const outline = [W(-hw, hd), W(hw, hd), W(hw, -hd), W(-hw, -hd)];
  const creases: [Vec, Vec][] = [];
  if (dm.type === "gable") {
    creases.push([W(0, hd), W(0, -hd)]); // sırt (tam boy)
  } else if (dm.type === "hip") {
    const rl = dm.ridgeHalfM != null ? Math.max(0, Math.min(hd * 0.95, dm.ridgeHalfM / mpp)) : hd * 0.6;
    creases.push([W(0, rl), W(0, -rl)]); // sırt
    creases.push([W(0, rl), W(-hw, hd)], [W(0, rl), W(hw, hd)], [W(0, -rl), W(-hw, -hd)], [W(0, -rl), W(hw, -hd)]); // mahyalar
  } else {
    creases.push([W(-hw, -hd), W(hw, -hd)]); // shed: yüksek kenar
  }
  return { outline, creases, center: { x: dm.x, y: dm.y } };
}

/** İki dışbükey dörtgen üst üste mi (SAT). Sadece temas ediyorsa (bitişik) üst üste sayılmaz. */
function polysOverlap(A: Vec[], B: Vec[]): boolean {
  const EPS = 0.5;
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const nx = -(b.y - a.y), ny = b.x - a.x; // kenar normali
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const q of A) { const d = q.x * nx + q.y * ny; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (const q of B) { const d = q.x * nx + q.y * ny; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      if (maxA <= minB + EPS || maxB <= minA + EPS) return false; // ayrık eksen → çakışma yok
    }
  }
  return true;
}

interface Props {
  mode: EditorMode;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  selectedFaceSig: string | null;
  onSelectFace: (sig: string | null) => void;
  obstacleMode?: boolean;
  addPanelMode?: boolean;
}

/** Panelin ekran (px) boyutu — oryantasyona göre. */
function panelPx(config: { widthMm: number; heightMm: number; orientation: string }, mpp: number): { w: number; h: number } {
  const a = config.widthMm / 1000 / mpp, b = config.heightMm / 1000 / mpp;
  return config.orientation === "portrait" ? { w: a, h: b } : { w: b, h: a };
}
/** Eksen-hizalı paneli komşularına gap (2cm) mesafesinde yapıştır. */
function snapPanel(cand: { x: number; y: number; w: number; h: number }, others: { x: number; y: number; w: number; h: number; rotationDeg: number }[], gap: number, thr: number): { x: number; y: number } {
  let bx = cand.x, by = cand.y, sx = false, sy = false;
  for (const q of others) {
    if (q.rotationDeg) continue;
    if (!sy && Math.abs(cand.y - q.y) <= thr) { by = q.y; sy = true; }
    else if (!sy && Math.abs(cand.y - (q.y + q.h + gap)) <= thr) { by = q.y + q.h + gap; sy = true; }
    else if (!sy && Math.abs((cand.y + cand.h + gap) - q.y) <= thr) { by = q.y - cand.h - gap; sy = true; }
    if (!sx && Math.abs(cand.x - q.x) <= thr) { bx = q.x; sx = true; }
    else if (!sx && Math.abs(cand.x - (q.x + q.w + gap)) <= thr) { bx = q.x + q.w + gap; sx = true; }
    else if (!sx && Math.abs((cand.x + cand.w + gap) - q.x) <= thr) { bx = q.x - cand.w - gap; sx = true; }
  }
  return { x: bx, y: by };
}

const SNAP_SCREEN = 12;

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `n${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

type Hit = { kind: "node"; id: string } | { kind: "edge"; edgeId: string; point: Vec } | { kind: "free"; point: Vec };

export default function CanvasEditor({ mode, selectedNodeId, onSelectNode, selectedFaceSig, onSelectFace, obstacleMode, addPanelMode }: Props) {
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

  // Engel (baca) çizimi — serbest çokgen
  const [obsPoints, setObsPoints] = useState<Vec[]>([]);
  const [selObstacle, setSelObstacle] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // Panel seçim + sürükleme
  const [selPanels, setSelPanels] = useState<Set<string>>(new Set());
  const [panelDelta, setPanelDelta] = useState<Vec | null>(null);
  const [dragOrig, setDragOrig] = useState<{ id: string; orig: Map<string, Vec> } | null>(null); // render için (ref render'da okunamaz)
  const panelDragRef = useRef<{ id: string; orig: Map<string, Vec> } | null>(null);

  const nodeById = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc.nodes]);
  const faces = useMemo(() => detectFaces(doc.nodes, doc.edges), [doc.nodes, doc.edges]);
  // Kütle çatı yüzeyleri — dormer dahil TEK bina; hepsi "Çatı N" olarak birleşik numaralanır.
  const massFaces = useMemo(
    () => doc.masses.flatMap((m) => {
      const mppv = doc.metersPerPixel || 0.05;
      const roofF = massRoof(m, mppv).faces;
      const dormF = m.dormers.flatMap((dm) => dormerRoofFaces(dm, m.baseM + m.wallM, m.pitchDeg, mppv));
      return [...roofF, ...dormF].map((f, i) => ({ id: `${m.id}:${f.id}`, name: `Çatı ${i + 1}`, poly: f.poly, isDormer: i >= roofF.length }));
    }),
    [doc.masses, doc.metersPerPixel],
  );
  // Dormer taban çokgenleri — 2B'de dormer ALTINDAKİ ana çatı çizgilerini gizlemek (clip) için.
  const dormerFoots = useMemo(
    () => doc.masses.flatMap((m) => m.dormers.filter((d) => d.widthM > 0 && d.depthM > 0).map((dm) => dormerLines2D(dm, doc.metersPerPixel || 0.05).outline)),
    [doc.masses, doc.metersPerPixel],
  );
  const facePolyById = useMemo(() => new Map(massFaces.map((f) => [f.id, f.poly])), [massFaces]);
  const insideFace = (corners: Vec[], faceId: string) => { const poly = facePolyById.get(faceId); return !poly || corners.every((c) => pointInPolygon(c, poly)); };

  useEffect(() => {
    activeRef.current = activeNode;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- çizim zinciri durumunu yansıt (dış senkronizasyon)
    setDrawing(!!activeNode);
  }, [activeNode]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mod değişince panel seçimini sıfırla (dış senkronizasyon)
  useEffect(() => { if (mode !== "panel-select") setSelPanels(new Set()); }, [mode]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- engel modu kapanınca yarım çizimi sıfırla
  useEffect(() => { if (!obstacleMode) setObsPoints([]); }, [obstacleMode]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- engel modu acilinca secimi birak
  useEffect(() => { if (obstacleMode || addPanelMode) setSelObstacle(null); }, [obstacleMode, addPanelMode]);
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

  const mppVal = doc.metersPerPixel || 0.05;
  const gapPx = doc.panelConfig.gapMm / 1000 / mppVal;

  function stageClick() {
    const p = relPos();
    if (!p) return;
    if (addPanelMode) { addPanelAt(p); return; }
    if (obstacleMode) {
      if (obsPoints.length >= 3 && dist(p, obsPoints[0]) <= snapPx) { finishObstacle(); return; }
      setObsPoints((arr) => [...arr, p]);
      return;
    }
    if (mode === "draw") { drawClick(p); return; }
  }

  function stageMouseMove() {
    if (mode === "draw" || mode === "roof-select" || obstacleMode || addPanelMode) setCursor(relPos());
    if (marquee) { const p = relPos(); if (p) setMarquee((m) => (m ? { ...m, x1: p.x, y1: p.y } : m)); }
  }
  function deleteObstacle(id: string) { update((d) => { d.obstacles = d.obstacles.filter((o) => o.id !== id); }, true); setSelObstacle(null); }
  function finishObstacle() {
    if (obsPoints.length >= 3) { const poly = obsPoints.map((p) => ({ ...p })); update((d) => { d.obstacles.push({ id: genId(), poly, heightM: 0.8 }); }, true); }
    setObsPoints([]);
  }

  function addPanelAt(p: Vec) {
    const face = massFaces.find((f) => pointInPolygon(p, f.poly));
    if (!face) { toast.error("Paneli çatı yüzeyine koy"); return; }
    const { w, h } = panelPx(doc.panelConfig, mppVal);
    const sp = snapPanel({ x: p.x - w / 2, y: p.y - h / 2, w, h }, doc.placed, gapPx, Math.max(gapPx * 4, 0.4 / mppVal));
    const cand = { id: genId(), face: face.id, x: sp.x, y: sp.y, w, h, rotationDeg: 0 };
    const corners = panelCorners(cand);
    if (!insideFace(corners, face.id)) return; // çatı sınırı dışına konmaz (sessiz)
    if (doc.placed.some((q) => polysOverlap(corners, panelCorners(q)))) return; // üst üste konmaz (sessiz)
    if (doc.obstacles.some((o) => polysOverlap(corners, o.poly))) return; // engel üstüne konmaz
    update((d) => { d.placed.push(cand); }, true);
  }

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

  // Klavye — fonksiyon tanımlarından sonra (use-before-declare olmasın)
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
      if (obstacleMode) {
        if (e.key === "Enter") { e.preventDefault(); finishObstacle(); }
        else if (e.key === "Escape") { e.preventDefault(); setObsPoints([]); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selPanels, selectedNodeId, obstacleMode, obsPoints]);

  const mLabel = (px: number) => (doc.metersPerPixel ? `${(px * doc.metersPerPixel).toFixed(2)} m` : `${Math.round(px)} px`);

  // Sürükleme override uygulanan node konumları
  const nodePos = (n: RNode): Vec => (nodeDrag && nodeDrag.id === n.id ? nodeDrag.point : { x: n.x, y: n.y });
  const panelPos = (p: { id: string; x: number; y: number }): Vec =>
    panelDelta && dragOrig && selPanels.has(p.id) && dragOrig.id !== p.id
      ? { x: (dragOrig.orig.get(p.id)?.x ?? p.x) + panelDelta.x, y: (dragOrig.orig.get(p.id)?.y ?? p.y) + panelDelta.y }
      : { x: p.x, y: p.y };

  // Tek çatı yüzeyi çizimi (panel adımı) — yeşil kesikli + "Çatı N · k panel".
  const renderMassFace = (f: { id: string; name: string; poly: Vec[] }) => {
    if (f.poly.length < 3) return null;
    const cx = f.poly.reduce((s, p) => s + p.x, 0) / f.poly.length;
    const cy = f.poly.reduce((s, p) => s + p.y, 0) / f.poly.length;
    const n = doc.placed.filter((pp) => pp.face === f.id).length;
    return (
      <Group key={f.id}>
        <Line points={f.poly.flatMap((p) => [p.x, p.y])} closed fill="#0596690f" stroke="#059669" strokeWidth={1.3 / scale} dash={[7 / scale, 4 / scale]} />
        <Text x={cx} y={cy} text={`${f.name} · ${n} panel`} fontSize={12 / scale} fill="#065f46" stroke="#fff" strokeWidth={2.8 / scale} fillAfterStrokeEnabled offsetX={34 / scale} offsetY={6 / scale} />
      </Group>
    );
  };
  // Ana çatı katmanı clip'i: tüm alan EKSİ dormer footprint'leri (delik). Dormer altındaki
  // ana-çatı çizgileri böylece görünmez → görsel olarak tek yüzey.
  const clipExcludeDormers = (ctx: Konva.Context) => {
    ctx.rect(-1e5, -1e5, 2e5, 2e5); // dış (CW)
    for (const fp of dormerFoots) {
      if (fp.length < 3) continue;
      ctx.moveTo(fp[0].x, fp[0].y); // delik = ters sarım (CCW)
      for (let i = fp.length - 1; i >= 1; i--) ctx.lineTo(fp[i].x, fp[i].y);
      ctx.closePath();
    }
  };

  const draggableStage = (mode === "roof-select" || mode === "view") && !obstacleMode && !addPanelMode;
  const cursorStyle = mode === "draw" || obstacleMode || addPanelMode ? "crosshair" : "default";

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
      {/* Engel modu bilgi */}
      {obstacleMode && (
        <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow">
          Baca/engel: köşeleri tıkla, ilk köşeye dönünce kapanır · Enter bitir · Esc iptal · varsayılan 80 cm
        </div>
      )}
      {addPanelMode && (
        <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow">
          Elle panel: çatı yüzeyine tıkla (komşuya 2 cm boşlukla yapışır)
        </div>
      )}
      {selObstacle && !obstacleMode && !addPanelMode && (() => {
        const o = doc.obstacles.find((x) => x.id === selObstacle);
        if (!o) return null;
        return (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12px] shadow ring-1 ring-slate-200">
            <span className="font-medium text-slate-600">Engel yüksekliği</span>
            <input type="number" step="0.1" value={o.heightM} onChange={(e) => { const h = parseFloat(e.target.value) || 0; update((d) => { const t = d.obstacles.find((x) => x.id === selObstacle); if (t) t.heightM = h; }, false); }} className="h-8 w-20 rounded border border-slate-300 px-2" />
            <span className="text-slate-500">m</span>
            <button type="button" onClick={() => deleteObstacle(selObstacle)} className="rounded bg-rose-50 px-2 py-1 font-medium text-rose-600 hover:bg-rose-100">Sil</button>
          </div>
        );
      })()}
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
        draggable={draggableStage && !nodeDrag && !dragOrig}
        onDragEnd={(e) => { if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() }); }}
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            if (mode === "roof-select") { onSelectNode(null); onSelectFace(null); }
            if (mode === "panel-select" && !obstacleMode && !addPanelMode) { setSelPanels(new Set()); const p = relPos(); if (p) setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }
            setSelObstacle(null);
          }
        }}
        onMouseUp={() => {
          if (!marquee) return;
          const x0 = Math.min(marquee.x0, marquee.x1), x1 = Math.max(marquee.x0, marquee.x1);
          const y0 = Math.min(marquee.y0, marquee.y1), y1 = Math.max(marquee.y0, marquee.y1);
          setMarquee(null);
          if (x1 - x0 < 3 && y1 - y0 < 3) return;
          const sel = new Set<string>();
          for (const p of doc.placed) { const c = panelCorners(p); const cx = (c[0].x + c[2].x) / 2, cy = (c[0].y + c[2].y) / 2; if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) sel.add(p.id); }
          setSelPanels(sel);
        }}
        onClick={stageClick}
        onTap={stageClick}
        onMouseMove={stageMouseMove}
        style={{ background: "#e2e8f0", cursor: cursorStyle }}
      >
        <Layer>{img && <KonvaImage image={img} listening={false} />}</Layer>

        {/* Kütle çatı yüzeyleri — panel yerleşiminde bina bağlamı (salt görsel).
            Ana çatı yüzeyleri dormer footprint'leri HARİÇ çizilir → dormer altındaki
            ana-çatı çizgileri gizlenir, TEK yüzey gibi görünür (görsel birleştirme). */}
        {mode === "panel-select" && (
          <>
            <Layer listening={false} clipFunc={dormerFoots.length ? clipExcludeDormers : undefined}>
              {massFaces.filter((f) => !f.isDormer).map(renderMassFace)}
            </Layer>
            <Layer listening={false}>
              {massFaces.filter((f) => f.isDormer).map(renderMassFace)}
            </Layer>
          </>
        )}

        {/* Dormer eğim/kırılım çizgileri — ana çatının parçası (ayrı obje değil, çatı stilinde) */}
        <Layer listening={false}>
          {doc.masses.flatMap((m) =>
            m.dormers.map((dm) => {
              if (dm.widthM <= 0 || dm.depthM <= 0) return null;
              const { outline, creases } = dormerLines2D(dm, doc.metersPerPixel || 0.05);
              return (
                <Group key={`${m.id}:${dm.id}`}>
                  <Line points={outline.flatMap((p) => [p.x, p.y])} closed stroke="#1e293b" strokeWidth={1.4 / scale} />
                  {creases.map((seg, i) => (
                    <Line key={i} points={[seg[0].x, seg[0].y, seg[1].x, seg[1].y]} stroke="#1e293b" strokeWidth={1.2 / scale} />
                  ))}
                </Group>
              );
            }),
          )}
        </Layer>

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
                  setDragOrig({ id: p.id, orig });
                  setPanelDelta({ x: 0, y: 0 });
                }}
                onDragMove={(e) => {
                  const o = panelDragRef.current?.orig.get(p.id);
                  if (o) setPanelDelta({ x: e.target.x() - o.x, y: e.target.y() - o.y });
                }}
                onDragEnd={(e) => {
                  const ref = panelDragRef.current;
                  const o = ref?.orig.get(p.id);
                  let delta = o ? { x: e.target.x() - o.x, y: e.target.y() - o.y } : { x: 0, y: 0 };
                  const movedIds = ref ? new Set(ref.orig.keys()) : new Set([p.id]);
                  // Tek panel taşındıysa komşuya gap (2cm) mesafesinde/hizasında yapıştır.
                  if (movedIds.size === 1 && p.rotationDeg === 0) {
                    const base = { x: (o?.x ?? p.x) + delta.x, y: (o?.y ?? p.y) + delta.y, w: p.w, h: p.h };
                    const sp = snapPanel(base, doc.placed.filter((q) => q.id !== p.id), gapPx, Math.max(gapPx * 4, 0.4 / mppVal));
                    delta = { x: sp.x - (o?.x ?? p.x), y: sp.y - (o?.y ?? p.y) };
                  }
                  const proposed = doc.placed.map((q) => (ref?.orig.has(q.id) ? { ...q, x: (ref.orig.get(q.id)!.x) + delta.x, y: (ref.orig.get(q.id)!.y) + delta.y } : q));
                  const others = proposed.filter((q) => !movedIds.has(q.id));
                  const clash = proposed.some((m) => movedIds.has(m.id) && others.some((q) => polysOverlap(panelCorners(m), panelCorners(q))));
                  const clashObs = proposed.some((m) => movedIds.has(m.id) && doc.obstacles.some((ob) => polysOverlap(panelCorners(m), ob.poly)));
                  const outBound = proposed.some((m) => movedIds.has(m.id) && !insideFace(panelCorners(m), m.face));
                  panelDragRef.current = null;
                  setDragOrig(null);
                  setPanelDelta(null);
                  if (clash || clashObs || outBound) return; // sessiz: eski konuma döner
                  update((d) => { d.placed = proposed; }, true);
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

        {/* Engeller (baca/pencere) */}
        <Layer>
          {doc.obstacles.map((o) => {
            const cx = o.poly.reduce((s, p) => s + p.x, 0) / o.poly.length;
            const cy = o.poly.reduce((s, p) => s + p.y, 0) / o.poly.length;
            return (
              <Group key={o.id}>
                <Line points={o.poly.flatMap((p) => [p.x, p.y])} closed fill={o.id === selObstacle ? "#ef444466" : "#ef444455"} stroke={o.id === selObstacle ? "#b91c1c" : "#dc2626"} strokeWidth={(o.id === selObstacle ? 2.4 : 1.6) / scale}
                  onClick={() => { if (!obstacleMode && !addPanelMode) setSelObstacle(o.id); }} onTap={() => { if (!obstacleMode && !addPanelMode) setSelObstacle(o.id); }}
                  onContextMenu={(e) => { e.evt.preventDefault(); deleteObstacle(o.id); }} />
                <Text x={cx} y={cy} text="engel" fontSize={10.5 / scale} fill="#991b1b" stroke="#fff" strokeWidth={2.4 / scale} fillAfterStrokeEnabled offsetX={13 / scale} offsetY={5 / scale} listening={false} />
              </Group>
            );
          })}
          {obstacleMode && obsPoints.length > 0 && (
            <>
              <Line points={[...obsPoints.flatMap((p) => [p.x, p.y]), ...(cursor ? [cursor.x, cursor.y] : [])]} stroke="#dc2626" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
              {obsPoints.map((p, i) => <Circle key={`op${i}`} x={p.x} y={p.y} radius={4 / scale} fill="#dc2626" listening={false} />)}
              {obsPoints.length >= 3 && cursor && dist(cursor, obsPoints[0]) <= snapPx && (
                <Circle x={obsPoints[0].x} y={obsPoints[0].y} radius={9 / scale} stroke="#dc2626" strokeWidth={2 / scale} listening={false} />
              )}
            </>
          )}
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
          {marquee && (
            <Rect x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)} width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)} fill="#2563eb18" stroke="#2563eb" strokeWidth={1.2 / scale} dash={[5 / scale, 4 / scale]} />
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
