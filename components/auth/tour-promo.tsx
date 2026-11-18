import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import manifest from "@/lib/tanitim/manifest.json";
import { TOUR } from "@/lib/tanitim/config";

/*
 * Giriş sayfasındaki tanıtım şeridi: kayıt olmadan önce platformu gerçek ekranlarla tanıtır (/tanitim).
 * Bütün platformlarda birebir aynıdır; renk ve örnek ekranlar lib/tanitim/config.ts'ten gelir.
 */

interface TourModule { id: string; title: string; steps: { img: string; title: string }[] }
const MODULES = (manifest.modules as TourModule[]).filter((m) => m.steps.length > 0);
const TOTAL = MODULES.reduce((s, m) => s + m.steps.length, 0);

const PREVIEWS = TOUR.previews.flatMap((p) => {
  const m = MODULES.find((x) => x.id === p.id) ?? MODULES[0];
  if (!m) return [];
  const s = m.steps[Math.min(p.step, m.steps.length - 1)];
  return [{ ...p, id: m.id, img: s.img, title: s.title }];
});

const ACCENT_CSS = `.tour-promo{--ta:${TOUR.accent};--ta-soft:color-mix(in srgb,var(--ta) 12%,transparent)}.dark .tour-promo{--ta:${TOUR.accentDark}}`;

/** Form altındaki kısa bağlantı. */
export function TourLink() {
  return (
    <Link
      href="/tanitim"
      className="tour-promo group flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-[var(--ta)]"
    >
      <style>{ACCENT_CSS}</style>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ta-soft)] text-[var(--ta)]">
        <PlayCircle className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-foreground">Kayıt olmadan platformu tanıyın</span>
        <span className="block text-[11.5px] text-muted-foreground">
          {MODULES.length} bölüm, {TOTAL} gerçek ekran üzerinden adım adım tanıtım
        </span>
      </span>
      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ta)]" />
    </Link>
  );
}

/** Sayfa altındaki geniş tanıtım şeridi. */
export function TourPromo() {
  return (
    <section id="tanitim" className="tour-promo mx-auto max-w-[1400px] px-4 pb-10 sm:px-6 lg:px-10">
      <style>{ACCENT_CSS}</style>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,5fr)_7fr] lg:gap-10">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ta)]">Platform Tanıtımı</p>
            <h2 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-[26px]">
              Kayıt olmadan önce ekran ekran inceleyin
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{TOUR.promoText}</p>

            <ul className="mt-4 flex flex-wrap gap-1.5">
              {MODULES.map((m, i) => (
                <li key={m.id}>
                  <Link
                    href={`/tanitim#${m.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11.5px] text-foreground transition-colors hover:border-[var(--ta)] hover:text-[var(--ta)]"
                  >
                    <span className="font-semibold tabular-nums text-[var(--ta)]">{String(i + 1).padStart(2, "0")}</span>
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/tanitim"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--ta)] px-4 text-[13px] font-semibold text-white shadow-sm hover:opacity-90"
              >
                <PlayCircle className="h-4 w-4" /> Tanıtımı başlat
              </Link>
              <span className="text-[12px] text-muted-foreground">
                {MODULES.length} bölüm · {TOTAL} ekran · giriş gerekmez
              </span>
            </div>
          </div>

          {/* Gerçek ekranlardan örnekler */}
          <div className="grid min-w-0 grid-cols-2 items-start gap-3 self-center sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {PREVIEWS.map((p, i) => (
              <Link
                key={p.id + i}
                href={`/tanitim#${p.id}`}
                className={`group min-w-0 overflow-hidden rounded-xl border border-border bg-[#0b1220] ${i === 2 ? "hidden sm:block lg:hidden xl:block" : ""}`}
              >
                <span className="flex items-center gap-1 px-2.5 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                  <span className="ml-1.5 truncate font-mono text-[10px] text-white/60">{p.label}</span>
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element -- statik tanıtım görseli */}
                <img
                  src={p.img}
                  alt={p.title}
                  loading="lazy"
                  decoding="async"
                  className="keep-light block aspect-[1440/900] w-full bg-white object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
