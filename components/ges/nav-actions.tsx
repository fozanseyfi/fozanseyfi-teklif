"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Detail sayfasinin nav bar'inin sag tarafindaki action slot'una
 * herhangi bir buton/etiket portallar.
 *
 * Kullanim — herhangi bir detail alt sayfasinda:
 *   <NavActions>
 *     <Button>Kaydet & İlerle</Button>
 *   </NavActions>
 *
 * Slot, GesDetailNav icindeki <div id="ges-nav-actions" />.
 *
 * Slot yoksa (orn. public share layout'unda GesDetailNav render edilmez),
 * cocuk(lar)i sayfa basinda saga yaslanmis inline blok olarak render eder.
 * Yani PDF/Yazdir butonlari her ortamda erisilebilir kalir.
 */
export function NavActions({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = document.getElementById("ges-nav-actions");
    setTarget(el);
    setMounted(true);
  }, []);

  // SSR sırasında hiçbir şey render etme — hydration mismatch'i engeller.
  if (!mounted) return null;
  if (!target) {
    return (
      <div className="-mt-2 mb-2 flex justify-end gap-2">{children}</div>
    );
  }
  return createPortal(children, target);
}
