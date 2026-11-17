"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Maximize2, MousePointer2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import manifest from "@/lib/tanitim/manifest.json";

/* Görüntüler scripts/tour/capture.mjs ile demo panelden çekilir; manifest aynı betikle üretilir. */

interface Rect { x: number; y: number; w: number; h: number }
interface Step { img: string; title: string; text: string; marks: Rect[]; cursor: { x: number; y: number } | null }
interface Module { id: string; group: string; title: string; intro: string; steps: Step[] }
interface Flat { m: number; s: number }

const MODULES = (manifest.modules as Module[]).filter((m) => m.steps.length > 0);
const VIEW_W = manifest.viewport?.w ?? 1440;
const VIEW_H = manifest.viewport?.h ?? 900;
const RATIO = VIEW_W / VIEW_H;
const FLAT: Flat[] = MODULES.flatMap((m, mi) => m.steps.map((_, si) => ({ m: mi, s: si })));
const START = MODULES.map((_, mi) => FLAT.findIndex((f) => f.m === mi));
const TOTAL = FLAT.length;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Platform tanıtımı — ekran akışı.
 * Sağda sahne: ortada aktif ekran, arkasında üstte bir önceki ve altta bir sonraki ekranın ucu görünür.
 * Ekranların üzerinde fare tekerleği / ok tuşları / dokunmatik kaydırma ile ilerlenir; bölüm bitince
 * akış bir sonraki bölüme geçer. Solda bölüm ve adım anlatımı.
 * `top`: sayfanın üstünde sabit bar varsa yüksekliği (px) — sahne ekran yüksekliğine göre boyutlanır.
 */
export function TourView({ top = 0 }: { top?: number }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const cur = FLAT[idx];
  const mod = MODULES[cur.m];

  const go = useCallback((i: number) => setIdx(Math.max(0, Math.min(TOTAL - 1, i))), []);
  const goModule = useCallback((mi: number) => go(START[Math.max(0, Math.min(MODULES.length - 1, mi))]), [go]);

  // Adres çubuğundaki #bolum ile aç; bölüm değişince adresi güncelle (paylaşılabilir link)
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    const mi = MODULES.findIndex((m) => m.id === id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ilk açılışta adresteki bölüme git (dış senkronizasyon)
    if (mi > 0) setIdx(START[mi]);
  }, []);
  useEffect(() => {
    const h = `#${mod.id}`;
    if (location.hash !== h) history.replaceState(null, "", h);
  }, [mod.id]);

  // Sonraki iki ekranı önceden yükle (geçiş anında bulanık görünmesin)
  useEffect(() => {
    for (const d of [1, 2, -1]) {
      const f = FLAT[idx + d];
      if (f) {
        const im = new Image();
        im.src = MODULES[f.m].steps[f.s].img;
      }
    }
  }, [idx]);

  return (
    <div className="mx-auto min-w-0 max-w-[1520px] text-[13px] text-foreground">
      <ModuleStrip active={cur.m} idx={idx} onPick={goModule} />

      <div
        className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[360px_minmax(0,1fr)]"
        style={{ "--tour-h": `calc(100vh - ${top + 108}px)` } as React.CSSProperties}
      >
        <StepPanel
          mod={mod}
          mi={cur.m}
          step={cur.s}
          onStep={(s) => go(START[cur.m] + s)}
          onPrevModule={() => goModule(cur.m - 1)}
          onNextModule={() => goModule(cur.m + 1)}
        />
        <Stage idx={idx} onGo={go} onZoom={() => setZoom(true)} />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Ekran görüntüleri örnek verilerle doldurulmuş bir demo panelden alınmıştır; kişi, firma ve tutarlar gerçek değildir.
      </p>

      {zoom && <Lightbox idx={idx} onGo={go} onClose={() => setZoom(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ üst bölüm şeridi */

function ModuleStrip({ active, idx, onPick }: { active: number; idx: number; onPick: (mi: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[data-mi="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <nav className="border border-border bg-card" aria-label="Tanıtım bölümleri">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Platform Tanıtımı</span>
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            Ekran <b className="text-foreground">{idx + 1}</b> / {TOTAL}
          </span>
          <span className="hidden h-1.5 w-40 bg-border sm:block">
            <span className="block h-full bg-primary transition-[width] duration-300" style={{ width: `${((idx + 1) / TOTAL) * 100}%` }} />
          </span>
        </span>
      </div>
      <div ref={ref} className="flex overflow-x-auto">
        {MODULES.map((m, mi) => {
          const on = mi === active;
          const done = idx >= START[mi] + m.steps.length;
          return (
            <button
              key={m.id}
              data-mi={mi}
              type="button"
              onClick={() => onPick(mi)}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 border-r border-border px-3 py-2 text-left transition-colors last:border-r-0",
                on ? "bg-primary-soft/70" : "hover:bg-secondary/70",
              )}
              title={m.title}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center text-[10px] font-bold tabular-nums",
                  on ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                )}
              >
                {done && !on ? <Check className="size-3" /> : pad(mi + 1)}
              </span>
              <span className={cn("whitespace-nowrap text-[12px]", on ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                {m.title}
              </span>
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ sol panel: bölüm + adımlar */

function StepPanel({
  mod,
  mi,
  step,
  onStep,
  onPrevModule,
  onNextModule,
}: {
  mod: Module;
  mi: number;
  step: number;
  onStep: (s: number) => void;
  onPrevModule: () => void;
  onNextModule: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-s="${step}"]`)?.scrollIntoView({ block: "nearest" });
  }, [step, mi]);
  const n = mod.steps.length;

  return (
    <aside className="order-2 flex min-h-0 min-w-0 flex-col border border-border bg-card lg:order-1 lg:h-[var(--tour-h)] lg:min-h-[560px]">
      {/* Bölüm başlığı */}
      <div className="border-b border-border px-4 pb-3 pt-3.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">
          Bölüm {pad(mi + 1)} · {mod.group}
        </p>
        <h2 className="mt-1 text-[19px] font-semibold leading-tight tracking-tight">{mod.title}</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{mod.intro}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="h-1 flex-1 bg-border">
            <span className="block h-full bg-primary transition-[width] duration-300" style={{ width: `${((step + 1) / n) * 100}%` }} />
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {step + 1} / {n}
          </span>
        </div>
      </div>

      {/* Adım zaman çizelgesi — aktif adım açık, anlatımı görünür */}
      <ol ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {mod.steps.map((s, i) => {
          const on = i === step;
          const done = i < step;
          return (
            <li key={s.img} data-s={i} className="relative">
              {i < n - 1 && <span className={cn("absolute left-[19px] top-7 bottom-0 w-px", done ? "bg-primary/40" : "bg-border")} />}
              <button
                type="button"
                onClick={() => onStep(i)}
                className={cn(
                  "relative flex w-full gap-3 px-2 py-2 text-left transition-colors",
                  on ? "bg-primary-soft/60" : "hover:bg-secondary/60",
                )}
              >
                <span
                  className={cn(
                    "relative z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center border text-[11px] font-bold tabular-nums",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-primary/40 bg-card text-primary"
                        : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block leading-snug", on ? "text-[14px] font-semibold" : "text-[13px] text-muted-foreground")}>{s.title}</span>
                  {on && <span className="mt-1 block text-[13px] leading-relaxed text-foreground/85">{s.text}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Bölüm gezinme */}
      <div className="flex items-center justify-between gap-2 border-t border-border bg-secondary/60 px-3 py-2">
        <button
          type="button"
          onClick={onPrevModule}
          disabled={mi === 0}
          className="inline-flex items-center gap-1 border border-border bg-card px-2.5 py-1 text-[12px] hover:bg-secondary disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" /> Önceki bölüm
        </button>
        <button
          type="button"
          onClick={onNextModule}
          disabled={mi === MODULES.length - 1}
          className="inline-flex items-center gap-1 border border-primary bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          Sonraki bölüm <ChevronRight className="size-3.5" />
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ sahne: üst üste ekranlar */

// Ekranın akıştaki konumuna göre görünüm: 0 = önde, ±1 = arkada ucu görünür, ±2 = gizli (geçiş için)
function slot(off: number) {
  const a = Math.abs(off);
  if (a === 0) return { y: 0, s: 1, o: 1, z: 30, blur: 0 };
  if (a === 1) return { y: Math.sign(off) * 13, s: 0.9, o: 0.6, z: 20, blur: 0.5 };
  return { y: Math.sign(off) * 22, s: 0.8, o: 0, z: 10, blur: 1 };
}

function Stage({ idx, onGo, onZoom }: { idx: number; onGo: (i: number) => void; onZoom: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const idxRef = useRef(idx);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  // Fare tekerleği: sahnenin üzerindeyken sayfa yerine ekranlar kayar. Eşik + kısa kilit = bir hareket bir ekran.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0;
    let lockUntil = 0;
    let reset: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      const i = idxRef.current;
      const dir = Math.sign(e.deltaY);
      // Akışın başında yukarı / sonunda aşağı kaydırma sayfaya bırakılır
      if ((dir < 0 && i === 0) || (dir > 0 && i === TOTAL - 1)) return;
      e.preventDefault();
      if (Date.now() < lockUntil) return;
      acc += e.deltaY;
      clearTimeout(reset);
      reset = setTimeout(() => (acc = 0), 180);
      if (Math.abs(acc) >= 40) {
        onGo(i + (acc > 0 ? 1 : -1));
        acc = 0;
        lockUntil = Date.now() + 520;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onGo]);

  // Dokunmatik: dikey kaydırma (geniş ekran) / yatay kaydırma (dar ekran)
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Klavye: ↑ ↓ ← → ve PageUp/PageDown (yazı alanındayken değil)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (document.querySelector("[data-tour-lightbox]")) return;
      const next = ["ArrowDown", "ArrowRight", "PageDown"].includes(e.key);
      const prev = ["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key);
      if (!next && !prev) return;
      e.preventDefault();
      onGo(idxRef.current + (next ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onGo]);

  const visible = [-2, -1, 0, 1, 2].map((d) => idx + d).filter((i) => i >= 0 && i < TOTAL);
  const f = FLAT[idx];
  const m = MODULES[f.m];

  return (
    <section
      className="order-1 flex min-h-0 min-w-0 flex-col border border-border bg-card lg:order-2 lg:h-[var(--tour-h)] lg:min-h-[560px]"
      aria-label="Ekran akışı"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-1.5 text-[12px]">
        <span className="min-w-0 truncate">
          <span className="font-semibold">{m.title}</span>
          <span className="text-muted-foreground"> · Ekran {f.s + 1} / {m.steps.length} — {m.steps[f.s].title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="mr-2 hidden text-[11px] text-muted-foreground xl:inline">Fare tekerleği / ↑ ↓ ile ilerleyin</span>
          <IconBtn label="Önceki ekran" onClick={() => onGo(idx - 1)} disabled={idx === 0}>
            <ChevronUp className="size-4" />
          </IconBtn>
          <IconBtn label="Sonraki ekran" onClick={() => onGo(idx + 1)} disabled={idx === TOTAL - 1}>
            <ChevronDown className="size-4" />
          </IconBtn>
          <button
            type="button"
            onClick={onZoom}
            className="ml-1 inline-flex items-center gap-1 border border-border bg-card px-2 py-0.5 text-[11px] hover:bg-secondary"
          >
            <Maximize2 className="size-3" /> Tam ekran
          </button>
        </span>
      </div>

      <div
        ref={ref}
        data-tour-stage
        className="relative min-h-[320px] flex-1 overflow-hidden bg-[linear-gradient(180deg,var(--color-secondary),var(--color-background))] select-none"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          const d = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
          if (Math.abs(d) > 40) onGo(idx + (d > 0 ? 1 : -1));
        }}
      >
        {visible.map((i) => {
          const off = i - idx;
          const p = slot(off);
          const fl = FLAT[i];
          const st = MODULES[fl.m].steps[fl.s];
          return (
            <div
              key={st.img}
              className="absolute left-1/2 top-1/2 w-[min(92%,calc((100%-56px)*var(--r)))] transition-[transform,opacity,filter] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
              style={
                {
                  "--r": RATIO,
                  aspectRatio: `${VIEW_W} / ${VIEW_H}`,
                  maxHeight: "calc(100% - 56px)",
                  transform: `translate(-50%, calc(-50% + ${p.y}%)) scale(${p.s})`,
                  opacity: p.o,
                  zIndex: p.z,
                  filter: p.blur ? `blur(${p.blur}px)` : undefined,
                  pointerEvents: Math.abs(off) <= 1 ? "auto" : "none",
                } as React.CSSProperties
              }
              onClick={() => (off === 0 ? onZoom() : onGo(i))}
              aria-hidden={off !== 0}
            >
              <div className={cn("h-full w-full border bg-card shadow-[0_18px_50px_-20px_rgba(15,23,42,.45)]", off === 0 ? "border-border" : "border-border/70")}>
                <Shot step={st} showMarks={off === 0} eager={Math.abs(off) <= 1} />
              </div>
            </div>
          );
        })}

      </div>
    </section>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-6 items-center justify-center border border-border bg-card hover:bg-secondary disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Ekran görüntüsü + işaret çerçeveleri + imleç. */
function Shot({ step, showMarks = true, eager = false }: { step: Step; showMarks?: boolean; eager?: boolean }) {
  return (
    <div className="keep-light relative h-full w-full cursor-zoom-in overflow-hidden bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- statik ekran görüntüsü (2x), oran sabit */}
      <img
        src={step.img}
        alt={step.title}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full object-contain"
      />
      {showMarks &&
        step.marks.map((r, i) => (
          <span
            key={i}
            className="pointer-events-none absolute border-2 border-[#d92d20] shadow-[0_0_0_3px_rgba(217,45,32,.15)]"
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
          >
            {step.marks.length > 1 && (
              <span className="absolute -left-0.5 -top-5 bg-[#d92d20] px-1 text-[10px] font-bold leading-4 text-white">{i + 1}</span>
            )}
          </span>
        ))}
      {showMarks && step.cursor && (
        <MousePointer2
          className="pointer-events-none absolute size-6 fill-black text-white drop-shadow"
          style={{ left: `${step.cursor.x}%`, top: `${step.cursor.y}%`, transform: "translate(-15%, -10%)" }}
          strokeWidth={1.5}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ tam ekran */

function Lightbox({ idx, onGo, onClose }: { idx: number; onGo: (i: number) => void; onClose: () => void }) {
  const f = FLAT[idx];
  const mod = MODULES[f.m];
  const step = mod.steps[f.s];
  const box = useMemo(() => ({ maxWidth: `min(1600px, calc((100vh - 130px) * ${RATIO}))` }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") onGo(idx + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") onGo(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [idx, onGo, onClose]);

  return (
    <div data-tour-lightbox className="fixed inset-0 z-[1000] flex flex-col bg-black/90" onClick={onClose} role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111] px-4 py-2 text-[12px] text-white" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 truncate">
          <span className="text-white/60">
            {mod.title} · Ekran {f.s + 1} / {mod.steps.length} —{" "}
          </span>
          <span className="font-semibold">{step.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden tabular-nums text-white/50 sm:inline">
            {idx + 1} / {TOTAL}
          </span>
          <button type="button" onClick={() => onGo(idx - 1)} disabled={idx === 0} className="border border-white/20 px-2 py-0.5 disabled:opacity-30" aria-label="Önceki">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => onGo(idx + 1)} disabled={idx === TOTAL - 1} className="border border-white/20 px-2 py-0.5 disabled:opacity-30" aria-label="Sonraki">
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={onClose} className="border border-white/20 px-2 py-0.5" aria-label="Kapat">
            <X className="size-4" />
          </button>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
        <div className="w-full" style={{ ...box, aspectRatio: `${VIEW_W} / ${VIEW_H}` }} onClick={(e) => e.stopPropagation()}>
          <Shot step={step} eager />
        </div>
      </div>
      <p className="border-t border-white/10 bg-[#111] px-4 py-2 text-[12.5px] text-white/85" onClick={(e) => e.stopPropagation()}>
        {step.text}
      </p>
    </div>
  );
}
