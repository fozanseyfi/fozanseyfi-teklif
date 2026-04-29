"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { calc, getGrpTot } from "@/lib/ges-engine";
import { saveKesifB } from "@/app/actions/ges";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";
import { Card, CardContent } from "@/components/ui/card";
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
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
  timeline: TimelineData;
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


export function CashFlowView({ projectId, kesifA, kesifB: kesifBProp, settings, timeline }: Props) {
  const [localKesifB, setLocalKesifB] = useState<KesifGroup[]>(kesifBProp);
  const lastSavedInterest = useRef<number | null>(null);

  const result = useMemo(() => calc(kesifA, localKesifB, settings), [kesifA, localKesifB, settings]);
  const groupTotals = useMemo(() => buildGroupTotals(kesifA, localKesifB, settings), [kesifA, localKesifB, settings]);

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
      const creditInterest = cumulative < 0 ? Math.abs(cumulative) * (settings.krediFaiz / 100 / 12) : 0;
      const depositInterest = cumulative > 0 ? cumulative * (settings.mevduat / 100 / 12) : 0;
      const finalCumulative = cumulative - creditInterest + depositInterest;

      const months2 = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
      const offset = m + (timeline.startMonth ?? 0);
      const label = `${months2[offset % 12]} ${timeline.startYear + Math.floor(offset / 12)}`;

      rows.push({ month: m, label, inflow, outflow, net, cumulative: finalCumulative, creditInterest });
      cumulative = finalCumulative;
    }
    return rows;
  }, [timeline, result, groupTotals, settings]);

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
      {/* Header */}
      <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: "linear-gradient(135deg, #0b1628 0%, #0f2444 50%, #162d55 100%)" }}>
        <div className="px-6 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.3)" }}>
            <Activity className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Cash Flow Analizi</h2>
            <p className="text-xs text-slate-400">{timeline.months} aylık nakit akışı simülasyonu</p>
          </div>
        </div>
        <div className="h-0.5" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.5), rgba(99,102,241,0.5), transparent)" }} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", boxShadow: "0 8px 24px rgba(245,158,11,0.3)" }}>
          <div className="absolute right-3 top-3 opacity-15"><DollarSign className="w-10 h-10" /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Satış Fiyatı</p>
          <p className="text-xl font-black">{kFmt(result.salePriceUsd)}</p>
        </div>
        <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", boxShadow: "0 8px 24px rgba(239,68,68,0.3)" }}>
          <div className="absolute right-3 top-3 opacity-15"><TrendingDown className="w-10 h-10" /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Maks. Kredi İhtiyacı</p>
          <p className="text-xl font-black">{kFmt(Math.abs(maxCredit))}</p>
        </div>
        <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: finalBalance >= 0 ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
          <div className="absolute right-3 top-3 opacity-15"><TrendingUp className="w-10 h-10" /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Final Bakiye</p>
          <p className="text-xl font-black">{kFmt(finalBalance)}</p>
        </div>
        <div className="rounded-2xl p-4 bg-white border-0 shadow-md shadow-slate-200/60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Toplam Faiz Maliyeti</p>
          <p className="text-xl font-black text-red-600">{kFmt(totalInterest)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">B.6 Finans Maliyeti → otomatik</p>
        </div>
      </div>

      {/* Bar chart — Aylık Giriş / Çıkış */}
      <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Aylık Nakit Giriş / Çıkış (000 USD)</h3>
        </div>
        <CardContent className="px-4 pb-4 pt-3">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={2} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colorGiris" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="colorCikis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={1} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1.5} />
              <Tooltip formatter={(v) => kFmt(Number(v) * 1000)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Bar dataKey="Giriş" fill="url(#colorGiris)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Çıkış" fill="url(#colorCikis)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Area chart — Kümülatif */}
      <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}>
            <Activity className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Kümülatif Nakit Pozisyonu (000 USD)</h3>
        </div>
        <CardContent className="px-4 pb-4 pt-3">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cumGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cumGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="4 2" label={{ value: "0", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip formatter={(v) => kFmt(Number(v) * 1000)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: "12px" }} />
              <Area
                type="monotone"
                dataKey="Kümülatif"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fill="url(#cumGradPos)"
                dot={false}
                activeDot={{ r: 5, fill: "#f59e0b", stroke: "white", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-md shadow-slate-200/60 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f1f3d, #1e3a5f)" }}>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Aylık Detay Tablosu</h3>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Ay</th>
                  <th className="px-3 py-2.5 text-right text-emerald-600 font-semibold">Giriş ($)</th>
                  <th className="px-3 py-2.5 text-right text-red-500 font-semibold">Çıkış ($)</th>
                  <th className="px-3 py-2.5 text-right text-slate-500 font-semibold">Net ($)</th>
                  <th className="px-3 py-2.5 text-right text-slate-500 font-semibold">Kümülatif ($)</th>
                  <th className="px-3 py-2.5 text-right text-orange-500 font-semibold">Kredi Faizi ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cfRows.map((row) => (
                  <tr key={row.month} className={`hover:bg-slate-50 transition-colors ${row.cumulative < 0 ? "bg-red-50/40" : ""}`}>
                    <td className="px-3 py-2 font-medium text-slate-700">{row.label}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-medium">
                      {row.inflow > 0 ? `$${fmt(row.inflow)}` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-red-500 font-medium">
                      {row.outflow > 0 ? `$${fmt(row.outflow)}` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      ${fmt(row.net)}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${row.cumulative >= 0 ? "text-slate-800" : "text-red-700"}`}>
                      ${fmt(row.cumulative)}
                    </td>
                    <td className="px-3 py-2 text-right text-orange-500 font-medium">
                      {row.creditInterest > 0 ? `$${fmt(row.creditInterest)}` : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300">
                <tr style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", borderTop: "2px solid #fbbf24" }}>
                  <td className="px-3 py-2.5 font-extrabold text-amber-800">TOPLAM</td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-emerald-700">${fmt(totalInflow)}</td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-red-600">${fmt(totalOutflow)}</td>
                  <td className={`px-3 py-2.5 text-right font-extrabold ${totalNet >= 0 ? "text-emerald-700" : "text-red-700"}`}>${fmt(totalNet)}</td>
                  <td className={`px-3 py-2.5 text-right font-extrabold ${finalBalance >= 0 ? "text-slate-900" : "text-red-700"}`}>${fmt(finalBalance)}</td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-orange-600">${fmt(totalInterest)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
