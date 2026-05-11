// Share Link tab tanimlari ve preset'ler — actions/share.ts'in "use server"
// kisitlamasi yuzunden non-async export'lar burada tutulur.

export type ShareTab = "kesif-a" | "kesif-b" | "boq" | "priced-boq" | "analiz" | "dor";

export const SHARE_TABS: { id: ShareTab; label: string }[] = [
  { id: "kesif-a", label: "Keşif-A" },
  { id: "kesif-b", label: "Keşif-B" },
  { id: "boq", label: "BoQ" },
  { id: "priced-boq", label: "Fiyatlandırılmış BoQ" },
  { id: "analiz", label: "Analiz" },
  { id: "dor", label: "DoR" },
];

export const VALID_TAB_IDS = new Set<string>(SHARE_TABS.map((t) => t.id));

export type SharePreset = "1d" | "7d" | "30d" | "90d" | "infinite";

export const PRESET_DAYS: Record<SharePreset, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  infinite: null,
};
