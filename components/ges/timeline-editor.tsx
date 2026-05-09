"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveTimeline } from "@/app/actions/ges";
import { useDirtyTracker } from "@/lib/unsaved-changes";
import { calc } from "@/lib/ges-engine";
import { DEF_TL } from "@/lib/ges-defaults";
import type { KesifGroup, GesSettings, TimelineData } from "@/lib/ges-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Save, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader, prevHref } from "@/components/ges/detail-page-header";

interface Props {
  projectId: string;
  projectName: string;
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

function normalizeTl(tl: TimelineData | undefined | null): TimelineData {
  // Yeni proje: timeline {} olarak baslar — DEF_TL'i sablon olarak kullan.
  // Kullanici Save'e basinca template DB'ye yazilir ve timelineHasData true
  // doner; Analiz/CF/BoQ/PBoQ/DoR sekmeleri o zaman acilir.
  if (!tl || !Array.isArray(tl.rows) || tl.rows.length === 0) {
    return {
      ...DEF_TL,
      startYear: new Date().getFullYear(),
      startMonth: 0,
    };
  }
  return {
    ...tl,
    rows: tl.rows.map((r) => ({
      ...r,
      values: r.type === "inflow" ? r.values.map(normalizeInflow) : r.values,
    })),
  };
}

export function TimelineEditor({ projectId, projectName, data, kesifA, kesifB, settings }: Props) {
  const router = useRouter();
  const [tl, setTl] = useState<TimelineData>(() => normalizeTl(data));
  const [saving, setSaving] = useState(false);

  // Unsaved-changes: tl her degistiginde baseline ile farki kirli sayar.
  const baselineRef = useRef<string>(JSON.stringify(normalizeTl(data)));
  const isDirty = JSON.stringify(tl) !== baselineRef.current;
  useDirtyTracker(isDirty);

  const result = calc(kesifA, kesifB, settings);

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

  /**
   * Smart % distribution — yalnizca OUTFLOW satirlarina uygulanir.
   * Outflow her satir kendi icinde %100'e tamamlanir (toplam = aydan aya
   * dagilan kalemin %100'u).
   *
   * INFLOW satirlari: 3 satirin (Avans, Ara Hakedis, Is Bitis) global
   * toplami %100 olmasi gerekir — kullanici kendi paylarını belirler;
   * burada otomatik denge YOK. Kullanici banner'dan eksigi gorur.
   */
  function updateValue(rowIdx: number, mIdx: number, val: string) {
    const parsed = parseFloat(val);
    const newVal = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    setTl((prev) => ({
      ...prev,
      rows: prev.rows.map((r, ri) => {
        if (ri !== rowIdx) return r;
        const values = [...r.values];
        values[mIdx] = newVal;

        // Inflow: serbest birakiyoruz, kullanici 3 satir toplami 100 olsun
        // diye banner'a bakacak
        if (r.type === "inflow") {
          return { ...r, values };
        }

        // Outflow: kendi icinde %100'e otomatik tamamlanir
        let total = values.reduce((s, v) => s + v, 0);
        if (total > 100) {
          let excess = total - 100;
          for (let i = values.length - 1; i >= 0 && excess > 0; i--) {
            if (i === mIdx) continue;
            if (values[i] > 0) {
              const take = Math.min(values[i], excess);
              values[i] = Math.round((values[i] - take) * 10) / 10;
              excess = Math.round((excess - take) * 10) / 10;
            }
          }
          total = values.reduce((s, v) => s + v, 0);
        }
        if (total < 100) {
          const deficit = Math.round((100 - total) * 10) / 10;
          let lastEmpty = -1;
          for (let i = values.length - 1; i >= 0; i--) {
            if (i === mIdx) continue;
            if (values[i] === 0) {
              lastEmpty = i;
              break;
            }
          }
          if (lastEmpty >= 0) values[lastEmpty] = deficit;
        }

        return { ...r, values };
      }),
    }));
  }

  async function handleSave(advance = false) {
    setSaving(true);
    try {
      // Timeline kayit edilirken Teknik'ten gelen baslangic ayini sabitle
      const toSave = {
        ...tl,
        startYear: effectiveStart.year,
        startMonth: effectiveStart.month,
      };
      await saveTimeline(projectId, toSave as never);
      // Save sonrasi baseline esitlenir → dirty=false.
      baselineRef.current = JSON.stringify(toSave);
      toast.success(
        advance ? "Kaydedildi — Analiz açıldı" : "Kaydedildi",
      );
      if (advance) {
        router.push(`/projects/${projectId}/detail/analiz`);
      }
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  // Baslangic ayi = Teknik'te girilen Proje Baslangic Tarihi (settings.baslangic)
  // Kullanici timeline'da ayrica baslangic ayarlamaz; tek dogru kaynak Teknik.
  const effectiveStart = (() => {
    if (settings.baslangic) {
      const d = new Date(settings.baslangic);
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth() };
      }
    }
    return { year: tl.startYear, month: tl.startMonth ?? 0 };
  })();

  const monthLabels = Array.from({ length: tl.months }, (_, i) => {
    const offset = i + effectiveStart.month;
    const y = effectiveStart.year + Math.floor(offset / 12);
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
              // Outflow: her satir kendi icinde %100 olmali (ok yesil olur).
              // Inflow: tek satirin payi serbest (30/35/35 vb), ust banner
              // toplam %100'i kontrol ediyor — bu yuzden inflow'da hep
              // notr renk.
              const ok = !isInflow && Math.abs(total - 100) < 1;
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
                      data-edit-only
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
                      "px-3 py-1.5 text-right font-semibold tabular-nums",
                      isInflow
                        ? "text-muted-foreground"
                        : ok
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
      <DetailPageHeader
        kicker={`Cash Flow Timeline · ${tl.months} ay`}
        title={projectName}
        backHref={prevHref(projectId, "/timeline")}
        actions={
          <>
            <div className="flex items-center gap-1.5">
              <Label className="whitespace-nowrap text-[11px]">Ay</Label>
              <Input
                type="number"
                className="h-8 w-16 text-xs"
                value={tl.months}
                min={1}
                max={60}
                onChange={(e) => changeMonths(parseInt(e.target.value) || 12)}
              />
            </div>
            <Button
              data-edit-only
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
              size="sm"
            >
              <Save className="size-3.5" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
            <Button data-edit-only onClick={() => handleSave(true)} disabled={saving} size="sm">
              Kaydet &amp; İlerle <ArrowRight className="size-3.5" />
            </Button>
          </>
        }
      />

      <div className="flex gap-3 text-xs">
        <span className="rounded border border-success/30 bg-success-soft px-2 py-1 font-medium text-success-soft-foreground">
          Giriş — Satış Fiyatının %&apos;si (0–100)
        </span>
        <span className="rounded border border-destructive/30 bg-destructive-soft px-2 py-1 font-medium text-destructive-soft-foreground">
          Çıkış — Kalem Toplamının %&apos;si (0–100)
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between border-b bg-success-soft py-2">
          <CardTitle className="text-xs font-semibold text-success-soft-foreground">
            HAKEDİŞ / GİRİŞLER
          </CardTitle>
          {(() => {
            const inflowTotal = inflowRows.reduce(
              (s, x) => s + x.row.values.reduce((a, b) => a + b, 0),
              0,
            );
            const ok = Math.abs(inflowTotal - 100) < 0.5;
            return (
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  ok
                    ? "border-success/30 bg-success text-success-foreground"
                    : "border-destructive/30 bg-destructive text-destructive-foreground",
                )}
              >
                {ok
                  ? `✓ Toplam Giriş: %${inflowTotal.toFixed(1)}`
                  : `⚠ Toplam Giriş: %${inflowTotal.toFixed(1)} — %${(100 - inflowTotal).toFixed(1)} eksik`}
              </span>
            );
          })()}
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
