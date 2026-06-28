"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Package, BarChart3, FileDown, GitBranch, Lock, Copy } from "lucide-react";

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
  { label: "Revizeler", href: "/revizeler", icon: Copy, minStep: 2, lockHint: "Önce kalemleri kaydedin" },
  { label: "Teklif PDF", href: "/quote-pdf", icon: FileDown, minStep: 2, lockHint: "Önce kalemleri kaydedin" },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch, minStep: 0 },
];

function QuoteDetailNavView({
  projectId,
  step,
  viewSuffix,
}: {
  projectId: string;
  step: number;
  viewSuffix: string;
}) {
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
            href={`${full}${viewSuffix}`}
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

function QuoteDetailNavInner(props: { projectId: string; step: number }) {
  // Görüntüleme modu (?view=1) sekme gezintisinde de korunmalı — aksi halde
  // başka sekmeye geçince salt-okunur kaybolup düzenlenebilir hale geliyordu.
  const searchParams = useSearchParams();
  const viewSuffix = searchParams.get("view") === "1" ? "?view=1" : "";
  return <QuoteDetailNavView {...props} viewSuffix={viewSuffix} />;
}

export function QuoteDetailNav(props: { projectId: string; step: number }) {
  // useSearchParams Next.js build static prerender icin Suspense ister.
  return (
    <Suspense fallback={<QuoteDetailNavView {...props} viewSuffix="" />}>
      <QuoteDetailNavInner {...props} />
    </Suspense>
  );
}
