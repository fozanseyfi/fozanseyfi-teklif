// Share Link tab tanimlari ve preset'ler — actions/share.ts'in "use server"
// kisitlamasi yuzunden non-async export'lar burada tutulur.

export type ShareTab =
  | "firma"
  | "referanslar"
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
  { id: "firma", label: "Firma" },
  { id: "referanslar", label: "Referanslar" },
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

export type SharePreset = "1d" | "7d" | "30d" | "90d" | "infinite";

export const PRESET_DAYS: Record<SharePreset, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  infinite: null,
};
