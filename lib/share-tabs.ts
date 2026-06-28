// Share Link tab tanimlari ve preset'ler — actions/share.ts'in "use server"
// kisitlamasi yuzunden non-async export'lar burada tutulur.

export type ShareTab =
  | "firma"
  | "referanslar"
  | "belgeler"
  | "teklif"
  | "kesif-a"
  | "kesif-b"
  | "boq-unpriced"
  | "boq-priced"
  | "priced-boq-summary"
  | "priced-boq-detailed"
  | "analiz"
  | "dor";

export interface ShareTabInfo {
  id: ShareTab;
  label: string;
  // sensitive: maliyet/kar gibi ic veriler iceren tab'ler — admin formunda
  // uyari ile isaretlenir, musteriye direkt gondermemesi icin.
  sensitive?: boolean;
}

export const SHARE_TABS: ShareTabInfo[] = [
  { id: "firma", label: "Firma Tanıtımı" },
  { id: "referanslar", label: "Referanslar" },
  { id: "belgeler", label: "Belgeler" },
  { id: "teklif", label: "Malzeme & Hizmet Teklifi" },
  { id: "kesif-a", label: "Keşif-A", sensitive: true },
  { id: "kesif-b", label: "Keşif-B", sensitive: true },
  { id: "boq-unpriced", label: "Fiyatsız BoQ" },
  { id: "boq-priced", label: "Fiyatlı BoQ", sensitive: true },
  { id: "priced-boq-summary", label: "Özet Teklif (P-BoQ)" },
  { id: "priced-boq-detailed", label: "Detaylı Teklif (P-BoQ)" },
  { id: "analiz", label: "Analiz", sensitive: true },
  { id: "dor", label: "DoR" },
];

export const VALID_TAB_IDS = new Set<string>(SHARE_TABS.map((t) => t.id));

/**
 * Müşteri-yönlü (public paylaşım) başlık + açıklama. Yönetici tarafındaki
 * teknik adlar (SHARE_TABS.label) aynı kalır; müşteri bu sade adları görür.
 * Genel Bakış kartları, üst sekme navigasyonu ve bölüm başlıklarında kullanılır.
 */
export interface CustomerTabInfo {
  label: string;
  desc: string;
}

export const CUSTOMER_TAB_INFO: Record<ShareTab, CustomerTabInfo> = {
  firma: { label: "Firma Tanıtımı", desc: "Bizi tanıyın — faaliyet alanlarımız ve uzmanlığımız" },
  referanslar: { label: "Referanslarımız", desc: "Tamamladığımız projeler ve müşterilerimiz" },
  belgeler: { label: "Belgeler", desc: "Sertifikalar ve ek belgeler" },
  teklif: { label: "Fiyat Teklifi", desc: "Teklifimize dahil kalemler ve toplam tutar" },
  "boq-unpriced": {
    label: "Malzeme Listesi",
    desc: "Teklifimize dahil tüm malzeme ve işler (fiyatsız kapsam listesi)",
  },
  "boq-priced": {
    label: "Fiyatlı Malzeme Listesi",
    desc: "Malzeme ve işler, kalem bazlı fiyatlarıyla",
  },
  "priced-boq-summary": { label: "Özet Fiyat Teklifi", desc: "Ana kalemler ve genel toplam" },
  "priced-boq-detailed": { label: "Detaylı Fiyat Teklifi", desc: "Kalem kalem fiyatlandırma" },
  "kesif-a": { label: "Malzeme Keşfi", desc: "Doğrudan malzeme ve işçilik kalemleri" },
  "kesif-b": { label: "Dolaylı Maliyetler", desc: "Genel gider kalemleri" },
  analiz: { label: "Finansal Özet", desc: "Yatırım getirisi ve finansal analiz" },
  dor: {
    label: "Sorumluluk Kapsam Tablosu",
    desc: "Hangi işten hangi taraf sorumlu — tedarik, montaj ve devreye alma",
  },
};

export function customerTabLabel(id: string): string {
  return (CUSTOMER_TAB_INFO as Record<string, CustomerTabInfo>)[id]?.label ?? id;
}

// Backward compat: eski tab id'leri yeni id'lere yonlendirir. Mevcut DB'deki
// kayitlar bozulmasin diye share-loader bu map ile parse eder.
export const TAB_ID_MIGRATION: Record<string, ShareTab> = {
  boq: "boq-unpriced",
  "priced-boq": "priced-boq-detailed",
};

export function normalizeTabId(id: string): ShareTab | null {
  if (VALID_TAB_IDS.has(id)) return id as ShareTab;
  if (id in TAB_ID_MIGRATION) return TAB_ID_MIGRATION[id];
  return null;
}

/**
 * Custom belge id'leri "doc:xxx" formatında saklanır. Bu prefix sayesinde
 * sabit tab id'leriyle karışmaz. Filtreleme helper'ı:
 */
export const DOC_TAB_PREFIX = "doc:";

export function isDocTabId(id: string): boolean {
  return id.startsWith(DOC_TAB_PREFIX);
}

export function extractDocId(id: string): string | null {
  if (!isDocTabId(id)) return null;
  return id.slice(DOC_TAB_PREFIX.length);
}

export function buildDocTabId(docId: string): string {
  return `${DOC_TAB_PREFIX}${docId}`;
}

export type SharePreset = "1d" | "7d" | "14d" | "30d" | "60d" | "90d" | "infinite";

export const PRESET_DAYS: Record<SharePreset, number | null> = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "60d": 60,
  "90d": 90,
  infinite: null,
};
