"use client";

import { useEffect } from "react";
import { getClientLocale } from "@/lib/i18n";

/** Dil EN ise sayfa çevirisini başlatır (bkz. lib/i18n-dom). TR'de hiçbir şey yüklenmez. */
export function I18nRoot() {
  useEffect(() => {
    if (getClientLocale() !== "en") return;
    document.documentElement.lang = "en";
    let alive = true;
    import("@/lib/i18n-dom").then((m) => {
      if (alive) m.startDomTranslation();
    });
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
