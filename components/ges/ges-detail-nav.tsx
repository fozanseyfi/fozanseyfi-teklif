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
} from "lucide-react";

const DETAIL_ITEMS = [
  { label: "Proje", href: "", icon: Info, primary: false },
  { label: "Teknik", href: "/teknik", icon: Settings2, primary: false },
  { label: "Keşif-A", href: "/kesif-a", icon: List, primary: false },
  { label: "Keşif-B", href: "/kesif-b", icon: FileText, primary: false },
  { label: "ANALİZ", href: "/analiz", icon: BarChart3, primary: true },
  { label: "Cash Flow", href: "/cashflow", icon: TrendingUp, primary: false },
  { label: "CF Timeline", href: "/timeline", icon: Calendar, primary: false },
  { label: "BoQ", href: "/boq", icon: Table2, primary: false },
  { label: "P-BoQ", href: "/priced-boq", icon: DollarSign, primary: false },
  { label: "DoR", href: "/dor", icon: ClipboardCheck, primary: false },
];

export function GesDetailNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/detail`;

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border bg-card px-2 py-2 shadow-sm">
      {DETAIL_ITEMS.map((item) => {
        const href = `${base}${item.href}`;
        const isActive =
          item.href === ""
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(`${base}${item.href}`);

        // Highlighted "ANALİZ" tab — primary brand emphasis
        if (item.primary) {
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold tracking-wide transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-primary/30 bg-primary-soft text-primary-soft-foreground hover:border-primary/60 hover:bg-primary-soft/70",
              )}
            >
              <item.icon className="size-4" />
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
  );
}
