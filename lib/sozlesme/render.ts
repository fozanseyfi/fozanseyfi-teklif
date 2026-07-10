/**
 * Sözleşme metin render'ı — form belgelerini (EK-1, EK-2/EK-5, EK-3) doldurulan
 * değerlerle "bilgi işlenmiş" düz metne çevirir. Saf modül (client + server ortak;
 * fs yok). Statik belgeler (ana metin + matbu EK'ler) dosyadan okunur (server).
 */
import { getTemplate, fieldKey, type SozlesmeTemplate, type SozlesmeDoc, type SozlesmeField, type SozlesmeTur } from "./schema";

export interface DocMeta {
  id: string;
  ek: string;
  title: string;
  kind: "form" | "static";
}

/** Şablonun sıralı belge listesi: ana metin → doldurulabilir EK'ler → statik EK'ler. */
export function docList(template: SozlesmeTemplate): DocMeta[] {
  return [
    { id: template.anaMetin.id, ek: template.anaMetin.ek, title: template.anaMetin.title, kind: "static" },
    ...template.docs.map((d) => ({ id: d.id, ek: d.ek, title: d.title, kind: "form" as const })),
    ...template.statik.map((s) => ({ id: s.id, ek: s.ek, title: s.title, kind: "static" as const })),
  ];
}

function num(v: string): number {
  const n = parseFloat((v || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function trNumber(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/** Ödeme oranından tutar (EK-2 genelToplam / EK-5 ek5Toplam × oran%). */
export function computedAmount(doc: SozlesmeDoc, f: SozlesmeField, values: Record<string, string>): string | null {
  if (f.suffix !== "%") return null;
  const toplamKey = doc.id === "ek2" ? "genelToplam" : doc.id === "ek5" ? "ek5Toplam" : null;
  if (!toplamKey) return null;
  const oran = num(values[fieldKey(doc.id, f.key)] ?? "");
  const toplam = num(values[fieldKey(doc.id, toplamKey)] ?? "");
  if (Number.isNaN(oran) || Number.isNaN(toplam) || !oran || !toplam) return null;
  return trNumber((toplam * oran) / 100);
}

/** Doldurulabilir bir EK belgesinin bilgi işlenmiş düz metni. */
export function renderFormDocText(doc: SozlesmeDoc, values: Record<string, string>): string {
  const out: string[] = [];
  out.push(`${doc.ek} — ${doc.title.toLocaleUpperCase("tr-TR")}`);
  out.push("");
  for (const sec of doc.sections) {
    out.push(sec.title);
    for (const f of sec.fields) {
      const v = values[fieldKey(doc.id, f.key)] ?? "";
      const suffix = v && f.suffix && f.suffix !== "%" ? ` ${f.suffix}` : "";
      const pct = v && f.suffix === "%" ? " %" : "";
      out.push(`    ${f.label}: ${v ? v + pct : "………………"}${suffix}`);
      const amt = computedAmount(doc, f, values);
      if (amt) out.push(`        → Tutar: ${amt}`);
    }
    out.push("");
  }
  out.push("İŞVEREN (Kaşe / İmza)                    YÜKLENİCİ (Kaşe / İmza)");
  return out.join("\n").trim();
}

/** Bir belgenin nihai metni: override varsa o, yoksa form→render / statik→dosya. */
export function finalDocText(
  tur: SozlesmeTur,
  meta: DocMeta,
  values: Record<string, string>,
  overrides: Record<string, string>,
  staticTexts: Record<string, string>,
): string {
  if (overrides[meta.id] != null) return overrides[meta.id];
  if (meta.kind === "form") {
    const doc = getTemplate(tur).docs.find((d) => d.id === meta.id);
    return doc ? renderFormDocText(doc, values) : "";
  }
  return staticTexts[meta.id] ?? "";
}
