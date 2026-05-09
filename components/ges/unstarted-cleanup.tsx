"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { deleteIfUnstartedProject } from "@/app/actions/ges";

interface Props {
  projectId: string;
  /**
   * Layout'tan gelen baslangic gesStep degeri. Buradaki client tarafi sadece
   * "kullanici detail'den ayrildi mi?" kontrolunu yapar; gerçek silme karari
   * yine server action'da yeniden hesaplanan gesStep'e gore verilir
   * (idempotent + race-safe).
   */
  initialGesStep: number;
}

/**
 * Detail layout'a mount edilen sessiz temizleyici.
 *
 * Davranis:
 *  - usePathname'i izler. Path /projects/<id>/ ile baslamiyorsa kullanici
 *    detail kapsama alanindan cikti demektir.
 *  - Bu durumda deleteIfUnstartedProject(projectId) cagrilir; eger gesStep
 *    < 2 ise proje sessizce silinir.
 *  - initialGesStep zaten >= 2 ise hiçbir şey yapmaz (gereksiz request yok).
 *  - Tek-vurus: bir kez çıkış algılandıktan sonra tekrar tetiklenmez.
 *
 * Tab kapatma / refresh icin guvence YOK (beforeunload async server action
 * bekleyemez); bu durum icin DB'de yarim kalmis kayit kalir — ileride bir
 * cron veya admin paneli temizleyebilir.
 */
export function UnstartedProjectCleanup({ projectId, initialGesStep }: Props) {
  const pathname = usePathname();
  const firedRef = useRef(false);

  useEffect(() => {
    if (initialGesStep >= 2) return;
    if (firedRef.current) return;

    const stillInside = pathname.startsWith(`/projects/${projectId}`);
    if (stillInside) return;

    firedRef.current = true;
    deleteIfUnstartedProject(projectId).catch((err) => {
      console.warn("[unstarted-cleanup] failed:", err);
    });
  }, [pathname, projectId, initialGesStep]);

  return null;
}
