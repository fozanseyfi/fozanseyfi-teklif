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
  const gridCls = isCompact
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
    : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5";

  return (
    <section className={sectionCls}>
      <div className={wrapperCls}>
        <div className={cn("mb-5 flex flex-col gap-1.5", !isCompact && "sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4")}>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-soft-foreground">
              <Sparkles className="size-3" />
              Diğer İnisiyatiflerim
            </div>
            <h3 className={cn(
              "mt-2 font-bold leading-tight tracking-tight text-foreground",
              isCompact ? "text-[17px] sm:text-[19px]" : "text-[18px] sm:text-[20px]",
            )}>
              Geliştirdiğim diğer platformlar
            </h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
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
            const padCls = isCompact ? "p-4" : "p-3";
            const iconSize = isCompact ? "size-12" : "size-10";
            const titleSize = isCompact ? "text-[14px]" : "text-[12.5px]";
            const subtitleSize = isCompact ? "text-[12px]" : "text-[10.5px]";

            const Inner = (
              <>
                <div
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105",
                    iconSize,
                  )}
                  style={{ backgroundColor: p.color }}
                >
                  <p.icon className={isCompact ? "size-6" : "size-5"} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("truncate font-bold leading-tight text-foreground", titleSize)}>
                      {p.name}
                    </p>
                    {p.current && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: p.softColor, color: p.color }}
                      >
                        Buradasın
                      </span>
                    )}
                    {isComing && (
                      <span className="shrink-0 rounded-full border border-warning/30 bg-warning-soft/70 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-warning-soft-foreground">
                        Yakında
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-0.5 leading-snug text-muted-foreground", subtitleSize, isCompact ? "line-clamp-2" : "truncate")}>
                    {p.subtitle}
                  </p>
                </div>
                {!p.current && p.href && (
                  <ArrowUpRight
                    className="size-4 shrink-0 self-start opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: p.color }}
                  />
                )}
              </>
            );

            const baseClasses = cn(
              "group flex items-center gap-3 rounded-2xl border bg-card shadow-sm transition-all",
              padCls,
            );

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
