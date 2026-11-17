import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import manifest from "@/lib/tanitim/manifest.json";

/* Giriş sayfasındaki tanıtım şeridi: kayıt olmadan önce platformu gerçek ekranlarla tanıtır (/tanitim). */

const MODULES = manifest.modules.filter((m) => m.steps.length > 0);
const TOTAL = MODULES.reduce((s, m) => s + m.steps.length, 0);

const PREVIEWS = [
  { id: "giris", step: 1, label: "Dashboard" },
  { id: "proje-detay", step: 2, label: "Teklif analizi" },
  { id: "paylasim", step: 6, label: "Müşteri ekranı" },
].map((p) => {
  const m = MODULES.find((x) => x.id === p.id)!;
  const s = m.steps[Math.min(p.step, m.steps.length - 1)];
  return { ...p, img: s.img, title: s.title };
});

/** Form altındaki kısa bağlantı. */
export function TourLink() {
  return (
    <Link
      href="/tanitim"
      className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <PlayCircle className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-foreground">Kayıt olmadan platformu tanıyın</span>
        <span className="block text-[11.5px] text-muted-foreground">
          {MODULES.length} bölüm, {TOTAL} gerçek ekran üzerinden adım adım tanıtım
        </span>
      </span>
      <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

/** Sayfa altındaki geniş tanıtım şeridi. */
export function TourPromo() {
  return (
    <section id="tanitim" className="mx-auto max-w-[1400px] px-4 pb-10 sm:px-6 lg:px-10">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,5fr)_7fr] lg:gap-10">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Platform Tanıtımı</p>
            <h2 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-[26px]">
              Kayıt olmadan önce ekran ekran inceleyin
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              Teklif hazırlamadan müşteriyle paylaşıma, sözleşmeden maliyet kontrolüne kadar bütün modüller gerçek
              ekranlar üzerinden anlatılıyor: hangi butona basılır, form nasıl doldurulur, sonuç nerede görünür.
            </p>

            <ul className="mt-4 flex flex-wrap gap-1.5">
              {MODULES.map((m, i) => (
                <li key={m.id}>
                  <Link
                    href={`/tanitim#${m.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-[11.5px] text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <span className="font-semibold tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/tanitim"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <PlayCircle className="size-4" /> Tanıtımı başlat
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
                key={p.id}
                href={`/tanitim#${p.id}`}
                className={`group min-w-0 overflow-hidden rounded-xl border border-border/70 bg-[#0b1220] ${i === 2 ? "hidden sm:block lg:hidden xl:block" : ""}`}
              >
                <span className="flex items-center gap-1 px-2.5 py-1.5">
                  <span className="size-1.5 rounded-full bg-[#ef4444]" />
                  <span className="size-1.5 rounded-full bg-[#f59e0b]" />
                  <span className="size-1.5 rounded-full bg-[#22c55e]" />
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
