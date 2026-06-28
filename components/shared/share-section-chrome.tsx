"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, LayoutGrid } from "lucide-react";
import { customerTabLabel } from "@/lib/share-tabs";

/**
 * Bölüm sayfalarını sarar: üstte "Genel Bakış'a dön", altta "Önceki / Sonraki"
 * rehberli geçiş. Genel Bakış (kök) sayfasında hiçbir şey eklemez (kendi
 * tasarımı var). Üst sekme çubuğu kolay gözden kaçtığı için asıl navigasyon budur.
 */
export function ShareSectionChrome({
  token,
  tabIds,
  accent,
  children,
}: {
  token: string;
  tabIds: string[];
  accent: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/share/${token}`;
  const currentId = pathname.startsWith(base + "/") ? pathname.slice(base.length + 1) : "";

  // Genel Bakış (kök): olduğu gibi göster.
  if (!currentId) return <>{children}</>;

  const i = tabIds.indexOf(currentId);
  const prev = i > 0 ? tabIds[i - 1] : null; // ilk bölümün öncesi = Genel Bakış
  const next = i >= 0 && i < tabIds.length - 1 ? tabIds[i + 1] : null;

  return (
    <div className="space-y-4">
      <Link
        href={base}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
        style={{ color: accent }}
      >
        <ArrowLeft className="size-3.5" /> Genel Bakış&apos;a dön
      </Link>

      {children}

      {/* Önceki / Sonraki */}
      <div className="flex gap-3">
        {prev ? (
          <Link
            href={`${base}/${prev}`}
            className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300"
          >
            <ArrowLeft className="size-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Önceki</div>
              <div className="truncate text-sm font-semibold">{customerTabLabel(prev)}</div>
            </div>
          </Link>
        ) : (
          <Link
            href={base}
            className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300"
          >
            <LayoutGrid className="size-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Geri</div>
              <div className="truncate text-sm font-semibold">Genel Bakış</div>
            </div>
          </Link>
        )}

        {next && (
          <Link
            href={`${base}/${next}`}
            className="flex flex-1 items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-right shadow-sm transition-colors hover:border-slate-300"
          >
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Sonraki</div>
              <div className="truncate text-sm font-semibold">{customerTabLabel(next)}</div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-slate-400" />
          </Link>
        )}
      </div>
    </div>
  );
}
