"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRevision } from "@/app/actions/quote";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Loader2, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import {
  type QuoteRevision,
  type QuoteOutputCurrency,
  computeQuoteTotals,
  lineUnitSaleOut,
  lineTotalSaleOut,
} from "@/lib/quote";

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function RevizelerClient({
  projectId,
  projectName,
  revisions,
}: {
  projectId: string;
  projectName: string;
  revisions: QuoteRevision[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const base = revisions[0];
  const baseTotals = base ? computeQuoteTotals(base.items, base.meta) : null;
  const lastIdx = revisions.length - 1;

  // Kalem × revize karşılaştırması: kod (yoksa ad) anahtarıyla tüm kalemlerin
  // birliği; her revizede o kaleme verilen birim ve satır fiyatı.
  const keyOf = (it: { code: string; name: string }) => (it.code || it.name).trim();
  const itemRows: { key: string; name: string }[] = [];
  const seenKeys = new Set<string>();
  for (const rev of revisions) {
    for (const it of rev.items) {
      const k = keyOf(it);
      if (k && !seenKeys.has(k)) {
        seenKeys.add(k);
        itemRows.push({ key: k, name: it.name || it.code });
      }
    }
  }
  const revMaps = revisions.map((r) => {
    const m = new Map<string, QuoteRevision["items"][number]>();
    for (const it of r.items) m.set(keyOf(it), it);
    return m;
  });
  const revOut: QuoteOutputCurrency[] = revisions.map((r) => r.meta.outputCurrency || "TRY");
  const revRates = revisions.map((r) => ({ usd: r.meta.usd, eur: r.meta.eur }));
  const revTotals = revisions.map((r) => computeQuoteTotals(r.items, r.meta));

  async function handleCreate() {
    setCreating(true);
    try {
      await createRevision(projectId);
      toast.success("Yeni revize oluşturuldu — Kalemler/Analiz'de düzenleyebilirsiniz");
      router.push(`/projects/${projectId}/detail/items`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Oluşturulamadı");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <DetailPageHeader
        kicker="Revizeler"
        title={projectName}
        backHref={`/projects/${projectId}/detail/quote-analiz`}
        actions={
          <Button data-edit-only size="sm" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Yeni Revize Oluştur
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Revize</th>
                <th className="px-4 py-2.5 text-left">Tarih</th>
                <th className="px-4 py-2.5 text-right">Kalem</th>
                <th className="px-4 py-2.5 text-right">Genel Toplam</th>
                <th className="px-4 py-2.5 text-right">Orijinale göre</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {revisions.map((rev, i) => {
                const t = computeQuoteTotals(rev.items, rev.meta);
                // Orijinale göre fark — aynı para birimine çevirip karşılaştırmak yerine
                // her ikisini TRY (KDV hariç satış) üzerinden kıyaslıyoruz.
                const delta =
                  baseTotals && baseTotals.saleExKdvTRY > 0 && i > 0
                    ? ((t.saleExKdvTRY - baseTotals.saleExKdvTRY) / baseTotals.saleExKdvTRY) * 100
                    : null;
                const isLast = i === lastIdx;
                return (
                  <tr key={rev.id} className={cn("hover:bg-muted/30", isLast && "bg-primary-soft/20")}>
                    <td className="px-4 py-2.5 font-medium">
                      {rev.label}
                      {isLast && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[9.5px] font-semibold text-success-soft-foreground">
                          <CheckCircle2 className="size-2.5" /> Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString("tr-TR") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{rev.items.length}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {t.symbol}{fmt(t.grandTotal)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {delta === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={delta < 0 ? "text-rose-600" : delta > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                          {delta > 0 ? "+" : ""}
                          {fmt(delta, 1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" asChild title="PDF'de bu revizeyi seç">
                        <a href={`/projects/${projectId}/detail/quote-pdf`}>
                          <ArrowUpRight className="size-3.5" />
                        </a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Kalem × revize fiyat karşılaştırması */}
      {itemRows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">Kalem Bazında Fiyat Karşılaştırması</div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="sticky left-0 z-10 min-w-[160px] bg-muted/50 px-3 py-2 text-left">Kalem</th>
                    {revisions.map((r, ri) => (
                      <th key={r.id} className={cn("min-w-[120px] px-3 py-2 text-right", ri === lastIdx && "text-primary")}>
                        {r.label}
                        <span className="block text-[9px] font-normal normal-case text-muted-foreground">birim / toplam</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemRows.map((row) => (
                    <tr key={row.key} className="hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">{row.name}</td>
                      {revisions.map((r, ri) => {
                        const it = revMaps[ri].get(row.key);
                        if (!it) {
                          return (
                            <td key={r.id} className="px-3 py-2 text-right text-muted-foreground/50">
                              —
                            </td>
                          );
                        }
                        const sym = revTotals[ri].symbol;
                        return (
                          <td key={r.id} className="px-3 py-2 text-right tabular-nums">
                            <span className="block text-[11px] text-muted-foreground">
                              {sym}{fmt(lineUnitSaleOut(it, revOut[ri], revRates[ri]), 2)}
                            </span>
                            <span className="block font-semibold">
                              {sym}{fmt(lineTotalSaleOut(it, revOut[ri], revRates[ri]))}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Genel toplam (KDV dahil) */}
                  <tr className="border-t-2 bg-primary-soft/30 font-semibold">
                    <td className="sticky left-0 z-10 bg-primary-soft/30 px-3 py-2">Genel Toplam (KDV dahil)</td>
                    {revisions.map((r, ri) => (
                      <td key={r.id} className="px-3 py-2 text-right tabular-nums text-primary">
                        {revTotals[ri].symbol}{fmt(revTotals[ri].grandTotal)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
