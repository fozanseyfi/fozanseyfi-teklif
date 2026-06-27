// Malzeme & Hizmet teklifi — paylaşılan tipler ve hesaplama yardımcıları.
// Client + server her yerden kullanılabilsin diye saf veri (server-only yok).

export type QuoteCurrency = "USD" | "EUR" | "TRY";
export type QuoteItemKindT = "MALZEME" | "HIZMET";

export interface QuoteItem {
  id: string;
  kind: QuoteItemKindT;
  code: string;
  name: string;
  unit: string;
  qty: number;
  currency: QuoteCurrency;
  unitCost: number; // girilen para biriminde, maliyet (KDV/kâr hariç)
  marginPct: number; // kalem bazlı kâr yüzdesi (maliyet üzerine)
  notes?: string;
}

export interface QuoteMeta {
  usd: number; // 1 USD = ? TRY
  eur: number; // 1 EUR = ? TRY
  kdvRate: number; // % (örn. 20)
  quoteNo?: string;
  quoteDate?: string; // ISO yyyy-mm-dd
  validityDays?: number;
  notes?: string;
}

export const QUOTE_ITEM_KIND_LABELS: Record<QuoteItemKindT, string> = {
  MALZEME: "Malzeme",
  HIZMET: "Hizmet",
};

export const DEFAULT_QUOTE_META: QuoteMeta = {
  usd: 0,
  eur: 0,
  kdvRate: 20,
  validityDays: 30,
};

/** Bir tutarı (girilen para biriminde) TRY'ye çevirir. */
export function toTRY(
  amount: number,
  currency: QuoteCurrency,
  rates: { usd: number; eur: number },
): number {
  if (!Number.isFinite(amount)) return 0;
  if (currency === "TRY") return amount;
  if (currency === "USD") return amount * (rates.usd || 0);
  if (currency === "EUR") return amount * (rates.eur || 0);
  return amount;
}

/** Kalemin TRY cinsinden satış birim fiyatı (maliyet + kâr). */
export function lineUnitSaleTRY(item: QuoteItem, rates: { usd: number; eur: number }): number {
  const costTRY = toTRY(item.unitCost, item.currency, rates);
  return costTRY * (1 + (item.marginPct || 0) / 100);
}

/** Kalemin TRY cinsinden satır toplamı (satış × miktar). */
export function lineTotalSaleTRY(item: QuoteItem, rates: { usd: number; eur: number }): number {
  return lineUnitSaleTRY(item, rates) * (item.qty || 0);
}

/** Kalemin TRY maliyet toplamı (iç kullanım — marj görünürlüğü için). */
export function lineTotalCostTRY(item: QuoteItem, rates: { usd: number; eur: number }): number {
  return toTRY(item.unitCost, item.currency, rates) * (item.qty || 0);
}

export interface QuoteTotals {
  subtotal: number; // KDV hariç satış toplamı (TRY)
  kdv: number; // TRY
  grandTotal: number; // TRY
  totalCost: number; // TRY (iç)
  profit: number; // TRY (iç)
  malzemeSubtotal: number;
  hizmetSubtotal: number;
}

/** Tüm kalemlerden TRY toplamları hesaplar. */
export function computeQuoteTotals(items: QuoteItem[], meta: QuoteMeta): QuoteTotals {
  const rates = { usd: meta.usd, eur: meta.eur };
  let subtotal = 0;
  let totalCost = 0;
  let malzemeSubtotal = 0;
  let hizmetSubtotal = 0;
  for (const it of items) {
    const sale = lineTotalSaleTRY(it, rates);
    subtotal += sale;
    totalCost += lineTotalCostTRY(it, rates);
    if (it.kind === "HIZMET") hizmetSubtotal += sale;
    else malzemeSubtotal += sale;
  }
  const kdv = subtotal * ((meta.kdvRate || 0) / 100);
  return {
    subtotal,
    kdv,
    grandTotal: subtotal + kdv,
    totalCost,
    profit: subtotal - totalCost,
    malzemeSubtotal,
    hizmetSubtotal,
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
      unit: typeof r.unit === "string" ? r.unit : "adet",
      qty: typeof r.qty === "number" ? r.qty : 0,
      currency:
        r.currency === "EUR" || r.currency === "TRY" ? r.currency : "USD",
      unitCost: typeof r.unitCost === "number" ? r.unitCost : 0,
      marginPct: typeof r.marginPct === "number" ? r.marginPct : 0,
      notes: typeof r.notes === "string" ? r.notes : undefined,
    }));
}

/** Güvenli parse — settings JSON'undan QuoteMeta üretir. */
export function parseQuoteMeta(raw: unknown): QuoteMeta {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    usd: typeof r.usd === "number" ? r.usd : 0,
    eur: typeof r.eur === "number" ? r.eur : 0,
    kdvRate: typeof r.kdvRate === "number" ? r.kdvRate : 20,
    quoteNo: typeof r.quoteNo === "string" ? r.quoteNo : undefined,
    quoteDate: typeof r.quoteDate === "string" ? r.quoteDate : undefined,
    validityDays: typeof r.validityDays === "number" ? r.validityDays : 30,
    notes: typeof r.notes === "string" ? r.notes : undefined,
  };
}
