"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** sonner bildirimleri — gece/gündüz moduna (html.dark) uyar. */
export function ThemedToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const read = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    read();
    window.addEventListener("theme:changed", read);
    return () => window.removeEventListener("theme:changed", read);
  }, []);

  return <Toaster theme={theme} position="top-right" richColors />;
}
