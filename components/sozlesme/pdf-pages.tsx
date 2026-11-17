"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";

/**
 * PDF'i pdf.js ile sayfa sayfa <canvas>'a çizer; her sayfa kap genişliğine sığar.
 * Telefon tarayıcıları <iframe> içinde PDF'i ya hiç göstermez (Android) ya da yalnız ilk
 * sayfaları büyütülmüş gösterir (iOS) — bu yüzden imzalı sözleşme burada çizilir.
 * Sayfalar ekrana yaklaştıkça çizilir (uzun taramalarda bellek şişmesin diye).
 */
export function PdfPages({ src, title }: { src: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ pages: number } | { error: string } | null>(null);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const observers: IntersectionObserver[] = [];

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ url: src, withCredentials: true });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        if (cancelled) return;
        host.replaceChildren();
        setState({ pages: doc.numPages });

        const width = () => host.clientWidth || 600;
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          // Yer tutucu: sayfa oranında kutu (çizilmeden önce de kaydırma doğru olsun)
          const slot = document.createElement("div");
          slot.className = "relative w-full overflow-hidden rounded-md border border-border bg-white shadow-sm";
          slot.style.aspectRatio = `${base.width} / ${base.height}`;
          const label = document.createElement("span");
          label.className = "absolute right-2 top-2 rounded bg-black/55 px-1.5 text-[10.5px] font-medium text-white";
          label.textContent = `${n} / ${doc.numPages}`;
          slot.appendChild(label);
          host.appendChild(slot);

          let drawn = false;
          const io = new IntersectionObserver(
            async (entries) => {
              if (drawn || !entries.some((e) => e.isIntersecting)) return;
              drawn = true;
              io.disconnect();
              const dpr = Math.min(window.devicePixelRatio || 1, 2);
              const vp = page.getViewport({ scale: (width() / base.width) * dpr });
              const canvas = document.createElement("canvas");
              canvas.width = Math.floor(vp.width);
              canvas.height = Math.floor(vp.height);
              canvas.className = "block h-full w-full";
              const ctx = canvas.getContext("2d");
              if (!ctx) return;
              await page.render({ canvasContext: ctx, viewport: vp }).promise;
              if (!cancelled) slot.insertBefore(canvas, label);
            },
            { rootMargin: "800px 0px" },
          );
          io.observe(slot);
          observers.push(io);
        }
      } catch (e) {
        if (!cancelled) setState({ error: e instanceof Error ? e.message : "PDF açılamadı" });
      }
    })();

    return () => {
      cancelled = true;
      observers.forEach((o) => o.disconnect());
      destroy?.();
    };
  }, [src]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
        {state && "pages" in state && <span>{state.pages} sayfa</span>}
        <a href={src} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <ExternalLink className="size-3.5" /> Yeni sekmede aç
        </a>
        <a href={src} download={`${title}.pdf`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <Download className="size-3.5" /> İndir
        </a>
      </div>
      {state && "error" in state && (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[12.5px] text-muted-foreground">
          PDF burada gösterilemedi ({state.error}). “Yeni sekmede aç” ile görüntüleyebilirsiniz.
        </p>
      )}
      {!state && (
        <p className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> PDF yükleniyor…
        </p>
      )}
      <div ref={box} className="mx-auto flex max-w-[900px] flex-col gap-3 rounded-md bg-slate-100 p-2 sm:p-3" />
    </div>
  );
}
