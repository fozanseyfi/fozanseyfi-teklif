"use client";

import { useState, useMemo } from "react";
import { saveFizibilite } from "@/app/actions/ges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TARIFF_LABELS, cn } from "@/lib/utils";
import type { GesSettings } from "@/lib/ges-defaults";
import { Save, ArrowRight, Zap, TrendingUp, Leaf, Sun, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const SEASONAL_WEIGHTS = [0.06, 0.07, 0.09, 0.10, 0.11, 0.11, 0.11, 0.10, 0.09, 0.08, 0.07, 0.01];

interface Props {
  projectId: string;
  settings: GesSettings;
  totalPowerKw: number;
}

type SectionTone = "primary" | "info" | "success" | "warning" | "destructive";

const SECTION_TONE: Record<SectionTone, { iconBg: string; iconText: string }> = {
  primary: { iconBg: "bg-primary-soft", iconText: "text-primary-soft-foreground" },
  info: { iconBg: "bg-info-soft", iconText: "text-info-soft-foreground" },
  success: { iconBg: "bg-success-soft", iconText: "text-success-soft-foreground" },
  warning: { iconBg: "bg-warning-soft", iconText: "text-warning-soft-foreground" },
  destructive: { iconBg: "bg-destructive-soft", iconText: "text-destructive-soft-foreground" },
};

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  tone: SectionTone;
}) {
  const t = SECTION_TONE[tone];
  return (
    <div className="flex items-center gap-3 border-b px-6 py-4">
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", t.iconBg)}>
        <Icon className={cn("size-4", t.iconText)} />
      </div>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function calcFeasibility(settings: GesSettings, totalPowerKw: number) {
  const monthlyKwh = settings.monthlyConsumptionKwh ?? new Array(12).fill(0);
  const annualConsumption = monthlyKwh.reduce((s, v) => s + v, 0);
  const annualProduction = totalPowerKw * (settings.peakSunHoursPerDay ?? 4.5) * 365 * (settings.systemEfficiency ?? 0.80);
  const selfConsumption = Math.min(annualProduction, annualConsumption);
  const gridExport = annualProduction - selfConsumption;
  const unitPrice = settings.electricityUnitPriceTry ?? 3.5;
  const escalation = settings.electricityEscalationRate ?? 0.35;
  const life = settings.projectLifeYears ?? 25;
  let totalSaving = 0;
  let currentPrice = unitPrice;
  const yearlySavings: number[] = [];
  for (let y = 0; y < life; y++) {
    const saving = (selfConsumption + gridExport * 0.9) * currentPrice;
    yearlySavings.push(saving);
    totalSaving += saving;
    currentPrice *= (1 + escalation);
  }
  return { annualConsumption, annualProduction, selfConsumption, gridExport, firstYearSaving: yearlySavings[0] ?? 0, totalSaving, yearlySavings, co2Annual: annualProduction * 0.0005 };
}

export function FizibiliteForm({ projectId, settings, totalPowerKw }: Props) {
  const [s, setS] = useState<GesSettings>({
    ...settings,
    monthlyConsumptionKwh: settings.monthlyConsumptionKwh?.length === 12
      ? settings.monthlyConsumptionKwh
      : new Array(12).fill(0),
  });
  const [saving, setSaving] = useState(false);
  const [annualAvg, setAnnualAvg] = useState<string>("");

  const result = useMemo(() => calcFeasibility(s, totalPowerKw), [s, totalPowerKw]);

  function applyAnnualAvg() {
    const total = parseFloat(annualAvg) * 12 || 0;
    if (!total) return;
    const monthly = SEASONAL_WEIGHTS.map((w) => Math.round(total * w));
    setS((p) => ({ ...p, monthlyConsumptionKwh: monthly }));
  }

  async function handleSave(goNext = false) {
    setSaving(true);
    try {
      await saveFizibilite(projectId, s as never);
      toast.success("Fizibilite verileri kaydedildi");
      if (goNext) window.location.href = `/projects/${projectId}/detail/kesif-a`;
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  function fmtTry(n: number) { return `₺${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`; }
  function fmtKwh(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} GWh`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)} MWh`;
    return `${n.toFixed(0)} kWh`;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Sol: Form */}
        <div className="space-y-5 lg:col-span-2">
          {/* Tüketim verileri */}
          <Card className="overflow-hidden">
            <SectionHeader
              icon={BarChart3}
              title="Elektrik Tüketim Verileri"
              subtitle="Aylık tüketim kWh değerleri"
              tone="info"
            />
            <CardContent className="space-y-5 p-6">
              {/* Hızlı giriş */}
              <div className="rounded-xl border bg-info-soft p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-info-soft-foreground">Hızlı Giriş: Aylık Ortalama</p>
                <div className="flex gap-2.5">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Aylık ortalama tüketim (kWh)"
                      value={annualAvg}
                      onChange={(e) => setAnnualAvg(e.target.value)}
                    />
                    <p className="mt-1.5 text-xs font-medium text-info-soft-foreground">Mevsimsel ağırlıklarla 12 aya otomatik dağıtılır</p>
                  </div>
                  <Button data-edit-only variant="outline" onClick={applyAnnualAvg} type="button" className="shrink-0">
                    <Zap className="size-4" />
                    Dağıt
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {MONTHS.map((m, i) => (
                  <div key={m} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">{m}</Label>
                    <Input
                      type="number"
                      className="h-10 text-center text-sm"
                      value={s.monthlyConsumptionKwh[i] || ""}
                      onChange={(e) => {
                        const arr = [...s.monthlyConsumptionKwh];
                        arr[i] = parseFloat(e.target.value) || 0;
                        setS((p) => ({ ...p, monthlyConsumptionKwh: arr }));
                      }}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground">Yıllık Toplam</span>
                <span className="text-base font-semibold text-foreground">{fmtKwh(result.annualConsumption)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Finansal parametreler */}
          <Card className="overflow-hidden">
            <SectionHeader
              icon={TrendingUp}
              title="Finansal Parametreler"
              subtitle="Tarife, fiyat ve proje ömrü"
              tone="warning"
            />
            <CardContent className="grid grid-cols-2 gap-5 p-6">
              <div className="space-y-2">
                <Label>Tarife Tipi</Label>
                <Select
                  value={s.electricityTariff || "INDUSTRIAL"}
                  onValueChange={(v) => setS((p) => ({ ...p, electricityTariff: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TARIFF_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Birim Fiyat (TL/kWh)</Label>
                <Input type="number" step="0.001" value={s.electricityUnitPriceTry ?? 3.5} onChange={(e) => setS((p) => ({ ...p, electricityUnitPriceTry: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Yıllık Elektrik Artış (%)</Label>
                <Input type="number" step="1" value={((s.electricityEscalationRate ?? 0.35) * 100).toFixed(0)} onChange={(e) => setS((p) => ({ ...p, electricityEscalationRate: (parseFloat(e.target.value) || 0) / 100 }))} />
              </div>
              <div className="space-y-2">
                <Label>Yıllık Enflasyon (%)</Label>
                <Input type="number" step="1" value={((s.annualInflationRate ?? 0.40) * 100).toFixed(0)} onChange={(e) => setS((p) => ({ ...p, annualInflationRate: (parseFloat(e.target.value) || 0) / 100 }))} />
              </div>
              <div className="space-y-2">
                <Label>Proje Ömrü (yıl)</Label>
                <Input type="number" value={s.projectLifeYears ?? 25} onChange={(e) => setS((p) => ({ ...p, projectLifeYears: parseInt(e.target.value) || 25 }))} />
              </div>
              <div className="space-y-2">
                <Label>Zirve Güneş Saati (h/gün)</Label>
                <Input type="number" step="0.1" value={s.peakSunHoursPerDay ?? 4.5} onChange={(e) => setS((p) => ({ ...p, peakSunHoursPerDay: parseFloat(e.target.value) || 4.5 }))} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Sistem Verimi (%)</Label>
                <Input type="number" step="1" value={((s.systemEfficiency ?? 0.80) * 100).toFixed(0)} onChange={(e) => setS((p) => ({ ...p, systemEfficiency: (parseFloat(e.target.value) || 80) / 100 }))} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ: Sonuçlar */}
        <div className="space-y-4">
          {/* Yıllık üretim - hero card */}
          <Card className="overflow-hidden">
            <CardContent className="relative p-5">
              <div className="absolute right-4 top-4 opacity-10">
                <Sun className="size-16 text-primary" />
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Yıllık Üretim</p>
              <p className="text-3xl font-bold text-primary-soft-foreground">{fmtKwh(result.annualProduction)}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {totalPowerKw > 0 ? `${totalPowerKw.toFixed(1)} kWp × ${s.peakSunHoursPerDay ?? 4.5}h × 365 gün` : "Teknik parametreler girilmedi"}
              </p>
            </CardContent>
          </Card>

          {/* KPI metrics */}
          <Card>
            <CardContent className="space-y-4 p-5">
              {[
                { icon: Zap, iconBg: "bg-info-soft", iconText: "text-info-soft-foreground", label: "İlk Yıl Tasarruf", value: fmtTry(result.firstYearSaving), valueColor: "text-success-soft-foreground" },
                { icon: TrendingUp, iconBg: "bg-warning-soft", iconText: "text-warning-soft-foreground", label: `${(s.projectLifeYears ?? 25)}Y Toplam Tasarruf`, value: fmtTry(result.totalSaving), valueColor: "text-foreground" },
                { icon: Sun, iconBg: "bg-warning-soft", iconText: "text-warning-soft-foreground", label: "Öz Tüketim", value: fmtKwh(result.selfConsumption), valueColor: "text-foreground" },
                { icon: Leaf, iconBg: "bg-success-soft", iconText: "text-success-soft-foreground", label: "Yıllık CO₂ Azaltım", value: `${result.co2Annual.toFixed(1)} ton`, valueColor: "text-success-soft-foreground" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", item.iconBg)}>
                      <item.icon className={cn("size-4", item.iconText)} />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                  </div>
                  <span className={cn("text-sm font-semibold", item.valueColor)}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Projeksiyon barları */}
          <Card>
            <div className="border-b px-5 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Yıllık Tasarruf Projeksiyonu</p>
            </div>
            <CardContent className="p-4">
              <div className="space-y-2">
                {result.yearlySavings.slice(0, 10).map((v, i) => {
                  const pct = result.yearlySavings[result.yearlySavings.length - 1] > 0
                    ? (v / result.yearlySavings[result.yearlySavings.length - 1]) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-2.5 text-xs">
                      <span className="w-8 font-medium text-muted-foreground">Y{i + 1}</span>
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="w-20 text-right font-semibold text-foreground">₺{(v / 1000).toFixed(0)}k</span>
                    </div>
                  );
                })}
                {result.yearlySavings.length > 10 && (
                  <p className="pt-1 text-center text-xs text-muted-foreground">+{result.yearlySavings.length - 10} yıl daha...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div data-edit-only className="flex items-center justify-end gap-2.5 rounded-xl border bg-card px-5 py-4 shadow-sm">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving}>
          Kaydet & Kesif-A <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
