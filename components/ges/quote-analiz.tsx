"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveQuote } from "@/app/actions/quote";
import { useDirtyTracker } from "@/lib/unsaved-changes";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Save, ArrowRight, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import {
  type QuoteItem,
  type QuoteMeta,
  QUOTE_ITEM_KIND_LABELS,
  lineTotalCostTRY,
  lineUnitSaleTRY,
  lineTotalSaleTRY,
  computeQuoteTotals,
} from "@/lib/quote";

interface Props {
  projectId: string;
  projectName: string;
  initialItems: QuoteItem[];
  initialMeta: QuoteMeta;
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function QuoteAnaliz({ projectId, projectName, initialItems, initialMeta }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [meta, setMeta] = useState<QuoteMeta>(initialMeta);
  const [saving, setSaving] = useState(false);
  const [bulkMargin, setBulkMargin] = useState("");

  const baseline = useRef(JSON.stringify({ items: initialItems, meta: initialMeta }));
  const isDirty = JSON.stringify({ items, meta }) !== baseline.current;
  useDirtyTracker(isDirty);

  const rates = { usd: meta.usd, eur: meta.eur };
  const totals = computeQuoteTotals(items, meta);

  function setMargin(id: string, marginPct: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, marginPct } : it)));
  }

  function applyBulk() {
    const v = parseFloat(bulkMargin);
    if (!Number.isFinite(v)) {
      toast.error("Geçerli bir % girin");
      return;
    }
    setItems((prev) => prev.map((it) => ({ ...it, marginPct: v })));
  }

  async function handleSave(goNext: boolean) {
    setSaving(true);
    try {
      await saveQuote(projectId, items, meta, 3);
      baseline.current = JSON.stringify({ items, meta });
      toast.success("Analiz kaydedildi");
      if (goNext) router.push(`/projects/${projectId}/detail/quote-pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <DetailPageHeader kicker="Analiz" title={projectName} backHref={`/projects/${projectId}/detail/items`} />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Henüz kalem yok. Önce <strong>Kalemler</strong> sekmesinden kalem ekleyin.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DetailPageHeader
        kicker="Analiz — Kâr & KDV"
        title={projectName}
        backHref={`/projects/${projectId}/detail/items`}
        actions={
          <>
            <Button data-edit-only variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
              <Save className="size-3.5" />
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button data-edit-only size="sm" onClick={() => handleSave(true)} disabled={saving}>
              Kaydet &amp; İlerle <ArrowRight className="size-3.5" />
            </Button>
          </>
        }
      />

      {/* Toplu marj + KDV */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2" data-edit-only>
            <span className="text-xs font-medium text-muted-foreground">Tümüne kâr % uygula</span>
            <Input
              type="number"
              step="0.5"
              className="h-8 w-20 text-sm"
              value={bulkMargin}
              onChange={(e) => setBulkMargin(e.target.value)}
              placeholder="%"
            />
            <Button variant="outline" size="sm" onClick={applyBulk}>
              Uygula
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">KDV %</span>
            <Input
              type="number"
              step="1"
              className="h-8 w-20 text-sm"
              value={meta.kdvRate}
              onChange={(e) => setMeta((p) => ({ ...p, kdvRate: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Kalem bazlı kâr tablosu */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 text-left">Tür</th>
                  <th className="min-w-[180px] px-2 py-2 text-left">Açıklama</th>
                  <th className="w-16 px-2 py-2 text-right">Miktar</th>
                  <th className="w-28 px-2 py-2 text-right">Birim Maliyet (₺)</th>
                  <th className="w-20 px-2 py-2 text-right">Kâr %</th>
                  <th className="w-28 px-2 py-2 text-right">Birim Satış (₺)</th>
                  <th className="w-28 px-2 py-2 text-right">Satır Toplam (₺)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it) => {
                  const unitCostTRY = lineTotalCostTRY(it, rates) / (it.qty || 1);
                  return (
                    <tr key={it.id} className="hover:bg-muted/30">
                      <td className="px-2 py-1.5">
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            it.kind === "HIZMET"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-sky-100 text-sky-700",
                          )}
                        >
                          {QUOTE_ITEM_KIND_LABELS[it.kind]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{it.name || it.code || "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmt(it.qty, 0)} {it.unit}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        ₺{fmt(unitCostTRY, 2)}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="0.5"
                          className="h-8 w-full text-right text-sm"
                          value={it.marginPct}
                          onChange={(e) => setMargin(it.id, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                        ₺{fmt(lineUnitSaleTRY(it, rates), 2)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                        ₺{fmt(lineTotalSaleTRY(it, rates))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Toplamlar */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="size-4 text-primary" /> Müşteri Toplamı
            </p>
            <div className="space-y-1 text-sm">
              <Row label="Ara Toplam (KDV hariç)" value={`₺${fmt(totals.subtotal)}`} />
              <Row label={`KDV (%${fmt(meta.kdvRate)})`} value={`₺${fmt(totals.kdv)}`} />
              <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-bold text-primary">
                <span>Genel Toplam</span>
                <span className="tabular-nums">₺{fmt(totals.grandTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* İç kâr özeti — sadece kullanıcıya, PDF'de gözükmez */}
        <Card className="border-dashed">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-semibold text-muted-foreground">İç Özet (müşteriye gösterilmez)</p>
            <div className="space-y-1 text-sm">
              <Row label="Toplam Maliyet" value={`₺${fmt(totals.totalCost)}`} muted />
              <Row label="Toplam Kâr" value={`₺${fmt(totals.profit)}`} muted />
              <Row
                label="Ortalama Kâr Oranı"
                value={totals.totalCost > 0 ? `%${fmt((totals.profit / totals.totalCost) * 100, 1)}` : "—"}
                muted
              />
              <div className="mt-1 flex justify-between border-t pt-2 text-xs text-muted-foreground">
                <span>Malzeme / Hizmet</span>
                <span className="tabular-nums">
                  ₺{fmt(totals.malzemeSubtotal)} / ₺{fmt(totals.hizmetSubtotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
