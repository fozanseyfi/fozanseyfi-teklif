"use client";

import { useState, useMemo } from "react";
import { saveFizibilite } from "@/app/actions/ges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TARIFF_LABELS } from "@/lib/utils";
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
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Sol: Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tüketim verileri */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Elektrik Tüketim Verileri</h3>
                <p className="text-xs text-slate-400 mt-0.5">Aylık tüketim kWh değerleri</p>
              </div>
            </div>
            <CardContent className="p-6 space-y-5">
              {/* Hızlı giriş */}
              <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)", border: "1px solid #bae6fd" }}>
                <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wider">Hızlı Giriş: Aylık Ortalama</p>
                <div className="flex gap-2.5">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Aylık ortalama tüketim (kWh)"
                      value={annualAvg}
                      onChange={(e) => setAnnualAvg(e.target.value)}
                    />
                    <p className="text-xs text-blue-600 mt-1.5 font-medium">Mevsimsel ağırlıklarla 12 aya otomatik dağıtılır</p>
                  </div>
                  <Button variant="outline" onClick={applyAnnualAvg} type="button" className="flex-shrink-0">
                    <Zap className="w-4 h-4" />
                    Dağıt
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {MONTHS.map((m, i) => (
                  <div key={m} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500">{m}</Label>
                    <Input
                      type="number"
                      className="h-10 text-sm text-center"
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
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-500">Yıllık Toplam</span>
                <span className="font-bold text-slate-800 text-base">{fmtKwh(result.annualConsumption)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Finansal parametreler */}
          <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)", boxShadow: "0 4px 12px rgba(245,158,11,0.35)" }}>
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Finansal Parametreler</h3>
                <p className="text-xs text-slate-400 mt-0.5">Tarife, fiyat ve proje ömrü</p>
              </div>
            </div>
            <CardContent className="p-6 grid grid-cols-2 gap-5">
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
          {/* Yıllık üretim - gradient card */}
          <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", boxShadow: "0 8px 24px rgba(245,158,11,0.35)" }}>
            <div className="absolute right-4 top-4 opacity-15">
              <Sun className="w-16 h-16" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Yıllık Üretim</p>
            <p className="text-3xl font-bold">{fmtKwh(result.annualProduction)}</p>
            <p className="text-xs opacity-75 mt-1.5 leading-relaxed">
              {totalPowerKw > 0 ? `${totalPowerKw.toFixed(1)} kWp × ${s.peakSunHoursPerDay ?? 4.5}h × 365 gün` : "Teknik parametreler girilmedi"}
            </p>
          </div>

          {/* KPI metrics */}
          <Card className="border-0 shadow-md shadow-slate-200/60">
            <CardContent className="p-5 space-y-4">
              {[
                { icon: Zap, color: "text-blue-500", bg: "bg-blue-50", label: "İlk Yıl Tasarruf", value: fmtTry(result.firstYearSaving), valueColor: "text-emerald-600" },
                { icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50", label: `${(s.projectLifeYears ?? 25)}Y Toplam Tasarruf`, value: fmtTry(result.totalSaving), valueColor: "text-slate-800" },
                { icon: Sun, color: "text-yellow-500", bg: "bg-yellow-50", label: "Öz Tüketim", value: fmtKwh(result.selfConsumption), valueColor: "text-slate-700" },
                { icon: Leaf, color: "text-green-500", bg: "bg-green-50", label: "Yıllık CO₂ Azaltım", value: `${result.co2Annual.toFixed(1)} ton`, valueColor: "text-green-600" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <span className="text-sm text-slate-600 font-medium">{item.label}</span>
                  </div>
                  <span className={`font-bold text-sm ${item.valueColor}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Projeksiyon barları */}
          <Card className="border-0 shadow-md shadow-slate-200/60">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Yıllık Tasarruf Projeksiyonu</p>
            </div>
            <CardContent className="p-4">
              <div className="space-y-2">
                {result.yearlySavings.slice(0, 10).map((v, i) => {
                  const pct = result.yearlySavings[result.yearlySavings.length - 1] > 0
                    ? (v / result.yearlySavings[result.yearlySavings.length - 1]) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-2.5 text-xs">
                      <span className="text-slate-400 w-8 font-medium">Y{i + 1}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: "linear-gradient(90deg, #f59e0b, #ea580c)" }} />
                      </div>
                      <span className="text-slate-600 font-semibold w-20 text-right">₺{(v / 1000).toFixed(0)}k</span>
                    </div>
                  );
                })}
                {result.yearlySavings.length > 10 && (
                  <p className="text-xs text-slate-400 text-center pt-1">+{result.yearlySavings.length - 10} yıl daha...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 bg-white rounded-2xl border border-slate-200/70 shadow-sm px-5 py-4">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving}>
          Kaydet & Kesif-A <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
