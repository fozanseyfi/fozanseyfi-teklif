import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { parseBrandSettings, type BrandSettings } from "@/lib/pdf-brand";
import { normalizeTabId } from "@/lib/share-tabs";
import type { Project } from "@prisma/client";

export interface ShareContext {
  link: {
    id: string;
    token: string;
    customerLabel: string | null;
    includedTabs: string[];
    expiresAt: Date | null;
    viewCount: number;
  };
  project: Project;
  detail: {
    kesifA: unknown;
    kesifB: unknown;
    settings: unknown;
    timeline: unknown;
    dor: unknown;
  };
  firmName: string;
  brand: BrandSettings;
}

/**
 * Token validate eder + share context'i döner. Cache'lenmiş — aynı request
 * içinde layout + page birden çağırırsa DB'ye sadece bir kez gider.
 *
 * Geçersiz/expired/revoked token → null döner; çağıran notFound() çağırır.
 */
export const loadShareContext = cache(async (token: string): Promise<ShareContext | null> => {
  if (!token || typeof token !== "string") return null;

  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      project: true,
      organization: { select: { name: true, brandSettings: true } },
    },
  });
  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;

  const detail = await prisma.projectDetail.findUnique({
    where: { projectId: link.projectId },
  });

  // includedTabs Json — string[] olarak güvenle parse et + eski id'leri yeni
  // id'lere migrate et (boq → boq-unpriced, priced-boq → priced-boq-detailed).
  const rawTabs = Array.isArray(link.includedTabs)
    ? (link.includedTabs as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  const tabs = Array.from(
    new Set(
      rawTabs
        .map((t) => normalizeTabId(t))
        .filter((t): t is NonNullable<typeof t> => t !== null),
    ),
  );

  return {
    link: {
      id: link.id,
      token: link.token,
      customerLabel: link.customerLabel,
      includedTabs: tabs,
      expiresAt: link.expiresAt,
      viewCount: link.viewCount,
    },
    project: link.project,
    detail: {
      kesifA: detail?.kesifA ?? [],
      kesifB: detail?.kesifB ?? [],
      settings: detail?.settings ?? {},
      timeline: detail?.timeline ?? {},
      dor: detail?.dor ?? [],
    },
    firmName: link.organization.name,
    brand: parseBrandSettings(link.organization.brandSettings),
  };
});

/**
 * Görüntülenme sayısını artırır. Layout'tan tek sefer çağrılır (cache yok —
 * her sayfa yüklenmesinde counter artar). Hata yutsun ki public sayfa
 * görünmesin diye logu fail edip dönmesin.
 */
export async function recordShareView(linkId: string): Promise<void> {
  try {
    await prisma.shareLink.update({
      where: { id: linkId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn("[share-loader] view increment failed:", err);
  }
}
