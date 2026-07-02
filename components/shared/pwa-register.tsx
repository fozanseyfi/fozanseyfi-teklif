"use client";

import { useEffect } from "react";

/** Service worker'ı kaydeder — PWA kurulabilirliği için. Görsel çıktı yok. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW kaydı başarısız olsa da uygulama normal çalışır */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
