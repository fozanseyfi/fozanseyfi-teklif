"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getClientLocale, setClientLocale, type Locale } from "@/lib/i18n";

/** TR | EN seçici. Seçim cookie'ye yazılır, sayfa yeniden yüklenir. */
export function LocaleToggle() {
  const [locale, setLocaleState] = useState<Locale>("tr");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount'ta cookie'den başlangıç durumu (dış senkronizasyon)
    setLocaleState(getClientLocale());
  }, []);

  function choose(next: Locale) {
    if (next === locale) return;
    setClientLocale(next);
    setLocaleState(next);
    window.location.reload();
  }

  const btn = (l: Locale, label: string, title: string) => (
    <button
      type="button"
      onClick={() => choose(l)}
      aria-pressed={locale === l}
      title={title}
      data-no-i18n
      className={cn(
        "h-full px-2 text-xs font-semibold transition-colors sm:px-2.5",
        locale === l
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border bg-secondary"
      data-no-i18n
    >
      {btn("tr", "TR", "Türkçe")}
      {btn("en", "EN", "English")}
    </div>
  );
}
