"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Gece / gündüz modu. Seçim localStorage'da tutulur; ilk boyamadan önce app/layout'taki betik uygular. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount'ta <html> sınıfından başlangıç durumu (dış senkronizasyon)
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {}
    window.dispatchEvent(new CustomEvent("theme:changed", { detail: next }));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Aydınlık temaya geç" : "Karanlık temaya geç"}
      title={theme === "dark" ? "Aydınlık tema" : "Karanlık tema"}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary text-foreground transition-colors hover:bg-secondary/80"
    >
      {theme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
    </button>
  );
}
