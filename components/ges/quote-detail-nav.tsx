"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Package, BarChart3, FileDown, GitBranch, Lock } from "lucide-react";

interface TabDef {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minStep: number;
  lockHint?: string;
}

const TABS: TabDef[] = [
  { label: "Müşteri", href: "", icon: User, minStep: 0 },
  { label: "Kalemler", href: "/items", icon: Package, minStep: 1, lockHint: "Önce müşteri bilgilerini kaydedin" },
  { label: "Analiz", href: "/quote-analiz", icon: BarChart3, minStep: 2, lockHint: "Önce kalemleri kaydedin" },
  { label: "Teklif PDF", href: "/quote-pdf", icon: FileDown, minStep: 2, lockHint: "Önce kalemleri kaydedin" },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch, minStep: 0 },
];

export function QuoteDetailNav({ projectId, step }: { projectId: string; step: number }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/detail`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {TABS.map((t) => {
        const full = `${base}${t.href}`;
        const isActive = t.href === "" ? pathname === base : pathname === full;
        const unlocked = step >= t.minStep;
        const Icon = t.icon;

        if (!unlocked) {
          return (
            <span
              key={t.label}
              title={t.lockHint}
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground/60"
            >
              <Lock className="size-3.5" />
              {t.label}
            </span>
          );
        }

        return (
          <Link
            key={t.label}
            href={full}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
