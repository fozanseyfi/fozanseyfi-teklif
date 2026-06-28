"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileDown, Share2 } from "lucide-react";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import { resolveBrand, type BrandSettings } from "@/lib/pdf-brand";
import { buildQuotePrintHtml } from "@/lib/share-print/quote";
import {
  type QuoteRevision,
  type QuoteOutputCurrency,
  type QuoteItemKindT,
  type QuoteItem,
  computeQuoteTotals,
  lineUnitSaleOut,
  lineTotalSaleOut,
  QUOTE_ITEM_KIND_LABELS,
} from "@/lib/quote";

interface Props {
  projectId: string;
  quoteTitle: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    location: string | null;
  };
  revisions: QuoteRevision[];
  brand: BrandSettings;
  firmName: string;
  userEmail: string;
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function QuoteOutput({ projectId, quoteTitle, customer, revisions, brand, firmName, userEmail }: Props) {
  const brandCtx = useMemo(() => resolveBrand(brand), [brand]);
  const [selId, setSelId] = useState(revisions[revisions.length - 1]?.id ?? "");
  const selected = revisions.find((r) => r.id === selId) ?? revisions[revisions.length - 1];

  const items = selected?.items ?? [];
  const meta = selected?.meta;
  const totals = meta ? computeQuoteTotals(items, meta) : null;
  const out: QuoteOutputCurrency = meta?.outputCurrency || "TRY";
  const rates = { usd: meta?.usd ?? 0, eur: meta?.eur ?? 0 };
  const sym = totals?.symbol ?? "₺";

  function downloadPdf() {
    if (!meta) return;
    const html = buildQuotePrintHtml({ quoteTitle, customer, items, meta, brand: brandCtx, firmName, userEmail });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    // Yazdırma HTML içindeki window.onload script'i ile (görseller yüklenince) tetiklenir.
  }

  const empty = items.length === 0;
  const groups: { kind: QuoteItemKindT; rows: QuoteItem[] }[] = (
    [
      { kind: "MALZEME", rows: items.filter((i) => i.kind === "MALZEME" && !i.isOption) },
      { kind: "HIZMET", rows: items.filter((i) => i.kind === "HIZMET" && !i.isOption) },
    ] as { kind: QuoteItemKindT; rows: QuoteItem[] }[]
  ).filter((g) => g.rows.length > 0);
  const showGroups = groups.length > 1;
  const optionItems = items.filter((i) => i.isOption);
  const hasRevisions = revisions.length > 1;

  return (
    <div className="space-y-4">
      <DetailPageHeader
        kicker="Teklif Çıktısı"
        title={quoteTitle}
        backHref={`/projects/${projectId}/detail/quote-analiz`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/share-links">
                <Share2 className="size-3.5" /> Paylaşım Linki
              </Link>
            </Button>
            <Button size="sm" onClick={downloadPdf} disabled={empty}>
              <FileDown className="size-3.5" /> PDF İndir
            </Button>
          </>
        }
      />

      {hasRevisions && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Label className="text-sm font-medium">Hangi revizenin çıktısı?</Label>
            <select
              className="h-9 rounded-md border bg-card px-2 text-sm font-semibold"
              value={selId}
              onChange={(e) => setSelId(e.target.value)}
            >
              {revisions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">PDF ve önizleme seçilen revizeyi gösterir.</span>
          </CardContent>
        </Card>
      )}

      {empty || !totals ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Henüz kalem yok. Önce <strong>Kalemler</strong> sekmesinden kalem ekleyin.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-lg bg-muted/40 p-4 text-sm">
              <p className="font-semibold">{customer.name || "Müşteri belirtilmemiş"}</p>
              <p className="text-muted-foreground">
                {[customer.email, customer.phone].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left">Açıklama</th>
                    <th className="px-3 py-2 text-right">Miktar</th>
                    <th className="px-3 py-2 text-right">Birim Fiyat ({sym})</th>
                    <th className="px-3 py-2 text-right">Tutar ({sym})</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groups.map((g) => (
                    <Fragment key={g.kind}>
                      {showGroups && (
                        <tr>
                          <td colSpan={4} className="bg-muted/30 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-primary">
                            {QUOTE_ITEM_KIND_LABELS[g.kind]}
                          </td>
                        </tr>
                      )}
                      {g.rows.map((it) => (
                        <tr key={it.id}>
                          <td className="px-3 py-2">
                            <span className="font-medium">{it.name || it.code}</span>
                            {it.desc && <span className="block whitespace-pre-line text-[11px] text-muted-foreground">{it.desc}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">
                            {fmt(it.qty, it.qty % 1 === 0 ? 0 : 2)} {it.unit}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">{sym}{fmt(lineUnitSaleOut(it, out, rates), 2)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{sym}{fmt(lineTotalSaleOut(it, out, rates))}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Ara Toplam (KDV hariç)</span>
                <span className="tabular-nums">{sym}{fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>KDV (%{fmt(meta.kdvRate)})</span>
                <span className="tabular-nums">{sym}{fmt(totals.kdv)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold text-primary">
                <span>Genel Toplam</span>
                <span className="tabular-nums">{sym}{fmt(totals.grandTotal)}</span>
              </div>
            </div>

            {/* Opsiyonlar — ana toplama dahil değil, KDV hariç */}
            {optionItems.length > 0 && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-4 text-sm">
                <p className="mb-2 font-semibold text-violet-700">Opsiyonlar (ana teklife dahil değildir)</p>
                <div className="divide-y divide-violet-100">
                  {optionItems.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0">
                        {it.name || it.code}
                        {it.desc && <span className="text-muted-foreground"> — {it.desc}</span>}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {sym}{fmt(lineTotalSaleOut(it, out, rates))}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">KDV hariç</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ödeme şekli — yalnız işaretli */}
            {(meta.paymentTerms ?? []).filter((p) => p.show && (p.method.trim() || p.desc.trim() || p.vade.trim() || p.percent > 0)).length > 0 && (
              <div className="text-sm">
                <p className="font-semibold">Ödeme Şekli</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {(meta.paymentTerms ?? [])
                    .filter((p) => p.show && (p.method.trim() || p.desc.trim() || p.vade.trim() || p.percent > 0))
                    .map((p) => {
                      const amount = totals.grandTotal * ((p.percent || 0) / 100);
                      const bits = [
                        p.method.trim(),
                        p.vade.trim(),
                        p.percent > 0 ? `%${fmt(p.percent)} = ${sym}${fmt(amount)}` : "",
                        p.desc.trim(),
                      ].filter(Boolean);
                      return <li key={p.id}>{bits.join(" · ")}</li>;
                    })}
                </ul>
              </div>
            )}

            {/* Notlar — numaralı */}
            {(meta.notes ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length > 0 && (
              <div className="text-sm">
                <p className="font-semibold">Notlar</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
                  {(meta.notes ?? "")
                    .split(/\r?\n/)
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                </ol>
              </div>
            )}

            {meta.validityDays ? (
              <p className="text-xs text-muted-foreground">Bu teklif {meta.validityDays} gün geçerlidir.</p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              PDF müşteriye satış fiyatı ve KDV gösterir; maliyet/kâr görünmez.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
