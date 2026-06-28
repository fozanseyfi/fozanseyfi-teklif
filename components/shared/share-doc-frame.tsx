"use client";

import { Button } from "@/components/ui/button";
import { FileDown, Maximize2 } from "lucide-react";

/**
 * Paylaşım sekmelerinde PDF görünümünü doğrudan gösterir: yazdırılabilir
 * (A4 formatlı) HTML'i bir iframe içinde render eder. Müşteri sayfaya girince
 * çıktının birebir önizlemesini görür; "PDF / Yazdır" ile çıktı/kaydet yapar.
 * Mobilde HTML tablo yerine sayfa görünümü açıldığı için düzgün okunur.
 */
export function ShareDocFrame({ html, title, desc }: { html: string; title: string; desc?: string }) {
  function openInNew(print: boolean) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    if (print) setTimeout(() => w.print(), 400);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{desc}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => openInNew(false)}>
          <Maximize2 className="size-3.5" /> Tam Ekran
        </Button>
        <Button size="sm" onClick={() => openInNew(true)}>
          <FileDown className="size-3.5" /> PDF / Yazdır
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <iframe
          srcDoc={html}
          title={title}
          className="w-full"
          style={{ height: "85vh", border: 0 }}
          onLoad={(e) => {
            try {
              const doc = e.currentTarget.contentWindow?.document;
              if (doc) e.currentTarget.style.height = Math.max(640, doc.body.scrollHeight + 24) + "px";
            } catch {
              /* cross-origin değil ama yine de güvenli yut */
            }
          }}
        />
      </div>
    </div>
  );
}
