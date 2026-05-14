"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandSettings } from "@/lib/pdf-brand";

interface TabItem {
  id: string;
  label: string;
}

interface Props {
  firmName: string;
  brand: BrandSettings;
  projectName: string;
  customerName: string;
  token: string;
  tabs: TabItem[];
}

export function ShareHeader({
  firmName,
  brand,
  projectName,
  customerName,
  token,
  tabs,
}: Props) {
  const pathname = usePathname();

  // Marka renk uygulanır; logo varsa onu, yoksa solar simge.
  const accent = brand.colorEnabled && brand.color ? brand.color : "#059669";
  const showLogo = brand.logoEnabled && brand.logoUrl;

  return (
    <header
      data-share-chrome="header"
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md"
    >
      {/* Üst: marka + proje meta */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          {showLogo ? (
            <img
              src={brand.logoUrl!}
              alt=""
              className="max-h-10 max-w-[140px] object-contain"
            />
          ) : (
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              <Sun className="size-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              {firmName}
            </p>
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900">
              {projectName || "Proje"}
            </h1>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          {customerName && (
            <span className="flex items-center gap-1">
              <User className="size-3" /> {customerName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Building2 className="size-3" /> {firmName}
          </span>
        </div>
      </div>

      {/* Alt: tab navigasyonu */}
      {tabs.length > 0 && (
        <nav className="mx-auto max-w-[1440px] overflow-x-auto px-4 sm:px-6 lg:px-8">
          <ul className="flex min-w-max gap-1 pb-2">
            {tabs.map((t) => {
              const href = `/share/${token}/${t.id}`;
              const active = pathname === href;
              return (
                <li key={t.id}>
                  <Link
                    href={href}
                    className={cn(
                      "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                    style={active ? { backgroundColor: accent } : undefined}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
