"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RTooltip } from "recharts";
import { saveQuote } from "@/app/actions/quote";
import { useDirtyTracker } from "@/lib/unsaved-changes";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Save, ArrowRight, BarChart3, StickyNote, CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import {
  type QuoteItem,
  type QuoteMeta,
  type QuoteOutputCurrency,
  type PaymentTerm,
  QUOTE_ITEM_KIND_LABELS,
  lineTotalCostTRY,
  lineUnitSaleOut,
  lineTotalSaleOut,
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

const PIE_COLORS = { malzeme: "#0ea5e9", hizmet: "#8b5cf6", kar: "#10b981" };

export function QuoteAnaliz({ projectId, projectName, initialItems, initialMeta }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [meta, setMeta] = useState<QuoteMeta>(initialMeta);
  const [saving, setSaving] = useState(false);
  const [bulkMargin, setBulkMargin] = useState("");

  const baseline = useRef(JSON.stringify({ items: initialItems, meta: initialMeta }));
  const isDirty = JSON.stringify({ items, meta }) !== baseline.current;
  useDirtyTracker(isDirty);

  const out: QuoteOutputCurrency = meta.outputCurrency || "TRY";
  const rates = { usd: meta.usd, eur: meta.eur };
  const totals = computeQuoteTotals(items, meta);
  const sym = totals.symbol;
  const paymentTerms = meta.paymentTerms ?? [];

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

  function setPT(next: PaymentTerm[]) {
    setMeta((p) => ({ ...p, paymentTerms: next }));
  }
  function addPT() {
    setPT([...paymentTerms, { id: crypto.randomUUID(), text: "", show: true }]);
  }

  async function handleSave(goNext: boolean) {
    setSaving(true);
    try {
      const cleanMeta = { ...meta, paymentTerms: paymentTerms.filter((p) => p.text.trim()) };
      await saveQuote(projectId, items, cleanMeta, 3);
      baseline.current = JSON.stringify({ items, meta: cleanMeta });
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

  const pieData = [
    { name: "Malzeme", value: totals.malzemeCostTRY, color: PIE_COLORS.malzeme },
    { name: "Hizmet", value: totals.hizmetCostTRY, color: PIE_COLORS.hizmet },
    { name: "Kâr", value: Math.max(0, totals.profitTRY), color: PIE_COLORS.kar },
  ].filter((d) => d.value > 0);

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

      {/* Teklif para birimi + KDV + tarih/geçerlilik */}
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Teklif Para Birimi</Label>
            <select
              className="h-9 w-full rounded-md border bg-card px-2 text-sm font-semibold"
              value={out}
              onChange={(e) => setMeta((p) => ({ ...p, outputCurrency: e.target.value as QuoteOutputCurrency }))}
            >
              <option value="TRY">₺ TL</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">KDV %</Label>
            <Input
              type="number"
              step="1"
              className="h-9"
              value={meta.kdvRate}
              onChange={(e) => setMeta((p) => ({ ...p, kdvRate: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Teklif Tarihi</Label>
            <Input
              type="date"
              className="h-9"
              value={meta.quoteDate ?? ""}
              onChange={(e) => setMeta((p) => ({ ...p, quoteDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Geçerlilik (gün)</Label>
            <Input
              type="number"
              step="1"
              className="h-9"
              value={meta.validityDays ?? ""}
              onChange={(e) => setMeta((p) => ({ ...p, validityDays: parseInt(e.target.value) || 0 }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Toplu marj */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4" data-edit-only>
          <span className="text-xs font-medium text-muted-foreground">Tümüne kâr % uygula</span>
          <Input
            type="number"
            step="0.5"
            className="h-8 w-24 text-sm"
            value={bulkMargin}
            onChange={(e) => setBulkMargin(e.target.value)}
            placeholder="%"
          />
          <Button variant="outline" size="sm" onClick={applyBulk}>
            Uygula
          </Button>
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
                  <th className="w-28 px-2 py-2 text-right">Birim Satış ({sym})</th>
                  <th className="w-28 px-2 py-2 text-right">Satır Toplam ({sym})</th>
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
                            it.kind === "HIZMET" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700",
                          )}
                        >
                          {QUOTE_ITEM_KIND_LABELS[it.kind]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="font-medium">{it.name || it.code || "—"}</span>
                        {it.desc && <span className="block whitespace-pre-line text-[11px] text-muted-foreground">{it.desc}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmt(it.qty, it.qty % 1 === 0 ? 0 : 2)} {it.unit}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">₺{fmt(unitCostTRY, 2)}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="0.5"
                          className="h-8 w-full text-right text-sm"
                          value={it.marginPct}
                          onChange={(e) => setMargin(it.id, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{sym}{fmt(lineUnitSaleOut(it, out, rates), 2)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{sym}{fmt(lineTotalSaleOut(it, out, rates))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ödeme şekli + Teklif notları */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4" data-edit-only>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm">
                <CreditCard className="size-4 text-muted-foreground" /> Ödeme Şekli
              </Label>
              <Button variant="outline" size="sm" onClick={addPT}>
                <Plus className="size-3.5" /> Ekle
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Birden çok seçenek girip PDF&apos;de yalnızca işaretlediklerini göster.
            </p>
            {paymentTerms.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Örn. &quot;%50 peşin, %50 teslimde&quot;, &quot;Kredi kartı 6 taksit&quot;, &quot;60 gün vade&quot;
              </p>
            ) : (
              <div className="space-y-2">
                {paymentTerms.map((pt) => (
                  <div key={pt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pt.show}
                      onChange={(e) => setPT(paymentTerms.map((x) => (x.id === pt.id ? { ...x, show: e.target.checked } : x)))}
                      className="size-4 accent-primary"
                      title="PDF'de göster"
                    />
                    <Input
                      className="h-8 flex-1 text-sm"
                      value={pt.text}
                      placeholder="örn. %50 peşin, kalan teslimde"
                      onChange={(e) => setPT(paymentTerms.map((x) => (x.id === pt.id ? { ...x, text: e.target.value } : x)))}
                    />
                    <button
                      type="button"
                      onClick={() => setPT(paymentTerms.filter((x) => x.id !== pt.id))}
                      className="rounded-md p-1 text-destructive/70 hover:bg-destructive-soft"
                      aria-label="Sil"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4" data-edit-only>
            <Label className="flex items-center gap-1.5 text-sm">
              <StickyNote className="size-4 text-muted-foreground" /> Teklif Notları
            </Label>
            <p className="text-[11px] text-muted-foreground">Her satır PDF&apos;de ayrı madde olarak gösterilir.</p>
            <Textarea
              rows={5}
              value={meta.notes ?? ""}
              onChange={(e) => setMeta((p) => ({ ...p, notes: e.target.value }))}
              placeholder={"Teslim süresi 4 hafta\nNakliye dahildir\n2 yıl garanti"}
              maxLength={2000}
            />
          </CardContent>
        </Card>
      </div>

      {/* Toplamlar + grafik */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="size-4 text-primary" /> Müşteri Toplamı ({sym})
            </p>
            <div className="space-y-1 text-sm">
              <Row label="Ara Toplam (KDV hariç)" value={`${sym}${fmt(totals.subtotal)}`} />
              <Row label={`KDV (%${fmt(meta.kdvRate)})`} value={`${sym}${fmt(totals.kdv)}`} />
              <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-bold text-primary">
                <span>Genel Toplam</span>
                <span className="tabular-nums">{sym}{fmt(totals.grandTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* İç özet — her zaman ₺ */}
        <Card className="border-dashed">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-semibold text-muted-foreground">İç Özet (₺ — müşteriye gösterilmez)</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <Row label="Toplam Maliyet" value={`₺${fmt(totals.totalCostTRY)}`} muted />
              <Row label="Toplam Kâr" value={`₺${fmt(totals.profitTRY)}`} muted />
              <Row
                label="Kâr Yüzdesi"
                value={totals.totalCostTRY > 0 ? `%${fmt((totals.profitTRY / totals.totalCostTRY) * 100, 1)}` : "—"}
                muted
              />
              <div className="mt-1 flex items-center justify-between border-t pt-2 font-semibold text-foreground">
                <span>Satış Fiyatı (KDV hariç)</span>
                <span className="tabular-nums">₺{fmt(totals.saleExKdvTRY)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pasta grafik */}
        <Card>
          <CardContent className="p-3">
            <p className="mb-1 text-center text-xs font-semibold text-muted-foreground">Maliyet / Kâr Dağılımı (₺)</p>
            {pieData.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">Veri yok</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={38}>
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v) => `₺${fmt(Number(v) || 0)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
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
