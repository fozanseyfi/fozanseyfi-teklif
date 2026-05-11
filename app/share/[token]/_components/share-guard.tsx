import "server-only";
import { notFound } from "next/navigation";
import { loadShareContext, type ShareContext } from "@/lib/share-loader";

/**
 * Share tab sayfaları için yardımcı: token validate eder ve istenen tab'ın
 * paylaşıma dahil olup olmadığını kontrol eder. Değilse 404 döner — yönetici
 * o tab'ı seçmediyse müşteri direct URL ile bypass edemesin.
 */
export async function requireShareTab(
  token: string,
  tab: string,
): Promise<ShareContext> {
  const ctx = await loadShareContext(token);
  if (!ctx) notFound();
  if (!ctx.link.includedTabs.includes(tab)) notFound();
  return ctx;
}
