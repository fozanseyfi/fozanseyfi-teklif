"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveQuote } from "@/app/actions/quote";
import { useDirtyTracker } from "@/lib/unsaved-changes";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Save, ArrowRight, Trash2, RefreshCw, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import { CatalogCombobox } from "@/components/ges/catalog-combobox";
import type { CatalogItemDTO } from "@/app/actions/materials";
import {
  type QuoteItem,
  type QuoteMeta,
  type QuoteCurrency,
  type QuoteOutputCurrency,
  convert,
  currencySymbol,
  QUOTE_ITEM_KIND_LABELS,
} from "@/lib/quote";

interface Props {
  projectId: string;
  projectName: string;
  initialItems: QuoteItem[];
  initialMeta: QuoteMeta;
  catalog: CatalogItemDTO[];
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function QuoteItemsEditor({ projectId, projectName, initialItems, initialMeta, catalog: initialCatalog }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [meta, setMeta] = useState<QuoteMeta>(initialMeta);
  const [catalog, setCatalog] = useState<CatalogItemDTO[]>(initialCatalog);
  const [saving, setSaving] = useState(false);
  const [fxLoading, setFxLoading] = useState(false);

  const baseline = useRef(JSON.stringify({ items: initialItems, meta: initialMeta }));
  const isDirty = JSON.stringify({ items, meta }) !== baseline.current;
  useDirtyTracker(isDirty);

  const out: QuoteOutputCurrency = meta.outputCurrency || "TRY";
  const rates = { usd: meta.usd, eur: meta.eur };
  const sym = currencySymbol(out);

  async function refreshFx(silent = false) {
    setFxLoading(true);
    try {
      const res = await fetch("/api/fx/latest", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.usd === "number" && typeof data.eur === "number") {
          setMeta((p) => ({ ...p, usd: data.usd, eur: data.eur }));
          if (!silent) toast.success("Kurlar güncellendi");
          return;
        }
      }
      if (!silent) toast.error("Kur alınamadı");
    } finally {
      setFxLoading(false);
    }
  }

  useEffect(() => {
    if (!meta.usd || !meta.eur) refreshFx(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(id: string, patch: Partial<QuoteItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function addFromCatalog(c: CatalogItemDTO) {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: c.kind,
        code: c.code,
        name: c.name,
        desc: "",
        unit: c.unit || "adet",
        qty: 1,
        currency: "USD",
        unitCost: 0,
        marginPct: 0,
      },
    ]);
  }

  function removeRow(id: string) {
    setItems((p) => p.filter((it) => it.id !== id));
  }

  const totalCostOut = items.reduce(
    (s, it) => s + convert(it.unitCost, it.currency, out, rates) * (it.qty || 0),
    0,
  );

  async function handleSave(goNext: boolean) {
    if (items.length === 0) {
      toast.error("En az bir kalem ekleyin");
      return;
    }
    setSaving(true);
    try {
      await saveQuote(projectId, items, meta, 2);
      baseline.current = JSON.stringify({ items, meta });
      toast.success("Kalemler kaydedildi");
      if (goNext) router.push(`/projects/${projectId}/detail/quote-analiz`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "h-8 text-sm";

  return (
    <div className="space-y-4">
      <DetailPageHeader
        kicker="Malzeme & Hizmet Kalemleri"
        title={projectName}
        backHref={`/projects/${projectId}/detail`}
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

      {/* Kur + teklif para birimi */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">USD/TRY</span>
            <Input
              type="number"
              step="0.01"
              className="h-8 w-24 text-sm"
              value={meta.usd || ""}
              onChange={(e) => setMeta((p) => ({ ...p, usd: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">EUR/TRY</span>
            <Input
              type="number"
              step="0.01"
              className="h-8 w-24 text-sm"
              value={meta.eur || ""}
              onChange={(e) => setMeta((p) => ({ ...p, eur: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <button
            data-edit-only
            type="button"
            onClick={() => refreshFx(false)}
            disabled={fxLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary-soft-foreground hover:bg-primary-soft/70 disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3", fxLoading && "animate-spin")} />
            Güncel kuru çek
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Teklif Para Birimi</span>
            <select
              className="h-8 rounded-md border bg-card px-2 text-sm font-semibold"
              value={out}
              onChange={(e) => setMeta((p) => ({ ...p, outputCurrency: e.target.value as QuoteOutputCurrency }))}
            >
              <option value="TRY">₺ TL</option>
              <option value="USD">$ USD</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Katalogdan kalem ekle */}
      <Card>
        <CardContent className="p-4" data-edit-only>
          <CatalogCombobox
            catalog={catalog}
            onPick={addFromCatalog}
            onCreated={(c) => setCatalog((prev) => [c, ...prev])}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Kalemler yalnızca kataloğdan eklenir. Listede yoksa &quot;yeni malzeme/hizmet kaydet&quot; ile kataloğa ekleyin.
          </p>
        </CardContent>
      </Card>

      {/* Kalem tablosu */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Package className="size-8 opacity-40" />
              Henüz kalem yok. Yukarıdan katalogdan kalem ekleyin.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="w-20 px-2 py-2 text-left">Kod</th>
                    <th className="min-w-[150px] px-2 py-2 text-left">Malzeme/Hizmet</th>
                    <th className="min-w-[160px] px-2 py-2 text-left">Açıklama</th>
                    <th className="w-20 px-2 py-2 text-right">Miktar</th>
                    <th className="w-16 px-2 py-2 text-center">Para</th>
                    <th className="w-28 px-2 py-2 text-right">Birim Maliyet</th>
                    <th className="w-28 px-2 py-2 text-right">Tutar ({sym})</th>
                    <th className="w-8 px-2 py-2" data-edit-only />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-muted/30">
                      <td className="px-2 py-1.5 align-top">
                        <span className="font-mono text-[11px] text-muted-foreground">{it.code}</span>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <span className="font-medium">{it.name}</span>
                        <span
                          className={cn(
                            "ml-1 rounded-full px-1 py-0.5 text-[9px] font-semibold",
                            it.kind === "HIZMET" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700",
                          )}
                        >
                          {QUOTE_ITEM_KIND_LABELS[it.kind]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <Input
                          className={inputCls}
                          value={it.desc ?? ""}
                          placeholder="Açıklama (opsiyonel)"
                          onChange={(e) => update(it.id, { desc: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <Input
                          type="number"
                          step="any"
                          className={cn(inputCls, "text-right")}
                          value={it.qty}
                          onChange={(e) => update(it.id, { qty: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <select
                          className="h-8 w-full rounded-md border bg-card px-1 text-xs"
                          value={it.currency}
                          onChange={(e) => update(it.id, { currency: e.target.value as QuoteCurrency })}
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="TRY">TRY</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <Input
                          type="number"
                          step="0.01"
                          className={cn(inputCls, "text-right")}
                          value={it.unitCost}
                          onChange={(e) => update(it.id, { unitCost: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right align-top font-semibold tabular-nums">
                        {sym}
                        {fmt(convert(it.unitCost, it.currency, out, rates) * (it.qty || 0))}
                      </td>
                      <td className="px-2 py-1.5 text-center align-top" data-edit-only>
                        <button
                          type="button"
                          onClick={() => removeRow(it.id)}
                          className="rounded-md p-1 text-destructive/70 transition-colors hover:bg-destructive-soft hover:text-destructive-soft-foreground"
                          aria-label="Kalemi sil"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-end border-t bg-muted/30 px-4 py-2.5">
            <p className="text-sm">
              Toplam Maliyet:{" "}
              <span className="font-semibold tabular-nums">
                {sym}{fmt(totalCostOut)}
              </span>
              {fxLoading && <Loader2 className="ml-2 inline size-3 animate-spin text-muted-foreground" />}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
