"use client";

import {
  Sun,
  Workflow,
  Trophy,
  TrendingUp,
  Wrench,
  ExternalLink,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Platform {
  name: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Marka rengi (hex). Logo karesi + hover/aktif vurgularinda kullanilir. */
  color: string;
  /** %15 opaklikta soft hover/ring rengi — color'dan turetilir, doku icin saglik. */
  softColor: string;
  href?: string;
  current?: boolean;
}

const PLATFORMS: Platform[] = [
  {
    name: "Solar Teklif Platformu",
    subtitle: "Solar EPC fiyatlandırma & kapsam yönetimi",
    icon: Sun,
    color: "#059669",
    softColor: "#ecfdf5",
    current: true,
  },
  {
    name: "Proje Yönetim Platformu",
    subtitle: "Çoklu proje, ekip ve ilerleme takibi",
    icon: Workflow,
    color: "#4f46e5",
    softColor: "#eef2ff",
  },
  {
    name: "Satınalma Karar Destek Platformu",
    subtitle: "Çoklu kriterli skor ile en doğru tedarikçi",
    icon: Trophy,
    color: "#f59e0b",
    softColor: "#fffbeb",
    href: "https://karardestek.fozanseyfi.com/",
  },
  {
    name: "Solar Fizibilite Platformu",
    subtitle: "GES yatırım & geri ödeme analizi",
    icon: TrendingUp,
    color: "#0891b2",
    softColor: "#ecfeff",
  },
  {
    name: "GES Mühendislik Platformu",
    subtitle: "Tasarım, hesap ve teknik dokümantasyon",
    icon: Wrench,
    color: "#e11d48",
    softColor: "#fff1f2",
  },
];

interface Props {
  /** Layout varyantı: contact sayfasında dar alan + büyük kartlar; login sayfasında geniş ribbon */
  variant?: "ribbon" | "compact";
}

export function OtherPlatforms({ variant = "ribbon" }: Props) {
  const isCompact = variant === "compact";
  const sectionCls = isCompact
    ? "rounded-2xl border bg-card shadow-sm"
    : "border-t border-border/60 bg-gradient-to-b from-emerald-50/40 to-background";
  const wrapperCls = isCompact
    ? "p-5 sm:p-6"
    : "mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10";
  // Hem compact hem ribbon: 5 platform için 5 sütunlu yan yana grid
  const gridCls = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

  return (
    <section className={sectionCls}>
      <div className={wrapperCls}>
        <div className={cn("mb-5 flex flex-col gap-1.5", !isCompact && "sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4")}>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-soft-foreground">
              <Sparkles className="size-3" />
              Geliştirdiğim diğer platformlar
            </div>
            <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Sahadaki ihtiyaçlardan doğan{" "}
              <strong className="text-foreground">bireysel inisiyatif</strong> projeleri.{" "}
              <strong className="text-foreground">Tek kayıt</strong> ile hepsine aynı şifreyle
              giriş yapabilirsiniz — kart üzerine tıklamanız yeterli.
            </p>
          </div>
        </div>

        <div className={gridCls}>
          {PLATFORMS.map((p) => {
            const isComing = !p.href && !p.current;

            // Dikey kart düzeni: icon üstte (büyük), isim ortada, açıklama altta.
            // Tüm kartlar yan yana 5 sütun (lg+); dar ekranda 2-3 sütun.
            const Inner = (
              <>
                {/* Üst kısım: ikon + sağ üst rozet (Buradasın/Yakında) */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105 sm:size-12"
                    style={{ backgroundColor: p.color }}
                  >
                    <p.icon className="size-5 sm:size-6" />
                  </div>
                  {p.current && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: p.softColor, color: p.color }}
                    >
                      Buradasın
                    </span>
                  )}
                  {isComing && (
                    <span className="shrink-0 rounded-full border border-warning/30 bg-warning-soft/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning-soft-foreground">
                      Yakında
                    </span>
                  )}
                  {!p.current && p.href && (
                    <ArrowUpRight
                      className="size-4 shrink-0 opacity-30 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                      style={{ color: p.color }}
                    />
                  )}
                </div>

                {/* İsim + altyazı */}
                <div className="mt-3 min-w-0">
                  <p className="text-[13px] font-bold leading-tight tracking-tight text-foreground sm:text-[13.5px]">
                    {p.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                    {p.subtitle}
                  </p>
                </div>
              </>
            );

            const baseClasses =
              "group flex h-full flex-col rounded-2xl border bg-card p-3.5 shadow-sm transition-all sm:p-4";

            if (p.current) {
              return (
                <div
                  key={p.name}
                  className={baseClasses}
                  style={{
                    borderColor: p.color,
                    boxShadow: `0 0 0 1px ${p.softColor}, 0 1px 2px 0 rgb(15 23 42 / 0.05)`,
                  }}
                  title="Bu platformdasın"
                >
                  {Inner}
                </div>
              );
            }
            if (p.href) {
              return (
                <a
                  key={p.name}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(baseClasses, "border-border/60 hover:-translate-y-0.5 hover:shadow-md")}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = p.color;
                    e.currentTarget.style.backgroundColor = p.softColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.backgroundColor = "";
                  }}
                  title={p.name}
                >
                  {Inner}
                </a>
              );
            }
            return (
              <div
                key={p.name}
                className={cn(baseClasses, "cursor-not-allowed border-dashed border-border/60 opacity-80")}
                title="Yakında"
              >
                {Inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
