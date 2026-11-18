"use client";

import { ArrowRight, Boxes, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "./tokens";
import { PLATFORMS, type PlatformInfo } from "./platforms-data";
import { PlatformLogo, type PlatformId } from "./platform-logos";

/** Ortak "Diğer Platformlar" sayfası — tüm platformlarda birebir aynı şablon (components/common/). */
export function PlatformsView({ current }: { current: PlatformId }) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className={cn("relative overflow-hidden rounded-2xl border border-[#f59e0b]/30 bg-gradient-to-br from-[#f59e0b]/10 p-7 md:p-10", T.toCard)}>
        <div className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-[#f59e0b]/15 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d97706] dark:text-[#fbbf24]">
            <Boxes className="size-3" />
            Platformlarım
          </div>
          <h1 className={cn("mt-3 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl", T.fg)}>
            Geliştirdiğim diğer platformlara da göz atın
          </h1>
          <p className={cn("mt-3 text-base leading-relaxed md:text-[17px]", T.sub)}>
            Hepsi tamamen ücretsiz, <strong className={T.fg}>bağımsız bir inisiyatifle</strong> yenilenebilir enerji sektörü
            paydaşlarına sunuluyor. Yakında olan platformlardan haberdar olmak için iletişime geçebilirsiniz.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((p) => (
          <Card key={p.id} p={p} here={p.id === current} />
        ))}
      </div>
    </div>
  );
}

function Card({ p, here }: { p: PlatformInfo; here: boolean }) {
  const soon = p.status === "soon";
  const linked = !!p.href && !here && !soon;
  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-sm transition-all",
        T.card,
        here ? "border-[#f59e0b]/60 ring-2 ring-[#f59e0b]/30" : T.border,
        linked && "hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between">
        <PlatformLogo id={p.id} size={48} className="shrink-0 rounded-xl shadow-sm" />
        {here ? (
          <span className="rounded-full bg-[#f59e0b] px-2.5 py-1 text-[10px] font-bold tracking-wider text-white">BURADASIN</span>
        ) : soon ? (
          <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider", T.border, T.soft, T.faint)}>YAKINDA</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#059669] dark:text-[#34d399]">
            <span className="size-1.5 rounded-full bg-[#10b981]" />
            CANLIDA
          </span>
        )}
      </div>
      <div className="mt-4 flex-1">
        <div className={cn("text-[11px] font-bold uppercase tracking-[0.14em]", T.accentText)}>{p.tagline}</div>
        <h3 className={cn("mt-1 text-lg font-extrabold tracking-tight md:text-xl", T.fg)} data-no-i18n>{p.title}</h3>
        <p className={cn("mt-2 text-[13.5px] leading-relaxed", T.sub)}>{p.description}</p>
      </div>
      <div className="mt-5">
        {linked ? (
          <a
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition-colors", T.btn)}
          >
            İncele <ExternalLink className="size-3.5" />
          </a>
        ) : soon ? (
          <span className={cn("inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold", T.border, T.soft, T.faint)}>
            Yakında <ArrowRight className="size-3.5" />
          </span>
        ) : null}
      </div>
    </article>
  );
}
