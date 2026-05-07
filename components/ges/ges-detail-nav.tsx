"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Info,
  Settings2,
  BarChart3,
  List,
  FileText,
  TrendingUp,
  Calendar,
  ClipboardCheck,
  Table2,
  DollarSign,
  Lock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export interface DetailNavProgress {
  info: boolean;
  teknik: boolean;
  kesifA: boolean;
  kesifB: boolean;
  timeline: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  doneFlag?: keyof DetailNavProgress;
  hero?: boolean;
  isUnlocked?: (p: DetailNavProgress) => boolean;
  lockHint?: string;
}

const downstream = (...flags: (keyof DetailNavProgress)[]) => (p: DetailNavProgress) =>
  flags.some((f) => p[f]);

interface Stage {
  id: string;
  num: string;
  label: string;
  accent: "input" | "core" | "output";
  items: NavItem[];
}

const STAGES: Stage[] = [
  {
    id: "input",
    num: "01",
    label: "VERİ GİRİŞ",
    accent: "input",
    items: [
      { label: "Proje", href: "", icon: Info, doneFlag: "info" },
      {
        label: "Teknik",
        href: "/teknik",
        icon: Settings2,
        doneFlag: "teknik",
        isUnlocked: downstream("info", "teknik", "kesifA", "kesifB", "timeline"),
        lockHint: "Önce Proje bilgilerini doldurup kaydedin",
      },
      {
        label: "Keşif-A",
        href: "/kesif-a",
        icon: List,
        doneFlag: "kesifA",
        isUnlocked: downstream("teknik", "kesifA", "kesifB", "timeline"),
        lockHint: "Önce Teknik parametreleri doldurun",
      },
      {
        label: "Keşif-B",
        href: "/kesif-b",
        icon: FileText,
        doneFlag: "kesifB",
        isUnlocked: downstream("kesifA", "kesifB", "timeline"),
        lockHint: "Önce Keşif-A kalemlerini doldurun",
      },
      {
        label: "Timeline",
        href: "/timeline",
        icon: Calendar,
        doneFlag: "timeline",
        isUnlocked: downstream("kesifB", "timeline"),
        lockHint: "Önce Keşif-B kalemlerini doldurun",
      },
    ],
  },
  {
    id: "core",
    num: "02",
    label: "KARAR & AKIŞ",
    accent: "core",
    items: [
      {
        label: "ANALİZ",
        href: "/analiz",
        icon: BarChart3,
        hero: true,
        isUnlocked: downstream("timeline"),
        lockHint: "Önce CF Timeline'ı doldurup kaydedin",
      },
      {
        label: "Cash Flow",
        href: "/cashflow",
        icon: TrendingUp,
        isUnlocked: downstream("timeline"),
        lockHint: "Önce CF Timeline'ı doldurup kaydedin",
      },
    ],
  },
  {
    id: "output",
    num: "03",
    label: "ÇIKTILAR",
    accent: "output",
    items: [
      {
        label: "BoQ",
        href: "/boq",
        icon: Table2,
        isUnlocked: downstream("timeline"),
        lockHint: "Önce CF Timeline'ı doldurup kaydedin",
      },
      {
        label: "P-BoQ",
        href: "/priced-boq",
        icon: DollarSign,
        isUnlocked: downstream("timeline"),
        lockHint: "Önce CF Timeline'ı doldurup kaydedin",
      },
      {
        label: "DoR",
        href: "/dor",
        icon: ClipboardCheck,
        isUnlocked: downstream("timeline"),
        lockHint: "Önce CF Timeline'ı doldurup kaydedin",
      },
    ],
  },
];

const STAGE_BG: Record<Stage["accent"], string> = {
  input:  "bg-white/70 ring-1 ring-border/50",
  core:   "bg-gradient-to-br from-emerald-50 via-emerald-50/40 to-white ring-1 ring-emerald-200/60",
  output: "bg-white/70 ring-1 ring-border/50",
};

const STAGE_NUM: Record<Stage["accent"], string> = {
  input:  "text-info-soft-foreground",
  core:   "text-primary",
  output: "text-success-soft-foreground",
};

interface Props {
  projectId: string;
  progress: DetailNavProgress;
}

export function GesDetailNav({ projectId, progress }: Props) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/detail`;

  return (
    <nav>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.55fr_1fr_1.05fr]">
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl px-3 py-2.5",
              STAGE_BG[stage.accent],
            )}
          >
            {/* Stage label — düz metin, tıklanmaz */}
            <div className="flex select-none items-baseline gap-1.5 px-1">
              <span className={cn("font-mono text-[10.5px] font-extrabold tabular-nums", STAGE_NUM[stage.accent])}>
                {stage.num}
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-foreground/85">
                {stage.label}
              </span>
            </div>
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {stage.items.map((item) => {
                const href = `${base}${item.href}`;
                const isActive =
                  item.href === ""
                    ? pathname === base || pathname === `${base}/`
                    : pathname.startsWith(`${base}${item.href}`);
                const unlocked = item.isUnlocked?.(progress) ?? true;
                const isDone = item.doneFlag ? !!progress[item.doneFlag] : false;

                if (!unlocked) {
                  return (
                    <span
                      key={item.href}
                      title={item.lockHint}
                      aria-disabled="true"
                      className="inline-flex shrink-0 cursor-not-allowed select-none items-center gap-1 whitespace-nowrap rounded-md border border-dashed border-border/60 bg-card px-2 py-1.5 text-[11px] font-medium text-muted-foreground/60"
                    >
                      <Lock className="size-2.5" />
                      {item.label}
                    </span>
                  );
                }

                if (item.hero) {
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      title="Tüm resmi tek ekranda — KPI, sale price, marjlar"
                      className={cn(
                        "group relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.06em] transition-all",
                        isActive
                          ? "scale-[1.05] bg-gradient-to-br from-emerald-600 to-emerald-700 text-primary-foreground shadow-[0_12px_26px_-10px_rgb(5_150_105_/_0.65)] ring-2 ring-emerald-300/70"
                          : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-primary-foreground shadow-[0_6px_20px_-10px_rgb(5_150_105_/_0.5)] hover:scale-[1.05] hover:shadow-[0_12px_26px_-10px_rgb(5_150_105_/_0.6)]",
                      )}
                    >
                      <Sparkles
                        className={cn(
                          "size-4 transition-transform",
                          isActive ? "rotate-12" : "group-hover:rotate-12",
                        )}
                        strokeWidth={2.6}
                      />
                      {item.label}
                    </Link>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      "group relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all",
                      isActive
                        ? "scale-[1.03] border-primary bg-primary text-primary-foreground shadow-[0_8px_18px_-6px_rgb(5_150_105_/_0.5)] ring-2 ring-primary/30"
                        : "border-border/60 bg-card text-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-soft hover:text-primary-soft-foreground hover:shadow-sm",
                    )}
                  >
                    <item.icon className="size-3.5" strokeWidth={2.3} />
                    {item.label}
                    {isDone && !isActive && (
                      <CheckCircle2 className="size-3 text-success" strokeWidth={2.8} />
                    )}
                  </Link>
                );
              })}
              {/* NavActions slot (Yazdır vs.) — Çıktılar grubunun sonuna,
                  output bölümünün doğal devamı olarak. */}
              {stage.id === "output" && (
                <div
                  id="ges-nav-actions"
                  className="ml-auto flex shrink-0 items-center gap-1.5"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
