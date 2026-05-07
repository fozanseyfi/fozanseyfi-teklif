"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { calc, getGrpTot } from "@/lib/ges-engine";
import { saveKesifB, saveGesSettings } from "@/app/actions/ges";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { TrendingDown, TrendingUp, DollarSign, Activity } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader, prevHref } from "@/components/ges/detail-page-header";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function kFmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

interface Props {
  projectId: string;
  projectName: string;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
  timeline: TimelineData;
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
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: SectionTone;
}) {
  const t = SECTION_TONE[tone];
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          t.iconBg,
        )}
      >
        <Icon className={cn("size-4", t.iconText)} />
      </div>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
    </div>
  );
}

function buildGroupTotals(kesifA: KesifGroup[], kesifB: KesifGroup[], s: GesSettings): Record<string, number> {
  const map: Record<string, number> = {};
  const groupCodes = [
    "A.1","A.2","A.3","A.4","A.5","A.6","A.7","A.8","A.9","A.10","A.11","A.12","A.13","A.14","A.15","A.16","A.17","A.18",
    "B.1","B.2","B.3","B.4","B.5","B.6",
  ];
  for (const g of [...kesifA, ...kesifB]) {
    const key = groupCodes.find((c) => g.code === c || g.code.startsWith(c));
    if (key) map[key] = (map[key] || 0) + getGrpTot(g, s);
  }
  return map;
}

function getRowAmount(rowName: string, groupTotals: Record<string, number>): number {
  const match = rowName.match(/^([AB]\.\d+)/);
  if (!match) return 0;
  return groupTotals[match[1]] || 0;
}


export function CashFlowView({ projectId, projectName, kesifA, kesifB: kesifBProp, settings, timeline }: Props) {
  const [localKesifB, setLocalKesifB] = useState<KesifGroup[]>(kesifBProp);
  const [krediFaiz, setKrediFaiz] = useState<number>(settings.krediFaiz ?? 0);
  const lastSavedInterest = useRef<number | null>(null);
  const rateSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveSettings = useMemo(() => ({ ...settings, krediFaiz }), [settings, krediFaiz]);

  const result = useMemo(() => calc(kesifA, localKesifB, effectiveSettings), [kesifA, localKesifB, effectiveSettings]);
  const groupTotals = useMemo(() => buildGroupTotals(kesifA, localKesifB, effectiveSettings), [kesifA, localKesifB, effectiveSettings]);

  function updateKrediFaiz(v: number) {
    setKrediFaiz(v);
    if (rateSaveTimer.current) clearTimeout(rateSaveTimer.current);
    rateSaveTimer.current = setTimeout(() => {
      saveGesSettings(projectId, { krediFaiz: v } as never).catch(() => toast.error("Faiz oranı kaydedilemedi"));
    }, 400);
  }

  const cfRows = useMemo(() => {
    const months = timeline.months;
    const rows = [];
    let cumulative = 0;

    for (let m = 0; m < months; m++) {
      let inflow = 0;
      let outflow = 0;

      for (const row of timeline.rows) {
        const pct = row.values[m] / 100;
        if (!pct) continue;
        if (row.type === "inflow") {
          inflow += pct * result.salePriceUsd;
        } else {
          const total = getRowAmount(row.name, groupTotals);
          outflow += pct * total;
        }
      }

      const net = inflow - outflow;
      cumulative += net;
      const creditInterest = cumulative < 0 ? Math.abs(cumulative) * (krediFaiz / 100 / 12) : 0;
      const depositInterest = cumulative > 0 ? cumulative * ((settings.mevduat ?? 0) / 100 / 12) : 0;
      const finalCumulative = cumulative - creditInterest + depositInterest;

      const months2 = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
      const offset = m + (timeline.startMonth ?? 0);
      const label = `${months2[offset % 12]} ${timeline.startYear + Math.floor(offset / 12)}`;

      rows.push({ month: m, label, inflow, outflow, net, cumulative: finalCumulative, creditInterest });
      cumulative = finalCumulative;
    }
    return rows;
  }, [timeline, result, groupTotals, krediFaiz, settings.mevduat]);

  // Auto-save total interest to B.6.1
  const totalInterest = useMemo(() => cfRows.reduce((s, r) => s + r.creditInterest, 0), [cfRows]);

  useEffect(() => {
    if (lastSavedInterest.current === totalInterest) return;
    const b6Idx = localKesifB.findIndex((g) => g.code === "B.6");
    if (b6Idx === -1) return;
    const current = localKesifB[b6Idx].items[0]?.rawFiyat ?? 0;
    const rounded = Math.round(totalInterest);
    if (Math.abs(current - rounded) < 1) return;

    const updated = localKesifB.map((g, gi) =>
      gi !== b6Idx ? g : {
        ...g,
        items: g.items.map((it, ii) =>
          ii === 0 ? { ...it, rawFiyat: rounded, birimFiyat: rounded } : it
        ),
      }
    );
    setLocalKesifB(updated);
    lastSavedInterest.current = totalInterest;
    saveKesifB(projectId, updated as never)
      .then(() => toast.success(`Finans maliyeti güncellendi: ${kFmt(rounded)}`))
      .catch(() => toast.error("B.6 güncellenemedi"));
  }, [totalInterest, localKesifB, projectId]);

  const maxCredit = Math.min(...cfRows.map((r) => r.cumulative));
  const finalBalance = cfRows[cfRows.length - 1]?.cumulative ?? 0;
  const totalInflow = cfRows.reduce((s, r) => s + r.inflow, 0);
  const totalOutflow = cfRows.reduce((s, r) => s + r.outflow, 0);
  const totalNet = totalInflow - totalOutflow;

  const chartData = cfRows.map((r) => ({
    name: r.label,
    Giriş: r.inflow / 1000,
    Çıkış: -r.outflow / 1000,
    Kümülatif: r.cumulative / 1000,
  }));

  return (
    <div className="space-y-4">
      <DetailPageHeader
        kicker={`Cash Flow · ${timeline.months} aylık nakit akışı`}
        title={projectName}
        backHref={prevHref(projectId, "/cashflow")}
        actions={
          <div className="flex items-center gap-2 rounded-lg border bg-warning-soft/40 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-warning-soft-foreground/80">
              Yıllık Kredi Faizi
            </span>
            <input
              type="range"
              min={0}
              max={50}
              step={0.1}
              value={krediFaiz}
              onChange={(e) => updateKrediFaiz(parseFloat(e.target.value))}
              className="h-1.5 w-32 cursor-ew-resize appearance-none rounded-full bg-foreground/10"
              style={{ accentColor: "#b45309" }}
            />
            <input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={krediFaiz}
              onChange={(e) => updateKrediFaiz(parseFloat(e.target.value) || 0)}
              className="h-7 w-14 rounded-md border bg-background px-1.5 text-xs font-semibold tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Satış Fiyatı</p>
              <DollarSign className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{kFmt(result.salePriceUsd)}</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Maks. Kredi İhtiyacı</p>
              <TrendingDown className="size-4 text-destructive-soft-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold text-destructive-soft-foreground">{kFmt(Math.abs(maxCredit))}</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Final Bakiye</p>
              <TrendingUp className={cn("size-4", finalBalance >= 0 ? "text-success-soft-foreground" : "text-destructive-soft-foreground")} />
            </div>
            <p className={cn("mt-1 text-xl font-bold", finalBalance >= 0 ? "text-success-soft-foreground" : "text-destructive-soft-foreground")}>{kFmt(finalBalance)}</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Toplam Faiz Maliyeti</p>
            <p className="mt-1 text-xl font-bold text-destructive-soft-foreground">{kFmt(totalInterest)}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">B.6 Finans Maliyeti → otomatik</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart — Aylık Giriş / Çıkış */}
      <Card className="overflow-hidden">
        <SectionHeader icon={DollarSign} title="Aylık Nakit Giriş / Çıkış (000 USD)" tone="success" />
        <CardContent className="px-4 pb-4 pt-3">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={2} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1.5} />
              <Tooltip formatter={(v) => kFmt(Number(v) * 1000)} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px 0 rgb(15 23 42 / 0.04)", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Bar dataKey="Giriş" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Çıkış" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Area chart — Kümülatif */}
      <Card className="overflow-hidden">
        <SectionHeader icon={Activity} title="Kümülatif Nakit Pozisyonu (000 USD)" tone="primary" />
        <CardContent className="px-4 pb-4 pt-3">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cumGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="4 2" label={{ value: "0", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip formatter={(v) => kFmt(Number(v) * 1000)} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px 0 rgb(15 23 42 / 0.04)", fontSize: "12px" }} />
              <Area
                type="monotone"
                dataKey="Kümülatif"
                stroke="#059669"
                strokeWidth={2.5}
                fill="url(#cumGradPos)"
                dot={false}
                activeDot={{ r: 5, fill: "#059669", stroke: "white", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <SectionHeader icon={DollarSign} title="Aylık Detay Tablosu" tone="info" />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Ay</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-success-soft-foreground">Giriş ($)</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-destructive-soft-foreground">Çıkış ($)</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Net ($)</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Kümülatif ($)</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-warning-soft-foreground">Kredi Faizi ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cfRows.map((row) => (
                  <tr
                    key={row.month}
                    className={cn(
                      "transition-colors hover:bg-muted/60",
                      row.cumulative < 0 && "bg-destructive-soft/40",
                    )}
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                    <td className="px-3 py-2 text-right font-medium text-success-soft-foreground">
                      {row.inflow > 0 ? `$${fmt(row.inflow)}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-destructive-soft-foreground">
                      {row.outflow > 0 ? `$${fmt(row.outflow)}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-semibold", row.net >= 0 ? "text-success-soft-foreground" : "text-destructive-soft-foreground")}>
                      ${fmt(row.net)}
                    </td>
                    <td className={cn("px-3 py-2 text-right font-semibold", row.cumulative >= 0 ? "text-foreground" : "text-destructive-soft-foreground")}>
                      ${fmt(row.cumulative)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-warning-soft-foreground">
                      {row.creditInterest > 0 ? `$${fmt(row.creditInterest)}` : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr className="bg-primary-soft">
                  <td className="px-3 py-2.5 font-semibold text-primary-soft-foreground">TOPLAM</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-success-soft-foreground">${fmt(totalInflow)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-destructive-soft-foreground">${fmt(totalOutflow)}</td>
                  <td className={cn("px-3 py-2.5 text-right font-semibold", totalNet >= 0 ? "text-success-soft-foreground" : "text-destructive-soft-foreground")}>${fmt(totalNet)}</td>
                  <td className={cn("px-3 py-2.5 text-right font-semibold", finalBalance >= 0 ? "text-foreground" : "text-destructive-soft-foreground")}>${fmt(finalBalance)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-warning-soft-foreground">${fmt(totalInterest)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
