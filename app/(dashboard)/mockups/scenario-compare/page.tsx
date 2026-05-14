import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  AlertTriangle,
  Layers,
  TrendingUp,
  DollarSign,
  Zap,
  Award,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  panel: string;
  inverter: string;
  capexUsd: number;
  mwp: number;
  annualKwh: number;
  paybackY: number;
  irr: number;
  perKw: number;
  winnerOn: string[];
  recommended?: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    id: "a",
    name: "Senaryo A — Ekonomik",
    panel: "540W · Tier 2 marka",
    inverter: "String, 100kW",
    capexUsd: 980_000,
    mwp: 2.5,
    annualKwh: 3_750_000,
    paybackY: 6.8,
    irr: 18.2,
    perKw: 392,
    winnerOn: ["capex"],
  },
  {
    id: "b",
    name: "Senaryo B — Dengeli",
    panel: "580W · Tier 1 marka",
    inverter: "String, 110kW",
    capexUsd: 1_120_000,
    mwp: 2.7,
    annualKwh: 4_180_000,
    paybackY: 6.2,
    irr: 21.5,
    perKw: 415,
    winnerOn: ["irr", "payback"],
    recommended: true,
  },
  {
    id: "c",
    name: "Senaryo C — Premium",
    panel: "620W · Bifacial Tier 1",
    inverter: "Central, 1.5MW",
    capexUsd: 1_280_000,
    mwp: 2.9,
    annualKwh: 4_640_000,
    paybackY: 6.5,
    irr: 20.8,
    perKw: 441,
    winnerOn: ["mwp", "annualKwh"],
  },
];

export default async function ScenarioCompareMockupPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Geri */}
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
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 px-6 py-7 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <Layers className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">
              A/B Senaryo Karşılaştırma
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Müşteriye Tek Teklif Yerine 3 Seçenek Sun
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              Aynı projeyi 3 farklı senaryoda fiyatla (Ekonomik / Dengeli /
              Premium). Yan yana karşılaştır, paybackın / IRR farkını gör,
              müşteriye "şu 3 alternatifi sunuyoruz" PDF gönder. Closing rate
              %30+ artar.
            </p>
          </div>
        </div>
      </div>

      {/* 3 senaryo kartı */}
      <div className="grid gap-4 lg:grid-cols-3">
        {SCENARIOS.map((s) => (
          <ScenarioCard key={s.id} s={s} />
        ))}
      </div>

      {/* Karşılaştırma tablosu */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" /> Detaylı Karşılaştırma
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Metrik</th>
                {SCENARIOS.map((s) => (
                  <th
                    key={s.id}
                    className={`px-3 py-2 text-right font-semibold ${
                      s.recommended ? "bg-emerald-50 text-emerald-800" : ""
                    }`}
                  >
                    {s.name.split(" — ")[1]}
                    {s.recommended && (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1 py-0 text-[8.5px] font-bold text-white">
                        ÖNERİLEN
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <Row label="CAPEX (USD)" rows={SCENARIOS.map((s) => `$${s.capexUsd.toLocaleString("en-US")}`)} winners={SCENARIOS.map((s) => s.winnerOn.includes("capex"))} />
              <Row label="$/kWp" rows={SCENARIOS.map((s) => `$${s.perKw}`)} winners={SCENARIOS.map((s) => false)} />
              <Row label="DC Güç" rows={SCENARIOS.map((s) => `${s.mwp.toFixed(2)} MWp`)} winners={SCENARIOS.map((s) => s.winnerOn.includes("mwp"))} />
              <Row label="Yıllık Üretim" rows={SCENARIOS.map((s) => `${(s.annualKwh / 1_000_000).toFixed(2)} GWh`)} winners={SCENARIOS.map((s) => s.winnerOn.includes("annualKwh"))} />
              <Row label="Geri Ödeme (yıl)" rows={SCENARIOS.map((s) => `${s.paybackY.toFixed(1)} yıl`)} winners={SCENARIOS.map((s) => s.winnerOn.includes("payback"))} />
              <Row label="IRR" rows={SCENARIOS.map((s) => `%${s.irr.toFixed(1)}`)} winners={SCENARIOS.map((s) => s.winnerOn.includes("irr"))} />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Akıllı öneri kartı */}
      <Card className="border-emerald-200">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
            <Sparkles className="size-4" /> Sistem Önerisi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50/50 p-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div className="text-[13px] leading-relaxed text-slate-700">
              <p>
                <strong className="text-slate-900">Senaryo B — Dengeli</strong>{" "}
                bu proje için optimal: IRR ve geri ödeme süresi en iyi. CAPEX
                Senaryo A'ya göre %14 daha yüksek ama yıllık üretim %11.5 fazla.
                Premium senaryo Bifacial avantajı sağlasa da geri ödemesi B'den
                daha uzun.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
              >
                <ArrowRight className="size-3.5" />3 Senaryolu PDF Oluştur
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ScenarioCard({ s }: { s: Scenario }) {
  return (
    <Card
      className={
        s.recommended
          ? "border-emerald-400 shadow-md ring-1 ring-emerald-200"
          : "border-slate-200"
      }
    >
      <CardHeader
        className={`border-b ${
          s.recommended ? "bg-emerald-50/40" : "bg-slate-50/40"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-[14px]">{s.name}</CardTitle>
          {s.recommended && (
            <Award className="size-4 shrink-0 text-amber-500" />
          )}
        </div>
        <p className="text-[10.5px] text-slate-500">{s.panel}</p>
        <p className="text-[10.5px] text-slate-500">{s.inverter}</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        <Metric icon={DollarSign} label="CAPEX" value={`$${(s.capexUsd / 1000).toFixed(0)}K`} />
        <Metric icon={Zap} label="DC Güç" value={`${s.mwp.toFixed(2)} MWp`} />
        <Metric icon={TrendingUp} label="IRR" value={`%${s.irr.toFixed(1)}`} accent={s.winnerOn.includes("irr")} />
        <Metric icon={Award} label="Payback" value={`${s.paybackY.toFixed(1)} yıl`} accent={s.winnerOn.includes("payback")} />
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12.5px]">
      <span className="flex items-center gap-1.5 text-slate-500">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span
        className={`tabular-nums font-bold ${
          accent ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Row({
  label,
  rows,
  winners,
}: {
  label: string;
  rows: string[];
  winners: boolean[];
}) {
  return (
    <tr className="hover:bg-slate-50/40">
      <td className="px-3 py-2 font-semibold text-slate-700">{label}</td>
      {rows.map((v, i) => (
        <td
          key={i}
          className={`px-3 py-2 text-right tabular-nums ${
            winners[i] ? "bg-emerald-50/50 font-bold text-emerald-700" : "text-slate-700"
          }`}
        >
          {v}
          {winners[i] && (
            <CheckCircle2 className="ml-1 inline size-3 text-emerald-600" />
          )}
        </td>
      ))}
    </tr>
  );
}
