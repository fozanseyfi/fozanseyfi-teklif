"use client";

import {
  Sparkles,
  FolderKanban,
  LineChart,
  Wrench,
  Trophy,
  ExternalLink,
  Boxes,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ▼▼▼ BU PROJENİN KEY'İ ▼▼▼
const CURRENT_KEY = "solar-teklif";
// ▲▲▲ Diğer her şey aynen kalır ▲▲▲

type Tone = "amber" | "emerald" | "violet" | "blue" | "rose";

type Platform = {
  key: string;
  title: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  href: string | null;
};

const ALL_PLATFORMS: Platform[] = [
  {
    key: "karar-destek",
    title: "Satınalma Karar Destek",
    tagline: "Çoklu kriterli skor & karar",
    description:
      "GES & RES projelerinde tedarik kararını veriyle ver: 10 metrikli ağırlıklı skor, revize karşılaştırma, anomali tespiti, PDF & Excel raporlar.",
    icon: Trophy,
    tone: "amber",
    href: "https://karardestek.fozanseyfi.com",
  },
  {
    key: "solar-teklif",
    title: "Solar Teklif Platformu",
    tagline: "EPC fiyatlandırma & cash flow",
    description:
      "Solar EPC projeleri için fiyatlandırma, akıllı marj hesabı ve nakit akışı yönetimi. Hazır şablonlar, PDF & Excel çıktıları ile teklif analizlerinizi doğru bir biçimde yapıp doğru teklifin hazırlanmasını sağlayabilirsiniz.",
    icon: Sparkles,
    tone: "emerald",
    href: "https://teklif.fozanseyfi.com",
  },
  {
    key: "proje-yonetim",
    title: "Proje Yönetim Platformu",
    tagline: "Çoklu proje, ekip & ilerleme",
    description:
      "Birden fazla projeyi tek panelde yönet: milestone takibi, görev atama, ilerleme yüzdeleri ve bütçe izleme. Ekip içi şeffaflık, geç kalan iş yok.",
    icon: FolderKanban,
    tone: "violet",
    href: null,
  },
  {
    key: "fizibilite",
    title: "Solar Fizibilite Platformu",
    tagline: "Yatırım & geri ödeme analizi",
    description:
      "Solar yatırım kararları için geri ödeme süresi, IRR ve NPV hesaplamaları. Senaryo karşılaştırması ve risk değerlendirme — yatırımcıya gitmeden önce sayıları gör.",
    icon: LineChart,
    tone: "blue",
    href: null,
  },
  {
    key: "ges-muhendislik",
    title: "GES Mühendislik Platformu",
    tagline: "Tasarım, hesap & dokümantasyon",
    description:
      "Tasarım hesabı, kayıp analizi, kablo & inverter seçimi. Tek hat şeması ve teknik dokümantasyon üretimi — sahaya inmeden önce her şey hazır.",
    icon: Wrench,
    tone: "rose",
    href: null,
  },
];

const TONE_STYLES: Record<
  Tone,
  { iconBg: string; iconText: string; ring: string; hoverBorder: string; gradient: string }
> = {
  amber: {
    iconBg: "bg-yellow-100",
    iconText: "text-yellow-700",
    ring: "ring-yellow-200/60",
    hoverBorder: "hover:border-yellow-300",
    gradient: "from-yellow-50/60 via-white to-white",
  },
  emerald: {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    ring: "ring-emerald-200/60",
    hoverBorder: "hover:border-emerald-300",
    gradient: "from-emerald-50/60 via-white to-white",
  },
  violet: {
    iconBg: "bg-violet-100",
    iconText: "text-violet-700",
    ring: "ring-violet-200/60",
    hoverBorder: "hover:border-violet-300",
    gradient: "from-violet-50/60 via-white to-white",
  },
  blue: {
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
    ring: "ring-blue-200/60",
    hoverBorder: "hover:border-blue-300",
    gradient: "from-blue-50/60 via-white to-white",
  },
  rose: {
    iconBg: "bg-rose-100",
    iconText: "text-rose-700",
    ring: "ring-rose-200/60",
    hoverBorder: "hover:border-rose-300",
    gradient: "from-rose-50/60 via-white to-white",
  },
};

export default function PlatformsPage() {
  const platforms = ALL_PLATFORMS.filter((p) => p.key !== CURRENT_KEY);
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Hero — emerald palet (proje renkleri) */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 via-white to-white p-7 md:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-emerald-50 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            <Boxes className="size-3" />
            Diğer Platformlar
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Geliştirdiğim diğer platformlara da göz atın
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 md:text-lg">
            Mesleki tecrübelerimle kendi iş süreçlerimi dijitalleştirmek için
            geliştirdiğim bu platformları,{" "}
            <strong className="text-slate-900">aktif birer araç olarak
            herkesin kullanımına ücretsiz açıyorum</strong>. Sektörel fayda
            sağlaması adına dilediğiniz gibi faydalanabilirsiniz. Platformlara
            eklemek, düzenlemek veya geliştirmek istediğiniz hususları
            iletmeniz benim için çok değerli olacaktır.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((p) => (
          <PlatformCard key={p.key} platform={p} />
        ))}
      </div>
    </div>
  );
}

function PlatformCard({ platform }: { platform: Platform }) {
  const tone = TONE_STYLES[platform.tone];
  const Icon = platform.icon;
  const isLive = platform.href !== null;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br p-6 shadow-sm transition-all",
        tone.gradient,
        isLive ? `hover:shadow-md ${tone.hoverBorder}` : "opacity-95",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-xl",
            tone.iconBg,
            tone.iconText,
          )}
        >
          <Icon className="size-6" />
        </div>
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            CANLIDA
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            YAKINDA
          </span>
        )}
      </div>

      <div className="mt-4 flex-1">
        <div
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.14em]",
            tone.iconText,
          )}
        >
          {platform.tagline}
        </div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
          {platform.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{platform.description}</p>
      </div>

      <div className="mt-5">
        {isLive ? (
          <a
            href={platform.href!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            İncele
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400"
          >
            Yakında
            <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
