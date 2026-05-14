"use client";

import { useState, useMemo } from "react";
import { FileDown, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BrandSettings, BrandDocument } from "@/lib/pdf-brand";

export interface PdfSelectorItem {
  id: string; // tab id ("firma", "kesif-a") veya "doc:<docId>"
  label: string;
}

interface Props {
  token: string;
  brand: BrandSettings;
  // Hangi item'lar seçilebilir? Layout build sırasında belirlenir
  // (sadece bu paylaşımda gerçekten görünen tab'ler + bireysel ek belgeler).
  items: PdfSelectorItem[];
}

export function PdfSelector({ token, brand, items }: Props) {
  const accent = brand.colorEnabled && brand.color ? brand.color : "#059669";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.id)),
    [items, selected],
  );

  async function handleDownload() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const itemsParam = Array.from(selected).join(",");
      const res = await fetch(
        `/api/share/${token}/combined-pdf?items=${encodeURIComponent(itemsParam)}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "PDF üretilemedi");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "teklif-paketi.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${selectedItems.length} öğe tek PDF olarak indirildi`);
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <>
      {/* Seçim listesi — sayfanın üst kısmı, tab nav'ın hemen altında */}
      <div
        data-share-chrome="pdf-selector"
        className="border-b border-slate-200 bg-white/80 backdrop-blur-md"
      >
        <div className="mx-auto max-w-[1440px] px-4 py-2 sm:px-6 lg:px-8">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1 text-[12px] text-slate-700 transition-colors hover:text-slate-900">
              <span className="inline-flex items-center gap-2">
                <FileDown className="size-3.5" style={{ color: accent }} />
                <span className="font-semibold">Tek PDF olarak indir</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {selected.size > 0 ? `${selected.size} seçili` : `${items.length} öğe`}
                </span>
              </span>
              <span className="text-[10.5px] text-slate-500 group-open:hidden">
                ▾ Listeyi aç
              </span>
              <span className="hidden text-[10.5px] text-slate-500 group-open:inline">
                ▴ Kapat
              </span>
            </summary>

            <div className="mt-2 space-y-1.5 pb-1">
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
              >
                {allSelected ? "Tümünü kaldır" : "Tümünü seç"}
              </button>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((it) => {
                  const isSelected = selected.has(it.id);
                  return (
                    <li key={it.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors",
                          isSelected
                            ? "border-transparent text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        )}
                        style={
                          isSelected ? { backgroundColor: accent } : undefined
                        }
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            isSelected
                              ? "border-white/40 bg-white/15"
                              : "border-slate-300 bg-white",
                          )}
                        >
                          {isSelected && <Check className="size-3 text-white" strokeWidth={3} />}
                        </span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(it.id)}
                          className="sr-only"
                        />
                        <span className="truncate">{it.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </div>
      </div>

      {/* Sticky alt çubuk — sadece en az 1 öğe seçilince görünür */}
      {selected.size > 0 && (
        <div
          data-share-chrome="pdf-download-bar"
          className="fixed inset-x-0 bottom-0 z-30 border-t-2 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
          style={{ borderTopColor: accent }}
        >
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0 text-[12.5px] text-slate-700">
              <strong className="text-slate-900">{selected.size} öğe</strong> seçili —
              <span className="text-slate-500"> tek PDF olarak birleştirilecek</span>
              <div className="mt-0.5 truncate text-[10.5px] text-slate-500">
                {selectedItems.map((s) => s.label).join(" · ")}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              Tek PDF İndir ({selected.size})
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Layout'tan çağrılan helper — kullanıcının paylaşımda gerçekten görebileceği
 * tab'leri + bireysel ek belgeleri seçim listesine dönüştürür.
 */
export function buildSelectorItems(
  tabs: { id: string; label: string }[],
  customDocs: BrandDocument[],
  includedDocIds: string[],
): PdfSelectorItem[] {
  const out: PdfSelectorItem[] = [];

  for (const t of tabs) {
    if (t.id === "belgeler") {
      // "Belgeler" tabını ayrı koymak yerine her belgeyi bireysel öğe olarak
      // ekle ki müşteri "3 dosyadan 2'sini" seçebilsin.
      for (const docId of includedDocIds) {
        const doc = customDocs.find((d) => d.id === docId);
        if (doc) {
          out.push({ id: `doc:${doc.id}`, label: doc.title || doc.fileName });
        }
      }
    } else {
      out.push({ id: t.id, label: t.label });
    }
  }
  return out;
}
