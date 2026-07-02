"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Undo2,
  Redo2,
  MousePointer2,
  PencilRuler,
  Ruler,
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  Sun,
  Map as MapIcon,
  ImagePlus,
  Zap,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDesignStore } from "@/lib/solar-design/store";
import type { EditorTool } from "./canvas-editor";
import type { Vec } from "@/lib/solar-design/types";
import { PLANE_COLORS } from "@/lib/solar-design/types";
import { polygonAreaPx } from "@/lib/solar-design/geometry";
import { computeLayout, panelsKwp } from "@/lib/solar-design/layout-engine";

const CanvasEditor = dynamic(() => import("./canvas-editor"), { ssr: false });

type StepKey = "gorsel" | "cizim" | "panel" | "analiz";
const STEPS: { key: StepKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "gorsel", label: "Görüntü & Ölçek", icon: MapIcon },
  { key: "cizim", label: "Çatı Çizimi", icon: PencilRuler },
  { key: "panel", label: "Paneller & Yerleşim", icon: LayoutGrid },
  { key: "analiz", label: "Analiz", icon: Zap },
];

const CITY_YIELD: Record<string, number> = {
  Ankara: 1550, İstanbul: 1400, İzmir: 1600, Antalya: 1650, Konya: 1600,
  Adana: 1600, Bursa: 1450, Kayseri: 1600, Gaziantep: 1650, Mersin: 1650,
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

  if (!active) {
    return <DesignList index={index} onOpen={openDesign} onCreate={createDesign} onRemove={removeDesign} />;
  }
  return <Editor />;
}

// ————————————————————————————————————————— Proje listesi
function DesignList({
  index, onOpen, onCreate, onRemove,
}: {
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
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Sun className="size-5" />
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">3D Tasarım</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Güneş Paneli Yerleşim Tasarımı</h1>
            <p className="mt-1 text-sm text-slate-600">
              Uydu/drone görüntüsü üzerinde çatını çiz, ölçekle, panelleri otomatik/manuel yerleştir, analiz al.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-semibold text-slate-800">Yeni Tasarım</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Proje adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Villa Çatı GES" />
            </div>
            <div className="space-y-1.5">
              <Label>Adres</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Mahalle / il" />
            </div>
            <div className="space-y-1.5">
              <Label>Şehir (üretim tahmini)</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(CITY_YIELD).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => { if (!name.trim()) { toast.error("Proje adı girin"); return; } onCreate(name, address, city); }}>
              <Plus className="size-4" /> Oluştur & Aç
            </Button>
          </div>
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
                  <button type="button" onClick={() => onRemove(d.id)} className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Sil">
                    <Trash2 className="size-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <p className="text-center text-[11px] text-slate-400">
        Tasarımlar bu tarayıcıda saklanır. Adres araması & canlı uydu (Google Maps) ve 3B görünüm sonraki fazda.
      </p>
    </div>
  );
}

// ————————————————————————————————————————— Editör
function Editor() {
  const doc = useDesignStore((s) => s.active)!;
  const update = useDesignStore((s) => s.update);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const close = useDesignStore((s) => s.close);
  const canUndo = useDesignStore((s) => s.past.length > 0);
  const canRedo = useDesignStore((s) => s.future.length > 0);

  const [step, setStep] = useState<StepKey>("gorsel");
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [calibPx, setCalibPx] = useState<number | null>(null);
  const [calibMeters, setCalibMeters] = useState("");

  useEffect(() => { if (step === "panel" || step === "analiz") setTool("select"); }, [step]);

  const totalPanels = doc.placed.length;
  const totalKwp = panelsKwp(totalPanels, doc.panelConfig.watt);
  const canvasTool: EditorTool = step === "gorsel" || step === "cizim" ? tool : "select";

  function addPlane(points: Vec[]) {
    const idx = doc.planes.length;
    const id = `pl${Date.now()}`;
    update((d) => {
      d.planes.push({ id, name: `Yüzey ${idx + 1}`, points, tiltDeg: 25, azimuthDeg: 180, color: PLANE_COLORS[idx % PLANE_COLORS.length] });
    }, true);
    setSelectedPlaneId(id);
    setTool("select");
  }

  function applyCalibration() {
    const m = parseFloat(calibMeters);
    if (!calibPx || !m || m <= 0) { toast.error("Geçerli bir uzunluk girin"); return; }
    update((d) => { d.metersPerPixel = m / calibPx; });
    setCalibPx(null);
    setCalibMeters("");
    setTool("select");
    toast.success("Ölçek kalibre edildi");
  }

  function autoLayout(scope: "all" | "selected") {
    if (!doc.metersPerPixel) { toast.error("Önce ölçek kalibrasyonu yapın"); return; }
    const planes = scope === "selected" && selectedPlaneId ? doc.planes.filter((p) => p.id === selectedPlaneId) : doc.planes;
    if (!planes.length) { toast.error("Çatı düzlemi yok"); return; }
    const placed = planes.flatMap((p) => computeLayout(p, doc.panelConfig, doc.metersPerPixel!));
    update((d) => {
      const ids = new Set(planes.map((p) => p.id));
      d.placed = scope === "selected" ? [...d.placed.filter((pp) => !ids.has(pp.planeId)), ...placed] : placed;
    }, true);
    toast.success(`${placed.length} panel yerleştirildi`);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      {/* Üst bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={close}><ArrowLeft className="size-4" /> Tasarımlar</Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">{doc.name}</h1>
            <p className="text-[11px] text-muted-foreground">{doc.address || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle2 className="size-3.5" /> Otomatik kaydedildi</span>
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}><Undo2 className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo}><Redo2 className="size-4" /></Button>
        </div>
      </div>

      {/* Adım sekmeleri */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/70 p-1.5 shadow-sm">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = step === s.key;
          return (
            <button key={s.key} type="button" onClick={() => setStep(s.key)}
              className={cn("inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all",
                active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900")}>
              <Icon className="size-4" /> {s.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        {/* Canvas kolonu */}
        <div className="space-y-2">
          {(step === "gorsel" || step === "cizim") && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-1.5">
              <ToolBtn active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Seç / Taşı" />
              {step === "cizim" && <ToolBtn active={tool === "draw"} onClick={() => setTool("draw")} icon={PencilRuler} label="Çatı Çiz" />}
              <ToolBtn active={tool === "calibrate"} onClick={() => setTool("calibrate")} icon={Ruler} label="Kalibrasyon" />
              <span className="ml-auto text-[11px] text-muted-foreground">
                {tool === "draw"
                  ? "Tıkla: köşe · İlk köşeye tıkla: kapat"
                  : tool === "calibrate"
                    ? "Bilinen bir kenarın iki ucuna tıkla"
                    : "Köşe sürükle · Kenara çift tık: köşe ekle · Sağ tık: sil"}
              </span>
            </div>
          )}

          {/* Kalibrasyon uzunluk girişi */}
          {calibPx != null && (
            <div className="flex items-end gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-2.5">
              <div className="flex-1 space-y-1">
                <Label className="text-[11px] text-rose-700">Çizdiğin mesafenin gerçek uzunluğu (m)</Label>
                <Input autoFocus type="number" step="any" value={calibMeters} onChange={(e) => setCalibMeters(e.target.value)} placeholder="Örn. 10" className="h-9 bg-white" />
              </div>
              <Button size="sm" onClick={applyCalibration}><Ruler className="size-4" /> Uygula</Button>
              <Button size="sm" variant="outline" onClick={() => { setCalibPx(null); setCalibMeters(""); }}><X className="size-4" /></Button>
            </div>
          )}

          <div className="h-[calc(100vh-16rem)] min-h-[420px]">
            <CanvasEditor
              tool={canvasTool}
              selectedPlaneId={selectedPlaneId}
              onSelectPlane={setSelectedPlaneId}
              onCalibrated={(px) => setCalibPx(px)}
              onPlaneAdded={addPlane}
            />
          </div>
        </div>

        {/* Sağ panel */}
        <div className="space-y-3">
          {step === "gorsel" && <GorselPanel mpp={doc.metersPerPixel} hasImage={!!doc.imageDataUrl} onUpload={(url) => update((d) => { d.imageDataUrl = url; })} onCalibTool={() => setTool("calibrate")} />}
          {step === "cizim" && <CizimPanel selectedPlaneId={selectedPlaneId} setSelectedPlaneId={setSelectedPlaneId} update={update} />}
          {step === "panel" && <PanelPanel update={update} onAuto={autoLayout} totalPanels={totalPanels} totalKwp={totalKwp} />}
          {step === "analiz" && <AnalizPanel />}
          <StepNav step={step} setStep={setStep} />
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function StepNav({ step, setStep }: { step: StepKey; setStep: (s: StepKey) => void }) {
  const i = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setStep(STEPS[i - 1].key)}><ArrowLeft className="size-4" /> Geri</Button>
      <Button size="sm" disabled={i === STEPS.length - 1} onClick={() => setStep(STEPS[i + 1].key)}>İlerle <ArrowRight className="size-4" /></Button>
    </div>
  );
}

function GorselPanel({ mpp, hasImage, onUpload, onCalibTool }: { mpp: number | null; hasImage: boolean; onUpload: (dataUrl: string) => void; onCalibTool: () => void }) {
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 12 * 1024 * 1024) { toast.error("Görüntü 12 MB'den küçük olmalı"); return; }
    const r = new FileReader();
    r.onload = () => onUpload(String(r.result));
    r.readAsDataURL(f);
    e.target.value = "";
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">1) Görüntü</p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40">
          <ImagePlus className="size-4" /> {hasImage ? "Görüntüyü değiştir" : "Uydu/drone görüntüsü yükle"}
          <input type="file" accept="image/*" onChange={pick} className="hidden" />
        </label>
        <p className="text-[11px] text-muted-foreground">Google Earth/Maps ekran görüntüsü veya drone fotoğrafı.</p>

        <div className="border-t pt-3">
          <p className="text-sm font-semibold text-slate-800">2) Ölçek Kalibrasyonu</p>
          {mpp ? (
            <p className="mt-1 text-[12px] text-emerald-700">✓ Kalibre: 1 m = {fmt(1 / mpp, 1)} px</p>
          ) : (
            <p className="mt-1 text-[12px] text-amber-600">Henüz kalibre edilmedi.</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Bilinen bir mesafeyi (ör. bina kenarı) çizin, gerçek uzunluğunu girin.</p>
          <Button size="sm" variant="outline" className="mt-2 w-full" onClick={onCalibTool}><Ruler className="size-4" /> Kalibrasyon Çizgisi Çiz</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CizimPanel({ selectedPlaneId, setSelectedPlaneId, update }: { selectedPlaneId: string | null; setSelectedPlaneId: (id: string | null) => void; update: ReturnType<typeof useDesignStore.getState>["update"] }) {
  const doc = useDesignStore((s) => s.active)!;
  const sel = doc.planes.find((p) => p.id === selectedPlaneId) || null;
  const areaM2 = sel && doc.metersPerPixel ? polygonAreaPx(sel.points) * doc.metersPerPixel ** 2 : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">Çatı Düzlemleri ({doc.planes.length})</p>
        {doc.planes.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">“Çatı Çiz” aracıyla ilk düzlemi çizin.</p>
        ) : (
          <div className="space-y-1">
            {doc.planes.map((p) => (
              <div key={p.id} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm", p.id === selectedPlaneId ? "border-emerald-300 bg-emerald-50/50" : "border-transparent hover:bg-slate-50")}>
                <span className="size-3 shrink-0 rounded-sm" style={{ background: p.color }} />
                <button type="button" onClick={() => setSelectedPlaneId(p.id)} className="min-w-0 flex-1 truncate text-left">{p.name}</button>
                <button type="button" onClick={() => { update((d) => { d.planes = d.planes.filter((x) => x.id !== p.id); d.placed = d.placed.filter((pp) => pp.planeId !== p.id); }, true); if (selectedPlaneId === p.id) setSelectedPlaneId(null); }} className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {sel && (
          <div className="space-y-2 border-t pt-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Ad</Label>
              <Input value={sel.name} onChange={(e) => update((d) => { const t = d.planes.find((x) => x.id === sel.id); if (t) t.name = e.target.value; })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Eğim (°)</Label>
                <Input type="number" value={sel.tiltDeg} onChange={(e) => update((d) => { const t = d.planes.find((x) => x.id === sel.id); if (t) t.tiltDeg = parseFloat(e.target.value) || 0; })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Azimut (°)</Label>
                <Input type="number" value={sel.azimuthDeg} onChange={(e) => update((d) => { const t = d.planes.find((x) => x.id === sel.id); if (t) t.azimuthDeg = parseFloat(e.target.value) || 0; })} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Alan: {areaM2 != null ? `${fmt(areaM2, 1)} m²` : "ölçek gerekli"} · {sel.points.length} köşe · 180 = güney</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PanelPanel({ update, onAuto, totalPanels, totalKwp }: { update: ReturnType<typeof useDesignStore.getState>["update"]; onAuto: (scope: "all" | "selected") => void; totalPanels: number; totalKwp: number }) {
  const doc = useDesignStore((s) => s.active)!;
  const c = doc.panelConfig;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="portrait">Dikey</SelectItem><SelectItem value="landscape">Yatay</SelectItem></SelectContent>
            </Select>
          </div>
          <NumF label="Boşluk (mm)" value={c.gapMm} onChange={(v) => update((d) => { d.panelConfig.gapMm = v; })} />
          <NumF label="Kenar payı" value={c.edgeMarginMm} onChange={(v) => update((d) => { d.panelConfig.edgeMarginMm = v; })} />
        </div>
        <div className="flex gap-2 border-t pt-3">
          <Button size="sm" className="flex-1" onClick={() => onAuto("all")}><LayoutGrid className="size-4" /> Otomatik Yerleştir</Button>
          <Button size="sm" variant="outline" onClick={() => onAuto("selected")}>Seçili</Button>
        </div>
        <Button size="sm" variant="outline" className="w-full text-destructive" onClick={() => update((d) => { d.placed = []; }, true)}><Trash2 className="size-4" /> Panelleri Temizle</Button>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Toplam</p>
          <p className="text-lg font-bold text-slate-900">{totalPanels} panel · {fmt(totalKwp, 2)} kWp</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NumF({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
}

function AnalizPanel() {
  const doc = useDesignStore((s) => s.active)!;
  const mpp = doc.metersPerPixel;
  const totalPanels = doc.placed.length;
  const totalKwp = panelsKwp(totalPanels, doc.panelConfig.watt);
  const yieldKwhKwp = CITY_YIELD[doc.city] ?? 1500;
  const annual = totalKwp * yieldKwhKwp;
  const usedAreaM2 = mpp ? doc.placed.reduce((s, p) => s + p.w * p.h, 0) * mpp ** 2 : null;
  const roofAreaM2 = mpp ? doc.planes.reduce((s, p) => s + polygonAreaPx(p.points), 0) * mpp ** 2 : null;
  const perPlane = doc.planes.map((p) => {
    const n = doc.placed.filter((pp) => pp.planeId === p.id).length;
    return { name: p.name, n, kwp: panelsKwp(n, doc.panelConfig.watt), tilt: p.tiltDeg, az: p.azimuthDeg };
  });

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
        {roofAreaM2 != null && (
          <p className="text-[11px] text-muted-foreground">
            Çatı alanı ≈ {fmt(roofAreaM2, 1)} m² · Panel alanı ≈ {fmt(usedAreaM2 ?? 0, 1)} m² (kullanım %{roofAreaM2 ? fmt((usedAreaM2! / roofAreaM2) * 100, 0) : 0})
          </p>
        )}
        {perPlane.length > 0 && (
          <div className="border-t pt-2">
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-[10.5px] uppercase text-slate-400"><th className="py-1">Yüzey</th><th className="text-right">Panel</th><th className="text-right">kWp</th><th className="text-right">Eğim/Az</th></tr></thead>
              <tbody>
                {perPlane.map((p, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">{p.name}</td>
                    <td className="text-right tabular-nums">{p.n}</td>
                    <td className="text-right tabular-nums">{fmt(p.kwp, 2)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{p.tilt}°/{p.az}°</td>
                  </tr>
                ))}
              </tbody>
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
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("mt-0.5 text-base font-bold tabular-nums", cls)}>{value}</p>
    </div>
  );
}
