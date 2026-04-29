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
  { label: "Proje",       href: "",               icon: Info,           analiz: false },
  { label: "Teknik",      href: "/teknik",         icon: Settings2,      analiz: false },
  { label: "Kesif-A",     href: "/kesif-a",        icon: List,           analiz: false },
  { label: "Kesif-B",     href: "/kesif-b",        icon: FileText,       analiz: false },
  { label: "ANALİZ",      href: "/analiz",         icon: BarChart3,      analiz: true  },
  { label: "Cash Flow",   href: "/cashflow",       icon: TrendingUp,     analiz: false },
  { label: "CF Timeline", href: "/timeline",       icon: Calendar,       analiz: false },
  { label: "BoQ",         href: "/boq",            icon: Table2,         analiz: false },
  { label: "P-BoQ",       href: "/priced-boq",     icon: DollarSign,     analiz: false },
  { label: "DoR",         href: "/dor",            icon: ClipboardCheck, analiz: false },
];

export function GesDetailNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/detail`;

  return (
    <div className="flex gap-1 overflow-x-auto items-center bg-white rounded-2xl border border-slate-200/80 shadow-sm px-3 py-2.5">
      {DETAIL_ITEMS.map((item) => {
        const href = `${base}${item.href}`;
        const isActive =
          item.href === ""
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(`${base}${item.href}`);

        if (item.analiz) {
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-5 py-2 text-sm font-extrabold whitespace-nowrap rounded-xl transition-all duration-150 flex-shrink-0 tracking-wide",
                isActive
                  ? "text-white shadow-md"
                  : "border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 text-violet-700 hover:border-violet-400 hover:from-violet-100 hover:to-purple-100"
              )}
              style={isActive ? { background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 4px 14px rgba(99,102,241,0.45)" } : {}}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-xl transition-all duration-150 flex-shrink-0",
              isActive
                ? "text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            )}
            style={isActive ? { background: "linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 100%)" } : {}}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
