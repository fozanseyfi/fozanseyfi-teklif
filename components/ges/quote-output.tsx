"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Share2 } from "lucide-react";
import { DetailPageHeader } from "@/components/ges/detail-page-header";
import { resolveBrand, type BrandSettings } from "@/lib/pdf-brand";
import { buildQuotePrintHtml } from "@/lib/share-print/quote";
import {
  type QuoteItem,
  type QuoteMeta,
  computeQuoteTotals,
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
  items: QuoteItem[];
  meta: QuoteMeta;
  brand: BrandSettings;
  firmName: string;
  userEmail: string;
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function QuoteOutput({ projectId, quoteTitle, customer, items, meta, brand, firmName, userEmail }: Props) {
  const brandCtx = useMemo(() => resolveBrand(brand), [brand]);
  const totals = computeQuoteTotals(items, meta);

  function downloadPdf() {
    const html = buildQuotePrintHtml({
      quoteTitle,
      customer,
      items,
      meta,
      brand: brandCtx,
      firmName,
      userEmail,
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const empty = items.length === 0;

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

      {empty ? (
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
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Ara Toplam (KDV hariç)</span>
                <span className="tabular-nums">₺{fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>KDV (%{fmt(meta.kdvRate)})</span>
                <span className="tabular-nums">₺{fmt(totals.kdv)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold text-primary">
                <span>Genel Toplam</span>
                <span className="tabular-nums">₺{fmt(totals.grandTotal)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {items.length} kalem · PDF müşteriye satış fiyatı ve KDV gösterir; maliyet/kâr görünmez.
              Paylaşım linki oluşturmak için <strong>Paylaşım Linki</strong> sayfasından bu teklifi seçip
              &quot;Teklif&quot; sekmesini işaretleyin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
