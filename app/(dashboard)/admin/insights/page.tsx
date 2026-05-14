import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  Briefcase,
  Trophy,
  DollarSign,
  Target,
  AlertTriangle,
  PieChart,
  Mail,
  Clock,
} from "lucide-react";
import {
  getKpiSnapshot,
  getMonthlyTrend,
  getTopSalespeople,
  getStatusBreakdown,
  getRiskFlags,
  type RiskFlag,
} from "@/lib/insights";
import { formatNumber } from "@/lib/utils";
import { KpiTrendChart } from "./trend-chart";
import { YearlyReportButton } from "./yearly-report-button";
import Link from "next/link";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export default async function AdminInsightsPage() {
  const user = await requireAuth();
  if (!isAdmin(user)) redirect("/dashboard");

  const [snapshot, trend, topSellers, statusBreakdown, risks] = await Promise.all([
    getKpiSnapshot(user.organizationId),
    getMonthlyTrend(user.organizationId, 12),
    getTopSalespeople(user.organizationId, 3),
    getStatusBreakdown(user.organizationId),
    getRiskFlags(user.organizationId),
  ]);

  const now = new Date();
  const monthLabel = `${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Y/Y delta — geçen yıl aynı ay
  const yoyDelta = computeYoYDelta(snapshot.thisMonthCount, snapshot.lastYearSameMonthCount);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-7 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
              <BarChart3 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300">
                Yönetici Paneli · {monthLabel}
              </p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
                Firmasal Performans
              </h1>
              <p className="mt-1.5 text-sm text-slate-300">
                Bu ay {snapshot.thisMonthCount} yeni teklif ·{" "}
                {formatNumber(snapshot.thisMonthMwp, 1)} MWp
                {snapshot.winRate30d !== null && (
                  <> · Son 30g kazanma oranı %{snapshot.winRate30d}</>
                )}
              </p>
            </div>
          </div>
          <YearlyReportButton currentYear={now.getFullYear()} />
        </div>
      </div>

      {/* 6 KPI kartı */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={Briefcase}
          label="Bu Ay Teklif"
          value={String(snapshot.thisMonthCount)}
          delta={yoyDelta}
          deltaLabel="geçen yıl"
          subtitle={
            snapshot.lastYearSameMonthCount > 0
              ? `Geçen yıl: ${snapshot.lastYearSameMonthCount}`
              : "İlk yıl verisi yok"
          }
        />
        <KpiCard
          icon={Zap}
          label="Bu Ay MWp"
          value={formatNumber(snapshot.thisMonthMwp, 1)}
          subtitle="Toplam kurulu güç (bu ay)"
        />
        <KpiCard
          icon={Target}
          label="Kazanma Oranı (30g)"
          value={snapshot.winRate30d === null ? "—" : `%${snapshot.winRate30d}`}
          subtitle={
            snapshot.winRate30d === null
              ? "Son 30g sonuçlanan teklif yok"
              : "Son 30 gün içinde"
          }
        />
        <KpiCard
          icon={DollarSign}
          label="Ortalama $/Wp"
          value={
            snapshot.avgPerKwUsd === null
              ? "—"
              : `$${(snapshot.avgPerKwUsd / 1000).toFixed(2)}`
          }
          subtitle={
            snapshot.projectsWithPriceCount === 0
              ? "Fiyatlı proje yok"
              : `${snapshot.projectsWithPriceCount} fiyatlı projeden`
          }
        />
        <KpiCard
          icon={Clock}
          label="Bekleyen Ciro"
          value={formatUsdShort(snapshot.pendingRevenueUsd)}
          subtitle="Pipeline (gönderildi/inceleniyor)"
        />
        <KpiCard
          icon={Trophy}
          label="Tamamlanan Ciro"
          value={formatUsdShort(snapshot.completedRevenueUsd)}
          subtitle={`${snapshot.totalWonCount} kazanılan teklif`}
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
          {trend.every((t) => t.count === 0) ? (
            <EmptyHint>Son 12 ayda gösterilecek veri yok.</EmptyHint>
          ) : (
            <KpiTrendChart data={trend} />
          )}
        </CardContent>
      </Card>

      {/* Top satışçılar + status dağılımı */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Top Satışçılar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSellers.length === 0 ? (
              <EmptyHint>Henüz proje oluşturan kullanıcı yok.</EmptyHint>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Satışçı</th>
                      <th className="px-3 py-2 text-right font-medium">Teklif</th>
                      <th className="px-3 py-2 text-right font-medium">Win %</th>
                      <th className="px-3 py-2 text-right font-medium">MWp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {topSellers.map((s, i) => (
                      <tr key={s.id} className="hover:bg-muted/40">
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
                            <span className="min-w-0 truncate font-medium text-foreground">
                              {s.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.count}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                          {s.wonRate === null ? "—" : `%${s.wonRate}`}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {formatNumber(s.totalMwp, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="size-4" /> Durum Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length === 0 ? (
              <EmptyHint>Aktif proje yok.</EmptyHint>
            ) : (
              <ul className="space-y-2.5">
                {(() => {
                  const total = statusBreakdown.reduce((acc, x) => acc + x.count, 0);
                  return statusBreakdown.map((s) => {
                    const pct = total === 0 ? 0 : Math.round((s.count / total) * 100);
                    return (
                      <li key={s.status}>
                        <div className="mb-1 flex items-center justify-between text-[12px]">
                          <span className="font-medium text-foreground">{s.label}</span>
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
                  });
                })()}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk göstergeleri */}
      {risks.length > 0 && (
        <Card className="border-rose-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <AlertTriangle className="size-4" /> Dikkat Edilmesi Gerekenler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-[12.5px]">
              {risks.map((r) => (
                <RiskRow key={r.kind} flag={r} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  subtitle?: string;
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const isUp = (delta ?? 0) >= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Icon className="size-4" />
          </div>
          {hasDelta && deltaLabel && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[10px] font-semibold ${
                isUp
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {isUp ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
              {isUp ? "+" : ""}
              {delta}%
            </span>
          )}
        </div>
        <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        {subtitle && <p className="mt-0.5 text-[10.5px] text-slate-400">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function RiskRow({ flag }: { flag: RiskFlag }) {
  const { tone, dot, icon, message } = mapRisk(flag);
  return (
    <li className={`flex items-start gap-2 rounded-md border p-2.5 ${tone}`}>
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${dot}`}
      >
        {flag.count}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          {icon}
          {message}
        </div>
        {flag.examples.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[11.5px] text-slate-600">
            {flag.examples.map((e) => (
              <li key={e.id} className="flex items-center gap-1.5">
                <Link
                  href={`/projects/${e.id}/detail`}
                  className="truncate font-medium text-slate-700 hover:underline"
                >
                  {e.name}
                </Link>
                <span className="shrink-0 text-slate-400">· {e.days} gün</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function mapRisk(flag: RiskFlag): {
  tone: string;
  dot: string;
  icon: React.ReactNode;
  message: string;
} {
  switch (flag.kind) {
    case "stale_offer":
      return {
        tone: "border-rose-200 bg-rose-50/40",
        dot: "bg-rose-500",
        icon: <Clock className="size-3 text-rose-600" />,
        message: "90 günden eski cevap bekleyen teklif",
      };
    case "unviewed_share":
      return {
        tone: "border-amber-200 bg-amber-50/40",
        dot: "bg-amber-500",
        icon: <Mail className="size-3 text-amber-700" />,
        message: "7 gündür açılmamış paylaşım linki",
      };
    case "abandoned_draft":
      return {
        tone: "border-slate-200 bg-slate-50/40",
        dot: "bg-slate-500",
        icon: <TrendingDown className="size-3 text-slate-500" />,
        message: "30 gün dokunulmamış taslak",
      };
  }
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/40 px-3 py-6 text-center text-[12px] text-slate-500">
      {children}
    </p>
  );
}

function computeYoYDelta(now: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((now - prev) / prev) * 100);
}

function formatUsdShort(value: number): string {
  if (value === 0) return "$0";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}
