"use client";

import { useState } from "react";
import { saveTimeline } from "@/app/actions/ges";
import { calc } from "@/lib/ges-engine";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
        <table className="w-full text-xs min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-left text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[180px]">Kalem</th>
              {monthLabels.map((m) => (
                <th key={m} className="px-2 py-2 text-center text-slate-500 min-w-[56px] text-xs">{m}</th>
              ))}
              <th className="px-2 py-2 text-center text-slate-500 min-w-[56px]">Eşit</th>
              <th className="px-3 py-2 text-right text-slate-500 min-w-[56px]">Toplam %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(({ row, idx }) => {
              const total = row.values.reduce((s, v) => s + v, 0);
              const ok = isInflow ? Math.abs(total - 100) < 1 : Math.abs(total - 100) < 1;
              return (
                <tr key={idx} className={`hover:bg-slate-50/50 ${isInflow ? "hover:bg-green-50/30" : "hover:bg-red-50/30"}`}>
                  <td className="px-3 py-1.5 font-medium text-slate-700 sticky left-0 bg-white text-xs">{row.name}</td>
                  {row.values.map((val, mi) => (
                    <td key={mi} className="px-1 py-1">
                      <Input
                        className="h-6 text-xs text-center w-16 border-slate-200"
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
                      className="p-1 rounded hover:bg-slate-100"
                    >
                      <RefreshCw className="w-3 h-3 text-slate-400" />
                    </button>
                  </td>
                  <td className={`px-3 py-1.5 text-right font-bold ${ok ? "text-green-600" : total > 100 ? "text-red-600" : "text-slate-500"}`}>
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Cash Flow Timeline</h2>
          <p className="text-sm text-slate-500">{tl.months} ay · Satış Fiyatı: ${result.salePriceUsd.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Başlangıç Tarihi</Label>
            <Input
              type="month"
              className="h-8 text-xs w-36"
              value={`${tl.startYear}-${String((tl.startMonth ?? 0) + 1).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-");
                if (y && m) changeStart(parseInt(y), parseInt(m) - 1);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Ay Sayısı</Label>
            <Input
              type="number"
              className="h-8 text-xs w-20"
              value={tl.months}
              min={1}
              max={60}
              onChange={(e) => changeMonths(parseInt(e.target.value) || 12)}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="w-4 h-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 text-xs">
        <span className="px-2 py-1 rounded bg-green-100 text-green-700 border border-green-200 font-medium">
          Giriş — Satış Fiyatının %'si (0–100)
        </span>
        <span className="px-2 py-1 rounded bg-red-100 text-red-700 border border-red-200 font-medium">
          Çıkış — Kalem Toplamının %'si (0–100)
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="py-2 bg-green-50 border-b border-green-100">
          <CardTitle className="text-xs font-semibold text-green-700">HAKEDİŞ / GİRİŞLER</CardTitle>
        </CardHeader>
        <CardContent className="p-0">{renderTable(inflowRows, true)}</CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="py-2 bg-red-50 border-b border-red-100">
          <CardTitle className="text-xs font-semibold text-red-700">ÖDEMELER / ÇIKIŞLAR</CardTitle>
        </CardHeader>
        <CardContent className="p-0">{renderTable(outflowRows, false)}</CardContent>
      </Card>
    </div>
  );
}
