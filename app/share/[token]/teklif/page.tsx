import { requireShareTab } from "../_components/share-guard";
import { ShareDocFrame } from "@/components/shared/share-doc-frame";
import { buildQuotePrintHtml } from "@/lib/share-print/quote";
import { resolveBrand } from "@/lib/pdf-brand";
import { CUSTOMER_TAB_INFO } from "@/lib/share-tabs";
import { parseQuoteItems, parseQuoteMeta } from "@/lib/quote";
import { buildEpcQuote } from "@/lib/epc-quote";

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * Paylaşım → Teklif. Malzeme & Hizmet: kalem listesi. Anahtar teslim proje: tek kalem
 * (proje adı + anahtar teslim fiyat). İkisi de yönetici tarafındaki PDF ile birebir aynı
 * belge (kaşe / imza alanlarıyla); müşteri "PDF / Yazdır" ile indirir.
 */
export default async function ShareTeklifPage({ params }: Props) {
  const { token } = await params;
  const ctx = await requireShareTab(token, "teklif");

  const isMs = ctx.project.quoteKind === "MATERIAL_SERVICE";
  const epc = isMs ? null : buildEpcQuote(ctx.project, ctx.detail);
  const items = epc ? epc.items : parseQuoteItems(ctx.detail.quoteItems);
  const meta = epc ? epc.meta : parseQuoteMeta(ctx.detail.settings);

  const html = buildQuotePrintHtml({
    quoteTitle: ctx.project.name || "Teklif",
    customer: {
      name: ctx.project.customerName,
      email: ctx.project.customerEmail,
      phone: ctx.project.customerPhone,
      address: ctx.project.customerAddress,
      location: ctx.project.projectLocation,
    },
    items,
    meta,
    brand: resolveBrand(ctx.brand),
    firmName: ctx.firmName,
    userEmail: "",
    autoPrint: false,
  });

  return <ShareDocFrame html={html} title={CUSTOMER_TAB_INFO.teklif.label} desc={CUSTOMER_TAB_INFO.teklif.desc} />;
}
