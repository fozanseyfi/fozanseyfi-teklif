"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveQuote } from "@/app/actions/quote";
import { useDirtyTracker } from "@/lib/unsaved-changes";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Save, ArrowRight, Plus, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import {
  type QuoteItem,
  type QuoteMeta,
  type QuoteCurrency,
  lineTotalCostTRY,
} from "@/lib/quote";

export interface CatalogEntry {
  code: string;
  name: string;
  unit: string;
  kind: "MALZEME" | "HIZMET";
  lastUnitCost: number;
  currency: string;
}

interface Props {
  projectId: string;
  projectName: string;
  initialItems: QuoteItem[];
  initialMeta: QuoteMeta;
  catalog: CatalogEntry[];
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function blankItem(): QuoteItem {
  return {
    id: crypto.randomUUID(),
    kind: "MALZEME",
    code: "",
    name: "",
    unit: "adet",
    qty: 1,
    currency: "USD",
    unitCost: 0,
    marginPct: 0,
  };
}

export function QuoteItemsEditor({ projectId, projectName, initialItems, initialMeta, catalog }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<QuoteItem[]>(
    initialItems.length ? initialItems : [blankItem()],
  );
  const [meta, setMeta] = useState<QuoteMeta>(initialMeta);
  const [saving, setSaving] = useState(false);
  const [fxLoading, setFxLoading] = useState(false);

  const baseline = useRef(JSON.stringify({ items: initialItems, meta: initialMeta }));
  const isDirty = JSON.stringify({ items, meta }) !== baseline.current;
  useDirtyTracker(isDirty);

  const catalogByCode = useMemo(() => {
    const m = new Map<string, CatalogEntry>();
    for (const c of catalog) m.set(c.code.toLowerCase(), c);
    return m;
  }, [catalog]);

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

  // Kod girilince katalogdan otomatik dolum (tam eşleşme).
  function onCodeChange(id: string, code: string) {
    const hit = catalogByCode.get(code.trim().toLowerCase());
    if (hit) {
      update(id, {
        code,
        name: hit.name,
        unit: hit.unit,
        kind: hit.kind,
        currency: (["USD", "EUR", "TRY"].includes(hit.currency) ? hit.currency : "USD") as QuoteCurrency,
        unitCost: hit.lastUnitCost,
      });
    } else {
      update(id, { code });
    }
  }

  function addRow() {
    setItems((p) => [...p, blankItem()]);
  }
  function removeRow(id: string) {
    setItems((p) => (p.length <= 1 ? p : p.filter((it) => it.id !== id)));
  }

  const rates = { usd: meta.usd, eur: meta.eur };
  const totalCostTRY = items.reduce((s, it) => s + lineTotalCostTRY(it, rates), 0);

  async function handleSave(goNext: boolean) {
    const valid = items.filter((it) => it.name.trim() || it.code.trim());
    if (valid.length === 0) {
      toast.error("En az bir kalem girin");
      return;
    }
    setSaving(true);
    try {
      await saveQuote(projectId, valid, meta, 2);
      baseline.current = JSON.stringify({ items: valid, meta });
      setItems(valid);
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

      {/* Kur satırı */}
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
          <p className="ml-auto text-xs text-muted-foreground">
            Kâr oranları ve KDV <strong className="text-foreground">Analiz</strong> sekmesinde.
          </p>
        </CardContent>
      </Card>

      {/* Kalem tablosu */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-28 px-2 py-2 text-left">Tür</th>
                  <th className="w-24 px-2 py-2 text-left">Kod</th>
                  <th className="min-w-[180px] px-2 py-2 text-left">Açıklama</th>
                  <th className="w-16 px-2 py-2 text-left">Birim</th>
                  <th className="w-20 px-2 py-2 text-right">Miktar</th>
                  <th className="w-16 px-2 py-2 text-center">Para</th>
                  <th className="w-28 px-2 py-2 text-right">Birim Maliyet</th>
                  <th className="w-28 px-2 py-2 text-right">Toplam (₺)</th>
                  <th className="w-8 px-2 py-2" data-edit-only />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-muted/30">
                    <td className="px-2 py-1.5">
                      <select
                        className="h-8 w-full rounded-md border bg-card px-1 text-xs"
                        value={it.kind}
                        onChange={(e) => update(it.id, { kind: e.target.value as QuoteItem["kind"] })}
                      >
                        <option value="MALZEME">Malzeme</option>
                        <option value="HIZMET">Hizmet</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        list="catalog-codes"
                        className={inputCls}
                        value={it.code}
                        placeholder="kod"
                        onChange={(e) => onCodeChange(it.id, e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className={inputCls}
                        value={it.name}
                        placeholder="Açıklama"
                        onChange={(e) => update(it.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className={inputCls}
                        value={it.unit}
                        onChange={(e) => update(it.id, { unit: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="any"
                        className={cn(inputCls, "text-right")}
                        value={it.qty}
                        onChange={(e) => update(it.id, { qty: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
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
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        className={cn(inputCls, "text-right")}
                        value={it.unitCost}
                        onChange={(e) => update(it.id, { unitCost: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                      ₺{fmt(lineTotalCostTRY(it, rates))}
                      {it.currency !== "TRY" && (
                        <span className="ml-1 block text-[10px] font-normal text-muted-foreground">
                          {it.currency} {fmt(it.unitCost, 2)} / birim
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center" data-edit-only>
                      <button
                        type="button"
                        onClick={() => removeRow(it.id)}
                        disabled={items.length <= 1}
                        className="rounded-md p-1 text-destructive/70 transition-colors hover:bg-destructive-soft hover:text-destructive-soft-foreground disabled:opacity-30"
                        aria-label="Kalemi sil"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="catalog-codes">
              {catalog.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </datalist>
          </div>
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5">
            <Button data-edit-only variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-3.5" /> Kalem Ekle
            </Button>
            <p className="text-sm">
              Toplam Maliyet:{" "}
              <span className="font-semibold tabular-nums">₺{fmt(totalCostTRY)}</span>
              {fxLoading && <Loader2 className="ml-2 inline size-3 animate-spin text-muted-foreground" />}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
