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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDesignStore } from "@/lib/solar-design/store";
import type { EditorMode } from "./canvas-editor";
import { detectOuterBoundary } from "@/lib/solar-design/faces";
import { computeLayout, panelsKwp } from "@/lib/solar-design/layout-engine";
import { generateRoof, planeAreaM2 } from "@/lib/solar-design/roof-model";
import type { RoofModel } from "@/lib/solar-design/roof-model";
import type { Vec, RoofType } from "@/lib/solar-design/types";

const CanvasEditor = dynamic(() => import("./canvas-editor"), { ssr: false });
const MapPicker = dynamic(() => import("./map-picker"), { ssr: false });
const CropStep = dynamic(() => import("./crop-step"), { ssr: false });
const ThreeView = dynamic(() => import("./three-view"), { ssr: false });

type StepKey = "gorsel" | "cizim" | "panel" | "analiz";
const STEPS: { key: StepKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "gorsel", label: "Görüntü & Ölçek", icon: MapIcon },
  { key: "cizim", label: "Çatıyı Belirle", icon: PencilRuler },
  { key: "panel", label: "Panel Yerleşimi", icon: LayoutGrid },
  { key: "analiz", label: "Analiz", icon: Zap },
];

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
  const [tool, setTool] = useState<"select" | "draw">("select");
  // "Çatıyı Belirle" ve "Panel Yerleşimi" adımlarında 2B ↔ 3B geçişi.
  const [cizimView, setCizimView] = useState<"2d" | "3d">("2d");
  const [panelView, setPanelView] = useState<"2d" | "3d">("2d");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedFaceSig, setSelectedFaceSig] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState(false);
  const [pending, setPending] = useState<{ dataUrl: string; mpp: number } | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- adım değişince aracı sıfırla (dış senkronizasyon)
  useEffect(() => { if (step !== "cizim") setTool("select"); }, [step]);

  const mpp = doc.metersPerPixel;
  const locked = doc.locked;
  const totalPanels = doc.placed.length;
  const totalKwp = panelsKwp(totalPanels, doc.panelConfig.watt);

  // Bina ayak izi (dış hat) + parametrik çatı düzlemleri.
  const footprint = useMemo<Vec[]>(() => {
    const ids = detectOuterBoundary(doc.nodes, doc.edges);
    if (!ids) return [];
    const byId = new Map(doc.nodes.map((n) => [n.id, n]));
    return ids.map((id) => byId.get(id)).filter(Boolean).map((n) => ({ x: n!.x, y: n!.y }));
  }, [doc.nodes, doc.edges]);
  const roofModel = useMemo(
    () => generateRoof(footprint, doc.roofType, doc.pitchDeg, doc.ridgeAxisDeg, doc.baseHeight || 0, mpp || 0.05),
    [footprint, doc.roofType, doc.pitchDeg, doc.ridgeAxisDeg, doc.baseHeight, mpp],
  );

  const setLocked = (v: boolean) => update((d) => { d.locked = v; });

  const is3D = (step === "cizim" && cizimView === "3d") || (step === "panel" && panelView === "3d");
  const mode: EditorMode =
    step === "panel" ? "panel-select"
      : step === "cizim" ? (locked ? "view" : tool === "draw" ? "draw" : "roof-select")
        : "view";

  const showMap = step === "gorsel" && mapMode && !pending;
  const showCrop = step === "gorsel" && !!pending;
  const showCanvasToolbar = step === "cizim" && cizimView === "2d" && !locked;

  function autoLayout() {
    if (!mpp) { toast.error("Ölçek bulunamadı — altlığı haritadan alın."); return; }
    if (!roofModel.planes.length) { toast.error("Önce bina hattını çizip çatı tipini seçin."); return; }
    const placed = roofModel.planes.flatMap((pl) => computeLayout(pl.poly, pl.id, doc.panelConfig, mpp));
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
          const gated = s.key === "panel" && !locked; // panel yerleşimi çatı kilitliyken
          return (
            <button key={s.key} type="button" onClick={() => setStep(s.key)}
              className={cn("inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all", active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900")}>
              <Icon className="size-4" /> {s.label}
              {gated && <Lock className="size-3 opacity-60" />}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {/* 2B / 3B geçişi (Çatıyı Belirle + Panel Yerleşimi) */}
          {step === "cizim" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex w-fit items-center gap-1 rounded-lg border bg-card p-1">
                <ToolBtn active={cizimView === "2d"} onClick={() => setCizimView("2d")} icon={PencilRuler} label="2B Çizim" />
                <ToolBtn active={cizimView === "3d"} onClick={() => setCizimView("3d")} icon={Box} label="3B Model" />
              </div>
              {locked ? (
                <Button size="sm" variant="outline" onClick={() => setLocked(false)}><Unlock className="size-4" /> Kilidi Aç (düzenle)</Button>
              ) : (
                <Button size="sm" onClick={() => { setLocked(true); setStep("panel"); toast.success("Çatı kilitlendi — panel yerleşimine geçildi"); }}><Lock className="size-4" /> Çatıyı Tamamla ve Kilitle</Button>
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
                <span className="text-[11px] text-muted-foreground">Panel tıkla (Shift çoklu) · sürükle-taşı · <b>R</b> döndür · <b>Del</b> sil · üst üste gelemez</span>
              )}
            </div>
          )}

          {showCanvasToolbar && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-1.5">
              <ToolBtn active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Seç / Taşı" />
              <ToolBtn active={tool === "draw"} onClick={() => setTool("draw")} icon={PencilRuler} label="Çiz" />
              <span className="ml-auto text-[11px] text-muted-foreground">
                {tool === "draw"
                  ? "Tıkla: nokta · Çizgiye tıkla: araya nokta · Bitir/İptal tuval üstünde"
                  : "Nokta sürükle (birleştir) · Çizgiye tıkla: araya nokta · Sağ tık: sil"}
              </span>
            </div>
          )}

          {step === "cizim" && locked && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800">
              <Lock className="size-4 shrink-0" /> Çatı kilitli — düzenlemek için “Kilidi Aç”. Panel yerleşimi için “Panel Yerleşimi” sekmesine geç.
            </div>
          )}

          <div className="h-[calc(100vh-16rem)] min-h-[440px]">
            {showMap ? (
              <MapPicker onCapture={(dataUrl, m) => setPending({ dataUrl, mpp: m })} onCancel={() => setMapMode(false)} />
            ) : showCrop ? (
              <CropStep src={pending!.dataUrl} onConfirm={(cropped) => { update((d) => { d.imageDataUrl = cropped; d.metersPerPixel = pending!.mpp; }); setPending(null); setMapMode(false); toast.success("Altlık hazır — “Çatıyı Belirle”ye geç"); }} onCancel={() => setPending(null)} />
            ) : is3D ? (
              mpp ? <ThreeView /> : <div className="flex h-full items-center justify-center rounded-xl border bg-slate-100 text-sm text-slate-400">Önce haritadan ölçekli altlık alın, sonra bina hattını çizin.</div>
            ) : (
              <CanvasEditor mode={mode} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} selectedFaceSig={selectedFaceSig} onSelectFace={setSelectedFaceSig} />
            )}
          </div>
        </div>

        <div className="space-y-3">
          {step === "gorsel" && <GorselPanel mpp={mpp} hasImage={!!doc.imageDataUrl} onMap={() => { setPending(null); setMapMode(true); }} onUpload={(url) => update((d) => { d.imageDataUrl = url; })} />}
          {step === "cizim" && !locked && cizimView === "2d" && <CizimPanel footprintCount={footprint.length} />}
          {step === "cizim" && !locked && cizimView === "3d" && <RoofPanel update={update} />}
          {step === "cizim" && locked && <LockPanel onUnlock={() => setLocked(false)} onPanel={() => setStep("panel")} />}
          {step === "panel" && <PanelPanel update={update} onAuto={autoLayout} totalPanels={totalPanels} totalKwp={totalKwp} locked={locked} onEditRoof={() => { setLocked(false); setStep("cizim"); }} />}
          {step === "analiz" && <AnalizPanel model={roofModel} totalPanels={totalPanels} totalKwp={totalKwp} />}
          <StepNav step={step} setStep={setStep} />
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

function StepNav({ step, setStep }: { step: StepKey; setStep: (s: StepKey) => void }) {
  const i = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setStep(STEPS[i - 1].key)}><ArrowLeft className="size-4" /> Geri</Button>
      <Button size="sm" disabled={i === STEPS.length - 1} onClick={() => setStep(STEPS[i + 1].key)}>İlerle <ArrowRight className="size-4" /></Button>
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

function CizimPanel({ footprintCount }: { footprintCount: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">Bina Hattı (Footprint)</p>
        <p className="text-[12px] text-muted-foreground">
          “Çiz” aracıyla binanın <b>dış hattını</b> tıklaya tıklaya çiz ve kapat (ilk noktaya dön). Sonra <b>3B Model</b> sekmesinden çatı tipini ve eğimini seç — çatı otomatik, kusursuz üretilir.
        </p>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Hat köşesi</p>
          <p className="text-lg font-bold text-slate-900">{footprintCount}</p>
        </div>
        {footprintCount < 3 && <p className="text-[11px] text-amber-600">En az 3 köşeli kapalı bir alan çizin.</p>}
      </CardContent>
    </Card>
  );
}

const ROOF_TYPES: { v: RoofType; label: string; desc: string }[] = [
  { v: "flat", label: "Düz", desc: "Yatay teras çatı" },
  { v: "gable", label: "Beşik", desc: "İki yöne eğimli, ortada sırt" },
  { v: "hip", label: "Kırma", desc: "Tüm kenarlardan eğimli" },
];

function RoofPanel({ update }: { update: ReturnType<typeof useDesignStore.getState>["update"] }) {
  const doc = useDesignStore((s) => s.active)!;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-800">Çatı</p>
        <div className="space-y-1">
          <Label className="text-[11px]">Çatı tipi</Label>
          <Select value={doc.roofType} onValueChange={(v) => update((d) => { d.roofType = v as RoofType; })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROOF_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label} — {t.desc}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label className="text-[11px]">Saçak / duvar yüksekliği</Label><span className="text-[12px] font-semibold text-emerald-700">{fmt(doc.baseHeight || 0, 1)} m</span></div>
          <Slider min={0} max={20} step={0.5} value={[Math.min(20, doc.baseHeight || 0)]} onValueChange={(v) => update((d) => { d.baseHeight = v[0]; })} />
        </div>
        {doc.roofType !== "flat" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-[11px]">Eğim</Label><span className="text-[12px] font-semibold text-emerald-700">{doc.pitchDeg}°</span></div>
            <Slider min={5} max={60} step={1} value={[doc.pitchDeg]} onValueChange={(v) => update((d) => { d.pitchDeg = v[0]; })} />
          </div>
        )}
        {doc.roofType === "gable" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-[11px]">Sırt (ridge) yönü</Label><span className="text-[12px] font-semibold text-emerald-700">{doc.ridgeAxisDeg}°</span></div>
            <Slider min={0} max={180} step={5} value={[doc.ridgeAxisDeg]} onValueChange={(v) => update((d) => { d.ridgeAxisDeg = v[0]; })} />
          </div>
        )}
        <p className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-500">Çatı, bina dış hattından <b>otomatik</b> üretilir — her düzlem tam düz ve su geçirmez. Panel bu düzlemlere kusursuz oturur.</p>
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

function AnalizPanel({ model, totalPanels, totalKwp }: { model: RoofModel; totalPanels: number; totalKwp: number }) {
  const doc = useDesignStore((s) => s.active)!;
  const mpp = doc.metersPerPixel;
  const yieldKwhKwp = CITY_YIELD[doc.city] ?? 1500;
  const annual = totalKwp * yieldKwhKwp;
  const roofAreaM2 = mpp ? model.planes.reduce((s, pl) => s + planeAreaM2(pl, mpp), 0) : null;
  const usedAreaM2 = mpp ? doc.placed.reduce((s, p) => s + p.w * p.h, 0) * mpp ** 2 : null;
  const perFace = model.planes.map((pl) => {
    const n = doc.placed.filter((p) => p.face === pl.id).length;
    return { name: pl.name, n, kwp: panelsKwp(n, doc.panelConfig.watt) };
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
