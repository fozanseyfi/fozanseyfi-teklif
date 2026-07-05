"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Plus, Trash2, Undo2, Redo2, MousePointer2, PencilRuler, ArrowLeft, ArrowRight,
  LayoutGrid, Sun, Map as MapIcon, ImagePlus, Zap, CheckCircle2, Box, Lock, Unlock,
  Building2, Layers, Move, Spline, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDesignStore } from "@/lib/solar-design/store";
import { computeLayout, panelsKwp } from "@/lib/solar-design/layout-engine";
import { massRoof, faceAreaM2, seedRoofGraph, autoRoofHeights, generateRoof } from "@/lib/solar-design/roof-model";
import type { MassRoof } from "@/lib/solar-design/roof-model";
import { pointInPolygon } from "@/lib/solar-design/geometry";
import { DEFAULT_MASS } from "@/lib/solar-design/types";
import type { Mass, RoofType, PlacedPanel, Vec, Dormer } from "@/lib/solar-design/types";

const CanvasEditor = dynamic(() => import("./canvas-editor"), { ssr: false });
const MassEditor = dynamic(() => import("./mass-editor"), { ssr: false });
const MapPicker = dynamic(() => import("./map-picker"), { ssr: false });
const CropStep = dynamic(() => import("./crop-step"), { ssr: false });
const ThreeView = dynamic(() => import("./three-view"), { ssr: false });

type StepKey = "gorsel" | "cizim" | "panel" | "analiz";
const STEPS: { key: StepKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "gorsel", label: "Görüntü & Ölçek", icon: MapIcon },
  { key: "cizim", label: "Bina & Çatı", icon: Building2 },
  { key: "panel", label: "Panel Yerleşimi", icon: LayoutGrid },
  { key: "analiz", label: "Analiz", icon: Zap },
];

function newMassId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `m${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

/** Hazır bina/çatı taban şekilleri (birim koordinat; 1 birim ≈ 8 m). Tıkla-ekle. */
const SHAPE_TEMPLATES: { key: string; label: string; poly: Vec[] }[] = [
  { key: "rect", label: "Dikdörtgen", poly: [{ x: 0, y: 0 }, { x: 1.6, y: 0 }, { x: 1.6, y: 1 }, { x: 0, y: 1 }] },
  { key: "square", label: "Kare", poly: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
  { key: "long", label: "Uzun", poly: [{ x: 0, y: 0 }, { x: 2.6, y: 0 }, { x: 2.6, y: 0.7 }, { x: 0, y: 0.7 }] },
  { key: "skew", label: "Eğik", poly: [{ x: 0.35, y: 0 }, { x: 1.1, y: 0 }, { x: 0.75, y: 2.2 }, { x: 0, y: 2.2 }] },
  { key: "L", label: "L", poly: [{ x: 0, y: 0 }, { x: 1.5, y: 0 }, { x: 1.5, y: 0.6 }, { x: 0.6, y: 0.6 }, { x: 0.6, y: 1.4 }, { x: 0, y: 1.4 }] },
  { key: "T", label: "T", poly: [{ x: 0, y: 0 }, { x: 1.5, y: 0 }, { x: 1.5, y: 0.55 }, { x: 1, y: 0.55 }, { x: 1, y: 1.4 }, { x: 0.5, y: 1.4 }, { x: 0.5, y: 0.55 }, { x: 0, y: 0.55 }] },
  { key: "U", label: "U", poly: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.85 }, { x: 1, y: 0.85 }, { x: 1, y: 0 }, { x: 1.5, y: 0 }, { x: 1.5, y: 1.4 }, { x: 0, y: 1.4 }] },
  { key: "plus", label: "Artı", poly: [{ x: 0.35, y: 0 }, { x: 0.65, y: 0 }, { x: 0.65, y: 0.35 }, { x: 1, y: 0.35 }, { x: 1, y: 0.65 }, { x: 0.65, y: 0.65 }, { x: 0.65, y: 1 }, { x: 0.35, y: 1 }, { x: 0.35, y: 0.65 }, { x: 0, y: 0.65 }, { x: 0, y: 0.35 }, { x: 0.35, y: 0.35 }] },
  { key: "H", label: "H", poly: [{ x: 0, y: 0 }, { x: 0.3, y: 0 }, { x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }, { x: 0.7, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.7, y: 1 }, { x: 0.7, y: 0.6 }, { x: 0.3, y: 0.6 }, { x: 0.3, y: 1 }, { x: 0, y: 1 }] },
  { key: "hex", label: "6gen", poly: [{ x: 0.25, y: 0 }, { x: 0.75, y: 0 }, { x: 1, y: 0.5 }, { x: 0.75, y: 1 }, { x: 0.25, y: 1 }, { x: 0, y: 0.5 }] },
  { key: "oct", label: "8gen", poly: [{ x: 0.3, y: 0 }, { x: 0.7, y: 0 }, { x: 1, y: 0.3 }, { x: 1, y: 0.7 }, { x: 0.7, y: 1 }, { x: 0.3, y: 1 }, { x: 0, y: 0.7 }, { x: 0, y: 0.3 }] },
];

/** Dormer'ın çatı plan dörtgeni (px) — panel keepout için. */
export function dormerPoly(dm: Dormer, mpp: number): Vec[] {
  const hw = dm.widthM / 2 / mpp, hd = dm.depthM / 2 / mpp;
  return [{ x: dm.x - hw, y: dm.y - hd }, { x: dm.x + hw, y: dm.y - hd }, { x: dm.x + hw, y: dm.y + hd }, { x: dm.x - hw, y: dm.y + hd }];
}

/** Panelin dünya köşeleri (dönmüş dörtgen) — engel çakışma testi için. */
function panelCornersD(p: { x: number; y: number; w: number; h: number; rotationDeg: number }): Vec[] {
  const rad = (p.rotationDeg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  return ([[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]] as const).map(([lx, ly]) => ({ x: p.x + lx * c - ly * s, y: p.y + lx * s + ly * c }));
}
/** İki dışbükey çokgen üst üste mi (SAT). */
function polysOverlapD(A: Vec[], B: Vec[]): boolean {
  const EPS = 0.5;
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const nx = -(b.y - a.y), ny = b.x - a.x;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const q of A) { const d = q.x * nx + q.y * ny; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (const q of B) { const d = q.x * nx + q.y * ny; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      if (maxA <= minB + EPS || maxB <= minA + EPS) return false;
    }
  }
  return true;
}

/** Şablonun kırma (hip) çatı iç çizgileri (birim koordinat) — önizleme için. */
function templateRoofLines(poly: Vec[]): [Vec, Vec][] {
  try {
    const sc = poly.map((p) => ({ x: p.x * 100, y: p.y * 100 }));
    const model = generateRoof(sc, "hip", 30, 0, 3, 0.05);
    const seen = new Map<string, { a: Vec; b: Vec; n: number }>();
    const r = (v: number) => Math.round(v);
    const key = (a: Vec, b: Vec) => { const A = `${r(a.x)},${r(a.y)}`, B = `${r(b.x)},${r(b.y)}`; return A < B ? `${A}|${B}` : `${B}|${A}`; };
    for (const pl of model.planes) { const P = pl.poly; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const k = key(a, b); const e = seen.get(k); if (e) e.n++; else seen.set(k, { a, b, n: 1 }); } }
    return [...seen.values()].filter((e) => e.n >= 2).map((e) => [{ x: e.a.x / 100, y: e.a.y / 100 }, { x: e.b.x / 100, y: e.b.y / 100 }] as [Vec, Vec]);
  } catch { return []; }
}
const TEMPLATE_LINES: Record<string, [Vec, Vec][]> = Object.fromEntries(SHAPE_TEMPLATES.map((t) => [t.key, templateRoofLines(t.poly)]));

/** Şablonu 24×24 kutuya sığdırıp çizen küçük ikon (dış hat + kırma çatı çizgileri). */
function ShapeIcon({ poly, lines }: { poly: Vec[]; lines?: [Vec, Vec][] }) {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const w = maxx - minx || 1, h = maxy - miny || 1, s = 16 / Math.max(w, h);
  const T = (p: Vec) => ({ x: 4 + (p.x - minx) * s, y: 4 + (p.y - miny) * s });
  const pts = poly.map((p) => { const q = T(p); return `${q.x},${q.y}`; }).join(" ");
  return (
    <svg width={24} height={24} viewBox="0 0 24 24">
      <polygon points={pts} fill="#05966922" stroke="#059669" strokeWidth={1.3} />
      {(lines ?? []).map(([a, b], i) => { const p = T(a), q = T(b); return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#2563eb" strokeWidth={0.8} />; })}
    </svg>
  );
}

const CITY_YIELD: Record<string, number> = {
  Ankara: 1550, İstanbul: 1400, İzmir: 1600, Antalya: 1650, Konya: 1600, Adana: 1600, Bursa: 1450, Kayseri: 1600, Gaziantep: 1650, Mersin: 1650,
};
const PANEL_PRESETS = [
  { label: "550 W · 2278×1134", widthMm: 1134, heightMm: 2278, watt: 550 },
  { label: "500 W · 2094×1134", widthMm: 1134, heightMm: 2094, watt: 500 },
  { label: "600 W · 2384×1134", widthMm: 1134, heightMm: 2384, watt: 600 },
  { label: "450 W · 2094×1038", widthMm: 1038, heightMm: 2094, watt: 450 },
];

function fmt(n: number, d = 0) {
  return (n || 0).toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function DesignApp() {
  const { index, active, refreshIndex, createDesign, openDesign, removeDesign } = useDesignStore();
  useEffect(() => { refreshIndex(); }, [refreshIndex]);
  if (!active) return <DesignList index={index} onOpen={openDesign} onCreate={createDesign} onRemove={removeDesign} />;
  return <Editor />;
}

function DesignList({ index, onOpen, onCreate, onRemove }: {
  index: { id: string; name: string; address: string; updatedAt: string }[];
  onOpen: (id: string) => void;
  onCreate: (name: string, address: string, city: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Ankara");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="overflow-hidden border-emerald-200">
        <CardContent className="flex items-start gap-3 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><Sun className="size-5" /></div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">3D Tasarım</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Güneş Paneli Yerleşim Tasarımı</h1>
            <p className="mt-1 text-sm text-slate-600">Haritadan bina bul, çatıyı çiz (yükseklikli), 3B’de gör, panelleri yerleştir, analiz al.</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-semibold text-slate-800">Yeni Tasarım</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Proje adı</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Villa Çatı GES" /></div>
            <div className="space-y-1.5"><Label>Adres</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Mahalle / il" /></div>
            <div className="space-y-1.5">
              <Label>Şehir</Label>
              <Select value={city} onValueChange={setCity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(CITY_YIELD).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="flex justify-end"><Button onClick={() => { if (!name.trim()) { toast.error("Proje adı girin"); return; } onCreate(name, address, city); }}><Plus className="size-4" /> Oluştur & Aç</Button></div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Kayıtlı Tasarımlar</p>
        {index.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Henüz tasarım yok.</CardContent></Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {index.map((d) => (
              <Card key={d.id} className="transition-colors hover:border-emerald-300">
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <button type="button" onClick={() => onOpen(d.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold text-slate-900">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.address || "—"}</p>
                    <p className="text-[10.5px] text-slate-400">{new Date(d.updatedAt).toLocaleString("tr-TR")}</p>
                  </button>
                  <button type="button" onClick={() => onRemove(d.id)} className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Sil"><Trash2 className="size-4" /></button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Editor() {
  const doc = useDesignStore((s) => s.active)!;
  const update = useDesignStore((s) => s.update);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const close = useDesignStore((s) => s.close);
  const canUndo = useDesignStore((s) => s.past.length > 0);
  const canRedo = useDesignStore((s) => s.future.length > 0);

  const [step, setStep] = useState<StepKey>("gorsel");
  const [tool, setTool] = useState<"edit" | "draw" | "move">("edit"); // footprint: köşe düzenle / çiz / taşı
  const [cizimView, setCizimView] = useState<"2d" | "3d">("2d");
  const [panelView, setPanelView] = useState<"2d" | "3d">("2d");
  const [obstacleMode, setObstacleMode] = useState(false);
  const [addPanelMode, setAddPanelMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedFaceSig, setSelectedFaceSig] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState(true); // açılışta uydu haritası standart
  const [pending, setPending] = useState<{ dataUrl: string; mpp: number } | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- adım değişince aracı sıfırla (dış senkronizasyon)
  useEffect(() => { if (step !== "cizim") setTool("edit"); }, [step]);

  const mpp = doc.metersPerPixel;
  const locked = doc.locked;
  const totalPanels = doc.placed.length;
  const totalKwp = panelsKwp(totalPanels, doc.panelConfig.watt);
  const activeMass = doc.masses.find((m) => m.id === doc.activeMassId) || null;

  // Her kütle için çatı (parametrik ya da düzenlenebilir grafik) — birleşik.
  const built = useMemo(
    () => doc.masses.map((m) => ({ mass: m, roof: massRoof(m, mpp || 0.05) })),
    [doc.masses, mpp],
  );

  const activeFaces = useMemo(() => built.find((b) => b.mass.id === doc.activeMassId)?.roof.faces ?? [], [built, doc.activeMassId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- altlık boyutunu yükle + görüntü varsa haritayı kapat
    if (!doc.imageDataUrl) { setImgSize(null); return; }
    const im = new window.Image();
    im.onload = () => { setImgSize({ w: im.width, h: im.height }); setMapMode(false); };
    im.src = doc.imageDataUrl;
  }, [doc.imageDataUrl]);

  const setLocked = (v: boolean) => update((d) => { d.locked = v; });
  const updateActive = (mut: (m: Mass) => void) => update((d) => { const m = d.masses.find((x) => x.id === doc.activeMassId); if (m) mut(m); });
  function toggleRoofEdit() {
    update((d) => {
      const m = d.masses.find((x) => x.id === doc.activeMassId);
      if (!m) return;
      if (m.roofEditable) { m.roofEditable = false; m.roofNodes = []; m.roofEdges = []; }
      else { const g = seedRoofGraph(m, mpp || 0.05); m.roofNodes = g.nodes; m.roofEdges = g.edges; m.roofEditable = true; }
    }, true);
    setStep("cizim"); setCizimView("2d"); setTool("edit"); // düzenleme daima 2B'de görünür
  }
  function applyAutoHeights() {
    update((d) => {
      const m = d.masses.find((x) => x.id === doc.activeMassId);
      if (!m || !m.roofEditable) return;
      m.roofNodes = autoRoofHeights(m.roofNodes, m.roofEdges, m.pitchDeg, mpp || 0.05, m.facePitch);
    }, true);
    toast.success("Yükseklikler eğimden hesaplandı");
  }
  function setFacePitch(sig: string, deg: number) {
    update((d) => {
      const m = d.masses.find((x) => x.id === doc.activeMassId);
      if (!m) return;
      m.facePitch = { ...m.facePitch, [sig]: deg };
      if (m.roofEditable) m.roofNodes = autoRoofHeights(m.roofNodes, m.roofEdges, m.pitchDeg, mpp || 0.05, m.facePitch);
    }, true);
  }
  function addDormer() {
    update((d) => {
      const m = d.masses.find((x) => x.id === doc.activeMassId);
      if (!m || m.footprint.length < 3) return;
      const cx = m.footprint.reduce((s, p) => s + p.x, 0) / m.footprint.length;
      const cy = m.footprint.reduce((s, p) => s + p.y, 0) / m.footprint.length;
      m.dormers.push({ id: newMassId(), x: cx, y: cy, widthM: 2.4, depthM: 1.6, ridgeM: 1, type: "gable" });
    }, true);
    setTool("move");
    toast.success("Dormer eklendi — 2B'de sürükleyerek konumla");
  }
  function updateDormer(id: string, mut: (dm: Dormer) => void) {
    update((d) => { const m = d.masses.find((x) => x.id === doc.activeMassId); const dm = m?.dormers.find((x) => x.id === id); if (dm) mut(dm); }, true);
  }
  function removeDormer(id: string) {
    update((d) => { const m = d.masses.find((x) => x.id === doc.activeMassId); if (m) m.dormers = m.dormers.filter((x) => x.id !== id); }, true);
  }

  function addMass(parentId: string | null) {
    const id = newMassId();
    update((d) => {
      let baseM = 0;
      if (parentId) { const par = d.masses.find((m) => m.id === parentId); if (par) baseM = par.baseM + par.wallM; }
      d.masses.push({
        ...DEFAULT_MASS, id, footprint: [], baseM, parentId,
        name: parentId ? "Çatı Üstü Yapı" : d.masses.length === 0 ? "Ana Bina" : `Kütle ${d.masses.length + 1}`,
        wallM: parentId ? 2.5 : 3,
        roofType: parentId ? "gable" : "hip",
      });
      d.activeMassId = id;
    }, true);
    setStep("cizim"); setCizimView("2d"); setTool("draw");
  }
  function addShape(tmpl: Vec[]) {
    const per = 8 / (mpp || 0.05); // 1 birim ≈ 8 m
    const cx = imgSize ? imgSize.w / 2 : 500, cy = imgSize ? imgSize.h / 2 : 350;
    const xs = tmpl.map((p) => p.x), ys = tmpl.map((p) => p.y);
    const bcx = (Math.min(...xs) + Math.max(...xs)) / 2, bcy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const fp = tmpl.map((p) => ({ x: cx + (p.x - bcx) * per, y: cy + (p.y - bcy) * per }));
    const id = newMassId();
    update((d) => {
      d.masses.push({ ...DEFAULT_MASS, id, footprint: fp, name: d.masses.length === 0 ? "Ana Bina" : `Kütle ${d.masses.length + 1}` });
      d.activeMassId = id;
    }, true);
    setStep("cizim"); setCizimView("2d"); setTool("move");
  }
  function selectMass(id: string) { update((d) => { d.activeMassId = id; }); setTool("edit"); }
  function removeMass(id: string) {
    update((d) => {
      d.masses = d.masses.filter((m) => m.id !== id && m.parentId !== id);
      d.placed = d.placed.filter((p) => !p.face.startsWith(id + ":"));
      if (d.activeMassId === id) d.activeMassId = d.masses[0]?.id ?? null;
    }, true);
  }

  const is3D = (step === "cizim" && cizimView === "3d") || (step === "panel" && panelView === "3d");
  const massMode = locked ? "view" : tool;

  const showMap = step === "gorsel" && mapMode && !pending;
  const showCrop = step === "gorsel" && !!pending;
  const showCanvasToolbar = step === "cizim" && cizimView === "2d" && !locked && !!activeMass;

  function autoLayout() {
    if (!mpp) { toast.error("Ölçek bulunamadı — altlığı haritadan alın."); return; }
    const placed = built.flatMap(({ mass, roof }) => {
      const children = doc.masses.filter((mm) => mm.parentId === mass.id && mm.footprint.length >= 3);
      const covered = (p: PlacedPanel) => {
        const rad = (p.rotationDeg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
        const cx = p.x + (p.w / 2) * c - (p.h / 2) * s, cy = p.y + (p.w / 2) * s + (p.h / 2) * c;
        return children.some((ch) => pointInPolygon({ x: cx, y: cy }, ch.footprint))
          || doc.obstacles.some((o) => polysOverlapD(panelCornersD(p), o.poly))
          || mass.dormers.some((dm) => polysOverlapD(panelCornersD(p), dormerPoly(dm, mpp)));
      };
      return roof.faces.flatMap((f) => computeLayout(f.poly, `${mass.id}:${f.id}`, doc.panelConfig, mpp)).filter((p) => !covered(p));
    });
    if (!placed.length) { toast.error("Çatı düzlemi yok — önce bina hattını çizin."); return; }
    update((d) => { d.placed = placed; }, true);
    toast.success(`${placed.length} panel yerleştirildi`);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={close}><ArrowLeft className="size-4" /> Tasarımlar</Button>
          <div><h1 className="text-lg font-bold tracking-tight text-slate-900">{doc.name}</h1><p className="text-[11px] text-muted-foreground">{doc.address || "—"}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle2 className="size-3.5" /> Otomatik kaydedildi</span>
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}><Undo2 className="size-4" /> Geri Al</Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo}><Redo2 className="size-4" /></Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/70 p-1.5 shadow-sm">
        {STEPS.map((s) => {
          const Icon = s.icon; const active = step === s.key;
          const gated = (s.key === "panel" || s.key === "analiz") && !locked; // panel/analiz çatı kilitliyken
          return (
            <button key={s.key} type="button"
              onClick={() => { if (gated) { toast.error("Önce çatıyı tamamlayıp kilitleyin"); return; } setStep(s.key); }}
              className={cn("inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all", active ? "bg-emerald-600 text-white shadow-sm" : gated ? "text-slate-400" : "text-slate-600 hover:bg-white hover:text-slate-900")}>
              <Icon className="size-4" /> {s.label}
              {gated && <Lock className="size-3 opacity-60" />}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {/* 2B / 3B geçişi (Bina & Çatı + Panel Yerleşimi) */}
          {step === "cizim" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex w-fit items-center gap-1 rounded-lg border bg-card p-1">
                <ToolBtn active={cizimView === "2d"} onClick={() => setCizimView("2d")} icon={PencilRuler} label="2B Plan" />
                <ToolBtn active={cizimView === "3d"} onClick={() => setCizimView("3d")} icon={Box} label="3B Model" />
              </div>
              {locked ? (
                <Button size="sm" variant="outline" onClick={() => setLocked(false)}><Unlock className="size-4" /> Kilidi Aç (düzenle)</Button>
              ) : (
                <Button size="sm" onClick={() => { setLocked(true); setStep("panel"); toast.success("Bina kilitlendi — panel yerleşimine geçildi"); }}><Lock className="size-4" /> Binayı Tamamla ve Kilitle</Button>
              )}
            </div>
          )}
          {step === "panel" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex w-fit items-center gap-1 rounded-lg border bg-card p-1">
                <ToolBtn active={panelView === "2d"} onClick={() => setPanelView("2d")} icon={LayoutGrid} label="2B Yerleşim" />
                <ToolBtn active={panelView === "3d"} onClick={() => setPanelView("3d")} icon={Box} label="3B Önizleme" />
              </div>
              {panelView === "2d" && (
                <>
                  <Button size="sm" variant={addPanelMode ? "default" : "outline"} className={addPanelMode ? "bg-blue-600 text-white hover:bg-blue-700" : ""} onClick={() => setAddPanelMode((v) => { const n = !v; if (n) setObstacleMode(false); return n; })}>
                    <Plus className="size-4" /> {addPanelMode ? "Panel Eklemeyi Bitir" : "Panel Ekle (elle)"}
                  </Button>
                  <Button size="sm" variant={obstacleMode ? "default" : "outline"} className={obstacleMode ? "bg-rose-600 text-white hover:bg-rose-700" : ""} onClick={() => setObstacleMode((v) => { const n = !v; if (n) setAddPanelMode(false); return n; })}>
                    <Ban className="size-4" /> {obstacleMode ? "Engel Bitir" : "Engel Ekle (baca)"}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">{obstacleMode ? "Köşeleri tıkla → engel · Enter bitir · sağ tık sil" : addPanelMode ? "Çatı yüzeyine tıkla → panel" : "Panel tıkla · sürükle-taşı · R döndür · Del sil · engele tıkla → yükseklik"}</span>
                </>
              )}
            </div>
          )}

          {showCanvasToolbar && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-1.5">
              <ToolBtn active={tool === "draw"} onClick={() => setTool("draw")} icon={PencilRuler} label="Hat Çiz" />
              <ToolBtn active={tool === "edit"} onClick={() => setTool("edit")} icon={MousePointer2} label="Köşe Düzenle" />
              <ToolBtn active={tool === "move"} onClick={() => setTool("move")} icon={Move} label="Taşı" />
              {activeMass && activeMass.footprint.length >= 3 && (
                activeMass.roofEditable ? (
                  <Button size="sm" variant="secondary" className="h-8" onClick={toggleRoofEdit}><Spline className="size-4" /> Otomatik Çatıya Dön</Button>
                ) : (
                  <Button size="sm" className="h-8 bg-blue-600 text-white hover:bg-blue-700" onClick={toggleRoofEdit}><Spline className="size-4" /> Çatıyı Düzenle</Button>
                )
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {activeMass?.roofEditable
                  ? "Çatı çizgileri: köşe sürükle · çift tık köşe ekle · sağ tık sil · köşeye tıkla → yükseklik · “Hat Çiz” yeni çizgi"
                  : tool === "draw"
                    ? "Köşeleri tıkla · ilk köşeye dönünce kapanır"
                    : tool === "move"
                      ? "Kütleyi sürükleyerek taşı (yanlış birleşmeyi düzelt)"
                      : "Köşe sürükle · Çizgiye çift tık: köşe ekle · Sağ tık: köşe sil"}
              </span>
            </div>
          )}

          {step === "cizim" && locked && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800">
              <Lock className="size-4 shrink-0" /> Bina kilitli — düzenlemek için “Kilidi Aç”. Panel için “Panel Yerleşimi” sekmesine geç.
            </div>
          )}

          <div className="h-[calc(100vh-16rem)] min-h-[440px]">
            {showMap ? (
              <MapPicker onCapture={(dataUrl, m) => setPending({ dataUrl, mpp: m })} onCancel={() => setMapMode(false)} />
            ) : showCrop ? (
              <CropStep src={pending!.dataUrl} onConfirm={(cropped) => { update((d) => { d.imageDataUrl = cropped; d.metersPerPixel = pending!.mpp; }); setPending(null); setMapMode(false); toast.success("Altlık hazır — “Bina & Çatı”ya geç"); }} onCancel={() => setPending(null)} />
            ) : is3D ? (
              mpp ? <ThreeView /> : <div className="flex h-full items-center justify-center rounded-xl border bg-slate-100 text-sm text-slate-400">Önce haritadan ölçekli altlık alın, sonra bina hattını çizin.</div>
            ) : step === "panel" ? (
              <CanvasEditor mode="panel-select" obstacleMode={obstacleMode} addPanelMode={addPanelMode} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} selectedFaceSig={selectedFaceSig} onSelectFace={setSelectedFaceSig} />
            ) : (
              <MassEditor mode={step === "cizim" ? massMode : "view"} />
            )}
          </div>
        </div>

        <div className="space-y-3">
          {step === "gorsel" && <GorselPanel mpp={mpp} hasImage={!!doc.imageDataUrl} onMap={() => { setPending(null); setMapMode(true); }} onUpload={(url) => update((d) => { d.imageDataUrl = url; })} />}
          {step === "cizim" && !locked && <MassPanel updateActive={updateActive} active={activeMass} masses={doc.masses} onAdd={() => addMass(null)} onAddRoofTop={() => addMass(activeMass?.id ?? doc.masses[0]?.id ?? null)} onSelect={selectMass} onRemove={removeMass} onToggleRoofEdit={toggleRoofEdit} onShape={addShape} onAutoHeights={applyAutoHeights} faces={activeFaces} onFacePitch={setFacePitch} onAddDormer={addDormer} onUpdateDormer={updateDormer} onRemoveDormer={removeDormer} />}
          {step === "cizim" && locked && <LockPanel onUnlock={() => setLocked(false)} onPanel={() => setStep("panel")} />}
          {step === "panel" && <PanelPanel update={update} onAuto={autoLayout} totalPanels={totalPanels} totalKwp={totalKwp} locked={locked} onEditRoof={() => { setLocked(false); setStep("cizim"); }} />}
          {step === "analiz" && <AnalizPanel built={built} totalPanels={totalPanels} totalKwp={totalKwp} />}
          <StepNav step={step} setStep={setStep} locked={locked} />
        </div>
      </div>
    </div>
  );
}

function LockPanel({ onUnlock, onPanel }: { onUnlock: () => void; onPanel: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Lock className="size-4 text-amber-600" /> Çatı Kilitli</p>
        <p className="text-[12px] text-muted-foreground">Çatı modeli tamamlandı ve kilitlendi. Panelleri yerleştirmek için “Panel Yerleşimi” sekmesine geç, ya da çatıyı yeniden düzenlemek için kilidi aç.</p>
        <Button size="sm" className="w-full" onClick={onPanel}><LayoutGrid className="size-4" /> Panel Yerleşimine Geç</Button>
        <Button size="sm" variant="outline" className="w-full" onClick={onUnlock}><Unlock className="size-4" /> Kilidi Aç (çatıyı düzenle)</Button>
      </CardContent>
    </Card>
  );
}

function ToolBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors", active ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function StepNav({ step, setStep, locked }: { step: StepKey; setStep: (s: StepKey) => void; locked: boolean }) {
  const i = STEPS.findIndex((s) => s.key === step);
  const next = STEPS[i + 1];
  const blocked = !!next && (next.key === "panel" || next.key === "analiz") && !locked;
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setStep(STEPS[i - 1].key)}><ArrowLeft className="size-4" /> Geri</Button>
      {blocked && <span className="text-[11px] font-medium text-amber-600">Önce çatıyı tamamlayıp kilitleyin</span>}
      <Button size="sm" disabled={i === STEPS.length - 1 || blocked} title={blocked ? "Önce çatıyı tamamlayıp kilitleyin" : undefined} onClick={() => next && setStep(next.key)}>İlerle <ArrowRight className="size-4" /></Button>
    </div>
  );
}

function GorselPanel({ mpp, hasImage, onMap, onUpload }: { mpp: number | null; hasImage: boolean; onMap: () => void; onUpload: (dataUrl: string) => void }) {
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 12 * 1024 * 1024) { toast.error("Görüntü 12 MB'den küçük olmalı"); return; }
    const r = new FileReader(); r.onload = () => onUpload(String(r.result)); r.readAsDataURL(f); e.target.value = "";
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">1) Altlık Görüntü</p>
        <Button className="w-full" onClick={onMap}><MapIcon className="size-4" /> Haritadan Al (uydu)</Button>
        <p className="text-[11px] text-muted-foreground">Adres ara → binaya yaklaş → “Bu Görünümü Al” → kırp. Ölçek <b>otomatik</b>.</p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-3 text-[12px] text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40">
          <ImagePlus className="size-4" /> {hasImage ? "Bunun yerine görüntü yükle" : "veya drone/ekran görüntüsü yükle"}
          <input type="file" accept="image/*" onChange={pick} className="hidden" />
        </label>
        <div className="border-t pt-3">
          <p className="text-sm font-semibold text-slate-800">2) Ölçek</p>
          {mpp
            ? <p className="mt-1 text-[12px] text-emerald-700">✓ Ölçek hazır · 1 m = {fmt(1 / mpp, 1)} px</p>
            : <p className="mt-1 text-[12px] text-amber-600">Ölçek haritadan otomatik gelir. Altlığı “Haritadan Al” ile eklerseniz ölçek kendiliğinden ayarlanır.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const ROOF_TYPES: { v: RoofType; label: string; desc: string }[] = [
  { v: "flat", label: "Düz", desc: "Yatay teras çatı" },
  { v: "gable", label: "Beşik", desc: "İki yöne eğimli, ortada sırt" },
  { v: "hip", label: "Kırma", desc: "Tüm kenarlardan eğimli" },
];
const ROOF_SHORT: Record<RoofType, string> = { flat: "Düz", gable: "Beşik", hip: "Kırma" };

function MassPanel({ updateActive, active, masses, onAdd, onAddRoofTop, onSelect, onRemove, onToggleRoofEdit, onShape, onAutoHeights, faces, onFacePitch, onAddDormer, onUpdateDormer, onRemoveDormer }: {
  updateActive: (mut: (m: Mass) => void) => void;
  active: Mass | null;
  masses: Mass[];
  onAdd: () => void;
  onAddRoofTop: () => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleRoofEdit: () => void;
  onShape: (poly: Vec[]) => void;
  onAutoHeights: () => void;
  faces: { id: string; name: string }[];
  onFacePitch: (sig: string, deg: number) => void;
  onAddDormer: () => void;
  onUpdateDormer: (id: string, mut: (dm: Dormer) => void) => void;
  onRemoveDormer: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Bina Kütleleri ({masses.length})</p>
          <Button size="sm" variant="outline" onClick={onAdd}><Plus className="size-4" /> Boş Çiz</Button>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Hazır şekil ekle (sonra “Taşı” ile yerleştir)</Label>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {SHAPE_TEMPLATES.map((t) => (
              <button key={t.key} type="button" onClick={() => onShape(t.poly)} title={t.label}
                className="flex flex-col items-center gap-0.5 rounded-md border border-slate-200 p-1.5 text-[10px] font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/60">
                <ShapeIcon poly={t.poly} lines={TEMPLATE_LINES[t.key]} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {masses.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">“Kütle” ile başla, sonra binanın <b>dış hattını</b> tıklaya tıklaya çiz ve kapat. Çatı otomatik üretilir.</p>
        ) : (
          <div className="space-y-1">
            {masses.map((m) => (
              <div key={m.id} className={cn("flex items-center gap-1 rounded-md border px-2 py-1.5", m.id === active?.id ? "border-emerald-300 bg-emerald-50/50" : "border-transparent hover:bg-slate-50")}>
                <button type="button" onClick={() => onSelect(m.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm">{m.parentId ? "↑ " : ""}{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.footprint.length} köşe · {ROOF_SHORT[m.roofType]}{m.parentId ? ` · +${fmt(m.baseM, 1)}m` : ""}</p>
                </button>
                <button type="button" onClick={() => onRemove(m.id)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Sil"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full" onClick={onAddRoofTop} disabled={!active}><Layers className="size-4" /> Çatı Üstü Yapı Ekle</Button>

        {active && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-[12px] font-semibold text-slate-700">Seçili: {active.name}</p>
            <div className="space-y-1"><Label className="text-[11px]">Ad</Label><Input value={active.name} onChange={(e) => updateActive((m) => { m.name = e.target.value; })} className="h-9" /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="text-[11px]">Duvar yüksekliği</Label><span className="text-[12px] font-semibold text-emerald-700">{fmt(active.wallM, 1)} m</span></div>
              <Slider min={0} max={20} step={0.5} value={[Math.min(20, active.wallM)]} onValueChange={(v) => updateActive((m) => { m.wallM = v[0]; })} />
            </div>
            {active.roofEditable ? (
              <div className="space-y-2.5 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5">
                <p className="text-[11px] text-blue-800">Çatı <b>elle düzenleniyor</b>. 2B planda çizgileri sürükle/ekle/sil. Yüksekliği tek tek girmek yerine aşağıdan <b>eğim</b> seç → <b>“Eğimden Yükseklik”</b>.</p>
                <div className="space-y-1.5 rounded-md bg-white/70 p-2">
                  <div className="flex items-center justify-between"><Label className="text-[11px]">Eğim</Label><span className="text-[12px] font-semibold text-blue-700">{active.pitchDeg}°</span></div>
                  <Slider min={5} max={60} step={1} value={[active.pitchDeg]} onValueChange={(v) => updateActive((m) => { m.pitchDeg = v[0]; })} />
                  <Button size="sm" className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={onAutoHeights}>Eğimden Yükseklik Hesapla</Button>
                  <p className="text-[10px] text-slate-500">Saçak 0, iç noktalar (sırt/kırma) eğime göre otomatik yükselir → tutarlı çatı. Sonra istersen köşeleri elle ince ayar yap.</p>
                </div>
                {faces.length > 1 && (
                  <div className="space-y-1 rounded-md bg-white/70 p-2">
                    <Label className="text-[11px]">Yüzey eğimleri (per-yüzey °)</Label>
                    {faces.map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">{f.name}</span>
                        <Input type="number" className="h-7 w-16" value={active.facePitch[f.id] ?? active.pitchDeg} onChange={(e) => onFacePitch(f.id, parseFloat(e.target.value) || 0)} />
                        <span className="text-[10px] text-slate-400">°</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full" onClick={onToggleRoofEdit}>Otomatik Çatıya Dön</Button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-[11px]">Çatı tipi</Label>
                  <Select value={active.roofType} onValueChange={(v) => updateActive((m) => { m.roofType = v as RoofType; })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROOF_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label} — {t.desc}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {active.roofType !== "flat" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><Label className="text-[11px]">Eğim</Label><span className="text-[12px] font-semibold text-emerald-700">{active.pitchDeg}°</span></div>
                    <Slider min={5} max={60} step={1} value={[active.pitchDeg]} onValueChange={(v) => updateActive((m) => { m.pitchDeg = v[0]; })} />
                  </div>
                )}
                {active.roofType === "gable" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><Label className="text-[11px]">Sırt (ridge) yönü</Label><span className="text-[12px] font-semibold text-emerald-700">{active.ridgeAxisDeg}°</span></div>
                    <Slider min={0} max={180} step={5} value={[active.ridgeAxisDeg]} onValueChange={(v) => updateActive((m) => { m.ridgeAxisDeg = v[0]; })} />
                  </div>
                )}
                {active.roofType === "flat" && (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                    <button type="button" onClick={() => updateActive((m) => { m.parapet = !m.parapet; })} className="flex w-full items-center justify-between">
                      <Label className="text-[11px] cursor-pointer">Parapet (kenar duvarı)</Label>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", active.parapet ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}>{active.parapet ? "Açık" : "Kapalı"}</span>
                    </button>
                    {active.parapet && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between"><Label className="text-[11px]">Parapet yüksekliği</Label><span className="text-[12px] font-semibold text-emerald-700">{fmt(active.parapetM, 2)} m</span></div>
                        <Slider min={0.2} max={2} step={0.1} value={[active.parapetM]} onValueChange={(v) => updateActive((m) => { m.parapetM = v[0]; })} />
                      </div>
                    )}
                  </div>
                )}
                {active.footprint.length >= 3 && (
                  <Button size="sm" variant="outline" className="w-full" onClick={onToggleRoofEdit}><PencilRuler className="size-4" /> Çatıyı Elle Düzenle</Button>
                )}
              </>
            )}
            {active.footprint.length >= 3 && (
              <div className="space-y-2 border-t pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700">Dormer / Çatı Çıkıntısı</Label>
                  <Button size="sm" variant="outline" onClick={onAddDormer}><Plus className="size-4" /> Dormer</Button>
                </div>
                {active.dormers.length === 0 ? (
                  <p className="text-[10.5px] text-muted-foreground">Ekle → 2B’de sürükleyerek konumla. Ölçüler aşağıdan.</p>
                ) : active.dormers.map((dm, i) => (
                  <div key={dm.id} className="space-y-1 rounded-md border border-slate-200 p-2">
                    <div className="flex items-center justify-between"><span className="text-[11px] font-medium">Dormer {i + 1}</span>
                      <button type="button" onClick={() => onRemoveDormer(dm.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div><Label className="text-[10px]">Gen (m)</Label><Input type="number" step="0.1" className="h-7" value={dm.widthM} onChange={(e) => onUpdateDormer(dm.id, (d) => { d.widthM = parseFloat(e.target.value) || 0.5; })} /></div>
                      <div><Label className="text-[10px]">Der (m)</Label><Input type="number" step="0.1" className="h-7" value={dm.depthM} onChange={(e) => onUpdateDormer(dm.id, (d) => { d.depthM = parseFloat(e.target.value) || 0.5; })} /></div>
                      <div><Label className="text-[10px]">Yük (m)</Label><Input type="number" step="0.1" className="h-7" value={dm.ridgeM} onChange={(e) => onUpdateDormer(dm.id, (d) => { d.ridgeM = parseFloat(e.target.value) || 0.2; })} /></div>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => onUpdateDormer(dm.id, (d) => { d.type = "gable"; })} className={cn("flex-1 rounded border px-2 py-1 text-[10.5px]", dm.type === "gable" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "text-slate-500")}>Beşik</button>
                      <button type="button" onClick={() => onUpdateDormer(dm.id, (d) => { d.type = "shed"; })} className={cn("flex-1 rounded border px-2 py-1 text-[10.5px]", dm.type === "shed" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "text-slate-500")}>Tek eğim</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-500">Çatı, dış hattan <b>otomatik</b> üretilir — düzlemsel ve su geçirmez. “Çatı Üstü Yapı” ile çatıya daha yüksek ikinci bir yapı eklersin.</p>
      </CardContent>
    </Card>
  );
}

function PanelPanel({ update, onAuto, totalPanels, totalKwp, locked, onEditRoof }: {
  update: ReturnType<typeof useDesignStore.getState>["update"];
  onAuto: () => void;
  totalPanels: number; totalKwp: number;
  locked: boolean; onEditRoof: () => void;
}) {
  const doc = useDesignStore((s) => s.active)!;
  const c = doc.panelConfig;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[11px]">
          <span className="flex items-center gap-1 text-slate-600">
            {locked ? <><Lock className="size-3 text-amber-600" /> Çatı kilitli</> : "Çatı düzenlenebilir"}
          </span>
          <button type="button" onClick={onEditRoof} className="font-semibold text-primary hover:underline">Çatıyı Düzenle</button>
        </div>
        <p className="text-sm font-semibold text-slate-800">Panel</p>
        <div className="space-y-1">
          <Label className="text-[11px]">Hazır model</Label>
          <Select onValueChange={(v) => { const p = PANEL_PRESETS.find((x) => x.label === v); if (p) update((d) => { d.panelConfig.widthMm = p.widthMm; d.panelConfig.heightMm = p.heightMm; d.panelConfig.watt = p.watt; }); }}>
            <SelectTrigger><SelectValue placeholder="Katalogdan seç" /></SelectTrigger>
            <SelectContent>{PANEL_PRESETS.map((p) => <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumF label="En (mm)" value={c.widthMm} onChange={(v) => update((d) => { d.panelConfig.widthMm = v; })} />
          <NumF label="Boy (mm)" value={c.heightMm} onChange={(v) => update((d) => { d.panelConfig.heightMm = v; })} />
          <NumF label="Güç (W)" value={c.watt} onChange={(v) => update((d) => { d.panelConfig.watt = v; })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Yön</Label>
            <Select value={c.orientation} onValueChange={(v) => update((d) => { d.panelConfig.orientation = v as "portrait" | "landscape"; })}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="portrait">Dikey</SelectItem><SelectItem value="landscape">Yatay</SelectItem></SelectContent>
            </Select>
          </div>
          <NumF label="Panel arası (mm)" value={c.gapMm} onChange={(v) => update((d) => { d.panelConfig.gapMm = v; })} />
          <NumF label="Çatı kenar payı (mm)" value={c.edgeMarginMm} onChange={(v) => update((d) => { d.panelConfig.edgeMarginMm = v; })} />
        </div>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <p className="text-[11px] font-semibold text-slate-700">Gruplama (dizi arası boşluk)</p>
          <div className="grid grid-cols-2 gap-2">
            <NumF label="Yatayda / grup (adet)" value={c.colGroup} onChange={(v) => update((d) => { d.panelConfig.colGroup = Math.max(0, Math.round(v)); })} />
            <NumF label="Yatay boşluk (mm)" value={c.colGap} onChange={(v) => update((d) => { d.panelConfig.colGap = Math.max(0, v); })} />
            <NumF label="Dikeyde / grup (adet)" value={c.rowGroup} onChange={(v) => update((d) => { d.panelConfig.rowGroup = Math.max(0, Math.round(v)); })} />
            <NumF label="Dikey boşluk (mm)" value={c.rowGap} onChange={(v) => update((d) => { d.panelConfig.rowGap = Math.max(0, v); })} />
          </div>
          <p className="text-[10.5px] text-muted-foreground">0 = gruplama yok. Örn. yatayda 4 → her 4 panelden sonra boşluk bırakılır (dizi arası geçiş yolu).</p>
        </div>
        <div className="border-t pt-3">
          <Button size="sm" className="w-full" onClick={onAuto}><LayoutGrid className="size-4" /> Panelleri Otomatik Yerleştir</Button>
        </div>
        <Button size="sm" variant="outline" className="w-full text-destructive" onClick={() => update((d) => { d.placed = []; }, true)}><Trash2 className="size-4" /> Panelleri Temizle</Button>
        <p className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-500">Paneli tıkla (Shift ile çoklu), sürükle-taşı, <b>R</b> döndür, <b>Del</b> sil. Panel başka panelin üstüne bırakılamaz (üst üste gelmez).</p>
        <div className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-[11px] uppercase tracking-wider text-slate-400">Toplam</p><p className="text-lg font-bold text-slate-900">{totalPanels} panel · {fmt(totalKwp, 2)} kWp</p></div>
      </CardContent>
    </Card>
  );
}

function NumF({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (<div className="space-y-1"><Label className="text-[11px]">{label}</Label><Input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} /></div>);
}

function AnalizPanel({ built, totalPanels, totalKwp }: { built: { mass: Mass; roof: MassRoof }[]; totalPanels: number; totalKwp: number }) {
  const doc = useDesignStore((s) => s.active)!;
  const mpp = doc.metersPerPixel;
  const yieldKwhKwp = CITY_YIELD[doc.city] ?? 1500;
  const annual = totalKwp * yieldKwhKwp;
  const roofAreaM2 = mpp ? built.reduce((s, b) => s + b.roof.faces.reduce((a, f) => a + faceAreaM2(f.poly, mpp), 0), 0) : null;
  const usedAreaM2 = mpp ? doc.placed.reduce((s, p) => s + p.w * p.h, 0) * mpp ** 2 : null;
  const perFace = built.flatMap(({ mass, roof }) => roof.faces.map((f) => {
    const n = doc.placed.filter((p) => p.face === `${mass.id}:${f.id}`).length;
    return { name: built.length > 1 ? `${mass.name} · ${f.name}` : f.name, n, kwp: panelsKwp(n, doc.panelConfig.watt) };
  }));
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">Analiz Özeti</p>
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Panel" value={`${totalPanels}`} />
          <Kpi label="Kurulu Güç" value={`${fmt(totalKwp, 2)} kWp`} tone="emerald" />
          <Kpi label="Yıllık Üretim" value={`${fmt(annual)} kWh`} tone="amber" />
          <Kpi label="Özgül Üretim" value={`${fmt(yieldKwhKwp)}`} />
        </div>
        {roofAreaM2 != null && <p className="text-[11px] text-muted-foreground">Çatı alanı ≈ {fmt(roofAreaM2, 1)} m² · Panel alanı ≈ {fmt(usedAreaM2 ?? 0, 1)} m²</p>}
        {perFace.length > 0 && (
          <div className="border-t pt-2">
            <table className="w-full text-[12px]"><thead><tr className="text-left text-[10.5px] uppercase text-slate-400"><th className="py-1">Bölüm</th><th className="text-right">Panel</th><th className="text-right">kWp</th></tr></thead>
              <tbody>{perFace.map((p, i) => (<tr key={i} className="border-t border-slate-100"><td className="py-1">{p.name}</td><td className="text-right tabular-nums">{p.n}</td><td className="text-right tabular-nums">{fmt(p.kwp, 2)}</td></tr>))}</tbody>
            </table>
          </div>
        )}
        <p className="text-[10.5px] text-slate-400">Üretim tahmini şehir bazlı özgül üretimle yaklaşık. PVGIS + PDF rapor sonraki fazda.</p>
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-600" : "text-slate-900";
  return (<div className="rounded-lg border p-2.5"><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p><p className={cn("mt-0.5 text-base font-bold tabular-nums", cls)}>{value}</p></div>);
}
