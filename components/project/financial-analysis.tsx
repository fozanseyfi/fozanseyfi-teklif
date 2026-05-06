"use client";

import { useState } from "react";
import Link from "next/link";
import { saveStep4 } from "@/app/actions/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calculateCashFlow,
  calculatePaybackYear,
  calculateAnnualProductionKwh,
  calculateCO2Saving,
  calculateEquivalentTrees,
} from "@/lib/pricing-engine";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ArrowLeft, Leaf, Zap, TrendingUp, Clock } from "lucide-react";
import type { Project, PricingSnapshot } from "@prisma/client";

type ProjectWithSnapshot = Project & { pricingSnapshot: PricingSnapshot | null };

export function FinancialAnalysis({ project }: { project: ProjectWithSnapshot }) {
  const [annualInflation, setAnnualInflation] = useState(
    Math.round(project.annualInflationRate * 100)
  );
  const [escalation, setEscalation] = useState(
    Math.round(project.electricityEscalationRate * 100)
  );
  const [lifeYears, setLifeYears] = useState(project.projectLifeYears);
  const [unitPrice, setUnitPrice] = useState(project.electricityUnitPrice);
  const [sunHours, setSunHours] = useState(4.5);

  const totalPowerKw = project.totalPowerKw;
  const totalInvestment = project.pricingSnapshot?.finalSalePrice ?? 0;
  const annualProduction = calculateAnnualProductionKwh(totalPowerKw, sunHours);

  const cashFlow = calculateCashFlow({
    totalInvestment,
    annualProductionKwh: annualProduction,
    electricityUnitPrice: unitPrice,
    electricityEscalationRate: escalation / 100,
    panelDegradationRate: 0.005,
    projectLifeYears: lifeYears,
  });

  const paybackYear = calculatePaybackYear(cashFlow);
  const firstYearSaving = cashFlow[0]?.annualSaving ?? 0;
  const netPosition25 = cashFlow[lifeYears - 1]?.netPosition ?? 0;
  const totalCO2 = calculateCO2Saving(annualProduction, lifeYears);
  const trees = calculateEquivalentTrees(totalCO2);

  const action = saveStep4.bind(null, project.id);

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="electricityUnitPrice" value={unitPrice} />

      {/* Parametreler */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Yıllık Enflasyon (%)</Label>
          <Input
            name="annualInflationRate"
            type="number"
            min="0"
            max="200"
            value={annualInflation}
            onChange={(e) => setAnnualInflation(parseFloat(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Elektrik Artış Oranı (%/yıl)</Label>
          <Input
            name="electricityEscalationRate"
            type="number"
            min="0"
            max="200"
            value={escalation}
            onChange={(e) => setEscalation(parseFloat(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Proje Ömrü (yıl)</Label>
          <Input
            name="projectLifeYears"
            type="number"
            min="5"
            max="40"
            value={lifeYears}
            onChange={(e) => setLifeYears(parseInt(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Güneşlenme (saat/gün)</Label>
          <Input
            type="number"
            min="1"
            max="8"
            step="0.1"
            value={sunHours}
            onChange={(e) => setSunHours(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border bg-muted p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary-soft">
              <Zap className="size-3.5 text-primary-soft-foreground" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Yıllık Üretim</p>
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">{formatNumber(annualProduction)} kWh</p>
        </div>
        <div className="rounded-xl border bg-muted p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-success-soft">
              <TrendingUp className="size-3.5 text-success-soft-foreground" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">İlk Yıl Tasarruf</p>
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">{formatCurrency(firstYearSaving)}</p>
        </div>
        <div className="rounded-xl border bg-muted p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-info-soft">
              <Clock className="size-3.5 text-info-soft-foreground" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Geri Ödeme</p>
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">
            {paybackYear > 0 ? `${paybackYear} Yıl` : "—"}
          </p>
        </div>
        <div className="rounded-xl border bg-muted p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary-soft">
              <TrendingUp className="size-3.5 text-primary-soft-foreground" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">{lifeYears} Yıl Net Kazanç</p>
          </div>
          <p
            className={cn(
              "text-xl font-bold tracking-tight",
              netPosition25 >= 0 ? "text-success-soft-foreground" : "text-destructive",
            )}
          >
            {formatCurrency(netPosition25)}
          </p>
        </div>
      </div>

      {/* Grafik */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Kümülatif Cash Flow
        </h3>
        <div className="h-64 rounded-xl border bg-card p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cashFlow} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: "Yıl", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}
                labelStyle={{ color: "#64748b" }}
                formatter={(v) => [formatCurrency(v as number), ""]}
              />
              <ReferenceLine y={0} stroke="#059669" strokeDasharray="4 4" label={{ value: "Geri Ödeme Noktası", fill: "#047857", fontSize: 10 }} />
              <Line type="monotone" dataKey="netPosition" stroke="#059669" dot={false} strokeWidth={2.5} name="Net Pozisyon" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Flow Tablosu */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Cash Flow Tablosu
        </h3>
        <div className="max-h-72 overflow-auto rounded-xl border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 border-b bg-muted">
              <tr className="text-muted-foreground">
                <th className="px-3 py-2.5 text-left font-semibold">Yıl</th>
                <th className="px-3 py-2.5 text-right font-semibold">Üretim (kWh)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Birim Fiyat</th>
                <th className="px-3 py-2.5 text-right font-semibold">Yıllık Tasarruf</th>
                <th className="px-3 py-2.5 text-right font-semibold">Kümülatif</th>
                <th className="px-3 py-2.5 text-right font-semibold">Net Pozisyon</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cashFlow.map((row, idx) => (
                <tr key={row.year} className={idx % 2 === 0 ? "bg-card" : "bg-muted/40"}>
                  <td className="px-3 py-2 font-medium text-muted-foreground">{row.year}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatNumber(row.productionKwh)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{row.unitPrice.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(row.annualSaving)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(row.cumulativeSaving)}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-semibold",
                      row.netPosition >= 0 ? "text-success-soft-foreground" : "text-muted-foreground",
                    )}
                  >
                    {formatCurrency(row.netPosition)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Çevre Katkısı */}
      <div className="rounded-xl border border-primary/20 bg-success-soft p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-success/10">
            <Leaf className="size-4 text-success-soft-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-success-soft-foreground">Çevre Katkısı</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="mb-1 text-xs font-medium text-success-soft-foreground/80">Yıllık CO₂ Tasarrufu</p>
            <p className="text-lg font-bold tracking-tight text-success-soft-foreground">{formatNumber(totalCO2 / lifeYears, 1)} ton</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-success-soft-foreground/80">{lifeYears} Yıl CO₂ Tasarrufu</p>
            <p className="text-lg font-bold tracking-tight text-success-soft-foreground">{formatNumber(totalCO2, 0)} ton</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-success-soft-foreground/80">Eşdeğer Ağaç</p>
            <p className="text-lg font-bold tracking-tight text-success-soft-foreground">{formatNumber(trees)} adet</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" asChild>
          <Link href={`/projects/${project.id}/equipment`}>
            <ArrowLeft className="size-4" /> Geri
          </Link>
        </Button>
        <Button type="submit" size="lg">
          Kaydet & Devam →
        </Button>
      </div>
    </form>
  );
}
