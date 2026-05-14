import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  AlertTriangle,
  Brain,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Info,
  CheckCircle2,
  X,
} from "lucide-react";

// 4 örnek kalem — uyarı gösterilen + normal karışık
const ITEMS = [
  {
    code: "A.1.1",
    tanim: "Solar Panel 540W",
    marka: "Trina",
    miktar: "100.000 Wp",
    fiyat: 0.21,
    avg: 0.185,
    diff: 13.5,
    warn: "high" as const,
    msg: "Bu sınıf panel için geçmiş projelerde ortalama $0.185/Wp ödediniz — bu teklif %13.5 daha pahalı.",
  },
  {
    code: "A.2.1",
    tanim: "String İnverter 100kW",
    marka: "Huawei",
    miktar: "10 adet",
    fiyat: 4400,
    avg: 4500,
    diff: -2.2,
    warn: null,
  },
  {
    code: "A.4.1",
    tanim: "DC Kablo 1x6",
    marka: "Nexans",
    miktar: "12.000 mt",
    fiyat: 0.95,
    avg: 0.72,
    diff: 31.9,
    warn: "high" as const,
    msg: "Geçmiş 8 projedeki ortalama $0.72/mt — bu fiyat %31.9 yüksek. Tedarikçi farklılığı olabilir, doğrula.",
  },
  {
    code: "A.7.1",
    tanim: "Çatı Konstrüksiyon",
    marka: "—",
    miktar: "1 MW",
    fiyat: 28_000,
    avg: 38_500,
    diff: -27.3,
    warn: "low" as const,
    msg: "Şu kadar düşük fiyat şüpheli — kaliteyi veya kapsamı doğrula. Geçmişte $38K civarıydı.",
  },
];

export default async function AnomalyWarnMockupPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-900 via-rose-900 to-amber-900 px-6 py-7 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-amber-900 shadow-sm">
            <Brain className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">
              Akıllı Maliyet Uyarısı
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Kendi Tarihinden Öğrenen Anomaly Detection
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              Sen Keşif kalemlerini girerken sistem arka planda{" "}
              <strong>geçmiş projelerine</strong> bakar. Bu marka/sınıf/birim
              için ortalama ne ödedin? Bu teklif %15+ sapmışsa anlık sarı
              uyarı — "Bir kontrol et" demek için. "AI gibi" hisseder, satışçı
              hatalı teklif göndermez.
            </p>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Toplam Kalem" value="42" hint="bu projede" />
        <StatCard label="Anomali Tespit" value="3" hint="sarı uyarı" tone="warn" />
        <StatCard label="Ort. Doğruluk" value="%94" hint="geçmişe göre" tone="ok" />
        <StatCard label="Veri Kaynağı" value="18 proje" hint="son 24 ay" />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-emerald-600" />
            Keşif Girişi — Canlı Anomali Tespiti
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Kod</th>
                <th className="px-3 py-2 text-left font-semibold">Tanım</th>
                <th className="px-3 py-2 text-left font-semibold">Marka</th>
                <th className="px-3 py-2 text-right font-semibold">Miktar</th>
                <th className="px-3 py-2 text-right font-semibold">Fiyat</th>
                <th className="px-3 py-2 text-right font-semibold">Ortalama</th>
                <th className="px-3 py-2 text-right font-semibold">Fark</th>
                <th className="px-3 py-2 text-left font-semibold">Uyarı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ITEMS.map((it) => (
                <tr
                  key={it.code}
                  className={
                    it.warn === "high"
                      ? "bg-rose-50/40"
                      : it.warn === "low"
                        ? "bg-amber-50/40"
                        : "hover:bg-slate-50/40"
                  }
                >
                  <td className="px-3 py-2 font-mono text-[10.5px] text-slate-500">
                    {it.code}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {it.tanim}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{it.marka}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {it.miktar}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                    ${typeof it.fiyat === "number" && it.fiyat < 10 ? it.fiyat.toFixed(2) : it.fiyat.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    ${typeof it.avg === "number" && it.avg < 10 ? it.avg.toFixed(2) : it.avg.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums ${
                        Math.abs(it.diff) < 10
                          ? "bg-emerald-50 text-emerald-700"
                          : it.diff > 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {it.diff > 0 ? (
                        <TrendingUp className="size-2.5" />
                      ) : (
                        <TrendingDown className="size-2.5" />
                      )}
                      {it.diff > 0 ? "+" : ""}
                      {it.diff.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {it.warn === "high" ? (
                      <AlertTriangle className="size-4 text-rose-500" />
                    ) : it.warn === "low" ? (
                      <Info className="size-4 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Popover preview — uyarı tıklayınca açılan kart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-rose-200">
          <CardHeader className="border-b bg-rose-50/40">
            <CardTitle className="flex items-center gap-2 text-[14px] text-rose-700">
              <AlertTriangle className="size-4" />
              Yüksek Sapma — A.4.1
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3">
            <div className="rounded-md border border-rose-200 bg-white p-3">
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-rose-700">
                AI Açıklama
              </p>
              <p className="text-[12.5px] leading-relaxed text-slate-700">
                {ITEMS[2].msg}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                Geçmiş Projeler ($)
              </p>
              <div className="space-y-1 text-[11.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Proje 2024-A · 1.2 MWp</span>
                  <span className="tabular-nums">$0.68/mt</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proje 2024-D · 5.4 MWp</span>
                  <span className="tabular-nums">$0.74/mt</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proje 2025-B · 2.0 MWp</span>
                  <span className="tabular-nums">$0.71/mt</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                  <span>Ortalama (8 proje)</span>
                  <span className="tabular-nums text-emerald-700">$0.72/mt</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-rose-600 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-rose-500"
              >
                Tedarikçiyle Doğrula
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X className="inline size-3" /> Bilinçli, Görmezden Gel
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardHeader className="border-b bg-amber-50/40">
            <CardTitle className="flex items-center gap-2 text-[14px] text-amber-700">
              <Info className="size-4" />
              Düşük Sapma — A.7.1
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3">
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-700">
                AI Açıklama
              </p>
              <p className="text-[12.5px] leading-relaxed text-slate-700">
                {ITEMS[3].msg}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-amber-50/30 p-3 text-[12px] text-slate-700">
              Olası nedenler: <strong>tip eşleşmesi yanlış</strong> (galvanizli
              değil paslanmaz), <strong>kapsam farkı</strong> (montaj dahil
              değil), veya <strong>fiyat hatası</strong>. Acele etme.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "warn" | "ok";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-bold tabular-nums ${
            tone === "warn" ? "text-rose-700" : tone === "ok" ? "text-emerald-700" : "text-slate-900"
          }`}
        >
          {value}
        </p>
        <p className="text-[10.5px] text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}
