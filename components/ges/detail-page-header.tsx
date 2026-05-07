"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Üstteki küçük etiket — örn. "Teknik Parametreler" */
  kicker: string;
  /** Büyük başlık — genellikle proje adı */
  title: string;
  /**
   * Geri ok'unun gideceği yer. undefined ise geri butonu gözükmez.
   * Örn. /projects/abc/detail/teknik
   */
  backHref?: string;
  /** Sağ tarafa yerleşecek aksiyon butonları (Kaydet, Kaydet & İlerle vb.) */
  actions?: React.ReactNode;
  /**
   * İkincil satır — arama kutusu, gizle/göster toggle, "Tümünü Aç" gibi
   * sayfa-içi kontroller. Verildiğinde header iki satıra döner.
   */
  secondary?: React.ReactNode;
  /**
   * Stats metni — "37 kalem · 24 grup" gibi. İkincil satırda solda yer alır.
   */
  stats?: React.ReactNode;
  /**
   * İkincil satırda kucağın hemen altında gözükecek bilgi kutusu — örn.
   * "Boş kalemler olmadan yeniden sıralama yapılmıştır" gibi.
   */
  notice?: React.ReactNode;
}

export function DetailPageHeader({
  kicker,
  title,
  backHref,
  actions,
  secondary,
  stats,
  notice,
}: Props) {
  const hasSecondaryRow = !!secondary || !!stats;
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Mobil: title ve actions dikey stack; tablet+: yan yana */}
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Önceki sekme"
              className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-foreground sm:size-8"
            >
              <ArrowLeft className="size-4" />
            </Link>
          )}
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold leading-none text-primary-soft-foreground")}>
              {kicker}
            </p>
            <p className="mt-1 truncate text-sm font-bold leading-tight tracking-tight text-foreground sm:max-w-md">
              {title}
            </p>
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
        )}
      </div>
      {hasSecondaryRow && (
        <div className="flex flex-col gap-2 border-t bg-muted/30 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
          {stats && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {stats}
            </div>
          )}
          {secondary && (
            <div className="flex flex-wrap items-center gap-2">{secondary}</div>
          )}
        </div>
      )}
      {notice && (
        <div className="border-t bg-info-soft/40 px-4 py-2 text-[11.5px] text-info-soft-foreground">
          {notice}
        </div>
      )}
    </div>
  );
}

/**
 * Detail flow tab sırası — geri butonunun gideceği yeri hesaplamak için.
 * URL sonu (örn. "/teknik") -> önceki tab URL sonu.
 */
export const TAB_PREV: Record<string, string | null> = {
  "": null, // Proje (ana detay) — geri yok
  "/teknik": "",
  "/kesif-a": "/teknik",
  "/kesif-b": "/kesif-a",
  "/timeline": "/kesif-b",
  "/analiz": "/timeline",
  "/cashflow": "/analiz",
  "/boq": "/cashflow",
  "/priced-boq": "/boq",
  "/dor": "/priced-boq",
};

/** Helper — projectId + suffix ile backHref string üretir, suffix null ise undefined döner. */
export function prevHref(projectId: string, currentSuffix: string): string | undefined {
  const prev = TAB_PREV[currentSuffix];
  if (prev === null || prev === undefined) return undefined;
  return `/projects/${projectId}/detail${prev}`;
}
