"use client";

import { useState } from "react";
import { saveTimeline } from "@/app/actions/ges";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  data: TimelineData;
  kesifA: KesifGroup[];
  kesifB: KesifGroup[];
  settings: GesSettings;
}

const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function normalizeInflow(val: number): number {
  // Legacy data stored inflow as fractions (0-1). Convert to 0-100 range.
  return val <= 1 && val > 0 ? Math.round(val * 100) : val;
}

function normalizeTl(tl: TimelineData): TimelineData {
  return {
    ...tl,
    rows: tl.rows.map((r) => ({
      ...r,
      values: r.type === "inflow" ? r.values.map(normalizeInflow) : r.values,
    })),
  };
}

export function TimelineEditor({ projectId, data, kesifA, kesifB, settings }: Props) {
  const [tl, setTl] = useState<TimelineData>(() => normalizeTl(data));
  const [saving, setSaving] = useState(false);

  const result = calc(kesifA, kesifB, settings);

  // Compute default start from settings.baslangic
  function getDefaultStart() {
    if (settings.baslangic) {
      const d = new Date(settings.baslangic);
      if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() };
    }
    return { year: tl.startYear, month: tl.startMonth ?? 0 };
  }

  function changeMonths(newMonths: number) {
    setTl((prev) => ({
      ...prev,
      months: newMonths,
      rows: prev.rows.map((r) => {
        const vals = [...r.values];
        while (vals.length < newMonths) vals.push(0);
        return { ...r, values: vals.slice(0, newMonths) };
      }),
    }));
  }

  function changeStart(year: number, month: number) {
    setTl((prev) => ({ ...prev, startYear: year, startMonth: month }));
  }

  function evenDistribute(rowIdx: number) {
    setTl((prev) => {
      const row = prev.rows[rowIdx];
      const total = row.values.reduce((s, v) => s + v, 0) || 100;
      const perMonth = Math.floor(total / prev.months);
      const remainder = total - perMonth * prev.months;
      const values = Array(prev.months).fill(perMonth);
      if (remainder > 0) values[0] += remainder;
      return {
        ...prev,
        rows: prev.rows.map((r, ri) => ri === rowIdx ? { ...r, values } : r),
      };
    });
  }

  function updateValue(rowIdx: number, mIdx: number, val: string) {
    setTl((prev) => ({
      ...prev,
      rows: prev.rows.map((r, ri) => {
        if (ri !== rowIdx) return r;
        const values = [...r.values];
        values[mIdx] = parseFloat(val) || 0;
        return { ...r, values };
      }),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTimeline(projectId, tl as never);
      toast.success("Kaydedildi");
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  const { year: startY, month: startM } = getDefaultStart();

  const monthLabels = Array.from({ length: tl.months }, (_, i) => {
    const offset = i + (tl.startMonth ?? 0);
    const y = tl.startYear + Math.floor(offset / 12);
    const m = offset % 12;
    return `${MONTHS_TR[m]} ${y}`;
  });

  const inflowRows = tl.rows.map((r, i) => ({ row: r, idx: i })).filter((x) => x.row.type === "inflow");
  const outflowRows = tl.rows.map((r, i) => ({ row: r, idx: i })).filter((x) => x.row.type === "outflow");

  function renderTable(items: typeof inflowRows, isInflow: boolean) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-xs">
          <thead>
            <tr className="border-b bg-muted">
              <th className="sticky left-0 z-10 min-w-[180px] bg-muted px-3 py-2 text-left text-muted-foreground">Kalem</th>
              {monthLabels.map((m) => (
                <th key={m} className="min-w-[56px] px-2 py-2 text-center text-xs text-muted-foreground">{m}</th>
              ))}
              <th className="min-w-[56px] px-2 py-2 text-center text-muted-foreground">Eşit</th>
              <th className="min-w-[56px] px-3 py-2 text-right text-muted-foreground">Toplam %</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(({ row, idx }) => {
              const total = row.values.reduce((s, v) => s + v, 0);
              const ok = isInflow ? Math.abs(total - 100) < 1 : Math.abs(total - 100) < 1;
              return (
                <tr
                  key={idx}
                  className={cn(
                    "hover:bg-muted/50",
                    isInflow ? "hover:bg-success-soft/40" : "hover:bg-destructive-soft/40",
                  )}
                >
                  <td className="sticky left-0 bg-card px-3 py-1.5 text-xs font-medium text-foreground">{row.name}</td>
                  {row.values.map((val, mi) => (
                    <td key={mi} className="px-1 py-1">
                      <Input
                        className="h-6 w-16 text-center text-xs"
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={val || ""}
                        onChange={(e) => updateValue(idx, mi, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      title="Eşit dağıt"
                      onClick={() => evenDistribute(idx)}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <RefreshCw className="size-3 text-muted-foreground" />
                    </button>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right font-semibold",
                      ok
                        ? "text-success-soft-foreground"
                        : total > 100
                          ? "text-destructive-soft-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {total.toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Cash Flow Timeline</h2>
          <p className="text-sm text-muted-foreground">{tl.months} ay · Satış Fiyatı: ${result.salePriceUsd.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-xs">Başlangıç Tarihi</Label>
            <Input
              type="month"
              className="h-8 w-36 text-xs"
              value={`${tl.startYear}-${String((tl.startMonth ?? 0) + 1).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-");
                if (y && m) changeStart(parseInt(y), parseInt(m) - 1);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-xs">Ay Sayısı</Label>
            <Input
              type="number"
              className="h-8 w-20 text-xs"
              value={tl.months}
              min={1}
              max={60}
              onChange={(e) => changeMonths(parseInt(e.target.value) || 12)}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="size-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 text-xs">
        <span className="rounded border border-success/30 bg-success-soft px-2 py-1 font-medium text-success-soft-foreground">
          Giriş — Satış Fiyatının %&apos;si (0–100)
        </span>
        <span className="rounded border border-destructive/30 bg-destructive-soft px-2 py-1 font-medium text-destructive-soft-foreground">
          Çıkış — Kalem Toplamının %&apos;si (0–100)
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-success-soft py-2">
          <CardTitle className="text-xs font-semibold text-success-soft-foreground">HAKEDİŞ / GİRİŞLER</CardTitle>
        </CardHeader>
        <CardContent className="p-0">{renderTable(inflowRows, true)}</CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-destructive-soft py-2">
          <CardTitle className="text-xs font-semibold text-destructive-soft-foreground">ÖDEMELER / ÇIKIŞLAR</CardTitle>
        </CardHeader>
        <CardContent className="p-0">{renderTable(outflowRows, false)}</CardContent>
      </Card>
    </div>
  );
}
