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
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
  /** Returns true if the tab is unlocked given the project's progress. */
  isUnlocked?: (p: DetailNavProgress) => boolean;
  /** Helpful message shown in tooltip when locked. */
  lockHint?: string;
}

// Permissive helper: if any later step has data, all earlier ones unlock.
const downstream = (...flags: (keyof DetailNavProgress)[]) => (p: DetailNavProgress) =>
  flags.some((f) => p[f]);

const GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: "input",
    label: "Veri Giriş",
    items: [
      { label: "Proje", href: "", icon: Info },
      {
        label: "Teknik",
        href: "/teknik",
        icon: Settings2,
        isUnlocked: downstream("info", "teknik", "kesifA", "kesifB", "timeline"),
        lockHint: "Önce Proje bilgilerini doldurup kaydedin",
      },
      {
        label: "Keşif-A",
        href: "/kesif-a",
        icon: List,
        isUnlocked: downstream("teknik", "kesifA", "kesifB", "timeline"),
        lockHint: "Önce Teknik parametreleri doldurun",
      },
      {
        label: "Keşif-B",
        href: "/kesif-b",
        icon: FileText,
        isUnlocked: downstream("kesifA", "kesifB", "timeline"),
        lockHint: "Önce Keşif-A kalemlerini doldurun",
      },
      {
        label: "CF Timeline",
        href: "/timeline",
        icon: Calendar,
        isUnlocked: downstream("kesifB", "timeline"),
        lockHint: "Önce Keşif-B kalemlerini doldurun",
      },
    ],
  },
  {
    id: "analysis",
    label: "Analiz & Akış",
    items: [
      {
        label: "ANALİZ",
        href: "/analiz",
        icon: BarChart3,
        primary: true,
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
    id: "outputs",
    label: "Çıktılar",
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

interface Props {
  projectId: string;
  progress: DetailNavProgress;
}

export function GesDetailNav({ projectId, progress }: Props) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/detail`;

  return (
    <nav className="rounded-xl border bg-card p-2 shadow-sm">
      <div className="flex flex-wrap items-stretch gap-1 lg:flex-nowrap">
        {/* Sol: sekmeler */}
        <div className="flex flex-1 flex-wrap items-stretch gap-1 lg:flex-nowrap">
        {GROUPS.map((group, gi) => (
          <div
            key={group.id}
            className={cn(
              "flex items-center gap-1",
              gi > 0 && "ml-0 lg:ml-1 lg:border-l lg:pl-2",
            )}
          >
            {group.items.map((item) => {
              const href = `${base}${item.href}`;
              const isActive =
                item.href === ""
                  ? pathname === base || pathname === `${base}/`
                  : pathname.startsWith(`${base}${item.href}`);
              const unlocked = item.isUnlocked?.(progress) ?? true;

              if (!unlocked) {
                return (
                  <span
                    key={item.href}
                    title={item.lockHint}
                    aria-disabled="true"
                    className="flex shrink-0 cursor-not-allowed select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground/60"
                  >
                    <Lock className="size-3" />
                    {item.label}
                  </span>
                );
              }

              if (item.primary) {
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-bold tracking-wide transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-primary/30 bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70",
                    )}
                  >
                    <item.icon className="size-3.5" />
                    {item.label}
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        </div>
        {/* Sag: page-level action slot — `NavActions` portal hedefi.
            Sayfalar <NavActions>...</NavActions> ile buraya buton koyar.
            Bos olabilir. */}
        <div
          id="ges-nav-actions"
          className="ml-auto flex shrink-0 items-center gap-1.5"
        />
      </div>
    </nav>
  );
}
