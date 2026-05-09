/**
 * Proje statusu — server + client komponentler tarafindan paylasilir.
 * Bu dosya 'use client' degildir; server pages buradan import edebilir.
 */
export const COMPLETION_TRANSITION_VALUES = [
  "COMPLETED",
  "CLOSE_WIN",
  "CLOSE_LOST",
  "CANCELLED",
] as const;

export type CompletionStatus = (typeof COMPLETION_TRANSITION_VALUES)[number];

export function isCompletionStatus(status: string): boolean {
  return (COMPLETION_TRANSITION_VALUES as readonly string[]).includes(status);
}

/**
 * Proje listelerinde gozukmeli mi?
 *
 * Kural: bir projenin yatirimci/operasyona gosterilebilmesi icin en az
 * Proje + Teknik sekmelerinin "Kaydet & İlerle" basilmis olmasi gerekir
 * (gesStep >= 2). Aksi halde proje DB'de "yarim kalmis" olarak durur ama
 * Dashboard ve Projeler sayfasinda gozukmez.
 *
 * Geri-uyumluluk: gesStep alani olmayan eski projelerde status'a bakariz —
 * COMPLETED / CLOSE_WIN / CLOSE_LOST ise zaten tamamlanmis demektir, goster.
 */
export function isProjectVisible(p: {
  status: string;
  projectDetail?: { settings?: unknown } | null;
}): boolean {
  const settings = (p.projectDetail?.settings as Record<string, unknown> | undefined) ?? {};
  const gesStep = Number(settings.gesStep) || 0;
  if (gesStep >= 2) return true;
  // Eski projeler icin fallback: gesStep yokken bile status COMPLETED ise
  // gozuksun (yeni gating sistemi oncesi olusturulmus tamamlanmis projeler).
  return ["COMPLETED", "CLOSE_WIN", "CLOSE_LOST"].includes(p.status);
}
