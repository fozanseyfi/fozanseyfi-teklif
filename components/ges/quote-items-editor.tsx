"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveQuote } from "@/app/actions/quote";
import { useDirtyTracker } from "@/lib/unsaved-changes";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Save, ArrowRight, Trash2, RefreshCw, Loader2, Package, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import { CatalogCombobox } from "@/components/ges/catalog-combobox";
import { useReadOnly } from "@/lib/readonly-context";
import type { CatalogItemDTO } from "@/app/actions/materials";
import { Textarea } from "@/components/ui/textarea";
import {
  type QuoteItem,
  type QuoteMeta,
  type QuoteCurrency,
  convert,
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
  const readOnly = useReadOnly();
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [meta, setMeta] = useState<QuoteMeta>(initialMeta);
  const [catalog, setCatalog] = useState<CatalogItemDTO[]>(initialCatalog);
  const [saving, setSaving] = useState(false);
  const [fxLoading, setFxLoading] = useState(false);

  const baseline = useRef(JSON.stringify({ items: initialItems, meta: initialMeta }));
  const isDirty = JSON.stringify({ items, meta }) !== baseline.current;
  useDirtyTracker(isDirty);

  // Kalemler sayfasında tutarlar her zaman ₺ (maliyet bazı) gösterilir;
  // teklif para birimi/satış fiyatı Analiz sekmesinde belirlenir.
  const rates = { usd: meta.usd, eur: meta.eur };

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

  // Kalemi yukarı/aşağı taşı (komşuyla yer değiştir).
  function moveItem(id: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  const totalCostTRY = items
    .filter((it) => !it.isOption)
    .reduce((s, it) => s + convert(it.unitCost, it.currency, "TRY", rates) * (it.qty || 0), 0);
  const optionCostTRY = items
    .filter((it) => it.isOption)
    .reduce((s, it) => s + convert(it.unitCost, it.currency, "TRY", rates) * (it.qty || 0), 0);
  const optionCount = items.filter((it) => it.isOption).length;

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
    <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-4 border-0 p-0">
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
          <p className="ml-auto text-[11px] text-muted-foreground">
            Teklif para birimi ve kâr oranları <strong className="text-foreground">Analiz</strong> sekmesinde.
          </p>
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
                    <th className="w-28 px-2 py-2 text-right">Miktar</th>
                    <th className="w-16 px-2 py-2 text-center">Para</th>
                    <th className="w-28 px-2 py-2 text-right">Birim Maliyet</th>
                    <th className="w-28 px-2 py-2 text-right">Tutar (₺)</th>
                    <th className="w-16 px-2 py-2 text-center" data-edit-only>Opsiyon</th>
                    <th className="w-20 px-2 py-2 text-center" data-edit-only>Sıra</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it, idx) => (
                    <tr key={it.id} className={cn("hover:bg-muted/30", it.isOption && "bg-violet-50/50")}>
                      <td className="px-2 py-1.5 align-top">
                        <span className="font-mono text-[11px] text-muted-foreground">{it.code}</span>
                        {it.isOption && (
                          <span className="mt-0.5 block rounded-full bg-violet-100 px-1 py-0.5 text-center text-[8.5px] font-bold uppercase text-violet-700">
                            Opsiyon
                          </span>
                        )}
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
                        <Textarea
                          rows={1}
                          className="min-h-8 resize-y py-1 text-sm [field-sizing:content]"
                          value={it.desc ?? ""}
                          placeholder="Açıklama — satır atlayabilirsin"
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
                        ₺{fmt(convert(it.unitCost, it.currency, "TRY", rates) * (it.qty || 0))}
                      </td>
                      <td className="px-2 py-1.5 text-center align-top" data-edit-only>
                        <input
                          type="checkbox"
                          checked={!!it.isOption}
                          onChange={(e) => update(it.id, { isOption: e.target.checked })}
                          className="size-4 accent-violet-600"
                          title="Opsiyon olarak işaretle — ana toplama girmez, PDF'de Opsiyonlar altında çıkar"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top" data-edit-only>
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveItem(it.id, -1)}
                            disabled={idx === 0}
                            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                            aria-label="Yukarı taşı"
                            title="Yukarı taşı"
                          >
                            <ChevronUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(it.id, 1)}
                            disabled={idx === items.length - 1}
                            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                            aria-label="Aşağı taşı"
                            title="Aşağı taşı"
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(it.id)}
                            className="rounded p-1 text-destructive/70 transition-colors hover:bg-destructive-soft hover:text-destructive-soft-foreground"
                            aria-label="Kalemi sil"
                            title="Sil"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t bg-muted/30 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">
              Toplam Maliyet{optionCount > 0 ? " (opsiyon hariç)" : ""}:
            </span>
            <span className="text-sm font-semibold tabular-nums">₺{fmt(totalCostTRY)}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              ${fmt(rates.usd ? totalCostTRY / rates.usd : 0)}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              €{fmt(rates.eur ? totalCostTRY / rates.eur : 0)}
            </span>
            {fxLoading && <Loader2 className="inline size-3 animate-spin text-muted-foreground" />}
          </div>
          {optionCount > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-violet-100 bg-violet-50/50 px-4 py-2.5">
              <span className="text-xs font-medium text-violet-700">
                Toplam Maliyet (Opsiyonlar):
              </span>
              <span className="text-sm font-semibold tabular-nums text-violet-800">₺{fmt(optionCostTRY)}</span>
              <span className="text-sm tabular-nums text-violet-700/80">
                ${fmt(rates.usd ? optionCostTRY / rates.usd : 0)}
              </span>
              <span className="text-sm tabular-nums text-violet-700/80">
                €{fmt(rates.eur ? optionCostTRY / rates.eur : 0)}
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                {optionCount} opsiyon
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </fieldset>
  );
}
