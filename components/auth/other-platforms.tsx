"use client";

import {
  Sun,
  Workflow,
  Trophy,
  TrendingUp,
  Wrench,
  ExternalLink,
  Sparkles,
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
    subtitle: "Solar EPC fiyatlandırma & cash flow",
    icon: Sun,
    color: "#059669",       // emerald
    softColor: "#ecfdf5",
    current: true,
  },
  {
    name: "Proje Yönetim Platformu",
    subtitle: "Çoklu proje, ekip & ilerleme takibi",
    icon: Workflow,
    color: "#4f46e5",       // indigo
    softColor: "#eef2ff",
  },
  {
    name: "Satınalma Karar Destek Platformu",
    subtitle: "Çoklu kriterli skor ile en doğru tedarikçi",
    icon: Trophy,
    color: "#f59e0b",       // amber
    softColor: "#fffbeb",
    href: "https://karardestek.fozanseyfi.com/",
  },
  {
    name: "Solar Fizibilite Platformu",
    subtitle: "GES yatırım & geri ödeme analizi",
    icon: TrendingUp,
    color: "#0891b2",       // cyan
    softColor: "#ecfeff",
  },
  {
    name: "GES Mühendislik Platformu",
    subtitle: "Tasarım, hesap & teknik dokümantasyon",
    icon: Wrench,
    color: "#e11d48",       // rose
    softColor: "#fff1f2",
  },
];

export function OtherPlatforms() {
  return (
    <section className="border-t border-border/60 bg-gradient-to-b from-emerald-50/40 to-background">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-5 flex flex-col items-start gap-1.5 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-soft-foreground">
              <Sparkles className="size-3" />
              Diğer Ücretsiz Platformlarım
            </div>
            <h3 className="mt-2 text-[18px] font-bold leading-tight tracking-tight text-foreground sm:text-[20px]">
              Geliştirdiğim diğer platformlara da göz atın
            </h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Hepsi tamamen ücretsiz, <strong className="text-foreground">bağımsız bir
              inisiyatifle</strong> sektör paydaşlarına sunuluyor.{" "}
              <strong className="text-foreground">Buraya yaptığınız tek kayıt ile</strong> tüm
              platformlara aynı şifreyle giriş yapabilirsiniz — diğer platformlarıma ulaşmak için
              kart üzerine tıklamanız yeterli.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PLATFORMS.map((p) => {
            const isComing = !p.href && !p.current;
            const Inner = (
              <>
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105"
                  style={{ backgroundColor: p.color }}
                >
                  <p.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[12.5px] font-bold leading-tight text-foreground">
                      {p.name}
                    </p>
                    {p.current && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: p.softColor, color: p.color }}
                      >
                        Buradasın
                      </span>
                    )}
                    {!p.current && p.href && (
                      <ExternalLink
                        className="size-3 shrink-0 transition-colors"
                        style={{ color: p.color }}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                    {p.subtitle}
                  </p>
                  {isComing && (
                    <span className="mt-1 inline-flex rounded-full border border-warning/30 bg-warning-soft/70 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-warning-soft-foreground">
                      Yakında
                    </span>
                  )}
                </div>
              </>
            );
            const baseClasses =
              "group flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-all";
            if (p.current) {
              return (
                <div
                  key={p.name}
                  className={cn(baseClasses)}
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
                  className={cn(
                    baseClasses,
                    "border-border/60 hover:-translate-y-0.5 hover:shadow-md",
                  )}
                  style={
                    {
                      "--hover-border": p.color,
                    } as React.CSSProperties
                  }
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
                className={cn(
                  baseClasses,
                  "cursor-not-allowed border-dashed border-border/60 opacity-80",
                )}
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
