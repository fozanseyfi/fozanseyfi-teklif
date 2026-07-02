"use client";

import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Teklif notları — madde madde kutucuk editörü. Her madde ayrı bir kutu ve
 * yazdıkça büyür (notun tamamı görünür). Enter yeni madde ekler (kutu içinde
 * satır atlamaz). Değer, PDF/çıktı ile uyumlu kalması için satır sonu (\n) ile
 * birleştirilmiş tek metin olarak saklanır.
 */
export function NotesMaddeEditor({
  value,
  onChange,
  placeholder = "Örn. Teslim süresi 4 hafta",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const parts = (value ?? "").split("\n");
  const items = parts.length ? parts : [""];
  const refs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const commit = (arr: string[]) => onChange(arr.join("\n"));
  const focusAt = (i: number) => setTimeout(() => refs.current[i]?.focus(), 0);

  function setAt(i: number, v: string) {
    const arr = [...items];
    // Yapıştırılan çok satırlı metin: her satır ayrı madde olur.
    arr[i] = v;
    commit(arr);
  }
  function addAfter(i: number) {
    const arr = [...items];
    arr.splice(i + 1, 0, "");
    commit(arr);
    focusAt(i + 1);
  }
  function removeAt(i: number) {
    const arr = items.filter((_, idx) => idx !== i);
    commit(arr.length ? arr : [""]);
    focusAt(Math.max(0, i - 1));
  }

  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
            {i + 1}
          </span>
          <textarea
            ref={(el) => {
              refs.current[i] = el;
            }}
            rows={1}
            value={it}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAfter(i);
              } else if (e.key === "Backspace" && it === "" && items.length > 1) {
                e.preventDefault();
                removeAt(i);
              }
            }}
            placeholder={i === 0 ? placeholder : `Madde ${i + 1}`}
            className={cn(
              "min-h-8 w-full resize-none overflow-hidden rounded-md border border-input bg-card px-3 py-1.5 text-sm leading-relaxed text-foreground shadow-sm transition-colors",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              "[field-sizing:content]",
            )}
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="mt-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-rose-600"
            aria-label="Maddeyi sil"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addAfter(items.length - 1)}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
      >
        <Plus className="size-3.5" /> Madde ekle
      </button>
    </div>
  );
}
