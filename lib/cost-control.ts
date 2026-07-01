import { toTRY, currencySymbol, type QuoteCurrency } from "@/lib/quote";

/**
 * Maliyet Kontrol modülü — saf hesaplama yardımcıları. Kalem seviyesinde kur
 * satırda dondurulur (exchangeRate), bu yüzden kalemin TL toplamı için canlı
 * kura ihtiyaç yoktur; canlı kur yalnız satış fiyatı / tahsilat farklı para
 * biriminde olduğunda TL'ye çevirmek için kullanılır.
 */

export type Rates = { usd: number; eur: number };
export const COST_CURRENCIES: QuoteCurrency[] = ["TRY", "USD", "EUR"];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  HAVALE: "Havale",
  EFT: "EFT",
  NAKIT: "Nakit",
  KART: "Kart",
  CEK: "Çek",
};

export function csym(c: string): string {
  return currencySymbol((c as QuoteCurrency) || "TRY");
}

// ————————————————————————————————————————————————————————————————
// Kalem (line) hesapları — kur satırda donuktur.
// ————————————————————————————————————————————————————————————————

export interface LineLike {
  quantity: number;
  unitPrice: number;
  exchangeRate: number;
  vatRate: number;
  isInvoiced: boolean;
  plannedAmount: number | null;
  payments?: { amount: number }[];
}

/** Orijinal para biriminde satır toplamı (miktar × birim fiyat). */
export function lineOriginalTotal(l: { quantity: number; unitPrice: number }): number {
  return (l.quantity || 0) * (l.unitPrice || 0);
}

/** TL net (matrah) = miktar × birim fiyat × kur. */
export function lineNetTL(l: { quantity: number; unitPrice: number; exchangeRate: number }): number {
  return (l.quantity || 0) * (l.unitPrice || 0) * (l.exchangeRate || 0);
}

export function lineVatTL(l: LineLike): number {
  return lineNetTL(l) * ((l.vatRate || 0) / 100);
}

export function lineGrossTL(l: LineLike): number {
  return lineNetTL(l) + lineVatTL(l);
}

export function linePaidTL(l: LineLike): number {
  return (l.payments ?? []).reduce((s, p) => s + (p.amount || 0), 0);
}

/** Kalan ödenecek (net bazında — şartname: Kalan = TL Toplam − Ödenen). */
export function lineBalanceTL(l: LineLike): number {
  return lineNetTL(l) - linePaidTL(l);
}

export type PayStatus = "unpaid" | "partial" | "paid";
export function linePayStatus(l: LineLike): PayStatus {
  const net = lineNetTL(l);
  const paid = linePaidTL(l);
  if (paid <= 0.001) return "unpaid";
  if (paid + 0.5 >= net) return "paid";
  return "partial";
}

/** Varyans = gerçekleşen(net) − planlanan. Planlanan yoksa null. */
export function lineVariance(l: LineLike): number | null {
  if (l.plannedAmount == null) return null;
  return lineNetTL(l) - l.plannedAmount;
}

// ————————————————————————————————————————————————————————————————
// Proje özeti
// ————————————————————————————————————————————————————————————————

export interface CostProjectMetricsInput {
  salesPrice: number;
  salesCurrency: string;
  lines: LineLike[];
  collections: { amount: number; isPlanned?: boolean }[];
  partners: { name: string; sharePercent: number }[];
  rates: Rates;
}

export interface CostProjectMetrics {
  salesCurrency: string;
  salesSym: string;
  // Satış (girilen para biriminde) + TL karşılığı
  salesPrice: number;
  salesPriceTL: number;
  // Maliyet (TL)
  plannedTotalTL: number;
  actualNetTL: number;
  actualVatTL: number;
  actualGrossTL: number;
  remainingCostTL: number; // planlanan − gerçekleşen (planlanan varsa)
  varianceTL: number; // gerçekleşen − planlanan
  hasPlanned: boolean;
  // Faturalı / faturasız kırılımı (net / kdv / brüt)
  invoicedNetTL: number;
  invoicedVatTL: number;
  invoicedGrossTL: number;
  uninvoicedNetTL: number;
  uninvoicedVatTL: number;
  uninvoicedGrossTL: number;
  // Ödeme
  paidTL: number;
  payableBalanceTL: number;
  // Tahsilat (satış para biriminde)
  collectedTotal: number;
  plannedCollectedTotal: number;
  remainingReceivable: number;
  collectedTL: number;
  // Kâr (TL, net bazında)
  profitTL: number;
  profitMarginPct: number; // kâr / satış
  partnerShares: { name: string; sharePercent: number; amountTL: number }[];
  partnerPctTotal: number;
}

export function computeCostProjectMetrics(inp: CostProjectMetricsInput): CostProjectMetrics {
  const { salesPrice, salesCurrency, lines, collections, partners, rates } = inp;
  const salesSym = csym(salesCurrency);
  const salesPriceTL = toTRY(salesPrice || 0, (salesCurrency as QuoteCurrency) || "TRY", rates);

  let plannedTotalTL = 0;
  let hasPlanned = false;
  let actualNetTL = 0;
  let actualVatTL = 0;
  let invoicedNetTL = 0;
  let invoicedVatTL = 0;
  let uninvoicedNetTL = 0;
  let uninvoicedVatTL = 0;
  let paidTL = 0;

  for (const l of lines) {
    const net = lineNetTL(l);
    const vat = lineVatTL(l);
    actualNetTL += net;
    actualVatTL += vat;
    paidTL += linePaidTL(l);
    if (l.plannedAmount != null) {
      plannedTotalTL += l.plannedAmount;
      hasPlanned = true;
    }
    if (l.isInvoiced) {
      invoicedNetTL += net;
      invoicedVatTL += vat;
    } else {
      uninvoicedNetTL += net;
      uninvoicedVatTL += vat;
    }
  }

  const actualGrossTL = actualNetTL + actualVatTL;
  // Sadece gerçekten tahsil edilenler "collected"; planlananlar ayrı.
  const collectedTotal = collections.filter((c) => !c.isPlanned).reduce((s, c) => s + (c.amount || 0), 0);
  const plannedCollectedTotal = collections.filter((c) => c.isPlanned).reduce((s, c) => s + (c.amount || 0), 0);
  const remainingReceivable = (salesPrice || 0) - collectedTotal;
  const collectedTL = toTRY(collectedTotal, (salesCurrency as QuoteCurrency) || "TRY", rates);
  const profitTL = salesPriceTL - actualNetTL;
  const profitMarginPct = salesPriceTL > 0 ? (profitTL / salesPriceTL) * 100 : 0;

  const partnerPctTotal = partners.reduce((s, p) => s + (p.sharePercent || 0), 0);
  const partnerShares = partners.map((p) => ({
    name: p.name,
    sharePercent: p.sharePercent || 0,
    amountTL: profitTL * ((p.sharePercent || 0) / 100),
  }));

  return {
    salesCurrency,
    salesSym,
    salesPrice: salesPrice || 0,
    salesPriceTL,
    plannedTotalTL,
    actualNetTL,
    actualVatTL,
    actualGrossTL,
    remainingCostTL: plannedTotalTL - actualNetTL,
    varianceTL: actualNetTL - plannedTotalTL,
    hasPlanned,
    invoicedNetTL,
    invoicedVatTL,
    invoicedGrossTL: invoicedNetTL + invoicedVatTL,
    uninvoicedNetTL,
    uninvoicedVatTL,
    uninvoicedGrossTL: uninvoicedNetTL + uninvoicedVatTL,
    paidTL,
    payableBalanceTL: actualNetTL - paidTL,
    collectedTotal,
    plannedCollectedTotal,
    remainingReceivable,
    collectedTL,
    profitTL,
    profitMarginPct,
    partnerShares,
    partnerPctTotal,
  };
}

// Öntanımlı kategori seti (GES referanslı) — org'a ilk girişte seed'lenir.
export const DEFAULT_COST_CATEGORIES: { code: string; name: string }[] = [
  { code: "A.1", name: "Panel" },
  { code: "A.2", name: "İnverter Sistemi" },
  { code: "A.3", name: "Taşıyıcı Sistem" },
  { code: "A.4", name: "Kablo (DC / AG / OG / Topraklama)" },
  { code: "A.5", name: "Bağlantı Elemanları" },
  { code: "A.6", name: "Boru / Kum / Bims / Şerit" },
  { code: "A.7", name: "Pano / Kompanzasyon" },
  { code: "A.8", name: "İnşaat İşleri" },
  { code: "A.9", name: "İşçilik / Makine / Ekipman" },
  { code: "A.10", name: "Kurum Harçları ve Projelendirme" },
  { code: "A.11", name: "Nakliye / Gümrük" },
  { code: "A.12", name: "Diğer" },
];
