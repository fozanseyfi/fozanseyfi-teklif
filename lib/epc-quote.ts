import type { Project } from "@prisma/client";
import { calc } from "@/lib/ges-engine";
import type { GesSettings, KesifGroup } from "@/lib/ges-defaults";
import { DEFAULT_QUOTE_META, type QuoteItem, type QuoteMeta } from "@/lib/quote";

/**
 * Anahtar teslim (EPC) projenin ana teklifi — tek kalem: proje adı karşısında
 * anahtar teslim satış fiyatı (USD, KDV hariç). Malzeme & Hizmet teklifinin PDF'i
 * (buildQuotePrintHtml) ve paylaşımdaki "Teklif" sayfası bu kalemle aynı şablonu kullanır.
 */
export function buildEpcQuote(
  project: Pick<Project, "id" | "name" | "installationType" | "projectLocation">,
  detail: { kesifA: unknown; kesifB: unknown; settings: unknown },
): { items: QuoteItem[]; meta: QuoteMeta; salePriceUsd: number } {
  const s = (detail.settings ?? {}) as GesSettings;
  let salePriceUsd = 0;
  try {
    salePriceUsd = calc(
      (detail.kesifA ?? []) as KesifGroup[],
      (detail.kesifB ?? []) as KesifGroup[],
      s,
    ).salePriceUsd;
  } catch {
    salePriceUsd = 0;
  }

  const dc =
    s.dcGuc >= 1
      ? `${s.dcGuc.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWp DC`
      : s.dcGuc > 0
        ? `${Math.round(s.dcGuc * 1000).toLocaleString("tr-TR")} kWp DC`
        : "";
  const ac =
    s.acGuc >= 1
      ? `${s.acGuc.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWe AC`
      : s.acGuc > 0
        ? `${Math.round(s.acGuc * 1000).toLocaleString("tr-TR")} kWe AC`
        : "";
  const loc = [s.il, s.ilce].filter((x) => x && String(x).trim()).join(" / ") || project.projectLocation || "";
  const kind = project.installationType === "ROOFTOP" ? "Çatı" : "Arazi";
  const desc = [
    `Anahtar teslim ${kind} GES — mühendislik, tedarik, montaj ve devreye alma`,
    [dc, ac].filter(Boolean).join(" / "),
    loc,
  ]
    .filter(Boolean)
    .join("\n");

  const item: QuoteItem = {
    id: `epc-${project.id}`,
    kind: "HIZMET",
    code: "",
    name: project.name || "Anahtar Teslim GES",
    desc,
    unit: "Götürü",
    qty: 1,
    currency: "USD",
    unitCost: Math.max(0, Math.round(salePriceUsd)),
    marginPct: 0,
  };

  const meta: QuoteMeta = {
    ...DEFAULT_QUOTE_META,
    // Kalem de sunum da USD; çeviri TL üzerinden gittiği için kur boşsa 1 kullan (sonuç değişmez)
    usd: s.usd || 1,
    eur: s.eur || 0,
    outputCurrency: "USD",
    quoteDate: new Date().toISOString().slice(0, 10),
  };

  return { items: salePriceUsd > 0 ? [item] : [], meta, salePriceUsd };
}
