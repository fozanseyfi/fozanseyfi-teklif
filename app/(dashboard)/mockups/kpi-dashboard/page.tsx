import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  Briefcase,
  Trophy,
  DollarSign,
  Calendar,
  Target,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { KpiTrendChart } from "./trend-chart";

export default async function KpiDashboardMockupPage() {
  await requireAuth();

  // ─── Fake data ──────────────────────────────────────────────────────
  const monthlyData = [
    { month: "Haz", count: 4, mwp: 12 },
    { month: "Tem", count: 6, mwp: 18 },
    { month: "Ağu", count: 5, mwp: 9 },
    { month: "Eyl", count: 8, mwp: 22 },
    { month: "Eki", count: 7, mwp: 17 },
    { month: "Kas", count: 9, mwp: 28 },
    { month: "Ara", count: 6, mwp: 15 },
    { month: "Oca", count: 5, mwp: 11 },
    { month: "Şub", count: 7, mwp: 19 },
    { month: "Mar", count: 8, mwp: 24 },
    { month: "Nis", count: 10, mwp: 32 },
    { month: "May", count: 12, mwp: 38 },
  ];

  const topSalespeople = [
    { name: "Mehmet A.", count: 28, wonRate: 64, ciro: 4_850_000 },
    { name: "Ayşe S.", count: 22, wonRate: 71, ciro: 4_120_000 },
    { name: "Furkan Ozan", count: 18, wonRate: 52, ciro: 2_890_000 },
  ];

  const segmentBreakdown = [
    { name: "Sanayi", count: 38, color: "#059669" },
    { name: "Ticarethane", count: 24, color: "#2563eb" },
    { name: "Tarımsal", count: 12, color: "#d97706" },
    { name: "Mesken", count: 8, color: "#7c3aed" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-7 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
            <BarChart3 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300">
              Yönetici Paneli · Mayıs 2026
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Firmasal Performans
            </h1>
            <p className="mt-1.5 text-sm text-slate-300">
              Bu ay toplam 12 yeni teklif gönderildi · 38 MWp · Kazanma oranı %58
            </p>
          </div>
        </div>
      </div>

      {/* 6 KPI kartı */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={Briefcase}
          label="Bu Ay Teklif"
          value="12"
          delta={+33}
          deltaLabel="geçen ay"
        />
        <KpiCard icon={Zap} label="Toplam MWp" value="38.4" delta={+58} deltaLabel="geçen ay" />
        <KpiCard
          icon={Target}
          label="Kazanma Oranı"
          value="%58"
          delta={+4}
          deltaLabel="3 ay ort."
          deltaUnit="puan"
        />
        <KpiCard
          icon={DollarSign}
          label="Ortalama $/Wp"
          value="$0.62"
          delta={-3}
          deltaLabel="geçen ay"
        />
        <KpiCard
          icon={Calendar}
          label="Bekleyen Ciro"
          value="$3.8M"
          delta={+12}
          deltaLabel="geçen ay"
          subtitle="14 aktif teklif"
        />
        <KpiCard
          icon={Trophy}
          label="Tamamlanan Ciro"
          value="$11.9M"
          delta={+47}
          deltaLabel="Y/Y"
          subtitle="Yıl başından bugüne"
        />
      </div>

      {/* Trend grafiği */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" /> 12 Aylık Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KpiTrendChart data={monthlyData} />
        </CardContent>
      </Card>

      {/* Top satışçılar + segment */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Top 3 Satışçı (yıl başı)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Satışçı</th>
                    <th className="px-3 py-2 text-right font-medium">Teklif</th>
                    <th className="px-3 py-2 text-right font-medium">Win %</th>
                    <th className="px-3 py-2 text-right font-medium">Ciro</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topSalespeople.map((s, i) => (
                    <tr key={s.name} className="hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                              i === 0
                                ? "bg-amber-500"
                                : i === 1
                                  ? "bg-slate-400"
                                  : "bg-amber-700"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="font-medium text-foreground">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.count}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                        %{s.wonRate}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        ${(s.ciro / 1_000_000).toFixed(1)}M
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" /> Müşteri Segmentleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {segmentBreakdown.map((s) => {
                const total = segmentBreakdown.reduce((acc, x) => acc + x.count, 0);
                const pct = ((s.count / total) * 100).toFixed(0);
                return (
                  <li key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.count} · %{pct}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Risk göstergeleri */}
      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-rose-700">
            <AlertTriangle className="size-4" /> Dikkat Edilmesi Gerekenler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-[12.5px]">
            <li className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50/40 p-2.5">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                3
              </span>
              <span>
                <strong>3 ayı geçmiş cevap bekleyen teklif</strong> — 3 müşteri için takip mailı önerilir
              </span>
            </li>
            <li className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/40 p-2.5">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                2
              </span>
              <span>
                <strong>2 paylaşım linki 7 gündür açılmamış</strong> — takip maili göndermeyi düşün
              </span>
            </li>
            <li className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/40 p-2.5">
              <TrendingDown className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
              <span>
                <strong>Ortalama $/Wp 3 ay üst üste düşüyor</strong> — fiyat baskısı artıyor olabilir
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  deltaUnit,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  deltaUnit?: string;
  subtitle?: string;
}) {
  const isUp = delta >= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Icon className="size-4" />
          </div>
          <span
            className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[10px] font-semibold ${
              isUp
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {isUp ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
            {isUp ? "+" : ""}
            {delta}
            {deltaUnit ? ` ${deltaUnit}` : "%"}
          </span>
        </div>
        <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="mt-0.5 text-[10.5px] text-slate-400">
          {subtitle ?? `${deltaLabel}'a göre`}
        </p>
      </CardContent>
    </Card>
  );
}
