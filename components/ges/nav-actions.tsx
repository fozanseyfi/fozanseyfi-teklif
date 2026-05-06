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
 */
export function NavActions({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("ges-nav-actions");
    setTarget(el);
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}
