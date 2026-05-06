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
