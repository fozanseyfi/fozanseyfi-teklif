"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Lock, Maximize2, Minimize2, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import manifest from "@/lib/tanitim/manifest.json";
import { TOUR } from "@/lib/tanitim/config";

/* Görüntüler scripts/tour/capture.mjs ile demo panelden çekilir (2x); manifest aynı betikle üretilir. */

interface Rect { x: number; y: number; w: number; h: number }
interface Step { img: string; title: string; text: string; marks: Rect[]; cursor: { x: number; y: number } | null }
interface Module { id: string; group: string; title: string; intro: string; steps: Step[] }

const MODULES = (manifest.modules as Module[]).filter((m) => m.steps.length > 0);
const VIEW_W = manifest.viewport?.w ?? 1440;
const VIEW_H = manifest.viewport?.h ?? 900;
const RATIO = VIEW_W / VIEW_H;
const TOTAL = MODULES.reduce((s, m) => s + m.steps.length, 0);
/** Vurgu rengi (açık/koyu tema) — renk değişkenleri; Tailwind 3 ve 4'te aynı çalışır. */
const ACCENT_CSS = `.tour-root{--ta:${TOUR.accent};--ta-soft:color-mix(in srgb,var(--ta) 12%,transparent);--ta-mid:color-mix(in srgb,var(--ta) 35%,transparent)}.dark .tour-root{--ta:${TOUR.accentDark}}`;
const pad = (n: number) => String(n).padStart(2, "0");
/** Ekran numarası: bölüm.adım — 01.01, 08.05 */
const num = (m: number, s: number) => `${pad(m + 1)}.${pad(s + 1)}`;

/** Galerideki kartlar: her bölüm bir giriş kartı + adım kartları. `g` = genel ekran sırası (1…TOTAL). */
type IntroC = { kind: "intro"; m: number; k: number };
type StepC = { kind: "step"; m: number; s: number; g: number; k: number };
type Card = IntroC | StepC;
const CARDS: Card[] = (() => {
  const out: Card[] = [];
  let g = 0;
  MODULES.forEach((mod, m) => {
    out.push({ kind: "intro", m, k: 0 });
    mod.steps.forEach((_, s) => out.push({ kind: "step", m, s, g: ++g, k: Math.min(s + 1, 5) }));
  });
  return out;
})();
const firstCardOf = (m: number) => CARDS.findIndex((c) => c.m === m);
const cardOfStep = (m: number, s: number) => CARDS.findIndex((c) => c.kind === "step" && c.m === m && c.s === s);

/**
 * Platform tanıtımı — üst üste binen kart akışı.
 * Galeri kendi kaydırma kutusudur: fare ekranların üzerindeyken tekerlek kartları akıtır (yeni kart
 * öncekinin üstüne oturur, arkadakilerin kenarı görünür); yandaki boşlukta tekerlek sayfayı kaydırır.
 * Sağdaki kaydırma çubuğu sürüklenebilir; üzerinde bölüm çizgileri ve o anki ekran numarası görünür.
 * “Tam ekran” aynı görünümü (İçindekiler + kartlar) bütün ekrana büyütür.
 * `top`: sayfanın üstünde sabit bar varsa yüksekliği (px).
 */
export function TourView({ top = 0 }: { top?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const markers = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [full, setFull] = useState(false);
  const activeRef = useRef(0);

  // Etkin kart: kaydırma konumunu geçen son işaretçi (kartlar yapışkan olduğu için işaretçilerle ölçülür)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = el.scrollTop + 40;
      let i = 0;
      for (let k = 0; k < markers.current.length; k++) {
        const mk = markers.current[k];
        if (mk && mk.offsetTop <= y) i = k;
        else break;
      }
      activeRef.current = i;
      setActive(i);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const goCard = useCallback((i: number, smooth = true) => {
    const el = scroller.current;
    const mk = markers.current[Math.max(0, Math.min(CARDS.length - 1, i))];
    if (!el || !mk) return;
    // Dar ekranda galeri sayfanın parçasıdır (yapışkan değil): sayfayı kaydır
    if (el.scrollHeight <= el.clientHeight + 1) {
      mk.nextElementSibling?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      return;
    }
    el.scrollTo({ top: mk.offsetTop, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Tam ekran: aynı görünüm bütün ekranı kaplar (tarayıcı tam ekranı da denenir). Kart yükseklikleri
  // değiştiği için geçişten sonra aynı karta geri konumlanılır.
  const toggleFull = useCallback(
    (on: boolean, card = activeRef.current) => {
      setFull(on);
      try {
        if (on && !document.fullscreenElement) void root.current?.requestFullscreen?.().catch(() => {});
        if (!on && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      } catch {}
      requestAnimationFrame(() => requestAnimationFrame(() => goCard(card, false)));
    },
    [goCard],
  );
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && full) toggleFull(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [full, toggleFull]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggleFull(false);
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goCard(activeRef.current + 1);
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goCard(activeRef.current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [full, toggleFull, goCard]);

  // Adresteki #bolum ile aç; bölüm değişince adresi güncelle (paylaşılabilir link)
  useEffect(() => {
    const mi = MODULES.findIndex((m) => m.id === decodeURIComponent(location.hash.slice(1)));
    if (mi > 0) requestAnimationFrame(() => goCard(firstCardOf(mi), false));
  }, [goCard]);
  const card = CARDS[active];
  useEffect(() => {
    const h = `#${MODULES[card.m].id}`;
    if (location.hash !== h) history.replaceState(null, "", h);
  }, [card.m]);

  const next = CARDS[active + 1];
  const shown = card.kind === "step" ? card.g : next?.kind === "step" ? next.g : 1;

  return (
    <div
      ref={root}
      className={cn(
        "tour-root min-w-0 text-foreground",
        full ? "fixed inset-0 z-[1000] overflow-hidden bg-background p-3" : "mx-auto max-w-[1560px]",
      )}
      style={
        {
          "--gallery-h": full ? "calc(100vh - 24px)" : `calc(100vh - ${top + 24}px)`,
        } as React.CSSProperties
      }
    >
      <style>{ACCENT_CSS}</style>
      <div className={cn("grid grid-cols-1 gap-4", full ? "lg:grid-cols-[340px_minmax(0,1fr)]" : "lg:grid-cols-[300px_minmax(0,1fr)]")}>
        <Navigator
          activeModule={card.m}
          activeStep={card.kind === "step" ? card.s : -1}
          shown={shown}
          full={full}
          onModule={(m) => goCard(firstCardOf(m))}
          onStep={(m, s) => goCard(cardOfStep(m, s))}
        />

        {/* Galeri: kendi kaydırma kutusu + sağda sürüklenebilir kaydırma çubuğu */}
        <div className="relative min-w-0">
          <div
            ref={scroller}
            className={cn(
              "relative min-w-0 rounded-2xl border border-border bg-secondary px-3 pb-3",
              "lg:h-[var(--gallery-h)] lg:min-h-[620px] lg:overflow-y-auto lg:pl-5 lg:pr-12 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden",
              full && "h-[var(--gallery-h)] overflow-y-auto",
            )}
            id="tour-gallery"
            aria-label="Ekran galerisi"
          >
            {/* Her bölüm ayrı bir kap: yapışkan kartlar yalnız kendi bölümü boyunca üst üste biner,
                bölüm bitince yığın birlikte yukarı çıkar. (Tek kapta 120+ yapışkan kart birikince
                tarayıcı katmanları bozuluyordu.) */}
            {MODULES.map((_, mi) => (
              <section key={mi} className="pb-6">
                {CARDS.map((c, i) =>
                  c.m !== mi ? null : (
                    <div key={i} className="contents">
                      <div
                        ref={(el) => {
                          markers.current[i] = el;
                        }}
                        className="h-0"
                        aria-hidden
                      />
                      {c.kind === "intro" ? (
                        <IntroCard c={c} onStep={(s) => goCard(cardOfStep(c.m, s))} />
                      ) : (
                        <StepCard c={c} full={full} onFull={() => toggleFull(!full, i)} />
                      )}
                    </div>
                  ),
                )}
              </section>
            ))}
            <div className="py-10 text-center text-[13px] text-muted-foreground">
              Tanıtımın sonu — {MODULES.length} bölüm, {TOTAL} ekran.{" "}
              <button type="button" onClick={() => goCard(0)} className="font-medium text-[var(--ta)] hover:underline">
                Başa dön ↑
              </button>
            </div>
          </div>
          <ScrollRail scroller={scroller} markers={markers} active={active} />
        </div>
      </div>

      {!full && (
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Ekran görüntüleri örnek verilerle doldurulmuş bir demo panelden alınmıştır; kişi, firma ve tutarlar gerçek değildir.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ kaydırma çubuğu */

/**
 * Galerinin sağındaki kaydırma çubuğu: tutup sürüklenir, raya tıklanınca oraya atlar, üzerinde
 * tekerlek galeriyi kaydırır. Rayda her bölümün başı çizgiyle işaretli; tutamağın yanında o anki
 * ekran numarası görünür.
 */
function ScrollRail({
  scroller,
  markers,
  active,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  markers: React.RefObject<(HTMLDivElement | null)[]>;
  active: number;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ top: 0, h: 1, view: 1 });
  const [ticks, setTicks] = useState<{ y: number; m: number }[]>([]);
  const [drag, setDrag] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      setM({ top: el.scrollTop, h: el.scrollHeight, view: el.clientHeight });
    };
    const measure = () => {
      read();
      const h = el.scrollHeight || 1;
      setTicks(
        MODULES.map((_, mi) => {
          const mk = markers.current?.[firstCardOf(mi)];
          return { y: mk ? mk.offsetTop / h : 0, m: mi };
        }),
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [scroller, markers]);

  const canScroll = m.h > m.view + 1;
  // Ray üzerinde tekerlek → galeri (sayfa değil)
  useEffect(() => {
    const r = rail.current;
    const el = scroller.current;
    if (!r || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollBy({ top: e.deltaY });
    };
    r.addEventListener("wheel", onWheel, { passive: false });
    return () => r.removeEventListener("wheel", onWheel);
    // ray yalnız kaydırılabilir olunca DOM'a girer → o an yeniden bağlan
  }, [scroller, canScroll]);

  const scrollable = canScroll;
  const thumbFrac = Math.min(1, Math.max(0.06, m.view / m.h));
  const posFrac = scrollable ? m.top / (m.h - m.view) : 0;

  // Rayın piksel ölçüsü üzerinden fare konumu → kaydırma konumu
  const scrollToClientY = (clientY: number, grab: number) => {
    const r = rail.current?.getBoundingClientRect();
    const el = scroller.current;
    if (!r || !el) return;
    const thumbPx = r.height * thumbFrac;
    const f = Math.min(1, Math.max(0, (clientY - r.top - grab) / (r.height - thumbPx)));
    el.scrollTo({ top: f * (el.scrollHeight - el.clientHeight) });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const r = rail.current?.getBoundingClientRect();
    if (!r) return;
    e.preventDefault();
    const thumbPx = r.height * thumbFrac;
    const thumbTop = r.top + posFrac * (r.height - thumbPx);
    // Tutamağın üstünde basıldıysa tuttuğu yerden sürüklenir; rayda basıldıysa tutamak oraya ortalanır
    const onThumb = e.clientY >= thumbTop && e.clientY <= thumbTop + thumbPx;
    const grab = onThumb ? e.clientY - thumbTop : thumbPx / 2;
    if (!onThumb) scrollToClientY(e.clientY, grab);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(true);
    const move = (ev: PointerEvent) => scrollToClientY(ev.clientY, grab);
    const up = () => {
      setDrag(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!scrollable) return null;
  const c = CARDS[active];
  const label = c.kind === "step" ? num(c.m, c.s) : `${pad(c.m + 1)} · ${MODULES[c.m].title}`;

  return (
    <div
      ref={rail}
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="absolute bottom-4 right-2.5 top-4 z-20 hidden w-5 cursor-pointer touch-none select-none lg:block"
      role="scrollbar"
      aria-controls="tour-gallery"
      aria-orientation="vertical"
      aria-valuenow={Math.round(posFrac * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Tanıtımı kaydır"
    >
      {/* Ray */}
      <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-border" />
      {/* Bölüm çizgileri */}
      {ticks.map((t) => (
        <span
          key={t.m}
          className={cn(
            "absolute left-1/2 h-[2px] -translate-x-1/2 rounded-full transition-colors",
            t.m === c.m ? "w-4 bg-[var(--ta)]" : "w-2.5 bg-muted-foreground opacity-40",
          )}
          style={{ top: `${t.y * 100}%` }}
          title={`${pad(t.m + 1)} · ${MODULES[t.m].title}`}
        />
      ))}
      {/* Tutamak */}
      <div
        className={cn(
          "absolute left-1/2 flex w-3.5 -translate-x-1/2 flex-col items-center justify-center gap-[3px] rounded-full bg-[var(--ta)] shadow-[0_4px_14px_-4px_var(--ta)] ring-2 ring-card transition-[width] duration-150",
          (drag || hover) && "w-[18px]",
          drag ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ top: `calc(${posFrac} * (100% - ${thumbFrac * 100}%))`, height: `${thumbFrac * 100}%`, minHeight: 44 }}
      >
        <span className="h-[2px] w-1.5 rounded-full bg-white/80" />
        <span className="h-[2px] w-1.5 rounded-full bg-white/80" />
        <span className="h-[2px] w-1.5 rounded-full bg-white/80" />
        {/* Konum etiketi */}
        <span
          className={cn(
            "pointer-events-none absolute right-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-[11px] font-semibold text-background shadow-lg transition-opacity",
            drag || hover ? "opacity-100" : "opacity-0",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ sol gezinti */

function Navigator({
  activeModule,
  activeStep,
  shown,
  full,
  onModule,
  onStep,
}: {
  activeModule: number;
  activeStep: number;
  shown: number;
  full: boolean;
  onModule: (m: number) => void;
  onStep: (m: number, s: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[data-m="${activeModule}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeModule]);

  return (
    <aside className={cn("hidden min-h-0 flex-col rounded-2xl border border-border bg-card lg:flex lg:h-[var(--gallery-h)]", !full && "lg:min-h-[620px]")}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">İçindekiler</span>
          <span className="text-[12px] tabular-nums text-muted-foreground">
            <b className="text-foreground">{shown}</b> / {TOTAL}
          </span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-border">
          <div className="h-full rounded-full bg-[var(--ta)] transition-[width] duration-300" style={{ width: `${(shown / TOTAL) * 100}%` }} />
        </div>
      </div>

      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [scrollbar-width:thin]">
        {MODULES.map((m, mi) => {
          const on = mi === activeModule;
          const done = mi < activeModule;
          return (
            <div key={m.id} data-m={mi} className="mb-0.5">
              <button
                type="button"
                onClick={() => onModule(mi)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                  on ? "bg-[var(--ta-soft)]" : "hover:bg-secondary",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
                    on ? "bg-[var(--ta)] text-white" : done ? "bg-[var(--ta-soft)] text-[var(--ta)]" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {pad(mi + 1)}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-[13px] leading-tight", on ? "font-semibold" : "text-foreground opacity-80")}>{m.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {m.group} · {m.steps.length} ekran
                  </span>
                </span>
              </button>
              {on && (
                <ol className="mb-1 ml-[22px] mt-1 border-l border-border pl-3">
                  {m.steps.map((s, si) => (
                    <li key={s.img}>
                      <button
                        type="button"
                        onClick={() => onStep(mi, si)}
                        className={cn(
                          "relative flex w-full gap-2 py-1 text-left text-[12.5px] leading-snug transition-colors",
                          si === activeStep
                            ? "font-semibold text-[var(--ta)]"
                            : si < activeStep
                              ? "text-foreground opacity-70"
                              : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute -left-[17px] top-[9px] size-[7px] rounded-full border",
                            si === activeStep ? "border-[var(--ta)] bg-[var(--ta)]" : si < activeStep ? "border-[var(--ta-mid)] bg-[var(--ta-mid)]" : "border-border bg-card",
                          )}
                        />
                        <span className="w-9 shrink-0 tabular-nums opacity-70">{num(mi, si)}</span>
                        <span>{s.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ kartlar */

// Yapışkan kart: üstte (bölüm içi sırasına göre) birkaç piksel aşağıda durur; arkadakilerin kenarı görünür
const stickyStyle = (k: number) => ({ "--k": k }) as React.CSSProperties;
const cardBase =
  "relative mt-4 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-28px_rgba(15,23,42,.45)] lg:sticky lg:top-[calc(12px+var(--k)*10px)] lg:h-[calc(var(--gallery-h)-78px)] lg:min-h-[540px]";

function OutlineNum({ n, className }: { n: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("select-none font-semibold leading-none tracking-tight text-transparent tabular-nums", className)}
      style={{ WebkitTextStroke: "1.6px var(--ta)" }}
    >
      {n}
    </span>
  );
}

function IntroCard({ c, onStep }: { c: IntroC; onStep: (s: number) => void }) {
  const m = MODULES[c.m];
  return (
    <article className={cardBase} style={stickyStyle(c.k)}>
      <div className="flex h-full flex-col justify-center gap-6 bg-[radial-gradient(120%_80%_at_0%_0%,var(--ta-soft),transparent_60%)] px-6 py-8 sm:px-10">
        <div className="flex items-start gap-5">
          <OutlineNum n={pad(c.m + 1)} className="text-[72px] sm:text-[96px]" />
          <div className="min-w-0 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ta)]">
              Bölüm {pad(c.m + 1)} / {pad(MODULES.length)} · {m.group}
            </p>
            <h2 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]">{m.title}</h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-muted-foreground">{m.intro}</p>
          </div>
        </div>
        <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {m.steps.map((s, i) => (
            <li key={s.img}>
              <button
                type="button"
                onClick={() => onStep(i)}
                className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-[var(--ta)]"
              >
                <span className="text-[12px] font-semibold tabular-nums text-[var(--ta)]">{num(c.m, i)}</span>
                <span className="min-w-0 truncate text-[13px]">{s.title}</span>
                <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ol>
        <p className="text-[12px] text-muted-foreground">↓ Ekranların üzerinde kaydırarak bölümü adım adım izleyin</p>
      </div>
    </article>
  );
}

function StepCard({ c, full, onFull }: { c: StepC; full: boolean; onFull: () => void }) {
  const m = MODULES[c.m];
  const st = m.steps[c.s];
  return (
    <article className={cardBase} style={stickyStyle(c.k)}>
      {/* Başlık */}
      <header className="flex flex-wrap items-start gap-x-5 gap-y-3 px-5 pb-3 pt-4 sm:px-7">
        <OutlineNum n={num(c.m, c.s)} className="text-[44px] sm:text-[52px]" />
        <div className="min-w-0 flex-1 basis-[320px] pt-0.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ta)]">
            {pad(c.m + 1)} · {m.title}
          </p>
          <h3 className="mt-0.5 text-[19px] font-semibold leading-snug tracking-tight sm:text-[21px]">{st.title}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{st.text}</p>
        </div>
      </header>

      {/* Tarayıcı çerçevesi */}
      <div className="mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-[#0b1220] sm:mx-5 sm:mb-5">
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ef4444]" />
            <span className="size-2.5 rounded-full bg-[#f59e0b]" />
            <span className="size-2.5 rounded-full bg-[#22c55e]" />
          </span>
          <span className="mx-auto hidden min-w-0 items-center gap-1.5 truncate rounded-md bg-white/5 px-3 py-1 font-mono text-[11.5px] text-white/70 sm:inline-flex">
            <Lock className="size-3 shrink-0" /> {TOUR.domain}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden font-mono text-[10.5px] tracking-wide text-white/55 md:inline">
              EKRAN {num(c.m, c.s)} · {pad(c.g)}/{TOTAL}
            </span>
            <button
              type="button"
              onClick={onFull}
              className="inline-flex items-center gap-1 rounded-full border border-[#34d399]/40 bg-[#34d399]/10 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide hover:bg-[#34d399]/20"
              // Renk satır içi: bazı platformlarda katmansız genel `button` stili Tailwind sınıfını eziyor
              style={{ color: "#6ee7b7" }}
            >
              {full ? (
                <>
                  KÜÇÜLT <Minimize2 className="size-3" />
                </>
              ) : (
                <>
                  TAM EKRAN <Maximize2 className="size-3" />
                </>
              )}
            </button>
          </span>
        </div>
        <div className="flex aspect-[1440/900] min-h-0 items-center justify-center bg-[#0b1220] [container-type:size] lg:aspect-auto lg:flex-1">
          <button
            type="button"
            onClick={full ? undefined : onFull}
            className={cn("relative block", full && "cursor-default")}
            style={{ width: `min(100cqw, calc(100cqh * ${RATIO}))`, aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
            aria-label={full ? st.title : `${st.title} — tam ekran`}
          >
            <Shot step={st} zoomable={!full} />
          </button>
        </div>
      </div>
    </article>
  );
}

/** Ekran görüntüsü + işaret çerçeveleri + imleç (koordinatlar görüntüye göre %). */
function Shot({ step, zoomable = true }: { step: Step; zoomable?: boolean }) {
  return (
    <span className={cn("keep-light absolute inset-0 block overflow-hidden bg-white", zoomable && "cursor-zoom-in")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- statik 2x ekran görüntüsü, oran sabit */}
      <img
        src={step.img}
        alt={step.title}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full object-contain"
      />
      {step.marks.map((r, i) => (
        <span
          key={i}
          className="pointer-events-none absolute rounded-[3px] border-2 border-[#d92d20] shadow-[0_0_0_4px_rgba(217,45,32,.14)]"
          style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
        >
          {step.marks.length > 1 && (
            <span className="absolute -left-0.5 -top-5 rounded-sm bg-[#d92d20] px-1 text-[10px] font-bold leading-4 text-white">{i + 1}</span>
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
    </span>
  );
}
