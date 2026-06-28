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
import { cn } from "@/lib/utils";
import { Save, ArrowRight, BarChart3, StickyNote, CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import {
  type QuoteItem,
  type QuoteMeta,
  type QuoteOutputCurrency,
  QUOTE_ITEM_KIND_LABELS,
  convert,
  fromTRY,
  lineTotalCostTRY,
  lineUnitSaleOut,
  lineTotalSaleOut,
  lineTotalSaleInclKdvOut,
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
  // Teklif tarihi varsayılan = sistem günü (boşsa).
  const todayISO = new Date().toISOString().slice(0, 10);
  const defMeta: QuoteMeta = { ...initialMeta, quoteDate: initialMeta.quoteDate || todayISO };

  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [meta, setMeta] = useState<QuoteMeta>(defMeta);
  const [saving, setSaving] = useState(false);
  const [bulkMargin, setBulkMargin] = useState("");
  const [targetTotal, setTargetTotal] = useState("");
  const [noteItems, setNoteItems] = useState<string[]>(() =>
    (initialMeta.notes ?? "").split(/\r?\n/).filter((l) => l.trim().length > 0),
  );

  function updateNotes(next: string[]) {
    setNoteItems(next);
    setMeta((p) => ({ ...p, notes: next.join("\n") }));
  }

  const baseline = useRef(JSON.stringify({ items: initialItems, meta: defMeta }));
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

  // Hedef genel toplam (KDV dahil, seçilen para biriminde) girilince, o toplama
  // ulaşacak tek kâr oranını tüm kalemlere dağıt.
  function applyTarget() {
    const t = parseFloat(targetTotal);
    if (!Number.isFinite(t) || t <= 0) {
      toast.error("Geçerli bir hedef fiyat girin");
      return;
    }
    const totalCostOut = items.reduce((s, it) => s + convert(it.unitCost, it.currency, out, rates) * (it.qty || 0), 0);
    if (totalCostOut <= 0) {
      toast.error("Önce kalem maliyetlerini girin");
      return;
    }
    const exTarget = t / (1 + (meta.kdvRate || 0) / 100);
    // Yuvarlama yapma — hedefe tam ulaşsın (kuruşuna kadar). 6 ondalık yeterli hassasiyet.
    const m = Math.round(((exTarget / totalCostOut - 1) * 100) * 1e6) / 1e6;
    setItems((prev) => prev.map((it) => ({ ...it, marginPct: m })));
    toast.success(`Kâr oranı %${fmt(m, 2)} olarak tüm kalemlere dağıtıldı`);
  }

  function setPT(next: typeof paymentTerms) {
    setMeta((p) => ({ ...p, paymentTerms: next }));
  }
  function addPT() {
    setPT([...paymentTerms, { id: crypto.randomUUID(), percent: 0, method: "", vade: "", desc: "", show: true }]);
  }
  function patchPT(id: string, patch: Partial<(typeof paymentTerms)[number]>) {
    setPT(paymentTerms.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function handleSave(goNext: boolean) {
    setSaving(true);
    try {
      const cleanMeta = {
        ...meta,
        paymentTerms: paymentTerms.filter((p) => p.method.trim() || p.desc.trim() || p.vade.trim() || p.percent > 0),
      };
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

  // TRY tutarını 3 para biriminde döndür.
  const tri = (amountTRY: number) => ({
    try: amountTRY,
    usd: fromTRY(amountTRY, "USD", rates),
    eur: fromTRY(amountTRY, "EUR", rates),
  });

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

      {/* Toplu marj + hedef fiyat */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4" data-edit-only>
          <div className="flex items-center gap-2">
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
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Toplam Hedef Fiyat ({sym}, KDV dahil)</span>
            <Input
              type="number"
              step="any"
              className="h-8 w-32 text-sm"
              value={targetTotal}
              onChange={(e) => setTargetTotal(e.target.value)}
              placeholder={sym}
            />
            <Button variant="outline" size="sm" onClick={applyTarget}>
              Dağıt
            </Button>
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
                  <th className="w-28 px-2 py-2 text-right">Birim Maliyet ({sym})</th>
                  <th className="w-20 px-2 py-2 text-right">Kâr %</th>
                  <th className="w-28 px-2 py-2 text-right">Birim Satış ({sym})</th>
                  <th className="w-28 px-2 py-2 text-right">Satır Toplam ({sym})</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it) => {
                  const unitCostOut = convert(it.unitCost, it.currency, out, rates);
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
                        {it.isOption && (
                          <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-700">
                            Opsiyon
                          </span>
                        )}
                        {it.desc && <span className="block whitespace-pre-line text-[11px] text-muted-foreground">{it.desc}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmt(it.qty, it.qty % 1 === 0 ? 0 : 2)} {it.unit}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{sym}{fmt(unitCostOut, 2)}</td>
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

      {/* İç özet — 3 para biriminde aynı anda (müşteriye gösterilmez) */}
      <Card className="border-dashed">
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-semibold text-muted-foreground">İç Özet — 3 para birimi (müşteriye gösterilmez)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 text-left font-semibold"> </th>
                  <th className="py-1.5 text-right font-semibold">₺ TL</th>
                  <th className="py-1.5 text-right font-semibold">$ USD</th>
                  <th className="py-1.5 text-right font-semibold">€ EUR</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <TriRow label="Toplam Maliyet" v={tri(totals.totalCostTRY)} />
                <TriRow label="Toplam Kâr" v={tri(totals.profitTRY)} accent />
                <TriRow label="Satış Fiyatı (KDV hariç)" v={tri(totals.saleExKdvTRY)} strong />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Ortalama Kâr Oranı:{" "}
            <strong className="text-foreground">
              {totals.totalCostTRY > 0 ? `%${fmt((totals.profitTRY / totals.totalCostTRY) * 100, 1)}` : "—"}
            </strong>
          </p>
        </CardContent>
      </Card>

      {/* Müşteri toplamı + pasta grafik */}
      <div className="grid gap-4 lg:grid-cols-2">
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

      {/* Opsiyonlar — ana toplama dahil değil, KDV dahil satış fiyatıyla */}
      {items.some((it) => it.isOption) && (
        <Card className="border-violet-200">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-semibold text-violet-700">Opsiyonlar (ana toplama dahil değildir)</p>
            <div className="divide-y">
              {items
                .filter((it) => it.isOption)
                .map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{it.name || it.code}</span>
                      {it.desc && <span className="text-muted-foreground"> — {it.desc}</span>}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({fmt(it.qty, it.qty % 1 === 0 ? 0 : 2)} {it.unit}, kâr %{fmt(it.marginPct)})
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {sym}{fmt(lineTotalSaleInclKdvOut(it, out, rates, meta.kdvRate))}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">KDV dahil</span>
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ödeme şekli + Teklif notları — en altta */}
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
              Yüzde girince KDV dahil tutar otomatik hesaplanır. PDF&apos;de yalnız işaretliler çıkar.
            </p>
            {paymentTerms.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Örn. %50 peşin · havale · teslimde
              </p>
            ) : (
              <div className="space-y-2">
                {paymentTerms.map((pt) => {
                  const amount = totals.grandTotal * ((pt.percent || 0) / 100);
                  return (
                    <div key={pt.id} className="rounded-md border p-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={pt.show}
                          onChange={(e) => patchPT(pt.id, { show: e.target.checked })}
                          className="mt-2 size-4 shrink-0 accent-primary"
                          title="PDF'de göster"
                        />
                        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="space-y-0.5">
                            <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">Yüzde %</span>
                            <Input
                              type="number"
                              step="1"
                              className="h-8 text-sm"
                              value={pt.percent || ""}
                              onChange={(e) => patchPT(pt.id, { percent: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">Tutar (KDV dahil)</span>
                            <div className="flex h-8 items-center rounded-md bg-muted px-2 text-sm font-semibold tabular-nums">
                              {sym}{fmt(amount)}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">Ödeme Şekli</span>
                            <Input className="h-8 text-sm" value={pt.method} placeholder="peşin / havale…" onChange={(e) => patchPT(pt.id, { method: e.target.value })} />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">Vade</span>
                            <Input className="h-8 text-sm" value={pt.vade} placeholder="örn. 60 gün" onChange={(e) => patchPT(pt.id, { vade: e.target.value })} />
                          </div>
                          <div className="space-y-0.5 sm:col-span-4">
                            <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">Açıklama</span>
                            <Input className="h-8 text-sm" value={pt.desc} placeholder="opsiyonel açıklama" onChange={(e) => patchPT(pt.id, { desc: e.target.value })} />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPT(paymentTerms.filter((x) => x.id !== pt.id))}
                          className="mt-1 rounded-md p-1 text-destructive/70 hover:bg-destructive-soft"
                          aria-label="Sil"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4" data-edit-only>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm">
                <StickyNote className="size-4 text-muted-foreground" /> Teklif Notları
              </Label>
              <Button variant="outline" size="sm" onClick={() => updateNotes([...noteItems, ""])}>
                <Plus className="size-3.5" /> Madde Ekle
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Her madde PDF&apos;de ayrı satır (1-2-3) olarak gösterilir.</p>
            {noteItems.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Örn. &quot;Teslim süresi 4 hafta&quot;, &quot;Nakliye dahildir&quot;, &quot;2 yıl garanti&quot;
              </p>
            ) : (
              <div className="space-y-2">
                {noteItems.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <Input
                      className="h-8 flex-1 text-sm"
                      value={line}
                      placeholder="Not maddesi…"
                      onChange={(e) => updateNotes(noteItems.map((x, idx) => (idx === i ? e.target.value : x)))}
                    />
                    <button
                      type="button"
                      onClick={() => updateNotes(noteItems.filter((_, idx) => idx !== i))}
                      className="rounded-md p-1 text-destructive/70 hover:bg-destructive-soft"
                      aria-label="Maddeyi sil"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function TriRow({
  label,
  v,
  accent,
  strong,
}: {
  label: string;
  v: { try: number; usd: number; eur: number };
  accent?: boolean;
  strong?: boolean;
}) {
  return (
    <tr className={cn(strong && "font-semibold text-foreground", accent && "text-emerald-700")}>
      <td className="py-2 text-left">{label}</td>
      <td className="py-2 text-right tabular-nums">₺{fmt(v.try)}</td>
      <td className="py-2 text-right tabular-nums">${fmt(v.usd)}</td>
      <td className="py-2 text-right tabular-nums">€{fmt(v.eur)}</td>
    </tr>
  );
}
