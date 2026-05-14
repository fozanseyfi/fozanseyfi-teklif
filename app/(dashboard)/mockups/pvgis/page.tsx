import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  AlertTriangle,
  Sun,
  MapPin,
  Zap,
  TrendingUp,
  DollarSign,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { PvgisChart } from "./pvgis-chart";

export default async function PvgisMockupPage() {
  await requireAuth();

  // ─── Fake PVGIS verisi (Konya, 39.84°N, 32.51°E için tipik değerler) ──
  const monthlyProduction = [
    { month: "Oca", kwh: 95, kwhOld: 80 },
    { month: "Şub", kwh: 112, kwhOld: 100 },
    { month: "Mar", kwh: 142, kwhOld: 130 },
    { month: "Nis", kwh: 165, kwhOld: 150 },
    { month: "May", kwh: 188, kwhOld: 165 },
    { month: "Haz", kwh: 198, kwhOld: 170 },
    { month: "Tem", kwh: 205, kwhOld: 175 },
    { month: "Ağu", kwh: 192, kwhOld: 170 },
    { month: "Eyl", kwh: 168, kwhOld: 155 },
    { month: "Eki", kwh: 132, kwhOld: 125 },
    { month: "Kas", kwh: 100, kwhOld: 95 },
    { month: "Ara", kwh: 88, kwhOld: 75 },
  ];

  const yearlyTotal = monthlyProduction.reduce((a, b) => a + b.kwh, 0);
  const yearlyTotalOld = monthlyProduction.reduce((a, b) => a + b.kwhOld, 0);
  const improvement = (((yearlyTotal - yearlyTotalOld) / yearlyTotalOld) * 100).toFixed(1);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Geri linki + uyarı */}
      <div className="flex items-center justify-between">
        <Link
          href="/mockups"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-3.5" />
          Mockup Listesine Dön
        </Link>
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
          <AlertTriangle className="mr-1 size-2.5" />
          Önizleme · Sahte Veri
        </Badge>
      </div>

      {/* Hero */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Sun className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">
                B1 — PVGIS Üretim Simülasyonu
              </p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Lokasyon-Bazlı Gerçekçi Yıllık Üretim
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Şu an fizibilite kaba (peakSunHoursPerDay × 365). PVGIS API ile
                lokasyon ve eğim/azimuth bilgileriyle saatlik üretim profili çekilir;
                IRR ve geri ödeme süresi gerçek değerlere yakın olur.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4" /> Lokasyon & Sistem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                İl
              </label>
              <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px]">
                <option>Konya</option>
                <option>Ankara</option>
                <option>İstanbul</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                İlçe
              </label>
              <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px]">
                <option>Selçuklu</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                Eğim (°)
              </label>
              <input
                type="number"
                defaultValue={30}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                Azimut (°)
              </label>
              <input
                type="number"
                defaultValue={180}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] tabular-nums"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11.5px] text-slate-500">
              📍 Koordinat: <strong>39.84°N, 32.51°E</strong> — Konya/Selçuklu
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-700">
              <Sun className="size-3" />
              PVGIS Europa verisi (canlı) ✓
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Karşılaştırma KPI */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              Eski Hesap (kaba)
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-500">
              {yearlyTotalOld.toLocaleString("tr-TR")} kWh/kWp
            </p>
            <p className="mt-0.5 text-[10.5px] text-slate-400">peakSunHours × 365</p>
          </CardContent>
        </Card>
        <Card className="border-amber-300">
          <CardContent className="p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">
              PVGIS Sonucu
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
              {yearlyTotal.toLocaleString("tr-TR")} kWh/kWp
            </p>
            <p className="mt-0.5 text-[10.5px] text-amber-600">
              Saatlik irradiation + sıcaklık etkili
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              Fark
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-2xl font-bold tabular-nums text-emerald-700">
              <TrendingUp className="size-5" />+{improvement}%
            </p>
            <p className="mt-0.5 text-[10.5px] text-slate-400">
              Doğru üretim → doğru IRR
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aylık grafik */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="size-4" /> Aylık Üretim Profili (kWh/kWp)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PvgisChart data={monthlyProduction} />
          <p className="mt-2 text-[11px] text-slate-500">
            Mavi: PVGIS API · Gri: eski kaba hesap. Fark özellikle yaz aylarında belirgin.
          </p>
        </CardContent>
      </Card>

      {/* Fizibilite etkisi */}
      <Card className="border-emerald-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="size-4" /> Fizibilite Sonuçlarına Etkisi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                Yıllık Üretim
              </p>
              <p className="mt-1 text-[15px] font-bold tabular-nums">
                <span className="text-slate-400 line-through">2.21 GWh</span>
                <ArrowRight className="mx-1 inline size-3 text-emerald-600" />
                <span className="text-emerald-700">2.42 GWh</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                Yıllık Gelir
              </p>
              <p className="mt-1 text-[15px] font-bold tabular-nums">
                <span className="text-slate-400 line-through">$182K</span>
                <ArrowRight className="mx-1 inline size-3 text-emerald-600" />
                <span className="text-emerald-700">$199K</span>
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                Geri Ödeme Süresi
              </p>
              <p className="mt-1 text-[15px] font-bold tabular-nums">
                <span className="text-slate-400 line-through">6.8 yıl</span>
                <ArrowRight className="mx-1 inline size-3 text-emerald-600" />
                <span className="text-emerald-700">6.2 yıl</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notlar */}
      <Card>
        <CardContent className="space-y-2 p-5 text-[12.5px] text-slate-600">
          <h3 className="font-semibold text-slate-900">İmplementasyon notları</h3>
          <ul className="space-y-1.5">
            <li>
              <strong>PVGIS API</strong>: re.jrc.ec.europa.eu/api/v5_3/PVcalc — ücretsiz, Europe
              dahil Türkiye coordinatları çalışır.
            </li>
            <li>
              <strong>İl/ilçe → enlem/boylam</strong>: server-side bir lookup tablosu (TR
              81 il + ilçeler).
            </li>
            <li>
              <strong>Cache</strong>: aynı lokasyon için günde 1 kere çek, sonraki çağrılar
              cache'ten gelir (PVGIS verisi günlük güncellenmez).
            </li>
            <li>
              <strong>Fizibilite entegrasyonu</strong>: settings.peakSunHoursPerDay yerine
              PVGIS'ten gelen aylık profil kullanılır; IRR/NPV otomatik güncellenir.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
