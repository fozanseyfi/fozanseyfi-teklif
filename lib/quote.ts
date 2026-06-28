// Malzeme & Hizmet teklifi — paylaşılan tipler ve hesaplama yardımcıları.
// Client + server her yerden kullanılabilsin diye saf veri (server-only yok).

export type QuoteCurrency = "USD" | "EUR" | "TRY";
export type QuoteOutputCurrency = "TRY" | "USD" | "EUR";
export type QuoteItemKindT = "MALZEME" | "HIZMET";

/**
 * Ödeme şekli satırı — birden çok tanımlanır, PDF'de yalnız `show` olanlar çıkar.
 * percent: genel toplamın (KDV dahil) yüzdesi; tutar buradan hesaplanır.
 */
export interface PaymentTerm {
  id: string;
  percent: number; // %
  method: string; // ödeme şekli (peşin, havale, kredi kartı…)
  vade: string; // vade (örn. "60 gün", "teslimde")
  desc: string; // açıklama
  show: boolean;
}

/** Teklif revizyonu — her biri bağımsız düzenlenebilir kopya. */
export interface QuoteRevision {
  id: string;
  label: string;
  createdAt: string; // ISO
  items: QuoteItem[];
  meta: QuoteMeta;
}

export interface QuoteItem {
  id: string;
  kind: QuoteItemKindT;
  code: string; // katalog kodu (zorunlu — kalemler katalogdan seçilir)
  name: string; // katalog adı
  desc?: string; // serbest açıklama (elle yazılır)
  unit: string;
  qty: number;
  currency: QuoteCurrency; // kalemin girildiği para birimi
  unitCost: number; // girilen para biriminde, maliyet (KDV/kâr hariç)
  marginPct: number; // kalem bazlı kâr yüzdesi (maliyet üzerine)
  notes?: string;
  // Opsiyon kalemi: ana teklif toplamına girmez; PDF'de "Opsiyonlar" altında
  // yalnızca KDV dahil satış fiyatıyla ayrı gösterilir.
  isOption?: boolean;
}

export interface QuoteMeta {
  usd: number; // 1 USD = ? TRY
  eur: number; // 1 EUR = ? TRY
  kdvRate: number; // % (örn. 20)
  outputCurrency: QuoteOutputCurrency; // teklifin sunum para birimi
  quoteNo?: string;
  quoteDate?: string; // ISO yyyy-mm-dd
  validityDays?: number;
  notes?: string; // teklif notları (PDF'de gösterilir)
  paymentTerms?: PaymentTerm[]; // ödeme şekli seçenekleri
}

export const QUOTE_ITEM_KIND_LABELS: Record<QuoteItemKindT, string> = {
  MALZEME: "Malzeme",
  HIZMET: "Hizmet",
};

export const DEFAULT_QUOTE_META: QuoteMeta = {
  usd: 0,
  eur: 0,
  kdvRate: 20,
  outputCurrency: "TRY",
  validityDays: 30,
};

export function currencySymbol(c: QuoteCurrency | QuoteOutputCurrency): string {
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  return "₺";
}

/** Bir tutarı (girilen para biriminde) TRY'ye çevirir. */
export function toTRY(amount: number, currency: QuoteCurrency, rates: { usd: number; eur: number }): number {
  if (!Number.isFinite(amount)) return 0;
  if (currency === "TRY") return amount;
  if (currency === "USD") return amount * (rates.usd || 0);
  if (currency === "EUR") return amount * (rates.eur || 0);
  return amount;
}

/** TRY'den hedef sunum para birimine çevirir. */
export function fromTRY(amountTRY: number, out: QuoteOutputCurrency, rates: { usd: number; eur: number }): number {
  if (out === "TRY") return amountTRY;
  if (out === "USD") return rates.usd ? amountTRY / rates.usd : 0;
  if (out === "EUR") return rates.eur ? amountTRY / rates.eur : 0;
  return amountTRY;
}

/** Herhangi bir para biriminden hedef sunum para birimine çevirir. */
export function convert(
  amount: number,
  from: QuoteCurrency,
  out: QuoteOutputCurrency,
  rates: { usd: number; eur: number },
): number {
  return fromTRY(toTRY(amount, from, rates), out, rates);
}

/** Kalemin sunum para biriminde satış birim fiyatı (maliyet + kâr). */
export function lineUnitSaleOut(item: QuoteItem, out: QuoteOutputCurrency, rates: { usd: number; eur: number }): number {
  return convert(item.unitCost, item.currency, out, rates) * (1 + (item.marginPct || 0) / 100);
}

/** Kalemin sunum para biriminde satır toplamı. */
export function lineTotalSaleOut(item: QuoteItem, out: QuoteOutputCurrency, rates: { usd: number; eur: number }): number {
  return lineUnitSaleOut(item, out, rates) * (item.qty || 0);
}

/** Kalemin TRY maliyet toplamı (iç özet — her zaman TRY). */
export function lineTotalCostTRY(item: QuoteItem, rates: { usd: number; eur: number }): number {
  return toTRY(item.unitCost, item.currency, rates) * (item.qty || 0);
}

/** Kalemin TRY satış toplamı (iç kâr hesabı için). */
export function lineTotalSaleTRY(item: QuoteItem, rates: { usd: number; eur: number }): number {
  return lineTotalCostTRY(item, rates) * (1 + (item.marginPct || 0) / 100);
}

/** Kalemin sunum para biriminde KDV DAHİL satır toplamı (opsiyonlar için). */
export function lineTotalSaleInclKdvOut(
  item: QuoteItem,
  out: QuoteOutputCurrency,
  rates: { usd: number; eur: number },
  kdvRate: number,
): number {
  return lineTotalSaleOut(item, out, rates) * (1 + (kdvRate || 0) / 100);
}

export interface QuoteTotals {
  out: QuoteOutputCurrency;
  symbol: string;
  subtotal: number; // KDV hariç satış toplamı (sunum para birimi)
  kdv: number;
  grandTotal: number;
  malzemeSubtotal: number;
  hizmetSubtotal: number;
  // İç özet — her zaman TRY:
  totalCostTRY: number;
  profitTRY: number;
  saleExKdvTRY: number; // satış (KDV hariç) = maliyet + kâr, TRY
  malzemeCostTRY: number;
  hizmetCostTRY: number;
}

export function computeQuoteTotals(items: QuoteItem[], meta: QuoteMeta): QuoteTotals {
  const rates = { usd: meta.usd, eur: meta.eur };
  const out = meta.outputCurrency || "TRY";
  let subtotal = 0;
  let malzemeSubtotal = 0;
  let hizmetSubtotal = 0;
  let totalCostTRY = 0;
  let totalSaleTRY = 0;
  let malzemeCostTRY = 0;
  let hizmetCostTRY = 0;
  for (const it of items) {
    if (it.isOption) continue; // opsiyonlar ana toplama girmez
    const sale = lineTotalSaleOut(it, out, rates);
    const costTRY = lineTotalCostTRY(it, rates);
    subtotal += sale;
    if (it.kind === "HIZMET") {
      hizmetSubtotal += sale;
      hizmetCostTRY += costTRY;
    } else {
      malzemeSubtotal += sale;
      malzemeCostTRY += costTRY;
    }
    totalCostTRY += costTRY;
    totalSaleTRY += lineTotalSaleTRY(it, rates);
  }
  const kdv = subtotal * ((meta.kdvRate || 0) / 100);
  return {
    out,
    symbol: currencySymbol(out),
    subtotal,
    kdv,
    grandTotal: subtotal + kdv,
    malzemeSubtotal,
    hizmetSubtotal,
    totalCostTRY,
    profitTRY: totalSaleTRY - totalCostTRY,
    saleExKdvTRY: totalSaleTRY,
    malzemeCostTRY,
    hizmetCostTRY,
  };
}

/** Güvenli parse — DB JSON'undan QuoteItem[] üretir. */
export function parseQuoteItems(raw: unknown): QuoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r, i) => ({
      id: typeof r.id === "string" ? r.id : `item-${i}`,
      kind: r.kind === "HIZMET" ? "HIZMET" : "MALZEME",
      code: typeof r.code === "string" ? r.code : "",
      name: typeof r.name === "string" ? r.name : "",
      desc: typeof r.desc === "string" ? r.desc : undefined,
      unit: typeof r.unit === "string" ? r.unit : "adet",
      qty: typeof r.qty === "number" ? r.qty : 0,
      currency: r.currency === "EUR" || r.currency === "TRY" ? r.currency : "USD",
      unitCost: typeof r.unitCost === "number" ? r.unitCost : 0,
      marginPct: typeof r.marginPct === "number" ? r.marginPct : 0,
      notes: typeof r.notes === "string" ? r.notes : undefined,
      isOption: r.isOption === true,
    }));
}

/** Güvenli parse — settings JSON'undan QuoteMeta üretir. */
export function parseQuoteMeta(raw: unknown): QuoteMeta {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    usd: typeof r.usd === "number" ? r.usd : 0,
    eur: typeof r.eur === "number" ? r.eur : 0,
    kdvRate: typeof r.kdvRate === "number" ? r.kdvRate : 20,
    outputCurrency: r.outputCurrency === "USD" ? "USD" : "TRY",
    quoteNo: typeof r.quoteNo === "string" ? r.quoteNo : undefined,
    quoteDate: typeof r.quoteDate === "string" ? r.quoteDate : undefined,
    validityDays: typeof r.validityDays === "number" ? r.validityDays : 30,
    notes: typeof r.notes === "string" ? r.notes : undefined,
    paymentTerms: parsePaymentTerms(r.paymentTerms),
  };
}

export function parsePaymentTerms(raw: unknown): PaymentTerm[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r, i) => ({
      id: typeof r.id === "string" ? r.id : `pt-${i}`,
      percent: typeof r.percent === "number" ? r.percent : 0,
      // Geri-uyum: eski {text} kayıtlarını ödeme şekli alanına taşı.
      method: typeof r.method === "string" ? r.method : typeof r.text === "string" ? r.text : "",
      vade: typeof r.vade === "string" ? r.vade : "",
      desc: typeof r.desc === "string" ? r.desc : "",
      show: r.show !== false,
    }));
}

/**
 * Revizyonları parse eder. Boşsa, eski/mevcut quoteItems+settings'ten tek bir
 * "Orijinal" revizyon üretir (geriye-uyumluluk).
 */
export function parseQuoteRevisions(
  raw: unknown,
  fallbackItems: QuoteItem[],
  fallbackMeta: QuoteMeta,
): QuoteRevision[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r, i) => ({
        id: typeof r.id === "string" ? r.id : `rev-${i}`,
        label: typeof r.label === "string" ? r.label : i === 0 ? "Orijinal" : `Revize ${i}`,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
        items: parseQuoteItems(r.items),
        meta: parseQuoteMeta(r.meta),
      }));
  }
  return [{ id: "orig", label: "Orijinal", createdAt: "", items: fallbackItems, meta: fallbackMeta }];
}
