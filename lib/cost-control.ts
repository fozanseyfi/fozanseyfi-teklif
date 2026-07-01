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

/** KDV — faturasız kalemde KDV yoktur (0). */
export function lineVatTL(l: LineLike): number {
  if (!l.isInvoiced) return 0;
  return lineNetTL(l) * ((l.vatRate || 0) / 100);
}

/** KDV dahil tutar = tedarikçiye fiilen ödenen tutar (faturasızda = net). */
export function lineGrossTL(l: LineLike): number {
  return lineNetTL(l) + lineVatTL(l);
}

export function linePaidTL(l: LineLike): number {
  return (l.payments ?? []).reduce((s, p) => s + (p.amount || 0), 0);
}

/** Kalan ödenecek — tedarikçiye KDV DAHİL ödeniyor: Kalan = KDV dahil − Ödenen. */
export function lineBalanceTL(l: LineLike): number {
  return lineGrossTL(l) - linePaidTL(l);
}

export type PayStatus = "unpaid" | "partial" | "paid";
export function linePayStatus(l: LineLike): PayStatus {
  const gross = lineGrossTL(l);
  const paid = linePaidTL(l);
  if (paid <= 0.001) return "unpaid";
  if (paid + 0.5 >= gross) return "paid";
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

export const CORPORATE_TAX_RATE = 25; // %

export interface CostProjectMetricsInput {
  salesPrice: number;
  salesCurrency: string;
  salesVatRate?: number;
  salesInvoicedAmount?: number; // satışın faturalı (KDV hariç) kısmı, satış para biriminde
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
  paidTL: number; // fiilen ödenen nakit (aşırı ödeme dahil)
  paidAppliedTL: number; // borca mahsup edilen ödeme (Ödenen + Kalan = Toplam)
  payableBalanceTL: number;
  // Tahsilat (satış para biriminde)
  collectedTotal: number;
  plannedCollectedTotal: number;
  remainingReceivable: number;
  collectedTL: number;
  // Kâr (TL, net bazında)
  profitTL: number; // öngörülen: satış − gerçekleşen maliyet
  currentProfitTL: number; // mevcut/nakit: tahsil edilen − ödenen (alınmamış para dahil değil)
  plannedProfitTL: number; // teklif/planlanan kâr: satış − planlanan (öngörülen) maliyet
  profitMarginPct: number; // kâr / satış
  // Vergi & şirkete net (yalnız faturalı kısım vergilendirilir)
  salesInvoicedNetTL: number;
  salesUninvoicedNetTL: number;
  outputVatTL: number; // müşteriden alınan KDV (faturalı satış × satış KDV)
  inputVatTL: number; // faturalı maliyet KDV'si (indirilecek)
  vatPayableTL: number; // devlete ödenecek KDV = alınan − indirilecek
  invoicedProfitNetTL: number; // faturalı kâr (KDV hariç) = faturalı satış − faturalı maliyet
  corporateTaxTL: number; // faturalı kârın %25'i
  uninvoicedProfitNetTL: number; // faturasız kâr (vergisiz)
  companyNetTL: number; // şirkete net kalan
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
  let payableRemainingTL = 0; // satır bazında kalan (negatif olmaz)

  for (const l of lines) {
    const net = lineNetTL(l);
    const vat = lineVatTL(l);
    const paidLine = linePaidTL(l);
    actualNetTL += net;
    actualVatTL += vat;
    paidTL += paidLine;
    payableRemainingTL += Math.max(0, net + vat - paidLine);
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
  // Mevcut/nakit kâr: sadece tahsil edilen − fiilen ödenen (alınmamış para hariç).
  const currentProfitTL = collectedTL - paidTL;
  const plannedProfitTL = salesPriceTL - plannedTotalTL;
  const profitMarginPct = salesPriceTL > 0 ? (profitTL / salesPriceTL) * 100 : 0;

  // ——— Vergi & şirkete net (yalnız faturalı kısım) ———
  const salesVatRate = inp.salesVatRate ?? 20;
  const salesCur = (salesCurrency as QuoteCurrency) || "TRY";
  const salesInvoicedNetTL = toTRY(inp.salesInvoicedAmount ?? 0, salesCur, rates);
  const salesUninvoicedNetTL = Math.max(0, salesPriceTL - salesInvoicedNetTL);
  const outputVatTL = salesInvoicedNetTL * (salesVatRate / 100);
  const inputVatTL = invoicedVatTL; // faturalı maliyet KDV'si
  const vatPayableTL = outputVatTL - inputVatTL;
  // Faturalı kâr: faturalı satış − faturalı (belgeli) maliyet (indirilebilir gider).
  const invoicedProfitNetTL = salesInvoicedNetTL - invoicedNetTL;
  const corporateTaxTL = Math.max(0, invoicedProfitNetTL) * (CORPORATE_TAX_RATE / 100);
  // Faturasız kâr: faturasız satış − faturasız maliyet (vergisiz).
  const uninvoicedProfitNetTL = salesUninvoicedNetTL - uninvoicedNetTL;
  const companyNetTL = invoicedProfitNetTL - corporateTaxTL + uninvoicedProfitNetTL;

  const partnerPctTotal = partners.reduce((s, p) => s + (p.sharePercent || 0), 0);
  // Ortaklara dağıtılacak = MEVCUT kâr (tahsil − ödenen).
  const partnerShares = partners.map((p) => ({
    name: p.name,
    sharePercent: p.sharePercent || 0,
    amountTL: currentProfitTL * ((p.sharePercent || 0) / 100),
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
    // Borca mahsup edilen ödeme = brüt − kalan (aşırı ödeme şişirmez).
    paidAppliedTL: Math.max(0, actualGrossTL - payableRemainingTL),
    // Tedarikçilere kalan = satır bazında pozitif kalanların toplamı (aşırı
    // ödeme bir satırı eksiye düşürüp toplamı yanıltmasın).
    payableBalanceTL: payableRemainingTL,
    collectedTotal,
    plannedCollectedTotal,
    remainingReceivable,
    collectedTL,
    profitTL,
    currentProfitTL,
    plannedProfitTL,
    profitMarginPct,
    salesInvoicedNetTL,
    salesUninvoicedNetTL,
    outputVatTL,
    inputVatTL,
    vatPayableTL,
    invoicedProfitNetTL,
    corporateTaxTL,
    uninvoicedProfitNetTL,
    companyNetTL,
    partnerShares,
    partnerPctTotal,
  };
}

// Öntanımlı kategori seti — proje oluştururken kullanılan keşif kategorilerinin
// birebir aynısı (lib/ges-defaults ile uyumlu). Org'a ilk girişte seed'lenir.
export const DEFAULT_COST_CATEGORIES: { code: string; name: string }[] = [
  { code: "A.1", name: "Panel" },
  { code: "A.2", name: "İnverter Sistemi" },
  { code: "A.3", name: "Taşıyıcı Sistem" },
  { code: "A.4", name: "Kablo - DC - AG - OG - ZA - Topraklama" },
  { code: "A.5", name: "Bağlantı Elemanları" },
  { code: "A.6", name: "Boru - Kum - Bims - Şerit" },
  { code: "A.7", name: "OG Hücre - Trafo - Köşk" },
  { code: "A.8", name: "Pano - Kompanzasyon" },
  { code: "A.9", name: "Topraklama - Yıldırımdan Korunma" },
  { code: "A.10", name: "SCADA" },
  { code: "A.11", name: "Aydınlatma ve CCTV" },
  { code: "A.12", name: "İnşaat İşleri" },
  { code: "A.13", name: "İşçilik - Makine - Ekipman" },
  { code: "A.14", name: "Kurum Harçları ve Projelendirme Masrafları" },
  { code: "A.15", name: "Etiketleme - KKT - Sarf" },
  { code: "A.16", name: "Nakliye - Gümrük" },
  { code: "A.17", name: "Test Devreye Alma" },
  { code: "A.18", name: "Yedek Malzeme" },
  { code: "B.1", name: "Şirket Proje Genel Gider" },
  { code: "B.2", name: "Garanti Periyodu Masrafları - O&M" },
  { code: "B.3", name: "Teklif Geçerlilik Süresi Riskleri" },
  { code: "B.4", name: "Mektup Masrafları & Damga Vergisi" },
  { code: "B.5", name: "All Risk + Mali Mesuliyet" },
  { code: "B.6", name: "Proje Finans Maliyeti" },
];
