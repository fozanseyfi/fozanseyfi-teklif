"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, MousePointer2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import manifest from "@/lib/tanitim/manifest.json";

/* Görüntüler scripts/tour/capture.mjs ile demo panelden çekilir; manifest aynı betikle üretilir. */

interface Rect { x: number; y: number; w: number; h: number }
interface Step { img: string; title: string; text: string; marks: Rect[]; cursor: { x: number; y: number } | null }
interface Module { id: string; group: string; title: string; intro: string; steps: Step[] }

const MODULES = (manifest.modules as Module[]).filter((m) => m.steps.length > 0);
const VIEW_W = manifest.viewport?.w ?? 1440;
const VIEW_H = manifest.viewport?.h ?? 900;
const TOTAL = MODULES.reduce((s, m) => s + m.steps.length, 0);

/**
 * Platform tanıtımı: her modül için solda numaralı adımlar, sağda o adımın ekran görüntüsü.
 * Sayfa kaydırıldıkça adımlar sırayla seçilir; oklar ve klavye ← → ile de gezilir.
 * `stickyTop`: üstte sabit bar varsa yüksekliği (px) — ekran çerçevesi onun altında durur.
 */
export function TourView({ stickyTop = 16 }: { stickyTop?: number }) {
  const [zoom, setZoom] = useState<{ m: number; s: number } | null>(null);

  return (
    <div className="mx-auto max-w-[1280px] text-[13px] leading-relaxed text-foreground">
      {/* Başlık */}
      <div className="border border-border bg-card">
        <div className="border-b border-border bg-secondary px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Platform Tanıtımı
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">SolarTeklif — ekran ekran kullanım kılavuzu</h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">
              Platformun bütün modülleri, gerçek ekranlar üzerinden adım adım anlatılmıştır. Sayfayı aşağı kaydırdıkça
              adımlar sırayla ilerler; ekranın altındaki oklar veya klavyedeki ← → tuşlarıyla da gezebilirsiniz.
              İşaretli alanlar o adımda tıklanacak ya da doldurulacak yeri gösterir.
            </p>
          </div>
          <table className="border-collapse text-[12px]">
            <tbody>
              <tr>
                <td className="border border-border bg-secondary px-3 py-1 text-muted-foreground">Bölüm</td>
                <td className="border border-border px-3 py-1 text-right font-semibold tabular-nums">{MODULES.length}</td>
              </tr>
              <tr>
                <td className="border border-border bg-secondary px-3 py-1 text-muted-foreground">Ekran</td>
                <td className="border border-border px-3 py-1 text-right font-semibold tabular-nums">{TOTAL}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* İçindekiler */}
      <TableOfContents />

      {MODULES.map((m, mi) => (
        <ModuleSection key={m.id} module={m} index={mi} stickyTop={stickyTop} onZoom={(s) => setZoom({ m: mi, s })} />
      ))}

      <p className="mt-8 border-t border-border pt-3 text-[11px] text-muted-foreground">
        Ekran görüntüleri örnek verilerle doldurulmuş bir demo panelden alınmıştır; kişi, firma ve tutarlar gerçek değildir.
      </p>

      {zoom && <Lightbox start={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function TableOfContents() {
  return (
    <div id="icindekiler" className="mt-4 scroll-mt-20 border border-border bg-card">
      <div className="border-b border-border bg-secondary px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        İçindekiler
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground">
            <th className="w-12 border-b border-border px-3 py-1.5 font-medium">No</th>
            <th className="border-b border-border px-3 py-1.5 font-medium">Bölüm</th>
            <th className="hidden border-b border-border px-3 py-1.5 font-medium md:table-cell">Grup</th>
            <th className="w-20 border-b border-border px-3 py-1.5 text-right font-medium">Ekran</th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m, i) => {
            const n = i + 1;
            return (
              <tr key={m.id} className="hover:bg-secondary/60">
                <td className="border-b border-border px-3 py-1.5 tabular-nums text-muted-foreground">{String(n).padStart(2, "0")}</td>
                <td className="border-b border-border px-3 py-1.5">
                  <a href={`#${m.id}`} className="font-medium text-primary hover:underline">
                    {m.title}
                  </a>
                </td>
                <td className="hidden border-b border-border px-3 py-1.5 text-muted-foreground md:table-cell">{m.group}</td>
                <td className="border-b border-border px-3 py-1.5 text-right tabular-nums">{m.steps.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModuleSection({
  module: m,
  index,
  stickyTop,
  onZoom,
}: {
  module: Module;
  index: number;
  stickyTop: number;
  onZoom: (step: number) => void;
}) {
  const [active, setActive] = useState(0);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  // Okla/klavyeyle seçim yapılınca kaydırma bitene kadar gözlemci seçimi ezmesin
  const lock = useRef(0);

  // Kaydırma ile adım seçimi: ekranın ~%45 yüksekliğindeki çizgiyi geçen satır aktif olur
  useEffect(() => {
    const els = rows.current.filter(Boolean) as HTMLLIElement[];
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lock.current) return;
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(m.steps.length - 1, i));
      setActive(next);
      lock.current = Date.now() + 900;
      const row = rows.current[next];
      // Yalnız geniş ekranda satırı ortala (dar ekranda çerçeve üstte, satırlar altta)
      if (row && window.matchMedia("(min-width: 1024px)").matches) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [m.steps.length],
  );

  // Klavye ← →: bölüm ekranın ortasındaysa çalışır
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (document.querySelector("[data-tour-lightbox]")) return;
      const r = sectionRef.current?.getBoundingClientRect();
      const mid = window.innerHeight / 2;
      if (!r || r.top > mid || r.bottom < mid) return;
      e.preventDefault();
      goTo(active + (e.key === "ArrowRight" ? 1 : -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  const step = m.steps[active];

  return (
    <section ref={sectionRef} id={m.id} className="mt-6 scroll-mt-20 border border-border bg-card">
      {/* Bölüm başlığı */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary px-4 py-2">
        <h2 className="text-[14px] font-semibold">
          <span className="mr-2 tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          {m.title}
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{m.group}</span>
          <a href="#icindekiler" className="hover:text-foreground hover:underline">
            İçindekiler ↑
          </a>
        </div>
      </div>
      <p className="border-b border-border px-4 py-3 text-muted-foreground">{m.intro}</p>

      <div className="grid lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        {/* Ekran (geniş ekranda sağda ve sabit; dar ekranda üstte) */}
        <div className="order-1 border-b border-border p-3 lg:order-2 lg:border-b-0 lg:border-l">
          <div className="lg:sticky" style={{ top: stickyTop }}>
            <Frame
              step={step}
              index={active}
              count={m.steps.length}
              onPrev={() => goTo(active - 1)}
              onNext={() => goTo(active + 1)}
              onZoom={() => onZoom(active)}
            />
          </div>
        </div>

        {/* Adımlar */}
        <ol className="order-2 lg:order-1">
          {m.steps.map((s, i) => (
            <li
              key={s.img}
              ref={(el) => {
                rows.current[i] = el;
              }}
              data-step={i}
              className="border-b border-border last:border-b-0 lg:flex lg:min-h-[44vh] lg:items-center lg:last:min-h-[60vh]"
            >
              <button
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  "flex w-full gap-3 border-l-[3px] px-3 py-3 text-left transition-colors",
                  i === active ? "border-l-primary bg-primary-soft/60" : "border-l-transparent hover:bg-secondary/60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center border text-[11px] font-semibold tabular-nums",
                    i === active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{s.title}</span>
                  <span className="mt-0.5 block text-muted-foreground">{s.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Frame({
  step,
  index,
  count,
  onPrev,
  onNext,
  onZoom,
}: {
  step: Step;
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onZoom: () => void;
}) {
  return (
    <figure className="border border-border">
      <figcaption className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-2 py-1.5 text-[12px]">
        <span className="min-w-0 truncate">
          <span className="font-semibold tabular-nums">
            Ekran {index + 1} / {count}
          </span>
          <span className="text-muted-foreground"> — {step.title}</span>
        </span>
        <button
          type="button"
          onClick={onZoom}
          className="inline-flex shrink-0 items-center gap-1 border border-border bg-card px-2 py-0.5 text-[11px] hover:bg-secondary"
          title="Tam ekran"
        >
          <Maximize2 className="size-3" /> Tam ekran
        </button>
      </figcaption>
      <Shot step={step} onClick={onZoom} />
      <div className="flex items-center justify-between gap-2 border-t border-border bg-secondary px-2 py-1.5">
        <NavButton dir="prev" disabled={index === 0} onClick={onPrev} />
        <div className="flex flex-wrap justify-center gap-1">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={cn("h-1.5 w-3", i === index ? "bg-primary" : "bg-border")} />
          ))}
        </div>
        <NavButton dir="next" disabled={index === count - 1} onClick={onNext} />
      </div>
    </figure>
  );
}

function NavButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 border border-border bg-card px-2.5 py-1 text-[12px] font-medium hover:bg-secondary disabled:cursor-default disabled:opacity-40"
    >
      {dir === "prev" ? (
        <>
          <ChevronLeft className="size-3.5" /> Önceki
        </>
      ) : (
        <>
          Sonraki <ChevronRight className="size-3.5" />
        </>
      )}
    </button>
  );
}

/** Ekran görüntüsü + işaret çerçeveleri + imleç. Görüntü oranı sabit (viewport oranı). */
function Shot({ step, onClick, eager = false }: { step: Step; onClick?: () => void; eager?: boolean }) {
  return (
    <div
      className="keep-light relative w-full cursor-zoom-in overflow-hidden bg-white"
      style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- statik ekran görüntüsü, oran sabit */}
      <img
        key={step.img}
        src={step.img}
        alt={step.title}
        loading={eager ? "eager" : "lazy"}
        className="absolute inset-0 size-full object-contain"
      />
      {step.marks.map((r, i) => (
        <span
          key={i}
          className="pointer-events-none absolute border-2 border-[#d92d20]"
          style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
        >
          {step.marks.length > 1 && (
            <span className="absolute -left-0.5 -top-5 bg-[#d92d20] px-1 text-[10px] font-bold leading-4 text-white">{i + 1}</span>
          )}
        </span>
      ))}
      {step.cursor && (
        <MousePointer2
          className="pointer-events-none absolute size-6 fill-black text-white drop-shadow"
          style={{ left: `${step.cursor.x}%`, top: `${step.cursor.y}%`, transform: "translate(-15%, -10%)" }}
          strokeWidth={1.5}
        />
      )}
    </div>
  );
}

/** Tam ekran görüntüleyici: modül içinde ← → ile gezinir, Esc kapatır. */
function Lightbox({ start, onClose }: { start: { m: number; s: number }; onClose: () => void }) {
  const [pos, setPos] = useState(start);
  const flat = useMemo(() => MODULES.flatMap((m, mi) => m.steps.map((_, si) => ({ m: mi, s: si }))), []);
  const idx = flat.findIndex((p) => p.m === pos.m && p.s === pos.s);
  const mod = MODULES[pos.m];
  const step = mod.steps[pos.s];

  const move = useCallback(
    (d: number) => {
      const n = flat[idx + d];
      if (n) setPos(n);
    },
    [flat, idx],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [move, onClose]);

  return (
    <div data-tour-lightbox className="fixed inset-0 z-[1000] flex flex-col bg-black/85" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111] px-4 py-2 text-[12px] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 truncate">
          <span className="text-white/60">{mod.title} · Ekran {pos.s + 1} / {mod.steps.length} — </span>
          <span className="font-semibold">{step.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden tabular-nums text-white/50 sm:inline">
            {idx + 1} / {flat.length}
          </span>
          <button type="button" onClick={() => move(-1)} disabled={idx === 0} className="border border-white/20 px-2 py-0.5 disabled:opacity-30" aria-label="Önceki">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => move(1)} disabled={idx === flat.length - 1} className="border border-white/20 px-2 py-0.5 disabled:opacity-30" aria-label="Sonraki">
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={onClose} className="border border-white/20 px-2 py-0.5" aria-label="Kapat">
            <X className="size-4" />
          </button>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
        <div
          className="w-full max-w-[1440px]"
          style={{ maxHeight: "100%", aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxWidth: `min(1440px, calc((100vh - 140px) * ${VIEW_W / VIEW_H}))` }}
          onClick={(e) => e.stopPropagation()}
        >
          <Shot step={step} eager />
        </div>
      </div>
      <p className="border-t border-white/10 bg-[#111] px-4 py-2 text-[12px] text-white/80" onClick={(e) => e.stopPropagation()}>
        {step.text}
      </p>
    </div>
  );
}
