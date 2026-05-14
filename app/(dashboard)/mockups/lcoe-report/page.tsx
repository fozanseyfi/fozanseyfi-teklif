import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  TrendingUp,
  DollarSign,
  Zap,
  Award,
  Download,
  CheckCircle2,
  Calendar,
  FileText,
  Sparkles,
} from "lucide-react";

export default async function LcoeReportMockupPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 px-6 py-7 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">
              LCOE + Banka/Yatırımcı Raporu
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Tek Tıkla Bankaya Veriliebilir Mali Analiz PDF
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              Müşteri "kredi başvurusu yapacağım" diyince ekstra evrak
              hazırlamana gerek yok. Sistem LCOE, IRR, NPV, payback,
              sensitivite analizi içeren bankacı/yatırımcı standartlarında
              PDF üretir. Sektörde TR'de bu yok denecek kadar nadir.
            </p>
          </div>
        </div>
      </div>

      {/* Üst KPI strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="LCOE"
          value="$0.038"
          unit="/kWh"
          tone="emerald"
          sub="Şebeke birim fiyat: $0.105/kWh"
        />
        <KpiCard icon={TrendingUp} label="IRR" value="%21.5" tone="emerald" sub="25 yıl" />
        <KpiCard icon={Award} label="NPV" value="$1.84M" tone="default" sub="r = 12%" />
        <KpiCard icon={Calendar} label="Payback" value="6.2 yıl" tone="default" sub="simple basit" />
      </div>

      {/* PDF kapak önizleme + KPI breakdown */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* PDF cover preview */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" /> PDF Kapak Önizlemesi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Kapak — kağıt look */}
            <div className="aspect-[1/1.4] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8 text-white">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                    Mali Analiz Raporu
                  </p>
                  <h2 className="mt-2 text-3xl font-bold leading-tight">
                    Solar GES Yatırım Analizi
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-300">
                    2.5 MWp Çatı Üstü Sistem · Sanayi Tesisi
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/20 bg-white/5 p-3 backdrop-blur-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      LCOE
                    </p>
                    <p className="mt-1 text-2xl font-bold">$0.038</p>
                    <p className="text-[10px] text-slate-300">per kWh, 25 yıl</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/5 p-3 backdrop-blur-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      IRR
                    </p>
                    <p className="mt-1 text-2xl font-bold">%21.5</p>
                    <p className="text-[10px] text-slate-300">unlevered</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/5 p-3 backdrop-blur-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      NPV
                    </p>
                    <p className="mt-1 text-2xl font-bold">$1.84M</p>
                    <p className="text-[10px] text-slate-300">discount 12%</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/5 p-3 backdrop-blur-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      Payback
                    </p>
                    <p className="mt-1 text-2xl font-bold">6.2 yıl</p>
                    <p className="text-[10px] text-slate-300">basit</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/15 pt-3 text-[10px] text-slate-400">
                  <span>Hazırlayan: Solar EPC A.Ş.</span>
                  <span>14.05.2026</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t bg-slate-50/60 px-4 py-2.5">
              <p className="text-[11.5px] text-slate-600">
                <strong>5 sayfa</strong> · Kapak · KPI · 25 yıl CF · Sensitivite · İmza
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-500"
              >
                <Download className="size-3.5" />
                İndir (PDF)
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Sağ: içerik dökümü */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-[14px]">Rapor İçeriği</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-3 text-[12.5px]">
              <Section icon={Building2} title="Sayfa 1: Kapak">
                Proje özeti, ana KPI'lar (LCOE, IRR, NPV, Payback), firma + tarih
              </Section>
              <Section icon={Zap} title="Sayfa 2: Teknik Özet">
                DC/AC güç, panel/inverter adet, lokasyon, üretim profili (PVGIS)
              </Section>
              <Section icon={DollarSign} title="Sayfa 3: Mali Analiz">
                25 yıl detaylı cash flow tablosu (yıl-yıl üretim/gelir/maliyet/net)
              </Section>
              <Section icon={TrendingUp} title="Sayfa 4: Sensitivite">
                Elektrik fiyatı ±%30, faiz ±%5, güneş düşüşü senaryoları
              </Section>
              <Section icon={Award} title="Sayfa 5: Sonuç + İmza">
                Yatırım önerisi, yasal not, hazırlayan firma kaşesi/imzası
              </Section>
            </CardContent>
          </Card>

          <Card className="border-emerald-200">
            <CardHeader className="border-b bg-emerald-50/40">
              <CardTitle className="flex items-center gap-2 text-[13px] text-emerald-800">
                <Sparkles className="size-4" /> Neden Bu Özellik?
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 text-[12px] leading-relaxed text-slate-700">
              <ul className="space-y-1.5">
                <li className="flex gap-1.5">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                  Yatırımcı/banka standardı metrikler — her seferinde Excel
                  uğraşma
                </li>
                <li className="flex gap-1.5">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                  TR'de çoğu EPC firması bu seviyede rapor hazırlayamıyor —
                  rekabet avantajı
                </li>
                <li className="flex gap-1.5">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                  Müşteri "bu firma kurumsal" hisseder
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sensitivite preview */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" />
            Sensitivite Önizleme — IRR
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Elektrik Fiyatı →</th>
                <th className="px-3 py-2 text-right font-semibold">-%30</th>
                <th className="px-3 py-2 text-right font-semibold">-%15</th>
                <th className="px-3 py-2 text-right font-semibold bg-emerald-50/50">Baz Senaryo</th>
                <th className="px-3 py-2 text-right font-semibold">+%15</th>
                <th className="px-3 py-2 text-right font-semibold">+%30</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { ratio: "Faiz +%5", v: ["%11.2", "%14.6", "%18.4", "%22.1", "%25.6"] },
                { ratio: "Faiz baz", v: ["%14.0", "%17.5", "%21.5", "%25.2", "%28.6"], highlight: true },
                { ratio: "Faiz -%5", v: ["%16.8", "%20.4", "%24.6", "%28.3", "%31.7"] },
              ].map((r, i) => (
                <tr key={i} className={r.highlight ? "bg-emerald-50/40 font-bold" : ""}>
                  <td className="px-3 py-2 text-slate-700">{r.ratio}</td>
                  {r.v.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-3 py-2 text-right tabular-nums ${
                        j === 2 && r.highlight
                          ? "bg-emerald-100 font-bold text-emerald-800"
                          : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  sub: string;
  tone: "emerald" | "default";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div
            className={`flex size-8 items-center justify-center rounded-lg ${
              tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
          {value}
          {unit && <span className="ml-0.5 text-[12px] font-normal text-slate-400">{unit}</span>}
        </p>
        <p className="text-[10.5px] text-slate-500">{sub}</p>
      </CardContent>
    </Card>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 rounded-md border border-slate-200 bg-slate-50/30 p-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-600">{children}</p>
      </div>
    </div>
  );
}
